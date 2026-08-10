import {buildCandidates} from "../ingestion/candidate-builder.js";
import {
  detectDocumentType,
  DOCUMENT_TYPES
} from "../ingestion/document-types.js";
import {
  MAX_FILE_BYTES,
  IngestionFileError
} from "../ingestion/file-inspector.js";
import {
  parseCvBlocks,
  parseResumeBlocks,
  parseUnknownBlocks
} from "../ingestion/cv-parser.js";
import {parseErasBlocks} from "../ingestion/eras-parser.js";
import {PARSER_VERSION} from "../ingestion/ingestion-state.js";
import {detectSections} from "../ingestion/section-detector.js";

const UXR_VISIBILITY=Object.freeze({
  INTERVIEWER_SAFE:"INTERVIEWER_SAFE",
  ADVISOR_ONLY:"ADVISOR_ONLY"
});

const CATEGORY_BY_LEGACY_ID=Object.freeze({
  education:"education",
  usmle:"exams",
  exams:"exams",
  th:"clinical",
  cl:"clinical",
  clinical:"clinical",
  work:"work",
  res:"research",
  research:"research",
  personal:"personal"
});

const CATEGORY_BY_CANONICAL_TYPE=Object.freeze({
  EDUCATION:"education",
  MEDICAL_DEGREE:"education",
  GRADUATION:"education",
  AWARD_HONOR:"education",
  CERTIFICATION:"education",
  STEP_1:"exams",
  STEP_2_CK:"exams",
  STEP_3:"exams",
  USMLE_STUDY_PERIOD:"exams",
  ECFMG_CERTIFICATION:"exams",
  OBSERVERSHIP:"clinical",
  EXTERNSHIP:"clinical",
  SUB_INTERNSHIP:"clinical",
  CLERKSHIP:"clinical",
  USCE_CLINIC:"clinical",
  USCE_TEACHING_HOSPITAL:"clinical",
  RESEARCH_EXPERIENCE:"research",
  PUBLICATION:"research",
  ABSTRACT_POSTER_PRESENTATION:"research",
  PERSONAL_NOT_ON_CV:"personal",
  VISA_IMMIGRATION_MILESTONE:"personal",
  RESIDENCY_FELLOWSHIP:"work",
  INTERNSHIP_HOUSE_OFFICER:"work",
  WORK_EXPERIENCE:"work"
});

const MAPPING_REVIEW_REQUIRED=new Set([
  "APPLICATION_CYCLE",
  "INTERVIEW",
  "MOVE_TO_USA",
  "UNCLASSIFIED"
]);

const ROTATION_TYPE_BY_CANONICAL_TYPE=Object.freeze({
  OBSERVERSHIP:"Observership",
  EXTERNSHIP:"Externship",
  SUB_INTERNSHIP:"Sub-internship",
  CLERKSHIP:"Clerkship (core)"
});

const US_STATE_CODES=new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC"
]);

function abortError(){
  return new DOMException("Document extraction was cancelled.","AbortError");
}

function throwIfAborted(signal){
  if(signal?.aborted)throw abortError();
}

function fileExtension(file){
  return String(file?.name||"").toLowerCase().match(/\.([^.]+)$/)?.[1]||"";
}

function declaredDocumentType(value){
  const normalized=String(value||"")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .replace(/[^a-z]/g,"");
  if(normalized.includes("myeras")||normalized==="eras")return DOCUMENT_TYPES.ERAS;
  if(normalized.includes("resume"))return DOCUMENT_TYPES.RESUME;
  if(normalized==="cv"||normalized.includes("curriculumvitae"))return DOCUMENT_TYPES.CV;
  return DOCUMENT_TYPES.AUTO;
}

function parseRecords(type,blocks){
  if(type===DOCUMENT_TYPES.ERAS)return parseErasBlocks(blocks);
  if(type===DOCUMENT_TYPES.RESUME)return parseResumeBlocks(blocks);
  if(type===DOCUMENT_TYPES.CV)return parseCvBlocks(blocks);
  return parseUnknownBlocks(blocks);
}

