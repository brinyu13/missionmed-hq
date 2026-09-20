#!/bin/bash
set -e
HARNESS_ROOT="${MMPS_HARNESS_ROOT:-/home/claude/wpdev}"
rm -rf "$HARNESS_ROOT/site/wp-content/plugins/missionmed-file-vault-ps"
cp -r "$HARNESS_ROOT/plugin/missionmed-file-vault-ps" "$HARNESS_ROOT/site/wp-content/plugins/missionmed-file-vault-ps"
