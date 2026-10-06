# TIMELINE V1.1 RELEASE CANDIDATE — 2026-10-06

SOURCE SHA: acefa67b7c365f09d2fc5aa3f962cc6634824cbe (branch codex/timeline-astra6-recovery-20261002;
commits 64caa03, dd6ced2, a14d38c, acefa67 on top of db5f2e7). This file is a docs-only commit
after the sealed source; the release build was made from a fresh detached worktree at acefa67.

PRODUCTION CURRENT: WordPress pointer releases/timeline-wp-44668d273914448c (source release
timeline-6adaa07191f8e671, runtime SHA-256 107531d7…5201ae6); API deployment
ba12dd1b-3d0b-48ae-ba6a-78c3a46b5913 (unchanged; this candidate touches no API or plugin PHP).

CANDIDATE CHANGES: structured MyERAS CV read, identity gate (document identity vs Timeline name,
explicit keep-current never overridden), simplified review, Founder year-domain rule, Guardian
concise-label repair, five template slots on every surface, destination-specific Interview Day
block (program, date, logo well), final-PDF slot rule (unfilled slots omitted; PPTX keeps
editable placeholders), flag labels wrap before the interview pennant, admin roster marks
authorized QA accounts. Entitlement predicate untouched. Dirty donor work preserved uncommitted.

| Gate | Result |
|---|---|
| AFTHAB REAL-CV ACCEPTANCE | PASS (identity, dates, institutions, categories, 36 items / 13 ready / 0 attention) |
| IDENTITY | PASS (independent review found and this candidate fixed the keep-current prefill gap; re-verified PASS) |
| REVIEW UX | PASS |
| YEAR DOMAIN | PASS (2025–2026; Founder decision 1 applied) |
| GUARDIAN | PASS (concise labels presentation-only, undoable; Founder decision 2) |
| PHOTOS | PASS (3 slots; upload / library / drop; carried into deck; omitted from final PDF when empty) |
| PROFILE PHOTO | PASS (own-library only; export resolver bound to the current document) |
| INTERVIEW DAY | PASS (program + date + logo; A → B switch leaves nothing stale) |
| PDF | PASS (Letter, 1 raster page, inspected: identity, years, experiences, labels, photos, block; no placeholder wording, no clipping after the pennant fix) |
| PPTX / KEYNOTE | PASS for the deck (0 inspection errors, 10 images, 65 texts, placeholders present); Keynote edit/save/reopen NOT RUN — desktop control declined in this session |
| ENTITLEMENT | PASS — REAL STUDENTS: 19 · QA ACCOUNTS: 1 (iiq1203 InterviewIQ Discovery QA, IV Prep Complete enrolled; predicate unchanged; labelled in admin roster) |
| STUDENT-B CONTAMINATION | NEEDS FOUNDER DECISION (real Founder-authorized student, contaminated current document visible to them, no in-app prior version; test artifact by content; exact bounded cleanup: reset/archive document timeline_6490fc8e-… for WP user 141 via the guarded admin path, keeping the record as audit evidence) |
| INDEPENDENT REVIEW | PASS (after acefa67; non-blocking notes: standing AI-consent wording; TITLE_ONLY narrative only in stored original extraction) |
| RELEASE BUILD | PASS — release_id timeline-99d89afc60938da2, WP runtime timeline-wp-e3ea02e42a67168c, 77 files, 77 hashes verified, 28 runtime assets verified against the accepted manifest (49ba56d); built from a clean fresh worktree at acefa67 with the SHA-verified accepted asset root |
| PROTECTED DEPLOYMENT | BLOCKED — awaiting Founder deployment approval and fresh leases/custody per PRODUCTION.md |

BLOCKER: none technical. Required Founder authorizations before any production mutation:
1. Deployment approval for WordPress runtime release timeline-wp-e3ea02e42a67168c (Timeline-only;
   no shared Matrix asset writes; API unchanged), with fresh Timeline/product leases, backup
   and restore boundary, rollback to releases/timeline-wp-44668d273914448c.
2. Student B cleanup decision (reset/archive vs leave), executed only through the guarded admin
   path under its own lease.
3. Whether the InterviewIQ QA account should keep IV Prep Complete enrolment (its Timeline access
   follows that enrolment) — InterviewIQ/Founder call.
4. Optional: wording for the per-upload AI consent box now that it records a standing consent.

Full-suite receipts, artifacts and production read-only evidence: ignored private directory
`.timeline-recovery-20261002/field-repair-20261006/` (release-candidate-acefa67/, rc-*.pdf/pptx,
full-suite-receipt-candidate-acefa67.txt). Full .mjs suite on the candidate shows no new
failures versus a clean checkout of 64caa03.
