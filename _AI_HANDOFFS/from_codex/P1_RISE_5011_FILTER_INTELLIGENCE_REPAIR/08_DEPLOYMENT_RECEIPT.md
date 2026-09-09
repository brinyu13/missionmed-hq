# Deployment Receipt

## Target

- Railway project: `c0113625-951e-46ab-939b-dd57acc0e87c`
- environment: `549d6597-1962-44cb-b0f5-7d88bd025e31`
- service: `9bce2090-ce45-4572-8291-e8da5d42acb6`
- direct domain: `missionmed-rise-production.up.railway.app`

## Active deployment

- deployment: `69049d35-9af9-451d-ada2-e9f864b8051f`
- created: `2026-09-08T23:21:15.644Z`
- status: `SUCCESS`
- image: `sha256:fe69faf3e53bfb94a63400088ac41210c85b8d504bf8dbddb9bac166a5d60cf4`
- build: `rise_web_6f6223500194`
- web manifest SHA-256 pin: `8d56cdea4bcd03ff15727c4532ae9414e6e4cab4d4392cbd75ee6d00897b38c6`

Health readback:

```json
{"ok":true,"service":"missionmed-rise","registryReleaseId":"rise_registry_2026-07-09_8fdb5afb84f6","activationStatus":"active","buildId":"rise_web_6f6223500194","environment":"production","sourceRightsCurrent":true}
```

Anonymous filter endpoint readback was HTTP 401. Provider deployment status and service status both identify the deployment above as the latest successful active release.

Three build candidates failed before cutover and one pin-only candidate was skipped; production remained on the protected prior deployment until the final image passed its manifest pin and became healthy. Those non-cutover candidates were `96acfe79-8967-4d73-898f-bf961dc8b08b`, `a316976c-d604-4926-82a3-474abb1a604d`, `2e05e6c8-a515-490f-a492-546ff5996d58`, and skipped `ac3fa039-0ffa-4950-8832-ffc915986463`.

Product PATH lease epoch 1584, lease `21167852-314e-4d77-a538-3eb20ab5d6d4`, was normally released after commit and push. Provider SQL readback: `released=true`, `expired=true`, `active=false`. An earlier epoch 1570 keeper expired fail-closed during a direct data-plane transport interruption; it was provider-confirmed inactive before epoch 1584 was acquired.

