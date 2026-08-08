# Timeline RC1 Stabilization Combined Handoff

This combined handoff contains the complete substantive content of the final recovery reports.

---

# Timeline RC1 Executive Summary

Result: **PASS after reopened production recovery**. The prior RC1 PASS was invalidated by the Founder’s real post-consent failure and was not retained. Recovery reopened 50 gates; all 50 now pass.

Timeline Builder is live at `https://missionmedinstitute.com/timeline/`. A clean real Incognito journey now enters through Matrix, shows the accepted premium Home experience, presents secure-saving consent contextually when needed, provisions an eligible student’s immutable Timeline principal on first use, hydrates the remote timeline, renders the protected preview, and settles at `SAVED & SYNCED`. Refresh and background renewal retain that state.

Final production identities:

- Source: `d43af9800ee49407a5cfe43bd2f44b131475867a`.
- First-use identity repair: `a543e349a7372ede6b86d3a97e571d4267078b5a`.
- Contextual-consent submission repair: `4f0584e7e9cbcb80977cdcc3672b97d299486b57`.
- PostgreSQL-client compatibility repair: `a39d934b5d4f3f5ab24fc28b2553fa76a1d740d1`.
- Static release: `timeline-f5f8ad51fd48010b`.
- WordPress runtime: `timeline-wp-01b09664228a865a`.
- Railway deployment: `b0c3401a-c482-4aac-9580-8e0067554289`.
- Railway image: `sha256:fb5493c8fc87b6764d202d84f13b7103fea3172552047e4bd0d4dab2b0c9dd22`.
- API health release: `timeline-c9eda9eeb7d6cf98`, schema `d1-timeline-db-500.1`.

The first production boundary failed because broad eligible-360 rollout did not include deterministic first-use principal provisioning. A second live-only boundary then rejected the contextual consent POST with `csrf_failed`; the repaired same-origin WordPress AJAX seam preserves login, origin, nonce, eligibility, role, confirmation, consent auditability, withdrawal, and fail-closed behavior. One runtime warning also exposed concurrent `query()` calls on one checked-out PostgreSQL client; the final source serializes those reads within the same RLS transaction. Fresh independent verification then found four 404 font requests caused by relative `url()` references inside the inline index stylesheet. The packaging repair rewrites only inline-style font URLs to immutable Timeline asset aliases; presentation bytes and typography remain unchanged.

Verification includes 644/644 authoritative tests, typecheck, API-only build, anonymous redirect, direct-API denial, real active-360 entry, no-consent grant, existing-consent recognition, remote hydration, refresh, sustained renewal, consent withdrawal/restoration, administrator access, synthetic non-360/revoked denial and cleanup, two-owner RLS isolation, health, logs, backups, and rollback readiness. The stale-profile conflict state was also observed to fail safely without overwriting either local or remote data; a clean profile hydrates normally.

Presentation authority is unchanged. No Matrix shell, StoryForge, Arena, USCE, File Vault, WordPress core, DNS, CDN, Supabase, unrelated R2 bucket, or shared production application was modified. Unrelated application impact is **NONE**.

---

# Timeline RC1 Production Defect Report

| Severity | Defect | Reproduction/result | RC1 status |
|---|---|---|---|
| P0 | Preview could fail after media upload | A media hydration failure could reach the protected renderer as an unrecoverable aggregate failure. | Fixed and regression-tested fail-soft. |
| P0 | Temporary `blob:` references could survive in working state | Local uploads used object URLs for preview and lacked a production durable-object handoff. | Fixed: browser object URLs are transient; persistent remote state uses opaque durable object IDs. |
| P0 | One failed media item could suppress the timeline | Media resolution was not isolated per item. | Fixed: invalid/unavailable media is omitted with `MEDIA_OMITTED:<path>` while valid events/media remain. |
| P1 | Home and Builder previews rebuilt after ordinary state events | Preview invalidation was broader than presentation-changing state. | Fixed: render signatures and scoped scheduling avoid unchanged presentation rebuilds. |
| P1 | Initial payload and preview readiness were slow | The release shipped an unnecessarily large unminified production bundle. | Fixed: production minification reduced the final raw bundle to 1,189,312 bytes and gzip to 463,643 bytes. |
| P1 | Session became read-only during ordinary work | Token refresh was not scheduled against expiry and did not recover on visibility change. | Fixed: refresh is scheduled 30 seconds before expiry, renewed on visibility, and account-switch/revocation still fail closed. |
| P1 | Save/autosave/version state was difficult to distinguish | Local durability and cloud acknowledgement were collapsed into less precise states. | Fixed: `LOCAL_SAVED`, `SYNC_PENDING`, `SYNCING`, `SYNCED`, `CONFLICT`, `ERROR`, `OFFLINE`, and `LOCAL_ONLY`. |
| P0 found during canary | R2 signed PUT returned `403 SignatureDoesNotMatch` | AWS SDK hoisted integrity metadata/checksum into the query string; R2 rejected that signature form. | Fixed in `f4e9b09`; exact production upload/download/delete canary passed. |
| Operational | First Railway upload used repository-root `railway.json` | Health returned an HQ-shaped 404 rather than Timeline health. | Automatically rolled back to the accepted API, verified, then redeployed with `--path-as-root`. |
| Operational | Provider UI exposed the first staged R2 credentials during inspection | The dashboard unexpectedly unmasked values. | Credentials were treated as compromised, replaced, old token revoked before production use, and values excluded from evidence. |
| P1 found by independent verification | Approved administrators could enter an impossible remote-media path | Client/store admitted `PROGRAM_ADMIN`, but domain document creation and `media_owner_write` RLS are student-only. The first database custody insert would fail. | Fixed in `e685e94`: administrator authoring/media remains durable on-device, remote sync is not queued, and server media signing rejects admin before any custody write. |

