const sortByMedia = (left, right) => left.t_media_ms - right.t_media_ms || (left.seq ?? 0) - (right.seq ?? 0);

export function projectFlightRecorder({ sessionId, media, events, transcript, signalSeries = {} }) {
  if (!sessionId || !media?.media_id || !Array.isArray(events)) throw new TypeError('flight recorder inputs are required');
  const tracks = {
    questions: events.filter((event) => event.type.startsWith('question.')).sort(sortByMedia),
    turns: events.filter((event) => event.type.startsWith('turn.')).sort(sortByMedia),
    cues: events.filter((event) => event.type.startsWith('cue.')).sort(sortByMedia),
    transcript: transcript?.segments ?? [],
    signals: Object.entries(signalSeries).map(([signal_id, samples]) => ({ signal_id, samples: [...samples].sort(sortByMedia), availability: samples.length ? 'ok' : 'unavailable' })),
  };
  const gaps = tracks.signals.filter((track) => track.availability !== 'ok').map((track) => ({ lane: track.signal_id, reason: 'signal unavailable' }));
  if (!tracks.transcript.length) gaps.push({ lane: 'transcript', reason: 'canonical transcript pending' });
  return Object.freeze({ schema: 'ivoc.flight_recorder.v1', session_id: sessionId, media: structuredClone(media), tracks: structuredClone(tracks), gaps });
}

export function seekFlightRecorder(projection, tMediaMs) {
  if (!Number.isFinite(tMediaMs) || tMediaMs < 0) throw new TypeError('seek position is invalid');
  return Object.freeze({ session_id: projection.session_id, t_media_ms: tMediaMs, active_question: [...projection.tracks.questions].reverse().find((event) => event.t_media_ms <= tMediaMs) ?? null, active_turn: [...projection.tracks.turns].reverse().find((event) => event.t_media_ms <= tMediaMs) ?? null, signal_values: Object.fromEntries(projection.tracks.signals.map((track) => [track.signal_id, [...track.samples].reverse().find((sample) => sample.t_media_ms <= tMediaMs) ?? null])) });
}
