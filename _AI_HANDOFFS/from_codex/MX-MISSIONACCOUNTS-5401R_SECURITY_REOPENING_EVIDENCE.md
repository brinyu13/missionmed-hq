# MX-MISSIONACCOUNTS-5401R

Recorded 2026-09-07; final HTTP/provider readback 2026-09-07T04:47:30.118310+00:00. All times UTC unless stated otherwise.
**Engineering repair deployed; task remains PARTIAL / NOT READY for reopening or 5402A.** FAIL below means the requested acceptance criterion is unmet, including an unperformed witness; it does not necessarily mean the repaired code failed a test. This is not Founder acceptance.

## Privacy result

The pre-containment audit demonstrated a cached authenticated bootstrap crossing principals, including anonymous access, through Kinsta. Direct Railway role isolation had worked. The current root-cause status remains **NOT FIXED end to end**: application code is hardened, but provider-enforced unconditional exclusions have not been established. A generic 503 MISS cannot prove that authenticated responses will bypass cache after reopening.

Deployed changes clear bootstrap/model/user/capabilities/idempotency/private DOM on auth loss; reject stale asynchronous token/API responses using a generation boundary; compare full JWT principal identity; reload on principal change; clear on pagehide and reload persisted pageshow. Backend private responses set no-store/private and Vary Authorization/Cookie. Dedicated WordPress HTML/API/error and SSO success/denial paths add private cache headers. HEAD responses are bodyless. All source changes preserve the unconditional 5400A 503 guard.

## Final observed HTTP evidence

- Twenty final HTTP checks passed their limited readback criteria. Bare root, trailing slash, canonical bootstrap, session and a private deep route each returned two generic GET 503 responses plus an empty HEAD 503. All had X-Kinsta-Cache MISS, CF-Cache-Status DYNAMIC, Cache-Control no-store/private, and Vary Authorization/Cookie; HEAD also exposed Ki-CF-Cache-Status BYPASS. Generic GET body is 142 bytes, SHA `178de43b7b8e625112e5d8823aa898fdf1d33fdc19919e6e8f03d0702b86aa37`.
- Anonymous registered POST token request returned 403, private headers, CF DYNAMIC and Ki-CF BYPASS. Anonymous AJAX bootstrap returned 401, X-Kinsta BYPASS, CF DYNAMIC and Ki-CF BYPASS.
- Set-Cookie was present on these WordPress responses. Only presence was recorded; cookie names/values and session semantics were not exported or certified. Real logout/clean-browser behavior remains unverified.
- An unsupported GET to `/wp-json/missionmed/v1/missionaccounts/token` returned generic REST 404, 114 bytes, SHA `321227fe038fc2f282fd904a174fbaf931eb5d763ce64eded0e6a3f31d32119f`, with X-Kinsta-Cache HIT despite no-store/private. This was a wrong-method generic error, with no observed private payload. It reinforces that the dedicated token endpoint also needs unconditional exclusion verification. It is not a successful authenticated cache test.
- Direct Railway health/config/production HTML were healthy on the final app deployment. HTML SHA `43df23b9c0e4d5df3362d850897aae536cad2edbf64b236531bf7cfa7af4ca24` matched the repaired source. Direct headers are private/no-store with Vary Authorization/Cookie. Payment setup was disabled, mode disabled, publishable key null.

An early readback-script assertion expected an `error` property in the generic 503 JSON; source uses `code`. Another initially called the POST-only token route with GET. Both probe assumptions were corrected after reading the actual handlers; no application change or private payload was needed. The generic GET 404 HIT was retained as a separate observation.

## Principal matrix: evidence levels kept separate

| Case | Direct Railway HTTP engineering proof | Genuine browser through canonical Matrix URL |
|---|---|---|
| Anonymous | Bootstrap/session 401; no private payload | Contained generic 503 only; full reopening row unmet |
| Founder | Correct signed principal; 271 visible students / 3941 effective events | No complete reload/warm/navigation/logout witness |
| Dr J | Not performed; intended distinct mapped account pending | Not performed |
| Student A | Existing WP pilot 620; own single student only, other admin record 403 | Not performed |
| Student B | Existing WP pilot 624; own single student only, other admin record 403 | Not performed |
| Alternation | Founder → A → anonymous → B → Founder, twice each on same direct `/api/ui/bootstrap`, passed | Not performed through reopened gateway |
| Logout / clean storage | Auth lifecycle automated tests pass | Real logout and clean-browser witnesses absent |

