import {AUTHORED_SCHEMA,validateAuthoredTrace,PROSE_SCHEMA,validateProseTrace,validateProseVerification,VERIFICATION_SCHEMA,SINGLE_CALL_SCHEMA,validateLocalProseTrace} from './loi-prose-contract.mjs';
import * as v from './validation.mjs';
import {requireValue} from './errors.mjs';
export const APPROACHES=Object.freeze(['WARM_PERSONAL','DIRECT_CONCISE','ACADEMIC_PROGRAM','POST_INTERVIEW','UPDATE_LED','STRONG_INTEREST']);
export const APPROACH_LABELS=Object.freeze(['Warm + Personal','Direct + Concise','Academic + Program-Specific','Post-Interview Reflective','Update-Led','Strong Interest']);
// AI may select source spans and these fixed connectives only, never author factual prose.
export const CONNECTORS=Object.freeze({greeting:'Dear Program Leadership,',interest:'I am writing to express my interest.',fit:'These priorities shape my interest in your program.',reflect:'I would like to share my reflections.',update:'I would like to share this confirmed update.',close:'Thank you for considering my interest.'});
const safeText=(s,label,max=4000)=>{v.text(s,label,max,{empty:false});requireValue(!/(?:ignore\s+(?:all\s+)?(?:previous|instructions)|system\s*prompt|<\/?(?:script|system)|\b(?:api[_ -]?key|jailbreak)\b)/i.test(s),'loi_composition_input','Remove instructions or sensitive credentials from factual inputs.');return s;};
function leaves(x){if(typeof x==='string')return[x];if(Array.isArray(x))return x.flatMap(leaves);if(x!==null&&typeof x==='object')return Object.values(x).flatMap(leaves);return [];}
export const POSITION_TYPES=Object.freeze(['CATEGORICAL','PRELIMINARY','TRANSITIONAL_YEAR','ADVANCED','RESERVED','OTHER','UNKNOWN']);
export function compositionInput(data,fresh,current,defaultApproach){
 v.onlyKeys(data,['letterId','expectedHead','expectedLetterVersion','context','contextConfirmed','motivations','facts','selectedEvidence','approach','approaches','count','postInterviewConfirmed','updateConfirmed','positionType','advancedProgramName']);
 v.onlyKeys(data.context,['whyNow','applicationState','interviewState']);requireValue(data.contextConfirmed===true,'loi_context_confirmation','Confirm the current Why Now and application/interview context.');
 const context=Object.fromEntries(['whyNow','applicationState','interviewState'].map(k=>[k,safeText(data.context[k],k,2000)]));
 const items=(values,label)=>v.array(values,label,20).map(x=>{v.onlyKeys(x,['id','text','confirmed']);requireValue(x.confirmed===true,'loi_fact_confirmation','Confirm every fact and reason.');return {id:v.uuid(x.id,label),text:safeText(x.text,label),confirmed:true};});
 const motivations=items(data.motivations,'Reason'),facts=items(data.facts,'Fact');requireValue(motivations.length>0&&fresh.evidence.length>0,'loi_research_needed','Select supported evidence and a confirmed personal reason.',409);
 for(const key of ['postInterviewConfirmed','updateConfirmed'])if(data[key]!==undefined)v.boolean(data[key],'Approach context');
 const count=v.choice(data.count,[1,3],'draft count');let approaches;
 if(count===1){requireValue(data.approaches===undefined,'unexpected_fields','One draft accepts one approach.');approaches=[v.choice(data.approach??current?.compositionApproach??defaultApproach,APPROACHES,'approach')];}
 else{requireValue(data.approach===undefined,'unexpected_fields','Three drafts require three explicit approaches.');approaches=v.array(data.approaches,'Approaches',3).map(a=>v.choice(a,APPROACHES,'approach'));requireValue(approaches.length===3&&new Set(approaches).size===3,'loi_approaches_required','Choose three different approaches explicitly.');}
 if(approaches.includes('POST_INTERVIEW'))requireValue(data.postInterviewConfirmed===true,'loi_post_interview_confirmation','Confirm that the interview occurred before using this approach.');
 if(approaches.includes('UPDATE_LED'))requireValue(data.updateConfirmed===true&&facts.length>0,'loi_update_confirmation','Confirm a current update as an explicit student fact.');
 // ── Position type awareness (prelim/TY LOI context) ──────────────────
 const positionType=data.positionType!==undefined?v.choice(data.positionType,POSITION_TYPES,'position type'):null;
 const advancedProgramName=positionType&&['PRELIMINARY','TRANSITIONAL_YEAR'].includes(positionType)&&typeof data.advancedProgramName==='string'&&data.advancedProgramName.length>0?safeText(data.advancedProgramName,'Advanced program name',500):null;
 const refs=[{ref:'program',text:safeText(fresh.program.name,'Program',500),kind:'identity'},...Object.entries(context).map(([k,text])=>({ref:'context:'+k,text,kind:'context'})),...motivations.map((x,i)=>({ref:'reason:'+i,text:x.text,kind:'reason'})),...facts.map((x,i)=>({ref:'fact:'+i,text:x.text,kind:'fact'}))];
 // Inject position-context ref for prelim/TY letters referencing their Advanced program relationship
 if(positionType&&['PRELIMINARY','TRANSITIONAL_YEAR'].includes(positionType)){const label=positionType==='PRELIMINARY'?'Preliminary':'Transitional Year';const posText=advancedProgramName?`This is a ${label} (PGY-1) program. The applicant is pursuing this position to fulfill the prerequisite PGY-1 year for their Advanced program at ${advancedProgramName}.`:`This is a ${label} (PGY-1) program.`;refs.push({ref:'positionContext',text:posText,kind:'context'});}
 const evidence=fresh.evidence.map((e,i)=>{const spans=leaves(e.value).filter(s=>s.trim().length>=8);requireValue(spans.length>0,'loi_composition_evidence','Choose evidence with an exact textual span.',409);return {ref:'evidence:'+i,text:safeText(spans.join('\n'),'Evidence',4000),kind:'evidence',field:e.field,claimRef:e.claimRef,sources:e.sources,asOf:e.asOf};});refs.push(...evidence);
 requireValue(new Set(refs.map(r=>r.ref)).size===refs.length,'loi_composition_input','References must be distinct.');
 return {schema:'iiq-loi-composition-input-v1',program:Object.fromEntries(['id','name','track','registryReleaseId'].map(k=>[k,fresh.program[k]])),approaches,contextConfirmations:{postInterviewOccurred:data.postInterviewConfirmed===true,updateConfirmed:data.updateConfirmed===true},positionType:positionType||null,advancedProgramName:advancedProgramName||null,context,motivations,facts,selectedEvidence:fresh.evidence.map(e=>({field:e.field,claimRef:e.claimRef})),refs,evidenceDigest:fresh.evidenceDigest,resultDigest:fresh.resultDigest,coverageDigest:fresh.coverageDigest,observedAt:fresh.observedAt};
}
function order(input,approach){const kinds={WARM_PERSONAL:['reason','identity','context','fact','evidence'],DIRECT_CONCISE:['identity','context','reason','evidence','fact'],ACADEMIC_PROGRAM:['identity','evidence','reason','fact','context'],POST_INTERVIEW:['context','identity','reason','evidence','fact'],UPDATE_LED:['fact','context','identity','evidence','reason'],STRONG_INTEREST:['identity','reason','evidence','context','fact']}[approach];return kinds.flatMap(k=>input.refs.filter(r=>r.kind===k).map(r=>({ref:r.ref})));}
export function standardPlans(input){return {schema:'iiq-loi-composition-plan-v1',candidates:input.approaches.map(approach=>({approach,blocks:[{connector:'greeting'},{connector:approach==='POST_INTERVIEW'?'reflect':approach==='UPDATE_LED'?'update':'interest'},...order(input,approach),{connector:'fit'},{connector:'close'}]}))};}
export function validatePlans(output,input,maxBytes=32768){
 requireValue(typeof output==='object'&&output!==null&&Buffer.byteLength(JSON.stringify(output))<=maxBytes,'loi_composition_output','Composition output exceeded its contract.');v.onlyKeys(output,['schema','candidates']);requireValue(output.schema==='iiq-loi-composition-plan-v1','loi_composition_output','Use the reference-only composition schema.');
 const rows=v.array(output.candidates,'Candidates',3);requireValue(rows.length===input.approaches.length,'loi_composition_output','Return the explicitly requested number of candidates.');const signatures=new Set();
 return rows.map((row,i)=>{v.onlyKeys(row,['approach','blocks']);requireValue(row.approach===input.approaches[i],'loi_composition_output','Return each requested approach in order.');const used=[];
  const blocks=v.array(row.blocks,'Composition blocks',100).map(b=>{v.onlyKeys(b,['ref','connector']);requireValue(Object.keys(b).length===1,'loi_composition_output','Each block selects one exact span or connective.');if(Object.hasOwn(b,'ref')){const ref=input.refs.find(r=>r.ref===b.ref);requireValue(ref,'loi_composition_reference','Unknown factual reference.');used.push(ref.ref);return {ref:ref.ref,text:ref.text};}requireValue(Object.hasOwn(CONNECTORS,b.connector),'loi_composition_output','Only reviewed fixed connectives are allowed.');requireValue(b.connector!=='reflect'||row.approach==='POST_INTERVIEW','loi_composition_output','Reflection requires a confirmed post-interview approach.');requireValue(b.connector!=='update'||row.approach==='UPDATE_LED','loi_composition_output','An update requires a confirmed update-led approach.');return {connector:b.connector,text:CONNECTORS[b.connector]};});
  requireValue(used.length===input.refs.length&&new Set(used).size===used.length&&input.refs.every(r=>used.includes(r.ref)),'loi_composition_reference','Every candidate must preserve the same complete confirmed facts and supported spans exactly once.');
  const signature=used.join('|');requireValue(!signatures.has(signature),'loi_composition_variation','Choose a genuinely different structure for each approach.');signatures.add(signature);
  const text=blocks.map(b=>b.text).join('\n\n');requireValue(text.length<=20000,'loi_composition_output','The proposal is too long.');return {approach:row.approach,text,blocks:blocks.map(({text,...binding})=>binding),studentReviewRequired:true,studentFactualConfirmation:false,studentSpecificityConfirmation:false};
 });
}
// ── Worker 02 — Quality Safeguards (additive) ──────────────────────────────
// Prose composition (v2) returns authored text that must preserve every
// factual span verbatim and demonstrate sufficient specificity relative
// to the input evidence. These utilities gate validateProsePlans.

