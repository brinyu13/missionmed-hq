# SF-ACCESS-5016 — Pre-existing Playwright Exception Receipt

## Classification

**PRE-EXISTING TEST-HARNESS RACE — CORRECTED; NO PRODUCT FAILURE WAIVED**

The failing test was:

`tests/e2e/b1-515-fast-voice-repair.spec.mjs:97`

`[B1-515-FAST-VOICE-01] mentor feedback is idle until explicit Start and uses the wide canonical workspace`

Its failing assertion captured the mentor transcript immediately after the Pause UI
appeared, waited 400 ms, and required the value to stay exact. The application closes
the current recording segment when Pause is clicked and queues that already-recorded
segment for transcription. The Pause UI can therefore render before the queued HTTP
transcription response has been applied. The observed segment 1 to segment 1 plus
segment 2 transition was the permitted finalization of audio recorded before Pause,
not new recording after Pause.

## A/B proof before correction

Both worktrees were clean detached worktrees created from the same repository and
installed independently with `npm ci`.

Candidate:

- commit: `d35c93f4a52a4a7e81d2364a189c30bb935eb25b`;
- command: `STORYFORGE_PG_BIN=/opt/homebrew/opt/postgresql@18/bin STORYFORGE_E2E_PG_PORT=55460 STORYFORGE_E2E_APP_PORT=4185 npm run test:e2e -- tests/e2e/b1-515-fast-voice-repair.spec.mjs --grep 'mentor feedback is idle' --repeat-each=5 --workers=1`;
- result: **2 passed, 3 failed**;
- every failure had the same signature: expected segment 1 only, received segment 1
  plus segment 2 at the pause-stability assertion.

Untouched baseline:

- commit: `c25470efce1ab0d7701af98d7fea7c4b4d2508b3`;
- command: `STORYFORGE_PG_BIN=/opt/homebrew/opt/postgresql@18/bin STORYFORGE_E2E_PG_PORT=55461 STORYFORGE_E2E_APP_PORT=4186 npm run test:e2e -- tests/e2e/b1-515-fast-voice-repair.spec.mjs --grep 'mentor feedback is idle' --repeat-each=5 --workers=1`;
- result: **4 passed, 1 failed**;
- the failure had the identical segment 1 to segment 2 signature at the identical
  source line.

The untouched baseline reproduction proves the failure class was not introduced by
SF-ACCESS-5014. The differing pass/fail frequency in identical repetitions proves the
old assertion was timing-sensitive.

## Narrow correction

Only the Playwright test changed. It now:

1. registers a waiter for the next authenticated mentor-segment POST;
2. clicks Pause;
3. proves the Pause UI is visible;
4. proves the pause-triggered segment request completed successfully;
5. proves deterministic segment 2 was applied;
6. captures the settled transcript and retains the original 400 ms exact-value
   assertion.

This preserves and strengthens the product invariant: the segment closed by Pause is
not lost, and no additional transcript appears after that in-flight segment settles.
No application, database, WordPress, frontend asset, Matrix asset, or production
runtime file was changed for this correction.

## A/B proof after correction

The identical six-line test-only correction was applied to both detached worktrees.

- untouched baseline plus corrected test: **5/5 passed**;
- SF-ACCESS-5014 candidate plus corrected test: **5/5 passed**.

The same commands, ports, worker count, and five repetitions listed above were used.

## Bounded authorization decision

The SF-ACCESS-5016 human authorization permits continuation only for a baseline-proven
pre-existing flaky or harness defect unrelated to the StoryForge admin-access patch.
That condition is satisfied here. No red product assertion is being ignored and no
runtime behavior is being excepted. The corrected test must still pass in the complete
Playwright suite before production work may begin.

This receipt is one-ticket evidence only. It is not a standing waiver for this test or
for future Playwright failures.
