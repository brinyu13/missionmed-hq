#!/usr/bin/env bash
set -euo pipefail

mode="${1:-verify}"
public_root='/www/theresidencyacademy_209/public'
private_dir='/www/theresidencyacademy_209/private/mr-web-0906a'
active_plugin="$public_root/wp-content/mu-plugins/missionmed-mr-p0.php"
old_sha='48c48278e0c21c98e2edc9bf6c26e8b731b2ff7838c838561432bc3df14b1fa5'
new_sha='fcc7bc74a7b6adc57b7ab6bc31ddedcd5fa735bc7c5c9e72a9bdd843eb4a4c4f'
preimage="$private_dir/missionmed-mr-p0.php.before-$old_sha"
candidate="$private_dir/missionmed-mr-p0.php.candidate-$new_sha"
archive_script="$private_dir/mr-web-0906a-archive.php"
temporary="$public_root/wp-content/mu-plugins/.missionmed-mr-p0.php.mr0906a.tmp"
mutated=0

restore_on_error() {
    if [[ "$mutated" == '1' && -f "$preimage" ]]; then
        install -m 0644 "$preimage" "$temporary"
        mv -f "$temporary" "$active_plugin"
    fi
}
trap restore_on_error ERR

actual_sha() {
    sha256sum "$1" | awk '{print $1}'
}

if [[ "$mode" == 'apply' ]]; then
    [[ "$(actual_sha "$active_plugin")" == "$old_sha" ]]
    install -d -m 0700 "$private_dir"
    if [[ ! -e "$preimage" ]]; then
        install -m 0600 "$active_plugin" "$preimage"
    fi
    [[ "$(actual_sha "$preimage")" == "$old_sha" ]]
    [[ "$(actual_sha "$candidate")" == "$new_sha" ]]

    archive_result=$(php "$archive_script")
    printf '%s\n' "$archive_result"
    printf '%s\n' "$archive_result" | grep -q '"pass_count": 9'
    printf '%s\n' "$archive_result" | grep -q '"check_count": 9'

    install -m 0644 "$candidate" "$temporary"
    mv -f "$temporary" "$active_plugin"
    mutated=1
    [[ "$(actual_sha "$active_plugin")" == "$new_sha" ]]
    mutated=0
elif [[ "$mode" == 'rollback' ]]; then
    [[ "$(actual_sha "$preimage")" == "$old_sha" ]]
    install -m 0644 "$preimage" "$temporary"
    mv -f "$temporary" "$active_plugin"
    [[ "$(actual_sha "$active_plugin")" == "$old_sha" ]]
elif [[ "$mode" == 'verify' ]]; then
    [[ "$(actual_sha "$active_plugin")" == "$new_sha" ]]
    php "$archive_script"
else
    printf 'Unsupported mode: %s\n' "$mode" >&2
    exit 2
fi

printf 'MODE=%s\nACTIVE_PLUGIN_SHA256=%s\nPREIMAGE_SHA256=%s\n' \
    "$mode" "$(actual_sha "$active_plugin")" "$(actual_sha "$preimage")"
