// EmbodimentRenderer: visual Actor + synchronized transport of GPT-Live audio.
// Never a Director. Exactly one stable, gated stream feeds playback AND recording.
const API='/api/ivoc/v1/admin/embodiment-canary';
export const EMBODIMENT_START_TIMEOUT_MS=30000;
const stageError=(category,boundary)=>Object.assign(new Error(`ivoc_embodiment_${category.toLowerCase()}`),{diagnostics:{category,boundary}});
// Recover the historical decoded-frame gate, with explicit cancellation. Track
// subscription/DOM/transport alone is never visual readiness. No provider call.
export function decodedAvatarFrame(video,{timeoutMs=10000,signal}={}){
  return new Promise((resolve,reject)=>{
    let settled=false,callback=null;
    const clean=()=>{clearTimeout(timer);if(callback!=null)video.cancelVideoFrameCallback?.(callback);video.removeEventListener('error',failed);video.removeEventListener('playing',fallback);signal?.removeEventListener('abort',cancelled);};
    const finish=(error,evidence)=>{if(settled)return;settled=true;clean();error?reject(error):resolve(evidence);};
    const failed=()=>finish(stageError('DECODED_FRAME_FAILURE','AVATAR_DECODING'));
    const cancelled=()=>finish(stageError('CLIENT_ABORT','AVATAR_DECODING'));
    const valid=()=>video.readyState>=2&&video.videoWidth>0&&video.videoHeight>0&&!video.paused;
    const fallback=()=>{if(valid())finish(null,{signal:'PLAYING_WITH_CURRENT_FRAME',width:video.videoWidth,height:video.videoHeight});};
    const timer=setTimeout(failed,Math.max(1,timeoutMs));
    video.addEventListener('error',failed,{once:true});signal?.addEventListener('abort',cancelled,{once:true});
    if(signal?.aborted){cancelled();return;}
    if(typeof video.requestVideoFrameCallback==='function'){
      const frame=(at,metadata)=>{if(valid()&&metadata?.presentedFrames>0){finish(null,{signal:'REQUEST_VIDEO_FRAME_CALLBACK',width:video.videoWidth,height:video.videoHeight});}else if(!settled)callback=video.requestVideoFrameCallback(frame);};
      callback=video.requestVideoFrameCallback(frame);
    }else video.addEventListener('playing',fallback);
    Promise.resolve().then(()=>{if(!settled)return video.play();}).then(()=>{if(!settled&&typeof video.requestVideoFrameCallback!=='function')fallback();}).catch(failed);
  });
}
export class PcmBatcher {
  constructor(emit){this.emit=emit;this.parts=[];}
  push(bytes){this.parts.push(new Uint8Array(bytes));if(this.parts.length===3)this.flush();}
  flush(){if(!this.parts.length)return;const bytes=new Uint8Array(this.parts.reduce((n,p)=>n+p.length,0));let at=0;for(const part of this.parts){bytes.set(part,at);at+=part.length;}this.parts=[];this.emit(bytes.buffer);}
  clear(){this.parts=[];}
}
export class EmbodimentCommandQueue {
  constructor(send,{maxQueued=6,onFailure=()=>{}}={}){this.send=send;this.max=maxQueued;this.onFailure=onFailure;this.generation=1;this.sequence=0;this.pending=[];this.sending=false;this.closed=false;}
  push(command,payload={}){
    if(this.closed)return Promise.reject(new Error('Avatar transport stopped.'));
    if(this.pending.length>=this.max){this.close();this.onFailure(new Error('Avatar transport fell behind. Finish and save this attempt.'));return Promise.reject(new Error('Avatar queue limit.'));}
    return new Promise((resolve,reject)=>{this.pending.push({command,...payload,generation:this.generation,sequence:++this.sequence,resolve,reject});void this.drain();});
  }
  async drain(){
    if(this.sending)return;this.sending=true;
    try{while(this.pending.length&&!this.closed){const item=this.pending.shift();
      try{const result=await this.send(item);item.resolve(result);}catch(error){item.reject(error);if(!this.closed&&item.generation===this.generation){this.close();this.onFailure(error);}}
    }}finally{this.sending=false;}
  }
  interrupt(){
    if(this.closed)return Promise.reject(new Error('Avatar transport stopped.'));
    ++this.generation;
    for(const item of this.pending.splice(0))item.resolve({discarded:true});
    return this.push('interrupt'); // serialized after in-flight old frame; never replay it
  }
  close(){this.closed=true;for(const item of this.pending.splice(0))item.resolve({discarded:true});}
}
async function loadLiveKit(){
  if(window.LivekitClient)return window.LivekitClient;
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/iv-prep-on-call/assets/vendor/livekit-client.umd.js';script.onload=resolve;script.onerror=()=>reject(new Error('Avatar video transport could not load.'));document.head.append(script);});
  if(!window.LivekitClient?.Room)throw new Error('Avatar video transport unavailable.');
  return window.LivekitClient;
}
const encode=buffer=>{const bytes=new Uint8Array(buffer);let text='';for(const byte of bytes)text+=String.fromCharCode(byte);return btoa(text);};
export class EmbodimentRenderer {
  constructor({host,csrfToken,sessionId,AudioContextCtor=window.AudioContext,AudioWorkletNodeCtor=globalThis.AudioWorkletNode,loadSdk=loadLiveKit,fetchImpl=fetch,timeoutSignal=ms=>AbortSignal.timeout(ms),onFailure=()=>{}}={}){
    this.host=host;this.csrfToken=csrfToken;this.sessionId=sessionId;this.AC=AudioContextCtor;this.loadSdk=loadSdk;this.fetch=fetchImpl.bind(globalThis);this.onFailure=onFailure;
    this.closed=false;this.generation=0;this.sequence=0;this.ticket=null;this.cleanup=null;this.sources=[];this.holds=false;this.speaking=false;this.silentMs=0;
    this.timeoutSignal=timeoutSignal;this.Worklet=AudioWorkletNodeCtor;this.startRequested=false;this.pcmGeneration=1;
    this.transitions=[];this.failure=null;this.decodeAbort=new AbortController();
    this.visualReady=new Promise((resolve,reject)=>{this.visualResolve=resolve;this.visualReject=reject;});this.visualReady.catch(()=>{});
    this.transition('IVOC_READY','IVOC_CLIENT','RENDERER_INITIALIZED');
  }
  transition(state,owner='IVOC_CLIENT',evidence=null){
    const at=Date.now(),previous=this.transitions.at(-1);
    if(previous&&previous.state===state)return;
    if(previous&&previous.completedAtMs==null){previous.completedAtMs=at;previous.successEvidence=evidence;}
    this.transitions.push({state,owner,startedAtMs:at,completedAtMs:null,entryEvidence:evidence,successEvidence:null,failureEvidence:null,cleanup:'EXACT_SESSION_ROOM_AND_MEDIA'});
  }
  diagnostics(){return {state:this.transitions.at(-1)?.state||null,visualReady:this.visible===true,audioBound:this.returnAudioBound===true,transitions:this.transitions,failure:this.failure};}
  waitForVisualReady(){return this.visualReady;}
  async api(command,body=null,{keepalive=false}={}){
    const startedAtMs=Date.now();let response;
    try{response=await this.fetch(API+command,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',redirect:'error',keepalive,
      headers:{Accept:'application/json',...(body?{'Content-Type':'application/json','X-MMHQ-CSRF':this.csrfToken}:{})},
      body:body?JSON.stringify(body):undefined,signal:keepalive?undefined:this.timeoutSignal(command==='/start'?EMBODIMENT_START_TIMEOUT_MS:5000)});}
    catch(error){const category=error?.name==='TimeoutError'?'CLIENT_TIMEOUT':error?.name==='AbortError'?'CLIENT_ABORT':'CLIENT_NETWORK';throw Object.assign(stageError(category,'IVOC_CLIENT'),{diagnostics:{category,boundary:'IVOC_CLIENT',startedAtMs,elapsedMs:Date.now()-startedAtMs}});}
    let result;
    try{result=await response.json();}
    catch(error){
      const category=error?.name==='TimeoutError'?'CLIENT_TIMEOUT':error?.name==='AbortError'?'CLIENT_ABORT':'HQ_RESPONSE_INVALID';
      throw Object.assign(stageError(category,'IVOC_CLIENT'),{diagnostics:{category,boundary:'IVOC_CLIENT',httpStatus:response.status,startedAtMs,elapsedMs:Date.now()-startedAtMs}});
    }
    if(!response.ok){const category=[401,403].includes(response.status)?'HQ_AUTH_FAILURE':response.status<500?'HQ_VALIDATION_FAILURE':'HQ_FAILURE';
      throw Object.assign(stageError(category,'IVOC_SERVER'),{diagnostics:result.diagnostics||{category,boundary:'IVOC_SERVER',httpStatus:response.status,startedAtMs,elapsedMs:Date.now()-startedAtMs}});}
    return result;
  }
  fail(error){if(this.closed)return;this.failure=error?.diagnostics||{category:'STARTUP_FAILED',boundary:this.transitions.at(-1)?.state};const row=this.transitions.at(-1);if(row){row.completedAtMs=Date.now();row.failureEvidence=this.failure;}this.visualReject(error);this.onFailure(error);void this.stop();}
  async render(stream,{microphoneTrack,ivocSessionId}={}){
    if(this.closed)throw stageError('CLIENT_ABORT','IVOC_CLIENT');
    if(ivocSessionId!==this.sessionId)throw new Error('Avatar canonical session identity changed.');
    const generation=++this.generation,current=()=>!this.closed&&this.generation===generation;
    if(this.context)throw new Error('Only one avatar playback authority is permitted.');
    try{
    this.context=new this.AC({sampleRate:16000});if(this.context.sampleRate!==16000)throw new Error('This browser cannot supply the required avatar audio format.');
    await this.context.resume();
    if(!current())throw stageError('CLIENT_ABORT','IVOC_CLIENT');
    this.destination=this.context.createMediaStreamDestination();
    this.gain=this.context.createGain();this.gain.gain.value=1;this.gain.connect(this.destination); // NOT context.destination
    // Stable silent output exists before opening: avoids a speech/startup deadlock.
    const output=this.destination.stream;
    let sdk;try{sdk=await this.loadSdk();}catch{throw stageError('LIVEKIT_FAILURE','SDK_LOAD');}if(!current())throw stageError('CLIENT_ABORT','IVOC_CLIENT');
    this.transition('EMBODIMENT_CREATE_REQUEST','IVOC_CLIENT','GPT_REMOTE_TRACK_AND_SDK_READY');
    this.startRequested=true;
    this.ticket=await this.api('/start',{sessionId:this.sessionId});
    if(!current()){await this.stop({late:true});throw new Error('Avatar startup cancelled.');}
    this.transition('EMBODIMENT_SESSION_CREATED','IVOC_SERVER','EXACT_TICKET_RETURNED');
    this.deadline=setTimeout(()=>this.fail(new Error('Avatar canary reached its 45-second limit. Finish and save.')),Math.max(0,this.ticket.deadlineMs-Date.now()));
    this.room=new sdk.Room({adaptiveStream:false,dynacast:false,reconnectPolicy:{nextRetryDelayInMs:()=>null}});
    this.queue=new EmbodimentCommandQueue(item=>{
      const {resolve,reject,...body}=item;return this.api('/command',{sessionId:this.sessionId,id:this.ticket.id,...body});
    },{onFailure:error=>this.fail(error)});
    let audio=false,video=false;
    const maybeReady=()=>{if(!current()||!audio||!this.visible||!this.inputBound)return;clearTimeout(this.joinTimer);this.host.dataset.avatarState='live';this.transition('EMBODIMENT_READY','IVOC_CLIENT','DECODED_FRAME_AND_SINGLE_AUDIO_GRAPH');};
    // One absolute reservation deadline still bounds every media phase. Avatar
    // audio may appear only after PCM; it is not a prerequisite for first speech.
    this.joinTimer=setTimeout(()=>this.fail(stageError(!video?'TRACK_SUBSCRIPTION_FAILURE':!this.visible?'DECODED_FRAME_FAILURE':'AUDIO_BIND_FAILURE',!video?'LIVEKIT_CONNECTED':!this.visible?'AVATAR_DECODING':'AUDIO_BINDING')),Math.max(1,Math.min(15000,this.ticket.deadlineMs-Date.now())));
    this.room.on(sdk.RoomEvent.TrackSubscribed,(track,publication,participant)=>{
        if(!current()||participant.identity!==this.ticket.publisherIdentity)return;
        try{
        if(this.transitions.at(-1)?.state==='LIVEKIT_CONNECTING')this.transition('LIVEKIT_CONNECTED','LIVEKIT_CLIENT','EXACT_PUBLISHER_TRACK_RECEIVED');
        const raw=track.mediaStreamTrack;if(!raw)return;
        if(track.kind==='audio'){
          if(audio){this.fail(new Error('Surplus avatar audio rejected.'));return;}
          audio=true;const source=this.context.createMediaStreamSource(new MediaStream([raw]));this.sources.push(source);source.connect(this.gain);
          this.returnAudioBound=true;maybeReady();
          // Do not call track.attach() or Room.startAudio(): our original single
          // interviewer audio element owns playback of this exact output stream.
        }else if(track.kind==='video'){
          if(video){this.fail(new Error('Surplus avatar video rejected.'));return;}
          video=true;this.video=document.createElement('video');this.video.autoplay=true;this.video.playsInline=true;this.video.muted=true;
          this.video.setAttribute('aria-label','AI interviewer avatar');this.video.srcObject=new MediaStream([raw]);
          this.host.replaceChildren(this.video);this.host.dataset.avatarState='decoding';this.transition('AVATAR_DECODING','BROWSER_MEDIA','EXACT_VIDEO_TRACK_SUBSCRIBED');
          void decodedAvatarFrame(this.video,{timeoutMs:Math.max(1,Math.min(10000,this.ticket.deadlineMs-Date.now())),signal:this.decodeAbort.signal}).then(evidence=>{
            if(!current())return;this.visible=true;this.host.dataset.avatarState='visible';this.transition('AVATAR_VISIBLE','BROWSER_MEDIA',evidence.signal);
            this.transition('AUDIO_BINDING','IVOC_CLIENT','DECODED_FRAME');this.visualResolve(evidence);maybeReady();
          }).catch(error=>{if(current())this.fail(error);});
        }
        }catch{this.fail(stageError(track.kind==='audio'?'AUDIO_BIND_FAILURE':'TRACK_SUBSCRIPTION_FAILURE','LIVEKIT_CONNECTED'));}
      });
    this.room.on(sdk.RoomEvent.Disconnected,()=>{if(current())this.fail(stageError('LIVEKIT_FAILURE','LIVEKIT_CONNECTED'));});
    this.room.on(sdk.RoomEvent.TrackUnsubscribed,(track,publication,participant)=>{if(current()&&participant?.identity===this.ticket.publisherIdentity)this.fail(stageError('TRACK_SUBSCRIPTION_FAILURE','LIVEKIT_CONNECTED'));});
    this.transition('LIVEKIT_CONNECTING','LIVEKIT_CLIENT','SCOPED_VIEWER_TICKET');
    try{await this.room.connect(this.ticket.livekitUrl,this.ticket.viewerToken,{autoSubscribe:true});}
    catch{throw stageError('LIVEKIT_FAILURE','LIVEKIT_CONNECTING');}
    if(!current()){
      // stop's first disconnect may precede this in-flight join completing.
      await this.room.disconnect().catch(()=>{});
      throw new Error('Avatar startup cancelled.');
    }
    // Tracks can arrive during connect(); don't overwrite a later media phase.
    if(this.transitions.at(-1)?.state==='LIVEKIT_CONNECTING')this.transition('LIVEKIT_CONNECTED','LIVEKIT_CLIENT','ROOM_CONNECT_RESOLVED');
    await this.context.audioWorklet.addModule('/iv-prep-on-call/assets/capabilities/embodiment-pcm-worklet.mjs');
    if(!current())throw new Error('Avatar startup cancelled.');
    const native=this.context.createMediaStreamSource(stream);this.sources.push(native);
    this.extractor=new this.Worklet(this.context,'ivoc-interviewer-pcm');native.connect(this.extractor);
    this.inputBound=true;maybeReady();
    this.batcher=new PcmBatcher(pcm=>void this.queue.push('audio',{audio:encode(pcm)}).catch(()=>{}));
    this.silentSink=this.context.createGain();this.silentSink.gain.value=0;this.extractor.connect(this.silentSink);this.silentSink.connect(this.context.destination); // processor always emits zero
    this.extractor.port.onmessage=({data})=>{
      if(!current()||data.generation!==this.pcmGeneration)return;
      if(data.command==='flushed'){this.pcmFlushConfirmed=true;this.resumeAfterFlush();return;}
      const active=data.rms>=0.003;
      if(this.holds){
        // Without a native response boundary we cannot distinguish a cancelled
        // tail from a new answer. Never silently consume either and then resume.
        if(active){this.fail(stageError('NATIVE_TURN_BOUNDARY_UNCONFIRMED','AUDIO_BINDING'));return;}
        this.silentMs+=80;
        this.resumeAfterFlush();return;
      }
      // Preserve every PCM sample, including quiet speech and pauses. RMS is
      // only a delivery-boundary hint, never a content filter/canonical turn.
      this.batcher.push(data.pcm);
      if(active){this.silentMs=0;this.speaking=true;}
      else if(this.speaking){this.silentMs+=80;
        if(this.silentMs>=400){this.speaking=false;this.silentMs=0;this.batcher.flush();void this.queue.push('audio_end').catch(()=>{});}
      }
    };
    // Local microphone VAD only interrupts the visual Actor. It never sends
    // candidate speech to LemonSlice or replaces GPT-Live's native barge-in.
    if(microphoneTrack){const mic=this.context.createMediaStreamSource(new MediaStream([microphoneTrack]));this.sources.push(mic);this.micAnalyser=this.context.createAnalyser();this.micAnalyser.fftSize=512;mic.connect(this.micAnalyser);
      const samples=new Float32Array(512);let above=0;
      this.micTimer=setInterval(()=>{if(!current())return;this.micAnalyser.getFloatTimeDomainData(samples);const rms=Math.sqrt(samples.reduce((n,s)=>n+s*s,0)/samples.length);above=rms>0.03?above+1:0;if(above>=2&&!this.holds&&(this.speaking||this.returnedSpeaking))void this.interrupt();},50);
    }
    // Observe returned audio, not GPT's earlier input. Metadata isn't acceptance.
    this.returnAnalyser=this.context.createAnalyser();this.returnAnalyser.fftSize=512;this.gain.connect(this.returnAnalyser);
    const returned=new Float32Array(512);
    this.poll=setInterval(()=>{if(!current())return;this.returnAnalyser.getFloatTimeDomainData(returned);this.returnedSpeaking=Math.sqrt(returned.reduce((n,s)=>n+s*s,0)/returned.length)>0.008;
      if(!this.polling){this.polling=true;void this.api(`/status?sessionId=${this.sessionId}&id=${this.ticket.id}`).then(status=>{if(status.closed&&current())this.fail(new Error('Avatar canary stopped. Finish and save.'));}).catch(error=>this.fail(error)).finally(()=>{this.polling=false;});}},250);
    if(!this.visible&&this.host.dataset.avatarState!=='decoding')this.host.dataset.avatarState='connecting';return output;
    }catch(error){
      this.failure=error?.diagnostics||{category:'AUDIO_BIND_FAILURE',boundary:this.transitions.at(-1)?.state||'IVOC_CLIENT'};
      const row=this.transitions.at(-1);if(row){row.completedAtMs=Date.now();row.failureEvidence=this.failure;}
      this.visualReject(error);await this.stop();throw error;
    }
  }
  async interrupt(){
    if(this.closed||this.holds||!this.queue||!(this.speaking||this.returnedSpeaking))return;
    this.holds=true;this.flushConfirmed=false;this.pcmFlushConfirmed=false;this.silentMs=0;this.speaking=false;
    this.batcher?.clear();
    // This same gain gates both audible playback and the durable recording tap.
    this.gain.gain.value=0;
    // Fence partial worklet frames and messages already posted to the main
    // thread, not just the HTTP queue. Resume needs both exact acknowledgments.
    const generation=++this.pcmGeneration;
    this.holdTimer=setTimeout(()=>this.fail(stageError('NATIVE_TURN_BOUNDARY_UNCONFIRMED','AUDIO_BINDING')),1500);
    try{
      this.extractor.port.postMessage({command:'flush',generation});
      const receipt=await this.queue.interrupt();
      if(this.closed)return;
      if(receipt?.flushed!==true||receipt.generation!==generation)throw stageError('FLUSH_UNCONFIRMED','AUDIO_BINDING');
      this.flushConfirmed=true;this.resumeAfterFlush();
    }catch(error){this.fail(error);}
  }
  resumeAfterFlush(){
    if(this.closed||!this.holds||!this.flushConfirmed||!this.pcmFlushConfirmed||this.silentMs<400)return;
    clearTimeout(this.holdTimer);this.holds=false;this.silentMs=0;this.gain.gain.value=1;
  }
  async stop({keepalive=false,late=false}={}){
    this.closed=true;++this.generation;if(this.gain)this.gain.gain.value=0;
    this.decodeAbort.abort();this.visualReject(stageError('CLIENT_ABORT','IVOC_CLIENT'));
    clearTimeout(this.deadline);clearTimeout(this.joinTimer);clearTimeout(this.holdTimer);clearInterval(this.poll);clearInterval(this.micTimer);
    this.batcher?.clear();this.queue?.close();this.extractor?.disconnect();if(this.extractor)this.extractor.port.onmessage=null;
    for(const source of this.sources)try{source.disconnect();}catch{}this.sources=[];
    this.silentSink?.disconnect();this.gain?.disconnect();this.extractor?.port.close?.();
    for(const track of this.destination?.stream?.getTracks?.()||[])track.stop();
    this.video?.pause();if(this.video)this.video.srcObject=null;
    if(this.host){this.host.dataset.avatarState='stopped';this.host.replaceChildren();}
    // A stop during provider creation has no ticket yet. render's late receipt
    // calls stop again after the exact ID arrives, without recreating anything.
    if(!this.ticket){
      try{await this.context?.close();}catch{}
      // Cancellation can precede the ticket while the exact reserved server
      // attempt is already creating. Terminate by canonical identity; never
      // retry creation. A late ticket still gets its own exact cleanup below.
      if(this.startRequested)return this.api('/command',{sessionId:this.sessionId,command:'terminate'},{keepalive}).catch(()=>({stopped:true,providerConfirmed:false}));
      return;
    }
    if(this.cleanup)return this.cleanup;
    this.cleanup=(async()=>{
      try{await this.room?.disconnect();}catch{}
      try{await this.context?.close();}catch{}
      return this.api('/command',{sessionId:this.sessionId,id:this.ticket.id,command:'terminate'},{keepalive}).catch(()=>({stopped:true,providerConfirmed:false}));
    })();return this.cleanup;
  }
}
