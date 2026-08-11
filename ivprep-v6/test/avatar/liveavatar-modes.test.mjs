import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LIVEAVATAR_PROVIDER_MODES,
  liveAvatarModeStartupDecision,
  liveAvatarModeProfile,
  publicLiveAvatarModeProfile,
  resolveLiveAvatarProviderMode,
} from '../../avatar/liveavatar-modes.mjs';
import { createAvatarProviderFromEnv, liveAvatarConfigFromEnv } from '../../providers/liveavatar-provider.mjs';

const LOCKED_ENV = Object.freeze({
  LIVEAVATAR_API_KEY: 'unit-test-only',
  LIVEAVATAR_AVATAR_ID: 'bd43ce31-7425-4379-8407-60f029548e61',
});

test('LiveAvatar mode configuration defaults to exact provider LITE and preserves MissionMed intelligence', () => {
  const config = liveAvatarConfigFromEnv(LOCKED_ENV);
  assert.equal(config.mode, LIVEAVATAR_PROVIDER_MODES.LITE);
  assert.equal(config.deliveryProfile.id, 'liveavatar-lite-supplied-pcm');
  assert.equal(config.deliveryProfile.intelligenceOwner, 'conversation-rail');
  assert.equal(config.deliveryProfile.implemented, true);
  assert.equal(config.deliveryProfile.capabilities.supportsSuppliedAudio, true);
  assert.equal(config.deliveryProfile.capabilities.supportsProviderVoice, false);
  assert.equal(Object.isFrozen(config.deliveryProfile.capabilities), true);
});

test('lowercase configuration maps to exact provider values and unknown or Embed values fail closed', () => {
  assert.equal(resolveLiveAvatarProviderMode('lite'), 'LITE');
  assert.equal(resolveLiveAvatarProviderMode('full'), 'FULL');
  assert.throws(() => resolveLiveAvatarProviderMode('embed'), /separate hosted integration surface/);
  assert.throws(() => resolveLiveAvatarProviderMode('custom'), /LITE or FULL/);
});

test('FULL is a recognized future profile but cannot take over MissionMed intelligence', () => {
  const profile = publicLiveAvatarModeProfile('FULL');
  assert.equal(profile.providerMode, 'FULL');
  assert.equal(profile.implemented, false);
  assert.equal(profile.capabilities.supportsProviderVoice, false);
  assert.equal(profile.providerAdvertisedCapabilities.supportsProviderVoice, true);
  assert.match(profile.blockedReason, /MissionMed Conversation Rail intelligence/);

  const config = liveAvatarConfigFromEnv({ ...LOCKED_ENV, LIVEAVATAR_MODE: 'full' });
  assert.equal(config.configured, false);
  assert.equal(config.mode, 'FULL');
  const provider = createAvatarProviderFromEnv({ env: { ...LOCKED_ENV, LIVEAVATAR_MODE: 'full' } });
  assert.equal(provider.health().provider, 'liveavatar');
  assert.equal(provider.health().mode, 'FULL');
  assert.equal(provider.health().available, false);
  assert.equal(provider.health().implemented, false);
  assert.match(provider.health().blockedReason, /MissionMed Conversation Rail intelligence/);
  assert.equal(provider.usage().usageClass, 'liveavatar-full-session-minute');
});

test('mode profiles expose capability metadata rather than UI-specific conditionals', () => {
  const lite = liveAvatarModeProfile('LITE');
  const full = liveAvatarModeProfile('FULL');
  assert.equal(lite.capabilities.supportsRealtimeVideo, true);
  assert.equal(full.capabilities.supportsRealtimeVideo, false);
  assert.equal(full.providerAdvertisedCapabilities.supportsRealtimeVideo, true);
  assert.equal(lite.capabilities.supportsProviderAgent, false);
  assert.equal(full.capabilities.supportsProviderAgent, false);
  assert.equal(full.providerAdvertisedCapabilities.supportsProviderAgent, true);
  assert.notEqual(lite.usageClass, full.usageClass);
});

test('startup decisions bootstrap only implemented modes and preserve voice-only fallback', () => {
  assert.deepEqual(liveAvatarModeStartupDecision('LITE'), {
    providerMode: 'LITE', bootstrapProvider: true, fallback: null, block: null,
  });
  assert.deepEqual(liveAvatarModeStartupDecision('FULL'), {
    providerMode: 'FULL', bootstrapProvider: false, fallback: 'voice-only', block: 'unsupported-mode',
  });
});
