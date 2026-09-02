# MX-APPT-5003G candidate validation

Candidate Scheduler SHA-256: 28bce6b424e86fcda6a027931e7e3c92aa31121c19cd601a3bb19eaf79a903fd

Candidate adapter SHA-256: 2bf45c6adf8da76a4c9b34e5885cffaa92adeb2fc5b6e1a09e35b77f876a2cb7

## Automated validation

- Node candidate suite: PASS, 3 tests, 0 failures
- Static/product/production-safety checklist: 74 Scheduler assertions plus 5 explicit PHP contract assertions
- Runtime shared-state interaction contract: PASS
- Force Classic override/preserved preference interaction contract: PASS
- Standalone PHP contract harness: PASS, 10 checks covering route registration, logged-in access, authenticated student admin denial, preference persistence, admin authorization, bounded audit, override preservation, and reversibility
- PHP syntax: PASS for both shared files
- Scheduler patch audit: PASS, 12 of 12
- Adapter parity against MX-APPT-5002C: PASS
- Extracted inline JavaScript syntax: PASS
- Database migrations: 0
- Prototype harness or synthetic production data in the shipping bundle: absent

The runtime test uses a local synthetic transport fixture shaped like verified production contracts. It proves client behavior; it is not represented as an authenticated production mutation.

## Functional coverage

- StoryForge Home, time-aware Eastern greeting, discovery browse/filter/keyboard, real catalogue metadata, entitlement fail-close, shared-state prefill, Details to Time to Review, provider/open-slot selection, honest state truth, legitimate-only Join, safe reschedule, explicit cancellation, Classic, shared state, account preference, and Force Classic override: PASS.
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

Old/candidate renderer output parity remains established from the earlier candidate. The final candidate measured 0.93 to 2.46 ms through 24, 60, 108, and 200 slots. The historical unrepaired reference was approximately 1.5 to 2.1 seconds at 108 slots; MX-APPT-5002 reported approximately 6.1 ms after repair. The indexed repair survives without a cells-times-slots regression.

## Independent verification

The existing non-builder Calendar task returned PASS for exact remote commit `3a3f682567733075c97a00a07c42f55654182122`. Its read-only review independently confirmed remote custody, DR-164/DR-165 scope, parent/base diffs, syntax, 3/3 tests, 12/12 patch audit, adapter parity, sub-16-ms 200-slot benchmark, account preference and Force Classic authorization semantics, shared Scheduler state, 390px overflow and combobox behavior, immutable rollback, and publisher dry-run zero-write behavior. The verifier made no repository, provider, database, appointment, option, user-meta, lease, or deployment mutation.

That PASS certifies the candidate, not live/GA acceptance. The verifier separately left the unpublished state, designated allowlisted-student live journey, and authenticated student admin-route denial unresolved.
