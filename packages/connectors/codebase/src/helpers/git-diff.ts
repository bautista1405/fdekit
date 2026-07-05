import { execFile } from 'child_process';
import { promisify } from 'util';
import type { CodebaseDiffFile, CodebaseDiffHunk, CodebaseDiffStatus } from '../interfaces/index.js';

const run = promisify(execFile);

export async function gitDiff(
  root: string,
  base: string,
  head: string,
  maxPatchBytes: number,
): Promise<CodebaseDiffFile[]> {
  await assertGitWorkTree(root);

  try {
    // --relative scopes paths (and results) to the codebase root even when it
    // is a subdirectory of the repository; base...head is merge-base semantics,
    // matching what a pull request shows.
    const { stdout } = await run(
      'git',
      ['diff', '-M', '--unified=3', '--relative', `${base}...${head}`],
      { cwd: root, maxBuffer: 50 * 1024 * 1024 },
    );

    return parseUnifiedDiff(stdout, maxPatchBytes);
  } catch (err) {
    const failure = err as { stderr?: string };
    const detail = failure.stderr?.trim() || (err instanceof Error ? err.message : String(err));

    throw new Error(`git diff failed: ${detail}`);
  }
}

async function assertGitWorkTree(root: string): Promise<void> {
  try {
    await run('git', ['rev-parse', '--is-inside-work-tree'], { cwd: root });
  } catch {
    throw new Error(`Codebase root is not inside a git work tree: ${root}`);
  }
}

export function parseUnifiedDiff(raw: string, maxPatchBytes: number): CodebaseDiffFile[] {
  return raw
    .split(/^diff --git /m)
    .slice(1)
    .map((chunk) => parseFileChunk(chunk, maxPatchBytes));
}

function parseFileChunk(chunk: string, maxPatchBytes: number): CodebaseDiffFile {
  const lines = chunk.split('\n');
  const headerPaths = /^a\/(.*) b\/(.*)$/.exec(lines[0] ?? '');
  let status: CodebaseDiffStatus = 'modified';
  let previousPath: string | undefined;
  let renamedTo = '';
  let oldPath = '';
  let newPath = '';
  let binary = false;
  const hunks: CodebaseDiffHunk[] = [];
  let current: CodebaseDiffHunk | null = null;
  let additions = 0;
  let deletions = 0;
  let patchBytes = 0;
  let patchTruncated = false;

  for (const line of lines.slice(1)) {
    const hunkHeader = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);

    if (hunkHeader) {
      current = {
        header: line,
        newStart: Number(hunkHeader[1]),
        newLines: hunkHeader[2] === undefined ? 1 : Number(hunkHeader[2]),
        patch: '',
      };
      hunks.push(current);
      continue;
    }

    if (!current) {
      if (line.startsWith('new file mode')) {
        status = 'added';
      } else if (line.startsWith('deleted file mode')) {
        status = 'deleted';
      } else if (line.startsWith('rename from ')) {
        previousPath = line.slice('rename from '.length);
      } else if (line.startsWith('rename to ')) {
        status = 'renamed';
        renamedTo = line.slice('rename to '.length);
      } else if (line.startsWith('--- a/')) {
        oldPath = line.slice('--- a/'.length);
      } else if (line.startsWith('+++ b/')) {
        newPath = line.slice('+++ b/'.length);
      } else if (line.startsWith('Binary files ') || line.startsWith('GIT binary patch')) {
        binary = true;
      }

      continue;
    }

    if (line.startsWith('+') && !line.startsWith('+++')) {
      additions += 1;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      deletions += 1;
    }

    if (patchTruncated) {
      continue;
    }

    const lineBytes = Buffer.byteLength(line, 'utf8') + 1;

    if (patchBytes + lineBytes > maxPatchBytes) {
      patchTruncated = true;
      continue;
    }

    patchBytes += lineBytes;
    current.patch += `${line}\n`;
  }

  const filePath = renamedTo
    || (status === 'deleted' ? oldPath : '')
    || newPath
    || (status === 'deleted' ? headerPaths?.[1] : headerPaths?.[2])
    || '';

  return {
    filePath,
    previousPath,
    status,
    additions,
    deletions,
    binary,
    patchTruncated,
    hunks,
  };
}