No remaining verified P0 or P1 Timeline production defect is open. Separate native Safari, Edge, and Firefox production automation is a follow-up verification improvement, not evidence of a current defect.

## Reopened failure recovery 002

| Priority | Production defect | Verified cause | Final disposition |
|---|---|---|---|
| P0 | Consent completed, then `TIMELINE COULD NOT BE LOADED SAFELY` | Eligible LearnDash 3893 users without a pre-seeded `timeline.principals` row could receive a valid gateway identity but could not resolve an immutable Timeline principal. | Fixed by deterministic, RLS-scoped first-use provisioning plus audit event and migration policies. |
| P0 | Technical consent page displaced premium onboarding | Consent was implemented as a route-blocking pre-application screen. | Fixed by a contextual secure-saving card inside the accepted Home surface; the internal version remains stored but is not dominant UI. |
| P0 | Contextual consent click returned `csrf_failed` | The route POST boundary rejected the real browser submission even though nonce/form ownership appeared correct. | Fixed through the authenticated same-origin WordPress AJAX action, retaining nonce, origin, login, eligibility, role, confirmation, grant, and withdrawal checks. |
| P1 | PostgreSQL client deprecation warning during identity resolution | Three reads were started with `Promise.all` on one checked-out transaction client. | Fixed by sequential reads inside the same transaction/RLS claim context; overlap regression test added. |
| P1 | Four production font requests returned `404` on every refresh | WordPress packaging rewrote HTML `src`/`href` and standalone CSS URLs, but not relative `url()` references inside the inline index stylesheet. | Fixed by scoped inline-style rewriting to immutable `_asset` aliases; dynamic JavaScript `url()` strings are deliberately excluded. |

No reopened P0 or P1 remains open.

---

# Timeline RC1 Root Cause Report

## Media and renderer

The browser adapter owned temporary `blob:` URLs but had no production durable-object lifecycle. Renderer hydration accepted a collection-level failure path, so one missing or invalid media reference could reject the complete render. The repair adds durable private object IDs, bounded object-URL ownership/revocation, per-item failure isolation, and visible omission warnings while preserving the protected presentation kernel.

## Excessive rendering

Ordinary persistence and route events could invoke broad `renderAll()`/preview paths even when the canonical presentation input had not changed. RC1 uses a stable presentation signature and scheduled/scoped preview updates. Presentation-changing edits still render; save-status-only events do not rebuild protected output.

## Session expiry

The production client held a short-lived JWT but did not proactively renew against its `exp` claim. RC1 schedules renewal 30 seconds before expiry, refreshes when the document becomes visible, retries one authenticated API request after a `401`, and locks on genuine revocation/account switching.

## Save-state ambiguity

The persistence adapter reported transport events but did not provide one deterministic status model. RC1 maps local commit, queue, remote acknowledgement, conflict, offline, no-consent, and terminal error into explicit states without weakening local-first durability.

## R2 canary failure

Credentials, bucket permissions, and direct SDK PUT were valid. The failing presigned request had custom integrity values hoisted into the query while `X-Amz-SignedHeaders` contained only `host`. Cloudflare R2 returned `SignatureDoesNotMatch`. Keeping checksum and metadata as unhoistable signed headers, and explicitly signing `content-type`, produced a successful `200` PUT with signed headers:

`content-length;content-type;host;x-amz-checksum-sha256;x-amz-meta-expected-sha256;x-amz-meta-object-class;x-amz-meta-object-id`

The production code now applies that exact signing policy and verifies length, MIME, checksum, object ID, class, and metadata again with `HEAD` before confirming custody.

## Administrator custody mismatch

The production entitlement correctly allows an approved administrator to open and use Timeline, but remote document ownership is intentionally student-scoped unless a separate resource grant exists. The browser nevertheless enabled remote sync for any identity with `remote_sync_allowed`, and the R2 object store admitted `PROGRAM_ADMIN`. PostgreSQL then enforced the real authority: `media_owner_write` permits active student owners only. The mismatch created a late database failure instead of an intentional device-local administrator workflow. RC1 now derives remote persistence from both role and consent, keeps approved-administrator saves/media in the principal-scoped IndexedDB cache, and denies direct administrator media signing before the repository is called. No RLS widening or new administrator ownership model was introduced.

## Production failure recovery 002 root cause

