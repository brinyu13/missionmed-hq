export const DEFAULT_SPEECH_MODEL = 'gpt-4o-mini-tts';
export const DEFAULT_SPEECH_VOICE_ID = 'cedar';

export const OPENAI_SPEECH_VOICE_IDS = Object.freeze([
  'alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova',
  'onyx', 'sage', 'shimmer', 'verse', 'marin', 'cedar',
]);

export const OPENAI_REALTIME_VOICE_IDS = Object.freeze([
  'alloy', 'ash', 'ballad', 'coral', 'echo',
  'sage', 'shimmer', 'verse', 'marin', 'cedar',
]);

export const SPEECH_FORMATS = Object.freeze(['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm']);

export const VOICE_PRESETS = Object.freeze([
  {
    id: 'experienced-male-program-director',
    displayName: 'Experienced Male Program Director',
    provider: 'openai',
    providerVoiceId: 'cedar',
    speed: 0.92,
    instructions: 'Use a natural experienced male program director presentation. Sound confident, calm, direct, clinically credible, and unhurried. Avoid announcer cadence and exaggerated authority.',
  },
  {
    id: 'warm-female-faculty',
    displayName: 'Warm Female Faculty',
    provider: 'openai',
    providerVoiceId: 'marin',
    speed: 0.94,
    instructions: 'Use a natural adult female faculty physician presentation. Sound professional, supportive, academically grounded, attentive, and warm without sounding like customer support.',
  },
  {
    id: 'senior-female-program-director',
    displayName: 'Senior Female Program Director',
    provider: 'openai',
    providerVoiceId: 'coral',
    speed: 0.95,
    instructions: 'Use a natural senior female program director presentation. Sound professional, firm, composed, discerning, and high-standard without sounding hostile or theatrical.',
  },
  {
    id: 'young-resident',
    displayName: 'Young Resident',
    provider: 'openai',
    providerVoiceId: 'shimmer',
    speed: 1.02,
    instructions: 'Use a natural young resident physician presentation. Sound friendly, conversational, encouraging, and clinically professional. Avoid bubbly virtual-assistant energy.',
  },
]);

export const DEFAULT_VOICE_PRESET_ID = 'experienced-male-program-director';

// Founder preference is preserved without inventing a provider binding. No donor
// or authenticated provider evidence currently maps this display name to an ID.
export const PREFERRED_FOUNDER_VOICE = Object.freeze({
  displayName: 'W. Clint Oxley',
  providerVoiceId: null,
  verification: 'unverified',
});

export function requireSpeechVoiceId(value = DEFAULT_SPEECH_VOICE_ID) {
  if (!OPENAI_SPEECH_VOICE_IDS.includes(value)) throw new TypeError('Unsupported OpenAI Speech voice ID.');
  return value;
}

export function requireRealtimeVoiceId(value = DEFAULT_SPEECH_VOICE_ID) {
  if (!OPENAI_REALTIME_VOICE_IDS.includes(value)) throw new TypeError('Unsupported OpenAI Realtime voice ID.');
  return value;
}

export function normalizeSpeechSelection(input = {}) {
  const preset = input.presetId
    ? VOICE_PRESETS.find((candidate) => candidate.id === input.presetId)
    : VOICE_PRESETS.find((candidate) => candidate.id === DEFAULT_VOICE_PRESET_ID);
  if (!preset) throw new TypeError('Unsupported voice preset.');
  const speed = input.speed === undefined ? preset.speed : Number(input.speed);
  if (!Number.isFinite(speed) || speed < 0.25 || speed > 4) throw new TypeError('Speech speed must be between 0.25 and 4.');
  const format = input.format || 'mp3';
  if (!SPEECH_FORMATS.includes(format)) throw new TypeError('Unsupported speech output format.');
  return {
    presetId: preset.id,
    voiceId: requireSpeechVoiceId(input.voiceId || preset.providerVoiceId),
    speed,
    format,
    instructions: typeof input.instructions === 'string' && input.instructions.trim()
      ? input.instructions.trim()
      : preset.instructions,
  };
}

export function publicVoiceStudioConfig({ configured = false } = {}) {
  return {
    configured: Boolean(configured),
    founderOnly: true,
    aiVoiceDisclosureRequired: true,
    defaultSpeechModel: DEFAULT_SPEECH_MODEL,
    defaultPresetId: DEFAULT_VOICE_PRESET_ID,
    defaultVoiceId: DEFAULT_SPEECH_VOICE_ID,
    speechVoiceIds: OPENAI_SPEECH_VOICE_IDS,
    realtimeVoiceIds: OPENAI_REALTIME_VOICE_IDS,
    formats: SPEECH_FORMATS,
    presets: VOICE_PRESETS,
    preferredFounderVoice: PREFERRED_FOUNDER_VOICE,
  };
}
