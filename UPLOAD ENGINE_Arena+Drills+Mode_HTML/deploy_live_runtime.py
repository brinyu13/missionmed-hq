#!/usr/bin/env python3
from pathlib import Path
import sys

try:
    import boto3
except Exception as exc:  # pragma: no cover
    print(f"ERROR: boto3 missing: {exc}")
    sys.exit(1)

from botocore.config import Config

ROOT = Path(__file__).resolve().parent
ENV_PATH = ROOT / '.env'
RUNTIME_FILES = ['arena.html', 'drills.html', 'stat.html', 'daily.html']
PREFIX = 'html-system/LIVE/'


def load_env(path: Path) -> dict:
    data = {}
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        data[k.strip()] = v.strip()
    return data


def main() -> int:
    if not ENV_PATH.exists():
        print(f"ERROR: missing {ENV_PATH}")
        return 1

    env = load_env(ENV_PATH)
    required = ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_ENDPOINT_URL', 'R2_BUCKET']
    missing = [k for k in required if not env.get(k)]
    if missing:
        print('ERROR: missing env keys:', ', '.join(missing))
        return 1

    cfg = Config(signature_version='s3v4', s3={'addressing_style': 'path'})
    s3 = boto3.client(
        's3',
        endpoint_url=env['R2_ENDPOINT_URL'],
        aws_access_key_id=env['R2_ACCESS_KEY_ID'],
        aws_secret_access_key=env['R2_SECRET_ACCESS_KEY'],
        region_name='auto',
        config=cfg,
    )

    for name in RUNTIME_FILES:
        path = ROOT / name
        if not path.exists():
            print(f"ERROR: missing runtime file {path}")
            return 1

    for name in RUNTIME_FILES:
        key = f"{PREFIX}{name}"
        s3.upload_file(
            str(ROOT / name),
            env['R2_BUCKET'],
            key,
            ExtraArgs={
                'ContentType': 'text/html; charset=utf-8',
                'CacheControl': 'public, max-age=60',
            },
        )
        print(f"UPLOADED: {name} -> {key}")

    print('DEPLOYMENT COMPLETE')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
