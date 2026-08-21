import { randomUUID } from 'node:crypto';
import type {
  CredentialBroker,
  CredentialLease,
  CredentialLeaseRequest,
  EnvironmentCredentialBrokerOptions,
} from './types.js';

const ENVIRONMENT_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function createEnvironmentCredentialBroker(
  options: EnvironmentCredentialBrokerOptions,
): CredentialBroker {
  const env = options.env ?? process.env;
  const now = options.now ?? (() => new Date());
  const defaultTtlMs = positiveInteger(options.defaultTtlMs ?? 60_000, 'defaultTtlMs');
  const maxTtlMs = positiveInteger(options.maxTtlMs ?? defaultTtlMs, 'maxTtlMs');
  const bindings = validateBindings(options.bindings);

  return {
    async acquire(request: CredentialLeaseRequest): Promise<CredentialLease> {
      const binding = bindings.get(request.credentialRef);
      if (!binding) {
        throw new Error(`Credential reference "${request.credentialRef}" is not configured`);
      }
      if (!request.purpose.trim()) throw new Error('Credential lease purpose is required');

      const requestedTtl = positiveInteger(request.ttlMs ?? defaultTtlMs, 'credential ttlMs');
      const ttlMs = Math.min(requestedTtl, maxTtlMs);
      const issued = now();
      const values: Record<string, string> = {};
      for (const [targetName, sourceName] of binding) {
        const value = env[sourceName];
        if (value === undefined) {
          throw new Error(
            `Credential reference "${request.credentialRef}" requires environment variable "${sourceName}"`,
          );
        }
        values[targetName] = value;
      }

      return new EnvironmentCredentialLease({
        leaseId: randomUUID(),
        credentialRef: request.credentialRef,
        purpose: request.purpose,
        issuedAt: issued.toISOString(),
        expiresAt: new Date(issued.getTime() + ttlMs).toISOString(),
        values,
        now,
      });
    },
  };
}

class EnvironmentCredentialLease implements CredentialLease {
  readonly leaseId: string;
  readonly credentialRef: string;
  readonly purpose: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  #values: Record<string, string>;
  #released = false;
  readonly #now: () => Date;

  constructor(input: {
    leaseId: string;
    credentialRef: string;
    purpose: string;
    issuedAt: string;
    expiresAt: string;
    values: Record<string, string>;
    now: () => Date;
  }) {
    this.leaseId = input.leaseId;
    this.credentialRef = input.credentialRef;
    this.purpose = input.purpose;
    this.issuedAt = input.issuedAt;
    this.expiresAt = input.expiresAt;
    this.#values = { ...input.values };
    this.#now = input.now;
  }

  async materializeEnvironment(): Promise<Record<string, string>> {
    if (this.#released) throw new Error('Credential lease is released');
    if (this.#now().getTime() >= Date.parse(this.expiresAt)) {
      throw new Error('Credential lease is expired');
    }
    return { ...this.#values };
  }

  async release(): Promise<void> {
    this.#released = true;
    this.#values = {};
  }
}

function validateBindings(
  input: EnvironmentCredentialBrokerOptions['bindings'],
): Map<string, Array<[string, string]>> {
  const output = new Map<string, Array<[string, string]>>();
  for (const [credentialRef, environment] of Object.entries(input)) {
    if (!credentialRef.trim()) throw new Error('Credential reference cannot be empty');
    const entries = Object.entries(environment);
    if (entries.length === 0) {
      throw new Error(`Credential reference "${credentialRef}" has no environment bindings`);
    }
    for (const [targetName, sourceName] of entries) {
      if (!ENVIRONMENT_NAME.test(targetName) || !ENVIRONMENT_NAME.test(sourceName)) {
        throw new Error(`Credential reference "${credentialRef}" has an invalid environment binding`);
      }
    }
    output.set(credentialRef, entries);
  }
  return output;
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}
