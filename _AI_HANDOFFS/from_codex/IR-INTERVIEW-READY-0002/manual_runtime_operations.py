"""Fixed dormant manual INSTALL operations; no capability on import/default.

Foreman alone executes after exact independent helper/plan/INSTALL acceptance.
Each fixed remote logical operation first calls the hash-pinned INSTALL guard.
"""
import argparse
import base64
import hashlib
from datetime import datetime
import math
import os
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import uuid

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
RUNNER_SHA = 'f1a5ee7ee7930d8d9a0beee69aea205868370ed3f35ede5dcec7ab10051d08c6'
PLAN_SHA = '6a1cd7a25ee809a0abe99bf77992cc1be4f03e28db19a4d0c7f97f8c8b355a97'
SOURCE = 'b61c2ce000ff90f73d240ac9781a2b035eb30bba'
PACKAGE = Path('/private/tmp/ir-phase1-qualified-fullref-20261004')
WEBROOT = '/www/theresidencyacademy_209/public'
RUNTIME = 'wp-content/mu-plugins/missionmed-interview-ready-runtime'
GATEWAY = 'wp-content/mu-plugins/missionmed-interview-ready.php'
HTML = '158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e'
POINTER = 'releases/' + HTML
STAGE = '.candidate-16f8f5795b1f54eb'
TEMP_POINTER = '.current-16f8f5795b1f54eb'
POINTER_SHA = '81ddf0fbca4b746addc71c35327a7c0057a61aa5a0d17c8a45fca5573117239e'
PACKAGE_FILES = {
    'interview-ready-candidate.tar.gz': '16f8f5795b1f54ebfce342eb36a5ca31c9717eda48755f0300c1c498c88f83fa',
    'release-manifest.json': '9c009a2192b00721fe41b0791f63678b7c7d9664f89627200a8d6234f1265f40',
    'release-plan.json': 'd9e030122831401a895e9f415d35e06ea4c09a4b348c593dede5e191c8d822c2',
    'package-receipt.json': '9510bb279d0c5fd2f4c378ae76ec1b4c384c2fa591c3edd9c54c8f20908cc92e',
}
BINDINGS = {'package': PACKAGE_FILES['interview-ready-candidate.tar.gz'],
    'gateway': '819dd734ae7bf61ded755dd3bdda5e64e4945bac05d28bd4aee5cd68f7a9d7f5',
    'html': HTML, 'matrix': '238d936904fce777174f22fb352e99fce118192ca9a469be392246c6a65366ad',
    'gate': 'da79845723120e8e451b96121c5fe5d9ccd5c2a3ece6c20b5279e252fa6319ff',
    'buildManifest': 'b84d685de54dcfc01c208df7bb3afd584f52a072e7ef129391f8a330dc3be006',
    'pointer': POINTER_SHA}
PHASES = {
    'stage': ('mkdir-root','mkdir-releases','mkdir-stage','transfer'),
    'extract': ('extract','lint'),
    'publish-release': ('publish-release',),
    'publish-pointer': ('prepare-pointer','publish-pointer'),
    'publish-gateway': ('lint','publish-gateway'),
    'readback': ('readback',),
    'withdraw-gateway': ('withdraw-gateway',),
    'withdraw-pointer': ('withdraw-pointer',),
}
SHA = re.compile(r'[0-9a-f]{64}\Z')
BUILDER = '/root/integration_lease_runner'


class Stop(RuntimeError):
    def __init__(self):
        super().__init__('MANUAL_RUNTIME_STOP')


def check(value):
    if not value:
        raise Stop()


def canonical(value):
    return json.dumps(value,sort_keys=True,separators=(',',':'),allow_nan=False).encode()


def safe_bytes(path, limit=32*1024*1024):
    path=Path(path)
    check(not any(p.is_symlink() for p in (path,*path.parents)) and path.is_file())
    check(path.stat().st_size<=limit)
    return path.read_bytes()


