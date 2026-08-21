#!/usr/bin/env bash
set -euo pipefail
umask 077

PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPOSITORY_DIR="$(cd "$PACKAGE_DIR/.." && pwd)"
BASE_LEDGER_COUNT=29
BASELINE_LATEST_VERSION=20260814120000
BASELINE_LATEST_FILE=20260814120000_b1_515r2_admin_population_avatar_sound.sql
BASELINE_LATEST_SHA256=7d97ecf9fa5d9fec79fd9bc929c169f70912e07ee123574938f416e5b6f71878
MIGRATIONS=(
  20260819220000_b1_515r4_admin_population_scope_repair.sql
  20260820120000_b1_517_myeras_alignment.sql
)
BASELINE_TABLES=(
  sf_account_preferences
  sf_admin_population_settings
  sf_entitlement_population_projection
  sf_entitlement_population_sync_state
)
POPULATED_TABLE_ADDITIONS=(
  sf_eras_profiles
  sf_eras_taxonomy_terms
  sf_eras_legacy_theme_map
)
EMPTY_TABLE_ADDITIONS=(
  sf_story_eras_tags
  sf_myeras_workspaces
  sf_myeras_experiences
  sf_myeras_experience_stories
  sf_myeras_impactful
  sf_story_clinical_case
  sf_story_use_ranks
)
FEATURE_FLAG_ADDITIONS=(
  eras_taxonomy
  myeras_workspace
  clinical_case_metadata
  use_ranking
  myeras_versions
  ai_condensation
)

