#!/usr/bin/env bash
# Disposable Unix-socket-only PostgreSQL 18; never connects to a provider.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${IIQ_PG_BIN:-/opt/homebrew/opt/postgresql@18/bin}"
if [[ ! -x "$PG_BIN/initdb" ]]; then
  echo 'Set IIQ_PG_BIN to PostgreSQL 18 bin directory.' >&2; exit 1
fi
if [[ "$("$PG_BIN/postgres" --version)" != *' 18.'* ]]; then
  echo 'PostgreSQL 18 is required for this rehearsal.' >&2; exit 1
fi
RUN_DIR="$(mktemp -d /tmp/iiq-pg18.XXXXXX)"
mkdir "$RUN_DIR/socket"
KEEP=false
cleanup() {
  if [[ "$KEEP" != true ]]; then "$PG_BIN/pg_ctl" -D "$RUN_DIR/data" -m immediate stop >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT INT TERM
"$PG_BIN/initdb" -D "$RUN_DIR/data" -A trust --no-locale -U iiq_test_admin >"$RUN_DIR/init.log"
"$PG_BIN/pg_ctl" -D "$RUN_DIR/data" -l "$RUN_DIR/server.log" -o "-k $RUN_DIR/socket -h '' -p 55432" -w start >/dev/null
export PGHOST="$RUN_DIR/socket" PGPORT=55432 PGUSER=iiq_test_admin PGDATABASE=iiq_test
"$PG_BIN/createdb" "$PGDATABASE"
export IIQ_MIGRATION_DATABASE_URL="postgresql://iiq_test_admin@localhost/iiq_test?host=$RUN_DIR/socket&port=55432"
node "$ROOT/scripts/migrate.mjs" --local --bootstrap >"$RUN_DIR/migration.log"
"$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -c 'CREATE ROLE iiq_runtime_test LOGIN NOINHERIT NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE; GRANT iiq_authenticated TO iiq_runtime_test WITH INHERIT FALSE, SET TRUE; CREATE ROLE iiq_queue_test LOGIN NOINHERIT NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE; GRANT iiq_worker TO iiq_queue_test WITH INHERIT FALSE, SET TRUE;' >"$RUN_DIR/runtime.log"
export IIQ_TEST_DATABASE_URL="postgresql://iiq_runtime_test@localhost/iiq_test?host=$RUN_DIR/socket&port=55432"
export IIQ_TEST_ADMIN_DATABASE_URL="postgresql://iiq_test_admin@localhost/iiq_test?host=$RUN_DIR/socket&port=55432"
export IIQ_TEST_QUEUE_DATABASE_URL="postgresql://iiq_queue_test@localhost/iiq_test?host=$RUN_DIR/socket&port=55432"
node "$ROOT/tests/postgres/migrations.test.mjs" | tee "$RUN_DIR/migration-tests.log"
node "$ROOT/tests/postgres/security.test.mjs" | tee "$RUN_DIR/test.log"
node "$ROOT/tests/domain-review/commands.test.mjs" | tee "$RUN_DIR/domain-tests.log"
if [[ "${1:-}" == '--keep' ]]; then
  KEEP=true
  node --input-type=module - "$RUN_DIR" "$PG_BIN" <<'JS'
import fs from 'node:fs';
const [directory,bin]=process.argv.slice(2);
fs.writeFileSync(`${directory}/connection.json`,JSON.stringify({directory,pgBin:bin,databaseUrl:process.env.IIQ_TEST_DATABASE_URL,adminDatabaseUrl:process.env.IIQ_TEST_ADMIN_DATABASE_URL,queueDatabaseUrl:process.env.IIQ_TEST_QUEUE_DATABASE_URL,syntheticOnly:true,unixSocketOnly:true},null,2));
JS
  echo "Retained synthetic database: $RUN_DIR/connection.json"
else
  echo "Stopped synthetic database; evidence: $RUN_DIR"
fi
