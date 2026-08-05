# Timeline RC1 Stabilization Combined Handoff

## Executive result

**PASS.** Timeline Builder is live at `https://missionmedinstitute.com/timeline/`, available under the accepted eligible-360 policy, and independently ready for final seal. This is RC1 stabilization, not Version 2: visual authority, navigation, information architecture, and product behavior were preserved.

Final identities: source `e685e948fd338199a3b47c4305021dde08979a1c`; primary stabilization `635b7d1e761538294976a2ba3a9a980f19d7171e`; R2 signing repair `f4e9b0907c8686257180565514263c61b6bfb19f`; administrator-custody repair `e685e948fd338199a3b47c4305021dde08979a1c`; static `timeline-c9eda9eeb7d6cf98`; WordPress `timeline-wp-7230b1b928fcbad2`; Railway `075cf61c-a91b-4bb7-ba41-69bebdbb3d17`; image `sha256:69068dd247f20f0aec0914acae4bc653e7bc267b0588fc1937243bff7dcea259`.

## Defects and root causes

RC1 fixed the reported P0/P1 media, render, performance, session, and persistence defects. The browser previously lacked a durable production-object handoff and allowed one failed media hydration to reject the protected render. Ordinary persistence events invalidated more preview output than necessary. JWTs were short-lived without proactive renewal. Save state did not clearly distinguish local durability from remote acknowledgement.

The live canary found one additional P0: R2 signed PUT returned `403 SignatureDoesNotMatch`. Credentials and direct SDK writes were valid. AWS SDK presigning had hoisted integrity checksum/metadata into the query string. The final repair keeps checksum and four integrity metadata headers unhoisted, signs content type, and lets R2 validate the same headers sent by the browser. Production then passed sign, PUT, confirm, download, SHA-256, delete, post-delete denial, and cleanup.

An initial Railway upload also selected the repository-root HQ `railway.json`. The health mismatch triggered the automatic rollback condition. The accepted Timeline API was restored and verified before the correct package-root deployment. No WordPress/static cutover had occurred at that point.

A fresh verifier then found an administrator-only contract mismatch. Approved admins were admitted to client remote sync and server media signing even though governing domain authorization and PostgreSQL RLS reserve owned remote documents/media to active students and scoped services. The fix did not widen access: administrators now remain durable and fully usable in their principal-scoped device cache, enqueue no remote document or media write, and receive an early server `OBJECT_UPLOAD_ROLE_DENIED` if the private-media API is called directly. Eligible-student remote persistence and R2 behavior are unchanged.

## Engineering changes

The three RC1 repair commits changed only Timeline package, tests, build, API, and Timeline WordPress-route files. They added a private R2 object store over existing Timeline custody/RLS tables; object sign/confirm/download/delete API routes; durable opaque object IDs; bounded browser object URL ownership; fail-soft renderer projection; presentation-signature invalidation; precise sync states; proactive JWT refresh; visibility recovery; exact R2 CSP; production minification; and an explicit administrator device-local boundary.

No database migration was required. Existing `timeline.media_objects` fields already record storage key, owner, document, MIME, size, hash, state, confirmation, and deletion.

Protected D1-409H hashes remain HTML `bb471c57223c4a8d6c44d2398cc3c2a0da4467b61e7a2d779323c5be38e52c24`, CSS `4efd5088696a93914d5f6c3b7e14e98426239453b16712f152eb5bfe68598ef7`, JavaScript `ca9a28688e7dd29f0e008b58efae85555af860b8150fa9493165faf851165bb8`.

## Private storage decision

The existing avatar storage was Category A: avatar-specific and anonymously/publicly delivered. It failed the Founder-approved reuse conditions and was not modified. RC1 created dedicated private bucket `missionmed-timeline-media-prod`, with no public URL, r2.dev delivery, CDN, custom domain, or DNS change. CORS is restricted to `https://missionmedinstitute.com`, GET/PUT, and the exact required integrity headers. Controlled fixtures were removed; final key count was zero. Current R2-period cost was approximately $0.03, far below the $25/month stop threshold.

## Tests and performance

