"""One fenced canonical registry transaction. Secrets remain in process memory."""
from pathlib import Path
import argparse, datetime, hashlib, json, os, selectors, subprocess, sys, time
sys.dont_write_bytecode=True
ROOT=Path('/Users/brianb/MissionMed_worktrees/IR-PHASE1-REGISTRY-20261004')
PRODUCT=Path('/Users/brianb/MissionMed_worktrees/IR-INTERVIEW-READY-0002')
HANDOFF=PRODUCT/'_AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002'
sys.path.insert(0,str(ROOT/'tools'))
from mission_registry_registrar import MissionRegistryRegistrar, canonical_decision_numbers, refresh_canonical
from engineering_os_lease import SupabaseLeaseClient
MISSION='IR-INTERVIEW-READY-0002'

def run(argv,cwd=ROOT):
    p=subprocess.run(argv,cwd=cwd,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=90,text=True)
    if p.returncode: raise RuntimeError('bounded command failed closed')
    return p.stdout

def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def write_json(p,d): p.write_text(json.dumps(d,indent=2)+'\n')
def client():
    from lease_transport import existing_lease_client
    return existing_lease_client(SupabaseLeaseClient)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--execute',action='store_true');args=parser.parse_args()
    if not args.execute: print('No mutation. --execute requires independent prospective review; staged review remains mandatory.');return
    review=HANDOFF/'PHASE1_INDEPENDENT_CONTRACT_REVIEW.md'
    if not review.is_file() or 'APPROVE WITH CONDITIONS' not in review.read_text(): raise RuntimeError('prospective review unavailable')
    refresh_canonical(ROOT)
    # These are prospective binding names, never reserved IDs. Allocation occurs
    # only after acquire; a remote advance causes release/retry, never rebinding.
    next_number=max(canonical_decision_numbers(ROOT))+1
    ids=[f'DR-{next_number:03d}',f'DR-{next_number+1:03d}']
    decisions=[f'decisions/{ids[0]}_ir_phase1_production_authority.md',f'decisions/{ids[1]}_ir_phase1_bounded_execution_annex.md']
    handoff='handoffs/from_codex/IR_INTERVIEW_READY_0002/REGISTRATION_TO_CODEX.md'
    paths=sorted(['CURRENT.md','missions.json','products_index.json','authority_index.json','registry/boot_dependency_manifest.json','PRODUCT_PASSPORTS/interview-ready.md',handoff,*decisions])
    api=client();txn=None
    try:
        txn=MissionRegistryRegistrar(ROOT,api).begin(mission_id=MISSION,write_paths=paths,owner_id='codex-ir-phase1-foreman',session_id='ir-phase1-20261004-registration',decision_count=2,wait_timeout=60,heartbeat_interval=5)
        if list(txn.allocation.decision_ids)!=ids: raise RuntimeError('prospective path allocation changed; release and retry required')
        stamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
        packet=HANDOFF/'PHASE1_REGISTRATION_REQUEST.md'
        body=packet.read_text().split('## Continuation and prospective exact execution contract')[1]+'''\n\nAdditional binding conditions: Named QA identities are exactly mm_ir_phase1_qa_a_20261004 and mm_ir_phase1_qa_b_20261004, no-course subscriber accounts with fictional .example addresses, private memory-only credentials, no mail, no enrollment grants; collision stops creation instead of modifying existing identity. Advisory lock failure or connection loss fails closed with no write, mandatory finally release, tested CAS/conflict/idempotency/recovery. Exact live host is SSH missionmed-kinsta, webroot /www/theresidencyacademy_209/public, no symlink outside dedicated release root. Qualified before/after shared origin/cache-busted public digests and actual renderer selections are binding, not inferred from old lock. Independent source/asset/media/recovery and final release approval must name exact staged and live bytes. Provider-clear after REGISTRY release must be read independently before product acquisition.\n''' 
        header=lambda decision,scope: f'---\ndecision: {decision}\ndate: 2026-10-04\ndecider: Brian\nscope: {scope}\nevidence: Direct Founder Phase1 and continuation instructions; independently reviewed prospective contract.\nrollback: Exact isolated IR code/pointer preimage only; preserve private state, identities, all sibling runtime and existing leases.\nexpiry: Live verification closure, Founder revocation, or protected gate failure.\n---\n\n'
        authority=header(ids[0]+' Interview Ready Phase1 production authority','Existing accepted Interview Ready chassis through canonical free-account online-gear production release and live verification.')+f'''# Founder outcome and consent

Execute IR Phase1 on existing accepted chassis a8f47649a917f92743ec161d83f587cb58a4a921. Public original editorial buying guide plus free registered-account personal tools; no paid enrollment prerequisite or sibling grants. Exactly three horizontal desktop tiers, genuine products/missionmatch-20 links, truthful seasonal event, adjacent expert evidence, persistent account checklist and preserved cinematic motion. Phase2 deferred. No unsupported charity claim.

Founder master SHA256 d0060e54ed28f095e42d65ee7b88f2e690a7980dfbfeb055e989f73e6acf4d0a; direct continuation SHA256 783a29048a0f5b17aa901a532689ec9c918841a7c055f06e2e62c04c45a8f2b7. Founder explicitly delegates independent reviewer and canonical admission/deployment steps; no additional generic approval requested. This decision files that consent, not builder release approval.

Bounded exact implementation/storage/provider/Matrix guard contract: {decisions[1]}. Registration is conditional on independent exact staged-byte review, canonical non-force push/readback, fresh BOOT and normal REGISTRY release/provider-clear. Protected source and runtime work then requires fresh exact complete narrow PATH/SHARED leases, manifest admission, qualified recovery and independent exact-byte release acceptance. No old mission exemption borrowed. Source worktree {PRODUCT}; branch codex/ir-interview-ready-0002-storyforge. Accepted base preserved; initial Phase1 custody bc7fad3b9739e2cb4125b4423f5c4bfcb25eafaa plus independently bounded local commits.

Permanent exclusions: no production data deletion/reset/reseed/restore, payment/purchase/provider spend, new billing/API credentials, unrelated auth/entitlement/router edits, Matrix core edit/repoint/cache/lock rewrite, StJude branding/donation incentive or Phase2 launch. Account state rollback is code-only; never roll back or transfer user state. Synthetic QA is new isolated no-course accounts without messaging, private credential custody, retained identity/history.
'''
        annex=header(ids[1]+' Interview Ready bounded execution annex','Exact IR source/runtime, self-only WP metadata contract, dedicated-only discovery guard, leases and release operations.')+'# Contract'+body+f'\n\nGoverned by {ids[0]}. Source packet SHA256 {digest(packet)}. Independent prospective review SHA256 {digest(review)}. Exact shared lineage evidence is recorded in the registration handoff below; it does not approve existing shell drift. No broader exception exists.\n'
        def write_candidate():
            (ROOT/decisions[0]).write_text(authority);(ROOT/decisions[1]).write_text(annex)
            passport=ROOT/'PRODUCT_PASSPORTS/interview-ready.md';passport.write_text(f'''# MissionMed Interview Ready

Product: Interview Ready. Active mission {MISSION}; authority {ids[0]}, {ids[1]}. Accepted existing cinematic frontend, product-owned source interview-ready/ in MissionMed HQ. Public route /interview-ready/; canonical account personal app /interview-ready/app/. Runtime owner: dedicated WordPress MU-plugin and immutable single-file runtime; existing staging CDN is historical/preserved. No new identity or enrollment.

Private owner storage: only authenticated user's _mmed_ir_state_v1 WordPress user meta, bounded canonical checklist/kit data through self-only nonce-protected state endpoint; no user-supplied owner, media or cross-account transfer. Normal WP user session determines subject. Dedicated Matrix/public navigation is discovery only and grants no sibling access. Exact guard exception limited to new addon; every shared byte/selection retained.

Current status: registered candidate; protected implementation, production release and live verification pending. No LIVE claim. Price/rating/discount claims disabled without approved current evidence. Charity message disabled. Phase2 assets/data excluded from production payload, preserved source. Three tiers Business Class, First Class, Private Jet. Preserve accepted CSS/motion and all working engine behavior.

Release gates: exact owner manifest and recovery, scoped healthy leases, independent source/security/byte acceptance, role/anonymous/no-course/A-B/browser QA and dated live readback. Rollback changes code/pointer only, never private state or canonical IDs.
''')
            mission={'id':MISSION,'title':'Interview Ready Phase1 online residency technology production release','product':'Interview Ready','owner':'brian','builder':'codex-ir-phase1-foreman','verifier':'fresh-independent-ir-contract-and-release-reviewer','state':'active','gate':f'{ids[0]}/{ids[1]}: protected implementation and independent exact-byte production acceptance pending; no LIVE claim.','worktree':str(PRODUCT),'branch':'codex/ir-interview-ready-0002-storyforge','track':'local','demo':False,'issue':None,'risk':'HIGH_PROTECTED_WORDPRESS_ACCOUNT_STATE_DISCOVERY_RELEASE','packets':[*decisions,'PRODUCT_PASSPORTS/interview-ready.md',handoff],'next_action':'Implement bounded account/runtime/discovery contract after custody and scoped lease admission; independent release gate then live role/isolation verification.','updated_at':stamp}
            p=ROOT/'missions.json';d=json.loads(p.read_text());assert not any(x['id']==MISSION for x in d['missions']);d['missions'].insert(0,mission);write_json(p,d)
            p=ROOT/'products_index.json';d=json.loads(p.read_text());assert not any(x['name']=='Interview Ready' for x in d['products']);d['products'].append({'name':'Interview Ready','status':'phase1_registered_implementation_pending_not_live','passport_path':'PRODUCT_PASSPORTS/interview-ready.md','active_mission':MISSION,'authority':ids});write_json(p,d)
            p=ROOT/'authority_index.json';d=json.loads(p.read_text())
            for i,path in enumerate(decisions): d['entries'].insert(i,{'id':f'IR_PHASE1_{ids[i].replace("-","_")}','title': ['Interview Ready Phase1 Founder production authority','Interview Ready bounded execution and dedicated-only guard contract'][i],'path':path,'level':1,'scope_tags':['interview_ready','wordpress_wrapper','auth_session','matrix_discovery','lease_v2','guarded_release'],'status':'ACTIVE_AFTER_CANONICAL_CUSTODY_INDEPENDENT_REVIEW_BOOT_AND_REGISTRY_RELEASE','filing_status':'CANONICAL_PUSH_AND_REMOTE_READBACK_REQUIRED','verification_status':'PRODUCTION_AND_LIVE_ACCEPTANCE_PENDING','external_state_controls':True,'successor':None,'ratified_by':'Brian','mission_id':MISSION,'registration_paths':paths})
            write_json(p,d)
            p=ROOT/'registry/boot_dependency_manifest.json';d=json.loads(p.read_text());d['mission_profiles'][MISSION]={'required_state':'active','authority_markers':[MISSION,*ids],'os_dependencies':[*decisions,'PRODUCT_PASSPORTS/interview-ready.md',handoff]};write_json(p,d)
            p=ROOT/handoff;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(f'# Interview Ready Phase1 registration\n\nAllocated {ids} while fenced at canonical base {txn.allocation.remote_head}. Prospective independent review follows. Production remains unapproved. Normal leases, guard/recovery and independent exact-byte acceptance remain binding. Founder directive SHA256 783a29048a0f5b17aa901a532689ec9c918841a7c055f06e2e62c04c45a8f2b7. Exact paths: '+json.dumps(paths)+'\n\n'+review.read_text()+'\n\n## Shared lineage preservation evidence\n\n'+(HANDOFF/'MATRIX_LINEAGE_REVIEW.md').read_text())
            import mmos_status
            mmos_status.ROOT=ROOT
            (ROOT/'CURRENT.md').write_text('\n'.join(mmos_status.build_current())+'\n')
            run(['python3',str(ROOT/'tools/validate_boot_dependencies.py'),'--hq-git-dir','/Users/brianb/MissionMed/.git','--os-root',str(ROOT),'--mission-profile',MISSION])
            run(['git','add','--',*paths])
        txn.run_guarded(write_candidate);txn.revalidate()
        staged={p:digest(ROOT/p) for p in paths}
        receipt={'schema':'missionmed.ir.registry.staged.v1','mission':MISSION,'root':str(ROOT),'canonicalBase':txn.allocation.remote_head,'decisionIds':ids,'paths':staged,'leaseId':txn.handle.lease_id,'fencingEpoch':txn.handle.fencing_epoch,'nonceSha256':txn.allocation.nonce_sha256}
        write_json(HANDOFF/'REGISTRY_STAGED_CANDIDATE.json',receipt)
        print('REGISTRY_STAGED_REVIEW_READY '+json.dumps({'decisionIds':ids,'receipt':str(HANDOFF/'REGISTRY_STAGED_CANDIDATE.json')}),flush=True)
        approval=HANDOFF/'REGISTRY_STAGED_APPROVAL.json';deadline=time.monotonic()+600
        while time.monotonic()<deadline:
            txn.heartbeat()
            if approval.is_file():
                a=json.loads(approval.read_text())
                if a.get('verdict')=='APPROVE' and a.get('paths')==staged and a.get('canonicalBase')==txn.allocation.remote_head and a.get('reviewer')=='phase1_registration_contract_review': break
                raise RuntimeError('staged independent approval invalid')
            time.sleep(2)
        else: raise RuntimeError('staged review deadline exceeded')
        txn.revalidate()
        def custody():
            assert {p:digest(ROOT/p) for p in paths}==staged
            changed=run(['git','diff','--cached','--name-only']).splitlines();assert sorted(changed)==paths
            run(['git','commit','-m','Register Interview Ready Phase1 bounded production authority'])
            run(['git','push','origin','main'])
            run(['git','fetch','origin'])
            local=run(['git','rev-parse','HEAD']).strip();remote=run(['git','rev-parse','origin/main']).strip();assert local==remote
            for p,h in staged.items(): assert hashlib.sha256(subprocess.check_output(['git','show','origin/main:'+p],cwd=ROOT)).hexdigest()==h
            return local
        head=txn.run_guarded(custody)
        txn.release();txn=None
        write_json(HANDOFF/'REGISTRY_CUSTODY_RECEIPT.json',{'mission':MISSION,'head':head,'decisionIds':ids,'paths':staged,'registryReleased':True,'productionLive':False,'verifiedAt':stamp})
        print('REGISTRY_CUSTODY_VERIFIED_RELEASED '+head,flush=True)
    finally:
        if txn is not None:
            try:txn.release();print('REGISTRY_RELEASED_AFTER_STOP',flush=True)
            except Exception:print('REGISTRY_RELEASE_REQUIRES_PROVIDER_READBACK',flush=True)

if __name__=='__main__':
    try: main()
    except Exception as error:
        print('REGISTRY_FAILED_CLOSED '+type(error).__name__,file=sys.stderr)
        sys.exit(1)
