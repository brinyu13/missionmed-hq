import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {randomUUID,createHash} from 'node:crypto';
import {SignJWT} from 'jose';
import {readConfig} from '../../server/config.mjs';
import {jsonBody} from '../../server/validation.mjs';
import {researchEnabled} from '../../server/research-workspace.mjs';
import {createOwnerServices} from '../../server/owner-services.mjs';
import {createAuthorizer,proof} from '../../server/auth.mjs';
import {createHandler} from '../../server/http.mjs';

test('research defaults off and does not switch full launch mode',()=>{
 const c=readConfig({});assert.equal(c.researchMissionsEnabled,false);assert.equal(c.rise.enabled,false);assert.equal(c.coreOnly,true);
});
test('enabled research requires configured authenticated owner connection',()=>{
 const base={INTERVIEWIQ_ENABLED:'true',INTERVIEWIQ_DATABASE_URL:'synthetic',INTERVIEWIQ_JWT_SECRET:'a'.repeat(32),INTERVIEWIQ_OWNER_PROOF_SECRET:'b'.repeat(32),INTERVIEWIQ_GATEWAY_SECRET:'c'.repeat(32),INTERVIEWIQ_RESEARCH_MISSIONS_ENABLED:'true'};
 for(const delta of [{},{INTERVIEWIQ_RISE_ENABLED:'true'},{INTERVIEWIQ_RISE_ENABLED:'true',INTERVIEWIQ_RISE_REQUEST_SECRET:'short'}])assert.throws(()=>readConfig({...base,...delta}),{code:'invalid_configuration'});
 const c=readConfig({...base,INTERVIEWIQ_RISE_ENABLED:'true',INTERVIEWIQ_RISE_REQUEST_SECRET:'d'.repeat(32)});assert.equal(c.coreOnly,true);assert.equal(c.rise.researchCoverageEnabled,true);
});
for(const [role,tier,allowed] of [['admin','admin',true],['student','360',true],['student','ivprep_complete',true],['mentor','assigned_mentor',false],['student','admin',false],['admin','360',false]])test(`research runtime floor ${role}/${tier}`,()=>{
 const actor={eligible:true,role,tier};assert.equal(researchEnabled({researchMissionsEnabled:true},actor),allowed);assert.equal(researchEnabled({researchMissionsEnabled:true},{...actor,eligible:false}),false);assert.equal(researchEnabled({},actor),false);
});
const parse=bytes=>{const request=Readable.from([bytes]);request.headers={'content-type':'application/json'};return jsonBody(request);};
test('wire decoder rejects invalid UTF-8 and preserves existing BOM rejection',async()=>{
 for(const bytes of [Buffer.from([123,34,120,34,58,34,0xc3,0x28,34,125]),Buffer.from('\ufeff{}')])await assert.rejects(parse(bytes),{code:'invalid_json'});
});
test('wire decoder preserves exact valid multibyte and whitespace original',async()=>{
 const text=' \nα 😀\t é\n';assert.equal((await parse(Buffer.from(JSON.stringify({text})))).text,text);
});
test('actual runtime owner composition retains signed current-session transport',async()=>{
 const config={jwtSecret:'j'.repeat(48),ownerProofSecret:'p'.repeat(48),jwtIssuer:'https://missionmedinstitute.com',ownerIntrospectionUrl:'https://missionmedinstitute.com/wp-json/missionmed-interviewiq/v1/introspect',ownerTimeoutMs:1000};
 const now=Date.now(),seconds=Math.floor(now/1000),subject=randomUUID(),verifier='f'.repeat(64),sha=x=>createHash('sha256').update(x).digest('hex');
 const json=x=>new Response(JSON.stringify(x),{headers:{'Content-Type':'application/json'}});
 const authorize=createAuthorizer(config,{now:()=>now,fetchImpl:async(_url,opts)=>{const input=JSON.parse(opts.body),payload=JSON.stringify({audience:input.audience,subject,wp_user_id:1701,session_verifier:verifier,nonce:input.nonce,request_sha256:sha(opts.body),allowed:true,role:'student',tier:'360',assignment_student_ids:[],iat:seconds,exp:seconds+30});return json({payload,signature:proof(config.ownerProofSecret,'mmiiq-introspection-response-v1',payload)});}});
 const token=await new SignJWT({sub:subject,wp_user_id:1701,app_role:'student',tier:'360',interviewiq_eligible:true,session_verifier:verifier}).setProtectedHeader({alg:'HS256',typ:'JWT'}).setIssuer(config.jwtIssuer).setAudience('interviewiq').setIssuedAt(seconds).setExpirationTime(seconds+60).setJti(randomUUID()).sign(new TextEncoder().encode(config.jwtSecret));
 const actor=await authorize({headers:{authorization:`Bearer ${token}`}},'GET /api/programs'),calls=[];
 const owners=createOwnerServices({rise:{enabled:true,requestSecret:'r'.repeat(48),researchCoverageEnabled:true}},{now:()=>now,fetchImpl:async(url,options)=>{calls.push({url,options});return json({registryReleaseId:'synthetic_registry',page:1,total:0,programs:[]});}});
 assert.deepEqual(await owners.searchPrograms(actor,{q:'Synthetic & program'}),{registryReleaseId:'synthetic_registry',page:1,total:0,programs:[]});assert.equal(new URL(calls[0].url).searchParams.get('q'),'Synthetic & program');assert.ok(calls[0].options.headers['X-MMED-IIQ-Signature']);
 await assert.rejects(owners.searchPrograms({...actor},{q:'Synthetic'}),{code:'owner_session_required'});assert.equal(calls.length,1);assert.equal(owners.ivocAvailable,false);assert.equal((await owners.context()).status.rise,'unavailable');
});
test('HTTP program route passes object query and checks capability before owner call',async()=>{
 const config={enabled:true,coreOnly:true,researchMissionsEnabled:true,publicOrigin:'https://missionmedinstitute.com',gatewaySecret:'g'.repeat(48)};let actor={role:'student',tier:'360',eligible:true},calls=0;
 const server=createServer(createHandler({config,authorize:async()=>actor,owners:{async searchPrograms(_actor,query){calls++;assert.deepEqual(query,{q:'Synthetic Program'});return {programs:[]};}}}));server.listen(0,'127.0.0.1');await once(server,'listening');
 const url=`http://127.0.0.1:${server.address().port}/api/programs?q=Synthetic%20Program`,headers={Origin:config.publicOrigin,'X-MMED-IIQ-Gateway':config.gatewaySecret};
 try{assert.equal((await fetch(url,{headers})).status,200);config.researchMissionsEnabled=false;assert.equal((await fetch(url,{headers})).status,503);config.researchMissionsEnabled=true;actor={role:'admin',tier:'360',eligible:true};assert.equal((await fetch(url,{headers})).status,503);assert.equal(calls,1);}
 finally{server.close();server.closeAllConnections();await once(server,'close');}
});
