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
`;
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
