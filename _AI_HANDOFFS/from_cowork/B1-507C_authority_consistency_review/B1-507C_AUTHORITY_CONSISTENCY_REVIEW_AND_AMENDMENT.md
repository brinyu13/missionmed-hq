# B1-507C -- STORYFORGE PHASE 1 AUTHORITY CONSISTENCY REVIEW AND AMENDMENT

Issued by Fable (Claude Opus 4.6, Extended Thinking) as an independent authority review. This document does not redesign StoryForge, create new architecture, replace Founder authority, or replace prior Fable authority. It determines whether the B1-507B authority package is internally consistent and, where it is not, produces the smallest possible amendment restoring consistency while preserving the highest-ranking authority.

Review scope: T0-03, T3-17, and Checkpoint-2 screenshot evidence. Nothing else.

Authority chain consulted:

1. B1-507B_FABLE_BINDING_AUTHORITY.md (seven rulings)
2. B1-507B_EXECUTABLE_CONTRACTS.md (literal SQL, schemas, procedures; GOVERNS on wording differences)
3. B1-507B_TEST_AND_ACCEPTANCE_MATRIX.md (174 tests across 10 sections)
4. B1-507B_COMPLETE_COMBINED_HANDOFF.md (Fable verdict and sequencing)
5. B1-507B_FULL_COMPLETE_COMBINED_HANDOFF.md (Codex implementation handoff)
6. B1-507B_IMPLEMENTATION_HANDOFF.md (Codex lane completion and contradiction analysis)

---

## 1. Independent Review

### Codex's conclusion is: CORRECT

Codex identified exactly two acceptance tests that conflict with higher binding authority. Both conflicts are genuine. The Checkpoint-2 documentation exception is reasonable. Supporting reasoning follows.

### T0-03: Authority conflict confirmed

T0-03 current wording:

> M4 is idempotent on function replacement | Running M4 twice produces no error (CREATE OR REPLACE) | INTEGRATION

The test name correctly identifies what is idempotent: the four `CREATE OR REPLACE FUNCTION` statements. The assertion incorrectly requires running the entire M4 migration a second time.

The M4 migration (Executable Contracts Section 1) contains eleven non-idempotent statements that will fail on a second application:

- Three `CREATE TABLE` statements (sf_audio_deletion_intents, sf_reconciliation_runs, sf_reconciliation_state) -- will raise "relation already exists"
- Four `CREATE INDEX` / `CREATE UNIQUE INDEX` statements -- will raise "relation already exists"
- One `INSERT INTO sf_reconciliation_state (id) VALUES (1)` -- will raise PK violation
- Three `CREATE POLICY` statements -- will raise "policy already exists"

These non-idempotent patterns are not oversights. The higher authority explicitly mandates them:

- Executable Contracts Section 5, Deliberate Choice #1: "The singleton sf_reconciliation_state row is seeded in the migration itself (not lazily). This prevents any race on first access." The migration-seeded INSERT requires non-idempotent `CREATE TABLE` followed by `INSERT`, not `CREATE TABLE IF NOT EXISTS`.
- The Codex Implementation Prompt Section "Known deliberate choices (DO NOT second-guess)" item 1 restates this.
- The DDL throughout Section 1 uses `CREATE TABLE` (not `IF NOT EXISTS`) consistently, and this consistency is itself a design signal: the migration is intended to execute exactly once, with rollback (T0-02) as the recovery mechanism.

The four `CREATE OR REPLACE FUNCTION` statements (sf_reconciliation_report, sf_append_voice_audit_service, sf_voice_audit_payload_ok, sf_reconciliation_sweep_old_runs) ARE re-executable. This is the valuable property T0-03 should verify: that function updates can be reapplied without interfering with existing schema.

The existing test matrix already covers migration recoverability through T0-02 (rollback restores prior state, re-apply after rollback succeeds). Double-apply without rollback is not a recovery path -- it is an error scenario that the non-idempotent DDL is designed to prevent.

Verdict on T0-03: Codex is correct. The test wording requires behavior that contradicts the governing DDL. The higher authority (Executable Contracts) resolves this in favor of one-time schema creation.

### T3-17: Authority conflict confirmed

T3-17 current wording:

> E13 503 seam: non-admin | GET /api/storyforge/voice-health with non-admin identity: reconciliation field is null, rest of response intact | E2E

The test expects HTTP 200 for a non-admin accessing the E13 endpoint, with the reconciliation field set to null and the rest of the response intact. This requires the non-admin request to pass through the outer admin gate and reach the E13 handler.

Four levels of higher authority establish that E13 is admin-only:

1. B1-507B Ruling 3 (Binding Authority): "reconciliation visibility surfaces through E13 (the existing admin voice-health endpoint)" -- E13 is named as an existing admin-only endpoint. The ruling does not create or modify this property; it treats it as established fact.

2. B1-507B Ruling 3 (Binding Authority): "Authorized role: the verified StoryForge app_role='admin' identity only (the two-account rule stands); WordPress administrator status grants NOTHING."

