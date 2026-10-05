#!/usr/bin/env python3
"""Local PostgreSQL rehearsal of sealed Phase0C; never connects to production.
All real-account payloads and PG files stay in a supplied private evidence directory.
"""
import argparse, json, os, subprocess, tempfile, hashlib
from pathlib import Path
os.umask(0o077)
parser=argparse.ArgumentParser();parser.add_argument('--evidence-dir',required=True);parser.add_argument('--sealed-dir',required=True);parser.add_argument('--phase0b-dir',required=True)
a=parser.parse_args();out=Path(a.evidence_dir).resolve();out.mkdir(exist_ok=True);os.chmod(out,0o700)
app=Path(__file__).resolve().parents[1];pg=Path(tempfile.mkdtemp(prefix='pg-',dir=out));port='55447'
def run(args,input=None):
 r=subprocess.run(args,input=input,capture_output=True,text=True,timeout=120)
 if r.returncode:
  # Store diagnostics privately, never print the real payload or provider references.
  (out/'rehearsal-error.log').write_text(r.stdout+r.stderr);raise RuntimeError('LOCAL_REHEARSAL_FAILED; private diagnostics: '+str(out/'rehearsal-error.log'))
 return r.stdout.strip()
def sql(query):return run(['psql','-X','-h',str(pg),'-p',port,'-d','postgres','-Atq','-v','ON_ERROR_STOP=1'],query)
def literal(value):return "'"+value.replace("'","''")+"'"
started=False
try:
 run(['initdb','-D',str(pg/'data'),'--no-locale','--encoding=UTF8','--auth=trust'])
 run(['pg_ctl','-D',str(pg/'data'),'-l',str(out/'postgres.log'),'-o',f"-F -p {port} -k {pg} -c listen_addresses=''",'-w','start']);started=True
 sql("create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create function auth.uid() returns uuid language sql stable as 'select null::uuid'; create function auth.jwt() returns jsonb language sql stable as 'select jsonb_build_object()';")
 for migration in sorted((app/'supabase/migrations').glob('*.sql')):
  # Retired source-only Partner candidate is superseded by its applied forward foundation.
  if migration.name in ('20260909105200_promote_antonio_real_student.sql','20261004213308_partner_cost_sharing_private_ledger.sql'):continue
  run(['psql','-X','-h',str(pg),'-p',port,'-d','postgres','-q','-v','ON_ERROR_STOP=1','-f',str(migration)])
 code="import {loadSealedBundle} from "+json.dumps((app/'src/mission-residency-finance/phase0c-import.mjs').as_uri())+";const b=await loadSealedBundle(JSON.parse(process.argv[1]));process.stdout.write(JSON.stringify(b));"
 bundle=run(['node','--input-type=module','-e',code,json.dumps({'ledgerPath':str(Path(a.sealed_dir)/'certified-ledger.json'),'evidencePath':str(Path(a.sealed_dir)/'certification-evidence.json'),'crosswalkPath':str(Path(a.phase0b_dir)/'active-reconstruction.json')})])
 (out/'staging-bundle.json').write_text(bundle+'\n')
 sql("insert into missionaccounts.financial_principal(actor_id,authority_ref,capabilities,stage_bundle_digest) values('phase1-local-rehearsal','DR-379',array['read','stage','settle'],encode(extensions.digest("+literal(bundle)+"::jsonb::text,'sha256'),'hex'));")
 call="set role service_role;select missionaccounts.api_stage_certified_financial_bundle('phase1-local-rehearsal',"+literal(bundle)+"::jsonb)->>'duplicate';"
 first=sql(call);second=sql(call)
 if first!='false' or second!='true':raise RuntimeError('IMPORT_IDEMPOTENCY_FAILED')
 run(['psql','-X','-h',str(pg),'-p',port,'-d','postgres','-q','-v','ON_ERROR_STOP=1','-f',str(app/'tests/mission-residency-finance.sql')])
 b=json.loads(bundle)
 artifact=sql("select id from missionaccounts.source_artifact where source_kind='match360_phase0c';")
 p={**b['payments'][0],'artifact_id':artifact,'agreement_version':b['version']}
 exact="set role service_role;select missionaccounts.api_record_verified_financial_payment('phase1-local-rehearsal',"+literal(json.dumps(p))+"::jsonb)->>'duplicate';"
 if sql(exact)!='true':raise RuntimeError('PAYMENT_EXACT_REPLAY_FAILED')
 # Same provider identity with changed beneficiary/request is never accepted.
 for provider in ('Chase','Stripe'):
  old=next(x for x in b['payments'] if x['provider']==provider)
  changed={**old,'artifact_id':artifact,'agreement_version':b['version'],'subject_key':next(x['subject_key'] for x in b['certified'] if x['subject_key']!=old['subject_key']),'request_id':old['request_id']+':replay'}
  command="select missionaccounts.api_record_verified_financial_payment('phase1-local-rehearsal',"+literal(json.dumps(changed))+"::jsonb)"
  # Separate connection has no pg_temp helper: use a transaction/exception block.
  sql("do $test$ begin begin "+command+"; exception when others then return; end; raise exception 'PROVIDER_REPLAY_ACCEPTED'; end $test$;")
 # Namespace and receiving-account tampering cannot bypass global receipt ownership.
 old=next(x for x in b['payments'] if x['provider']=='Chase')
 changed={**old,'artifact_id':artifact,'agreement_version':b['version'],'provider_account':'different-account','request_id':'namespace-tamper','evidence':[{'type':'FAKE','reference':'fake','fingerprint':'e'*64,'metadata':{}}]}
 command="select missionaccounts.api_record_verified_financial_payment('phase1-local-rehearsal',"+literal(json.dumps(changed))+"::jsonb)"
 sql("do $test$ begin begin "+command+"; exception when others then return; end; raise exception 'NAMESPACE_TAMPER_ACCEPTED'; end $test$;")
 changed_bundle={**b,'byte_count':b['byte_count']+1}
 command="select missionaccounts.api_stage_certified_financial_bundle('phase1-local-rehearsal',"+literal(json.dumps(changed_bundle))+"::jsonb)"
 sql("do $test$ begin begin "+command+"; exception when others then return; end; raise exception 'IMPORT_REPLAY_ACCEPTED'; end $test$;")
 totals=json.loads(sql("select jsonb_build_object('certified',count(*),'paid_in_full',count(*) filter(where balance_cents=0),'balance_accounts',count(*) filter(where balance_cents>0),'tuition_cents',sum(accepted_tuition_cents),'fees_cents',sum(accepted_fees_cents),'balance_cents',sum(balance_cents),'applied_cents',(select sum(amount_cents) from missionaccounts.financial_payment_application),'credit_cents',(select sum(credit_cents) from missionaccounts.financial_unapplied_credit),'held',(select count(*) from missionaccounts.financial_reconciliation_case),'payments',(select count(*) from missionaccounts.financial_payment),'student_visible',false,'dispatch',false) from missionaccounts.financial_balance;"))
 expected={'certified':11,'paid_in_full':9,'balance_accounts':2,'tuition_cents':4548900,'fees_cents':37247,'balance_cents':302401,'applied_cents':4283746,'credit_cents':200,'held':6,'payments':21,'student_visible':False,'dispatch':False}
 if totals!=expected:raise RuntimeError('CANONICAL_TOTALS_MISMATCH')
 result={'status':'PASS','canonical_totals':totals,'import_replay':'PASS','provider_replays':'PASS','schema_rls_negative_tests':'PASS','bundle_sha256':hashlib.sha256(bundle.encode()).hexdigest(),'local_only':True,'production_writes':0}
 (out/'rehearsal.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
finally:
 if started:subprocess.run(['pg_ctl','-D',str(pg/'data'),'-m','fast','-w','stop'],capture_output=True)
