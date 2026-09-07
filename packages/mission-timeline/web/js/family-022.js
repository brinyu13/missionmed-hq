/* D1-022: current StoryForge-family presentation over the preserved Timeline engine.
 * Runtime snapshots describe presentation. Every operation is independently
 * authorized by its server owner; this module never grants a role or impersonates.
 */
import {installPrototype021} from './prototype-021.js';

const localHost = () => typeof location !== 'undefined' && ['localhost','127.0.0.1','[::1]'].includes(location.hostname);
const node = (selector) => document.querySelector(selector);
const create = (tag, attributes = {}, text = '') => {
  const element = document.createElement(tag);
  Object.entries(attributes).forEach(([key,value]) => element.setAttribute(key,value));
  element.textContent = text;
  return element;
};
const setText = (selector,text) => {const element=node(selector);if(element)element.textContent=text;};
const plain = (value) => typeof value === 'string' ? value.trim() : '';

export function familyPresentationSnapshot(snapshot = {}, {localFixture = false} = {}) {
  const session = snapshot.session || {};
  const authenticated = session.status === 'authenticated' && Boolean(plain(session.actor?.id));
  const admin = authenticated && session.capabilities?.adminWorkspace === true;
  const subject = admin && plain(session.subject?.id) ? session.subject : null;
  const local = snapshot.mode === 'local-fixture' && localFixture;
  const sync = snapshot.sync || {};
  // A optimistic local save cannot promote the UI to cloud-synced.
  const synced = authenticated && sync.state === 'synced' && Boolean(plain(sync.acknowledgedAt)) && Number.isFinite(Date.parse(sync.acknowledgedAt));
  const syncLabels = {loading:'Loading your Timeline…',saving:'Saving…',offline:'Offline · saved on this device',local:'Saved on this device',conflict:'Save conflict · review needed',error:'Save needs attention'};
  return Object.freeze({
    authenticated,admin,subject,local,
    actor:authenticated ? session.actor : null,
    actorName:authenticated ? plain(session.actor.displayName) || 'MissionMed member' : local ? 'Local test workspace' : 'Checking your account…',
    roleLabel:authenticated ? admin ? 'Administrator' : 'Student' : local ? 'Local test' : session.status === 'denied' ? 'Access unavailable' : 'Checking access',
    syncLabel:synced ? 'Saved & synced' : sync.state === 'synced' ? 'Confirming server save…' : syncLabels[sync.state] || (local ? 'Local draft · this device' : 'Checking save status…'),
    synced
  });
}

export function familyHomeContinuation(timeline = {}) {
  const eventCount = Array.isArray(timeline?.events) ? timeline.events.length : 0;
  const intake = timeline?.intake;
  const candidateCount = intake?.stage === 'review' && intake.approval?.applied !== true && Array.isArray(intake.candidates) ? intake.candidates.length : 0;
  return {
    candidateCount,
    enabled:eventCount > 0 || candidateCount > 0,
    route:candidateCount ? 'intake' : 'builder',
    label:candidateCount ? 'Continue review' : 'Continue my Timeline',
    title:candidateCount ? 'Review your saved suggestions' : eventCount ? 'Continue your current Timeline' : 'Build from a CV or choose an existing source to start'
  };
}

export function showTimelineOpening({storage = globalThis.sessionStorage, reducedMotion = false} = {}) {
  if(typeof document === 'undefined' || !document.body || node('#timelineOpening022'))return;
  try {if(storage?.getItem('timeline-022-opening-seen') === '1')return;} catch {}
  const opening = create('div',{id:'timelineOpening022',class:'family022Opening'});
  opening.innerHTML = '<section class="family022Intro" aria-labelledby="timelineOpeningTitle022"><p class="family022Creator">DR BRIAN’S</p><p class="family022Program">MATCH PREP ON-CALL</p><div class="family022IntroLine" aria-hidden="true"><i></i><i></i><i></i></div><h1 id="timelineOpeningTitle022">Timeline<span>Builder</span></h1><p class="family022IntroPurpose">YOUR JOURNEY. CLEARLY TOLD.</p><p class="family022IntroStatus" role="status">Opening your Timeline workspace…</p><button type="button" class="family022Skip">Skip introduction</button></section>';
  document.body.append(opening);
  let timer;
  const dismiss = () => {
    clearTimeout(timer);
    try {storage?.setItem('timeline-022-opening-seen','1');} catch {}
    opening.remove();
  };
  opening.querySelector('button').addEventListener('click',dismiss,{once:true});
  timer = setTimeout(dismiss,reducedMotion ? 120 : 1650);
  return dismiss;
}

