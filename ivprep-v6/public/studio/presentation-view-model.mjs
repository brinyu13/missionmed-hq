import { buildLongitudinalModel, canCompareAttempts } from './longitudinal-model.mjs';
import { projectInterviewerNameUse, selfPracticeAnalysisAvailability, sourceBoundSelfPracticeResult } from '../capabilities/context-results.mjs';

export function buildNameUseReview(saved = null) {
  const detail = saved?.sessionDetail ?? saved?.session;
  const consistent = !saved?.session?.id || (detail?.id === saved.session.id
    && (!detail?.ownerSubject || !saved.session.ownerSubject || detail.ownerSubject === saved.session.ownerSubject));
  const observed = projectInterviewerNameUse(consistent ? detail : null, consistent ? saved?.envelope : null);
  const reasons = {
    NOT_SELECTED_FOR_SAVED_ATTEMPT: 'Not assessed — optional name-use observations were not selected for this saved attempt.',
    NO_UNAMBIGUOUS_CANONICAL_CANDIDATE_TRANSCRIPT: 'Not assessed — a canonical candidate transcript is not available yet.',
    CANDIDATE_AUDIO_SOURCE_UNVERIFIED: 'Not assessed — this recording does not have verified candidate-only speech for name-use observations.',
  };
  return Object.freeze({ ...observed, heading: 'Possible interviewer-name mentions',
    copy: observed.status === 'AVAILABLE'
      ? `Manually supplied name: ${observed.name}. ${observed.limitation}`
      : reasons[observed.reason],
    replayEvidence: Object.freeze({ transcript: Object.freeze({ status: observed.status,
      segments: Object.freeze(observed.matches.map(match => Object.freeze({
        id: match.segmentId, startMs: match.startMs, endMs: match.endMs,
      }))),
    }) }),
    moments: Object.freeze(observed.matches.map(match => Object.freeze({ ...match,
      label: match.third ? `${match.third[0].toUpperCase()}${match.third.slice(1)} recording third`
        : 'Recording third unavailable',
    }))) });
}

export function buildCandidateAnalysisState(detail = null) {
  const status = selfPracticeAnalysisAvailability(detail || {});
  const saved = sourceBoundSelfPracticeResult(detail || {});
  const legacy = detail?.spine?.candidateAttribution?.status === 'VERIFIED';
  const retry = Boolean(saved && detail.analysisAvailability.semanticRetryAvailable);
  return Object.freeze({
    available: legacy || status === 'READY' || Boolean(saved),
    canGenerate: legacy || status === 'READY' || retry,
    actionLabel: retry ? 'Retry answer coaching' : saved
      ? saved.analysis?.status === 'AVAILABLE' ? 'Transcript + coaching saved' : 'Transcript saved · coaching unavailable'
      : legacy || status === 'READY' ? 'Generate transcript + coaching' : 'Answer coaching unavailable',
    unavailableCopy: 'Answer coaching is unavailable because we cannot reliably separate candidate speech from other audio in this recording. The recording and measured delivery signals remain available; saved live conversation can be reviewed in Film Room.',
  });
}

