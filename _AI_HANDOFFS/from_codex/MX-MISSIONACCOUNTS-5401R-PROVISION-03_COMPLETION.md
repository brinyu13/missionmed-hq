# MX-MISSIONACCOUNTS-5401R-PROVISION-03 — Completion Report

**Date:** 2026-09-10
**Status:** BOUNDED PASS WITH EXPLICIT HOLDS
**Authority:** DR-220 / DR-221 plus the Founder PROVISION-03 practical roster-matching steer
**Source branch:** `codex/mx-missionaccounts-5401r`
**Implementation commit:** `503ee3766671198e8f06b8d0f765c1605144820e`
**Live-money authorization used:** `$0.00`

## Outcome

PROVISION-03 re-evaluated all 102 PROVISION-02 unresolved attendance identities against the unchanged Founder workbook and a complete, stable 931-user WordPress evidence snapshot. It resolved 52 attendance identities, reduced the unresolved set to 50, represented 114 distinct roster humans, and made 111 of those humans provider-ready with one exact WordPress account, one exact MissionAccounts link, and LearnDash course 6357.

The run created 25 WordPress accounts with secure random internal credentials, linked 18 existing accounts, and added course 6357 to 53 accounts. No invitation email was sent. Three affirmative WordPress identity conflicts remained held.

Ten attendance aliases were consolidated into eight canonical roster people through the existing MissionAccounts identity-adjudication API. Eight decisions were accepted. Immediate replay returned eight duplicate acknowledgements and created no additional decision. Raw attendance evidence remained preserved.

One canonical person in the consolidated set was already a member of a separate unresolved identity cluster that predates PROVISION-03. The adjudication engine correctly changed that canonical identity to `needs_review`, withholding nine effective events from the verified-student provisioning projection. The events remain preserved. The separate cluster was not adjudicated because it was outside the 102-row scope and lacks a human decision. The linked MyMissionMed account and course access remain intact, while billing actions for that identity fail closed pending review.

## PROVISION-02 STARTING STATE

- Total attendance identities: 174
- Previously matched: 72
- Previously unresolved: 102
- Previously ordinary ready: 55
- Previously UCC/MUL held: 17

## PROVISION-03 PRACTICAL RECONCILIATION

- Auto-matched unique close names: 25
- Auto-matched reversed names: 0
- Auto-matched unique first names: 16
- Auto-matched unique last names: 1
- Auto-matched known aliases: 0
- Auto-matched by existing WordPress evidence: 0
- Existing WordPress accounts newly linked in this run: 18
- Aliases collapsed into already-matched humans: 10
- New real humans identified: 42
- Formerly unresolved identities resolved: 52
- True ambiguities remaining: 11
- Nonhuman/insufficient identities remaining: 39
- Total unresolved after PROVISION-03: 50

The five concrete Founder examples all scored at or above the authorized matching threshold in focused tests. Matching normalized Unicode and accents for comparison, punctuation, whitespace, title/suffix noise, token order, omitted middle or surname tokens, minor spelling errors, and unique single-name candidates. Verified identity, account, and email contradictions remained hard negatives.

## REAL HUMAN POPULATION

- Distinct real roster humans represented by the 174 attendance identities: 114
- Resolved attendance identities represented: 124
- Attendance identities collapsed as aliases/duplicates: 10
- Unresolved attendance identities: 50

The 174 source identities therefore no longer represent an assumed 174-person population. The evidence supports 114 roster people, 10 additional aliases of those people, and 50 rows that remain unresolved.

## PROVISIONING

- Total ordinary/direct humans ready: 80
- Total sponsored humans provider-ready: 31
- Total humans provider-ready: 111 of 114
- WordPress accounts present before PROVISION-03 among the final ready population: 86
- Existing WordPress accounts newly linked in PROVISION-03: 18
- New WordPress accounts created in PROVISION-03: 25
- New WordPress accounts created cumulatively through PROVISION-03: 40
- Course 6357 ready: 111
- MissionAccounts links verified: 111
- Unique WordPress IDs across the 111 ready humans: 111
- Duplicate WordPress IDs: 0
- Invitations required cumulatively: 40
- Invitations sent: 0
- Provider replay pending actions: 0 account/link operations and 0 enrollment operations

The exact live readback found 111 of 111 expected WordPress users, 111 exact `_missionmed_missionaccounts_user_id` values, and 111 course-6357 entitlements. All seven PHP runs exited successfully. Their stderr contained the same pre-existing WordPress translation-loading warnings, with zero fatal errors and zero segmentation faults.

Individual real-student browser acceptance remains partial. This report distinguishes provider-ready account/link/course proof from a genuine authenticated browser witness for every student.

## SPONSORED

- UCC roster humans resolved: 25
- UCC provider-ready: 24
- MUL roster humans resolved: 7
- MUL provider-ready: 7
- Sponsor runtime control pending: 32
- Sponsored account conflict holds: 1
- Direct live charges created for sponsored students: 0

Sponsored users received identity/account/course provisioning where the existing authority allowed it. No direct-liability record, charge, scheduled charge, hosted invoice, or sponsor-runtime migration was created. `SPONSOR_RUNTIME_CONTROL_PENDING` remains the billing treatment for all 32 sponsored humans.

## REMAINING

### Genuine manual identity reviews: 11

