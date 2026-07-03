import * as path from 'path';
import { defineConnector, defineTool, type ConnectorDefinition } from '@fdekit/core';
import {
  collectFiles,
  readEnvValue,
  readTextFile,
  resolveRoot,
  resolveSafePath,
  statFile,
  toRelativePath,
} from './helpers/index.js';
import { escapeRegExp, ripgrepSearch } from './helpers/ripgrep.js';
import { findImporters, loadOrBuildSymbolIndex, symbolIndexCachePath } from './helpers/symbol-index.js';
import type { CodebaseConnectorConfig, CodebaseConnectorOptions, CodebaseContextArgs, CodebaseContextDefinition, CodebaseContextResult, CodebaseDepsArgs, CodebaseDepsResult, CodebaseFileEntry, CodebaseListFilesArgs, CodebaseReadFileArgs, CodebaseReadFileResult, CodebaseSearchArgs, CodebaseSearchMatch, CodebaseSymbolEntry, CodebaseSymbolsArgs, CodebaseSymbolsResult, CodebaseUsagesArgs, CodebaseUsagesResult } from './interfaces/index.js';
export type { CodebaseConnectorConfig, CodebaseConnectorOptions, CodebaseContextArgs, CodebaseContextDefinition, CodebaseContextResult, CodebaseDepsArgs, CodebaseDepsResult, CodebaseFileEntry, CodebaseListFilesArgs, CodebaseReadFileArgs, CodebaseReadFileResult, CodebaseSearchArgs, CodebaseSearchMatch, CodebaseSymbolEntry, CodebaseSymbolKind, CodebaseSymbolsArgs, CodebaseSymbolsResult, CodebaseUsagesArgs, CodebaseUsagesResult } from './interfaces/index.js';

const defaultIgnore = [
  'artifacts',
  '.git',
  'dist',
  'node_modules',
  'package-lock.json',
];

const defaultToolEnvironments = ['local', 'development', 'staging'];

const listFilesArgsSchema = {
  type: 'object',
  properties: {
    pattern: {
      type: 'string',
      description: 'Optional file path substring to filter by',
    },
    maxFiles: {
      type: 'number',
      description: 'Maximum number of files to return',
    },
  },
};

const searchArgsSchema = {
  type: 'object',
  required: ['query'],
  properties: {
    query: {
      type: 'string',
      description: 'Regular expression to search for (ripgrep syntax); escape special characters to match literal text',
    },
    maxResults: {
      type: 'number',
      description: 'Maximum number of search matches to return',
    },
  },
};

const readFileArgsSchema = {
  type: 'object',
  required: ['filePath'],
  properties: {
    filePath: {
      type: 'string',
      description: 'Relative file path returned by codebase.search or codebase.listFiles',
    },
    startLine: {
      type: 'number',
      description: 'Optional 1-based start line',
    },
    endLine: {
      type: 'number',
      description: 'Optional 1-based end line',
    },
  },
};

const symbolsArgsSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'Exact or prefix symbol name to filter by',
    },
    filePath: {
      type: 'string',
      description: 'Restrict to declarations in one relative file path',
    },
    kind: {
      type: 'string',
      enum: ['function', 'class', 'interface', 'type', 'enum', 'const', 'method'],
      description: 'Restrict to one declaration kind',
    },
    maxResults: {
      type: 'number',
      description: 'Maximum number of symbols to return',
    },
  },
};

const usagesArgsSchema = {
  type: 'object',
  required: ['symbol'],
  properties: {
    symbol: {
      type: 'string',
      description: 'Symbol name to find references for across the codebase',
    },
    maxResults: {
      type: 'number',
      description: 'Maximum number of usage matches to return',
    },
  },
};

const depsArgsSchema = {
  type: 'object',
  required: ['filePath'],
  properties: {
    filePath: {
      type: 'string',
      description: 'Relative source file path to report the import graph for',
    },
  },
};

const contextArgsSchema = {
  type: 'object',
  required: ['symbol'],
  properties: {
    symbol: {
      type: 'string',
      description: 'Symbol name to assemble definition and usage context for',
    },
    maxBytes: {
      type: 'number',
      description: 'Byte budget for definition bodies (default 8000)',
    },
  },
};

