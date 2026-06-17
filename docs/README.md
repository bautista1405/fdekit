# FDEKit Docs

Use these docs in order when you are learning or shipping a deployment. Start with the track that matches your job, then use the full index when you need a specific reference.

## Start Here Learning Map

### Track A: Beginner - 30 Minutes

Use this track when you want to see the full loop before learning the internals.

1. [Root README](../README.md): run the support-triage quickstart.
2. [Recipes](./recipes.md): see the bundled patterns and install another recipe.
3. [Demo Script](./demo.md): practice the workflow -> governed run -> evidence -> dashboard story.
4. [CLI Reference](./cli-reference.md): learn the lower-level loop from `doctor` through `console`.
5. [Reference Architectures](./reference-architectures.md#local-deterministic-demo): understand the local deterministic demo shape.

### Track B: Deployment Hardening

Use this track when a demo needs to become a pilot or production-shaped deployment.

1. [Field Deployment Method](./field-deployment-method.md): define workflow, scorecard, data layers, rollout, and ownership.
2. [Production Hardening Guide](./production-hardening.md): add strict validation, approvals, redaction, budgets, SLOs, and runbooks.
3. [Versioning And Migration Notes](./cookbook/versioning-and-migrations.md): capture snapshots, diff changes, and write migration notes.
4. [Support Matrix](./support-matrix.md): check provider, connector, environment, and system dependency maturity.
5. [Reference Architectures](./reference-architectures.md#production-shaped-governance-heavy-setup): compare your deployment to the governance-heavy setup.

### Track C: Custom Connectors And Tools

Use this track when customer systems do not fit the built-in connector packages.

1. [Connector Cookbook](./cookbook/connectors.md): build a customer-specific connector with `defineConnector()` and `defineTool()`.
2. [Public API Reference](./api-reference.md): confirm package boundaries and symbol ownership.
3. [`@fdekit/core` API](./api/core.md): inspect authoring helpers, tool schemas, policy helpers, and eval assertions.
4. [Local Environment Cookbook](./cookbook/local-environments.md): separate agent-facing connectors from operator-facing environment setup.
5. [Maintainer Architecture](./architecture.md): follow package boundaries when promoting custom code into a package.

## Concept-To-Command Index

| Concept | Command(s) | Read This |
| --- | --- | --- |
| Run the launch demo | `npm run demo` | [Root README](../README.md), [Demo Script](./demo.md) |
| Start a project | `fdekit init`, `fdekit recipe install <name>` | [Root README](../README.md), [Recipes](./recipes.md) |
| Check local readiness | `fdekit doctor`, `fdekit doctor --live` | [CLI Reference](./cli-reference.md#validation-and-change-review), [Support Matrix](./support-matrix.md) |
| Start or inspect local customer-like systems | `fdekit env start`, `fdekit env seed`, `fdekit env doctor`, `fdekit env describe` | [Local Environment Cookbook](./cookbook/local-environments.md) |
| Validate config and strict tool metadata | `fdekit validate`, `fdekit validate --strict`, `fdekit validate --json` | [Production Hardening Guide](./production-hardening.md), [Versioning And Migration Notes](./cookbook/versioning-and-migrations.md) |
| Run an agent | `fdekit run <agent>`, `fdekit run <agent> --strict` | [CLI Reference](./cli-reference.md#runtime-and-evidence), [Reference Architectures](./reference-architectures.md) |
| Review approvals | `fdekit approvals list`, `fdekit approvals approve <id>`, `fdekit approvals reject <id>` | [Production Hardening Guide](./production-hardening.md) |
| Inspect audit evidence | `fdekit audit`, `fdekit feedback export` | [Production Hardening Guide](./production-hardening.md), [Versioning And Migration Notes](./cookbook/versioning-and-migrations.md) |
| Run lower-level evals | `fdekit eval run` | [Recipes](./recipes.md), [CLI Reference](./cli-reference.md#evals) |
| Find recurring behavior patterns | `fdekit eval macro` | [Production Hardening Guide](./production-hardening.md), [Reference Architectures](./reference-architectures.md#production-shaped-governance-heavy-setup) |
| Review deployment changes | `fdekit diff`, `fdekit validate` | [Versioning And Migration Notes](./cookbook/versioning-and-migrations.md) |
| Produce customer-facing evidence | `fdekit report`, `fdekit console`, `fdekit trace` | [Demo Script](./demo.md), [CLI Reference](./cli-reference.md#runtime-and-evidence) |
| Capture repeatable work | `fdekit recipe capture <name>` | [Recipes](./recipes.md) |

## Reference Architectures

- [Local deterministic demo](./reference-architectures.md#local-deterministic-demo): mock provider, local connectors, local artifacts, no credentials.
- [Hybrid local plus live connectors](./reference-architectures.md#hybrid-local-plus-live-connectors): local iteration with selected live Slack, issue, CRM, load-test, or provider paths.
- [Production-shaped governance-heavy setup](./reference-architectures.md#production-shaped-governance-heavy-setup): strict mode, approvals, audit, redaction, budgets, diffs, migration notes, reports, and retained evidence.

## Full Docs Index

### 1. Start

- [Root README](../README.md): project overview and one-command support-triage quickstart.
- [Recipes](./recipes.md): bundled recipe catalog, install commands, live connector paths, and example scripts.
- [CLI Reference](./cli-reference.md): command map for init, recipes, validation, runs, evals, approvals, reports, console, and environments.
- [Reference Architectures](./reference-architectures.md): local deterministic demo, hybrid live-connector setup, and production-shaped governance-heavy setup.

### 2. Design The Deployment

- [Connector Cookbook](./cookbook/connectors.md): bring your own customer system with `defineConnector()` and `defineTool()`.
- [Local Environment Cookbook](./cookbook/local-environments.md): run Docker or Floci-backed customer-like systems around the agent loop.

### 3. Validate And Operate

- [Versioning And Migration Notes](./cookbook/versioning-and-migrations.md): deployment metadata, snapshots, diffs, and upgrade flow.
- [Production Hardening Guide](./production-hardening.md): security baseline, rollout stages, SLOs, runbooks, and production checklist.
- [Support Matrix](./support-matrix.md): supported providers, connectors, packages, maturity, and system dependencies.

### 4. Extend FDEKit

- [Public API Reference](./api-reference.md): API index, package boundaries, and import rules.
- Package references: [`@fdekit/core`](./api/core.md), [`@fdekit/runtime`](./api/runtime.md), and [`fdekit` CLI](./api/cli.md).
- Package onboarding READMEs: start with [`@fdekit/core`](../packages/core/README.md), then follow the package graph to runtime, CLI, console, providers, connectors, and environments.
- [Maintainer Architecture](./architecture.md): package graph, runtime flow, ArtifactStore lifecycle, extension paths.
- [Provider Step And Tool Schema Spec](./specs/provider-steps-and-tool-schemas.md): provider step contracts, tool args schemas, and runtime edge strictness.

### 5. Demo

- [Demo Script](./demo.md): short demo script and talk track.
