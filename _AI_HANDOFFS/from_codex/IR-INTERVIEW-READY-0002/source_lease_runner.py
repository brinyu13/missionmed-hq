"""Dormant bounded source lease orchestration. No provider work on import.

Only --execute with independently authored exact-byte approvals admits one read.
Worker must call check_worker_guard immediately before every write and commit.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import sys
import threading
import time
import uuid

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
OS_ROOT = Path('/Users/brianb/MissionMed_worktrees/IR-PHASE1-REGISTRY-20261004-R2')
OS_HEAD = '84754150b8c834ac25466860ab98600b5d5c1b9e'
SOURCE_BASE = '15488295c9e7d135d3a9e51a1b5feb571c2922e2'
TRANSPORT_SHA = '6bab4c948b28202b7a803228f2123d5c95137030f16eb129c427b4ddcc487cad'
ORIGIN = 'https://github.com/brinyu13/missionmed-hq.git'
REF = 'refs/heads/codex/ir-interview-ready-0002-storyforge'
OWNER = 'codex-ir-phase1-foreman'
PATHS = ['interview-ready/integration/missionmed-interview-ready.php',
         'interview-ready/account.js', 'interview-ready/build.py',
         'interview-ready/integration/gateway.test.php', 'interview-ready/qa-account.py',
         'interview-ready/evidence/account-worker-handoff.md']
BASE_PREIMAGES = {name: 'ABSENT' for name in PATHS}
BASE_PREIMAGES['interview-ready/build.py'] = 'c119d1bf8c9b6df4c02d765369fa90af849477708c4ca8dfb7eeacd4c0399dea'
INTERVAL = 5.0


class Stop(RuntimeError):
    """Constant public classifications only."""


def digest(path):
    if path.is_symlink():
        raise Stop('SYMLINK_DENIED')
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()


def head(root):
    """Local Git metadata only: no command, environment, or provider lookup."""
    git = root / '.git'
    if git.is_file():
        value = git.read_text().strip()
        if not value.startswith('gitdir: '):
            raise Stop('GIT_METADATA_DENIED')
        git = (root / value[8:]).resolve()
    value = (git / 'HEAD').read_text().strip()
    if value.startswith('ref: '):
        ref = value[5:]
        if not ref.startswith('refs/') or '..' in ref:
            raise Stop('GIT_METADATA_DENIED')
        common = git
        if (git / 'commondir').exists():
            common = (git / (git / 'commondir').read_text().strip()).resolve()
        for location in (git, common):
            if (location / ref).is_file():
                return (location / ref).read_text().strip()
        for line in (common / 'packed-refs').read_text().splitlines():
            if line.endswith(' ' + ref):
                return line.split()[0]
        raise Stop('GIT_METADATA_DENIED')
    return value


def preimages(root):
    return {name: digest(root / name) if (root / name).exists() else 'ABSENT'
            for name in PATHS}


def snapshot(root=ROOT, os_root=OS_ROOT):
    return {'sourceBASE': SOURCE_BASE, 'sourceHead': head(root), 'osHead': head(os_root),
            'writePaths': PATHS, 'sourcePreimages': preimages(root),
            'runnerSha256': digest(Path(__file__)),
            'testsSha256': digest(HERE / 'source_lease_runner_tests.py'),
            'transportSha256': digest(HERE / 'lease_transport.py'),
            'workerPacketSha256': digest(HERE / 'PHASE1_ACCOUNT_WORKER_PACKET.md'),
            'canonicalClientSha256': digest(os_root / 'tools/engineering_os_lease.py'),
            'decisionSha256': digest(os_root / 'decisions/DR-376_ir_phase1_bounded_execution_annex.md'),
            'origin': ORIGIN, 'ref': REF, 'relativePath': 'interview-ready', 'owner': OWNER}


def read_json(path):
    if path.is_symlink() or path.stat().st_size > 65536:
        raise Stop('CONTROL_FILE_DENIED')
    return json.loads(path.read_bytes())


def fresh(document, now):
    expiry = document.get('expiresUnix')
    return (type(expiry) in (int, float) and math.isfinite(expiry)
            and now < expiry <= now + 3600)


def validate_approval(approval, actual, now=None):
    now = time.time() if now is None else now
    if (actual['osHead'] != OS_HEAD or actual['transportSha256'] != TRANSPORT_SHA
            or actual['sourceBASE'] != SOURCE_BASE
            or actual['sourcePreimages'] != BASE_PREIMAGES):
        raise Stop('PIN_MISMATCH')
    if (approval.get('schema') != 'ir.source_lease.approval.v1'
            or approval.get('verdict') != 'APPROVE'
            or approval.get('independentReviewer') in (None, '', OWNER)
            or approval.get('contract') != actual or not fresh(approval, now)):
        raise Stop('APPROVAL_DENIED')
    return hashlib.sha256(canonical(actual)).hexdigest()


def atomic(directory, name, value):
    target = directory / name
    if directory.is_symlink() or target.is_symlink():
        raise Stop('CONTROL_FILE_DENIED')
    temporary = directory / ('.' + name + '.' + uuid.uuid4().hex)
    try:
        with temporary.open('xb') as stream:
            temporary.chmod(0o600)
            stream.write(canonical(value) + b'\n')
            stream.flush()
        temporary.replace(target)
    finally:
        temporary.unlink(missing_ok=True)


def load_module(name, path, expected_digest):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    source = path.read_bytes()
    if hashlib.sha256(source).hexdigest() != expected_digest:
        raise Stop('MODULE_HASH_MISMATCH')
    exec(compile(source, str(path), 'exec'), module.__dict__)
    return module


def check_worker_guard(directory, binding, source_head, now=None):
    """Fail closed on stale/terminal status; no authorization to write other paths."""
    now = time.time() if now is None else now
    value = read_json(Path(directory) / 'SOURCE_LEASE_STATUS.json')
    updated = value.get('updatedUnix')
    if (head(ROOT) != source_head or value.get('state') != 'HEALTHY' or value.get('bindingSha256') != binding
            or value.get('sourceHead') != source_head
            or type(updated) not in (int, float) or not math.isfinite(updated)
            or not 0 <= now - updated < 10
            or datetime.fromisoformat(value['expiresAt'].replace('Z', '+00:00')).timestamp() <= now):
        raise Stop('WORKER_STOP')
    return value


def orchestrate(client, lease, contract, binding, directory, *, max_seconds=3600,
                interval=INTERVAL, stop_event=None):
    """Fixture-injectable client; canonical client owns heartbeat validation."""
    if (type(max_seconds) not in (int, float) or not math.isfinite(max_seconds)
            or not 0 < max_seconds <= 3600 or interval != INTERVAL):
        raise Stop('WAIT_BOUND_DENIED')
    event = stop_event or threading.Event()
    lock = threading.Lock()
    handle = lease
    failure = []
    thread = None
    outcome = 'STOP'
    release = 'NOT_ATTEMPTED'

    def record(state, reason):
        return {'state': state, 'reason': reason, 'updatedUnix': time.time(),
                'leaseId': handle.lease_id, 'epoch': handle.fencing_epoch,
                'nonceSha256': hashlib.sha256(handle.nonce.encode()).hexdigest(),
                'heartbeatAt': handle.heartbeat_at, 'expiresAt': handle.expires_at,
                'bindingSha256': binding, 'scope': handle.resource_key,
                'writePaths': contract['writePaths'], 'sourceBASE': contract['sourceBASE'],
                'sourceHead': contract['sourceHead'],
                'approvedPacketDigest': contract['workerPacketSha256']}

    def renew():
        nonlocal handle
        with lock:
            handle = client.heartbeat(handle)
            atomic(directory, 'SOURCE_LEASE_STATUS.json', record('HEALTHY', 'RENEWED'))

    def keeper():
        while not event.wait(interval):
            try:
                renew()
            except BaseException:
                failure.append('KEEPER_FAILED')
                try:
                    atomic(directory, 'SOURCE_LEASE_STATUS.json', record('STOP', 'KEEPER_FAILED'))
                except BaseException:
                    pass  # Never emit a thread traceback or exception value.
                finally:
                    event.set()
                return

    try:
        renew()  # Immediately validate a real canonical renewal before READY.
        thread = threading.Thread(target=keeper, name='ir-source-lease-keeper', daemon=True)
        thread.start()
        with lock:
            if failure or event.is_set():
                raise Stop('KEEPER_FAILED')
            atomic(directory, 'SOURCE_LEASE_READY.json', record('SOURCE_LEASE_READY', 'RENEWED'))
        deadline = time.monotonic() + max_seconds
        while not event.is_set():
            stop = directory / 'SOURCE_LEASE_STOP.json'
            if stop.exists():
                instruction = read_json(stop)
                if (instruction.get('bindingSha256') != binding
                        or instruction.get('leaseId') != handle.lease_id
                        or instruction.get('owner') != OWNER
                        or instruction.get('action') not in ('RELEASE', 'DONE')):
                    raise Stop('STOP_CONTROL_DENIED')
                outcome = instruction['action']
                break
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise Stop('WAIT_EXPIRED')
            event.wait(min(0.25, remaining))
        if failure or event.is_set():
            raise Stop('KEEPER_FAILED')
    except BaseException:
        outcome = 'STOP'
    finally:
        event.set()
        if thread is not None:
            thread.join(4)
        try:
            atomic(directory, 'SOURCE_LEASE_STATUS.json', record('STOP', outcome))
        finally:
            try:
                with lock:
                    client.release(handle)
                release = 'RELEASED'
            except BaseException:
                release = 'RELEASE_FAILED'
            atomic(directory, 'SOURCE_LEASE_RESULT.json',
                   {'outcome': outcome, 'release': release, 'bindingSha256': binding})
    return outcome != 'STOP' and release == 'RELEASED'


def execute(approval_path, admission_path, directory, max_seconds=3600):
    # No module with credential capability is imported until all local gates pass.
    actual = snapshot()
    approval = read_json(approval_path)
    binding = validate_approval(approval, actual)
    admission = read_json(admission_path)
    if (admission.get('schema') != 'ir.source_lease.read_admission.v1'
            or admission.get('verdict') != 'APPROVE'
            or admission.get('independentReviewer') in (None, '', OWNER)
            or admission.get('bindingSha256') != binding
            or admission.get('approvalSha256') != digest(approval_path)
            or not fresh(admission, time.time())
            or admission.get('maxSeconds') != max_seconds
            or not 0 < max_seconds <= 3600):
        raise Stop('READ_ADMISSION_DENIED')
    # Reports are separate reviewer artifacts; their exact bytes must exist locally.
    for document in (approval, admission):
        report = HERE / document['reportFile']
        if report.parent != HERE or digest(report) != document['reportSha256']:
            raise Stop('REVIEW_REPORT_DENIED')
    # Canonical scope validation is pure local and precedes any credential capability.
    canonical_client = load_module('ir_canonical_lease', OS_ROOT / 'tools/engineering_os_lease.py', actual['canonicalClientSha256'])
    scope = canonical_client.path_scope(ORIGIN, REF, 'interview-ready')
    directory.mkdir(mode=0o700)  # unique, nonexisting control directory only
    # Mark the approval consumed BEFORE any retrieval. Failed reads cannot retry.
    marker = HERE / ('SOURCE_LEASE_READ_CONSUMED_' + digest(admission_path) + '.json')
    with marker.open('xb') as stream:
        marker.chmod(0o600)
        stream.write(canonical({'bindingSha256': binding, 'state': 'CONSUMED'}))
    transport = load_module('ir_source_transport', HERE / 'lease_transport.py', actual['transportSha256'])
    key = transport.retrieve_existing_key()
    if transport.authentication_probe(key) != 200:
        raise Stop('AUTHENTICATION_DENIED')
    client_type = canonical_client.SupabaseLeaseClient
    client = client_type(base_url=transport.BASE_URL, project_ref=transport.PROJECT, api_key=key,
                         opener=transport.ApikeyOnlyLeaseOpener(key, client_type._open_no_redirect))
    lease = client.acquire_writer(scope=scope, write_paths=PATHS, owner_id=OWNER,
        session_id='ir-phase1-account-source-20261004-' + uuid.uuid4().hex, binding=binding)
    return orchestrate(client, lease, actual, binding, directory, max_seconds=max_seconds)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true')
    parser.add_argument('--approval', type=Path)
    parser.add_argument('--read-admission', type=Path)
    parser.add_argument('--control-directory', type=Path)
    parser.add_argument('--max-seconds', type=int, default=3600)
    args = parser.parse_args()
    if not args.execute:
        print('DORMANT: independent exact-byte approval and fresh read admission required')
        return 0
    try:
        if (args.approval is None or args.read_admission is None or args.control_directory is None
                or args.control_directory.parent.resolve() != HERE):
            raise Stop('EXECUTION_ARGUMENT_DENIED')
        success = execute(args.approval, args.read_admission, args.control_directory, args.max_seconds)
        print('SOURCE_LEASE_RELEASED' if success else 'SOURCE_LEASE_STOP')
        return 0 if success else 1
    except BaseException:
        print('SOURCE_LEASE_STOP')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
