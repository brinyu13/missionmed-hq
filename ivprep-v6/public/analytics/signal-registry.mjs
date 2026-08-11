import { ANALYTICS_ENGINE_VERSION, EVENT_SCHEMA, MATURITY } from './event-contract.mjs';

export const VALIDATION_RECORD = Object.freeze({
  id: '3420r-deterministic-signal-validation-v1',
  status: 'PASS',
  fixtureManifest: 'fixtures/analytics/manifest.v1.json',
  fixtureManifestSha256: '5b4ef2c8666382eb36b92428fe2e1162586f95e71fb2e56aff3f8eba7b63a765',
  scope: 'deterministic-clock-and-digital-audio-observations-only',
  validatedSignals: Object.freeze(['answer_duration_ms', 'captured_level_dbfs', 'digital_clipping_fraction']),
  minimumCoverage: 0.8,
  minimumDurationMs: 1_000,
});

const DEFINITIONS = Object.freeze({
  answer_duration_ms: { family: 'voice', maturity: MATURITY.STUDENT_SAFE, validationId: VALIDATION_RECORD.id, label: 'Answer duration' },
  captured_level_dbfs: { family: 'voice', maturity: MATURITY.STUDENT_SAFE, validationId: VALIDATION_RECORD.id, label: 'Captured microphone level' },
  digital_clipping_fraction: { family: 'voice', maturity: MATURITY.STUDENT_SAFE, validationId: VALIDATION_RECORD.id, label: 'Digital clipping' },
  response_start_latency_ms: { family: 'voice', maturity: MATURITY.FOUNDER_EXPERIMENTAL, label: 'Detected speech start' },
  speech_active_ratio: { family: 'voice', maturity: MATURITY.FOUNDER_EXPERIMENTAL, label: 'Detected speech-active time' },
  energy_variation_db: { family: 'voice', maturity: MATURITY.FOUNDER_EXPERIMENTAL, label: 'Captured energy variation' },
  low_captured_level: { family: 'voice', maturity: MATURITY.FOUNDER_EXPERIMENTAL, label: 'Low captured microphone level' },
  pause_episode: { family: 'pause', maturity: MATURITY.FOUNDER_EXPERIMENTAL, label: 'Detected silence between speech' },
  word_rate_wpm: { family: 'voice', maturity: MATURITY.FOUNDER_EXPERIMENTAL, label: 'Transcript-derived word rate' },
  filler_token_count: { family: 'voice', maturity: MATURITY.FOUNDER_EXPERIMENTAL, label: 'Transcript-derived filler count' },
  hand_presence: { family: 'gesture', maturity: MATURITY.FOUNDER_EXPERIMENTAL, label: 'Hand visibility' },
  hand_motion_episode: { family: 'gesture', maturity: MATURITY.FOUNDER_EXPERIMENTAL, label: 'Hand movement episode' },
  gesture_zone: { family: 'gesture', maturity: MATURITY.FOUNDER_EXPERIMENTAL, label: 'Observed hand zone' },
  torso_presence: { family: 'pose', maturity: MATURITY.FOUNDER_EXPERIMENTAL, label: 'Shoulder and torso visibility' },
  lateral_torso_lean: { family: 'pose', maturity: MATURITY.FOUNDER_EXPERIMENTAL, label: 'Lateral torso angle' },
  body_sway_episode: { family: 'pose', maturity: MATURITY.FOUNDER_EXPERIMENTAL, label: 'Body sway episode' },
  face_presence: { family: 'face', maturity: MATURITY.FOUNDER_EXPERIMENTAL, label: 'Face visibility' },
  head_orientation_proxy: { family: 'face', maturity: MATURITY.FOUNDER_EXPERIMENTAL, label: 'Head orientation proxy' },
  camera_facing_proxy: { family: 'face', maturity: MATURITY.FOUNDER_EXPERIMENTAL, label: 'Camera-facing head position' },
  sustained_head_turn_episode: { family: 'face', maturity: MATURITY.FOUNDER_EXPERIMENTAL, label: 'Sustained head-turn episode' },
  facial_movement_episode: { family: 'face', maturity: MATURITY.FOUNDER_EXPERIMENTAL, label: 'Facial movement episode' },
  framing_center: { family: 'framing', maturity: MATURITY.FOUNDER_EXPERIMENTAL, label: 'Face position in frame' },
  multiple_faces_detected: { family: 'system', maturity: MATURITY.FOUNDER_EXPERIMENTAL, label: 'Multiple-face safety stop' },
  observation_gap: { family: 'system', maturity: MATURITY.FOUNDER_EXPERIMENTAL, label: 'Analysis coverage gap' },
  pitch_zero_crossing: { family: 'voice', maturity: MATURITY.REJECTED, label: 'Legacy zero-crossing pitch' },
  eye_contact: { family: 'face', maturity: MATURITY.REJECTED, label: 'Eye contact' },
  emotion: { family: 'face', maturity: MATURITY.REJECTED, label: 'Emotion' },
  semantic_gesture: { family: 'gesture', maturity: MATURITY.REJECTED, label: 'Semantic gesture meaning' },
});

