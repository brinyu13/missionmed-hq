"""Fixed dormant manual PRESENT upgrade/recovery operations; no capability on import/default.

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
RUNNER_SHA = '4aab4b5b37625134572cd231ac326cc6d8b95eb2aee94e70175cf92a48185dc3'
PLAN_SHA = '80e86a5e2413a21cecf2ce75ed165dea7268824949a5a2b49a2ee5102291288b'
SOURCE = '8717ebd04ad1cd60e66ef197b55080d58492e2be'
PACKAGE = Path('/private/tmp/ir-phase1-renderfix-20261004')
WEBROOT = '/www/theresidencyacademy_209/public'
RUNTIME = 'wp-content/mu-plugins/missionmed-interview-ready-runtime'
GATEWAY = 'wp-content/mu-plugins/missionmed-interview-ready.php'
HTML = '456269800610e4370ab2930bc7ee7007eadc3f36c3ba2116136ef611c15e354c'
POINTER = 'releases/456269800610e4370ab2930bc7ee7007eadc3f36c3ba2116136ef611c15e354c'
STAGE = '.candidate-a93cb2e0be061ca1'
TEMP_POINTER = '.current-a93cb2e0be061ca1'
BACKUP_POINTER = '.previous-16f8f5795b1f54eb-to-a93cb2e0be061ca1'
POINTER_SHA = '4e055c987d9d65cd866a41bff5ac3dff8e3b2b0bcf1b3c193c475917020f9c46'
PACKAGE_FILES = {'interview-ready-candidate.tar.gz': 'a93cb2e0be061ca1a1558640f0db3030a6aab8e26c4bcb71f52504b7caf413c3', 'release-manifest.json': '4d4d9977163180c748282f94446fe900f75b0d5df2fff7d247f99f24c5367f33', 'release-plan.json': '44ab7337ba0b82e350658bd14c07ae550985197b5fbdafcf4c7b18f179d4e037', 'package-receipt.json': '9ecd3caf9519ef2337e8902176cddd3145f8b09464153afd3b417b1e136585fa'}
BINDINGS = {'package': 'a93cb2e0be061ca1a1558640f0db3030a6aab8e26c4bcb71f52504b7caf413c3', 'gateway': '819dd734ae7bf61ded755dd3bdda5e64e4945bac05d28bd4aee5cd68f7a9d7f5', 'html': '456269800610e4370ab2930bc7ee7007eadc3f36c3ba2116136ef611c15e354c', 'matrix': '238d936904fce777174f22fb352e99fce118192ca9a469be392246c6a65366ad', 'gate': 'da79845723120e8e451b96121c5fe5d9ccd5c2a3ece6c20b5279e252fa6319ff', 'buildManifest': 'f142c8255a9cd93fbb8567cba3b323327fe3e8cd20491ece6565b7b2750c4ffe', 'pointer': '4e055c987d9d65cd866a41bff5ac3dff8e3b2b0bcf1b3c193c475917020f9c46'}
OLD_BINDINGS = {'package': '16f8f5795b1f54ebfce342eb36a5ca31c9717eda48755f0300c1c498c88f83fa', 'gateway': '819dd734ae7bf61ded755dd3bdda5e64e4945bac05d28bd4aee5cd68f7a9d7f5', 'html': '158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e', 'matrix': '238d936904fce777174f22fb352e99fce118192ca9a469be392246c6a65366ad', 'gate': 'da79845723120e8e451b96121c5fe5d9ccd5c2a3ece6c20b5279e252fa6319ff', 'buildManifest': 'b84d685de54dcfc01c208df7bb3afd584f52a072e7ef129391f8a330dc3be006', 'pointer': '81ddf0fbca4b746addc71c35327a7c0057a61aa5a0d17c8a45fca5573117239e'}
OLD_HTML = '158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e'
OLD_POINTER = 'releases/158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e'
OLD_STAGE = '.candidate-16f8f5795b1f54eb'
OLD_PACKAGE_FILES = {'interview-ready-candidate.tar.gz': '16f8f5795b1f54ebfce342eb36a5ca31c9717eda48755f0300c1c498c88f83fa', 'release-manifest.json': '9c009a2192b00721fe41b0791f63678b7c7d9664f89627200a8d6234f1265f40', 'release-plan.json': 'd9e030122831401a895e9f415d35e06ea4c09a4b348c593dede5e191c8d822c2', 'package-receipt.json': '9510bb279d0c5fd2f4c378ae76ec1b4c384c2fa591c3edd9c54c8f20908cc92e'}
OLD_ARTIFACTS = {'wp-content/mu-plugins/missionmed-interview-ready-runtime/releases/158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e/account-gate.html': {'bytes': 36683, 'sha256': 'da79845723120e8e451b96121c5fe5d9ccd5c2a3ece6c20b5279e252fa6319ff'}, 'wp-content/mu-plugins/missionmed-interview-ready-runtime/releases/158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e/build-manifest.json': {'bytes': 3946, 'sha256': 'b84d685de54dcfc01c208df7bb3afd584f52a072e7ef129391f8a330dc3be006'}, 'wp-content/mu-plugins/missionmed-interview-ready-runtime/releases/158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e/interview-ready.html': {'bytes': 1464240, 'sha256': '158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e'}, 'wp-content/mu-plugins/missionmed-interview-ready-runtime/releases/158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e/matrix-entry.js': {'bytes': 2839, 'sha256': '238d936904fce777174f22fb352e99fce118192ca9a469be392246c6a65366ad'}, 'wp-content/mu-plugins/missionmed-interview-ready.php': {'bytes': 20727, 'sha256': '819dd734ae7bf61ded755dd3bdda5e64e4945bac05d28bd4aee5cd68f7a9d7f5'}}
ARCHIVE_BYTES = 1029472
OLD_LAYOUT = {'wp-content/mu-plugins/missionmed-interview-ready-runtime': {'children': ['.candidate-16f8f5795b1f54eb', 'current', 'releases'], 'type': 'directory'}, 'wp-content/mu-plugins/missionmed-interview-ready-runtime/.candidate-16f8f5795b1f54eb': {'children': ['interview-ready-candidate.tar.gz', 'payload'], 'type': 'directory'}, 'wp-content/mu-plugins/missionmed-interview-ready-runtime/.candidate-16f8f5795b1f54eb/interview-ready-candidate.tar.gz': {'bytes': 1029475, 'sha256': '16f8f5795b1f54ebfce342eb36a5ca31c9717eda48755f0300c1c498c88f83fa', 'type': 'regular'}, 'wp-content/mu-plugins/missionmed-interview-ready-runtime/.candidate-16f8f5795b1f54eb/payload': {'children': ['release-manifest.json', 'release-plan.json', 'wp-content'], 'type': 'directory'}, 'wp-content/mu-plugins/missionmed-interview-ready-runtime/.candidate-16f8f5795b1f54eb/payload/release-manifest.json': {'bytes': 5752, 'sha256': '9c009a2192b00721fe41b0791f63678b7c7d9664f89627200a8d6234f1265f40', 'type': 'regular'}, 'wp-content/mu-plugins/missionmed-interview-ready-runtime/.candidate-16f8f5795b1f54eb/payload/release-plan.json': {'bytes': 1019, 'sha256': 'd9e030122831401a895e9f415d35e06ea4c09a4b348c593dede5e191c8d822c2', 'type': 'regular'}, 'wp-content/mu-plugins/missionmed-interview-ready-runtime/.candidate-16f8f5795b1f54eb/payload/wp-content': {'children': ['mu-plugins'], 'type': 'directory'}, 'wp-content/mu-plugins/missionmed-interview-ready-runtime/.candidate-16f8f5795b1f54eb/payload/wp-content/mu-plugins': {'children': ['missionmed-interview-ready-runtime', 'missionmed-interview-ready.php'], 'type': 'directory'}, 'wp-content/mu-plugins/missionmed-interview-ready-runtime/.candidate-16f8f5795b1f54eb/payload/wp-content/mu-plugins/missionmed-interview-ready-runtime': {'children': ['releases'], 'type': 'directory'}, 'wp-content/mu-plugins/missionmed-interview-ready-runtime/.candidate-16f8f5795b1f54eb/payload/wp-content/mu-plugins/missionmed-interview-ready-runtime/releases': {'children': [], 'type': 'directory'}, 'wp-content/mu-plugins/missionmed-interview-ready-runtime/.candidate-16f8f5795b1f54eb/payload/wp-content/mu-plugins/missionmed-interview-ready.php': {'bytes': 20727, 'sha256': '819dd734ae7bf61ded755dd3bdda5e64e4945bac05d28bd4aee5cd68f7a9d7f5', 'type': 'regular'}, 'wp-content/mu-plugins/missionmed-interview-ready-runtime/.current-16f8f5795b1f54eb': {'type': 'ABSENT'}, 'wp-content/mu-plugins/missionmed-interview-ready-runtime/current': {'bytes': 73, 'literal': 'releases/158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e', 'sha256': '81ddf0fbca4b746addc71c35327a7c0057a61aa5a0d17c8a45fca5573117239e', 'type': 'symlink'}, 'wp-content/mu-plugins/missionmed-interview-ready-runtime/releases': {'children': ['158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e'], 'type': 'directory'}, 'wp-content/mu-plugins/missionmed-interview-ready-runtime/releases/158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e': {'children': ['account-gate.html', 'build-manifest.json', 'interview-ready.html', 'matrix-entry.js'], 'type': 'directory'}, 'wp-content/mu-plugins/missionmed-interview-ready-runtime/releases/158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e/account-gate.html': {'bytes': 36683, 'sha256': 'da79845723120e8e451b96121c5fe5d9ccd5c2a3ece6c20b5279e252fa6319ff', 'type': 'regular'}, 'wp-content/mu-plugins/missionmed-interview-ready-runtime/releases/158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e/build-manifest.json': {'bytes': 3946, 'sha256': 'b84d685de54dcfc01c208df7bb3afd584f52a072e7ef129391f8a330dc3be006', 'type': 'regular'}, 'wp-content/mu-plugins/missionmed-interview-ready-runtime/releases/158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e/interview-ready.html': {'bytes': 1464240, 'sha256': '158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e', 'type': 'regular'}, 'wp-content/mu-plugins/missionmed-interview-ready-runtime/releases/158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e/matrix-entry.js': {'bytes': 2839, 'sha256': '238d936904fce777174f22fb352e99fce118192ca9a469be392246c6a65366ad', 'type': 'regular'}, 'wp-content/mu-plugins/missionmed-interview-ready.php': {'bytes': 20727, 'sha256': '819dd734ae7bf61ded755dd3bdda5e64e4945bac05d28bd4aee5cd68f7a9d7f5', 'type': 'regular'}}
CACHE_REPORT_SHA = 'e9b1e404f46311fc1c676f3d88aabd554afac93dda65b537a5e34a23e36b8657'
PHASES = {'stage':('mkdir-stage','transfer'),'extract':('extract','lint'),'publish-release':('publish-release',),'publish-pointer':('prepare-pointer','publish-pointer'),'readback':('readback',),'restore-pointer':('restore-pointer',),'refresh-ir-html':('refresh-ir-html',),'refresh-home-html':('refresh-home-html',)}
SHA = re.compile(r'[0-9a-f]{64}\Z')
BUILDER = '/root/phase1_matrix_release_implementation'

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
    approval_path=args.approval
    check(approval_path.is_absolute() and approval_path.parent==HERE and digest(approval_path)==args.approval_sha256)
    approval=runner.read_json(approval_path)
    check(approval.get('schema')=='ir.runtime_native.approval.v1' and approval.get('phase')=='install' and runner.fresh(approval))
    runner.report_record(approval)
    check(approval['independentReviewer'] not in (BUILDER,runner.OWNER,runner.BUILDER))
    contract=approval['contract'];spec=contract['spec']
    check(approval['spec']==spec and contract['phase']=='install' and runner.snapshot('install',spec)==contract)
    check(hashlib.sha256(runner.canonical(contract)).hexdigest()==args.binding)
    check(args.control_directory.is_absolute() and args.control_directory.parent==HERE and str(args.control_directory)==spec['controlDirectory'])
    check(spec['sourceCommit']==SOURCE and spec['packageDirectory']==str(PACKAGE) and spec['packageFiles']==PACKAGE_FILES and spec['runtimeBindings']==BINDINGS)
    check(digest(HERE/'EXACT_RUNTIME_UPGRADE_RECOVERY_PLAN.md')==PLAN_SHA and digest(HERE/'NARROW_ROUTE_CACHE_MECHANISM.md')==CACHE_REPORT_SHA)
    qualification=spec['qualifications']['phaseDecision'];recovery=spec['qualifications']['recovery']
    for record in (qualification,recovery):
        runner.report_record(record,role='install_artifact');check(record['independentReviewer'] not in (BUILDER,runner.OWNER))
    check(qualification.get('manualOperationsSha256')==digest(Path(__file__)) and qualification.get('installPlanSha256')==PLAN_SHA)
    mode=qualification.get('manualOperationMode');check(mode in ('upgrade','upgrade-resume','upgrade-recovery'))
    check(recovery.get('oldRuntimeBindings')==OLD_BINDINGS and recovery.get('upgradeRuntimeBindings')==BINDINGS and recovery.get('qualifiedPreimages')==spec['qualifiedPreimages'])
    if mode=='upgrade':check(spec['qualifiedPreimages']==QUALIFIED_PREIMAGES and args.operation!='restore-pointer')
    elif mode=='upgrade-resume':check(spec['qualifiedPreimages']==RESUME_PREIMAGES and args.operation in ('publish-pointer','readback','refresh-ir-html','refresh-home-html'))
    else:check(spec['qualifiedPreimages'] in (RECOVERY_PREIMAGES,INTERRUPTED_PREIMAGES) and args.operation in ('restore-pointer','readback','refresh-ir-html','refresh-home-html'))
    clear=recovery.get('priorInstallProviderClear',{});runner.report_record(clear,role='install_artifact');observed=clear.get('observedUnix')
    status=runner.check_install_guard(args.control_directory,args.binding,contract);ready=runner.read_json(args.control_directory/'READY.json');now=time.time()
    admitted=ready.get('updatedUnix')
    check(clear['independentReviewer'] not in (BUILDER,runner.OWNER) and clear.get('phase')=='install' and type(clear.get('activeIR')) is int and clear['activeIR']==0 and type(clear.get('pendingIR')) is int and clear['pendingIR']==0)
    # Independent pre-acquisition clear stays bound to immutable initial READY;
    # current own HEALTHY source/fence/deadline supplies every later guard.
    check(type(observed) in (int,float) and math.isfinite(observed) and type(admitted) in (int,float) and math.isfinite(admitted) and 0<observed<=admitted<=now and admitted<observed+300)
    if mode=='upgrade-resume':
        check(clear.get('qualifiedPreimages')==RESUME_PREIMAGES)
        if clear.get('retirement')=='RELEASED':check(clear.get('released') is True)
        else:
            ended=clear.get('expiresUnix')
            check(clear.get('retirement')=='RETIRED_BY_EXPIRY' and clear.get('released') is False and clear.get('expired') is True and clear.get('guard2NotDispatched') is True and type(clear.get('priorClaimId')) is str and runner.PUBLIC_UUID.fullmatch(clear['priorClaimId']) and SHA.fullmatch(clear.get('priorBindingSha256','')) and type(ended) in (int,float) and math.isfinite(ended) and 0<ended<=observed and ended<admitted)
    else:check(clear.get('released') is True)
    check(status.get('phase')=='install' and ready.get('phase')=='install' and ready.get('bindingSha256')==args.binding and ready.get('sourceHead')==contract['sourceHead'] and SHA.fullmatch(status.get('fenceSha256','')) is not None and status['fenceSha256']==ready.get('fenceSha256'))
    check(type(status.get('deadlineUnix')) in (int,float) and math.isfinite(status['deadlineUnix']) and status['deadlineUnix']==ready.get('deadlineUnix') and status['deadlineUnix']-now>=runner.MANUAL_DISPATCH_MARGIN and datetime.fromisoformat(status['expiresAt'].replace('Z','+00:00')).timestamp()-now>=runner.MANUAL_SERVER_MARGIN)
    return contract,status

ARTIFACTS = {'wp-content/mu-plugins/missionmed-interview-ready-runtime/releases/456269800610e4370ab2930bc7ee7007eadc3f36c3ba2116136ef611c15e354c/account-gate.html': {'bytes': 36683, 'sha256': 'da79845723120e8e451b96121c5fe5d9ccd5c2a3ece6c20b5279e252fa6319ff'}, 'wp-content/mu-plugins/missionmed-interview-ready-runtime/releases/456269800610e4370ab2930bc7ee7007eadc3f36c3ba2116136ef611c15e354c/build-manifest.json': {'bytes': 3946, 'sha256': 'f142c8255a9cd93fbb8567cba3b323327fe3e8cd20491ece6565b7b2750c4ffe'}, 'wp-content/mu-plugins/missionmed-interview-ready-runtime/releases/456269800610e4370ab2930bc7ee7007eadc3f36c3ba2116136ef611c15e354c/interview-ready.html': {'bytes': 1464240, 'sha256': '456269800610e4370ab2930bc7ee7007eadc3f36c3ba2116136ef611c15e354c'}, 'wp-content/mu-plugins/missionmed-interview-ready-runtime/releases/456269800610e4370ab2930bc7ee7007eadc3f36c3ba2116136ef611c15e354c/matrix-entry.js': {'bytes': 2839, 'sha256': '238d936904fce777174f22fb352e99fce118192ca9a469be392246c6a65366ad'}, 'wp-content/mu-plugins/missionmed-interview-ready.php': {'bytes': 20727, 'sha256': '819dd734ae7bf61ded755dd3bdda5e64e4945bac05d28bd4aee5cd68f7a9d7f5'}}
SHARED = {'wp-content/mu-plugins/missionmed-matrix-interviewiq-entry.php': '94d1668e8c45cf9fb830c7c10f78151ba25c4adb23904bce0c166ad115767f7c', 'wp-content/mu-plugins/missionmed-matrix-runtime-pin.php': 'cf2251762f7e88357467a9225eae27e19fe67d7ad44311faecce63b506344a0e', 'wp-content/mu-plugins/missionmed-performance-boost.php': '00a51063b4f56366568c96bf3bf276b441875d536c509099e05492d683808ba1', 'wp-content/plugins/missionmed-hub/assets/dashboard-v2/mmed-dashboard-v2-art.js': 'ac77de458b893d38c20c622099b5996b5cb464de0e74cc1868f91ca3dabaffaf', 'wp-content/plugins/missionmed-hub/assets/dashboard-v2/mmed-dashboard-v2.6010b-students.js': '56dee16717478f9351cb038e6a0976c3f4fad71e522b092b552cff6754a66235', 'wp-content/plugins/missionmed-hub/assets/dashboard-v2/mmed-dashboard-v2.6010b-true-morph.css': 'be5ade93749eb3fcd6d62cfcb3fa9c05278b07ef52fd53b84049a5faea68612d', 'wp-content/plugins/missionmed-hub/assets/dashboard-v2/mmed-dashboard-v2.js': '4fdcf13828e3eca0b5e6f7d3fae169e8aee0ab42589dfb01238675681ff6cbec', 'wp-content/plugins/missionmed-hub/assets/student-os-file-vault-v2.3f9f0152e8bfbc03.js': '3f9f0152e8bfbc034ae5ede0843fb756754daf3aa99f89ddc83124b4be263582', 'wp-content/plugins/missionmed-hub/assets/student-os.16ca42c53ca2e890.js': '0b112c74e770e3b8decc2c7d8e6a6b73570647aa5f759a3a85cea68ec82f4201', 'wp-content/plugins/missionmed-hub/assets/student-os.38507e1ac8a555ba.js': '38507e1ac8a555baa4eca6015c8cefd014e414a2d3159929f3cd451a47ad937a', 'wp-content/plugins/missionmed-hub/assets/student-os.css': '707ab52f7157db618be307f83548b2410d5cdb82359fc6c0f47025996c275260', 'wp-content/plugins/missionmed-hub/includes/class-mmed-dashboard-experience.php': '63e9c2f8aa69681ae271c6630643df6fa2d791a07dd7c9a315561cdb14595e89', 'wp-content/plugins/missionmed-hub/includes/class-mmed-rest-api.php': 'c7285a39f698101b9ec7a5e6c7fb6a535c08e1247e9cf02dc5dece8897b9c461', 'wp-content/plugins/missionmed-hub/includes/class-mmed-student-os.php': 'b3f797c7ef5ff1ebadd6b482aa95f283273201d536ad5749c83926e96c4ac02d', 'wp-content/uploads/missionmed-interviewiq-discovery/iiq-1203-v1/matrix-v2-iiq-1203.js': '8d4b57a24132681f6d02fd8c072e3368246b9e5d4e56a3d68e8bbb12c5aba9ee'}

def layout_profile(stage_state=None, published=False, pointer='old', temporary=None, backup=None):
    # Exact observed dictionary shape; hashes bind types/children/bytes/targets.
    value=json.loads(json.dumps(OLD_LAYOUT))
    def directory(name):
        if name not in value:value[name]={'type':'directory','children':[]}
        parent=str(Path(name).parent)
        if parent.startswith(RUNTIME):directory(parent)
    def file(name,details):
        directory(str(Path(name).parent));value[name]=dict(details,type='regular')
    def link(name,target):
        value[name]={'type':'symlink','literal':target,'bytes':len(target.encode()),'sha256':hashlib.sha256(target.encode()).hexdigest()}
    if stage_state:
        stage=RUNTIME+'/'+STAGE;directory(stage)
        if stage_state in ('archive','payload','published'):
            file(stage+'/interview-ready-candidate.tar.gz',{'sha256':PACKAGE_FILES['interview-ready-candidate.tar.gz'],'bytes':ARCHIVE_BYTES})
        if stage_state in ('payload','published'):
            payload=stage+'/payload';directory(payload)
            for name,size in [('release-manifest.json',5752),('release-plan.json',1019)]:
                file(payload+'/'+name,{'sha256':PACKAGE_FILES[name],'bytes':size})
            for name,detail in ARTIFACTS.items():
                if stage_state=='payload' or name==GATEWAY:file(payload+'/'+name,detail)
            # Publish moves only the new release directory; empty ancestors remain.
            directory(payload+'/'+RUNTIME+'/releases')
    if published:
        for name,detail in ARTIFACTS.items():
            if name!=GATEWAY:file(name,detail)
    link(RUNTIME+'/current',OLD_POINTER if pointer=='old' else POINTER)
    if temporary:link(RUNTIME+'/'+TEMP_POINTER,OLD_POINTER if temporary=='old' else POINTER)
    if backup:link(RUNTIME+'/'+BACKUP_POINTER,OLD_POINTER if backup=='old' else POINTER)
    for name,detail in value.items():
        if detail['type']=='directory':
            detail['children']=sorted(Path(child).name for child,data in value.items()
                if str(Path(child).parent)==name and data['type']!='ABSENT')
    return value

LAYOUTS={'OLD':OLD_LAYOUT,
    'STAGE':layout_profile('empty'),'ARCHIVE':layout_profile('archive'),
    'PAYLOAD':layout_profile('payload'),'PUBLISHED':layout_profile('published',True),
    'PREPARED':layout_profile('published',True,temporary='new'),
    'EXCHANGED':layout_profile('published',True,pointer='new',temporary='old'),
    'UPGRADED':layout_profile('published',True,pointer='new',backup='old'),
    'RESTORED':layout_profile('published',True,backup='new'),
    'RESTORE_TEMP':layout_profile('published',True,temporary='new')}
LAYOUT_DIGESTS={name:hashlib.sha256(canonical(value)).hexdigest() for name,value in LAYOUTS.items()}

def preimage_for(layout_name,pointer_sha):
    return {GATEWAY:BINDINGS['gateway'],RUNTIME:{'schema':'ir.runtime_native.layout_preimage.v1',
        'sha256':LAYOUT_DIGESTS[layout_name]},RUNTIME+'/current':pointer_sha}

QUALIFIED_PREIMAGES=preimage_for('OLD',OLD_BINDINGS['pointer'])
RESUME_PREIMAGES=preimage_for('PUBLISHED',OLD_BINDINGS['pointer'])
RECOVERY_PREIMAGES=preimage_for('UPGRADED',BINDINGS['pointer'])
INTERRUPTED_PREIMAGES=preimage_for('EXCHANGED',BINDINGS['pointer'])
CACHE_VENDOR={'wp-content/mu-plugins/kinsta-mu-plugins.php':'fac0c7361bdc6c02e150b60aaf02c82044141ef1276afbfd73684d37f8491e13',
    'wp-content/mu-plugins/kinsta-mu-plugins/cache/class-cache.php':'28c60318fb0ccc757cbc6feb4950e2f063724755bfc6bc0623acdf3fa2c578a9',
    'wp-content/mu-plugins/kinsta-mu-plugins/cache/class-cache-purge.php':'0ad40fe4c17b36cdcf20914cba7dcb2a615696a1adbc35f61ef5848d817405af',
    'wp-content/mu-plugins/kinsta-mu-plugins/wp-cli/class-kmp-wpcli.php':'69caf5a1289ff3c294a1faecef754d7b859285a9dd8a1f5b39a77f1002ec703b',
    'wp-content/mu-plugins/kinsta-mu-plugins/wp-cli/commands/class-cache-purge-command.php':'2cce8f85826d2887edfcff3a9381881230334e693788a2b8b2644e30fd5e9c29'}
CACHE_FORMS={'refresh-ir-html':b'single%7Cir_route=missionmedinstitute.com%2Finterview-ready%2F',
    'refresh-home-html':b'single%7Cir_home=missionmedinstitute.com%2F'}
CACHE_ENDPOINT='https://localhost/kinsta-clear-cache/v2/immediate'

REMOTE_SOURCE = r"""
import base64,ctypes,hashlib,io,json,os,signal,ssl,stat,subprocess,sys,tarfile,urllib.request
from pathlib import Path

