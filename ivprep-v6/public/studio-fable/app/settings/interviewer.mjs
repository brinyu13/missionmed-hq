// Founder amendment D — Easy Mode (default) + collapsed Advanced Interviewer Settings.
//
// Every setting maps to something real: the production wizard contract consumed by
// DurableStudioSession.sessionInput() / createLiveContext() (server-allow-listed context fields),
// or to the observer policy (depth, follow-up limit, pressure, pacing). Nothing here reaches
// the provider directly. Typed follow-up preferences carry a version, while the
// server independently resolves and enforces the current Admin ceiling.
// No engineering/provider parameters are exposed (model, temperature, VAD, keys).
import {normalizePracticeFocus} from '../../../studio/live-context-adapter.mjs';
import {normalizeInterviewPolicy,resolveFollowUps} from '../../../capabilities/interview-policy.mjs';
import {selectedEnvironment} from '../adapters/environment-profile.mjs';

export const PRACTICE_GOALS = Object.freeze(['Full IV Simulation', 'Guided Mock IV Practice', 'Individual Question']);

export const EASY_PRESETS = [
  { id: 'balanced', label: 'Balanced', hint: 'Program Director · one follow-up per question', style: 'Owl', depth: 1, pressure: false },
  { id: 'warm', label: 'Warm', hint: 'Faculty · patient, conversational', style: 'Dove', depth: 1, pressure: false },
  { id: 'direct', label: 'Direct', hint: 'Chief Resident · concise, probing', style: 'Eagle', depth: 1, pressure: false },
  { id: 'pressure', label: 'Pressure', hint: 'Program Director · up to two follow-ups, skeptical', style: 'Eagle', depth: 2, pressure: true },
];

export const ROLES = ['Program Director', 'Associate Program Director', 'Faculty', 'Chief Resident'];
export const STYLES = { Owl: 'measured, evidence-focused', Dove: 'warm, patient', Peacock: 'expressive, conversational', Eagle: 'direct, concise' };
export const CURIOSITY = ['Low', 'Normal', 'High'];
export const PACING = ['Relaxed', 'Normal', 'Brisk'];
export const VOICES = ['marin', 'meridian', 'gleam', 'vesper', 'stone', 'willow']; // current source allow-list; student default marin, audition is Admin-only

export function defaultSettings() {
  return { goal: 'Guided Mock IV Practice', practiceFocus: '', environment:'MissionMed', preset: 'balanced', role: 'Program Director', style: 'Owl', depth: 1, curiosity: 'Normal', pressure: false, interruption: false, pacing: 'Normal', maxFollowUps: 4, programEmphasis: 'Normal', targetQuestions: 5, durationMin: 15, voice: 'marin', advanced: false };
}

export function normalizeMockPracticeFocus(value) {
  if (typeof value !== 'string' || value.length > 200) throw new TypeError('Use a practice focus of 200 characters or fewer.');
  return normalizePracticeFocus(value) || '';
}

// An untouched Mock follows its selected pool. An explicit target may exceed the
// pool; the existing native policy supplies distinct authorized questions.
export function resolveMockQuestionTarget(value, poolLength, {goal} = {}) {
  if (goal === 'Individual Question') return 1;
  if (Number.isInteger(value) && value >= 1 && value <= 30) return value;
  return Math.max(1, Math.min(30, Number.isInteger(poolLength) ? poolLength : 1));
}

// Setup intent is distinct from the effective runtime budget. Choosing None
// (or an Admin ceiling of zero) must not erase a user's configured total.
// Runtime/observer adapters still resolve zero while follow-ups are disabled.
export function resolveFollowUpPreferences(settings,interviewPolicy) {
  const {depth}=resolveFollowUps(settings,interviewPolicy);
  return {depth,maxFollowUps:Math.max(0,Math.min(8,Math.floor(Number(settings.maxFollowUps)||0)))};
}

export function applyPreset(settings, presetId, {interviewPolicy} = {}) {
  const p = EASY_PRESETS.find((x) => x.id === presetId) || EASY_PRESETS[0];
  const followUps=resolveFollowUpPreferences({...settings,depth:p.depth},interviewPolicy);
  return { ...settings, ...followUps, preset: p.id, style: p.style, pressure: settings.goal !== 'Individual Question' && p.pressure, role: p.id === 'warm' ? 'Faculty' : p.id === 'direct' ? 'Chief Resident' : 'Program Director' };
}

