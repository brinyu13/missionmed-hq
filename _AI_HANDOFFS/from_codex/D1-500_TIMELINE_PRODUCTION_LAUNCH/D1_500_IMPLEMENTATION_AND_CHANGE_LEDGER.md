# D1-500 Implementation and Change Ledger

Accepted product implementation remains sealed at
`b668cc4d3eaa8075a357d35a60456fcaaaffa18c` with release identities
`timeline-0c5cc515a76346d6` and `timeline-wp-c228658bc70bc395`.

Production changes completed:

- Critical Systems metadata amendment and Timeline registration;
- Kinsta and Railway provider-native backups plus logical database backup;
- six accepted database migration/role assets and runtime-role binding;
- Railway non-secret service configuration and PostgreSQL reference;
- Railway provider domain;
- exact Kinsta payload installation, plugin activation, immutable release
  pointer, and default-off settings;
- anonymous Matrix redirect and anonymous token-denial verification.

Defect and repair:

- defect: generated Nixpacks plan ran its install stage and the configured build
  ran a second `npm ci`, producing an `EBUSY` cache failure;
- repair: commit `7cf30eb` removes only the duplicate install from the build
  command; local typecheck/API build/API-only validation pass and the Railway
  retry image built successfully.

Production changes not completed:

- matching Railway/Kinsta JWT and gateway secret bindings;
- successful API health and immutable deployment receipt;
- principal provisioning, canary, eligible-360 activation, navigation proof,
  and final browser/security/rollback evidence.

No unrelated application, Matrix, Arena, USCE Admin, CDN, DNS, or provider
setting was changed. A separate staged Railway `function-bun` service was
inspected read-only and left untouched.