The first failing boundary was principal resolution after a valid WordPress consent and gateway exchange. D1-500 had manually seeded selected principals, but the eligible-360 rollout did not provision every eligible student. The API therefore rejected a valid eligible student with `TimelineProductionAuthError: Timeline identity is not provisioned`. The repair derives the deterministic principal from the immutable WordPress user ID, takes a per-user advisory transaction lock, switches only to `timeline_identity_sync`, inserts the active principal and `missionmed-360:3893` membership under narrow RLS policies, writes an auditable first-use event, restores `timeline_authenticated`, and re-reads the identity before commit. Ineligible users remain fail-closed and no frontend identity is trusted.

The first contextual-consent production attempt then failed at the form POST CSRF boundary. The replacement uses WordPress’s authenticated `admin-ajax.php` action with the same nonce and all prior policy checks. The browser submits `FormData` once, shows bounded progress, reloads only after JSON success, and retains a retryable inline failure state.

The final log warning was caused by `Promise.all` issuing three queries concurrently on one `pg` Client. The queries now run sequentially on that same client; using separate clients would have lost the transaction-local role, JWT claims, RLS state, and snapshot consistency.

---

# Timeline RC1 Engineering Repair Report

The bounded RC1 implementation changed only Timeline-owned files across three repair commits. The first delivered the renderer, browser media, persistence, auth-renewal, production R2, CSP, build, and test work. The second corrected the R2 presigning policy found during canary. The third reconciled approved-administrator device-local persistence with the existing student-only remote-document and RLS authority.

Key engineering repairs:

- Added private R2 production storage using the existing `timeline.media_objects` custody and RLS model; no schema migration was required.
- Added short-lived signed PUT/GET grants, HMAC-bound confirmation tokens, opaque HMAC-scoped object paths, exact integrity confirmation, quarantine, replay denial, owner/service enforcement, and physical delete plus durable `DELETED` state.
- Added Timeline API routes for object signing, confirmation, download signing, and deletion.
- Added browser upload/download integration that persists opaque object IDs and keeps `blob:` URLs temporary.
- Added fail-soft protected-kernel media projection; one missing asset no longer destroys the timeline.
- Added presentation-signature invalidation and scoped preview scheduling.
- Added proactive JWT refresh and visibility recovery without weakening logout, revocation, or account-switch locks.
- Added deterministic local/cloud sync states.
- Minified the production release bundle.
- Restricted WordPress CSP `connect-src` to the exact private R2 S3 host.
- Made approved-administrator persistence explicitly device-local and fail-closed at the server media boundary; no administrator RLS grant was invented.

Protected presentation files were not modified. Their retained hashes are:

- HTML: `bb471c57223c4a8d6c44d2398cc3c2a0da4467b61e7a2d779323c5be38e52c24`.
- CSS: `4efd5088696a93914d5f6c3b7e14e98426239453b16712f152eb5bfe68598ef7`.
- JavaScript: `ca9a28688e7dd29f0e008b58efae85555af860b8150fa9493165faf851165bb8`.

Production installation used a feature-off pointer cutover, exact hash verification, canary admission, then restoration of the accepted eligible-360 settings. The final WordPress plugin hash remains `20e64ed5af824e8c265a6e9a048f3164967680ce5d752eeda519c66eec8cb6b6`; the immutable runtime payload hash is `6d6542c13f6dfd34ec9cda8c4b3b4788e704e87833a35db84d2735aaff0def90`.

## Production failure recovery 002 repairs

- Added migration `20260805223000_rc1_first_use_identity_provisioning.sql` with exactly three narrow policies for first-use principal read/insert and program-membership insert under `timeline_identity_sync`.
- Added deterministic first-use provisioning in `postgres-principal-directory.ts`, including transaction lock, eligibility check, program binding, audit receipt, and authenticated re-read.
- Replaced the standalone technical consent gate with contextual Home onboarding while preserving local-only use until consent is granted.
- Added authenticated WordPress AJAX consent grant/withdrawal in SSO plugin `500.0.4` and a bounded client interceptor with retry-safe failure handling.
- Serialized principal-directory reads on one PostgreSQL client for pg 9 compatibility.
- Preserved the branded safe-load recovery state with Retry and Return to Matrix; no stack, claim, token, key, or object path is exposed.

Final source is `d43af9800ee49407a5cfe43bd2f44b131475867a`. Current Kinsta hashes are SSO `e29b713e2c8aac0a6fcfa71818a01e8a00e35b8c73eed6d6059ec4833b3e8ba5` and WordPress release payload `52a299e814bd6b054e337b8d450f1d987c570739fe4fd9ffebc0d4de2bbd7186`. The static release remains `timeline-f5f8ad51fd48010b`; only WordPress runtime URL packaging changed for the font repair.

The font repair is in `build-wordpress-runtime.mjs`: it rewrites relative CSS `url()` references only inside `<style>` blocks, verifies each referenced file already exists in the accepted content-addressed asset map, and fails the build if a relative inline asset path remains. It does not scan or reinterpret JavaScript strings. The resulting five font requests use immutable `_asset` aliases.