def digest(path):
    return hashlib.sha256(safe_bytes(path)).hexdigest()


def load_runner():
    path=HERE/'runtime_native_runner.py';data=safe_bytes(path)
    check(hashlib.sha256(data).hexdigest()==RUNNER_SHA)
    spec=importlib.util.spec_from_file_location('ir_manual_install_guard',path)
    module=importlib.util.module_from_spec(spec);sys.modules[spec.name]=module
    exec(compile(data,str(path),'exec'),module.__dict__)
    return module


def local_guard(args, runner):
    # Recheck exact approval bytes/reports/snapshot/status before EVERY remote step.
    approval_path=args.approval
    check(approval_path.is_absolute() and approval_path.parent==HERE)
    check(digest(approval_path)==args.approval_sha256)
    approval=runner.read_json(approval_path)
    check(approval.get('schema')=='ir.runtime_native.approval.v1' and
          approval.get('phase')=='install' and runner.fresh(approval))
    runner.report_record(approval)
    check(approval['independentReviewer'] not in (BUILDER,runner.OWNER,runner.BUILDER))
    contract=approval['contract'];spec=contract['spec']
    check(approval['spec']==spec and contract['phase']=='install' and
          runner.snapshot('install',spec)==contract)
    check(hashlib.sha256(runner.canonical(contract)).hexdigest()==args.binding)
    check(args.control_directory.is_absolute() and args.control_directory.parent==HERE and
          str(args.control_directory)==spec['controlDirectory'])
    check(spec['sourceCommit']==SOURCE and spec['packageDirectory']==str(PACKAGE) and
          spec['packageFiles']==PACKAGE_FILES and spec['runtimeBindings']==BINDINGS)
    check(spec['qualifiedPreimages']=={GATEWAY:'ABSENT',RUNTIME:'ABSENT',RUNTIME+'/current':'ABSENT'})
    check(digest(HERE/'EXACT_RUNTIME_INSTALL_RECOVERY_PLAN.md')==PLAN_SHA)
    qualification=spec['qualifications']['phaseDecision']
    runner.report_record(qualification,role="install_artifact")
    check(qualification['independentReviewer'] not in (BUILDER,runner.OWNER))
    check(qualification.get('manualOperationsSha256')==digest(Path(__file__)) and
          qualification.get('installPlanSha256')==PLAN_SHA)
    mode=qualification.get('manualOperationMode')
    recovery=spec['qualifications']['recovery']
    runner.report_record(recovery,role="install_artifact")
    check(recovery['independentReviewer'] not in (BUILDER,runner.OWNER))
    if args.operation.startswith('withdraw-') or mode=='recovery':
        check(mode=='recovery' and (args.operation.startswith('withdraw-') or args.operation=='readback') and recovery.get('installedRuntimeBindings')==BINDINGS)
        clear=recovery.get('priorInstallProviderClear',{})
        runner.report_record(clear,role="install_artifact")
        observed=clear.get('observedUnix')
        check(clear['independentReviewer'] not in (BUILDER,runner.OWNER) and
              clear.get('phase')=='install' and clear.get('released') is True and
              type(clear.get('activeIR')) is int and clear['activeIR']==0 and
              type(clear.get('pendingIR')) is int and clear['pendingIR']==0 and
              type(observed) in (int,float) and 0<=time.time()-observed<300)
    else:
        check(mode=='install')
    status=runner.check_install_guard(args.control_directory,args.binding,contract)
    ready=runner.read_json(args.control_directory/'READY.json')
    check(status.get('phase')=='install' and ready.get('phase')=='install' and
          ready.get('bindingSha256')==args.binding and
          ready.get('sourceHead')==contract['sourceHead'] and
          SHA.fullmatch(status.get('fenceSha256','')) is not None and
          status['fenceSha256']==ready.get('fenceSha256'))
    now=time.time()
    check(type(status.get('deadlineUnix')) in (int,float) and math.isfinite(status['deadlineUnix']) and
          status['deadlineUnix']==ready.get('deadlineUnix') and status['deadlineUnix']-now>=30 and
          datetime.fromisoformat(status['expiresAt'].replace('Z','+00:00')).timestamp()-now>=30)
    return contract,status
