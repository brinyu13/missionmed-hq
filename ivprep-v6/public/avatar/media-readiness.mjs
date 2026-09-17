export function liveMediaReady({ videoReady = false, audioReady = false, audioPlaybackReady = false } = {}) {
  return Boolean(videoReady && audioReady && audioPlaybackReady);
}

export function liveMediaState(readiness = {}) {
  if (liveMediaReady(readiness)) return 'live';
  if (readiness.videoReady && readiness.audioReady && !readiness.audioPlaybackReady) return 'audio-blocked';
  if (readiness.videoReady && readiness.audioReady) return 'media-ready';
  if (readiness.videoReady) return 'video-ready';
  if (readiness.audioReady) return 'audio-only-degraded';
  return 'connecting';
}
