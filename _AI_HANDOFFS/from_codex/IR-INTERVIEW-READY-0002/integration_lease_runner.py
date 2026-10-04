"""Dormant bounded source lease orchestration. No provider work on import.

Only --execute with independently authored exact-byte approvals admits one read.
Worker must call check_worker_guard immediately before every write and commit.
"""
import argparse
from datetime import datetime, timezone
import errno
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import sys
import subprocess
import threading
import time
import uuid

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
OS_ROOT = Path('/Users/brianb/MissionMed_worktrees/IR-PHASE1-REGISTRY-20261004-R2')
OS_HEAD = 'bc1d36fcb9f7bdda4bcd4ba507078b7787d802a2'
DECISION_SHA = '452a9e6259f6ae2f9e1441c725f79156b2d099d88a38af694b248e345b7dbe0e'
AUTHORITY_HANDOFF = 'handoffs/from_codex/IR_INTERVIEW_READY_0002/REGISTRATION_TO_CODEX.md'
AUTHORITY_HANDOFF_SHA = 'ed3a5cb6c439147471860a78654aeecbaca367d6ed2f7cd92c4159d331f6556d'
CLIENT_SHA = '36e37a487de0ec99191492c3ef286695bc4d8721cdac70f5c62863576e5c1431'
AUTHORITY_ADOPTION = {
    'historicalOSHead': '84754150b8c834ac25466860ab98600b5d5c1b9e',
    'historicalDecisionSha256': '32ad43957a4b9a245e5eb715c998692bf0ad8ed13d0766d88ab0e9955b7513bd',
    'currentOSHead': OS_HEAD, 'currentDecisionSha256': DECISION_SHA,
    'currentAuthorityHandoffSha256': AUTHORITY_HANDOFF_SHA,
    'basis': 'FOREMAN_VERIFIED_ROUTED_IR_UNCHANGED_OS_ADDITIONS',
}
SOURCE_BASE = '2db1f985e4678f8429af7b45969cde5729bd26d8'
TRANSPORT_SHA = '6bab4c948b28202b7a803228f2123d5c95137030f16eb129c427b4ddcc487cad'
ORIGIN = 'https://github.com/brinyu13/missionmed-hq.git'
REF = 'refs/heads/codex/ir-interview-ready-0002-storyforge'
OWNER = 'codex-ir-phase1-foreman'
PATHS = ['interview-ready/build.py', 'interview-ready/integration/release.test.py', 'interview-ready/evidence/integration-worker-handoff.md']
BASE_PREIMAGES = {'interview-ready/build.py': '252faef3ee21ed66d7d0eb331c113c533eb28a0de2e5e0cfcf4c4d7f686ac1e1', 'interview-ready/integration/release.test.py': '98401d50a70d9a037602775e92273e81d9aab3a1c2ce4201fbf2f3762282e592', 'interview-ready/evidence/integration-worker-handoff.md': 'fce9c8c8597b721892a63b4705203eb1b1c672dc070819c8f99088f1970d1e0f'}
INTERVAL = 5.0
BUILDER = 'codex-ir-live-render-source-runner-builder'
PACKET_SHA = 'a59585b87eb4119bdf848de69080c6c949d0449e4be1c3f0d323e80e2760a79f'
PACKET_FILE = 'INTEGRATION_LEASE_RUNNER_HANDOFF.md'
DIAGNOSIS_FILE = 'LIVE_RENDER_COMPATIBILITY_DIAGNOSIS.md'
DIAGNOSIS_SHA = '5f31e00f4704532bea3cd6e8985242e83f8df1459ccad3b6bcdcb6b1c145230f'


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


