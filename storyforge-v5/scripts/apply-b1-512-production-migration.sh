#!/usr/bin/env bash
set -euo pipefail
umask 077

PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPOSITORY_DIR="$(cd "$PACKAGE_DIR/.." && pwd)"
MIGRATION_VERSION="20260806190000"
MIGRATION_FILE="20260806190000_b1_512_concrete_configuration_media.sql"
MIGRATION_SHA256="ab05da6827694b0c364f98bfaf5226a0008dfde915337e85136a475aaf0ff02e"
EXPECTED_SYSTEM_IDENTIFIER="7667256745042145332"
EXPECTED_USER_COUNT="441"
EXPECTED_ACTIVE_ASSIGNMENT_COUNT="0"

fail() { printf 'Refusing B1-512 production migration: %s\n' "$*" >&2; exit 1; }
sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}';
  else shasum -a 256 "$1" | awk '{print $1}'; fi
}

[[ $# = 1 ]] || fail 'usage: apply-b1-512-production-migration.sh preflight|apply'
mode="$1"
[[ "$mode" = preflight || "$mode" = apply ]] || fail 'mode must be preflight or apply'
for variable_name in STORYFORGE_DATABASE_URL STORYFORGE_DEPLOY_GIT_COMMIT STORYFORGE_DB_BACKUP_ID STORYFORGE_DB_BACKUP_PATH STORYFORGE_DB_BACKUP_SHA256; do
  [[ -n "${!variable_name:-}" ]] || fail "$variable_name is required"
done
[[ "$STORYFORGE_DEPLOY_GIT_COMMIT" =~ ^[a-f0-9]{40}$ ]] || fail 'deploy commit is invalid'
[[ "$STORYFORGE_DB_BACKUP_ID" =~ ^[a-f0-9-]{36}$ ]] || fail 'backup ID is invalid'
[[ "$STORYFORGE_DB_BACKUP_SHA256" =~ ^[a-f0-9]{64}$ ]] || fail 'backup hash is invalid'
[[ -f "$STORYFORGE_DB_BACKUP_PATH" && ! -L "$STORYFORGE_DB_BACKUP_PATH" ]] || fail 'backup is absent or symlinked'
[[ "$(sha256_file "$STORYFORGE_DB_BACKUP_PATH")" = "$STORYFORGE_DB_BACKUP_SHA256" ]] || fail 'backup hash differs'

migration="$PACKAGE_DIR/infra/postgres/migrations/$MIGRATION_FILE"
[[ -f "$migration" && ! -L "$migration" ]] || fail 'migration source is absent or symlinked'
[[ "$(sha256_file "$migration")" = "$MIGRATION_SHA256" ]] || fail 'migration source hash differs'
actual_head="$(git -C "$REPOSITORY_DIR" rev-parse HEAD)"
[[ "$actual_head" = "$STORYFORGE_DEPLOY_GIT_COMMIT" ]] || fail 'Git HEAD differs from deploy commit'
[[ -z "$(git -C "$REPOSITORY_DIR" status --porcelain)" ]] || fail 'Git worktree is not clean'
committed_hash="$(git -C "$REPOSITORY_DIR" show "$actual_head:storyforge-v5/infra/postgres/migrations/$MIGRATION_FILE" | sha256_file /dev/stdin)"
[[ "$committed_hash" = "$MIGRATION_SHA256" ]] || fail 'deploy commit does not contain the exact migration'

psql_bin="$(command -v psql || true)"
[[ -n "$psql_bin" && "$psql_bin" = /* && -x "$psql_bin" ]] || fail 'psql is unavailable'
[[ "$($psql_bin --version | sed -E 's/^psql \(PostgreSQL\) ([0-9]+).*/\1/')" = 18 ]] || fail 'PostgreSQL 18 psql is required'
database_url="$STORYFORGE_DATABASE_URL"
unset STORYFORGE_DATABASE_URL PGHOST PGPORT PGUSER PGPASSWORD PGHOSTADDR PGSERVICE PGSERVICEFILE
export PGSSLMODE=require
psql_read=("$psql_bin" --dbname="$database_url" -X -v ON_ERROR_STOP=1)

expected_pre_ledger='20260726150000|20260726150000_b1_500_storyforge_v5_foundation.sql|93018d16582890890ac9ad696cdfd11b5d8118afa55a709725c531a52fae6a1f
20260727170000|20260727170000_b1_502_storyforge_submit_assignment_gate.sql|95269aeb5a414656c92246ea8e798faac7f0b33d7062540b187f30b8a781315f
20260727190000|20260727190000_b1_502_storyforge_background_preference.sql|ee8ad5cf0a1b850a23c015a07a0f762de2a4b588abbd29a381b35c2db6d79405
20260728045100|20260728045100_b1_503_story_domain_conformance.sql|fea497dc32a07ac2c05b8ae21caa6b77d85cc4a571b30816432016719a9a8a68
20260728045444|20260728045444_b1_503_interview_mentor_conformance.sql|5b3ea347c1dfb36b22cab81ed6042e0d6e10e2786febb67e83214b56dd4071e2
20260729000100|20260729000100_b1_506_voice_recording_sessions.sql|6f6a3340bc29d1222b5f78472eb9a4897739722d090241de6d64f3e8f781c9c2
20260729000200|20260729000200_b1_506_feature_flags.sql|8899d7d6525c0cbc72790378fcf6a2d8aeb4bc1e7b8afac737be6c3e9af34c3a
20260729010000|20260729010000_b1_506a_voice_audit_lifecycle.sql|e67561cc087e2d71d5d7f65ba3033eff06c0dd328a6e43b3915aa58ba1e74323
20260730000100|20260730000100_b1_507b_reconciliation_state.sql|ae86a5ea104becf7dff244fa3188338f8ad13eef58190abd47522ca2e2e733d7
20260801190000|20260801190000_b1_510i_admin_console.sql|3c4478f0cf6261e007f9738fb398b4b64669150840261b09d6223eb2120c8641
20260805190000|20260805190000_b1_511_workflow_taxonomy_mentor_notes.sql|9bae7859f5966a8e9fc2f29fe9ccb37b0e59675e830c6b7ccdaef3914532c05f
20260806130000|20260806130000_b1_511a_wordpress_admin_authority.sql|4dfcea71718cfb268bb3b8716b6968df5f678690d0465f941ec2e0501c32f5c1'

actual_pre_ledger="$("${psql_read[@]}" -AtF '|' -c 'SELECT version,file_name,sha256 FROM public.sf_schema_migrations ORDER BY version')"
pending=1
if [[ "$actual_pre_ledger" != "$expected_pre_ledger" ]]; then
  ledger_without_target="$("${psql_read[@]}" -AtF '|' -c "SELECT version,file_name,sha256 FROM public.sf_schema_migrations WHERE version::bigint<>$MIGRATION_VERSION ORDER BY version")"
  applied_row="$("${psql_read[@]}" -AtF '|' -c "SELECT version,file_name,sha256,git_commit,backup_id FROM public.sf_schema_migrations WHERE version::bigint=$MIGRATION_VERSION")"
  expected_applied="$MIGRATION_VERSION|$MIGRATION_FILE|$MIGRATION_SHA256|$STORYFORGE_DEPLOY_GIT_COMMIT|$STORYFORGE_DB_BACKUP_ID"
  [[ "$ledger_without_target" = "$expected_pre_ledger" && "$applied_row" = "$expected_applied" ]] || fail 'production migration ledger differs from the accepted state'
  pending=0
fi
target_identity="$("${psql_read[@]}" -AtF '|' -c 'SELECT current_database(),current_user,(SELECT system_identifier::text FROM pg_control_system()),coalesce((SELECT ssl::text FROM pg_stat_ssl WHERE pid=pg_backend_pid()),false::text)')"
[[ "$target_identity" = "railway|postgres|$EXPECTED_SYSTEM_IDENTIFIER|true" ]] || fail 'database target identity differs'
pre_counts="$("${psql_read[@]}" -AtF '|' -c 'SELECT (SELECT count(*) FROM public.sf_users),(SELECT count(*) FROM public.sf_mentor_assignments WHERE active)')"
[[ "$pre_counts" = "$EXPECTED_USER_COUNT|$EXPECTED_ACTIVE_ASSIGNMENT_COUNT" ]] || fail 'production counts changed after backup'
if [[ "$mode" = preflight ]]; then printf 'B1_512_PRODUCTION_MIGRATION_PREFLIGHT_PASS\npending_migrations=%s\n' "$pending"; exit 0; fi
[[ "${STORYFORGE_MIGRATION_CONFIRM:-}" = B1-512-APPLY ]] || fail 'apply confirmation is absent'
if [[ "$pending" = 0 ]]; then printf 'B1_512_PRODUCTION_MIGRATION_ALREADY_APPLIED_PASS\n'; exit 0; fi
{
  printf '%s\n' "SELECT pg_advisory_xact_lock(hashtextextended('missionmed.storyforge.b1-512.production-migration',0));"
  sed -E -e '/^[[:space:]]*BEGIN;[[:space:]]*$/d' -e '/^[[:space:]]*COMMIT;[[:space:]]*$/d' "$migration"
  printf "INSERT INTO public.sf_schema_migrations(version,file_name,sha256,git_commit,backup_id) VALUES('%s','%s','%s','%s','%s');\n" "$MIGRATION_VERSION" "$MIGRATION_FILE" "$MIGRATION_SHA256" "$STORYFORGE_DEPLOY_GIT_COMMIT" "$STORYFORGE_DB_BACKUP_ID"
} | "$psql_bin" --dbname="$database_url" -X -v ON_ERROR_STOP=1 --single-transaction
post_row="$("${psql_read[@]}" -AtF '|' -c "SELECT version,file_name,sha256,git_commit,backup_id FROM public.sf_schema_migrations WHERE version::bigint=$MIGRATION_VERSION")"
[[ "$post_row" = "$MIGRATION_VERSION|$MIGRATION_FILE|$MIGRATION_SHA256|$STORYFORGE_DEPLOY_GIT_COMMIT|$STORYFORGE_DB_BACKUP_ID" ]] || fail 'post-migration ledger differs'
post_counts="$("${psql_read[@]}" -AtF '|' -c 'SELECT (SELECT count(*) FROM public.sf_users),(SELECT count(*) FROM public.sf_mentor_assignments WHERE active)')"
[[ "$post_counts" = "$pre_counts" ]] || fail 'production counts changed during migration'
forced_rls="$("${psql_read[@]}" -AtF '|' -c "SELECT count(*) FROM pg_class WHERE relname IN ('sf_storyforge_configuration','sf_storyforge_configuration_history','sf_story_media','sf_story_media_deletion_intents') AND relforcerowsecurity")"
[[ "$forced_rls" = 4 ]] || fail 'B1-512 forced RLS verification failed'
printf 'B1_512_PRODUCTION_MIGRATION_APPLY_PASS\n'
