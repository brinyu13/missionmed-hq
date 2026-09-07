import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { OpenAiCvIntelligenceProvider } from "../src/intelligence/openai-cv-intelligence.js";
import { OpenAiTimelineWorkflowProvider } from "../src/intelligence/openai-timeline-ai-workflows.js";
import { timelineAiProviderTimeoutMs022 } from "../src/intelligence/provider-deadline-022.js";
import { getProviderReceipt } from "../src/intelligence/provider-receipt.js";
import type { CvIntelligenceRequest } from "../src/intelligence/cv-intelligence-schema.js";
import type { TimelineQualityAiInput, TimelineRescueAiInput } from "../src/intelligence/timeline-ai-workflow-schema.js";
const cv: CvIntelligenceRequest={source:{objectId:"controlled-source",sha256:"a".repeat(64),mimeType:"application/pdf"},blocks:[{id:"block-1",pageNumber:1,section:null,text:"Controlled synthetic fixture"}],documentType:"CV",existingEvents:[],consentVersion:"controlled-consent",idempotencyKey:"controlled-deadline"};
const quality: TimelineQualityAiInput={documentId:"controlled-timeline",documentRevision:1,events:[],presentation:{theme:"default",backgroundKind:null,advancedObjectCount:0,deterministicFindings:[]},standard:{version:"D1-TIMELINE-FOUNDER-REANCHOR-015+DR-127",requirements:[],founderPreferences:[]}};
const rescue: TimelineRescueAiInput={artifactSha256:"b".repeat(64),format:"PPTX",pageOrSlideCount:1,objects:[]};
const workflows=["CV","Guardian","Rescue"] as const;
type Workflow=typeof workflows[number];
function invoke(kind:Workflow,fetchImpl:typeof fetch,timeoutMs?:number,signal?:AbortSignal){
 const options={apiKey:"controlled-noncredential-test-value",model:"existing-configured-model",fetchImpl,timeoutMs};
 if(kind==="CV")return new OpenAiCvIntelligenceProvider(options).analyze(cv,signal);
 const p=new OpenAiTimelineWorkflowProvider(options);return kind==="Guardian"?p.analyzeQuality(quality,signal):p.observeRescue(rescue,signal);
}
function clock(t:TestContext){
 t.mock.timers.enable({apis:["setTimeout"]});const delays:number[]=[];
 t.mock.method(AbortSignal,"timeout",(delay:number)=>{delays.push(delay);const c=new AbortController();setTimeout(()=>c.abort(new DOMException("Controlled deadline","TimeoutError")),delay);return c.signal;});return delays;
}
type Captured={signal?:AbortSignal;body?:Record<string,unknown>};
function delayed(kind:Workflow,delay:number,captured:Captured):typeof fetch{return async(_url,init)=>{
 captured.signal=init?.signal as AbortSignal;captured.body=JSON.parse(String(init?.body));
 return new Promise<Response>((resolve,reject)=>{
  const signal=init?.signal;if(signal?.aborted){reject(signal.reason);return;}signal?.addEventListener("abort",()=>reject(signal.reason),{once:true});
  setTimeout(()=>resolve(new Response(JSON.stringify({id:"resp_controlled_deadline",model:"existing-configured-model",output_text:JSON.stringify(kind==="CV"?{candidates:[],qualitySuggestions:[],unresolvedQuestions:[]}:kind==="Guardian"?{findings:[],unresolvedQuestions:[]}:{observations:[],unresolvedQuestions:[]})}),{status:200})),delay);
 });
};}
for(const kind of workflows){
 test(`${kind} completes a 60-second response that previously hit the 45-second cutoff`,async(t)=>{
  const delays=clock(t),captured:Captured={};const pending=invoke(kind,delayed(kind,60000,captured));
  t.mock.timers.tick(45000);assert.equal(captured.signal?.aborted,false);t.mock.timers.tick(15000);const result=await pending;
  assert.deepEqual(delays,[90000]);assert.equal(getProviderReceipt(result)?.responseId,"resp_controlled_deadline");
  assert.equal(captured.body?.model,"existing-configured-model");assert.equal(captured.body?.store,false);assert.equal("reasoning" in captured.body!,false);
 });
 test(`${kind} aborts an overlong response at 90 seconds`,async(t)=>{
  clock(t);const captured:Captured={};const pending=invoke(kind,delayed(kind,90001,captured));const rejected=assert.rejects(pending,{code:"PROVIDER_UNAVAILABLE"});
  t.mock.timers.tick(89999);assert.equal(captured.signal?.aborted,false);t.mock.timers.tick(1);assert.equal(captured.signal?.aborted,true);await rejected;
 });
 test(`${kind} cannot configure a provider attempt beyond the WP envelope`,async(t)=>{
  const delays=clock(t);const pending=invoke(kind,delayed(kind,90001,{}),120000);const rejected=assert.rejects(pending,{code:"PROVIDER_UNAVAILABLE"});t.mock.timers.tick(90000);await rejected;assert.deepEqual(delays,[90000]);
 });
 test(`${kind} still honors earlier caller cancellation`,async(t)=>{
  clock(t);const c=new AbortController();const pending=invoke(kind,delayed(kind,60000,{}),undefined,c.signal);const rejected=assert.rejects(pending,{code:"PROVIDER_UNAVAILABLE"});c.abort();await rejected;
 });
}
test("deadline overrides stay finite, bounded and integral",()=>{
 assert.equal(timelineAiProviderTimeoutMs022(30000),30000);assert.equal(timelineAiProviderTimeoutMs022(0),5000);assert.equal(timelineAiProviderTimeoutMs022(60000.75),60000);
 for(const value of [NaN,Infinity,-Infinity])assert.throws(()=>timelineAiProviderTimeoutMs022(value),/TIMELINE_AI_TIMEOUT_INVALID/);
});
