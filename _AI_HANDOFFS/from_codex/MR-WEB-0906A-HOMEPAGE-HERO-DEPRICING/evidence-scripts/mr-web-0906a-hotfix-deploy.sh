#!/usr/bin/env bash
set -euo pipefail

mode="${1:-verify}"
public_root='/www/theresidencyacademy_209/public'
private_dir='/www/theresidencyacademy_209/private/mr-web-0906a'
active_plugin="$public_root/wp-content/mu-plugins/missionmed-mr-p0.php"
old_sha='fcc7bc74a7b6adc57b7ab6bc31ddedcd5fa735bc7c5c9e72a9bdd843eb4a4c4f'
new_sha='9f72885a8030f41c4e588360f467a7e2f1fed4406972c6e665a2e9d8f3afb1e7'
preimage="$private_dir/missionmed-mr-p0.php.before-$old_sha"
candidate="$private_dir/missionmed-mr-p0.php.candidate-$new_sha"
temporary="$public_root/wp-content/mu-plugins/.missionmed-mr-p0.php.mr0906a-hotfix.tmp"
mutated=0

actual_sha() {
    sha256sum "$1" | awk '{print $1}'
}

restore_on_error() {
    if [[ "$mutated" == '1' && -f "$preimage" ]]; then
        install -m 0644 "$preimage" "$temporary"
        mv -f "$temporary" "$active_plugin"
    fi
}
trap restore_on_error ERR

if [[ "$mode" == 'apply' ]]; then
    [[ "$(actual_sha "$active_plugin")" == "$old_sha" ]]
    install -d -m 0700 "$private_dir"
    if [[ ! -e "$preimage" ]]; then
        install -m 0600 "$active_plugin" "$preimage"
    fi
    [[ "$(actual_sha "$preimage")" == "$old_sha" ]]
    [[ "$(actual_sha "$candidate")" == "$new_sha" ]]
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
else
    printf 'Unsupported mode: %s\n' "$mode" >&2
    exit 2
fi

printf 'MODE=%s\nACTIVE_PLUGIN_SHA256=%s\nPREIMAGE_SHA256=%s\n' \
    "$mode" "$(actual_sha "$active_plugin")" "$(actual_sha "$preimage")"
