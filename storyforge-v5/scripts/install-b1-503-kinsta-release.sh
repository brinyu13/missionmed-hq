#!/usr/bin/env bash
set -euo pipefail

umask 077

usage() {
  cat >&2 <<'EOF'
Usage:
  install-b1-503-kinsta-release.sh preflight|install \
    --remote-root /absolute/wordpress/root \
    --release-commit <40-lowercase-hex> \
    --route-source /absolute/private/staging/missionmed-storyforge-route.php \
    --release-source /absolute/private/staging/release.php \
    --route-sha256 <64-lowercase-hex> \
    --route-size <bytes> \
    --release-sha256 <64-lowercase-hex> \
    --release-size <bytes> \
    --release-id <v-16-lowercase-hex> \
    --expected-owner <user:group> \
    --expected-current-target absent|releases/<40-lowercase-hex> \
    --expected-route-sha256 absent|<64-lowercase-hex> \
    --rollback-dir /absolute/private/rollback/directory \
    --wp-cli /absolute/path/to/wp \
    --php-cli /absolute/path/to/php \
    [--confirm B1-503-INSTALL]

The script runs on the Kinsta host. It does not open SSH itself. `preflight`
is read-only. `install` requires the exact confirmation token, creates a sealed
rollback receipt before activation, publishes one new immutable release
directory, atomically changes only the relative `current` link and the isolated
route file, then purges only Kinsta site and CDN caches.
EOF
  exit 2
}

fail() {
  printf 'B1-503 Kinsta install refused: %s\n' "$*" >&2
  exit 1
}

contains_control() {
  case "$1" in
    *$'\n'*|*$'\r'*|*$'\t'*) return 0 ;;
    *) return 1 ;;
  esac
}

require_safe_value() {
  local label="$1"
  local value="$2"
  [[ -n "$value" ]] || fail "$label is empty"
  if contains_control "$value"; then
    fail "$label contains a tab or line break"
  fi
}

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

file_size() {
  wc -c < "$1" | tr -d '[:space:]'
}

file_mode() {
  if stat -c '%a' "$1" >/dev/null 2>&1; then
    stat -c '%a' "$1"
  else
    stat -f '%Lp' "$1"
  fi
}

file_owner() {
  if stat -c '%U:%G' "$1" >/dev/null 2>&1; then
    stat -c '%U:%G' "$1"
  else
    stat -f '%Su:%Sg' "$1"
  fi
}

require_owner() {
  local path="$1"
  local actual
  actual="$(file_owner "$path")"
  [[ "$actual" = "$expected_owner" ]] \
    || fail "owner mismatch for $path (expected $expected_owner, found $actual)"
}

require_regular_file() {
  local label="$1"
  local path="$2"
  [[ -f "$path" && ! -L "$path" ]] || fail "$label is not a regular non-symlink file: $path"
}

require_file_identity() {
  local label="$1"
  local path="$2"
  local expected_hash="$3"
  local expected_bytes="$4"
  local actual_hash
  local actual_bytes
  require_regular_file "$label" "$path"
  actual_hash="$(sha256_file "$path")"
  actual_bytes="$(file_size "$path")"
  [[ "$actual_hash" = "$expected_hash" ]] \
    || fail "$label SHA-256 mismatch (expected $expected_hash, found $actual_hash)"
  [[ "$actual_bytes" = "$expected_bytes" ]] \
    || fail "$label size mismatch (expected $expected_bytes, found $actual_bytes)"
}

verify_feature_off() {
  "$wp_cli" --path="$remote_root" eval '
$settings = get_option("missionmed_storyforge_settings", array());
if (!is_array($settings) || !array_key_exists("storyforge_enabled", $settings)) {
    throw new RuntimeException("StoryForge settings or feature flag unavailable");
}
if (!empty($settings["storyforge_enabled"])) {
    throw new RuntimeException("StoryForge feature flag is not off");
}
echo "storyforge_enabled=false\n";
' >/dev/null
}

