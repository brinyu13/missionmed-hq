import test from 'node:test';
import assert from 'node:assert/strict';
import {native, request} from '../helpers/loi-single-provider.mjs';

test('personalized writer explicitly bounds reasoning without changing paid-call or factual contract', async()=>{
  const {composer,calls}=native();
  const req=request(), result=await composer.compose(req);
  assert.equal(calls.length,1);
  const wire=JSON.parse(calls[0].body);
  assert.deepEqual(wire.reasoning,{effort:'minimal'});
  assert.equal(wire.model,'gpt-5-nano-2025-08-07');
  assert.equal(wire.max_output_tokens,4096);
  assert.deepEqual(wire.tools,[]);
  assert.equal(wire.tool_choice,'none');
  assert.equal(wire.store,false);
  assert.equal(wire.text.format.strict,true);
  assert.equal(result.usage.passes.length,1);
  assert.equal(result.usage.passes[0].stage,'AUTHOR');
  await assert.rejects(composer.compose(req),{code:'LOI_PROVIDER_ALREADY_ATTEMPTED'});
  assert.equal(calls.length,1);
});
