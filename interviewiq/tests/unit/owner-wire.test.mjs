import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash,createHmac} from 'node:crypto';
import {inspect} from 'node:util';
import {SignJWT} from 'jose';
import {createAuthorizer,proof} from '../../server/auth.mjs';
import {readOwnerSession} from '../../server/owner-session.mjs';
import {createRiseOwner} from '../../server/rise-owner.mjs';
import {MRX_AREAS,buildResearchMission,researchMissionMatches} from '../../server/research-standard.mjs';

const seconds=1791000000,origin='https://missionmed-rise-production.up.railway.app';
const program={id:'rise:IM:1234567890',name:'Synthetic Program',track:'Internal Medicine',registryReleaseId:'synthetic_registry_v1'};
const json=(value,options={})=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'},...options});
async function fixture({role='student',tier='360',jwtTTL=60}={}) {
  const config={jwtSecret:randomBytes(48).toString('hex'),ownerProofSecret:randomBytes(48).toString('hex'),jwtIssuer:'https://missionmedinstitute.com',ownerIntrospectionUrl:'https://missionmedinstitute.com/wp-json/missionmed-interviewiq/v1/introspect',ownerTimeoutMs:1000};
  const claims={sub:randomUUID(),wp_user_id:1701,app_role:role,tier,interviewiq_eligible:true,session_verifier:randomBytes(32).toString('hex')};
  const token=await new SignJWT(claims).setProtectedHeader({alg:'HS256',typ:'JWT'}).setIssuer(config.jwtIssuer).setAudience('interviewiq').setIssuedAt(seconds).setExpirationTime(seconds+jwtTTL).setJti(randomUUID()).sign(new TextEncoder().encode(config.jwtSecret));
  let time=seconds*1000;
  const authorize=createAuthorizer(config,{now:()=>time,fetchImpl:async(_url,options)=>{
    const input=JSON.parse(options.body),payload=JSON.stringify({audience:input.audience,subject:claims.sub,wp_user_id:claims.wp_user_id,
      session_verifier:claims.session_verifier,nonce:input.nonce,request_sha256:createHash('sha256').update(options.body).digest('hex'),
      allowed:true,role,tier,assignment_student_ids:[],iat:seconds,exp:seconds+30});
    return json({payload,signature:proof(config.ownerProofSecret,'mmiiq-introspection-response-v1',payload)});
  }});
  const actor=await authorize({headers:{authorization:`Bearer ${token}`}},'GET /api/programs');
  const requestSecret=randomBytes(48).toString('hex'),calls=[];
  const client=(response=()=>json(program),settings={})=>createRiseOwner({enabled:true,requestSecret,...settings},{now:()=>time,fetchImpl:async(url,options)=>{calls.push({url,options});return response(url,options);}});
  return {actor,claims,calls,client,requestSecret,advance:ms=>{time+=ms;},now:()=>time};
}

