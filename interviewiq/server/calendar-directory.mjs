import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import {readOwnerSession} from './owner-session.mjs';
import {UUID} from './auth.mjs';
import {requireValue,AppError} from './errors.mjs';
import {requireCalendar,admissionProof,admittedTarget,bindCalendar} from './calendar-admission.mjs';
const strict=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
export function requireAdminCalendar(config,actor){requireCalendar(config,actor);requireValue(actor.role==='admin'&&actor.tier==='admin','admin_required','Use your current administrator workspace.',403);}
export function directoryQuery(input){
 requireValue(input&&Object.keys(input).every(k=>['after','q','tier'].includes(k)),'invalid_query','Choose a student search.',400);
 const after=input.after??'0',q=input.q??'',tier=input.tier??'all';
 requireValue(typeof after==='string'&&/^(0|[1-9][0-9]{0,15})$/.test(after)&&Number.isSafeInteger(Number(after))&&typeof q==='string'&&q.length<=120&&!/[\x00-\x1f\x7f]/.test(q)&&['all','360','ivprep_complete'].includes(tier),'invalid_query','Choose a valid student name and tier.',400);
 return {kind:'roster',after:Number(after),q,tier};
}
export function createCalendarDirectory(config,{fetchImpl=globalThis.fetch,now=Date.now}={}){
 return async function directory(actor,query,action){
  requireAdminCalendar(config,actor);const session=readOwnerSession(actor,now());
  const fail=()=>{throw new AppError(503,'calendar_directory_unavailable','The current student roster could not be verified. Retry; your own Calendar remains available.');};
  if(!session)fail();let url;try{url=new URL(config.ownerIntrospectionUrl);if(url.protocol!=='https:'||url.origin!==config.jwtIssuer||url.username||url.password||url.search||url.hash)fail();url.pathname='/wp-json/missionmed-interviewiq/v1/calendar-directory';}catch{fail();}
  const input={audience:'interviewiq-calendar-directory-v1',subject:actor.id,wp_user_id:actor.wpUserId,session_verifier:session.verifier,nonce:randomUUID(),iat:Math.floor(now()/1000),action,query},body=JSON.stringify(input);let outer;
  try{const r=await fetchImpl(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),headers:{'Content-Type':'application/json','X-MMED-IIQ-Proof':admissionProof(config.ownerProofSecret,'mmiiq-directory-request-v1',body)},body});if(r.status!==200||!/^application\/json(?:;|$)/i.test(r.headers.get('content-type')||''))fail();let size=0,chunks=[];for await(const b of r.body){size+=b.length;if(size>131072)fail();chunks.push(b);}outer=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}catch{fail();}
  if(!strict(outer,['payload','signature'])||typeof outer.payload!=='string'||!/^[a-f0-9]{64}$/.test(outer.signature||'')||!timingSafeEqual(Buffer.from(admissionProof(config.ownerProofSecret,'mmiiq-directory-response-v1',outer.payload)),Buffer.from(outer.signature)))fail();
  let p;try{p=JSON.parse(outer.payload);}catch{fail();}const t=Math.floor(now()/1000);
  if(!strict(p,['audience','subject','wp_user_id','nonce','request_sha256','action','allowed','role','tier','students','nextAfter','iat','exp'])||p.audience!==input.audience||p.subject!==actor.id||p.wp_user_id!==actor.wpUserId||p.nonce!==input.nonce||p.request_sha256!==createHash('sha256').update(body).digest('hex')||p.action!==action||p.allowed!==true||p.role!=='admin'||p.tier!=='admin'||!Number.isSafeInteger(p.iat)||!Number.isSafeInteger(p.exp)||p.iat>t+3||p.iat<t-30||p.exp<=t||p.exp>p.iat+30||!Array.isArray(p.students)||p.students.length>200)fail();
  const ids=new Set(),subjects=new Set();for(const s of p.students){if(!strict(s,['wpUserId','name','tier','subject','mappingStatus'])||!Number.isSafeInteger(s.wpUserId)||s.wpUserId<1||ids.has(s.wpUserId)||typeof s.name!=='string'||s.name.length>500||!['360','ivprep_complete'].includes(s.tier)||!['ready','unmapped','conflict'].includes(s.mappingStatus)||s.mappingStatus==='ready'&&(!UUID.test(s.subject)||subjects.has(s.subject))||s.mappingStatus!=='ready'&&s.subject!==null)fail();ids.add(s.wpUserId);if(s.subject)subjects.add(s.subject);}
  if(query.kind==='roster'){if(p.students.some(s=>s.wpUserId<=query.after||query.tier!=='all'&&s.tier!==query.tier)||(p.nextAfter!==null&&(!Number.isSafeInteger(p.nextAfter)||p.nextAfter<=query.after||p.students.some(s=>s.wpUserId>p.nextAfter))))fail();}
  else if(query.kind==='owners'){if(action!=='GET /api/calendar/overview'||p.nextAfter!==null||p.students.some(s=>s.mappingStatus==='ready'&&!query.subjects.includes(s.subject)))fail();}
  else if(p.nextAfter!==null||p.students.some(s=>!query.ids.includes(s.wpUserId)))fail();
  const result=Object.freeze({students:Object.freeze(p.students.map(s=>Object.freeze({...s}))),nextAfter:p.nextAfter});directoryReceipts.set(result,{actor,action,expiresAt:p.exp*1000});return result;
 };
}
const directoryReceipts=new WeakMap();
const date=x=>x instanceof Date?x.toISOString().slice(0,10):x||null;
const iso=x=>x instanceof Date?x.toISOString():x||null;
export function calendarLogistics(records,related,students){
 const names=new Map(students.map(s=>[s.subject,s.name]));
 return records.map(r=>({id:r.id,owner:r.owner_id,saved:true,program:r.program_id,programName:r.program_name||r.unresolved_input||'Program to confirm',track:r.program_track||'',specialty:'',state:r.status,disposition:['cancelled','declined','no_show','postponed','waitlisted'].includes(r.status)?r.status:null,date:date(r.local_date),wall:r.local_date&&r.local_time?date(r.local_date)+'T'+r.local_time:null,zone:r.timezone,instant:iso(r.start_at),fold:r.fold,format:r.format,deadline:date(r.deadline_date),studentName:names.get(r.owner_id)||'',related:related.filter(e=>e.interview_id===r.id&&e.owner_id===r.owner_id).map(e=>({id:e.id,kind:e.kind,date:date(e.local_date),wall:e.local_date&&e.local_time?date(e.local_date)+'T'+e.local_time:null,zone:e.timezone,instant:iso(e.start_at),fold:e.fold,status:e.status,duration_minutes:e.duration_minutes}))}));
}
async function readSchedules(ctx,students,action,directoryReceipt=null){
 const {actor,admit,database}=ctx;const pairs=students.filter(s=>s.mappingStatus==='ready').map(s=>({subject:s.subject,wp_user_id:s.wpUserId}));
 requireValue(!students.some(s=>s.mappingStatus==='conflict'),'calendar_mapping_conflict','A student identity needs reconciliation; the schedule was not loaded.',409);
 let targets=[];
 if(directoryReceipt){const proof=directoryReceipts.get(directoryReceipt);requireValue(action==='GET /api/calendar/overview'&&proof?.actor===actor&&proof.action===action&&proof.expiresAt>Date.now()&&readOwnerSession(actor,Date.now())&&directoryReceipt.students===students,'calendar_directory_unavailable','Current schedule access could not be verified.',503);}
 else{const grant=await admit(actor,pairs,action);requireValue(grant.pairs.every(p=>p.allowed),'calendar_admission_changed','Student eligibility changed. Reload the roster.',409);targets=pairs.map(p=>admittedTarget(actor,p,grant));}
 const result=await database.withActor(actor,async db=>{await db.query('SET TRANSACTION READ ONLY');await bindCalendar(db,actor,targets.length===1?targets[0]:null);
  const ids=pairs.map(p=>p.subject),records=(await db.query('SELECT id,owner_id,program_id,program_name,unresolved_input,program_track,status,local_date,local_time,timezone,start_at,fold,format,deadline_date FROM iiq.interviews WHERE owner_id=ANY($1::uuid[]) ORDER BY local_date NULLS LAST,id LIMIT 2001',[ids])).rows;
  requireValue(records.length<=2000,'calendar_schedule_too_large','This schedule needs a smaller scope; no records were hidden.',422);
  const related=(await db.query('SELECT id,owner_id,interview_id,kind,local_date,local_time,timezone,start_at,fold,status,duration_minutes FROM iiq.related_events WHERE owner_id=ANY($1::uuid[]) ORDER BY local_date NULLS LAST,id LIMIT 10001',[ids])).rows;
  requireValue(related.length<=10000,'calendar_schedule_too_large','This schedule needs a smaller scope; no records were hidden.',422);return calendarLogistics(records,related,students);
 });
 if(!directoryReceipt){const final=await admit(actor,pairs,action);requireValue(final.pairs.every(p=>p.allowed),'calendar_admission_changed','Student eligibility changed. Reload the roster.',409);}return result;
}
export async function readCalendarRoster(ctx,input){requireAdminCalendar(ctx.config,ctx.actor);return ctx.directory(ctx.actor,directoryQuery(input),'GET /api/calendar/roster');}
export async function readCalendarStudent(ctx,wpId){
 requireAdminCalendar(ctx.config,ctx.actor);requireValue(/^[1-9][0-9]{0,15}$/.test(wpId)&&Number.isSafeInteger(Number(wpId)),'calendar_student','Choose a current student.',400);const action='GET /api/calendar/student/'+wpId,query={kind:'subjects',ids:[Number(wpId)]};
 const r=await ctx.directory(ctx.actor,query,action),student=r.students.find(s=>s.wpUserId===Number(wpId));requireValue(student,'calendar_target_denied','This student is not currently eligible.',403);
 const interviews=await readSchedules(ctx,[student],action);const final=await ctx.directory(ctx.actor,query,action);requireValue(JSON.stringify(final.students)===JSON.stringify(r.students),'calendar_admission_changed','Student eligibility or identity changed. Reload the roster.',409);
 return {student,interviews,mappingStatus:student.mappingStatus,readOnly:true};
}
export async function readCalendarOverview(ctx,input){
 requireAdminCalendar(ctx.config,ctx.actor);const {start,end,...query}=input;requireValue(/^\d{4}-\d{2}-\d{2}$/.test(start||'')&&/^\d{4}-\d{2}-\d{2}$/.test(end||'')&&Number.isFinite(Date.parse(start))&&new Date(start).toISOString().slice(0,10)===start&&Number.isFinite(Date.parse(end))&&new Date(end).toISOString().slice(0,10)===end&&Date.parse(end)>=Date.parse(start)&&Date.parse(end)-Date.parse(start)<90*86400000,'calendar_range','Choose a bounded Calendar month.',400);
 requireValue(Object.keys(query).every(k=>k==='after')&&(query.after==null||UUID.test(query.after)),'invalid_query','Choose a valid Calendar page.',400);
 const action='GET /api/calendar/overview',owners=await ctx.database.withActor(ctx.actor,async db=>{await db.query('SET TRANSACTION READ ONLY');return(await db.query('SELECT DISTINCT owner_id FROM iiq.interviews WHERE ($1::uuid IS NULL OR owner_id>$1::uuid) ORDER BY owner_id LIMIT 201',[query.after||null])).rows;});
 const page=owners.slice(0,200),q={kind:'owners',subjects:page.map(x=>x.owner_id)},r=await ctx.directory(ctx.actor,q,action),interviews=await readSchedules(ctx,r.students,action,r),final=await ctx.directory(ctx.actor,q,action);
 const nextAfter=owners.length>200?page.at(-1).owner_id:null;
 requireValue(JSON.stringify(final)===JSON.stringify(r),'calendar_admission_changed','Student eligibility or identity changed. Reload this month.',409);
 return {interviews:interviews.filter(i=>!i.date||i.date>=start&&i.date<=end||i.related.some(e=>e.date>=start&&e.date<=end)),start,end,nextAfter,unmapped:0,readOnly:true};
}
