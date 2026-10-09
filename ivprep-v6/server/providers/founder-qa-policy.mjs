import {createEmbodimentCanary,embodimentCanaryConfig,recoverEmbodimentSession} from './lemonslice-embodiment.mjs';
import {verifyQaRelease} from './release-identity.mjs';
const fail=(code,status=409)=>Object.assign(new Error(code),{status});
const UUID=/^[a-f0-9-]{36}$/;
const CREDIT_LIMIT=200,RATE_CEILING=30,CLEANUP_SECONDS=30;
const QA_EXPIRES_AT=Date.parse('2026-10-10T00:00:00Z');
const founder=actor=>{if(actor!=='wp:1')throw fail('ivoc_founder_qa_required',403);};
// Stored policy is operational authority, NOT browser preferences. No endpoint
// may increase its budget, reset attempts, extend expiry or re-enable a kill.
export function createFounderQa({env,db,now=Date.now,claimSession,recordReceipt=async()=>{},
  controllerFactory=createEmbodimentCanary,release=verifyQaRelease({env}),setTimer=setTimeout,clearTimer=clearTimeout,fetchImpl=fetch,recoverSession=recoverEmbodimentSession}={}){
  let local=null,recovering=null;
  const providerConfigured=embodimentCanaryConfig({...env,IVOC_LEMONSLICE_CANARY_ENABLED:'true',IVOC_LEMONSLICE_CANARY_SESSION_ID:'00000000-0000-4000-8000-000000000001',IVOC_LEMONSLICE_CANARY_BUDGET_USD:'1'}).available;
  const configured=env.IVOC_LEMONSLICE_FOUNDER_QA_ENABLED==='true'&&release.ok&&providerConfigured;
  const read=()=>db.single('ivoc_founder_qa?id=eq.1&select=*&limit=1');
  async function change(transform){
    for(let i=0;i<4;i++){
      const row=await read();if(!row)throw fail('ivoc_qa_policy_unavailable',503);
      const state=transform(structuredClone(row.state));
      const saved=await db.update(`ivoc_founder_qa?id=eq.1&revision=eq.${row.revision}&select=*`,{revision:row.revision+1,state});
      if(saved)return saved.state;
    }
    throw fail('ivoc_qa_policy_conflict');
  }
  function budgetValid(s){
    return s?.rateBoundVerified===true&&s.creditsPerMinuteCeiling===RATE_CEILING
      &&Number.isSafeInteger(s.creditLimit)&&s.creditLimit>0&&s.creditLimit<=CREDIT_LIMIT
      &&Number.isSafeInteger(s.budgetSeconds)&&s.budgetSeconds>0&&s.budgetSeconds<=Math.floor(s.creditLimit*60/RATE_CEILING)
      &&Number.isSafeInteger(s.reservedSeconds)&&s.reservedSeconds>=0&&s.reservedSeconds<=s.budgetSeconds
      &&Number.isSafeInteger(s.sessionCount)&&s.sessionCount>=0&&Array.isArray(s.attempts)
      &&Number.isSafeInteger(s.maxSessions)&&s.maxSessions>0&&s.maxSessions<=Math.floor(s.budgetSeconds/(60+CLEANUP_SECONDS))
      &&Number.isFinite(s.expiresAt)&&s.expiresAt<=QA_EXPIRES_AT;
  }
  function availableSeconds(s){
    return budgetValid(s)?Math.max(0,Math.min(1800,s.budgetSeconds-s.reservedSeconds-CLEANUP_SECONDS,
      Math.floor((s.expiresAt-now())/1000)-CLEANUP_SECONDS)):0;
  }
  function admitted(s){
    return configured&&s?.enabled===true&&s.source===release.source&&s.manifestSha256===release.manifestSha256
      &&s.overageOffVerified===true&&Number.isFinite(s.expiresAt)&&s.expiresAt>now()
      &&budgetValid(s)&&s.sessionCount<s.maxSessions&&availableSeconds(s)>=60;
  }
  async function config(){
    await recover().catch(()=>{});
    let state;try{state=(await read())?.state;}catch{}
    return {schema:'ivoc.founder-qa.v1',available:admitted(state)&&!state.active,provider:'lemonslice',
      founderOnly:true,sessionId:null,maxSeconds:availableSeconds(state),maxSessions:1,audioAuthority:'openai-gpt-live-native',
      sourceIntegrity:release.ok,source:release.source||null,
      enabled:configured&&state?.enabled===true,reason:state?.reason||'unavailable',
      usage:{sessionCount:state?.sessionCount||0,maxSessions:state?.maxSessions||0,
        reservedSeconds:state?.reservedSeconds||0,budgetSeconds:state?.budgetSeconds||0,
        creditLimit:state?.creditLimit||0,creditsPerMinuteCeiling:RATE_CEILING,cleanupReserveSeconds:CLEANUP_SECONDS,
        // This is a conservative reservation, NOT a fabricated provider invoice.
        unit:'reserved_wall_seconds',expiresAt:state?.expiresAt||null,
        prepaidCreditsVerified:state?.prepaidCreditsVerified??null,overageOffVerified:state?.overageOffVerified===true},
      active:state?.active?{sessionId:state.active.sessionId,deadlineMs:state.active.deadlineMs}:null};
  }
  async function kill(reason='founder_disabled'){
    let persistenceError;
    try{await change(s=>({...s,enabled:false,reason}));}catch(error){persistenceError=error;}
    // Emergency shutdown must still reach the exact in-memory transport when
    // the policy store is unavailable. Never report a durable kill as proven.
    if(local)await local.manager.command({actor:'wp:1',sessionId:local.sessionId,command:'terminate'});
    else if(!persistenceError)await recover(true);
    if(persistenceError)throw fail('ivoc_qa_disable_unconfirmed',503);
    return config();
  }
  async function recover(force=false){
    if(recovering)return recovering;
    recovering=(async()=>{
      const s=(await read())?.state,a=s?.active;
      if(!a||local?.id===a.id||(!force&&now()-a.lastSeen<=15000&&a.deadlineMs>now()))return;
      // A stale claim is never permission for another CREATE. Kill first,
      // terminate the persisted ID, then verify the exact room is absent.
      await change(next=>({...next,enabled:false,reason:'restart_cleanup_required'}));
      const result=await recoverSession({env,fetchImpl,sessionId:a.sessionId,providerSessionId:a.providerSessionId});
      await receipt(a.sessionId,a.id,result);
    })().finally(()=>{recovering=null;});return recovering;
  }
  async function receipt(sessionId,id,value){
    await change(s=>{
      if(s.active?.sessionId!==sessionId||s.active?.id!==id)return s;
      const clean=value.cleanupConfirmed===true||(value.providerCreateAttempted===false&&value.roomConfirmed===true);
      s.attempts=s.attempts.map(a=>a.sessionId===sessionId?{...a,receipt:value}:a);
      if(clean)s.active=null;
      if(!clean||value.failure){s.enabled=false;s.reason=clean?'provider_failure':'cleanup_unconfirmed';}
      return s;
    });
    await recordReceipt(sessionId,value);
  }
  async function heartbeat({actor,sessionId,id}){
    founder(actor);
    await change(s=>{
      if(!s.enabled||s.expiresAt<=now()||s.active?.sessionId!==sessionId||s.active?.id!==id)throw fail('ivoc_qa_stopped');
      s.active.lastSeen=now();return s;
    });
    return {alive:true};
  }
  function activeAuthorized(s,sessionId,id){
    return configured&&s?.enabled===true&&s.source===release.source&&s.manifestSha256===release.manifestSha256
      &&s.overageOffVerified===true&&s.expiresAt>now()&&s.active?.sessionId===sessionId&&s.active?.id===id
      &&s.active.deadlineMs>now()&&s.active.deadlineMs+CLEANUP_SECONDS*1000<=s.expiresAt&&budgetValid(s);
  }
  async function watch(entry){
    if(local!==entry)return;
    try{
      const s=(await read())?.state;
      const row=await db.single(`ivoc_sessions?id=eq.${entry.sessionId}&owner_subject=eq.wp%3A1&select=state&limit=1`);
      if(!activeAuthorized(s,entry.sessionId,entry.id)||now()-s.active.lastSeen>15000||row?.state!=='active'){
        await entry.manager.command({actor:'wp:1',sessionId:entry.sessionId,command:'terminate'});return;
      }
    }catch{await entry.manager.command({actor:'wp:1',sessionId:entry.sessionId,command:'terminate'}).catch(()=>{});return;}
    entry.timer=setTimer(()=>void watch(entry),3000);entry.timer?.unref?.();
  }
  async function start({actor,sessionId}){
    founder(actor);if(!UUID.test(sessionId||''))throw fail('ivoc_qa_session_invalid',400);
    await recover();
    const row=await db.single(`ivoc_sessions?id=eq.${sessionId}&owner_subject=eq.wp%3A1&select=*&limit=1`);
    if(row?.owner_subject!=='wp:1'||row.session_type!=='mock'||row.state!=='active'||row.recording_enabled!==true
      ||row.interviewer_provider!=='openai-gpt-live'||row.context?.embodimentCanary!==true)throw fail('ivoc_qa_session_invalid',403);
    const seconds=row.context.embodimentDurationSeconds;
    if(!Number.isSafeInteger(seconds)||seconds<60||seconds>1800)throw fail('ivoc_qa_duration_invalid',400);
    const manager=controllerFactory({env,fetchImpl,now,
      configOverride:{...embodimentCanaryConfig({...env,IVOC_LEMONSLICE_CANARY_ENABLED:'true',IVOC_LEMONSLICE_CANARY_SESSION_ID:sessionId,IVOC_LEMONSLICE_CANARY_BUDGET_USD:'1'}),maxSeconds:seconds},
      claim:async({attemptId,deadlineMs})=>{
        entry.id=attemptId;
        await change(s=>{
          if(!admitted(s)||s.active||s.attempts.some(a=>a.sessionId===sessionId)||seconds>availableSeconds(s)
            ||deadlineMs+CLEANUP_SECONDS*1000>s.expiresAt)throw fail('ivoc_qa_admission_closed',403);
          s.reservedSeconds+=seconds+CLEANUP_SECONDS;s.sessionCount++;
          s.active={id:attemptId,sessionId,deadlineMs,lastSeen:now(),providerSessionId:null,room:`ivoc-embodiment-${sessionId}`};
          s.attempts.push({...s.active,reservedSeconds:seconds+CLEANUP_SECONDS});return s;
        });
        local=entry;
        await claimSession({actor,sessionId,attemptId,deadlineMs});
      },
      beforeProviderCreate:async()=>{
        if(!activeAuthorized((await read())?.state,sessionId,entry.id))throw fail('ivoc_qa_stopped');
      },
      onProviderCreated:async({providerSessionId})=>{
        const state=await change(s=>{if(s.active?.sessionId!==sessionId||s.active?.id!==entry.id)throw fail('ivoc_qa_reservation_lost');s.active.providerSessionId=providerSessionId;return s;});
        // Capture a late exact ID before denying continuation after a kill.
        if(!activeAuthorized(state,sessionId,entry.id))throw fail('ivoc_qa_stopped');
      },
      recordReceipt:async(id,value)=>{clearTimer(entry.timer);await receipt(id,entry.id,value);},
    });
    const entry={manager,sessionId,id:null,timer:null};
    // CAS in claim is the cross-process authority; local is only the transport.
    try{const ticket=await manager.start({actor,sessionId});local=entry;
      await heartbeat({actor,sessionId,id:ticket.id});
      entry.timer=setTimer(()=>void watch(entry),3000);entry.timer?.unref?.();return {...ticket,founderQa:true};
    }catch(error){await manager.command({actor,sessionId,command:'terminate'}).catch(()=>{});throw error;}
  }
  function owned(input){founder(input.actor);if(local?.sessionId!==input.sessionId)throw fail('not_found',404);return local;}
  // Cleanup-only boot backstop, including a process restart with no browser.
  // No automatic create, no paid retry, no policy rearm.
  const recoveryTimer=setTimer(()=>void recover().catch(()=>{}),16000);recoveryTimer?.unref?.();
  return {config,start,heartbeat,kill,recover,
    command:input=>owned(input).manager.command(input),status:input=>owned(input).manager.status(input)};
}
