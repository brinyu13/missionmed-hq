# SEV1-003 Rollback Status

Ticket: `MM-LAUNCH-SEV1-003-LIVE-DEPLOY-VALIDATE`

Date: 2026-06-15

## Rollback Decision

Rollback was **not** performed.

Reason: no rollback triggers were observed.

## Rollback Trigger Review

| Trigger | Observed? | Notes |
| --- | --- | --- |
| Fatal error | No | Remote PHP lint passed; public probes showed no fatal/critical text; error log had no recent fatal/parse/critical entries. |
| White screen | No | Required URLs returned content with non-empty bodies. |
| Login break | No | `/my-account/` returned 200; no login submission was performed. |
| Checkout break | Not tested | Checkout was not touched or modified. Woo Store API pricing was validated instead. |
| Major layout break | No | Desktop/mobile pass showed no blank pages; only Red Flag mobile table overflow. |
| Legal pages still broken with plugin active | No | All three policy pages return 200. |
| Pricing incorrectly changed in checkout | Not tested | Checkout was not touched. Woo Store API still shows early-season prices. |
| Woo product data changed unexpectedly | No | Woo Store API prices unchanged. |

## Production Backup

Backup directory:

`/www/theresidencyacademy_209/missionmed_deploy_backups/MM-LAUNCH-SEV1-003-20260615T175404Z/`

Backup contents:

- `mu-plugins.before.tgz`

There was no pre-existing production file at:

`/www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-launch-sev1-fixes.php`

## Exact Rollback Command

Because no same-named file existed before deployment, the fastest rollback is to remove the deployed mu-plugin and clear cache:

```bash
ssh missionmed-kinsta 'rm -f /www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-launch-sev1-fixes.php; cd /www/theresidencyacademy_209/public && wp cache flush'
```

Full mu-plugins directory restore from the pre-deploy backup:

```bash
ssh missionmed-kinsta 'tar -xzf /www/theresidencyacademy_209/missionmed_deploy_backups/MM-LAUNCH-SEV1-003-20260615T175404Z/mu-plugins.before.tgz -C /www/theresidencyacademy_209/public/wp-content; cd /www/theresidencyacademy_209/public && wp cache flush'
```

After rollback, re-run:

- `/privacy-policy/`
- `/terms-of-agreement/`
- `/refund-cancellation-policy/`
- `/mission-residency/`
- `/homepage-arena/`

Expected rollback consequence: legal pages may return to 404 and public launch artifacts may return.