Full tests passed 636/636: 135 TypeScript and 501 JavaScript. Browser workflows passed 39/39. Release verification passed 62/62; package verification 23/23; typecheck, Matrix App Mode, API build, and API-only boundary passed. The exact media fail-soft proof retained two events and one valid media item, omitted one invalid item with a visible warning, made zero off-origin requests, and preserved all protected hashes.

The production bundle is 1,189,312 bytes raw and 463,643 bytes gzip, approximately 34% smaller than the recorded pre-RC1 raw payload. Representative browser timings were protected render 159 ms, Edit Timeline readiness 208 ms, autosave/reload 649 ms, and export 931 ms. Five live health requests averaged 188.6 ms (129.0–316.5 ms).

## Production verification

Health is `200`, service `mission-timeline`, version `timeline-c9eda9eeb7d6cf98`, schema `d1-timeline-db-500.1`. Direct API access without the gateway returns `403 GATEWAY_REQUIRED`. Final Railway deployment is `075cf61c-a91b-4bb7-ba41-69bebdbb3d17`; the server ready log names the same static release.

Approved administrator access passes and persists on-device by explicit contract. Active student access passes with live LearnDash course 3893 access, consent `d1-500-v1`, and remote saving. A non-360 account is denied with `eligibility_required`. Two production token issues created distinct JTIs; both authorized the API with `200`, and renewal produced a future 120-second expiry.

Private media production canary: list `200`; sign `201`; PUT `200`; confirm `200 CONFIRMED`; download grant `200`; GET `200`; checksum match true; delete `204`; post-delete `404 OBJECT_NOT_FOUND`. A foreign approved administrator could neither download nor delete the student's object; both returned `404 OBJECT_NOT_FOUND`. Owner cleanup was `204`; R2 ended empty.

The saved current preview is `evidence/RC1_CURRENT_PREVIEW.png`. Chromium/browser workflows passed. A final external-Chrome attempt was blocked locally before the site loaded; no live visual success is inferred from that attempt. Separate native Safari, Edge, and Firefox production automation was unavailable; no browser-specific product code was introduced and no defect was observed.

## Blast radius and unrelated impact

Timeline only. The Matrix shell, StoryForge, Arena, USCE, PRIQ, File Vault, WordPress core, shared Railway services, Supabase, DNS, CDN, avatar objects, and unrelated Cloudflare configuration were unchanged. Unrelated application impact is **NONE**.

## Backup and rollback

The provider PostgreSQL backup created 2026-08-05 16:45 EDT is restore-capable. Timeline WordPress backup is `/www/theresidencyacademy_209/private/timeline-rc1-backups/20260805T204718Z`; its 14-file manifest verified after excluding the manifest from self-check.

Immediate containment sets `timeline_enabled=false` and `rollout_stage=off`. WordPress rollback atomically restores the immediately prior RC1 pointer `timeline-wp-ee40c1abc5eabe06`, or accepted D1-500 `timeline-wp-0fc51f8906decb8e` for full RC1 removal. Railway rollback selects the prior successful package-root deployment, verifies health/direct denial, then reapplies the eight authorized media variables with deployment skipped if Railway restored older variables. Do not drop the schema for ordinary application rollback.

The Railway rollback mechanism was exercised during RC1 and restored accepted health before the corrected deployment. The final accepted option is restored exactly: Timeline enabled, eligible-360, one approved administrator canary ID, entitlement verified, consent `d1-500-v1`.

## Final recommendation

Keep RC1 live. Remaining work is normal post-launch observation and optional separate native-browser verification. Remaining findings belong to Version 2 or operational follow-up, not an unresolved production defect.

## Independent verification

The independent verifier initially returned PARTIAL because the administrator remote-media admission contradicted the existing student-only ownership and RLS contract. After commit `e685e94`, it independently confirmed 636/636 tests, typecheck, exact Kinsta pointer/payload, Railway SUCCESS/image, exact health identity, direct API denial, unchanged protected hashes, coherent administrator device-local/server-denial behavior, and no unrelated mutation. Its final remaining conditions were evidence freshness and checksum closure; the package status, event log, combined handoff, independent report, and `PACKAGE_MANIFEST.sha256` were regenerated and verified before seal.
