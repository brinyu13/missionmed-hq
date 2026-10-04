// Presentation evidence only; message receipt time is not a speech boundary.
// Retractable fragment observations never become a second transcript ledger.
export function applyNativeObservationMarks(events,before,snap,speaker,t){
  if(!snap)return;
  const active=new Set(snap.hooks.filter(h=>h.decision==='OBSERVED_FRAGMENT').map(h=>h.fragmentWindow));
  for(let i=events.length-1;i>=0;i--){
    const event=events[i];
    if(event.fragmentObservation===true&&(snap.fragmentHalted
      ||event.provisionalHookWindow!==undefined&&!active.has(event.provisionalHookWindow)))events.splice(i,1);
  }
  if(snap.fragmentHalted)return;
  const partial=snap.finalObservationCount===(before?.finalObservationCount||0);
  const mark=(kind,label,hook=null)=>events.push({t,kind,label,
    ...(partial?{fragmentObservation:true,state:'FRAGMENT_TEXT'}:{}),
    ...(hook?.decision==='OBSERVED_FRAGMENT'?{provisionalHookWindow:hook.fragmentWindow}:{})});
  if(speaker==='interviewer'&&snap.n!==before?.n)mark('question','Q'+snap.n);
  if(speaker==='applicant'&&snap.hooks.length>(before?.hooks.length||0)){
    const hook=snap.hooks.at(-1);mark('hook',(hook.decision==='OBSERVED_FRAGMENT'?'Possible hook: ':'Hook: ')+hook.span,hook);
  }
  if(speaker==='interviewer'&&snap.state==='FOLLOWUP'&&before?.state!==snap.state)mark('followup','Matching follow-up text',snap.hooks.findLast(h=>h.bitTaken===true));
  if(snap.closing.reached&&!before?.closing.reached)mark('closing','Candidate questions');
  if(snap.state==='PROFESSIONAL_CLOSE'&&before?.state!==snap.state)mark('closing','Sign-off text');
}
