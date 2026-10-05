'use strict';
// Signed bootstrap is the only source of identity. Tokens and private drafts stay in memory.
let S=null, F={}, actor=null, capabilities={}, integrations={}, version=null;
let session=null, commandQueue=Promise.resolve(), serverClockOffset=0;
let administratorPreview=false, administratorWorkspace=null;
const studentPreview=()=>administratorPreview===true&&actor?.role==='admin';
function previewError(){return Error('Administrator Student Preview does not save changes or run integrations. Return to Admin View for your administrator tools.');}
const draftValues=new Map(),pendingCommands=new Map(),researchBriefs=new Map(),loiEvidence=new Map(),loiHandoffs=new Map(),loiInputIds=new Map();
const clone=o=>JSON.parse(JSON.stringify(o));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ownKeys=['why','questions','practice','debriefs','learning','rank','demands','results','shared','consents','mentorPriority','loi'];
const defaultUI=()=>({route:'home',open:null,section:null,essentials:false,printSel:{story:false,note:false,points:false,support:false},sub:{},cal:{ym:new Date().toISOString().slice(0,7),view:'month',sel:null},drawer:null});
const CORE_COMMANDS=new Set(['interview.create','interview.identity','interview.schedule','interview.lifecycle','event.create','event.update']);
const CORE_ACTIONS=new Set(['switch-view','nav','matrix','open-interview','open-card','close-interview','close-card','open-section','section','cal-nav','cal-today','cal-view','cal-day','cal-item','drawer-close','add-interview','new-offer','add-interview-save','date-undated','add-related-pick','add-related-save','offer-save','manual-identity-save','disposition','schedule-save','cancel','restore','postpone','waitlist','related-save','related-lifecycle','join-verify']);
const coreOnly=()=>capabilities.coreOnly===true;
const coreRoute=route=>['home','calendar','interviews','settings'].includes(route);
const deepResearch=()=>capabilities.deepResearch===true&&!studentPreview()&&actor?.role==='student';
const loiEnabled=()=>capabilities.loi===true&&!studentPreview()&&actor?.role==='student';
const LOI_COMMANDS=new Set(['loi.save','loi.approve','loi.evidence','loi.export','loi.handoff','loi.mark_sent']);
const coreCommand=name=>loiEnabled()&&LOI_COMMANDS.has(name)||CORE_COMMANDS.has(name)||deepResearch()&&name==='research.check';
const coreAction=name=>loiEnabled()&&name.startsWith('loi-')||CORE_ACTIONS.has(name)||deepResearch()&&['resolve','research-refresh','research-advance'].includes(name);
const coreSection=section=>loiEnabled()&&section==='loi'||deepResearch()&&section==='brief'||['identify','schedule'].includes(section);
function comingSoonBadge(){return '<span class="chip warn" style="font-size:9px;white-space:normal">COMING SOON</span>';}
function comingSoonPanel(label){return `<div class="panel amber pad" role="status" style="margin-bottom:1rem">${comingSoonBadge()}<h3>${esc(label||'This capability')}</h3><p>This capability is a preview. Its live integration is not active in this release. No recording, research, sharing or remote action will run, and text entered here is not saved.</p><p class="tiny">Your saved interviews and Calendar remain available.</p><button class="btn ghost sm" data-act="nav" data-to="calendar">Open Calendar</button></div>`;}
function openComingSoon(label){if(!S)return;openDrawer({kind:'coming-soon',label:label||'This capability'});}
function labelForAction(button){return button.dataset.label||button.dataset.app||button.dataset.section||button.textContent?.replace(/COMING SOON/g,'').trim()||'This capability';}
function markComingSoonActions(){if(!coreOnly())return;for(const button of document.querySelectorAll('[data-act]')){const action=button.dataset.act;if(!coreAction(action)){button.disabled=false;button.removeAttribute('aria-disabled');button.dataset.comingSoon='true';if(!button.querySelector('[data-soon-badge]')){const badge=document.createElement('span');badge.dataset.soonBadge='true';badge.className='chip warn';badge.style.fontSize='9px';badge.textContent='COMING SOON';button.append(badge);}}}for(const button of document.querySelectorAll('button[disabled]:not([data-act])')){button.disabled=false;button.removeAttribute('aria-disabled');button.dataset.act='coming-soon';button.insertAdjacentHTML('beforeend',comingSoonBadge());}}
function normalizeRole(role){return ({administrator:'admin',advisor:'mentor',admin:'admin',mentor:'mentor',student:'student'})[role]||null;}
function sameOriginURL(value){const u=new URL(value,location.origin);if(u.origin!==location.origin)throw Error('The signed service address does not match this site.');return u;}
function apiError(body,status){const message=body?.error?.message||body?.message||`Request failed (${status}).`;const err=new Error(message);err.status=status;err.code=body?.error?.code;return err;}
async function readJSON(response){let body;try{body=await response.json();}catch{throw Error('The service returned an unreadable response. Your draft remains in this tab.');}if(!response.ok)throw apiError(body,response.status);return body;}
async function refreshSession(){
  const first=await readJSON(await fetch('/wp-admin/admin-ajax.php?action=missionmed_interviewiq_bootstrap',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}}));
  if(!first.nonce||!first.token_endpoint)throw Error('MissionMed could not establish the InterviewIQ session.');
  const signed=await readJSON(await fetch(sameOriginURL(first.token_endpoint),{method:'POST',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','X-IIQ-Nonce':first.nonce}}));
  if(!signed.token)throw Error('MissionMed did not return a signed InterviewIQ session.');
  if(actor&&signed.actor?.id&&signed.actor.id!==actor.id){lockWorkspace('Your MissionMed account changed. Reopen the workspace to continue.');throw Error('Your account changed. Reopen the workspace.');}
  const expires=typeof signed.expires_at==='number'?signed.expires_at*1000:Date.parse(signed.expires_at||'');
  session={token:signed.token,nonce:signed.nonce||first.nonce,apiBase:sameOriginURL(first.api_base||'/interviewiq/api').pathname.replace(/\/$/,''),expiresAt:Number.isFinite(expires)?expires:Date.now()+(signed.ttl_seconds||60)*1000};
}
async function apiFetch(path,options={},retried=false){
  if(studentPreview())throw previewError();
  if(coreOnly()&&path!=='/bootstrap'&&!(deepResearch()&&path.startsWith('/programs?'))&&!(path==='/commands'&&coreCommand(JSON.parse(options.body||'{}').command))){openComingSoon('This integration');const error=Error('COMING SOON: this integration is not active.');error.code='coming_soon';throw error;}
  if(!session||session.expiresAt<Date.now()+5000){try{await refreshSession();}catch(error){if(error.status===401||error.status===403)lockWorkspace('Your session ended. Sign in through MissionMed and reopen the workspace.');throw error;}}
  const headers=new Headers(options.headers||{});headers.set('Authorization','Bearer '+session.token);headers.set('Accept','application/json');
  if(options.method&&options.method!=='GET')headers.set('X-IIQ-Nonce',session.nonce);
  const response=await fetch(session.apiBase+path,{...options,headers,credentials:'same-origin',cache:'no-store'});
  if(response.status===401&&!retried){session=null;try{await refreshSession();}catch(error){if(error.status===401||error.status===403)lockWorkspace('Your session ended. Sign in through MissionMed and reopen the workspace.');throw error;}return apiFetch(path,options,true);}
  if(response.status===401){lockWorkspace('Your session ended. Sign in through MissionMed and reopen your workspace.');}
  return readJSON(response);
}
let loiAuthorityEpoch=0;
function clearLoiMemory(){
  loiAuthorityEpoch++;loiEvidence.clear();loiHandoffs.clear();loiInputIds.clear();
  for(const key of draftValues.keys())if(key.split("::").pop().startsWith("loi-"))draftValues.delete(key);
  for(const key of pendingCommands.keys())if(LOI_COMMANDS.has(JSON.parse(key)[1]))pendingCommands.delete(key);
}
function applyBootstrap(input){
  const b=input?.bootstrap||input;
  researchBriefs.clear();
  if(!b?.actor?.id||!normalizeRole(b.actor.role)||!b.state)throw Error('The service returned an incomplete signed workspace.');
  const sameActor=actor?.id===b.actor.id&&normalizeRole(actor.role)===normalizeRole(b.actor.role);
  const ui=sameActor&&S?.ui?S.ui:defaultUI();
  if(!sameActor){clearPrivateMemory();}else if(loiEnabled()&&(b.capabilities?.loi!==true||normalizeRole(b.actor.role)!=='student'))clearLoiMemory();
  actor={...b.actor,role:normalizeRole(b.actor.role)};capabilities=b.capabilities||{};integrations=b.integrations||{};version=b.version;
  const catalog=b.catalog||{};F={...catalog,programs:catalog.programs||[],facts:catalog.facts||[],sources:catalog.sources||[],personas:catalog.profiles||[actor],student_zone:actor.zone||catalog.student_zone||'UTC',registry_release:catalog.registry_release||'current registry',label:''};
  if(!F.personas.some(p=>p.id===actor.id))F.personas.push(actor);
  const serverNow=b.server_time||b.state.clock;if(serverNow&&Number.isFinite(Date.parse(serverNow)))serverClockOffset=Date.parse(serverNow)-Date.now();
  S={...b.state,persona:actor.id,online:true,storageOk:true,interviews:(b.state.interviews||[]).map(i=>({...i,related:i.related||[],history:i.history||[],zone:i.zone||actor.zone||'UTC'})),ui};
  for(const key of ownKeys)S[key]=b.state[key]||{};
  S.reviewQueue=b.state.reviewQueue||[];S.mentorAssigned=b.state.mentorAssigned||[];S.changes=b.state.changes||[];
  S.contrib={missions:{},submissions:[],ledger:[],grants:{},...(b.state.contrib||{})};
  S.policy={audit:[],suspended:{},...(b.state.policy||{})};S.lastVisit=b.state.lastVisit||now();
  if(!sameActor)S.ui.cal.ym=ymOf(todayKey());
  for(const [id,handoff] of loiHandoffs){const i=S.interviews.find(i=>i.id===id);if(!i||!loiEnabled()||handoff.binding!==loiHandoffBinding(i))loiHandoffs.delete(id);}
}
async function refreshWorkspace(){const identity=actor?.id,b=await apiFetch('/bootstrap');if(identity&&identity!==actor?.id)throw Error('The account changed while the workspace was loading. Reopen the intended workspace.');applyBootstrap(b);return b;}
async function command(name,interviewId=null,data={},options={}){
  if(studentPreview())throw previewError();
  if(coreOnly()&&!coreCommand(name)){openComingSoon(name.split('.')[0]);return {comingSoon:true};}
  const loiEpoch=loiAuthorityEpoch,loiCommand=LOI_COMMANDS.has(name);
  const identity=actor?.id,requestKey=JSON.stringify([identity,name,interviewId,data]);
  const draftSnapshot=savedDraftIds(name,interviewId,data).map(id=>[draftKey(id),pendingDraft(id,undefined)]);
  const work=async()=>{
    if(loiCommand&&(!loiEnabled()||loiEpoch!==loiAuthorityEpoch))throw Error('Letter access changed. Reopen the intended workspace.');
    if(!identity||identity!==actor?.id)throw Error('The account changed before this save. Reopen the intended workspace.');
    const prior=pendingCommands.get(requestKey),payload=prior||{command:name,interviewId,data,requestId:crypto.randomUUID(),expectedVersion:version};
    pendingCommands.set(requestKey,payload);
    try{
      const result=await apiFetch('/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if(identity!==actor?.id)throw Error('The account changed while this save was in flight. Reopen the intended workspace.');
      if(loiCommand&&(!loiEnabled()||loiEpoch!==loiAuthorityEpoch))throw Error('Letter access changed while the request was in flight.');
      pendingCommands.delete(requestKey);
      for(const [key,value] of draftSnapshot)if(draftValues.get(key)===value)draftValues.delete(key);
      if(result?.bootstrap||result?.actor)applyBootstrap(result);else if(!['loi.evidence','loi.export'].includes(name))await refreshWorkspace();
      const checked=result?.researchCheck,d=checked&&S.demands[checked.interviewId];
      if(deepResearch()&&d&&checked.research&&d.requestId===checked.requestId&&d.programId===checked.programId&&d.registryReleaseId===checked.registryReleaseId&&d.version===checked.version)researchBriefs.set(checked.interviewId,checked);
      if(options.render!==false)render();
      return result;
    }catch(error){
      if(error.status>=400&&error.status<500)pendingCommands.delete(requestKey);
      if(error.status===409){await refreshWorkspace();if(options.render!==false)render();error.message='This workspace changed in another tab. The latest version is loaded; your typed draft is kept. Review it and save again.';}
      if(S)S.storageOk=false;throw error;
    }
  };
  const promise=commandQueue.then(work,work);commandQueue=promise.catch(()=>{});return promise;
}
function savedDraftIds(name,id,data){
  const form=prefix=>['name','program','track','deadline','date','time','zone','dur','travel','format','join'].map(k=>prefix+k);
  if(name==='interview.create')return form('ad-');
  if(name==='interview.schedule')return form('sd-');
  if(name==='interview.identity')return [...form('of-'),'identity-name','identity-track'];
  if(name==='event.create')return ['ar-iv','ar-kind','ar-date','ar-time','ar-zone','ar-dur','ar-fold'];
  if(name==='event.update'&&!data.action){const k=S.interviews.find(i=>i.id===id)?.related.findIndex(e=>e.id===data.eventId);return ['date','time','zone','dur','fold'].map(f=>'rel-'+f+'-'+k);}
  if(name==='loi.save')return loiFormIds(id);
  if(name==='prep.save')return [...(data.why?['why-'+id]:[]),...('questions'in data?['q-'+id]:[])];
  if(name==='debrief.save')return [...('edited'in data?['edited-'+id]:[]),...('narrative'in data?['narr-'+id]:[]),...('questions'in data?['qsel-'+id]:[]),...('fields'in data?['enc-count-'+id,'enc-count-precision-'+id,...['emphasized_topics','program_information'].flatMap(k=>['db-'+k+'-'+id,'db-'+k+'-certainty-'+id]),...(data.fields.encounters||[]).flatMap(e=>['format','roles','duration','precision'].map(k=>'enc-'+k+'-'+e.id))]:[])];
  if(name==='practice.feedback')return ['draft-'+id];
  if(name==='practice.retry')return ['retry-'+id];
  if(name==='learning.propose'||name==='learning.correct')return ['goal-'+actor.id];
  if(name==='share.submit')return ['excerpt-'+id];
  if(name==='submission.upload')return ['pkg'];
  if(name==='submission.repair')return ['repair-'+data.submissionId];
  if(name==='mentor.priority')return ['mprio-'+data.studentId];
  if(name==='mentor.nudge')return ['nudge-'+data.studentId];
  return [];
}
function clearPrivateMemory(){
  researchBriefs.clear();clearLoiMemory();draftValues.clear();pendingCommands.clear();void stopSpeech();
  if(typeof pendingAudio!=='undefined')pendingAudio.clear();
  if(typeof speechSessions!=='undefined')speechSessions.clear();
  if(typeof autosaveTimers!=='undefined'){for(const timer of autosaveTimers.values())clearTimeout(timer);autosaveTimers.clear();}
}
function lockWorkspace(message){
  administratorPreview=false;administratorWorkspace=null;
  clearPrivateMemory();S=null;F={};actor=null;capabilities={};integrations={};version=null;session=null;
  for(const id of ['rail','hdr','drawer']){const e=document.getElementById(id);if(e){e.innerHTML='';e.inert=false;e.classList.remove('open');}}
  const main=document.getElementById('main');main.inert=false;main.innerHTML=`<section class="pageIntro" style="padding:48px"><div class="h1">Your workspace is <em>protected</em>.</div><p role="alert">${esc(message)}</p><div class="row"><button class="rowBtn pri" id="retry-connection">Reopen workspace</button><a class="rowBtn" href="/member-dashboard/">Back to Matrix</a></div></section>`;
  document.getElementById('retry-connection').addEventListener('click',()=>void boot());
}
function P(id){return F.programs?.find(p=>p.id===id)||{id,name:'Program identity pending',specialty:'',track:'',zone:F.student_zone,fact_ids:[]};}
function persona(id){return F.personas?.find(p=>p.id===id)||{id,tier:null,displayName:id};}
function fact(id){return F.facts?.find(f=>f.id===id)||{id,claim:'Evidence unavailable',sources:[],status:'unknown'};}
function source(id){return F.sources?.find(s=>s.id===id)||{id,title:'Source unavailable',url:'',text:'',publisher:'',retrieved_at:'',applies:'unknown',location:'',status:'unknown'};}
function now(){return new Date(Date.now()+serverClockOffset).toISOString();}
function stamp(){return now();}
function me(){return {...persona(actor.id),...actor};}
function tier(){return actor?.tier||actor?.role;}
function isInactive(i){return ['cancelled','declined','postponed','no_show','waitlisted'].includes(i?.state);}
function owns(i){return !!i&&actor?.role==='student'&&i.owner===actor.id;}
function myInterviews(){return (S?.interviews||[]).filter(i=>owns(i)&&i.saved!==false);}
function researchAccess(studentId,programId){
  if(studentId!==actor.id)return {allow:false,reason:'This research view belongs to another identity.'};
  const decision=capabilities.researchByProgram?.[programId];
  if(decision&&typeof decision==='object')return decision;
  const allow=decision===undefined?capabilities.research===true:decision===true;
  return {allow,reason:allow?'Available through your current enrollment or grant.':'Shared research is not available under your current access.'};
}
function visibleFacts(programId){const a=researchAccess(actor.id,programId);return {...a,facts:a.allow?(P(programId).fact_ids||[]).map(fact):[]};}
function canSeeInterview(i){return owns(i)||(actor.role==='mentor'&&S.mentorAssigned.includes(i?.owner));}
function storyFor(studentId){if(studentId!==actor.id)return null;const st=persona(studentId).approved_story;return st&&S.consents[st.id]===true&&st.consent_state!=='revoked'?st:null;}
function storyDesc(st){return st?{short:st.title||'your approved experience',habit:st.title||'what you learned',moment:st.text||st.summary||'',phrase:'approved experience',words:st.themes||[]}:null;}
function questionFor(prog,st){return {text:prog.question||'What interests you about this program, and what would you bring to it?',adapted:!prog.question,generic:!prog.question};}
function coachEmphasis(prog){return {text:prog.feedback||'Use your own words and distinguish supported program information from your experience.',adapted:!prog.feedback};}
function bridge(pid,st){const f=visibleFacts(pid).facts.find(x=>x.status==='supported');return f?`The supported program detail is “${f.claim}”. Consider whether your approved experience connects to it; only describe a connection you can stand behind.`:'No supported program fact is available yet. Your approved experience remains yours to prepare with.';}
function suggestWhy(i){const st=storyFor(i.owner),f=visibleFacts(i.program).facts.find(x=>x.status==='supported');return {text:f?`I am interested in ${f.claim}. I would like to understand how I could contribute and learn through this part of your program.`:'No supported program fact is available yet; write only what you can stand behind.',basis:{fact:f?.id||null,story:st?.id||null}};}
function whyWarnings(i){return visibleFacts(i.program).facts.filter(f=>f.status!=='supported').map(f=>({id:f.id,claim:f.claim,status:f.status}));}
function getDebrief(i){const db={occurrence:null,raw:[],edited:'',proposed:null,proposedConfirmed:false,fields:{},questions:[],saved:false,exits:{},speech:{status:'idle'},latency:[],...(S.debriefs[i.id]||{})};if(db.speech.status==='live'&&speechCapture?.interviewId!==i.id)db.speech={...db.speech,status:'paused',pausedReason:'Capture is paused in this tab. Resume to continue the saved recording.'};return db;}
function riseCheatSheet(pid){const a=researchAccess(actor.id,pid);if(!a.allow)return {denied:true,reason:a.reason};return F.riseProjections?.[pid]||{payload:{high_yield_facts:[]},unknowns:[],unavailable:true};}
function storyforgeProjection(sid){return sid===actor.id&&F.storyforgeProjection?F.storyforgeProjection:{payload:{stories:[]},unavailable:true};}
function draftScope(){return S?.ui?.drawer?['drawer',S.ui.drawer.kind,S.ui.drawer.day||'',S.ui.drawer.item||''].join('|'):['page',S?.ui?.route,S?.ui?.open||'',S?.ui?.section||''].join('|');}
function draftKey(id){return draftScope()+'::'+id;}
function pendingDraft(id,fallback=''){const key=draftKey(id);return draftValues.has(key)?draftValues.get(key):fallback;}
function applyDrafts(){for(const field of document.querySelectorAll('input[id],textarea[id],select[id]')){const key=draftKey(field.id);if(draftValues.has(key)){const value=draftValues.get(key);if(field.multiple&&Array.isArray(value)){for(const option of field.options)option.selected=value.includes(option.value);}else if(field.type==='checkbox')field.checked=value===true;else field.value=value;}}}
function forgetDrafts(ids){for(const id of ids)draftValues.delete(draftKey(id));}
function setSaved(message='Saved'){const e=document.getElementById('connection-status');if(e)e.textContent=message;}
async function boot(){
  const main=document.getElementById('main');main.innerHTML='<section class="pageIntro" style="padding:48px"><div class="h1">Opening your <em>workspace</em>.</div><p role="status">Connecting to your MissionMed account…</p></section>';
  try{await refreshWorkspace();render();showOpening();}
  catch(error){lockWorkspace(error.message);}
}
