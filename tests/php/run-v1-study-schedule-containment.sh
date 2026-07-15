#!/bin/sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)

php -l "$ROOT_DIR/wp-content/plugins/missionmed-hub/includes/class-mmed-calendar-engine.php"
php -l "$ROOT_DIR/wp-content/plugins/missionmed-hub/includes/class-mmed-study-schedule.php"
php -l "$ROOT_DIR/tests/php/v1-study-schedule-calendar-private-audience.php"
php -l "$ROOT_DIR/tests/php/v1-study-schedule-calendar-strict-mutation.php"
php -l "$ROOT_DIR/tests/php/v1-study-schedule-legacy-containment.php"
php -l "$ROOT_DIR/tests/php/v1-study-schedule-route-baseline.php"

php "$ROOT_DIR/tests/php/v1-study-schedule-calendar-private-audience.php"
php "$ROOT_DIR/tests/php/v1-study-schedule-calendar-strict-mutation.php"
php "$ROOT_DIR/tests/php/v1-study-schedule-legacy-containment.php"
php "$ROOT_DIR/tests/php/v1-study-schedule-route-baseline.php"
