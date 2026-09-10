# Deployment and Rollback

## Live receipt

- Railway project: c0113625-951e-46ab-939b-dd57acc0e87c
- Environment: 549d6597-1962-44cb-b0f5-7d88bd025e31
- App service: 9bce2090-ce45-4572-8291-e8da5d42acb6
- Worker service: a2cab443-b683-4a23-8f32-bf1351015f42
- Live deployment: 7343c8cc-476a-4c0a-a6c9-675a43a03348
- Image digest: sha256:c838fc98fa1534e865a9aec4536702ab78e35ea74d587a349843f7636dd60512
- Build ID: rise_web_47e0a18a492a
- Asset pin: 96ac32b0c25d8643cde60a8ea294e6c60ded2b08536c4d902471eef97e3d69fa
- Code commit: 7219507b583d0daecd8debacb89b5df8bb82cf6e

Corrected fail-closed deployment attempts: 82f297ce-241e-4c19-9d24-975a7443772e (manifest mismatch), 70e85942-94ab-4485-9d7e-17323dcf7f37 (old asset pin), and d891940e-e7d6-487a-8ff9-31027e2fe7d2 (old build pin). None became the accepted live release.

## Rollback

Rollback target: e12fed77-9e74-400b-ac7f-1b528d91ef0e.

Restore its matched pins together before redeploying or rolling back:

- Build ID: rise_web_da1eaa04132e
- Asset manifest SHA-256: 4d67ae77dca1c326e98bed4f08c0e359e7def7a6caebed29849f0cbf211efadf
- Image digest: sha256:2a596b5e16ddb2c30a98a75e0412e414e5af6b7ad89c6fde257034c183fbda7a

Migration 009 is additive. Its down migration passed before Sonnet data was inserted; after insertion it intentionally fails closed rather than deleting or relabeling Sonnet evidence. Application rollback does not require destructive evidence rollback.
