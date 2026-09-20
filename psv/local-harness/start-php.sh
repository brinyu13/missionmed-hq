#!/bin/bash
cd /home/claude/wpdev/harness
PHP_CLI_SERVER_WORKERS=4 nohup php -d opcache.enable=0 -S 127.0.0.1:8088 -t /home/claude/wpdev/site router.php > php.log 2>&1 &
