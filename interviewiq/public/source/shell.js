'use strict';
/* ============================================================
   IIQ-1100 shell: StoryForge V5 renderShell grammar (rail + header + banner),
   Home hero, Calendar (Matrix Calendar V2 grammar), Interviews room, Prepare,
   Program Intelligence (RISE envelope), Debriefs, Growth, Settings, role surfaces.
   ============================================================ */
const hdr=()=>document.getElementById('hdr');
const rail=()=>document.getElementById('rail');
const advBanner=()=>document.getElementById('advBanner');
const drawerEl=()=>document.getElementById('drawer');

function roleName(){ return studentPreview()?'student':actor.role; }
function firstName(){ return actor.firstName||actor.first_name||(actor.displayName||actor.display_name||'Student').split(/\s+/)[0]; }
function initials(){ return (actor.displayName||actor.display_name||firstName()).split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase(); }
function viewLabel(){ return roleName()==='admin'?'Administrator View':roleName()==='mentor'?'Mentor View':'Student View'; }
function greetingWord(){ const h=+zoneParts(new Date(now()),F.student_zone).hour; return h<12?'Good morning':h<18?'Good afternoon':'Good evening'; }

const NAV={
  student:[['home','Home','Home'],['calendar','Calendar','Cal'],['interviews','Interviews','Ivs'],['prepare','Prepare','Prep'],['intel','Program Intelligence','Intel'],['debriefs','Debriefs','Debrief'],['growth','Growth','Growth'],['settings','Settings','Me']],
  mentor:[['home','Home','Home'],['mentor','Mentor Command','Mentor'],['mentorcal','Students’ calendar','Cal'],['settings','Settings','Me']],
  admin:[['home','Admin Home','Home'],['review','Research Review','Review'],['policy','Policy','Policy'],['settings','Settings','Me']]
};
function navItems(){
  const r=roleName(); let items=NAV[r].slice();
  if(r==='student'&&(loiEnabled()||studentPreview()))items.splice(3,0,['letters','Letters of Interest','My Letters']);
  if(r==='student' && (capabilities.contributions===true||coreOnly())) items.splice(5,0,['contribute','Research access','Access']);
  return items;
}
function badgeFor(route){
  if(roleName()!=='student') return 0;
  if(route==='calendar') return interviewsThisWeek(myInterviews()).length;
  if(route==='debriefs') return awaitingCapture(myInterviews()).length;
  if(route==='interviews') return myInterviews().filter(i=>!i.program && !isInactive(i)).length;
  return 0;
}
function railNavButton([route,label,short]){
  const active=S.ui.route===route;
  const b=badgeFor(route);
  return `<button type="button" data-act="nav" data-to="${route}" class="rtab ${active?'on':''} ${['intel','growth','contribute'].includes(route)?'secondary':''}" ${active?'aria-current="page"':''} aria-label="${esc(label)}"><span class="rtl">${esc(label)}${coreOnly()&&!coreRoute(route)?comingSoonBadge():''}</span><span class="rts" aria-hidden="true">${esc(short)}</span>${b?`<span class="badge">${b}</span>`:''}</button>`;
}
function personaSelect(){ return `<div class="roleSwitch"><div class="rsLbl">Signed in</div><span class="on">${esc(viewLabel())}${studentPreview()?' · Preview':''}</span></div>`; }
function administratorViewSwitch(){
  if(actor.role!=='admin')return '';
  return `<div class="administratorViewSwitch" role="group" aria-label="InterviewIQ view"><button type="button" data-act="switch-view" data-view="student" aria-pressed="${studentPreview()}">STUDENT VIEW</button><button type="button" data-act="switch-view" data-view="admin" aria-pressed="${!studentPreview()}">ADMIN VIEW</button></div>`;
}
async function switchAdministratorView(view){
  if(actor.role!=='admin')throw Error('Only administrators can switch views.');
  if(!['student','admin'].includes(view))return;
  if(pendingCommands.size||activeActions.size>1)throw Error('Wait for the current action to finish before switching views.');
  if((view==='student')===studentPreview())return;
  await stopSpeech();
  if(capabilities.calendarV2===true||administratorWorkspace?.serverEmpty){
    if(view==='student'){const b=await apiFetch('/calendar/student-preview');clearPrivateMemory();applyBootstrap(b);administratorWorkspace={serverEmpty:true};administratorPreview=true;}else{administratorPreview=false;administratorWorkspace=null;clearPrivateMemory();await refreshWorkspace();}render();main().focus({preventScroll:true});return;
  }
  if(view==='student')administratorWorkspace={S,F,capabilities,integrations,version,drafts:new Map(draftValues)};
  clearPrivateMemory();
  if(view==='student'){
    // No student picker, fabricated identity, fixture records or admin review data.
    const zone=F.student_zone;
    administratorPreview=true;
    F={programs:[],facts:[],sources:[],personas:[actor],student_zone:zone,registry_release:F.registry_release,label:''};
    S={persona:actor.id,online:true,storageOk:true,interviews:[],ui:defaultUI(),reviewQueue:[],mentorAssigned:[],changes:[],contrib:{missions:{},submissions:[],ledger:[],grants:{}},policy:{audit:[],suspended:{}},lastVisit:now()};
    for(const key of ownKeys)S[key]={};
    capabilities={coreOnly:true};integrations={};S.ui.cal.ym=ymOf(todayKey());
  }else{
    const saved=administratorWorkspace;
    administratorPreview=false;administratorWorkspace=null;
    ({S,F,capabilities,integrations,version}=saved);
    for(const [key,value] of saved.drafts)draftValues.set(key,value);
  }
  render();main().focus({preventScroll:true});
}
function renderShell(){
  document.body.dataset.role = roleName()==='mentor'?'advisor':roleName();
  document.body.dataset.adminPreview=String(studentPreview());
  const items=navItems(); if(!items.some(x=>x[0]===S.ui.route) && !['experiments','contribute'].includes(S.ui.route)) S.ui.route=items[0][0];
  const student=roleName()==='student';
  rail().innerHTML=`
    <div class="logo" role="button" tabindex="0" data-act="nav" data-to="home" aria-label="InterviewIQ">Interview<b>IQ</b></div><div class="logoSub">MissionMed</div>
    ${student?'<button class="railCta" type="button" data-act="add-interview">＋ <span class="rct">Add interview</span></button>':''}
    ${items.map(railNavButton).join('')}
    <div class="railFoot">
      <a class="rtab matrixAnchor" href="/member-dashboard/" data-act="matrix">↩ Back to Matrix</a>
      ${personaSelect()}
      <div class="signedIdentity"><span class="av" aria-hidden="true">${esc(initials())}</span><span>${esc(actor.displayName||actor.display_name||S.persona)}${me().tier?' · '+esc(me().tier.replace(/_/g,' ')):' · mentor'}</span></div>
      <div class="railClock">${esc(F.student_zone)}<br><span id="connection-status" role="status" aria-live="polite">${S.storageOk?'Connected':'Save not confirmed'}</span></div>
    </div>`;
  hdr().innerHTML=`
    <a class="storyforgeMatrixBack" href="#matrix" data-act="matrix" aria-label="Back to Matrix"><span aria-hidden="true">←</span><span>Matrix</span></a>
    <div class="storyforgeBrand" aria-label="MissionMed InterviewIQ"><div class="storyforgeBrandTitle"><span>MissionMed</span><b>//InterviewIQ</b></div><div class="storyforgeBrandSub">MISSION:RESIDENCY DIVISION</div></div>
    <span class="founderChip">PRIVATE · YOUR INTERVIEW WORKSPACE</span>
    <div class="storyforgeHeaderActions">
      ${administratorViewSwitch()}<span class="viewChip roleReadOnly" title="Your signed MissionMed role remains unchanged">${viewLabel()}${studentPreview()?' · Preview':''}</span>
      ${roleName()==='admin'&&S.ui.subject?`<div class="b1515SubjectChip" role="status"><span>VIEWING INTERVIEWIQ FOR</span><b>${esc(S.ui.subject)}</b></div>`:''}
      <form class="hSearch" id="omniform" role="search"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg><input id="omni" type="search" placeholder="${student?'Search interviews and programs…':roleName()==='mentor'?'Search your students…':'Search review and policy…'}" autocomplete="off" aria-label="Search"><span class="kbd">/</span></form>
      ${student?'<button class="btnCatch" type="button" data-act="add-interview">＋ <span class="bc-txt">Add interview</span></button>':''}
    </div>`;
  const ab=advBanner(); ab.classList.toggle('show', roleName()==='mentor'||studentPreview()); ab.querySelector('span').innerHTML = studentPreview()?'<b>Student View · Administrator preview</b> · No student data loaded. Changes are not saved.':roleName()==='mentor'? '<b>Mentor View</b> · Students’ private preparation, raw speech and notes remain invisible. You see logistics and student-approved gaps only.' : '';
  document.body.classList.remove('is-booting');
}

/* ---------------- Page intro (StoryForge pageIntroMarkup grammar) ---------------- */
function pageIntro({eyebrow,title,value,how,action=''}){
  return `<div class="pageIntro"><div class="eyebrow">${eyebrow}</div><div class="h1">${title}</div><p>${value}</p>${how?`<div class="how"><span>How this works</span>${how}</div>`:''}${action?`<div class="row" style="margin-top:12px">${action}</div>`:''}</div>`;
}

