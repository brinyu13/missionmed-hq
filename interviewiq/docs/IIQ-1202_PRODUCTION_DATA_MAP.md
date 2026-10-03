# IIQ-1202 production data map

Freshly observed 2026-10-03 under DR-370. This is operational evidence, not a
replacement for the preservation invariant or a permanent claim about provider state.
Reverify before each release. Private row content and credentials are excluded.

## Actual authority and environment

| Component | Verified production authority |
| --- | --- |
| Database provider | Railway, project `missionmed-interviewiq-prod` / `b317b67c-78f2-4a0d-97a7-3421c18a375f` |
| Environment | `production` / `a3d3d5be-100e-4242-b441-d0922545c91e` |
| PostgreSQL service | `84ecd61e-e8c5-4f86-9aab-7d8c08fe1b40` |
| Engine/database | PostgreSQL `18.6 (Debian 18.6-1.pgdg13+2)`, database `railway` |
| Private endpoint | `postgres.railway.internal:5432` |
| Qualified maintenance proxy | `zephyr.proxy.rlwy.net:15943`; strict CA and private-host certificate verification |
| Schemas | `iiq`, owned by `iiq_owner`; `iiq_migrations`, owned by `postgres` |
| Persistent volume | `a064b82e-f6c1-4742-aa14-4484dcc842a4` / instance `1257e92d-b600-4f1d-a9a9-f763f310f7df` |
| Storage | `/var/lib/postgresql/data` mount, actual PG data `/var/lib/postgresql/data/pgdata`, us-west2; capacity 50,000 MB |
| API service | `7a9cbfe6-6e01-4155-b387-67babb90ee14`, no application volume; reads the separate PostgreSQL service |
| Public application | `https://missionmedinstitute.com/interviewiq/`, normal WordPress/Matrix authentication |
| Supabase | MissionMed lease/control authority only; not InterviewIQ's application database |
| Non-production | New per-run PostgreSQL18 clusters under `/tmp/iiq-pg18.*` or qualified `/tmp/iiq1202-restore-*`, Unix socket only; separate credentials and data |

The database is not browser local storage or an API container filesystem. The
approved production UI has no fixture engine/local domain persistence. API startup
does not seed, reset or migrate. The provider volume survives API redeployment.

## Roles, ownership and isolation

All 28 `iiq` base tables are owned by `iiq_owner` and have ENABLE + FORCE RLS.
`iiq_owner`, `iiq_authenticated` and `iiq_worker` are NOLOGIN, NOINHERIT,
NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE, NOREPLICATION.
`iiq_runtime` is LOGIN with the same restrictions and only the
`iiq_authenticated` membership: INHERIT false, SET true, ADMIN false.
The dedicated privileged migration identity is provider `postgres`; it can SET
`iiq_owner` and never belongs in the API/browser. The API explicitly SET LOCAL ROLE
and transaction-local verified actor context; logout/eligibility are checked by
the WordPress owner. No background worker is deployed.

Actual catalog: 58 policies; 35 foreign keys, 47 unique constraints, 29 primary
keys including the ledger, 126 checks and 287 PostgreSQL18 NOT NULL constraints.
All constraints are validated. Foreign keys have no delete cascade. Exact
constraint/policy/role definitions are in the privacy-safe catalog evidence.

Policies bind private rows to the current actor, permit only scoped logistics
reads for administrator/assigned mentor, and separate research/publication/consent
permissions. CORE server routes additionally exclude unfinished integration paths.
The actual effective runtime role has no DELETE or TRUNCATE on any `iiq` table.
Append-history/audit tables restrict updates through grants. Source qualification
also checks role, schema/table/function custody and forbidden privileges.

Fresh production read-only isolation testing qualified the real runtime role,
verified direct login reads denied (`42501`), checked both current owner contexts
against the other's interviews/history, and verified context cleared on rollback.
No fixture or production write was used for this test. Related events are currently
empty; populated-event isolation is separately exercised in disposable tests.

## Canonical IDs and relationship graph

`iiq.actors.id` is the stable UUID; `wp_user_id` is positive and unique. WordPress
persists `_missionmed_interviewiq_user_id`; a pre-existing valid uniquely owned
StoryForge UUID may be reused as identity without copying StoryForge content.
Fresh WordPress readback found two valid unique mappings, retained after QA
eligibility/session cleanup. Actor mapping consistency is checked with aggregate
hashes without publishing the identifiers.

`iiq.interviews.id` is a stable UUID primary key. Its required `owner_id` references
actors; `(id,owner_id)` is unique. Child rows bind `(interview_id,owner_id)` to that
pair, preventing cross-owner parents. Recording chunks/segments use composite
session/interview/owner keys. Research repairs preserve parent submission + owner
+ mission; review, credits and access grants use owner-scoped relationships.

