#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)

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
