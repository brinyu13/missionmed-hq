# USCE Phil Auth Recovery State

PRODUCT: USCE Offer/App / MissionMed Clinicals HQ

OUTCOME: LIVE BROWSER ACCEPTED / INCIDENT CLOSED. A real authenticated WordPress administrator can open `https://missionmedinstitute.com/usce-admin/` and arrive at the protected USCE application and live queue without manually handling tokens, URLs, JSON, or recovery steps. Raw `authentication_required` JSON is no longer a normal browser destination.

LIVE IMPLEMENTATION SHA: `8ca364b4162714d93f4835d3a6608b71fc47e5a7`

BASE: `645de1e6bee9e1ffe2c0194cbd2c5aa40b9a6ec0`

BRANCH: `codex/usce-phil-wp-relay-fallback-20260928`

WORKTREE: `/Users/brianb/MissionMed_worktrees/usce-phil-auth-20260928`

PULL REQUEST: `https://github.com/brinyu13/missionmed-hq/pull/36` — open, merge-clean, intentionally not merged into the unrelated canonical lineage.

PRODUCTION DEPLOYMENT/SHA: Railway `4ea220b8-0892-4a29-b16e-1c85298e37cd` / `8ca364b4162714d93f4835d3a6608b71fc47e5a7` — `SUCCESS`; image digest `sha256:f81beeb49654d20581e09909a5ae16284b27f84abcb9b10f4b7ef299196270d2`.

PRODUCTION WORDPRESS PLUGIN: `wp-content/mu-plugins/missionmed-hq-auth-handoff.php` version `1.0.11`; live SHA-256 `8cfb8dadf7193c63722ab3d217f319460922324d9e12fa934c902d02a9fa1813`.

PRODUCTION CDN ASSET: `html-system/LIVE/usce_admin.html`; live SHA-256 `52c71149dd0ce8bb5d44d0974de2c590e8bf5bd125880447c9d155759a156e31`; `Cache-Control: no-cache, no-store, must-revalidate`; Cloudflare observed `DYNAMIC`.

AUTHORITY PACK: direct Founder request and steer in the 2026-09-28 Codex thread; source directive `/Users/brianb/Dropbox (Personal)/SCREENSHOTS/MISSIONMED_USCE_PHIL_AUTH_FOREMAN_2026-09-28.md`; MissionMed OS boot/mission/product/authority indexes were read and validated before mutation.

AUTH ARCHITECTURE: exact `/usce-admin/` WordPress page -> scoped `mmhq_usce_admin_auth_relay` entry -> WordPress login only when needed -> administrator / `manage_options` authorization -> short-lived HMAC handoff in the URL fragment only -> isolated Railway USCE gateway session exchange -> persistent bearer session backed by the canonical Supabase auth bootstrap -> administrator-only USCE API gateway -> live Supabase USCE RPCs. CDN auth-sensitive HTML is `no-cache, no-store`.

PHIL AUTHORITATIVE USER: WordPress ID `36`; login `philaperri`; email `philaperri@gmail.com`; role `administrator`; `manage_options=true`. The account already existed, so no Phil account was created and no Phil password, role, or enrollment was changed.

PHIL LIVE IDENTITY RESULT: handoff exchange `200`; authenticated and persistent `true`; audience/API scope `hq`; canonical Supabase ID `23069a7c-9ecd-4642-b3a8-a87ad797d9e6`; queue `200` with 88 total; existing Offer read `200`; mutation without CSRF `403`; unauthenticated queue `401`; unrelated route `404`; logout `200`; logged-out session false; re-login `200` authenticated.

KNOWN-GOOD RUNTIME: isolated Railway service `missionmed-usce-gateway` (`643853a7-4a40-4418-86be-05807b5d80cc`) with `/health`, administrator-only `MMHQ_ALLOWED_WP_ROLES`, and a narrow route allowlist. The existing main `missionmed-hq` deployment remains independently healthy and was not replaced.

ROLLBACK:

- Kinsta manual backup `Pre USCE admin auth relay 2026-09-28`.
- Original plugin preimage `/www/theresidencyacademy_209/.codex-backups/usce-auth-20260928-1615/missionmed-hq-auth-handoff.php.preimage`.
- Incremental plugin preimages under `/www/theresidencyacademy_209/.codex-backups/usce-auth-20260928-1900/` for versions `1.0.7`, `1.0.8`, `1.0.9`, and `1.0.10`.
- Latest CDN preimage `html-system/BACKUPS/usce_admin/2026-09-28T230731Z/usce_admin.html`, SHA-256 `41456a69f527d382b0047488eb63409312c9aff6373c77a450d8182425e85861`.
- Earlier CDN preimage `html-system/BACKUPS/usce_admin/2026-09-28T204415Z/usce_admin.html` remains intact.

ROOT CAUSE:

1. The WordPress `/usce-admin/` page embedded the CDN shell directly. That let browser/cache state enter an older shell whose recovery URL targeted the legacy generic main-Railway handoff; the user then landed on raw `/api/auth/session` JSON.
2. The generic public-route dispatcher matched all handoff endpoints before WordPress processed the new scoped action. After login it swallowed `mmhq_usce_admin_auth_relay` and evaluated it as the generic `return_to` flow.
3. The new non-admin guard used `status_header(403)` followed by default `wp_die()`, whose default response replaced the intended status with 500.
4. A stale or absent browser bearer previously stopped at a manual Admin Login action. It now clears the stale state and automatically re-enters the sanctioned scoped WordPress relay; unrecoverable states still render a proper login/recovery UI instead of raw JSON.

