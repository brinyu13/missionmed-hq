# MR-WEB-0904B Rollback

Rollback readiness: **PASS**

## Provider restore

MyKinsta exposes a **Restore to** control for the manual Live backups captured at 9:10 AM and 1:19 PM EDT on September 4, 2026. Use provider restore only for a broad incident; it has a larger blast radius than the bounded application rollback.

## Bounded entitlement/commerce rollback

The production state controller supports `MR0904B_MODE=rollback` and restores the exact preimage stored at:

`/www/theresidencyacademy_209/private/mr-web-0904b/preimage.json`

The rollback restores recorded Woo product/variation state, `_related_course` metadata, LearnDash course settings, checkout options, payment configuration, and launch-affecting snippet/coupon state. Run the controller from an authenticated production shell, verify the sanitized JSON result is `PASS`, then purge Autoptimize, object, page, and CDN caches.

The MissionMed Hub file also has a protected server-side preimage from before the bounded patch. Restore that file only as part of a coordinated entitlement rollback; independently re-enabling the Hub Residency fallback would reintroduce competing grant authority.

Never restore a staging database over production for this rollback.
