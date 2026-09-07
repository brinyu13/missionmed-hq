#!/usr/bin/env python3
"""Timeline-only release operator. No secret values are written to local files.

seal: local immutable API upload; inspect: provider read-only; operate: separately
reviewed exact plan, explicit execution, disabled admission and fresh backups.
After activation the process stays alive for root's RETAIN or ROLLBACK command.
"""
import argparse, hashlib, json, os, re, resource, secrets, select, shlex, subprocess, sys, time, urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, quote
sys.dont_write_bytecode=True
resource.setrlimit(resource.RLIMIT_CORE,(0,0))
PACKAGE=Path(__file__).resolve().parents[1]
REPOSITORY=PACKAGE.parents[1]
OUT=REPOSITORY/'_AI_HANDOFFS/from_codex/D1-TIMELINE-STORYFORGE-LIVE-022'
TARGET={'projectId':'295b3d56-f555-4851-91f4-eb32d7dc88e1','environmentId':'d0705d67-83d5-4b53-942d-3862d9906529','serviceId':'12bfaf69-f883-42b5-a380-b6beea49f251'}
PG_SERVICE='134e537e-d48b-4452-acf6-8c3af2ce03db'
BASE_DEPLOYMENT='5e6e90d2-dd32-4096-93d8-40bc0b8612b5'
BASE_IMAGE='sha256:395391c5ab9bc140c78f31659b5f1bd712883552e1db3ca1170e11c48be7f746'
BASE_RELEASE='timeline-fdfd27cc3c86b279'
TICKET_SHA='e27016edef2f722f1424a16d7246e5e1851d266b7825d832f7bbf62e84ec147c'
LOGIN='timeline_api_login_022'
HEALTH='https://mission-timeline-api-production.up.railway.app/healthz'
PATCH_NAMES=['DATABASE_URL','TIMELINE_DATABASE_RUNTIME_ROLE','TIMELINE_RELEASE_VERSION','TIMELINE_AI_PROVIDER','TIMELINE_AI_CONSENT_VERSION','TIMELINE_AI_PROCESSING_MODE','TIMELINE_AI_SYNTHETIC_PRINCIPAL_IDS']
# This dictionary is NEVER serialized. It keeps rollback custody alive even after
# an uncertain provider response or a lease loss during an operation.
RECOVERY_MEMORY={}

class Denied(Exception):pass
def need(value,code):
    if not value:raise Denied(code)
def digest(data):return hashlib.sha256(data).hexdigest()
def stamp():return datetime.now(timezone.utc).isoformat()
def json_bytes(value):return (json.dumps(value,sort_keys=True,indent=2)+'\n').encode()
def execute(args,*,data=None,cwd=None,timeout=60):
    try:r=subprocess.run(args,input=data,stdout=subprocess.PIPE,stderr=subprocess.PIPE,cwd=cwd,timeout=timeout)
    except Exception:raise Denied('OPERATOR_TRANSPORT_FAILED') from None
    need(r.returncode==0,'OPERATOR_COMMAND_FAILED_PRIVATE_OUTPUT_SUPPRESSED')
    return r.stdout
def guard(names=('timeline','wordpress','evidence')):
    for name in names:
        d=json.loads(Path('/private/tmp/d1-022-coordination-20260907',name+'.status.json').read_text())
        age=time.time()-d['observed_at']
        need(d['state']=='READY' and 0<=age<12 and datetime.fromisoformat(d['receipt']['expires_at'].replace('Z','+00:00')).timestamp()>time.time(),'LEASE_NOT_CURRENT_'+name)
def evidence_path(value):
    p=Path(value)
    need(p.is_absolute() and p.resolve().is_relative_to(OUT.resolve()) and not p.is_symlink(),'EVIDENCE_PATH_DENIED')
    return p
def save_new(path,value):
    guard(('evidence',));p=evidence_path(path);p.parent.mkdir(parents=True,exist_ok=True)
    fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'wb') as stream:stream.write(json_bytes(value))
def checked_file(binding):
    p=evidence_path(binding['path']);raw=p.read_bytes()
    need(digest(raw)==binding['sha256'],'EVIDENCE_BINDING_CHANGED')
    return json.loads(raw)
def clean_source():
    need(not execute(['git','status','--porcelain=v1','--untracked-files=all','--','packages/mission-timeline','wp-content/plugins/missionmed-timeline-sso'],cwd=REPOSITORY).strip(),'SOURCE_NOT_CLEAN')
    return execute(['git','rev-parse','HEAD'],cwd=REPOSITORY).decode().strip()
