# I1Q-1007X Darwin Maintainability Report

## Verdict

`INFERENCE: CONDITIONALLY MAINTAINABLE FOR LOCAL ENGINEERING. REFACTOR QUERY CONTRACTS BEFORE SCALE.`

VERIFIED: Exact integrated commit `6ac62c5a0503981680f161fe5119d5e5e2fa031a` has deterministic direct and dependent tests plus explicit fail-closed contracts.

INFERENCE: Its primary maintainability risks are incomplete server-side list contracts and responsibility concentration. Future extraction should stay behind existing interfaces.

## Evidence Reviewed

- VERIFIED: Exact integrated source at `6ac62c5a0503981680f161fe5119d5e5e2fa031a` on branch `i1q-question-platform-ultra-1007x-ma`.
- VERIFIED: Full package proof is 206 discovered, 205 pass, 0 fail, and 1 gated skip.
- VERIFIED: Evidence validation passes 20 of 20 files with zero errors and claims `STATE_A`.
- VERIFIED: Root supplies a separate disposable PostgreSQL result of 12 of 12 pass; Darwin did not rerun it.
- VERIFIED: The migration, compensation, runtime adapters, synthetic fixtures, validator, and relevant specialist reports were inspected.
- VERIFIED: Local measurements in `performance_before_after.json` are explicitly point-in-time.

## Size And Concentration

| Class | Surface | Current size | Maintainability observation |
| --- | --- | ---: | --- |
| VERIFIED | `src/platform.mjs` | 1,450 lines | Domain facade also owns authorization, lifecycle, release, governance, and fixture assembly |
| VERIFIED | `public/app.js` | 1,902 lines | Transport, state, 17 renderers, commands, focus, and scenarios share one module |
| VERIFIED | `src/validate-evidence.mjs` | 2,087 lines | Schema, parsing, math, checksum, release, handoff, and CLI responsibilities are combined |
| VERIFIED | 1007X migration | 3,299 lines | The file defines 52 tables and has a large security-definer and policy review surface |

## Findings

### MNT-01 P1: Operational lists are first-page bounded

VERIFIED: `public/app.js` requests at most 200 rows and applies available search, filter, sort, and paging to that local subset. `MemoryRepository.list` materializes, filters, and sorts the full collection on each request.

VERIFIED: In the point-in-time 20,000-row synthetic probe, a target at row 20,000 was present in the complete data set and absent from the first 200 rows.

INFERENCE: Add allowlisted server-side cursor, filter, sort, and exact-join contracts before 10,000-plus operational use. Keep the memory repository as a deterministic fixture adapter.

### MNT-02 P1: Cross-language release-hash logic needs frozen vectors

VERIFIED: JavaScript and PostgreSQL independently encode release validation.

INFERENCE: Independence is useful but creates drift risk around field order, sorting, NFC normalization, UTF-8 byte lengths, and delimiters. Make versioned synthetic vectors the parity authority without replacing both implementations with one self-validating path.

### MNT-03 P1: Cursor and PostgreSQL queue contracts are incomplete

VERIFIED: Unknown memory cursors silently restart page one. `PostgresRepository.listMyReviewAssignments` has no cursor or limit contract, and no PostgreSQL candidate-queue method mirrors the measured memory path.

INFERENCE: Define explicit invalid-cursor behavior, stable keyset tie-breakers, bounded assignment queries, and equivalent memory and PostgreSQL tests.

UNKNOWN: PostgreSQL plans, locks, and RLS overhead at representative synthetic cardinality remain unmeasured.

### MNT-04 P1: Domain responsibilities are concentrated in one facade

VERIFIED: `QuestionPlatform` exposes one useful boundary, but authorization, redaction, authoring, review, release, governance, and fixture concerns change in the same 1,450-line module.

INFERENCE: Future changes therefore have a broad review surface and can couple visibility rules to lifecycle rules.

INFERENCE: Retain the facade and extract internal services one domain at a time with unchanged error codes and characterization tests.

