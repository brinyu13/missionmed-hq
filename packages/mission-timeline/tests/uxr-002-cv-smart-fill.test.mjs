import assert from "node:assert/strict";
import test from "node:test";

import {normalizeDateRange,parseDatePoint} from "../web/js/ingestion/date-normalizer.js";
import {classifyHeading,detectSections} from "../web/js/ingestion/section-detector.js";
import {parseCvBlocks} from "../web/js/ingestion/cv-parser.js";
import {classifyEvent} from "../web/js/ingestion/event-classifier.js";
import {buildCandidates} from "../web/js/ingestion/candidate-builder.js";
import {buildQualitySuggestions,shortenTitle} from "../web/js/ingestion/quality-review.js";
import {
  createD1408PdfIntakeAdapter,
  createProductionCvIntakeAdapter,
  mapD1408CandidateToUxr
} from "../web/js/uxr-002/intake-d1-408-adapter.js";
import {
  IntakeStateMachine,
  buildApprovalBatch,
  candidateQuestions,
  highConfidenceCount,
  renderIntake,
  reviewLanes,
  suggestionsForCandidate
} from "../web/js/uxr-002/intake.js";

const CV_PAGE_ONE=[
  "RAMESH A. KULKARNI, MBBS",
  "Mumbai, India",
  "",
  "EDUCATION",
  "Bachelor of Medicine, Bachelor of Surgery (MBBS)",
  "Seth G.S. Medical College, Mumbai, India   08/2014-12/2019",
  "",
  "Postgraduate Training",
  "Rotating Internship in Internal Medicine",
  "King Edward Memorial Hospital, Mumbai, India   01/2020 - 12/2020",
  "",
  "US Clinical Experience",
  "Internal Medicine Observership",
  "Mount Sinai Beth Israel, New York, NY   Sept. 2021 - Nov. 2021",
  "",
  "Cardiology Externship",
  "Cleveland Clinic Florida, Weston, FL   2022-01-15 - 2022-03-30"
];

const CV_PAGE_TWO=[
  "Family Medicine Sub-Internship",
  "Baylor Scott & White Medical Center, Temple, TX   06/2022-08/2022",
  "",
  "Internal Medicine Observership",
  "Mount Sinai Beth Israel, New York, NY   Sept. 2021 - Nov. 2021",
  "",
  "Research Experience and Publications",
  "Research Assistant, Cardiovascular Outcomes Laboratory",
  "Johns Hopkins University, Baltimore, MD   03/2023 - Present",
  "",
  "Effect of early beta-blockade on 30-day readmission in acute decompensated heart failure among South Asian patients treated at tertiary centres | 2023",
  "",
  "EXAMINATIONS",
  "USMLE Step 1 | Passed | June 2021",
  "USMLE Step 2 CK | Passed | Jan. 2022",
  "",
  "Honors and Awards",
  "Dean's List for Academic Distinction   2017",
  "",
  "Work Experience",
  "Medical Officer",
  "Apollo Rural Health Clinic, Pune, India   02/2021 - 08/2021"
];

function syntheticPages(){
  return[CV_PAGE_ONE,CV_PAGE_TWO].map((lines,index)=>({
    id:`src-img-cv:page:${index+1}`,
    sourceDocumentId:"src-img-cv",
    pageNumber:index+1,
    lines,
    text:lines.join("\n"),
    charCount:lines.join("\n").length,
    textLayerPresent:true,
    extractionMethod:"PDFJS_TEXT_LAYER"
  }));
}

function syntheticSourceDocument(){
  return{
    id:"src-img-cv",
    fileName:"kulkarni_cv.pdf",
    fileSize:22222,
    mimeType:"application/pdf",
    sha256:"b".repeat(64),
    userDeclaredType:"CV",
    detectedType:"CV",
    effectiveType:"CV",
    extractionMethod:"PDFJS_TEXT_LAYER",
    parserVersion:"408.1.0",
    pageCount:2
  };
}

