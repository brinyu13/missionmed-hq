import assert from "node:assert/strict";
import test from "node:test";
import {deflateRawSync} from "node:zlib";

import {
  createD1408PdfIntakeAdapter,
  createProductionCvIntakeAdapter,
  D1_408_PDF_INTAKE_ADAPTER_CAPABILITY,
  mapD1408CandidateToUxr,
  mapCvIntelligenceCandidateToUxr
} from "../web/js/uxr-002/intake-d1-408-adapter.js";
import {MAX_FILE_BYTES} from "../web/js/ingestion/file-inspector.js";
import {
  INTAKE_STAGES,
  IntakeStateMachine,
  renderIntake
} from "../web/js/uxr-002/intake.js";
import {extractDocx} from "../web/js/ingestion/docx-text-extractor.js";

function nativeTextExtraction(){
  const sourceDocumentId="src-synthetic-adapter";
  const lines=[
    "CURRICULUM VITAE",
    "CLINICAL EXPERIENCE",
    "June 2021 - August 2021 | Internal Medicine Observership | Starlight Hospital | Boston, MA"
  ];
  return{
    status:"EXTRACTED",
    sourceDocumentId,
    inspected:{
      name:"synthetic_cv.pdf",
      size:1024,
      mimeType:"application/pdf",
      sha256:"a".repeat(64)
    },
    pageCount:1,
    charCount:lines.join("\n").length,
    text:lines.join("\n"),
    extractionMethod:"PDFJS_TEXT_LAYER",
    warnings:[],
    pages:[{
      id:`${sourceDocumentId}:page:1`,
      sourceDocumentId,
      pageNumber:1,
      lines,
      text:lines.join("\n"),
      charCount:lines.join("\n").length,
      textLayerPresent:true,
      extractionMethod:"PDFJS_TEXT_LAYER"
    }]
  };
}

function pdfFile(overrides={}){
  return{
    name:"synthetic_cv.pdf",
    type:"application/pdf",
    size:1024,
    arrayBuffer:async()=>new TextEncoder().encode("%PDF-1.7 synthetic").buffer,
    ...overrides
  };
}

