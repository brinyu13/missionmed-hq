import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readCurrentRiseEligibility, riseDelegatedProjection } from '../lib/auth/rise-current-eligibility.mjs';

const secret = 'synthetic-offline-test-secret-000000000000';
const now = 1_800_000_000_000;
const nonce = '123e4567-e89b-42d3-a456-426614174000';
function proof(overrides = {}) {
  const payload = JSON.stringify({ subject:'wp:77', audience:'ivoc-rise-owner-projection',
    nonce, source:'wordpress_current_rise_owner', allowed:true, admin:false,
    iat:now/1000, exp:now/1000+30, ...overrides });
  return { payload, signature:createHmac('sha256',secret).update('mmrise-ivoc-eligibility-response-v1\n'+payload).digest('hex') };
}
function read(fetchImpl, extra = {}) {
  return readCurrentRiseEligibility({wpBase:'https://owner.example',secret,subject:77,now:()=>now,nonce,fetchImpl,...extra});
}
test('fresh proof uses fixed authenticated POST; current revoked decision replaces prior allow', async () => {
  let allowed = true, calls = 0;
  const fetchImpl = async (url, options) => {
    calls++;
    assert.equal(String(url),'https://owner.example/wp-json/missionmed-rise/v1/ivoc-eligibility');
    assert.equal(options.method,'POST'); assert.equal(options.redirect,'error'); assert.equal(options.cache,'no-store');
    assert.equal(options.headers['X-MMED-RISE-Proof'],createHmac('sha256',secret).update('mmrise-ivoc-eligibility-request-v1\n'+options.body).digest('hex'));
    return Response.json(proof({allowed}));
  };
  assert.equal((await read(fetchImpl)).allowed,true);
  allowed=false;
  assert.equal((await read(fetchImpl)).allowed,false);
  assert.equal(calls,2);
});
for (const overrides of [
  {subject:'wp:78'}, {audience:'hq'}, {nonce:'223e4567-e89b-42d3-a456-426614174000'},
  {source:'cached_cookie'}, {allowed:'true'}, {admin:1}, {exp:now/1000},
  {iat:now/1000-31}, {iat:now/1000+6}, {exp:now/1000+31},
]) {
  test('rejects invalid receipt '+JSON.stringify(overrides),async()=>{
    assert.equal(await read(async()=>Response.json(proof(overrides))),null);
  });
}
test('unavailable, redirects, bad signatures, declared and streamed oversize fail closed',async()=>{
  const bad=proof();bad.signature='0'.repeat(64);
  for(const response of [new Response('',{status:403}),new Response('',{status:302}),
    Response.json(bad),Response.json(proof(),{headers:{'content-length':'4097'}}),
    new Response('x'.repeat(4097),{headers:{'content-type':'application/json'}})]) {
    assert.equal(await read(async()=>response),null);
  }
  assert.equal(await read(async()=>{throw new Error('offline');}),null);
  assert.equal(await read(async()=>{throw new Error('must not fetch');},{wpBase:'http://owner.example'}),null);
});
test('deadline includes stalled response body', async()=>{
  const result=read(async (_url, options)=>new Response(new ReadableStream({
    start(controller) { options.signal.addEventListener('abort',()=>controller.error(new Error('timeout'))); },
  }),{headers:{'content-type':'application/json'}}),{timeoutMs:20});
  const hold=setTimeout(()=>{},1000);
  try {assert.equal(await result,null);} finally {clearTimeout(hold);}
});
test('projection never mints a credential, expires with original session, fresh roles not stale admin',async()=>{
  const receipt=await read(async()=>Response.json(proof()));
  const session={user:{id:77,displayName:'Example',roles:['administrator']},csrfToken:'a'.repeat(24),expiresAt:new Date(now+10000).toISOString()};
  const before=JSON.stringify(session), value=riseDelegatedProjection(session,receipt,now);
  assert.equal(value.accessToken,'');assert.equal(value.expiresAt,session.expiresAt);
  assert.deepEqual(value.user.roles,['subscriber']);assert.equal(JSON.stringify(session),before);
  assert.equal(riseDelegatedProjection(session,{...receipt,allowed:false},now),null);
  assert.equal(riseDelegatedProjection(session,{...receipt,subject:'wp:78'},now),null);
  assert.equal(riseDelegatedProjection(session,receipt,now+10001),null);
});
test('real PHP owner implementation contract',()=>{
  const result=spawnSync('php',[new URL('./rise-current-eligibility.php',import.meta.url).pathname],{encoding:'utf8'});
  assert.equal(result.status,0,result.stdout+result.stderr);
  assert.match(result.stdout,/PASS/);
});
for(const mode of ['no-gate','no-method']) test('PHP fails closed without current owner '+mode,()=>{
  const result=spawnSync('php',[new URL('./rise-current-eligibility.php',import.meta.url).pathname,mode],{encoding:'utf8'});
  assert.equal(result.status,0,result.stdout+result.stderr);
  assert.match(result.stdout,/PASS unavailable/);
});
