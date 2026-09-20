import { INTERVIEWER_AUDIO_AUTHORITIES } from '../../ivprep-v6/avatar/audio-authority.mjs';

export const EMBODIMENT_SCHEMA = 'missionmed.ivoc.embodiment.v1';

const ROLES = Object.freeze({
  program_director: 'Program Director',
  faculty: 'Faculty',
  chief_resident: 'Chief Resident',
});

const STYLES = Object.freeze({
  dove: Object.freeze({ label: 'Dove', tone: 'warm and supportive' }),
  peacock: Object.freeze({ label: 'Peacock', tone: 'expressive and conversational' }),
  owl: Object.freeze({ label: 'Owl', tone: 'measured and analytical' }),
  eagle: Object.freeze({ label: 'Eagle', tone: 'direct and challenging' }),
});

const PROFILE_NAMES = Object.freeze({
  program_director: Object.freeze({ dove: 'Avery', peacock: 'Jordan', owl: 'Morgan', eagle: 'Cameron' }),
  faculty: Object.freeze({ dove: 'Riley', peacock: 'Taylor', owl: 'Quinn', eagle: 'Casey' }),
  chief_resident: Object.freeze({ dove: 'Jamie', peacock: 'Skyler', owl: 'Reese', eagle: 'Drew' }),
});

export const FICTIONAL_INTERVIEWER_PROFILES = Object.freeze(
  Object.entries(ROLES).flatMap(([roleId, roleLabel]) => Object.entries(STYLES).map(([styleId, style]) => Object.freeze({
    profileId: `${roleId}:${styleId}`,
    displayName: PROFILE_NAMES[roleId][styleId],
    roleId,
    roleLabel,
    styleId,
    styleLabel: style.label,
    tone: style.tone,
    fictional: true,
    personClone: false,
    providerVoiceId: null,
    avatarAssetId: null,
  }))),
);

export const EMBODIMENT_RUNTIME_CONTRACT = Object.freeze({
  schema: EMBODIMENT_SCHEMA,
  directorAuthority: 'missionmed-interviewbrain',
  providerRole: 'actor-only',
  studentSelection: 'fictional-profile',
  providerSelectionExposedToStudent: false,
  audioAuthority: 'single',
  identity: Object.freeze({ generationId: 'required', responseId: 'required' }),
  staleOutputPolicy: 'reject-after-interrupt-or-supersession',
  interruption: Object.freeze({
    cancelProviderResponse: true,
    flushAudio: true,
    flushMotion: true,
  }),
  clock: Object.freeze({ basis: 'IVOC_SESSION_MS', monotonic: true }),
  motion: Object.freeze({ synchronizedToResponse: true, optional: true }),
});

export const EMBODIMENT_ADMIN_POLICY = Object.freeze({
  preview: Object.freeze({ enabled: true, adminOnly: true, maximumSeconds: 45 }),
  cost: Object.freeze({ reservationRequired: true, hardDeadline: true, retryCount: 0 }),
  providers: Object.freeze({
    openaiNativeAudio: 'available',
    externalTts: 'inactive',
    lemonSlice: 'deferred',
  }),
  activation: Object.freeze({ externalSpendAllowed: false, studentDefaultChangeAllowed: false }),
});

export function publicEmbodimentConfig() {
  return {
    schema: EMBODIMENT_SCHEMA,
    runtime: EMBODIMENT_RUNTIME_CONTRACT,
    adminPolicy: EMBODIMENT_ADMIN_POLICY,
    profiles: FICTIONAL_INTERVIEWER_PROFILES,
  };
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u;
const EVENT_KINDS = new Set(['audio_started', 'audio_delta', 'audio_completed', 'motion_frame', 'completed']);

function validId(value) { return typeof value === 'string' && SAFE_ID.test(value); }

export class EmbodimentGenerationGate {
  constructor({ audioAuthority } = {}) {
    if (!audioAuthority || typeof audioAuthority.begin !== 'function'
        || typeof audioAuthority.finish !== 'function' || typeof audioAuthority.interrupt !== 'function') {
      throw new TypeError('The existing single-audio authority is required.');
    }
    this.audioAuthority = audioAuthority;
    this.active = null;
  }

  begin({ profileId, generationId, responseId, audioAuthority }) {
    if (this.active) throw new Error('An embodiment generation is already active.');
    if (!FICTIONAL_INTERVIEWER_PROFILES.some((profile) => profile.profileId === profileId)) {
      throw new TypeError('Unknown fictional interviewer profile.');
    }
    if (!validId(generationId) || !validId(responseId)
        || !Object.values(INTERVIEWER_AUDIO_AUTHORITIES).includes(audioAuthority)) {
      throw new TypeError('Invalid embodiment generation identity.');
    }
    this.active = { profileId, generationId, responseId, audioAuthority, lastAtMs: -1, audible: false };
    return { ...this.active };
  }

  accept({ kind, generationId, responseId, atMs }) {
    if (!this.active || generationId !== this.active.generationId || responseId !== this.active.responseId) {
      return Object.freeze({ accepted: false, reason: 'stale_generation' });
    }
    if (!EVENT_KINDS.has(kind) || !Number.isFinite(atMs) || atMs < 0) {
      throw new TypeError('Invalid embodiment event.');
    }
    if (atMs < this.active.lastAtMs) return Object.freeze({ accepted: false, reason: 'clock_regression' });
    this.active.lastAtMs = atMs;
    if (kind === 'audio_started') {
      if (this.active.audible) return Object.freeze({ accepted: false, reason: 'duplicate_audio' });
      this.audioAuthority.begin({ authority: this.active.audioAuthority, utteranceId: responseId });
      this.active.audible = true;
    }
    if (kind === 'audio_completed' && this.active.audible) {
      this.audioAuthority.finish({ reason: 'complete' });
      this.active.audible = false;
    }
    if (kind === 'completed') return this.complete();
    return Object.freeze({ accepted: true, kind, atMs });
  }

  interrupt() {
    if (!this.active) return Object.freeze({ interrupted: false });
    if (this.active.audible) this.audioAuthority.interrupt();
    const identity = { generationId: this.active.generationId, responseId: this.active.responseId };
    this.active = null;
    return Object.freeze({
      interrupted: true,
      ...identity,
      ...EMBODIMENT_RUNTIME_CONTRACT.interruption,
    });
  }

  complete() {
    if (!this.active) return Object.freeze({ completed: false });
    if (this.active.audible) this.audioAuthority.finish({ reason: 'complete' });
    const identity = { generationId: this.active.generationId, responseId: this.active.responseId };
    this.active = null;
    return Object.freeze({ completed: true, ...identity });
  }
}
