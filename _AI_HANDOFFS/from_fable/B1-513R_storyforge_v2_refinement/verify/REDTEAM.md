# B1-513R STORYFORGE V2 — INDEPENDENT RED-TEAM REVIEW

**Reviewer role:** Fresh-context adversarial reviewer (did not build it).
**Scope:** Guest invitation security/abuse, contributor UX, contributor prompt quality, admin mirror, V1 survival coherence, privacy regressions.
**Artifacts reviewed:** Founder ticket (B1-513R), `extensions2.js`, `shim.js`, `B1-513R_CONTRIBUTOR_PROMPT_LIBRARY.json`, inherited privacy/RLS architecture (`B1-513_MENTOR_VISIBILITY_CONSENT_AND_PRIVACY.md`, `B1-513_AUTHORIZATION_RLS_AND_MEDIA_BOUNDARIES.md`), screenshots 20/22/24/26/27/31/40/42/43/46.

---

## VERDICT

**READY WITH SPECIFIC FOUNDER DECISIONS REQUIRED** — no P0 breach in the demonstrated contract; the Request-a-Story guest surface (the only genuinely new attack surface) has 4 material contract gaps the production `B1-513R_REQUEST_A_STORY_GUEST_CONTRIBUTOR_CONTRACT.md` must close before Codex. Everything the ticket asked for on the student and admin sides is present and coherent.

**Counts:** P0 = 0 · P1 = 4 · P2 = 7

---

## P1 FINDINGS (material — production contract must close)

### P1-1 — Guest magic-link token is guessable / enumerable / harvestable
**Category:** security / guest abuse
**Evidence:** `shim.js` invite creation: `token: \`rs-${Math.random().toString(36).slice(2, 10)}\`` — a **non-CSPRNG**, fixed `rs-` prefix + only ~8 base36 chars (~41 bits, and `Math.random` is predictable). Demo tokens are literally human-guessable (`rs-demo-rosa`, `rs-demo-ken`, `rs-demo-sam`). The guest lookup route (`routeR`, `/api/requests/guest/:token`) is unauthenticated and has **no rate limiting or lockout**. A valid token returns HTTP 200 with the student's first name, headshot AND full-body avatar, the student's personal message, and the relationship label; invalid → 404, revoked → 410 — distinguishable responses enable enumeration.
**Failure scenario:** An attacker scripts the `/api/requests/guest/rs-*` space (or intercepts/forwards one link) and harvests student first names, avatar likenesses, and the personal notes students wrote — and can then submit contributions (see P1-3).
**Fix:** Production contract must mandate ≥128-bit CSPRNG tokens, no guessable prefix, constant-time uniform failure responses, and per-IP/per-token rate limiting + lockout on the unauthenticated guest endpoint. State this explicitly in the guest contract; the inherited RLS/Media doc does not cover guest tokens at all.

### P1-2 — Invitation expiry is decorative, not enforced
**Category:** security / guest abuse
**Evidence:** The guest route checks only `invitation.status === 'revoked'` (→410). It never checks `expiresAt`. The demo invitations carry **past** expiries (`expiresAt: days(-21)`, `days(-26)`, `days(-29)`) yet still resolve and serve prompts, and the contribution POST likewise never checks expiry. Meanwhile the UI everywhere advertises "expires Aug 29 / Sep 3 …" (screenshots 20/22) and the email copy promises "expires {date}."
**Failure scenario:** A link the student believes expired (or that they let lapse a season ago) remains a live, working ingestion channel indefinitely — directly contradicting the season/expiry model the ticket requires ("season/expiry, revocation").
**Fix:** Enforce `now() < expiresAt` server-side on both the guest GET and the contribution POST; return the same 410 as revoked. Add a test in the guest-abuse matrix. If the demonstrated (non-enforcing) behavior shipped, this is a P0 — treat it as P0-to-close in the production contract.

