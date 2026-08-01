# B1-510I Backup, Restore, and Rollback

## Phase B/C database backup

- Private root: `/Users/brianb/MissionMed_private_backups/B1-510I/B1-510I-PHASEBC-20260801TVgaaEd` (0700).
- PostgreSQL 18 custom dump: `storyforge-pre-phasebc.dump` (0600).
- Dump SHA-256: `85883104b3353fffeaef050b8b88823700ec6364b5a915dac6c0401eeca7c68e`.
- Isolated PostgreSQL 18 restore: PASS.
- Restored baseline: 441 users, 440 eligible students plus one eligible administrator, 7 stories, 9 migrations, `voice_capture=eligible_all:0:0`, `admin_console` absent.
- Locked Railway volume backup: `47ff9400-d062-4b17-816e-de8f40f5fb53`, created `2026-08-01T21:20:28.259Z`, no expiry, external snapshot identity present.

## Kinsta protection

Kinsta's manual-backup allotment was already 5/5. No existing whole-site backup was destructively deleted. The recent whole-site backup `Pre PS Storyforge Capsule` (Aug 1, 3:53 PM EDT) was preserved, and a fresh StoryForge-specific private snapshot was created at:

`/www/theresidencyacademy_209/private/b1-510i/B1-510I-PHASEBC-20260801T212506Z`

It contains the prior route, release bundle, relative pointer, SSO plugin, Matrix launcher, and StoryForge settings. Every file is 0400 and `MANIFEST.sha256` verified PASS.

## Static rollback

- Receipt: `/www/theresidencyacademy_209/private/b1-510i/rollback/B1-510I-PHASEBC-20260801T213200Z/rollback.tsv`.
- Receipt SHA-256: `fba368fec09b82952f14a7157abd28b57555c8a3b6b048a8ca474b67b84882a1`.
- Prior pointer: `releases/3aeceee268ed6fd9a8eaa50138b8c00e8f13211b`.
- Prior route backup: present and hash/size verified.
- Installed pointer, route, and release hashes: verified.
- Manual receipt-integrity rehearsal: PASS.

The host's WordPress/PHP process again returned an unexpected response followed by exit 139 in the cache helper. Exact public hashes nevertheless changed immediately and match the candidate. A later automated rollback-preflight attempt encountered the same host PHP instability; its trap restored `storyforge_enabled=true`, and public `/storyforge/` plus API health remained HTTP 200. No speculative host repair was attempted.

Database restore was not used. Permanent canary audio was not deleted. Reconciliation remains off.
