#!/usr/bin/env bash
set -euo pipefail

PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SF_TMP="$(mktemp -d /tmp/storyforge-v5.pg.XXXXXX)"
SF_PGDATA="$SF_TMP/data"
SF_PGSOCKET="$SF_TMP/socket"
SF_PG_PORT="${STORYFORGE_TEST_PG_PORT:-55439}"

mkdir -p "$SF_PGSOCKET"

cleanup() {
  if [[ -s "$SF_PGDATA/postmaster.pid" ]]; then
    pg_ctl -D "$SF_PGDATA" -m fast stop >/dev/null 2>&1 || true
  fi
  case "$SF_TMP" in
    /tmp/storyforge-v5.pg.*) rm -rf -- "$SF_TMP" ;;
    *) echo "Refusing to remove unexpected temp path: $SF_TMP" >&2 ;;
  esac
}
trap cleanup EXIT INT TERM

initdb -D "$SF_PGDATA" -A trust -U postgres --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$SF_PGDATA" -o "-p $SF_PG_PORT -k $SF_PGSOCKET -h 127.0.0.1" -w start >/dev/null
psql -h 127.0.0.1 -p "$SF_PG_PORT" -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -c "CREATE DATABASE storyforge" >/dev/null

PSQL_ARGS=(-h 127.0.0.1 -p "$SF_PG_PORT" -U postgres -d storyforge -v ON_ERROR_STOP=1)
psql "${PSQL_ARGS[@]}" -f "$PACKAGE_DIR/infra/postgres/bootstrap_local.sql"
while IFS= read -r migration_file; do
  psql "${PSQL_ARGS[@]}" -f "$migration_file"
done < <(find "$PACKAGE_DIR/infra/postgres/migrations" -maxdepth 1 -type f -name '*.sql' | sort)
psql "${PSQL_ARGS[@]}" -f "$PACKAGE_DIR/infra/postgres/seed_local.sql"
psql "${PSQL_ARGS[@]}" -f "$PACKAGE_DIR/tests/postgres/authorization_matrix.sql"
psql "${PSQL_ARGS[@]}" -f "$PACKAGE_DIR/tests/postgres/b1_503_conformance_matrix.sql"