---

# Timeline RC1 Performance Report

## Release size

- Pre-RC1 recorded raw production payload: approximately 1.808 MB.
- RC1 raw production bundle: 1,189,312 bytes.
- RC1 gzip bundle: 463,643 bytes.
- Raw reduction: approximately 34%.

## Browser workflow measurements

The final 39/39 Chromium workflow run recorded representative timings:

- Builder/protected render: approximately 159 ms.
- Edit Timeline continuity/readiness: approximately 208 ms.
- Autosave plus reload verification: approximately 649 ms.
- PNG/PDF export workflow: approximately 931 ms for the administrator journey.
- Browser errors in the run: zero.

## Live service measurements

Five consecutive production health requests on 2026-08-05:

- Average: 188.6 ms.
- Minimum: 129.0 ms.
- Maximum: 316.5 ms.

The anonymous canonical route returned the expected `303` Matrix handoff in 978.7 ms during the final probe. API health reported the exact RC1 static identity and production database schema.

## Rendering behavior

RC1 avoids unchanged preview rebuilds by comparing a presentation signature before rerendering and by scheduling preview work to the next frame. Media failures are isolated; no retry loop or whole-document render retry was added. Memory ownership is bounded by revoking replaced and teardown object URLs.

## Session renewal

Production issued two distinct JWTs, both authorized the Timeline API with `200`, TTL was 120 seconds, and the renewed token expiry exceeded 90 seconds. The browser client schedules background refresh 30 seconds before expiry.

## Recovery 002 performance and session evidence

The repaired clean Incognito session remained authenticated beyond the former 120-second token window, retained remote hydration, and displayed `SAVED & SYNCED`. A post-deployment refresh briefly displayed truthful `SAVING…` during reconciliation, then settled to `SAVED & SYNCED` with the protected preview rendered. Sequential principal-directory reads add only the latency of three small indexed authorization queries on a connection that cannot execute them concurrently; they remove the pg 9 incompatibility without changing payloads or extra round trips outside the existing transaction.

---

# Timeline RC1 Regression Report

Final local certification:

- TypeScript and Node tests: **636/636 passed** (`135` TypeScript + `501` JavaScript).
- Focused R2 presigning/storage tests: **5/5 passed**.
- Production browser workflows: **39/39 passed** across administrator, eligible-360, and removed/ineligible journeys.
- Release verification: **62/62 files passed**.
- Package verification: **23/23 passed**.
- Typecheck: PASS.
- API build: PASS, 145,401 bytes after the final repair.
- API-only boundary: PASS, `forbiddenMatches: 0`.
- Matrix App Mode: PASS.
- Exact fail-soft browser proof: PASS, two events retained, one valid media item retained, invalid item omitted with warning, zero off-origin requests.
- Protected presentation hashes: three of three unchanged.

Final production certification:

- Health: `200`, `service=mission-timeline`, `version=timeline-c9eda9eeb7d6cf98`, `schemaVersion=d1-timeline-db-500.1`.
- Direct API without gateway: `403 GATEWAY_REQUIRED`.
- Approved administrator: PASS.
- Active 360 student with live LearnDash 3893 entitlement and consent: PASS.
- Non-360 user: `eligibility_required`.
- Token renewal: two distinct tokens, both API `200`.
- Private media: sign `201`, PUT `200`, confirm `200`, download grant `200`, download `200`, SHA-256 match true, delete `204`, post-delete `404 OBJECT_NOT_FOUND`.
- Foreign principal media download/delete: both `404 OBJECT_NOT_FOUND`.
- Fixture cleanup: owner `204`; R2 object count zero.
- Approved administrator custody: production runtime retains `remotePersistenceAllowed=false`, queues zero remote writes, and direct server media signing returns `OBJECT_UPLOAD_ROLE_DENIED` before repository access.

The production page's authenticated visual re-navigation could not be repeated through the browser-control extension after it began returning a local client-side block, and the Founder was actively using Chrome. The shipped WordPress payload was hash-verified, the exact same static RC1 payload passed the local browser suite and screenshot verification, and authenticated server/API canaries passed. No product or origin error was inferred from the local extension condition.

## Reopened recovery regression

- Authoritative suite: **644/644 PASS** (`138` TypeScript + `506` MJS), zero failures.
- Typecheck: PASS.
- API build/API-only boundary: PASS; `dist-api/server.mjs` contained zero forbidden frontend matches.
- First-use eligible student: PASS; principal and course-3893 program membership created once and audited.
- Ineligible first use: PASS; no principal insert.
- Concurrent-query guard: PASS; maximum in-flight queries on the checked-out client equals `1`.
- Clean real-browser consent grant: PASS; progress state, reload, existing timeline hydration, and `SAVED & SYNCED`.
- Existing consent, refresh, re-entry, and renewal: PASS.
- Consent withdrawal: PASS; local-safe mode returned and remote data was preserved. Authorized test metadata was restored afterward.
- Anonymous: `303` through the Matrix/member-dashboard return flow.
- Non-360/revoked fixture: denied with `eligibility_required`; fixture deleted.
- Direct API: `403 GATEWAY_REQUIRED`.
- Two real student owners: own document visible; cross-owner document count `0` in both directions.
- Stale local-profile conflict: safe `SYNC CONFLICT — REVIEW`, with neither side overwritten. Clean profile: normal hydration.
- Current API deployment: health PASS and post-refresh logs contain no pg concurrent-query warning.
- WordPress font packaging: five inline font URLs rewritten to immutable aliases; no `/timeline/assets/fonts/` or `./assets/fonts/` reference remains in the runtime index.
- Font payload build: `timeline-wp-01b09664228a865a`, 61 accepted assets, index SHA-256 `676a241e6f060193d101500f8758b78f156a806b0dbee9d45ec7d68664dae93a`.

