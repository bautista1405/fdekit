import { access, symlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { CliUserError, formatCliError } from '../errors.js';
import { handleCliError, isDirectRun, runCli } from '../index.js';
import { fdekitCliVersion } from '../package-versions.js';
import {
  captureCommand,
  createCliProject,
  mkProjectRoot,
} from './helpers.js';

describe('cli error UX', () => {
  it('formats expected user errors with usage and next steps', () => {
    const output = formatCliError(new CliUserError('Bad input', {
      usage: 'fdekit run <agent>',
      next: ['Pass a JSON object.'],
    }));

    expect(output).toContain('Error: Bad input');
    expect(output).toContain('Usage: fdekit run <agent>');
    expect(output).toContain('Next: Pass a JSON object.');
    expect(output).not.toContain('CliUserError');
  });

  it('formats unexpected errors without exposing stack trace toggles', () => {
    const error = new Error('Provider failed');

    expect(formatCliError(error)).toBe('Error: Provider failed');
    expect(formatCliError(error)).not.toContain('at ');
    expect(formatCliError(error)).not.toContain('FDEKIT_DEBUG');
  });

  it('renders bad run input as actionable CLI stderr', async () => {
    const projectDir = await createCliProject();
    const output = await captureCli(['run', 'supportTriage', '--input', 'not-json'], projectDir);

    expect(output.exitCode).toBe(1);
    expect(output.stderr).toContain('Error: --input must be valid JSON');
    expect(output.stderr).toContain('Usage: fdekit run <agent>');
    expect(output.stderr).toContain('Next: Pass one quoted JSON object');
    expect(output.stderr).not.toContain('SyntaxError');

    const missingValue = await captureCli(['run', 'supportTriage', '--ticket', '--strict'], projectDir);
    expect(missingValue.exitCode).toBe(1);
    expect(missingValue.stderr).toContain('Error: Missing value for --ticket');
    expect(missingValue.stderr).toContain('Usage: fdekit run <agent>');
  });

  it('validates branch flags before loading project config', async () => {
    const cwd = await mkProjectRoot('fdekit-cli-errors-');

    const evalOutput = await captureCli(['eval', 'macro', '--min-frequency', '0'], cwd);
    expect(evalOutput.exitCode).toBe(1);
    expect(evalOutput.stderr).toContain('Error: --min-frequency must be a positive integer');
    expect(evalOutput.stderr).not.toContain('No fde.config.ts');

    const diffOutput = await captureCli(['diff', '--from'], cwd);
    expect(diffOutput.exitCode).toBe(1);
    expect(diffOutput.stderr).toContain('Error: Missing value for --from');
    expect(diffOutput.stderr).not.toContain('No fde.config.ts');
  });

  it('gives a next step when config is missing', async () => {
    const cwd = await mkProjectRoot('fdekit-cli-missing-config-');
    const output = await captureCli(['validate'], cwd);

    expect(output.exitCode).toBe(1);
    expect(output.stderr).toContain('Error: No fde.config.ts found');
    expect(output.stderr).toContain('Next: run `fdekit init <name>`');
  });

  it('suggests the nearest command for unknown commands', async () => {
    const cwd = await mkProjectRoot('fdekit-cli-unknown-command-');
    const output = await captureCli(['rnu'], cwd);

    expect(output.exitCode).toBe(1);
    expect(output.stderr).toContain('Unknown command: rnu');
    expect(output.stderr).toContain('Did you mean `run`?');
    expect(output.stdout).toContain('Usage: fdekit <command> [options]');
  });

  it('shows full command usages in top-level help', async () => {
    const cwd = await mkProjectRoot('fdekit-cli-top-help-');
    const output = await captureCli(['--help'], cwd);

    expect(output.exitCode).toBeUndefined();
    expect(output.stdout).toContain('run <agent> [--ticket <id>] [--input <json-object>] [--max-steps <n>] [--strict]');
    expect(output.stdout).toContain('diff [--from <snapshot-or-config>] [--to <snapshot-or-config>] [--json]');
  });

  it('prints command help before positional parsing', async () => {
    const cwd = await mkProjectRoot('fdekit-cli-help-');

    const initHelp = await captureCli(['init', '--help'], cwd);
    expect(initHelp.exitCode).toBeUndefined();
    expect(initHelp.stdout).toContain('Usage: fdekit init [name]');
    expect(initHelp.stdout).toContain('Scaffold a new FDEKit deployment');
    expect(initHelp.stderr).toBe('');
    await expect(access(path.join(cwd, '--help'))).rejects.toMatchObject({ code: 'ENOENT' });

    const runHelp = await captureCli(['run', '--help'], cwd);
    expect(runHelp.exitCode).toBeUndefined();
    expect(runHelp.stdout).toContain('Usage: fdekit run <agent>');
    expect(runHelp.stdout).toContain('--ticket <id>');
    expect(runHelp.stdout).toContain('--max-steps <n>');
    expect(runHelp.stderr).not.toContain('No fde.config.ts');
  });

  it('rejects option-looking init project names', async () => {
    const cwd = await mkProjectRoot('fdekit-cli-init-option-');
    const output = await captureCli(['init', '--not-a-project'], cwd);

    expect(output.exitCode).toBe(1);
    expect(output.stderr).toContain('Error: Project name cannot start with "-": --not-a-project');
    expect(output.stderr).toContain('Usage: fdekit init [name]');
    await expect(access(path.join(cwd, '--not-a-project'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('prints the CLI version from every version alias', async () => {
    const cwd = await mkProjectRoot('fdekit-cli-version-');

    for (const args of [['version'], ['--version'], ['-v']]) {
      const output = await captureCli(args, cwd);

      expect(output.exitCode).toBeUndefined();
      expect(output.stdout).toBe(fdekitCliVersion);
      expect(output.stderr).toBe('');
    }

    const helpOutput = await captureCli(['version', '--help'], cwd);
    expect(helpOutput.exitCode).toBeUndefined();
    expect(helpOutput.stdout).toContain('Usage: fdekit version');
    expect(helpOutput.stdout).toContain('fdekit --version');
  });
});

describe('cli entrypoint detection', () => {
  it('treats npm-style symlinked bin paths as direct CLI runs', async () => {
    const cwd = await mkProjectRoot('fdekit-cli-bin-');
    const sourceEntrypoint = fileURLToPath(new URL('../index.ts', import.meta.url));
    const binEntrypoint = path.join(cwd, 'fdekit');
    const originalArgv = process.argv.slice();

    await symlink(sourceEntrypoint, binEntrypoint, 'file');

    try {
      process.argv[1] = binEntrypoint;

      expect(isDirectRun()).toBe(true);
    } finally {
      process.argv.length = 0;
      process.argv.push(...originalArgv);
    }
  });
});

async function captureCli(args: string[], cwd: string): Promise<{
  stdout: string;
  stderr: string;
  exitCode: string | number | undefined;
}> {
  return captureCommand(async () => {
    try {
      await runCli(args, cwd);
    } catch (err) {
      handleCliError(err);
    }
  });
}
