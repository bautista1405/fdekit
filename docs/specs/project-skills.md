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
