# Named, presentation-only restore

V1 is MR-LANDING-PAGE-V1.json, frozen before the V2 presentation mutation.
Source: 8390032e4c1b33b26c4f8d7d0a7f9e2d6562eef9; deployed presentation: 70275a5e8675e611991f2aaa01c7a7b4dfa85de9.
Custody: missionmed-kinsta:/www/theresidencyacademy_209/private/mr-landing-page-versions-20260930/MR-LANDING-PAGE-V1/.
The archive contains the complete presentation asset tree. Three individual preimages are also held there.
The JSON manifest records all asset hashes, protected runtime hashes, HTTP/cache state and the legacy redirect. Browser evidence is qa/v1-browser.json and the two v1 screenshots.

## Restore gate

Acquire a fresh scoped MissionMed lease for only page.php, alternate.css and alternate.js. Verify no conflicting provider/registry writer. Confirm current hashes equal the intended V2 release manifest, not a later release. If they differ, stop for reconciliation. Verify the three private V1 files against MR-LANDING-PAGE-V1.json before copying. Preserve the current three files in a new private timestamped directory first.

## Exact V1 restore command (only after the gate)

```sh
ssh missionmed-kinsta 'set -eu
src=/www/theresidencyacademy_209/private/mr-landing-page-versions-20260930/MR-LANDING-PAGE-V1
dst=/www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-mr-alternate-assets
php -l "$src/page.php"
install -m 644 "$src/alternate.css" "$dst/alternate.css.restore-v1"
install -m 644 "$src/alternate.js" "$dst/alternate.js.restore-v1"
install -m 644 "$src/page.php" "$dst/page.php.restore-v1"
mv "$dst/alternate.css.restore-v1" "$dst/alternate.css"
mv "$dst/alternate.js.restore-v1" "$dst/alternate.js"
mv "$dst/page.php.restore-v1" "$dst/page.php"
cd /www/theresidencyacademy_209/public
wp kinsta cache purge --site
'
```

Verify all three exact V1 hashes and the protected hashes. Fetch anonymous canonical HTML and hash-versioned CSS/JS. Verify legacy 301 with UTM preservation. Render at 1440 and 390; compare to the named V1 screenshots. Release the scoped lease. Record the rollback as a new runtime event; do not reset candidate source.

No WordPress content/config database restore is required or permitted by this recipe: the canonical route is an MU-rendered template, not a changed page object. Current prices and schedule continue to come from the unchanged mm_mr_p0_runtime_config(). Do not restore Woo, orders, payments, account state, Zelle, Stripe, entitlements, routing, main homepage or USCE. Do not extract the entire archive onto production unnecessarily.

Kinsta's purge command may report success and then exit 139 in this environment. Record that accurately; prove public asset versions/HTML rather than repeatedly purging or interpreting a browser's cached tab as runtime truth.