purge_scoped_kinsta_caches() {
  B1_503_REMOTE_ROOT="$remote_root" "$php_cli" \
    -d display_errors=0 \
    -d error_reporting=0 \
    -d log_errors=0 \
    -r '
function b1_503_cache_purge_fail($message, $exit_code) {
    fwrite(STDERR, "B1-503 scoped cache purge refused: " . $message . PHP_EOL);
    exit($exit_code);
}

function b1_503_validate_cache_purge_response($label, $response, $exit_code) {
    if (is_wp_error($response)) {
        b1_503_cache_purge_fail($label . " cache purge returned WP_Error", $exit_code);
    }
    if (200 !== (int) wp_remote_retrieve_response_code($response)) {
        b1_503_cache_purge_fail($label . " cache purge did not return HTTP 200", $exit_code);
    }
    if ("Cache has been cleared." !== (string) wp_remote_retrieve_body($response)) {
        b1_503_cache_purge_fail($label . " cache purge returned an unexpected body", $exit_code);
    }
}

$remote_root = getenv("B1_503_REMOTE_ROOT");
if (!is_string($remote_root) || "" === $remote_root) {
    b1_503_cache_purge_fail("remote root is unavailable", 70);
}
require $remote_root . "/wp-load.php";

global $kinsta_muplugin;
if (!is_object($kinsta_muplugin) || !isset($kinsta_muplugin->kinsta_cache_purge)
    || !is_object($kinsta_muplugin->kinsta_cache_purge)) {
    b1_503_cache_purge_fail("Kinsta cache API is unavailable", 71);
}

$purger = $kinsta_muplugin->kinsta_cache_purge;
if (!is_callable(array($purger, "purge_complete_site_cache"))) {
    b1_503_cache_purge_fail("Kinsta site-cache purge method is unavailable", 72);
}
if (!is_callable(array($purger, "purge_complete_cdn_cache"))) {
    b1_503_cache_purge_fail("Kinsta CDN-cache purge method is unavailable", 73);
}

$site_response = $purger->purge_complete_site_cache();
b1_503_validate_cache_purge_response("site", $site_response, 74);

$cdn_response = $purger->purge_complete_cdn_cache();
b1_503_validate_cache_purge_response("CDN", $cdn_response, 75);
'
}

atomic_replace_pointer() {
  local source="$1"
  local destination="$2"
  if mv --help 2>/dev/null | grep -q -- '--no-target-directory'; then
    mv -fT "$source" "$destination"
  else
    mv -fh "$source" "$destination"
  fi
}

mode=""
remote_root=""
release_commit=""
route_source=""
release_source=""
route_sha256=""
route_size=""
release_sha256=""
release_size=""
release_id=""
expected_owner=""
expected_current_target=""
expected_route_sha256=""
rollback_dir=""
wp_cli=""
php_cli=""
confirm=""

