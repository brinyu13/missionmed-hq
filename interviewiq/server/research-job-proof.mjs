import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';

const PATH='/api/owner/rise/research-authority';
const WP='https://missionmedinstitute.com/wp-json/missionmed/v1/interviewiq-owner/rise/job-introspect';
const AUD='rise-interviewiq-committed-job',WP_AUD='interviewiq-rise-job-proof';
const BINDING=['requestId','demandId','interviewId','ownerId','programId','registryReleaseId'];
const KEYS=['audience','nonce','iat','phase',...BINDING,'request_sha256'];
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const HASH=/^[a-f0-9]{64}$/,ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/;
const sha=x=>createHash('sha256').update(x).digest('hex');
const mac=(secret,domain,value)=>createHmac('sha256',secret).update(`${domain}\n`).update(value).digest('hex');
const equal=(a,b)=>typeof a==='string'&&HASH.test(a)&&timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
const denied=()=>new Error('research_authority_denied');
function requireValue(value){if(!value)throw denied();}
function exactKeys(value,keys){return Object.keys(value).sort().join(',')===[...keys].sort().join(',');}

// Flat protocol objects only. JSON.parse alone silently accepts duplicate keys;
// lexical key decoding also rejects escaped duplicates before any side effect.
function flatJSON(bytes) {
  requireValue(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=16384);
  const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
  const string=/"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"/y;
  const primitive=/(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/y;
  let i=0;const seen=new Set();
  const ws=()=>{while(/[ \t\r\n]/.test(text[i]??'X'))i++;};
  const token=re=>{re.lastIndex=i;const m=re.exec(text);requireValue(m);i=re.lastIndex;return m[0];};
  ws();requireValue(text[i++]==='{');ws();
  if(text[i]!=='}')for(;;){
    const key=JSON.parse(token(string));requireValue(!seen.has(key)&&!['__proto__','constructor','prototype'].includes(key));seen.add(key);
    ws();requireValue(text[i++]===':');ws();token(text[i]==='"'?string:primitive);ws();
    if(text[i]!==',')break;i++;ws();
  }
  requireValue(text[i++]==='}');ws();requireValue(i===text.length);
  return JSON.parse(text);
}
function validateRequest(request,secret,seconds) {
  requireValue(request?.method==='POST'&&request.url===PATH&&Buffer.isBuffer(request.body)&&request.body.length<=16384);
  requireValue(Array.isArray(request.rawHeaders)&&request.rawHeaders.length%2===0&&request.rawHeaders.length<=100);
  const headers=new Map();
  for(let i=0;i<request.rawHeaders.length;i+=2){
    const name=request.rawHeaders[i],value=request.rawHeaders[i+1];
    requireValue(typeof name==='string'&&typeof value==='string'&&/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)&&!/[\u0000-\u0008\u000a-\u001f\u007f]/.test(value));
    const key=name.toLowerCase();requireValue(!headers.has(key));headers.set(key,value);
    requireValue(!['origin','cookie','cookie2','authorization','proxy-authorization','transfer-encoding','content-encoding','expect','x-http-method-override','x-method-override','x-http-method'].includes(key));
    requireValue(!key.startsWith('x-mmed-')||key==='x-mmed-iiq-job-proof');
  }
  requireValue(/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(headers.get('content-type')??''));
  if(headers.has('content-length'))requireValue(headers.get('content-length')===String(request.body.length));
  requireValue(equal(headers.get('x-mmed-iiq-job-proof'),mac(secret,'iiq-job-proof-v1\nrequest',request.body)));
  const value=flatJSON(request.body);
  requireValue(exactKeys(value,KEYS)&&value.audience===AUD&&UUID.test(value.nonce)&&Number.isSafeInteger(value.iat)&&Math.abs(seconds-value.iat)<=30);
  requireValue(['reserve','start','publish'].includes(value.phase)&&HASH.test(value.request_sha256));
  requireValue(BINDING.slice(0,4).every(k=>typeof value[k]==='string'&&UUID.test(value[k]))&&
    ['programId','registryReleaseId'].every(k=>typeof value[k]==='string'&&ID.test(value[k])));
  return value;
}
function currentBinding(row,request) {
  requireValue(row&&BINDING.every(k=>row[k]===request[k])&&row.requestSha256===request.request_sha256&&
    Number.isSafeInteger(row.wpUserId)&&row.wpUserId>0&&
    ['offered','scheduled','awaiting_confirmation','postponed','waitlisted','completed'].includes(row.lifecycle));
  return Object.freeze(Object.fromEntries([...BINDING,'requestSha256','wpUserId','lifecycle'].map(k=>[k,row[k]])));
}
async function responseJSON(response,signal) {
  requireValue(response?.ok===true&&response.redirected!==true&&/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')??''));
  const length=response.headers.get('content-length');if(length!==null)requireValue(/^\d+$/.test(length)&&Number(length)<=16384);
  const reader=response.body?.getReader();requireValue(reader);
  const chunks=[];let size=0;
  const abort=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',abort,{once:true});
  if(signal.aborted){signal.removeEventListener('abort',abort);abort();throw denied();}
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;requireValue(size<=16384);chunks.push(Buffer.from(value));}}
  finally{signal.removeEventListener('abort',abort);void reader.cancel().catch(()=>{});}
  return flatJSON(Buffer.concat(chunks));
}

