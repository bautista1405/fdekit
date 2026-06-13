export interface CapturedRecipeManifest {
  schemaVersion: 1;
  name: string;
  version: string;
  capturedAt: string;
  sourceDeployment: string;
  sourceEnvironment?: string;
  workflow?: unknown;
  outcomeMetrics?: unknown;
  dataLayers?: unknown;
  rollout?: unknown;
  harness?: unknown;
  install: {
    files: string[];
  };
  package?: {
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  evidence?: {
    latestEval?: string;
    deploymentReport?: string;
    deploymentSnapshot: string;
  };
}

export interface LocalRecipe {
  dir: string;
  manifest: CapturedRecipeManifest;
}

export interface ProjectPackageJson {
  name?: string;
  version?: string;
  private?: boolean;
  scripts?: Record<string, unknown>;
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
}