[[ $# -ge 1 ]] || usage
mode="$1"
shift
while [[ $# -gt 0 ]]; do
  case "$1" in
    --remote-root) [[ $# -ge 2 ]] || usage; remote_root="$2"; shift 2 ;;
    --release-commit) [[ $# -ge 2 ]] || usage; release_commit="$2"; shift 2 ;;
    --route-source) [[ $# -ge 2 ]] || usage; route_source="$2"; shift 2 ;;
    --release-source) [[ $# -ge 2 ]] || usage; release_source="$2"; shift 2 ;;
    --route-sha256) [[ $# -ge 2 ]] || usage; route_sha256="$2"; shift 2 ;;
    --route-size) [[ $# -ge 2 ]] || usage; route_size="$2"; shift 2 ;;
    --release-sha256) [[ $# -ge 2 ]] || usage; release_sha256="$2"; shift 2 ;;
    --release-size) [[ $# -ge 2 ]] || usage; release_size="$2"; shift 2 ;;
    --release-id) [[ $# -ge 2 ]] || usage; release_id="$2"; shift 2 ;;
    --expected-owner) [[ $# -ge 2 ]] || usage; expected_owner="$2"; shift 2 ;;
    --expected-current-target) [[ $# -ge 2 ]] || usage; expected_current_target="$2"; shift 2 ;;
    --expected-route-sha256) [[ $# -ge 2 ]] || usage; expected_route_sha256="$2"; shift 2 ;;
    --rollback-dir) [[ $# -ge 2 ]] || usage; rollback_dir="$2"; shift 2 ;;
    --wp-cli) [[ $# -ge 2 ]] || usage; wp_cli="$2"; shift 2 ;;
    --php-cli) [[ $# -ge 2 ]] || usage; php_cli="$2"; shift 2 ;;
    --confirm) [[ $# -ge 2 ]] || usage; confirm="$2"; shift 2 ;;
    *) usage ;;
  esac
done

[[ "$mode" = "preflight" || "$mode" = "install" ]] || usage
for pair in \
  "remote root|$remote_root" \
  "release commit|$release_commit" \
  "route source|$route_source" \
  "release source|$release_source" \
  "route SHA-256|$route_sha256" \
  "route size|$route_size" \
  "release SHA-256|$release_sha256" \
  "release size|$release_size" \
  "release ID|$release_id" \
  "expected owner|$expected_owner" \
  "expected current target|$expected_current_target" \
  "expected route SHA-256|$expected_route_sha256" \
  "rollback directory|$rollback_dir" \
  "WP CLI|$wp_cli" \
  "PHP CLI|$php_cli"; do
  require_safe_value "${pair%%|*}" "${pair#*|}"
done

[[ "$remote_root" = /* && "$remote_root" != "/" ]] || fail "remote root must be an absolute non-root path"
[[ "$route_source" = /* && "$release_source" = /* ]] || fail "artifact sources must be absolute paths"
[[ "$rollback_dir" = /* && "$rollback_dir" != "/" ]] || fail "rollback directory must be an absolute non-root path"
[[ "$wp_cli" = /* && -x "$wp_cli" ]] || fail "WP CLI must be an absolute executable path"
[[ "$php_cli" = /* && -x "$php_cli" ]] || fail "PHP CLI must be an absolute executable path"
[[ "$release_commit" =~ ^[a-f0-9]{40}$ ]] || fail "release commit must be a full lowercase commit"
[[ "$route_sha256" =~ ^[a-f0-9]{64}$ ]] || fail "route SHA-256 is invalid"
[[ "$release_sha256" =~ ^[a-f0-9]{64}$ ]] || fail "release SHA-256 is invalid"
[[ "$route_size" =~ ^[1-9][0-9]*$ ]] || fail "route size must be a positive integer"
[[ "$release_size" =~ ^[1-9][0-9]*$ ]] || fail "release size must be a positive integer"
[[ "$release_id" =~ ^v-[a-f0-9]{16}$ ]] || fail "release ID is invalid"
[[ "$expected_owner" =~ ^[A-Za-z_][A-Za-z0-9._-]*:[A-Za-z_][A-Za-z0-9._-]*$ ]] \
  || fail "expected owner must use user:group syntax"
if [[ "$expected_current_target" != "absent" ]]; then
  [[ "$expected_current_target" =~ ^releases/[a-f0-9]{40}$ ]] \
    || fail "expected current target must be absent or an exact relative release target"
fi
if [[ "$expected_route_sha256" != "absent" ]]; then
  [[ "$expected_route_sha256" =~ ^[a-f0-9]{64}$ ]] \
    || fail "expected route SHA-256 must be absent or a lowercase SHA-256"
fi

[[ -d "$remote_root" && ! -L "$remote_root" ]] || fail "remote root is not a real directory"
canonical_remote_root="$(realpath "$remote_root")"
[[ "$canonical_remote_root" = "${remote_root%/}" ]] || fail "remote root must be its canonical physical path"
remote_root="$canonical_remote_root"

mu_root="$remote_root/wp-content/mu-plugins"
runtime_root="$mu_root/missionmed-storyforge-runtime"
releases_root="$runtime_root/releases"
current_link="$runtime_root/current"
route_target="$mu_root/missionmed-storyforge-route.php"
release_target="$releases_root/$release_commit"
release_target_file="$release_target/release.php"

for directory in "$mu_root" "$runtime_root" "$releases_root"; do
  [[ -d "$directory" && ! -L "$directory" ]] || fail "required runtime directory is not a real directory: $directory"
  [[ "$(realpath "$directory")" = "$directory" ]] || fail "runtime directory is not canonical: $directory"
  require_owner "$directory"
done

require_regular_file "route source" "$route_source"
require_regular_file "release source" "$release_source"
canonical_route_source="$(realpath "$route_source")"
canonical_release_source="$(realpath "$release_source")"
[[ "$route_source" = "$canonical_route_source" ]] \
  || fail "route source must be a canonical non-symlink path"
[[ "$release_source" = "$canonical_release_source" ]] \
  || fail "release source must be a canonical non-symlink path"
route_source="$canonical_route_source"
release_source="$canonical_release_source"
case "$route_source" in "$remote_root"/*) fail "route source must be staged outside the public WordPress root" ;; esac
case "$release_source" in "$remote_root"/*) fail "release source must be staged outside the public WordPress root" ;; esac
require_file_identity "route source" "$route_source" "$route_sha256" "$route_size"
require_file_identity "release source" "$release_source" "$release_sha256" "$release_size"
"$php_cli" -l "$route_source" >/dev/null
"$php_cli" -l "$release_source" >/dev/null
grep -Fq "define( 'MMSFR_RELEASE_ID', '$release_id' );" "$route_source" \
  || fail "route source does not pin release ID $release_id"
grep -Fq "define( 'MMSFR_RELEASE_PHP_SHA256', '$release_sha256' );" "$route_source" \
  || fail "route source does not pin the release SHA-256"
grep -Fq "define( 'MMSFR_RELEASE_PHP_SIZE', $release_size );" "$route_source" \
  || fail "route source does not pin the release size"
grep -Fq "'release_id' => '$release_id'," "$release_source" \
  || fail "release bundle does not contain the expected release ID"

if [[ -e "$release_target" || -L "$release_target" ]]; then
  fail "commit-named release target already exists: $release_target"
fi

if [[ "$expected_current_target" = "absent" ]]; then
  [[ ! -e "$current_link" && ! -L "$current_link" ]] || fail "current pointer was expected to be absent"
else
  [[ -L "$current_link" ]] || fail "current pointer is not the expected symlink"
  [[ "$(readlink "$current_link")" = "$expected_current_target" ]] \
    || fail "current pointer target differs from the explicit prestate"
  prior_selected="$runtime_root/$expected_current_target"
  [[ -d "$prior_selected" && ! -L "$prior_selected" ]] \
    || fail "prior current target is not a real release directory"
  [[ "$(realpath "$current_link")" = "$(realpath "$prior_selected")" ]] \
    || fail "prior current pointer does not resolve to its exact target"
fi

if [[ "$expected_route_sha256" = "absent" ]]; then
  [[ ! -e "$route_target" && ! -L "$route_target" ]] || fail "route was expected to be absent"
else
  require_regular_file "active route" "$route_target"
  [[ "$(sha256_file "$route_target")" = "$expected_route_sha256" ]] \
    || fail "active route differs from the explicit prestate"
  require_owner "$route_target"
fi

rollback_parent="$(dirname "$rollback_dir")"
rollback_leaf="$(basename "$rollback_dir")"
[[ -d "$rollback_parent" && ! -L "$rollback_parent" ]] || fail "rollback parent is not a real directory"
canonical_rollback_parent="$(realpath "$rollback_parent")"
[[ "$rollback_dir" = "$canonical_rollback_parent/$rollback_leaf" ]] \
  || fail "rollback directory must use a canonical parent and one explicit child"
[[ ! -e "$rollback_dir" && ! -L "$rollback_dir" ]] || fail "rollback directory already exists"
require_owner "$rollback_parent"

verify_feature_off

if [[ "$mode" = "preflight" ]]; then
  printf '%s\n' "B1_503_KINSTA_INSTALL_PREFLIGHT_PASS"
  printf 'release_commit=%s\nrelease_id=%s\n' "$release_commit" "$release_id"
  exit 0
fi

[[ "$confirm" = "B1-503-INSTALL" ]] || fail "install mode requires --confirm B1-503-INSTALL"

lock_dir="$rollback_parent/.b1-503-cutover-lock"
stage_dir=""
stage_published=0
releases_root_original_mode=""
runtime_root_original_mode=""
mu_root_original_mode=""

cleanup() {
  local exit_code=$?
  trap - EXIT
  if [[ -n "$stage_dir" && "$stage_published" = "0" && -d "$stage_dir" && ! -L "$stage_dir" ]]; then
    chmod u+w "$stage_dir" 2>/dev/null || true
    if [[ -f "$stage_dir/release.php" && ! -L "$stage_dir/release.php" ]]; then
      rm -f "$stage_dir/release.php" 2>/dev/null || true
    fi
    rmdir "$stage_dir" 2>/dev/null || true
  fi
  if [[ -n "$releases_root_original_mode" ]]; then
    chmod "$releases_root_original_mode" "$releases_root" 2>/dev/null || true
  fi
  if [[ -n "$runtime_root_original_mode" ]]; then
    chmod "$runtime_root_original_mode" "$runtime_root" 2>/dev/null || true
  fi
  if [[ -n "$mu_root_original_mode" ]]; then
    chmod "$mu_root_original_mode" "$mu_root" 2>/dev/null || true
  fi
  if [[ -d "$lock_dir" && ! -L "$lock_dir" ]]; then
    rmdir "$lock_dir" 2>/dev/null || true
  fi
  exit "$exit_code"
}
trap cleanup EXIT

mkdir "$lock_dir" 2>/dev/null || fail "another install holds the explicit cutover lock"

# Recheck the mutation-sensitive prestate after acquiring the lock.
[[ ! -e "$release_target" && ! -L "$release_target" ]] || fail "release target appeared after preflight"
if [[ "$expected_current_target" = "absent" ]]; then
  [[ ! -e "$current_link" && ! -L "$current_link" ]] || fail "current pointer changed after preflight"
else
  [[ -L "$current_link" && "$(readlink "$current_link")" = "$expected_current_target" ]] \
    || fail "current pointer changed after preflight"
fi
if [[ "$expected_route_sha256" = "absent" ]]; then
  [[ ! -e "$route_target" && ! -L "$route_target" ]] || fail "route changed after preflight"
else
  require_regular_file "active route" "$route_target"
  [[ "$(sha256_file "$route_target")" = "$expected_route_sha256" ]] \
    || fail "route changed after preflight"
fi
verify_feature_off

mkdir -m 0700 "$rollback_dir"
manifest="$rollback_dir/rollback.tsv"
prior_route_backup="-"
prior_route_state="absent"
prior_route_hash="-"
prior_route_size="-"
prior_route_mode="-"
if [[ "$expected_route_sha256" != "absent" ]]; then
  prior_route_state="present"
  prior_route_hash="$(sha256_file "$route_target")"
  prior_route_size="$(file_size "$route_target")"
  prior_route_mode="$(file_mode "$route_target")"
  prior_route_backup="prior-route.php"
  cp -p "$route_target" "$rollback_dir/$prior_route_backup"
  require_file_identity "rollback route backup" "$rollback_dir/$prior_route_backup" \
    "$prior_route_hash" "$prior_route_size"
  chmod 0400 "$rollback_dir/$prior_route_backup"
fi
prior_current_state="absent"
prior_current_target="-"
if [[ "$expected_current_target" != "absent" ]]; then
  prior_current_state="present"
  prior_current_target="$expected_current_target"
fi

{
  printf 'format\tB1-503-KINSTA-ROLLBACK-V1\n'
  printf 'remote_root\t%s\n' "$remote_root"
  printf 'expected_owner\t%s\n' "$expected_owner"
  printf 'installed_commit\t%s\n' "$release_commit"
  printf 'installed_release_id\t%s\n' "$release_id"
  printf 'installed_route_sha256\t%s\n' "$route_sha256"
  printf 'installed_route_size\t%s\n' "$route_size"
  printf 'installed_release_sha256\t%s\n' "$release_sha256"
  printf 'installed_release_size\t%s\n' "$release_size"
  printf 'prior_current_state\t%s\n' "$prior_current_state"
  printf 'prior_current_target\t%s\n' "$prior_current_target"
  printf 'prior_route_state\t%s\n' "$prior_route_state"
  printf 'prior_route_sha256\t%s\n' "$prior_route_hash"
  printf 'prior_route_size\t%s\n' "$prior_route_size"
  printf 'prior_route_mode\t%s\n' "$prior_route_mode"
  printf 'prior_route_backup\t%s\n' "$prior_route_backup"
} > "$manifest"
chmod 0400 "$manifest"
chmod 0500 "$rollback_dir"
receipt_sha256="$(sha256_file "$manifest")"

releases_root_original_mode="$(file_mode "$releases_root")"
chmod u+w "$releases_root"
stage_dir="$releases_root/.b1-503-stage-$release_commit-$$"
[[ ! -e "$stage_dir" && ! -L "$stage_dir" ]] || fail "release staging directory already exists"
mkdir -m 0700 "$stage_dir"
cp -p "$release_source" "$stage_dir/release.php"
chmod 0444 "$stage_dir/release.php"
require_file_identity "staged release" "$stage_dir/release.php" "$release_sha256" "$release_size"
require_owner "$stage_dir"
require_owner "$stage_dir/release.php"
chmod 0555 "$stage_dir"
mv "$stage_dir" "$release_target"
stage_published=1
stage_dir=""
chmod "$releases_root_original_mode" "$releases_root"
releases_root_original_mode=""
[[ -d "$release_target" && ! -L "$release_target" ]] || fail "published release is not a real directory"
[[ "$(file_mode "$release_target")" = "555" ]] || fail "published release directory mode is not 0555"
[[ "$(file_mode "$release_target_file")" = "444" ]] || fail "published release file mode is not 0444"
require_file_identity "published release" "$release_target_file" "$release_sha256" "$release_size"
require_owner "$release_target"
require_owner "$release_target_file"

runtime_root_original_mode="$(file_mode "$runtime_root")"
chmod u+w "$runtime_root"
pointer_temp="$runtime_root/.current.b1-503-$release_commit-$$"
[[ ! -e "$pointer_temp" && ! -L "$pointer_temp" ]] || fail "temporary pointer already exists"
ln -s "releases/$release_commit" "$pointer_temp"
[[ "$(readlink "$pointer_temp")" = "releases/$release_commit" ]] || fail "temporary pointer is not exact and relative"
atomic_replace_pointer "$pointer_temp" "$current_link"
chmod "$runtime_root_original_mode" "$runtime_root"
runtime_root_original_mode=""

mu_root_original_mode="$(file_mode "$mu_root")"
chmod u+w "$mu_root"
route_temp="$mu_root/.missionmed-storyforge-route.php.b1-503-$$"
[[ ! -e "$route_temp" && ! -L "$route_temp" ]] || fail "temporary route path already exists"
cp -p "$route_source" "$route_temp"
chmod 0444 "$route_temp"
require_file_identity "staged route" "$route_temp" "$route_sha256" "$route_size"
require_owner "$route_temp"
mv -f "$route_temp" "$route_target"
chmod "$mu_root_original_mode" "$mu_root"
mu_root_original_mode=""

[[ -L "$current_link" ]] || fail "installed current pointer is not a symlink"
[[ "$(readlink "$current_link")" = "releases/$release_commit" ]] \
  || fail "installed current pointer is not the exact relative target"
[[ "$(realpath "$current_link")" = "$(realpath "$release_target")" ]] \
  || fail "installed current pointer does not resolve to the commit-named release"
require_file_identity "installed route" "$route_target" "$route_sha256" "$route_size"
[[ "$(file_mode "$route_target")" = "444" ]] || fail "installed route mode is not 0444"
require_owner "$route_target"
verify_feature_off

purge_scoped_kinsta_caches
verify_feature_off

printf '%s\n' "B1_503_KINSTA_INSTALL_PASS"
printf 'release_commit=%s\nrelease_id=%s\n' "$release_commit" "$release_id"
printf 'rollback_receipt=%s\nrollback_receipt_sha256=%s\n' "$manifest" "$receipt_sha256"
