# B1-511 Security and Role Boundaries

## Unchanged trust chain

WordPress owns the authenticated session and LearnDash entitlement decision.
The product-owned gateway issues a short-lived signed StoryForge identity. The
Railway API verifies issuer, audience, expiry, JTI, WordPress user ID,
eligibility, and allowlisted application role. PostgreSQL then sets the signed
actor into a transaction, assumes only the least-privilege `authenticated`
role, and enforces ownership/RLS.

## B1-511 controls

- New features default `off` and use separate flags.
- Mentor notes also have a runtime force-off switch.
- Private stories are absent from reviewer list and direct-ID access.
- Students cannot author mentor notes, edit mentor score, read internal notes,
  or access another student's data.
- Reviewers cannot enumerate private stories.
- Mentor media keys are author/student/story/note bound and independent of
  student audio keys.
- Note and media tables have RLS and FORCE RLS enabled.
- Browser bundles contain no privileged secrets.

Verification: PostgreSQL 17/17, acceptance 130/130, unit 270/270, E2E 66/66,
conformance/accessibility 72/72, secret scan PASS, npm audit 0. Production
anonymous session returned HTTP 401; Founder admin returned HTTP 200 only with
a valid short-lived signed identity. No token or secret was logged in evidence.
