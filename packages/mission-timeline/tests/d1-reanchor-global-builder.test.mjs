import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {browserCountryRows,createCountryProvider} from "../web/js/uxr-002/datasets.js";
import {createMedicalSchoolProvider,createUnverifiedSchoolSubmission} from "../web/js/uxr-002/medical-school-registry.js";
import {mapCvIntelligenceCandidateToUxr} from "../web/js/uxr-002/intake-d1-408-adapter.js";
import {applyApprovalBatchToDocument,buildApprovalBatch,createIntakeState,renderIntake,transitionIntake} from "../web/js/uxr-002/intake.js";
import {clearLastGoodBuilderPreview,renderLastGoodBuilderPreview} from "../web/js/uxr-002/last-good-builder-preview.js";
import {defaultDocument} from "../web/js/uxr-002/store.js";
import {projectFounderPresentationDocument} from "../web/js/presentation/founder-presentation-serializer.js";

const iso=JSON.parse(await readFile(new URL("../web/data/geography/iso-3166-1-alpha-2-2024.json",import.meta.url),"utf8"));
const us=JSON.parse(await readFile(new URL("../web/data/medical-schools/us-dapip-2026-07-30.json",import.meta.url),"utf8"));
const global=JSON.parse(await readFile(new URL("../web/data/medical-schools/global-wikidata-2026-08-24.json",import.meta.url),"utf8"));

test("country search is limited to the 249 current ISO alpha-2 countries and territories",async()=>{
  assert.equal(iso.records.length,249);
  const rows=browserCountryRows();
  assert.equal(rows.length,249);
  assert.equal(rows.some(({code})=>["VD","YD","RH","AN"].includes(code)),false);
  assert.equal(rows.some(({code})=>code==="GH"),true);
  const fallback=browserCountryRows({DisplayNames:null});
  assert.equal(fallback.find(({code})=>code==="IN")?.value,"India");
  assert.equal((await createCountryProvider().search("Ghana"))[0]?.code,"GH");
});

test("governed school provider searches U.S. DAPIP and global CC0 identities without making accreditation claims",async()=>{
  assert.equal(global.manifest.coverage.excludes_united_states,true);
  assert.ok(global.records.length>1500);
  assert.ok(global.manifest.coverage.country_count>115);
  assert.equal(global.records.every((record)=>record.analytics_eligible===false),true);
  const provider=createMedicalSchoolProvider({
    urls:["us","global"],
    fetcher:async(url)=>url==="us"?us:global
  });
  const ghana=await provider.search("Kwame Nkrumah School Medical",{country:"Ghana"});
  assert.match(ghana[0]?.canonical_name||"",/Kwame Nkrumah/i);
  assert.equal(ghana[0]?.verification_status,"wikidata-identity-unverified-accreditation");
  const harvard=await provider.search("Harvard Medical School",{country:"United States"});
  assert.equal(harvard[0]?.canonical_name,"Harvard Medical School");
  assert.match(harvard[0]?.verification_status||"",/^source-reported/);
  const metadata=await provider.metadata();
  assert.equal(metadata.sourceCount,2);
  assert.ok(metadata.countryCount>115);
});

test("School not listed remains explicitly unverified and excluded from analytics",()=>{
  const record=createUnverifiedSchoolSubmission({name:"Synthetic International College of Medicine",country:"Nepal",idFactory:()=>"synthetic-nepal"});
  assert.equal(record.verification_status,"unverified");
  assert.equal(record.analytics_eligible,false);
  assert.equal(record.normalization_status,"queued");
});

