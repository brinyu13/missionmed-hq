"""Local disposable exact-source QA build; no server, provider, or account context."""
from pathlib import Path
import hashlib,json,subprocess,sys
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[4]
HERE=Path(__file__).resolve().parent
SCRATCH=Path('/private/tmp/ir-shopping-qa-20261005')
PACKAGE=Path('/private/tmp/ir-phase1-renderfix-20261004')
SOURCE='8717ebd04ad1cd60e66ef197b55080d58492e2be'
PATCH=HERE.parent/'SHOPPING_UX_STEER_20261005/shopping.patch'
REVIEW=HERE.parent/'SHOPPING_UX_STEER_20261005/INDEPENDENT_REVIEW_FIXED.md'
sha=lambda b:hashlib.sha256(b).hexdigest()
def regular(path):
    if not path.is_file() or any(p.is_symlink() for p in (path,*path.parents)):
        raise ValueError('Nonregular input')
    return path.read_bytes()
assert not SCRATCH.exists(), 'Disposable destination must be absent'
assert sha(regular(PACKAGE/'interview-ready-candidate.tar.gz'))=='a93cb2e0be061ca1a1558640f0db3030a6aab8e26c4bcb71f52504b7caf413c3'
manifest_bytes=regular(PACKAGE/'release-manifest.json')
manifest=json.loads(manifest_bytes)
assert manifest['sourceCommit']==SOURCE and manifest['sourceState']=='EXACT_COMMITTED_INPUTS'
expected=manifest['buildInputs'];assert len(expected)==35
assert sha(regular(PATCH))=='04d6169e7debb4a082ea617f53dd84056c589b0e75c5f462a4b05c63a2de3bae'
assert sha(regular(REVIEW))=='9594394c6f99a71a788f7a8ec55efb4a0629184a5441058db32d19f37301b3c3'
def verify_canonical():
    for name,digest in expected.items():
        assert name==str(Path(name)) and not Path(name).is_absolute() and '..' not in Path(name).parts
        value=regular(ROOT/'interview-ready'/name)
        assert sha(value)==digest, 'Canonical input drift: '+name
        committed=subprocess.check_output(['git','show',SOURCE+':interview-ready/'+name],cwd=ROOT)
        assert value==committed, 'Immutable product mismatch: '+name
verify_canonical()
SCRATCH.mkdir()
for name in expected:
    target=SCRATCH/'interview-ready'/name;target.parent.mkdir(parents=True,exist_ok=True)
    with target.open('xb') as stream:stream.write(regular(ROOT/'interview-ready'/name))
subprocess.run(['git','apply','--check',str(PATCH)],cwd=SCRATCH,check=True)
subprocess.run(['git','apply',str(PATCH)],cwd=SCRATCH,check=True)
changed=[]
for name,digest in expected.items():
    if sha(regular(SCRATCH/'interview-ready'/name))!=digest:changed.append(name)
assert sorted(changed)==['completion.css','completion.js','phase1.css','phase1.js']
for name in ('build.py','integration/release.py'):
    compile(regular(SCRATCH/'interview-ready'/name),name,'exec')
for name in ('completion.js','phase1.js','account.js'):
    subprocess.run(['node','--check',str(SCRATCH/'interview-ready'/name)],check=True)
result=subprocess.run([sys.executable,'-B',str(SCRATCH/'interview-ready/build.py'),
    '--asset-profile','production','--output-dir',str(SCRATCH/'output')],check=True,capture_output=True,text=True)
build=json.loads(result.stdout)
assert build['assetProfile']=='production' and build['releaseApproved'] is False
assert build['accountContextMarker']=='/* MMED_IR_ACCOUNT_CONTEXT */ null'
policy=json.loads(regular(SCRATCH/'interview-ready/production-assets.json'))
assert build['embeddedAssets']=={a['path']:a['sha256'] for a in policy['assets']}
html=regular(SCRATCH/'output/interview-ready.html')
assert sha(html)==build['sha256']
assert b'/* MMED_IR_ACCOUNT_CONTEXT */ null' in html
assert build['inputs']['account.js']==expected['account.js']
verify_canonical()
receipt={'schema':'ir.shopping.local-visual-qa.v1','sourceCommit':SOURCE,
    'canonical35BeforeAfter':'PASS','packageArchiveSha256':sha(regular(PACKAGE/'interview-ready-candidate.tar.gz')),
    'releaseManifestSha256':sha(manifest_bytes),'patchSha256':sha(regular(PATCH)),
    'reviewSha256':sha(regular(REVIEW)),'patchOnlyScratchFiles':changed,
    'entry':str(SCRATCH/'output/interview-ready.html'),
    'copiedInputs':{name:sha(regular(SCRATCH/'interview-ready'/name)) for name in expected},
    'outputFiles':{p.name:sha(regular(p)) for p in sorted((SCRATCH/'output').iterdir())},
    'assetProfile':'production','releaseApproved':False,'accountContext':'unchanged null',
    'serverStarted':False,'browserStarted':False}
(HERE/'PREP_RECEIPT.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'entry':receipt['entry'],'htmlSha256':build['sha256'],
    'canonical35BeforeAfter':'PASS','compileBuild':'PASS'}))