export const MINIMUM_SPECIFICITY_RATIO = 0.15;
export const MAXIMUM_OVERLAP_RATIO = 0.85;

/** Locate every occurrence of `span` in `text`, returning {start,end} pairs. */
export function locateSpans(text, span) {
  const results = [];
  if (typeof text !== 'string' || typeof span !== 'string' || span.length < 1) return results;
  let idx = 0;
  while ((idx = text.indexOf(span, idx)) !== -1) {
    results.push({ start: idx, end: idx + span.length });
    idx += 1;
  }
  return results;
}

/** Extract bigrams from a string for overlap measurement. */
function bigrams(s) {
  const clean = s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const set = new Set();
  for (let i = 0; i < clean.length - 1; i++) set.add(clean.slice(i, i + 2));
  return set;
}

/** Bigram overlap ratio between two strings (0–1). */
export function bigramOverlap(a, b) {
  const ba = bigrams(a), bb = bigrams(b);
  if (ba.size === 0 || bb.size === 0) return 0;
  let shared = 0;
  for (const bg of ba) if (bb.has(bg)) shared++;
  return shared / Math.min(ba.size, bb.size);
}

/** Specificity = fraction of authored prose that is NOT a verbatim factual span. */
export function measureProseSpecificity(text, refs) {
  if (typeof text !== 'string' || text.length === 0) return 0;
  // Mark every character that is covered by a verbatim span
  const covered = new Uint8Array(text.length);
  for (const ref of refs) {
    if (!ref?.text) continue;
    for (const { start, end } of locateSpans(text, ref.text)) {
      for (let i = start; i < end; i++) covered[i] = 1;
    }
  }
  let coveredCount = 0;
  for (let i = 0; i < covered.length; i++) if (covered[i]) coveredCount++;
  // Specificity = unique authored chars / total chars
  return (text.length - coveredCount) / text.length;
}

