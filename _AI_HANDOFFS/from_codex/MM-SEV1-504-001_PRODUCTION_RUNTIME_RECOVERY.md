# MM-SEV1-504-001 — Production Runtime Recovery

## RESULT

**RECOVERED — FULL MATRIX RUNTIME VERIFIED**

MissionMed production is stable after two bounded fixes:

1. the Calendar runtime no longer automatically retries a failed recursive Scheduler authentication path every 10 seconds; and
2. StoryForge now issues and verifies its short-lived WordPress nonce within the same `/wp-admin/admin-ajax.php` cookie context.

The first defect caused the cross-Matrix PHP worker exhaustion and 504 incident. The second caused the remaining real-360 StoryForge 403 after the platform had stabilized. Both were reproduced with exact evidence and fixed independently. No database, role, enrollment, entitlement, cache-rule, provider, or broad Matrix change was made.

## Incident timeline

All times are UTC on 2026-09-09 unless stated otherwise.

| Time | Event |
|---|---|
| 2026-09-08 12:11 | Isolated upstream timeout appears in Kinsta Nginx error log. |
| 2026-09-08 14:30–14:39 | Earlier bounded burst of PHP upstream timeouts. |
| 2026-09-08 23:20:34 | Calendar core later implicated in the retry loop is installed. Initial SHA-256 `cb289e622259cd373f1207a15b614af097563937223d51a3fdb8c6ab8e7b7633`. |
| 2026-09-08 23:29:43 | Independently approved StoryForge SSO `0.1.1` is installed, SHA-256 `0c9f3828dce34a43754cf75b8d7f9d2456aa4f2b0677b4204d1d86d3287c4934`. |
| 00:24–02:15 | Sustained PHP-FPM upstream timeout storm across Scheduler, Matrix REST, cron, MissionAccounts, StoryForge, public and authenticated pages. |
| 02:15–02:22 | Temporary recovery, while the same Scheduler request cycle continues with 200/401/403 responses. |
| 02:23–02:31 | 502/499 responses and upstream timeouts recur. Last new Nginx timeout is at 02:31:27. |
| 02:41:07 | Incident freeze begins (`2026-09-08T22:41:07-0400 EDT`). Dedicated branch/worktree already clean at HEAD `7409a82f056b58335e996dda7e101c310c982f1f`. |
| 03:04:59 | Calendar retry suppression atomically deployed. New SHA-256 `b6f55c8888c4adc016dc39736a46e49f626887c11db2214d6bb8141b2c96c6ec`. |
| 03:09 | A held-open Calendar observation produces zero new Scheduler auth/feed/entitlement requests after the initial load. |
| 03:11 | Human confirms the browser identity is a real 360 account; StoryForge 403 remains open. |
| 03:16 | CDP response body proves `rest_cookie_invalid_nonce`; server-side entitlement independently evaluates trusted, verified and active. |
| 03:21:00 | StoryForge same-cookie-context token exchange atomically deployed as SSO `0.1.2`, SHA-256 `f3d34519f78cda688e4225cefb6ce9e1432fb7f3d4e9a28a490baae29c79f5c7`. |
| 03:21–03:26 | Real 360 StoryForge Home becomes visible; authenticated token action and `/storyforge/api/session` both return 200 with private/no-store headers. |
| 03:27 | Fresh Matrix click, not a direct API probe, again opens visible StoryForge Home. |

## Failure matrix

### Before repair

| Surface | Evidence | Classification |
|---|---|---|
| Public homepage | 200 from cache while dynamic routes failed | Healthy cached control; did not prove origin health |
| Public privacy page | 200, origin/dynamic, about 1.1 seconds | Healthy but materially slower than cached control |
| Matrix member dashboard | Authenticated document could load, while its dynamic API calls queued for seconds | Degraded shared runtime |
| Calendar | Primary WordPress data could render; Scheduler enrichment retried indefinitely after timeout/403 | **Root contributor** |
| Scheduler / My Appointments | Hundreds of proxy/auth/feed timeouts and 499/504 responses | **Root amplification path** |
| StoryForge | One 504 during the global storm; after recovery a real 360 user still received token 403 | Global-storm collateral, plus independent nonce-cookie-path defect |
| File Vault / Timeline / public pages | Visible collateral timeouts in shared PHP pool | Collateral |
| MissionAccounts | Three timeouts during the storm; cache exclusions remained exact and private | Collateral; not causal |

