// The existing minimized saved-owner projection, never private context, current
// setup or mutable teaching data. Authorized Admin review may omit this intent.
export function savedInterviewerIdentity(attempt) {
  const context=attempt?.detail?.retryContext;
  if(context?.schema!=='ivoc.retry-intent.v1'||!attempt?.id||context.sourceSessionId!==attempt.id)return '';
  const role=['Program Director','Associate Program Director','Faculty','Chief Resident'].includes(context?.interviewer)?context.interviewer:null;
  const style=['Dove','Peacock','Owl','Eagle'].includes(context?.interviewerStyle)?context.interviewerStyle:null;
  return [role,style].filter(Boolean).join(' · ');
}