---

# Timeline RC1 Browser Verification Report

The RC1 visual and interaction surface is unchanged from the accepted Timeline authority. The saved current preview is `evidence/RC1_CURRENT_PREVIEW.png`.

Verified in the automated Chromium workflow:

- Home, Builder, Edit Timeline, Media, and Export routes.
- Protected Timeline renderer and preview continuity.
- Create/edit/save/reload/autosave/version behavior.
- Media assignment and fail-soft missing-media behavior.
- PNG and PDF export.
- Responsive capability contracts and reduced-motion behavior.
- Administrator, active student, and removed/ineligible access journeys.
- Zero critical console errors in the completed workflow run.

Production/browser boundary evidence:

- Canonical URL: `https://missionmedinstitute.com/timeline/`.
- Anonymous route: approved `303` return to Matrix/member dashboard.
- Static WordPress runtime and route hashes match the installed RC1 payload.
- Live authenticated identity, entitlement, token, API, persistence, private-media, and denial checks passed at the real WordPress/Railway/R2 boundary.
- The final immutable Kinsta payload hash is `6d6542c13f6dfd34ec9cda8c4b3b4788e704e87833a35db84d2735aaff0def90`; the same final static release produced the saved preview.
- A final external-Chrome attempt was blocked locally by a browser client/extension condition before the application loaded. This is recorded as a verification-tool limitation, not a successful live visual journey.

Separate native Safari, Edge, and Firefox production automation was not available in this run. No browser-specific presentation code was introduced. Standards-based Fetch, IndexedDB, object URLs, Web Crypto-compatible SHA-256 input, and CSS/DOM behavior remain covered by the existing compatibility contracts. This is a follow-up verification opportunity, not a detected production defect.

## Fresh production journey after recovery 002

A fresh Incognito Chrome context reproduced the Founder’s route rather than relying on a harness. Anonymous `/timeline/` returned through Matrix/member-dashboard login. The active-360 identity saw the Timeline navigation, premium Home, `360 MEMBER ACCESS`, contextual secure-saving explanation, and no internal consent-version-dominated page. Consent grant used the authenticated AJAX seam, reloaded once, hydrated the existing timeline, rendered the accepted 407F preview, and settled at `SAVED & SYNCED`. Refresh after the final Railway cutover again settled at `SAVED & SYNCED`; the session remained active beyond the former expiry window. No raw safe-load failure, stack trace, token, or claim appeared.

The current live preview shows the accepted dark navy/orange Timeline shell, Home onboarding, secure-saving privacy link, five-route navigation, and existing protected timeline preview. A stale non-clean browser profile independently produced the intended conflict-review state instead of overwriting remote data; it is not the clean-profile outcome.

The initial independent clean-profile pass found four font 404 console errors. That result was correctly held at PARTIAL. Runtime `timeline-wp-01b09664228a865a` replaces the relative inline stylesheet URLs with authenticated immutable asset aliases without changing font files or CSS declarations. Final independent console/network disposition is recorded in `12_INDEPENDENT_VERIFIER_REPORT.md`.

---

# Timeline RC1 Blast Radius Report

## Modified scope

- Timeline package source, tests, build scripts, and its WordPress route adapter.
- Timeline API service only.
- Timeline WordPress immutable runtime and Timeline route only.
- Dedicated Timeline private R2 bucket and its exact CORS policy.
- Existing Timeline PostgreSQL schema records only; no migration or schema change.
- Approved-administrator persistence routing only: administrators remain device-local; eligible student remote behavior is unchanged.
- Timeline admission setting was temporarily changed off/canary and restored exactly to eligible-360.

## Explicitly unchanged

- D1-409H protected presentation assets.
- Matrix shell and other Matrix applications.
- StoryForge, Arena, USCE, PRIQ, File Vault, and WordPress core.
- Shared Railway services and unrelated staged Railway changes.
- Supabase, DNS, CDN/R2 public delivery, Cloudflare zones, and avatar objects.
- LearnDash course mapping or real student entitlement.

## Storage decision

The existing avatar bucket was verified as Category A: avatar-specific and anonymously/publicly delivered. It was not modified or reused. The dedicated `missionmed-timeline-media-prod` bucket is private and isolates Timeline policy, keys, audit, retention, backup, and rollback from avatars.

