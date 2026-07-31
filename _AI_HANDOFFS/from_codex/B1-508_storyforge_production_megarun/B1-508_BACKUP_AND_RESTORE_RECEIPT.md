# B1-508 Backup and Restore Receipt

Status: PASS before any B1-508 database or application cutover.

## Railway and PostgreSQL

- Railway project: `875e7c17-d06f-4301-a4bb-e61016f153cf`
- Production environment: `bcef8734-e42b-44df-8488-c2a3de68213f`
- PostgreSQL service: `a4a66362-c3ba-475a-ae21-2aa46624bafe`
- Volume instance: `8d4a7b7f-7d55-4a1d-81eb-07221b4a7bf5`
- Locked provider backup: `836b6f72-74aa-42e1-acf1-31ffa381430e`
- Created: `2026-07-31T06:38:26.836Z`
- Expiration: none
- Provider-reported referenced size: 870 MB
- PostgreSQL 18 custom dump:
  `/Users/brianb/MissionMed_private_backups/B1-508/B1-508-RP-PG-PRE-20260731T064016Z/storyforge-b1-508-pre.dump`
- Dump SHA-256:
  `b426185147b0dd03ba9d3cb1726ce60cfe2708ac281a9e5fd36a7893c4d91769`
- Dump mode: `0600`

An isolated PostgreSQL 18.4 restore completed without diagnostics. The restored
shape was exactly:

- 29 public tables;
- 28 RLS tables;
- 3 FORCE RLS tables;
- 32 policies;
- 8 migration-ledger rows;
- 1 StoryForge user;
- 2 stories;
- 22 audit events;
- 0 recording sessions;
- 0 recording segments;
- 0 audio assets.

Restore log SHA-256:
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

Restore-shape receipt SHA-256:
`287b9899e303c224e9de448e74e52d15cd238ad71933237f78044c351bf5bc26`.

The first local restore attempt failed before server startup because its Unix
socket path exceeded PostgreSQL's platform limit. Production was untouched.
The rerun used loopback TCP, strict shell failure handling, and passed.

## Kinsta

- Manual backup note: `B1-508 pre deployment 2026-07-31`
- Created: `2026-07-31 02:43 America/New_York`
- Expires: `2026-08-14 02:43 America/New_York`
- Restore control: present
- Remote private recovery root:
  `/www/theresidencyacademy_209/private/b1-508/B1-508-RP-KINSTA-PRE-20260731T064500Z`
- Local private recovery root:
  `/Users/brianb/MissionMed_private_backups/B1-508/B1-508-RP-KINSTA-PRE-20260731T064500Z`

Private recovery hashes:

- current pointer:
  `5b12bf99b2125bd1ffd83527905269e2fd368404d2c6072d42ed643998b0dbeb`
- WordPress/runtime archive:
  `1c4a5b27eb4fcecd0852a930d2739d61e8ae2e82ec7e77a23c12571416b5723b`
- StoryForge WordPress settings:
  `c1e2835edbcd44b5f859394a7e99dfd67441f7a017bca27f93f09b477646bfe7`
- WordPress SQL:
  `52d6e009aa9396a31e52921f45086153fde6c7142ce4c925fbab0d9344658ba3`

Every private recovery file is mode `0600`; both private recovery directories
are mode `0700`. The sealed pointer targets production source
`09878514fff39b2d1f2ba3ee40c4c3de55ffc473`.

No restore was executed against Railway or Kinsta. No StoryForge provider, R2,
voice, reconciliation, or production application deployment action occurred
during backup preparation.
