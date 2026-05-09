# MR-CACHE-011 — STAT V3 UI Runtime Repair

## RESULT

PARTIAL — STAT V3 source repaired; no deploy/purge/push performed.

Brian clarified the intended repair: do not replace STAT V3 with legacy STAT, and do not modify `LIVE/stat.html`. STAT V3 should keep its own V3 layout/design/UI while using the legacy STAT gameplay contract and wiring patterns.

## What Was Corrected

- Restored `LIVE/stat_v3.html` to the V3 UI shell baseline instead of the accidental legacy-file replacement.
- Left `LIVE/stat.html` untouched.
- Made the V3 Match Settings menu functional instead of disabled.
- Added legacy-style setup state:
  - opponent pool: Random similar, Random open, Friend/Search
  - difficulty: Step 1, Step 2, Mixed
  - question count: 20, 40, 60
  - opponent tempo: Steady, Balanced, Aggressive
  - wager: 50, 100, 250 MP
- Made Friend/Search the default path so opponent discovery is obvious.
- Reworked V3 opponent search to follow the legacy search contract more closely:
  - `duel_roster`
  - `stat_player_search` fallback
  - direct UUID fallback
  - deduped roster results
- Removed the visible practice/demo start path from the V3 opponent screen.
- Updated human challenge creation source from internal-test wording to `stat_v3_human_challenge`.
- Updated bot match creation source from internal-test wording to `stat_v3_bot_duel`.
- Added V3 result actions:
  - Rematch
  - New Match
  - Back to Arena
- Added state reset/rematch helpers so old result state does not bleed into the next match.
- Added route guards so students cannot jump directly into Ready/Play/Results without match readiness.

## Files Changed

- `LIVE/stat_v3.html`
- `_AI_HANDOFFS/from_codex/MR-CACHE-011_V3_UI_RUNTIME_REPAIR_VALIDATION.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-011_STATV3_V3_UI_RUNTIME_REPAIR_REPORT.md`

## Files Removed

Removed the misleading artifacts from the accidental legacy-twin approach:

- `_AI_HANDOFFS/from_codex/MR-CACHE-011_FOLLOWUP_POST_LEGACY_TWIN_VALIDATION.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-011_STATV3_LEGACY_TWIN_FOLLOWUP_REPORT.md`

## Files Intentionally Untouched

- `LIVE/stat.html`
- `LIVE/arena.html`
- `LIVE/daily.html`
- `LIVE/drills.html`
- `LIVE/daily_drills_v3.html`
- auth/login/session/bootstrap/exchange
- Supabase schema/RLS/functions
- Railway/backend
- WooCommerce, LearnDash, payment, USCE, VIDEO_SYSTEM
- secrets/env files

## Validation

Local checks:

- Inline script syntax check: PASS
- `git diff --check`: PASS
- Local Chrome smoke test: PASS
  - STAT V3 V3 shell loads
  - Match Settings menu renders as V3 UI
  - settings buttons are clickable
  - Friend/Search is active and obvious
  - Find Opponent screen opens
  - search field and Find Opponent button render
  - Create Match stays disabled until an opponent is selected
  - Ready Check stays disabled until match wiring is ready

Live-state command run:

```bash
bash VALIDATION/validate_live_state.sh --strict --output _AI_HANDOFFS/from_codex/MR-CACHE-011_V3_UI_RUNTIME_REPAIR_VALIDATION.md
```

Live-state result: ATTENTION REQUIRED, expected because this was source-only and no deploy was performed.

Important live-state notes:

- `/stat` remains LIVE CURRENT.
- `/daily`, `/drills`, and `/daily-drills-v3` remain LIVE CURRENT.
- `/stat-v3` is SOURCE/DEPLOY MISMATCH because the canonical local source changed and production was not deployed.
- `/arena` also reports SOURCE/DEPLOY MISMATCH from prior unrelated state and was not touched.

## Deploy / Purge / Push

- Deploy performed: NO
- Cache purge performed: NO
- Push performed: NO

## Remaining Risks

- Full authenticated human-to-human async completion was not tested locally because Brian-controlled credentials and a second test player are required.
- The V3 runtime now uses the intended V3 shell plus legacy-style wiring, but production `/stat-v3` will not change until a deliberate deploy occurs.

## Recommended Next Step

Review the diff for `LIVE/stat_v3.html`. If approved, deploy only the STAT V3 artifact, then run:

```bash
bash VALIDATION/validate_live_state.sh --strict --output _AI_HANDOFFS/from_codex/MR-CACHE-011_AFTER_STATV3_DEPLOY_VALIDATION.md
```

Then smoke-test `/stat-v3` while signed in:

- open STAT V3
- confirm V3 layout/design remains
- open Match Settings
- use Friend/Search
- select or search an opponent
- create/join a human async match
- answer a match
- confirm timer/scoring/feedback/results
- click Rematch

## Confidence

83% with reservation. The V3 shell is preserved and the broken menus/runtime paths are repaired in source. The remaining reservation is authenticated production human-duel completion, which still needs live credentials and a second participant.
