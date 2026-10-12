/* Local capture only. Never connects captured audio to speakers or a network. */
export class ArenaRecorder {
  constructor(onStatus = () => {}, onLevels = () => {}) {
    this.onStatus = onStatus; this.onLevels = onLevels; this.streams = []; this.nodes = [];
    this.phase = 'idle'; this.bytes = 0; this.reason = ''; this.maxBytes = 256 * 1024 * 1024;
  }
  async prepare() {
    if (this.phase !== 'idle') throw new Error('Finish or discard the previous capture first.');
    if (!navigator.mediaDevices?.getDisplayMedia || !window.MediaRecorder) throw new Error('Use a browser with screen capture and MediaRecorder support.');
    this.phase = 'permission';
    try {
      // Must be called from the Start Interview click to preserve user activation.
      this.display = await navigator.mediaDevices.getDisplayMedia({
        video: {displaySurface:'window', frameRate:{ideal:24,max:30}, width:{ideal:1280},height:{ideal:720}},
        audio: {suppressLocalAudioPlayback:false}, windowAudio:'window', systemAudio:'include',
        selfBrowserSurface:'exclude', surfaceSwitching:'exclude', monitorTypeSurfaces:'exclude'
      });
      this.streams.push(this.display);
      if (!this.display.getVideoTracks().length) throw new Error('No Webex window video was supplied.');
      if (!this.display.getAudioTracks().length) throw new Error('Incoming Webex audio was NOT supplied by this capture choice. Recording stopped. Microphone-only capture is not sufficient.');
      this.mic = await navigator.mediaDevices.getUserMedia({video:false,audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      this.streams.push(this.mic);
      if (!this.mic.getAudioTracks().length) throw new Error('Instructor microphone was not supplied.');
      this.context = new AudioContext(); await this.context.resume();
      this.destination = this.context.createMediaStreamDestination();
      this.analysers = [this.display,this.mic].map(stream => {
        const source = this.context.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
        const gain = this.context.createGain(); gain.gain.value = 0.5;
        const analyser = this.context.createAnalyser(); analyser.fftSize = 1024;
        source.connect(analyser); source.connect(gain); gain.connect(this.destination);
        this.nodes.push(source,gain,analyser); return analyser;
      });
      this.mixed = new MediaStream([...this.display.getVideoTracks(),...this.destination.stream.getAudioTracks()]);
      const mimeType = ['video/webm;codecs=vp8,opus','video/webm','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
      if (!mimeType) throw new Error('No supported local recording format.');
      this.recorder = new MediaRecorder(this.mixed,{mimeType,videoBitsPerSecond:2000000,audioBitsPerSecond:128000});
      this.chunks=[]; this.bytes=0;
      this.recorder.ondataavailable=e=>{if(e.data.size){this.chunks.push(e.data);this.bytes+=e.data.size;if(this.bytes>this.maxBytes)this.interrupt('Local memory limit reached; save this partial clip and start a new interview.');}};
      this.recorder.onerror=()=>this.interrupt('Recorder reported an encoding error.');
      for(const stream of this.streams) for(const t of stream.getTracks()) t.addEventListener('ended',()=>this.interrupt('Capture input ended. This interview requires review or a new recording.'),{once:true});
      this.levelTimer=setInterval(()=>this.onLevels(this.analysers.map(a=>{const data=new Uint8Array(a.fftSize);a.getByteTimeDomainData(data);return Math.sqrt(data.reduce((sum,v)=>sum+((v-128)/128)**2,0)/data.length); })),120);
      this.phase='ready';this.onStatus('Both audio sources are available. This does not yet prove both voices are audible.');
      return {displayAudioTracks:this.display.getAudioTracks().length,microphoneTracks:this.mic.getAudioTracks().length,displaySurface:this.display.getVideoTracks()[0].getSettings().displaySurface||'unknown'};
    } catch(e) {await this.cleanup();this.phase='idle';throw e;}
  }
  start() {
    if(this.phase!=='ready')throw new Error('Capture is not ready.');
    this.phase='recording';this.started=performance.now();this.recorder.start(1000);
    this.limitTimer=setTimeout(()=>this.interrupt('Twenty-minute capture limit reached. Save and start another interview.'),20*60*1000);
  }
  interrupt(reason) {
    if(this.phase!=='recording'&&this.phase!=='ready')return;
    this.reason=reason;this.onStatus(reason);
    if(this.phase==='recording') this.stop().then(result=>this.onInterrupted?.(result)).catch(e=>this.onStatus(e.message));
    else this.cleanup();
  }
  async stop() {
    if(this.stopping)return this.stopping;
    if(this.phase!=='recording')throw new Error('No interview is recording.');
    this.phase='finalizing';const stopTime=performance.now();
    this.stopping=new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{this.cleanup();reject(new Error('Recording finalization timed out. No completed recording claimed.'));},15000);
      this.recorder.addEventListener('stop',async()=>{
        clearTimeout(timeout);
        const blob=new Blob(this.chunks,{type:this.recorder.mimeType});
        const result={blob,duration:Math.round((stopTime-this.started)/1000),bytes:blob.size,mime:blob.type,interrupted:Boolean(this.reason),reason:this.reason,finalizeMs:Math.round(performance.now()-stopTime)};
        await this.cleanup();this.phase='finished';
        if(!blob.size)reject(new Error('Recording is empty. No completed recording claimed.'));else resolve(result);
      },{once:true});
      this.recorder.stop();
    });
    return this.stopping;
  }
  async cleanup() {
    clearInterval(this.levelTimer);clearTimeout(this.limitTimer);
    this.phase='closing';for(const s of this.streams)for(const t of s.getTracks())t.stop();
    for(const n of this.nodes)try{n.disconnect();}catch{}
    if(this.context&&this.context.state!=='closed')await this.context.close();
    this.phase='idle';
  }
}
