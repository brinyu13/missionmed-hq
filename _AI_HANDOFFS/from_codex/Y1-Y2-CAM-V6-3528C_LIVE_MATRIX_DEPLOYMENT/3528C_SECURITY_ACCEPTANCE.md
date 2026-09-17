# 3528C Security Acceptance

## Passed controls

- Canonical HQ cookie session only; bearer `Authorization` requests are rejected.
- Matrix entitlement admission is checked before static UI, analytics assets, or API access.
- State-changing requests require the canonical CSRF/origin mutation contract.
- Anonymous production request returns `401 {"error":"ivprep_authentication_required"}`.
- Automated routes prove: student owner access, cross-student denial, unassigned mentor denial, assigned mentor access, and Admin/founder global access.
- Browser-facing responses omit `storage_object_key`; playback/download are signed server-side.
- RLS is enabled on all six IVOC tables. Grants to `public`, `anon`, and `authenticated` are revoked; only the server service role receives table access.
- CSP, camera/microphone permission policy, no-store, frame denial, no-referrer, no-sniff, and noindex headers are active on the production route.
- Access decisions are recorded in `ivoc_access_log`.

## Live identity evidence

- Authenticated Matrix handoff: PASS as `brinyu`, Admin, `ENTITLED · IV PREP 360`.
- Anonymous denial: PASS in production.
- Separate non-Admin entitled 360 persona: not available in the browser session, so live persona proof is pending despite passing server tests.
- Separate non-entitled persona: not available in the browser session, so live persona proof is pending despite passing admission tests.

## Secret handling

No credential or environment value was written to source, logs, or handoffs. The external CDN mismatch is described only by configuration names and sanitized HTTP status.