def require(value):
    if not value:raise RuntimeError('STOP')
def sha(value):return hashlib.sha256(value).hexdigest()
def lexical(path):return os.path.lexists(path)
def no_links(path):require(not any(p.is_symlink() for p in (path,*path.parents)))
def regular(path):
    no_links(path);require(path.is_file() and stat.S_ISREG(path.lstat().st_mode) and path.stat().st_size<=32*1024*1024)
    return path.read_bytes()
root=Path(WEBROOT);runtime=root/RUNTIME;gateway=root/GATEWAY
stage=runtime/STAGE;payload=stage/'payload';release=runtime/'releases'/HTML
current=runtime/'current';temporary=runtime/TEMP_POINTER;backup=runtime/BACKUP_POINTER
archive=stage/'interview-ready-candidate.tar.gz'
metadata={'release-manifest.json':PACKAGE_FILES['release-manifest.json'],'release-plan.json':PACKAGE_FILES['release-plan.json']}
members=set(ARTIFACTS)|set(metadata)

def shared_check():
    require(len(SHARED)==15)
    for name,expected in SHARED.items():require(sha(regular(root/name))==expected)

def layout_check(name):
    expected=LAYOUTS[name];measured={};require(len(expected)<=64)
    no_links(root);require(root.is_dir());no_links(runtime.parent)
    # Enumerated directory children are checked before hashing their known files.
    for relative,record in sorted(expected.items(),key=lambda pair:(pair[0].count('/'),pair[0])):
        path=root/relative;kind=record['type']
        if kind=='ABSENT':require(not lexical(path));measured[relative]={'type':'ABSENT'}
        elif kind=='directory':
            no_links(path);require(path.is_dir())
            children=sorted(p.name for p in path.iterdir());require(len(children)<=16 and children==record['children'])
            measured[relative]={'type':'directory','children':children}
        elif kind=='regular':
            value=regular(path);measured[relative]={'type':'regular','bytes':len(value),'sha256':sha(value)}
        elif kind=='symlink':
            no_links(path.parent);require(path.is_symlink())
            literal=os.readlink(path);target=path.resolve(strict=True)
            require(literal==record['literal'] and target.parent==runtime/'releases' and target.name in (HTML,OLD_HTML))
            measured[relative]={'type':'symlink','literal':literal,'bytes':len(literal.encode()),'sha256':sha(literal.encode())}
        else:require(False)
        require(measured[relative]==record)
    digest=sha(json.dumps(measured,sort_keys=True,separators=(',',':'),allow_nan=False).encode())
    require(digest==LAYOUT_DIGESTS[name]);return digest

