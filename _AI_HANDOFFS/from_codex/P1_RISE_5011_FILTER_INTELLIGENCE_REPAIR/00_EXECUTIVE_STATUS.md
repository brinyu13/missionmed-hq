# P1-RISE-5011 Executive Status

The filter-intelligence repair is deployed and active in the isolated production RISE service. Production readback identifies deployment `69049d35-9af9-451d-ada2-e9f864b8051f`, image `sha256:fe69faf3e53bfb94a63400088ac41210c85b8d504bf8dbddb9bac166a5d60cf4`, build `rise_web_6f6223500194`, registry `rise_registry_2026-07-09_8fdb5afb84f6`, and activation `active`.

A real test-labeled, currently authorized 360 identity completed a production browser canary after cutover. All required filter combinations, Program File, Student Intel, SOAP, My Programs, session claims, student/admin separation, and anonymous denial passed. A separate 390 by 844 live run proved the settled filter drawer ends exactly at the viewport edge with no document overflow. Temporary WordPress sessions were destroyed after each run.

After these successful canaries, the shared Kinsta WordPress PHP-FPM pool entered a site-wide saturation window. Kinsta reported its four-thread limit reached and Nginx recorded simultaneous 180-second upstream timeouts across RISE SSO, Matrix, Scheduler, MissionAccounts, WordPress REST, and cron. A final replay on September 8 still received no bytes from WordPress login or the public `/rise/` proxy before a 20-second client timeout; the isolated Railway RISE health endpoint remained HTTP 200 in 0.415 seconds. This was not caused by 5011 and no WordPress or shared-auth mutation was made. A fresh current-instant 360 SSO replay therefore remains blocked on separately authorized Kinsta/PHP-pool recovery even though the deployed filter build and the completed post-cutover 360 canaries passed.

```text
TICKET = P1-RISE-5011
FILTER_AUDIT_COMPLETE = YES
FILTER_REPAIR_DEPLOYED = YES

VISA_DATA_PROGRAM_COUNT = 4472
J1_PUBLISHED_PROGRAM_COUNT = 4411
H1B_PUBLISHED_PROGRAM_COUNT = 1294
ANY_VISA_EVIDENCE_PROGRAM_COUNT = 4461

IMG_ROSTER_EVIDENCE_PROGRAM_COUNT = 3498
CARIBBEAN_ROSTER_EVIDENCE_PROGRAM_COUNT = 0
DO_ROSTER_EVIDENCE_PROGRAM_COUNT = 3654
USMD_ROSTER_EVIDENCE_PROGRAM_COUNT = 4988

DEEP_RESEARCH_PROGRAM_COUNT = 285
ENRICHED_RESEARCH_PROGRAM_COUNT = 256
BASIC_PROFILE_PROGRAM_COUNT = 5145
RESEARCH_PENDING_PROGRAM_COUNT = 453

SOAP_2026_PROGRAM_COUNT = 883
MISSIONMED_ALUMNI_FILTER_COUNT = 0

VISA_FILTER_PASS = YES
IMG_FILTER_PASS = YES
DO_FILTER_PASS = YES
CARIBBEAN_FILTER_PASS = YES
RESEARCH_DEPTH_FILTER_PASS = YES
SOAP_FILTER_PASS = YES
ALUMNI_FILTER_PASS = NOT_AVAILABLE

FILTER_COUNTS_VISIBLE = YES
FILTER_COMBINATION_TEST_PASS = YES
CLEAR_FILTERS_PASS = YES
MOBILE_FILTER_UI_PASS = YES
FILTER_PERFORMANCE_REGRESSION = NO
NEW_RESEARCH_AUTO_FILTERABLE = YES

P1_RISE_5010_AUTH_BASELINE_PRESERVED = YES
360_ACCESS_PASS = YES
ADMIN_ACCESS_PASS = YES
UNAUTHORIZED_FAIL_CLOSED = YES

CANONICAL_PROGRAM_COUNT = 6139
CANONICAL_SPECIALTY_COUNT = 31
CANONICAL_REGISTRY_REGRESSION = NO
RESEARCH_HYDRATION_REGRESSION = NO
SOAP_REGRESSION = NO
MY_PROGRAMS_REGRESSION = NO
STUDENT_INTEL_REGRESSION = NO
FABLE_UI_PRESERVED = YES
ZERO_BLAST_RADIUS_PASS = YES
LIVE_BROWSER_QA_PASS = YES
CURRENT_FRESH_360_SSO_REPLAY = BLOCKED_BY_SHARED_KINSTA_PHP_POOL

NEW_PARALLEL_SPEND = $0.00
DEPLOYMENT_STATUS = LIVE
```

`CARIBBEAN_FILTER_PASS = YES` means the concept is independent from DO and truthfully disabled at count zero; it does not claim evidence that is not approved. `ALUMNI_FILTER_PASS = NOT_AVAILABLE` means no verified canonical ACTN/alumni joins exist in the live serving contract. `DEPLOYMENT_STATUS = LIVE` describes the isolated RISE deployment; it does not override the separately recorded current shared-Kinsta entry-path outage.
