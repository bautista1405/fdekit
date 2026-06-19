import { promises as fs } from 'fs';
import * as path from 'path';
import { asRecord, escapeRegExp } from '@fdekit/core';
import { requireConfigFile } from '@fdekit/runtime';
import {
  connectorManifest,
  connectorManifests,
  connectorScaffoldNames,
  providerScaffoldNames,
  type ConnectorManifest,
} from '../catalog/index.js';
import type { CommandContext } from '../context.js';
import { connectorScaffold, providerScaffold, type AddScaffold, type EnvExample } from '../config/catalog.js';
import { ensureCoreImports, ensurePackageImports, hasObjectEntry, insertArrayItem, insertObjectEntry } from '../config/edit.js';
import { policyExpressionFor } from '../config/policies.js';
import { CliUserError } from '../errors.js';
import { escapeSingleQuoted, objectKey } from '../utils/strings.js';

const ADD_CONNECTOR_USAGE = 'fdekit add connector <name> [--custom]';
const ADD_PROVIDER_USAGE = 'fdekit add provider <name>';

export async function cmdAdd(ctx: CommandContext): Promise<void> {
  const [subcommand, name] = ctx.args;

  if (!subcommand || !name) {
    console.error('Usage: fdekit add <provider|connector|eval|policy> <name>');
    process.exitCode = 1;
    return;
  }

  const configPath = await requireConfigFile(ctx.cwd);
  const projectDir = path.dirname(configPath);
  let config = await fs.readFile(configPath, 'utf8');

  if (subcommand === 'provider') {
    const scaffold = providerScaffold(name);

    if (!scaffold) {
      throw new CliUserError(`Unknown provider: ${name}`, {
        usage: ADD_PROVIDER_USAGE,
        next: [`Choose one of: ${providerScaffoldNames().join(', ')}.`],
      });
    }

    const key = scaffold.key;

    if (hasObjectEntry(config, 'providers', key)) {
      console.log(`Provider ${key} is already configured`);
    } else {
      config = applyKnownScaffold(config, 'providers', scaffold);
      console.log(`Added provider ${key}`);
      await applyProjectScaffold(projectDir, scaffold);
    }
  } else if (subcommand === 'connector') {
    const custom = ctx.args.includes('--custom');
    const unknownOption = ctx.args.slice(2).find((arg) => arg !== '--custom');

    if (unknownOption) {
      throw new CliUserError(`Unknown connector option: ${unknownOption}`, {
        usage: ADD_CONNECTOR_USAGE,
      });
    }

    const scaffold = connectorScaffold(name);
    const manifest = connectorManifest(name);

    if ((!manifest || !scaffold) && !custom) {
      throw new CliUserError(`Unknown connector: ${name}`, {
        usage: ADD_CONNECTOR_USAGE,
        next: [
          `Choose one of: ${connectorScaffoldNames().join(', ')}.`,
          `For a project-specific connector stub, rerun with: fdekit add connector ${name} --custom`,
        ],
      });
    }

    const key = scaffold?.key ?? name;

    if (hasObjectEntry(config, 'connectors', key)) {
      console.log(`Connector ${key} is already configured`);
    } else {
      if (manifest) {
        const collision = findConnectorToolCollision(config, manifest);

        if (collision) {
          throw new CliUserError(
            `Connector ${manifest.id} would duplicate tool ${collision.toolName} from connector ${collision.existing.id}`,
            {
              usage: ADD_CONNECTOR_USAGE,
              next: connectorCollisionNextSteps(manifest, collision),
            },
          );
        }
      }

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

      console.log(`Added connector ${key}`);
      await applyProjectScaffold(projectDir, scaffold);
    }
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

interface ConnectorToolCollision {
  existing: ConnectorManifest;
  toolName: string;
}

function findConnectorToolCollision(
  config: string,
  manifest: ConnectorManifest,
): ConnectorToolCollision | undefined {
  const targetTools = new Set(manifest.tools);

  for (const existing of configuredKnownConnectorManifests(config)) {
    if (existing.id === manifest.id) {
      continue;
    }

    const toolName = existing.tools.find((tool) => targetTools.has(tool));

    if (toolName) {
      return { existing, toolName };
    }
  }

  return undefined;
}

function configuredKnownConnectorManifests(config: string): ConnectorManifest[] {
  return connectorManifests.filter((manifest) => connectorFactoryIsConfigured(config, manifest));
}

function connectorFactoryIsConfigured(config: string, manifest: ConnectorManifest): boolean {
  if (!manifest.scaffold || !hasObjectEntry(config, 'connectors', manifest.scaffold.key)) {
    return false;
  }

  const key = escapeRegExp(objectKey(manifest.scaffold.key));
  const factory = escapeRegExp(manifest.configFactory.replace(/\(.*$/, ''));

  return new RegExp(`(^|\\n)\\s*${key}\\s*:\\s*${factory}\\s*\\(`).test(config);
}

function connectorCollisionNextSteps(
  manifest: ConnectorManifest,
  collision: ConnectorToolCollision,
): string[] {
  const steps = [
    `Keep only one connector that exposes \`${collision.toolName}\`, or remove connector \`${collision.existing.id}\` before adding \`${manifest.id}\`.`,
  ];

  if (collision.toolName === 'issue.create') {
    steps.push('For issue trackers, prefer one backend at a time, or use a recipe with `FDEKIT_ISSUE_TRACKER=github|jira|linear`.');
  } else if (collision.toolName === 'crm.note.create') {
    steps.push('For CRM notes, prefer one backend at a time, or use the sales recipe with `FDEKIT_CRM=local|hubspot|salesforce`.');
  }

  steps.push('If you need both connectors in one deployment, wrap one in a custom connector with distinct namespaced tool names.');

  return steps;
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
  let dependenciesChanged = false;

  if (scaffold.dependencies && Object.keys(scaffold.dependencies).length > 0) {
    const updated = await upsertPackageDependencies(projectDir, scaffold.dependencies);

    if (updated) {
      changed.push('package.json');
      dependenciesChanged = true;
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

  if (dependenciesChanged) {
    console.log('Next: npm install');
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
