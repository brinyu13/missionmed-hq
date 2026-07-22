#!/bin/sh
set -eu
PACKAGE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
exec "$PACKAGE_DIR/launcher-integrity.sh" stop --config "$PACKAGE_DIR/prototype.launch.json" --pause-on-error
