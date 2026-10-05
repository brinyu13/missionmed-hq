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

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
ARTIFACT_ROOT = HERE.parent
OS_ROOT = Path('/Users/brianb/MissionMed_worktrees/IR-PHASE1-REGISTRY-20261004-R2')
OS_HEAD = 'fe17a4ca5572aecdc2d2761e8c2d993f7aebb8bf'
SUPPLEMENT_FILE = 'decisions/DR-391_ir_phase1_public_commerce_fallback.md'
SUPPLEMENT_SHA = '0ac4eace2f96ccfbc10864d7a022cba1eb0c6f9c4eeb0bb668dd342e3c532982'
SUPPLEMENT_HANDOFF = 'handoffs/from_codex/IR_INTERVIEW_READY_0002/REGISTRATION_TO_CODEX.md'
SUPPLEMENT_HANDOFF_SHA = '2251e6798c0d117d56276f1bae637f9c6864209ce2f0e1f31a8a71af9b25e00a'
HISTORICAL_OS_HEAD = 'bc1d36fcb9f7bdda4bcd4ba507078b7787d802a2'
DECISION_SHA = '452a9e6259f6ae2f9e1441c725f79156b2d099d88a38af694b248e345b7dbe0e'
DR375_SHA = '05803e16c985437a6400aa261e55bdb57f50ed2a0c7200f904fcffc49155a508'
AUTHORITY_HANDOFF = 'handoffs/from_codex/IR_INTERVIEW_READY_0002/REGISTRATION_TO_CODEX.md'
AUTHORITY_HANDOFF_SHA = '2251e6798c0d117d56276f1bae637f9c6864209ce2f0e1f31a8a71af9b25e00a'
HISTORICAL_AUTHORITY_HANDOFF_SHA = 'ed3a5cb6c439147471860a78654aeecbaca367d6ed2f7cd92c4159d331f6556d'
CLIENT_SHA = '36e37a487de0ec99191492c3ef286695bc4d8721cdac70f5c62863576e5c1431'
SOURCE_BASE = '341c9ad88b0c00ea0b09a0e3bbf04eeb770b89e5'
ACCEPTED_PRODUCT = '8717ebd04ad1cd60e66ef197b55080d58492e2be'
PATTERN_SHA = '12d4c346a879867d68965621dc90c2789899375fb010cfd8066850d4a7318953'
SCOPE = 'PATH:93cc7bada097a03b5163b83ecfc0d5f8fb2357c6f517b6c6f4a456acc7c155c6'
FALLBACK_DIR = ARTIFACT_ROOT / 'FINISH_NOW_DEVICE_FALLBACK_20261005/AFTER_SHOPPING'
FALLBACK_PATCH_SHA = '01230fa4d8351373135a0c494329b4325fbcf11d97a26bce366aecb1861190be'
FALLBACK_TESTS_SHA = '1bed34f841c41d35a4a211e56a8d1f11b1e75cb5642820fc58c22dacfd4850df'
FALLBACK_MANIFEST_SHA = '265d6a72bbf246ea675585eb47f26e58b4d32d01283fb25d505715e406d6e399'
FALLBACK_RECEIPT_SHA = '1d42d6d033a9bebad0ecae28347b7414b2f6466eaa7d68c8efd9ef2d207bb785'
FALLBACK_HANDOFF_SHA = 'fc7eb3a5f44a83c1243107589abd4f136941924e7d130952ccb0332b7ad3c50f'
PLANNED_POSTIMAGES = {'interview-ready/account.js': 'dd4f4b31ccb954add64ce30ac34ab2c98eb26de400051b99f8171c828e0c8ce7', 'interview-ready/build.py': '286a289655ab8b2754eaf0cb8d265f2cc13eeb8a5d41609f7deec6dfcb91413b', 'interview-ready/phase1.json': '84bf2ad8c3055bd8c3ab36b87377ba356b6c89e05ee707399a56e124b83bb732', 'interview-ready/phase1.js': '3c2113b145e095d41c5078aacb50cc51cc64c72f29a1326d6f55662ca1bc8418'}
TRANSPORT_SHA = '6bab4c948b28202b7a803228f2123d5c95137030f16eb129c427b4ddcc487cad'
ORIGIN = 'https://github.com/brinyu13/missionmed-hq.git'
REF = 'refs/heads/codex/ir-interview-ready-0002-storyforge'
OWNER = 'codex-ir-phase1-foreman'
PATHS = ['interview-ready/account.js', 'interview-ready/build.py', 'interview-ready/phase1.json', 'interview-ready/phase1.js']
BASE_PREIMAGES = {'interview-ready/account.js': '018a0e2f3706f2f5cbe64ddb8b8fb2cf2b07b640730c7b3211cbc4397b17518a', 'interview-ready/build.py': 'fa3e73e912d9c0f8c114d04f64043ab33bc6d6e21ba8d07c7e8e5e3ca13a050c', 'interview-ready/phase1.json': 'c552cc20f09a7dce76c91a22bfd507e91c6d33b78b043df9f420fdf57d1351c0', 'interview-ready/phase1.js': 'bd575317e9eba2409ebb91a59034c0ecb4274eb2510b24cdef82a753c7690a47'}
INTERVAL = 5.0
BUILDER = 'codex-ir-device-fallback-source-runner-builder'
PACKET_SHA = '0198f086744d49577ad95883d1c60825c8768c0fa4307458fa1872aa467d75e1'
PACKET_FILE = 'PACKET.md'

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


