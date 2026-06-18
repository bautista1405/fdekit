import * as path from 'path';
import { defineConnector, defineTool, type ConnectorDefinition } from '@fdekit/core';
import {
  collectFiles,
  readEnvValue,
  readTextFile,
  resolveRoot,
  resolveSafePath,
  searchFiles,
  statFile,
  toRelativePath,
} from './helpers/index.js';
import type { CodebaseConnectorConfig, CodebaseConnectorOptions, CodebaseFileEntry, CodebaseListFilesArgs, CodebaseReadFileArgs, CodebaseReadFileResult, CodebaseSearchArgs, CodebaseSearchMatch } from './interfaces/index.js';
export type { CodebaseConnectorConfig, CodebaseConnectorOptions, CodebaseFileEntry, CodebaseListFilesArgs, CodebaseReadFileArgs, CodebaseReadFileResult, CodebaseSearchArgs, CodebaseSearchMatch } from './interfaces/index.js';

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
      description: 'Text to search for, for example the input query',
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
        description: 'Search text files under the configured codebase root',
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

          const matches = await searchFiles(root, ignore, maxFileBytes, query, args.maxResults ?? 20);

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
    ],
  });
}

function defaultRoot(projectDir: string | undefined): string {
  return projectDir && path.basename(projectDir) === 'fdekit' ? '..' : '.';
}