function syntheticExtraction(){
  const pages=syntheticPages();
  const text=pages.map(({text})=>text).join("\n");
  return{
    status:"EXTRACTED",
    sourceDocumentId:"src-img-cv",
    inspected:{name:"kulkarni_cv.pdf",size:22222,mimeType:"application/pdf",sha256:"b".repeat(64)},
    pageCount:2,
    charCount:text.length,
    text,
    extractionMethod:"PDFJS_TEXT_LAYER",
    warnings:[],
    pages
  };
}

function pipeline(){
  const sections=detectSections(syntheticPages());
  const records=parseCvBlocks(sections.blocks);
  const candidates=buildCandidates(records,syntheticSourceDocument()).map(mapD1408CandidateToUxr);
  return{sections,records,candidates};
}

test("C-11 and ISO: abbreviated months with a period, full ISO dates, and spaceless ranges all parse",()=>{
  assert.equal(parseDatePoint("Sept. 2019").timelineMonth,"2019-09");
  assert.deepEqual(parseDatePoint("Sept. 2019").warnings,[]);
  assert.equal(parseDatePoint("Jan. 2022").timelineMonth,"2022-01");
  assert.equal(parseDatePoint("2023-01-15").timelineMonth,"2023-01");
  assert.equal(parseDatePoint("2023-01-15").isoDate,"2023-01-15");
  assert.equal(parseDatePoint("2023-01-15").precision,"DAY");
  assert.deepEqual(parseDatePoint("2023-01-15").warnings,[]);
  assert.equal(parseDatePoint("Sep 12, 2019").isoDate,"2019-09-12");

  const iso=normalizeDateRange("2023-01-15 - 2024-02-20");
  assert.equal(iso.start.timelineMonth,"2023-01");
  assert.equal(iso.end.timelineMonth,"2024-02");
  const abbreviated=normalizeDateRange("Sept. 2021 - Nov. 2021");
  assert.equal(abbreviated.start.timelineMonth,"2021-09");
  assert.equal(abbreviated.end.timelineMonth,"2021-11");

  // the earlier repair pass must still hold
  const spaceless=normalizeDateRange("07/2021-12/2022");
  assert.equal(spaceless.start.timelineMonth,"2021-07");
  assert.equal(spaceless.end.timelineMonth,"2022-12");
  assert.equal(normalizeDateRange("2023-01").start.timelineMonth,"2023-01");
  assert.equal(normalizeDateRange("2023-01").end,null,"a bare ISO month must not be split into a range");
});

test("C-07 and C-08: Title Case headings are recognised and section context survives a page break",()=>{
  assert.equal(classifyHeading("Postgraduate Training"),"postgraduate_training");
  assert.equal(classifyHeading("US Clinical Experience"),"experiences");
  assert.equal(classifyHeading("Research Experience and Publications"),"research");
  assert.equal(classifyHeading("Honors and Awards"),"honors");
  assert.equal(classifyHeading("GRADUATE MEDICAL EDUCATION"),"postgraduate_training");
  assert.equal(classifyHeading("Clinical Experience at Mount Sinai"),null,"an entry that merely contains an alias is not a heading");
  assert.equal(classifyHeading("Mount Sinai Beth Israel, New York, NY"),null);

  const {blocks}=detectSections([
    {id:"p1",sourceDocumentId:"d",pageNumber:1,extractionMethod:"X",lines:["EDUCATION","Doctor of Medicine","Seth G.S. Medical College   2014 - 2019"]},
    {id:"p2",sourceDocumentId:"d",pageNumber:2,extractionMethod:"X",lines:["Universidad de Buenos Aires   2010 - 2014"]}
  ]);
  assert.equal(blocks.at(-1).pageNumber,2);
  assert.equal(blocks.at(-1).section,"education","section context is a document property, not a page property");
});

test("C-05: the degree is the title and the school is the organization in both CV block orders",()=>{
  const {blocks}=detectSections([{
    id:"p1",sourceDocumentId:"d",pageNumber:1,extractionMethod:"X",
    lines:[
      "EDUCATION",
      "Doctor of Medicine (MD)",
      "Universidad Nacional de Colombia, Bogota, Colombia   08/2014-12/2020",
      "Universidad de los Andes",
      "Bachelor of Science   2006 - 2010"
    ]
  }]);
  const records=parseCvBlocks(blocks);
  assert.equal(records.length,2);
  assert.equal(records[0].title,"Doctor of Medicine (MD)");
  assert.equal(records[0].organization,"Universidad Nacional de Colombia, Bogota, Colombia");
  assert.equal(records[1].title,"Bachelor of Science");
  assert.equal(records[1].organization,"Universidad de los Andes");
});

