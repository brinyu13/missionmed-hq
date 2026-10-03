# IIQ-1202 data preservation gate

RESULT: **DATA_PRESERVATION_GATE_VERIFIED**. Independent verification passed all
14 Founder acceptance criteria. This closes the bounded safety gate, not IIQ-1200.

## Production and deployed custody

Railway project `missionmed-interviewiq-prod`, PostgreSQL18.6 database `railway`,
schemas `iiq` and `iiq_migrations`, persistent volume
`a064b82e-f6c1-4742-aa14-4484dcc842a4`. WordPress remains the canonical identity
and eligibility owner; Supabase is the lease/control authority only.

All existing and future InterviewIQ user/admin data is protected, including retained
production QA records, stable UUIDs and ownership, schedule/timezone/DST fields,
related events, lifecycle/history, privacy/consent and future research/debrief data.

API source `0d67338b1398b4800516aab02adbd73efef2422e`; deployment
`f29e040c-d550-4d38-87f1-8b4f5bab1246`; image
`sha256:a9db4974256841befeb3044ae6c9c720b879c966613d77e2db6f7cd73b58b5b9`.
Independent SSH readback matched all 27 runtime/package files, and readiness
reported the exact new source. The only runtime behavior change rejects an unsafe
effective DELETE privilege. No production migration, frontend, auth or integration
activation occurred. Production dependency versions remain unchanged.

All 28 application-table full-row fingerprints matched initial, predeploy and
postdeploy observations. The full migration-ledger row, including `applied_at`,
matched the current-data backup. The API restart preserved all observed records.
Five fresh read-only production isolation check groups passed. No production
user/admin or retained synthetic data was deleted, reset or rewritten.

## Backup and restore

Provider readback verified daily/weekly/monthly schedules with 6/27/89-day retention
and current manual snapshot `1eb771f8-d68f-4913-ba09-b81168771a5b`.
PITR remains disabled. Daily RPO is approximately 24 hours if scheduled jobs succeed;
future scheduled executions have not yet been observed. This is not a claim of
zero-RPO infrastructure disaster recovery.

A current consistent custom-format logical dump was restored into a new private,
socket-only PostgreSQL18 cluster. All 29 domain/ledger table counts and complete-row
hashes matched; IDs, ownership and history were preserved; relational checks found
zero orphans or unvalidated constraints. The isolated server was stopped.
Dump SHA-256: `80e1661f752940dafebed691b3aeb3d67670d68a68bb498156d4810130f6d0ae`.
The private dump remains outside Git under the IIQ-1202 backup controls directory.
No provider snapshot was restored over production. Broader WordPress disaster
recovery and provider snapshot restoration were not certified by this mission.

## Migration, rollback and test protections

The permanent policy is expand, backfill, compatible reads/writes where needed,
verify, cut over, observe, then contract only with a reviewed retention decision and
required separate authorization. Applied migration/bootstrap bytes are immutable.
Future schema changes require actual current backup and isolated restore evidence.
Destructive or unknown operations stop for exact affected-data inventory, rationale,
alternatives, verified backup/restore, repair plan, isolated dry run and explicit
Founder authorization. General permission to finish InterviewIQ is insufficient.

Production fixture/reset paths refuse before connection. The qualified disposable
PG18 harness rejects production context, remote/ambiguous URL destinations, inherited
libpq routing and credentials, and unqualified local cluster identities. The
migration runner rejects transaction escapes, weak transport, unsafe bootstrap,
changed applied history, incomplete recovery receipts and unbound destructive
authorization materials. Privileged operators remain bound by actual human authority;
JSON approval files do not create consent by themselves.

Application rollback preserves the current database and newer entries. The frozen
previous runtime was tested against the expanded schema and newer records. No
production rollback occurred; prior provider image redeploy availability was not
verified. If that image is unavailable, rebuild the exact compatible source through
the reviewed application release path. Never restore an older database as routine
application rollback.

## Exact final test counts

| Final run | Passed | Failed |
| --- | ---: | ---: |
| Builder preservation, including all A-O gates | 89 | 0 |
| Separate inherited regression checks | 257 | 0 |
| Independent repeat of preservation suite | 89 | 0 |
| Independent adversarial and entry-point denial probes | 83 | 0 |
| Fresh postdeploy production read-only isolation groups | 5 | 0 |

The independent 89 checks repeat the preservation suite and are not 89 additional
unique product cases. Earlier failed setup/rehearsal receipts are retained; final
bare commands pass with pinned development dependencies. UI compatibility uses the
approved application in JSDOM with real local migrated data. Earlier CORE
authenticated reload/new-session evidence is separate; no new production browser
login or visual/device acceptance is claimed here.

## Durable authority and next work

Required repository artifacts are `interviewiq/AGENTS.md` and:

- `interviewiq/docs/IIQ_PRODUCTION_DATA_PRESERVATION_INVARIANT.md`
- `interviewiq/docs/IIQ-1202_MIGRATION_SAFETY_CONTRACT.md`
- `interviewiq/docs/IIQ-1202_PRODUCTION_DATA_MAP.md`

Canonical OS authority is DR-370 and
`handoffs/from_codex/IIQ_1202_PRESERVATION/IIQ_PRODUCTION_DATA_PRESERVATION_INVARIANT.md`.
Mission/passport/BOOT routing and Brain `products/interviewiq.md` plus generated
`packs/interviewiq.pack.md` require future task inheritance. The exact 14-gate verdict
is in `evidence/FINAL_14_GATE_INDEPENDENT_VERIFICATION.json`, SHA-256
`f1004b98688f21d5dd63d2a003965573d4fec9a112ffff2285ac5be2e0c3c168`.

State delta: backup schedules/current snapshot, actual current-data restore proof,
guarded migration/test tooling, minimal API privilege guard, automated preservation
tests, permanent authority and final independent evidence. Constitution delta:
product intent unchanged; a permanent operational data-safety invariant was added.
IIQ-1200 may resume within its existing scope after final authority filing, with
this invariant and every future release gate intact. No unfinished integration is
enabled by this closure.

## Operational exceptions retained

Local keeper processes ended during the mission; the cause was not established.
Provider readback confirmed expiry, and affected protected work paused for normal
reacquisition. API deployment completed before its provider lease expired.

During final filing, source CHECK returned KEEPER_CONTROL_UNAVAILABLE, but the
Foreman's same orchestration call then copied two already-redacted receipts:
`PRODUCTION_POSTDEPLOY_BASELINE.json` and
`PRODUCTION_POSTDEPLOY_READ_ONLY_RLS.json`. This was a local evidence-write control
lapse. The receipts were retained and disclosed to the independent verifier. No
database, API or product code was changed by those copies. Subsequent protected
writes must require a successful READY check before execution. No forced release,
nonce reuse or production reset was used to recover control.
