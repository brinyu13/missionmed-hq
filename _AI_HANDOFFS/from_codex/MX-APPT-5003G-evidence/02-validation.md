# MX-APPT-5003G candidate validation

Candidate Scheduler SHA-256: b3122e4ab80fd61b003f6ae8d264063dc9de04b198d10314100f82bf8787b870

Candidate adapter SHA-256: 2bf45c6adf8da76a4c9b34e5885cffaa92adeb2fc5b6e1a09e35b77f876a2cb7

## Automated validation

- Node candidate suite: PASS, 2 tests, 0 failures
- Static/product/production-safety assertions: 72
- Runtime shared-state interaction contract: PASS
- Scheduler patch audit: PASS, 12 of 12
- Adapter parity against MX-APPT-5002C: PASS
- Extracted inline JavaScript syntax: PASS
- Database migrations: 0
- Prototype harness or synthetic production data in the shipping bundle: absent

The runtime test uses a local synthetic transport fixture shaped like verified production contracts. It proves client behavior; it is not represented as an authenticated production mutation.

## Functional coverage

- StoryForge Home, time-aware Eastern greeting, discovery browse/filter/keyboard, real catalogue metadata, entitlement fail-close, shared-state prefill, Details to Time to Review, provider/open-slot selection, honest state truth, legitimate-only Join, safe reschedule, explicit cancellation, Classic, and shared state: PASS.
- Network timeout plus one safe retry for network, timeout, and 5xx only: PASS.
- POST idempotency key remains stable across a retry: PASS.
- No live appointment was booked, rescheduled, or cancelled.

## Responsive and accessibility

| Width | StoryForge | Classic | Horizontal overflow | Clipped controls | Small practical targets |
| --- | --- | --- | --- | --- | --- |
| 390 | PASS | PASS | 0 | 0 | 0 |
| 768 | PASS | PASS | 0 | 0 | 0 |
| 1024 | PASS | PASS | 0 | 0 | 0 |
| 1440 | PASS | PASS | 0 | 0 | 0 |

Combobox End, Escape, refocus/click reopening, listbox semantics, visible focus, dialog focus, mobile navigation, and reduced motion were exercised locally. Final diagnostics: 0 runtime exceptions, 0 console errors, 0 warning/error console messages, 0 network failures.

## Performance

Old/candidate renderer output parity passed at 24, 54, and 108 slots. Steady candidate measurements were 0.95 to 2.85 ms. One first-process cold sample was 23.9 ms at 24 rows; immediate reruns returned to the steady range. The historical unrepaired reference was approximately 1.5 to 2.1 seconds at 108 slots; MX-APPT-5002 reported approximately 6.1 ms after repair. The indexed repair survives without a cells-times-slots regression.
