// Presentation preferences are subject-scoped. Private attempts/transcripts are
// account data, never browser-global localStorage or a second persistence owner.
const listeners = new Set();
let subject = null;
export const state = { attempts: [], calibration: null, preferences: { density: 'coached', reducedMotion: false }, mentorPriority: null, program: null };
export function bindSubject(next) {
  if (!/^wp:[1-9][0-9]*$/.test(String(next || ''))) throw new Error('Authenticated IVOC subject required');
  if (subject === next) return;
  subject = next;
  state.attempts = []; state.program = null; state.calibration = null; state.mentorPriority = null;
  state.preferences = { density: 'coached', reducedMotion: false };
  try {
    const saved = JSON.parse(localStorage.getItem('ivoc.fable.preferences.v1:' + subject) || 'null');
    if (saved?.density === 'interview' || saved?.density === 'coached') state.preferences.density = saved.density;
  } catch {}
}
export function currentSubject() { return subject; }
export function commit() {
  if (subject) try { localStorage.setItem('ivoc.fable.preferences.v1:' + subject, JSON.stringify({ density: state.preferences.density })); } catch {}
  for (const fn of listeners) fn(state);
}
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function addAttempt(attempt) {
  if (!subject || attempt.ownerSubject !== subject || attempt.persisted !== true) return null;
  state.attempts = [attempt, ...state.attempts.filter(a => a.id !== attempt.id)];
  commit(); return attempt;
}
export function attemptsByRecency() { return state.attempts.slice().sort((a,b) => b.at-a.at); }
export function attempt(id) { return state.attempts.find(a => a.id === id && a.ownerSubject === subject) || null; }
export function uid(prefix = 'att') { return prefix + '-' + globalThis.crypto.randomUUID(); }
