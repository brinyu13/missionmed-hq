# USCE Phil Auth Recovery State

PRODUCT: USCE Offer/App / MissionMed Clinicals HQ

OUTCOME: LIVE ACCEPTANCE FAILED / INCIDENT REOPENED. A real WordPress administrator opening `/usce-admin/` reached raw `authentication_required` JSON instead of the protected USCE application. Prior completion is retracted pending a successful browser-level handoff and queue load.

HEAD: `00769afd394087b0c465fca8247ccd38a41f1368`

BASE: `645de1e6bee9e1ffe2c0194cbd2c5aa40b9a6ec0`

BRANCH: `codex/usce-phil-wp-relay-fallback-20260928`

WORKTREE: `/Users/brianb/MissionMed_worktrees/usce-phil-auth-20260928`

PRODUCTION DEPLOYMENT/SHA: Railway `99aee270-7844-4ef3-b8c6-d4a6846d639b` / `00769afd394087b0c465fca8247ccd38a41f1368` — `SUCCESS`

PRODUCTION ROUTE: `https://missionmedinstitute.com/usce-admin/` is currently browser-failing. Screenshot evidence from approximately 18:43 ET on 2026-09-28 shows its Admin Login path invoking the legacy generic WordPress handoff toward `https://missionmed-hq-production.up.railway.app/api/auth/session`, which returns raw authentication JSON. The scoped CDN/gateway path remains deployed but is not yet proven to be the path used by this WordPress route.

AUTHORITY PACK: direct Founder request and steer in the 2026-09-28 Codex thread; source directive `/Users/brianb/Dropbox (Personal)/SCREENSHOTS/MISSIONMED_USCE_PHIL_AUTH_FOREMAN_2026-09-28.md`; MissionMed OS boot/mission/product/authority indexes read and validated before mutation.

AUTH ARCHITECTURE: WordPress `manage_options` / administrator identity -> short-lived HMAC handoff kept in the URL fragment -> Railway HQ session exchange -> persistent encrypted session and canonical Supabase bootstrap -> administrator-only USCE API gateway -> Supabase USCE RPCs. CDN auth-sensitive HTML is `no-cache, no-store`.

PHIL AUTHORITATIVE USER ID: WordPress `36`

PHIL AUTHORITATIVE EMAIL: `philaperri@gmail.com`

PHIL ROLES/CAPABILITIES: `administrator`; `manage_options=true`; username `philaperri`; enrolled in the relevant MissionMed Clinicals courses.

KNOWN-GOOD RUNTIME: isolated Railway service `missionmed-usce-gateway` (`643853a7-4a40-4418-86be-05807b5d80cc`) with `/health`, administrator-only `MMHQ_ALLOWED_WP_ROLES`, and a narrow route allowlist. The existing main `missionmed-hq` deployment remains independently healthy and unchanged.

ROLLBACK: restore Kinsta manual backup `Pre USCE admin auth relay 2026-09-28`; or restore plugin preimage `/www/theresidencyacademy_209/.codex-backups/usce-auth-20260928-1615/missionmed-hq-auth-handoff.php.preimage`; restore R2 object `html-system/BACKUPS/usce_admin/2026-09-28T204415Z/usce_admin.html`; leave the isolated gateway unused. Main Railway traffic was never replaced.

ROOT CAUSE: REOPENED / UNDER ACTIVE DIAGNOSIS. Server-side token and gateway probes passed because they generated and exchanged a handoff directly against the isolated gateway. The real WordPress browser path instead exposed a legacy `mmac_hq_auth_redirect` URL targeting the old main Railway service and returned raw authentication JSON. The exact `/usce-admin/` page/template/button wiring and redirect-chain failure are being traced before mutation.

ACCEPTED: server/API-only evidence remains valid but is insufficient for closure: exact Phil WordPress token proof; direct gateway session exchange; Supabase mapping `23069a7c-9ecd-4642-b3a8-a87ad797d9e6`; queue 200 with 88 total requests; existing Offer read 200; logout/re-login API lifecycle; expired handoff 401; unauthenticated queue 401; non-admin handoff 403; CSRF and route isolation; focused tests 7/7; Railway build tests 69/69. None of this establishes the real WordPress browser integration contract.

WAITING: no routine decision. Browser integration diagnosis and fix-forward are active. PR #36 remains intentionally unmerged into the canonical main service until the unrelated LOR owner renews its independent restore proof.

ACTIVE WORKER: one Codex Foreman; no write workers.

NEXT CRITICAL PATH: preserve the accepted source and rollback points; resolve the live WordPress `/usce-admin/` page/template and redirect chain; repair it to use the sanctioned scoped relay and isolated gateway; then prove in a real browser: authenticated admin -> automatic handoff -> persistent session -> USCE shell -> queue, plus refresh, revisit, logout/re-login, expired-session recovery, and fail-closed non-admin behavior.

## Requirement classification

1. `/usce-admin/` shell loads — `LIVE_FAILED`
2. Admin Login entry works — `LIVE_FAILED`
3. Authorized WordPress admins are recognized — `IMPLEMENTED_NEEDS_BROWSER_ACCEPTANCE`
4. Phil's authoritative account is recognized — `IMPLEMENTED_NEEDS_BROWSER_ACCEPTANCE`
5. Auth/session/token exchange succeeds — `IMPLEMENTED_NEEDS_BROWSER_ACCEPTANCE`
6. Protected USCE APIs accept the resulting session — `IMPLEMENTED_NEEDS_BROWSER_ACCEPTANCE`
7. Admin queue loads authorized data — `IMPLEMENTED_NEEDS_BROWSER_ACCEPTANCE`
8. Admin/Offer mutations remain authorized and CSRF-protected — `LIVE_VERIFIED`
9. Session survives navigation/reload-equivalent follow-up — `IMPLEMENTED_NEEDS_BROWSER_ACCEPTANCE`
10. Expired session recovers to the visible login path — `IMPLEMENTED_NEEDS_BROWSER_ACCEPTANCE`
11. Unauthorized users remain blocked — `LIVE_VERIFIED`
12. Auth failure retains a usable Admin Login recovery action — `LIVE_FAILED`
13. Logout/re-login works — `IMPLEMENTED_NEEDS_BROWSER_ACCEPTANCE`
14. Existing administrator access remains role-based, not Phil-specific — `LIVE_VERIFIED`
15. Student/public shared routes remain protected and responsive — `LIVE_VERIFIED`
16. Sanitized logging records path/status without handoff query material — `LIVE_VERIFIED`
17. Auth-sensitive CDN behavior is correct — `IMPLEMENTED_NEEDS_BROWSER_ACCEPTANCE`
18. Production lineage is reproducible — `LIVE_VERIFIED`

## Independent completion sweep

- PASS — authoritative WordPress and duplicate-account truth established; no account or password mutation was needed.
- PASS — recurring merge-lineage/runtime drift identified from live behavior and exact deployed source.
- PASS — permanent source fixes committed and reviewed in PR #36.
- PASS — focused and provider build tests pass.
- PASS — live deployment is tied to the exact SHA above.
- FAIL — the actual WordPress `/usce-admin/` browser route reached raw authentication JSON through a legacy handoff path instead of the isolated gateway-backed shell.
- RETRACTED — server-side session, queue, Offer, persistence, logout, re-login, and expiry probes do not substitute for the required browser flow.
- PASS — unauthenticated, non-admin, missing-CSRF, invalid-token, and unrelated-route boundaries fail closed.
- PASS — rollback has provider-native and object-level preimages.
- PASS — no sibling LOR controls, unrelated MissionMed OS files, historical duplicate users, payments, email sends, or Offer data were mutated.
