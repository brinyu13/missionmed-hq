#!/usr/bin/env bash
set -euo pipefail

umask 077

PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPOSITORY_DIR="$(cd "$PACKAGE_DIR/.." && pwd)"
EXPECTED_PROJECT_ID="875e7c17-d06f-4301-a4bb-e61016f153cf"
EXPECTED_ENVIRONMENT_ID="bcef8734-e42b-44df-8488-c2a3de68213f"
EXPECTED_DATABASE_SERVICE_ID="a4a66362-c3ba-475a-ae21-2aa46624bafe"

usage() {
  cat >&2 <<'EOF'
Usage:
  apply-production-migrations.sh preflight|apply

`preflight` performs only local/source/backup/target/ledger reads.
`apply` additionally requires:
  STORYFORGE_MIGRATION_CONFIRM=B1-508-APPLY-M4
  STORYFORGE_FOUNDER_USER_ID=<RP-10-confirmed StoryForge UUID>

The environment contract is documented in:
  _AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/B1-504B_DATABASE_RLS_MIGRATION_SPEC.md
EOF
  exit 2
}

fail() {
  printf 'Refusing B1-506 migration: %s\n' "$*" >&2
  exit 1
}

contains_control() {
  case "$1" in
    *$'\n'*|*$'\r'*|*$'\t'*) return 0 ;;
    *) return 1 ;;
  esac
}

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

sha256_stream() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum | awk '{print $1}'
  else
    shasum -a 256 | awk '{print $1}'
  fi
}

require_regular_file() {
  local label="$1"
  local path="$2"
  [[ -f "$path" && ! -L "$path" ]] || fail "$label is not a regular non-symlink file: $path"
}

