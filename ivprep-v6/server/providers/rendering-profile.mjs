export const RENDERING_PROFILES = Object.freeze({
  A: Object.freeze({
    id: 'PROFILE_A_ELEVENLABS',
    enabled: false,
    realtimeOutput: 'text',
    tts: 'elevenlabs',
    audioAuthority: 'avatar-livekit',
  }),
  B: Object.freeze({
    id: 'PROFILE_B_OPENAI_NATIVE_AUDIO',
    enabled: true,
    realtimeOutput: 'audio',
    tts: null,
    audioAuthority: 'avatar-livekit',
  }),
  VOICE_ONLY: Object.freeze({
    id: 'VOICE_ONLY_OPENAI_NATIVE_AUDIO',
    enabled: true,
    realtimeOutput: 'audio',
    tts: null,
    audioAuthority: 'direct-livekit',
  }),
});

export function selectRenderingProfile(value, { profileAReceipt = null } = {}) {
  if (value === 'A') {
    if (!profileAReceipt?.test1UnmetItem || !profileAReceipt?.approvedVoiceId) throw new Error('Profile A remains gated.');
    return Object.freeze({ ...RENDERING_PROFILES.A, enabled: true, approvedVoiceId: profileAReceipt.approvedVoiceId });
  }
  if (value === 'VOICE_ONLY') return RENDERING_PROFILES.VOICE_ONLY;
  return RENDERING_PROFILES.B;
}
