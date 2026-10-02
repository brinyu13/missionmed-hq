# USCE Phil-first renovation release board

Mission: `USCE-PHIL-FIRST-RENOVATION-20261002` (provisional; unregistered).
Product: USCE Offer System / MissionMed Clinicals HQ.
State: **WAITING_AUTHORITY**. R0 evidence gathering only; R1–R3 remain NOT_STARTED.
Updated: October 2, 2026, America/New_York.

## Execution and custody

- Assigned worktree: `/Users/brianb/MissionMed_worktrees/usce-phil-first-renovation-20261002`.
- Branch: `codex/usce-phil-first-renovation-20261002`; upstream `origin/main`.
- Starting HEAD and refreshed origin/main: `0feee579b0a9f2c90529220899f6cf6d21b8cd05`.
- Repository: `https://github.com/brinyu13/missionmed-hq.git`.
- Starting worktree clean; unrelated worktrees and two unrelated index locks preserved.
- OS: `/Users/brianb/MissionMed_OS`; pull `--ff-only` returned Already up to date.
- Universal BOOT dependency validation PASS after correcting the validator input to the Git directory, `/Users/brianb/MissionMed/.git`.
- Canonical MR-079 SHA-256: `9638e67841e98b278244c0d4f9ecd0ccbdc7a9e17c50a67dd45d1d31895a0357`.
- Risk: read-only discovery LOW; requested protected implementation/deployment HIGH and closed pending authority.

## Authority and lease

- `missions.json`: zero USCE records; requested mission absent.
- `authority_index.json`: no USCE mission authority route.
- `products_index.json`: USCE is protected_active_with_recent_repairs; route `PRODUCT_PASSPORTS/usce.md`.
- That passport is absent in the OS checkout. The HQ copy is historical context, last verified July 6, and explicitly supplies no deployment authority.
- `CURRENT.md`: generated September 30; no requested mission route. Universal PASS does not establish mission authority.
- DR-096 explicitly states: “No product-development authority is created by this record.” Its registrar implementation authority cannot be borrowed for USCE.
- No writer lease acquired. Read-only coordination query observed no unexpired/unreleased writer claims; this snapshot does not grant ownership.
- Founder attachment explicitly forbids self-granting protected ownership. No decision identifier reserved or invented.

## Production boundary evidence

| Boundary | Current evidence | Remaining proof |
|---|---|---|
| Normal browser entry | `/usce-admin/` rendered embedded WordPress login through scoped `mmhq_usce_admin_auth_relay`; existing autofill login submitted by Foreman; resulting frame says USCE administrator access denied | Existing authorized administrator session; actor/role; protected queue/recovery |
| CDN admin artifact | Live versioned GET 200; SHA-256 `52c71149dd0ce8bb5d44d0974de2c590e8bf5bd125880447c9d155759a156e31`; Cache-Control no-cache, no-store, must-revalidate; CF DYNAMIC | Authenticated browser serving/readback |
| CDN source | Live bytes equal `8ca364b4162714d93f4835d3a6608b71fc47e5a7:LIVE/usce_admin.html` and PR36 head bytes | Complete clean baseline reproduction after authority |
| Main admin artifact | SHA-256 `f1ada3a18c6cd18ca30ec85187cef121d5a1649ad29a2ba7f7149383a776a842`; differs from live | Minimal accepted USCE-only port; no whole donor merge |
| Railway isolated gateway | `/health` 200; provider SUCCESS deployment `4ea220b8-0892-4a29-b16e-1c85298e37cd`, commit `8ca364b4162714d93f4835d3a6608b71fc47e5a7`, image `sha256:f81beeb49654d20581e09909a5ae16284b27f84abcb9b10f4b7ef299196270d2`; start `node missionmed-hq/usce-gateway.mjs`, health `/health`, one replica | Fresh compatible rollback rehearsal and runtime configuration attestation |
| WordPress plugin | Historical accepted source hash `8cfb8dadf7193c63722ab3d217f319460922324d9e12fa934c902d02a9fa1813`; browser action targets scoped relay | Fresh live file/version/hash and restore-point readback |
| Supabase | Connected project `fglyvdykwgbuivikqoah`, missionmed-ranklistiq, ACTIVE_HEALTHY; command_center USCE aggregate queries succeed | Runtime project pin/config attestation; provider contracts and safe fixture |
| Communications/applicant | Public applicant CDN artifact 200, SHA-256 `3d7471b9694659f84e72fb3cd8799e33023d88333b5da36181315460e8246bac`; no-cache/no-store, CF DYNAMIC. None of 11 changing Git commits or three targeted historical worktree files matched its hash | Approved fixture/inbox; reconcile exact applicant source; live journey |
| Commerce/onboarding | No actions performed | Read-only provenance and authorized no-money fixture evidence |

