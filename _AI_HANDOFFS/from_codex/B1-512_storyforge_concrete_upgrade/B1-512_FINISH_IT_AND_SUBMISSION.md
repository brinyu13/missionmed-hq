# B1-512 Finish It and Submission

## Verdict

The Stage 1 P0 repair is locally complete in the existing StoryForge renderer. Production has not yet been changed.

## Exact contracts preserved

- `Finish it` completion: Working Version contains at least 40 whitespace-delimited words and Learning Lesson is nonblank.
- Draft save: remains available while either item is incomplete.
- Review submission: persisted trimmed Working Version contains at least three characters. Learning Lesson, title, priority, categories, and intended uses remain optional for submission unless a later published bounded configuration explicitly changes the server-enforced contract.
- New stories remain private until the student chooses the existing `Submit for review` action.

## Repair

- Homepage Finish-It cards now carry an explicit, browser-only completion-guidance intent.
- The exact story opens in the existing Story Room and selects the existing Working Version tab.
- Missing Working Version and/or Learning Lesson sections receive a red-accented outline, an explicit `!` icon, a visible plain-language message, and linked accessible help.
- Exact Founder instruction appears once near the top:

  `Please complete the items highlighted below. This will help you and your mentor understand and develop your story.`
- Focus moves once to the first missing editable control with non-animated scrolling.
- Input updates only the mounted classes, descriptions, and status text; it does not remount the Story Room or create a flashing loop.
- Finish guidance does not mark draft-save fields as HTML-invalid. Invalid submission text does use `aria-invalid=true`.
- Direct Story Detail entry remains normal and carries no guidance.
- The existing review action now explains that submission grants an authorized reviewer access while the story remains private until the student acts.
- Invalid submission routes into the same Working Version guidance without calling the submit API. Unsaved student values are preserved and the student is told to save the durable Working Version before submitting.
- Successful submit, withdraw, resubmit, audit, queue, ownership, and reviewer privacy paths remain the existing B1-511 implementation.

## Files

- `storyforge-v5/public/app.js`
- `storyforge-v5/public/styles.css`
- `storyforge-v5/tests/unit/b1-512-finish-submit.test.mjs`
- `storyforge-v5/tests/e2e/b1-512-finish-submit.spec.mjs`

No server, database, RLS, WordPress, authentication, identity, entitlement, voice, storage, or production file changed in this lane.

## Verification

- Focused B1-511/B1-512 unit: 13/13 PASS.
- Complete unit suite: 284/284 PASS.
- Focused PostgreSQL-backed browser suite: 2/2 PASS.
- Axe serious/critical findings on guided Story Room: 0.
- Mobile 390×844 overflow: 0 px.
- `node --check`: PASS.
- `git diff --check`: PASS.

Before/after evidence:

- `screenshots/before-home-finish-it.png`
- `screenshots/before-finish-it-opens-without-guidance.png`
- `screenshots/finish-it-guidance-mobile-390x844.png`
- `screenshots/submit-for-review-repaired-desktop.png`
