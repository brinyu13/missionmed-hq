import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,createHash,randomUUID} from 'node:crypto';
import {createResearchJobProof} from '../../server/research-job-proof.mjs';

// Synthetic, deliberately unmounted capabilities. These are not production
// nonce durability, PostgreSQL preservation or real WordPress acceptance tests.
const secret='synthetic-proof-key-not-production-00000001';
const eligibility='synthetic-eligibility-key-not-production-02';
const sign=(key,domain,bytes)=>createHmac('sha256',key).update(`${domain}\n`).update(bytes).digest('hex');
const sha=x=>createHash('sha256').update(x).digest('hex');
const time=Date.UTC(2026,9,4,6,40),seconds=time/1000;
const binding={requestId:randomUUID(),demandId:randomUUID(),interviewId:randomUUID(),ownerId:randomUUID(),programId:'program-1234',registryReleaseId:'registry-reviewed-2026'};
function input(overrides={}){return {audience:'rise-interviewiq-committed-job',nonce:randomUUID(),iat:seconds,phase:'reserve',...binding,request_sha256:sha('synthetic committed job bytes'),...overrides};}
function request(value=input(),raw){
  const body=raw??Buffer.from(JSON.stringify(value));
  return {method:'POST',url:'/api/owner/rise/research-authority',body,rawHeaders:['Content-Type','application/json','Content-Length',String(body.length),
    'X-MMED-IIQ-Job-Proof',sign(secret,'iiq-job-proof-v1\nrequest',body)]};
}
function harness(options={}){
  const log={nonce:[],reads:[],wp:[]},used=options.used??new Set();let tick=time;
  let row={...binding,requestSha256:sha('synthetic committed job bytes'),wpUserId:90001,lifecycle:'scheduled',privateNotes:'DO_NOT_TRANSMIT'};
  const proofReader={
    async consumeNonce(value){log.nonce.push(value);if(options.nonceError)throw new Error('private database detail');if(used.has(value.nonce))return false;used.add(value.nonce);return true;},
    async getCommittedDemand(value){log.reads.push(value);return options.read?options.read(log.reads.length,row):row;},
  };
  const fetchImpl=async(url,init)=>{
    log.wp.push({url,init});
    if(options.fetch)return options.fetch(url,init);
    const sent=JSON.parse(init.body);
    assert.equal(init.headers['X-MMED-IIQ-Job-Eligibility'],sign(eligibility,'iiq-job-eligibility-v1\nrequest',init.body));
    let response={...sent,allowed:true,role:'student',tier:'360',exp:sent.iat+30,...options.wp};
    if(options.during)options.during({setTime:value=>{tick=value;},setRow:value=>{row=value;},row});
    const payload=options.payload?.(response)??JSON.stringify(response);
    return new Response(JSON.stringify({payload,signature:options.signature??sign(eligibility,'iiq-job-eligibility-v1\nresponse',payload)}),
      {status:200,headers:{'Content-Type':'application/json'}});
  };
  const config={enabled:true,proofSecret:secret,eligibilitySecret:eligibility,...options.config};
  return {log,used,proofReader,fetchImpl,config,handler:createResearchJobProof(config,{proofReader,fetchImpl,now:()=>tick}),
    setRow:value=>{row=value;},setTime:value=>{tick=value;},row};
}
async function deny(h,r=request(),{noEffects=false}={}){
  const result=await h.handler(r);assert.notEqual(result.status,200);assert.deepEqual(Object.keys(result.body),['error']);
  assert.doesNotMatch(JSON.stringify(result),/90001|DO_NOT_TRANSMIT|private database|synthetic|session|token/i);
  if(noEffects){assert.equal(h.log.nonce.length,0);assert.equal(h.log.reads.length,0);assert.equal(h.log.wp.length,0);}
  return result;
}

for(const [role,tier] of [['student','360'],['student','ivprep_complete'],['admin','admin']])for(const phase of ['reserve','start','publish'])
  test(`fresh committed proof: ${role}/${tier}/${phase}`,async()=>{
    const h=harness({wp:{role,tier}}),value=input({phase}),r=request(value),result=await h.handler(r);
    assert.equal(result.status,200);assert.equal(result.body.signature,sign(secret,'iiq-job-proof-v1\nresponse',result.body.payload));
    const payload=JSON.parse(result.body.payload);assert.deepEqual(payload,{...value,allowed:true,reason:'current_committed_demand',exp:seconds+30,wpUserId:90001,role,tier});
    assert.equal(h.log.reads.length,2);assert.deepEqual(h.log.reads[0],binding);
    assert.equal(h.log.nonce[0].requestHash,sha(r.body));assert.equal(h.log.nonce[0].issuer,'rise-research-proof');
    assert.equal(Date.parse(h.log.nonce[0].expiresAt),time+90000);
    const {url,init}=h.log.wp[0],wp=JSON.parse(init.body);
    assert.equal(url,'https://missionmedinstitute.com/wp-json/missionmed/v1/interviewiq-owner/rise/job-introspect');
    assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');assert.equal(init.method,'POST');assert.equal(init.signal.aborted,true);
    assert.notEqual(wp.nonce,value.nonce);assert.equal(wp.subject,binding.ownerId);assert.equal(wp.wp_user_id,90001);
    assert.doesNotMatch(JSON.stringify([h.log,result]),/DO_NOT_TRANSMIT|session_verifier|jwt|cookie/i);
  });

