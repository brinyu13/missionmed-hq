export const INGESTION_SCHEMA_VERSION="d1-ingestion-408.1";
export const PARSER_VERSION="408.1.0";

export function clone(value){return JSON.parse(JSON.stringify(value));}

export function createEmptyIngestionState(){
  return {
    schemaVersion:INGESTION_SCHEMA_VERSION,
    parserVersion:PARSER_VERSION,
    status:"NO_DOCUMENT",
    statusDetail:"Choose a synthetic or de-identified local PDF to begin.",
    sourceDocuments:[],
    documentPages:[],
    sourceBlocks:[],
    extractionCandidates:[],
    candidateDuplicateGroups:[],
    candidateConflicts:[],
    humanReviewActions:[],
    timelineEventSourceLinks:[],
    processingHistory:[],
    lastError:null,
    activeDocumentId:null,
    filters:{status:"ALL",confidence:"ALL",type:"ALL"},
    updatedAt:new Date().toISOString()
  };
}

export function ensureIngestionState(legacyState){
  if(!legacyState.__408Ingestion)legacyState.__408Ingestion=createEmptyIngestionState();
  return legacyState.__408Ingestion;
}

export function candidateBaseKind(candidate){
  if(candidateRequiresPrivateReview(candidate))return "PRIVACY";
  if(candidate.canonicalType==="UNCLASSIFIED")return "UNCLASSIFIED";
  return "NORMAL";
}

function candidateRequiresPrivateReview(candidate){
  return !!candidate.privacy?.sensitive||!!candidate.privacy?.requiresExplicitDisclosure||candidate.canonicalType==="PERSONAL_NOT_ON_CV"||candidate.categoryId==="personal";
}

export function resetCandidateRelations(candidate){
  candidate.duplicateGroupIds=[];
  candidate.conflictIds=[];
  candidate.candidateKind=candidateBaseKind(candidate);
  candidate.safeToBulkAccept=candidate.confidence?.level==="HIGH"&&!!candidate.startDate&&!candidateRequiresPrivateReview(candidate)&&candidate.canonicalType!=="UNCLASSIFIED"&&(candidate.provenance||[]).length>0&&candidate.dateRange?.validOrder!==false&&candidate.reviewStatus==="PENDING";
  return candidate;
}
