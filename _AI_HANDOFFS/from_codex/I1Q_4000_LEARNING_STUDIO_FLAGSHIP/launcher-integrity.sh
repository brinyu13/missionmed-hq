#!/bin/sh
set -eu
PACKAGE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
if [ ! -r "$PACKAGE_DIR/CHECKSUMS.sha256" ] || ! (cd "$PACKAGE_DIR" && /usr/bin/shasum -a 256 -c CHECKSUMS.sha256 >/dev/null 2>&1); then
  printf '\nMissionMed Prototype Launcher\n'
  printf 'This review package no longer matches its integrity seal.\n'
  printf 'Code: MMPL-INTEGRITY-000\n'
  printf 'Nothing was installed, started, or stopped.\n'
  if [ -t 0 ] && [ "${CI:-}" != "true" ]; then
    printf 'Press Return to close this window.\n'
    IFS= read -r _answer
  fi
  exit 78
fi
if ! (cd "$PACKAGE_DIR" && /usr/bin/shasum -a 256 -c LAUNCHER_FRAMEWORK_CHECKSUMS.sha256 >/dev/null 2>&1); then
  printf '\nMissionMed Prototype Launcher\n'
  printf 'The shared launcher does not match this sealed review package.\n'
  printf 'Code: MMPL-INTEGRITY-001\n'
  printf 'Nothing was installed, started, or stopped.\n'
  if [ -t 0 ] && [ "${CI:-}" != "true" ]; then
    printf 'Press Return to close this window.\n'
    IFS= read -r _answer
  fi
  exit 78
fi
exec "$PACKAGE_DIR/../MMOS_LAUNCHER_001/framework/bootstrap.sh" "$@"
