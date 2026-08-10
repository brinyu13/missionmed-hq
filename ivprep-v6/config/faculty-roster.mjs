import { LIVE_INTERVIEWER_TARGET } from '../avatar/live-interviewer-target.mjs';

export const VERIFIED_DEXTER_AVATAR_ID = LIVE_INTERVIEWER_TARGET.avatarId;
export const VERIFIED_DEXTER_AVATAR_NAME = LIVE_INTERVIEWER_TARGET.avatarDisplayName;
export const DEFAULT_OPENAI_VOICE_ID = 'cedar';

const placeholder = (id, displayName, role, sex, overrides = {}) => Object.freeze({
  id,
  displayName,
  role,
  sex,
  specialty: ['Internal Medicine', 'Family Medicine'],
  institution: 'Fictional MissionMed alpha faculty',
  avatarProvider: 'liveavatar',
  avatarId: null,
  avatarDisplayName: null,
  voiceProvider: 'openai',
  voiceId: DEFAULT_OPENAI_VOICE_ID,
  preferredModel: 'gpt-5.6-terra',
  behaviorPreset: 'direct-program-director',
  warmth: 55,
  pressure: 55,
  interruptionStyle: 'contextual-only',
  seniority: 'senior-faculty',
  interviewFormat: ['traditional', 'behavioral'],
  availability: 'coming-later',
  licensingConsentStatus: 'not-configured',
  alphaProductionStatus: 'placeholder-only',
  founderOnlyNotes: 'No licensed stock avatar is configured for this record.',
  ...overrides,
});

export const FACULTY_ROSTER = Object.freeze([
  placeholder('senior-academic-pd-male', LIVE_INTERVIEWER_TARGET.participantDisplayName, 'AI Interviewer', 'male', {
    avatarId: VERIFIED_DEXTER_AVATAR_ID,
    avatarDisplayName: VERIFIED_DEXTER_AVATAR_NAME,
    availability: 'provider-auth-required',
    licensingConsentStatus: 'provider-stock-active',
    alphaProductionStatus: 'founder-alpha-only',
    lockedVoiceTargetId: LIVE_INTERVIEWER_TARGET.voiceId,
    lockedVoiceTargetName: LIVE_INTERVIEWER_TARGET.voiceDisplayName,
    founderOnlyNotes: 'Founder-locked provider stock avatar. OpenAI voice ID cedar is the truthful audible voice in the current LITE supplied-PCM path. Exact W. Clint compatibility with Dexter requires fresh authenticated provider proof.',
    warmth: 45,
    pressure: 68,
  }),
  placeholder('senior-academic-pd-female', 'Senior Academic Program Director — Female', 'Senior Academic Program Director', 'female', { pressure: 68 }),
  placeholder('warm-community-faculty-male', 'Warm Community Faculty — Male', 'Community Faculty', 'male', { warmth: 82, pressure: 34 }),
  placeholder('warm-community-faculty-female', 'Warm Community Faculty — Female', 'Community Faculty', 'female', { warmth: 82, pressure: 34 }),
  placeholder('junior-faculty-apd-male', 'Junior Faculty/APD — Male', 'Associate Program Director', 'male', { seniority: 'junior-faculty', warmth: 66 }),
  placeholder('junior-faculty-apd-female', 'Junior Faculty/APD — Female', 'Associate Program Director', 'female', { seniority: 'junior-faculty', warmth: 66 }),
  placeholder('senior-resident-male', 'Senior Resident — Male', 'Senior Resident', 'male', { seniority: 'resident', warmth: 72, pressure: 38 }),
  placeholder('senior-resident-female', 'Senior Resident — Female', 'Senior Resident', 'female', { seniority: 'resident', warmth: 72, pressure: 38 }),
  placeholder('indian-faculty-male', 'Indian Faculty — Male', 'Faculty', 'male', {
    founderOnlyNotes: 'Coming Later. No verified provider voice or avatar is configured; no accent is fabricated.',
  }),
  placeholder('indian-faculty-female', 'Indian Faculty — Female', 'Faculty', 'female', {
    founderOnlyNotes: 'Coming Later. No verified provider voice or avatar is configured; no accent is fabricated.',
  }),
  placeholder('behavioral-interviewer-male', 'Behavioral Interviewer — Male', 'Behavioral Interviewer', 'male', { behaviorPreset: 'behavioral-faculty', interviewFormat: ['behavioral'], warmth: 52 }),
  placeholder('behavioral-interviewer-female', 'Behavioral Interviewer — Female', 'Behavioral Interviewer', 'female', { behaviorPreset: 'behavioral-faculty', interviewFormat: ['behavioral'], warmth: 52 }),
  placeholder('high-pressure-faculty-male', 'High-Pressure Faculty — Male', 'Faculty', 'male', { behaviorPreset: 'high-pressure-faculty', pressure: 88, warmth: 30 }),
  placeholder('high-pressure-faculty-female', 'High-Pressure Faculty — Female', 'Faculty', 'female', { behaviorPreset: 'high-pressure-faculty', pressure: 88, warmth: 30 }),
  placeholder('doc-hollywood-male', 'Doc Hollywood — Male', 'Faculty', 'male', {
    availability: 'custom-avatar-required',
    licensingConsentStatus: 'custom-avatar-not-authorized',
    founderOnlyNotes: 'Optional non-explicit placeholder: glamorous, athletic physician in fitted professional scrubs. No avatar purchase or generation authorized.',
  }),
  placeholder('doc-hollywood-female', 'Doc Hollywood — Female', 'Faculty', 'female', {
    availability: 'custom-avatar-required',
    licensingConsentStatus: 'custom-avatar-not-authorized',
    founderOnlyNotes: 'Optional non-explicit placeholder: glamorous, polished physician in professional wardrobe with tasteful neckline. No avatar purchase or generation authorized.',
  }),
]);

export function publicFacultyRoster({ liveAvatarConfigured = false, openaiConfigured = false } = {}) {
  return FACULTY_ROSTER.map((record) => {
    const providerReady = Boolean(record.avatarId && liveAvatarConfigured && openaiConfigured);
    return {
      ...record,
      available: providerReady,
      availability: providerReady ? 'available-alpha' : record.availability,
      voiceFallbackAvailable: Boolean(record.voiceId && openaiConfigured),
    };
  });
}

export function surpriseAssignment({ specialty, liveAvatarConfigured, openaiConfigured, random = Math.random } = {}) {
  const eligible = publicFacultyRoster({ liveAvatarConfigured, openaiConfigured }).filter((record) => (
    record.available
    && record.licensingConsentStatus === 'provider-stock-active'
    && (!specialty || record.specialty.includes(specialty))
  ));
  if (!eligible.length) return null;
  const index = Math.min(eligible.length - 1, Math.max(0, Math.floor(random() * eligible.length)));
  return eligible[index];
}
