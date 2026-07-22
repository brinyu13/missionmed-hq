#!/bin/sh

set -u

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P) || exit 70

CONFIG_PATH=""
EXPECT_CONFIG=0
for argument in "$@"; do
  if [ "$EXPECT_CONFIG" -eq 1 ]; then
    CONFIG_PATH=$argument
    EXPECT_CONFIG=0
  elif [ "$argument" = "--config" ]; then
    EXPECT_CONFIG=1
  fi
done

node_works() {
  [ -x "$1" ] && "$1" -e '
    const fs = require("node:fs");
    const current = process.versions.node.split(".").map(Number);
    let minimum = [20, 0, 0];
    if (process.argv[1]) {
      try {
        const configured = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
        if (typeof configured?.node?.minimumVersion === "string") {
          const parsed = configured.node.minimumVersion.match(/^(\d+)\.(\d+)\.(\d+)/);
          if (parsed) minimum = parsed.slice(1).map(Number);
        }
      } catch {}
    }
    for (let index = 0; index < 3; index += 1) {
      if (current[index] > minimum[index]) process.exit(0);
      if (current[index] < minimum[index]) process.exit(1);
    }
    process.exit(0);
  ' "$CONFIG_PATH" >/dev/null 2>&1
}

NODE_PATH=""
if [ -n "${MISSIONMED_NODE:-}" ] && node_works "$MISSIONMED_NODE"; then
  NODE_PATH=$MISSIONMED_NODE
elif command -v node >/dev/null 2>&1 && node_works "$(command -v node)"; then
  NODE_PATH=$(command -v node)
else
  for candidate in \
    /opt/homebrew/bin/node \
    /usr/local/bin/node \
    "$HOME/.volta/bin/node" \
    "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
  do
    if node_works "$candidate"; then
      NODE_PATH=$candidate
      break
    fi
  done
fi

if [ -z "$NODE_PATH" ]; then
  printf '\nMissionMed Prototype Launcher\n'
  printf 'Could not find an approved Node.js runtime compatible with this prototype.\n'
  printf 'Code: MMPL-RUNTIME-001\n'
  printf 'No install or unrelated server change was attempted.\n'
  if [ -t 0 ] && [ "${CI:-}" != "true" ]; then
    printf 'Press Return to close this window.\n'
    IFS= read -r _answer
  fi
  exit 69
fi

NODE_DIRECTORY=$(dirname -- "$NODE_PATH")
PATH="$NODE_DIRECTORY:$PATH"
export PATH

exec "$NODE_PATH" "$SCRIPT_DIR/missionmed-prototype-launcher.mjs" "$@"
