import { buildLongitudinalModel, canCompareAttempts } from './longitudinal-model.mjs';

// Stable IDs keep the reviewed answer selected when history is reordered or refreshed.
// Baselines are earlier attempts at the same question in the same recording mode.
export function buildComparisonSelection(attempts = [], { currentId = null, baselineId = null } = {}) {
  const current = attempts.find((attempt) => attempt.id === currentId) || attempts[0] || null;
  const eligible = attempts.filter((attempt) => canCompareAttempts(attempt, current)
    && attempt.at !== null && current.at !== null && attempt.at <= current.at);
  const baseline = eligible.find((attempt) => attempt.id === baselineId) || eligible[0] || null;
  return Object.freeze({ current, baseline, eligible: Object.freeze(eligible) });
}

const readyMetric = (metrics, key) => metrics?.[key]?.available === true;

// A program adds context; it is not a prerequisite for general practice or an
// AI mock. This display action never grants verified RISE context.
export function buildBuilderStepAction({ step, wizard = {}, questionCount = 0 } = {}) {
  const enabled = step === 'program' ? true
    : ['questions', 'readiness'].includes(step) ? questionCount > 0
      : Boolean(wizard[step]);
  const label = step === 'readiness' ? 'Review interview' : 'Continue';
  return Object.freeze({ enabled, label });
}

export function buildPracticeQuestionLabel(question = null) {
  return String(question?.canonical_text || '').trim() || 'Free practice';
}

export function buildBuilderLaunchOrder(mode = 'ai') {
  return Object.freeze(mode === 'practice' ? ['practice', 'ai'] : ['ai', 'practice']);
}

// Display projection only; the capability layer still owns media and session time.
export function buildInterviewRoomModel({ sessionState = 'IDLE', providerState = 'idle',
  interviewMode = 'Interview Mode', showAnalytics = null, saveRetry = false } = {}) {
  const phase = sessionState === 'FINISHING' ? 'saving' : saveRetry ? 'save-error'
    : sessionState === 'RUNNING' ? 'live'
      : sessionState === 'STARTING' || providerState === 'connecting' ? 'connecting'
        : sessionState === 'COMPLETE' ? 'complete' : providerState === 'error' ? 'error'
          : sessionState === 'SESSION_READY' ? 'ready' : 'readiness';
  const immersive = ['connecting', 'live', 'saving', 'save-error'].includes(phase);
  const coached = showAnalytics ?? (interviewMode === 'Coached / Live Analytics Mode');
  return Object.freeze({ phase, immersive, coached, showStart: !immersive && phase !== 'complete',
    canEnd: phase === 'live' || phase === 'save-error',
    endLabel: phase === 'save-error' ? 'Retry save' : phase === 'saving' ? 'Saving interview…' : 'End interview',
    title: ({ readiness: 'Before you begin', ready: 'Ready for your interview', connecting: 'Joining your interview',
      live: 'Interview in progress', saving: 'Saving your interview', 'save-error': 'Your recording needs to be saved',
      complete: 'Interview complete', error: 'Could not start the interview' })[phase],
  });
}

export function preserveInterviewLifecycle(sessionState) {
  return ['STARTING', 'RUNNING', 'FINISHING'].includes(sessionState);
}

function measuredDetail({ ready, connected, readyText, waitingText }) {
  if (ready) return readyText;
  return connected ? 'Awaiting measured evidence' : waitingText;
}

