import assert from "node:assert/strict";
import test from "node:test";
import {buildQualitySuggestions} from "../web/js/ingestion/quality-review.js";
import {createD1408PdfIntakeAdapter,createProductionCvIntakeAdapter} from "../web/js/uxr-002/intake-d1-408-adapter.js";

// Small synthetic MD projection of the 022 live-canary regression; no provider calls.
const SHA="a".repeat(64);
const MD_LINE="Doctor of Medicine (MD), September 2016 - June 2022";
const BLOCK={id:"src-synthetic:page:1:block:5",pageNumber:1,text:MD_LINE};
const NOW=new Date("2026-09-07T12:00:00Z");
function candidate(provenancePatch={}){
  return{id:"md",categoryId:"education",title:"Doctor of Medicine (MD)",startDate:"2016-09",endDate:"2022-06",eventType:"duration",fields:{},
    provenance:[{sourceBlockId:"source_pdf_5",sourceSha256:SHA,pageNumber:1,sourceExcerpt:MD_LINE,...provenancePatch}]};
}
function dropped(candidates,options={}){
  return buildQualitySuggestions(candidates,{sourceBlocks:[BLOCK],now:NOW,...options}).filter((item)=>item.type==="SOURCE_ITEM_NOT_INCLUDED");
}

test("different parser IDs are covered only by the current source hash, page, and full excerpt",()=>{
  assert.equal(dropped([candidate()]).length,1);
  assert.equal(dropped([candidate()],{sourceSha256:SHA}).length,0);
  assert.equal(dropped([candidate({sourceExcerpt:"\tDoctor of Medicine (MD),\n September 2016  - June 2022 \n"})],{sourceSha256:SHA}).length,0);
  assert.equal(dropped([candidate({sourceSha256:SHA.toUpperCase()})],{sourceSha256:SHA.toUpperCase()}).length,0);
});

test("direct block ID coverage is preserved without a current-source hash",()=>{
  assert.equal(dropped([candidate({sourceBlockId:BLOCK.id,sourceSha256:"",pageNumber:null,sourceExcerpt:""})]).length,0);
});

for(const [name,provenancePatch,options] of [
  ["different source",{sourceSha256:"b".repeat(64)},{sourceSha256:SHA}],
  ["missing provenance hash",{sourceSha256:""},{sourceSha256:SHA}],
  ["malformed current hash",{},{sourceSha256:"a".repeat(63)}],
  ["different page",{pageNumber:2},{sourceSha256:SHA}],
  ["missing page",{pageNumber:null},{sourceSha256:SHA}],
  ["zero page",{pageNumber:0},{sourceSha256:SHA}],
  ["fractional page",{pageNumber:1.5},{sourceSha256:SHA}],
  ["string page",{pageNumber:"1"},{sourceSha256:SHA}],
  ["empty excerpt",{sourceExcerpt:" \n "},{sourceSha256:SHA}],
  ["title alone",{sourceExcerpt:"Doctor of Medicine (MD)"},{sourceSha256:SHA}],
  ["longer excerpt containing line",{sourceExcerpt:MD_LINE+". Distinction"},{sourceSha256:SHA}],
  ["changed date",{sourceExcerpt:MD_LINE.replace("2022","2023")},{sourceSha256:SHA}],
  ["changed punctuation",{sourceExcerpt:MD_LINE.replace(" - "," – ")},{sourceSha256:SHA}],
  ["changed case",{sourceExcerpt:MD_LINE.toLowerCase()},{sourceSha256:SHA}],
  ["missing block page",{},{sourceSha256:SHA,sourceBlocks:[{...BLOCK,pageNumber:null}]}],
  ["same text on another page",{},{sourceSha256:SHA,sourceBlocks:[{...BLOCK,pageNumber:2}]}],
])test(`source coverage keeps the unused-line warning for ${name}`,()=>{
  assert.equal(dropped([candidate(provenancePatch)],options).length,1);
});

test("covered MD line leaves genuinely unused dated lines and candidate facts unchanged",()=>{
  const candidates=[candidate()];
  const sourceBlocks=[BLOCK,{id:"unused",pageNumber:1,text:"2014 Synthetic community service award"}];
  const before=structuredClone({candidates,sourceBlocks});
  const suggestions=dropped(candidates,{sourceSha256:SHA,sourceBlocks});
  assert.deepEqual(suggestions.map((item)=>item.sourceBlockIds),[["unused"]]);
  assert.deepEqual({candidates,sourceBlocks},before);
});