def original_preimages(root, source_ref=SOURCE_BASE):
    """Read fixed immutable local Git objects; no shell, credentials or remote."""
    command = ['git', '--no-replace-objects', '--literal-pathspecs', '-C', str(root)]
    tree = subprocess.run(command + ['ls-tree', '-rz', source_ref, '--', *PATHS],
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


def pattern_digest(root):
    command = ['git', '--no-replace-objects', '-C', str(root), 'show',
               ACCEPTED_PRODUCT + ':_AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/integration_lease_runner.py']
    value = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, check=False)
    if value.returncode:
        raise Stop('PATTERN_OBJECT_DENIED')
    return hashlib.sha256(value.stdout).hexdigest()


def device_packet():
    text = (HERE / PACKET_FILE).read_text()
    begin, end = '<!-- DEVICE_SOURCE_PACKET_BEGIN -->', '<!-- DEVICE_SOURCE_PACKET_END -->'
    if text.count(begin) != 1 or text.count(end) != 1:
        raise Stop('PACKET_DENIED')
    packet = json.loads(text.split(begin, 1)[1].split(end, 1)[0])
    if packet.get('schema') != 'ir.device_fallback_source.packet.v1' or hashlib.sha256(canonical(packet)).hexdigest() != PACKET_SHA:
        raise Stop('PACKET_DENIED')
    return packet


def fallback_source_evidence():
    manifest = read_json(FALLBACK_DIR / 'BUILD_MANIFEST.json')
    receipt = read_json(FALLBACK_DIR / 'COPY_RECEIPT.json')
    phase = read_json(FALLBACK_DIR / 'phase1.json')
    planned = {name:manifest['inputs'].get(name.removeprefix('interview-ready/')) for name in PATHS}
    if (planned != PLANNED_POSTIMAGES or manifest.get('assetProfile') != 'production'
            or manifest.get('releaseApproved') is not False or manifest.get('accountReady') is not False
            or manifest.get('persistenceMode') != 'device-only'
            or manifest.get('gatewayStorageOwner') != 'device-only mmed-ir-device-v1'
            or receipt.get('sourceHead') != SOURCE_BASE or receipt.get('canonicalInputsBeforeAfter') != 'PASS'
            or receipt.get('productionBuildBlocked') is not True
            or receipt.get('renderSha256') != manifest.get('sha256')
            or phase.get('persistenceMode') != 'device-only' or phase.get('accountReady') is not False
            or phase.get('accountPersistenceReady') is not False or phase.get('releaseState') != 'public-commerce'):
        raise Stop('FALLBACK_EVIDENCE_DENIED')
    return planned


