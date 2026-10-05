// Audio-driven visual Actor only. No agent worker, LLM, TTS, STT or dialogue.
// Official protocol: https://lemonslice.com/docs/websocket (2026-10-04).
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { LEMONSLICE_API_URL, LEMONSLICE_AGENT_ID, LEMONSLICE_TERMINAL_STATUSES } from './lemonslice-avatar-adapter.mjs';
const require = createRequire(new URL('../../package.json', import.meta.url));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const EMBODIMENT_SECONDS = 45;
export const EMBODIMENT_BUDGET_USD = 1;
export const EMBODIMENT_CREATE_TIMEOUT_MS = 15000;
export function embodimentCanaryConfig(env = {}) {
  const configured = env.IVOC_LEMONSLICE_CANARY_ENABLED === 'true'
    && UUID.test(env.IVOC_LEMONSLICE_CANARY_SESSION_ID || '')
    && Number(env.IVOC_LEMONSLICE_CANARY_BUDGET_USD) >= EMBODIMENT_BUDGET_USD
    && Number(env.IVOC_LEMONSLICE_CANARY_BUDGET_USD) <= EMBODIMENT_BUDGET_USD
    && Boolean(env.LEMONSLICE_API_KEY && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET)
    && /^wss:\/\/[A-Za-z0-9.-]+(?::443)?\/?$/.test(env.LIVEKIT_URL || '');
  return Object.freeze({ schema:'ivoc.embodiment-canary.v1', available:configured,
    provider:'lemonslice', agentId:LEMONSLICE_AGENT_ID, maxSeconds:EMBODIMENT_SECONDS,
    maxSessions:1, maxSpendUsd:EMBODIMENT_BUDGET_USD, audioAuthority:'openai-gpt-live-native',
    transport:'websocket-livekit', sessionId:configured ? env.IVOC_LEMONSLICE_CANARY_SESSION_ID : null });
}
const fail = (code, status = 409) => Object.assign(new Error(code), {status});

