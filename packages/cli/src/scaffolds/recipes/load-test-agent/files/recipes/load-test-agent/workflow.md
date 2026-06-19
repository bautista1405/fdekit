# Load-Test Agent Workflow

This recipe is useful when a team needs repeatable readiness evidence for a customer API before or during a deployment.

## Current Workflow

- Manual steps: choose target, run script, inspect k6 output, compare thresholds, write readiness summary.
- Handoffs: forward-deployed engineer -> platform engineering -> customer owner.
- Systems of record: customer API, load-test script, dashboard/report artifacts.
- Recurring exceptions: missing baseline, accidental over-test, unclear threshold owner, hard-to-share results.
- Baseline metric: 30m manual smoke test and report.

## Target Workflow

- Deterministic automation: run command construction, caps, threshold extraction, dashboard/report writing.
- Agent judgment: summarize the result, call out bottleneck, recommend next engineering action.
- Human judgment: approve larger stress/spike profiles and customer-environment test windows.
- First improvement target: <5m from target API to readiness evidence.

## Scorecard

| Signal | Rating | Notes |
| --- | --- | --- |
| Volume | medium | Load tests run around pilots, launches, releases, and customer escalations. |
| Manual effort | medium | Engineers repeatedly run, parse, and summarize similar threshold checks. |
| Fragmented systems | medium | Customer API, local environment, k6 scripts, and report artifacts. |
| Repeatable decisions | high | Pass/fail thresholds and next actions are repeatable. |
| Measurable pain | high | p95 latency, error rate, and report cycle time are explicit. |
| Risk boundary | high | Larger profiles can disrupt shared environments and should require approval. |

## Data Layers

- System of record: customer API and load-test script.
- Business rules: k6 thresholds, max VUs/duration caps, governance policies, and eval assertions.
- Raw intake: scenario, target URL, VUs, duration, and k6 output.
- Feedback and memory: threshold failures, approved test windows, audit logs, and future eval cases.

## Rollout

1. Local deterministic simulation with no HTTP requests or external k6 dependency.
2. Sandbox run against the bundled customer API.
3. Customer sample with conservative smoke profile.
4. Shadow readiness checks during non-production windows.
5. Human-approved higher-load profiles.
6. Production allowlist for targets, windows, and maximum profiles.