PR #36 remains OPEN at `85c8351e8d8c978dac28d28325140734cafc432c`, base `codex/ivoc-converge-8001-production`. It was not merged, retargeted, or altered. Read-only donor: `/Users/brianb/MissionMed_worktrees/usce-phil-auth-20260928`. Donor is not a writable base. Runtime SHA `8ca364b4162714d93f4835d3a6608b71fc47e5a7` is now corroborated by fresh CDN bytes and exact-service Railway provider readback. Latest documentation commit `85c8351` deployment was SKIPPED; do not confuse it with serving code. Generic GitHub project deployment records cover other services and are not USCE custody evidence.

Brain remote contract and current tree rechecked: default `codex/missionmed-brain-v0`; packs Calendar, File Vault, Mission Residency Commerce only. No USCE pack. No sibling pack loaded.

## Security and data snapshot

Read-only aggregate snapshot: 88 intake requests (77 archived, 6 new, 5 offer_ready); 66 offer drafts; 208 communication records; 554 audit records. The attachment's 209 communication count is dated, not current proof. No applicant rows or PII exported.

Five operational tables remain RLS-disabled: usce_cron_runs, usce_postmark_events, usce_outbox, usce_dead_letter, usce_webhook_nonces. Effective anon/authenticated schema USAGE, SELECT and write privileges are false for all five. Direct public-role exposure is not established. Reachable SECURITY DEFINER paths and PostgREST exposure still require review; the authenticated-executable legacy `command_center.usce_portal_respond` touches outbox and takes caller identity as a parameter. Do not apply generic RLS SQL or claim complete security acceptance.

All five operational tables and the formal requests/offers/seats/confirmations tables currently have zero rows. The 14 inspected active public request-first RPCs are SECURITY DEFINER, have fixed search paths, deny anon/authenticated EXECUTE, and grant service_role EXECUTE. The legacy portal function's authenticated EXECUTE grant does not establish API reachability: that role lacks command_center schema USAGE, and exposed-schema configuration remains unverified. Provisional classification: defense-in-depth gap; no direct P0 exposure demonstrated. Advisor output is advisory; effective catalog privileges and reachable contracts govern the verdict. Relevant guidance: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy and https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable. No hardening migration applied.

## Verified implementation risks and baseline checks

- Focused accepted-source gateway/runtime/relay tests: **6/6 PASS**, run in the read-only donor. They do not establish new release acceptance.
- Local mocked send reproduction: repeating the same offer/message/idempotency key invoked provider twice, then durable record twice; second durable result reports idempotent. All fetch calls intercepted; zero real network calls or production writes. `sendAdminOfferMessage` calls Postmark before `record_usce_offer_postmark_send`; database idempotency therefore cannot prevent an already-repeated send.
- Live `record_usce_offer_postmark_send` definition advances draft/ready/viewed to sent even for dry_run; `message_sent_at` is updated only for live mode. The current database conflates workflow stage with a test recording.
- Live `update_usce_offer_draft` changes terms without clearing existing token hash or introducing a version-bound approval; current inspected table triggers only maintain timestamps and audit. Source inspection does not establish a separate hidden approval/version safety contract.
- Astra partial review is complete, directly handed back; SHA-256 `964a81b6f12349875f3726f2e35966c9151dbee2aeb0a60c54256b47fcabbcf3`. Its earlier default-UA CDN 403 note predates Foreman's successful browser-header GET above. Its source findings are not live case acceptance.
- One subsequent Astra evidence-only correction stopped on the existing Bash 3 empty-array preflight error. No guard script was edited. Foreman staged the already-reviewed release board normally; with real tracked and untracked documentation present, exact same canonical scoped preflight then PASSed. No dummy file or guard bypass introduced.

## Journey matrix

| Journey | Evidence | F | U | O |
|---|---|---|---|---|
| J1 entry/recovery | Live logged-out entry and current-session administrator denial only | PARTIAL | PARTIAL | UNREVIEWED |
| J2 daily triage | Source review; no safe authenticated case | UNREVIEWED | UNREVIEWED | UNREVIEWED |
| J3 clarification/availability | No approved fixture; no mutation | UNREVIEWED | UNREVIEWED | UNREVIEWED |
| J4 build/communicate | No approved send or inbox | UNREVIEWED | UNREVIEWED | UNREVIEWED |
| J5 applicant response | Current safe applicant link unresolved | UNREVIEWED | UNREVIEWED | UNREVIEWED |
| J6 resume/revise | No safe draft/link mutation | UNREVIEWED | UNREVIEWED | UNREVIEWED |
| J7 communication truth | Metadata/source only | UNREVIEWED | UNREVIEWED | UNREVIEWED |
| J8 onboarding handoff | No money/enrollment/placement actions | UNREVIEWED | UNREVIEWED | UNREVIEWED |
| J9 access/race failures | Current actor denied; remaining cases unexecuted | PARTIAL | UNREVIEWED | UNREVIEWED |
| J10 accessibility | Login surface observation only; product flows inaccessible | UNREVIEWED | UNREVIEWED | UNREVIEWED |

