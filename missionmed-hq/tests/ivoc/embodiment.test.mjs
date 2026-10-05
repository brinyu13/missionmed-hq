import assert from 'node:assert/strict';
import test from 'node:test';
import {Readable} from 'node:stream';
import {createIvocHandler} from '../../ivoc/routes.mjs';
const ID='00000000-0000-4000-8000-000000000001';
function harness(factory=null){
  const calls=[],claims=[];const row={id:ID,owner_subject:'wp:1',state:'active',updated_at:new Date().toISOString(),session_type:'mock',interviewer_provider:'openai-gpt-live',recording_enabled:true,context:{embodimentCanary:true}};
  const repo={single:async path=>path.startsWith('ivoc_sessions?')?row:null,insert:async(table,body)=>body,update:async(path,body)=>{claims.push({path,body});return {...row,...body};}};
  const route=createIvocHandler({repository:repo,storage:{},env:{IVPREP_ENABLED:'true',IVPREP_ADMIN_CANARY_ENABLED:'true'},applicationIntelligence:{prepareSession:async()=>{}},
    registry:{refreshSubject:async()=>{},isRevoked:()=>false,entitlementFor:subject=>({subject,revision:'test',expiresAtMs:Date.now()+60000,voice:true,video:true,founder:subject==='wp:1'})},
    embodimentFactory:factory|| (options=>({config:{available:true,sessionId:ID},start:async input=>{calls.push(input);await options.claim({...input,attemptId:'attempt',deadlineMs:Date.now()+45000});return {id:'attempt'};},command:async input=>{calls.push(input);return {ok:true};},status:()=>({closed:false})}))});
  const call=async(id=1,roles=['administrator'],method='POST',suffix='/start',input={sessionId:ID},csrf=true)=>{
    const request=Readable.from(method==='GET'?[]:[Buffer.from(JSON.stringify(input))]);request.method=method;request.headers={origin:'https://hq.test','sec-fetch-site':'same-origin',...(csrf?{'x-mmhq-csrf':'a'.repeat(24)}:{})};
    const response={writeHead(status){this.status=status;},end(body){this.body=JSON.parse(body||'{}');}};
    await route({request,response,url:new URL('https://hq.test/api/ivoc/v1/admin/embodiment-canary'+suffix),hqSession:{version:1,issuedAt:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+60000).toISOString(),csrfToken:'a'.repeat(24),authSource:'wordpress-cookie',user:{id,roles,login:'user'}},cookieFingerprint:'b'.repeat(64),expectedOrigin:'https://hq.test',hqSessionMaxTtlSeconds:60});
    return response;
  };return {call,calls,claims,row};
}
test('only authenticated Founder can enter canary; student/second Admin/CSRF denial never reaches provider',async()=>{
  const h=harness();assert.equal((await h.call(42,['student'])).status,403);assert.equal((await h.call(107,['administrator'])).status,403);assert.equal((await h.call(1,['administrator'],'POST','/start',{sessionId:ID},false)).status,403);assert.equal(h.calls.length,0);
  assert.equal((await h.call()).status,200);assert.equal(h.calls[0].actor,'wp:1');assert.match(h.claims[0].path,/context->embodimentReservation=is.null/);
});
test('HQ preserves safe upstream status/category/timing instead of flattening a provider 402 into generic 502',async()=>{
  const h=harness(()=>({config:{available:true},start:async()=>{throw Object.assign(new Error('PRIVATE_PROVIDER_PAYLOAD'),{status:502,diagnostics:{boundary:'LEMONSLICE_API',category:'PROVIDER_HTTP_4XX',httpStatus:402,startedAtMs:1000,finishedAtMs:1200,elapsedMs:200,responseClass:'JSON',token:'DO_NOT_EXPOSE',url:'DO_NOT_EXPOSE'}});}}));
  const response=await h.call();assert.equal(response.status,502);assert.equal(response.body.error,'ivoc_embodiment_start_failed');
  assert.equal(response.body.diagnostics.httpStatus,402);assert.equal(response.body.diagnostics.elapsedMs,200);assert.equal(response.body.diagnostics.category,'PROVIDER_HTTP_4XX');
  assert.equal(JSON.stringify(response.body).includes('DO_NOT_EXPOSE'),false);assert.equal(JSON.stringify(response.body).includes('PRIVATE_PROVIDER_PAYLOAD'),false);
});
test('foreign owner, non-mock or consumed canonical session cannot claim another paid attempt',async()=>{
  for(const patch of [{owner_subject:'wp:42'},{session_type:'question'},{state:'saved'},{context:{embodimentCanary:true,embodimentReservation:{attemptId:'earlier'}}}]){
    const h=harness();Object.assign(h.row,patch); // repository owner filter modeled below
    assert.equal((await h.call()).status,409);assert.equal(h.claims.length,0);
  }
});