3. Codex Implementation Handoff, Lane 3: "Complete on the existing endpoint `/api/admin/voice/health`. [...] Existing admin-only outer authorization remains intact. No new endpoint was added."

4. Codex Full Handoff: "Existing `/api/admin/voice/health` route only. [...] Existing admin-only outer authorization preserved."

The E13 route path (`/api/admin/voice/health`) is under the admin routing prefix. The admin-only outer gate predates B1-507B and was explicitly preserved. A non-admin request is rejected by this gate with the existing 403 response before reaching any handler code, including the reconciliation report call.

For T3-17 to pass as written, one of two things would need to happen:

(a) Remove or bypass the admin-only outer gate -- which contradicts "Existing admin-only outer authorization preserved" and Ruling 3's admin-only mandate.

(b) Create a new non-admin health surface -- which was explicitly rejected in Ruling 3: "REJECTED: any broad admin platform, any raw-key or per-student reconciliation browsing, any WP-side surface." The hard boundaries in the Codex Implementation Prompt also state "no new endpoints."

Neither (a) nor (b) is authorized. The function-level sf_has_live_identity(ARRAY['admin']) check inside sf_reconciliation_report is defense-in-depth inside an already-admin-only endpoint, not the primary authorization mechanism.

T3-18 already covers the legitimate 503 seam scenario: when an admin's request reaches the handler but the function itself throws, the admin gets HTTP 200 with `reconciliation: null` while the rest of E13 remains intact. This is the correct scope for the 503 seam test.

Verdict on T3-17: Codex is correct. The test expects behavior that requires weakening the existing admin-only gate. The higher authority (Ruling 3 + pre-existing admin-only E13 route) resolves this in favor of preserving admin-only access.

### Checkpoint-2: Exception is reasonable

The screenshot evidence captured by Codex:

- Checkpoint 1 (5 viewports): Starting HEAD baseline before any changes
- Checkpoint 3 (1 viewport): Final brand desktop
- Checkpoint 4 (5 viewports + overlay): Final multi-viewport suite

No Checkpoint 2 exists. The numbering gap (1 to 3) reflects the gap in the implementation process.

The implementation landed as a single atomic commit: `5c142358fdc3a27b1bf88f8520f074bb82aea51f`. There was no meaningful intermediate repository state between the starting HEAD (Checkpoint 1) and the completed implementation (Checkpoint 3).

To produce a Checkpoint 2 screenshot, Codex would have needed to fabricate a partial state that never existed as a repository HEAD -- cherry-picking a subset of changes, screenshotting, then undoing the partial commit. The resulting screenshot would be misleading evidence of a state that never existed in the branch history.

Requiring a fabricated intermediate screenshot would REDUCE documentation integrity, not increase it. The honest numbering gap provides MORE integrity because it truthfully represents the implementation path: one baseline, one atomic implementation, one final verification.

The exception is reasonable. No amendment is required for Checkpoint-2.

---

## 2. Binding Amendment

Scope: the smallest possible correction restoring consistency between the test matrix and higher authority. Two test wordings are amended. One documentation note is added. Nothing else changes.

### Amendment A-1: T0-03 corrected wording

Replace:

| T0-03 | M4 is idempotent on function replacement | Running M4 twice produces no error (CREATE OR REPLACE) | INTEGRATION |

With:

| T0-03 | M4 CREATE OR REPLACE functions are re-executable | Re-executing the four CREATE OR REPLACE function statements from M4 (sf_reconciliation_report, sf_append_voice_audit_service, sf_voice_audit_payload_ok, sf_reconciliation_sweep_old_runs) against an already-applied M4 schema produces no error; table, index, policy, and singleton creation remains one-time-only with rollback as the recovery path (verified by T0-02) | INTEGRATION |

Rationale: preserves one-time schema creation (mandated by Executable Contracts Section 1), preserves rollback testing (T0-02), preserves CREATE OR REPLACE repeatability (the actual idempotent property), preserves migration recoverability (rollback + reapply, not double-apply), and does not require weakening M4.

### Amendment A-2: T3-17 corrected wording

Replace:

| T3-17 | E13 503 seam: non-admin | GET /api/storyforge/voice-health with non-admin identity: reconciliation field is null, rest of response intact | E2E |

With:

| T3-17 | E13 admin gate rejects non-admin | GET /api/admin/voice/health (E13) with non-admin identity returns the existing admin-only rejection (HTTP 403); the sf_reconciliation_report function is not invoked; the admin-only outer authorization is preserved | E2E |

Rationale: aligns with Ruling 3's admin-only mandate, preserves the existing admin-only outer gate, verifies the correct security behavior (rejection), and does not create a new non-admin health surface. T3-18 continues to verify the legitimate 503 seam (function error under admin access).

### Amendment A-3: Checkpoint-2 documentation note

Add to the acceptance matrix under the evidence section or as a footnote:

> Checkpoint-2 screenshot: not required. The B1-507B implementation landed as a single atomic commit (5c142358...). No intermediate repository state existed between the Checkpoint-1 baseline and the Checkpoint-3/4 final state. Fabricating an intermediate screenshot would misrepresent the implementation path. The checkpoint sequence 1, 3, 4 honestly reflects the atomic implementation.

