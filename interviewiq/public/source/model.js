// Read-only helpers extracted from approved Fable source. Authoritative mutations live on the server.
const ZONES=["America/New_York","America/Chicago","America/Denver","America/Los_Angeles","America/Phoenix","Europe/London","Asia/Kolkata","Asia/Manila","Africa/Lagos","UTC"];
const STAGES=['Offer','Identity','Research','Prepare','Rehearse','Day','Debrief','Learned'];
function zoneParts(date, zone){
  const dtf = new Intl.DateTimeFormat('en-US',{timeZone:zone,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const o={}; for(const p of dtf.formatToParts(date)) o[p.type]=p.value;
  if(o.hour==='24') o.hour='00';
  return o;
}

function wallString(date, zone){ const o=zoneParts(date,zone); return `${o.year}-${o.month}-${o.day}T${o.hour}:${o.minute}:00`; }

function zoneOffsetMinutes(date, zone){
  const o=zoneParts(date,zone);
  const asUTC=Date.UTC(+o.year,+o.month-1,+o.day,+o.hour,+o.minute,+o.second);
  return Math.round((asUTC - date.getTime())/60000);
}

function resolveWall(wall, zone){
  // wall "YYYY-MM-DDTHH:MM[:SS]" → candidate instants that round-trip to this wall in the zone
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(wall); if(!m) return [];
  const guess=Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],0);
  const offs=new Set();
  for(const d of [-86400000,-3600000,0,3600000,86400000]) offs.add(zoneOffsetMinutes(new Date(guess+d),zone));
  const out=[];
  for(const off of offs){
    const cand=new Date(guess-off*60000);
    if(wallString(cand,zone).slice(0,16)===wall.slice(0,16)) out.push({instant:cand.toISOString(), offset:off, label:fmtOffset(off)});
  }
  out.sort((a,b)=>a.instant<b.instant?-1:1);
  return out.filter((c,i,a)=>a.findIndex(x=>x.instant===c.instant)===i);
}

function fmtOffset(min){ const s=min<0?'−':'+'; const a=Math.abs(min); return `UTC${s}${String(Math.floor(a/60)).padStart(2,'0')}:${String(a%60).padStart(2,'0')}`; }

