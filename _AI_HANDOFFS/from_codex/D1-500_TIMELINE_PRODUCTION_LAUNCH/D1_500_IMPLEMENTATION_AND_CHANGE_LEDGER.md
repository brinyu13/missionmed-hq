# D1-500 Implementation and Change Ledger

Implemented and sealed at commit
`b668cc4d3eaa8075a357d35a60456fcaaaffa18c`:

- production release identity and required health release marker;
- execution-private WordPress runtime packaging with extensionless,
  content-addressed assets;
- accepted-asset authority verification and private-fixture exclusion;
- WordPress default-off route, canary and eligible-360 rollout stages;
- live LearnDash 3893 entitlement check;
- explicit student remote-sync consent record and withdrawal seams;
- immutable WordPress-user-to-Timeline-principal mapping;
- short-lived issuer/audience/key-bound JWT exchange;
- same-origin gateway and direct-API denial boundary;
- persona-bound IndexedDB cache and conflict-safe hybrid persistence;
- PostgreSQL D1-500 schema/grant hardening, forced RLS, and exact admin grants;
- dependency-aware health, sanitized logging, kill-switch controls, and rollback
  scripts.

Production provider changes completed:

- isolated Railway project, environments, API service, PostgreSQL service;
- non-secret, no-deploy API configuration only.

Production provider changes not completed:

- schema migration, runtime login binding, secret installation, API deploy;
- Kinsta backup, payload install, plugin activation, release pointer, route or
  navigation activation;
- canary and student rollout.
