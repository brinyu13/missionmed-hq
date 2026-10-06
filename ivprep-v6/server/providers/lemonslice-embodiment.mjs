// Audio-driven visual Actor only. No agent worker, LLM, TTS, STT or dialogue.
// Official protocol: https://lemonslice.com/docs/websocket (2026-10-04).
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { lookup as lookupIPv4 } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
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
const BOUNDARIES = new Set(['RESERVATION','LIVEKIT','LEMONSLICE_API','AUDIO_TRANSPORT','TRANSPORT_READY']);
const CATEGORIES = new Set(['HQ_AUTH_FAILURE','HQ_VALIDATION_FAILURE','PROVIDER_NETWORK','PROVIDER_DNS','PROVIDER_HTTP_4XX','PROVIDER_HTTP_5XX','PROVIDER_TIMEOUT','PROVIDER_CANCELLED','PROVIDER_RESPONSE_INVALID','LIVEKIT_FAILURE','LIVEKIT_TIMEOUT','AUDIO_TRANSPORT_FAILURE','STARTUP_CANCELLED','STARTUP_FAILED']);
const RESPONSE_REASONS = new Set(['SESSION_ID_INVALID','SOCKET_ADDRESS_MISSING','SOCKET_ADDRESS_MALFORMED','SOCKET_PROTOCOL_REJECTED','SOCKET_CREDENTIALS_REJECTED','SOCKET_HOST_REJECTED','SOCKET_PORT_REJECTED','SOCKET_FRAGMENT_REJECTED','SOCKET_DNS_FAILURE','SOCKET_DNS_TIMEOUT','SOCKET_DNS_NONPUBLIC']);
// DR-394: authenticated provider response observed this Modal sandbox grammar.
// Not a wildcard for Modal hosting. Every connection additionally pins public
// IPv4, retains original Host/SNI + standard TLS, and refuses redirects.
const MODAL_WORKER = /^ta-[a-z0-9]{26}-8888-[a-z0-9]{25}\.w\.modal\.host$/;
const LEMONSLICE_HOST = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*lemonslice\.com$/;
const NONPUBLIC_IPV4 = new BlockList();
for(const [base,prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]])NONPUBLIC_IPV4.addSubnet(base,prefix,'ipv4');
// A public diagnostic is a closed schema, never a raw upstream error/body/URL.
export function publicEmbodimentFailure(value) {
  if(!value || !BOUNDARIES.has(value.boundary) || !CATEGORIES.has(value.category))return null;
  const time=n=>Number.isFinite(n)&&n>=0?Math.round(n):null;
  return {boundary:value.boundary,category:value.category,
    httpStatus:Number.isInteger(value.httpStatus)&&value.httpStatus>=100&&value.httpStatus<=599?value.httpStatus:null,
    startedAtMs:time(value.startedAtMs),finishedAtMs:time(value.finishedAtMs),
    elapsedMs:time(value.elapsedMs),responseClass:['JSON','HTML','TEXT','OTHER','UNKNOWN'].includes(value.responseClass)?value.responseClass:'UNKNOWN',
    ...(RESPONSE_REASONS.has(value.reason)?{reason:value.reason}:{})};
}

// Private server audit identity only. Never retain a signed URL, credentials,
// path/query/hash or raw response. This is evidence, NOT an egress allowlist.
function privateTransportIdentity(value) {
  if(typeof value!=='string'||value.length>8192)return null;
  let url;try{url=new URL(value);}catch{return null;}
  if(!['wss:','ws:','https:','http:'].includes(url.protocol)
    ||url.hostname.length>253||! /^[a-z0-9.-]+$/i.test(url.hostname))return null;
  return {protocol:url.protocol,hostname:url.hostname,port:url.port||null};
}
function providerSocketAddress(value) {
  const rejected=reason=>Object.assign(fail('ivoc_embodiment_transport_invalid',502),{responseInvalid:true,responseReason:reason});
  if(typeof value!=='string'||!value)throw rejected('SOCKET_ADDRESS_MISSING');
  if(value.length>8192)throw rejected('SOCKET_ADDRESS_MALFORMED');
  let url;try{url=new URL(value);}catch{throw rejected('SOCKET_ADDRESS_MALFORMED');}
  if(url.protocol!=='wss:')throw rejected('SOCKET_PROTOCOL_REJECTED');
  if(url.username||url.password)throw rejected('SOCKET_CREDENTIALS_REJECTED');
  if(url.port&&url.port!=='443')throw rejected('SOCKET_PORT_REJECTED');
  if(value.includes('#'))throw rejected('SOCKET_FRAGMENT_REJECTED');
  if(!LEMONSLICE_HOST.test(url.hostname)&&!MODAL_WORKER.test(url.hostname))throw rejected('SOCKET_HOST_REJECTED');
  return url;
}

