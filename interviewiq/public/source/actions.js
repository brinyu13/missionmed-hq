'use strict';
let drawerReturnFocus=null;
const val=id=>document.getElementById(id)?.value??pendingDraft(id,'');
const checked=id=>document.getElementById(id)?.checked===true;
const numeric=value=>value===''||value==null?null:Number(value);
const autosaveTimers=new Map();
const activeActions=new Set();
function iv(el){const i=S.interviews.find(x=>x.id===el.dataset.id);if(!i)throw Error('This interview is no longer available.');return i;}
function requireOwn(i){if(!owns(i))throw Error('You cannot change this interview.');}
function requireStudent(){if(actor.role!=='student')throw Error('Only students can change their own interviews.');}
function requireMentor(){if(actor.role!=='mentor')throw Error('This action requires the assigned mentor.');}
function requireAdmin(){if(actor.role!=='admin')throw Error('This action requires an administrator.');}
function go(route){stopSpeech();S.ui.route=route;S.ui.sub={};S.ui.drawer=null;render();main().scrollTo?.({top:0});if(!document.body.classList.contains('opening-active'))main().focus({preventScroll:true});}
function privateCommand(el,name,data={},options){const i=iv(el);requireOwn(i);if(name==='debrief.save'&&data.fields){const key='structure-'+i.id;clearTimeout(autosaveTimers.get(key));autosaveTimers.delete(key);}return command(name,i.id,data,options);}
function latestAttempt(i){const a=S.practice[i.id]?.at(-1);if(!a)throw Error('Start an attempt first.');return a;}
function structuredDebriefFields(i){
  const fields=clone(getDebrief(i).fields);
  if(!document.getElementById('enc-count-'+i.id))return fields;
  fields.encounter_count=numeric(val('enc-count-'+i.id));fields.encounter_count_precision=val('enc-count-precision-'+i.id);
  fields.encounters=(fields.encounters||[]).map(e=>({...e,format:val('enc-format-'+e.id),roles:[...document.getElementById('enc-roles-'+e.id).selectedOptions].map(x=>x.value),duration_minutes:numeric(val('enc-duration-'+e.id)),duration_precision:val('enc-precision-'+e.id)}));
  for(const key of ['emphasized_topics','program_information'])fields[key]={text:val('db-'+key+'-'+i.id),certainty:val('db-'+key+'-certainty-'+i.id)};
  return fields;
}
function debriefEdits(i){const db=getDebrief(i);return {fields:structuredDebriefFields(i),edited:document.getElementById('edited-'+i.id)?val('edited-'+i.id):db.edited,narrative:document.getElementById('narr-'+i.id)?val('narr-'+i.id):db.narrative||''};}
function scheduleInput(prefix){return {date:val(prefix+'date')||null,time:val(prefix+'time')||null,zone:val(prefix+'zone')||F.student_zone,allDay:prefix==='sd-'?checked('sd-allday'):!val(prefix+'time'),fold:null,duration:numeric(val(prefix+'dur')),travel_minutes:numeric(val(prefix+'travel')),format:val(prefix+'format')||null,joining:val(prefix+'join')||null};}
function validateSchedule(s){
  if(s.time&&!s.date)throw Error('A start time needs a date. Leave both blank if the program has not sent one.');
  for(const key of ['duration','travel_minutes','duration_minutes'])if(s[key]!=null&&(!Number.isFinite(s[key])||s[key]<0))throw Error('Duration and travel estimates must be positive numbers or blank.');
  if(!s.date||s.allDay||!s.time)return [];
  const candidates=resolveWall(s.date+'T'+s.time,s.zone);
  if(!candidates.length)throw Error('That local time does not exist on this date in '+s.zone+'. Choose another time.');
  if(candidates.length>1&&s.fold==null)return candidates;
  if(s.fold!=null&&(!Number.isInteger(s.fold)||!candidates[s.fold]))throw Error('Choose one of the listed clock offsets.');
  return [];
}
function foldMessage(cands){return {msg:'This clock time happens twice. Choose the offset shown on the invitation.',cands};}
function foldSelect(id){return `<label class="f" for="${id}">Clock offset (only if this time repeats)</label><select id="${id}"><option value="">Choose if required</option><option value="0">First occurrence (earlier instant)</option><option value="1">Second occurrence (later instant)</option></select>`;}
function safeNavigate(url){const u=new URL(url,location.origin);if(!['http:','https:'].includes(u.protocol))throw Error('The integration returned an invalid destination.');location.assign(u.href);}
async function saveThenNotice(name,id,data,message){await command(name,id,data);notice(message||'Saved.');}
const A={
  'switch-view'(el){return switchAdministratorView(el.dataset.view);},
  nav(el){if(el.dataset.to!=='interviews')S.ui.open=null;go(el.dataset.to);},
  'coming-soon'(el){openComingSoon(labelForAction(el));},
  'manual-identity-save'(el){return privateCommand(el,'interview.identity',{program:null,programName:val('identity-name').trim(),unresolved_input:val('identity-name').trim(),track:val('identity-track').trim()});},
  matrix(){safeNavigate(integrations.matrix?.url||'/member-dashboard/');},
  eco(el){const integration=integrations[el.dataset.app];if(!integration?.available||!integration.url)throw Error(integration?.message||'This integration is not connected yet. Your saved work remains available here.');safeNavigate(integration.url);},
  'open-interview'(el){const i=iv(el);requireOwn(i);stopSpeech();S.ui.drawer=null;S.ui.route='interviews';S.ui.open=i.id;S.ui.section=null;render();focusSection();},
  'open-card'(el){return A['open-interview'](el);},
  'close-interview'(){stopSpeech();S.ui.open=null;render();main().focus();},
  'close-card'(){A['close-interview']();},
  async 'open-section'(el){const i=iv(el);requireOwn(i);stopSpeech();S.ui.drawer=null;S.ui.open=i.id;S.ui.section=el.dataset.section;S.ui.route='interviews';render();focusSection();if(deepResearch()&&el.dataset.section==='brief'&&S.demands[i.id]?.requestId)return privateCommand(el,'research.check',{});},
  section(el){return A['open-section'](el);},
  'cal-nav'(el){S.ui.cal.ym=shiftYm(S.ui.cal.ym,+el.dataset.n);S.ui.cal.sel=S.ui.cal.ym+'-01';render();},
  'cal-today'(){S.ui.cal.ym=ymOf(todayKey());S.ui.cal.sel=todayKey();render();document.querySelector('[data-cal-day="'+todayKey()+'"]')?.focus();},
  'cal-view'(el){S.ui.cal.view=el.dataset.view;render();},
  'cal-day'(el){const day=el.dataset.day;S.ui.cal.sel=day;openDrawer({kind:'day',day,returnTo:'[data-cal-day="'+day+'"]'});},
  'cal-item'(el){openDrawer({kind:'item',item:el.dataset.item,returnTo:S.ui.drawer?.returnTo||null});},
  'drawer-close'(){closeDrawer();},
  'add-interview'(el){if(!studentPreview())requireStudent();openDrawer({kind:'add',day:el.dataset.day||null,form:{},returnTo:el.dataset.day?'[data-cal-day="'+el.dataset.day+'"]':null});},
  'new-offer'(el){return A['add-interview'](el);},
  async 'add-interview-save'(el){
    requireStudent();const d=S.ui.drawer;if(d?.kind!=='add')return;
    const form=el.dataset.fold!=null?d.form:{unresolved_input:val('ad-name').trim(),program:val('ad-program')||null,...(coreOnly()||!F.programs.length?{programName:val('ad-name').trim(),track:val('ad-track').trim()}:{}),deadline:val('ad-deadline')||null,schedule:scheduleInput('ad-')};
    if(!form.unresolved_input&&!form.program)throw Error('Write the program name as it appears on the invitation. A date is not needed.');
    if(!form.unresolved_input)form.unresolved_input=P(form.program).name;
    if(el.dataset.fold!=null)form.schedule.fold=+el.dataset.fold;
    const candidates=validateSchedule(form.schedule);d.form=form;
    if(candidates.length){d.overlap=foldMessage(candidates);renderDrawer();return;}
    const result=await command('interview.create',null,{...form,schedule:form.schedule.date?form.schedule:null,format:form.schedule.format,joining:form.schedule.joining},{render:false});
    S.ui.drawer=null;const day=form.schedule.date;if(day){S.ui.cal.sel=day;S.ui.cal.ym=ymOf(day);}render();notice('Interview saved'+(day?' on '+day:'. Date remains unknown')+'.');
  },
  async 'date-undated'(el){const i=iv(el);requireOwn(i);await command('interview.schedule',i.id,{date:el.dataset.day,time:null,zone:i.zone||F.student_zone,allDay:true,fold:null,duration:i.duration??null,travel_minutes:i.travel_minutes??null,format:i.format||null,joining:i.joining||null},{render:false});S.ui.drawer=null;render();notice('Date saved. Start time remains unknown.');},
  'add-related-pick'(el){requireStudent();openDrawer({kind:'related',day:el.dataset.day,form:{},returnTo:'[data-cal-day="'+el.dataset.day+'"]'});},
  async 'add-related-save'(){const i=S.interviews.find(x=>x.id===val('ar-iv'));requireOwn(i);const data={kind:val('ar-kind'),date:val('ar-date'),time:val('ar-time')||null,zone:val('ar-zone')||F.student_zone,fold:val('ar-fold')===''?null:+val('ar-fold'),duration_minutes:numeric(val('ar-dur')),note:'Added by the student. Not an interview encounter.'};if(!data.date)throw Error('A related event needs a date. The start time may remain unknown.');if(validateSchedule(data).length)throw Error('This time repeats. Choose the first or second clock occurrence before saving.');await command('event.create',i.id,data,{render:false});S.ui.drawer=null;render();notice('Related event saved.');},
  resolve(el){if(studentPreview()||coreOnly()&&!deepResearch()&&!loiCanonicalLookup())throw Error('Canonical program lookup is unavailable.');return privateCommand(el,'interview.identity',{program:el.dataset.program});},
  'offer-save'(el){return privateCommand(el,'interview.identity',{program:val('of-program')||null,unresolved_input:val('of-name'),...(coreOnly()||!F.programs.length?{programName:val('of-name').trim(),track:val('of-track').trim()}:{}),deadline:val('of-deadline')||null});},
  disposition(el){return privateCommand(el,'interview.lifecycle',{action:'decline'});},
  'research-refresh'(el){return privateCommand(el,deepResearch()?'research.check':'research.refresh',{});},
  'research-advance'(el){return A['research-refresh'](el);},
  async outage(){await refreshWorkspace();render();notice('Workspace connection refreshed.');},
  async 'schedule-save'(el){const i=iv(el);requireOwn(i);const data=el.dataset.fold!=null?{...S.ui.sub.sched,fold:+el.dataset.fold}:scheduleInput('sd-');if(data.allDay)data.time=null;if(el.dataset.fold==null&&data.date===i.date&&data.time===i.wall?.slice(11,16)&&data.zone===i.zone)data.fold=i.fold??null;const cands=validateSchedule(data);if(cands.length){S.ui.sub.overlap=foldMessage(cands);S.ui.sub.sched=data;render();return;}await command('interview.schedule',i.id,data,{render:false});S.ui.sub={};render();notice('Schedule saved.');},
  async cancel(el){await privateCommand(el,'interview.lifecycle',{action:'cancel'},{render:false});S.ui.drawer=null;render();notice('Cancelled. History is kept.');},
  async restore(el){await privateCommand(el,'interview.lifecycle',{action:'restore'},{render:false});S.ui.drawer=null;render();notice('Restored. Review the saved schedule with the program.');},
  postpone(el){const i=iv(el);requireOwn(i);return saveThenNotice('interview.lifecycle',i.id,{action:'postpone'},'Postponed. Previous timing and history are kept; no attendance is inferred.');},
  waitlist(el){const i=iv(el);requireOwn(i);return saveThenNotice('interview.lifecycle',i.id,{action:'waitlist'},'Waitlisted. Previous timing and history are kept; no attendance is inferred.');},
  'related-save'(el){const i=iv(el);requireOwn(i);const event=i.related[+el.dataset.k];if(!event)throw Error('This event is no longer available.');const data={eventId:event.id,kind:event.kind,date:val('rel-date-'+el.dataset.k),time:val('rel-time-'+el.dataset.k)||null,zone:val('rel-zone-'+el.dataset.k),fold:val('rel-fold-'+el.dataset.k)===''?null:+val('rel-fold-'+el.dataset.k),duration_minutes:numeric(val('rel-dur-'+el.dataset.k)),note:event.note||''};if(!data.date)throw Error('Choose the event date.');if(data.fold==null&&data.date===event.date&&data.time===event.wall?.slice(11,16)&&data.zone===event.zone)data.fold=event.fold??null;if(validateSchedule(data).length)throw Error('This time repeats. Choose the first or second clock occurrence before saving.');return saveThenNotice('event.update',i.id,data,'Related event updated.');},
  'related-lifecycle'(el){const i=iv(el);requireOwn(i);const event=i.related[+el.dataset.k];if(!event)throw Error('This event is no longer available.');return saveThenNotice('event.update',i.id,{eventId:event.id,action:el.dataset.action},el.dataset.action==='restore'?'Related event restored.':'Related event cancelled. History is kept.');},
  'join-verify'(el){return privateCommand(el,'interview.lifecycle',{action:'joining-verified'});},
  'why-suggest'(el){const i=iv(el);requireOwn(i);const suggestion=suggestWhy(i);draftValues.set(draftKey('why-'+i.id),suggestion.text);S.ui.sub.whyBasis=suggestion.basis;render();},
  'why-save'(el){const i=iv(el);requireOwn(i);const text=val('why-'+i.id);if(!text.trim())throw Error('Write something first.');return command('prep.save',i.id,{why:{text,basis:S.ui.sub.whyBasis||S.why[i.id]?.basis||null,edited:true}});},
  'questions-save'(el){return privateCommand(el,'prep.save',{questions:val('q-'+el.dataset.id)});},
  'practice-start'(el){return privateCommand(el,'practice.start',{program:iv(el).program});},
  'practice-feedback'(el){const i=iv(el);return privateCommand(el,'practice.feedback',{attemptId:latestAttempt(i).id,draft:val('draft-'+i.id)});},
  'practice-retry'(el){const i=iv(el),retry=val('retry-'+i.id);if(!retry.trim())throw Error('Write your retry first.');return privateCommand(el,'practice.retry',{attemptId:latestAttempt(i).id,retry});},
  'practice-reflect'(el){return privateCommand(el,'practice.reflect',{attemptId:latestAttempt(iv(el)).id,reflection:el.dataset.v});},
  'practice-overrule'(el){return privateCommand(el,'practice.overrule',{attemptId:latestAttempt(iv(el)).id,which:el.dataset.which,index:+el.dataset.k});},
  'practice-cancel'(el){return privateCommand(el,'practice.discard',{attemptId:latestAttempt(iv(el)).id});},
  essentials(el){S.ui.essentials=el.checked;render();},
  printsel(el){S.ui.printSel[el.dataset.k]=el.checked;render();},
  print(el){requireOwn(iv(el));window.print();},
  occurrence(el){return privateCommand(el,'debrief.occurrence',{occurrence:el.dataset.v==='clear'?null:el.dataset.v});},
  'speech-start'(el){return speechStart(iv(el));},
  'speech-pause'(){return speechPause();},
  'speech-finish'(){return speechFinish();},
  async 'ivoc-handoff'(el){const result=await privateCommand(el,'ivoc.launch',{});const url=result.launchUrl||result.launch_url;if(url)safeNavigate(url);else notice('The handoff was saved. Open IV Prep On-Call when the integration returns a launch link.');},
  'ivoc-accept'(el){return privateCommand(el,'ivoc.accept',{returnId:el.dataset.k});},
  'ivoc-dismiss'(el){return privateCommand(el,'ivoc.dismiss',{returnId:el.dataset.k});},
  propose(el){return privateCommand(el,'debrief.propose',{edited:val('edited-'+el.dataset.id)});},
  'proposal-confirm'(el){return privateCommand(el,'debrief.accept',{});},
  'proposal-reject'(el){return privateCommand(el,'debrief.reject',{});},
  field(el){const i=iv(el),fields=structuredDebriefFields(i),k=el.dataset.k,v=el.dataset.v;if(el.dataset.multi==='1'){const values=fields[k]||[];fields[k]=values.includes(v)?values.filter(x=>x!==v):[...values,v];}else fields[k]=fields[k]===v?null:v;return privateCommand(el,'debrief.save',{fields});},
  'encounter-add'(el){const i=iv(el),fields=structuredDebriefFields(i);fields.encounters=[...(fields.encounters||[]),{id:crypto.randomUUID(),format:'unknown',roles:['unknown'],duration_minutes:null,duration_precision:'unknown'}];return privateCommand(el,'debrief.save',{fields});},
  'encounter-remove'(el){const i=iv(el),fields=structuredDebriefFields(i);fields.encounters=(fields.encounters||[]).filter(e=>e.id!==el.dataset.encounter);return privateCommand(el,'debrief.save',{fields});},
  'question-add'(el){const i=iv(el),text=val('qsel-'+i.id).trim();if(!text)throw Error('Write the question you remember.');const questions=[...getDebrief(i).questions,{text,recollection:val('qrec-'+i.id),permission:'private, not shared'}];return privateCommand(el,'debrief.save',{questions});},
  'debrief-save'(el){const i=iv(el);return privateCommand(el,'debrief.save',{...debriefEdits(i),saved:true});},
  'learning-propose'(el){requireStudent();const goal=val('goal-'+actor.id).trim();if(!goal)throw Error('Write one observation you want your next rehearsal to carry.');return command('learning.propose',null,{goal,source:'student-entered'});},
  'learning-confirm'(){return command('learning.confirm');},
  'learning-correct'(){return command('learning.correct',null,{goal:val('goal-'+actor.id)});},
  'learning-revoke'(){return command('learning.revoke');},
  'mentor-visible'(el){return command('learning.mentor',null,{visible:el.checked});},
  'share-send'(el){const i=iv(el);return privateCommand(el,'share.submit',{excerpt:val('excerpt-'+i.id),permitted:checked('permitted-'+i.id),deidentified:checked('deid-'+i.id)});},
  'share-retract'(el){const q=S.reviewQueue.find(r=>r.interview===el.dataset.id&&!['retracted','rejected'].includes(r.status));if(!q)throw Error('No active review to retract.');return privateCommand(el,'share.retract',{reviewId:q.id});},
  consent(el){return command('story.consent',null,{storyId:el.dataset.story,consent:el.dataset.v==='1'});},
  'rank-consent'(){return command('rank.consent',null,{consent:!S.rank[actor.id]?.consent});},
  async export(){const r=await command('privacy.export',null,{}, {render:false});if(!r.export)throw Error('The service did not return an export.');const blob=new Blob([JSON.stringify(r.export,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='InterviewIQ-my-season.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},
  'mission-generate'(){return command('mission.create',null,{program:val('mission-program')});},
  upload(){const mission=S.contrib.missions[actor.id];if(!mission)throw Error('Generate a mission first.');const text=val('pkg');if(!text.trim())throw Error('Paste your complete package.');return command('submission.upload',null,{missionId:mission.id,text});},
  repair(el){const text=val('repair-'+el.dataset.sub);if(!text.trim())throw Error('Paste the repaired package.');return command('submission.repair',null,{submissionId:el.dataset.sub,text});},
  decide(el){requireAdmin();return command('submission.decide',null,{submissionId:el.dataset.sub,decision:el.dataset.k,value:el.dataset.value,reason:val('decision-reason-'+el.dataset.sub)});},
  'review-approve'(el){requireAdmin();return command('review.approve',null,{reviewId:el.dataset.r});},
  'review-reject'(el){requireAdmin();return command('review.reject',null,{reviewId:el.dataset.r});},
  'review-retract'(el){requireAdmin();return command('review.retract',null,{reviewId:el.dataset.r});},
  policy(el){requireAdmin();return command('policy.update',null,{key:el.dataset.k,value:!S.policy[el.dataset.k],reason:val('policy-reason')});},
  'grant-revoke'(el){requireAdmin();return command('grant.revoke',null,{studentId:el.dataset.student,grantId:el.dataset.grant||null,reason:val('policy-reason')});},
  'grant-reinstate'(el){requireAdmin();return command('grant.reinstate',null,{studentId:el.dataset.student,grantId:el.dataset.grant||null,reason:val('policy-reason')});},
  'mentor-priority'(el){requireMentor();return command('mentor.priority',null,{studentId:el.dataset.student,text:val('mprio-'+el.dataset.student)});},
  nudge(el){requireMentor();return command('mentor.nudge',null,{studentId:el.dataset.student,text:val('nudge-'+el.dataset.student)});}
};
async function dispatchAction(button){
  if(studentPreview()&&!new Set(['switch-view','nav','matrix','cal-nav','cal-today','cal-view','cal-day','drawer-close','add-interview','new-offer','close-interview','close-card']).has(button.dataset.act)){notice(previewError().message);return;}
  if(!S)return;if(coreOnly()&&!coreAction(button.dataset.act)){openComingSoon(labelForAction(button));return;}if(button.disabled)return;const name=button.dataset.act,handler=A[name];if(!handler){notice('This action is not available.');return;}
  const key=[name,button.dataset.id,button.dataset.sub,button.dataset.student].join(':');if(activeActions.has(key))return;
  activeActions.add(key);button.setAttribute('aria-busy','true');
  try{await handler(button);}
  catch(error){notice(error.message);setSaved('Save not confirmed');}
  finally{activeActions.delete(key);if(button.isConnected)button.removeAttribute('aria-busy');}
}
document.addEventListener('click',ev=>{const b=ev.target.closest('[data-act]');if(!b)return;if(b.tagName==='INPUT'&&b.type==='checkbox')return;ev.preventDefault();ev.stopPropagation();void dispatchAction(b);});
document.addEventListener('click',ev=>{const cell=ev.target.closest('[data-cal-day]');if(!cell||ev.target.closest('[data-act]')||!S)return;A['cal-day']({dataset:{day:cell.dataset.calDay}});});
document.addEventListener('change',ev=>{const b=ev.target;if(b.matches('[data-act]')&&b.type==='checkbox')void dispatchAction(b);});
document.addEventListener('keydown',ev=>{
  if(!S)return;
  if((ev.key==='Enter'||ev.key===' ')&&ev.target.matches('[role="button"][data-act]')){ev.preventDefault();void dispatchAction(ev.target);return;}
  if(S.ui.drawer){if(ev.key==='Escape'){ev.preventDefault();closeDrawer();return;}if(ev.key==='Tab'){const drawer=document.querySelector('.mcv2-drawer'),nodes=[...drawer.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')];const first=nodes[0],last=nodes.at(-1);if(ev.shiftKey&&document.activeElement===first){ev.preventDefault();last?.focus();}else if(!ev.shiftKey&&document.activeElement===last){ev.preventDefault();first?.focus();}return;}}
  if(ev.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'')){const o=document.getElementById('omni');if(o){ev.preventDefault();o.focus();}return;}
  const cell=ev.target.closest?.('[data-cal-day]');if(!cell||ev.target.closest('[data-act]'))return;
  const movement={ArrowRight:1,ArrowLeft:-1,ArrowDown:7,ArrowUp:-7};let delta=movement[ev.key];
  if(ev.key==='Home')delta=-new Date(cell.dataset.calDay+'T12:00:00Z').getUTCDay();
  if(ev.key==='End')delta=6-new Date(cell.dataset.calDay+'T12:00:00Z').getUTCDay();
  if(delta!=null){ev.preventDefault();const key=new Date(Date.parse(cell.dataset.calDay+'T12:00:00Z')+delta*86400000).toISOString().slice(0,10);S.ui.cal.sel=key;if(!document.querySelector('[data-cal-day="'+key+'"]')){S.ui.cal.ym=ymOf(key);render();}document.querySelectorAll('[data-cal-day]').forEach(n=>n.tabIndex=n.dataset.calDay===key?0:-1);document.querySelector('[data-cal-day="'+key+'"]')?.focus();return;}
  if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();A['cal-day']({dataset:{day:cell.dataset.calDay}});}
});
document.addEventListener('input',ev=>{
  const t=ev.target;if(!S||!t.id||!('value'in t)||t.type==='password')return;draftValues.set(draftKey(t.id),t.type==='checkbox'?t.checked:t.multiple?[...t.selectedOptions].map(x=>x.value):t.value);
  if(t.id.startsWith('loi-')&&!t.id.startsWith('loi-sentConfirmed-')&&!t.id.startsWith('loi-copyText-')){loiHandoffs.delete(S.ui.open);const prepared=document.querySelector('[data-act="loi-gmail"]')?.closest('.panel');if(prepared)prepared.remove();}
  if(t.id==='ad-name'||t.id==='program-search')scheduleProgramSearch(t.value,t.id);
  if(coreOnly()&&t.dataset.autosave){setSaved('Preview · not saved');return;}
  if(!t.dataset.autosave)return;const i=S.interviews.find(x=>x.id===t.dataset.id);if(!owns(i))return;
  const kind=t.dataset.autosave;if(kind==='why'){const warn=document.getElementById('why-warn-'+i.id);if(warn)warn.innerHTML=whyWarningHTML(i,t.value);}
  const scope=draftKey(t.id),value=draftValues.get(scope),timerKey=kind==='structure'?'structure-'+i.id:scope;
  clearTimeout(autosaveTimers.get(timerKey));setSaved('Draft pending');
  if(!['why','edited','narrative','structure'].includes(kind))return;
  const data=kind==='why'?{why:{text:value,basis:S.why[i.id]?.basis||null,edited:true}}:kind==='structure'?{fields:structuredDebriefFields(i)}:{[kind]:value};
  const timer=setTimeout(async()=>{try{await command(kind==='why'?'prep.save':'debrief.save',i.id,data,{render:false});if(draftValues.get(scope)===value)draftValues.delete(scope);setSaved('Saved');const status=document.getElementById('autosave-'+i.id);if(status)status.textContent='Saved '+fmtStamp(now());}catch(error){setSaved('Draft not saved');notice(error.message);}finally{if(autosaveTimers.get(timerKey)===timer)autosaveTimers.delete(timerKey);}},650);
  autosaveTimers.set(timerKey,timer);
});
window.addEventListener('beforeunload',ev=>{if(autosaveTimers.size||pendingAudio.size){ev.preventDefault();ev.returnValue='';}});
window.addEventListener('pagehide',()=>stopSpeech());
window.addEventListener('beforeprint',()=>document.querySelectorAll('.support').forEach(el=>el.style.display=S.ui.printSel.support?'block':'none'));
let searchTimer=null,searchSequence=0;
function scheduleProgramSearch(q,id){clearTimeout(searchTimer);const seq=++searchSequence,identity=actor?.id,open=S?.ui.open;if(!programSearchAllowed()||q.trim().length<2)return;searchTimer=setTimeout(async()=>{try{const r=await apiFetch('/programs?q='+encodeURIComponent(q.trim()));if(seq!==searchSequence||actor?.id!==identity||!programSearchAllowed()||id==='program-search'&&S?.ui.open!==open)return;for(const p of r.programs||[]){const ix=F.programs.findIndex(x=>x.id===p.id);if(ix<0)F.programs.push(p);else F.programs[ix]={...F.programs[ix],...p,fact_ids:F.programs[ix].fact_ids||p.fact_ids||[]};}const select=document.getElementById('ad-program');if(select){const current=select.value;select.innerHTML='<option value="">I will confirm later</option>'+(r.programs||[]).map(p=>`<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.track)}</option>`).join('');select.value=current;}if(id==='program-search'){const box=document.getElementById('program-search-results');if(box)box.innerHTML=(r.programs||[]).map(p=>`<button class="choice" data-act="resolve" data-id="${esc(S.ui.open)}" data-program="${esc(p.id)}"><b>${esc(p.name)}</b><small>${esc(p.specialty)} · ${esc(p.track)}</small></button>`).join('')||'<p>No registry matches. Keep the offer unresolved.</p>';}}catch(error){notice(error.message);}},300);}
function runCommand(query){
  const t=(query||'').toLowerCase().trim();if(!t)return;
  if(roleName()!=='student'){go(roleName()==='mentor'?(/calendar/.test(t)?'mentorcal':'mentor'):(/policy|access|grant/.test(t)?'policy':'review'));return;}
  const list=rankedInterviews(myInterviews());const byName=list.find(i=>title(i).toLowerCase().split(/[^a-z]+/).some(w=>w.length>3&&t.includes(w)));
  const section=/day|print|join|sheet/.test(t)?'day':/debrief|happen|capture|report|reflect/.test(t)?'debrief':/rehears|practi|mock|question/.test(t)?'rehearse':/why|talking|points/.test(t)?'why':/brief|research|evidence|source|fact/.test(t)?'brief':/schedule|date|time|reschedul|cancel|zone/.test(t)?'schedule':/learn|goal|lesson/.test(t)?'learned':null;
  const routes=[[/privacy|consent|setting|export|experiment|boundar|camera/,'settings'],[/calendar|month|agenda|week/,'calendar'],[/growth|goal|learn/,'growth'],[/intel|rise|cheat/,'intel'],[/prepare|prep\b/,'prepare'],[/contribut|mission|research access/,'contribute']];
  if(!byName){for(const [re,route]of routes)if(re.test(t)){go(route);return;}if(/offer|invitation|new interview|add/.test(t)){A['add-interview']({dataset:{}});return;}}
  const target=byName||(section==='debrief'?list.find(i=>i.instant&&i.instant<=now()):section?list.find(i=>!isInactive(i)&&i.program):null)||(/next|first|top|what should i do/.test(t)?list[0]:null);
  if(target){A['open-section']({dataset:{id:target.id,section:section||nextMove(target).section}});return;}if(/interview/.test(t)){go('interviews');return;}notice('Try an interview name, “calendar”, “next interview”, “prepare”, “debrief” or “settings”.');
}
document.addEventListener('submit',ev=>{if(ev.target.id==='cmdform'||ev.target.id==='omniform'){ev.preventDefault();runCommand(val(ev.target.id==='cmdform'?'cmd':'omni'));}});

// Microphone capture uses independently decodable segments; raw transcription never overwrites the account.
let speechCapture=null,audioFlushPromise=null,captureEpoch=0;
const speechSessions=new Map();
const pendingAudio=new Map();
function stopSpeech(){captureEpoch++;const capture=speechCapture;if(!capture)return Promise.resolve();capture.active=false;clearTimeout(capture.timer);if(capture.recorder?.state==='recording')capture.recorder.stop();capture.stream?.getTracks().forEach(t=>t.stop());speechCapture=null;return capture.stopped||Promise.resolve();}
function recordingState(id,status,message){if(!S)return;const i=S.interviews.find(x=>x.id===id);if(!i||!owns(i))return;const db=getDebrief(i);S.debriefs[id]={...db,speech:{...db.speech,status,pausedReason:message||null}};if(S.ui.open===id&&S.ui.section==='debrief')render();}
async function recordingCommand(id,action){const result=await apiFetch('/recordings/'+encodeURIComponent(id)+'/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID()})});if(result.bootstrap)applyBootstrap(result);return result;}
async function flushAudio(){
  if(audioFlushPromise)return audioFlushPromise;
  audioFlushPromise=(async()=>{for(const [key,item]of pendingAudio){if(item.actorId!==actor?.id){pendingAudio.delete(key);continue;}
    try{const r=await apiFetch('/recordings/'+encodeURIComponent(item.recordingId)+'/segments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item.payload)});if(actor?.id!==item.actorId)return;if(r.bootstrap)applyBootstrap(r);pendingAudio.delete(key);if(speechCapture?.active)recordingState(item.interviewId,'live');else if(S.ui.open===item.interviewId&&S.ui.section==='debrief')render();}
    catch(error){recordingState(item.interviewId,'network','Segment waiting to upload. Keep this tab open and resume when connected. '+error.message);break;}
  }})();
  try{await audioFlushPromise;}finally{audioFlushPromise=null;}
}
function blobBase64(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error('Audio could not be read.'));reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(blob);});}
function recordSegment(capture){
  if(!capture.active||actor?.id!==capture.actorId)return;
  const chunks=[],started=performance.now(),recorder=new MediaRecorder(capture.stream,{mimeType:capture.mimeType});capture.recorder=recorder;
  let stopped;capture.stopped=new Promise(resolve=>stopped=resolve);
  recorder.addEventListener('dataavailable',ev=>{if(ev.data.size)chunks.push(ev.data);});
  recorder.addEventListener('error',()=>{void stopSpeech();recordingState(capture.interviewId,'paused','Microphone recording stopped. Your typed account is safe.');});
  recorder.addEventListener('stop',async()=>{clearTimeout(capture.timer);const durationMs=Math.round(performance.now()-started),blob=new Blob(chunks,{type:capture.mimeType}),seq=capture.seq++;if(capture.active)recordSegment(capture);
    try{if(!blob.size||actor?.id!==capture.actorId)return;if(blob.size>1048576){recordingState(capture.interviewId,'paused','Audio segment exceeded the upload limit. Pause and retry.');void stopSpeech();return;}const segmentId=crypto.randomUUID(),payload={segmentId,seq,contentType:capture.mimeType,audioBase64:await blobBase64(blob),durationMs};if(actor?.id!==capture.actorId)return;pendingAudio.set(segmentId,{actorId:capture.actorId,interviewId:capture.interviewId,recordingId:capture.id,payload});await flushAudio();}finally{stopped();}
  });
  recorder.start();capture.timer=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},4000);
}
async function speechStart(i){
  if(coreOnly()){openComingSoon('Voice debrief');return;}
  requireOwn(i);if(!integrations.speech?.available)throw Error(integrations.speech?.message||'Speech transcription is not connected. You can type and save your account.');
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')throw Error('This browser cannot record audio. Type your account below.');
  if(speechCapture?.interviewId===i.id&&speechCapture.active)return;await stopSpeech();const ownerId=actor.id,epoch=captureEpoch;
  let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:true});}catch(error){recordingState(i.id,'denied','Microphone access was not granted. You can still type your account.');throw error;}
  let mimeType=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(type=>MediaRecorder.isTypeSupported(type));if(!mimeType){stream.getTracks().forEach(t=>t.stop());throw Error('No supported recording format in this browser.');}
  try{
    await flushAudio();if(actor?.id!==ownerId||captureEpoch!==epoch)throw Error('The workspace changed during microphone setup. Start capture again from your debrief.');
    let prior=speechSessions.get(i.id),r;
    const db=getDebrief(i);if(!prior&&db.speech.recordingId&&!['done','idle'].includes(db.speech.status)){const recovered=await apiFetch('/recordings/'+encodeURIComponent(db.speech.recordingId));prior={id:db.speech.recordingId,seq:recovered.nextSeq??(recovered.segments?.length||0),actorId:ownerId,mimeType:recovered.mimeType};}
    if(prior?.mimeType){if(!MediaRecorder.isTypeSupported(prior.mimeType))throw Error('This browser cannot resume the saved audio format. Continue with typed notes or use the original browser.');mimeType=prior.mimeType;}
    if(prior&&prior.actorId===ownerId){r=await recordingCommand(prior.id,'resume');r={...r,recordingId:prior.id,nextSeq:r.nextSeq??prior.seq};}
    else r=await apiFetch('/recordings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({interviewId:i.id,requestId:crypto.randomUUID(),mimeType})});
    if(!r.recordingId)throw Error('Recording session was not created.');if(r.bootstrap)applyBootstrap(r);
    speechCapture={id:r.recordingId,interviewId:i.id,actorId:ownerId,mimeType,stream,active:true,seq:r.nextSeq||0};speechSessions.set(i.id,speechCapture);recordingState(i.id,'live');recordSegment(speechCapture);
  }catch(error){stream.getTracks().forEach(t=>t.stop());throw error;}
}
async function speechPause(){const capture=speechCapture;if(!capture)return;await stopSpeech();await recordingCommand(capture.id,'pause');recordingState(capture.interviewId,'paused','Paused. Saved transcript and typed account are retained.');}
async function speechFinish(){const capture=speechCapture||speechSessions.get(S.ui.open);if(!capture)return;await stopSpeech();await flushAudio();if([...pendingAudio.values()].some(x=>x.recordingId===capture.id))throw Error('Audio is waiting to upload. Keep this tab open and retry when connected.');await recordingCommand(capture.id,'finish');speechSessions.delete(capture.interviewId);recordingState(capture.interviewId,'done');}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&speechCapture)void speechPause().catch(error=>notice(error.message));});
window.addEventListener('online',()=>void flushAudio());

