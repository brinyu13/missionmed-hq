#!/bin/bash
set -e
HARNESS_ROOT="${MMPS_HARNESS_ROOT:-/home/claude/wpdev}"
rm -f "$HARNESS_ROOT/site/wp-content/database/test.sqlite" "$HARNESS_ROOT/site/wp-content/database/test.sqlite-shm" "$HARNESS_ROOT/site/wp-content/database/test.sqlite-wal" "$HARNESS_ROOT/site/wp-content/debug.log"
printf "<?php\ndefine( 'MMED_PS_PROTO_OPENAI_API_KEY', 'local-stub-not-a-real-key' );\ndefine( 'MMED_PSV_MISSION_KEY_K1', 'local-stage-a-signing-fixture-not-a-real-secret-0001' );\n" > "$HARNESS_ROOT/site/harness-flags.php"
"$HARNESS_ROOT/harness/sync.sh"
php "$HARNESS_ROOT/harness/install.php" 2>/dev/null | tail -1
php "$HARNESS_ROOT/harness/seed.php" 2>/dev/null | tail -2
curl -s "http://127.0.0.1:4012/__mode?m=good" > /dev/null
