const normalized = text => String(text||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
/** Keep source-derived omissions reviewable without presenting them as AI findings. */
export function mergeCvSourceCoverage(aiCandidates, localCandidates) {
  const reviewed=aiCandidates.map(candidate=>({...candidate,fields:{...candidate.fields,extractionBasis:'AI_REVIEW'}}));
  const missing=localCandidates.filter(local=>!reviewed.some(ai=>{
    if(local.categoryId!==ai.categoryId||local.startDate!==ai.startDate||(local.endDate||null)!==(ai.endDate||null))return false;
    const a=normalized(ai.title);const b=normalized(local.title);
    return a.length>3&&b.length>3&&(a.includes(b)||b.includes(a));
  })).map(candidate=>({...candidate,confidence:candidate.confidence==='low'?'low':'medium',
    fields:{...candidate.fields,extractionBasis:'MISSIONMED_RULE',sourceCoverageRecovery:true},
    warnings:[...(candidate.warnings||[]),'Recovered by a source check; the AI interpretation was not accepted. Review this entry individually.'],
  }));
  return {candidates:[...reviewed,...missing],sourceRecoveryCount:missing.length};
}