ARTIFACTS = {'wp-content/mu-plugins/missionmed-interview-ready-runtime/releases/158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e/account-gate.html': {'bytes': 36683,
                                                                                                                                                          'sha256': 'da79845723120e8e451b96121c5fe5d9ccd5c2a3ece6c20b5279e252fa6319ff'},
 'wp-content/mu-plugins/missionmed-interview-ready-runtime/releases/158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e/build-manifest.json': {'bytes': 3946,
                                                                                                                                                            'sha256': 'b84d685de54dcfc01c208df7bb3afd584f52a072e7ef129391f8a330dc3be006'},
 'wp-content/mu-plugins/missionmed-interview-ready-runtime/releases/158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e/interview-ready.html': {'bytes': 1464240,
                                                                                                                                                             'sha256': '158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e'},
 'wp-content/mu-plugins/missionmed-interview-ready-runtime/releases/158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e/matrix-entry.js': {'bytes': 2839,
                                                                                                                                                        'sha256': '238d936904fce777174f22fb352e99fce118192ca9a469be392246c6a65366ad'},
 'wp-content/mu-plugins/missionmed-interview-ready.php': {'bytes': 20727,
                                                          'sha256': '819dd734ae7bf61ded755dd3bdda5e64e4945bac05d28bd4aee5cd68f7a9d7f5'}}
SHARED = {'wp-content/mu-plugins/missionmed-matrix-interviewiq-entry.php': '94d1668e8c45cf9fb830c7c10f78151ba25c4adb23904bce0c166ad115767f7c',
 'wp-content/mu-plugins/missionmed-matrix-runtime-pin.php': 'cf2251762f7e88357467a9225eae27e19fe67d7ad44311faecce63b506344a0e',
 'wp-content/mu-plugins/missionmed-performance-boost.php': '00a51063b4f56366568c96bf3bf276b441875d536c509099e05492d683808ba1',
 'wp-content/plugins/missionmed-hub/assets/dashboard-v2/mmed-dashboard-v2-art.js': 'ac77de458b893d38c20c622099b5996b5cb464de0e74cc1868f91ca3dabaffaf',
 'wp-content/plugins/missionmed-hub/assets/dashboard-v2/mmed-dashboard-v2.6010b-students.js': '56dee16717478f9351cb038e6a0976c3f4fad71e522b092b552cff6754a66235',
 'wp-content/plugins/missionmed-hub/assets/dashboard-v2/mmed-dashboard-v2.6010b-true-morph.css': 'be5ade93749eb3fcd6d62cfcb3fa9c05278b07ef52fd53b84049a5faea68612d',
 'wp-content/plugins/missionmed-hub/assets/dashboard-v2/mmed-dashboard-v2.js': '4fdcf13828e3eca0b5e6f7d3fae169e8aee0ab42589dfb01238675681ff6cbec',
 'wp-content/plugins/missionmed-hub/assets/student-os-file-vault-v2.3f9f0152e8bfbc03.js': '3f9f0152e8bfbc034ae5ede0843fb756754daf3aa99f89ddc83124b4be263582',
 'wp-content/plugins/missionmed-hub/assets/student-os.16ca42c53ca2e890.js': '0b112c74e770e3b8decc2c7d8e6a6b73570647aa5f759a3a85cea68ec82f4201',
 'wp-content/plugins/missionmed-hub/assets/student-os.38507e1ac8a555ba.js': '38507e1ac8a555baa4eca6015c8cefd014e414a2d3159929f3cd451a47ad937a',
 'wp-content/plugins/missionmed-hub/assets/student-os.css': '707ab52f7157db618be307f83548b2410d5cdb82359fc6c0f47025996c275260',
 'wp-content/plugins/missionmed-hub/includes/class-mmed-dashboard-experience.php': '63e9c2f8aa69681ae271c6630643df6fa2d791a07dd7c9a315561cdb14595e89',
 'wp-content/plugins/missionmed-hub/includes/class-mmed-rest-api.php': 'c7285a39f698101b9ec7a5e6c7fb6a535c08e1247e9cf02dc5dece8897b9c461',
 'wp-content/plugins/missionmed-hub/includes/class-mmed-student-os.php': 'b3f797c7ef5ff1ebadd6b482aa95f283273201d536ad5749c83926e96c4ac02d',
 'wp-content/uploads/missionmed-interviewiq-discovery/iiq-1203-v1/matrix-v2-iiq-1203.js': '8d4b57a24132681f6d02fd8c072e3368246b9e5d4e56a3d68e8bbb12c5aba9ee'}
