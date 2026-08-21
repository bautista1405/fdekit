# Execution Backends And Credential Leases

`@fdekit/runtime/execution` defines an opt-in boundary between durable runtime
state and disposable command workspaces. It is intentionally separate from
`fde.config.ts`: simple agents do not need an execution backend or credential
broker in their starter deployment.

## Contracts

An `ExecutionBackend` advertises concrete capabilities and acquires a
`WorkspaceLease`. A request can require filesystem, process, or network
isolation. A backend must reject acquisition if it cannot provide a required
control.

Each lease has a fixed expiry, a disposable workspace, command execution, and
idempotent cleanup. `ExecutionCommandResult` records explicit completed,
failed, timed-out, output-limited, or cancelled outcomes. Commands receive no
host environment by default.

`CredentialBroker` resolves a host-only `credentialRef` into a short-lived
`CredentialLease`. Secret values are available only through
`materializeEnvironment()`, are not enumerable on the lease, expire, and are
cleared on release. Lease objects, materialized values, and child environments
must never be written to traces, sessions, artifacts, or provider context.

## Local implementation

```ts
import {
  createEnvironmentCredentialBroker,
  createLocalExecutionBackend,
} from '@fdekit/runtime/execution';

const credentials = createEnvironmentCredentialBroker({
  bindings: {
    'provider:example': {
      PROVIDER_TOKEN: 'EXAMPLE_PROVIDER_TOKEN',
    },
  },
});

const backend = createLocalExecutionBackend({
  rootDir: '.fdekit/workspaces',
  allowedExecutables: [process.execPath],
  inheritedEnvironment: ['PATH'],
  maxCommandTimeoutMs: 30_000,
  maxOutputBytes: 1_048_576,
});

const credential = await credentials.acquire({
  credentialRef: 'provider:example',
  purpose: 'run trusted local adapter',
});
const workspace = await backend.acquire({
  leaseId: 'run-123-attempt-1',
  ttlMs: 60_000,
});

try {
  const result = await workspace.execute({
    executable: process.execPath,
    args: ['./trusted-adapter.mjs'],
    credentials: [credential],
  });
  console.log(result.status);
} finally {
  await workspace.release();
  await credential.release();
}
```

The local backend enforces an exact executable allowlist, workspace-relative
seed and working-directory paths, an explicit inherited-environment allowlist,
credential lease injection, wall-clock timeout, combined output cap, lease
expiry, active-process cancellation, and recursive workspace cleanup.

## Security boundary

The local backend is constrained host execution, **not a security sandbox**.
An allowlisted executable can still access host resources available to the
current operating-system user, and allowing an interpreter such as Node.js can
permit arbitrary code. The backend truthfully advertises
`filesystemIsolation`, `processIsolation`, and `networkIsolation` as `false`
and fails closed when a lease requires any of them.

Use the local backend only for trusted commands in local development or an
already-isolated worker. Untrusted code requires a separate backend backed by a
real sandbox/container/VM with the required isolation capabilities. Hosted
credential brokers should issue short-lived capabilities or proxy access
instead of distributing reusable secrets.

## Governed tools and Docker isolation

`defineExecutionTool()` wraps a backend command as an ordinary FDEKit tool, so
the existing schema, policy, approval, trace, and audit edges run before a
workspace is acquired. The helper seeds a disposable lease, executes once,
marks non-completed outcomes as tool failures by default, and always releases
the workspace.

`createDockerExecutionBackend()` provides the isolated path for untrusted
work. It invokes an explicitly configured Docker executable and image with a
read-only root, all Linux capabilities dropped, `no-new-privileges`, bounded
PIDs/memory/CPU/output/time, a single writable workspace mount, and
`--network none`. Credential leases use a short-lived mode-0600 env file
outside the mounted workspace and are removed after execution. Pin production
images by digest.
