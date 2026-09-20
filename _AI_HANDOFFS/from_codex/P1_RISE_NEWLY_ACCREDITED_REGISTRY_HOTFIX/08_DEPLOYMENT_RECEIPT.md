# Deployment Receipt

- Environment: Railway production.
- Project: c0113625-951e-46ab-939b-dd57acc0e87c.
- Environment ID: 549d6597-1962-44cb-b0f5-7d88bd025e31.
- RISE service ID: 9bce2090-ce45-4572-8291-e8da5d42acb6.
- Deployment ID: b9111ae6-269f-4823-9265-85552ddab11e.
- Deployment status: SUCCESS.
- Image digest: sha256:19e08285a203e116b9d3ea336e9743ef569f22ca5be9733c13fe771e865782df.
- Build ID: rise_web_a250aa9db9a6.
- Registry release: rise_registry_acgme_2026-09-20_50d08ea6f2da.
- API index SHA-256: 6d1f8aa306012f7eea1f7c7a0af4f04be3d60f2c435d297a584a25e98923f989.
- Index manifest SHA-256: ebb01f3cf91694320b65595ed761eea63e7eb55ab245f2173845e1dada20e3ba.
- Registry content SHA-256: 50d08ea6f2da10aa966f2b2f216aa3514ee726b0079ebb5cb65eb6e95168b190.
- Runtime health: ok=true, activationStatus=active, environment=production, sourceRightsCurrent=true.
- Authenticated public entry QA: https://missionmedinstitute.com/rise/.

Production serves the immutable bundled release. No database migration was required; the older 909-row rights-safe database projection is not the full production catalog and was not promoted over the complete registry.

Lease V2:

- Deploy leases epochs 3105 and 3106 expired during provider deploy and were not concurrently reused.
- Final provider readback used epoch 3107 and was normally released.
- Final provider query showed active_lease_count=0.
