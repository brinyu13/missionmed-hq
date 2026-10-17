# D9-415 Snapshot Exclusion Register

## Immutable plugin baseline

No `missionmed-hub` entry is excluded from D9-415A. The sealed tree contains no log, cache, upload, session-data file, database export, environment file, credential file, private key, symlink, or special filesystem entry. Reports, prototypes, and `assets/test-deploy.txt` remain in the observed baseline because D9-415A must represent the complete quiescent production tree; deterministic deployable packaging excludes non-runtime residue later.

## MU observation envelope

The full MU tree was captured only inside the ignored, permission-restricted forensic area so closure could be proved. Ten top-level Matrix-related files are selected for Git. The other 116 observed MU files remain excluded because they are unrelated Kinsta/vendor or adjacent product source and the ticket forbids importing unrelated MU plugins.

## Always excluded from Git

- the raw forensic transport tree itself;
- T0/T1 raw transport artifacts except safe manifests and verification results;
- production logs, caches, uploads, sessions, temporary files, database exports, user data, credentials, environment files, private keys, and authorization material (none found in the selected source);
- unrelated MU-plugin source;
- any secret or private value discovered by later validation.

Excluded-item source content is never reproduced in reports. Safe path/type/size/mode/hash evidence remains in the full T0/T1 manifests.
