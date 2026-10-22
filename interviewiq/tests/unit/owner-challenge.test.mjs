import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {SignJWT} from 'jose';
import {createAuthorizer,proof} from '../../server/auth.mjs';
import {readOwnerSession} from '../../server/owner-session.mjs';
const target='/api/calendar/cohort?start=2026-10-01&end=2026-10-31';
const digest=value=>createHash('sha256').update(value).digest('hex');
async function harness(){
 const config={jwtSecret:randomBytes(48).toString('hex'),ownerProofSecret:randomBytes(48).toString('hex'),jwtIssuer:'https://missionmedinstitute.com',ownerIntrospectionUrl:'https://missionmedinstitute.com/wp-json/missionmed-interviewiq/v1/introspect',ownerTimeoutMs:1000};
 const state={seconds:Math.floor(Date.now()/1000),calls:0,allowed:true};
 const claims={sub:randomUUID(),wp_user_id:42,app_role:'student',tier:'360',interviewiq_eligible:true,session_verifier:randomBytes(32).toString('hex')};
 const token=(change={})=>new SignJWT({...claims,...change}).setProtectedHeader({alg:'HS256',typ:'JWT'}).setIssuer(config.jwtIssuer).setAudience('interviewiq').setIssuedAt(state.seconds).setExpirationTime(state.seconds+60).setJti(randomUUID()).sign(new TextEncoder().encode(config.jwtSecret));
 const envelope=(body,change={})=>{const sent=JSON.parse(body),payload=JSON.stringify({audience:sent.audience,subject:sent.subject,wp_user_id:sent.wp_user_id,session_verifier:sent.session_verifier,nonce:sent.nonce,request_sha256:digest(body),allowed:state.allowed,role:claims.app_role,tier:claims.tier,assignment_student_ids:[],iat:state.seconds,exp:state.seconds+30,...change});return{payload,signature:proof(config.ownerProofSecret,'mmiiq-introspection-response-v1',payload)};};
 const options={now:()=>state.seconds*1000,fetchImpl:async(url,o)=>{state.calls++;assert.equal(url,config.ownerIntrospectionUrl);assert.equal(o.redirect,'error');return new Response(JSON.stringify(envelope(o.body)));}};
 const auth=createAuthorizer(config,options),jwt=await token();
 const request=(value=jwt)=>({method:'GET',url:target,headers:{authorization:`Bearer ${value}`},socket:{remoteAddress:'127.0.0.1'}});
 const issue=async(value=jwt,ip='127.0.0.1')=>{const req=request(value);req.socket.remoteAddress=ip;return auth.issueChallenge(req,target);};
 const local=(ticket,value=jwt,change={})=>{const req=request(value);req.headers['x-mmed-iiq-owner-challenge']=ticket.body.id;req.headers['x-mmed-iiq-owner-proof']=Buffer.from(JSON.stringify(envelope(ticket.body.payload,change))).toString('base64');return req;};
 const run=req=>auth(req,`${req.method} ${req.url.split('?')[0]}`);
 return{config,state,claims,auth,options,jwt,token,request,issue,local,run,envelope};
}
test('fresh canonical proof authorizes once without remote fetch and preserves owner-session binding',async()=>{
 const h=await harness(),ticket=await h.issue();assert.equal(ticket.status,200);assert.equal(ticket.body.signature,proof(h.config.ownerProofSecret,'mmiiq-introspection-request-v1',ticket.body.payload));
 const actor=await h.run(h.local(ticket));assert.equal(actor.id,h.claims.sub);assert.ok(readOwnerSession(actor,h.state.seconds*1000));assert.equal(h.state.calls,0);
 await assert.rejects(()=>h.run(h.local(ticket)),{code:'identity_owner_unavailable'});
});
test('simultaneous replay has exactly one successful atomic consume',async()=>{
 const h=await harness(),t=await h.issue(),result=await Promise.allSettled([h.run(h.local(t)),h.run(h.local(t))]);assert.equal(result.filter(x=>x.status==='fulfilled').length,1);assert.equal(h.state.calls,0);
});
test('exact JWT/session/method/path/raw-query/empty-body and complete header pair bind the challenge',async()=>{
 const changes=[async(h,r)=>{r.headers.authorization=`Bearer ${await h.token()}`;},async(h,r)=>{r.headers.authorization=`Bearer ${await h.token({session_verifier:'f'.repeat(64)})}`;},async(h,r)=>{r.method='POST';},async(h,r)=>{r.url=r.url.replace('/cohort?','/overview?');},async(h,r)=>{r.url='/api/calendar/cohort?end=2026-10-31&start=2026-10-01';},async(h,r)=>{r.headers['content-length']='1';},async(h,r)=>{r.headers['transfer-encoding']='chunked';},async(h,r)=>{delete r.headers['x-mmed-iiq-owner-challenge'];},async(h,r)=>{delete r.headers['x-mmed-iiq-owner-proof'];},async(h,r)=>{r.headers['x-mmed-iiq-owner-proof']='!';},async(h,r)=>{r.headers['x-mmed-iiq-owner-challenge']=randomUUID();}];
 for(const change of changes){const h=await harness(),t=await h.issue(),r=h.local(t);await change(h,r);await assert.rejects(()=>h.run(r),{code:'identity_owner_unavailable'});assert.equal(h.state.calls,0);}
});
test('canonical current-owner revocation/role/tier/mapping and signed proof validations still fail closed',async()=>{
 const cases=[{allowed:false},{role:'admin'},{tier:'ivprep_complete'},{subject:randomUUID()},{wp_user_id:43},{session_verifier:'f'.repeat(64)},{nonce:randomUUID()},{audience:'wrong'},{request_sha256:'0'.repeat(64)},{exp:0},{iat:Math.floor(Date.now()/1000)+20},{assignment_student_ids:['invalid']}];
 for(const change of cases){const h=await harness(),t=await h.issue();await assert.rejects(()=>h.run(h.local(t,h.jwt,change)));assert.equal(h.state.calls,0);}
 const h=await harness(),t=await h.issue(),r=h.local(t),e=JSON.parse(Buffer.from(r.headers['x-mmed-iiq-owner-proof'],'base64'));e.signature='0'.repeat(64);r.headers['x-mmed-iiq-owner-proof']=Buffer.from(JSON.stringify(e)).toString('base64');await assert.rejects(()=>h.run(r));await assert.rejects(()=>h.run(h.local(t)));assert.equal(h.state.calls,0);
});
test('expiry, restart and wrong instance cannot use a challenge or silently fall back',async()=>{
 for(const mode of ['expiry','restart']){const h=await harness(),t=await h.issue(),r=h.local(t);if(mode==='expiry')h.state.seconds+=10;else h.auth=createAuthorizer(h.config,h.options);await assert.rejects(()=>h.auth(r,'GET /api/calendar/cohort'),{code:'identity_owner_unavailable'});assert.equal(h.state.calls,0);}
});
test('per-JWT capacity and expiry cleanup are bounded; unavailable is signed and exact session/target bound',async()=>{
 const h=await harness();for(let i=0;i<4;i++)assert.equal((await h.issue()).status,200);const r=await h.issue();assert.equal(r.status,503);assert.equal(r.body.signature,proof(h.config.ownerProofSecret,'mmiiq-owner-challenge-unavailable-v1',r.body.payload));const p=JSON.parse(r.body.payload);assert.equal(p.jwt_sha256,digest(h.jwt));assert.equal(p.session_verifier,h.claims.session_verifier);assert.equal(p.target,target);assert.equal(p.exp-p.iat,10);h.state.seconds+=10;assert.equal((await h.issue()).status,200);
});
test('per-requester and global capacity apply across unique valid JWTs',async()=>{
 const h=await harness();for(let i=0;i<64;i++)assert.equal((await h.issue(await h.token(),'same-requester')).status,200);assert.equal((await h.issue(await h.token(),'same-requester')).status,503);
 for(let i=64;i<256;i++)assert.equal((await h.issue(await h.token(),`requester-${i}`)).status,200);assert.equal((await h.issue(await h.token(),'new-requester')).status,503);
});
test('invalid JWT rejects before issuance; unsupported mentor is typed signed unavailable, normal remote path stays fresh',async()=>{
 const h=await harness();await assert.rejects(()=>h.issue('invalid'));assert.equal(h.state.calls,0);
 const mentor=await h.token({app_role:'mentor',tier:'assigned_mentor'});assert.equal((await h.issue(mentor)).status,503);
 const req=h.request();req.url='/api/bootstrap';await h.run(req);h.state.allowed=false;await assert.rejects(()=>h.run(req),{code:'session_unavailable'});assert.equal(h.state.calls,2);
});