WHY BACKEND TESTS PASSED WHILE THE BROWSER FAILED: the earlier verifier generated a valid WordPress handoff token directly and called the isolated gateway. It proved the token, Supabase mapping, session, queue, Offer, authorization, and lifecycle contracts, but skipped the WordPress page wrapper, page cache, iframe navigation, login redirect preservation, dispatcher precedence, fragment delivery, and browser session storage. The production defect lived entirely in that skipped integration path.

LIVE BROWSER ACCEPTANCE:

- PASS — logged-out exact `/usce-admin/` deterministically renders the normal WordPress login UI inside the sanctioned wrapper; no raw JSON.
- PASS — normal WordPress administrator login POST -> scoped `admin-post.php?action=mmhq_usce_admin_auth_relay` -> versioned CDN document `200` -> isolated gateway `/api/auth/session` `200` -> protected `/api/usce/admin/public-intake-requests` `200`.
- PASS — protected USCE shell rendered `Live protected`, the secure queue-loaded banner, and 11 active requests in the UI.
- PASS — browser refresh repeats the sanctioned fragment-only exchange and reloads the queue.
- PASS — a fresh browser tab opened directly to exact `/usce-admin/` with no prior HQ session storage automatically establishes a session and loads the queue.
- PASS — WordPress logout returns the exact route to the normal login UI; normal re-login automatically returns to the protected shell and queue.
- PASS — a deliberately stale browser bearer was rejected as unauthenticated, cleared, and automatically recovered through WordPress relay -> CDN -> gateway exchange -> queue, with no visible technical recovery step.
- PASS — an authenticated subscriber/non-admin receives exact HTTP `403` with `USCE administrator access is required`; no shell, queue, token, or raw authentication JSON is exposed.
- PASS — a cryptographically expired WordPress handoff remains exact `401`; a signed non-admin handoff remains exact `403`.

SOURCE / PROVIDER VERIFICATION:

- PASS — PHP syntax and focused auth/gateway suite: 5/5.
- PASS — GitHub PR #36 head is the accepted implementation SHA and Railway production check is `SUCCESS`.
- PASS — live WordPress plugin and CDN hashes match the committed source.
- PASS — exact Phil live verifier passed the complete session/queue/Offer/logout/re-login contract without printing token material.
- PASS — temporary QA administrator and subscriber had zero authored WordPress posts and were removed after acceptance.
- PASS — temporary QA Supabase auth user, identities, sessions, and profile were removed; post-cleanup counts are all zero. The subscriber never reached Supabase bootstrap.
- PASS — no disposable credentials were committed; no Phil credentials were reset or disclosed.

WAITING: none. Terminal browser acceptance is complete. PR #36 remains intentionally unmerged because the target lineage is owned by an unrelated LOR recovery stream; the accepted production artifacts are pinned independently above.

ACTIVE WORKER: one Codex Foreman; no write workers.

## Requirement classification

1. `/usce-admin/` shell loads — `LIVE_VERIFIED`
2. Normal Admin Login entry works — `LIVE_VERIFIED`
3. Authorized WordPress admins are recognized — `LIVE_VERIFIED`
4. Phil's authoritative account is recognized — `LIVE_VERIFIED`
5. Auth/session/token exchange succeeds — `LIVE_VERIFIED`
6. Persistent HQ session is established before protected data renders — `LIVE_VERIFIED`
7. Protected USCE APIs accept the resulting session — `LIVE_VERIFIED`
8. Admin queue loads authorized data — `LIVE_VERIFIED`
9. Admin/Offer mutations remain authorized and CSRF-protected — `LIVE_VERIFIED`
10. Refresh and direct revisit work — `LIVE_VERIFIED`
11. Missing/stale/expired session recovery returns through the sanctioned handoff — `LIVE_VERIFIED`
12. Unauthorized/non-admin users remain exact `403` — `LIVE_VERIFIED`
13. Auth failure retains a usable WordPress login/recovery UI — `LIVE_VERIFIED`
14. Logout/re-login works — `LIVE_VERIFIED`
15. Existing administrator access remains role-based, not Phil-specific — `LIVE_VERIFIED`
16. Student/public shared routes remain protected and responsive — `LIVE_VERIFIED`
17. Sanitized logging and browser evidence record paths/statuses without token values — `LIVE_VERIFIED`
18. Auth-sensitive CDN behavior is correct — `LIVE_VERIFIED`
19. Production lineage and rollback are reproducible — `LIVE_VERIFIED`

## Completion sweep

- PASS — exact Git, GitHub, Railway, WordPress, CDN, and Supabase truth reconciled.
- PASS — accepted source and every superseded live artifact have explicit rollback points.
- PASS — the user-reported browser path was reproduced before mutation and verified after each root-cause repair.
- PASS — real browser acceptance covers automatic handoff, token receipt/consumption, persistent session, shell, queue, refresh, revisit, logout/re-login, stale-session recovery, anonymous recovery UI, and non-admin denial.
- PASS — the server/API evidence is retained as supporting evidence but is no longer used as a substitute for browser acceptance.
- PASS — no sibling LOR controls, unrelated MissionMed OS files, historical duplicate users, payments, email sends, or Offer data were mutated.