// Retry projects a saved owner-scoped setup, not whatever happens to be in the
// current builder. Current catalog/owner authorization must still be resolved.
export function buildRetryIntent({ detail = null, reviewScope = null, catalog = [], drill = null } = {}) {
  const source = detail?.retryContext;
  const unavailable = reason => Object.freeze({ available: false, reason });
  if (reviewScope === 'admin' || !['question', 'quick', 'mock'].includes(detail?.sessionType)
      || !source || source.schema !== 'ivoc.retry-intent.v1'
      || source.sourceSessionId !== detail.id) return unavailable('Retry is available from your own saved answer.');
  const question = catalog.find(item => item.question_id === source.questionId);
  if (!question || question.canonical_text !== source.questionText) {
    return unavailable('This question has changed or is no longer available. Choose a current question from the library.');
  }
  const sourceGoal = ['Full IV Simulation', 'Guided Mock IV Practice', 'Individual Question'].includes(source.goal) ? source.goal : null;
  const sourceStyle = ['Dove', 'Peacock', 'Owl', 'Eagle'].includes(source.interviewerStyle) ? source.interviewerStyle : null;
  const goal = sourceGoal || 'Individual Question';
  const sources = Array.isArray(source.contextSources) ? source.contextSources
    .filter(item => ['CV', 'File Vault', 'MCC', 'Top 3', 'Prior IVOC'].includes(item)) : [];
  const notes = [source.questionVersion ? `Original question version: ${source.questionVersion}.` : 'Retry saved wording; original question version unavailable.',
    sourceGoal ? 'Original practice goal retained; one question in this retry.' : 'Original practice goal unavailable; using Individual Question.',
    'Context will be refreshed under your current permissions.'];
  if (source.program) notes.push('Reselect the program to refresh its verified intelligence.');
  if (source.contextSources?.includes('StoryForge')) notes.push('Select StoryForge again to confirm current story consent.');
  if (goal === 'Individual Question' && source.pressurePractice) notes.push('Pressure is unavailable for Individual Question.');
  if (!sourceStyle) notes.push('Original conversation style unavailable; using Owl. You can choose another style.');
  return Object.freeze({ available: true, sourceSessionId: detail.id, question,
    launchMode: detail.interviewerProvider === 'openai-gpt-live' ? 'ai' : 'practice',
    wizard: { goal, retrySessionType: detail.sessionType, pressurePractice: goal !== 'Individual Question' && source.pressurePractice === true,
      interviewer: source.interviewer || 'Program Director', environment: source.environment || 'MissionMed',
      interviewerStyle: sourceStyle || 'Owl',
      program: source.program || '', programId: null, programReleaseId: null, programVerified: false,
      contextSources: sources, storyForgeInclude: false, storyForgeOptIn: null,
      focus: String(drill?.text || '').slice(0, 500) },
    notes: Object.freeze(notes), drill: drill?.text ? String(drill.text).slice(0, 500) : null });
}

// A citation is a replay action only when this answer has one unambiguous,
// bounded recording-relative range. Missing timestamps never become zero.
export function buildEvidenceMomentLinks(result, refs = [], durationMs = null) {
  const finiteMs = value => value !== null && value !== undefined && value !== ''
    && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
  const duration = finiteMs(durationMs);
  const segments = result?.transcript?.status === 'AVAILABLE' && Array.isArray(result.transcript.segments)
    ? result.transcript.segments : [];
  return [...new Set(Array.isArray(refs) ? refs : [])].slice(0, 8).map(ref => {
    const matches = segments.filter(segment => segment.id === ref);
    const startMs = matches.length === 1 ? finiteMs(matches[0].startMs) : null;
    const endMs = matches.length === 1 ? finiteMs(matches[0].endMs) : null;
    const available = duration > 0 && startMs !== null && endMs !== null
      && endMs > startMs && endMs <= duration;
    const name = /^seg-(\d+)$/u.exec(String(ref));
    const label = name ? `Moment ${name[1]}` : 'Cited moment';
    return Object.freeze({ ref, startMs, endMs, available,
      label: available ? `${label} · ${(startMs / 1000).toFixed(1)}–${(endMs / 1000).toFixed(1)}s`
        : `${label} · replay range unavailable` });
  });
}

export function debriefConfidenceCopy(confidence = {}) {
  // Model estimates are not calibrated measurements or a grade of the student.
  // Preserve the underlying evidence values; this is presentation copy only.
  const labels = { HIGH: 'High', MODERATE: 'Moderate', LIMITED: 'Limited' };
  const label = typeof confidence?.label === 'string' && Object.hasOwn(labels, confidence.label)
    ? labels[confidence.label] : null;
  return label
    ? `AI-estimated evidence confidence: ${label}. This qualitative estimate concerns the cited evidence—not a validated performance or readiness score.`
    : 'AI-estimated evidence confidence is unavailable. Review the cited evidence and its limitations; no performance or readiness score is established.';
}

export function buildInterviewerSelectionLabel(wizard = {}) {
  const role = ['Program Director', 'Faculty', 'Chief Resident', 'Associate Program Director'].includes(wizard.interviewer)
    ? wizard.interviewer : 'Interviewer';
  const style = ['Dove', 'Peacock', 'Owl', 'Eagle'].includes(wizard.interviewerStyle) ? wizard.interviewerStyle : null;
  return style ? `${role} · ${style}` : role;
}

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
    ? sessionDetail.spine.turns.filter(turn => sessionDetail.spine.candidateAttribution?.status === 'VERIFIED'
        || (sourceBoundSelfPracticeResult(sessionDetail)
          && turn?.transcript?.sourceBinding?.sourceRecordingId === sessionDetail.spine.sourceBinding.sourceRecordingId)
        || (!turn?.transcript?.canonical_ref && Boolean(turn?.transcript?.provisional_ref)))
      .map((turn) => normalizedConversationTurn(turn, { spine: true })).filter(Boolean)
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
