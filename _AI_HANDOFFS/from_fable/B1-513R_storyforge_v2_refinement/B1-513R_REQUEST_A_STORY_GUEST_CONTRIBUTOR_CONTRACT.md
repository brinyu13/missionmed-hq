# B1-513R Request a Story — Guest & Contributor Contract

The one genuinely new attack surface in V2, specified defensively. Inspiration helps *me remember my stories*; Request a Story helps *people who know me remember stories about me*.

## 1. Identity model — narrow guest capability, not an account

A guest is **a magic-link capability bound to one invitation**, never a MissionMed/WordPress/LearnDash identity. No account is created; the existing architecture does not require one (the WordPress trust chain remains untouched — the guest surface is served by the StoryForge app with its own bounded route class). A guest link grants exactly: read the invitation greeting payload; submit ≤3 contributions to that invitation. Nothing else — no Matrix, LearnDash, Library, other-student data, admin, Settings, or any general MissionMed privilege. The guest payload is PII-minimal by construction: student first name, avatar headshot/full-body render, personal message, relationship-scoped prompts, disclosure text — no student ID, email, stories, or any second student's anything (probe 18).

## 2. Invitation record (`sf_story_invitations`, additive)

student_id · contributor first name (display only) · relationship (stable ID from the contributor library) · email (stored for delivery; **masked everywhere in UI**; never in guest payload or story provenance) · token_hash (see §3) · status draft→sent→opened→contributed | revoked | expired · personal_message · video_greeting_media_id (nullable; §6) · disclosure_version · created/sent/opened/contributed timestamps · expires_at (default 30 days) · reminders_sent · append-only audit for every transition. RLS: owner-student full control via owner policies; admin visibility via bounded function (counts/status only); FORCE RLS.

## 3. Token security (red-team P1-1/P1-2/P1-3 — closed)

- Token: ≥128 bits from a CSPRNG; **only the SHA-256 hash is stored**; lookup by hash with constant-time comparison. (Prototype now generates 128-bit CSPRNG tokens; demo-named seeds are prototype fixtures only.)
- Guest endpoints are rate-limited per IP and per token (attempt caps + backoff) and never distinguish "unknown" from "revoked-then-deleted" beyond the safe states below.
- **Expiry enforced server-side on every guest request** → 410 `invitation_expired`; revocation → 410 `invitation_revoked`, immediate, student-controlled at any non-revoked status (including after contribution — the kill switch is always the student's).
- Contribution cap: 3 per invitation, then 429 `invitation_complete` (spam/harassment ceiling); each submission size-bounded; voice uploads ride the existing recording pipeline's limits.
- A leaked link exposes: first name, avatar, greeting, prompts — and the ability to submit text the student later reads. It exposes zero stored student content. Residual risk documented; expiry + revoke + cap bound it.

## 4. Contributor experience (the elderly-grandparent law)

One screen, one decision at a time, phone-first, ≥44px targets, no account, no jargon: **[avatar] "{First} asked for your help."** → optional video greeting → "You do not need to write perfectly. You can simply talk." → **🎤 TELL A STORY** primary / **TYPE INSTEAD** secondary. One warm relationship-aware question at a time with "↻ A different question"; the exact StoryForge recorder pattern (big red state, live transcript, "■ I'm finished"); review-before-send with editable transcript; explicit **SEND TO {FIRST} ➤**; warm thanks + optional "tell another." Nothing saves until Send (stated on screen).

**Disclosure (P1-4 — honest about downstream use):** the landing states, in contributor-plain language, that the story goes to the student's *private MissionMed StoryForge workspace*, that the student *may use it in residency preparation and may share it with their MissionMed mentor*, that it is never public, other students never see it, and they can stop at any time. Versioned (`disclosure_version` on the invitation); **exact external wording requires Founder approval (FD-R2)** before any real email/guest page ships.

## 5. Contributions (`sf_story_contributions`, additive)

invitation_id · kind text|voice · transcript (contributor-edited) · recording/audio refs via the existing pipeline · submitted_at · state new→favorite|archived|promoted · promoted_story_id. Candidates are **not stories**: they live in the student's Request-a-Story inbox (read/listen/favorite/dismiss — dismiss archives, never deletes contributor work). **PROMOTE TO STORYFORGE LIBRARY** creates an ordinary canonical story via the existing creation path with `origin {type: contribution, invitation_id, relationship, contributor first name}` — first-name-only provenance, no email (probe 21). **Promoted stories always start Private** regardless of the student's consent default — the contributor was promised a private destination; the student widens per story afterward (probe 22). Contributor voice promoted as audio preserves the recording as the story's truthful original audio.

## 6. Student video greeting

Optional short private video that plays on the guest landing. Architecture: **the existing deferred private Story Media design, unchanged** — same bounded duration/size classes, private R2 namespace, signed playback URLs (short-lived, served to the guest page through the invitation-token authorization), ownership by the inviting student, replace/delete with durable deletion intents, invitation association via `video_greeting_media_id`. **Remains force-off with Story Media's own gates; this Fable run activates nothing.** Prototype shows the state contract only. Fallback: landing renders identically without it.

## 7. Email invitation

Preformatted, previewable before every send (prototype shows exact preview); send/resend/revoke with delivery status; expiry stated in the mail; **restrained reminders** — resend counts against a hard cap (2 reminders per invitation), rate-limited, all audited. Sending uses whatever already-approved MissionMed mail path exists at implementation time; if none is approved, R-email ships behind its own flag with Founder-manual send as interim (documented in doc 13). External copy = FD-R2.

## 8. Contributor prompt library

`B1-513R_CONTRIBUTOR_PROMPT_LIBRARY.json`: 48 MissionMed-original prompts across all 13 required relationships (parents, siblings, spouse/partner, grandparents, cousins, best/childhood/medical-school friends, faculty, mentors, coworkers, supervisors, teammates), episodic and warm, `{name}` templated, no literacy assumptions, no trauma demands (loss-adjacent prompts carry in-text comfort exits), no copied banks (red-team §3 PASS). Governed like Inspiration content: stable IDs, retire/restore, versioned publish through Content Studio (editor depth in R4).

## 9. Flags & rollback

`request_a_story` (student UI + invitations) and `guest_contributions` (public guest surface) — two independent DB flags + env kill switches, default off; guest surface additionally dies instantly by revoking all tokens (status sweep) without touching the student UI. Rollback preserves all invitation/contribution rows dormant.

## 10. Test matrix (seed: verify/probes-r.mjs 16–23, all green in the prototype contract)

Invalid token 404 · revoked 410 · expired 410 · cap 429 · guest payload minimality · cross-student invitation ops 404 · cross-student promotion 404 · promotion provenance PII-minimal · promotion starts Private · guest cannot reach any authorized API (401 on all `/api/*` outside the guest route class) · enumeration resistance (hash lookup + rate limit) · email masked everywhere · reminders capped · audit rows on every transition.
