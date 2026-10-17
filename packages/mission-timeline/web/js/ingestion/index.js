import {IngestionController} from "./ingestion-controller.js";
import {installIngestionUi} from "./ingestion-ui.js";
import {detectDocumentType} from "./document-types.js";
import {inspectFile,MAX_FILE_BYTES,MAX_PAGES} from "./file-inspector.js";
import {textItemsToLines} from "./pdf-page-model.js";
import {detectSections,classifyHeading} from "./section-detector.js";
import {normalizeDateRange,parseDatePoint,monthIndex} from "./date-normalizer.js";
import {parseErasBlocks} from "./eras-parser.js";
import {parseCvBlocks,parseResumeBlocks,parseUnknownBlocks} from "./cv-parser.js";
import {classifyEvent} from "./event-classifier.js";
import {scoreConfidence} from "./confidence-engine.js";
import {detectPrivacy} from "./privacy-detector.js";
import {buildCandidates} from "./candidate-builder.js";
import {detectDuplicates,similarity,normalizeIdentity} from "./duplicate-detector.js";
import {detectConflicts} from "./conflict-detector.js";
import {INGESTION_SCHEMA_VERSION,PARSER_VERSION} from "./ingestion-state.js";
import {assessOcrRequirement,runLocalOcr,OCR_ADAPTER_VERSION} from "./ocr-adapter.js";

export function install408Ingestion(api){
  const controller=new IngestionController(api);
  const ui=installIngestionUi(controller,api);
  const testApi={
    version:"408",
    schemaVersion:INGESTION_SCHEMA_VERSION,
    parserVersion:PARSER_VERSION,
    controller,
    ui,
    get state(){return controller.state;},
    ingestFile:(file,options)=>controller.ingestFile(file,options),
    ingestManualText:(text,options)=>controller.ingestManualText(text,options),
    acceptCandidate:(id,options)=>controller.acceptCandidate(id,options),
    rejectCandidate:(id)=>controller.rejectCandidate(id),
    deferCandidate:(id)=>controller.deferCandidate(id),
    editCandidate:(id,patch)=>controller.editCandidate(id,patch),
    mergeDuplicate:(id,primary,visibility)=>controller.mergeDuplicate(id,primary,visibility),
    keepBoth:(id,visibility)=>controller.keepBoth(id,visibility),
    chooseSource:(id,candidate,visibility)=>controller.chooseSource(id,candidate,visibility),
    acceptAllSafeHighConfidence:()=>controller.acceptAllSafeHighConfidence(),
    acceptCandidatesSafe:(ids)=>controller.acceptCandidatesSafe(ids),
    previewDocumentRemoval:(id)=>controller.previewDocumentRemoval(id),
    removeDocument:(id,options)=>controller.removeDocument(id,options),
    correctDocumentType:(id,type)=>controller.correctDocumentType(id,type),
    setCandidateVisibility:(id,visibility)=>controller.setCandidateVisibility(id,visibility),
    reviewProgress:()=>controller.reviewProgress(),
    pure:{detectDocumentType,inspectFile,textItemsToLines,detectSections,classifyHeading,normalizeDateRange,parseDatePoint,monthIndex,parseErasBlocks,parseCvBlocks,parseResumeBlocks,parseUnknownBlocks,classifyEvent,scoreConfidence,detectPrivacy,buildCandidates,detectDuplicates,detectConflicts,similarity,normalizeIdentity,assessOcrRequirement,runLocalOcr},
    ocrAdapterVersion:OCR_ADAPTER_VERSION,
    limits:{MAX_FILE_BYTES,MAX_PAGES}
  };
  window.D1_408_TEST=testApi;
  return testApi;
}
