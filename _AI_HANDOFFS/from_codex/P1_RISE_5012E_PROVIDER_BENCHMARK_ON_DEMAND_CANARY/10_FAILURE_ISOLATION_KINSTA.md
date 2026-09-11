# Failure Isolation, Kinsta, and Regression QA

The research worker is a dedicated Railway service with one replica and no public domain. Provider calls, leases, normalization, review, promotion, and spend reconciliation occur outside WordPress/Kinsta request execution. The final worker log shows one isolated worker with replay, Terra, and Sol adapters loaded; final router state prevents new work.

During QA, the optional Matrix profile dependency intermittently returned its existing bounded HTTP 503 after approximately 7.5 seconds. RISE degraded safely: registry, filters, Program Files, SOAP, My Programs, Student Intel, research controls, and mobile continued to load. Direct follow-up profile requests returned HTTP 200. This is the known external optional-profile condition from prior RISE baselines, not an attributable 5012E regression.

Final controls and smoke results:

| Surface | Result |
|---|---|
| RISE direct health | HTTP 200 |
| Anonymous public RISE | HTTP 302 to WordPress login |
| Direct unauthenticated session/catalog | HTTP 401 |
| Authenticated 360 RISE | PASS |
| Admin Research Router | PASS; revision 15 |
| Normal-student operator API | HTTP 403 |
| MissionMed home / WordPress login | HTTP 200 / 200 |
| StoryForge / Arena / RankListIQ | HTTP 200 / 200 / final HTTP 200 |
| HQ API / LOR health | HTTP 200 / HTTP 200 ready |
| WooCommerce IV Prep product 5504 | HTTP 200 |
| SOAP / My Programs / Student Intel | PASS / PASS / PASS |
| Mobile 390 x 844 | 0 px overflow; search/results visible |

No WordPress, LearnDash, Matrix, HQ, WooCommerce, or unrelated Railway mutation was made. The Fable-derived shell and asset manifest remain unchanged (`rise_web_79b4dd0f59a8`, manifest SHA-256 `cf47f950b025f4ca264b6572bdddd9bc6e62754bda23d515ece5122284a8ee70`). Full tests: 187 passed, 0 failed.