The 16 direct checks used legitimate tokens issued by the existing WordPress signer for existing approved principals, kept only in process memory. These are HTTP probes, not human logins or View As acceptance. No JWT, cookie value, student name, email, private response body or provider credential was saved in evidence.

## Provider/security controls

Four new migrations were applied to the isolated MissionAccounts project only. New repair tables have forced RLS, no unsafe anon/authenticated grants, and repair functions are service-role-only. Final Supabase advisors: 38 INFO notices, all RLS-enabled-with-no-client-policy; zero WARN/ERROR. That pattern is intentional for backend service-role tables and is not a reason to weaken RLS. Advisors alone do not certify authorization. Local privacy/PHP/role tests and direct role isolation evidence are additional, bounded proof.

## Remaining cache action and communication gate

No origin Nginx/Edge rule was changed in 5401R, and no broad cache purge occurred. Server configuration access did not provide a supported writable exclusion surface. A Kinsta support message was prepared but not sent. Sending it needs the user's explicit permission because the session developer rule and DR-203 prohibit messages to others without explicit authorization. Code/deploy/data repair authorization has already been used and does not need to be requested again.

The provider should confirm an unconditional namespace and dedicated-token exclusion and a controlled source-IP admission mechanism that keeps all other requests on 503. A cookie/header/query exception must not stand in for a real cache test. Only after that can the complete canonical URL real-role matrix run while general public access stays closed. No global reopening is authorized by this report.

### Prepared Kinsta message — NOT SENT

# Kinsta Support request - MissionAccounts private-route cache exclusion

Site: missionmedinstitute.com
Environment: production, existing site container theresidencyacademy_209
Scope: only the exact path /missionaccounts and every /missionaccounts/ descendant, plus the dedicated /wp-json/missionmed/v1/missionaccounts/token endpoint. Also verify the existing bypass for the MissionAccounts bootstrap action on /wp-admin/admin-ajax.php?action=missionmed_missionaccounts_bootstrap. Do not affect sibling Matrix applications or whole-site caching.

We contained a private-response caching incident by making this namespace return a generic503. Before containment, the canonical /missionaccounts/api/ui/bootstrap URL served a prior authenticated response to another principal and to anonymous requests with X-Kinsta-Cache:HIT, despite the PHP response specifying no-store,private. Credentials and private payloads are intentionally omitted from this request.

Please configure an unconditional exclusion for this complete namespace from Kinsta full-page/Nginx cache AND any Kinsta Edge cache. It must not depend on WordPress cookies, Authorization headers, query parameters, or request method. Please confirm the exact matching semantics cover the bare root, trailing slash, all API/session/bootstrap routes and private HTML/deep links. Existing generic503 containment must remain active.

Final September 7 verification also observed an unsupported GET to the dedicated token endpoint returning a generic REST 404 with X-Kinsta-Cache:HIT despite Cache-Control:no-store,private. No private payload was observed. Its registered POST method safely denied anonymous access with 403, and the anonymous AJAX bootstrap returned 401 with X-Kinsta-Cache:BYPASS. Please include the exact token endpoint in the unconditional rule and confirm the bootstrap action retains its current safe bypass; do not solve this by broadly changing unrelated admin-ajax behavior.

Please confirm whether a temporary provider-enforced source-IP admission rule can be scoped to this namespace for pre-reopening verification: only the designated QA source may reach the normal application, while all other sources continue receiving503. The QA sequence must exercise real authenticated and anonymous requests on the same canonical URL without a cookie/header/query exception that itself changes cache behavior. Coordinate the QA source IP privately when this is ready; do not open the route globally.

After the exclusions are confirmed, we will run the complete Founder/Dr J/two-student/anonymous switching, warm/cold, logout, clean-browser and reload matrix, then separately authorize public reopening if it passes. Please do not reopen it or purge unrelated site cache. Purge only existing cache for the MissionAccounts namespace as needed.

Requested evidence: effective origin/Edge exclusion and matching rules, scoped purge completion, available X-Kinsta-Cache / Ki-CF-Cache-Status / CF-Cache-Status behavior, and confirmation that unrelated site caching is unchanged.


## Evidence

