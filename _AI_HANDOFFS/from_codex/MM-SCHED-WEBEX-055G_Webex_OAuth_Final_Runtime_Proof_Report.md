# MM-SCHED-WEBEX-055G Webex OAuth Final Runtime Proof Report

## RESULT

WEBEX OAUTH RECONNECTED BUT BOOKING PARTIAL

## Starting Branch / Status

- Worktree: `/Users/brianb/MissionMed_worktrees/mm-sched-webex-055-dr-brian-webex-booking`
- Branch: `mm-sched-webex-055-dr-brian-webex-booking`
- Starting HEAD: `58e2541 fix(scheduler): route Webex OAuth through reachable gateway`
- Starting status: one pre-existing untracked report, `_AI_HANDOFFS/from_codex/MM-SCHED-WEBEX-055B_Source_Truth_Import_Plan.md`

## Ending Branch / Status

- Branch remained: `mm-sched-webex-055-dr-brian-webex-booking`
- Ending HEAD: `b0184f8 fix(scheduler): use documented Webex REST endpoint`
- Ending status: no tracked dirty files; pre-existing untracked 055B report remains unmodified.

## Files Modified

- `wp-content/mu-plugins/mm-scheduler-webex-broker.php`

## Commits Created

- `9b16b10 fix(scheduler): verify Webex OAuth status`
- `9a02830 fix(scheduler): use documented Webex OAuth endpoint`
- `b0184f8 fix(scheduler): use documented Webex REST endpoint`

## Webex OAuth Reconnect Result

- Reconnected without Brian re-entering secrets.
- Root cause changed from "credentials likely invalid" to "broker was sending OAuth/REST through the wrong Webex host."
- Official Webex docs still document OAuth authorize/token on `https://webexapis.com/v1/authorize` and `https://webexapis.com/v1/access_token`.
- Live broker now uses documented `https://webexapis.com/v1` for OAuth and REST by default.
- Live admin Webex status now validates `/people/me` instead of trusting token presence.
- Safe live status result: `connected`, host email present, no token/secret printed.
- Safe auth URL result: host `webexapis.com`, path `/v1/authorize`.

References used:
- https://developer.webex.com/docs/login-with-webex
- https://developer.webex.com/meeting/docs/api/guides/integrations-and-authorization

## Webex Broker Health Result

- Live token refresh through `webexapis.com/v1/access_token`: PASS.
- Live `/people/me` through `webexapis.com/v1/people/me`: PASS.
- Same token against `integration.webexapis.com/v1/people/me`: FAIL 401, confirming `integration.webexapis.com` was the wrong REST base for this token.
- Unsigned broker request remains rejected with `scheduler_webex_broker_stale_signature` / 401.

## Direct Webex Meeting Proof

- Created a real Webex test meeting through the live WordPress broker.
- Test title prefix: `WEBEX-TEST-DO-NOT-USE`
- Meeting ID present: yes.
- Join URL present: yes.
- Join URL host: `missionresidency.my.webex.com`
- Invitee endpoint probe returned an invitee id through Webex REST.
- Cleanup: direct test Webex meetings were deleted through Webex REST; delete returned 204.
- No host key, host URL, bearer token, access token, refresh token, client secret, auth code, cookie, or session token was printed or saved.

## Test Booking Result

- Full live Scheduler booking proof was not completed in this pass.
- Blocker: Railway CLI was unauthenticated (`Unauthorized. Please run railway login again.`), so the protected fake-student production route script could not run in Railway production env.
- Browser status: visible in-app browser remains on WordPress login page; Brian has not yet logged into the secure admin/session handoff screen in this session.
- No real or fake Scheduler appointment was created in this 055G pass.

## Real Webex Meeting Creation Result

- Direct broker creation: PASS.
- Scheduler-booking-triggered creation: NOT PROVEN in this pass because the authenticated Scheduler execution path was unavailable.

## Student Invitee Result

- Direct Webex invitee endpoint probe: PASS, invitee id present.
- Scheduler booking invitee payload remains covered by local test suite.
- Live Scheduler booking invitee result: NOT PROVEN in this pass.

## Student Email / Invite Result

- Local Scheduler suite continues to prove student email payload includes the Webex join URL.
- No live student email was sent.
- Live delivery remains deferred until an authenticated safe Scheduler booking can run with an approved recipient or `example.test` payload-only path.

## Student Calendar Result

- Local Scheduler suite continues to prove student calendar feed includes `meeting_url`, `join_url`, and Join Webex metadata when booking receives a Webex URL.
- Live student Scheduler/Matrix calendar event was not created in this pass because no Scheduler booking was created.

## Admin / Provider Calendar Result

- Local Scheduler suite continues to prove admin/provider calendar feed includes appointment and Webex join metadata.
- Live admin/provider calendar event was not created in this pass because no Scheduler booking was created.

