# B1-513R Settings and Content Studio Contract

## 1. Student Settings (shot 31)

Grouped IA over the preserved production panels — nothing invented, nothing filler:

- **Appearance** — the exact production Background environment panel (Selected/Saved/Preview state, Preview/Cancel/Save) and Global text size panel (Standard/Large/Extra Large, Preview/Cancel/Save); reduced-motion status row remains in Account.
- **Story preferences** — only defensible defaults: the new-story visibility default readout (derived from the mentorship choice, with the per-story escape hatch explained) and the spoken-time-guidance readout. Both are truthful state displays, not invented knobs.
- **Mentorship & privacy** — the inherited consent panel: status, receipt, policy re-read, per-story control explanation.
- **Notifications** — where StoryForge notifications land, live unread count, open action. (No email-preference invention; if a notification-email path ships later, its preference lands here.)
- **Invitations** — live Request-a-Story management: every invitation with contributor, masked email, status chip, expiry, Resend (capped) and Revoke (always available until revoked).
- **Identity** — avatar row: current state + CREATE/UPDATE MY AVATAR (doc 11).
- **Account** — the production signed-in/view-access/timezone/reduced-motion/Matrix rows, unchanged.

## 2. Content Studio (admin — shot 46)

Everything students *read*, in one governed place; stable IDs, plain text only (no HTML/CSS/JS), validate → browser-only preview → optimistic-versioned audited publish → restore defaults — the proven Content & Display machinery re-homed:

- Story categories + intended uses (labels/order/state; stable IDs).
- Story sections (titles/helpers/modes incl. required-for-submission).
- **Version labels** (Full Story/30-Second/NNQ label, helper, recommended target, visibility; Original locked as provenance-protected; full_story unhideable).
- Navigation visibility (Interview Prep toggle).
- **Inspiration questions** — the inherited manager: stable-ID rows, wording edit, active/retired, add (follow-up required, lands Retired), dimension filters, student-wizard preview.
- **Request-a-Story prompts** — same governance model over the contributor library (13 relationships, 48 prompts); ships Founder-reviewed with the full editor arriving in the R4 content-depth release; the Studio meanwhile shows the library state and the contributor-experience preview.
- **Question Library** — preserved intact, linked from here (de-emphasized, not deleted).

## 3. System Controls (admin — shot 47)

Authorization and runtime state ONLY, deliberately hard to change by accident: feature scopes (off/allowlist/cohort/eligible_all ladder), allowlists/cohorts, admin-workspace gate, kill-switch states, voice health (content-free), scope audit tail, release/runtime identity. The Content & Display editor is gone from this page (a pointer note remains). Guard rails: destructive scope widenings keep the existing typed-confirmation patterns; nothing on this page edits student-facing text.

## 4. Contract notes

Split is presentation-layer re-homing of existing bounded surfaces — no new schema, no new authorization paths; the same audited endpoints serve both pages. Flags: Studio/System split ships with the base V2 admin release; each governed domain keeps its own force-off (Content & Display, inspiration_admin, request_a_story). Rollback = flag off → the B1-512 Release Controls single page returns exactly.
