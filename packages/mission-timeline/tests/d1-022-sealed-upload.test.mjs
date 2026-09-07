import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
// Exercise the actual Python operator with disposable files. Build, lease and
// provider boundaries are isolated; these tests never invoke a provider CLI.
const setup=String.raw`
import importlib.util,json,tempfile
from pathlib import Path
s=importlib.util.spec_from_file_location('release022',Path('scripts/railway-release-022.py'))
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
source_config=json.loads((m.PACKAGE/'railway.json').read_text())
temporary=tempfile.TemporaryDirectory(prefix='d1-022-sealed-upload-')
m.PACKAGE=Path(temporary.name)/'package';m.OUT=Path(temporary.name)/'out'
(m.PACKAGE/'dist').mkdir(parents=True);(m.PACKAGE/'dist-api').mkdir()
head='a'*40;commands=[]
m.guard=lambda *a:None;m.clean_source=lambda:head
m.execute=lambda args,**kwargs:commands.append((args,kwargs)) or b''
(m.PACKAGE/'package.json').write_text('{"name":"disposable-synthetic-fixture"}')
(m.PACKAGE/'package-lock.json').write_text('{"lockfileVersion":3}')
(m.PACKAGE/'dist-api/server.mjs').write_text('export const fixture = true;\n')
(m.PACKAGE/'railway.json').write_text(json.dumps(source_config))
(m.PACKAGE/'dist/release-manifest.json').write_text(json.dumps({'mode':'release','source_commit':head,'release_id':'timeline-disposable-fixture'}))
receipt=m.OUT/'seal.json';sealed=m.seal(receipt)
binding={'path':str(receipt),'sha256':m.digest(receipt.read_bytes())}
directory=Path(sealed['candidate_directory'])
def denied(call,code):
 try:call()
 except m.Denied as error:assert str(error)==code,(str(error),code)
 else:raise AssertionError('Expected denial: '+code)
`;
function python(body){
  return execFileSync('python3',['-B','-c',setup+'\n'+body],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
}

test('Actual seal preserves deployment policy, syntax-checks the prebuilt bundle, and rejects upload-set or byte drift',()=>{
  assert.equal(python(String.raw`
assert [args for args,kwargs in commands]==[['npm','run','typecheck'],['npm','run','build:api'],['npm','run','check:api-only']]
assert all(kwargs['cwd']==m.PACKAGE for args,kwargs in commands)
actual=json.loads((directory/'railway.json').read_text())
expected=json.loads(json.dumps(source_config))
expected['build']['buildCommand']='node --check dist-api/server.mjs'
expected['deploy']['startCommand']='node dist-api/server.mjs'
assert actual==expected
assert json.loads((m.PACKAGE/'railway.json').read_text())==source_config
assert set(sealed['files'])=={'package.json','package-lock.json','dist-api/server.mjs','railway.json'}
assert all((directory/name).stat().st_mode & 0o777==0o400 for name in sealed['files'])
assert m.verify_seal(binding)==sealed
for extra in ['.env','.railwayignore','private-evidence.json']:
 p=directory/extra;p.write_text('disposable forbidden fixture')
 denied(lambda:m.verify_seal(binding),'API_UPLOAD_SET_DENIED');p.unlink()
bundle=directory/'dist-api/server.mjs';original=bundle.read_bytes();bundle.chmod(0o600);bundle.write_bytes(original+b'// changed')
denied(lambda:m.verify_seal(binding),'API_UPLOAD_BYTES_CHANGED')
bundle.write_bytes(original);bundle.chmod(0o400)
bundle.unlink();bundle.symlink_to(m.PACKAGE/'dist-api/server.mjs')
denied(lambda:m.verify_seal(binding),'API_UPLOAD_BYTES_CHANGED')
bundle.unlink();bundle.write_bytes(original);bundle.chmod(0o400)
missing=directory/'package-lock.json';saved=missing.read_bytes();missing.unlink()
denied(lambda:m.verify_seal(binding),'API_UPLOAD_SET_DENIED')
missing.write_bytes(saved);missing.chmod(0o400)
(m.PACKAGE/'dist-api/server.mjs').write_bytes(original+b'// local drift')
denied(lambda:m.verify_seal(binding),'LOCAL_API_BUNDLE_CHANGED')
(m.PACKAGE/'dist-api/server.mjs').write_bytes(original)
m.clean_source=lambda:'b'*40
denied(lambda:m.verify_seal(binding),'SEALED_SOURCE_COMMIT_CHANGED')
temporary.cleanup();print('PASS')
`),'PASS');
});

test('Actual operate rechecks the sealed directory immediately before a confined --no-gitignore upload',()=>{
  assert.equal(python(String.raw`
identity={'database':'railway','schema_version':'d1-timeline-db-500.1','system_identifier':'disposable-fixture'}
baseline={**identity,'operator':'postgres','new_tables_absent':True,'issuer_absent':True,'login_absent':True,'admin_workflow_absent':True,'bookkeeping_tables':[]}
initial={'DATABASE_URL':'postgresql://postgres:disposable@postgres.railway.internal:5432/railway','TIMELINE_AI_PROVIDER':'openai','TIMELINE_AI_MODEL':'disposable-model','TIMELINE_AI_API_KEY':'disposable-test-value'}
current=dict(initial);calls=[];dirty=False
m.verify_plan=lambda *a:sealed;m.inspect_provider=lambda:None;m.admission_off=lambda:None
m.postgres_identity=lambda:identity;m.variables=lambda *a:dict(current)
m.patch_variables=lambda values:current.update(values);m.save_new=lambda *a:None
def database(action,**fields):
 if action=='inspect':return {'baseline':baseline}
 if dirty:(directory/'.env').write_text('disposable forbidden fixture')
 return {'status':'PASS'}
m.database=database
class InterceptedUpload(Exception):pass
def intercept(args,**kwargs):
 calls.append((args,kwargs));raise InterceptedUpload()
m.execute=intercept
plan={'sealed_api':binding,'preserved_ai_model':'disposable-model','schema_identity':identity,'migrations':[]}
try:m.operate(plan,m.OUT/'operation.json',True)
except InterceptedUpload:pass
else:raise AssertionError('Upload was not reached')
assert len(calls)==1
args,kwargs=calls[0]
assert args==['railway','up',str(directory),'--path-as-root','--no-gitignore','--project',m.TARGET['projectId'],'--environment',m.TARGET['environmentId'],'--service',m.TARGET['serviceId'],'--detach','--json','--message','D1-022 '+sealed['candidate_id']+' '+head]
assert kwargs=={'timeout':180}
assert str(m.PACKAGE) not in args
current=dict(initial);calls.clear();dirty=True
denied(lambda:m.operate(plan,m.OUT/'denied-operation.json',True),'API_UPLOAD_SET_DENIED')
assert calls==[], 'Changed candidate must never reach the upload boundary'
temporary.cleanup();print('PASS')
`),'PASS');
});
