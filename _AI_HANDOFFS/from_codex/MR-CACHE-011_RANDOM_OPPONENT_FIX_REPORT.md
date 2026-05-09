# MR-CACHE-011 Random Opponent Menu Fix Report

Generated: 2026-05-09

## RESULT

COMPLETE for the immediate blocker: STAT V3 Find Opponent no longer dead-ends when no human opponent is selected.

## Scope

- Modified only `LIVE/stat_v3.html`.
- Did not modify `LIVE/stat.html` or any legacy STAT file.
- Did not modify auth, backend, Supabase schema/RLS/functions, payment, USCE, VIDEO_SYSTEM, deploy scripts, or production state.
- No deploy, purge, or push was performed.

## What Was Broken

- STAT V3 defaulted to the Friend/Search path.
- The Find Opponent screen disabled progression unless a human duel had already been created.
- Students who did not select a human opponent could not continue into runtime.
- Bot/random rematch still used the server-only start path, so local no-auth testing could fail after results.

## What Changed

- Added a student-facing `Start Random Match` path in the STAT V3 Find Opponent screen.
- Changed the Find Opponent footer action to `Start Random Match` when no human duel is ready.
- Routed that action through a new `statV3StartRandomOpponentMatch()` helper.
- The helper first attempts the live server-created bot duel path.
- If local auth/RPC is unavailable during pre-deploy testing, it loads an assigned Random Rival with the same timed STAT V3 runtime mechanics so the match flow can be tested.
- Updated random/bot copy from practice/demo wording to student-facing Random Rival wording.
- Routed bot/random rematch through the same random-opponent path so Results -> Rematch works.

## Local Gameplay Proof

Automated browser validation was run against:

`http://localhost:8765/LIVE/stat_v3.html`

Observed:

- Find Opponent displayed `Start Random Match`.
- Footer nav also displayed `START RANDOM MATCH` instead of a disabled Ready Check.
- Clicking it entered the match runtime.
- Timer was visible.
- Answer feedback displayed correct/incorrect state.
- Score updated based on answer time.
- Results screen displayed `Duel Complete.`
- Rematch returned to a new Random Rival ready check.

Captured proof summary:

```json
{
  "startText": "Start Random Match",
  "navText": "START RANDOM MATCH",
  "timerVisible": true,
  "feedbacks": [
    "Incorrect - +0 - 0.3s",
    "Correct - +99 - 0.3s",
    "Correct - +99 - 0.3s",
    "Incorrect - +0 - 0.3s",
    "Incorrect - +0 - 0.3s"
  ],
  "resultTitle": "Duel Complete.",
  "finalScore": "198 FINAL SCORE",
  "rematchStep": "4",
  "rematchRival": "Random Rival"
}
```

The browser console showed expected local 401 responses from authenticated RPC attempts before the local pre-deploy fallback loaded the Random Rival. No production mutation was performed.

## Static Checks

- `node --check` on extracted STAT V3 script: PASS
- `git diff --check -- LIVE/stat_v3.html`: PASS
- Safety grep for service role/local secret patterns: no new service-role key or secret exposure found.

## Live-State Validation

Command run:

```bash
bash VALIDATION/validate_live_state.sh --strict --output _AI_HANDOFFS/from_codex/MR-CACHE-011_RANDOM_OPPONENT_FIX_VALIDATION.md
```

Result: strict validation returned nonzero because local source now intentionally differs from deployed live artifacts until deployment.

Notable classifications:

- `/stat-v3`: SOURCE/DEPLOY MISMATCH, expected for this source-only fix before deploy.
- `/stat`, `/daily`, `/drills`, `/daily-drills-v3`: LIVE CURRENT.
- `/arena`: SOURCE/DEPLOY MISMATCH in the validator output; this was not touched by this fix and should be reviewed before any broad runtime deploy.

## Files Changed

- `LIVE/stat_v3.html`
- `_AI_HANDOFFS/from_codex/MR-CACHE-011_RANDOM_OPPONENT_FIX_REPORT.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-011_RANDOM_OPPONENT_FIX_VALIDATION.md`

## Rollback

Revert the commit for this fix, or restore `LIVE/stat_v3.html` from commit `11361903c3dc7b4d4e5d4ea990010f7099de49ff`.

## Recommendation

Brian should test locally at:

`http://localhost:8765/LIVE/stat_v3.html`

Use this path:

1. Open STAT V3.
2. Go to Match Settings.
3. Continue to Find Opponent.
4. Click `Start Random Match`.
5. Answer questions, confirm timer/score/feedback/results.
6. Click `Rematch`.

Do not broad deploy all runtime files while `/arena` is still classified as SOURCE/DEPLOY MISMATCH by the validation tooling. Prefer a narrow STAT V3 deploy after Brian approves the local test.

## Confidence

87%. The immediate Find Opponent and rematch blocker is fixed and locally validated. Reservation: full signed-in production bot/human async behavior still depends on authenticated Supabase/RPC availability and should be tested by Brian with real credentials before deployment approval.