REMOTE_SOURCE = r"""
import base64,ctypes,hashlib,io,json,os,signal,stat,subprocess,sys,tarfile
from pathlib import Path

def require(value):
    if not value:
        raise RuntimeError('STOP')

def lexical(path):
    return os.path.lexists(path)

def no_links(path):
    require(not any(p.is_symlink() for p in (path,*path.parents)))

def regular(path):
    no_links(path);require(path.is_file() and stat.S_ISREG(path.lstat().st_mode))
    return path.read_bytes()

def sha(value):
    return hashlib.sha256(value).hexdigest()

root=Path(WEBROOT);runtime=root/RUNTIME;gateway=root/GATEWAY
stage=runtime/STAGE;payload=stage/'payload';release=runtime/'releases'/HTML
current=runtime/'current';temporary=runtime/TEMP_POINTER
archive=stage/'interview-ready-candidate.tar.gz'
staged_gateway=payload/GATEWAY
release_names=('interview-ready.html','matrix-entry.js','account-gate.html','build-manifest.json')
metadata={'release-manifest.json':PACKAGE_FILES['release-manifest.json'],'release-plan.json':PACKAGE_FILES['release-plan.json']}
members=set(ARTIFACTS)|set(metadata)

def shared_check():
    require(len(SHARED)==15)
    for name,expected in SHARED.items():
        require(sha(regular(root/name))==expected)

def pointer_check(path, absent=False):
    if not lexical(path):
        require(absent);return 'ABSENT'
    require(path.is_symlink())
    no_links(path.parent)
    text=os.readlink(path)
    require(text==POINTER and len(text.encode())==73 and sha(text.encode())==POINTER_SHA)
    require(path.resolve(strict=True)==release and release.parent==runtime/'releases')
    return POINTER_SHA

def gateway_check(absent=False):
    if not lexical(gateway):
        require(absent);return 'ABSENT'
    value=regular(gateway)
    require(sha(value)==BINDINGS['gateway'] and len(value)==20727)
    return BINDINGS['gateway']

def layout(allow_temporary=False):
    no_links(runtime);require(runtime.is_dir())
    children={p.name for p in runtime.iterdir()}
    allowed={'releases',STAGE,'current'}|({TEMP_POINTER} if allow_temporary else set())
    require(children<=allowed and {'releases',STAGE}<=children)
    no_links(runtime/'releases');require((runtime/'releases').is_dir())
    require({p.name for p in (runtime/'releases').iterdir()}<= {HTML})
    no_links(stage);require(stage.is_dir())
    require({p.name for p in stage.iterdir()}<= {'interview-ready-candidate.tar.gz','payload'})
    if lexical(temporary):
        require(allow_temporary);pointer_check(temporary)

def archive_check():
    value=regular(archive)
    require(len(value)==1029475 and sha(value)==PACKAGE_FILES['interview-ready-candidate.tar.gz'])
    return value

def payload_check(before_release):
    no_links(payload);require(payload.is_dir())
    expected=members if before_release else set(metadata)|{GATEWAY}
    found=set()
    for path in payload.rglob('*'):
        no_links(path)
        require(path.is_dir() or path.is_file())
        if path.is_file():found.add(str(path.relative_to(payload)))
    require(found==expected)
    for name in expected:
        value=regular(payload/name)
        if name in ARTIFACTS:
            require(sha(value)==ARTIFACTS[name]['sha256'] and len(value)==ARTIFACTS[name]['bytes'])
        else:require(sha(value)==metadata[name])
    manifest=json.loads(regular(payload/'release-manifest.json'))
    require(manifest['sourceCommit']==SOURCE and manifest['sourceRef']==SOURCE and
        manifest['sourceState']=='EXACT_COMMITTED_INPUTS' and manifest['uncommittedInputs']==[] and
        manifest['candidate'] is True and manifest['productionApproved'] is False and
        manifest['artifacts']==ARTIFACTS)
    plan=json.loads(regular(payload/'release-plan.json'))
    require(plan['host']=='missionmed-kinsta' and plan['webroot']==WEBROOT and
        plan['executable'] is False and plan['productionApproval'] is False)

def release_check():
    no_links(release);require(release.is_dir())
    require({p.name for p in release.iterdir()}==set(release_names))
    for name in release_names:
        expected=ARTIFACTS[RUNTIME+'/releases/'+HTML+'/'+name]
        value=regular(release/name)
        require(sha(value)==expected['sha256'] and len(value)==expected['bytes'])
    html=regular(release/'interview-ready.html')
    for name,label in [('matrix-entry.js','MATRIX'),('account-gate.html','GATE')]:
        prefix=('<!-- MMED_IR_'+label+'_SHA256:').encode()
        require(html.count(prefix)==1 and
            prefix+sha(regular(release/name)).encode()+b' -->' in html)

def rename_new(source,destination):
    require(not lexical(destination))
    require(source.parent.stat().st_dev==destination.parent.stat().st_dev)
    libc=ctypes.CDLL(None,use_errno=True)
    call=libc.renameat2
    call.argtypes=[ctypes.c_int,ctypes.c_char_p,ctypes.c_int,ctypes.c_char_p,ctypes.c_uint]
    call.restype=ctypes.c_int
    require(call(-100,os.fsencode(source),-100,os.fsencode(destination),1)==0)

def main():
    shared_check()
    no_links(root);require(root.is_dir());no_links(runtime.parent);require(runtime.parent.is_dir())
    if OP=='mkdir-root':
        require(not lexical(runtime) and not lexical(gateway))
        runtime.mkdir(mode=0o755)
    elif OP=='mkdir-releases':
        no_links(runtime);require(runtime.is_dir() and not list(runtime.iterdir()) and not lexical(gateway))
        (runtime/'releases').mkdir(mode=0o755)
    elif OP=='mkdir-stage':
        no_links(runtime/'releases')
        require({p.name for p in runtime.iterdir()}=={'releases'} and
            not list((runtime/'releases').iterdir()) and not lexical(stage) and not lexical(gateway))
        stage.mkdir(mode=0o700)
    elif OP=='transfer':
        layout();require(not list(stage.iterdir()) and not lexical(current) and not lexical(gateway))
        value=base64.b64decode(ARCHIVE_DATA,validate=True)
        require(len(value)==1029475 and sha(value)==PACKAGE_FILES['interview-ready-candidate.tar.gz'])
        with archive.open('xb') as stream:
            archive.chmod(0o600);stream.write(value);stream.flush();os.fsync(stream.fileno())
        archive_check()
    elif OP=='extract':
        layout();value=archive_check()
        require(not lexical(payload) and not lexical(current) and not lexical(gateway) and
            not list((runtime/'releases').iterdir()))
        with tarfile.open(fileobj=io.BytesIO(value),mode='r:gz') as bundle:
            entries=bundle.getmembers()
            require(len(entries)==7 and {e.name for e in entries}==members and
                all(e.isfile() and e.mode==0o644 and e.mtime==0 and e.uid==e.gid==0 and
                    not e.uname and not e.gname and e.size<=32*1024*1024 for e in entries))
            require(sum(e.size for e in entries)<=64*1024*1024)
            data={}
            for entry in entries:
                require(not entry.name.startswith('/') and '..' not in Path(entry.name).parts)
                value=bundle.extractfile(entry).read()
                require(len(value)==entry.size)
                expected=ARTIFACTS[entry.name]['sha256'] if entry.name in ARTIFACTS else metadata[entry.name]
                require(sha(value)==expected);data[entry.name]=value
        payload.mkdir(mode=0o700)
        for name,value in sorted(data.items()):
            target=payload/name
            require(not lexical(target))
            target.parent.mkdir(parents=True,exist_ok=True)
            no_links(target.parent)
            with target.open('xb') as stream:
                target.chmod(0o644);stream.write(value);stream.flush();os.fsync(stream.fileno())
        payload_check(True)
    elif OP=='lint':
        layout();archive_check();payload_check(not lexical(release))
        require(not lexical(gateway))
        if lexical(current):pointer_check(current);release_check()
        else:require(not lexical(temporary))
        result=subprocess.run(['php','-l',str(staged_gateway)],
            stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=5,check=False)
        require(result.returncode==0 and sha(regular(staged_gateway))==BINDINGS['gateway'])
    elif OP=='publish-release':
        layout();archive_check();payload_check(True)
        require(not lexical(release) and not lexical(current) and not lexical(gateway) and
            not list((runtime/'releases').iterdir()))
        rename_new(payload/RUNTIME/'releases'/HTML,release)
        release_check();payload_check(False)
    elif OP=='prepare-pointer':
        layout();archive_check();payload_check(False);release_check()
        require(not lexical(current) and not lexical(temporary) and not lexical(gateway))
        temporary.symlink_to(POINTER);pointer_check(temporary)
    elif OP=='publish-pointer':
        layout(True);archive_check();payload_check(False);release_check();pointer_check(temporary)
        require(not lexical(current) and not lexical(gateway))
        rename_new(temporary,current);pointer_check(current)
    elif OP=='publish-gateway':
        layout();archive_check();payload_check(False);release_check();pointer_check(current)
        require(not lexical(gateway) and
            staged_gateway.parent.stat().st_dev==gateway.parent.stat().st_dev)
        require(sha(regular(staged_gateway))==BINDINGS['gateway'])
        os.link(staged_gateway,gateway,follow_symlinks=False)
        gateway_check()
    elif OP=='readback':
        layout(MODE=='recovery');archive_check();payload_check(False);release_check()
        pointer_value=pointer_check(current,MODE=='recovery')
        gateway_value=gateway_check(MODE=='recovery')
        require(gateway_value=='ABSENT' or pointer_value==POINTER_SHA)
    elif OP=='withdraw-gateway':
        layout(True);archive_check();payload_check(False);release_check()
        pointer_check(current,True);gateway_check(True)
        if lexical(gateway):gateway.unlink()
        require(not lexical(gateway))
    elif OP=='withdraw-pointer':
        layout(True);archive_check();payload_check(False);release_check()
        require(not lexical(gateway));pointer_check(current,True)
        if lexical(current):current.unlink()
        require(not lexical(current))
    else:require(False)
    shared_check()
    # Closed public custody fields; never raw remote output/error/native data.
    value={'operation':OP,'sharedChecked':15,'result':'PASS'}
    if OP=='readback':
        value['runtimeBindings']=dict(BINDINGS,gateway=gateway_value,pointer=pointer_value)
    print(json.dumps(value,sort_keys=True,separators=(',',':')))

class RemoteDeadline(BaseException):
    pass
def alarm(signum,frame):
    raise RemoteDeadline()
signal.signal(signal.SIGALRM,alarm)
signal.setitimer(signal.ITIMER_REAL,8)
try:
    main()
except BaseException:
    print('MANUAL_RUNTIME_STOP')
    raise SystemExit(1)
"""
REMOTE_OPERATIONS = frozenset(operation for operations in PHASES.values() for operation in operations)


