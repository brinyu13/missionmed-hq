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

export const READINESS_PANELS=Object.freeze(['Devices','Visual signals','Voice signals','Signal health']);
const PANEL_IDS={Devices:['camera','microphone','preview','processing','recording','transcript'],'Visual signals':['vision','framing','face','body','smile'],'Voice signals':['volume','pace','pitch','pauses']};
const GUIDANCE={camera:'Center your face and place the camera near eye level.',microphone:'Speak naturally and watch the input meter.',preview:'Check the actual camera image; a connected camera can still be dark.',processing:'Reconnect if microphone processing is unavailable.',vision:'Reconnect to retry visual coaching.',framing:'Keep your face and shoulders visible.',face:'Head position is an observable signal, not emotion or intent.',body:'Keep shoulders and natural gestures in view.',smile:'Observable smile patterns require your personal face baseline; no emotion is inferred.',volume:'Use an audible conversational level without clipping.',pace:'Read complete thoughts; pace requires supported timed words.',pitch:'Speak naturally; voiced pitch is an observation, not a diagnosis.',pauses:'Leave space between thoughts. A microphone connection alone cannot prove measured pauses.',recording:'Browser support does not mean recording is enabled or started. This rehearsal is not recorded.',transcript:'Speech capture support does not guarantee a transcript. Check availability after a saved answer.'};

export function readinessCapabilities(account,durable,recorderSupported){
  const payload=durable?.bootstrapPayload,subject=account?.subject;
  const admin=account?.role==='admin';
  const admitted=account?.mode==='REAL'&&/^wp:[1-9][0-9]*$/.test(subject||'')&&account.admission?.admitted===true
    &&account.admission.identity?.subject===subject&&payload?.entitlement?.admitted===true&&payload.identity?.subject===subject
    &&account.api?.identity?.subject===subject&&['student','admin'].includes(account.role)
    &&payload.identity.admin===admin&&account.admission.identity.admin===admin&&account.api.identity.admin===admin;
  return{recording:admitted&&recorderSupported===true,transcript:admitted&&payload.capabilities?.candidateAudioCapture===true};
}

export function deviceReadinessMarkup({fullPanels=false}={}){
  if(fullPanels)return '<section class="housing panel readiness-full" data-device-readiness aria-label="Live signal checks"><div class="readiness-tabs" role="tablist" aria-label="Readiness panels">'+READINESS_PANELS.map((name,i)=>`<button type="button" role="tab" id="readiness-tab-${i}" data-readiness-tab="${i}" aria-controls="readiness-panel" aria-selected="${i===0}" tabindex="${i===0?0:-1}">${name}</button>`).join('')+'</div><p class="note" data-readiness-count role="status">0 live checks ready now</p><div id="readiness-panel" role="tabpanel" aria-labelledby="readiness-tab-0"><div class="t-label">Microphone level · speak to test</div><meter data-mic-meter aria-label="Microphone input level" min="0" max="100" value="0" hidden></meter><p class="note" data-mic-readout role="status">UNAVAILABLE — connect your microphone.</p><div class="resolve-list" data-readiness-rows></div></div><p class="note">Only current producer evidence counts. Browser support does not start recording or save an answer.</p></section>';
  return '<section class="housing panel" data-device-readiness aria-label="Live device check"><div class="t-label">Microphone level · speak to test</div><meter data-mic-meter aria-label="Microphone input level" min="0" max="100" value="0" style="width:100%;margin:8px 0" hidden></meter><p class="note" data-mic-readout role="status">UNAVAILABLE — connect your microphone.</p><details class="advanced" open><summary>Live device check</summary><div class="resolve-list" data-readiness-rows></div><p class="note">A ready detector is not proof that your face or hands are in view. These checks do not save an answer.</p></details></section>';
}

