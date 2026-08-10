# B1-513 Current Canonical Baseline

Date: 2026-08-07 (America/New_York)
Author: Claude Fable 5 (Cowork), B1-513 StoryForge Stage 2

## 1. Canonical production identity (evidence, not memory)

| Item | Value | Evidence |
|---|---|---|
| Canonical URL | `https://missionmedinstitute.com/storyforge/` | B1-512C cutover receipt |
| Live release ID | `v-10688bb24bca7965` | B1-512C_FINAL_COMPLETE_HANDOFF.md |
| Production source commit | `8ca5d60fffcbb479fc5ced4689702fd4a7defb58` | B1-512C cutover receipt |
| Production-closeout/custody HEAD | `1fb19f4d0beb90c03dcefcb7f602cb0c465f90c2` | B1-513 task authority; worktree state |
| Railway deployment | `d0756a3d-2284-46bc-ba1c-e2f75b3cd41c` (SUCCESS) | B1-512C cutover receipt |
| Kinsta immutable pointer | `releases/8ca5d60fffcbb479fc5ced4689702fd4a7defb58` | B1-512C cutover receipt |
| Critical Systems | 112 PASS / 0 WARN / 0 FAIL | B1-513 task authority; B1-512C receipts (111→112 across reconciliation) |
| DB state at cutover | 441 users, 23 stories, 4/4 FORCE RLS tables, 0 media rows | B1-512C cutover receipt post-apply checks |

### Byte-level continuity proof for the prototype foundation

The worktree `storyforge-v5/dist/assets/` filenames embed the live public hashes and match the B1-512C receipt exactly:

- `app.cbe2999f0c70.js` ↔ live public app SHA-256 `cbe2999f0c70cd31617d4c1ee2f1f35ed71c1d166723509eb4c060fbfb6c46a5`
- `styles.5e18315007aa.css` ↔ live public styles SHA-256 `5e18315007aafd2e16a1f5749842320c13386546bb677011789785979202c597`
- `auth.d2cfc4e447d2.js` ↔ live public auth SHA-256 `d2cfc4e447d23c2e6c164978221417a333764b33fd1dfea7cb1ae415b99118e6`

Verified by direct diff in this run: `public/app.js` differs from the deployed `dist/assets/app.cbe2999f0c70.js` **only** in the auth-import specifier (`'./auth.js'` vs the alias `'./d2cfc4e447d2'`). `public/styles.css` and `public/auth.js` are the deployed bytes modulo the same aliasing pass. Therefore the B1-513 prototype is built from the exact production presentation implementation, not an approximation.

Local hash record (this run, worktree files):

- `public/index.html` `f22b076b31adba2fb1e11a679efbca2e0fb87f33319e94235ed1ed0a507c630a`
- `public/app.js` `14759cdb33b4e0405ec6c7104cda53413919d4eda06265f59c954685c0cb6f8d` (pre-alias source of live `cbe2999f…`)
- `public/auth.js` `d2cfc4e447d23c2e6c164978221417a333764b33fd1dfea7cb1ae415b99118e6` (identical to live)
- `public/styles.css` `ec06163b92987bcf0d986096af6f3cea1c4fd1cba193c84fecc5e685c12372e2` (pre-alias source of live `5e183150…`)
- `public/missionmed-logo.png` `f091d62ac5842cde0e9e455321839fd98b291598478aae6ce13b09ea3896ff56` (identical to live alias)

## 2. Identity and authority facts

