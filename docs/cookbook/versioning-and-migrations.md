# Versioning And Migration Notes

Use this pattern when a customer deployment evolves from one recipe/config version to another.

The goal is simple:

1. Make the current deployment shape explicit.
2. Validate it before handoff.
3. Diff changes before upgrading a customer.
4. Leave human-readable notes for the FDE and customer team.

## Add Deployment Metadata

```ts
export default defineDeployment({
  name: 'company-support-triage',
  version: '0.2.0',
  recipe: {
    name: 'support-triage',
    version: '0.2.0',
  },
  migrationNotes: [
    {
      from: '0.1.x',
      to: '0.2.0',
      summary: 'Adds scoped Slack notifications and a stricter issue approval gate.',
      breaking: false,
      steps: [
        'Run fdekit validate after updating Slack channel settings.',
        'Run fdekit diff before handing the deployment back to the customer.',
        'Confirm approval owners know how to run fdekit approvals list.',
      ],
    },
  ],
  // ...
});
```

API reference: [`defineDeployment`](../api/core.md#definedeployment), [`DeploymentDefinition`](../api/core.md#deploymentdefinition), [`RecipeReference`](../api/core.md#recipereference), and [`MigrationNote`](../api/core.md#migrationnote).

Use `version` for the customer deployment version. Use `recipe.version` for the recipe baseline it came from.

## Package Versions

Deployment and recipe versions are customer-facing migration metadata. FDEKit package versions are managed separately with Changesets:

```bash
npm run changeset
npm run version-packages
```

The public packages are released as a fixed group, and scaffolded FDEKit dependency ranges are derived from the CLI package version. Do not hardcode npm package versions inside recipe or catalog dependency maps.

## Validate And Snapshot

Run validation before a demo, before a customer handoff, and after changing providers, connectors, policies, evals, or datasets:

```bash
fdekit validate
```

CLI reference: [`fdekit validate`](../api/cli.md#fdekit-validate-json-strict). Runtime symbols: [`validateDeployment`](../api/runtime.md#validatedeployment) and [`createDeploymentSnapshot`](../api/runtime.md#createdeploymentsnapshot).

This checks the deployment and writes:

- `.fdekit/deployments/latest.json`
- `.fdekit/deployments/snapshots/deployment-*.json`

The snapshot is normalized so it can be reviewed and diffed. It includes field-method primitives, deployment metadata, provider models, connectors, tools, tool scopes, agent/provider links, governance settings, eval names, eval assertions, and migration notes.

Use JSON output when CI or another script needs the validation result:

```bash
fdekit validate --json
```

CLI reference: [`fdekit validate`](../api/cli.md#fdekit-validate-json-strict). Runtime result type: [`DeploymentValidationResult`](../api/runtime.md#deploymentvalidationresult).

## Diff Before Upgrade

The default diff compares the last validated snapshot with the current `fde.config.ts`:

```bash
fdekit validate
# edit fde.config.ts
fdekit diff
```

CLI reference: [`fdekit validate`](../api/cli.md#fdekit-validate-json-strict) and [`fdekit diff`](../api/cli.md#fdekit-diff-from-snapshot-to-config-or-snapshot).

You can also compare explicit snapshots or configs:

```bash
fdekit diff --from .fdekit/deployments/snapshots/deployment-2026-05-01T10-00-00-000Z.json --to fde.config.ts
fdekit diff --from customer-v1.json --to customer-v2.json --json
```

CLI reference: [`fdekit diff`](../api/cli.md#fdekit-diff-from-snapshot-to-config-or-snapshot). Runtime symbols: [`diffDeploymentSnapshots`](../api/runtime.md#diffdeploymentsnapshots), [`DeploymentDiff`](../api/runtime.md#deploymentdiff), and [`DeploymentDiffChange`](../api/runtime.md#deploymentdiffchange).

The output is intentionally compact:

```txt
~ version: "0.1.0" -> "0.2.0"
+ connectors.slack.tools.slack.message: {"scopes":["slack:write"],"environments":["staging"]}
~ governance.budgetCaps.0.maxUsd: 0.25 -> 1
```

Runtime reference: [`DeploymentDiffChange`](../api/runtime.md#deploymentdiffchange) is the artifact shape behind each diff line.

That gives the FDE a quick review surface before they run the agent against customer systems.

## Migration Notes That Help Humans

Migration notes should explain operational changes, not just code changes.

Good notes answer:

- What changed in the recipe or deployment?
- Is anything breaking?
- Which env vars, scopes, datasets, or approvals need review?
- What should the engineer run before the customer demo?

Keep each note short. Put commands in `steps` when the action is concrete.

## Suggested Upgrade Flow

```bash
# 1. Capture the current known-good baseline.
fdekit validate

# 2. Upgrade recipe/config/provider/connector/eval settings.

# 3. Review the change surface.
fdekit diff

# 4. Re-run validation and the relevant evals.
fdekit validate
fdekit eval run
fdekit eval macro

# 5. Refresh customer-facing evidence.
fdekit report
fdekit console
```

CLI reference: [`fdekit validate`](../api/cli.md#fdekit-validate-json-strict), [`fdekit diff`](../api/cli.md#fdekit-diff-from-snapshot-to-config-or-snapshot), [`fdekit eval run`](../api/cli.md#fdekit-eval-run), [`fdekit eval macro`](../api/cli.md#fdekit-eval-macro-min-frequency-n), [`fdekit report`](../api/cli.md#fdekit-report), and [`fdekit console`](../api/cli.md#fdekit-console).

This keeps a local audit trail of how the deployment changed while preserving the lightweight filesystem-first runtime.

## Next Step

If you just reviewed a migration or diff, refresh customer evidence with `fdekit report` and `fdekit console`, then compare the result against the [Production-Shaped Governance-Heavy Reference Architecture](../reference-architectures.md#production-shaped-governance-heavy-setup).
