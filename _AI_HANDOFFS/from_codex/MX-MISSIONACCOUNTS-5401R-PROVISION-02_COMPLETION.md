# MX-MISSIONACCOUNTS-5401R-PROVISION-02 Completion Report

Date: 2026-09-10
Mission: `MX-MISSIONACCOUNTS-5401R`
Authority: DR-220 / DR-221
Baseline PROVISION-01 commit: `884b02b0f1906e0b2056cfcbdb81c92390021d7a`
PROVISION-02 source/evidence commit: `26443a2879eb5c6ee1e054b5adc94db7481b8080`

## Outcome

PROVISION-02 safely resolved and provisioned five more ordinary/direct attendance students. Three existing WordPress accounts were reused and two minimum subscriber accounts were created. All five now have one exact `_missionmed_missionaccounts_user_id` link and add-only LearnDash course 6357 access. The production apply and replay were bounded by named `SHARED:AUTH` and `SHARED:ENTITLEMENTS` leases. Replay created zero accounts and left the five-row provider snapshot unchanged.

The deeper reconciliation reduced the unresolved identity population from 107 to 102. Seven rows have plausible but non-authoritative middle-name, reversed-name, or discrepant-email evidence and remain for manual review. Ninety-five have no valid roster match in the available authoritative sources. No weak fuzzy match was applied.

The 17 known UCC/MUL rows remain held. The live schema supports cycle-level `ucc` and `mul` zero-dollar billing decisions and charge rejection, but it has no durable student-level sponsor/direct-billing exclusion. DR-220/221 expressly prohibit DDL and production runtime deployment, so those controls cannot be implemented under current authority.

## Required status

BASELINE PROVISION-01 COMMIT: `884b02b0f1906e0b2056cfcbdb81c92390021d7a`

TOTAL EFFECTIVE ATTENDANCE TARGETS: 174
PREVIOUSLY READY ORDINARY: 50
PREVIOUSLY HELD UCC/MUL: 17
PREVIOUSLY UNMATCHED: 107

107 UNMATCHED RESOLUTION:

- RESOLVED HIGH CONFIDENCE: 5
- EXISTING WP FOUND: 3
- NEW WP NEEDED: 2, both created and now ready
- REVIEW REQUIRED: 7
- NO VALID ROSTER MATCH: 95
- TECHNICAL/DUPLICATE/RETIRED: 0

TOTAL MATCHED AFTER PROVISION-02: 72 / 174
TOTAL WP ACCOUNTS REUSED: 40
TOTAL NEW WP ACCOUNTS CREATED: 15
TOTAL COURSE 6357 READY: 55
TOTAL MISSIONACCOUNTS LINKS VERIFIED: 55

UCC/MUL DURABLE SPONSOR EXCLUSION: BLOCKED
UCC READY / $0: 0
MUL READY / $0: 0
ORDINARY/DIRECT READY: 55

STUDENT BROWSER ACCEPTANCE: PARTIAL
EMAIL LOGIN: PARTIAL
INVITATIONS STILL REQUIRED: 15
INVITE MANIFEST: CREATED

SPREADSHEET-ONLY NON-ATTENDEES MUTATED: 0
ZOOM: OFF
AUTO BILLING: OFF
NOTIFICATIONS: OFF
LIVE MONEY MOVED: $0.00
REPLAY IDEMPOTENCY: PASS

FULL SAFELY IDENTIFIED ATTENDANCE POPULATION CAN REACH OWN BILLING: PARTIAL
REMAINING EXCEPTIONS: 119 total — 17 matched sponsored students awaiting a durable exclusion, 7 manual identity reviews, and 95 identities with no valid roster match.

NEXT:

1. register the narrow sponsor-control authority described below;
2. authorize and send secure password-set invitations for the 15 new accounts;
3. complete genuine student browser acceptance for an ordinary existing user, one invited new user, one UCC user, and one MUL user after sponsor provisioning;
4. resume 5403 only after these gates are closed.

## Identity evidence and decision rules

The run reused the unchanged Founder workbook SHA-256 `634ad89acb8e4ece30b611ff57bd107163c4b2e9a3d8829068527a62d5762f32` and a fresh live database snapshot. The fresh snapshot retained the same 174 target student IDs and the same 1,923 effective June-August event IDs as PROVISION-01.

The resolver evaluated canonical MissionAccounts identity, verified stored aliases, effective attendance source names, exact WordPress links, WordPress email/name evidence, workbook primary/alternate emails, exact normalized names, first/last keys, and token-order variants. Only two evidence combinations were automatically accepted:

- one exact verified MissionAccounts alias resolving to one workbook row; or
- one exact attendance/WordPress name together with a WordPress email resolving to that same unique workbook row.

Middle-name omission, reversed token order, conflicting/discrepant email, multiple candidates, and name-only evidence remained review-only. Stored historical attendance payloads were checked for participant email evidence; they contained the same host email on the relevant rows and no usable participant-email match.

## Production writes and readback

The five AUTH targets were preflighted together. The batch created two subscriber accounts with secure random internal passwords, reused three existing accounts without changing their credentials, suppressed new-user/admin WordPress notifications and `wp_mail`, and wrote exactly five user-meta links. No password or reset token entered output or evidence.

