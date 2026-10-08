import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createIvocHandler} from '../../ivoc/routes.mjs';
const ID='00000000-0000-4000-8000-000000000001';
function harness({founderEntitled=true}={}){
  const calls=[];
  const route=createIvocHandler({repository:{insert:async()=>({}),single:async()=>null},storage:{},env:{IVPREP_ENABLED:'true',IVPREP_ADMIN_CANARY_ENABLED:'true'},
    applicationIntelligence:{prepareSession:async()=>{}},registry:{refreshSubject:async()=>{},isRevoked:()=>false,entitlementFor:subject=>({subject,revision:'test',expiresAtMs:Date.now()+60000,voice:true,video:true,founder:founderEntitled&&subject==='wp:1'})},
    embodimentFactory:()=>({config:async()=>({schema:'ivoc.founder-qa.v1',available:true}),start:async x=>{calls.push(x);return {ok:true};},heartbeat:async x=>{calls.push(x);return {ok:true};},kill:async()=>{calls.push('kill');return {enabled:false};}})});
  async function call(id,roles,suffix,{csrf=true,actor='wp:1'}={}){
    const request=Readable.from([Buffer.from(JSON.stringify({actor,sessionId:ID}))]);request.method='POST';request.headers={origin:'https://hq.test','sec-fetch-site':'same-origin',...(csrf?{'x-mmhq-csrf':'a'.repeat(24)}:{})};
    const response={writeHead(status){this.status=status;},end(body){this.body=JSON.parse(body||'{}');}};
    await route({request,response,url:new URL('https://hq.test/api/ivoc/v1/admin/embodiment-canary'+suffix),hqSession:{version:1,issuedAt:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+60000).toISOString(),csrfToken:'a'.repeat(24),authSource:'wordpress-cookie',user:{id,roles,login:'user'}},cookieFingerprint:'b'.repeat(64),expectedOrigin:'https://hq.test',hqSessionMaxTtlSeconds:60});return response;
  }return {call,calls};
}
test('persistent QA start/heartbeat/kill all require server wp:1 AND Admin AND CSRF',async()=>{
  for(const suffix of ['/start','/heartbeat','/kill']){
    const h=harness({founderEntitled:false});
    for(const [id,roles] of [[42,['student']],[107,['administrator']],[1,['student']]]){
      assert.equal((await h.call(id,roles,suffix)).status,403);
    }
    assert.equal((await h.call(1,['administrator'],suffix,{csrf:false})).status,403);
    assert.equal(h.calls.length,0);
    assert.equal((await h.call(1,['administrator'],suffix,{actor:'wp:42'})).status,200);
    if(suffix!=='/kill')assert.equal(h.calls[0].actor,'wp:1');
  }
});