def marker_sync(directory):
    descriptor=os.open(directory,os.O_RDONLY|os.O_DIRECTORY)
    try:os.fsync(descriptor)
    finally:os.close(descriptor)


def marker_identity(record):
    return {name:value for name,value in record.items() if name!='state'}


def begin_marker(args,runner,status,operation):
    directory=args.control_directory;path=directory/'MANUAL_OPERATION.json'
    fence=status['fenceSha256']
    existing=runner.manual_operation_record(directory,args.binding,fence)
    if existing is not None:
        # Only a completed exact current-contract/fence record may be reconciled.
        # ACTIVE/UNCERTAIN/foreign/invalid records are retained and block dispatch.
        check(existing['state']=='COMPLETE')
        check(runner.manual_operation_record(directory,args.binding,fence)==existing)
        check(runner.read_json(path)==existing)
        path.unlink()
        marker_sync(directory)
    start=time.time()
    record={'schema':'ir.runtime_native.manual_operation.v1','bindingSha256':args.binding,
        'fenceSha256':fence,'operation':operation,'operationId':str(uuid.uuid4()),
        'startUnix':start,'deadlineUnix':start+10,'state':'ACTIVE'}
    check(not path.is_symlink())
    try:
        with path.open('xb') as stream:
            path.chmod(0o600)
            stream.write(canonical(record)+b'\n');stream.flush();os.fsync(stream.fileno())
        marker_sync(directory)
        check(runner.manual_operation_record(directory,args.binding,fence)==record)
    except BaseException:
        # Creation/storage failure cannot turn a partially visible marker into
        # completion evidence; retain invalid state or best-effort UNCERTAIN.
        try:transition_marker(args,runner,record,'UNCERTAIN')
        except BaseException:pass
        raise Stop() from None
    return record