def api(query,variables=None):
    # GraphQL variable values may contain credentials: private stdin only.
    data=json.dumps(variables or {}).encode()
    value=json.loads(execute(['railway','api',query,'--variables','@-','--compact'],data=data,timeout=45))
    need(not value.get('errors'),'PROVIDER_QUERY_FAILED_PRIVATE_OUTPUT_SUPPRESSED')
    return value.get('data',value)
def variables(unrendered):
    q='query($projectId:String!,$environmentId:String!,$serviceId:String!,$unrendered:Boolean!){variables(projectId:$projectId,environmentId:$environmentId,serviceId:$serviceId,unrendered:$unrendered)}'
    result=api(q,{**TARGET,'unrendered':unrendered})['variables']
    need(isinstance(result,dict),'PROVIDER_VARIABLE_SHAPE_DENIED');return result
def deployments():
    rows=json.loads(execute(['railway','deployment','list','--project',TARGET['projectId'],'--environment',TARGET['environmentId'],'--service',TARGET['serviceId'],'--limit','10','--json']))
    need(isinstance(rows,list),'DEPLOYMENT_LIST_DENIED');return rows
def inspect_provider():
    d=api('query($id:String!){deployment(id:$id){id projectId serviceId environmentId status canRollback canRedeploy}}',{'id':BASE_DEPLOYMENT})['deployment']
    need(all(d[k]==v for k,v in TARGET.items()) and d['status']=='SUCCESS' and d['canRollback'],'BASE_DEPLOYMENT_DENIED')
    latest=deployments()[0]
    need(latest['id']==BASE_DEPLOYMENT and latest['meta']['imageDigest']==BASE_IMAGE,'CURRENT_DEPLOYMENT_CHANGED')
    return {**d,'image_digest':BASE_IMAGE}
def database(action,**fields):
    source=(PACKAGE/'scripts/railway-database-022.mjs').read_text()
    command='ulimit -c 0; node --input-type=module -e '+shlex.quote(source)
    result=json.loads(execute(['railway','ssh','--project',TARGET['projectId'],'--environment',TARGET['environmentId'],'--service',TARGET['serviceId'],command],data=json.dumps({'action':action,**fields}).encode(),timeout=100))
    return result
def postgres_identity():
    sql="select json_build_object('database',current_database(),'system_identifier',(select system_identifier::text from pg_control_system()),'schema_version',timeline.schema_version());"
    command='PGPASSWORD="$POSTGRES_PASSWORD" psql -X -A -t -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '+shlex.quote(sql)
    return json.loads(execute(['railway','ssh','--project',TARGET['projectId'],'--environment',TARGET['environmentId'],'--service',PG_SERVICE,command]))
def replacement_url(old,password):
    p=urlsplit(old)
    need(p.scheme in ('postgres','postgresql') and p.username=='postgres' and p.hostname and p.hostname.endswith('.railway.internal') and p.path=='/railway','DATABASE_URL_IDENTITY_DENIED')
    # Preserve exact internal host/port, path and query; replace only user/password.
    host=p.netloc.rsplit('@',1)[-1]
    return urlunsplit((p.scheme,LOGIN+':'+quote(password,safe='')+'@'+host,p.path,p.query,p.fragment))
def seal(receipt):
    guard();head=clean_source()
    for script in ['typecheck','build:api','check:api-only']:
        execute(['npm','run',script],cwd=PACKAGE,timeout=180)
    manifest=json.loads((PACKAGE/'dist/release-manifest.json').read_text())
    need(manifest['mode']=='release' and manifest['source_commit']==head,'STATIC_RELEASE_NOT_SEALED')
    config=json.loads((PACKAGE/'railway.json').read_text())
    # Upload the exact locally verified API bundle; never upload the repository,
    # private artifacts, web assets, tests, migrations, or unrelated applications.
    config['build']['buildCommand']='npm ci --omit=dev --ignore-scripts'
    config['deploy']['startCommand']='node dist-api/server.mjs'
    files={'package.json':(PACKAGE/'package.json').read_bytes(),'package-lock.json':(PACKAGE/'package-lock.json').read_bytes(),'dist-api/server.mjs':(PACKAGE/'dist-api/server.mjs').read_bytes(),'railway.json':json_bytes(config)}
    entries={name:{'sha256':digest(raw),'bytes':len(raw)} for name,raw in sorted(files.items())}
    # A frontend-only successor may have identical API bytes; its release seal
    # still belongs to the exact new source commit and must not overwrite the old one.
    seal_id='timeline-api-022-'+digest(json_bytes({'source_commit':head,'files':entries}))[:20]
    directory=OUT/'release-candidates'/seal_id
    need(not directory.exists(),'SEALED_CANDIDATE_ALREADY_EXISTS')
    guard();directory.mkdir(parents=True,mode=0o700)
    for name,raw in files.items():
        p=directory/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(raw);p.chmod(0o400)
    record={'schema_version':'d1-022-sealed-api.1','status':'SEALED','created_at':stamp(),'source_commit':head,'release_version':manifest['release_id'],'candidate_directory':str(directory),'candidate_id':seal_id,'target':TARGET,'files':entries,'source_railway_config_sha256':digest((PACKAGE/'railway.json').read_bytes()),'derived_config_changes':['build.buildCommand','deploy.startCommand']}
    save_new(receipt,record)
    return record
