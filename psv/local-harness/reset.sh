#!/bin/bash
set -e
rm -f /home/claude/wpdev/site/wp-content/database/test.sqlite* /home/claude/wpdev/site/wp-content/debug.log
printf "<?php\ndefine( 'MMED_PS_PROTO_OPENAI_API_KEY', 'local-stub-not-a-real-key' );\n" > /home/claude/wpdev/site/harness-flags.php
/home/claude/wpdev/harness/sync.sh
php /home/claude/wpdev/harness/install.php 2>/dev/null | tail -1
php /home/claude/wpdev/harness/seed.php 2>/dev/null | tail -2
curl -s "http://127.0.0.1:4012/__mode?m=good" > /dev/null
