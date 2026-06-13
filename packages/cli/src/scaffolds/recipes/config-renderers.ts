import * as path from 'path';
import { escapeSingleQuoted } from '../../utils/strings.js';
import type { RecipeContext } from '../registry.js';

export interface PackageImportSpec {
  moduleName: string;
  names: string[];
}

export interface CoreImportBlockSpec {
  core: string[];
  packages?: PackageImportSpec[];
  node?: PackageImportSpec[];
}

export interface EvalSetupSpec {
  toolLimit?: {
    constName: string;
    expression: string;
  };
  policies?: Array<{
    constName: string;
    expression: string;
  }>;
  evalConst: string;
  name: string;
  agent: string;
  dataset: string;
  maxSteps: number;
  assertions: string[];
}

export interface ProviderRuntimeSpec {
  mockModel: string;
  modelTokens?: number;
}

export interface RuntimeSettingSpec {
  name: string;
  type: string;
  expression: string;
}

export function renderConfigTemplate(parts: string[]): string {
  return parts.join('');
}

export function renderImportBlock(spec: CoreImportBlockSpec): string {
  return `${[
    ...(spec.node ?? []).map(renderPackageImport),
    renderPackageImport({
      moduleName: '@fdekit/core',
      names: spec.core,
    }),
    ...(spec.packages ?? []).map(renderPackageImport),
  ].join('')}\n`;
}

export function renderEvalSetup(spec: EvalSetupSpec): string {
  const limits = [
    spec.toolLimit ? `const ${spec.toolLimit.constName} = ${spec.toolLimit.expression};` : '',
    ...(spec.policies ?? []).map((policy) => `const ${policy.constName} = ${policy.expression};`),
  ].filter(Boolean);

  return `${limits.length > 0 ? `${limits.join('\n')}\n` : ''}const ${spec.evalConst} = defineEval({
  name: '${spec.name}',
  agent: '${spec.agent}',
  dataset: '${spec.dataset}',
  maxSteps: ${spec.maxSteps},
  assertions: [
${spec.assertions.map((assertion) => `    ${assertion},`).join('\n')}
  ],
});

`;
}

export function renderProviderChoices(): string {
  return "type ProviderChoice = 'mock' | 'localOllama' | 'openai' | 'anthropic' | 'google';\n";
}

export function renderProviderDefaults(mockModel: string): string {
  return `const defaultModels = {
  mock: '${mockModel}',
  localOllama: 'llama3.1:8b',
  openai: 'gpt-5.5',
  anthropic: 'claude-opus-4-8',
  google: 'gemini-3.5-flash',
} satisfies Record<ProviderChoice, string>;

const provider = pick(process.env.FDEKIT_PROVIDER, ['mock', 'localOllama', 'openai', 'anthropic', 'google'], 'mock');
`;
}

export function renderRuntimeSettings(spec: {
  mockModel: string;
  types?: string[];
  beforeSettings?: string;
  settings: RuntimeSettingSpec[];
  afterSettings?: string;
}): string {
  const typeBlock = spec.types?.length ? `${spec.types.join('\n')}\n\n` : '';
  const settingLines = [
    '  provider,',
    '  model: process.env.FDEKIT_MODEL || defaultModels[provider],',
    ...spec.settings.map((setting) => `  ${setting.name}: ${setting.expression},`),
  ];
  const satisfiesLines = [
    '  provider: ProviderChoice;',
    '  model: string;',
    ...spec.settings.map((setting) => `  ${setting.name}: ${setting.type};`),
  ];

  return `${renderProviderChoices()}${typeBlock}${renderProviderDefaults(spec.mockModel)}${spec.beforeSettings ?? ''}const settings = {
${settingLines.join('\n')}
} satisfies {
${satisfiesLines.join('\n')}
};

${spec.afterSettings ?? ''}`;
}

export function renderDeploymentHeader(projectName: string, suffix: string): string {
  return `export default defineDeployment({
  name: '${escapeSingleQuoted(projectName)}-${suffix}',
  version: '0.1.0',
`;
}

export function renderRecipeMetadata(recipeName: string, steps: string[]): string {
  return `  recipe: {
    name: '${recipeName}',
    version: '0.1.0',
  },
  migrationNotes: [
    {
      from: '0.0.x',
      to: '0.1.0',
      summary: 'Initial ${recipeName} recipe version',
      steps: [
${steps.map((step) => `        '${escapeSingleQuoted(step)}',`).join('\n')}
      ],
    },
  ],
`;
}

export function renderRecipeModulePath(ctx: RecipeContext, fileName: string): string {
  const targetPath = path.join(ctx.recipeDir, fileName);
  const relativePath = path
    .relative(path.dirname(ctx.configPath), targetPath)
    .replace(/\\/g, '/')
    .replace(/\.ts$/, '.js');

  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
}

function renderPackageImport(spec: PackageImportSpec): string {
  return spec.names.length === 1
    ? `import { ${spec.names[0]} } from '${spec.moduleName}';\n`
    : `import {\n  ${spec.names.join(',\n  ')},\n} from '${spec.moduleName}';\n`;
}