test("approved AI candidates prefill Timeline events and blank profile fields without overwriting student data",()=>{
  const candidate={
    id:"cv_candidate_india_degree",extractionId:"cv_candidate_india_degree",categoryId:"education",
    title:"Bachelor of Medicine and Bachelor of Surgery",startDate:"2018-08",endDate:"2023-06",
    openEnded:false,eventType:"duration",confidence:"high",decision:"undecided",reviewLater:false,
    sourceSnippet:"Synthetic source",provenance:[{sourceExcerpt:"Synthetic source"}],warnings:[],
    fields:{canonicalType:"MEDICAL_DEGREE",medicalSchool:"Kasturba Medical College",medicalSchoolCountry:"India",degree:"MBBS"},
    visibilityState:"INTERVIEWER_SAFE"
  };
  let state=createIntakeState({file:{name:"synthetic-cv.pdf",size:100,type:"application/pdf"},candidates:[candidate]});
  state={...state,stage:"review",progressIndex:2};
  state=transitionIntake(state,{type:"ACCEPT_HIGH_CONFIDENCE"});
  const batch=buildApprovalBatch(state,[],{idFactory:()=>"event-ai-prefill",clock:()=>new Date("2026-08-24T12:00:00.000Z")});
  const document=defaultDocument();
  document.studentProfile.fullName="Synthetic Student";
  applyApprovalBatchToDocument(document,batch);
  assert.equal(document.events.length,1);
  assert.equal(document.studentProfile.medicalSchool,"Kasturba Medical College");
  assert.equal(document.studentProfile.medicalSchoolCountry,"India");
  assert.equal(document.studentProfile.degree,"MBBS");
  assert.equal(document.studentProfile.graduationDate,"2023-06");
  assert.equal(document.studentProfile.medicalSchoolVerificationStatus,"unverified-source-claimed");
  assert.equal(document.studentProfile.medicalSchoolAnalyticsEligible,false);
  assert.deepEqual(document.builder.lastAiPrefill,{at:"2026-08-24T12:00:00.000Z",sourceFileName:"synthetic-cv.pdf",acceptedCount:1,eventCount:1,profilePrefilled:true,examReviewCount:0});

  const established=defaultDocument();
  Object.assign(established.studentProfile,{
    medicalSchool:"Student-confirmed Medical School",
    medicalSchoolCountry:"Ghana",
    degree:"MD",
    graduationDate:"2021-05"
  });
  applyApprovalBatchToDocument(established,batch);
  assert.deepEqual({
    medicalSchool:established.studentProfile.medicalSchool,
    medicalSchoolCountry:established.studentProfile.medicalSchoolCountry,
    degree:established.studentProfile.degree,
    graduationDate:established.studentProfile.graduationDate
  },{
    medicalSchool:"Student-confirmed Medical School",
    medicalSchoolCountry:"Ghana",
    degree:"MD",
    graduationDate:"2021-05"
  });
});

test("medical-degree prefill wins over an earlier undergraduate education entry",()=>{
  const shared={
    openEnded:false,eventType:"duration",confidence:"high",decision:"undecided",reviewLater:false,
    sourceSnippet:"Synthetic source",provenance:[{sourceExcerpt:"Synthetic source"}],warnings:[],
    visibilityState:"INTERVIEWER_SAFE",categoryId:"education"
  };
  const undergraduate={
    ...shared,id:"cv_undergraduate",extractionId:"cv_undergraduate",
    title:"Bachelor of Science",startDate:"2014-08",endDate:"2018-05",
    fields:{canonicalType:"EDUCATION",medicalSchool:"Northlake University",degree:"BS"}
  };
  const medicalDegree={
    ...shared,id:"cv_medical_degree",extractionId:"cv_medical_degree",
    title:"Doctor of Medicine, Harborview International Medical School",startDate:"2018-08",endDate:"2022-06",
    fields:{canonicalType:"EDUCATION",degree:"MD"}
  };
  let state=createIntakeState({file:{name:"synthetic-cv.pdf",size:100,type:"application/pdf"},candidates:[undergraduate,medicalDegree]});
  state=transitionIntake({...state,stage:"review",progressIndex:2},{type:"ACCEPT_HIGH_CONFIDENCE"});
  let id=0;
  const batch=buildApprovalBatch(state,[],{idFactory:()=>`event-profile-${++id}`});
  const document=defaultDocument();
  applyApprovalBatchToDocument(document,batch);
  assert.equal(document.studentProfile.medicalSchool,"Harborview International Medical School");
  assert.equal(document.studentProfile.degree,"MD");
  assert.equal(document.studentProfile.graduationDate,"2022-06");
});

