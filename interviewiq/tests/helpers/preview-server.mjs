// Local QA ONLY: real IIQ HTTP/SQL/UI with synthetic owner-service boundaries.
// This test harness is never included in the production server release.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {SignJWT} from 'jose';
import {createDatabase} from '../../server/db.mjs';
import {createAuthorizer,proof} from '../../server/auth.mjs';
import {createCommands} from '../../server/commands.mjs';
import {createHandler} from '../../server/http.mjs';
import {readDisposableConnectionFile,qualifyDisposableConnection} from '../../scripts/disposable-db-guard.mjs';

const connection=readDisposableConnectionFile(process.argv[2]);
if(connection.syntheticOnly!==true || connection.unixSocketOnly!==true || !connection.databaseUrl?.includes('host=/tmp/iiq-pg18.'))throw Error('Disposable local test database required.');
const port=Number(process.env.IIQ_QA_PORT||8112),origin=`http://127.0.0.1:${port}`;
const config={enabled:true,databaseUrl:connection.databaseUrl,publicOrigin:'https://missionmedinstitute.com',jwtIssuer:'https://missionmedinstitute.com',jwtSecret:randomBytes(48).toString('hex'),ownerProofSecret:randomBytes(48).toString('hex'),gatewaySecret:randomBytes(48).toString('hex'),ownerIntrospectionUrl:origin+'/__qa/proof',ownerTimeoutMs:1000,maxBodyBytes:262144,release:'LOCAL-QA-SYNTHETIC-OWNERS'};
const database=createDatabase(config);await qualifyDisposableConnection(database.pool,config.databaseUrl,{role:'iiq_runtime_test'});await database.verifyRuntimeRole();
const ids={student:randomUUID(),other:randomUUID(),mentor:randomUUID(),admin:randomUUID()},wp=Math.floor(Math.random()*1e8)+3e8;
const actors=Object.fromEntries(Object.entries(ids).map(([key,id],index)=>[key,{id,sub:id,wpUserId:wp+index,role:key==='mentor'?'mentor':key==='admin'?'admin':'student',tier:key==='mentor'?'assigned_mentor':key==='admin'?'admin':'360',eligible:true,assignments:key==='mentor'?[ids.student]:[],displayName:key==='student'?'QA Student':key==='other'?'Other QA Student':key==='mentor'?'QA Mentor':'QA Admin',firstName:'QA Student',zone:'America/New_York',verifier:randomBytes(32).toString('hex')}]));
const csrf=randomBytes(24).toString('hex');
const program={id:'qa-program-alpha',name:'QA Program Alpha',specialty:'Internal Medicine',track:'Categorical',zone:'America/New_York',fact_ids:['qa-fact-alpha'],question:'How would you use continuity clinic to improve follow-up?',feedback:'Describe your own action and its connection to continuity of care.'};
const fact={id:'qa-fact-alpha',program:program.id,claim:'Synthetic QA curriculum includes a continuity clinic.',status:'supported',sources:['qa-source-alpha']};
const owners={ivocAvailable:false,async getProgram(_actor,id){if(id!==program.id)throw Error('Unknown synthetic program');return program;},async searchPrograms(){return {programs:[program]};},async context(){return {programs:[program],facts:[fact],sources:[{id:'qa-source-alpha',title:'Synthetic public curriculum fixture',url:'https://example.org/qa-curriculum',publisher:'Local QA fixture',retrieved_at:new Date().toISOString(),status:'supported',text:fact.claim,applies:'Synthetic only'}],stories:[],results:{},status:{rise:'available',storyforge:'unavailable'}};},async validateBasis(_actor,_row,basis){if(basis.story)throw Error('No synthetic story permission');return basis;}};
const authorizer=createAuthorizer(config,{fetchImpl:async(_url,{body})=>{
  const input=JSON.parse(body),actor=Object.values(actors).find(x=>x.id===input.subject),now=Math.floor(Date.now()/1000);
  const payload=JSON.stringify({audience:input.audience,subject:input.subject,wp_user_id:input.wp_user_id,session_verifier:input.session_verifier,nonce:input.nonce,request_sha256:createHash('sha256').update(body).digest('hex'),allowed:!!actor,role:actor?.role,tier:actor?.tier,assignment_student_ids:actor?.assignments||[],iat:now,exp:now+30});
  return new Response(JSON.stringify({payload,signature:proof(config.ownerProofSecret,'mmiiq-introspection-response-v1',payload)}));
}});
const commands=createCommands({database,owners,config});
const api=createHandler({config,database,authorize:authorizer,commands,owners,logger:x=>process.stderr.write(JSON.stringify(x)+'\n')});
for(const actor of Object.values(actors))await commands.bootstrap(actor);
async function command(actor,command,data,interviewId=null){const state=await commands.bootstrap(actor);return commands.execute(actor,{command,data,interviewId,expectedVersion:state.version,requestId:randomUUID()});}
const next=new Date(Date.now()+3*86400000).toISOString().slice(0,10),past=new Date(Date.now()-2*86400000).toISOString().slice(0,10);
const future=await command(actors.student,'interview.create',{unresolved_input:'QA upcoming interview',program:program.id,schedule:{date:next,time:'10:30',zone:'America/New_York',duration:60,format:'virtual',joining:'https://example.org/qa-meeting'}});
await command(actors.student,'prep.save',{why:{text:'PRIVATE QA: I built a follow-up checklist and want to learn how to apply that habit during continuity clinic.',basis:{fact:fact.id,story:null},edited:true},questions:'PRIVATE QA: How do residents receive feedback?'},future.interviewId);
await command(actors.student,'interview.create',{unresolved_input:'QA date-unknown offer'});
const completed=await command(actors.student,'interview.create',{unresolved_input:'QA completed interview',program:program.id,schedule:{date:past,time:'09:00',zone:'America/New_York',duration:45,format:'virtual'}});
await command(actors.student,'debrief.occurrence',{occurrence:'yes'},completed.interviewId);
await command(actors.student,'debrief.save',{edited:'PRIVATE QA: I had three conversations with faculty.',fields:{individual_count:'3'},questions:[],saved:true},completed.interviewId);
await command(actors.other,'interview.create',{unresolved_input:'OTHER STUDENT PRIVATE OFFER'});
const publicRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../public');
const json=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private, no-store','X-IIQ-Test-Fixture':'synthetic-owner-services'});res.end(JSON.stringify(body));};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,origin),key=/iiq_qa_role=(student|mentor|admin|other)/.exec(req.headers.cookie||'')?.[1]||'student',actor=actors[key];
    if(url.pathname==='/__qa/role') {const role=url.searchParams.get('role');if(!actors[role])return json(res,400,{error:{message:'Unknown QA role'}});res.writeHead(302,{'Set-Cookie':`iiq_qa_role=${role}; Path=/; HttpOnly; SameSite=Strict`,Location:'/interviewiq/#home'});return res.end();}
    if(url.pathname==='/wp-admin/admin-ajax.php'&&req.method==='POST') {
      if(req.headers.origin!==origin)return json(res,403,{error:{message:'Local QA origin required'}});
      const action=url.searchParams.get('action'),view={id:actor.id,role:actor.role,displayName:actor.displayName};
      if(action==='missionmed_interviewiq_bootstrap')return json(res,200,{nonce:csrf,token_endpoint:'/wp-admin/admin-ajax.php?action=missionmed_interviewiq_token',api_base:'/interviewiq/api',actor:view});
      if(action==='missionmed_interviewiq_token'&&req.headers['x-iiq-nonce']===csrf){const now=Math.floor(Date.now()/1000),token=await new SignJWT({sub:actor.id,wp_user_id:actor.wpUserId,app_role:actor.role,tier:actor.tier,name:actor.displayName,first_name:actor.firstName,interviewiq_eligible:true,session_verifier:actor.verifier}).setProtectedHeader({alg:'HS256',typ:'JWT'}).setIssuer(config.jwtIssuer).setAudience('interviewiq').setIssuedAt(now).setExpirationTime(now+60).setJti(randomUUID()).sign(new TextEncoder().encode(config.jwtSecret));return json(res,200,{token,nonce:csrf,expires_at:now+60,ttl_seconds:60,actor:view});}
      return json(res,403,{error:{message:'Local QA nonce required'}});
    }
    if(url.pathname.startsWith('/interviewiq/api/')) {
      if(req.method!=='GET'&&(req.headers.origin!==origin||req.headers['x-iiq-nonce']!==csrf))return json(res,403,{error:{message:'Local QA nonce required'}});
      const verified=await authorizer(req,`${req.method} ${url.pathname.replace('/interviewiq','')}`);if(verified.id!==actor.id)return json(res,401,{error:{message:'Local QA account changed'}});
      req.url=req.url.replace('/interviewiq/api/','/api/');req.headers.origin=config.publicOrigin;delete req.headers.cookie;req.headers['x-mmed-iiq-gateway']=config.gatewaySecret;
      return api(req,res);
    }
    const relative=url.pathname==='/interviewiq/'?'index.html':url.pathname.replace(/^\/interviewiq\//,'');
    if(req.method!=='GET'||!['index.html','styles.css','app.js'].includes(relative))return json(res,404,{error:{message:'Local QA route missing'}});
    const bytes=await fs.readFile(path.join(publicRoot,relative));res.writeHead(200,{'Content-Type':relative.endsWith('.html')?'text/html; charset=utf-8':relative.endsWith('.css')?'text/css':'text/javascript','Cache-Control':'no-store','X-IIQ-Test-Fixture':'synthetic-owner-services'});res.end(bytes);
  }catch(error){json(res,error.status||500,{error:{code:error.code||'fixture_error',message:error.message}});}
});
await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
process.stdout.write(JSON.stringify({event:'local-qa-ready',url:origin+'/interviewiq/#home',syntheticOnly:true,actualLayers:['UI','Node authorization','HTTP commands','PostgreSQL RLS'],doubledLayers:['WordPress owner','RISE','StoryForge','IVOC'],fixtureInterviewIds:{future:future.interviewId,past:completed.interviewId}})+'\n');
for(const sig of ['SIGINT','SIGTERM'])process.once(sig,()=>server.close(()=>database.close().then(()=>process.exit(0))));