[[ $# = 1 ]] || usage
mode="$1"
[[ "$mode" = "preflight" || "$mode" = "apply" ]] || usage

phase_one_safety="$PACKAGE_DIR/scripts/phase-one-release-safety.mjs"
require_regular_file "Phase 1 release safety gate" "$phase_one_safety"
node_bin="$(command -v node || true)"
[[ -n "$node_bin" && "$node_bin" = /* && -x "$node_bin" ]] \
  || fail "Node.js is unavailable for the Phase 1 release safety gate"
"$node_bin" "$phase_one_safety" >/dev/null \
  || fail "Phase 1 release safety gate rejected the migration source"

required_variables=(
  STORYFORGE_RAILWAY_PROJECT_ID
  STORYFORGE_RAILWAY_ENVIRONMENT_ID
  STORYFORGE_RAILWAY_DATABASE_SERVICE_ID
  STORYFORGE_DB_BACKUP_ID
  STORYFORGE_DB_BACKUP_RECEIPT
  STORYFORGE_DB_BACKUP_RECEIPT_SHA256
  STORYFORGE_DEPLOY_GIT_COMMIT
  STORYFORGE_SOURCE_MODE
  STORYFORGE_APP_DB_PASSWORD
  STORYFORGE_EXPECTED_PGHOST
  STORYFORGE_EXPECTED_PGPORT
  STORYFORGE_EXPECTED_PGUSER
  STORYFORGE_EXPECTED_PGDATABASE
  STORYFORGE_EXPECTED_DB_SYSTEM_IDENTIFIER
  STORYFORGE_EXPECTED_USER_COUNT
  STORYFORGE_EXPECTED_ACTIVE_ASSIGNMENT_COUNT
  STORYFORGE_FOUNDER_USER_ID
  RAILWAY_PROJECT_ID
  RAILWAY_ENVIRONMENT_ID
  RAILWAY_SERVICE_ID
  PGHOST
  PGPORT
  PGUSER
  PGPASSWORD
  PGDATABASE
)
for variable_name in "${required_variables[@]}"; do
  [[ -n "${!variable_name:-}" ]] || fail "$variable_name is required"
  contains_control "${!variable_name}" && fail "$variable_name contains a tab or line break"
done

[[ "$STORYFORGE_RAILWAY_PROJECT_ID" = "$EXPECTED_PROJECT_ID" ]] \
  || fail "ticket Railway project ID does not match B1-503 / DR-014 authority"
[[ "$STORYFORGE_RAILWAY_ENVIRONMENT_ID" = "$EXPECTED_ENVIRONMENT_ID" ]] \
  || fail "ticket Railway environment ID does not match B1-503 / DR-014 authority"
[[ "$STORYFORGE_RAILWAY_DATABASE_SERVICE_ID" = "$EXPECTED_DATABASE_SERVICE_ID" ]] \
  || fail "ticket Railway database service ID does not match B1-503 / DR-014 authority"
[[ "$RAILWAY_PROJECT_ID" = "$EXPECTED_PROJECT_ID" ]] \
  || fail "provider-injected RAILWAY_PROJECT_ID does not match the ticket"
[[ "$RAILWAY_ENVIRONMENT_ID" = "$EXPECTED_ENVIRONMENT_ID" ]] \
  || fail "provider-injected RAILWAY_ENVIRONMENT_ID does not match the ticket"
[[ "$RAILWAY_SERVICE_ID" = "$EXPECTED_DATABASE_SERVICE_ID" ]] \
  || fail "provider-injected RAILWAY_SERVICE_ID does not match the database service"

[[ "$STORYFORGE_DEPLOY_GIT_COMMIT" =~ ^[a-f0-9]{40}$ ]] \
  || fail "deploy Git commit must be a full lowercase SHA-1"
[[ "$STORYFORGE_DB_BACKUP_ID" =~ ^[A-Za-z0-9._:-]{1,160}$ ]] \
  || fail "backup ID contains unsupported characters"
[[ "$STORYFORGE_DB_BACKUP_RECEIPT_SHA256" =~ ^[a-f0-9]{64}$ ]] \
  || fail "backup receipt SHA-256 is invalid"
[[ "$STORYFORGE_EXPECTED_PGPORT" =~ ^[1-9][0-9]{0,4}$ ]] \
  || fail "expected PostgreSQL port is invalid"
(( STORYFORGE_EXPECTED_PGPORT <= 65535 )) || fail "expected PostgreSQL port exceeds 65535"
[[ "$STORYFORGE_EXPECTED_DB_SYSTEM_IDENTIFIER" =~ ^[1-9][0-9]{15,24}$ ]] \
  || fail "expected PostgreSQL system identifier is invalid"
[[ "$STORYFORGE_EXPECTED_USER_COUNT" =~ ^[0-9]+$ ]] \
  || fail "expected StoryForge user count is invalid"
[[ "$STORYFORGE_EXPECTED_ACTIVE_ASSIGNMENT_COUNT" =~ ^[0-9]+$ ]] \
  || fail "expected active assignment count is invalid"
[[ "$STORYFORGE_FOUNDER_USER_ID" =~ ^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$ ]] \
  || fail "RP-10 founder StoryForge user ID must be a canonical lowercase UUID"
if (( ${#STORYFORGE_APP_DB_PASSWORD} < 32 )); then
  fail "application database password must be at least 32 characters"
fi
contains_control "$STORYFORGE_APP_DB_PASSWORD" \
  && fail "application database password must be a single-line value without tabs"

[[ "$PGHOST" = "$STORYFORGE_EXPECTED_PGHOST" ]] \
  || fail "PGHOST differs from the explicit target binding"
[[ "$PGPORT" = "$STORYFORGE_EXPECTED_PGPORT" ]] \
  || fail "PGPORT differs from the explicit target binding"
[[ "$PGUSER" = "$STORYFORGE_EXPECTED_PGUSER" ]] \
  || fail "PGUSER differs from the explicit target binding"
[[ "$PGDATABASE" = "$STORYFORGE_EXPECTED_PGDATABASE" ]] \
  || fail "PGDATABASE differs from the explicit target binding"

export PGSSLMODE="${PGSSLMODE:-require}"
[[ "$PGSSLMODE" = "require" || "$PGSSLMODE" = "verify-full" ]] \
  || fail "PGSSLMODE must be require or verify-full"
unset PGHOSTADDR PGSERVICE PGSERVICEFILE

psql_bin="$(command -v psql || true)"
[[ -n "$psql_bin" && "$psql_bin" = /* && -x "$psql_bin" ]] || fail "psql is unavailable"
psql_major="$("$psql_bin" --version | sed -E 's/^psql \(PostgreSQL\) ([0-9]+).*/\1/')"
[[ "$psql_major" = "18" ]] || fail "PostgreSQL 18 psql is required (found major $psql_major)"
psql_read=("$psql_bin" -X -v ON_ERROR_STOP=1)

migrations=(
  "$PACKAGE_DIR/infra/postgres/migrations/20260726150000_b1_500_storyforge_v5_foundation.sql"
  "$PACKAGE_DIR/infra/postgres/migrations/20260727170000_b1_502_storyforge_submit_assignment_gate.sql"
  "$PACKAGE_DIR/infra/postgres/migrations/20260727190000_b1_502_storyforge_background_preference.sql"
  "$PACKAGE_DIR/infra/postgres/migrations/20260728045100_b1_503_story_domain_conformance.sql"
  "$PACKAGE_DIR/infra/postgres/migrations/20260728045444_b1_503_interview_mentor_conformance.sql"
  "$PACKAGE_DIR/infra/postgres/migrations/20260729000100_b1_506_voice_recording_sessions.sql"
  "$PACKAGE_DIR/infra/postgres/migrations/20260729000200_b1_506_feature_flags.sql"
  "$PACKAGE_DIR/infra/postgres/migrations/20260729010000_b1_506a_voice_audit_lifecycle.sql"
  "$PACKAGE_DIR/infra/postgres/migrations/20260730000100_b1_507b_reconciliation_state.sql"
)
expected_versions=(
  "20260726150000"
  "20260727170000"
  "20260727190000"
  "20260728045100"
  "20260728045444"
  "20260729000100"
  "20260729000200"
  "20260729010000"
  "20260730000100"
)
expected_files=(
  "20260726150000_b1_500_storyforge_v5_foundation.sql"
  "20260727170000_b1_502_storyforge_submit_assignment_gate.sql"
  "20260727190000_b1_502_storyforge_background_preference.sql"
  "20260728045100_b1_503_story_domain_conformance.sql"
  "20260728045444_b1_503_interview_mentor_conformance.sql"
  "20260729000100_b1_506_voice_recording_sessions.sql"
  "20260729000200_b1_506_feature_flags.sql"
  "20260729010000_b1_506a_voice_audit_lifecycle.sql"
  "20260730000100_b1_507b_reconciliation_state.sql"
)
expected_hashes=(
  "93018d16582890890ac9ad696cdfd11b5d8118afa55a709725c531a52fae6a1f"
  "95269aeb5a414656c92246ea8e798faac7f0b33d7062540b187f30b8a781315f"
  "ee8ad5cf0a1b850a23c015a07a0f762de2a4b588abbd29a381b35c2db6d79405"
  "fea497dc32a07ac2c05b8ae21caa6b77d85cc4a571b30816432016719a9a8a68"
  "5b3ea347c1dfb36b22cab81ed6042e0d6e10e2786febb67e83214b56dd4071e2"
  "6f6a3340bc29d1222b5f78472eb9a4897739722d090241de6d64f3e8f781c9c2"
  "8899d7d6525c0cbc72790378fcf6a2d8aeb4bc1e7b8afac737be6c3e9af34c3a"
  "e67561cc087e2d71d5d7f65ba3033eff06c0dd328a6e43b3915aa58ba1e74323"
  "ae86a5ea104becf7dff244fa3188338f8ad13eef58190abd47522ca2e2e733d7"
)

for ((index = 0; index < ${#migrations[@]}; index++)); do
  require_regular_file "migration source" "${migrations[$index]}"
  actual_file="$(basename "${migrations[$index]}")"
  actual_version="${actual_file%%_*}"
  actual_hash="$(sha256_file "${migrations[$index]}")"
  [[ "$actual_file" = "${expected_files[$index]}" ]] \
    || fail "migration filename differs at index $index"
  [[ "$actual_version" = "${expected_versions[$index]}" ]] \
    || fail "migration version differs for $actual_file"
  [[ "$actual_hash" = "${expected_hashes[$index]}" ]] \
    || fail "migration source checksum differs for $actual_file"
done

require_regular_file "production bootstrap" "$PACKAGE_DIR/infra/postgres/bootstrap_production.sql"
require_regular_file "migration runner" "$PACKAGE_DIR/scripts/apply-production-migrations.sh"
effective_authority_gate="$PACKAGE_DIR/infra/postgres/verify_b1_506a_effective_authority.sql"
require_regular_file "effective authority gate" "$effective_authority_gate"

source_paths=(
  "storyforge-v5/scripts/apply-production-migrations.sh"
  "storyforge-v5/scripts/phase-one-release-safety.mjs"
  "storyforge-v5/infra/postgres/bootstrap_production.sql"
  "storyforge-v5/infra/postgres/verify_b1_506a_effective_authority.sql"
  "storyforge-v5/infra/postgres/migrations/${expected_files[0]}"
  "storyforge-v5/infra/postgres/migrations/${expected_files[1]}"
  "storyforge-v5/infra/postgres/migrations/${expected_files[2]}"
  "storyforge-v5/infra/postgres/migrations/${expected_files[3]}"
  "storyforge-v5/infra/postgres/migrations/${expected_files[4]}"
  "storyforge-v5/infra/postgres/migrations/${expected_files[5]}"
  "storyforge-v5/infra/postgres/migrations/${expected_files[6]}"
  "storyforge-v5/infra/postgres/migrations/${expected_files[7]}"
  "storyforge-v5/infra/postgres/migrations/${expected_files[8]}"
)

case "$STORYFORGE_SOURCE_MODE" in
  git)
    git_root="$(git -C "$REPOSITORY_DIR" rev-parse --show-toplevel 2>/dev/null)" \
      || fail "source mode git requires a repository"
    [[ "$(realpath "$git_root")" = "$(realpath "$REPOSITORY_DIR")" ]] \
      || fail "Git repository root is not the StoryForge package parent"
    actual_head="$(git -C "$git_root" rev-parse HEAD^{commit})"
    [[ "$actual_head" = "$STORYFORGE_DEPLOY_GIT_COMMIT" ]] \
      || fail "Git HEAD differs from STORYFORGE_DEPLOY_GIT_COMMIT"
    [[ -z "$(git -C "$git_root" status --porcelain=v1 --untracked-files=all)" ]] \
      || fail "Git source is not an exact clean commit"
    flagged_sources="$(
      git -C "$git_root" ls-files -v -- "${source_paths[@]}" \
        | awk '$1 == "S" || $1 ~ /^[a-z]$/ { print $2 }'
    )"
    [[ -z "$flagged_sources" ]] \
      || fail "migration source rejects assume-unchanged or skip-worktree index flags"
    for relative in "${source_paths[@]}"; do
      git -C "$git_root" cat-file -e "$actual_head:$relative" 2>/dev/null \
        || fail "required migration source is absent from the deploy commit: $relative"
      committed_hash="$(git -C "$git_root" show "$actual_head:$relative" | sha256_stream)" \
        || fail "cannot hash committed migration source: $relative"
      [[ "$committed_hash" = "$(sha256_file "$REPOSITORY_DIR/$relative")" ]] \
        || fail "running migration source differs from the deploy commit: $relative"
    done
    ;;
  archive)
    : "${STORYFORGE_SOURCE_ARCHIVE:?STORYFORGE_SOURCE_ARCHIVE is required in archive mode}"
    : "${STORYFORGE_SOURCE_ARCHIVE_SHA256:?STORYFORGE_SOURCE_ARCHIVE_SHA256 is required in archive mode}"
    archive_prefix="${STORYFORGE_SOURCE_ARCHIVE_PREFIX:-}"
    contains_control "$STORYFORGE_SOURCE_ARCHIVE" && fail "source archive path contains control data"
    contains_control "$archive_prefix" && fail "source archive prefix contains control data"
    [[ "$STORYFORGE_SOURCE_ARCHIVE" = /* ]] || fail "source archive path must be absolute"
    [[ "$STORYFORGE_SOURCE_ARCHIVE_SHA256" =~ ^[a-f0-9]{64}$ ]] \
      || fail "source archive SHA-256 is invalid"
    [[ "$archive_prefix" =~ ^([A-Za-z0-9._-]+/)*$ ]] \
      || fail "source archive prefix is unsafe"
    require_regular_file "Git source archive" "$STORYFORGE_SOURCE_ARCHIVE"
    [[ "$(sha256_file "$STORYFORGE_SOURCE_ARCHIVE")" = "$STORYFORGE_SOURCE_ARCHIVE_SHA256" ]] \
      || fail "Git source archive SHA-256 mismatch"
    archive_commit="$(git get-tar-commit-id < "$STORYFORGE_SOURCE_ARCHIVE" 2>/dev/null)" \
      || fail "source archive lacks a Git commit identity"
    [[ "$archive_commit" = "$STORYFORGE_DEPLOY_GIT_COMMIT" ]] \
      || fail "Git archive commit differs from STORYFORGE_DEPLOY_GIT_COMMIT"
    for relative in "${source_paths[@]}"; do
      local_path="$REPOSITORY_DIR/$relative"
      archive_hash="$(tar -xOf "$STORYFORGE_SOURCE_ARCHIVE" "$archive_prefix$relative" | sha256_stream)" \
        || fail "required path is missing from the Git source archive: $relative"
      [[ "$archive_hash" = "$(sha256_file "$local_path")" ]] \
        || fail "running source differs from the committed archive: $relative"
    done
    ;;
  *)
    fail "STORYFORGE_SOURCE_MODE must be git or archive"
    ;;
esac

require_regular_file "database backup receipt" "$STORYFORGE_DB_BACKUP_RECEIPT"
[[ "$(sha256_file "$STORYFORGE_DB_BACKUP_RECEIPT")" = "$STORYFORGE_DB_BACKUP_RECEIPT_SHA256" ]] \
  || fail "database backup receipt SHA-256 mismatch"

backup_format=""
backup_id=""
backup_project_id=""
backup_environment_id=""
backup_service_id=""
backup_volume_instance_id=""
backup_pg_host=""
backup_pg_port=""
backup_pg_database=""
backup_system_identifier=""
backup_dump_sha256=""
backup_pg_dump_major=""
backup_restore_rehearsal=""
backup_locked=""
backup_expires_at=""
backup_created_at=""
backup_field_count=0
while IFS=$'\t' read -r key value extra || [[ -n "$key" ]]; do
  [[ -z "$key" ]] && continue
  case "$key" in
    \#*) continue ;;
  esac
  [[ -n "$key" && -n "$value" && -z "${extra:-}" ]] || fail "database backup receipt has a malformed row"
  contains_control "$key" && fail "database backup receipt key contains control data"
  contains_control "$value" && fail "database backup receipt value contains control data"
  case "$key" in
    format) [[ -z "$backup_format" ]] || fail "duplicate backup field: $key"; backup_format="$value" ;;
    backup_id) [[ -z "$backup_id" ]] || fail "duplicate backup field: $key"; backup_id="$value" ;;
    project_id) [[ -z "$backup_project_id" ]] || fail "duplicate backup field: $key"; backup_project_id="$value" ;;
    environment_id) [[ -z "$backup_environment_id" ]] || fail "duplicate backup field: $key"; backup_environment_id="$value" ;;
    database_service_id) [[ -z "$backup_service_id" ]] || fail "duplicate backup field: $key"; backup_service_id="$value" ;;
    volume_instance_id) [[ -z "$backup_volume_instance_id" ]] || fail "duplicate backup field: $key"; backup_volume_instance_id="$value" ;;
    pg_host) [[ -z "$backup_pg_host" ]] || fail "duplicate backup field: $key"; backup_pg_host="$value" ;;
    pg_port) [[ -z "$backup_pg_port" ]] || fail "duplicate backup field: $key"; backup_pg_port="$value" ;;
    pg_database) [[ -z "$backup_pg_database" ]] || fail "duplicate backup field: $key"; backup_pg_database="$value" ;;
    db_system_identifier) [[ -z "$backup_system_identifier" ]] || fail "duplicate backup field: $key"; backup_system_identifier="$value" ;;
    pg_dump_sha256) [[ -z "$backup_dump_sha256" ]] || fail "duplicate backup field: $key"; backup_dump_sha256="$value" ;;
    pg_dump_major) [[ -z "$backup_pg_dump_major" ]] || fail "duplicate backup field: $key"; backup_pg_dump_major="$value" ;;
    restore_rehearsal) [[ -z "$backup_restore_rehearsal" ]] || fail "duplicate backup field: $key"; backup_restore_rehearsal="$value" ;;
    provider_backup_locked) [[ -z "$backup_locked" ]] || fail "duplicate backup field: $key"; backup_locked="$value" ;;
    provider_backup_expires_at) [[ -z "$backup_expires_at" ]] || fail "duplicate backup field: $key"; backup_expires_at="$value" ;;
    provider_backup_created_at) [[ -z "$backup_created_at" ]] || fail "duplicate backup field: $key"; backup_created_at="$value" ;;
    *) fail "unknown database backup receipt field: $key" ;;
  esac
  backup_field_count=$((backup_field_count + 1))
done < "$STORYFORGE_DB_BACKUP_RECEIPT"

[[ "$backup_field_count" = "16" ]] || fail "database backup receipt must contain exactly 16 fields"
[[ "$backup_format" = "B1-503-DB-BACKUP-V1" ]] || fail "database backup receipt format is unsupported"
[[ "$backup_id" = "$STORYFORGE_DB_BACKUP_ID" ]] || fail "backup receipt ID differs from the requested backup"
[[ "$backup_project_id" = "$EXPECTED_PROJECT_ID" ]] || fail "backup receipt project ID mismatch"
[[ "$backup_environment_id" = "$EXPECTED_ENVIRONMENT_ID" ]] || fail "backup receipt environment ID mismatch"
[[ "$backup_service_id" = "$EXPECTED_DATABASE_SERVICE_ID" ]] || fail "backup receipt service ID mismatch"
[[ "$backup_volume_instance_id" =~ ^[a-f0-9-]{36}$ ]] || fail "backup receipt volume instance ID is invalid"
[[ "$backup_pg_host" = "$STORYFORGE_EXPECTED_PGHOST" ]] || fail "backup receipt PG host mismatch"
[[ "$backup_pg_port" = "$STORYFORGE_EXPECTED_PGPORT" ]] || fail "backup receipt PG port mismatch"
[[ "$backup_pg_database" = "$STORYFORGE_EXPECTED_PGDATABASE" ]] || fail "backup receipt database mismatch"
[[ "$backup_system_identifier" = "$STORYFORGE_EXPECTED_DB_SYSTEM_IDENTIFIER" ]] \
  || fail "backup receipt system identifier mismatch"
[[ "$backup_dump_sha256" =~ ^[a-f0-9]{64}$ ]] || fail "backup receipt dump SHA-256 is invalid"
[[ "$backup_pg_dump_major" = "18" ]] || fail "backup receipt must prove a PostgreSQL 18 dump"
[[ "$backup_restore_rehearsal" = "PASS" ]] || fail "backup receipt must prove restore rehearsal PASS"
[[ "$backup_locked" = "true" ]] || fail "Railway provider backup is not recorded as locked"
[[ "$backup_expires_at" = "null" ]] || fail "Railway provider backup has an expiry"
[[ "$backup_created_at" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,9})?Z$ ]] \
  || fail "provider backup creation time is invalid"

target_identity="$(
  "${psql_read[@]}" -AtF $'\t' -c "
    SELECT current_database(),
           current_user,
           (SELECT system_identifier::text FROM pg_control_system()),
           COALESCE((SELECT ssl::text FROM pg_stat_ssl WHERE pid = pg_backend_pid()), 'false');
  "
)"
IFS=$'\t' read -r actual_database actual_user actual_system_identifier actual_ssl extra <<< "$target_identity"
[[ -z "${extra:-}" ]] || fail "database target identity returned unexpected fields"
[[ "$actual_database" = "$STORYFORGE_EXPECTED_PGDATABASE" ]] || fail "connected database identity mismatch"
[[ "$actual_user" = "$STORYFORGE_EXPECTED_PGUSER" ]] || fail "connected PostgreSQL user mismatch"
[[ "$actual_system_identifier" = "$STORYFORGE_EXPECTED_DB_SYSTEM_IDENTIFIER" ]] \
  || fail "connected PostgreSQL system identifier mismatch"
[[ "$actual_ssl" = "true" ]] || fail "PostgreSQL session is not using SSL"

expected_pre_ledger="$(
  printf '%s|%s|%s\n' \
    "${expected_versions[0]}" "${expected_files[0]}" "${expected_hashes[0]}" \
    "${expected_versions[1]}" "${expected_files[1]}" "${expected_hashes[1]}" \
    "${expected_versions[2]}" "${expected_files[2]}" "${expected_hashes[2]}" \
    "${expected_versions[3]}" "${expected_files[3]}" "${expected_hashes[3]}" \
    "${expected_versions[4]}" "${expected_files[4]}" "${expected_hashes[4]}" \
    "${expected_versions[5]}" "${expected_files[5]}" "${expected_hashes[5]}" \
    "${expected_versions[6]}" "${expected_files[6]}" "${expected_hashes[6]}" \
    "${expected_versions[7]}" "${expected_files[7]}" "${expected_hashes[7]}"
)"
ledger_present="$("${psql_read[@]}" -Atqc "SELECT (to_regclass('public.sf_schema_migrations') IS NOT NULL)::int")"
[[ "$ledger_present" = "1" ]] || fail "the exact B1-503 migration ledger is absent"
actual_pre_ledger="$(
  "${psql_read[@]}" -AtF '|' -c "
    SELECT version, file_name, sha256
    FROM public.sf_schema_migrations
    ORDER BY version;
  "
)"
[[ "$actual_pre_ledger" = "$expected_pre_ledger" ]] \
  || fail "pre-migration ledger is not exactly the eight accepted B1-500 through B1-506A rows"

pre_counts="$(
  "${psql_read[@]}" -AtF '|' -c "
    SELECT
      (SELECT count(*) FROM public.sf_users),
      (SELECT count(*) FROM public.sf_mentor_assignments WHERE active),
      (SELECT count(*) FROM public.sf_users
        WHERE id = '$STORYFORGE_FOUNDER_USER_ID'::uuid);
  "
)"
[[ "$pre_counts" = "$STORYFORGE_EXPECTED_USER_COUNT|$STORYFORGE_EXPECTED_ACTIVE_ASSIGNMENT_COUNT|1" ]] \
  || fail "pre-migration user/assignment counts or RP-10 founder mapping differ from the explicit receipt"

pending_migrations=()
pending_versions=()
pending_files=()
pending_hashes=()
for ((index = 0; index < ${#migrations[@]}; index++)); do
  existing_sha="$(
    "${psql_read[@]}" -At \
      --set=version="${expected_versions[$index]}" \
      <<'SQL'
SELECT sha256
FROM public.sf_schema_migrations
WHERE version = :'version';
SQL
  )"
  if [[ -n "$existing_sha" ]]; then
    [[ "$existing_sha" = "${expected_hashes[$index]}" ]] \
      || fail "applied checksum differs for ${expected_files[$index]}"
    continue
  fi
  pending_migrations+=("${migrations[$index]}")
  pending_versions+=("${expected_versions[$index]}")
  pending_files+=("${expected_files[$index]}")
  pending_hashes+=("${expected_hashes[$index]}")
done

[[ "${#pending_migrations[@]}" = "1" ]] \
  || fail "the exact prestate must leave exactly one B1-507B migration pending"
[[ "${pending_files[0]}" = "${expected_files[8]}" ]] \
  || fail "pending migration set is not exactly the B1-507B M4 forward migration"

if [[ "$mode" = "preflight" ]]; then
  printf '%s\n' "B1_508_PRODUCTION_MIGRATION_PREFLIGHT_PASS"
  printf 'project_id=%s\nenvironment_id=%s\ndatabase_service_id=%s\n' \
    "$EXPECTED_PROJECT_ID" "$EXPECTED_ENVIRONMENT_ID" "$EXPECTED_DATABASE_SERVICE_ID"
  printf 'db_system_identifier=%s\npending_migrations=1\n' "$actual_system_identifier"
  exit 0
fi

[[ "${STORYFORGE_MIGRATION_CONFIRM:-}" = "B1-508-APPLY-M4" ]] \
  || fail "apply mode requires STORYFORGE_MIGRATION_CONFIRM=B1-508-APPLY-M4"

psql_args=(
  -X
  -v ON_ERROR_STOP=1
  --single-transaction
  --set=git_commit="$STORYFORGE_DEPLOY_GIT_COMMIT"
  --set=backup_id="$STORYFORGE_DB_BACKUP_ID"
  --set=founder_user_id="$STORYFORGE_FOUNDER_USER_ID"
)
for ((index = 0; index < ${#pending_migrations[@]}; index++)); do
  psql_args+=(
    --set="version_${index}=${pending_versions[$index]}"
    --set="file_${index}=${pending_files[$index]}"
    --set="sha_${index}=${pending_hashes[$index]}"
  )
done

{
  cat <<'SQL'
\getenv app_password STORYFORGE_APP_DB_PASSWORD
SELECT pg_advisory_xact_lock(hashtextextended('missionmed.storyforge.b1-506.production-migration', 0));
DO $b1_506_pre$
BEGIN
  IF EXISTS (
    (SELECT version, file_name, sha256 FROM public.sf_schema_migrations
     EXCEPT
     VALUES
       ('20260726150000', '20260726150000_b1_500_storyforge_v5_foundation.sql', '93018d16582890890ac9ad696cdfd11b5d8118afa55a709725c531a52fae6a1f'),
       ('20260727170000', '20260727170000_b1_502_storyforge_submit_assignment_gate.sql', '95269aeb5a414656c92246ea8e798faac7f0b33d7062540b187f30b8a781315f'),
       ('20260727190000', '20260727190000_b1_502_storyforge_background_preference.sql', 'ee8ad5cf0a1b850a23c015a07a0f762de2a4b588abbd29a381b35c2db6d79405'),
       ('20260728045100', '20260728045100_b1_503_story_domain_conformance.sql', 'fea497dc32a07ac2c05b8ae21caa6b77d85cc4a571b30816432016719a9a8a68'),
       ('20260728045444', '20260728045444_b1_503_interview_mentor_conformance.sql', '5b3ea347c1dfb36b22cab81ed6042e0d6e10e2786febb67e83214b56dd4071e2'),
       ('20260729000100', '20260729000100_b1_506_voice_recording_sessions.sql', '6f6a3340bc29d1222b5f78472eb9a4897739722d090241de6d64f3e8f781c9c2'),
       ('20260729000200', '20260729000200_b1_506_feature_flags.sql', '8899d7d6525c0cbc72790378fcf6a2d8aeb4bc1e7b8afac737be6c3e9af34c3a'),
       ('20260729010000', '20260729010000_b1_506a_voice_audit_lifecycle.sql', 'e67561cc087e2d71d5d7f65ba3033eff06c0dd328a6e43b3915aa58ba1e74323'))
  ) OR EXISTS (
    (VALUES
       ('20260726150000', '20260726150000_b1_500_storyforge_v5_foundation.sql', '93018d16582890890ac9ad696cdfd11b5d8118afa55a709725c531a52fae6a1f'),
       ('20260727170000', '20260727170000_b1_502_storyforge_submit_assignment_gate.sql', '95269aeb5a414656c92246ea8e798faac7f0b33d7062540b187f30b8a781315f'),
       ('20260727190000', '20260727190000_b1_502_storyforge_background_preference.sql', 'ee8ad5cf0a1b850a23c015a07a0f762de2a4b588abbd29a381b35c2db6d79405'),
       ('20260728045100', '20260728045100_b1_503_story_domain_conformance.sql', 'fea497dc32a07ac2c05b8ae21caa6b77d85cc4a571b30816432016719a9a8a68'),
       ('20260728045444', '20260728045444_b1_503_interview_mentor_conformance.sql', '5b3ea347c1dfb36b22cab81ed6042e0d6e10e2786febb67e83214b56dd4071e2'),
       ('20260729000100', '20260729000100_b1_506_voice_recording_sessions.sql', '6f6a3340bc29d1222b5f78472eb9a4897739722d090241de6d64f3e8f781c9c2'),
       ('20260729000200', '20260729000200_b1_506_feature_flags.sql', '8899d7d6525c0cbc72790378fcf6a2d8aeb4bc1e7b8afac737be6c3e9af34c3a'),
       ('20260729010000', '20260729010000_b1_506a_voice_audit_lifecycle.sql', 'e67561cc087e2d71d5d7f65ba3033eff06c0dd328a6e43b3915aa58ba1e74323')
     EXCEPT
     SELECT version, file_name, sha256 FROM public.sf_schema_migrations)
  ) THEN
    RAISE EXCEPTION 'B1-506 ledger changed after preflight';
  END IF;
END
$b1_506_pre$;
SQL
  cat <<SQL
DO \$b1_506_counts\$
BEGIN
  IF (SELECT count(*) FROM public.sf_users) <> $STORYFORGE_EXPECTED_USER_COUNT
     OR (SELECT count(*) FROM public.sf_mentor_assignments WHERE active)
        <> $STORYFORGE_EXPECTED_ACTIVE_ASSIGNMENT_COUNT THEN
    RAISE EXCEPTION 'B1-506 data counts changed after preflight';
  END IF;
END
\$b1_506_counts\$;
SQL
  sed -E \
    -e '/^[[:space:]]*\\set[[:space:]]+ON_ERROR_STOP[[:space:]]+on[[:space:]]*$/d' \
    -e '/^[[:space:]]*BEGIN;[[:space:]]*$/d' \
    -e '/^[[:space:]]*COMMIT;[[:space:]]*$/d' \
    "$PACKAGE_DIR/infra/postgres/bootstrap_production.sql"
  for ((index = 0; index < ${#pending_migrations[@]}; index++)); do
    sed -E \
      -e '/^[[:space:]]*\\set[[:space:]]+ON_ERROR_STOP[[:space:]]+on[[:space:]]*$/d' \
      -e '/^[[:space:]]*BEGIN;[[:space:]]*$/d' \
      -e '/^[[:space:]]*COMMIT;[[:space:]]*$/d' \
      "${pending_migrations[$index]}"
    printf '%s\n' \
      'INSERT INTO public.sf_schema_migrations' \
      '  (version, file_name, sha256, git_commit, backup_id)' \
      'VALUES' \
      "  (:'version_${index}', :'file_${index}', :'sha_${index}', :'git_commit', :'backup_id');"
  done
  cat <<'SQL'
DO $b1_506_post$
DECLARE
  effective_authority_count integer;
  effective_authority_sha256 text;
BEGIN
  PERFORM pg_catalog.set_config(
    'search_path',
    'pg_catalog, public',
    true
  );
  IF EXISTS (
    (SELECT version, file_name, sha256 FROM public.sf_schema_migrations
     EXCEPT
     VALUES
       ('20260726150000', '20260726150000_b1_500_storyforge_v5_foundation.sql', '93018d16582890890ac9ad696cdfd11b5d8118afa55a709725c531a52fae6a1f'),
       ('20260727170000', '20260727170000_b1_502_storyforge_submit_assignment_gate.sql', '95269aeb5a414656c92246ea8e798faac7f0b33d7062540b187f30b8a781315f'),
       ('20260727190000', '20260727190000_b1_502_storyforge_background_preference.sql', 'ee8ad5cf0a1b850a23c015a07a0f762de2a4b588abbd29a381b35c2db6d79405'),
       ('20260728045100', '20260728045100_b1_503_story_domain_conformance.sql', 'fea497dc32a07ac2c05b8ae21caa6b77d85cc4a571b30816432016719a9a8a68'),
       ('20260728045444', '20260728045444_b1_503_interview_mentor_conformance.sql', '5b3ea347c1dfb36b22cab81ed6042e0d6e10e2786febb67e83214b56dd4071e2'),
       ('20260729000100', '20260729000100_b1_506_voice_recording_sessions.sql', '6f6a3340bc29d1222b5f78472eb9a4897739722d090241de6d64f3e8f781c9c2'),
       ('20260729000200', '20260729000200_b1_506_feature_flags.sql', '8899d7d6525c0cbc72790378fcf6a2d8aeb4bc1e7b8afac737be6c3e9af34c3a'),
       ('20260729010000', '20260729010000_b1_506a_voice_audit_lifecycle.sql', 'e67561cc087e2d71d5d7f65ba3033eff06c0dd328a6e43b3915aa58ba1e74323'),
       ('20260730000100', '20260730000100_b1_507b_reconciliation_state.sql', 'ae86a5ea104becf7dff244fa3188338f8ad13eef58190abd47522ca2e2e733d7'))
  ) OR EXISTS (
    (VALUES
       ('20260726150000', '20260726150000_b1_500_storyforge_v5_foundation.sql', '93018d16582890890ac9ad696cdfd11b5d8118afa55a709725c531a52fae6a1f'),
       ('20260727170000', '20260727170000_b1_502_storyforge_submit_assignment_gate.sql', '95269aeb5a414656c92246ea8e798faac7f0b33d7062540b187f30b8a781315f'),
       ('20260727190000', '20260727190000_b1_502_storyforge_background_preference.sql', 'ee8ad5cf0a1b850a23c015a07a0f762de2a4b588abbd29a381b35c2db6d79405'),
       ('20260728045100', '20260728045100_b1_503_story_domain_conformance.sql', 'fea497dc32a07ac2c05b8ae21caa6b77d85cc4a571b30816432016719a9a8a68'),
       ('20260728045444', '20260728045444_b1_503_interview_mentor_conformance.sql', '5b3ea347c1dfb36b22cab81ed6042e0d6e10e2786febb67e83214b56dd4071e2'),
       ('20260729000100', '20260729000100_b1_506_voice_recording_sessions.sql', '6f6a3340bc29d1222b5f78472eb9a4897739722d090241de6d64f3e8f781c9c2'),
       ('20260729000200', '20260729000200_b1_506_feature_flags.sql', '8899d7d6525c0cbc72790378fcf6a2d8aeb4bc1e7b8afac737be6c3e9af34c3a'),
       ('20260729010000', '20260729010000_b1_506a_voice_audit_lifecycle.sql', 'e67561cc087e2d71d5d7f65ba3033eff06c0dd328a6e43b3915aa58ba1e74323'),
       ('20260730000100', '20260730000100_b1_507b_reconciliation_state.sql', 'ae86a5ea104becf7dff244fa3188338f8ad13eef58190abd47522ca2e2e733d7')
     EXCEPT
     SELECT version, file_name, sha256 FROM public.sf_schema_migrations)
  ) THEN
    RAISE EXCEPTION 'B1-506 post-migration ledger is not exact';
  END IF;
  IF (SELECT count(*) FROM pg_roles
      WHERE rolname = 'storyforge_app'
        AND NOT rolcanlogin
        AND NOT rolsuper
        AND NOT rolcreatedb
        AND NOT rolcreaterole
        AND NOT rolreplication
        AND NOT rolbypassrls
        AND NOT rolinherit
        AND rolconnlimit = -1
        AND rolvaliduntil IS NULL
        AND coalesce(cardinality(rolconfig), 0) = 0) <> 1 THEN
    RAISE EXCEPTION 'B1-506 application role is not exact least privilege before LOGIN';
  END IF;
  IF (SELECT count(*) FROM pg_roles
      WHERE rolname = 'authenticated'
        AND NOT rolcanlogin
        AND NOT rolsuper
        AND NOT rolcreatedb
        AND NOT rolcreaterole
        AND NOT rolreplication
        AND NOT rolbypassrls
        AND NOT rolinherit
        AND rolconnlimit = -1
        AND rolvaliduntil IS NULL
        AND coalesce(cardinality(rolconfig), 0) = 0) <> 1 THEN
    RAISE EXCEPTION 'B1-506 authenticated role is not exact least privilege';
  END IF;
  IF EXISTS (
    (SELECT granted.rolname::text, member_role.rolname::text,
            membership.admin_option,
            membership.inherit_option, membership.set_option
       FROM pg_auth_members membership
       JOIN pg_roles granted ON granted.oid = membership.roleid
       JOIN pg_roles member_role ON member_role.oid = membership.member
      WHERE membership.member IN (
              'storyforge_app'::regrole,
              'authenticated'::regrole
            )
         OR membership.roleid IN (
              'storyforge_app'::regrole,
              'authenticated'::regrole
            )
     EXCEPT
     VALUES ('authenticated'::text, 'storyforge_app'::text, false, false, true))
    UNION ALL
    (VALUES ('authenticated'::text, 'storyforge_app'::text, false, false, true)
     EXCEPT
     SELECT granted.rolname::text, member_role.rolname::text,
            membership.admin_option,
            membership.inherit_option, membership.set_option
       FROM pg_auth_members membership
       JOIN pg_roles granted ON granted.oid = membership.roleid
       JOIN pg_roles member_role ON member_role.oid = membership.member
      WHERE membership.member IN (
              'storyforge_app'::regrole,
              'authenticated'::regrole
            )
         OR membership.roleid IN (
              'storyforge_app'::regrole,
              'authenticated'::regrole
            ))
  ) THEN
    RAISE EXCEPTION 'B1-506 application role membership closure is not exact';
  END IF;
  IF EXISTS (
    (SELECT namespace.nspname::text, relation.relname::text,
            acl.privilege_type::text, acl.is_grantable
       FROM pg_class relation
       JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
       CROSS JOIN LATERAL aclexplode(relation.relacl) acl
      WHERE acl.grantee = 'storyforge_app'::regrole
     EXCEPT
     VALUES
       ('public'::text, 'sf_recording_sessions'::text, 'SELECT'::text, false),
       ('public'::text, 'sf_recording_sessions'::text, 'INSERT'::text, false),
       ('public'::text, 'sf_recording_sessions'::text, 'UPDATE'::text, false),
       ('public'::text, 'sf_recording_sessions'::text, 'DELETE'::text, false),
       ('public'::text, 'sf_recording_segments'::text, 'SELECT'::text, false),
       ('public'::text, 'sf_recording_segments'::text, 'INSERT'::text, false),
       ('public'::text, 'sf_recording_segments'::text, 'UPDATE'::text, false),
       ('public'::text, 'sf_recording_segments'::text, 'DELETE'::text, false),
       ('public'::text, 'sf_feature_flags'::text, 'SELECT'::text, false),
       ('public'::text, 'sf_audio_deletion_intents'::text, 'SELECT'::text, false),
       ('public'::text, 'sf_audio_deletion_intents'::text, 'INSERT'::text, false),
       ('public'::text, 'sf_audio_deletion_intents'::text, 'UPDATE'::text, false),
       ('public'::text, 'sf_reconciliation_runs'::text, 'SELECT'::text, false),
       ('public'::text, 'sf_reconciliation_runs'::text, 'INSERT'::text, false),
       ('public'::text, 'sf_reconciliation_runs'::text, 'UPDATE'::text, false),
       ('public'::text, 'sf_reconciliation_state'::text, 'SELECT'::text, false),
       ('public'::text, 'sf_reconciliation_state'::text, 'UPDATE'::text, false))
    UNION ALL
    (VALUES
       ('public'::text, 'sf_recording_sessions'::text, 'SELECT'::text, false),
       ('public'::text, 'sf_recording_sessions'::text, 'INSERT'::text, false),
       ('public'::text, 'sf_recording_sessions'::text, 'UPDATE'::text, false),
       ('public'::text, 'sf_recording_sessions'::text, 'DELETE'::text, false),
       ('public'::text, 'sf_recording_segments'::text, 'SELECT'::text, false),
       ('public'::text, 'sf_recording_segments'::text, 'INSERT'::text, false),
       ('public'::text, 'sf_recording_segments'::text, 'UPDATE'::text, false),
       ('public'::text, 'sf_recording_segments'::text, 'DELETE'::text, false),
       ('public'::text, 'sf_feature_flags'::text, 'SELECT'::text, false),
       ('public'::text, 'sf_audio_deletion_intents'::text, 'SELECT'::text, false),
       ('public'::text, 'sf_audio_deletion_intents'::text, 'INSERT'::text, false),
       ('public'::text, 'sf_audio_deletion_intents'::text, 'UPDATE'::text, false),
       ('public'::text, 'sf_reconciliation_runs'::text, 'SELECT'::text, false),
       ('public'::text, 'sf_reconciliation_runs'::text, 'INSERT'::text, false),
       ('public'::text, 'sf_reconciliation_runs'::text, 'UPDATE'::text, false),
       ('public'::text, 'sf_reconciliation_state'::text, 'SELECT'::text, false),
       ('public'::text, 'sf_reconciliation_state'::text, 'UPDATE'::text, false)
     EXCEPT
     SELECT namespace.nspname::text, relation.relname::text,
            acl.privilege_type::text, acl.is_grantable
       FROM pg_class relation
       JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
       CROSS JOIN LATERAL aclexplode(relation.relacl) acl
      WHERE acl.grantee = 'storyforge_app'::regrole)
  ) THEN
    RAISE EXCEPTION 'B1-506 application role relation ACL closure is not exact';
  END IF;
  IF EXISTS (
    (SELECT namespace.nspname::text, routine.proname::text,
            oidvectortypes(routine.proargtypes)::text,
            acl.privilege_type::text, acl.is_grantable
       FROM pg_proc routine
       JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
       CROSS JOIN LATERAL aclexplode(routine.proacl) acl
      WHERE acl.grantee = 'storyforge_app'::regrole
     EXCEPT
     VALUES
       ('public'::text, 'sf_append_voice_audit_service'::text,
        'text, text, uuid, uuid, uuid, jsonb, jsonb'::text, 'EXECUTE'::text, false),
       ('public'::text, 'sf_voice_sweep_candidates'::text,
        'integer'::text, 'EXECUTE'::text, false),
       ('public'::text, 'sf_voice_sweep_purge'::text,
        'uuid, text'::text, 'EXECUTE'::text, false),
       ('public'::text, 'sf_voice_asset_pending_candidates'::text,
        'integer'::text, 'EXECUTE'::text, false),
       ('public'::text, 'sf_voice_asset_mark_verified'::text,
        'uuid, bigint, text'::text, 'EXECUTE'::text, false),
       ('public'::text, 'sf_voice_asset_mark_failed'::text,
        'uuid'::text, 'EXECUTE'::text, false),
       ('public'::text, 'sf_voice_audio_reference_check'::text,
        'text[]'::text, 'EXECUTE'::text, false),
       ('public'::text, 'sf_reconciliation_sweep_old_runs'::text,
        ''::text, 'EXECUTE'::text, false))
    UNION ALL
    (VALUES
       ('public'::text, 'sf_append_voice_audit_service'::text,
        'text, text, uuid, uuid, uuid, jsonb, jsonb'::text, 'EXECUTE'::text, false),
       ('public'::text, 'sf_voice_sweep_candidates'::text,
        'integer'::text, 'EXECUTE'::text, false),
       ('public'::text, 'sf_voice_sweep_purge'::text,
        'uuid, text'::text, 'EXECUTE'::text, false),
       ('public'::text, 'sf_voice_asset_pending_candidates'::text,
        'integer'::text, 'EXECUTE'::text, false),
       ('public'::text, 'sf_voice_asset_mark_verified'::text,
        'uuid, bigint, text'::text, 'EXECUTE'::text, false),
       ('public'::text, 'sf_voice_asset_mark_failed'::text,
        'uuid'::text, 'EXECUTE'::text, false),
       ('public'::text, 'sf_voice_audio_reference_check'::text,
        'text[]'::text, 'EXECUTE'::text, false),
       ('public'::text, 'sf_reconciliation_sweep_old_runs'::text,
        ''::text, 'EXECUTE'::text, false)
     EXCEPT
     SELECT namespace.nspname::text, routine.proname::text,
            oidvectortypes(routine.proargtypes)::text,
            acl.privilege_type::text, acl.is_grantable
       FROM pg_proc routine
       JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
       CROSS JOIN LATERAL aclexplode(routine.proacl) acl
      WHERE acl.grantee = 'storyforge_app'::regrole)
  ) THEN
    RAISE EXCEPTION 'B1-506 application role routine ACL closure is not exact';
  END IF;
  IF EXISTS (
    (SELECT namespace.nspname::text, relation.relname::text,
            policy.polname::text, policy.polcmd::text, policy.polpermissive
       FROM pg_policy policy
       JOIN pg_class relation ON relation.oid = policy.polrelid
       JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE 'storyforge_app'::regrole = ANY (policy.polroles)
     EXCEPT
     VALUES
       ('public'::text, 'sf_recording_sessions'::text,
        'sf_recording_sessions_service'::text, '*'::text, true),
       ('public'::text, 'sf_recording_segments'::text,
        'sf_recording_segments_service'::text, '*'::text, true),
       ('public'::text, 'sf_feature_flags'::text,
        'sf_feature_flags_service_read'::text, 'r'::text, true),
       ('public'::text, 'sf_audio_deletion_intents'::text,
        'sf_deletion_intents_service'::text, '*'::text, true),
       ('public'::text, 'sf_reconciliation_runs'::text,
        'sf_reconciliation_runs_service'::text, '*'::text, true),
       ('public'::text, 'sf_reconciliation_state'::text,
        'sf_reconciliation_state_service'::text, '*'::text, true))
    UNION ALL
    (VALUES
       ('public'::text, 'sf_recording_sessions'::text,
        'sf_recording_sessions_service'::text, '*'::text, true),
       ('public'::text, 'sf_recording_segments'::text,
        'sf_recording_segments_service'::text, '*'::text, true),
       ('public'::text, 'sf_feature_flags'::text,
        'sf_feature_flags_service_read'::text, 'r'::text, true),
       ('public'::text, 'sf_audio_deletion_intents'::text,
        'sf_deletion_intents_service'::text, '*'::text, true),
       ('public'::text, 'sf_reconciliation_runs'::text,
        'sf_reconciliation_runs_service'::text, '*'::text, true),
       ('public'::text, 'sf_reconciliation_state'::text,
        'sf_reconciliation_state_service'::text, '*'::text, true)
     EXCEPT
     SELECT namespace.nspname::text, relation.relname::text,
            policy.polname::text, policy.polcmd::text, policy.polpermissive
       FROM pg_policy policy
       JOIN pg_class relation ON relation.oid = policy.polrelid
       JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE 'storyforge_app'::regrole = ANY (policy.polroles))
  ) THEN
    RAISE EXCEPTION 'B1-506 application role policy closure is not exact';
  END IF;
  IF EXISTS (
    (SELECT dependency.dbid, dependency.classid, dependency.objid, dependency.objsubid,
            dependency.deptype::text
       FROM pg_shdepend dependency
      WHERE dependency.refclassid = 'pg_authid'::regclass
        AND dependency.refobjid = 'storyforge_app'::regrole
        AND dependency.deptype IN ('a', 'o')
     EXCEPT
     VALUES
       ((SELECT oid FROM pg_database WHERE datname = current_database()),
        'pg_class'::regclass::oid, 'public.sf_recording_sessions'::regclass::oid, 0, 'a'::text),
       ((SELECT oid FROM pg_database WHERE datname = current_database()),
        'pg_class'::regclass::oid, 'public.sf_recording_segments'::regclass::oid, 0, 'a'::text),
       ((SELECT oid FROM pg_database WHERE datname = current_database()),
        'pg_class'::regclass::oid, 'public.sf_feature_flags'::regclass::oid, 0, 'a'::text),
       ((SELECT oid FROM pg_database WHERE datname = current_database()),
        'pg_class'::regclass::oid, 'public.sf_audio_deletion_intents'::regclass::oid, 0, 'a'::text),
       ((SELECT oid FROM pg_database WHERE datname = current_database()),
        'pg_class'::regclass::oid, 'public.sf_reconciliation_runs'::regclass::oid, 0, 'a'::text),
       ((SELECT oid FROM pg_database WHERE datname = current_database()),
        'pg_class'::regclass::oid, 'public.sf_reconciliation_state'::regclass::oid, 0, 'a'::text),
       ((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_proc'::regclass::oid,
        'public.sf_append_voice_audit_service(text,text,uuid,uuid,uuid,jsonb,jsonb)'::regprocedure::oid,
        0, 'a'::text),
       ((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_proc'::regclass::oid,
        'public.sf_voice_sweep_candidates(integer)'::regprocedure::oid, 0, 'a'::text),
       ((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_proc'::regclass::oid,
        'public.sf_voice_sweep_purge(uuid,text)'::regprocedure::oid, 0, 'a'::text),
       ((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_proc'::regclass::oid,
        'public.sf_voice_asset_pending_candidates(integer)'::regprocedure::oid, 0, 'a'::text),
       ((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_proc'::regclass::oid,
        'public.sf_voice_asset_mark_verified(uuid,bigint,text)'::regprocedure::oid, 0, 'a'::text),
       ((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_proc'::regclass::oid,
        'public.sf_voice_asset_mark_failed(uuid)'::regprocedure::oid, 0, 'a'::text),
       ((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_proc'::regclass::oid,
        'public.sf_voice_audio_reference_check(text[])'::regprocedure::oid, 0, 'a'::text),
       ((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_proc'::regclass::oid,
        'public.sf_reconciliation_sweep_old_runs()'::regprocedure::oid, 0, 'a'::text))
    UNION ALL
    (VALUES
       ((SELECT oid FROM pg_database WHERE datname = current_database()),
        'pg_class'::regclass::oid, 'public.sf_recording_sessions'::regclass::oid, 0, 'a'::text),
       ((SELECT oid FROM pg_database WHERE datname = current_database()),
        'pg_class'::regclass::oid, 'public.sf_recording_segments'::regclass::oid, 0, 'a'::text),
       ((SELECT oid FROM pg_database WHERE datname = current_database()),
        'pg_class'::regclass::oid, 'public.sf_feature_flags'::regclass::oid, 0, 'a'::text),
       ((SELECT oid FROM pg_database WHERE datname = current_database()),
        'pg_class'::regclass::oid, 'public.sf_audio_deletion_intents'::regclass::oid, 0, 'a'::text),
       ((SELECT oid FROM pg_database WHERE datname = current_database()),
        'pg_class'::regclass::oid, 'public.sf_reconciliation_runs'::regclass::oid, 0, 'a'::text),
       ((SELECT oid FROM pg_database WHERE datname = current_database()),
        'pg_class'::regclass::oid, 'public.sf_reconciliation_state'::regclass::oid, 0, 'a'::text),
       ((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_proc'::regclass::oid,
        'public.sf_append_voice_audit_service(text,text,uuid,uuid,uuid,jsonb,jsonb)'::regprocedure::oid,
        0, 'a'::text),
       ((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_proc'::regclass::oid,
        'public.sf_voice_sweep_candidates(integer)'::regprocedure::oid, 0, 'a'::text),
       ((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_proc'::regclass::oid,
        'public.sf_voice_sweep_purge(uuid,text)'::regprocedure::oid, 0, 'a'::text),
       ((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_proc'::regclass::oid,
        'public.sf_voice_asset_pending_candidates(integer)'::regprocedure::oid, 0, 'a'::text),
       ((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_proc'::regclass::oid,
        'public.sf_voice_asset_mark_verified(uuid,bigint,text)'::regprocedure::oid, 0, 'a'::text),
       ((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_proc'::regclass::oid,
        'public.sf_voice_asset_mark_failed(uuid)'::regprocedure::oid, 0, 'a'::text),
       ((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_proc'::regclass::oid,
        'public.sf_voice_audio_reference_check(text[])'::regprocedure::oid, 0, 'a'::text),
       ((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_proc'::regclass::oid,
        'public.sf_reconciliation_sweep_old_runs()'::regprocedure::oid, 0, 'a'::text)
     EXCEPT
     SELECT dependency.dbid, dependency.classid, dependency.objid, dependency.objsubid,
            dependency.deptype::text
       FROM pg_shdepend dependency
      WHERE dependency.refclassid = 'pg_authid'::regclass
        AND dependency.refobjid = 'storyforge_app'::regrole
        AND dependency.deptype IN ('a', 'o'))
  ) THEN
    RAISE EXCEPTION 'B1-506 application role shared dependency closure is not exact';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_database item
    CROSS JOIN LATERAL aclexplode(item.datacl) acl
    WHERE acl.grantee = 'storyforge_app'::regrole
  ) OR EXISTS (
    SELECT 1 FROM pg_namespace item
    CROSS JOIN LATERAL aclexplode(item.nspacl) acl
    WHERE acl.grantee = 'storyforge_app'::regrole
  ) OR EXISTS (
    SELECT 1 FROM pg_type item
    CROSS JOIN LATERAL aclexplode(item.typacl) acl
    WHERE acl.grantee = 'storyforge_app'::regrole
  ) OR EXISTS (
    SELECT 1 FROM pg_default_acl item
    CROSS JOIN LATERAL aclexplode(item.defaclacl) acl
    WHERE acl.grantee = 'storyforge_app'::regrole
  ) OR EXISTS (
    SELECT 1 FROM pg_db_role_setting
    WHERE setrole = 'storyforge_app'::regrole
  ) OR EXISTS (
    SELECT 1 FROM pg_database WHERE datdba = 'storyforge_app'::regrole
  ) OR EXISTS (
    SELECT 1 FROM pg_namespace WHERE nspowner = 'storyforge_app'::regrole
  ) OR EXISTS (
    SELECT 1 FROM pg_class WHERE relowner = 'storyforge_app'::regrole
  ) OR EXISTS (
    SELECT 1 FROM pg_proc WHERE proowner = 'storyforge_app'::regrole
  ) OR EXISTS (
    SELECT 1 FROM pg_type WHERE typowner = 'storyforge_app'::regrole
  ) THEN
    RAISE EXCEPTION 'B1-506 application role has unexpected ACL, setting, or ownership';
  END IF;
  WITH effective_authority(entry) AS (
    SELECT format('DATABASE|CURRENT_DATABASE|%s|%s|%s',
                  coalesce(grantee.rolname, 'PUBLIC'),
                  acl.privilege_type, acl.is_grantable)
      FROM pg_database database_item
      CROSS JOIN LATERAL aclexplode(
        coalesce(database_item.datacl, acldefault('d', database_item.datdba))
      ) acl
      LEFT JOIN pg_roles grantee ON grantee.oid = acl.grantee
     WHERE database_item.datname = current_database()
       AND acl.grantee IN (0, 'authenticated'::regrole::oid)
    UNION ALL
    SELECT format('SCHEMA|%s|%s|%s|%s', namespace.nspname,
                  coalesce(grantee.rolname, 'PUBLIC'),
                  acl.privilege_type, acl.is_grantable)
      FROM pg_namespace namespace
      CROSS JOIN LATERAL aclexplode(
        coalesce(namespace.nspacl, acldefault('n', namespace.nspowner))
      ) acl
      LEFT JOIN pg_roles grantee ON grantee.oid = acl.grantee
     WHERE namespace.nspname !~ '^pg_'
       AND namespace.nspname <> 'information_schema'
       AND acl.grantee IN (0, 'authenticated'::regrole::oid)
    UNION ALL
    SELECT format('RELATION|%s|%s|%s|%s|%s',
                  namespace.nspname, relation.relname,
                  coalesce(grantee.rolname, 'PUBLIC'),
                  acl.privilege_type, acl.is_grantable)
      FROM pg_class relation
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      CROSS JOIN LATERAL aclexplode(
        coalesce(
          relation.relacl,
          acldefault(
            CASE
              WHEN relation.relkind = 'S' THEN 'S'::"char"
              ELSE 'r'::"char"
            END,
            relation.relowner
          )
        )
      ) acl
      LEFT JOIN pg_roles grantee ON grantee.oid = acl.grantee
     WHERE namespace.nspname !~ '^pg_'
       AND namespace.nspname <> 'information_schema'
       AND relation.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
       AND acl.grantee IN (0, 'authenticated'::regrole::oid)
    UNION ALL
    SELECT format('COLUMN|%s|%s|%s|%s|%s|%s',
                  namespace.nspname, relation.relname, attribute.attname,
                  coalesce(grantee.rolname, 'PUBLIC'),
                  acl.privilege_type, acl.is_grantable)
      FROM pg_attribute attribute
      JOIN pg_class relation ON relation.oid = attribute.attrelid
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      CROSS JOIN LATERAL aclexplode(attribute.attacl) acl
      LEFT JOIN pg_roles grantee ON grantee.oid = acl.grantee
     WHERE namespace.nspname !~ '^pg_'
       AND namespace.nspname <> 'information_schema'
       AND attribute.attnum > 0
       AND NOT attribute.attisdropped
       AND acl.grantee IN (0, 'authenticated'::regrole::oid)
    UNION ALL
    SELECT format('ROUTINE|%s|%s(%s)|%s|%s|%s',
                  namespace.nspname, routine.proname,
                  oidvectortypes(routine.proargtypes),
                  coalesce(grantee.rolname, 'PUBLIC'),
                  acl.privilege_type, acl.is_grantable)
      FROM pg_proc routine
      JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
      CROSS JOIN LATERAL aclexplode(
        coalesce(routine.proacl, acldefault('f', routine.proowner))
      ) acl
      LEFT JOIN pg_roles grantee ON grantee.oid = acl.grantee
     WHERE namespace.nspname !~ '^pg_'
       AND namespace.nspname <> 'information_schema'
       AND acl.grantee IN (0, 'authenticated'::regrole::oid)
    UNION ALL
    SELECT format('TYPE|%s|%s|%s|%s|%s',
                  namespace.nspname, type_item.typname,
                  coalesce(grantee.rolname, 'PUBLIC'),
                  acl.privilege_type, acl.is_grantable)
      FROM pg_type type_item
      JOIN pg_namespace namespace ON namespace.oid = type_item.typnamespace
      CROSS JOIN LATERAL aclexplode(
        coalesce(type_item.typacl, acldefault('T', type_item.typowner))
      ) acl
      LEFT JOIN pg_roles grantee ON grantee.oid = acl.grantee
     WHERE namespace.nspname !~ '^pg_'
       AND namespace.nspname <> 'information_schema'
       AND acl.grantee IN (0, 'authenticated'::regrole::oid)
    UNION ALL
    SELECT format('DEFAULT|%s|%s|%s|%s|%s|%s',
                  owner_role.rolname, coalesce(namespace.nspname, '*'),
                  default_acl.defaclobjtype,
                  coalesce(grantee.rolname, 'PUBLIC'),
                  acl.privilege_type, acl.is_grantable)
      FROM pg_default_acl default_acl
      JOIN pg_roles owner_role ON owner_role.oid = default_acl.defaclrole
      LEFT JOIN pg_namespace namespace
        ON namespace.oid = default_acl.defaclnamespace
      CROSS JOIN LATERAL aclexplode(default_acl.defaclacl) acl
      LEFT JOIN pg_roles grantee ON grantee.oid = acl.grantee
     WHERE acl.grantee IN (0, 'authenticated'::regrole::oid)
    UNION ALL
    SELECT format('POLICY|%s|%s|%s|%s|%s|%s|%s|%s',
                  namespace.nspname, relation.relname, policy.polname,
                  policy.polcmd::text, policy.polpermissive::text,
                  array_to_string(
                    ARRAY(
                      SELECT CASE
                               WHEN policy_role = 0 THEN 'PUBLIC'
                               ELSE policy_role::regrole::text
                             END
                        FROM unnest(policy.polroles) policy_role
                       ORDER BY 1
                    ),
                    ','
                  ),
                  coalesce(pg_get_expr(policy.polqual, policy.polrelid), ''),
                  coalesce(pg_get_expr(policy.polwithcheck, policy.polrelid), ''))
      FROM pg_policy policy
      JOIN pg_class relation ON relation.oid = policy.polrelid
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
     WHERE namespace.nspname !~ '^pg_'
       AND namespace.nspname <> 'information_schema'
       AND (
         0::oid = ANY (policy.polroles)
         OR 'authenticated'::regrole::oid = ANY (policy.polroles)
       )
    UNION ALL
    SELECT format(
             'ROLE|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s',
             role_item.rolname,
             role_item.rolsuper,
             role_item.rolinherit,
             role_item.rolcreaterole,
             role_item.rolcreatedb,
             role_item.rolcanlogin,
             role_item.rolreplication,
             role_item.rolbypassrls,
             role_item.rolconnlimit,
             coalesce(role_item.rolvaliduntil::text, ''),
             coalesce(array_to_string(role_item.rolconfig, ','), ''),
             EXISTS (
               SELECT 1
                 FROM pg_authid auth_item
                WHERE auth_item.oid = role_item.oid
                  AND auth_item.rolpassword IS NOT NULL
             )
           )
      FROM pg_roles role_item
     WHERE role_item.rolname = 'authenticated'
    UNION ALL
    SELECT format(
             'MEMBERSHIP|%s|%s|%s|%s|%s',
             granted.rolname,
             member_role.rolname,
             membership.admin_option,
             membership.inherit_option,
             membership.set_option
           )
      FROM pg_auth_members membership
      JOIN pg_roles granted ON granted.oid = membership.roleid
      JOIN pg_roles member_role ON member_role.oid = membership.member
     WHERE membership.member = 'authenticated'::regrole
        OR membership.roleid = 'authenticated'::regrole
    UNION ALL
    SELECT format(
             'ROW_SECURITY|%s|%s|%s|%s',
             namespace.nspname,
             relation.relname,
             relation.relrowsecurity,
             relation.relforcerowsecurity
           )
      FROM pg_class relation
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
     WHERE namespace.nspname !~ '^pg_'
       AND namespace.nspname <> 'information_schema'
       AND relation.relkind IN ('r', 'p')
       AND (relation.relrowsecurity OR relation.relforcerowsecurity)
    UNION ALL
    SELECT format('OWNERSHIP|DATABASE|%s', database_item.datname)
      FROM pg_database database_item
     WHERE database_item.datdba = 'authenticated'::regrole
    UNION ALL
    SELECT format('OWNERSHIP|SCHEMA|%s', namespace.nspname)
      FROM pg_namespace namespace
     WHERE namespace.nspowner = 'authenticated'::regrole
    UNION ALL
    SELECT format('OWNERSHIP|RELATION|%s|%s',
                  namespace.nspname, relation.relname)
      FROM pg_class relation
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
     WHERE relation.relowner = 'authenticated'::regrole
    UNION ALL
    SELECT format('OWNERSHIP|ROUTINE|%s|%s(%s)',
                  namespace.nspname, routine.proname,
                  oidvectortypes(routine.proargtypes))
      FROM pg_proc routine
      JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
     WHERE routine.proowner = 'authenticated'::regrole
    UNION ALL
    SELECT format('OWNERSHIP|TYPE|%s|%s',
                  namespace.nspname, type_item.typname)
      FROM pg_type type_item
      JOIN pg_namespace namespace ON namespace.oid = type_item.typnamespace
     WHERE type_item.typowner = 'authenticated'::regrole
    UNION ALL
    SELECT format('ROLE_SETTING|%s|%s|%s',
                  CASE
                    WHEN setting.setrole = 0 THEN 'PUBLIC'
                    ELSE 'authenticated'
                  END,
                  coalesce(database_item.datname, '*'),
                  setting.setconfig::text)
      FROM pg_db_role_setting setting
      LEFT JOIN pg_database database_item
        ON database_item.oid = setting.setdatabase
     WHERE setting.setrole IN (0, 'authenticated'::regrole::oid)
  )
  SELECT count(*),
         pg_catalog.encode(
           pg_catalog.sha256(
             pg_catalog.convert_to(
               pg_catalog.string_agg(entry, E'\n' ORDER BY entry COLLATE "C"),
               'UTF8'
             )
           ),
           'hex'
         )
    INTO effective_authority_count, effective_authority_sha256
    FROM effective_authority;
  IF effective_authority_count <> 254
     OR effective_authority_sha256
        <> '2fd0eee3c7ec4e263420ed0593955be5b1fdaaec172ca16e27481a9b5f7ed05e' THEN
    RAISE EXCEPTION 'B1-507B effective authenticated/PUBLIC authority closure is not exact';
  END IF;
END
$b1_506_post$;
SET LOCAL password_encryption = 'scram-sha-256';
ALTER ROLE storyforge_app PASSWORD :'app_password';
ALTER ROLE storyforge_app LOGIN;
SQL
  cat <<SQL
DO \$b1_506_post_counts\$
BEGIN
  IF (SELECT count(*) FROM public.sf_users) <> $STORYFORGE_EXPECTED_USER_COUNT
     OR (SELECT count(*) FROM public.sf_mentor_assignments WHERE active)
        <> $STORYFORGE_EXPECTED_ACTIVE_ASSIGNMENT_COUNT THEN
    RAISE EXCEPTION 'B1-506 post-migration data counts are not exact';
  END IF;
END
\$b1_506_post_counts\$;
SQL
} | "$psql_bin" "${psql_args[@]}"

post_state="$(
  "${psql_read[@]}" -AtF '|' -c "
    SELECT
      (SELECT count(*) FROM public.sf_schema_migrations),
      (SELECT count(*) FROM pg_roles
       WHERE rolname = 'storyforge_app'
         AND rolcanlogin
         AND NOT rolsuper
         AND NOT rolcreatedb
         AND NOT rolcreaterole
         AND NOT rolreplication
         AND NOT rolbypassrls
         AND NOT rolinherit
         AND rolconnlimit = -1
         AND rolvaliduntil IS NULL
         AND coalesce(cardinality(rolconfig), 0) = 0),
      (SELECT count(*) FROM public.sf_users),
      (SELECT count(*) FROM public.sf_mentor_assignments WHERE active),
      (SELECT count(*) FROM public.sf_feature_flags
        WHERE key = 'voice_capture'
          AND updated_by = '$STORYFORGE_FOUNDER_USER_ID'::uuid);
  "
)"
[[ "$post_state" = "9|1|$STORYFORGE_EXPECTED_USER_COUNT|$STORYFORGE_EXPECTED_ACTIVE_ASSIGNMENT_COUNT|1" ]] \
  || fail "committed post-migration state differs from the exact gate"

post_role_closure="$(
  "${psql_read[@]}" -At -c "
    /* B1_506A_EXACT_ROLE_CLOSURE_POSTCOMMIT */
    WITH expected_membership(
      granted_role, member_role, admin_option, inherit_option, set_option
    ) AS (
      VALUES ('authenticated'::text, 'storyforge_app'::text, false, false, true)
    ),
    actual_membership AS (
      SELECT granted.rolname::text, member_role.rolname::text,
             membership.admin_option,
             membership.inherit_option, membership.set_option
        FROM pg_auth_members membership
        JOIN pg_roles granted ON granted.oid = membership.roleid
        JOIN pg_roles member_role ON member_role.oid = membership.member
       WHERE membership.member IN (
               'storyforge_app'::regrole,
               'authenticated'::regrole
             )
          OR membership.roleid IN (
               'storyforge_app'::regrole,
               'authenticated'::regrole
             )
    ),
    expected_relations(schema_name, relation_name, privilege_type, is_grantable) AS (
      VALUES
        ('public'::text, 'sf_recording_sessions'::text, 'SELECT'::text, false),
        ('public'::text, 'sf_recording_sessions'::text, 'INSERT'::text, false),
        ('public'::text, 'sf_recording_sessions'::text, 'UPDATE'::text, false),
        ('public'::text, 'sf_recording_sessions'::text, 'DELETE'::text, false),
        ('public'::text, 'sf_recording_segments'::text, 'SELECT'::text, false),
        ('public'::text, 'sf_recording_segments'::text, 'INSERT'::text, false),
        ('public'::text, 'sf_recording_segments'::text, 'UPDATE'::text, false),
        ('public'::text, 'sf_recording_segments'::text, 'DELETE'::text, false),
        ('public'::text, 'sf_feature_flags'::text, 'SELECT'::text, false),
        ('public'::text, 'sf_audio_deletion_intents'::text, 'SELECT'::text, false),
        ('public'::text, 'sf_audio_deletion_intents'::text, 'INSERT'::text, false),
        ('public'::text, 'sf_audio_deletion_intents'::text, 'UPDATE'::text, false),
        ('public'::text, 'sf_reconciliation_runs'::text, 'SELECT'::text, false),
        ('public'::text, 'sf_reconciliation_runs'::text, 'INSERT'::text, false),
        ('public'::text, 'sf_reconciliation_runs'::text, 'UPDATE'::text, false),
        ('public'::text, 'sf_reconciliation_state'::text, 'SELECT'::text, false),
        ('public'::text, 'sf_reconciliation_state'::text, 'UPDATE'::text, false)
    ),
    actual_relations AS (
      SELECT namespace.nspname::text, relation.relname::text,
             acl.privilege_type::text, acl.is_grantable
        FROM pg_class relation
        JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
        CROSS JOIN LATERAL aclexplode(relation.relacl) acl
       WHERE acl.grantee = 'storyforge_app'::regrole
    ),
    expected_routines(schema_name, routine_name, identity_arguments, privilege_type, is_grantable) AS (
      VALUES
        ('public'::text, 'sf_append_voice_audit_service'::text,
         'text, text, uuid, uuid, uuid, jsonb, jsonb'::text, 'EXECUTE'::text, false),
        ('public'::text, 'sf_voice_sweep_candidates'::text,
         'integer'::text, 'EXECUTE'::text, false),
        ('public'::text, 'sf_voice_sweep_purge'::text,
         'uuid, text'::text, 'EXECUTE'::text, false),
        ('public'::text, 'sf_voice_asset_pending_candidates'::text,
         'integer'::text, 'EXECUTE'::text, false),
        ('public'::text, 'sf_voice_asset_mark_verified'::text,
         'uuid, bigint, text'::text, 'EXECUTE'::text, false),
        ('public'::text, 'sf_voice_asset_mark_failed'::text,
         'uuid'::text, 'EXECUTE'::text, false),
        ('public'::text, 'sf_voice_audio_reference_check'::text,
         'text[]'::text, 'EXECUTE'::text, false),
        ('public'::text, 'sf_reconciliation_sweep_old_runs'::text,
         ''::text, 'EXECUTE'::text, false)
    ),
    actual_routines AS (
      SELECT namespace.nspname::text, routine.proname::text,
             oidvectortypes(routine.proargtypes)::text,
             acl.privilege_type::text, acl.is_grantable
        FROM pg_proc routine
        JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
        CROSS JOIN LATERAL aclexplode(routine.proacl) acl
       WHERE acl.grantee = 'storyforge_app'::regrole
    ),
    expected_policies(
      schema_name, relation_name, policy_name, command, permissive
    ) AS (
      VALUES
        ('public'::text, 'sf_recording_sessions'::text,
         'sf_recording_sessions_service'::text, '*'::text, true),
        ('public'::text, 'sf_recording_segments'::text,
         'sf_recording_segments_service'::text, '*'::text, true),
        ('public'::text, 'sf_feature_flags'::text,
         'sf_feature_flags_service_read'::text, 'r'::text, true),
        ('public'::text, 'sf_audio_deletion_intents'::text,
         'sf_deletion_intents_service'::text, '*'::text, true),
        ('public'::text, 'sf_reconciliation_runs'::text,
         'sf_reconciliation_runs_service'::text, '*'::text, true),
        ('public'::text, 'sf_reconciliation_state'::text,
         'sf_reconciliation_state_service'::text, '*'::text, true)
    ),
    actual_policies AS (
      SELECT namespace.nspname::text, relation.relname::text,
             policy.polname::text, policy.polcmd::text, policy.polpermissive
        FROM pg_policy policy
        JOIN pg_class relation ON relation.oid = policy.polrelid
        JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
       WHERE 'storyforge_app'::regrole = ANY (policy.polroles)
    ),
    expected_dependencies(dbid, classid, objid, objsubid, deptype) AS (
      VALUES
        ((SELECT oid FROM pg_database WHERE datname = current_database()),
         'pg_class'::regclass::oid, 'public.sf_recording_sessions'::regclass::oid, 0, 'a'::text),
        ((SELECT oid FROM pg_database WHERE datname = current_database()),
         'pg_class'::regclass::oid, 'public.sf_recording_segments'::regclass::oid, 0, 'a'::text),
        ((SELECT oid FROM pg_database WHERE datname = current_database()),
         'pg_class'::regclass::oid, 'public.sf_feature_flags'::regclass::oid, 0, 'a'::text),
        ((SELECT oid FROM pg_database WHERE datname = current_database()),
         'pg_class'::regclass::oid, 'public.sf_audio_deletion_intents'::regclass::oid, 0, 'a'::text),
        ((SELECT oid FROM pg_database WHERE datname = current_database()),
         'pg_class'::regclass::oid, 'public.sf_reconciliation_runs'::regclass::oid, 0, 'a'::text),
        ((SELECT oid FROM pg_database WHERE datname = current_database()),
         'pg_class'::regclass::oid, 'public.sf_reconciliation_state'::regclass::oid, 0, 'a'::text),
        ((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_proc'::regclass::oid,
         'public.sf_append_voice_audit_service(text,text,uuid,uuid,uuid,jsonb,jsonb)'::regprocedure::oid,
         0, 'a'::text),
        ((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_proc'::regclass::oid,
         'public.sf_voice_sweep_candidates(integer)'::regprocedure::oid, 0, 'a'::text),
        ((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_proc'::regclass::oid,
         'public.sf_voice_sweep_purge(uuid,text)'::regprocedure::oid, 0, 'a'::text),
        ((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_proc'::regclass::oid,
         'public.sf_voice_asset_pending_candidates(integer)'::regprocedure::oid, 0, 'a'::text),
        ((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_proc'::regclass::oid,
         'public.sf_voice_asset_mark_verified(uuid,bigint,text)'::regprocedure::oid, 0, 'a'::text),
        ((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_proc'::regclass::oid,
         'public.sf_voice_asset_mark_failed(uuid)'::regprocedure::oid, 0, 'a'::text),
        ((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_proc'::regclass::oid,
         'public.sf_voice_audio_reference_check(text[])'::regprocedure::oid, 0, 'a'::text),
        ((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_proc'::regclass::oid,
         'public.sf_reconciliation_sweep_old_runs()'::regprocedure::oid, 0, 'a'::text)
    ),
    actual_dependencies AS (
      SELECT dependency.dbid, dependency.classid, dependency.objid, dependency.objsubid,
             dependency.deptype::text
        FROM pg_shdepend dependency
       WHERE dependency.refclassid = 'pg_authid'::regclass
         AND dependency.refobjid = 'storyforge_app'::regrole
         AND dependency.deptype IN ('a', 'o')
    )
    SELECT (
      NOT EXISTS ((SELECT * FROM actual_membership EXCEPT SELECT * FROM expected_membership)
                  UNION ALL
                  (SELECT * FROM expected_membership EXCEPT SELECT * FROM actual_membership))
      AND NOT EXISTS ((SELECT * FROM actual_relations EXCEPT SELECT * FROM expected_relations)
                      UNION ALL
                      (SELECT * FROM expected_relations EXCEPT SELECT * FROM actual_relations))
      AND NOT EXISTS ((SELECT * FROM actual_routines EXCEPT SELECT * FROM expected_routines)
                      UNION ALL
                      (SELECT * FROM expected_routines EXCEPT SELECT * FROM actual_routines))
      AND NOT EXISTS ((SELECT * FROM actual_policies EXCEPT SELECT * FROM expected_policies)
                      UNION ALL
                      (SELECT * FROM expected_policies EXCEPT SELECT * FROM actual_policies))
      AND NOT EXISTS ((SELECT * FROM actual_dependencies EXCEPT SELECT * FROM expected_dependencies)
                      UNION ALL
                      (SELECT * FROM expected_dependencies EXCEPT SELECT * FROM actual_dependencies))
      AND NOT EXISTS (
        SELECT 1 FROM pg_database item
        CROSS JOIN LATERAL aclexplode(item.datacl) acl
        WHERE acl.grantee = 'storyforge_app'::regrole
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_namespace item
        CROSS JOIN LATERAL aclexplode(item.nspacl) acl
        WHERE acl.grantee = 'storyforge_app'::regrole
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_type item
        CROSS JOIN LATERAL aclexplode(item.typacl) acl
        WHERE acl.grantee = 'storyforge_app'::regrole
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_default_acl item
        CROSS JOIN LATERAL aclexplode(item.defaclacl) acl
        WHERE acl.grantee = 'storyforge_app'::regrole
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_db_role_setting
        WHERE setrole = 'storyforge_app'::regrole
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_database WHERE datdba = 'storyforge_app'::regrole
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_namespace WHERE nspowner = 'storyforge_app'::regrole
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_class WHERE relowner = 'storyforge_app'::regrole
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proowner = 'storyforge_app'::regrole
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typowner = 'storyforge_app'::regrole
      )
      AND EXISTS (
        SELECT 1
          FROM pg_authid
         WHERE rolname = 'storyforge_app'
           AND rolpassword LIKE 'SCRAM-SHA-256$%'
      )
    )::text;
  "
)"
[[ "$post_role_closure" = "true" ]] \
  || fail "committed application-role privilege closure differs from the exact gate"

"${psql_read[@]}" -f "$effective_authority_gate" >/dev/null \
  || fail "committed authenticated/PUBLIC effective authority differs from the exact gate"

printf '%s\n' "B1_508_PRODUCTION_MIGRATIONS_APPLIED"
printf 'migration_count=9\nleast_privilege_app_role=1\nstoryforge_user_count=%s\nactive_assignment_count=%s\nfeature_flag_seeded_by=%s\n' \
  "$STORYFORGE_EXPECTED_USER_COUNT" "$STORYFORGE_EXPECTED_ACTIVE_ASSIGNMENT_COUNT" \
  "$STORYFORGE_FOUNDER_USER_ID"