## Join Webex Button Result

- Source behavior: `buildSchedulerCalendarFeedEvent()` emits `join_button.label = "Join Webex"` when `appointment.meeting_url` resolves and provider is Webex.
- Local tests pass this behavior.
- Live Join Webex button after student booking remains NOT PROVEN because no Scheduler booking was created.

## Dr. J Zoom Non-Regression Result

- Local tests passed the Dr. J / ExamPrep Zoom separation case.
- No Dr. J / ExamPrep source, metadata, or runtime behavior was changed in 055G.
- No Zoom credentials were touched.

## Access / Privacy Result

- `/api/scheduler/bootstrap` unauthenticated returns 401 JSON: PASS.
- `/schedule` unauthenticated redirects to login: PASS.
- `/hub/` loads 200: PASS.
- Broker rejects unsigned meeting creation: PASS.
- No real student records, appointments, enrollments, WooCommerce, LearnDash, STAT, Daily, Drills, VIDEO_SYSTEM, wp-config, `.env`, Cloudflare/CDN, or Railway secrets were modified.

## Secret / Deprecated Webex Scan Result

- Secret scan: only safe variable names, config references, bearer-header construction, and test fixture values appeared; no raw secret/token value was printed or committed.
- Deprecated Webex scan: no XML API, URL API, Classic Reports, Productivity Tools, Classic Event Center, ARF/WRF/WMV, My Contacts, Corporate Addresses, or site-level delegated auth usage found in the changed broker file.

## Validation Commands / Results

- `php -l wp-content/mu-plugins/mm-scheduler-webex-broker.php`: PASS
- `php -l wp-content/mu-plugins/mm-scheduler-route-proxy.php`: PASS
- `node --check missionmed-hq/server.mjs`: PASS
- `node --check missionmed-hq/lib/scheduler/*.mjs`: PASS for scoped Scheduler files
- `node --check tests/scheduler-routes.spec.mjs`: PASS
- `node --test tests/scheduler-routes.spec.mjs`: PASS, 56/56
- `git diff --check`: PASS
- Live Kinsta PHP lint after each broker deploy: PASS

## Deployment Status

- Kinsta live MU-plugin deployed, scoped to:
  - `/www/theresidencyacademy_209/public/wp-content/mu-plugins/mm-scheduler-webex-broker.php`
- Live backups created:
  - `/www/theresidencyacademy_209/private/mm-sched-webex-055g-webex-oauth-backups/20260603T162401Z-status-health`
  - `/www/theresidencyacademy_209/private/mm-sched-webex-055g-webex-oauth-backups/20260603T162624Z-oauth-base`
  - `/www/theresidencyacademy_209/private/mm-sched-webex-055g-webex-oauth-backups/20260603T162748Z-rest-base`
- No Railway deploy in 055G.
- No push.
- No cache purge.

## Cleanup Result

- Direct Webex probe meetings were deleted through Webex REST.
- Cleanup delete status: 204.
- No Scheduler appointment cleanup was needed because no Scheduler appointment was created in 055G.

## Remaining Risks

- Full business goal remains partial until one authenticated live Scheduler booking creates a Webex meeting and the resulting student/admin/provider calendar payloads are inspected.
- Current local session lacks Railway auth.
- Current browser remains on WordPress login; Brian must log in directly if browser-based proof is preferred.
- Live email delivery was not tested against a real safe inbox.

## Original Business Goal Status

- Webex OAuth / REST blocker: RESOLVED.
- Real Webex creation through live broker: PROVEN.
- Student confirms appointment in Scheduler -> Webex meeting -> persisted join URL -> student/admin/provider Join Webex button: NOT FULLY PROVEN in live runtime yet.
- Local code/test confidence remains high because the route suite covers Dr. Brian Webex, invitee, email payload, calendar metadata, Join Webex button, failure state, and Dr. J Zoom separation.

## Recommended Next Prompt Title / Objective

`MM-SCHED-WEBEX-055H — Authenticated Live Scheduler Test Booking After Webex OAuth Fix`

Objective:
- Log into WordPress admin/member session in the visible browser or re-authenticate Railway CLI.
- Create exactly one `WEBEX-TEST-DO-NOT-USE` Dr. Brian / Mission Residency Scheduler booking.
- Confirm appointment persisted `meeting_url`, Webex meeting exists, student invite/email payload includes link, student/admin/provider calendar payloads include `Join Webex`, and Dr. J Zoom remains untouched.
- Cancel the fake appointment and delete/cancel the Webex meeting if safe.

## Confidence

88% that the Webex/OAuth/broker blocker is fixed and the Scheduler code will complete the intended flow once an authenticated Scheduler booking path is available.

Reservation: the final student booking and Matrix calendar proof still needs a logged-in browser session or Railway auth to run against live Scheduler.
