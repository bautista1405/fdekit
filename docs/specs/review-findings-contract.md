# Review Findings Contract

This document formalizes the contract between a code-review agent, the FDEKit
runtime, the review grader, and anything that renders findings (PR comments,
notifications, the console).

The short version:

- a review finding is a typed JSON row (`ReviewFinding` from `@fdekit/core`),
- `parseFindings` is the single gate every model-emitted finding passes through,
- **evidence is required**: an ungrounded finding is dropped at parse, before
  the grader ever sees it,
- dropped rows carry field-named reasons that flow to the run trace and can be
  fed back to the model for a repair attempt.

## Why evidence is required

The review pipeline defends against hallucinated findings in three layers with
distinct jobs:

| Layer | Question it answers | Mechanism |
| --- | --- | --- |
| `parseFindings` (this contract) | Does grounding **exist**? | Structural: `evidence` must be a non-empty array of strings (file:line references or short quotes). No evidence → the row is dropped, deterministically. |
| `verifyFindingLocations` (`@fdekit/runtime`) | Does the cited location **exist**? | Deterministic: the finding's `file`/`line` are resolved against the reviewed working tree before any judge call. Fabricated locations are rejected with the tried candidates named. |
| Grader (`defineGrader` + `runGrader`) | Is the grounding **good**? | Judgment: an LLM judge re-scores each surviving finding for correctness, impact, and grounding quality — shown the actual numbered source around the cited line — and suppresses low scorers. |

The first two gates are deliberately the strictest links: they are cheap,
deterministic, and cannot be argued with by a persuasive rationale. A finding
that cites nothing, or cites a location that does not exist, never spends
grader budget and can never reach a PR comment.

### Location verification is repair-first, not reject-first

A naive existence check would false-positive on real findings, so
`verifyFindingLocations` follows these rules:

- **Checked against the working tree, never the diff.** Architectural findings
  legitimately cite unchanged files (a caller of changed code) and lines
  outside any hunk.
- **Path quirks are repaired, not rejected.** Backslashes, leading `./`,
  diff-header `a/`/`b/` prefixes, and accidental leading `/` are normalized;
  when a candidate resolves, the finding's `file` is canonicalized to it.
- **Line bounds have natural slack.** `1 <= line <= lines.length` where
  trailing-newline splitting yields one extra line — absorbing the most common
  model off-by-one.
- **Rejections are explained.** A dropped finding names what was tried
  (`file: 'a/src/x.ts' not found (tried: a/src/x.ts, src/x.ts) - cite a path
  relative to the codebase root`), flowing through the same `DroppedFinding`
  shape as parse failures — traceable and feedable back to the model.

## The shape

```ts
import type { ReviewFinding } from '@fdekit/core';

const finding: ReviewFinding = {
  file: 'src/billing.ts',        // relative path in the reviewed codebase
  line: 12,                      // 1-based, in the NEW version of the file
  severity: 'high',              // high | medium | low
  category: 'bug',               // bug | security | arch | perf | tests | style | intent-mismatch
  confidence: 0.9,               // 0..1, model-claimed; the grader overwrites it
  rationale: 'Missing await on an async call drops the rejection',
  suggestion: 'await syncBilling()',          // optional
  evidence: ['src/billing.ts:12'],            // REQUIRED, non-empty
};
```

## Validation rules

`parseFindings(raw)` accepts a findings array (or the `{ findings: [...] }`
wrapper models commonly emit) and validates every row:

| Field | Rule |
| --- | --- |
| `file` | required non-empty string |
| `line` | finite number `>= 1` (1-based, new file version) |
| `severity` | `high` \| `medium` \| `low` |
| `category` | one of `FINDING_CATEGORIES` |
| `confidence` | number in `[0, 1]` |
| `rationale` | required non-empty string |
| `suggestion` | string when present |
| `evidence` | **required non-empty array of strings** |

Behavior on violation: the row is **dropped, never thrown**. Valid rows are
returned as fresh objects, so unknown extra fields a model invents are stripped
and cannot flow into artifacts, comments, or notifications.

## DX: dropped rows are explained, not just counted

```ts
import { formatDroppedFindings, parseFindings } from '@fdekit/core';

const result = parseFindings(modelOutput);
// result.valid    → ReviewFinding[] (contract-clean)
// result.invalid  → number (= result.dropped.length)
// result.dropped  → [{ index, reasons: ['evidence: required non-empty array of strings - ...'] }]

if (result.dropped.length > 0) {
  const message = formatDroppedFindings(result.dropped);
  // 1) record it in the run trace (operators see WHY, not a bare count)
  // 2) optionally feed it back to the model for one repair attempt:
  //    "Your findings were rejected by the review contract: <message>.
  //     Resubmit the corrected findings JSON."
}
```

Reasons are field-named and actionable (`line: must be a finite number >= 1
(1-based line in the new file version)`), so a model can self-correct in one
round trip and a human reading the trace needs no source dive.

## Guidance for review-agent instructions

Recipe instructions for a review flow should state the contract explicitly:

- emit findings as a JSON array of `ReviewFinding` rows, nothing else;
- every finding MUST cite evidence (file:line references or short quotes from
  the diff or files actually read);
- findings without evidence are discarded automatically — an uncited finding is
  wasted work;
- if the runtime reports dropped findings, repair the named fields and resubmit.

## Related

- Contract source: `@fdekit/core` → `packages/core/src/reviews/index.ts`
- Grader (scores grounding quality): `defineGrader` (review phase of the
  [coding payload plan](../../misc/coding-payload-plan.md))
- Strict tool-schema gates at the runtime edge:
  [Provider Step and Tool Schema Spec](./provider-steps-and-tool-schemas.md)