export function buildReadinessRows({
  media = {}, metrics = {}, durableAvailable = false, mediaRecorderSupported = false,
} = {}) {
  const camera = media.cam === true;
  const microphone = media.mic === true;
  const face = readyMetric(metrics, 'FACE');
  const smile = face && typeof metrics.FACE.smileActive === 'boolean';
  return Object.freeze([
    ['Camera', camera, camera ? 'Live' : 'Connect to check'],
    ['Microphone', microphone, microphone ? 'Live' : 'Connect to check'],
    ['Framing', readyMetric(metrics, 'FRAMING'), measuredDetail({ ready: readyMetric(metrics, 'FRAMING'), connected: camera, readyText: 'Measured now', waitingText: 'Awaiting camera' })],
    ['Face / head', face, measuredDetail({ ready: face, connected: camera, readyText: 'Measured now', waitingText: 'Awaiting camera' })],
    ['Hands / gestures', readyMetric(metrics, 'HANDS'), measuredDetail({ ready: readyMetric(metrics, 'HANDS'), connected: camera, readyText: 'Measured now', waitingText: 'Awaiting camera' })],
    ['Smile / expression', smile, measuredDetail({ ready: smile, connected: camera, readyText: 'Measured now', waitingText: 'Awaiting camera' })],
    ['Volume', readyMetric(metrics, 'VOICE_LEVEL'), measuredDetail({ ready: readyMetric(metrics, 'VOICE_LEVEL'), connected: microphone, readyText: 'Measured now', waitingText: 'Awaiting microphone' })],
    ['Pace', readyMetric(metrics, 'PACE'), measuredDetail({ ready: readyMetric(metrics, 'PACE'), connected: microphone, readyText: 'Measured now', waitingText: 'Awaiting microphone' })],
    ['Pitch', readyMetric(metrics, 'PITCH'), measuredDetail({ ready: readyMetric(metrics, 'PITCH'), connected: microphone, readyText: 'Measured now', waitingText: 'Awaiting microphone' })],
    ['Pauses', readyMetric(metrics, 'PAUSE'), measuredDetail({ ready: readyMetric(metrics, 'PAUSE'), connected: microphone, readyText: 'Measured now', waitingText: 'Awaiting microphone' })],
    ['Transcript', durableAvailable === true, durableAvailable ? 'Available after a saved answer' : 'Unavailable'],
    ['Recording', mediaRecorderSupported === true, mediaRecorderSupported ? 'Browser supported' : 'Unavailable'],
  ]);
}

export function buildContextSources({
  mentorPriorities = null, durableAvailable = false, contextCapabilities = {}, programVerified = false,
} = {}) {
  const top3Count = Array.isArray(mentorPriorities?.priorities) ? mentorPriorities.priorities.length : 0;
  const top3Connected = Number.isSafeInteger(mentorPriorities?.version) && mentorPriorities.version > 0;
  const storyForgeConnected = contextCapabilities?.storyForge?.connected === true;
  const riseConnected = contextCapabilities?.rise?.connected === true;
  const fileVaultConnected = contextCapabilities?.fileVault?.connected === true;
  return Object.freeze([
    { name: 'StoryForge', available: storyForgeConnected, connected: storyForgeConnected, detail: 'Your authorized stories' },
    { name: 'RISE', available: riseConnected && programVerified === true, connected: riseConnected, detail: 'Verified program intelligence' },
    { name: 'CV', available: fileVaultConnected, connected: fileVaultConnected, detail: 'Your reviewed current curriculum vitae' },
    { name: 'File Vault', available: fileVaultConnected, connected: fileVaultConnected, detail: 'Your private current CV' },
    { name: 'MCC', available: false, detail: 'MissionMed context' },
    {
      name: 'Top 3', available: top3Connected && top3Count > 0,
      detail: top3Connected ? `${top3Count} mentor priorit${top3Count === 1 ? 'y' : 'ies'}` : 'Mentor priorities',
      connected: top3Connected,
    },
    { name: 'Prior IVOC', available: durableAvailable === true, detail: 'Your own prior practice' },
  ]);
}

export function contextSourceHint({ name, available, connected } = {}) {
  if (available) return 'Checked when interview begins';
  if (name === 'RISE' && connected) return 'Select a verified program first';
  if (name === 'Top 3' && connected) return 'No mentor priorities have been added';
  return 'Not connected';
}

export function buildPracticeEntryIntent({ destination, launchMode, builderStep } = {}) {
  return destination === 'newsession' && launchMode === 'practice' && String(builderStep) === '1'
    ? Object.freeze({ goal: 'Individual Question', targetQuestions: 1, duration: 5, pressurePractice: false })
    : null;
}

