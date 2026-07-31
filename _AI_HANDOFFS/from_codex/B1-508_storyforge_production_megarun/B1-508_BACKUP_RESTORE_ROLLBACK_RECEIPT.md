# B1-508 Backup, Restore, and Rollback Receipt

Status: **PASS before production mutation**.

## Database recovery points

- Locked Railway provider backup:
  `836b6f72-74aa-42e1-acf1-31ffa381430e`
- Created: `2026-07-31T06:38:26.836Z`
- Expiration: none.
- Provider-reported size: 870 MB.
- PostgreSQL 18 custom dump:
  `/Users/brianb/MissionMed_private_backups/B1-508/B1-508-RP-PG-PRE-20260731T064016Z/storyforge-b1-508-pre.dump`
- Dump SHA-256:
  `b426185147b0dd03ba9d3cb1726ce60cfe2708ac281a9e5fd36a7893c4d91769`
- Mode: `0600`.

The dump restored into isolated PostgreSQL 18.4 with the exact pre-mutation
shape: 29 public tables, 28 RLS tables, 3 FORCE RLS tables, 32 policies, 8
ledger rows, 1 user, 2 stories, 22 audit events, and zero voice/audio rows.

## WordPress/Kinsta recovery points

- MyKinsta manual backup: `B1-508 pre deployment 2026-07-31`
- Created: `2026-07-31 02:43 America/New_York`
- Expires: `2026-08-14 02:43 America/New_York`
- Provider restore control: present.
- Remote private recovery root:
  `/www/theresidencyacademy_209/private/b1-508/B1-508-RP-KINSTA-PRE-20260731T064500Z`
- Local private recovery root:
  `/Users/brianb/MissionMed_private_backups/B1-508/B1-508-RP-KINSTA-PRE-20260731T064500Z`
- Prior pointer SHA-256: `5b12bf99b2125bd1ffd83527905269e2fd368404d2c6072d42ed643998b0dbeb`
- Runtime archive SHA-256: `1c4a5b27eb4fcecd0852a930d2739d61e8ae2e82ec7e77a23c12571416b5723b`
- WordPress settings SHA-256: `c1e2835edbcd44b5f859394a7e99dfd67441f7a017bca27f93f09b477646bfe7`
- WordPress SQL SHA-256: `52d6e009aa9396a31e52921f45086153fde6c7142ce4c925fbab0d9344658ba3`

All private files are `0600`; private directories are `0700`.

## Deployment rollback artifacts

- Prior source: `09878514fff39b2d1f2ba3ee40c4c3de55ffc473`
- New source archive:
  `/Users/brianb/MissionMed_private_backups/B1-508/B1-508-DEPLOY-20260731T070100Z/storyforge-source-97ebf2433849343acd521547e558a9713c579eb0.tar`
- New archive SHA-256:
  `f289cb63ba9aa8df56e64ea56719c887fed4ccacdd740d6681e00f5577374c61`
- Kinsta rollback receipt:
  `/www/theresidencyacademy_209/private/b1-508/rollback/B1-508-KINSTA-ROLLBACK-20260731T070100Z/rollback.tsv`
- Rollback receipt SHA-256:
  `544b53f660f92ae311750139ba90fa7391b84d167e6c79bbf3bed8ae238c3e7d`

## Emergency rollback order

1. Disable the WordPress StoryForge gate and wait at least one JWT TTL.
2. Force provider `none`, reconciliation `off`, and voice force-off `1`.
3. Restore the prior Kinsta pointer/settings from the sealed receipt and clear
   provider cache.
4. Redeploy the prior Railway deployment/source if runtime rollback is needed.
5. For M4-only database rollback, use the accepted M4 rollback only while the
   gate is drained; never reverse M1-M3.
6. Verify exact hashes, one-Founder scope, DB counts, `/healthz`, config, and
   zero HTTP 5xx before reopening.

No rollback was required during B1-508.
