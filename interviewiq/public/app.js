let calendarEpoch=0,cohortPage=null,itineraryPage=null,itineraryPending=null,adminCalendarTarget=null,calendarMutationPending=null,calendarMutationBusy=false,calendarTargetReadSequence=0,itineraryReadSequence=0;
const calendarV2=()=>capabilities.calendarV2===true&&!studentPreview()&&['student','admin'].includes(actor?.role);
function clearCalendarMemory(){calendarEpoch++;cohortPage=null;itineraryPage=null;itineraryPending=null;adminCalendarTarget=null;calendarMutationPending=null;calendarMutationBusy=false;calendarTargetReadSequence++;itineraryReadSequence++;}
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
const threeboxEnabled=()=>capabilities.threebox===true&&!studentPreview()&&actor?.role==='student'&&['360','ivprep_complete'].includes(actor.tier);
const THREEBOX_COMMANDS=new Set(['threebox.read','threebox.evidence','threebox.save','threebox.assemble']);
const threeboxDrafts=new Map(),threeboxEvidenceCache=new Map();let threeboxEpoch=0;
function clearThreeboxMemory(){threeboxEpoch++;threeboxDrafts.clear();threeboxEvidenceCache.clear();}
const coreOnly=()=>capabilities.coreOnly===true;
const coreRoute=route=>['home','calendar','interviews','letters','settings'].includes(route);
const deepResearch=()=>capabilities.deepResearch===true&&!studentPreview()&&actor?.role==='student';
const loiCanonicalLookup=()=>capabilities.loiCanonicalLookup===true&&!studentPreview()&&actor?.role==='student';
const intakeEnabled=()=>capabilities.intakeV2===true&&!studentPreview()&&actor?.role==='student'&&['360','ivprep_complete'].includes(actor.tier);
const intakeVisible=()=>intakeEnabled()||studentPreview();
const INTAKE_PREVIEW_ACTIONS=new Set(['intake-next','intake-back','intake-skip','intake-help','intake-new','intake-unresolved','intake-choice','intake-cal-nav','intake-cal-pick','intake-cal-clear','intake-event-add','intake-event-remove','intake-experience-add','intake-experience-remove','intake-spec-filter']);
const INTAKE_COMMANDS=new Set(['intake.create','intake.update','intake.read']);
let intakeFlow=null,intakeEpoch=0,intakeSearchSequence=0;
function clearIntakeMemory(){intakeEpoch++;intakeSearchSequence++;intakeFlow=null;if(S?.ui?.drawer?.kind==='intake')S.ui.drawer=null;for(const key of draftValues.keys())if(key.split('::').pop().startsWith('in-'))draftValues.delete(key);for(const key of pendingCommands.keys())if(INTAKE_COMMANDS.has(JSON.parse(key)[1]))pendingCommands.delete(key);}
const programSearchAllowed=()=>!studentPreview()&&(!coreOnly()||deepResearch()||loiCanonicalLookup()||intakeEnabled());
const loiEnabled=()=>capabilities.loi===true&&!studentPreview()&&actor?.role==='student';
const loiCompositionEnabled=()=>loiEnabled()&&capabilities.loiComposition===true;
const LOI_COMPOSITION_COMMANDS=new Set(['loi.preference_read','loi.preference_save','loi.generate','loi.generation_read','loi.generation_select']);
const loiProposals=new Map(),loiCompositionBusy=new Set(),loiCompositionUncertain=new Set();let loiCompositionEpoch=0,loiCompositionView=null;
const loiTargetsEnabled=()=>loiEnabled()&&capabilities.loiTargets===true;
const LOI_TARGET_COMMANDS=new Set(['loitarget.create','loitarget.update','loitarget.read','loitarget.list','loitarget.saved']);
let loiSavedPage=null,loiTargetSearch=[];
const LOI_COMMANDS=new Set(['loi.save','loi.approve','loi.evidence','loi.export','loi.handoff','loi.mark_sent']);
const coreCommand=name=>threeboxEnabled()&&THREEBOX_COMMANDS.has(name)||intakeEnabled()&&INTAKE_COMMANDS.has(name)||myerasEnabled()&&MYERAS_COMMANDS.has(name)||loiCompositionEnabled()&&LOI_COMPOSITION_COMMANDS.has(name)||loiTargetsEnabled()&&LOI_TARGET_COMMANDS.has(name)||loiEnabled()&&LOI_COMMANDS.has(name)||CORE_COMMANDS.has(name)||deepResearch()&&name==='research.check';
const coreAction=name=>threeboxEnabled()&&name.startsWith('threebox-')||calendarV2()&&(name.startsWith('calendar-')||name.startsWith('itinerary-')||name.startsWith('admin-calendar-'))||intakeVisible()&&name.startsWith('intake-')||myerasEnabled()&&name.startsWith('myeras-')||loiTargetsEnabled()&&name.startsWith('loitarget-')||loiEnabled()&&name.startsWith('loi-')||CORE_ACTIONS.has(name)||loiCanonicalLookup()&&name==='resolve'||deepResearch()&&['resolve','research-refresh','research-advance'].includes(name);
const coreSection=section=>threeboxEnabled()&&section==='why'||loiEnabled()&&section==='loi'||deepResearch()&&section==='brief'||['identify','schedule'].includes(section);
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
  if(coreOnly()&&!(calendarV2()&&(path.startsWith('/calendar/')||/^\/interviews\/[a-f0-9-]{36}\/itinerary/.test(path)))&&path!=='/bootstrap'&&!((deepResearch()||loiCanonicalLookup()||intakeEnabled())&&path.startsWith('/programs?'))&&!(path==='/commands'&&coreCommand(JSON.parse(options.body||'{}').command))){openComingSoon('This integration');const error=Error('COMING SOON: this integration is not active.');error.code='coming_soon';throw error;}
  if(!session||session.expiresAt<Date.now()+5000){try{await refreshSession();}catch(error){if(error.status===401||error.status===403)lockWorkspace('Your session ended. Sign in through MissionMed and reopen the workspace.');throw error;}}
  const headers=new Headers(options.headers||{});headers.set('Authorization','Bearer '+session.token);headers.set('Accept','application/json');
  if(options.method&&options.method!=='GET')headers.set('X-IIQ-Nonce',session.nonce);
  const response=await fetch(session.apiBase+path,{...options,headers,credentials:'same-origin',cache:'no-store'});
  if(response.status===401&&!retried){session=null;try{await refreshSession();}catch(error){if(error.status===401||error.status===403)lockWorkspace('Your session ended. Sign in through MissionMed and reopen the workspace.');throw error;}return apiFetch(path,options,true);}
  if(response.status===401){lockWorkspace('Your session ended. Sign in through MissionMed and reopen your workspace.');}
  if(options.binaryDownload===true){if(!response.ok)return readJSON(response);if(response.headers.get('content-type')!=='application/octet-stream'||!/^attachment; filename="itinerary-(?:[1-9]|10)\.(?:pdf|png|jpg)"$/.test(response.headers.get('content-disposition')||''))throw Error('The private attachment response was invalid.');const blob=await response.blob();if(blob.size<1||blob.size>5242880)throw Error('The attachment exceeded its allowed size.');return {blob,fileName:response.headers.get('content-disposition').split('"')[1]};}
  return readJSON(response);
}
let loiAuthorityEpoch=0;
function clearLoiMemory(){
  clearMyerasMemory();clearLoiCompositionMemory();loiAuthorityEpoch++;loiSavedPage=null;loiTargetSearch=[];if(S?.ui){delete S.ui.loiTargetOpen;delete S.ui.loiTargetManualProgram;}loiEvidence.clear();loiHandoffs.clear();loiInputIds.clear();
  for(const key of draftValues.keys())if(key.split("::").pop().startsWith("loi-"))draftValues.delete(key);
  for(const key of pendingCommands.keys())if(LOI_COMMANDS.has(JSON.parse(key)[1])||LOI_TARGET_COMMANDS.has(JSON.parse(key)[1]))pendingCommands.delete(key);
}
function applyBootstrap(input){
  const b=input?.bootstrap||input;
  researchBriefs.clear();
  if(!b?.actor?.id||!normalizeRole(b.actor.role)||!b.state)throw Error('The service returned an incomplete signed workspace.');
  const hadCalendar=calendarV2();
  const hadLookup=loiCanonicalLookup(),hadTargets=loiTargetsEnabled(),hadComposition=loiCompositionEnabled(),hadMyeras=myerasEnabled(),hadIntake=intakeEnabled();
  const sameActor=actor?.id===b.actor.id&&normalizeRole(actor.role)===normalizeRole(b.actor.role);
  const ui=sameActor&&S?.ui?S.ui:defaultUI();
  if(!sameActor){clearPrivateMemory();clearCalendarMemory();}else if(loiEnabled()&&(b.capabilities?.loi!==true||normalizeRole(b.actor.role)!=='student'||hadTargets&&b.capabilities?.loiTargets!==true))clearLoiMemory();
  if(sameActor&&hadMyeras&&b.capabilities?.myerasImport!==true)clearMyerasMemory();
  if(sameActor&&hadComposition&&b.capabilities?.loiComposition!==true)clearLoiCompositionMemory();
  if(sameActor&&hadIntake&&(b.capabilities?.intakeV2!==true||!['360','ivprep_complete'].includes(b.actor.tier)))clearIntakeMemory();
  if(sameActor&&capabilities.threebox===true&&b.capabilities?.threebox!==true)clearThreeboxMemory();
  if(sameActor&&hadCalendar&&(b.capabilities?.calendarV2!==true||capabilities.adminLogistics===true&&b.capabilities?.adminLogistics!==true))clearCalendarMemory();
  actor={...b.actor,role:normalizeRole(b.actor.role)};capabilities=b.capabilities||{};
  if(!sameActor||hadLookup&&!loiCanonicalLookup()){searchSequence++;clearTimeout(searchTimer);}
  integrations=b.integrations||{};version=b.version;
  const catalog=b.catalog||{};F={...catalog,programs:catalog.programs||[],facts:catalog.facts||[],sources:catalog.sources||[],personas:catalog.profiles||[actor],student_zone:actor.zone||catalog.student_zone||'UTC',registry_release:catalog.registry_release||'current registry',label:''};
  if(!F.personas.some(p=>p.id===actor.id))F.personas.push(actor);
  const serverNow=b.server_time||b.state.clock;if(serverNow&&Number.isFinite(Date.parse(serverNow)))serverClockOffset=Date.parse(serverNow)-Date.now();
  S={...b.state,persona:actor.id,online:true,storageOk:true,interviews:(b.state.interviews||[]).map(i=>({...i,related:i.related||[],history:i.history||[],zone:i.zone||actor.zone||'UTC'})),ui};
  for(const key of ownKeys)S[key]=b.state[key]||{};
  if(!loiTargetsEnabled())delete S.loiTargets;else{S.loiTargets=b.state.loiTargets||{targets:[],savedPrograms:null,savedStatus:'unavailable'};loiSavedPage=null;}

  if(!loiCompositionEnabled())delete S.loiPreferences;
  S.reviewQueue=b.state.reviewQueue||[];S.mentorAssigned=b.state.mentorAssigned||[];S.changes=b.state.changes||[];
  S.contrib={missions:{},submissions:[],ledger:[],grants:{},...(b.state.contrib||{})};
  S.policy={audit:[],suspended:{},...(b.state.policy||{})};S.lastVisit=b.state.lastVisit||now();
  if(!sameActor)S.ui.cal.ym=ymOf(todayKey());
  for(const [id,d] of threeboxDrafts){const i=S.interviews.find(i=>i.id===id&&i.owner===actor.id);if(!threeboxEnabled()||!i||d.binding!==threeboxBinding(i)){threeboxDrafts.delete(id);threeboxEvidenceCache.delete(id);}}
  for(const [id,handoff] of loiHandoffs){const i=id.startsWith('program:')?loiTargetSubject(id.slice(8)):S.interviews.find(i=>i.id===id);if(!i||!loiEnabled()||handoff.binding!==loiHandoffBinding(i))loiHandoffs.delete(id);}
  for(const [key,p] of loiProposals){const i=key.startsWith('program:')?loiTargetSubject(key.slice(8)):S.interviews.find(i=>i.id===key);if(!i||!loiCompositionEnabled()||!ownsLoiSubject(i)||i.targetKind==='program'&&i.choice!=='CREATE_LETTER'||p.subjectBinding!==loiSubjectBinding(i))loiProposals.delete(key);}
  for(const [key,e] of loiEvidence)if(key.startsWith('program:')){const i=loiTargetSubject(key.slice(8));if(!i||e.subjectBinding!==loiSubjectBinding(i))loiEvidence.delete(key);}
}
async function refreshWorkspace(){const identity=actor?.id,b=await apiFetch('/bootstrap');if(identity&&identity!==actor?.id)throw Error('The account changed while the workspace was loading. Reopen the intended workspace.');applyBootstrap(b);return b;}
async function command(name,interviewId=null,data={},options={}){
  if(studentPreview())throw previewError();
  if(coreOnly()&&!coreCommand(name)){openComingSoon(name.split('.')[0]);return {comingSoon:true};}
  const targetCommand=options.targetKind==='program';if(targetCommand&&!loiTargetsEnabled())throw Error('Program letter access is unavailable.');
  const threeboxCommand=THREEBOX_COMMANDS.has(name),capturedThreeboxEpoch=threeboxEpoch;
  const intakeCommand=INTAKE_COMMANDS.has(name),capturedIntakeEpoch=intakeEpoch;
  const importCommand=MYERAS_COMMANDS.has(name),importEpoch=myerasEpoch;
  const loiEpoch=loiAuthorityEpoch,compositionCommand=LOI_COMPOSITION_COMMANDS.has(name),compositionEpoch=loiCompositionEpoch,loiCommand=LOI_COMMANDS.has(name)||LOI_TARGET_COMMANDS.has(name)||compositionCommand;
  const identity=actor?.id,requestKey=JSON.stringify([identity,name,targetCommand?{targetKind:'program',targetId:options.targetId}:interviewId,data]);
  const draftSnapshot=savedDraftIds(name,targetCommand?options.targetId:interviewId,data).map(id=>[draftKey(id),pendingDraft(id,undefined)]);
  const work=async()=>{
    if(threeboxCommand&&(!threeboxEnabled()||capturedThreeboxEpoch!==threeboxEpoch))throw Error('Three-Box access changed. Reopen your interview.');
    if(intakeCommand&&(!intakeEnabled()||capturedIntakeEpoch!==intakeEpoch))throw Error('Interview intake access changed. Your private save cannot continue.');
    if(importCommand&&(!myerasEnabled()||importEpoch!==myerasEpoch))throw Error('Import access changed. Reopen the intended workspace.');
    if(compositionCommand&&(!loiCompositionEnabled()||compositionEpoch!==loiCompositionEpoch))throw Error('Composition access changed. Reopen the intended letter.');
    if(loiCommand&&(!loiEnabled()||targetCommand&&!loiTargetsEnabled()||loiEpoch!==loiAuthorityEpoch))throw Error('Letter access changed. Reopen the intended workspace.');
    if(!identity||identity!==actor?.id)throw Error('The account changed before this save. Reopen the intended workspace.');
    const prior=pendingCommands.get(requestKey),payload=prior||(targetCommand?{command:name,targetKind:'program',targetId:options.targetId,data,requestId:crypto.randomUUID(),expectedVersion:version}:{command:name,interviewId,data,requestId:crypto.randomUUID(),expectedVersion:version});
    pendingCommands.set(requestKey,payload);
    try{
      const result=await apiFetch('/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if(identity!==actor?.id)throw Error('The account changed while this save was in flight. Reopen the intended workspace.');
      if(threeboxCommand&&(!threeboxEnabled()||capturedThreeboxEpoch!==threeboxEpoch))throw Error('Three-Box access changed while this request was in flight.');
      if(intakeCommand&&(!intakeEnabled()||capturedIntakeEpoch!==intakeEpoch))throw Error('Interview intake access changed while the save was in flight.');
      if(importCommand&&(!myerasEnabled()||importEpoch!==myerasEpoch))throw Error('Import access changed while this request was in flight.');
      if(compositionCommand&&(!loiCompositionEnabled()||compositionEpoch!==loiCompositionEpoch))throw Error('Composition access changed while the request was in flight.');
      if(loiCommand&&(!loiEnabled()||targetCommand&&!loiTargetsEnabled()||loiEpoch!==loiAuthorityEpoch))throw Error('Letter access changed while the request was in flight.');
      pendingCommands.delete(requestKey);
      for(const [key,value] of draftSnapshot)if(draftValues.get(key)===value)draftValues.delete(key);
      if(result?.bootstrap||result?.actor)applyBootstrap(result);else if(!['threebox.read','threebox.evidence','loi.evidence','loi.export','loitarget.read','loitarget.list','loitarget.saved','loi.preference_read','loi.generation_read','myeras.preview','intake.read'].includes(name))await refreshWorkspace();
      const checked=result?.researchCheck,d=checked&&S.demands[checked.interviewId];
      if(deepResearch()&&d&&checked.research&&d.requestId===checked.requestId&&d.programId===checked.programId&&d.registryReleaseId===checked.registryReleaseId&&d.version===checked.version)researchBriefs.set(checked.interviewId,checked);
      if(options.render!==false)render();
      return result;
    }catch(error){
      if(error.status>=400&&error.status<500)pendingCommands.delete(requestKey);
      if(error.status===409){if(identity!==actor?.id||loiCommand&&loiEpoch!==loiAuthorityEpoch)throw error;await refreshWorkspace();if(options.render!==false)render();error.message='This workspace changed in another tab. The latest version is loaded; your typed draft is kept. Review it and save again.';}
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
  if(name==='loi.generation_select')return [...loiFormIds(id),'loi-composition-approach-'+id];
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
function clearPrivateMemory(){clearCalendarMemory();clearThreeboxMemory();
  clearIntakeMemory();researchBriefs.clear();clearLoiMemory();draftValues.clear();pendingCommands.clear();void stopSpeech();
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
function draftScope(){if(loiTargetsEnabled()&&S?.ui?.route==='letters'&&S.ui.loiTargetOpen)return ['page','letters','program',S.ui.loiTargetOpen].join('|');return S?.ui?.drawer?['drawer',S.ui.drawer.kind,S.ui.drawer.day||'',S.ui.drawer.item||''].join('|'):['page',S?.ui?.route,S?.ui?.open||'',S?.ui?.section||''].join('|');}
function draftKey(id){return draftScope()+'::'+id;}
function pendingDraft(id,fallback=''){const key=draftKey(id);return draftValues.has(key)?draftValues.get(key):fallback;}
function applyDrafts(){for(const field of document.querySelectorAll('input[id],textarea[id],select[id]')){if(field.type==='file')continue;const key=draftKey(field.id);if(draftValues.has(key)){const value=draftValues.get(key);if(field.multiple&&Array.isArray(value)){for(const option of field.options)option.selected=value.includes(option.value);}else if(field.type==='checkbox')field.checked=value===true;else field.value=value;}}}
function forgetDrafts(ids){for(const id of ids)draftValues.delete(draftKey(id));}
function setSaved(message='Saved'){const e=document.getElementById('connection-status');if(e)e.textContent=message;}
async function boot(){
  const main=document.getElementById('main');main.innerHTML='<section class="pageIntro" style="padding:48px"><div class="h1">Opening your <em>workspace</em>.</div><p role="status">Connecting to your MissionMed account…</p></section>';
  try{await refreshWorkspace();render();showOpening();}
  catch(error){lockWorkspace(error.message);}
}


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
const loiFormNames=['text','whyNow','applicationState','interviewState','motivations','facts','factual','specific'];
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
 const keys=['generationId','status','reason','proposals','approaches','baseHead','subject','provenance','factualGuard','compositionMode','currentEvidenceState','usage','studentReviewRequired'];if(!g||Object.keys(g).some(k=>!keys.includes(k))||!uuid.test(g.generationId)||!['PROPOSED','STANDARD_FALLBACK','RESERVED','OUTCOME_UNKNOWN'].includes(g.status)||g.studentReviewRequired!==true||g.factualGuard!=='REFERENCE_ONLY'||Object.hasOwn(g,'compositionMode')&&g.compositionMode!=='reference'||g.currentEvidenceState!=='RECHECK_REQUIRED')throw Error('Saved proposals did not match the reviewed letter contract.');
 const subj=i.targetKind==='program'?{targetKind:'program',targetId:i.id}:{interviewId:i.id};if(!g.subject||Object.keys(g.subject).sort().join()!==Object.keys(subj).sort().join()||Object.keys(subj).some(k=>g.subject[k]!==subj[k]))throw Error('Saved proposals belong to another letter.');
 if(!g.baseHead||Object.keys(g.baseHead).sort().join()!=='expectedHead,expectedLetterVersion,letterId'||!Number.isSafeInteger(g.baseHead.expectedLetterVersion)||g.baseHead.expectedLetterVersion<0||g.baseHead.letterId!==null&&!uuid.test(g.baseHead.letterId)||g.baseHead.expectedHead!==null&&!uuid.test(g.baseHead.expectedHead))throw Error('Saved proposal head binding is invalid.');
 const p=g.provenance;if(!p?.program||p.program.id!==i.program||p.program.name!==i.programName||p.program.track!==(i.track||'')||i.targetKind==='program'&&p.program.registryReleaseId!==i.registryReleaseId||!Array.isArray(p.factualSpans)||p.factualSpans.length>85||p.factualSpans.some(r=>!r||typeof r.ref!=='string'||r.ref.length>100||typeof r.text!=='string'||r.text.length>4000))throw Error('Saved proposal provenance changed or is unavailable.');
 if(!Array.isArray(g.approaches)||![1,3].includes(g.approaches.length)||new Set(g.approaches).size!==g.approaches.length||g.approaches.some(a=>!LOI_APPROACHES.some(x=>x[0]===a))||!Array.isArray(g.proposals)||g.proposals.length>3||(['PROPOSED','STANDARD_FALLBACK'].includes(g.status)?g.proposals.length!==g.approaches.length:g.proposals.length!==0))throw Error('Saved proposal count or approaches are invalid.');
 for(const [k,c] of g.proposals.entries()){if(c.approach!==g.approaches[k]||typeof c.text!=='string'||!c.text.trim()||c.text.length>20000||c.studentReviewRequired!==true||c.studentFactualConfirmation!==false||c.studentSpecificityConfirmation!==false||!Array.isArray(c.blocks)||c.blocks.length>100)throw Error('A saved proposal needs a compatible review contract.');}
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


'use strict';
const $=s=>document.querySelector(s);
const main=()=>document.getElementById('main');
let noticeTimer=null;
function notice(msg){ const n=$('#toast'); n.textContent=msg; n.classList.add('show'); n.onclick=()=>n.classList.remove('show'); clearTimeout(noticeTimer); noticeTimer=setTimeout(()=>n.classList.remove('show'), /denied|first|cannot|not |failed|does not exist/i.test(msg)?7000:4200); }
function btn(act, label, extra='', cls='btn'){ return `<button class="${cls}" data-act="${act}" ${extra}>${label}</button>`; }
function link(act, label, extra=''){ return `<button class="link" data-act="${act}" ${extra}>${label}</button>`; }
function chip(text, cls=''){ return `<span class="chip ${cls}">${text}</span>`; }
function sim(){ return ""; }
function pulseSVG(i){ const L=lifecycleStage(i); const lab=STAGES.map((st,k)=>st+(L.done.includes(k)?' done':L.now===k?' current':L.block.includes(k)?' blocked':'')).join(', '); return `<div class="lifeline" role="img" aria-label="Lifecycle: ${lab}">${STAGES.map((st,k)=>`<i class="${L.block.includes(k)?'block':L.now===k?'now':L.done.includes(k)?'done':''}" title="${st}"></i>`).join('')}</div>`; }
function pulseDots(i){ const L=lifecycleStage(i); return `<span class="pulsebadge" aria-hidden="true">${STAGES.map((st,k)=>`<i style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${L.done.includes(k)?'#4ade9d':L.now===k?'#ffb340':'#31405c'}"></i>`).join('')}</span>`; }
function fmtDateOnly(d){ const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(d||''); if(!m) return d; return new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'short',month:'short',day:'numeric'}).format(new Date(Date.UTC(+m[1],+m[2]-1,+m[3]))); }
function programContext(p){return [typeof p?.specialty==='string'?p.specialty:'',typeof p?.acgmeId==='string'&&/^\d{10}$(?![\s\S])/.test(p.acgmeId)?'ACGME '+p.acgmeId:'',typeof p?.track==='string'?p.track:''].filter(x=>x.trim()).join(' · ');}
function programLabel(p){return [typeof p?.name==='string'?p.name:'Program identity pending',programContext(p)].filter(Boolean).join(' · ');}
function title(i){ return i.program? P(i.program).name.replace('Fictional ','') : (i.programName||i.unresolved_input||'Unnamed offer'); }
function metaLine(i){
  const prog=P(i.program);
  const when = i.instant? `${fmtInZone(i.instant,i.zone)} <span class="zone">· ${fmtTime(i.instant,F.student_zone)} ${actor.role==='mentor'?'student time':'your time'}</span>` : i.date? `${fmtDateOnly(i.date)} · time not set` : 'Date not yet known';
  const context=i.program?programContext(prog):(i.track||'Track not supplied')+' · name supplied by you; registry unresolved';
  return `${context?esc(context)+' · ':''}${when}`;
}
function stateLabel(i){ if(isInactive(i))return ({cancelled:'Cancelled',declined:'Declined',postponed:'Postponed',waitlisted:'Waitlisted',no_show:'Did not take place'})[i.state]; if(!i.program&&!coreOnly()) return 'Identity to confirm'; const db=S.debriefs[i.id]; if(actor.role==='mentor'&&i.preparationStatus?.debrief_state)return i.preparationStatus.debrief_state; if(i.instant&&i.instant<=now()){ if(db?.occurrence==='yes') return db.saved?'Captured':'Capturing'; if(db?.occurrence==='no') return 'Did not take place'; return 'Awaiting your confirmation'; } if(i.instant||i.date) return 'Scheduled'; return 'Offer saved'; }
function renderIdentify(i){
  if(deepResearch()||loiCanonicalLookup())return `<h2>Confirm the program</h2><p class="lead">Keep the invitation details and schedule. Confirm the exact registry program ${deepResearch()?'to request research':'for your Letter of Interest context. This does not start research'}.</p><label class="f" for="program-search">Find the program</label><input id="program-search" placeholder="Program or hospital name" value=""><div id="program-search-results"></div><p class="tiny">Current program: ${esc(i.program?programLabel(P(i.program)):i.programName||i.unresolved_input)}. ${deepResearch()?'Research remains limited to the authorized test program.':'Select the exact program and track yourself. Scheduling remains available while identity is unresolved.'}</p>`;

  if(coreOnly()||!F.programs.length)return `<h2>Program details</h2><p class="lead">Use the name and track from your invitation. These are your supplied details; registry verification is not active. Saving does not start research.</p><label class="f" for="identity-name">Program name from invitation</label><input id="identity-name" value="${esc(i.programName||i.unresolved_input||'')}" maxlength="500"><label class="f" for="identity-track">Track (optional)</label><input id="identity-track" value="${esc(i.track||'')}" maxlength="300" placeholder="For example, categorical or preliminary"><div class="row" style="margin-top:.75rem">${btn('manual-identity-save','Save program details',`data-id="${i.id}"`)}${btn('open-section','Schedule & details',`data-id="${i.id}" data-section="schedule"`,'btn ghost')}</div>${coreOnly()?comingSoonPanel('Program registry and RISE research'):''}`;

  const cands=identityCandidates(i);
  const vf=(pid)=>visibleFacts(pid);
  const card=(p)=>{ const v=vf(p.id); const f=v.facts.find(x=>x.status==='supported'); const sr=f&&source(f.sources[0]); const dup=sameProgramElsewhere(i,p.id); return `<button class="choice" data-act="resolve" data-id="${i.id}" data-program="${p.id}"><b>${esc(p.name.replace('Fictional ',''))}</b>${dup? `<small><span class="chip warn">you already have an interview here (${dup.instant?fmtShort(dup.instant):'date unknown'})</span> Confirm only if this is a second invitation.</small>`:''}<small>${esc(programContext(p))}${p.zone?' · '+esc(zoneShort(p.zone))+' time':''}</small><small style="margin-top:.4rem">${v.allow? (sr? 'Tells them apart: '+esc(sr.text)+' ('+sr.id+', '+fmtShort(sr.retrieved_at)+')' : 'No supporting source yet') : 'Registry identity only; shared research is not available to you.'}</small></button>`; };
  let head, body;
  if(cands.length>=2){ head=`<h2>Which program sent this?</h2><p class="lead">The invitation says “${esc(i.unresolved_input)}”. ${cands.length} programs match. They are not the same place${cands.some(p=>p.track!==cands[0].track)?' and they are different tracks':''}, so InterviewIQ will not guess.</p>`; body=`<div class="grid2">${cands.map(card).join('')}</div>`; }
  else if(cands.length===1){ head=`<h2>Looks like one program. Confirm it.</h2><p class="lead">The invitation says “${esc(i.unresolved_input)}”. One registry program matches; confirming starts research for it.</p>`; body=`<div class="grid2">${card(cands[0])}</div>`; }
  else { head=`<h2>No registry match yet.</h2><p class="lead">The invitation says “${esc(i.unresolved_input)}”. Nothing in the program registry matches that name. Choose from the registry if you recognise it, or leave it unresolved; scheduling works either way and research waits.</p>`; body=`<div class="grid2">${F.programs.map(card).join('')}</div>`; }
  return `${head}<label class="f" for="program-search">Search the program registry</label><input id="program-search" type="search" placeholder="Program, hospital or city"><div id="program-search-results" class="grid2"></div>${body}
  <p style="margin-top:1rem" class="tiny">Confirming starts one research request for this interview automatically. If you confirm the wrong one, correct it from Schedule & details; the request is retargeted, not duplicated.</p>
  `;
}
/* ---------------- Brief ---------------- */
function provenance(f){
  return `<div class="src ${f.status==='supported'?'ok':f.status.startsWith('conflict')?'conf':'unk'}"><b>${esc(f.claim)} <span class="chip ${f.status==='supported'?'ok':f.status==='unknown'?'':'bad'}">${esc(f.status)}</span></b>
  ${f.sources.length? f.sources.map(source).map(s=>`<div class="src ${s.status==='stale'?'stale':s.status.startsWith('conflict')?'conf':'ok'}" style="margin:.3rem 0"><b>${esc(s.title)}</b>“${esc(s.text)}” — ${esc(s.publisher)}, ${esc(s.location)}<br><code>retrieved ${s.retrieved_at.slice(0,10)} · applies ${esc(s.applies)} · ${esc(s.status)} · ${esc(s.url)}</code></div>`).join('') : '<span class="tiny">No source. Reported as unknown; nothing is inferred from names, photos or other programs.</span>'}</div>`;
}
function reviewedReports(programId){ return (S.shared[programId]||[]).filter(r=>!r.retracted); }
function researchStrip(i, rs){
  const stateCls={available:'ok',partial:'warn',failed:'bad','provider outage':'bad'}[rs.state]||'sky';
  return `<div class="panel" style="display:flex;gap:1rem;align-items:flex-start;flex-wrap:wrap;margin-bottom:1rem"><div style="flex:1;min-width:16rem">${chip('Research · '+rs.state, stateCls)} <span class="tiny">${esc(rs.text)}</span></div><div class="row noprint">${['available','partial'].includes(rs.state)? btn('research-refresh','Refresh',`data-id="${i.id}"`,'btn sm sim') : btn('research-refresh','Check / retry',`data-id="${i.id}"`,'btn sm sim')}</div></div>`;
}
function lineageDetails(i){ return `<details><summary>Request lineage (yours only)</summary><ul class="hist">${(S.demands[i.id]?.history||[]).map(h=>`<li><time>${fmtStamp(h.at)}</time>${esc(h.state)} — ${esc(h.reason)}</li>`).join('')||'<li class="tiny">No request yet; it starts when the program is confirmed.</li>'}</ul><p class="tiny">${esc(S.demands[i.id]?.id||'no request')} → shared result for ${esc(i.program||'unresolved')}. Other students' requests are never shown.</p></details>`; }
function sourceDiff(facts){
  // what changed: newest retrieval vs older applicable sources
  const items=[];
  for(const f of facts){ const srcs=f.sources.map(source); if(srcs.length>=2){ const sorted=srcs.slice().sort((a,b)=>a.retrieved_at<b.retrieved_at?-1:1); const o=sorted[0], n=sorted[sorted.length-1]; items.push(`${fmtShort(n.retrieved_at)}: a newer source (“${esc(n.text)}”, applies ${esc(n.applies)}) disagrees with the ${esc(o.applies)} source (“${esc(o.text)}”). Treated as a conflict, not an update.`); } }
  return items;
}
function renderBrief(i){
  if(deepResearch())return renderResearchBrief(i);
  const prog=P(i.program); const rs=researchState(i); const vf=visibleFacts(i.program);
  const st=storyFor(i.owner); const lg=S.learning[i.owner]; const pname=prog.name.replace('Fictional ','');
  if(!vf.allow) return `<h2>Shared research is not available to you.</h2><p class="lead">${esc(vf.reason)}.</p>${researchStrip(i,rs)}<p>Your own notes, schedule, rehearsal and day sheet still work; they will not show program facts. ${capabilities.contributions===true? link('nav','See how research access works',`data-to="contribute"`):''}</p>${lineageDetails(i)}`;
  const facts=vf.facts; const sup=facts.filter(f=>f.status==='supported'), conf=facts.filter(f=>f.status.startsWith('conflict')), unk=facts.filter(f=>f.status==='unknown');
  if(!['available','partial'].includes(rs.state)) return `<h2>What we know so far</h2><p class="lead">The confirmed program is ${esc(pname)} (${esc(prog.track)}). ${esc(rs.short)} The brief fills in when findings arrive. You can already prepare with your own experience.</p>${researchStrip(i,rs)}
    <div class="brief"><div class="ans"><h4>Why it matters to you</h4><p>${st? 'Your approved experience — “'+esc(st.text)+'” — is available for preparation now.' : 'No approved experience is in use. Preparation stays general until you allow one in Settings.'}</p></div></div><div style="margin-top:1rem">${lineageDetails(i)}</div>`;
  const reports=reviewedReports(i.program); const diffs=sourceDiff(facts);
  const areas=['Identity and tracks','Leadership','Curriculum and rotations','Clinical sites and patient population','Distinctive pathways','Public resident information','Education and simulation','Research and mentorship','Fellowships and published graduate outcomes','Eligibility and visa rules','Published benefits and logistics','Legitimately available interview instructions','Recent changes','Publicly authorized MissionMed connections'];
  const areaState=a=>a==='Identity and tracks'?'supported — '+prog.track+' track, from the registry release':facts.filter(f=>f.area===a).map(f=>f.status+' — '+f.claim).join('; ')||'unknown — no permitted finding';
  const known=areas.filter(a=>!areaState(a).startsWith('unknown')).length;
  const visaUnknown=unk.some(f=>/visa/i.test(f.claim));
  return `<h2>The brief</h2><p class="lead">Five answers first. Every claim keeps its source and date underneath.</p>${researchStrip(i,rs)}
  <div class="brief">
    <div class="ans"><h4>What matters here</h4>${sup.length? sup.map(f=>`<p>${esc(f.claim)}. <small>${f.sources.map(sid=>'“'+esc(source(sid).text)+'”').join(' ')} (${f.sources.join(', ')}, ${fmtShort(source(f.sources[0]).retrieved_at)})</small></p>`).join('') : '<p>No supported fact yet.</p>'}</div>
    <div class="ans"><h4>Why it matters to you</h4><p>${st? esc(bridge(prog.id, st)) : 'No approved experience is in use, so this answer stays general. Allow one in Settings to make it yours.'}</p>${visaUnknown? '<p><b>Visa sponsorship is unknown for this program.</b> Ask before you invest more preparation; nothing about you is inferred.</p>':''}${lg?.status==='confirmed'? '<p><small>Your confirmed practice goal — '+esc(lg.goal)+' — is carried into every rehearsal for this interview.</small></p>':''}</div>
    <div class="ans ${conf.length||unk.length?'warn':''}"><h4>What is uncertain</h4>${conf.map(f=>`<p>${esc(f.claim)}: sources disagree (${f.sources.map(sid=>'“'+esc(source(sid).text)+'” '+(source(sid).status==='stale'?'— applies '+esc(source(sid).applies)+', stale':'— applicability unknown')).join('; ')}). Not resolved by majority; ask the program.</p>`).join('')}${unk.map(f=>`<p>${esc(f.claim)}: unknown. No permitted source found; nothing is inferred.</p>`).join('')}${!conf.length&&!unk.length?'<p>No conflicts in the available evidence.</p>':''}<p><small>${facts.length} claim${facts.length===1?'':'s'} researched; ${known} of 14 required areas have findings, ${14-known} remain explicitly unknown (list below).</small></p></div>
    <div class="ans"><h4>What to use</h4><p>Use: ${sup.map(f=>esc(f.claim)).join('; ')||'nothing yet'}. ${conf.length?'Ask, do not assert: '+conf.map(f=>esc(f.claim)).join('; ')+'. ':''}${unk.length?'Ask, do not infer: '+unk.map(f=>esc(f.claim)).join('; ')+'.':''}</p><div class="row noprint">${btn('open-section','Draft your Why-Program points',`data-id="${i.id}" data-section="why"`,'btn sm')}${btn('open-section','Rehearse the program\'s question',`data-id="${i.id}" data-section="rehearse"`,'btn ghost sm')}</div></div>
    <div class="ans"><h4>What changed</h4><p>Last refreshed ${S.results[i.program]?.refreshed_at? fmtStamp(S.results[i.program].refreshed_at) : 'unknown'}.</p>${diffs.map(d=>`<p>${d}</p>`).join('')}${S.changes.filter(c=>c.to===i.id&&c.kind==='research').slice(0,2).map(c=>'<p>'+esc(c.text)+'</p>').join('')}
      ${reports.length? `<p><b>What past applicants reported (reviewed)</b> — ${reports.length} report${reports.length>1?'s':''}, de-identified, labelled as experience not fact:</p>${reports.map(r=>`<p class="src ok">“${esc(r.excerpt)}” <code>experience report · approved ${fmtShort(r.at)} · version ${r.version}</code></p>`).join('')}` : `<p><small>No reviewed applicant report for this program yet. Reports appear here only after permitted use, de-identification and review.</small></p>`}</div>
  </div>
  <div style="margin-top:1rem">
    <details><summary>Every claim and its source</summary>${facts.map(provenance).join('')}<p class="tiny">Official facts, attributed experience and analysis are kept distinct. A reachable URL or several models citing one source do not make a claim supported.</p></details>
    <details><summary>All 14 research areas</summary><ul class="hist">${areas.map(a=>`<li><b>${a}</b> <span class="tiny">${esc(areaState(a))}</span></li>`).join('')}</ul></details>
    ${lineageDetails(i)}
  </div>`;
}
/* ---------------- Why ---------------- */
function whyMatches(i, text){
  const prog=P(i.program); if(!prog) return [];
  const sents=(text||'').split(/(?<=[.!?])\s+/);
  const out=[];
  for(const f of prog.fact_ids.map(fact)){ if(f.status==='supported') continue; const terms=(f.keywords||f.claim.toLowerCase().split(/[^a-z0-9-]+/).filter(w=>w.length>4)).slice(0,8); const hit=sents.find(sn=>{ const l=sn.toLowerCase(); return terms.some(t=>l.includes(String(t).toLowerCase())) && !/\?\s*$/.test(sn.trim()) && !/^\s*(ask|question|i would ask|i want to ask|could you|do you|is |are |how |does )/i.test(sn.trim()); }); if(hit) out.push({id:f.id, claim:f.claim, status:f.status, sentence:hit.trim()}); }
  return out;
}
function whyWarningHTML(i, text){ const warn=whyMatches(i,text); return warn.length? `<div class="panel rust" style="margin-top:.5rem"><b>Unresolved claim in your draft.</b> ${warn.map(f=>esc(f.claim)+' is '+esc(f.status.split(';')[0])+' — in “'+esc(f.sentence)+'”').join('; ')}. Ask it as a question for the program rather than stating it.</div>` : ''; }
function renderWhy(i){
  if(threeboxEnabled())return renderThreebox(i);
  const prog=P(i.program); const st=storyFor(i.owner); const w=S.why[i.id]||{text:'',basis:null,edited:false}; const vf=visibleFacts(i.program);
  const sup=vf.facts.find(f=>f.status==='supported');
  const text=w.text||'';
  return `<h2>Why this program, in your words</h2><p class="lead">Three things stay separate: what the program says, what you actually did, and the phrasing we suggest. You own the final words.</p>
  <div class="three">
    <div class="panel"><h4>Program fact</h4>${!vf.allow? '<p class="tiny">Shared research is not available to you; no program fact is shown.</p>' : sup? `<p>${esc(sup.claim)}</p><small>${sup.sources.join(', ')} · ${fmtShort(source(sup.sources[0]).retrieved_at)} · supported</small>` : '<p>No supported fact yet.</p>'}</div>
    <div class="panel"><h4>Your approved experience</h4>${st? `<p>${esc(st.text)}</p><small>${esc(st.consent)} · ${link('nav','change in Settings',`data-to="settings"`)}</small>` : `<p>No experience in use.</p><small>Story consent is off. ${link('nav','Allow it in Settings',`data-to="settings"`)}</small>`}</div>
    <div class="panel amber"><h4>Suggested phrasing</h4>${vf.allow? `<p>${esc(suggestWhy(i).text)}</p><small>A suggestion, never a fact. ${btn('why-suggest','Use this as a starting point',`data-id="${i.id}"`,'btn sm')}</small>` : '<p class="tiny">No suggestion without program facts. Write from your own experience.</p>'}</div>
  </div>
  <label class="f" for="why-${i.id}">Your talking points</label>
  <textarea id="why-${i.id}" data-autosave="why" data-id="${i.id}" placeholder="Write it the way you would say it.">${esc(text)}</textarea>
  <div id="why-warn-${i.id}" aria-live="polite">${whyWarningHTML(i,text)}</div>
  <div class="row" style="margin-top:.6rem">${btn('why-save','Save my wording',`data-id="${i.id}"`)}<span class="tiny">${w.edited?'Saved · yours':'Not saved yet'}${w.basis?.fact?' · rests on '+w.basis.fact+(w.basis.story?' and your approved experience':''):''}</span></div>
  <label class="f" for="q-${i.id}">Questions you want to ask</label>
  <textarea id="q-${i.id}" placeholder="One per line.">${esc(S.questions[i.id]||'')}</textarea>
  <div class="row" style="margin-top:.6rem">${btn('questions-save','Save my questions',`data-id="${i.id}"`,'btn quiet')}<span class="tiny">Private. Printed only if you choose.</span></div>`;
}
/* ---------------- Rehearse ---------------- */
function renderRehearse(i){
  const prog=P(i.program); const st=storyFor(i.owner); const lg=S.learning[i.owner]; const vf=visibleFacts(i.program);
  const attempts=(S.practice[i.id]||[]).filter(a=>!a.discarded); const a=attempts[attempts.length-1];
  const sup=vf.facts.find(f=>f.status==='supported');
  const h=hoursUntil(i);
  const lastDone=attempts.filter(x=>x.reflection).slice(-1)[0];
  const stopcue = h!=null && h<=24*7 && attempts.some(x=>x.feedback) && (!a || a.reflection) ? `<div class="panel amber" style="margin-bottom:1rem"><b>Stop researching. Rehearse.</b> ${hoursLabel(h)} and already rehearsed once. A second attempt with one specific change is worth more than another source.</div>` : '';
  const loopStep = !a||a.reflection? 0 : !a.feedback? 1 : !a.retry? 3 : !a.reflection? 4 : 5;
  const loop=`<div class="loop" role="list" aria-label="Teaching loop">${['Evidence','Diagnosis','Specific change','Retry','Reflection','Next time'].map((s,k)=>`<div role="listitem" class="${k<loopStep?'done':k===loopStep?'on':''}">${s}</div>`).join('')}</div>`;
  const ctx=`<details><summary>What the coach receives, and what it never receives</summary><dl class="kv"><dt>Student</dt><dd>${esc(i.owner)}</dd><dt>Interview</dt><dd>${esc(prog.name.replace('Fictional ',''))} · ${esc(prog.track)}</dd><dt>Program fact</dt><dd>${sup?esc(sup.claim):'none visible'}</dd><dt>Your experience</dt><dd>${st?'your consented experience':'none — consent off'}</dd><dt>Practice goal</dt><dd>${lg?.status==='confirmed'?esc(lg.goal):'none confirmed'}</dd><dt>Carried from last time</dt><dd>${esc(a?.basis?.carried||lastDone?.nextChange||lastDone?.change||'nothing yet')}</dd><dt>Never sent</dt><dd>raw debrief speech, private notes, other students, your application</dd></dl><p class="tiny">IV Prep On-Call owns recorded mock practice. Only the context listed above is permitted in the handoff.</p></details>`;
  const qf=questionFor(prog, st);
  if(!a || a.reflection){
    const carry=lastDone?(lastDone.nextChange||lastDone.change):null;
    return `<h2>Rehearse your program answer</h2><p class="lead">Mechanical wording checks use your current permitted preparation context. They do not verify facts or assess interview readiness.</p>${stopcue}${loop}
    <div class="panel"><h4>Why this question</h4><p>${sup? esc(sup.claim)+' is the supported fact for this program' : 'No program fact is visible'}${st? '; your consented experience is '+esc(storyDesc(st).short):'; no experience is in use'}${lg?.status==='confirmed'?'; your confirmed goal is “'+esc(lg.goal)+'”':''}. ${qf.adapted? 'This is a general practice question. It is not a claim about what the program will ask.' : 'The question below comes from the current program preparation context.'}</p><p class="q">“${esc(qf.text)}”</p>${qf.adapted?chip(qf.generic?'general practice question':'adapted to your experience','warn'):chip('practice question','ok')}
    ${carry? `<div class="panel amber" style="margin:.75rem 0"><b>Last time you left one change to try:</b> ${esc(carry)}</div>`:''}
    <div class="row" style="margin-top:.75rem">${btn('practice-start','Start rehearsal',`data-id="${i.id}" data-program="${i.program}"`)}${btn('ivoc-handoff','Rehearse live in IV Prep On-Call',`data-id="${i.id}"`,'btn sim')}<span class="tiny">recorded mock practice is IV Prep On-Call's</span></div>${(S.ivoc?.[i.id]||[]).length? `<div class="panel sky" style="margin-top:.75rem"><h4>Returned from IV Prep On-Call</h4>${(S.ivoc[i.id]).map(r=>`<p>${fmtStamp(r.at)} · session ${esc(r.session)} · ${esc(r.summary)}<br><small>Learning signal returned: “${esc(r.signal)}” — ${r.accepted?'accepted into your practice goal':'awaiting your confirmation'}</small></p>${r.accepted?'':`<div class="row">${btn('ivoc-accept','Make this my practice goal',`data-id="${i.id}" data-k="${r.id}"`,'btn sm')}${btn('ivoc-dismiss','Not this one',`data-id="${i.id}" data-k="${r.id}"`,'btn ghost sm')}</div>`}`).join('')}</div>`:''}</div>
    <div style="margin-top:.75rem">${ctx}</div>
    ${attempts.length? `<details style="margin-top:.5rem"><summary>Past attempts (${attempts.length})</summary>${attempts.map(x=>`<div class="src ${x.reflection?'ok':''}"><b>${fmtStamp(x.at)}</b>${esc((x.retry||x.draft||'').slice(0,160))}${x.reflection?'<br><small>Reflection: '+esc(x.reflection)+' · Next time: '+esc(x.nextChange||x.change||'')+'</small>':''}</div>`).join('')}</details>`:''}
    `;
  }
  let body='';
  const diagList=(d,which)=>`<ul class="hist">${d.map((x,k)=>`<li><span class="${x.informational?'tiny':x.overruled?'tiny':x.ok?'ok-t':'bad-t'}">${x.informational?'·':x.overruled?'↷':x.ok?'✓':'✗'}</span> ${x.goal?'<b>Your goal · </b>':''}${esc(x.text)}${!x.ok&&x.hits&&x.hits.length&&x.k!=='closing'?' <span class="tiny">(triggered by: '+x.hits.slice(0,3).map(esc).join(', ')+')</span>':''}${x.overruled?' <span class="tiny">(overruled by you)</span>':''}${!x.ok&&!x.informational&&!x.overruled&&which?` <button class="link over" data-act="practice-overrule" data-id="${i.id}" data-which="${which}" data-k="${k}">Overrule this check</button>`:''}</li>`).join('')}</ul>`;
  if(!a.feedback){
    body=`<p class="q">“${esc(a.question)}”</p>${a.adapted?chip(a.generic?'general practice question':'adapted to your experience','warn'):chip('practice question','ok')}${a.basis?.carried? `<div class="panel amber" style="margin:.6rem 0"><b>Start from last time:</b> ${esc(a.basis.carried)}</div>`:''}<label class="f" for="draft-${i.id}">Your answer</label><textarea id="draft-${i.id}" data-autosave="draft" data-id="${i.id}" placeholder="Three sentences: the moment, the connection, what you carry forward.">${esc(a.draft)}</textarea>
    <div class="row" style="margin-top:.6rem">${btn('practice-feedback','Get feedback',`data-id="${i.id}"`)}${a.permission?chip(a.permission,'warn'):''}${btn('practice-cancel','Discard attempt',`data-id="${i.id}"`,'btn ghost sm')}</div>`;
  } else if(!a.retry){
    body=`<div class="panel"><h4>Diagnosis of what you wrote</h4>${diagList(a.diagnosis,'diagnosis')}<small>Mechanical checks on your own words, with the words that triggered them. Not a score; not a judgment of you. A false flag is yours to overrule.</small></div>
    <div class="panel amber" style="margin-top:.75rem"><h4>One specific change</h4><p>${esc(a.change)}</p></div>
    <p class="tiny" style="margin:.6rem 0 0">What this program's coach emphasises: “${esc(coachEmphasis(P(a.program), storyFor(i.owner)).text)}” <span class="tiny">(${coachEmphasis(P(a.program), storyFor(i.owner)).adapted?'general coaching principle':'program guidance, unchanged'}; it is not about your draft)</span></p>
    <label class="f" for="retry-${i.id}">Retry with that change</label><textarea id="retry-${i.id}" data-autosave="retry" data-id="${i.id}">${esc(a.retryDraft||a.draft)}</textarea>
    <div class="row" style="margin-top:.6rem">${btn('practice-retry','Save my retry',`data-id="${i.id}"`)}<span class="tiny">Your first draft is kept. Compare, don't overwrite.</span>${btn('practice-cancel','Discard attempt',`data-id="${i.id}"`,'btn ghost sm')}</div>`;
  } else {
    const d2=a.retryDiagnosis||[]; const delta=retryDelta(a);
    body=`<div class="grid2"><div class="panel"><h4>First draft</h4><p>${esc(a.draft)||'<i>empty</i>'}</p></div><div class="panel moss"><h4>Retry</h4><p>${esc(a.retry)}</p>${diagList(d2,'retryDiagnosis')}</div></div>
    <div class="panel" style="margin-top:.75rem"><h4>What changed between the two</h4><p>${delta.fixed.length?'Fixed: '+delta.fixed.join(', ')+'. ':'Nothing fixed yet. '}${delta.still.length?'Still open: '+delta.still.join(', ')+'.':'All checks pass.'}</p>${a.nextChange?`<p><b>Next time:</b> ${esc(a.nextChange)}</p>`:''}</div>
    <h3 style="margin-top:1rem">Reflection</h3><p class="tiny">Your judgment, not ours. It decides what the next rehearsal starts from.</p><div class="chips">${['The change helped','Still unclear','I need another try','The question surprised me'].map(c=>`<button data-act="practice-reflect" data-id="${i.id}" data-v="${esc(c)}">${c}</button>`).join('')}</div><p style="margin-top:.6rem">${btn('practice-cancel','Discard attempt',`data-id="${i.id}"`,'btn ghost sm')}</p>`;
  }
  return `<h2>Rehearsal</h2><p class="tiny">Mechanical wording checks · transparent checks on your words, not a factual verification or an IV Prep On-Call assessment.</p>${loop}${body}<div style="margin-top:1rem">${ctx}</div>`;
}
/* ---------------- Day ---------------- */
function renderDay(i){
  const prog=P(i.program); const st=storyFor(i.owner); const w=S.why[i.id]; const qs=S.questions[i.id]; const ps=S.ui.printSel; const note=persona(i.owner)?.private_note;
  const vf=visibleFacts(i.program); const facts=vf.facts; const sup=facts.filter(f=>f.status==='supported'), open=facts.filter(f=>f.status!=='supported');
  const rs=researchState(i);
  const cancelled=isInactive(i);
  const h=hoursUntil(i);
  const printctl=`<div class="printctl noprint"><div class="row" style="justify-content:space-between"><div class="row"><label class="f" style="margin:0;display:inline-flex;gap:.4rem;align-items:center"><input type="checkbox" data-act="essentials" ${S.ui.essentials?'checked':''}> Essentials only</label></div><div class="row">${btn('print','Print / save PDF',`data-id="${i.id}"`)}</div></div>
  <p class="tiny" style="margin:.5rem 0 .25rem">Choose what goes on paper. Private items are off by default.</p><div class="printsel">${[['story','Approved experience'],['note','Private note'],['points','Why points & questions'],['support','Evidence support page']].map(([k,l])=>`<label><input type="checkbox" data-act="printsel" data-k="${k}" ${ps[k]?'checked':''}> ${l}</label>`).join('')}</div></div>`;
  return `<h2>Interview day</h2><p class="lead">Everything needed, nothing else. ${h!=null&&h>0?hoursLabel(h)+'.':''}</p>${printctl}
  <div class="day ${S.ui.essentials?'essentials':''}" id="daysheet">
    <div class="hero"><div><div class="d">${i.instant? fmtDate(i.instant,i.zone) : i.date? i.date+' · time not set' : 'Date not yet known'}${cancelled?' · CANCELLED':''}</div><div class="time">${i.instant? fmtTime(i.instant,i.zone) : '— : —'}</div><div class="you">${i.instant? fmtTime(i.instant,F.student_zone)+' your time ('+zoneShort(F.student_zone)+') · program time '+zoneShort(i.zone) : 'No start time; nothing is invented.'}</div></div><div><div class="d">${esc(prog.name.replace('Fictional ',''))}</div><div class="you">${esc(programContext(prog))}${programContext(prog)?' · ':''}${esc(i.id)}</div>${pulseDots(i)}</div></div>
    <div class="body">
      ${cancelled?`<div class="panel rust"><b>This interview is cancelled.</b> The sheet is historical. ${link('open-section','Restore it',`data-id="${i.id}" data-section="schedule"`)}</div>`:''}
      <div class="join"><b>How you join</b>${i.format?esc(i.format)+' · ':''}<code>${esc(i.joining||'joining details not provided')}</code><div class="tiny" style="margin-top:.35rem">${i.joinVerified? 'Checked by you '+fmtStamp(i.joinVerified)+'.' : 'Not yet checked by you. Open the original invitation and confirm the link and time.'} ${!cancelled? btn('join-verify', i.joinVerified?'Check again':'I checked this',`data-id="${i.id}"`,'btn sm quiet noprint'):''}</div></div>
      ${renderScheduleWarnings(myInterviews(),i.id)}<div class="cols"><section><h4>Duration & travel</h4><p>${i.duration? i.duration+' minutes' : 'Duration unknown'} · ${i.travel_minutes!=null? 'travel buffer before ~'+i.travel_minutes+' min (your estimate)' : i.format==='virtual'?'no travel (virtual)':'travel time unknown'}</p>${i.related.map(e=>`<p><b>${esc(e.kind)}</b> ${fmtInZone(e.instant,i.zone)} (${fmtTime(e.instant,F.student_zone)} your time), ${e.duration_minutes==null?'duration unknown':e.duration_minutes+' min'}. ${esc(relatedStatus(i,e))}</p>`).join('')}</section>
      <section><h4>Facts to lean on</h4>${!vf.allow? '<p class="tiny">Shared research is not available to you.</p>' : sup.length? sup.map(f=>`<p>${esc(f.claim)} <small>(${f.sources.join(', ')}, ${fmtShort(source(f.sources[0]).retrieved_at)})</small></p>`).join('') : `<p>${esc(rs.short)} No supported fact yet.</p>`}${open.length?`<p class="tiny">Open: ${open.map(f=>esc(f.claim)+' — '+esc(f.status.split(';')[0])).join('; ')}. Ask; do not assert.</p>`:''}</section></div>
      <div class="cols ess-hide"><section class="${ps.points?'':'print-exclude'}"><h4>Your Why-Program anchors</h4>${w?.text? `<p>${esc(w.text)}</p>` : `<p class="tiny">No talking points saved yet. ${cancelled?'':link('open-section','Draft them now',`data-id="${i.id}" data-section="why" class="link noprint"`)}</p>`}</section>
      <section class="${ps.points?'':'print-exclude'}"><h4>Questions you want to ask</h4>${qs? qs.split('\n').filter(Boolean).map(q=>`<p>${esc(q)}</p>`).join('') : '<p class="tiny">None saved.</p>'}</section></div>
      <div class="cols ess-hide"><section class="${ps.story?'':'print-exclude'}"><h4>Your chosen experience</h4>${st? `<p>${esc(st.text)}</p>` : '<p class="tiny">Consent off; nothing included.</p>'}</section>
      <section class="${ps.note?'':'print-exclude'}"><h4>Private note</h4><p>${esc(note||'')}</p></section></div>
      <section class="ess-hide"><h4>Live help during the real interview</h4><p class="tiny">Off. Listening, cues, camera analytics, a phone companion and answer assistance are separately gated experiments and are disabled for actual interviews.</p></section>
      <div class="fine">${(()=>{const off=[['story','approved experience'],['note','private note'],['points','Why points and questions']].filter(([k])=>!ps[k]).map(x=>x[1]); return off.length? '<span class="print-only">Left off this copy by your choice: '+off.join(', ')+'. · </span><span class="noprint">Will be left off the printed copy: '+off.join(', ')+'. · </span>':'';})()}Generated for ${esc(i.owner)} · as of ${fmtStamp(now())} · zones: program ${esc(i.zone||prog.zone)}, you ${esc(F.student_zone)} · registry ${esc(F.registry_release)} · sources carry their own dates · unknown stays unknown · a printed copy cannot be recalled · this sheet is not permission to use notes during an interview · PRIVATE INTERVIEW WORKSPACE</div>
    </div>
  </div>
  <div class="day support ${ps.support?'':'print-exclude'} noprint-screen" style="margin-top:1rem;${ps.support?'':'display:none'}"><div class="body"><h3>Evidence support page</h3><p class="tiny">${esc(prog.name)} · for ${esc(i.owner)} · page 2 of the day sheet</p>${vf.allow? facts.map(provenance).join('') : '<p class="tiny">Shared research is not available to you.</p>'}<div class="fine">Support page for ${esc(prog.name)} · as of ${fmtStamp(now())}</div></div></div>`;
}

/* ---------------- Debrief ---------------- */
function renderEncounterFields(i,db){
  const f=db.fields,precision=['exact','estimated','unknown','not applicable','prefer not to share'];
  const select=(id,label,options,value)=>`<label class="f" for="${id}">${label}</label><select id="${id}" data-autosave="structure" data-id="${i.id}">${options.map(x=>`<option value="${esc(x)}" ${x===value?'selected':''}>${esc(x)}</option>`).join('')}</select>`;
  return `<details style="margin:.8rem 0" open><summary>Actual encounters · individual details</summary><p class="tiny">Count actual interviews, including panels or groups. Socials stay separate. Add one row for each encounter you want to record; a row does not infer a total.</p><label class="f" for="enc-count-${i.id}">Total actual encounters (blank = unknown)</label><input id="enc-count-${i.id}" type="number" min="0" max="100" value="${f.encounter_count??''}" data-autosave="structure" data-id="${i.id}">${select('enc-count-precision-'+i.id,'How certain is the total?',precision,f.encounter_count_precision||'unknown')}
  ${(f.encounters||[]).map((e,k)=>`<div class="panel pad" style="margin:.5rem 0"><h4>Encounter ${k+1}</h4>${select('enc-format-'+e.id,'Format',['individual','panel','group','unknown','not applicable','prefer not to share'],e.format)}<label class="f" for="enc-roles-${e.id}">People you met (choose all that apply)</label><select id="enc-roles-${e.id}" multiple data-encounter-roles="true" data-autosave="structure" data-id="${i.id}">${['faculty','program director','associate program director','chief resident','residents','coordinator','other','unknown','prefer not to share'].map(r=>`<option ${(e.roles||[]).includes(r)?'selected':''}>${r}</option>`).join('')}</select><label class="f" for="enc-duration-${e.id}">Duration in minutes (blank = unknown)</label><input type="number" id="enc-duration-${e.id}" min="1" max="1440" value="${e.duration_minutes??''}" data-autosave="structure" data-id="${i.id}">${select('enc-precision-'+e.id,'Duration certainty',precision,e.duration_precision)}<div class="row" style="margin-top:.5rem">${btn('encounter-remove','Remove this encounter',`data-id="${i.id}" data-encounter="${e.id}"`,'btn ghost sm')}</div></div>`).join('')}
  ${btn('encounter-add','Add actual encounter',`data-id="${i.id}"`,'btn ghost sm')}</details>
  ${[['emphasized_topics','Emphasized topics'],['program_information','Program information learned']].map(([key,label])=>{const value=f[key]||{text:'',certainty:'unknown'};return `<label class="f" for="db-${key}-${i.id}">${label} (your recollection, private)</label><textarea id="db-${key}-${i.id}" data-autosave="structure" data-id="${i.id}">${esc(value.text)}</textarea>${select('db-'+key+'-certainty-'+i.id,'How certain is this recollection?',['recalled','estimated','unknown','not applicable','prefer not to share'],value.certainty)}`;}).join('')}`;
}
function renderDebrief(i){
  const db=getDebrief(i); const prog=P(i.program);
  if(isInactive(i)) return `<h2>No report for this inactive interview</h2><p class="lead">Cancelled, postponed, declined and no-show interviews never produce a report. ${link('open-section','Restore the schedule',`data-id="${i.id}" data-section="schedule"`)} if that changes.</p>`;
  if(!i.instant || i.instant>now()) return `<h2>Nothing to report yet</h2><p class="lead">The debrief opens after the scheduled time has passed, and only once you say it happened.</p>`;
  if(db.occurrence==null) return `<h2>Did the interview happen?</h2><p class="lead">${fmtDate(i.instant,i.zone)} has passed. A passed time is not attendance; nothing is recorded until you answer.</p>
    <div class="three">${[['yes','Yes, it happened','Two minutes while it is fresh.'],['no','No — postponed, cancelled or missed','Keep the record true. No report.'],['later','Not yet','Ask me again later. Nothing is assumed.']].map(([v,b,s])=>`<button class="choice" data-act="occurrence" data-id="${i.id}" data-v="${v}"><b>${b}</b><small>${s}</small></button>`).join('')}</div>`;
  if(db.occurrence==='no') return `<h2>Recorded: it did not take place</h2><p class="lead">No report was created. If it was postponed, add the new date in Schedule & details.</p><div class="row">${btn('occurrence','Change my answer',`data-id="${i.id}" data-v="clear"`,'btn ghost')}${btn('open-section','Update schedule',`data-id="${i.id}" data-section="schedule"`,'btn quiet')}</div>`;
  if(db.occurrence==='later') return `<h2>We will ask again</h2><p class="lead">Dismissed for now. The interview stays “awaiting your confirmation”.</p>${btn('occurrence','Answer now',`data-id="${i.id}" data-v="clear"`,'btn ghost')}`;
  // capture
  const sp=db.speech; 
  const speechBox=`<div class="speech" id="speech-${i.id}" aria-live="polite" aria-label="Raw speech transcription">${db.raw.length? db.raw.map((r,k)=>`<span class="seg ${!r.complete&&sp.status==='live'?'live':''}">${esc(r.text)}</span>`).join('') : '<span class="seg pending">Your transcription appears here as you speak. Your editable account stays separate.</span>'}</div>`;
  const spState = sp.status==='live'?chip('listening','ok'):sp.status==='paused'?chip('paused','warn'):sp.status==='denied'?chip('microphone denied','bad'):sp.status==='network'?chip('network lost','bad'):sp.status==='background'?chip('app backgrounded','warn'):sp.status==='done'?chip('capture complete','ok'):chip('ready');
  const chipLabels={individual_count:'Individual conversations',individual_duration:'Each lasted',roles:'Who you met',formats:'Formats',impression:'How it felt'};
  const chipsRow=(k,opts,multi)=>`<div class="chips" role="group" aria-label="${chipLabels[k]||k}">${opts.map(o=>{ const v=db.fields[k]; const on=multi? (v||[]).includes(o) : v===o; return `<button data-act="field" data-id="${i.id}" data-k="${k}" data-v="${esc(o)}" data-multi="${multi?1:0}" aria-pressed="${on}">${esc(o)}</button>`; }).join('')}</div>`;
  const exits=`<div class="grid2" style="margin-top:1.25rem">
    <div class="panel moss"><h3>Keep for yourself</h3><p class="tiny">Private learning. Changes your next rehearsal. Never shared.</p>${renderLearningControls(i.owner, i)}</div>
    <div class="panel"><h3>Share one sentence, if you want</h3><p class="tiny">Optional. Only a de-identified excerpt goes to review; never raw speech, edits, your story or your name.</p>${renderShareControls(i)}</div></div>`;
  const prop=db.proposed? `<div class="panel amber" style="margin-top:.75rem"><h4>Proposed structure (from your words, not accepted yet)</h4><dl class="kv"><dt>Individual conversations</dt><dd>${esc(db.proposed.individual_count??'unknown')}</dd><dt>Resident group</dt><dd>${db.proposed.resident_group==null?'unknown':db.proposed.resident_group?'yes':'no'}</dd></dl>${db.proposedConfirmed? chip('confirmed by you','ok') : `<div class="row">${btn('proposal-confirm','Yes, that is right',`data-id="${i.id}"`,'btn sm')}${btn('proposal-reject','No, I will set it myself',`data-id="${i.id}"`,'btn ghost sm')}</div>`}</div>`:'';
  return `<h2>Give me two minutes while it is fresh.</h2><p class="lead">Say what happened; tap what you remember. Unknown, estimated and “prefer not to say” are real answers. ${chip('occurrence confirmed by you','ok')} ${link('occurrence','Wrong? Change my answer',`data-id="${i.id}" data-v="clear"`)}</p>
  <div class="grid2"><div>
    <div class="voiceHead ${sp.status==='live'?'live':''}"><span class="mic" aria-hidden="true">●</span><div><b>${sp.status==='live'?'Listening…':sp.status==='paused'?'Paused':sp.status==='denied'?'Microphone denied':sp.status==='network'?'Network lost':sp.status==='background'?'Backgrounded':sp.status==='done'?'Finished':'Ready to listen'}</b><small>Voice first. Typing is always available. Your microphone is used only while you choose to capture.</small></div></div>
    <div class="row" style="margin-bottom:.5rem">${btn('speech-start', sp.status==='paused'||sp.status==='background'||sp.status==='network'?'Resume':'Speak',`data-id="${i.id}"`)}${btn('speech-pause','Pause',`data-id="${i.id}"`,'btn ghost')+btn('speech-finish','Finish',`data-id="${i.id}"`,'btn ghost')}${spState}<span class="timer" id="timer-${i.id}">${db.latency.length? 'first text in '+db.latency[0]+' ms':''}</span></div>
    ${speechBox}
    ${sp.pausedReason?`<p class="tiny" style="margin-top:.3rem">${esc(sp.pausedReason)}</p>`:''}
    
    <label class="f" for="edited-${i.id}">Your account, in your words (never overwritten by speech)</label><textarea id="edited-${i.id}" data-autosave="edited" data-id="${i.id}" placeholder="Edit freely. Resuming speech only adds to the raw box above.">${esc(db.edited)}</textarea>
    <div class="row" style="margin-top:.5rem">${btn('propose','Propose structure from my words',`data-id="${i.id}"`,'btn ghost sm')}</div>${prop}
  </div><div>
    <h4 style="margin-bottom:.3rem">Individual conversations</h4>${chipsRow('individual_count',['1','2','3','4+','unknown','prefer not to say'])}
    <h4 style="margin:.8rem 0 .3rem">General duration recollection (optional)</h4>${chipsRow('individual_duration',['under 15 min','15–30 min','over 30 min','estimated ~20','unknown','not applicable'])}
    <h4 style="margin:.8rem 0 .3rem">Who you met</h4>${chipsRow('roles',['faculty','program director','associate program director','chief resident','residents','coordinator','other','unknown','prefer not to share'],true)}
    <h4 style="margin:.8rem 0 .3rem">Formats</h4>${chipsRow('formats',['individual','panel','group','resident group','social (separate)','unknown'],true)}
    ${renderEncounterFields(i,db)}
    <h4 style="margin:.8rem 0 .3rem">Resident social</h4>${chipsRow('social',['attended','skipped','none offered','unknown','prefer not to say'])}
    <h4 style="margin:.8rem 0 .3rem">Question categories asked</h4>${chipsRow('categories',['why this program','your story','teamwork / handoff','clinical reasoning','conflict','ethics','research','personal','unknown'],true)}
    <h4 style="margin:.8rem 0 .3rem">Unexpected questions</h4>${chipsRow('unexpected',['none','one','several','unknown'])}
    <h4 style="margin:.8rem 0 .3rem">Difficult questions</h4>${chipsRow('difficult',['none','one','several','prefer not to say'])}
    <h4 style="margin:.8rem 0 .3rem">How it felt (your interpretation, not a fact)</h4>${chipsRow('impression',['went well','mixed','rough','prefer not to say'])}
    <h4 style="margin:.8rem 0 .3rem">Red flags / concerns</h4>${chipsRow('redflags',['none noticed','some','serious','prefer not to say'])}
    <h4 style="margin:.8rem 0 .3rem">Follow-up</h4>${chipsRow('followup',['thank-you sent','thank-you planned','second look requested','nothing planned','not applicable'],true)}
    <label class="f" for="narr-${i.id}">Free narrative (optional, private)</label><textarea id="narr-${i.id}" data-autosave="narrative" data-id="${i.id}" placeholder="Anything else, in your words.">${esc(db.narrative||'')}</textarea>
    <h4 style="margin:.8rem 0 .3rem">Questions you remember</h4>
    <div class="row qrow"><input id="qsel-${i.id}" type="text" aria-label="Question you remember" placeholder="A question you remember"><select id="qrec-${i.id}" aria-label="How you recall it"><option value="paraphrase">paraphrase</option><option value="exact">exact wording</option></select>${btn('question-add','Add',`data-id="${i.id}"`,'btn sm')}</div>
    <ul class="hist">${db.questions.map((q,k)=>`<li>“${esc(q.text)}” <span class="tiny">${esc(q.recollection)} · ${esc(q.permission)}</span></li>`).join('')}</ul>
    <p class="tiny">Questions stay private until you confirm permitted use. Exact wording claimed by you is still labelled as your recollection.</p>
    <div class="row" style="margin-top:.75rem">${btn('debrief-save', db.saved?'Saved · save again':'Save (resume anytime)',`data-id="${i.id}"`)}${db.saved?chip('saved · private','ok'):chip('draft · private')}<span class="tiny" id="autosave-${i.id}" aria-live="polite">${db.autosavedAt?'Autosaved '+fmtStamp(db.autosavedAt):'Saves after you pause typing'}</span></div>
  </div></div>${exits}`;
}
function renderMentorNotes(studentId){
  if(actor.role!=='student'||studentId!==actor.id)return '';
  const priority=S.mentorPriority?.[studentId],nudges=(S.mentorNudges||[]).filter(n=>n.student===studentId);
  if(!priority&&!nudges.length)return '';
  return `<div class="panel sky" style="margin-top:.8rem"><h4>From your mentor</h4>${priority?`<p><b>Priority:</b> ${esc(priority.text)}</p>`:''}${nudges.map(n=>`<p>${esc(n.text)} <small>${fmtStamp(n.at)}</small></p>`).join('')}</div>`;
}
function renderLearningControls(studentId,i){
  const lg=S.learning[studentId],mentorNotes=renderMentorNotes(studentId);
  if(!lg)return `${mentorNotes}<p class="tiny">Choose one observation to carry into your next rehearsal. Nothing is inferred from your face or voice.</p><label class="f" for="goal-${esc(studentId)}">Your practice goal</label><input id="goal-${esc(studentId)}" placeholder="One thing I want to try next time"><div class="row" style="margin-top:.5rem">${btn('learning-propose','Propose this goal',`data-student="${esc(studentId)}"`,'btn sm')}</div>`;
  return `${mentorNotes}<p>Practice goal: <b>“${esc(lg.goal)}”</b> ${chip(esc(lg.status),lg.status==='confirmed'?'ok':lg.status==='revoked'?'bad':'warn')}</p><p class="tiny">Source: ${esc(lg.source)} · set ${fmtStamp(lg.at)}</p><label class="f" for="goal-${esc(studentId)}">Correct it</label><input id="goal-${esc(studentId)}" value="${esc(lg.goal)}"><div class="row" style="margin-top:.5rem">${lg.status!=='confirmed'?btn('learning-confirm','Confirm',`data-student="${esc(studentId)}"`,'btn sm'):''}${btn('learning-correct','Save correction',`data-student="${esc(studentId)}"`,'btn ghost sm')}${lg.status!=='revoked'?btn('learning-revoke','Revoke',`data-student="${esc(studentId)}"`,'btn ghost sm'):''}</div><label class="f" style="display:inline-flex;gap:.4rem;align-items:center;margin-top:.6rem"><input type="checkbox" data-act="mentor-visible" data-student="${esc(studentId)}" ${lg.mentorVisible?'checked':''} ${lg.status!=='confirmed'?'disabled':''}> Let my assigned mentor see this preparation gap</label>`;
}
function renderShareControls(i){
  const q=S.reviewQueue.find(r=>r.interview===i.id&&!['rejected','retracted'].includes(r.status));
  if(q)return `<p>Sent to review: “${esc(q.excerpt)}” ${chip(esc(q.status),q.status==='approved'?'ok':'warn')}</p><p class="tiny">Only the reviewed excerpt can reach other entitled students. Retraction removes regenerated copies; paper cannot be recalled.</p>${btn('share-retract','Retract',`data-id="${esc(i.id)}"`,'btn ghost sm')}`;
  return `<label class="f" for="excerpt-${esc(i.id)}">The exact excerpt you want to share</label><textarea id="excerpt-${esc(i.id)}" placeholder="Write or paste only the sentence you choose to share"></textarea><label class="f" style="display:flex;gap:.4rem"><input type="checkbox" id="permitted-${esc(i.id)}">I confirm I am permitted to share these words.</label><label class="f" style="display:flex;gap:.4rem"><input type="checkbox" id="deid-${esc(i.id)}">I removed names and details that could identify a person.</label><div class="row" style="margin-top:.5rem">${btn('share-send','Send to review',`data-id="${esc(i.id)}"`,'btn sm')}<span class="tiny">Only this excerpt and program enter review. Your account, raw speech, story and private notes remain private.</span></div>`;
}

/* ---------------- Learned ---------------- */
function renderLearned(i){
  const lg=S.learning[i.owner]; const db=S.debriefs[i.id]; const future=myInterviews().filter(x=>x.id!==i.id && x.instant && x.instant>now() && !isInactive(x));
  return `<h2>What changed because of this interview</h2><p class="lead">One observation, carried forward on purpose.</p>
  <div class="grid2"><div class="panel moss">${renderLearningControls(i.owner,i)}</div>
  <div class="panel"><h4>Where it shows up next</h4>${lg?.status==='confirmed'? (future.length? future.map(x=>`<p>${esc(title(x))} (${fmtShort(x.instant)}): the rehearsal context carries “${esc(lg.goal)}”; ${/clos/i.test(lg.goal)?'the diagnosis checks your closing sentence first and the specific change names your goal':'the specific change names your goal'}. ${link('open-interview','Open',`data-id="${x.id}"`)}</p>`).join('') : '<p>No upcoming interview yet; it will apply to the next one you add.</p>') : '<p class="tiny">Nothing changes until you confirm the goal. Revoking removes it from every future rehearsal context.</p>'}
  <h4 style="margin-top:.8rem">Your report</h4><p class="tiny">${db?.saved? 'Saved privately. '+(db.questions.length)+' question(s), '+Object.keys(db.fields).length+' selections, '+db.raw.length+' raw segments, '+(db.edited?'an edited account':'no edited account')+'.' : 'Not saved yet.'}</p></div></div>
  <details style="margin-top:1rem"><summary>Later: a consented handoff to RankList IQ</summary><p class="tiny">RankList owns ranking. If you consent, a versioned copy of this interview's logistics and your reviewed learning (never raw speech) could be handed off later, with correction and removal rules. No handoff is sent until an authorized integration is available.</p>${(()=>{const rk=S.rank[i.owner]||{consent:false,version:0}; return `<div class="row">${btn('rank-consent', rk.consent?'Withdraw consent':'Consent to a future handoff (version '+(rk.version+1)+')','','btn ghost sm')}${rk.consent?chip('consented · version '+rk.version,'ok'):chip('no consent')}</div>`;})()}</details>`;
}

/* ---------------- Schedule ---------------- */
function renderSchedule(i){
  const ov=S.ui.sub.overlap; const st=S.ui.sub.sched||{};
  const date=st.date??(i.date||(i.wall?i.wall.slice(0,10):'')), time=st.time??(i.wall?i.wall.slice(11,16):''), zone=st.zone??(i.zone||P(i.program)?.zone||F.student_zone);
  return `<h2>Schedule & details</h2><p class="lead">Named zone plus the exact moment. Unknown stays unknown; nothing is rounded into a fact.</p>${renderScheduleWarnings(myInterviews(),i.id)}
  <div class="grid2"><div>
    <div class="inline"><div><label class="f" for="sd-date">Date</label><input type="date" id="sd-date" value="${esc(date)}"></div><div><label class="f" for="sd-time">Start time</label><input type="time" id="sd-time" value="${esc(time)}"></div><div><label class="f" for="sd-zone">Program's zone</label><select id="sd-zone">${ZONES.map(z=>`<option ${z===zone?'selected':''}>${z}</option>`).join('')}</select></div></div>
    <label class="f" style="display:inline-flex;gap:.4rem;align-items:center"><input type="checkbox" id="sd-allday" ${!i.wall&&i.date?'checked':''}> Time not known yet (date only)</label>
    <div class="inline"><div><label class="f" for="sd-dur">Duration (min, blank = unknown)</label><input type="number" id="sd-dur" min="1" max="1440" value="${i.duration??''}"></div><div><label class="f" for="sd-travel">Travel buffer before (min, your estimate)</label><input type="number" id="sd-travel" min="0" value="${i.travel_minutes??''}"></div><div><label class="f" for="sd-format">Format</label><select id="sd-format">${['','virtual','in person','hybrid','unknown'].map(f=>`<option ${f===(i.format||'')?'selected':''}>${f}</option>`).join('')}</select></div></div>
    <label class="f" for="sd-join">Joining details / location (from the invitation)</label><input type="text" id="sd-join" value="${esc(i.joining||'')}">
    ${ov? `<div class="panel amber" style="margin-top:.6rem"><b>${esc(ov.msg)}</b><div class="row" style="margin-top:.4rem">${ov.cands.map((c,k)=>btn('schedule-save','Use '+c.label+' ('+fmtTime(c.instant,'UTC').replace(' UTC','')+' UTC)',`data-id="${i.id}" data-fold="${k}"`,'btn sm')).join('')}</div></div>`:''}
    ${S.ui.sub.dst? `<div class="panel sky" style="margin-top:.6rem"><b>Daylight-saving check (not saved):</b> ${esc(S.ui.sub.dst)}</div>`:''}
    <div class="row" style="margin-top:.75rem">${btn('schedule-save','Save schedule',`data-id="${i.id}"`)}${!isInactive(i)?btn('postpone','Postpone',`data-id="${i.id}"`,'btn ghost')+btn('waitlist','Mark waitlisted',`data-id="${i.id}"`,'btn ghost')+btn('cancel','Cancel this interview',`data-id="${i.id}"`,'btn ghost'):btn('restore','Restore previous status',`data-id="${i.id}"`,'btn warn')}</div>
    
    <details style="margin-top:.5rem"><summary>Offer details</summary><label class="f" for="of-name">Name on the invitation</label><input type="text" id="of-name" value="${esc(i.unresolved_input||'')}"><label class="f" for="of-track">Track (optional)</label><input id="of-track" value="${esc(i.track||'')}" maxlength="300"><label class="f" for="of-deadline">Scheduling deadline (blank = unknown)</label><input type="date" id="of-deadline" value="${esc(i.deadline||'')}"><label class="f" for="of-program">Program link</label><select id="of-program"><option value="">unresolved</option>${F.programs.map(p=>`<option value="${p.id}" ${p.id===i.program?'selected':''}>${esc(programLabel(p))}</option>`).join('')}</select><div class="row" style="margin-top:.5rem">${btn('offer-save','Save offer details',`data-id="${i.id}"`,'btn sm')}${btn('disposition','Decline this offer',`data-id="${i.id}" data-v="declined"`,'btn ghost sm')}</div></details>
  </div><div>
    <h4>Related events</h4>${i.related.length? i.related.map((e,k)=>{
      const wall=e.wall||(e.instant?wallString(new Date(e.instant),e.zone||i.zone):e.date||'');
      return `<div class="panel" style="margin-bottom:.5rem"><b>${esc(e.kind)}</b> ${chip(e.status==='cancelled'?'cancelled':'scheduled',e.status==='cancelled'?'warn':'')} · ${e.instant?fmtInZone(e.instant,e.zone||i.zone):esc(e.date)+' · time not set'} · ${e.duration_minutes==null?'duration unknown':e.duration_minutes+' min'}<p class="tiny" style="margin:.3rem 0">${esc(relatedStatus(i,e))} A social is not an interview encounter.</p>
      ${e.status==='cancelled'?btn('related-lifecycle','Restore event',`data-id="${i.id}" data-k="${k}" data-action="restore"`,'btn ghost sm'):`<div class="inline"><div><label class="f" for="rel-date-${k}">Event date</label><input type="date" id="rel-date-${k}" value="${esc(wall.slice(0,10))}"></div><div><label class="f" for="rel-time-${k}">Event start (blank = unknown)</label><input type="time" id="rel-time-${k}" value="${esc(wall.slice(11,16))}"></div></div><label class="f" for="rel-zone-${k}">Event timezone</label><select id="rel-zone-${k}">${[...new Set([e.zone||i.zone,...ZONES])].map(z=>`<option ${z===(e.zone||i.zone)?'selected':''}>${esc(z)}</option>`).join('')}</select><label class="f" for="rel-dur-${k}">Event duration (min, blank = unknown)</label><input type="number" min="1" max="1440" id="rel-dur-${k}" value="${e.duration_minutes??''}">${foldSelect('rel-fold-'+k)}<div class="row">${btn('related-save','Save event details',`data-id="${i.id}" data-k="${k}"`,'btn ghost sm')}${btn('related-lifecycle','Cancel event',`data-id="${i.id}" data-k="${k}" data-action="cancel"`,'btn ghost sm')}</div>`}</div>`;
    }).join('') : '<p class="tiny">None.</p>'}
    <h4 style="margin-top:1rem">History</h4><ul class="hist">${i.history.slice().reverse().map(h=>`<li><time>${fmtStamp(h.at)}</time><b>${esc(h.what)}</b> ${esc(h.detail)}</li>`).join('')||'<li class="tiny">Supplied as-is; no changes yet.</li>'}</ul>
    <p class="tiny" style="margin-top:.6rem">${calendarV2()&&i.owner===actor.id?btn('itinerary-open','Private itinerary',`data-id="${i.id}"`,'btn ghost'):''}${intakeEnabled()&&i.owner===actor.id?btn('intake-edit','Edit optional intake details',`data-id="${i.id}"`,'btn ghost'):''} Your schedule is saved here. Delivery of reminders or publication to another calendar requires an available authorized integration.</p>
  </div></div>`;
}


function renderResearchBrief(i){
 const d=S.demands[i.id],checked=researchBriefs.get(i.id),r=checked&&d&&checked.requestId===d.requestId&&checked.version===d.version&&checked.registryReleaseId===d.registryReleaseId?checked.research:null;
 const action=d?.requestId?btn('research-refresh','Check research',`data-id="${esc(i.id)}"`,'btn sm'):btn('open-section','Confirm program',`data-id="${esc(i.id)}" data-section="identify"`,'btn sm');
 const header=`<h2>The brief</h2><p class="lead">Program evidence from RISE, with sources and dates.</p><div class="panel pad"><b>${esc(d?.status||'Waiting for program identity')}</b> ${action}<p class="tiny">Checking uses the saved request. It does not start a new paid research run.</p></div>`;
 if(!r)return header+'<p>Current findings have not been read back in this view. Check research to load available evidence. Your interview stays saved if research is unavailable.</p>';
 const facts=r.facts.map(f=>`<div class="ans"><h4>${esc(f.field.replace(/^research\./,'').replaceAll('_',' '))}</h4><pre style="white-space:pre-wrap;overflow-wrap:anywhere;font:inherit">${esc(typeof f.value==='string'?f.value:JSON.stringify(f.value,null,2))}</pre><p class="tiny">Retrieved ${esc(f.retrievedAt)}${f.asOf?' · '+esc(f.asOf.label):''}</p>${f.sources.map(s=>`<div class="tiny">${s.urls.map(u=>`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u)}</a>`).join('<br>')}<br>Retrieved ${esc(s.retrievedAt)}${s.reviewedAt?' · Reviewed '+esc(s.reviewedAt):''}</div>`).join('')}</div>`).join('');
 const missing=r.coverage.fields.filter(f=>!r.facts.some(v=>v.field===f.field));
 return header+`<div class="brief">${facts||'<p>No current supported facts are available.</p>'}<div class="ans warn"><h4>What remains uncertain</h4><ul>${missing.map(f=>`<li>${esc(f.field.replace(/^research\./,'').replaceAll('_',' '))}: ${esc(f.state==='SUPPORTED'?'Evidence exists; no public factual value available':f.state.toLowerCase())}</li>`).join('')||'<li>All fields have current findings. Verify important details with the program.</li>'}</ul><p>${r.facts.length} of ${r.coverage.fields.length} fields have displayed findings. Observed ${esc(r.coverage.observedAt)}.</p></div></div>`;
}

function loiResearchNeeded(i){
 const e=loiEvidence.get(loiMemoryKey(i)),facts=e?.research?.facts||[];
 if(facts.some(f=>f.state==='SUPPORTED'))return '';
 if(e?.error)return 'Current canonical evidence is unavailable: '+e.error;
 if(!e?.research)return 'Read current evidence for the confirmed program. No current supported canonical evidence has been loaded.';
 const missing=(e.research.coverage?.fields||[]).filter(f=>f.state!=='SUPPORTED').map(f=>f.field+': '+f.state+(f.reason?' — '+f.reason:''));
 return 'No current supported canonical program evidence is available.'+(missing.length?' Missing evidence: '+missing.join('; ')+'.':'');
}

function renderLoi(i){
 if(!loiEnabled()||!ownsLoiSubject(i))return '<p>Letter of Interest is unavailable for this workspace.</p>';
 const state=loiState(i),h=state.current,e=loiEvidence.get(loiMemoryKey(i)),prepared=loiHandoffs.get(loiMemoryKey(i)),id=esc(i.id),subjectAttr=i.targetKind==='program'?' data-target-kind="program"':'';
 const field=(k,label,value,area=false)=>`<label class="f" for="loi-${k}-${id}">${label}</label>${area?`<textarea id="loi-${k}-${id}" maxlength="20000" rows="${k==='text'?12:3}">${esc(value||'')}</textarea>`:`<input id="loi-${k}-${id}" maxlength="1000" value="${esc(value||'')}">`}`;
 const confirm=(k,label)=>`<label><input type="checkbox" id="loi-${k}-${id}" ${h?.[k==='factual'?'studentFactualConfirmation':'studentSpecificityConfirmation']===true?'checked':''}> ${label}</label>`;
 return `<h2>Letter of Interest</h2><p class="lead">Use supported program details and your confirmed words. Your letters and outreach history stay private.</p><p class="tiny">Draft assembly uses your wording. ${loiCompositionEnabled()?'Hybrid composition is available below when your current access permits it; standard drafting remains available. Mentor review is unavailable.':'AI drafting and mentor review are unavailable.'} Gmail opens a draft; you review it and press Send.</p>${!i.program?'<p role="status">Confirm the exact program before selecting evidence or approving a letter.</p>':''}${state.currentConsentValid===false?'<p role="alert">Referenced StoryForge permission is no longer active. Historical letters are retained; approval and outreach require a fresh permitted draft.</p>':''}${h&&!state.currentBindingValid?'<p role="alert">This retained letter belongs to an earlier program, track or release. Confirm the new context and save a fresh draft; its previous approval is historical.</p>':''}
 ${field('whyNow','Why now?',h?.context?.whyNow)}${field('applicationState','Your application status (confirmed by you)',h?.context?.applicationState)}${field('interviewState','Your interview status (confirmed by you)',h?.context?.interviewState)}${field('motivations','Your genuine reasons — one per line',(h?.motivations||[]).map(x=>x.text).join('\n'),true)}${field('facts','Your student facts — one per line',(h?.facts||[]).map(x=>x.text).join('\n'),true)}
 <div class="panel pad"><h3>Supported program evidence</h3>${btn('loi-evidence','Read current evidence',`data-id="${id}"${subjectAttr}`,'btn ghost')}<p class="tiny">Evidence reads do not start research. Unknown or unavailable details cannot be approved as verified.</p>${e?.error?`<p role="status">${esc(e.error)}</p>`:''}${(e?.research?.facts||[]).map((f,k)=>f.state==='SUPPORTED'?`<label class="panel pad" style="display:block"><input type="checkbox" id="loi-evidence-${k}-${id}" ${(h?.selectedEvidence||[]).some(x=>x.field===f.field&&x.claimRef===f.claimRef)?'checked':''}> <b>${esc(threeboxFieldLabel(f.field))}</b><p>${esc(typeof f.value==='string'?f.value:JSON.stringify(f.value))}</p><small>${esc(f.asOf?.label||'Period not specified')} · retrieved ${esc(f.retrievedAt)}</small>${(f.sources||[]).map(s=>`<p class="tiny">${(s.urls||[]).map(u=>esc(u)).join(' · ')} · ${esc(s.retrievedAt)}</p>`).join('')}</label>`:'').join('')}${loiResearchNeeded(i)?`<p role="status"><b>RESEARCH NEEDED</b> — ${esc(loiResearchNeeded(i))} You may manually write and save a pending draft; approval requires supported evidence.</p>`:''}</div>
 <div class="row">${confirm('factual','I reviewed all entered facts and statuses; they are true.')}${confirm('specific','This letter would not work unchanged for another program.')}</div>${btn('loi-build','Build draft from confirmed words',`data-id="${id}"${subjectAttr}`,'btn ghost')}${field('text','Your letter — edit before approval',h?.text,true)}<div class="row">${btn('loi-save','Check & save draft',`data-id="${id}"${subjectAttr}`)}${btn('loi-approve','Approve saved revision',`data-id="${id}"${subjectAttr} ${!h||h.state!=='draft'||state.currentConsentValid===false?'disabled':''}`,'btn ghost')}${btn('loi-export','Download private history',`data-id="${id}"${subjectAttr}`,'btn ghost')}</div>${renderLoiComposition(i)}
 ${h?`<p role="status">Saved revision ${esc(h.letterVersion)} · ${esc(h.state)}. ${esc((h.checks?.reasons||[]).join(' '))}</p>`:''}
 <h3>Send from your account</h3>${field('recipient','Recipient — confirm the exact address','')}${field('subject','Subject — review before opening','')}<label><input id="loi-recipientConfirmed-${id}" type="checkbox"> I reviewed this recipient and subject.</label><div class="row">${btn('loi-handoff','Prepare Gmail / mailto / copy',`data-id="${id}"${subjectAttr} ${!h||h.state!=='approved'||!state.currentBindingValid||state.currentConsentValid===false?'disabled':''}`)}</div>
 ${prepared?`<div class="panel pad"><p>${esc(prepared.reason||'Review the complete letter in your email app before sending.')}</p><div class="row">${prepared.gmailUrl?btn('loi-gmail','Open in Gmail',`data-id="${id}"${subjectAttr}`):''}${prepared.mailtoUrl?btn('loi-mailto','Open email app',`data-id="${id}"${subjectAttr}`,'btn ghost'):''}${btn('loi-copy','Copy approved letter',`data-id="${id}"${subjectAttr}`,'btn ghost')}${btn('loi-mark-sent','Mark as sent (self-reported)',`data-id="${id}"${subjectAttr}`,'btn ghost')}</div><label><input id="loi-sentConfirmed-${id}" type="checkbox"> I pressed Send in my email app. This is my report, not verified delivery.</label><label class="f" for="loi-copyText-${id}">Approved letter — manual copy fallback</label><textarea id="loi-copyText-${id}" readonly rows="8">${esc(prepared.text)}</textarea></div>`:''}
 <details><summary>Private letter and outreach history</summary><ul class="hist">${(state.history||[]).map(r=>`<li>${esc(r.createdAt||r.recordedAt||'')} · ${esc(r.state||'unavailable history')} ${(state.consentInvalidRevisionIds||[]).includes(r.revisionId)?' · historical permission unavailable':''} ${r.text?`<pre style="white-space:pre-wrap">${esc(r.text)}</pre>`:''}</li>`).join('')||'<li>No saved history yet.</li>'}</ul></details>`;
}

// Advanced → prelim/TY: tell the student which position context the server will derive from their own confirmed intake facts.
function loiPositionNotice(i){const PGY1=['PRELIMINARY','TRANSITIONAL_YEAR'];const mine=S.interviews.filter(x=>x.owner===actor.id);let type=null;if(i.targetKind==='program'){const types=[...new Set(mine.filter(x=>x.program&&x.program===i.program?.id&&x.intake?.details?.applicationState==='APPLIED').map(x=>x.intake?.positionType))];if(types.length===1&&PGY1.includes(types[0]))type=types[0];}else if(PGY1.includes(i.intake?.positionType))type=i.intake.positionType;if(!type)return '';const advanced=[...new Set(mine.filter(x=>x.intake?.positionType==='ADVANCED'&&x.intake?.details?.advancedFactConfirmed===true&&x.intake?.details?.pgy1Applied==='YES'&&x.intake?.details?.prelimTargetId&&(i.targetKind==='program'?x.intake.details.prelimTargetId===i.targetId:true)).map(x=>x.programName).filter(Boolean))];const label=type==='PRELIMINARY'?'Preliminary':'Transitional Year';return `<div class="panel sky pad loiPosition"><b>${label} (PGY-1) letter</b><p class="tiny">Drafts will state that this is a ${label} program, taken from your confirmed intake. ${advanced.length===1?`They may name your Advanced program, <b>${esc(advanced[0])}</b>, because you confirmed that interview fact.`:advanced.length>1?'More than one Advanced interview is linked, so no Advanced program is named until the link is unambiguous.':'No confirmed Advanced interview is linked yet, so no Advanced program is named.'} Nothing is inferred from a program label.</p></div>`;}
function renderLoiComposition(i){if(!loiCompositionEnabled()||!ownsLoiSubject(i)||i.targetKind==='program'&&i.choice!=='CREATE_LETTER')return '';const id=esc(i.id),attrs=`data-id="${id}"${i.targetKind==='program'?' data-target-kind="program"':''}`,entry=compositionProposal(i),g=entry?.generation,busy=loiCompositionBusy.has(loiMemoryKey(i)),uncertain=loiCompositionUncertain.has(loiMemoryKey(i))||g&&['RESERVED','OUTCOME_UNKNOWN'].includes(g.status),approach=compositionApproach(i),defaults=[approach,'WARM_PERSONAL','DIRECT_CONCISE','ACADEMIC_PROGRAM'].filter((a,k,all)=>all.indexOf(a)===k).slice(0,3),stale=g&&!compositionHeadMatches(i,g);
 const status=g?.status==='PROPOSED'?'AI-assisted proposals · review required':g?.status==='STANDARD_FALLBACK'?'Standard-format proposals · AI unavailable or bounded request refused':g?'Composition outcome unresolved · no automatic retry':'No proposals loaded';const reasons={AI_UNCONFIGURED:'Standard drafting is available while AI is not configured.',INPUT_LIMIT:'The bounded AI input limit was reached. Your confirmed words are preserved.',OWNER_USAGE_LIMIT:'Your composition allowance was reached. Standard drafting remains available.',PROVIDER_OUTCOME_UNKNOWN:'The provider outcome is uncertain. This request will not be retried automatically.',PROVIDER_OR_VALIDATION_FAILED:'AI or factual validation failed. Review the standard-format proposal.'};
 return `<section class="loiComposition panel pad" aria-label="Letter composition"><h3>Your writing approach</h3><p class="tiny">Choose a structure for this letter. Your default affects new letters only; saved drafts, approvals and sent history stay unchanged.</p><div class="row">${btn('loi-style-open','MY LOI STYLE','','btn ghost')}</div><label class="f" for="loi-composition-approach-${id}">Approach for this letter</label><select id="loi-composition-approach-${id}">${LOI_APPROACHES.map(a=>`<option value="${a[0]}" ${a[0]===approach?'selected':''}>${esc(a[1])}</option>`).join('')}</select>${loiPositionNotice(i)}<p class="tiny">AI composition, when available, uses only your confirmed words and selected supported details. A reference-only guard cannot guarantee every implication; you must review factual accuracy.</p><label style="display:block"><input type="checkbox" id="loi-composition-post-${id}"> My interview actually occurred; this context is appropriate for reflection.</label><label style="display:block"><input type="checkbox" id="loi-composition-update-${id}"> My student facts include an actual, current update.</label><details><summary>Choose three approaches to compare</summary><div class="drawerChoice">${LOI_APPROACHES.map((a,k)=>`<label><input type="checkbox" id="loi-composition-compare-${k}-${id}" ${defaults.includes(a[0])?'checked':''}> <b>${esc(a[1])}</b><small style="display:block">${esc(a[2])}</small></label>`).join('')}</div></details><div class="row" style="margin-top:12px">${btn('loi-compose-one','Generate one',`${attrs} ${busy||uncertain?'disabled':''}`)}${btn('loi-compose-three','SHOW ME 3',`${attrs} ${busy||uncertain?'disabled':''}`,'btn ghost')}${btn('loi-compose-load','Load saved proposals',`${attrs} ${busy?'disabled':''}`,'btn ghost')}</div><p role="status">${busy?'Composition request in progress. No duplicate request will run.':uncertain?'The outcome is uncertain. Do not submit another generation as a retry; load saved proposals or keep your standard draft.':status}</p>${g?.reason&&reasons[g.reason]?`<p class="tiny">${esc(reasons[g.reason])}</p>`:''}${entry?.empty?'<p role="status">No saved proposals were found for this letter.</p>':''}${stale?'<p role="alert">Your saved letter changed after these proposals were requested. They are retained for review; selection cannot overwrite the newer draft.</p>':''}${g?`<p class="tiny">Program: ${esc(g.provenance.program.name)} · ${esc(g.provenance.program.track||'Track not specified')}. Evidence was observed ${esc(g.provenance.observedAt||'at an unspecified time')}; current evidence is rechecked when you select a draft.</p><details><summary>Exact confirmed and supported spans used</summary>${g.provenance.factualSpans.map(s=>`<p><b>${esc(s.kind==='evidence'?'Supported program detail':s.kind==='reason'?'Your confirmed reason':s.kind==='fact'?'Your confirmed fact':s.kind==='identity'?'Canonical program':'Your confirmed context')}</b></p><p>${esc(s.text)}</p>${s.kind==='evidence'?`<p class="tiny">${esc(s.asOf?.label||'Period not specified')}${(s.sources||[]).flatMap(x=>x.urls||[]).map(u=>' · '+esc(u)).join('')}</p>`:''}`).join('')}</details>`:''}${(g?.proposals||[]).map((p,k)=>`<article class="panel pad" style="margin-top:12px"><h4>${esc(compositionLabel(p.approach))}</h4><label class="f" for="loi-composition-proposal-${k}-${id}">Preview and edit this proposal</label><textarea id="loi-composition-proposal-${k}-${id}" rows="8" maxlength="20000">${esc(p.text)}</textarea><label style="display:block"><input type="checkbox" id="loi-composition-review-${k}-${id}"> I reviewed this proposal and my edits; create a new private draft.</label>${btn('loi-compose-select','Select as new draft',`${attrs} data-candidate="${k}" ${stale||busy||uncertain?'disabled':''}`,'btn ghost')}<p class="tiny">Selection saves a draft only. Review and approve exactly one saved revision in the letter editor before outreach.</p></article>`).join('')}</section>`;
}

const MYERAS_STEPS=['HOW THIS WORKS','OPEN CHATGPT','COPY YOUR PROMPT','LET CHATGPT BUILD THE FILE','UPLOAD IT HERE','REVIEW YOUR PROGRAMS','DONE'];
function renderMyerasReview(){const f=myerasFlow,p=f.preview,page=f.page||1,rows=p.rows.slice((page-1)*25,page*25),c=p.counts;return `<p role="status">${c.imported} imported · ${c.MATCHED} matched to RISE · ${c.NEEDS_CONFIRMATION} need your help · ${c.NOT_FOUND} not found · ${c.duplicates} duplicate rows combined.</p><p>Matching uses verified canonical identifiers and available registry labels. Partial searches and unavailable location labels need your confirmation. No source row is discarded. Evidence readiness stays UNKNOWN.</p>${rows.map(r=>{const d=f.decisions[r.rowKey]||{},prior=r.existingTarget,chosen=d.programId;return `<article class="panel pad"><h3>${esc(r.original.program_name)}</h3><p class="tiny">${esc(r.original.specialty)} · ${esc(r.original.track)} · ${esc(r.original.institution)} · ${esc(r.original.city)} ${esc(r.original.state)}</p><p>${esc(r.resolutionState.replaceAll('_',' '))}${!r.lookupComplete?' · bounded partial lookup; never a unique match':''}</p>${r.program?`<p>Verified RISE identity: ${esc(programLabel(r.program))}.</p>`:r.candidates.length?`<label class="f" for="myeras-program-${r.rowKey}">Which program did you mean?</label><select id="myeras-program-${r.rowKey}" data-myeras-row="${r.rowKey}" data-myeras-field="programId"><option value="">Keep on my list — resolution pending</option>${r.candidates.map(x=>`<option value="${esc(x.id)}" ${chosen===x.id?'selected':''}>${esc(programLabel(x))}</option>`).join('')}</select><label><input type="checkbox" data-myeras-row="${r.rowKey}" data-myeras-field="confirmed" ${d.confirmed?'checked':''}> I confirm this exact program and track.</label>`:'<p>KEEP ON MY LIST with canonical resolution pending. You can resolve it later; no verified evidence is invented.</p>'}<label class="f" for="myeras-choice-${r.rowKey}">Your letter choice</label><select id="myeras-choice-${r.rowKey}" data-myeras-row="${r.rowKey}" data-myeras-field="choice">${[['MAYBE_LATER','MAYBE LATER'],['CREATE_LETTER','CREATE LETTER'],['SKIP','SKIP']].map(([v,l])=>`<option value="${v}" ${(d.choice??r.choice)===v?'selected':''}>${l}</option>`).join('')}</select>${prior?'<p class="tiny">Existing choice and edits are retained unless you explicitly change this choice. Retained letters stay in their current history.</p>':''}<details><summary>Original MyERAS source</summary><dl>${Object.entries(r.original).map(([k,v])=>`<dt>${esc(k.replaceAll('_',' '))}</dt><dd>${esc(v||'Not displayed')}</dd>`).join('')}</dl></details></article>`;}).join('')}<div class="row">${btn('myeras-page','Previous programs',`data-page="${page-1}" ${page<=1?'disabled':''}`,'btn ghost')}${btn('myeras-page','Next programs',`data-page="${page+1}" ${page*25>=p.rows.length?'disabled':''}`,'btn ghost')}<span class="tiny">Page ${page} of ${Math.max(1,Math.ceil(p.rows.length/25))}</span></div>`;}
function renderMyerasWizard(){if(!myerasEnabled()||!myerasFlow)return '<p>MyERAS import is unavailable.</p>';const f=myerasFlow,s=f.step;let body='';
 if(s===1)body=`<h2>Import your <em>MyERAS programs</em></h2><p>Already applied through MyERAS? You don't need to enter every program again. We'll give you a ready-to-use prompt for your own ChatGPT. It can help create a simple list of the programs you applied to. Then bring that file back here.</p><div class="panel pad">YOUR MYERAS → YOUR CHATGPT → CSV FILE → IV IQ</div><h3>Your login stays with you.</h3><p>MissionMed never needs your MyERAS password. Do not paste your password into ChatGPT. You log into MyERAS yourself.</p>${btn('myeras-next','IMPORT FROM MYERAS')}`;
 if(s===2)body=`<h2>Open your <em>ChatGPT</em></h2><p>For the easiest import, use ChatGPT with browser/computer-use capabilities available on your account. Availability depends on your plan and configuration; this wizard does not verify or require that capability.</p><div class="row"><a class="btn" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">OPEN CHATGPT →</a>${btn('myeras-next','I ALREADY HAVE CHATGPT OPEN →')}${btn('myeras-help','MY CHATGPT CAN’T DO THIS →','','btn ghost')}</div>`;
 if(s===3)body=`<h2>We wrote the <em>instructions for you</em></h2><p>Copy this entire prompt into a new ChatGPT conversation. You don't need to edit it.</p><div class="row">${btn('myeras-copy-prompt','COPY PROMPT')}${btn('myeras-download-prompt','DOWNLOAD PROMPT','','btn ghost')}${btn('myeras-next',"I'VE PASTED IT →")}</div><details><summary>Read the exact export prompt</summary><pre>${esc(MYERAS_EXPORT_PROMPT)}</pre></details>`;
 if(s===4)body=`<h2>Let ChatGPT do the <em>boring part</em></h2><ol><li>ChatGPT opens MyERAS if your account supports it.</li><li>YOU log in.</li><li>ChatGPT reads your applied-program list and creates the file.</li></ol><h3>YOU DO THE LOGIN.</h3><p>Never give your MyERAS password to ChatGPT or MissionMed. Expected output: MYERAS_APPLIED_PROGRAMS.csv.</p><div class="row">${btn('myeras-next','I HAVE MY FILE →')}${btn('myeras-help','CHATGPT IS STUCK →','','btn ghost')}</div>`;
 if(s===5)body=`<h2>Got the file? <em>Drop it here.</em></h2><p>We'll match these programs to RISE. Nothing is added or changed in MyERAS.</p><label class="myerasDrop" id="myeras-drop" for="myeras-file">UPLOAD MYERAS_APPLIED_PROGRAMS.csv<br><span>Drop a file or choose file · UTF-8 CSV · maximum 256 KiB · 2000 rows</span><input type="file" id="myeras-file" accept=".csv,text/csv"></label><p role="status">${esc(f.fileName||'Choose your CSV file.')} ${f.csvText?'File loaded locally; continue to server validation and review.':''}</p><details><summary>I already have CSV text</summary><textarea id="myeras-csv-text" maxlength="262144" rows="8" placeholder="Paste only the CSV file text, never credentials">${esc(f.csvText||'')}</textarea></details>`;
 if(s===6)body=`<h2>We found <em>your programs</em></h2>${renderMyerasReview()}`;
 if(s===7)body=`<h2>Your program list <em>is ready</em></h2><p role="status">${f.summary?.unique??f.preview?.counts.unique??0} source programs retained · ${f.summary?.MATCHED??0} matched · ${f.summary?.NEEDS_CONFIRMATION??0} need confirmation · ${f.summary?.NOT_FOUND??0} not found.</p><p>Your choices are saved in My Letters. Importing never generates or sends letters, creates Calendar events or changes MyERAS or RISE Saved Programs.</p><div class="row">${btn('myeras-done','GO TO MY LETTERS →')}${btn('myeras-review-again','REVIEW PROGRAMS →','','btn ghost')}</div>`;
 return `<section class="myerasWizard"><p class="eyebrow">IMPORT MY PROGRAMS · STEP ${s} OF 7</p><ol class="myerasProgress" aria-label="Import progress">${MYERAS_STEPS.map((n,k)=>`<li ${k+1===s?'aria-current="step"':''}><span class="stepLabel">${esc(n)}</span><span class="srOnly">${k+1<s?'Completed':k+1===s?'Current step':'Upcoming'}</span></li>`).join('')}</ol>${body}${f.help?`<div class="panel pad" role="region"><h3>Keep going your way</h3><p>You can use the prompt again, bring an existing file, fill in the blank CSV template or add programs manually. External AI capability never gates your letters.</p><div class="row">${btn('myeras-retry-prompt','TRY AGAIN WITH THE PROMPT','','btn ghost')}${btn('myeras-blank','DOWNLOAD BLANK CSV TEMPLATE','','btn ghost')}${btn('myeras-upload-step','UPLOAD A CSV I ALREADY HAVE','','btn ghost')}${btn('myeras-manual','ADD PROGRAMS MANUALLY','','btn ghost')}</div></div>`:''}${f.error?`<p role="alert">${esc(f.error)}</p>`:''}<div class="mcv2-drawer-actions">${btn('myeras-back','Back',s<=1||f.busy||s===7?'disabled':'','btn ghost')}${s<7?btn(s===5?'myeras-preview':s===6?'myeras-import':'myeras-next',s===6?'Save my program list':'Continue',f.busy||s===5&&!f.csvText?'disabled':''):''}${btn('myeras-help','Help','','btn ghost')}${btn('drawer-close','Close','','btn ghost')}</div>${f.busy?'<p role="status">Checking your own program list…</p>':''}</section>`;
}

function intakeValue(path){return path.split('.').reduce((o,k)=>o?.[k],intakeFlow);}
function intakeInput(path,label,type='text',max=500,hint=''){const id='in-'+path.replaceAll('.','-'),value=intakeValue(path);return `<label class="f" for="${id}">${esc(label)}</label>${hint?`<p class="fieldHint">${esc(hint)}</p>`:''}<input id="${id}" type="${type}" value="${esc(value??'')}" data-intake-field="${esc(path)}" ${type==='number'?'data-intake-number="true" min="0" max="2100"':`maxlength="${max}"`}>`;}
function intakeSelect(path,label,options){const id='in-'+path.replaceAll('.','-'),value=intakeValue(path);return `<label class="f" for="${id}">${esc(label)}</label><select id="${id}" data-intake-field="${esc(path)}">${path==='positionType'||path.endsWith('.kind')||path.endsWith('.zone')?'':'<option value="">Unknown / skip</option>'}${options.map(o=>{const [v,l]=Array.isArray(o)?o:[o,o.replaceAll('_',' ')];return `<option value="${esc(v)}" ${String(value??'')===String(v??'')?'selected':''}>${esc(l)}</option>`;}).join('')}</select>`;}
function intakeCheck(path,label){return `<label class="intakeCheck"><input type="checkbox" data-intake-field="${esc(path)}" ${intakeValue(path)===true?'checked':''}> ${esc(label)}</label>`;}
// V2: large tappable choice cards replace small selects for the primary questions. Each option is [value,label,icon?,hint?].
function intakeChoice(path,label,options,{hint='',allowUnknown=false,columns=0}={}){const value=intakeValue(path),id='in-'+path.replaceAll('.','-'),opts=allowUnknown?[...options,['', "I don't know yet",'🤷','You can come back to this later.']]:options;return `<div class="choiceGroup" role="group" aria-labelledby="${id}-lbl"><p class="f choiceLabel" id="${id}-lbl">${esc(label)}</p>${hint?`<p class="fieldHint">${esc(hint)}</p>`:''}<div class="choiceCards${columns?' cols-'+columns:''}">${opts.map(([v,l,icon,sub])=>{const on=String(value??'')===String(v??'');return `<button type="button" class="choiceCard${on?' on':''}" data-act="intake-choice" data-field="${esc(path)}" data-value="${esc(v??'')}" aria-pressed="${on}">${icon?`<span class="choiceIcon" aria-hidden="true">${icon}</span>`:''}<span class="choiceText"><b>${esc(l)}</b>${sub?`<small>${esc(sub)}</small>`:''}</span></button>`;}).join('')}</div></div>`;}
// V2: visual month-grid calendar picker; typed entry stays available as a secondary control.
function intakeMonthLabel(ym){const [y,m]=ym.split('-').map(Number);return new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'long',year:'numeric'}).format(new Date(Date.UTC(y,m-1,1)));}
function intakeShiftMonth(ym,delta){const [y,m]=ym.split('-').map(Number);const d=new Date(Date.UTC(y,m-1+delta,1));return d.toISOString().slice(0,7);}
function intakeDatePicker(path,label,{hint='',unknownLabel="I don't know yet"}={}){
 const raw=intakeValue(path),value=typeof raw==='string'&&/^\d{4}-\d{2}-\d{2}/.test(raw)?raw.slice(0,10):null,today=todayKey(),view=intakeFlow.calView?.[path]||(value?value.slice(0,7):today.slice(0,7));
 const [y,m]=view.split('-').map(Number),first=new Date(Date.UTC(y,m-1,1)),offset=first.getUTCDay(),days=new Date(Date.UTC(y,m,0)).getUTCDate(),id='in-'+path.replaceAll('.','-');
 const cells=[];for(let k=0;k<offset;k++)cells.push('<span class="calPickBlank" aria-hidden="true"></span>');
 for(let d=1;d<=days;d++){const key=`${view}-${String(d).padStart(2,'0')}`,on=value===key;cells.push(`<button type="button" role="gridcell" class="calPickDay${on?' on':''}${key===today?' today':''}" data-act="intake-cal-pick" data-field="${esc(path)}" data-date="${key}" aria-pressed="${on}" aria-label="${esc(fmtDateOnly(key))}">${d}</button>`);}
 return `<div class="calPick" role="group" aria-labelledby="${id}-lbl"><p class="f choiceLabel" id="${id}-lbl">${esc(label)}</p>${hint?`<p class="fieldHint">${esc(hint)}</p>`:''}<div class="calPickHead"><button type="button" class="calPickNav" data-act="intake-cal-nav" data-field="${esc(path)}" data-month="${intakeShiftMonth(view,-1)}" aria-label="Previous month">‹</button><b>${esc(intakeMonthLabel(view))}</b><button type="button" class="calPickNav" data-act="intake-cal-nav" data-field="${esc(path)}" data-month="${intakeShiftMonth(view,1)}" aria-label="Next month">›</button></div><div class="calPickGrid" role="grid" aria-label="${esc(label)} calendar">${['Su','Mo','Tu','We','Th','Fr','Sa'].map(w=>`<span class="calPickWd" aria-hidden="true">${w}</span>`).join('')}${cells.join('')}</div><div class="calPickFoot"><span class="calPickValue" role="status">${value?'Selected · '+esc(fmtDateOnly(value))+' '+esc(value.slice(0,4)):'No date yet'}</span><button type="button" class="btn ghost sm" data-act="intake-cal-clear" data-field="${esc(path)}">${esc(unknownLabel)}</button></div><details class="calPickTyped"><summary>Type the date instead</summary>${intakeInput(path,'Date (YYYY-MM-DD)','date')}</details></div>`;
}
function intakeSchedule(path,{dateLabel='Which day?',dateHint=''}={}){return `<div class="datePair"><span class="dateIcon" aria-hidden="true">📅</span><div class="dateField">${intakeDatePicker(path+'.date',dateLabel,{hint:dateHint})}</div><div class="timeField">${intakeInput(path+'.time','Start time (leave blank if unknown)','time')}<p class="fieldHint">Use the program’s local time.</p></div></div>${intakeChoice(path+'.format','How will it happen?',[['virtual','Virtual','💻'],['in person','In person','🏥'],['hybrid','Hybrid','🔀'],['phone','Phone','📞'],['unknown',"Don't know yet",'🤷']],{columns:5})}<details class="moreDetails"><summary>Duration, timezone and joining details</summary><div class="intakeGrid">${intakeInput(path+'.duration','Duration in minutes (optional)','number')}${intakeSelect(path+'.zone','Program timezone',ZONES)}<div>${intakeSelect(path+'.fold','If the clock repeats, choose occurrence',[['0','First occurrence'],['1','Second occurrence']])}<p class="fieldHint">Only choose this when the local time repeats at the daylight-saving change.</p></div></div>${intakeInput(path+'.joining','Private joining link or location (optional)','text',4000)}</details>`;}
function intakePrelimTargets(){return (S.loiTargets?.targets||[]).filter(t=>t.choice==='CREATE_LETTER'&&t.program&&S.interviews.some(i=>i.owner===actor.id&&i.program===t.program.id&&['PRELIMINARY','TRANSITIONAL_YEAR'].includes(i.intake?.positionType)&&i.intake?.details.applicationState==='APPLIED'));}
// Program hero imagery: only an approved, canonical-program-matched institution exterior is ever shown. Otherwise an honest MissionMed fallback.
function programHero(programId){const list=S.programMedia?.[programId];if(!Array.isArray(list))return null;return list.find(m=>m&&m.approvalState==='APPROVED'&&m.category==='INSTITUTION_EXTERIOR'&&m.programId===programId&&typeof m.url==='string'&&/^https:\/\//.test(m.url))||null;}
function heroMedia(programId,label,{compact=false}={}){const m=programId?programHero(programId):null;if(m)return `<figure class="heroMedia${compact?' compact':''}"><img src="${esc(m.url)}" alt="${esc(m.alt||label||'Institution exterior')}" loading="lazy" decoding="async" width="1200" height="514"><figcaption>${esc(m.caption||label||'')}${m.publisher?' · '+esc(m.publisher):''}</figcaption></figure>`;return `<div class="heroMedia heroFallback${compact?' compact':''}" role="img" aria-label="${esc(label||'Program')}"><span class="heroMono" aria-hidden="true">IV<em>IQ</em></span><span class="heroName">${esc(label||'Your program')}</span><span class="heroSub">${programId?'Verified hospital imagery arrives once approved for this program.':'Confirm the canonical program to unlock program imagery.'}</span></div>`;}
function programCard(p,{selected=false,ambiguous=false}={}){const ids=[p.id?['RISE ID',p.id]:null,typeof p.acgmeId==='string'&&p.acgmeId?['ACGME ID',p.acgmeId]:null].filter(Boolean);const where=[typeof p.institution==='string'?p.institution:'',[p.city,p.state].filter(x=>typeof x==='string'&&x).join(', ')].filter(Boolean).join(' · ');return `<button type="button" class="programCard${selected?' on':''}" data-act="intake-select" data-program="${esc(p.id)}" aria-pressed="${selected}"><span class="pcTop"><b class="pcName">${esc(p.name||'Program identity pending')}</b>${p.specialty?`<span class="pcChip">${esc(p.specialty)}</span>`:''}</span>${where?`<span class="pcWhere">${esc(where)}</span>`:''}<span class="pcMeta">${p.track?`<span>${esc(p.track)}</span>`:'<span>Track not listed</span>'}${typeof p.positionType==='string'?`<span>${esc(p.positionType.replaceAll('_',' '))}</span>`:''}</span><span class="pcIds">${ids.map(([k,v])=>`<span><small>${k}</small>${esc(v)}</span>`).join('')}</span>${ambiguous?'<span class="pcWarn">Several results share this name. Check the track and IDs before you confirm.</span>':''}<span class="pcChoose">${selected?'✓ Chosen':'Choose this program'}</span></button>`;}
// Readiness: what helps IV IQ prepare the student better. Never gates saving.
function intakeReadiness(f){const d=f.details||{};const items=[['Program identity',!!(f.identity.programId&&f.identity.confirmed)||f.identity.provisionalConfirmed===true],['Interview date',!!f.schedule.date],['Start time',!!f.schedule.time],['Format',!!f.schedule.format&&f.schedule.format!=='unknown'],['Position type',f.positionType&&f.positionType!=='UNKNOWN'],['Invite received date',!!d.invitationReceivedDate],['Prior connection',!!d.relationshipState],['Signal / outreach',!!d.signalState||!!d.loiTemporal],['Itinerary status',!!d.itineraryState]];return {items,done:items.filter(x=>x[1]).length,total:items.length};}
function readinessMeter(f){const r=intakeReadiness(f),pct=Math.round(r.done/r.total*100);return `<div class="readiness" role="group" aria-label="Preparation readiness"><div class="readHead"><b>${r.done} of ${r.total} prep details</b><span>${pct>=78?'IV IQ can prepare you well':pct>=45?'A good start — add more when you know it':'Basics saved — the rest can wait'}</span></div><div class="readBar" role="progressbar" aria-valuemin="0" aria-valuemax="${r.total}" aria-valuenow="${r.done}"><i style="width:${pct}%"></i></div><ul class="readList">${r.items.map(([l,ok])=>`<li class="${ok?'ok':''}"><span aria-hidden="true">${ok?'✓':'○'}</span>${esc(l)}</li>`).join('')}</ul></div>`;}
const INTAKE_STEP_META=[['Program','Needed to save'],['Interview','Helps IV IQ prepare you'],['Events','Helps IV IQ prepare you'],['Connection','Helps IV IQ prepare you'],['Outreach','Helps IV IQ prepare you'],['Details','Helps IV IQ prepare you'],['Review','Save']];
function intakeSuccessActions(f,i){const resolved=!!i?.program,id=i?.id,go=(section,label,icon,kicker,enabled=true)=>enabled?`<button type="button" class="nextAction" data-act="intake-go" data-id="${esc(id||'')}" data-section="${section}"><span class="actionIcon" aria-hidden="true">${icon}</span><div><span class="actionLabel">${kicker}</span><br>${label}</div></button>`:`<button type="button" class="nextAction soon" data-act="coming-soon" data-label="${esc(label)} · BEING CONNECTED"><span class="actionIcon" aria-hidden="true">${icon}</span><div><span class="actionLabel">Coming soon</span><br>${label}</div></button>`;
 const research=deepResearch()&&resolved?go('brief','Deep research my program','🔬','Program intelligence'):resolved?go('brief','Deep research my program','🔬','Program intelligence',!coreOnly()):go('identify','Confirm my program for research','🔬','Needed first');
 const help=(capabilities.contributions===true)?`<button type="button" class="nextAction" data-act="intake-go" data-id="${esc(id||'')}" data-route="contribute"><span class="actionIcon" aria-hidden="true">🤝</span><div><span class="actionLabel">Crowdsourced</span><br>Help research this program</div></button>`:go('contribute','Help research this program','🤝','Crowdsourced',false);
 return `<div class="nextActions">${research}${help}${go('timeline','Build my timeline','📊','Timeline',false)}${go('why','Start my Why This Program','💬','Your words',resolved&&(!coreOnly()||threeboxEnabled()))}${go('rehearse','Prepare for my interview','🎯','Rehearse',!coreOnly())}<button type="button" class="nextAction quiet" data-act="intake-done"><span class="actionIcon" aria-hidden="true">👋</span><div><span class="actionLabel">Not now</span><br>Open my interview</div></button><button type="button" class="nextAction quiet" data-act="intake-new"><span class="actionIcon" aria-hidden="true">➕</span><div><span class="actionLabel">Keep going</span><br>Add another interview</div></button></div>`;}
function confettiHTML(){return `<div class="confetti" aria-hidden="true">${Array.from({length:28},(_,k)=>`<i style="--x:${(k*37)%100}%;--d:${(k%7)*.12}s;--h:${(k*47)%360}"></i>`).join('')}${Array.from({length:6},(_,k)=>`<b class="balloon" style="--x:${8+k*16}%;--d:${k*.25}s;--h:${(k*61)%360}"></b>`).join('')}</div>`;}
function renderIntakeWizard(){
 if(!(intakeEnabled()||(typeof studentPreview==='function'&&studentPreview()))||!intakeFlow)return '<p>Private interview intake is unavailable.</p>';const f=intakeFlow,s=f.step;let body='';
 if(s===8){const i=S.interviews.find(i=>i.id===f.saveResult?.id&&i.owner===actor.id);const name=i?.programName||f.program?.name||f.identity.invitationLabel;const when=i?.instant?esc(fmtInZone(i.instant,i.zone)):i?.date?esc(fmtDateOnly(i.date))+' · start time to be added':'Date to be added';return `<section class="intakeWizard intakeSuccess" data-celebrate="${f.saveResult?.edited?'edit':'new'}">${f.saveResult?.edited?'':confettiHTML()}<button type="button" class="btn ghost sm skipCelebrate" data-act="intake-done">Skip</button><div class="successIcon" aria-hidden="true">${f.saveResult?.edited?'✓':'🎉'}</div><p class="eyebrow">${f.saveResult?.edited?'DETAILS SAVED':'INTERVIEW ADDED'}</p><h2>${f.saveResult?.edited?'Your details are saved.':'<em>Congratulations!</em> You earned this interview.'}</h2>${heroMedia(i?.program||f.identity.programId,name)}<p class="successName">${esc(name)}</p><p class="successWhen">${when}${i?.related?.length?' · '+i.related.length+' related event'+(i.related.length===1?'':'s'):''}</p><p class="successVisible">${coreOnly()?'Saved privately to your MissionMed workspace.':'Your interview is now visible to Dr Brian and your authorized MissionMed team.'}</p>${readinessMeter(f)}<h3 class="nextTitle">What do you want to do next?</h3>${intakeSuccessActions(f,i)}</section>`;}
 if(s===1){const specFilter=f.specialtyFilter||'';const specialties=[...new Set(f.matches.map(p=>p.specialty).filter(Boolean))].sort();const filtered=specFilter?f.matches.filter(p=>p.specialty===specFilter):f.matches;const names=new Map();for(const p of f.matches)names.set(p.name,(names.get(p.name)||0)+1);body=`<h2>Which program <em>invited you?</em></h2><p class="lead">Search by program name, hospital or institution, or a canonical ID. Choose the exact program and track; a name alone never binds your invitation.</p><div class="finder"><label class="srOnly" for="in-searchText">Search programs</label><input id="in-searchText" type="text" value="${esc(f.searchText||'')}" data-intake-field="searchText" maxlength="256" placeholder="Program name, hospital or program ID" autocomplete="off" enterkeyhint="search">${btn('intake-search','Search RISE','','btn solid')}</div><p class="fieldHint">Supported IDs: native RISE ID or the 10-digit ACGME ID. Specialty, location and track filters appear with your results.</p>${f.searchTotal!==null?`<p class="finderStatus" role="status">${filtered.length}${specFilter?' filtered':''}${specFilter?' of '+f.matches.length:''} of ${f.searchTotal} matches shown. ${f.searchTotal>f.matches.length?'This is a bounded partial search — narrow it with a specialty or an ID.':''} Confirm a specific result or keep the invitation unresolved.</p>`:''}<div class="specFilters" role="group" aria-label="Filter by specialty">${specialties.length>1?`<span class="filterKicker">Specialty</span><button type="button" class="specChip${!specFilter?' active':''}" data-act="intake-spec-filter" data-spec="">All specialties</button>${specialties.map(sp=>`<button type="button" class="specChip${specFilter===sp?' active':''}" data-act="intake-spec-filter" data-spec="${esc(sp)}">${esc(sp)}</button>`).join('')}`:''}</div><div class="programCards">${filtered.map(p=>programCard(p,{selected:f.program?.id===p.id,ambiguous:(names.get(p.name)||0)>1})).join('')}</div>${f.program?`<div class="panel pad chosenProgram">${heroMedia(f.program.id,f.program.name,{compact:true})}<p class="eyebrow">Your choice</p><b class="chosenName">${esc(f.program.name)}</b><p>${esc(f.program.specialty||'Specialty not listed')} · ${esc(f.program.track||'Track not listed')}</p><p class="pcIds"><span><small>RISE ID</small>${esc(f.program.id)}</span>${f.program.acgmeId?`<span><small>ACGME ID</small>${esc(f.program.acgmeId)}</span>`:''}</p>${intakeCheck('identity.confirmed','Yes — this is the exact program and track that invited me.')}${btn('intake-unresolved','Not this one — keep unresolved','','btn ghost')}</div>`:intakeCheck('identity.provisionalConfirmed',"I can't find it yet. Keep this invitation as unresolved and I'll confirm the program later.")}${intakeInput('identity.invitationLabel','What name is on your invitation?','text',500,'Copy it as written. This is kept separately from the canonical program.')}`;}
 if(s===2)body=`<h2>When is the <em>big day?</em></h2><p class="lead">Save the offer even without a date. Anything you don’t know yet can stay blank; past dates never confirm an interview happened.</p>${intakeChoice('positionType','What kind of position is this?',[['CATEGORICAL','Categorical','🎓','Full residency'],['PRELIMINARY','Preliminary','1️⃣','PGY-1 only'],['TRANSITIONAL_YEAR','Transitional Year','🔁','PGY-1 only'],['ADVANCED','Advanced','⏭️','Starts PGY-2'],['RESERVED','Reserved (R)','🅁','Reserved track'],['OTHER','Other','✳️',''],['UNKNOWN',"I don't know yet",'🤷','']],{columns:4})}${intakeInput('track','Program-specific track, if your invitation names one (optional)','text',200)}${f.positionType==='ADVANCED'?`<div class="panel amber pad"><h3>Plan your qualifying PGY-1 year</h3><p>Review the Advanced program's PGY-1 requirements with your mentor; this is not confirmation that you have secured that year.</p>${intakeSelect('details.pgy1Applied','Have you applied to Preliminary or Transitional Year programs?',[['YES','Yes'],['NO','No'],['UNSURE','Not sure / review with mentor']])}${f.details.pgy1Applied==='YES'?`${intakeSelect('details.prelimTargetId','Associate an existing confirmed own PGY-1 letter target',intakePrelimTargets().map(t=>[t.targetId,t.program.name]))}${intakeCheck('details.advancedFactConfirmed','I confirm the actual Advanced interview fact for my own future letter review.')}<p>Only an existing own target with a confirmed Preliminary/TY application fact can be associated. No relationship is invented and no letter is sent.</p>${loiTargetsEnabled()?btn('intake-prelim-letter','BUILD A PRELIM/TY LETTER OF INTEREST','','btn ghost'):''}`:''}</div>`:''}${intakeSchedule('schedule',{dateLabel:'Which day is the interview?'})}${intakeDatePicker('deadline','Do you need to reply by a date?',{hint:'Scheduling deadline from the invitation (optional).',unknownLabel:'No deadline / not sure'})}`;
 if(s===3)body=`<h2>Anything happening <em>around it?</em></h2><p class="lead">Resident dinners, meet-and-greets, second looks. They stay separate from the interview itself and save with it.</p>${f.events.map((e,k)=>`<article class="panel pad eventCard"><h3>Event ${k+1}</h3>${intakeChoice(`events.${k}.kind`,'What is it?',[['MEET_GREET','Resident meet & greet','👋'],['DINNER','Pre-interview dinner','🍽️'],['SOCIAL','Social / happy hour','🥂'],['OVERVIEW','Program overview','🏛️'],['SECOND_LOOK','Second look','👀'],['OTHER','Other','✳️']],{columns:3})}${intakeSchedule(`events.${k}.schedule`,{dateLabel:'Which day?'})}${intakeChoice(`events.${k}.required`,'Do you have to be there?',[['REQUIRED','Required','✅'],['OPTIONAL','Optional','🙂'],['UNKNOWN','Not sure','🤷']],{columns:3})}${intakeInput(`events.${k}.location`,'Where (private, optional)','text',1000)}${intakeInput(`events.${k}.note`,'A note to yourself (private, optional)','text',2000)}${btn('intake-event-remove','Remove this event',`data-index="${k}"`,'btn ghost')}</article>`).join('')}${btn('intake-event-add','＋ Add a related event','','btn')}${intakeChoice('details.itineraryState','Has your itinerary arrived?',[['RECEIVED','Yes, I have it','📄'],['NOT_YET','Not yet','⏳'],['UNKNOWN','Not sure','🤷']],{columns:3})}${f.details.itineraryState==='RECEIVED'?(calendarV2()?'<p class="fieldHint">Save this interview first, then upload its private PDF, PNG or JPEG itinerary from the saved interview. No file is shared with the cohort.</p>':'<div class="panel pad"><b>Secure itinerary upload is pending.</b><p>You can record receipt now. No file is uploaded or shared in this stage.</p><button class="btn ghost" type="button" disabled>UPLOAD ITINERARY — pending integration</button></div>'):''}`;
 if(s===4)body=`<h2>Have you <em>been here before?</em></h2><p class="lead">Rotation, research, observership, work, volunteering or another experience with this program or institution. Only what you confirm is stored.</p>${intakeChoice('details.relationshipState','So — have you?',[['YES','Yes, I have','🏥'],['NO','No, first time','🆕'],['UNKNOWN','Not sure / skip','🤷']],{columns:3})}${f.experiences.map((e,k)=>`<article class="panel pad experienceCard"><h3>Experience ${k+1}</h3>${intakeChoice(`experiences.${k}.kind`,'What kind of experience?',[['CLERKSHIP','Clerkship','📚'],['SUB_INTERNSHIP','Sub-internship','🩺'],['ELECTIVE','Elective','📝'],['EXTERNSHIP','Externship','🧭'],['OBSERVERSHIP','Observership','👁️'],['RESEARCH','Research','🔬'],['EMPLOYMENT','Work','💼'],['VOLUNTEER','Volunteering','🤲'],['AWAY_ROTATION','Away rotation','✈️'],['OTHER','Other','✳️']],{columns:5})}${intakeInput(`experiences.${k}.department`,'Department or service (optional)','text',300)}<div class="intakeGrid">${intakeInput(`experiences.${k}.startDate`,'Roughly when did it start? (optional)','date')}${intakeInput(`experiences.${k}.endDate`,'And end? (optional)','date')}</div>${intakeInput(`experiences.${k}.description`,'In your own words, what did you do there?','text',2000)}${intakeInput(`experiences.${k}.contact`,'Someone there who knows you (optional)','text',500)}${intakeCheck(`experiences.${k}.confirmed`,'I confirm this is my actual experience.')}${btn('intake-experience-remove','Remove this experience',`data-index="${k}"`,'btn ghost')}</article>`).join('')}${f.details.relationshipState==='YES'||f.experiences.length?btn('intake-experience-add','＋ Add an experience','','btn'):''}`;
 if(s===5)body=`<p class="stepKicker">Outreach and signals</p><h2>Did you reach out <em>first?</em></h2><p class="lead">Your answers are private self-reports. They help IV IQ read your season; they never claim a letter or signal caused the interview.</p>${intakeInput('details.matchCycle','Which Match cycle is this? (year, optional)','number')}${intakeChoice('details.signalState','Did you signal this program?',[['YES','Yes','⭐'],['NO','No','—'],['NA','Signals didn’t apply','🚫'],['UNSURE','Not sure','🤷']],{columns:4})}<p class="fieldHint">Signal tiers are not shown without verified specialty and season authority.</p>${intakeChoice('details.loiTemporal','Did this interview arrive after a Letter of Interest?',[['AFTER_LOI','Yes — after my letter','✉️'],['NO','No','—'],['NOT_SENT','I didn’t send one','📭'],['UNSURE','Not sure','🤷']],{columns:4})}`;
 if(s===6)body=`<h2>A few details that help <em>IV IQ prepare you</em></h2><p class="lead">Everything here is optional and private.</p>${f.editId?intakeChoice('positionType','What kind of position is this?',[['CATEGORICAL','Categorical','🎓'],['PRELIMINARY','Preliminary','1️⃣'],['TRANSITIONAL_YEAR','Transitional Year','🔁'],['ADVANCED','Advanced','⏭️'],['RESERVED','Reserved (R)','🅁'],['OTHER','Other','✳️'],['UNKNOWN',"I don't know yet",'🤷']],{columns:4})+intakeInput('track','Program-specific track (optional)','text',200):''}${calendarV2()?intakeDatePicker('details.invitationReceivedDate','When did the invite hit your inbox?',{hint:'The day the invitation arrived (optional).',unknownLabel:"Don't remember"})+intakeChoice('details.statusDetail','Anything changed since?',[['WAITLISTED','I’m waitlisted','⏳'],['PROGRAM_CANCELLED','Program cancelled','🚫'],['STUDENT_CANCELLED','I cancelled','↩️'],['DECLINED','I declined','🙅']],{columns:4,allowUnknown:true}):''}${intakeChoice('details.invitationSource','Where did the invite come from?',(calendarV2()?[['ERAS','ERAS','📨'],['THALAMUS','Thalamus','🧠'],['INTERVIEW_BROKER','Interview Broker','🗂️'],['EMAIL','Email','✉️'],['PHONE','Phone','📞'],['OTHER','Other','✳️']]:[['ERAS','ERAS','📨'],['THALAMUS','Thalamus','🧠'],['INTERVIEW_BROKER','Interview Broker','🗂️'],['EMAIL','Email','✉️'],['OTHER','Other','✳️']]),{columns:3,allowUnknown:true})}${intakeChoice('details.platform','If virtual, which platform?',[['ZOOM','Zoom','🎥'],['WEBEX','Webex','🎥'],['TEAMS','Teams','🎥'],['THALAMUS','Thalamus','🧠'],['OTHER','Other','✳️']],{columns:5,allowUnknown:true})}${intakeChoice('details.structure','How is the day structured?',(calendarV2()?[['ONE_TO_ONE','One-to-one','🧑‍⚕️'],['PANEL','Panel','👥'],['GROUP','Group','🧑‍🤝‍🧑'],['MMI','MMI','🔄'],['OTHER','Other','✳️']]:[['ONE_TO_ONE','One-to-one','🧑‍⚕️'],['PANEL','Panel','👥'],['GROUP','Group','🧑‍🤝‍🧑'],['OTHER','Other','✳️']]),{columns:5,allowUnknown:true})}${intakeChoice('details.priority','How much do you want this one?',[['HIGH','Top choice','🔥'],['INTERESTED','Interested','👍'],['EXPLORING','Exploring','🧭'],['PREFER_NOT','Prefer not to say','🤐']],{columns:4})}<details class="moreDetails"><summary>Logistics, coordinator and notes</summary>${intakeInput('details.location','Private location / logistics','text',1000)}${intakeInput('details.coordinatorName','Coordinator name (optional)','text',200)}${intakeInput('details.coordinatorContact','Coordinator contact (private, optional)','text',500)}${intakeInput('details.interviewCount','Number of interviews, if known','number')}${intakeInput('details.structureNotes','Faculty / resident roles you know (optional)','text',2000)}${intakeInput('details.privateNotes','Private preparation note (optional)','text',2000)}</details>`;
 if(s===7){const d=f.details,label=f.program?.name||f.identity.invitationLabel;body=`<h2>Ready to <em>save?</em></h2><p class="lead">Here is what IV IQ will keep. You can edit optional details any time after saving.</p>${heroMedia(f.program?.id,label)}<div class="reviewCards"><article class="panel pad reviewCard"><p class="eyebrow">Program</p><b>${esc(label)}</b><p>${f.identity.programId?(f.identity.confirmed?'Canonical RISE program confirmed':'Canonical selection still needs your confirmation'):'Unresolved invitation retained — confirm later'}</p>${f.program?`<p class="fieldHint">${esc(f.program.specialty||'Specialty not listed')} · ${esc(f.program.track||'Track not listed')} · RISE ID ${esc(f.program.id)}</p>`:''}</article><article class="panel pad reviewCard"><p class="eyebrow">Interview</p><b>${f.schedule.date?esc(fmtDateOnly(f.schedule.date))+' '+esc(f.schedule.date.slice(0,4)):'Date to be added'}${f.schedule.time?' · '+esc(f.schedule.time):''}</b><p>${esc(f.positionType.replaceAll('_',' '))}${f.track?' · '+esc(f.track):''} · ${esc(f.schedule.format||'format unknown')} · ${esc(f.schedule.zone)}</p>${f.deadline?`<p class="fieldHint">Reply by ${esc(fmtDateOnly(f.deadline))}</p>`:''}</article><article class="panel pad reviewCard"><p class="eyebrow">Around it</p><b>${f.events.length} related event${f.events.length===1?'':'s'}</b><p>${f.experiences.length} experience${f.experiences.length===1?'':'s'} to confirm${d.itineraryState?' · itinerary: '+esc(d.itineraryState.replaceAll('_',' ').toLowerCase()):''}</p></article><article class="panel pad reviewCard"><p class="eyebrow">Your context</p><b>${d.relationshipState==='YES'?'You have been here before':d.relationshipState==='NO'?'First time here':'Connection not answered'}</b><p>${d.signalState?'Signal: '+esc(d.signalState.toLowerCase()):'Signal not answered'}${d.loiTemporal?' · LOI: '+esc(d.loiTemporal.replaceAll('_',' ').toLowerCase()):''}${d.invitationReceivedDate?' · invite received '+esc(fmtDateOnly(d.invitationReceivedDate)):''}</p></article></div>${readinessMeter(f)}<p class="fieldHint">${calendarV2()?'After saving, your private itinerary can be uploaded separately. Only typed, freshly admitted canonical events can appear in the deidentified cohort.':'Itinerary upload and shared cohort calendar are pending separate integration and policy.'} Joining details, experiences, signals and notes remain private. No research, AI generation, letter send or external Calendar publication is requested here.</p>`;}
 const [stageLabel,stageKind]=INTAKE_STEP_META[s-1]||['',''];
 const canQuickSave=!!(f.identity.invitationLabel||'').trim();
 return `<section class="intakeWizard">${typeof studentPreview==='function'&&studentPreview()?'<p class="panel amber pad" role="status">STUDENT PREVIEW · Explore the steps. Program lookup and saving are unavailable; no student data is loaded or changed.</p>':''}<header class="wizHead"><p class="eyebrow">${f.editId?'EDIT OPTIONAL INTAKE':'ADD INTERVIEW'} · STEP ${s} OF 7</p><span class="wizNeed ${s===1?'need':s===7?'save':'help'}">${s===1?'Needed to save':s===7?'Review and save':'Helps IV IQ prepare you better'}</span></header><ol class="intakeProgress" aria-label="Intake progress">${INTAKE_STEPS.map((label,k)=>`<li ${k+1<s?'class="done"':k+1>s?'class="upcoming"':''} ${k+1===s?'aria-current="step"':''}><span class="stepLabel">${esc(label)}</span><span class="srOnly">${k+1<s?'Completed':k+1===s?'Current step':'Upcoming'}</span></li>`).join('')}</ol><p class="wizStage"><b>Step ${s}</b> · ${esc(stageLabel)} <span>· ${esc(stageKind)}</span></p><fieldset ${f.busy?'disabled':''}>${body}</fieldset>${f.help?'<div class="panel pad helpPanel"><h3>Only the basics are required</h3><p>Save with just the invitation name now, or skip any optional step. Your draft stays in this tab while your own authorized session remains. Closing does not save; reopening Add Interview resumes the unsaved draft. Sign-out, account/role change or access loss clears private drafts.</p></div>':''}${f.error?`<p role="alert" class="wizError">${esc(f.error)}</p>`:''}<div class="mcv2-drawer-actions wizActions">${btn('intake-back','‹ Back',s<=(f.editId?4:1)||f.busy?'disabled':'','btn ghost')}${s<7?btn('intake-next',s===1?'Continue ›':'Continue ›',f.busy?'disabled':'','btn solid'):''}${s>1&&s<7?btn('intake-skip','Skip for now',f.busy?'disabled':'','btn ghost'):''}${btn('intake-save',f.editId?'Save optional details':s===7?'Save interview':'Quick save basics',f.busy||!canQuickSave&&!f.editId?'disabled':'',s===7&&!f.editId?'btn solid':'btn')}${btn('intake-help','Help',f.busy?'disabled':'','btn ghost')}${btn('drawer-close','Close',f.busy?'disabled':'','btn ghost')}</div>${f.busy?'<p role="status" class="wizBusy">Saving your interview and related events…</p>':''}</section>`;
}
function renderItinerary(id){let c;try{c=itineraryContext(id);}catch{return '<p>Private itinerary is unavailable.</p>';}const p=itineraryPage?.interviewId===id&&itineraryPage.targetRef===c.targetRef?itineraryPage:null;return `<h2>${c.targetRef?'Authorized administrator':'Private'} itinerary</h2><p>PDF, PNG or JPEG · maximum 5 MiB · 10 retained versions per interview. Files download only; this does not certify content safety. No file is shared with the cohort or a mentor.</p>${c.targetRef?`<p>Each file action requires fresh target admission and is audited under your actual administrator identity.</p>${btn('admin-calendar-back','Back to target logistics','','btn ghost')}`:''}<input id="calendar-itinerary-file" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"><div class="row">${btn('itinerary-upload','Upload private version',`data-id="${esc(id)}"`)}${btn('itinerary-open','Refresh saved files',`data-id="${esc(id)}"`,'btn ghost')}</div>${p?.files.map(f=>`<article class="panel pad"><h3>Version ${esc(f.version)} · ${esc(f.format)}</h3><p>${esc(f.byteSize)} bytes · ${f.withdrawn?'Withdrawn; retained for history':'Available'}</p>${!f.withdrawn?btn('itinerary-download','Download',`data-id="${esc(id)}" data-file="${esc(f.attachmentId)}"`,'btn ghost')+btn('itinerary-withdraw','Withdraw',`data-id="${esc(id)}" data-file="${esc(f.attachmentId)}"`,'btn ghost'):''}</article>`).join('')||'<p>No saved files loaded.</p>'}<p role="status">${esc(p?.error||'')}</p>${calendarMutationPending||itineraryPending?'<p role="status">An earlier save has an uncertain outcome. Retry the same action with the same values; no new request is created.</p>':''}`;}
function calendarAdminInput(id,label,value,type='text',max=500){return `<label class="f" for="${id}">${esc(label)}</label><input id="${id}" type="${type}" ${type==='text'?`maxlength="${max}"`:''} value="${esc(value??'')}">`;}
function calendarFoldInput(id,value){return `<label class="f" for="${id}">Repeated local time</label><select id="${id}">${[['','Unknown / not repeated'],['0','First occurrence'],['1','Second occurrence']].map(([v,label])=>`<option value="${v}" ${(value==null?'':String(value))===v?'selected':''}>${label}</option>`).join('')}</select>`;}
function calendarAdminEventForm(e=null){const id=e?.id||'new',p='calendar-event-'+id+'-';return `<article class="panel pad"><h3>${e?'Related event · '+esc(e.status):'Add related event to this admitted interview'}</h3>${calendarAdminInput(p+'kind','Event label',e?.title||e?.kind||'', 'text',80)}${calendarAdminInput(p+'date','Event date',e?.local_date,'date')}${calendarAdminInput(p+'time','Time (blank = date only)',e?.local_time?.slice(0,5),'time')}${calendarAdminInput(p+'zone','Timezone',e?.timezone||adminCalendarTarget?.interview.zone||'UTC')}${calendarFoldInput(p+'fold',e?.fold)}${calendarAdminInput(p+'duration','Duration in minutes (blank = unknown)',e?.duration_minutes,'number')}<label class="f" for="${p}note">Governed logistics note</label><textarea id="${p}note" maxlength="2000">${esc(e?.note||'')}</textarea><div class="row">${e?(e.status==='scheduled'?btn('admin-calendar-event-update','Save event',`data-event="${esc(id)}"`)+btn('admin-calendar-event-lifecycle','Cancel event',`data-event="${esc(id)}" data-action="cancel"`,'btn ghost'):btn('admin-calendar-event-lifecycle','Restore event',`data-event="${esc(id)}" data-action="restore"`,'btn ghost')):btn('admin-calendar-event-create','Add event')}</div></article>`;}
function renderAdminCalendar(){const t=adminCalendarTarget;if(!calendarV2()||actor.role!=='admin'||capabilities.adminLogistics!==true||!t)return '<p>Current administrator target unavailable.</p>';const i=t.interview;return `<h2>Administrator logistics</h2><p>${esc(i.programName)} · ${esc(i.status)}</p><p>These actions are audited under your administrator identity. Private preparation, letters and consent are unavailable. Governed event logistics notes are restricted to this admitted target.</p><p>New student identities cannot be created here. Creation requires an existing admitted Calendar target; this panel edits that interview and adds its related events.</p>${btn('admin-calendar-refresh','Reload current target','','btn ghost')}<h3>Program identity</h3><p>${i.program?'Retained canonical RISE ID: '+esc(i.program):'Unresolved invitation: no canonical identity is invented.'} Canonical metadata must be verified by the existing owner lookup; unavailable lookup refuses the save.</p>${calendarAdminInput('calendar-admin-name','Program display name',i.programName)}${calendarAdminInput('calendar-admin-track','Track',i.track,'text',200)}${btn('admin-calendar-identity','Save program identity')}<h3>Interview schedule</h3>${calendarAdminInput('calendar-admin-date','Interview date',i.date,'date')}${calendarAdminInput('calendar-admin-time','Time (blank = date only)',i.time?.slice(0,5),'time')}${calendarAdminInput('calendar-admin-zone','Timezone',i.zone||'UTC')}${calendarFoldInput('calendar-admin-fold',i.fold)}<div class="row">${btn('admin-calendar-schedule','Save logistics')}${btn('admin-calendar-lifecycle','Cancel interview','data-action="cancel"','btn ghost')}${btn('admin-calendar-lifecycle','Restore interview','data-action="restore"','btn ghost')}${btn('itinerary-open','Manage authorized files',`data-id="${esc(i.id)}"`,'btn ghost')}</div><h3>Related events</h3>${t.events.map(e=>calendarAdminEventForm(e)).join('')}${calendarAdminEventForm()}${calendarMutationPending?'<p role="status">An earlier action has an uncertain outcome. Retry the same action with unchanged fields; its request and original versions are retained.</p>':''}`;}

function renderThreebox(i){
  if(!threeboxEnabled()||!owns(i))return '<p>The private Three-Box builder is unavailable.</p>';
  const d=threeboxForm(i),saved=S.why[i.id],h=saved?.threebox?.current,e=threeboxEvidenceCache.get(i.id),research=e?.research,facts=research?.facts||[];
  const attrs=`data-id="${esc(i.id)}"`,field=(key,r)=>`data-tb-field="${key}" ${attrs}${r?` data-reason="${esc(r.id)}"`:''}`;
  const reason=r=>`<article class="tbReason panel pad"><header class="tbReasonHeader"><label><input type="checkbox" ${field('selected',r)} ${r.selected?'checked':''}> Use this reason</label><label>Order <input type="number" min="1" max="8" value="${r.rank}" ${field('rank',r)}></label>${btn('threebox-remove','Remove candidate',`${attrs} data-reason="${r.id}"`,'btn ghost sm')}</header><div class="tbBoxes"><section><h3>GENERAL</h3><p class="tiny">A broad category.</p><label class="f" for="tb-cat-${r.id}">Why are you interested?</label><select id="tb-cat-${r.id}" ${field('category',r)}>${THREEBOX_CATEGORIES.map(c=>`<option ${r.general.category===c?'selected':''}>${esc(c)}</option>`).join('')}</select></section><section class="tbDetails"><h3>DETAILS</h3><p class="tiny">Concrete proof is the largest part. Select one or more supported program Details.</p>${facts.map((f,k)=>{const picked=r.details.some(x=>x.field===f.field&&x.claimRef===f.claimRef);return `<label class="tbEvidence"><input type="checkbox" ${field('detail',r)} data-evidence="${k}" ${picked?'checked':''}><span><b>${esc(threeboxFieldLabel(f.field))}</b><br>${esc(threeboxDetailText(f.value))}<small>SUPPORTED · ${esc(f.asOf?.label||'Period not supplied')}</small></span></label>`;}).join('')||'<p class="tbNeeded">RESEARCH NEEDED — load governed evidence before assembling an answer.</p>'}${r.details.filter(x=>!facts.some(f=>f.field===x.field&&f.claimRef===x.claimRef)).map(x=>`<p class="tbNeeded">Saved selection: ${esc(threeboxFieldLabel(x.field))} · Needs Verification. Reload current evidence or replace this selection.</p>`).join('')}${r.details.length?btn('threebox-clear-details','Clear these selections',`${attrs} data-reason="${r.id}"`,'btn ghost sm'):''}<details><summary>Interview-Day Intel (private notes)</summary><p class="tiny">Capture what you heard. Student confirmation does not turn a program-feature assertion into RISE verified evidence.</p>${r.intel.map(x=>`<div class="tbIntel"><label>Speaker<input ${field('intelSpeaker',r)} data-intel="${x.id}" value="${esc(x.speaker)}"></label><label>Role<input ${field('intelRole',r)} data-intel="${x.id}" value="${esc(x.role)}"></label><label>Exact observation<textarea ${field('intelText',r)} data-intel="${x.id}">${esc(x.text)}</textarea></label><label><input type="checkbox" ${field('intelConfirmed',r)} data-intel="${x.id}" ${x.confirmed?'checked':''}> I confirm this is my account of what I heard.</label></div>`).join('')}${btn('threebox-intel','Add an observation',`${attrs} data-reason="${r.id}"`,'btn ghost sm')}<p class="tiny">For a stronger governed Detail, select it above, then explicitly replace the weaker selection.</p>${btn('threebox-replace','Replace with checked current Details',`${attrs} data-reason="${r.id}"`,'btn ghost sm')}</details></section><section><h3>PERSONAL <small>optional</small></h3><label><input type="checkbox" ${field('personalEnabled',r)} ${r.personal.enabled?'checked':''}> Add why this matters to me</label><label class="f" for="tb-personal-${r.id}">Your genuine meaning</label><textarea id="tb-personal-${r.id}" ${field('personalText',r)} maxlength="2000">${esc(r.personal.text)}</textarea><label><input type="checkbox" ${field('personalConfirmed',r)} ${r.personal.confirmed?'checked':''}> I confirm these are my own interests, goals, experiences or ties.</label><p class="tiny">A connection is optional. We never infer it from your CV or prior notes.</p></section></div><label class="f" for="tb-defense-${r.id}">Can you defend this reason? Which detail, investigator or experience would you explain?</label><textarea id="tb-defense-${r.id}" ${field('followUpDefense',r)} maxlength="2000">${esc(r.followUpDefense)}</textarea></article>`;
  return `<section class="tbBuilder"><h2>Build my Three Boxes</h2><p class="lead">Show the effort you put into learning this program, then explain why its specific features matter to you.</p><div class="tbTeaching panel pad"><b>GENERAL → DETAILS → PERSONAL</b><p>Start broad, prove it with concrete Details, then add Personal meaning where it fits. Overbuild about five candidates and choose about three strong reasons. Facts and structure help you speak naturally; avoid word-for-word memorization.</p><p>Passion opening → your best reasons → memorable close. Location usually belongs in the middle. Ask: <b>Could this answer work unchanged at another program?</b> If yes, return to the boxes.</p></div>${!i.program?'<p role="alert">Confirm the canonical program in Program details first. You may save an unfinished private worksheet.</p>':''}${saved?.threebox?.manualEdit?'<p role="status">Your wording changed outside the builder. It is preserved; review the boxes before assembling a new version.</p>':''}${saved?.threebox?.bindingValid===false&&h?'<p role="alert">This saved answer belongs to a prior program identity. Review it; no old evidence is treated as current.</p>':''}<div class="row">${btn('threebox-evidence','Load current RISE evidence',attrs,'btn solid')}${btn('threebox-add','Add a candidate reason',attrs,'btn ghost')}${btn('threebox-read','Reload saved worksheet',attrs,'btn ghost')}</div><p class="tiny">RISE supplies evidence. You supply personal meaning. Unsupported or stale facts cannot enter assembled prose.</p>${research?`<details class="panel pad"><summary>Evidence and source drawer · ${facts.length} supported fields</summary><p>Canonical program: ${esc(e.program.name)} · ${esc(e.program.track)}. Observed ${esc(research.coverage.observedAt)}.</p>${research.coverage.fields.filter(x=>x.state!=='SUPPORTED').map(x=>`<p>${esc(threeboxFieldLabel(x.field))} — ${esc(x.state)} · RESEARCH NEEDED</p>`).join('')}${facts.map(f=>`<article><h4>${esc(threeboxFieldLabel(f.field))}</h4><p>${esc(threeboxDetailText(f.value))}</p><p class="tiny">${esc(f.claimRef)} · retrieved ${esc(f.retrievedAt)} · ${esc(f.asOf?.label||'Period not supplied')}</p>${f.sources.map(s=>`<p class="tiny">${s.urls.map(u=>esc(u)).join('<br>')}<br>Retrieved ${esc(s.retrievedAt)}${s.reviewedAt?' · reviewed '+esc(s.reviewedAt):''}</p>`).join('')}</article>`).join('')}<p class="tiny">Titles, publication dates and confidence are shown only when the owner provides them; none are invented.</p></details>`:''}${d.reasons.map(reason).join('')||'<p class="panel pad">Add your first candidate. Choose a General, select concrete Details, and add Personal meaning if useful.</p>'}<label class="f" for="tb-delivery-${i.id}">Adapt selection, depth and delivery without changing facts</label><select id="tb-delivery-${i.id}" ${field('delivery')}>${[['STANDARD','Standard'],['CONCISE','Concise interviewer'],['DETAIL_ORIENTED','Detail oriented interviewer'],['RELATIONSHIP','Relationship oriented interviewer'],['RESEARCH','Research oriented interviewer']].map(([v,l])=>`<option value="${v}" ${d.delivery===v?'selected':''}>${l}</option>`).join('')}</select><div class="tbReview"><label><input type="checkbox" ${field('factualConfirmed')} ${d.factualConfirmed?'checked':''}> I reviewed every selected source and confirm factual accuracy.</label><label><input type="checkbox" ${field('specificityConfirmed')} ${d.specificityConfirmed?'checked':''}> This answer would change for another program; it is specific and defensible.</label><label><input type="checkbox" ${field('locationException')} ${d.locationException?'checked':''}> If Location is first or last, my connection is unusually strong.</label></div><div class="row">${btn('threebox-save','Save private worksheet',attrs,'btn solid')}${btn('threebox-assemble','Assemble from reviewed boxes',attrs,'btn')}</div><p role="status">${esc(d.status||'')}${h?' · saved version '+esc(h.answerVersion)+' ('+esc(h.state)+')':''}</p>${h?.checks?`<ul class="tbChecks">${[...h.checks.errors,...h.checks.warnings].map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}<label class="f" for="tb-answer-${i.id}">Your answer — edit in your own voice</label><textarea id="tb-answer-${i.id}" ${field('editedAnswer')} maxlength="20000" rows="7">${esc(d.editedAnswer)}</textarea><p class="tiny">Edits save as private draft wording. Assembly explicitly replaces it with evidence-bound forms; it never runs automatically. Your current saved wording hydrates existing private preparation readers.</p>${h?.answers?.standard?`<details class="panel pad" open><summary>Practice facts and structure</summary><h3>30–45 second concise form</h3><p class="tbAnswer">${esc(h.answers.concise)}</p><h3>60–90 second standard form</h3><p class="tbAnswer">${esc(h.answers.standard)}</p><h3>Bullet memory version</h3><p class="tbAnswer">${esc(h.answers.bullets)}</p><p class="tiny">Delivery targets, not measured speech times. Say it aloud, then prepare follow-up answers. These forms are retained from assembled version ${esc(h.answersVersion||h.answerVersion)}. ${h.state!=='assembled'?'Your current worksheet or wording is a draft; review it before assembling new forms.':''}</p></details>`:''}<details class="panel pad"><summary>Saved version history</summary>${(saved?.threebox?.history||[]).map(x=>x.unavailable?'<p>A newer schema version is retained but unavailable.</p>':`<article><h4>Version ${esc(x.answerVersion)} · ${esc(x.state)}</h4><p class="tiny">${esc(x.createdAt)} · ${esc(x.program.name)}</p><p class="tbAnswer">${esc(x.text||x.answers?.standard||'Worksheet draft')}</p>${x.legacyText?`<details><summary>Preserved original wording</summary><p>${esc(x.legacyText)}</p></details>`:''}</article>`).join('')||'<p>No Three-Box versions saved yet. Existing private wording remains available above.</p>'}</details></section>`;
}


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
  if(r==='admin'&&calendarV2()&&capabilities.adminLogistics===true)items.splice(1,0,['calendar','Student Calendar','Calendar']);
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
  const mentor=['mentor','admin'].includes(roleName());
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
    const list=calendarScope(); const by=itemsByDay(list); const ev=by[d.day]||[];if(calendarV2()&&S.ui.calendarScope==='all'&&cohortPage)for(const e of cohortPage.events.filter(e=>e.local_date===d.day))ev.push({id:'peer-'+e.event_ref,kind:'related',title:e.program_name,time:e.local_time||'Time unknown',sub:e.event_type+' · '+e.lifecycle}); const mentor=['mentor','admin'].includes(roleName());
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
      const it2=i.intake,pos=it2?.positionType&&it2.positionType!=='UNKNOWN'?it2.positionType.replaceAll('_',' '):'',spec=prog?.specialty||it2?.specialty||'',invDate=it2?.details?.invitationReceivedDate?String(it2.details.invitationReceivedDate).slice(0,10):'';
      inner=`${own&&i.program&&programHero(i.program)?heroMedia(i.program,title(i),{compact:true}):''}<h2>${esc(it.kind==='related'?rel.kind:it.kind==='deadline'?'Scheduling deadline':title(i))}${it.kind!=='interview'&&it.kind!=='cancelled'?` <em>· ${esc(title(i))}</em>`:''}</h2>
        <div class="ivChips">${spec?chip(esc(spec),'spec'):''}${pos?chip(esc(pos),'pos'):''}${i.format&&i.format!=='unknown'?chip(esc(i.format),'fmt'):''}</div>
        <dl class="calFacts">
          ${(mentor||roleName()==='admin')&&!own?`<dt>Student</dt><dd>${esc(i.owner)}<br><span class="tiny">Assigned student · identity shown as authorized by the current assignment.</span></dd>`:''}
          <dt>Program</dt><dd>${prog? esc(prog.name.replace('Fictional ',''))+' · '+esc(prog.specialty)+' · '+esc(prog.track)+(i.program?'<br><span class="tiny">Canonical RISE ID '+esc(i.program)+'</span>':'') : esc(i.programName||i.unresolved_input||'Program name not supplied')+(i.track?' · '+esc(i.track):'')+' · supplied by you; registry unresolved'}</dd>
          ${pos||i.track?`<dt>Position / track</dt><dd>${esc([pos,i.track].filter(Boolean).join(' · '))}</dd>`:''}
          ${own&&invDate?`<dt>Invite received</dt><dd>${esc(fmtDateOnly(invDate))} ${esc(invDate.slice(0,4))}</dd>`:''}
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
  w.innerHTML=`<div class="scrim" data-act="drawer-close"></div><aside class="mcv2-drawer ${d.kind==='myeras'?'myerasModal':d.kind==='intake'?'intakeModal':''}" role="dialog" aria-modal="true" aria-label="${d.kind==='myeras'?'Import MyERAS programs':d.kind==='intake'?'Add interview':'Calendar detail'}" aria-describedby="drawer-desc"><button class="close" type="button" data-act="drawer-close" aria-label="Close">×</button><div id="drawer-desc">${inner}</div></aside>`;
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
/* V2 research CTAs: state-aware, never start a paid run from the card. research-refresh maps to research.check (saved request only). */
function researchCta(i,cls='rowBtn'){
  if(!owns(i))return '';
  if(!i.program)return `<button class="${cls} ctaResearch" type="button" data-act="open-section" data-id="${i.id}" data-section="identify"><span aria-hidden="true">🔬</span> Confirm program for research</button>`;
  if(coreOnly())return `<button class="${cls} ctaResearch" type="button" data-act="coming-soon" data-label="Deep Research · BEING CONNECTED"><span aria-hidden="true">🔬</span> Deep research this program${comingSoonBadge()}</button>`;
  if(deepResearch()){const d=S.demands[i.id],st=d?.status;
    if(!d?.requestId)return `<button class="${cls} ctaResearch pri" type="button" data-act="open-section" data-id="${i.id}" data-section="brief"><span aria-hidden="true">🔬</span> Deep research this program</button>`;
    if(['queued','researching'].includes(st))return `<button class="${cls} ctaResearch busy" type="button" data-act="open-section" data-id="${i.id}" data-section="brief"><span aria-hidden="true">⏳</span> Researching your program…</button>`;
    if(st==='available')return `<button class="${cls} ctaResearch ready" type="button" data-act="open-section" data-id="${i.id}" data-section="brief"><span aria-hidden="true">✨</span> Program intelligence ready</button>`;
    return `<button class="${cls} ctaResearch" type="button" data-act="research-refresh" data-id="${i.id}"><span aria-hidden="true">🔄</span> Refresh research</button>`;}
  const rs=researchState(i);
  if(rs.state==='available')return `<button class="${cls} ctaResearch ready" type="button" data-act="open-section" data-id="${i.id}" data-section="brief"><span aria-hidden="true">✨</span> Program intelligence ready</button>`;
  if(['partial','failed','provider outage'].includes(rs.state))return `<button class="${cls} ctaResearch" type="button" data-act="research-refresh" data-id="${i.id}"><span aria-hidden="true">🔄</span> Refresh research</button>`;
  return `<button class="${cls} ctaResearch pri" type="button" data-act="open-section" data-id="${i.id}" data-section="brief"><span aria-hidden="true">🔬</span> Deep research this program</button>`;
}
function helpResearchCta(i,cls='rowBtn'){
  if(!owns(i)||roleName()!=='student')return '';
  if(capabilities.contributions===true)return `<button class="${cls} ctaHelp" type="button" data-act="nav" data-to="contribute"><span aria-hidden="true">🤝</span> Help research this program</button>`;
  return `<button class="${cls} ctaHelp" type="button" data-act="coming-soon" data-label="Crowdsourced research · BEING CONNECTED"><span aria-hidden="true">🤝</span> Help research this program${comingSoonBadge()}</button>`;
}
function ivChips(i){
  const it=i.intake,prog=i.program?P(i.program):null,spec=prog?.specialty||it?.specialty||'',pos=it?.positionType&&it.positionType!=='UNKNOWN'?it.positionType.replaceAll('_',' '):'',fmt=i.format&&i.format!=='unknown'?i.format:'';
  return [spec?chip(esc(spec),'spec'):'',pos?chip(esc(pos),'pos'):'',i.track?chip(esc(i.track)):'',fmt?chip(esc(fmt),'fmt'):''].filter(Boolean).join('');
}
function inviteReceived(i){const v=i.intake?.details?.invitationReceivedDate;if(!v)return '';const d=String(v).slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(d)?`<span class="ivInvite"><span aria-hidden="true">📬</span> Invite received ${esc(fmtDateOnly(d))}</span>`:'';}
function interviewRow(i){return interviewCard(i);}
/* V2 interview card: hero (only approved canonical media), program, specialty, date/time, invite received, format, position/track, readiness and next action. */
function interviewCard(i){
  const nm=nextMove(i),hero=i.program?programHero(i.program):null;
  return `<article class="sRow ivCard${hero?' hasHero':''}" id="row-${i.id}">${hero?`<div class="ivHero"><img src="${esc(hero.url)}" alt="${esc(hero.alt||'')}" loading="lazy" decoding="async" width="480" height="206"></div>`:''}<div class="ivMain">${dateBlock(i)}<div class="ivBody"><div class="nm">${esc(title(i))}</div><div class="ivChips">${ivChips(i)}</div><div class="mt">${metaLine(i)}${inviteReceived(i)}</div><div class="nx"><b>${esc(nm.label)}</b> · ${esc(nm.why)}</div>${pulseSVG(i)}</div><div class="rMeta">${stateChip(i)}<div class="ivActions">${researchCta(i)}<button class="rowBtn pri" type="button" data-act="open-section" data-id="${i.id}" data-section="${nm.section}">Go</button><button class="rowBtn" type="button" data-act="open-interview" data-id="${i.id}">Open</button></div></div></div></article>`;
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
/* V2 journey navigation: grouped stage cards with completion state; keeps the tablist contract. */
const JOURNEY_GROUPS=[['Know the program',['identify','brief','why']],['Get ready',['rehearse','day']],['Afterwards',['debrief','learned']],['Logistics & outreach',['schedule','loi']]];
const STAGE_ICON={identify:'🏥',brief:'🔬',why:'💬',rehearse:'🎯',day:'📋',debrief:'📝',learned:'🌱',schedule:'📅',loi:'✉️'};
function stageDone(i,k){
  if(k==='identify')return !!i.program;
  if(k==='brief'){if(coreOnly())return false;if(deepResearch())return S.demands[i.id]?.status==='available';return researchState(i).state==='available';}
  if(k==='why')return threeboxEnabled()?S.why[i.id]?.threebox?.ready===true:!!(S.why[i.id]?.text||'').trim();
  if(k==='rehearse')return (S.practice?.[i.id]||[]).some(a=>a.feedback);
  if(k==='day')return !!(i.instant&&i.instant<=now());
  if(k==='debrief')return !!S.debriefs[i.id]?.saved;
  if(k==='learned')return !!S.learning[i.owner];
  if(k==='schedule')return !!(i.instant||i.date);
  if(k==='loi')return !!loiState(i).current;
  return false;
}
function journeyNav(i,secs,sec){
  const secIdx=secs.findIndex(s=>s[0]===sec);
  const card=([k,l])=>{const idx=secs.findIndex(s=>s[0]===k),done=stageDone(i,k),soon=coreOnly()&&!coreSection(k),state=sec===k?'current':done?'done':'upcoming';return `<button role="tab" type="button" data-act="section" data-id="${i.id}" data-section="${k}" aria-selected="${sec===k}" class="stage ${state}${idx<secIdx?' visited':''}"><span class="stageIcon" aria-hidden="true">${STAGE_ICON[k]||'•'}</span><span class="stageText"><b>${l}${soon?comingSoonBadge():''}${k==='why'&&whyMatches(i,S.why[i.id]?.text||'').length?'<span class="dot" aria-label="has an unresolved claim"></span>':''}</b><small>${sec===k?'You are here':done?'Done':soon?'Coming soon':'Open'}</small></span></button>`;};
  const groups=JOURNEY_GROUPS.map(([g,keys])=>{const items=keys.map(k=>secs.find(s=>s[0]===k)).filter(Boolean);return items.length?`<div class="journeyGroup"><span class="journeyLabel">${g}</span>${items.map(card).join('')}</div>`:'';}).join('');
  return `<div class="sections journey" role="tablist" aria-label="Sections of this interview">${groups}</div>`;
}
/* Permanent next actions: always reachable from the workspace, not only from the post-save screen. */
function roomQuickActions(i,secs){
  const has=k=>secs.some(s=>s[0]===k),own=owns(i);
  const q=(label,icon,attrs,cls='')=>`<button class="quick ${cls}" type="button" ${attrs}><span class="quickIcon" aria-hidden="true">${icon}</span><span>${label}</span></button>`;
  const soon=(label,icon)=>q(label+comingSoonBadge(),icon,`data-act="coming-soon" data-label="${esc(label)} · BEING CONNECTED"`,'soon');
  const section=(k,label,icon,fallback)=>has(k)&&!(coreOnly()&&!coreSection(k))?q(label,icon,`data-act="open-section" data-id="${i.id}" data-section="${k}"`):fallback||soon(label,icon);
  return `<div class="roomQuick" aria-label="Next actions"><span class="quickKicker">Next actions</span>${researchCta(i,'quick')}${helpResearchCta(i,'quick')}${section('loi','Letter of Interest','✉️')}${section('why','Why This Program','💬',!i.program?q('Why This Program','💬',`data-act="open-section" data-id="${i.id}" data-section="identify"`):null)}${soon('Timeline','📊')}${section('rehearse','Preparation','🎯',section('brief','Preparation','🎯'))}${calendarV2()&&own?q('Itinerary','📄',`data-act="itinerary-open" data-id="${i.id}"`):soon('Itinerary','📄')}${has('debrief')?section('debrief','Debrief','📝'):q('Debrief','📝','disabled title="Available after the interview"','later')}</div>`;
}
function renderRoom(i){
  const nm=nextMove(i); const secs=sectionsFor(i);
  if(!S.ui.section || !secs.find(s=>s[0]===S.ui.section)) S.ui.section=nm.section && secs.find(s=>s[0]===nm.section)? nm.section : secs[0][0];
  const sec=S.ui.section;
  const body=coreOnly()&&!coreSection(sec)?comingSoonPanel(secs.find(x=>x[0]===sec)?.[1]||sec):{loi:renderLoi, identify:renderIdentify, brief:renderBrief, why:renderWhy, rehearse:renderRehearse, day:renderDay, debrief:renderDebrief, learned:renderLearned, schedule:renderSchedule}[sec](i);
  const hero=i.program?programHero(i.program):null;
  return `<section data-view="interview" class="live">
    <div class="roomHead${hero?' hasHero':''}">${hero?`<div class="roomHero"><img src="${esc(hero.url)}" alt="${esc(hero.alt||'')}" loading="lazy" decoding="async" width="1200" height="400"><span class="roomHeroCap">${esc(hero.caption||'')}${hero.publisher?' · '+esc(hero.publisher):''}</span></div>`:''}<div class="roomNav"><button class="back" type="button" data-act="close-interview"><span class="backIcon" aria-hidden="true">‹</span> Interviews</button><span class="breadSep" aria-hidden="true">/</span><span class="breadCurrent">${esc(title(i))}</span></div><div class="roomMeta"><div class="h1">${esc(title(i))}</div><div class="ivChips">${ivChips(i)}</div><div class="roomDetails"><span class="tiny">${metaLine(i)}${inviteReceived(i)}</span><span class="tiny roomId">${esc(i.id)}</span></div>${pulseSVG(i)}</div><div class="roomActions">${stateChip(i)}<button class="rowBtn" type="button" data-act="cal-item" data-item="iv-${i.id}">Calendar</button></div></div>
    <div class="nextMove"><div class="nextMoveIcon" aria-hidden="true">→</div><div class="nextMoveBody"><span class="lbl">Next move</span><b>${esc(nm.label)}</b><p>${esc(nm.why)}</p></div><button class="rowBtn pri" type="button" data-act="${nm.act}" data-id="${i.id}" data-section="${nm.section}">Go</button></div>
    ${roomQuickActions(i,secs)}
    ${journeyNav(i,secs,sec)}
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
  else if(role==='admin'){ html = r==='calendar'&&calendarV2()&&capabilities.adminLogistics===true? renderCalendar() : r==='review'? renderReviewPage() : r==='policy'? renderPolicyPage() : r==='settings'? renderSettings() : renderHome(); }
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
function renderProgramMyLetters(){const groups=loiProgramGroups(),saved=currentSavedPage();return `<div class="panel pad"><h2>Your programs and letters</h2>${myerasEnabled()?btn('myeras-open','IMPORT MY PROGRAMS','','btn ghost'):''}<p class="tiny">Your own RISE Saved Programs and private program targets appear alongside retained interview letters. Matching canonical IDs are grouped here; every letter and original source remains separate. Evidence readiness is UNKNOWN until current evidence is read. ${myerasEnabled()?'Import your applied programs without sharing credentials.':loiCompositionEnabled()?'Writing approaches and standard drafting are available. MyERAS import is not active.':'Standard drafting is available; AI and MyERAS import are not active.'}</p>${S.loiTargets?.savedStatus!=='available'&&!saved?'<p role="status">Saved Programs is temporarily unavailable. Your private targets and existing interview letters remain available.</p>':''}${saved?`<p role="status">RISE Saved Programs · page ${esc(saved.page)} · ${esc(saved.records.length)} shown of ${esc(saved.total)}. ${saved.truncated?'This read is bounded to the first 2000 records; the remaining total is retained.':''}</p><div class="row">${btn('loitarget-page','Previous',`data-page="${saved.page-1}" ${saved.page<=1?'disabled':''}`,'btn ghost')}${btn('loitarget-page','Next',`data-page="${saved.page+1}" ${!saved.hasMore?'disabled':''}`,'btn ghost')}</div>`:''}${groups.length?groups.map(g=>`<div class="panel pad" style="margin-top:12px"><h3>${esc(g.label)}</h3>${g.saved.map(s=>`<p class="tiny">RISE Saved · ${esc(s.state)} · priority ${esc(s.priority??'not set')} · updated ${esc(s.updatedAt)} · ${esc(s.identityState)} · evidence UNKNOWN.</p>${loiTargetChoices(g.targets.find(t=>t.program?.id===s.program?.id||!t.program&&t.sources?.some(x=>x.source==='RISE_SAVED'&&x.programRef===s.programRef)),s.programRef)}`).join('')}${g.targets.map(t=>{const i=loiTargetSubject(t.targetId);return `<p>Private target · ${esc(loiLetterStatus(i))} · ${esc(t.choice.replaceAll('_',' '))} · ${esc(t.resolutionState)}</p><p class="tiny">Sources: ${esc((t.sources||[]).map(s=>s.source).join(', '))}. ${esc(i.track||'Track not specified')} · registry ${esc(i.registryReleaseId||'unresolved')}.</p>${btn('loitarget-open','OPEN PROGRAM LETTER',`data-id="${esc(t.targetId)}"`,'btn ghost')}${g.saved.length?'':loiTargetChoices(t)}`;}).join('')}${g.interviews.map(i=>`<p>Interview letter · ${esc(i.programName||title(i))} · ${esc(loiLetterStatus(i))} · interview ${esc(i.state)}${i.date?' · '+esc(i.date):''}.</p>${btn('open-section',loiState(i).current?'CONTINUE INTERVIEW LETTER':'CREATE INTERVIEW LETTER',`data-id="${esc(i.id)}" data-section="loi"`,'btn ghost')}`).join('')}</div>`).join(''):'<div class="storyEmpty">No saved programs, private targets or interview letters are loaded.</div>'}${renderLoiManualAdd()}</div>`;}

function loiStyleEntry(){return loiCompositionEnabled()?`<div class="loiComposition row" style="margin-bottom:16px">${btn('loi-style-open','MY LOI STYLE','','btn ghost')}<span class="tiny">Default for new letters: ${esc(compositionLabel(S.loiPreferences?.defaultApproach||'DIRECT_CONCISE'))}. Existing letters remain unchanged.</span></div>`:'';}
function renderLoiStyle(){if(!loiCompositionEnabled())return '<p>Writing approaches are unavailable for this workspace.</p>';const prefs=S.loiPreferences||{defaultApproach:'DIRECT_CONCISE',version:0};return `<section class="loiComposition"><h2>My <em>LOI Style</em></h2><p>Your default shapes new letters only. Changing it does not generate, rewrite, approve or send any letter.</p><div class="drawerChoice">${LOI_APPROACHES.map(a=>`<label class="panel pad" style="display:block"><input type="radio" name="loi-composition-default" id="loi-composition-default-${a[0]}" value="${a[0]}" ${a[0]===(S.ui.loiStyleChoice||prefs.defaultApproach)?'checked':''}> <b>${esc(a[1])}</b><small style="display:block">${esc(a[2])}</small></label>`).join('')}</div><p class="tiny">Post-Interview Reflective and Update-Led require you to confirm the actual context for each composition request. Every approach uses the same confirmed factual truth.</p><div class="row">${btn('loi-style-save','Save my default')}${btn('loi-style-read','Read saved default','','btn ghost')}</div></section>`;}


'use strict';
function renderMe(){
  const p=me(),st=p.approved_story,lg=S.learning[actor.id];
  const rows=[
    ['Your offers, dates, zones, joining details','You','Your currently assigned mentor (logistics only)','Saved with interview history'],
    ['Approved experience '+(st?.id||''),'You','Preparation, only while consent is on',st?(storyFor(actor.id)?'Available for preparation':'Not in use'):'None'],
    ['Private note','You','Nobody','Printed only if you choose it'],
    ['Raw speech and edited account','You','Nobody else','Private capture; only your selected excerpt can enter review'],
    ['Practice goal','You',lg?.mentorVisible?'Your assigned mentor (confirmed gap only)':'Nobody',lg?.status||'None'],
    ['Selected shared excerpt','You, then review','Entitled students after approval, de-identified and labeled as a report',S.reviewQueue.filter(r=>r.from===actor.id).map(r=>r.status).join(', ')||'Nothing shared'],
    ['Program research','RISE','Everyone entitled to that program','No private preparation in shared research']
  ];
  return `<table class="ledger"><thead><tr><th>What</th><th>Owner</th><th>Who else can see it</th><th>State</th></tr></thead><tbody>${rows.map(r=>`<tr>${r.map((c,k)=>`<td data-l="${['What','Owner','Who else can see it','State'][k]}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
  <div class="grid2" style="margin-top:1.25rem"><div class="panel pad"><h3>Your experience in preparation</h3>${st?`<p>“${esc(st.text)}”</p><p class="tiny">Owned by StoryForge; only this approved version is available.</p><div class="row">${btn('consent',storyFor(actor.id)?'Withdraw from preparation':'Allow for preparation',`data-story="${esc(st.id)}" data-v="${storyFor(actor.id)?0:1}"`,'btn ghost')}${chip(storyFor(actor.id)?'in use':'not in use',storyFor(actor.id)?'ok':'bad')}</div>`:'<p class="tiny">No approved experience is available from StoryForge.</p>'}</div><div class="panel moss pad"><h3>Your practice goal</h3>${renderLearningControls(actor.id,null)}</div></div>
  <div class="grid2" style="margin-top:1rem"><div class="panel pad"><h3>Your saved work</h3><p class="tiny">${S.storageOk?'Connected to your saved workspace.':'A save could not be confirmed. Your typed draft remains in this tab.'} ${btn('export','Export my own season (JSON)','','btn ghost sm')}</p></div><div class="panel pad"><h3>Experiments</h3><p class="tiny">Actual-interview listening, camera and microphone analytics, a phone companion and answer help remain separately gated.</p></div></div>`;
}
function renderContribute(){
  const sid=actor.id,m=S.contrib.missions[sid],subs=S.contrib.submissions.filter(s=>s.student===sid),policy=F.contributionPolicy;
  const head=pageIntro({eyebrow:'Research access',title:'Research access, <em>earned by research</em>.',value:esc(actor.tier||'Current account')+'. Each contribution is reviewed before credit or publication.'});
  const policyBox=`<div class="panel amber pad">${policy?esc(policy.description||policy.label):'Your current contribution policy and eligibility are checked by the service. A submitted package never grants itself credit.'}</div>`;
  const mission=m?`<div class="panel pad" style="margin-top:1rem"><h3>Your mission · ${esc(m.id)}</h3><dl class="kv"><dt>Program</dt><dd>${esc(P(m.program).name)}</dd><dt>Policy</dt><dd>${esc(m.policy)}</dd><dt>Questions</dt><dd>${(m.payload?.questions||m.questions||[]).map(esc).join('<br>')}</dd><dt>Execution requirement</dt><dd>${esc(m.payload?.execution_requirement||'A trusted execution receipt is required for verified-execution credit. Quality can still be reviewed.')}</dd></dl><details><summary>Mission text (copyable, inert)</summary><pre class="src" style="white-space:pre-wrap">${esc(JSON.stringify(m.payload,null,2))}</pre></details></div>`:`<div class="panel pad" style="margin-top:1rem"><h3>Generate one mission</h3><p>Choose the program whose evidence gaps you want to research.</p><label class="f" for="mission-program">Program</label><select id="mission-program"><option value="">Choose a program</option>${F.programs.map(p=>`<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.track)}</option>`).join('')}</select><div class="row" style="margin-top:.5rem">${btn('mission-generate','Generate the mission')}</div></div>`;
  const upload=m?`<div class="panel pad" style="margin-top:1rem"><h3>Submit a result</h3><p class="tiny">Paste the complete research package. It is parsed as inert data; the original is preserved for review.</p><label class="f" for="pkg">Package text</label><textarea id="pkg" placeholder="Paste your research package here"></textarea><div class="row" style="margin-top:.4rem">${btn('upload','Submit package','','btn sm')}</div></div>`:'';
  const list=subs.map(s=>`<div class="panel pad" style="margin-top:.5rem"><b>${esc(s.id)}</b> v${esc(s.version)} ${chip(esc(s.status),s.status==='accepted'?'ok':'warn')}<p class="tiny">${(s.reasons||[]).map(esc).join(' · ')}</p><div class="four">${['execution','quality','publication','credit'].map(k=>`<div class="d"><b>${k}</b>${esc(s.decisions?.[k]||'pending')}</div>`).join('')}</div>${['rejected','quarantined'].includes(s.status)||['rejected','repair_requested'].includes(s.decisions?.quality)?`<label class="f" for="repair-${esc(s.id)}">Repaired package (new version)</label><textarea id="repair-${esc(s.id)}"></textarea>${btn('repair','Submit linked repair',`data-sub="${esc(s.id)}"`,'btn sm')}`:''}<details><summary>Original text (immutable)</summary><pre class="src" style="white-space:pre-wrap">${esc(s.original)}</pre></details></div>`).join('');
  const grants=[S.contrib.grants[sid]].flat().filter(Boolean);
  return head+policyBox+mission+upload+(list?'<h3 style="margin-top:1.25rem">Your submissions</h3>'+list:'')+`<div class="panel pad" style="margin-top:1.25rem"><h3>Credit ledger</h3><ul class="hist">${S.contrib.ledger.filter(l=>l.student===sid).map(l=>`<li><time>${fmtStamp(l.at)}</time>${esc(l.text)}</li>`).join('')||'<li>No credit yet. Repairs and retries remain one logical mission.</li>'}</ul>${grants.map(grant=>`<p>Grant: ${esc(grant.program)} until ${fmtStamp(grant.expires)} ${chip(grant.revoked?'revoked':grant.expires<=now()?'expired':grant.suspended?'suspended pending review':'active',grant.revoked||grant.suspended||grant.expires<=now()?'bad':'ok')}</p>`).join('')}</div>`;
}
function submissionDecisionControls(s,key){
  const d=s.decisions||{}, review=S.reviewQueue.find(r=>r.id===s.reviewId);
  if(s.status!=='review'||!s.reviewId||['rejected','retracted','withdrawn'].includes(review?.status))return '';
  const options=[];
  if(key==='execution'&&d.execution!=='verified')options.push(['verify','Verify receipt']);
  if(key==='execution'&&d.execution!=='rejected')options.push(['reject','Reject execution']);
  if(key==='quality'&&d.quality!=='approved')options.push(['accepted','Accept quality']);
  if(key==='quality'&&d.quality!=='rejected')options.push(['rejected','Reject quality']);
  if(key==='quality'&&d.quality!=='repair_requested')options.push(['repair_requested','Request repair']);
  if(key==='publication'&&d.publication==='published')options.push(['retract','Retract publication']);
  if(key==='publication'&&d.publication!=='published'&&d.quality==='approved')options.push(['publish','Publish corroboration']);
  if(key==='credit'&&['granted','suspended'].includes(d.credit))options.push(['revoke','Revoke credit']);
  if(key==='credit'&&['none','suspended'].includes(d.credit)&&d.execution==='verified'&&d.quality==='approved')options.push(['grant',d.credit==='suspended'?'Restore existing credit/access':'Grant credit']);
  return options.length?'<br>'+options.map(([value,label])=>btn('decide',label,`data-sub="${esc(s.id)}" data-k="${key}" data-value="${value}"`,'btn ghost sm')).join(' '):'';
}
function renderAdminReview(){
  const researchReviews=new Set(S.contrib.submissions.map(s=>s.reviewId).filter(Boolean));
  const experienceReviews=S.reviewQueue.filter(r=>r.sourceKind!=='research'&&!researchReviews.has(r.id));
  return `<div class="adminCols"><div class="panel pad"><h3>Shared-intelligence review</h3>${experienceReviews.map(r=>`<div class="src ${r.status==='approved'?'ok':''}"><b>${esc(P(r.program).name)} · review ${esc(r.id)}</b>“${esc(r.excerpt)}”<br><code>permitted use: ${r.permitted?'confirmed':'NOT confirmed'} · de-identification review: ${r.deid?'confirmed':'pending'} · ${esc(r.status)} · v${esc(r.version)}</code><div class="row" style="margin-top:.4rem">${r.status==='pending'?btn('review-approve','Approve experience report',`data-r="${esc(r.id)}"`,'btn sm')+btn('review-reject','Reject',`data-r="${esc(r.id)}"`,'btn ghost sm'):r.status==='approved'?btn('review-retract','Retract publication',`data-r="${esc(r.id)}"`,'btn ghost sm'):''}</div></div>`).join('')||'<p class="tiny">Nothing awaiting review. Private material never enters this queue by itself.</p>'}</div>
  <div class="panel pad" style="margin-top:1rem"><h3>Contribution submissions</h3>${S.contrib.submissions.map(s=>`<div class="src"><b>${esc(s.id)} v${esc(s.version)} · ${chip(esc(s.status))}</b><p class="tiny">${(s.reasons||[]).map(esc).join(' · ')}</p><div class="four">${['execution','quality','publication','credit'].map(k=>`<div class="d"><b>${k}</b>${esc(s.decisions?.[k]||'pending')}${submissionDecisionControls(s,k)}</div>`).join('')}</div><p class="tiny">Execution receipt: ${esc(s.preflight?.status||'unverified')}${s.preflight?.receipt?.receiptId?' · '+esc(s.preflight.receipt.receiptId):''}</p><label class="f" for="decision-reason-${esc(s.id)}">Decision reason</label><input id="decision-reason-${esc(s.id)}"><details><summary>Original package</summary><pre>${esc(s.original)}</pre></details></div>`).join('')||'<p class="tiny">No submissions.</p>'}<p class="tiny">Publication needs accepted quality. Credit needs verified execution and accepted quality. Repairs and retries share one logical credit. Restoring a suspended grant keeps its original expiry and credit; current review eligibility is checked again.</p></div></div>`;
}
function renderAdminPolicy(){
  const rows=F.entitlementRows||[];
  return `<div class="adminCols"><div><div class="panel moss pad"><h3>Access policy</h3><table class="ledger"><thead><tr><th>Account</th><th>Tier</th><th>Floor</th><th>Research access</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.displayName||r.id)}</td><td>${esc(r.tier)}</td><td>${r.protectedFloor?'Protected':'Current policy'}</td><td>${esc(r.reason||r.status)}</td></tr>`).join('')||'<tr><td colspan="4">No account audit rows returned.</td></tr>'}</tbody></table><label class="f" for="policy-reason">Reason for policy change</label><input id="policy-reason"><div class="row" style="margin-top:.6rem">${btn('policy','Contribution path: '+(S.policy.contributions?'on':'off'),'data-k="contributions"','btn ghost sm')}</div><p class="tiny">Policy changes cannot remove the protected enrollment floor. Billing remains with the enrollment authority.</p>${Object.entries(S.contrib.grants).flatMap(([id,items])=>[items].flat().map(g=>[id,g])).map(([id,g])=>`<div class="row"><span>${esc(id)} · ${esc(g.program)} · expires ${fmtStamp(g.expires)} · ${g.revoked?'revoked':g.expires<=now()?'expired':g.suspended?'suspended pending review':'active'}</span>${g.expires<=now()?'':btn(g.revoked||g.suspended?'grant-reinstate':'grant-revoke',g.suspended?'Restore existing grant':g.revoked?'Reinstate grant':'Revoke grant',`data-student="${esc(id)}" data-grant="${esc(g.id||'')}"`,'btn ghost sm')}</div>`).join('')}</div><details style="margin-top:1rem"><summary>Audit log (${S.policy.audit.length})</summary><ul class="hist">${S.policy.audit.map(a=>`<li><time>${fmtStamp(a.at)}</time>${esc(a.by||a.actor)}: ${esc(a.text||a.action)}</li>`).join('')||'<li class="tiny">Empty.</li>'}</ul></details></div></div>`;
}
function renderMentor(){
  const students=S.mentorAssigned.map(sid=>{const list=S.interviews.filter(i=>i.owner===sid&&i.saved).sort((a,b)=>(a.instant||'9999').localeCompare(b.instant||'9999')),lg=S.learning[sid];return `<div class="student"><h2>${esc(persona(sid).displayName||sid)}</h2><p class="tiny">${list.length} interviews · logistics and the student-approved preparation gap only</p>${list.map(i=>`<div class="sRow" style="margin:.6rem 0">${dateBlock(i)}<div><div class="nm">${esc(title(i))}</div><div class="mt">${metaLine(i)}${i.format?' · '+esc(i.format):''}</div><div class="nx">${chip(esc(stateLabel(i)))}${i.preparationStatus?chip((i.preparationStatus.practice_count||0)+' rehearsals')+chip(i.preparationStatus.preparation_saved?'preparation saved':'preparation not saved'):chip('preparation status unavailable','warn')}${i.instant&&i.instant>now()?chip(i.joinVerified?'joining checked':'joining not checked',i.joinVerified?'ok':'warn'):''}</div></div></div>`).join('')}<div class="panel sky pad" style="margin-top:.6rem"><h4>Mentor priority</h4><p class="tiny">One line the student sees as a mentor note about logistics or the approved gap.</p><label class="f" for="mprio-${esc(sid)}">Priority</label><input id="mprio-${esc(sid)}" value="${esc(S.mentorPriority?.[sid]?.text||'')}"><div class="row" style="margin-top:.4rem">${btn('mentor-priority','Set priority',`data-student="${esc(sid)}"`,'btn sm')}</div></div><div class="panel moss pad" style="margin-top:.6rem"><h4>Approved preparation gap</h4>${lg?.mentorVisible&&lg.status==='confirmed'?`<p>“${esc(lg.goal)}”</p><label class="f" for="nudge-${esc(sid)}">Your in-app nudge</label><textarea id="nudge-${esc(sid)}"></textarea><div class="row" style="margin-top:.4rem">${btn('nudge','Save nudge for student',`data-student="${esc(sid)}"`,'btn sm')}</div>`:'<p class="tiny">No gap shared. Private speech, notes, stories, drafts and preparation progress are excluded.</p>'}</div></div>`;}).join('');
  return pageIntro({eyebrow:'Mentor Command',title:'Your students, <em>within scope</em>.',value:'Interview logistics and student-approved preparation gaps. Private speech, stories, notes and drafts are excluded.'})+`<div class="mentor">${students||'<div class="empty">No assigned students. A role alone grants no student view.</div>'}</div>`;
}
function renderBoundaries(){
  const rd=[['IIQ-035','Live presence coach','Actual-interview use needs separate approval.'],['IIQ-036','Real-time camera analytics','Voluntary practice research only; no personality, emotion or match inference from faces.'],['IIQ-037','Microphone / delivery analytics','Pace and pause cues require measured accuracy and accent/noise handling.'],['IIQ-038','Mobile live companion','Paired devices and microphone contention require separate validation.'],['IIQ-039','Substantive answer help during real interviews','Disabled pending program, participant, integrity, privacy and legal review. Student consent alone is insufficient.']];
  return `<div class="h2" style="margin-bottom:6px">Experiments and <em>boundaries</em></div><p class="lead">Five separately gated R&D capabilities. Mock practice does not depend on them.</p><div class="rd">${rd.map(([id,n,t])=>`<div class="item"><div><b>${id} · ${n}</b><small>${t}</small></div><button class="btn ghost sm" disabled aria-disabled="true">Disabled for real interviews</button></div>`).join('')}</div><div class="grid2" style="margin-top:1.25rem"><div class="panel pad"><h3>Incubators</h3><p class="tiny"><b>IIQ-040</b> Invitation-assisted ingestion remains a separate addition; manual entry works now.<br><b>IIQ-041</b> Contribution incentives reward validated work, never fabricated novelty or volume.</p></div><div class="panel pad"><h3>Ownership</h3><p class="tiny">InterviewIQ owns interview logistics and preparation. RISE owns program identity and research; the enrollment authority owns access; IV Prep On-Call owns recorded practice; StoryForge owns stories; Matrix owns its calendar; RankList IQ owns ranking. Each connection requires an available authorized integration.</p></div></div>`;
}


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
  'add-interview'(el){if(intakeVisible())return openIntake(el);if(!studentPreview())requireStudent();openDrawer({kind:'add',day:el.dataset.day||null,form:{},returnTo:el.dataset.day?'[data-cal-day="'+el.dataset.day+'"]':null});},
  'new-offer'(el){return A['add-interview'](el);},
  async 'add-interview-save'(el){
    requireStudent();const d=S.ui.drawer;if(d?.kind!=='add')return;
    const form=el.dataset.fold!=null?d.form:{unresolved_input:val('ad-name').trim(),program:val('ad-program')||null,...(coreOnly()||!F.programs.length?{programName:val('ad-name').trim(),track:val('ad-track').trim()}:{}),deadline:val('ad-deadline')||null,schedule:scheduleInput('ad-')};
    if(!form.unresolved_input&&!form.program)throw Error('Write the program name as it appears on the invitation. A date is not needed.');
    if(!form.unresolved_input){
      const selected=F.programs.find(p=>p.id===form.program),name=typeof selected?.name==='string'?selected.name.trim():'';
      if(!name||name.length>500||name.includes('\u0000'))throw Error('The selected program name is unavailable. Select the registry program again or enter the name from your invitation.');
      form.unresolved_input=name;form.programName=name;
    }
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
  if(studentPreview()&&!INTAKE_PREVIEW_ACTIONS.has(button.dataset.act)&&!new Set(['switch-view','nav','matrix','cal-nav','cal-today','cal-view','cal-day','drawer-close','add-interview','new-offer','close-interview','close-card']).has(button.dataset.act)){notice(previewError().message);return;}
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
  const t=ev.target;if(!S||t.dataset?.tbField||!t.id||!('value'in t)||['password','file'].includes(t.type))return;draftValues.set(draftKey(t.id),t.type==='checkbox'?t.checked:t.multiple?[...t.selectedOptions].map(x=>x.value):t.value);
  if(t.id.startsWith('loi-')&&!t.id.startsWith('loi-composition-')&&!t.id.startsWith('loi-sentConfirmed-')&&!t.id.startsWith('loi-copyText-')){loiHandoffs.delete(S.ui.loiTargetOpen?'program:'+S.ui.loiTargetOpen:S.ui.open);const prepared=document.querySelector('[data-act="loi-gmail"]')?.closest('.panel');if(prepared)prepared.remove();}
  if(t.name==='loi-composition-default'&&loiCompositionEnabled())S.ui.loiStyleChoice=t.value;
  if(t.id==='loi-target-name'){delete S.ui.loiTargetManualProgram;loiTargetSearch=[];searchSequence++;document.getElementById('loi-target-selected')?.remove();const results=document.getElementById('loi-target-search-results');if(results)results.innerHTML='';const add=document.querySelector('[data-act="loitarget-add"]');if(add)add.textContent='Save name unresolved';}
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
function scheduleProgramSearch(q,id){clearTimeout(searchTimer);const seq=++searchSequence,identity=actor?.id,open=S?.ui.open;if(!programSearchAllowed()||q.trim().length<2)return;searchTimer=setTimeout(async()=>{try{const r=await apiFetch('/programs?q='+encodeURIComponent(q.trim()));if(seq!==searchSequence||actor?.id!==identity||!programSearchAllowed()||id==='program-search'&&S?.ui.open!==open)return;for(const p of r.programs||[]){const ix=F.programs.findIndex(x=>x.id===p.id);if(ix<0)F.programs.push(p);else F.programs[ix]={...F.programs[ix],...p,fact_ids:F.programs[ix].fact_ids||p.fact_ids||[]};}const select=document.getElementById('ad-program');if(select){const current=select.value;select.innerHTML='<option value="">I will confirm later</option>'+(r.programs||[]).map(p=>`<option value="${esc(p.id)}">${esc(programLabel(p))}</option>`).join('');select.value=current;}if(id==='program-search'){const box=document.getElementById('program-search-results');if(box)box.innerHTML=(r.programs||[]).map(p=>`<button class="choice" data-act="resolve" data-id="${esc(S.ui.open)}" data-program="${esc(p.id)}"><b>${esc(p.name)}</b><small>${esc(programContext(p))}</small></button>`).join('')||'<p>No registry matches. Keep the offer unresolved.</p>';}}catch(error){notice(error.message);}},300);}
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

function ownLoi(el){const i=loiSubject(el);if(!ownsLoiSubject(i))throw Error('This letter belongs to another workspace.');if(!loiEnabled()||i.targetKind==='program'&&i.choice!=='CREATE_LETTER')throw Error('Letter of Interest is unavailable for this workspace.');return i;}
function currentLoiApproval(i){const h=loiState(i).current;if(!h||h.state!=='approved'||!loiState(i).currentBindingValid||loiState(i).currentConsentValid===false||loiEdited(i))throw Error('Save and approve this exact letter before preparing or recording outreach.');return{...loiHeadData(i),contentHash:h.contentHash};}
function currentLoiHandoff(i){currentLoiApproval(i);const h=loiHandoffs.get(loiMemoryKey(i));if(!h||h.binding!==loiHandoffBinding(i)||h.recipient!==val('loi-recipient-'+i.id)||h.subject!==val('loi-subject-'+i.id)||!loiConfirmed('loi-recipientConfirmed-'+i.id)){loiHandoffs.delete(loiMemoryKey(i));throw Error('Prepare and review this approved letter and destination first.');}return h;}
Object.assign(A,{
 async 'loi-evidence'(el){const i=ownLoi(el),identity=actor.id,epoch=loiAuthorityEpoch;try{const r=await loiSubjectCommand(i,'loi.evidence',{}, {render:false});if(actor?.id!==identity||epoch!==loiAuthorityEpoch||!ownsLoiSubject(i)||!loiEnabled())throw Error('Your account changed.');loiEvidence.set(loiMemoryKey(i),i.targetKind==='program'?{...r,subjectBinding:loiSubjectBinding(i)}:r);}catch(e){if(actor?.id===identity&&epoch===loiAuthorityEpoch&&ownsLoiSubject(i)&&loiEnabled())loiEvidence.set(loiMemoryKey(i),{error:e.message,...(i.targetKind==='program'?{subjectBinding:loiSubjectBinding(i)}:{})});throw e;}finally{if(actor?.id===identity)render();}},
 'loi-build'(el){const i=ownLoi(el),d=loiDraftData(i);if(!d.studentFactualConfirmation)throw Error('Confirm your actual facts and statuses before building.');const evidence=loiEvidence.get(loiMemoryKey(i))?.research?.facts||[],selected=evidence.filter(f=>f.state==='SUPPORTED'&&d.selectedEvidence.some(x=>x.field===f.field&&x.claimRef===f.claimRef));if(!selected.length)throw Error('RESEARCH NEEDED: '+(loiResearchNeeded(i)||'Select at least one current supported canonical program detail before building.'));const text=[loiEvidence.get(loiMemoryKey(i))?.program?.name||'',d.context.whyNow,...d.motivations.filter(x=>x.confirmed).map(x=>x.text),...d.facts.filter(x=>x.confirmed).map(x=>x.text),...selected.map(f=>typeof f.value==='string'?f.value:JSON.stringify(f.value))].filter(Boolean).join('\n\n');if(!text)throw Error('Enter your confirmed words first.');draftValues.set(draftKey('loi-text-'+i.id),text);loiHandoffs.delete(loiMemoryKey(i));render();notice('Draft assembled from your confirmed words and selected evidence. Edit and review it before approval.');},
 async 'loi-save'(el){const i=ownLoi(el);loiHandoffs.delete(loiMemoryKey(i));const data=loiDraftData(i);if(loiCompositionEnabled()){data.compositionApproach=compositionApproach(i);if(data.compositionApproach==='POST_INTERVIEW'||data.compositionApproach==='UPDATE_LED'){if(data.compositionApproach==='POST_INTERVIEW'&&!loiConfirmed('loi-composition-post-'+i.id)||data.compositionApproach==='UPDATE_LED'&&(!loiConfirmed('loi-composition-update-'+i.id)||!data.facts.length))throw Error('Confirm the actual interview or current update before saving this approach.');data.compositionContextConfirmation={postInterviewOccurred:loiConfirmed('loi-composition-post-'+i.id),updateConfirmed:loiConfirmed('loi-composition-update-'+i.id)};}}return loiSubjectCommand(i,'loi.save',data);},
 'loi-approve'(el){const i=ownLoi(el),h=loiState(i).current;if(!h||loiState(i).currentConsentValid===false||loiEdited(i))throw Error('Save your latest edits before approval.');if(!loiConfirmed('loi-factual-'+i.id)||!loiConfirmed('loi-specific-'+i.id))throw Error('Review factual accuracy and program specificity before approval.');return loiSubjectCommand(i,'loi.approve',{...loiHeadData(i),contentHash:h.contentHash,studentFactualConfirmation:true,studentSpecificityConfirmation:true});},
 async 'loi-handoff'(el){const i=ownLoi(el),identity=actor.id,epoch=loiAuthorityEpoch,data=currentLoiApproval(i),binding=loiHandoffBinding(i);if(!loiConfirmed('loi-recipientConfirmed-'+i.id))throw Error('Review the exact recipient and subject first.');const recipient=val('loi-recipient-'+i.id),subject=val('loi-subject-'+i.id),text=loiState(i).current.text;const r=await loiSubjectCommand(i,'loi.handoff',{...data,recipient,subject,channel:'gmail',recipientConfirmed:true},{render:false});if(actor?.id!==identity||epoch!==loiAuthorityEpoch||!loiEnabled()||!r.handoff){if(actor?.id===identity)render();throw Error('The reviewed handoff is unavailable.');}currentLoiApproval(i);if(binding!==loiHandoffBinding(i)||val('loi-recipient-'+i.id)!==recipient||val('loi-subject-'+i.id)!==subject||!loiConfirmed('loi-recipientConfirmed-'+i.id))throw Error('The reviewed letter or destination changed. Prepare it again.');if(r.handoff.recipient!==recipient||r.handoff.subject!==subject||r.handoff.text!==text)throw Error('The reviewed letter or destination changed. Prepare it again.');if(r.handoff.gmailUrl)loiExternalURL(r.handoff.gmailUrl,'gmail',r.handoff);if(r.handoff.mailtoUrl)loiExternalURL(r.handoff.mailtoUrl,'mailto',r.handoff);loiHandoffs.set(loiMemoryKey(i),{...r.handoff,binding});render();},
 'loi-gmail'(el){const i=ownLoi(el),h=currentLoiHandoff(i);const opened=window.open(loiExternalURL(h.gmailUrl,'gmail',h),'_blank','noopener,noreferrer');if(opened)opened.opener=null;notice('Review the draft in Gmail and press Send yourself. If no tab opens, use the copy fallback.');},
 'loi-mailto'(el){const i=ownLoi(el),h=currentLoiHandoff(i);const opened=window.open(loiExternalURL(h.mailtoUrl,'mailto',h),'_blank','noopener,noreferrer');if(opened)opened.opener=null;},
 async 'loi-copy'(el){const i=ownLoi(el),h=currentLoiHandoff(i);try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(h.text);notice('Approved letter copied. Review it in your email app.');}catch{const field=document.getElementById('loi-copyText-'+i.id);field?.focus();field?.select();notice('Clipboard unavailable. Select and copy the complete letter shown here.');}},
 'loi-mark-sent'(el){const i=ownLoi(el),h=currentLoiHandoff(i);if(!loiConfirmed('loi-sentConfirmed-'+i.id))throw Error('Confirm that you pressed Send in your email app.');return loiSubjectCommand(i,'loi.mark_sent',{...currentLoiApproval(i),handoffId:h.handoffId,confirmed:true});},
 async 'loi-export'(el){const i=ownLoi(el),identity=actor.id,epoch=loiAuthorityEpoch,binding=loiHandoffBinding(i),r=await loiSubjectCommand(i,'loi.export',{}, {render:false});if(actor?.id!==identity||epoch!==loiAuthorityEpoch||!loiEnabled()||!ownsLoiSubject(i)||binding!==loiHandoffBinding(i))throw Error('Letter access changed. Private history is unavailable.');if(!r.export)throw Error('Private history is unavailable.');const blob=new Blob([JSON.stringify(r.export,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='InterviewIQ-my-letter-history.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
});

Object.assign(A,{
 'loitarget-open'(el){if(!loiTargetsEnabled()||!loiTargetRow(el.dataset.id))throw Error('This program target is unavailable.');stopSpeech();S.ui.route='letters';S.ui.open=null;S.ui.loiTargetOpen=el.dataset.id;loiTargetSearch=[];delete S.ui.loiTargetManualProgram;render();},
 'loitarget-close'(){if(!loiTargetsEnabled())throw Error('Program letters are unavailable.');delete S.ui.loiTargetOpen;delete S.ui.loiTargetManualProgram;loiTargetSearch=[];render();},
 async 'loitarget-choice'(el){if(!loiTargetsEnabled())throw Error('Program letters are unavailable.');const choice=el.dataset.choice;let r;if(el.dataset.id){const t=loiTargetRow(el.dataset.id);if(!t)throw Error('This program target is unavailable.');r=await loiTargetCommand('loitarget.update',t.targetId,{expectedTargetVersion:t.version,choice});}else{const s=currentSavedPage()?.records.find(x=>x.programRef===el.dataset.programRef);if(!s)throw Error('Choose an own program from the current saved page.');r=await loiTargetCommand('loitarget.create',null,{program:s.programRef,choice,source:{kind:'RISE_SAVED'}});}if(choice==='CREATE_LETTER'&&r.targetId)A['loitarget-open']({dataset:{id:r.targetId}});else notice('Your letter choice is saved. Original sources and letter history are retained.');},
 async 'loitarget-page'(el){if(!loiTargetsEnabled())throw Error('Program letters are unavailable.');const identity=actor.id,epoch=loiAuthorityEpoch,page=Number(el.dataset.page);if(!Number.isSafeInteger(page)||page<1||page>20)throw Error('Choose a page within the first 2000 saved programs.');const r=await loiTargetCommand('loitarget.saved',null,{page,pageSize:100},{render:false});if(actor?.id!==identity||epoch!==loiAuthorityEpoch||!loiTargetsEnabled())throw Error('Saved Program access changed.');if(!r.savedPrograms||r.savedPrograms.page!==page||r.savedPrograms.pageSize!==100)throw Error('The saved page is unavailable.');loiSavedPage={actorId:identity,epoch,response:r.savedPrograms};render();},
 async 'loitarget-search'(){if(!loiTargetsEnabled()||!programSearchAllowed())throw Error('Verified registry search is unavailable. Retain the name unresolved.');const q=val('loi-target-name').trim();if(q.length<2||q.length>256)throw Error('Enter between 2 and 256 search characters.');const identity=actor.id,epoch=loiAuthorityEpoch,open=S.ui.loiTargetOpen||null,seq=++searchSequence;loiTargetSearch=[];delete S.ui.loiTargetManualProgram;const r=await apiFetch('/programs?q='+encodeURIComponent(q));if(actor?.id!==identity||epoch!==loiAuthorityEpoch||!loiTargetsEnabled()||!programSearchAllowed()||seq!==searchSequence||(S.ui.loiTargetOpen||null)!==open||val('loi-target-name').trim()!==q)throw Error('Program search context changed. Search again in the intended workspace.');loiTargetSearch=r.programs||[];render();},
 async 'loitarget-select'(el){if(!loiTargetsEnabled())throw Error('Program letters are unavailable.');const p=loiTargetSearch.find(x=>x.id===el.dataset.program);if(!p)throw Error('Select an exact current registry search match.');if(S.ui.loiTargetOpen){const t=loiTargetRow(S.ui.loiTargetOpen);if(!t)throw Error('This target is unavailable.');await loiTargetCommand('loitarget.update',t.targetId,{expectedTargetVersion:t.version,program:p.id});loiTargetSearch=[];render();}else{S.ui.loiTargetManualProgram=p;render();}},
 async 'loitarget-add'(){if(!loiTargetsEnabled())throw Error('Program letters are unavailable.');const name=val('loi-target-name').trim(),choice=val('loi-target-choice');if(!name)throw Error('Enter the original program name.');const selected=S.ui.loiTargetManualProgram;if(selected&&!loiTargetSearch.some(p=>p.id===selected.id))throw Error('Select a current verified registry match again.');const r=await loiTargetCommand('loitarget.create',null,{...(selected?{program:selected.id}:{}),programName:name,choice,source:{kind:'MANUAL',original:name}});forgetDrafts(['loi-target-name','loi-target-choice']);loiTargetSearch=[];delete S.ui.loiTargetManualProgram;if(choice==='CREATE_LETTER'&&r.targetId)A['loitarget-open']({dataset:{id:r.targetId}});else render();}
});

function requireCompositionAccess(){if(!loiCompositionEnabled())throw Error('Writing approaches are unavailable for this workspace.');}
async function composeLetter(el,count){const i=ownComposition(ownLoi(el));syncLoiCompositionView();const key=loiMemoryKey(i);if(loiCompositionBusy.has(key))throw Error('A composition request is already in progress.');if(loiCompositionUncertain.has(key)||['RESERVED','OUTCOME_UNKNOWN'].includes(compositionProposal(i)?.generation?.status))throw Error('The earlier outcome is uncertain. Load saved proposals; do not retry generation.');const data=compositionRequestData(i,count),authority=compositionAuthority(i);loiCompositionBusy.add(key);render();try{const r=await loiSubjectCommand(i,'loi.generate',data,{render:false});if(!compositionStillCurrent(authority,i))throw Error('The letter or composition access changed while the request was in flight.');const generation=readCompositionGeneration(i,r.generation);if(!generation)throw Error('The composition response contained no proposal.');loiProposals.set(key,{subjectBinding:loiSubjectBinding(i),generation});if(['RESERVED','OUTCOME_UNKNOWN'].includes(generation.status))loiCompositionUncertain.add(key);notice(generation.status==='STANDARD_FALLBACK'?'Standard-format proposals are ready for your review.':generation.status==='PROPOSED'?'Proposals are ready. Review and select one as a new draft.':'The request outcome is unresolved. No automatic retry will run.');return r;}catch(error){if(compositionStillCurrent(authority,i)&&(!Number.isInteger(error.status)||error.status>=500))loiCompositionUncertain.add(key);throw error;}finally{if(compositionStillCurrent(authority,i)){loiCompositionBusy.delete(key);render();}}}
Object.assign(A,{
 'loi-style-open'(){requireCompositionAccess();delete S.ui.loiStyleChoice;openDrawer({kind:'loi-style'});},
 async 'loi-style-read'(){requireCompositionAccess();const identity=actor.id,epoch=loiCompositionEpoch,r=await command('loi.preference_read',null,{}, {render:false});if(actor?.id!==identity||epoch!==loiCompositionEpoch||!loiCompositionEnabled())throw Error('Writing approach access changed.');const p=r.preferences;if(!p||!LOI_APPROACHES.some(a=>a[0]===p.defaultApproach)||!Number.isSafeInteger(p.version)||p.version<0)throw Error('The saved writing preference is unavailable.');S.loiPreferences=p;delete S.ui.loiStyleChoice;render();return r;},
 async 'loi-style-save'(){requireCompositionAccess();const approach=document.querySelector('input[name="loi-composition-default"]:checked')?.value,preference=S.loiPreferences||{version:0};if(!LOI_APPROACHES.some(a=>a[0]===approach))throw Error('Choose one of the six writing approaches.');const identity=actor.id,epoch=loiCompositionEpoch,r=await command('loi.preference_save',null,{approach,expectedPreferenceVersion:preference.version},{render:false});if(actor?.id!==identity||epoch!==loiCompositionEpoch||!loiCompositionEnabled())throw Error('Writing approach access changed.');delete S.ui.loiStyleChoice;render();notice('Default saved for new letters. Existing drafts, approvals and sent history are unchanged.');return r;},
 'loi-compose-one'(el){return composeLetter(el,1);},
 'loi-compose-three'(el){return composeLetter(el,3);},
 async 'loi-compose-load'(el){const i=ownComposition(ownLoi(el));syncLoiCompositionView();const key=loiMemoryKey(i);if(loiCompositionBusy.has(key))throw Error('Wait for the current composition request.');const authority=compositionAuthority(i);loiCompositionBusy.add(key);render();try{const r=await loiSubjectCommand(i,'loi.generation_read',{}, {render:false});if(!compositionStillCurrent(authority,i))throw Error('The letter or writing approach access changed while saved proposals were loading.');const generation=readCompositionGeneration(i,r.generation);loiProposals.set(key,{subjectBinding:loiSubjectBinding(i),generation,empty:generation===null});if(generation&&['RESERVED','OUTCOME_UNKNOWN'].includes(generation.status))loiCompositionUncertain.add(key);return r;}finally{if(compositionStillCurrent(authority,i)){loiCompositionBusy.delete(key);render();}}},
 async 'loi-compose-select'(el){const i=ownComposition(ownLoi(el)),key=loiMemoryKey(i),g=compositionProposal(i)?.generation,index=Number(el.dataset.candidate);if(loiCompositionBusy.has(key))throw Error('Wait for the current composition request.');if(loiCompositionUncertain.has(key)||!g||!['PROPOSED','STANDARD_FALLBACK'].includes(g.status)||!Number.isInteger(index)||index<0||index>=g.proposals.length)throw Error('Choose an available, reviewed proposal.');if(!compositionHeadMatches(i,g))throw Error('The saved letter changed. These proposals cannot overwrite its newer draft.');if(!loiConfirmed('loi-composition-review-'+index+'-'+i.id))throw Error('Review this proposal and any edits before selecting it.');const editedText=val('loi-composition-proposal-'+index+'-'+i.id);if(!editedText.trim()||editedText.length>20000)throw Error('The complete proposal is empty or too long.');const authority=compositionAuthority(i);loiCompositionBusy.add(key);loiHandoffs.delete(key);render();try{const r=await loiSubjectCommand(i,'loi.generation_select',{generationId:g.generationId,candidateIndex:index,...loiHeadData(i),studentReviewConfirmed:true,...(editedText!==g.proposals[index].text?{editedText}:{})},{render:false});if(!compositionStillCurrent(authority,i))throw Error('The selected letter context changed. Reopen the intended letter.');notice('A new draft was saved. Review factual accuracy and program specificity, then approve that one saved revision.');return r;}finally{if(compositionStillCurrent(authority,i)){loiCompositionBusy.delete(key);render();}}}
});

function myerasStep(step){requireMyerasAccess();if(!myerasFlow)throw Error('Reopen the import wizard.');if(myerasFlow.busy)throw Error('An import request is already in progress.');myerasFlow.step=step;myerasFlow.error=null;renderDrawer();}
async function readMyerasFile(file){requireMyerasAccess();if(!myerasFlow)throw Error('Reopen the import wizard.');const a=myerasAuthority();if(!file||file.size<=0||file.size>262144)throw Error('Choose a UTF-8 CSV file up to 256 KiB.');const bytes=new Uint8Array(await file.arrayBuffer());let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw Error('This file is not valid UTF-8. Export the UTF-8 CSV again.');}if(!currentMyerasAuthority(a))throw Error('Import access changed while the file was loading.');myerasFlow.csvText=text;myerasFlow.fileName=file.name;myerasFlow.preview=null;myerasFlow.decisions={};renderDrawer();}
async function myerasRequest(name){requireMyerasAccess();const f=myerasFlow;if(!f||f.busy)throw Error('An import request is already in progress.');if(!f.csvText||new TextEncoder().encode(f.csvText).byteLength>262144)throw Error('Choose a CSV file up to 256 KiB.');const a=myerasAuthority();let data={csvText:f.csvText};if(name==='myeras.import'){if(!f.preview)throw Error('Review the server-validated program list first.');data.expectedPreviewDigest=f.preview.previewDigest;data.decisions=Object.entries(f.decisions).map(([rowKey,d])=>{const r=f.preview.rows.find(r=>r.rowKey===rowKey);if(!r)throw Error('Review the current file again.');if(d.programId&&!d.confirmed)throw Error('Confirm the exact program and track.');const decision={rowKey,...(d.programId?{programId:d.programId,confirmed:true}:{}),...(d.choice?{choice:d.choice}:{})};if(r.existingTarget&&(d.choice||d.programId))decision.expectedTargetVersion=r.existingTarget.version;return decision;});}
 f.busy=true;f.error=null;renderDrawer();try{const result=await command(name,null,data,{targetKind:'program',targetId:null,render:false});if(!currentMyerasAuthority(a))throw Error('Import access changed while this request was loading.');if(name==='myeras.preview'){const prior=f.decisions;f.preview=validateMyerasPreview(result.preview);f.step=6;f.page=1;f.decisions={};for(const r of f.preview.rows){const d=prior[r.rowKey];if(d)f.decisions[r.rowKey]={...(d.choice?{choice:d.choice}:{}),...(d.programId&&r.candidates.some(p=>p.id===d.programId)?{programId:d.programId,confirmed:false}:{})};}}else{const summary=result.importSummary;if(summary)f.summary=summary;else if(result.replayed){const targets=S.loiTargets?.targets||[],retained=f.preview.rows.map(r=>targets.find(t=>t.sources?.some(s=>s.source==='MYERAS'&&s.sourceId===r.rowKey)));if(retained.some(t=>!t))throw Error('The replayed import needs a fresh own-list read. Your original file is kept.');f.summary={unique:retained.length,MATCHED:retained.filter(t=>t.resolutionState==='MATCHED').length,NEEDS_CONFIRMATION:retained.filter(t=>t.resolutionState==='NEEDS_CONFIRMATION').length,NOT_FOUND:retained.filter(t=>t.resolutionState==='NOT_FOUND').length};}else throw Error('The import save was not confirmed. Your review is kept.');f.step=7;}return result;}catch(error){if(currentMyerasAuthority(a)){f.error=error.message;if(error.status===409)f.error+=' Your file and choices remain in this tab; review the current registry and target versions before saving again.';}throw error;}finally{if(currentMyerasAuthority(a)){f.busy=false;render();}}
}
Object.assign(A,{
 'myeras-open'(){requireMyerasAccess();clearMyerasMemory();myerasFlow={step:1,csvText:'',fileName:null,decisions:{},preview:null,page:1,help:false,busy:false};openDrawer({kind:'myeras'});},
 'myeras-next'(){if(myerasFlow?.step>=5)throw Error('Validate and review the file before continuing.');myerasStep((myerasFlow?.step||1)+1);},
 'myeras-back'(){myerasStep(Math.max(1,myerasFlow.step-1));},
 'myeras-help'(){requireMyerasAccess();myerasFlow.help=!myerasFlow.help;renderDrawer();},
 async 'myeras-copy-prompt'(){requireMyerasAccess();if(!navigator.clipboard?.writeText)throw Error('Clipboard is unavailable. Download the exact prompt instead.');await navigator.clipboard.writeText(MYERAS_EXPORT_PROMPT);notice('Export prompt copied.');},
 'myeras-download-prompt'(){requireMyerasAccess();downloadMyerasFile('IVIQ_MYERAS_EXPORT_PROMPT_V1.md',MYERAS_EXPORT_PROMPT,'text/markdown;charset=utf-8');},
 'myeras-blank'(){requireMyerasAccess();downloadMyerasFile('MYERAS_APPLIED_PROGRAMS.csv',MYERAS_CSV_HEADER+'\n','text/csv;charset=utf-8');},
 'myeras-retry-prompt'(){myerasStep(3);},'myeras-upload-step'(){myerasStep(5);},
 'myeras-manual'(){requireMyerasAccess();closeDrawer();go('letters');},
 'myeras-preview'(){return myerasRequest('myeras.preview');},'myeras-import'(){return myerasRequest('myeras.import');},
 'myeras-page'(el){if(!myerasFlow?.preview)return;const n=Number(el.dataset.page);if(Number.isSafeInteger(n)&&n>=1&&n<=Math.ceil(myerasFlow.preview.rows.length/25)){myerasFlow.page=n;renderDrawer();}},
 'myeras-done'(){requireMyerasAccess();if(myerasFlow?.step!==7)throw Error('Save the reviewed list first.');closeDrawer();go('letters');},
 'myeras-review-again'(){requireMyerasAccess();if(!myerasFlow?.preview)throw Error('Upload a file first.');myerasFlow.preview=null;myerasStep(5);}
});
document.addEventListener('change',ev=>{const e=ev.target;if(e.id==='myeras-file'){void readMyerasFile(e.files?.[0]).catch(error=>{if(myerasFlow){myerasFlow.error=error.message;renderDrawer();}});}if(e.dataset.myerasRow&&myerasEnabled()&&myerasFlow?.preview&&!myerasFlow.busy){const r=myerasFlow.preview.rows.find(r=>r.rowKey===e.dataset.myerasRow);if(!r)return;const d=myerasFlow.decisions[r.rowKey]||{};if(e.dataset.myerasField==='programId'){if(e.value&&!r.candidates.some(p=>p.id===e.value))return;d.programId=e.value;d.confirmed=false;}if(e.dataset.myerasField==='confirmed')d.confirmed=e.checked;if(e.dataset.myerasField==='choice'&&['CREATE_LETTER','MAYBE_LATER','SKIP'].includes(e.value))d.choice=e.value;myerasFlow.decisions[r.rowKey]=d;}});
document.addEventListener('input',ev=>{if(ev.target.id==='myeras-csv-text'&&myerasEnabled()&&myerasFlow&&!myerasFlow.busy){myerasFlow.csvText=ev.target.value;myerasFlow.preview=null;myerasFlow.decisions={};for(const b of document.querySelectorAll('[data-act="myeras-preview"]'))b.disabled=!myerasFlow.csvText;}});
document.addEventListener('dragover',ev=>{if(ev.target.closest?.('#myeras-drop'))ev.preventDefault();});
document.addEventListener('drop',ev=>{if(ev.target.closest?.('#myeras-drop')){ev.preventDefault();void readMyerasFile(ev.dataTransfer?.files?.[0]).catch(error=>{if(myerasFlow){myerasFlow.error=error.message;renderDrawer();}});}});

// C202: explicit own intake only; unknown optional facts stay unknown.
const INTAKE_STEPS=['PROGRAM','INTERVIEW','EVENTS','CONNECTION','OUTREACH','DETAILS','REVIEW'];
function requireIntakeUI(){if(!intakeVisible())throw Error(studentPreview()?'Administrator preview cannot save private intake.':'Interview intake is unavailable.');if(!studentPreview())requireStudent();if(intakeFlow?.busy)throw Error('Wait for the current intake save.');}
function intakeAuthority(){return {actor:actor?.id,epoch:intakeEpoch,flow:intakeFlow};}
function intakeCurrent(a){return a.actor===actor?.id&&a.epoch===intakeEpoch&&a.flow===intakeFlow&&intakeEnabled();}
function freshIntake(day){return {step:1,identity:{programId:null,registryReleaseId:null,confirmed:false,provisionalConfirmed:false,invitationLabel:''},positionType:'UNKNOWN',track:'',deadline:null,schedule:{date:day||null,time:null,zone:F.student_zone||'UTC',fold:null,duration:null,travel_minutes:null,format:'unknown',joining:''},details:{},experiences:[],events:[],matches:[],searchText:'',searchTotal:null,specialtyFilter:'',calView:{},program:null,busy:false,help:false,saveResult:null,error:null};}
function openIntake(el={dataset:{}}){requireIntakeUI();if(!intakeFlow||intakeFlow.saveResult||intakeFlow.editId)intakeFlow=freshIntake(el.dataset?.day);openDrawer({kind:'intake',returnTo:el.dataset?.day?'[data-cal-day="'+el.dataset.day+'"]':null});}
function intakeSet(path,value){if(!intakeFlow||intakeFlow.busy||!intakeVisible())return;const bits=path.split('.');if(bits.some(k=>['__proto__','constructor','prototype'].includes(k)))return;let obj=intakeFlow;for(const k of bits.slice(0,-1)){if(!obj[k]||typeof obj[k]!=='object')return;obj=obj[k];}obj[bits.at(-1)]=value;intakeFlow.error=null;}
function intakeBody(){const f=intakeFlow;return f.editId?{expectedIntakeVersion:f.expectedIntakeVersion,positionType:f.positionType,track:f.track,details:f.details,experiences:f.experiences}:{identity:f.identity,positionType:f.positionType,track:f.track,deadline:f.deadline,schedule:f.schedule,details:f.details,experiences:f.experiences,events:f.events};}
async function saveIntake(){if(studentPreview())throw previewError();requireStudent();requireIntakeUI();const f=intakeFlow;if(!f||f.busy||f.saveResult)throw Error('Wait for this interview save.');const a=intakeAuthority();f.busy=true;f.error=null;renderDrawer();try{const r=await command(f.editId?'intake.update':'intake.create',f.editId||null,intakeBody(),{render:false});if(!intakeCurrent(a))throw Error('Private interview authority changed.');const id=r.interviewId||r.resultId;if(!id||!S.interviews.some(i=>i.id===id&&i.owner===actor.id))throw Error('The saved interview was not confirmed. Your draft is retained.');f.saveResult={id,edited:!!f.editId};f.step=8;render();return r;}catch(error){if(intakeCurrent(a)){f.error=error.message+(error.status===409?' Your draft is kept; review the latest version before saving again.':'');}throw error;}finally{if(intakeCurrent(a)){f.busy=false;renderDrawer();}}}
Object.assign(A,{
 'intake-next'(){requireIntakeUI();if(intakeFlow.busy)return;if(intakeFlow.step===1&&!intakeFlow.identity.invitationLabel.trim())throw Error('Enter the invitation name. A date is not required.');intakeFlow.step=Math.min(7,intakeFlow.step+1);renderDrawer();},
 'intake-back'(){requireIntakeUI();if(!intakeFlow.busy){intakeFlow.step=Math.max(intakeFlow.editId?4:1,intakeFlow.step-1);renderDrawer();}},
 'intake-skip'(){return A['intake-next']();},
 'intake-help'(){requireIntakeUI();intakeFlow.help=!intakeFlow.help;renderDrawer();},
 'intake-save'(){return saveIntake();},
 'intake-new'(){requireIntakeUI();clearIntakeMemory();openIntake();},
 'intake-search':async function(){requireIntakeUI();const f=intakeFlow,q=f.searchText.trim();if(q.length<2||q.length>256)throw Error('Search by 2–256 characters of program name, native RISE ID or ACGME ID.');const a=intakeAuthority(),seq=++intakeSearchSequence;f.matches=[];f.searchTotal=null;f.error=null;const r=await apiFetch('/programs?q='+encodeURIComponent(q));if(!intakeCurrent(a)||seq!==intakeSearchSequence||f.searchText.trim()!==q)throw Error('Program search authority changed. Search again.');if(!Array.isArray(r.programs)||!Number.isSafeInteger(r.total)||r.total<r.programs.length||typeof r.registryReleaseId!=='string')throw Error('RISE search could not be verified.');f.matches=r.programs;f.searchTotal=r.total;renderDrawer();},
 'intake-spec-filter'(el){requireIntakeUI();intakeFlow.specialtyFilter=el.dataset.spec||'';renderDrawer();},
 'intake-select'(el){requireIntakeUI();const f=intakeFlow,p=f.matches.find(p=>p.id===el.dataset.program);if(!p)throw Error('Choose a program from the current verified search.');f.program=p;f.identity.programId=p.id;f.identity.registryReleaseId=p.registryReleaseId;f.identity.confirmed=false;f.identity.provisionalConfirmed=false;if(!f.identity.invitationLabel)f.identity.invitationLabel=p.name;renderDrawer();},
 'intake-unresolved'(){requireIntakeUI();const f=intakeFlow;f.program=null;f.identity.programId=null;f.identity.registryReleaseId=null;f.identity.confirmed=false;f.identity.provisionalConfirmed=false;renderDrawer();},
 'intake-event-add'(){requireIntakeUI();const f=intakeFlow;if(f.events.length>=12)throw Error('Add at most 12 related events.');f.events.push({clientKey:crypto.randomUUID(),kind:'MEET_GREET',schedule:{date:null,time:null,zone:f.schedule.zone,fold:null,duration:null,format:'unknown',joining:''},required:'UNKNOWN',location:null,note:''});renderDrawer();},
 'intake-event-remove'(el){requireIntakeUI();if(intakeFlow.busy)return;intakeFlow.events.splice(+el.dataset.index,1);renderDrawer();},
 'intake-experience-add'(){requireIntakeUI();if(intakeFlow.experiences.length>=20)throw Error('Add at most 20 prior experiences.');intakeFlow.details.relationshipState='YES';intakeFlow.experiences.push({kind:'CLERKSHIP',department:null,startDate:null,endDate:null,description:'',contact:null,confirmed:false});renderDrawer();},
 'intake-experience-remove'(el){requireIntakeUI();if(intakeFlow.busy)return;intakeFlow.experiences.splice(+el.dataset.index,1);renderDrawer();},
 'intake-edit'(el){requireIntakeUI();const i=S.interviews.find(i=>i.id===el.dataset.id);requireOwn(i);const d=i.intake;intakeFlow={...freshIntake(null),editId:i.id,expectedIntakeVersion:d?.version??0,step:4,identity:{invitationLabel:i.unresolved_input,programId:i.program,registryReleaseId:d?.registryReleaseId,confirmed:!!i.program},program:{name:i.programName},positionType:d?.positionType||'UNKNOWN',track:d?.track||i.track||'',schedule:{date:i.date,time:i.wall?.slice(11,16)||null,zone:i.zone,format:i.format,fold:i.fold},details:clone(d?.details||{}),experiences:clone(d?.experiences||[])};openDrawer({kind:'intake'});},
 'intake-done'(){requireIntakeUI();const id=intakeFlow?.saveResult?.id;clearIntakeMemory();closeDrawer();if(id){S.ui.open=id;S.ui.route='interviews';S.ui.section='schedule';}render();},
 // V2 game-like controls: choice cards, visual calendar picker and post-save navigation. None of these change the save contract.
 'intake-choice'(el){requireIntakeUI();if(intakeFlow.busy)return;const field=el.dataset.field||'';if(!field)return;const raw=el.dataset.value??'';const value=field.endsWith('.fold')?(raw===''?null:Number(raw)):raw;intakeSet(field,value);renderDrawer();},
 'intake-cal-nav'(el){requireIntakeUI();if(intakeFlow.busy)return;const field=el.dataset.field||'',month=el.dataset.month||'';if(!field||!/^\d{4}-\d{2}$/.test(month))return;intakeFlow.calView||={};intakeFlow.calView[field]=month;renderDrawer();},
 'intake-cal-pick'(el){requireIntakeUI();if(intakeFlow.busy)return;const field=el.dataset.field||'',date=el.dataset.date||'';if(!field||!/^\d{4}-\d{2}-\d{2}$/.test(date))return;intakeSet(field,date);intakeFlow.calView||={};intakeFlow.calView[field]=date.slice(0,7);renderDrawer();},
 'intake-cal-clear'(el){requireIntakeUI();if(intakeFlow.busy)return;const field=el.dataset.field||'';if(!field)return;intakeSet(field,null);renderDrawer();},
 'intake-go'(el){requireIntakeUI();const id=intakeFlow?.saveResult?.id,section=el.dataset.section||'schedule',route=el.dataset.route||'';clearIntakeMemory();closeDrawer();if(route){go(route);return;}if(id){S.ui.open=id;S.ui.route='interviews';S.ui.section=section;}render();focusSection();},
 'intake-prelim-letter'(){requireIntakeUI();const f=intakeFlow,id=f.details.prelimTargetId,t=loiTargetRow(id);if(f.positionType!=='ADVANCED'||f.details.pgy1Applied!=='YES'||f.details.advancedFactConfirmed!==true||!t||t.choice!=='CREATE_LETTER'||!t.program)throw Error('Use a confirmed existing own preliminary or transitional letter target.');const known=S.interviews.some(i=>i.owner===actor.id&&i.program===t.program.id&&['PRELIMINARY','TRANSITIONAL_YEAR'].includes(i.intake?.positionType)&&i.intake?.details.applicationState==='APPLIED');if(!known)throw Error('Your existing application facts do not verify this preliminary or transitional target.');closeDrawer();A['loitarget-open']({dataset:{id}});}
});
function intakeFieldEvent(e){const t=e.target;if(!t.dataset?.intakeField||!intakeVisible())return;let value=t.type==='checkbox'?t.checked:(t.dataset.intakeNumber==='true'||t.dataset.intakeField.endsWith('.fold'))?(t.value===''?null:Number(t.value)):t.value;intakeSet(t.dataset.intakeField,value);if(['positionType','details.relationshipState','details.itineraryState','details.pgy1Applied'].includes(t.dataset.intakeField))renderDrawer();}
document.addEventListener('input',intakeFieldEvent);document.addEventListener('change',intakeFieldEvent);
document.addEventListener('keydown',ev=>{if(ev.key==='Enter'&&ev.target?.id==='in-searchText'&&intakeEnabled()&&intakeFlow&&!intakeFlow.busy){ev.preventDefault();Promise.resolve().then(()=>A['intake-search']()).catch(error=>{if(intakeFlow){intakeFlow.error=error.message;renderDrawer();}});}});

function calendarAuthority(){return {id:actor.id,role:actor.role,epoch:calendarEpoch};}
function currentCalendar(a){return calendarV2()&&actor.id===a.id&&actor.role===a.role&&calendarEpoch===a.epoch;}
function itineraryContext(id){
 if(!calendarV2())throw Error('Private itinerary is unavailable.');
 if(actor.role==='student'&&S.interviews.some(i=>i.id===id&&i.owner===actor.id))return {targetRef:null,headers:{}};
 const t=adminCalendarTarget;
 if(actor.role==='admin'&&capabilities.adminLogistics===true&&t?.interview.id===id)return {targetRef:t.eventRef,headers:{'X-IIQ-Calendar-Target':t.eventRef}};
 throw Error('Open an itinerary in your own saved interview or a currently admitted administrator target.');
}
function currentItinerary(a,id,ref){return currentCalendar(a)&&itineraryContext(id).targetRef===ref;}
async function calendarMutation(path,intent,body,headers={}){
 if(calendarMutationBusy||itineraryPending)throw Error('Resolve the current Calendar mutation before another action.');
 const a=calendarAuthority(),key=JSON.stringify([a.id,a.role,a.epoch,path,headers,intent]);
 if(calendarMutationPending&&calendarMutationPending.key!==key)throw Error('The earlier Calendar action has an uncertain outcome. Retry that same action first.');
 calendarMutationPending||={key,path,body:JSON.stringify({...body,requestId:crypto.randomUUID()})};
 const pending=calendarMutationPending;calendarMutationBusy=true;
 try{const r=await apiFetch(path,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:pending.body});if(!currentCalendar(a))throw Error('Calendar authority changed.');calendarMutationPending=null;return r;}
 catch(error){if(currentCalendar(a)&&error.status>=400&&error.status<500)calendarMutationPending=null;throw error;}
 finally{if(currentCalendar(a))calendarMutationBusy=false;}
}
async function loadCohort(more=false){if(!calendarV2())throw Error('Cohort Calendar is unavailable.');const a=calendarAuthority(),model=monthModel(S.ui.cal.ym),start=model.days[0].key,end=model.days.at(-1).key;if(more&&(cohortPage?.start!==start||cohortPage?.end!==end))throw Error('Reload the selected cohort month before continuing.');const cursor=more&&cohortPage?.nextCursor;if(more&&!cursor)return;const r=await apiFetch('/calendar/cohort?start='+start+'&end='+end+(cursor?'&cursor='+encodeURIComponent(cursor):''));if(!currentCalendar(a))throw Error('Calendar authority changed.');if(!Array.isArray(r.events)||r.events.length>200||r.start!==start||r.end!==end||r.deidentified!==true)throw Error('Calendar response was invalid.');const fields=['event_ref','program_id','program_name','specialty','track','local_date','local_time','timezone','start_at','fold','all_day','format','event_type','lifecycle'];const events=r.events.map(e=>{if(!/^[a-f0-9-]{36}$/.test(e.event_ref||'')||typeof e.program_name!=='string'||e.program_name.length>500||typeof e.local_date!=='string')throw Error('Calendar event was invalid.');return Object.fromEntries(fields.map(k=>[k,e[k]]));});cohortPage={events,start,end,nextCursor:r.nextCursor,page:more?(cohortPage?.page||1)+1:1};S.ui.calendarScope='all';render();}
const ownCalendarItemAction=A['cal-item'];
A['cal-item']=function(el){const id=el.dataset.item;if(id?.startsWith('peer-')){if(!calendarV2())throw Error('Cohort event unavailable.');openDrawer({kind:'cohort-event',ref:id.slice(5)});return;}return ownCalendarItemAction.call(this,el);};
function adminCalendarEventData(eventId){const prefix='calendar-event-'+(eventId||'new')+'-',fold=val(prefix+'fold'),duration=val(prefix+'duration');return {kind:val(prefix+'kind'),date:val(prefix+'date')||null,time:val(prefix+'time')||null,zone:val(prefix+'zone'),fold:fold===''?null:Number(fold),duration_minutes:duration===''?null:Number(duration),note:val(prefix+'note'),...(eventId?{eventId}:{})};}
Object.assign(A,{
 'calendar-mine'(){S.ui.calendarScope='mine';render();},'calendar-all'(){return loadCohort();},'calendar-more'(){return loadCohort(true);},
 async 'itinerary-open'(el){const id=el.dataset.id,c=itineraryContext(id),a=calendarAuthority(),seq=++itineraryReadSequence,r=await apiFetch('/interviews/'+id+'/itinerary',{headers:c.headers});if(!currentItinerary(a,id,c.targetRef)||seq!==itineraryReadSequence)throw Error('Itinerary access changed.');if(!Array.isArray(r.files)||r.files.length>10||!Number.isSafeInteger(r.interviewVersion)||r.interviewVersion<1)throw Error('File list invalid.');itineraryPage={interviewId:id,targetRef:c.targetRef,interviewVersion:r.interviewVersion,files:r.files.map(f=>({attachmentId:f.attachmentId,version:f.version,sha256:f.sha256,format:f.format,byteSize:f.byteSize,createdAt:f.createdAt,withdrawn:f.withdrawn}))};openDrawer({kind:'itinerary',id});},
 async 'itinerary-upload'(el){const id=el.dataset.id,c=itineraryContext(id);if(calendarMutationBusy||calendarMutationPending)throw Error('Resolve the current Calendar mutation before uploading.');const file=document.getElementById('calendar-itinerary-file')?.files?.[0],a=calendarAuthority();if(!file||file.size<1||file.size>5242880)throw Error('Choose a PDF, PNG or JPEG up to 5 MiB.');if(itineraryPage?.interviewId!==id||itineraryPage.targetRef!==c.targetRef)throw Error('Load the current saved files first.');const ext=file.name.split('.').pop().toLowerCase(),bytes=await file.arrayBuffer();if(!currentItinerary(a,id,c.targetRef))throw Error('Itinerary access changed.');const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');if(!currentItinerary(a,id,c.targetRef)||calendarMutationBusy||calendarMutationPending)throw Error('Itinerary access changed or another action is pending.');const key=JSON.stringify([a.id,a.role,a.epoch,id,c.targetRef,sha,file.type,ext]);if(itineraryPending&&itineraryPending.key!==key)throw Error('Resolve the earlier upload before choosing another file or target.');itineraryPending||={key,id,requestId:crypto.randomUUID(),sha,version:itineraryPage.interviewVersion};const pending=itineraryPending;calendarMutationBusy=true;try{await apiFetch('/interviews/'+id+'/itinerary',{method:'POST',headers:{...c.headers,'Content-Type':file.type,'X-IIQ-Extension':ext,'X-IIQ-SHA256':sha,'X-IIQ-Request-ID':pending.requestId,'X-IIQ-Expected-Version':String(pending.version)},body:bytes});if(!currentItinerary(a,id,c.targetRef))throw Error('Itinerary access changed.');itineraryPending=null;}catch(error){if(currentCalendar(a)&&error.status>=400&&error.status<500)itineraryPending=null;throw error;}finally{if(currentCalendar(a))calendarMutationBusy=false;}await A['itinerary-open'](el);},
 async 'itinerary-download'(el){const id=el.dataset.id,c=itineraryContext(id),a=calendarAuthority(),r=await apiFetch('/interviews/'+id+'/itinerary/'+el.dataset.file,{headers:c.headers,binaryDownload:true});if(!currentItinerary(a,id,c.targetRef))throw Error('Itinerary access changed.');const url=URL.createObjectURL(r.blob);try{const link=document.createElement('a');link.href=url;link.download=r.fileName;link.click();}finally{URL.revokeObjectURL(url);}},
 async 'itinerary-withdraw'(el){const id=el.dataset.id,c=itineraryContext(id);if(itineraryPage?.interviewId!==id||itineraryPage.targetRef!==c.targetRef)throw Error('Load current saved files first.');await calendarMutation('/interviews/'+id+'/itinerary/withdraw',{attachmentId:el.dataset.file},{attachmentId:el.dataset.file,expectedInterviewVersion:itineraryPage.interviewVersion},c.headers);return A['itinerary-open'](el);},
 async 'admin-calendar-read'(el){if(!calendarV2()||actor.role!=='admin'||!capabilities.adminLogistics)throw Error('Administrator target unavailable.');if(calendarMutationBusy||calendarMutationPending&&calendarMutationPending.path!=='/calendar/admin/'+el.dataset.ref)throw Error('Resolve the current Calendar action before opening another target.');const a=calendarAuthority(),seq=++calendarTargetReadSequence,r=await apiFetch('/calendar/admin/'+el.dataset.ref);if(!currentCalendar(a)||!capabilities.adminLogistics||seq!==calendarTargetReadSequence)throw Error('Administrator target authority changed.');if(r.eventRef!==el.dataset.ref||!r.interview?.id||!Array.isArray(r.events))throw Error('Administrator target response invalid.');if(adminCalendarTarget?.eventRef!==r.eventRef)itineraryPage=null;adminCalendarTarget=r;openDrawer({kind:'admin-calendar'});},
 'admin-calendar-schedule'(){const f=val('calendar-admin-fold');return saveAdminCalendar('admin.logistics.update',{date:val('calendar-admin-date')||null,time:val('calendar-admin-time')||null,zone:val('calendar-admin-zone'),fold:f===''?null:Number(f),duration:adminCalendarTarget?.interview.duration??null,travel_minutes:adminCalendarTarget?.interview.travel_minutes??null,format:adminCalendarTarget?.interview.format||'unknown',joining:adminCalendarTarget?.interview.joining||''});},
 'admin-calendar-identity'(){return saveAdminCalendar('admin.logistics.identity',{program:adminCalendarTarget?.interview.program||null,programName:val('calendar-admin-name'),track:val('calendar-admin-track')});},
 'admin-calendar-lifecycle'(el){return saveAdminCalendar('admin.logistics.lifecycle',{action:el.dataset.action});},
 'admin-calendar-event-create'(){return saveAdminCalendar('admin.logistics.event_create',adminCalendarEventData(null));},
 'admin-calendar-event-update'(el){if(!adminCalendarTarget?.events.some(e=>e.id===el.dataset.event))throw Error('Open a current target event.');return saveAdminCalendar('admin.logistics.event_update',adminCalendarEventData(el.dataset.event));},
 'admin-calendar-event-lifecycle'(el){if(!adminCalendarTarget?.events.some(e=>e.id===el.dataset.event))throw Error('Open a current target event.');return saveAdminCalendar('admin.logistics.event_update',{eventId:el.dataset.event,action:el.dataset.action});},
 'admin-calendar-refresh'(){if(!adminCalendarTarget)throw Error('Open a current target.');return A['admin-calendar-read']({dataset:{ref:adminCalendarTarget.eventRef}});},
 'admin-calendar-back'(){itineraryContext(adminCalendarTarget?.interview.id);openDrawer({kind:'admin-calendar'});}
});
async function saveAdminCalendar(command,data){if(!calendarV2()||actor.role!=='admin'||!capabilities.adminLogistics||!adminCalendarTarget)throw Error('Open a current administrator target.');const t=adminCalendarTarget;await calendarMutation('/calendar/admin/'+t.eventRef,{command,data},{command,data,expectedVersion:t.version,expectedInterviewVersion:t.interview.version});return A['admin-calendar-read']({dataset:{ref:t.eventRef}});}

function threeboxInterview(el){const i=iv(el);requireOwn(i);if(!threeboxEnabled())throw previewError();return i;}
async function saveThreebox(el,assemble=false){
  const i=threeboxInterview(el),d=threeboxForm(i),serial=d.serial,epoch=threeboxEpoch;
  const result=await command(assemble?'threebox.assemble':'threebox.save',i.id,threeboxPayload(i),{render:false});
  if(epoch!==threeboxEpoch||!threeboxEnabled()||d!==threeboxDrafts.get(i.id))throw Error('The private builder changed while saving.');
  const h=S.why[i.id]?.threebox?.current;d.expectedHead=h?.revisionId??null;d.expectedAnswerVersion=h?.answerVersion??0;
  if(d.serial===serial){threeboxDrafts.delete(i.id);const next=threeboxForm(i);next.status=assemble?'Saved evidence-bound answer. Practice the facts and structure.':'Private worksheet saved.';}else d.status='Submitted version saved. Your newer typing is still unsaved.';
  render();return result;
}
Object.assign(A,{
 'threebox-add'(el){const i=threeboxInterview(el);threeboxNewReason(threeboxForm(i));render();},
 'threebox-remove'(el){const i=threeboxInterview(el),d=threeboxForm(i);d.reasons=d.reasons.filter(r=>r.id!==el.dataset.reason);threeboxTouch(d);render();},
 'threebox-clear-details'(el){const i=threeboxInterview(el),d=threeboxForm(i),r=d.reasons.find(r=>r.id===el.dataset.reason);if(r)r.details=[];threeboxTouch(d);render();},
 'threebox-intel'(el){const i=threeboxInterview(el),d=threeboxForm(i),r=d.reasons.find(r=>r.id===el.dataset.reason);if(!r||r.intel.length>=8)throw Error('Keep at most eight observations per reason.');r.intel.push({id:crypto.randomUUID(),speaker:'',role:'',text:'',confirmed:false});threeboxTouch(d);render();},
 'threebox-replace'(el){const i=threeboxInterview(el),d=threeboxForm(i),r=d.reasons.find(r=>r.id===el.dataset.reason),facts=threeboxEvidenceCache.get(i.id)?.research.facts||[];const boxes=[...document.querySelectorAll('[data-tb-field="detail"][data-reason="'+el.dataset.reason+'"]')];const selected=boxes.filter(x=>x.checked).map(x=>facts[Number(x.dataset.evidence)]).filter(Boolean);if(!r||!selected.length)throw Error('Check a stronger current supported Detail first.');r.details=selected.map(x=>({...threeboxEvidenceCache.get(i.id).evidenceBindings.find(b=>b.field===x.field&&b.claimRef===x.claimRef)}));threeboxTouch(d);d.status='Weaker saved selections replaced. Save a new version to retain this change.';render();},
 async 'threebox-evidence'(el){const i=threeboxInterview(el),binding=threeboxBinding(i),epoch=threeboxEpoch,r=await command('threebox.evidence',i.id,{}, {render:false});if(!threeboxEnabled()||epoch!==threeboxEpoch||binding!==threeboxBinding(S.interviews.find(x=>x.id===i.id)||{}))throw Error('The interview changed while evidence was loading.');threeboxEvidenceCache.set(i.id,r);threeboxForm(i).status='Current RISE evidence loaded. Review each selected Detail.';render();return r;},
 async 'threebox-read'(el){const i=threeboxInterview(el),epoch=threeboxEpoch,r=await command('threebox.read',i.id,{}, {render:false});if(epoch!==threeboxEpoch)throw Error('Builder access changed.');await refreshWorkspace();if(epoch!==threeboxEpoch)throw Error('Builder access changed.');threeboxDrafts.delete(i.id);threeboxEvidenceCache.delete(i.id);threeboxForm(i).status='Saved worksheet reloaded. Review current evidence before assembling.';render();return r;},
 'threebox-save'(el){return saveThreebox(el);},
 'threebox-assemble'(el){return saveThreebox(el,true);}
});
function threeboxFieldEvent(ev){
 const t=ev.target;if(!t.dataset?.tbField||!threeboxEnabled()||!S)return;const i=S.interviews.find(i=>i.id===t.dataset.id);if(!owns(i))return;
 const d=threeboxForm(i),r=d.reasons.find(r=>r.id===t.dataset.reason),key=t.dataset.tbField,value=t.type==='checkbox'?t.checked:t.value;
 if(['factualConfirmed','specificityConfirmed','locationException'].includes(key)){d[key]=value;d.serial++;return;}
 if(key==='delivery')d.delivery=value;
 else if(key==='editedAnswer'){d.editedAnswer=value;d.edited=true;}
 else if(!r)return;
 else if(key==='category')r.general.category=value;
 else if(key==='rank')r.rank=Number(value);
 else if(key==='selected')r.selected=value;
 else if(key==='personalEnabled'){r.personal.enabled=value;r.personal.confirmed=false;}
 else if(key==='personalText'){r.personal.text=value;r.personal.confirmed=false;const c=document.querySelector('[data-tb-field="personalConfirmed"][data-reason="'+r.id+'"]');if(c)c.checked=false;}
 else if(key==='personalConfirmed')r.personal.confirmed=value;
 else if(key==='followUpDefense')r.followUpDefense=value;
 else if(key==='detail'){const fact=threeboxEvidenceCache.get(i.id)?.research.facts[Number(t.dataset.evidence)];if(!fact)return;r.details=r.details.filter(x=>x.field!==fact.field||x.claimRef!==fact.claimRef);if(value)r.details.push({...threeboxEvidenceCache.get(i.id).evidenceBindings.find(b=>b.field===fact.field&&b.claimRef===fact.claimRef)});}
 else if(key.startsWith('intel')){const x=r.intel.find(x=>x.id===t.dataset.intel);if(!x)return;if(key==='intelConfirmed')x.confirmed=value;else{x[key==='intelSpeaker'?'speaker':key==='intelRole'?'role':'text']=value;x.confirmed=false;}}
 threeboxTouch(d);
}
document.addEventListener('input',threeboxFieldEvent);document.addEventListener('change',ev=>{if(ev.target?.tagName==='SELECT')threeboxFieldEvent(ev);});


'use strict';
const OPENING_TAB_KEY='interviewiq_opening_seen_this_tab';
const OPENING_TOTAL_MS=5000, OPENING_FADE_MS=650, OPENING_REDUCED_MOTION_MS=1000;
let openingShown=false;
function showOpening(){
  const node=document.getElementById('interviewiqOpening');if(!node)return;
  let seen=openingShown;try{seen=seen||sessionStorage.getItem(OPENING_TAB_KEY)==='1';}catch{}
  if(seen){node.hidden=true;return;}
  openingShown=true;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shell=['main','hdr','rail','drawer'].map(id=>document.getElementById(id)).filter(Boolean);
  const priorInert=shell.map(el=>el.inert);shell.forEach(el=>{el.inert=true;});
  const timers=new Set();let finished=false,cleaned=false;
  const later=(fn,ms)=>{const id=setTimeout(()=>{timers.delete(id);fn();},ms);timers.add(id);};
  const skip=node.querySelector('[data-skip-opening]');
  node.hidden=false;node.dataset.phase='forming';node.dataset.motion=reduced?'reduced':'full';
  document.body.classList.add('opening-active');
  const cleanup=()=>{
    if(cleaned)return;cleaned=true;timers.forEach(clearTimeout);timers.clear();
    node.hidden=true;document.body.classList.remove('opening-active');
    shell.forEach((el,k)=>{el.inert=priorInert[k];});
    skip?.removeEventListener('click',skipOpening);
    document.getElementById('main')?.focus({preventScroll:true});
  };
  const finish=immediate=>{
    if(finished){if(immediate)cleanup();return;}finished=true;
    timers.forEach(clearTimeout);timers.clear();
    try{sessionStorage.setItem(OPENING_TAB_KEY,'1');}catch{}
    if(immediate){cleanup();return;}
    node.dataset.phase='leaving';later(cleanup,reduced?250:OPENING_FADE_MS);
  };
  const skipOpening=()=>finish(true);
  skip?.addEventListener('click',skipOpening);skip?.focus({preventScroll:true});
  later(()=>finish(false),reduced?OPENING_REDUCED_MOTION_MS-250:OPENING_TOTAL_MS-OPENING_FADE_MS);
}

void boot();
