// Reuse the established ephemeral playback detector/overlay owner. No capture,
// new persistence, provider session, raw landmark storage or audio publisher.
const loadOwner=()=>Promise.all([import('../../../analytics/browser-pipeline.mjs'),import('../../../analytics/ui.mjs')]);
const REPLAY_FRESHNESS_MS=1500;
export function replayOverlays({video,documentRef=video?.ownerDocument,isCurrent=()=>true,onStatus=()=>{},load=loadOwner,
  schedule=setTimeout,cancel=clearTimeout}={}) {
  let disposed=false,generation=0,owner=null,pipeline=null,freshnessTimer=null;
  const current=()=>!disposed&&isCurrent()&&video?.isConnected!==false;
  const stopFreshness=expectedOwner=>{if(freshnessTimer!==null&&(!expectedOwner||freshnessTimer.owner===expectedOwner)){cancel(freshnessTimer.handle);freshnessTimer=null;}};
  const clear=()=>{
    stopFreshness();
    owner?.configure({authorized:false,enabled:false});
    owner?.destroy();pipeline?.destroy();owner=null;pipeline=null;
  };
  return {
    async setEnabled(enabled){
      const request=++generation;
      if(!current()){clear();return false;}
      if(!enabled){clear();onStatus('off');return false;}
      if(owner)return true;
      onStatus('loading');
      try{
        const [{BrowserAnalyticsPipeline},{StudentSurfaceOverlayController}]=await load();
        if(!current()||request!==generation)return false;
        // Playback uses only the already authorized video. This bridge has no
        // acquisition methods and beginPlayback never starts the microphone.
        pipeline=new BrowserAnalyticsPipeline({bridge:{media:{}}});
        const exactPipeline=pipeline;
        pipeline.addEventListener('state',event=>{
          if(!current()||pipeline!==exactPipeline)return;const detail=event.detail||{};
          if(detail.state==='idle'||detail.state==='partial'&&detail.message==='playback_stopped')onStatus('ready');
          else if(detail.state==='running')onStatus('waiting');
          else if(['partial','unavailable'].includes(detail.state))onStatus('unavailable');
        });
        const begin=pipeline.beginPlayback.bind(pipeline);
        pipeline.beginPlayback=options=>current()?begin(options):false;
        owner=new StudentSurfaceOverlayController({pipeline:{setInstrumentation(){},setOverlayConsumer(){}},playbackPipeline:pipeline,documentRef,
          surfaceIds:{playback:video.id,playbackViews:['filmroom']}});
        const exactOwner=owner;
        const clearDrawing=owner.clearOverlay.bind(owner);
        owner.clearOverlay=()=>{stopFreshness(exactOwner);clearDrawing();};
        // A layer change must not leave a bitmap made under the old policy.
        // Reset only the ephemeral replay analysis epoch, not video playback,
        // saved Analytics, audio, capture or the canonical session.
        const toggle=owner.toggleOverlayPart.bind(owner);
        owner.toggleOverlayPart=key=>{
          if(!current()||owner!==exactOwner||!['face','bodyHands'].includes(key))return false;
          stopFreshness(exactOwner);exactOwner.stopPlayback('overlay_layers_changed');
          const changed=toggle(key);exactOwner.startPlayback();return changed;
        };
        const consume=owner.consumeOverlay.bind(owner);
        owner.consumeOverlay=(payload,source)=>{
          if(!current()||owner!==exactOwner){exactOwner.clearOverlay();return false;}
          const age=payload?.pipelineMs;
          if(typeof age!=='number'||!Number.isFinite(age)||age<0||age>=REPLAY_FRESHNESS_MS){
            exactOwner.clearOverlay();onStatus('waiting');return false;
          }
          stopFreshness(exactOwner);
          const drawn=consume(payload,source);
          if(drawn){
            onStatus('drawn');
            // The capture-to-result inference time already consumed part of
            // the freshness budget. Arrival does not make old geometry fresh.
            const timer={owner:exactOwner,handle:null};freshnessTimer=timer;
            timer.handle=schedule(()=>{if(freshnessTimer!==timer)return;freshnessTimer=null;exactOwner.clearOverlay();if(current()&&owner===exactOwner)onStatus('waiting');},REPLAY_FRESHNESS_MS-age);
          }
          return drawn;
        };
        owner.configure({authorized:true,enabled:true,face:true,bodyHands:true,studentPrimary:true});
        owner.onViewChange('filmroom','student');
        onStatus('ready');return true;
      }catch{if(request===generation){clear();if(current())onStatus('unavailable');}return false;}
    },
    destroy(){disposed=true;generation++;clear();},
  };
}