test("earlier repairs still hold: research at a university is not Education and US geography in the organization is not quarantined",()=>{
  const research=classifyEvent({
    section:"research",title:"Research Assistant",organization:"Johns Hopkins University, Baltimore, MD",
    location:"",rawText:"Research Assistant Johns Hopkins University"
  },{end:{},openEnded:false});
  assert.equal(research.canonicalType,"RESEARCH_EXPERIENCE");
  assert.equal(research.categoryId,"res");

  const rotation=classifyEvent({
    section:"experiences",title:"Internal Medicine Observership",organization:"Mount Sinai Beth Israel, New York, NY",
    location:"",rawText:"Internal Medicine Observership Mount Sinai Beth Israel, New York, NY"
  },{end:{},openEnded:false});
  assert.equal(rotation.canonicalType,"OBSERVERSHIP");
  assert.notEqual(rotation.canonicalType,"UNCLASSIFIED");
});

test("C-12: within-document duplicates, contradictions, and long labels are detected without a server",()=>{
  const now=new Date("2026-08-19T00:00:00Z");
  const base={categoryId:"clinical",eventType:"duration",confidence:"high",fields:{institution:"Mount Sinai Beth Israel"},provenance:[]};
  const duplicates=buildQualitySuggestions([
    {...base,id:"a",title:"Internal Medicine Observership",startDate:"2021-09",endDate:"2021-11"},
    {...base,id:"b",title:"Internal Medicine Observership",startDate:"2021-09",endDate:"2021-11"}
  ],{now});
  assert.equal(duplicates.length,1);
  assert.equal(duplicates[0].type,"POSSIBLE_DUPLICATE");
  assert.deepEqual(duplicates[0].candidateIds,["a","b"]);
  assert.equal(duplicates[0].proposal,null,"a duplicate is never resolved for the student");

  const conflict=buildQualitySuggestions([
    {...base,id:"a",title:"Internal Medicine Observership",startDate:"2021-09",endDate:"2021-11"},
    {...base,id:"b",title:"Internal Medicine Observership",startDate:"2022-04",endDate:"2022-06"}
  ],{now});
  assert.equal(conflict[0].type,"CHRONOLOGY_REVIEW");

  const backwards=buildQualitySuggestions([
    {...base,id:"c",title:"Cardiology Externship",startDate:"2022-06",endDate:"2022-01"}
  ],{now});
  assert.equal(backwards[0].type,"CHRONOLOGY_REVIEW");
  assert.match(backwards[0].reason,/ends \(2022-01\) before it starts \(2022-06\)/);

  const verbose=buildQualitySuggestions([{
    ...base,id:"d",categoryId:"research",
    title:"Effect of early beta-blockade on 30-day readmission in acute decompensated heart failure among South Asian patients",
    startDate:"2023-01",endDate:"2023-01"
  }],{now});
  assert.equal(verbose[0].type,"LABEL_READABILITY");
  assert.equal(verbose[0].proposal.patch.title,shortenTitle(verbose[0].proposal.patch.title));
  assert.ok(
    "Effect of early beta-blockade on 30-day readmission in acute decompensated heart failure among South Asian patients".startsWith(verbose[0].proposal.patch.title),
    "a shortened label must be a prefix of the student's own words"
  );

  const unmapped=buildQualitySuggestions([{
    ...base,id:"e",title:"Residency interview",startDate:"2024-11",endDate:null,eventType:"milestone",
    fields:{...base.fields,mappingReviewRequired:true}
  }],{now});
  assert.equal(unmapped[0].type,"CATEGORY_REVIEW");
  assert.equal(unmapped[0].proposal,null,"a category is never chosen for the student");

  const dropped=buildQualitySuggestions([],{
    sourceBlocks:[{id:"block-9",text:"Volunteer physician, flood relief camp, June 2018"}],now
  });
  assert.equal(dropped[0].type,"SOURCE_ITEM_NOT_INCLUDED");
});

