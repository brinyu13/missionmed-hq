#!/usr/bin/env python3
"""Local PostgreSQL rehearsal of sealed Phase0C; never connects to production.
All real-account payloads and PG files stay in a supplied private evidence directory.
"""
import argparse, json, os, subprocess, tempfile, hashlib
from pathlib import Path
os.umask(0o077)
parser=argparse.ArgumentParser();parser.add_argument('--evidence-dir',required=True);parser.add_argument('--sealed-dir',required=True);parser.add_argument('--phase0b-dir',required=True)
a=parser.parse_args();out=Path(a.evidence_dir).resolve();out.mkdir(exist_ok=True);os.chmod(out,0o700)
app=Path(__file__).resolve().parents[1];pg=Path(tempfile.mkdtemp(prefix='pg-',dir=out));port='55448'
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
 bundle=(Path(a.sealed_dir)/'staging-bundle.json').read_text().strip()
 if hashlib.sha256(bundle.encode()).hexdigest()!='998517efc6d1df33712ff15320f7261173b1ecb57eefef3726a76c86d0cb6da6':raise RuntimeError('SEALED_BUNDLE_DRIFT')
 sql("insert into missionaccounts.financial_principal(actor_id,authority_ref,capabilities,stage_bundle_digest) values('phase1-local-rehearsal','DR-379',array['read','stage','settle'],encode(extensions.digest("+literal(bundle)+"::jsonb::text,'sha256'),'hex'));")
 sql("set role service_role;select missionaccounts.api_stage_certified_financial_bundle('phase1-local-rehearsal',"+literal(bundle)+"::jsonb);")
 ledger_bytes=(Path(a.phase0b_dir)/'certified-ledger.json').read_bytes();digest=hashlib.sha256(ledger_bytes).hexdigest()
 if digest!='2f27f12314d43f7f36834164ff210b4f208697c7f64458d7aaa2ce0696121006':raise RuntimeError('DISPLAY_DRIFT')
 for student in json.loads(ledger_bytes)['students']:
  sql("insert into missionaccounts.financial_display_directory values("+','.join(literal(x) for x in ['match360:'+student['student_key'],student['student'],student['program'],digest,'DR-384'])+");")
 sql("insert into missionaccounts.financial_principal(actor_id,authority_ref,capabilities) values('fixture-founder-read','DR-384',array['read']);insert into missionaccounts.financial_read_binding values('00000000-0000-4000-8000-000000000001',1,'fixture-founder-read','DR-384',true);")
 run(['psql','-X','-h',str(pg),'-p',port,'-d','postgres','-q','-v','ON_ERROR_STOP=1','-f',str(app/'tests/mission-residency-finance-admin.sql')])
 snapshot=json.loads(sql("set role service_role;select missionaccounts.api_read_financial_command('00000000-0000-4000-8000-000000000001',1);"))
 (out/'snapshot.json').write_text(json.dumps(snapshot)+'\n')
 code="import {financialCommandProjection} from "+json.dumps((app/'src/mission-residency-finance/read-model.mjs').as_uri())+";import{readFileSync}from'node:fs';process.stdout.write(JSON.stringify(financialCommandProjection(JSON.parse(readFileSync(process.argv[1])))));"
 projection=json.loads(run(['node','--input-type=module','-e',code,str(out/'snapshot.json')]))
 (out/'projection.json').write_text(json.dumps(projection)+'\n');totals=projection['summary']
 expected={'certified':11,'paid_in_full':9,'balance_remaining':2,'held':6,'tuition_cents':4548900,'fees_cents':37247,'balance_cents':302401,'applied_cents':4283746,'credit_cents':200}
 if totals!=expected:raise RuntimeError('PROJECTION_TOTALS_MISMATCH')
 result={'status':'PASS','canonical_totals':totals,'explicit_read_authorization':'PASS','rls_negative_tests':'PASS','local_only':True,'production_writes':0}
 (out/'rehearsal.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
finally:
 if started:subprocess.run(['pg_ctl','-D',str(pg/'data'),'-m','fast','-w','stop'],capture_output=True)