def original_preimages(root):
    """Read fixed immutable local Git objects; no shell, credentials or remote."""
    command = ['git', '--no-replace-objects', '--literal-pathspecs', '-C', str(root)]
    tree = subprocess.run(command + ['ls-tree', '-rz', SOURCE_BASE, '--', *PATHS],
                          stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, check=False)
    if tree.returncode:
        raise Stop('ORIGINAL_OBJECT_DENIED')
    images = dict.fromkeys(PATHS, 'ABSENT')
    for entry in tree.stdout.split(b'\0'):
        if not entry:
            continue
        metadata, name = entry.split(b'\t', 1)
        mode, kind, oid = metadata.split()
        name = name.decode('utf-8')
        if name not in images or kind != b'blob' or mode not in (b'100644', b'100755'):
            raise Stop('ORIGINAL_OBJECT_DENIED')
        blob = subprocess.run(command + ['cat-file', 'blob', oid.decode('ascii')],
                              stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, check=False)
        if blob.returncode:
            raise Stop('ORIGINAL_OBJECT_DENIED')
        images[name] = hashlib.sha256(blob.stdout).hexdigest()
    return images


def repair_packet():
    text = (HERE / PACKET_FILE).read_text()
    begin = '<!-- LIVE_RENDER_REPAIR_PACKET_BEGIN -->'
    end = '<!-- LIVE_RENDER_REPAIR_PACKET_END -->'
    if text.count(begin) != 1 or text.count(end) != 1:
        raise Stop('PACKET_DENIED')
    packet = json.loads(text.split(begin, 1)[1].split(end, 1)[0])
    if (packet.get('schema') != 'ir.live_render_source_repair.packet.v1'
            or hashlib.sha256(canonical(packet)).hexdigest() != PACKET_SHA):
        raise Stop('PACKET_DENIED')
    return packet


def snapshot(root=ROOT, os_root=OS_ROOT):
    return {'sourceBASE': SOURCE_BASE, 'sourceHead': head(root), 'osHead': head(os_root),
            'writePaths': PATHS, 'sourcePreimages': preimages(root),
            'originalSourcePreimages': original_preimages(root),
            'repairPacket': repair_packet(),
            'diagnosisSha256': digest(HERE / DIAGNOSIS_FILE),
            'runnerSha256': digest(Path(__file__)),
            'testsSha256': digest(HERE / 'integration_lease_runner_tests.py'),
            'transportSha256': digest(HERE / 'lease_transport.py'),
            'workerPacketSha256': hashlib.sha256(canonical(repair_packet())).hexdigest(),
            'canonicalClientSha256': digest(os_root / 'tools/engineering_os_lease.py'),
            'decisionSha256': digest(os_root / 'decisions/DR-376_ir_phase1_bounded_execution_annex.md'),
            'authorityHandoffSha256': digest(os_root / AUTHORITY_HANDOFF),
            'authorityAdoption': AUTHORITY_ADOPTION,
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
            or actual['originalSourcePreimages'] != BASE_PREIMAGES
            or actual['workerPacketSha256'] != PACKET_SHA
            or actual['decisionSha256'] != DECISION_SHA
            or actual['authorityHandoffSha256'] != AUTHORITY_HANDOFF_SHA
            or actual['canonicalClientSha256'] != CLIENT_SHA
            or actual['authorityAdoption'] != AUTHORITY_ADOPTION
            or actual['writePaths'] != PATHS
            or actual['sourcePreimages'] != BASE_PREIMAGES
            or hashlib.sha256(canonical(actual['repairPacket'])).hexdigest() != PACKET_SHA
            or actual['diagnosisSha256'] != DIAGNOSIS_SHA
            or actual['repairPacket']['sourceBASE'] != SOURCE_BASE
            or actual['repairPacket']['writePaths'] != PATHS
            or actual['repairPacket']['sourcePreimages'] != BASE_PREIMAGES
            or not isinstance(actual['sourceHead'], str)
            or len(actual['sourceHead']) != 40
            or any(c not in '0123456789abcdef' for c in actual['sourceHead'])):
        raise Stop('PIN_MISMATCH')
    if (approval.get('schema') != 'ir.live_render_source_lease.approval.v1'
            or approval.get('verdict') != 'APPROVE'
            or approval.get('independentReviewer') in (None, '', OWNER, BUILDER)
            or approval.get('contract') != actual or not fresh(approval, now)):
        raise Stop('APPROVAL_DENIED')
    binding = hashlib.sha256(canonical(actual)).hexdigest()
    repair = approval.get('repairReview', {})
    if (repair.get('schema') != 'ir.live_render_source_lease.repair_review.v1'
            or repair.get('verdict') != 'APPROVE'
            or repair.get('independentReviewer') in (None, '', OWNER, BUILDER)
            or repair.get('bindingSha256') != binding or not fresh(repair, now)
            or not repair.get('reportFile') or not repair.get('reportSha256')):
        raise Stop('REPAIR_REVIEW_DENIED')
    return binding


