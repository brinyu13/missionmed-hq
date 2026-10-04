import {createHash} from 'node:crypto';
import tls from 'node:tls';
import pg from 'pg';
import {createResearchJobStore} from './research-job-store.mjs';
import {createResearchJobProof} from './research-job-proof.mjs';

export const RESEARCH_PROOF_PATH='/api/owner/rise/research-authority';
const denied=()=>Error('research_runtime_unavailable'),need=x=>{if(!x)throw denied();};
const sha=x=>createHash('sha256').update(x).digest('hex');
const CA='aea2dc33cf96f7360466a69ca8ed5d4a0e8259a4233bf4bdb29dc87efbaa665c';
const LEAF='FC:C9:F9:86:8F:A5:2B:59:6C:86:77:8F:9B:F3:1A:C2:6F:1D:2F:6D:28:09:8F:C8:D5:23:C1:08:49:1F:2D:66';
export function readResearchProofConfig(env={}){
 const flag=String(env.INTERVIEWIQ_RESEARCH_PROOF_ENABLED??'').trim();need(['','0','false','1','true'].includes(flag));
 if(!['1','true'].includes(flag))return Object.freeze({enabled:false});
 need(env.NODE_TLS_REJECT_UNAUTHORIZED!=='0'&&!Object.entries(env).some(([k,v])=>/^PG(?:HOST|HOSTADDR|PORT|DATABASE|USER|PASSWORD|SERVICE|SERVICEFILE|SYSCONFDIR|OPTIONS)$/.test(k)&&v));
 const proofSecret=env.INTERVIEWIQ_RESEARCH_JOB_PROOF_SECRET,eligibilitySecret=env.INTERVIEWIQ_RESEARCH_JOB_ELIGIBILITY_SECRET;
 need([proofSecret,eligibilitySecret].every(x=>typeof x==='string'&&Buffer.byteLength(x)>=32)&&proofSecret.trim()!==eligibilitySecret.trim());
 for(const [key,value] of Object.entries(env))if(!['INTERVIEWIQ_RESEARCH_JOB_PROOF_SECRET','INTERVIEWIQ_RESEARCH_JOB_ELIGIBILITY_SECRET'].includes(key)&&/SECRET|TOKEN|HMAC|JWT|GATEWAY|SIGNING|API_KEY/.test(key)&&value)need(![proofSecret,eligibilitySecret].map(x=>x.trim()).includes(String(value).trim()));
 let u;try{u=new URL(env.INTERVIEWIQ_RESEARCH_PROOF_DATABASE_URL);}catch{throw denied();}
 const q=[...u.searchParams];need(['postgres:','postgresql:'].includes(u.protocol)&&u.hostname==='postgres.railway.internal'&&Number(u.port||5432)===5432&&u.pathname==='/railway'&&u.username==='iiq_research_proof_login'&&u.password&&!u.hash&&(q.length===0||q.length===1&&q[0][0]==='sslmode'&&q[0][1]==='require'));
 need(![proofSecret,eligibilitySecret].includes(decodeURIComponent(u.password)));u.search='';
 const ca=Buffer.from(String(env.INTERVIEWIQ_RESEARCH_PROOF_DATABASE_CA_PEM??''));need(sha(ca)===CA);
 return Object.freeze({enabled:true,proofSecret,eligibilitySecret,pool:{connectionString:u.href,max:2,connectionTimeoutMillis:3000,idleTimeoutMillis:30000,query_timeout:3000,statement_timeout:3000,application_name:'interviewiq-research-proof',ssl:{ca,rejectUnauthorized:true,checkServerIdentity:(_host,cert)=>cert.fingerprint256===LEAF?tls.checkServerIdentity('postgres.railway.internal',cert):denied()}}});
}
export async function readResearchProofBody(req){
 need(req.method==='POST'&&req.url===RESEARCH_PROOF_PATH&&Array.isArray(req.rawHeaders)&&req.rawHeaders.length%2===0&&req.rawHeaders.length<=100&&!req.aborted&&!req.destroyed);
 const seen=new Set();let length;
 for(let i=0;i<req.rawHeaders.length;i+=2){const k=String(req.rawHeaders[i]).toLowerCase(),v=req.rawHeaders[i+1];need(!seen.has(k));seen.add(k);need(!['transfer-encoding','content-encoding','expect'].includes(k));if(k==='content-length'){need(typeof v==='string'&&/^\d+$/.test(v)&&Number(v)>0&&Number(v)<=16384);length=Number(v);}}
 need(length!==undefined);
 return new Promise((resolve,reject)=>{let size=0,settled=false,timer;const chunks=[];
  const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);for(const [e,f] of [['data',data],['end',end],['error',bad],['aborted',bad],['close',closed]])req.off(e,f);if(error){req.pause();reject(denied());}else resolve(Buffer.concat(chunks));};
  const data=chunk=>{size+=chunk.length;if(size>length||size>16384)finish(true);else chunks.push(Buffer.from(chunk));},end=()=>finish(size!==length),bad=()=>finish(true),closed=()=>{if(!req.readableEnded)bad();};
  req.on('data',data);req.once('end',end);req.once('error',bad);req.once('aborted',bad);req.once('close',closed);timer=setTimeout(bad,1000);if(req.readableEnded)end();else req.resume();
 });
}
export async function createResearchJobRuntime(config={}, {Pool=pg.Pool,fetchImpl=fetch}={}){
 const no=()=>({status:503,body:{error:'research_authority_unavailable'}});
 if(config.enabled!==true)return Object.freeze({handle:async()=>no(),close:async()=>{}});
 let underlying;try{
  underlying=new Pool(config.pool);underlying.on('error',()=>{});
  const pool={async connect(){const c=await underlying.connect();if(c.connection?.stream?.encrypted!==true||c.connection?.stream?.authorized!==true){c.release(true);throw denied();}return c;}};
  const proofReader=await createResearchJobStore({enabled:true},{pool}),prove=createResearchJobProof(config,{proofReader,fetchImpl});let closed=false;
  return Object.freeze({async handle(req){if(closed)return no();try{return await prove({method:req.method,url:req.url,rawHeaders:req.rawHeaders,body:await readResearchProofBody(req)});}catch{return no();}},async close(){if(!closed){closed=true;await underlying.end();}}});
 }catch{if(underlying)await underlying.end().catch(()=>{});throw denied();}
}
