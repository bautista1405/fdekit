# Project-Local Skill Contracts

FDEKit supports reviewed project-local skill manifests without introducing a
standalone package or managed marketplace.

A `ProjectSkillManifest` declares version, license, safe project-relative
entrypoint, diff/shadow/apply modes, requested capabilities and sources, tool
names, eval references, provenance, and a SHA-256 entrypoint digest.

`evaluateProjectSkillGrant()` intersects requested authority with the exact
`EffectivePolicy`. Missing capabilities, disallowed sources, undeclared modes,
or apply without `external:write` are denied. Capabilities listed in
`approvalRequiredFor` produce `needs_approval`; the manifest cannot grant
itself authority.

`loadProjectSkills()` reads `fdekit/skills/<name>/skill.json` by default,
rejects unsafe or symlink escapes, and verifies the entrypoint digest. Loading
does not import or execute the entrypoint. Execution remains the responsibility
of a bounded runtime that enforces the returned policy grant and eval mode.

`runDocumentationSkillShadow()` is the first bounded pilot. It accepts only
`diff_only` or `shadow`, requires an allow decision from the exact effective
policy, rejects ungranted document sources, and requires filesystem, process,
and network isolation from the execution backend. The entrypoint receives
documents over stdin inside a disposable workspace. Only a schema-validated
finding/change/validation proposal is returned; there is deliberately no apply
or publish code path.

The codebase-agent example contains an original MIT documentation pilot with a
pinned entrypoint digest and held-out eval cases. It distinguishes proposed
from implemented behavior and checks for examples without importing the
third-party documentation skill referenced by the roadmap.