function mountAdminHost() {
  if(node('#timelineAdmin022'))return node('#timelineAdmin022');
  const host=create('section',{id:'timelineAdmin022','data-view':'admin','aria-label':'Timeline administrator workspace'});
  node('main')?.append(host);
  document.dispatchEvent(new CustomEvent('d1:family-022-mounted',{detail:{adminHost:host}}));
  return host;
}

export function installFamily022(api = window.D1_407F_ENGINEERING) {
  mountAdminHost();
  if(!api?.store || !api?.bridge?.go)return null;
  if(window.D1_FAMILY_022)return window.D1_FAMILY_022;
  installPrototype021(api,api.bridge,{family:true});
  document.body.classList.add('family022');
  document.title='Timeline Builder · MissionMed';
  if(!node('link[data-family-022]'))document.head.append(create('link',{rel:'stylesheet',href:new URL('../styles/family-022.css',import.meta.url).href,'data-family-022':''}));
  document.head.append(node('link[data-family-022]'));
  // A legacy local preview may have installed first. Its presentation lens is
  // removed; only the real runtime principal is used by this family shell.
  document.querySelectorAll('.prototype021Lens,.prototype021LensNotice,.prototype021Status,.prototype021RailFoot,.prototype021ProviderNotice').forEach((element)=>element.remove());
  delete document.body.dataset.prototypeLens;
  document.body.classList.remove('prototype021FounderLens');
  const longBrand=node('.brandLong'),shortBrand=node('.brandShort');
  if(longBrand)longBrand.innerHTML='MissionMed<b>//Timeline</b>';
  if(shortBrand)shortBrand.innerHTML='Timeline<b>Builder</b>';
  setText('.logoSub','MISSION:RESIDENCY DIVISION');
  const header=node('.d1404Header');
  const identity=create('div',{class:'family022Identity'});
  identity.innerHTML='<span class="family022Role" data-family-role></span><span class="family022Actor" data-family-actor></span>';
  header.querySelector('.headerSpacer')?.after(identity);
  const adminButton=create('button',{type:'button',class:'family022AdminButton',hidden:''},'Admin workspace');
  identity.append(adminButton);
  const sync=create('div',{class:'family022Sync',role:'status','aria-live':'polite'});
  const syncLabel=create('span');
  const syncRecovery=create('button',{type:'button',class:'family022SyncRecovery',hidden:''});
  sync.append(syncLabel,syncRecovery);
  identity.after(sync);
  const subjectBanner=create('div',{class:'family022Subject',role:'status',hidden:''});
  subjectBanner.innerHTML='<span class="family022SubjectInitials" aria-hidden="true"></span><div><span class="family022Eyebrow">VIEWING TIMELINE FOR</span><strong data-family-subject></strong><small data-family-subject-access></small></div><button type="button" class="btnD alt">Return to students</button>';
  node('main').prepend(subjectBanner);
  const diagnostics=create('details',{class:'family022Diagnostics',hidden:''});
  diagnostics.innerHTML='<summary>Local test workspace</summary><p data-family-diagnostics></p>';
  const rail=node('#rail');
  const adminHomeNav=create('button',{type:'button',class:'rtab family022AdminNav',hidden:''},'Admin Home');
  const adminRosterNav=create('button',{type:'button',class:'rtab family022AdminNav',hidden:''},'Students');
  rail.prepend(adminHomeNav,adminRosterNav);
  const tools=create('details',{class:'family022Tools'});
  tools.append(create('summary',{},'Tools'));
  const toolsList=create('div',{class:'family022ToolsList'});
  tools.append(toolsList);
  const secondary=['canvas','rescue','media'];
  secondary.forEach((route)=>{const button=rail.querySelector(`[data-v="${route}"]`);if(button)toolsList.append(button);});
  const guardian=rail.querySelector('[data-quality-guardian-open]');
  if(guardian)toolsList.querySelector('[data-v="rescue"]')?.before(guardian);
  rail.querySelector('[data-v="command"]').textContent='Home';
  rail.querySelector('[data-v="builder"]').textContent='My Timeline';
  rail.append(tools,diagnostics);
  const railBrand=create('div',{class:'family022RailBrand','aria-hidden':'true'});
  railBrand.innerHTML='Timeline<span>Builder</span><small>MISSIONMED</small>';
  rail.prepend(railBrand);

  const home=node('section[data-view="command"]');
  setText('.homeBuildRegion .homeMicro','YOUR MEDICAL JOURNEY, CLEARLY TOLD');
  const title=node('#homeTitle');
  title.innerHTML='Timeline<em>Builder</em>';
  title.setAttribute('aria-label','Timeline Builder');
  setText('.homeSubline','Start with what you have. Verify your history, then shape a Timeline you can confidently share.');
  const actions=node('.homeActions');
  const cv=node('#homeIntake'),resume=node('#homeBuild'),vault=node('#homeFileVault'),rescue=node('.prototype021RescueLink');
  cv.textContent='Build from my CV';cv.setAttribute('aria-label','Build from my CV');
  resume.textContent='Continue my Timeline';
  vault.textContent='Choose from File Vault';
  rescue.textContent='I already have a Timeline';
  const alternates=create('div',{class:'family022AlternateIntents'});
  alternates.append(rescue,vault);
  actions.after(alternates);
  setText('.homeJourneyStrip','Read your CV  →  Review the facts  →  Make it interview ready');
  node('.homeIntakeRegion').hidden=true;
  const continuity=create('details',{class:'family022Continuity'});
  continuity.append(create('summary',{},'Your current Timeline'));
  node('.homeTimelineRegion').before(continuity);
  continuity.append(node('.homeTimelineRegion'));
  if(node('#homeStartOver'))continuity.append(node('#homeStartOver'));
  const progress=node('#homeCompletion407F');if(progress)continuity.append(progress);
  const homeNote=create('p',{class:'family022HomeNote'},'You decide what becomes part of your Timeline. Source facts stay separate from suggestions.');
  alternates.after(homeNote);
  const contextStatus=create('span',{class:'family022ContinuityStatus'});continuity.querySelector('summary').append(contextStatus);

  let runtime=null,unsubscribe=null,requestedAdminFor='',lastFamilyView='';
  const localFixture=localHost() && new URLSearchParams(location.search).get('prototype')==='021';
  function attachRuntime(){
    const current=window.D1_TIMELINE_RUNTIME_022;
    if(current===runtime)return;
    unsubscribe?.();runtime=current;
    unsubscribe=typeof runtime?.subscribe==='function'?runtime.subscribe(refresh):null;
  }
  function action(value){
    if(typeof runtime?.handleAction==='function')return runtime.handleAction(value);
    document.dispatchEvent(new CustomEvent('d1:family-022-action',{detail:{action:value}}));
  }
  adminButton.addEventListener('click',()=>action('admin-home'));
  syncRecovery.addEventListener('click',()=>action('recover-save'));
  adminHomeNav.addEventListener('click',()=>{api.bridge.go('admin');action('admin-home');});
  adminRosterNav.addEventListener('click',()=>{api.bridge.go('admin');action('admin-roster');});
  subjectBanner.querySelector('button').addEventListener('click',()=>action('exit-subject'));
  toolsList.addEventListener('click',(event)=>{if(event.target.closest('button'))tools.open=false;});
  function refresh(){
    attachRuntime();
    let snapshot;
    try{snapshot=runtime?.getSnapshot?.();}catch{snapshot={session:{status:'error'}};}
    const context=familyPresentationSnapshot(snapshot || (localFixture?{mode:'local-fixture',sync:{state:'local'}}:{}),{localFixture});
    const timeline=api.store.document;
    const count=Array.isArray(timeline?.events)?timeline.events.length:0;
    const continuation=familyHomeContinuation(timeline);
    setText('[data-family-role]',context.roleLabel);
    setText('[data-family-actor]',context.actorName);
    adminButton.hidden=!context.admin;
    syncLabel.textContent=context.syncLabel;sync.dataset.state=context.synced?'synced':snapshot?.sync?.state||'local';
    const saveAttention=['error','conflict'].includes(sync.dataset.state);
    syncRecovery.hidden=!saveAttention;
    syncRecovery.disabled=snapshot?.sync?.recovering===true;
    syncRecovery.textContent=syncRecovery.disabled?'Checking saved copies…':sync.dataset.state==='conflict'?'Review save conflict':'Retry save';
    subjectBanner.hidden=!context.subject;
    document.body.classList.toggle('family022SubjectActive',Boolean(context.subject));
    if(context.subject){
      setText('[data-family-subject]',plain(context.subject.displayName)||'Selected student');
      setText('.family022SubjectInitials',plain(context.subject.initials)||'ST');
      setText('[data-family-subject-access]',`${context.actorName} · ${context.subject.canEdit===true?'Authorized editing':'Review access'}`);
    }
    diagnostics.hidden=!context.local;
    setText('[data-family-diagnostics]',window.D1_LOCAL_SYNTHETIC_AI?'Registered synthetic fixtures only. Real provider analysis runs after consent. This draft stays on this device.':'This is a local test draft saved on this device. Connected account permissions are unchanged.');
    resume.hidden=false;resume.disabled=!continuation.enabled;
    resume.title=continuation.title;
    resume.dataset.nav=continuation.route;
    resume.className=continuation.enabled?'btnD go family022Continue':'btnD alt family022Continue';
    cv.className=continuation.enabled?'btnD alt family022CV':'btnD go family022CV';
    resume.textContent=continuation.label;
    continuity.hidden=!continuation.enabled;
    contextStatus.textContent=`${count} ${count===1?'event':'events'}${continuation.candidateCount?` · ${continuation.candidateCount} suggestions to review`:''} · ${context.syncLabel.toLowerCase()}`;
    const view=api.bridge.state?.view||'command';
    if(view!==lastFamilyView){
      if(['command','export','admin'].includes(view))node('main').scrollTop=0;
      lastFamilyView=view;
    }
    const adminLanding=context.admin&&!context.subject;
    sync.hidden=adminLanding;
    document.body.classList.toggle('family022SaveAttention',saveAttention&&!adminLanding);
    document.body.classList.toggle('family022AdminLanding',adminLanding);
    adminHomeNav.hidden=!context.admin;adminRosterNav.hidden=!context.admin;
    for(const button of rail.querySelectorAll(':scope > [data-v]'))button.hidden=adminLanding;
    tools.hidden=adminLanding;
    node('#hudExport').hidden=adminLanding;
    if(adminLanding){
      adminHomeNav.classList.toggle('on',view==='admin');
      if(requestedAdminFor!==context.actor.id||view!=='admin'){
        requestedAdminFor=context.actor.id;
        api.bridge.go('admin');
        action('admin-home');
      }
    }else requestedAdminFor='';
    document.body.dataset.familyView=api.bridge.state?.view||view;
    rail.querySelector('[data-v="builder"]').textContent=context.subject?'Student Timeline':'My Timeline';
    tools.classList.toggle('on',secondary.includes(view));
    home.querySelector('.homeIntakeRegion').hidden=true;
  }
  document.addEventListener('d1:407f-rendered',refresh);
  document.addEventListener('d1:timeline-runtime-022-ready',refresh);
  document.addEventListener('d1:prototype-021-ready',refresh);
  refresh();
  const controller=Object.freeze({version:'022.1',refresh,adminHost:node('#timelineAdmin022'),requestAction:action});
  window.D1_FAMILY_022=controller;
  document.dispatchEvent(new CustomEvent('d1:family-022-ready',{detail:{controller}}));
  return controller;
}

if(typeof window!=='undefined' && typeof document!=='undefined'){
  if(!node('link[data-family-022]'))document.head.append(create('link',{rel:'stylesheet',href:new URL('../styles/family-022.css',import.meta.url).href,'data-family-022':''}));
  mountAdminHost();
  showTimelineOpening({reducedMotion:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true});
  if(window.D1_407F_ENGINEERING)installFamily022();
  else document.addEventListener('d1:407f-engineering-ready',()=>installFamily022(),{once:true});
}
