// EmbodimentRenderer: visual Actor + synchronized transport of GPT-Live audio.
// Never a Director. Exactly one stable, gated stream feeds playback AND recording.
const API='/api/ivoc/v1/admin/embodiment-canary';
export const EMBODIMENT_START_TIMEOUT_MS=30000;
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
    this.timeoutSignal=timeoutSignal;this.Worklet=AudioWorkletNodeCtor;this.startRequested=false;
  }
  async api(command,body=null,{keepalive=false}={}){
    const response=await this.fetch(API+command,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',redirect:'error',keepalive,
      headers:{Accept:'application/json',...(body?{'Content-Type':'application/json','X-MMHQ-CSRF':this.csrfToken}:{})},
      body:body?JSON.stringify(body):undefined,signal:keepalive?undefined:this.timeoutSignal(command==='/start'?EMBODIMENT_START_TIMEOUT_MS:5000)});
    const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||'Avatar transport unavailable.');return result;
  }
  fail(error){if(this.closed)return;this.onFailure(error);void this.stop();}
  async render(stream,{microphoneTrack,ivocSessionId}={}){
    if(ivocSessionId!==this.sessionId)throw new Error('Avatar canonical session identity changed.');
    const generation=++this.generation,current=()=>!this.closed&&this.generation===generation;
    if(this.context)throw new Error('Only one avatar playback authority is permitted.');
    this.context=new this.AC({sampleRate:16000});if(this.context.sampleRate!==16000)throw new Error('This browser cannot supply the required avatar audio format.');
    await this.context.resume();
    this.destination=this.context.createMediaStreamDestination();
    this.gain=this.context.createGain();this.gain.gain.value=1;this.gain.connect(this.destination); // NOT context.destination
    // Stable silent output exists before opening: avoids a speech/startup deadlock.
    const output=this.destination.stream;
    const sdk=await this.loadSdk();if(!current())throw new Error('Avatar startup cancelled.');
    this.startRequested=true;
    this.ticket=await this.api('/start',{sessionId:this.sessionId});
    if(!current()){await this.stop({late:true});throw new Error('Avatar startup cancelled.');}
    this.deadline=setTimeout(()=>this.fail(new Error('Avatar canary reached its 45-second limit. Finish and save.')),Math.max(0,this.ticket.deadlineMs-Date.now()));
    this.room=new sdk.Room({adaptiveStream:false,dynacast:false,reconnectPolicy:{nextRetryDelayInMs:()=>null}});
    this.queue=new EmbodimentCommandQueue(item=>{
      const {resolve,reject,...body}=item;return this.api('/command',{sessionId:this.sessionId,id:this.ticket.id,...body});
    },{onFailure:error=>this.fail(error)});
    const joined=new Promise((resolve,reject)=>{
      let audio=false,video=false;
      this.joinTimer=setTimeout(()=>reject(new Error('Avatar audio/video did not arrive in time.')),8000);
      this.room.on(sdk.RoomEvent.TrackSubscribed,(track,publication,participant)=>{
        if(!current()||participant.identity!==this.ticket.publisherIdentity)return;
        const raw=track.mediaStreamTrack;if(!raw)return;
        if(track.kind==='audio'){
          if(audio){this.fail(new Error('Surplus avatar audio rejected.'));return;}
          audio=true;const source=this.context.createMediaStreamSource(new MediaStream([raw]));this.sources.push(source);source.connect(this.gain);
          // Do not call track.attach() or Room.startAudio(): our original single
          // interviewer audio element owns playback of this exact output stream.
        }else if(track.kind==='video'){
          if(video){this.fail(new Error('Surplus avatar video rejected.'));return;}
          video=true;this.video=document.createElement('video');this.video.autoplay=true;this.video.playsInline=true;this.video.muted=true;
          this.video.setAttribute('aria-label','AI interviewer avatar');this.video.srcObject=new MediaStream([raw]);
          this.host.replaceChildren(this.video);this.host.dataset.avatarState='connected';void this.video.play().catch(error=>this.fail(error));
        }
        if(audio&&video){clearTimeout(this.joinTimer);this.host.dataset.avatarState='live';resolve();}
      });
      this.room.on(sdk.RoomEvent.Disconnected,()=>{if(current())this.fail(new Error('Avatar disconnected. Finish and save this attempt.'));});
    });
    // Generated A/V may require the first PCM turn. Do not make GPT's sole
    // opening directive wait for that A/V: return the stable silent output
    // after transport/extraction is ready; asynchronously require real tracks.
    joined.catch(error=>{if(current())this.fail(error);});
    await this.room.connect(this.ticket.livekitUrl,this.ticket.viewerToken,{autoSubscribe:true});
    if(!current())throw new Error('Avatar startup cancelled.');
    await this.context.audioWorklet.addModule('/iv-prep-on-call/assets/capabilities/embodiment-pcm-worklet.mjs');
    if(!current())throw new Error('Avatar startup cancelled.');
    const native=this.context.createMediaStreamSource(stream);this.sources.push(native);
    this.extractor=new this.Worklet(this.context,'ivoc-interviewer-pcm');native.connect(this.extractor);
    this.batcher=new PcmBatcher(pcm=>void this.queue.push('audio',{audio:encode(pcm)}).catch(()=>{}));
    this.silentSink=this.context.createGain();this.silentSink.gain.value=0;this.extractor.connect(this.silentSink);this.silentSink.connect(this.context.destination); // processor always emits zero
    this.extractor.port.onmessage=({data})=>{
      if(!current())return;
      const active=data.rms>=0.003;
      if(this.holds){if(!active)this.silentMs+=80;else this.silentMs=0;if(this.flushConfirmed&&this.silentMs>=400){this.holds=false;this.silentMs=0;this.gain.gain.value=1;}return;}
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
    if(this.host.dataset.avatarState!=='live')this.host.dataset.avatarState='connecting';return output;
  }
  async interrupt(){
    if(this.closed||this.holds||!this.queue||!(this.speaking||this.returnedSpeaking))return;
    this.holds=true;this.flushConfirmed=false;this.silentMs=0;this.speaking=false;
    this.batcher?.clear();
    // This same gain gates both audible playback and the durable recording tap.
    this.gain.gain.value=0;
    try{await this.queue.interrupt();this.flushConfirmed=true;}catch(error){this.fail(error);}
  }
  async stop({keepalive=false,late=false}={}){
    this.closed=true;++this.generation;if(this.gain)this.gain.gain.value=0;
    clearTimeout(this.deadline);clearTimeout(this.joinTimer);clearInterval(this.poll);clearInterval(this.micTimer);
    this.batcher?.clear();this.queue?.close();this.extractor?.disconnect();if(this.extractor)this.extractor.port.onmessage=null;
    for(const source of this.sources)try{source.disconnect();}catch{}this.sources=[];
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
