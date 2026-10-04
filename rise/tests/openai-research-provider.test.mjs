import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from 'node:crypto';

import {
  calculateOpenAiResearchCost,
  createOpenAiResearchProvider,
} from "../adapters/openai-research-provider.mjs";

function fixtureResponse(acgmeId = "1854831078") {
  const text = JSON.stringify({
    program_identity: {
      acgme_id: acgmeId,
      program_name: "Fixture Child Neurology Program",
      institution: "Fixture Institution",
      specialty: "Child Neurology",
      state: "TX",
    },
    findings: [{
      field: "visa", status: "FOUND", summary: "J-1 sponsorship is published.",
      value_json: JSON.stringify({ j1: true, h1b: false }),
      source_urls: ["https://example.edu/residency/visa", "https://uncited.example/claim"],
    }],
    completion_matrix: {
      visa: { state: "VERIFIED", summary: "Official J-1 sponsorship evidence found.", source_urls: ["https://example.edu/residency/visa"] },
    },
    research_summary: "One official source-backed finding.",
  });
  return {
    id: "resp_fixture_5012e", status:"completed", model:"gpt-5.6-terra",
    usage: { input_tokens: 1000, input_tokens_details: { cached_tokens: 200 }, output_tokens: 500 },
    output: [
      { type: "web_search_call", action: { sources: [
        { url: "https://example.edu/residency/visa" },
        { url: "https://unrelated.example/reference" },
      ] } },
      { type: "message", content: [{ type: "output_text", text, annotations: [{ type: "url_citation", url: "https://example.edu/residency/visa" }] }] },
    ],
  };
}

function dossierOnlyCitationResponse() {
  const response = fixtureResponse();
  const parsed = JSON.parse(response.output[1].content[0].text);
  parsed.findings[0].source_urls = [];
  response.output[1].content[0].text = JSON.stringify(parsed);
  response.output[1].content[0].annotations = [];
  return response;
}

test("OpenAI research cost uses model token rates plus bounded web-search calls", () => {
  assert.equal(calculateOpenAiResearchCost({
    providerKey: "OPENAI_TERRA",
    usage: { input_tokens: 1000, input_tokens_details: { cached_tokens: 200 }, output_tokens: 500 },
    webSearchCalls: 1,
  }), 0.0177);
  assert.equal(calculateOpenAiResearchCost({
    providerKey: "OPENAI_SOL",
    usage: { input_tokens: 1000, input_tokens_details: { cached_tokens: 200 }, output_tokens: 500 },
    webSearchCalls: 1,
  }), 0.0233);
});

test("Terra adapter emits review-gated canonical claims and keeps only cited URLs", async () => {
  let requestBody;
  const provider = createOpenAiResearchProvider({
    providerKey: "OPENAI_TERRA",
    apiKey: "test-key",
    fetchImpl: async (_url, init) => {
      requestBody = JSON.parse(init.body);
      return new Response(JSON.stringify(fixtureResponse()), {
        status: 200, headers: { "content-type": "application/json" },
      });
    },
  });
  const result = await provider.execute({
    job: {
      jobId: "job-5012e", taskClass: "PROVIDER_BENCHMARK",
      programSpecialtyId: "rise_ps_e1ada2b6-9c76-59c0-89c9-62edf4960026",
      acgmeId: "1854831078", specialty: "Child Neurology", state: "TX",
      taskPayload: { programName: "Fixture", institution: "Fixture", officialUrls: [], requestedDomains: ["visa"], requestedFields: ["research.visa"] },
    },
  });
  assert.equal(result.providerKey, "OPENAI_TERRA");
  assert.equal(requestBody.max_output_tokens, 16000);
  assert.equal(result.findingCount, 1);
  assert.equal(result.ingest.provider, "OPENAI");
  assert.equal(result.ingest.claims[0].publicationState, "REVIEW_REQUIRED");
  assert.deepEqual(result.ingest.claims[0].sourceUrls, ["https://example.edu/residency/visa"]);
  assert.deepEqual(result.benchmarkFindings, [{
    field: "visa",
    status: "FOUND",
    summary: "J-1 sponsorship is published.",
    value: { j1: true, h1b: false },
    sourceUrls: ["https://example.edu/residency/visa"],
  }]);
  assert.deepEqual(result.benchmarkMetrics, {
    foundCount: 1,
    researchedNotFoundCount: 0,
    conflictCount: 0,
    sourceBackedCount: 1,
  });
  assert.equal(result.actualCostUsd, 0.0177);
});

