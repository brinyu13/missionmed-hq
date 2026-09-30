#!/usr/bin/env python3
"""DR-342: validate one read-only Supabase connector result for five canaries.

Run --print-query, execute that exact SELECT against production Supabase,
then pass its exact JSON rows (plus the query/project_id) as --capture.
The connector tool response and capture SHA are release evidence. This does not
authorize a send. Never put service credentials in this file or its arguments.
"""
import argparse
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path

MANIFEST_SHA = 'b5e82013bb2ed38ef4e1446d6b196573da8f349ce3b8520f48dffe4ba140cbe2'
PROJECT = 'dwwsahpzblgrgducxtzw'
QUERY_SHA = '38d20452a1f8c0dd576a8db8cb19869c3343a356b729c1681132af2b0579eb27'


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def query(manifest: dict) -> str:
    by_id = {r['wp_user_id']: r for r in manifest['records']}
    ids = manifest['canary_selection']['wp_user_ids']
    uuids = sorted(by_id[i]['student_id'] for i in ids)
    vals = ','.join("'" + u + "'::uuid" for u in uuids)
    return ("select (now() at time zone 'utc')::text as fetched_at,s.id::text as student_id,"
            "s.identity_state,s.sponsor_type,p.canonical_student_id::text as canonical_student_id,"
            "p.absorbed,p.excluded,missionaccounts.onboarding_state_for_student(s.id)->>'status' "
            "as onboarding_status,(s.id is not null) as workspace_resolved from missionaccounts.student s "
            "join missionaccounts.student_identity_projection p on p.id=s.id where s.id in ("
            + vals + ") order by s.id")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', required=True)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--print-query', action='store_true')
    group.add_argument('--capture')
    parser.add_argument('--output')
    args = parser.parse_args()
    manifest_path = Path(args.manifest)
    if digest(manifest_path.read_bytes()) != MANIFEST_SHA:
        raise SystemExit('manifest_hash_mismatch')
    manifest = json.loads(manifest_path.read_text())
    expected_query = query(manifest)
    if digest(expected_query.encode()) != QUERY_SHA:
        raise SystemExit('query_hash_mismatch')
    if args.print_query:
        print(expected_query)
        return
    if not args.output:
        raise SystemExit('output_required')
    captured = Path(args.capture).read_bytes()
    proof = json.loads(captured)
    if proof.get('project_id') != PROJECT or proof.get('query') != expected_query:
        raise SystemExit('connector_query_or_project_mismatch')
    rows = proof.get('rows', [])
    if len(rows) != 5 or len({r['student_id'] for r in rows}) != 5:
        raise SystemExit('wrong_or_duplicate_rows')
    now = datetime.now(timezone.utc)
    by_student = {r['student_id']: r for r in rows}
    by_wp = {r['wp_user_id']: r for r in manifest['records']}
    out = {}
    for wp_id in manifest['canary_selection']['wp_user_ids']:
        m = by_wp[wp_id]
        row = by_student.get(m['student_id'])
        if not row:
            raise SystemExit('canary_missing_from_live_result')
        fetched = datetime.fromisoformat(row['fetched_at']).replace(tzinfo=timezone.utc)
        if abs((now - fetched).total_seconds()) > 120:
            raise SystemExit('database_read_stale')
        if (row['identity_state'] != 'verified' or row['sponsor_type'] != 'DIRECT'
                or row['canonical_student_id'] != m['student_id']
                or row['absorbed'] is not False or row['excluded'] is not False
                or row['workspace_resolved'] is not True
                or row['onboarding_status'] not in ('NOT_STARTED', 'IN_PROGRESS')):
            raise SystemExit('live_canary_ineligible')
        out[str(wp_id)] = dict(row, email_sha256=m['email_sha256'])
    attestation = {
        'schema': 'missionmed.dr342.canary-live-preflight.v1',
        'project_id': PROJECT, 'course_id': 6357,
        'manifest_sha256': MANIFEST_SHA,
        'source_query_sha256': QUERY_SHA,
        'source_result_sha256': digest(captured),
        'fetched_at': rows[0]['fetched_at'].replace(' ', 'T') + 'Z',
        'records': out,
    }
    data = json.dumps(attestation, sort_keys=True, separators=(',', ':')).encode()
    path = Path(args.output)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'wb') as file:
        file.write(data)
    print(json.dumps({'count': len(out), 'capture_sha256': digest(captured),
                      'attestation_sha256': digest(data), 'expires_in_seconds': 120}))


if __name__ == '__main__':
    main()
