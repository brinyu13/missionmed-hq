# I1Q-1008A RLS Certification

## Disposable PostgreSQL Proof

`PASS, LOCAL DISPOSABLE TARGET`:

- original migration and attack estate: 13 of 13
- identity-capability, role-separation, compensation, and reapply estate: 1 of 1
- PostgreSQL: local disposable instance, no MissionMed data

The tests exercise forced RLS, direct table denial, answer and restricted-source denial, role and assignment boundaries, immutable audit behavior, legal transitions, compensation, and idempotent reapply.

The repaired role test proves:

- both I1Q roles are `NOLOGIN`, `NOINHERIT`, and `NOBYPASSRLS`
- neither role owns schema `i1q`
- neither role has direct table privileges
- `authenticated` can inherit only the identity-profile capability
- `authenticated` cannot inherit `i1q_app_runtime`
- the app runtime remains deny all
- all feature flags remain false

## Certification Boundary

`NOT CERTIFIED FOR PREVIEW OR STAGING`: the tests ran against disposable PostgreSQL, not an authorized Supabase preview. Real project defaults, migration history, auth claim propagation, pool reuse, grants, and every canonical role journey remain untested.

State B is not achieved.