for(const config of [{enabled:false},{enabled:'true'},{proofSecret:'short'},{eligibilitySecret:secret},{eligibilitySecret:null}])
  test(`configuration fails closed ${JSON.stringify(config)}`,async()=>{await deny(harness({config}),request(),{noEffects:true});});
test('missing production capability and default factory deny without network',async()=>{
  assert.equal((await createResearchJobProof()({})).status,503);
  assert.equal((await createResearchJobProof({enabled:true,proofSecret:secret,eligibilitySecret:eligibility})({})).status,503);
});

const badFields={audience:'other',nonce:'bad',iat:seconds-31,phase:'read-private',requestId:randomUUID().toUpperCase(),demandId:null,interviewId:123,
  ownerId:'student',programId:'../escape',registryReleaseId:'',request_sha256:'f'.repeat(63)};
for(const [key,value] of Object.entries(badFields))test(`bad callback field ${key}`,async()=>{await deny(harness(),request(input({[key]:value})),{noEffects:true});});
for(const mutation of [v=>({...v,iat:seconds+31}),v=>({...v,iat:seconds+0.5}),v=>({...v,extra:'not allowed'}),v=>{delete v.registryReleaseId;return v;}])
  test(`invalid exact callback schema ${mutation}`,async()=>{await deny(harness(),request(mutation(input())),{noEffects:true});});

for(const [name,mutate] of [
  ['method',r=>r.method='GET'],['query',r=>r.url+='?x=1'],['trailing slash',r=>r.url+='/'],['normalized alias',r=>r.url='/api/owner/rise/x/../research-authority'],
  ['bad signature',r=>r.rawHeaders[5]='0'.repeat(64)],['duplicate signature',r=>r.rawHeaders.push('x-mmed-iiq-job-proof',r.rawHeaders[5])],
  ['duplicate content length',r=>r.rawHeaders.push('content-length',String(r.body.length))],['wrong length',r=>r.rawHeaders[3]='0'],
  ['wrong content type',r=>r.rawHeaders[1]='text/plain'],['odd header list',r=>r.rawHeaders.push('x')],['nonbuffer',r=>r.body=r.body.toString()],
  ['oversize',r=>r.body=Buffer.alloc(16385)],['header injection',r=>r.rawHeaders.push('foo','bar\r\nbaz')],
  ['whitespace header',r=>r.rawHeaders.push(' Cookie','value')],['control header',r=>r.rawHeaders.push('x-probe','\u007f')],
])test(`wire rejects ${name}`,async()=>{const r=request();mutate(r);await deny(harness(),r,{noEffects:true});});
for(const header of ['Cookie','Cookie2','Origin','Authorization','Proxy-Authorization','Transfer-Encoding','Content-Encoding','Expect','X-HTTP-Method-Override','X-Method-Override','X-HTTP-Method','X-MMED-IIQ-Actor','X-MMED-Consumer','X-MMED-IIQ-Owner'])
  test(`browser/session/override header denied ${header}`,async()=>{const r=request();r.rawHeaders.push(header,'value');await deny(harness(),r,{noEffects:true});});
for(const [name,transform] of [
  ['duplicate',s=>s.replace('{','{"phase":"reserve",')],['escaped duplicate',s=>s.replace('{','{"\\u0070hase":"reserve",')],
  ['nested',s=>s.replace('"reserve"','{}')],['array',s=>s.replace('"reserve"','[]')],['trailing',s=>s+'true'],['BOM',s=>'\ufeff'+s],
  ['trailing comma',s=>s.slice(0,-1)+',}'],['proto',s=>s.replace('{','{"__proto__":"evil",')],['NUL',s=>s+'\u0000'],
])test(`strict JSON rejects ${name}`,async()=>{await deny(harness(),request(null,Buffer.from(transform(JSON.stringify(input())))),{noEffects:true});});
test('malformed UTF8 rejected even with exact byte signature',async()=>{await deny(harness(),request(null,Buffer.from([123,34,0xff,34,58,49,125])),{noEffects:true});});

for(const key of [...Object.keys(binding),'requestSha256','wpUserId','lifecycle'])
  test(`committed binding required ${key}`,async()=>{
    const h=harness({read:(_n,row)=>({...row,[key]:key==='wpUserId'?0:key==='lifecycle'?'cancelled':'different'})});
    await deny(h);assert.equal(h.log.wp.length,0);
  });
