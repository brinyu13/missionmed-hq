import {mountTimelineAiSettings,mountFounderStandardsManager} from './ai-settings-022.js';
import {mountTimelineAdminWorkspace} from './admin-workspace-022.js';

const initials=(name)=>String(name||'').trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'MM';
export function familyRuntimeSnapshot022({runtime,saveStatus,remoteStatus,acknowledgement,online=true}={}){
  if(!runtime)return{mode:'local-fixture',session:{status:'local'},sync:{state:saveStatus==='saving'?'saving':saveStatus==='error'?'error':'local'}};
  const identity=runtime.authClient.bootstrapState;
  const admin=identity?.adminWorkspace===true&&identity.role==='PROGRAM_ADMIN';
  const remote=String(remoteStatus?.syncState||remoteStatus?.state||'');
  let state=!runtime.remotePersistenceAllowed?'local':!online?'offline':({CONFLICT:'conflict',ERROR:'error',SYNC_PENDING:'saving',OFFLINE:'offline',LOCAL_ONLY:'local'})[remote]||'loading';
  if(runtime.remotePersistenceAllowed&&online&&remote==='SYNCED'&&acknowledgement?.updatedAt)state='synced';
  if(saveStatus==='saving')state='saving';
  if(saveStatus==='error')state='error';
  return{mode:'production',session:{status:runtime.authClient.locked?'denied':'authenticated',actor:{id:identity.principalId,displayName:identity.displayName,initials:initials(identity.displayName)},capabilities:{adminWorkspace:admin},subject:admin&&runtime.subject?{id:runtime.subject.principalId,displayName:runtime.subject.displayName,initials:initials(runtime.subject.displayName),canEdit:runtime.subject.canEdit===true}:null},sync:{state,acknowledgedAt:state==='synced'?acknowledgement.updatedAt:undefined}};
}

/** Exposes presentation state from the authenticated runtime. Server permissions
 * remain authoritative for every roster, subject, standards, and consent action. */
export function installFamilyRuntime022({runtime,store,bridge,windowObject=window,documentObject=document}={}){
  const listeners=new Set();let acknowledgement=null,generation=0,adminController=null,dialogController=null,dialog=null,destroyed=false;
  const client=runtime?.authClient;
  const current=()=>familyRuntimeSnapshot022({runtime,saveStatus:store.saveStatus,remoteStatus:runtime?.adapter?.getSyncStatus?.(),acknowledgement,online:windowObject.navigator?.onLine!==false});
  const emit=()=>{if(destroyed)return;const snapshot=current();for(const listener of listeners){try{listener(snapshot);}catch{}}};
  const refresh=async()=>{
    emit();const request=++generation;
    if(runtime?.remotePersistenceAllowed){try{const value=await store.adapter.get('settings',`remote-revision:${store.document.id}`);if(request!==generation||destroyed)return;acknowledgement=value||null;}catch{acknowledgement=null;}}
    emit();
  };
  function closeDialog(){dialogController?.destroy?.();dialogController=null;dialog?.remove();dialog=null;}
  function settings(kind){
    if(!client)return;
    if(kind==='standards'&&client.bootstrapState?.founderStandardsManager!==true)return;
    closeDialog();dialog=documentObject.createElement('dialog');dialog.className='timelineSettings022';dialog.setAttribute('aria-label',kind==='standards'?'Founder Timeline standard':'Timeline AI settings');
    dialog.style.cssText='width:min(820px,calc(100% - 24px));max-height:90vh;padding:22px;border:1px solid #334155;border-radius:20px;background:#0f172a;color:#f8fafc;box-sizing:border-box;';
    const close=documentObject.createElement('button');close.type='button';close.className='btnD alt';close.textContent='Close';close.addEventListener('click',closeDialog);
    const host=documentObject.createElement('div');dialog.append(close,host);dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog();});documentObject.body.append(dialog);
    dialogController=kind==='standards'?mountFounderStandardsManager(host,{authClient:client,onChange:refresh}):mountTimelineAiSettings(host,{authClient:client,onChange:refresh,onClose:closeDialog});
    if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');close.focus();
  }
  function navigateToStudent(student){
    if(client?.bootstrapState?.adminWorkspace!==true)return;
    const id=Number(student?.wpUserId??student?.wp_user_id??student?.id);
    if(!Number.isSafeInteger(id)||id<=0)return;
    const url=new URL(windowObject.location.href);url.searchParams.set('student',String(id));url.hash='';windowObject.location.assign(url.href);
  }
  function exitSubject(){
    const url=new URL(windowObject.location.href);url.searchParams.delete('student');url.hash='';windowObject.location.assign(url.href);
  }
  function mountAdmin(){
    if(client?.bootstrapState?.adminWorkspace!==true)return;
    const host=documentObject.getElementById('timelineAdmin022');if(!host||adminController)return;
    adminController=mountTimelineAdminWorkspace(host,{authClient:client,onOpenStudent:navigateToStudent,onError:error=>bridge.toast(String(error?.message||'The roster could not be loaded.'))});
  }
  function mountActions(){
    mountAdmin();const rail=documentObject.getElementById('rail');if(!rail||!client)return;
    if(client.bootstrapState.role==='STUDENT'&&!documentObject.getElementById('timelineAiSettings022')){
      const button=documentObject.createElement('button');button.id='timelineAiSettings022';button.type='button';button.className='rtab';button.textContent='AI settings';button.addEventListener('click',()=>settings('ai'));rail.append(button);
    }
    const aiButton=documentObject.getElementById('timelineAiSettings022'),tools=rail.querySelector('.family022ToolsList');
    if(aiButton&&tools)tools.append(aiButton);
    if(client.bootstrapState.founderStandardsManager===true&&!documentObject.getElementById('timelineStandards022')){
      const button=documentObject.createElement('button');button.id='timelineStandards022';button.type='button';button.className='rtab';button.textContent='Founder standard';button.addEventListener('click',()=>settings('standards'));rail.append(button);
    }
  }
  function handleAction(action){
    if(action==='ai-settings')return settings('ai');
    if(action==='founder-standards')return settings('standards');
    if(!client?.bootstrapState?.adminWorkspace)return;
    if(runtime.subject)return exitSubject();
    mountAdmin();if(bridge.state.view!=='admin')bridge.go('admin');
    if(action==='admin-home'){const main=documentObject.querySelector('main');if(main)main.scrollTop=0;}
    if(action==='admin-roster')documentObject.getElementById('timelineAdmin022')?.querySelector('[data-admin-roster]')?.scrollIntoView({block:'start'});
  }
  const facade=Object.freeze({getSnapshot:current,subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},handleAction,refresh,destroy(){destroyed=true;generation++;unsubStore?.();unsubClaims?.();adminController?.destroy?.();closeDialog();windowObject.removeEventListener('mission-timeline-sync',refresh);documentObject.removeEventListener('d1:family-022-ready',mountActions);documentObject.removeEventListener('d1:family-022-mounted',mountActions);listeners.clear();}});
  const unsubStore=store.subscribe(refresh),unsubClaims=client?.subscribeClaims(()=>{mountActions();refresh();});
  windowObject.addEventListener('mission-timeline-sync',refresh);documentObject.addEventListener('d1:family-022-ready',mountActions);documentObject.addEventListener('d1:family-022-mounted',mountActions);
  windowObject.D1_TIMELINE_RUNTIME_022=facade;mountActions();refresh();documentObject.dispatchEvent(new CustomEvent('d1:timeline-runtime-022-ready'));
  return facade;
}
