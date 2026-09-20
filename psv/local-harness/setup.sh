#!/bin/bash
set -euo pipefail

HARNESS_ROOT="${MMPS_HARNESS_ROOT:-/tmp/mmps-wpdev}"
SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SOURCE_DIR/../.." && pwd)"

case "$HARNESS_ROOT" in
	""|"/"|"/tmp") echo "Refusing unsafe MMPS_HARNESS_ROOT: $HARNESS_ROOT" >&2; exit 1 ;;
esac
if [ -e "$HARNESS_ROOT" ]; then
	echo "Harness root already exists; choose a fresh disposable path: $HARNESS_ROOT" >&2
	exit 1
fi

mkdir -p "$HARNESS_ROOT" "$HARNESS_ROOT/harness/files" "$HARNESS_ROOT/harness/shots"
curl --fail --location --silent --show-error https://wordpress.org/latest.tar.gz --output "$HARNESS_ROOT/wordpress.tar.gz"
tar -xzf "$HARNESS_ROOT/wordpress.tar.gz" -C "$HARNESS_ROOT"
mv "$HARNESS_ROOT/wordpress" "$HARNESS_ROOT/site"

curl --fail --location --silent --show-error https://downloads.wordpress.org/plugin/sqlite-database-integration.latest-stable.zip --output "$HARNESS_ROOT/sqlite.zip"
unzip -q "$HARNESS_ROOT/sqlite.zip" -d "$HARNESS_ROOT/site/wp-content/plugins"
cp "$HARNESS_ROOT/site/wp-content/plugins/sqlite-database-integration/db.copy" "$HARNESS_ROOT/site/wp-content/db.php"
perl -pi -e "s#'\{SQLITE_IMPLEMENTATION_FOLDER_PATH\}'#__DIR__.'/plugins/sqlite-database-integration'#g; s#\{SQLITE_PLUGIN\}#sqlite-database-integration/load.php#g" "$HARNESS_ROOT/site/wp-content/db.php"

cp "$SOURCE_DIR/wp-config.harness.php" "$HARNESS_ROOT/site/wp-config.php"
cp -R "$SOURCE_DIR/." "$HARNESS_ROOT/harness/"
mkdir -p "$HARNESS_ROOT/plugin"
cp -R "$REPO_ROOT/wp-content/plugins/missionmed-file-vault-ps" "$HARNESS_ROOT/plugin/missionmed-file-vault-ps"
mkdir -p "$HARNESS_ROOT/site/wp-content/plugins/missionmed-hub" "$HARNESS_ROOT/site/wp-content/database"
cp "$SOURCE_DIR/missionmed-hub-stub.php" "$HARNESS_ROOT/site/wp-content/plugins/missionmed-hub/missionmed-hub.php"
chmod +x "$HARNESS_ROOT/harness/reset.sh" "$HARNESS_ROOT/harness/sync.sh" "$HARNESS_ROOT/harness/start-php.sh"

echo "Disposable PSV harness ready at $HARNESS_ROOT"
