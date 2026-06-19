import { existsSync, readFileSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsApiDir = path.join(rootDir, 'docs', 'api');
const valueKinds = new Set(['function', 'class', 'const', 'enum', 'namespace', 'value']);

const publicPackages = [
  {
    packageName: '@fdekit/core',
    slug: 'core',
    packageDir: 'packages/core',
    stability: 'Public, pre-1.0 package-root API',
    audience: 'Deployment authors, connector authors, provider authors, and contributors editing config contracts.',
    notes: [
      'Import from `@fdekit/core`; subpath imports are internal unless the package exports map grows later.',
      'This page is built from the declaration entrypoint and should be refreshed after public exports change.',
    ],
    topSymbols: [
      ['defineDeployment', 'Top-level deployment contract for `fde.config.ts` files.'],
      ['defineAgent', 'Agent authoring helper for provider, instructions, tool, policy, and eval wiring.'],
      ['defineConnector', 'Connector authoring helper for customer systems and bundled connector packages.'],
      ['defineTool', 'Tool authoring helper for handlers, scopes, environments, and args schemas.'],
      ['objectArgs', 'Schema builder for typed object arguments at the runtime edge.'],
      ['stringArg', 'Schema builder for common string inputs inside tool schemas.'],
      ['defineEval', 'Eval suite helper for datasets, assertions, and custom runners.'],
      ['expectedApprovalOutcome', 'Built-in eval assertion for reviewed approval decisions.'],
      ['expectedToolCall', 'Built-in eval assertion for required tool usage.'],
      ['defineGovernance', 'Governance helper for approvals, budgets, scopes, audit, and data protection.'],
      ['providerFromEnv', 'Select the starter provider and optional model from FDEKIT_PROVIDER and FDEKIT_MODEL.'],
      ['defineHarness', 'Harness helper for explicit agent-loop phases and review controls.'],
      ['DeploymentDefinition', 'Top-level type behind deployment configs.'],
      ['AgentConfig', 'Agent definition contract consumed by deployments and runtime execution.'],
      ['ToolDefinition', 'Tool handler contract exposed by connectors.'],
      ['ProviderConfig', 'Provider config contract selected by agents.'],
      ['AgentProvider', 'Provider runtime contract for planning steps.'],
      ['createHttpReq', 'Shared retry, backoff, and circuit-breaker wrapper for HTTP adapters.'],
    ],
  },
  {
    packageName: '@fdekit/runtime',
    slug: 'runtime',
    packageDir: 'packages/runtime',
    stability: 'Public, pre-1.0 runtime API',
    audience: 'CLI maintainers, automation authors, runtime integrators, and contributors working with artifacts or execution.',
    notes: [
      'Import from `@fdekit/runtime` for the full surface, or from exported runtime subpaths such as `@fdekit/runtime/agents`, `@fdekit/runtime/artifacts`, `@fdekit/runtime/config`, `@fdekit/runtime/deployments`, `@fdekit/runtime/evals`, `@fdekit/runtime/governance`, `@fdekit/runtime/macro-evals`, and `@fdekit/runtime/traces` for focused automation.',
      'Some provider runtime contracts are re-exported from `@fdekit/core` so runtime callers can stay on one import surface.',
    ],
    topSymbols: [
      ['loadDeployment', 'Load and transpile `fde.config.ts`, including environment handling.'],
      ['runAgent', 'Execute an agent loop and write runtime evidence.'],
      ['validateDeployment', 'Validate deployment structure and strict-mode metadata.'],
      ['compileDeployment', 'Produce the normalized execution plan used by validation and CLI handoff.'],
      ['createDeploymentSnapshot', 'Normalize a deployment into an auditable snapshot.'],
      ['diffDeploymentSnapshots', 'Compare snapshots and summarize deployment changes.'],
      ['runEvals', 'Run configured eval suites for a deployment.'],
      ['runMacroEvals', 'Find recurring behavior patterns across traces and eval artifacts.'],
      ['requestApproval', 'Create or reuse pending approval artifacts.'],
      ['approveApproval', 'Mark an approval artifact as approved.'],
      ['appendAuditLog', 'Persist an audit-log event through the runtime artifact layer.'],
      ['createArtifactStore', 'Resolve local or configured artifact storage.'],
      ['renderReport', 'Render deployment report Markdown.'],
      ['renderTraceViewer', 'Render a static trace viewer.'],
      ['createMockProvider', 'Credential-free provider adapter for local recipes and tests.'],
      ['AgentRunResult', 'Result contract returned by `runAgent()`.'],
    ],
  },
];

const cliPackage = {
  packageName: '@fdekit/cli',
  slug: 'cli',
  packageDir: 'packages/cli',
  stability: 'Public, pre-1.0 command surface; no stable TypeScript import API',
  audience: 'Deployment authors using the binary, recipe authors, and CLI contributors.',
  notes: [
    'The package root declaration exports no TypeScript symbols; use the `fdekit` binary as the public surface.',
    'Command implementation files are linked so contributors can find where behavior lives quickly.',
  ],
};

const cliCommands = [
  ['fdekit init [name]', 'Scaffold a new FDEKit deployment, defaulting to ./fdekit.', 'packages/cli/src/commands/init.ts'],
  ['fdekit add provider <name>', 'Add a provider config and env docs.', 'packages/cli/src/commands/add.ts'],
  ['fdekit add connector <name> [--custom]', 'Add a catalog connector, or explicitly scaffold a project-specific connector with `--custom`.', 'packages/cli/src/commands/add.ts'],
  ['fdekit add policy <name>', 'Add a policy helper to the current deployment.', 'packages/cli/src/commands/add.ts'],
  ['fdekit add eval <name>', 'Add a simple eval to the current deployment.', 'packages/cli/src/commands/add.ts'],
  ['fdekit recipe install <name>', 'Install a bundled recipe.', 'packages/cli/src/commands/recipe/install.ts'],
  ['fdekit recipe install <path>', 'Install a captured local recipe from a filesystem path.', 'packages/cli/src/commands/recipe/install.ts'],
  ['fdekit recipe capture <name>', 'Capture the current deployment as a reusable local recipe.', 'packages/cli/src/commands/recipe/capture.ts'],
  ['fdekit doctor [--live]', 'Check project readiness and optionally run live connector health checks.', 'packages/cli/src/commands/doctor.ts'],
  ['fdekit validate [--json] [--strict]', 'Validate config and write deployment snapshots plus an execution plan.', 'packages/cli/src/commands/validate.ts'],
  ['fdekit diff [--from <snapshot>] [--to <config-or-snapshot>]', 'Compare deployment snapshots or configs.', 'packages/cli/src/commands/diff.ts'],
  ['fdekit dev', 'Load the deployment and write a local development trace.', 'packages/cli/src/commands/dev.ts'],
  ['fdekit run <agent> [--input <json>] [--strict]', 'Run an agent loop and write a trace.', 'packages/cli/src/commands/run.ts'],
  ['fdekit eval run', 'Run configured lower-level evals.', 'packages/cli/src/commands/eval.ts'],
  ['fdekit eval macro [--min-frequency <n>]', 'Discover recurring behavior patterns across traces.', 'packages/cli/src/commands/eval.ts'],
  ['fdekit approvals list', 'List approval requests.', 'packages/cli/src/commands/approvals.ts'],
  ['fdekit approvals approve <id>', 'Approve a queued approval request.', 'packages/cli/src/commands/approvals.ts'],
  ['fdekit approvals reject <id>', 'Reject a queued approval request.', 'packages/cli/src/commands/approvals.ts'],
  ['fdekit audit [--limit <n>]', 'Show recent audit log entries.', 'packages/cli/src/commands/audit.ts'],
  ['fdekit feedback export [--json]', 'Export decided approvals into replay-ready eval cases.', 'packages/cli/src/commands/feedback.ts'],
  ['fdekit trace', 'Generate a local HTML trace viewer.', 'packages/cli/src/commands/trace.ts'],
  ['fdekit report', 'Generate a deployment report.', 'packages/cli/src/commands/report.ts'],
  ['fdekit console', 'Generate the static dashboard and export artifacts.', 'packages/cli/src/commands/console.ts'],
  ['fdekit env start', 'Run configured environment start commands.', 'packages/cli/src/commands/env.ts'],
  ['fdekit env seed', 'Run configured environment seed commands.', 'packages/cli/src/commands/env.ts'],
  ['fdekit env doctor', 'Run configured environment health checks.', 'packages/cli/src/commands/env.ts'],
  ['fdekit env stop', 'Run configured environment stop commands.', 'packages/cli/src/commands/env.ts'],
  ['fdekit env describe', 'Print configured environment metadata and evidence.', 'packages/cli/src/commands/env.ts'],
  ['fdekit help', 'Print the CLI command map.', 'packages/cli/src/catalog/docs.ts'],
];

await fs.mkdir(docsApiDir, { recursive: true });

const entrypoints = [
  ...publicPackages.map((publicPackage) => dtsEntrypoint(publicPackage)),
  dtsEntrypoint(cliPackage),
];
const program = ts.createProgram(entrypoints, {
  allowJs: false,
  declaration: true,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  noEmit: true,
  skipLibCheck: true,
  target: ts.ScriptTarget.ES2022,
});
const checker = program.getTypeChecker();

for (const publicPackage of publicPackages) {
  const exports = extractPackageExports(publicPackage);
  validateTopSymbols(publicPackage, exports);
  await fs.writeFile(
    path.join(docsApiDir, `${publicPackage.slug}.md`),
    renderPackagePage(publicPackage, exports),
    'utf8',
  );
}

await fs.writeFile(
  path.join(docsApiDir, 'cli.md'),
  renderCliPage(),
  'utf8',
);

function extractPackageExports(publicPackage) {
  const entrypoint = dtsEntrypoint(publicPackage);
  const sourceFile = program.getSourceFile(entrypoint);

  if (!sourceFile) {
    throw new Error(`Missing declaration entrypoint: ${relative(entrypoint)}`);
  }

  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) {
    return [];
  }

  return checker.getExportsOfModule(moduleSymbol)
    .filter((symbol) => symbol.name !== 'default')
    .map((symbol) => exportInfo(symbol))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function exportInfo(symbol) {
  const resolved = symbol.flags & ts.SymbolFlags.Alias
    ? checker.getAliasedSymbol(symbol)
    : symbol;
  const declarations = resolved.getDeclarations() ?? symbol.getDeclarations() ?? [];
  const declaration = declarations[0];

  return {
    name: symbol.name,
    kind: declarationKind(declarations, resolved),
    source: declaration ? sourcePathForDeclaration(declaration) : null,
  };
}

function declarationKind(declarations, symbol) {
  if (declarations.some(ts.isFunctionDeclaration)) return 'function';
  if (declarations.some(ts.isClassDeclaration)) return 'class';
  if (declarations.some(ts.isInterfaceDeclaration)) return 'interface';
  if (declarations.some(ts.isTypeAliasDeclaration)) return 'type';
  if (declarations.some(ts.isEnumDeclaration)) return 'enum';
  if (declarations.some(ts.isVariableDeclaration)) return 'const';
  if (declarations.some(ts.isModuleDeclaration)) return 'namespace';

  if (symbol.flags & ts.SymbolFlags.Function) return 'function';
  if (symbol.flags & ts.SymbolFlags.Class) return 'class';
  if (symbol.flags & ts.SymbolFlags.Interface) return 'interface';
  if (symbol.flags & ts.SymbolFlags.TypeAlias) return 'type';
  if (symbol.flags & ts.SymbolFlags.Enum) return 'enum';
  if (symbol.flags & ts.SymbolFlags.Value) return 'value';

  return 'symbol';
}

function sourcePathForDeclaration(declaration) {
  const dtsPath = declaration.getSourceFile().fileName;
  const mapPath = `${dtsPath}.map`;

  if (existsSync(mapPath)) {
    const map = JSON.parse(readFileSync(mapPath, 'utf8'));
    const [source] = map.sources ?? [];

    if (source) {
      return relative(path.resolve(path.dirname(mapPath), source));
    }
  }

  return relative(dtsPath)
    .replace('/dist/', '/src/')
    .replace(/\.d\.ts$/, '.ts');
}

function renderPackagePage(publicPackage, exports) {
  const version = packageVersion(publicPackage);
  const functionExports = exports.filter((entry) => valueKinds.has(entry.kind));
  const typeExports = exports.filter((entry) => !valueKinds.has(entry.kind));

  return [
    `# ${publicPackage.packageName} API Reference`,
    '',
    maintenanceNote(),
    '',
    `Applies to \`${publicPackage.packageName}\` v${version}.`,
    '',
    `Declaration source: \`${relative(dtsEntrypoint(publicPackage))}\`.`,
    '',
    '## Stability And Audience',
    '',
    '| Stability | Intended audience |',
    '| --- | --- |',
    `| ${escapeCell(publicPackage.stability)} | ${escapeCell(publicPackage.audience)} |`,
    '',
    ...publicPackage.notes.map((note) => `- ${note}`),
    '',
    '## Top Symbols',
    '',
    '| Symbol | Why advanced users reach for it |',
    '| --- | --- |',
    ...publicPackage.topSymbols.map(([symbol, purpose]) => (
      `| [\`${symbol}\`](#${anchor(symbol)}) | ${escapeCell(purpose)} |`
    )),
    '',
    '## Export Count',
    '',
    `This page documents ${exports.length} public root exports from \`${publicPackage.packageName}\`: ${functionExports.length} functions/values and ${typeExports.length} types/interfaces.`,
    '',
    renderExportSection('Functions And Values', functionExports),
    '',
    renderExportSection('Types And Interfaces', typeExports),
    '',
  ].join('\n');
}

function renderExportSection(title, exports) {
  if (exports.length === 0) {
    return [
      `## ${title}`,
      '',
      'No public root exports in this group.',
    ].join('\n');
  }

  return [
    `## ${title}`,
    '',
    '| Symbol | Kind | Defined in |',
    '| --- | --- | --- |',
    ...exports.map((entry) => (
      `| <a id="${anchor(entry.name)}"></a>\`${entry.name}\` | ${entry.kind} | ${sourceLink(entry.source)} |`
    )),
  ].join('\n');
}

function renderCliPage() {
  const version = packageVersion(cliPackage);
  const exports = extractPackageExports(cliPackage);

  return [
    '# fdekit CLI API Reference',
    '',
    maintenanceNote(),
    '',
    `Applies to \`@fdekit/cli\` v${version}. The installed binary remains \`fdekit\`.`,
    '',
    `Declaration source: \`${relative(dtsEntrypoint(cliPackage))}\`; command map source: \`scripts/generate-api-docs.mjs\`.`,
    '',
    '## Stability And Audience',
    '',
    '| Stability | Intended audience |',
    '| --- | --- |',
    `| ${escapeCell(cliPackage.stability)} | ${escapeCell(cliPackage.audience)} |`,
    '',
    ...cliPackage.notes.map((note) => `- ${note}`),
    '',
    '## Top Commands',
    '',
    '| Command | Why advanced users reach for it |',
    '| --- | --- |',
    ...[
      ['fdekit init [name]', 'Start a deployment project with the expected FDEKit shape, defaulting to ./fdekit.'],
      ['fdekit recipe install <name>', 'Bring in a bundled recipe and its docs, evals, and config.'],
      ['fdekit validate [--json] [--strict]', 'Check config readiness and write reviewable deployment artifacts.'],
      ['fdekit diff [--from <snapshot>] [--to <config-or-snapshot>]', 'Review deployment changes before customer handoff.'],
      ['fdekit run <agent> [--input <json>] [--strict]', 'Execute an agent loop with trace and policy evidence.'],
      ['fdekit eval run', 'Run configured eval suites.'],
      ['fdekit eval macro [--min-frequency <n>]', 'Find repeated behavior patterns across traces.'],
      ['fdekit approvals list', 'Inspect pending approval requests.'],
      ['fdekit feedback export [--json]', 'Turn decided approvals into replay-ready eval cases.'],
      ['fdekit console', 'Generate the local dashboard and exports.'],
      ['fdekit env doctor', 'Check configured runtime environment health.'],
    ].map(([command, purpose]) => (
      `| [\`${command}\`](#${anchor(command)}) | ${escapeCell(purpose)} |`
    )),
    '',
    '## TypeScript Exports',
    '',
    exports.length === 0
      ? 'The package root exports 0 TypeScript symbols. The public package surface is the `fdekit` binary.'
      : `The package root exports ${exports.length} TypeScript symbols.`,
    '',
    '## Command Symbols',
    '',
    '| Command | Purpose | Defined in |',
    '| --- | --- | --- |',
    ...cliCommands.map(([command, purpose, source]) => (
      `| <a id="${anchor(command)}"></a>\`${command}\` | ${escapeCell(purpose)} | ${sourceLink(source)} |`
    )),
    '',
  ].join('\n');
}

function validateTopSymbols(publicPackage, exports) {
  const exportNames = new Set(exports.map((entry) => entry.name));
  const missing = publicPackage.topSymbols
    .map(([symbol]) => symbol)
    .filter((symbol) => !exportNames.has(symbol));

  if (missing.length > 0) {
    throw new Error(`Top symbols missing from ${publicPackage.packageName}: ${missing.join(', ')}`);
  }
}

function dtsEntrypoint(publicPackage) {
  return path.join(rootDir, publicPackage.packageDir, 'dist', 'index.d.ts');
}

function packageVersion(publicPackage) {
  const packageJsonPath = path.join(rootDir, publicPackage.packageDir, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

  return packageJson.version;
}

function sourceLink(source) {
  if (!source) {
    return 'Unknown';
  }

  return `[${source}](../../${source})`;
}

function relative(filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, '/');
}

function anchor(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function escapeCell(value) {
  return value.replace(/\|/g, '\\|');
}

function maintenanceNote() {
  return [
    '<!-- Maintained via scripts/generate-api-docs.mjs. -->',
    'Run `npm run docs:api` to refresh this page after changing public exports.',
  ].join('\n');
}