/* ---------------- HOME ---------------- */
function suggestions(list){
  const out=[];
  for(const i of list.slice(0,3)){ const nm=nextMove(i); out.push({label:`<b>${esc(nm.label)}</b> · ${esc(title(i))}`, act:'open-section', id:i.id, section:nm.section}); }
  const up=list.find(i=>i.instant&&i.instant>now()&&!isInactive(i)); if(up) out.push({label:`Day sheet · ${esc(title(up))}`, act:'open-section', id:up.id, section:'day'});
  out.push({label:'Open the calendar', act:'nav', to:'calendar'});
  return out;
}
function changesForMe(list){ return S.changes.filter(c=>(c.who===S.persona || c.who==='*') && c.actor!=='you' && (!c.to || list.find(i=>i.id===c.to))).slice(0,5); }
function ecosystemRow(){
  return `<div class="ecoRow">
    <a class="ecoCard" href="#storyforge" data-act="eco" data-app="storyforge"><span class="eyebrow">StoryForge</span><b>Stories <i>you can use</i></b><small>Approved story versions arrive by consent as a bounded projection. Raw prose never crosses.</small></a>
    <a class="ecoCard" href="#rise" data-act="eco" data-app="rise"><span class="eyebrow">RISE</span><b>Program <i>intelligence</i></b><small>Program identity, cheat-sheet facts with sources and dates, unknowns kept unknown.</small></a>
    <a class="ecoCard" href="#ivoc" data-act="eco" data-app="ivoc"><span class="eyebrow">IV Prep On-Call</span><b>Rehearse <i>live</i></b><small>Mock interviews and delivery practice live in IV Prep On-Call. InterviewIQ hands off the program and your goal.</small></a>
  </div>`;
}
function renderHome(){
  if(roleName()==='mentor') return renderMentorHome();
  if(roleName()==='admin') return renderAdminHome();
  const list=rankedInterviews(myInterviews());
  const top=list[0]; const nm=top?nextMove(top):null;
  const sub = !list.length? 'Add an offer to begin. A date is not needed.' : list.length===1? `One interview. Next: ${esc(nm.label.toLowerCase())} — ${esc(title(top))}.` : `${list.length} interviews. One next move: ${esc(nm.label.toLowerCase())} — ${esc(title(top))}.`;
  const mine=changesForMe(list);
  const week=interviewsThisWeek(list);
  return `<section data-view="home" class="live">
    <div class="homeHero">
      <div class="b1515HomeIdentity"><div class="b1515HomeAvatar" aria-hidden="true">${esc(initials())}</div><div class="greet">${greetingWord()}, <em>${esc(firstName())}</em>.</div></div>
      <div class="greetSub">Welcome back. Where can I take you today?</div>
      <div class="b1515HomeHow"><span>How this works</span>${sub}</div>
      <form class="heroCapture" id="cmdform" role="search"><span class="pfx">Take me to</span><label class="sr" for="cmd">Take me to</label><input id="cmd" placeholder="…an interview, a day sheet, the calendar" autocomplete="off"><button class="heroGo" type="submit">Go</button></form>
      <div class="tryRow" aria-label="Suggested next actions"><span class="tryLbl">Suggested</span>${suggestions(list).map(sg=>`<button type="button" class="cChip" data-act="${sg.act}" ${sg.id?`data-id="${sg.id}" data-section="${sg.section}"`:''} ${sg.to?`data-to="${sg.to}"`:''}>${sg.label}</button>`).join('')}</div>
    </div>
    ${(loiEnabled()||studentPreview())?`<div class="panel panel-gap"><div class="pHead"><div class="h2">Letter of <em>Interest</em></div></div><div class="pBody"><p>Turn verified program intelligence into a letter that sounds like you.</p>${btn('nav','BUILD MY LETTERS →','data-to="letters"')}</div></div>`:''}
    <div class="homeGrid">
      <div class="panel">
        <div class="pHead"><div class="h2">Next <em>moves</em></div><button class="pMore" type="button" data-act="nav" data-to="interviews">All interviews ▸</button></div>
        <div class="pBody"><p class="stageHint">One move per interview, ranked. The reason is always stated.</p>
          ${list.length? list.slice(0,5).map(i=>{ const m=nextMove(i); return `<button class="shortItem" type="button" data-act="open-section" data-id="${i.id}" data-section="${m.section}"><span class="si">${esc(title(i))}</span><span class="sd">${esc(m.label)} · ${esc(m.why)}</span><span class="rowBtn pri">Go</span></button>`; }).join('') : `<div class="storyEmpty">No interviews yet. Add an offer; a date is not needed.</div>`}
        </div>
      </div>
      <div>
        <div class="panel panel-gap">
          <div class="pHead"><div class="h2">What <em>changed</em></div>${mine.length?`<span class="newEmber">${mine.length} since ${fmtShort(S.lastVisit)}</span>`:''}</div>
          <div class="pBody">${mine.length? mine.map(c=>`<button class="advNote" type="button" ${c.to&&myInterviews().some(i=>i.id===c.to)?`data-act="open-interview" data-id="${c.to}"`:'data-act="nav" data-to="growth"'}><span class="avc ${c.actor==='program'?'prog':'sys'}">${c.actor==='program'?'P':'IQ'}</span><span><span class="who"><i class="emberDot"></i>${fmtShort(c.at)}</span><span class="txt">${esc(c.text)}</span></span></button>`).join('') : '<div class="storyEmpty">Nothing changed while you were away.</div>'}</div>
        </div>
        <div class="panel">
          <div class="pHead"><div class="h2">This <em>week</em></div><button class="pMore" type="button" data-act="nav" data-to="calendar">Calendar ▸</button></div>
          <div class="pBody">${week.length? week.map(i=>`<button class="shortItem" type="button" data-act="cal-item" data-item="iv-${i.id}"><span class="si">${esc(title(i))}</span><span class="sd">${fmtInZone(i.instant,F.student_zone)} your time · ${fmtTime(i.instant,i.zone)} program time</span><span class="rowBtn">Open</span></button>`).join('') : `<div class="storyEmpty">No interview in the next seven days. ${list.some(i=>!i.instant&&!i.date&&!isInactive(i))?'One offer has no date yet.':''}</div>`}</div>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:20px"><div class="pHead"><div class="h2">Your MissionMed <em>ecosystem</em></div></div><div class="pBody">${ecosystemRow()}</div></div>${coreOnly()?`<div class="panel pad" style="margin-top:1rem"><h3>More capabilities ${comingSoonBadge()}</h3><p class="tiny">Calendar and interview details are available now. These integrations are not active in this release.</p><div class="row">${(Array.isArray(capabilities.comingSoon)?capabilities.comingSoon:['Program research','StoryForge context','IV Prep On-Call','Voice debrief','Growth','Mentor','Research contributions','Notifications','External calendar','Privacy export']).map(label=>btn('coming-soon',esc(label),`data-label="${esc(label)}"`,'btn ghost sm')).join('')}</div></div>`:''}
  </section>`;
}

/* ---------------- LETTERS OF INTEREST ---------------- */
function renderMyLetters(){
  const preview=studentPreview();
  const list=preview?[]:myInterviews();
  if(loiTargetsEnabled())return `<section data-view="letters" class="live">${pageIntro({eyebrow:'LETTER OF INTEREST',title:'My <em>Letters</em>',value:'Choose a program, build a private letter and manage your outreach.',how:'Use supported RISE evidence and your genuine reasons. Review and approve your words before opening your own email account.'})}${loiStyleEntry()}${S.ui.loiTargetOpen?renderLoiTargetEditor():renderProgramMyLetters()}</section>`;
  return `<section data-view="letters" class="live">${pageIntro({eyebrow:'LETTER OF INTEREST',title:'My <em>Letters</em>',value:'Choose a program, build a private letter and manage your outreach.',how:'Use supported RISE evidence and your genuine reasons. Review and approve your words before opening your own email account.'})}
    ${loiStyleEntry()}${preview?'<div class="panel pad" role="status"><h2>Student View · Preview</h2><p>No private student letters or programs are loaded. Changes are not saved.</p></div>':`<div class="panel pad"><h2>Your programs and letters</h2>${myerasEnabled()?btn('myeras-open','IMPORT MY PROGRAMS','','btn ghost'):''}<p class="tiny">Letters for your saved interviews are available now. RISE Saved Programs, MyERAS import and program-first letters are being connected here. ${loiCompositionEnabled()?'Writing approaches are available in each letter; the standard letter builder remains available.':'AI personalization and writing approaches are not active yet; the standard letter builder is available.'}</p>${list.length?list.map(i=>{const h=loiState(i),head=h.current,sent=head&&h.outreach?.some(x=>x.revisionId===head.revisionId&&x.state==='self_reported_sent'),state=sent?'Sent (self-reported)':head?.state==='approved'?'Approved':head?'Draft':'Not started',action=sent?'VIEW STATUS':head?'CONTINUE':'CREATE LETTER';return `<div class="panel pad" style="margin-top:12px"><h3>${esc(i.programName||title(i))}</h3><p>${esc(i.track||'Track not specified')} · ${esc(state)}</p><p class="tiny">${i.program?'Canonical program attached; read current evidence before approval.':'Program confirmation needed before verified evidence can be used.'} Interview: ${esc(i.state)}.</p>${btn('open-section',action,`data-id="${esc(i.id)}" data-section="loi"`)}</div>`;}).join(''):'<div class="storyEmpty">No interviews or letters yet. Add an interview to use the live letter builder; program imports will appear here when connected.</div>'}${btn('add-interview','Add interview','', 'btn ghost')}</div>`}
  </section>`;
}

