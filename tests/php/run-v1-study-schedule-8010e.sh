#!/bin/sh
set -eu

php -d display_errors=1 -d error_reporting=-1 tests/php/v1-study-schedule-8010e-domain.php
php -d display_errors=1 -d error_reporting=-1 tests/php/v1-study-schedule-8010e-schema.php
php -l wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-migrator.php
php -l wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-innodb-repository.php
php -l tests/php/v1-study-schedule-8010e-e1-worker.php
php -l tests/php/v1-study-schedule-8010e-e1-process.php
php -d display_errors=1 -d error_reporting=-1 tests/php/v1-study-schedule-8010e-e1-contract.php