export function interviewerPresenceCopy(admin = false) {
  return admin
    ? 'AI interviews use the current interviewer voice. Voice audition is available in the Founder/Admin Interview Room before starting. Avatar selection is not active.'
    : 'AI interviews use the current interviewer voice. Voice and avatar selection are not available in this Builder yet.';
}

export function resolveAdminStudentSelection(students = [], previousSubject = null) {
  return students.find((student) => student.subject === previousSubject)?.subject
    || students[0]?.subject || '';
}

export function buildAdminStudentProgress(student = {}) {
  const sessions = (Array.isArray(student.sessions) ? student.sessions : [])
    .filter((session) => session.ownerSubject === student.subject);
  return Object.freeze({
    title: `Practice history · ${student.displayName || 'Selected student'}`,
    totals: buildLongitudinalModel(sessions).totals,
    durationAvailable: sessions.filter((session) => session.state === 'saved')
      .every((session) => session.durationMs != null && Number.isFinite(Number(session.durationMs))),
    note: 'Selected student’s saved history only. Open an attempt for its measured Analytics; no mastery, rank or recurring pattern is inferred.',
  });
}

export function buildOwnerIntegrationFacts(capabilities = {}) {
  return [['File Vault', 'fileVault'], ['RISE', 'rise'], ['StoryForge', 'storyForge']].map(([label, key]) => ({
    label,
    value: capabilities[key]?.connected === true ? 'CONFIGURED · SUBJECT DATA CHECKED AT START' : 'NOT CONNECTED',
    state: capabilities[key]?.connected === true ? 'ready' : 'limited',
  }));
}

export function buildIdentityViewModel(identity = null) {
  const displayName = String(identity?.displayName || '').trim();
  const words = displayName.split(/\s+/u).filter(Boolean);
  const isDrBrian = Number(identity?.wpUserId) === 1;
  const initials = isDrBrian ? 'DB' : (words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join('') || 'IV');
  return Object.freeze({
    initials,
    greetingName: isDrBrian ? 'Dr Brian.' : (words[0] ? `${words[0]}.` : 'Doctor.'),
  });
}

export function reviewTurnSpeakerLabel(speaker, { role = 'student', ownerDisplayName = null } = {}) {
  if (speaker !== 'student') return 'Interviewer';
  if (role !== 'admin') return 'You';
  const owner = String(ownerDisplayName || '').trim().slice(0, 120);
  return owner ? `Student · ${owner}` : 'Student';
}

export function reviewEvidenceCopy(value, { role = 'student', reviewScope = null } = {}) {
  const copy = String(value ?? '');
  if (role !== 'admin' || reviewScope !== 'admin') return copy;
  return copy.replaceAll('KEEP SPEAKING TO ESTABLISH YOUR RANGE', 'INSUFFICIENT STUDENT SPEECH TO ESTABLISH A RANGE')
    .replaceAll('your median', "the student's median")
    .replaceAll('your transcript', "the student's transcript")
    .replaceAll('your baseline', "the student's baseline");
}

export function reviewTranscriptCoverage(turns = []) {
  if (!Array.isArray(turns) || !turns.length) return 'none';
  return turns.some((turn) => turn?.speaker === 'student') ? 'candidate_present' : 'interviewer_only';
}

export function buildQuestionPoolBulkAction({ questions = [], category = '', search = '', categoryOf } = {}) {
  const query = String(search).trim().toLowerCase();
  const source = Array.isArray(questions) ? questions : [];
  const targets = query
    ? source.filter((question) => `${question?.question_id || ''} ${question?.canonical_text || ''}`.toLowerCase().includes(query))
    : source.filter((question) => categoryOf?.(question) === category);
  return { label: query ? 'Add matching questions' : 'Add entire category', targets };
}

export function programSearchFailureCopy(error) {
  const denied = error?.status === 401 || error?.status === 403;
  return denied
    ? 'Verified program search is not available for this account. You can continue with a manual entry; no unverified program facts will be used.'
    : 'Verified program search is temporarily unavailable. You can continue with a manual entry; no unverified program facts will be used.';
}

