import {presentationCurrentMonth} from '../presentation/founder-presentation-serializer.js';

// Save bookkeeping cannot invalidate itself. Include the semantic portions of
// metadata/intake that canonical rendering and Guardian actually consume.
export const QUALITY_SOURCE_EXCLUDED_FIELDS_022=Object.freeze(['metadata','id','schemaVersion','createdAt','updatedAt','revision','studentOwnerId','programId','exportState','builder','mode','layoutLock','preferences','intake','medicalSchoolNormalizationQueue']);
export function projectQualitySource022(document,now=new Date()){
  const source=document&&typeof document==='object'&&!Array.isArray(document)?document:{};
  return{
    ...Object.fromEntries(Object.entries(source).filter(([key])=>!QUALITY_SOURCE_EXCLUDED_FIELDS_022.includes(key))),
    guardianInputs022:{
      presentationMonth:presentationCurrentMonth(source,null,now),
      interview:source.metadata?.interview||null,
      appliedFixes:source.metadata?.qualityGuardian?.appliedFixes||[],
      confirmedExceptions:source.metadata?.qualityGuardian?.confirmedExceptions||[],
      acceptedCandidates:(Array.isArray(source.intake?.candidates)?source.intake.candidates:[])
        .filter(candidate=>candidate?.decision==='accepted').map(candidate=>({id:candidate.id||'',title:candidate.title||''}))
    }
  };
}
