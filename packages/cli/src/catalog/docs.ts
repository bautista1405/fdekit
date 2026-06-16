import {
  connectorManifests,
  connectorNames,
  providerManifests,
  providerNames,
  recipeManifests,
  recipeNames,
} from './index.js';
import type { CatalogScaffoldAlias, ConnectorManifest, ProviderManifest } from './types.js';

export function renderCliHelp(): string {
  const providers = providerNames().join(', ');
  const connectors = connectorNames().join(', ');
  const recipes = recipeNames().join(', ');

  return `Usage: fdekit <command> [options]

Commands:
  init [name]                         Scaffold a new FDEKit deployment
  add provider <name>                 Add a model provider: ${providers}
  add connector <name>                Add a connector: ${connectors}
  add eval <name>                     Add a simple eval to the current deployment
  add policy <name>                   Add a policy helper to the current deployment
  recipe install <name>               Install a recipe: ${recipes}
  recipe capture <name> [--force]     Capture the current deployment as a reusable local recipe
  approvals [list|approve|reject]     Review or decide approval requests
  audit [--limit <n>]                 Show recent audit log entries
  console                             Generate a local HTML dashboard
  dev                                 Load the deployment and write a local trace
  diff [--from <snapshot>] [--to <config-or-snapshot>]
                                      Compare deployment snapshots/configs
  doctor [--live]                     Check env setup; --live runs connector health checks
  env <start|seed|doctor|stop|describe>
                                      Manage a configured runtime environment
  trace                               Generate a local HTML trace viewer
  validate [--json] [--strict]        Validate config and write a deployment snapshot
  eval run                            Run configured lower-level evals
  eval macro [--min-frequency <n>]    Discover recurring behavior patterns across traces
  feedback export [--json]            Export approval/audit feedback into eval candidates
  report                              Generate a deployment report
  run <agent> [--input <json>] [--strict]
                                      Run an agent loop and write a trace
  version                             Print the CLI version
`;
}

export function renderCommandHelp(command: string): string | undefined {
  const providers = providerNames().join(', ');
  const connectors = connectorNames().join(', ');
  const recipes = recipeNames().join(', ');

  switch (command) {
    case 'init':
      return `Usage: fdekit init [name]

Scaffold a new FDEKit deployment in [name], or in the current directory when omitted.

Options:
  -h, --help  Show this command help
`;
    case 'add':
      return `Usage: fdekit add <provider|connector|eval|policy> <name>

Add a provider, connector, eval, or policy helper to the current deployment.

Targets:
  provider   ${providers}
  connector  ${connectors}
  eval       Add a simple eval definition
  policy     Add a policy helper

Options:
  -h, --help  Show this command help
`;
    case 'approvals':
      return `Usage: fdekit approvals [list|approve <id>|reject <id>] [--by <actor>] [--reason <text>]

Review approval requests or record approval decisions.

Options:
  --by <actor>      Record who made an approval decision
  --reason <text>   Record why the decision was made
  -h, --help        Show this command help
`;
    case 'audit':
      return `Usage: fdekit audit [--limit <n>]

Show recent audit log entries.

Options:
  --limit <n>  Number of audit entries to show
  -h, --help   Show this command help
`;
    case 'console':
      return `Usage: fdekit console

Generate a local HTML dashboard from deployment artifacts.

Options:
  -h, --help  Show this command help
`;
    case 'dev':
      return `Usage: fdekit dev

Load the deployment and write a local trace.

Options:
  -h, --help  Show this command help
`;
    case 'diff':
      return `Usage: fdekit diff [--from <snapshot-or-config>] [--to <snapshot-or-config>] [--json]

Compare deployment snapshots or config files.

Options:
  --from <snapshot-or-config>  Compare from this snapshot or config
  --to <snapshot-or-config>    Compare to this snapshot or config
  --json                       Print the diff as JSON
  -h, --help                   Show this command help
`;
    case 'doctor':
      return `Usage: fdekit doctor [--live]

Check deployment environment setup.

Options:
  --live      Run connector health checks
  -h, --help  Show this command help
`;
    case 'env':
      return `Usage: fdekit env <start|seed|doctor|stop|describe>

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
      return `Usage: fdekit trace

Generate a local HTML trace viewer.

Options:
  -h, --help  Show this command help
`;
    case 'validate':
      return `Usage: fdekit validate [--json] [--strict]

Validate config and write a deployment snapshot.

Options:
  --json      Print validation output as JSON
  --strict    Treat warnings as validation failures
  -h, --help  Show this command help
`;
    case 'eval':
      return `Usage: fdekit eval <run|macro> [--min-frequency <n>]

Run configured evals or discover recurring behavior patterns across traces.

Subcommands:
  run                         Run configured lower-level evals
  macro [--min-frequency <n>] Discover recurring behavior patterns

Options:
  -h, --help  Show this command help
`;
    case 'feedback':
      return `Usage: fdekit feedback export [--json]

Export approval and audit feedback into eval candidates.

Options:
  --json      Print export metadata as JSON
  -h, --help  Show this command help
`;
    case 'report':
      return `Usage: fdekit report

Generate a deployment report.

Options:
  -h, --help  Show this command help
`;
    case 'run':
      return `Usage: fdekit run <agent> [--ticket <id>] [--input <json-object>] [--max-steps <n>] [--strict]

Run an agent loop and write a trace.

Options:
  --ticket <id>           Pass a support ticket id as input.ticketId
  --input <json-object>   Merge a JSON object into the agent input
  --max-steps <n>         Limit the number of agent loop steps
  --strict                Run with strict policy enforcement
  -h, --help              Show this command help
`;
    case 'recipe':
      return `Usage: fdekit recipe <install|capture> <name-or-path>

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
      return `Usage: fdekit version

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
