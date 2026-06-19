import {
  connectorManifests,
  connectorNames,
  providerManifests,
  providerNames,
  recipeManifests,
  recipeNames,
} from './index.js';
import type { CatalogScaffoldAlias, ConnectorManifest, ProviderManifest } from './types.js';

const commandUsages = {
  init: 'fdekit init [name]',
  add: 'fdekit add <provider|connector|eval|policy> <name> [--custom]',
  approvals: 'fdekit approvals [list|approve <id>|reject <id>] [--by <actor>] [--reason <text>]',
  audit: 'fdekit audit [--limit <n>]',
  console: 'fdekit console',
  dev: 'fdekit dev',
  diff: 'fdekit diff [--from <snapshot-or-config>] [--to <snapshot-or-config>] [--json]',
  doctor: 'fdekit doctor [--live]',
  env: 'fdekit env <start|seed|doctor|stop|describe>',
  trace: 'fdekit trace',
  validate: 'fdekit validate [--json] [--strict]',
  eval: 'fdekit eval <run|macro> [--min-frequency <n>]',
  feedback: 'fdekit feedback export [--json]',
  report: 'fdekit report',
  run: 'fdekit run <agent> [--ticket <id>] [--input <json-object>] [--max-steps <n>] [--strict]',
  recipe: 'fdekit recipe <install|capture> <name-or-path>',
  version: 'fdekit version',
} as const;

interface CommandSummary {
  usage: string;
  summary: string;
}

export function renderCliHelp(): string {
  return `Usage: fdekit <command> [options]

Commands:
${renderCommandSummaries()}
`;
}

export function renderCommandHelp(command: string): string | undefined {
  const providers = providerNames().join(', ');
  const connectors = connectorNames().join(', ');
  const recipes = recipeNames().join(', ');

  switch (command) {
    case 'init':
      return `Usage: ${commandUsages.init}

Scaffold a new FDEKit deployment in [name], or in ./fdekit when omitted.

Options:
  -h, --help  Show this command help
`;
    case 'add':
      return `Usage: ${commandUsages.add}

Add a provider, connector, eval, or policy helper to the current deployment.

Targets:
  provider   ${providers}
  connector  ${connectors}
  eval       Add a simple eval definition
  policy     Add a policy helper

Options:
  --custom   Allow a project-specific connector stub for an unknown connector name
  -h, --help  Show this command help
`;
    case 'approvals':
      return `Usage: ${commandUsages.approvals}

Review approval requests or record approval decisions.

Options:
  --by <actor>      Record who made an approval decision
  --reason <text>   Record why the decision was made
  -h, --help        Show this command help
`;
    case 'audit':
      return `Usage: ${commandUsages.audit}

Show recent audit log entries.

Options:
  --limit <n>  Number of audit entries to show
  -h, --help   Show this command help
`;
    case 'console':
      return `Usage: ${commandUsages.console}

Generate a local HTML dashboard from deployment artifacts.

Options:
  -h, --help  Show this command help
`;
    case 'dev':
      return `Usage: ${commandUsages.dev}

Load the deployment and write a local trace.

Options:
  -h, --help  Show this command help
`;
    case 'diff':
      return `Usage: ${commandUsages.diff}

Compare deployment snapshots or config files.

Options:
  --from <snapshot-or-config>  Compare from this snapshot or config
  --to <snapshot-or-config>    Compare to this snapshot or config
  --json                       Print the diff as JSON
  -h, --help                   Show this command help
`;
    case 'doctor':
      return `Usage: ${commandUsages.doctor}

Check deployment environment setup.

Options:
  --live      Run connector health checks
  -h, --help  Show this command help
`;
    case 'env':
      return `Usage: ${commandUsages.env}

Manage a configured runtime environment.

Actions:
  start     Start configured services
  seed      Seed local data
  doctor    Check environment health
  stop      Stop configured services
  describe  Print environment details

Options:
  -h, --help  Show this command help
`;
    case 'trace':
      return `Usage: ${commandUsages.trace}

Generate a local HTML trace viewer.

Options:
  -h, --help  Show this command help
`;
    case 'validate':
      return `Usage: ${commandUsages.validate}

Validate config and write a deployment snapshot.

Options:
  --json      Print validation output as JSON
  --strict    Treat warnings as validation failures
  -h, --help  Show this command help
`;
    case 'eval':
      return `Usage: ${commandUsages.eval}

Run configured evals or discover recurring behavior patterns across traces.

Subcommands:
  run                         Run configured lower-level evals
  macro [--min-frequency <n>] Discover recurring behavior patterns

Options:
  -h, --help  Show this command help
`;
    case 'feedback':
      return `Usage: ${commandUsages.feedback}

Export decided approvals into replay-ready eval cases using their original run inputs.

Options:
  --json      Print export metadata as JSON
  -h, --help  Show this command help
`;
    case 'report':
      return `Usage: ${commandUsages.report}

Generate a deployment report.

Options:
  -h, --help  Show this command help
`;
    case 'run':
      return `Usage: ${commandUsages.run}

Run an agent loop and write a trace.

Options:
  --ticket <id>           Pass a support ticket id as input.ticketId
  --input <json-object>   Merge a JSON object into the agent input
  --max-steps <n>         Limit the number of agent loop steps
  --strict                Run with strict policy enforcement
  -h, --help              Show this command help
`;
    case 'recipe':
      return `Usage: ${commandUsages.recipe}

Install a built-in recipe or capture the current deployment as a reusable local recipe.

Subcommands:
  install <name-or-path>       Install a recipe: ${recipes}
  capture <name> [--force]     Capture the current deployment as a recipe

Options:
  --force     Replace an existing captured recipe
  -h, --help  Show this command help
`;
    case 'version':
    case '--version':
    case '-v':
      return `Usage: ${commandUsages.version}

Print the CLI version.

Aliases:
  fdekit --version
  fdekit -v

Options:
  -h, --help  Show this command help
`;
    default:
      return undefined;
  }
}

