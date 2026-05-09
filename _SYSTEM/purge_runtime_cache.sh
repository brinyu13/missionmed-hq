#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="$ROOT_DIR/_SYSTEM/DEPLOY_MANIFEST.json"
CDN_BASE="https://cdn.missionmedinstitute.com"
WP_BASE="https://missionmedinstitute.com"
EXECUTE=0
REASON=""
INCLUDE_WP=1

usage() {
  cat <<'USAGE'
Usage: bash _SYSTEM/purge_runtime_cache.sh [--execute --reason TEXT] [--cdn-only]

Safely purges only exact MissionMed runtime URLs:
  - CDN LIVE HTML URLs from _SYSTEM/DEPLOY_MANIFEST.json
  - WordPress wrapper routes /arena, /stat, /daily, /drills, /drills?entry=daily_rounds

Default mode is dry-run. This script never purges the whole zone.

Required for --execute:
  CLOUDFLARE_API_TOKEN
  CLOUDFLARE_ZONE_ID
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --execute)
      EXECUTE=1
      shift
      ;;
    --reason)
      REASON="${2:-}"
      if [[ -z "$REASON" ]]; then
        echo "ERROR: --reason requires text" >&2
        exit 2
      fi
      shift 2
      ;;
    --cdn-only)
      INCLUDE_WP=0
      shift
      ;;
    --manifest)
      MANIFEST="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: unknown option: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ ! -s "$MANIFEST" ]]; then
  echo "ERROR: manifest missing or empty: $MANIFEST" >&2
  exit 1
fi

URLS=()
while IFS= read -r url; do
  [[ -n "$url" ]] && URLS+=("$url")
done < <(node - "$MANIFEST" "$CDN_BASE" "$WP_BASE" "$INCLUDE_WP" <<'NODE'
const fs = require('node:fs');
const [manifestPath, cdnBase, wpBase, includeWp] = process.argv.slice(2);
const data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const urls = [];
for (const item of data.mappings || []) {
  const liveKey = String(item.destination || '').replace('/STAGING/', '/LIVE/');
  if (!liveKey.startsWith('html-system/LIVE/')) {
    throw new Error(`Refusing non-LIVE key: ${liveKey}`);
  }
  urls.push(`${cdnBase}/${liveKey}`);
}
if (includeWp === '1') {
  urls.push(`${wpBase}/arena`);
  urls.push(`${wpBase}/stat`);
  urls.push(`${wpBase}/daily`);
  urls.push(`${wpBase}/drills`);
  urls.push(`${wpBase}/drills?entry=daily_rounds`);
}
for (const url of urls) console.log(url);
NODE
)

echo "[PURGE] Scope: exact URLs only"
printf '  %s\n' "${URLS[@]}"

if [[ "$EXECUTE" -ne 1 ]]; then
  echo "[PURGE] DRY RUN ONLY. Re-run with --execute --reason '<why this scoped purge is safe>' to purge."
  exit 0
fi

if [[ -z "$REASON" ]]; then
  echo "ERROR: --execute requires --reason" >&2
  exit 2
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" || -z "${CLOUDFLARE_ZONE_ID:-}" ]]; then
  echo "ERROR: missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID" >&2
  exit 1
fi

payload="$(node - "${URLS[@]}" <<'NODE'
const urls = process.argv.slice(2);
process.stdout.write(JSON.stringify({ files: urls }));
NODE
)"

echo "[PURGE] Executing exact-url Cloudflare purge. Reason: $REASON"
response="$(curl --silent --show-error --fail \
  --request POST \
  --url "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache" \
  --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  --header 'Content-Type: application/json' \
  --data "$payload")"

if echo "$response" | rg -q '"success":true'; then
  echo "[PURGE] PASS: Cloudflare exact-url purge accepted."
  exit 0
fi

echo "[PURGE] FAIL: Cloudflare did not return success=true." >&2
exit 1