### P1-3 — Guest contribution endpoint: no rate limit, no single-use / terminal lock
**Category:** security / guest abuse
**Evidence:** `POST /api/requests/guest/:token/contribution` unconditionally unshifts a new contribution and sets `invitation.status = 'contributed'`. Nothing prevents a second, third, … Nth POST on the same token — a "contributed" (and even a past-expiry, per P1-2) invitation still resolves and still accepts submissions. No per-token submission cap.
**Failure scenario:** A leaked or forwarded link becomes an unlimited candidate-injection channel — a harassment/spam vector flooding the student's "Story candidates" queue. The student can only archive, not stop the source (revoke is hidden once `contributed`).
**Fix:** Contract must define contribution caps per invitation (e.g., N per link, then require re-invite), keep the token revocable in every non-terminal state, and rate-limit contribution POSTs. Consider single-active-session semantics tied to invitation ID.

### P1-4 — Contributor disclosure ("goes only to {first}") understates downstream use
**Category:** privacy / consent
**Evidence:** Guest disclosure (both `shim.js` `disclosure:` string and screenshot 24) says: *"What you share goes only to {first} … It is never public."* But on **Promote** (`routeR` `/api/contributions/:id/promote`) the created story gets `visibility: consented ? 'mentor_visible' : 'private'` — for any consented student the contributor's story **defaults to mentor-visible**, i.e., observable by the student's authorized MissionMed mentor, and eligible for interview/application ("intended uses") downstream. The elderly-grandparent/non-writer contributor is told it goes *only* to the student.
**Failure scenario:** A grandparent tells a tender story believing it is a private gift to one grandchild; it is promoted and, by default, becomes readable by a mentor (Dr Brian) and usable toward a residency program. The consent they gave does not match the data flow.
**Fix:** External copy (already flagged FD-R2, good) must accurately state that the student may keep the story and *may share it with their MissionMed mentor / use it in applications*, and that it is never public or shown to other students. The founder-facing decision doc should carry this as a required copy change, not just "wording TBD."

---

## P2 FINDINGS (polish / must-document)

### P2-1 — Prototype client globals expose all-user data, undocumented
`window.__B1513 = { db, USERS, … }` (all students' private story text) and `window.__B1513R = { INVITATIONS, CONTRIBUTIONS, … }` (every student's invitations/contributions) are readable from any persona's console. This is inherent to a file://-only synthetic backend and the APIs themselves are correctly owner-scoped — but unlike the documented `blob:` caveat, this shortcut is **not** called out anywhere. Fix: the prototype-to-production mapping must state plainly that the client backend is not an authorization boundary and that production payloads are scoped per-user; no security conclusion may be drawn from client separation.

### P2-2 — "A different question" silently discards typed text (data-loss trap)
Guest handler `data-b1513r-guest-next-q`: `guest.text = guest.voice ? guest.text : ''` — in TYPE mode, tapping "A different question" wipes whatever the contributor typed with no warning. For the exact non-writer audience this flow targets, that is a real loss. Fix: preserve or confirm before clearing.

### P2-3 — Reminder/resend has no enforced cap despite UI claiming one
`inviteOp(..., 'resend')` just does `invitation.remindersSent += 1`; the toast says "counts toward the limit" but no limit exists. Contract must define and enforce the "restrained reminders" cap the ticket requires.

### P2-4 — Leaked link exposes more than "first name + prompts"
Guest GET returns the student's **full-body** avatar + personal message + relationship + the contributor's own first name — richer than the ticket's "first name + prompts" minimum. Reasonable for the invited contributor, but a forwarded/guessed link (see P1-1) leaks all of it. Fix: consider limiting the guest payload to headshot + first name + prompts and treating personal message / full-body avatar as sensitive; document the minimization decision.

### P2-5 — Two co-equal primary buttons on the guest review screen
Screenshot 27 shows both "🎤 START TALKING" and "SEND TO BRIAN" as orange primaries simultaneously, plus "A different question" and "‹ Back." The landing (24) and recording (26) screens nail "one obvious action"; the review screen dilutes it. For the stated elderly-user bar, demote one to secondary.

### P2-6 — Residual ambiguous dots/grammar
(a) Admin story-detail header (screenshot 43) still renders unlabeled priority dots/stars (`●●●●●○○○○○🕊`), the exact "ambiguous dots/stars" the ticket asked to eliminate — the labeled Mentor Score in the rail is good, but the header carryover is not. (b) Student workspace copy "1 private story **exist** and cannot be listed" → "exists" (screenshot 42). (c) `shim.js` submit route has dead code `story.status === 'changes' ? 'awaiting' : 'awaiting'` and a convoluted `story.revised = …` line.

