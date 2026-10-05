"""Dormant exact-reviewed INSTALL/AUTH inventory/native lease wrapper.

No provider, credential, SSH or native capability is invoked on import/default.
AUTH requires separately reviewed finite containment and semantic hook gates.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import math
import re
import subprocess
import sys
import tarfile
import threading
import time
import uuid
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
OS_ROOT = Path('/Users/brianb/MissionMed_worktrees/IR-PHASE1-REGISTRY-20261004-R2')
OS_HEAD = 'bc1d36fcb9f7bdda4bcd4ba507078b7787d802a2'
OWNER = 'codex-ir-phase1-foreman'
BUILDER = '/root/phase1_native_qa_runner'
MANUAL_BUILDER = '/root/phase1_matrix_release_implementation'
ORIGIN = 'https://github.com/brinyu13/missionmed-hq.git'
REF = 'refs/heads/codex/ir-interview-ready-0002-storyforge'
TRANSPORT_SHA = '6bab4c948b28202b7a803228f2123d5c95137030f16eb129c427b4ddcc487cad'
CLIENT_SHA = '36e37a487de0ec99191492c3ef286695bc4d8721cdac70f5c62863576e5c1431'
NATIVE_SHA = 'c84bc76264749e732e0e2555d942d64086a18cf625dd8f5006c529d32977e8f1'
NATIVE_TESTS_SHA = '20f3510bd448acb876195eaba9592ca8d6845a1233f880b1deb8d872445e5015'
AUTHORITY = {'DR-375_ir_phase1_production_authority.md': '05803e16c985437a6400aa261e55bdb57f50ed2a0c7200f904fcffc49155a508',
             'DR-376_ir_phase1_bounded_execution_annex.md': '452a9e6259f6ae2f9e1441c725f79156b2d099d88a38af694b248e345b7dbe0e'}
RUNTIME = 'wp-content/mu-plugins/missionmed-interview-ready-runtime'
GATEWAY = 'wp-content/mu-plugins/missionmed-interview-ready.php'
PHASE_PATHS = {'install': (GATEWAY, RUNTIME),
               'auth': ('wp-includes/user.php', 'wp-includes/meta.php', GATEWAY),
               'auth_inventory': ('wp-includes/user.php', 'wp-includes/meta.php', GATEWAY)}
DOMAINS = {'install': ('MATRIX-SHELL',), 'auth': ('AUTH',), 'auth_inventory': ('AUTH',)}
PACKAGE_FILES = ('interview-ready-candidate.tar.gz', 'release-manifest.json', 'release-plan.json', 'package-receipt.json')
RUNTIME_KEYS = frozenset({'package', 'gateway', 'html', 'matrix', 'gate', 'buildManifest', 'pointer'})
REQUIRED_INPUTS = frozenset({'src.html','editorial.css','editorial.js','catalog.json','completion.css','completion.js',
    'fashion.json','phase1.json','phase1.css','phase1.js','production-assets.json','account.js',
    'integration/missionmed-interview-ready.php','integration/matrix-entry.js','integration/release.py','build.py'})
SHA = re.compile(r'[0-9a-f]{64}\Z')
COMMIT = re.compile(r'[0-9a-f]{40}\Z')
REPORT = re.compile(r'[A-Z0-9_]+\.md\Z')
PUBLIC_UUID = re.compile(r'[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\Z')
MANUAL_OPERATIONS = frozenset({'mkdir-root','mkdir-releases','mkdir-stage','transfer','extract','lint',
    'publish-release','prepare-pointer','publish-pointer','publish-gateway','readback','withdraw-gateway','withdraw-pointer',
    'refresh-ir-html','refresh-home-html','restore-pointer'})
MANUAL_SCHEMA = 'ir.runtime_native.manual_operation.v1'
MANUAL_DRAIN_SECONDS = 20
MANUAL_DISPATCH_MARGIN = 30
MANUAL_SERVER_MARGIN = 20
MANUAL_RENEW_SECONDS = 5
NATIVE_ACTIONS = frozenset({'collision_read','create_a','create_b','login','logout','app_get',
    'state_get','state_post','rejection_post','metadata_read','lock_lifecycle','native_connection_loss'})


class Stop(RuntimeError):
    def __init__(self):
        super().__init__('RUNTIME_NATIVE_STOP')


def check(value):
    if not value:
        raise Stop()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()


def safe_file(path):
    path = Path(path)
    check(not any(p.is_symlink() for p in (path, *path.parents)) and path.is_file())
    return path.read_bytes()


def digest(path):
    return hashlib.sha256(safe_file(path)).hexdigest()


def read_json(path):
    data = safe_file(path)
    check(len(data) <= 256 * 1024)
    return json.loads(data)


def head(root):
    value = subprocess.run(['git', '--no-replace-objects', '-C', str(root), 'rev-parse', 'HEAD'],
                           capture_output=True, check=False)
    check(value.returncode == 0)
    result = value.stdout.decode().strip()
    check(COMMIT.fullmatch(result) is not None)
    return result


def atomic(directory, name, value):
    target = directory / name
    check(not directory.is_symlink() and not target.is_symlink())
    tmp = directory / ('.' + name + '.' + uuid.uuid4().hex)
    try:
        with tmp.open('xb') as stream:
            tmp.chmod(0o600)
            stream.write(canonical(value) + b'\n')
        tmp.replace(target)
    finally:
        tmp.unlink(missing_ok=True)


def report_record(record, *, role='wrapper'):
    check(role in {'wrapper','install_artifact'})
    excluded = (OWNER,MANUAL_BUILDER,BUILDER) if role=='wrapper' else (OWNER,MANUAL_BUILDER)
    check(type(record) is dict and record.get('verdict') == 'APPROVE' and
          record.get('independentReviewer') not in (None, '', *excluded) and
          type(record.get('reportFile')) is str and REPORT.fullmatch(record['reportFile']) and
          SHA.fullmatch(record.get('reportSha256', '')))
    check(digest(HERE / record['reportFile']) == record['reportSha256'])
    return record


def valid_preimage(path, value):
    if type(value) is str:return value=='ABSENT' or SHA.fullmatch(value) is not None
    return (path==RUNTIME and type(value) is dict and set(value)=={'schema','sha256'} and
            value['schema']=='ir.runtime_native.layout_preimage.v1' and
            type(value['sha256']) is str and SHA.fullmatch(value['sha256']) is not None)


def snapshot(phase, spec):
    """Local sealed artifacts only; absent final qualification fails closed."""
    check(phase in PHASE_PATHS and type(spec) is dict)
    required = {'sourceHead','sourceCommit','packageDirectory','packageFiles','runtimeBindings',
                'qualifiedPreimages','qualifications','controlDirectory'}
    if phase == 'auth':
        required |= {'hookInventorySha256','nativeActions'}
    if phase == 'auth_inventory':required |= {'nativeActions'}
    check(set(spec) == required and COMMIT.fullmatch(spec['sourceHead']) and COMMIT.fullmatch(spec['sourceCommit']))
    check(head(ROOT) == spec['sourceHead'] and head(OS_ROOT) == OS_HEAD)
    directory = Path(spec['controlDirectory'])
    check(directory.is_absolute() and directory.parent == HERE and not directory.is_symlink())
    package = Path(spec['packageDirectory'])
    check(package.is_absolute() and set(spec['packageFiles']) == set(PACKAGE_FILES))
    check(all(SHA.fullmatch(v) for v in spec['packageFiles'].values()))
    check({name: digest(package / name) for name in PACKAGE_FILES} == spec['packageFiles'])
    manifest = read_json(package / 'release-manifest.json')
    plan = read_json(package / 'release-plan.json')
    check(manifest.get('schema') == 'missionmed.interview-ready.local-package.v1' and
          manifest.get('sourceRef') == spec['sourceCommit'] and
          manifest.get('sourceCommit') == spec['sourceCommit'] and
          manifest.get('sourceState') == 'EXACT_COMMITTED_INPUTS' and
          manifest.get('uncommittedInputs') == [] and manifest.get('productionApproved') is False and
          plan.get('executable') is False and plan.get('host') == 'missionmed-kinsta' and
          plan.get('webroot') == '/www/theresidencyacademy_209/public')
    html = manifest.get('htmlSha256', '')
    check(SHA.fullmatch(html) is not None)
    release = RUNTIME + '/releases/' + html + '/'
    artifacts = manifest.get('artifacts', {})
    expected_artifacts = {GATEWAY, *(release + n for n in ('interview-ready.html','matrix-entry.js','account-gate.html','build-manifest.json'))}
    check(set(artifacts) == expected_artifacts and all(SHA.fullmatch(v.get('sha256','')) for v in artifacts.values()))
    # Verify actual archive bytes rather than trusting its metadata alone.
    check((package/PACKAGE_FILES[0]).stat().st_size <= 32*1024*1024)
    with tarfile.open(package/PACKAGE_FILES[0], 'r:gz') as archive:
        members=archive.getmembers()
        check(len(members)==7 and {m.name for m in members}==expected_artifacts|{'release-manifest.json','release-plan.json'} and
              all(m.isfile() and m.size<=32*1024*1024 for m in members) and sum(m.size for m in members)<=64*1024*1024)
        for member in members:
            value=archive.extractfile(member).read()
            if member.name in artifacts:
                check(hashlib.sha256(value).hexdigest()==artifacts[member.name]['sha256'] and len(value)==artifacts[member.name]['bytes'])
            else:
                check(value==safe_file(package/member.name))
    inputs = manifest.get('buildInputs', {})
    check(REQUIRED_INPUTS <= inputs.keys())
    local = {}
    for name, expected in inputs.items():
        check(name in REQUIRED_INPUTS or re.fullmatch(r'img/[A-Za-z0-9_.-]+\.(jpg|jpeg|png|webp)', name))
        check(SHA.fullmatch(expected) is not None and digest(ROOT / 'interview-ready' / name) == expected)
        blob = subprocess.run(['git','--no-replace-objects','-C',str(ROOT),'show',spec['sourceCommit'] + ':interview-ready/' + name],
                              stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        check(blob.returncode == 0 and hashlib.sha256(blob.stdout).hexdigest() == expected)
        local['interview-ready/' + name] = expected
    native_review = HERE / 'NATIVE_QA_INDEPENDENT_REVIEW.md'
    for path in ('interview-ready/integration/matrix-entry.test.js','interview-ready/integration/gateway.test.php',
                 'interview-ready/integration/release.py','interview-ready/integration/release.test.py',
                 'interview-ready/evidence/integration-worker-handoff.md','interview-ready/qa-account.py',
                 '_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json'):
        local[path] = digest(ROOT / path)
        blob=subprocess.run(['git','--no-replace-objects','-C',str(ROOT),'show',spec['sourceCommit']+':'+path],
                            stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
        check(blob.returncode==0 and hashlib.sha256(blob.stdout).hexdigest()==local[path])
    check(set(spec['runtimeBindings']) == RUNTIME_KEYS and all(SHA.fullmatch(v) for v in spec['runtimeBindings'].values()))
    runtime = spec['runtimeBindings']
    check(runtime['package'] == spec['packageFiles'][PACKAGE_FILES[0]] and runtime['html'] == html and
          runtime['gateway'] == artifacts[GATEWAY]['sha256'] and
          runtime['matrix'] == artifacts[release+'matrix-entry.js']['sha256'] and
          runtime['gate'] == artifacts[release+'account-gate.html']['sha256'] and
          runtime['buildManifest'] == artifacts[release+'build-manifest.json']['sha256'])
    check(local['interview-ready/integration/missionmed-interview-ready.php']==runtime['gateway'])
    check(type(spec['qualifiedPreimages']) is dict and set(spec['qualifiedPreimages'])=={GATEWAY,RUNTIME,RUNTIME+'/current'} and
          all(valid_preimage(path,value) for path,value in spec['qualifiedPreimages'].items()))
    qualifications = spec['qualifications']
    expected_qualifications = {'phaseDecision','recovery','runtimeReadback'}
    if phase != 'install':
        expected_qualifications |= {'installProviderClear','nativeContainment'}
        expected_qualifications.add('reachableHooks' if phase=='auth' else 'bootstrapSafety')
        check(type(spec['nativeActions']) is list and spec['nativeActions'] and
              len(spec['nativeActions'])==len(set(spec['nativeActions'])))
    if phase == 'auth':
        check(SHA.fullmatch(spec['hookInventorySha256']) is not None and
              type(spec['nativeActions']) is list and spec['nativeActions'] and
              len(spec['nativeActions']) == len(set(spec['nativeActions'])) and
              set(spec['nativeActions']) <= NATIVE_ACTIONS and
              NATIVE_ACTIONS-{'native_connection_loss'} <= set(spec['nativeActions']))
    check(set(qualifications) == expected_qualifications)
    for record in qualifications.values():
        report_record(record,role='install_artifact' if phase=='install' else 'wrapper')
    check(qualifications['recovery'].get('qualifiedPreimages')==spec['qualifiedPreimages'])
    if phase!='install':
        containment=qualifications['nativeContainment']
        check(containment.get('nativeSha256')==NATIVE_SHA and containment.get('nativeTestsSha256')==NATIVE_TESTS_SHA and
              containment.get('transport')=='curl-stdin-v1' and containment.get('finiteContainmentQualified') is True and
              containment.get('curlExecutable')=='/usr/bin/curl' and containment.get('curlVersion')=='8.7.1' and
              containment.get('curlAsynchDNS') is True and
              qualifications['runtimeReadback'].get('runtimeBindings')==spec['runtimeBindings'])
        if phase=='auth':
            hooks=qualifications['reachableHooks']
            check(hooks.get('hookInventorySha256')==spec['hookInventorySha256'] and
                  hooks.get('reachableEffectsQualified') is True and hooks.get('bootstrapEffectsQualified') is True and
                  hooks.get('inventoryReadReleased') is True and SHA.fullmatch(hooks.get('inventoryBindingSha256','')))
        else:
            check(spec['nativeActions']==['creation_inventory_read'])
            bootstrap=qualifications['bootstrapSafety']
            check(bootstrap.get('bootstrapEffectsQualified') is True and bootstrap.get('reachableInventoryEffectsQualified') is True)
        clear=qualifications['installProviderClear'];observed=clear.get('observedUnix')
        check(clear.get('phase')=='install' and clear.get('released') is True and
              type(clear.get('activeIR')) is int and clear['activeIR']==0 and
              type(clear.get('pendingIR')) is int and clear['pendingIR']==0 and
              type(observed) in (int,float) and math.isfinite(observed) and observed>0)
    check(digest(HERE/'lease_transport.py') == TRANSPORT_SHA and
          digest(OS_ROOT/'tools/engineering_os_lease.py') == CLIENT_SHA and
          digest(HERE/'native_account_qa.py') == NATIVE_SHA and
          digest(HERE/'native_account_qa_tests.py') == NATIVE_TESTS_SHA)
    authority = {name: digest(OS_ROOT/'decisions'/name) for name in AUTHORITY}
    check(authority == AUTHORITY)
    return {'schema':'ir.runtime_native.contract.v1','phase':phase,'spec':spec,'sourceHead':head(ROOT),
            'osHead':OS_HEAD,'origin':ORIGIN,'ref':REF,'writePaths':list(PHASE_PATHS[phase]),
            'sharedDomains':list(DOMAINS[phase]),'sourcePreimages':local,'authority':authority,
            'runnerSha256':digest(Path(__file__)),'testsSha256':digest(HERE/'runtime_native_runner_tests.py'),
            'transportSha256':TRANSPORT_SHA,'clientSha256':CLIENT_SHA,'nativeSha256':NATIVE_SHA,
            'nativeTestsSha256':NATIVE_TESTS_SHA,'nativeReviewSha256':digest(native_review)}


def fresh(document):
    expiry = document.get('expiresUnix')
    return type(expiry) in (int,float) and math.isfinite(expiry) and time.time() < expiry <= time.time()+3600


def install_clear_fresh(contract, *, admitted_unix=None):
    """Prior clear is fresh at admission/acquisition/initial READY, not renewed."""
    if contract['phase']=='install':return
    clear=contract['spec']['qualifications']['installProviderClear']
    observed=clear.get('observedUnix')
    now=time.time();admitted=now if admitted_unix is None else admitted_unix
    check(clear.get('phase')=='install' and clear.get('released') is True and
          type(clear.get('activeIR')) is int and clear['activeIR']==0 and
          type(clear.get('pendingIR')) is int and clear['pendingIR']==0 and
          type(observed) in (int,float) and math.isfinite(observed) and observed>0 and
          type(admitted) in (int,float) and math.isfinite(admitted) and
          observed<=admitted<=now and admitted<observed+300)


def validate_controls(phase, approval, admission, actual, approval_digest, seconds):
    check(type(seconds) is int and 0 < seconds <= 3600)
    report_record(approval); report_record(admission)
    check(approval['reportFile'] != admission['reportFile'] and
          approval.get('schema') == 'ir.runtime_native.approval.v1' and
          approval.get('phase') == phase and approval.get('contract') == actual and fresh(approval))
    binding = hashlib.sha256(canonical(actual)).hexdigest()
    check(admission.get('schema') == 'ir.runtime_native.read_admission.v1' and
          admission.get('phase') == phase and admission.get('bindingSha256') == binding and
          admission.get('approvalSha256') == approval_digest and admission.get('maxSeconds') == seconds and fresh(admission))
    install_clear_fresh(actual)
    return binding


def load_module(name, path, expected):
    data = safe_file(path); check(hashlib.sha256(data).hexdigest() == expected)
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec); sys.modules[name] = module
    exec(compile(data,str(path),'exec'),module.__dict__)
    return module


def scope_for(module, phase):
    check(phase in PHASE_PATHS)
    scope = module.path_scope(ORIGIN, REF, RUNTIME) if phase == 'install' else 'SHARED:AUTH'
    module.validate_writer_scope(scope, PHASE_PATHS[phase], shared_domains=DOMAINS[phase])
    return scope


def runtime_readback(expected, *, budget, capture):
    """Fixed private read-only SSH; hashes dedicated public code/artifacts only."""
    check(set(expected) == RUNTIME_KEYS and all(SHA.fullmatch(v) for v in expected.values()))
    code = "import hashlib,json,pathlib,os\nr=pathlib.Path('/www/theresidencyacademy_209/public')\n" + \
        "base=r/'"+RUNTIME+"'\ncurrent=base/'current'\n" + \
        "assert not base.is_symlink() and not (base/'releases').is_symlink() and current.is_symlink()\n" + \
        "target=current.resolve(strict=True)\nassert target==base/'releases'/'"+expected['html']+"'\n" + \
        "files={'gateway':r/'"+GATEWAY+"','html':target/'interview-ready.html','matrix':target/'matrix-entry.js','gate':target/'account-gate.html','buildManifest':target/'build-manifest.json'}\n" + \
        "assert all(p.is_file() and not p.is_symlink() for p in files.values())\n" + \
        "v={k:hashlib.sha256(p.read_bytes()).hexdigest() for k,p in files.items()}\nv['pointer']=hashlib.sha256(os.readlink(current).encode()).hexdigest()\nprint(json.dumps(v))\n"
    try:
        out = capture(['ssh','-T','-o','BatchMode=yes','-o','ConnectTimeout=8',
            'missionmed-kinsta','python3','-'],code.encode(),budget,cap=4096)
        check(type(out) is bytes and len(out)<=4096)
        value = json.loads(out)
        check(type(value) is dict and set(value)==RUNTIME_KEYS-{'package'})
        value['package'] = expected['package']
        check(value == expected)
        return value
    except BaseException:
        raise Stop() from None


def expiry(handle):
    return datetime.fromisoformat(handle.expires_at.replace('Z','+00:00')).timestamp()


def fence(handle):
    return hashlib.sha256(canonical([handle.lease_id,handle.fencing_epoch,handle.nonce])).hexdigest()


class ReadbackGuard:
    """Session-owned begin guard; no recursive native Gate/control call."""
    def __init__(self, session, drain):
        self.session=session; self.lock=session.lock; self.drain=drain

    def __repr__(self):
        return '<ReadbackGuard private>'

    def open_check(self):
        s=self.session
        check(s.contract['phase'] in {'auth','auth_inventory'} and not s.closing and
              fence(s.handle)==s.initial_fence and expiry(s.handle)>time.time())
        with s.readback_lock:check(not s.readback_unresolved)
        if self.drain:
            check(s.native_gate is not None and s.native_gate.closed and
                  type(s.native_gate.drain_deadline) in (int,float) and
                  math.isfinite(s.native_gate.drain_deadline) and
                  time.monotonic()<s.native_gate.drain_deadline)
        else:
            check(not s.failed and time.monotonic()<s.deadline and
                  (s.native_gate is None or not s.native_gate.closed))


class Session:
    def __init__(self, client, handle, contract, binding, directory, seconds, actual_snapshot=snapshot, readback=None):
        self.client=client; self.handle=handle; self.contract=contract; self.binding=binding; self.directory=directory
        self.deadline=time.monotonic()+seconds; self.lock=threading.RLock(); self.event=threading.Event()
        self.deadline_unix=time.time()+seconds; self.closing=False
        self.initial_fence=fence(handle); self.failed=False; self.actual_snapshot=actual_snapshot; self.readback=readback
        self.native_gate=None; self.qa=None
        # Initial verification precedes NativeGate creation. Keep its process
        # custody separately, including when an unresolved keeper holds lock.
        self.readback_lock=threading.Lock(); self.readback_active={}; self.readback_unresolved=False

    def __repr__(self):
        return '<Session private>'

    def status(self, state):
        return {'state':state,'phase':self.contract['phase'],'bindingSha256':self.binding,
                'sourceHead':self.contract['sourceHead'],'fenceSha256':self.initial_fence,
                'updatedUnix':time.time(),'expiresAt':self.handle.expires_at,'deadlineUnix':self.deadline_unix}

    def checked_readback(self, *, drain=False):
        expected=self.contract['spec']['runtimeBindings']
        guard=ReadbackGuard(self,drain)
        with self.lock:
            guard.open_check()
            if self.readback is not None:
                # Explicit local test adapter; fixed execute uses the private
                # capture path below and cannot select this callback in controls.
                check(self.readback(expected)==expected);return
            check(self.qa is not None and self.qa.REAP_SECONDS==2)
            limit=self.native_gate.drain_deadline if drain else self.deadline
            budget=self.qa.Dispatch(min(time.monotonic()+10,limit),gate=guard)
            token=uuid.uuid4().hex
            with self.readback_lock:self.readback_active[token]=budget
            try:
                check(runtime_readback(expected,budget=budget,capture=self.qa.private_capture)==expected)
            finally:
                # A failed reap is sticky custody: even a later exit cannot
                # erase the unresolved phase or authorize canonical release.
                try:
                    ended=(not budget.started) if budget.child is None else budget.child.poll() is not None
                except BaseException:ended=False
                with self.readback_lock:
                    if ended:self.readback_active.pop(token,None)
                    else:self.readback_unresolved=True

    def readbacks_drained(self):
        # Never wait for Session.lock while an in-flight keeper is being joined.
        with self.readback_lock:return not self.readback_active and not self.readback_unresolved

    def stop(self):
        self.failed=True; self.closing=True; self.event.set()
        if self.native_gate is not None:self.native_gate.close()
        try: atomic(self.directory,'FAILURE.json',{'state':'STOP','bindingSha256':self.binding})
        except BaseException: pass
        try:
            atomic(self.directory,'STATUS.json',self.status('STOP'))
        except BaseException:
            try: (self.directory/'STATUS.json').unlink(missing_ok=True)
            except BaseException: pass

    def renew(self, *, verify_runtime=False):
        with self.lock:
            check(not self.failed and not self.closing and time.monotonic() < self.deadline)
            check(self.actual_snapshot(self.contract['phase'],self.contract['spec']) == self.contract)
            atomic(self.directory,'PHASE.json',{'phase':'HEARTBEAT','bindingSha256':self.binding})
            self.handle=self.client.heartbeat(self.handle)
            check(not self.closing and fence(self.handle)==self.initial_fence and expiry(self.handle)>time.time())
            if verify_runtime:
                self.checked_readback()
                check(expiry(self.handle)>time.time() and time.monotonic()<self.deadline)
            atomic(self.directory,'STATUS.json',self.status('STOP' if self.native_gate is not None and self.native_gate.closed else 'HEALTHY'))

    def keeper(self):
        while not self.event.wait(MANUAL_RENEW_SECONDS):
            try:
                if self.native_gate is not None and (self.native_gate.closed or time.monotonic()>=self.deadline):
                    self.native_gate.close();self.renew_native_drain()
                else:self.renew()
            except BaseException: self.stop(); return

    def renew_native_drain(self):
        with self.lock:
            check(self.native_gate is not None and self.native_gate.closed and not self.closing and
                  self.contract['phase'] in {'auth','auth_inventory'} and
                  fence(self.handle)==self.initial_fence and expiry(self.handle)>time.time())
            atomic(self.directory,'STATUS.json',self.status('STOP'))
            check(self.actual_snapshot(self.contract['phase'],self.contract['spec'])==self.contract)
            self.checked_readback(drain=True)
            check(expiry(self.handle)>time.time())
            self.handle=self.client.heartbeat(self.handle)
            check(fence(self.handle)==self.initial_fence and expiry(self.handle)>time.time())
            atomic(self.directory,'STATUS.json',self.status('STOP'))

    def renew_drain(self, owned):
        """Retain the existing fence for owned work; never reopen dispatch."""
        with self.lock:
            check(self.closing and self.contract['phase']=='install' and
                  fence(self.handle)==self.initial_fence and expiry(self.handle)>time.time())
            check(self.actual_snapshot('install',self.contract['spec'])==self.contract)
            value=manual_operation_record(self.directory,self.binding,self.initial_fence)
            check(value is not None and {k:v for k,v in value.items() if k!='state'}==owned and
                  value['state'] in {'ACTIVE','COMPLETE'})
            if value['state']=='COMPLETE':return
            # Snapshot work must not revive a lease that expired meanwhile.
            check(fence(self.handle)==self.initial_fence and expiry(self.handle)>time.time())
            self.handle=self.client.heartbeat(self.handle)
            check(fence(self.handle)==self.initial_fence and expiry(self.handle)>time.time())
            atomic(self.directory,'STATUS.json',self.status('STOP'))

    def native_control(self, qa, native_admission, action, binding):
        check(action in native_admission.actions and binding == native_admission.fingerprint())
        self.renew(verify_runtime=True)
        # Stamp only after actual canonical validation and exact installed readback.
        return qa.SafeStatus(binding,native_admission.runtime_preimages,time.monotonic(),True,True,True,True)


def check_install_guard(directory, binding, contract):
    """Pure local cooperative fence for every Foreman manual runtime operation.

    Foreman must ALSO compare the operation's independently qualified actual
    remote preimage/after-image. This helper does not install or change runtime.
    """
    check(contract['phase']=='install' and snapshot('install',contract['spec'])==contract)
    check(not (Path(directory)/'FAILURE.json').exists())
    status=read_json(Path(directory)/'STATUS.json')
    ready=read_json(Path(directory)/'READY.json')
    now=time.time()
    check(status.get('state')=='HEALTHY' and status.get('bindingSha256')==binding and
          status.get('sourceHead')==contract['sourceHead'] and 0<=time.time()-status['updatedUnix']<10 and
          status.get('phase')=='install' and ready.get('phase')=='install' and
          ready.get('bindingSha256')==binding and ready.get('sourceHead')==contract['sourceHead'] and
          SHA.fullmatch(status.get('fenceSha256','')) and status['fenceSha256']==ready.get('fenceSha256') and
          type(status.get('deadlineUnix')) in (int,float) and math.isfinite(status['deadlineUnix']) and
          status['deadlineUnix']==ready.get('deadlineUnix') and status['deadlineUnix']-now>=MANUAL_DISPATCH_MARGIN and
          datetime.fromisoformat(status['expiresAt'].replace('Z','+00:00')).timestamp()-now>=MANUAL_SERVER_MARGIN)
    return status


def manual_operation_record(directory, binding, fence_sha):
    path=Path(directory)/'MANUAL_OPERATION.json'
    if not path.exists() and not path.is_symlink():return None
    value=read_json(path)
    check(type(value) is dict and set(value)=={'schema','bindingSha256','fenceSha256','operation',
          'operationId','startUnix','deadlineUnix','state'} and value['schema']==MANUAL_SCHEMA and
          value['bindingSha256']==binding and value['fenceSha256']==fence_sha and
          value['operation'] in MANUAL_OPERATIONS and type(value['operationId']) is str and
          PUBLIC_UUID.fullmatch(value['operationId']) and value['state'] in {'ACTIVE','COMPLETE','UNCERTAIN'})
    start=value['startUnix'];deadline=value['deadlineUnix']
    check(type(start) in (int,float) and type(deadline) in (int,float) and math.isfinite(start) and
          math.isfinite(deadline) and 0<start<=time.time()+1 and 0<deadline-start<=10)
    return value


def drain_manual_operation(session, *, seconds=MANUAL_DRAIN_SECONDS):
    """No marker cleanup or remote cancellation inference. Unknown means defer."""
    def fresh_source():
        check(session.actual_snapshot(session.contract['phase'],session.contract['spec'])==session.contract and
              fence(session.handle)==session.initial_fence and expiry(session.handle)>time.time())
    try:fresh_source()
    except BaseException:return False
    # Expensive read-only source sealing precedes/follows the finite marker
    # wait. Renewal also reseals source, within that same marker-wait budget.
    limit=time.monotonic()+min(seconds,MANUAL_DRAIN_SECONDS);owned=None;renew_at=0
    while True:
        try:
            check(fence(session.handle)==session.initial_fence and expiry(session.handle)>time.time())
            value=manual_operation_record(session.directory,session.binding,session.initial_fence)
            # Initial absence after closure is safe under helper guard2. Once
            # ACTIVE was observed, disappearance is lost custody, never ACK.
            if value is None:
                if owned is not None:return False
                break
            identity={k:v for k,v in value.items() if k!='state'}
            if owned is not None:check(identity==owned)
            else:owned=identity
            if value['state']=='COMPLETE':break
            if value['state']=='UNCERTAIN':return False
            if time.monotonic()>=limit:return False
            if time.monotonic()>=renew_at:
                session.renew_drain(owned)
                renew_at=time.monotonic()+MANUAL_RENEW_SECONDS
                if time.monotonic()>=limit:return False
        except BaseException:return False
        time.sleep(min(.05,max(0,limit-time.monotonic())))
    try:fresh_source();return True
    except BaseException:return False


def native_admission(qa, contract, review_digest):
    spec=contract['spec']
    inventory=contract['phase']=='auth_inventory'
    check(set(spec['nativeActions']) <= qa.ALLOWED_ACTIONS and
          (spec['nativeActions']==['creation_inventory_read'] if inventory else
           'creation_inventory_read' not in spec['nativeActions'] and
           (qa.ALLOWED_ACTIONS-{'native_connection_loss','creation_inventory_read'}) <= set(spec['nativeActions'])))
    local=list(contract['sourcePreimages'].items())
    local.extend((str(OS_ROOT/'decisions'/name),sha) for name,sha in contract['authority'].items())
    local.extend([(str(Path(__file__)),contract['runnerSha256']),
                  (str(HERE/'runtime_native_runner_tests.py'),contract['testsSha256'])])
    value=qa.Admission(review_digest,contract['runnerSha256'],NATIVE_SHA,NATIVE_TESTS_SHA,
        tuple(local),tuple(sorted(spec['runtimeBindings'].items())),frozenset(spec['nativeActions']),
        None if inventory else spec['hookInventorySha256'],'inventory' if inventory else 'native')
    value.validate()
    return value


def safe_inventory_report(value):
    check(type(value) is dict and set(value)=={'schema','sha256','count','callbacks'} and
          value['schema']=='ir.native.hook_inventory.v1' and SHA.fullmatch(value['sha256']) and
          type(value['count']) is int and 0<=value['count']<=10000 and value['count']==len(value['callbacks']))
    return {'mode':'inventory','result':'PASS_PRIVATE_INVENTORY_READ',
            'inventorySha256':value['sha256'],'callbacksCount':value['count']}


def safe_native_report(value):
    limits={'VISIBLE_BROWSER_JOURNEY_PENDING','FULL_HTTP_DISCONNECT_PENDING','CORRUPT_DUPLICATE_HISTORY_FIXTURE_ONLY',
            'PROVIDER_CACHE_ACCEPTANCE_PENDING','ADMIN_MR_REGRESSION_PENDING'}
    check(type(value) is dict and set(value)=={'mode','result','checks','identities_retained','connection_loss','limits'} and
          value['mode']=='native' and value['result']=='PASS_BOUNDED_PROTOCOL_CHECKS' and
          type(value['checks']) is int and 0<value['checks']<=1000 and value['identities_retained']==2 and
          value['connection_loss'] in {'NOT_ADMITTED','ISOLATED_DRIVER_SEAM_ONLY'} and
          type(value['limits']) is list and len(value['limits'])==len(limits) and set(value['limits'])==limits)
    return value


def run_session(session, *, qa=None, native_review_digest=None):
    thread=None; result=None; released=False;deferred=False
    try:
        check(session.contract['phase'] in PHASE_PATHS and (session.contract['phase']=='install' or qa is not None))
        session.qa=qa  # Available for private initial readback before NativeGate.
        install_clear_fresh(session.contract)
        session.renew(verify_runtime=session.contract['phase']!='install')
        ready=session.status('READY')
        install_clear_fresh(session.contract,admitted_unix=ready['updatedUnix'])
        atomic(session.directory,'READY.json',ready)
        thread=threading.Thread(target=session.keeper,daemon=True,name='ir-runtime-native-keeper');thread.start()
        if session.contract['phase']=='install':
            while not session.event.wait(.25):
                check(time.monotonic()<session.deadline and not session.failed)
                stop=session.directory/'STOP.json'
                if stop.exists():
                    value=read_json(stop)
                    check(value=={'action':value.get('action'),'owner':OWNER,'phase':'install',
                        'bindingSha256':session.binding,'fenceSha256':session.initial_fence} and
                        value['action'] in {'DONE','RELEASE'})
                    result={'phase':'install','result':'FOREMAN_STOP_ACCEPTED'};break
            check(result is not None and not session.failed)
        else:
            admitted=native_admission(qa,session.contract,native_review_digest)
            gate=qa.Gate(admitted,lambda action,binding:session.native_control(qa,admitted,action,binding),
                         session.contract['runnerSha256'],deadline=session.deadline)
            session.native_gate=gate
            # Fixed read-only entry precedes a separately admitted create run.
            result=qa.creation_inventory_read(gate) if session.contract['phase']=='auth_inventory' else safe_native_report(qa.execute_native(gate))
            if session.contract['phase']=='auth_inventory':safe_inventory_report(result)
            check(not session.failed and time.monotonic()<session.deadline)
    except BaseException:
        if session.native_gate is None:session.stop()
        else:
            session.failed=True;session.native_gate.close()
            try:atomic(session.directory,'STATUS.json',session.status('STOP'))
            except BaseException:session.stop()
        result=None
    finally:
        native_drained=True
        if session.native_gate is not None:
            session.native_gate.close()
            try:atomic(session.directory,'STATUS.json',session.status('STOP'))
            except BaseException:session.stop();result=None
            # Receipt failure cannot skip the private workers' finite drain.
            try:native_drained=session.native_gate.drain()
            except BaseException:native_drained=False
        # Close dispatch before waiting: helper guard2 must reread this STOP
        # after exclusive ACTIVE publication and before any remote capability.
        session.closing=True
        session.event.set()
        dispatch_closed=False
        try:
            atomic(session.directory,'STATUS.json',session.status('STOP'));dispatch_closed=True
        except BaseException:
            session.stop();result=None
            dispatch_closed=not (session.directory/'STATUS.json').exists() and not (session.directory/'STATUS.json').is_symlink()
        if thread is not None:
            try: thread.join(4)
            except BaseException: session.stop();result=None
        # Fence a keeper that had already passed its closing check before the
        # first STOP write. Once joined it cannot overwrite this final STOP.
        if thread is None or not thread.is_alive():
            try:
                atomic(session.directory,'STATUS.json',session.status('STOP'));dispatch_closed=True
            except BaseException:
                session.stop();result=None
                dispatch_closed=not (session.directory/'STATUS.json').exists() and not (session.directory/'STATUS.json').is_symlink()
        drained=native_drained and session.readbacks_drained() and dispatch_closed and (thread is None or not thread.is_alive()) and drain_manual_operation(session)
        if not drained:
            deferred=True;session.stop();result=None
        else:
            try:
                with session.lock: session.client.release(session.handle)
                released=True
            except BaseException: session.stop();result=None
        try:
            atomic(session.directory,'RESULT.json',{'phase':session.contract['phase'],
                'result':'BOUNDED_PHASE_COMPLETE' if result is not None and not session.failed else 'STOP',
                'release':'RELEASED' if released else 'RELEASE_DEFERRED' if deferred else 'RELEASE_FAILED','bindingSha256':session.binding,
                'nativeReport':safe_inventory_report(result) if result is not None and session.contract['phase']=='auth_inventory' else
                               result if result is not None and session.contract['phase']=='auth' else None})
        except BaseException: session.stop();result=None
    return result if released and not session.failed else None


def execute(phase, approval_path, read_path, seconds=3600):
    check(phase in PHASE_PATHS)
    approval=read_json(approval_path); actual=snapshot(phase,approval['spec'])
    admission=read_json(read_path)
    binding=validate_controls(phase,approval,admission,actual,digest(approval_path),seconds)
    check(approval['spec']==actual['spec'])
    directory=Path(actual['spec']['controlDirectory']);check(not directory.exists())
    canonical_client=load_module('ir_runtime_canonical_client',OS_ROOT/'tools/engineering_os_lease.py',CLIENT_SHA)
    scope=scope_for(canonical_client,phase)
    if phase!='install':
        check(threading.current_thread() is threading.main_thread())
    directory.mkdir(mode=0o700)
    marker=HERE/('RUNTIME_NATIVE_READ_CONSUMED_'+digest(read_path)+'.json')
    with marker.open('xb') as stream:
        marker.chmod(0o600);stream.write(canonical({'state':'CONSUMED','phase':phase,'bindingSha256':binding}))
    # Fixed old identity precedence/retrieval/probe/constructor/six-RPC seam.
    atomic(directory,'PHASE.json',{'phase':'TRANSPORT_LOAD','bindingSha256':binding})
    transport=load_module('ir_runtime_private_transport',HERE/'lease_transport.py',TRANSPORT_SHA)
    atomic(directory,'PHASE.json',{'phase':'RETRIEVE','bindingSha256':binding})
    key=transport.retrieve_existing_key()
    atomic(directory,'PHASE.json',{'phase':'AUTHENTICATE','bindingSha256':binding})
    check(transport.authentication_probe(key)==200)
    kind=canonical_client.SupabaseLeaseClient
    client=kind(base_url=transport.BASE_URL,project_ref=transport.PROJECT,api_key=key,
        opener=transport.ApikeyOnlyLeaseOpener(key,kind._open_no_redirect))
    atomic(directory,'PHASE.json',{'phase':'ACQUIRE','bindingSha256':binding})
    install_clear_fresh(actual)
    handle=client.acquire_writer(scope=scope,write_paths=PHASE_PATHS[phase],shared_domains=DOMAINS[phase],
        owner_id=OWNER,session_id='ir-phase1-'+phase+'-20261004-'+uuid.uuid4().hex,binding=binding)
    session=Session(client,handle,actual,binding,directory,seconds)
    qa=None
    try:
        if phase!='install': qa=load_module('ir_native_reviewed_harness',HERE/'native_account_qa.py',NATIVE_SHA)
    except BaseException:
        # Acquisition already happened; no loaded-harness failure may leak lease.
        session.stop()
    result=run_session(session,qa=qa,native_review_digest=approval['reportSha256'])
    value={'phase':phase,'result':'STOP' if result is None else 'BOUNDED_PHASE_COMPLETE'}
    if phase=='auth' and result is not None:value['nativeReport']=result
    if phase=='auth_inventory' and result is not None:
        value['nativeReport']=safe_inventory_report(result)
        value['privateInventory']=result  # Private process-memory API only; CLI excludes it.
    return value


class PrivateParser(argparse.ArgumentParser):
    def error(self, message): raise Stop()


def main(argv=None):
    parser=PrivateParser(description=__doc__)
    parser.add_argument('--execute',action='store_true');parser.add_argument('--phase',choices=('install','auth','auth_inventory'))
    parser.add_argument('--approval',type=Path);parser.add_argument('--read-admission',type=Path)
    parser.add_argument('--max-seconds',type=int,default=3600)
    try: args=parser.parse_args(argv)
    except SystemExit as error:
        if error.code==0:return 0
        print('RUNTIME_NATIVE_STOP');return 1
    except BaseException:
        print('RUNTIME_NATIVE_STOP');return 1
    if not args.execute:
        print('DORMANT: exact independent final artifact/phase/read approval required');return 0
    try:
        check(args.phase and args.approval and args.read_admission)
        result=execute(args.phase,args.approval,args.read_admission,args.max_seconds)
        print(json.dumps({k:v for k,v in result.items() if k!='privateInventory'}));return 0 if result['result']!='STOP' else 1
    except BaseException:
        print('RUNTIME_NATIVE_STOP');return 1


if __name__=='__main__': raise SystemExit(main())