## Cost

Provider inspection showed current R2-period cost of approximately $0.03 and an empty new bucket after verification. No expected recurring cost near the $25/month Founder stop threshold was identified.

## Incidents contained

- Wrong-root Railway deployment: actual rollback restored the prior API before the corrected package-root deployment.
- First R2 token UI exposure: replacement token created, original revoked before use, and values excluded from source/evidence.
- WordPress CLI exits `139` after option writes on this Kinsta environment: every write was independently read back before continuing.

Unrelated application impact: **NONE**.

## Recovery 002 blast radius

Recovery touched only the Timeline SSO plugin, Timeline frontend auth/adapter code, Timeline identity directory, one Timeline-only migration, Timeline tests, the immutable Timeline WordPress release pointer, and the Timeline Railway API service. PostgreSQL schema version stayed `d1-timeline-db-500.1`. No live Matrix runtime, shared login policy, WordPress core, DNS, CDN, R2 public access, avatar data, StoryForge, Arena, USCE, File Vault, Supabase, or unrelated Railway service changed. The final query-serialization repair changes only execution order of three reads inside an existing authorization transaction.

---

# Timeline RC1 Rollback Procedure

Rollback is Timeline-scoped and preserves the production database unless corruption is independently proven.

## Immediate containment

1. Set `missionmed_timeline_settings.timeline_enabled=false`.
2. Set `missionmed_timeline_settings.rollout_stage=off`.
3. Read back both values and verify the route grants no Timeline admission.

## WordPress runtime rollback

1. Verify the current pointer is `releases/timeline-wp-7230b1b928fcbad2`.
2. Atomically point `missionmed-timeline-runtime/current` to the immediately prior RC1 `releases/timeline-wp-ee40c1abc5eabe06`, or to accepted D1-500 `releases/timeline-wp-0fc51f8906decb8e` when a full RC1 rollback is required.
3. Restore the prior Timeline route from the scoped backup.
4. Verify prior hashes:
   - route `258da3f2a5edf95899f921f5d617ef4f861260ca1be24dd5a8e1c1d4c5621403`;
   - payload `e424edc9fd022dd225c84763707ef18dece073fddb433821e040bada5e25b820`.

## API rollback

1. In Railway service `mission-timeline-api`, select the prior successful package-root deployment.
2. Use Railway Rollback, which restores both build and variables.
3. Reapply the eight authorized Timeline media variables with deploy skipped if rollback removed them.
4. Verify health reports the intended prior release and direct `/v1/documents` returns `403 GATEWAY_REQUIRED`.

The rollback mechanism was exercised during RC1 after a wrong-root upload: deployment `7ebb239e-77d2-4729-a58e-1a5a60778f0e` was replaced by rollback deployment `436da8cd-87bf-4c5a-bd49-b04c667a827b`, and accepted health was restored before work continued.

## Data and media

- Do not drop or reverse the Timeline schema for an application rollback.
- The fresh Railway PostgreSQL provider backup from 2026-08-05 16:45 EDT remains restore-capable.
- The Timeline filesystem backup is `/www/theresidencyacademy_209/private/timeline-rc1-backups/20260805T204718Z` with a verified 14-file checksum manifest.
- R2 objects remain private. If RC1 is disabled, retain existing confirmed objects unless an authorized deletion is required; pending test fixtures were removed and the bucket was empty at seal.

## Reactivation

After rollback validation, restore the exact backed-up admission option only after health, access, direct-API denial, and identity tests pass. The accepted final policy is `timeline_enabled=true`, `rollout_stage=eligible_360`, one approved administrator canary ID, verified entitlement, and consent version `d1-500-v1`.

## Recovery 002 receipts and rollback targets

- Pre-recovery Kinsta snapshot: `/www/theresidencyacademy_209/private/timeline-rc1-recovery-backups/20260805T224704Z`.
- Pre-consent-hotfix Kinsta snapshot: `/www/theresidencyacademy_209/private/timeline-rc1-recovery-backups/20260805T231723Z-consent`.
- Railway PostgreSQL snapshot: `TIMELINE-RC1-RECOVERY-PRE-20260805T224704Z`, ID `e445676e-3929-4946-b56b-4ec544a49e24`, non-expiring at creation.
- Current Kinsta pointer: `releases/timeline-wp-7619ed467ec95270`.
- Previous working recovery pointer: `releases/timeline-wp-da5bf0b8b16bb3c7`.
- Current Railway deployment: `b0c3401a-c482-4aac-9580-8e0067554289`; immediately prior recovery deployment: `acdc8597-b42b-4afd-82cf-876526b5a31f`.
- Pre-font-packaging Kinsta snapshot: `/www/theresidencyacademy_209/private/timeline-rc1-recovery-backups/20260805T233504Z-font-assets`; checksum verified and pointer preserved.
- Current font-fixed Kinsta pointer: `releases/timeline-wp-01b09664228a865a`; immediate rollback pointer: `releases/timeline-wp-7619ed467ec95270`.