fail(){ printf 'Refusing B1-517 production migration: %s\n' "$*" >&2; exit 1; }
sha256_file(){ if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1"|awk '{print $1}'; else shasum -a 256 "$1"|awk '{print $1}'; fi; }
sha256_stream(){ if command -v sha256sum >/dev/null 2>&1; then sha256sum|awk '{print $1}'; else shasum -a 256|awk '{print $1}'; fi; }

[[ $# = 1 ]] || fail 'usage: apply-b1-517-production-migrations.sh preflight|apply'
mode="$1"; [[ "$mode" = preflight || "$mode" = apply ]] || fail 'mode must be preflight or apply'
required=(
  STORYFORGE_DATABASE_URL STORYFORGE_DEPLOY_GIT_COMMIT STORYFORGE_RAILWAY_BACKUP_ID
  STORYFORGE_DB_BACKUP_PATH STORYFORGE_DB_BACKUP_SHA256
  STORYFORGE_KINSTA_BACKUP_RECEIPT STORYFORGE_KINSTA_BACKUP_RECEIPT_SHA256
  STORYFORGE_KINSTA_SNAPSHOT_RECEIPT STORYFORGE_KINSTA_SNAPSHOT_RECEIPT_SHA256
  STORYFORGE_EXPECTED_DB_SYSTEM_IDENTIFIER STORYFORGE_EXPECTED_USER_COUNT STORYFORGE_EXPECTED_STORY_COUNT
  STORYFORGE_SURVIVAL_PRE_MANIFEST STORYFORGE_SURVIVAL_POST_MANIFEST
  STORYFORGE_SURVIVAL_COMPARE_REPORT STORYFORGE_SURVIVAL_EVIDENCE_ROOT
  STORYFORGE_CANDIDATE_ADDITIONS_RECEIPT STORYFORGE_CANDIDATE_ADDITIONS_RECEIPT_SHA256
)
for name in "${required[@]}"; do [[ -n "${!name:-}" ]] || fail "$name is required"; done
[[ "$STORYFORGE_DEPLOY_GIT_COMMIT" =~ ^[a-f0-9]{40}$ ]] || fail 'deploy commit is invalid'
for name in STORYFORGE_DB_BACKUP_SHA256 STORYFORGE_KINSTA_BACKUP_RECEIPT_SHA256 \
  STORYFORGE_KINSTA_SNAPSHOT_RECEIPT_SHA256 STORYFORGE_CANDIDATE_ADDITIONS_RECEIPT_SHA256; do
  [[ "${!name}" =~ ^[a-f0-9]{64}$ ]] || fail "$name is invalid"
done
[[ "$STORYFORGE_EXPECTED_DB_SYSTEM_IDENTIFIER" =~ ^[0-9]{16,24}$ ]] || fail 'database system identifier is invalid'
[[ "$STORYFORGE_EXPECTED_USER_COUNT" =~ ^[0-9]+$ && "$STORYFORGE_EXPECTED_STORY_COUNT" =~ ^[0-9]+$ ]] || fail 'expected counts are invalid'
for spec in \
  "$STORYFORGE_DB_BACKUP_PATH:$STORYFORGE_DB_BACKUP_SHA256" \
  "$STORYFORGE_KINSTA_BACKUP_RECEIPT:$STORYFORGE_KINSTA_BACKUP_RECEIPT_SHA256" \
  "$STORYFORGE_KINSTA_SNAPSHOT_RECEIPT:$STORYFORGE_KINSTA_SNAPSHOT_RECEIPT_SHA256" \
  "$STORYFORGE_CANDIDATE_ADDITIONS_RECEIPT:$STORYFORGE_CANDIDATE_ADDITIONS_RECEIPT_SHA256"; do
  file="${spec%:*}"; expected="${spec##*:}"
  [[ -f "$file" && ! -L "$file" ]] || fail "recovery or rehearsal evidence is absent or symlinked: $file"
  [[ "$(sha256_file "$file")" = "$expected" ]] || fail "recovery or rehearsal evidence hash differs: $file"
done
[[ -f "$STORYFORGE_SURVIVAL_PRE_MANIFEST" && ! -L "$STORYFORGE_SURVIVAL_PRE_MANIFEST" ]] || fail 'PRE survival manifest is absent or symlinked'

actual_head="$(git -C "$REPOSITORY_DIR" rev-parse HEAD^{commit})"
[[ "$actual_head" = "$STORYFORGE_DEPLOY_GIT_COMMIT" ]] || fail 'Git HEAD differs from deploy commit'
[[ -z "$(git -C "$REPOSITORY_DIR" status --porcelain=v1 --untracked-files=all)" ]] || fail 'Git worktree is not clean'
migration_paths=(); migration_hashes=(); train_lines=()
for migration in "${MIGRATIONS[@]}"; do
  migration_path="$PACKAGE_DIR/infra/postgres/migrations/$migration"
  [[ -f "$migration_path" && ! -L "$migration_path" ]] || fail "B1-517 migration is absent or symlinked: $migration"
  migration_hash="$(sha256_file "$migration_path")"
  committed_hash="$(git -C "$REPOSITORY_DIR" show "$actual_head:storyforge-v5/infra/postgres/migrations/$migration" | sha256_stream)"
  [[ "$migration_hash" = "$committed_hash" ]] || fail "B1-517 migration differs from deploy commit: $migration"
  migration_paths+=("$migration_path"); migration_hashes+=("$migration_hash")
  train_lines+=("$migration|$migration_hash")
done
train_hash="$(printf '%s\n' "${train_lines[@]}" | sha256_stream)"
node - "$STORYFORGE_SURVIVAL_PRE_MANIFEST" "$STORYFORGE_CANDIDATE_ADDITIONS_RECEIPT" "$train_hash" <<'NODE'
const fs=require('node:fs');
const manifest=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const receipt=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
const candidate=process.argv[4];
if(manifest?.schema!=='missionmed.storyforge.survival-manifest.v3'||manifest?.capture?.phase!=='pre'||manifest?.capture?.candidateSha256!==candidate||manifest?.capture?.fullVisibility!==true||manifest?.capture?.objectVerification!=='required_pass')process.exit(41);
const tables=['sf_eras_profiles','sf_eras_taxonomy_terms','sf_eras_legacy_theme_map'];
const flags=['eras_taxonomy','myeras_workspace','clinical_case_metadata','use_ranking','myeras_versions','ai_condensation'];
const hashes=(value,keys)=>value&&Object.keys(value).sort().join('|')===keys.sort().join('|')&&Object.values(value).every(hash=>/^[a-f0-9]{64}$/.test(hash));
if(receipt?.schema!=='missionmed.storyforge.candidate-additions.v1'||receipt?.candidateSha256!==candidate||!hashes(receipt.tables,tables)||!hashes(receipt.featureFlags,flags))process.exit(42);
NODE
[[ $? = 0 ]] || fail 'PRE survival or isolated candidate-additions receipt does not bind the exact B1-517 train'

psql_bin="$(command -v psql || true)"; [[ -n "$psql_bin" && "$psql_bin" = /* && -x "$psql_bin" ]] || fail 'psql is unavailable'
[[ "$($psql_bin --version|sed -E 's/^psql \(PostgreSQL\) ([0-9]+).*/\1/')" = 18 ]] || fail 'PostgreSQL 18 psql is required'
database_url="$STORYFORGE_DATABASE_URL"; unset STORYFORGE_DATABASE_URL PGHOST PGPORT PGUSER PGPASSWORD PGHOSTADDR PGSERVICE PGSERVICEFILE
export PGSSLMODE=require
psql_read=("$psql_bin" --dbname="$database_url" -X -v ON_ERROR_STOP=1)
identity="$("${psql_read[@]}" -AtF '|' -c "SELECT (SELECT system_identifier::text FROM pg_control_system()),coalesce((SELECT ssl::text FROM pg_stat_ssl WHERE pid=pg_backend_pid()),'false')")"
[[ "$identity" = "$STORYFORGE_EXPECTED_DB_SYSTEM_IDENTIFIER|true" ]] || fail 'database identity or TLS differs'
counts="$("${psql_read[@]}" -AtF '|' -c 'SELECT (SELECT count(*) FROM public.sf_users),(SELECT count(*) FROM public.sf_stories)')"
[[ "$counts" = "$STORYFORGE_EXPECTED_USER_COUNT|$STORYFORGE_EXPECTED_STORY_COUNT" ]] || fail 'protected production counts differ from the frozen PRE state'
[[ "$("${psql_read[@]}" -Atc 'SELECT count(*) FROM public.sf_schema_migrations')" = "$BASE_LEDGER_COUNT" ]] || fail 'migration ledger is not the exact B1-517 production baseline'
baseline_latest="$("${psql_read[@]}" -AtF '|' -c 'SELECT version,file_name,sha256 FROM public.sf_schema_migrations ORDER BY version DESC LIMIT 1')"
[[ "$baseline_latest" = "$BASELINE_LATEST_VERSION|$BASELINE_LATEST_FILE|$BASELINE_LATEST_SHA256" ]] || fail 'latest B1-515R2 migration receipt differs from the exact production baseline'
for migration in "${MIGRATIONS[@]}"; do
  version="${migration%%_*}"
  [[ -z "$("${psql_read[@]}" -Atc "SELECT version FROM public.sf_schema_migrations WHERE version='$version'")" ]] || fail "B1-517 migration is already present: $version"
done
founder_id="$("${psql_read[@]}" -Atc "SELECT updated_by FROM public.sf_feature_flags WHERE key='admin_console'")"
[[ "$founder_id" =~ ^[a-f0-9-]{36}$ ]] || fail 'canonical feature-flag authority is absent'
for table in "${BASELINE_TABLES[@]}"; do
  [[ "$("${psql_read[@]}" -Atc "SELECT to_regclass('public.$table') IS NOT NULL")" = t ]] || fail "B1-515R2 baseline table is absent: $table"
done
for table in "${POPULATED_TABLE_ADDITIONS[@]}" "${EMPTY_TABLE_ADDITIONS[@]}"; do
  [[ "$("${psql_read[@]}" -Atc "SELECT to_regclass('public.$table') IS NULL")" = t ]] || fail "B1-517 candidate table already exists: $table"
done
[[ "$("${psql_read[@]}" -Atc "SELECT count(*) FROM public.sf_feature_flags WHERE key IN('eras_taxonomy','myeras_workspace','clinical_case_metadata','use_ranking','myeras_versions','ai_condensation')")" = 0 ]] || fail 'B1-517 feature flags already exist'

if [[ "$mode" = preflight ]]; then
  printf 'B1_517_PRODUCTION_MIGRATION_PREFLIGHT_PASS\ntrain_sha256=%s\npending=2\n' "$train_hash"
  exit 0
fi
[[ "${STORYFORGE_MIGRATION_CONFIRM:-}" = B1-517-APPLY ]] || fail 'apply confirmation is absent'
{
  printf '%s\n' "SELECT pg_advisory_xact_lock(hashtextextended('missionmed.storyforge.b1-517.production-migrations',0));"
  for index in "${!MIGRATIONS[@]}"; do
    migration="${MIGRATIONS[$index]}"; migration_path="${migration_paths[$index]}"; migration_hash="${migration_hashes[$index]}"; version="${migration%%_*}"
    sed -E -e '/^[[:space:]]*\\set /d' -e '/^[[:space:]]*BEGIN;[[:space:]]*$/d' -e '/^[[:space:]]*COMMIT;[[:space:]]*$/d' "$migration_path"
    printf "INSERT INTO public.sf_schema_migrations(version,file_name,sha256,git_commit,backup_id) VALUES('%s','%s','%s','%s','%s');\n" "$version" "$migration" "$migration_hash" "$STORYFORGE_DEPLOY_GIT_COMMIT" "$STORYFORGE_RAILWAY_BACKUP_ID"
  done
} | "$psql_bin" --dbname="$database_url" -X -v ON_ERROR_STOP=1 -v founder_user_id="$founder_id" --single-transaction

post_counts="$("${psql_read[@]}" -AtF '|' -c 'SELECT (SELECT count(*) FROM public.sf_users),(SELECT count(*) FROM public.sf_stories)')"
[[ "$post_counts" = "$counts" ]] || fail 'protected user or story counts changed during B1-517 migration'
[[ "$("${psql_read[@]}" -AtF '|' -c "SELECT (SELECT count(*) FROM public.sf_eras_profiles),(SELECT count(*) FROM public.sf_eras_taxonomy_terms),(SELECT count(*) FROM public.sf_eras_legacy_theme_map),(SELECT count(*) FROM public.sf_feature_flags WHERE key=ANY(ARRAY['eras_taxonomy','myeras_workspace','clinical_case_metadata','use_ranking','myeras_versions','ai_condensation']) AND scope='off' AND cardinality(allowlist)=0 AND cardinality(cohorts)=0)")" = '1|37|10|6' ]] || fail 'B1-517 governed seed state differs'
STORYFORGE_SURVIVAL_DATABASE_URL="$database_url" node "$PACKAGE_DIR/scripts/sf-survival-manifest.mjs" capture \
  --phase post --release B1-517 --candidate-sha256 "$train_hash" \
  --output "$STORYFORGE_SURVIVAL_POST_MANIFEST" --require-object-head
ledger_args=()
for index in "${!MIGRATIONS[@]}"; do
  migration="${MIGRATIONS[$index]}"; ledger_args+=("${migration%%_*}" "$migration" "${migration_hashes[$index]}")
done
ledger_hashes="$(node --input-type=module - "$PACKAGE_DIR" "${ledger_args[@]}" <<'NODE'
import { pathToFileURL } from 'node:url';
const [packageDir,...args]=process.argv.slice(2);
const { rowHash }=await import(pathToFileURL(`${packageDir}/scripts/survival-manifest-lib.mjs`).href);
for(let index=0;index<args.length;index+=3){const [version,file_name,sha256]=args.slice(index,index+3);process.stdout.write(`${version}:${rowHash({version,file_name,sha256})}\n`)}
NODE
)"
compare_args=()
while IFS= read -r ledger; do [[ -n "$ledger" ]] && compare_args+=(--expected-ledger-addition "$ledger"); done <<< "$ledger_hashes"
for table in "${EMPTY_TABLE_ADDITIONS[@]}"; do compare_args+=(--expected-table-addition "$table"); done
while IFS=$'\t' read -r kind value; do
  case "$kind" in
    table) compare_args+=(--expected-populated-table-addition "$value");;
    flag) compare_args+=(--expected-feature-flag-addition "$value");;
    *) fail 'candidate additions receipt emitted an invalid entry';;
  esac
done < <(node - "$STORYFORGE_CANDIDATE_ADDITIONS_RECEIPT" <<'NODE'
const fs=require('node:fs');const receipt=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
for(const [key,hash] of Object.entries(receipt.tables).sort())process.stdout.write(`table\t${key}:${hash}\n`);
for(const [key,hash] of Object.entries(receipt.featureFlags).sort())process.stdout.write(`flag\t${key}:${hash}\n`);
NODE
)
node "$PACKAGE_DIR/scripts/sf-survival-manifest.mjs" compare \
  --pre "$STORYFORGE_SURVIVAL_PRE_MANIFEST" \
  --post "$STORYFORGE_SURVIVAL_POST_MANIFEST" \
  --output "$STORYFORGE_SURVIVAL_COMPARE_REPORT" \
  "${compare_args[@]}"
printf 'B1_517_PRODUCTION_MIGRATION_APPLY_PASS\ntrain_sha256=%s\n' "$train_hash"
