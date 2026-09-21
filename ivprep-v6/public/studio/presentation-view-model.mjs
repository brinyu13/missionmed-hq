const readyMetric = (metrics, key) => metrics?.[key]?.available === true;

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
  mentorPriorities = null, durableAvailable = false, contextCapabilities = {},
} = {}) {
  const top3Count = Array.isArray(mentorPriorities?.priorities) ? mentorPriorities.priorities.length : 0;
  const top3Connected = Number.isSafeInteger(mentorPriorities?.version) && mentorPriorities.version > 0;
  const storyForgeConnected = contextCapabilities?.storyForge?.connected === true;
  const riseConnected = contextCapabilities?.rise?.connected === true;
  const fileVaultConnected = contextCapabilities?.fileVault?.connected === true;
  return Object.freeze([
    { name: 'StoryForge', available: storyForgeConnected, connected: storyForgeConnected, detail: 'Your authorized stories' },
    { name: 'RISE', available: riseConnected, connected: riseConnected, detail: 'Verified program intelligence' },
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

export function buildHomeViewModel({ identity = null, sessions = [], mentorPriorities = null } = {}) {
  const displayName = String(identity?.displayName || '').trim();
  const roles = Array.isArray(identity?.roles) ? identity.roles.map((role) => String(role).toLowerCase()) : [];
  const founder = identity?.founder === true || roles.some((role) => ['administrator', 'admin'].includes(role));
  const words = displayName.split(/\s+/u).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join('') || (founder ? 'DB' : 'IV');
  const latest = [...sessions]
    .filter((session) => session && typeof session === 'object')
    .sort((left, right) => Date.parse(right.startedAt || right.endedAt || 0) - Date.parse(left.startedAt || left.endedAt || 0))[0] || null;
  const priorities = Array.isArray(mentorPriorities?.priorities) ? mentorPriorities.priorities : [];
  return Object.freeze({
    initials,
    greetingName: founder ? 'Dr Brian.' : (words[0] ? `${words[0]}.` : 'Doctor.'),
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
