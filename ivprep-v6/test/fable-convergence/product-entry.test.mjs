import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Readable,Writable} from 'node:stream';
import {finished} from 'node:stream/promises';
import test from 'node:test';
import {legacyPresentationEntry} from '../../public/studio-fable/app/adapters/product-entry.mjs';
import {createIvPrepHqHandler} from '../../server/hq-mount.mjs';
import {InMemoryAdmissionRegistry} from '../../server/admission-registry.mjs';

test('old deep links retain the exact Advanced route and review scope',()=>{
  for(const path of ['/iv-prep-on-call/','/iv-prep-on-call/candidate/'])
    for(const view of ['newsession','devicecheck','training','simulation','postanswer','filmroom','compare','lab','mentor','governance','fingerprint','vault']){
      const hash='#'+view+'?session=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&review=admin';
      assert.equal(legacyPresentationEntry(path,hash),'/iv-prep-on-call/advanced/'+hash);
    }
});

test('Fable routes, Home, Progress and unrecognized input never redirect',()=>{
  for(const hash of ['','#home','#progress','#/home','#/mock','#/room','#/film/one','#main','#https://evil.test','#unknown',null])
    assert.equal(legacyPresentationEntry('/iv-prep-on-call/',hash),null);
  for(const path of ['/iv-prep-on-call/advanced/','/iv-prep-on-call/legacy/','/other/'])
    assert.equal(legacyPresentationEntry(path,'#mentor?view=admin'),null);
  assert.equal(legacyPresentationEntry('/iv-prep-on-call/','#mentor?'+ 'x'.repeat(2048)),null);
});

const NOW=Date.parse('2026-10-04T16:00:00Z');
function handler(){
  const registry=new InMemoryAdmissionRegistry({now:()=>NOW});
  registry.grantSyntheticEntitlement({subject:'wp:1',revision:'test-only',expiresAtMs:NOW+120000,founder:true,voice:true,video:false});
  return createIvPrepHqHandler({registry,now:()=>NOW,flags:{enabled:true,adminCanaryEnabled:true,videoEnabled:false}});
}
async function asset(mount,path,authenticated=true){
  const request=Readable.from([]);request.method='GET';request.headers={host:'hq.local'};
  const chunks=[];const response=new Writable({write(chunk,_encoding,done){chunks.push(chunk);done();}});
  response.writeHead=(status,headers)=>{response.status=status;response.headers=headers;};
  const hqSession=authenticated?{version:1,issuedAt:new Date(NOW-1000).toISOString(),expiresAt:new Date(NOW+60000).toISOString(),csrfToken:'test_csrf_1234567890',authSource:'wordpress-cookie',user:{id:1,roles:['administrator']}}:null;
  await mount({request,response,url:new URL(path,'http://hq.local'),hqSession,cookieFingerprint:'a'.repeat(64),hqSessionMaxTtlSeconds:300,expectedOrigin:'http://hq.local'});
  await finished(response);return{status:response.status,body:Buffer.concat(chunks).toString('utf8')};
}
test('actual protected HQ mount serves Fable at root and candidate while Advanced remains unchanged',async()=>{
  const mount=handler();
  const fable=await readFile(new URL('../../public/studio-fable/index.html',import.meta.url),'utf8');
  const advanced=await readFile(new URL('../../public/studio/index.html',import.meta.url),'utf8');
  for(const path of ['/iv-prep-on-call/','/iv-prep-on-call/candidate/']){
    const result=await asset(mount,path);assert.equal(result.status,200);assert.equal(result.body,fable);
  }
  const result=await asset(mount,'/iv-prep-on-call/advanced/');assert.equal(result.status,200);assert.equal(result.body,advanced);
});
test('product, candidate and Advanced static entry all still fail closed anonymously',async()=>{
  for(const path of ['/iv-prep-on-call/','/iv-prep-on-call/candidate/','/iv-prep-on-call/advanced/'])
    assert.equal((await asset(handler(),path,false)).status,401);
});
test('legacy redirect is selected before connecting the Fable account/controller',async()=>{
  const source=await readFile(new URL('../../public/studio-fable/app/main.mjs',import.meta.url),'utf8');
  assert.match(source,/const legacyEntry=legacyPresentationEntry\(location\.pathname,location\.hash\);\s*if\(legacyEntry\)location\.replace\(legacyEntry\);\s*else controller\.connectAccount\(\)/);
});