test("C-06: the adapter hands the quality review to review, and applying a suggestion is visible and reversible",async()=>{
  const adapter=createD1408PdfIntakeAdapter({pdfExtractor:async()=>syntheticExtraction()});
  const result=await adapter.extract({file:{name:"kulkarni_cv.pdf",type:"application/pdf",size:22222},documentType:"CV"});
  assert.ok(Array.isArray(result.parser.qualitySuggestions));
  const duplicate=result.parser.qualitySuggestions.find(({type})=>type==="POSSIBLE_DUPLICATE");
  assert.ok(duplicate,"the two Mount Sinai observerships in one document must be flagged");

  const machine=new IntakeStateMachine({adapter});
  machine.receiveFile({name:"kulkarni_cv.pdf",type:"application/pdf",size:22222});
  machine.setConsent(true);
  const state=await machine.startExtraction();
  assert.equal(state.suggestions.length,result.parser.qualitySuggestions.length);
  assert.ok(state.suggestions.length>0);

  const html=renderIntake(machine.state);
  assert.match(html,/Before you review: \d+ things? we noticed/);
  assert.ok(
    html.indexOf('class="intake-suggestions"')<html.indexOf('class="candidate-list"'),
    "the document check must render above the cards the student is about to review"
  );

  const label=machine.state.suggestions.find(({type})=>type==="LABEL_READABILITY");
  assert.ok(label?.proposal,"an overly long label carries a reversible proposal");
  const target=machine.state.candidates.find(({id})=>id===label.proposal.candidateId);
  const originalTitle=target.title;
  machine.applySuggestion(label.id);
  const applied=machine.state.candidates.find(({id})=>id===label.proposal.candidateId);
  assert.equal(applied.title,label.proposal.patch.title);
  assert.notEqual(applied.title,originalTitle);
  assert.equal(machine.state.suggestions.find(({id})=>id===label.id).status,"applied");
  assert.match(renderIntake(machine.state),/Applied/);

  machine.undoSuggestion(label.id);
  assert.equal(machine.state.candidates.find(({id})=>id===label.proposal.candidateId).title,originalTitle);
  assert.equal(machine.state.suggestions.find(({id})=>id===label.id).status,"open");

  machine.dismissSuggestion(duplicate.id);
  assert.equal(machine.state.suggestions.find(({id})=>id===duplicate.id).status,"dismissed");
  assert.equal(suggestionsForCandidate(machine.state,duplicate.candidateIds[0]).length,0);
});

test("C-06: a suggestion never silently rewrites the student's history",()=>{
  const {candidates}=pipeline();
  const suggestions=buildQualitySuggestions(candidates,{now:new Date("2026-08-19T00:00:00Z")});
  for(const suggestion of suggestions){
    if(!suggestion.proposal)continue;
    assert.ok(["MISSING_END_DATE","LABEL_READABILITY"].includes(suggestion.type),`${suggestion.type} must not carry an automatic edit`);
    for(const field of Object.keys(suggestion.proposal.patch)){
      assert.ok(["title","endDate","openEnded","eventType"].includes(field),`${field} must not be proposed automatically`);
    }
  }
  assert.equal(
    suggestions.filter(({type})=>type==="CATEGORY_REVIEW").every(({proposal})=>proposal===null),
    true
  );
});

