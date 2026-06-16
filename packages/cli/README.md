# @fdekit/cli

## Purpose

`@fdekit/cli` is the npm package for the `fdekit` command-line interface. It scaffolds projects, installs and captures recipes, adds providers/connectors/policies/evals, validates configs, runs agents, manages approvals, exports feedback, runs evals, renders reports, opens traces, generates the console, and manages local runtime environments.

Use the CLI when you want the standard workflow from a terminal. Use `@fdekit/runtime` when you need to script the same behavior inside another Node process.

## npm Package

Package page: [@fdekit/cli](https://www.npmjs.com/package/@fdekit/cli)

Install the package in a deployment project:

```bash
npm install -D @fdekit/cli
```

The package installs the `fdekit` binary, so commands stay unscoped:

```bash
npx fdekit init
npx fdekit recipe install support-triage
```

## Who should use this package

- Deployment authors starting or operating an FDEKit project.
- Forward-deployed engineers running validation, demos, evals, approvals, reports, and console output.
- Contributors adding or changing command behavior.

Choose `@fdekit/core` for config authoring helpers and `@fdekit/runtime` for programmatic execution.

## 5-minute quick example

From the repository root, the launch demo is:

```bash
npm install
npm run demo
```

For an installed project, the CLI primitives look like:

```bash
mkdir support-demo
cd support-demo
npm install -D @fdekit/cli@latest
npx fdekit init
npx fdekit recipe install support-triage
npm install
npm run demo
```

The installed support-triage recipe starts the local customer API on `127.0.0.1:8787`, waits for `/health`, runs the governed loop, generates the console, captures `support-renewal-risk`, and shuts the API down.

To step through the same loop manually:

```bash
npm run api
```

In another terminal:

```bash
npm run fdekit:doctor
npm run fdekit:validate
npm run fdekit:run
npm run fdekit:eval
npm run fdekit:console
```

Open `.fdekit/console.html` after the console command to inspect traces, eval status, approvals, policy posture, reports, and exports.

## Public API surface

The public surface is the `fdekit` binary, not a stable TypeScript import API:

```bash
fdekit init
fdekit recipe install support-triage
fdekit validate --strict
fdekit run supportTriage --strict
fdekit console
```

The CLI command reference documents the command surface and where each command is implemented: [CLI API Reference](https://github.com/bautista1405/fdekit/blob/main/docs/api/cli.md).

## Stability/backward-compat notes

`@fdekit/cli` is public but pre-1.0. Command names, documented flags, and scaffolded project structure are the compatibility boundary. Internal command modules are implementation details even though the CLI API reference links them for contributors.

## See also

- Authoring contracts: [@fdekit/core](https://github.com/bautista1405/fdekit/blob/main/packages/core/README.md)
- Runtime APIs used by commands: [@fdekit/runtime](https://github.com/bautista1405/fdekit/blob/main/packages/runtime/README.md)
- Dashboard renderer used by `fdekit console`: [@fdekit/console](https://github.com/bautista1405/fdekit/blob/main/packages/console/README.md)
- Full command reference: [CLI Reference](https://github.com/bautista1405/fdekit/blob/main/docs/cli-reference.md)
- Recipe catalog: [Recipes](https://github.com/bautista1405/fdekit/blob/main/docs/recipes.md)
- Local environments: [Local Environment Cookbook](https://github.com/bautista1405/fdekit/blob/main/docs/cookbook/local-environments.md)