The operational parser classified the 02:00+ error window as:

```text
MM_SEV1_504_HEALTH_FAIL timeouts=444 matrix_families=6 routes=auth:90,matrix-api:114,matrix-page:10,missionaccounts:3,other:57,scheduler:169,storyforge:1
```

High-volume exact paths in the 02:00 hour included 110 Scheduler entitlement calls, 104 `/api/auth/session` calls, 88 admin calendar-feed calls, 79 Matrix profile calls, 58 cron calls and 57 Matrix courses calls.

### After repair

Dashboard, Calendar, Scheduler, My Appointments, File Vault and real-360 StoryForge all render visibly. No 504 or new Nginx upstream timeout occurred during the post-release verification window.

## Kinsta/PHP evidence

**VERIFIED FACT:** `/var/log/sitelogs/error.log` contains sustained `upstream timed out (110: Connection timed out) while reading response header from upstream` against the site PHP-FPM Unix socket.

**VERIFIED FACT:** PHP is 8.2.29. The pool has `pm.max_children = 4`, `pm.max_requests = 2500`, and PHP `memory_limit = 256M`. The database allows 10 connections.

**VERIFIED FACT:** During the incident, the four-worker PHP pool was asked to hold an outer WordPress proxy request for up to 20 seconds while the external Scheduler service called back into multiple WordPress REST endpoints. The browser abandoned its enrichment request after 2.5 seconds and the Calendar scheduled another attempt after 10 seconds.

**VERIFIED FACT:** Host disk and memory were not pressured. Initial disk use was 4%; more than 7 GB memory remained available. After repair, host load was `3.56 4.40 4.94`, 7,067 MB remained available, and only 106 MB swap was used.

**LIMITATION:** The SSH account can read Nginx access/error logs and PHP pool configuration but cannot read `/var/log/php8.2-fpm.log*`. That provider permission limitation did not block causal proof or recovery.

## MissionAccounts cache-rule verification

The production state observed before either incident change was:

```text
route_enabled=true
route_open=true
sso_plugin_active=true
```

No MissionAccounts setting, route, plugin, backend, hash or cache rule was changed. “Contained” here means the pre-existing route remained authenticated/private and non-cacheable; this incident did not reopen or widen it.

Effective live probes after repair:

| Request | Status | Cache result |
|---|---:|---|
| `/` | 200 | `CF HIT`, `Ki-CF HIT`, `X-Kinsta HIT`, public `s-maxage=86400` |
| `/missionaccounts` | 308 | `CF DYNAMIC`, `X-Kinsta BYPASS`, `no-store, private` |
| `/missionaccounts/` | 200 shell | `CF DYNAMIC`, `X-Kinsta BYPASS`, `no-store, private` |
| MissionAccounts token endpoint, anonymous GET | 404 | `CF DYNAMIC`, `X-Kinsta BYPASS`, `no-store, private` |
| MissionAccounts bootstrap, exact action | 401 | `CF DYNAMIC`, `Ki-CF BYPASS`, `X-Kinsta BYPASS`, private/no-store |
| Bootstrap with action before an extra query | 401 | same private bypass |
| Bootstrap with action after an extra query | 401 | same private bypass |

This proves the exclusions are effective for both query orderings and do not turn the unrelated homepage into an origin-only response. No broad purge or rule removal was performed.

## Shared Matrix bootstrap analysis

**VERIFIED FACT:** No MissionAccounts bootstrap or token reference exists in the shared MissionMed Hub assets/includes. Exact string search found those endpoints only in the MissionAccounts SSO and route files.

**VERIFIED FACT:** MissionAccounts injects only a local launch module on the Matrix route after its own access decision. It does not call its bootstrap/token/backend during ordinary Matrix shell load.

