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

const savedSessionId = value => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(value);

// Fragments retain an opaque attempt identity, never a private playback URL,
// subject selection or authorization. Every reload resolves fresh account data.
export function savedReviewHash(view, saved) {
  const id = saved?.session?.id;
  return ['filmroom', 'postanswer'].includes(view) && saved?.persisted === true
    && !isAdminReview(saved) && savedSessionId(id)
    ? `#${view}?session=${id}` : `#${view}`;
}

export function parseSavedReviewRoute(hash) {
  if (typeof hash !== 'string') return null;
  const match = /^#(filmroom|postanswer)\?session=([0-9a-f-]+)$/u.exec(hash);
  return match && savedSessionId(match[2]) ? Object.freeze({ view: match[1], sessionId: match[2] }) : null;
}

export async function resolveOwnSavedReview({ route, library, session, isCurrent = () => true }) {
  if (!route || !['filmroom', 'postanswer'].includes(route.view) || !savedSessionId(route.sessionId)
    || !isCurrent()) return null;
  // An Admin's broader session read permission must not restore a different
  // student's work into Student view. Membership in the fresh OWN library is
  // mandatory before requesting any attempt details.
  const own = await library('own');
  if (!isCurrent()) return null;
  const row = own?.sessions?.find(item => item.id === route.sessionId);
  if (!row || (!row.results && row.recording?.status !== 'saved')) return null;
  const detail = await session(route.sessionId);
  // GET /sessions/:id returns publicSession directly. Do not accept a nested
  // lookalike identity or fall back to the library row if detail differs.
  if (!isCurrent() || detail?.id !== route.sessionId) return null;
  const analytics = detail.results?.payload?.analytics || null;
  return { persisted: true, session: row, sessionDetail: detail, analytics,
    recording: detail.recording ? { recording: detail.recording } : null };
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