def verify_seal(binding):
    sealed=checked_file(binding);need(sealed.get('schema_version')=='d1-022-sealed-api.1' and sealed.get('status')=='SEALED' and sealed['target']==TARGET,'API_SEAL_DENIED')
    head=clean_source();need(sealed['source_commit']==head,'SEALED_SOURCE_COMMIT_CHANGED')
    directory=evidence_path(sealed['candidate_directory'])
    actual={str(p.relative_to(directory)) for p in directory.rglob('*') if p.is_file()}
    need(actual==set(sealed['files']) and actual=={'package.json','package-lock.json','dist-api/server.mjs','railway.json'},'API_UPLOAD_SET_DENIED')
    for name,entry in sealed['files'].items():
        p=directory/name;raw=p.read_bytes()
        need(not p.is_symlink() and len(raw)==entry['bytes'] and digest(raw)==entry['sha256'],'API_UPLOAD_BYTES_CHANGED')
    need(digest((PACKAGE/'dist-api/server.mjs').read_bytes())==sealed['files']['dist-api/server.mjs']['sha256'],'LOCAL_API_BUNDLE_CHANGED')
    return sealed
def verify_plan(plan,plan_sha):
    need(plan.get('schema_version')=='d1-022-api-operation-plan.1' and plan.get('authority_sha256')==TICKET_SHA and plan.get('target')==TARGET and plan.get('postgres_service_id')==PG_SERVICE,'PLAN_SCOPE_DENIED')
    need(plan.get('expected_deployment_id')==BASE_DEPLOYMENT and plan.get('processing_mode')=='synthetic_only' and plan.get('synthetic_principal_ids')==[] and plan.get('consent_version')=='d1-022-ai-v1','PLAN_CONFIG_DENIED')
    review=checked_file(plan['root_review'])
    need(review.get('status')=='REVIEWED_FOR_CANARY_PREPARATION' and review.get('plan_core_sha256')==plan_sha and review.get('authority_sha256')==TICKET_SHA,'CURRENT_ROOT_REVIEW_REQUIRED')
    need(0<=time.time()-datetime.fromisoformat(review['reviewed_at'].replace('Z','+00:00')).timestamp()<900,'ROOT_REVIEW_STALE')
    backup=checked_file(plan['postgres_backup'])
    need(backup.get('verdict')=='PASS' and backup['production_project']==TARGET['projectId'] and backup['production_environment']==TARGET['environmentId'] and backup['production_service']==PG_SERVICE and backup['local_cluster_stopped'] and backup['invalid_constraints']==0 and backup['archive_table_counts']==backup['restored_table_counts'],'RESTORE_BOUNDARY_DENIED')
    need(0<=time.time()-datetime.fromisoformat(backup['started_at']).timestamp()<14400,'BACKUP_STALE')
    archive=Path(backup['private_directory'])/'timeline-pre-022.dump'
    need(archive.resolve().is_relative_to(Path('/Users/brianb/MissionMed_private_backups/D1-022').resolve()) and not archive.is_symlink() and digest(archive.read_bytes())==backup['archive_sha256'],'PRIVATE_ARCHIVE_CHANGED')
    need(plan.get('application_admission_disabled') is True,'ADMISSION_DISABLE_GATE_REQUIRED')
    sealed=verify_seal(plan['sealed_api'])
    need(sealed['source_commit']==review.get('source_commit'),'REVIEW_SOURCE_MISMATCH')
    return sealed
