import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenAiCvIntelligenceProvider } from '../src/intelligence/openai-cv-intelligence.js';
import { getProviderReceipt } from '../src/intelligence/provider-receipt.js';

test('provider receipt uses transport identity, excludes credentials, and stays bound under concurrent requests', async () => {
  const provider = new OpenAiCvIntelligenceProvider({apiKey:'synthetic-secret-never-record-this',model:'configured-model',fetchImpl:async(_url,init)=>{
    const body=JSON.parse(String(init?.body));
    const id=JSON.parse(body.input[1].content).sourceSha256;
    return new Response(JSON.stringify({id:`resp_${id}`,model:'actual-model',created_at:1234,output_text:JSON.stringify({candidates:[],qualitySuggestions:[],unresolvedQuestions:[],providerReceipt:{responseId:'forged_model_claim'}})}),{status:200,headers:{'x-request-id':`req_${id}`}});
  }});
  const input=(id:string)=>({source:{objectId:'fixture',sha256:id,mimeType:'application/pdf' as const},blocks:[],documentType:'CV' as const,existingEvents:[],consentVersion:'synthetic',idempotencyKey:id});
  const [one,two]=await Promise.all([provider.analyze(input('one')),provider.analyze(input('two'))]);
  const a=getProviderReceipt(one)!;const b=getProviderReceipt(two)!;
  assert.equal(a.responseId,'resp_one');assert.equal(b.responseId,'resp_two');
  assert.equal(a.requestId,'req_one');assert.equal(a.model,'actual-model');assert.equal(a.createdAt,1234);assert.equal(a.store,false);
  assert.match(a.inputSha256,/^[a-f0-9]{64}$/);assert.notEqual(a.inputSha256,b.inputSha256);
  assert.doesNotMatch(JSON.stringify(a),/synthetic-secret|forged_model_claim/);
  assert.equal(getProviderReceipt({responseId:'forged'}),undefined);
});
