import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request as httpRequest} from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createAuthorizer,proof} from '../../server/auth.mjs';
import {createHandler} from '../../server/http.mjs';
const origin='https://missionmedinstitute.com',range='?start=2026-10-01&end=2026-10-31',peer='22222222-2222-4222-8222-222222222222';
const config={enabled:true,coreOnly:true,calendar:{enabled:true},release:'synthetic-owner-get',maxBodyBytes:262144,
 publicOrigin:origin,jwtIssuer:origin,jwtSecret:'synthetic-jwt-key-only-for-local-tests-aaaaaaaa',
 ownerProofSecret:'synthetic-proof-key-only-for-local-tests-bbbbbbbb',gatewaySecret:'synthetic-gateway-key-only-for-local-tests-cccccc',
 ownerIntrospectionUrl:origin+'/wp-json/missionmed-interviewiq/v1/introspect',ownerTimeoutMs:1000};
let api,php,base,apiBase,jwt,apiPort;
const counts={requests:[],remote:0,admission:0,db:0,mutations:0};
const reset=()=>{counts.requests=[];counts.remote=counts.admission=counts.db=counts.mutations=0;};
before(async()=>{
 const authorize=createAuthorizer(config,{fetchImpl:async(url,o)=>{
  counts.remote++;assert.equal(url,config.ownerIntrospectionUrl);
  const s=JSON.parse(o.body),now=Math.floor(Date.now()/1000),payload=JSON.stringify({audience:s.audience,subject:s.subject,wp_user_id:s.wp_user_id,session_verifier:s.session_verifier,nonce:s.nonce,request_sha256:createHash('sha256').update(o.body).digest('hex'),allowed:true,role:'student',tier:'360',assignment_student_ids:[],iat:now,exp:now+30});
  return new Response(JSON.stringify({payload,signature:proof(config.ownerProofSecret,'mmiiq-introspection-response-v1',payload)}));
 }});
 const event={event_ref:'33333333-3333-4333-8333-333333333333',owner_id:peer,wp_user_id:43,program_name:'Synthetic peer program',local_date:'2026-10-20',event_type:'INTERVIEW',lifecycle:'scheduled'};
 const database={withActor:async(actor,fn)=>fn({query:async sql=>{counts.db++;return{rows:sql.includes('calendar_candidates')||sql.includes('calendar_public')?[event]:[]};}})};
 const calendarAdmission=async(actor,pairs)=>{counts.admission++;return{pairs:pairs.map(p=>({...p,allowed:true}))};};
 const commands={bootstrap:async actor=>({actor:{id:actor.id,role:actor.role,tier:actor.tier},state:{interviews:[{id:'synthetic-existing-draft'}]},workspacePhase:'calendar'}),execute:async()=>{counts.mutations++;return{};}};
 const handler=createHandler({config,database,authorize,commands,calendarAdmission});
 api=createServer((req,res)=>{counts.requests.push({path:req.url,method:req.method,proof:!!req.headers['x-mmed-iiq-owner-proof']});void handler(req,res);});
 await new Promise(r=>api.listen(0,'127.0.0.1',r));apiPort=api.address().port;apiBase=`http://127.0.0.1:${apiPort}`;
 const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));base=`http://127.0.0.1:${port}`;
 php=spawn(process.env.IIQ_PHP_BIN||'php',['-S',`127.0.0.1:${port}`,fileURLToPath(new URL('./http-fixture.php',import.meta.url))],{stdio:['ignore','ignore','pipe']});let errors='';php.stderr.on('data',x=>{errors=(errors+x).slice(-2000);});
 await new Promise((resolve,reject)=>{const end=Date.now()+5000;const probe=async()=>{try{await fetch(base);resolve();}catch{if(php.exitCode!==null||Date.now()>end)reject(Error(errors));else setTimeout(probe,30);}};void probe();});
 const token=await fetch(base+'/wp-admin/admin-ajax.php?action=missionmed_interviewiq_token',{method:'POST',headers:{Origin:origin,'X-IIQ-Nonce':'synthetic-wp-nonce','Content-Type':'application/json'},body:'{}'});assert.equal(token.status,200);jwt=(await token.json()).token;
});
after(async()=>{if(php&&php.exitCode===null){const ended=new Promise(r=>php.once('exit',r));php.kill('SIGTERM');await ended;}if(api)await new Promise(r=>api.close(r));});
const browserHeaders=(mode='',extra={})=>({Origin:origin,Authorization:`Bearer ${jwt}`,'X-IIQ-Nonce':'synthetic-wp-nonce','Content-Type':'application/json','X-Fixture-Calendar':'1','X-Fixture-Owner-API':String(apiPort),'X-Fixture-Owner-Mode':mode,...extra});
async function call(path='/interviewiq/api/calendar/cohort'+range,mode='',options={}){const r=await fetch(base+path,{headers:browserHeaders(mode),...options});return{status:r.status,body:await r.json(),timing:r.headers.get('server-timing'),cache:r.headers.get('cache-control')};}
const apiHeaders=()=>({Origin:origin,Authorization:`Bearer ${jwt}`,'X-MMED-IIQ-Gateway':config.gatewaySecret,'Content-Type':'application/json'});
test('real HTTP gateway challenge + unchanged canonical callback authorizes GET with both fresh peer checks',async()=>{
 reset();const r=await call();assert.equal(r.status,200);assert.equal(r.body.events.length,1);assert.equal(r.body.events[0].program_name,'Synthetic peer program');assert.equal(counts.remote,0);assert.equal(counts.admission,2);
 assert.deepEqual(counts.requests.map(x=>[x.method,x.path,x.proof]),[['POST','/api/owner-challenge',false],['GET','/api/calendar/cohort'+range,true]]);assert.match(r.cache,/no-store/);assert.match(r.timing,/^iiq_owner;dur=/);assert.equal(r.body.payload,undefined);assert.equal(r.body.signature,undefined);
});
test('typed legacy unsupported and signed capacity each permit exactly one unchanged remote GET',async()=>{
 for(const mode of ['legacy','capacity']){reset();const r=await call(undefined,mode);assert.equal(r.status,200,mode);assert.equal(counts.remote,1);assert.equal(counts.admission,2);assert.equal(counts.requests.filter(x=>x.method==='GET').length,1);assert.equal(counts.requests.some(x=>x.proof),false);}
});
test('timeout, generic503, unbound unavailable and legacy header mismatch never fall back or execute domain',async()=>{
 for(const mode of ['timeout','generic503','bad-capacity','legacy-header']){reset();const r=await call(undefined,mode);assert.equal(r.status,502,mode);assert.equal(counts.remote,0);assert.equal(counts.requests.filter(x=>x.method==='GET').length,0);assert.equal(counts.db,0);}
});
test('unchanged permission rejects bad request signature; canonical revocation denies without retry or domain execution',async()=>{
 for(const [mode,status] of [['signature',403],['revoked',401]]){reset();const r=await call(undefined,mode);assert.equal(r.status,status,mode);assert.equal(counts.remote,0);assert.equal(counts.db,0);assert.ok(counts.requests.filter(x=>x.method==='GET').length<=1);}
});
test('noncePOST startup internal bootstrap GET remains REMOTE and compatible; ordinary bootstrap also unchanged',async()=>{
 reset();const q='action=missionmed_interviewiq_token&iiq_calendar=1&start=2026-10-01&end=2026-10-31';const r=await call('/wp-admin/admin-ajax.php?'+q,'',{method:'POST',headers:browserHeaders(),body:'{}'});assert.equal(r.status,200);assert.equal(r.body.calendarStartup.bootstrap.state.interviews[0].id,'synthetic-existing-draft');assert.equal(counts.remote,1);assert.equal(counts.admission,2);assert.equal(counts.requests.length,1);assert.equal(counts.requests[0].proof,false);assert.match(counts.requests[0].path,/^\/api\/bootstrap\?/);
 reset();assert.equal((await call('/interviewiq/api/bootstrap?view=calendar')).status,200);assert.equal(counts.remote,1);assert.equal(counts.requests.length,1);assert.equal(counts.requests[0].proof,false);
});
test('all reserved proof headers are rejected on ordinary reads, mutations, legacy token and dated startup',async()=>{
 for(const name of ['X-MMED-IIQ-Gateway','X-MMED-IIQ-Proof','X-MMED-IIQ-Owner-Proof','X-MMED-IIQ-Owner-Challenge'])for(const [path,method] of [['/interviewiq/api/calendar/cohort'+range,'GET'],['/interviewiq/api/commands','POST'],['/wp-admin/admin-ajax.php?action=missionmed_interviewiq_token','POST'],['/wp-admin/admin-ajax.php?action=missionmed_interviewiq_token&iiq_calendar=1&start=2026-10-01&end=2026-10-31','POST']]){
  reset();const r=await call(path,'',{method,headers:browserHeaders('',{[name]:'injected'}),...(method==='POST'?{body:'{}'}:{})});assert.equal(r.status,400,`${name} ${path}`);assert.equal(counts.requests.length,0);assert.equal(counts.mutations,0);
 }
});
test('server-only challenge endpoint rejects gateway/origin/JWT/target/range/query changes before data reads',async()=>{
 for(const [headers,target] of [[{...apiHeaders(),'X-MMED-IIQ-Gateway':'wrong'},'/api/calendar/cohort'+range],[{...apiHeaders(),Origin:'https://other.invalid'},'/api/calendar/cohort'+range],[{...apiHeaders(),Authorization:'Bearer invalid'},'/api/calendar/cohort'+range],[apiHeaders(),'/api/commands'],[apiHeaders(),'/api/bootstrap?view=calendar&start=2026-10-01&end=2026-10-31'],[apiHeaders(),'/api/calendar/cohort?start=2026-02-30&end=2026-03-01'],[apiHeaders(),'/api/calendar/cohort'+range+'&start=2026-10-02'],[apiHeaders(),'/api/calendar/overview'+range+'&owner=someone']]){
  reset();const r=await fetch(apiBase+'/api/owner-challenge',{method:'POST',headers,body:JSON.stringify({target})});assert.notEqual(r.status,200);assert.equal(counts.db,0);assert.equal(counts.remote,0);
 }
});
test('GET with actual nonempty body is denied by gateway before issuance',async()=>{
 reset();const result=await new Promise((resolve,reject)=>{const req=httpRequest(base+'/interviewiq/api/calendar/cohort'+range,{method:'GET',headers:browserHeaders('',{'Content-Length':'1'})},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end('x');});assert.equal(result,400);assert.equal(counts.requests.length,0);
});
