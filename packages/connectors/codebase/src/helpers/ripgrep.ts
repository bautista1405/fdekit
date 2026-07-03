import { execFile } from 'child_process';
import { promisify } from 'util';
import { asRecord, getNumber, getString } from '@fdekit/core';
import type { CodebaseSearchMatch } from '../interfaces/index.js';
import { searchFilesRegex } from './index.js';

const run = promisify(execFile);

let ripgrepPathPromise: Promise<string | null> | null = null;

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function ripgrepSearch(
  root: string,
  ignore: string[],
  maxFileBytes: number,
  pattern: string,
  maxResults: number,
): Promise<CodebaseSearchMatch[]> {
  const rgPath = await resolveRipgrepPath();

  if (!rgPath) {
    return searchFilesRegex(root, ignore, maxFileBytes, compilePattern(pattern), maxResults);
  }

  // The trailing '.' matters: without an explicit path, rg searches stdin when
  // it is not a tty (always the case under execFile) and hangs waiting for input.
  const args = [
    '--json',
    '--hidden',
    '--sort', 'path',
    '--max-count', '5',
    '--max-filesize', String(maxFileBytes),
    ...ignore.flatMap((entry) => ['--glob', `!${entry}`]),
    '--regexp', pattern,
    '.',
  ];

  try {
    const { stdout } = await run(rgPath, args, { cwd: root, maxBuffer: 20 * 1024 * 1024 });

    return parseRipgrepJson(stdout, maxResults);
  } catch (err) {
    const failure = err as { code?: unknown; stdout?: string; stderr?: string };

    if (failure.code === 1) {
      return parseRipgrepJson(failure.stdout ?? '', maxResults);
    }

    if (failure.code === 'ENOENT') {
      return searchFilesRegex(root, ignore, maxFileBytes, compilePattern(pattern), maxResults);
    }

    const detail = failure.stderr?.trim() || (err instanceof Error ? err.message : String(err));

    throw new Error(`ripgrep search failed: ${detail}`);
  }
}

async function resolveRipgrepPath(): Promise<string | null> {
  if (!ripgrepPathPromise) {
    ripgrepPathPromise = importRipgrepPath();
  }

  return ripgrepPathPromise;
}

async function importRipgrepPath(): Promise<string | null> {
  try {
    // Plain dynamic import for the same reason as helpers/symbol-index.ts: the
    // package is ESM, the emitted import() is preserved, and a missing optional
    // peer fails catchably. Missing ripgrep degrades to the JS scanner instead
    // of erroring, so search keeps working without the peer installed.
    const module = asRecord(await import('@vscode/ripgrep'));
    const rgPath = module.rgPath;

    return typeof rgPath === 'string' ? rgPath : null;
  } catch {
    return null;
  }
}

function compilePattern(pattern: string): RegExp {
  try {
    return new RegExp(pattern);
  } catch (err) {
    throw new Error(`Invalid regular expression: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function parseRipgrepJson(stdout: string, maxResults: number): CodebaseSearchMatch[] {
  const matches: CodebaseSearchMatch[] = [];

  for (const line of stdout.split('\n')) {
    if (!line) {
      continue;
    }

    let event: unknown;

    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }

    const record = asRecord(event);

    if (record.type !== 'match') {
      continue;
    }

    const data = asRecord(record.data);
    const filePath = getString(asRecord(data.path).text);
    const lineNumber = getNumber(data.line_number);

    if (!filePath || lineNumber === undefined) {
      continue;
    }

    matches.push({
      filePath: filePath.replace(/^\.\//, ''),
      line: lineNumber,
      preview: (getString(asRecord(data.lines).text) ?? '').trim().slice(0, 300),
    });

    if (matches.length >= maxResults) {
      break;
    }
  }

  return matches;
}
