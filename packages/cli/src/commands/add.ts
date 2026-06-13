import { promises as fs } from 'fs';
import * as path from 'path';
import { asRecord, escapeRegExp } from '@fdekit/core';
import { requireConfigFile } from '@fdekit/runtime';
import type { CommandContext } from '../context.js';
import { connectorScaffold, providerScaffold, type AddScaffold, type EnvExample } from '../config/catalog.js';
import { ensureCoreImports, ensurePackageImports, insertArrayItem, insertObjectEntry } from '../config/edit.js';
import { policyExpressionFor } from '../config/policies.js';
import { escapeSingleQuoted, objectKey } from '../utils/strings.js';

export async function cmdAdd(ctx: CommandContext): Promise<void> {
  const [subcommand, name] = ctx.args;

  if (!subcommand || !name) {
    console.error('Usage: fdekit add <provider|connector|eval|policy> <name>');
    process.exitCode = 1;
    return;
  }

  const configPath = await requireConfigFile(ctx.cwd);
  let config = await fs.readFile(configPath, 'utf8');

  if (subcommand === 'provider') {
    const scaffold = providerScaffold(name);

    config = scaffold
      ? applyKnownScaffold(config, 'providers', scaffold)
      : insertObjectEntry(config, 'providers', `${objectKey(name)}: { name: '${escapeSingleQuoted(name)}' }`);
    console.log(`Added provider ${name}`);
    await applyProjectScaffold(ctx.cwd, scaffold);
  } else if (subcommand === 'connector') {
    const scaffold = connectorScaffold(name);

    if (scaffold) {
      config = applyKnownScaffold(config, 'connectors', scaffold, 'agents');
    } else {
      config = ensureCoreImports(config, ['defineConnector']);
      config = insertObjectEntry(
        config,
        'connectors',
        `${objectKey(name)}: defineConnector({ name: '${escapeSingleQuoted(name)}' })`,
        'agents',
      );
    }

    console.log(`Added connector ${name}`);
    await applyProjectScaffold(ctx.cwd, scaffold);
  } else if (subcommand === 'eval') {
    config = ensureCoreImports(config, ['defineEval', 'noPolicyViolation']);
    config = insertArrayItem(
      config,
      'evals',
      `defineEval({ name: '${escapeSingleQuoted(name)}', assertions: [noPolicyViolation()] })`,
    );
    console.log(`Added eval ${name}`);
  } else if (subcommand === 'policy') {
    const policyExpression = policyExpressionFor(name);
    config = ensureCoreImports(config, policyExpression.imports);
    config = insertArrayItem(config, 'policies', policyExpression.expression);
    console.log(`Added policy ${name}`);
  } else {
    console.error(`Unknown add target: ${subcommand}`);
    process.exitCode = 1;
    return;
  }

  await fs.writeFile(configPath, config, 'utf8');
}

function applyKnownScaffold(
  config: string,
  property: 'providers' | 'connectors',
  scaffold: AddScaffold,
  beforeProperty?: string,
): string {
  let next = config;

  for (const importSpec of scaffold.imports ?? []) {
    next = ensurePackageImports(next, importSpec.moduleName, importSpec.names);
  }

  return insertObjectEntry(
    next,
    property,
    `${objectKey(scaffold.key)}: ${scaffold.expression}`,
    beforeProperty,
  );
}

async function applyProjectScaffold(projectDir: string, scaffold: AddScaffold | undefined): Promise<void> {
  if (!scaffold) {
    return;
  }

  const changed: string[] = [];

  if (scaffold.dependencies && Object.keys(scaffold.dependencies).length > 0) {
    const updated = await upsertPackageDependencies(projectDir, scaffold.dependencies);

    if (updated) {
      changed.push('package.json');
    }
  }

  if (scaffold.env && scaffold.env.length > 0) {
    const updated = await upsertEnvExample(projectDir, scaffold.env);

    if (updated) {
      changed.push('.env.example');
    }
  }

  if (changed.length > 0) {
    console.log(`Updated ${changed.join(', ')}`);
  }

  if (scaffold.note) {
    console.log(scaffold.note);
  }
}

async function upsertPackageDependencies(projectDir: string, dependencies: Record<string, string>): Promise<boolean> {
  const packagePath = path.join(projectDir, 'package.json');
  let pkg: Record<string, unknown>;

  try {
    pkg = JSON.parse(await fs.readFile(packagePath, 'utf8')) as Record<string, unknown>;
  } catch {
    pkg = {
      name: path.basename(projectDir),
      version: '0.1.0',
      private: true,
    };
  }

  const currentDependencies = asRecord(pkg.dependencies);
  let changed = false;

  for (const [dependency, version] of Object.entries(dependencies)) {
    if (currentDependencies[dependency] !== version) {
      currentDependencies[dependency] = version;
      changed = true;
    }
  }

  if (!changed) {
    return false;
  }

  pkg.dependencies = sortRecord(currentDependencies);
  await fs.writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  return true;
}

async function upsertEnvExample(projectDir: string, entries: EnvExample[]): Promise<boolean> {
  const envPath = path.join(projectDir, '.env.example');
  let contents = '';

  try {
    contents = await fs.readFile(envPath, 'utf8');
  } catch {
    contents = '';
  }

  const additions: string[] = [];

  for (const entry of entries) {
    if (hasEnvEntry(contents, entry.name) || additions.some((line) => line.startsWith(`${entry.name}=`))) {
      continue;
    }

    additions.push(`# ${entry.description}`);
    additions.push(`${entry.name}=${entry.value ?? ''}`);
    additions.push('');
  }

  if (additions.length === 0) {
    return false;
  }

  const next = [
    contents.trimEnd(),
    additions.join('\n').trimEnd(),
    '',
  ].filter(Boolean).join('\n\n');

  await fs.writeFile(envPath, `${next}\n`, 'utf8');
  return true;
}

function hasEnvEntry(contents: string, name: string): boolean {
  return new RegExp(`^${escapeRegExp(name)}=`, 'm').test(contents);
}

function sortRecord(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}
