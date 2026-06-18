export interface CliUserErrorOptions {
  usage?: string;
  next?: string[];
}

export class CliUserError extends Error {
  readonly usage?: string;
  readonly next: string[];

  constructor(message: string, options: CliUserErrorOptions = {}) {
    super(message);
    this.name = 'CliUserError';
    this.usage = options.usage;
    this.next = options.next ?? [];
  }
}

export function formatCliError(error: unknown): string {
  if (isConfigNotFoundError(error)) {
    return [
      `Error: ${error.message}`,
      '',
      'Next: run `fdekit init` to create `./fdekit`, or run the command from a project that contains fde.config.ts.',
    ].join('\n');
  }

  if (error instanceof CliUserError) {
    return formatUserError(error);
  }

  if (error instanceof Error) {
    return formatUnexpectedError(error);
  }

  return `Error: ${String(error)}`;
}

export function printCliError(error: unknown): void {
  console.error(formatCliError(error));
}

function formatUserError(error: CliUserError): string {
  const lines = [`Error: ${error.message}`];

  if (error.usage) {
    lines.push('', `Usage: ${error.usage}`);
  }

  if (error.next.length > 0) {
    lines.push('', ...error.next.map((step) => `Next: ${step}`));
  }

  return lines.join('\n');
}

function formatUnexpectedError(error: Error): string {
  return `Error: ${error.message}`;
}

function isConfigNotFoundError(error: unknown): error is Error {
  return error instanceof Error && error.name === 'ConfigNotFoundError';
}