/** Pairwise variation across candidates: no two may overlap beyond MAXIMUM_OVERLAP_RATIO. */
export function measureVariation(candidates) {
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      if (bigramOverlap(candidates[i].text, candidates[j].text) > MAXIMUM_OVERLAP_RATIO) {
        return false;
      }
    }
  }
  return true;
}

/** Structural author traces are untrusted until the independent pass succeeds. */
export function validateAuthoredPlans(output,input,maxBytes=32768){
 requireValue(typeof output==='object'&&output!==null&&Buffer.byteLength(JSON.stringify(output))<=maxBytes,'loi_composition_output','Prose output exceeded its contract.');v.onlyKeys(output,['schema','candidates']);requireValue(output.schema===PROSE_SCHEMA,'loi_composition_output','Use the current traced prose schema.');
 const rows=v.array(output.candidates,'Candidates',3);requireValue(rows.length===input.approaches.length,'loi_composition_output','Return the explicitly requested number of candidates.');const structures=new Set();
 return rows.map((row,i)=>{requireValue(row.approach===input.approaches[i],'loi_composition_output','Return each requested approach in order.');if(row.approach==='POST_INTERVIEW')requireValue(input.contextConfirmations?.postInterviewOccurred===true,'loi_composition_structure','A confirmed interview is required.');if(row.approach==='UPDATE_LED')requireValue(input.contextConfirmations?.updateConfirmed===true,'loi_composition_structure','A confirmed update is required.');const trace=validateProseTrace(row,input.refs);requireValue(!structures.has(trace.structure),'loi_composition_variation','Use a different factual ordering for each requested approach.');structures.add(trace.structure);return {...row,claims:trace.claims,fitLinks:trace.fitLinks};});
}
export function validateProsePlans(output,input,maxBytes=32768){
 requireValue(output&&Buffer.byteLength(JSON.stringify(output))<=maxBytes,'loi_composition_output','Combined prose review exceeded its bound.');v.onlyKeys(output,['schema','candidates','verification']);const rows=validateAuthoredPlans({schema:output.schema,candidates:output.candidates},input,maxBytes),report=output.verification;
 requireValue(report?.schema===VERIFICATION_SCHEMA&&Array.isArray(report.candidates)&&report.candidates.length===rows.length,'loi_verifier_completeness','An independent factual and quality review is required.');v.onlyKeys(report,['schema','candidates']);
 return rows.map((row,i)=>{const verification=validateProseVerification(row,input.refs,report.candidates[i],input.program,i);return {...row,verification,studentReviewRequired:true,studentFactualConfirmation:false,studentSpecificityConfirmation:false};});
}