function normalizedConfidence(candidate){
  const canonical=String(candidate?.canonicalType||"").toUpperCase();
  const level=String(candidate?.confidence?.level||"NEEDS_REVIEW").toUpperCase();
  if(
    level==="HIGH"&&
    candidate?.safeToBulkAccept===true&&
    !MAPPING_REVIEW_REQUIRED.has(canonical)
  )return"high";
  if(["HIGH","MEDIUM"].includes(level)&&!MAPPING_REVIEW_REQUIRED.has(canonical))return"medium";
  return"low";
}

function normalizedVisibility(value){
  return value===UXR_VISIBILITY.INTERVIEWER_SAFE
    ?UXR_VISIBILITY.INTERVIEWER_SAFE
    :UXR_VISIBILITY.ADVISOR_ONLY;
}

function categoryIdFor(candidate){
  const canonical=String(candidate?.canonicalType||"").toUpperCase();
  const mapped=CATEGORY_BY_CANONICAL_TYPE[canonical]||
    CATEGORY_BY_LEGACY_ID[String(candidate?.categoryId||"").toLowerCase()];
  if(mapped)return mapped;
  const error=new Error(
    `D1-408 candidate ${String(candidate?.id||"(unknown)")} has no conservative UXR category mapping.`
  );
  error.code="D1_408_CATEGORY_UNMAPPABLE";
  throw error;
}

function sourceProvenance(candidate){
  return (candidate?.provenance||[]).map((item)=>Object.freeze({
    id:String(item?.id||""),
    sourceDocumentId:String(item?.sourceDocumentId||""),
    fileName:String(item?.fileName||""),
    documentType:String(item?.documentType||""),
    detectedDocumentType:String(item?.detectedDocumentType||""),
    userDeclaredType:String(item?.userDeclaredType||""),
    pageNumber:Number(item?.pageNumber)||null,
    pageId:String(item?.pageId||""),
    section:String(item?.section||""),
    sourceBlockId:String(item?.sourceBlockId||""),
    sourceExcerpt:String(item?.sourceExcerpt||""),
    extractionMethod:String(item?.extractionMethod||""),
    parserVersion:String(item?.parserVersion||"")
  }));
}

function sourceSnippet(provenance){
  const seen=new Set();
  return provenance
    .map(({sourceExcerpt})=>sourceExcerpt.trim())
    .filter((excerpt)=>excerpt&&!seen.has(excerpt)&&seen.add(excerpt))
    .join("\n");
}

function explicitUsCityState(location){
  const parts=String(location||"").split(",").map((part)=>part.trim()).filter(Boolean);
  if(parts.length<2)return{};
  const state=parts.at(-1).toUpperCase();
  if(!US_STATE_CODES.has(state))return{};
  return{city:parts.slice(0,-1).join(", "),state};
}

function exactDegree(candidate){
  const values=[
    candidate?.originalExtraction?.title,
    candidate?.title
  ].map((value)=>String(value||"").trim().toUpperCase());
  return values.find((value)=>["MD","DO","MBBS"].includes(value))||"";
}

