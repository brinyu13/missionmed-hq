# 3528C Security Acceptance

## Passed controls

- Canonical HQ cookie session only; bearer `Authorization` requests are rejected.
- Matrix entitlement admission is checked before static UI, analytics assets, or API access.
- State-changing requests require the canonical CSRF/origin mutation contract.
- Anonymous production request returns `401 {"error":"ivprep_authentication_required"}`.
- Automated routes prove student owner access, cross-student denial, unassigned mentor denial, assigned mentor access, and Admin/founder global access.
- Browser-facing responses omit `storage_object_key`, R2 credentials, endpoint, multipart upload id, and signing material.
- Upload tokens are opaque, HMAC-scoped, and expiring.
- Playback/download is an authenticated same-origin token-scoped proxy; the private bucket is never made public.
- RLS is enabled on all six IVOC tables. Grants to `public`, `anon`, and `authenticated` are revoked; only the server service role receives table access.
- CSP, camera/microphone permission policy, no-store, frame denial, no-referrer, no-sniff, and noindex headers are active.
- Access decisions are recorded in `ivoc_access_log`.

## Live identity evidence

- Authenticated Matrix handoff: PASS as `brinyu`, Admin, `ENTITLED · IV PREP 360`.
- Anonymous denial: PASS in production.
- Separate non-Admin entitled 360 persona: PENDING despite passing server tests.
- Separate non-entitled persona: PENDING despite passing admission tests.

## Secret handling

Existing R2 settings were transferred to Railway through stdin-only tooling. No credential or environment value was printed, written to source, committed, or placed in the handoff. No Supabase schema exposure was changed.