### MNT-05 P1: Client workflow concentration raises regression cost

VERIFIED: Source context, evidence gating, assignment acceptance, status continuity, responsive behavior, 17 workflow renderers, and command handlers share one client module.

INFERENCE: A small workflow change can affect global state, focus, source selection, or session behavior.

INFERENCE: Separate transport, selected-record context, renderers, and commands using native modules while centralizing source-context resolution and keeping answer-bearing content out of browser persistence.

### MNT-06 P2: The evidence validator should be modular but independent

VERIFIED: The current validator passes 20 of 20 files and the package suite preserves negative evidence tests. It duplicates selected runtime constants and hashing logic in a 2,087-line file.

INFERENCE: Split by concern without weakening independent verification. Mark each duplicate as intentionally frozen or authority-generated and preserve deterministic issue order and CLI behavior.

### MNT-07 P2: Migration maintenance must change after first apply

VERIFIED: Darwin did not apply the migration to any datastore.

PROTECTED: After first authorized canonical application, the migration must not be edited, renamed, or replaced.

INFERENCE: Record the accepted hash, use only forward migrations and preserving compensation, and generate table, function, policy, trigger, grant, and forced-RLS inventories.

### MNT-08 P2: Synthetic fixture construction is mixed with runtime domain code

VERIFIED: Local fixture assembly is explicit and synthetic non-clinical, but remains in the main platform domain module.

INFERENCE: Move fixture construction behind a test-only or local-demo factory while retaining production-mode rejection tests.

## Strengths To Preserve

- VERIFIED: Exact STAT projection and composite identity tests.
- VERIFIED: Closed-world Class A answer-leak checks.
- VERIFIED: Fail-closed auth, Origin, CSRF, role, assignment, and credential tests.
- VERIFIED: Deterministic privacy normalization and closed taxonomy.
- VERIFIED: Immutable audit-chain and release evidence tests.
- VERIFIED: Parameterized PostgreSQL repository methods with stable validation errors.
- VERIFIED: Disposable PostgreSQL adversarial test path.
- PROTECTED: Explicit six-flag off posture.
- PROTECTED: Synthetic non-clinical fixtures and no invented medical content.

## External Blocker Register

| Class | Area | Current truth |
| --- | --- | --- |
| BLOCKED | Production | No authorized deployment, smoke, monitoring, backup, or rollback proof |
| BLOCKED | Authentication | Canonical MissionMed identity and session integration is not certified |
| BLOCKED | Datastore | No canonical unprivileged runtime route, grant manifest, or promotion route is proven |
| BLOCKED | Browser | No real browser, responsive, accessibility-tree, or end-to-end session certification |
| BLOCKED | Human validation | No authorized physician, editor, novice operator, incident responder, or assistive-technology board |
| PROTECTED | Privacy | Real corpus remains inventory-only and extraction-blocked |
| BLOCKED | Medical governance | Lead remains unassigned and no medical approval is claimed |
| VERIFIED | Release evidence | Validator passes 20 of 20 and claims `STATE_A`; this does not establish State B, C, or D |

## Recommended Order

1. INFERENCE: Preserve exact checkpoint `6ac62c5a0503981680f161fe5119d5e5e2fa031a` and its negative validator coverage.
2. INFERENCE: Add server-side scale contracts and approved PostgreSQL query-plan proof.
3. INFERENCE: Create cross-language release vectors.
4. INFERENCE: Extract platform and client modules behind unchanged interfaces.
5. INFERENCE: Expand deterministic performance coverage to 10,001 and 20,000 rows.
6. BLOCKED: Run browser, assistive-technology, human, security, staging, and release verification only through authorized routes.

## Confidence

VERIFIED: Confidence is high in exact-head local test evidence, static concentration metrics, query-contract observations, and point-in-time synthetic measurements.

INFERENCE: Confidence is medium in refactor priority because canonical PostgreSQL and browser performance are unavailable.

UNKNOWN: No confidence is asserted for production behavior, medical correctness, privacy clearance, accessibility certification, or human usability.
