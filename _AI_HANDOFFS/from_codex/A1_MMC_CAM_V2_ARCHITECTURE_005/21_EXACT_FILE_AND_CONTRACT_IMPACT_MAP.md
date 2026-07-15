# 21 Exact File and Contract Impact Map

RESULT: `IMPLEMENTATION_SURFACE_MAPPED`

## Prioritized file-read list

1. `_AI_HANDOFFS/from_codex/A1_MMC_CAM_V2_ARCHITECTURE_005/01_EXECUTIVE_ARCHITECTURE_DECISION.md`
2. reports 07, 11, 16, 20, and 22 in this package;
3. current MissionMed OS `BOOT.md`, `CURRENT.md`, routed mission/passport/authority documents;
4. `_SYSTEM/CODEX_EXECUTION_GUARDRAILS.md`, `CRITICAL_SYSTEMS_CONTRACT.md`, `DATA_FLOW_CONTRACT.md`, `SUPABASE_MIGRATION_PROTOCOL.md`, Matrix lock protocol/manifest;
5. `missionmed-hq/server.mjs:1874-1910,3078-3315,3792-4349,7820+`;
6. `missionmed-hq/routes/mmc-coaching-pipeline.mjs` end to end;
7. `missionmed-hq/lib/mmc-coaching-import-worker.mjs`, `mmc-webex-triggered-pull.mjs`, `mmc-student-resolution-engine.mjs`, `mmc-roster-verification-lane.mjs`;
8. `missionmed-hq/public/mmc-private/index.html`, `src/app.js`, `src/styles.css`, `src/mmc-ownership-layer.js`, `src/mmc-data-adapters.js`;
9. both MMC migrations and RLS validation snippets;
10. every `missionmed-hq/tests/mmc-*` and `mmc-v1-core/tests/mmc-core-validation.mjs`;
11. Prompt 004A reports 08, 10–17 and screenshot evidence;
12. CAM visual/behavior sources identified in report 06. Partner Demo is last and design rejected.

## Existing file impact

| Current path | Current responsibility | Intended impact | Contract/protection |
| --- | --- | --- | --- |
| `missionmed-hq/server.mjs` | shared runtime/auth/CSRF/static/API wiring | minimal MMC route/module registration; exact-origin/route-local bounded handling unless shared fix separately approved | PROTECTED; decision record and broad regression required |
| `routes/mmc-coaching-pipeline.mjs` | monolithic admin/pipeline controller | decompose to thin versioned queries/commands; retain compatibility adapter during transition | No live side effect; API version/compat tests |
| `lib/mmc-coaching-import-worker.mjs` | synchronous scanner/import | replace request roots with job/asset broker; streaming hash, stability, idempotency | Dedicated roots; no Daily/registry coupling |
| `lib/mmc-webex-triggered-pull.mjs` | Webex inventory/download | exact origin, dedicated credential, policy intersection, streaming quarantine; eventually adapter behind worker | GET-only, no shared token/source mutation |
| `lib/mmc-student-resolution-engine.mjs` | candidate resolution | consume attested evidence and hard fixture/tenant boundaries | No client/manufactured authority |
| `lib/mmc-roster-verification-lane.mjs` | roster promotion | replace arbitrary-anchor strength with allowlisted signed envelopes/calibration | Reversible decision/audit |
| `public/mmc-private/index.html` | static multi-screen shell | semantic CAM shell landmarks/routes/overlays | Preserve private mount/auth |
| `public/mmc-private/src/app.js` | global UI/state/rendering | decompose route/view/action modules; remove hard-coded students/dates/decorative controls | No hidden global subject authority |
| `public/mmc-private/src/styles.css` | current visual shell | CAM tokens/components/reflow/accessibility; no Partner inheritance | WCAG/viewport/visual gates |
| `public/mmc-private/src/mmc-ownership-layer.js` | fixture/canonical mix, heuristics, whole-state save | replace with mode-isolated query/command store and canonical projections | No fixture resurrection/full-state sync |
| `public/mmc-private/src/mmc-data-adapters.js` | domain readiness/status | versioned adapters with explicit environment/provenance | Retire blanket statuses |
| `public/mmc-partner-demo/index.html` | synthetic historical demo | preserve as design-rejected evidence; optionally retire from product navigation later under separate decision | Do not copy/delete in 006 |
| `mmc-v1-core/` | older oracle | freeze and use compatibility tests only | Not implementation authority |
| current MMC migrations | historical schema | never rewrite | Additive migrations only |
| `supabase/snippets/*mmc*` | validation | expand role/isolation/idempotency/publication matrices | Run only under authorized target |
| `missionmed-hq/tests/mmc-*` | current contracts/smokes | retain, update only when authority changes, add behavioral suites | Avoid token-only false confidence |

