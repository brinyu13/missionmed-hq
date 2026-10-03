# Codex Sol intake repair handoff — 2026-10-02

Scope: the five package paths in SOL_PACKET.md. Base HEAD was `3f650a10fa46f637fc656dd3f13d0ce18ea7093b`. Parent's `PRODUCT:TIMELINE` keeper was `READY` and younger than 15 seconds at each write. No lease acquisition, provider write, deployment, or visual-template edit was made.

## Reproduction and repair

- Reproduced the `Name:`-only bypass: an accepted medical-education event carried `profileNameProvenance` but no `profileHeaderReviewRequired`, so `buildApprovalBatch` silently prefixed an empty profile. New regression failed before the change and passes now. Every recognized CV profile name/school/degree claim requires the separate `acceptProfileClaims` decision; the batch builder also checks provenance if an adapter omits the review flag.
- Distinct labelled header values for the same profile field now retain source-block, document, and SHA-256 provenance and block automatic profile prefill. Multiple plausible medical-education entries also block selection of one shared profile header. The dated events remain separately approvable. Conflicted profile claims have no checkbox and direct `acceptProfileClaims=true` does not bypass the block.
- Declined or conflicting CV profile claims are excluded from approved event fields as well as profile prefill. Dated experience fields and their original evidence remain. Existing manual profile values are not overwritten. The Rescue profile flow remains distinct and tested.
- Preserved the preexisting dirty fixes in these paths: CV header isolation, explicit pipe category tokens, category mapping, blank unknown category review, date wording/provenance, and source-versus-experience institution separation. The preimage manifest records their exact bytes: `cv-parser.js` `6a00ab07e025f63b29d76de18e051e5d9cc4c431209a343cebd98dcfd317645e`; `event-classifier.js` `7073147931a38b783a899700d387a4f2acb585a9685f1178752024c98c645aca`; `intake-d1-408-adapter.js` `e6fae5b70cd7ec58b227ccb0b56609a2016849946cdb0f040c310a01e58f2d5f`; `intake.js` `b25e02d7067e3d4af41a842203c09993b550ade741d7242db943650e90354a0a`; new `d1-023-intake-profile-category.test.mjs` `3e26302931e9fa3e65e4bbc1a629bacf6d889f33d4d4da8acc4dbee7b0903057`.

## Verification

- `node --test tests/d1-023-intake-profile-category.test.mjs`: 7/7 pass. Covers name-only consent, direct missing-flag backstop, conflict provenance, multiple medical entries, orphan degree, blank category, experience/profile institution separation, manual-value preservation, and private projection.
- `node --test tests/d1-023-intake-profile-category.test.mjs tests/d1-021-rescue-profile-intake.test.mjs`: 11/11 pass.
- `node --test tests/uxr-002-intake.test.mjs tests/uxr-002-intake-d1-408-adapter.test.mjs tests/cv-fallback-classifier.test.mjs`: 34/34 pass.
- `git diff --check` on the four tracked source paths: pass.

Three older assertions remain intentionally red because they expect CV profile fields to prefill from event acceptance without separate confirmation. They are outside this worker's write paths. Parent will update these tests to establish explicit profile consent before expecting prefill:

1. `tests/d1-021-cv-header-name.test.mjs`, `accepted medical degree prefills CV2 name with source-event authority and preserves existing manual name`, line 41.
2. `tests/d1-021-cv-local-extraction.test.mjs`, `021 accepted source entries hydrate name and exam profile with provenance, privacy and existing values preserved`, line 80.
3. `tests/d1-021-cv-local-extraction.test.mjs`, `021 physical golden degree keeps its source study period through visibility edits and graduates at its explicit endpoint`, line 174.

The combined `d1-023`, CV-header, CV-local, and Rescue run was 25/28 with only those three failures. No full suite, live role-flow, provider, or production claim is made here.

Commit: pending exact-path commit below. Implementation worker model: Codex Sol.
