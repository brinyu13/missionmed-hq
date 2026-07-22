#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

php -l "$ROOT/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-runtime.php"
php -l "$ROOT/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-runtime-schema.php"
php -l "$ROOT/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-runtime-actor.php"
php -l "$ROOT/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-runtime-repository.php"
php -l "$ROOT/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-temporal-context.php"
php -l "$ROOT/tests/php/v1-study-schedule-rc-runtime-contract.php"
php "$ROOT/tests/php/v1-study-schedule-rc-runtime-contract.php"

php -r "define('ABSPATH', __DIR__ . '/'); define('MMED_V1_STUDY_RUNTIME_BINDING', false); require '$ROOT/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-runtime.php'; if (MMED_V1_Study_Runtime::enabled()) { exit(1); } MMED_V1_Study_Runtime::init(); if (class_exists('MMED_V1_Study_REST_API', false)) { exit(2); }"