def admission_off():
    # Query only the boolean. Never print or copy the settings/credential option.
    php="require '/www/theresidencyacademy_209/public/wp-load.php';$s=get_option('missionmed_timeline_settings',false);echo json_encode(['exists'=>is_array($s)&&array_key_exists('timeline_enabled',$s)&&array_key_exists('rollout_stage',$s),'enabled'=>!empty($s['timeline_enabled']),'stage'=>$s['rollout_stage']??null]);"
    response=json.loads(execute(['ssh','-o','BatchMode=yes','missionmed-kinsta','php -r '+shlex.quote(php)]))
    need(response.get('exists') is True and response.get('enabled') is False and response.get('stage')=='off','LIVE_ADMISSION_NOT_DISABLED')
def patch_variables(values):
    need(set(values)==set(PATCH_NAMES),'VARIABLE_WRITE_SET_DENIED');guard()
    result=api('mutation($input:VariableCollectionUpsertInput!){variableCollectionUpsert(input:$input)}',{'input':{**TARGET,'replace':False,'skipDeploys':True,'variables':values}})
    need(result.get('variableCollectionUpsert') is True,'VARIABLE_PATCH_NOT_CONFIRMED')
def health(expected):
    with urllib.request.urlopen(HEALTH,timeout=12) as response:body=json.loads(response.read(20000));code=response.status
    need(code==200 and body.get('ok') is True and body.get('service')=='mission-timeline' and body.get('schemaVersion')=='d1-timeline-db-500.1' and body.get('releaseVersion',body.get('version'))==expected,'HEALTH_VERSION_DENIED')
    return body
def rollback(base_variables):
    guard();admission_off()
    # Railway restores this deployment's image AND custom variable snapshot.
    result=api('mutation($id:String!){deploymentRollback(id:$id)}',{'id':BASE_DEPLOYMENT})
    need(result.get('deploymentRollback') is True,'ROLLBACK_NOT_ACCEPTED')
    deadline=time.monotonic()+240
    while time.monotonic()<deadline:
        guard();rows=deployments();current=rows[0]
        if current['status']=='SUCCESS' and current.get('meta',{}).get('imageDigest')==BASE_IMAGE:
            restored=variables(True)
            need(restored==base_variables,'ROLLBACK_VARIABLE_READBACK_MISMATCH')
            health(BASE_RELEASE)
            return {'status':'ROLLED_BACK','deployment_id':current['id'],'image_digest':BASE_IMAGE,'exact_previous_variables_restored':True,'additive_database_objects_preserved':True}
        time.sleep(5)
    raise Denied('ROLLBACK_READBACK_TIMEOUT')
