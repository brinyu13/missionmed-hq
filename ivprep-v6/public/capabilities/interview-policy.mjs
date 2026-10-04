// Minimized public view of server-owned, append-only IVOC Admin configuration.
// A client preference never grants or raises the server's follow-up ceiling.
export function normalizeInterviewPolicy(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join(',') !== 'defaultFollowUpDepth,defaultPressureEnabled,maxFollowUpsPerAnswer,schema,version'
    || value.schema !== 'ivoc.interview-policy.v1' || !Number.isSafeInteger(value.version) || value.version < 1
    || !Number.isInteger(value.maxFollowUpsPerAnswer) || value.maxFollowUpsPerAnswer < 0 || value.maxFollowUpsPerAnswer > 5
    || !Number.isInteger(value.defaultFollowUpDepth) || value.defaultFollowUpDepth < 0 || value.defaultFollowUpDepth > Math.min(2,value.maxFollowUpsPerAnswer)
    || typeof value.defaultPressureEnabled !== 'boolean') throw new TypeError('Interview policy is unavailable.');
  return Object.freeze({...value});
}
export function projectInterviewPolicy(row) {
  const p=row?.pressure_defaults;
  if (row?.schema_name !== 'ivoc.admin_config.v1' || !Number.isInteger(p?.default_follow_up_intensity)
    || p.default_follow_up_intensity < 0 || p.default_follow_up_intensity > 3) return null;
  try { return normalizeInterviewPolicy({schema:'ivoc.interview-policy.v1',version:row.version,
    maxFollowUpsPerAnswer:p.max_follow_ups_per_answer,
    defaultFollowUpDepth:Math.min(2,p.max_follow_ups_per_answer,p.default_follow_up_intensity),
    defaultPressureEnabled:p.default_pressure_enabled}); } catch { return null; }
}
export function resolveFollowUps(settings,interviewPolicy) {
  const policy=interviewPolicy ? normalizeInterviewPolicy(interviewPolicy) : null;
  const depth=Math.min(2,policy?.maxFollowUpsPerAnswer??2,Math.max(0,Math.floor(Number(settings.depth)||0)));
  return Object.freeze({depth,maxFollowUps:depth ? Math.max(0,Math.min(8,Math.floor(Number(settings.maxFollowUps)||0))) : 0});
}
export function normalizeFollowUpRequest(value) {
  const keys=['followUpDepth','maxFollowUps','interviewPolicyVersion'];
  if (!keys.some(key=>Object.hasOwn(value,key))) return {};
  if (!keys.every(key=>Object.hasOwn(value,key)) || !Number.isInteger(value.followUpDepth) || value.followUpDepth<0 || value.followUpDepth>2
    || !Number.isInteger(value.maxFollowUps) || value.maxFollowUps<0 || value.maxFollowUps>8
    || !Number.isSafeInteger(value.interviewPolicyVersion) || value.interviewPolicyVersion<1) throw new TypeError('Interview follow-up settings are invalid.');
  return Object.freeze({followUpDepth:value.followUpDepth,maxFollowUps:value.maxFollowUps,interviewPolicyVersion:value.interviewPolicyVersion});
}
export function policyChangedError() {
  return Object.assign(new Error('Interview policy changed. Return to interview setup to review the current limits.'),{code:'ivoc_interview_policy_changed'});
}
