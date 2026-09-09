# Performance and Regression

## Performance

The pre-repair app had no filter-intelligence endpoint and returned zero for the disconnected Visa/IMG predicates. The repaired app loads seven bounded catalog pages and the compact filter projection concurrently after session/status establishment.

Production Railway HTTP readback showed catalog page responses between 52 ms and 778 ms at the service, filter-intelligence HTTP 200 in 177 ms, and 647,592 response bytes before edge compression. The complete successful fresh 360 SSO plus application hydration took 14.066 seconds. Individual live filter applications ranged from 49 ms to 1.279 seconds, including rerendering. No material filter-performance regression was found.

## Tests

- focused filter unit/projection suite: 5 of 5 passed;
- focused API/server suite: 32 of 33 passed; the sole failure is the pre-existing source-rights revocation assertion conflicting with the previously deployed file-level fallback and is unrelated to 5011;
- focused filter/mobile/accessibility browser checks: filter and accessibility tests passed; one repeated SOAP run was intercepted by the pre-existing beta modal timing race;
- broad source suite: 142 of 145 passed; the three known pre-existing drifts concern Fable mechanical derivation, an unrelated unapproved backfill artifact, and the source-rights fallback;
- broad browser suite: 15 of 16 passed; the only failure is a pre-existing stale RankList IQ placeholder assertion;
- build: passed; `rise_web_6f6223500194`.

## Regression and zero blast radius

- registry: 6,139; specialties: 31; SOAP: 883;
- research runs: 271 Parallel and 270 Claude/Opus completed-research sources used provider-neutrally;
- new research spend: `$0.00`;
- RISE HTTP 5xx after cutover: zero;
- one RISE error-level log is the pre-existing file-level source-rights fallback notice; health reports source rights current;
- homepage HTTP 200; WordPress login HTTP 200 before the later shared-pool saturation window;
- StoryForge HTTP 200; Arena HTTP 200; RankListIQ 301 to Rank List Engine then HTTP 200; WooCommerce product 5504 HTTP 200;
- shared HQ `/api/health` HTTP 200 and `/health/lor-studio` HTTP 200 ready;
- My Programs, Program File, Student Intel, SOAP, admin controls, and unauthorized denial passed;
- no shared HQ, WordPress, Matrix, LearnDash, WooCommerce, or unrelated Railway mutation occurred.

At 00:29 UTC, after successful acceptance, Kinsta logged a site-wide PHP-FPM saturation event. The RISE SSO action returned client-closed HTTP 499 after 180 seconds while unrelated WordPress REST, Matrix/Scheduler, MissionAccounts, and cron requests simultaneously timed out. MyKinsta reported the four-thread PHP limit reached 104 times. A final 20-second replay still timed out without response bytes from WordPress login and the public `/rise/` proxy. In the same window, the direct isolated RISE health endpoint returned HTTP 200 in 0.415 seconds with the expected production build, registry, activation, and source-rights state. This is external post-acceptance operational evidence, not an attributable 5011 regression; remediation would require separately authorized shared WordPress/Kinsta action.