function fmtInZone(iso, zone, opts={}){
  if(!iso||!Number.isFinite(Date.parse(iso))) return 'unknown';
  const d=new Date(iso);
  const f=new Intl.DateTimeFormat('en-US',Object.assign({timeZone:zone,weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'},opts));
  return f.format(d);
}

function fmtDate(iso, zone){ if(!iso||!Number.isFinite(Date.parse(iso))) return 'unknown'; return new Intl.DateTimeFormat('en-US',{timeZone:zone,weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(new Date(iso)); }

function fmtTime(iso, zone){ if(!iso||!Number.isFinite(Date.parse(iso))) return 'unknown'; return new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(iso)); }

function fmtShort(iso){ if(!iso||!Number.isFinite(Date.parse(iso))) return 'unknown'; return new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric'}).format(new Date(iso)); }

function fmtStamp(iso, zone){ if(!iso||!Number.isFinite(Date.parse(iso))) return 'unknown'; return new Intl.DateTimeFormat('en-US',{timeZone:zone||F.student_zone,month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(iso)); }

function zoneShort(zone){ return String(zone||'UTC').replace('America/','').replace('_',' '); }

function researchState(i){
  if(!i.program) return {state:'waiting for identity', short:'Research is waiting for the exact program.', text:'Research waits for the exact program. Scheduling does not.'};
  const d=S.demands[i.id];
  if(!d) return {state:'missing', short:'No research request yet.', text:'No research demand yet.'};
  if(!S.online && d.status!=='available') return {state:'provider outage', short:'The research provider is down; your request will retry.', text:'The research provider is unavailable. Your offer and schedule are safe; this request will retry without creating a second job.'};
  const r=S.results[i.program];
  if(['queued','researching','review'].includes(d.status) && r && ['available','partial'].includes(r.status) && r.refreshed_at) return {state:r.status, shared:true, short:'Earlier findings are ready; a fresh check is '+d.status+'.', text:'Findings from '+fmtShort(r.refreshed_at)+' are available now from an earlier request for this program. This interview\'s own verification is '+d.status+' and will refresh them; no duplicate job.'};
  const map={queued:'Queued. One durable request for this interview; saving again reuses it.', researching:'Researching the fourteen required areas.', review:'Findings are in review. Nothing is shown as verified until reviewed.', available:'Available. Each fact keeps its own source and date.', partial:'Partial. Some areas remain unknown; retry will not duplicate work.', failed:'Failed. Retry is safe and idempotent.', 'provider outage':'Provider outage. Retry when restored.'};
  const shortMap={queued:'Research is queued.',researching:'Research is running.',review:'Findings are in review.',available:'Research is ready.',partial:'Research is partly ready.',failed:'Research failed; retry is safe.'};
  return {state:d.status, short:shortMap[d.status]||('Research is '+d.status+'.'), text:map[d.status]||d.status};
}

function sameProgramElsewhere(i, pid){ return S.interviews.find(x=>x.id!==i.id && x.owner===i.owner && x.saved && x.program===pid); }

function identityCandidates(i){
  const t=(i.unresolved_input||'').toLowerCase();
  const toks=t.replace(/[^a-z ]/g,' ').split(/\s+/).filter(w=>w.length>3 && !['medical','center','residency','internal','medicine','fictional','program','invitation','second','interview'].includes(w));
  const scored=F.programs.map(p=>{ const n=p.name.toLowerCase(); let sc=0; for(const w of toks){ if(n.includes(w)) sc++; if(w==='harbor'&&n.includes('harbour')) sc++; if(w==='harbour'&&n.includes('harbor')) sc++; } return {p,sc}; }).filter(x=>x.sc>0).sort((a,b)=>b.sc-a.sc);
  return scored.map(x=>x.p);
}

function sameDay(a,b,zone){ if(!a||!b) return false; return wallString(new Date(a),zone).slice(0,10)===wallString(new Date(b),zone).slice(0,10); }

// Full occupied windows, with uncertainty retained. Travel is the buffer before
// the later appointment; a related event never inherits interview duration.
function scheduleRelation(first,second){
  if(!first.instant||!second.instant){
    const bounds=x=>{
      if(x.instant){const start=Date.parse(x.instant);return [start,start+(x.duration??1440)*60000];}
      if(!x.date)return null;
      const zone=x.zone||F.student_zone,next=new Date(Date.parse(x.date+'T12:00Z')+86400000).toISOString().slice(0,10);
      const first=resolveWall(x.date+'T00:00',zone)[0],last=resolveWall(next+'T00:00',zone)[0];
      return first&&last?[Date.parse(first.instant),Date.parse(last.instant)+(x.duration??0)*60000]:null;
    };
    const a=bounds(first),b=bounds(second);
    return a&&b&&a[0]<b[1]&&b[0]<a[1]?{kind:'possible',reason:'A start time is unknown; the dates may overlap in their named timezones.'}:{kind:'unknown',reason:'Timing is incomplete.'};
  }
  const a=Date.parse(first.instant),b=Date.parse(second.instant);
  if(!Number.isFinite(a)||!Number.isFinite(b))return {kind:'unknown',reason:'Timing is incomplete.'};
  const [early,late,es,ls]=a<=b?[first,second,a,b]:[second,first,b,a];
  if(es===ls)return {kind:'overlap',reason:'Both start at the same moment.'};
  if(early.duration==null)return ls-es<=86400000?{kind:'possible',reason:'The earlier event has no known end time.'}:{kind:'unknown',reason:'The earlier event duration is unknown.'};
  const gap=(ls-es)/60000-early.duration;
  if(gap<0)return {kind:'overlap',reason:'The full event durations overlap.'};
  if(late.travel_minutes!=null && gap<late.travel_minutes)return {kind:'travel',reason:'Only '+gap+' minutes are available before the later event; its travel buffer is '+late.travel_minutes+' minutes.'};
  const needsTravel=![early.format,late.format].every(f=>['virtual','phone'].includes(f));
  if(needsTravel && late.travel_minutes==null && gap<1440)return {kind:'possible',reason:'The times do not overlap, but travel time or event format is unknown.'};
  return {kind:'none',reason:'No overlap in the supplied durations and travel buffer.'};
}
function scheduleEntries(list){
  const out=[];
  for(const i of list){
    if(!isInactive(i))out.push({...i,key:'iv-'+i.id,interview:i.id,label:title(i)});
    for(const e of i.related||[])if(e.status!=='cancelled')out.push({...e,key:'rel-'+i.id+'-'+e.id,owner:i.owner,interview:i.id,label:e.kind+' · '+title(i),duration:e.duration_minutes,travel_minutes:null,format:'unknown'});
  }
  return out;
}
function scheduleWarnings(list,interviewId=null){
  const entries=scheduleEntries(list),out=[];
  for(let a=0;a<entries.length;a++)for(let b=a+1;b<entries.length;b++){
    const first=entries[a],second=entries[b];
    if(first.owner!==second.owner || (interviewId && first.interview!==interviewId && second.interview!==interviewId))continue;
    const relation=scheduleRelation(first,second);
    if(['overlap','travel','possible'].includes(relation.kind))out.push({first,second,...relation});
  }
  return out;
}
function renderScheduleWarnings(list,interviewId=null){
  const warnings=scheduleWarnings(list,interviewId);
  return warnings.length?`<div class="panel amber pad" style="margin:.75rem 0" role="status"><h4>Schedule checks</h4><ul>${warnings.map(w=>`<li><b>${w.kind==='possible'?'Possible conflict':w.kind==='travel'?'Travel conflict':'Time conflict'}</b> · ${esc(w.first.label)} / ${esc(w.second.label)}: ${esc(w.reason)}</li>`).join('')}</ul><p class="tiny">Based on your saved times and estimates. Confirm changes with the programs; saving a record does not contact them.</p></div>`:'';
}
function relatedStatus(i,e){
  if(e.status==='cancelled')return 'Event cancelled. Its original timing is kept for recovery.';
  if(isInactive(i))return 'Interview is '+stateLabel(i)+'. This related event remains independently scheduled; check it with the program.';
  const comparison=scheduleRelation(i,{...e,duration:e.duration_minutes,travel_minutes:null,format:'unknown'});
  const dayNote=e.instant&&i.instant&&!sameDay(e.instant,i.instant,i.zone)?'On a different day from the interview. Check whether it moved with the interview. ':'';
  return dayNote+({overlap:'Time conflict: ',travel:'Travel conflict: ',possible:'Possible conflict: ',unknown:'Cannot establish a conflict: ',none:''}[comparison.kind])+comparison.reason;
}

function lifecycleStage(i){
  // 0 offer,1 identity,2 research,3 prepare,4 rehearse,5 day,6 debrief,7 learned
  const done=[], block=[]; let nowIdx=0;
  done.push(0);
  if(i.program) done.push(1); else { nowIdx=1; return {done,now:1,block:[]}; }
  const rs=researchState(i).state;
  if(['available','partial'].includes(rs)) done.push(2);
  const why=S.why[i.id]; if(why&&why.text) done.push(3);
  const pr=(S.practice[i.id]||[]); if(pr.some(a=>a.feedback)) done.push(4);
  const db=S.debriefs[i.id];
  if(isInactive(i)) return {done,now:null,block:[5]};
  if(i.instant && i.instant<=now()){ if(db&&db.occurrence==='no'){ return {done,now:null,block:[5]}; } done.push(5); if(db&&db.occurrence==='yes'){ if(db.saved) done.push(6); nowIdx = db.saved? 7 : 6; if(S.learning[i.owner]?.status==='confirmed' && db.saved) {done.push(7); nowIdx=7;} } else if(db&&db.occurrence==='no'){ return {done,now:null,block:[6]}; } else nowIdx=6; return {done,now:nowIdx,block}; }
  if(!done.includes(2) && rs!=='missing') nowIdx=2; else if(!done.includes(3)) nowIdx=3; else if(!done.includes(4)) nowIdx=4; else nowIdx=5;
  return {done,now:nowIdx,block};
}

function hoursUntil(i){ return i.instant? (new Date(i.instant)-new Date(now()))/3600000 : null; }

function hoursLabel(h){ if(h==null) return ''; if(h<48) return Math.round(h)+' hours away'; return Math.round(h/24)+' days away'; }

function nextMove(i){
  if(coreOnly())return {label:isInactive(i)?'Review saved status':i.instant?'Review interview details':'Add or update the date',act:'open-section',section:'schedule',why:isInactive(i)?'Its saved history is kept.':i.instant?fmtInZone(i.instant,i.zone)+' · confirm against your invitation.':'Save the date and time when the program provides them.',rank:isInactive(i)?60:i.instant&&i.instant>now()?1:i.instant?40:10};
  const h=hoursUntil(i);
  if(isInactive(i)) return {label:'Review this inactive interview', act:'open-section', section:'schedule', why:'This interview is inactive. Its exact disposition and history are kept; no attendance is inferred.', rank:60};
  const db=S.debriefs[i.id];
  if(i.instant && i.instant<=now()){
    if(db?.occurrence==='no') return {label:'Update the schedule if it was postponed', act:'open-section', section:'schedule', why:'You said it did not take place. No report exists.', rank:40};
    if(!db || db.occurrence==null || db.occurrence==='later') return {label:'Say whether it happened', act:'open-section', section:'debrief', why:'The scheduled time has passed. Nothing is recorded until you confirm.', rank:3};
    if(db.occurrence==='yes' && !db.saved) return {label:'Finish your two-minute capture', act:'open-section', section:'debrief', why:'Your draft is saved. Finish while it is fresh.', rank:5};
    const lg=S.learning[i.owner];
    if(db.occurrence==='yes' && db.saved && !lg) return {label:'Keep one thing for next time', act:'open-section', section:'learned', why:'Captured. Choose the one observation your next rehearsal should carry.', rank:7};
    if(db.occurrence==='yes' && db.saved && lg && lg.status!=='confirmed' && lg.status!=='revoked') return {label:'Confirm what you learned', act:'open-section', section:'learned', why:'A proposed goal applies only once you confirm it.', rank:7};
    return {label:'Review what you learned', act:'open-section', section:'learned', why: lg?.status==='confirmed'? 'Captured. Your next rehearsal carries your goal.' : 'Captured. No practice goal is active.', rank:50};
  }
  if(!i.program) return {label:'Confirm which program', act:'open-section', section:'identify', why:'The name on the invitation needs an exact program. Research starts the moment you confirm.', rank:4};
  const rs=researchState(i).state;
  const why=S.why[i.id], pr=S.practice[i.id]||[];
  if(h!=null && h<=36){
    if(!i.joinVerified) return {label:'Check how you join', act:'open-section', section:'day', why:hoursLabel(h)+'. Confirm the time and the joining details against the invitation.', rank:2};
    return {label:'One short rehearsal, then rest', act:'open-section', section:'rehearse', why:'Joining details checked. Say your closing once more; stop researching.', rank:2};
  }
  if(['queued','researching','review','provider outage','waiting for identity'].includes(rs) && !why?.text) return {label:'Draft your Why-Program points', act:'open-section', section:'why', why:researchState(i).short+' Your own experience is already available to prepare with.', rank:12};
  if(!why?.text) return {label:'Read the brief, then draft your Why', act:'open-section', section:'brief', why:'Research is ready: see what matters and what is uncertain before you write.', rank:10};
  const last=pr.filter(a=>a.feedback).slice(-1)[0];
  if(!last) return {label:'Rehearse one question', act:'open-section', section:'rehearse', why:'Your talking points are drafted. Try them against this program\'s question.', rank:11};
  if(!i.instant && !i.date) return {label:'Add the date when it arrives', act:'open-section', section:'schedule', why:'Prepared and rehearsed. No date yet; add it when the program sends one.', rank:20};
  const carry=last.nextChange||last.change;
  if(h!=null && h<=24*7) return {label:'Stop researching. Rehearse again.', act:'open-section', section:'rehearse', why:hoursLabel(h)+' and rehearsed once. Start from: '+carry, rank:9};
  return {label:'Rehearse again', act:'open-section', section:'rehearse', why:'Your last attempt left one change to try: '+carry, rank:15};
}

function rankedInterviews(list){
  return list.slice().sort((a,b)=>{ const ra=nextMove(a).rank, rb=nextMove(b).rank; if(ra!==rb) return ra-rb; const ta=a.instant||'9999', tb=b.instant||'9999'; return ta<tb?-1:1; });
}

function retryDelta(a){
  const before=a.diagnosis||[], after=a.retryDiagnosis||[];
  const fixed=before.filter(b=>!b.ok && !b.overruled && after.find(x=>x.k===b.k)?.ok).map(x=>x.k);
  const still=after.filter(x=>!x.ok && !x.overruled).map(x=>x.k);
  const names={outcome:'invented result', story:'your experience', fact:'program fact', closing:'closing sentence', empty:'empty'};
  return {fixed:fixed.map(k=>names[k]), still:still.map(k=>names[k])};
}

function dateKeyInZone(iso, zone){ return wallString(new Date(iso), zone||F.student_zone).slice(0,10); }

function ymOf(key){ return key.slice(0,7); }

function todayKey(){ return dateKeyInZone(now(), F.student_zone); }

function monthModel(ym){
  const [y,m]=ym.split('-').map(Number);
  const first=new Date(Date.UTC(y,m-1,1,12)); const firstWeekday=first.getUTCDay();
  const start=new Date(Date.UTC(y,m-1,1-firstWeekday,12));
  const days=[]; const tk=todayKey();
  for(let k=0;k<42;k++){ const d=new Date(start.getTime()+k*86400000); const key=d.toISOString().slice(0,10); days.push({key, label:String(d.getUTCDate()), outside:d.getUTCMonth()!==m-1, today:key===tk, weekday:d.getUTCDay(), fullLabel:new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(d)}); }
  return {ym, title:new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'long',year:'numeric'}).format(first), days};
}

function shiftYm(ym, n){ const [y,m]=ym.split('-').map(Number); const d=new Date(Date.UTC(y,m-1+n,1)); return d.toISOString().slice(0,7); }

function calendarItems(list){
  // every item carries its owner's interview; keys are in the student's zone; nothing is invented for date-only or undated items
  const out=[];
  for(const i of list){
    const base={interview:i.id, title:title(i), cancelled:isInactive(i)};
    if(i.instant) out.push(Object.assign({}, base, {id:'iv-'+i.id, key:dateKeyInZone(i.instant,F.student_zone), kind:isInactive(i)?'cancelled':'interview', time:fmtTime(i.instant,F.student_zone), sort:i.instant, sub:i.track||P(i.program)?.track||''}));
    else if(i.date) out.push(Object.assign({}, base, {id:'iv-'+i.id, key:i.date, kind:isInactive(i)?'cancelled':'interview', time:'time not set', sort:i.date+'T23:59', sub:i.track||P(i.program)?.track||''}));
    else out.push(Object.assign({}, base, {id:'iv-'+i.id, key:null, kind:'undated', time:'date unknown', sort:'9999', sub:i.program?P(i.program).track:'program to confirm'}));
    for(const e of (i.related||[])) out.push({id:'rel-'+i.id+'-'+e.id, interview:i.id, title:(e.status==='cancelled'?'Cancelled · ':'')+e.kind+' · '+title(i), key:e.instant?dateKeyInZone(e.instant,F.student_zone):e.date, kind:'related', cancelled:e.status==='cancelled', time:e.instant?fmtTime(e.instant,F.student_zone):'time not set', sort:e.instant||e.date+'T23:59', sub:(e.status==='cancelled'?'cancelled · ':'')+(e.duration_minutes==null?'duration unknown':e.duration_minutes+' min')});
    if(i.deadline && !isInactive(i)) out.push({id:'dl-'+i.id, interview:i.id, title:'Scheduling deadline · '+title(i), key:i.deadline, kind:'deadline', time:'deadline', sort:i.deadline+'T00:00', sub:'reply to the program'});
  }
  return out.sort((a,b)=>a.sort<b.sort?-1:1);
}

function itemsByDay(list){ const by={}; for(const it of calendarItems(list)){ if(!it.key) continue; (by[it.key]=by[it.key]||[]).push(it); } return by; }

function weekRange(){ const t=new Date(now()); const a=t.getTime(), b=a+7*86400000; return [new Date(a).toISOString(), new Date(b).toISOString()]; }

function interviewsThisWeek(list){ const [a,b]=weekRange(); return list.filter(i=>i.instant && i.instant>=a && i.instant<b && !isInactive(i)); }

function awaitingCapture(list){ return list.filter(i=>i.instant && i.instant<=now() && !isInactive(i) && !(S.debriefs[i.id]?.saved) && S.debriefs[i.id]?.occurrence!=='no'); }

// LOI revisions remain server-owned; these helpers only hold the student's current tab draft.
const loiFormNames=['text','whyNow','applicationState','interviewState','motivations','facts','factual','specific','source-verified'];
function loiFormIds(id){return loiFormNames.map(k=>'loi-'+k+'-'+id);}
function loiState(i){return loiEnabled()&&ownsLoiSubject(i)?(i.targetKind==='program'?loiTargetRow(i.id)?.loi:S.loi?.[i.id])||{history:[],outreach:[],current:null,currentBindingValid:false}:{history:[],outreach:[],current:null,currentBindingValid:false};}
function loiHeadData(i){const h=loiState(i).current;return{letterId:h?.letterId||null,expectedHead:h?.revisionId||null,expectedLetterVersion:h?.letterVersion||0};}
function loiConfirmed(id){return document.getElementById(id)?.checked??pendingDraft(id,false)===true;}
function loiList(i,kind,text,confirmed){return text.split('\n').map(x=>x.trim()).filter(Boolean).map(text=>{const key=loiMemoryKey(i)+':'+kind+':'+text;let id=loiState(i).current?.[kind]?.find(x=>x.text===text)?.id||loiInputIds.get(key);if(!id){id=crypto.randomUUID();loiInputIds.set(key,id);}return{id,text,confirmed};});}
function loiSelections(i){const e=loiEvidence.get(loiMemoryKey(i))?.research;return(e?.facts||[]).filter((f,k)=>loiConfirmed('loi-evidence-'+k+'-'+i.id)).map(f=>({field:f.field,claimRef:f.claimRef}));}
function loiDraftData(i){const factual=loiConfirmed('loi-factual-'+i.id),specific=loiConfirmed('loi-specific-'+i.id);return{...loiHeadData(i),text:val('loi-text-'+i.id),context:Object.fromEntries(['whyNow','applicationState','interviewState'].map(k=>[k,val('loi-'+k+'-'+i.id)])),motivations:loiList(i,'motivations',val('loi-motivations-'+i.id),factual),facts:loiList(i,'facts',val('loi-facts-'+i.id),factual),selectedEvidence:loiSelections(i),studentFactualConfirmation:factual,studentSpecificityConfirmation:specific};}
function loiEdited(i){const h=loiState(i).current;if(!h)return true;return['text','whyNow','applicationState','interviewState','motivations','facts'].some(k=>{const expected=k==='text'?h.text||'':['motivations','facts'].includes(k)?(h[k]||[]).map(x=>x.text).join('\n'):h.context?.[k]||'';return val('loi-'+k+'-'+i.id)!==expected;});}
function loiExternalURL(value,kind,handoff){if(typeof value!=='string'||/[\u0000-\u0020\u007f]/.test(value))throw Error('The compose address is unavailable. Copy the letter instead.');const u=new URL(value);if(kind==='gmail'){if(u.origin!=='https://mail.google.com'||u.pathname!=='/mail/'||u.username||u.password||u.hash||u.searchParams.get('view')!=='cm'||u.searchParams.get('fs')!=='1'||[...u.searchParams.keys()].some(k=>!['view','fs','to','su','body'].includes(k)))throw Error('The Gmail compose address is unavailable. Copy the letter instead.');}else if(u.protocol!=='mailto:'||[...u.searchParams.keys()].some(k=>!['subject','body'].includes(k)))throw Error('The mail compose address is unavailable. Copy the letter instead.');if(handoff){if(kind==='gmail'){if(u.searchParams.get('to')!==handoff.recipient||u.searchParams.get('su')!==handoff.subject||(!handoff.copyOnly&&u.searchParams.get('body')!==handoff.text))throw Error('Compose content changed. Prepare the reviewed handoff again.');}else if(decodeURIComponent(u.pathname)!==handoff.recipient||u.searchParams.get('subject')!==handoff.subject||u.searchParams.get('body')!==handoff.text||u.hash)throw Error('Compose content changed. Prepare the reviewed handoff again.');}return value;}

function loiHandoffBinding(i){const state=loiState(i);return i.targetKind==='program'?JSON.stringify([actor?.id,actor?.role,loiSubjectBinding(i),state.current,state.currentBindingValid,state.currentConsentValid??null]):JSON.stringify([actor?.id,actor?.role,i.id,i.owner,i.program,state.current,state.currentBindingValid,state.currentConsentValid??null]);}

// A program target is a separate signed owner projection, never a Calendar interview.
function loiTargetRow(id){return loiTargetsEnabled()?(S.loiTargets?.targets||[]).find(t=>t.targetKind==='program'&&t.targetId===id):null;}
function loiTargetSubject(id){const t=loiTargetRow(id);return t?{targetKind:'program',id:t.targetId,program:t.program?.id||null,programName:t.program?.name||t.programName||'',track:t.program?.track||'',registryReleaseId:t.program?.registryReleaseId||null,choice:t.choice,targetVersion:t.version,resolutionState:t.resolutionState}:null;}
function loiMemoryKey(i){return i?.targetKind==='program'?'program:'+i.id:i.id;}
function loiSubjectBinding(i){return JSON.stringify([actor?.id,i?.targetKind||'interview',i?.id,i?.program,i?.programName,i?.track,i?.registryReleaseId,i?.choice]);}
function ownsLoiSubject(i){if(i?.targetKind!=='program')return owns(i);const current=loiTargetSubject(i.id);return !!current&&loiSubjectBinding(current)===loiSubjectBinding(i);}
function loiSubject(el){if(el.dataset.targetKind==='program'){const i=loiTargetSubject(el.dataset.id);if(!i)throw Error('This program letter target is unavailable.');return i;}return iv(el);}
function loiSubjectCommand(i,name,data={},options={}){if(!ownsLoiSubject(i))throw Error('This letter context changed. Reopen the intended target.');return i.targetKind==='program'?command(name,null,data,{...options,targetKind:'program',targetId:i.id}):command(name,i.id,data,options);}
function loiTargetCommand(name,id,data={},options={}){if(!loiTargetsEnabled())throw Error('Program letters are unavailable.');return command(name,null,data,{...options,targetKind:'program',targetId:id});}
function currentSavedPage(){return loiTargetsEnabled()?(loiSavedPage?.actorId===actor.id&&loiSavedPage.epoch===loiAuthorityEpoch?loiSavedPage.response:S.loiTargets?.savedPrograms):null;}
function loiLetterStatus(i){const h=loiState(i),head=h.current;return head&&h.outreach?.some(x=>x.revisionId===head.revisionId&&x.state==='self_reported_sent')?'Sent (self-reported)':head?.state==='approved'?'Approved':head?'Draft':'Not started';}
function loiProgramGroups(){
 const groups=new Map(),add=(key,label,kind,value)=>{if(!groups.has(key))groups.set(key,{key,label,interviews:[],targets:[],saved:[]});groups.get(key)[kind].push(value);};
 for(const i of myInterviews())add(i.program?'canonical:'+i.program:'interview:'+i.id,i.programName||title(i),'interviews',i);
 if(loiTargetsEnabled()){
  for(const t of S.loiTargets?.targets||[]){const ref=t.sources?.find(s=>s.source==='RISE_SAVED')?.programRef;add(t.program?'canonical:'+t.program.id:ref?'saved-ref:'+ref:'target:'+t.targetId,t.program?.name||t.programName||(ref?'Unresolved program reference: '+ref:'Unresolved program'),'targets',t);}
  for(const s of currentSavedPage()?.records||[])add(s.identityState==='CANONICAL'?'canonical:'+s.program.id:'saved-ref:'+s.programRef,s.program?.name||'Unresolved program reference: '+s.programRef,'saved',s);
 }
 return [...groups.values()];
}

// Private proposal state is memory-only and bound to the signed actor and selected letter.
const LOI_APPROACHES=[['WARM_PERSONAL','Warm + Personal','Begin with your genuine reason, then connect supported program details.'],['DIRECT_CONCISE','Direct + Concise','Lead with your current purpose and keep the structure direct.'],['ACADEMIC_PROGRAM','Academic + Program-Specific','Lead with supported training details and your confirmed interests.'],['POST_INTERVIEW','Post-Interview Reflective','Reflect only on an interview you explicitly confirm occurred.'],['UPDATE_LED','Update-Led','Lead with an actual update you explicitly confirm.'],['STRONG_INTEREST','Strong Interest','Lead with your interest without inventing ranking promises.']];
function clearLoiCompositionMemory(){loiCompositionEpoch++;loiProposals.clear();loiCompositionBusy.clear();loiCompositionUncertain.clear();loiCompositionView=null;if(S?.ui)delete S.ui.loiStyleChoice;if(S?.ui?.drawer?.kind==='loi-style')S.ui.drawer=null;for(const key of draftValues.keys())if(key.split('::').pop().startsWith('loi-composition-'))draftValues.delete(key);for(const key of pendingCommands.keys())if(LOI_COMPOSITION_COMMANDS.has(JSON.parse(key)[1]))pendingCommands.delete(key);}
function compositionViewKey(){if(!S)return null;const i=S.ui.loiTargetOpen?loiTargetSubject(S.ui.loiTargetOpen):S.interviews.find(x=>x.id===S.ui.open);return JSON.stringify([S.ui.route,S.ui.loiTargetOpen||S.ui.open||null,S.ui.section||null,i?loiSubjectBinding(i):null]);}
function syncLoiCompositionView(){if(!loiCompositionEnabled()){if(loiProposals.size||loiCompositionBusy.size)clearLoiCompositionMemory();return;}const key=compositionViewKey();if(loiCompositionView!==key){clearLoiCompositionMemory();loiCompositionView=key;}}
function ownComposition(i){if(!loiCompositionEnabled()||!ownsLoiSubject(i)||i.targetKind==='program'&&i.choice!=='CREATE_LETTER')throw Error('Composition is unavailable for this letter.');return i;}
function compositionAuthority(i){ownComposition(i);return {actorId:actor.id,epoch:loiCompositionEpoch,loiEpoch:loiAuthorityEpoch,view:compositionViewKey(),subject:loiSubjectBinding(i)};}
function compositionStillCurrent(a,i){return actor?.id===a.actorId&&loiCompositionEpoch===a.epoch&&loiAuthorityEpoch===a.loiEpoch&&loiCompositionEnabled()&&ownsLoiSubject(i)&&compositionViewKey()===a.view&&loiSubjectBinding(i.targetKind==='program'?loiTargetSubject(i.id):S.interviews.find(x=>x.id===i.id))===a.subject&&(i.targetKind!=='program'||i.choice==='CREATE_LETTER');}
function compositionApproach(i){const h=loiState(i).current;return pendingDraft('loi-composition-approach-'+i.id,h?.compositionApproach||(h?'DIRECT_CONCISE':S.loiPreferences?.defaultApproach||'DIRECT_CONCISE'));}
function compositionLabel(a){return LOI_APPROACHES.find(x=>x[0]===a)?.[1]||'Approach unavailable';}
function compositionProposal(i){const p=loiProposals.get(loiMemoryKey(i));return p&&p.subjectBinding===loiSubjectBinding(i)?p:null;}
function compositionHeadMatches(i,g){const h=loiHeadData(i),b=g.baseHead;return !!b&&Object.keys(b).sort().join()==='expectedHead,expectedLetterVersion,letterId'&&h.letterId===b.letterId&&h.expectedHead===b.expectedHead&&h.expectedLetterVersion===b.expectedLetterVersion;}
function readCompositionGeneration(i,g){
 if(g===null)return null;const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
 const keys=['generationId','status','reason','proposals','approaches','baseHead','subject','provenance','factualGuard','compositionMode','currentEvidenceState','usage','studentReviewRequired'];if(!g||Object.keys(g).some(k=>!keys.includes(k))||!uuid.test(g.generationId)||!['PROPOSED','STANDARD_FALLBACK','RESERVED','OUTCOME_UNKNOWN'].includes(g.status)||g.studentReviewRequired!==true||Object.hasOwn(g,'compositionMode')&&!['reference','prose'].includes(g.compositionMode)||g.status==='STANDARD_FALLBACK'&&g.compositionMode==='prose'||(g.compositionMode==='prose'&&g.status==='PROPOSED'?!['PROSE_TRACED_CLAIMS_V2','PROSE_INDEPENDENT_CHECK_V3','PROSE_LOCAL_SPANS_V4','PROSE_AUTHORED_REVIEW_V5'].includes(g.factualGuard):g.factualGuard!=='REFERENCE_ONLY')||g.currentEvidenceState!=='RECHECK_REQUIRED')throw Error('Saved proposals did not match the reviewed letter contract.');
 const subj=i.targetKind==='program'?{targetKind:'program',targetId:i.id}:{interviewId:i.id};if(!g.subject||Object.keys(g.subject).sort().join()!==Object.keys(subj).sort().join()||Object.keys(subj).some(k=>g.subject[k]!==subj[k]))throw Error('Saved proposals belong to another letter.');
 if(!g.baseHead||Object.keys(g.baseHead).sort().join()!=='expectedHead,expectedLetterVersion,letterId'||!Number.isSafeInteger(g.baseHead.expectedLetterVersion)||g.baseHead.expectedLetterVersion<0||g.baseHead.letterId!==null&&!uuid.test(g.baseHead.letterId)||g.baseHead.expectedHead!==null&&!uuid.test(g.baseHead.expectedHead))throw Error('Saved proposal head binding is invalid.');
 const p=g.provenance;if(!p?.program||p.program.id!==i.program||p.program.name!==i.programName||p.program.track!==(i.track||'')||i.targetKind==='program'&&p.program.registryReleaseId!==i.registryReleaseId||!Array.isArray(p.factualSpans)||p.factualSpans.length>85||p.factualSpans.some(r=>!r||typeof r.ref!=='string'||r.ref.length>100||typeof r.text!=='string'||r.text.length>4000))throw Error('Saved proposal provenance changed or is unavailable.');
 if(g.compositionMode==='prose'&&g.status==='PROPOSED'){const q=p.evidenceQualification;if(!q||Object.keys(q).sort().join()!=='claimDigests,contract'||q.contract!=='SOURCE_PINNED_CLAIM_REVIEW_V1'||!Array.isArray(q.claimDigests)||q.claimDigests.length!==p.factualSpans.filter(r=>r.kind==='evidence').length||!q.claimDigests.length||q.claimDigests.some(h=>typeof h!=='string'||!/^[a-f0-9]{64}$/.test(h)))throw Error('Program evidence needs claim-level source review.');}
 if(!Array.isArray(g.approaches)||![1,3].includes(g.approaches.length)||new Set(g.approaches).size!==g.approaches.length||g.approaches.some(a=>!LOI_APPROACHES.some(x=>x[0]===a))||!Array.isArray(g.proposals)||g.proposals.length>3||(['PROPOSED','STANDARD_FALLBACK'].includes(g.status)?g.proposals.length!==g.approaches.length:g.proposals.length!==0))throw Error('Saved proposal count or approaches are invalid.');
 for(const [k,c] of g.proposals.entries()){if(c.approach!==g.approaches[k]||typeof c.text!=='string'||!c.text.trim()||c.text.length>20000||c.studentReviewRequired!==true||c.studentFactualConfirmation!==false||c.studentSpecificityConfirmation!==false||g.compositionMode!=='prose'&&(!Array.isArray(c.blocks)||c.blocks.length>100))throw Error('A saved proposal needs a compatible review contract.');if(g.compositionMode==='prose'){if(g.status!=='PROPOSED'||Object.keys(c).sort().join()!==(g.factualGuard==='PROSE_INDEPENDENT_CHECK_V3'?'approach,claims,fitLinks,studentFactualConfirmation,studentReviewRequired,studentSpecificityConfirmation,text,verification':g.factualGuard==='PROSE_AUTHORED_REVIEW_V5'?'approach,claims,fitLinks,review,studentFactualConfirmation,studentReviewRequired,studentSpecificityConfirmation,text':'approach,claims,fitLinks,studentFactualConfirmation,studentReviewRequired,studentSpecificityConfirmation,text'))throw Error('A saved prose proposal needs exact factual traces.');const row={approach:c.approach,text:c.text,claims:c.claims,fitLinks:c.fitLinks};if(g.factualGuard==='PROSE_AUTHORED_REVIEW_V5'){const reviewed=validateAuthoredTrace(row,p.factualSpans,p.program).review;if(JSON.stringify(reviewed)!==JSON.stringify(c.review))throw Error('Authored semantic review is unavailable.');}else if(g.factualGuard==='PROSE_INDEPENDENT_CHECK_V3')validateProseVerification(row,p.factualSpans,c.verification,p.program,k);else if(g.factualGuard==='PROSE_LOCAL_SPANS_V4')validateLocalProseTrace(row,p.factualSpans,p.program);else validateLegacyProseTrace(row,p.factualSpans);}}
 return clone(g);
}
function compositionRequestData(i,count){const d=loiDraftData(i),approach=compositionApproach(i);if(!d.studentFactualConfirmation||!d.context.whyNow.trim()||!d.context.applicationState.trim()||!d.context.interviewState.trim()||!d.motivations.length)throw Error('Confirm your facts, genuine reasons and current Why Now/status context first.');const e=loiEvidence.get(loiMemoryKey(i))?.research?.facts||[];if(!d.selectedEvidence.length||d.selectedEvidence.some(s=>!e.some(f=>f.state==='SUPPORTED'&&f.field===s.field&&f.claimRef===s.claimRef)))throw Error('RESEARCH NEEDED: select current supported program evidence before composition.');
 const approaches=count===3?LOI_APPROACHES.filter((a,k)=>loiConfirmed('loi-composition-compare-'+k+'-'+i.id)).map(a=>a[0]):[approach];if(count===3&&approaches.length!==3)throw Error('Choose exactly three approaches for SHOW ME 3.');if(approaches.includes('POST_INTERVIEW')&&!loiConfirmed('loi-composition-post-'+i.id))throw Error('Confirm that the interview occurred before choosing Post-Interview Reflective.');if(approaches.includes('UPDATE_LED')&&(!loiConfirmed('loi-composition-update-'+i.id)||!d.facts.length))throw Error('Confirm an actual update in your student facts before choosing Update-Led.');return {...loiHeadData(i),context:d.context,contextConfirmed:true,motivations:d.motivations,facts:d.facts,selectedEvidence:d.selectedEvidence,count,...(count===1?{approach}:{approaches}),...(approaches.includes('POST_INTERVIEW')?{postInterviewConfirmed:true}:{}),...(approaches.includes('UPDATE_LED')?{updateConfirmed:true}:{})};
}

const MYERAS_EXPORT_PROMPT="# IV IQ \u2014 MYERAS APPLIED PROGRAM EXPORT\n\nI am preparing my residency Letter of Interest program list for\nMissionMed IV IQ.\n\nYour task is READ-ONLY.\n\nHelp me export a structured list of residency programs I have already\napplied to in MyERAS.\n\nIMPORTANT SAFETY RULES:\n\n1.  Do NOT ask me to tell you, paste, dictate, upload, or reveal my\n    MyERAS password.\n2.  I will log into MyERAS myself when authentication is required.\n3.  Do NOT change anything in MyERAS.\n4.  Do NOT apply, withdraw, add/remove programs, change signals, submit,\n    certify, rank, send messages, change profile information, change\n    documents, change preferences, modify an application, or click any\n    final confirmation that changes application/account state.\n5.  This task is READ ONLY.\n6.  Access only the minimum MyERAS area necessary to identify programs I\n    already applied to.\n\nWORKFLOW:\n\nA. Open MyERAS.\n\nB. If I am not logged in, stop and ask me to log in myself.\n\nC. After I confirm login, navigate to the area showing residency\nprograms/applications I submitted/applied to.\n\nD. Read the complete applied-program list.\n\nE. For each program collect ONLY information actually displayed and\nuseful for identification.\n\nPreferred fields:\n\nprogram_name specialty track institution city state program_identifier\napplication_status signal_status interview_status source exported_at\n\nRules:\n\n-   source = MYERAS\n-   exported_at = export date/time\n-   unknown fields remain blank\n-   do not guess\n-   do not invent identifiers\n-   do not infer interview status from unrelated information\n-   preserve program names as displayed\n-   include every applied program shown\n\nF. Before file creation say:\n\n\"Found \\[N\\] applied programs. Ready to create your IV IQ import file.\"\n\nG. Create UTF-8 CSV named exactly:\n\nMYERAS_APPLIED_PROGRAMS.csv\n\nwith exact header:\n\nprogram_name,specialty,track,institution,city,state,program_identifier,application_status,signal_status,interview_status,source,exported_at\n\nH. Validate: - one row per applied program; - no accidental duplicate\nrows; - CSV opens correctly; - source is MYERAS; - unknowns remain blank\nrather than guessed.\n\nI. Give me the completed file.\n\nDo NOT perform any other MyERAS action.\n\nWhen complete say:\n\n\"Your IV IQ program file is ready. Return to IV IQ and upload\nMYERAS_APPLIED_PROGRAMS.csv in the import window.\"\n";
const MYERAS_CSV_HEADER="program_name,specialty,track,institution,city,state,program_identifier,application_status,signal_status,interview_status,source,exported_at";

let myerasEpoch=0,myerasFlow=null;
const myerasEnabled=()=>loiTargetsEnabled()&&capabilities.myerasImport===true;
const MYERAS_COMMANDS=new Set(['myeras.preview','myeras.import']);
function clearMyerasMemory(){myerasEpoch++;myerasFlow=null;if(S?.ui?.drawer?.kind==='myeras')S.ui.drawer=null;for(const key of pendingCommands.keys())if(MYERAS_COMMANDS.has(JSON.parse(key)[1]))pendingCommands.delete(key);}
function requireMyerasAccess(){if(!myerasEnabled()||studentPreview()||actor?.role!=='student')throw Error('MyERAS import is unavailable for this workspace.');}
function myerasAuthority(){return {actor:actor?.id,epoch:myerasEpoch,loiEpoch:loiAuthorityEpoch,flow:myerasFlow};}
function currentMyerasAuthority(a){return a.actor===actor?.id&&a.epoch===myerasEpoch&&a.loiEpoch===loiAuthorityEpoch&&a.flow===myerasFlow&&myerasEnabled()&&!studentPreview();}
function validateMyerasPreview(input){
 const text=(s,n)=>typeof s==='string'&&s.length<=n,plain=x=>x&&Object.getPrototypeOf(x)===Object.prototype,hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
 if(!plain(input)||input.schema!=='iiq-myeras-review-v1'||!hex(input.previewDigest)||!Array.isArray(input.rows)||input.rows.length>2000||!plain(input.counts)||input.evidenceState!=='UNKNOWN')throw Error('The authoritative import review is unavailable.');
 const keys=new Set();for(const r of input.rows){if(!plain(r)||!hex(r.rowKey)||keys.has(r.rowKey)||!plain(r.original)||!text(r.original.program_name,500)||!['MATCHED','NEEDS_CONFIRMATION','NOT_FOUND'].includes(r.resolutionState)||!['CREATE_LETTER','MAYBE_LATER','SKIP'].includes(r.choice)||!Array.isArray(r.candidates)||r.candidates.length>40||typeof r.lookupComplete!=='boolean')throw Error('The authoritative import review is invalid.');keys.add(r.rowKey);const columns=MYERAS_CSV_HEADER.split(',');if(Object.keys(r.original).length!==columns.length||!columns.every(k=>Object.hasOwn(r.original,k)&&text(r.original[k],2000))||r.original.source!=='MYERAS')throw Error('The original import fields are invalid.');if(r.existingTarget&&(!plain(r.existingTarget)||!Number.isSafeInteger(r.existingTarget.version)||r.existingTarget.version<1||!['CREATE_LETTER','MAYBE_LATER','SKIP'].includes(r.existingTarget.choice)))throw Error('The existing target version is invalid.');for(const p of [...r.candidates,...(r.program?[r.program]:[])])if(!plain(p)||!text(p.id,180)||!text(p.name,500)||!text(p.track,300)||!text(p.registryReleaseId,180))throw Error('The canonical review is invalid.');if(r.resolutionState==='MATCHED'&&(!r.program||!r.lookupComplete))throw Error('A partial lookup cannot identify a unique program.');}
 const c=input.counts;for(const k of ['imported','unique','duplicates','MATCHED','NEEDS_CONFIRMATION','NOT_FOUND'])if(!Number.isSafeInteger(c[k])||c[k]<0||c[k]>2000)throw Error('The import counts are invalid.');if(c.imported!==c.unique+c.duplicates||c.unique!==input.rows.length||c.MATCHED!==input.rows.filter(r=>r.resolutionState==='MATCHED').length||c.NEEDS_CONFIRMATION!==input.rows.filter(r=>r.resolutionState==='NEEDS_CONFIRMATION').length||c.NOT_FOUND!==input.rows.filter(r=>r.resolutionState==='NOT_FOUND').length)throw Error('The import counts do not match this review.');return input;
}
function downloadMyerasFile(name,text,type){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);}

// MissionMed General → Details → optional Personal. Private, tab-memory drafts only.
const THREEBOX_CATEGORIES=['Didactics','Fellowship opportunities','Exposure','Location','Research','Resident feedback','Teaching opportunities','Faculty / leadership','Program-specific opportunity'];
function threeboxBinding(i){return JSON.stringify([actor?.id,i.id,i.program,i.programName,i.track]);}
function threeboxForm(i){
  requireOwn(i);if(!threeboxEnabled())throw Error('Three-Box access is unavailable.');
  let d=threeboxDrafts.get(i.id);if(!d){const w=S.why[i.id],h=w?.threebox?.current;d={binding:threeboxBinding(i),expectedHead:h?.revisionId??null,expectedAnswerVersion:h?.answerVersion??0,reasons:clone(h?.reasons||[]).map(r=>({...r,intel:(r.intel||[]).map(x=>({id:x.id,speaker:x.speaker,role:x.role,text:x.text,confirmed:x.confirmed}))})),delivery:h?.delivery||'STANDARD',factualConfirmed:false,specificityConfirmed:false,locationException:false,editedAnswer:w?.text||'',edited:false,serial:0,status:''};threeboxDrafts.set(i.id,d);}return d;
}
function threeboxTouch(d){d.serial++;d.factualConfirmed=false;d.specificityConfirmed=false;for(const key of ['factualConfirmed','specificityConfirmed']){const el=document.querySelector('[data-tb-field="'+key+'"]');if(el)el.checked=false;}}
function threeboxNewReason(d){if(d.reasons.length>=8)throw Error('Keep at most eight candidates; focus on your best proof.');d.reasons.push({id:crypto.randomUUID(),general:{category:THREEBOX_CATEGORIES[0]},details:[],personal:{enabled:false,text:'',confirmed:false},selected:false,rank:d.reasons.length+1,followUpDefense:'',intel:[]});threeboxTouch(d);}
function threeboxDetailText(value){if(value===null)return '';if(typeof value!=='object')return String(value);if(Array.isArray(value))return value.map(threeboxDetailText).join('; ');return Object.entries(value).map(([key,x])=>key.replaceAll('_',' ')+': '+threeboxDetailText(x)).join('; ');}
function threeboxPayload(i){const d=threeboxForm(i);return {expectedHead:d.expectedHead,expectedAnswerVersion:d.expectedAnswerVersion,reasons:clone(d.reasons),delivery:d.delivery,factualConfirmed:d.factualConfirmed,specificityConfirmed:d.specificityConfirmed,locationException:d.locationException,...(d.edited?{editedAnswer:d.editedAnswer}:{})};}

function threeboxFieldLabel(field){return ({'research.program_overview':'Program overview','research.visa':'Visa policy','research.application_requirements':'Application requirements','research.resident_roster':'Resident roster','research.resident_medical_schools':'Resident medical schools','research.img_accessibility':'IMG representation','research.do_accessibility':'DO representation','research.usmd_accessibility':'US MD representation','research.caribbean_accessibility':'Caribbean graduate representation','research.leadership':'Program leadership','research.core_faculty':'Core faculty','research.faculty_training_graph':'Faculty training and retention','research.abim':'Board pass rate','research.fellowship_inventory':'In-house fellowships','research.outcomes':'Graduate outcomes','research.salary_benefits':'Salary and benefits','research.curriculum':'Curriculum','research.research_opportunities':'Research opportunities','research.program_differentiators':'Program differentiators','research.culture':'Resident experience','research.facilities_patient_population':'Training sites and patient population'})[field]||'Program detail';}
