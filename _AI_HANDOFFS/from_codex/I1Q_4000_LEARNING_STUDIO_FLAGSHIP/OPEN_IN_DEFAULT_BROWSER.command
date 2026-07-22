#!/bin/sh
set -eu
PACKAGE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
exec "$PACKAGE_DIR/launcher-integrity.sh" launch --config "$PACKAGE_DIR/prototype.launch.json" --browser default --pause-on-error
