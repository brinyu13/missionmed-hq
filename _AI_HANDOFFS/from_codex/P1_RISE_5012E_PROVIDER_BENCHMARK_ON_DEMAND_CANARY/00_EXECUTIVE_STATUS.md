# P1-RISE-5012E Executive Status

Status: **LIVE — accepted, fail-safe paused after canary**

P1-RISE-5012E deployed the provider benchmark and real On-Demand Research path into the existing RISE production stack. The frozen eight-program Parallel corpus was benchmarked with both authorized OpenAI models. The corrected paired batch completed 16 of 16 jobs with 104 of 104 source-backed findings per provider. Terra and Sol each resolved 81 fields and surfaced two conflicts; Terra averaged 39.097 seconds and $1.0251 for eight jobs versus Sol at 67.972 seconds and $1.7643. Terra was therefore approved for the production research task class; Sol was returned to PAUSED.

Holdout A (`1854831078`) was requested once through the live product, completed asynchronously on Terra, produced 13 claims, received 13 final reviews, and promoted 12 current facts. Its live Program File moved from Basic Profile to Enriched Research with ten approved domains, J-1 evidence, 17 unique source links, and searchable newly approved curriculum content. A second authenticated 360 user saw the shared improvement without a request charge. Holdout B (`1851113100`) has zero On-Demand jobs and zero provider claims and remains preserved.

Production was sealed with global research disabled, student research disabled, the emergency kill switch active, one worker replica, zero active jobs, and no reserved spend. Ordinary RISE browsing remains live for 6,139 programs and 31 specialty tabs.

## Required status

```text
TICKET = P1-RISE-5012E
ON_DEMAND_INFRASTRUCTURE_LIVE = YES
ON_DEMAND_STUDENT_UX_LIVE = YES (deployed behind server-side flags; currently paused)

DEFAULT_STUDENT_REQUEST_QUOTA = 30
QUOTA_DURABLE = YES
DOUBLE_CHARGE_PROTECTION = YES
DUPLICATE_ACTIVE_JOB_PROTECTION = YES
FAILED_NO_WORK_REFUND_PASS = YES

PROVIDER_NEUTRAL_ROUTER_LIVE = YES
ADMIN_PROVIDER_CONTROL_CENTER_LIVE = YES
ADMIN_CAN_CHANGE_PROVIDER_WITHOUT_FRONTEND_DEPLOY = YES
PROVIDER_LIFECYCLE_GATE_PASS = YES
BUDGET_CAP_PASS = YES
CONCURRENCY_CAP_PASS = YES
KILL_SWITCH_PASS = YES

BENCHMARK_LAB_LIVE = YES
PARALLEL_FROZEN_BASELINE_USED = YES
TERRA_BENCHMARK_RUN = YES
SOL_BENCHMARK_RUN = YES
BENCHMARK_WINNER_BY_TASK_CLASS = OPENAI_TERRA for PROGRAM_DEEP_RESEARCH
PRODUCTION_APPROVED_ROUTE = OPENAI_TERRA / gpt-5.6-terra

PAID_BENCHMARK_SPEND = $7.5144
NEW_PARALLEL_SPEND = $0.00
UNAPPROVED_PROVIDER_SPEND = $0.00

HOLDOUT_A_PROGRAM_ID = 1854831078
HOLDOUT_B_PROGRAM_ID = 1851113100
HOLDOUT_B_PRESERVED = YES

REAL_PROVIDER_CANARY_PASS = YES
CANARY_REQUEST_CLASS = FULL
CANARY_PROVIDER = OPENAI_TERRA
CANARY_MODEL = gpt-5.6-terra
CANARY_REQUEST_BALANCE_BEFORE = 30
CANARY_REQUEST_BALANCE_AFTER = 29
CANARY_END_TO_END_DURATION = 47 seconds
CANARY_ACTUAL_COST = $0.1449

CANARY_CANONICAL_PROMOTION_PASS = YES
CANARY_PROGRAM_FILE_HYDRATION_PASS = YES
CANARY_RESEARCH_DEPTH_AUTO_UPDATE_PASS = YES
CANARY_FILTER_AUTO_UPDATE_PASS = YES
CANARY_SEARCH_AUTO_UPDATE_PASS = YES

SECOND_USER_SHARED_BENEFIT_PASS = YES
SECOND_USER_REQUEST_CHARGED = NO

ASYNC_WORKER_ISOLATED_FROM_KINSTA = YES
KINSTA_PERFORMANCE_REGRESSION = NO

CANONICAL_PROGRAM_COUNT = 6139
CANONICAL_SPECIALTY_COUNT = 31

360_AUTH_REGRESSION = NO
FILTER_REGRESSION = NO
PROGRAM_FILE_REGRESSION = NO
SOAP_REGRESSION = NO
MY_PROGRAMS_REGRESSION = NO
STUDENT_INTEL_REGRESSION = NO
FABLE_UI_PRESERVED = YES

READY_FOR_MAJOR_SPECIALTY_BETA = YES
MAJOR_SPECIALTY_BETA_AUTOMATICALLY_ENABLED = NO

FINAL_CODE_COMMIT = adf9f87df3ff47727e67a2eb86cca5349aed0545
FINAL_EVIDENCE_COMMIT = recorded by the containing Git commit
REMOTE_AHEAD = 0
REMOTE_BEHIND = 0
DEPLOYMENT_ID = app 507178ef-7f15-4d01-901b-e7d1b76167ec; worker 17af3214-8f51-483e-a82b-25a1efe330f1
ROLLBACK_TARGET = app b9955188-a221-4ea0-b785-6bc560b29a15; worker da51d547-fb40-4e69-b19d-6d0c8d82dede
EVIDENCE_CHECKSUM_PASS = YES

FOUNDER_ACTION_REQUIRED = Approve/activate the six-specialty beta in the live Admin Research Router when desired; no code deployment is required.
```

