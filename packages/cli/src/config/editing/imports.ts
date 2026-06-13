import ts from 'typescript';
import { insertText, parseConfig, replaceRange } from './source.js';

interface ImportSpec {
  key: string;
  name: string;
  text: string;
  isTypeOnly: boolean;
}

export function ensurePackageImports(config: string, moduleName: string, imports: string[]): string {
  const requested = uniqueValueImports(imports);

  if (requested.length === 0) {
    return config;
  }

  const sourceFile = parseConfig(config);
  const existingImport = findNamedImport(sourceFile, moduleName);

  if (!existingImport) {
    return insertNewImport(config, sourceFile, moduleName, requested);
  }

  const namedImports = existingImport.importClause?.namedBindings;

  if (!namedImports || !ts.isNamedImports(namedImports)) {
    return insertNewImport(config, sourceFile, moduleName, requested);
  }

  const existingSpecs = namedImports.elements.map((specifier) => importSpecFromNode(config, sourceFile, specifier));
  const existingKeys = new Set(existingSpecs.map((specifier) => specifier.key));
  const additions = requested
    .filter((name) => !existingKeys.has(valueImportKey(name)))
    .map((name) => importSpecFromName(name));
  const nextImports = [...existingSpecs, ...additions].sort(compareImportSpecs);

  return replaceRange(
    config,
    namedImports.getStart(sourceFile),
    namedImports.getEnd(),
    formatNamedImports(nextImports),
  );
}

function findNamedImport(sourceFile: ts.SourceFile, moduleName: string): ts.ImportDeclaration | null {
  for (const statement of sourceFile.statements) {
    if (
      ts.isImportDeclaration(statement)
      && !statement.importClause?.isTypeOnly
      && moduleSpecifierText(statement) === moduleName
      && statement.importClause?.namedBindings
      && ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      return statement;
    }
  }

  return null;
}

function moduleSpecifierText(statement: ts.ImportDeclaration): string | null {
  const moduleSpecifier = statement.moduleSpecifier;

  if (ts.isStringLiteral(moduleSpecifier) || ts.isNoSubstitutionTemplateLiteral(moduleSpecifier)) {
    return moduleSpecifier.text;
  }

  return null;
}

function importSpecFromNode(
  config: string,
  sourceFile: ts.SourceFile,
  specifier: ts.ImportSpecifier,
): ImportSpec {
  const isTypeOnly = specifier.isTypeOnly;
  const text = config.slice(specifier.getStart(sourceFile), specifier.getEnd()).trim();

  return {
    key: `${isTypeOnly ? 'type' : 'value'}:${specifier.name.text}`,
    name: specifier.name.text,
    text,
    isTypeOnly,
  };
}

function importSpecFromName(name: string): ImportSpec {
  return {
    key: valueImportKey(name),
    name,
    text: name,
    isTypeOnly: false,
  };
}

function valueImportKey(name: string): string {
  return `value:${name}`;
}

function uniqueValueImports(imports: string[]): string[] {
  return [...new Set(imports.map((name) => name.trim()).filter(Boolean))];
}

function compareImportSpecs(left: ImportSpec, right: ImportSpec): number {
  if (left.isTypeOnly !== right.isTypeOnly) {
    return left.isTypeOnly ? 1 : -1;
  }

  return left.name.localeCompare(right.name) || left.text.localeCompare(right.text);
}

function formatNamedImports(imports: ImportSpec[]): string {
  const names = imports.map((importSpec) => importSpec.text);

  return names.length === 1
    ? `{ ${names[0]} }`
    : `{\n  ${names.join(',\n  ')},\n}`;
}

function insertNewImport(
  config: string,
  sourceFile: ts.SourceFile,
  moduleName: string,
  imports: string[],
): string {
  const importDeclaration = `import ${formatNamedImports(imports.map((name) => importSpecFromName(name)).sort(compareImportSpecs))} from '${moduleName}';`;
  const importStatements = sourceFile.statements.filter(ts.isImportDeclaration);
  const lastImport = importStatements.at(-1);

  if (!lastImport) {
    return `${importDeclaration}\n${config}`;
  }

  return insertText(config, lastImport.getEnd(), `\n${importDeclaration}`);
}
