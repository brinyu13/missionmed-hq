# MR-CACHE-011 Follow-Up — STAT V3 Legacy Twin Repair

## RESULT

PARTIAL — canonical source fixed; production/live not deployed.

Brian correctly flagged that the first MR-CACHE-011 patch did not make STAT V3 behave like legacy STAT. It added a partial V3-local gameplay path, but it did not preserve the full legacy component contract: working setup menus, friend/search opponent flow, human async challenge/accept, and rematch.

This follow-up changes `LIVE/stat_v3.html` to use the proven legacy `LIVE/stat.html` runtime as the behavioral source of truth. STAT V3 is now a route/reskin copy of legacy STAT, with only V3-facing identity labels adjusted.

## Files Modified

- `LIVE/stat_v3.html`
- `_AI_HANDOFFS/from_codex/MR-CACHE-011_FOLLOWUP_POST_LEGACY_TWIN_VALIDATION.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-011_STATV3_LEGACY_TWIN_FOLLOWUP_REPORT.md`

## Files Intentionally Untouched

- `LIVE/stat.html`
- `LIVE/arena.html`
- `LIVE/daily.html`
- `LIVE/drills.html`
- `LIVE/daily_drills_v3.html`
- auth/login/session/bootstrap/exchange systems
- Supabase schema/RLS/functions
- Railway/backend
- WooCommerce, LearnDash, payments, USCE, VIDEO_SYSTEM
- secrets/env files

## What Was Broken

- STAT V3 setup options were not the legacy setup contract.
- V3 opponent menus were incomplete and confusing.
- V3 search/human async path existed only as partial V3-specific wiring, not the full legacy working component set.
- V3 rematch behavior did not match the legacy rematch behavior.
- V3 gameplay had become a separate implementation instead of a reskin/twin of legacy STAT.

## What Changed

- Replaced the STAT V3 runtime body with the current canonical legacy STAT runtime from `LIVE/stat.html`.
- Preserved the legacy working components:
  - opponent pool setup
  - friend/active/recent/search opponent selector
  - `duel_roster` search
  - `stat_player_search` fallback search
  - profile-backed opponent search fallback
  - human async `create_duel`
  - incoming challenge polling/accept
  - `get_duel_pack` hydration
  - timer and point decay
  - answer correctness feedback
  - result finalization/polling
  - rematch button and handler
- Adjusted only V3-facing identity text:
  - page title: `STAT V3 — Async Duel`
  - top-level current card: `STAT V3`
  - setup marker: `Match Settings`
  - matchup brand: `STAT V3 • Async Duel`
  - countdown marker: `Ready Check`
  - internal inert `selectedVersion` value from `v2` to `v3`

## Legacy Twin Evidence

`diff -u LIVE/stat.html LIVE/stat_v3.html` shows the functional runtime is the legacy runtime. The only intentional differences are:

- top comment identifying STAT V3 as a route/reskin copy
- title/visible V3 labels
- `selectedVersion = 'v3'` identity value

No gameplay functions were reimplemented after the replacement.

## Validation

Commands/checks run:

- Inline script syntax check via Node `new Function(...)`: PASS
- `git diff --check`: PASS
- Safety search:
  - no `service_role`
  - no `localhost`
  - no `127.0.0.1`
  - no old disabled V3 `cfg-opt` menu implementation
  - legacy search/challenge/rematch hooks present
- Local browser smoke test using Chrome at `http://localhost:8765/LIVE/stat_v3.html`: PASS
  - STAT V3 loads
  - setup menu opens
  - option buttons respond
  - Friend mode reveals legacy opponent selector
  - Search tab exposes name/email/UUID search field and Find button

Live-state validation command:

```bash
bash VALIDATION/validate_live_state.sh --strict --output _AI_HANDOFFS/from_codex/MR-CACHE-011_FOLLOWUP_POST_LEGACY_TWIN_VALIDATION.md
```

Live-state result: ATTENTION REQUIRED, expected after source-only change with no deploy.

Important validation notes:

- `/stat` remains LIVE CURRENT.
- `/daily`, `/drills`, `/daily-drills-v3` remain LIVE CURRENT.
- `/stat-v3` is SOURCE/DEPLOY MISMATCH because local canonical source has been fixed and no deploy was performed.
- `/arena` also reports SOURCE/DEPLOY MISMATCH, unrelated to this STAT V3 follow-up and intentionally untouched.

## Deploy / Purge / Push

- Deploy performed: NO
- Cache purge performed: NO
- Push performed: NO

## Remaining Risk

- Real human-to-human async cannot be fully exercised locally without Brian-controlled production credentials and another test player.
- The local browser smoke test proves the legacy menus/search surface is present and interactive, but not a live authenticated duel completion.
- Production `/stat-v3` will continue showing the old broken V3 artifact until this branch is reviewed and deployed intentionally.

## Recommended Next Step

Brian should review this source diff first. If approved, deploy only `LIVE/stat_v3.html` through the normal safe deploy path, then verify:

```bash
bash VALIDATION/validate_live_state.sh --strict --output _AI_HANDOFFS/from_codex/MR-CACHE-011_AFTER_STATV3_DEPLOY_VALIDATION.md
```

Then manually smoke-test `/stat-v3` with Brian credentials:

- open `/stat-v3`
- launch STAT V3
- switch opponent pool to Friend
- use Search
- create or accept a human async duel
- complete a match
- use Rematch

## Confidence

92% with reservation. The source is now a legacy twin/reskin, which is the right repair for Brian's stated requirement. The reservation is that production authenticated async duel completion was not exercised locally, and no deployment was performed.
