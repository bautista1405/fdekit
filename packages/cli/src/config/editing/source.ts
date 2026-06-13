import ts from 'typescript';

export interface ContainerRange {
  open: number;
  close: number;
  closeIndent: string;
}

export function parseConfig(config: string): ts.SourceFile {
  return ts.createSourceFile('fde.config.ts', config, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

export function containerRange(
  config: string,
  sourceFile: ts.SourceFile,
  container: ts.ObjectLiteralExpression | ts.ArrayLiteralExpression,
): ContainerRange {
  const open = container.getStart(sourceFile);
  const close = container.getEnd() - 1;

  return {
    open,
    close,
    closeIndent: lineIndentAt(config, close),
  };
}

export function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;

  while (
    ts.isParenthesizedExpression(current)
    || ts.isAsExpression(current)
    || ts.isSatisfiesExpression(current)
    || ts.isTypeAssertionExpression(current)
    || ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }

  return current;
}

export function insertText(source: string, position: number, text: string): string {
  return `${source.slice(0, position)}${text}${source.slice(position)}`;
}

export function replaceRange(source: string, start: number, end: number, replacement: string): string {
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

export function lineIndentAt(source: string, position: number): string {
  const lineStart = source.lastIndexOf('\n', Math.max(0, position - 1)) + 1;
  const line = source.slice(lineStart, position);
  const match = /^\s*/.exec(line);

  return match?.[0] ?? '';
}
