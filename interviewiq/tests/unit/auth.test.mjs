import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {SignJWT} from 'jose';
import {createAuthorizer,proof} from '../../server/auth.mjs';
const seconds=1791000000;
function harness(change={}) {
  const config={jwtSecret:randomBytes(48).toString('hex'),ownerProofSecret:randomBytes(48).toString('hex'),jwtIssuer:'https://missionmedinstitute.com',ownerIntrospectionUrl:'https://missionmedinstitute.com/wp-json/missionmed-interviewiq/v1/introspect',ownerTimeoutMs:1000};
  const state={calls:0,allowed:true,last:null,...change};
  const claims={sub:randomUUID(),wp_user_id:1101,app_role:'student',tier:'360',interviewiq_eligible:true,session_verifier:randomBytes(32).toString('hex'),name:'Synthetic tester',first_name:'Synthetic'};
  const envelope=raw=>{
    const request=JSON.parse(raw);
    const obj={audience:request.audience,subject:request.subject,wp_user_id:request.wp_user_id,session_verifier:request.session_verifier,nonce:request.nonce,request_sha256:createHash('sha256').update(raw).digest('hex'),allowed:state.allowed,role:'student',tier:'360',assignment_student_ids:[],iat:seconds,exp:seconds+30,...state.reply};
    const payload=JSON.stringify(obj);
    return {payload,signature:proof(config.ownerProofSecret,'mmiiq-introspection-response-v1',payload)};
  };
  const fetchImpl=async(url,options)=>{
    state.calls++;
    assert.equal(url,config.ownerIntrospectionUrl);
    assert.equal(options.redirect,'error');
    assert.equal(options.headers['X-MMED-IIQ-Proof'],proof(config.ownerProofSecret,'mmiiq-introspection-request-v1',options.body));
    if(state.throw) throw new Error('Provider connection failed');
    let value=state.replay || envelope(options.body);
    state.last=value;
    if(state.tamper) value={...value,payload:value.payload.replace('360','administrator')};
    return new Response(state.oversize?'x'.repeat(70000):JSON.stringify(value),{status:state.status||200});
  };
  const token=async(overrides={},options={})=>new SignJWT({...claims,...overrides}).setProtectedHeader({alg:'HS256',typ:'JWT'}).setIssuer(options.issuer||config.jwtIssuer).setAudience(options.audience||'interviewiq').setIssuedAt(options.iat??seconds).setExpirationTime(options.exp??seconds+60).setJti(randomUUID()).sign(new TextEncoder().encode(config.jwtSecret));
  const authorize=createAuthorizer(config,{fetchImpl,now:()=>seconds*1000});
  const run=async(t)=>authorize({headers:{authorization:`Bearer ${t||await token()}`}},'GET /api/bootstrap');
  return {config,state,claims,token,run};
}
test('every request rechecks current owner; logout revocation is not cached',async()=>{
  const h=harness(),t=await h.token();
  const actor=await h.run(t);assert.equal(actor.id,h.claims.sub);assert.equal(actor.tier,'360');
  assert.equal('session_verifier' in actor,false);
  h.state.allowed=false;await assert.rejects(()=>h.run(t),{code:'session_unavailable'});
  assert.equal(h.state.calls,2);
});
test('signed owner response cannot be replayed for another nonce',async()=>{
  const h=harness();await h.run();h.state.replay=h.state.last;
  await assert.rejects(()=>h.run(),{code:'identity_owner_unavailable'});
});
for(const [name,reply] of Object.entries({wrongSubject:{subject:randomUUID()},wrongSession:{session_verifier:'f'.repeat(64)},wrongWp:{wp_user_id:1202},wrongAudience:{audience:'ivoc'},wrongRequest:{request_sha256:'0'.repeat(64)},expired:{exp:seconds},future:{iat:seconds+10},longTTL:{exp:seconds+31}}))
 test(`owner proof ${name} fails closed`,async()=>{const h=harness({reply});await assert.rejects(()=>h.run(),{code:'identity_owner_unavailable'});});
test('tampered owner response and unavailable owner fail closed',async()=>{
  for(const change of [{tamper:true},{throw:true},{oversize:true},{status:503}]) {
    const h=harness(change);await assert.rejects(()=>h.run(),{code:'identity_owner_unavailable'});
  }
});
test('role changes require token refresh; malformed assignment is denied',async()=>{
  for(const reply of [{role:'admin'},{tier:'ivprep_complete'},{assignment_student_ids:['not-a-uuid']}]) {
    const h=harness({reply});await assert.rejects(()=>h.run(),{code:'session_unavailable'});
  }
});
test('wrong audience, expired or long-lived token is rejected before owner call',async()=>{
  for(const options of [{audience:'storyforge'},{issuer:'https://attacker.invalid'},{exp:seconds-10,iat:seconds-70},{exp:seconds+600},{iat:seconds+10,exp:seconds+70}]){
    const h=harness();
    const t=await h.token({},options);await assert.rejects(()=>h.run(t),{code:'session_unavailable'});assert.equal(h.state.calls,0);
  }
});
test('malformed and client-altered token claims cannot become a session',async()=>{
  for(const claims of [{sub:'Student-A'},{interviewiq_eligible:false},{wp_user_id:'1101'},{app_role:'superadmin'},{session_verifier:'bad'}]){
    const h=harness();
    const t=await h.token(claims);await assert.rejects(()=>h.run(t),{code:'session_unavailable'});assert.equal(h.state.calls,0);
  }
});