function categoryFields(candidate,categoryId,provenance){
  const location=String(candidate?.location||candidate?.originalExtraction?.location||"").trim();
  const organization=String(candidate?.siteName||candidate?.organization||"").trim();
  const common={
    canonicalType:String(candidate?.canonicalType||""),
    sourceLocation:location,
    sourceProvenance:provenance,
    extractionConfidence:candidate?.confidence?structuredClone(candidate.confidence):null,
    datePrecision:candidate?.datePrecision?structuredClone(candidate.datePrecision):null,
    inferredFields:[...(candidate?.inferredFields||[])].map((item)=>structuredClone(item)),
    mappingRationale:String(candidate?.mappingRationale||""),
    mappingReviewRequired:MAPPING_REVIEW_REQUIRED.has(
      String(candidate?.canonicalType||"").toUpperCase()
    ),
    extractionWarnings:[...(candidate?.warnings||[])].map(String),
    privacy:candidate?.privacy?structuredClone(candidate.privacy):null,
    duplicateGroupIds:[...(candidate?.duplicateGroupIds||[])].map(String),
    conflictIds:[...(candidate?.conflictIds||[])].map(String)
  };

  if(categoryId==="education"){
    return{
      ...common,
      medicalSchool:organization,
      medicalSchoolCountry:"",
      degree:exactDegree(candidate)
    };
  }
  if(categoryId==="exams"){
    const canonical=String(candidate?.canonicalType||"").toUpperCase();
    return{
      ...common,
      examSystem:/^(?:STEP_|USMLE_)|ECFMG/.test(canonical)?"USMLE":"",
      examName:String(candidate?.title||""),
      result:"",
      score:"",
      studyPeriodStart:canonical==="USMLE_STUDY_PERIOD"?String(candidate?.startDate||""):""
    };
  }
  if(categoryId==="clinical"){
    const cityState=explicitUsCityState(location);
    return{
      ...common,
      institution:organization,
      specialty:String(candidate?.specialty||""),
      rotationType:ROTATION_TYPE_BY_CANONICAL_TYPE[
        String(candidate?.canonicalType||"").toUpperCase()
      ]||"",
      city:cityState.city||"",
      state:cityState.state||"",
      currentlyOnRotation:candidate?.dateRange?.openEnded===true
    };
  }
  if(categoryId==="work"){
    const cityState=explicitUsCityState(location);
    const explicitKind=String(candidate?.experienceType||"").trim();
    return{
      ...common,
      organization,
      country:cityState.state?"United States":"",
      city:cityState.city||"",
      kind:["Clinical","Non-clinical"].includes(explicitKind)?explicitKind:"",
      stillWorking:candidate?.dateRange?.openEnded===true,
      description:String(candidate?.originalExtraction?.description||"")
    };
  }
  if(categoryId==="research"){
    const raw=String(candidate?.originalExtraction?.rawText||"");
    return{
      ...common,
      institution:organization,
      role:"",
      ongoing:candidate?.dateRange?.openEnded===true,
      publicationStatus:/\bpublished\b/i.test(raw)?"Published":"",
      journal:String(candidate?.canonicalType||"").toUpperCase()==="PUBLICATION"
        ?organization
        :"",
      publicationYear:"",
      authorPosition:"",
      doiOrPmid:"",
      markPublication:String(candidate?.canonicalType||"").toUpperCase()==="PUBLICATION"
    };
  }
  return{
    ...common,
    when:candidate?.timelineKind==="milestone"?"One date":"A period",
    icon:"",
    visibility:normalizedVisibility(candidate?.visibilityRecommendation)===
      UXR_VISIBILITY.ADVISOR_ONLY
      ?"Advisor only"
      :"Show everyone"
  };
}

export function mapD1408CandidateToUxr(candidate){
  if(!candidate||typeof candidate!=="object"){
    const error=new TypeError("A D1-408 extraction candidate is required.");
    error.code="D1_408_CANDIDATE_REQUIRED";
    throw error;
  }
  const categoryId=categoryIdFor(candidate);
  const provenance=sourceProvenance(candidate);
  const visibilityState=normalizedVisibility(candidate.visibilityRecommendation);
  return{
    id:String(candidate.id),
    extractionId:String(candidate.id),
    categoryId,
    title:String(candidate.title||"").trim(),
    startDate:String(candidate.startDate||""),
    endDate:candidate.endDate?String(candidate.endDate):null,
    openEnded:candidate?.dateRange?.openEnded===true,
    eventType:candidate.timelineKind==="milestone"?"milestone":"duration",
    confidence:normalizedConfidence(candidate),
    confidenceDetails:candidate.confidence?structuredClone(candidate.confidence):null,
    sourceSnippet:sourceSnippet(provenance),
    provenance,
    inferredFields:[...(candidate?.inferredFields||[])].map((item)=>structuredClone(item)),
    warnings:[...(candidate?.warnings||[])].map(String),
    notes:"",
    visibilityState,
    fields:categoryFields(candidate,categoryId,provenance),
    decision:"undecided",
    expanded:false
  };
}