test('verified session context never appears in actor serialization, spread or inspection',async()=>{
  const h=await fixture();assert.ok(Object.isFrozen(h.actor));assert.equal('session_verifier' in h.actor,false);
  assert.equal(readOwnerSession(h.actor,h.now()).verifier,h.claims.session_verifier);
  for(const output of [JSON.stringify(h.actor),JSON.stringify({...h.actor}),inspect(h.actor,{showHidden:true}),JSON.stringify({actor:h.actor})])
    assert.ok(!output.includes(h.claims.session_verifier));
  assert.equal(Object.getOwnPropertySymbols(h.actor).length,0);
});
test('signed request matches exact DR-367 bytes and excludes browser credentials',async()=>{
  const h=await fixture();await h.client().getProgram(h.actor,program.id);
  const {url,options}=h.calls[0],headers=options.headers;
  assert.equal(url,`${origin}/api/rise/v1/interviewiq/programs/rise%3AIM%3A1234567890`);
  assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');assert.equal(options.body,undefined);
  const actorJson=Buffer.from(headers['X-MMED-IIQ-Actor'],'base64url').toString();
  assert.deepEqual(JSON.parse(actorJson),{subject:h.actor.id,wp_user_id:h.actor.wpUserId,session_verifier:h.claims.session_verifier,auth_role:'student',auth_tier:'360'});
  const sha=s=>createHash('sha256').update(s).digest('hex');
  const canonical=`iiq-owner-v1\nrise\n${seconds}\n${headers['X-MMED-IIQ-Nonce']}\nGET\n${new URL(url).pathname}\n${sha('')}\n${sha(actorJson)}`;
  assert.equal(headers['X-MMED-IIQ-Signature'],createHmac('sha256',h.requestSecret).update(canonical).digest('hex'));
  assert.equal(headers.Cookie,undefined);assert.equal(headers.Origin,undefined);assert.equal(headers.Authorization,undefined);
});
test('new attempt gets a fresh nonce without changing stable canonical identity',async()=>{
  const h=await fixture(),owner=h.client();await owner.getProgram(h.actor,program.id);await owner.getProgram(h.actor,program.id);
  assert.notEqual(h.calls[0].options.headers['X-MMED-IIQ-Nonce'],h.calls[1].options.headers['X-MMED-IIQ-Nonce']);
  assert.equal(h.calls[0].url,h.calls[1].url);
});
test('forged, JSON-cloned and spread actor objects cannot borrow verified context',async()=>{
  const h=await fixture();for(const actor of [{...h.actor},JSON.parse(JSON.stringify(h.actor)),Object.freeze({...h.actor}),{}])
    await assert.rejects(h.client().getProgram(actor,program.id),{code:'owner_session_required'});
  assert.equal(h.calls.length,0);
});
for(const jwtTTL of [10,60])test(`session expires at earlier JWT/proof boundary with JWT TTL ${jwtTTL}`,async()=>{
  const h=await fixture({jwtTTL});h.advance(Math.min(jwtTTL,30)*1000);
  await assert.rejects(h.client().getProgram(h.actor,program.id),{code:'owner_session_required'});assert.equal(h.calls.length,0);
});
for(const [role,tier,allowed] of [['student','360',true],['student','ivprep_complete',true],['admin','admin',true],['mentor','assigned_mentor',false],['admin','360',false],['student','admin',false]])
test(`owner client role floor ${role}/${tier}`,async()=>{
  const h=await fixture({role,tier});if(allowed)assert.deepEqual(await h.client().getProgram(h.actor,program.id),program);
  else {await assert.rejects(h.client().getProgram(h.actor,program.id),{code:'owner_session_required'});assert.equal(h.calls.length,0);}
});
test('disabled or unconfigured clients never call the network',async()=>{
  const h=await fixture();for(const settings of [{enabled:false},{enabled:'true'},{requestSecret:''},{requestSecret:'short'}])
    await assert.rejects(h.client(undefined,settings).getProgram(h.actor,program.id),{code:'owner_service_unavailable'});
  assert.equal(h.calls.length,0);
});
test('program namespace cannot be escaped with URL, separator, encoding or dot input',async()=>{
  const h=await fixture();for(const id of ['.','..','../x','x/../y','x\\y','%2e%2e','https://evil.example','x?admin=1','x#frag','a\n',null,123,'x'.repeat(181)])
    await assert.rejects(h.client().getProgram(h.actor,id),{code:'invalid_owner_request'});
  assert.equal(h.calls.length,0);
});
test('search encodes scalar query safely and projects only canonical identities',async()=>{
  const h=await fixture(),query={q:'New York & medicine?',page:2,pageSize:1};
  const result=await h.client(()=>json({registryReleaseId:program.registryReleaseId,page:2,total:4,programs:[{...program,privateNotes:'SECRET'}],privateMetadata:'SECRET'})).searchPrograms(h.actor,query);
  assert.deepEqual(result,{registryReleaseId:program.registryReleaseId,page:2,total:4,programs:[{...program,specialty:null,acgmeId:null}]});
  const u=new URL(h.calls[0].url);assert.equal(u.origin,origin);assert.equal(u.pathname,'/api/rise/v1/interviewiq/programs');
  assert.equal(u.searchParams.get('q'),query.q);assert.equal(u.searchParams.get('page'),'2');
});
test('search rejects malformed pagination, unknown fields and prototype inputs',async()=>{
  const h=await fixture();for(const query of [{q:'x'.repeat(257)},{q:'a\n'},{page:0},{page:1.5},{page:10001},{pageSize:21},{page:'1'},{url:'https://evil.example'},[],Object.create(null),JSON.parse('{"__proto__":{}}')])
    await assert.rejects(h.client().searchPrograms(h.actor,query),{code:'invalid_owner_request'});
  assert.equal(h.calls.length,0);
});
test('owner evidence and private metadata are never spread into identity',async()=>{
  const h=await fixture();const result=await h.client(()=>json({...program,facts:[{verified:true,text:'UNVALIDATED'}],sources:[{secret:'PRIVATE'}],status:'verified',session_verifier:'SECRET'})).getProgram(h.actor,program.id);
  assert.deepEqual(result,program);assert.ok(!JSON.stringify(result).includes('UNVALIDATED'));
});
test('mismatched, missing, duplicate or inconsistent program/release identity is denied',async()=>{
  const h=await fixture();for(const value of [{...program,id:'other'},{...program,name:''},{...program,track:null},{...program,registryReleaseId:null},{...program,name:'a\u0000'}])
    await assert.rejects(h.client(()=>json(value)).getProgram(h.actor,program.id),{code:'invalid_owner_response'});
  for(const value of [
    {registryReleaseId:'other',programs:[program],page:1,total:1},
    {registryReleaseId:program.registryReleaseId,programs:[program,program],page:1,total:2},
    {registryReleaseId:program.registryReleaseId,programs:[program],page:2,total:1},
    {registryReleaseId:program.registryReleaseId,programs:[program],page:1,total:-1}])
    await assert.rejects(h.client(()=>json(value)).searchPrograms(h.actor),{code:'invalid_owner_response'});
});
test('nonJSON, invalid JSON, dangerous keys, invalid UTF8 and redirects fail closed',async()=>{
  const h=await fixture();const responses=[
    ()=>new Response('not json',{headers:{'Content-Type':'text/html'}}),
    ()=>new Response('{broken',{headers:{'Content-Type':'application/json'}}),
    ()=>new Response('{"__proto__":{}}',{headers:{'Content-Type':'application/json'}}),
    ()=>new Response(new Uint8Array([255,254]),{headers:{'Content-Type':'application/json'}}),
    ()=>json(program,{status:302}),
    ()=>{const response=json(program);Object.defineProperty(response,'redirected',{value:true});return response;},
  ];for(const response of responses)await assert.rejects(h.client(response).getProgram(h.actor,program.id),{code:'owner_service_unavailable'});
});
test('claimed and chunked oversized bodies are denied',async()=>{
  const h=await fixture();
  const responses=[()=>json(program,{headers:{'Content-Type':'application/json','Content-Length':'1048577'}}),
    ()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(700000));c.enqueue(new Uint8Array(700000));c.close();}}),{headers:{'Content-Type':'application/json'}})];
  for(const response of responses)await assert.rejects(h.client(response).getProgram(h.actor,program.id),{code:'owner_service_unavailable'});
});
test('errors never disclose service details, key or session material',async()=>{
  const h=await fixture();for(const response of [()=>{throw Error(h.requestSecret+h.claims.session_verifier);},()=>json({error:h.requestSecret},{status:503})]) {
    await assert.rejects(h.client(response).getProgram(h.actor,program.id),e=>{
      assert.ok(!inspect(e).includes(h.requestSecret));assert.ok(!inspect(e).includes(h.claims.session_verifier));return e.code==='owner_service_unavailable';
    });
  }
});
test('session that expires during owner response is not returned',async()=>{
  const h=await fixture();await assert.rejects(h.client(()=>{h.advance(31000);return json(program);}).getProgram(h.actor,program.id),{code:'owner_service_unavailable'});
});
test('five-second deadline aborts a stalled transport cleanly',async()=>{
  const h=await fixture();let signal;
  await assert.rejects(h.client((_url,options)=>{signal=options.signal;return new Promise(()=>{});}).getProgram(h.actor,program.id),{code:'owner_service_unavailable'});
  assert.equal(signal.aborted,true);
});

