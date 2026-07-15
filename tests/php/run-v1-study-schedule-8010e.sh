#!/bin/sh
set -eu

php -d display_errors=1 -d error_reporting=-1 tests/php/v1-study-schedule-8010e-domain.php
php -d display_errors=1 -d error_reporting=-1 tests/php/v1-study-schedule-8010e-schema.php
