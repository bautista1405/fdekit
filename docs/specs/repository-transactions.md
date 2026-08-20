# Governed Repository Transactions

Repository changes cross a typed boundary. An agent or skill proposes a
`RepositoryChangeSet`; it does not receive a shell or an unconstrained Git
client.

Every change set binds:

- a repository and immutable base source/ref/object ID;
- one create/update/delete operation per normalized relative path;
- expected blob IDs for updates and deletes;
- explicit permitted path prefixes;
- optional exact `PlannedAction` approval identity.

`validateRepositoryChangeSet()` rejects escapes, duplicates, unpermitted paths,
missing content, missing expected blobs, excessive file count, and excessive
content before a repository adapter runs.

## Local Git implementation

`createGitRepositoryOperations()` from `@fdekit/connector-codebase` exposes
immutable reads and change-set application. It does not expose arbitrary Git
arguments.

Shadow mode checks the base, blob IDs, paths, limits, and caller validators
without writing repository objects, the worktree, or refs. Publication builds
one tree and commit through an isolated temporary index, then performs one
atomic `update-ref <new> <expected-old>`. A moved ref returns `stale`; it never
partially publishes the file set.

A provider without atomic expected-ref updates returns
`protected_fallback_required`. A separate provider adapter must create the
protected branch/change request while preserving the same base and capability
checks. Validation evidence is returned with every outcome.