### P2-7 — Admin "Needs Review" lists the reviewer as a student
Screenshot 40 shows "Dr Brian" as a student card under Needs Review — a founder-is-both-personas artifact, but in a real cohort the mirror should exclude the acting mentor's own identity from their attention buckets, or it reads oddly.

---

## DIMENSION VERDICTS

**1. Guest invitation security & abuse — CONCERNS (P1-1..4, P2-1..4).** Revocation is honored (410) and PII on promotion is minimized (first name + relationship only, no email carried to the story) — both good. The token model, expiry non-enforcement, contribution spam surface, and disclosure accuracy are the real gaps. Video greeting correctly stays a state-demo against force-off media (compliant with the "do not activate media" rule).

**2. Contributor UX (elderly-grandparent test) — PASS with one trap.** Landing (24): one headline, one orange primary "🎤 TELL A STORY," one secondary "TYPE INSTEAD" — exemplary. Recording (26): live transcript, "■ I'm finished," "Start over" — minimal and legible. Review/send (27) is slightly over-buttoned (P2-5), and the type-mode question swap loses text (P2-2). No literacy assumptions; "you can simply talk" reassurance is present. Overall genuinely usable.

**3. Contributor prompt quality — STRONG PASS.** All 13 ticket relationships covered (parent, sibling, spouse/partner, grandparent, cousin, best/childhood/medschool friend, faculty, mentor, coworker, supervisor, teammate). Prompts are episodic, warm, one concrete cue each, no literacy register, no US-centric anchors. Trauma-awareness is deliberate ("Share only what feels comfortable" on c-020; "Only if you're comfortable" on c-043). `{name}` templating is correct and resolved to first name in the guest route. No verbatim copies of known question banks detected. Minor: prompts are uniformly positive-relationship-framed, which is intentional for the product's purpose, not a defect.

**4. Admin mirror — STRONG PASS.** Reads as "StoryForge with superpowers," not a separate dashboard: same navy/orange shell, same Library-style cards with avatars (40/42), same Story Detail renderer for review with a distinct Mentor Review rail (43), cyan used only as a thin admin accent (ADMINISTRATOR VIEW pill, ADMIN badge). Context preserved Directory → Student → Story → Back (`‹ Students`, `‹ Maya Osei's stories`). No ledger feel in Students. Content Studio (46) is bounded (labels/taxonomy/versions, "No HTML, CSS, or scripts," stable IDs shown, System Controls split out). Only nits are P2-6/P2-7.

**5. V1 survival coherence — PASS.** Nothing in the R layer mutates existing rows, re-imports, or changes IDs. Promote and New Story both mint new IDs (`s-ctr-*`, `s-new-*`). `originalText` is never overwritten; Full Story PATCH edits `story.text` (the sanctioned V1 Working Version → V2 Full Story mapping). Submit sets `mentor_visible` only with an audited history line ("to Mentor Visible (submitted for review)") — not silent widening, and consistent with the inherited `observable()` contract (submitted ⇒ observable). Legacy `visibility:'private'/legacyPrivate` rows are never widened.

**6. Privacy regressions — PASS at the API layer.** Inspiration browse/favorites read the global prompt bank and owner-scoped favorites (`INSPIRATION_FAVORITES[me.id]`); no cross-student leak. Request-a-Story reads/writes are owner-scoped (`INVITATIONS[me.id]`, `CONTRIBUTIONS[me.id]`); promote/state/find fail closed on another user's IDs. Admin directory exposes counts only for private stories, never content/titles (matches N10–N12). Mentors cannot reach private/NULL stories (single-story route requires `observable`). The new-surface leaks are the guest-payload richness (P2-4) and the prototype globals (P2-1), both bounded/documentable — no student-to-student, guest-to-other-student, or mentor-beyond-`observable()` leak in the API contract.

---

## BOTTOM LINE
The student and admin experiences deliver what the ticket asked and preserve V1 semantics cleanly. The gating work before Codex is a rigorous **Request-a-Story guest contract**: high-entropy single-use tokens, enforced expiry, contribution rate limits/caps, reminder caps, and contributor disclosure that honestly names the promote → mentor-visible → application data flow. None of these are visible in the inherited privacy/RLS architecture (which predates B1-513R), so they are net-new obligations, not regressions.