def safe_diagnostic(phase, error):
    """Whitelist classifications only; never inspect exception text or raw values."""
    classification = ('OS_ERROR' if isinstance(error, OSError) else
                      'CONTROL_STOP' if isinstance(error, Stop) else
                      'INTERRUPTED' if isinstance(error, (KeyboardInterrupt, SystemExit)) else 'EXCEPTION')
    number = error.errno if isinstance(error, OSError) else None
    number = number if type(number) is int and number in errno.errorcode else None
    value = {'phase': phase, 'errorClass': classification, 'errno': number}
    try:
        sys.stderr.write(canonical(value).decode('ascii') + '\n')
        sys.stderr.flush()
    except BaseException:
        pass
    return value


def breadcrumb(directory, phase, binding):
    atomic(directory, 'SOURCE_LEASE_PHASE.json',
           {'phase': phase, 'bindingSha256': binding, 'updatedUnix': time.time()})


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
    if (Path(directory) / 'SOURCE_LEASE_FAILURE.json').exists():
        raise Stop('WORKER_STOP')
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
    phase = 'ACQUIRED'
    renewal_phase = 'HEARTBEAT'
    diagnostics = []

    def diagnose(where, error):
        nonlocal outcome
        outcome = 'STOP'
        value = safe_diagnostic(where, error)
        diagnostics.append(value)
        try:
            (directory / 'SOURCE_LEASE_STATUS.json').unlink(missing_ok=True)
        except BaseException:
            pass
        # Best effort durable worker fence; absence never proves healthy receipts.
        try:
            with (directory / 'SOURCE_LEASE_FAILURE.json').open('xb') as stream:
                (directory / 'SOURCE_LEASE_FAILURE.json').chmod(0o600)
                stream.write(canonical({'state': 'STOP', 'bindingSha256': binding, **value}))
        except BaseException:
            pass

    def receipt(name, value, where):
        try:
            atomic(directory, name, value)
            return True
        except BaseException as error:
            diagnose(where, error)
            return False

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
        nonlocal handle, renewal_phase
        with lock:
            renewal_phase = 'HEARTBEAT'
            breadcrumb(directory, renewal_phase, binding)
            handle = client.heartbeat(handle)
            renewal_phase = 'HEALTHY_STATUS'
            atomic(directory, 'SOURCE_LEASE_STATUS.json', record('HEALTHY', 'RENEWED'))

    def keeper():
        while not event.wait(interval):
            try:
                renew()
            except BaseException as error:
                failure.append('KEEPER_FAILED')
                diagnose(renewal_phase, error)
                try:
                    receipt('SOURCE_LEASE_STATUS.json', record('STOP', 'KEEPER_FAILED'), 'KEEPER_STOP_STATUS')
                finally:
                    event.set()
                return

    try:
        breadcrumb(directory, phase, binding)
        phase = 'INITIAL_RENEWAL'
        renew()  # Immediately validate a real canonical renewal before READY.
        thread = threading.Thread(target=keeper, name='ir-integration-source-lease-keeper', daemon=True)
        thread.start()
        with lock:
            if failure or event.is_set():
                raise Stop('KEEPER_FAILED')
            phase = 'READY'
            atomic(directory, 'SOURCE_LEASE_READY.json', record('SOURCE_LEASE_READY', 'RENEWED'))
        deadline = time.monotonic() + max_seconds
        while not event.is_set():
            phase = 'WAIT'
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
    except BaseException as error:
        diagnose(renewal_phase if phase == 'INITIAL_RENEWAL' else phase, error)
    finally:
        event.set()
        if thread is not None:
            try:
                thread.join(4)
            except BaseException as error:
                diagnose('KEEPER_JOIN', error)
        try:
            receipt('SOURCE_LEASE_STATUS.json', record('STOP', outcome), 'TERMINAL_STATUS')
        finally:
            try:
                with lock:
                    client.release(handle)
                release = 'RELEASED'
            except BaseException as error:
                release = 'RELEASE_FAILED'
                diagnose('RELEASE', error)
            result_written = receipt('SOURCE_LEASE_RESULT.json',
                {'outcome': outcome, 'release': release, 'bindingSha256': binding,
                 'diagnostics': diagnostics}, 'RESULT')
    return outcome != 'STOP' and release == 'RELEASED' and result_written and not diagnostics


