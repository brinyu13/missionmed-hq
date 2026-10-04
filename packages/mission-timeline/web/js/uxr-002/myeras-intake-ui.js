import {escapeHtml} from './utils.js';
import {MYERAS_SOURCE_SCHEMA,myerasConflicts,myerasReviewErrors,resolveMyerasConflict,supplementMyerasCandidate} from './myeras-intake-adapter.js';
const clone=value=>structuredClone(value);
const sourceNames=choice=>[...new Set((choice.evidence||[]).map(evidence=>[evidence.fileName||evidence.sourceDocumentName,evidence.section].filter(Boolean).join(' → ')).filter(Boolean))].join(', ')||choice.sourceIds.join(', ')||'Current profile';
const label=field=>field.replace(/([A-Z])/g,' $1').replace(/^./,char=>char.toUpperCase());
export function myerasEntryMarkup(){return`<section class="panelD" data-myeras-builder-entry><div class="pi"><h2>Import from MyERAS</h2><p>Bring a CV and structured MyERAS sections into one source review. Compare facts and approve what belongs on your Timeline.</p><button type="button" class="btnD alt" data-myeras-open>Review MyERAS sources</button></div></section>`;}
export function myerasUploadMarkup(){return`<section class="intake-stage" data-myeras-upload><h2>Import your MyERAS sources</h2><p>Choose a local structured source file or paste its JSON. This source check runs locally. It does not sign in to MyERAS or send this import to an AI provider. Sources are saved with your Timeline draft on this device; review facts and audience before approval.</p><label>Structured source file <input type="file" accept=".json,application/json" data-myeras-file></label><label>Structured source JSON <textarea rows="7" data-myeras-json placeholder='{"schemaVersion":"${MYERAS_SOURCE_SCHEMA}","sources":[]}'></textarea></label><label><input type="checkbox" data-myeras-consent> I consent to storing these source facts in my private Timeline draft and will review them before approval.</label><button type="button" class="btnD go" data-myeras-read>Read sources for review</button><p role="status" aria-live="polite" data-myeras-status></p></section>`;}
function choiceMarkup(conflict,candidateId,profile=false){return`<fieldset class="entry-card" data-myeras-conflict="${escapeHtml(conflict.id)}"><legend>${escapeHtml(label(conflict.field))}: compare the source values</legend>${conflict.choices.map((choice,index)=>`<p>${escapeHtml(sourceNames(choice))}: ${escapeHtml(String(choice.value??''))} <button type="button" class="button secondary small" data-myeras-resolve="${escapeHtml(conflict.id)}" data-myeras-candidate="${escapeHtml(candidateId)}" data-myeras-choice="${index}" ${profile?'data-myeras-profile="true"':''}>Use this value</button></p>`).join('')}<label>Your correction <input data-myeras-correction></label><label>Evidence for this correction <input data-myeras-reason></label><button type="button" class="button secondary small" data-myeras-resolve="${escapeHtml(conflict.id)}" data-myeras-candidate="${escapeHtml(candidateId)}" ${profile?'data-myeras-profile="true"':''}>Use my correction</button>${conflict.resolution?`<p>Resolved: ${escapeHtml(String(conflict.resolution.value??''))} · ${escapeHtml(conflict.resolution.basis)}</p>`:''}</fieldset>`;}
export function myerasReviewMarkup(state){
  if(state.stage!=='review')return'';
  const candidates=(state.candidates||[]).filter(candidate=>candidate.fields?.myerasReview);
  const claims=state.extraction?.parser?.myerasProfileReview?.claims||[];
  if(!candidates.length&&!claims.length)return'';
  return`<section class="intake-stage" data-myeras-review><h2>Compare your MyERAS sources</h2><p>Source choices resolve one fact at a time. A dismissed general suggestion does not verify a conflict. Original source values remain in the evidence.</p>${candidates.map(candidate=>{
    const review=candidate.fields.myerasReview;
    return`<details ${Object.keys(myerasReviewErrors(candidate)).length?'open':''}><summary>${escapeHtml(candidate.title||'Untitled experience')} · ${candidate.provenance.length} source references</summary>${(review.conflicts||[]).map(conflict=>choiceMarkup(conflict,candidate.id)).join('')}${review.mergePrivacyNotice?`<p role="note">${escapeHtml(review.mergePrivacyNotice)}</p>`:''}${(review.possibleDuplicates||[]).map(item=>`<p>Possible duplicate: ${escapeHtml(item.id)} ${item.resolution?`· ${escapeHtml(item.resolution)}`:`<button type="button" class="button secondary small" data-myeras-duplicate="${escapeHtml(item.id)}" data-myeras-candidate="${escapeHtml(candidate.id)}" data-myeras-duplicate-kind="${item.kind}" data-myeras-duplicate-choice="separate">Different experience</button><button type="button" class="button secondary small" data-myeras-duplicate="${escapeHtml(item.id)}" data-myeras-candidate="${escapeHtml(candidate.id)}" data-myeras-duplicate-kind="${item.kind}" data-myeras-duplicate-choice="same">Same experience</button>`}</p>`).join('')}</details>`;
  }).join('')}${claims.length?`<h3>Profile facts</h3><p>Profile facts can be reviewed without creating a dated event. Existing values change only when you explicitly choose a source replacement.</p>${claims.map(claim=>`<div class="entry-card" data-myeras-profile-claim="${escapeHtml(claim.id)}">${choiceMarkup({...claim,resolution:claim.resolution},claim.id,true)}<label>Audience <select data-myeras-profile-audience="${escapeHtml(claim.id)}"><option value="ADVISOR_ONLY" ${claim.visibilityState==='ADVISOR_ONLY'?'selected':''}>Advisor only</option><option value="INTERVIEWER_SAFE" ${claim.visibilityState==='INTERVIEWER_SAFE'?'selected':''}>Interviewer safe</option></select></label><p>Status: ${escapeHtml(claim.decision)}</p><button type="button" class="button secondary small" data-myeras-profile-decision="accepted" data-myeras-claim="${escapeHtml(claim.id)}" ${claim.resolution?'':'disabled'}>Accept this profile fact</button><button type="button" class="button tertiary small" data-myeras-profile-decision="rejected" data-myeras-claim="${escapeHtml(claim.id)}">Leave out</button></div>`).join('')}`:''}</section>`;
}
export function resolveMyerasDuplicate(machine,candidateId,targetId,kind,choice){
  const state=machine.snapshot(),candidate=state.candidates.find(item=>item.id===candidateId);if(!candidate)throw new Error('This candidate is unavailable.');
  if(candidate.fields?.myerasReview?.mergedInto)throw new Error('This source already belongs to a merged candidate. Review its canonical owner.');
  const fields=clone(candidate.fields),review=fields.myerasReview,item=review.possibleDuplicates.find(item=>item.id===targetId&&item.kind===kind);if(!item)throw new Error('This duplicate review is unavailable.');
  if(!['separate','same'].includes(choice))throw new Error('Choose whether these are separate or the same experience.');
  item.resolution=choice;
  if(choice==='same'&&kind==='event'){
    const event=machine.existingEvents.find(event=>event.id===targetId);if(!event)throw new Error('The existing experience is unavailable.');
    const values={title:event.title,categoryId:event.categoryId,startDate:event.fields?.datePrecision?.start==='YEAR'?String(event.startDate||'').slice(0,4):event.startDate,endDate:event.fields?.datePrecision?.end==='YEAR'?String(event.endDate||'').slice(0,4):event.endDate,openEnded:event.openEnded===true,eventType:event.eventType,institution:event.siteName||event.fields?.institution||event.fields?.organization||'',description:event.fields?.description||'',...Object.fromEntries(['canonicalType','country','city','state','specialty','rotationType','degree','role','examSystem','examName','result','score','attempt'].map(key=>[key,event.fields?.[key]??'']))};
    review.mergeEventId=targetId;review.mergePrivacyNotice='Merging keeps the more private audience for the complete event. Review sharing after approval.';review.variants.push({sourceId:`timeline:${targetId}`,values,dates:{start:{value:event.startDate,precision:event.fields?.datePrecision?.start||'MONTH',raw:event.startDate},end:{value:event.endDate,precision:event.fields?.datePrecision?.end||'MONTH',raw:event.endDate}},provenance:{sourceDocumentId:`timeline:${targetId}`,fileName:`Existing Timeline: ${event.title}`,section:'Reviewed experience',sourceExcerpt:'Existing reviewed Timeline event'}});
    review.conflicts=myerasConflicts(review.variants);machine.editCandidate(candidateId,{fields});return;
  }
  if(kind==='candidate'){
    const target=state.candidates.find(item=>item.id===targetId);if(!target)throw new Error('The other experience is unavailable.');
    if(target.fields?.myerasReview?.mergedInto)throw new Error('This source already belongs to a merged candidate. Review its canonical owner.');
    if(choice==='same'){
      review.variants.push(...clone(target.fields.myerasReview.variants));review.conflicts=myerasConflicts(review.variants);
      review.mergedCandidateIds=[...new Set([...(review.mergedCandidateIds||[]),target.id,...(target.fields.myerasReview.mergedCandidateIds||[])])];
      for(const duplicate of review.possibleDuplicates)if(review.mergedCandidateIds.includes(duplicate.id))duplicate.resolution='same';
      fields.sourceProvenance=[...(candidate.provenance||[]),...(target.provenance||[])];
      // Intake keeps source variants in fields; the controlled transition copies their evidence.
      const supplemented=supplementMyerasCandidate({...clone(candidate),fields});
      machine.dispatch({type:'MYERAS_MERGE_CANDIDATES',id:candidateId,targetId,fields:supplemented.fields,patch:supplemented});return;
    }
    const targetFields=clone(target.fields);const reciprocal=targetFields.myerasReview.possibleDuplicates.find(item=>item.id===candidateId);if(reciprocal)reciprocal.resolution='separate';machine.editCandidate(targetId,{fields:targetFields});
  }
  machine.editCandidate(candidateId,{fields});
}
export function installMyerasIntakeUi(root,machine,{navigate=()=>{},onError=()=>{}}={}){
  let selectedFile=null;
  const error=(event,err)=>{const status=root.querySelector?.('[data-myeras-status]');if(status)status.textContent=err.message;onError(err);};
  const click=async event=>{
    try{
      if(event.target.closest?.('[data-myeras-open]')){navigate('intake');return;}
      const read=event.target.closest?.('[data-myeras-read]');
      if(read){
        const form=read.closest('[data-myeras-upload]');if(!form.querySelector('[data-myeras-consent]')?.checked)throw new Error('Consent is required before reading sources.');
        const raw=form.querySelector('[data-myeras-json]')?.value.trim()||await selectedFile?.text();if(!raw)throw new Error('Choose a source file or paste source JSON.');
        if(raw.length>2*1024*1024)throw new Error('Structured import is limited to 2MB.');
        // Keep a real JSON source name; the intake file boundary explicitly recognizes this format.
        const file=new File([raw],selectedFile?.name||'myeras-sources.json',{type:'application/json'});Object.defineProperty(file,'myerasStructured',{value:true});
        const received=machine.receiveFile(file);if(!received.file)throw new Error(received.fileError||'Source file rejected.');machine.setConsent(true);await machine.startExtraction();return;
      }
      const resolve=event.target.closest?.('[data-myeras-resolve]');
      if(resolve){
        const {myerasCandidate:id,myerasResolve:conflictId,myerasChoice:index,myerasProfile:profile}=resolve.dataset;
        const fieldset=resolve.closest('[data-myeras-conflict]');const value=fieldset.querySelector('[data-myeras-correction]')?.value,reason=fieldset.querySelector('[data-myeras-reason]')?.value;
        if(profile==='true'){machine.dispatch({type:'MYERAS_PROFILE_REVIEW',id,choiceIndex:index==null?null:Number(index),value,reason});return;}
        const candidate=machine.snapshot().candidates.find(candidate=>candidate.id===id);const next=resolveMyerasConflict(candidate,conflictId,{choiceIndex:index==null?null:Number(index),value,reason});machine.editCandidate(id,next);return;
      }
      const duplicate=event.target.closest?.('[data-myeras-duplicate]');if(duplicate){const d=duplicate.dataset;resolveMyerasDuplicate(machine,d.myerasCandidate,d.myerasDuplicate,d.myerasDuplicateKind,d.myerasDuplicateChoice);return;}
      const decision=event.target.closest?.('[data-myeras-profile-decision]');if(decision)machine.dispatch({type:'MYERAS_PROFILE_REVIEW',id:decision.dataset.myerasClaim,decision:decision.dataset.myerasProfileDecision});
    }catch(err){error(event,err);}
  };
  const change=event=>{
    if(event.target.matches?.('[data-myeras-file]'))selectedFile=event.target.files?.[0]||null;
    if(event.target.matches?.('[data-myeras-profile-audience]'))machine.dispatch({type:'MYERAS_PROFILE_REVIEW',id:event.target.dataset.myerasProfileAudience,visibilityState:event.target.value});
  };
  root.addEventListener('click',click);root.addEventListener('change',change);
  return()=>{root.removeEventListener('click',click);root.removeEventListener('change',change);selectedFile=null;};
}
