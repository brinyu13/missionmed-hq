"""One normal post-deployment registry transaction; dormant without review."""
import sys, json, hashlib, subprocess, time, datetime
from pathlib import Path
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = Path('/Users/brianb/MissionMed_worktrees/IR-PHASE1-REGISTRY-20261004-R2')
MISSION = 'IR-INTERVIEW-READY-0002'
REVIEWER = '/root/ir_closeout_review'
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def git(*args): return subprocess.check_output(['git', *args], cwd=ROOT, stderr=subprocess.DEVNULL, text=True).strip()
def write(p, v): p.write_text(json.dumps(v, indent=2)+'\n')
def main():
    if sys.argv[1:] != ['--execute']: print('DORMANT'); return
    approval = json.loads((HERE/'ADMISSION.json').read_text())
    sources = {n:sha(HERE/n) for n in ['register_closeout.py','RECONCILIATION.md','LIVE_READBACK.json']}
    assert approval['verdict']=='APPROVE' and approval['reviewer']==REVIEWER
    assert approval['sources']==sources and time.time()<approval['expiresUnix']<=time.time()+3600
    assert git('rev-parse','HEAD')==approval['osHead'] and git('status','--porcelain')==''
    assert all(not (HERE/n).exists() for n in ['CONSUMED.json','STAGED.json','STAGED_APPROVAL.json','CUSTODY.json'])
    sys.path.insert(0,str(ROOT/'tools'));sys.path.insert(0,str(HERE.parent))
    from mission_registry_registrar import MissionRegistryRegistrar,canonical_decision_numbers
    from engineering_os_lease import SupabaseLeaseClient
    import lease_transport as transport
    assert sha(HERE.parent/'lease_transport.py')=='6bab4c948b28202b7a803228f2123d5c95137030f16eb129c427b4ddcc487cad'
    decision=f'DR-{max(canonical_decision_numbers(ROOT))+1:03d}'
    dpath=f'decisions/{decision}_ir_postdeployment_reconciliation.md'
    hpath='handoffs/from_codex/IR_INTERVIEW_READY_0002/REGISTRATION_TO_CODEX.md'
    paths=sorted([dpath,hpath,'CURRENT.md','missions.json','products_index.json','authority_index.json','registry/boot_dependency_manifest.json','PRODUCT_PASSPORTS/interview-ready.md','decisions/DR-375_ir_phase1_production_authority.md','decisions/DR-376_ir_phase1_bounded_execution_annex.md'])
    with (HERE/'CONSUMED.json').open('x') as f: json.dump({'approvalSha256':sha(HERE/'ADMISSION.json')},f)
    key=transport.retrieve_existing_key();assert transport.authentication_probe(key)==200
    client=SupabaseLeaseClient(base_url=transport.BASE_URL,project_ref=transport.PROJECT,api_key=key,opener=transport.ApikeyOnlyLeaseOpener(key,SupabaseLeaseClient._open_no_redirect))
    txn=None
    try:
        txn=MissionRegistryRegistrar(ROOT,client).begin(mission_id=MISSION,write_paths=paths,owner_id='codex-ir-phase1-foreman',session_id='ir-closeout-20261007',decision_count=1,wait_timeout=60,heartbeat_interval=5)
        assert txn.allocation.remote_head==approval['osHead'] and list(txn.allocation.decision_ids)==[decision]
        def stage():
            assert sources=={n:sha(HERE/n) for n in sources}
            text=(HERE/'RECONCILIATION.md').read_text()
            (ROOT/dpath).write_text(f'---\ndecision: {decision} Interview Ready post-deployment reconciliation\ndate: 2026-10-07\ndecider: Brian\nscope: Record actual prior promotions and close public-commerce mission; no runtime writes.\nevidence: Founder final takeover; preserved deployment receipts and independent October7 readback.\nrollback: Preserve both existing prior releases; no rollback executed.\nexpiry: Historical reconciliation only; no prospective deployment authority.\n---\n\n'+text)
            p=ROOT/'missions.json';v=json.loads(p.read_text());m=next(x for x in v['missions'] if x['id']==MISSION)
            m['state']='done';m['gate']=f'{decision}: public commerce live verified and post-deployment history reconciled; missing historical leases not retroactively approved. Accounts/admin Phase1.1 deferred.'
            m['next_action']='Closed public-commerce Phase1. Fresh bounded Phase1.1/Phase2 authority required for deferred work; no automatic further execution.'
            m['packets'].append(dpath);m['updated_at']=datetime.datetime.now(datetime.timezone.utc).isoformat();write(p,v)
            p=ROOT/'products_index.json';v=json.loads(p.read_text());rows=v['products'];rows=rows.values() if isinstance(rows,dict) else rows
            found=[x for x in rows if x.get('name')=='Interview Ready' and x.get('passport_path')=='PRODUCT_PASSPORTS/interview-ready.md'];assert len(found)==1
            found[0]['status']='public_commerce_live_verified_accounts_phase11_deferred';found[0]['active_mission']=None;found[0]['authority'].append(decision);found[0]['release_note']=f'{decision}: Option5, exact imagery and official branding live; source f23a60a; release9511a1d2; account/admin acceptance deferred.';write(p,v)
            p=ROOT/'authority_index.json';v=json.loads(p.read_text());v['entries'].insert(0,{'id':f'IR_CLOSEOUT_{decision.replace("-","_")}','title':'Interview Ready post-deployment reconciliation and public-commerce closure','path':dpath,'level':1,'scope_tags':['interview_ready','guarded_release','lease_v2'],'status':'POST_DEPLOYMENT_RECONCILIATION_CLOSED','filing_status':'CANONICAL_PUSH_AND_REMOTE_READBACK_REQUIRED','verification_status':'PUBLIC_COMMERCE_LIVE_VERIFIED_ACCOUNTS_DEFERRED','external_state_controls':False,'successor':None,'ratified_by':'Brian','mission_id':MISSION,'registration_paths':paths});write(p,v)
            p=ROOT/'registry/boot_dependency_manifest.json';v=json.loads(p.read_text());profile=v['mission_profiles'][MISSION];profile['required_state']='done';profile['authority_markers'].append(decision);profile['os_dependencies'].append(dpath);write(p,v)
            annex=f'\n\n## Post-deployment reconciliation — 2026-10-07 ({decision})\n\nSee `{dpath}`. October6 actual pointer moves d4439bb8→c5604978→9511a1d2 recorded AFTER deployment. No new historical lease/DR existed for these promotions; none is fabricated here. Founder final takeover authorizes retaining verified live public commerce and closure. Historical pending paragraphs above are superseded only for this public-commerce closure. Account/Admin Phase1.1 and Phase2 deferred; gateway/auth/Matrix guards preserved; no new source or runtime operation. Evidence/custody in product `_AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/CLOSEOUT_20261007/` and original Claude OPTION5_20261006 handoff/receipts.\n'
            for name in ['PRODUCT_PASSPORTS/interview-ready.md',hpath,'decisions/DR-375_ir_phase1_production_authority.md','decisions/DR-376_ir_phase1_bounded_execution_annex.md']:
                p=ROOT/name;p.write_text(p.read_text()+annex)
            import mmos_status;mmos_status.ROOT=ROOT;(ROOT/'CURRENT.md').write_text('\n'.join(mmos_status.build_current())+'\n')
            subprocess.run(['python3',str(ROOT/'tools/validate_boot_dependencies.py'),'--hq-git-dir','/Users/brianb/MissionMed/.git','--os-root',str(ROOT),'--mission-profile',MISSION],check=True)
            subprocess.run(['python3',str(ROOT/'tools/lint_os.py')],cwd=ROOT,check=True)
            subprocess.run(['git','add','--',*paths],cwd=ROOT,check=True)
        txn.revalidate();txn.run_guarded(stage)
        staged={p:sha(ROOT/p) for p in paths};receipt={'paths':staged,'canonicalBase':txn.allocation.remote_head,'decision':decision}
        write(HERE/'STAGED.json',receipt);print('REGISTRY_STAGED_REVIEW_READY',flush=True)
        deadline=time.monotonic()+600
        while time.monotonic()<deadline:
            txn.heartbeat();assert sources=={n:sha(HERE/n) for n in sources}
            p=HERE/'STAGED_APPROVAL.json'
            if p.exists():
                b=json.loads(p.read_text());assert b['verdict']=='APPROVE' and b['reviewer']==REVIEWER and b['paths']==staged and b['canonicalBase']==receipt['canonicalBase'];break
            time.sleep(1)
        else: raise RuntimeError('STOP')
        def custody():
            assert staged=={p:sha(ROOT/p) for p in paths};assert sorted(git('diff','--cached','--name-only').splitlines())==paths
            for p,h in staged.items():assert hashlib.sha256(subprocess.check_output(['git','show',':'+p],cwd=ROOT)).hexdigest()==h
            git('commit','-m','Reconcile Interview Ready prior live promotions and close public commerce Phase1');git('push','origin','main');git('fetch','origin')
            head=git('rev-parse','HEAD');assert head==git('rev-parse','origin/main')
            for p,h in staged.items():assert hashlib.sha256(subprocess.check_output(['git','show','origin/main:'+p],cwd=ROOT)).hexdigest()==h
            return head
        txn.revalidate();head=txn.run_guarded(custody);txn.release();txn=None
        write(HERE/'CUSTODY.json',{'head':head,'decision':decision,'paths':staged,'registryReleased':True});print('REGISTRY_CUSTODY_VERIFIED_RELEASED '+head,flush=True)
    finally:
        if txn is not None:txn.release();print('REGISTRY_RELEASED_AFTER_STOP',flush=True)
if __name__=='__main__':
    try:main()
    except Exception:print('REGISTRY_FAILED_CLOSED',file=sys.stderr);sys.exit(1)
