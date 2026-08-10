# B1-513 Independent Verification Summary

Eight dimensions verified; evidence generated in this run. P0/P1 tally after remediation: **0 open**.

## 1. Canonical continuity — CONFIRMED (byte-level)
Worktree `public/app.js`/`styles.css`/`auth.js` proven byte-equivalent to the deployed release assets (dist alias filenames = live hashes from the B1-512C cutover receipt; direct diff shows only the auth-import alias). Prototype built from those exact bytes by `build.mjs` with 28 enumerated anchored patches; build fails loudly on anchor drift. Continuity audit: 0 REDESIGNED surfaces.

## 2. Product/UX — CONFIRMED
Full scripted walkthrough (snap.mjs, 54 screenshots) across both views, four viewports, three text sizes, reduced motion: zero console/page errors on the final build. macOS test: every learned surface in place (screens 01/02/03/04/18/20/28); new capability discoverable additively.

## 3. Pedagogy — CONFIRMED-WITH-FINDINGS → remediated (V3_PEDAGOGY.md)
Fresh-context verifier: 7/7 spot-checked sources real and accurately characterized; 81 prompts original (2 near-stock items reworded); 27-cell coverage verified computationally; safety design held under adversarial reading. Findings: 0 P0, 2 P1, 8 P2. **Both P1s fixed**: follow-up probe now reveals on typed input without re-render; conversion row added (student-visible "why this works in an interview" + optional change-note that seeds the promoted story's Learning Lesson); docs corrected to match mechanism. P2 remediations: arithmetic corrected (34 territories single-prompt; 48 non-self prompts), q-004/q-035/q-046/q-059/q-060/q-073 reworded/strengthened with exits, back-then-forward draft loss fixed, admin add-question now requires a follow-up and lands Retired pending completion, seed provenance corrected, research-notes caveats added (reminiscence-bump population; induction-duration extrapolation), library meta flow claim aligned to shipped R3.

## 4. Data model — CONFIRMED (probes 10–12, 19/19 PASS)
One canonical story stays coherent: version retell/restore proven monotone (no transition loses text); original/full_story unrepresentable through the version API; Inspiration promotion writes ordinary canonical stories with provenance.

## 5. Privacy — CONFIRMED (probes 7–8, 12, 14–15)
Visibility/submission orthogonality enforced (submitted→private blocked pending withdraw); pre-consent default private, post-consent default mentor-visible, historical stories not silently converted; visibility changes audited to story history; Review Check text truthful per actual state.

## 6. Security — CONFIRMED at the contract level (probes 1–9, 13)
Cross-student direct-ID 404/P0002, cross-student writes denied, admin direct read of private story 404, directory lists mentor-visible/submitted only with private as counts, unknown identity 401, student→admin 403, non-owner visibility denied, Review Check rate-limited. (Prototype enforces the demonstrated contract; production enforcement is PostgreSQL RLS per docs 10/11/14 — these probes become the seed of the production negative suite.)

## 7. Accessibility — CONFIRMED (a11y-results.json, final build)
axe: 0 serious/critical on home, library, story-room (30-second tab), inspiration question, settings, admin directory, admin story review, consent modal. One moderate `skip-link` finding is the prototype-only `#matrix-prototype` placeholder href. Keyboard: version tabs proper tablist and Enter-activates; stars are a labelled radiogroup with arrow/space operation and polite live announcement; 390×844 zero horizontal overflow on all six probed surfaces; reduced-motion boot verified static-rich.

## 8. Adversarial — CONFIRMED-WITH-NOTES
No duplicate systems (Inspiration promotes into canonical stories; recorder/audio/notification domains reused). No migration traps (zero-copy versions; NULL-visibility legacy semantics; no backfills). No accidental redesign (0 REDESIGNED). Known accepted P2 notes, documented for Codex in doc 22 §4: consent modal not yet in the production overlay focus-trap list (focus can escape in the prototype); prototype voice is simulated; in-memory persistence. None affects the architecture contracts.
