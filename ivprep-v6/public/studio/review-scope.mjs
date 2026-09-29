// A role switch invalidates every in-flight Admin review before its response can
// populate a Student surface. This is presentation state, not an authorization grant.
export function createAdminReviewGate() {
  let generation = 0;
  return Object.freeze({
    begin(role) {
      if (role !== 'admin') return null;
      generation += 1;
      return generation;
    },
    invalidate() { generation += 1; },
    accepts(ticket, role) { return role === 'admin' && ticket !== null && ticket === generation; },
  });
}

export function isAdminReview(saved) {
  return saved?.reviewScope === 'admin';
}

export function clearAdminReviewMedia(playback, filmGroups) {
  if (playback) {
    playback.pause();
    playback.removeAttribute('src');
    playback.load();
  }
  const readouts = filmGroups?.readouts || {};
  filmGroups?.ingestResult({ deliveryIntelligence: {
    schema: 'ivoc.delivery-intelligence.view-model.v1',
    readouts: Object.fromEntries(Object.keys(readouts).map((id) => [id, 'Unavailable'])),
  } });
}
