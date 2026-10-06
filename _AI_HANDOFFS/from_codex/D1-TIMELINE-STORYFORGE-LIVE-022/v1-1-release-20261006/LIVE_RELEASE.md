# Timeline Builder V1.1 — LIVE (2026-10-06, 23:12–23:16 UTC)

Founder authorization: V1.1 deployment of SHA acefa67 plus the item-4 consent-wording copy fix
(label only, focused test). Deployed source SHA: 18487406281ae12d58c82604746c12a07f4cde61
(= acefa67 + one copy commit). Timeline-only; API unchanged (ba12dd1b, health ok,
version timeline-3f40f10282b3c230); no shared Matrix asset writes; entitlement predicate untouched.

| Step | Receipt |
|---|---|
| Authority readback | PRODUCTION.md custody rechecked; production pointer releases/timeline-wp-44668d273914448c, runtime sha 107531d7…; four adapter files byte-identical to the candidate (only release.php changes) |
| Fencing | Canonical leases via the pinned engineering_os_lease library: PRODUCT:TIMELINE epoch 5203, plugin path 5204, evidence path 5205 (owner claude-timeline-v1-1-release-20261006); no conflicting active leases before; all three released 23:16:02 UTC and confirmed by canonical readback |
| Backup / restore boundary | tl022 private backup 022-20261006T231217Z-6d3dd343 (6 files + settings), BACKUP_VERIFIED, isolated restore rehearsal passed, live unchanged |
| Rollback target | releases/timeline-wp-44668d273914448c via tl022 rollback (admission off) from the same backup; install carried automatic compensation |
| Install | admission off → immutable install releases/timeline-wp-b36e4ca6fa172be4 (release.php sha 564bcfc4…; source release timeline-3ddc6235dc3be6fb) → INSTALLED_ADMISSION_OFF |
| Probe (read-only) | READ_ONLY_ENTITLEMENT_PASS: 20 eligible = 18 Founder + 2 course; real students 19, QA accounts 1; outside accounts denied 2; 8 admins excluded as subjects; unauthenticated admin denied; scoped admin allowed; admin roster 20 |
| Activate | eligible_360, timeline_enabled true, pointer releases/timeline-wp-b36e4ca6fa172be4; readback confirms |
| Unauthenticated HTTP | /timeline/ 303 to Matrix login; token 401; admin roster 401; API healthz ok |
| Production smoke (Founder admin session) | V1.1 bundle served (new consent copy, QA labelling); roster 20 with "19 real authorized students · 1 authorized QA account" and the QA row badged; ingestion of the authorized private test CV in the admin's ephemeral (non-persisted) workspace: correct applicant identity + AAMC, 36 items / 13 ready / 23 records / 0 attention, explicit institutions and month dates, electives/observerships classified, accept-section + bulk approve, axis 2025–2026, ten arrows in a down-right staircase, Guardian readability finding → Fix-for-me applied (H/O, HM, Research, Cards Res.) |
| Not re-run in production | Keynote round-trip (NOT RE-RUN FOR V1.1); student save/reopen, media slot fill, interview block editing and PDF/PPTX generation were verified on the hash-identical candidate build locally with the same CV; the admin workspace without a student subject does not expose the student canvas/export screens, and no real student document was used |

Student B quarantine: NOT PERFORMED. The only mechanism that satisfies all six requirements is a
soft-archive of the one document row in the isolated Railway PostgreSQL (status ARCHIVED,
deleted_at set, audit row, pre-image saved privately); the app exposes no archive route and a
named version would re-expose the artifact in the student's History. The direct database
channel was denied by this session's permission gate (production reads/writes over railway ssh /
psql), so it stops there — see ACTION REQUIRED in the final report. The document is unchanged
(Draft, 9 events, visible to the student).

Receipts: RELEASE_RECEIPTS.json here (file payloads stripped); private control directory
`.timeline-recovery-20261002/v1-1-release-20261006/` holds the operator, custody, keeper log and
full receipts.
