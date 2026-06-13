export type CatalogMaturity = 'Ready' | 'Beta' | 'Experimental' | 'Planned';

export interface CatalogImportSpec {
  moduleName: string;
  names: string[];
}

export interface CatalogEnvVar {
  name: string;
  value?: string;
  description: string;
}

export interface AddScaffold {
  key: string;
  expression: string;
  imports?: CatalogImportSpec[];
  dependencies?: Record<string, string>;
  env?: CatalogEnvVar[];
  note?: string;
}

export interface CatalogScaffoldAlias {
  name: string;
  scaffold: AddScaffold;
}

export interface ProviderManifest {
  kind: 'provider';
  id: string;
  displayName: string;
  packageName: string;
  configFactory: string;
  runtimeAdapter: string;
  maturity: CatalogMaturity;
  supportNote: string;
  packagePurpose: string;
  systemDependency: string;
  scaffold?: AddScaffold;
  aliases?: CatalogScaffoldAlias[];
}

export interface ConnectorManifest {
  kind: 'connector';
  id: string;
  displayName: string;
  packageName: string;
  configFactory: string;
  tools: string[];
  maturity: CatalogMaturity;
  supportNote: string;
  packagePurpose: string;
  systemDependency: string;
  scaffold?: AddScaffold;
  aliases?: CatalogScaffoldAlias[];
}

export interface RecipeManifest {
  kind: 'recipe';
  id: string;
  displayName: string;
  whatItProves: string;
  localByDefault: string;
  livePath: string;
}
