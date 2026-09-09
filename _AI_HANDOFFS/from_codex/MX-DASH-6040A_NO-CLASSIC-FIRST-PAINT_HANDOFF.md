# MX-DASH-6040A no-Classic first-paint handoff

Date: 2026-09-09
Verdict: **COMPLETE — LIVE**

## Authority and isolation

- Mission: `MX-DASH-6040A`
- Decision records: `DR-212`, `DR-213`
- MissionMed OS registration commit: `0a71311`
- Founder runtime approval: exact MX-DASH-6040A override for `student_os_js`, `student_os_css`, `class_mmed_student_os_php`, `calendar_v4_js`, `calendar_v4_css`, and `storyforge_js`.
- Product lease: `SHARED:MATRIX-SHELL`, lease `057e77f7-defd-4e6d-b4e6-d36dd38e5e6b`; deployment epoch `1653`; finalization epoch `1664`.
- Dedicated worktree: `/Users/brianb/MissionMed_worktrees/MX-DASH-6040A-no-classic-flash`
- Branch: `codex/mx-dash-6040a-no-classic-flash`
- Implementation commit: `506d74c7d1a0b11aaa07578fb075fd7a5f80312c`
- `/Users/brianb/MissionMed_worktrees/mx-cal-4200c-implementation` was not edited.

## Root cause and fix

The server emitted an empty Matrix shell and the base Student OS bundle owned `app.render.dashboard` first. That base renderer contains Classic (`CURRENT MATCH SEASON PRIORITY` and the old Arena/dashboard composition). The later Dashboard V2 bundle replaced the renderer, so slower or deferred execution could visibly paint Classic before V2.

One production source file now uses the already-resolved Dashboard experience on the server. Matrix2 dashboard entry receives an inline critical guard and a Matrix2-branded first-paint shell before any renderer can paint. The guard is removed when V2 marks the root `mmdv2-active`; an eight-second initialization-failure fallback reveals Classic rather than stranding a user. Non-dashboard hashes remove the guard synchronously. Canonical Classic output receives no guard and paints immediately.

No external calls, Supabase calls, new network dependencies, expensive queries, entitlement changes, art changes, or Calendar runtime changes were added. The resolver values were already loaded during asset enqueue and are served from the WordPress request cache.

## Files

Changed and committed:

- `wp-content/plugins/missionmed-hub/templates/student-os-shell.php`
- `wp-content/plugins/missionmed-hub/tests/mx-dash-6040a/template-first-paint.test.php`
- `wp-content/plugins/missionmed-hub/tests/mx-dash-6040a/filmstrip-qa.cjs`

Deployed to production (only):

| File | Before SHA-256 | After/live SHA-256 |
| --- | --- | --- |
| `wp-content/plugins/missionmed-hub/templates/student-os-shell.php` | `efef5d88413924c981e475a678edae083de10cd9d664ab4f057ed9bcc398aea3` | `2e2363facdd9243eb9e7e3d811d68a6e9d7ee42bd3d06c6e4e0d05f3cfbc4b49` |

## QA and timing

- Local controlled delayed-render filmstrips: Chromium and WebKit at first frame, 100 ms, 250 ms, 500 ms, 1 s, 2 s, 3 s, and V2 ready; zero Classic frames. Explicit Classic painted immediately. Direct Calendar entry bypassed the dashboard guard. Exact 390x844 first paint passed.
- Authenticated production Chromium hard and warm reloads: zero Classic frames at all required timestamps; V2 ready between 500 ms and 1 s after the reload command. Hard navigation was TTFB 1669 ms / DOMContentLoaded 2061 ms / load 3739 ms; warm was 1580 / 1937 / 2464 ms.
- Authenticated production Chromium cold/slower pass (100 ms latency, 200 KiB/s, cache disabled): the Matrix2-branded shell owned 100 ms through 3 s; no Classic frame; final V2 ready with no failure marker. DOMContentLoaded was 10785 ms and load 12897 ms under the deliberate throttle.
- Authenticated production Safari/WebKit student reload: zero Classic dashboard frames. Safari retained the previous Matrix2 frame while replacing the document and then showed a pre-existing site promo overlay; neither surface was Classic. Final authenticated Safari view was Matrix2.
- Exact production 390x844: zero Classic frames and no ready-state horizontal overflow.
- Production baseline did not reproduce the intermittent Founder-observed flash on this network, but source ordering proved the race; the controlled delayed-render test reproduced the vulnerable sequence and proved the guard.
- No material product performance regression: no new request or dependency; normal V2 ready remained sub-second after the document command. The only work is cached server resolution plus a tiny inline style/observer.

## Personas and regressions

- Matrix2 student: PASS — authenticated Safari student.
- Registered non-enrolled Matrix2: PASS — server-render fixture combined with the existing registered baseline entitlement persona.
- Matrix2 admin: PASS — authenticated Chromium admin.
- Explicit Classic: PASS — authenticated production switch painted Classic immediately with no pending marker; the account was restored to Matrix2.
- 6010B morph: PASS — live HomeBase transitioned from approved pencil art to approved cinematic art via the preserved CSS fallback path.
- 6020A entitlement/security: PASS — 51 server assertions and 15 client-policy assertions; all relevant runtime bytes were unchanged. The previous live direct-route denial proof remains valid because no gate or route file changed.
- 6021 aspect ratio: PASS — two static tests and live `object-fit: cover`.
- 6030B Option C: PASS — authenticated HomeBase showed approved cinematic art, large title/promise, three chips, payoff/CTA, closed progressive drawer, quiet admin edit, and no old enterprise labels.
- Admin editor: PASS — opened and closed without saving.
- Reduced motion: PASS — target state applied with no running animation or canvas.
- Calendar return: PASS — returned directly to Matrix2; no stale first-paint marker.

## Deployment, rollback, runtime lock, and closeout

- Rollback: `/www/theresidencyacademy_209/private/mx-dash-6040a-rollback-20260909T141045Z/preimage-student-os-shell.php`, mode `0600`, SHA-256 `efef5d88413924c981e475a678edae083de10cd9d664ab4f057ed9bcc398aea3`.
- Cache: Kinsta site cache purge succeeded. No CDN asset purge was required because the only deployed file is a PHP template.
- Runtime lock: **UNCHANGED**. The deployed template is not a runtime-lock key. The six approved drift assets remained byte-for-byte unchanged after deployment.
- Provider closeout: pre-finalization native readback was `0` active task leases / `0` active waiters. The finalization lease is explicitly released after this handoff commit, followed by a final `0 / 0` native readback.
- Temporary production upload file was atomically promoted; no temporary remote upload remains.

Evidence is under `_AI_HANDOFFS/from_codex/MX-DASH-6040A_EVIDENCE/`, including local Chromium/WebKit filmstrips, production Chromium hard/warm/slow/mobile results, authenticated Safari frames, Option C/admin screenshots, and `production-verification.json`.

**MATRIX 2.0 NOW OWNS FIRST PAINT — CLASSIC NO LONGER FLASHES FOR MATRIX2 USERS.**
