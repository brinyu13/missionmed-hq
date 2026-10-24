export const LIVEAVATAR_PROVIDER_MODES = Object.freeze({
  LITE: 'LITE',
  FULL: 'FULL',
});

const PROFILES = Object.freeze({
  [LIVEAVATAR_PROVIDER_MODES.LITE]: Object.freeze({
    id: 'liveavatar-lite-supplied-pcm',
    provider: 'liveavatar',
    providerMode: LIVEAVATAR_PROVIDER_MODES.LITE,
    displayName: 'LITE',
    implemented: true,
    capabilityVersion: 1,
    intelligenceOwner: 'conversation-rail',
    usageClass: 'liveavatar-lite-session-minute',
    capabilities: Object.freeze({
      supportsSuppliedAudio: true,
      supportsProviderVoice: false,
      supportsProviderAgent: false,
      supportsInterrupt: true,
      supportsListeningState: false,
      supportsRealtimeVideo: true,
      supportsReconnect: true,
      mediaTransport: 'livekit',
      utteranceInput: 'pcm_s16le_24000_mono',
    }),
    providerAdvertisedCapabilities: Object.freeze({
      supportsSuppliedAudio: true,
      supportsProviderVoice: false,
      supportsProviderAgent: false,
      supportsInterrupt: true,
      supportsListeningState: true,
      supportsRealtimeVideo: true,
      supportsReconnect: true,
    }),
  }),
  [LIVEAVATAR_PROVIDER_MODES.FULL]: Object.freeze({
    id: 'liveavatar-full-provider-orchestration',
    provider: 'liveavatar',
    providerMode: LIVEAVATAR_PROVIDER_MODES.FULL,
    displayName: 'FULL',
    implemented: false,
    capabilityVersion: 1,
    intelligenceOwner: 'provider-unless-custom-llm-bridge',
    usageClass: 'liveavatar-full-session-minute',
    capabilities: Object.freeze({
      supportsSuppliedAudio: false,
      supportsProviderVoice: false,
      supportsProviderAgent: false,
      supportsInterrupt: false,
      supportsListeningState: false,
      supportsRealtimeVideo: false,
      supportsReconnect: false,
      mediaTransport: null,
      utteranceInput: null,
    }),
    providerAdvertisedCapabilities: Object.freeze({
      supportsSuppliedAudio: null,
      supportsProviderVoice: true,
      supportsProviderAgent: true,
      supportsInterrupt: true,
      supportsListeningState: true,
      supportsRealtimeVideo: true,
      supportsReconnect: null,
    }),
    blockedReason: 'FULL is recognized but disabled until an authenticated custom-LLM or utterance bridge preserves MissionMed Conversation Rail intelligence.',
  }),
});

export function resolveLiveAvatarProviderMode(value = 'lite') {
  const candidate = String(value || 'lite').trim().toUpperCase();
  if (candidate === LIVEAVATAR_PROVIDER_MODES.LITE) return LIVEAVATAR_PROVIDER_MODES.LITE;
  if (candidate === LIVEAVATAR_PROVIDER_MODES.FULL) return LIVEAVATAR_PROVIDER_MODES.FULL;
  throw new TypeError('LIVEAVATAR_MODE must resolve to the exact provider value LITE or FULL. Embed is a separate hosted integration surface, not a session mode.');
}

export function liveAvatarModeProfile(value = LIVEAVATAR_PROVIDER_MODES.LITE) {
  return PROFILES[resolveLiveAvatarProviderMode(value)];
}

export function publicLiveAvatarModeProfile(value = LIVEAVATAR_PROVIDER_MODES.LITE) {
  const profile = liveAvatarModeProfile(value);
  return Object.freeze({
    id: profile.id,
    provider: profile.provider,
    providerMode: profile.providerMode,
    displayName: profile.displayName,
    implemented: profile.implemented,
    capabilityVersion: profile.capabilityVersion,
    intelligenceOwner: profile.intelligenceOwner,
    usageClass: profile.usageClass,
    capabilities: profile.capabilities,
    providerAdvertisedCapabilities: profile.providerAdvertisedCapabilities,
    blockedReason: profile.blockedReason || null,
  });
}

export function liveAvatarModeStartupDecision(value = LIVEAVATAR_PROVIDER_MODES.LITE) {
  const profile = liveAvatarModeProfile(value);
  return Object.freeze(profile.implemented
    ? { providerMode: profile.providerMode, bootstrapProvider: true, fallback: null, block: null }
    : { providerMode: profile.providerMode, bootstrapProvider: false, fallback: 'voice-only', block: 'unsupported-mode' });
}