Immediate containment remains the Timeline feature/access kill switch. Application rollback does not drop the schema or delete documents/media. After rollback, verify `/healthz`, `403 GATEWAY_REQUIRED`, anonymous denial, eligible access, and unchanged unrelated applications before restoring the eligible-360 gate.

---

# Timeline RC1 Evidence Package

Evidence root: `_AI_HANDOFFS/from_codex/TIMELINE-RC1-STABILIZATION-001/`.

Primary receipts:

- Final source commits: `635b7d1e761538294976a2ba3a9a980f19d7171e`, `f4e9b0907c8686257180565514263c61b6bfb19f`, `e685e948fd338199a3b47c4305021dde08979a1c`.
- Live URL: `https://missionmedinstitute.com/timeline/`.
- Static release: `timeline-c9eda9eeb7d6cf98`.
- WordPress runtime: `timeline-wp-7230b1b928fcbad2`.
- WordPress payload SHA-256: `6d6542c13f6dfd34ec9cda8c4b3b4788e704e87833a35db84d2735aaff0def90`.
- Railway deployment: `075cf61c-a91b-4bb7-ba41-69bebdbb3d17`.
- Railway image: `sha256:69068dd247f20f0aec0914acae4bc653e7bc267b0588fc1937243bff7dcea259`.
- Private bucket: `missionmed-timeline-media-prod`.
- Production health: `200`, ready, schema `d1-timeline-db-500.1`.
- Direct API: `403 GATEWAY_REQUIRED`.
- Tests: `636/636`, browser `39/39`, release `62/62`, package `23/23`.
- Current preview: `evidence/RC1_CURRENT_PREVIEW.png`.
- Backup: `/www/theresidencyacademy_209/private/timeline-rc1-backups/20260805T204718Z`.
- Final package checksums: `PACKAGE_MANIFEST.sha256`.

Credential hygiene:

- No password, JWT, gateway secret, R2 access key, R2 secret, signed URL, session cookie, or database credential is included.
- The first provider token was revoked after an unexpected UI exposure; only the replacement was installed.

The package manifest must be validated with `shasum -a 256 -c PACKAGE_MANIFEST.sha256` after the last content change.

## Recovery 002 final receipts

- Source: `d43af9800ee49407a5cfe43bd2f44b131475867a`.
- Kinsta release: `timeline-wp-01b09664228a865a`, SHA-256 `52a299e814bd6b054e337b8d450f1d987c570739fe4fd9ffebc0d4de2bbd7186`.
- Static release: `timeline-f5f8ad51fd48010b`.
- Railway: `b0c3401a-c482-4aac-9580-8e0067554289`, image `sha256:fb5493c8fc87b6764d202d84f13b7103fea3172552047e4bd0d4dab2b0c9dd22`.
- Health: `200`, `timeline-c9eda9eeb7d6cf98`, `d1-timeline-db-500.1`.
- Direct API denial: `403 GATEWAY_REQUIRED`.
- Tests: `644/644`, typecheck PASS, API-only build PASS.
- Browser truth: clean Incognito grant/hydration/refresh/renewal `SAVED & SYNCED`; administrator PASS; non-360/revoked/anonymous/direct-API denied; two-owner RLS isolation PASS.
- Backups: both Kinsta snapshots and Railway snapshot listed in `09_ROLLBACK_PROCEDURE.md`.
- Credential hygiene: no supplied password, JWT, cookie, gateway secret, R2 key, database URL, signed URL, or nonce value is recorded.

---

# Timeline RC1 Independent Verifier Report

## Final verdict

**PASS.** The verifier worked from a clean temporary browser profile after the final production cutover and did not rely on implementation-agent state.

Verified release:

- Kinsta runtime `timeline-wp-01b09664228a865a`.
- Source `d43af9800ee49407a5cfe43bd2f44b131475867a`.
- Payload SHA-256 `52a299e814bd6b054e337b8d450f1d987c570739fe4fd9ffebc0d4de2bbd7186`.
- Railway `b0c3401a-c482-4aac-9580-8e0067554289`, online.
- Health `200`, release `timeline-c9eda9eeb7d6cf98`, schema `d1-timeline-db-500.1`.

Clean-profile results:

- Authorized active-360 authentication: PASS.
- Existing consent recognized without prompting or mutation: PASS.
- Premium Home and protected preview: PASS.
- Remote hydration: PASS, three events across 2025–2027.
- Initial HUD: `SAVED & SYNCED`.
- Refresh HUD: `SAVED & SYNCED`.
- Visible application errors: zero.
- Console errors/warnings after refresh: zero.
- Failed network requests after refresh: zero.
- Five content-addressed font assets: all `200 font/woff2`.
- Timeline data, consent, and configuration mutations by verifier: none.

The verifier first observed `SYNC CONFLICT — REVIEW` in a non-clean profile containing stale local state. That was correctly classified as fail-safe conflict handling, not the clean-profile result. The first clean-profile run then exposed four font 404s and returned PARTIAL. The final immutable WordPress runtime repaired the packaging seam; the repeated clean-profile run returned PASS with no console or network errors.

