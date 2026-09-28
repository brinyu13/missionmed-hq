# USCE Phil Auth Recovery State

PRODUCT: USCE Offer/App / MissionMed Clinicals HQ

OUTCOME: Phil reliably authenticates and uses `/usce-admin/`; the protected request queue and existing Offer record load through a persistent administrator-only session.

HEAD: `00769afd394087b0c465fca8247ccd38a41f1368`

BASE: `645de1e6bee9e1ffe2c0194cbd2c5aa40b9a6ec0`

BRANCH: `codex/usce-phil-wp-relay-fallback-20260928`

WORKTREE: `/Users/brianb/MissionMed_worktrees/usce-phil-auth-20260928`

PRODUCTION DEPLOYMENT/SHA: Railway `99aee270-7844-4ef3-b8c6-d4a6846d639b` / `00769afd394087b0c465fca8247ccd38a41f1368` — `SUCCESS`

PRODUCTION ROUTE: `https://missionmedinstitute.com/usce-admin/` serving `https://cdn.missionmedinstitute.com/html-system/LIVE/usce_admin.html`, backed by `https://missionmed-usce-gateway-production.up.railway.app`

AUTHORITY PACK: direct Founder request and steer in the 2026-09-28 Codex thread; source directive `/Users/brianb/Dropbox (Personal)/SCREENSHOTS/MISSIONMED_USCE_PHIL_AUTH_FOREMAN_2026-09-28.md`; MissionMed OS boot/mission/product/authority indexes read and validated before mutation.

AUTH ARCHITECTURE: WordPress `manage_options` / administrator identity -> short-lived HMAC handoff kept in the URL fragment -> Railway HQ session exchange -> persistent encrypted session and canonical Supabase bootstrap -> administrator-only USCE API gateway -> Supabase USCE RPCs. CDN auth-sensitive HTML is `no-cache, no-store`.

PHIL AUTHORITATIVE USER ID: WordPress `36`

PHIL AUTHORITATIVE EMAIL: `philaperri@gmail.com`

PHIL ROLES/CAPABILITIES: `administrator`; `manage_options=true`; username `philaperri`; enrolled in the relevant MissionMed Clinicals courses.

KNOWN-GOOD RUNTIME: isolated Railway service `missionmed-usce-gateway` (`643853a7-4a40-4418-86be-05807b5d80cc`) with `/health`, administrator-only `MMHQ_ALLOWED_WP_ROLES`, and a narrow route allowlist. The existing main `missionmed-hq` deployment remains independently healthy and unchanged.

ROLLBACK: restore Kinsta manual backup `Pre USCE admin auth relay 2026-09-28`; or restore plugin preimage `/www/theresidencyacademy_209/.codex-backups/usce-auth-20260928-1615/missionmed-hq-auth-handoff.php.preimage`; restore R2 object `html-system/BACKUPS/usce_admin/2026-09-28T204415Z/usce_admin.html`; leave the isolated gateway unused. Main Railway traffic was never replaced.

ROOT CAUSE: live CDN code expected an admin relay and protected USCE route family that the healthy Railway source `c080f8167a8f82df1df5910a2c78ebd5cb0df337` had lost during divergent merge lineage. The missing relay produced the recurring failed post-login flow; after restoring it, the same drift exposed missing queue/Offer route dispatch as HTTP 404. The canonical main-service candidate could not replace the healthy runtime because an unrelated LOR restore attestation had expired, so the production guardian correctly failed that deployment closed.

ACCEPTED: exact Phil WordPress handoff 200; persistent HQ session 200; Supabase mapping `23069a7c-9ecd-4642-b3a8-a87ad797d9e6`; protected queue 200 with 88 total requests; existing Offer read 200; logout 200; logged-out session false; re-login 200; expired handoff 401; unauthenticated queue 401; non-admin WordPress handoff 403; mutation without CSRF 403; invalid public offer 404; unrelated gateway routes 404; CDN runtime hash `41456a69f527d382b0047488eb63409312c9aff6373c77a450d8182425e85861`; focused tests 7/7; Railway build tests 69/69; 46 sampled live log lines contained zero token/handoff query material.

WAITING: no USCE production blocker. PR #36 remains intentionally unmerged into the canonical main service until the LOR owner renews the independent restore proof; this does not block the dedicated live USCE runtime.

ACTIVE WORKER: one Codex Foreman; no write workers.

NEXT CRITICAL PATH: incident complete. Keep PR #36 open until the independent LOR restore proof is renewed; the dedicated USCE runtime remains the accepted production path.

## Requirement classification

1. `/usce-admin/` shell loads — `LIVE_VERIFIED`
2. Admin Login entry works — `LIVE_VERIFIED`
3. Authorized WordPress admins are recognized — `LIVE_VERIFIED`
4. Phil's authoritative account is recognized — `LIVE_VERIFIED`
5. Auth/session/token exchange succeeds — `LIVE_VERIFIED`
6. Protected USCE APIs accept the resulting session — `LIVE_VERIFIED`
7. Admin queue loads authorized data — `LIVE_VERIFIED`
8. Admin/Offer mutations remain authorized and CSRF-protected — `LIVE_VERIFIED`
9. Session survives navigation/reload-equivalent follow-up — `LIVE_VERIFIED`
10. Expired session recovers to the visible login path — `LIVE_VERIFIED`
11. Unauthorized users remain blocked — `LIVE_VERIFIED`
12. Auth failure retains a usable Admin Login recovery action — `LIVE_VERIFIED`
13. Logout/re-login works — `LIVE_VERIFIED`
14. Existing administrator access remains role-based, not Phil-specific — `LIVE_VERIFIED`
15. Student/public shared routes remain protected and responsive — `LIVE_VERIFIED`
16. Sanitized logging records path/status without handoff query material — `LIVE_VERIFIED`
17. Auth-sensitive CDN behavior is correct — `LIVE_VERIFIED`
18. Production lineage is reproducible — `LIVE_VERIFIED`

## Independent completion sweep

- PASS — authoritative WordPress and duplicate-account truth established; no account or password mutation was needed.
- PASS — recurring merge-lineage/runtime drift identified from live behavior and exact deployed source.
- PASS — permanent source fixes committed and reviewed in PR #36.
- PASS — focused and provider build tests pass.
- PASS — live deployment is tied to the exact SHA above.
- PASS — browser-rendered production shell is healthy and carries the isolated gateway config.
- PASS — exact Phil-equivalent server-side session, queue, Offer, persistence, logout, re-login, and expiry paths are accepted.
- PASS — unauthenticated, non-admin, missing-CSRF, invalid-token, and unrelated-route boundaries fail closed.
- PASS — rollback has provider-native and object-level preimages.
- PASS — no sibling LOR controls, unrelated MissionMed OS files, historical duplicate users, payments, email sends, or Offer data were mutated.