export function codebaseConnector(options: CodebaseConnectorOptions = {}): ConnectorDefinition<CodebaseConnectorConfig> {
  const rootDirEnv = options.rootDirEnv ?? 'CODEBASE_ROOT';
  const projectDir = readEnvValue('FDEKIT_PROJECT_DIR', options.env);
  const configuredRoot = options.rootDir ?? readEnvValue(rootDirEnv, options.env) ?? defaultRoot(projectDir);
  const rootDir = resolveRoot(configuredRoot, projectDir);
  const maxFileBytes = options.maxFileBytes ?? 80_000;
  const ignore = options.ignore ?? defaultIgnore;

  return defineConnector({
    name: 'codebase',
    description: 'List, search, and read files from a local codebase root',
    config: {
      rootDir,
      rootDirEnv,
      maxFileBytes,
      ignore,
    },
    env: [
      {
        name: rootDirEnv,
        required: false,
        description: 'Override the local codebase root directory',
      },
    ],
    tools: [
      defineTool<CodebaseListFilesArgs, { rootDir: string; files: CodebaseFileEntry[] }>({
        name: 'codebase.listFiles',
        description: 'List files under the configured codebase root',
        scopes: ['codebase:read'],
        environments: defaultToolEnvironments,
        category: 'codebase',
        tags: ['context', 'codebase', 'read'],
        argsSchema: listFilesArgsSchema,
        async handler(args) {
          const root = resolveRoot(rootDir);
          const files = await collectFiles(root, ignore, maxFileBytes);
          const pattern = args.pattern?.toLowerCase();
          const filtered = pattern
            ? files.filter((file) => file.filePath.toLowerCase().includes(pattern))
            : files;

          return {
            rootDir: root,
            files: filtered.slice(0, args.maxFiles ?? 100),
          };
        },
      }),
      defineTool<CodebaseSearchArgs, { rootDir: string; query: string; matches: CodebaseSearchMatch[] }>({
        name: 'codebase.search',
        description: 'Search text files by regular expression under the configured codebase root',
        scopes: ['codebase:read'],
        environments: defaultToolEnvironments,
        category: 'codebase',
        tags: ['context', 'codebase', 'read', 'search'],
        argsSchema: searchArgsSchema,
        async handler(args) {
          const root = resolveRoot(rootDir);
          const query = typeof args.query === 'string' ? args.query.trim() : '';

          if (!query) {
            throw new Error('codebase.search requires a non-empty query');
          }

          const matches = await ripgrepSearch(root, ignore, maxFileBytes, query, args.maxResults ?? 20);

          return {
            rootDir: root,
            query,
            matches,
          };
        },
      }),
      defineTool<CodebaseReadFileArgs, CodebaseReadFileResult>({
        name: 'codebase.readFile',
        description: 'Read a file from the configured codebase root',
        scopes: ['codebase:read'],
        environments: defaultToolEnvironments,
        category: 'codebase',
        tags: ['context', 'codebase', 'read'],
        argsSchema: readFileArgsSchema,
        async handler(args) {
          const root = resolveRoot(rootDir);
          const absolutePath = resolveSafePath(root, args.filePath);
          const stat = await statFile(absolutePath);

          if (!stat.isFile()) {
            throw new Error(`Codebase path is not a file: ${args.filePath}`);
          }

          const raw = await readTextFile(absolutePath);
          const truncated = Buffer.byteLength(raw, 'utf8') > maxFileBytes;
          const content = truncated ? raw.slice(0, maxFileBytes) : raw;
          const lines = content.split(/\r?\n/);
          const startLine = Math.max(args.startLine ?? 1, 1);
          const endLine = Math.min(args.endLine ?? lines.length, lines.length);

          return {
            filePath: toRelativePath(root, absolutePath),
            content: lines.slice(startLine - 1, endLine).join('\n'),
            startLine,
            endLine,
            truncated,
          };
        },
      }),
      defineTool<CodebaseSymbolsArgs, CodebaseSymbolsResult>({
        name: 'codebase.symbols',
        description: 'List indexed symbol declarations (functions, classes, interfaces, types, enums, consts, methods) filtered by name, file, or kind',
        scopes: ['codebase:read'],
        environments: defaultToolEnvironments,
        category: 'codebase',
        tags: ['context', 'codebase', 'read', 'nav'],
        argsSchema: symbolsArgsSchema,
        async handler(args) {
          const root = resolveRoot(rootDir);
          const index = await loadOrBuildSymbolIndex({
            root,
            ignore,
            maxFileBytes,
            cacheFilePath: symbolIndexCachePath(projectDir, root),
          });
          const symbols = Object.values(index.files)
            .flatMap((file) => file.symbols)
            .filter((symbol) =>
              (!args.name || symbol.name.startsWith(args.name)) &&
              (!args.filePath || symbol.filePath === args.filePath) &&
              (!args.kind || symbol.kind === args.kind));

          return {
            rootDir: root,
            symbols: symbols.slice(0, args.maxResults ?? 50),
          };
        },
      }),
      defineTool<CodebaseUsagesArgs, CodebaseUsagesResult>({
        name: 'codebase.usages',
        description: 'Find references of a symbol across the codebase, separated from its declaration sites',
        scopes: ['codebase:read'],
        environments: defaultToolEnvironments,
        category: 'codebase',
        tags: ['context', 'codebase', 'read', 'nav'],
        argsSchema: usagesArgsSchema,
        async handler(args) {
          const root = resolveRoot(rootDir);
          const symbol = typeof args.symbol === 'string' ? args.symbol.trim() : '';

          if (!symbol) {
            throw new Error('codebase.usages requires a non-empty symbol');
          }

          const index = await loadOrBuildSymbolIndex({
            root,
            ignore,
            maxFileBytes,
            cacheFilePath: symbolIndexCachePath(projectDir, root),
          });
          const definitions = Object.values(index.files)
            .flatMap((file) => file.symbols)
            .filter((entry) => entry.name === symbol);
          const usages = await findSymbolUsages(root, ignore, maxFileBytes, definitions, symbol, args.maxResults ?? 30);

          return {
            rootDir: root,
            symbol,
            definitions,
            usages,
          };
        },
      }),
      defineTool<CodebaseDepsArgs, CodebaseDepsResult>({
        name: 'codebase.deps',
        description: 'Import graph for a source file: what it imports and which files import it',
        scopes: ['codebase:read'],
        environments: defaultToolEnvironments,
        category: 'codebase',
        tags: ['context', 'codebase', 'read', 'nav'],
        argsSchema: depsArgsSchema,
        async handler(args) {
          const root = resolveRoot(rootDir);
          const index = await loadOrBuildSymbolIndex({
            root,
            ignore,
            maxFileBytes,
            cacheFilePath: symbolIndexCachePath(projectDir, root),
          });
          const entry = index.files[args.filePath];

          if (!entry) {
            throw new Error(`File is not in the symbol index (not found or not a TS/JS source file): ${args.filePath}`);
          }

          return {
            rootDir: root,
            filePath: args.filePath,
            imports: entry.imports,
            importedBy: findImporters(index, args.filePath),
          };
        },
      }),
      defineTool<CodebaseContextArgs, CodebaseContextResult>({
        name: 'codebase.context',
        description: 'Assemble LLM-ready context for a symbol: its definition bodies under a byte budget plus usage previews',
        scopes: ['codebase:read'],
        environments: defaultToolEnvironments,
        category: 'codebase',
        tags: ['context', 'codebase', 'read', 'nav'],
        argsSchema: contextArgsSchema,
        async handler(args) {
          const root = resolveRoot(rootDir);
          const symbol = typeof args.symbol === 'string' ? args.symbol.trim() : '';

          if (!symbol) {
            throw new Error('codebase.context requires a non-empty symbol');
          }

          const index = await loadOrBuildSymbolIndex({
            root,
            ignore,
            maxFileBytes,
            cacheFilePath: symbolIndexCachePath(projectDir, root),
          });
          const entries = Object.values(index.files)
            .flatMap((file) => file.symbols)
            .filter((entry) => entry.name === symbol);
          let remaining = args.maxBytes ?? 8000;
          const definitions: CodebaseContextDefinition[] = [];

          for (const entry of entries) {
            const raw = await readTextFile(resolveSafePath(root, entry.filePath));
            const body = raw.split(/\r?\n/).slice(entry.startLine - 1, entry.endLine).join('\n');
            const truncated = Buffer.byteLength(body, 'utf8') > remaining;
            const content = truncated ? body.slice(0, remaining) : body;
            remaining = Math.max(0, remaining - Buffer.byteLength(content, 'utf8'));
            definitions.push({ ...entry, content, truncated });
          }

          const usages = await findSymbolUsages(root, ignore, maxFileBytes, entries, symbol, 10);

          return {
            rootDir: root,
            symbol,
            definitions,
            usages,
          };
        },
      }),
    ],
  });
}

async function findSymbolUsages(
  root: string,
  ignore: string[],
  maxFileBytes: number,
  definitions: CodebaseSymbolEntry[],
  symbol: string,
  maxResults: number,
): Promise<CodebaseSearchMatch[]> {
  // Identifier boundary that works identically in ripgrep (no lookaround
  // support) and the JS fallback; \b misses identifiers that start or
  // end with $.
  const pattern = `(^|[^A-Za-z0-9_$])${escapeRegExp(symbol)}([^A-Za-z0-9_$]|$)`;
  const hits = await ripgrepSearch(root, ignore, maxFileBytes, pattern, maxResults + definitions.length + 5);

  return hits
    .filter((hit) => !definitions.some((entry) => entry.filePath === hit.filePath && entry.startLine === hit.line))
    .slice(0, maxResults);
}

function defaultRoot(projectDir: string | undefined): string {
  return projectDir && path.basename(projectDir) === 'fdekit' ? '..' : '.';
}
