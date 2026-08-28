# Live Activation Report

Result: **LIVE**

## Public route

```text
LIVE_RISE_URL = https://missionmedinstitute.com/rise/
AUTHENTICATED_ROUTE = HTTP 200 RISE application
ANONYMOUS_ROUTE = HTTP 302 WordPress login
ANONYMOUS_API = HTTP 401
PUBLIC_HEALTH = HTTP 200
```

The public health response reports:

```text
service = missionmed-rise
buildId = rise_web_08a83ea8553d
activationStatus = active
sourceRightsCurrent = true
registryReleaseId = rise_rights_safe_hrsa_20260828_716fceb7d0ac
environment = production
```

## Activation topology

```text
Browser /rise/ and /api/rise/v1/*
  -> Kinsta WordPress bounded same-origin proxy
  -> isolated missionmed-rise Railway service
  -> HQ audience=rise introspection
  -> least-privilege RISE PostgreSQL runtime
```

The HQ change is additive and audience-scoped. WordPress performs a server-side signed handoff and stores the RISE audience token in `mmhq_rise_session`; the proxy renames it to HQ's expected `mmhq_session` only on the upstream request. This prevents Matrix/HQ session collisions. No secret is exposed to JavaScript or recorded here.

## Live product state

```text
PROGRAMS_VISIBLE_COUNT = 26
PROGRAMS_WITH_DEEP_RESEARCH_COUNT = 0
SOAP_2026_LIVE = NO
GOLD_SILVER_REAL_NOT_DEMO = DEFERRED
SOURCES_FRESHNESS_LIVE = YES
MATRIX_PROFILE_READ = YES
MY_PROGRAMS_READ = YES
MY_PROGRAMS_PERSISTENCE = SERVER/DB VERIFIED; NO FOUNDER-ACCOUNT WRITE CREATED
PREMIUM_GATING = FAIL CLOSED
ADMIN_RESEARCH = FAIL CLOSED / NO PAID SUBMISSION ROUTE
```

The live release intentionally prioritizes rights safety over breadth. Missing depth is rendered as not published, not verified, pending, or unknown. No match probability or forced Gold/Silver tier is produced.

DEPLOYMENT_STATUS = LIVE