def transition_marker(args,runner,record,state):
    check(state in ('COMPLETE','UNCERTAIN'))
    directory=args.control_directory;path=directory/'MANUAL_OPERATION.json'
    actual=runner.manual_operation_record(directory,args.binding,record['fenceSha256'])
    check(actual is not None and marker_identity(actual)==marker_identity(record) and
          actual['state']=='ACTIVE')
    value=dict(record,state=state)
    temporary=directory/('.MANUAL_OPERATION.json.'+uuid.uuid4().hex)
    try:
        with temporary.open('xb') as stream:
            temporary.chmod(0o600)
            stream.write(canonical(value)+b'\n');stream.flush();os.fsync(stream.fileno())
        check(runner.manual_operation_record(directory,args.binding,record['fenceSha256'])==actual)
        temporary.replace(path)
        marker_sync(directory)
        check(runner.manual_operation_record(directory,args.binding,record['fenceSha256'])==value)
    finally:
        temporary.unlink(missing_ok=True)


def remote_step(args, runner, operation):
    check(operation in REMOTE_OPERATIONS)
    contract,status=local_guard(args,runner)
    constants={key:globals()[key] for key in ('WEBROOT','RUNTIME','GATEWAY','HTML','POINTER','STAGE',
        'TEMP_POINTER','POINTER_SHA','PACKAGE_FILES','BINDINGS','SOURCE','ARTIFACTS','SHARED')}
    constants['OP']=operation
    constants['MODE']=contract['spec']['qualifications']['phaseDecision']['manualOperationMode']
    if operation=='transfer':
        archive=safe_bytes(PACKAGE/'interview-ready-candidate.tar.gz')
        check(len(archive)==1029475 and hashlib.sha256(archive).hexdigest()==BINDINGS['package'])
        constants['ARCHIVE_DATA']=base64.b64encode(archive).decode('ascii')
    code='\n'.join(name+' = '+repr(value) for name,value in constants.items())+'\n'+REMOTE_SOURCE
    child=None;record=None;completed=False
    try:
        record=begin_marker(args,runner,status,operation)
        # Guard2 follows exclusive ACTIVE publication and precedes ANY SSH.
        actual,status2=local_guard(args,runner)
        check(actual==contract and status2['fenceSha256']==record['fenceSha256'])
        check(runner.manual_operation_record(args.control_directory,args.binding,record['fenceSha256'])==record)
        remaining=record['deadlineUnix']-time.time()
        check(0<remaining<=10)
        child=subprocess.Popen(['ssh','-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes',
            '-o','ConnectTimeout=8','missionmed-kinsta','python3','-'],
            stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
        remaining=record['deadlineUnix']-time.time()
        check(0<remaining<=10)
        output,_=child.communicate(code.encode(),timeout=remaining)
        check(child.returncode==0 and len(output)<=4096)
        value=json.loads(output)
        expected={'operation':operation,'sharedChecked':15,'result':'PASS'}
        if operation=='readback':
            measured=value.get('runtimeBindings')
            check(type(measured) is dict and set(measured)==set(BINDINGS))
            if constants['MODE']=='install':check(measured==BINDINGS)
            else:
                check(all(measured[k]==v for k,v in BINDINGS.items() if k not in ('gateway','pointer')) and
                    (measured['gateway'],measured['pointer']) in
                    ((BINDINGS['gateway'],POINTER_SHA),('ABSENT',POINTER_SHA),('ABSENT','ABSENT')))
            expected['runtimeBindings']=measured
        check(value==expected)
        # Real successful SSH EOF + the exact ACK proves this fixed remote step
        # finished. Persist SAME identity COMPLETE before a closing postguard.
        transition_marker(args,runner,record,'COMPLETE')
        completed=True
        local_guard(args,runner)
        return value
    except BaseException:
        if record is not None and not completed:
            try:transition_marker(args,runner,record,'UNCERTAIN')
            except BaseException:pass  # Invalid/unwritable ACTIVE remains a release-defer condition.
        if child is not None and child.poll() is None:
            try:
                child.kill();child.wait(timeout=2)
            except BaseException:pass
        # SSH kill/timeout/invalid output never supplies completion evidence.
        # A COMPLETE marker stays COMPLETE if only the postguard closes.
        raise Stop() from None


class PrivateParser(argparse.ArgumentParser):
    def error(self,message):
        raise Stop()


def main(argv=None):
    parser=PrivateParser(description=__doc__)
    parser.add_argument('--execute',action='store_true')
    parser.add_argument('--operation',choices=tuple(PHASES))
    parser.add_argument('--approval',type=Path)
    parser.add_argument('--approval-sha256')
    parser.add_argument('--control-directory',type=Path)
    parser.add_argument('--binding')
    try:
        args=parser.parse_args(argv)
        if not args.execute:
            print('DORMANT: independently approved INSTALL manual operation required')
            return 0
        check(args.operation and args.approval and args.control_directory and
            SHA.fullmatch(args.approval_sha256 or '') and SHA.fullmatch(args.binding or ''))
        runner=load_runner()
        for operation in PHASES[args.operation]:
            result=remote_step(args,runner,operation)
        receipt={'operation':args.operation,'result':'PASS','sharedChecked':15,'bindingSha256':args.binding}
        if args.operation=='readback':receipt['runtimeBindings']=result['runtimeBindings']
        print(json.dumps(receipt,sort_keys=True,separators=(',',':')))
        return 0
    except SystemExit as error:
        if error.code==0:return 0
        print('MANUAL_RUNTIME_STOP');return 1
    except BaseException:
        print('MANUAL_RUNTIME_STOP');return 1


if __name__=='__main__':
    raise SystemExit(main())