- Founder WordPress identity: user `1`, username `brinyu`, StoryForge UUID `09c3b822-75e7-4f3f-bd3f-58afc0865a78`; persisted StoryForge role remains `student` (preserving seven owned stories) with the `adminConsole` capability granting the persistent Student ↔ Administrator View toggle (B1-511A correction).
- WordPress user `107`, `Brian_test`, StoryForge UUID `56bb6d8a-4957-4ba6-abe1-7f77046061c8`, remains an additional administrator.
- Trust chain: WordPress session + LearnDash entitlement → product gateway signs short-lived JWT (issuer/audience/expiry/JTI/WP user/eligibility/role) → Railway API verifies → PostgreSQL transaction actor + least-privilege `authenticated` role + RLS. One canonical frontend release for all identities; capability differences are signed and server-enforced.
- Feature flags (DB `sf_feature_flags` + env kill switches): `story_workflow`, `story_taxonomy`, `inline_priority`, `story_search` = `eligible_all`; `admin_console` = allowlist (Founder); `mentor_notes` = controlled two-identity pilot; `voice_capture` = `eligible_all`; Content & Display force-off = `0` (active); `STORYFORGE_STORY_MEDIA_FORCE_OFF=1` (private story media built but force-off pending its two activation gates).

## 3. The live product, surface by surface

All line references are to production `public/app.js` (8,466 lines, sole renderer) and `public/styles.css` (1,497 lines).

- **Shell**: dark MissionMed//Storyforge brand; header (`MissionMed//Storyforge` + `MISSION:RESIDENCY DIVISION`), Matrix back-links, left rail nav, `viewChip`, omni search, New Story CTA. `renderShell()` 1047–1093. Fonts: Archivo (display), Rajdhani (labels/numerics), Lora (story prose). Tokens in `:root` styles.css 61–68.
- **Student/Administrator View toggle**: `roleSwitch` in the rail; gated by `user.role === 'student' && capabilities.adminConsole` (693–709); no logout, one release.
- **Home**: time-of-day first-name greeting, "The One Where" hero capture with mic, memory prompt, Unfinished stories (Finish It cards with `data-completion-guidance="finish"`), From your mentor, Where your stories stand. `renderHome()` 1214–1286.
- **Library**: search combobox with suggestions, status/sort/star/bird/position selects, category/intended-use facets, inline 1–5 priority pickers (student priority = `student_score`, sorted 5→1, unrated last), story rows with status chips/score embers/audio chips. 1287–1465.
- **Story Detail ("Story Room")**: overlay dialog; audio replay card (permanent original audio, seekable); two tabs — Original telling (read-only, "🔒 Preserved exactly as first told") and Working version (title/text/Learning Lesson editors, explicit `Save working version`, durable-save language); reflections; right rail: submit/review card (submission = reviewer access, withdraw = Return to Private), scores (student self-rating + mentor score, stars), classification, categories, interview questions, intended uses, mentor feedback, mentor notes, History. `renderStoryRoom()` 4226–4360. Completion guidance (B1-512): exact Founder copy at 4261, red-accent incomplete outlines, `!` icons, focused first missing field.
- **Quick Capture**: `openCapture()` 2238–2341, `voxDock` recorder with states idle/arming/rec/paused/review/error, live transcript merge preserving user edits, flagged-term fixes, IndexedDB offline segments, server draft autosave, 20-minute cap.
- **Recording/transcription/replay**: segments → provider transcription (GPT-4o primary, Whisper fallback), immutable provider original established before edits, permanent audio + Library replay with pointer/keyboard seek (B1-510K).
- **Submission/review workflow**: private → awaiting → in_review → changes/reviewed/approved; withdraw/resubmit; row-versioned, audited; private absent from reviewer lists AND direct-ID reads. Statuses/labels/hints frozen in `STATUS` 41–72.
- **Founder Administrator View**: Admin Home (5 metric tiles + big actions), Students (bounded server-authorized search of students with submitted work), Review Queue, Story Review (status/score/suitability selects + student-visible feedback + internal notes + taxonomy chips), Question Library, Release Controls (Content & Display editor, admin-console gate, voice scope, voice health, scope audit). 6400–6835, 1596–1885.
- **Mentor notes**: separate domain (`sf_mentor_notes`/`sf_mentor_note_media`), draft→publish lifecycle, editable transcript before publish, short-lived signed playback, internal notes never student-visible; runtime + DB double gates.
- **Content & Display (B1-512)**: versioned, audited, optimistic-locked bounded configuration of taxonomy labels/order/state (stable IDs), five section titles/helpers/modes (`visible_optional|visible_required|hidden`), Interview Prep visibility; browser-only preview then publish; restore defaults.
- **Settings**: Background environment (6 environments: Emberlight, Aurora, Night Constellation, Deep Tide, Meridian, Static Dark) with Selected/Saved/Preview state and Preview/Save/Cancel; Global text size Standard/Large/Extra Large (root typography via `data-text-size`, `--b1512-reading-add`), Preview/Save/Cancel; account rows (signed-in, view access, timezone, reduced motion, Back to Matrix). 1485–1533.
- **Environments/motion**: canvas engine (deterministic RNG; ember/constellation painters; aurora/tide/meridian/static CSS-only), energy states low/active/recording/success, hard reduced-motion bail (JS 8395–8396/8426–8430 + CSS kill blocks), no full-screen strobe.
- **Interview Prep**: fully implemented Question Library/Workshop with the **Next Natural Questions (NNQ)** panel — "Your answer creates the interviewer's next question. Map them here, prepare each one, and you become difficult to surprise." (5462–5463). Hidden by reversible configuration (`navigation.interviewPrepVisible=false`); data and implementation intact.
- **Text sizes**: `body[data-text-size]` sets root font 14/16/18px + `--b1512-reading-add` 0/2/4px across controls and prose (styles.css 1457–1463).
- **Accessibility**: landmarks, combobox semantics, pressed states, `aria-invalid` only on submit intent, meter roles on score embers, reduced-motion honored, conformance suite 72/72 at cutover.