def operate(plan,receipt,explicit):
    need(explicit,'EXPLICIT_EXECUTION_REQUIRED');guard()
    core={k:v for k,v in plan.items() if k!='root_review'}
    sealed=verify_plan(plan,digest(json_bytes(core)));inspect_provider();admission_off()
    baseline=database('inspect')['baseline']
    need(baseline['database']=='railway' and baseline['schema_version']=='d1-timeline-db-500.1' and baseline['operator']=='postgres' and baseline['new_tables_absent'] and baseline['issuer_absent'] and baseline['login_absent'] and baseline['admin_workflow_absent'] and baseline['bookkeeping_tables']==[],'DATABASE_BASELINE_CHANGED')
    identity=postgres_identity()
    need(identity==plan.get('schema_identity') and all(baseline[k]==v for k,v in identity.items()),'DATABASE_CLUSTER_IDENTITY_CHANGED')
    raw_variables=variables(True);rendered=variables(False)
    need(rendered.get('TIMELINE_AI_PROVIDER')=='openai' and rendered.get('TIMELINE_AI_MODEL')==plan['preserved_ai_model'] and bool(rendered.get('TIMELINE_AI_API_KEY')),'AI_PROVIDER_BINDING_CHANGED')
    password=secrets.token_urlsafe(48)
    new_url=replacement_url(rendered['DATABASE_URL'],password)
    changed={**{name:rendered.get(name,'') for name in PATCH_NAMES},'DATABASE_URL':new_url,'TIMELINE_DATABASE_RUNTIME_ROLE':'timeline_authenticated','TIMELINE_RELEASE_VERSION':sealed['release_version'],'TIMELINE_AI_PROVIDER':'openai','TIMELINE_AI_CONSENT_VERSION':'d1-022-ai-v1','TIMELINE_AI_PROCESSING_MODE':'synthetic_only','TIMELINE_AI_SYNTHETIC_PRINCIPAL_IDS':''}
    migration_entries=[]
    for binding in plan['migrations']:
        need(re.fullmatch(r'2026090701[123]000_d1_022_[a-z_]+\.sql',binding['name']),'MIGRATION_NAME_DENIED')
        raw=(PACKAGE/'database/migrations'/binding['name']).read_bytes();need(digest(raw)==binding['sha256'],'MIGRATION_PLAN_CHANGED');migration_entries.append({'name':binding['name'],'sql':raw.decode()})
    operation_id=secrets.token_hex(8)
    ledger=evidence_path(receipt).with_name('MIGRATION_OPERATION_'+operation_id+'_STARTED.json')
    save_new(ledger,{'status':'STARTED_NOT_COMMITTED','observed_at':stamp(),'operation_id':operation_id,'plan_core_sha256':digest(json_bytes(core)),'target':TARGET,'source_commit':sealed['source_commit'],'baseline':baseline,'migrations':plan['migrations'],'login_name':LOGIN,'secrets_persisted':False})
    RECOVERY_MEMORY.update(base_variables=raw_variables,operation_id=operation_id,receipt=receipt)
    guard();db_result=database('apply',password=password,replacementUrl=new_url,migrations=migration_entries,expectedSystemIdentifier=identity['system_identifier'])
    save_new(ledger.with_name('MIGRATION_OPERATION_'+operation_id+'_COMMITTED.json'),{'status':'COMMITTED_AND_RESTRICTED_LOGIN_VERIFIED','observed_at':stamp(),'operation_id':operation_id,'result':db_result})
    password=None
    need(variables(True)==raw_variables,'VARIABLES_CHANGED_BEFORE_PATCH');inspect_provider();admission_off();guard()
    patch_variables(changed)
    expected={**raw_variables,**changed}
    need(variables(True)==expected,'VARIABLE_PATCH_READBACK_MISMATCH')
    save_new(evidence_path(receipt).with_name('API_CONFIG_'+operation_id+'_PATCHED.json'),{'status':'PATCHED_DEPLOYMENT_SUPPRESSED','observed_at':stamp(),'operation_id':operation_id,'variable_names':PATCH_NAMES,'preserved_model':plan['preserved_ai_model'],'processing_mode':'synthetic_only','synthetic_principal_count':0,'secret_values_persisted':False})
    guard();verify_seal(plan['sealed_api']);message='D1-022 '+sealed['candidate_id']+' '+sealed['source_commit']
    # All CLI output remains in memory; build logs can contain private provider data.
    execute(['railway','up',sealed['candidate_directory'],'--path-as-root','--project',TARGET['projectId'],'--environment',TARGET['environmentId'],'--service',TARGET['serviceId'],'--detach','--json','--message',message],timeout=180)
    save_new(evidence_path(receipt).with_name('API_UPLOAD_'+operation_id+'_ACCEPTED.json'),{'status':'UPLOAD_ACCEPTED_NOT_HEALTHY','operation_id':operation_id,'observed_at':stamp(),'candidate_id':sealed['candidate_id'],'source_commit':sealed['source_commit']})
    print(json.dumps({'state':'DEPLOYING','operation_id':operation_id}),flush=True)
    deadline=time.monotonic()+900;current=None
    while time.monotonic()<deadline:
        guard();rows=deployments();matching=[x for x in rows if x.get('meta',{}).get('cliMessage')==message]
        need(len(matching)<=1,'DEPLOYMENT_IDENTITY_AMBIGUOUS')
        if matching:
            current=matching[0]
            if current['status'] in ['FAILED','CRASHED','REMOVED']:break
            if current['status']=='SUCCESS':
                health(sealed['release_version']);break
        time.sleep(5)
    success=bool(current and current['status']=='SUCCESS')
    result={'status':'API_HEALTHY_AWAITING_ROOT_RETAIN' if success else 'API_NOT_HEALTHY_AWAITING_ROOT_ROLLBACK','observed_at':stamp(),'operation_id':operation_id,'source_commit':sealed['source_commit'],'release_version':sealed['release_version'],'deployment_id':current['id'] if current else None,'image_digest':current.get('meta',{}).get('imageDigest') if current else None,'admission_enabled':False,'canary_certified':False,'operator_holds_rollback_values_only_in_memory':True}
    save_new(receipt,result);print(json.dumps(result),flush=True)
    # Root finishes activation/readback while this process holds the exact prior
    # values. RETAIN precedes any separately reviewed canary configuration changes.
    # The retained provider snapshot remains the later rollback route.
    while True:
        ready,_,_=select.select([sys.stdin],[],[],5)
        if not ready:continue
        command=sys.stdin.readline().strip()
        if command=='RETAIN' and success:
            guard();need(variables(True)==expected,'VARIABLES_CHANGED_BEFORE_RETAIN');health(sealed['release_version'])
            save_new(evidence_path(receipt).with_name('API_OPERATION_'+operation_id+'_RETAINED.json'),{'status':'RETAINED_BY_RELEASE_CAPTAIN','observed_at':stamp(),'operation_id':operation_id,'deployment_id':current['id'],'canary_certified':False,'later_rollback':'Fresh authenticated deploymentRollback of exact retained baseline; additive database retained'})
            print(json.dumps({'status':'RETAINED','operation_id':operation_id}),flush=True);return
        if command=='ROLLBACK':
            result=rollback(raw_variables);save_new(evidence_path(receipt).with_name('API_OPERATION_'+operation_id+'_ROLLBACK.json'),result);print(json.dumps(result),flush=True);return
        if not command:raise Denied('OPERATOR_INPUT_CLOSED_PROVIDER_BASELINE_ROLLBACK_REMAINS_AVAILABLE')
        print(json.dumps({'status':'COMMAND_DENIED','allowed':['RETAIN','ROLLBACK']}),flush=True)
