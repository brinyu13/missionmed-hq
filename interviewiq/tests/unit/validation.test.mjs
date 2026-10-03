import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {commandEnvelope,digest,object,jsonBody} from '../../server/validation.mjs';
import {Readable} from 'node:stream';
const body=()=>({command:'interview.create',data:{name:'An interview'},requestId:randomUUID(),expectedVersion:0});
test('command rejects client actor/role authority and invalid versions',()=>{
  for(const patch of [{actor:'attacker'},{role:'admin'},{expectedVersion:-1},{requestId:'retry1'},{interviewId:'another-student'}])assert.throws(()=>commandEnvelope({...body(),...patch}));
});
test('digest is stable across property order and excludes version for exact action replay',()=>{
  const a=body(),b={...a,expectedVersion:12,data:{name:'An interview'}};
  assert.equal(commandEnvelope(a).bodyHash,commandEnvelope(b).bodyHash);
  assert.equal(digest({b:2,a:{d:4,c:3}}),digest({a:{c:3,d:4},b:2}));
  assert.notEqual(digest({text:'one'}),digest({text:'two'}));
});
test('plain object validator rejects prototype keys and non-object payloads',()=>{
  for(const x of [null,[],true,JSON.parse('{"__proto__":{"role":"admin"}}'),JSON.parse('{"constructor":{}}')])assert.throws(()=>object(x));
});
test('JSON reader bounds both declared and chunked bodies',async()=>{
  function request(data,headers={}) {const r=Readable.from([Buffer.from(data)]);r.headers={'content-type':'application/json',...headers};return r;}
  assert.deepEqual(await jsonBody(request('{"a":1}')), {a:1});
  await assert.rejects(()=>jsonBody(request('{"x":"'+ 'a'.repeat(100)+'"}'),32),{status:413});
  await assert.rejects(()=>jsonBody(request('{}',{'content-length':'99999'}),32),{status:413});
  await assert.rejects(()=>jsonBody(request('broken')),{status:400});
  await assert.rejects(()=>jsonBody(request('{}',{'content-type':'text/plain'})),{status:415});
});
