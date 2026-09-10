# Live Program File QA

QA ran through https://missionmedinstitute.com/rise/ with the existing authorized 360 test student, Founder/admin control, and anonymous negative control. Temporary WordPress sessions were destroyed after use.

| Program | ACGME | Approved canonical fields | Pending claims | Six tabs | Sources and Freshness |
|---|---:|---:|---:|---|---|
| Abington Memorial Hospital IM | 1404112358 | 51 | 8 | PASS | PASS |
| Adventist Health White Memorial IM | 1400511049 | 41 | 10 | PASS | PASS |
| SUNY Upstate Neurology | 1803521083 | 51 | 0 | PASS | PASS |
| HCA Florida Kendall Anesthesiology | 0401100206 | 49 | 2 | PASS | PASS |

All six tabs rendered approved content: Overview, Fit, Residents, People, Fellowships and Outcomes, and Details. Pending values were not exposed.

Student controls: SOAP 200 (883), My Programs 200 and durable, Student Intel 200, Matrix profile 200 on the primary desktop run, operator endpoint 403. Admin router/jobs readback passed. Anonymous RISE redirected to login; catalog/operator APIs returned 401.

Mobile 390 x 844: no horizontal overflow; search, filters, results, and navigation rendered. One optional Matrix profile call returned a transient 503 in a later mobile/admin probe; RISE degraded gracefully and primary Matrix QA was 200. This shared optional-profile flake was not introduced by 5012B.