export function createEmbodimentCanary({env = process.env, fetchImpl = fetch, now = Date.now,
  socketFactory = null, lookupImpl = lookupIPv4, livekitFactory = null, claim, recordReceipt = async () => {},
  setTimer = setTimeout, clearTimer = clearTimeout, timeoutSignal = ms => AbortSignal.timeout(ms)} = {}) {
  const config = embodimentCanaryConfig(env);
  let attempt = null;
  const headers = () => ({'X-API-Key':env.LEMONSLICE_API_KEY, 'Content-Type':'application/json'});
  function stage(a,state,owner,evidence=null) {
    const at=now(),previous=a.transitions.at(-1);
    if(previous&&!previous.completedAtMs){previous.completedAtMs=at;previous.successEvidence=evidence;}
    a.transitions.push({state,owner,startedAtMs:at,completedAtMs:null,entryEvidence:evidence,successEvidence:null,failureEvidence:null,cleanup:'EXACT_SESSION_AND_ROOM'});
  }
  async function pinnedTransportOptions(a,url) {
    const startedAtMs=now(),remaining=a.startedAt+45000-startedAtMs;
    if(a.closed||remaining<=0)throw fail('ivoc_embodiment_stopped');
    const rejected=reason=>Object.assign(fail('ivoc_embodiment_transport_invalid',502),{
      diagnostics:publicEmbodimentFailure({boundary:'AUDIO_TRANSPORT',category:'AUDIO_TRANSPORT_FAILURE',reason,
        startedAtMs,finishedAtMs:now(),elapsedMs:Math.max(0,now()-startedAtMs)})});
    let timer,rows;
    try {
      rows=await Promise.race([
        Promise.resolve().then(()=>lookupImpl(url.hostname,{all:true,family:4,verbatim:true})),
        new Promise((_,reject)=>{timer=setTimer(()=>reject(rejected('SOCKET_DNS_TIMEOUT')),Math.min(3000,remaining));})]);
    }catch(error){throw error?.diagnostics?error:rejected('SOCKET_DNS_FAILURE');}
    finally{clearTimer(timer);}
    // A late DNS result must never resurrect a cancelled/expired reservation.
    if(a.closed||now()>=a.startedAt+45000)throw fail('ivoc_embodiment_stopped');
    // Materialize holes as undefined: Array#some/map alone skip sparse rows.
    const resolved=Array.isArray(rows)?Array.from(rows):[];
    if(!resolved.length||resolved.some(row=>row?.family!==4||typeof row.address!=='string'||isIP(row.address)!==4||NONPUBLIC_IPV4.check(row.address,'ipv4')))
      throw rejected('SOCKET_DNS_NONPUBLIC');
    const addresses=[...new Set(resolved.map(row=>row.address))];
    return {handshakeTimeout:Math.min(5000,a.startedAt+45000-now()),maxPayload:16384,
      followRedirects:false,rejectUnauthorized:true,servername:url.hostname,
      lookup:(hostname,options,callback)=>{
        if(typeof options==='function'){callback=options;options={};}
        if(hostname!==url.hostname||(options?.family!=null&&![0,4].includes(options.family)))return callback(fail('ivoc_embodiment_transport_invalid',502));
        // No system-DNS or IPv6 fallback; opaque path/query stay with provider.
        if(options?.all)return callback(null,addresses.map(address=>({address,family:4})));
        callback(null,addresses[0],4);
      }};
  }
  async function api(path, body, timeoutMs = 5000, responseMetadata = null) {
    const startedAtMs=now();let responseClass='UNKNOWN',httpStatus=null;
    const diagnostic=category=>publicEmbodimentFailure({boundary:'LEMONSLICE_API',category,httpStatus,responseClass,startedAtMs,finishedAtMs:now(),elapsedMs:Math.max(0,now()-startedAtMs)});
    try {
      const response = await fetchImpl(`${LEMONSLICE_API_URL}${path}`, {
        method:body === undefined ? 'GET' : 'POST', redirect:'error', headers:headers(),
        body:body === undefined ? undefined : JSON.stringify(body), signal:timeoutSignal(timeoutMs)});
      httpStatus=response.status;
      const type=response.headers?.get('content-type')||'';
      responseClass=/json/i.test(type)?'JSON':/html/i.test(type)?'HTML':/^text\//i.test(type)?'TEXT':type?'OTHER':'UNKNOWN';
      if (!response.ok) {
        const category=httpStatus>=500?'PROVIDER_HTTP_5XX':'PROVIDER_HTTP_4XX';
        throw Object.assign(fail('ivoc_embodiment_provider_unavailable',502),{diagnostics:diagnostic(category)});
      }
      try{
        const value=await response.json();
        if(responseMetadata)Object.assign(responseMetadata,{httpStatus,responseClass,startedAtMs,finishedAtMs:now(),elapsedMs:Math.max(0,now()-startedAtMs)});
        return value;
      }
      catch(error){
        if(error?.name==='TimeoutError'||error?.name==='AbortError')throw error;
        throw Object.assign(fail('ivoc_embodiment_provider_response_invalid',502),{diagnostics:diagnostic('PROVIDER_RESPONSE_INVALID')});
      }
    }catch(error){
      if(publicEmbodimentFailure(error?.diagnostics))throw error;
      const cause=error?.cause?.code||error?.code;
      const category=error?.name==='TimeoutError'?'PROVIDER_TIMEOUT':error?.name==='AbortError'?'PROVIDER_CANCELLED':['ENOTFOUND','EAI_AGAIN'].includes(cause)?'PROVIDER_DNS':'PROVIDER_NETWORK';
      throw Object.assign(fail('ivoc_embodiment_provider_unavailable',502),{diagnostics:diagnostic(category)});
    }
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
        providerCreateAttempted:a.providerCreateAttempted===true,failure:a.failure||null,transitions:a.transitions};
      await recordReceipt(a.sessionId, {...receipt,transportIdentity:a.transportIdentity||null}).catch(() => {});
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
        samples:0,generation:0,sequence:0,closed:false,playing:false,playback:null,boundary:'RESERVATION',providerCreateAttempted:false,transitions:[]};
      attempt=a; // Never retry, including failed claims or unknown create outcomes.
      a.timer=setTimer(()=>void stop(a,'hard_deadline'),45000);
      stage(a,'EMBODIMENT_CREATE_REQUEST','IVOC_SERVER');
      const createResponseMetadata={};
      try {
        if (typeof claim !== 'function') throw fail('ivoc_embodiment_reservation_unavailable');
        await claim({actor,sessionId,attemptId:a.id,deadlineMs:a.startedAt+45000});
        if (a.closed || now()>=a.startedAt+45000) throw fail('ivoc_embodiment_stopped');
        a.boundary='LIVEKIT';
        stage(a,'LIVEKIT_ROOM_CREATE','IVOC_SERVER','CANONICAL_RESERVATION');
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
        stage(a,'PROVIDER_CREATE_REQUEST','IVOC_SERVER','SCOPED_ROOM_AND_TOKENS');
        const created=await api('',{transport_type:'websocket-livekit',agent_id:LEMONSLICE_AGENT_ID,
          edit_image:false,idle_timeout:15,response_done_timeout:0.4,
          livekit_properties:{livekit_url:env.LIVEKIT_URL,livekit_token:publisherToken,video_codec:'vp8',simulcast:false}},Math.min(EMBODIMENT_CREATE_TIMEOUT_MS,a.startedAt+45000-now()),createResponseMetadata);
        if (!/^[A-Za-z0-9._:-]{1,160}$/.test(created?.session_id || '')) throw Object.assign(fail('ivoc_embodiment_identity_invalid',502),{responseInvalid:true,responseReason:'SESSION_ID_INVALID'});
        a.providerId=created.session_id;
        a.transportIdentity=privateTransportIdentity(created.websocket_address);
        stage(a,'EMBODIMENT_SESSION_CREATED','LEMONSLICE','PROVIDER_ID_RETURNED');
        if (a.closed) {
          // Capture and terminate a late exact ID before inspecting its URL.
          await stop(a,'late_create'); throw fail('ivoc_embodiment_stopped');
        }
        // Do not trust arbitrary provider-returned egress URLs (SSRF/credentials).
        const wsUrl=providerSocketAddress(created.websocket_address);
        a.boundary='AUDIO_TRANSPORT';
        stage(a,'AUDIO_TRANSPORT_CONNECTING','IVOC_SERVER','VALIDATED_PROVIDER_SOCKET');
        const socketOptions=await pinnedTransportOptions(a,wsUrl);
        if(a.closed||now()>=a.startedAt+45000)throw fail('ivoc_embodiment_stopped');
        const WebSocket=socketFactory ? null : require('ws');
        a.socket=socketFactory ? socketFactory(wsUrl.href,socketOptions) : new WebSocket(wsUrl.href,socketOptions);
        a.socket.on('message',data=>{
          let event;try{event=JSON.parse(String(data));}catch{return;}
          if(!event || typeof event!=='object' || Array.isArray(event))return;
          if(event.command==='playback_finished'){
            a.playing=false;a.playback={interrupted:event.interrupted===true,positionSeconds:Number(event.playback_position)||0,observedAtMs:now()};
            if(event.interrupted===true && a.interruptResolve){a.interruptResolve();a.interruptResolve=null;a.interruptReject=null;}
          }
        });
        const transportFailed=reason=>{
          if(a.closed)return;
          const row=a.transitions.at(-1),startedAtMs=row?.startedAtMs??a.startedAt;
          a.failure=publicEmbodimentFailure({boundary:'AUDIO_TRANSPORT',category:'AUDIO_TRANSPORT_FAILURE',startedAtMs,finishedAtMs:now(),elapsedMs:Math.max(0,now()-startedAtMs)});
          if(row){row.completedAtMs=now();row.failureEvidence=a.failure;}
          void stop(a,reason);
        };
        a.socket.on('close',()=>transportFailed('transport_closed'));
        a.socket.on('error',()=>transportFailed('transport_error'));
        await new Promise((resolve,reject)=>{const timer=setTimer(()=>reject(fail('ivoc_embodiment_connect_timeout',502)),socketOptions.handshakeTimeout);a.socket.once('open',()=>{clearTimer(timer);resolve();});a.socket.once('error',()=>{clearTimer(timer);reject(fail('ivoc_embodiment_transport_unavailable',502));});});
        if(a.closed || now()>=a.startedAt+45000)throw fail('ivoc_embodiment_stopped');
        a.boundary='TRANSPORT_READY';
        stage(a,'TRANSPORT_READY','IVOC_SERVER','PROVIDER_SOCKET_OPEN'); // NOT avatar readiness
        return {id:a.id,sessionId,livekitUrl:env.LIVEKIT_URL,viewerToken,room:a.room,
          publisherIdentity:'ivoc-embodiment',deadlineMs:a.startedAt+45000,maxSeconds:45};
      } catch(error) {
        // Stable bounded diagnostics only: no provider URLs, response bodies,
        // tokens or raw exception messages enter status/audit evidence.
        const row=a.transitions.at(-1),startedAtMs=row?.startedAtMs??a.startedAt;
        const category=error?.responseInvalid?'PROVIDER_RESPONSE_INVALID':a.closed?'STARTUP_CANCELLED':a.boundary==='RESERVATION'?(error?.status===403?'HQ_AUTH_FAILURE':'HQ_VALIDATION_FAILURE'):a.boundary==='LIVEKIT'?(error?.name==='TimeoutError'?'LIVEKIT_TIMEOUT':'LIVEKIT_FAILURE'):a.boundary==='AUDIO_TRANSPORT'?'AUDIO_TRANSPORT_FAILURE':'STARTUP_FAILED';
        a.failure=a.failure||publicEmbodimentFailure(error?.diagnostics)||publicEmbodimentFailure(error?.responseInvalid?
          {boundary:'LEMONSLICE_API',category,...createResponseMetadata,reason:error.responseReason}:
          {boundary:a.boundary,category,httpStatus:null,startedAtMs,finishedAtMs:now(),elapsedMs:Math.max(0,now()-startedAtMs)});
        if(row){row.completedAtMs=now();row.failureEvidence=a.failure;}
        const safeError=Object.assign(fail(/^ivoc_embodiment_[a-z_]+$/.test(error?.message||'')?error.message:'ivoc_embodiment_start_failed',Number(error?.status)||502),{diagnostics:a.failure});
        const receipt=await stop(a,'startup_failed');
        if(!receipt.failure){
          receipt.failure=a.failure;receipt.diagnosticUpdate=true;
          await recordReceipt(a.sessionId,{...receipt,transportIdentity:a.transportIdentity||null}).catch(()=>{});
        }
        throw safeError;
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
    status({actor,sessionId,id}){const a=owned(actor,sessionId,id);return {closed:a.closed,boundary:a.boundary,providerCreateAttempted:a.providerCreateAttempted,providerSessionId:a.providerId||null,failure:a.failure||null,transitions:a.transitions,playback:a.playback,stopReceipt:a.stopReceipt||null};},
  });
}
