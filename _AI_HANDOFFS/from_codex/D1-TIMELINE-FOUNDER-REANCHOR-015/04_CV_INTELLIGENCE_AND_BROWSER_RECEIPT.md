# D1 Timeline Founder Re-anchor 015 — CV Intelligence and Visible Browser Receipt

Status: `PASS_LOCAL_CANDIDATE`

Production mutation: `NONE`

Privacy boundary: synthetic, non-student content only. No real student CV was sent to an AI provider in this run.

## Exact source and real AI proof

- source: `_AI_HANDOFFS/from_codex/D1-TIMELINE-CODEX-FINAL-012A/fixtures/012A_SYNTHETIC_CV.pdf`
- source size: `37,620 bytes`
- source SHA-256: `9db0a22f8ecd7f2cabcfcedb85fdd3aa5a640bbf6d345c4adb6a30225bd33dbb`
- provider mode: `SERVER_AI`
- provider: `openai`
- model: `gpt-5.6-terra`
- provider storage: `store:false`
- prompt: `d1-timeline-cv-prompt-3`
- elapsed time: `20,623 ms`
- retained candidates: `6/6`
- rejected candidates: `0`
- exact-source provenance: `6/6`
- fabricated client block excluded: `PASS`
- detailed real-provider receipt: `/private/tmp/d1-founder-synthetic-cv-browser-015/D1_FOUNDER_SYNTHETIC_CV_BROWSER_RECEIPT.json`

## Root cause and bounded repair

The medical-degree candidate visibly and source-faithfully contained `Doctor of Medicine, Harborview International Medical School`, but its optional structured organization field was empty. The profile prefill therefore preserved MD and Jun 2022 while dropping the school name.

The repair accepts only explicit medical-degree title forms such as `degree, school`, `degree at school`, or `degree — school`. A bare degree title remains blank and reviewable. Existing student profile fields remain authoritative and are not overwritten.

Affected implementation:

- `packages/mission-timeline/web/js/uxr-002/intake.js`
- `packages/mission-timeline/tests/d1-reanchor-global-builder.test.mjs`
- `packages/mission-timeline/tests/support/synthetic-cv-files.ts` (test-only: prevents long evidence rows from drawing beyond the synthetic PDF page)

## Visible Chrome journey

Browser surface: real Google Chrome through the authorized visible Computer Use path.

Isolated URL: `http://127.0.0.1:8799/web/?matrixAppMode=local&returnUrl=%2Fmatrix%2Fdemo%2F`

1. Opened a clean origin with zero events.
2. Uploaded the exact authorized synthetic PDF through the visible file chooser.
3. Applied the authorized synthetic-only AI consent.
4. Read six visible suggestions with exact file/page provenance.
5. Bulk-accepted five high-confidence facts.
6. Reviewed the ambiguous observership as US Clinical, Jan 2024–Mar 2024, Lakeside Community Hospital, with the concise label `Internal Medicine Observership`.
7. Applied all six accepted facts in one undoable batch.
8. Opened Builder Core Info and verified:
   - School not listed: `Harborview International Medical School`
   - Degree: `MD`
   - Graduation: `Jun 2022`
   - Timeline events: `6`
   - Observership: `Jan 2024–Mar 2024`, `Lakeside Community Hospital`
9. Reloaded Chrome and reconfirmed all values and six events persisted.

## Screenshot evidence

- before reload: `evidence/cv-browser/08_profile_prefill_before_reload.jpeg`
  - SHA-256: `b03d79263e2d0c94568fe9ac641a11553812bbabe42e2fa1af9f12320bcd18da`
- after reload: `evidence/cv-browser/09_profile_prefill_after_reload.jpeg`
  - SHA-256: `73e1ad10ab154e4ad99bb72ab1318948f1093bbd8867ccc07d4e67cff03afd9c`

## Affected regression

- global Builder/CV profile suite: `8/8 PASS`
- Intake and D1-408 adapter suite: `30/30 PASS`
- exact-source CV intelligence suite: `15/15 PASS`
- combined affected result: `53/53 PASS`

Unit 10 is complete locally. Unit 24 must re-prove the same path against the immutable production release before final PASS.
