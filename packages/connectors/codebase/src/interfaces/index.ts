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
