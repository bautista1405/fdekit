import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { createRequire } from 'module';
import * as path from 'path';
import { asRecord } from '@fdekit/core';
import type { CodebaseSymbolEntry, CodebaseSymbolIndex, CodebaseSymbolKind } from '../interfaces/index.js';
import { collectFiles } from './index.js';

export interface SymbolIndexOptions {
  root: string;
  ignore: string[];
  maxFileBytes: number;
  cacheFilePath?: string;
}

type SupportedLanguage = 'typescript' | 'tsx' | 'javascript';

interface TreeSitterNode {
  type: string;
  text: string;
  startPosition: { row: number };
  endPosition: { row: number };
  parent: TreeSitterNode | null;
  childForFieldName(fieldName: string): TreeSitterNode | null;
  descendantsOfType(type: string): TreeSitterNode[];
}

interface TreeSitterTree {
  rootNode: TreeSitterNode;
  delete(): void;
}

type TreeSitterLanguage = object;

interface TreeSitterParserInstance {
  setLanguage(language: TreeSitterLanguage): void;
  parse(source: string): TreeSitterTree | null;
}

interface TreeSitterParserConstructor {
  new (): TreeSitterParserInstance;
  init(): Promise<void>;
}

interface TreeSitterLanguageStatic {
  load(wasmPath: string): Promise<TreeSitterLanguage>;
}

interface TreeSitterQueryMatch {
  captures: Array<{ name: string; node: TreeSitterNode }>;
}

interface TreeSitterQueryInstance {
  matches(node: TreeSitterNode): TreeSitterQueryMatch[];
}

interface TreeSitterQueryConstructor {
  new (language: TreeSitterLanguage, source: string): TreeSitterQueryInstance;
}

interface NavRuntime {
  parser: TreeSitterParserInstance;
  languages: Record<SupportedLanguage, TreeSitterLanguage>;
  queries: Record<SupportedLanguage, TreeSitterQueryInstance>;
}

const languageByExtension: Record<string, SupportedLanguage> = {
  '.ts': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.tsx': 'tsx',
  '.jsx': 'tsx',
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
};

const typescriptQuerySource = `
  (function_declaration name: (identifier) @name) @definition
  (class_declaration name: (type_identifier) @name) @definition
  (interface_declaration name: (type_identifier) @name) @definition
  (type_alias_declaration name: (type_identifier) @name) @definition
  (enum_declaration name: (identifier) @name) @definition
  (method_definition name: (property_identifier) @name) @definition
  (lexical_declaration (variable_declarator name: (identifier) @name)) @definition
`;

const javascriptQuerySource = `
  (function_declaration name: (identifier) @name) @definition
  (class_declaration name: (identifier) @name) @definition
  (method_definition name: (property_identifier) @name) @definition
  (lexical_declaration (variable_declarator name: (identifier) @name)) @definition
`;

const memoryCache = new Map<string, CodebaseSymbolIndex>();

let runtimePromise: Promise<NavRuntime> | null = null;

export function isIndexableSourceFile(filePath: string): boolean {
  return languageByExtension[path.extname(filePath).toLowerCase()] !== undefined;
}

export function resolveImportPath(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
    return null;
  }

  return stripSourceExtension(path.posix.join(path.posix.dirname(fromFile), specifier));
}

export function findImporters(index: CodebaseSymbolIndex, filePath: string): string[] {
  const targetBase = stripSourceExtension(filePath);
  const importers: string[] = [];

  for (const [fromFile, file] of Object.entries(index.files)) {
    if (fromFile === filePath) {
      continue;
    }

    const importsTarget = file.imports.some((specifier) => {
      const resolved = resolveImportPath(fromFile, specifier);

      return resolved !== null && (resolved === targetBase || `${resolved}/index` === targetBase);
    });

    if (importsTarget) {
      importers.push(fromFile);
    }
  }

  return importers.sort();
}

function stripSourceExtension(filePath: string): string {
  return filePath.replace(/\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/, '');
}

export function symbolIndexCachePath(projectDir: string | undefined, root: string): string | undefined {
  if (!projectDir) {
    return undefined;
  }

  const rootHash = createHash('sha256').update(root).digest('hex').slice(0, 12);

  return path.join(projectDir, 'artifacts', 'cache', `codebase-symbols-${rootHash}.json`);
}

/**
 * Loads the tree-sitter runtime, throwing if the parser or grammars cannot be
 * initialized. Used by connector readiness diagnostics; the result is cached so
 * a subsequent navigation call reuses it.
 */
export async function probeNavigationRuntime(): Promise<void> {
  await loadRuntime();
}

export interface SymbolIndexMeta {
  builtAt: string;
  fileCount: number;
}

export async function readSymbolIndexMeta(cacheFilePath: string | undefined): Promise<SymbolIndexMeta | null> {
  if (!cacheFilePath) {
    return null;
  }

  try {
    const index = JSON.parse(await fs.readFile(cacheFilePath, 'utf8')) as CodebaseSymbolIndex;

    return { builtAt: index.builtAt, fileCount: Object.keys(index.files ?? {}).length };
  } catch {
    return null;
  }
}