test("source coverage does not hide a candidate date conflict",()=>{
  const item={...candidate(),endDate:"2015-06"};
  const suggestions=buildQualitySuggestions([item],{sourceBlocks:[BLOCK],sourceSha256:SHA,now:NOW});
  assert.ok(suggestions.some((finding)=>finding.type==="CHRONOLOGY_REVIEW"));
});

async function adapterResult({verified=true}={}){
  const file={name:"synthetic_cv.pdf",type:"application/pdf",size:1024,arrayBuffer:async()=>new TextEncoder().encode("%PDF-1.7 synthetic").buffer};
  const providerReceipt={responseId:"synthetic-test-receipt",model:"approved-model",store:false,inputSha256:SHA,outputSha256:"b".repeat(64)};
  const local={readable:true,outcome:"ready-for-review",candidates:[],
    sourceDocument:{id:"src-synthetic",fileName:file.name,fileSize:file.size,mimeType:file.type,sha256:SHA,effectiveType:"CV",userDeclaredType:"CV",parserVersion:"408.1.0"},
    sourceBlocks:[BLOCK],parser:{version:"408.1.0",networkCalls:false,qualitySuggestions:dropped([])}};
  const serverCandidate={id:"md",canonicalType:"MEDICAL_DEGREE",categoryId:"education",timelineKind:"duration",title:"Doctor of Medicine (MD)",
    startDate:"2016-09",endDate:"2022-06",organization:"Synthetic medical school",openEnded:false,confidence:{score:99,level:"HIGH",reasons:["Explicit evidence"]},safeToBulkAccept:true,
    evidence:[{field:"title",sourceBlockIds:["source_pdf_5"],excerpt:MD_LINE,support:"EXPLICIT",reason:"Explicit",uncertainty:null}],
    provenance:[{sourceObjectId:"object-source",sourceSha256:SHA,sourceBlockId:"source_pdf_5",pageNumber:1,excerpt:MD_LINE,fields:["title","startDate","endDate"],support:"EXPLICIT"}],
    classificationReason:"Explicit MD degree",warnings:[],uncertainty:[]};
  const original=structuredClone({local,serverCandidate});
  const adapter=createProductionCvIntakeAdapter({documentId:"timeline-synthetic",consentVersion:"d1-ux-007-ai-v1",
    localAdapter:{capability:createD1408PdfIntakeAdapter().capability,extract:async()=>local},
    apiClient:{signObjectUpload:async()=>({objectId:"object-source",uploadToken:"synthetic-token"}),uploadSignedObject:async()=>{},confirmObjectUpload:async()=>({status:"CONFIRMED"}),deleteObject:async()=>{},
      analyzeCv:async()=>({mode:"SERVER_AI",analysisId:"synthetic-analysis",provider:"openai",model:"approved-model",...(verified?{providerReceipt}:{}),
        candidates:[serverCandidate],qualitySuggestions:[],unresolvedQuestions:["Confirm whether the separate elective was clinical."]})}
  });
  const result=await adapter.extract({file,documentType:"CV"});
  assert.deepEqual({local,serverCandidate},original);
  return{result,providerReceipt};
}

test("verified provider adapter binds coverage to source SHA and reports its actual network participation",async()=>{
  const {result,providerReceipt}=await adapterResult();
  assert.equal(result.parser.intelligenceMode,"SERVER_AI");
  assert.equal(result.parser.networkCalls,true);
  assert.deepEqual(result.parser.providerReceipt,providerReceipt);
  assert.equal(result.parser.qualitySuggestions.filter((item)=>item.type==="SOURCE_ITEM_NOT_INCLUDED").length,0);
  assert.equal(result.candidates[0].provenance[0].sourceBlockId,"source_pdf_5");
  assert.equal(result.candidates[0].provenance[0].sourceSha256,SHA);
  assert.equal(result.candidates[0].provenance[0].sourceExcerpt,MD_LINE);
  assert.deepEqual(result.parser.unresolvedQuestions,["Confirm whether the separate elective was clinical."]);
});

test("an unverified provider response cannot borrow source coverage or replace local review",async()=>{
  const {result}=await adapterResult({verified:false});
  assert.equal(result.parser.intelligenceMode,"LOCAL_LIMITED");
  assert.equal(result.candidates.length,0);
  assert.equal(result.parser.providerReceipt,undefined);
  assert.equal(result.parser.qualitySuggestions.filter((item)=>item.type==="SOURCE_ITEM_NOT_INCLUDED").length,1);
});
