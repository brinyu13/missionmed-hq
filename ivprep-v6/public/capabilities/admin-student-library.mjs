import { IvocApi } from '../ivoc-standalone/app/api.mjs';

const text = (value, limit = 240) => String(value || '').trim().slice(0, limit);

function sessionView(session = {}) {
  const ownerSubject = text(session.ownerSubject);
  if (!ownerSubject) return null;
  const recording = session.recording?.id && session.recording?.status === 'saved'
    ? Object.freeze({ id: text(session.recording.id), status: 'saved' })
    : null;
  return Object.freeze({
    id: text(session.id),
    ownerSubject,
    ownerDisplayName: text(session.ownerDisplayName, 200) || 'MissionMed student',
    title: text(session.questionText || session.title || session.questionId, 1_000) || 'Saved practice session',
    questionId: text(session.questionId, 120) || null,
    state: text(session.state, 40) || 'unknown',
    endedAt: text(session.endedAt || session.startedAt, 80) || null,
    durationMs: session.durationMs != null && session.durationMs !== '' && Number.isFinite(Number(session.durationMs))
      ? Math.max(0, Number(session.durationMs)) : null,
    recording,
    resultsAvailable: Boolean(session.results),
    reviewStatus: text(session.reviewStatus, 40) || null,
    answerHistory: Object.freeze({
      transcriptAvailable: session.answerHistory?.transcriptAvailable === true,
      supportedObservationCount: Math.max(0, Number(session.answerHistory?.supportedObservationCount || 0)),
    }),
  });
}

export function projectAdminStudentLibrary(payload = {}) {
  const sessions = (Array.isArray(payload.sessions) ? payload.sessions : [])
    .map(sessionView)
    .filter(Boolean);
  const grouped = new Map();
  for (const session of sessions) {
    if (!grouped.has(session.ownerSubject)) grouped.set(session.ownerSubject, {
      subject: session.ownerSubject,
      displayName: session.ownerDisplayName,
      sessions: [],
    });
    grouped.get(session.ownerSubject).sessions.push(session);
  }
  const students = [...grouped.values()]
    .map((student) => Object.freeze({ ...student, sessions: Object.freeze(student.sessions) }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName) || a.subject.localeCompare(b.subject));
  return Object.freeze({
    studentCount: students.length,
    sessionCount: sessions.length,
    students: Object.freeze(students),
  });
}

export class AdminStudentLibraryCapability {
  constructor({ api = new IvocApi() } = {}) { this.api = api; }
  async overview() { return projectAdminStudentLibrary(await this.api.library('all')); }
  async comparisonSessions(subject) {
    const selected = text(subject);
    if (!selected) throw new Error('ivoc_student_required');
    const payload = await this.api.library('all');
    return (Array.isArray(payload?.sessions) ? payload.sessions : [])
      .filter((session) => session?.ownerSubject === selected);
  }
  async session(sessionId) {
    const id = text(sessionId);
    if (!id) throw new Error('ivoc_session_required');
    return this.api.session(id);
  }
  async sessionForStudent({ subject, sessionId, isCurrent } = {}) {
    if (typeof subject !== 'string' || !/^wp:[1-9][0-9]{0,19}$/u.test(subject)
        || typeof sessionId !== 'string' || !sessionId || sessionId.trim() !== sessionId
        || typeof isCurrent !== 'function') throw new Error('ivoc_review_scope_required');
    if (!isCurrent()) return null;
    const library = await this.overview();
    if (!isCurrent()) return null;
    const student = library.students.find(item => item.subject === subject);
    const binding = student?.sessions.find(item => item.id === sessionId);
    if (!binding) throw new Error('ivoc_selected_attempt_unavailable');
    const detail = await this.api.session(sessionId);
    if (!isCurrent()) return null;
    if (detail?.id !== sessionId || (detail.ownerSubject != null && detail.ownerSubject !== subject)) {
      throw new Error('ivoc_review_identity_mismatch');
    }
    // Detail currently omits ownerSubject. Bind it only from the fresh authorized
    // library projection, never from a client claim or an actor fallback.
    return Object.freeze({ ...detail, ownerSubject: binding.ownerSubject });
  }
  async markReviewed({ subject, sessionId, isCurrent } = {}) {
    if (typeof subject !== 'string' || !/^wp:[1-9][0-9]{0,19}$/u.test(subject)
        || typeof sessionId !== 'string' || !sessionId || sessionId.trim() !== sessionId
        || typeof isCurrent !== 'function') throw new Error('ivoc_review_scope_required');
    if (!isCurrent()) return null;
    const bootstrap = await this.api.bootstrap();
    if (!isCurrent()) return null;
    if (bootstrap?.identity?.admin !== true || !/^[A-Za-z0-9_-]{16,256}$/u.test(String(bootstrap.csrfToken || ''))
        || this.api.csrfToken !== bootstrap.csrfToken) throw new Error('ivoc_admin_review_unavailable');
    const detail = await this.sessionForStudent({ subject, sessionId, isCurrent });
    if (!detail || !isCurrent()) return null;
    if (detail.reviewStatus === 'reviewed' || detail.review?.status === 'reviewed') {
      throw new Error('ivoc_attempt_already_reviewed');
    }
    // Status only: no notes property, no note rewrite or implied capture grant.
    const result = await this.api.markReviewed(sessionId, {});
    if (!isCurrent()) return null;
    if (result?.sessionId !== sessionId || result.reviewStatus !== 'reviewed') throw new Error('ivoc_review_response_mismatch');
    return Object.freeze({ sessionId, ownerSubject: subject, reviewStatus: 'reviewed', reviewedAt: result.reviewedAt || null });
  }
  async playback(recordingId) {
    const id = text(recordingId);
    if (!id) throw new Error('ivoc_recording_required');
    return this.api.playback(id);
  }
}