export async function loadOrBuildSymbolIndex(options: SymbolIndexOptions): Promise<CodebaseSymbolIndex> {
  const runtime = await loadRuntime();
  const cached = memoryCache.get(options.root) ?? await readPersistedIndex(options);
  const index: CodebaseSymbolIndex = cached?.root === options.root
    ? cached
    : { builtAt: '', root: options.root, files: {} };
  const entries = await collectFiles(options.root, options.ignore, options.maxFileBytes);
  const seen = new Set<string>();

  for (const entry of entries) {
    if (!isIndexableSourceFile(entry.filePath)) {
      continue;
    }

    seen.add(entry.filePath);
    const absolutePath = path.join(options.root, entry.filePath);
    const stat = await fs.stat(absolutePath);
    const cachedFile = index.files[entry.filePath];

    if (cachedFile && cachedFile.mtimeMs === stat.mtimeMs) {
      continue;
    }

    index.files[entry.filePath] = {
      mtimeMs: stat.mtimeMs,
      ...(await parseSourceFile(runtime, absolutePath, entry.filePath)),
    };
  }

  for (const knownPath of Object.keys(index.files)) {
    if (!seen.has(knownPath)) {
      delete index.files[knownPath];
    }
  }

  index.builtAt = new Date().toISOString();
  memoryCache.set(options.root, index);
  await writePersistedIndex(options, index);

  return index;
}

async function loadRuntime(): Promise<NavRuntime> {
  if (!runtimePromise) {
    runtimePromise = createRuntime();
  }

  return runtimePromise;
}

async function createRuntime(): Promise<NavRuntime> {
  try {
    // Imported lazily so loading the connector stays cheap for commands that
    // never call a navigation tool; the tree-sitter wasm runtime only loads on
    // first use.
    const module = asRecord(await import('web-tree-sitter'));
    const Parser = module.Parser as TreeSitterParserConstructor | undefined;
    const Language = module.Language as TreeSitterLanguageStatic | undefined;
    const Query = module.Query as TreeSitterQueryConstructor | undefined;

    if (!Parser || !Language || !Query) {
      throw new Error('web-tree-sitter did not export Parser, Language, and Query');
    }

    await Parser.init();
    const require = createRequire(import.meta.url);
    const wasmDir = path.join(path.dirname(require.resolve('tree-sitter-wasms/package.json')), 'out');
    const [typescript, tsx, javascript] = await Promise.all([
      Language.load(path.join(wasmDir, 'tree-sitter-typescript.wasm')),
      Language.load(path.join(wasmDir, 'tree-sitter-tsx.wasm')),
      Language.load(path.join(wasmDir, 'tree-sitter-javascript.wasm')),
    ]);

    return {
      parser: new Parser(),
      languages: { typescript, tsx, javascript },
      queries: {
        typescript: new Query(typescript, typescriptQuerySource),
        tsx: new Query(tsx, typescriptQuerySource),
        javascript: new Query(javascript, javascriptQuerySource),
      },
    };
  } catch (err) {
    throw new Error(`Failed to load the tree-sitter runtime for codebase navigation; reinstall dependencies (npm install) to restore it ${err instanceof Error ? err.message : ''}`.trim());
  }
}

async function parseSourceFile(
  runtime: NavRuntime,
  absolutePath: string,
  filePath: string,
): Promise<{ symbols: CodebaseSymbolEntry[]; imports: string[] }> {
  const language = languageByExtension[path.extname(filePath).toLowerCase()];
  runtime.parser.setLanguage(runtime.languages[language]);
  const source = await fs.readFile(absolutePath, 'utf8');
  const tree = runtime.parser.parse(source);

  if (!tree) {
    return { symbols: [], imports: [] };
  }

  try {
    return {
      symbols: extractSymbols(tree.rootNode, runtime.queries[language], filePath),
      imports: extractImports(tree.rootNode),
    };
  } finally {
    tree.delete();
  }
}

function extractSymbols(
  rootNode: TreeSitterNode,
  query: TreeSitterQueryInstance,
  filePath: string,
): CodebaseSymbolEntry[] {
  const symbols: CodebaseSymbolEntry[] = [];

  for (const match of query.matches(rootNode)) {
    const nameNode = match.captures.find((capture) => capture.name === 'name')?.node;
    const definitionNode = match.captures.find((capture) => capture.name === 'definition')?.node;

    if (!nameNode || !definitionNode) {
      continue;
    }

    const exported = definitionNode.parent?.type === 'export_statement';

    if (definitionNode.type === 'lexical_declaration' && !exported && definitionNode.parent?.type !== 'program') {
      continue;
    }

    symbols.push({
      name: nameNode.text,
      kind: symbolKind(definitionNode.type),
      filePath,
      startLine: definitionNode.startPosition.row + 1,
      endLine: definitionNode.endPosition.row + 1,
      exported,
    });
  }

  return symbols;
}

function extractImports(rootNode: TreeSitterNode): string[] {
  const imports = new Set<string>();

  for (const statementType of ['import_statement', 'export_statement']) {
    for (const node of rootNode.descendantsOfType(statementType)) {
      const source = node.childForFieldName('source')?.text;

      if (source) {
        imports.add(source.replace(/^['"]|['"]$/g, ''));
      }
    }
  }

  return Array.from(imports);
}

function symbolKind(nodeType: string): CodebaseSymbolKind {
  switch (nodeType) {
    case 'function_declaration':
      return 'function';
    case 'class_declaration':
      return 'class';
    case 'interface_declaration':
      return 'interface';
    case 'type_alias_declaration':
      return 'type';
    case 'enum_declaration':
      return 'enum';
    case 'method_definition':
      return 'method';
    default:
      return 'const';
  }
}

async function readPersistedIndex(options: SymbolIndexOptions): Promise<CodebaseSymbolIndex | null> {
  if (!options.cacheFilePath) {
    return null;
  }

  try {
    return JSON.parse(await fs.readFile(options.cacheFilePath, 'utf8')) as CodebaseSymbolIndex;
  } catch {
    return null;
  }
}

async function writePersistedIndex(options: SymbolIndexOptions, index: CodebaseSymbolIndex): Promise<void> {
  if (!options.cacheFilePath) {
    return;
  }

  await fs.mkdir(path.dirname(options.cacheFilePath), { recursive: true });
  await fs.writeFile(options.cacheFilePath, JSON.stringify(index), 'utf8');
}
