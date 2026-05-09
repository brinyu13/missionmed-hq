# MR-CACHE-011 STAT V3 Gameplay Parity Report

Generated: 2026-05-08 America/New_York

## RESULT

PARTIAL — repaired STAT V3 gameplay parity in source, but did not deploy. Strict live-state validation correctly reports `/stat-v3` as SOURCE/DEPLOY MISMATCH because the canonical branch now differs from the deployed CDN artifact.

No deploy, purge, CDN invalidation, or push was performed.

## Branch / Worktree

- Worktree: `/Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004`
- Branch: `mr/live-source-of-truth-reconcile-004`
- Starting HEAD: `790bef1 MR-CACHE-010 apply remaining same-day safe fixes`

## Legacy STAT Gameplay Contract Summary

The extracted contract is documented in:

- `_AI_HANDOFFS/from_codex/MR-CACHE-011_LEGACY_STAT_GAMEPLAY_CONTRACT.md`

Short form:

- opponent selection must be explicit,
- match start must be staged and obvious,
- questions must run under visible timer pressure,
- correct answers must score more when answered faster,
- incorrect or timed-out answers score zero,
- selected answers must show correct/incorrect feedback,
- correct answer reveal must be visible,
- score, correct count, average time, and streak must update,
- results must show final score and replay/review context.

## STAT V3 Gaps Found

- The route still behaved like a sealed wiring shell when no live adapter was present.
- It had a 30-second question constant even though the visible setup copy and legacy contract use a 15-second clock.
- It counted locked answers as the player's score instead of using STAT point scoring.
- It did not preserve answer keys from input packs when they were available.
- It did not calculate local correct/incorrect feedback.
- It did not visibly identify the correct answer after a selection.
- It advanced questions without enough legacy-style resolution feedback.
- Results depended on server result payloads and did not provide a coherent local result path for a testable V3 match.
- Opponent/start flow was not obvious for a student who lacked a live human async adapter.

## Changes Applied

Only `LIVE/stat_v3.html` was modified.

Gameplay changes:

- Set STAT V3 question pressure to `15` seconds.
- Added legacy-style point decay: `100` max, `30` minimum, linear decay over the 15-second answer window.
- Added answer-key preservation when question packs expose `correct_answer`, `correctAnswer`, `correctIndex`, `correct_index`, or related key/index fields.
- Added answer scoring with `0` for wrong or timed-out answers.
- Added visible answer feedback: `Correct`, `Incorrect`, points earned, and elapsed seconds.
- Added correct-answer reveal by applying correct/wrong choice classes after selection.
- Added timeout handling that locks unanswered questions and advances safely.
- Added score, correct count, average time, streak, and opponent pressure updates during play.
- Added local result generation for practice matches with replay rows showing selected answer, correct answer, time, and points.

Opponent/start flow changes:

- Added a clear `Practice Rival` start path on the Find Opponent screen.
- Preserved existing human async search, create match, join match, live pack, submit, and result wiring.
- Preserved STAT V3 route identity and `/stat-v3` references.

## Files Changed

- `LIVE/stat_v3.html`
- `_AI_HANDOFFS/from_codex/MR-CACHE-011_LEGACY_STAT_GAMEPLAY_CONTRACT.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-011_POST_PATCH_VALIDATION.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-011_STATV3_GAMEPLAY_PARITY_REPORT.md`

## Validation Result

Static checks:

- Inline script parse: PASS (`1` inline script parsed)
- `git diff --check`: PASS
- Gameplay marker scan: PASS
- Secret/service-role scan: PASS for service-role/private-key patterns

Score decay proof:

- 1 second correct answer: `95` points
- 8 second correct answer: `63` points
- 15 second timeout floor: `30` available points, but timed-out answers score `0`

Live-state validation command:

```bash
bash VALIDATION/validate_live_state.sh --strict --output _AI_HANDOFFS/from_codex/MR-CACHE-011_POST_PATCH_VALIDATION.md
```

Live-state validation result:

- Exit code: `1`
- Overall: ATTENTION REQUIRED
- `/arena`: SOURCE/DEPLOY MISMATCH, expected from MR-CACHE-010 no-deploy Arena label cleanup
- `/stat-v3`: SOURCE/DEPLOY MISMATCH, expected because MR-CACHE-011 changes are source-only and not deployed
- `/stat`: LIVE CURRENT
- `/daily`: LIVE CURRENT
- `/drills`: LIVE CURRENT
- `/daily-drills-v3`: LIVE CURRENT

## Gameplay Proof

Computer Use / local browser validation was performed against:

- `http://127.0.0.1:8787/LIVE/stat_v3.html`

Observed:

- STAT V3 loaded locally.
- The Find Opponent screen clearly showed `Practice Rival`, `Start Practice`, human roster search, create match, and join match controls.
- Starting practice moved through Ready Check countdown.
- Play Duel screen showed player lane, rival lane, question text, answer choices, visible timer, available points, and score area.
- Answer lock displayed correct/incorrect feedback.
- Correct answer was visibly highlighted after selection.
- Question flow advanced through the practice match.
- Results screen rendered verdict, final score, correct count, rival score, replay rows, selected answers, correct answers, times, and points.

## Protected-System Status

No changes were made to:

- `LIVE/stat.html`
- `LIVE/arena.html`
- `LIVE/daily.html`
- `LIVE/drills.html`
- `LIVE/daily_drills_v3.html`
- auth/login/session/bootstrap/exchange
- Supabase schema/RLS/functions
- Railway/backend
- WooCommerce
- LearnDash
- payment flows
- USCE
- VIDEO_SYSTEM
- secrets/env files

## Deploy / Purge / Push Status

- Deploy performed: NO
- Purge performed: NO
- CDN invalidation performed: NO
- Push performed: NO

## Commit

Commit hash: recorded in final response after commit creation.

## Remaining Risks

- Live human async packs that intentionally seal correct answers still cannot provide immediate local correctness without backend/result support. MR-CACHE-011 preserves that by only revealing correctness when answer keys are present.
- Production `/stat-v3` will not show these gameplay repairs until Brian approves a deploy.
- Browser validation used the local practice-rival path; authenticated human async production flow was not exercised because credentials were not provided and login was not authorized.

## Confidence

Confidence: 84%.

Reservation: The source patch now implements the legacy STAT gameplay contract for answer-key-bearing packs and practice play, but full production human-async parity still depends on live pack/result payload shape and should be rechecked after deploy with an authenticated test account.
