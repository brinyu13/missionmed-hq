#!/usr/bin/env bash
set -euo pipefail
umask 077

PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPOSITORY_DIR="$(cd "$PACKAGE_DIR/.." && pwd)"
BASE_LEDGER_COUNT=13
BASE_MIGRATIONS=(
  20260726150000_b1_500_storyforge_v5_foundation.sql
  20260727170000_b1_502_storyforge_submit_assignment_gate.sql
  20260727190000_b1_502_storyforge_background_preference.sql
  20260728045100_b1_503_story_domain_conformance.sql
  20260728045444_b1_503_interview_mentor_conformance.sql
  20260729000100_b1_506_voice_recording_sessions.sql
  20260729000200_b1_506_feature_flags.sql
  20260729010000_b1_506a_voice_audit_lifecycle.sql
  20260730000100_b1_507b_reconciliation_state.sql
  20260801190000_b1_510i_admin_console.sql
  20260805190000_b1_511_workflow_taxonomy_mentor_notes.sql
  20260806130000_b1_511a_wordpress_admin_authority.sql
  20260806190000_b1_512_concrete_configuration_media.sql
)
MIGRATIONS=(
  20260810190000_b1_514_v2_r1_visibility_consent_activity.sql
  20260810200000_b1_514_v2_r2_story_versions_provenance.sql
  20260810210000_b1_514_v2_r3_inspiration.sql
  20260810220000_b1_514_v2_ra_requests_guest.sql
  20260810230000_b1_514_v2_preferences_environments.sql
  20260810240000_b1_514_v2_ra_lifecycle_completion.sql
  20260810250000_b1_514_v21_authored_segment_writes.sql
  20260810260000_b1_514_guest_voice_contributions.sql
  20260810270000_b1_514_request_delivery_attempts.sql
)

