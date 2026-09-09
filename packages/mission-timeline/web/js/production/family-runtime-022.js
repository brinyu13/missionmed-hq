import {mountTimelineAiSettings,mountFounderStandardsManager} from './ai-settings-022.js';
import {mountTimelineAdminWorkspace,TIMELINE_ADMIN_METRICS_022} from './admin-workspace-022.js';

/** Tab-local presentation state only. Every returned roster remains server-authorized. */
export function createAdminRosterReturn022({storage,principalId,authorized=()=>false,now=Date.now}={}){
  const key=typeof principalId==='string'&&principalId.trim()&&principalId.length<=200?`timeline022:admin-roster:${encodeURIComponent(principalId)}`:null;
  const filters=new Set(['all',...TIMELINE_ADMIN_METRICS_022.map(item=>item.id)]);
  const validView=value=>value&&Object.keys(value).sort().join(',')==='filter,page,query,session'&&
    ['query','session'].every(k=>typeof value[k]==='string'&&value[k].length<=200)&&filters.has(value.filter)&&
    Number.isSafeInteger(value.page)&&value.page>0&&value.page<=10000;
  const remove=()=>{try{if(key)storage()?.removeItem(key);}catch{}};
  function read(){
    if(!key||!authorized())return null;
    try{
      const raw=storage()?.getItem(key);if(!raw)return null;
      if(raw.length>4096)throw Error('presentation bounds');
      const value=JSON.parse(raw),age=now()-value.savedAt;
      if(Object.keys(value).sort().join(',')!=='principalId,returnRequested,savedAt,scrollTop,studentWpId,version,view'||
        value.version!==1||value.principalId!==principalId||!validView(value.view)||
        !Number.isSafeInteger(value.studentWpId)||value.studentWpId<=0||
        typeof value.returnRequested!=='boolean'||!Number.isFinite(value.savedAt)||age<0||age>=2*60*60*1000||
        !Number.isFinite(value.scrollTop)||value.scrollTop<0||value.scrollTop>10000000)throw Error('presentation bounds');
      return value;
    }catch{remove();return null;}
  }
  function write(value){if(!key||!authorized())return false;try{const target=storage();if(!target)return false;target.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
  return Object.freeze({
    remember(view,studentWpId,scrollTop=0){
      if(!validView(view)||!Number.isSafeInteger(studentWpId)||studentWpId<=0||!Number.isFinite(scrollTop)||scrollTop<0||scrollTop>10000000)return false;
      return write({version:1,principalId,savedAt:now(),studentWpId,view:{...view},scrollTop,returnRequested:false});
    },
    requestReturn(studentWpId){const value=read();if(!value||value.studentWpId!==studentWpId)return false;return write({...value,returnRequested:true});},
    takeReturn(){const value=read();if(!value?.returnRequested)return null;remove();return value;}
  });
}

const initials=(name)=>String(name||'').trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'MM';
export function familyRuntimeSnapshot022({runtime,saveStatus,remoteStatus,acknowledgement,online=true}={}){
  if(!runtime)return{mode:'local-fixture',session:{status:'local'},sync:{state:saveStatus==='saving'?'saving':saveStatus==='error'?'error':'local'}};
  const identity=runtime.authClient.bootstrapState;
  const admin=identity?.adminWorkspace===true&&identity.role==='PROGRAM_ADMIN';
  const remote=String(remoteStatus?.syncState||remoteStatus?.state||'');
  let state=!runtime.remotePersistenceAllowed?'local':!online?'offline':({CONFLICT:'conflict',ERROR:'error',SYNC_PENDING:'saving',SYNCING:'saving',OFFLINE:'offline',LOCAL_ONLY:'local'})[remote]||'loading';
  if(runtime.remotePersistenceAllowed&&online&&remote==='SYNCED'&&acknowledgement?.updatedAt)state='synced';
  if(saveStatus==='saving')state='saving';
  if(saveStatus==='error')state='error';
  // A local write/error never masks a known conflict that requires a choice.
  if(runtime.remotePersistenceAllowed&&remote==='CONFLICT')state='conflict';
  return{mode:'production',session:{status:runtime.authClient.locked?'denied':'authenticated',actor:{id:identity.principalId,displayName:identity.displayName,initials:initials(identity.displayName)},capabilities:{adminWorkspace:admin},subject:admin&&runtime.subject?{id:runtime.subject.principalId,displayName:runtime.subject.displayName,initials:initials(runtime.subject.displayName),canEdit:runtime.subject.canEdit===true}:null},sync:{state,acknowledgedAt:state==='synced'?acknowledgement.updatedAt:undefined}};
}

/** Exposes presentation state from the authenticated runtime. Server permissions
 * remain authoritative for every roster, subject, standards, and consent action. */
export function installFamilyRuntime022({runtime,store,bridge,recoverSave,windowObject=window,documentObject=document}={}){
  const listeners=new Set();let acknowledgement=null,generation=0,adminController=null,dialogController=null,dialog=null,destroyed=false,recovering=false;
  const client=runtime?.authClient;
  const mobileNavigation=windowObject.matchMedia?.('(max-width:650px)');
  const rosterPrincipal=client?.bootstrapState?.principalId;
  const rosterAuthorized=()=>!destroyed&&!client?.locked&&client?.bootstrapState?.role==='PROGRAM_ADMIN'&&client.bootstrapState.adminWorkspace===true&&client.bootstrapState.principalId===rosterPrincipal;
  const rosterReturn=createAdminRosterReturn022({storage:()=>windowObject.sessionStorage,principalId:rosterPrincipal,authorized:rosterAuthorized});
  const returningRoster=!runtime?.subject?rosterReturn.takeReturn():null;
  const current=()=>{const snapshot=familyRuntimeSnapshot022({runtime,saveStatus:store.saveStatus,remoteStatus:runtime?.adapter?.getSyncStatus?.(),acknowledgement,online:windowObject.navigator?.onLine!==false});snapshot.sync.recovering=recovering;return snapshot;};
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
    rosterReturn.remember(adminController?.getViewState?.(),id,Number(documentObject.querySelector('main')?.scrollTop)||0);
    const url=new URL(windowObject.location.href);url.searchParams.set('student',String(id));url.hash='';windowObject.location.assign(url.href);
  }
  function exitSubject(){
    const url=new URL(windowObject.location.href);rosterReturn.requestReturn(Number(url.searchParams.get('student')));url.searchParams.delete('student');url.hash='';windowObject.location.assign(url.href);
  }
  function mountAdmin(){
    if(client?.bootstrapState?.adminWorkspace!==true)return;
    const host=documentObject.getElementById('timelineAdmin022');if(!host||adminController)return;
    adminController=mountTimelineAdminWorkspace(host,{authClient:client,initialView:returningRoster?.view,onOpenStudent:navigateToStudent,onError:error=>bridge.toast(String(error?.message||'The roster could not be loaded.'))});
    if(returningRoster)void adminController.ready.then(roster=>{
      if(!roster||!rosterAuthorized()||runtime.subject)return;
      const restore=()=>{
        if(!rosterAuthorized()||runtime.subject||bridge.state.view!=='admin')return;
        const button=host.querySelector(`[data-admin022-open="${returningRoster.studentWpId}"]`),main=documentObject.querySelector('main');
        if(button&&!button.disabled){if(main)main.scrollTop=returningRoster.scrollTop;button.focus({preventScroll:true});}
        else{host.querySelector('[data-admin-roster]')?.scrollIntoView?.({block:'start',behavior:'instant'});host.querySelector('#tl-admin022-roster-title')?.focus?.({preventScroll:true});}
      };
      if(windowObject.requestAnimationFrame)windowObject.requestAnimationFrame(()=>windowObject.requestAnimationFrame(restore));else restore();
    });
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
    // Move the same authorized control; desktop and Admin Home keep their rail.
    const standards=documentObject.getElementById('timelineStandards022');
    const destination=runtime.subject&&mobileNavigation?.matches&&tools?tools:rail;
    if(standards&&standards.parentElement!==destination)destination.append(standards);
  }
  function handleAction(action){
    if(action==='recover-save'){
      if(recovering||client?.locked||typeof recoverSave!=='function'||!['error','conflict'].includes(current().sync.state))return;
      recovering=true;emit();
      return Promise.resolve().then(recoverSave).finally(()=>{recovering=false;refresh();});
    }
    if(action==='ai-settings')return settings('ai');
    if(action==='founder-standards')return settings('standards');
    if(!client?.bootstrapState?.adminWorkspace)return;
    if(runtime.subject)return exitSubject();
    mountAdmin();if(bridge.state.view!=='admin')bridge.go('admin');
    if(action==='admin-home'){const main=documentObject.querySelector('main');if(main)main.scrollTop=0;}
    if(action==='admin-roster')documentObject.getElementById('timelineAdmin022')?.querySelector('[data-admin-roster]')?.scrollIntoView({block:'start'});
  }
  const facade=Object.freeze({getSnapshot:current,subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},handleAction,refresh,destroy(){destroyed=true;generation++;unsubStore?.();unsubClaims?.();adminController?.destroy?.();closeDialog();windowObject.removeEventListener('mission-timeline-sync',refresh);documentObject.removeEventListener('d1:family-022-ready',mountActions);documentObject.removeEventListener('d1:family-022-mounted',mountActions);mobileNavigation?.removeEventListener?.('change',mountActions);listeners.clear();}});
  const unsubStore=store.subscribe(refresh),unsubClaims=client?.subscribeClaims(()=>{mountActions();refresh();});
  windowObject.addEventListener('mission-timeline-sync',refresh);documentObject.addEventListener('d1:family-022-ready',mountActions);documentObject.addEventListener('d1:family-022-mounted',mountActions);
  mobileNavigation?.addEventListener?.('change',mountActions);
  windowObject.D1_TIMELINE_RUNTIME_022=facade;mountActions();refresh();documentObject.dispatchEvent(new CustomEvent('d1:timeline-runtime-022-ready'));
  return facade;
}
