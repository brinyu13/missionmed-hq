# 06 CANONICAL BRANCH SCHEMA AUTHORITY

## Research authority

| Contract | Authority |
|---|---|
| Canonical program key | Historical `programs.ndjson.id` carried as `rise_program_id` |
| Research schema | `rise.research.identity.v1` |
| Wave 1 identity sidecar | `WAVE1_RESEARCH_IDENTITY.ndjson` |
| Source-use contract | `rise.source.use.policy.v1` |
| Release manifest | `rise.research.authority.v1` |
| Research authority branch | `codex/p1-rise-4102b-research-authority` |

The sidecar fields are exactly `legacyAlias`, `riseProgramId`, `programSpecialtyId`, `browseMembershipId`, `browseSpecialty`, `relationship`, `identityReleaseId`, and `identityUse`. They are routing metadata, not program facts.

## Compatibility finding

Both 4006 branches contain the same identity implementation Git blob `2b8509621c09ba771ed1ea61eb3b462414e9a502` (SHA-256 `3c880fbc4f2842b8d8561d13dca3c7d6eccba27023a09fff46dafbb142332344`). Independent recomputation produced zero mismatches for all 6,139 program IDs, 6,139 program-specialty IDs, 6,345 browse-membership IDs, and 6,345 alias IDs.

The production candidate's SQL can preserve program, program-specialty, and browse-membership IDs but omits alias and source-qualified external-ID tables. That is a real production schema completeness gap. It does not prevent offline research because no production RISE migration was applied and this release writes no database.

## Combined specialties

The identity graph contains 206 programs with two legitimate browse memberships/aliases. Wave 1 retains component memberships rather than flattening them. A canonical program may therefore appear in multiple specialty work queues while program facts remain attached once to the canonical `rise_program_id`.

## Future production rule

Production must not load this historical release directly. A later ratified change must:

1. preserve migrations 001-003;
2. add a forward migration for release-scoped aliases and source-qualified external identifiers;
3. prove all 6,139 resulting program IDs equal the pinned mapping;
4. satisfy source-rights, privacy, RLS, release, and product-registration gates; and
5. make no destructive identity rewrite.

None of those production actions is performed or implied by 4102B.
