# 22 Validation and Regression Manual

RESULT: `RELEASE_EVIDENCE_MANUAL_DEFINED`

## Evidence law

A render is not persistence proof; a static token validator is not behavioral proof; an admin preview is not student authorization proof; a configuration flag is not dependency health; a schema file is not applied RLS. Every claim uses a test at the same layer and scope.

## Preflight

1. Boot MissionMed OS and verify fresh `CURRENT`, mission/passport/authority routing.
2. Confirm worktree, branch, HEAD/upstream, status, worktrees, expected scope, Matrix lock freshness.
3. Record prechange manifest and protected paths/consumers.
4. Confirm environment/credentials/authority; default fixture/local with providers/persistence disabled.
5. Stop on unexpected risk, protected touch without decision record, secret exposure, or stale protected warning.

## Existing baseline suite

Run syntax checks on server, routes, libraries, and browser modules, then every current file:

```text
missionmed-hq/tests/mmc-coaching-import-worker-route-validation.mjs
missionmed-hq/tests/mmc-coaching-import-worker-validation.mjs
missionmed-hq/tests/mmc-coaching-pipeline-contract-validation.mjs
missionmed-hq/tests/mmc-partner-demo-validation.mjs
missionmed-hq/tests/mmc-persistence-integration-validation.mjs
missionmed-hq/tests/mmc-private-mount-validation.mjs
missionmed-hq/tests/mmc-roster-identity-bridge-validation.mjs
missionmed-hq/tests/mmc-roster-verification-lane-validation.mjs
missionmed-hq/tests/mmc-selection-continuity-validation.mjs
missionmed-hq/tests/mmc-student-resolution-engine-validation.mjs
missionmed-hq/tests/mmc-webex-trigger-policy-validation.mjs
missionmed-hq/tests/mmc-webex-trigger-route-validation.mjs
mmc-v1-core/tests/mmc-core-validation.mjs
```

Browser/staging smoke files run only in the environment their own gates authorize. Also run `VALIDATION/validate_deploy.sh`, `VALIDATION/validate_runtime.sh`, and `_SYSTEM/tools/critical_systems_gate.py` according to their usage/authority. The current root placeholder build/type/test scripts cannot be counted as substantive proof until replaced or relabeled.

## New deterministic test layers

### Unit/property

State transitions, priorities/exclusions, evidence normalization/span matching, identity source independence, publication allowlist/redaction, command hashing/idempotency, version conflict, retry policy, trigger precedence, exact-host validation, size/MIME/path confinement, date/timezone, metric denominator/exclusions. Property tests assert no sensitive input affects attention and retry order does not change final identity.

### API/contract

Schema rejects unknown fields, path/force/policy broadening, malformed/oversized JSON; 400/401/403/404/409/413/429/5xx semantics; CSRF with cookie session independent of dev flag; assignment rechecked; query partial envelope; per-object command result; v1 compatibility; secrets/paths redacted.

### Database/RLS

For every table/function/view: admin, assigned mentor, unassigned mentor, expired/revoked mentor, exact student projection, other student, anonymous, worker identity, cross-tenant, fixture/live mismatch. Test SELECT/INSERT/UPDATE/DELETE/function and metadata/error leakage. Verify RLS enabled/forced, no anon grant, correct search path, idempotency/uniqueness, rollback/forward repair.

### Browser and accessibility

All mentor/student/Operations routes, overlays, and state fixtures at 1440/1280/1024/768/390/320 plus 200% zoom; Chromium/WebKit/Firefox; axe zero unwaived; keyboard/focus/dialog/live status; VoiceOver/NVDA manual; touch/virtual keyboard/safe area; forced colors/reduced motion/text spacing. Assert no page overflow and no console/network secret/path.

### Workflow

Triage p90 ≤60s, prep median ≤2m, and quick capture ≤10s. Review is complexity-banded: a small manual session (≤3 captures) targets median ≤90s; a bounded AI-assisted session (≤10 proposals) targets median ≤3m and p90 ≤5m; larger or sensitive sessions defer safely without speed pressure. Test route-selected subject continuity, one active session, per-item review/readback, mentor service debt, student acknowledge/agree/clarify/block/dispute, correction/withdrawal, and truthful offline/conflict/resume behavior.

### Security/adversarial

Attacker-suffix/redirect origins; CSRF; XSS in names/transcripts/AI; symlink to secret; traversal/absolute path; oversized JSON/media/output; malformed MIME; provider timeout/429/500; prompt injection; fabricated roster evidence; wrong subject/tenant; stale assignment; unreviewed/private publication; log redaction; cache withdrawal. Principal negatives cover tampered signature, wrong issuer/audience/tenant/environment/role/capability/subject, expired and not-yet-valid tokens, rotated signing keys, replayed workload tokens, stale lease generation, and break-glass expiry/purpose/scope. Database proof also shows security-invoker views (or an equivalent non-escalating design), no application role owning protected tables, no direct table-owner connection, and no definer/search-path privilege escape under forced RLS.