function storedDocx(lines,{compressed=false}={}){
  const encoder=new TextEncoder();
  const name=encoder.encode("word/document.xml");
  const xml=encoder.encode(`<w:document xmlns:w="urn:test"><w:body>${lines.map((line)=>`<w:p><w:r><w:t>${line}</w:t></w:r></w:p>`).join("")}</w:body></w:document>`);
  const content=compressed?new Uint8Array(deflateRawSync(xml)):xml;
  const bytes=new Uint8Array(30+name.length+content.length+46+name.length+22);
  const view=new DataView(bytes.buffer);
  const table=Uint32Array.from({length:256},(_value,index)=>{let crc=index;for(let bit=0;bit<8;bit++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1;return crc>>>0;});
  let checksum=0xffffffff;for(const byte of xml)checksum=table[(checksum^byte)&0xff]^(checksum>>>8);checksum=(checksum^0xffffffff)>>>0;
  let offset=0;
  view.setUint32(offset,0x04034b50,true);view.setUint16(offset+4,20,true);view.setUint16(offset+8,compressed?8:0,true);view.setUint32(offset+14,checksum,true);view.setUint32(offset+18,content.length,true);view.setUint32(offset+22,xml.length,true);view.setUint16(offset+26,name.length,true);
  bytes.set(name,offset+30);bytes.set(content,offset+30+name.length);const centralOffset=offset+30+name.length+content.length;offset=centralOffset;
  view.setUint32(offset,0x02014b50,true);view.setUint16(offset+4,20,true);view.setUint16(offset+6,20,true);view.setUint16(offset+10,compressed?8:0,true);view.setUint32(offset+16,checksum,true);view.setUint32(offset+20,content.length,true);view.setUint32(offset+24,xml.length,true);view.setUint16(offset+28,name.length,true);view.setUint32(offset+42,0,true);bytes.set(name,offset+46);
  const centralSize=46+name.length;offset+=centralSize;
  view.setUint32(offset,0x06054b50,true);view.setUint16(offset+8,1,true);view.setUint16(offset+10,1,true);view.setUint32(offset+12,centralSize,true);view.setUint32(offset+16,centralOffset,true);
  return{
    name:"synthetic_cv.docx",type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",size:bytes.length,
    arrayBuffer:async()=>bytes.buffer.slice(0)
  };
}

test("D1-408 adapter capability truthfully exposes the production local PDF and DOCX parser",()=>{
  assert.deepEqual(D1_408_PDF_INTAKE_ADAPTER_CAPABILITY,{
    mode:"local-native-document",
    productionReady:true,
    simulated:false,
    source:"bundled-d1-408-parser",
    bundledExtractor:true,
    bundledFixtures:false,
    parserVersion:"408.1.0",
    networkCalls:false,
    formats:["application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    docx:true,
    ocr:false,
    maxBytes:MAX_FILE_BYTES
  });
});

test("adapter runs D1-408 sectioning, parsing, classification, confidence, and provenance mapping",async()=>{
  let extractionCalls=0;
  const adapter=createD1408PdfIntakeAdapter({
    pdfExtractor:async()=>{
      extractionCalls+=1;
      return nativeTextExtraction();
    }
  });
  const result=await adapter.extract({
    file:pdfFile(),
    metadata:{name:"synthetic_cv.pdf",type:"application/pdf",size:1024},
    documentType:"CV"
  });

  assert.equal(extractionCalls,1);
  assert.equal(result.readable,true);
  assert.equal(result.outcome,"ready-for-review");
  assert.equal(result.parser.version,"408.1.0");
  assert.equal(result.parser.networkCalls,false);
  assert.equal(result.candidates.length,1);

  const [candidate]=result.candidates;
  assert.equal(candidate.categoryId,"clinical");
  assert.equal(candidate.title,"Internal Medicine Observership");
  assert.equal(candidate.startDate,"2021-06");
  assert.equal(candidate.endDate,"2021-08");
  assert.equal(candidate.eventType,"duration");
  assert.equal(candidate.visibilityState,"INTERVIEWER_SAFE");
  assert.equal(candidate.fields.institution,"Starlight Hospital");
  assert.equal(candidate.fields.rotationType,"Observership");
  assert.equal(candidate.fields.city,"Boston");
  assert.equal(candidate.fields.state,"MA");
  assert.ok(["high","medium","low"].includes(candidate.confidence));
  assert.equal(candidate.confidenceDetails.level,"HIGH");
  assert.match(candidate.sourceSnippet,/Internal Medicine Observership/);
  assert.equal(candidate.provenance.length,1);
  assert.equal(candidate.provenance[0].pageNumber,1);
  assert.equal(candidate.provenance[0].parserVersion,"408.1.0");
  assert.deepEqual(candidate.fields.sourceProvenance,candidate.provenance);
});

test("adapter plugs directly into IntakeStateMachine and preserves rich evidence in candidate fields",async()=>{
  const adapter=createD1408PdfIntakeAdapter({
    pdfExtractor:async()=>nativeTextExtraction()
  });
  const machine=new IntakeStateMachine({adapter});
  machine.receiveFile(pdfFile());
  machine.setConsent(true);
  const state=await machine.startExtraction();

  assert.equal(state.stage,INTAKE_STAGES.REVIEW);
  assert.equal(state.candidates.length,1);
  assert.equal(state.candidates[0].categoryId,"clinical");
  assert.match(state.candidates[0].sourceSnippet,/Internal Medicine Observership/);
  assert.equal(state.candidates[0].fields.extractionConfidence.level,"HIGH");
  assert.equal(state.candidates[0].fields.sourceProvenance[0].pageNumber,1);
  assert.equal(state.candidates[0].decision,"undecided");
});

test("mapping never upgrades D1-408 confidence or privacy visibility",()=>{
  const mapped=mapD1408CandidateToUxr({
    id:"legacy-sensitive",
    categoryId:"personal",
    canonicalType:"PERSONAL_NOT_ON_CV",
    timelineKind:"milestone",
    title:"Family transition",
    startDate:"2021-03",
    endDate:null,
    dateRange:{openEnded:false},
    confidence:{score:28,level:"NEEDS_REVIEW",factors:[]},
    safeToBulkAccept:false,
    visibilityRecommendation:"ADVISOR_ONLY",
    provenance:[{
      id:"prov-1",
      sourceDocumentId:"src-1",
      fileName:"synthetic.pdf",
      documentType:"cv",
      detectedDocumentType:"cv",
      userDeclaredType:"cv",
      pageNumber:2,
      pageId:"src-1:page:2",
      section:"personal",
      sourceBlockId:"block-1",
      sourceExcerpt:"March 2021 | Family transition",
      extractionMethod:"PDFJS_TEXT_LAYER",
      parserVersion:"408.1.0"
    }],
    privacy:{sensitive:true,recommendation:"ADVISOR_ONLY"},
    warnings:[]
  });

  assert.equal(mapped.categoryId,"personal");
  assert.equal(mapped.confidence,"low");
  assert.equal(mapped.visibilityState,"ADVISOR_ONLY");
  assert.equal(mapped.fields.visibility,"Advisor only");
  assert.equal(mapped.fields.when,"One date");
  assert.equal(mapped.fields.sourceProvenance[0].sourceExcerpt,"March 2021 | Family transition");
});

test("HIGH maps to bulk-acceptable high only when the complete D1-408 safety gate passed",()=>{
  const base={
    id:"legacy-step",
    categoryId:"usmle",
    canonicalType:"STEP_2_CK",
    timelineKind:"milestone",
    title:"USMLE Step 2 CK",
    startDate:"2021-03",
    endDate:null,
    dateRange:{openEnded:false},
    confidence:{score:94,level:"HIGH",factors:[]},
    visibilityRecommendation:"INTERVIEWER_SAFE",
    provenance:[{
      id:"prov-2",
      sourceDocumentId:"src-1",
      fileName:"synthetic.pdf",
      documentType:"cv",
      detectedDocumentType:"cv",
      userDeclaredType:"cv",
      pageNumber:1,
      pageId:"src-1:page:1",
      section:"examinations",
      sourceBlockId:"block-2",
      sourceExcerpt:"March 2021 | USMLE Step 2 CK",
      extractionMethod:"PDFJS_TEXT_LAYER",
      parserVersion:"408.1.0"
    }],
    warnings:[]
  };
  assert.equal(
    mapD1408CandidateToUxr({...base,safeToBulkAccept:false}).confidence,
    "medium"
  );
  assert.equal(
    mapD1408CandidateToUxr({...base,safeToBulkAccept:true}).confidence,
    "high"
  );
  const ambiguous=mapD1408CandidateToUxr({
    ...base,
    id:"legacy-interview",
    canonicalType:"INTERVIEW",
    title:"Residency interview",
    safeToBulkAccept:true
  });
  assert.equal(ambiguous.confidence,"low");
  assert.equal(ambiguous.fields.mappingReviewRequired,true);
});

test("native DOCX text is parsed locally and the visible 20MB policy is enforced consistently",async()=>{
  let extractionCalls=0;
  const adapter=createD1408PdfIntakeAdapter({
    pdfExtractor:async()=>{
      extractionCalls+=1;
      return nativeTextExtraction();
    }
  });

  const docx=storedDocx([
    "CURRICULUM VITAE","CLINICAL EXPERIENCE","Internal Medicine USCE Observership",
    "Starlight Hospital","June 2021 - August 2021"
  ]);
  const extracted=await extractDocx(docx);
  assert.equal(extracted.extractionMethod,"DOCX_OOXML_TEXT");
  assert.equal(extracted.pageCount,null);
  assert.match(extracted.text,/Internal Medicine USCE Observership/);
  const compressed=await extractDocx(storedDocx(["CURRICULUM VITAE","EDUCATION","May 2017 | Medical Degree | Meridian Medical School"],{compressed:true}));
  assert.match(compressed.text,/Meridian Medical School/);
  const docxResult=await adapter.extract({file:docx,documentType:"CV"});
  assert.equal(docxResult.readable,true);
  assert.equal(docxResult.candidates.length,1);
  assert.equal(docxResult.candidates[0].title,"Internal Medicine USCE Observership");
  assert.equal(docxResult.candidates[0].startDate,"2021-06");
  assert.equal(docxResult.candidates[0].provenance[0].pageNumber,null);
  assert.equal(docxResult.candidates[0].provenance[0].section,"experiences");
  await assert.rejects(
    adapter.extract({
      file:pdfFile({size:MAX_FILE_BYTES+1}),
      documentType:"CV"
    }),
    (error)=>error.code==="FILE_TOO_LARGE"&&error.details.max===MAX_FILE_BYTES
  );
  assert.equal(extractionCalls,0);
});

test("review cards expose source custody, date inference, confidence rationale, and Review later",async()=>{
  const adapter=createD1408PdfIntakeAdapter({pdfExtractor:async()=>nativeTextExtraction()});
  const machine=new IntakeStateMachine({adapter});
  machine.receiveFile(pdfFile());machine.setConsent(true);await machine.startExtraction();
  const candidate=machine.state.candidates[0];
  candidate.inferredFields=[{field:"endDate",reason:"Month inferred"}];
  let html=renderIntake(machine.state);
  assert.match(html,/synthetic_cv\.pdf/);
  assert.match(html,/Page 1/);
  assert.match(html,/Extracted dates: 2021-06 – 2021-08/);
  assert.match(html,/Inferred values: endDate/);
  assert.match(html,/Why high confidence\?/);
  assert.match(html,/Review later/);
  machine.decideCandidate(candidate.id,"deferred");
  assert.equal(machine.state.candidates[0].decision,"undecided");
  assert.equal(machine.state.candidates[0].reviewLater,true);
  assert.equal(machine.acceptAllHighConfidence().candidates[0].reviewLater,true,"bulk acceptance must skip deferred review");
  html=renderIntake(machine.state);
  assert.match(html,/Review now/);
});

test("OCR-required extraction returns the Intake unreadable outcome without candidates",async()=>{
  const adapter=createD1408PdfIntakeAdapter({
    pdfExtractor:async()=>({
      ...nativeTextExtraction(),
      status:"OCR_REQUIRED",
      extractionMethod:"PDFJS_EMPTY_TEXT_LAYER",
      ocr:{required:true,cloud:false},
      warnings:["No usable native text layer was found. Local OCR is required."],
      pages:[],
      text:"",
      charCount:0
    })
  });
  const result=await adapter.extract({file:pdfFile(),documentType:"CV"});
  assert.equal(result.readable,false);
  assert.equal(result.outcome,"scanned-no-text");
  assert.equal(result.reason,"OCR_REQUIRED");
  assert.deepEqual(result.candidates,[]);
});

test("an aborted Intake request never starts or returns extraction",async()=>{
  let extractionCalls=0;
  const adapter=createD1408PdfIntakeAdapter({
    pdfExtractor:async()=>{
      extractionCalls+=1;
      return nativeTextExtraction();
    }
  });
  const controller=new AbortController();
  controller.abort();
  await assert.rejects(
    adapter.extract({file:pdfFile(),documentType:"CV",signal:controller.signal}),
    (error)=>error.name==="AbortError"
  );
  assert.equal(extractionCalls,0);
});

test("production CV adapter uploads a private SOURCE and maps evidence-bound AI candidates into human review",async()=>{
  const file=pdfFile();
  const localAdapter={
    capability:createD1408PdfIntakeAdapter().capability,
    async extract(){
      return{
        readable:true,outcome:"ready-for-review",
        candidates:[],
        sourceDocument:{
          id:"source-local",fileName:file.name,fileSize:file.size,mimeType:file.type,
          sha256:"a".repeat(64),effectiveType:"CV",userDeclaredType:"CV",parserVersion:"408.1.0"
        },
        sourceBlocks:[{id:"award-block",pageId:"page-1",pageNumber:1,section:"honors",text:"2019 Dean's Award for Clinical Excellence"}],
        parser:{version:"408.1.0"}
      };
    }
  };
  const calls=[];
  const apiClient={
    async signObjectUpload(documentId,input){calls.push(["sign",documentId,input]);return{objectId:"object-source",uploadToken:"upload-token"};},
    async uploadSignedObject(grant,blob){calls.push(["upload",grant.objectId,blob.name]);},
    async confirmObjectUpload(objectId){calls.push(["confirm",objectId]);return{status:"CONFIRMED"};},
    async analyzeCv(documentId,input){
      calls.push(["analyze",documentId,input]);
      return{
        mode:"SERVER_AI",analysisId:"analysis-1",provider:"openai",model:"approved-model",
        schemaVersion:"schema-1",promptVersion:"prompt-1",rejectedCandidateCount:0,
        candidates:[{
          id:"award-1",canonicalType:"AWARD_HONOR",categoryId:"education",timelineKind:"milestone",
          title:"Dean's Award for Clinical Excellence",organization:null,location:null,startDate:"2019-01",endDate:null,
          openEnded:false,confidence:{score:98,level:"HIGH",reasons:["Explicit evidence"]},safeToBulkAccept:true,
          evidence:[{field:"title",sourceBlockIds:["award-block"],excerpt:"2019 Dean's Award for Clinical Excellence",support:"EXPLICIT",reason:"Explicit",uncertainty:null}],
          classificationReason:"Explicit award",warnings:[],uncertainty:[]
        }],qualitySuggestions:[],unresolvedQuestions:[]
      };
    },
    async deleteObject(){throw new Error("successful AI source must be retained");}
  };
  const adapter=createProductionCvIntakeAdapter({
    localAdapter,apiClient,documentId:"timeline-1",existingEvents:()=>[],consentVersion:"d1-ux-007-ai-v1"
  });
  const result=await adapter.extract({file,documentType:"CV"});
  assert.equal(result.parser.intelligenceMode,"SERVER_AI");
  assert.equal(result.sourceDocument.objectId,"object-source");
  assert.equal(result.candidates[0].categoryId,"education");
  assert.equal(result.candidates[0].confidence,"high");
  assert.equal(result.candidates[0].provenance[0].sourceBlockId,"award-block");
  assert.equal(calls.filter(([kind])=>kind==="upload").length,1);
  assert.equal(calls.find(([kind])=>kind==="analyze")[2].consentVersion,"d1-ux-007-ai-v1");
});

test("CV intelligence mapping is conservative when evidence is inferred",()=>{
  const mapped=mapCvIntelligenceCandidateToUxr({
    id:"candidate-1",canonicalType:"RESEARCH_EXPERIENCE",categoryId:"res",timelineKind:"duration",
    title:"Research fellow",organization:"Mission Lab",location:null,startDate:"2020-01",endDate:"2021-01",
    openEnded:false,confidence:{score:70,level:"MEDIUM",reasons:["Inference"]},safeToBulkAccept:false,
    evidence:[{field:"title",sourceBlockIds:["block-1"],excerpt:"Research fellow",support:"INFERRED",reason:"Section context",uncertainty:"Role could vary"}],
    classificationReason:"Research section",warnings:[],uncertainty:["Role could vary"]
  },{
    sourceDocument:{id:"source-1",fileName:"cv.pdf",effectiveType:"CV",parserVersion:"408.1.0"},
    sourceBlocks:[{id:"block-1",pageNumber:2,section:"research",text:"Research fellow"}]
  });
  assert.equal(mapped.categoryId,"research");
  assert.equal(mapped.confidence,"medium");
  assert.equal(mapped.visibilityState,"ADVISOR_ONLY");
  assert.equal(mapped.inferredFields[0].field,"title");
});
