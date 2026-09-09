# Live Canary QA

QA ran through `https://missionmedinstitute.com/rise/` using short-lived production WordPress sessions that were destroyed after each run. No credential or cookie is retained here.

## Admin

- WordPress to RISE SSO: PASS
- Admin role and `rise:operator`: PASS
- Live router GET/PATCH: 200 / PASS
- Admin router UI visible: PASS
- `$0.00` budget lock visible: PASS
- Live queue GET: 200 / PASS
- Queue UI showed the completed `NEEDS_REVIEW` job: PASS
- Registry: 6,139 programs

## Authorized 360 student

- WordPress to RISE SSO: PASS
- Student capabilities included private-beta entitlement: PASS
- Live Program File: PASS
- Holdout A CTA visible while enabled: PASS
- Initial request: 201, durable `QUEUED`
- Repeat request: 200, same job, `deduplicated=true`
- Worker completion: `NEEDS_REVIEW`
- My Programs read: 200, durable
- SOAP read: 200, 883 programs
- Admin router access: 403
- Out-of-allowlist Child Neurology request: 403 `RESEARCH_NOT_ELIGIBLE`
- Holdout B jobs: 0
- Browser page errors: 0

After the kill switch was restored, the same authorized student received 403 for Holdout A requests and the Program File CTA was absent. Anonymous `/rise/` returned 302 to authentication; the direct unauthenticated session API returned 401.

Matrix profile readback succeeded in one live student run and intermittently returned the existing graceful 503/unavailable response in other runs. The 5012A code did not touch Matrix, WordPress, LearnDash, HQ, or the auth seam; normal RISE browsing continued despite the optional profile read failure.