export function projectReadinessPanels({audioFrame=null,transcriptFrame=null,capabilities={},...input}={}){
  const compact=projectDeviceReadiness(input),byId=Object.fromEntries(compact.map(row=>[row.id,row]));
  const mic=byId.processing.state==='resolved',face=byId.face.state==='resolved';
  const finite=value=>typeof value==='number'&&Number.isFinite(value);
  const measured=(id,label,ready)=>({id,label,state:ready?'resolved':'not',text:ready?'Measured now':input.switching?'Checking selected devices…':'Unavailable — awaiting current measured evidence'});
  const rows=[...compact,
    measured('framing','Framing',face&&input.frame?.bodyHands?.inFrame===true),
    measured('smile','Smile / expression',face&&input.frame?.headFace?.smileEventsLiveAvailable===true&&finite(input.frame.headFace.smileEvents)),
    measured('volume','Volume',mic&&audioFrame?.speaking===true&&audioFrame?.volume?.available===true&&finite(audioFrame.volume.scientificValue)),
    measured('pitch','Pitch',mic&&audioFrame?.speaking===true&&audioFrame?.pitch?.available===true&&audioFrame.pitch.voiced===true&&finite(audioFrame.pitch.f0Hz)&&audioFrame.pitch.f0Hz>0),
    measured('pace','Pace',mic&&transcriptFrame?.speaking===true&&transcriptFrame?.speedWpm?.available===true&&finite(transcriptFrame.speedWpm.wordsPerMinute)&&transcriptFrame.speedWpm.wordsPerMinute>=0),
    {id:'pauses',label:'Pauses',state:'not',text:'Unavailable — no validated pause measurement in this rehearsal'},
    {id:'recording',label:'Recording',state:capabilities.recording===true?'resolved':'not',text:capabilities.recording===true?'Browser supported · not recording':'Unavailable · browser/account support unverified',capability:true},
    {id:'transcript',label:'Transcript',state:capabilities.transcript===true?'resolved':'not',text:capabilities.transcript===true?'Speech capture supported · check transcript after a saved answer':'Unavailable · check transcript after a saved answer',capability:true}];
  return rows.map(row=>({...row,guidance:GUIDANCE[row.id],panels:READINESS_PANELS.filter(panel=>panel==='Signal health'||PANEL_IDS[panel]?.includes(row.id))}));
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
  isAdmin=()=>false,onCaptureInvalidated=()=>{},now=()=>performance.now(),schedule=setInterval,cancel=clearInterval,samplePreview=null,
  fullPanels=false,getCapabilities=()=>({})}={}){
  if(!host)return{refresh(){},reset(){},dispose(){}};
  const meter=host.querySelector('[data-mic-meter]'),readout=host.querySelector('[data-mic-readout]'),rows=host.querySelector('[data-readiness-rows]');
  const sample=samplePreview||createPreviewSampler(host.ownerDocument);
  let disposed=false,owner=null,observedEngine=null,frame=null,frameAt=null,buffer=null,timer=null,visible=false,previewAt=null,visionFloor=null;
  let panel=0;const tabs=fullPanels?Array.from(host.querySelectorAll('[data-readiness-tab]')):[];
  const receipts={audio:{floor:null,frame:null,at:null},transcript:{floor:null,frame:null,at:null}};
  const current=()=>!disposed&&isCurrent();
  const acceptedVision=()=>{const at=getEngine()?.real?.projector?.latest?.clock?.lastAcceptedAtMs?.vision;return Number.isFinite(at)&&at>=0?at:null;};
  function reset(){frame=null;frameAt=null;buffer=null;visible=false;previewAt=null;visionFloor=acceptedVision();for(const key of ['audio','transcript']){const at=getEngine()?.real?.projector?.latest?.clock?.lastAcceptedAtMs?.[key];Object.assign(receipts[key],{floor:Number.isFinite(at)&&at>=0?at:null,frame:null,at:null});}onCaptureInvalidated();}
  function sameCapture(next){return owner&&owner.engine===next.engine&&owner.stream===next.stream&&owner.camera===next.camera&&owner.microphone===next.microphone&&owner.context===next.context;}
  function capture(){
    const engine=getEngine(),stream=getStream(),context=engine?.audioContext;
    return{engine,stream,context,camera:stream?.getVideoTracks?.()[0],microphone:stream?.getAudioTracks?.()[0]};
  }
  function frameListener(event){
    if(!current()||isSwitching()||!sameCapture(capture()))return;
    if(fullPanels){
      const clocks=getEngine()?.real?.projector?.latest?.clock?.lastAcceptedAtMs,session=getEngine()?.real?.clock?.sessionMs?.();
      for(const key of ['audio','transcript']){const receipt=receipts[key],at=clocks?.[key];
        if(!Number.isFinite(at)||at<0||(receipt.floor!==null&&at<=receipt.floor))continue;
        receipt.floor=at;
        if(Number.isFinite(session)&&session>=at&&session-at<=1000){receipt.frame=event.detail;receipt.at=now();}
      }
    }
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
    const input={stream:next.stream,context:next.context,video,previewVerified:visible,audioGraphReady,diagnostics,frame:recent?frame:null,admin:isAdmin()===true,switching};
    const recentReceipt=key=>{const receipt=receipts[key];return receipt.at!==null&&Number.isFinite(at)&&at>=receipt.at&&at-receipt.at<=1000?receipt.frame:null;};
    const projected=fullPanels?projectReadinessPanels({...input,audioFrame:recentReceipt('audio'),transcriptFrame:recentReceipt('transcript'),capabilities:getCapabilities()}):projectDeviceReadiness(input);
    if(!rows.children.length){
      for(const row of projected){const node=host.ownerDocument.createElement('div');node.className='resolve';node.dataset.readinessRow=row.id;const label=host.ownerDocument.createElement('span'),value=host.ownerDocument.createElement('span');value.className='r';node.append(label,value);if(fullPanels){const guidance=host.ownerDocument.createElement('small');guidance.textContent=row.guidance;node.append(guidance);}rows.append(node);}
    }
    for(const row of projected){const node=rows.querySelector(`[data-readiness-row="${row.id}"]`);node.dataset.state=row.state;node.children[0].textContent=row.label;node.children[1].textContent=row.text;if(fullPanels)node.hidden=!row.panels.includes(READINESS_PANELS[panel]);}
    if(fullPanels){const live=projected.filter(row=>row.capability!==true);host.querySelector('[data-readiness-count]').textContent=`${live.filter(row=>row.state==='resolved').length} of ${live.length} live checks ready now`;}
  }
  function selectPanel(index,focus=false){if(!current())return;panel=(index+tabs.length)%tabs.length;tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===panel));tab.tabIndex=i===panel?0:-1;});host.querySelector('[role="tabpanel"]').setAttribute('aria-labelledby',`readiness-tab-${panel}`);if(focus)tabs[panel].focus();refresh();}
  const onTabClick=event=>selectPanel(Number(event.currentTarget.dataset.readinessTab));
  const onTabKey=event=>{const key=event.key;if(!['ArrowLeft','ArrowRight','Home','End'].includes(key))return;event.preventDefault();selectPanel(key==='Home'?0:key==='End'?tabs.length-1:panel+(key==='ArrowRight'?1:-1),true);};
  for(const tab of tabs){tab.addEventListener('click',onTabClick);tab.addEventListener('keydown',onTabKey);}
  refresh();timer=schedule(refresh,100);
  return{refresh,reset,dispose(){disposed=true;cancel(timer);observedEngine?.events?.removeEventListener('frame',frameListener);for(const tab of tabs){tab.removeEventListener('click',onTabClick);tab.removeEventListener('keydown',onTabKey);}sample.dispose?.();frame=null;frameAt=null;for(const receipt of Object.values(receipts)){receipt.frame=null;receipt.at=null;}buffer=null;owner=null;visible=false;previewAt=null;}};
}
