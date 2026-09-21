#!/usr/bin/env bash
set -euo pipefail
umask 077

PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPOSITORY_DIR="$(cd "$PACKAGE_DIR/.." && pwd)"
MIGRATION_VERSION=20260921010000
MIGRATION_FILE=20260921010000_b1_5021_ivoc_approved_story_projection.sql
MIGRATION_SHA256=29f3afddf1e4cdf81b30a7b3ad88a24cb28a9ce451951ee4819139e426d6495b

fail(){ printf 'Refusing B1-5021 production migration: %s\n' "$*" >&2; exit 1; }
sha256_file(){ if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1"|awk '{print $1}'; else shasum -a 256 "$1"|awk '{print $1}'; fi; }

[[ $# = 1 ]] || fail 'usage: apply-b1-5021-production-migration.sh preflight|apply'
mode="$1"; [[ "$mode" = preflight || "$mode" = apply ]] || fail 'mode must be preflight or apply'
required=(
  STORYFORGE_DATABASE_URL STORYFORGE_DEPLOY_GIT_COMMIT STORYFORGE_RAILWAY_BACKUP_ID
  STORYFORGE_DB_BACKUP_PATH STORYFORGE_DB_BACKUP_SHA256
  STORYFORGE_EXPECTED_DB_SYSTEM_IDENTIFIER STORYFORGE_EXPECTED_USER_COUNT STORYFORGE_EXPECTED_STORY_COUNT
)
for name in "${required[@]}"; do [[ -n "${!name:-}" ]] || fail "$name is required"; done
[[ "$STORYFORGE_DEPLOY_GIT_COMMIT" =~ ^[a-f0-9]{40}$ ]] || fail 'deploy commit is invalid'
[[ "$STORYFORGE_RAILWAY_BACKUP_ID" =~ ^[A-Za-z0-9._:-]{1,160}$ ]] || fail 'backup ID is invalid'
[[ "$STORYFORGE_DB_BACKUP_SHA256" =~ ^[a-f0-9]{64}$ ]] || fail 'backup hash is invalid'
[[ -f "$STORYFORGE_DB_BACKUP_PATH" && ! -L "$STORYFORGE_DB_BACKUP_PATH" ]] || fail 'backup is absent or symlinked'
[[ "$(sha256_file "$STORYFORGE_DB_BACKUP_PATH")" = "$STORYFORGE_DB_BACKUP_SHA256" ]] || fail 'backup hash differs'
[[ "$STORYFORGE_EXPECTED_DB_SYSTEM_IDENTIFIER" =~ ^[0-9]{16,24}$ ]] || fail 'database identity is invalid'
[[ "$STORYFORGE_EXPECTED_USER_COUNT" =~ ^[0-9]+$ && "$STORYFORGE_EXPECTED_STORY_COUNT" =~ ^[0-9]+$ ]] || fail 'expected counts are invalid'

migration="$PACKAGE_DIR/infra/postgres/migrations/$MIGRATION_FILE"
[[ -f "$migration" && ! -L "$migration" ]] || fail 'migration source is absent or symlinked'
[[ "$(sha256_file "$migration")" = "$MIGRATION_SHA256" ]] || fail 'migration source hash differs'
actual_head="$(git -C "$REPOSITORY_DIR" rev-parse HEAD^{commit})"
[[ "$actual_head" = "$STORYFORGE_DEPLOY_GIT_COMMIT" ]] || fail 'Git HEAD differs from deploy commit'
[[ -z "$(git -C "$REPOSITORY_DIR" status --porcelain=v1 --untracked-files=all)" ]] || fail 'Git worktree is not clean'
[[ "$(git -C "$REPOSITORY_DIR" show "$actual_head:storyforge-v5/infra/postgres/migrations/$MIGRATION_FILE" | sha256_file /dev/stdin)" = "$MIGRATION_SHA256" ]] || fail 'deploy commit does not contain the exact migration'

psql_bin="$(command -v psql || true)"; [[ -n "$psql_bin" && "$psql_bin" = /* && -x "$psql_bin" ]] || fail 'psql is unavailable'
[[ "$($psql_bin --version|sed -E 's/^psql \(PostgreSQL\) ([0-9]+).*/\1/')" = 18 ]] || fail 'PostgreSQL 18 psql is required'
database_url="$STORYFORGE_DATABASE_URL"; unset STORYFORGE_DATABASE_URL PGHOST PGPORT PGUSER PGPASSWORD PGHOSTADDR PGSERVICE PGSERVICEFILE
export PGSSLMODE=require
psql_read=("$psql_bin" --dbname="$database_url" -X -v ON_ERROR_STOP=1)
identity="$("${psql_read[@]}" -AtF '|' -c "SELECT (SELECT system_identifier::text FROM pg_control_system()),coalesce((SELECT ssl::text FROM pg_stat_ssl WHERE pid=pg_backend_pid()),'false')")"
[[ "$identity" = "$STORYFORGE_EXPECTED_DB_SYSTEM_IDENTIFIER|true" ]] || fail 'database identity or TLS differs'
counts="$("${psql_read[@]}" -AtF '|' -c 'SELECT (SELECT count(*) FROM public.sf_users),(SELECT count(*) FROM public.sf_stories)')"
[[ "$counts" = "$STORYFORGE_EXPECTED_USER_COUNT|$STORYFORGE_EXPECTED_STORY_COUNT" ]] || fail 'protected production counts differ from the backup state'
existing="$("${psql_read[@]}" -AtF '|' -c "SELECT version,file_name,sha256,git_commit,backup_id FROM public.sf_schema_migrations WHERE version::bigint=$MIGRATION_VERSION")"
if [[ -n "$existing" ]]; then
  [[ "$existing" = "$MIGRATION_VERSION|$MIGRATION_FILE|$MIGRATION_SHA256|$STORYFORGE_DEPLOY_GIT_COMMIT|$STORYFORGE_RAILWAY_BACKUP_ID" ]] || fail 'existing migration receipt differs'
  printf 'B1_5021_PRODUCTION_MIGRATION_ALREADY_APPLIED_PASS\n'; exit 0
fi
if [[ "$mode" = preflight ]]; then printf 'B1_5021_PRODUCTION_MIGRATION_PREFLIGHT_PASS\npending=1\n'; exit 0; fi
[[ "${STORYFORGE_MIGRATION_CONFIRM:-}" = B1-5021-APPLY ]] || fail 'apply confirmation is absent'
{
  printf '%s\n' "SELECT pg_advisory_xact_lock(hashtextextended('missionmed.storyforge.b1-5021.production-migration',0));"
  sed -E -e '/^[[:space:]]*\\set /d' -e '/^[[:space:]]*BEGIN;[[:space:]]*$/d' -e '/^[[:space:]]*COMMIT;[[:space:]]*$/d' "$migration"
  printf "INSERT INTO public.sf_schema_migrations(version,file_name,sha256,git_commit,backup_id) VALUES('%s','%s','%s','%s','%s');\n" "$MIGRATION_VERSION" "$MIGRATION_FILE" "$MIGRATION_SHA256" "$STORYFORGE_DEPLOY_GIT_COMMIT" "$STORYFORGE_RAILWAY_BACKUP_ID"
} | "$psql_bin" --dbname="$database_url" -X -v ON_ERROR_STOP=1 --single-transaction
[[ "$("${psql_read[@]}" -AtF '|' -c 'SELECT (SELECT count(*) FROM public.sf_users),(SELECT count(*) FROM public.sf_stories)')" = "$counts" ]] || fail 'protected production counts changed during migration'
[[ "$("${psql_read[@]}" -Atc "SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE relname='sf_ivoc_projection_consents'")" = t ]] || fail 'forced RLS verification failed'
[[ "$("${psql_read[@]}" -Atc "SELECT to_regprocedure('public.sf_ivoc_approved_story_projection()') IS NOT NULL")" = t ]] || fail 'projection function verification failed'
printf 'B1_5021_PRODUCTION_MIGRATION_APPLY_PASS\n'