## 4. Canonical vocabulary (Stage 2 must reuse, not rename)

"StoryForge", "MissionMed//Storyforge", "MISSION:RESIDENCY DIVISION", "The One Where", "Story Library", "Original telling", "Working version", "Learning Lesson", "Finish it", "Submit for review", "Return to Private", "Awaiting review / In review / Changes requested / Reviewed / Approved", "Student View / Administrator View", "Release Controls", "Content & Display", "Question Library", "Next Natural Questions (NNQ)", "Memory prompt", "Emberlight" et al., "Standard / Large / Extra Large", "Back to Matrix".

## 5. Existing schema surfaces relevant to Stage 2 (from migrations in-worktree)

- B1-510I `20260801190000`: admin console bounded SECURITY DEFINER functions, audit, `admin_console` flag.
- B1-511 `20260805190000`: submission workflow states + transitions, categories/intended-uses taxonomy (stable IDs), priority reuse of `student_score`, mentor notes domain + FORCE RLS + deletion intents.
- B1-511A `20260806130000`: WordPress Founder authority correction (brinyu student + adminConsole; Brian_test admin).
- B1-512 `20260806190000`: per-user `reading_size_preference`, versioned Content & Display configuration (`sf_product_configuration`-class storage, optimistic versioning, audit), taxonomy option metadata, private story media tables + RLS + RPCs + deletion intents (force-off), server-enforced submission requirements from published section modes.

## 6. What Stage 2 inherits as regression-protected

Everything in §3 plus: JWT/RLS/entitlement chain unchanged; one renderer; additive migrations only; immutable originals; append-only audit; independent default-off feature flags; deterministic releases with immutable Kinsta pointers and Railway rollback; backups + restore rehearsal before production writes; Founder-first canaries; Critical Systems zero-failure gate.

## 7. Baseline gaps Stage 2 addresses (from B1-512_FABLE_STAGE2_INPUTS.md)

Not implemented in Stage 1, deliberately left to Fable Stage 2 with no placeholder UI or speculative schema: multi-version tellings (Original/Full/30-Second/NNQ Setup), per-version voice+typing with Append vs Retell, timestamped history, recording retention/deletion, the Inspiration wizard (who/relationship/domain/energy, ≤3 choices per step, curated admin-governed prompts, save into canonical Library), narrator identity/relationship subtype.
