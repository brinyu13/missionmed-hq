// Selection delegates to the capture/session owner. In-room changes require
// its coordinated recorder/provider transaction, not a second media pipeline.
import {awaitVisibleCamera,assertMicrophoneReady,microphoneReadiness} from './media-readiness.mjs';
export async function mountDeviceControls(host,{engine,getEngine=()=>engine,video,getVideo=()=>video,getStream,isCurrent=()=>true,canSwitch=()=>true,onChanged=()=>{},onSwitching=()=>{},switchDevice=(kind,id)=>getEngine().switchDevice(kind,id),
  mediaDevices=globalThis.navigator?.mediaDevices,verifyVisible=awaitVisibleCamera,onReadinessChanged=()=>{}}={}) {
  if(!host||!mediaDevices?.enumerateDevices)return()=>{};
  let disposed=false,switching=false;
  const preferences={};
  host.hidden=false;
  const current=()=>!disposed&&isCurrent();
  const status=host.querySelector('[data-device-status]'),selects=[...host.querySelectorAll('[data-device-kind]')];
  let unbindInput=()=>{};
  function checkInput(){
    if(!current()||switching||!canSwitch('microphone'))return;
    if(!getEngine())return;
    const readiness=microphoneReadiness(getStream(),getEngine().audioContext);
    if(!readiness.ready){status.textContent=readiness.message;onReadinessChanged(readiness);}
  }
  function bindInput(){
    unbindInput();
    const stream=getStream(),context=getEngine()?.audioContext,bindings=[];
    const listener=()=>{if(getStream()===stream&&getEngine()?.audioContext===context)checkInput();};
    for(const [source,types]of [...(stream?.getAudioTracks?.()||[]).map(track=>[track,['ended','mute','unmute']]),[context,['statechange']]]){
      for(const type of types){source?.addEventListener?.(type,listener);bindings.push([source,type]);}
    }
    unbindInput=()=>bindings.forEach(([source,type])=>source?.removeEventListener?.(type,listener));
  }
  async function refresh(){
    if(!current())return;
    bindInput();
    const devices=await mediaDevices.enumerateDevices();if(!current())return;
    const selected=getEngine()?.real?.currentDevices?.()||preferences;
    for(const select of selects){
      const camera=select.dataset.deviceKind==='camera',id=camera?selected.cameraDeviceId:selected.microphoneDeviceId;
      const rows=devices.filter(d=>d.kind===(camera?'videoinput':'audioinput'));
      select.replaceChildren();
      if(!getEngine()||!rows.length){const option=host.ownerDocument.createElement('option');option.value='';option.textContent='Browser default · connect to identify';option.selected=!id;select.append(option);}
      for(const [index,row]of rows.entries()){
        const option=host.ownerDocument.createElement('option');option.value=row.deviceId;option.textContent=row.label||`${camera?'Camera':'Microphone'} ${index+1}`;
        option.selected=row.deviceId===id;select.append(option);
      }
      if(!rows.some(row=>row.deviceId===id)&&id){const option=host.ownerDocument.createElement('option');option.value=id;option.textContent=(camera?selected.cameraLabel:selected.microphoneLabel)||'Previously selected device';option.selected=true;select.append(option);}
      select.disabled=switching||!canSwitch(select.dataset.deviceKind)||!select.options.length;
    }
    host.hidden=false;
  }
  async function change(event){
    const select=event.currentTarget;
    if(!current()||switching||!canSwitch(select.dataset.deviceKind))return;
    if(!getEngine()){
      preferences[select.dataset.deviceKind==='camera'?'cameraDeviceId':'microphoneDeviceId']=select.value;
      status.textContent='Selected. Connect camera + mic to check your preview.';
      return;
    }
    let ready=false,verifiedInput=null;
    switching=true;onSwitching(true);selects.forEach(s=>{s.disabled=true;});status.textContent='Checking selected device…';
    try{
      await switchDevice(select.dataset.deviceKind,select.value);if(!current())return;
      onChanged();
      const stream=getStream(),context=getEngine().audioContext,track=stream?.getAudioTracks?.()[0];
      await verifyVisible(getVideo(),stream,{isCurrent:current});if(!current())return;
      if(getStream()!==stream||getEngine()?.audioContext!==context||stream?.getAudioTracks?.()[0]!==track)throw new Error('Your microphone setup changed. Check the preview again.');
      assertMicrophoneReady(stream,context);verifiedInput={stream,context,track};
      ready=true;
      status.textContent='Preview visible. Device changed; recalibrate for this setup.';
    }catch(error){if(current())status.textContent=error.message;}
    finally{switching=false;if(current()){
      await refresh().catch(()=>{});if(current()){
        const latest=microphoneReadiness(getStream(),getEngine()?.audioContext);
        const sameInput=verifiedInput&&getStream()===verifiedInput.stream&&getEngine()?.audioContext===verifiedInput.context&&getStream()?.getAudioTracks?.()[0]===verifiedInput.track;
        if(ready&&(!sameInput||!latest.ready)){ready=false;status.textContent=latest.ready?'Your microphone setup changed. Check the preview again.':latest.message;}
        onSwitching(false,ready);
      }
    }}
  }
  const deviceChange=()=>{checkInput();void refresh().then(checkInput).catch(()=>{if(current())status.textContent='Device list unavailable. Reconnect to check your devices.';});};
  const window=host.ownerDocument?.defaultView;
  selects.forEach(select=>select.addEventListener('change',change));mediaDevices.addEventListener?.('devicechange',deviceChange);window?.addEventListener?.('focus',deviceChange);
  try{await refresh();}catch{if(current())status.textContent='Device list unavailable. Your current capture remains selected.';}
  const dispose=()=>{disposed=true;unbindInput();selects.forEach(select=>select.removeEventListener('change',change));mediaDevices.removeEventListener?.('devicechange',deviceChange);window?.removeEventListener?.('focus',deviceChange);};
  dispose.refresh=refresh;dispose.preferences=()=>({...preferences});return dispose;
}
// variant:'room' marks the single Room node that is inline during readiness and a one-click popover when live; the selects, owner and switching path are identical.
export function deviceControlsMarkup({variant='panel'}={}){
  const room=variant==='room';
  return '<section class="housing panel'+(room?' device-controls-room':'')+'" data-device-controls'+(room?' data-device-variant="room"':'')+'><div class="two-col"><label class="field">Camera<select data-device-kind="camera" aria-label="Camera"></select></label><label class="field">Microphone<select data-device-kind="microphone" aria-label="Microphone"></select></label></div><p class="note" data-device-status>Choose your camera and microphone here.</p></section>';
}
