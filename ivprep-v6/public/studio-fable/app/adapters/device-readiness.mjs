// Read-only preflight view over the existing capture/pipeline owners. No capture,
// audio graph connections, recording, provider commands or baseline writes.
import {microphoneReadiness,hasUsableMicrophone} from './media-readiness.mjs';
import {summarizeVideoFramePixels} from '../../../studio/media-analytics-capability.mjs';

export function createPreviewSampler(document){
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=48;
  const context=canvas.getContext?.('2d',{willReadFrequently:true});
  const sample=video=>{if(!context)return false;try{context.drawImage(video,0,0,64,48);return summarizeVideoFramePixels(context.getImageData(0,0,64,48).data).visible;}catch{return false;}};
  sample.dispose=()=>{canvas.width=0;canvas.height=0;};return sample;
}

export function deviceReadinessMarkup(){
  return '<section class="housing panel" data-device-readiness aria-label="Live device check"><div class="t-label">Microphone level · speak to test</div><meter data-mic-meter aria-label="Microphone input level" min="0" max="100" value="0" style="width:100%;margin:8px 0" hidden></meter><p class="note" data-mic-readout role="status">UNAVAILABLE — connect your microphone.</p><details class="advanced" open><summary>Live device check</summary><div class="resolve-list" data-readiness-rows></div><p class="note">A ready detector is not proof that your face or hands are in view. These checks do not save an answer.</p></details></section>';
}

export function readMicrophoneLevel(engine,stream,buffer){
  const media=engine?.real?.bridge?.media,context=engine?.audioContext,analyser=media?.analyser;
  if(!microphoneReadiness(stream,context).ready||media?.stream!==stream||media?.AC!==context||!media?.mic
    ||!analyser?.getFloatTimeDomainData||!Number.isInteger(analyser.fftSize)||analyser.fftSize<32||analyser.fftSize>32768)return{state:'unavailable'};
  const values=buffer?.length===analyser.fftSize?buffer:new Float32Array(analyser.fftSize);
  try{analyser.getFloatTimeDomainData(values);}catch{return{state:'unavailable'};}
  let sum=0,peak=0;
  for(const value of values){if(!Number.isFinite(value))return{state:'unavailable'};sum+=value*value;peak=Math.max(peak,Math.abs(value));}
  const rms=Math.sqrt(sum/values.length),dbfs=rms>0?20*Math.log10(rms):-Infinity;
  return{state:peak===0?'silent':'measured',dbfs,peak,level:Math.max(0,Math.min(100,(dbfs+60)/60*100))};
}

export function projectDeviceReadiness({stream,context,video,previewVerified=false,audioGraphReady=false,diagnostics={},frame=null,admin=false,switching=false}={}){
  const camera=stream?.getVideoTracks?.()[0],mic=microphoneReadiness(stream,context);
  const cameraLive=!switching&&camera?.readyState==='live'&&camera.enabled===true&&camera.muted!==true;
  const micLive=!switching&&hasUsableMicrophone(stream),processing=!switching&&mic.ready&&audioGraphReady===true;
  // Dimensions/playback alone never grant the visible-pixel receipt.
  const visible=cameraLive&&previewVerified&&video?.srcObject===stream&&!video.paused&&video.readyState>=2&&video.videoWidth>=16&&video.videoHeight>=16;
  const active=cameraLive&&diagnostics.active===true,worker=active&&diagnostics.workerReady===true;
  const face=worker&&frame?.headFace?.presence==='TRACKED';
  const body=worker&&frame?.bodyHands?.inFrame===true,hands=worker&&frame?.bodyHands?.handsAvailable===true&&frame.bodyHands.handsVisible===true;
  const row=(id,label,ready,text)=>({id,label,state:ready?'resolved':'not',text:switching?'Checking selected devices…':text});
  return[
    row('camera','Camera',cameraLive,cameraLive?'Connected':'Connect or select a camera'),
    row('microphone','Microphone',micLive,micLive?'Connected':mic.message||'Connect or select a microphone'),
    row('preview','Visible preview',visible,visible?'Visible frame checked':'Preview not verified — check the camera image'),
    row('processing',admin?'Audio context':'Microphone processing',processing,admin?`${String(context?.state||'unavailable').toUpperCase()}${processing?'':' · INPUT GRAPH UNVERIFIED'}`:processing?'Ready':'Reconnect to resume microphone processing'),
    row('vision',admin?'Vision worker':'Visual coaching',worker,worker?(admin?'READY':'Ready to measure'):active?diagnostics.workerErrors?.length?'Visual coaching temporarily unavailable — reconnect to retry':'Preparing visual coaching…':cameraLive?'Visual coaching not measuring — reconnect to retry':'Connect devices to begin'),
    row('face',admin?'Face landmarks':'Face + head tracking',face,face?'Face measured':worker?'Finding your face':active?'Waiting for visual coaching':'Connect devices first'),
    row('body','Body + hands tracking',body&&hands,body&&hands?'Body and hands measured':worker?body?'Body in view · bring hands into view':hands?'Hands in view · bring shoulders into view':'Bring shoulders and hands into view':active?'Waiting for visual coaching':'Connect devices first'),
  ];
}

