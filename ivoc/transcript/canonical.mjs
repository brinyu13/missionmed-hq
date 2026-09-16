export function assertCanonicalTranscript(transcript) {
  if (!transcript || transcript.schema !== 'ivoc.transcript.v1' || !transcript.session_id || !Array.isArray(transcript.segments)) throw new TypeError('canonical transcript is invalid');
  let previousEnd = 0;
  for (const segment of transcript.segments) {
    if (!segment.turn_id || !['student', 'interviewer', 'unknown'].includes(segment.speaker) || !Array.isArray(segment.words)) throw new TypeError('transcript segment is invalid');
    for (const word of segment.words) {
      if (typeof word.w !== 'string' || !word.w || !Number.isFinite(word.t0) || !Number.isFinite(word.t1) || word.t0 < previousEnd || word.t1 < word.t0) throw new TypeError('transcript word timing is invalid');
      if (word.conf !== undefined && (!Number.isFinite(word.conf) || word.conf < 0 || word.conf > 1)) throw new TypeError('transcript confidence is invalid');
      previousEnd = word.t1;
    }
  }
  return transcript;
}

export function transcriptText(transcript, { speaker } = {}) {
  assertCanonicalTranscript(transcript);
  return transcript.segments.filter((segment) => !speaker || segment.speaker === speaker).flatMap((segment) => segment.words.map((word) => word.w)).join(' ');
}