test("provider identity mismatch fails closed before canonical ingestion", async () => {
  const provider = createOpenAiResearchProvider({
    providerKey: "OPENAI_SOL",
    apiKey: "test-key",
    fetchImpl: async () => new Response(JSON.stringify(fixtureResponse("1851113100")), { status: 200 }),
  });
  await assert.rejects(provider.execute({
    job: { jobId: "job", taskClass: "PROGRAM_DEEP_RESEARCH", programSpecialtyId: "ps", acgmeId: "1854831078", specialty: "Child Neurology", state: "TX", taskPayload: { requestedDomains: ["visa"], requestedFields: ["research.visa"] } },
  }), /identity mismatch/);
});

test("web-search action sources remain dossier evidence when structured JSON omits URLs", async () => {
  const provider = createOpenAiResearchProvider({
    providerKey: "OPENAI_TERRA",
    apiKey: "test-key",
    fetchImpl: async () => new Response(JSON.stringify(dossierOnlyCitationResponse()), { status: 200 }),
  });
  const result = await provider.execute({
    job: {
      jobId: "job-dossier", taskClass: "PROVIDER_BENCHMARK",
      programSpecialtyId: "rise_ps_e1ada2b6-9c76-59c0-89c9-62edf4960026",
      acgmeId: "1854831078", specialty: "Child Neurology", state: "TX",
      taskPayload: { programName: "Fixture", institution: "Fixture", officialUrls: [], requestedDomains: ["visa"], requestedFields: ["research.visa"] },
    },
  });
  assert.deepEqual(result.ingest.claims[0].directSourceUrls, []);
  assert.deepEqual(result.ingest.claims[0].dossierSourceUrls, [
    "https://example.edu/residency/visa",
    "https://unrelated.example/reference",
  ]);
  assert.deepEqual(result.ingest.claims[0].sourceUrls, [
    "https://example.edu/residency/visa",
    "https://unrelated.example/reference",
  ]);
  assert.equal(result.benchmarkMetrics.sourceBackedCount, 1);
});

test("verified roster evidence fails closed when cross-field counts disagree", async () => {
  const response = fixtureResponse();
  const parsed = JSON.parse(response.output[1].content[0].text);
  parsed.findings = [
    { field: "resident_roster", status: "FOUND", summary: "Two residents.", value_json: JSON.stringify([{ name: "A" }, { name: "B" }]), source_urls: ["https://example.edu/residency/visa"] },
    { field: "resident_medical_schools", status: "FOUND", summary: "Three schools.", value_json: JSON.stringify([{ resident: "A" }, { resident: "B" }, { resident: "C" }]), source_urls: ["https://example.edu/residency/visa"] },
  ];
  parsed.completion_matrix = {
    current_resident_roster: { state: "VERIFIED", summary: "Roster verified.", source_urls: ["https://example.edu/residency/visa"] },
    resident_medical_schools: { state: "VERIFIED", summary: "Schools verified.", source_urls: ["https://example.edu/residency/visa"] },
  };
  response.output[1].content[0].text = JSON.stringify(parsed);
  const provider = createOpenAiResearchProvider({
    providerKey: "OPENAI_TERRA",
    apiKey: "test-key",
    fetchImpl: async () => new Response(JSON.stringify(response), { status: 200 }),
  });
  await assert.rejects(provider.execute({
    job: {
      jobId: "job-roster-mismatch", taskClass: "PROGRAM_DEEP_RESEARCH",
      programSpecialtyId: "rise_ps_e1ada2b6-9c76-59c0-89c9-62edf4960026",
      acgmeId: "1854831078", specialty: "Child Neurology", state: "TX",
      taskPayload: {
        requestedDomains: ["current_resident_roster", "resident_medical_schools"],
        requestedFields: ["research.resident_roster", "research.resident_medical_schools"],
      },
    },
  }), (error) => error?.code === "DOSSIER_CROSS_FIELD_INCONSISTENT");
});

const recoveryJob=()=>({jobId:'synthetic-recovery',taskClass:'PROGRAM_DEEP_RESEARCH',programSpecialtyId:'rise_ps_e1ada2b6-9c76-59c0-89c9-62edf4960026',
  acgmeId:'1854831078',specialty:'Child Neurology',state:'TX',taskPayload:{programName:'Synthetic',institution:'Synthetic',officialUrls:[],requestedDomains:['visa'],requestedFields:['research.visa']}});
