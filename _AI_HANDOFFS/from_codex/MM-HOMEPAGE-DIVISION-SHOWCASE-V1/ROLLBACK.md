# Restore homepage pre-division-showcase

Named restore target: `MISSIONMED-HOMEPAGE-PRE-DIVISION-SHOWCASE`. Its private preimage retains the exact former homepage renderer PHP, Hero CSS and Hero JS, SHA manifest, baseline source commit, and prior deployment identity. Restoring the renderer PHP alone deactivates the additive showcase and reinstates the exact previous homepage presentation; the new CSS/JS/image files can remain inert. No database, payment, or customer data is touched.

Guard before restore: compare the current public `wp-content/mu-plugins/missionmed-mr-p0.php` SHA-256 with the recorded showcase SHA `aa7e296ccce7d9a6812adee731bd19012a13ba02b853eac1fe1340326bfc31f5`. If it differs, newer unrelated production work may exist: preserve it and perform a selective showcase removal instead of overwriting the whole PHP file.

For the exact recorded state, install the preimage atomically:

```sh
ssh missionmed-kinsta 'set -e; b=/www/theresidencyacademy_209/private/mm-home-mr-premium-hero/MISSIONMED-HOMEPAGE-PRE-DIVISION-SHOWCASE/preimage; p=/www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-mr-p0.php; test "$(sha256sum "$p" | cut -d" " -f1)" = aa7e296ccce7d9a6812adee731bd19012a13ba02b853eac1fe1340326bfc31f5; cp "$b/missionmed-mr-p0.php" "$p.rollback-new"; chmod 644 "$p.rollback-new"; mv "$p.rollback-new" "$p"; test "$(sha256sum "$p" | cut -d" " -f1)" = 5777cd9bb474ad17ab566b6485af4bdc4f802cefc828c5407f8a9ccdb58eca0e; php -l "$p"'
```

Then clear MyKinsta Live Server Caching; in Edge Caching clear only `https://missionmedinstitute.com/` with the “every subdirectory” checkbox unchecked. Verify the anonymous public homepage no longer contains `#mm-three-divisions`, that the former Hero/bridge/proof still serve, and that the preimage PHP hash reads back. The private preimage itself must not be deleted.
