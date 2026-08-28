# 06 — Auth and Profile Integration

## Implemented Candidate Contract

- Production refuses local-preview authentication.
- A host session must be issuer-, audience-, expiry-, revocation-, role-, and capability-bound.
- `rise:read` is required for all authenticated RISE APIs; `rise:operator` controls admin visibility/endpoints.
- Mutation APIs require the session CSRF token.
- Failed authentication returns a server-owned login URL; there is no separate RISE login.
- Browser responses expose only a bounded public session projection.

## Matrix Profile

No canonical Matrix applicant-profile read/write service contract was found. `GET /api/rise/v1/me/profile` therefore returns `409 MATRIX_PROFILE_UNAVAILABLE`. The locked Profile and Use My Profile seams show an honest unavailable state, create no alternate profile truth, and display no representative applicant.

The CV seam is similarly disabled because File Vault has no approved ordinary-student RISE selection/upload/proposal contract. No simulated extraction runs, and no LLM output can write profile facts.

## Live State

```text
AUTH_LIVE = NO
MATRIX_PROFILE_LIVE = NO
```

Activation requires a ratified HQ RISE audience/capability response plus a versioned Matrix adapter with field validation, consent, conflict, and write-through behavior.