function coverage(h){
  const body={programId:program.id,registryReleaseId:program.registryReleaseId,observedAt:new Date(h.now()).toISOString(),
    fields:Object.entries(MRX_AREAS).flatMap(([area,fields])=>fields.map(field=>({area,field,state:field==='research.visa'?'UNKNOWN':'SUPPORTED'}))).sort((a,b)=>a.field.localeCompare(b.field,'en'))};
  return {...body,receipt:{sha256:createHash('sha256').update(JSON.stringify(body)).digest('hex'),publicRef:'rise-coverage-v1'}};
}
for(const [role,tier] of [['student','360'],['student','ivprep_complete'],['admin','admin']])
test(`coverage uses authenticated owner detail for ${role}/${tier} and feeds immutable mission`,async()=>{
  const h=await fixture({role,tier}),c=coverage(h);
  const owner=h.client(()=>json({...program,researchCoverage:{...c,private:'DO_NOT_EXPORT'},private:'DO_NOT_EXPORT'}),{researchCoverageEnabled:true});
  const result=await owner.getResearchCoverage(h.actor,program.id);
  assert.deepEqual(result,{program,coverage:c});assert.equal(h.calls.length,1);
  assert.equal(h.calls[0].url,`${origin}/api/rise/v1/interviewiq/programs/rise%3AIM%3A1234567890`);
  assert.ok(h.calls[0].options.headers['X-MMED-IIQ-Signature']);
  assert.equal(Object.isFrozen(result.coverage.fields[0]),true);assert.throws(()=>result.coverage.fields.pop());
  const packet=buildResearchMission({...result,missionId:randomUUID(),now:h.now()});
  h.advance(1000);assert.equal(researchMissionMatches(packet,{program,coverage:coverage(h),now:h.now()}),true);
  assert.doesNotMatch(JSON.stringify(result),/DO_NOT_EXPORT/);
});
test('coverage has its own strict default-off switch and cannot bypass owner enabled',async()=>{
  const h=await fixture();
  for(const setting of [undefined,false,'true',1])await assert.rejects(h.client(undefined,{researchCoverageEnabled:setting}).getResearchCoverage(h.actor,program.id),{code:'research_coverage_unavailable'});
  await assert.rejects(h.client(undefined,{researchCoverageEnabled:true,enabled:false}).getResearchCoverage(h.actor,program.id),{code:'owner_service_unavailable'});
  assert.equal(h.calls.length,0);
});
for(const [role,tier] of [['mentor','assigned_mentor'],['admin','360'],['student','admin']])
test(`coverage denies mismatched or unentitled ${role}/${tier}`,async()=>{
  const h=await fixture({role,tier});await assert.rejects(h.client(undefined,{researchCoverageEnabled:true}).getResearchCoverage(h.actor,program.id),{code:'owner_session_required'});assert.equal(h.calls.length,0);
});
test('coverage rejects a copied principal and a session expiring during the request',async()=>{
  const h=await fixture(),owner=h.client(()=>{h.advance(31000);return json({...program,researchCoverage:coverage(h)});},{researchCoverageEnabled:true});
  await assert.rejects(owner.getResearchCoverage({...h.actor},program.id),{code:'owner_session_required'});assert.equal(h.calls.length,0);
  await assert.rejects(owner.getResearchCoverage(h.actor,program.id),{code:'owner_service_unavailable'});
});
for(const [label,mutate] of [
  ['missing',x=>delete x.researchCoverage],['wrong identity',x=>x.id='other'],['empty track',x=>x.track=''],
  ['wrong program',x=>x.researchCoverage.programId='other'],['wrong release',x=>x.researchCoverage.registryReleaseId='other'],
  ['missing field',x=>x.researchCoverage.fields.pop()],['duplicate',x=>x.researchCoverage.fields[0]=x.researchCoverage.fields[1]],
  ['unsupported state',x=>x.researchCoverage.fields[0].state='VERIFIED'],['cross area',x=>x.researchCoverage.fields[0].area='visa'],
  ['bad hash',x=>x.researchCoverage.receipt.sha256='a'.repeat(64)],['wrong label',x=>x.researchCoverage.receipt.publicRef='other'],
  ['future time',x=>x.researchCoverage.observedAt=new Date(seconds*1000+1).toISOString()],
  ['old time',x=>x.researchCoverage.observedAt=new Date(seconds*1000-300001).toISOString()],
  ['bad time',x=>x.researchCoverage.observedAt='2026-02-30T00:00:00.000Z'],
])test(`coverage fails closed for ${label} without UNKNOWN fallback`,async()=>{
  const h=await fixture(),body={...program,researchCoverage:coverage(h)};mutate(body);
  await assert.rejects(h.client(()=>json(body),{researchCoverageEnabled:true}).getResearchCoverage(h.actor,program.id),e=>{
    assert.equal(e.code,'research_coverage_unavailable');assert.doesNotMatch(inspect(e),/DO_NOT_EXPORT/);return true;
  });
});
test('coverage metadata stays excluded from ordinary identity detail and search',async()=>{
  const h=await fixture(),body={...program,researchCoverage:coverage(h)};
  assert.deepEqual(await h.client(()=>json(body),{researchCoverageEnabled:true}).getProgram(h.actor,program.id),program);
  assert.deepEqual((await h.client(()=>json({registryReleaseId:program.registryReleaseId,programs:[body],page:1,total:1}),{researchCoverageEnabled:true}).searchPrograms(h.actor)).programs,[{...program,specialty:null,acgmeId:null}]);
});


