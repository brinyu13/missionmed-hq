# B1-508 Deployment Receipt

## Railway

- Project: `875e7c17-d06f-4301-a4bb-e61016f153cf`
- Environment: `bcef8734-e42b-44df-8488-c2a3de68213f`
- Service: `dab015bf-15ef-4698-9f16-cbf8cf23de7a`
- Source commit: `97ebf2433849343acd521547e558a9713c579eb0`
- Source archive:
  `/Users/brianb/MissionMed_private_backups/B1-508/B1-508-DEPLOY-20260731T070100Z/storyforge-source-97ebf2433849343acd521547e558a9713c579eb0.tar`
- Archive SHA-256:
  `f289cb63ba9aa8df56e64ea56719c887fed4ccacdd740d6681e00f5577374c61`
- Deployment: `7ce159b6-226a-4e77-8335-e5e5d06519c3`
- Created: `2026-07-31T07:03:26.052Z`
- Status: SUCCESS.
- Image digest:
  `sha256:c6f14f049bfcc64fd2f8038d3c7dbd3c968d6746937ac3389611ffe780b072cc`
- Topology: one replica, `us-west2`.

## Kinsta

- Stage root:
  `/www/theresidencyacademy_209/private/b1-508/stage/B1-508-KINSTA-STAGE-20260731T070100Z`
- Published source:
  `releases/97ebf2433849343acd521547e558a9713c579eb0`
- Route/runtime hashes: exact B1-508 manifest values.
- File modes: `0444`; release directory `0555`.
- Rollback receipt: sealed `0400` under a `0500` directory.
- Cache: cleared through the MyKinsta provider control.

## Database and access

- M4 committed and verified as ledger row 9.
- One-Founder WordPress scope restored exactly.
- Zero cohorts enabled.
- No broad student access enabled.

## Remote resources changed

1. Railway PostgreSQL: additive M4 only.
2. Railway StoryForge service: new successful deployment.
3. Kinsta: immutable new release and current pointer.
4. WordPress StoryForge settings: temporarily drained, then exactly restored.
5. MyKinsta cache: cleared.
6. Recovery systems: fresh Railway/Kinsta/database backups and private receipts.

No Cloudflare worker, R2, provider, Git remote, pull request, or
`missionmed-hub` protected asset was changed.