function recoveryFixture({body=JSON.stringify(fixtureResponse()),status=200,fetchImpl}={}) {
  let calls=0;
  const provider=createOpenAiResearchProvider({providerKey:'OPENAI_TERRA',apiKey:'synthetic-secret-must-never-be-checkpointed',
    fetchImpl:async(...args)=>{calls++;return fetchImpl?fetchImpl(...args):new Response(body,{status});}});
  return {provider,calls:()=>calls};
}

test('recovery checkpoints exact bytes before normalization and retains no headers or secrets',async()=>{
  const raw=' \n'+JSON.stringify(fixtureResponse())+'\n',f=recoveryFixture({body:raw}),controller=new AbortController();let record;
  const result=await f.provider.execute({job:recoveryJob(),recovery:{signal:controller.signal,checkpointResponse:async r=>{record=r;assert.ok(Object.isFrozen(r));}}});
  assert.equal(Buffer.from(record.rawBodyBase64,'base64').toString(),raw);
  assert.equal(record.sha256,createHash('sha256').update(raw).digest('hex'));
  assert.deepEqual(Object.keys(record).sort(),['httpStatus','modelKey','providerKey','rawBodyBase64','receivedAt','sha256']);
  assert.ok(!JSON.stringify(record).includes('synthetic-secret'));assert.ok(!('rawBodyBase64' in result));assert.equal(f.calls(),1);assert.equal(result.findingCount,1);
});
for(const [name,body,status] of [
  ['invalid-json','PRIVATE malformed response',200],['invalid-utf8',Buffer.from([0xff,0xfe,0x00]),200],
  ['http-error',JSON.stringify({error:{message:'PRIVATE upstream error'}}),429],['wrong-program',JSON.stringify(fixtureResponse('1851113100')),200],
  ['malformed-output-shape',JSON.stringify({output:'PRIVATE shape',usage:{}}),200],
]) test('recovery retains raw '+name+' without leaking it or silently retrying',async()=>{
  const f=recoveryFixture({body,status}),records=[];
  await assert.rejects(f.provider.execute({job:recoveryJob(),recovery:{signal:new AbortController().signal,checkpointResponse:async r=>records.push(r)}}),error=>{
    assert.equal(error.message,'Research provider recovery execution failed');assert.equal(typeof error.costKnown,'boolean');return true;
  });
  assert.equal(records.length,1);assert.deepEqual(Buffer.from(records[0].rawBodyBase64,'base64'),Buffer.from(body));assert.equal(f.calls(),1);
});
test('checkpoint failure is sanitized and cannot return a canonical result',async()=>{
  const f=recoveryFixture();await assert.rejects(f.provider.execute({job:recoveryJob(),recovery:{signal:new AbortController().signal,
    checkpointResponse:async()=>{throw Object.assign(Error('PRIVATE raw text'),{code:'PRIVATE secret'});}}}),{code:'RESEARCH_RECOVERY_CHECKPOINT_FAILED',message:'Research provider recovery execution failed'});
  assert.equal(f.calls(),1);
});
test('never-settling checkpoint has a bounded deadline and late completion cannot restore success',async()=>{
  const f=recoveryFixture();let finish;const start=performance.now();
  await assert.rejects(f.provider.execute({job:recoveryJob(),recovery:{signal:new AbortController().signal,checkpointResponse:()=>new Promise(r=>finish=r)}}),{code:'RESEARCH_RECOVERY_CHECKPOINT_FAILED'});
  assert.ok(performance.now()-start<6500);finish();await new Promise(r=>setImmediate(r));assert.equal(f.calls(),1);
});
test('pre-aborted recovery makes no provider request',async()=>{
  const f=recoveryFixture(),controller=new AbortController();controller.abort();
  await assert.rejects(f.provider.execute({job:recoveryJob(),recovery:{signal:controller.signal,checkpointResponse:async()=>{throw Error('must not run');}}}),{code:'RESEARCH_RECOVERY_ABORTED'});assert.equal(f.calls(),0);
});
test('outer abort reaches the provider and does not wait for an uncooperative fetch',async()=>{
  const controller=new AbortController();let signal;
  const f=recoveryFixture({fetchImpl:async(_u,o)=>{signal=o.signal;controller.abort();return new Promise(()=>{});}});
  await assert.rejects(f.provider.execute({job:recoveryJob(),recovery:{signal:controller.signal,checkpointResponse:async()=>{}}}),{code:'RESEARCH_RECOVERY_ABORTED'});assert.equal(signal.aborted,true);assert.equal(f.calls(),1);
});
test('abort while checkpoint waits prevents normalization despite late sink completion',async()=>{
  const controller=new AbortController(),f=recoveryFixture();let finish;
  await assert.rejects(f.provider.execute({job:recoveryJob(),recovery:{signal:controller.signal,checkpointResponse:()=>{
    controller.abort();return new Promise(r=>finish=r);
  }}}),{code:'RESEARCH_RECOVERY_ABORTED'});finish();assert.equal(f.calls(),1);
});
test('oversized raw result aborts before checkpoint and never retries',async()=>{
  let signal,checkpoints=0;const f=recoveryFixture({fetchImpl:async(_u,o)=>{signal=o.signal;return new Response('x'.repeat(8*1024*1024+1));}});
  await assert.rejects(f.provider.execute({job:recoveryJob(),recovery:{signal:new AbortController().signal,checkpointResponse:async()=>{checkpoints++;}}}),{code:'RESEARCH_RECOVERY_RESPONSE_TOO_LARGE'});
  assert.equal(checkpoints,0);assert.equal(signal.aborted,true);assert.equal(f.calls(),1);
});
test('invalid recovery configuration fails before dispatch',async()=>{
  const f=recoveryFixture();for(const recovery of [{},{signal:new AbortController().signal},{checkpointResponse:async()=>{}},null])
    await assert.rejects(f.provider.execute({job:recoveryJob(),recovery}),{code:'RESEARCH_RECOVERY_INVALID'});
  assert.equal(f.calls(),0);
});

