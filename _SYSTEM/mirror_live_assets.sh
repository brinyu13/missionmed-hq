#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROMPT_ID="MR-R2-CREDENTIAL-CDN-REPAIR-027"
ENV_FILE="${R2_ENV_FILE:-$ROOT_DIR/_SYSTEM/r2.env}"
LOG_DIR="$ROOT_DIR/_SYSTEM_LOGS"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
REPORT="$LOG_DIR/cdn_mirror_${PROMPT_ID}_${STAMP}.log"

mkdir -p "$LOG_DIR"

load_env_file() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    echo "ERROR: missing env file: $path" >&2
    echo "Use template: $ROOT_DIR/_SYSTEM/r2.env.example" >&2
    exit 1
  fi
  # shellcheck disable=SC1090
  set -a
  . "$path"
  set +a
}

required_env() {
  local missing=0
  for k in R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET; do
    if [[ -z "${!k:-}" ]]; then
      echo "ERROR: missing $k" >&2
      missing=1
    fi
  done
  if [[ -z "${R2_ENDPOINT_URL:-}" && -z "${R2_ACCOUNT_ID:-}" ]]; then
    echo "ERROR: set either R2_ENDPOINT_URL or R2_ACCOUNT_ID" >&2
    missing=1
  fi
  if [[ "$missing" -ne 0 ]]; then
    exit 1
  fi
}

r2_region() { echo "${R2_REGION:-auto}"; }
r2_endpoint() {
  if [[ -n "${R2_ENDPOINT_URL:-}" ]]; then
    echo "${R2_ENDPOINT_URL%/}"
  else
    echo "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
  fi
}
cdn_base_url() { echo "${R2_CDN_BASE_URL:-https://cdn.missionmedinstitute.com}"; }

sigcurl() {
  curl --silent --show-error --max-time 90 \
    --aws-sigv4 "aws:amz:$(r2_region):s3" \
    --user "${R2_ACCESS_KEY_ID}:${R2_SECRET_ACCESS_KEY}" \
    "$@"
}

signed_probe_code() {
  local key="$1"
  sigcurl \
    --output /dev/null \
    --write-out "%{http_code}" \
    --header "Range: bytes=0-0" \
    "$(r2_endpoint)/${R2_BUCKET}/${key}"
}

public_get_code() {
  local url="$1"
  curl --silent --show-error --max-time 30 --output /dev/null --write-out "%{http_code}" "$url"
}

public_size_download() {
  local url="$1"
  curl --silent --show-error --max-time 60 --output /dev/null --write-out "%{size_download}" "$url"
}

public_content_type() {
  local url="$1"
  curl --silent --show-error --max-time 30 --output /dev/null --write-out "%{content_type}" "$url"
}

signed_put_file() {
  local local_file="$1"
  local key="$2"
  sigcurl --fail \
    --request PUT \
    --header "Content-Type: text/plain; charset=utf-8" \
    --upload-file "$local_file" \
    "$(r2_endpoint)/${R2_BUCKET}/${key}" \
    --output /dev/null
}

signed_copy() {
  local src="$1"
  local dst="$2"
  sigcurl --fail \
    --request PUT \
    --header "x-amz-copy-source: /${R2_BUCKET}/${src}" \
    --header "x-amz-metadata-directive: COPY" \
    "$(r2_endpoint)/${R2_BUCKET}/${dst}" \
    --output /dev/null
}

write_report() {
  local line="$1"
  echo "$line" | tee -a "$REPORT"
}

mask() {
  local v="$1"
  local n="${#v}"
  if [[ "$n" -lt 10 ]]; then
    printf '%*s' "$n" '' | tr ' ' '*'
  else
    echo "${v:0:4}...${v: -4}"
  fi
}

load_env_file "$ENV_FILE"
required_env

