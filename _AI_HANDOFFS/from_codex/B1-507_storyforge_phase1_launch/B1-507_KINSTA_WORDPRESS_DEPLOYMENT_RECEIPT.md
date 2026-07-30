# B1-507 Kinsta and WordPress Deployment Receipt

Status: READ-ONLY PREFLIGHT COMPLETE; NO INSTALL.

Verified live state:

- pointer: `releases/6f45dbbd2150ba11000236a4959f70434f6edb77`;
- route: SHA-256 `1cf024fc47f8130f980a79af6090c9f214148ac82c397fb8b94a8b7945c67f61`, mode `0444`, 30,530 bytes;
- release: SHA-256 `3215eed4837d9a9d712706003e352ead3423e399bea76c20818270d93fcb199e`, mode `0444`, 741,148 bytes;
- SSO PHP: SHA-256 `eaf740af712ec5ef94415bae78c3107b751977f74f413b3d60a8533202e120d7`;
- Matrix launch JS: SHA-256 `7b274c10affd339c05920a4181325136396758d0e418fb55cac3bf69ec58cb8b`;
- WordPress setting summary: enabled `true`, allowlist 1, override 1, role `student`, cohorts 0, TTL 60.

Candidate:

- release commit `09878514fff39b2d1f2ba3ee40c4c3de55ffc473`;
- release ID `v-4f40609482162cbd`;
- route SHA-256 `51d800dbe52e734aafadb274ec744c7dd710f601291b0ec4af05bc25b570ac3f`, 37,413 bytes;
- release.php SHA-256 `4304a2bad8818e47f7329e66cfd747604851c88ac0bf6248686765d64c9f6a93`, 867,355 bytes.

The guarded host-side preflight/install must run only after fresh backups, the 65-second WordPress feature-off drain, and protected-manifest reconciliation.