export function mapCvIntelligenceCandidateToUxr(candidate,{sourceDocument=null,sourceBlocks=[]}={}){
  if(!candidate||typeof candidate!=="object")throw new TypeError("A CV intelligence candidate is required.");
  const blocks=new Map((sourceBlocks||[]).map((block)=>[String(block.id),block]));
  const provenance=(candidate.evidence||[]).flatMap((evidence,evidenceIndex)=>{
    const ids=Array.isArray(evidence?.sourceBlockIds)?evidence.sourceBlockIds:[];
    return ids.map((blockId,blockIndex)=>{
      const block=blocks.get(String(blockId))||{};
      return{
        id:`${String(candidate.id)}:${evidenceIndex}:${blockIndex}`,
        sourceDocumentId:String(sourceDocument?.id||sourceDocument?.objectId||""),
        fileName:String(sourceDocument?.fileName||sourceDocument?.name||""),
        documentType:String(sourceDocument?.effectiveType||sourceDocument?.userDeclaredType||"CV"),
        detectedDocumentType:String(sourceDocument?.detectedType||""),
        userDeclaredType:String(sourceDocument?.userDeclaredType||""),
        pageNumber:Number(block.pageNumber)||null,
        pageId:String(block.pageId||""),
        section:String(block.section||""),
        sourceBlockId:String(blockId),
        sourceExcerpt:String(evidence?.excerpt||""),
        extractionMethod:"SERVER_AI_EVIDENCE_BOUND",
        parserVersion:String(sourceDocument?.parserVersion||PARSER_VERSION)
      };
    });
  });
  return mapD1408CandidateToUxr({
    ...candidate,
    provenance,
    dateRange:{openEnded:candidate.openEnded===true},
    visibilityRecommendation:UXR_VISIBILITY.ADVISOR_ONLY,
    originalExtraction:{
      title:String(candidate.title||""),
      location:String(candidate.location||""),
      description:"",
      rawText:provenance.map((item)=>item.sourceExcerpt).filter(Boolean).join("\n")
    },
    mappingRationale:String(candidate.classificationReason||"Evidence-bound server analysis"),
    privacy:{reviewRequired:true},
    warnings:[...(candidate.warnings||[]),...(candidate.uncertainty||[])],
    inferredFields:(candidate.evidence||[])
      .filter((item)=>item.support==="INFERRED")
      .map((item)=>({field:item.field,reason:item.reason,uncertainty:item.uncertainty||null}))
  });
}

async function bundledPdfExtractor(file,options){
  const {extractPdf}=await import("../ingestion/pdf-text-extractor.js");
  return extractPdf(file,options);
}

async function bundledDocxExtractor(file,options){
  const {extractDocx}=await import("../ingestion/docx-text-extractor.js");
  return extractDocx(file,options);
}

function validateAdapterFile(file,metadata){
  if(!file)throw new IngestionFileError("NO_FILE","Choose a local PDF to continue.");
  const extension=fileExtension(file);
  const mime=String(file.type||metadata?.type||"").toLowerCase();
  const docx=extension==="docx"||mime==="application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const pdf=extension==="pdf"||mime==="application/pdf";
  if(!pdf&&!docx){
    throw new IngestionFileError(
      "UNSUPPORTED_FILE",
      "Choose a PDF or DOCX document."
    );
  }
  if(extension==="pdf"&&docx||extension==="docx"&&pdf){
    throw new IngestionFileError("UNSUPPORTED_FILE","The file extension and document type do not match.");
  }
  const size=Number(file.size??metadata?.size);
  if(Number.isFinite(size)&&size>MAX_FILE_BYTES){
    throw new IngestionFileError(
      "FILE_TOO_LARGE",
      `The local document parser is limited to ${Math.round(MAX_FILE_BYTES/1024/1024)}MB.`,
      {size,max:MAX_FILE_BYTES}
    );
  }
  return docx?"docx":"pdf";
}