Interview scheduling preserves local date, local time, timezone, UTC start instant,
DST fold and date-only/unknown semantics as separate checked fields. Application
versions do not generate replacement IDs on reload. Optimistic versions, request
idempotency and actor-scoped write transactions protect against stale/duplicate edits.

## Protected table inventory

| Data group | Tables |
| --- | --- |
| Identity and calendar | `actors`, `interviews`, `related_events`, `interview_history` |
| Research/preparation/practice | `research_demands`, `preparation`, `practice_attempts`, `learning_signals`, `mentor_gaps` |
| Recording/debrief | `recording_sessions`, `recording_chunks`, `speech_segments`, `debriefs`, `followups` |
| Consent and contributed research | `consents`, `research_missions`, `research_submissions`, `review_items`, `shared_reports`, `contribution_credits`, `access_grants` |
| Audit, ordering and delivery | `revisions`, `request_idempotency`, `audit_events`, `outbox_events` |
| Governed policy and mentor state | `policies`, `policy_authorities`, `mentor_notes` |
| Migration custody | `iiq_migrations.applied` |

At the consistent backup snapshot: 2 actors, 3 interviews, and 9 rows each in
interview history, audit events, revisions and request idempotency. Other 22 domain
tables are empty. One migration is applied. These are counts, not a claim that real
students have started using every feature. Retained production QA records are
protected too. A populated future table inherits this contract automatically.

Cancellation/restoration updates lifecycle state and appends history/audit; it is
not deletion. Reschedules append prior/current date, UTC instant and timezone to
history; this is not a complete archive of every prior field value. No deployed runtime
hard-delete/reset route exists. Legitimate privacy deletion requires its separate
authorized retention workflow; this mission implements no such destructive path.

## Migration and release custody

Applied migration: `20261003042028_iiq_1200_initial.sql`, SHA-256
`f4b546469c3830388a11c1b9bb7b59f30c477759598e3bbff3b774a246215edf`.
The ledger is `iiq_migrations.applied(name,sha256,applied_at)`, with name primary
key and checksum constraint. Initial SQL/bootstrap remain immutable. The runner
uses a dedicated connection, exact independent target/hash review, advisory locking,
and transactional SQL + ledger insertion; IIQ-1202 strengthens the preservation gate.

Starting repository: `brinyu13/missionmed-hq`, branch
`codex/iiq-1200-interviewiq-production`, HEAD
`538e97fb13b268683ebacc39d2e80cf551b11b5b`, independently read back on GitHub.
Worktree: `/Users/brianb/.codex/worktrees/iiq-1200-production/interviewiq-1000`.
Only pre-existing untracked IIQ-1200 handoffs were present before this mission.

Live starting API deployment: `7ecda6b1-c2cb-4cdc-a8eb-cf82c628cb48`, image
`sha256:29e6930266a5a8109bf86315f0d7a3b1ad24b2d253a3af89f17aa178fbfe40f0`,
health release `df7d051d996f6c5cb1f0a787a3eec4a03e91afec`.
This differs from repository HEAD because later commits repaired WP/assets/CSP;
it is not silently presented as the same deployed SHA. PG current deployment is
`c6d31a80-26cb-4b78-9700-1d111867fbdb`, image
`sha256:4b89e3c89d9262f02f23e927ff9f1390a19f7c03e2483321bc05c30872a333a3`.

Fresh WP file hashes: SSO `bb873be2a3ec7228c88e0e169991f6e6691d9aa0d391ca78b7733fe8e390034e`;
route `1b56ef9becc270380ecb50ddf96b900d4e3aaf6a437b63c394ab3064c5ecfba6`;
Matrix entry `32883a9008002dc4d9096f9e33b3fbd9c8804e966a2821b76ecab81a2e156530`.
UI pointer: `releases/bf63d89e0a1c021cbc638397a0a5d4755cad421ca9a4d4cf0c83f9fbf5bf6bc8`.
Guest browser access correctly redirects to normal WP login. No current-session
browser acceptance is inferred merely from those hashes; prior launch evidence and
fresh preservation tests are identified separately in the final receipt.

## Actual backup configuration and recovery

Initial live provider readback showed **no backup schedules, no volume snapshots,
PITR disabled/bucket not wired**, and PostgreSQL `archive_mode=off`. The earlier
885-byte pre-migration empty dump did not protect current populated data.

IIQ-1202 enabled and read back three schedules on the exact existing volume:

| Schedule | Provider retention | Current provider schedule ID |
| --- | --- | --- |
| Daily | 518,400 seconds / 6 days | `94a8948f-3525-4f03-96cc-cb12782ebdc0` |
| Weekly | 2,332,800 seconds / 27 days | `bf2c8f5e-d6e8-45a1-95be-252b78728967` |
| Monthly | 7,689,600 seconds / 89 days | `63265638-3965-44c1-83df-749d5836436b` |

