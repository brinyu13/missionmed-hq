// Capture custody is not speaker recognition. These receipts deliberately do
// not authorize semantic analysis, even after a private upload is sealed.
export const CANDIDATE_CAPTURE_VERSION = 'direct-mic-v1';
export const isConversationRecording = row => Boolean(row) && (row.recording_role == null || row.recording_role === 'conversation');
export const isCandidateAudio = row => row?.recording_role === 'candidate_audio';
const audioMimes = new Set(['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus']);
const fail = code => { throw Object.assign(new TypeError(code), { status: 400 }); };
const milliseconds = value => Number.isSafeInteger(value) && value >= 0 && value <= 43_200_000;

export function allocateCandidateCapture({ input, parent, session, actor, recordingId, allocatedAt }) {
  if (input?.captureVersion !== CANDIDATE_CAPTURE_VERSION || !audioMimes.has(input?.mime)) fail('candidate_audio_contract_invalid');
  if (session?.owner_subject !== actor || session?.state !== 'active'
    || !isConversationRecording(parent) || parent.owner_subject !== actor
    || parent.session_id !== session.id || parent.id !== input.parentRecordingId
    || !['uploading', 'saved'].includes(parent.status)) fail('candidate_audio_parent_invalid');
  return {
    schema: 'ivoc.candidate-audio.v1', captureVersion: CANDIDATE_CAPTURE_VERSION,
    status: 'ALLOCATED', recordingId, parentRecordingId: parent.id,
    sessionId: session.id, allocatedAt,
    assurance: 'CLIENT_MIC_CAPTURE_DECLARATION', analysisEligibility: 'UNVERIFIED',
  };
}

export function sealCandidateCapture(row, input, { sealedAt, etag }) {
  const receipt = row?.capture_receipt;
  if (!isCandidateAudio(row) || receipt?.schema !== 'ivoc.candidate-audio.v1'
    || receipt.status !== 'ALLOCATED' || receipt.recordingId !== row.id
    || receipt.parentRecordingId !== row.parent_recording_id || receipt.sessionId !== row.session_id
    || input?.mime !== row.mime_type || !Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0) fail('candidate_audio_seal_invalid');
  const timing = input.captureTiming;
  if (!timing || !milliseconds(timing.recordingStartSessionMs)
    || !milliseconds(timing.recordingDurationMs) || timing.recordingDurationMs === 0
    || (timing.playableDurationMs !== null && !milliseconds(timing.playableDurationMs))
    || !Array.isArray(timing.pausedSpans) || timing.pausedSpans.length > 128) fail('candidate_audio_timebase_invalid');
  let lastEnd = timing.recordingStartSessionMs;
  const pausedSpans = timing.pausedSpans.map(span => {
    if (!milliseconds(span?.startMs) || !milliseconds(span?.endMs) || span.startMs < lastEnd || span.endMs < span.startMs) fail('candidate_audio_timebase_invalid');
    lastEnd = span.endMs;
    return { startMs: span.startMs, endMs: span.endMs };
  });
  const durationMs = timing.playableDurationMs ?? timing.recordingDurationMs;
  if (durationMs !== input.durationMs) fail('candidate_audio_duration_invalid');
  return { ...receipt, status: 'SEALED', sealedAt, etag: String(etag || '').slice(0, 256) || null,
    sizeBytes: input.sizeBytes, mime: row.mime_type,
    timing: { clock: 'browser-monotonic-session', clientAttested: true,
      recordingStartSessionMs: timing.recordingStartSessionMs, recordingDurationMs: timing.recordingDurationMs,
      playableDurationMs: timing.playableDurationMs, pausedSpans },
  };
}

export function publicCaptureReceipt(receipt) {
  if (!receipt || receipt.schema !== 'ivoc.candidate-audio.v1') return null;
  const { schema, captureVersion, status, recordingId, parentRecordingId, sessionId,
    allocatedAt, sealedAt, assurance, analysisEligibility, timing } = receipt;
  return { schema, captureVersion, status, recordingId, parentRecordingId, sessionId,
    allocatedAt, sealedAt, assurance, analysisEligibility, ...(timing ? { timing } : {}) };
}