## Canary-scope correction

```text
PLAIN_NEUROLOGY_TX_FL_CANONICAL_COUNT = 0
TX_FL_CHILD_NEUROLOGY_HOLDOUT_COUNT = 2
CANARY_PROGRAM_ID_ALLOWLIST_USED = YES
CHILD_NEUROLOGY_CANARY_ONLY_EXCEPTION = YES
INITIAL_SIX_SPECIALTY_ROLLOUT_POLICY_UNCHANGED = YES
NEUROLOGY_TAXONOMY_DATA_INTEGRITY_FOLLOWUP_REQUIRED = YES
```

## Provenance and maximum-data steer

```text
PROVENANCE_REVIEW_TREATED_AS_SEPARATE_FROM_HYDRATION = YES
PROVENANCE_METADATA_PRESERVED = YES
PROVENANCE_METADATA_FALSIFIED_OR_DELETED = NO
LEGACY_PROVENANCE_GATES_BLOCKING_USABLE_DATA = 0
LEGACY_PROVENANCE_GATES_REFACTORED = 0
AVAILABLE_UPSTREAM_NOT_LIVE_BEFORE = 0 approved-current claims
AVAILABLE_UPSTREAM_NOT_LIVE_AFTER = 0 approved-current claims
HIGH_VALUE_FIELDS_AVAILABLE_LIVE = 2605 current promoted facts
HIGH_VALUE_FIELDS_RESEARCHED_NOT_FOUND = 597 reviewed claims
HIGH_VALUE_FIELDS_REVIEW_PENDING = 0 claims without final disposition
HIGH_VALUE_FIELDS_NOT_RESEARCHED = retained in the P1-RISE-5012B domain-level missing-data map
HIGH_VALUE_FIELDS_STALE = 0 reviewed claims
HIGH_VALUE_FIELDS_CONFLICTED = 181 reviewed claims
APPROVED_USABLE_DATA_HYDRATED_TO_LIVE = YES
REAL_MISSING_DATA_MAP_COMPLETE = YES
ON_DEMAND_RESEARCH_RESERVED_FOR_TRUE_GAPS = YES
```