- `8acf41a5-d784-59b6-bf73-8eb6d8dc0432` — two similarly plausible candidates; score gap 0.036.
- `a8c0d177-3473-54ea-8256-72d0c260003b` — an existing active identity-merge component conflicts with the otherwise unique first-name candidate.
- `544bfe95-9b79-5543-a590-d505e1a994c2` — two candidates tie at 0.970 on first-name and surname-root evidence.
- `39bec4b6-6d52-55cf-9865-b952b7e62ac4` — edit similarity remains below the practical auto-match threshold.
- `86d14bc9-0687-58f9-9d02-49e7035986c0` — edit similarity remains below the practical auto-match threshold.
- `c10de8d3-dbd1-557b-9bcc-6670cbb6e8aa` — edit similarity remains below the practical auto-match threshold.
- `9fa76455-b0a9-5e29-ad78-39ebfb47f37f` — two similarly plausible candidates; score gap 0.043.
- `4fd7c9a5-4014-5152-8fcc-290ac8417c1e` — insufficient name similarity for a safe unique person decision.
- `7732037f-4573-5400-81e0-8abeae830b84` — two similarly plausible candidates; score gap 0.024.
- `6ae96527-d2a8-52f8-b44b-fae0a99a4c44` — insufficient name similarity for a safe unique person decision.
- `142b08bb-9643-550c-acac-29a8030c7e02` — two similarly plausible candidates; score gap 0.047.

### Nonhuman or insufficient identity rows: 39

- 23 non-unique single-token identities.
- 15 weak edit-similarity rows below the safe candidate threshold.
- 1 blank or unusable identity.

### WordPress account conflicts: 3

- Workbook row 6 — the roster email resolves to a WordPress account linked to a different MissionAccounts student.
- Workbook row 17 — multiple WordPress accounts use the roster email.
- Workbook row 131 — an already-linked WordPress account has an email that contradicts the roster.

No conflicting link, account, or enrollment was overwritten. Two conflicts affect direct students and one affects a UCC student.

### Separate pre-existing identity hold: 1

One provider-ready canonical human is also in a different pre-existing open identity cluster. This hold affects verified billing/attendance projection, not the exact WordPress link or course entitlement. It requires a separate human adjudication and was not guessed within PROVISION-03.

## SYSTEM STATE

- Spreadsheet-only non-attendees mutated: 0
- Workbook writes: 0
- WordPress users examined in stable full sweep: 931
- Source workbook SHA-256: `634ad89acb8e4ece30b611ff57bd107163c4b2e9a3d8829068527a62d5762f32`
- Zoom: OFF
- Auto billing: OFF
- Notifications: OFF
- Live money moved: `$0.00`
- Charges created after PROVISION-03 began: 0
- Invoices created after PROVISION-03 began: 0
- Student contact changes created: 0
- Replay idempotency: PASS
- Railway health: PASS (`HTTP 200`, `Cache-Control: no-store, private`)
- Matrix `/missionaccounts/`: PASS (`HTTP 200`, `X-Kinsta-Cache: BYPASS`, `CF-Cache-Status: DYNAMIC`, `Cache-Control: no-store, private`)
- Matrix `/missionaccounts/api/health`: PASS with the same private/non-shared cache controls
- Current app healthy: PASS
- 5403 Zoom/automatic billing work: DEFERRED

## FOUNDER GOAL

- Safely identifiable roster humans with provider-ready Matrix/MyMissionMed access: 111 / 114
- Identified humans blocked by exact WordPress conflicts: 3
- Provider-ready humans with a separate pre-existing billing identity hold: 1
- Remaining unresolved attendance identity rows: 50

The operational access numerator is provider-verified. Complete one-by-one real-browser acceptance for all 111 accounts remains a separate human-session task.

## Evidence and provenance

Private evidence directory:

`/Users/brianb/MissionMed_private_evidence/MX-MISSIONACCOUNTS-5401R-PROVISION-03`

- `provision03_match_crosswalk.csv` — 102 formerly unresolved identities; SHA-256 `1c633f8cc42daa4709a1784eb29128b95d9970a53ae473f0c686ee22c2283711`
- `provision03_match_crosswalk.json` — full private crosswalk; SHA-256 `1506132dce689c46101f98e0b279357066ac85976c72d3285bacd6ab70ffbd00`
- `MX-MISSIONACCOUNTS-5401R-PROVISION-03_FOUNDER.csv` — 174 attendance rows; SHA-256 `31dfe2e612cc857bc6f91a597cc098a5a886bbb47b154b899d94e3e35ef23c07`
- `invite_ready_manifest.csv` — 40 cumulative invite-ready accounts; SHA-256 `709632b3527c3138e30ea6eac4b068872841a50c00b076d6265dc2f0140b529c`
- `provision03_final_plan.json` — final private provider state and explicit identity hold; SHA-256 `75b7584b1413a316706f14e8c1057f36ed074ed57afe30ed0d6202693ed64ef8`
- `wp_final_readback.json` — exact 111-row provider readback; SHA-256 `ede024cf0f923e8d0d5641a45e2a63937f05d796f62fac3307bb525624d0c66e`

All CSV files are mode `0600`, contain no password, reset-token, API-key, or secret columns, and passed formula-injection checks. No credential or secret value was written to source, evidence, chat, shell output, logs, screenshots, or handoffs.