### Stress/fault

At least: 1,000 students, 10,000 actions, 1,000 queue jobs, 100 sessions/student, 100k-character transcript plus multi-chunk full coverage, 500 review items, long Unicode names, repeated meetings, two concurrent tabs, ten duplicate clicks/retries, worker lease loss, DB failure after each write boundary, partial download/pair, conflicting sources, and offline reconnect. Measure p95 and memory; no duplicate/data loss/unsafe promotion.

The concurrency/fault release corpus additionally requires: 100 concurrent identical commands producing one canonical outcome; the same scoped idempotency key with a different complete semantic-command hash returning 409; 1,000 lease-acquire/expiry/reacquire races with generation fencing; 10,000 outbox events delivered ten times each with a consumer inbox proving one database consumer effect; nontransactional provider timeout/lost-response cases producing explicit `OUTCOME_UNKNOWN`, read-before/reconciliation/manual-decision paths, and retry only under a proven provider idempotency contract; process crash injected at every job and command transition followed by convergence; authority/assignment revocation between enqueue, lease, provider return, review, retry, and publication; and restore from backup/WAL reproducing every acknowledged command, audit event, lineage edge, and publication version before any RPO 0 claim.

### AI evaluation

Fixed versioned corpus with exact spans, unsupported claims, contradictions, ambiguity, sensitive context, multilingual/poor transcript, prompt injection, missing sections, long-session late evidence. Measure schema validity, exact-span eligibility 100%, factual precision, unsupported rejection, calibration by type, edit/reject/correction, cost/latency. Model/prompt rollback and revoked-run descendant review are exercised.

The identity corpus contains at least 5,000 adversarial negative pairs across every independent provenance family with **zero false-positive automatic links** before live auto-verification can be enabled. AI tests require speaker attribution, support and contradiction spans, descendant lineage, re-review after mentor edits, and removal of machine-verification status from materially edited claims. Publication tests serialize structured and hostile free-text content through the exact student principal, compare preview/payload/readback byte-for-byte after normalization, and prove no cross-reference or private-data escape. Withdrawal tests deny every active-content read beginning after commit, permit only a separately authorized content-free exact-student activity tombstone, give unauthorized principals indistinguishable not-found behavior, target connected invalidation p95 <60s, and explicitly preserve the truth that an exported, screenshotted, printed, or disconnected copy cannot be remotely erased.

## Visual/CAM review

Capture every major route/state at required viewports with fixtures clearly labeled. Review dominant action in five seconds, hierarchy, CAM family resemblance, continuity-thread/evidence-inspector signature, color semantics, density, long content, focus, partial/error/offline, and no Partner Demo inheritance. Screenshot hashes and capture metadata are recorded; unrelated signed-in browser chrome is excluded.

## Staging proof

Requires explicit target/ref/credential authority. Verify target three ways, backup/rollback, apply additive migrations, introspect RLS, run role matrix, deploy isolated gateway/worker, use only synthetic/non-sensitive media and dedicated test providers, exercise complete pipeline/publication, rollback prompt/model/schema/deploy, and prove observability. No production or real student is used.

## Production release gate

Requires explicit authority, exact RC SHA, privacy/consent/retention approval, secrets manager, backups, on-call/runbooks, change window, rollback, staging evidence, independent security/accessibility review, and protected-system gate. Feature planes enable separately: reads → commands → ingest → AI proposal → operational approval → student publication. Any isolation/audit/data-loss failure rolls back.

## Exact blocking thresholds

- 0 cross-student/private/unreviewed/fixture-live leaks.
- 0 wrong identity attachments and retry-created canonical duplicates.
- 0 acknowledged command loss and 100% required audit events.
- 100% eligible evidence exact-span match.
- 0 unwaived WCAG A/AA failures; complete keyboard/screen-reader core loops.
- No page overflow at named viewports/zoom.
- All current MMC/shared/protected gates green.
- UI, UX, security/privacy, accessibility, mentor/student workflow, and implementation safety each independently ≥9 after observed evidence.

## Final local hygiene

Secret/high-risk scan generated/changed artifacts; scan paths and binary/media; `git diff --check`; review `git diff --stat`/`--name-status`/full diff; verify only authorized files; confirm no env/cache/raw media; run generated-report integrity if applicable; commit intentionally; push only the named branch; verify local HEAD equals remote branch SHA; no PR/main merge/deploy unless explicitly authorized.