test("C-09: HIGH bulk-accepts, MEDIUM waits for confirmation, and LOW asks only the unanswered question",async()=>{
  const adapter={
    capability:{mode:"test",productionReady:false,simulated:true,source:"test"},
    async extract(){
      return{
        readable:true,
        candidates:[
          {id:"high-1",categoryId:"clinical",title:"Internal Medicine Observership",startDate:"2021-09",endDate:"2021-11",eventType:"duration",confidence:"high",sourceSnippet:"Observership",fields:{institution:"Mount Sinai"}},
          {id:"high-2",categoryId:"exams",title:"USMLE Step 1",startDate:"2021-06",endDate:null,eventType:"milestone",confidence:"high",sourceSnippet:"Step 1",fields:{examName:"USMLE Step 1"}},
          {id:"medium-1",categoryId:"work",title:"Medical Officer",startDate:"2021-02",endDate:"2021-08",eventType:"duration",confidence:"medium",sourceSnippet:"Medical Officer",fields:{organization:"Apollo Clinic"}},
          {id:"low-1",categoryId:"clinical",title:"Cardiology Externship",startDate:"2022-01",endDate:null,eventType:"duration",confidence:"low",sourceSnippet:"Cardiology Externship",fields:{institution:"Cleveland Clinic"}}
        ],
        parser:{
          version:"408.1.0",
          qualitySuggestions:[{
            id:"flag-1",type:"CATEGORY_REVIEW",severity:"REVIEW",candidateIds:["high-2"],eventIds:[],sourceBlockIds:[],
            reason:"The exam system is ambiguous.",recommendation:"Confirm the exam system.",source:"AI_REVIEW"
          }]
        }
      };
    }
  };
  const machine=new IntakeStateMachine({adapter});
  machine.receiveFile({name:"cv.pdf",type:"application/pdf",size:1024});
  machine.setConsent(true);
  await machine.startExtraction();

  const lanes=reviewLanes(machine.state);
  assert.deepEqual(lanes.high.map(({id})=>id),["high-1"]);
  assert.deepEqual(lanes.medium.map(({id})=>id).sort(),["high-2","medium-1"],"a REVIEW flag demotes a high entry to confirmation");
  assert.deepEqual(lanes.low.map(({id})=>id),["low-1"]);
  assert.equal(highConfidenceCount(machine.state),1);

  const html=renderIntake(machine.state);
  assert.match(html,/Accept all 1 high-confidence entries/);
  assert.match(html,/Ready to accept \(1\)/);
  assert.match(html,/Confirm these \(2\)/);
  assert.match(html,/Needs your help \(1\)/);
  assert.match(html,/NEEDS YOUR HELP/);

  // LOW asks only for what the document does not state: the end date, not the title,
  // not the start date, and not the institution.
  const questions=candidateQuestions(machine.state.candidates.find(({id})=>id==="low-1"));
  assert.deepEqual(questions.map(({key})=>key),["endDate","currentlyOnRotation"]);
  assert.match(html,/We need 2 answers from you/);
  assert.doesNotMatch(html,/What should we call this\?/);
  assert.doesNotMatch(html,/When did it start\?/);

  machine.acceptAllHighConfidence();
  assert.equal(machine.state.candidates.find(({id})=>id==="high-1").decision,"accepted");
  assert.equal(machine.state.candidates.find(({id})=>id==="high-2").decision,"undecided","a flagged entry is never bulk-accepted");
  assert.equal(machine.state.candidates.find(({id})=>id==="medium-1").decision,"undecided");
  assert.equal(machine.state.candidates.find(({id})=>id==="low-1").decision,"undecided");
});

test("C-10: the internal mapping flag never renders as a student-editable field",async()=>{
  const machine=new IntakeStateMachine({
    adapter:{
      capability:{mode:"test",productionReady:false,simulated:true,source:"test"},
      async extract(){
        return{
          readable:true,
          candidates:[{
            id:"flagged",categoryId:"personal",title:"Residency interview",startDate:"2024-11",endDate:null,
            eventType:"milestone",confidence:"low",sourceSnippet:"Residency interview",
            fields:{mappingReviewRequired:true,canonicalType:"INTERVIEW",mappingRationale:"Interview wording",when:"One date"}
          }]
        };
      }
    }
  });
  machine.receiveFile({name:"cv.pdf",type:"application/pdf",size:1024});
  machine.setConsent(true);
  await machine.startExtraction();
  machine.toggleEdit("flagged");
  const html=renderIntake(machine.state);
  assert.equal(machine.state.candidates[0].fields.mappingReviewRequired,true,"the flag itself is preserved for downstream logic");
  assert.doesNotMatch(html,/data-candidate-extra="mappingReviewRequired"/);
  assert.doesNotMatch(html,/Mapping Review Required/);
});

