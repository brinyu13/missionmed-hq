/** Additional reviewed fields from visible Rescue source evidence. No events or
 * student-profile values are created until the existing acceptance transaction. */
export function rescueVisibleReviewFields(candidate={}){
  const fields={};
  const claims=candidate.profileClaims||{};
  if(claims.fullName?.value&&claims.fullName.provenance?.length){
    fields.profileFullName=String(claims.fullName.value);
    fields.profileNameProvenance=structuredClone(claims.fullName.provenance);
  }
  if(claims.degree?.value&&claims.degree.provenance?.length){
    fields.degree=String(claims.degree.value);
    fields.profileDegreeProvenance=structuredClone(claims.degree.provenance);
  }
  if(fields.profileFullName||fields.degree)fields.rescueProfileClaims=true;
  // Only a complete visible exam title supplies structured result/score data.
  // Numeric scores never imply a pass result, and no attempt number is invented.
  const exam=String(candidate.title||'').match(/^USMLE\s+Step\s+(1|2\s*CK|3)\s*[-–—:]\s*(Passed|Pass|Failed|Fail|\d{3})$/i);
  if(candidate.categoryId==='usmle'&&exam&&candidate.provenance?.length){
    const step=exam[1].replace(/\s/g,'').toUpperCase(),result=exam[2];
    fields.canonicalType=step==='1'?'STEP_1':step==='2CK'?'STEP_2_CK':'STEP_3';
    fields.examName=`USMLE Step ${step==='2CK'?'2 CK':step}`;
    fields.result=/^pass/i.test(result)?'Passed':/^fail/i.test(result)?'Failed':'';
    fields.score=/^\d{3}$/.test(result)?result:'';
  }
  return fields;
}