No unrelated Matrix or application mutation was observed. Unrelated application impact: **NONE**.

---

# Timeline RC1 Production Failure Recovery 002

## Verdict

**PASS.** The Founder-reported post-consent failure is repaired in production. The prior PASS was reopened; this verdict is based on the real production journey in a clean browser plus independent security, persistence, and denial evidence.

## Causal trace

1. WordPress authentication and LearnDash 3893 eligibility succeeded.
2. Consent `d1-500-v1` was stored.
3. Gateway token issuance succeeded.
4. API principal resolution failed because the eligible user had no seeded Timeline principal.
5. The client converted the content-free auth failure into the branded safe-load state.
6. Deterministic first-use principal provisioning repaired that boundary.
7. The contextual replacement consent form then exposed `csrf_failed` in a real clean browser.
8. Authenticated same-origin WordPress AJAX repaired the submission seam without weakening consent policy.
9. Clean-profile grant, hydration, refresh, re-entry, and renewal now settle at `SAVED & SYNCED`.
10. Sanitized logs exposed one `pg` concurrency warning; sequential transaction reads repaired it, 644/644 tests passed, and the final API deployment logs contain no recurrence after live refresh.
11. Independent clean-profile verification found four font 404s; scoped inline-style packaging rewrote them to immutable Timeline asset aliases and a fresh Kinsta release was cut.

## Production release

- Source: `d43af9800ee49407a5cfe43bd2f44b131475867a`.
- Static: `timeline-f5f8ad51fd48010b`.
- WordPress: `timeline-wp-01b09664228a865a`.
- Railway: `b0c3401a-c482-4aac-9580-8e0067554289`.
- Railway image: `sha256:fb5493c8fc87b6764d202d84f13b7103fea3172552047e4bd0d4dab2b0c9dd22`.
- Live URL: `https://missionmedinstitute.com/timeline/`.

## Final truth

Premium onboarding is restored; consent is contextual; first-use identity is deterministic and audited; existing consent does not recur; withdrawal remains available; existing timelines hydrate; protected rendering, fail-soft media, editing, autosave, persistence, export, refresh, renewal, direct-API denial, entitlement denial, and two-owner isolation are covered by live evidence and the authoritative regression suite. No unrelated application impact was observed or introduced.

---

# Timeline RC1 Editor UX 004 Production Closure

## Result

**PASS.** Fixed-denominator RC1 completion is **50/50 (100%)**. The bounded Advanced Studio acceptance is **32/32**, and live PNG, Letter PDF, and A4 PDF exports were downloaded, opened, and visually inspected.

The final source is `b209f11ab19ce94b376d7964dddaef74adbec488`; static release `timeline-32337cedee6cd0a4`; WordPress release `timeline-wp-456f911ff8e0a207`; active payload SHA-256 `7eecc6c70fcbed113eeedb1fca86b3b85d506ed7177ec02fbf41956eb6ae4675`; API release `timeline-c9eda9eeb7d6cf98`; schema `d1-timeline-db-500.1`; live URL `https://missionmedinstitute.com/timeline/`.

Canva was directly operated and studied. Live production acceptance passed for smooth drag/resize, aspect lock/unlock, real grouping and ungrouping, grouped text-plus-shape manipulation, direct text editing, click-to-add, physical rail-to-canvas drag/drop, populated shapes/arrows/icons/flags/backgrounds, snapping/guides, layers, object lock/unlock, zoom without remount, year-axis manipulation, Color Key/profile-card manipulation, undo/redo, save/reload persistence, and export fidelity.

The only post-deployment defect found was five-second object-URL revocation racing Chrome's native save dialog. Commit `b209f11` extends that bounded lifetime to five minutes; the focused protected-kernel/export suite passed **18/18**. Live export artifacts and hashes are recorded in `recovery-003/editor-ux-004/RC1_EDITOR_UX_004_PRODUCTION_CLOSURE.md` and its `export-artifacts/` directory.

Rollout stage is `eligible_360`, governed by LearnDash course `3893` (`learndash-course-3893-live-2026-08-04`). Founder, approved administrator, eligible student, non-360 denial, revoked-360 denial, anonymous denial, direct-API denial, logout/context invalidation, and synthetic-fixture cleanup pass. The current API health endpoint returns HTTP `200`, release `timeline-c9eda9eeb7d6cf98`, schema `d1-timeline-db-500.1`.

Provider backup `TIMELINE-RC1-EDITOR-UX-004-PRE-20260808T161951Z` and scoped snapshot `/www/theresidencyacademy_209/private/timeline-rc1-recovery-backups/20260808T170309Z-export-save-hotfix` are verified. Immediate rollback is `timeline-wp-05a4b831501cfc59`, SHA-256 `36871e450640d22f47f96663abe3fe8fa5f4f71a11102672af3041ec855fa8fa`. Homepage, StoryForge, and Arena remain HTTP `200`; unrelated application impact is **NONE**.

Variable user-managed Color Key categories remain the approved post-RC1 enhancement. No remaining bounded editor finding is a production release blocker.
