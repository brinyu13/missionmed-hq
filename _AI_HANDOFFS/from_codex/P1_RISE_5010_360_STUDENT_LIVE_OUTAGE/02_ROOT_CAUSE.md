# Root Cause

## First divergent seam

The first failing seam was the shared-HQ RISE audience handoff, not LearnDash and not the RISE service.

The active HQ deployment was:

- deployment `c12ee3b3-3524-40f6-8236-d4811b1e5bc0`
- source branch `codex/usce-public-intake-main-hotfix`
- source commit `420c36693d426b1d24d4001e710304451886451c`
- image `sha256:0a2ff252258ef96d110a30e3a8cfd89a69b8f95ffdd275ef1889bc8f74e315d7`

That June lineage predates the current RISE callback contract. It also returned 404 from `/health/lor-studio`, independently confirming that the live shared runtime had regressed behind the accepted cross-product lineage.

The production WordPress SSO plugin was current and correct:

- `/www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-rise-sso.php`
- SHA-256 `3e9e3eedc7b703d63f814544b48ec2c0d0eefa589b28e0cf72d1af6a33c88ab9`
- sends `audience=rise`
- requires `rise_session`
- fails closed with HTTP 503 if it is absent

The stale HQ runtime returned the generic/older callback shape instead of the RISE-isolated session parameter. Existing administrator browser state could mask the outage because an already-established RISE session continued to work; fresh 360 sessions consistently crossed the broken seam.

## Regression correlation

The failure correlates with the active HQ deployment/source lineage, not with the current RISE service deployment or the 6,139-program registry. The smallest safe fix was therefore to restore the accepted shared-HQ runtime exactly and leave WordPress, RISE, Matrix, LearnDash, data, and UI untouched.