function ownLoi(el){const i=iv(el);requireOwn(i);if(!loiEnabled())throw Error('Letter of Interest is unavailable for this workspace.');return i;}
function currentLoiApproval(i){const h=loiState(i).current;if(!h||h.state!=='approved'||!loiState(i).currentBindingValid||loiState(i).currentConsentValid===false||loiEdited(i))throw Error('Save and approve this exact letter before preparing or recording outreach.');return{...loiHeadData(i),contentHash:h.contentHash};}
function currentLoiHandoff(i){currentLoiApproval(i);const h=loiHandoffs.get(i.id);if(!h||h.binding!==loiHandoffBinding(i)||h.recipient!==val('loi-recipient-'+i.id)||h.subject!==val('loi-subject-'+i.id)||!loiConfirmed('loi-recipientConfirmed-'+i.id)){loiHandoffs.delete(i.id);throw Error('Prepare and review this approved letter and destination first.');}return h;}
Object.assign(A,{
 async 'loi-evidence'(el){const i=ownLoi(el),identity=actor.id;try{const r=await command('loi.evidence',i.id,{}, {render:false});if(actor?.id!==identity||!loiEnabled())throw Error('Your account changed.');loiEvidence.set(i.id,r);}catch(e){if(actor?.id===identity&&loiEnabled())loiEvidence.set(i.id,{error:e.message});throw e;}finally{if(actor?.id===identity)render();}},
 'loi-build'(el){const i=ownLoi(el),d=loiDraftData(i);if(!d.studentFactualConfirmation)throw Error('Confirm your actual facts and statuses before building.');const evidence=loiEvidence.get(i.id)?.research?.facts||[],selected=evidence.filter(f=>d.selectedEvidence.some(x=>x.field===f.field&&x.claimRef===f.claimRef));const text=[loiEvidence.get(i.id)?.program?.name||'',d.context.whyNow,...d.motivations.filter(x=>x.confirmed).map(x=>x.text),...d.facts.filter(x=>x.confirmed).map(x=>x.text),...selected.map(f=>typeof f.value==='string'?f.value:JSON.stringify(f.value))].filter(Boolean).join('\n\n');if(!text)throw Error('Enter your confirmed words first.');draftValues.set(draftKey('loi-text-'+i.id),text);loiHandoffs.delete(i.id);render();notice('Draft assembled from your confirmed words and selected evidence. Edit and review it before approval.');},
 async 'loi-save'(el){const i=ownLoi(el);loiHandoffs.delete(i.id);return command('loi.save',i.id,loiDraftData(i));},
 'loi-approve'(el){const i=ownLoi(el),h=loiState(i).current;if(!h||loiState(i).currentConsentValid===false||loiEdited(i))throw Error('Save your latest edits before approval.');if(!loiConfirmed('loi-factual-'+i.id)||!loiConfirmed('loi-specific-'+i.id))throw Error('Review factual accuracy and program specificity before approval.');return command('loi.approve',i.id,{...loiHeadData(i),contentHash:h.contentHash,studentFactualConfirmation:true,studentSpecificityConfirmation:true});},
 async 'loi-handoff'(el){const i=ownLoi(el),identity=actor.id,epoch=loiAuthorityEpoch,data=currentLoiApproval(i),binding=loiHandoffBinding(i);if(!loiConfirmed('loi-recipientConfirmed-'+i.id))throw Error('Review the exact recipient and subject first.');const recipient=val('loi-recipient-'+i.id),subject=val('loi-subject-'+i.id),text=loiState(i).current.text;const r=await command('loi.handoff',i.id,{...data,recipient,subject,channel:'gmail',recipientConfirmed:true},{render:false});if(actor?.id!==identity||epoch!==loiAuthorityEpoch||!loiEnabled()||!r.handoff){if(actor?.id===identity)render();throw Error('The reviewed handoff is unavailable.');}currentLoiApproval(i);if(binding!==loiHandoffBinding(i)||val('loi-recipient-'+i.id)!==recipient||val('loi-subject-'+i.id)!==subject||!loiConfirmed('loi-recipientConfirmed-'+i.id))throw Error('The reviewed letter or destination changed. Prepare it again.');if(r.handoff.recipient!==recipient||r.handoff.subject!==subject||r.handoff.text!==text)throw Error('The reviewed letter or destination changed. Prepare it again.');if(r.handoff.gmailUrl)loiExternalURL(r.handoff.gmailUrl,'gmail',r.handoff);if(r.handoff.mailtoUrl)loiExternalURL(r.handoff.mailtoUrl,'mailto',r.handoff);loiHandoffs.set(i.id,{...r.handoff,binding});render();},
 'loi-gmail'(el){const i=ownLoi(el),h=currentLoiHandoff(i);const opened=window.open(loiExternalURL(h.gmailUrl,'gmail',h),'_blank','noopener,noreferrer');if(opened)opened.opener=null;notice('Review the draft in Gmail and press Send yourself. If no tab opens, use the copy fallback.');},
 'loi-mailto'(el){const i=ownLoi(el),h=currentLoiHandoff(i);const opened=window.open(loiExternalURL(h.mailtoUrl,'mailto',h),'_blank','noopener,noreferrer');if(opened)opened.opener=null;},
 async 'loi-copy'(el){const i=ownLoi(el),h=currentLoiHandoff(i);try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(h.text);notice('Approved letter copied. Review it in your email app.');}catch{const field=document.getElementById('loi-copyText-'+i.id);field?.focus();field?.select();notice('Clipboard unavailable. Select and copy the complete letter shown here.');}},
 'loi-mark-sent'(el){const i=ownLoi(el),h=currentLoiHandoff(i);if(!loiConfirmed('loi-sentConfirmed-'+i.id))throw Error('Confirm that you pressed Send in your email app.');return command('loi.mark_sent',i.id,{...currentLoiApproval(i),handoffId:h.handoffId,confirmed:true});},
 async 'loi-export'(el){const i=ownLoi(el),identity=actor.id,epoch=loiAuthorityEpoch,binding=loiHandoffBinding(i),r=await command('loi.export',i.id,{}, {render:false});if(actor?.id!==identity||epoch!==loiAuthorityEpoch||!loiEnabled()||!owns(i)||binding!==loiHandoffBinding(i))throw Error('Letter access changed. Private history is unavailable.');if(!r.export)throw Error('Private history is unavailable.');const blob=new Blob([JSON.stringify(r.export,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='InterviewIQ-my-letter-history.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
});
