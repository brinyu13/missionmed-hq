#!/usr/bin/env bash
set -euo pipefail
umask 077

PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPOSITORY_DIR="$(cd "$PACKAGE_DIR/.." && pwd)"
BASE_LEDGER_COUNT=23
MIGRATION=20260812120000_b1_515_v201_reviews_collections_peer.sql
EXPECTED_TABLES=(sf_story_trash sf_story_use_reviews sf_story_publications sf_peer_story_grants sf_peer_feedback)
EXPECTED_FLAGS=(story_archive story_promotions per_use_scoring peer_share)
FLAG_TIMESTAMP='2026-08-12 12:00:00+00'

fail(){ printf 'Refusing B1-515 production migration: %s\n' "$*" >&2; exit 1; }
sha256_file(){ if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1"|awk '{print $1}'; else shasum -a 256 "$1"|awk '{print $1}'; fi; }
sha256_stream(){ if command -v sha256sum >/dev/null 2>&1; then sha256sum|awk '{print $1}'; else shasum -a 256|awk '{print $1}'; fi; }

[[ $# = 1 ]] || fail 'usage: apply-b1-515-production-migration.sh preflight|apply'
mode="$1"; [[ "$mode" = preflight || "$mode" = apply ]] || fail 'mode must be preflight or apply'
required=(
  STORYFORGE_DATABASE_URL STORYFORGE_DEPLOY_GIT_COMMIT STORYFORGE_RAILWAY_BACKUP_ID
  STORYFORGE_DB_BACKUP_PATH STORYFORGE_DB_BACKUP_SHA256
  STORYFORGE_KINSTA_BACKUP_RECEIPT STORYFORGE_KINSTA_BACKUP_RECEIPT_SHA256
  STORYFORGE_KINSTA_SNAPSHOT_RECEIPT STORYFORGE_KINSTA_SNAPSHOT_RECEIPT_SHA256
  STORYFORGE_EXPECTED_DB_SYSTEM_IDENTIFIER STORYFORGE_EXPECTED_USER_COUNT STORYFORGE_EXPECTED_STORY_COUNT
  STORYFORGE_SURVIVAL_PRE_MANIFEST STORYFORGE_SURVIVAL_POST_MANIFEST
  STORYFORGE_SURVIVAL_COMPARE_REPORT STORYFORGE_SURVIVAL_EVIDENCE_ROOT
)
for name in "${required[@]}"; do [[ -n "${!name:-}" ]] || fail "$name is required"; done
[[ "$STORYFORGE_DEPLOY_GIT_COMMIT" =~ ^[a-f0-9]{40}$ ]] || fail 'deploy commit is invalid'
[[ "$STORYFORGE_DB_BACKUP_SHA256" =~ ^[a-f0-9]{64}$ ]] || fail 'database backup hash is invalid'
[[ "$STORYFORGE_KINSTA_BACKUP_RECEIPT_SHA256" =~ ^[a-f0-9]{64}$ ]] || fail 'Kinsta backup receipt hash is invalid'
[[ "$STORYFORGE_KINSTA_SNAPSHOT_RECEIPT_SHA256" =~ ^[a-f0-9]{64}$ ]] || fail 'Kinsta snapshot receipt hash is invalid'
[[ "$STORYFORGE_EXPECTED_DB_SYSTEM_IDENTIFIER" =~ ^[0-9]{16,24}$ ]] || fail 'database system identifier is invalid'
[[ "$STORYFORGE_EXPECTED_USER_COUNT" =~ ^[0-9]+$ && "$STORYFORGE_EXPECTED_STORY_COUNT" =~ ^[0-9]+$ ]] || fail 'expected counts are invalid'
for spec in \
  "$STORYFORGE_DB_BACKUP_PATH:$STORYFORGE_DB_BACKUP_SHA256" \
  "$STORYFORGE_KINSTA_BACKUP_RECEIPT:$STORYFORGE_KINSTA_BACKUP_RECEIPT_SHA256" \
  "$STORYFORGE_KINSTA_SNAPSHOT_RECEIPT:$STORYFORGE_KINSTA_SNAPSHOT_RECEIPT_SHA256"; do
  file="${spec%:*}"; expected="${spec##*:}"
  [[ -f "$file" && ! -L "$file" ]] || fail "recovery evidence is absent or symlinked: $file"
  [[ "$(sha256_file "$file")" = "$expected" ]] || fail "recovery evidence hash differs: $file"
done
[[ -f "$STORYFORGE_SURVIVAL_PRE_MANIFEST" && ! -L "$STORYFORGE_SURVIVAL_PRE_MANIFEST" ]] || fail 'PRE survival manifest is absent or symlinked'

actual_head="$(git -C "$REPOSITORY_DIR" rev-parse HEAD^{commit})"
[[ "$actual_head" = "$STORYFORGE_DEPLOY_GIT_COMMIT" ]] || fail 'Git HEAD differs from deploy commit'
[[ -z "$(git -C "$REPOSITORY_DIR" status --porcelain=v1 --untracked-files=all)" ]] || fail 'Git worktree is not clean'
migration_path="$PACKAGE_DIR/infra/postgres/migrations/$MIGRATION"
[[ -f "$migration_path" && ! -L "$migration_path" ]] || fail 'B1-515 migration is absent or symlinked'
migration_hash="$(sha256_file "$migration_path")"
committed_hash="$(git -C "$REPOSITORY_DIR" show "$actual_head:storyforge-v5/infra/postgres/migrations/$MIGRATION" | sha256_stream)"
[[ "$migration_hash" = "$committed_hash" ]] || fail 'migration differs from deploy commit'
train_hash="$(printf '%s\n' "$MIGRATION|$migration_hash" | sha256_stream)"
node - "$STORYFORGE_SURVIVAL_PRE_MANIFEST" "$train_hash" <<'NODE'
const fs=require('node:fs');const manifest=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
if(manifest?.schema!=='missionmed.storyforge.survival-manifest.v3'||manifest?.capture?.phase!=='pre'||manifest?.capture?.candidateSha256!==process.argv[3]||manifest?.capture?.fullVisibility!==true||manifest?.capture?.objectVerification!=='required_pass')process.exit(41);
NODE
[[ $? = 0 ]] || fail 'PRE survival manifest does not bind the exact B1-515 migration'

psql_bin="$(command -v psql || true)"; [[ -n "$psql_bin" && "$psql_bin" = /* && -x "$psql_bin" ]] || fail 'psql is unavailable'
[[ "$($psql_bin --version|sed -E 's/^psql \(PostgreSQL\) ([0-9]+).*/\1/')" = 18 ]] || fail 'PostgreSQL 18 psql is required'
database_url="$STORYFORGE_DATABASE_URL"; unset STORYFORGE_DATABASE_URL PGHOST PGPORT PGUSER PGPASSWORD PGHOSTADDR PGSERVICE PGSERVICEFILE
export PGSSLMODE=require
psql_read=("$psql_bin" --dbname="$database_url" -X -v ON_ERROR_STOP=1)
identity="$("${psql_read[@]}" -AtF '|' -c "SELECT (SELECT system_identifier::text FROM pg_control_system()),coalesce((SELECT ssl::text FROM pg_stat_ssl WHERE pid=pg_backend_pid()),'false')")"
[[ "$identity" = "$STORYFORGE_EXPECTED_DB_SYSTEM_IDENTIFIER|true" ]] || fail 'database identity or TLS differs'
counts="$("${psql_read[@]}" -AtF '|' -c 'SELECT (SELECT count(*) FROM public.sf_users),(SELECT count(*) FROM public.sf_stories)')"
[[ "$counts" = "$STORYFORGE_EXPECTED_USER_COUNT|$STORYFORGE_EXPECTED_STORY_COUNT" ]] || fail 'protected production counts differ from the frozen PRE state'
[[ "$("${psql_read[@]}" -Atc 'SELECT count(*) FROM public.sf_schema_migrations')" = "$BASE_LEDGER_COUNT" ]] || fail 'migration ledger is not the exact B1-514 V2 baseline'
version="${MIGRATION%%_*}"
[[ -z "$("${psql_read[@]}" -Atc "SELECT version FROM public.sf_schema_migrations WHERE version='$version'")" ]] || fail 'B1-515 migration is already present'
founder_id="$("${psql_read[@]}" -Atc "SELECT updated_by FROM public.sf_feature_flags WHERE key='admin_console'")"
[[ "$founder_id" =~ ^[a-f0-9-]{36}$ ]] || fail 'canonical feature-flag authority is absent'
for key in "${EXPECTED_FLAGS[@]}"; do
  [[ -z "$("${psql_read[@]}" -Atc "SELECT key FROM public.sf_feature_flags WHERE key='$key'")" ]] || fail "B1-515 feature flag already exists: $key"
done

if [[ "$mode" = preflight ]]; then
  printf 'B1_515_PRODUCTION_MIGRATION_PREFLIGHT_PASS\ntrain_sha256=%s\npending=1\n' "$train_hash"
  exit 0
fi
[[ "${STORYFORGE_MIGRATION_CONFIRM:-}" = B1-515-APPLY ]] || fail 'apply confirmation is absent'
{
  printf '%s\n' "SELECT pg_advisory_xact_lock(hashtextextended('missionmed.storyforge.b1-515.production-migration',0));"
  sed -E -e '/^[[:space:]]*\\set /d' -e '/^[[:space:]]*BEGIN;[[:space:]]*$/d' -e '/^[[:space:]]*COMMIT;[[:space:]]*$/d' "$migration_path"
  printf "INSERT INTO public.sf_schema_migrations(version,file_name,sha256,git_commit,backup_id) VALUES('%s','%s','%s','%s','%s');\n" "$version" "$MIGRATION" "$migration_hash" "$STORYFORGE_DEPLOY_GIT_COMMIT" "$STORYFORGE_RAILWAY_BACKUP_ID"
} | "$psql_bin" --dbname="$database_url" -X -v ON_ERROR_STOP=1 --single-transaction

post_counts="$("${psql_read[@]}" -AtF '|' -c 'SELECT (SELECT count(*) FROM public.sf_users),(SELECT count(*) FROM public.sf_stories)')"
[[ "$post_counts" = "$counts" ]] || fail 'protected user or story counts changed during B1-515 migration'
for table in "${EXPECTED_TABLES[@]}"; do
  [[ "$("${psql_read[@]}" -Atc "SELECT count(*) FROM public.$table")" = 0 ]] || fail "new B1-515 table is not empty: $table"
done
[[ "$("${psql_read[@]}" -Atc "SELECT count(*) FROM public.sf_feature_flags WHERE key IN('story_archive','story_promotions','per_use_scoring','peer_share') AND scope='off'")" = 4 ]] || fail 'B1-515 flags are not independently default-off'

STORYFORGE_SURVIVAL_DATABASE_URL="$database_url" node "$PACKAGE_DIR/scripts/sf-survival-manifest.mjs" capture \
  --phase post --release B1-515 --candidate-sha256 "$train_hash" \
  --output "$STORYFORGE_SURVIVAL_POST_MANIFEST" --require-object-head
ledger_hash="$(node --input-type=module - "$PACKAGE_DIR" "$version" "$MIGRATION" "$migration_hash" <<'NODE'
import { pathToFileURL } from 'node:url';
const [packageDir,version,file_name,sha256]=process.argv.slice(2);
const { rowHash }=await import(pathToFileURL(`${packageDir}/scripts/survival-manifest-lib.mjs`).href);
process.stdout.write(rowHash({version,file_name,sha256}));
NODE
)"
compare_args=(
  --expected-ledger-addition "$version:$ledger_hash"
  --expected-table-addition sf_story_trash
  --expected-table-addition sf_story_use_reviews
  --expected-table-addition sf_story_publications
  --expected-table-addition sf_peer_story_grants
  --expected-table-addition sf_peer_feedback
)
for key in "${EXPECTED_FLAGS[@]}"; do
  flag_hash="$(node --input-type=module - "$PACKAGE_DIR" "$key" "$founder_id" "$FLAG_TIMESTAMP" <<'NODE'
import { pathToFileURL } from 'node:url';
const [packageDir,key,updated_by,updated_at]=process.argv.slice(2);
const { rowHash }=await import(pathToFileURL(`${packageDir}/scripts/survival-manifest-lib.mjs`).href);
process.stdout.write(rowHash({key,scope:'off',allowlist:[],cohorts:[],updated_by,updated_at}));
NODE
)"
  compare_args+=(--expected-feature-flag-addition "$key:$flag_hash")
done
node "$PACKAGE_DIR/scripts/sf-survival-manifest.mjs" compare \
  --pre "$STORYFORGE_SURVIVAL_PRE_MANIFEST" \
  --post "$STORYFORGE_SURVIVAL_POST_MANIFEST" \
  --output "$STORYFORGE_SURVIVAL_COMPARE_REPORT" "${compare_args[@]}"
printf 'B1_515_PRODUCTION_MIGRATION_APPLY_PASS\ntrain_sha256=%s\n' "$train_hash"
