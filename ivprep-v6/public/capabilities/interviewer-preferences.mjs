// Bounded delivery preferences, not free-text instructions or evidence.
export function normalizeInterviewerPreferences(value) {
  if(value===undefined)return undefined; // legacy callers stay unchanged
  if(!value||typeof value!=='object'||Array.isArray(value)
    ||Object.keys(value).sort().join(',')!=='curiosity,interruption,pacing,programEmphasis,schema'
    ||value.schema!=='ivoc.interviewer-preferences.v1'
    ||!['low','normal','high'].includes(value.curiosity)
    ||!['relaxed','normal','brisk'].includes(value.pacing)
    ||typeof value.interruption!=='boolean'
    ||!['light','normal','strong'].includes(value.programEmphasis))throw new TypeError('Interviewer preferences are invalid.');
  return Object.freeze({schema:value.schema,curiosity:value.curiosity,pacing:value.pacing,interruption:value.interruption,programEmphasis:value.programEmphasis});
}

export function interviewerPreferenceRequest(value={}) {
  const preferences=normalizeInterviewerPreferences(value.interviewerPreferences);
  return preferences?{interviewerPreferences:preferences}:{};
}
