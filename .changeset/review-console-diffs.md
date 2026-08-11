---
"@fdekit/core": patch
"@fdekit/console": patch
"@fdekit/cli": patch
"@fdekit/connector-github": patch
---

Show reviewed code, not just findings, in the console.

**Annotated diffs on a new Code Review page.** `fdekit console` now emits
`reviews.html`, rendering each review artifact with its findings anchored to the
lines they were raised against. Diffs are prerendered server-side, so the page
works with JavaScript disabled and stays a single emailable file.

**Reviews now carry the diff they reviewed.** `ReviewArtifact` gains an optional
`patchArtifact` pointing at a sibling `<runId>.patch` text artifact. Without it a
review could not be re-read offline - the console had to refetch the diff from the
forge to show what was reviewed. Optional, so existing reviews stay valid and
degrade to a findings-only view.

**`github.pr.list`** lists open pull requests for the configured repository so a
review queue can be ranked by risk rather than recency. Read-only (`pulls:read`),
with no repository argument: the connector is bound to one repo, so the tool
cannot be aimed elsewhere.

**Fixed:** a readiness item with no `detail` string threw and took down the entire
console render. It now degrades instead.

**New dependency note:** `@fdekit/console` depends on `@pierre/diffs`, which
declares required peer dependencies on `react` and `react-dom`. npm installs them
even though no FDEKit code path loads React - only the `ssr` entrypoint is used,
which renders to an HTML string. See the `@fdekit/console` README.

New public API: `@fdekit/console/diff` (`renderAnnotatedDiff`,
`prepareConsoleDiffs`), `ConsoleData.reviews`, `ConsoleReview`,
`renderConsolePages(data, { diffs })`, and review counts on `ConsoleMetrics`.