test('public registry labels are allowlisted for search while detail binding stays unchanged',async()=>{
 const h=await fixture(),wire={...program,track:'',specialty:'Internal Medicine',acgmeId:'1401611122',hidden:{student:'never output'}};
 const detail=await h.client(()=>json(wire)).getProgram(h.actor,program.id);
 assert.deepEqual(detail,{...program,track:''});
 const result=await h.client(()=>json({registryReleaseId:program.registryReleaseId,programs:[wire],page:1,total:1})).searchPrograms(h.actor);
 assert.deepEqual(result.programs,[{...program,track:'',specialty:'Internal Medicine',acgmeId:'1401611122'}]);
 assert.doesNotMatch(JSON.stringify(result),/hidden|student|never output/);
});
test('old identities and nullable public labels remain compatible',async()=>{
 const h=await fixture();
 for(const wire of [program,{...program,specialty:null,acgmeId:null}]){
  assert.deepEqual(await h.client(()=>json(wire)).getProgram(h.actor,program.id),program);
  const result=await h.client(()=>json({registryReleaseId:program.registryReleaseId,programs:[wire],page:1,total:1})).searchPrograms(h.actor);
  assert.deepEqual(result.programs,[{...wire,specialty:wire.specialty??null,acgmeId:wire.acgmeId??null}]);
 }
});
test('malformed public labels cannot cross a signed canonical identity',async()=>{
 const h=await fixture();
 for(const patch of [{specialty:''},{specialty:' '},{specialty:'x'.repeat(181)},{specialty:[]},{specialty:'IM\nsecret'},{acgmeId:''},{acgmeId:1401611122},{acgmeId:'140161112'},{acgmeId:'1401611122\n'},{acgmeId:'１４０１６１１１２２'}]){
  const wire={...program,...patch};
  await assert.rejects(h.client(()=>json(wire)).getProgram(h.actor,program.id),{code:'invalid_owner_response'});
  await assert.rejects(h.client(()=>json({registryReleaseId:program.registryReleaseId,programs:[wire],page:1,total:1})).searchPrograms(h.actor),{code:'invalid_owner_response'});
 }
});