## Proposed bounded modules

Names are implementation targets; 006 may adjust exact filenames while preserving boundaries and recording the mapping:

```text
missionmed-hq/routes/mmc/
  index.mjs · queries.mjs · commands.mjs · operations.mjs
missionmed-hq/lib/mmc/
  contracts/ · authz/ · commands/ · queries/ · trust/
  evidence/ · identity/ · publication/ · jobs/ · adapters/
  observability/ · persistence/
missionmed-hq/public/mmc-private/src/cam/
  shell/ · routes/ · components/ · state/ · mentor/ · reviews/ · operations/
missionmed-hq/public/mmc-student/
  role-scoped publication client (only after auth contract)
missionmed-hq/tests/mmc-cam/
  unit/ · contract/ · browser/ · a11y/ · stress/ · security/
supabase/migrations/<authorized_timestamp>_mmc_cam_v2_*.sql
supabase/snippets/<authorized_date>_mmc_cam_v2_*_validation.sql
```

## Versioned contracts

| Contract | Request/input | Result/output | Compatibility |
| --- | --- | --- | --- |
| Query | principal + route scope + filters/cursor | policy-filtered resource envelope, versions, section freshness/partial state | `/api/mmc/v2`; v1 read adapter during migration |
| Command | command/idempotency ID, expected version, target, purpose, typed payload | per-object result, version, audit/correlation, conflict/retry | no whole-state command in v2 |
| Adapter evidence | server adapter/version, attested source envelope | normalized bounded observation | external sources unchanged/read-only |
| Asset broker | opaque handle + job capability | stream/metadata within quota | never absolute path to browser/provider |
| Analysis | transcript version + prompt/model policy | immutable run/proposal/evidence records | no canonical object mutation |
| Review | target proposal/version + item decisions | immutable decisions + accepted canonical versions | stale input returns conflict |
| Publication | exact source versions + kind-specific bounded item union + policy | immutable projection hash/version and exact-student preview/readback | subject-bound fields only; no arbitrary pointer/JSON/HTML/URL; separate capability/principal |
| Job | operation/idempotency + typed payload | leased/retryable terminal state | durable reconciliation |
| Audit | actor/effective role/subject/assignment/purpose/object/before-after/correlation | append-only event ID | no sensitive body/secret |

### Representative v2 query

```json
GET /api/mmc/v2/students/{opaqueSubjectLinkId}/overview
200 {
  "data": { "subjectLinkId": "opaque", "version": 12, "sections": {} },
  "meta": {
    "environment": "LOCAL",
    "asOf": "RFC3339",
    "freshness": "CURRENT",
    "sections": { "plan": "AVAILABLE", "history": "PARTIAL" },
    "correlationId": "opaque"
  }
}
```

Tenant, environment, actor, capability, and assignment are absent from client authority and derived server-side. Cursors are opaque, scoped, and signed/validated. Counts, timing, pagination, and errors are normalized to avoid cross-scope metadata leaks.

### Representative command

```json
POST /api/mmc/v2/commands/session.close
{
  "commandId": "uuid",
  "idempotencyKey": "opaque",
  "expectedVersion": 8,
  "targetId": "opaqueSessionId",
  "purpose": "close_reviewed_session",
  "payload": { "decisions": [{ "proposalId": "opaque", "decision": "ACCEPT" }] }
}
200 {
  "status": "COMMITTED",
  "aggregateVersion": 9,
  "objectResults": [{ "id": "opaque", "kind": "TASK", "version": 1 }],
  "auditId": "opaque",
  "correlationId": "opaque"
}
```