The five entitlement targets were then read back by WordPress ID and enrolled add-only in `Dr J, Drills On-Call`, course ID 6357. Final readback showed five unique WordPress IDs, five exact links, and five course-access confirmations.

The replay used the post-apply plan. It created zero accounts and the target snapshot before and after replay was byte-equivalent as parsed JSON. All PROVISION-02 leases were released; a final provider query returned zero active matching leases.

## Sponsor-control governance gap

A new narrow decision record is required to authorize all of the following exact additions:

- an audited, effective-dated student sponsor classification with `DIRECT`, `UCC`, and `MUL` states;
- a durable direct-billing exclusion enforced before billing-decision generation, manual charge creation, and automatic-billing dispatch;
- a safe bootstrap/admin projection of sponsor and zero direct liability;
- an additive migration, the corresponding bounded runtime changes, isolated deployment, rollback, and UCC/MUL browser acceptance;
- the 17 exact sponsor assignments from the authoritative workbook under row-scoped leases.

The implementation must preserve attendance, historical ledger rows, saved cards, Matrix access, and LearnDash access. It must never manufacture zero liability by deleting financial history.

## Browser and live-service acceptance

A genuine Dr J/Admin Chrome session loaded `https://missionmedinstitute.com/missionaccounts/`. It rendered `MyMissionMed Account`, the ExamPrep context, Dr J/Admin navigation, and the safe-production status stating automatic billing, Zoom sync, and notification delivery were disabled. No wrong-role flash was observed after bootstrap.

No genuine student principal was available after provisioning. Admin Student Preview was not substituted. Existing-student, new-invite, UCC, MUL, and registered-email-login acceptance therefore remain `PARTIAL`/human-gated.

Final live checks:

- Railway `/api/health`: HTTP 200, approximately 0.17 seconds.
- Matrix `/missionaccounts/`: HTTP 200, approximately 1.12 seconds.
- `Cache-Control`: `no-store, private`.
- `CDN-Cache-Control`: `no-store`.
- `Surrogate-Control`: `no-store`.
- `CF-Cache-Status`: `DYNAMIC`.
- `X-Kinsta-Cache`: `BYPASS`.
- Railway flags: `MISSIONACCOUNTS_AUTO_BILLING=0`, `MISSIONACCOUNTS_ZOOM_SYNC=0`, `MISSIONACCOUNTS_NOTIFICATIONS=0`.

## Artifacts

Owner-only evidence directory, mode `0700`:

`/Users/brianb/MissionMed_private_evidence/MX-MISSIONACCOUNTS-5401R-PROVISION-02/`

Primary owner-only outputs, each mode `0600`:

- `unmatched_resolution.json` — 107 rows — SHA-256 `1e9f052ce3a91ab080acf2b068bb8d59436b87ec7d8217e3a18ec3f39aaf8739`
- `unmatched_resolution.csv` — 107 rows — SHA-256 `93b7952a8127120f9455fabed138c100f57db5965e9ea9890fba19566a0ba0fc`
- `final_reconciliation.json` — 174 rows — SHA-256 `4cad5d891c2a263e63add2cf0f590623a70c1a6d63d295be771ba2b2e291b287`
- `invite_ready_manifest.csv` — 15 rows — SHA-256 `9fa30769c1b1716859a14615ac1b07a8201b0d9293306176f36d6a08e0e89413`
- `MX-MISSIONACCOUNTS-5401R-PROVISION-02_FOUNDER.csv` — 174 rows — SHA-256 `6c225ae9653ddc483807a869f987b64341267af8c5fd7ff0b265970bd3590aaf`

The invite manifest contains no password or reset-token column. No email was sent.

Sanitized committed evidence:

- `_AI_HANDOFFS/from_codex/MX-MISSIONACCOUNTS-5401R-PROVISION-01/PROVISION-02_README.md`
- `_AI_HANDOFFS/from_codex/MX-MISSIONACCOUNTS-5401R-PROVISION-01/provision02_reconciliation.json`
- `_AI_HANDOFFS/from_codex/MX-MISSIONACCOUNTS-5401R-PROVISION-01/provision02_unmatched_resolution.json`

## Validation and deviations

Four focused PROVISION-02 unit tests passed; the preserved PROVISION-01 test module passed; both WordPress PHP scripts linted successfully; Git diff checks passed; source and evidence were pushed non-force and the remote ref matched commit `26443a2879eb5c6ee1e054b5adc94db7481b8080`.

The first read-only 107-candidate WordPress snapshot process segfaulted in WP-CLI after existing early-translation notices. It produced no result and performed no writes. Immediate checks showed the site root, Matrix route, and Railway origin remained healthy. The run switched to the 12-row deterministic candidate subset; that bounded read completed successfully.

One final one-line reporting fix was copied into the isolated uncommitted worktree before its replacement PATH lease was acquired. The exact reviewed bytes were immediately rewritten under the correct path lease before staging or commit. No production or provider target was involved. All provider mutations were fenced normally.

No schema, Supabase data, Railway configuration, Stripe object, Zoom object, workbook row, billing decision, charge, payment method, or notification was changed by PROVISION-02.
