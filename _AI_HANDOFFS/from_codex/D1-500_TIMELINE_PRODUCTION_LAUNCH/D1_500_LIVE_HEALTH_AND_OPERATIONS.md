# D1-500 Live Health and Operations

Local production handler health tests pass, including dependency failure,
timeout, recovery, release identity, and content-free errors.

Production PostgreSQL is migrated and healthy at schema
`d1-timeline-db-500.1`. The repaired Railway image passes its build gates, but
the deployment fails closed at `/healthz` because the API service does not yet
have the two required secret bindings. The provider domain therefore returns
Railway's application-not-found response and must not be classified as live.

WordPress is installed feature-off. `/timeline/` exists and anonymous traffic
returns to the Matrix member-dashboard flow. The token endpoint is registered;
anonymous POST is denied `401`. No Founder, administrator, or student has been
admitted.

Next operational step after secret binding is an immutable API redeploy. A
successful health response must identify service `mission-timeline`, release
`timeline-0c5cc515a76346d6`, and schema `d1-timeline-db-500.1` before canary
configuration changes. File Vault v2 remains disabled.
