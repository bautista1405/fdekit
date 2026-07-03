export interface CodebaseConnectorConfig {
  rootDir: string;
  rootDirEnv: string;
  maxFileBytes: number;
  ignore: string[];
}

export interface CodebaseConnectorOptions {
  rootDir?: string;
  rootDirEnv?: string;
  maxFileBytes?: number;
  ignore?: string[];
  env?: Record<string, string | undefined>;
}

export interface CodebaseListFilesArgs {
  pattern?: string;
  maxFiles?: number;
}

export interface CodebaseSearchArgs {
  query: string;
  maxResults?: number;
}

export interface CodebaseReadFileArgs {
  filePath: string;
  startLine?: number;
  endLine?: number;
}

export interface CodebaseFileEntry {
  filePath: string;
  bytes: number;
}

export interface CodebaseSearchMatch {
  filePath: string;
  line: number;
  preview: string;
}

export interface CodebaseReadFileResult {
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  truncated: boolean;
}

export interface CodebaseSymbolsArgs {
  name?: string;
  filePath?: string;
  kind?: CodebaseSymbolKind;
  maxResults?: number;
}

export interface CodebaseSymbolsResult {
  rootDir: string;
  symbols: CodebaseSymbolEntry[];
}

export interface CodebaseUsagesArgs {
  symbol: string;
  maxResults?: number;
}

export interface CodebaseUsagesResult {
  rootDir: string;
  symbol: string;
  definitions: CodebaseSymbolEntry[];
  usages: CodebaseSearchMatch[];
}

export type CodebaseSymbolKind = 'function' | 'class' | 'interface' | 'type' | 'enum' | 'const' | 'method';

export interface CodebaseSymbolEntry {
  name: string;
  kind: CodebaseSymbolKind;
  filePath: string;
  startLine: number;
  endLine: number;
  exported: boolean;
}

export interface CodebaseSymbolIndexFile {
  mtimeMs: number;
  symbols: CodebaseSymbolEntry[];
  imports: string[];
}

export interface CodebaseSymbolIndex {
  builtAt: string;
  root: string;
  files: Record<string, CodebaseSymbolIndexFile>;
}
