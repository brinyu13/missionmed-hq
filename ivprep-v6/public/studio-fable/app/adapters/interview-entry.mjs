// Presentation-only timing. No provider, recorder, stream or billing ownership.
export function arrivalDelaySeconds(settings) {
  return settings?.arrivalDelaySeconds===30?30:0;
}

// Carry bounded setup intent through calibration/Back, never an arbitrary URL.
export function mockSetupRoute(params=new URLSearchParams(),retry=params.get('retry')) {
  const query=new URLSearchParams();
  if(['1','none'].includes(params.get('program')))query.set('program',params.get('program'));
  if(typeof retry==='string'&&/^[A-Za-z0-9_-]{1,120}$/.test(retry))query.set('retry',retry);
  return '#/mock'+(query.size?'?'+query:'');
}
export function mockCalibrationRoute(params,retry=params?.get('retry')) {
  const query=mockSetupRoute(params,retry).split('?')[1];
  return '#/devices?return=mock'+(query?'&'+query:'');
}

// Ephemeral evidence belongs to this capture owner and authenticated subject.
// Reload/account/device replacement requires fresh media proof, not exercises.
export function preInterviewReady(receipt,controller) {
  return Boolean(receipt&&receipt.subject===controller.account?.subject&&
    receipt.account===controller.account&&receipt.durable===controller.durable&&
    receipt.engine===controller.engine&&receipt.stream===controller.stream&&
    controller.phase==='READY'&&receipt.previewVerified===true&&
    receipt.camera===controller.stream?.getVideoTracks?.()[0]&&
    receipt.microphone===controller.stream?.getAudioTracks?.()[0]&&
    [receipt.camera,receipt.microphone].every(t=>t?.readyState==='live'&&t.enabled&&!t.muted));
}

export function waitForInterviewEntry({delaySeconds=0,signal,isCurrent=()=>true,onTick=()=>{},
  now=()=>performance.now(),schedule=setTimeout,cancel=clearTimeout}={}) {
  return new Promise((resolve,reject)=>{
    let timer,settled=false;
    const finish=error=>{
      if(settled)return;settled=true;cancel(timer);signal?.removeEventListener('abort',abort);
      error?reject(error):resolve();
    };
    const abort=()=>finish(Object.assign(new Error('Interview start cancelled.'),{name:'AbortError'}));
    signal?.addEventListener('abort',abort,{once:true});
    const begun=now(),delay=delaySeconds===30?30000:0;
    const tick=()=>{
      if(signal?.aborted||!isCurrent())return abort();
      const elapsed=Math.max(0,now()-begun);
      if(elapsed>=delay+10000)return finish();
      try{
        onTick(elapsed<delay
          ?{phase:'waiting',seconds:Math.ceil((delay-elapsed)/1000)}
          :{phase:'countdown',seconds:Math.ceil((delay+10000-elapsed)/1000)});
      }catch(error){return finish(error);}
      if(!settled)timer=schedule(tick,100);
    };
    tick();
  });
}
