import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createCipheriv, createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const sourceRootArg=process.argv.indexOf('--source-root');
const root=sourceRootArg>=0?path.resolve(process.argv[sourceRootArg+1]):path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const hook=[
'import{randomUUID}from"node:crypto";',
'globalThis.fetch=async(input,options={})=>{const u=new URL(String(input));',
'if(u.hostname!=="fglyvdykwgbuivikqoah.supabase.co"){console.error("TEST_UNEXPECTED_OUTBOUND_HOST");throw Error("TEST_UNEXPECTED_OUTBOUND");}',
'console.log("TEST_INTERCEPTED_PATH "+u.pathname);',
'if(u.pathname==="/rest/v1/rpc/list_usce_public_intake_requests")return new Response(JSON.stringify({items:[],total:0}),{status:200,headers:{"Content-Type":"application/json"}});',
'if(u.pathname==="/auth/v1/token"&&u.searchParams.get("grant_type")==="password")return new Response(JSON.stringify({access_token:randomUUID(),refresh_token:randomUUID(),user:{id:randomUUID()}}),{status:200,headers:{"Content-Type":"application/json"}});',
'throw Error("TEST_UNEXPECTED_OUTBOUND_PATH");};'
].join('\n');
async function freePort(){const s=createServer();await new Promise((a,b)=>{s.once('error',b);s.listen(0,'127.0.0.1',a)});const p=s.address().port;await new Promise(a=>s.close(a));return p;}
const port=await freePort(),inner=await freePort(),sessionSecret=randomBytes(32).toString('hex'),handoffSecret=randomBytes(32).toString('hex');
const child=spawn(process.execPath,[path.join(root,'missionmed-hq/usce-gateway.mjs')],{cwd:root,env:{
 PATH:process.env.PATH,NODE_ENV:'production',PORT:String(port),MMHQ_USCE_GATEWAY_INNER_PORT:String(inner),
 MMHQ_AUTH_REQUIRED:'true',MMHQ_SESSION_SECRET:sessionSecret,MMHQ_HANDOFF_SECRET:handoffSecret,
 MMHQ_WP_BASE:'https://missionmedinstitute.com',HQ_BASE_URL:'https://missionmed-usce-gateway-production.up.railway.app',
 MMHQ_SUPABASE_URL:'https://fglyvdykwgbuivikqoah.supabase.co',MMHQ_SUPABASE_KEY:randomBytes(32).toString('hex'),
 MMHQ_DBOC_PIPELINE_SAFE_MODE:'true',MMHQ_DBOC_TRANSCRIBE_SAFE_MODE:'true',
 USCE_POSTMARK_LIVE_SEND_ENABLED:'false',USCE_POSTMARK_DRY_RUN:'true',
 NODE_OPTIONS:'--import=data:text/javascript;base64,'+Buffer.from(hook).toString('base64')
},stdio:['ignore','pipe','pipe']});
let output='';child.stdout.on('data',b=>output+=b.toString());child.stderr.on('data',b=>output+=b.toString());
const tokens=[],results=[],now=Date.now(),origin='http://127.0.0.1:'+port;
function session(overrides={}){
 const payload={version:1,issuedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+60000).toISOString(),csrfToken:randomUUID(),authSource:'synthetic-local-test',user:{id:42,email:'synthetic-usce-runtime@example.test',login:'synthetic-usce-runtime',displayName:'Synthetic USCE Runtime',roles:['administrator']},...overrides};
 const key=createHash('sha256').update(sessionSecret).digest(),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),bytes=Buffer.concat([cipher.update(JSON.stringify(payload)),cipher.final()]);
 const token='v1.'+[iv,bytes,cipher.getAuthTag()].map(b=>b.toString('base64url')).join('.');tokens.push(token);return{token,payload};
}
function handoff(overrides={}){const n=Math.floor(Date.now()/1000),body=Buffer.from(JSON.stringify({wp_user_id:42,email:'synthetic-usce-runtime@example.test',username:'synthetic-usce-runtime',display_name:'Synthetic USCE Runtime',roles:['administrator'],iat:n,exp:n+60,...overrides})).toString('base64url');const t=body+'.'+createHmac('sha256',handoffSecret).update(body).digest('hex');tokens.push(t);return t;}
async function request(route,{token,csrf,method='GET',body,cookie}={}){return fetch(origin+route,{method,redirect:'manual',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(csrf?{'X-MMHQ-CSRF':csrf}:{}),...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});}
async function check(name,fn){try{await fn();results.push({name,pass:true})}catch(e){results.push({name,pass:false,detail:e.message.replace(/v1\.[A-Za-z0-9_.-]+/gu,'[redacted]')})}}
const queue='/api/usce/admin/public-intake-requests';
try{
 for(let i=0;i<100;i++){if(await fetch(origin+'/health').then(r=>r.status===200).catch(()=>false))break;if(child.exitCode!==null)throw Error('Runtime exited before readiness');await new Promise(r=>setTimeout(r,50));}
 await check('gateway health',async()=>assert.equal((await request('/health')).status,200));
 const admin=session();
 await check('authorized administrator queue GET',async()=>assert.equal((await request(queue,{token:admin.token})).status,200));
 await check('anonymous queue denied',async()=>assert.equal((await request(queue)).status,401));
 await check('malformed bearer denied',async()=>assert.equal((await request(queue,{token:'invalid'})).status,401));
 for(const [name,change]of[
 ['expired bearer denied',{expiresAt:new Date(now-1).toISOString()}],
 ['missing expiry denied',{expiresAt:undefined}],
 ['future issue time denied',{issuedAt:new Date(now+10000).toISOString()}],
 ['explicit sibling session audience denied',{audience:'arena',apiScope:'arena'}],
 ['invalid payload version denied',{version:2}],
 ['whitespace authAudience cannot hide sibling audience',{authAudience:' ',audience:'arena'}],
 ['USCE authAudience cannot hide sibling audience',{authAudience:'usce_admin',audience:'arena'}],
 ['sibling authAudience cannot hide USCE audience',{authAudience:'arena',audience:'usce_admin'}],
 ['boolean user ID denied',{user:{...admin.payload.user,id:true}}],
 ['array user ID denied',{user:{...admin.payload.user,id:[42]}}],
 ['object user ID denied',{user:{...admin.payload.user,id:{value:42}}}],
 ['decimal-point string user ID denied',{user:{...admin.payload.user,id:'42.0'}}]
 ])await check(name,async()=>assert.equal((await request(queue,{token:session(change).token})).status,401));
 await check('positive decimal-digit string user ID accepted',async()=>assert.equal((await request(queue,{token:session({user:{...admin.payload.user,id:'42'}}).token})).status,200));
 await check('nonadministrator queue denied',async()=>assert.equal((await request(queue,{token:session({user:{...admin.payload.user,roles:['subscriber']}}).token})).status,403));
 for(const csrf of[undefined,'wrong'])await check((csrf?'invalid':'missing')+' CSRF mutation denied before RPC',async()=>assert.equal((await request(queue+'/'+randomUUID()+'/status',{token:admin.token,csrf,method:'PATCH',body:{status:'archived'}})).status,403));
 await check('invalid bearer does not fall back to valid cookie',async()=>assert.equal((await request(queue,{token:'invalid',cookie:'mmhq_session='+encodeURIComponent(admin.token)})).status,401));
 await check('valid legacy administrator cookie works',async()=>assert.equal((await request(queue,{cookie:'mmhq_session='+encodeURIComponent(admin.token)})).status,200));
 await check('anonymous session readback',async()=>assert.equal((await(await request('/api/auth/session?audience=usce_admin')).json()).authenticated,false));
 await check('expired session readback unauthenticated',async()=>assert.equal((await(await request('/api/auth/session?audience=usce_admin',{token:session({expiresAt:new Date(now-1).toISOString()}).token})).json()).authenticated,false));
 for(const[name,change,status]of[
 ['valid legacy signed administrator handoff exchange',{},200],
 ['valid explicit USCE signed administrator handoff exchange',{auth_audience:'usce_admin'},200],
 ['explicit sibling signed handoff rejected',{auth_audience:'arena'},401],
 ['subscriber signed handoff rejected',{roles:['subscriber']},403],
 ['expired signed handoff rejected',{exp:1},401]
 ])await check(name,async()=>assert.equal((await request('/api/auth/session?audience=usce_admin&token='+encodeURIComponent(handoff(change)))).status,status));
 await check('nonUSCE login audience rejected',async()=>assert.equal((await request('/api/auth/session?audience=arena')).status,400));
 await check('invalid CSRF logout denied',async()=>assert.equal((await request('/api/auth/logout',{token:admin.token,method:'POST'})).status,403));
 await check('valid CSRF logout clears cookie',async()=>{const r=await request('/api/auth/logout',{token:admin.token,csrf:admin.payload.csrfToken,method:'POST'});assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/Max-Age=0/)});
 await check('relay exact CDN target and fragment-only',async()=>{const t=handoff(),r=await request('/api/usce/admin/auth/relay?target='+encodeURIComponent('https://evil.example.test/')+'&token='+encodeURIComponent(t));assert.equal(r.status,302);const u=new URL(r.headers.get('location'));assert.equal(u.origin,'https://cdn.missionmedinstitute.com');assert.equal(u.pathname,'/html-system/LIVE/usce_admin.html');assert.equal(u.searchParams.has('token'),false);assert.equal(new URLSearchParams(u.hash.slice(1)).get('mmhq_handoff_token'),t)});
 for(const p of['/','/hq','/api/hq/summary','/api/auth/bootstrap','/api/usce/admin/../analytics/summary','/api/usce/admin/%2e%2e/analytics/summary','/api/usce','/api/usce/adminx/public-intake-requests','/api/integrations/gmail/comms-review-write'])await check('outer gateway blocks '+p,async()=>assert.equal((await request(p,{token:admin.token})).status,404));
 const sharedPort=await freePort();
 const shared=spawn(process.execPath,[path.join(root,'missionmed-hq/server.mjs')],{cwd:root,env:{
  PATH:process.env.PATH,NODE_ENV:'production',PORT:String(sharedPort),
  MMHQ_AUTH_REQUIRED:'true',MMHQ_SESSION_SECRET:sessionSecret,MMHQ_HANDOFF_SECRET:handoffSecret,
  MMHQ_WP_BASE:'https://missionmedinstitute.com',HQ_BASE_URL:'https://missionmed-hq-production.up.railway.app',
  MMHQ_SUPABASE_URL:'https://fglyvdykwgbuivikqoah.supabase.co',MMHQ_SUPABASE_KEY:randomBytes(32).toString('hex'),
  MMHQ_DBOC_PIPELINE_SAFE_MODE:'true',MMHQ_DBOC_TRANSCRIBE_SAFE_MODE:'true',
  USCE_POSTMARK_LIVE_SEND_ENABLED:'false',USCE_POSTMARK_DRY_RUN:'true',
  NODE_OPTIONS:'--import=data:text/javascript;base64,'+Buffer.from(hook).toString('base64')
 },stdio:['ignore','pipe','pipe']});
 shared.stdout.on('data',b=>output+=b.toString());shared.stderr.on('data',b=>output+=b.toString());
 const sharedOrigin='http://127.0.0.1:'+sharedPort;
 try{
  for(let i=0;i<100;i++){if(await fetch(sharedOrigin+'/health').then(r=>r.status===200).catch(()=>false))break;if(shared.exitCode!==null)throw Error('Shared compatibility runtime exited');await new Promise(r=>setTimeout(r,50));}
  await check('shared generic sibling handoff/body USCE hint baseline preserved',async()=>{
   const r=await fetch(sharedOrigin+'/api/auth/exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:handoff({auth_audience:'arena'}),audience:'usce_admin'})});
   assert.equal(r.status,200);assert.equal((await r.json()).authenticated,true);
  });
  const expired=session({expiresAt:new Date(now-1).toISOString()});
  await check('shared generic expired session behavior baseline preserved',async()=>{
   const r=await fetch(sharedOrigin+'/api/auth/session',{headers:{Authorization:'Bearer '+expired.token}});
   assert.equal(r.status,200);assert.equal((await r.json()).authenticated,true);
  });
  await check('direct shared USCE expired session denied',async()=>{
   const r=await fetch(sharedOrigin+queue,{headers:{Authorization:'Bearer '+expired.token}});
   assert.equal(r.status,401);
  });
  await check('isolated inner exchange sibling handoff/body USCE hint rejected',async()=>{
   const r=await fetch('http://127.0.0.1:'+inner+'/api/auth/exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:handoff({auth_audience:'arena'}),audience:'usce_admin'})});
   assert.equal(r.status,401);
  });
 }finally{shared.kill('SIGTERM');await new Promise(r=>{if(shared.exitCode!==null)return r();const timer=setTimeout(()=>{shared.kill('SIGKILL');r()},5500);shared.once('exit',()=>{clearTimeout(timer);r()})})}
 await check('no external request escaped interception',async()=>assert.equal(output.includes('TEST_UNEXPECTED_OUTBOUND'),false));
 await check('no raw session, handoff or generated key in logs',async()=>{assert.equal(tokens.some(t=>output.includes(t)),false);assert.equal(output.includes(sessionSecret),false);assert.equal(output.includes(handoffSecret),false)});
}finally{child.kill('SIGTERM');await new Promise(r=>{if(child.exitCode!==null)return r();const timer=setTimeout(()=>{child.kill('SIGKILL');r()},5500);child.once('exit',()=>{clearTimeout(timer);r()})})}
const passed=results.filter(r=>r.pass).length;console.log(JSON.stringify({mode:'integrated-runtime',passed,total:results.length,results},null,2));if(passed!==results.length)process.exitCode=1;
