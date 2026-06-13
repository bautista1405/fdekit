import ts from 'typescript';
import { indentBlock } from '../../utils/strings.js';
import {
  containerRange,
  insertText,
  lineIndentAt,
  parseConfig,
  unwrapExpression,
} from './source.js';

export function insertObjectEntry(
  config: string,
  property: string,
  entry: string,
  beforeProperty?: string,
): string {
  const sourceFile = parseConfig(config);
  const container = findDeploymentContainer(sourceFile, property, ts.isObjectLiteralExpression);

  if (container) {
    return insertIntoContainer(config, containerRange(config, sourceFile, container), entry);
  }

  if (hasDeploymentProperty(sourceFile, property)) {
    return config;
  }

  return insertTopLevelProperty(config, sourceFile, property, formatContainerValue('{', '}', entry), beforeProperty);
}

export function insertArrayItem(config: string, property: string, item: string): string {
  const sourceFile = parseConfig(config);
  const container = findDeploymentContainer(sourceFile, property, ts.isArrayLiteralExpression);

  if (container) {
    return insertIntoContainer(config, containerRange(config, sourceFile, container), item);
  }

  if (hasDeploymentProperty(sourceFile, property)) {
    return config;
  }

  return insertTopLevelProperty(config, sourceFile, property, formatContainerValue('[', ']', item), 'agents');
}

function insertIntoContainer(
  config: string,
  range: { open: number; close: number; closeIndent: string },
  item: string,
): string {
  const inside = config.slice(range.open + 1, range.close);
  const itemIndent = `${range.closeIndent}  `;
  const formattedItem = indentBlock(item, itemIndent);

  if (inside.trim().length === 0) {
    return `${config.slice(0, range.open + 1)}\n${formattedItem},\n${range.closeIndent}${config.slice(range.close)}`;
  }

  const comma = inside.trimEnd().endsWith(',') ? '' : ',';
  return `${config.slice(0, range.close).trimEnd()}${comma}\n${formattedItem},\n${range.closeIndent}${config.slice(range.close)}`;
}

function insertTopLevelProperty(
  config: string,
  sourceFile: ts.SourceFile,
  property: string,
  value: string,
  beforeProperty = 'agents',
): string {
  const deployment = findDeploymentObject(sourceFile);

  if (!deployment) {
    return config;
  }

  const before = findObjectElement(deployment, beforeProperty);
  const propertyIndent = before
    ? lineIndentAt(config, before.getStart(sourceFile))
    : inferredPropertyIndent(config, sourceFile, deployment);
  const formatted = indentBlock(`${property}: ${value},`, propertyIndent);

  if (before) {
    return insertText(config, before.getStart(sourceFile), `${formatted}\n`);
  }

  const range = containerRange(config, sourceFile, deployment);
  const inside = config.slice(range.open + 1, range.close);

  if (inside.trim().length === 0) {
    return `${config.slice(0, range.open + 1)}\n${formatted}\n${range.closeIndent}${config.slice(range.close)}`;
  }

  const comma = inside.trimEnd().endsWith(',') ? '' : ',';
  return `${config.slice(0, range.close).trimEnd()}${comma}\n${formatted}\n${range.closeIndent}${config.slice(range.close)}`;
}

function formatContainerValue(open: '{' | '[', close: '}' | ']', item: string): string {
  return `${open}\n${indentBlock(`${item},`, '  ')}\n${close}`;
}

function findDeploymentContainer<T extends ts.ObjectLiteralExpression | ts.ArrayLiteralExpression>(
  sourceFile: ts.SourceFile,
  property: string,
  isContainer: (node: ts.Node) => node is T,
): T | null {
  const deployment = findDeploymentObject(sourceFile);
  const element = deployment ? findObjectElement(deployment, property) : null;
  const initializer = element ? initializerForElement(sourceFile, element) : null;

  return initializer && isContainer(initializer) ? initializer : null;
}

function hasDeploymentProperty(sourceFile: ts.SourceFile, property: string): boolean {
  const deployment = findDeploymentObject(sourceFile);
  return deployment ? findObjectElement(deployment, property) !== null : false;
}

function initializerForElement(
  sourceFile: ts.SourceFile,
  element: ts.ObjectLiteralElementLike,
): ts.Expression | null {
  if (ts.isPropertyAssignment(element)) {
    const initializer = unwrapExpression(element.initializer);

    if (ts.isIdentifier(initializer)) {
      return findTopLevelVariableInitializer(sourceFile, initializer.text);
    }

    return initializer;
  }

  if (ts.isShorthandPropertyAssignment(element)) {
    return findTopLevelVariableInitializer(sourceFile, element.name.text);
  }

  return null;
}

function findTopLevelVariableInitializer(sourceFile: ts.SourceFile, name: string): ts.Expression | null {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name)
        && declaration.name.text === name
        && declaration.initializer
      ) {
        return unwrapExpression(declaration.initializer);
      }
    }
  }

  return null;
}

function findDeploymentObject(sourceFile: ts.SourceFile): ts.ObjectLiteralExpression | null {
  let deployment: ts.ObjectLiteralExpression | null = null;

  const visit = (node: ts.Node): void => {
    if (deployment) {
      return;
    }

    if (
      ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === 'defineDeployment'
      && node.arguments.length > 0
    ) {
      const firstArgument = unwrapExpression(node.arguments[0]);

      if (ts.isObjectLiteralExpression(firstArgument)) {
        deployment = firstArgument;
        return;
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return deployment;
}

function findObjectElement(
  objectLiteral: ts.ObjectLiteralExpression,
  property: string,
): ts.ObjectLiteralElementLike | null {
  for (const element of objectLiteral.properties) {
    if (elementName(element) === property) {
      return element;
    }
  }

  return null;
}

function elementName(element: ts.ObjectLiteralElementLike): string | null {
  if (ts.isPropertyAssignment(element) || ts.isMethodDeclaration(element)) {
    return propertyNameText(element.name);
  }

  if (ts.isShorthandPropertyAssignment(element)) {
    return element.name.text;
  }

  return null;
}

function propertyNameText(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  return null;
}

function inferredPropertyIndent(
  config: string,
  sourceFile: ts.SourceFile,
  deployment: ts.ObjectLiteralExpression,
): string {
  const [firstProperty] = deployment.properties;

  if (firstProperty) {
    return lineIndentAt(config, firstProperty.getStart(sourceFile));
  }

  return `${lineIndentAt(config, deployment.getStart(sourceFile))}  `;
}
