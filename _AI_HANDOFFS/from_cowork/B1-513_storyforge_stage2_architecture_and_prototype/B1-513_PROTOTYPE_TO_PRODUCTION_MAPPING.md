# B1-513 Prototype → Production Mapping

The prototype (`B1-513_STORYFORGE_STAGE2_WORKING_PROTOTYPE.html`, single file, synthetic data, standalone) is the production frontend plus an enumerated patch set. This document is the complete accounting: what is production, what is patched, what is simulated, and how every prototype interaction maps to a production contract. **An unapproved prototype is not production visual authority; it becomes input to Codex only after Founder approval.**

## 1. Foundation provenance

Build inputs (hashes embedded in the file's header comment): `public/app.js` `14759cdb…` (the pre-alias source of live `cbe2999f…`), `public/styles.css` `ec061639…` (source of live `5e183150…`), `public/auth.js` `d2cfc4e4…` (identical to live), production fonts and logo. Build = `prototype/build.mjs`; every patch is anchored and the build fails if an anchor is missing.

## 2. The 28 patches

**Prototype-only scaffolding (no production analogue; discarded at implementation):**
- A1 origin-safe API URL (file:// support) · A2 strip ESM exports (single-file inlining) · P01 strip import · P23 `blob:` allowance in `playbackUrls` (simulated audio only — production remains https-signed-URL-only) · P24 logo→data URL · S1 fonts→data URLs · H1 prompt-library injection · the entire fetch/history/getUserMedia shim + synthetic backend in `shim.js`.

**Production-mapped patches (each becomes part of the Codex diff at the same seam):**
| Patch | Seam (production file/registry) | Production change |
|---|---|---|
| P02 nav entry | `NAV.student` frozen registry | Same additive entry, gated on `inspiration` capability |
| P03 route title | `routeTitle()` map | Same |
| P04 route allowlist | boot `studentRoutes` | Same |
| P05 renderRoute branch | student branch of `renderRoute()` | Same loader+renderer branch |
| P06 session init | `bootstrapSession()` | Read session `b1513` block (consent + feature flags → capabilities-style gating) |
| P07 consent on boot | `bootstrapSession()` | Same call, after first render |
| P08/P09 Story Room versions | `renderStoryRoom()` tab computation + left column | Same region delegated to `b1513VersionSurface`; original/working markup emitted verbatim |
| P10/P11 visibility chip/card | `renderStoryRoom()` roomMeta + aside | Same |
| P12 row badges | `storyRow()` | Same |
| P13 Home link | `renderHome()` | Same |
| P14 directory branch | admin branch of `renderRoute()` | Same, flag-gated with fallback to existing view |
| P15 admin home tiles | `renderAdminHome()` | Same |
| P16/P17 direct review controls | `renderAdminStory()` + `saveAdminStoryReview()` | Same, flag-gated fallback to B1-511 selects |
| P18 profile link | `renderAdminStudent()` | Same |
| P19 settings panel | `renderSettings()` | Same |
| P20/P21/P22 config panels | Content & Display renderer + draft sync + Release Controls | Same |

Plus the appended extension module (`extensions.js`, ~1,100 lines): in production this is the same additive code in `public/app.js` (the sole renderer — no second renderer is created), and `extensions.css` appends to `public/styles.css` as namespaced additive selectors.

## 3. Interaction → production contract map

| Prototype interaction | Prototype endpoint (shim) | Production contract |
|---|---|---|
| Version save/append/retell | `PATCH /api/stories/:id/versions/:key` | Same route; PostgreSQL function with snapshot-first transaction (doc 03 §3) |
| Restore earlier telling | `POST /api/stories/:id/version-restore` | Same; symmetric snapshot |
| Voice append/retell | Scripted transcript simulation | Existing recorder pipeline with version sink + provenance (doc 03 §3.1) — **simulated in prototype** |
| Visibility toggle | `POST /api/stories/:id/visibility` | Same; server enforces withdraw-before-private; audit |
| Consent accept/defer | `GET/POST /api/consent` | Same; append-only consent row + receipt |
| Inspiration next-question | `POST /api/inspiration/next` | Same; server-side deterministic scoring (doc 04) |
| Save for later / sparks | `POST/DELETE /api/inspiration/save-later` | Same |
| Add to StoryForge Library | `POST /api/stories` with `origin` | Existing creation path + additive origin column |
| Directory list/filters | `GET /api/admin/console/directory` | Bounded SECURITY DEFINER over entitlement bridge |
| Profile drawer tabs | `GET /api/admin/console/directory/:id` | Same; private stories = counts only |
| Review Check preview/send | `POST /api/admin/console/review-check` | Same; receipt + existing notifications domain + 24h rate limit |
| Star/status/suitability instant save | `POST /api/admin/console/stories/:id/review` | Existing `adminReview` endpoint, per-control patches, optimistic version |
| Version/Inspiration config publish | content-display validate/publish + `/api/admin/console/inspiration` | Existing C&D machinery + prompt-bank config domain (doc 09) |
| Activity tab | Synthetic aggregates with real boundary copy | Heartbeat + aggregates (doc 08) — **synthetic in prototype** |
| Audio replay | Generated tone WAV via blob: | Existing signed-URL playback — **simulated** |

## 4. Simulations and honest limits (complete list)

1. All data is synthetic and in-memory; reload resets state (except the remembered fixture persona).
2. Voice = scripted transcript over a real recorder-visual state machine; the production recorder pipeline is reused, not reimplemented (its architecture is already live).
3. Audio = generated 9-second tone via `blob:` (patch P23); production playback path untouched.
4. Auth = production devAuth fixture mechanism with prototype personas; the WordPress/JWT chain is not exercised.
5. Activity numbers, warnings, and directory population are synthetic; their *truthfulness rules* (boundaries, counts-only privacy) are the real contract.
6. The consent modal lives outside the production overlay focus-trap list; production wires it into the existing trap (noted for Codex).
7. Quick Capture, Question Library, mentor-note record/publish, and Release Controls voice panels run against generous synthetic responses; their production behavior is already live and unchanged.
