# B1-513R2 — Request a Story: Postmark & Guest Contract (pass-2 delta)

Authority: B1-513R doc 09 (guest security architecture: CSPRNG hash-stored tokens, server-enforced 30-day expiry → 410, contribution cap 3 → 429, revoke-anytime, honest disclosure, promotion-starts-Private) stands unchanged. Pass 2 adds the send pipeline contract, the truthful lifecycle, and relationship journeys.

## 1. Postmark reuse (verified pattern, not a new architecture)

StoryForge invitations are **MissionMed transactional mail personalized around the student** — implemented by reusing the proven USCE Offer pattern verbatim in shape:

- `POST https://api.postmarkapp.com/email` with server token; outbound stream.
- **Triple gating** exactly as USCE: `STORYFORGE_POSTMARK_ENABLED` / `_DRY_RUN` / `_LIVE_SEND_ENABLED` — all three must open before a real email leaves; DRY_RUN renders and logs without sending. Defaults off at every release.
- **Signed delivery webhooks** drive state: `Delivery` → `delivered_at`, `Bounce` → `bounced_at` + `bounce_reason`, `SpamComplaint` → suppress + flag, `Open` → optional `opened` (always labeled approximate; never called "read"). Status is never set optimistically by the send call — the UI's truthfulness depends on this.
- **From/Reply-To: VERIFY at Codex time, never assume.** USCE precedent: `MMI Clinical Rotations <clinicals@missionmedinstitute.com>`. Whether `storyforge@missionmedinstitute.com` exists as a verified sender identity must be checked against the live Postmark server; the visible From name is part of FD-R2. The prototype's email preview carries this verification note inline so it cannot be forgotten.
- Explicitly NOT built: another provider architecture, student Gmail OAuth, universal mail infrastructure, marketing streams.

This Fable run sent no real email and touched no credentials — the prototype simulates accept→delivery to demonstrate the truthful state machine.

## 2. Truthful invitation lifecycle (the product's honesty contract)

`DRAFT → SENT → DELIVERED → LINK VISITED → STARTED → STORY SHARED`, with `EXPIRED / REVOKED / BOUNCED` as exits. Rules, each probed on the prototype:

- Nothing sends from the create form; **send happens only from the full-email preview** (`CONFIRM & SEND`). Drafts are editable (`update`), sent invitations are not (409 `invitation_locked`).
- `SENT` means accepted by the provider; `DELIVERED` only on the Delivery webhook. The UI wording matches ("Handed to the email service… you'll see Delivered when it confirms").
- `LINK VISITED` (first GET of the guest page) is the strongest honest pre-story signal and is first-party — favored over email opens. `STARTED` stamps when the guest enters the contribution experience (voice or type); it never demotes `STORY SHARED`.
- `BOUNCED` is terminal: send/resend refuse with 409 `invitation_terminal`; the UI offers **Re-invite with a new address** (fresh invitation, fresh token; the dead link stays dead). Bounce reason is shown to the student.
- `REVOKED` kills the link immediately (410) at any time — deliberately including after stories arrived; received contributions are never deleted (`revokedAt` recorded).
- Rows show: recipient, relationship, masked email, last meaningful event ("visited their link 2 days ago"), stories-shared count, expiry, status chip with an honest hover explanation, reminder (rate-limited, counted), revoke.

## 3. Relationship-aware guest journeys (§15–16)

Journeys are composed from the governed contributor library (48 prompts, 13 relationships, stable IDs) — not separate content systems. At create, relationship is allowlisted against the library (400 otherwise). The guest payload carries a relationship-specific welcome line and a curated prompt ordering:

- **Parent/family** — leads with childhood, kindness, persistence, family humor, responsibility, formative moments ("You watched them become who they are…").
- **Best/longtime friend** — life outside medicine, adventures, mistakes, loyalty, humor, growth ("You know the version of them that exists outside medicine…").
- **Faculty/mentor** — feedback, professionalism, learning, clinical growth, teamwork, initiative ("You have seen how they learn, take feedback, and grow…").

Guest UX stays radically simple: student avatar + first name, optional video greeting (deferred media, state demo only), personal note, a 1-2-3 orientation strip, `🎤 TELL A STORY` primary / `TYPE INSTEAD` secondary, one question at a time with "a different question", full review-before-send of their own words, honest disclosure (pass-1 P1-4 wording), and a thank-you that invites one more. Guests are assumed to know nothing about StoryForge, MissionMed, residency, or ERAS.

## 4. Bounds on the unauthenticated surface

Token-scoped only; no enumeration (404 uniform for unknown tokens); transcript ≤ 20,000 chars; duration ≤ 30 min; cap 3 contributions per invitation; every write idempotent or capped. Production adds IP rate limiting and constant-time token compare per doc 09.
