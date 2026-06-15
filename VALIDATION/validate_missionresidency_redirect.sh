#!/usr/bin/env bash
set -euo pipefail

EXPECTED_STATUS="${EXPECTED_STATUS:-301}"
EXPECTED_BASE="${EXPECTED_BASE:-https://missionmedinstitute.com/mission-residency/}"
SENTINEL="legacy_redirect=missionresidency"

URLS=(
  "http://missionresidency.com"
  "https://missionresidency.com"
  "http://www.missionresidency.com"
  "https://www.missionresidency.com"
  "https://missionresidency.com/reviews?utm_source=legacy"
  "https://www.missionresidency.com/events?source=email&campaign=match"
  "https://missionresidency.com/matchfirst"
  "https://www.missionresidency.com/about"
  "https://missionresidency.com/contact"
)

fail() {
  echo "[FAIL] $*" >&2
  exit 1
}

extract_header() {
  local name="$1"
  awk -v header="$name" 'BEGIN { IGNORECASE = 1 } $1 == header ":" { sub("^[^:]+:[[:space:]]*", ""); gsub("\r", ""); print; exit }'
}

for url in "${URLS[@]}"; do
  echo "[CHECK] $url"
  headers="$(curl -sSI --connect-timeout 10 "$url")"
  status="$(printf '%s\n' "$headers" | awk 'NR == 1 { print $2 }')"
  location="$(printf '%s\n' "$headers" | extract_header "Location")"
  server="$(printf '%s\n' "$headers" | extract_header "Server")"

  [[ "$status" == "$EXPECTED_STATUS" ]] || fail "$url returned $status, expected $EXPECTED_STATUS"
  [[ "$location" == "$EXPECTED_BASE"* ]] || fail "$url redirected to $location, expected base $EXPECTED_BASE"
  [[ "$location" == *"$SENTINEL"* ]] || fail "$url redirect missing $SENTINEL: $location"
  [[ "${server,,}" != "squarespace" ]] || fail "$url is still served directly by Squarespace"

  if [[ "$url" == *"utm_source=legacy"* && "$location" != *"utm_source=legacy"* ]]; then
    fail "$url did not preserve utm_source=legacy: $location"
  fi
  if [[ "$url" == *"source=email"* && "$location" != *"source=email"* ]]; then
    fail "$url did not preserve source=email: $location"
  fi
  if [[ "$url" == *"campaign=match"* && "$location" != *"campaign=match"* ]]; then
    fail "$url did not preserve campaign=match: $location"
  fi
done

echo "[CHECK] Final target page"
target_status="$(curl -sSI --connect-timeout 10 "${EXPECTED_BASE}?${SENTINEL}" | awk 'NR == 1 { print $2 }')"
[[ "$target_status" == "200" ]] || fail "MissionMed target returned $target_status, expected 200"

echo "[PASS] Mission Residency legacy redirect contract validated"
