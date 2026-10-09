// Presentation preflight only; the server still owns every paid admission.
export const AVATAR_UNAVAILABLE='Avatar test unavailable: this allowance is used, disabled, or not verified. No avatar interview will start. Ask the Foreman to prepare the next bounded test.';
export function avatarAdmissionReady(capability){
  return capability?.schema==='ivoc.founder-qa.v1'&&capability.available===true
    &&capability.enabled===true&&capability.sourceIntegrity===true
    &&Number.isFinite(capability.maxSeconds)&&capability.maxSeconds>0;
}
export async function refreshAvatarAdmission(fetchImpl=globalThis.fetch){
  let response,capability;
  try{
    response=await fetchImpl.call(globalThis,'/api/ivoc/v1/admin/embodiment-canary',{
      credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)});
    if(!response.ok)throw new Error();
    capability=await response.json();
  }catch{throw new Error('Avatar readiness could not be verified. Nothing has started. Check the connection and try Start again.');}
  if(!avatarAdmissionReady(capability))throw new Error(AVATAR_UNAVAILABLE);
  return capability;
}
export function interviewPresenceCue({connecting=false,interviewerSpeaking=false,candidateSpeaking=false,avatar=false}={}){
  if(connecting)return 'connecting interviewer';
  if(interviewerSpeaking)return avatar?'interviewer speaking · please listen':'speaking';
  return candidateSpeaking?'listening to you':avatar?'wait for spoken question':'listening';
}