No release slice is accepted. Independent release acceptance has not run because no candidate exists.

## Worker ownership

- Foreman `/root`: sole integration/deploy owner; currently documentation and read-only investigation only. Browser owner after Astra handback.
- Specialist `/root/astra_usce_experience`: dispatch explicitly selected `gpt-6-astra`, High; tool accepted named worker, without separate runtime model introspection. Read-only first pass, no code/provider/production writes. Only its named review artifact may be written.
- Never two writers per file. Astra owns `ASTRA_PRODUCT_EXPERIENCE_REVIEW.md`; Foreman owns this board, STATE and sanitized evidence.

## Concrete owner decision requested (proposal, not authority)

Owner: Dr Brian through the canonical protected-product architect/registrar process.

1. Authorize registration of this mission, repair the USCE passport route, file the bounded decision and MR-079 execution annex, add mission/profile/authority routes, regenerate CURRENT, push/read back and independently validate registration under a REGISTRY lease.
2. Candidate USCE implementation scope: accepted baseline port and renovation of `LIVE/usce_admin.html`; USCE-only seams in `missionmed-hq/routes/usce-public-intake.mjs`, `missionmed-hq/routes/usce-offer-portal.mjs`, `missionmed-hq/routes/usce-status-tracker.mjs`, `missionmed-hq/usce-gateway.mjs`, `missionmed-hq/usce-gateway-policy.mjs`, `missionmed-hq/package.json`, `missionmed-hq/server.mjs`; scoped USCE tests/scripts; identified current applicant artifact after its source is verified. Shared server and WordPress relay changes require exact-path grants and current preimages, not whole donor-file replacement. No non-USCE behavior changes.
3. Deployment limited to the existing isolated missionmed-usce-gateway service and exact USCE CDN objects, with current pinned artifacts/configuration and verified rollback. WordPress relay repair only if a reproduced product defect requires it and the filed decision explicitly names that shared path. No global identity/role/account changes.
4. Database changes only if necessary for verified USCE safety/behavior, as separately reviewed new migrations in project `fglyvdykwgbuivikqoah`, with explicit object list and dependent-job tests/rollback before apply. No shared-project cleanup.
5. Name an approved clearly synthetic fixture (existing or creation through the canonical contract), test inbox, permission for narrowly tagged test communication, and retention/cleanup policy. Dry-run first; no real applicants, payments, orders, seat commitments or enrollment.

## Waiting conditions and wake events

| Owner | Condition | Requested action / wake event | Independent work |
|---|---|---|---|
| Dr Brian / protected-product architect / registrar | Missing mission/passport/decision/annex | Ratify bounded proposal; canonically file and verify exact authority pack | Read-only custody, source/security triage and Astra artifact |
| Dr Brian | Current existing saved login receives administrator denial | Sign in to the normal USCE entry with an existing authorized administrator; no credentials in chat | Anonymous/source/provider read-only evidence |
| Dr Brian / USCE operations owner | No approved synthetic case/inbox/test-send contract recovered | Identify or authorize tagged fixture/inbox and retention | Source-only safety contract review |

## Rollback and next action

Current serving state preserved. Historical rollback: Kinsta backup Pre USCE admin auth relay 2026-09-28; private plugin preimages; CDN BACKUPS/usce_admin/2026-09-28T230731Z/usce_admin.html; Railway deployment `4ea220b8-0892-4a29-b16e-1c85298e37cd`. These remain historical pointers until freshly reproduced; no new deployment is permitted on that basis alone.

Exact next action: resolve the pending consolidated owner setup request, canonically file/independently validate the bounded authority pack, then acquire the narrow current lease, reproduce accepted baseline, and implement the server safety plus case-centered R1 slice. Approved admin and fixture gates remain required for live walkthrough/acceptance. No IVOC or sibling system touched.

State delta: execution goal active; BOOT/current-truth gaps verified; live CDN parity proved; existing browser actor denied; read-only database/security evidence gathered; Astra directly dispatched; no product code, provider config, database data/schema, email, payment, role, deployment or production state changed.
