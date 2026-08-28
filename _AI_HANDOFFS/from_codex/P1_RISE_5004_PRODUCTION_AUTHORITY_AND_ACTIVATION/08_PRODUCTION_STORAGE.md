# Production Storage

Provider-native pins:

```text
WORKSPACE_ID = b6ab449c-1c87-46e0-95f8-3394c3ca7b14
PROJECT_ID = c0113625-951e-46ab-939b-dd57acc0e87c
PROJECT_NAME = missionmed-rise-production
ENVIRONMENT_ID = 549d6597-1962-44cb-b0f5-7d88bd025e31
ENVIRONMENT_NAME = production
APP_SERVICE_ID = 9bce2090-ce45-4572-8291-e8da5d42acb6
APP_SERVICE_INSTANCE_ID = 13c99564-5948-459c-9f74-8368b8db6ac3
POSTGRES_SERVICE_ID = 58236876-7616-4a6b-9792-bfdb114b51d8
POSTGRES_SERVICE_INSTANCE_ID = 98f6c513-ee9e-45cd-9e75-0c86f700998d
POSTGRES_DEPLOYMENT_ID = b55827d6-9df2-4ec5-a955-96362ca444d0
POSTGRES_DEPLOYMENT_INSTANCE_ID = a385efd6-94d0-4876-806b-d0363ae3c56d
POSTGRES_VOLUME_ID = 38745ae2-1b6d-4174-9515-af9a5661ddf5
POSTGRES_VOLUME_NAME = postgres-volume
POSTGRES_VOLUME_MOUNT = /var/lib/postgresql/data
POSTGRES_VOLUME_CAPACITY_MB = 50000
```

Database-native SSH readback:

```text
database = railway
role = postgres
server_version = 18.6 (Debian 18.6-1.pgdg13+2)
rise schemas present = 0
```

The database was left empty. The four candidate SQL files remain `.proposed.sql`; migration 003 explicitly says it is not approved for production, and migration 004 is bound to an active registry release that cannot exist without source rights. No schema, role, grant, RLS policy, student row, or secret was applied.

```text
DURABLE_PROVIDER_PROVISIONED = YES
DURABLE_STORAGE_LIVE = NO
MY_PROGRAMS_PERSISTENT = NO
```
