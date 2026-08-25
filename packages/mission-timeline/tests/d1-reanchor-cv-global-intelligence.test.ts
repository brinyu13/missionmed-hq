import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { ObjectRecord } from "../src/contracts/types.js";
import { sha256 } from "../src/core/canonical.js";
import { CvIntelligenceService, type AuthorizedCvSourceObject } from "../src/intelligence/cv-intelligence-service.js";
import type { CvIntelligenceProvider } from "../src/intelligence/cv-intelligence-provider.js";
import type { CvIntelligenceRequest, CvProviderCandidate, CvProviderEvidence, CvProviderResult } from "../src/intelligence/cv-intelligence-schema.js";
import { document, student } from "./fixtures.js";
import { syntheticCvPdf } from "./support/synthetic-cv-files.js";

const internationalFixture=JSON.parse(await readFile(
  new URL("./fixtures/d1-timeline-founder-reanchor-015/synthetic-international-cv-eval.json",import.meta.url),
  "utf8",
)) as {
  source_file_name:string;
  blocks:Array<{id:string;pageNumber:number;section:string;text:string}>;
};

const sourceLines=internationalFixture.blocks.map(({text})=>text.replace(/[–—]/g,"-"));
const sourceBytes=syntheticCvPdf(sourceLines);
const sourceHash=sha256(sourceBytes);
const sourceObject:ObjectRecord={
  id:"object_cv_global_synthetic",
  ownerPrincipalId:student.principalId,
  documentId:"timeline_test",
  objectClass:"SOURCE",
  storageKey:"opaque",
  mimeType:"application/pdf",
  expectedBytes:sourceBytes.byteLength,
  expectedSha256:sourceHash,
  status:"CONFIRMED",
  createdAt:"2026-08-24T00:00:00.000Z",
  confirmedAt:"2026-08-24T00:00:00.000Z",
};
const authorizedSource:AuthorizedCvSourceObject={record:sourceObject,bytes:sourceBytes};

const indiaBlock=internationalFixture.blocks.find(({id})=>id==="page_1_education")!;
const ghanaBlock=internationalFixture.blocks.find(({id})=>id==="page_2_research")!;
const indiaSourceText=indiaBlock.text.replace(/[–—]/g,"-");
const ghanaSourceText=ghanaBlock.text.replace(/[–—]/g,"-");

function request():CvIntelligenceRequest{
  return{
    source:{objectId:sourceObject.id,sha256:sourceHash,mimeType:"application/pdf",fileName:internationalFixture.source_file_name},
    blocks:internationalFixture.blocks,documentType:"CV",existingEvents:[],
    consentVersion:"d1-ux-007-ai-v1",idempotencyKey:"global-img-eval-1"
  };
}

function evidence(blockId:string,excerpt:string,fields:string[],inferred:string[]=[]):CvProviderEvidence[]{
  return fields.map((field)=>({
    field:field as CvProviderEvidence["field"],sourceBlockIds:[blockId],excerpt,
    support:inferred.includes(field)?"INFERRED":"EXPLICIT",
    reason:inferred.includes(field)?"The source role and section support this interpretation.":"The value is stated in the source.",
    uncertainty:inferred.includes(field)?"Confirm the category.":null
  }));
}

function providerCandidate(overrides:Partial<CvProviderCandidate>={}):CvProviderCandidate{
  return{
    localId:"india_medical_degree",canonicalType:"MEDICAL_DEGREE",categoryId:"education",
    timelineKind:"duration",title:"Bachelor of Medicine and Bachelor of Surgery (MBBS)",
    organization:"Kasturba Medical College",location:"Manipal, Karnataka, India",country:"India",
    specialty:null,experienceType:null,startDate:"2018-08",endDate:"2023-06",datePrecision:"MONTH",
    openEnded:false,classificationReason:"The source explicitly states a medical degree.",
    evidence:evidence(indiaBlock.id,indiaSourceText,["title","organization","location","country","startDate","endDate","canonicalType","categoryId"]),
    uncertainty:[],warnings:[],...overrides
  };
}