[final-provider-readback.json](/Users/brianb/MissionMed_worktrees/MX-MISSIONACCOUNTS-5401R/missionaccounts/evidence/MX-MISSIONACCOUNTS-5401R/final-provider-readback.json); [sso-wrong-method-cache-observation.json](/Users/brianb/MissionMed_worktrees/MX-MISSIONACCOUNTS-5401R/missionaccounts/evidence/MX-MISSIONACCOUNTS-5401R/sso-wrong-method-cache-observation.json); [principal-api-probes.json](/Users/brianb/MissionMed_worktrees/MX-MISSIONACCOUNTS-5401R/missionaccounts/evidence/MX-MISSIONACCOUNTS-5401R/principal-api-probes.json); [wordpress-deployment.json](/Users/brianb/MissionMed_worktrees/MX-MISSIONACCOUNTS-5401R/missionaccounts/evidence/MX-MISSIONACCOUNTS-5401R/wordpress-deployment.json); [local-validation.json](/Users/brianb/MissionMed_worktrees/MX-MISSIONACCOUNTS-5401R/missionaccounts/evidence/MX-MISSIONACCOUNTS-5401R/local-validation.json).

## Rollback custody and sequence

Keep the current unconditional 503 guard. Never restore the pre-containment unsafe gateway. Revalidate BOOT, exact live targets, and a narrow Lease V2 fence before any rollback; commands below are a runbook, not permission to skip those checks.

1. If any private cross-user response appears, preserve or immediately restore the dedicated route's unconditional containment, then verify generic repeated GET/HEAD responses. The current route already implements it.
2. Pause only Railway worker `ed6498e3-81dd-479a-a659-28b1783e1a75`, project `244bf2d1-1eca-4b97-95ab-95a565a8b4d0`, environment `db6dae0e-cc37-4eff-9bed-3d5fe7cc8f9f`: scoped deployment removal plus `serviceInstanceUpdate` setting `cronSchedule:null`. Both were executed and read back during this repair. Verify no active deployment, no schedule, and no next run. Do not delete the service or variables.
3. Disable only the six core capability variables to their preimage false/0 and redeploy the repaired image. Runtime enforcement is Railway environmentConfig. Restore the six separate DB feature_flag audit records from the `capabilities.enabled` audit event's `from_val` through an audited transaction; changing that table alone does not disable runtime features. Keep auto billing false and Live disabled.
4. App pre-5401R deployment `7baf5aa4-e51a-4d0c-8896-f3611731185c`, image `sha256:f5a2a891d4278936f0b42c3a914bd351acf94997393c841ab6159adfe88a103f`, is recorded. Prefer disabling the bounded feature on repaired source where possible. A historical-image redeploy must first verify provider retention/identity, schema compatibility and contained/paused posture; do not deploy its older public route or enable flags. A full app rollback was not executed.
5. Dedicated WP preimages, mode 0600, are `/www/theresidencyacademy_209/private/MX-MISSIONACCOUNTS-5401R-48e4283-route-preimage.php` (SHA `ac5053d7ce7e86b5417a8fa67a380f1c365da97832d0908bb33b319688ba1eee`) and `.../MX-MISSIONACCOUNTS-5401R-48e4283-sso-preimage.php` (SHA `e2e6e5a0caba6099cd5b1e17e1adcaed8817ea63ff757605a9969cfdef89d22a`). Verify exact source/target, PHP lint and post-copy SHA before use. The route preimage is the contained version. Do not overwrite shared Matrix files.
6. Data receipt `44f24da2-b69e-4a20-af39-ec9d87a393d0` holds the private preimage and immutable operation digests in the production DB. `missionaccounts.api_reverse_zoom_5401(p_repair_id uuid,p_reversal_request_id text,p_actor_id text,p_posture_sha256 text)` requires a new auditable request and SHA of independently verified closed/paused posture. The caller must obtain that posture evidence; the DB cannot observe Kinsta or Railway. The function refuses intervening operation changes, preserves raw/historical/financial truth, and appends compensating mapping/corroboration versions before restoring isolated review projections. It restores the known defective 36/35/31 view, so use only while public access is closed and Zoom is paused. Production reversal was intentionally not executed; apply/replay/conflict/reverse/retry were tested in disposable PostgreSQL.
7. Do not drop applied migrations or broad-restore the whole database for this repair. Any new defect requires a reviewed forward migration. A provider scheduled physical backup at 2026-09-06 17:35:10 UTC was verified in the authenticated Supabase dashboard before apply; Restore was not clicked. The repair's transactional private preimage covers the more recent bounded state.

No rollback requires exposing credentials, tokens, cookies or private student records. Do not run the old temporary mutation scripts blindly: they include exact-state preconditions and one-time operations.

Sanitized evidence commit: `f3f3d0c1dfc2880891cc4d0a7a1be15c481830dc`. Final filing review corrected the 498 human-cycle-row label and redacted two student UUIDs from denied-request paths before remote push.