Current manual snapshot `1eb771f8-d68f-4913-ba09-b81168771a5b` was created
2026-10-03T17:19:46.833Z; provider `expiresAt=null`, referenced size 866 MB.
It covers the mounted PostgreSQL volume, not the separate WordPress database.
Provider snapshots remain in Railway's service/environment backup custody; no
physical external backup location or encrypted-storage attestation was inspected.
PITR remains disabled and no continuous-WAL recovery is claimed.

Daily scheduled-backup RPO is approximately 24 hours if jobs succeed; the schedule
has been verified but future scheduled runs have not yet occurred. This is not a
promise of zero loss after arbitrary infrastructure disaster. Each schema-changing
release additionally requires its fresh verified recoverable backup. Snapshot RTO
has not been measured and no provider production-recovery SLA is claimed.

A separate full custom-format logical dump was captured through strict TLS using
the same exported read-only snapshot as the source fingerprints. Successful copy:
`interviewiq-current-2026-10-03T172020732Z.dump`, 196,249 bytes, SHA-256
`80e1661f752940dafebed691b3aeb3d67670d68a68bb498156d4810130f6d0ae`.
Private custody: `/Users/brianb/MissionMed_AI_Sandbox/_ACTIVITY_LOGS/CODEX/IIQ-1202/backup/`
(directory0700, files0600). It is outside Git and retained until an explicitly
authorized retention decision. Local filesystem encryption was not attested.

Safe restore PASS: fresh local PostgreSQL18 socket-only target, roles/memberships
recreated without passwords, all 29 domain/ledger tables restored, every count and
full-row aggregate fingerprint equal, zero orphan interview/event/history rows,
zero unvalidated constraints, unchanged migration ledger, local server stopped.
Receipt: `PRESERVATION_EVIDENCE-2026-10-03T172020732Z.json` in private backup custody.
The measured capture-plus-local-restore drill took 28.516 seconds; this is not a
production disaster-recovery RTO, which also requires infrastructure, credentials,
reconciliation and an authorized cutover.
The first attempt produced a valid separate dump but failed local PG startup due
to macOS locale initialization; its INCOMPLETE receipt is retained. The reviewed
local-only `LANG=C,LC_ALL=C` repair enabled the successful rerun.

No provider snapshot was restored over production. Railway's documented volume
restore stages a replacement mount and redeployment; that destructive production
cutover is outside this mission. The provider docs differ on handling newer backup
history during restore, so this is not relied on. Recovery must first inspect the
current provider contract and use a separate isolated destination. The tested
logical restoration is the verified recovery path for this gate. Only Founder-
authorized operators holding current protected credentials and exact leases may
perform an actual production recovery; possession of credentials alone is not authority.

## Rollback and remaining verification

Application rollback changes only the API image/config or immutable WP/UI pointer,
retaining the live PG volume, schema and ledger. Startup has no migration/seed hook.
Use a previously qualified compatible app; do not reinstall a known-broken asset
package. Database restore is separate emergency recovery and requires the destructive
change protocol. Local forward-schema/old-app/UI tests and live restart preservation
are recorded independently in the final IIQ-1202 acceptance receipt.

WordPress remains the canonical auth/eligibility/identity owner. Its ordinary
platform backups and broader restoration were not reconfigured or certified by
this bounded PG mission. Preserve the user-ID/UUID mapping and coordinate a separate
WP disaster recovery with the owner; the IIQ PG dump includes actors and their
stable WP bindings but not WordPress accounts, sessions or secrets.


## Final IIQ-1202 verification

Independent verification reached **DATA_PRESERVATION_GATE_VERIFIED**, all 14
Founder criteria, on 2026-10-03. API source
`0d67338b1398b4800516aab02adbd73efef2422e` deployed as
`f29e040c-d550-4d38-87f1-8b4f5bab1246`, image
`sha256:a9db4974256841befeb3044ae6c9c720b879c966613d77e2db6f7cd73b58b5b9`.
All 27 runtime/package hashes and readiness matched the approved source. The sole
runtime behavior change rejects effective DELETE privilege drift; no production
migration, UI, auth or integration activation occurred. All 28 application-table
full-row fingerprints matched initial, predeploy and postdeploy observations; the
full migration-ledger row, including applied_at, matched the populated backup.
Fresh postdeploy read-only isolation passed five groups, and the independent
disposable preservation run passed 89/89 checks, including all A-O gates.

The final independent receipt is
`_AI_HANDOFFS/from_codex/IIQ-1202/evidence/FINAL_14_GATE_INDEPENDENT_VERIFICATION.json`,
SHA-256 `f1004b98688f21d5dd63d2a003965573d4fec9a112ffff2285ac5be2e0c3c168`.
Earlier CORE authenticated reload/new-session proof is separate; no new production
login or visual/device acceptance is claimed. PITR remains disabled; WordPress
disaster recovery, provider snapshot restoration and prior-image redeploy
availability remain unverified. No production rollback occurred. This documentation
addendum does not change the deployed API source or enable unfinished integrations.