// Conductor policy (client-side, deterministic). Closing invariant is not configurable.
export function conductorConfig(settings, { durationMin,interviewPolicy } = {}) {
  const curiosityThreshold = { Low: 0.72, Normal: 0.62, High: 0.55 }[settings.curiosity] ?? 0.62;
  const followUps=resolveFollowUps(settings,interviewPolicy);
  return {
    maxDepth: followUps.depth,
    maxFollowUps: followUps.maxFollowUps,
    maxCandidateQuestions: 2,
    pressure: settings.pressure === true,
    style: settings.style,
    followThreshold: curiosityThreshold,
    durationMs: (durationMin || settings.durationMin) ? (durationMin || settings.durationMin) * 60_000 : null,
    closingReserveMs: 90_000,
    pacing: settings.pacing,
  };
}

// Production wizard contract (DurableStudioSession.sessionInput + createLiveContext).
export function toWizard(settings, { program = null, mode = 'mock', contextSources = [], retry = null, priority = null,interviewPolicy } = {}) {
  const goal = mode === 'practice' ? 'Individual Question' : PRACTICE_GOALS.includes(retry?.wizard?.goal) ? retry.wizard.goal : PRACTICE_GOALS.includes(settings.goal) ? settings.goal : 'Guided Mock IV Practice';
  const focusBits = [];
  if (goal === 'Guided Mock IV Practice') {
    const edited = normalizeMockPracticeFocus(settings.practiceFocus ?? '');
    const focus = edited || (typeof priority === 'string' ? normalizeMockPracticeFocus(priority.slice(0,200)) : '');
    if (focus) focusBits.push(focus);
  }
  if (settings.curiosity && settings.curiosity !== 'Normal') focusBits.push(`${settings.curiosity.toLowerCase()} curiosity about unresolved details`);
  if (settings.pacing && settings.pacing !== 'Normal') focusBits.push(`${settings.pacing.toLowerCase()} pacing`);
  if (settings.interruption) focusBits.push('may interrupt long answers politely');
  if (settings.programEmphasis && settings.programEmphasis !== 'Normal') focusBits.push(`${settings.programEmphasis.toLowerCase()} emphasis on program fit`);
  const policy=interviewPolicy?normalizeInterviewPolicy(interviewPolicy):null;
  const followUps=resolveFollowUps(settings,policy);
  // Legacy setup remains compatible. Current account policy travels as typed
  // preferences; the server owns the ceiling, not student-authored focus text.
  if(!policy)focusBits.push(`at most ${followUps.depth} follow-ups per answer and ${followUps.maxFollowUps} substantive follow-ups total; closing questions do not consume this budget`);
  const wizard = {
    goal,
    interviewer: ROLES.includes(settings.role) ? settings.role : 'Program Director',
    interviewerStyle: ['Dove', 'Peacock', 'Owl', 'Eagle'].includes(settings.style) ? settings.style : 'Owl',
    pressurePractice: goal !== 'Individual Question' && settings.pressure === true,
    environment: selectedEnvironment(settings,retry),
    analyticsEnabled: true,
    contextSources: [...new Set(contextSources.filter(source => ['CV','File Vault','StoryForge','MCC','Top 3','Prior IVOC'].includes(source))), ...(program?.verified ? ['RISE'] : [])],
    ...(policy?{followUpDepth:followUps.depth,maxFollowUps:followUps.maxFollowUps,interviewPolicyVersion:policy.version}:{}),
  };
  if (program?.verified && program.programId && program.programReleaseId) {
    wizard.program = program.name; wizard.programId = program.programId; wizard.programReleaseId = program.programReleaseId; wizard.programVerified = true;
  }
  if (goal === 'Guided Mock IV Practice' && focusBits.length) wizard.focus = focusBits.join('; ').slice(0, 500);
  if (retry) Object.assign(wizard,{retrySourceSessionId:retry.id,retryQuestionId:retry.questionId,retryQuestionText:retry.questionText,retrySessionType:retry.remote?.sessionType,
    environment:selectedEnvironment(settings,retry)});
  // Own Retry already resolves current membership and the exact saved question.
  // Preserve its canonical goal after applying current interviewer settings.
  return wizard;
}

export function describe(settings,{interviewPolicy}={}) {
  const p = EASY_PRESETS.find((x) => x.id === settings.preset);
  const followUps=resolveFollowUps(settings,interviewPolicy);
  return settings.advanced ? `${settings.role} · ${settings.style} · follow-ups ${followUps.depth}/question (max ${followUps.maxFollowUps}) · ${settings.curiosity.toLowerCase()} curiosity · ${settings.pacing.toLowerCase()} pace${settings.pressure ? ' · pressure' : ''}${settings.interruption ? ' · may interrupt' : ''}` : interviewPolicy ? `${p?.label||'Balanced'} · ${settings.role} · up to ${followUps.depth} follow-ups per answer` : `${p?.label || 'Balanced'} · ${p?.hint || ''}`;
}