def find_layout(names):
    for name in names:
        try:layout_check(name);return name
        except RuntimeError:pass
    raise RuntimeError('STOP')

def renameat2(source,destination,flags):
    require(source.parent.stat().st_dev==destination.parent.stat().st_dev)
    if flags==1:require(not lexical(destination))
    else:require(flags==2 and lexical(source) and lexical(destination))
    libc=ctypes.CDLL(None,use_errno=True);call=libc.renameat2
    call.argtypes=[ctypes.c_int,ctypes.c_char_p,ctypes.c_int,ctypes.c_char_p,ctypes.c_uint];call.restype=ctypes.c_int
    require(call(-100,os.fsencode(source),-100,os.fsencode(destination),flags)==0)

def archive_check():
    value=regular(archive);require(len(value)==ARCHIVE_BYTES and sha(value)==BINDINGS['package']);return value

def extract():
    value=archive_check();require(not lexical(payload))
    with tarfile.open(fileobj=io.BytesIO(value),mode='r:gz') as bundle:
        entries=bundle.getmembers();require(len(entries)==7 and {e.name for e in entries}==members and
            all(e.isfile() and e.mode==0o644 and e.mtime==0 and e.uid==e.gid==0 and not e.uname and not e.gname and e.size<=32*1024*1024 for e in entries) and sum(e.size for e in entries)<=64*1024*1024)
        data={}
        for entry in entries:
            require(not entry.name.startswith('/') and '..' not in Path(entry.name).parts)
            value=bundle.extractfile(entry).read();expected=ARTIFACTS.get(entry.name)
            require(len(value)==entry.size and sha(value)==(expected['sha256'] if expected else metadata[entry.name]));data[entry.name]=value
    manifest=json.loads(data['release-manifest.json']);plan=json.loads(data['release-plan.json'])
    require(manifest['sourceCommit']==SOURCE and manifest['sourceRef']==SOURCE and manifest['sourceState']=='EXACT_COMMITTED_INPUTS' and
        manifest['uncommittedInputs']==[] and manifest['candidate'] is True and manifest['productionApproved'] is False and manifest['artifacts']==ARTIFACTS)
    require(plan['host']=='missionmed-kinsta' and plan['webroot']=='/www/theresidencyacademy_209/public' and plan['executable'] is False and plan['productionApproval'] is False)
    payload.mkdir(mode=0o700)
    for name,value in sorted(data.items()):
        target=payload/name;require(not lexical(target));target.parent.mkdir(parents=True,exist_ok=True);no_links(target.parent)
        with target.open('xb') as stream:target.chmod(0o644);stream.write(value);stream.flush();os.fsync(stream.fileno())

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):raise RuntimeError('STOP')