def snapshot(root=ROOT, os_root=OS_ROOT):
    if not all((OS_HEAD, SUPPLEMENT_FILE, SUPPLEMENT_SHA, SUPPLEMENT_HANDOFF, SUPPLEMENT_HANDOFF_SHA)):
        raise Stop('AUTHORITY_CUSTODY_PENDING')
    return {'sourceBASE':SOURCE_BASE, 'sourceHead':head(root),
            'acceptedProductCommit':ACCEPTED_PRODUCT, 'patternRunnerSha256':pattern_digest(root),
            'scope':SCOPE, 'sharedDomains':[], 'osHead':head(os_root), 'historicalOSHead':HISTORICAL_OS_HEAD,'historicalAuthorityHandoffSha256':HISTORICAL_AUTHORITY_HANDOFF_SHA,
            'writePaths':PATHS, 'sourcePreimages':preimages(root), 'originalSourcePreimages':original_preimages(root),
            'devicePacket':device_packet(), 'workerPacketSha256':hashlib.sha256(canonical(device_packet())).hexdigest(),
            'runnerSha256':digest(Path(__file__)), 'testsSha256':digest(HERE/'integration_device_source_runner_test.py'),
            'fallbackPatchSha256':digest(FALLBACK_DIR/'device-fallback.patch'),
            'fallbackTestsSha256':digest(FALLBACK_DIR/'device-fallback.test.js'),
            'fallbackManifestSha256':digest(FALLBACK_DIR/'BUILD_MANIFEST.json'),
            'fallbackReceiptSha256':digest(FALLBACK_DIR/'COPY_RECEIPT.json'),
            'fallbackHandoffSha256':digest(FALLBACK_DIR/'HANDOFF.md'),
            'plannedSourcePostimages':fallback_source_evidence(),
            'transportSha256':digest(ARTIFACT_ROOT/'lease_transport.py'),
            'canonicalClientSha256':digest(os_root/'tools/engineering_os_lease.py'),
            'decisionSha256':digest(os_root/'decisions/DR-376_ir_phase1_bounded_execution_annex.md'),
            'dr375Sha256':digest(os_root/'decisions/DR-375_ir_phase1_production_authority.md'),
            'authorityHandoffSha256':digest(os_root/AUTHORITY_HANDOFF),
            'supplementFile':SUPPLEMENT_FILE, 'supplementSha256':digest(os_root/SUPPLEMENT_FILE),
            'supplementHandoffFile':SUPPLEMENT_HANDOFF, 'supplementHandoffSha256':digest(os_root/SUPPLEMENT_HANDOFF),
            'origin':ORIGIN, 'ref':REF, 'relativePath':'interview-ready', 'owner':OWNER}


def validate_approval(approval, actual, now=None):
    now = time.time() if now is None else now
    if not all((OS_HEAD, SUPPLEMENT_FILE, SUPPLEMENT_SHA, SUPPLEMENT_HANDOFF, SUPPLEMENT_HANDOFF_SHA)):
        raise Stop('AUTHORITY_CUSTODY_PENDING')
    expected = {'sourceBASE':SOURCE_BASE,'acceptedProductCommit':ACCEPTED_PRODUCT,'patternRunnerSha256':PATTERN_SHA,
        'scope':SCOPE,'sharedDomains':[],'osHead':OS_HEAD,'historicalOSHead':HISTORICAL_OS_HEAD,'historicalAuthorityHandoffSha256':HISTORICAL_AUTHORITY_HANDOFF_SHA,
        'writePaths':PATHS,'sourcePreimages':BASE_PREIMAGES,'originalSourcePreimages':BASE_PREIMAGES,
        'fallbackPatchSha256':FALLBACK_PATCH_SHA,'fallbackTestsSha256':FALLBACK_TESTS_SHA,
        'fallbackManifestSha256':FALLBACK_MANIFEST_SHA,'fallbackReceiptSha256':FALLBACK_RECEIPT_SHA,
        'fallbackHandoffSha256':FALLBACK_HANDOFF_SHA,'plannedSourcePostimages':PLANNED_POSTIMAGES,
        'workerPacketSha256':PACKET_SHA,'transportSha256':TRANSPORT_SHA,'canonicalClientSha256':CLIENT_SHA,
        'decisionSha256':DECISION_SHA,'dr375Sha256':DR375_SHA,'authorityHandoffSha256':AUTHORITY_HANDOFF_SHA,
        'supplementFile':SUPPLEMENT_FILE,'supplementSha256':SUPPLEMENT_SHA,
        'supplementHandoffFile':SUPPLEMENT_HANDOFF,'supplementHandoffSha256':SUPPLEMENT_HANDOFF_SHA,
        'origin':ORIGIN,'ref':REF,'relativePath':'interview-ready','owner':OWNER}
    packet = actual.get('devicePacket', {})
    if (any(actual.get(k) != v for k,v in expected.items())
            or hashlib.sha256(canonical(packet)).hexdigest() != PACKET_SHA
            or packet.get('sourceBASE') != SOURCE_BASE or packet.get('writePaths') != PATHS
            or packet.get('sourcePreimages') != BASE_PREIMAGES or packet.get('plannedSourcePostimages') != PLANNED_POSTIMAGES
            or packet.get('patchSequence') != [{'patch':'FINISH_NOW_DEVICE_FALLBACK_20261005/AFTER_SHOPPING/device-fallback.patch',
                'sha256':FALLBACK_PATCH_SHA,'preimages':BASE_PREIMAGES,'postimages':PLANNED_POSTIMAGES}]
            or packet.get('authoritySupplement') != {'osHead':OS_HEAD,'decisionFile':SUPPLEMENT_FILE,
                'decisionSha256':SUPPLEMENT_SHA,'handoffFile':SUPPLEMENT_HANDOFF,'handoffSha256':SUPPLEMENT_HANDOFF_SHA}
            or not isinstance(actual.get('sourceHead'), str) or len(actual['sourceHead']) != 40
            or any(c not in '0123456789abcdef' for c in actual['sourceHead'])):
        raise Stop('PIN_MISMATCH')
    if (approval.get('schema') != 'ir.device_fallback_source_lease.approval.v1'
            or approval.get('verdict') != 'APPROVE'
            or approval.get('independentReviewer') in (None, '', OWNER, BUILDER)
            or approval.get('contract') != actual or not fresh(approval, now)):
        raise Stop('APPROVAL_DENIED')
    binding = hashlib.sha256(canonical(actual)).hexdigest()
    repair = approval.get('deviceReview', {})
    if (repair.get('schema') != 'ir.device_fallback_source_lease.device_review.v1'
            or repair.get('verdict') != 'APPROVE'
            or repair.get('independentReviewer') in (None, '', OWNER, BUILDER)
            or repair.get('bindingSha256') != binding or not fresh(repair, now)
            or not repair.get('reportFile') or not repair.get('reportSha256')):
        raise Stop('DEVICE_REVIEW_DENIED')
    return binding


