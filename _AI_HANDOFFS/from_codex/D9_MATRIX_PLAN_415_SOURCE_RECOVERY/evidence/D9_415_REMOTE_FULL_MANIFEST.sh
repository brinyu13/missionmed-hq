#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

PLUGIN_ROOT="/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub"
MU_ROOT="/www/theresidencyacademy_209/public/wp-content/mu-plugins"

for tool in find sort stat sha256sum md5sum readlink base64 date awk; do
  command -v "$tool" >/dev/null 2>&1 || {
    printf 'required tool unavailable: %s\n' "$tool" >&2
    exit 20
  }
done

emit_tree() {
  local scope="$1"
  local root="$2"
  local path rel type size mode sha256 md5 target target_b64

  [[ -d "$root" ]] || {
    printf 'required root unavailable: %s\n' "$scope" >&2
    exit 21
  }

  while IFS= read -r -d '' path; do
    if [[ "$path" == "$root" ]]; then
      rel='.'
    else
      rel="${path#"$root"/}"
    fi

    case "$rel" in
      *$'\t'*|*$'\n'*|*$'\r'*)
        printf 'unsupported control character in path under scope: %s\n' "$scope" >&2
        exit 22
        ;;
    esac

    size="$(stat -c '%s' -- "$path")"
    mode="$(stat -c '%a' -- "$path")"
    sha256='-'
    md5='-'
    target_b64='-'

    if [[ -L "$path" ]]; then
      type='l'
      target="$(readlink -- "$path")"
      sha256="$(printf '%s' "$target" | sha256sum | awk '{print $1}')"
      md5="$(printf '%s' "$target" | md5sum | awk '{print $1}')"
      target_b64="$(printf '%s' "$target" | base64 -w 0)"
    elif [[ -f "$path" ]]; then
      type='f'
      sha256="$(sha256sum -- "$path" | awk '{print $1}')"
      md5="$(md5sum -- "$path" | awk '{print $1}')"
    elif [[ -d "$path" ]]; then
      type='d'
    elif [[ -p "$path" ]]; then
      type='p'
    elif [[ -S "$path" ]]; then
      type='s'
    elif [[ -b "$path" ]]; then
      type='b'
    elif [[ -c "$path" ]]; then
      type='c'
    else
      type='o'
    fi

    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
      "$scope" "$rel" "$type" "$size" "$mode" "$sha256" "$md5" "$target_b64"
  done < <(find -P "$root" -print0 | sort -z)
}

printf '# d9_415_manifest_schema\tscope relative_path type size mode sha256 md5 symlink_target_base64\n'
printf '# started_at\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%S.%NZ)"
emit_tree 'missionmed-hub' "$PLUGIN_ROOT"
emit_tree 'mu-plugins' "$MU_ROOT"
printf '# completed_at\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%S.%NZ)"
