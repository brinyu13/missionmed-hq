// Selection delegates to the capture/session owner. In-room changes require
// its coordinated recorder/provider transaction, not a second media pipeline.
import {awaitVisibleCamera,assertMicrophoneReady,microphoneReadiness} from './media-readiness.mjs';
export async function mountDeviceControls(host,{engine,video,getStream,isCurrent=()=>true,canSwitch=()=>true,onChanged=()=>{},onSwitching=()=>{},switchDevice=(kind,id)=>engine.switchDevice(kind,id),
  mediaDevices=globalThis.navigator?.mediaDevices,verifyVisible=awaitVisibleCamera,onReadinessChanged=()=>{}}={}) {
  if(!host||!mediaDevices?.enumerateDevices)return()=>{};
  let disposed=false,switching=false;
  const current=()=>!disposed&&isCurrent();
  const status=host.querySelector('[data-device-status]'),selects=[...host.querySelectorAll('[data-device-kind]')];
  let unbindInput=()=>{};
  function checkInput(){
    if(!current()||switching||!canSwitch('microphone'))return;
    const readiness=microphoneReadiness(getStream(),engine.audioContext);
    if(!readiness.ready){status.textContent=readiness.message;onReadinessChanged(readiness);}
  }
  function bindInput(){
    unbindInput();
    const stream=getStream(),context=engine.audioContext,bindings=[];
    const listener=()=>{if(getStream()===stream&&engine.audioContext===context)checkInput();};
    for(const [source,types]of [...(stream?.getAudioTracks?.()||[]).map(track=>[track,['ended','mute','unmute']]),[context,['statechange']]]){
      for(const type of types){source?.addEventListener?.(type,listener);bindings.push([source,type]);}
    }
    unbindInput=()=>bindings.forEach(([source,type])=>source?.removeEventListener?.(type,listener));
  }
  async function refresh(){
    bindInput();
    const devices=await mediaDevices.enumerateDevices();if(!current())return;
    const selected=engine.real.currentDevices();
    for(const select of selects){
      const camera=select.dataset.deviceKind==='camera',id=camera?selected.cameraDeviceId:selected.microphoneDeviceId;
      const rows=devices.filter(d=>d.kind===(camera?'videoinput':'audioinput'));
      select.replaceChildren();
      for(const [index,row]of rows.entries()){
        const option=host.ownerDocument.createElement('option');option.value=row.deviceId;option.textContent=row.label||`${camera?'Camera':'Microphone'} ${index+1}`;
        option.selected=row.deviceId===id;select.append(option);
      }
      if(!rows.some(row=>row.deviceId===id)&&id){const option=host.ownerDocument.createElement('option');option.value=id;option.textContent=camera?selected.cameraLabel:selected.microphoneLabel;option.selected=true;select.append(option);}
      select.disabled=switching||!canSwitch(select.dataset.deviceKind)||!select.options.length;
    }
    host.hidden=false;
  }
  async function change(event){
    const select=event.currentTarget;
    if(!current()||switching||!canSwitch(select.dataset.deviceKind))return;
    let ready=false,verifiedInput=null;
    switching=true;onSwitching(true);selects.forEach(s=>{s.disabled=true;});status.textContent='Checking selected device…';
    try{
      await switchDevice(select.dataset.deviceKind,select.value);if(!current())return;
      onChanged();
      const stream=getStream(),context=engine.audioContext,track=stream?.getAudioTracks?.()[0];
      await verifyVisible(video,stream,{isCurrent:current});if(!current())return;
      if(getStream()!==stream||engine.audioContext!==context||stream?.getAudioTracks?.()[0]!==track)throw new Error('Your microphone setup changed. Check the preview again.');
      assertMicrophoneReady(stream,context);verifiedInput={stream,context,track};
      ready=true;
      status.textContent='Preview visible. Device changed; recalibrate for this setup.';
    }catch(error){if(current())status.textContent=error.message;}
    finally{switching=false;if(current()){
      await refresh().catch(()=>{});if(current()){
        const latest=microphoneReadiness(getStream(),engine.audioContext);
        const sameInput=verifiedInput&&getStream()===verifiedInput.stream&&engine.audioContext===verifiedInput.context&&getStream()?.getAudioTracks?.()[0]===verifiedInput.track;
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
  dispose.refresh=refresh;return dispose;
}
export function deviceControlsMarkup(){return '<section class="housing panel" data-device-controls hidden><div class="two-col"><label class="field">Camera<select data-device-kind="camera" aria-label="Camera"></select></label><label class="field">Microphone<select data-device-kind="microphone" aria-label="Microphone"></select></label></div><p class="note" data-device-status>Choose your devices before you start.</p></section>';}
