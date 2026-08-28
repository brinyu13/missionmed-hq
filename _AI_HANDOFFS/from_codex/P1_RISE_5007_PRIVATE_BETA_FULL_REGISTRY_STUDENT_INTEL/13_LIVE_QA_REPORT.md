# Live QA Report

5007 live QA: **NOT RUN — BUILD NOT DEPLOYED**

Read-only current-production verification on 2026-08-28:

```text
anonymous /rise/ = HTTP 302 to WordPress login
/api/rise/v1/health = HTTP 200
service = missionmed-rise
buildId = rise_web_08a83ea8553d
activationStatus = active
sourceRightsCurrent = true
registryReleaseId = rise_rights_safe_hrsa_20260828_716fceb7d0ac
environment = production
```

This proves the existing 5006 release remains reachable; it does not prove 5007 beta access, Student Intel, the 006 schema, scheduled verification, canonical promotion, or role-complete 5007 acceptance.

Because 5007 was not deployed, required live tests for a 360 learner, IV Prep Complete learner, admin, and ineligible learner remain pending. `LIVE_QA_PASS` for 5007 is therefore `NO`.

