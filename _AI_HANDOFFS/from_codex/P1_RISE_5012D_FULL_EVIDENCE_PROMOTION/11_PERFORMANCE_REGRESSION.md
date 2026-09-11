# Performance and Regression

## Measured production behavior

- Health: HTTP 200, approximately 0.20–0.23 s.
- Filter intelligence: approximately 1.28–1.61 s live; provider query plan 969.863 ms.
- Catalog bootstrap: approximately 0.91 s first request; following pages approximately 29–109 ms.
- Program File: approximately 406–419 ms.
- Session/status: approximately 20–100 ms.
- Student Intel: approximately 24–125 ms.
- Admin review: approximately 222 ms.

The final filter query materializes the current-review CTE once and uses indexed lateral reads. It eliminated the earlier statement timeout while preserving forced RLS. RISE remains one isolated Railway replica with no new WordPress-side database work; Kinsta performs the existing proxy/auth handoff only. No new PHP pressure was attributable to 5012D.

Regression checks passed: 174/174 tests, 6,139 programs, 31 specialty tabs, SOAP 883, My Programs persistence, Student Intel safe state, 5010 authentication contract unchanged, 5011 filters live, anonymous fail-closed, Fable 5002 landmarks preserved, and no new paid-provider execution.

The authenticated student view was also exercised under a temporary 390×844 viewport override and returned to the default viewport afterward. Content remained operable and readable; the ticket did not change CSS or the Fable layout contract.