test('recovery retains known usage on validation failure but never fabricates unknown cost',async()=>{
  const valid=fixtureResponse('1851113100'),invalid={...valid,usage:{input_tokens:'PRIVATE',output_tokens:0}};
  for(const [payload,known] of [[valid,true],[invalid,false],[{output:'PRIVATE shape',usage:{}},false]]) {
    const f=recoveryFixture({body:JSON.stringify(payload)});
    await assert.rejects(f.provider.execute({job:recoveryJob(),recovery:{signal:new AbortController().signal,checkpointResponse:async()=>{}}}),error=>{
      assert.equal(error.message,'Research provider recovery execution failed');assert.equal(error.costKnown,known);
      assert.equal(error.actualCostUsd,known?0.0177:0);assert.ok(!JSON.stringify(error).includes('PRIVATE'));return true;
    });assert.equal(f.calls(),1);
  }
});

test('recovery success projects accounting and rejects unvalidated response identifiers',async()=>{
  const payload=fixtureResponse();payload.usage.private_body='SYNTHETIC_RAW_PRIVATE_CANARY';
  const f=recoveryFixture({body:JSON.stringify(payload)}),records=[];
  const result=await f.provider.execute({job:recoveryJob(),recovery:{signal:new AbortController().signal,checkpointResponse:async r=>records.push(r)}});
  assert.deepEqual(result.usage,{input_tokens:1000,output_tokens:500,input_tokens_details:{cached_tokens:200}});
  assert.ok(!JSON.stringify(result).includes('SYNTHETIC_RAW_PRIVATE_CANARY'));
  assert.ok(Buffer.from(records[0].rawBodyBase64,'base64').toString().includes('SYNTHETIC_RAW_PRIVATE_CANARY'));
  for(const id of ['SYNTHETIC_RAW_PRIVATE_CANARY','resp_valid\n',null,'resp_'+ 'x'.repeat(181)]) {
    const wrong=recoveryFixture({body:JSON.stringify({...payload,id})});
    await assert.rejects(wrong.provider.execute({job:recoveryJob(),recovery:{signal:new AbortController().signal,checkpointResponse:async()=>{}}}),error=>{
      assert.equal(error.code,'RESEARCH_RECOVERY_FAILED');assert.equal(error.providerResponseId,null);assert.ok(!JSON.stringify(error).includes('SYNTHETIC_RAW_PRIVATE_CANARY'));return true;
    });
  }
});