### Acceptance count adjustment

The total automated test count remains 163. The two amended tests are now expected to pass (they were previously skipped due to authority conflict), which means the gate count changes from "161 passed, 2 authority-conflict skips" to "163 passed, 0 skips."

No new tests are added. No tests are removed. The 11 MANUAL RP-8 tests are unchanged.

---

## 3. Risk Review

**Would adopting these amendments weaken StoryForge?**

**NO.**

These amendments STRENGTHEN the authority package by eliminating internal contradictions. The reasoning for each:

Amendment A-1 (T0-03): The corrected test verifies a real and valuable property -- that M4's four functions can be safely reapplied via CREATE OR REPLACE -- while respecting the deliberate non-idempotent DDL design. The original wording would have required either (a) weakening the migration with IF NOT EXISTS guards, removing the defense-in-depth that prevents accidental double-application, or (b) permanently skipping the test. Neither is desirable. The corrected wording tests exactly what matters without requiring migration changes.

Amendment A-2 (T3-17): The corrected test verifies the CORRECT security behavior: that non-admins are rejected by the existing admin-only gate. The original wording implied that non-admins should receive a 200 response, which would require weakening the admin-only gate. The corrected test is a stronger security assertion because it verifies the outer gate holds. Defense-in-depth is preserved: the function-level sf_has_live_identity check (verified by T3-02, T3-03, T3-04) protects against any future routing error.

Amendment A-3 (Checkpoint-2): No documentation integrity is lost. The honest gap is more trustworthy than fabricated evidence.

No architecture, endpoint, table, function, grant, policy, or security boundary is modified by these amendments. The implementation is unchanged. Only the test expectations are corrected to match the higher authority.

---

## 4. Codex Instructions

Implement these three changes. Do not repeat the full authority package. Do not modify any architecture, endpoint, table, function, or security boundary.

### Change 1: Update T0-03 test

File: the test file implementing T0-03 (expected location: `tests/pg/b1-507b-migration.test.mjs`)

Current behavior (skipped): the test attempts to apply the entire M4 migration a second time and expects no error.

Required behavior (passing): the test re-executes ONLY the four CREATE OR REPLACE function statements from M4 against the already-applied schema and asserts no error. The four functions are:

1. `sf_reconciliation_report(integer)`
2. `sf_append_voice_audit_service(text, text, uuid, uuid, uuid, jsonb, jsonb)`
3. `sf_voice_audit_payload_ok(jsonb)`
4. `sf_reconciliation_sweep_old_runs()`

Extract the four CREATE OR REPLACE FUNCTION blocks from the M4 migration SQL (or call them directly). Execute each against the test database where M4 is already applied. Assert no error on any of the four. Do NOT re-execute CREATE TABLE, CREATE INDEX, CREATE POLICY, INSERT, ALTER TABLE, REVOKE, or GRANT statements -- those are one-time-only by design.

Remove the skip/pending marker. The test should pass.

### Change 2: Update T3-17 test

File: the test file implementing T3-17 (expected location: `tests/e2e/voice-health-reconciliation.spec.mjs`)

Current behavior (skipped): the test sends a non-admin request to the E13 endpoint and expects HTTP 200 with `reconciliation: null`.

Required behavior (passing): the test sends a non-admin request to the E13 endpoint (`/api/admin/voice/health`) and asserts:

1. The response status is 403 (the existing admin-only rejection).
2. The response does NOT contain a reconciliation field or any health data.
3. The sf_reconciliation_report function was not invoked (no side effects from the non-admin request).

Remove the skip/pending marker. The test should pass.

### Change 3: Checkpoint-2 documentation (no code change)

No code change is required. The Checkpoint-2 gap is accepted as documented. If Codex maintains a test evidence log or acceptance checklist, annotate the Checkpoint-2 entry as: "Not required -- atomic implementation, no intermediate state existed."

### Verification

After applying Changes 1 and 2:

1. Run the full test suite. All 163 automated acceptance tests should pass with 0 skips.
2. Verify the previously skipped T0-03 now passes.
3. Verify the previously skipped T3-17 now passes.
4. Verify no other test was affected (total counts unchanged).
5. No deployment, production mutation, or remote action.

### Output

Commit the two test changes. Update the implementation handoff to reflect 163/163 passed, 0 authority-conflict skips. Reference this B1-507C amendment as the governing authority for the two corrections.

---

## 5. Final Verdict

**READY FOR CODEX AMENDMENT**

Codex correctly identified both authority conflicts. The two acceptance test wordings (T0-03 and T3-17) contradict higher binding authority. The Checkpoint-2 documentation exception is reasonable and requires no amendment.

The three amendments in this document are the smallest possible corrections. They modify two test expectations and add one documentation note. They do not alter any architecture, database object, endpoint, function, grant, policy, security boundary, or implementation behavior. They align the test matrix with the binding authority that governs it.

After Codex applies these amendments, the acceptance gate advances from 161/163 (2 authority-conflict skips) to 163/163 (0 skips). The implementation is otherwise unchanged and ready for RP-8 operator preflight.
