import assert from "node:assert/strict";
import test from "node:test";
import {createIntakeState,renderIntake,reviewBasis,transitionIntake,buildApprovalBatch,IntakeStateMachine,installIntake} from "../web/js/uxr-002/intake.js";

function state(){
  return transitionIntake(createIntakeState(),{type:"EXTRACTION_SUCCEEDED",candidates:[
    {id:"ai-one",title:"Synthetic research",categoryId:"research",startDate:"2022-01",endDate:"2022-06",confidence:"high",fields:{extractionBasis:"AI_REVIEW"},sourceSnippet:"Synthetic research, January–June 2022"},
    {id:"source-one",title:"Synthetic publication",categoryId:"research",startDate:"2023-01",confidence:"medium",fields:{extractionBasis:"MISSIONMED_RULE"},sourceSnippet:"Published in 2023"}
  ],parser:{intelligenceMode:"SERVER_AI",provider:"openai",model:"synthetic-model",rejectedCandidateCount:2,sourceRecoveryCount:1,
    providerReceipt:{provider:"openai",responseId:"resp_transport_021",model:"transport-model",store:false,inputSha256:'a'.repeat(64),outputSha256:'b'.repeat(64),receivedAt:"2026-09-06T12:00:00Z",apiKey:"never-render-me",requestBody:"also-never-render-me"}
  },qualitySuggestions:[{id:"check-one",candidateIds:["ai-one"],source:"DETERMINISTIC",type:"CONFLICT",severity:"REVIEW",reason:"Confirm this entry",recommendation:"Compare the source",status:"open"}]});
}

test("mixed review identifies each basis and explains excluded AI separately from source recovery",()=>{
  const review=state();
  const html=renderIntake(review);
  assert.match(html,/AI review \+ source checks/);
  assert.match(html,/data-candidate-basis="AI_REVIEW">AI review/);
  assert.match(html,/data-candidate-basis="MISSIONMED_RULE">Source check/);
  assert.match(html,/2 AI interpretations were excluded by validation/);
  assert.match(html,/1 additional source-check entry is included below/);
  assert.match(html,/not the excluded AI interpretations/);
  assert.match(html,/data-intake-filter="all" data-intake-recovery-review/);
  assert.equal(review.candidates.length,2);
  assert.equal(review.candidates.filter(item=>item.decision==="accepted").length,0);
});

test("provider receipt uses transport fields and a strict display whitelist",()=>{
  const html=renderIntake(state());
  assert.match(html,/<summary>AI review details<\/summary>/);
  assert.match(html,/resp_transport_021/);
  assert.match(html,/transport-model/);
  assert.match(html,/Disabled \(store: false\)/);
  assert.doesNotMatch(html,/never-render-me/);
  const withoutReceipt=state();
  delete withoutReceipt.extraction.parser.providerReceipt;
  assert.match(renderIntake(withoutReceipt),/DOCUMENT CHECK/);
  assert.doesNotMatch(renderIntake(withoutReceipt),/data-candidate-basis="AI_REVIEW"|AI review details/);
});

test("review eligibility supersedes source confidence while source evidence stays available",()=>{
  const html=renderIntake(state());
  const flagged=html.match(/<article class="candidate-card" data-candidate-card="ai-one"[\s\S]*?<\/article>/)?.[0];
  assert.ok(flagged);
  assert.match(flagged,/data-review-lane="medium"/);
  assert.match(flagged,/confidence-tag gold">Check required/);
  assert.doesNotMatch(flagged,/confidence-tag success/);
  assert.match(flagged,/Source confidence: high/);
  assert.match(flagged,/<details class="source-snippet candidate-evidence" aria-label="Extraction evidence">/);
  assert.match(flagged,/Synthetic research, January–June 2022/);
  for(const field of ["title","categoryId","startDate","endDate","visibilityState"]){
    assert.match(flagged,new RegExp(`data-candidate-field="${field}"`));
  }
  assert.match(flagged,/data-candidate-action="accepted"/);
  assert.match(flagged,/data-candidate-action="edit"/);
});

test("local review never gains an AI receipt or exclusion claim merely from source checks",()=>{
  const review=state();
  review.extraction.parser={intelligenceMode:"LOCAL_LIMITED",fallbackReason:"PROVIDER_UNAVAILABLE"};
  review.candidates.forEach(item=>item.fields.extractionBasis="MISSIONMED_RULE");
  const html=renderIntake(review);
  assert.match(html,/DOCUMENT CHECK/);
  assert.doesNotMatch(html,/intake-provider-receipt|excluded by validation/);
  assert.equal(reviewBasis(review.extraction.parser,review.candidates).mode,"LOCAL_LIMITED");
});

test("year-only source dates display years and keep precision through edit and approval",()=>{
  const initialState=transitionIntake(createIntakeState(),{type:"EXTRACTION_SUCCEEDED",candidates:[{
    id:"year-only",title:"Synthetic volunteer",categoryId:"personal",eventType:"duration",startDate:"2019-01",endDate:"2021-12",confidence:"medium",visibilityState:"ADVISOR_ONLY",
    fields:{datePrecision:{start:"YEAR",end:"YEAR"},extractionBasis:"MISSIONMED_RULE"},inferredFields:[{field:"startDate",sourcePrecision:"YEAR"}],sourceSnippet:"Volunteer, 2019–2021"
  }]});
  const machine=new IntakeStateMachine({initialState});
  const html=renderIntake(machine.state);
  assert.match(html,/value="2019"[^>]*data-candidate-field="startDate"[^>]*data-candidate-year-only="true"/);
  assert.match(html,/value="2021"[^>]*data-candidate-field="endDate"[^>]*data-candidate-year-only="true"/);
  assert.doesNotMatch(html,/value="Jan 2019"|value="Dec 2021"/);
  assert.match(html,/The source gives years only\. Months remain unconfirmed/);
  assert.match(html,/Extracted dates: 2019 – 2021/);
  const listeners=new Map();
  const root={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:()=>{}};
  const cleanup=installIntake(root,machine);
  listeners.get("change")({target:{value:"2020",dataset:{candidateId:"year-only",candidateField:"startDate",candidateYearOnly:"true",candidatePlaceholderMonth:"01"},closest:()=>null}});
  assert.equal(machine.state.candidates[0].startDate,"2020-01");
  machine.decideCandidate("year-only","accepted");
  const batch=buildApprovalBatch(machine.state,[],{idFactory:()=>"year-event"});
  assert.deepEqual(batch.additions[0].fields.datePrecision,{start:"YEAR",end:"YEAR"});
  assert.equal(batch.additions[0].visibilityState,"ADVISOR_ONLY");
  cleanup();
});