def cache_refresh():
    for name,expected in CACHE_VENDOR.items():require(sha(regular(root/name))==expected)
    require(OP in CACHE_FORMS and CACHE_ENDPOINT=='https://localhost/kinsta-clear-cache/v2/immediate')
    context=ssl.create_default_context();context.check_hostname=False;context.verify_mode=ssl.CERT_NONE
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPSHandler(context=context),NoRedirect())
    request=urllib.request.Request(CACHE_ENDPOINT,data=CACHE_FORMS[OP],method='POST',headers={'Content-Type':'application/x-www-form-urlencoded'})
    with opener.open(request,timeout=5) as response:
        require(response.geturl()==CACHE_ENDPOINT and 200<=response.status<300)
        value=response.read(65537);require(len(value)<=65536)
        return {'status':response.status,'bytes':len(value),'responseSha256':sha(value)}

def main():
    require(MODE in ('upgrade','upgrade-resume','upgrade-recovery'));shared_check()
    if MODE=='upgrade-resume':require(OP in ('prepare-pointer','publish-pointer','readback','refresh-ir-html','refresh-home-html'))
    receipt={};after=None
    if OP=='mkdir-stage':
        require(MODE=='upgrade');layout_check('OLD');stage.mkdir(mode=0o700);after='STAGE'
    elif OP=='transfer':
        require(MODE=='upgrade');layout_check('STAGE');value=base64.b64decode(ARCHIVE_DATA,validate=True)
        require(len(value)==ARCHIVE_BYTES and sha(value)==BINDINGS['package'])
        with archive.open('xb') as stream:archive.chmod(0o600);stream.write(value);stream.flush();os.fsync(stream.fileno())
        after='ARCHIVE'
    elif OP=='extract':
        require(MODE=='upgrade');layout_check('ARCHIVE');extract();after='PAYLOAD'
    elif OP=='lint':
        require(MODE=='upgrade');layout_check('PAYLOAD')
        result=subprocess.run(['php','-l',str(payload/GATEWAY)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=5,check=False)
        require(result.returncode==0);after='PAYLOAD'
    elif OP=='publish-release':
        require(MODE=='upgrade');layout_check('PAYLOAD');renameat2(payload/RUNTIME/'releases'/HTML,release,1);after='PUBLISHED'
    elif OP=='prepare-pointer':
        require(MODE in ('upgrade','upgrade-resume'));layout_check('PUBLISHED');temporary.symlink_to(POINTER);after='PREPARED'
    elif OP=='publish-pointer':
        require(MODE in ('upgrade','upgrade-resume'));layout_check('PREPARED');renameat2(temporary,current,2);layout_check('EXCHANGED')
        renameat2(temporary,backup,1);after='UPGRADED'
    elif OP=='restore-pointer':
        require(MODE=='upgrade-recovery' and RECOVERY_LAYOUT in ('UPGRADED','EXCHANGED'));layout_check(RECOVERY_LAYOUT)
        retained=backup if RECOVERY_LAYOUT=='UPGRADED' else temporary
        renameat2(retained,current,2)
        if RECOVERY_LAYOUT=='EXCHANGED':layout_check('RESTORE_TEMP');renameat2(temporary,backup,1)
        after='RESTORED'
    elif OP=='readback':
        after=find_layout(('OLD','UPGRADED') if MODE=='upgrade' else ('PUBLISHED','UPGRADED') if MODE=='upgrade-resume' else (RECOVERY_LAYOUT,'RESTORED'))
        active=OLD_BINDINGS if after in ('OLD','PUBLISHED','RESTORED') else BINDINGS
        receipt['runtimeBindings']=active
    elif OP in CACHE_FORMS:
        after='UPGRADED' if MODE in ('upgrade','upgrade-resume') else 'RESTORED';layout_check(after);receipt['cacheReceipt']=cache_refresh()
    else:require(False)
    measured=layout_check(after);shared_check()
    value={'operation':OP,'sharedChecked':15,'result':'PASS','layoutSha256':measured};value.update(receipt)
    print(json.dumps(value,sort_keys=True,separators=(',',':')))

class RemoteDeadline(BaseException):pass
def alarm(signum,frame):raise RemoteDeadline()
signal.signal(signal.SIGALRM,alarm);signal.setitimer(signal.ITIMER_REAL,8)
try:main()
except BaseException:
    print('MANUAL_RUNTIME_STOP');raise SystemExit(1)
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
    constants={key:globals()[key] for key in ('WEBROOT','RUNTIME','GATEWAY','HTML','OLD_HTML','POINTER','OLD_POINTER','STAGE','TEMP_POINTER','BACKUP_POINTER','POINTER_SHA','PACKAGE_FILES','BINDINGS','OLD_BINDINGS','SOURCE','ARTIFACTS','SHARED','ARCHIVE_BYTES','LAYOUTS','LAYOUT_DIGESTS','CACHE_VENDOR','CACHE_FORMS','CACHE_ENDPOINT')}
    constants['OP']=operation
    constants['MODE']=contract['spec']['qualifications']['phaseDecision']['manualOperationMode']
    constants['RECOVERY_LAYOUT']='EXCHANGED' if contract['spec']['qualifiedPreimages']==INTERRUPTED_PREIMAGES else 'UPGRADED'
    if operation=='transfer':
        archive=safe_bytes(PACKAGE/'interview-ready-candidate.tar.gz')
        check(len(archive)==ARCHIVE_BYTES and hashlib.sha256(archive).hexdigest()==BINDINGS['package'])
        constants['ARCHIVE_DATA']=base64.b64encode(archive).decode('ascii')
    code='\n'.join(name+' = '+repr(value) for name,value in constants.items())+'\n'+REMOTE_SOURCE
    child=None;record=None;completed=False;dispatched=False
    try:
        record=begin_marker(args,runner,status,operation)
        # Guard2 follows exclusive ACTIVE publication and precedes ANY SSH.
        actual,status2=local_guard(args,runner)
        check(actual==contract and status2['fenceSha256']==record['fenceSha256'])
        check(runner.manual_operation_record(args.control_directory,args.binding,record['fenceSha256'])==record)
        remaining=record['deadlineUnix']-time.time()
        check(0<remaining<=10)
        # Crossing the Popen attempt is the conservative dispatch boundary.
        dispatched=True
        child=subprocess.Popen(['ssh','-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes',
            '-o','ConnectTimeout=8','missionmed-kinsta','python3','-'],
            stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
        remaining=record['deadlineUnix']-time.time()
        check(0<remaining<=10)
        output,_=child.communicate(code.encode(),timeout=remaining)
        check(child.returncode==0 and len(output)<=4096)
        value=json.loads(output)
        after={'mkdir-stage':('STAGE',),'transfer':('ARCHIVE',),'extract':('PAYLOAD',),'lint':('PAYLOAD',),'publish-release':('PUBLISHED',),'prepare-pointer':('PREPARED',),'publish-pointer':('UPGRADED',),'restore-pointer':('RESTORED',),'readback':('OLD','UPGRADED') if constants['MODE']=='upgrade' else ('PUBLISHED','UPGRADED') if constants['MODE']=='upgrade-resume' else (constants['RECOVERY_LAYOUT'],'RESTORED'),'refresh-ir-html':('UPGRADED',) if constants['MODE'] in ('upgrade','upgrade-resume') else ('RESTORED',),'refresh-home-html':('UPGRADED',) if constants['MODE'] in ('upgrade','upgrade-resume') else ('RESTORED',)}[operation]
        check(value.get('layoutSha256') in {LAYOUT_DIGESTS[name] for name in after})
        expected={'operation':operation,'sharedChecked':15,'result':'PASS','layoutSha256':value['layoutSha256']}
        if operation=='readback':
            measured=value.get('runtimeBindings');check(measured in (OLD_BINDINGS,BINDINGS))
            layout=value['layoutSha256'];check(measured==(OLD_BINDINGS if layout in (LAYOUT_DIGESTS['OLD'],LAYOUT_DIGESTS['PUBLISHED'],LAYOUT_DIGESTS['RESTORED']) else BINDINGS));expected['runtimeBindings']=measured
        if operation in CACHE_FORMS:
            receipt=value.get('cacheReceipt');check(type(receipt) is dict and set(receipt)=={'status','bytes','responseSha256'} and type(receipt['status']) is int and 200<=receipt['status']<300 and type(receipt['bytes']) is int and 0<=receipt['bytes']<=65536 and SHA.fullmatch(receipt['responseSha256']))
            expected['cacheReceipt']=receipt
        check(value==expected)
        # Real successful SSH EOF + the exact ACK proves this fixed remote step
        # finished. Persist SAME identity COMPLETE before a closing postguard.
        transition_marker(args,runner,record,'COMPLETE')
        completed=True
        local_guard(args,runner)
        return value
    except BaseException:
        if record is not None and not completed:
            try:transition_marker(args,runner,record,'UNCERTAIN' if dispatched else 'COMPLETE')
            except BaseException:pass  # Invalid/unwritable ACTIVE remains a release-defer condition.
        if child is not None and child.poll() is None:
            try:
                child.kill();child.wait(timeout=2)
            except BaseException:pass
        # A pre-Popen cancellation proves nondispatch; an attempted SSH, including
        # Popen failure/kill/timeout/invalid output, never proves completion.
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
        receipt['layoutSha256']=result['layoutSha256']
        if args.operation=='readback':receipt['runtimeBindings']=result['runtimeBindings']
        if args.operation in CACHE_FORMS:receipt['cacheReceipt']=result['cacheReceipt']
        print(json.dumps(receipt,sort_keys=True,separators=(',',':')))
        return 0
    except SystemExit as error:
        if error.code==0:return 0
        print('MANUAL_RUNTIME_STOP');return 1
    except BaseException:
        print('MANUAL_RUNTIME_STOP');return 1


if __name__=='__main__':
    raise SystemExit(main())
