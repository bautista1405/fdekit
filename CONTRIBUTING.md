# Contributing to FDEKit

Thanks for taking the time to contribute. FDEKit is a field-deployment kit for production-shaped AI agent work: recipes, connectors, evals, governance, traces, approvals, and customer-facing reports.

This project is early, so the best contributions are concrete and demo-driven. Small fixes, sharper docs, tighter examples, and focused tests are very welcome.

## Ways to Contribute

- improve docs, examples, and setup instructions
- add or harden eval assertions
- improve recipe quality for support triage, codebase review, or sales research
- add connector/provider tests before expanding connector behavior
- improve governance checks, trace quality, reports, and dashboard readability
- report confusing APIs, missing ladder rungs, or places where the first-run experience feels rough

## Before You Start

For small fixes, open a pull request directly.

For larger changes, please open an issue first. This includes new providers, new connectors, major CLI commands, dashboard redesigns, config format changes, or anything that changes public package APIs.

## Development Setup

```bash
npm install
npm run build
npm run typecheck
npm run test
```

Useful example commands:

```bash
npm run example:doctor
npm run example:run
npm run example:eval
npm run example:macro
npm run example:console
```

The sales and codebase recipes have matching scripts:

```bash
npm run example:sales:run
npm run example:sales:console
npm run example:codebase:run
npm run example:codebase:console
```

## Versioning And Releases

FDEKit uses Changesets for package versioning. Public packages are kept in one fixed version group so the CLI, runtime, providers, connectors, environments, and console stay publishable at the same version.

For a user-facing package change:

```bash
npm run changeset
npm run version-packages
npm run publish-packages
```

`npm run changeset` records the release note and bump type. `npm run version-packages` updates package versions and internal dependency ranges. `npm run publish-packages` builds first, then publishes the changed public packages.

The CLI scaffold dependency version comes from the CLI package version, so `fdekit init`, `fdekit add`, and built-in recipe installs do not need source edits when the package version changes.

## Pull Request Checklist

Before opening a PR, please check:

- The change is scoped to one clear behavior or documentation improvement.
- Public APIs stay laddered: easy defaults first, advanced customization when needed.
- New behavior has focused tests.
- `npm run typecheck`, `npm run test`, and `npm run build` pass.
- Build/runtime output such as `artifacts/`, `dist/`, `.turbo/`, and local `.env` files are not committed.
- Docs or examples are updated when the user-facing behavior changes.

## Project Conventions

- prefer existing repo patterns over introducing new frameworks
- keep connector and provider packages small, typed, and independently testable
- treat governance, evals, traces, and reports as first-class product surfaces
- keep examples runnable without external credentials by default
- use live API modes as opt-in paths controlled by environment variables
- avoid committing secrets, customer data, local traces, or console artifacts

## Reporting Security Issues

Please do not open public issues for secrets, vulnerabilities, or sensitive customer-data handling problems. Use GitHub private vulnerability reporting when it is enabled for the repository, or contact the maintainer directly before sharing details publicly.