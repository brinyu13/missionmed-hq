# B1-512B Backup Receipts

Status: **PASS — fresh recovery points created and verified.**

## Railway provider-native backup

- Project/environment/volume instance: `875e7c17-d06f-4301-a4bb-e61016f153cf` / `bcef8734-e42b-44df-8488-c2a3de68213f` / `8d4a7b7f-7d55-4a1d-81eb-07221b4a7bf5`.
- Backup ID: `835127ec-49f6-46a9-a55c-db6582748edd`.
- Created: `2026-08-06T20:25:16.913Z`; referenced size: `910 MB`.
- Railway `volumeInstanceBackupLock` returned `true`; post-lock `expiresAt=null`.

## Kinsta provider-native manual backup

- Site/environment: MissionMed Institute / Live.
- Provider-visible note: `B1-512B StoryForge operational preflight 20260806T`.
- Created: `2026-08-06 4:19 PM America/New_York`.
- Expiry: `2026-08-20 4:19 PM America/New_York`; provider Restore control visible.
- MyKinsta does not show a separate immutable backup ID; note plus exact time and expiry are the provider receipt.

## Sealed Kinsta runtime snapshot

- Private snapshot ID/path: `B1-512B-KINSTA-PRE-20260806T202027Z` under the Kinsta private recovery root.
- Manifest SHA-256: `8173ddb309806b041e76f15d09dc5b8eebf740b4e446c5c44ab5f9c2b3608243`.
- Pointer: `releases/752d408f32c7becc9d10712e163ab86693998edc`.
- Route SHA-256: `e30a563cedd6e4d4fab03bbbac1bc72bfe2fbe82efbd44fdad5e6b5ea607455f`.
- Active `release.php` SHA-256: `805ec783704f8be8a9ce4d7fbc593e046391464a5d0ce081ab185f87eb400ef6`.
- Directory mode is `0700`, files are `0600`; a second remote readback passed all hashes and pointer equality.

## PostgreSQL logical backup

- Private PG18 dump: `/Users/brianb/MissionMed_private_backups/B1-512B.ypNzKZ/storyforge-production.pg18.dump`.
- SHA-256: `fc0f13e92b35ee59bba6c43854e7addc3f4b5142080db4330f48e8a942b59b7b`.
- Bytes: `448511`; mode: `0600`; catalog entries: `440`.
