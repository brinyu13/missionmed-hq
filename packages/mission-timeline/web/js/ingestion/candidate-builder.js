import {normalizeDateRange} from "./date-normalizer.js";
import {classifyEvent} from "./event-classifier.js";
import {detectPrivacy} from "./privacy-detector.js";
import {scoreConfidence} from "./confidence-engine.js";
import {buildProvenance,candidateFingerprint,stableHash} from "./provenance.js";

function inferredFields(dateRange){
  const output=[];
  if(dateRange?.start?.inferred)output.push({field:"startDate",reason:(dateRange.start.warnings||[]).join("; "),sourcePrecision:dateRange.start.precision});
  if(dateRange?.end?.inferred)output.push({field:"endDate",reason:(dateRange.end.warnings||[]).join("; "),sourcePrecision:dateRange.end.precision});
  return output;
}

export function buildCandidates(records,sourceDocument){
  return (records||[]).map((record,index)=>{
    const dates=normalizeDateRange(record.dates||record.startDate||"");
    const classification=classifyEvent(record,dates);
    const privacy=detectPrivacy(record,{classification});
    const requiresPrivateReview=privacy.sensitive||privacy.requiresExplicitDisclosure||classification.canonicalType==="PERSONAL_NOT_ON_CV"||classification.categoryId==="personal";
    const confidence=scoreConfidence({record,dateRange:dates,classification,privacy});
    const provenance=buildProvenance(record,sourceDocument,sourceDocument.extractionMethod);
    const title=String(record.title||"Unclassified candidate").trim();
    const candidate={
      id:sourceDocument.id+":candidate:"+stableHash(title+"|"+record.pageNumber+"|"+index+"|"+record.rawText),
      sourceDocumentId:sourceDocument.id,
      sourceDocumentIds:[sourceDocument.id],
      title,
      organization:record.organization||"",
      siteName:classification.siteName||record.organization||"",
      location:record.location||"",
      specialty:classification.specialty||"",
      experienceType:classification.experienceType||"",
      section:record.section||"unknown",
      canonicalType:classification.canonicalType,
      categoryId:classification.categoryId,
      timelineKind:classification.timelineKind,
      startDate:dates.start?.timelineMonth||"",
      endDate:dates.openEnded?null:(dates.end?.timelineMonth||null),
      dateRange:dates,
      datePrecision:dates.precision,
      inferredFields:inferredFields(dates),
      confidence,
      warnings:[...dates.warnings,...classification.warnings],
      privacy,
      visibilityRecommendation:privacy.recommendation,
      mappingRationale:classification.rationale,
      provenance,
      reviewStatus:"PENDING",
      finalHumanAction:null,
      humanCorrection:null,
      resultingEventIds:[],
      duplicateGroupIds:[],
      conflictIds:[],
      candidateKind:requiresPrivateReview?"PRIVACY":classification.canonicalType==="UNCLASSIFIED"?"UNCLASSIFIED":"NORMAL",
      safeToBulkAccept:false,
      originalExtraction:{
        title,
        organization:record.organization||"",
        location:record.location||"",
        description:record.description||"",
        dates:record.dates||"",
        rawText:record.rawText||"",
        sourceBlockIds:(record.sourceBlocks||[]).map((block)=>block.id)
      }
    };
    candidate.fingerprint=candidateFingerprint(candidate);
    candidate.safeToBulkAccept=confidence.level==="HIGH"&&!!candidate.startDate&&!requiresPrivateReview&&classification.canonicalType!=="UNCLASSIFIED"&&provenance.length>0&&dates.validOrder;
    return candidate;
  });
}
