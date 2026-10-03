// A local pixel aggregate proves this exact video surface is rendering.
// No second capture, raw frame persistence, or permission-only acceptance.
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