def recovery_wait(reason):
    # No automatic provider mutation after uncertainty. Root may restore the exact
    # provider snapshot once leases and disabled admission are freshly confirmed.
    print(json.dumps({'status':'OPERATOR_HELD_FOR_RECONCILIATION','reason':reason,'operation_id':RECOVERY_MEMORY['operation_id'],'rollback_values':'PROCESS_MEMORY_ONLY','command':'ROLLBACK'}),flush=True)
    while True:
        ready,_,_=select.select([sys.stdin],[],[],5)
        if not ready:continue
        command=sys.stdin.readline().strip()
        if not command:
            print(json.dumps({'status':'INPUT_CLOSED','later_rollback':'Fresh authenticated baseline deploymentRollback remains available'}),flush=True);return
        if command!='ROLLBACK':
            print(json.dumps({'status':'COMMAND_DENIED','allowed':['ROLLBACK']}),flush=True);continue
        try:
            result=rollback(RECOVERY_MEMORY['base_variables'])
            save_new(evidence_path(RECOVERY_MEMORY['receipt']).with_name('API_OPERATION_'+RECOVERY_MEMORY['operation_id']+'_RECOVERED.json'),result)
            print(json.dumps(result),flush=True);return
        except BaseException:print(json.dumps({'status':'ROLLBACK_NOT_VERIFIED_PROCESS_STILL_HELD','secret_values_emitted':False}),flush=True)
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--action',choices=['inspect','seal','operate'],required=True);parser.add_argument('--plan');parser.add_argument('--receipt',required=True);parser.add_argument('--execute',action='store_true');args=parser.parse_args()
    receipt=evidence_path(args.receipt);need(not receipt.exists(),'RECEIPT_EXISTS')
    if args.action=='seal':result=seal(receipt)
    elif args.action=='inspect':
        guard(('evidence',));result={'status':'READ_ONLY','observed_at':stamp(),'provider':inspect_provider(),'database':database('inspect'),'postgres_service_identity':postgres_identity()}
        need(all(result['database']['baseline'][k]==v for k,v in result['postgres_service_identity'].items()),'API_DATABASE_SERVICE_IDENTITY_MISMATCH');save_new(receipt,result)
    else:
        need(args.plan is not None,'PLAN_REQUIRED');operate(json.loads(Path(args.plan).read_text()),receipt,args.execute);return
    print(json.dumps({'status':result['status'],'receipt':str(receipt)}))
if __name__=='__main__':
    try:main()
    except BaseException as error:
        reason=str(error) if isinstance(error,Denied) else 'PRIVATE_DIAGNOSTICS_SUPPRESSED'
        if RECOVERY_MEMORY:recovery_wait(reason)
        else:print(json.dumps({'status':'STOPPED','reason':reason,'secret_values_emitted':False}),file=sys.stderr)
        sys.exit(1)