export function createD1408PdfIntakeAdapter({
  pdfExtractor=bundledPdfExtractor,
  docxExtractor=bundledDocxExtractor
}={}){
  if(typeof pdfExtractor!=="function")throw new TypeError("pdfExtractor must be a function.");
  if(typeof docxExtractor!=="function")throw new TypeError("docxExtractor must be a function.");
  return Object.freeze({
    capability:Object.freeze({
      mode:"local-native-document",
      productionReady:true,
      simulated:false,
      source:"bundled-d1-408-parser",
      bundledExtractor:true,
      bundledFixtures:false,
      parserVersion:PARSER_VERSION,
      networkCalls:false,
      formats:Object.freeze(["application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document"]),
      docx:true,
      ocr:false,
      maxBytes:MAX_FILE_BYTES
    }),
    async extract({file,metadata=null,documentType="CV",signal=null}={}){
      throwIfAborted(signal);
      const kind=validateAdapterFile(file,metadata);
      const extraction=await (kind==="docx"?docxExtractor:pdfExtractor)(file,{
        onStatus:()=>throwIfAborted(signal)
      });
      throwIfAborted(signal);

      if(extraction?.status==="OCR_REQUIRED"){
        return{
          readable:false,
          outcome:"scanned-no-text",
          reason:"OCR_REQUIRED",
          candidates:[],
          sourceDocument:{
            id:extraction.sourceDocumentId,
            name:extraction.inspected?.name||metadata?.name||file.name,
            parserVersion:PARSER_VERSION,
            extractionMethod:extraction.extractionMethod,
            ocr:extraction.ocr?structuredClone(extraction.ocr):null,
            warnings:[...(extraction.warnings||[])]
          }
        };
      }

      const declaredType=declaredDocumentType(documentType);
      const detection=detectDocumentType(extraction?.text||"",declaredType);
      const effectiveType=[DOCUMENT_TYPES.ERAS,DOCUMENT_TYPES.CV,DOCUMENT_TYPES.RESUME]
        .includes(declaredType)
        ?declaredType
        :detection.detectedType;
      const sourceDocument={
        id:String(extraction.sourceDocumentId),
        fileName:String(extraction.inspected?.name||metadata?.name||file.name),
        fileSize:Number(extraction.inspected?.size??metadata?.size??file.size)||0,
        mimeType:String(extraction.inspected?.mimeType||metadata?.type||file.type||"application/pdf"),
        sha256:String(extraction.inspected?.sha256||""),
        userDeclaredType:declaredType,
        detectedType:detection.detectedType,
        effectiveType,
        typeConfirmedByUser:declaredType!==DOCUMENT_TYPES.AUTO,
        detectionConfidence:detection.confidence,
        extractionMethod:String(extraction.extractionMethod||"PDFJS_TEXT_LAYER"),
        parserVersion:PARSER_VERSION,
        pageCount:Number(extraction.pageCount)||0,
        charCount:Number(extraction.charCount)||0,
        warnings:[
          ...(extraction.warnings||[]),
          ...(detection.mismatch?["Declared and detected document types differ."]:[])
        ]
      };
      const sectionResult=detectSections(extraction.pages||[]);
      const records=parseRecords(effectiveType,sectionResult.blocks);
      const legacyCandidates=buildCandidates(records,sourceDocument);
      const candidates=legacyCandidates.map(mapD1408CandidateToUxr);
      return{
        readable:true,
        outcome:candidates.length?"ready-for-review":"empty",
        candidates,
        sourceDocument,
        sourceBlocks:sectionResult.blocks.map((block)=>({
          id:String(block.id),
          pageId:String(block.pageId||""),
          pageNumber:Number(block.pageNumber)||null,
          section:String(block.section||"unknown"),
          text:String(block.text||"")
        })),
        parser:{
          version:PARSER_VERSION,
          detectedType:detection.detectedType,
          effectiveType,
          sections:[...sectionResult.sections],
          recordCount:records.length,
          candidateCount:candidates.length,
          networkCalls:false
        }
      };
    }
  });
}

