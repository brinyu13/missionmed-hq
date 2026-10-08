import {AUTHORED_SCHEMA,proseUnits} from '../../server/loi-prose-contract.mjs';
export function authoredOutput(input){
 const refs=kind=>input.refs.filter(r=>r.kind===kind),id=refs('identity')[0],reason=refs('reason')[0],ev=refs('evidence')[0];
 return {schema:AUTHORED_SCHEMA,candidates:input.approaches.map(approach=>{
  const motives=/mentorship/i.test(reason.text)?'Longitudinal mentorship in an outpatient clinic is the priority behind my interest.':'Longitudinal care for underserved patients is the thread that draws my interest toward continuity clinic training.';
  const evidence='Residents return to a supervised continuity clinic every week.';
  const pair=[{text:motives,refs:[reason.ref,ev.ref]},{text:evidence,refs:[ev.ref]}],contexts=refs('context').map(r=>({text:r.text,refs:[r.ref]})),facts=refs('fact').map(r=>({text:r.text,refs:[r.ref]}));
  const purpose={text:`I am following up with ${id.text} about my application.`,refs:[id.ref,'context:whyNow']};
  let body;if(approach==='ACADEMIC_PROGRAM')body=[pair[1],purpose,pair[0],...facts,...contexts];else if(['WARM_PERSONAL','STRONG_INTEREST'].includes(approach))body=[pair[0],purpose,...facts,pair[1],...contexts];else if(approach==='UPDATE_LED')body=[...facts,purpose,...contexts,...pair];else body=[purpose,...contexts,...pair,...facts];
  const used=new Set(body.flatMap(x=>x.refs));body.push(...input.refs.filter(r=>!used.has(r.ref)).map(r=>({text:r.text,refs:[r.ref]})));
  const paragraphs=[{text:'Dear Program Leadership,',refs:[]},...body,{text:approach==='WARM_PERSONAL'?'Thank you for reading my perspective.':approach==='ACADEMIC_PROGRAM'?'Thank you for considering these priorities.':'Thank you for considering this letter.',refs:[]}];let text='',unitBindings=[];
  paragraphs.forEach((p,i)=>{if(i)text+=approach==='DIRECT_CONCISE'?'\n\n':approach==='ACADEMIC_PROGRAM'&&i%2||i===1||i===paragraphs.length-1?'\n\n':'\n';const start=text.length;text+=p.text;unitBindings.push({start,end:text.length,refs:p.refs});});
  const claims=proseUnits(text).map(u=>({start:u.start,end:u.end,refs:[...new Set(unitBindings.filter(b=>b.start<u.end&&b.end>u.start).flatMap(b=>b.refs))]}));
  return {approach,text,claims,fitLinks:[{evidenceRef:ev.ref,reasonRef:reason.ref}]};
 })};
}