**VERIFIED FACT:** The repeated shared traffic was Calendar-owned Scheduler enrichment, not MissionAccounts. The live Calendar core called `/api/auth/session?mm_scheduler_exchange=1&audience=scheduler`, then a Scheduler feed. Failure scheduled `loadScheduler()` again after 10 seconds.

## StoryForge global-hook analysis

**VERIFIED FACT:** StoryForge’s global WordPress registrations are route registration, private-header filters, Matrix navigation/tile/menu filters and a Matrix-only launch adapter. The adapter first checks the Matrix path and access.

**VERIFIED FACT:** The only StoryForge `wp_remote_get()` is a bounded Arena-avatar projection called while issuing a StoryForge JWT. It is not executed on unrelated public or Matrix routes.

**VERIFIED FACT:** The incident log contained one StoryForge upstream timeout versus 169 Scheduler-family timeouts in the same classified window. StoryForge was not the cause of the site-wide worker storm.

**VERIFIED FACT:** The later real-360 403 was a separate StoryForge bridge defect. CDP captured the exact body:

```json
{"code":"rest_cookie_invalid_nonce","message":"Cookie check failed","data":{"status":403}}
```

The same browser sent an exact-host `wordpress_logged_in` cookie scoped to `/wp-admin` during bootstrap, but that cookie was correctly omitted as `NotOnPath` at `/wp-json`; the site-wide WordPress cookies remained present. A nonce issued under the admin-path session token therefore failed verification under the REST-path session token.

## Root cause

### Cross-Matrix 504 root cause

**PROVEN:** Calendar’s uncapped 10-second Scheduler retry loop amplified a slow recursive proxy topology beyond the four-worker PHP pool.

The causal chain was:

```text
Calendar mount
  -> WordPress /api/auth/session proxy (20-second upstream allowance)
     -> external Scheduler/HQ service
        -> multiple synchronous callbacks into WordPress
  -> browser deadline at 2.5 seconds
  -> request abandoned client-side while PHP remains occupied
  -> automatic retry after 10 seconds
  -> overlapping outer requests + callbacks
  -> four PHP workers exhausted
  -> unrelated dynamic Matrix/public routes time out
```

The deployed code, request timing, exact access-log cadence, four-worker configuration, cross-route Nginx failures, and immediate absence of the cycle after suppression all agree with this mechanism.

### Remaining real-360 StoryForge root cause

**PROVEN:** The StoryForge bootstrap and token verifier used different cookie paths. A valid freshly issued REST nonce was bound to the `/wp-admin` login-session token but verified against the site-wide login-session token at `/wp-json`.

Entitlement was not causal: the same user evaluated as `wordpress_learndash_handoff`, trusted, verified, active, and allowed before the StoryForge fix.

## Isolation experiments

1. Public cached control stayed fast while dynamic routes timed out: origin/PHP layer implicated.
2. MissionAccounts paths remained narrowly bypassed while `/` remained HIT: broad cache-rule theory rejected.
3. Nginx path counts were dominated by Scheduler/auth/Matrix callbacks: Scheduler topology selected.
4. Exact live Calendar asset plus new regression test failed by observing a scheduled 10,000 ms timer.
5. Removing only that timer made all 20 Calendar tests pass and produced zero repeated Scheduler requests during a held-open live Calendar observation.
6. StoryForge entitlement evaluated allowed while its browser token response remained 403: entitlement theory rejected.
7. CDP response body and cookie-scope comparison proved the nonce-cookie mismatch.
8. Moving only the token exchange to the same admin-AJAX context changed the same browser from 403 to visible StoryForge Home; authenticated token and session calls both became 200.

## Stabilization actions

- Stopped automatic Scheduler enrichment retry on degradation. Calendar primary data remains available; an explicit route/user refresh may try enrichment again.
- Moved StoryForge token exchange to a private POST-only admin-AJAX action so nonce issuance and verification share the same WordPress auth cookie context.
- Preserved the REST token route for compatibility.
- Performed no PHP restart, database restart, cache purge, cache-rule edit, plugin rollback, Railway release, Supabase write or MissionAccounts change.

