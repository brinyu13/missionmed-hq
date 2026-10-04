import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {AppError,requireValue} from './errors.mjs';
import {researchJobBody,researchJobDigest} from './research-job-store.mjs';

const PATH='/api/rise/v1/interviewiq/research-jobs',ORIGIN='https://missionmed-rise-production.up.railway.app';
const AUD='rise-interviewiq-research-job',KEYS=['requestId','demandId','interviewId','ownerId','programId','registryReleaseId'];
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$(?![\s\S])/;
const statuses={QUEUED:'queued',LEASED:'researching',RUNNING:'researching',NORMALIZING:'researching',PROMOTING:'researching',NEEDS_REVIEW:'partial',COMPLETED:'available',PARTIAL:'partial',FAILED:'failed',REFUNDED:'failed',CANCELLED:'failed',PAUSED:'queued',NO_OP:'available'};
const sha=x=>createHash('sha256').update(x).digest('hex'),mac=(key,x)=>createHmac('sha256',key).update(x).digest('hex');
const unavailable=()=>new AppError(503,'research_unavailable','Research could not be checked. Your saved interview and original request are preserved.');
const need=x=>{if(!x)throw unavailable();};
export const deepResearchEnabled=(config,actor)=>config.deepResearch?.enabled===true&&actor?.eligible===true&&actor.role==='student'&&['360','ivprep_complete'].includes(actor.tier)&&actor.id===config.deepResearch.ownerId;
export function requireDeepResearch(config,actor,programId){requireValue(deepResearchEnabled(config,actor)&&(!programId||programId===config.deepResearch.programId),'research_unavailable','Research is not enabled for this workspace or program.',403);}
export function demandBinding(row,release){return {requestId:row.external_request_id,demandId:row.id,interviewId:row.interview_id,ownerId:row.owner_id,programId:row.program_id,registryReleaseId:release};}
// Signed service envelopes are flat. Reject duplicate decoded keys before parsing.
export function parseResearchFlatJSON(raw,keys){
 need(typeof raw==='string'&&Buffer.byteLength(raw)<=16384);
 const string='"(?:[^"\\\\\\u0000-\\u001f]|\\\\(?:["\\\\/bfnrt]|u[0-9a-fA-F]{4}))*"';
 const entry=new RegExp('\\s*('+string+')\\s*:\\s*('+string+'|true|false|null|-?(?:0|[1-9]\\d*)(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)\\s*','y');
 let at=raw.search(/\S/);need(raw[at++]==='{');const seen=new Set();
 for(;;){entry.lastIndex=at;const m=entry.exec(raw);need(m);const key=JSON.parse(m[1]);need(!seen.has(key)&&!['__proto__','constructor','prototype'].includes(key));seen.add(key);at=entry.lastIndex;if(raw[at]!==',')break;at++;}
 need(raw[at++]==='}'&&/^\s*$/.test(raw.slice(at))&&[...seen].sort().join()===[...keys].sort().join());return JSON.parse(raw);
}
export function createRiseResearchJobTransport({enabled=false,requestSecret}={}, {fetchImpl=fetch,now=Date.now}={}){
 return async(binding,expectedDigest)=>{
  need(enabled===true&&typeof requestSecret==='string'&&Buffer.byteLength(requestSecret)>=32);
  binding=Object.freeze(Object.fromEntries(KEYS.map(k=>[k,binding?.[k]])));
  const raw=researchJobBody(binding),digest=sha(raw);need(digest===expectedDigest);
  const start=now(),mono=performance.now(),iat=Math.floor(start/1000),nonce=randomUUID();
  const canonical=`iiq-research-job-v1\nrequest\n${AUD}\n${iat}\n${nonce}\nPOST\n${PATH}\n${digest}`;
  const controller=new AbortController();let timer,reader;
  try{return await Promise.race([new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();void reader?.cancel().catch(()=>{});reject(unavailable());},10000);}), (async()=>{
   const response=await fetchImpl(ORIGIN+PATH,{method:'POST',redirect:'error',credentials:'omit',signal:controller.signal,headers:{'Content-Type':'application/json','Content-Length':String(Buffer.byteLength(raw)),Accept:'application/json','X-MMED-IIQ-Job-Timestamp':String(iat),'X-MMED-IIQ-Job-Nonce':nonce,'X-MMED-IIQ-Job-Signature':mac(requestSecret,canonical)},body:raw});
   need(response.ok&&!response.redirected&&/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')??''));
   const length=response.headers.get('content-length');if(length!==null)need(/^\d+$/.test(length)&&Number(length)<=16384);
   reader=response.body?.getReader();need(reader);const chunks=[];let size=0;
   for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;need(size<=16384);chunks.push(Buffer.from(value));}
   const envelope=parseResearchFlatJSON(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)),['payload','signature']);
   need(typeof envelope.payload==='string'&&typeof envelope.signature==='string'&&/^[a-f0-9]{64}$/.test(envelope.signature)&&timingSafeEqual(Buffer.from(envelope.signature,'hex'),Buffer.from(mac(requestSecret,`iiq-research-job-v1\nresponse\n${envelope.payload}`),'hex')));
   const r=parseResearchFlatJSON(envelope.payload,['audience','nonce','request_sha256',...KEYS,'status','jobId','iat','exp']),current=now();
   need(current>=start&&current-start<10000&&performance.now()-mono<10000&&r.audience===AUD&&r.nonce===nonce&&r.request_sha256===digest&&KEYS.every(k=>r[k]===binding[k])&&Object.hasOwn(statuses,r.status)&&
    (typeof r.jobId==='string'&&UUID.test(r.jobId)||r.jobId===null&&r.status==='NO_OP')&&Number.isSafeInteger(r.iat)&&Number.isSafeInteger(r.exp)&&r.iat>=iat&&r.iat<=Math.floor(current/1000)&&r.exp>Math.floor(current/1000)&&r.exp-r.iat>0&&r.exp-r.iat<=30);
   return {binding:Object.fromEntries(KEYS.map(k=>[k,r[k]])),bodyHash:digest,status:r.status,jobId:r.jobId,envelope:{payload:envelope.payload,signature:envelope.signature},verifiedAt:new Date(current).toISOString()};
  })()]);}catch{throw unavailable();}finally{clearTimeout(timer);controller.abort();void reader?.cancel().catch(()=>{});}
 };
}
async function committed(db,actor,interviewId,expectedRequestId,{lock=false}={}){
 const {rows:[i]}=await db.query(`SELECT id,owner_id,program_id,status FROM iiq.interviews WHERE id=$1 AND owner_id=$2${lock?' FOR UPDATE':''}`,[interviewId,actor.id]);
 need(i&&['offered','scheduled','awaiting_confirmation','postponed','waitlisted','completed'].includes(i.status));
 const {rows:[d]}=await db.query(`SELECT * FROM iiq.research_demands WHERE interview_id=$1 AND owner_id=$2${lock?' FOR UPDATE':''}`,[interviewId,actor.id]);
 need(d?.external_request_id&&(!expectedRequestId||d.external_request_id===expectedRequestId)&&d.program_id===i.program_id);
 const {rows:[g]}=await db.query('SELECT * FROM iiq.research_job_grants WHERE request_id::text=$1 AND owner_id=$2 AND demand_id=$3 AND interview_id=$4',[d.external_request_id,actor.id,d.id,interviewId]);
 need(g&&g.program_id===i.program_id);const binding=demandBinding(d,g.registry_release_id),digest=researchJobDigest(binding);need(g.request_sha256===digest);
 const {rows:[outbox]}=await db.query("SELECT payload FROM iiq.outbox_events WHERE owner_id=$1 AND topic='rise.research_requested' AND dedupe_key=$2",[actor.id,'research:'+binding.requestId]);
 need(outbox?.payload?.kind==='program-gaps'&&Object.keys(outbox.payload).sort().join()===[...KEYS,'kind'].sort().join()&&KEYS.every(k=>outbox.payload[k]===binding[k])&&researchJobDigest(outbox.payload)===digest);
 return {binding,digest,version:Number(d.version),status:d.status};
}
export async function captureResearchBinding({db,actor,interviewId,config}){requireDeepResearch(config,actor);const c=await committed(db,actor,interviewId);requireDeepResearch(config,actor,c.binding.programId);return c.binding;}
export async function checkCommittedResearch({database,actor,interviewId,expectedRequestId,owners,transport,revalidateActor,config}){
 requireDeepResearch(config,actor);need(typeof revalidateActor==='function'&&typeof transport==='function');
 const fresh=async()=>{const a=await revalidateActor();need(a?.id===actor.id&&a.wpUserId===actor.wpUserId&&deepResearchEnabled(config,a));return a;};
 actor=await fresh();const first=await database.withActor(actor,db=>committed(db,actor,interviewId,expectedRequestId));requireDeepResearch(config,actor,first.binding.programId);
 const receipt=await transport(first.binding,first.digest);actor=await fresh();
 const applied=await database.withActor(actor,async db=>{
  const current=await committed(db,actor,interviewId,first.binding.requestId,{lock:true});
  if(current.version!==first.version||KEYS.some(k=>current.binding[k]!==first.binding[k]))return false;
  need(receipt?.bodyHash===current.digest&&KEYS.every(k=>receipt.binding?.[k]===current.binding[k])&&Object.hasOwn(statuses,receipt.status));
  const {rows:prior}=await db.query("SELECT metadata FROM iiq.audit_events WHERE owner_id=$1 AND event_type='research.receipt' AND object_id=$2 AND metadata->>'requestId'=$3 ORDER BY created_at DESC",[actor.id,current.binding.demandId,current.binding.requestId]);
  need(prior.every(p=>p.metadata.jobId===receipt.jobId));
  if(prior[0]?.metadata.status===receipt.status)return true;
  // A current terminal receipt is never regressed by an older network status.
  if(prior.length&&['available','partial','failed'].includes(current.status)&&['queued','researching'].includes(statuses[receipt.status]))return false;
  await db.query(`INSERT INTO iiq.audit_events(owner_id,actor_id,event_type,object_type,object_id,metadata) VALUES($1,$1,'research.receipt','research_demand',$2,$3::jsonb)`,[actor.id,current.binding.demandId,JSON.stringify({requestId:current.binding.requestId,jobId:receipt.jobId,status:receipt.status,bodyHash:receipt.bodyHash,verifiedAt:receipt.verifiedAt,envelope:receipt.envelope})]);
  await db.query('UPDATE iiq.research_demands SET status=$3,refreshed_at=now(),last_error_code=NULL WHERE id=$1 AND owner_id=$2',[current.binding.demandId,actor.id,statuses[receipt.status]]);return true;
 },{write:true});
 if(!applied)return {status:'changed'};
 const before=await database.withActor(actor,db=>committed(db,actor,interviewId,first.binding.requestId));
 const research=await owners.getProgramResearch(actor,first.binding.programId);actor=await fresh();
 const after=await database.withActor(actor,db=>committed(db,actor,interviewId,first.binding.requestId));
 need(before.version===after.version&&KEYS.every(k=>after.binding[k]===first.binding[k])&&research.coverage.programId===first.binding.programId&&research.coverage.registryReleaseId===first.binding.registryReleaseId);
 return {status:after.status,interviewId,...after.binding,version:after.version,research};
}