export function liveMockRecordingCheckLabel(status = null, { failed = false } = {}) {
  if (failed) return 'Recording check failed · Retry';
  if (status?.playbackAvailable === true) return 'Private recording ready · Recheck';
  return status?.status === 'processing'
    ? 'Recording processing · Check again'
    : 'Recording unavailable · Check again';
}

export function buildBuilderLaunchLabel({ mode = 'ai', devicesReady = false } = {}) {
  if (!devicesReady) return mode === 'practice'
    ? 'Check devices for self practice ▸'
    : 'Check devices for AI interview ▸';
  return mode === 'practice'
    ? 'Review devices and begin practice ▸'
    : 'Review devices and start AI interview ▸';
}

export function buildResultsNextAction({ reviewScope = null, interviewerProvider = null, launchMode = 'practice' } = {}) {
  if (reviewScope === 'admin') {
    return Object.freeze({ label: 'Back to student library ▸', destination: 'mentor', launchMode: null });
  }
  const aiInterview = interviewerProvider === 'openai-gpt-live'
    || (interviewerProvider == null && launchMode === 'ai');
  return aiInterview
    ? Object.freeze({ label: 'Plan another AI interview ▸', destination: 'newsession', launchMode: 'ai' })
    : Object.freeze({ label: 'Practice another question ▸', destination: 'training', launchMode: 'practice' });
}

export function buildHomeViewModel({ identity = null, sessions = [], mentorPriorities = null } = {}) {
  const { initials, greetingName } = buildIdentityViewModel(identity);
  const latest = [...sessions]
    .filter((session) => session && typeof session === 'object')
    .sort((left, right) => Date.parse(right.startedAt || right.endedAt || 0) - Date.parse(left.startedAt || left.endedAt || 0))[0] || null;
  const priorities = Array.isArray(mentorPriorities?.priorities) ? mentorPriorities.priorities : [];
  return Object.freeze({
    initials,
    greetingName,
    continueTitle: latest?.title || latest?.questionText || 'No saved practice yet',
    continueNote: latest ? 'Resume your latest private recording and evidence.' : 'Your saved attempts will appear here after your first practice.',
    mentorLabel: priorities.length ? 'Your next priority' : 'Mentor focus',
    mentorPriority: priorities[0]?.text || 'No mentor priority has been set yet.',
  });
}

function normalizedConversationTurn(turn, { spine }) {
  const text = spine ? turn?.transcript?.text : turn?.text;
  if (typeof text !== 'string' || !text.trim()) return null;
  const speaker = ['student', 'applicant', 'user'].includes(String(turn?.speaker || '').toLowerCase())
    ? 'student'
    : 'interviewer';
  const startMs = Number(turn?.startMs);
  const endMs = Number(turn?.endMs);
  return Object.freeze({
    speaker,
    text: text.trim(),
    startMs: Number.isFinite(startMs) ? startMs : 0,
    endMs: Number.isFinite(endMs) ? endMs : (Number.isFinite(startMs) ? startMs : 0),
    canonical: spine && Boolean(turn?.transcript?.canonical_ref),
  });
}

export function persistedConversationTurns({ sessionDetail = null, envelope = null } = {}) {
  const canonicalTurns = Array.isArray(sessionDetail?.spine?.turns)
    ? sessionDetail.spine.turns.map((turn) => normalizedConversationTurn(turn, { spine: true })).filter(Boolean)
    : [];
  if (canonicalTurns.length) {
    const hasCanonicalStudentTurns = canonicalTurns.some((turn) => turn.speaker === 'student' && turn.canonical);
    return Object.freeze(canonicalTurns.filter((turn) => turn.speaker !== 'student'
      || !hasCanonicalStudentTurns
      || turn.canonical));
  }

  const liveTurns = sessionDetail?.results?.payload?.liveConversation?.turns
    || envelope?.liveConversation?.turns
    || [];
  return Object.freeze(Array.isArray(liveTurns)
    ? liveTurns.map((turn) => normalizedConversationTurn(turn, { spine: false })).filter(Boolean)
    : []);
}
