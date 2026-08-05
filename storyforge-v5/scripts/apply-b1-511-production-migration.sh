#!/usr/bin/env bash
set -euo pipefail

umask 077

PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPOSITORY_DIR="$(cd "$PACKAGE_DIR/.." && pwd)"
MIGRATION_VERSION="20260805190000"
MIGRATION_FILE="20260805190000_b1_511_workflow_taxonomy_mentor_notes.sql"
MIGRATION_SHA256="9bae7859f5966a8e9fc2f29fe9ccb37b0e59675e830c6b7ccdaef3914532c05f"
EXPECTED_PROJECT_ID="875e7c17-d06f-4301-a4bb-e61016f153cf"
EXPECTED_ENVIRONMENT_ID="bcef8734-e42b-44df-8488-c2a3de68213f"
EXPECTED_DATABASE_SERVICE_ID="a4a66362-c3ba-475a-ae21-2aa46624bafe"
EXPECTED_VOLUME_INSTANCE_ID="8d4a7b7f-7d55-4a1d-81eb-07221b4a7bf5"

fail() {
  printf 'Refusing B1-511 production migration: %s\n' "$*" >&2
  exit 1
}

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

contains_control() {
  case "$1" in
    *$'\n'*|*$'\r'*|*$'\t'*) return 0 ;;
    *) return 1 ;;
  esac
}

[[ $# = 1 ]] || fail 'usage: apply-b1-511-production-migration.sh preflight|apply'
mode="$1"
[[ "$mode" = preflight || "$mode" = apply ]] || fail 'mode must be preflight or apply'

required_variables=(
  STORYFORGE_DATABASE_URL
  STORYFORGE_DEPLOY_GIT_COMMIT
  STORYFORGE_DB_BACKUP_ID
  STORYFORGE_DB_BACKUP_RECEIPT
  STORYFORGE_DB_BACKUP_RECEIPT_SHA256
  STORYFORGE_EXPECTED_DB_SYSTEM_IDENTIFIER
  STORYFORGE_EXPECTED_USER_COUNT
  STORYFORGE_EXPECTED_ACTIVE_ASSIGNMENT_COUNT
)
for variable_name in "${required_variables[@]}"; do
  [[ -n "${!variable_name:-}" ]] || fail "$variable_name is required"
  contains_control "${!variable_name}" && fail "$variable_name contains control data"
done

[[ "$STORYFORGE_DEPLOY_GIT_COMMIT" =~ ^[a-f0-9]{40}$ ]] || fail 'deploy commit is invalid'
[[ "$STORYFORGE_DB_BACKUP_ID" =~ ^[a-f0-9-]{36}$ ]] || fail 'backup ID is invalid'
[[ "$STORYFORGE_DB_BACKUP_RECEIPT_SHA256" =~ ^[a-f0-9]{64}$ ]] || fail 'backup receipt hash is invalid'
[[ "$STORYFORGE_EXPECTED_DB_SYSTEM_IDENTIFIER" =~ ^[1-9][0-9]{15,24}$ ]] || fail 'database system identifier is invalid'
[[ "$STORYFORGE_EXPECTED_USER_COUNT" =~ ^[0-9]+$ ]] || fail 'user count is invalid'
[[ "$STORYFORGE_EXPECTED_ACTIVE_ASSIGNMENT_COUNT" =~ ^[0-9]+$ ]] || fail 'assignment count is invalid'

migration="$PACKAGE_DIR/infra/postgres/migrations/$MIGRATION_FILE"
[[ -f "$migration" && ! -L "$migration" ]] || fail 'migration source is absent or symlinked'
[[ "$(sha256_file "$migration")" = "$MIGRATION_SHA256" ]] || fail 'migration source hash differs'
[[ -f "$STORYFORGE_DB_BACKUP_RECEIPT" && ! -L "$STORYFORGE_DB_BACKUP_RECEIPT" ]] \
  || fail 'backup receipt is absent or symlinked'
[[ "$(sha256_file "$STORYFORGE_DB_BACKUP_RECEIPT")" = "$STORYFORGE_DB_BACKUP_RECEIPT_SHA256" ]] \
  || fail 'backup receipt hash differs'

actual_head="$(git -C "$REPOSITORY_DIR" rev-parse HEAD)"
[[ "$actual_head" = "$STORYFORGE_DEPLOY_GIT_COMMIT" ]] || fail 'Git HEAD differs from deploy commit'
[[ -z "$(git -C "$REPOSITORY_DIR" status --porcelain)" ]] || fail 'Git worktree is not clean'
git -C "$REPOSITORY_DIR" cat-file -e "$STORYFORGE_DEPLOY_GIT_COMMIT:$MIGRATION_FILE" 2>/dev/null \
  && fail 'migration path was unexpectedly resolved outside storyforge-v5'
git_hash="$(git -C "$REPOSITORY_DIR" show "$STORYFORGE_DEPLOY_GIT_COMMIT:storyforge-v5/infra/postgres/migrations/$MIGRATION_FILE" | sha256_file /dev/stdin)"
[[ "$git_hash" = "$MIGRATION_SHA256" ]] || fail 'deploy commit does not contain the exact migration'

backup_fields=0
backup_project=''
backup_environment=''
backup_service=''
backup_volume=''
backup_id=''
backup_system=''
backup_dump_major=''
backup_restore=''
backup_locked=''
backup_expires=''
while IFS=$'\t' read -r key value extra; do
  [[ -z "${extra:-}" ]] || fail 'backup receipt contains a malformed row'
  case "$key" in
    \#*|'') continue ;;
    format) [[ "$value" = B1-503-DB-BACKUP-V1 ]] || fail 'backup receipt format differs' ;;
    backup_id) backup_id="$value" ;;
    project_id) backup_project="$value" ;;
    environment_id) backup_environment="$value" ;;
    database_service_id) backup_service="$value" ;;
    volume_instance_id) backup_volume="$value" ;;
    db_system_identifier) backup_system="$value" ;;
    pg_dump_major) backup_dump_major="$value" ;;
    restore_rehearsal) backup_restore="$value" ;;
    provider_backup_locked) backup_locked="$value" ;;
    provider_backup_expires_at) backup_expires="$value" ;;
    pg_host|pg_port|pg_database|pg_dump_sha256|provider_backup_created_at) ;;
    *) fail "backup receipt contains unknown field: $key" ;;
  esac
  backup_fields=$((backup_fields + 1))