## Durable fix

Incident branch:

```text
codex/mm-sev1-504-001-runtime-recovery
```

Commits:

```text
f37709e fix(calendar): stop recursive scheduler retry storm
12dd9b7 fix(storyforge): bind token exchange to bootstrap session
```

Changed production files only:

| File | Before SHA-256 | After SHA-256 |
|---|---|---|
| `wp-content/plugins/missionmed-hub/assets/calendar-core/mmed-calendar-core.js` | `cb289e622259cd373f1207a15b614af097563937223d51a3fdb8c6ab8e7b7633` | `b6f55c8888c4adc016dc39736a46e49f626887c11db2214d6bb8141b2c96c6ec` |
| `wp-content/plugins/missionmed-storyforge-sso/missionmed-storyforge-sso.php` | `0c9f3828dce34a43754cf75b8d7f9d2456aa4f2b0677b4204d1d86d3287c4934` | `f3d34519f78cda688e4225cefb6ce9e1432fb7f3d4e9a28a490baae29c79f5c7` |

Calendar is file-mtime versioned and the browser loaded `?ver=1788923099`; no cache purge was needed. StoryForge SSO mode remained locked `0444`; Calendar mode remained `0644`; owner/group remained unchanged.

## Tests/regression coverage

| Test | Result |
|---|---|
| Exact-live Calendar test before fix | Expected FAIL: 10,000 ms automatic retry observed |
| Calendar syntax | PASS |
| Calendar suite | PASS, 20/20 |
| PHP syntax for StoryForge SSO | PASS |
| Incident Python contract tests | PASS, 6/6 after final addition |
| Held-open production Calendar | PASS: zero new Scheduler auth/feed/entitlement requests after initial load |
| Real 360 Matrix → StoryForge browser journey | PASS |
| Operational multi-route timeout parser on incident window | Expected FAIL, 444 timeouts across six Matrix families |
| Operational parser post-fix | PASS, zero new upstream timeouts |

Permanent incident guard:

```text
tools/mm-sev1-504-health-check.py
```

It fails when repeated Nginx upstream failures span multiple Matrix route families. The StoryForge contract test also locks same-cookie-context exchange, method/origin/nonce/access/rate/JWT gates, REST compatibility and the unrelated-page remote-work boundary.

## Production verification matrix

| Check | Result |
|---|---|
| Homepage | PASS, 200 cached control |
| Public dynamic page | PASS, 200 |
| Authenticated member dashboard / Home | PASS, visible mount, no failure state |
| Calendar | PASS, visible live calendar with existing events |
| Scheduler | PASS, visible native Scheduler mount |
| My Appointments | PASS, visible appointments/history |
| File Vault | PASS, visible app mount |
| Real 360 Matrix click → StoryForge | PASS, visible StoryForge Home and existing private library |
| Authenticated StoryForge token exchange | PASS, 200, private/no-store |
| Authenticated `/storyforge/api/session` | PASS, 200, private/no-store |
| Anonymous `/storyforge/api/session` | PASS DENY, 401, private/no-store |
| Anonymous StoryForge token GET | PASS DENY, 405 |
| Anonymous StoryForge token POST without nonce | PASS DENY, 403 |
| Existing non-360 entitlement | PASS DENY, 403 `eligibility_required` |
| MissionAccounts private routes | PASS, BYPASS/DYNAMIC and private/no-store |

## 504-free stability window

Calendar fix deployed at 03:04:59. StoryForge fix deployed at 03:21:00. At the report seal, the Kinsta Nginx error log had received no new upstream timeout since 02:31:27, and the operational health check remained:

```text
MM_SEV1_504_HEALTH_PASS timeouts=0 matrix_families=0 routes=none
```

The final sealed duration and access-log 5xx count are recorded in the closing commit after the last observation.

## Cache/header verification

