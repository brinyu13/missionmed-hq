import {normalizeResearchControls,programDescriptor} from './research-router.mjs';
import {assertResearchGrant} from '../adapters/interviewiq-job-auth.mjs';

// DR-373 grants this operation its own eligibility floor. It creates no RISE
// session/capabilities, and even administrators use the student spending gates.
export function evaluateInterviewiqResearchEligibility({program,controls,subjectHash,proof,binding,bodyHash}) {
  assertResearchGrant(proof,{binding,bodyHash,phase:'reserve'});
  const c=normalizeResearchControls(controls),scope=programDescriptor(program),reasons=[];
  if(c.emergencyKillSwitch)reasons.push('EMERGENCY_KILL_SWITCH');
  if(!c.globalEnabled)reasons.push('GLOBAL_PAUSED');
  if(!c.studentEnabled)reasons.push('STUDENT_PAUSED');
  if(!scope.programSpecialtyId||!scope.acgmeId)reasons.push('PROGRAM_IDENTITY_UNAVAILABLE');
  if(c.canaryMode==='PROGRAM_ID_ALLOWLIST'&&!c.canaryProgramIds.includes(scope.acgmeId))reasons.push('PROGRAM_OUT_OF_CANARY');
  if(c.canaryMode==='SPECIALTY_SCOPE'&&(!c.specialtyScope.includes(scope.specialty)||!c.stateScope.includes(scope.state)))reasons.push('PROGRAM_OUT_OF_SCOPE');
  if(c.subjectAllowlistHashes.length&&!c.subjectAllowlistHashes.includes(subjectHash))reasons.push('SUBJECT_OUT_OF_CANARY');
  // Unknown future policy scopes require review; never invent capabilities.
  if(c.entitlementScope.length!==1||c.entitlementScope[0]!=='rise:private-beta')reasons.push('IIQ_ENTITLEMENT_SCOPE_UNREVIEWED');
  return {eligible:reasons.length===0,reasons,source:'STUDENT',scope};
}
