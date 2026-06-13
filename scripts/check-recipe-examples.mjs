#!/usr/bin/env node
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const writeMode = process.argv.includes('--write');

const recipes = [
  {
    name: 'support-triage',
    exampleDir: 'support-triage',
    deploymentName: 'support-triage-example',
    paths: [
      'fde.config.ts',
      'agents/support-triage.md',
      'evals/support-triage.json',
      'customer-api/server.js',
      'customer-api/data/seed.json',
      'scripts/demo.mjs',
      {
        generated: 'recipes/support-triage/mock-planner.mjs',
        example: 'mock-planner.mjs',
      },
    ],
  },
  {
    name: 'codebase-agent',
    exampleDir: 'codebase-agent',
    deploymentName: 'codebase-agent-example',
    paths: [
      '.env.example',
      'fde.config.ts',
      'agents/codebase-agent.md',
      'evals/codebase-agent.json',
      'scripts/demo.mjs',
      'sample-repo/README.md',
      'sample-repo/package.json',
      'sample-repo/src/billing.ts',
      'sample-repo/src/support.ts',
      {
        generated: 'recipes/codebase-agent/mock-planner.mjs',
        example: 'mock-planner.mjs',
      },
    ],
  },
  {
    name: 'load-test-agent',
    exampleDir: 'load-test-agent',
    deploymentName: 'load-test-agent',
    paths: [
      '.env.example',
      'fde.config.ts',
      'agents/load-test-agent.md',
      'evals/load-test-agent.json',
      'scripts/demo.mjs',
      'customer-api/server.js',
      'load-tests/customer-api-smoke.js',
      {
        generated: 'recipes/load-test-agent/mock-planner.mjs',
        example: 'mock-planner.mjs',
      },
    ],
  },
  {
    name: 'sales-research-agent',
    exampleDir: 'sales-research-agent',
    deploymentName: 'sales-research-agent-example',
    paths: [
      '.env.example',
      'fde.config.ts',
      'agents/sales-research-agent.md',
      'evals/sales-research-agent.json',
      'scripts/demo.mjs',
      'sales-data/prospects.json',
      {
        generated: 'recipes/sales-research-agent/mock-planner.mjs',
        example: 'mock-planner.mjs',
      },
    ],
  },
];

const { builtinRecipes } = await import(pathToFileURL(
  join(rootDir, 'packages', 'cli', 'dist', 'scaffolds', 'recipes', 'index.js'),
).href).catch((error) => {
  throw new Error(`Build the CLI before checking examples: ${error.message}`);
});

const tempRoot = await mkdtemp(join(tmpdir(), 'fdekit-recipe-examples-'));
const changed = [];

try {
  for (const recipe of recipes) {
    const builtinRecipe = builtinRecipes.find((item) => item.name === recipe.name);

    if (!builtinRecipe) {
      throw new Error(`Unknown built-in recipe: ${recipe.name}`);
    }

    const generatedDir = join(tempRoot, recipe.exampleDir);
    await mkdir(generatedDir, { recursive: true });
    await builtinRecipe.install(generatedDir);

    for (const pathSpec of recipe.paths) {
      const paths = resolvePathSpec(pathSpec);
      const generatedPath = join(generatedDir, paths.generated);
      const examplePath = join(rootDir, 'examples', recipe.exampleDir, paths.example);
      const generated = await readFile(generatedPath, 'utf8');
      const expected = materializeExample(paths.example, generated, recipe);
      const example = await readFile(examplePath, 'utf8').catch((error) => {
        if (error?.code === 'ENOENT') {
          return null;
        }

        throw error;
      });

      if (
        example !== null
        && normalize(paths.example, generated) === normalize(paths.example, example)
        && (!writeMode || example === expected)
      ) {
        continue;
      }

      changed.push(`${recipe.exampleDir}/${paths.example}`);

      if (writeMode) {
        await mkdir(dirname(examplePath), { recursive: true });
        await writeFile(examplePath, expected, 'utf8');
      }
    }
  }
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

if (changed.length === 0) {
  console.log('Recipe examples are in sync with scaffold output');
} else if (writeMode) {
  console.log(`Updated ${changed.length} scaffold-owned example file(s):`);
  for (const file of changed) {
    console.log(`- ${file}`);
  }
} else {
  console.error('Recipe examples drifted from scaffold output:');
  for (const file of changed) {
    console.error(`- ${file}`);
  }
  console.error('');
  console.error('Run `npm run build && npm run examples:sync` to refresh the scaffold-owned example files');
  process.exitCode = 1;
}

function materializeExample(relativePath, value, recipe) {
  if (relativePath !== 'fde.config.ts') {
    return value;
  }

  return value
    .replace(
      /from '\.\/recipes\/[^']+\/mock-planner\.mjs';/,
      "from './mock-planner.mjs';",
    )
    .replace(
      /export default defineDeployment\(\{\n  name: '[^']+',/,
      `export default defineDeployment({\n  name: '${recipe.deploymentName}',`,
    );
}

function normalize(relativePath, value) {
  const normalized = value.replace(/\r\n/g, '\n');

  if (relativePath !== 'fde.config.ts') {
    return normalized;
  }

  return normalized
    .replace(
      /from '\.\/recipes\/[^']+\/mock-planner\.mjs';/,
      "from './mock-planner.mjs';",
    )
    .replace(
      /export default defineDeployment\(\{\n  name: '[^']+',/,
      "export default defineDeployment({\n  name: '<example-deployment>',",
    );
}

function resolvePathSpec(pathSpec) {
  return typeof pathSpec === 'string'
    ? { generated: pathSpec, example: pathSpec }
    : pathSpec;
}