function serviceFor(result:CvProviderResult){
  const provider:CvIntelligenceProvider={
    descriptor:{provider:"synthetic-openai-contract",model:"gpt-test-pinned"},
    async analyze(providerRequest){
      const resolved=structuredClone(result);
      for(const candidate of resolved.candidates){
        for(const item of candidate.evidence){
          const block=providerRequest.blocks.find(({text})=>text.includes(item.excerpt));
          item.sourceBlockIds=block?[block.id]:["missing_exact_source_block"];
        }
      }
      return resolved;
    }
  };
  return new CvIntelligenceService({provider,expectedConsentVersion:"d1-ux-007-ai-v1",syntheticPrincipalIds:[student.principalId]});
}

test("international medical education is evidence-bound, bulk-safe, and carries exact source provenance",async()=>{
  const response=await serviceFor({candidates:[providerCandidate()],qualitySuggestions:[],unresolvedQuestions:[]})
    .analyze(student,document(),authorizedSource,request(),true);
  assert.equal(response.candidates.length,1);
  const candidate=response.candidates[0]!;
  assert.equal(candidate.country,"India");
  assert.equal(candidate.safeToBulkAccept,true);
  assert.deepEqual(candidate.review,{lane:"HIGH",action:"BULK_ACCEPT",requiredFields:[],smallestQuestion:null});
  assert.equal(candidate.provenance[0]?.sourceFileName,"synthetic-global-img-cv.pdf");
  assert.equal(candidate.provenance[0]?.pageNumber,1);
  assert.equal(candidate.provenance[0]?.section,null);
  assert.ok(candidate.provenance.every((item)=>item.charEnd>item.charStart));
  assert.equal(candidate.normalizedInterpretation.organization,"Kasturba Medical College");
  assert.deepEqual(response.reviewSummary,{high:1,medium:0,low:0,bulkAcceptable:1});
  assert.deepEqual(response.prefillSummary,{timelineEvents:1,profileCandidates:1,examCandidates:0});
});

test("an inferred research classification is prefilled for one-click confirmation, not bulk accepted",async()=>{
  const excerpt=ghanaSourceText;
  const candidate=providerCandidate({
    localId:"ghana_research",canonicalType:"RESEARCH_EXPERIENCE",categoryId:"res",timelineKind:"duration",
    title:"Research Assistant",organization:"University of Ghana",location:"Accra, Ghana",country:"Ghana",
    startDate:"2021-07",endDate:"2022-12",classificationReason:"Research section and role imply research.",
    evidence:evidence(ghanaBlock.id,excerpt,["title","organization","location","country","startDate","endDate","canonicalType","categoryId"],["canonicalType","categoryId"])
  });
  const response=await serviceFor({candidates:[candidate],qualitySuggestions:[],unresolvedQuestions:[]})
    .analyze(student,document(),authorizedSource,request(),true);
  assert.equal(response.candidates[0]?.confidence.level,"MEDIUM");
  assert.equal(response.candidates[0]?.safeToBulkAccept,false);
  assert.equal(response.candidates[0]?.review.action,"QUICK_CONFIRM");
  assert.equal(response.candidates[0]?.country,"Ghana");
});

test("impossible dates and contradictory open-ended ranges are rejected instead of entering the Timeline",async()=>{
  const impossible=providerCandidate({localId:"bad_date",startDate:"2023-02-30"});
  const unsupportedMonth=providerCandidate({localId:"wrong_month",startDate:"2018-12"});
  const contradictory=providerCandidate({localId:"bad_present",openEnded:true,endDate:"2023-06"});
  const unsupportedOpenEnded=providerCandidate({localId:"unsupported_present",openEnded:true,endDate:null});
  const response=await serviceFor({candidates:[impossible,unsupportedMonth,contradictory,unsupportedOpenEnded],qualitySuggestions:[],unresolvedQuestions:[]})
    .analyze(student,document(),authorizedSource,request(),true);
  assert.equal(response.candidates.length,0);
  assert.equal(response.rejectedCandidateCount,4);
  assert.deepEqual(response.reviewSummary,{high:0,medium:0,low:0,bulkAcceptable:0});
});
