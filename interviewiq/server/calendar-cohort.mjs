import {createHmac,timingSafeEqual} from 'node:crypto';
import {validDate} from './time.mjs';
import {requireValue} from './errors.mjs';
import {calendarEnabled,requireCalendar,bindCalendar} from './calendar-admission.mjs';
const date=x=>x instanceof Date?x.toISOString().slice(0,10):x;
export function cohortRange(input){requireValue(input&&Object.keys(input).every(k=>['start','end','cursor'].includes(k))&&validDate(input.start)&&validDate(input.end),'calendar_range','Choose valid Calendar dates.');const days=(Date.parse(input.end)-Date.parse(input.start))/86400000;requireValue(days>=0&&days<90,'calendar_range','Choose a Calendar range of up to 90 days.');return {start:input.start,end:input.end,cursor:input.cursor||null};}
function mac(config,t){return createHmac('sha256',config.ownerProofSecret).update('iiq-cohort-cursor-v1\n'+t).digest('hex');}
function decodeCursor(config,actor,range){if(!range.cursor)return[null,null];requireValue(typeof range.cursor==='string'&&range.cursor.length<=1024,'calendar_cursor','This Calendar page expired.');try{const [b,s,...extra]=range.cursor.split('.'),text=Buffer.from(b,'base64url').toString(),p=JSON.parse(text);requireValue(extra.length===0&&/^[a-f0-9]{64}$/.test(s)&&timingSafeEqual(Buffer.from(mac(config,text)),Buffer.from(s))&&p.actor===actor.id&&p.start===range.start&&p.end===range.end&&validDate(p.day)&&/^[a-f0-9-]{36}$/.test(p.ref),'calendar_cursor','This Calendar page expired.');return[p.day,p.ref];}catch{requireValue(false,'calendar_cursor','This Calendar page expired.');}}
export async function readCohort({database,actor,config,admit,input}){
 requireCalendar(config,actor);const r=cohortRange(input),[day,ref]=decodeCursor(config,actor,r);await admit(actor,[],'GET /api/calendar/cohort');
 const candidates=await database.withActor(actor,async db=>{await db.query('SET TRANSACTION READ ONLY');await bindCalendar(db,actor);return(await db.query('SELECT * FROM iiq.calendar_candidates($1,$2,$3,$4,NULL)',[r.start,r.end,day,ref])).rows;});
 const pairs=[...new Map(candidates.map(x=>[x.owner_id,{subject:x.owner_id,wp_user_id:Number(x.wp_user_id)}])).values()];const grant=await admit(actor,pairs,'GET /api/calendar/cohort'),allowed=grant.pairs.filter(p=>p.allowed).map(({subject,wp_user_id})=>({subject,wp_user_id}));
 // Revalidate all pairs immediately before publish; no positive grant cache.
 const rows=await database.withActor(actor,async db=>{await db.query('SET TRANSACTION READ ONLY');await bindCalendar(db,actor);return(await db.query('SELECT * FROM iiq.calendar_public($1,$2,$3,$4,$5::jsonb)',[r.start,r.end,day,ref,JSON.stringify(allowed)])).rows;});
 const final=await admit(actor,pairs,'GET /api/calendar/cohort');requireValue(final.pairs.every((p,i)=>p.allowed===grant.pairs[i].allowed),'calendar_admission_changed','Calendar eligibility changed. Reload this page.',409);
 const keys=['event_ref','program_id','program_name','specialty','track','local_date','local_time','timezone','start_at','fold','all_day','format','event_type','lifecycle'];const events=rows.map(row=>Object.fromEntries(keys.map(k=>[k,row[k] instanceof Date?row[k].toISOString():row[k]])));const last=candidates.at(-1);let cursor=null;if(candidates.length===200&&last){const text=JSON.stringify({actor:actor.id,start:r.start,end:r.end,day:date(last.local_date),ref:last.event_ref});cursor=Buffer.from(text).toString('base64url')+'.'+mac(config,text);}return{events,start:r.start,end:r.end,nextCursor:cursor,deidentified:true};
}
export async function syncCalendarProjection({db,actor,config,owners,interviewId,target=null}){
 if(!calendarEnabled(config,actor))return;const owner=target?.ownerId||actor.id,wp=target?.wpUserId||actor.wpUserId;
 const row=(await db.query('SELECT * FROM iiq.interviews WHERE owner_id=$1 AND id=$2',[owner,interviewId])).rows[0];if(!row)return;
 let p=null;if(row.program_id)try{p=await owners.getProgram(actor,row.program_id);}catch{}
 await db.query('UPDATE iiq.calendar_projection SET visible=false WHERE owner_id=$1 AND interview_id=$2',[owner,row.id]);
 if(!p||p.id!==row.program_id||typeof p.name!=='string'||!p.name||p.name.length>500)return;
 const events=(await db.query('SELECT * FROM iiq.related_events WHERE owner_id=$1 AND interview_id=$2',[owner,row.id])).rows;
 for(const e of [row,...events]){if(!e.local_date)continue;const own=e.id===row.id,status=own?row.status:e.status==='cancelled'?'cancelled':row.status==='cancelled'||row.status==='declined'||row.status==='no_show'?row.status:'scheduled';
 await db.query(`INSERT INTO iiq.calendar_projection(owner_id,wp_user_id,interview_id,source_event_id,event_type,program_id,program_name,specialty,track,local_date,local_time,timezone,start_at,fold,all_day,format,lifecycle,visible)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,true)
 ON CONFLICT(owner_id,interview_id,source_event_id) DO UPDATE SET program_id=EXCLUDED.program_id,program_name=EXCLUDED.program_name,specialty=EXCLUDED.specialty,track=EXCLUDED.track,local_date=EXCLUDED.local_date,local_time=EXCLUDED.local_time,timezone=EXCLUDED.timezone,start_at=EXCLUDED.start_at,fold=EXCLUDED.fold,all_day=EXCLUDED.all_day,format=EXCLUDED.format,lifecycle=EXCLUDED.lifecycle,visible=true`,[owner,wp,row.id,own?null:e.id,own?'INTERVIEW':e.kind.toUpperCase(),p.id,p.name,p.specialty||'',p.track||'',e.local_date,e.local_time,e.timezone,e.start_at,e.fold,e.all_day,own?row.format:'unknown',status]);
 }
}
