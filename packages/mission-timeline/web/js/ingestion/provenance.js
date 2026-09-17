export function stableHash(value){
  let hash=2166136261;
  const text=String(value||"");
  for(let index=0;index<text.length;index++){hash^=text.charCodeAt(index);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(16).padStart(8,"0");
}

export function buildProvenance(record,sourceDocument,method){
  return (record.sourceBlocks||[]).map((block)=>({
    id:"prov-"+stableHash(sourceDocument.id+"|"+block.id+"|"+record.title),
    sourceDocumentId:sourceDocument.id,
    fileName:sourceDocument.fileName,
    documentType:sourceDocument.effectiveType||sourceDocument.detectedType,
    detectedDocumentType:sourceDocument.detectedType,
    userDeclaredType:sourceDocument.userDeclaredType,
    pageNumber:block.pageNumber,
    pageId:block.pageId,
    section:block.section,
    sourceBlockId:block.id,
    sourceExcerpt:block.text,
    extractionMethod:method,
    parserVersion:sourceDocument.parserVersion
  }));
}

export function candidateFingerprint(candidate){
  return stableHash([candidate.title,candidate.canonicalType,candidate.startDate,candidate.endDate,candidate.siteName,(candidate.provenance||[]).map((item)=>item.sourceExcerpt).join("|")].join("||").toLowerCase());
}
