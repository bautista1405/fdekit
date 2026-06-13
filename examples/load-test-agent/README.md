# Load Test Agent Example

This example runs a governed load-test agent against a customer API. It includes a workflow scorecard and rollout plan encoded in `fde.config.ts`.

Start with deterministic local mode:

```bash
npm run demo
```

Or run the core loop step by step:

```bash
npm run example:loadtest:run
npm run example:loadtest:feedback
npm run example:loadtest:eval
npm run example:loadtest:console
```

To invoke a real k6 binary, start the sample API first:

```bash
npm run example:loadtest:api
```

Then in another terminal:

```bash
FDEKIT_LOAD_TEST_MODE=k6 npm run example:loadtest:run
```

Replace `LOAD_TEST_TARGET_URL` and `K6_SCRIPT` to point at a customer API and customer-specific k6 test file.
