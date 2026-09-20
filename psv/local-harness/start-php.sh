#!/bin/bash
set -e
HARNESS_ROOT="${MMPS_HARNESS_ROOT:-/home/claude/wpdev}"
cd "$HARNESS_ROOT/harness"
PHP_CLI_SERVER_WORKERS=4 nohup php -d opcache.enable=0 -S 127.0.0.1:8088 -t "$HARNESS_ROOT/site" router.php > php.log 2>&1 &
