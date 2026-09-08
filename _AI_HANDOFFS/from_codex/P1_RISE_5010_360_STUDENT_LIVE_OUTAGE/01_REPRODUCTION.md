# Production Incident Reproduction

## Controls

- Authorized 360 control: an existing test-labeled subscriber enrolled in the current production 360 course. The identity is recorded only as WordPress user ID `416` and email-identity SHA-256 `4c581afa883254da920ff7d3ad48bd4df2c89bedb1c29c90972bd77a59df53e5`; no raw login, name, email, cookie, or token is retained.
- Administrator control: a current WordPress administrator with `manage_options`.
- Negative control: anonymous requests with no cookies.

## Pre-repair reproduction

The production `/rise/` path redirected into `mmed_rise_auth_redirect`, crossed the shared HQ, and returned to the WordPress callback without the `rise_session` query parameter. The current WordPress MU-plugin explicitly sets HTTP 503 on this branch and rendered:

```text
RISE authentication session was not returned.
```

The WordPress plugin was already sending `audience=rise`; its bytes were not the cause. A fresh authenticated student could therefore authenticate to WordPress and still fail before RISE established its isolated audience session.

```text
LIVE_360_FAILURE_REPRODUCED = YES
FAILURE_CLASS = STALE_SHARED_HQ_RISE_AUDIENCE_CALLBACK_LINEAGE
EXACT_FAILURE = Missing rise_session at the WordPress RISE callback
HTTP_STATUS = 503
AFFECTED_PATH = https://missionmedinstitute.com/rise/
```

## Production-chain classification

| Seam | Pre-repair result | Diagnostic conclusion |
|---|---:|---|
| WordPress login | Pass | User authentication was not the failure. |
| LearnDash course 3893 | Pass | Student was currently entitled. |
| Matrix identity/profile | Pass | Canonical profile was available. |
| WordPress RISE SSO redirect | Pass | It emitted the expected `audience=rise` handoff. |
| HQ RISE audience callback | Fail | Stale HQ runtime did not return `rise_session`. |
| WordPress RISE callback | HTTP 503 | Correctly failed closed on the missing session. |
| RISE bootstrap/catalog | Not reached | Downstream symptoms were not patched. |

No separate entitlement, catalog, JavaScript, RLS, or Kinsta-cache failure was reproduced after the HQ seam was repaired.
