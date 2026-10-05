"""One scoped supplement using the existing canonical registrar/transport. Dormant by default."""
import sys,json,hashlib,time,subprocess,datetime
from pathlib import Path
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
ROOT=Path('/Users/brianb/MissionMed_worktrees/IR-PHASE1-REGISTRY-20261004-R2')
PRODUCT=Path('/Users/brianb/MissionMed_worktrees/IR-INTERVIEW-READY-0002')
MISSION='IR-INTERVIEW-READY-0002'
OS_BASE='b9f249c'  # checked as an unambiguous commit prefix against independently bound HEAD
REVIEWER='/root/inventory_exact_admission_reviewer'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def run(*args):return subprocess.check_output(args,cwd=ROOT,stderr=subprocess.DEVNULL,text=True).strip()
def write(p,v):p.write_text(json.dumps(v,indent=2)+'\n')
def main():
 if sys.argv[1:]!=['--execute']:print('DORMANT');return
 a=json.loads((HERE/'REGISTRATION_APPROVAL.json').read_text())
 expected={n:sha(HERE/n) for n in ['register_commerce.py','DECISION_REGISTRATION_PACKET.md','FOUNDER_CONSENT_EXCERPT.md']}
 assert a['verdict']=='APPROVE' and a['reviewer']==REVIEWER and a['sources']==expected and time.time()<a['expiresUnix']<=time.time()+3600
 assert run('git','rev-parse','HEAD')==a['osHead'] and run('git','status','--porcelain')==''
 sys.path.insert(0,str(ROOT/'tools'));sys.path.insert(0,str(HERE.parent))
 from mission_registry_registrar import MissionRegistryRegistrar,canonical_decision_numbers
 from engineering_os_lease import SupabaseLeaseClient
 from lease_transport import existing_lease_client
 number=max(canonical_decision_numbers(ROOT))+1;decision=f'DR-{number:03d}'
 dpath=f'decisions/{decision}_ir_phase1_public_commerce_fallback.md';hpath='handoffs/from_codex/IR_INTERVIEW_READY_0002/REGISTRATION_TO_CODEX.md'
 paths=sorted([dpath,hpath,'CURRENT.md','missions.json','products_index.json','authority_index.json','registry/boot_dependency_manifest.json','PRODUCT_PASSPORTS/interview-ready.md'])
 marker=HERE/'REGISTRATION_READ_CONSUMED.json'
 with marker.open('x') as f:json.dump({'approvalSha256':sha(HERE/'REGISTRATION_APPROVAL.json'),'state':'CONSUMED'},f)
 client=existing_lease_client(SupabaseLeaseClient);txn=None
 try:
  txn=MissionRegistryRegistrar(ROOT,client).begin(mission_id=MISSION,write_paths=paths,owner_id='codex-ir-phase1-foreman',session_id='ir-commerce-finish-20261005',decision_count=1,wait_timeout=60,heartbeat_interval=5)
  assert txn.allocation.remote_head==a['osHead'] and list(txn.allocation.decision_ids)==[decision]
  def stage():
   assert expected=={n:sha(HERE/n) for n in expected}
   (ROOT/dpath).write_text(f'---\ndecision: {decision} Interview Ready public-commerce fallback\ndate: 2026-10-05\ndecider: Brian\nscope: IR-only public commerce and truthful device-only tools; accounts deferred.\nevidence: Current direct Founder FINISH-NOW steer; independently reviewed narrow supplement.\nrollback: IR code/pointer only; preserve account state and siblings.\nexpiry: Commerce acceptance closure, revocation or protected gate failure.\n---\n\n'+(HERE/'DECISION_REGISTRATION_PACKET.md').read_text().split('## Proposed decision text',1)[1].split('## Minimal source and custody transaction',1)[0]+'\n\nExact fallback source paths: interview-ready/account.js, build.py, phase1.json, phase1.js and corresponding isolated tests/evidence. Existing reviewed shopping four-path delta and scoped release/package helpers remain covered. No gateway/backend/Matrix change.\n\n## Founder consent provenance\n\n'+(HERE/'FOUNDER_CONSENT_EXCERPT.md').read_text())
   p=ROOT/'missions.json';v=json.loads(p.read_text());m=next(x for x in v['missions'] if x['id']==MISSION);m['packets'].append(dpath);m['gate']=f'{decision}: public-commerce release only; independent exact-byte/live acceptance pending. ACCOUNT VERIFICATION DEFERRED TO PHASE 1.1; no account LIVE claim.';m['next_action']='Release reviewed compact public commerce and device-only checklist under normal guarded deployment; verify public/mobile/motion/affiliate links; accounts/admin Phase1.1.';m['updated_at']=datetime.datetime.now(datetime.timezone.utc).isoformat();write(p,v)
   p=ROOT/'authority_index.json';v=json.loads(p.read_text());v['entries'].insert(0,{'id':f'IR_COMMERCE_{decision.replace("-","_")}','title':'Interview Ready Founder public-commerce finish supplement','path':dpath,'level':1,'scope_tags':['interview_ready','wordpress_wrapper','guarded_release','lease_v2'],'status':'ACTIVE_AFTER_CANONICAL_CUSTODY_INDEPENDENT_REVIEW_BOOT_AND_REGISTRY_RELEASE','filing_status':'CANONICAL_PUSH_AND_REMOTE_READBACK_REQUIRED','verification_status':'COMMERCE_LIVE_ACCEPTANCE_PENDING_ACCOUNTS_DEFERRED','external_state_controls':True,'successor':None,'ratified_by':'Brian','mission_id':MISSION,'registration_paths':paths});write(p,v)
   p=ROOT/'registry/boot_dependency_manifest.json';v=json.loads(p.read_text());v['mission_profiles'][MISSION]['authority_markers'].append(decision);v['mission_profiles'][MISSION]['os_dependencies'].append(dpath);write(p,v)
   p=ROOT/'products_index.json';v=json.loads(p.read_text());rows=v['products'];rows=rows.values() if isinstance(rows,dict) else rows
   found=[x for x in rows if 'interview-ready' in str(x.get('passport','')) or x.get('name')=='Interview Ready' or x.get('product_key')=='INTERVIEW-READY']
   assert len(found)==1;found[0]['release_note']=f'{decision}: public-commerce finish, account acceptance deferred to Phase1.1';found[0]['status']='public_commerce_candidate_accounts_phase11_deferred';found[0]['authority'].append(decision);write(p,v)
   for name in ['PRODUCT_PASSPORTS/interview-ready.md',hpath]:
    p=ROOT/name;p.write_text(p.read_text()+f'\n\n## Founder finish supplement {decision}\n\nPublic-commerce/device-only release authorized under {dpath}; account acceptance remains deferred. Gateway, auth and Matrix guards unchanged. Canonical checklist/kit keys only in isolated device storage; no account-state migration or API call in fallback. Normal scoped source/runtime/recovery/independent/live gates retained.\n')
   import mmos_status;mmos_status.ROOT=ROOT;(ROOT/'CURRENT.md').write_text('\n'.join(mmos_status.build_current())+'\n')
   subprocess.run(['python3',str(ROOT/'tools/validate_boot_dependencies.py'),'--hq-git-dir','/Users/brianb/MissionMed/.git','--os-root',str(ROOT),'--mission-profile',MISSION],check=True)
   subprocess.run(['git','add','--',*paths],cwd=ROOT,check=True)
  txn.run_guarded(stage)
  staged={p:sha(ROOT/p) for p in paths};receipt={'schema':'ir.commerce.registry.staged.v1','paths':staged,'canonicalBase':txn.allocation.remote_head,'decision':decision};write(HERE/'REGISTRATION_STAGED.json',receipt);print('REGISTRY_STAGED_REVIEW_READY',flush=True)
  deadline=time.monotonic()+600
  while time.monotonic()<deadline:
   txn.heartbeat();p=HERE/'REGISTRATION_STAGED_APPROVAL.json'
   if p.exists():
    b=json.loads(p.read_text());assert b['verdict']=='APPROVE' and b['reviewer']==REVIEWER and b['paths']==staged and b['canonicalBase']==receipt['canonicalBase'];break
   time.sleep(1)
  else:raise RuntimeError('STOP')
  def custody():
   assert staged=={p:sha(ROOT/p) for p in paths};assert sorted(run('git','diff','--cached','--name-only').splitlines())==paths
   run('git','commit','-m','Authorize Interview Ready public commerce fallback and defer accounts');run('git','push','origin','main');run('git','fetch','origin');head=run('git','rev-parse','HEAD');assert head==run('git','rev-parse','origin/main')
   for p,h in staged.items():assert hashlib.sha256(subprocess.check_output(['git','show','origin/main:'+p],cwd=ROOT)).hexdigest()==h
   return head
  head=txn.run_guarded(custody);txn.release();txn=None;write(HERE/'REGISTRATION_CUSTODY.json',{'head':head,'decision':decision,'paths':staged,'registryReleased':True});print('REGISTRY_CUSTODY_VERIFIED_RELEASED '+head,flush=True)
 finally:
  if txn is not None:txn.release();print('REGISTRY_RELEASED_AFTER_STOP',flush=True)
if __name__=='__main__':
 try:main()
 except Exception:print('REGISTRY_FAILED_CLOSED',file=sys.stderr);sys.exit(1)