def execute(approval_path, admission_path, directory, max_seconds=3600):
    # No module with credential capability is imported until all local gates pass.
    actual = snapshot()
    approval = read_json(approval_path)
    binding = validate_approval(approval, actual)
    admission = read_json(admission_path)
    if (admission.get('schema') != 'ir.live_render_source_lease.read_admission.v1'
            or admission.get('verdict') != 'APPROVE'
            or admission.get('independentReviewer') in (None, '', OWNER, BUILDER)
            or admission.get('bindingSha256') != binding
            or admission.get('approvalSha256') != digest(approval_path)
            or not fresh(admission, time.time())
            or admission.get('maxSeconds') != max_seconds
            or not 0 < max_seconds <= 3600):
        raise Stop('READ_ADMISSION_DENIED')
    # Reports are separate reviewer artifacts; their exact bytes must exist locally.
    reports = (approval, admission, approval['repairReview'])
    if len({document['reportFile'] for document in reports}) != 3:
        raise Stop('SEPARATE_REVIEW_REPORT_DENIED')
    for document in reports:
        report = HERE / document['reportFile']
        if report.parent != HERE or digest(report) != document['reportSha256']:
            raise Stop('REVIEW_REPORT_DENIED')
    # Canonical scope validation is pure local and precedes any credential capability.
    canonical_client = load_module('ir_canonical_lease', OS_ROOT / 'tools/engineering_os_lease.py', actual['canonicalClientSha256'])
    scope = canonical_client.path_scope(ORIGIN, REF, 'interview-ready')
    directory.mkdir(mode=0o700)  # unique, nonexisting control directory only
    # Mark the approval consumed BEFORE any retrieval. Failed reads cannot retry.
    marker = HERE / ('SOURCE_LIVE_RENDER_REPAIR_LEASE_READ_CONSUMED_' + digest(admission_path) + '.json')
    with marker.open('xb') as stream:
        marker.chmod(0o600)
        stream.write(canonical({'bindingSha256': binding, 'state': 'CONSUMED'}))
    phase = 'TRANSPORT_LOAD'
    try:
        breadcrumb(directory, phase, binding)
        transport = load_module('ir_source_transport', HERE / 'lease_transport.py', actual['transportSha256'])
        phase = 'RETRIEVE'
        breadcrumb(directory, phase, binding)
        key = transport.retrieve_existing_key()
        phase = 'AUTHENTICATE'
        breadcrumb(directory, phase, binding)
        if transport.authentication_probe(key) != 200:
            raise Stop('AUTHENTICATION_DENIED')
        client_type = canonical_client.SupabaseLeaseClient
        client = client_type(base_url=transport.BASE_URL, project_ref=transport.PROJECT, api_key=key,
                             opener=transport.ApikeyOnlyLeaseOpener(key, client_type._open_no_redirect))
        phase = 'ACQUIRE'
        breadcrumb(directory, phase, binding)
        lease = client.acquire_writer(scope=scope, write_paths=PATHS, owner_id=OWNER,
            session_id='ir-phase1-live-render-source-20261004-' + uuid.uuid4().hex, binding=binding)
    except BaseException as error:
        safe_diagnostic(phase, error)
        raise Stop('EXECUTION_STOP') from None
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
