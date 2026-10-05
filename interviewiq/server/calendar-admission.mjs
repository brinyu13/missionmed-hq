import {createHmac,createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import {readOwnerSession} from './owner-session.mjs';
import {requireValue,AppError} from './errors.mjs';
import {UUID} from './auth.mjs';
const granted=new WeakMap(),targets=new WeakMap();
export const CALENDAR_ACTION=/^(?:GET \/api\/calendar\/cohort|(?:GET|POST) \/api\/calendar\/admin(?:\/[a-f0-9-]{36})?|(?:GET|POST) \/api\/interviews\/[a-f0-9-]{36}\/itinerary(?:\/[a-f0-9-]{36})?)$/;
export function calendarEnabled(config,actor){return config.calendar?.enabled===true&&actor?.eligible===true&&(actor.role==='admin'&&actor.tier==='admin'||actor.role==='student'&&['360','ivprep_complete'].includes(actor.tier));}
export function requireCalendar(config,actor){requireValue(calendarEnabled(config,actor),'calendar_unavailable','Shared Calendar and private itineraries are unavailable.',403);}
export function admissionProof(secret,domain,text){return createHmac('sha256',secret).update(domain+'\n'+text).digest('hex');}
function fail(){throw new AppError(503,'calendar_admission_unavailable','Current Calendar access could not be verified. Your own Calendar remains available.');}
function strict(x,keys){return x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));}
export function validatePairs(pairs){requireValue(Array.isArray(pairs)&&pairs.length<=200,'calendar_pairs','Calendar page is too large.');const seen=new Set();for(const p of pairs){requireValue(strict(p,['subject','wp_user_id'])&&UUID.test(p.subject)&&Number.isSafeInteger(p.wp_user_id)&&p.wp_user_id>0&&!seen.has(p.subject)&&!pairs.some(q=>q!==p&&q.wp_user_id===p.wp_user_id),'calendar_pairs','Calendar identity mapping is invalid.');seen.add(p.subject);}return pairs;}
export function createCalendarAdmission(config,{fetchImpl=globalThis.fetch,now=Date.now}={}){
 return async function admit(actor,pairs,action){
  requireCalendar(config,actor);validatePairs(pairs);requireValue(CALENDAR_ACTION.test(action),'calendar_action','Calendar action is invalid.');
  const session=readOwnerSession(actor,now());if(!session)fail();
  let url;try{url=new URL(config.ownerIntrospectionUrl);if(url.protocol!=='https:'||url.origin!==config.jwtIssuer||url.username||url.password||url.search||url.hash)fail();url.pathname='/wp-json/missionmed-interviewiq/v1/calendar-admit';}catch{fail();}
  const input={audience:'interviewiq-cohort-admission-v1',subject:actor.id,wp_user_id:actor.wpUserId,session_verifier:session.verifier,nonce:randomUUID(),iat:Math.floor(now()/1000),action,pairs},body=JSON.stringify(input),requestSha=createHash('sha256').update(body).digest('hex');
  let response,outer;try{response=await fetchImpl(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),headers:{'Content-Type':'application/json','X-MMED-IIQ-Proof':admissionProof(config.ownerProofSecret,'mmiiq-calendar-request-v1',body)},body});if(response.status!==200||!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')||''))fail();let n=0,chunks=[];for await(const b of response.body){n+=b.length;if(n>65536)fail();chunks.push(b);}outer=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}catch{fail();}
  if(!strict(outer,['payload','signature'])||typeof outer.payload!=='string'||!/^[a-f0-9]{64}$/.test(outer.signature||''))fail();const expected=admissionProof(config.ownerProofSecret,'mmiiq-calendar-response-v1',outer.payload);if(!timingSafeEqual(Buffer.from(expected),Buffer.from(outer.signature)))fail();
  let p;try{p=JSON.parse(outer.payload);}catch{fail();}const seconds=Math.floor(now()/1000);
  if(!strict(p,['audience','subject','wp_user_id','nonce','request_sha256','action','allowed','role','tier','pairs','iat','exp'])||p.audience!==input.audience||p.subject!==actor.id||p.wp_user_id!==actor.wpUserId||p.nonce!==input.nonce||p.request_sha256!==requestSha||p.action!==action||p.allowed!==true||p.role!==actor.role||p.tier!==actor.tier||!Number.isSafeInteger(p.iat)||!Number.isSafeInteger(p.exp)||p.iat>seconds+3||p.iat<seconds-30||p.exp<=seconds||p.exp>p.iat+30||!Array.isArray(p.pairs)||p.pairs.length!==pairs.length)fail();
  for(let i=0;i<pairs.length;i++){const r=p.pairs[i],s=pairs[i];if(!strict(r,['subject','wp_user_id','allowed'])||r.subject!==s.subject||r.wp_user_id!==s.wp_user_id||typeof r.allowed!=='boolean')fail();}
  const grant=Object.freeze({pairs:Object.freeze(p.pairs.map(r=>Object.freeze({...r}))),expiresAt:p.exp*1000});granted.set(grant,{actor,action});return grant;
 };
}
export function admittedTarget(actor,pair,grant,now=Date.now()){
 const g=granted.get(grant);requireValue(g?.actor===actor&&actor.role==='admin'&&grant.expiresAt>now&&grant.pairs.some(p=>p.allowed&&p.subject===pair.subject&&p.wp_user_id===pair.wp_user_id),'calendar_target_denied','Current administrator target access is unavailable.',403);
 const target=Object.freeze({ownerId:pair.subject,wpUserId:pair.wp_user_id});targets.set(target,actor);return target;
}
export function isLogisticsTarget(actor,target){return actor?.role==='admin'&&targets.get(target)===actor;}
export async function bindCalendar(db,actor,target=null){await db.query("SELECT set_config('iiq.calendar_admitted',$1,true),set_config('iiq.admin_target_id',$2,true)",[actor.id,target?.ownerId||'']);}
