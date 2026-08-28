# Deployment Report

The isolated provider was created, but the application was not deployed.

Provider-native application readback shows no deployment and no domain. The PostgreSQL template deployment is healthy and isolated. The WordPress `/rise/` route was not installed and remains the existing 404. No shared `missionmed-hq-fix005` service or database was reused.

Deployment stopped before predeploy secret/config/domain readback because the source-rights, auth-audience, entitlement, registry, schema/RLS, and role-QA gates cannot pass.

```text
ISOLATED_RISE_PROVIDER_CREATED = YES
APP_DEPLOYMENT_ID = NONE
APP_DOMAIN = NONE
LIVE_RISE_URL = https://missionmedinstitute.com/rise/ (404; unchanged)
DEPLOYMENT_STATUS = BLOCKED
```
