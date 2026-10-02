// A role switch invalidates every in-flight Admin review before its response can
// populate a Student surface. This is presentation state, not an authorization grant.
export function createAdminReviewGate() {
  let generation = 0;
  let scope = null;
  return Object.freeze({
    begin(role, nextScope = null) {
      if (role !== 'admin') return null;
      scope = nextScope ? Object.freeze({ ...nextScope }) : null;
      generation += 1;
      return generation;
    },
    invalidate() { generation += 1; scope = null; },
    accepts(ticket, role, currentScope = null) {
      return role === 'admin' && ticket !== null && ticket === generation
        && (!scope || (currentScope?.subject === scope.subject
          && currentScope?.sessionId === scope.sessionId && currentScope?.view === scope.view));
    },
  });
}

// A disappearing selection never authorizes a replacement student or the actor.
export function resolveAdminStudentRefreshSelection(students, selectedSubject) {
  return Array.isArray(students) && selectedSubject
    && students.some(student => student.subject === selectedSubject) ? selectedSubject : '';
}

export function isAdminReview(saved) {
  return saved?.reviewScope === 'admin';
}

export function mayPresentSavedReview({ saved, currentSaved, role, ticket, gate }) {
  return saved === currentSaved && (!isAdminReview(saved) || gate.accepts(ticket, role));
}

export function resolveReviewDestination(view, saved) {
  if ((view === 'filmroom' || view === 'postanswer') && !saved) return 'vault';
  return view;
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
