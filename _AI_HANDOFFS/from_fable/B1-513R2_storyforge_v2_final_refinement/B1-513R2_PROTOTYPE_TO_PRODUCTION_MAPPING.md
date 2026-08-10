# B1-513R2 — Prototype → Production Mapping (pass-2 ledger)

Foundation and rules are inherited from B1-513 doc 16 / B1-513R doc 16: the prototype is the EXACT production frontend (`app.js` sole renderer, `styles.css`, `auth.js`, fonts, logo — hashes in the HTML header comment) plus fully-enumerated anchored patches and appended extension layers. The build fails loudly on any anchor drift. This ledger records the pass-2 delta: **88 total build steps** = 28 base (P/A/S/H) + 28 R + 9 base-layer renames + 11 R-layer renames + 1 R-layer patch (RB1) + 11 R2 patches (R2-01…R2-10 + assembly).

## 1. Discard at production time (prototype scaffolding — never port)

Everything listed in B1-513 doc 16 §1 (shim synthetic backend/data, fixture personas, blob: audio allowance, simulated dictation, demo tokens) plus pass-2 additions: the 110 synthetic students + `R2_QUEUE_SEED` stories, simulated Postmark accept→delivery, the `light`-theme `!important` input repaint (see §4), and `Date.now()`-suffixed draft IDs in the add-question form (production: server-generated IDs).

## 2. R2 patch ledger (each anchored in `build.mjs`; production seam noted)

| Patch | Prototype change | Production implementation |
|---|---|---|
| R2-01/02/03 | Page intros on Library/Notifications/Settings | Same seams in `public/app.js` render functions; copy from `b1513r2PageIntro` map becomes Content&Display-governed copy where student-facing. |
| R2-04 | `applyEnvironment` also syncs `data-theme` | Same one-line seam; theme resolution util ships with the appearance module. |
| R2-05 | Appearance panel (Dark/Light/Auto cards) into Settings | New settings panel; `POST /api/preferences/theme`; column `users.theme_preference`. |
| R2-06 | Brand header sub-line | Same markup seam; CSS in additive stylesheet. |
| R2-07 | Two energetic environments added to `BACKGROUNDS` | Same array addition + additive CSS keyframes; canvas engine untouched (CSS-driven modes). |
| R2-08 | Queue branch → scaled loader/renderer | `renderAdminQueue` superseded by the scaled queue (search/session/sort/page); server: query params on the existing queue endpoint, `pageSize ≤ 50`. |
| R2-09 | Admin home branch → above-the-fold loader | `loadAdminHome` extended (or a small aggregate endpoint) returning the four counts + oldest-awaiting slice; avoid N browser round-trips in production — one SQL aggregate. |
| R2-10 | `renderAdminReleaseControls` redirects to Content Studio when `route === 'content'` | Same guard; Content Studio owns its tabs. |
| RB1 (ext2 patch) | Invite submit delegates to preview-first flow | The create form never sends; `POST /requests` creates a draft; send happens only from the preview surface. |

Superseded-function renames (`__v1`, `__r1`) are a build-time layering device only; production edits the single renderer in place at the same seams.

## 3. New synthetic endpoints → production contracts

| Prototype endpoint | Production contract |
|---|---|
| `GET /api/inspiration/browse` (+ `pinned[]`, `recommended`, `answeredStoryId`) | Browse query joins per-user favorites/pins + question records; **only `state='active'` questions are ever serialized to students, including through pins** (red-team A → RLS/`WHERE` requirement, tested). |
| `POST /api/inspiration/pin/:id`, `POST /api/inspiration/pin-order` | Per-user pin table `(user_id, question_id, position)`; pinning validates the question is active; order writes are scoped `WHERE user_id = auth.uid()`. |
| `POST /api/admin/console/inspiration/bulk-parse` / `bulk-commit` | Admin-only. Parse is stateless validation (quote-aware CSV). Commit **re-validates server-side and generates all IDs server-side** (red-team B); rows insert as `retired` drafts; publish is the existing per-question audited save. |
| `POST /api/requests/:id/update` | Draft-only edit (409 `invitation_locked` otherwise). |
| `POST /api/requests/:id/send` | Refuses `bounced`/`revoked` with 409 `invitation_terminal` (red-team C). Sends via the USCE Postmark pattern; `delivered`/`bounced` set **only** by signed webhook events. |
| `GET /api/requests/guest/:token` (+`journeyLine`, journey ordering) | Journey composition from the governed contributor library, relationship allowlisted at create (400 otherwise). First GET stamps `link_visited`. |
| `POST /api/requests/guest/:token/started` | Token-scoped, idempotent, never demotes `story_shared`; transcript/duration bounds on the sibling contribution endpoint (20k chars / 30 min). |
| `POST /api/preferences/theme`, `/inspiration-layout` | User preference columns, self-write only. |
| Directory/queue query params (`q`,`session`,`sort`,`page`,`pageSize`) | Parameterized queries; `pageSize` clamped ≤50; session labels read from the canonical 360 cohort source (verify at Codex time; if absent, the smallest bounded StoryForge grouping layer per §19 — entitlement stays the only access truth). |

## 4. Light theme: prototype vs production

The prototype implements Light as (a) a token override on `:root` custom properties and (b) a structural paint pass over the ~15 selectors that hard-code night gradients (header, rail, panels, rows, list bars, room sheet, guest page), plus one blunt `input/select/textarea` repaint with `!important`. Production implements the same *design* as a first-class second token set in `styles.css` (moving the hard-coded gradients onto tokens), eliminating every `!important`. The visual authority is the approved prototype's light screenshots, not the override mechanism.

## 5. Fidelity notes

Recorder/dictation remain simulations of the production pipeline; audio is `blob:` in the prototype and signed URLs in production (https-only guard restored). The prototype's ambient persona fallback (red-team G) is a file:// affordance — production identity comes exclusively from the signed session (B1-512 trust chain), and RLS enforces every scope the shim enforces by lookup.