fail(){ printf 'Refusing B1-514 production migration: %s\n' "$*" >&2; exit 1; }
sha256_file(){ if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1"|awk '{print $1}'; else shasum -a 256 "$1"|awk '{print $1}'; fi; }
sha256_stream(){ if command -v sha256sum >/dev/null 2>&1; then sha256sum|awk '{print $1}'; else shasum -a 256|awk '{print $1}'; fi; }

[[ $# = 1 ]] || fail 'usage: apply-b1-514-production-migrations.sh preflight|apply'
mode="$1"; [[ "$mode" = preflight || "$mode" = apply ]] || fail 'mode must be preflight or apply'
required=(STORYFORGE_DATABASE_URL STORYFORGE_DEPLOY_GIT_COMMIT STORYFORGE_DB_BACKUP_ID STORYFORGE_DB_BACKUP_PATH STORYFORGE_DB_BACKUP_SHA256 STORYFORGE_EXPECTED_DB_SYSTEM_IDENTIFIER STORYFORGE_EXPECTED_USER_COUNT STORYFORGE_EXPECTED_STORY_COUNT STORYFORGE_SURVIVAL_PRE_MANIFEST STORYFORGE_SURVIVAL_POST_MANIFEST STORYFORGE_SURVIVAL_COMPARE_REPORT STORYFORGE_SURVIVAL_EVIDENCE_ROOT)
for name in "${required[@]}"; do [[ -n "${!name:-}" ]] || fail "$name is required"; done
[[ "$STORYFORGE_DEPLOY_GIT_COMMIT" =~ ^[a-f0-9]{40}$ ]] || fail 'deploy commit is invalid'
[[ "$STORYFORGE_DB_BACKUP_SHA256" =~ ^[a-f0-9]{64}$ ]] || fail 'backup hash is invalid'
[[ "$STORYFORGE_EXPECTED_DB_SYSTEM_IDENTIFIER" =~ ^[0-9]{16,24}$ ]] || fail 'database system identifier is invalid'
[[ "$STORYFORGE_EXPECTED_USER_COUNT" =~ ^[0-9]+$ && "$STORYFORGE_EXPECTED_STORY_COUNT" =~ ^[0-9]+$ ]] || fail 'expected counts are invalid'
[[ -f "$STORYFORGE_DB_BACKUP_PATH" && ! -L "$STORYFORGE_DB_BACKUP_PATH" ]] || fail 'backup is absent or symlinked'
[[ "$(sha256_file "$STORYFORGE_DB_BACKUP_PATH")" = "$STORYFORGE_DB_BACKUP_SHA256" ]] || fail 'backup hash differs'
[[ -f "$STORYFORGE_SURVIVAL_PRE_MANIFEST" && ! -L "$STORYFORGE_SURVIVAL_PRE_MANIFEST" ]] || fail 'PRE survival manifest is absent or symlinked'

actual_head="$(git -C "$REPOSITORY_DIR" rev-parse HEAD^{commit})"
[[ "$actual_head" = "$STORYFORGE_DEPLOY_GIT_COMMIT" ]] || fail 'Git HEAD differs from deploy commit'
[[ -z "$(git -C "$REPOSITORY_DIR" status --porcelain=v1 --untracked-files=all)" ]] || fail 'Git worktree is not clean'

train_input=''
for migration in "${MIGRATIONS[@]}"; do
  path="$PACKAGE_DIR/infra/postgres/migrations/$migration"
  [[ -f "$path" && ! -L "$path" ]] || fail "migration is absent or symlinked: $migration"
  working_hash="$(sha256_file "$path")"
  committed_hash="$(git -C "$REPOSITORY_DIR" show "$actual_head:storyforge-v5/infra/postgres/migrations/$migration" | sha256_stream)"
  [[ "$working_hash" = "$committed_hash" ]] || fail "migration differs from deploy commit: $migration"
  train_input+="${migration}|${working_hash}"$'\n'
done
train_hash="$(printf '%s' "$train_input" | sha256_stream)"
node - "$STORYFORGE_SURVIVAL_PRE_MANIFEST" "$train_hash" <<'NODE'
const fs=require('node:fs');const manifest=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
if(manifest?.capture?.phase!=='pre'||manifest?.capture?.candidateSha256!==process.argv[3]||manifest?.capture?.fullVisibility!==true||manifest?.capture?.objectVerification!=='required_pass')process.exit(41);
NODE
[[ $? = 0 ]] || fail 'PRE survival manifest does not bind this exact migration train'

psql_bin="$(command -v psql || true)"; [[ -n "$psql_bin" && "$psql_bin" = /* && -x "$psql_bin" ]] || fail 'psql is unavailable'
[[ "$($psql_bin --version|sed -E 's/^psql \(PostgreSQL\) ([0-9]+).*/\1/')" = 18 ]] || fail 'PostgreSQL 18 psql is required'
database_url="$STORYFORGE_DATABASE_URL"; unset STORYFORGE_DATABASE_URL PGHOST PGPORT PGUSER PGPASSWORD PGHOSTADDR PGSERVICE PGSERVICEFILE
export PGSSLMODE=require
psql_read=("$psql_bin" --dbname="$database_url" -X -v ON_ERROR_STOP=1)
identity="$("${psql_read[@]}" -AtF '|' -c "SELECT (SELECT system_identifier::text FROM pg_control_system()),coalesce((SELECT ssl::text FROM pg_stat_ssl WHERE pid=pg_backend_pid()),'false')")"
[[ "$identity" = "$STORYFORGE_EXPECTED_DB_SYSTEM_IDENTIFIER|true" ]] || fail 'database identity or TLS differs'
counts="$("${psql_read[@]}" -AtF '|' -c 'SELECT (SELECT count(*) FROM public.sf_users),(SELECT count(*) FROM public.sf_stories)')"
[[ "$counts" = "$STORYFORGE_EXPECTED_USER_COUNT|$STORYFORGE_EXPECTED_STORY_COUNT" ]] || fail 'protected production counts differ from the frozen preflight'
ledger_count="$("${psql_read[@]}" -Atc 'SELECT count(*) FROM public.sf_schema_migrations')"
[[ "$ledger_count" = "$BASE_LEDGER_COUNT" || "$ledger_count" = "$((BASE_LEDGER_COUNT+${#MIGRATIONS[@]}))" ]] || fail 'migration ledger count differs from the accepted baseline'
for migration in "${BASE_MIGRATIONS[@]}"; do
  version="${migration%%_*}"; path="$PACKAGE_DIR/infra/postgres/migrations/$migration"
  [[ -f "$path" && ! -L "$path" ]] || fail "accepted baseline migration is absent: $migration"
  expected="$migration|$(sha256_file "$path")"
  actual="$("${psql_read[@]}" -AtF '|' -c "SELECT file_name,sha256 FROM public.sf_schema_migrations WHERE version='$version'")"
  [[ "$actual" = "$expected" ]] || fail "accepted baseline ledger differs: $migration"
done
pending=0
for migration in "${MIGRATIONS[@]}"; do
  version="${migration%%_*}"; hash="$(sha256_file "$PACKAGE_DIR/infra/postgres/migrations/$migration")"
  row="$("${psql_read[@]}" -AtF '|' -c "SELECT file_name,sha256,git_commit,backup_id FROM public.sf_schema_migrations WHERE version='$version'")"
  if [[ -z "$row" ]]; then pending=$((pending+1)); else [[ "$row" = "$migration|$hash|$STORYFORGE_DEPLOY_GIT_COMMIT|$STORYFORGE_DB_BACKUP_ID" ]] || fail "ledger row differs: $migration"; fi
done
if [[ "$mode" = preflight ]]; then printf 'B1_514_PRODUCTION_MIGRATION_PREFLIGHT_PASS\ntrain_sha256=%s\npending=%s\n' "$train_hash" "$pending"; exit 0; fi
[[ "${STORYFORGE_MIGRATION_CONFIRM:-}" = B1-514-APPLY ]] || fail 'apply confirmation is absent'
if [[ "$pending" != 0 ]]; then
  [[ "$pending" = "${#MIGRATIONS[@]}" ]] || fail 'partial V2 migration train is not accepted'
  {
    printf '%s\n' "SELECT pg_advisory_xact_lock(hashtextextended('missionmed.storyforge.b1-514.production-migration',0));"
    for migration in "${MIGRATIONS[@]}"; do
      path="$PACKAGE_DIR/infra/postgres/migrations/$migration"; version="${migration%%_*}"; hash="$(sha256_file "$path")"
      sed -E -e '/^[[:space:]]*\\set /d' -e '/^[[:space:]]*BEGIN;[[:space:]]*$/d' -e '/^[[:space:]]*COMMIT;[[:space:]]*$/d' "$path"
      printf "INSERT INTO public.sf_schema_migrations(version,file_name,sha256,git_commit,backup_id) VALUES('%s','%s','%s','%s','%s');\n" "$version" "$migration" "$hash" "$STORYFORGE_DEPLOY_GIT_COMMIT" "$STORYFORGE_DB_BACKUP_ID"
    done
  } | "$psql_bin" --dbname="$database_url" -X -v ON_ERROR_STOP=1 --single-transaction
fi
# Governed libraries are independently idempotent. They are always rerun and
# verified, including after a previous seed interruption or an already-applied
# migration train; a ledger-only success can never bypass these checks.
STORYFORGE_DATABASE_URL="$database_url" node "$PACKAGE_DIR/scripts/seed-inspiration-prompts.mjs"
STORYFORGE_DATABASE_URL="$database_url" node "$PACKAGE_DIR/scripts/seed-contributor-prompts.mjs"
post_counts="$("${psql_read[@]}" -AtF '|' -c 'SELECT (SELECT count(*) FROM public.sf_users),(SELECT count(*) FROM public.sf_stories),(SELECT count(*) FROM public.sf_inspiration_prompts),(SELECT count(*) FROM public.sf_contributor_prompts)')"
[[ "$post_counts" = "$STORYFORGE_EXPECTED_USER_COUNT|$STORYFORGE_EXPECTED_STORY_COUNT|81|48" ]] || fail 'post-migration protected or governed counts differ'
historical_widening="$("${psql_read[@]}" -Atc "SELECT count(*) FROM public.sf_stories WHERE visibility IS NOT NULL")"
[[ "$historical_widening" = 0 ]] || fail 'historical stories were assigned a visibility value'
# Capture and compare the POST state before any release pointer or feature flag
# can move. The comparator permits only the exact migration-ledger additions;
# every protected V1 story, child row, transcript hash, and verified object must
# survive unchanged.
STORYFORGE_SURVIVAL_DATABASE_URL="$database_url" node "$PACKAGE_DIR/scripts/sf-survival-manifest.mjs" capture \
  --phase post --release B1-514 --candidate-sha256 "$train_hash" \
  --output "$STORYFORGE_SURVIVAL_POST_MANIFEST" --require-object-head
ledger_args=()
for migration in "${MIGRATIONS[@]}"; do
  version="${migration%%_*}"; hash="$(sha256_file "$PACKAGE_DIR/infra/postgres/migrations/$migration")"
  ledger_hash="$(node --input-type=module - "$PACKAGE_DIR" "$version" "$migration" "$hash" <<'NODE'
import { pathToFileURL } from 'node:url';
const [packageDir,version,file_name,sha256]=process.argv.slice(2);
const { rowHash } = await import(pathToFileURL(`${packageDir}/scripts/survival-manifest-lib.mjs`).href);
process.stdout.write(rowHash({version,file_name,sha256}));
NODE
)"
  ledger_args+=(--expected-ledger-addition "$version:$ledger_hash")
done
node "$PACKAGE_DIR/scripts/sf-survival-manifest.mjs" compare \
  --pre "$STORYFORGE_SURVIVAL_PRE_MANIFEST" \
  --post "$STORYFORGE_SURVIVAL_POST_MANIFEST" \
  --output "$STORYFORGE_SURVIVAL_COMPARE_REPORT" "${ledger_args[@]}"
printf 'B1_514_PRODUCTION_MIGRATION_APPLY_PASS\ntrain_sha256=%s\n' "$train_hash"
