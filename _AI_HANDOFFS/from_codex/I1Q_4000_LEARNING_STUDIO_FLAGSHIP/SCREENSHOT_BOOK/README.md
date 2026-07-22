# I1Q-4000 Screenshot Book

This book records the visible state of the I1Q-4000 Learning Studio P4 for Founder review. It is visual evidence of a local synthetic prototype—not evidence of deployment, production integration, medical validity, psychometric validity, accessibility certification, or canonical product adoption.

## Capture provenance

- **Source:** live local application at `http://localhost:3000/`, captured after the prototype source freeze used for this book.
- **Browser state:** scenario-specific synthetic local state; no real learner, Dr. J corpus, Gold Set, Zoom workspace, replay service, account, or production data was used.
- **Desktop viewport:** 1440 × 900 CSS pixels.
- **Mobile viewport:** 390 × 844 CSS pixels.
- **Narrow reflow proxy:** 720 CSS pixels wide.
- **Capture extent:** full-page capture was retained when document height exceeded the viewport; a page that fit the viewport retained viewport height. The stored pixel dimensions below make that distinction explicit.
- **Encoding:** the primary capture backend emitted JPEG-encoded bytes and `sips` transcoded those artifacts to true PNG. Panel captures 07, 08, and 21 were recaptured directly as PNG through a separate local Chrome DevTools session after an integrity review found the earlier full-page panel captures incomplete. All final files were inspected as PNG images, and all 21 have distinct byte digests.
- **High-zoom caveat:** `15_high_zoom_equivalent_720.png` is a 720 CSS-pixel responsive-reflow proxy. It is **not** evidence of testing at actual 200% browser zoom.

## Inventory

| # | File | Stored dimensions | Capture note | Scenario shown |
| ---: | --- | --- | --- | --- |
| 01 | `01_home_desktop.png` | 1440 × 1620 | Desktop, full page | Home launch surface, continuity cards, template entry points, synthetic-data boundary, and direct Studio navigation |
| 02 | `02_builder_templates_desktop.png` | 1440 × 1620 | Desktop, full page | Session builder step 1 with Quick Review, Board Review, Clinical Mastery, and Adaptive learning-contract choices |
| 03 | `03_builder_scope_desktop.png` | 1440 × 1620 | Desktop, full page | Session builder exact-scope step with drill and subject selection and no silent scope broadening |
| 04 | `04_quick_review_desktop.png` | 1440 × 900 | Desktop, viewport-height page | Quick Review open-recall canvas before self-reported grading |
| 05 | `05_clinical_mastery_desktop.png` | 1440 × 905 | Desktop, full page | Clinical Mastery question canvas and three-stage reasoning-sequence framing |
| 06 | `06_layered_feedback_desktop.png` | 1440 × 1115 | Desktop, full page | Committed response with correctness cues and layered concise, deep, and alternatives feedback |
| 07 | `07_replay_placeholder_desktop.png` | 1440 × 900 | Desktop, viewport panel | Replay panel with synthetic anchor and waveform plus explicit disconnected and visual-only disclosures |
| 08 | `08_zoom_notes_placeholder_desktop.png` | 1440 × 900 | Desktop, viewport panel | Disconnected Zoom Notes placeholder, separated from browser-local Question Notes |
| 09 | `09_mobile_home.png` | 390 × 844 | Mobile, viewport-height page | Mobile home shell and compact primary navigation at the 390 CSS-pixel viewport |
| 10 | `10_mobile_quick_review.png` | 390 × 844 | Mobile, viewport-height page | Mobile Quick Review question state and compact session controls |
| 11 | `11_analytics_prediction_desktop.png` | 1440 × 970 | Desktop, full page | Analytics prediction view with seeded current and rolling values, lifetime trend, interval, and simulation disclosure |
| 12 | `12_mastery_proxy_desktop.png` | 1440 × 970 | Desktop, full page | Mastery-proxy analytics view; synthetic fixture framing is part of the visible evidence |
| 13 | `13_founder_decision_log_desktop.png` | 1440 × 1800 | Desktop, full page | Three open Founder-review questions and the visible warning that local notes are not ratification |
| 14 | `14_empty_saved_recovery_desktop.png` | 1440 × 1357 | Desktop, full page | Empty Saved state with a recoverable path back to building a session |
| 15 | `15_high_zoom_equivalent_720.png` | 720 × 2614 | 720 CSS-pixel reflow, full page | Narrow responsive reflow proxy; not an actual 200% browser-zoom test |
| 16 | `16_board_review_desktop.png` | 1440 × 905 | Desktop, full page | Board Review answer selection and confidence-before-feedback contract |
| 17 | `17_adaptive_why_selected_desktop.png` | 1440 × 975 | Desktop, full page | Adaptive review canvas with an explicit synthetic “why selected” rationale |
| 18 | `18_completed_debrief_desktop.png` | 1440 × 1076 | Desktop, full page | Completed-session debrief with results, usage summaries, and next-step navigation |
| 19 | `19_saved_resume_desktop.png` | 1440 × 1275 | Desktop, full page | Paused session in Saved with an explicit resume action and preserved local position |
| 20 | `20_favorites_desktop.png` | 1440 × 900 | Desktop, viewport-height page | Favorites collection populated from the synthetic question experience |
| 21 | `21_rounds_branch_desktop.png` | 1440 × 900 | Desktop, viewport panel | Optional bounded Rounds branch within Clinical Mastery; the branch is not inherited product canon |

## Interpretation limits

The images demonstrate that the listed states were renderable in the local capture run. They do not prove every transition, persistence invariant, keyboard path, focus behavior, responsive width, or recovery case; those claims belong in the validation report and source-level tests. They also do not validate any synthetic question, explanation, analytics value, prediction, replay anchor, or clinical sequence for educational or medical use.

The screenshot book must therefore always be read with these package statuses:

- `NOT DEPLOYED`
- `NOT PRODUCTION-INTEGRATED`
- `NOT MEDICALLY VALIDATED`
- `NOT PSYCHOMETRICALLY VALIDATED`
- `NOT ACCESSIBILITY-CERTIFIED`
- `NOT CANONICAL PRODUCT ADOPTION`
