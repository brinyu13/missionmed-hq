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
    durationMs: Number.isFinite(Number(session.durationMs)) ? Math.max(0, Number(session.durationMs)) : null,
    recording,
    resultsAvailable: Boolean(session.results),
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
  async session(sessionId) {
    const id = text(sessionId);
    if (!id) throw new Error('ivoc_session_required');
    return this.api.session(id);
  }
  async playback(recordingId) {
    const id = text(recordingId);
    if (!id) throw new Error('ivoc_recording_required');
    return this.api.playback(id);
  }
}