done < "$STORYFORGE_DB_BACKUP_RECEIPT"
[[ "$backup_fields" = 16 ]] || fail 'backup receipt must contain exactly sixteen fields'
[[ "$backup_id" = "$STORYFORGE_DB_BACKUP_ID" ]] || fail 'backup receipt ID differs'
[[ "$backup_project" = "$EXPECTED_PROJECT_ID" ]] || fail 'backup project differs'
[[ "$backup_environment" = "$EXPECTED_ENVIRONMENT_ID" ]] || fail 'backup environment differs'
[[ "$backup_service" = "$EXPECTED_DATABASE_SERVICE_ID" ]] || fail 'backup database service differs'
[[ "$backup_volume" = "$EXPECTED_VOLUME_INSTANCE_ID" ]] || fail 'backup volume instance differs'
[[ "$backup_system" = "$STORYFORGE_EXPECTED_DB_SYSTEM_IDENTIFIER" ]] || fail 'backup database system differs'
[[ "$backup_dump_major" = 18 && "$backup_restore" = PASS ]] || fail 'PostgreSQL 18 restore rehearsal is not proven'
[[ "$backup_locked" = true && "$backup_expires" = null ]] || fail 'provider backup is not locked and non-expiring'

psql_bin="$(command -v psql || true)"
[[ -n "$psql_bin" && "$psql_bin" = /* && -x "$psql_bin" ]] || fail 'psql is unavailable'
[[ "$($psql_bin --version | sed -E 's/^psql \(PostgreSQL\) ([0-9]+).*/\1/')" = 18 ]] \
  || fail 'PostgreSQL 18 psql is required'
export PGDATABASE="$STORYFORGE_DATABASE_URL"
unset STORYFORGE_DATABASE_URL PGHOST PGPORT PGUSER PGPASSWORD PGHOSTADDR PGSERVICE PGSERVICEFILE
export PGSSLMODE=require
psql_read=("$psql_bin" -X -v ON_ERROR_STOP=1)

expected_pre_ledger='20260726150000|20260726150000_b1_500_storyforge_v5_foundation.sql|93018d16582890890ac9ad696cdfd11b5d8118afa55a709725c531a52fae6a1f
20260727170000|20260727170000_b1_502_storyforge_submit_assignment_gate.sql|95269aeb5a414656c92246ea8e798faac7f0b33d7062540b187f30b8a781315f
20260727190000|20260727190000_b1_502_storyforge_background_preference.sql|ee8ad5cf0a1b850a23c015a07a0f762de2a4b588abbd29a381b35c2db6d79405
20260728045100|20260728045100_b1_503_story_domain_conformance.sql|fea497dc32a07ac2c05b8ae21caa6b77d85cc4a571b30816432016719a9a8a68
20260728045444|20260728045444_b1_503_interview_mentor_conformance.sql|5b3ea347c1dfb36b22cab81ed6042e0d6e10e2786febb67e83214b56dd4071e2
20260729000100|20260729000100_b1_506_voice_recording_sessions.sql|6f6a3340bc29d1222b5f78472eb9a4897739722d090241de6d64f3e8f781c9c2
20260729000200|20260729000200_b1_506_feature_flags.sql|8899d7d6525c0cbc72790378fcf6a2d8aeb4bc1e7b8afac737be6c3e9af34c3a
20260729010000|20260729010000_b1_506a_voice_audit_lifecycle.sql|e67561cc087e2d71d5d7f65ba3033eff06c0dd328a6e43b3915aa58ba1e74323
20260730000100|20260730000100_b1_507b_reconciliation_state.sql|ae86a5ea104becf7dff244fa3188338f8ad13eef58190abd47522ca2e2e733d7
20260801190000|20260801190000_b1_510i_admin_console.sql|3c4478f0cf6261e007f9738fb398b4b64669150840261b09d6223eb2120c8641'
actual_pre_ledger="$("${psql_read[@]}" -AtF '|' -c 'SELECT version,file_name,sha256 FROM public.sf_schema_migrations ORDER BY version')"
[[ "$actual_pre_ledger" = "$expected_pre_ledger" ]] || fail 'production migration ledger differs from the accepted ten-row baseline'

target_identity="$("${psql_read[@]}" -AtF '|' -c "SELECT current_database(),current_user,(SELECT system_identifier::text FROM pg_control_system()),coalesce((SELECT ssl::text FROM pg_stat_ssl WHERE pid=pg_backend_pid()),'false')")"
[[ "$target_identity" = "railway|postgres|$STORYFORGE_EXPECTED_DB_SYSTEM_IDENTIFIER|true" ]] \
  || fail 'database target identity, principal, system identifier, or SSL differs'
pre_counts="$("${psql_read[@]}" -AtF '|' -c 'SELECT (SELECT count(*) FROM public.sf_users),(SELECT count(*) FROM public.sf_mentor_assignments WHERE active)')"
[[ "$pre_counts" = "$STORYFORGE_EXPECTED_USER_COUNT|$STORYFORGE_EXPECTED_ACTIVE_ASSIGNMENT_COUNT" ]] \
  || fail 'production user or assignment counts changed after backup'

if [[ "$mode" = preflight ]]; then
  printf 'B1_511_PRODUCTION_MIGRATION_PREFLIGHT_PASS\n'
  printf 'db_system_identifier=%s\npending_migrations=1\n' "$STORYFORGE_EXPECTED_DB_SYSTEM_IDENTIFIER"
  exit 0
fi

[[ "${STORYFORGE_MIGRATION_CONFIRM:-}" = B1-511-APPLY ]] || fail 'apply confirmation is absent'
{
  printf '%s\n' 'BEGIN;' "SELECT pg_advisory_xact_lock(hashtextextended('missionmed.storyforge.b1-511.production-migration',0));"
  printf "SELECT CASE WHEN (SELECT count(*) FROM public.sf_users)=%s AND (SELECT count(*) FROM public.sf_mentor_assignments WHERE active)=%s THEN 1 ELSE 1/0 END;\n" "$STORYFORGE_EXPECTED_USER_COUNT" "$STORYFORGE_EXPECTED_ACTIVE_ASSIGNMENT_COUNT"
  sed -E -e '/^[[:space:]]*\\set[[:space:]]+ON_ERROR_STOP[[:space:]]+on[[:space:]]*$/d' -e '/^[[:space:]]*BEGIN;[[:space:]]*$/d' -e '/^[[:space:]]*COMMIT;[[:space:]]*$/d' "$migration"
  printf "INSERT INTO public.sf_schema_migrations(version,file_name,sha256,git_commit,backup_id) VALUES('%s','%s','%s','%s','%s');\n" "$MIGRATION_VERSION" "$MIGRATION_FILE" "$MIGRATION_SHA256" "$STORYFORGE_DEPLOY_GIT_COMMIT" "$STORYFORGE_DB_BACKUP_ID"
  cat <<'SQL'
DO $b1_511_post$
BEGIN
  IF (SELECT count(*) FROM public.sf_feature_flags WHERE key IN ('story_workflow','story_taxonomy','inline_priority','story_search','mentor_notes') AND scope='off') <> 5 THEN
    RAISE EXCEPTION 'B1-511 feature flags are not all default-off';
  END IF;
  IF to_regclass('public.sf_mentor_notes') IS NULL OR to_regclass('public.sf_mentor_note_audio') IS NULL THEN
    RAISE EXCEPTION 'B1-511 mentor-note tables are absent';
  END IF;
  IF NOT (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='public.sf_mentor_notes'::regclass) THEN
    RAISE EXCEPTION 'B1-511 mentor-note RLS is not forced';
  END IF;
END
$b1_511_post$;
COMMIT;
SQL
} | "$psql_bin" -X -v ON_ERROR_STOP=1 --single-transaction

post_ledger="$("${psql_read[@]}" -AtF '|' --set=version="$MIGRATION_VERSION" -c "SELECT version,file_name,sha256,git_commit,backup_id FROM public.sf_schema_migrations WHERE version=:'version'")"
[[ "$post_ledger" = "$MIGRATION_VERSION|$MIGRATION_FILE|$MIGRATION_SHA256|$STORYFORGE_DEPLOY_GIT_COMMIT|$STORYFORGE_DB_BACKUP_ID" ]] \
  || fail 'post-migration ledger receipt differs'
printf 'B1_511_PRODUCTION_MIGRATION_APPLY_PASS\n'
