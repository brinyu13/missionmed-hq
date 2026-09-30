#!/usr/bin/env bash
set -euo pipefail
# Invoke only while holding the exact two-file provider lease.
custody=/www/theresidencyacademy_209/private/mr-human-proof-0930
assets=wp-content/mu-plugins/missionmed-mr-alternate-assets
ssh missionmed-kinsta "set -eu; test ! -e '$custody'; umask 077; mkdir '$custody'; mkdir '$custody/preimage' '$custody/candidate'; cd /www/theresidencyacademy_209/public; test \"\$(sha256sum '$assets/page.php' | cut -d' ' -f1)\" = 2e6e8dc94475434da7c091a8bc496bb4663efb509e68c519989ac41ed2d727ef; test \"\$(sha256sum '$assets/alternate.css' | cut -d' ' -f1)\" = 6c3a367b32f5e166d500b5ed58976007cbae10f8a388fa4e1e11ebc2abb480da; cp -p '$assets/page.php' '$assets/alternate.css' '$custody/preimage/'; sha256sum '$custody/preimage/'*"
scp "$assets/page.php" "$assets/alternate.css" "missionmed-kinsta:$custody/candidate/"
page_hash=$(shasum -a 256 "$assets/page.php" | cut -d' ' -f1)
css_hash=$(shasum -a 256 "$assets/alternate.css" | cut -d' ' -f1)
ssh missionmed-kinsta "set -eu; cd /www/theresidencyacademy_209/public; test \"\$(sha256sum '$custody/candidate/page.php' | cut -d' ' -f1)\" = '$page_hash'; test \"\$(sha256sum '$custody/candidate/alternate.css' | cut -d' ' -f1)\" = '$css_hash'; php -l '$custody/candidate/page.php'; cmp '$assets/page.php' '$custody/preimage/page.php'; cmp '$assets/alternate.css' '$custody/preimage/alternate.css'; cp '$custody/candidate/alternate.css' '$assets/alternate.css.human-next'; chmod 644 '$assets/alternate.css.human-next'; mv '$assets/alternate.css.human-next' '$assets/alternate.css'; cp '$custody/candidate/page.php' '$assets/page.php.human-next'; chmod 644 '$assets/page.php.human-next'; mv '$assets/page.php.human-next' '$assets/page.php'; sha256sum '$assets/page.php' '$assets/alternate.css'"
