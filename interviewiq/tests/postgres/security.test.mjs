// Real PostgreSQL tests: all domain queries use the non-owner runtime login.
import pg from 'pg';
import assert from 'node:assert/strict';
const {Client}=pg;
for(const key of ['IIQ_TEST_DATABASE_URL','IIQ_TEST_ADMIN_DATABASE_URL','IIQ_TEST_QUEUE_DATABASE_URL']) {
  const u=new URL(process.env[key]||'http://missing');
  if(u.pathname!=='/iiq_test'||!u.searchParams.get('host')?.startsWith('/tmp/iiq-pg18.'))throw new Error('Disposable harness database required');
}
const runtime=new Client({connectionString:process.env.IIQ_TEST_DATABASE_URL});
const adminDb=new Client({connectionString:process.env.IIQ_TEST_ADMIN_DATABASE_URL});
const queueDb=new Client({connectionString:process.env.IIQ_TEST_QUEUE_DATABASE_URL});
await Promise.all([runtime.connect(),adminDb.connect(),queueDb.connect()]);
const ids=Object.fromEntries(['a','b','m','d','ia','ib','prep','session','chunk','segment','consent','review','mission','submission','signal'].map((key,i)=>[key,`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`]));
const actors={a:{id:ids.a,wp:101,role:'student',tier:'360'},b:{id:ids.b,wp:102,role:'student',tier:'ivprep_complete'},m:{id:ids.m,wp:103,role:'mentor',tier:'assigned_mentor',assignments:[ids.a]},d:{id:ids.d,wp:104,role:'admin',tier:'admin'}};
let passed=0;
async function test(name,fn){try{await fn();passed++;console.log(`ok ${passed} - ${name}`);}catch(e){console.error(`not ok - ${name}: ${e.code||e.name} ${e.message}`);throw e;}}
async function tx(who,fn){const a=typeof who==='string'?actors[who]:who;await runtime.query('BEGIN');try{await runtime.query('SET LOCAL ROLE iiq_authenticated');if(a)await runtime.query("SELECT set_config('iiq.actor_id',$1,true),set_config('iiq.wp_user_id',$2,true),set_config('iiq.role',$3,true),set_config('iiq.tier',$4,true),set_config('iiq.assignments',$5,true)",[a.id,String(a.wp),a.role,a.tier,JSON.stringify(a.assignments||[])]);const value=await fn(runtime);await runtime.query('COMMIT');return value;}catch(e){await runtime.query('ROLLBACK');throw e;}}
const query=(who,sql,params=[])=>tx(who,c=>c.query(sql,params));
const count=async(who,table)=>Number((await query(who,`SELECT count(*) AS n FROM iiq.${table}`)).rows[0].n);
async function denied(who,sql,params=[],codes=['42501','23514','23503','23505','22P02']){await assert.rejects(query(who,sql,params),e=>codes.includes(e.code));}
try {
  await test('all 28 tables enable and force row-level security',async()=>{const {rows}=await adminDb.query("SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='iiq' AND relkind='r'");assert.equal(rows.length,28);assert.ok(rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity));});
  await test('effective student research policy is minimized and disabled without custody',async()=>{const row=(await query('a','SELECT * FROM iiq.effective_research_policy()')).rows[0];assert.deepEqual(row,{contributions:false,standard_version:null,allowed_review_modes:[]});});
  await test('runtime and internal roles have least-privilege attributes',async()=>{const {rows}=await adminDb.query("SELECT * FROM pg_roles WHERE rolname IN ('iiq_runtime_test','iiq_authenticated','iiq_worker','iiq_owner')");assert.equal(rows.length,4);assert.ok(rows.every(r=>!r.rolsuper&&!r.rolbypassrls&&!r.rolinherit&&!r.rolcreatedb&&!r.rolcreaterole));});
  await test('runtime cannot assume schema owner',()=>assert.rejects(runtime.query('SET ROLE iiq_owner'),e=>e.code==='42501'));
  await test('runtime has no implicit table permissions',()=>assert.rejects(runtime.query('SELECT * FROM iiq.interviews'),e=>e.code==='42501'));
  await test('missing claims return no private rows',async()=>assert.equal(await count(null,'interviews'),0));
  for(const key of Object.keys(actors))await test(`verified ${key} self identity inserts`,()=>query(key,'INSERT INTO iiq.actors(id,wp_user_id,display_name) VALUES($1,$2,$3)',[actors[key].id,actors[key].wp,`Synthetic ${key}`]));
  await test('actor cannot claim another WP identity',()=>denied('a','UPDATE iiq.actors SET wp_user_id=999 WHERE id=$1',[ids.a]));
  await test('admin cannot impersonate student actor row',async()=>assert.equal((await query('d','UPDATE iiq.actors SET display_name=$1 WHERE id=$2',['Wrong',ids.a])).rowCount,0));
  for(const [who,id] of [['a',ids.ia],['b',ids.ib]])await test(`student ${who} creates own logistics`,()=>query(who,'INSERT INTO iiq.interviews(id,owner_id,program_id,program_name,deadline_date,format) VALUES($1,$2,$3,$4,$5,$6)',[id,actors[who].id,'program-1','Synthetic Program','2026-11-01','phone']));
  await test('student sees own logistics only',async()=>assert.equal(await count('a','interviews'),1));
  await test('cross-student insert denied',()=>denied('a','INSERT INTO iiq.interviews(owner_id) VALUES($1)',[ids.b]));
  await test('cross-student update affects zero rows',async()=>assert.equal((await query('a','UPDATE iiq.interviews SET program_name=$1 WHERE id=$2',['Wrong',ids.ib])).rowCount,0));
  await test('record owner cannot be reassigned',()=>denied('a','UPDATE iiq.interviews SET owner_id=$1 WHERE id=$2',[ids.b,ids.ia]));
  await test('admin sees logistics for both students',async()=>assert.equal(await count('d','interviews'),2));
  await test('assigned mentor sees one student logistics',async()=>assert.equal(await count('m','interviews'),1));
  await test('unassigned mentor sees zero logistics',async()=>assert.equal(await count({...actors.m,assignments:[]},'interviews'),0));
  await test('mentor cannot update assigned logistics',async()=>assert.equal((await query('m','UPDATE iiq.interviews SET program_name=$1 WHERE id=$2',['Wrong',ids.ia])).rowCount,0));
  await test('private preparation can be saved by owner',()=>query('a','INSERT INTO iiq.preparation(id,owner_id,interview_id,why_program) VALUES($1,$2,$3,$4)',[ids.prep,ids.a,ids.ia,'PRIVATE_WHY_CANARY']));
  await test('cross-owner child reference fails',()=>denied('a','INSERT INTO iiq.preparation(owner_id,interview_id) VALUES($1,$2)',[ids.a,ids.ib]));
  await test('owner creates private debrief with deferred occurrence',()=>query('a',"INSERT INTO iiq.debriefs(owner_id,interview_id,occurrence,edited_text) VALUES($1,$2,'later','PRIVATE_DEBRIEF_CANARY')",[ids.a,ids.ia]));
  await test('owner creates recording session',()=>query('a',"INSERT INTO iiq.recording_sessions(id,owner_id,interview_id,mime_type,client_session_key) VALUES($1,$2,$3,'audio/webm','session1')",[ids.session,ids.a,ids.ia]));
  await test('chunk metadata commits before provider transcription',()=>query('a',"INSERT INTO iiq.recording_chunks(id,owner_id,interview_id,recording_session_id,sequence,client_segment_key,sha256,mime_type,byte_count,duration_ms,object_key) VALUES($1,$2,$3,$4,0,'segment1',$5,'audio/webm',2048,1000,'interviewiq/private/synthetic/audio1')",[ids.chunk,ids.a,ids.ia,ids.session,'a'.repeat(64)]));
  await test('reused chunk key cannot carry a different digest',()=>denied('a',"INSERT INTO iiq.recording_chunks(owner_id,interview_id,recording_session_id,sequence,client_segment_key,sha256,mime_type,byte_count,duration_ms,object_key) VALUES($1,$2,$3,1,'segment1',$4,'audio/webm',2048,1000,'interviewiq/private/synthetic/audio2')",[ids.a,ids.ia,ids.session,'b'.repeat(64)]));
  await test('chunk immutable digest cannot change during retry',()=>denied('a','UPDATE iiq.recording_chunks SET sha256=$1 WHERE id=$2',['b'.repeat(64),ids.chunk]));
  await test('provider retry metadata updates safely',()=>query('a',"UPDATE iiq.recording_chunks SET status='transcribing',provider_attempts=provider_attempts+1 WHERE id=$1",[ids.chunk]));
  await test('segment mismatched digest fails',()=>denied('a',"INSERT INTO iiq.speech_segments(owner_id,interview_id,recording_session_id,chunk_id,sequence,client_segment_key,transcript,sha256,provider,model) VALUES($1,$2,$3,$4,0,'segment1','BAD',$5,'synthetic','test')",[ids.a,ids.ia,ids.session,ids.chunk,'b'.repeat(64)]));
  await test('verified segment stores original raw separately',()=>query('a',"INSERT INTO iiq.speech_segments(id,owner_id,interview_id,recording_session_id,chunk_id,sequence,client_segment_key,transcript,sha256,provider,model) VALUES($1,$2,$3,$4,$5,0,'segment1','PRIVATE_RAW_CANARY',$6,'synthetic','test')",[ids.segment,ids.a,ids.ia,ids.session,ids.chunk,'a'.repeat(64)]));
  await test('duplicate segment rejected',()=>denied('a',"INSERT INTO iiq.speech_segments(owner_id,interview_id,recording_session_id,chunk_id,sequence,client_segment_key,transcript,sha256,provider,model) VALUES($1,$2,$3,$4,0,'segment1','DUPLICATE',$5,'synthetic','test')",[ids.a,ids.ia,ids.session,ids.chunk,'a'.repeat(64)]));
  for(const who of ['b','m','d'])for(const table of ['preparation','debriefs','recording_sessions','recording_chunks','speech_segments'])await test(`${who} cannot read another student's ${table}`,async()=>assert.equal(await count(who,table),0));
  await test('raw transcript has no update privilege',()=>denied('a',"UPDATE iiq.speech_segments SET transcript='REWRITE' WHERE id=$1",[ids.segment]));
  await test('raw transcript has no delete privilege',()=>denied('a','DELETE FROM iiq.speech_segments WHERE id=$1',[ids.segment]));
  await test('DST gap is rejected atomically',()=>denied('a',"UPDATE iiq.interviews SET local_date='2026-03-08',local_time='02:30',timezone='America/New_York',start_at='2026-03-08 07:30Z' WHERE id=$1",[ids.ia]));
  await test('ambiguous DST fold requires explicit choice',()=>denied('a',"UPDATE iiq.interviews SET local_date='2026-11-01',local_time='01:30',timezone='America/New_York',start_at='2026-11-01 05:30Z',fold=NULL WHERE id=$1",[ids.ia]));
  await test('earlier DST fold with exact matching instant accepted',()=>query('a',"UPDATE iiq.interviews SET local_date='2026-11-01',local_time='01:30',timezone='America/New_York',start_at='2026-11-01 05:30Z',fold=0 WHERE id=$1",[ids.ia]));
  await test('later DST fold with exact matching instant accepted',()=>query('a',"UPDATE iiq.interviews SET start_at='2026-11-01 06:30Z',fold=1 WHERE id=$1",[ids.ia]));
  await test('fold and instant mismatch rejected',()=>denied('a',"UPDATE iiq.interviews SET fold=0 WHERE id=$1",[ids.ia]));
  await test('date-only all-day event has no fabricated instant',()=>query('a',"INSERT INTO iiq.related_events(owner_id,interview_id,kind,title,note,local_date,timezone,all_day) VALUES($1,$2,'deadline','Synthetic deadline','date-only note','2026-11-02','America/New_York',true)",[ids.a,ids.ia]));
  await test('timezone database validates unknown zones',()=>denied('a',"UPDATE iiq.interviews SET timezone='Mars/Fake' WHERE id=$1",[ids.ia]));
  await test('duration requires known precision',()=>denied('a','UPDATE iiq.interviews SET duration_minutes=30 WHERE id=$1',[ids.ia]));
  await test('completion requires explicit occurred confirmation',()=>denied('a',"UPDATE iiq.interviews SET status='completed' WHERE id=$1",[ids.ia]));
  await test('row versions increment and stale update affects zero',async()=>{const before=(await query('a','SELECT version FROM iiq.interviews WHERE id=$1',[ids.ia])).rows[0].version;const r=await query('a','UPDATE iiq.interviews SET joining=$1 WHERE id=$2 AND version=$3 RETURNING version',['https://example.invalid/join',ids.ia,before]);assert.equal(Number(r.rows[0].version),Number(before)+1);assert.equal((await query('a','UPDATE iiq.interviews SET joining=$1 WHERE id=$2 AND version=$3',['stale',ids.ia,before])).rowCount,0);});
  await test('unconfirmed learning is private',async()=>{await query('a',"INSERT INTO iiq.learning_signals(id,owner_id,interview_id,source_kind,statement,mentor_visible) VALUES($1,$2,$3,'student','Slow down',true)",[ids.signal,ids.a,ids.ia]);assert.equal(await count('m','learning_signals'),0);});
  await test('explicit confirmed learning is visible to assigned mentor',async()=>{await query('a',"UPDATE iiq.learning_signals SET status='confirmed',confirmed_at=now() WHERE id=$1",[ids.signal]);assert.equal(await count('m','learning_signals'),1);assert.equal(await count('d','learning_signals'),0);});
  await test('learning revocation removes mentor visibility',async()=>{await query('a',"UPDATE iiq.learning_signals SET status='revoked',revoked_at=now() WHERE id=$1",[ids.signal]);assert.equal(await count('m','learning_signals'),0);});
  await test('assigned profiles expose only ID/display name',async()=>{const rows=(await query('m','SELECT * FROM iiq.logistics_profiles()')).rows;assert.deepEqual(rows.map(r=>r.id).sort(),[ids.a,ids.m].sort());assert.deepEqual(Object.keys(rows[0]).sort(),['display_name','id']);});
  await test('mentor own priority and in-app nudge persist',async()=>{for(const kind of ['priority','nudge'])await query('m','INSERT INTO iiq.mentor_notes(owner_id,target_student_id,kind,text) VALUES($1,$2,$3,$4)',[ids.m,ids.a,kind,'Synthetic mentor note']);assert.equal(await count('m','mentor_notes'),2);});
  await test('student receives only its own priority and nudge',async()=>{assert.equal(await count('a','mentor_notes'),2);assert.equal(await count('b','mentor_notes'),0);assert.equal(await count('d','mentor_notes'),0);});
  await test('revoked assignment removes mentor note access',async()=>assert.equal(await count({...actors.m,assignments:[]},'mentor_notes'),0));
  await test('mentor cannot nudge unassigned student',()=>denied('m',"INSERT INTO iiq.mentor_notes(owner_id,target_student_id,kind,text) VALUES($1,$2,'nudge','Wrong')",[ids.m,ids.b]));
  await test('owner logs revision and identity-only idempotency',async()=>{await query('a',"INSERT INTO iiq.revisions(owner_id,revision,reason,request_key) VALUES($1,1,'test','request1')",[ids.a]);await query('a',"INSERT INTO iiq.request_idempotency(owner_id,request_key,request_digest,result_type,result_id,result_revision) VALUES($1,'request1',$2,'interview',$3,1)",[ids.a,'a'.repeat(64),ids.ia]);});
  await test('duplicate request ID cannot replace original digest',()=>denied('a',"INSERT INTO iiq.request_idempotency(owner_id,request_key,request_digest,result_type,result_revision) VALUES($1,'request1',$2,'interview',1)",[ids.a,'b'.repeat(64)]));
  await test('audit append validates actual actor',()=>denied('a',"INSERT INTO iiq.audit_events(owner_id,actor_id,event_type,object_type) VALUES($1,$2,'test','interview')",[ids.a,ids.b]));
  await test('valid audit is immutable',async()=>{await query('a',"INSERT INTO iiq.audit_events(owner_id,actor_id,event_type,object_type) VALUES($1,$1,'test','interview')",[ids.a]);await denied('a',"UPDATE iiq.audit_events SET event_type='edited'");});
  await test('owner appends minimized outbox',()=>query('a',"INSERT INTO iiq.outbox_events(owner_id,topic,dedupe_key,payload) VALUES($1,'iiq.calendar','synthetic-calendar','{}')",[ids.a]));
  await test('owner cannot mark own queue as sent',async()=>assert.equal((await query('a',"UPDATE iiq.outbox_events SET status='sent'")).rowCount,0));
  await test('queue worker can dispatch but cannot read private content',async()=>{await queueDb.query('BEGIN');try{await queueDb.query('SET LOCAL ROLE iiq_worker');assert.equal((await queueDb.query("UPDATE iiq.outbox_events SET status='sent',attempts=1 RETURNING id")).rowCount,1);await queueDb.query('COMMIT');await assert.rejects(queueDb.query('SELECT * FROM iiq.debriefs'),e=>e.code==='42501');}finally{await queueDb.query('ROLLBACK');}});
  await test('admin has no blanket queue visibility',async()=>assert.equal(await count('d','outbox_events'),0));
  await test('private owner grants publication consent',()=>query('a',"INSERT INTO iiq.consents(id,owner_id,scope,subject_ref,status,policy_version) VALUES($1,$2,'program_intelligence',$3,'active','synthetic-policy-v1')",[ids.consent,ids.a,'review1']));
  await test('unconsented review insert denied',()=>denied('b',"INSERT INTO iiq.review_items(owner_id,interview_id,source_kind,program_id,excerpt,permitted_use,consent_id,request_key) VALUES($1,$2,'debrief','program-1','Permitted excerpt',true,$3,'cross')",[ids.b,ids.ib,ids.consent]));
  await test('unconfirmed interview cannot be shared as experience',()=>denied('a',"INSERT INTO iiq.review_items(id,owner_id,interview_id,source_kind,program_id,excerpt,permitted_use,consent_id,request_key) VALUES($1,$2,$3,'debrief','program-1','PERMITTED_EXCERPT',true,$4,'review1')",[ids.review,ids.a,ids.ia,ids.consent]));
  await query('a',"UPDATE iiq.debriefs SET occurrence='happened' WHERE interview_id=$1",[ids.ia]);
  await test('explicit excerpt enters separate review',()=>query('a',"INSERT INTO iiq.review_items(id,owner_id,interview_id,source_kind,program_id,excerpt,permitted_use,consent_id,request_key) VALUES($1,$2,$3,'debrief','program-1','PERMITTED_EXCERPT',true,$4,'review1')",[ids.review,ids.a,ids.ia,ids.consent]));
  await test('student cannot self-approve review',()=>denied('a',"UPDATE iiq.review_items SET status='approved',quality_status='approved' WHERE id=$1",[ids.review]));
  await test('admin cannot rewrite original excerpt',()=>denied('d',"UPDATE iiq.review_items SET excerpt='EDITED ORIGINAL' WHERE id=$1",[ids.review]));
  await test('pending review cannot publish',()=>denied('d','SELECT iiq.publish_report($1,$2)',[ids.review,'PUBLIC_SYNTHETIC']));
  await test('admin decides quality separately from execution',()=>query('d',"UPDATE iiq.review_items SET status='approved',quality_status='approved' WHERE id=$1",[ids.review]));
  await test('student cannot publish even approved excerpt',()=>denied('a','SELECT iiq.publish_report($1,$2)',[ids.review,'PUBLIC_SYNTHETIC']));
  await test('publication is one record per approved permitted review',async()=>{const r1=(await query('d','SELECT iiq.publish_report($1,$2) AS id',[ids.review,'PUBLIC_SYNTHETIC'])).rows[0].id;const r2=(await query('d','SELECT iiq.publish_report($1,$2) AS id',[ids.review,'PUBLIC_SYNTHETIC'])).rows[0].id;assert.equal(r1,r2);});
  await test('entitled recipient sees only public report columns',async()=>{const rows=(await query('b','SELECT * FROM iiq.published_reports')).rows;assert.equal(rows.length,1);assert.ok(!JSON.stringify(rows).includes('PRIVATE_'));assert.ok(!('review_id'in rows[0]));});
  await test('private report linkage is not granted',()=>denied('b','SELECT review_id FROM iiq.shared_reports'));
  await test('unqualified and legacy tiers cannot read deep research',async()=>{for(const tier of ['none','enrolled_360','IV_PREP_COMPLETE'])assert.equal((await query({...actors.b,tier},'SELECT * FROM iiq.published_reports')).rowCount,0);});
  await test('owner consent revocation retracts derived report immediately',async()=>{await query('a',"UPDATE iiq.consents SET status='revoked',revoked_at=now() WHERE id=$1",[ids.consent]);assert.equal((await query('b','SELECT * FROM iiq.published_reports')).rowCount,0);assert.equal((await query('a','SELECT status FROM iiq.review_items WHERE id=$1',[ids.review])).rows[0].status,'withdrawn');assert.equal(await count('a','speech_segments'),1);assert.equal(await count('a','debriefs'),1);});
  await test('revoked consent cannot be republished',()=>denied('d','SELECT iiq.publish_report($1,$2)',[ids.review,'PUBLIC_SYNTHETIC']));
  await test('research mission has public-only package',()=>query('a',"INSERT INTO iiq.research_missions(id,owner_id,program_id,standard_version,public_payload) VALUES($1,$2,'program-1','synthetic-v1','{}')",[ids.mission,ids.a]));
  await test('original research submission is immutable',async()=>{await query('a',"INSERT INTO iiq.research_submissions(id,owner_id,mission_id,original_object_key,sha256) VALUES($1,$2,$3,'interviewiq/private/synthetic/research1',$4)",[ids.submission,ids.a,ids.mission,'a'.repeat(64)]);await denied('a',"UPDATE iiq.research_submissions SET parsed_package='{}' WHERE id=$1",[ids.submission]);});
  await test('research repair appends with same-owner parent',()=>query('a',"INSERT INTO iiq.research_submissions(owner_id,mission_id,repair_parent_id,original_object_key,sha256) VALUES($1,$2,$3,'interviewiq/private/synthetic/research2',$4)",[ids.a,ids.mission,ids.submission,'b'.repeat(64)]));
  await test('duplicate research upload digest is rejected',()=>denied('a',"INSERT INTO iiq.research_submissions(owner_id,mission_id,original_object_key,sha256) VALUES($1,$2,'interviewiq/private/synthetic/research3',$3)",[ids.a,ids.mission,'a'.repeat(64)]));
  // Deliberately synthetic policy fixture. No approved commercial policy is shipped.
  const syntheticPolicy={contributions:true,contributionPolicy:{authorityRef:'TEST_ONLY_NOT_COMMERCIAL',executionCreditUnits:1,programAccessSeconds:3600}};
  const researchConsent='00000000-0000-4000-8000-000000000050',researchReview='00000000-0000-4000-8000-000000000051';
  await test('research contribution starts with separate pending decisions',async()=>{await query('a',"INSERT INTO iiq.consents(id,owner_id,scope,subject_ref,status,policy_version) VALUES($1,$2,'research_contribution','research-review','active','TEST_ONLY_V1')",[researchConsent,ids.a]);await query('a',"INSERT INTO iiq.review_items(id,owner_id,submission_id,source_kind,program_id,excerpt,permitted_use,consent_id,request_key) VALUES($1,$2,$3,'research','program-1','PUBLIC_RESEARCH',true,$4,'research-review')",[researchReview,ids.a,ids.submission,researchConsent]);});
  await test('credit denied when actual policy is absent',()=>denied('d',"INSERT INTO iiq.contribution_credits(owner_id,review_id,kind,units,policy_version) VALUES($1,$2,'grant',1,'TEST_ONLY_V1')",[ids.a,researchReview]));
  await test('arbitrary admin policy authority string does not authorize credit',async()=>{await query('d',"INSERT INTO iiq.policies(policy_key,value,policy_version) VALUES('research',$1,'TEST_ONLY_V1')",[syntheticPolicy]);await denied('d',"INSERT INTO iiq.contribution_credits(owner_id,review_id,kind,units,policy_version) VALUES($1,$2,'grant',1,'TEST_ONLY_V1')",[ids.a,researchReview]);});
  await test('runtime admin cannot mint actual policy custody',()=>denied('d',"INSERT INTO iiq.policy_authorities(authority_ref,policy_version,approved_policy,source_sha256,approved_by,approved_at) VALUES('TEST_ONLY_NOT_COMMERCIAL','TEST_ONLY_V1',$1,$2,'test',now())",[syntheticPolicy,'c'.repeat(64)]));
  await test('synthetic-only privileged test custody is installed explicitly',()=>adminDb.query("INSERT INTO iiq.policy_authorities(authority_ref,policy_version,approved_policy,source_sha256,approved_by,approved_at) VALUES('TEST_ONLY_NOT_COMMERCIAL','TEST_ONLY_V1',$1,$2,'SYNTHETIC_TEST_NOT_APPROVAL',now())",[syntheticPolicy,'c'.repeat(64)]));
  await test('effective filed policy never exposes terms or approval records to student',async()=>{const row=(await query('a','SELECT * FROM iiq.effective_research_policy()')).rows[0];assert.deepEqual(row,{contributions:true,standard_version:'TEST_ONLY_V1',allowed_review_modes:[]});});
  await test('policy alone cannot skip execution or quality review',()=>denied('d',"INSERT INTO iiq.contribution_credits(owner_id,review_id,kind,units,policy_version) VALUES($1,$2,'grant',1,'TEST_ONLY_V1')",[ids.a,researchReview]));
  await test('unverified execution cannot earn credit after quality approval',async()=>{await query('d',"UPDATE iiq.review_items SET status='approved',quality_status='approved' WHERE id=$1",[researchReview]);await denied('d',"INSERT INTO iiq.contribution_credits(owner_id,review_id,kind,units,policy_version) VALUES($1,$2,'grant',1,'TEST_ONLY_V1')",[ids.a,researchReview]);});
  await test('verified execution and accepted quality permit separately decided credit',async()=>{await query('d',"UPDATE iiq.review_items SET execution_status='verified' WHERE id=$1",[researchReview]);await query('d',"INSERT INTO iiq.contribution_credits(owner_id,review_id,kind,units,policy_version) VALUES($1,$2,'grant',1,'TEST_ONLY_V1')",[ids.a,researchReview]);});
  await test('repeat credit for same review is denied',()=>denied('d',"INSERT INTO iiq.contribution_credits(owner_id,review_id,kind,units,policy_version) VALUES($1,$2,'grant',1,'TEST_ONLY_V1')",[ids.a,researchReview]));
  await test('repair review cannot mint a second logical mission credit',async()=>{
   const repair=(await query('a','SELECT id FROM iiq.research_submissions WHERE repair_parent_id=$1',[ids.submission])).rows[0].id;
   const consent=(await query('a',"INSERT INTO iiq.consents(owner_id,scope,subject_ref,status,policy_version) VALUES($1,'research_contribution','research-repair','active','TEST_ONLY_V1') RETURNING id",[ids.a])).rows[0].id;
   const review=(await query('a',"INSERT INTO iiq.review_items(owner_id,submission_id,source_kind,program_id,excerpt,permitted_use,consent_id,request_key) VALUES($1,$2,'research','program-1','REPAIR_PUBLIC',true,$3,'research-repair') RETURNING id",[ids.a,repair,consent])).rows[0].id;
   await query('d',"UPDATE iiq.review_items SET status='approved',quality_status='approved',execution_status='verified' WHERE id=$1",[review]);
   await denied('d',"INSERT INTO iiq.contribution_credits(owner_id,review_id,kind,units,policy_version) VALUES($1,$2,'grant',1,'TEST_ONLY_V1')",[ids.a,review]);
  });
  await test('access grant cannot invent seven-day terms',()=>denied('d',"INSERT INTO iiq.access_grants(owner_id,program_id,review_id,policy_version,starts_at,expires_at) VALUES($1,'program-1',$2,'TEST_ONLY_V1',now(),now()+interval '7 days')",[ids.a,researchReview]));
  await test('access grant is limited to approved program and actual fixture duration',()=>query('d',"INSERT INTO iiq.access_grants(owner_id,program_id,review_id,policy_version,starts_at,expires_at) VALUES($1,'program-1',$2,'TEST_ONLY_V1',now(),now()+interval '1 hour')",[ids.a,researchReview]));
  await test('grant cannot be extended by direct update',()=>denied('d',"UPDATE iiq.access_grants SET expires_at=expires_at+interval '1 hour' WHERE review_id=$1",[researchReview]));
  await test('contribution grants cover only current approved policy and same program',async()=>{assert.equal((await query({...actors.a,tier:'none'},"SELECT iiq.deep_research_allowed('program-1') AS allowed")).rows[0].allowed,true);assert.equal((await query({...actors.a,tier:'none'},"SELECT iiq.deep_research_allowed('program-other') AS allowed")).rows[0].allowed,false);});
  const initialGrant=(await query('d','SELECT * FROM iiq.access_grants WHERE review_id=$1',[researchReview])).rows[0];
  let researchReport;
  await test('research publication exists before adversarial quality downgrade',async()=>{researchReport=(await query('d','SELECT iiq.publish_report($1,$2) AS id',[researchReview,'PUBLIC_RESEARCH'])).rows[0].id;assert.equal((await query('b','SELECT * FROM iiq.published_reports WHERE id=$1',[researchReport])).rowCount,1);});
  await test('read-time review prerequisites deny stale projection/grant even when propagation is disabled in a rolled-back drift probe',async()=>{
   await adminDb.query('BEGIN');
   try{
    await adminDb.query("SELECT set_config('iiq.actor_id',$1,true),set_config('iiq.wp_user_id',$2,true),set_config('iiq.role','admin',true),set_config('iiq.tier','admin',true)",[ids.d,'104']);
    await adminDb.query('ALTER TABLE iiq.review_items DISABLE TRIGGER retract_review');
    await adminDb.query("UPDATE iiq.review_items SET quality_status='repair_requested' WHERE id=$1",[researchReview]);
    assert.equal((await adminDb.query('SELECT status FROM iiq.shared_reports WHERE id=$1',[researchReport])).rows[0].status,'published');
    assert.equal((await adminDb.query('SELECT suspended_at FROM iiq.access_grants WHERE id=$1',[initialGrant.id])).rows[0].suspended_at,null);
    await adminDb.query('SET LOCAL ROLE iiq_authenticated');
    await adminDb.query("SELECT set_config('iiq.actor_id',$1,true),set_config('iiq.wp_user_id','102',true),set_config('iiq.role','student',true),set_config('iiq.tier','ivprep_complete',true)",[ids.b]);
    assert.equal((await adminDb.query('SELECT * FROM iiq.published_reports WHERE id=$1',[researchReport])).rowCount,0);
    await adminDb.query("SELECT set_config('iiq.actor_id',$1,true),set_config('iiq.wp_user_id','101',true),set_config('iiq.tier','none',true)",[ids.a]);
    assert.equal((await adminDb.query("SELECT iiq.deep_research_allowed('program-1') AS allowed")).rows[0].allowed,false);
   }finally{await adminDb.query('ROLLBACK');}
  });
  await test('direct quality-only repair downgrade normalizes decisions and removes recipient visibility and tier-none access atomically',async()=>{
   await query('d',"UPDATE iiq.review_items SET quality_status='repair_requested' WHERE id=$1",[researchReview]);
   const row=(await query('a','SELECT * FROM iiq.review_items WHERE id=$1',[researchReview])).rows[0];
   assert.equal(row.status,'repair_requested');assert.equal(row.quality_status,'repair_requested');assert.equal(row.publication_status,'retracted');assert.equal(row.credit_status,'suspended');
   assert.equal((await query('b','SELECT * FROM iiq.published_reports WHERE id=$1',[researchReport])).rowCount,0);
   assert.equal((await query({...actors.a,tier:'none'},"SELECT iiq.deep_research_allowed('program-1') AS allowed")).rows[0].allowed,false);
   assert.ok((await query('a','SELECT suspended_at FROM iiq.access_grants WHERE id=$1',[initialGrant.id])).rows[0].suspended_at);
   assert.equal((await query('a',"SELECT * FROM iiq.contribution_credits WHERE review_id=$1 AND kind='revoke'",[researchReview])).rowCount,0);
   assert.equal((await query('a','SELECT original_object_key FROM iiq.research_submissions WHERE id=$1',[ids.submission])).rows[0].original_object_key,'interviewiq/private/synthetic/research1');
  });
  await test('direct grant restoration while repair is unapproved is denied',()=>denied('d','UPDATE iiq.access_grants SET suspended_at=null WHERE id=$1',[initialGrant.id]));
  await test('reapproval does not automatically restore access or publication',async()=>{
   await query('d',"UPDATE iiq.review_items SET status='approved',quality_status='approved' WHERE id=$1",[researchReview]);
   assert.equal((await query({...actors.a,tier:'none'},"SELECT iiq.deep_research_allowed('program-1') AS allowed")).rows[0].allowed,false);
   assert.equal((await query('b','SELECT * FROM iiq.published_reports WHERE id=$1',[researchReport])).rowCount,0);
  });
  await test('explicit restoration reuses exact grant window and explicit republish reuses report identity',async()=>{
   await query('d','UPDATE iiq.access_grants SET suspended_at=null WHERE id=$1',[initialGrant.id]);
   const restored=(await query('a','SELECT * FROM iiq.access_grants WHERE id=$1',[initialGrant.id])).rows[0];
   assert.equal(restored.starts_at.getTime(),initialGrant.starts_at.getTime());assert.equal(restored.expires_at.getTime(),initialGrant.expires_at.getTime());
   assert.equal((await query({...actors.a,tier:'none'},"SELECT iiq.deep_research_allowed('program-1') AS allowed")).rows[0].allowed,true);
   assert.equal((await query('d','SELECT iiq.publish_report($1,$2) AS id',[researchReview,'PUBLIC_RESEARCH'])).rows[0].id,researchReport);
   assert.equal((await query('b','SELECT * FROM iiq.published_reports WHERE id=$1',[researchReport])).rowCount,1);
  });
  await test('loss of verified execution suspends only contribution eligibility until explicit restoration',async()=>{
   await query('d',"UPDATE iiq.review_items SET execution_status='unverified' WHERE id=$1",[researchReview]);
   assert.equal((await query({...actors.a,tier:'none'},"SELECT iiq.deep_research_allowed('program-1') AS allowed")).rows[0].allowed,false);
   assert.equal((await query('b','SELECT * FROM iiq.published_reports WHERE id=$1',[researchReport])).rowCount,1);
   await query('d',"UPDATE iiq.review_items SET execution_status='verified' WHERE id=$1",[researchReview]);
   assert.equal((await query({...actors.a,tier:'none'},"SELECT iiq.deep_research_allowed('program-1') AS allowed")).rows[0].allowed,false);
   await query('d','UPDATE iiq.access_grants SET suspended_at=null WHERE id=$1',[initialGrant.id]);
  });
  await test('direct status-only pending downgrade also retracts and suspends',async()=>{
   await query('d',"UPDATE iiq.review_items SET status='pending' WHERE id=$1",[researchReview]);
   const row=(await query('a','SELECT * FROM iiq.review_items WHERE id=$1',[researchReview])).rows[0];assert.equal(row.quality_status,'pending');assert.equal(row.credit_status,'suspended');assert.equal(row.publication_status,'retracted');
   assert.equal((await query('b','SELECT * FROM iiq.published_reports WHERE id=$1',[researchReport])).rowCount,0);
   await query('d',"UPDATE iiq.review_items SET status='approved',quality_status='approved' WHERE id=$1",[researchReview]);
   await query('d','UPDATE iiq.access_grants SET suspended_at=null WHERE id=$1',[initialGrant.id]);
  });
  await test('policy shutdown immediately removes contribution access',async()=>{await query('d',"UPDATE iiq.policies SET value=jsonb_set(value,'{contributions}','false') WHERE policy_key='research'");assert.equal((await query({...actors.a,tier:'none'},"SELECT iiq.deep_research_allowed('program-1') AS allowed")).rows[0].allowed,false);await query('d',"UPDATE iiq.policies SET value=$1 WHERE policy_key='research'",[syntheticPolicy]);});
  await test('consent revocation revokes credit and grant atomically',async()=>{await query('a',"UPDATE iiq.consents SET status='revoked',revoked_at=now() WHERE id=$1",[researchConsent]);assert.equal((await query('a',"SELECT * FROM iiq.contribution_credits WHERE review_id=$1 AND kind='revoke'",[researchReview])).rowCount,1);assert.ok((await query('a','SELECT revoked_at FROM iiq.access_grants WHERE review_id=$1',[researchReview])).rows[0].revoked_at);assert.equal((await query({...actors.a,tier:'none'},"SELECT iiq.deep_research_allowed('program-1') AS allowed")).rows[0].allowed,false);});
  await test('retracted contribution cannot be reinstated by direct update',()=>denied('d','UPDATE iiq.access_grants SET revoked_at=null WHERE review_id=$1',[researchReview]));
  await test('malformed actor claims fail closed',()=>denied({...actors.a,id:'not-a-uuid'},'SELECT * FROM iiq.interviews'));
  await test('transaction-local identity cannot leak to next request',async()=>assert.equal(await count(null,'preparation'),0));
  await test('DDL and TRUNCATE are denied to runtime',async()=>{await denied('a','TRUNCATE iiq.interviews');await denied('a','ALTER TABLE iiq.interviews ADD COLUMN bypass text');});
  await test('PUBLIC cannot execute identity/publication helpers',async()=>{const {rows}=await adminDb.query("SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE n.nspname='iiq' AND a.grantee=0 AND a.privilege_type='EXECUTE'");assert.equal(rows.length,0);});
  console.log(`PASS ${passed} real PostgreSQL security/constraint assertions; synthetic only.`);
} finally {await Promise.all([runtime.end(),adminDb.end(),queueDb.end()]);}
