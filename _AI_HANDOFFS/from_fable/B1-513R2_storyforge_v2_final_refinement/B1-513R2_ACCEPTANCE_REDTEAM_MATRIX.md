# B1-513R2 — Acceptance & Red-Team Matrix

## 1. Executable evidence on this build

**Contract probes: 61/61 PASS** (`verify/probes-r2.mjs`, run against the shipped HTML). Composition: 27 inherited B1-513/R probes (cross-student denial, admin denial, private-as-count-only, version protection, retell/restore monotone history, consent non-retroactivity, review-check rate limit + truthful branching, guest token/expiry/cap/PII, promotion-starts-Private) + 27 R2 probes (pins per-user + ordering isolation, bulk parse/commit safety + student invisibility of drafts, admin-only import, draft-only invitation edit, full truthful lifecycle walk with no-regression, bounced honesty, relationship journey scoping, preference persistence, pagination bounds + caps, recommended round-trip, answered-state self-scoping) + 7 red-team regressions (RT-A×2, RT-B×2, RT-C, RT-E, RT-F).

**Walkthrough harness** (`prototype_source/snap3.mjs`): student + admin + three guest journeys + light/dark/auto + Ember Storm persistence + 4 viewports + XL text + reduced-motion dark and light — **zero console errors, zero page errors**, 50 screenshots in `screenshots/`. AUTO theme was asserted programmatically (resolves light under a light OS scheme).

## 2. Red team (independent, fresh context)

Report + resolution: `verify/REDTEAM_R2.md`. Outcome: **0 P0 · 3 P1 · 4 P2**, all resolved or contracted:

| # | Sev | Finding | Resolution |
|---|-----|---------|-----------|
| A | P1 | Retired/unpublished prompts leaked to students via `pinned[]`; pin endpoint validated nothing | Active-only serialization through every student path incl. pins; pin requires active question (RT-A) |
| B | P1 | `bulk-commit` trusted client rows; client `id` could shadow stable IDs and hijack admin edits | Server-side re-validation + server-generated IDs always win (RT-B) |
| C | P1 | Bounced invitation could be "resent" to `delivered`, falsifying the truthful lifecycle | `bounced`/`revoked` terminal → 409 `invitation_terminal`; UI: Re-invite with a new address (RT-C) |
| D | P2 | Revoke silently overwrote terminal states | `revokedAt` recorded; response states received stories are kept; revoke-anytime stays deliberate |
| E | P2 | Unbounded transcript on token-only write | 20k-char / 30-min bounds (RT-E) |
| F | P2 | Unmapped relationship fell back to parent journey | Relationship allowlisted at create → 400 (RT-F) |
| G | P2 | Ambient persona fallback (file:// affordance) | Carried as binding production contract: identity from signed session only (RLS doc §2.6) |

Verified solid by the red team: HTML escaping on all untrusted text (no stored-XSS via CSV or guest transcripts), pin-order never drops entries, per-user isolation, minimal guest payload, gated + clamped admin endpoints, no publish path from upload.

## 3. Acceptance criteria → evidence map (master prompt §7–§39)

| Requirement | Evidence |
|---|---|
| §7 list-first + LIST/GRID + persistence | Screens 10–11; probe 35 |
| §8 favorite vs pinned, MY PINNED QUESTIONS, drag + accessible reorder, completion state | Screens 12–13; probes 24–25; RT-A |
| §9 Dr Brian Recommends (Home compact + browse) | Screens 01, 10; probe 38 |
| §10 single-add + safe bulk import (never publish from upload) | Screens 53–55; probes 26–28; RT-B |
| §11–12 process strip + preview-before-send | Screens 20–23; RB1 patch; probe 30 (draft start) |
| §13 Postmark reuse, verify-not-assume | Postmark contract doc; preview From-note visible in screen 22 |
| §14 truthful lifecycle | Screen 20 chips; probes 29–33; RT-C |
| §15–16 relationship journeys + guest orientation | Screens 24–27; probes 31; RT-F |
| §17 contributions are candidates | Inherited R1 flow re-verified (probes 20–22) |
| §18–22 admin scale: search/filter/sort/session/saved views/pagination; queue answer; above-the-fold home | Screens 40–48; probes 36–37 |
| §23–24 mirror + same Story Room + rail | Screens 45–46 (unchanged R1 surfaces re-verified) |
| §25 Content Studio tabs + reorder | Screens 50–52 |
| §26–27 page introductions, confident copy | Screens 02, 30, 41, 47, 50 |
| §28–30 visual range, brand header, persistent + half-energetic environments | Screens 30, 35; energy labels on cards; reduced-motion 70–71 |
| §31 DARK/LIGHT/AUTO incl. required combinations | Screens 30–34, 62 (light mobile), 63 (XL), 70–72 (reduced motion + auto assertion) |
| §32 Avatar Studio consumption | Inherited R1 contract; headshots across new surfaces (queue rows, email preview identity) |
| §33 real Settings | Screen 30 (Appearance/Notifications/Privacy/Invitations/Story preferences) |
| §34–39 voice, versions, library clarity, story detail, visibility orthogonality, accessibility | Inherited R1 implementations re-run error-free; probes 7–12, 15 |
| §40 V2.1 prewiring only | `B1-513R2_V21_PREWIRING_CONTRACT.md` |

## 4. Honest limits

The prototype demonstrates contracts on a synthetic backend; production enforcement is PostgreSQL RLS + the B1-512 trust chain (contracted, probed as negative tests to be ported). Voice is simulated dictation; Postmark delivery is simulated accept→delivery; light theme is an override pass that production re-implements as first-class tokens. Saved views are session-scoped in the prototype (production: per-admin persisted). None of these limits hide product behavior from the Founder walk.