export function mountDeviceReadiness(host,{getEngine,getStream,getVideo,previewVerified=()=>false,isCurrent=()=>true,isSwitching=()=>false,
  isAdmin=()=>false,onCaptureInvalidated=()=>{},now=()=>performance.now(),schedule=setInterval,cancel=clearInterval,samplePreview=null}={}){
  if(!host)return{refresh(){},reset(){},dispose(){}};
  const meter=host.querySelector('[data-mic-meter]'),readout=host.querySelector('[data-mic-readout]'),rows=host.querySelector('[data-readiness-rows]');
  const sample=samplePreview||createPreviewSampler(host.ownerDocument);
  let disposed=false,owner=null,observedEngine=null,frame=null,frameAt=null,buffer=null,timer=null,visible=false,previewAt=null,visionFloor=null;
  const current=()=>!disposed&&isCurrent();
  const acceptedVision=()=>{const at=getEngine()?.real?.projector?.latest?.clock?.lastAcceptedAtMs?.vision;return Number.isFinite(at)&&at>=0?at:null;};
  function reset(){frame=null;frameAt=null;buffer=null;visible=false;previewAt=null;visionFloor=acceptedVision();onCaptureInvalidated();}
  function sameCapture(next){return owner&&owner.engine===next.engine&&owner.stream===next.stream&&owner.camera===next.camera&&owner.microphone===next.microphone&&owner.context===next.context;}
  function capture(){
    const engine=getEngine(),stream=getStream(),context=engine?.audioContext;
    return{engine,stream,context,camera:stream?.getVideoTracks?.()[0],microphone:stream?.getAudioTracks?.()[0]};
  }
  function frameListener(event){
    if(!current()||isSwitching()||!sameCapture(capture()))return;
    // Audio/word frames reuse prior vision metrics. Only a new accepted vision
    // timestamp can renew this receipt, including after a same-engine switch.
    const visionAt=acceptedVision(),sessionAt=getEngine()?.real?.clock?.sessionMs?.();
    if(visionAt===null||(visionFloor!==null&&visionAt<=visionFloor))return;
    visionFloor=visionAt;
    if(!Number.isFinite(sessionAt)||sessionAt<visionAt||sessionAt-visionAt>1000)return;
    frame=event.detail;frameAt=now();
  }
  function refresh(){
    if(!current())return;
    const next=capture();
    if(!sameCapture(next)){reset();owner=next;}
    if(observedEngine!==next.engine){observedEngine?.events?.removeEventListener('frame',frameListener);observedEngine=next.engine;observedEngine?.events?.addEventListener('frame',frameListener);}
    const switching=isSwitching();
    const cameraLive=next.camera?.readyState==='live'&&next.camera.enabled===true&&next.camera.muted!==true;
    if(switching||!cameraLive){frame=null;frameAt=null;onCaptureInvalidated();}
    const analyser=next.engine?.real?.bridge?.media?.analyser;
    if(!buffer||buffer.length!==analyser?.fftSize)buffer=Number.isInteger(analyser?.fftSize)&&analyser.fftSize>=32&&analyser.fftSize<=32768?new Float32Array(analyser.fftSize):null;
    const level=switching?{state:'unavailable'}:readMicrophoneLevel(next.engine,next.stream,buffer);
    meter.hidden=level.state==='unavailable';meter.value=level.state==='unavailable'?0:level.level;
    readout.textContent=switching?'Checking selected microphone…':level.state==='unavailable'?'UNAVAILABLE — connect or select a working microphone.':level.state==='silent'?'SILENT — speak, or check the microphone selector.':`${level.dbfs.toFixed(1)} dBFS · peak ${level.peak.toFixed(3)}`;
    let diagnostics={};try{diagnostics=next.engine?.real?.pipeline?.diagnostics?.()||{};}catch{/* Explicitly unavailable, never remembered success. */}
    const at=now(),recent=frameAt!==null&&Number.isFinite(at)&&at>=frameAt&&at-frameAt<=1000,video=getVideo();
    if(switching||!cameraLive||!previewVerified()||video?.srcObject!==next.stream||video.paused||video.readyState<2||video.videoWidth<16||video.videoHeight<16){visible=false;previewAt=null;}
    else if(previewAt===null||at<previewAt||at-previewAt>=500){visible=sample(video)===true;previewAt=at;}
    const media=next.engine?.real?.bridge?.media,audioGraphReady=Boolean(media?.stream===next.stream&&media?.AC===next.context&&media?.mic&&media?.analyser);
    const projected=projectDeviceReadiness({stream:next.stream,context:next.context,video,previewVerified:visible,audioGraphReady,diagnostics,frame:recent?frame:null,admin:isAdmin()===true,switching});
    if(!rows.children.length){
      for(const row of projected){const node=host.ownerDocument.createElement('div');node.className='resolve';node.dataset.readinessRow=row.id;const label=host.ownerDocument.createElement('span'),value=host.ownerDocument.createElement('span');value.className='r';node.append(label,value);rows.append(node);}
    }
    for(const row of projected){const node=rows.querySelector(`[data-readiness-row="${row.id}"]`);node.dataset.state=row.state;node.children[0].textContent=row.label;node.children[1].textContent=row.text;}
  }
  refresh();timer=schedule(refresh,100);
  return{refresh,reset,dispose(){disposed=true;cancel(timer);observedEngine?.events?.removeEventListener('frame',frameListener);sample.dispose?.();frame=null;frameAt=null;buffer=null;owner=null;visible=false;previewAt=null;}};
}
