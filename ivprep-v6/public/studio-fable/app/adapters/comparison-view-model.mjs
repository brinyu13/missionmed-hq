// Presentation over fresh own-library membership and existing comparison/coaching
// owners. Admin selected-student review stays in the established Advanced owner.
import {buildLongitudinalModel} from '../../../studio/longitudinal-model.mjs';
import {buildComparisonSelection,buildTeachingComparison} from '../../../studio/presentation-view-model.mjs';
import {projectSavedAttempt,privatePlaybackUrl} from './saved-review.mjs';
export function ownComparisonSelection(library,subject,{currentId,baselineId=null}={}) {
  const rows=library?.source==='account'&&Array.isArray(library.sessions)?library.sessions:[],counts=new Map();
  for(const row of rows)if(row?.id)counts.set(row.id,(counts.get(row.id)||0)+1);
  const attempts=buildLongitudinalModel(rows.filter(row=>row.ownerSubject===subject&&counts.get(row.id)===1)).attempts;
  // The owner's convenience fallback must never substitute a disappearing reviewed answer.
  if(!attempts.some(a=>a.id===currentId))return {current:null,baseline:null,eligible:[],attempts};
  const selected=buildComparisonSelection(attempts,{currentId,baselineId});
  return {...selected,attempts,baseline:baselineId&&!selected.eligible.some(a=>a.id===baselineId)?null:selected.baseline};
}
export async function readOwnComparison(controller,{currentId,baselineId,isCurrent=()=>true}={}) {
  const account=controller.account,durable=controller.durable,subject=account?.subject;
  const current=()=>isCurrent()&&controller.account===account&&controller.durable===durable&&account?.subject===subject;
  if(!current()||!/^wp:[1-9][0-9]*$/.test(String(subject||'')))return null;
  const library=await controller.library({isCurrent:current});if(!current())return null;
  const selection=ownComparisonSelection(library,subject,{currentId,baselineId});
  if(!selection.current||!selection.baseline)return {selection,a:null,b:null,teaching:{available:false,reason:'SELECTED_ATTEMPTS_MISMATCH'}};
  const saved=await Promise.all([selection.baseline.id,selection.current.id].map(id=>controller.sessionDetail(id,{isCurrent:current})));
  if(!current())return null;
  const [a,b]=saved.map((value,index)=>{
    const projected=projectSavedAttempt(value,subject),expected=index===0?selection.baseline.id:selection.current.id;
    return projected?.id===expected?projected:null;
  });
  const teaching=buildTeachingComparison({baseline:a?.detail,current:b?.detail,subject,baselineId:selection.baseline.id,currentId:selection.current.id});
  return {selection,a,b,teaching};
}
export async function freshTeachingReplay(controller,{baselineId,currentId,sideKey,side,moment,pageUrl,isCurrent=()=>true}={}) {
  const account=controller.account,durable=controller.durable,subject=account?.subject;
  const current=()=>isCurrent()&&controller.account===account&&controller.durable===durable&&account?.subject===subject;
  if(!current()||!side||!['baseline','current'].includes(sideKey)||!moment?.available)return null;
  const pair=await readOwnComparison(controller,{baselineId,currentId,isCurrent:current});if(!current()||!pair?.teaching.available)return null;
  const fresh=pair.teaching[sideKey];
  const matches=fresh.moments.filter(value=>value.ref===moment.ref&&value.available&&value.startMs===moment.startMs&&value.endMs===moment.endMs);
  if(fresh.recordingId!==side.recordingId||fresh.sourceRecordingId!==side.sourceRecordingId||matches.length!==1)return null;
  const attempt=sideKey==='baseline'?pair.a:pair.b;
  const signed=await controller.playbackUrl(attempt,{isCurrent:current});if(!current())return null;
  const url=privatePlaybackUrl(signed,fresh.recordingId,pageUrl);
  return url?{url,at:matches[0].startMs/1000,sessionId:attempt.id,recordingId:fresh.recordingId}:null;
}
