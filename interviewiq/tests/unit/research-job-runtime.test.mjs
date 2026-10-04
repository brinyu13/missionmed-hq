import pg from 'pg';
import {startApp} from '../../server/app.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough} from 'node:stream';
import {createServer} from 'node:http';
import {readResearchProofConfig,createResearchJobRuntime,readResearchProofBody,RESEARCH_PROOF_PATH} from '../../server/research-job-runtime.mjs';
import {createHandler} from '../../server/http.mjs';
const badEnv={INTERVIEWIQ_RESEARCH_PROOF_ENABLED:'true',INTERVIEWIQ_RESEARCH_JOB_PROOF_SECRET:'p'.repeat(40),INTERVIEWIQ_RESEARCH_JOB_ELIGIBILITY_SECRET:'e'.repeat(40),INTERVIEWIQ_RESEARCH_PROOF_DATABASE_URL:'postgresql://iiq_research_proof_login:synthetic@postgres.railway.internal/railway'};
test('disabled proof creates no pool or network activity',async()=>{let n=0;const r=await createResearchJobRuntime(readResearchProofConfig({}),{Pool:class{constructor(){n++;}},fetchImpl:()=>{n++;}});assert.equal((await r.handle({})).status,503);await r.close();assert.equal(n,0);});
for(const [name,delta] of Object.entries({invalidFlag:{INTERVIEWIQ_RESEARCH_PROOF_ENABLED:'yes'},weak:{INTERVIEWIQ_RESEARCH_JOB_PROOF_SECRET:'short'},collision:{INTERVIEWIQ_RESEARCH_JOB_ELIGIBILITY_SECRET:'p'.repeat(40)},gatewayCollision:{INTERVIEWIQ_GATEWAY_SECRET:'p'.repeat(40)},databaseCollision:{INTERVIEWIQ_RESEARCH_PROOF_DATABASE_URL:'postgresql://iiq_research_proof_login:'+('p'.repeat(40))+'@postgres.railway.internal/railway'},routing:{PGHOST:'elsewhere'},tlsDisabled:{NODE_TLS_REJECT_UNAUTHORIZED:'0'},wrongHost:{INTERVIEWIQ_RESEARCH_PROOF_DATABASE_URL:'postgresql://iiq_research_proof_login:synthetic@evil.invalid/railway'},wrongLogin:{INTERVIEWIQ_RESEARCH_PROOF_DATABASE_URL:'postgresql://postgres:synthetic@postgres.railway.internal/railway'},queryOverride:{INTERVIEWIQ_RESEARCH_PROOF_DATABASE_URL:badEnv.INTERVIEWIQ_RESEARCH_PROOF_DATABASE_URL+'?host=evil.invalid'},missingCA:{}}))test('proof config rejects '+name,()=>assert.throws(()=>readResearchProofConfig({...badEnv,...delta})));
function stream(headers=['Content-Length','2'],url=RESEARCH_PROOF_PATH){const r=new PassThrough();r.method='POST';r.url=url;r.rawHeaders=headers;return r;}
test('exact bounded raw body preserved',async()=>{const r=stream(),p=readResearchProofBody(r);r.end('{}');assert.equal((await p).toString(),'{}');});
for(const [name,headers,body] of [['duplicate',['Content-Length','2','content-length','2'],'{}'],['missing',[],'{}'],['encoded',['Content-Length','2','Content-Encoding','gzip'],'{}'],['truncated',['Content-Length','3'],'{}'],['oversized',['Content-Length','2'],'{}x']])test('ingress refuses '+name,async()=>{const r=stream(headers),p=readResearchProofBody(r);r.end(body);await assert.rejects(p);});
test('exact service route stays separate from browser gateway and all aliases deny',async t=>{
 let calls=0,auth=0;const config={enabled:true,coreOnly:true,publicOrigin:'https://missionmedinstitute.com',gatewaySecret:'g'.repeat(40)};
 const server=createServer(createHandler({config,authorize:async()=>{auth++;throw Error('must not reach');},researchProof:{handle:async req=>{calls++;await readResearchProofBody(req);return {status:403,body:{error:'synthetic_proof_denied'}};}}}));await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port;
 const exact=await fetch(base+RESEARCH_PROOF_PATH,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(exact.status,403);assert.equal(calls,1);assert.equal(auth,0);
 for(const suffix of ['?x=1','/','%2f']){const r=await fetch(base+RESEARCH_PROOF_PATH+suffix,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.notEqual(r.status,200);}assert.equal(calls,1);assert.equal(auth,0);
 const browser=await fetch(base+'/api/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(browser.status,403);assert.equal(auth,0);
});

function catalogPool(change=()=>{}) {
 const allowed={actors:['id','wp_user_id'],interviews:['id','owner_id','program_id','status'],
  research_demands:['id','owner_id','interview_id','program_id','external_request_id'],
  research_job_grants:['request_id','owner_id','demand_id','interview_id','program_id','registry_release_id','request_sha256'],
  research_proof_nonces:['issuer','nonce','request_sha256','created_at','expires_at']};
 const columns=Object.entries(allowed).flatMap(([table,names])=>names.map(column=>({table_name:table,column_name:column,
  owner:'iiq_owner',kind:'r',rls:true,forced:true,persistence:'p',mutable:false,direct:false,
  readable:table!=='research_proof_nonces'||column==='nonce',insertable:table==='research_proof_nonces'})));
 change(columns);
 const safe={rolsuper:false,rolbypassrls:false,rolinherit:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false};
 return {connect:async()=>({query:async request=>{
  const sql=request.text;
  if(sql.includes('FROM pg_roles'))return {rows:[{...safe,name:'proof_login',login:true,rolcanlogin:true,member:true,can_set:true,proof_member:false},
    {...safe,name:'iiq_research_proof',login:false,rolcanlogin:false,member:true,can_set:true,proof_member:true}]};
  if(sql.includes('FROM pg_auth_members'))return {rows:[{role:'iiq_research_proof',member:'proof_login',admin_option:false,inherit_option:false,set_option:true}]};
  if(sql.includes("FROM pg_namespace WHERE nspname='iiq'"))return {rows:[{owned:true,usable:true,writable:false,public:false}]};
  if(sql.includes('AS column_name'))return {rows:columns};
  if(sql.includes('FROM pg_proc'))return {rows:[{safe:true}]};
  return {rows:[]};
 },release(){}})};
}

test('later app startup failure closes the qualified dedicated proof pool',async()=>{
 const old=pg.Pool;let created=0,closed=0;
 class FakePool{constructor(){created++;this.p=catalogPool();}on(){}async connect(){const c=await this.p.connect();c.connection={stream:{encrypted:true,authorized:true}};return c;}async end(){closed++;}}
 pg.Pool=FakePool;
 try{await assert.rejects(startApp({config:{enabled:true,coreOnly:true,port:-1,researchProof:{enabled:true,proofSecret:'p'.repeat(40),eligibilitySecret:'e'.repeat(40),pool:{}}},database:{verifyRuntimeRole:async()=>{},close:async()=>{}},owners:{},authorize:async()=>{throw Error('unused');}}));assert.equal(created,1);assert.equal(closed,1);}finally{pg.Pool=old;}
});
