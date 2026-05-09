# MR-CACHE-011 Legacy STAT Gameplay Contract

Generated: 2026-05-08 America/New_York

## Source Reviewed

- `LIVE/stat.html`
- Relevant legacy areas: setup screens, challenge/opponent flow, countdown, `startMatch()`, `startDuel()`, `loadQuestion()`, `startTicker()`, `handlePlayerAnswer()`, `checkAdvance()`, and result rendering.

## Gameplay Contract Extracted

Legacy STAT is not just a static route. It is a pressure duel loop:

1. Opponent selection is explicit.
   - The top bar exposes `Challenge Player`.
   - Match setup has an opponent pool and a friend selector.
   - Human challenge helpers create, accept, and resume duels.

2. Start-game flow is staged.
   - Player selects version/settings.
   - Player configures challenge settings.
   - Player chooses or creates an opponent challenge.
   - A countdown screen runs before entering questions.

3. Question rendering is a focused duel surface.
   - Player and opponent lanes flank the question center.
   - Current question number and total questions are visible.
   - Choices render as selectable answer buttons.

4. Timer pressure is mandatory.
   - Each question starts with `state.pressureSec = 15`.
   - A ring and bar update every 100 ms.
   - Timeout auto-locks the player at zero points.

5. Score decays with answer time.
   - `POINT_DECAY_MAX = 100`.
   - `POINT_DECAY_MIN = 30`.
   - Correct answer points linearly decay over the 15-second window.
   - Incorrect or timed-out answers score `0`.

6. Answer feedback is immediate.
   - Selected choices are disabled after lock.
   - Correct selections are styled green.
   - Wrong selections are styled red.
   - HUD text reports timeout, incorrect, fast lock, late lock, or normal lock.

7. Correct answer reveal is part of resolution.
   - Once both sides lock, `checkAdvance()` applies `.correct` to the correct answer choice.
   - The round resolves briefly before advancing.

8. Question flow advances clearly.
   - Both player and opponent must be locked.
   - Timers are cleared.
   - The correct answer remains visible briefly.
   - Then the next question loads automatically.

9. Competitive pressure is visible.
   - Player and opponent scores update.
   - Correct counts, average times, and streaks update.
   - Opponent HUD and pressure signals change during play.

10. Results make the match understandable.
   - Final score, correct count, average time, and streak are shown.
   - Opponent score and win/loss/tie verdict are computed or fetched.
   - Review/replay rows summarize what happened.

## Important Constraint

Legacy human async duel packs may intentionally seal correct answers for server scoring. When a pack exposes answer keys, the client can show immediate correct/incorrect feedback. When a pack is sealed, the client should preserve backend scoring and avoid inventing correctness.

MR-CACHE-011 therefore teaches STAT V3 the legacy gameplay contract while preserving live human-duel wiring: V3 can score and reveal locally when answer keys exist, and it keeps server-backed submit/results when a live human duel is active.
