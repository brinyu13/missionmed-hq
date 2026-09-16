export const SIGNAL_SCHEMA = 'ivoc.signal.v1';

export const FORBIDDEN_INFERENCES = Object.freeze([
  'emotion', 'honesty', 'deception', 'anxiety', 'personality',
  'clinical_competence', 'employability', 'hirability',
  'protected_traits', 'program_fit',
]);

const descriptor = (signalId, family, kind, cadenceHz, unit, tier, inputs, limits = []) => Object.freeze({
  schema: SIGNAL_SCHEMA,
  signal_id: signalId,
  version: '1.0.0',
  family,
  detector: Object.freeze({ runtime: 'browser', module: `ivoc/analytics/runtime/${family}` }),
  inputs: Object.freeze(inputs),
  sample: Object.freeze({ kind, ...(cadenceHz ? { cadence_hz: cadenceHz } : {}), ...(unit ? { unit } : {}) }),
  reliability: Object.freeze({ tier, notes: 'M1 measured signal; limitations must remain visible.' }),
  availability_rules: Object.freeze(['active admitted stream', 'current-session sample only']),
  retention: kind === 'series' ? 'session_series' : 'summary_only',
  calibration: Object.freeze({ personal_corridor: [7, 8], scale_0_10: true, inline_control: true }),
  renderers: Object.freeze({ live: `${signalId}.live`, timeline: `${signalId}.timeline`, summary: `${signalId}.summary` }),
  visibility: Object.freeze({ student_default: true, admin_only: false, approved: true }),
  limits: Object.freeze(limits),
  forbidden_inferences: FORBIDDEN_INFERENCES,
});

export const M1_SIGNAL_DESCRIPTORS = Object.freeze([
  descriptor('frame.face_presence', 'frame', 'state', 5, 'count', 'SUPPORTED', ['video_frame'], ['Presence continuity only; no identity.']),
  descriptor('frame.framing', 'frame', 'series', 5, 'normalized_offset', 'SUPPORTED', ['video_frame'], ['Framing geometry only.']),
  descriptor('head.position', 'head', 'series', 10, 'normalized_pose', 'SUPPORTED', ['video_frame']),
  descriptor('head.movement', 'head', 'series', 10, 'normalized_motion', 'HEURISTIC', ['video_frame']),
  descriptor('head.camera_facing_balance', 'head', 'series', 5, 'ratio', 'HEURISTIC', ['video_frame'], ['Not eye contact.']),
  descriptor('face.smile_activity', 'head', 'event', null, 'event', 'HEURISTIC', ['video_frame'], ['Activity signal only; no emotion inference.']),
  descriptor('hands.visible', 'hands', 'state', 5, 'count', 'SUPPORTED', ['video_frame']),
  descriptor('hands.gesture_events', 'hands', 'event', null, 'event', 'HEURISTIC', ['video_frame']),
  descriptor('hands.gesture_rate', 'hands', 'series', 1, 'events_per_minute', 'HEURISTIC', ['video_frame']),
  descriptor('speech.state', 'speech', 'state', null, 'state', 'SUPPORTED', ['audio_features', 'turn_events']),
  descriptor('voice.volume', 'voice', 'series', 10, 'dbfs', 'SUPPORTED', ['audio_pcm']),
  descriptor('voice.pace', 'voice', 'series', 1, 'syllables_per_minute', 'HEURISTIC', ['audio_features']),
  descriptor('voice.pauses', 'voice', 'event', null, 'milliseconds', 'SUPPORTED', ['audio_features']),
  descriptor('voice.pitch_variation', 'voice', 'series', 10, 'hz', 'HEURISTIC', ['audio_pcm'], ['Fundamental-frequency variation; not charisma or confidence.']),
  descriptor('speech.filler_words', 'transcript', 'event', null, 'count', 'HEURISTIC', ['canonical_transcript'], ['Canonical transcript only in M1.']),
  descriptor('transcript.provisional', 'transcript', 'event', null, 'segment', 'SUPPORTED', ['provisional_transcript']),
  descriptor('transcript.canonical', 'transcript', 'event', null, 'segment', 'SUPPORTED', ['canonical_transcript']),
  descriptor('semantic.qa_boundaries', 'semantic', 'event', null, 'boundary', 'SUPPORTED', ['turn_events'], ['Consumed from Spine truth; never inferred by the registry.']),
]);

export function assertSignalDescriptor(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('signal descriptor must be an object');
  if (value.schema !== SIGNAL_SCHEMA || typeof value.signal_id !== 'string' || !value.signal_id) throw new TypeError('invalid signal identity');
  if (!['frame', 'head', 'hands', 'voice', 'speech', 'transcript', 'semantic'].includes(value.family)) throw new TypeError('invalid signal family');
  if (!['SUPPORTED', 'HEURISTIC', 'CALIBRATION', 'EXPERIMENTAL'].includes(value.reliability?.tier)) throw new TypeError('invalid reliability tier');
  if (!Array.isArray(value.forbidden_inferences) || FORBIDDEN_INFERENCES.some((item) => !value.forbidden_inferences.includes(item))) {
    throw new TypeError('signal descriptor omits a forbidden inference');
  }
  return value;
}