test("C-04: the extracted employer and medical school reach the approved timeline event",async()=>{
  const machine=new IntakeStateMachine({
    idFactory:(prefix)=>`${prefix}-generated`,
    clock:()=>new Date("2026-08-19T00:00:00.000Z"),
    adapter:{
      capability:{mode:"test",productionReady:false,simulated:true,source:"test"},
      async extract(){
        return{
          readable:true,
          candidates:[
            {id:"school",categoryId:"education",title:"Doctor of Medicine (MD)",startDate:"2014-08",endDate:"2019-12",eventType:"milestone",confidence:"high",sourceSnippet:"MBBS",fields:{medicalSchool:"Seth G.S. Medical College"}},
            {id:"employer",categoryId:"work",title:"Medical Officer",startDate:"2021-02",endDate:"2021-08",eventType:"duration",confidence:"high",sourceSnippet:"Medical Officer",fields:{organization:"Apollo Rural Health Clinic"}}
          ]
        };
      }
    }
  });
  machine.receiveFile({name:"cv.pdf",type:"application/pdf",size:1024});
  machine.setConsent(true);
  await machine.startExtraction();
  machine.decideCandidate("school","accepted");
  machine.decideCandidate("employer","accepted");
  const batch=buildApprovalBatch(machine.state,[],{idFactory:(prefix)=>`${prefix}-generated`,clock:()=>new Date("2026-08-19T00:00:00.000Z")});
  const byTitle=Object.fromEntries(batch.additions.map((event)=>[event.title,event]));
  assert.equal(byTitle["Doctor of Medicine (MD)"].siteName,"Seth G.S. Medical College");
  assert.equal(byTitle["Medical Officer"].siteName,"Apollo Rural Health Clinic");
});

test("end to end: a two-page IMG CV produces categorised, dated, institution-bearing candidates",()=>{
  const {sections,candidates}=pipeline();
  assert.deepEqual(sections.sections,[
    "education","postgraduate_training","experiences","research","examinations","honors","work"
  ]);
  assert.equal(candidates.length,12);

  const byTitle=new Map(candidates.map((candidate)=>[candidate.title,candidate]));
  const institution=(candidate)=>candidate.fields.institution||candidate.fields.medicalSchool||candidate.fields.organization||"";

  const degree=byTitle.get("Bachelor of Medicine, Bachelor of Surgery (MBBS)");
  assert.equal(degree.categoryId,"education");
  assert.equal(degree.startDate,"2014-08");
  assert.equal(degree.endDate,"2019-12");
  assert.equal(institution(degree),"Seth G.S. Medical College, Mumbai, India");

  const observership=byTitle.get("Internal Medicine Observership");
  assert.equal(observership.categoryId,"clinical");
  assert.equal(observership.startDate,"2021-09","Sept. 2021 must parse");
  assert.equal(observership.endDate,"2021-11");
  assert.equal(institution(observership),"Mount Sinai Beth Israel, New York, NY");

  const externship=byTitle.get("Cardiology Externship");
  assert.equal(externship.categoryId,"clinical");
  assert.equal(externship.startDate,"2022-01","the full ISO date must parse");
  assert.equal(externship.endDate,"2022-03");

  const subInternship=byTitle.get("Family Medicine Sub-Internship");
  assert.equal(subInternship.categoryId,"clinical","a sub-internship is a US rotation, not a house-officer post");
  assert.equal(subInternship.startDate,"2022-06");
  assert.equal(subInternship.endDate,"2022-08");

  const research=byTitle.get("Research Assistant, Cardiovascular Outcomes Laboratory");
  assert.equal(research.categoryId,"research");
  assert.equal(research.startDate,"2023-03");
  assert.equal(research.openEnded,true);
  assert.equal(institution(research),"Johns Hopkins University, Baltimore, MD");

  assert.equal(byTitle.get("USMLE Step 1").categoryId,"exams");
  assert.equal(byTitle.get("USMLE Step 1").startDate,"2021-06");
  assert.equal(byTitle.get("USMLE Step 2 CK").startDate,"2022-01","Jan. 2022 must parse");
  assert.equal(byTitle.get("Dean's List for Academic Distinction").categoryId,"education");
  assert.equal(byTitle.get("Medical Officer").categoryId,"work");
  assert.equal(institution(byTitle.get("Medical Officer")),"Apollo Rural Health Clinic, Pune, India");

  // page two entries keep the section their heading established, including headings on page one
  assert.equal(byTitle.get("Medical Officer").provenance.at(-1).pageNumber,2);
  assert.ok(candidates.every(({startDate})=>startDate),"every candidate carries a start date");
});

