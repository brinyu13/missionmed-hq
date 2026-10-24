import { LIVEAVATAR_PROVIDER_MODES } from './liveavatar-modes.mjs';

export const LIVE_INTERVIEWER_TARGET = Object.freeze({
  provider: 'liveavatar',
  avatarId: 'bd43ce31-7425-4379-8407-60f029548e61',
  avatarDisplayName: 'Dexter Doctor Sitting',
  participantDisplayName: 'Dexter · MissionMed AI Faculty',
  voiceId: 'a33a57ab-8388-49fc-a069-dbcfd1bc5405',
  voiceDisplayName: 'W. Clint Oxley',
  intelligenceOwner: 'conversation-rail',
});

export const LIVE_INTERVIEWER_DELIVERY_PROFILES = Object.freeze({
  LITE_PCM: Object.freeze({
    id: 'liveavatar-lite-supplied-pcm',
    mode: LIVEAVATAR_PROVIDER_MODES.LITE,
    audioAuthority: 'liveavatar-livekit',
    audioInput: Object.freeze({ encoding: 'pcm_s16le', sampleRateHz: 24_000, channels: 1 }),
    providerVoiceSelectionSupported: false,
    audibleVoiceTruth: 'supplied-audio-voice',
  }),
  LOCKED_VOICE_TARGET: Object.freeze({
    id: 'dexter-w-clint-provider-voice-target',
    audioAuthority: 'liveavatar-livekit',
    providerVoiceSelectionSupported: null,
    currentProviderVerificationRequired: true,
    audibleVoiceTruth: 'unverified-until-authenticated-provider-proof',
  }),
});

export function resolveLockedAvatarId(candidate) {
  const value = String(candidate || '').trim();
  if (value && value !== LIVE_INTERVIEWER_TARGET.avatarId) {
    throw new TypeError('Configured LiveAvatar ID does not match the Founder-locked Dexter asset.');
  }
  return LIVE_INTERVIEWER_TARGET.avatarId;
}

export function publicLiveInterviewerTarget({
  hasServerAuthorization = false,
  hasApprovedLiveKitOrigin = false,
  authenticatedAvatarVerified = false,
  authenticatedVoiceVerified = false,
  lockedVoiceCompatible = false,
  liveSessionBlock = null,
} = {}) {
  return Object.freeze({
    ...LIVE_INTERVIEWER_TARGET,
    serverAuthPresent: Boolean(hasServerAuthorization),
    hasApprovedLiveKitOrigin: Boolean(hasApprovedLiveKitOrigin),
    authenticatedAvatarVerified: Boolean(authenticatedAvatarVerified),
    authenticatedVoiceVerified: Boolean(authenticatedVoiceVerified),
    lockedVoiceCompatible: Boolean(lockedVoiceCompatible),
    liveSessionBlock: typeof liveSessionBlock === 'string' ? liveSessionBlock : null,
    ready: Boolean(
      hasServerAuthorization
      && hasApprovedLiveKitOrigin
      && authenticatedAvatarVerified
      && authenticatedVoiceVerified
      && lockedVoiceCompatible
    ),
  });
}
