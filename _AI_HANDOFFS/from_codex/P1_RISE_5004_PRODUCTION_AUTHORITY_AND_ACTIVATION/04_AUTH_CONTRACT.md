# Auth Contract

The 5003 candidate contains a concrete server-side HQ introspection adapter at `rise/adapters/hq-auth.mjs`. It binds the exact `/api/auth/session?audience=rise` endpoint, the named HQ session cookie, issuer, expiry, typed revocation state, CSRF token, role, and capability projection; browser bearer credentials are rejected.

Current HQ source still declares learner audiences `arena`, `stat`, `daily`, and `drills`; `rise` is absent. Anonymous live HQ session readback returns an unauthenticated, fail-closed session shape. The candidate RISE adapter additionally requires `revoked: false` and `revokedAt: null`, which the currently inspected HQ public session payload does not prove.

The preserved product branch is not a descendant of current `origin/main` (`4c86e85c186c01561ded81e1927842cd2ce0e5fc`); their merge base is `5cc9144bfc770e5eda78124cc1fa886640041767`. A shared HQ deployment from this branch would be unsafe. DR-141 prohibits rebase/history rewrite and does not supply a canonical merge transaction. Therefore no HQ auth audience was patched or deployed.

```text
AUTH_AUDIENCE_LIVE = NO
ANONYMOUS_FAIL_CLOSED = YES
AUTHENTICATED_STUDENT_PROOF = NOT RUN
ADMIN_DISTINCTION_PROOF = NOT RUN
CLIENT_SIDE_TRUST_BOUNDARY = NOT INTRODUCED
```
