# B1-513R Prototype → Production Mapping

`B1-513R_FINAL_WORKING_PROTOTYPE.html` = the exact production frontend (live `v-10688bb24bca7965` bytes; source hashes in the file header) + the accepted B1-513 layer + the R refinement layer, assembled by `prototype_source/build.mjs` with **56 enumerated anchored patches** (build fails loudly on drift). The B1-513 mapping doc remains authoritative for the base 28; this document adds the R chain. An unapproved prototype is not production visual authority (final gate: FD-R3).

## 1. Layering

- Superseded B1-513 functions are renamed `*__v1` at build (7: version surface, inspiration renderers/wizard handlers, directory renderer, admin patch) — retained in-bundle for provenance; the R layer declares the active versions. In production, Codex implements the R behavior directly at the same seams (no v1/v2 layering ships).
- Prototype-only scaffolding (discard at implementation): fetch/history/mic shims, synthetic backend + dataset, blob: audio allowance, simulated dictation/recording ticks, in-memory persistence, synthetic avatar SVGs, `rs-demo-*` seed tokens, `window.__B1513R` shortcut (production: avatar refs resolved into payloads server-side).

## 2. R patch chain → production seams

| Patch(es) | Seam | Production change |
|---|---|---|
| RO-* renames | build-level | none (layering artifact) |
| R01 | `storyRow()` | Refined row template (delegating; legacy retained for flag-off parity) |
| R02/R03/R07–R09 | `renderStoryRoom()` template | Single title hierarchy; single status chip; admin-neutral pickers/composers (mentor-only affordances gated `isMentor()`, admin note in rail) |
| R04 | reviewSubmission ternary (room + quick) | Admin sees rail pointer, not mentor statusRow |
| R05/R06 | `renderStoryRoom()` head + aside | `mentor = isMentor() || canAdminReview()`; Mentor Review rail injection |
| R10/R10b–R13 | NAV/ADMIN_CONSOLE_NAV/routeTitle/route allowlists | Requests entry; Content Studio + System Controls nav |
| R14/R15 | student renderRoute | requests branch; settings preload; browse preload |
| R16–R19 | admin renderRoute | attention Home; mirrored workspace; mirrored story room; content branch |
| R20/R21 | Release Controls renderer | System Controls title + content split note |
| R22/R23 | `renderSettings()` | Appearance heading; grouped extra panels |
| R24–R26 | shell identity / Home mentor panel / adminStoryRow | Avatar identity frames |
| R27 | `clearOverlays()` | guest-mode class cleanup (prototype overlay hygiene; production guest page is a separate route, not an overlay) |

Plus `extensions2.js` (~1,300 lines — in production, the same additive code in `public/app.js`, the sole renderer) and `b1513r.css` (additive, namespaced; includes the admin accent neutralization under the `admin_mirror` flag).

## 3. New interaction → production contract map (delta)

| Prototype interaction | Shim endpoint | Production contract |
|---|---|---|
| Browse/search/filter/favorites | `GET /api/inspiration/browse`, `POST /api/inspiration/favorite/:id` | Bounded read fn + `sf_inspiration_favorites` (doc 13) |
| Create/send/resend/revoke/preview invitation | `/api/requests…` | `sf_story_invitations` + audited transitions + capped reminders (doc 09) |
| Guest landing/contribute | `/api/requests/guest/:token…` | Token-hash guest route class; 410/410/429 enforcement (doc 09 §3) |
| Candidate favorite/dismiss/promote | `/api/contributions/:id…` | `sf_story_contributions`; promotion via existing creation path, Private start, first-name provenance |
| Mirrored review saves | existing `adminReview` | unchanged endpoint, room-aware client |
| Attention buckets | directory aggregates | pure read composition, no schema |
| Video greeting state | `/api/requests/:id/video-greeting` | deferred Story Media design reference only; force-off |
| Time-me / spoken estimate | client-only | client-only (no server) |

## 4. Honest limits (delta)

Guest experience is an in-app preview overlay (production: standalone minimal route, same markup contract); email sending simulated (preview text is the contract; FD-R2 wording pending); avatars synthetic; voice remains simulated dictation over the real recorder's visual contract; all data resets on reload.
