#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
RELEASE_MANIFEST="$ROOT_DIR/wp-content/plugins/missionmed-hub/assets/v1-study-release.f07cd46b855c40a2.json"
RELEASE_SHA256="f07cd46b855c40a245200bbb67b733bcb68fb4cf9bcc99e18c257627a3f2c44a"

test -f "$RELEASE_MANIFEST"
test "$RELEASE_SHA256" = "$(sha256sum "$RELEASE_MANIFEST" | awk '{print $1}')"

for file in \
  "$ROOT_DIR/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-domain.php" \
  "$ROOT_DIR/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-release.php" \
  "$ROOT_DIR/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-repository.php" \
  "$ROOT_DIR/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-access.php" \
  "$ROOT_DIR/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-observability.php" \
  "$ROOT_DIR/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-rest-api.php" \
  "$ROOT_DIR/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-loader.php" \
  "$ROOT_DIR/wp-content/plugins/missionmed-hub/includes/class-mmed-calendar-engine.php" \
  "$ROOT_DIR/wp-content/plugins/missionmed-hub/includes/class-mmed-study-schedule.php" \
  "$ROOT_DIR/wp-content/plugins/missionmed-hub/missionmed-hub.php" \
  "$ROOT_DIR/tests/php/v1-study-schedule-8010c-contract.php" \
  "$ROOT_DIR/tests/php/v1-study-schedule-8010c-rest-loader.php" \
  "$ROOT_DIR/tests/php/v1-study-schedule-8010c-wordpress.php"
do
  php -l "$file"
done

php "$ROOT_DIR/tests/php/v1-study-schedule-8010c-contract.php"
php "$ROOT_DIR/tests/php/v1-study-schedule-8010c-rest-loader.php"
