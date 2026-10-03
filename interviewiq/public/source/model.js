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