def read_json(path):
    if path.is_symlink() or path.stat().st_size > 65536:
        raise Stop('CONTROL_FILE_DENIED')
    return json.loads(path.read_bytes())


def fresh(document, now):
    expiry = document.get('expiresUnix')
    return (type(expiry) in (int, float) and math.isfinite(expiry)
            and now < expiry <= now + 3600)


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
    if type(max_seconds) is not int or not 0 < max_seconds <= 3600:
        raise Stop('WAIT_BOUND_DENIED')
    if directory.parent.resolve() != HERE or directory.exists() or directory.is_symlink():
        raise Stop('CONTROL_DIRECTORY_DENIED')
    actual = snapshot()
    approval = read_json(approval_path)
    binding = validate_approval(approval, actual)
    admission = read_json(admission_path)
    if (admission.get('schema') != 'ir.device_fallback_source_lease.read_admission.v1'
            or admission.get('verdict') != 'APPROVE'
            or admission.get('independentReviewer') in (None, '', OWNER, BUILDER)
            or admission.get('bindingSha256') != binding
            or admission.get('approvalSha256') != digest(approval_path)
            or not fresh(admission, time.time())
            or admission.get('maxSeconds') != max_seconds
            or not 0 < max_seconds <= 3600):
        raise Stop('READ_ADMISSION_DENIED')
    # Reports are separate reviewer artifacts; their exact bytes must exist locally.
    reports = (approval, admission, approval['deviceReview'])
    if (len({document['reportFile'] for document in reports}) != 3
            or len({document['reportSha256'] for document in reports}) != 3):
        raise Stop('SEPARATE_REVIEW_REPORT_DENIED')
    for document in reports:
        report = HERE / document['reportFile']
        if report.parent != HERE or digest(report) != document['reportSha256']:
            raise Stop('REVIEW_REPORT_DENIED')
    # Canonical scope validation is pure local and precedes any credential capability.
    canonical_client = load_module('ir_canonical_lease', OS_ROOT / 'tools/engineering_os_lease.py', actual['canonicalClientSha256'])
    scope = canonical_client.path_scope(ORIGIN, REF, 'interview-ready')
    if scope != SCOPE:
        raise Stop('SCOPE_DENIED')
    directory.mkdir(mode=0o700)  # unique, nonexisting control directory only
    # Mark the approval consumed BEFORE any retrieval. Failed reads cannot retry.
    marker = HERE / ('SOURCE_DEVICE_LEASE_READ_CONSUMED_' + digest(admission_path) + '.json')
    with marker.open('xb') as stream:
        marker.chmod(0o600)
        stream.write(canonical({'bindingSha256': binding, 'state': 'CONSUMED'}))
    phase = 'TRANSPORT_LOAD'
    try:
        breadcrumb(directory, phase, binding)
        transport = load_module('ir_source_transport', ARTIFACT_ROOT / 'lease_transport.py', actual['transportSha256'])
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
            shared_domains=[], session_id='ir-phase1-device-source-20261005-' + uuid.uuid4().hex, binding=binding)
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
