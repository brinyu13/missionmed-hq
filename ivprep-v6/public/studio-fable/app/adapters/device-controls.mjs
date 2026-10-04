// Preflight only: reuse the capture owner's switchDevice; never acquire a
// second stream or replace a track while the interviewer/recorder is active.
import {awaitVisibleCamera} from './media-readiness.mjs';
export async function mountDeviceControls(host,{engine,video,getStream,isCurrent=()=>true,canSwitch=()=>true,onChanged=()=>{},onSwitching=()=>{},switchDevice=(kind,id)=>engine.switchDevice(kind,id),
  mediaDevices=globalThis.navigator?.mediaDevices,verifyVisible=awaitVisibleCamera}={}) {
  if(!host||!mediaDevices?.enumerateDevices)return()=>{};
  let disposed=false,switching=false;
  const current=()=>!disposed&&isCurrent();
  const status=host.querySelector('[data-device-status]'),selects=[...host.querySelectorAll('[data-device-kind]')];
  async function refresh(){
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
      select.disabled=switching||!canSwitch()||!select.options.length;
    }
    host.hidden=false;
  }
  async function change(event){
    const select=event.currentTarget;
    if(!current()||switching||!canSwitch())return;
    let ready=false;
    switching=true;onSwitching(true);selects.forEach(s=>{s.disabled=true;});status.textContent='Checking selected device…';
    try{
      await switchDevice(select.dataset.deviceKind,select.value);if(!current())return;
      onChanged();
      await verifyVisible(video,getStream(),{isCurrent:current});if(!current())return;
      if(!getStream()?.getAudioTracks().some(track=>track.readyState==='live'&&track.enabled&&!track.muted))throw new Error('Your microphone is not ready. Reconnect before starting.');
      ready=true;
      status.textContent='Preview visible. Device changed; recalibrate for this setup.';
    }catch(error){if(current())status.textContent=error.message;}
    finally{switching=false;if(current()){await refresh().catch(()=>{});if(current())onSwitching(false,ready);}}
  }
  const deviceChange=()=>{void refresh().catch(()=>{if(current())status.textContent='Device list unavailable. Reconnect to check your devices.';});};
  selects.forEach(select=>select.addEventListener('change',change));mediaDevices.addEventListener?.('devicechange',deviceChange);
  try{await refresh();}catch{if(current())status.textContent='Device list unavailable. Your current capture remains selected.';}
  return()=>{disposed=true;selects.forEach(select=>select.removeEventListener('change',change));mediaDevices.removeEventListener?.('devicechange',deviceChange);};
}
export function deviceControlsMarkup(){return '<section class="housing panel" data-device-controls hidden><div class="two-col"><label class="field">Camera<select data-device-kind="camera" aria-label="Camera"></select></label><label class="field">Microphone<select data-device-kind="microphone" aria-label="Microphone"></select></label></div><p class="note" data-device-status>Choose your devices before you start.</p></section>';}
