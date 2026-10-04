// Founder amendment D — Easy Mode (default) + collapsed Advanced Interviewer Settings.
//
// Every setting maps to something real: the production wizard contract consumed by
// DurableStudioSession.sessionInput() / createLiveContext() (server-allow-listed context fields),
// or to the conductor's own policy (depth, follow-up limit, pressure, pacing). Nothing here reaches
// the provider directly; `normalizeLiveInterviewContext` on the server rejects unknown fields, so
// fields it does not know are folded into `practiceFocus` (bounded, 500 chars) or kept client-side.
// No engineering/provider parameters are exposed (model, temperature, VAD, keys).

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
  return { preset: 'balanced', role: 'Program Director', style: 'Owl', depth: 1, curiosity: 'Normal', pressure: false, interruption: false, pacing: 'Normal', maxFollowUps: 4, programEmphasis: 'Normal', targetQuestions: 5, durationMin: 15, voice: 'marin', advanced: false };
}

export function applyPreset(settings, presetId) {
  const p = EASY_PRESETS.find((x) => x.id === presetId) || EASY_PRESETS[0];
  return { ...settings, preset: p.id, style: p.style, depth: p.depth, pressure: p.pressure, role: p.id === 'warm' ? 'Faculty' : p.id === 'direct' ? 'Chief Resident' : 'Program Director' };
}

// Conductor policy (client-side, deterministic). Closing invariant is not configurable.
export function conductorConfig(settings, { durationMin } = {}) {
  const curiosityThreshold = { Low: 0.72, Normal: 0.62, High: 0.55 }[settings.curiosity] ?? 0.62;
  return {
    maxDepth: Math.max(0, Math.min(2, Number(settings.depth) || 0)),
    maxFollowUps: Math.max(0, Math.min(8, Number(settings.maxFollowUps) || 0)),
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
export function toWizard(settings, { program = null, mode = 'mock', contextSources = [], retry = null } = {}) {
  const focusBits = [];
  if (settings.curiosity && settings.curiosity !== 'Normal') focusBits.push(`${settings.curiosity.toLowerCase()} curiosity about unresolved details`);
  if (settings.pacing && settings.pacing !== 'Normal') focusBits.push(`${settings.pacing.toLowerCase()} pacing`);
  if (settings.interruption) focusBits.push('may interrupt long answers politely');
  if (settings.programEmphasis && settings.programEmphasis !== 'Normal') focusBits.push(`${settings.programEmphasis.toLowerCase()} emphasis on program fit`);
  const depth=Math.max(0,Math.min(2,Number(settings.depth)||0));
  const followUps=Math.max(0,Math.min(8,Number(settings.maxFollowUps)||0));
  focusBits.push(`at most ${depth} follow-ups per answer and ${followUps} substantive follow-ups total; closing questions do not consume this budget`);
  const wizard = {
    goal: mode === 'practice' ? 'Individual Question' : 'Full IV Simulation',
    interviewer: ROLES.includes(settings.role) ? settings.role : 'Program Director',
    interviewerStyle: ['Dove', 'Peacock', 'Owl', 'Eagle'].includes(settings.style) ? settings.style : 'Owl',
    pressurePractice: settings.pressure === true,
    environment: 'MissionMed',
    analyticsEnabled: true,
    contextSources: [...new Set(contextSources.filter(source => ['CV','File Vault','StoryForge','MCC','Top 3','Prior IVOC'].includes(source))), ...(program?.verified ? ['RISE'] : [])],
  };
  if (program?.verified && program.programId && program.programReleaseId) {
    wizard.program = program.name; wizard.programId = program.programId; wizard.programReleaseId = program.programReleaseId; wizard.programVerified = true;
  }
  if (focusBits.length) { wizard.goal = mode === 'practice' ? 'Individual Question' : 'Guided Mock IV Practice'; wizard.focus = focusBits.join('; ').slice(0, 500); }
  if (retry) Object.assign(wizard,{retrySourceSessionId:retry.id,retryQuestionId:retry.questionId,retryQuestionText:retry.questionText,retrySessionType:retry.remote?.sessionType,
    environment:retry.wizard?.environment||wizard.environment});
  // Own Retry already resolves current membership and the exact saved question.
  // Preserve its canonical goal after applying current interviewer settings.
  if (['Full IV Simulation','Guided Mock IV Practice','Individual Question'].includes(retry?.wizard?.goal)) {
    wizard.goal = retry.wizard.goal;
    if (wizard.goal === 'Individual Question') wizard.pressurePractice = false;
  }
  return wizard;
}

export function describe(settings) {
  const p = EASY_PRESETS.find((x) => x.id === settings.preset);
  return settings.advanced ? `${settings.role} · ${settings.style} · follow-ups ${settings.depth}/question (max ${settings.maxFollowUps}) · ${settings.curiosity.toLowerCase()} curiosity · ${settings.pacing.toLowerCase()} pace${settings.pressure ? ' · pressure' : ''}${settings.interruption ? ' · may interrupt' : ''}` : `${p?.label || 'Balanced'} · ${p?.hint || ''}`;
}
