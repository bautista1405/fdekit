import * as path from 'path';
import { defineConnector, defineTool, type ConnectorDefinition, type ConnectorReadinessCheck } from '@fdekit/core';
import {
  collectFiles,
  readEnvValue,
  readTextFile,
  resolveRoot,
  resolveSafePath,
  statFile,
  toRelativePath,
} from './helpers/index.js';
import { gitDiff } from './helpers/git-diff.js';
import { rankDiffFiles } from './helpers/rank.js';
import { escapeRegExp, resolveRipgrepPath, ripgrepSearch } from './helpers/ripgrep.js';
import { findImporters, loadOrBuildSymbolIndex, probeNavigationRuntime, readSymbolIndexMeta, symbolIndexCachePath } from './helpers/symbol-index.js';
import type { CodebaseConnectorConfig, CodebaseConnectorOptions, CodebaseContextArgs, CodebaseContextDefinition, CodebaseContextResult, CodebaseDepsArgs, CodebaseDepsResult, CodebaseDiffArgs, CodebaseDiffResult, CodebaseFileEntry, CodebaseListFilesArgs, CodebaseRankDiffResult, CodebaseReadFileArgs, CodebaseReadFileResult, CodebaseSearchArgs, CodebaseSearchMatch, CodebaseSymbolEntry, CodebaseSymbolsArgs, CodebaseSymbolsResult, CodebaseUsagesArgs, CodebaseUsagesResult } from './interfaces/index.js';
export type { CodebaseConnectorConfig, CodebaseConnectorOptions, CodebaseContextArgs, CodebaseContextDefinition, CodebaseContextResult, CodebaseDepsArgs, CodebaseDepsResult, CodebaseDiffArgs, CodebaseDiffFile, CodebaseDiffHunk, CodebaseDiffResult, CodebaseDiffStatus, CodebaseFileEntry, CodebaseListFilesArgs, CodebaseRankDiffResult, CodebaseRankedFile, CodebaseReadFileArgs, CodebaseReadFileResult, CodebaseSearchArgs, CodebaseSearchMatch, CodebaseSymbolEntry, CodebaseSymbolKind, CodebaseSymbolsArgs, CodebaseSymbolsResult, CodebaseUsagesArgs, CodebaseUsagesResult } from './interfaces/index.js';
export { createGitRepositoryOperations } from './helpers/change-transaction.js';
export type { GitChangeValidationContext, GitChangeValidator, GitRepositoryOperationsOptions } from './helpers/change-transaction.js';

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

const diffArgsSchema = {
  type: 'object',
  required: ['base'],
  properties: {
    base: {
      type: 'string',
      description: 'Base ref to compare from (for example main)',
    },
    head: {
      type: 'string',
      description: 'Head ref to compare to; defaults to HEAD',
    },
    maxFiles: {
      type: 'number',
      description: 'Maximum number of changed files to return (default 50)',
    },
  },
};

const rankDiffArgsSchema = {
  type: 'object',
  required: ['base'],
  properties: {
    base: {
      type: 'string',
      description: 'Base ref to compare from (for example main)',
    },
    head: {
      type: 'string',
      description: 'Head ref to compare to; defaults to HEAD',
    },
    maxFiles: {
      type: 'number',
      description: 'Maximum number of ranked files to return (default 20)',
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
      defineTool<CodebaseDiffArgs, CodebaseDiffResult>({
        name: 'codebase.diff',
        description: 'Structured git diff between two refs of the codebase: changed files with hunks, line stats, and rename detection',
        scopes: ['codebase:read'],
        environments: defaultToolEnvironments,
        category: 'codebase',
        tags: ['context', 'codebase', 'read', 'review'],
        argsSchema: diffArgsSchema,
        async handler(args) {
          const root = resolveRoot(rootDir);
          const base = typeof args.base === 'string' ? args.base.trim() : '';

          if (!base) {
            throw new Error('codebase.diff requires a non-empty base ref');
          }

          const head = args.head?.trim() || 'HEAD';
          const files = await gitDiff(root, base, head, maxFileBytes);
          const cap = args.maxFiles ?? 50;

          return {
            rootDir: root,
            base,
            head,
            files: files.slice(0, cap),
            truncated: files.length > cap,
          };
        },
      }),
      defineTool<CodebaseDiffArgs, CodebaseRankDiffResult>({
        name: 'codebase.rankDiff',
        description: 'Rank the changed files of a diff by review risk: churn weighted by fan-in from the import graph of the current working tree, with human-readable risk reasons',
        scopes: ['codebase:read'],
        environments: defaultToolEnvironments,
        category: 'codebase',
        tags: ['context', 'codebase', 'read', 'review', 'nav'],
        argsSchema: rankDiffArgsSchema,
        async handler(args) {
          const root = resolveRoot(rootDir);
          const base = typeof args.base === 'string' ? args.base.trim() : '';

          if (!base) {
            throw new Error('codebase.rankDiff requires a non-empty base ref');
          }

          const head = args.head?.trim() || 'HEAD';
          const [files, index] = await Promise.all([
            gitDiff(root, base, head, maxFileBytes),
            loadOrBuildSymbolIndex({
              root,
              ignore,
              maxFileBytes,
              cacheFilePath: symbolIndexCachePath(projectDir, root),
            }),
          ]);
          const ranked = rankDiffFiles(files, index);
          const cap = args.maxFiles ?? 20;

          return {
            rootDir: root,
            base,
            head,
            totalChanged: ranked.length,
            files: ranked.slice(0, cap),
          };
        },
      }),
    ],
    async readiness(): Promise<ConnectorReadinessCheck[]> {
      const checks: ConnectorReadinessCheck[] = [];
      const root = resolveRoot(rootDir);

      const runtimeStartedAt = Date.now();
      try {
        await probeNavigationRuntime();
        checks.push({
          name: 'tree-sitter',
          ok: true,
          latencyMs: Date.now() - runtimeStartedAt,
          message: 'symbol parser and TypeScript/JavaScript grammars loaded',
        });
      } catch (err) {
        checks.push({
          name: 'tree-sitter',
          ok: false,
          latencyMs: Date.now() - runtimeStartedAt,
          message: `symbol navigation unavailable - ${err instanceof Error ? err.message : String(err)}`,
        });
      }

      const rgPath = await resolveRipgrepPath();
      checks.push({
        name: 'ripgrep',
        ok: true,
        message: rgPath
          ? `binary present (${rgPath})`
          : 'binary unavailable - codebase.search and codebase.usages use the built-in JavaScript scanner (slower on large repositories)',
      });

      const cacheFilePath = symbolIndexCachePath(projectDir, root);
      const indexMeta = await readSymbolIndexMeta(cacheFilePath);
      checks.push({
        name: 'symbol-index',
        ok: true,
        message: !cacheFilePath
          ? 'not persisted (run inside an FDEKit project to cache the index); rebuilt in memory per run'
          : indexMeta
            ? `cached ${indexMeta.fileCount} file(s), built ${indexMeta.builtAt}`
            : 'not built yet; created on the first navigation tool call',
      });

      return checks;
    },
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
