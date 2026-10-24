import assert from "node:assert/strict";
import test from "node:test";

import {
  createD1408PdfIntakeAdapter,
  D1_408_PDF_INTAKE_ADAPTER_CAPABILITY,
  mapD1408CandidateToUxr
} from "../web/js/uxr-002/intake-d1-408-adapter.js";
import {MAX_FILE_BYTES} from "../web/js/ingestion/file-inspector.js";
import {
  INTAKE_STAGES,
  IntakeStateMachine
} from "../web/js/uxr-002/intake.js";

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

test("D1-408 adapter capability is truthful and local-only",()=>{
  assert.deepEqual(D1_408_PDF_INTAKE_ADAPTER_CAPABILITY,{
    mode:"local-native-text-pdf",
    productionReady:false,
    simulated:false,
    source:"bundled-d1-408-parser",
    bundledExtractor:true,
    bundledFixtures:false,
    parserVersion:"408.1.0",
    networkCalls:false,
    formats:["application/pdf"],
    docx:false,
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

test("DOCX and files above the inherited 12MB parser limit are rejected before extraction",async()=>{
  let extractionCalls=0;
  const adapter=createD1408PdfIntakeAdapter({
    pdfExtractor:async()=>{
      extractionCalls+=1;
      return nativeTextExtraction();
    }
  });

  await assert.rejects(
    adapter.extract({
      file:pdfFile({
        name:"synthetic.docx",
        type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      }),
      documentType:"CV"
    }),
    (error)=>error.code==="UNSUPPORTED_DOCX"&&/not available/.test(error.message)
  );
  await assert.rejects(
    adapter.extract({
      file:pdfFile({size:MAX_FILE_BYTES+1}),
      documentType:"CV"
    }),
    (error)=>error.code==="FILE_TOO_LARGE"&&error.details.max===MAX_FILE_BYTES
  );
  assert.equal(extractionCalls,0);
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