/* ---------------- CALENDAR ---------------- */
function calendarScope(){ if(roleName()==='mentor') return S.interviews.filter(i=>i.saved && S.mentorAssigned.includes(i.owner)); return myInterviews(); }
function renderCalendar(){
  const list=calendarScope(); const cal=S.ui.cal; const model=monthModel(cal.ym); const by=itemsByDay(list); const items=calendarItems(list);
  if(calendarV2()&&S.ui.calendarScope==='all'&&cohortPage)for(const e of cohortPage.events){const it={id:'peer-'+e.event_ref,kind:'related',title:e.program_name,time:e.local_time?.slice(0,5)||'time unknown',sub:e.event_type+' · '+e.lifecycle,key:e.local_date};(by[it.key]||=([])).push(it);items.push(it);}
  const undated=items.filter(it=>it.kind==='undated');
  const mentor=roleName()==='mentor';
  const limit=window.innerWidth<=560?2:3;
  const focusDay=model.days.some(d=>d.key===cal.sel)?cal.sel:model.days.find(d=>d.today)?.key||model.days.find(d=>!d.outside).key;
  const cells=model.days.map(day=>{ const ev=(by[day.key]||[]); const shown=ev.slice(0,limit);
    return `<div class="mcv2-month-day${day.outside?' is-outside':''}${day.today?' is-today':''}${cal.sel===day.key?' is-selected':''}" role="gridcell" tabindex="${focusDay===day.key?0:-1}" data-cal-day="${day.key}" aria-label="${esc(day.fullLabel)}${ev.length?', '+ev.length+' item'+(ev.length>1?'s':''):''}. ${mentor?'Open day':'Press Enter to add an interview'}">
      <span class="mcv2-day-number" aria-hidden="true">${day.label}</span>${mentor?'':'<span class="addHint" aria-hidden="true">＋ add</span>'}
      <div class="mcv2-day-events">${shown.map(it=>`<button type="button" class="mcv2-event mcv2-event--${it.kind}" data-act="cal-item" data-item="${it.id}" aria-label="${esc(it.title)} ${esc(it.time)}"><span class="mcv2-event-time">${esc(it.time)}</span><span class="mcv2-event-copy"><strong>${esc(it.title)}</strong></span></button>`).join('')}${ev.length>limit?`<button type="button" class="mcv2-more" data-act="cal-day" data-day="${day.key}">+${ev.length-limit} more</button>`:''}</div>
    </div>`; }).join('');
  const agenda=items.filter(it=>it.key && it.key>=todayKey()).slice(0,30);
  let lastKey='';
  const agendaHTML=`<section class="mcv2-list-panel" aria-label="Agenda"><p class="mcv2-kicker">Upcoming · your time (${esc(zoneShort(F.student_zone))})</p>${agenda.length? agenda.map(it=>{ const head=it.key!==lastKey?`<div class="mcv2-agenda-date">${esc(new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'long',month:'long',day:'numeric'}).format(new Date(it.key+'T12:00:00Z')))}</div>`:''; lastKey=it.key; return head+`<button type="button" class="mcv2-event is-row mcv2-event--${it.kind}" data-act="cal-item" data-item="${it.id}"><span class="mcv2-event-time">${esc(it.time)}</span><span class="mcv2-event-copy"><strong>${esc(it.title)}</strong><small>${esc(it.sub)}</small></span><span class="mcv2-chip ${it.kind==='related'?'is-cy':it.kind==='deadline'?'is-rd':''}">${it.kind}</span></button>`; }).join('') : '<div class="storyEmpty">No upcoming dated items.</div>'}</section>`;
  return `<section data-view="calendar" class="live">
    <header class="mcv2-header">
      <div><p class="mcv2-kicker">${mentor?'ASSIGNED STUDENTS · LOGISTICS ONLY':'INTERVIEW CALENDAR'}</p><div class="h1">${cal.view==='month'?'Month':'Agenda'} <em>view</em></div></div>
      <div class="mcv2-command-row">
        <div class="mcv2-view-switcher" role="group" aria-label="Calendar view">${['month','agenda'].map(v=>`<button type="button" data-act="cal-view" data-view="${v}" aria-pressed="${cal.view===v}">${v}</button>`).join('')}</div>
        <div class="mcv2-header-actions"><button type="button" data-act="cal-nav" data-n="-1" aria-label="Previous month">←</button><button type="button" data-act="cal-today">Today</button><button type="button" data-act="cal-nav" data-n="1" aria-label="Next month">→</button><strong>${esc(model.title)}</strong>${mentor?'':'<button type="button" class="mcv2-new-event-btn" data-act="add-interview">+ Add interview</button>'}<span class="mcv2-timezone">◉ ${esc(F.student_zone)}</span></div>
      </div>
    </header>
    ${calendarV2()?`<div class="row">${btn('calendar-mine','My Calendar','','btn ghost')}${btn('calendar-all','All eligible cohort events','','btn ghost')}<span class="tiny">Peer events are deidentified. Joining details, names, private notes and files are never shared.</span></div>${cohortPage?.error?`<p role="status">${esc(cohortPage.error)} Your own Calendar remains available.</p>`:''}${S.ui.calendarScope==='all'&&cohortPage?`<span class="tiny">Cohort page ${cohortPage.page} · up to 200 events per page</span>`:''}${S.ui.calendarScope==='all'&&cohortPage?.nextCursor?btn('calendar-more','Load next cohort page','','btn ghost'):''}`:''}
    ${renderScheduleWarnings(list)}
    ${undated.length&&!mentor? `<div class="undatedStrip"><span class="lbl">Date unknown</span>${undated.map(it=>`<button type="button" class="mcv2-event mcv2-event--undated" style="width:auto" data-act="cal-item" data-item="${it.id}"><span class="mcv2-event-copy"><strong>${esc(it.title)}</strong></span></button>`).join('')}<span class="tiny">Offers without a date stay here until the program sends one. Click one to add the date.</span></div>`:''}
    ${cal.view==='month'? `<div class="mcv2-month" role="grid" aria-label="${esc(model.title)}"><div class="mcv2-weekdays" role="row">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="mcv2-weekday" role="columnheader">${d}</div>`).join('')}</div><div class="mcv2-month-grid">${cells}</div></div>
      <div class="calLegend"><span><i style="background:var(--em)"></i>Interview</span><span><i style="background:var(--cy)"></i>Related event</span><span><i style="background:var(--rd)"></i>Deadline</span><span><i style="background:var(--vi)"></i>Date unknown</span><span><i style="background:var(--dim)"></i>Cancelled</span><span>· times shown in your zone; program time in the detail</span></div>` : agendaHTML}
  </section>`;
}

/* ---------------- Drawer (mcv2-drawer grammar) ---------------- */
function openDrawer(d){ if(!S.ui.drawer)drawerReturnFocus=document.activeElement; S.ui.drawer=d; renderDrawer(); }
function closeDrawer(){if(S?.ui?.drawer?.kind==='intake'&&intakeFlow?.busy){notice('Your save is in progress. Wait for confirmation before closing.');return;}if(S?.ui?.drawer?.kind==='myeras')clearMyerasMemory(); const ret=S.ui.drawer?.returnTo; S.ui.drawer=null; renderDrawer(); const el=ret?document.querySelector(ret):drawerReturnFocus; if(el?.isConnected)el.focus(); else document.querySelector('[data-cal-day][tabindex="0"]')?.focus(); }
function renderDrawer(){
  const w=drawerEl(); const d=S.ui.drawer;
  if(!d){ w.classList.remove('open'); w.innerHTML=''; for(const id of ['main','hdr','rail'])document.getElementById(id).inert=false; return; }
  let inner='';
  if(d.kind==='cohort-event'){const e=cohortPage?.events.find(e=>e.event_ref===d.ref);inner=e?`<h2>${esc(e.program_name)}</h2><p>${esc(e.specialty)} · ${esc(e.track)}</p><p>${esc(e.local_date)} ${esc(e.local_time||'Time unknown')} · ${esc(e.timezone)} · ${esc(e.format)}</p><p>${esc(e.event_type)} · ${esc(e.lifecycle)}</p><p>No private student workspace or joining details are shared.</p>${actor.role==='admin'&&capabilities.adminLogistics?btn('admin-calendar-read','Open authorized logistics',`data-ref="${esc(e.event_ref)}"`,'btn ghost'):''}`:'<p>Event is unavailable.</p>'; }else if(d.kind==='itinerary'){inner=renderItinerary(d.id);}else if(d.kind==='admin-calendar'){inner=renderAdminCalendar();}else if(d.kind==='intake'){inner=renderIntakeWizard();} else if(d.kind==='myeras'){inner=renderMyerasWizard();} else if(d.kind==='loi-style'){inner=renderLoiStyle();} else if(d.kind==='coming-soon'){inner=comingSoonPanel(d.label)+`<div class="mcv2-drawer-actions"><button class="rowBtn pri" data-act="drawer-close">Back to workspace</button></div>`;} else if(d.kind==='day'){
    const list=calendarScope(); const by=itemsByDay(list); const ev=by[d.day]||[];if(calendarV2()&&S.ui.calendarScope==='all'&&cohortPage)for(const e of cohortPage.events.filter(e=>e.local_date===d.day))ev.push({id:'peer-'+e.event_ref,kind:'related',title:e.program_name,time:e.local_time||'Time unknown',sub:e.event_type+' · '+e.lifecycle}); const mentor=roleName()==='mentor';
    const label=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(new Date(d.day+'T12:00:00Z'));
    const undated=mentor?[]:myInterviews().filter(i=>!i.instant&&!i.date&&!isInactive(i));
    inner=`<h2>${esc(label)}</h2>
      ${ev.length? `<dt>On this day</dt><div class="drawerItems">${ev.map(it=>`<button type="button" class="mcv2-event is-row mcv2-event--${it.kind}" data-act="cal-item" data-item="${it.id}"><span class="mcv2-event-time">${esc(it.time)}</span><span class="mcv2-event-copy"><strong>${esc(it.title)}</strong><small>${esc(it.sub)}</small></span><span class="mcv2-chip">${it.kind}</span></button>`).join('')}</div>` : `<p class="tiny">Nothing on this day${mentor?'':' yet'}.</p>`}
      ${mentor?'':`<dt>Add to this day</dt><div class="drawerChoice">
        <button type="button" data-act="add-interview" data-day="${d.day}"><b>Add an interview</b><small>Name as written on the invitation. Program and time can come later.</small></button>
        ${undated.length? undated.map(i=>`<button type="button" data-act="date-undated" data-id="${i.id}" data-day="${d.day}"><b>Put “${esc(title(i))}” on this date</b><small>This offer has no date yet. Confirms the date; time can stay unknown.</small></button>`).join(''):''}
        ${myInterviews().filter(i=>(coreOnly()||i.program)&&!isInactive(i)).length? `<button type="button" data-act="add-related-pick" data-day="${d.day}"><b>Add a related event</b><small>A resident social, a pre-interview dinner, a deadline — attached to one of your interviews.</small></button>`:''}
      </div>`}`;
  } else if(d.kind==='item'){
    const list=calendarScope(); const it=calendarItems(list).find(x=>x.id===d.item); const i=it&&S.interviews.find(x=>x.id===it.interview);
    if(!it||!i){ inner='<h2>Not found</h2>'; }
    else {
      const prog=i.program?P(i.program):null; const mentor=roleName()==='mentor'; const own=owns(i);
      const rel = it.kind==='related'? i.related.find(e=>'rel-'+i.id+'-'+e.id===it.id) : null;
      inner=`<h2>${esc(it.kind==='related'?rel.kind:it.kind==='deadline'?'Scheduling deadline':title(i))}${it.kind!=='interview'&&it.kind!=='cancelled'?` <em>· ${esc(title(i))}</em>`:''}</h2>
        <dl>
          <dt>Program</dt><dd>${prog? esc(prog.name.replace('Fictional ',''))+' · '+esc(prog.specialty)+' · '+esc(prog.track) : esc(i.programName||i.unresolved_input||'Program name not supplied')+(i.track?' · '+esc(i.track):'')+' · supplied by you; registry unresolved'}</dd>
          ${it.kind==='related'? `<dt>When</dt><dd>${rel.instant?fmtInZone(rel.instant,rel.zone||i.zone):esc(rel.date)+' · time not set'} (event time) · ${fmtTime(rel.instant,F.student_zone)} your time · ${rel.duration_minutes==null?'duration unknown':rel.duration_minutes+' min'}<br><span class="tiny">${esc(relatedStatus(i,rel))}</span></dd>`
          : it.kind==='deadline'? `<dt>Deadline</dt><dd>${esc(i.deadline)} · reply to the program by this date</dd>`
          : `<dt>When</dt><dd>${i.instant? fmtInZone(i.instant,i.zone)+' (program time, '+esc(zoneShort(i.zone))+')<br>'+fmtTime(i.instant,F.student_zone)+' your time ('+esc(zoneShort(F.student_zone))+')' : i.date? esc(i.date)+' · time not set' : 'Date not yet known'}${i.duration?'<br>'+i.duration+' minutes':'<br><span class="tiny">Duration unknown</span>'}</dd>
          ${i.joining?`<dt>Joining details</dt><dd>${esc(i.joining)}</dd>`:''}<dt>State</dt><dd>${esc(stateLabel(i))}${i.format?' · '+esc(i.format):''}</dd>
          ${own? `<dt>Next move</dt><dd>${esc(nextMove(i).label)}<br><span class="tiny">${esc(nextMove(i).why)}</span></dd>`:''}
          ${mentor? `<dt>Mentor scope</dt><dd class="tiny">Logistics only. Preparation, speech, notes and drafts are not shown.</dd>`:''}`}
        </dl>
        <div class="mcv2-drawer-actions">
          ${own? `<button class="rowBtn pri" type="button" data-act="open-interview" data-id="${i.id}">Open interview</button><button class="rowBtn" type="button" data-act="open-section" data-id="${i.id}" data-section="schedule">${i.instant||i.date?'Reschedule':'Add the date'}</button>${i.instant&&i.instant>now()?`<button class="rowBtn" type="button" data-act="open-section" data-id="${i.id}" data-section="day">Day sheet</button>`:''}${!isInactive(i)?`<button class="rowBtn" type="button" data-act="cancel" data-id="${i.id}">Cancel interview</button>`:`<button class="rowBtn" type="button" data-act="restore" data-id="${i.id}">Restore</button>`}` : ''}
        </div>`;
    }
  } else if(d.kind==='add'){
    const st=d.form||{}; const date=st.schedule?.date??st.date??d.day??''; const time=st.schedule?.time??st.time??''; const zone=st.schedule?.zone??st.zone??F.student_zone;
    inner=`<h2>Add an <em>interview</em></h2><p class="tiny">Write the program name and track from the invitation. A date is not needed. ${loiCanonicalLookup()&&!deepResearch()?'Confirm the exact registry program for your Letter of Interest context. This does not start research; your schedule saves now.':coreOnly()&&!deepResearch()?'Registry verification and research are coming soon; your schedule saves now.':'Research starts only when the exact program is confirmed.'}</p>
      <label class="f" for="ad-name">Name on the invitation</label><input type="text" id="ad-name" value="${esc(st.unresolved_input||st.name||'')}" placeholder="Program name as shown on your invitation">
      <label class="f" for="ad-track">Track (optional)</label><input id="ad-track" value="${esc(st.track||'')}" maxlength="300" placeholder="Categorical, preliminary, or another supplied track"><label class="f" for="ad-program">Program registry ${coreOnly()&&!deepResearch()&&!loiCanonicalLookup()?'· COMING SOON':'(if already known)'}</label><select id="ad-program"><option value="">I will confirm later</option>${F.programs.map(p=>`<option value="${p.id}" ${st.program===p.id?'selected':''}>${esc(programLabel({...p,name:p.name.replace('Fictional ','')}))}</option>`).join('')}</select>
      <div class="inline"><div><label class="f" for="ad-date">Date (optional)</label><input type="date" id="ad-date" value="${esc(date)}"></div><div><label class="f" for="ad-time">Start time (optional)</label><input type="time" id="ad-time" value="${esc(time)}"></div><div><label class="f" for="ad-zone">Program’s zone</label><select id="ad-zone">${ZONES.map(z=>`<option ${z===zone?'selected':''}>${z}</option>`).join('')}</select></div></div>
      <div class="inline"><div><label class="f" for="ad-format">Format</label><select id="ad-format">${['','virtual','in person','hybrid','unknown'].map(f=>`<option value="${f}" ${f===(st.schedule?.format||st.format||'')?'selected':''}>${f||'—'}</option>`).join('')}</select></div><div><label class="f" for="ad-deadline">Scheduling deadline (optional)</label><input type="date" id="ad-deadline" value="${esc(st.deadline||'')}"></div><div><label class="f" for="ad-join">Joining details</label><input type="text" id="ad-join" value="${esc(st.schedule?.joining||st.joining||'')}" placeholder="from the invitation"></div></div>
      ${d.overlap? `<div class="panel amber" style="margin-top:10px;padding:12px 14px"><b>${esc(d.overlap.msg)}</b><div class="row" style="margin-top:6px">${d.overlap.cands.map((c,k)=>`<button class="btn sm" type="button" data-act="add-interview-save" data-fold="${k}">Use ${esc(c.label)}</button>`).join('')}</div></div>`:''}
      <div class="mcv2-drawer-actions"><button class="rowBtn solid" type="button" data-act="add-interview-save">Save interview</button><button class="rowBtn" type="button" data-act="drawer-close">Cancel</button></div>
      <p class="tiny" style="margin-top:12px">Named zone plus the exact moment. A time that does not exist (spring gap) is rejected; a time that happens twice (autumn overlap) asks you to choose.</p>`;
  } else if(d.kind==='related'){
    const cands=myInterviews().filter(i=>(coreOnly()||i.program)&&!isInactive(i)); const st=d.form||{};
    inner=`<h2>Add a <em>related event</em></h2><p class="tiny">Attached to one interview. A social is never counted as an interview encounter.</p>
      <label class="f" for="ar-iv">Interview</label><select id="ar-iv">${cands.map(i=>`<option value="${i.id}" ${st.iv===i.id?'selected':''}>${esc(title(i))} · ${i.instant?fmtShort(i.instant):'date unknown'}</option>`).join('')}</select>
      <label class="f" for="ar-kind">Kind</label><select id="ar-kind">${['resident social','pre-interview dinner','program tour','second look','other'].map(k=>`<option ${st.kind===k?'selected':''}>${k}</option>`).join('')}</select>
      <div class="inline"><div><label class="f" for="ar-date">Date</label><input type="date" id="ar-date" value="${esc(st.date??d.day??'')}"></div><div><label class="f" for="ar-time">Start time</label><input type="time" id="ar-time" aria-label="Event start time (blank = unknown)" value="${esc(st.time||'')}"></div><div><label class="f" for="ar-dur">Duration (min)</label><input type="number" id="ar-dur" min="1" max="1440" value="${esc(st.dur||'')}"></div></div>
      <label class="f" for="ar-zone">Event timezone</label><select id="ar-zone">${ZONES.map(z=>`<option ${z===(st.zone||F.student_zone)?'selected':''}>${z}</option>`).join('')}</select>${foldSelect('ar-fold')}<div class="mcv2-drawer-actions"><button class="rowBtn solid" type="button" data-act="add-related-save">Save event</button><button class="rowBtn" type="button" data-act="drawer-close">Cancel</button></div>`;
  }
  w.innerHTML=`<div class="scrim" data-act="drawer-close"></div><aside class="mcv2-drawer ${d.kind==='myeras'?'myerasModal':d.kind==='intake'?'intakeModal':''}" role="dialog" aria-modal="true" aria-label="${d.kind==='myeras'?'Import MyERAS programs':d.kind==='intake'?'Add interview':'Calendar detail'}"><button class="close" type="button" data-act="drawer-close" aria-label="Close">×</button>${inner}</aside>`;
  applyDrafts();markComingSoonActions();w.classList.add('open'); for(const id of ['main','hdr','rail'])document.getElementById(id).inert=true;
  setTimeout(()=>{ const first=w.querySelector('input,select,button.rowBtn,button.mcv2-event,.close'); (first||w.querySelector('.close'))?.focus(); },0);
}

/* ---------------- INTERVIEWS (list + room) ---------------- */
function sectionsFor(i){
  const out=[];
  if(coreOnly())return [...(loiEnabled()?[['loi','Letter of Interest']]:[]),['identify','Program details'],['schedule','Schedule & details'],['brief','Brief'],['why','Why this program'],['rehearse','Rehearse'],['day','Interview day'],['debrief','Debrief'],['learned','Learned']];
  if(!i.program) out.push(['identify','Confirm program']);
  else out.push(['brief','Brief'],['why','Why this program'],['rehearse','Rehearse'],['day','Interview day']);
  const passed=i.instant && i.instant<=now();
  if(passed || isInactive(i)) out.push(['debrief','Debrief']);
  const db=S.debriefs[i.id]; if(db?.saved || S.learning[i.owner]) out.push(['learned','Learned']);
  if(loiEnabled())out.push(['loi','Letter of Interest']);
  out.push(['schedule','Schedule & details']);
  return out;
}
function dateBlock(i){
  if(i.instant){ const p=zoneParts(new Date(i.instant),F.student_zone); const mon=new Intl.DateTimeFormat('en-US',{timeZone:F.student_zone,month:'short'}).format(new Date(i.instant)); return `<div class="dateBlock"><b>${+p.day}</b><small>${mon}</small></div>`; }
  if(i.date){ const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(i.date); const mon=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short'}).format(new Date(Date.UTC(+m[1],+m[2]-1,+m[3]))); return `<div class="dateBlock"><b>${+m[3]}</b><small>${mon}</small></div>`; }
  return `<div class="dateBlock unk"><b>TBD</b><small>no date</small></div>`;
}
function stateChip(i){ const l=stateLabel(i); const cls = l==='Cancelled'?'bad':l==='Captured'?'ok':/Awaiting|Capturing|Identity/.test(l)?'warn':l==='Offer saved'?'vi':''; return `<span class="stateChip ${cls}">${esc(l)}</span>`; }
function interviewRow(i){
  const nm=nextMove(i);
  return `<div class="sRow" id="row-${i.id}">${dateBlock(i)}<div><div class="nm">${esc(title(i))}</div><div class="mt">${metaLine(i)}</div><div class="nx"><b>${esc(nm.label)}</b> · ${esc(nm.why)}</div>${pulseSVG(i)}</div><div class="rMeta">${stateChip(i)}<button class="rowBtn pri" type="button" data-act="open-section" data-id="${i.id}" data-section="${nm.section}">Go</button><button class="rowBtn" type="button" data-act="open-interview" data-id="${i.id}">Open</button></div></div>`;
}
function renderInterviews(){
  const list=rankedInterviews(myInterviews());
  const open=S.ui.open && list.find(i=>i.id===S.ui.open);
  if(open) return renderRoom(open);
  const upcoming=list.filter(i=>!isInactive(i) && !(i.instant&&i.instant<=now()));
  const past=list.filter(i=>i.instant&&i.instant<=now()&&!isInactive(i));
  const cancelled=list.filter(i=>isInactive(i));
  return `<section data-view="interviews" class="live">
    ${pageIntro({eyebrow:'Interviews', title:'Every interview, <em>one next move</em>.', value:'Each interview is one persistent record: offer, identity, research, preparation, rehearsal, the day, the debrief and what you learned. Nothing is deleted; history stays attached.', how:'Ranked by what to do first. Open one to work inside it; the calendar shows the same records by date.', action:'<button class="rowBtn solid" type="button" data-act="add-interview">＋ Add interview</button><button class="rowBtn" type="button" data-act="nav" data-to="calendar">Open the calendar</button>'})}
    ${list.length? `<div class="ivList">${upcoming.map(interviewRow).join('')}</div>
      ${past.length?`<h3 style="margin:22px 0 10px" class="h2">After the <em>interview</em></h3><div class="ivList">${past.map(interviewRow).join('')}</div>`:''}
      ${cancelled.length?`<h3 style="margin:22px 0 10px" class="h2">Cancelled</h3><div class="ivList">${cancelled.map(interviewRow).join('')}</div>`:''}` : `<div class="empty">No interviews yet. Add an offer; a date is not needed.</div>`}
  </section>`;
}
function renderRoom(i){
  const nm=nextMove(i); const secs=sectionsFor(i);
  if(!S.ui.section || !secs.find(s=>s[0]===S.ui.section)) S.ui.section=nm.section && secs.find(s=>s[0]===nm.section)? nm.section : secs[0][0];
  const sec=S.ui.section;
  const body=coreOnly()&&!coreSection(sec)?comingSoonPanel(secs.find(x=>x[0]===sec)?.[1]||sec):{loi:renderLoi, identify:renderIdentify, brief:renderBrief, why:renderWhy, rehearse:renderRehearse, day:renderDay, debrief:renderDebrief, learned:renderLearned, schedule:renderSchedule}[sec](i);
  return `<section data-view="interview" class="live">
    <div class="roomHead"><div><button class="back" type="button" data-act="close-interview">← All interviews</button><div class="h1" style="margin-top:6px">${esc(title(i))}</div><div class="tiny" style="margin-top:4px">${metaLine(i)} · ${esc(i.id)}</div>${pulseSVG(i)}</div><div class="row">${stateChip(i)}<button class="rowBtn" type="button" data-act="cal-item" data-item="iv-${i.id}">Calendar</button></div></div>
    <div class="nextMove"><div><span class="lbl">Next move</span><b>${esc(nm.label)}</b><p>${esc(nm.why)}</p></div><button class="rowBtn pri" type="button" data-act="${nm.act}" data-id="${i.id}" data-section="${nm.section}">Go</button></div>
    <div class="sections" role="tablist" aria-label="Sections of this interview">${secs.map(([k,l])=>`<button role="tab" type="button" data-act="section" data-id="${i.id}" data-section="${k}" aria-selected="${sec===k}">${l}${coreOnly()&&!coreSection(k)?comingSoonBadge():''}${k==='why'&&whyMatches(i,S.why[i.id]?.text||'').length?'<span class="dot" aria-label="has an unresolved claim"></span>':''}</button>`).join('')}</div>
    <div class="section section-${sec}" id="section-${sec}" tabindex="-1">${sec!=='day'?'<p class="print-hint">To print, open the Interview day section of this interview. Other sections are not printed.</p>':''}${body}</div>
  </section>`;
}

/* ---------------- PREPARE ---------------- */
function renderPrepare(){
  const list=rankedInterviews(myInterviews()).filter(i=>!isInactive(i) && !(i.instant&&i.instant<=now()));
  const resolved=list.filter(i=>i.program), unresolved=list.filter(i=>!i.program);
  const sf=storyforgeProjection(S.persona); const stories=sf.payload.stories;
  return `<section data-view="prepare" class="live">
    ${pageIntro({eyebrow:'Prepare', title:'Prepare for <em>each program</em>, in your words.', value:'The brief answers five questions with sources underneath. Your Why-Program points stay yours. Rehearsal diagnoses your own draft and leaves one specific change for next time.', how:'Three things stay separate: what the program says, what you actually did, and suggested phrasing.'})}
    <div class="growthGrid">
      <div>
        ${resolved.length? resolved.map(i=>{ const rs=researchState(i); const w=S.why[i.id]; const pr=(S.practice[i.id]||[]).filter(a=>a.feedback).length; const vf=visibleFacts(i.program); return `<div class="panel panel-gap"><div class="pHead"><div class="h2">${esc(title(i))}</div><span class="tiny">${i.instant?hoursLabel(hoursUntil(i)):i.date?'time not set':'date unknown'}</span></div><div class="pBody">
          <p class="tiny" style="margin-bottom:10px">${vf.allow? esc(rs.short) : 'Shared research is not available to you — '+esc(vf.reason)+'.'} ${w?.text?'· Why points saved.':'· No Why points yet.'} ${pr?'· '+pr+' rehearsal'+(pr>1?'s':'')+'.':'· Not rehearsed.'}</p>
          <div class="row"><button class="rowBtn pri" type="button" data-act="open-section" data-id="${i.id}" data-section="brief">Brief</button><button class="rowBtn pri" type="button" data-act="open-section" data-id="${i.id}" data-section="why">Why this program</button><button class="rowBtn pri" type="button" data-act="open-section" data-id="${i.id}" data-section="rehearse">Rehearse</button><button class="rowBtn" type="button" data-act="open-section" data-id="${i.id}" data-section="day">Day sheet</button></div></div></div>`; }).join('') : '<div class="empty">No program-confirmed upcoming interview to prepare for.</div>'}
        ${unresolved.length? `<div class="panel amber pad"><b>${unresolved.length} offer${unresolved.length>1?'s':''} still need${unresolved.length>1?'':'s'} the exact program.</b> <span class="tiny">Research and the program question wait for it; your own experience is ready now.</span><div class="row" style="margin-top:8px">${unresolved.map(i=>`<button class="rowBtn pri" type="button" data-act="open-section" data-id="${i.id}" data-section="identify">Confirm ${esc(title(i))}</button>`).join('')}</div></div>`:''}
      </div>
      <div>
        <div class="panel panel-gap"><div class="pHead"><div class="h2">Stories <em>you can use</em></div><span class="tiny">from StoryForge</span></div><div class="pBody">
          ${stories.length? stories.map(s=>`<div class="storyRow"><div><b>${esc(s.title)}</b><small>${esc(s.summary)}</small><div class="themeChips">${(s.themes||[]).map(t=>`<span>${esc(t)}</span>`).join('')}</div></div><span class="chip ok">consented · ${esc(s.version)}</span></div>`).join('') : '<div class="storyEmpty">No approved story is in use. Allow one in Settings; StoryForge keeps the prose.</div>'}
          <details><summary>Projection envelope · storyforge.approved_stories v1</summary><pre class="envelope">${esc(JSON.stringify(sf,null,1))}</pre><p class="tiny">Shape carried verbatim from the IVOC consumer contract: student consent, approved version IDs, title, themes, a 60-word summary and interview applicability. Raw prose, media, transcripts and private notes never cross.</p></details>
        </div></div>
        <div class="panel"><div class="pHead"><div class="h2">Rehearse <em>live</em></div><span class="tiny">IV Prep On-Call</span></div><div class="pBody"><p class="tiny" style="margin-bottom:8px">Mock interviews, delivery practice and recordings are IV Prep On-Call’s. InterviewIQ hands off the program, the question and your confirmed goal; it never sends raw debrief speech or private notes.</p><div class="row"><a class="rowBtn pri" href="#ivoc" data-act="eco" data-app="ivoc">Open IV Prep On-Call</a><span class="tiny">${S.learning[S.persona]?.status==='confirmed'?'Carries your goal: “'+esc(S.learning[S.persona].goal)+'”':'No confirmed goal to carry yet.'}</span></div></div></div>
      </div>
    </div>
  </section>`;
}

/* ---------------- PROGRAM INTELLIGENCE (RISE) ---------------- */
function renderIntel(){
  const mine=myInterviews().filter(i=>i.program); const pids=[...new Set(mine.map(i=>i.program))];
  const cards=pids.map(pid=>{ const prog=P(pid); const cs=riseCheatSheet(pid); const ivs=mine.filter(i=>i.program===pid); const rs=researchState(ivs[0]); const reports=reviewedReports(pid);
    if(cs.denied) return `<div class="progCard"><div class="nm">${esc(prog.name.replace('Fictional ',''))}</div><div class="mt">${esc(prog.specialty)} · ${esc(prog.track)} · ${esc(zoneShort(prog.zone))}</div><div class="panel rust pad"><b>Shared research is not available to you.</b> <span class="tiny">${esc(cs.reason)}.</span>${(capabilities.contributions===true||coreOnly())?'<div class="row" style="margin-top:8px"><button class="rowBtn pri" type="button" data-act="nav" data-to="contribute">How research access works</button></div>':''}</div></div>`;
    return `<div class="progCard"><div class="nm">${esc(prog.name.replace('Fictional ',''))}</div><div class="mt">${esc(prog.specialty)} · ${esc(prog.track)} · ${esc(zoneShort(prog.zone))} · ${chip('Research · '+rs.state, ['available','partial'].includes(rs.state)?'ok':'sky')}</div>
      <h4 class="f" style="margin-top:6px">High-yield facts</h4>${(cs.payload.high_yield_facts||[]).length? (cs.payload.high_yield_facts||[]).map(f=>`<div class="src ok"><b>${esc(f.fact)}</b><code>${esc(f.source_ref)} · as of ${esc(f.as_of)}</code></div>`).join('') : `<p class="tiny">${esc(rs.short)} No supported fact yet.</p>`}
      ${(cs.unknowns||[]).length? `<h4 class="f">Kept open</h4>${(cs.unknowns||[]).map(u=>`<div class="src ${u.status==='unknown'?'unk':'conf'}"><b>${esc(u.claim)}</b><span class="tiny">${esc(u.status)} — ask the program; nothing is inferred.</span></div>`).join('')}`:''}
      ${reports.length? `<h4 class="f">What past applicants reported (reviewed)</h4>${reports.map(r=>`<div class="src ok">“${esc(r.excerpt)}”<code>experience report · approved ${fmtShort(r.at)} · version ${r.version}</code></div>`).join('')}`:''}
      <div class="row" style="margin-top:10px"><a class="rowBtn pri" href="#rise" data-act="eco" data-app="rise">Open in RISE</a>${['available','partial'].includes(rs.state)? `<button class="rowBtn sim" type="button" data-act="research-refresh" data-id="${ivs[0].id}">Refresh</button>` : `<button class="rowBtn sim" type="button" data-act="research-advance" data-id="${ivs[0].id}">Check / retry research</button>`}<button class="rowBtn" type="button" data-act="open-section" data-id="${ivs[0].id}" data-section="brief">Brief for ${esc(title(ivs[0]))}</button></div>
      <details><summary>Projection envelope · rise.program_cheat_sheet v1</summary><pre class="envelope">${esc(JSON.stringify(cs,null,1))}</pre><p class="tiny">Shape carried verbatim from the IVOC consumer contract: owner policy, program identity, up to eight facts with source and date, role-only people (no names). RISE stays the authority; InterviewIQ reads, never writes.</p></details>
    </div>`; }).join('');
  return `<section data-view="intel" class="live">
    ${pageIntro({eyebrow:'Program Intelligence · RISE', title:'What RISE knows, <em>with its sources</em>.', value:'Program identity and governed intelligence are RISE’s. InterviewIQ shows the cheat sheet for each program you interview with: facts with source and date, conflicts kept as conflicts, unknowns kept unknown.', how:'One durable research request per interview. A second interview at the same program reuses the shared result; nothing is researched twice.', action:'<a class="rowBtn pri" href="#rise" data-act="eco" data-app="rise">Open RISE</a><button class="rowBtn sim" type="button" data-act="outage">'+(S.online?'Check connection':'Check connection')+'</button>'})}
    ${pids.length? `<div class="intelGrid">${cards}</div>` : '<div class="empty">No program-confirmed interview yet. Program intelligence appears once a program is confirmed.</div>'}
  </section>`;
}

/* ---------------- DEBRIEFS ---------------- */
function renderDebriefs(){
  const list=rankedInterviews(myInterviews()).filter(i=>i.instant&&i.instant<=now()&&!isInactive(i));
  const mine=S.reviewQueue.filter(r=>r.from===S.persona);
  return `<section data-view="debriefs" class="live">
    ${pageIntro({eyebrow:'Debriefs', title:'Two minutes <em>while it is fresh</em>.', value:'A passed time is not attendance. Once you say an interview happened, capture it by speaking or tapping; unknown, estimated and “prefer not to say” are real answers. Raw speech, your edited account and proposed structure are kept apart.', how:'Two exits: keep one thing for yourself (changes your next rehearsal), or share one de-identified sentence for review.'})}
    <div class="growthGrid"><div>
      ${list.length? `<div class="ivList">${list.map(i=>{ const db=S.debriefs[i.id]; const st= !db||db.occurrence==null||db.occurrence==='later'? ['Say whether it happened','warn'] : db.occurrence==='no'? ['Did not take place','bad'] : db.saved? ['Captured','ok'] : ['Capturing','warn']; return `<div class="sRow">${dateBlock(i)}<div><div class="nm">${esc(title(i))}</div><div class="mt">${metaLine(i)}</div><div class="nx"><b>${esc(st[0])}</b>${db?.saved?' · '+db.questions.length+' question(s), '+Object.keys(db.fields).length+' selections':''}</div></div><div class="rMeta"><span class="stateChip ${st[1]}">${esc(st[0])}</span><button class="rowBtn pri" type="button" data-act="open-section" data-id="${i.id}" data-section="debrief">Open debrief</button></div></div>`; }).join('')}</div>` : '<div class="empty">No interview has passed its scheduled time yet. Debriefs open after the time has passed, and only once you say it happened.</div>'}
    </div><div>
      <div class="panel"><div class="pHead"><div class="h2">What you <em>shared</em></div></div><div class="pBody">${mine.length? mine.map(r=>`<div class="src ${r.status==='approved'?'ok':r.status==='retracted'?'conf':''}"><b>${esc(P(r.program).name.replace('Fictional ',''))} ${chip(r.status, r.status==='approved'?'ok':'warn')}</b>“${esc(r.excerpt)}”<code>v${r.version} · de-identified · reviewed before any other student sees it</code></div>`).join('') : '<div class="storyEmpty">Nothing shared. Sharing is optional and always reviewed.</div>'}</div></div>
    </div></div>
  </section>`;
}

/* ---------------- GROWTH ---------------- */
function renderGrowth(){
  const lg=S.learning[S.persona]; const mine=myInterviews(); const future=mine.filter(x=>x.instant&&x.instant>now()&&!isInactive(x));
  const attempts=mine.flatMap(i=>(S.practice[i.id]||[]).filter(a=>a.feedback).map(a=>Object.assign({iv:i},a)));
  const rk=S.rank[S.persona]||{consent:false,version:0};
  return `<section data-view="growth" class="live">
    ${pageIntro({eyebrow:'Growth', title:'One observation, <em>carried forward</em>.', value:'What you learned from one interview changes the next rehearsal on purpose: the diagnosis checks your goal first and the specific change names it. Confirm, correct or revoke at any time.', how:'Nothing is inferred from a face or a voice. The goal comes from your own words or your private note.'})}
    <div class="growthGrid">
      <div class="panel moss pad"><h3>Your practice goal</h3>${renderLearningControls(S.persona,null)}
        <h4 class="f" style="margin-top:14px">Where it shows up next</h4>${lg?.status==='confirmed'? (future.length? future.map(x=>`<p style="font-size:13.5px">${esc(title(x))} (${fmtShort(x.instant)}): the rehearsal context carries “${esc(lg.goal)}”. ${link('open-section','Rehearse',`data-id="${x.id}" data-section="rehearse"`)}</p>`).join('') : '<p class="tiny">No upcoming interview yet; it will apply to the next one you add.</p>') : '<p class="tiny">Nothing changes until you confirm the goal.</p>'}</div>
      <div>
        <div class="panel panel-gap"><div class="pHead"><div class="h2">Rehearsal <em>history</em></div></div><div class="pBody">${attempts.length? attempts.slice().reverse().map(a=>`<div class="src ${a.reflection?'ok':''}"><b>${esc(title(a.iv))} · ${fmtStamp(a.at)}</b><span class="tiny">${esc((a.retry||a.draft||'').slice(0,140))}</span>${a.nextChange?`<code>Next time: ${esc(a.nextChange)}</code>`:''}</div>`).join('') : '<div class="storyEmpty">No rehearsal with feedback yet.</div>'}</div></div>
        <div class="panel"><div class="pHead"><div class="h2">Later: <em>RankList IQ</em></div></div><div class="pBody"><p class="tiny">RankList owns ranking. With your consent, a versioned copy of each interview’s logistics and your reviewed learning (never raw speech) could be handed off later, with correction and removal rules. No handoff is sent until an authorized integration is available.</p><div class="row" style="margin-top:8px">${btn('rank-consent', rk.consent?'Withdraw consent':'Consent to a future handoff (version '+(rk.version+1)+')','','btn ghost sm')}${rk.consent?chip('consented · version '+rk.version,'ok'):chip('no consent')}</div></div></div>
      </div>
    </div>
  </section>`;
}

/* ---------------- SETTINGS (privacy ledger + consent + experiments) ---------------- */
function renderSettings(){
  const r=roleName();
  const mobileBits=`<div class="mobileSettingsOnly panel pad panel-gap"><h3>More destinations</h3><div class="row" style="margin-bottom:10px">${navItems().filter(x=>['intel','growth','contribute'].includes(x[0])).map(x=>`<button class="rowBtn pri" type="button" data-act="nav" data-to="${x[0]}">${esc(x[1])}</button>`).join('')}</div><h3>Account & Matrix</h3><p class="tiny">On a phone the rail foot lives here.</p>${personaSelect()}<a class="rowBtn" href="#matrix" data-act="matrix">↩ Back to Matrix</a></div>`;
  if(r!=='student') return `<section data-view="settings" class="live">${pageIntro({eyebrow:'Settings', title:'Settings and <em>boundaries</em>.', value:'Role views come from the signed MissionMed role. Your identity and role are verified by MissionMed.'})}${mobileBits}${renderBoundaries()}</section>`;
  return `<section data-view="settings" class="live">${pageIntro({eyebrow:'Settings · Privacy', title:'What InterviewIQ holds about you, <em>and who can see it</em>.', value:'Twenty seconds to read. Every switch here takes effect across preparation, rehearsal, printing and sharing. Export gives you only your own season.'})}${mobileBits}${renderMe()}<div style="margin-top:22px">${renderBoundaries()}</div></section>`;
}

/* ---------------- Role homes ---------------- */
function renderMentorHome(){
  const assigned=S.mentorAssigned; const ivs=S.interviews.filter(i=>i.saved&&assigned.includes(i.owner)&&!isInactive(i)&&i.instant&&i.instant>now());
  return `<section data-view="home" class="live">
    <div class="homeHero"><div class="b1515HomeIdentity"><div class="b1515HomeAvatar" aria-hidden="true">M</div><div class="greet">${greetingWord()}, <em>Mentor</em>.</div></div><div class="greetSub">Your students, within scope. Where can I take you today?</div><div class="b1515HomeHow"><span>How this works</span>${assigned.length} assigned student${assigned.length===1?'':'s'} · interview logistics and student-approved preparation gaps only.</div>
      <div class="tryRow"><span class="tryLbl">Suggested</span><button class="cChip" type="button" data-act="nav" data-to="mentor"><b>Mentor Command</b> · assigned students</button><button class="cChip" type="button" data-act="nav" data-to="mentorcal"><b>Students’ calendar</b> · logistics</button></div></div>
    <div class="homeGrid"><div class="panel"><div class="pHead"><div class="h2">Upcoming <em>interviews</em></div></div><div class="pBody">${ivs.length? ivs.map(i=>`<button class="shortItem" type="button" data-act="cal-item" data-item="iv-${i.id}"><span class="si">${esc(i.owner)} · ${esc(title(i))}</span><span class="sd">${fmtInZone(i.instant,i.zone)} program time · ${i.joinVerified?'joining details checked':'joining details not yet checked'}</span><span class="rowBtn">Open</span></button>`).join('') : '<div class="storyEmpty">No upcoming interview for your assigned students.</div>'}</div></div>
    <div class="panel"><div class="pHead"><div class="h2">Scope</div></div><div class="pBody"><p class="tiny">Excluded: ${esc(['raw speech','private stories','unapproved notes','unassigned students'].join(', '))}. A role alone grants no student view; only the current assignment does.</p></div></div></div>
  </section>`;
}
function renderAdminHome(){
  const pending=S.reviewQueue.filter(r=>r.status==='pending').length; const subs=S.contrib.submissions.filter(s=>s.status==='review').length;
  return `<section data-view="home" class="live">
    <div class="homeHero"><div class="b1515HomeIdentity"><div class="b1515HomeAvatar" aria-hidden="true">A</div><div class="greet">${greetingWord()}, <em>Admin</em>.</div></div><div class="greetSub">Four decisions. No shortcuts.</div><div class="b1515HomeHow"><span>How this works</span>Execution is not quality. Quality is not publication. Publication is not credit. Every change is audited.</div>
      <div class="tryRow"><span class="tryLbl">Suggested</span><button class="cChip" type="button" data-act="nav" data-to="review"><b>Research Review</b> · ${pending} excerpt${pending===1?'':'s'} pending, ${subs} submission${subs===1?'':'s'} in review</button><button class="cChip" type="button" data-act="nav" data-to="policy"><b>Policy</b> · access floor, grants, mentor scope</button></div></div>
    <div class="homeGrid"><div class="panel"><div class="pHead"><div class="h2">Audit <em>log</em></div></div><div class="pBody"><ul class="hist">${S.policy.audit.slice(0,8).map(a=>`<li><time>${fmtStamp(a.at)}</time>${esc(a.by)}: ${esc(a.text)}</li>`).join('')||'<li class="tiny">Empty.</li>'}</ul></div></div>
    <div class="panel"><div class="pHead"><div class="h2">Boundaries</div></div><div class="pBody"><p class="tiny">Administrators never see a student’s private preparation, raw speech or notes. Review handles only what a student explicitly sent. The protected research floor cannot be removed by a toggle.</p></div></div></div>
  </section>`;
}
function renderReviewPage(){ return `<section data-view="review" class="live">${pageIntro({eyebrow:'Research Review', title:'Shared intelligence and <em>contributions</em>.', value:'Student excerpts enter only when a student sent them with permitted use confirmed. Contribution packages are parsed as data, never executed; originals are immutable.'})}${renderAdminReview()}</section>`; }
function renderPolicyPage(){ return `<section data-view="policy" class="live">${pageIntro({eyebrow:'Policy', title:'Access, grants and <em>scope</em>.', value:'One predicate decides research access on every surface. Toggles cannot remove the protected floor. Suspension is a separate audited precedence decision.'})}${renderAdminPolicy()}</section>`; }

/* ---------------- Root render ---------------- */
function render(){syncLoiCompositionView();
  renderShell();
  const r=S.ui.route; const role=roleName(); let html='';
  if(role==='mentor'){ html = r==='mentor'? `<section data-view="mentor" class="live">${renderMentor()}</section>` : r==='mentorcal'? renderCalendar() : r==='settings'? renderSettings() : renderHome(); }
  else if(role==='admin'){ html = r==='review'? renderReviewPage() : r==='policy'? renderPolicyPage() : r==='settings'? renderSettings() : renderHome(); }
  else { html = {home:renderHome, calendar:renderCalendar, interviews:renderInterviews, letters:renderMyLetters, prepare:renderPrepare, intel:renderIntel, debriefs:renderDebriefs, growth:renderGrowth, settings:renderSettings, contribute:()=>`<section data-view="contribute" class="live">${renderContribute()}</section>`}[r]?.() || renderHome(); }
  const openSet=new Set([...document.querySelectorAll('main details[open] > summary')].map(s=>s.textContent.trim()));
  if(!(r==='interviews' && S.ui.open)) html='<p class="print-hint route-hint">This page is not designed for paper. To print a day sheet, open an interview’s Interview day section.</p>'+html;
  if(coreOnly()&&!coreRoute(r))html=comingSoonPanel(navItems().find(x=>x[0]===r)?.[1]||r)+html;
  document.getElementById('main').innerHTML=html;
  document.querySelectorAll('main details > summary').forEach(s=>{ if(openSet.has(s.textContent.trim())) s.parentElement.open=true; });
  renderDrawer();
  applyDrafts();
  markComingSoonActions();
  if(document.body.classList.contains('opening-active'))for(const id of ['main','hdr','rail','drawer'])document.getElementById(id).inert=true;
}
function renderSpeechOnly(iid){
  const i=S.interviews.find(x=>x.id===iid); const db=getDebrief(i); const box=document.getElementById('speech-'+iid); if(!box) return;
  box.innerHTML=db.raw.map(r=>`<span class="seg ${!r.complete&&db.speech.status==='live'?'live':''}">${esc(r.text)}</span>`).join('');
  const t=document.getElementById('timer-'+iid); if(t&&db.latency.length) t.textContent='first text in '+db.latency[0]+' ms';
  if(db.speech.status==='done') render();
}
function focusSection(){ const el=document.querySelector('.section'); if(el){ el.focus({preventScroll:false}); document.getElementById('main').scrollTo({top:0}); } }

function loiTargetChoices(target,programRef=''){const attrs=target?`data-id="${esc(target.targetId)}"`:`data-program-ref="${esc(programRef)}"`;return `<div class="row">${[['CREATE_LETTER','CREATE LETTER'],['MAYBE_LATER','MAYBE LATER'],['SKIP','SKIP']].map(([choice,label])=>btn('loitarget-choice',label,`${attrs} data-choice="${choice}" aria-pressed="${target?.choice===choice}"`,'btn ghost')).join('')}</div>`;}
function renderLoiManualAdd(target=null){const selected=S.ui.loiTargetManualProgram;return `<div class="panel pad"><h3>${target?'Resolve this program target':'Add a program without an interview'}</h3><p class="tiny">Select the exact verified registry match, or retain the original name unresolved. This never adds an interview or starts research.</p><label class="f" for="loi-target-name">Program name or registry search</label><input id="loi-target-name" maxlength="500" value="${esc(target?.programName||'')}" placeholder="Program or hospital name"><div class="row">${btn('loitarget-search','Search registry',programSearchAllowed()?'':'disabled','btn ghost')}${target?'':`<label class="f" for="loi-target-choice">Letter choice</label><select id="loi-target-choice"><option value="MAYBE_LATER">Maybe later</option><option value="CREATE_LETTER">Create letter</option><option value="SKIP">Skip</option></select>${btn('loitarget-add',selected?'Save selected program':'Save name unresolved','','btn ghost')}`}</div>${selected&&!target?`<p id="loi-target-selected" role="status">Selected: ${esc(programLabel(selected))}. Reconfirm the exact program and track before saving.</p>`:''}<div id="loi-target-search-results">${loiTargetSearch.map(p=>btn('loitarget-select',programLabel(p),`data-program="${esc(p.id)}"`,'btn ghost')).join('')||'<p class="tiny">No registry selection yet. An unresolved name cannot provide verified evidence.</p>'}</div></div>`;}
function renderLoiTargetEditor(){const row=loiTargetRow(S.ui.loiTargetOpen);if(!row)return '<div class="panel pad" role="status">This program target is unavailable. Return to My Letters.</div>'+btn('loitarget-close','Back to My Letters');const i=loiTargetSubject(row.targetId);return `<div class="panel pad">${btn('loitarget-close','← My Letters','','btn ghost')}<h2>${esc(i.programName||'Unresolved program target')}</h2><p class="tiny">Private program target · ${esc(row.resolutionState)} · ${esc(row.choice.replaceAll('_',' '))}. Evidence readiness is unknown until a current supported evidence read.</p>${loiTargetChoices(row)}${row.resolutionState!=='MATCHED'?renderLoiManualAdd(row):row.choice==='CREATE_LETTER'?renderLoi(i):`<p role="status">Choose CREATE LETTER explicitly to build, edit, approve or prepare outreach. Existing private history is retained.</p><details><summary>Retained private history</summary>${(row.loi?.history||[]).map(h=>`<p>${esc(h.state||'unavailable')}</p>${h.text?`<pre style="white-space:pre-wrap">${esc(h.text)}</pre>`:''}`).join('')}</details>`}</div>`;}
function renderProgramMyLetters(){const groups=loiProgramGroups(),saved=currentSavedPage();return `<div class="panel pad"><h2>Your programs and letters</h2><p class="tiny">Your own RISE Saved Programs and private program targets appear alongside retained interview letters. Matching canonical IDs are grouped here; every letter and original source remains separate. Evidence readiness is UNKNOWN until current evidence is read. ${myerasEnabled()?'Import your applied programs without sharing credentials.':loiCompositionEnabled()?'Writing approaches and standard drafting are available. MyERAS import is not active.':'Standard drafting is available; AI and MyERAS import are not active.'}</p>${S.loiTargets?.savedStatus!=='available'&&!saved?'<p role="status">Saved Programs is temporarily unavailable. Your private targets and existing interview letters remain available.</p>':''}${saved?`<p role="status">RISE Saved Programs · page ${esc(saved.page)} · ${esc(saved.records.length)} shown of ${esc(saved.total)}. ${saved.truncated?'This read is bounded to the first 2000 records; the remaining total is retained.':''}</p><div class="row">${btn('loitarget-page','Previous',`data-page="${saved.page-1}" ${saved.page<=1?'disabled':''}`,'btn ghost')}${btn('loitarget-page','Next',`data-page="${saved.page+1}" ${!saved.hasMore?'disabled':''}`,'btn ghost')}</div>`:''}${groups.length?groups.map(g=>`<div class="panel pad" style="margin-top:12px"><h3>${esc(g.label)}</h3>${g.saved.map(s=>`<p class="tiny">RISE Saved · ${esc(s.state)} · priority ${esc(s.priority??'not set')} · updated ${esc(s.updatedAt)} · ${esc(s.identityState)} · evidence UNKNOWN.</p>${loiTargetChoices(g.targets.find(t=>t.program?.id===s.program?.id||!t.program&&t.sources?.some(x=>x.source==='RISE_SAVED'&&x.programRef===s.programRef)),s.programRef)}`).join('')}${g.targets.map(t=>{const i=loiTargetSubject(t.targetId);return `<p>Private target · ${esc(loiLetterStatus(i))} · ${esc(t.choice.replaceAll('_',' '))} · ${esc(t.resolutionState)}</p><p class="tiny">Sources: ${esc((t.sources||[]).map(s=>s.source).join(', '))}. ${esc(i.track||'Track not specified')} · registry ${esc(i.registryReleaseId||'unresolved')}.</p>${btn('loitarget-open','OPEN PROGRAM LETTER',`data-id="${esc(t.targetId)}"`,'btn ghost')}${g.saved.length?'':loiTargetChoices(t)}`;}).join('')}${g.interviews.map(i=>`<p>Interview letter · ${esc(i.programName||title(i))} · ${esc(loiLetterStatus(i))} · interview ${esc(i.state)}${i.date?' · '+esc(i.date):''}.</p>${btn('open-section',loiState(i).current?'CONTINUE INTERVIEW LETTER':'CREATE INTERVIEW LETTER',`data-id="${esc(i.id)}" data-section="loi"`,'btn ghost')}`).join('')}</div>`).join(''):'<div class="storyEmpty">No saved programs, private targets or interview letters are loaded.</div>'}${renderLoiManualAdd()}</div>`;}

function loiStyleEntry(){return loiCompositionEnabled()?`<div class="loiComposition row" style="margin-bottom:16px">${btn('loi-style-open','MY LOI STYLE','','btn ghost')}<span class="tiny">Default for new letters: ${esc(compositionLabel(S.loiPreferences?.defaultApproach||'DIRECT_CONCISE'))}. Existing letters remain unchanged.</span></div>`:'';}
function renderLoiStyle(){if(!loiCompositionEnabled())return '<p>Writing approaches are unavailable for this workspace.</p>';const prefs=S.loiPreferences||{defaultApproach:'DIRECT_CONCISE',version:0};return `<section class="loiComposition"><h2>My <em>LOI Style</em></h2><p>Your default shapes new letters only. Changing it does not generate, rewrite, approve or send any letter.</p><div class="drawerChoice">${LOI_APPROACHES.map(a=>`<label class="panel pad" style="display:block"><input type="radio" name="loi-composition-default" id="loi-composition-default-${a[0]}" value="${a[0]}" ${a[0]===(S.ui.loiStyleChoice||prefs.defaultApproach)?'checked':''}> <b>${esc(a[1])}</b><small style="display:block">${esc(a[2])}</small></label>`).join('')}</div><p class="tiny">Post-Interview Reflective and Update-Led require you to confirm the actual context for each composition request. Every approach uses the same confirmed factual truth.</p><div class="row">${btn('loi-style-save','Save my default')}${btn('loi-style-read','Read saved default','','btn ghost')}</div></section>`;}