write_report "PROMPT_ID=$PROMPT_ID"
write_report "TIMESTAMP_UTC=$STAMP"
write_report "ENV_FILE=$ENV_FILE"
write_report "R2_BUCKET=$R2_BUCKET"
write_report "R2_ENDPOINT=$(r2_endpoint)"
write_report "R2_REGION=$(r2_region)"
write_report "R2_ACCESS_KEY_ID=$(mask "${R2_ACCESS_KEY_ID}")"
write_report "R2_SECRET_ACCESS_KEY=$(mask "${R2_SECRET_ACCESS_KEY}")"
write_report "CDN_BASE=$(cdn_base_url)"
write_report ""

SOURCES=(
  "html-system/Shared/assets/MODE%20LOBBY%20IMAGES/Mode_Lobby_Imagecard_DRILLS_dailyrounds.JPG"
  "html-system/Shared/assets/MODE%20LOBBY%20IMAGES/Mode_Lobby_Imagecard_STAT!_Duels.JPG"
  "html-system/Shared/assets/Music/Rise_Mix.mp3"
  "html-system/Shared/assets/Music/Starting%20Car%20Engine%2002.mp3"
  "html-system/STAT_VERSIONS/stat-data/stat_questions_indexes.json"
  "html-system/STAT_VERSIONS/stat-data/stat_questions_lookup.json"
  "html-system/STAT_VERSIONS/stat-data/stat_questions_runtime.json"
)

write_report "PHASE 1: preflight source existence (public)"
for src in "${SOURCES[@]}"; do
  src_url="$(cdn_base_url)/${src}"
  code="$(public_get_code "$src_url")"
  write_report "SOURCE $src code=$code url=$src_url"
  if [[ "$code" != "200" ]]; then
    write_report "ERROR: required source object missing on public CDN; aborting."
    exit 1
  fi
done
write_report ""

write_report "PHASE 2: non-destructive signed write test"
tmp_file="$(mktemp)"
echo "missionmed-r2-write-test ${STAMP}" >"$tmp_file"
test_key="html-system/LIVE/_r2_write_test/${STAMP}.txt"
if ! signed_put_file "$tmp_file" "$test_key"; then
  write_report "WRITE_TEST FAIL key=$test_key"
  write_report "HINT: invalid key/secret/endpoint/account scope or write permission."
  rm -f "$tmp_file"
  exit 1
fi
rm -f "$tmp_file"
probe_code="$(signed_probe_code "$test_key")"
public_code="$(public_get_code "$(cdn_base_url)/${test_key}")"
write_report "WRITE_TEST signed_probe=$probe_code public_get=$public_code key=$test_key"
if [[ "$probe_code" != "200" && "$probe_code" != "206" && "$probe_code" != "416" ]]; then
  write_report "WRITE_TEST FAIL signed readback"
  exit 1
fi
write_report ""

write_report "PHASE 3: mirror required objects"
ok=0
total="${#SOURCES[@]}"
for src in "${SOURCES[@]}"; do
  dst="html-system/LIVE/${src#html-system/}"
  src_url="$(cdn_base_url)/${src}"
  dst_url="$(cdn_base_url)/${dst}"
  write_report "MIRROR src=$src dst=$dst"
  if ! signed_copy "$src" "$dst"; then
    write_report "  COPY=FAIL"
    continue
  fi

  legacy_code="$(public_get_code "$src_url")"
  live_code="$(public_get_code "$dst_url")"
  legacy_size="$(public_size_download "$src_url")"
  live_size="$(public_size_download "$dst_url")"
  live_ctype="$(public_content_type "$dst_url")"

  write_report "  LEGACY code=$legacy_code size=$legacy_size"
  write_report "  LIVE   code=$live_code size=$live_size type=$live_ctype"

  if [[ "$legacy_code" == "200" && "$live_code" == "200" && "$legacy_size" == "$live_size" && "$live_ctype" != text/html* ]]; then
    ok=$((ok + 1))
    write_report "  RESULT=PASS"
  else
    write_report "  RESULT=FAIL"
  fi
done

write_report ""
write_report "SUMMARY $ok/$total mirrored+verified"
if [[ "$ok" -ne "$total" ]]; then
  write_report "FINAL=FAIL"
  exit 1
fi
write_report "FINAL=PASS"
echo "Report: $REPORT"
