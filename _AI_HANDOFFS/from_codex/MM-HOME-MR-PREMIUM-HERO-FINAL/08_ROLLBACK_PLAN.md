# Rollback plan

## Preferred recovery boundary

Use the provider-native Kinsta backup `Pre premium hero release 2026-09-29` for a complete site rollback. It was created immediately before release and remains available until Oct 13 2026 8:35 PM ET.

## Narrow file rollback

Preimages are preserved at:

`/www/theresidencyacademy_209/private/mm-home-mr-premium-hero/20260930T003640Z/preimage`

The directory contains the original `SHA256SUMS`, `ABSENT_PREIMAGES`, original homepage plugin preimages, the first deployed hero script, and both dedicated-script fix-forward preimages (`site.js.pre-b5561e0`, `site.js.pre-b69a10a`).

For a narrow rollback:

1. Verify the current production hash against `07_DEPLOYMENT_AND_LIVE_READBACK.md`.
2. Restore only the affected file from the matching preimage; remove only paths explicitly recorded in `ABSENT_PREIMAGES` when rolling back newly introduced files.
3. Preserve ownership and mode, install atomically, and purge the Kinsta site cache.
4. Re-run the anonymous homepage and dedicated-page smoke, then verify unrelated page-load routes.

Do not alter accepted Zelle artifacts during a presentation rollback.