const STUDENT_SAFE_INPUT = Object.freeze({
  answer_duration_ms: 'clock',
  captured_level_dbfs: 'mic',
  digital_clipping_fraction: 'mic',
});

const STUDENT_SAFE_ENGINE = Object.freeze({
  answer_duration_ms: 'missionmed-monotonic-clock',
  captured_level_dbfs: 'missionmed-web-audio',
  digital_clipping_fraction: 'missionmed-web-audio',
});

function validStudentPayload(event) {
  const value = event.observation?.value;
  if (event.metric === 'answer_duration_ms') return event.observation?.unit === 'ms' && Number.isFinite(value) && value === event.durationMs;
  if (event.metric === 'captured_level_dbfs') return event.observation?.unit === 'dBFS' && Number.isFinite(value) && value >= -160 && value <= 0;
  if (event.metric === 'digital_clipping_fraction') return event.observation?.unit === 'fraction' && Number.isFinite(value) && value >= 0 && value <= 1;
  return false;
}

export function signalDefinition(metric) {
  const definition = DEFINITIONS[String(metric || '').toLowerCase()];
  if (!definition) return Object.freeze({ family: 'system', maturity: MATURITY.FOUNDER_EXPERIMENTAL, label: 'Unregistered observation' });
  return Object.freeze({ ...definition });
}

export function maturityForSignal(metric) {
  return signalDefinition(metric).maturity;
}

export function registeredSignals() {
  return Object.entries(DEFINITIONS).map(([metric, definition]) => Object.freeze({ metric, ...definition }));
}

export function projectStudentEvents(events, { validationRecord = VALIDATION_RECORD } = {}) {
  if (validationRecord !== VALIDATION_RECORD || validationRecord.status !== 'PASS' || !/^[a-f0-9]{64}$/u.test(validationRecord.fixtureManifestSha256)) return [];
  return (events || []).filter((event) => {
    const definition = DEFINITIONS[event.metric];
    return Boolean(
      definition
      && definition.maturity === MATURITY.STUDENT_SAFE
      && definition.validationId === validationRecord.id
      && event.maturity === MATURITY.STUDENT_SAFE
      && event.quality?.reliability !== 'unavailable'
      && ['high', 'medium'].includes(event.quality?.reliability)
      && event.quality?.coverage >= validationRecord.minimumCoverage
      && event.durationMs >= validationRecord.minimumDurationMs
      && validationRecord.validatedSignals.includes(event.metric)
      && event.schema === EVENT_SCHEMA
      && event.source?.engineVersion === ANALYTICS_ENGINE_VERSION
      && event.source?.engine === STUDENT_SAFE_ENGINE[event.metric]
      && event.source?.input === STUDENT_SAFE_INPUT[event.metric]
      && validStudentPayload(event)
    );
  });
}

export function assertStudentProjection(events) {
  for (const event of events || []) {
    if (!projectStudentEvents([event]).length) throw new TypeError(`Unvalidated signal reached student results: ${event?.metric || 'unknown'}.`);
  }
  return true;
}