test('legacy missing release and digest cannot manufacture a grant',async()=>{
  const h=harness({read:()=>({...binding,registryReleaseId:null,wpUserId:90001,lifecycle:'scheduled'})});await deny(h);assert.equal(h.log.wp.length,0);
});
for(const lifecycle of ['cancelled','declined','no_show','unknown'])test(`inactive lifecycle ${lifecycle}`,async()=>{
  const h=harness({read:(_n,row)=>({...row,lifecycle})});await deny(h);assert.equal(h.log.wp.length,0);
});
for(const lifecycle of ['offered','scheduled','awaiting_confirmation','completed','postponed','waitlisted'])test(`permitted current lifecycle ${lifecycle}`,async()=>{
  const h=harness({read:(_n,row)=>({...row,lifecycle})});assert.equal((await h.handler(request())).status,200);
});
for(const key of [...Object.keys(binding),'requestSha256','wpUserId','lifecycle'])test(`mutation during WP denies ${key}`,async()=>{
  const h=harness({during:({row,setRow})=>setRow({...row,[key]:key==='wpUserId'?90002:key==='lifecycle'?'cancelled':'changed'})});
  await deny(h);assert.equal(h.log.reads.length,2);
});
test('missing record, durable store outage and nonboolean nonce admission deny',async()=>{
  await deny(harness({read:()=>null}));await deny(harness({nonceError:true}));
  const h=harness();h.proofReader.consumeNonce=async()=>1;await deny(h);assert.equal(h.log.wp.length,0);
});
for(const wpUserId of [0,-1,1.5,'90001',null,Number.MAX_SAFE_INTEGER+1])test(`unsafe accounting identity ${wpUserId} never reaches WP`,async()=>{
  const h=harness({read:(_n,row)=>({...row,wpUserId})});await deny(h);assert.equal(h.log.wp.length,0);
});
for(const claims of [{wpUserId:90001},{role:'admin'},{tier:'admin'}])test(`caller cannot inject accounting claims ${JSON.stringify(claims)}`,async()=>{
  await deny(harness(),request(input(claims)),{noEffects:true});
});
test('same request replay denied across factory recreation and simultaneous attempts',async()=>{
  const used=new Set(),a=harness({used}),b=harness({used}),r=request();
  const result=await Promise.all([a.handler(r),b.handler(r)]);assert.deepEqual(result.map(x=>x.status).sort(),[200,403]);
  await deny(harness({used}),r);assert.equal(a.log.wp.length+b.log.wp.length,1);
});

for(const change of [{allowed:false},{role:'mentor',tier:'assigned_mentor'},{role:'admin',tier:'360'},{role:'student',tier:'admin'},
  {subject:randomUUID()},{wp_user_id:90002},{request_sha256:'0'.repeat(64)},{registryReleaseId:'other'},
  {iat:seconds-1},{exp:seconds},{exp:seconds+31},{audience:'other'},{phase:'publish'},{extra:'private'},
])test(`WP proof rejects ${JSON.stringify(change)}`,async()=>{await deny(harness({wp:change}));});
test('WP signature and escaped duplicate signed payload denied',async()=>{
  await deny(harness({signature:'0'.repeat(64)}));
  await deny(harness({payload:p=>JSON.stringify(p).replace('{','{"\\u0061llowed":true,')}));
});
test('proof expiry capped at provider lifetime and original window',async()=>{
  const h=harness({wp:{exp:seconds+8}}),r=await h.handler(request(input({iat:seconds-25})));
  assert.equal(r.status,200);assert.equal(JSON.parse(r.body.payload).exp,seconds+5);
});
test('expired during provider/read and backwards clock deny',async()=>{
  await deny(harness({during:({setTime})=>setTime(time+31000)}));
  await deny(harness({during:({setTime})=>setTime(time-1)}));
  await deny(harness({during:({setTime})=>setTime(time+9000)}),request(input({iat:seconds-22})));
});
test('WP outage redirect/nonJSON/oversize responses deny without raw errors',async()=>{
  for(const fetch of [async()=>{throw new Error('private database detail');},async()=>({ok:true,redirected:true}),
    async()=>new Response('bad',{headers:{'Content-Type':'text/html'}}),
    async()=>new Response('x'.repeat(16385),{headers:{'Content-Type':'application/json'}}),
    async()=>new Response('{}',{headers:{'Content-Type':'application/json','Content-Length':'16385'}})])await deny(harness({fetch}));
});
test('stalled WP body deadline aborts and cancels stream',async()=>{
  let cancelled=false,signal;
  const h=harness({fetch:async(_url,init)=>{signal=init.signal;return new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'Content-Type':'application/json'}});}});
  const at=Date.now();await deny(h);assert.ok(Date.now()-at>=4900&&Date.now()-at<7000);assert.equal(signal.aborted,true);assert.equal(cancelled,true);
});