`409 VERSION_CONFLICT` returns only policy-safe target/current versions and a compare/reapply path. The unique idempotency identity binds server-derived tenant + environment + principal + command kind + target + schema version + the client key; the stored hash covers the complete normalized semantic command, including expected version, purpose, and payload. `409 IDEMPOTENCY_PAYLOAD_MISMATCH` is returned for the same scoped key with a different hash. Same scoped key/same hash rechecks current authorization before a redacted original result; revoked principals receive no protected payload. `400/413/422` distinguish malformed/oversized/semantic-invalid input. Object-specific authorization failures use indistinguishable not-found behavior where existence is sensitive. `202` is reserved for a durable external job with operation ID/status URL; a canonical transaction never returns partial success.

### Worker/RPC boundary

The dedicated workload token binds issuer, audience, workload ID, tenant, environment, capabilities, expiry, and replay identity. `claim_job` performs CAS and returns job ID/payload hash/lease generation; every `heartbeat`, `record_external_result`, and `complete_job` supplies owner+generation and is rejected if stale. Promotion RPC rechecks authority grant, subject-link version, assignment, policy, environment, and exact lineage, then commits canonical objects/audit/outbox atomically. Prefer invoker rights; definer functions are narrowly owned, fixed-search-path, argument-validated, non-dynamic, and audited.

## v1 → v2 single-writer cutover

1. Inventory and hash/count v1 authoritative records; fixtures are excluded structurally.
2. Backfill v2 in a disabled environment-scoped namespace with immutable mapping IDs.
3. Shadow-read both and reconcile counts, normalized hashes, relationships, visibility, and RLS; fix until exact or explicitly adjudicated.
4. Keep v1 the **only writer** throughout backfill/shadow. Dual-write is forbidden.
5. Acquire an environment cutover lock, freeze v1 writes, drain in-flight commands/jobs, re-reconcile, then atomically switch the server-owned writer/read gate to v2.
6. After the first accepted v2 write, rollback cannot re-enable v1 or restore pre-cutover truth and discard acknowledged v2 commands. Use v2 forward repair or restore a coherent v2 backup/WAL recovery point that includes every acknowledged v2 write, audit event, lineage edge, and publication through the declared recovery point.
7. Compatibility adapter is read-only and time-bounded. Removal requires zero callers and archived reconciliation evidence.

Cutover rehearsals prove one writer before/during/after, exact hashes/counts, no lost acknowledgement, and non-forking rollback.

## Implementation-minimum object slice

006 implements only the cross-cutting kernel needed for safe vertical slices: Policy/Authority Grant, Principal/Subject Link/Assignment, Session, Task/Commitment, Goal/Milestone, Student Statement/Response, Source/Transcript/Evidence, Analysis Run/Proposal/Review, Publication/Item, Job/Outbox/Inbox, Lineage, and Audit. Attention, readiness, open loops, memory, snapshots, and notifications begin as deterministic projections over these records and become separate persisted objects only when lifecycle/scale evidence requires it. This avoids a nullable universal schema and premature table proliferation.

## Shared-consumer regression map

Any `server.mjs`, parser, auth, CSRF, static mount, middleware order, Supabase origin, or environment-name change requires route collision tests and smoke for all registered HQ consumers. Prefer MMC-local modules/config so Matrix, Scheduler, Calendar, Arena, STAT, RISE, StoryForge, File Vault, ACTN, Daily Drills, WordPress/LearnDash, email, payments, R2, Stream, and unrelated routes have zero diff.

## File scope gate

Architecture implementation commits must list intended file families before edits. `git diff --name-only` outside that list stops the run. Protected-path touches require a decision record before modification. Generated caches, media, credentials, environment files, screenshots with unrelated chrome, and Partner Demo-derived visuals are excluded.
