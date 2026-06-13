# Load Test Agent Recipe

This recipe turns load testing into a governed FDEKit agent workflow.
It includes a workflow scorecard and rollout plan in `recipes/load-test-agent/workflow.md`.

The first rung is credential-free and deterministic:

```bash
npm run fdekit:loadtest:run
npm run fdekit:loadtest:eval
npm run fdekit:loadtest:feedback
npm run fdekit:loadtest:console
```

To run against the sample API:

```bash
npm run loadtest:api
```

In another terminal:

```bash
FDEKIT_LOAD_TEST_MODE=k6 npm run fdekit:loadtest:run
```

Advanced usage:

- Set `LOAD_TEST_TARGET_URL` to the customer API or local environment gateway.
- Set `K6_SCRIPT` to a custom k6 JavaScript file.
- Keep `K6_MAX_VUS` and `K6_MAX_DURATION_SECONDS` conservative for shared customer environments.
- Use FDEKit approvals/policies before enabling larger stress or spike profiles.
