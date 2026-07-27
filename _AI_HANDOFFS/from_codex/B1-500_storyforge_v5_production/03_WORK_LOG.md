# B1-500 Work Log

## 2026-07-26

- Read the execution prompt, complete combined handoff, canonical V5 artifact, historical handoff, and applicable system contracts.
- Verified the canonical V5 SHA-256.
- Verified branch, HEAD, remote, clean tracked baseline, runtime ownership, migration layout, and tool availability.
- Ran the protected Matrix asset inventory and live-origin/public preflight. Live hashes match the lock; source is absent; guard blocked protected edits.
- Verified the main checkout is concurrently dirty and treated it as `DO NOT TOUCH`.
- Verified read-only Railway resource/deployment status.
- Verified Supabase, GitHub, Docker, PostgreSQL, Node/npm, R2 tooling, and credential boundaries.
- Traced WordPress 360 entitlement generation and the active HQ/Supabase auth bootstrap. Found the entitlement propagation gap.
- Searched for a verified mentor assignment source and legacy StoryForge data source; none found.
- Added the ticket-scoped agent contract and Stage 0 records.

Next: implement and test the isolated reversible source package.

- Added `storyforge-v5/` with a no-client-secret browser client, bearer-auth API, purpose-bound JWT verifier, PostgreSQL adapter, private-R2 signed upload adapter, parser, and fail-closed feature flags.
- Added an additive 1,221-line PostgreSQL migration candidate outside the root Supabase migration directory.
- Added ephemeral PostgreSQL harnesses for foundation, local browser, and E2E verification.
- Initial PostgreSQL startup was blocked by sandbox shared-memory limits; reran the isolated harness with explicit approval.
- Fixed numeric type casts found by the first database run. The final authorization/lifecycle suite passes 29 named assertions.
- Installed isolated dependencies after explicit network approval.
- The first XLSX dependency audit found a high-severity no-fix advisory. Removed it.
- The second parser brought a vulnerable archive dependency tree. Removed it.
- Replaced it with `read-excel-file` plus a direct RFC 4180-style CSV parser; valid XLSX, malformed input, duplicates, near-duplicates, formula-like cells, and limits pass.
- Final full npm advisory audit reports zero vulnerabilities.
- Fixed a volatile-composite expansion error found by the raw API/browser suite. RPCs now execute exactly once through `SELECT * FROM function(...)`.
- Fixed student visibility of attributed mentor names and co-mentor visibility through narrow, security-definer boolean helpers; story privacy did not broaden.
- Final Chrome suite: three tests passed, covering raw API privacy, canonical two-mentor coaching loop, real event notification, immutable original, truthful audio/AI gates, desktop/mobile screenshots, and axe.
- Attempted the separate in-app browser connection after loading its required workflow; discovery reported no available browser. No claims depend on that surface.
- No deployment, migration apply, protected source mutation, bucket creation, shared auth edit, production write, commit, push, or PR was performed.
