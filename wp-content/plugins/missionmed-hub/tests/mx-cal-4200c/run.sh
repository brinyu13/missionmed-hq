#!/usr/bin/env bash
set -euo pipefail

test_dir="$(cd "$(dirname "$0")" && pwd)"
plugin_root="$(cd "$test_dir/../.." && pwd)"

node --check "$plugin_root/assets/calendar-core/mmed-calendar-core.js"
node --check "$plugin_root/assets/calendar-core/mmed-calendar-runtime.js"
node --check "$plugin_root/assets/calendar-v2/mmed-calendar-v2.js"
node --check "$plugin_root/assets/student-os-calendar-v4.js"
php -l "$plugin_root/includes/class-mmed-calendar-experience.php" >/dev/null
php -l "$plugin_root/includes/class-mmed-student-os.php" >/dev/null
php -l "$plugin_root/missionmed-hub.php" >/dev/null
TZ=America/New_York node --test "$test_dir/calendar-core.test.js"
TZ=America/Los_Angeles node --test "$test_dir/calendar-core.test.js" >/dev/null
TZ=Europe/London node --test "$test_dir/calendar-core.test.js" >/dev/null
php "$test_dir/experience-resolution.test.php"
bash "$test_dir/contracts.sh"

echo 'MX-CAL-4200C TEST PASS'