export function createEmbodimentCanary({env = process.env, fetchImpl = fetch, now = Date.now,
  socketFactory = null, livekitFactory = null, claim, recordReceipt = async () => {},
  setTimer = setTimeout, clearTimer = clearTimeout, timeoutSignal = ms => AbortSignal.timeout(ms)} = {}) {
  const config = embodimentCanaryConfig(env);
  let attempt = null;
  const headers = () => ({'X-API-Key':env.LEMONSLICE_API_KEY, 'Content-Type':'application/json'});
  async function api(path, body, timeoutMs = 5000) {
    const response = await fetchImpl(`${LEMONSLICE_API_URL}${path}`, {
      method:body === undefined ? 'GET' : 'POST', redirect:'error', headers:headers(),
      body:body === undefined ? undefined : JSON.stringify(body), signal:timeoutSignal(timeoutMs)});
    if (!response.ok) throw fail('ivoc_embodiment_provider_unavailable',502);
    return response.json();
  }
  function owned(actor, sessionId, id) {
    if (!attempt || actor !== 'wp:1' || attempt.actor !== actor || attempt.sessionId !== sessionId
      || (id != null && attempt.id !== id)) throw fail('not_found',404);
    return attempt;
  }
  function send(a, value) {
    if (a.closed || !a.socket || a.socket.readyState !== 1 || a.socket.bufferedAmount > 65536)
      throw fail('ivoc_embodiment_transport_unavailable',502);
    a.socket.send(JSON.stringify(value));
  }
  async function stop(a, reason) {
    if (!a) return {stopped:true, providerConfirmed:false};
    if (a.stopping && a.stopProviderId===(a.providerId||null)) return a.stopping;
    a.stopProviderId=a.providerId||null;
    // Invalidate synchronously. A late create response is still terminated below.
    a.closed = true; clearTimer(a.timer); a.interruptReject?.(fail('ivoc_embodiment_stopped'));
    a.interruptReject = null; a.interruptResolve = null;
    a.stopping = (async () => {
      let providerConfirmed = false;
      if (a.socket?.readyState === 1) {
        try { a.socket.send(JSON.stringify({command:'interrupt'})); a.socket.send(JSON.stringify({command:'terminate'})); } catch {}
      }
      try { a.socket?.close(); } catch {}
      if (a.providerId) {
        try {
          const result = await api(`/${encodeURIComponent(a.providerId)}/control`,{event:'terminate'});
          const status = await api(`/${encodeURIComponent(a.providerId)}`);
          providerConfirmed = result.success === true && LEMONSLICE_TERMINAL_STATUSES.has(String(status.session_status || '').toUpperCase());
        } catch { /* Never retry paid creation; documented 15s idle timeout remains. */ }
      }
      try { await a.livekit?.deleteRoom(a.room); } catch {}
      const receipt = {stopped:true, providerConfirmed, reason, providerSessionId:a.providerId || null,
        requestedAtMs:a.startedAt, stoppedAtMs:now(), inputSeconds:a.samples / 16000,
        providerCreateAttempted:a.providerCreateAttempted===true,failure:a.failure||null};
      await recordReceipt(a.sessionId, receipt).catch(() => {});
      a.stopReceipt=receipt;
      return receipt;
    })();
    return a.stopping;
  }
  return Object.freeze({config,
    async start({actor, sessionId}) {
      if (!config.available || actor !== 'wp:1' || sessionId !== config.sessionId) throw fail('ivoc_embodiment_canary_not_authorized',403);
      if (attempt) throw fail('ivoc_embodiment_canary_consumed');
      const a = {actor,sessionId,id:randomUUID(),room:`ivoc-embodiment-${sessionId}`,startedAt:now(),
        samples:0,generation:0,sequence:0,closed:false,playing:false,playback:null,boundary:'RESERVATION',providerCreateAttempted:false};
      attempt=a; // Never retry, including failed claims or unknown create outcomes.
      a.timer=setTimer(()=>void stop(a,'hard_deadline'),45000);
      try {
        if (typeof claim !== 'function') throw fail('ivoc_embodiment_reservation_unavailable');
        await claim({actor,sessionId,attemptId:a.id,deadlineMs:a.startedAt+45000});
        if (a.closed || now()>=a.startedAt+45000) throw fail('ivoc_embodiment_stopped');
        a.boundary='LIVEKIT';
        const sdk=livekitFactory ? await livekitFactory() : require('livekit-server-sdk');
        a.livekit = sdk.roomService || new sdk.RoomServiceClient(env.LIVEKIT_URL.replace(/^wss:/,'https:'),env.LIVEKIT_API_KEY,env.LIVEKIT_API_SECRET);
        await a.livekit.createRoom({name:a.room,emptyTimeout:15,maxParticipants:2});
        if(a.closed || now()>=a.startedAt+45000){
          // stop may have deleted before this in-flight create completed. Its
          // memoized provider cleanup cannot stand in for deleting a late room.
          await a.livekit.deleteRoom(a.room).catch(()=>{});
          throw fail('ivoc_embodiment_stopped');
        }
        const token = async (identity, publish) => {
          const t=new sdk.AccessToken(env.LIVEKIT_API_KEY,env.LIVEKIT_API_SECRET,{identity,ttl:60});
          t.addGrant({roomJoin:true,room:a.room,canPublish:publish,canSubscribe:!publish,canPublishData:false,canUpdateOwnMetadata:false});
          return t.toJwt();
        };
        const publisherToken=await token('ivoc-embodiment',true), viewerToken=await token('ivoc-founder-viewer',false);
        if (a.closed || now()>=a.startedAt+45000) throw fail('ivoc_embodiment_stopped');
        a.boundary='LEMONSLICE_API';a.providerCreateAttempted=true;
        const created=await api('',{transport_type:'websocket-livekit',agent_id:LEMONSLICE_AGENT_ID,
          edit_image:false,idle_timeout:15,response_done_timeout:0.4,
          livekit_properties:{livekit_url:env.LIVEKIT_URL,livekit_token:publisherToken,video_codec:'vp8',simulcast:false}},Math.min(EMBODIMENT_CREATE_TIMEOUT_MS,a.startedAt+45000-now()));
        if (!/^[A-Za-z0-9._:-]{1,160}$/.test(created.session_id || '')) throw fail('ivoc_embodiment_identity_invalid',502);
        a.providerId=created.session_id;
        if (a.closed) {
          // Capture and terminate a late exact ID before inspecting its URL.
          await stop(a,'late_create'); throw fail('ivoc_embodiment_stopped');
        }
        // Do not trust arbitrary provider-returned egress URLs (SSRF/credentials).
        const wsUrl=new URL(created.websocket_address);
        if (wsUrl.protocol!=='wss:' || wsUrl.username || wsUrl.password || !(wsUrl.hostname==='lemonslice.com'||wsUrl.hostname.endsWith('.lemonslice.com'))) throw fail('ivoc_embodiment_transport_invalid',502);
        a.boundary='AUDIO_TRANSPORT';
        const WebSocket=socketFactory ? null : require('ws');
        a.socket=socketFactory ? socketFactory(wsUrl.href) : new WebSocket(wsUrl.href,{handshakeTimeout:5000,maxPayload:16384});
        a.socket.on('message',data=>{
          let event;try{event=JSON.parse(String(data));}catch{return;}
          if(event.command==='playback_finished'){
            a.playing=false;a.playback={interrupted:event.interrupted===true,positionSeconds:Number(event.playback_position)||0,observedAtMs:now()};
            if(event.interrupted===true && a.interruptResolve){a.interruptResolve();a.interruptResolve=null;a.interruptReject=null;}
          }
        });
        a.socket.on('close',()=>{if(!a.closed)void stop(a,'transport_closed');});
        a.socket.on('error',()=>{if(!a.closed)void stop(a,'transport_error');});
        await new Promise((resolve,reject)=>{const timer=setTimer(()=>reject(fail('ivoc_embodiment_connect_timeout',502)),5000);a.socket.once('open',()=>{clearTimer(timer);resolve();});a.socket.once('error',()=>{clearTimer(timer);reject(fail('ivoc_embodiment_transport_unavailable',502));});});
        if(a.closed || now()>=a.startedAt+45000)throw fail('ivoc_embodiment_stopped');
        a.boundary='READY';
        return {id:a.id,sessionId,livekitUrl:env.LIVEKIT_URL,viewerToken,room:a.room,
          publisherIdentity:'ivoc-embodiment',deadlineMs:a.startedAt+45000,maxSeconds:45};
      } catch(error) {
        // Stable bounded diagnostics only: no provider URLs, response bodies,
        // tokens or raw exception messages enter status/audit evidence.
        const code=['TimeoutError','AbortError'].includes(error?.name)?'TIMEOUT':/^ivoc_embodiment_[a-z_]+$/.test(error?.message||'')?error.message:'STARTUP_FAILED';
        a.failure={boundary:a.boundary,code,httpStatus:Number(error?.status)||null};
        await stop(a,'startup_failed');throw error;
      }
    },
    async command({actor,sessionId,id,generation,sequence,command,audio}) {
      const a=owned(actor,sessionId,id);
      if(command==='terminate')return stop(a,'user_finished');
      if(a.closed || now()>=a.startedAt+45000)throw fail('ivoc_embodiment_stopped');
      if(a.flushing)throw fail('ivoc_embodiment_flush_pending');
      if(!Number.isSafeInteger(generation)||generation<1||!Number.isSafeInteger(sequence)||sequence<1)throw fail('ivoc_embodiment_frame_invalid',400);
      if(command==='interrupt'){
        if(generation<=a.generation)throw fail('ivoc_embodiment_stale_generation');
        a.generation=generation;a.sequence=sequence;
        a.flushing=true;
        const waiting=a.playing;
        const receipt=waiting?new Promise((resolve,reject)=>{a.interruptResolve=resolve;a.interruptReject=reject;}):Promise.resolve();
        send(a,{command:'interrupt'});
        try{await Promise.race([receipt,new Promise((_,reject)=>{a.interruptTimer=setTimer(()=>reject(fail('ivoc_embodiment_flush_unconfirmed',502)),1500);})]);}
        catch(error){await stop(a,'flush_unconfirmed');throw error;}
        finally{clearTimer(a.interruptTimer);a.interruptResolve=null;a.interruptReject=null;a.flushing=false;}
        return {flushed:true,generation};
      }
      if(generation!==Math.max(1,a.generation) || sequence<=a.sequence)throw fail('ivoc_embodiment_stale_frame');
      if(command==='audio'){
        if(typeof audio!=='string'||audio.length>13700||!/^[A-Za-z0-9+/]+={0,2}$/.test(audio))throw fail('ivoc_embodiment_frame_invalid',400);
        const bytes=Buffer.from(audio,'base64');
        if(bytes.length===0||bytes.length%2||bytes.length>9600)throw fail('ivoc_embodiment_frame_invalid',400);
        a.samples+=bytes.length/2;
        if(a.samples>45*16000){await stop(a,'input_budget');throw fail('ivoc_embodiment_input_limit');}
        // HTTP batches contain up to 3 documented 80ms frames. Provider receives
        // small PCM chunks, never an unbounded buffered utterance.
        for(let offset=0;offset<bytes.length;offset+=2560)send(a,{command:'audio',audio:bytes.subarray(offset,offset+2560).toString('base64'),sampleRate:16000,encoding:'PCM16'});
        a.playing=true;
      }else if(command==='audio_end')send(a,{command:'audio_end'});
      else throw fail('ivoc_embodiment_command_invalid',400);
      a.sequence=sequence;a.generation=generation;
      return {accepted:true,generation,sequence};
    },
    status({actor,sessionId,id}){const a=owned(actor,sessionId,id);return {closed:a.closed,boundary:a.boundary,providerCreateAttempted:a.providerCreateAttempted,providerSessionId:a.providerId||null,failure:a.failure||null,playback:a.playback,stopReceipt:a.stopReceipt||null};},
  });
}
