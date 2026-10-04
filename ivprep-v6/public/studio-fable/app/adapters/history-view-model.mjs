// Presentation over the fresh own-library receipt. No new endpoint, subject grant,
// semantic inference, or second history store. Canonical history owns measurements.
import {buildLongitudinalModel} from '../../../studio/longitudinal-model.mjs';
const ownRows = (library,subject) => {
  if(!/^wp:[1-9][0-9]*$/.test(String(subject||'')) || library?.source!=='account')return [];
  const rows=Array.isArray(library.sessions)?library.sessions:[],counts=new Map();
  for(const row of rows)if(row?.id)counts.set(row.id,(counts.get(row.id)||0)+1);
  return rows.filter(row=>row?.id&&counts.get(row.id)===1&&row.ownerSubject===subject);
};
export function filterOwnAttempts(library,subject,{query='',evidence='all',mode='all'}={}) {
  const rows=new Map(ownRows(library,subject).filter(row=>row.state==='saved').map(row=>[row.id,row]));
  const needle=String(query).trim().toLowerCase();
  return (library?.attempts||[]).filter(a=>{
    const row=rows.get(a.id);if(!row || a.ownerSubject!==subject)return false;
    if(needle && ![row.questionId,row.questionText,row.title].filter(Boolean).join(' ').toLowerCase().includes(needle))return false;
    if(mode!=='all' && a.mode!==mode)return false;
    const history=row.answerHistory||{};
    if(evidence==='semantic')return Number(history.supportedObservationCount||0)>0;
    if(evidence==='transcript')return history.transcriptAvailable===true;
    if(evidence==='pending')return history.transcriptAvailable!==true;
    return true;
  }).sort((a,b)=>(b.at??-1)-(a.at??-1));
}
export function ownHistoryProgress(library,subject) {
  const rows=ownRows(library,subject),model=buildLongitudinalModel(rows);
  const mocks=filterOwnAttempts(library,subject).filter(a=>a.mode==='mock');
  const observed=mocks.filter(a=>['delivered','skipped','local','none'].includes(a.closing?.status));
  return {model,durationAvailable:model.attempts.some(a=>a.recordedMs!==null),closing:{reached:observed.filter(a=>['delivered','local'].includes(a.closing.status)).length,
    observed:observed.length,unverified:mocks.length-observed.length},
    unfinished:rows.filter(row=>row.state!=='saved'&&!['abandoned','ended'].includes(row.state))};
}
export function formatHistoryEvidence(value,unit) {
  if(value==null || !Number.isFinite(Number(value)))return 'Unavailable';
  if(unit==='ms')return (Number(value)/1000).toFixed(1)+' s';
  if(unit==='fraction')return (Number(value)*100).toFixed(Number(value)<.01?1:0)+'%';
  if(unit==='dBFS')return Number(value).toFixed(1)+' dBFS';
  return String(value);
}
