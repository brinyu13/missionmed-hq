# B1-510K Backup and Rollback

## Fresh backups

- PostgreSQL custom dump:
  `/Users/brianb/MissionMed_private_backups/B1-510K/B1-510K-PRE-20260801T221808Z/storyforge-b1-510k-pre.dump`
- dump SHA-256:
  `dcb3589d10e4eb490de9c30bae8c692b5d9ebc3f4826664d0fd008f94ff6fac5`
- dump size: 391,514 bytes; catalog: 496 lines; mode `0600`.
- Kinsta recovery snapshot:
  `/www/theresidencyacademy_209/private/b1-510k/B1-510K-PRE-20260801T221941Z`
- snapshot manifest SHA-256:
  `3529c190ba3dac8e2579c1635763d8a781b17337180bfbf335e7bfba12378f92`
- pre-deploy StoryForge settings were separately captured mode `0400`.

## Immutable release rollback

- prior pointer:
  `releases/dab4e67fe6f8044cfa8a76db435b0aa843826074`
- new pointer:
  `releases/4e9472bc21f0ceeaeb67f7f0276b0c7d8339e981`
- rollback directory:
  `/www/theresidencyacademy_209/private/b1-510k/B1-510K-ROLLBACK-20260801T223659Z`
- rollback receipt SHA-256:
  `973123f58745fc0d659fdfbee2d1f9a48d743b81a8a89d3512db2976092d6799`

The installer published exact immutable bytes and sealed the rollback receipt.
Its final scoped Kinsta cache helper returned the known unexpected body and PHP
exit 139 after publication; independent public byte hashes passed. No cache
workaround or unrelated Kinsta mutation was attempted.

## Independent controls

- replay config rollback: delete the exact
  `MISSIONMED_STORYFORGE_R2_ENDPOINT` constant, restoring the prior CSP;
- frontend rollback: execute the sealed Kinsta rollback receipt;
- backend rollback: redeploy prior Railway deployment
  `00496858-15f1-46d0-897b-379f63b7367c`;
- transcription rollback: restore the prior backend deployment without
  changing the frontend or replay CSP;
- emergency voice kill: existing `STORYFORGE_VOICE_FORCE_OFF=1` and redeploy.

StoryForge text need not be disabled for either bounded rollback.