test("medical-school title fallback does not invent an institution from a bare degree title",()=>{
  const candidate={
    id:"cv_degree_without_school",extractionId:"cv_degree_without_school",categoryId:"education",
    title:"Doctor of Medicine",startDate:"2018-08",endDate:"2022-06",
    openEnded:false,eventType:"duration",confidence:"high",decision:"undecided",reviewLater:false,
    sourceSnippet:"Doctor of Medicine",provenance:[{sourceExcerpt:"Doctor of Medicine"}],warnings:[],
    fields:{canonicalType:"MEDICAL_DEGREE",degree:"MD"},visibilityState:"INTERVIEWER_SAFE"
  };
  let state=createIntakeState({file:{name:"synthetic-cv.pdf",size:100,type:"application/pdf"},candidates:[candidate]});
  state=transitionIntake({...state,stage:"review",progressIndex:2},{type:"ACCEPT_HIGH_CONFIDENCE"});
  const batch=buildApprovalBatch(state,[],{idFactory:()=>"event-degree-no-school"});
  const document=defaultDocument();
  applyApprovalBatchToDocument(document,batch);
  assert.equal(document.studentProfile.medicalSchool,"");
  assert.equal(document.studentProfile.degree,"MD");
  assert.equal(document.studentProfile.graduationDate,"2022-06");
});

test("server AI mapping bulk-accepts professional CV facts into the interview Timeline while preserving narrower visibility",()=>{
  const source={
    id:"cv_candidate_india_degree",canonicalType:"MEDICAL_DEGREE",categoryId:"education",
    timelineKind:"duration",title:"Bachelor of Medicine and Bachelor of Surgery (MBBS)",
    organization:"Kasturba Medical College",country:"India",startDate:"2018-08",endDate:"2023-06",
    openEnded:false,confidence:{level:"HIGH"},safeToBulkAccept:true,
    review:{lane:"HIGH",action:"BULK_ACCEPT",requiredFields:[],smallestQuestion:null},
    evidence:[],warnings:[],uncertainty:[]
  };
  const mapped=mapCvIntelligenceCandidateToUxr(source);
  assert.equal(mapped.visibilityState,"ADVISOR_ONLY");
  assert.equal(mapped.fields.degree,"MBBS");

  let state=createIntakeState({file:{name:"synthetic-cv.pdf",size:100,type:"application/pdf"},candidates:[mapped]});
  state={...state,stage:"review",progressIndex:2};
  const review=renderIntake(state);
  assert.match(review,/Timeline visibility/);
  assert.match(review,/Show in interview Timeline/);
  assert.match(review,/Advisor only/);
  state=transitionIntake(state,{type:"ACCEPT_HIGH_CONFIDENCE"});
  const batch=buildApprovalBatch(state,[],{idFactory:()=>"event-ai-interview-safe"});
  const document=defaultDocument();
  applyApprovalBatchToDocument(document,batch);
  assert.equal(document.events[0].visibilityState,"ADVISOR_ONLY");
  assert.equal(projectFounderPresentationDocument(document,{scope:"INTERVIEWER_SAFE"}).events.length,0);
  assert.equal(document.studentProfile.degree,"MBBS");

  const explicitlySafe=mapCvIntelligenceCandidateToUxr({
    ...source,
    id:"cv-interviewer-safe",
    visibilityRecommendation:"INTERVIEWER_SAFE"
  });
  assert.equal(explicitlySafe.visibilityState,"INTERVIEWER_SAFE");

  const narrower=mapCvIntelligenceCandidateToUxr({...source,id:"cv-advisor",visibilityRecommendation:"ADVISOR_ONLY"});
  assert.equal(narrower.visibilityState,"ADVISOR_ONLY");
  const personal=mapCvIntelligenceCandidateToUxr({
    ...source,id:"cv-personal",canonicalType:"PERSONAL_NOT_ON_CV",categoryId:"personal",
    title:"Moved to the United States",timelineKind:"milestone",visibilityRecommendation:"INTERVIEWER_SAFE"
  });
  assert.equal(personal.visibilityState,"ADVISOR_ONLY");
});

test("Builder preview keeps the last valid canvas when recalculation fails",()=>{
  clearLastGoodBuilderPreview("preview-test");
  const document={id:"preview-test"};
  const first=renderLastGoodBuilderPreview(document,{},()=>'<div><svg data-version="good"></svg></div>');
  const second=renderLastGoodBuilderPreview(document,{},()=>'<div data-render-isolated="BROKEN"><svg></svg></div>');
  assert.match(first,/data-version="good"/);
  assert.match(second,/data-version="good"/);
  assert.match(second,/data-preview-recalculating="true"/);
  const third=renderLastGoodBuilderPreview(document,{},()=>{throw new Error("synthetic failure");});
  assert.match(third,/data-preview-recovery="true"/);
  assert.doesNotMatch(third,/loading canonical timeline/i);
});
