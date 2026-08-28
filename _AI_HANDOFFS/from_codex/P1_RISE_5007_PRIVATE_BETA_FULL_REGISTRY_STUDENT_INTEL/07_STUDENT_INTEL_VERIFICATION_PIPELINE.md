# Student Intel Verification Pipeline

The staged policy is `rise/config/student-intel-verification.v1.json`.

```text
task class = RISE_STUDENT_INTEL_CLAIM_VERIFICATION
ordinary queue = TWICE_MONTHLY
cadence = 1st and 15th, America/New_York
priority queue = HIGH_PRIORITY
student URL first = true
preview before spend = true
separate Student Intel budget = required
paid submission authorized = false
```

High-impact visa, leadership, closure/accreditation, deadline, score, COMLEX, YOG, USCE, and attempt-policy claims are deterministically flagged. The preview sorts high priority first and displays the precise waiting state when no research budget is available.

The database persists attempt number, last attempt, next eligible date, task/queue class, router selection fields, estimate/actual cost, factory identifiers, result summary, and lifecycle state. Duplicate attempts are bounded by dedupe key and attempt number.

No scheduler or paid runner is active. The UI explicitly says cost/product/processor are unavailable, disables Run, and the server returns HTTP 409 for paid submission.