export function createProductionCvIntakeAdapter({
  localAdapter=createD1408PdfIntakeAdapter(),
  apiClient,
  documentId,
  existingEvents=()=>[],
  consentVersion="d1-ux-007-ai-v1",
  ensureRemoteDocument=async()=>{}
}={}){
  if(typeof localAdapter?.extract!=="function")throw new TypeError("A local intake adapter is required.");
  if(!apiClient||typeof apiClient.analyzeCv!=="function")return localAdapter;
  const confirmedSources=new Map();
  let activeSourceObjectId="";
  const deleteObject=async(objectId)=>{
    if(objectId&&typeof apiClient.deleteObject==="function")await apiClient.deleteObject(objectId).catch(()=>{});
  };
  return Object.freeze({
    capability:Object.freeze({
      ...localAdapter.capability,
      mode:"server-ai-with-local-limited-fallback",
      source:"timeline-owned-server-ai",
      networkCalls:true
    }),
    async extract(input={}){
      const local=await localAdapter.extract(input);
      if(local?.readable!==true||!local?.sourceDocument?.sha256||!local?.sourceBlocks?.length)return local;
      const file=input.file;
      const source=local.sourceDocument;
      const sha256=String(source.sha256).toLowerCase();
      let objectId=confirmedSources.get(sha256)||"";
      let created=false;
      try{
        await ensureRemoteDocument();
        if(!objectId){
          const grant=await apiClient.signObjectUpload(String(documentId),{
            mimeType:String(source.mimeType),
            byteSize:Number(source.fileSize),
            sha256,
            objectClass:"SOURCE"
          });
          objectId=String(grant?.objectId||"");
          if(!objectId)throw new Error("Timeline source authorization did not return an object ID.");
          created=true;
          await apiClient.uploadSignedObject(grant,file);
          const confirmed=await apiClient.confirmObjectUpload(objectId,grant.uploadToken);
          if(String(confirmed?.status||"")!=="CONFIRMED")throw new Error("Timeline source upload could not be confirmed.");
          confirmedSources.set(sha256,objectId);
        }
        const eventSummary=(typeof existingEvents==="function"?existingEvents():existingEvents||[]).map((event)=>({
          id:String(event.id),
          title:String(event.title||""),
          categoryId:String(event.categoryId||""),
          startDate:String(event.startDate||""),
          endDate:event.endDate?String(event.endDate):null,
          organization:String(event.siteName||event.fields?.institution||event.fields?.organization||"")||null
        }));
        const analysis=await apiClient.analyzeCv(String(documentId),{
          source:{objectId,sha256,mimeType:String(source.mimeType)},
          blocks:local.sourceBlocks.map((block)=>({
            id:String(block.id),pageNumber:block.pageNumber||null,
            section:block.section||null,text:String(block.text||"")
          })),
          documentType:String(source.effectiveType||"CV")==="MYERAS"?"MYERAS":String(source.effectiveType||"CV")==="RESUME"?"RESUME":"CV",
          existingEvents:eventSummary,
          consentVersion:String(consentVersion),
          idempotencyKey:`cv_${sha256.slice(0,32)}`
        });
        if(analysis?.mode!=="SERVER_AI"||!Array.isArray(analysis.candidates)||!analysis.candidates.length){
          if(created){await deleteObject(objectId);confirmedSources.delete(sha256);}
          return{
            ...local,
            parser:{...local.parser,intelligenceMode:"LOCAL_LIMITED",fallbackReason:analysis?.fallbackReason||"AI_EMPTY"}
          };
        }
        activeSourceObjectId=objectId;
        return{
          ...local,
          candidates:analysis.candidates.map((candidate)=>mapCvIntelligenceCandidateToUxr(candidate,{
            sourceDocument:{...source,objectId},sourceBlocks:local.sourceBlocks
          })),
          sourceDocument:{...source,objectId,custody:"TIMELINE_PRIVATE_SOURCE",analysisId:analysis.analysisId},
          parser:{
            ...local.parser,
            intelligenceMode:"SERVER_AI",
            analysisId:analysis.analysisId,
            provider:analysis.provider,
            model:analysis.model,
            schemaVersion:analysis.schemaVersion,
            promptVersion:analysis.promptVersion,
            rejectedCandidateCount:Number(analysis.rejectedCandidateCount)||0,
            qualitySuggestions:Array.isArray(analysis.qualitySuggestions)?analysis.qualitySuggestions:[],
            unresolvedQuestions:Array.isArray(analysis.unresolvedQuestions)?analysis.unresolvedQuestions:[]
          }
        };
      }catch(error){
        if(created){await deleteObject(objectId);confirmedSources.delete(sha256);}
        return{
          ...local,
          parser:{...local.parser,intelligenceMode:"LOCAL_LIMITED",fallbackReason:String(error?.code||"PROVIDER_UNAVAILABLE")}
        };
      }
    },
    async deleteSource(){
      const objectId=activeSourceObjectId;
      activeSourceObjectId="";
      for(const [hash,id] of confirmedSources.entries())if(id===objectId)confirmedSources.delete(hash);
      await deleteObject(objectId);
    }
  });
}

export const D1_408_PDF_INTAKE_ADAPTER_CAPABILITY=Object.freeze(
  createD1408PdfIntakeAdapter().capability
);