// Unmounted source capability. Production must supply a separately qualified,
// least-privilege committed reader and durable nonce store; no actor impersonation.
export function createResearchJobProof({enabled=false,proofSecret,eligibilitySecret}={},
  {proofReader,fetchImpl=fetch,now=Date.now}={}) {
  return async request=>{
    if(enabled!==true||typeof proofReader?.consumeNonce!=='function'||typeof proofReader?.getCommittedDemand!=='function'||
      [proofSecret,eligibilitySecret].some(x=>typeof x!=='string'||Buffer.byteLength(x)<32)||proofSecret===eligibilitySecret)
      return {status:503,body:{error:'research_authority_unavailable'}};
    const start=now(),deadline=Date.now()+10000;
    const check=()=>{requireValue(Number.isSafeInteger(now())&&now()>=start&&now()-start<10000&&Date.now()<deadline);return Math.floor(now()/1000);};
    const bounded=async(operation,maximum=10000,onTimeout=()=>{})=>{
      check();let timer;
      try{return await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{
        timer=setTimeout(()=>{onTimeout();reject(denied());},Math.max(1,Math.min(maximum,deadline-Date.now())));
      })]);}finally{clearTimeout(timer);}
    };
    const controller=new AbortController();
    try {
      const input=validateRequest(request,proofSecret,check());
      requireValue(await bounded(()=>proofReader.consumeNonce({issuer:'rise-research-proof',nonce:input.nonce,
        requestHash:sha(request.body),expiresAt:new Date(now()+90000).toISOString()}))===true);
      const binding=Object.freeze(Object.fromEntries(BINDING.map(k=>[k,input[k]])));
      const first=currentBinding(await bounded(()=>proofReader.getCommittedDemand(binding)),input);
      requireValue(Math.abs(check()-input.iat)<=30&&input.iat+30>check());
      const sent={audience:WP_AUD,nonce:randomUUID(),iat:check(),subject:first.ownerId,wp_user_id:first.wpUserId,
        requestId:first.requestId,demandId:first.demandId,interviewId:first.interviewId,programId:first.programId,
        registryReleaseId:first.registryReleaseId,phase:input.phase,request_sha256:first.requestSha256};
      const raw=JSON.stringify(sent);
      const envelope=await bounded(async()=>responseJSON(await fetchImpl(WP,{method:'POST',redirect:'error',credentials:'omit',signal:controller.signal,
        headers:{'Content-Type':'application/json',Accept:'application/json','X-MMED-IIQ-Job-Eligibility':mac(eligibilitySecret,'iiq-job-eligibility-v1\nrequest',raw)},body:raw}),controller.signal),5000,()=>controller.abort());
      requireValue(exactKeys(envelope,['payload','signature'])&&typeof envelope.payload==='string'&&
        equal(envelope.signature,mac(eligibilitySecret,'iiq-job-eligibility-v1\nresponse',envelope.payload)));
      const wp=flatJSON(Buffer.from(envelope.payload));
      requireValue(exactKeys(wp,[...Object.keys(sent),'allowed','role','tier','exp'])&&Object.keys(sent).every(k=>wp[k]===sent[k])&&wp.allowed===true&&
        (wp.role==='admin'&&wp.tier==='admin'||wp.role==='student'&&['360','ivprep_complete'].includes(wp.tier))&&
        Number.isSafeInteger(wp.exp)&&wp.exp>check()&&wp.exp>wp.iat&&wp.exp-wp.iat<=30);
      const last=currentBinding(await bounded(()=>proofReader.getCommittedDemand(binding)),input);
      requireValue(JSON.stringify(first)===JSON.stringify(last));
      const seconds=check(),exp=Math.min(input.iat+30,wp.exp,seconds+30);
      requireValue(Math.abs(seconds-input.iat)<=30&&exp>seconds);
      // Service-only accounting identity, verified by WP and the second DB read.
      // This is a research grant, never a browser session or admin capability.
      const payload=JSON.stringify({...input,allowed:true,reason:'current_committed_demand',exp,
        wpUserId:last.wpUserId,role:wp.role,tier:wp.tier});
      return {status:200,body:{payload,signature:mac(proofSecret,'iiq-job-proof-v1\nresponse',payload)}};
    }catch{return {status:403,body:{error:'research_authority_denied'}};}
    finally{controller.abort();}
  };
}