function renderCommandSummaries(): string {
  const summaries: CommandSummary[] = [
    { usage: commandUsages.init, summary: 'Scaffold a new FDEKit deployment' },
    { usage: commandUsages.add, summary: 'Add a provider, connector, eval, or policy helper' },
    { usage: commandUsages.recipe, summary: 'Install or capture reusable recipes' },
    { usage: commandUsages.approvals, summary: 'Review or decide approval requests' },
    { usage: commandUsages.audit, summary: 'Show recent audit log entries' },
    { usage: commandUsages.console, summary: 'Generate a local HTML dashboard' },
    { usage: commandUsages.dev, summary: 'Load the deployment and write a local trace' },
    { usage: commandUsages.diff, summary: 'Compare deployment snapshots/configs' },
    { usage: commandUsages.doctor, summary: 'Check env setup; --live runs connector health checks' },
    { usage: commandUsages.env, summary: 'Manage a configured runtime environment' },
    { usage: commandUsages.trace, summary: 'Generate a local HTML trace viewer' },
    { usage: commandUsages.validate, summary: 'Validate config and write a deployment snapshot' },
    { usage: commandUsages.eval, summary: 'Run evals or discover recurring behavior patterns' },
    { usage: commandUsages.feedback, summary: 'Export approval/audit feedback into eval candidates' },
    { usage: commandUsages.report, summary: 'Generate a deployment report' },
    { usage: commandUsages.run, summary: 'Run an agent loop and write a trace' },
    { usage: commandUsages.version, summary: 'Print the CLI version' },
  ];

  return summaries.map(renderCommandSummary).join('\n');
}

function renderCommandSummary(command: CommandSummary): string {
  const label = command.usage.replace(/^fdekit\s+/, '');
  const columnWidth = 38;

  if (label.length <= columnWidth) {
    return `  ${label.padEnd(columnWidth)} ${command.summary}`;
  }

  return `  ${label}\n  ${''.padEnd(columnWidth)} ${command.summary}`;
}

export function renderProviderSupportRows(): string {
  return providerManifests.map((manifest) => [
    manifest.displayName,
    `${code(manifest.packageName)} / ${code(manifest.configFactory)}`,
    manifest.maturity,
    escapeCell(manifest.supportNote),
  ]).map(renderTableRow).join('\n');
}

export function renderProviderSupportTable(): string {
  return renderTable(
    ['Provider', 'Package / config', 'Maturity', 'Notes'],
    renderProviderSupportRows(),
  );
}

export function renderConnectorSupportRows(): string {
  return connectorManifests.map((manifest) => [
    manifest.displayName,
    code(manifest.packageName),
    manifest.maturity,
    escapeCell(manifest.supportNote),
  ]).map(renderTableRow).join('\n');
}

export function renderConnectorSupportTable(): string {
  return renderTable(
    ['Connector', 'Package / config', 'Maturity', 'Notes'],
    renderConnectorSupportRows(),
  );
}

export function renderProviderPackageRows(): string {
  return providerManifests.map((manifest) => renderTableRow([
    code(manifest.packageName),
    escapeCell(manifest.packagePurpose),
  ])).join('\n');
}

export function renderProviderPackageTable(): string {
  return renderTable(['Package', 'Purpose'], renderProviderPackageRows());
}

export function renderConnectorPackageRows(): string {
  return connectorManifests.map((manifest) => renderTableRow([
    code(manifest.packageName),
    escapeCell(manifest.packagePurpose),
  ])).join('\n');
}

export function renderConnectorPackageTable(): string {
  return renderTable(['Package', 'Purpose'], renderConnectorPackageRows());
}

export function renderRecipeTableRows(): string {
  return recipeManifests.map((manifest) => renderTableRow([
    code(manifest.id),
    escapeCell(manifest.whatItProves),
    escapeCell(manifest.localByDefault),
    escapeCell(manifest.livePath),
  ])).join('\n');
}

export function renderRecipeTable(): string {
  return renderTable(
    ['Recipe', 'What it proves', 'Local by default', 'Live path'],
    renderRecipeTableRows(),
  );
}

export function renderCliReferenceCatalogRows(): string {
  return [
    renderTableRow(['Recipes', formatNames(recipeNames())]),
    renderTableRow(['Providers', formatNamesWithAliases(providerManifests)]),
    renderTableRow(['Connectors', formatNamesWithAliases(connectorManifests)]),
  ].join('\n');
}

export function renderCliReferenceCatalogTable(): string {
  return renderTable(['Surface', 'Built-ins'], renderCliReferenceCatalogRows());
}

function formatNames(names: string[]): string {
  return names.map(code).join(', ');
}

function formatNamesWithAliases(
  manifests: Array<ProviderManifest | ConnectorManifest>,
): string {
  const canonical = formatNames(manifests.map((manifest) => manifest.id));
  const aliases = manifests.flatMap((manifest) => aliasNames(manifest.aliases));

  return aliases.length > 0
    ? `${canonical}; aliases: ${formatNames(aliases)}`
    : canonical;
}

function aliasNames(aliases: CatalogScaffoldAlias[] | undefined): string[] {
  return (aliases ?? []).map((alias) => alias.name);
}

function renderTableRow(cells: string[]): string {
  return `| ${cells.join(' | ')} |`;
}

function renderTable(headers: string[], rows: string): string {
  return [
    renderTableRow(headers),
    renderTableRow(headers.map(() => '---')),
    rows,
  ].join('\n');
}

function code(value: string): string {
  return `\`${value}\``;
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|');
}
