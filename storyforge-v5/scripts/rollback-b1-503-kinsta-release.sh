#!/usr/bin/env bash
set -euo pipefail

umask 077

usage() {
  cat >&2 <<'EOF'
Usage:
  rollback-b1-503-kinsta-release.sh preflight|rollback \
    --remote-root /absolute/wordpress/root \
    --receipt /absolute/private/rollback/rollback.tsv \
    --receipt-sha256 <64-lowercase-hex> \
    --wp-cli /absolute/path/to/wp \
    --php-cli /absolute/path/to/php \
    [--confirm B1-503-ROLLBACK]

The script runs on the Kinsta host. `preflight` is read-only. `rollback`
first forces the StoryForge feature flag off, preserves the observed active
route/pointer beside the receipt, restores only the exact prior relative
pointer and route captured by the sealed install receipt, and purges only
Kinsta site and CDN caches. Release directories are never deleted or changed.
EOF
  exit 2
}

fail() {
  printf 'B1-503 Kinsta rollback refused: %s\n' "$*" >&2
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

force_feature_off() {
  "$wp_cli" --path="$remote_root" eval '
$settings = get_option("missionmed_storyforge_settings", array());
if (!is_array($settings)) {
    throw new RuntimeException("StoryForge settings unavailable");
}
$settings["storyforge_enabled"] = false;
if (!update_option("missionmed_storyforge_settings", $settings, false)) {
    $unchanged = get_option("missionmed_storyforge_settings", array());
    if (!is_array($unchanged) || !empty($unchanged["storyforge_enabled"])) {
        throw new RuntimeException("StoryForge feature-off update failed");
    }
}
$verify = get_option("missionmed_storyforge_settings", array());
if (!is_array($verify) || !array_key_exists("storyforge_enabled", $verify)
    || !empty($verify["storyforge_enabled"])) {
    throw new RuntimeException("StoryForge feature-off verification failed");
}
echo "storyforge_enabled=false\n";
' >/dev/null
}

verify_feature_off() {
  "$wp_cli" --path="$remote_root" eval '
$settings = get_option("missionmed_storyforge_settings", array());
if (!is_array($settings) || !array_key_exists("storyforge_enabled", $settings)
    || !empty($settings["storyforge_enabled"])) {
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
receipt=""
receipt_sha256=""
wp_cli=""
php_cli=""
confirm=""

[[ $# -ge 1 ]] || usage
mode="$1"
shift
while [[ $# -gt 0 ]]; do
  case "$1" in
    --remote-root) [[ $# -ge 2 ]] || usage; remote_root="$2"; shift 2 ;;
    --receipt) [[ $# -ge 2 ]] || usage; receipt="$2"; shift 2 ;;
    --receipt-sha256) [[ $# -ge 2 ]] || usage; receipt_sha256="$2"; shift 2 ;;
    --wp-cli) [[ $# -ge 2 ]] || usage; wp_cli="$2"; shift 2 ;;
    --php-cli) [[ $# -ge 2 ]] || usage; php_cli="$2"; shift 2 ;;
    --confirm) [[ $# -ge 2 ]] || usage; confirm="$2"; shift 2 ;;
    *) usage ;;
  esac
done

[[ "$mode" = "preflight" || "$mode" = "rollback" ]] || usage
for value in "$remote_root" "$receipt" "$receipt_sha256" "$wp_cli" "$php_cli"; do
  [[ -n "$value" ]] || fail "a required argument is empty"
  contains_control "$value" && fail "an argument contains a tab or line break"
done
[[ "$remote_root" = /* && "$remote_root" != "/" ]] || fail "remote root must be an absolute non-root path"
[[ "$receipt" = /* ]] || fail "receipt path must be absolute"
[[ "$receipt_sha256" =~ ^[a-f0-9]{64}$ ]] || fail "receipt SHA-256 is invalid"
[[ "$wp_cli" = /* && -x "$wp_cli" ]] || fail "WP CLI must be an absolute executable path"
[[ "$php_cli" = /* && -x "$php_cli" ]] || fail "PHP CLI must be an absolute executable path"

require_regular_file "rollback receipt" "$receipt"
[[ "$(sha256_file "$receipt")" = "$receipt_sha256" ]] || fail "rollback receipt SHA-256 mismatch"
receipt_dir="$(dirname "$receipt")"
[[ "$(basename "$receipt")" = "rollback.tsv" ]] || fail "rollback receipt filename must be rollback.tsv"
[[ -d "$receipt_dir" && ! -L "$receipt_dir" ]] || fail "rollback receipt parent is not a real directory"
[[ "$(realpath "$receipt")" = "$receipt" ]] || fail "rollback receipt path must be canonical"

format=""
receipt_remote_root=""
expected_owner=""
installed_commit=""
installed_release_id=""
installed_route_sha256=""
installed_route_size=""
installed_release_sha256=""
installed_release_size=""
prior_current_state=""
prior_current_target=""
prior_route_state=""
prior_route_sha256=""
prior_route_size=""
prior_route_mode=""
prior_route_backup=""
field_count=0

while IFS=$'\t' read -r key value extra || [[ -n "$key" ]]; do
  [[ -n "$key" && -n "$value" && -z "${extra:-}" ]] || fail "rollback receipt has a malformed row"
  contains_control "$key" && fail "rollback receipt key contains control data"
  contains_control "$value" && fail "rollback receipt value contains control data"
  case "$key" in
    format) [[ -z "$format" ]] || fail "duplicate receipt field: $key"; format="$value" ;;
    remote_root) [[ -z "$receipt_remote_root" ]] || fail "duplicate receipt field: $key"; receipt_remote_root="$value" ;;
    expected_owner) [[ -z "$expected_owner" ]] || fail "duplicate receipt field: $key"; expected_owner="$value" ;;
    installed_commit) [[ -z "$installed_commit" ]] || fail "duplicate receipt field: $key"; installed_commit="$value" ;;
    installed_release_id) [[ -z "$installed_release_id" ]] || fail "duplicate receipt field: $key"; installed_release_id="$value" ;;
    installed_route_sha256) [[ -z "$installed_route_sha256" ]] || fail "duplicate receipt field: $key"; installed_route_sha256="$value" ;;
    installed_route_size) [[ -z "$installed_route_size" ]] || fail "duplicate receipt field: $key"; installed_route_size="$value" ;;
    installed_release_sha256) [[ -z "$installed_release_sha256" ]] || fail "duplicate receipt field: $key"; installed_release_sha256="$value" ;;
    installed_release_size) [[ -z "$installed_release_size" ]] || fail "duplicate receipt field: $key"; installed_release_size="$value" ;;
    prior_current_state) [[ -z "$prior_current_state" ]] || fail "duplicate receipt field: $key"; prior_current_state="$value" ;;
    prior_current_target) [[ -z "$prior_current_target" ]] || fail "duplicate receipt field: $key"; prior_current_target="$value" ;;
    prior_route_state) [[ -z "$prior_route_state" ]] || fail "duplicate receipt field: $key"; prior_route_state="$value" ;;
    prior_route_sha256) [[ -z "$prior_route_sha256" ]] || fail "duplicate receipt field: $key"; prior_route_sha256="$value" ;;
    prior_route_size) [[ -z "$prior_route_size" ]] || fail "duplicate receipt field: $key"; prior_route_size="$value" ;;
    prior_route_mode) [[ -z "$prior_route_mode" ]] || fail "duplicate receipt field: $key"; prior_route_mode="$value" ;;
    prior_route_backup) [[ -z "$prior_route_backup" ]] || fail "duplicate receipt field: $key"; prior_route_backup="$value" ;;
    *) fail "unknown rollback receipt field: $key" ;;
  esac
  field_count=$((field_count + 1))
done < "$receipt"

[[ "$field_count" = "16" ]] || fail "rollback receipt must contain exactly 16 fields"
[[ "$format" = "B1-503-KINSTA-ROLLBACK-V1" ]] || fail "rollback receipt format is unsupported"
[[ "$receipt_remote_root" = "$remote_root" ]] || fail "remote root differs from the sealed receipt"
[[ "$remote_root" = "$(realpath "$remote_root")" && -d "$remote_root" && ! -L "$remote_root" ]] \
  || fail "remote root is not its canonical real directory"
[[ "$expected_owner" =~ ^[A-Za-z_][A-Za-z0-9._-]*:[A-Za-z_][A-Za-z0-9._-]*$ ]] \
  || fail "receipt owner is invalid"
[[ "$installed_commit" =~ ^[a-f0-9]{40}$ ]] || fail "receipt commit is invalid"
[[ "$installed_release_id" =~ ^v-[a-f0-9]{16}$ ]] || fail "receipt release ID is invalid"
[[ "$installed_route_sha256" =~ ^[a-f0-9]{64}$ ]] || fail "receipt route SHA-256 is invalid"
[[ "$installed_release_sha256" =~ ^[a-f0-9]{64}$ ]] || fail "receipt release SHA-256 is invalid"
[[ "$installed_route_size" =~ ^[1-9][0-9]*$ ]] || fail "receipt route size is invalid"
[[ "$installed_release_size" =~ ^[1-9][0-9]*$ ]] || fail "receipt release size is invalid"
[[ "$prior_current_state" = "present" || "$prior_current_state" = "absent" ]] \
  || fail "receipt prior current state is invalid"
[[ "$prior_route_state" = "present" || "$prior_route_state" = "absent" ]] \
  || fail "receipt prior route state is invalid"

mu_root="$remote_root/wp-content/mu-plugins"
runtime_root="$mu_root/missionmed-storyforge-runtime"
releases_root="$runtime_root/releases"
current_link="$runtime_root/current"
route_target="$mu_root/missionmed-storyforge-route.php"
installed_release="$releases_root/$installed_commit"
for directory in "$mu_root" "$runtime_root" "$releases_root"; do
  [[ -d "$directory" && ! -L "$directory" && "$(realpath "$directory")" = "$directory" ]] \
    || fail "required runtime directory is not a canonical real directory: $directory"
  require_owner "$directory"
done
[[ -d "$installed_release" && ! -L "$installed_release" ]] \
  || fail "installed immutable release directory is missing"
require_file_identity "installed release bundle" "$installed_release/release.php" \
  "$installed_release_sha256" "$installed_release_size"

if [[ "$prior_current_state" = "present" ]]; then
  [[ "$prior_current_target" =~ ^releases/[a-f0-9]{40}$ ]] \
    || fail "receipt prior pointer target is invalid"
  prior_release="$runtime_root/$prior_current_target"
  [[ -d "$prior_release" && ! -L "$prior_release" && "$(realpath "$prior_release")" = "$prior_release" ]] \
    || fail "receipt prior release target is unavailable or unsafe"
else
  [[ "$prior_current_target" = "-" ]] || fail "absent prior pointer must use the receipt sentinel"
fi

if [[ "$prior_route_state" = "present" ]]; then
  [[ "$prior_route_sha256" =~ ^[a-f0-9]{64}$ ]] || fail "receipt prior route SHA-256 is invalid"
  [[ "$prior_route_size" =~ ^[1-9][0-9]*$ ]] || fail "receipt prior route size is invalid"
  [[ "$prior_route_mode" =~ ^[0-7]{3,4}$ ]] || fail "receipt prior route mode is invalid"
  [[ "$prior_route_backup" = "prior-route.php" ]] || fail "receipt prior route backup name is invalid"
  prior_route_file="$receipt_dir/$prior_route_backup"
  require_file_identity "sealed prior route" "$prior_route_file" "$prior_route_sha256" "$prior_route_size"
else
  [[ "$prior_route_sha256" = "-" && "$prior_route_size" = "-" \
    && "$prior_route_mode" = "-" && "$prior_route_backup" = "-" ]] \
    || fail "absent prior route must use receipt sentinels"
  prior_route_file=""
fi

active_current_state="absent"
active_current_target="-"
if [[ -e "$current_link" || -L "$current_link" ]]; then
  [[ -L "$current_link" ]] || fail "active current path is not a symlink"
  active_current_state="present"
  active_current_target="$(readlink "$current_link")"
  [[ "$active_current_target" =~ ^releases/[a-f0-9]{40}$ ]] \
    || fail "active current pointer is not an exact relative release target"
  if [[ "$active_current_target" != "releases/$installed_commit" \
    && "$active_current_target" != "$prior_current_target" ]]; then
    fail "active current pointer is neither installed nor sealed prior state"
  fi
fi

active_route_state="absent"
active_route_hash="-"
active_route_size="-"
if [[ -e "$route_target" || -L "$route_target" ]]; then
  require_regular_file "active route" "$route_target"
  active_route_state="present"
  active_route_hash="$(sha256_file "$route_target")"
  active_route_size="$(file_size "$route_target")"
  if [[ "$active_route_hash" != "$installed_route_sha256" \
    && "$active_route_hash" != "$prior_route_sha256" ]]; then
    fail "active route is neither installed nor sealed prior state"
  fi
  require_owner "$route_target"
fi

if [[ "$mode" = "preflight" ]]; then
  verify_feature_off
  printf '%s\n' "B1_503_KINSTA_ROLLBACK_PREFLIGHT_PASS"
  printf 'active_current=%s\nactive_route_sha256=%s\n' "$active_current_target" "$active_route_hash"
  exit 0
fi

[[ "$confirm" = "B1-503-ROLLBACK" ]] || fail "rollback mode requires --confirm B1-503-ROLLBACK"

lock_dir="$(dirname "$receipt_dir")/.b1-503-cutover-lock"
runtime_root_original_mode=""
mu_root_original_mode=""
receipt_dir_original_mode=""
cleanup() {
  local exit_code=$?
  trap - EXIT
  if [[ -n "$runtime_root_original_mode" ]]; then
    chmod "$runtime_root_original_mode" "$runtime_root" 2>/dev/null || true
  fi
  if [[ -n "$mu_root_original_mode" ]]; then
    chmod "$mu_root_original_mode" "$mu_root" 2>/dev/null || true
  fi
  if [[ -n "$receipt_dir_original_mode" ]]; then
    chmod "$receipt_dir_original_mode" "$receipt_dir" 2>/dev/null || true
  fi
  if [[ -d "$lock_dir" && ! -L "$lock_dir" ]]; then
    rmdir "$lock_dir" 2>/dev/null || true
  fi
  exit "$exit_code"
}
trap cleanup EXIT

mkdir "$lock_dir" 2>/dev/null || fail "another rollback holds the explicit cutover lock"

# Recheck the mutation-sensitive state after acquiring the shared cutover lock.
if [[ "$active_current_state" = "absent" ]]; then
  [[ ! -e "$current_link" && ! -L "$current_link" ]] \
    || fail "active current pointer changed after preflight"
else
  [[ -L "$current_link" && "$(readlink "$current_link")" = "$active_current_target" ]] \
    || fail "active current pointer changed after preflight"
fi
if [[ "$active_route_state" = "absent" ]]; then
  [[ ! -e "$route_target" && ! -L "$route_target" ]] \
    || fail "active route changed after preflight"
else
  require_file_identity "active route after lock" "$route_target" \
    "$active_route_hash" "$active_route_size"
fi

# Containment is always the first production mutation.
force_feature_off

receipt_dir_original_mode="$(file_mode "$receipt_dir")"
chmod u+w "$receipt_dir"
observed_dir="$receipt_dir/rollback-observed"
[[ ! -e "$observed_dir" && ! -L "$observed_dir" ]] \
  || fail "rollback-observed evidence already exists; refuse an ambiguous repeated rollback"
mkdir -m 0700 "$observed_dir"
{
  printf 'format\tB1-503-KINSTA-ROLLBACK-OBSERVED-V1\n'
  printf 'active_current_state\t%s\n' "$active_current_state"
  printf 'active_current_target\t%s\n' "$active_current_target"
  printf 'active_route_state\t%s\n' "$active_route_state"
  printf 'active_route_sha256\t%s\n' "$active_route_hash"
  printf 'active_route_size\t%s\n' "$active_route_size"
} > "$observed_dir/observed.tsv"
if [[ "$active_route_state" = "present" ]]; then
  cp -p "$route_target" "$observed_dir/active-route.php"
  require_file_identity "observed active route" "$observed_dir/active-route.php" \
    "$active_route_hash" "$active_route_size"
  chmod 0400 "$observed_dir/active-route.php"
fi
chmod 0400 "$observed_dir/observed.tsv"

runtime_root_original_mode="$(file_mode "$runtime_root")"
chmod u+w "$runtime_root"
if [[ "$prior_current_state" = "present" ]]; then
  pointer_temp="$runtime_root/.current.b1-503-rollback-$$"
  [[ ! -e "$pointer_temp" && ! -L "$pointer_temp" ]] || fail "temporary rollback pointer exists"
  ln -s "$prior_current_target" "$pointer_temp"
  [[ "$(readlink "$pointer_temp")" = "$prior_current_target" ]] \
    || fail "temporary rollback pointer is not exact"
  atomic_replace_pointer "$pointer_temp" "$current_link"
elif [[ -e "$current_link" || -L "$current_link" ]]; then
  mv "$current_link" "$observed_dir/active-current-link"
fi
chmod "$runtime_root_original_mode" "$runtime_root"
runtime_root_original_mode=""

mu_root_original_mode="$(file_mode "$mu_root")"
chmod u+w "$mu_root"
if [[ "$prior_route_state" = "present" ]]; then
  route_temp="$mu_root/.missionmed-storyforge-route.php.b1-503-rollback-$$"
  [[ ! -e "$route_temp" && ! -L "$route_temp" ]] || fail "temporary rollback route exists"
  cp -p "$prior_route_file" "$route_temp"
  chmod "$prior_route_mode" "$route_temp"
  require_file_identity "temporary prior route" "$route_temp" "$prior_route_sha256" "$prior_route_size"
  mv -f "$route_temp" "$route_target"
elif [[ -e "$route_target" || -L "$route_target" ]]; then
  mv "$route_target" "$observed_dir/active-route.removed.php"
fi
chmod "$mu_root_original_mode" "$mu_root"
mu_root_original_mode=""

chmod 0500 "$observed_dir"
chmod "$receipt_dir_original_mode" "$receipt_dir"
receipt_dir_original_mode=""

purge_scoped_kinsta_caches
verify_feature_off

if [[ "$prior_current_state" = "present" ]]; then
  [[ -L "$current_link" && "$(readlink "$current_link")" = "$prior_current_target" ]] \
    || fail "prior current pointer was not restored"
  [[ "$(realpath "$current_link")" = "$(realpath "$runtime_root/$prior_current_target")" ]] \
    || fail "restored current pointer does not resolve to the sealed prior release"
else
  [[ ! -e "$current_link" && ! -L "$current_link" ]] || fail "current pointer was not restored to absent"
fi
if [[ "$prior_route_state" = "present" ]]; then
  require_file_identity "restored prior route" "$route_target" "$prior_route_sha256" "$prior_route_size"
  [[ "$(file_mode "$route_target")" = "$prior_route_mode" ]] \
    || fail "restored prior route mode differs from the sealed receipt"
else
  [[ ! -e "$route_target" && ! -L "$route_target" ]] || fail "route was not restored to absent"
fi

# The immutable installed and prior release directories must still exist.
[[ -d "$installed_release" && ! -L "$installed_release" ]] \
  || fail "installed release directory changed during rollback"
if [[ "$prior_current_state" = "present" ]]; then
  [[ -d "$runtime_root/$prior_current_target" && ! -L "$runtime_root/$prior_current_target" ]] \
    || fail "prior release directory changed during rollback"
fi

printf '%s\n' "B1_503_KINSTA_ROLLBACK_PASS"
printf 'restored_current=%s\nrestored_route_sha256=%s\n' "$prior_current_target" "$prior_route_sha256"
