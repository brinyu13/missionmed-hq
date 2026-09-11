# Live QA and Regression

| Check | Result | Evidence |
|---|---:|---|
| Production health | PASS | HTTP 200; active registry; build `rise_web_1d339438ec03` |
| Authenticated admin browser | PASS | Program File, six tabs, Sources/Freshness, router controls |
| Independent authorized 360 browser | PASS | Catalog/profile HTTP 200; 6,139 programs; shared roster 11 and schools 11; admin controls absent |
| Anonymous | PASS | `/rise/` HTTP 302 to same-host WordPress login; no data returned |
| Program File hydration | PASS | All V2 promoted facts and terminal states visible |
| Search/filter update | PASS | Stable-ID projection updates without frontend lists |
| Mobile | PASS | 390x844, no overflow/clipping; depth and beta badges wrap |
| Automated Node suite | PASS | 192/192 |
| Browser suite | PASS | 16/16 |
| Worker process | PASS | Railway SSH PID 1: `node tools/start-research-worker.mjs` |
| Fable lock | PASS | Source lock SHA-256 unchanged |

The 5010 auth chain, 5011 filter system, 5012D promoted evidence, 5012E router/quota, SOAP, My Programs, Student Intel, and 6,139-program/31-specialty registry remain intact. Direct route timing sampled at 0.223s for login redirect and 0.218s for health; no Kinsta pressure regression was observed.

The first final worker redeploy accidentally selected the parent Railpack root and started `npm run start`. Provider-native PID readback caught it immediately while research was disabled. Deployment `155578ec-8971-472a-84ad-b2390dfa9e46` is now removed. Correct Dockerfile deployment `0da35399-f4d3-424c-a4ba-46d0dbedef5a` is active and verified as the isolated worker.
