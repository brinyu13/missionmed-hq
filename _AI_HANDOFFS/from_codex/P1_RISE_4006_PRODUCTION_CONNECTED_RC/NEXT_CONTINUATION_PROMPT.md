# P1-RISE-4006 Next Continuation Prompt

Use the following prompt only after one or more external blockers have materially changed.

```text
PROMPT NAME

(P1)-RISE-ProductionConnectionContinuation-4006A

MISSION

Resume P1-RISE-4006 from the exact Founder-review candidate. Do not restart, duplicate completed engineering, weaken fail-closed controls, or deploy without explicit Founder approval after review.

CANONICAL STATE

Repository: /Users/brianb/MissionMed_worktrees/P1-RISE-4006-production
Branch: codex/p1-rise-4006-production
Implementation commit: f99e126399508d2630e9b2a17b8671d87cff1ca2
Web build: rise_web_8d2c636a88b7
Handoff: _AI_HANDOFFS/from_codex/P1_RISE_4006_PRODUCTION_CONNECTED_RC/COMPLETE_COMBINED_HANDOFF.md
Draft PR: https://github.com/brinyu13/missionmed-hq/pull/15

FIRST ACTIONS

1. Read COMPLETE_COMBINED_HANDOFF.md and verify live state before acting.
2. Confirm current worktree, branch, upstream, dirty state, concurrent work, and protected paths.
3. Confirm which exact external blocker changed and inspect its durable evidence.
4. VERIFY LIVE FIRST. BACK UP LIVE FIRST. CREATE A PROVEN ROLLBACK POINT.
5. Do not use an authenticated web session as evidence of source-owner database rights.
6. Do not modify MissionMed OS, HQ, WordPress, Cloudflare, Railway, Supabase, Matrix, ACTN, CAM, or StoryForge without their exact owner authority.

REQUIRED INPUTS BEFORE PRODUCTION CONNECTION

- Founder-approved MissionMed OS decision with product, runtime, data-controller, database, privacy, route, and deployment owners.
- Reviewed written AMA/FREIDA authorization and hash-pinned MissionMed approval record.
- Separate reviewed written AAMC/Residency Explorer authorization and hash-pinned MissionMed approval record.
- HQ owner approval and tested learner audience `rise`.
- Platform owner staging service, approved secret references, artifact host, durable abuse controller, and same-origin route.
- Dedicated RISE database, reviewed RLS policies, immutable backup, and successful restore receipt.
- Matrix, ACTN, CAM, and StoryForge owner decisions for their exact contracts.
- Explicit Founder deployment approval only after staging and design-freeze acceptance.

EXECUTION ORDER

1. Re-run `npm ci`, `npm test`, `npm run build`, and `npm run test:browser` in `rise/`.
2. Build and scan the pinned Docker image in an approved environment.
3. Rehearse migrations 001-003 against a fresh staging database and verify all checks in `tests/fixtures/postgres-rehearsal.sql`.
4. Install owner-approved RLS policies and runtime roles; prove cross-student and role isolation.
5. Run the source import only after both authorization records are governance-pinned. Preserve one quarantined source observation, exact combined specialties, and every unknown.
6. Independently validate the release and issue the activation receipt. Never activate synthetic or offline-shadow material.
7. Deploy to staging using the existing approved MissionMed process and contract-defined environment.
8. Complete student and mentor/admin UAT, accessibility, security, performance, restore, and cross-product regression.
9. Run Founder design-freeze review and Fable review if available.
10. Ask for explicit Founder production approval. Do not deploy while approval is absent.
11. If approved and every gate passes, deploy the exact immutable candidate through the approved process, verify live behavior with authorized accounts, observe, and preserve receipts.

STOP CONDITIONS

Stop at the narrowest boundary if source rights, owner authority, credentials, backup, restore, staging parity, security, accessibility, evidence integrity, cross-product regression, or Founder approval is absent. Complete all source-independent work, record exact evidence, and return EXTERNAL_BLOCKER. Never convert a missing gate into an assumption.

REQUIRED OUTPUT UPDATE

Update the individual RC reports and COMPLETE_COMBINED_HANDOFF.md with exact commit, image digest, release ID, source-authorization set, activation ID, staging route, production route, migration receipts, backup and restore receipts, test totals, live journeys, observability window, rollback target, and truthful final verdict.
```
