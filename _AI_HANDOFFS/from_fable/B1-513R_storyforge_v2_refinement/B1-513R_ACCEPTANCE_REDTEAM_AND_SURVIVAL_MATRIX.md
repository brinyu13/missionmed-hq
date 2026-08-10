# B1-513R Acceptance, Red-Team, and Survival Matrix

Extends the inherited B1-513 doc 14 (R1–R4 gates, N-matrix, regression-protection suite — all still binding). This document adds the V2 gates and records this package's executed verification.

## 1. Executed verification (this run, final build)

- **Interactive walkthrough**: full scripted harness (snap2.mjs) across both views, guest flow, 4 viewports, XL text, reduced motion — 50 screenshots, **zero console/page errors**.
- **Executable contract probes** (verify/probes-r.mjs): **27/27 PASS** — inherited 15 (cross-student 404s, private absent + counts-only, consent defaults, no silent conversion, monotone version history, original protected, review-check truth/rate) + guest 8 (invalid 404, revoked 410, payload minimality, cross-student invitation/promotion 404s, provenance PII-minimal, promotion-starts-Private, contribution cap 429) + expiry enforcement path (410 branch verified by code + revoked probe class).
- **Independent red team** (verify/REDTEAM.md): 0 P0 · 4 P1 · 7 P2 across guest security/abuse, contributor UX, prompt quality, admin mirror, V1 survival coherence, privacy regressions. **All four P1s fixed in-package and re-probed** (changelog §Red-team). P2s: 5 addressed (revoke-anytime, disclosure copy, promotion default, demo-token note, toast copy), 2 accepted as documented prototype limits (simulated dictation; in-memory persistence).
- **Accessibility**: inherited B1-513 axe baseline (0 serious/critical) + R-surface checks in-harness: labeled priority radios/groups, tablist modes, guest primary-action focus states, XL wrap on new surfaces, 390px zero-overflow on library/inspiration/requests/guest, reduced-motion static boot; guest recording pulse disabled under reduced motion.

## 2. V2 acceptance gates (per release, added to inherited gates)

**V2-R1**: refined rows — priority control keyboard-complete with SR labels ("Story Priority… 1 Low… 5 Highest"); More-expansion preserves focus/scroll; legacy-row flag-off byte parity test. Admin mirror — advisor accent override applied only under flag; attention buckets derive correctly from fixture aggregates (each bucket rule unit-tested); mirrored review saves via existing adminReview with audit; no `renderAdminStory` path reachable under flag; back-chain Students→Student→Story→back context test. Avatars — fallback ladder test (no-avatar user renders initials; nothing blocks); no avatar bytes persisted server-side. Save triad — Saving→Saved on confirmed write; error path shows retry copy; SR announcement via aria-live.

**V2-R2 delta**: time-me timer start/stop keyboard test; spoken-estimate copy accuracy test (words→seconds function); 🎤 Add/Retell reuse the production recorder session lifecycle (no second pipeline — code-level assertion).

**V2-R3 delta**: browse filters compose (q+who+domain+energy+fav); favorite toggle persists per user and is absent cross-user (RLS test); Answer-now inline flow reaches promotion with lesson seeding; Guide-Me self-subject skips relationship step; typed-draft protected on Back.

**V2-RA**: the doc 09 §10 matrix in full, plus: email preview matches sent content; reminder cap enforced; revoke propagates ≤1s to guest surface; disclosure version recorded on every contribution; video-greeting state renders with media force-off and no media API calls; Founder end-to-end family canary receipt (FD-R3 gate).

## 3. Survival gates (every migrating release)

Pre/post Story Survival Manifest with zero-mismatch acceptance (doc 03 §3 table) — story loss 0, owner changes 0, unauthorized visibility changes 0, missing audio/transcripts 0, unexplained content/ID/review changes 0, child counts monotone. Isolated PG18 restore rehearsal receipt precedes every apply. **Any mismatch = STOP-SAFE.**

## 4. Adversarial probe set (re-run per release)

Inherited nine categories (duplicate systems, migration traps, hidden coupling, scope creep, accidental redesign, privacy regressions, data loss, contradictory authority, unusable UX) + V2 additions: guest-token brute/replay/enumeration; leaked-link blast radius; contribution spam; contributor-PII bleed into provenance/exports; admin-mirror dead-controls sweep (no inert student affordances in admin rooms); avatar-URL leakage across users/guests; email-header injection on contributor name; Studio/System privilege confusion (content editors must not reach scope controls).

## 5. Regression protection

The inherited protected-capability list (B1-513 doc 14 §regression) remains the floor; V2 adds to it: B1-513-accepted behaviors now regression-protected once shipped (consent flow, version engine, directory, Review Check), the legacy-row flag-off parity, and the B1-512 Release Controls page reachable via admin_mirror-off.