- Unrelated `/`: public cache HIT and `s-maxage=86400`.
- Authenticated Matrix document/API calls: private/no-store, `X-Kinsta BYPASS`, `CF DYNAMIC`.
- StoryForge shell and API: private/no-store and gateway headers; immutable assets retain immutable browser caching but CDN bypass/no-store policy.
- StoryForge authenticated token action: 200 with `no-cache, must-revalidate, max-age=0, no-store, private`.
- MissionAccounts shell/token/bootstrap variants: private/no-store and Kinsta bypass.
- No private response was observed as HIT.

## PHP/MySQL health

Post-fix snapshot:

```text
host load: 3.56 4.40 4.94
memory available: 7067 MB
swap used: 106 MB
Threads_connected: 1
Threads_running: 1
Slow_queries: 6
Aborted_connects: 7
max_connections: 10
slow_query_log: OFF
long_query_time: 1.0 s
```

There was no growing Nginx upstream queue, no new 504, no new cross-route timeout sequence and no evidence of memory, disk or MySQL connection exhaustion after repair.

## Security/no-blast-radius proof

- The real 360 entitlement remained trusted, verified and active; no entitlement was added or altered.
- An existing non-360 account still fails closed with `eligibility_required` 403.
- Anonymous StoryForge session remains 401.
- Token exchange remains POST-only, same-origin checked, nonce checked, access checked, rate limited, short-lived and private/no-store.
- The REST token route remains in place for compatibility but is no longer selected by bootstrap.
- MissionAccounts route/settings/hashes and cache rules are unchanged.
- No WordPress role, user identity, LearnDash enrollment, StoryForge data, Supabase row, Railway deployment, database schema or cache configuration was modified.
- Protected Matrix bytes other than the proven Calendar root-cause asset are unchanged. Verified retained hashes include Calendar V2 `b5696c...b17874`, classic renderer `6a1ca3...3cb480`, Scheduler mount `2a47b8...e7578`, student OS `38507e...937a`, and StoryForge launch adapter `fd96fc...105c`.

## Rollback state

Exact private rollback bytes exist on Kinsta:

```text
/www/theresidencyacademy_209/private/mm-sev1-504-001/20260909T030416Z/mmed-calendar-core.js.before
/www/theresidencyacademy_209/private/mm-sev1-504-001/20260909T032025Z/missionmed-storyforge-sso.php.before
```

Rollback only the affected file, verify its recorded predecessor SHA-256, restore original ownership/mode, and re-run the full route/security matrix. No rollback condition occurred.

## Final live state

- Calendar core: `b6f55c8888c4adc016dc39736a46e49f626887c11db2214d6bb8141b2c96c6ec`
- StoryForge SSO `0.1.2`: `f3d34519f78cda688e4225cefb6ce9e1432fb7f3d4e9a28a490baae29c79f5c7`
- StoryForge launch adapter unchanged: `fd96fc1e3c81135d31addc0ae9d354083e3db7a7268111193cb88845de91105c`
- MissionAccounts SSO unchanged: `af08b97a26b015cbc6858f5fc09411103d26dca15a177164150a0deeb655e0c6`
- MissionAccounts route unchanged: `045088fb125635032c3f82ea78fbc08f8a9ca7830da1c6007959a02556eb3bbe`
- MissionAccounts route-open sentinel unchanged: `62e8870b4dc6395f910b28cc20e34b1ae73fee3c086e10abbfa0553d0bc60ff5`
- Real 360 StoryForge Home: visible and working
- Matrix Dashboard, Calendar, Scheduler, My Appointments and File Vault: visible and working
- Multi-route 504 health check: PASS

## Residual uncertainty

1. PHP-FPM’s own slow log remains unreadable to the site SSH account. Nginx timing/path evidence was sufficient to prove and clear the worker-exhaustion mechanism.
2. A separate canonical-admin browser session was not safely available in this incident window. The same-day SF-ACCESS-5016 admin/API acceptance remains the latest admin proof; this incident preserved its authorization logic and independently verified the required real-360 browser journey.
3. MissionAccounts was already `route_enabled=true` and `route_open=true` at freeze. It was not changed here; its effective privacy/cache containment was reverified. Any product decision to disable that pre-existing route is outside this root-cause repair.

None of these uncertainties affects the recovered platform result or the verified real-360 path.
