#!/bin/bash
set -euo pipefail
cd /www/theresidencyacademy_209/public
base=wp-content/mu-plugins
staged=/www/theresidencyacademy_209/private/mr-primary-promotion-0930/promotion
guard() { test "$(sha256sum "$1" | cut -d ' ' -f1)" = "$2"; }
guard "$base/missionmed-mr-alternate.php" 290ccda21873122c17447ce17cd4d43c6220c3f5445b8d949406c4fddeba8756
guard "$base/missionmed-mr-alternate-assets/page.php" 953f7b7a6ec05c3223887b3fed5f2356b11062608e36cf09fdcf6b9a6cd3e24d
guard "$base/missionmed-mr-alternate-assets/alternate.css" fcb608485440d18a4542fb3aaed6f6c48f4ac82f29084ca901716c4386ac7049
guard "$base/missionmed-mr-0912-assets/premium-hero/hero.js" 3fbce99628f72fe04fb8b3bbd28bdc1a377f4a2b4ca5d0e8ae847eabc42a1e03
guard "$base/missionmed-mr-p0.php" 65465d56ecc1c2df723709ad6e136682ba05ffa180d5ceef7934077a0ebb4e50
test ! -e "$base/missionmed-mr-primary-routing.php"
tar -czf /www/theresidencyacademy_209/private/mr-primary-promotion-0930/pre-promotion-refined.tar.gz "$base/missionmed-mr-alternate.php" "$base/missionmed-mr-alternate-assets/page.php" "$base/missionmed-mr-alternate-assets/alternate.css" "$base/missionmed-mr-0912-assets/premium-hero/hero.js"
for f in missionmed-mr-alternate.php missionmed-mr-alternate-assets/page.php missionmed-mr-primary-routing.php; do php -l "$staged/$base/$f"; done
# Routing provider is last: metadata becomes primary only when it is present.
for f in missionmed-mr-alternate.php missionmed-mr-alternate-assets/page.php missionmed-mr-0912-assets/premium-hero/hero.js missionmed-mr-primary-routing.php; do
 cp "$staged/$base/$f" "$base/$f.promote-tmp"
 mv "$base/$f.promote-tmp" "$base/$f"
 cmp "$staged/$base/$f" "$base/$f"
 sha256sum "$base/$f"
done
for route in '' missionresidency/ mission-residency/ mission-residency usce/ examprep/ homepage-arena/ contact/ cart/ my-account/ compare-programs/ page-sitemap.xml sitemap_index.xml; do
 curl -fsSk -o /dev/null -w "purge HTTP %{http_code}\n" -X POST https://localhost/kinsta-clear-cache/v2/immediate --data-urlencode "single|mr-promote=missionmedinstitute.com/$route"
done
sha256sum /www/theresidencyacademy_209/private/mr-primary-promotion-0930/pre-promotion-refined.tar.gz