// New drafts use only deterministic local validation. Saved V3 independent
// verification remains readable through validateProsePlans above.
export function validateSingleCallPlans(output,input,maxBytes=32768){
 requireValue(output&&Buffer.byteLength(JSON.stringify(output))<=maxBytes,'loi_composition_output','Prose output exceeded its bound.');v.onlyKeys(output,['schema','candidates']);requireValue(output.schema===SINGLE_CALL_SCHEMA,'loi_composition_output','Use the single-call prose contract.');
 const rows=validateAuthoredPlans({schema:PROSE_SCHEMA,candidates:output.candidates},input,maxBytes),openings=new Set(),cadences=new Set();
 return rows.map(row=>{const local=validateLocalProseTrace(row,input.refs,input.program);requireValue(!openings.has(local.opening)&&!cadences.has(local.cadence),'loi_composition_variation','Requested approaches must vary opening and paragraph cadence as well as factual order.');openings.add(local.opening);cadences.add(local.cadence);return {...row,studentReviewRequired:true,studentFactualConfirmation:false,studentSpecificityConfirmation:false};});
}

// New generation only. The V4 validator above is retained for saved output.
export function validateAuthoredSingleCallPlans(output,input,maxBytes=32768){
 requireValue(output&&Buffer.byteLength(JSON.stringify(output))<=maxBytes,'loi_composition_output','Authored output exceeded its bound.');v.onlyKeys(output,['schema','candidates']);requireValue(output.schema===AUTHORED_SCHEMA,'loi_composition_output','Use the authored single-call contract.');const rows=v.array(output.candidates,'Candidates',3);requireValue(rows.length===input.approaches.length,'loi_composition_output','Return only the explicitly requested approaches.');const structures=new Set(),openings=new Set(),cadences=new Set();
 return rows.map((row,i)=>{requireValue(row.approach===input.approaches[i],'loi_composition_output','Return approaches in order.');if(row.approach==='POST_INTERVIEW')requireValue(input.contextConfirmations?.postInterviewOccurred===true,'loi_composition_structure','Confirm the interview.');if(row.approach==='UPDATE_LED')requireValue(input.contextConfirmations?.updateConfirmed===true,'loi_composition_structure','Confirm the update.');const t=validateAuthoredTrace(row,input.refs,input.program);requireValue(!structures.has(t.structure)&&!openings.has(t.opening)&&!cadences.has(t.cadence),'loi_composition_variation','Requested approaches must change organization, opening and cadence.');structures.add(t.structure);openings.add(t.opening);cadences.add(t.cadence);return {...row,claims:t.claims,fitLinks:t.fitLinks,review:t.review,studentReviewRequired:true,studentFactualConfirmation:false,studentSpecificityConfirmation:false};});
}
