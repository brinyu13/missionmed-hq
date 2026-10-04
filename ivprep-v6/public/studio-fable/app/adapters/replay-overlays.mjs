// Reuse the established ephemeral playback detector/overlay owner. No capture,
// new persistence, provider session, raw landmark storage or audio publisher.
const loadOwner=()=>Promise.all([import('../../../analytics/browser-pipeline.mjs'),import('../../../analytics/ui.mjs')]);
export function replayOverlays({video,documentRef=video?.ownerDocument,isCurrent=()=>true,onStatus=()=>{},load=loadOwner}={}) {
  let disposed=false,generation=0,owner=null,pipeline=null;
  const current=()=>!disposed&&isCurrent()&&video?.isConnected!==false;
  const clear=()=>{
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
        pipeline.addEventListener('state',event=>{if(current()&&['partial','unavailable'].includes(event.detail?.state))onStatus('unavailable');});
        const begin=pipeline.beginPlayback.bind(pipeline);
        pipeline.beginPlayback=options=>current()?begin(options):false;
        owner=new StudentSurfaceOverlayController({pipeline:{setInstrumentation(){},setOverlayConsumer(){}},playbackPipeline:pipeline,documentRef,
          surfaceIds:{playback:video.id,playbackViews:['filmroom']}});
        const consume=owner.consumeOverlay.bind(owner);
        owner.consumeOverlay=(payload,source)=>{
          if(!current()){owner?.clearOverlay();return false;}
          const drawn=consume(payload,source);if(drawn)onStatus('drawn');return drawn;
        };
        owner.configure({authorized:true,enabled:true,face:true,bodyHands:true,studentPrimary:true});
        owner.onViewChange('filmroom','student');
        onStatus('ready');return true;
      }catch{if(request===generation){clear();if(current())onStatus('unavailable');}return false;}
    },
    destroy(){disposed=true;generation++;clear();},
  };
}
