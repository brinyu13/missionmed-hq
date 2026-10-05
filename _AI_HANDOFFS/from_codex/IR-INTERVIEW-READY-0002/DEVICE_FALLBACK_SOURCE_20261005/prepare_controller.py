from pathlib import Path
import ast,json,hashlib
H=Path(__file__).resolve().parent;A=H.parent;R=H.parents[3]
old=(A/'SHOPPING_COMBINED_SOURCE_ADMISSION_20261005/integration_shopping_source_runner.py').read_text();tree=ast.parse(old)
def func(name):
 n=next(n for n in tree.body if isinstance(n,(ast.FunctionDef,ast.ClassDef)) and n.name==name)
 return ''.join(old.splitlines(True)[n.lineno-1:n.end_lineno])+'\n\n'
F=A/'FINISH_NOW_DEVICE_FALLBACK_20261005/AFTER_SHOPPING'
paths=['interview-ready/account.js','interview-ready/build.py','interview-ready/phase1.json','interview-ready/phase1.js']
pre={k:hashlib.sha256((R/k).read_bytes()).hexdigest() for k in paths};post={k:hashlib.sha256((F/Path(k).name).read_bytes()).hexdigest() for k in paths}
packet={'schema':'ir.device_fallback_source.packet.v1','sourceBASE':'341c9ad88b0c00ea0b09a0e3bbf04eeb770b89e5','writePaths':paths,'sourcePreimages':pre,'plannedSourcePostimages':post,'sharedDomains':[],'scope':'PATH:93cc7bada097a03b5163b83ecfc0d5f8fb2357c6f517b6c6f4a456acc7c155c6','objective':'Apply explicit device-only fallback on integrated shopping; no account readiness or server authorization change.','patchSequence':[{'patch':'FINISH_NOW_DEVICE_FALLBACK_20261005/AFTER_SHOPPING/device-fallback.patch','sha256':'01230fa4d8351373135a0c494329b4325fbcf11d97a26bce366aecb1861190be','preimages':pre,'postimages':post}],'persistenceMode':'device-only','accountReady':False,'accountPersistenceReady':False,'releaseApproved':False,'releaseState':'public-commerce','namespace':'mmed-ir-device-v1','preserve':['default account branch','normal build production blockers','server /app gate and API authorization','engine/photo/credit/shopping custody'],'excluded':['provider/runtime/DB/OS mutations','account/nonce/subject/network persistence','media/names/free text/legacy keys','generated dist/release promotion','any other product paths'],'workerProtocol':'Immediate unchanged healthy guard before every write/commit; exact pre/postimages and patch check; one four-path scoped commit; worker stop/drain observed before Root DONE/release.','rollback':'Precommit only exact admitted four preimages under healthy guard after worker drain; postcommit separate reviewed recovery packet. No reset/clean/general checkout.','authoritySupplement':{'osHead':'fe17a4ca5572aecdc2d2761e8c2d993f7aebb8bf','decisionFile':'decisions/DR-391_ir_phase1_public_commerce_fallback.md','decisionSha256':'0ac4eace2f96ccfbc10864d7a022cba1eb0c6f9c4eeb0bb668dd342e3c532982','handoffFile':'handoffs/from_codex/IR_INTERVIEW_READY_0002/REGISTRATION_TO_CODEX.md','handoffSha256':'2251e6798c0d117d56276f1bae637f9c6864209ce2f0e1f31a8a71af9b25e00a'}}
canonical=lambda x:json.dumps(x,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
(H/'PACKET.md').write_text('# Device fallback SOURCE typed packet\n\nDormant with exact DR391 supplemental custody; independent controls required. No account/native/production acceptance.\n\n<!-- DEVICE_SOURCE_PACKET_BEGIN -->\n'+json.dumps(packet,indent=2)+'\n<!-- DEVICE_SOURCE_PACKET_END -->\n')
imports=old[:old.index('ROOT = ')]
constants=f'''ROOT = Path(__file__).resolve().parents[4]
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
SOURCE_BASE = {packet['sourceBASE']!r}
ACCEPTED_PRODUCT = '8717ebd04ad1cd60e66ef197b55080d58492e2be'
PATTERN_SHA = '12d4c346a879867d68965621dc90c2789899375fb010cfd8066850d4a7318953'
SCOPE = {packet['scope']!r}
FALLBACK_DIR = ARTIFACT_ROOT / 'FINISH_NOW_DEVICE_FALLBACK_20261005/AFTER_SHOPPING'
FALLBACK_PATCH_SHA = '01230fa4d8351373135a0c494329b4325fbcf11d97a26bce366aecb1861190be'
FALLBACK_TESTS_SHA = '1bed34f841c41d35a4a211e56a8d1f11b1e75cb5642820fc58c22dacfd4850df'
FALLBACK_MANIFEST_SHA = '265d6a72bbf246ea675585eb47f26e58b4d32d01283fb25d505715e406d6e399'
FALLBACK_RECEIPT_SHA = '1d42d6d033a9bebad0ecae28347b7414b2f6466eaa7d68c8efd9ef2d207bb785'
FALLBACK_HANDOFF_SHA = 'fc7eb3a5f44a83c1243107589abd4f136941924e7d130952ccb0332b7ad3c50f'
PLANNED_POSTIMAGES = {post!r}
TRANSPORT_SHA = '6bab4c948b28202b7a803228f2123d5c95137030f16eb129c427b4ddcc487cad'
ORIGIN = 'https://github.com/brinyu13/missionmed-hq.git'
REF = 'refs/heads/codex/ir-interview-ready-0002-storyforge'
OWNER = 'codex-ir-phase1-foreman'
PATHS = {paths!r}
BASE_PREIMAGES = {pre!r}
INTERVAL = 5.0
BUILDER = 'codex-ir-device-fallback-source-runner-builder'
PACKET_SHA = {hashlib.sha256(canonical(packet)).hexdigest()!r}
PACKET_FILE = 'PACKET.md'
\n'''
parse='''def device_packet():
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


'''
execute=func('execute').replace('ir.shopping_source_lease.read_admission.v1','ir.device_fallback_source_lease.read_admission.v1').replace("approval['shoppingReview']","approval['deviceReview']").replace('SOURCE_SHOPPING_LEASE_READ_CONSUMED_','SOURCE_DEVICE_LEASE_READ_CONSUMED_').replace('ir-phase1-shopping-source-20261005-','ir-phase1-device-source-20261005-')
text=imports+constants+''.join(func(n) for n in ['Stop','digest','canonical','head','preimages','original_preimages','pattern_digest'])+parse+''.join(func(n) for n in ['read_json','fresh','safe_diagnostic','breadcrumb','atomic','load_module','check_worker_guard','orchestrate'])+execute+func('main')+"if __name__ == '__main__':\n    raise SystemExit(main())\n"
(H/'integration_device_source_runner.py').write_text(text)
print('Prepared dormant controller with Root supplied DR391 custody')