test("C-06 and C-12: server AI review survives while source-identical candidates collapse before review",async()=>{
  const file={name:"kulkarni_cv.pdf",type:"application/pdf",size:22222,arrayBuffer:async()=>new ArrayBuffer(8)};
  const localAdapter=createD1408PdfIntakeAdapter({pdfExtractor:async()=>syntheticExtraction()});
  const apiClient={
    async signObjectUpload(){return{objectId:"object-source",uploadToken:"upload-token"};},
    async uploadSignedObject(){},
    async confirmObjectUpload(){return{status:"CONFIRMED"};},
    async analyzeCv(){
      return{
        mode:"SERVER_AI",analysisId:"analysis-1",provider:"openai",model:"approved-model",
        schemaVersion:"schema-1",promptVersion:"prompt-1",rejectedCandidateCount:0,
        candidates:[
          {
            id:"ai-1",canonicalType:"OBSERVERSHIP",categoryId:"cl",timelineKind:"duration",
            title:"Internal Medicine Observership",organization:"Mount Sinai Beth Israel",location:"New York, NY",
            startDate:"2021-09",endDate:"2021-11",openEnded:false,
            confidence:{score:96,level:"HIGH",reasons:["Explicit"]},safeToBulkAccept:true,
            evidence:[{field:"title",sourceBlockIds:[],excerpt:"Internal Medicine Observership",support:"EXPLICIT",reason:"Explicit",uncertainty:null}],
            classificationReason:"Explicit observership",warnings:[],uncertainty:[]
          },
          {
            id:"ai-2",canonicalType:"OBSERVERSHIP",categoryId:"cl",timelineKind:"duration",
            title:"Internal Medicine Observership",organization:"Mount Sinai Beth Israel",location:"New York, NY",
            startDate:"2021-09",endDate:"2021-11",openEnded:false,
            confidence:{score:96,level:"HIGH",reasons:["Explicit"]},safeToBulkAccept:true,
            evidence:[{field:"title",sourceBlockIds:[],excerpt:"Internal Medicine Observership",support:"EXPLICIT",reason:"Explicit",uncertainty:null}],
            classificationReason:"Explicit observership",warnings:[],uncertainty:[]
          }
        ],
        qualitySuggestions:[{
          id:"cv_quality_server",type:"LABEL_READABILITY",severity:"INFO",candidateIds:[],eventIds:[],sourceBlockIds:[],
          reason:"A label is hard to read on the board.",recommendation:"Shorten it.",source:"AI_REVIEW",actionMode:"ACCEPT_EDIT_DISMISS"
        }],
        unresolvedQuestions:["Which rotation was the sub-internship?"]
      };
    },
    async deleteObject(){throw new Error("a successful analysis must retain the source");}
  };
  const adapter=createProductionCvIntakeAdapter({localAdapter,apiClient,documentId:"timeline-1",existingEvents:()=>[]});
  const result=await adapter.extract({file,documentType:"CV"});
  assert.equal(result.parser.intelligenceMode,"SERVER_AI");
  assert.equal(result.candidates.length,1,"one source fact must produce one semantic candidate");
  const ids=result.parser.qualitySuggestions.map(({id})=>id);
  assert.ok(ids.includes("cv_quality_server"),"the server quality review must survive");
  assert.equal(
    result.parser.qualitySuggestions.filter(({type})=>type==="POSSIBLE_DUPLICATE").length,
    0,
    "an exact provider repeat must not become three duplicate flags"
  );
  assert.equal(result.parser.qualitySuggestions.find(({id})=>id==="cv_quality_server").proposal,null,"server text alone never becomes an automatic edit");
  assert.deepEqual(result.parser.unresolvedQuestions,["Which rotation was the sub-internship?"]);
});
