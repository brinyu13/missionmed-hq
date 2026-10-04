// A local pixel aggregate proves this exact video surface is rendering.
// No second capture, raw frame persistence, or permission-only acceptance.
export function hasUsableMicrophone(stream) {
  // The existing provider path consumes this first, authoritative input track.
  const track=stream?.getAudioTracks?.()[0];
  return Boolean(track?.readyState==='live'&&track.enabled===true&&track.muted!==true);
}
export function microphoneReadiness(stream,audioContext) {
  if(!hasUsableMicrophone(stream))return{ready:false,message:'Your microphone is not ready. Reconnect it or choose a microphone below before starting.'};
  if(audioContext?.state!=='running')return{ready:false,message:'Microphone audio is paused or unavailable. Check the preview again before starting.'};
  return{ready:true,message:''};
}
export function assertMicrophoneReady(stream,audioContext) {
  const readiness=microphoneReadiness(stream,audioContext);
  if(!readiness.ready)throw Object.assign(new Error(readiness.message),{code:'ivoc_microphone_not_ready'});
}
export async function awaitVisibleCamera(video, stream, { isCurrent = () => true, timeoutMs = 5000 } = {}) {
  const { summarizeVideoFramePixels, CAMERA_BLACK_MESSAGE } = await import('/iv-prep-on-call/assets/studio/media-analytics-capability.mjs');
  const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 48;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Camera preview cannot be checked in this browser.');
  const deadline = performance.now() + timeoutMs;
  let hadDimensions = false;
  do {
    if (!isCurrent()) throw new Error('Camera setup was cancelled.');
    if (video.srcObject !== stream || !stream?.getVideoTracks().some(t => t.readyState === 'live')) throw new Error('Camera disconnected. Connect it again before starting.');
    await video.play();
    if (!video.paused && video.videoWidth >= 16 && video.videoHeight >= 16 && stream.getVideoTracks().some(t => t.enabled && !t.muted)) {
      hadDimensions = true;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      if (summarizeVideoFramePixels(ctx.getImageData(0, 0, canvas.width, canvas.height).data).visible) return true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (performance.now() < deadline);
  throw new Error(hadDimensions ? CAMERA_BLACK_MESSAGE : 'Camera connected, but the preview has not rendered. Reconnect or select another camera.');
}
