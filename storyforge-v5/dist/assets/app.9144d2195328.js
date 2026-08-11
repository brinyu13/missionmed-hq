import { createAuthClient } from './d2cfc4e447d2';

/*
 * StoryForge V5 production adapter
 *
 * The founder-approved V5 HTML is the presentation and interaction authority.
 * This file deliberately keeps its state small: identity and durable product data
 * come from the signed StoryForge API; only navigation, filters, and open-surface
 * state live in the browser.
 */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const rail = $('#rail');
const hdr = $('#hdr');
const main = $('#main');
const advBanner = $('#advBanner');
const room = $('#room');
const capture = $('#capture');
const quick = $('#quick');
const qad = $('#qad');
const palette = $('#pal');
const sessionBar = $('#sesh');
const teaching = $('#teach');
const toastNode = $('#toast');

const FIXTURE_PERSONA_KEY = 'storyforge_local_fixture_persona';
const VOICE_HINT_KEY = 'storyforge_voice_hint_seen';
const VOICE_SEGMENT_PLAN = Object.freeze([4000, 15000]);
const VOICE_MAX_DURATION_SECONDS = 20 * 60;
const FIXTURE_PERSONAS = new Set([
  'student',
  'founderStudent',
  'studentOther',
  'mentor',
  'mentorTwo',
  'unassignedMentor',
  'admin',
]);

const STATUS = Object.freeze({
  private: {
    label: 'Private',
    hint: 'Only you can see this. Submit it when you want feedback.',
    col: 'st-private',
  },
  awaiting: {
    label: 'Awaiting review',
    hint: 'Submitted — your mentor hasn’t completed a review yet.',
    col: 'st-awaiting',
  },
  in_review: {
    label: 'In review',
    hint: 'Your mentor is actively working on this story.',
    col: 'st-in_review',
  },
  changes: {
    label: 'Changes requested',
    hint: 'Your mentor asked for a revision. Read the feedback and resubmit.',
    col: 'st-changes',
  },
  reviewed: {
    label: 'Reviewed',
    hint: 'Your mentor completed a review of this story.',
    col: 'st-reviewed',
  },
  approved: {
    label: 'Approved',
    hint: 'Ready to use in your application.',
    col: 'st-approved',
  },
});

const THEMES = Object.freeze([
  { id: 'mistake', label: 'Mistakes', hue: '#ff8a5c' },
  { id: 'patient', label: 'Patient care', hue: '#ff6b8a' },
  { id: 'leader', label: 'Leadership', hue: '#ffd76a' },
  { id: 'conflict', label: 'Conflict', hue: '#ff5470' },
  { id: 'comm', label: 'Communication', hue: '#39d6ff' },
  { id: 'team', label: 'Teamwork', hue: '#4ade9d' },
  { id: 'resil', label: 'Resilience', hue: '#ffb340' },
  { id: 'growth', label: 'Growth', hue: '#7ee0a3' },
  { id: 'identity', label: 'Identity', hue: '#8a7dff' },
  { id: 'advoc', label: 'Advocacy', hue: '#5cc8ff' },
]);

const CATEGORIES = Object.freeze([
  { id: 'clinical', label: 'Clinical' },
  { id: 'personal', label: 'Personal' },
  { id: 'research', label: 'Research' },
  { id: 'leadership', label: 'Leadership' },
  { id: 'teaching', label: 'Teaching' },
  { id: 'volunteer_service', label: 'Volunteer / Service' },
  { id: 'adversity_challenge', label: 'Adversity / Challenge' },
  { id: 'teamwork', label: 'Teamwork' },
  { id: 'communication', label: 'Communication' },
  { id: 'ethics_professionalism', label: 'Ethics / Professionalism' },
  { id: 'other', label: 'Other' },
]);

const USES = Object.freeze([
  { id: 'ps', label: 'Personal Statement' },
  { id: 'iv', label: 'Interview Set' },
  { id: 'letter', label: 'Letter of Recommendation' },
  { id: 'myeras_experiences', label: 'MyERAS Experiences' },
  { id: 'myeras_most_impactful', label: 'MyERAS Most Impactful' },
  { id: 'later', label: 'Someday / Fellowship' },
]);

const LEGACY_USES = Object.freeze([
  { id: 'ps', label: 'Personal statement' },
  { id: 'iv', label: 'Interview set' },
  { id: 'letter', label: 'Letter conversations' },
  { id: 'later', label: 'Someday / fellowship' },
]);

const BIRDS = Object.freeze([
  { id: 'peacock', label: 'Peacock', emo: '🦚', hue: '#8a7dff', hint: 'Expressive, colorful, memorable in the room' },
  { id: 'dove', label: 'Dove', emo: '🕊️', hue: '#aab8d1', hint: 'Warm, empathetic, patient-centered' },
  { id: 'owl', label: 'Owl', emo: '🦉', hue: '#ffb340', hint: 'Analytical, careful, learns from error' },
  { id: 'eagle', label: 'Eagle', emo: '🦅', hue: '#4ade9d', hint: 'Decisive, leads, takes ownership' },
]);

const POSITIONS = Object.freeze([
  { id: 'pd', label: 'Program Director' },
  { id: 'apd', label: 'Associate Program Director' },
  { id: 'faculty', label: 'Faculty' },
  { id: 'resident', label: 'Resident' },
  { id: 'behaviorist', label: 'Behaviorist' },
]);

const FAMILIES = Object.freeze([
  { id: 'core', label: 'Core & Common', ico: '★', hue: '#39d6ff', desc: 'The questions every applicant gets. Have these cold.' },
  { id: 'behavioral', label: 'Behavioral', ico: '⇄', hue: '#4ade9d', desc: '“Tell me about a time…” — teamwork, mistakes, conflict, leadership.' },
  { id: 'clinical', label: 'Clinical', ico: '✚', hue: '#ff5470', desc: 'Patient stories — and the medical follow-ups they invite.' },
  { id: 'cv', label: 'CV & Application', ico: '▤', hue: '#ffd76a', desc: 'Anything on your application is fair game.' },
  { id: 'redflag', label: 'Red Flag', ico: '⚑', hue: '#ff7a3d', desc: 'Scores, gaps, weaknesses — answer without flinching.' },
  { id: 'personal', label: 'Personal', ico: '◉', hue: '#8a7dff', desc: 'Who you are outside the hospital.' },
  { id: 'custom', label: 'Custom', ico: '✎', hue: '#aab8d1', desc: 'Questions written for this student specifically.' },
]);

const BACKGROUNDS = Object.freeze([
  { id: 'ember', name: 'Emberlight', ico: '🔥', desc: 'Rising embers with warm aurora depth — the StoryForge signature.', prev: 'radial-gradient(circle at 30% 80%,rgba(255,150,60,.35),transparent 55%),radial-gradient(circle at 75% 20%,rgba(90,77,208,.4),transparent 60%),#0a0d14' },
  { id: 'aurora', name: 'Aurora', ico: '🌌', desc: 'Slow curtains of northern light drifting across the dark.', prev: 'linear-gradient(115deg,rgba(74,222,157,.22),transparent 40%),linear-gradient(245deg,rgba(57,214,255,.25),transparent 50%),#0a0e16' },
  { id: 'constellation', name: 'Night Constellation', ico: '✦', desc: 'A quiet star field with faint constellations tracing themselves.', prev: 'radial-gradient(1.5px 1.5px at 20% 30%,#fff,transparent),radial-gradient(1px 1px at 70% 60%,#9fd8ff,transparent),radial-gradient(1.5px 1.5px at 45% 75%,#fff,transparent),#080b13' },
  { id: 'tide', name: 'Deep Tide', ico: '〰', desc: 'Soft light currents moving slowly through deep water.', prev: 'linear-gradient(180deg,transparent 30%,rgba(57,214,255,.16) 45%,transparent 60%,rgba(90,141,255,.14) 78%,transparent 92%),#090d15' },
  { id: 'meridian', name: 'Meridian', ico: '▤', desc: 'Restrained geometric contour lines gliding with a soft glow.', prev: 'repeating-linear-gradient(175deg,transparent 0 18px,rgba(57,214,255,.09) 18px 19px),#0a0d14' },
  { id: 'emberstorm', name: 'Ember Storm', ico: '🌋', desc: 'Energetic — the signature embers turned up: rolling warm light in constant, obvious motion.', prev: 'radial-gradient(circle at 28% 85%,rgba(255,150,60,.5),transparent 50%),radial-gradient(circle at 78% 18%,rgba(255,84,112,.3),transparent 55%),#0a0d14' },
  { id: 'lumen', name: 'Lumen Drift', ico: '💫', desc: 'Energetic — broad ribbons of gold and violet light, always slowly moving.', prev: 'linear-gradient(60deg,rgba(255,215,106,.3),transparent 45%),linear-gradient(300deg,rgba(138,125,255,.34),transparent 50%),#0a0d14' },
  { id: 'static', name: 'Static Dark', ico: '■', desc: 'A flat, still dark background. No motion at all.', prev: '#0b0e14' },
]);

const BUNDLED_PRESENTATION = Object.freeze({
  taxonomy: Object.freeze({
    categories: Object.freeze(CATEGORIES.map((entry, index) => Object.freeze({ ...entry, sortOrder: (index + 1) * 10, state: 'active', builtin: true }))),
    intendedUses: Object.freeze(USES.map((entry, index) => Object.freeze({ ...entry, sortOrder: (index + 1) * 10, state: 'active', builtin: true }))),
  }),
  sections: Object.freeze({
    storyCategories: Object.freeze({ title: 'Story categories', helper: 'Categories describe what happened. They stay separate from themes and intended uses.', mode: 'visible_optional' }),
    intendedUses: Object.freeze({ title: 'Where this story could be used', helper: 'Choose every application context where this story may help.', mode: 'visible_optional' }),
    workingVersion: Object.freeze({ title: 'Working version', helper: 'Edit freely here. The original telling stays untouched, always.', mode: 'visible_optional' }),
    learningLesson: Object.freeze({ title: 'Learning Lesson', helper: 'What this story taught you — the takeaway that travels with it.', mode: 'visible_optional' }),
    reviewSubmission: Object.freeze({ title: 'Submit for review', helper: 'Submitting makes this story available to an authorized reviewer.', mode: 'visible_optional' }),
  }),
  navigation: Object.freeze({ interviewPrepVisible: false }),
});

const MEMORY_PROMPTS = Object.freeze([
  'Was there a moment this week when a patient surprised you?',
  'What almost went wrong on your last rotation?',
  'Did anyone thank you recently? What for?',
  'When did you last feel like a real doctor?',
  'What is something you did this month that scared you a little?',
]);

const REFLECTION_PROMPTS = Object.freeze([
  'What would you do differently now?',
  'What does this story prove about you that a transcript cannot?',
  'Who else was in the room, and what did they see?',
  'What did this cost you, and what did it give you?',
  'If an interviewer pushed back on this story, what is the hard question?',
]);

const NAV = Object.freeze({
  student: [
    ['home', 'Home', '⌂'],
    ['library', 'Story Library', '▤'],
    ['inspiration', 'Inspiration', '✦'],
    ['requests', 'Request a Story', '↗'],
    ['prep', 'Interview Prep', '◇'],
    ['notifications', 'Notifications', '●'],
    ['settings', 'Settings', '⚙'],
  ],
  mentor: [
    ['home', 'Home', '⌂'],
    ['students', 'Students', '◎'],
    ['queue', 'Review Queue', '◫'],
    ['activity', 'My Activity', '↗'],
    ['prep', 'Interview Prep', '◇'],
    ['settings', 'Settings', '⚙'],
  ],
  admin: [
    ['qlib', 'Question Library', '◇'],
    ['settings', 'Release Controls', '⚙'],
  ],
});

const ADMIN_CONSOLE_NAV = Object.freeze([
  ['home', 'Admin Home', '⌂'],
  ['students', 'Students', '◎'],
  ['queue', 'Review Queue', '◫'],
  ['content', 'Content Studio', '✦'],
  ['qlib', 'Question Library', '◇'],
  ['settings', 'Release Controls', '⚙'],
]);

const SUITABILITY = Object.freeze({
  ps_only: 'Personal Statement only',
  interview_only: 'Interview only',
  both: 'Personal Statement + Interview',
  neither: 'Neither',
});

const state = {
  config: null,
  presentation: BUNDLED_PRESENTATION,
  user: null,
  activeRole: null,
  capabilities: Object.freeze({
    voiceCapture: false,
    adminConsole: false,
    submissionReview: false,
    taxonomy: false,
    inlinePriority: false,
    storySearch: false,
    mentorNotes: false,
    mentorNotesRead: false,
    storyMedia: false,
    storyVersions: false,
    inspiration: false,
    requestAStory: false,
    activityTracking: false,
    inspirationAdmin: false,
    adminDirectory: false,
    reviewCheck: false,
    adminReviewControls: false,
    storyFollowup: false,
  }),
  lockout: null,
  route: 'home',
  routeId: null,
  stories: [],
  notifications: [],
  students: [],
  questions: [],
  intelligence: null,
  selectedStudent: null,
  storyDetail: null,
  storyVersions: [],
  versionVoice: null,
  storyCompletionIntent: null,
  settingsPreview: {
    selectedBackground: null,
    previewBackground: null,
    selectedTextSize: null,
    previewTextSize: null,
  },
  storyHistoryExpanded: false,
  workshop: null,
  workshopFocusPairId: null,
  quick: null,
  assign: null,
  capturePrompt: null,
  capturePairQuestionId: null,
  promptIndex: 0,
  library: {
    query: '', status: '', sort: 'priority', star: '', bird: '', position: '', categories: [], uses: [],
  },
  queueBucket: 'all',
  questionFamily: 'all',
  questionQuery: '',
  questionStatus: '',
  questionSource: '',
  importPreview: [],
  importReviewFingerprint: '',
  importBatches: [],
  importSource: { name: 'pasted-questions', format: 'paste' },
  captureDraftVersion: null,
  captureDraftSaveTimer: 0,
  captureDraftSuppressCloseSave: false,
  captureRecovering: false,
  captureTypedOnlyFromAudio: false,
  adminFeatures: null,
  adminConsoleFeature: null,
  adminHealth: null,
  adminFeatureError: '',
  adminConsoleFeatureError: '',
  adminHealthError: '',
  adminContentDisplay: null,
  adminContentDraft: null,
  adminContentError: '',
  adminContentPreviewing: false,
  adminConsole: {
    home: null,
    students: [],
    studentsCursor: null,
    studentQuery: '',
    studentStatus: '',
    studentFilter: 'all',
    studentSession: '',
    studentSort: 'attention',
    studentPage: 1,
    savedViews: [],
    selectedSavedView: '',
    selectedStudent: null,
    queue: [],
    queueCursor: null,
    queueStatus: '',
    queueQuery: '',
    queueSession: '',
    queueSort: 'oldest',
    queuePage: 1,
    directoryDetail: null,
    contentPrompts: [],
    story: null,
  },
  mentorNoteDraft: null,
  mentorNoteRecording: null,
  storyMediaUpload: null,
  v2: {
    session: null,
    consent: null,
    consentDeferredThisSession: false,
    homeRecommendations: [],
    inspiration: { prompts: [], layout: 'list', query: '', sessionId: null },
    invitations: [],
    contributions: [],
    requestUi: { view: 'home', editingId: '', reinviteFrom: '', preview: null, draft: null },
    guest: {
      invitation: null,
      route: null,
      mode: 'landing',
      promptIndex: 0,
      promptId: '',
      text: '',
      sentCount: 0,
      voice: null,
    },
  },
  returnFocus: null,
  busy: false,
};

let guestPagehideBound = false;

const auth = createAuthClient({
  onLockout(lockoutState, message) {
    suspendVoiceForIdentityExit();
    stopActivityBeacon();
    state.user = null;
    state.capabilities = Object.freeze({
      voiceCapture: false,
      adminConsole: false,
      submissionReview: false,
      taxonomy: false,
      inlinePriority: false,
      storySearch: false,
      mentorNotes: false,
      mentorNotesRead: false,
      storyMedia: false,
      storyVersions: false,
      inspiration: false,
      requestAStory: false,
      activityTracking: false,
      inspirationAdmin: false,
      adminDirectory: false,
      reviewCheck: false,
      adminReviewControls: false,
      storyFollowup: false,
    });
    state.v2.session = null;
    state.v2.consent = null;
    state.v2.consentDeferredThisSession = false;
    state.v2.homeRecommendations = [];
    state.captureRecovering = false;
    state.lockout = lockoutState || 'access_unavailable';
    renderLockout(state.lockout, message);
  },
});

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function attr(value) {
  return esc(value).replaceAll('`', '&#096;');
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function progressClass(value) {
  const rounded = Math.max(0, Math.min(100, Math.round(Number(value || 0) / 5) * 5));
  return `progress-${rounded}`;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function isoValue(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function formatDate(value) {
  if (!value) return 'Not yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return 'Not yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)} at ${new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)}`;
}

function ago(value) {
  if (!value) return 'not yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const days = Math.max(0, (Date.now() - date.getTime()) / 86_400_000);
  if (days < 1) return 'today';
  if (days < 2) return 'yesterday';
  if (days < 7) return `${Math.round(days)} days ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 36.5) / 10}y ago`;
}

function canonicalStatus(raw) {
  const value = String(raw || 'private').toLowerCase();
  return ({
    submitted: 'awaiting',
    resubmitted: 'awaiting',
    opened: 'in_review',
    needs_revision: 'changes',
    pending: 'awaiting',
  })[value] || (STATUS[value] ? value : 'private');
}

function serverStatus(value) {
  return ({
    awaiting: 'submitted',
    in_review: 'opened',
    changes: 'needs_revision',
  })[value] || value;
}

function normalizeStory(raw = {}) {
  const statusRaw = firstDefined(raw.status, raw.review_status, 'private');
  const status = canonicalStatus(statusRaw);
  const revisions = asArray(firstDefined(raw.revisions, raw.story_revisions));
  const mappings = asArray(firstDefined(raw.questionMappings, raw.question_mappings, raw.pairs, raw.story_question_pairs));
  const audio = firstDefined(raw.audio, raw.audio_asset, raw.audioAsset, null);
  return {
    ...raw,
    id: String(firstDefined(raw.id, raw.story_id, '')),
    studentId: String(firstDefined(raw.studentId, raw.student_id, '')),
    studentName: String(firstDefined(raw.studentName, raw.student_name, state.user?.display_name, 'Student')),
    title: String(firstDefined(raw.title, raw.title_snapshot, 'Untitled story')),
    text: String(firstDefined(raw.text, raw.body, raw.current_text, raw.working_text, '')),
    originalText: String(firstDefined(raw.original?.text, raw.original_text, raw.originalText, revisions[0]?.text_snapshot, raw.text, '')),
    originalTitle: String(firstDefined(raw.original?.title, raw.original_title, raw.originalTitle, revisions[0]?.title_snapshot, raw.title, 'Untitled story')),
    lesson: String(firstDefined(raw.lesson, '')),
    prefixEnabled: Boolean(firstDefined(raw.prefixEnabled, raw.prefix_enabled, true)),
    visibility: ['private', 'mentor_visible'].includes(firstDefined(raw.visibility, raw.visibility_state))
      ? firstDefined(raw.visibility, raw.visibility_state)
      : null,
    status,
    revised: Boolean(firstDefined(raw.revised, statusRaw === 'resubmitted')),
    studentScore: Number(firstDefined(raw.studentScore, raw.student_score, raw.priority, 0)) || 0,
    mentorScore: Number(firstDefined(raw.mentorScore, raw.mentor_score, 0)) || 0,
    reviewSuitability: String(firstDefined(raw.reviewSuitability, raw.review_suitability, '')),
    studentStar: Boolean(firstDefined(raw.studentStar, raw.student_star, false)),
    mentorStar: Boolean(firstDefined(raw.mentorStar, raw.mentor_star, false)),
    themes: asArray(raw.themes).map(String),
    categories: asArray(firstDefined(raw.categories, raw.story_categories)).map(String),
    uses: asArray(raw.uses).map(String),
    birds: asArray(raw.birds).map(String),
    positions: asArray(raw.positions).map(String),
    rowVersion: Number(firstDefined(raw.rowVersion, raw.row_version, 0)) || 0,
    captureType: String(firstDefined(raw.captureType, raw.capture_type, 'text')),
    createdAt: isoValue(firstDefined(raw.createdAt, raw.created_at, raw.captured_at)),
    updatedAt: isoValue(firstDefined(raw.studentUpdatedAt, raw.student_updated_at, raw.updatedAt, raw.updated_at)),
    submittedAt: isoValue(firstDefined(raw.submittedAt, raw.submitted_at)),
    lastSubmittedAt: isoValue(firstDefined(raw.lastSubmittedAt, raw.last_submitted_at)),
    openedAt: isoValue(firstDefined(raw.openedAt, raw.opened_at, raw.firstOpenedAt, raw.first_opened_at)),
    reviewedAt: isoValue(firstDefined(raw.reviewedAt, raw.reviewed_at, raw.lastReviewedAt, raw.last_reviewed_at)),
    statusChangedAt: isoValue(firstDefined(raw.statusChangedAt, raw.status_changed_at)),
    feedbackSentAt: isoValue(firstDefined(raw.feedbackSentAt, raw.feedback_sent_at)),
    feedbackOpenedAt: isoValue(firstDefined(raw.feedbackOpenedAt, raw.feedback_opened_at)),
    studentRespondedAt: isoValue(firstDefined(raw.studentRespondedAt, raw.student_responded_at)),
    reviewedByName: String(firstDefined(raw.reviewedByName, raw.reviewed_by_name, '')),
    reviewedByRole: String(firstDefined(raw.reviewedByRole, raw.reviewed_by_role, '')),
    feedback: asArray(firstDefined(raw.feedback, raw.comments)),
    mentorNotes: asArray(firstDefined(raw.mentorNotes, raw.mentor_notes)),
    media: asArray(firstDefined(raw.media, raw.storyMedia, raw.story_media)),
    revisions,
    history: asArray(firstDefined(raw.history, raw.auditEvents, raw.audit_events)),
    reflections: asArray(raw.reflections),
    mappings,
    questionCount: Number(firstDefined(raw.questionCount, raw.question_count, mappings.length)) || mappings.length,
    useSuggestions: asArray(firstDefined(raw.useSuggestions, raw.use_suggestions, raw.suggestions)),
    mentorReviewAvailable: Boolean(firstDefined(raw.mentorReviewAvailable, raw.mentor_review_available, true)),
    audio,
    audioAssetId: String(firstDefined(raw.audioAssetId, raw.audio_asset_id, audio?.id, raw.original?.audio_asset_id, '')),
    audioDurationMs: Number(firstDefined(
      raw.audioDurationMs,
      raw.audio_duration_ms,
      audio?.durationMs,
      audio?.duration_ms,
      raw.original?.audio_duration_ms,
      0,
    )) || 0,
    unreadMentorActivity: Boolean(firstDefined(
      raw.unreadMentorActivity,
      raw.unread_mentor_activity,
      raw.hasUnreadFeedback,
      raw.has_unread_feedback,
      raw.unread,
      false,
    )),
    craft: firstDefined(raw.craft, {
      detail: raw.craft_detail,
      stakes: raw.craft_stakes,
      turn: raw.craft_turn,
      honest: raw.craft_honest,
      lesson: raw.craft_lesson,
    }),
  };
}

function normalizeQuestion(raw = {}) {
  return {
    ...raw,
    id: String(firstDefined(raw.id, raw.question_id, '')),
    text: String(firstDefined(raw.text, raw.question_text, raw.q, '')),
    family: String(firstDefined(raw.family, raw.fam, 'custom')),
    source: String(firstDefined(raw.source, raw.provenance, 'MissionMed')),
    governanceState: String(firstDefined(raw.governanceState, raw.governance_state, 'approved')),
    state: String(firstDefined(raw.state, raw.coverage_state, 'none')),
    storyCount: Number(firstDefined(raw.storyCount, raw.story_count, 0)) || 0,
  };
}

function normalizeStudent(raw = {}) {
  return {
    ...raw,
    id: String(firstDefined(raw.id, raw.student_id, '')),
    name: String(firstDefined(raw.name, raw.display_name, raw.student_name, 'Student')),
    first: String(firstDefined(raw.first, raw.first_name, raw.display_name, raw.student_name, 'Student')).split(/\s+/)[0],
    cohort: String(firstDefined(raw.cohort, '')),
    year: String(firstDefined(raw.year, raw.training_year, raw.academic_year, '')),
    specialty: String(firstDefined(raw.specialty, raw.specialty_interest, '')),
    cycle: String(firstDefined(raw.cycle, raw.application_cycle, '')),
    storyCount: Number(firstDefined(raw.storyCount, raw.story_count, 0)) || 0,
    awaitingReview: Number(firstDefined(raw.awaitingReview, raw.awaiting_review, 0)) || 0,
    revised: Number(firstDefined(raw.revised, raw.revised_count, 0)) || 0,
    waitingOnStudent: Number(firstDefined(raw.waitingOnStudent, raw.waiting_on_student, 0)) || 0,
    unscored: Number(firstDefined(raw.unscored, raw.unscored_count, 0)) || 0,
    unreadCount: Number(firstDefined(raw.unreadCount, raw.unread_count, 0)) || 0,
    lastCaptureAt: isoValue(firstDefined(raw.lastCaptureAt, raw.last_capture_at, raw.last_activity_at)),
    lastSubmittedAt: isoValue(firstDefined(raw.lastSubmittedAt, raw.last_submitted_at, raw.last_shared_at)),
  };
}

function unwrapStory(payload) {
  const root = payload?.story ? { ...payload.story, ...payload } : payload;
  return normalizeStory(root || {});
}

function jsonOptions(method, body) {
  return {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

async function optionalRequest(path, fallback) {
  try {
    return await auth.request(path);
  } catch (error) {
    if ([404, 405, 501].includes(error.status)) return fallback;
    throw error;
  }
}

const api = Object.freeze({
  config: () => auth.publicRequest('api/config'),
  session: () => auth.request('/api/session'),
  presentation: () => auth.request('/api/presentation'),
  adminContentDisplay: () => auth.request('/api/admin/console/content-display'),
  validateContentDisplay: (body) => auth.request('/api/admin/console/content-display/validate', jsonOptions('POST', body)),
  publishContentDisplay: (body) => auth.request('/api/admin/console/content-display/publish', jsonOptions('POST', body)),
  restoreContentDisplay: (body) => auth.request('/api/admin/console/content-display/restore-defaults', jsonOptions('POST', body)),
  fixture: (persona) => auth.request(`/api/dev/session/${persona}`, jsonOptions('POST', {})),
  stories: () => auth.request('/api/stories'),
  story: (id) => auth.request(`/api/stories/${id}`),
  createStory: (body) => auth.request('/api/stories', jsonOptions('POST', body)),
  updateStory: (id, body) => auth.request(`/api/stories/${id}`, jsonOptions('PATCH', body)),
  submitStory: (id, surface = 'workspace') => auth.request(`/api/stories/${id}/submit`, jsonOptions('POST', { surface })),
  withdrawStory: (id, body) => auth.request(`/api/stories/${id}/withdraw`, jsonOptions('POST', body)),
  viewStory: (id, surface = 'workspace') => auth.request(`/api/stories/${id}/open`, jsonOptions('POST', { surface })),
  legacyOpenStory: (id, surface = 'workspace') => auth.request(`/api/stories/${id}/open`, jsonOptions('POST', { surface })),
  storyStatus: (id, status, surface = 'workspace') => auth.request(`/api/stories/${id}/status`, jsonOptions('POST', { status, surface })),
  legacyReview: (id, body) => auth.request(`/api/stories/${id}/review`, jsonOptions('POST', body)),
  feedback: (id, body) => auth.request(`/api/stories/${id}/feedback`, jsonOptions('POST', body)),
  ask: (id, prompt, surface = 'workspace') => auth.request(`/api/stories/${id}/reflections`, jsonOptions('POST', { prompt, surface })),
  evaluation: (id, body) => auth.request(`/api/stories/${id}/evaluation`, jsonOptions('PATCH', body)),
  storyPriority: (id, body) => auth.request(`/api/stories/${id}/priority`, jsonOptions('PATCH', body)),
  storyTaxonomy: (id, body) => auth.request(`/api/stories/${id}/taxonomy`, jsonOptions('PATCH', body)),
  storyMedia: (id) => auth.request(`/api/stories/${id}/media`),
  allocateStoryMedia: (id, body) => auth.request(`/api/stories/${id}/media`, jsonOptions('POST', body)),
  verifyStoryMedia: (id, body) => auth.request(`/api/story-media/${id}/verify`, jsonOptions('POST', body)),
  storyMediaPlayback: (id) => auth.request(`/api/story-media/${id}/playback`),
  updateStoryMedia: (id, body) => auth.request(`/api/story-media/${id}`, jsonOptions('PATCH', body)),
  removeStoryMedia: (id) => auth.request(`/api/story-media/${id}`, { method: 'DELETE' }),
  addReflection: (id, prompt) => auth.request(`/api/stories/${id}/reflections`, jsonOptions('POST', { prompt })),
  answerReflection: (_id, reflectionId, answer) => auth.request(`/api/reflections/${reflectionId}`, jsonOptions('PATCH', { answer, surface: 'workspace' })),
  notifications: () => auth.request('/api/notifications'),
  readNotification: (id) => auth.request(`/api/notifications/${id}/read`, jsonOptions('POST', {})),
  readAllNotifications: () => auth.request('/api/notifications/read-all', jsonOptions('POST', {})),
  consent: () => auth.request('/api/consent'),
  decideConsent: (decision) => auth.request('/api/consent', jsonOptions('POST', { decision })),
  storyVisibility: (id, visibility, expectedVersion) => auth.request(`/api/stories/${id}/visibility`, jsonOptions('POST', { visibility, expectedVersion })),
  storyVersions: (id) => auth.request(`/api/stories/${id}/versions`),
  saveStoryVersion: (id, key, body) => auth.request(`/api/stories/${id}/versions/${key}`, jsonOptions('PATCH', body)),
  restoreStoryVersion: (id, body) => auth.request(`/api/stories/${id}/version-restore`, jsonOptions('POST', body)),
  attachVersionRecording: (storyId, recordingId) => auth.request(`/api/stories/${storyId}/version-recordings/${recordingId}/attach`, jsonOptions('POST', {})),
  inspirationBrowse: (query = '', layout = 'list') => auth.request(`/api/inspiration/browse?query=${encodeURIComponent(query)}&layout=${encodeURIComponent(layout)}`),
  inspirationNext: (body) => auth.request('/api/inspiration/next', jsonOptions('POST', body)),
  inspirationFavorite: (id, enabled) => auth.request(`/api/inspiration/favorites/${id}`, { method: enabled ? 'POST' : 'DELETE', ...(enabled ? { body: '{}' } : {}) }),
  inspirationPin: (id, position) => auth.request(`/api/inspiration/pins/${id}`, position == null ? { method: 'DELETE' } : jsonOptions('POST', { position })),
  inspirationPins: (promptIds) => auth.request('/api/inspiration/pins', jsonOptions('PUT', { promptIds })),
  inspirationLayout: (layout) => auth.request('/api/preferences/inspiration-layout', jsonOptions('PATCH', { layout })),
  inspirationSave: (body) => auth.request('/api/inspiration/save-later', jsonOptions('POST', body)),
  requests: () => auth.request('/api/requests'),
  contributions: () => auth.request('/api/requests/contributions'),
  contributionPlayback: (id) => auth.request(`/api/requests/contributions/${id}/audio`),
  contributionState: (id, state) => auth.request(`/api/requests/contributions/${id}/state`, jsonOptions('POST', { state })),
  promoteContribution: (id, title) => auth.request(`/api/requests/contributions/${id}/promote`, jsonOptions('POST', { title })),
  createRequest: (body) => auth.request('/api/requests', jsonOptions('POST', body)),
  updateRequest: (id, body) => auth.request(`/api/requests/${id}/update`, jsonOptions('POST', body)),
  previewRequest: (id, expectedVersion) => auth.request(`/api/requests/${id}/preview`, jsonOptions('POST', { expectedVersion })),
  sendRequest: (id, expectedVersion) => auth.request(`/api/requests/${id}/send`, jsonOptions('POST', { expectedVersion })),
  remindRequest: (id, expectedVersion) => auth.request(`/api/requests/${id}/remind`, jsonOptions('POST', { expectedVersion })),
  reinviteRequest: (id, expectedVersion, email) => auth.request(`/api/requests/${id}/reinvite`, jsonOptions('POST', { expectedVersion, email })),
  revokeRequest: (id) => auth.request(`/api/requests/${id}/revoke`, jsonOptions('POST', {})),
  activityHeartbeat: (body) => auth.request('/api/activity/heartbeat', jsonOptions('POST', body)),
  preference: (background) => auth.request('/api/preferences/background', jsonOptions('PATCH', { background })),
  textSizePreference: (textSize) => auth.request('/api/preferences/text-size', jsonOptions('PATCH', { textSize })),
  themePreference: (theme) => auth.request('/api/preferences/theme', jsonOptions('PATCH', { theme })),
  questions: (studentId = '') => auth.request(`/api/questions${studentId ? `?studentId=${encodeURIComponent(studentId)}` : ''}`),
  createQuestion: (body) => auth.request('/api/questions', jsonOptions('POST', body)),
  approveQuestion: (id, surface = 'library') => auth.request(`/api/questions/${id}/approve`, jsonOptions('POST', { surface })),
  storyDraft: () => auth.request('/api/drafts/story-builder'),
  saveStoryDraft: (payload, expectedVersion = null) => auth.request('/api/drafts/story-builder', jsonOptions('PATCH', { payload, expectedVersion })),
  useSuggestion: (id, useKey, active) => auth.request(`/api/stories/${id}/use-suggestions`, jsonOptions('POST', {
    useKey,
    active,
    surface: 'workspace',
  })),
  intelligence: (studentId = '') => auth.request(`/api/interview-intelligence${studentId ? `?studentId=${encodeURIComponent(studentId)}` : ''}`),
  workshop: (questionId, studentId = '') => auth.request(`/api/questions/${questionId}/workshop${studentId ? `?studentId=${encodeURIComponent(studentId)}` : ''}`),
  createPair: (body) => auth.request('/api/story-question-pairs', jsonOptions('POST', body)),
  updatePair: (id, body) => auth.request(`/api/story-question-pairs/${id}`, jsonOptions('PATCH', body)),
  confirmPair: (id) => auth.request(`/api/story-question-pairs/${id}/confirm`, jsonOptions('POST', {})),
  rejectPair: (id) => auth.request(`/api/story-question-pairs/${id}/reject`, jsonOptions('POST', {})),
  removePair: (id) => auth.request(`/api/story-question-pairs/${id}/remove`, jsonOptions('POST', { surface: 'assign' })),
  preferenceForQuestion: (questionId, body) => auth.request('/api/question-preferences', jsonOptions('POST', { ...body, questionId })),
  coaching: (body) => auth.request('/api/question-coaching-notes', jsonOptions('POST', body)),
  addFollowup: (pairId, body) => auth.request('/api/pair-followups', jsonOptions('POST', { ...body, pairId })),
  updateFollowup: (id, body) => auth.request(`/api/pair-followups/${id}`, jsonOptions('PATCH', body)),
  removeFollowup: (id) => auth.request(`/api/pair-followups/${id}/remove`, jsonOptions('POST', { surface: 'workshop' })),
  students: () => auth.request('/api/students'),
  mentorHome: () => auth.request('/api/mentor/home'),
  mentorStudent: (id) => auth.request(`/api/students/${id}`),
  queue: () => auth.request('/api/queue'),
  activity: (query = '') => auth.request(`/api/mentor/activity${query ? `?${query}` : ''}`),
  createSession: (studentId) => auth.request('/api/coaching-sessions', jsonOptions('POST', { studentId })),
  coverSessionItem: (_sessionId, itemId, covered) => auth.request(`/api/coaching-session-items/${itemId}`, jsonOptions('PATCH', { completed: covered })),
  endSession: (id) => auth.request(`/api/coaching-sessions/${id}/end`, jsonOptions('POST', {})),
  teachingStories: (studentId = '') => auth.request(`/api/teaching/stories${studentId ? `?studentId=${encodeURIComponent(studentId)}` : ''}`),
  craft: (id, body) => auth.request(`/api/stories/${id}/craft`, jsonOptions('PATCH', { ...body, surface: 'teach' })),
  importPreview: (body) => auth.request('/api/imports/preview', jsonOptions('POST', body)),
  imports: () => auth.request('/api/imports'),
  importCommit: (body) => auth.request('/api/imports/commit', jsonOptions('POST', body)),
  importRollback: (id) => auth.request(`/api/imports/${id}/rollback`, jsonOptions('POST', {})),
  aiSuggest: (body) => auth.request('/api/ai/suggest', jsonOptions('POST', body)),
  createRecording: () => auth.request('/api/recordings', jsonOptions('POST', {})),
  recording: (id) => auth.request(`/api/recordings/${id}`),
  uploadRecordingSegment: (id, body) => auth.request(`/api/recordings/${id}/segments`, {
    method: 'POST',
    body,
  }),
  finishRecording: (id, clientDurationMs) => auth.request(`/api/recordings/${id}/finish`, jsonOptions('POST', { clientDurationMs })),
  cancelRecording: (id) => auth.request(`/api/recordings/${id}/cancel`, jsonOptions('POST', {})),
  retryRecordingTranscription: (id) => auth.request(`/api/recordings/${id}/retry-transcription`, jsonOptions('POST', {})),
  audioPlayback: (id) => auth.request(`/api/audio/${id}/playback`),
  deleteAudio: (id) => auth.request(`/api/audio/${id}`, { method: 'DELETE' }),
  adminFeatures: () => auth.request('/api/admin/features'),
  updateVoiceFeature: (body) => auth.request(
    '/api/admin/features/voice_capture',
    jsonOptions('POST', body),
  ),
  adminVoiceHealth: () => auth.request('/api/admin/voice/health'),
  adminConsoleFlag: () => auth.request('/api/admin/features/admin_console'),
  updateAdminConsoleFlag: (body) => auth.request(
    '/api/admin/features/admin_console',
    jsonOptions('POST', body),
  ),
  adminHome: () => auth.request('/api/admin/console/home'),
  adminStudents: (query = '') => auth.request(`/api/admin/console/students${query ? `?${query}` : ''}`),
  adminStudent: (id, query = '') => auth.request(`/api/admin/console/students/${id}${query ? `?${query}` : ''}`),
  adminQueue: (query = '') => auth.request(`/api/admin/console/queue${query ? `?${query}` : ''}`),
  adminDirectory: (query = '') => auth.request(`/api/admin/console/directory${query ? `?${query}` : ''}`),
  adminDirectoryStudent: (id) => auth.request(`/api/admin/console/directory/${id}`),
  adminSavedViews: () => auth.request('/api/admin/console/saved-views'),
  adminSaveView: (body) => auth.request('/api/admin/console/saved-views', jsonOptions('POST', body)),
  adminDeleteView: (id) => auth.request(`/api/admin/console/saved-views/${id}`, { method: 'DELETE' }),
  adminReviewCheck: (body) => auth.request('/api/admin/console/review-check', jsonOptions('POST', body)),
  adminInspiration: (query = '') => auth.request(`/api/admin/console/inspiration${query ? `?${query}` : ''}`),
  adminInspirationValidate: (body) => auth.request('/api/admin/console/inspiration/validate', jsonOptions('POST', body)),
  adminInspirationPublish: (body) => auth.request('/api/admin/console/inspiration/publish', jsonOptions('POST', body)),
  adminInspirationHistory: (id) => auth.request(`/api/admin/console/inspiration/${id}/history`),
  adminInspirationBulkParse: (csv) => auth.request('/api/admin/console/inspiration/bulk/parse', jsonOptions('POST', { csv })),
  adminInspirationBulkCommit: (prompts) => auth.request('/api/admin/console/inspiration/bulk/commit', jsonOptions('POST', { prompts })),
  adminStory: (id) => auth.request(`/api/admin/console/stories/${id}`),
  adminReview: (id, body) => auth.request(`/api/admin/console/stories/${id}/review`, jsonOptions('POST', body)),
  adminTaxonomy: (id, body) => auth.request(`/api/admin/console/stories/${id}/taxonomy`, jsonOptions('PATCH', body)),
  mentorNotes: (id) => auth.request(`/api/stories/${id}/mentor-notes`),
  createMentorNote: (id, body) => auth.request(`/api/stories/${id}/mentor-notes`, jsonOptions('POST', body)),
  updateMentorNote: (id, body) => auth.request(`/api/mentor-notes/${id}`, jsonOptions('PATCH', body)),
  publishMentorNote: (id, body) => auth.request(`/api/mentor-notes/${id}/publish`, jsonOptions('POST', body)),
  discardMentorNote: (id, body) => auth.request(`/api/mentor-notes/${id}/discard`, jsonOptions('POST', body)),
  uploadMentorNoteAudio: (id, body) => auth.request(`/api/mentor-notes/${id}/audio`, { method: 'POST', body }),
  mentorNotePlayback: (id) => auth.request(`/api/mentor-notes/${id}/playback`),
});

function isMentor() {
  return roleName() === 'mentor';
}

function isAdmin() {
  return roleName() === 'admin';
}

function isStudent() {
  return roleName() === 'student';
}

function canAdminReview() {
  return isAdmin() && state.capabilities?.adminConsole === true;
}

function canGovernQuestions() {
  return isMentor() || isAdmin();
}

function roleName() {
  return state.activeRole || state.user?.role || 'student';
}

function viewLabel() {
  if (isAdmin()) return canAdminReview() ? 'Administrator View' : 'Question Governance';
  return isMentor() ? 'Mentor View' : 'Student View';
}

function canSwitchAdministratorView() {
  return state.user?.role === 'student' && state.capabilities?.adminConsole === true;
}

function roleSwitchMarkup() {
  if (!canSwitchAdministratorView()) {
    return `<div class="roleSwitch roleReadOnly">
      <div class="rsLbl">Viewing as</div>
      <span class="on">• ${viewLabel()}</span>
    </div>`;
  }
  return `<div class="roleSwitch" aria-label="StoryForge view">
    <div class="rsLbl">Viewing as</div>
    <button type="button" class="${isStudent() ? 'on' : ''}" data-switch-view="student" aria-pressed="${isStudent()}">Student View</button>
    <button type="button" class="${isAdmin() ? 'on' : ''}" data-switch-view="admin" aria-pressed="${isAdmin()}">Administrator View</button>
  </div>`;
}

function firstName(user = state.user) {
  const storedFirstName = typeof user?.first_name === 'string' ? user.first_name : '';
  if (storedFirstName.trim()) return storedFirstName;
  const displayName = typeof user?.display_name === 'string' ? user.display_name.trim() : '';
  if (displayName) return displayName.split(/\s+/u)[0];
  if (typeof user?.username === 'string' && user.username.trim()) return user.username.trim();
  return 'there';
}

function matrixHref() {
  return state.config?.matrixBaseUrl
    || new URL('/member-dashboard/', window.location.origin).toString();
}

function activeBackground() {
  const preferred = state.settingsPreview.previewBackground || state.user?.background_preference;
  return BACKGROUNDS.some(({ id }) => id === preferred) ? preferred : 'ember';
}

function savedBackground() {
  const preferred = state.user?.background_preference;
  return BACKGROUNDS.some(({ id }) => id === preferred) ? preferred : 'ember';
}

function savedTextSize() {
  const value = state.user?.reading_size_preference;
  return ['standard', 'large', 'extra_large'].includes(value) ? value : 'standard';
}

function activeTextSize() {
  return state.settingsPreview.previewTextSize || savedTextSize();
}

function savedTheme() {
  const value = state.user?.theme_preference;
  return ['dark', 'light', 'auto'].includes(value) ? value : 'dark';
}

function applyTheme() {
  const preference = savedTheme();
  const resolved = preference === 'auto'
    ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : preference;
  document.body.dataset.themePref = preference;
  document.body.dataset.theme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content',
    resolved === 'light' ? '#f4efe6' : '#0a0d14',
  );
}

function applyEnvironment() {
  document.body.dataset.role = isMentor() || isAdmin() ? 'advisor' : 'student';
  document.body.dataset.background = activeBackground();
  document.body.dataset.textSize = activeTextSize();
  applyTheme();
  document.body.classList.toggle('is-booting', !state.user);
}

function v2FeatureOn(key) {
  return state.v2.session?.features?.[key] === true;
}

function storyVisibility(story) {
  return story?.visibility === 'mentor_visible' ? 'mentor_visible' : 'private';
}

function setMotionEnergy(energy = 'low') {
  const allowed = new Set(['low', 'active', 'recording', 'success']);
  document.body.dataset.motionEnergy = allowed.has(energy) ? energy : 'low';
}

function notify(message, kind = '') {
  toastNode.textContent = message;
  toastNode.dataset.kind = kind;
  toastNode.classList.add('show');
  window.clearTimeout(notify.timer);
  notify.timer = window.setTimeout(() => toastNode.classList.remove('show'), 3600);
}

async function withBusy(task, message = '') {
  if (state.busy) return null;
  state.busy = true;
  document.body.classList.add('mutating');
  try {
    const value = await task();
    if (message) notify(message);
    return value;
  } finally {
    state.busy = false;
    document.body.classList.remove('mutating');
  }
}

function statusChip(story) {
  const meta = STATUS[story.status] || STATUS.private;
  return `<span class="stChip ${meta.col}" title="${attr(meta.hint)}">${esc(meta.label)}${story.revised && story.status === 'awaiting' ? ' · revised' : ''}</span>`;
}

function studentReviewAction(story) {
  if (!state.capabilities?.submissionReview && !story.mentorReviewAvailable) {
    return `<button class="noteSend" type="button" disabled>Mentor review unavailable</button>
      <div class="stageHint">Mentor review is not enabled yet. Your private story remains editable.</div>`;
  }
  return `<button class="noteSend" type="button" data-submit-story>${story.status === 'changes' ? 'Resubmit for review' : 'Submit for review'}</button>
    <div class="stageHint">Submitting makes this story available to an authorized reviewer. It stays private until you choose Submit for review.</div>`;
}

function scoreDots(value, owner = 'student', label = 'Score') {
  const score = Number(value) || 0;
  return `<span class="embers ${owner === 'mentor' ? 'mentor' : ''}" role="meter" aria-label="${attr(`${label}: ${score ? `${score} of 5` : 'not scored'}`)}"
    aria-valuemin="0" aria-valuemax="5" aria-valuenow="${score}">
    ${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= score ? 'on' : ''}"></i>`).join('')}
  </span>`;
}

function scorePicker(scope, value, mentor = false) {
  const score = Number(value) || 0;
  return `<div class="scorePick ${mentor ? 'cy' : ''}" data-score-scope="${scope}" role="group" aria-label="${mentor ? 'Mentor' : 'Student'} score">
    ${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-score="${n}" class="${n <= score ? 'on' : ''}" aria-pressed="${n === score}">${n}</button>`).join('')}
    <span class="spv">${mentor ? 'mentor' : 'self'} ${score ? `${score}/5` : '—'}</span>
  </div>`;
}

function birdMini(story) {
  const birds = story.birds.map((id) => BIRDS.find((item) => item.id === id)).filter(Boolean);
  return birds.length
    ? `<span class="birdMini">${birds.map((item) => `<span title="${attr(item.label)}">${item.emo}</span>`).join('')}</span>`
    : '';
}

function developmentState(story) {
  const told = story.text.trim().split(/\s+/).filter(Boolean).length >= 40;
  if (told && story.lesson) return 'Complete';
  if (told || story.lesson) return 'In progress';
  return 'Draft';
}

function storyCompletionMissing(story, intent = 'finish', values = {}) {
  const text = String(firstDefined(values.text, story?.text, '')).trim();
  const lesson = String(firstDefined(values.lesson, story?.lesson, '')).trim();
  if (intent === 'submit') {
    const section = (key) => typeof presentationSection === 'function'
      ? presentationSection(key)
      : { mode: 'visible_optional' };
    const missing = text.length >= 3 ? [] : [{
      id: 'text',
      message: 'Add at least a few words to the Working version before submitting for review.',
    }];
    if (section('learningLesson').mode === 'visible_required' && !lesson) missing.push({
      id: 'lesson',
      message: 'Add the required Learning Lesson before submitting for review.',
    });
    if (section('storyCategories').mode === 'visible_required' && !(Array.isArray(story?.categories) ? story.categories : []).length) missing.push({
      id: 'categories',
      message: 'Choose at least one required story category before submitting for review.',
    });
    if (section('intendedUses').mode === 'visible_required' && !(Array.isArray(story?.uses) ? story.uses : []).length) missing.push({
      id: 'uses',
      message: 'Choose at least one required intended use before submitting for review.',
    });
    return missing;
  }
  const missing = [];
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 40) missing.push({
    id: 'text',
    message: `Add enough of the story to preserve what happened (${wordCount} of 40 words).`,
  });
  if (!lesson) missing.push({
    id: 'lesson',
    message: 'Add the Learning Lesson: one or two honest sentences about what this story taught you.',
  });
  return missing;
}

function updateStoryCompletionGuidance(form, { focusFirst = false } = {}) {
  const intent = state.storyCompletionIntent;
  if (!form || !intent || !state.storyDetail) return;
  const missing = storyCompletionMissing(state.storyDetail, intent, {
    text: $('#storyEditText', form)?.value,
    lesson: $('#storyLesson', form)?.value,
  });
  if (intent === 'submit'
      && String(state.storyDetail.text || '').trim().length < 3
      && String($('#storyEditText', form)?.value || '').trim().length >= 3) {
    missing.push({
      id: 'text',
      message: 'Save the Working version before submitting so StoryForge reviews the durable story you intended.',
    });
  }
  const missingIds = new Set(missing.map((item) => item.id));
  for (const id of ['text', 'lesson']) {
    const field = form.querySelector(`[data-completion-field="${id}"]`);
    const input = id === 'text' ? $('#storyEditText', form) : $('#storyLesson', form);
    const helper = form.querySelector(`[data-completion-help="${id}"]`);
    const item = missing.find((entry) => entry.id === id);
    field?.classList.toggle('b1512Incomplete', missingIds.has(id));
    if (input) {
      if (missingIds.has(id)) {
        if (intent === 'submit') input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
        input.setAttribute('aria-describedby', `completion-help-${id}`);
      } else {
        input.removeAttribute('aria-invalid');
        input.removeAttribute('aria-describedby');
      }
    }
    if (helper) {
      helper.hidden = !missingIds.has(id);
      helper.textContent = item?.message || '';
    }
  }
  const summary = $('[data-completion-summary]', room);
  if (summary) {
    summary.dataset.complete = String(missing.length === 0);
    summary.querySelector('[data-completion-count]').textContent = missing.length
      ? `${missing.length} ${missing.length === 1 ? 'item needs' : 'items need'} your attention.`
      : 'Everything required here is complete.';
  }
  if (focusFirst && missing.length) {
    const first = missing[0].id === 'text' ? $('#storyEditText', form) : $('#storyLesson', form);
    window.requestAnimationFrame(() => {
      first?.focus({ preventScroll: true });
      first?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
    });
  }
}

function storyTitle(story) {
  return `${story.prefixEnabled ? 'The One Where ' : ''}${story.title}`;
}

function excerpt(story, length = 150) {
  const value = story.text.trim();
  return value.length > length ? `${value.slice(0, length).trim()}…` : value;
}

function formatDuration(milliseconds) {
  const seconds = Math.max(0, Math.round(Number(milliseconds || 0) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function storyHasUnreadMentorActivity(story) {
  if (isMentor()) return false;
  if (story.unreadMentorActivity) return true;
  return state.notifications.some((notification) => (
    !notificationRead(notification)
    && notificationStoryId(notification) === story.id
  ));
}

function priorityPicker(story) {
  const value = Number(story.studentScore) || 0;
  return `<div class="b1511Priority" role="group" aria-label="Student priority for ${attr(story.title)}" data-priority-story="${attr(story.id)}">
    <span class="srOnly" data-priority-label>Student priority: ${value ? `${value} of 5` : 'unrated'}</span>
    ${[1, 2, 3, 4, 5].map((priority) => `<button type="button" data-library-priority="${priority}" data-story-id="${attr(story.id)}"
      class="${priority <= value ? 'on' : ''}" aria-pressed="${priority === value}" aria-label="Set student priority to ${priority} of 5">${priority}</button>`).join('')}
  </div>`;
}

function storyRow(story, options = {}) {
  const quickLabel = isMentor() ? 'Quick review' : 'Quick look';
  const unread = storyHasUnreadMentorActivity(story);
  const audio = story.captureType === 'audio' || story.audioAssetId;
  const duration = story.audioDurationMs ? formatDuration(story.audioDurationMs) : '';
  return `<article class="sRow" data-story-row="${attr(story.id)}">
    <button class="starBtn ${isMentor() ? 'mentor' : ''} ${(isMentor() ? story.mentorStar : story.studentStar) ? 'on' : ''}" type="button"
      data-toggle-star="${attr(story.id)}" aria-label="${isMentor() ? 'Toggle mentor star' : 'Toggle story star'}" aria-pressed="${isMentor() ? story.mentorStar : story.studentStar}">★</button>
    <div class="rMain">
      <div class="rTitle">${story.prefixEnabled ? '<span class="pre">The One Where</span>' : ''}${esc(story.title)}
        ${unread ? '<span class="emberDot" title="New mentor feedback"></span>' : ''}
        ${audio ? `<span class="audChip" title="Original audio preserved${duration ? ` — ${duration}` : ''}">🎙${duration ? ` ${duration}` : ''}</span>` : ''}
      </div>
      <div class="rSub">
        ${excerpt(story) ? `<span class="exc">“${esc(excerpt(story))}”</span>` : '<span class="exc">No telling yet — add it when you have two minutes.</span>'}
        ${isMentor() ? '' : `<span>${esc(developmentState(story))}</span><span>·</span>`}
        ${options.showStudent ? `<span>·</span><span class="text-cy">${esc(story.studentName)}</span>` : ''}
        <span>updated ${esc(ago(story.updatedAt || story.createdAt))}</span>
      </div>
      <div class="rLessonLine">${story.lesson
        ? `<span class="lTag">Lesson</span><span class="lTxt" title="${attr(story.lesson)}">${esc(story.lesson)}</span>`
        : '<span class="lTag none">Lesson</span><span class="lTxt none">Not written yet</span>'}</div>
    </div>
    <div class="rMeta">
      ${birdMini(story)}
      ${story.questionCount ? `<span class="scoreTag" title="Interview questions this story answers">${story.questionCount} question${story.questionCount === 1 ? '' : 's'}</span>` : ''}
      ${options.inlinePriority && isStudent() && state.capabilities?.inlinePriority ? priorityPicker(story) : scoreDots(story.studentScore, 'student', 'Student score')}
      ${story.status === 'private' ? '' : scoreDots(story.mentorScore, 'mentor', 'Mentor score')}
      ${statusChip(story)}
      ${visibilityChip(story)}
      <button class="rowBtn" type="button" data-open-quick="${attr(story.id)}">${quickLabel}</button>
      <button class="rowBtn pri" type="button" data-open-story="${attr(story.id)}">${isMentor() ? 'Full review' : 'Open story'}</button>
    </div>
  </article>`;
}

function emptyState(title, detail, action = '') {
  return `<div class="emptyLib"><div class="big">${esc(title)}</div><div>${esc(detail)}</div>${action}</div>`;
}

function loadingView(label = 'Opening your story workspace…') {
  return `<section class="loadingState" role="status" aria-live="polite"><span class="emberDot"></span>${esc(label)}</section>`;
}

function routeTitle(route = state.route) {
  const names = {
    home: 'Home',
    library: 'Story Library',
    notifications: 'Notifications',
    settings: 'Settings',
    prep: 'Interview Prep',
    qshop: 'Question Workshop',
    qlib: 'Question Library',
    students: 'Students',
    student: 'Student Workspace',
    queue: 'Review Queue',
    content: 'Content Studio',
    activity: 'My Activity',
    student: isAdmin() ? 'Student Account' : 'Student Workspace',
    story: isAdmin() ? 'Story Review' : 'StoryForge',
  };
  return names[route] || 'StoryForge';
}

function railNavButton([route, label, icon]) {
  const active = state.route === route || (route === 'prep' && ['qshop', 'qlib'].includes(state.route));
  const unread = route === 'notifications'
    ? state.notifications.filter((item) => !firstDefined(item.read, item.read_at)).length
    : 0;
  const queueCount = route === 'queue'
    ? mentorState().queue.filter((item) => ['awaiting', 'revised'].includes(item.bucket)).length
    : 0;
  return `<button type="button" data-nav="${route}" class="rtab ${active ? 'on' : ''}" ${active ? 'aria-current="page"' : ''}>
    ${esc(label)}${unread || queueCount ? `<span class="badge">${unread || queueCount}</span>` : ''}
  </button>`;
}

function interviewPrepVisible() {
  return state.presentation?.navigation?.interviewPrepVisible === true;
}

function presentationSection(key) {
  return state.presentation?.sections?.[key] || BUNDLED_PRESENTATION.sections[key];
}

function presentationSectionVisible(key) {
  return presentationSection(key)?.mode !== 'hidden';
}

function presentationTaxonomy(key, { includeSelected = [] } = {}) {
  const configured = asArray(state.presentation?.taxonomy?.[key]);
  const fallback = BUNDLED_PRESENTATION.taxonomy[key] || [];
  const selected = new Set(asArray(includeSelected).map(String));
  return (configured.length ? configured : fallback)
    .filter((entry) => entry?.state === 'active' || selected.has(String(entry?.id)))
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
}

function presentationTaxonomyLabel(key, id) {
  return asArray(state.presentation?.taxonomy?.[key]).find((entry) => entry.id === id)?.label
    || BUNDLED_PRESENTATION.taxonomy[key]?.find((entry) => entry.id === id)?.label
    || id;
}

function renderShell() {
  if (!state.user) return;
  applyEnvironment();
  const nav = (canAdminReview() ? ADMIN_CONSOLE_NAV : NAV[roleName()])
    .filter(([route]) => (
      (route !== 'prep' || interviewPrepVisible() || isAdmin())
      && (route !== 'inspiration' || state.capabilities?.inspiration === true)
      && (route !== 'requests' || state.capabilities?.requestAStory === true)
      && (route !== 'content' || state.capabilities?.inspirationAdmin === true)
    ));
  rail.innerHTML = `
    <div class="logo" aria-label="StoryForge">Story<b>Forge</b></div><div class="logoSub">MissionMed</div>
    ${isStudent() ? '<button class="railCta" type="button" data-open-capture>＋ <span class="rct">New Story</span></button>' : ''}
    ${nav.map(railNavButton).join('')}
    ${isMentor() ? '<button type="button" class="rtab" data-open-teaching>Teaching Mode</button>' : ''}
    <div class="railFoot">
      <a class="rtab matrixAnchor" href="${attr(matrixHref())}">↩ Back to Matrix</a>
      ${roleSwitchMarkup()}
      <div class="signedIdentity">${esc(state.user.display_name)}${state.user.cohort ? ` · ${esc(state.user.cohort)}` : ''}</div>
      ${state.config?.devAuth ? '<button class="rowBtn fixtureChange" type="button" data-change-fixture>Change fixture identity</button>' : ''}
    </div>`;

  hdr.innerHTML = `
    <a class="storyforgeMatrixBack" href="${attr(matrixHref())}" aria-label="Back to Matrix">
      <span aria-hidden="true">←</span><span>Matrix</span>
    </a>
    <div class="storyforgeBrand" aria-label="MissionMed StoryForge">
      <div class="storyforgeBrandTitle"><span>MissionMed</span><b>//Storyforge</b></div>
      <div class="storyforgeBrandSub">MISSION:RESIDENCY DIVISION</div>
    </div>
    <div class="storyforgeHeaderActions">
      <span class="viewChip roleReadOnly" title="This view comes from your signed MissionMed role">${viewLabel()}</span>
      ${isMentor() && state.selectedStudent ? `<button class="stuSelBtn" type="button" data-open-palette>
        <span class="fLbl">Viewing</span><span class="stuAv">${esc(state.selectedStudent.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join(''))}</span>
        <span class="nm">${esc(state.selectedStudent.name)}</span>${state.selectedStudent.cohort ? `<span class="cohortChip">${esc(state.selectedStudent.cohort)}</span>` : ''}<span class="car">▾</span>
      </button>` : ''}
      ${isAdmin() && !canAdminReview() ? '' : `<div class="hSearch">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>
        <input id="omni" type="search" role="combobox" aria-autocomplete="list" placeholder="${isMentor() || canAdminReview() ? 'Search students and stories…' : 'Search your stories…'}" autocomplete="off" aria-label="${isMentor() || canAdminReview() ? 'Search students and stories' : 'Search your stories'}" aria-controls="omniSuggestions" aria-expanded="false">
        <span class="kbd">/</span>
        <div id="omniSuggestions" class="b1511Suggestions" role="listbox" aria-label="Search suggestions" hidden></div>
        <div id="omniSearchStatus" class="srOnly" role="status" aria-live="polite"></div>
      </div>`}
      ${isStudent() ? '<button class="btnCatch" type="button" data-open-capture>＋ <span class="bc-txt">New Story</span></button>' : ''}
    </div>`;

  advBanner.classList.toggle('show', isMentor());
  advBanner.querySelector('span').textContent = isMentor()
    ? 'Mentor View · Students’ private stories remain invisible until they submit them to you.'
    : '';
  document.body.classList.remove('is-booting');
}

function clearOverlays() {
  void cancelPurposefulVersionVoice();
  stopAudioPlayback();
  activeAudioAssemblyPrompt?.interrupt();
  if (captureSaveInFlight) captureSaveInterrupted = true;
  [room, capture, quick, qad, palette, sessionBar, teaching].forEach((node) => {
    node.classList.remove('open');
    node.innerHTML = '';
  });
  state.storyDetail = null;
  state.storyCompletionIntent = null;
  state.quick = null;
  state.assign = null;
  state.workshop = null;
}

function pushPath(route, id = null, replace = false) {
  const base = state.config?.basePath || '/';
  const suffix = route === 'home' ? '' : `${route}${id ? `/${encodeURIComponent(id)}` : ''}`;
  const target = `${base}${suffix}`;
  history[replace ? 'replaceState' : 'pushState'](null, '', target);
}

function parseRoute() {
  const fragment = location.hash.replace(/^#/, '');
  const legacy = fragment === 'main' ? '' : fragment;
  const base = state.config?.basePath || '/';
  const relative = legacy || (location.pathname.startsWith(base) ? location.pathname.slice(base.length) : '');
  const [route, id] = relative.replace(/^\/+|\/+$/g, '').split('/');
  state.route = route || 'home';
  state.routeId = id ? decodeURIComponent(id) : null;
}

async function navigate(route, id = null, options = {}) {
  clearOverlays();
  state.route = route;
  state.routeId = id;
  pushPath(route, id, options.replace);
  await renderRoute();
  const heading = $('h1, .h1', main);
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}

async function loadStories() {
  const payload = await api.stories();
  state.stories = asArray(payload?.stories).map(normalizeStory);
  return state.stories;
}

async function loadNotifications() {
  if (isMentor()) return [];
  const payload = await api.notifications();
  state.notifications = asArray(payload?.notifications);
  return state.notifications;
}

async function loadHomeRecommendations() {
  state.v2.homeRecommendations = [];
  if (!isStudent() || !v2FeatureOn('inspiration')) return [];
  try {
    const payload = await api.inspirationBrowse();
    const recommended = asArray(payload?.prompts).filter((prompt) => (
      prompt?.recommended === true
      && typeof prompt?.id === 'string'
      && typeof prompt?.text === 'string'
      && prompt.text.trim()
    ));
    const unanswered = recommended.filter((prompt) => !firstDefined(prompt.answeredStoryId, prompt.answered_story_id));
    state.v2.homeRecommendations = (unanswered.length ? unanswered : recommended).slice(0, 2);
  } catch {
    state.v2.homeRecommendations = [];
  }
  return state.v2.homeRecommendations;
}

async function loadInspiration() {
  if (!state.capabilities?.inspiration) return [];
  const payload = await api.inspirationBrowse(
    state.v2.inspiration.query,
    state.v2.inspiration.layout,
  );
  state.v2.inspiration.prompts = asArray(payload?.prompts);
  state.v2.inspiration.layout = payload?.layout === 'grid' ? 'grid' : 'list';
  return state.v2.inspiration.prompts;
}

async function loadRequests() {
  if (!state.capabilities?.requestAStory) return [];
  const [payload, contributionPayload] = await Promise.all([api.requests(), api.contributions()]);
  state.v2.invitations = asArray(payload?.invitations);
  state.v2.contributions = asArray(contributionPayload?.contributions);
  return state.v2.invitations;
}

async function playContributionAudio(contributionId, button) {
  const result = await api.contributionPlayback(contributionId);
  const [url] = playbackUrls(result || {});
  if (!url) throw new Error('The original guest recording is unavailable.');
  const host = button?.closest('.b1514Contribution')?.querySelector(
    `[data-contribution-audio-host="${CSS.escape(contributionId)}"]`,
  );
  if (!host) throw new Error('Guest recording controls are unavailable.');
  const audio = document.createElement('audio');
  audio.controls = true;
  audio.preload = 'metadata';
  audio.src = url;
  audio.setAttribute('aria-label', 'Original guest story recording');
  host.replaceChildren(audio);
  await audio.play();
}

function renderInspiration() {
  const context = state.v2.inspiration;
  main.innerHTML = `<section class="page b1514Inspiration" aria-labelledby="inspirationTitle">
    <div class="pageHead"><div><div class="eyebrow">Find the story hiding in plain sight</div><h1 class="h1" id="inspirationTitle">Inspiration</h1><p>Browse prompts, save what sparks something, or begin a story in your own words.</p></div></div>
    <form id="inspirationSearchForm" class="b1514Toolbar" role="search">
      <label class="srOnly" for="inspirationSearch">Search prompts</label><input id="inspirationSearch" type="search" value="${attr(context.query)}" placeholder="Search moments, people, or themes…">
      <button class="rowBtn pri" type="submit">Search</button>
      <button class="rowBtn ${context.layout === 'list' ? 'on' : ''}" type="button" data-inspiration-layout="list" aria-pressed="${context.layout === 'list'}">List</button>
      <button class="rowBtn ${context.layout === 'grid' ? 'on' : ''}" type="button" data-inspiration-layout="grid" aria-pressed="${context.layout === 'grid'}">Grid</button>
    </form>
    <div class="b1514PromptList ${context.layout === 'grid' ? 'grid' : ''}">${context.prompts.length ? context.prompts.map((prompt) => `<article class="b1514PromptCard">
      <div class="eyebrow">${esc(prompt.territory || 'Story prompt')}</div><h2>“${esc(prompt.text)}”</h2>${prompt.followUp ? `<p>${esc(prompt.followUp)}</p>` : ''}
      <div class="inlineActions"><button class="rowBtn pri" type="button" data-inspiration-answer="${attr(prompt.id)}">Answer this</button><button class="rowBtn" type="button" data-inspiration-favorite="${attr(prompt.id)}" data-enabled="${prompt.favorite ? '0' : '1'}" aria-pressed="${Boolean(prompt.favorite)}">${prompt.favorite ? '★ Favorited' : '☆ Favorite'}</button><button class="rowBtn" type="button" data-inspiration-pin="${attr(prompt.id)}" data-position="${prompt.pinPosition == null ? '0' : ''}">${prompt.pinPosition == null ? 'Pin' : 'Unpin'}</button></div>
    </article>`).join('') : '<div class="emptyState"><h2>No prompts found.</h2><p>Try a broader word or clear the search.</p></div>'}</div>
  </section>`;
}

const requestRelationships = Object.freeze([
  ['parent', 'Parent'], ['sibling', 'Brother / Sister'], ['spouse_partner', 'Spouse / Partner'],
  ['grandparent', 'Grandparent'], ['cousin', 'Cousin / Relative'], ['best_friend', 'Best Friend'],
  ['childhood_friend', 'Childhood Friend'], ['medschool_friend', 'Medical School Friend'],
  ['faculty', 'Professor / Faculty'], ['mentor', 'Mentor'],
  ['coworker', 'Coworker'], ['supervisor', 'Supervisor'], ['teammate', 'Teammate'],
]);

function requestRelationshipLabel(value) {
  return requestRelationships.find(([id]) => id === value)?.[1] || String(value || 'Someone they trust');
}

function requestStatusChip(invitation) {
  const map = {
    draft: ['Draft', 'draft', 'Nothing has been sent. You can still edit this request.'],
    sent: ['Sent', 'sent', 'Handed to the email service. Delivery has not yet been confirmed.'],
    delivered: ['Delivered ✓', 'delivered', 'The email service confirmed delivery.'],
    link_visited: ['Link visited', 'visited', 'They opened the private StoryForge link.'],
    started: ['Started telling', 'started', 'They entered the contribution experience.'],
    story_shared: ['Story shared ✓', 'shared', 'A private contribution arrived in your workspace.'],
    expired: ['Expired', 'terminal', 'The private link reached its expiry date and no longer works.'],
    revoked: ['Revoked', 'terminal', 'You cancelled this private link. It no longer works.'],
    bounced: ['Bounced — check address', 'bounced', 'The email could not be delivered. Re-invite using a different address.'],
  };
  const [label, tone, explanation] = map[invitation.status] || [invitation.status, 'draft', 'Current invitation state.'];
  return `<span class="b1514RaStatus ${tone}" title="${attr(explanation)}">${esc(label)}</span>`;
}

function requestLastEvent(invitation) {
  const events = [
    [invitation.contributedAt, 'story shared'], [invitation.startedAt, 'started telling'],
    [invitation.linkVisitedAt, 'visited their link'], [invitation.bouncedAt, 'bounced'],
    [invitation.deliveredAt, 'delivered'], [invitation.sentAt, 'sent'], [invitation.createdAt, 'draft created'],
  ].filter(([at]) => at).sort((a, b) => new Date(b[0]) - new Date(a[0]));
  return events.length ? `${events[0][1]} ${ago(events[0][0])}` : 'not sent yet';
}

function requestJourney(invitation) {
  const steps = [['sent', 'Sent'], ['delivered', 'Delivered'], ['link_visited', 'Link visited'], ['started', 'Started'], ['story_shared', 'Story shared']];
  const order = steps.findIndex(([status]) => status === invitation.status);
  const terminal = ['expired', 'revoked', 'bounced'].includes(invitation.status);
  return `<ol class="b1514RaJourney" aria-label="Invitation progress">${steps.map(([status, label], index) => `<li class="${!terminal && index < order ? 'done' : ''} ${status === invitation.status ? 'current' : ''}"><span aria-hidden="true">${!terminal && index < order ? '✓' : index + 1}</span>${esc(label)}</li>`).join('')}</ol>`;
}

function requestProcessStrip() {
  const steps = [
    ['1', 'Choose someone', 'A parent, mentor, or old friend — anyone who remembers stories you cannot.'],
    ['2', 'Personalize', 'Write a note and preview the exact email before anything sends.'],
    ['3', 'They share', 'One private link. No account and no access to your workspace.'],
    ['4', 'You receive', 'Their story arrives privately for you to keep, shape, or promote.'],
  ];
  return `<div class="b1514RaProcess" role="list" aria-label="How Request a Story works">${steps.map(([number, title, body]) => `<div role="listitem"><span>${number}</span><b>${esc(title)}</b><small>${esc(body)}</small></div>`).join('')}</div>`;
}

function renderRequestEditor() {
  const ui = state.v2.requestUi;
  const draft = ui.draft || {};
  const title = ui.reinviteFrom ? 'Re-invite with a new address' : ui.editingId ? 'Edit this private request' : 'Who knows a story of you?';
  main.innerHTML = `<section class="page b1514Requests" aria-labelledby="requestsTitle">
    <button class="backBtn" type="button" data-request-home>‹ Request a Story</button>
    <div class="eyebrow">Step 1 of 2 · Choose and personalize</div><h1 class="h1" id="requestsTitle">${esc(title)}</h1>
    ${ui.reinviteFrom ? '<p class="b1514RaNotice">The bounced link stays dead. This creates a fresh invitation with a fresh private link.</p>' : ''}
    <form id="requestStoryForm" class="railCard b1514RequestForm">
      <label for="requestFirstName">Their first name</label><input id="requestFirstName" maxlength="100" value="${attr(draft.recipientFirstName || '')}" required>
      <label for="requestRelationship">They are your…</label><select id="requestRelationship" required><option value="">Choose one</option>${requestRelationships.map(([id, label]) => `<option value="${attr(id)}" ${draft.relationship === id ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select>
      <label for="requestEmail">Their email</label><input id="requestEmail" type="email" autocomplete="off" value="${attr(draft.email || '')}" placeholder="${ui.editingId ? 'Re-enter the private delivery address' : 'name@example.com'}" required>
      <label for="requestMessage">A personal note <span>optional</span></label><textarea id="requestMessage" maxlength="2000" placeholder="Anything you remember counts.">${esc(draft.personalMessage || '')}</textarea>
      <div class="inlineActions"><button class="btnSave" type="submit">Continue — preview before sending ▸</button><button class="rowBtn" type="button" data-request-home>Cancel</button></div>
      <p class="b1514RaTruth">Nothing sends yet. Next you will review the exact email and choose whether to send it.</p>
    </form>
  </section>`;
}

function renderRequestPreview() {
  const ui = state.v2.requestUi;
  const invitation = ui.preview?.invitation;
  const preview = ui.preview?.preview;
  if (!invitation || !preview) { ui.view = 'home'; return renderRequests(); }
  main.innerHTML = `<section class="page b1514Requests" aria-labelledby="requestsTitle">
    <button class="backBtn" type="button" data-request-edit="${attr(invitation.id)}">‹ Edit the request</button>
    <div class="eyebrow">Step 2 of 2 · Preview, then send</div><h1 class="h1" id="requestsTitle">Exactly what <em>${esc(invitation.recipientFirstName)}</em> will receive.</h1>
    <div class="b1514RaPreviewGrid"><article class="railCard b1514RaEmail" aria-label="Full email preview">
      <dl><div><dt>To</dt><dd>${esc(invitation.recipientFirstName)} · ${esc(preview.to || invitation.maskedEmail)}</dd></div><div><dt>From</dt><dd>${esc(preview.from || 'Verification required before live sending')}</dd></div>${preview.replyTo ? `<div><dt>Reply-To</dt><dd>${esc(preview.replyTo)}</dd></div>` : ''}<div><dt>Subject</dt><dd><strong>${esc(preview.subject)}</strong></dd></div></dl>
      <div class="b1514RaEmailPaper"><pre>${esc(preview.textBody)}</pre></div>
      <p class="b1514RaTruth">Sender identity must be verified against the live transactional email service before live sending. Preview receipt ${esc(preview.auditEventId)}.</p>
    </article><aside class="railCard b1514RaBefore"><h2>Before it <em>goes</em></h2>
      <div><b>Their questions</b><span>Shaped for a ${esc(requestRelationshipLabel(invitation.relationship).toLowerCase())}.</span></div>
      <div><b>Your note</b><span>${invitation.personalMessage ? `“${esc(invitation.personalMessage)}”` : 'No personal note.'}</span></div>
      <div><b>What they are told</b><span>Their words return to your private StoryForge workspace. The link expires and can be revoked.</span></div>
      <div class="inlineActions"><button class="btnSave" type="button" data-request-confirm-send="${attr(invitation.id)}" data-version="${attr(invitation.rowVersion)}">CONFIRM &amp; SEND ➤</button><button class="rowBtn" type="button" data-request-home>Keep as draft</button></div>
      <p class="b1514RaTruth">Sent means accepted by the email service. Delivered appears only after signed delivery confirmation.</p>
    </aside></div>
  </section>`;
}

function renderRequests() {
  const ui = state.v2.requestUi;
  if (ui.view === 'edit') return renderRequestEditor();
  if (ui.view === 'preview') return renderRequestPreview();
  const contributions = state.v2.contributions;
  const contributionCount = (invitationId) => contributions.filter((item) => item.invitation_id === invitationId).length;
  main.innerHTML = `<section class="page b1514Requests" aria-labelledby="requestsTitle">
    <div class="pageHead b1514RaHero"><div><div class="eyebrow">Request a Story</div><h1 class="h1" id="requestsTitle">The people who know you <em>remember stories you can’t.</em></h1><p>Invite someone who knows you well to share a memory in their own words. Whatever they send arrives privately, only to you.</p></div><button class="btnSave" type="button" data-request-new>＋ Ask someone</button></div>
    ${requestProcessStrip()}
    <div class="b1514RaColumns"><section class="b1514InvitationList" aria-label="Returned stories"><h2 class="h2">Story <em>candidates</em></h2>${contributions.length ? contributions.filter((item) => item.state !== 'archived').map((item) => `<article class="b1514Contribution"><div class="eyebrow">From ${esc(item.contributor_first_name)} · ${esc(requestRelationshipLabel(item.relationship_id))}</div><small>They answered: “${esc(item.prompt_text_snapshot)}”</small><p>“${esc(item.transcript)}”</p>${item.kind === 'voice' ? `<div class="b1514ContributionAudio"><button class="rowBtn" type="button" data-contribution-audio="${attr(item.id)}">▶ Hear their original voice</button><div data-contribution-audio-host="${attr(item.id)}"></div></div>` : ''}<div class="inlineActions">${item.state !== 'promoted' ? `<button class="rowBtn pri" type="button" data-contribution-promote="${attr(item.id)}">Bring into StoryForge</button><button class="rowBtn" type="button" data-contribution-state="${attr(item.id)}" data-state="${item.state === 'favorite' ? 'new' : 'favorite'}">${item.state === 'favorite' ? '★ Favorited' : '☆ Favorite'}</button><button class="rowBtn" type="button" data-contribution-state="${attr(item.id)}" data-state="archived">Dismiss</button>` : '<span class="cohortChip">Private StoryForge story created</span>'}</div></article>`).join('') : '<div class="emptyState"><p>When someone answers, their private story candidate lands here.</p></div>'}</section>
    <section class="b1514InvitationList" aria-label="Your invitations"><div class="b1514RaSectionHead"><h2 class="h2">Your <em>invitations</em></h2><button class="rowBtn pri" type="button" data-request-new>＋ Ask someone</button></div>${state.v2.invitations.length ? state.v2.invitations.map((item) => `<article class="b1514Invitation">
      <div class="b1514RaInviteMain"><strong>${esc(item.recipientFirstName)} <span>· ${esc(requestRelationshipLabel(item.relationship))}</span></strong><small>${esc(item.maskedEmail)} · ${esc(requestLastEvent(item))}${contributionCount(item.id) ? ` · ${contributionCount(item.id)} ${contributionCount(item.id) === 1 ? 'story' : 'stories'} shared` : ''} · expires ${esc(formatDate(item.expiresAt))}</small>${item.status === 'bounced' && item.bounceReason ? `<small class="b1514RaBounce">${esc(item.bounceReason)}</small>` : ''}${requestJourney(item)}</div>
      <div class="b1514RaInviteActions">${requestStatusChip(item)}<div class="inlineActions">${item.status === 'draft' ? `<button class="rowBtn" type="button" data-request-edit="${attr(item.id)}">Edit</button><button class="rowBtn pri" type="button" data-request-preview="${attr(item.id)}" data-version="${attr(item.rowVersion)}">Preview &amp; send</button>` : ''}${['sent', 'delivered', 'link_visited', 'started'].includes(item.status) && Number(item.remindersSent || 0) < 2 ? `<button class="rowBtn" type="button" data-request-remind="${attr(item.id)}" data-version="${attr(item.rowVersion)}">Gentle reminder (${Number(item.remindersSent || 0)}/2)</button>` : ''}${item.status === 'bounced' ? `<button class="rowBtn" type="button" data-request-reinvite="${attr(item.id)}" data-version="${attr(item.rowVersion)}">Re-invite with a new address</button>` : ''}${!['expired', 'revoked', 'bounced'].includes(item.status) ? `<button class="rowBtn danger" type="button" data-request-revoke="${attr(item.id)}">Revoke</button>` : ''}</div></div>
    </article>`).join('') : '<div class="emptyState"><p>No invitations yet. Ask a parent, mentor, or old friend — the people who remember your stories differently.</p></div>'}</section></div>
  </section>`;
}

async function loadQuestions() {
  const studentId = isMentor()
    ? firstDefined(
      state.selectedStudent?.id,
      state.route === 'student' ? state.routeId : '',
      '',
    )
    : '';
  const payload = await api.questions(studentId);
  state.questions = asArray(payload?.questions).map(normalizeQuestion);
  return state.questions;
}

async function loadImportBatches() {
  if (!canGovernQuestions()) {
    state.importBatches = [];
    return [];
  }
  const payload = await api.imports();
  state.importBatches = asArray(payload?.batches);
  return state.importBatches;
}

async function loadStudents() {
  const payload = await api.students();
  state.students = asArray(payload?.students).map(normalizeStudent);
  return state.students;
}

async function refreshShellData() {
  const jobs = [loadStories()];
  if (isMentor()) jobs.push(loadStudents().catch(() => []));
  else jobs.push(loadNotifications().catch(() => []));
  await Promise.all(jobs);
  renderShell();
}

/* ========================= Student surfaces ========================= */

function notificationText(notification) {
  return String(firstDefined(
    notification.text,
    notification.message,
    notification.body,
    notification.event_text,
    'Your mentor updated one of your stories.',
  ));
}

function notificationStoryId(notification) {
  return String(firstDefined(notification.storyId, notification.story_id, ''));
}

function notificationTime(notification) {
  return firstDefined(notification.lastEventAt, notification.last_event_at, notification.createdAt, notification.created_at);
}

function notificationRead(notification) {
  return Boolean(firstDefined(notification.read, notification.read_at, false));
}

function homeRecommendationsMarkup() {
  const recommendations = asArray(state.v2.homeRecommendations);
  if (!v2FeatureOn('inspiration') || !recommendations.length) return '';
  return `<section class="b1513r3Recommends" aria-labelledby="b1513r3RecTitle">
    <div class="b1513r3RecHeader"><div class="b1513r3RecIdentity"><span class="b1513r3RecSeal" aria-hidden="true">✦</span><div class="b1513r3RecTitle" id="b1513r3RecTitle">Dr Brian <em>Recommends</em><span class="b1513r3RecSub">Questions chosen to help this cohort uncover stories worth remembering.</span></div></div></div>
    <div class="b1513r3RecList">${recommendations.map((prompt) => `<button class="b1513r3Rec" type="button" data-recommend-prompt="${attr(prompt.text)}"><span class="b1513r3RecQuestion">“${esc(prompt.text)}”</span><span class="b1513r3RecAction">Answer →</span></button>`).join('')}</div>
  </section>`;
}

function homeStatusHudMarkup() {
  const stories = asArray(state.stories);
  const total = stories.length;
  const visibilityEnabled = v2FeatureOn('visibility');
  const privateCount = visibilityEnabled ? stories.filter((story) => storyVisibility(story) === 'private').length : 0;
  const mentorVisible = visibilityEnabled ? stories.filter((story) => storyVisibility(story) === 'mentor_visible').length : 0;
  const complete = stories.filter((story) => developmentState(story) === 'Complete').length;
  const statusCounts = Object.fromEntries(Object.keys(STATUS).map((key) => [key, 0]));
  stories.forEach((story) => { statusCounts[story.status] = (statusCounts[story.status] || 0) + 1; });
  const percent = total ? Math.round((complete / total) * 100) : 0;
  const changes = statusCounts.changes || 0;
  const awaiting = (statusCounts.awaiting || 0) + (statusCounts.in_review || 0);
  const actionText = changes
    ? `<strong>${changes} ${changes === 1 ? 'story needs' : 'stories need'} your response.</strong> Open the filtered Library to continue.`
    : awaiting
      ? `<strong>${awaiting} ${awaiting === 1 ? 'story is' : 'stories are'} with your mentor.</strong> You can keep developing your other stories while review continues.`
      : '<strong>Your forge is ready.</strong> Capture a new moment or keep shaping an unfinished story.';
  const actionStatus = changes ? 'changes' : awaiting ? 'awaiting' : '';
  return `<section class="b1513r3Hud" aria-labelledby="b1513r3HudTitle">
    <div class="b1513r3HudHead"><div><div class="eyebrow">Your StoryForge · live status</div><h2 class="h2" id="b1513r3HudTitle">Where your stories <em>stand</em></h2><p>A clear view of progress, review, and who can see each story.</p></div><div class="b1513r3HudTotal"><strong>${total}</strong><span>${total === 1 ? 'story' : 'stories'}<br>in your forge</span></div></div>
    <div class="b1513r3HudGrid ${visibilityEnabled ? '' : 'withoutPrivacy'}">
      <div class="b1513r3HudBlock"><span class="b1513r3HudLabel">Development progress</span><div class="b1513r3Progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}" aria-label="${percent}% of stories complete"><span style="width:${percent}%"></span></div><div class="b1513r3HudStatline"><span><b>${complete}</b> complete</span><span>${percent}% of your library</span></div></div>
      <div class="b1513r3HudBlock"><span class="b1513r3HudLabel">Review pipeline</span><div class="b1513r3HudChips">${Object.entries(STATUS).filter(([key]) => statusCounts[key]).map(([key, meta]) => `<button class="b1513r3HudChip ${key === 'changes' ? 'attn' : ''}" type="button" data-library-status="${attr(key)}" title="${attr(meta.hint)}"><b>${statusCounts[key]}</b> ${esc(meta.label)}</button>`).join('') || '<span class="stageHint">No stories in review yet.</span>'}</div></div>
      ${visibilityEnabled ? `<div class="b1513r3HudBlock"><span class="b1513r3HudLabel">Privacy at a glance</span><div class="b1513r3PrivacySplit"><div class="b1513r3PrivacyStat"><strong>${mentorVisible}</strong><span>Mentor Visible</span></div><div class="b1513r3PrivacyStat"><strong>${privateCount}</strong><span>Private — only me</span></div></div></div>` : ''}
    </div>
    <div class="b1513r3HudAction"><span>${actionText}</span><button class="rowBtn pri" type="button" ${actionStatus ? `data-library-status="${actionStatus}"` : 'data-nav="library"'}>Open Story Library →</button></div>
  </section>`;
}

function renderHome() {
  const unfinished = state.stories
    .filter((story) => developmentState(story) !== 'Complete')
    .slice(0, 4);
  const latest = state.notifications.slice(0, 3);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const voiceEnabled = Boolean(state.capabilities?.voiceCapture);
  let voiceHintSeen = false;
  try {
    voiceHintSeen = localStorage.getItem(VOICE_HINT_KEY) === '1';
  } catch {
    voiceHintSeen = true;
  }

  main.innerHTML = `<section data-view="home" class="live">
    <div class="homeHero">
      <div class="greet">${greeting}, <em>${esc(firstName())}</em>.</div>
      <div class="greetSub">What happened that you don’t want to lose?</div>
      <div class="heroCapture">
        <span class="pfx">The One Where</span>
        <input id="heroTitle" placeholder="${voiceEnabled ? '…type it — or just talk' : '…type it before it fades'}" autocomplete="off" aria-label="Story title">
        ${voiceEnabled ? `<button class="heroMic ${voiceHintSeen ? '' : 'newPulse'}" type="button" data-open-capture data-capture-voice title="Speak it — StoryForge types while you talk">
          <span aria-hidden="true">●</span><span class="srOnly">Tell it out loud</span>
        </button>` : ''}
        <button class="heroGo" type="button" data-capture-title-from="heroTitle">Save it</button>
      </div>
      <button class="sparkPrompt" type="button" data-next-prompt title="A memory prompt — choose Write about this to begin">
        <span class="tag">Memory prompt</span><span id="promptTxt">${esc(MEMORY_PROMPTS[state.promptIndex])}</span><span aria-hidden="true">↻</span>
      </button>
      <button class="rowBtn" type="button" data-capture-prompt="${attr(MEMORY_PROMPTS[state.promptIndex])}">Write about this</button>
      ${homeRecommendationsMarkup()}
    </div>

    <div class="homeGrid">
      <div class="panel">
        <div class="pHead"><div class="h2">Unfinished <em>stories</em></div><button class="pMore" type="button" data-nav="library">Story Library ▸</button></div>
        <div class="pBody">
          <p class="stageHint">Started, but not fully told yet. Finish the telling and add what it taught you.</p>
          ${unfinished.length ? unfinished.map((story) => `<button class="shortItem" type="button" data-open-story="${attr(story.id)}" data-completion-guidance="finish">
            <span class="si">${story.prefixEnabled ? '<span class="pre">The One Where </span>' : ''}${esc(story.title)}</span>
            <span class="sd">${esc(developmentState(story))} · ${esc(ago(story.updatedAt || story.createdAt))}</span>
            <span class="rowBtn pri">Finish it</span>
          </button>`).join('') : '<div class="storyEmpty">Every story you’ve started is finished. Nice.</div>'}
        </div>
      </div>

      <div>
        <div class="panel panel-gap">
          <div class="pHead"><div class="h2">From your <em>mentor</em></div>
            ${state.notifications.filter((item) => !notificationRead(item)).length ? `<span class="newEmber">${state.notifications.filter((item) => !notificationRead(item)).length} new</span>` : ''}
            <button class="pMore" type="button" data-nav="notifications">All notifications ▸</button>
          </div>
          <div class="pBody">
            ${latest.length ? latest.map((item) => `<button class="advNote ${notificationRead(item) ? '' : 'unseen'}" type="button"
              data-open-notification="${attr(item.id)}" data-story-id="${attr(notificationStoryId(item))}">
              <span class="avc adv">M</span><span><span class="who">${notificationRead(item) ? '' : '<i class="emberDot"></i>'}${esc(ago(notificationTime(item)))}</span>
              <span class="txt">${esc(notificationText(item))}</span></span>
            </button>`).join('') : '<div class="storyEmpty">Feedback will appear here the moment your mentor reviews a story.</div>'}
          </div>
        </div>
      </div>
    </div>
    ${homeStatusHudMarkup()}
  </section>`;
}

function filteredStories() {
  const filter = state.library;
  const query = filter.query.trim().toLowerCase();
  const stories = state.stories.filter((story) => {
    if (filter.status && story.status !== filter.status) return false;
    if (filter.star === 'me' && !story.studentStar) return false;
    if (filter.star === 'mentor' && !story.mentorStar) return false;
    if (filter.bird && !story.birds.includes(filter.bird)) return false;
    if (filter.position && !story.positions.includes(filter.position)) return false;
    if (filter.categories.length && !filter.categories.every((id) => story.categories.includes(id))) return false;
    if (filter.uses.length && !filter.uses.every((id) => story.uses.includes(id))) return false;
    const categoryLabels = story.categories.map((id) => presentationTaxonomyLabel('categories', id));
    const useLabels = story.uses.map((id) => presentationTaxonomyLabel('intendedUses', id));
    if (query && !`${storyTitle(story)} ${story.text} ${story.lesson} ${categoryLabels.join(' ')} ${useLabels.join(' ')}`.toLowerCase().includes(query)) return false;
    return true;
  });
  const newestThenId = (a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)) || a.id.localeCompare(b.id);
  const sorters = {
    priority: (a, b) => {
      const left = Number(a.studentScore) || 0;
      const right = Number(b.studentScore) || 0;
      if (left !== right) return right - left;
      return newestThenId(a, b);
    },
    new: newestThenId,
    old: (a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)) || a.id.localeCompare(b.id),
    myscore: (a, b) => (b.studentScore - a.studentScore) || newestThenId(a, b),
    mentorscore: (a, b) => (b.mentorScore - a.mentorScore) || newestThenId(a, b),
    title: (a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
  };
  const requestedSort = state.capabilities?.inlinePriority
    ? filter.sort
    : (filter.sort === 'priority' ? 'new' : filter.sort);
  return [...stories].sort(sorters[requestedSort] || sorters.new);
}

function libraryFacetButtons(items, selected, key, label) {
  return `<div class="b1511Facet" role="group" aria-label="${attr(label)} — selected filters must all match">
    <span class="b1511FacetLabel">${esc(label)} <small>match all</small></span>
    ${items.map((item) => `<button type="button" data-library-${key}="${attr(item.id)}" class="${selected.includes(item.id) ? 'on' : ''}" aria-pressed="${selected.includes(item.id)}">${esc(item.label)}</button>`).join('')}
  </div>`;
}

function renderLibrary() {
  const list = filteredStories();
  const filter = state.library;
  main.innerHTML = `<section data-view="library" class="live">
    <div class="eyebrow">Your story library</div>
    <h1 class="h1">${state.stories.length} ${state.stories.length === 1 ? 'story' : 'stories'}, <em>none forgotten</em>.</h1>
    <div class="listBar">
      <div class="b1511Search"><input type="search" id="libQ" role="combobox" aria-autocomplete="list" placeholder="Search stories…" value="${attr(filter.query)}" aria-label="Search stories" autocomplete="off" aria-controls="libSearchSuggestions" aria-expanded="false">
        <div id="libSearchSuggestions" class="b1511Suggestions" role="listbox" aria-label="Story suggestions" hidden></div></div>
      <select id="libStatus" aria-label="Filter by status">
        <option value="">Status: all</option>
        ${Object.entries(STATUS).map(([key, meta]) => `<option value="${key}" ${filter.status === key ? 'selected' : ''}>${esc(meta.label)}</option>`).join('')}
      </select>
      <select id="libSort" aria-label="Sort stories">
        ${state.capabilities?.inlinePriority ? `<option value="priority" ${filter.sort === 'priority' ? 'selected' : ''}>Sort: priority 5→1</option>` : ''}
        <option value="new" ${filter.sort === 'new' ? 'selected' : ''}>Sort: newest</option>
        <option value="old" ${filter.sort === 'old' ? 'selected' : ''}>Oldest</option>
        <option value="myscore" ${filter.sort === 'myscore' ? 'selected' : ''}>My rating (high→low)</option>
        <option value="mentorscore" ${filter.sort === 'mentorscore' ? 'selected' : ''}>Mentor score (high→low)</option>
        <option value="title" ${filter.sort === 'title' ? 'selected' : ''}>Title A–Z</option>
      </select>
      <select id="libStar" aria-label="Filter starred stories">
        <option value="">Starred: any</option>
        <option value="me" ${filter.star === 'me' ? 'selected' : ''}>Starred by me</option>
        <option value="mentor" ${filter.star === 'mentor' ? 'selected' : ''}>Starred by mentor</option>
      </select>
      <select id="libBird" aria-label="Filter bird type">
        <option value="">Bird type: any</option>
        ${BIRDS.map((bird) => `<option value="${bird.id}" ${filter.bird === bird.id ? 'selected' : ''}>${bird.emo} ${esc(bird.label)}</option>`).join('')}
      </select>
      <select id="libPosition" aria-label="Filter ideal position">
        <option value="">Ideal for: any</option>
        ${POSITIONS.map((position) => `<option value="${position.id}" ${filter.position === position.id ? 'selected' : ''}>${esc(position.label)}</option>`).join('')}
      </select>
      <span class="countNote" id="libraryCount">${list.length} of ${state.stories.length}</span>
    </div>
    ${state.capabilities?.taxonomy ? `<div class="b1511LibraryFacets">
      ${libraryFacetButtons(presentationTaxonomy('categories', { includeSelected: filter.categories }), filter.categories, 'category', 'Categories')}
      ${libraryFacetButtons(presentationTaxonomy('intendedUses', { includeSelected: filter.uses }), filter.uses, 'use', 'Intended uses')}
    </div>` : ''}
    <div id="librarySearchStatus" class="srOnly" role="status" aria-live="polite"></div>
    <div id="libraryRows">${list.length ? list.map((story) => storyRow(story, { inlinePriority: true })).join('') : emptyState('No stories match.', 'Clear a filter, or capture the story this search was looking for.')}</div>
  </section>`;
}

function renderLibraryRowsOnly() {
  const rows = $('#libraryRows');
  if (!rows) return;
  const list = filteredStories();
  rows.innerHTML = list.length
    ? list.map((story) => storyRow(story, { inlinePriority: true })).join('')
    : emptyState('No stories match.', 'Clear a filter, or capture the story this search was looking for.');
  const count = $('#libraryCount');
  if (count) count.textContent = `${list.length} of ${state.stories.length}`;
  const status = $('#librarySearchStatus');
  if (status) status.textContent = `${list.length} ${list.length === 1 ? 'story' : 'stories'} shown.`;
}

function replaceStoryInState(story) {
  state.stories = state.stories.map((item) => item.id === story.id ? story : item);
  if (state.storyDetail?.id === story.id) state.storyDetail = story;
  if (state.quick?.story?.id === story.id) state.quick.story = story;
}

function syncPriorityRow(story) {
  const row = $(`[data-story-row="${CSS.escape(story.id)}"]`, $('#libraryRows') || document);
  if (!row) return;
  const value = Number(story.studentScore) || 0;
  row.querySelectorAll('[data-library-priority]').forEach((button) => {
    const priority = Number(button.dataset.libraryPriority);
    button.classList.toggle('on', priority <= value);
    button.setAttribute('aria-pressed', String(priority === value));
  });
  const label = $('[data-priority-label]', row);
  if (label) label.textContent = `Student priority: ${value ? `${value} of 5` : 'unrated'}`;
}

function reorderLibraryRowsStable() {
  const rows = $('#libraryRows');
  if (!rows) return;
  const list = filteredStories();
  if (!list.length) {
    renderLibraryRowsOnly();
    return;
  }
  const existing = new Map($$('[data-story-row]', rows).map((row) => [row.dataset.storyRow, row]));
  if (existing.size !== list.length || list.some((story) => !existing.has(story.id))) {
    renderLibraryRowsOnly();
    return;
  }
  list.forEach((story) => rows.append(existing.get(story.id)));
  const count = $('#libraryCount');
  if (count) count.textContent = `${list.length} of ${state.stories.length}`;
}

const libraryMutationIds = new Set();

async function updateLibraryPriority(storyId, priority, button) {
  const story = state.stories.find((item) => item.id === storyId);
  if (!story || !isStudent() || !state.capabilities?.inlinePriority || libraryMutationIds.has(storyId)) return;
  const previous = story;
  const optimistic = { ...story, studentScore: Number(priority) };
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  libraryMutationIds.add(storyId);
  button.closest('[data-priority-story]')?.setAttribute('aria-busy', 'true');
  replaceStoryInState(optimistic);
  syncPriorityRow(optimistic);
  reorderLibraryRowsStable();
  button.focus({ preventScroll: true });
  try {
    const result = await api.storyPriority(storyId, {
      priority: Number(priority),
      expectedVersion: story.rowVersion ?? 0,
      surface: 'library',
    });
    const saved = unwrapStory({ ...optimistic, ...(result?.story || result) });
    replaceStoryInState(saved);
    syncPriorityRow(saved);
    reorderLibraryRowsStable();
    button.focus({ preventScroll: true });
    notify(`Student priority saved at ${saved.studentScore || priority} of 5.`);
  } catch (error) {
    replaceStoryInState(previous);
    syncPriorityRow(previous);
    reorderLibraryRowsStable();
    button.focus({ preventScroll: true });
    notify(error.status === 409
      ? 'Priority changed elsewhere. Your prior value was restored; reopen the story to refresh.'
      : (error.message || 'Priority was not saved. Your prior value was restored.'));
  } finally {
    libraryMutationIds.delete(storyId);
    button.closest('[data-priority-story]')?.removeAttribute('aria-busy');
    window.scrollTo(scrollX, scrollY);
  }
}

function renderNotifications() {
  const unread = state.notifications.filter((item) => !notificationRead(item)).length;
  main.innerHTML = `<section data-view="notifications" class="live">
    <div class="eyebrow">Notifications</div>
    <h1 class="h1">${unread ? `${unread} unread` : 'All caught up'}<em>${unread ? '' : ' ✓'}</em></h1>
    <div class="notificationLead">
      <span>Everything your mentor does on your stories lands here — open any item to go to that story.</span>
      ${unread ? '<button class="rowBtn" type="button" data-read-all>Mark all as read</button>' : ''}
    </div>
    ${state.notifications.length ? state.notifications.map((item) => `<button class="nRow ${notificationRead(item) ? 'read' : 'unread'}" type="button"
      data-open-notification="${attr(item.id)}" data-story-id="${attr(notificationStoryId(item))}">
      <span class="nDot"></span>
      <span class="nCopy"><span class="nTxt">${esc(notificationText(item))}</span><span class="nWhen">${esc(formatDateTime(notificationTime(item)))}</span></span>
      <span class="nGo">${notificationStoryId(item) ? 'Open story ▸' : 'Mark read'}</span>
    </button>`).join('') : emptyState('Nothing here yet.', 'When your mentor reviews a story, you’ll see it here immediately.')}
  </section>`;
}

function themeSettingsMarkup() {
  const preference = savedTheme();
  const card = (value, label, hint) => `<button class="b1513r2ThemeCard ${preference === value ? 'on' : ''}" type="button" data-theme-preference="${value}" aria-pressed="${preference === value}"><b>${label}</b><span>${hint}</span></button>`;
  return `<div class="panel panel-spaced">
    <div class="pHead"><div class="h2">Dark / <em>Light</em></div></div>
    <div class="pBody">
      <div class="b1513r2ThemeRow" role="group" aria-label="Theme">
        ${card('dark', '🌙 Dark', 'The StoryForge night studio — default.')}
        ${card('light', '☀ Light', 'Warm paper & ink. A real StoryForge design, not a white flip.')}
        ${card('auto', '⚙ Auto', 'Follows your device — light by day, dark by night.')}
      </div>
      <p class="stageHint">Your environment, text size, and reduced-motion choices apply in both themes.</p>
    </div>
  </div>`;
}

function privacySettingsMarkup() {
  if (!isStudent() || !v2FeatureOn('visibility')) return '';
  const consent = state.v2.consent;
  const accepted = Boolean(consent?.accepted);
  return `<div class="panel panel-spaced b1513PrivacyPanel">
    <div class="pHead"><div class="h2">Mentorship &amp; <em>privacy</em></div></div>
    <div class="pBody">
      <div class="setRow"><div class="sTxt"><b>Mentorship visibility</b><span>${accepted
        ? `You agreed on ${esc(formatDateTime(firstDefined(consent.acceptedAt, consent.accepted_at)))} (policy ${esc(firstDefined(consent.policyVersion, consent.policy_version, ''))}). New stories start Mentor Visible; any story can be made Private — visible only to me.`
        : 'You haven’t agreed yet. New stories remain private-safe until you choose otherwise.'}</span></div>
        <span class="rolePill ${accepted ? '' : 'roleReadOnly'}">${accepted ? 'Agreed' : 'Not agreed'}</span></div>
      <div class="setRow"><div class="sTxt"><b>Policy</b><span>Re-read the plain-language mentorship visibility policy at any time.</span></div>
        <button class="rowBtn" type="button" data-review-mentorship-policy>${accepted ? 'Review policy' : 'Read & decide'}</button></div>
      <div class="setRow"><div class="sTxt"><b>Per-story control</b><span>Each story’s Visibility card switches between Mentor Visible and Private — visible only to me. Changes are logged to that story’s history.</span></div></div>
    </div>
  </div>`;
}

function consentNode() {
  let node = document.getElementById('b1513Consent');
  if (!node) {
    node = document.createElement('div');
    node.id = 'b1513Consent';
    document.body.appendChild(node);
  }
  return node;
}

function closeConsent() {
  const node = document.getElementById('b1513Consent');
  if (node) {
    node.className = '';
    node.replaceChildren();
  }
  if (state.returnFocus?.isConnected) state.returnFocus.focus({ preventScroll: true });
  state.returnFocus = null;
}

async function showConsent() {
  const payload = await api.consent().catch(() => null);
  const policy = payload?.policy;
  if (!payload?.enabled || !policy?.version || !policy?.updated) return;
  state.v2.consent = payload.consent || state.v2.consent;
  const accepted = Boolean(state.v2.consent?.accepted);
  const node = consentNode();
  const policyBody = [
    'StoryForge is your private story workspace inside MissionMed mentorship. Your authorized MissionMed mentor (Dr Brian) may look at mentor-visible work to guide you — the way a coach reviews practice film — even before you formally submit a story for review.',
    'After you agree, new stories start as Mentor Visible. You stay in control: any individual story can be switched to Private — visible only to me at any time, and Private stories are never opened, listed, or reviewed by anyone but you.',
    'Submitting a story is still a separate, explicit action that means “please review this story now.”',
    'Nothing here is ever public. Other students can never see your work. Every visibility change is logged to your story history, and you can re-read this policy any time in Settings.',
  ];
  const policyFacts = [
    'After agreement, new stories begin Mentor Visible.',
    'Every story retains a Private — only me control.',
    'Private stories are never listed, opened, or reviewed by a mentor.',
    'Historical V1 stories remain Private unless you explicitly change them.',
    'Nothing is public, and no student can see another student’s work.',
    'Changes are logged, and this policy remains available in Settings.',
  ];
  const promises = [
    ['⌂', 'Your workspace', 'Stories begin in a protected workspace owned by you.'],
    ['◇', 'Your mentor', 'After you agree, new stories begin Mentor Visible.'],
    ['◉', 'Your control', 'Every new story can be changed to Private — only me.'],
    ['✓', 'Review is separate', 'Visibility never means submitted for formal review.'],
  ];
  const requiredFacts = [
    ...policyFacts,
    'Before you agree, new stories remain private-safe.',
    'After you agree, only new stories default to Mentor Visible.',
    'Historical V1 stories are never silently widened.',
    'Private means visible only to you — not mentors, admins, or other students.',
    'You can override each story to Private — only me.',
    'Mentor visibility and formal submission are separate choices.',
  ].filter((fact, index, all) => all.indexOf(fact) === index);
  state.returnFocus = document.activeElement;
  node.className = 'b1513ConsentOpen';
  node.innerHTML = `<div class="b1513ConsentScrim"></div><div class="b1513ConsentSheet b1513r3ConsentSheet" role="dialog" aria-modal="true" aria-labelledby="b1513ConsentTitle">
    <div class="b1513r3ConsentHero"><div class="eyebrow">MissionMed mentorship · one-time choice</div><h1 class="h1" id="b1513ConsentTitle">Your stories. <em>Your choice.</em></h1><p>Choose how new stories begin. You stay in control of every story, every time.</p></div>
    <div class="b1513r3ConsentBody"><div class="b1513r3ConsentPromises" role="list">${promises.map(([icon, title, body]) => `<div class="b1513r3Promise" role="listitem"><span class="b1513r3PromiseIcon" aria-hidden="true">${icon}</span><b>${title}</b><span>${body}</span></div>`).join('')}</div>
      <div class="b1513r3ConsentPlain"><div class="b1513r3ConsentCopy"><div class="rLbl">The plain-language policy</div><h2 class="h2">Mentorship visibility</h2>${policyBody.map((paragraph) => `<p class="b1513ConsentPara">${esc(paragraph)}</p>`).join('')}</div><div class="b1513r3ConsentFacts">${requiredFacts.map((fact) => `<div class="b1513r3ConsentFact"><span aria-hidden="true">✓</span>${esc(fact)}</div>`).join('')}</div></div>
      <div class="b1513r3Choice">${accepted ? `<div class="inlineActions"><button class="rowBtn pri" type="button" data-close-mentorship-policy>Close</button><span class="stageHint">You agreed on ${esc(formatDateTime(firstDefined(state.v2.consent.acceptedAt, state.v2.consent.accepted_at)))} · receipt ${esc(firstDefined(state.v2.consent.auditId, state.v2.consent.audit_id, ''))}</span></div>` : `<label class="b1513ConsentCheck b1513r3ConsentCheck"><input type="checkbox" data-consent-confirm> <span>I understand: after I agree, <b>new stories</b> begin Mentor Visible, and I can make any story <b>Private — only me</b> at any time.</span></label><div class="b1513r3ConsentActions"><button class="noteSend" type="button" data-consent-decision="accept" disabled>Agree and continue</button><button class="rowBtn" type="button" data-consent-decision="defer">Not now — keep everything private</button></div><p class="stageHint">“Not now” changes nothing: your work stays private until you choose otherwise. You can decide later in Settings.</p>`}<div class="b1513r3PolicyMeta">Policy ${esc(policy.version)} · updated ${esc(policy.updated)} · always available in Settings → Mentorship &amp; privacy.</div></div>
    </div></div>`;
  const heading = node.querySelector('#b1513ConsentTitle');
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}

async function maybeShowConsent() {
  if (!isStudent() || !v2FeatureOn('visibility')) return;
  if (state.v2.consent?.accepted || state.v2.consentDeferredThisSession) return;
  await showConsent();
}

async function decideConsent(decision) {
  const result = await withBusy(() => api.decideConsent(decision));
  if (!result) return;
  state.v2.consent = result.consent || state.v2.consent;
  if (decision === 'accept') {
    notify(`Thank you. Mentorship visibility is on — receipt ${firstDefined(result.receipt?.auditId, result.receipt?.audit_id, 'recorded')}.`, '✓');
  } else {
    state.v2.consentDeferredThisSession = true;
    notify('No change made — everything stays private. You can agree later in Settings.');
  }
  closeConsent();
  await renderRoute();
}

function visibilityChip(story) {
  if (!v2FeatureOn('visibility') || !story) return '';
  return storyVisibility(story) === 'private'
    ? '<span class="stChip b1513VisPrivate" title="Private — visible only to you. Not listed for or openable by any mentor.">🔒 Private · only you</span>'
    : '<span class="stChip b1513VisMentor" title="Your mentor can see this story for guidance. Submitting is still a separate action.">👁 Mentor visible</span>';
}

function visibilityCard(story, mentor) {
  if (!v2FeatureOn('visibility') || !story) return '';
  const isPrivate = storyVisibility(story) === 'private';
  const submitted = story.status !== 'private';
  if (mentor) {
    return `<div class="railCard b1513VisibilityCard"><div class="rLbl">Visibility</div><div>${visibilityChip(story)}</div><div class="stageHint">${isPrivate ? 'This story is private to the student.' : 'The student made this story mentor-visible for guidance.'}</div></div>`;
  }
  return `<div class="railCard b1513VisibilityCard"><div class="rLbl">Visibility</div>
    <div>${visibilityChip(story)}</div>
    <div class="statusRow b1513VisibilityRow" role="group" aria-label="Story visibility">
      <button type="button" data-set-story-visibility="mentor_visible" class="${isPrivate ? '' : 'on b1513VisMentor'}" aria-pressed="${!isPrivate}">Mentor Visible</button>
      <button type="button" data-set-story-visibility="private" class="${isPrivate ? 'on b1513VisPrivate' : ''}" aria-pressed="${isPrivate}" ${submitted ? 'disabled title="Submitted stories stay visible to your reviewer. Use Return to Private to withdraw first."' : ''}>Private — visible only to me</button>
    </div>
    <div class="stageHint">${isPrivate ? 'Only you can open this story. It is never listed for your mentor and is not reviewed.' : 'Your mentor can see this story to guide you. “Submit for review” below is still a separate, explicit ask.'}${submitted && !isPrivate ? ' While submitted, use “Return to Private” to withdraw reviewer access first.' : ''}</div>
    <div class="stageHint b1513VisAudit">Visibility changes are logged to this story’s history.</div>
  </div>`;
}

async function setStoryVisibility(visibility) {
  const story = state.storyDetail;
  if (!story || !['private', 'mentor_visible'].includes(visibility)) return;
  const result = await withBusy(() => api.storyVisibility(story.id, visibility, story.rowVersion));
  if (!result) return;
  state.storyDetail = unwrapStory(result);
  replaceStoryInState(state.storyDetail);
  renderStoryRoom();
  notify(visibility === 'private' ? 'This story is now Private — visible only to you. Logged.' : 'This story is now Mentor Visible. Logged.', '✓');
}

function renderSettings() {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const selectedBackground = state.settingsPreview.selectedBackground || savedBackground();
  const selectedTextSize = state.settingsPreview.selectedTextSize || savedTextSize();
  main.innerHTML = `<section data-view="settings" class="live settingsPage">
    <div class="eyebrow">Settings</div>
    <h1 class="h1">Your <em>account</em></h1>
    ${themeSettingsMarkup()}
    <div class="panel panel-spaced">
        <div class="pHead"><div class="h2">Background <em>environment</em></div></div>
      <div class="pBody">
        <p class="stageHint">Choose an environment, preview it safely, then save it to your signed-in account.</p>
        <div class="b1512PreferenceState" role="status" aria-live="polite">
          <span>Selected: <strong>${esc(BACKGROUNDS.find(({ id }) => id === selectedBackground)?.name || 'Emberlight')}</strong></span>
          <span>Saved: <strong>${esc(BACKGROUNDS.find(({ id }) => id === savedBackground())?.name || 'Emberlight')}</strong></span>
          <span>Preview: <strong>${state.settingsPreview.previewBackground ? 'Active' : 'Off'}</strong></span>
        </div>
        <div class="bgGrid">
          ${BACKGROUNDS.map((background) => `<button class="bgCard bg-${background.id} ${selectedBackground === background.id ? 'on' : ''}" type="button"
            data-select-background="${background.id}" aria-pressed="${selectedBackground === background.id}">
            <span class="bgPrev"></span>
            <span class="bgMeta"><span class="bgName"><span>${background.ico}</span>${esc(background.name)}${savedBackground() === background.id ? '<span class="onTag">Saved</span>' : ''}${state.settingsPreview.previewBackground === background.id ? '<span class="onTag preview">Preview</span>' : ''}</span>
              <span class="bgDesc">${esc(background.desc)}</span></span>
          </button>`).join('')}
        </div>
        <div class="inlineActions b1512PreferenceActions"><button class="rowBtn" type="button" data-preview-background>Preview</button><button class="rowBtn pri" type="button" data-save-background>Save environment</button><button class="rowBtn" type="button" data-cancel-background>Cancel preview</button></div>
      </div>
    </div>
    <div class="panel panel-spaced">
      <div class="pHead"><div class="h2">Global <em>text size</em></div></div>
      <div class="pBody">
        <p class="stageHint">Adjust StoryForge reading and control text without changing browser zoom.</p>
        <div class="b1512TextSizeOptions" role="group" aria-label="StoryForge text size">
          ${[['standard', 'Standard'], ['large', 'Large'], ['extra_large', 'Extra Large']].map(([id, label]) => `<button class="rowBtn ${selectedTextSize === id ? 'pri' : ''}" type="button" data-select-text-size="${id}" aria-pressed="${selectedTextSize === id}">${label}${savedTextSize() === id ? ' · Saved' : ''}</button>`).join('')}
        </div>
        <div class="b1512TextPreview" aria-live="polite"><strong>Preview reading sample</strong><span>Stories, forms, dialogs, tables, navigation, and controls use the same saved preference.</span></div>
        <div class="inlineActions b1512PreferenceActions"><button class="rowBtn" type="button" data-preview-text-size>Preview</button><button class="rowBtn pri" type="button" data-save-text-size>Save text size</button><button class="rowBtn" type="button" data-cancel-text-size>Cancel preview</button></div>
      </div>
    </div>
    ${privacySettingsMarkup()}
    <div class="panel panel-spaced"><div class="pBody pbody-top">
      <div class="setRow"><div class="sTxt"><b>Signed in as</b><span>${esc(state.user.display_name)} · ${esc(state.user.role)}${state.user.cohort ? ` · ${esc(state.user.cohort)}` : ''}</span></div></div>
      <div class="setRow"><div class="sTxt"><b>View access</b><span>${canSwitchAdministratorView() ? 'WordPress grants this account both Student and Administrator views. Use the signed view control in the sidebar.' : `Your ${viewLabel()} comes from your signed MissionMed role.`}</span></div><span class="rolePill roleReadOnly">${viewLabel()}</span></div>
      <div class="setRow"><div class="sTxt"><b>Time zone</b><span>Dates and times are shown in ${esc(timeZone)}. Authoritative UTC timestamps are preserved underneath.</span></div></div>
      <div class="setRow"><div class="sTxt"><b>Reduced motion</b><span>StoryForge follows your system setting automatically. Currently: ${reducedMotion ? 'ON — ambient animation is paused' : 'OFF — the ambient background is animated'}.</span></div></div>
      <div class="setRow"><div class="sTxt"><b>Back to Matrix</b><span>Return to the MissionMed Matrix hub.</span></div><a class="rowBtn" href="${attr(matrixHref())}">Go</a></div>
      ${state.config?.devAuth ? '<div class="setRow"><div class="sTxt"><b>Local verification identity</b><span>This control exists only in local signed-fixture mode.</span></div><button class="rowBtn" type="button" data-change-fixture>Change identity</button></div>' : ''}
    </div></div>
  </section>`;
}

function voiceScopeLabel(scope) {
  return ({
    off: 'Off',
    allowlist: 'Allowlist',
    cohort: 'Cohort',
    eligible_all: 'All eligible (locked)',
  })[scope] || 'Off';
}

function cloneContentDisplay(payload = BUNDLED_PRESENTATION) {
  return JSON.parse(JSON.stringify(payload));
}

function contentDisplayDraft() {
  if (!state.adminContentDraft) {
    state.adminContentDraft = cloneContentDisplay(state.adminContentDisplay?.configuration?.payload || BUNDLED_PRESENTATION);
  }
  return state.adminContentDraft;
}

function renderTaxonomyConfiguration(key, title) {
  const entries = asArray(contentDisplayDraft().taxonomy?.[key]);
  return `<fieldset class="b1512ConfigGroup"><legend>${esc(title)}</legend>
    <p class="stageHint">Stable identifiers are preserved. Hidden and retired values remain readable on existing stories.</p>
    <div class="b1512ConfigRows" data-config-list="${attr(key)}">
      ${entries.map((entry, index) => `<div class="b1512ConfigRow" data-config-tax-row="${attr(key)}" data-config-tax-id="${attr(entry.id)}">
        <label><span class="srOnly">${esc(title)} label</span><input data-config-tax-label value="${attr(entry.label)}" maxlength="80" required></label>
        <label><span class="srOnly">${esc(title)} state</span><select data-config-tax-state>
          ${[['active', 'Visible'], ['hidden', 'Hidden'], ['retired', 'Retired']].map(([value, label]) => `<option value="${value}" ${entry.state === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select></label>
        <span class="b1512StableId" title="Stable identifier">${esc(entry.id)}</span>
        <div class="b1512OrderButtons"><button type="button" class="rowBtn" data-config-move="-1" data-config-kind="${attr(key)}" data-config-id="${attr(entry.id)}" ${index === 0 ? 'disabled' : ''} aria-label="Move ${attr(entry.label)} up">↑</button><button type="button" class="rowBtn" data-config-move="1" data-config-kind="${attr(key)}" data-config-id="${attr(entry.id)}" ${index === entries.length - 1 ? 'disabled' : ''} aria-label="Move ${attr(entry.label)} down">↓</button></div>
      </div>`).join('')}
    </div>
    <button class="rowBtn" type="button" data-config-add="${attr(key)}">+ Add ${esc(title.toLowerCase().replace(/s$/, ''))}</button>
  </fieldset>`;
}

function renderSectionConfiguration() {
  const labels = {
    storyCategories: 'Story categories',
    intendedUses: 'Intended uses',
    workingVersion: 'Working version',
    learningLesson: 'Learning Lesson',
    reviewSubmission: 'Submit for review',
  };
  return `<fieldset class="b1512ConfigGroup"><legend>Story sections</legend>
    <p class="stageHint">Edit bounded plain-text labels and choose whether each existing section is optional, required for submission, or hidden.</p>
    <div class="b1512SectionRows">${Object.entries(contentDisplayDraft().sections || {}).map(([key, section]) => `<div class="b1512SectionRow" data-config-section="${attr(key)}">
      <strong>${esc(labels[key] || key)}</strong>
      <label>Title<input data-config-section-title value="${attr(section.title)}" maxlength="80" required></label>
      <label>Helper text<textarea data-config-section-helper maxlength="400" rows="2">${esc(section.helper)}</textarea></label>
      <label>Display<select data-config-section-mode>
        <option value="visible_optional" ${section.mode === 'visible_optional' ? 'selected' : ''}>Visible · optional</option>
        <option value="visible_required" ${section.mode === 'visible_required' ? 'selected' : ''}>Visible · required for submission</option>
        <option value="hidden" ${section.mode === 'hidden' ? 'selected' : ''}>Hidden</option>
      </select></label>
    </div>`).join('')}</div>
  </fieldset>`;
}

function renderContentDisplayControls() {
  const config = state.adminContentDisplay?.configuration || null;
  const unavailable = !config;
  return `<div class="panel panel-spaced b1512ContentDisplay" data-content-display-admin>
    <div class="pHead"><div class="h2">Content &amp; <em>Display</em></div><span class="rolePill">Version ${Number(config?.rowVersion || 0)}</span></div>
    <div class="pBody">
      <p class="stageHint">Bounded StoryForge labels, taxonomy, section visibility, and navigation only. This surface cannot accept HTML, CSS, scripts, or arbitrary application code.</p>
      ${state.adminContentError ? `<div class="releaseError" role="alert">${esc(state.adminContentError)}</div>` : ''}
      ${unavailable ? `<div class="setRow"><div class="sTxt"><b>Configuration unavailable</b><span>No change can be previewed or published.</span></div><button class="rowBtn" type="button" data-admin-release-reload>Retry</button></div>` : `<form id="contentDisplayForm">
        ${renderTaxonomyConfiguration('categories', 'Story categories')}
        ${renderTaxonomyConfiguration('intendedUses', 'Intended uses')}
        ${renderSectionConfiguration()}
        <fieldset class="b1512ConfigGroup"><legend>Navigation</legend><label class="b1512Check"><input type="checkbox" data-config-interview-prep ${contentDisplayDraft().navigation?.interviewPrepVisible ? 'checked' : ''}> Show Interview Prep to eligible students</label></fieldset>
        <div class="b1512ConfigActions">
          <button class="rowBtn" type="button" data-config-preview>Preview in this signed browser</button>
          <button class="rowBtn pri" type="submit">Publish configuration</button>
          <button class="rowBtn" type="button" data-config-cancel-preview ${state.adminContentPreviewing ? '' : 'disabled'}>Cancel preview</button>
          <button class="rowBtn danger" type="button" data-config-restore-defaults>Restore defaults</button>
        </div>
        <p class="stageHint" aria-live="polite">${state.adminContentPreviewing ? 'Preview is active only in this signed browser. Nothing has been published.' : `Published ${esc(formatDateTime(config.updatedAt))}.`}</p>
      </form>`}
    </div>
  </div>`;
}

function syncContentDisplayDraft(form = $('#contentDisplayForm')) {
  if (!form) return contentDisplayDraft();
  const draft = contentDisplayDraft();
  for (const row of $$('[data-config-tax-row]', form)) {
    const key = row.dataset.configTaxRow;
    const entry = asArray(draft.taxonomy?.[key]).find((item) => item.id === row.dataset.configTaxId);
    if (!entry) continue;
    entry.label = $('[data-config-tax-label]', row)?.value || '';
    entry.state = $('[data-config-tax-state]', row)?.value || 'active';
  }
  for (const row of $$('[data-config-section]', form)) {
    const section = draft.sections?.[row.dataset.configSection];
    if (!section) continue;
    section.title = $('[data-config-section-title]', row)?.value || '';
    section.helper = $('[data-config-section-helper]', row)?.value || '';
    section.mode = $('[data-config-section-mode]', row)?.value || 'visible_optional';
  }
  draft.navigation.interviewPrepVisible = Boolean($('[data-config-interview-prep]', form)?.checked);
  return draft;
}

async function previewContentDisplay() {
  const payload = syncContentDisplayDraft();
  const validated = await withBusy(() => api.validateContentDisplay({ payload }));
  state.adminContentDraft = cloneContentDisplay(validated.payload);
  state.presentation = cloneContentDisplay(validated.payload);
  state.adminContentPreviewing = true;
  state.adminContentError = '';
  renderShell();
  renderAdminReleaseControls();
  notify('Content & Display preview is active in this signed browser only.', '✓');
}

async function publishContentDisplay(form) {
  const payload = syncContentDisplayDraft(form);
  state.adminContentError = '';
  try {
    await api.validateContentDisplay({ payload });
    const result = await withBusy(() => api.publishContentDisplay({
      payload,
      expectedVersion: state.adminContentDisplay.configuration.rowVersion,
    }));
    state.adminContentDisplay = result;
    state.adminContentDraft = cloneContentDisplay(result.configuration.payload);
    state.presentation = cloneContentDisplay(result.configuration.payload);
    state.adminContentPreviewing = false;
    renderShell();
    renderAdminReleaseControls();
    notify('Content & Display published and audited.', '✓');
  } catch (error) {
    state.adminContentError = error.code === 'content_display_conflict'
      ? 'This configuration changed in another session. Reload before publishing.'
      : (error.message || 'Content & Display could not be published.');
    renderAdminReleaseControls();
  }
}

async function restoreContentDisplayDefaults() {
  if (!window.confirm('Restore the original StoryForge Content & Display defaults? This creates a new audited version.')) return;
  state.adminContentError = '';
  try {
    const result = await withBusy(() => api.restoreContentDisplay({
      expectedVersion: state.adminContentDisplay.configuration.rowVersion,
    }));
    state.adminContentDisplay = result;
    state.adminContentDraft = cloneContentDisplay(result.configuration.payload);
    state.presentation = cloneContentDisplay(result.configuration.payload);
    state.adminContentPreviewing = false;
    renderShell();
    renderAdminReleaseControls();
    notify('Content & Display defaults restored and audited.', '✓');
  } catch (error) {
    state.adminContentError = error.code === 'content_display_conflict'
      ? 'This configuration changed in another session. Reload before restoring defaults.'
      : (error.message || 'Defaults could not be restored.');
    renderAdminReleaseControls();
  }
}

function renderAdminReleaseControls() {
  const feature = state.adminFeatures || {};
  const flag = feature.flag || null;
  const audit = asArray(feature.audit);
  const health = state.adminHealth;
  const unavailable = !flag;
  const adminFlag = state.adminConsoleFeature?.flag || null;
  main.innerHTML = `<section data-view="settings" class="live settingsPage">
    <div class="eyebrow">Administration</div>
    <h1 class="h1">Release <em>Controls</em></h1>
    ${renderContentDisplayControls()}
    <div class="panel panel-spaced">
      <div class="pHead"><div class="h2">Administrator workspace <em>Founder pilot</em></div></div>
      <div class="pBody">
        <p class="stageHint">This independent server-side gate controls the bounded administrator review workspace. It never changes student or mentor authorization.</p>
        ${state.adminConsoleFeatureError ? `<div class="releaseError" role="alert">${esc(state.adminConsoleFeatureError)}</div>` : ''}
        ${adminFlag ? `<form id="adminConsoleFeatureForm">
          <div class="setRow">
            <label class="sTxt" for="adminConsoleScope"><b>Workspace access</b><span>Off, or allowlisted for this signed Founder administrator only.</span></label>
            <select id="adminConsoleScope" class="releaseSelect">
              <option value="off" ${adminFlag.scope === 'off' ? 'selected' : ''}>Off</option>
              <option value="allowlist" ${adminFlag.scope === 'allowlist' ? 'selected' : ''}>Founder pilot</option>
            </select>
          </div>
          <div class="setRow"><div class="sTxt"><b>Runtime kill switch</b><span>${state.capabilities?.adminConsole ? 'Open for this signed administrator' : 'Closed or not enabled'}.</span></div><button class="rowBtn pri" type="submit">Save admin workspace gate</button></div>
        </form>` : '<div class="setRow"><div class="sTxt"><b>Gate unavailable</b><span>No administrator access change can be made.</span></div></div>'}
      </div>
    </div>
    <div class="panel panel-spaced">
      <div class="pHead"><div class="h2">Voice capture <em>scope</em></div></div>
      <div class="pBody">
        <p class="stageHint">These controls change server authorization. The browser never grants access by itself, and “All eligible” remains locked pending its separate founder ruling.</p>
        ${state.adminFeatureError ? `<div class="releaseError" role="alert">${esc(state.adminFeatureError)}</div>` : ''}
        ${unavailable ? `<div class="setRow"><div class="sTxt"><b>Controls unavailable</b><span>The current feature state could not be read safely. No scope change was made.</span></div><button class="rowBtn" type="button" data-admin-release-reload>Retry</button></div>` : `
        <form id="voiceFeatureForm">
          <div class="setRow">
            <label class="sTxt" for="voiceScope"><b>Scope</b><span>Off / Allowlist / Cohort / All eligible (locked)</span></label>
            <select id="voiceScope" name="scope" class="releaseSelect">
              ${[
                ['off', 'Off'],
                ['allowlist', 'Allowlist'],
                ['cohort', 'Cohort'],
                ['eligible_all', 'All eligible (locked)'],
              ].map(([value, label]) => `<option value="${value}" ${flag.scope === value ? 'selected' : ''} ${value === 'eligible_all' ? 'disabled' : ''}>${label}</option>`).join('')}
            </select>
          </div>
          <div class="setRow releaseStack">
            <label class="sTxt" for="voiceAllowlist"><b>Allowlist</b><span>One StoryForge user UUID per line.</span></label>
            <textarea id="voiceAllowlist" name="allowlist" class="releaseTextarea" rows="5" spellcheck="false" autocomplete="off">${esc(asArray(flag.allowlist).join('\n'))}</textarea>
          </div>
          <div class="setRow releaseStack">
            <label class="sTxt" for="voiceCohorts"><b>Cohorts</b><span>One exact 360 cohort per line.</span></label>
            <textarea id="voiceCohorts" name="cohorts" class="releaseTextarea" rows="4" spellcheck="false" autocomplete="off" aria-describedby="voiceCohortError">${esc(asArray(flag.cohorts).join('\n'))}</textarea>
            <span class="releaseInlineError" id="voiceCohortError">${state.adminFeatureError === 'Not a recognized 360 cohort.' ? esc(state.adminFeatureError) : ''}</span>
          </div>
          <div class="setRow">
            <div class="sTxt"><b>Current authorization</b><span>${esc(voiceScopeLabel(flag.scope))} · last changed ${esc(formatDateTime(flag.updatedAt))}</span></div>
            <button class="rowBtn pri" type="submit">Save release controls</button>
          </div>
        </form>`}
      </div>
    </div>
    <div class="panel panel-spaced">
      <div class="pHead"><div class="h2">Voice health <em>last 24 hours</em></div></div>
      <div class="pBody">
        ${state.adminHealthError ? `<div class="releaseError" role="status">${esc(state.adminHealthError)}</div>` : ''}
        ${health ? `
          ${asArray(health.sessionsByState).length
            ? asArray(health.sessionsByState).map((item) => `<div class="setRow"><div class="sTxt"><b>${esc(item.state)}</b><span>Recording sessions</span></div><span class="rolePill">${Number(item.count || 0)}</span></div>`).join('')
            : '<div class="setRow"><div class="sTxt"><b>No sessions</b><span>No voice recording sessions were created in this window.</span></div></div>'}
          ${asArray(health.errorsByCategory).map((item) => `<div class="setRow"><div class="sTxt"><b>${esc(item.errorCategory)}</b><span>Content-free error category</span></div><span class="rolePill">${Number(item.count || 0)}</span></div>`).join('')}
        ` : '<div class="setRow"><div class="sTxt"><b>Health summary unavailable</b><span>No content or student data is exposed when the approved audit aggregation cannot run.</span></div><button class="rowBtn" type="button" data-admin-release-reload>Retry</button></div>'}
      </div>
    </div>
    <div class="panel panel-spaced">
      <div class="pHead"><div class="h2">Scope audit <em>last 20</em></div></div>
      <div class="pBody">
        ${audit.length ? audit.map((item) => {
          const previous = item.previous || {};
          const current = item.current || {};
          return `<div class="setRow"><div class="sTxt"><b>${esc(voiceScopeLabel(previous.scope))} → ${esc(voiceScopeLabel(current.scope))}</b><span>${esc(formatDateTime(item.createdAt))} · allowlist ${asArray(current.allowlist).length} · cohorts ${asArray(current.cohorts).length}</span></div></div>`;
        }).join('') : '<div class="setRow"><div class="sTxt"><b>No recorded scope changes</b><span>The append-only audit tail is empty.</span></div></div>'}
      </div>
    </div>
  </section>`;
}

async function loadAdminReleaseControls() {
  const [features, health, adminConsole, contentDisplay] = await Promise.allSettled([
    api.adminFeatures(),
    api.adminVoiceHealth(),
    api.adminConsoleFlag(),
    api.adminContentDisplay(),
  ]);
  if (features.status === 'fulfilled') {
    state.adminFeatures = features.value;
    state.adminFeatureError = '';
  } else {
    state.adminFeatures = null;
    state.adminFeatureError = features.reason?.code === 'audit_writer_unavailable'
      ? 'Release controls are unavailable because required audit authorization is not configured.'
      : (features.reason?.message || 'Release controls are temporarily unavailable.');
  }
  if (health.status === 'fulfilled') {
    state.adminHealth = health.value;
    state.adminHealthError = '';
  } else {
    state.adminHealth = null;
    state.adminHealthError = health.reason?.code === 'voice_health_audit_unavailable'
      ? 'Error-category health remains locked until the approved content-free audit query is supplied.'
      : (health.reason?.message || 'Voice health is temporarily unavailable.');
  }
  if (adminConsole.status === 'fulfilled') {
    state.adminConsoleFeature = adminConsole.value;
    state.adminConsoleFeatureError = '';
  } else {
    state.adminConsoleFeature = null;
    state.adminConsoleFeatureError = adminConsole.reason?.message || 'Administrator workspace controls are unavailable.';
  }
  if (contentDisplay.status === 'fulfilled') {
    state.adminContentDisplay = contentDisplay.value;
    if (!state.adminContentPreviewing) {
      state.adminContentDraft = cloneContentDisplay(contentDisplay.value?.configuration?.payload || BUNDLED_PRESENTATION);
      state.presentation = cloneContentDisplay(contentDisplay.value?.configuration?.payload || BUNDLED_PRESENTATION);
    }
    state.adminContentError = '';
  } else {
    state.adminContentDisplay = null;
    state.adminContentError = contentDisplay.reason?.message || 'Content & Display is temporarily unavailable.';
  }
}

async function saveAdminConsoleReleaseControl(form) {
  const scope = $('#adminConsoleScope', form)?.value || 'off';
  state.adminConsoleFeatureError = '';
  try {
    const result = await withBusy(() => api.updateAdminConsoleFlag({
      scope,
      allowlist: scope === 'allowlist' ? [state.user.id] : [],
    }));
    state.adminConsoleFeature = result;
    const session = await api.session();
    state.capabilities = Object.freeze({
      ...state.capabilities,
      voiceCapture: Boolean(session?.capabilities?.voiceCapture),
      adminConsole: Boolean(session?.capabilities?.adminConsole),
      inspirationAdmin: Boolean(session?.capabilities?.inspirationAdmin),
      adminDirectory: Boolean(session?.capabilities?.adminDirectory),
      reviewCheck: Boolean(session?.capabilities?.reviewCheck),
      adminReviewControls: Boolean(session?.capabilities?.adminReviewControls),
    });
    await loadAdminReleaseControls();
    renderShell();
    renderAdminReleaseControls();
    notify(`Administrator workspace ${scope === 'allowlist' ? 'enabled for this Founder account' : 'disabled'}.`, '✓');
  } catch (error) {
    state.adminConsoleFeatureError = error.message || 'Administrator workspace gate could not be saved.';
    renderAdminReleaseControls();
  }
}

async function saveAdminReleaseControls(form) {
  const lines = (value) => String(value || '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  const scope = $('#voiceScope', form)?.value || 'off';
  const allowlist = lines($('#voiceAllowlist', form)?.value);
  const cohorts = lines($('#voiceCohorts', form)?.value);
  state.adminFeatureError = '';
  try {
    const result = await withBusy(() => api.updateVoiceFeature({ scope, allowlist, cohorts }));
    if (!result) return;
    state.adminFeatures = {
      ...(state.adminFeatures || {}),
      flag: result.flag,
    };
    await loadAdminReleaseControls();
    renderAdminReleaseControls();
    notify(`Voice capture scope saved: ${voiceScopeLabel(result.flag?.scope)}.`, '✓');
  } catch (error) {
    state.adminFeatureError = error.code === 'invalid_voice_cohort'
      ? 'Not a recognized 360 cohort.'
      : error.code === 'eligible_all_locked'
        ? 'All-eligible activation requires a separate founder ruling.'
        : error.code === 'audit_writer_unavailable'
          ? 'Release controls cannot save safely because required audit logging is unavailable.'
          : (error.message || 'Release controls could not be saved.');
    renderAdminReleaseControls();
  }
}

let captureDraftSavePromise = Promise.resolve();

const MIC_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 15a4 4 0 0 0 4-4V6a4 4 0 1 0-8 0v5a4 4 0 0 0 4 4zm6-4a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.94V22h2v-3.06A8 8 0 0 0 20 11h-2z"/></svg>';
const VOICE_ERROR_COPY = Object.freeze({
  micDenied: 'Microphone access was not available. You can allow it in your browser settings, or just keep typing.',
  reconnecting: 'Connection hiccup. Your recording is safe on this device. Reconnecting…',
  transcribeUnavailable: "We can't transcribe right now. Your recording is saved. Keep talking, or try transcription again from review.",
  deviceFailure: "Recording can't continue on this device right now. Everything you said so far is safe. Typing always works.",
  voiceDisabled: 'Voice capture is currently unavailable. Every word so far is kept in your draft. You can keep typing.',
  dailyLimit: "You've reached today's recording limit. Everything you captured is saved, and typing is always available. Recording returns tomorrow.",
  lengthLimit: 'This recording reached its length limit and was stopped. Everything you said is captured below.',
  attachFailed: "We couldn't attach your audio this time. Every word is safe in your story text. You can save your story now, and you can record again anytime.",
});

function voiceTime(milliseconds) {
  const seconds = Math.max(0, Math.floor(Number(milliseconds || 0) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function mergeVoiceTranscript(current, chunk) {
  const incoming = String(chunk || '').trim();
  if (!incoming) return String(current || '');
  const value = String(current || '');
  const normalize = (text) => text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const tail = value.split(/\s+/).slice(-30);
  const words = incoming.split(/\s+/);
  let drop = 0;
  for (let count = Math.min(tail.length, words.length); count > 0; count -= 1) {
    if (normalize(tail.slice(-count).join(' ')) === normalize(words.slice(0, count).join(' '))) {
      drop = count;
      break;
    }
  }
  const remainder = words.slice(drop).join(' ');
  if (!remainder) return value;
  return value
    ? `${value}${/\s$/.test(value) ? '' : ' '}${remainder}`
    : remainder;
}

function normalizeVoiceSpans(spans, textLength) {
  const limit = Math.max(0, Number(textLength || 0));
  const normalized = asArray(spans)
    .map((span) => {
      const start = Math.max(0, Math.min(limit, Number(firstDefined(span?.start, span?.[0], 0))));
      const end = Math.max(start, Math.min(limit, Number(firstDefined(span?.end, span?.[1], 0))));
      return Number.isFinite(start) && Number.isFinite(end) && end > start
        ? { start, end }
        : null;
    })
    .filter(Boolean)
    .sort((left, right) => left.start - right.start || left.end - right.end);
  return normalized.reduce((result, span) => {
    const previous = result.at(-1);
    if (previous && span.start <= previous.end) {
      previous.end = Math.max(previous.end, span.end);
    } else {
      result.push({ ...span });
    }
    return result;
  }, []);
}

function voiceTextFromSpans(text, spans) {
  const value = String(text || '');
  return normalizeVoiceSpans(spans, value.length)
    .map((span) => value.slice(span.start, span.end).trim())
    .filter(Boolean)
    .join(' ');
}

function voiceTermKey(term) {
  const item = normalizedFlaggedTerm(term);
  return item ? JSON.stringify([item.from, item.to]) : '';
}

function trackVoiceTextEdit(nextValue) {
  const next = String(nextValue || '');
  const previous = String(voiceState.trackedText || '');
  const pendingEdit = voiceState.pendingEdit;
  voiceState.pendingEdit = null;
  if (previous === next) return;
  let prefix;
  let replacedEnd;
  let insertedEnd;
  const hasPreciseEdit = (
    pendingEdit
    && pendingEdit.previous === previous
    && Number.isInteger(pendingEdit.start)
    && Number.isInteger(pendingEdit.end)
    && pendingEdit.start >= 0
    && pendingEdit.end >= pendingEdit.start
    && pendingEdit.end <= previous.length
    && (
      pendingEdit.end > pendingEdit.start
      || String(pendingEdit.inputType || '').startsWith('insert')
    )
  );
  if (hasPreciseEdit) {
    prefix = pendingEdit.start;
    replacedEnd = pendingEdit.end;
    insertedEnd = prefix + Math.max(
      0,
      next.length - (previous.length - (replacedEnd - prefix)),
    );
  } else {
    prefix = 0;
    while (
      prefix < previous.length
      && prefix < next.length
      && previous[prefix] === next[prefix]
    ) {
      prefix += 1;
    }
    let suffix = 0;
    while (
      suffix < previous.length - prefix
      && suffix < next.length - prefix
      && previous[previous.length - suffix - 1] === next[next.length - suffix - 1]
    ) {
      suffix += 1;
    }
    replacedEnd = previous.length - suffix;
    insertedEnd = next.length - suffix;
  }
  const delta = (insertedEnd - prefix) - (replacedEnd - prefix);
  const adjusted = [];
  voiceState.voiceSpans.forEach((span) => {
    if (span.end <= prefix) {
      adjusted.push({ ...span });
      return;
    }
    if (span.start >= replacedEnd) {
      adjusted.push({ start: span.start + delta, end: span.end + delta });
      return;
    }
    if (span.start < prefix) {
      adjusted.push({ start: span.start, end: prefix });
    }
    if (span.end > replacedEnd) {
      adjusted.push({
        start: insertedEnd,
        end: span.end + delta,
      });
    }
  });
  voiceState.voiceSpans = normalizeVoiceSpans(adjusted, next.length);
  voiceState.trackedText = next;
}

function appendVoiceText(body, text) {
  const incoming = String(text || '');
  if (!incoming) return false;
  const separator = body.value && !/\s$/.test(body.value) && !/^\s/.test(incoming)
    ? ' '
    : '';
  const start = body.value.length;
  body.value = `${body.value}${separator}${incoming}`;
  voiceState.voiceSpans = normalizeVoiceSpans(
    [...voiceState.voiceSpans, { start, end: body.value.length }],
    body.value.length,
  );
  voiceState.trackedText = body.value;
  voiceState.pendingEdit = null;
  return true;
}

function findVoiceTermIndex(text, term) {
  const value = String(text || '');
  const needle = String(term || '');
  if (!needle) return -1;
  let index = value.indexOf(needle);
  while (index >= 0) {
    const end = index + needle.length;
    if (voiceState.voiceSpans.some((span) => index >= span.start && end <= span.end)) {
      return index;
    }
    index = value.indexOf(needle, index + 1);
  }
  return -1;
}

function replaceVoiceText(body, from, to) {
  const start = findVoiceTermIndex(body.value, from);
  if (start < 0) return false;
  const end = start + from.length;
  const delta = to.length - from.length;
  body.value = `${body.value.slice(0, start)}${to}${body.value.slice(end)}`;
  voiceState.voiceSpans = normalizeVoiceSpans(
    voiceState.voiceSpans.map((span) => {
      if (span.end <= start) return { ...span };
      if (span.start >= end) {
        return { start: span.start + delta, end: span.end + delta };
      }
      return { start: span.start, end: span.end + delta };
    }),
    body.value.length,
  );
  voiceState.trackedText = body.value;
  voiceState.pendingEdit = null;
  return true;
}

function removeVoiceText(text, spans) {
  let result = String(text || '');
  normalizeVoiceSpans(spans, result.length)
    .slice()
    .reverse()
    .forEach((span) => {
      result = `${result.slice(0, span.start)}${result.slice(span.end)}`;
    });
  return result;
}

function newVoiceState(saved = {}) {
  const savedVoice = saved.voice && typeof saved.voice === 'object' && !Array.isArray(saved.voice)
    ? saved.voice
    : {};
  const recordingId = String(savedVoice.recordingId || saved.recordingId || '');
  const savedText = String(saved.text || '');
  const anchor = Math.max(0, Math.min(
    savedText.length,
    Number(firstDefined(savedVoice.anchorLen, savedVoice.anchor, saved.voiceAnchor, 0)),
  ));
  const suppliedSpans = asArray(firstDefined(savedVoice.spans, saved.voiceSpans));
  const voiceSpans = normalizeVoiceSpans(
    suppliedSpans.length
      ? suppliedSpans
      : (recordingId && savedText.length > anchor ? [{ start: anchor, end: savedText.length }] : []),
    savedText.length,
  );
  return {
    recordingId,
    studentId: String(savedVoice.studentId || saved.voiceStudentId || state.user?.id || ''),
    mode: recordingId ? 'review' : 'idle',
    segmentPlanMs: VOICE_SEGMENT_PLAN.slice(),
    nextSegmentSeq: Math.max(0, Number(savedVoice.nextSegmentSeq || saved.nextSegmentSeq || 0)),
    durationMs: Math.max(
      0,
      Number(firstDefined(savedVoice.durationMs, Number(savedVoice.recT || 0) * 1000, saved.voiceDurationMs, 0)),
    ),
    anchor,
    voiceSpans,
    trackedText: savedText,
    pendingEdit: null,
    transcriptText: String(
      savedVoice.transcriptText
      || saved.voiceTranscriptText
      || voiceTextFromSpans(savedText, voiceSpans),
    ),
    recorder: null,
    stream: null,
    segmentStartedAt: 0,
    segmentTimeout: 0,
    clockTimer: 0,
    pollTimer: 0,
    uploadQueue: Promise.resolve(),
    closePromise: null,
    appliedSegments: new Set(
      asArray(firstDefined(savedVoice.appliedSegments, saved.appliedVoiceSegments)).map(Number),
    ),
    flaggedTerms: [],
    dismissedTerms: new Set(
      asArray(firstDefined(savedVoice.dismissedTerms, saved.dismissedVoiceTerms)).map(String),
    ),
    autoPaused: false,
    wakeLock: null,
    visibilityHandler: null,
    error: '',
    limitReached: false,
  };
}

let voiceState = newVoiceState();

function captureDraftPayload() {
  if (!capture.classList.contains('open')) return null;
  const payload = {
    title: $('#capTitle')?.value || '',
    text: $('#capBody')?.value || '',
    lesson: $('#capLesson')?.value || '',
    prompt: state.capturePrompt || '',
    prefixEnabled: capture.dataset.prefixEnabled !== 'false',
    themes: JSON.parse(capture.dataset.themes || '[]'),
    studentScore: Number(capture.dataset.score || 0) || null,
  };
  if (state.captureTypedOnlyFromAudio) {
    payload.typedOnlyFromAudio = true;
  }
  if (voiceState.recordingId) {
    Object.assign(payload, {
      voice: {
        recordingId: voiceState.recordingId,
        recT: Math.round(voiceState.durationMs / 1000),
        ghost: '',
        anchorLen: voiceState.anchor,
        studentId: voiceState.studentId,
        nextSegmentSeq: voiceState.nextSegmentSeq,
        durationMs: voiceState.durationMs,
        spans: voiceState.voiceSpans.map((span) => ({ ...span })),
        transcriptText: voiceState.transcriptText,
        appliedSegments: [...voiceState.appliedSegments],
        dismissedTerms: [...voiceState.dismissedTerms],
      },
    });
  }
  return payload;
}

function setCaptureDraftStatus(message) {
  const status = $('#captureDraftStatus');
  if (status) status.textContent = message;
}

function persistCaptureDraft(payload) {
  captureDraftSavePromise = captureDraftSavePromise
    .catch(() => {})
    .then(async () => {
      setCaptureDraftStatus('Saving draft to your account…');
      const result = await api.saveStoryDraft(payload, state.captureDraftVersion);
      const draft = result?.draft || result;
      state.captureDraftVersion = Number(firstDefined(draft?.row_version, draft?.rowVersion, 0));
      setCaptureDraftStatus('Draft saved to your account.');
      return draft;
    })
    .catch((error) => {
      setCaptureDraftStatus(
        error.status === 409
          ? 'This draft changed in another session. Close and reopen to restore the newest copy.'
          : 'Draft autosave is temporarily unavailable.',
      );
      throw error;
    });
  return captureDraftSavePromise;
}

function scheduleCaptureDraftSave() {
  const payload = captureDraftPayload();
  if (!payload) return;
  window.clearTimeout(state.captureDraftSaveTimer);
  state.captureDraftSaveTimer = window.setTimeout(() => {
    state.captureDraftSaveTimer = 0;
    void persistCaptureDraft(payload).catch(() => {});
  }, 600);
  setCaptureDraftStatus('Draft changes waiting to save…');
}

async function openCapture({
  title = '',
  prompt = '',
  voice = false,
  pairQuestionId = null,
} = {}) {
  if (!isStudent()) {
    notify('Capture belongs to the student. This signed role cannot create a student story.');
    return;
  }
  let durableDraft = null;
  try {
    const result = await api.storyDraft();
    durableDraft = result?.draft || null;
  } catch (error) {
    notify(error.message || 'Your saved capture draft could not be restored.');
  }
  const saved = durableDraft?.payload && typeof durableDraft.payload === 'object'
    ? durableDraft.payload
    : {};
  const restored = Boolean(
    String(saved.title || '').trim()
    || String(saved.text || '').trim()
    || String(saved.lesson || '').trim()
    || asArray(saved.themes).length
    || Number(saved.studentScore || 0)
    || String(saved.voice?.recordingId || saved.recordingId || '').trim(),
  );
  title = String(saved.title || title || '');
  prompt = String(saved.prompt || prompt || '');
  const text = String(saved.text || '');
  const lesson = String(saved.lesson || '');
  const themes = asArray(saved.themes).map(String).filter((id) => THEMES.some((theme) => theme.id === id));
  const studentScore = Math.max(0, Math.min(5, Number(saved.studentScore || 0)));
  const prefixEnabled = saved.prefixEnabled !== false;
  const voiceEnabled = Boolean(state.capabilities?.voiceCapture);
  const recoveredVoice = Boolean(saved.voice?.recordingId || saved.recordingId);
  state.captureTypedOnlyFromAudio = saved.typedOnlyFromAudio === true;
  const recoveredWordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  voiceState = newVoiceState(recoveredVoice ? saved : {});
  if (recoveredVoice && !voiceEnabled) {
    voiceState.mode = 'error';
    voiceState.error = VOICE_ERROR_COPY.voiceDisabled;
  }
  state.captureDraftVersion = durableDraft
    ? Number(firstDefined(durableDraft.row_version, durableDraft.rowVersion, 0))
    : null;
  state.returnFocus = document.activeElement;
  state.capturePrompt = prompt;
  state.capturePairQuestionId = pairQuestionId ? String(pairQuestionId) : null;
  state.captureRecovering = recoveredVoice;
  capture.innerHTML = `<form class="capSheet" id="captureForm" role="dialog" aria-modal="true" aria-labelledby="captureDialogTitle">
    <button class="capClose" type="button" data-close-overlay aria-label="Close Quick Capture">✕</button>
    <div class="capKicker" id="captureDialogTitle">＋ New story — Save it before it fades</div>
    ${prompt ? `<div class="capHint">Prompt: “${esc(prompt)}”</div>` : ''}
    ${recoveredVoice ? `<div class="voxRecover">✓ <b>Recovered after an interruption.</b> Everything is safe — ${voiceState.durationMs ? `${voiceTime(voiceState.durationMs)} of dictation and ` : ''}${recoveredWordCount} word${recoveredWordCount === 1 ? '' : 's'} were kept. Pick up where you left off.</div>` : ''}
    <div class="capTitleRow">
      <button class="capPre" type="button" id="capturePrefix" aria-pressed="true">The One Where</button>
      <input id="capTitle" name="title" placeholder="…what happened?" autocomplete="off" value="${attr(title)}" required>
    </div>
    <div class="capHint">Name it the way you’d bring it up with a friend. If the title makes you smile or wince, it’s right.</div>
    <div class="capTellWrap">
      <textarea class="capField" id="capBody" name="text" placeholder="${voiceEnabled ? 'Tell it like you’d tell a trusted person — type it, or tap Speak below and StoryForge types while you talk.' : 'Tell it like you’d tell a trusted friend. Don’t polish it — just get it down.'}">${esc(text)}</textarea>
    </div>
    ${voiceEnabled ? '<div class="voxDock idle" id="voxDock"></div>' : (recoveredVoice ? `<div class="voxDock error"><div class="voxState voiceError">${esc(VOICE_ERROR_COPY.voiceDisabled)}</div></div>` : '')}
    <div class="capMore open">
      <div class="capMoreBody">
        <label class="fLbl" for="capLesson">What did this story teach you?</label>
        <textarea class="capField" id="capLesson" name="lesson" placeholder="One or two honest sentences.">${esc(lesson)}</textarea>
        <div class="fLbl">Themes</div>
        <div class="classChips">${THEMES.map((theme) => `<button class="cChip tone-${theme.id} ${themes.includes(theme.id) ? 'on' : ''}" type="button" data-capture-theme="${theme.id}">${esc(theme.label)}</button>`).join('')}</div>
        <div class="fLbl">How much does this story matter to you?</div>
        ${scorePicker('capture', studentScore)}
      </div>
    </div>
    <div class="capActions">
      <button class="btnSave" type="submit">Save story</button>
      <span class="capNote" id="captureDraftStatus">${restored ? 'Draft restored from your account.' : 'Draft changes save to your account as you type.'}</span>
      <span class="privNote">🔒 Only you can see it</span>
    </div>
  </form>`;
  capture.classList.add('open');
  setMotionEnergy('active');
  capture.dataset.prefixEnabled = String(prefixEnabled);
  capture.dataset.score = String(studentScore);
  capture.dataset.themes = JSON.stringify(themes);
  capture.dataset.audioRequested = voice ? 'true' : 'false';
  $('#capturePrefix')?.classList.toggle('off', !prefixEnabled);
  $('#capturePrefix')?.setAttribute('aria-pressed', String(prefixEnabled));
  recordedBlob = null;
  recordedDurationMs = 0;
  if (voiceEnabled) {
    renderVoiceDock(voiceState.mode);
    if (recoveredVoice) {
      startVoicePolling();
      void pollVoiceRecording();
    } else if (voice) {
      window.setTimeout(() => {
        void voiceStart();
      }, 350);
    }
  }
  $('#capTitle')?.focus({ preventScroll: true });
}

function closeOverlay(node) {
  if (!node) return;
  if (node === room || node === quick) stopAudioPlayback();
  if (node === capture) {
    const pendingDraft = state.captureDraftSaveTimer ? captureDraftPayload() : null;
    window.clearTimeout(state.captureDraftSaveTimer);
    state.captureDraftSaveTimer = 0;
    if (voiceState.recordingId) {
      void voicePause(true);
      stopVoicePolling();
      releaseVoiceWakeLock();
      if (voiceState.visibilityHandler) {
        document.removeEventListener('visibilitychange', voiceState.visibilityHandler);
        voiceState.visibilityHandler = null;
      }
    } else {
      stopRecording();
    }
    if (pendingDraft && !state.captureDraftSuppressCloseSave) {
      void persistCaptureDraft(pendingDraft).catch(() => {});
    }
    state.captureDraftSuppressCloseSave = false;
    state.captureRecovering = false;
    setMotionEnergy('low');
  }
  node.classList.remove('open');
  node.innerHTML = '';
  if (node === room) {
    state.storyDetail = null;
    state.storyCompletionIntent = null;
  }
  if (node === quick) state.quick = null;
  if (node === qad) state.assign = null;
  const focus = state.returnFocus;
  state.returnFocus = null;
  if (focus?.isConnected) focus.focus({ preventScroll: true });
}

/* ========================= V5.5 Phase 1 voice capture ========================= */

const voiceMemorySegments = new Map();
let voiceDatabasePromise = null;
const VOICE_LOCAL_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function voiceSegmentKey(recordingId, seq) {
  return `${voiceState.studentId || state.user?.id || 'unknown'}:${recordingId}:${seq}`;
}

function openVoiceDatabase() {
  if (!('indexedDB' in window)) {
    return Promise.reject(new Error('Private local recording storage is unavailable.'));
  }
  if (!voiceDatabasePromise) {
    voiceDatabasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('storyforge-voice-segments-v1', 1);
      request.addEventListener('upgradeneeded', () => {
        if (!request.result.objectStoreNames.contains('segments')) {
          request.result.createObjectStore('segments', { keyPath: 'key' });
        }
      });
      request.addEventListener('success', () => {
        const database = request.result;
        void purgeExpiredVoiceSegments(database).catch(() => {});
        resolve(database);
      });
      request.addEventListener('error', () => reject(request.error || new Error('Private local recording storage is unavailable.')));
      request.addEventListener('blocked', () => reject(new Error('Private local recording storage is unavailable.')));
    });
  }
  return voiceDatabasePromise;
}

async function storeVoiceSegment(record) {
  const keyed = {
    ...record,
    key: voiceSegmentKey(record.recordingId, record.seq),
    createdAt: Number(record.createdAt) || Date.now(),
  };
  voiceMemorySegments.set(keyed.key, keyed);
  const database = await openVoiceDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction('segments', 'readwrite');
    transaction.objectStore('segments').put(keyed);
    transaction.addEventListener('complete', resolve);
    transaction.addEventListener('error', () => reject(transaction.error));
    transaction.addEventListener('abort', () => reject(transaction.error));
  });
}

async function purgeExpiredVoiceSegments(database, currentTime = Date.now()) {
  const expiresBefore = currentTime - VOICE_LOCAL_RETENTION_MS;
  for (const [key, record] of voiceMemorySegments) {
    if (!Number.isFinite(Number(record.createdAt)) || Number(record.createdAt) < expiresBefore) {
      voiceMemorySegments.delete(key);
    }
  }
  const stored = await new Promise((resolve, reject) => {
    const transaction = database.transaction('segments', 'readonly');
    const request = transaction.objectStore('segments').getAll();
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error));
  });
  const expiredKeys = stored
    .filter((record) => (
      !Number.isFinite(Number(record.createdAt))
      || Number(record.createdAt) < expiresBefore
    ))
    .map((record) => record.key);
  if (!expiredKeys.length) return 0;
  await new Promise((resolve, reject) => {
    const transaction = database.transaction('segments', 'readwrite');
    const objectStore = transaction.objectStore('segments');
    expiredKeys.forEach((key) => objectStore.delete(key));
    transaction.addEventListener('complete', resolve);
    transaction.addEventListener('error', () => reject(transaction.error));
    transaction.addEventListener('abort', () => reject(transaction.error));
  });
  return expiredKeys.length;
}

async function removeVoiceSegment(recordingId, seq) {
  const key = voiceSegmentKey(recordingId, seq);
  voiceMemorySegments.delete(key);
  const database = await openVoiceDatabase().catch(() => null);
  if (!database) return;
  await new Promise((resolve, reject) => {
    const transaction = database.transaction('segments', 'readwrite');
    transaction.objectStore('segments').delete(key);
    transaction.addEventListener('complete', resolve);
    transaction.addEventListener('error', () => reject(transaction.error));
    transaction.addEventListener('abort', () => reject(transaction.error));
  });
}

async function pendingVoiceSegments(recordingId) {
  const prefix = `${voiceState.studentId || state.user?.id || 'unknown'}:${recordingId}:`;
  const records = [...voiceMemorySegments.values()].filter((item) => item.key.startsWith(prefix));
  const database = await openVoiceDatabase().catch(() => null);
  if (database) {
    await purgeExpiredVoiceSegments(database).catch(() => {});
    const stored = await new Promise((resolve, reject) => {
      const transaction = database.transaction('segments', 'readonly');
      const request = transaction.objectStore('segments').getAll();
      request.addEventListener('success', () => resolve(request.result));
      request.addEventListener('error', () => reject(request.error));
    });
    stored.filter((item) => item.key.startsWith(prefix)).forEach((item) => {
      if (!records.some((existing) => existing.key === item.key)) records.push(item);
    });
  }
  return records.sort((left, right) => left.seq - right.seq);
}

async function clearVoiceSegments(recordingId) {
  const records = await pendingVoiceSegments(recordingId);
  await Promise.all(records.map((record) => removeVoiceSegment(recordingId, record.seq)));
}

function supportedVoiceMimeType() {
  if (!window.MediaRecorder) return '';
  const types = [
    'audio/webm;codecs=opus',
    'audio/mp4',
    'audio/webm',
    'audio/ogg',
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function voiceFileName(seq, mimeType) {
  const extension = mimeType.includes('mp4')
    ? 'm4a'
    : mimeType.includes('ogg')
      ? 'ogg'
      : 'webm';
  return `seg-${String(seq).padStart(5, '0')}.${extension}`;
}

function normalizedFlaggedTerm(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const from = String(firstDefined(raw.from, raw.term, raw.text, raw.original, '')).trim();
  const to = String(firstDefined(raw.to, raw.suggestion, raw.replacement, raw.expected, '')).trim();
  return from && to && from !== to ? { from, to } : null;
}

function voiceFlags() {
  const seen = new Set();
  const body = $('#capBody');
  return voiceState.flaggedTerms.filter((raw) => {
    const item = normalizedFlaggedTerm(raw);
    if (!item) return false;
    const key = voiceTermKey(item);
    if (
      seen.has(key)
      || voiceState.dismissedTerms.has(key)
      || !body
      || findVoiceTermIndex(body.value, item.from) < 0
    ) {
      return false;
    }
    seen.add(key);
    return true;
  }).map(normalizedFlaggedTerm);
}

function renderVoiceDock(mode = voiceState.mode) {
  const dock = $('#voxDock');
  if (!dock) return;
  voiceState.mode = mode;
  setMotionEnergy(mode === 'rec' || mode === 'arming' ? 'recording' : mode === 'review' ? 'success' : 'active');
  dock.className = `voxDock ${mode}`;
  const body = $('#capBody');
  const title = $('#capTitle');
  if (mode === 'idle') {
    const supported = Boolean(
      navigator.mediaDevices?.getUserMedia
      && window.MediaRecorder
      && supportedVoiceMimeType(),
    );
    dock.innerHTML = `<div class="voxRow">
      <button class="voxMain" type="button" data-voice-start aria-label="Start voice recording" ${supported ? '' : 'disabled'}><span class="rdot"></span>${MIC_SVG} Speak it — StoryForge types while you talk</button>
      <span class="voxState" role="status" aria-live="polite">${supported ? 'Typing always works too. You can do both in the same story.' : VOICE_ERROR_COPY.deviceFailure}</span>
    </div>`;
    return;
  }
  if (mode === 'arming') {
    dock.innerHTML = `<div class="voxRow">
      <span class="voxTimer"><span class="rdot"></span>0:00</span>
      <span class="voxState" role="status" aria-live="polite">Getting your microphone ready…</span>
    </div>`;
    return;
  }
  if (mode === 'rec' || mode === 'paused') {
    const paused = mode === 'paused';
    const remainingMs = Math.max(0, VOICE_MAX_DURATION_SECONDS * 1000 - voiceState.durationMs);
    const nearingLimit = remainingMs <= 2 * 60 * 1000;
    dock.innerHTML = `<div class="voxRow">
      <span class="voxTimer" id="voxTime" aria-label="Recorded time">${paused ? '❚❚ ' : ''}<span class="rdot"></span>${voiceTime(voiceState.durationMs)}</span>
      <div class="voxWave" aria-hidden="true">${Array.from({ length: 13 }, (_, index) => `<i style="animation-delay:${index * 0.07}s"></i>`).join('')}</div>
      ${paused
        ? '<button class="voxBtn" type="button" data-voice-resume aria-label="Resume voice recording">▶ Resume</button>'
        : '<button class="voxBtn" type="button" data-voice-pause aria-label="Pause voice recording">❚❚ Pause</button>'}
      <button class="voxBtn done" type="button" data-voice-done aria-label="Finish voice recording">✓ Done</button>
      <button class="voxBtn warn" type="button" data-voice-discard aria-label="Discard voice recording">✕ Discard</button>
    </div>
    <div class="voxGhost" id="voxGhost">${esc(voiceState.error === VOICE_ERROR_COPY.transcribeUnavailable ? 'Transcription will retry when available.' : '')}</div>
    <div class="voxState" role="status" aria-live="polite">${paused
      ? `<b>Paused${voiceState.autoPaused ? ' automatically when you switched away' : ''} — nothing lost.</b> Resume when you’re ready, or press Done to review.`
      : '<b>Listening.</b> Your words appear in the story above as you talk — pause any time, edit anything after.'}${nearingLimit ? ` <b>${voiceTime(remainingMs)} remaining.</b>` : ''}</div>`;
    return;
  }
  if (mode === 'error') {
    dock.innerHTML = `<div class="voxRow">
      <span class="voxState voiceError" role="status" aria-live="polite">${esc(voiceState.error || VOICE_ERROR_COPY.deviceFailure)}</span>
      ${voiceState.recordingId && voiceState.error === VOICE_ERROR_COPY.transcribeUnavailable
        ? '<button class="voxBtn" type="button" data-voice-retry aria-label="Retry transcription">Retry transcription</button>'
        : ''}
      ${voiceState.recordingId && voiceState.error === VOICE_ERROR_COPY.reconnecting
        ? '<button class="voxBtn" type="button" data-voice-retry-upload aria-label="Retry voice upload">Retry upload</button>'
        : ''}
      ${voiceState.recordingId ? '<button class="voxBtn done" type="button" data-voice-review aria-label="Review captured transcript">Review what was captured</button>' : ''}
    </div>`;
    return;
  }
  const flags = voiceFlags();
  dock.innerHTML = `<div class="voxRow">
    <span class="voxTimer" style="color:var(--gn)">✓ ${voiceTime(voiceState.durationMs)}</span>
    <span class="voxState" style="flex:1;min-width:180px" role="status" aria-live="polite"><b>Captured.</b> The transcript above is yours — read it once, fix anything, then save.${title?.value.trim() ? '' : ' <b>Name it above to save.</b>'}</span>
    <button class="voxBtn" type="button" data-voice-more aria-label="Record more by voice">${MIC_SVG} Record more</button>
    <button class="voxBtn warn" type="button" data-voice-discard aria-label="Discard this recording">✕ Discard this recording</button>
  </div>
  ${voiceState.error ? `<div class="voxState voiceError" role="status" aria-live="polite">${esc(voiceState.error)}
    ${voiceState.error === VOICE_ERROR_COPY.transcribeUnavailable ? '<button class="rowBtn" type="button" data-voice-retry aria-label="Retry transcription">Retry transcription</button>' : ''}
    ${voiceState.error === VOICE_ERROR_COPY.reconnecting ? '<button class="rowBtn" type="button" data-voice-retry-upload aria-label="Retry voice upload">Retry upload</button>' : ''}
  </div>` : ''}
  ${flags.length ? `<div class="voxChips" id="voxChips"><span class="ckLbl">Transcript check</span>
    ${flags.map((flag, index) => `<button class="voxChip" type="button" data-voice-fix="${index}" title="Tap to correct">“${esc(flag.from)}” → <b>${esc(flag.to)}</b></button>`).join('')}
    ${flags.length > 1 ? `<button class="voxFixAll" type="button" data-voice-fix-all>Fix all ${flags.length}</button>` : ''}
    <span style="font-size:10.5px;color:var(--dim)">Terms the transcription wasn’t sure about — you decide.</span>
  </div>` : ''}`;
  if (body) body.scrollTop = body.scrollHeight;
}

function updateVoiceClock() {
  const currentMs = voiceState.segmentStartedAt
    ? Date.now() - voiceState.segmentStartedAt
    : 0;
  const elapsed = voiceState.durationMs + currentMs;
  const timer = $('#voxTime');
  const display = voiceTime(elapsed);
  if (timer && timer.dataset.display !== display) {
    timer.dataset.display = display;
    timer.innerHTML = `<span class="rdot"></span>${display}`;
  }
  if (elapsed >= VOICE_MAX_DURATION_SECONDS * 1000 && !voiceState.limitReached) {
    voiceState.limitReached = true;
    void voiceDone({ limitReached: true });
  }
}

async function requestVoiceWakeLock() {
  if (!navigator.wakeLock?.request || document.hidden) return;
  try {
    voiceState.wakeLock = await navigator.wakeLock.request('screen');
  } catch {
    voiceState.wakeLock = null;
  }
}

function releaseVoiceWakeLock() {
  const lock = voiceState.wakeLock;
  voiceState.wakeLock = null;
  if (lock) void lock.release().catch(() => {});
}

function cleanupVoiceMedia() {
  window.clearTimeout(voiceState.segmentTimeout);
  window.clearInterval(voiceState.clockTimer);
  voiceState.segmentTimeout = 0;
  voiceState.clockTimer = 0;
  voiceState.segmentStartedAt = 0;
  voiceState.stream?.getTracks().forEach((track) => track.stop());
  voiceState.stream = null;
  voiceState.recorder = null;
  releaseVoiceWakeLock();
}

function stopVoicePolling() {
  window.clearInterval(voiceState.pollTimer);
  voiceState.pollTimer = 0;
}

function suspendVoiceForIdentityExit() {
  void cancelPurposefulVersionVoice();
  stopVoicePolling();
  releaseVoiceWakeLock();
  if (voiceState.visibilityHandler) {
    document.removeEventListener('visibilitychange', voiceState.visibilityHandler);
    voiceState.visibilityHandler = null;
  }
  if (['rec', 'arming'].includes(voiceState.mode)) {
    void voicePause(true).catch(() => cleanupVoiceMedia());
  } else {
    cleanupVoiceMedia();
  }
}

function startVoicePolling() {
  if (!voiceState.recordingId || voiceState.pollTimer) return;
  voiceState.pollTimer = window.setInterval(() => {
    void pollVoiceRecording();
  }, 2000);
}

function applyVoiceTranscript(chunk) {
  const body = $('#capBody');
  if (!body) return false;
  const previousTranscript = voiceState.transcriptText;
  const mergedTranscript = mergeVoiceTranscript(previousTranscript, chunk);
  if (mergedTranscript === previousTranscript) return false;
  const appended = mergedTranscript.slice(previousTranscript.length);
  voiceState.transcriptText = mergedTranscript;
  if (!appendVoiceText(body, appended)) return false;
  body.scrollTop = body.scrollHeight;
  scheduleCaptureDraftSave();
  return true;
}

async function pollVoiceRecording() {
  if (!voiceState.recordingId) return;
  try {
    const payload = await api.recording(voiceState.recordingId);
    const recording = payload?.recording || payload;
    const segments = asArray(firstDefined(recording?.segments, payload?.segments))
      .slice()
      .sort((left, right) => Number(firstDefined(left.seq, left.sequence, 0)) - Number(firstDefined(right.seq, right.sequence, 0)));
    if (segments.length) {
      voiceState.nextSegmentSeq = Math.max(
        voiceState.nextSegmentSeq,
        ...segments.map((segment) => Number(firstDefined(segment.seq, segment.sequence, 0)) + 1),
      );
    }
    let transcriptChanged = false;
    let appliedChanged = false;
    let hasPending = false;
    let hasFailure = false;
    segments.forEach((segment) => {
      const transcribeState = String(firstDefined(segment.transcribeState, segment.transcribe_state, ''));
      if (['received', 'pending', 'transcribing', 'retrying'].includes(transcribeState)) {
        hasPending = true;
      }
      if (transcribeState.includes('failed')) hasFailure = true;
    });
    const transcriptionAvailable = firstDefined(
      recording?.transcriptionAvailable,
      payload?.transcriptionAvailable,
      true,
    ) !== false;
    if (
      !transcriptionAvailable
      && segments.some((segment) => (
        String(firstDefined(segment.transcribeState, segment.transcribe_state, ''))
        !== 'transcribed'
      ))
    ) {
      hasFailure = true;
      hasPending = false;
    }
    const segmentsBySeq = new Map(segments.map((segment) => [
      Number(firstDefined(segment.seq, segment.sequence, 0)),
      segment,
    ]));
    let nextTranscriptSeq = 0;
    while (voiceState.appliedSegments.has(nextTranscriptSeq)) nextTranscriptSeq += 1;
    while (segmentsBySeq.has(nextTranscriptSeq)) {
      const segment = segmentsBySeq.get(nextTranscriptSeq);
      const transcribeState = String(firstDefined(segment.transcribeState, segment.transcribe_state, ''));
      if (transcribeState !== 'transcribed') break;
      const transcript = String(firstDefined(segment.transcript, segment.text, ''));
      transcriptChanged = applyVoiceTranscript(transcript) || transcriptChanged;
      voiceState.appliedSegments.add(nextTranscriptSeq);
      appliedChanged = true;
      nextTranscriptSeq += 1;
      while (voiceState.appliedSegments.has(nextTranscriptSeq)) nextTranscriptSeq += 1;
    }
    voiceState.flaggedTerms = segments
      .filter((segment) => voiceState.appliedSegments.has(
        Number(firstDefined(segment.seq, segment.sequence, 0)),
      ))
      .flatMap((segment) => asArray(firstDefined(segment.flaggedTerms, segment.flagged_terms)))
      .map(normalizedFlaggedTerm)
      .filter(Boolean);
    if (hasFailure) {
      voiceState.error = VOICE_ERROR_COPY.transcribeUnavailable;
    } else if (!hasPending && voiceState.error === VOICE_ERROR_COPY.transcribeUnavailable) {
      voiceState.error = '';
    }
    const serverDuration = Number(firstDefined(
      recording?.totalDurationMs,
      recording?.total_duration_ms,
      payload?.totalDurationMs,
      0,
    ));
    if (serverDuration > voiceState.durationMs && !voiceState.segmentStartedAt) {
      voiceState.durationMs = serverDuration;
    }
    const serverState = String(firstDefined(recording?.state, payload?.state, ''));
    if (['limit_reached', 'length_limit'].includes(serverState)) {
      voiceState.error = VOICE_ERROR_COPY.lengthLimit;
      voiceState.limitReached = true;
      if (voiceState.mode === 'rec') await voiceDone({ limitReached: true });
    }
    const ghost = $('#voxGhost');
    if (ghost && !voiceState.error) ghost.textContent = hasPending ? 'Transcribing the latest words…' : '';
    if (transcriptChanged || appliedChanged) scheduleCaptureDraftSave();
    if (voiceState.mode === 'review') renderVoiceDock('review');
  } catch (error) {
    if (error.code === 'voice_disabled') {
      voiceState.error = VOICE_ERROR_COPY.voiceDisabled;
      await voicePause(true);
      renderVoiceDock('error');
      return;
    }
    if (['transcribe_unavailable', 'transcribe_timeout'].includes(error.code)) {
      voiceState.error = VOICE_ERROR_COPY.transcribeUnavailable;
      if (voiceState.mode === 'review') renderVoiceDock('review');
      return;
    }
    if (!navigator.onLine || error.code === 'request_timeout') {
      voiceState.error = VOICE_ERROR_COPY.reconnecting;
      await voicePause(true);
      renderVoiceDock('error');
    }
  }
}

async function ensureVoiceSession() {
  if (voiceState.recordingId) return;
  const result = await api.createRecording();
  voiceState.recordingId = String(firstDefined(result?.recordingId, result?.recording_id, result?.recording?.id, ''));
  if (!voiceState.recordingId) throw new Error('StoryForge could not open a private recording session.');
  const plan = asArray(firstDefined(result?.segmentPlanMs, result?.segment_plan_ms)).map(Number);
  if (plan.length === 2 && plan.every((value) => Number.isInteger(value) && value > 0)) {
    voiceState.segmentPlanMs = plan;
  }
  voiceState.anchor = $('#capBody')?.value.length || 0;
  startVoicePolling();
  scheduleCaptureDraftSave();
}

async function ensureVoiceStream() {
  if (voiceState.stream?.active) return;
  voiceState.stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  voiceState.stream.getAudioTracks().forEach((track) => {
    track.addEventListener('mute', () => {
      if (voiceState.mode === 'rec') void voicePause(true);
    });
    track.addEventListener('ended', () => {
      if (['rec', 'arming'].includes(voiceState.mode)) {
        voiceState.error = VOICE_ERROR_COPY.deviceFailure;
        void voicePause(true).finally(() => renderVoiceDock('error'));
      }
    });
  });
}

async function uploadVoiceSegment(record) {
  const form = new FormData();
  form.set('seq', String(record.seq));
  form.set('durationMs', String(record.durationMs));
  form.set('segment', record.blob, voiceFileName(record.seq, record.mimeType));
  try {
    await api.uploadRecordingSegment(record.recordingId, form);
    await removeVoiceSegment(record.recordingId, record.seq);
    if (voiceState.error === VOICE_ERROR_COPY.reconnecting) voiceState.error = '';
  } catch (error) {
    if (error.code === 'voice_disabled') {
      voiceState.error = VOICE_ERROR_COPY.voiceDisabled;
    } else if (error.code === 'voice_daily_limit' || error.status === 429) {
      voiceState.error = VOICE_ERROR_COPY.dailyLimit;
    } else {
      voiceState.error = VOICE_ERROR_COPY.reconnecting;
    }
    if (voiceState.mode === 'rec') await voicePause(true);
    renderVoiceDock('error');
    return false;
  }
  await pollVoiceRecording();
  return true;
}

async function flushVoiceSegments() {
  if (!voiceState.recordingId) return [];
  const records = await pendingVoiceSegments(voiceState.recordingId);
  for (const record of records) {
    const uploaded = await uploadVoiceSegment(record);
    if (!uploaded) break;
  }
  return pendingVoiceSegments(voiceState.recordingId);
}

async function beginVoiceSegment() {
  if (voiceState.nextSegmentSeq >= 200) {
    voiceState.limitReached = true;
    await voiceDone({ limitReached: true });
    return;
  }
  await ensureVoiceStream();
  const mimeType = supportedVoiceMimeType();
  if (!mimeType) throw new Error('No supported recording format is available.');
  const chunks = [];
  const recorder = new MediaRecorder(voiceState.stream, { mimeType });
  voiceState.recorder = recorder;
  voiceState.segmentChunks = chunks;
  voiceState.segmentMimeType = mimeType;
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size) chunks.push(event.data);
  });
  recorder.start();
  voiceState.segmentStartedAt = Date.now();
  const delay = voiceState.nextSegmentSeq === 0
    ? voiceState.segmentPlanMs[0]
    : voiceState.segmentPlanMs[1];
  voiceState.segmentTimeout = window.setTimeout(() => {
    void closeVoiceSegment({ continueRecording: true });
  }, delay);
  window.clearInterval(voiceState.clockTimer);
  voiceState.clockTimer = window.setInterval(updateVoiceClock, 250);
  updateVoiceClock();
}

async function closeVoiceSegment({ continueRecording = false } = {}) {
  if (voiceState.closePromise) return voiceState.closePromise;
  const recorder = voiceState.recorder;
  if (!recorder || recorder.state === 'inactive') return;
  voiceState.closePromise = (async () => {
    window.clearTimeout(voiceState.segmentTimeout);
    voiceState.segmentTimeout = 0;
    const elapsed = Math.max(1, Date.now() - voiceState.segmentStartedAt);
    const stopped = new Promise((resolve) => recorder.addEventListener('stop', resolve, { once: true }));
    recorder.stop();
    await stopped;
    const blob = new Blob(voiceState.segmentChunks || [], { type: voiceState.segmentMimeType });
    voiceState.durationMs += elapsed;
    voiceState.segmentStartedAt = 0;
    voiceState.recorder = null;
    window.clearInterval(voiceState.clockTimer);
    voiceState.clockTimer = 0;
    if (blob.size) {
      const record = {
        recordingId: voiceState.recordingId,
        seq: voiceState.nextSegmentSeq,
        durationMs: elapsed,
        mimeType: voiceState.segmentMimeType,
        blob,
      };
      await storeVoiceSegment(record);
      voiceState.nextSegmentSeq += 1;
      voiceState.uploadQueue = voiceState.uploadQueue
        .catch(() => {})
        .then(() => uploadVoiceSegment(record));
    }
    scheduleCaptureDraftSave();
    if (continueRecording && voiceState.mode === 'rec' && !voiceState.limitReached) {
      await beginVoiceSegment();
    }
  })().finally(() => {
    voiceState.closePromise = null;
  });
  return voiceState.closePromise;
}

async function voiceStart() {
  if (!state.capabilities?.voiceCapture || ['rec', 'arming'].includes(voiceState.mode)) return;
  voiceState.error = '';
  voiceState.autoPaused = false;
  renderVoiceDock('arming');
  try {
    await openVoiceDatabase();
    await ensureVoiceStream();
    await ensureVoiceSession();
    await flushVoiceSegments();
    if (voiceState.error) {
      renderVoiceDock('error');
      return;
    }
    voiceState.mode = 'rec';
    renderVoiceDock('rec');
    await requestVoiceWakeLock();
    await beginVoiceSegment();
    if (!voiceState.visibilityHandler) {
      voiceState.visibilityHandler = () => {
        if (document.hidden && voiceState.mode === 'rec') void voicePause(true);
        if (!document.hidden && voiceState.mode === 'rec') void requestVoiceWakeLock();
      };
      document.addEventListener('visibilitychange', voiceState.visibilityHandler);
    }
  } catch (error) {
    cleanupVoiceMedia();
    voiceState.error = error.name === 'NotAllowedError'
      ? VOICE_ERROR_COPY.micDenied
      : error.code === 'voice_daily_limit' || error.status === 429
        ? VOICE_ERROR_COPY.dailyLimit
        : error.code === 'voice_disabled'
          ? VOICE_ERROR_COPY.voiceDisabled
          : VOICE_ERROR_COPY.deviceFailure;
    renderVoiceDock('error');
  }
}

async function voicePause(auto = false) {
  if (!['rec', 'arming'].includes(voiceState.mode)) return;
  voiceState.mode = 'paused';
  voiceState.autoPaused = Boolean(auto);
  await closeVoiceSegment();
  releaseVoiceWakeLock();
  renderVoiceDock('paused');
  scheduleCaptureDraftSave();
}

async function voiceResume() {
  if (voiceState.mode !== 'paused') return;
  voiceState.error = '';
  voiceState.autoPaused = false;
  try {
    await flushVoiceSegments();
    if (voiceState.error) {
      renderVoiceDock('error');
      return;
    }
    voiceState.mode = 'rec';
    renderVoiceDock('rec');
    await requestVoiceWakeLock();
    await beginVoiceSegment();
  } catch {
    voiceState.error = VOICE_ERROR_COPY.deviceFailure;
    renderVoiceDock('error');
  }
}

async function voiceDone({ limitReached = false } = {}) {
  if (voiceState.mode === 'rec') await closeVoiceSegment();
  cleanupVoiceMedia();
  voiceState.limitReached = Boolean(limitReached);
  if (limitReached) {
    voiceState.error = VOICE_ERROR_COPY.lengthLimit;
    notify(VOICE_ERROR_COPY.lengthLimit);
  }
  voiceState.mode = 'review';
  startVoicePolling();
  await voiceState.uploadQueue.catch(() => {});
  let pending;
  try {
    pending = await pendingVoiceSegments(voiceState.recordingId);
  } catch {
    voiceState.error = VOICE_ERROR_COPY.deviceFailure;
    renderVoiceDock('error');
    scheduleCaptureDraftSave();
    return;
  }
  if (pending.length || voiceState.error === VOICE_ERROR_COPY.reconnecting) {
    voiceState.error = VOICE_ERROR_COPY.reconnecting;
    renderVoiceDock('error');
    scheduleCaptureDraftSave();
    return;
  }
  await pollVoiceRecording();
  renderVoiceDock(
    voiceState.error === VOICE_ERROR_COPY.reconnecting ? 'error' : 'review',
  );
  scheduleCaptureDraftSave();
}

async function voiceDiscard() {
  const recordingId = voiceState.recordingId;
  if (!recordingId) {
    voiceState = newVoiceState();
    renderVoiceDock('idle');
    return;
  }
  await closeVoiceSegment().catch(() => {});
  cleanupVoiceMedia();
  stopVoicePolling();
  await voiceState.uploadQueue.catch(() => {});
  await api.cancelRecording(recordingId);
  const body = $('#capBody');
  const hadWords = Boolean(body && voiceState.voiceSpans.some(
    (span) => body.value.slice(span.start, span.end).trim(),
  ));
  const preservedText = body
    ? removeVoiceText(body.value, voiceState.voiceSpans)
    : '';
  const scrubbedDraft = {
    ...captureDraftPayload(),
    text: preservedText,
    voice: {
      ...captureDraftPayload()?.voice,
      spans: [],
      transcriptText: '',
      dismissedTerms: [],
    },
  };
  window.clearTimeout(state.captureDraftSaveTimer);
  state.captureDraftSaveTimer = 0;
  await captureDraftSavePromise.catch(() => {});
  await persistCaptureDraft(scrubbedDraft);
  if (body) body.value = preservedText;
  voiceState.voiceSpans = [];
  voiceState.trackedText = preservedText;
  voiceState.transcriptText = '';
  voiceState.dismissedTerms.clear();
  await clearVoiceSegments(recordingId);
  if (voiceState.visibilityHandler) {
    document.removeEventListener('visibilitychange', voiceState.visibilityHandler);
  }
  voiceState = newVoiceState({ text: preservedText });
  renderVoiceDock('idle');
  const finalDraft = captureDraftPayload();
  if (finalDraft) await persistCaptureDraft(finalDraft);
  notify(hadWords
    ? 'Recording discarded — the words from that take were removed. Typed text stays.'
    : 'Recording discarded.');
}

async function retryVoiceTranscription() {
  if (!voiceState.recordingId) return;
  await api.retryRecordingTranscription(voiceState.recordingId);
  voiceState.error = '';
  await pollVoiceRecording();
  renderVoiceDock('review');
}

async function retryVoiceUpload() {
  if (!voiceState.recordingId) return;
  voiceState.error = '';
  const pending = await flushVoiceSegments();
  if (pending.length || voiceState.error) {
    voiceState.error ||= VOICE_ERROR_COPY.reconnecting;
    renderVoiceDock('error');
    return;
  }
  await pollVoiceRecording();
  renderVoiceDock(
    voiceState.error === VOICE_ERROR_COPY.reconnecting ? 'error' : 'review',
  );
  scheduleCaptureDraftSave();
}

function applyVoiceFix(index) {
  const flag = voiceFlags()[index];
  const body = $('#capBody');
  if (!flag || !body) return;
  replaceVoiceText(body, flag.from, flag.to);
  voiceState.dismissedTerms.add(voiceTermKey(flag));
  scheduleCaptureDraftSave();
  renderVoiceDock('review');
}

function applyAllVoiceFixes() {
  const body = $('#capBody');
  const flags = voiceFlags();
  if (!body || !flags.length) return;
  flags.forEach((flag) => {
    replaceVoiceText(body, flag.from, flag.to);
    voiceState.dismissedTerms.add(voiceTermKey(flag));
  });
  scheduleCaptureDraftSave();
  renderVoiceDock('review');
  notify(`Transcript corrected — ${flags.length} terms fixed.`, '✓');
}

let recorder = null;
let recordingStream = null;
let recordingStartedAt = 0;
let recordingTimer = 0;
let recordedChunks = [];
let recordedBlob = null;
let recordedDurationMs = 0;
let recordingStopPromise = Promise.resolve();
let resolveRecordingStop = () => {};

function stopRecording() {
  window.clearInterval(recordingTimer);
  if (recorder?.state === 'recording') recorder.stop();
  recordingStream?.getTracks().forEach((track) => track.stop());
  recorder = null;
  recordingStream = null;
}

async function toggleRecording(button) {
  if (recorder?.state === 'recording') {
    recordedDurationMs = Math.max(0, Date.now() - recordingStartedAt);
    recorder.stop();
    recordingStream?.getTracks().forEach((track) => track.stop());
    window.clearInterval(recordingTimer);
    button.classList.remove('rec');
    $('span:last-child', button).textContent = 'Voice note attached ✓';
    $('#captureWave')?.classList.remove('on');
    return;
  }
  try {
    recordedChunks = [];
    recordedBlob = null;
    recordedDurationMs = 0;
    recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const preferredType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((type) => MediaRecorder.isTypeSupported(type));
    recorder = new MediaRecorder(recordingStream, preferredType ? { mimeType: preferredType } : undefined);
    recordingStopPromise = new Promise((resolve) => {
      resolveRecordingStop = resolve;
    });
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size) recordedChunks.push(event.data);
    });
    recorder.addEventListener('stop', () => {
      if (!recordedDurationMs) recordedDurationMs = Math.max(0, Date.now() - recordingStartedAt);
      recordedBlob = new Blob(recordedChunks, { type: recorder.mimeType || 'audio/webm' });
      recorder = null;
      recordingStream = null;
      resolveRecordingStop();
      resolveRecordingStop = () => {};
    });
    recorder.start();
    recordingStartedAt = Date.now();
    button.classList.add('rec');
    $('span:last-child', button).textContent = 'Listening… tap to finish';
    $('#captureWave')?.classList.add('on');
    recordingTimer = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - recordingStartedAt) / 1000);
      const timer = $('#captureTimer');
      if (timer) timer.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    }, 250);
  } catch (error) {
    notify(error.message || 'Microphone access was not available.');
  }
}

async function uploadRecordedAudio(storyId) {
  if (!recordedBlob) return null;
  const presign = await auth.request('/api/audio/presign', jsonOptions('POST', {
    storyId,
    contentType: recordedBlob.type,
    byteSize: recordedBlob.size,
  }));
  const uploadUrl = firstDefined(presign?.upload?.uploadUrl, presign?.upload?.upload_url);
  if (!uploadUrl) throw new Error('Private audio upload could not be prepared.');
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': recordedBlob.type },
    body: recordedBlob,
    credentials: 'omit',
  });
  if (!response.ok) throw new Error('Private audio upload did not complete.');
  const assetId = firstDefined(presign?.asset?.id, presign?.asset_id);
  if (!assetId) throw new Error('Private audio verification could not begin.');
  return auth.request(`/api/audio/${assetId}/confirm`, jsonOptions('POST', {
    durationMs: recordedDurationMs,
  }));
}

const voiceAssemblyRetryMs = 2_000;
const voiceAssemblyWaitMs = 90_000;
const audioAssemblyDecisionRequired = Object.freeze({
  audioAssemblyDecisionRequired: true,
});
let captureSaveInFlight = false;
let captureSaveInterrupted = false;
let activeAudioAssemblyPrompt = null;

function voiceDelay(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function recordingState(payload) {
  const recording = payload?.recording || payload;
  return String(firstDefined(recording?.state, payload?.state, ''));
}

function typedStoryPayload(storyPayload, editorText) {
  const payload = {
    ...storyPayload,
    text: String(editorText ?? ''),
    captureType: 'text',
  };
  delete payload.recordingId;
  return payload;
}

function isRecordingStateConflict(error) {
  return error?.status === 409 && error?.code === 'state_conflict';
}

async function preserveCancelledRecordingDraft(recordingId, editorText) {
  stopVoicePolling();
  cleanupVoiceMedia();
  await clearVoiceSegments(recordingId).catch(() => {});
  if (voiceState.visibilityHandler) {
    document.removeEventListener('visibilitychange', voiceState.visibilityHandler);
  }
  voiceState = newVoiceState({ text: editorText });
  state.captureTypedOnlyFromAudio = true;
  renderVoiceDock('idle');
  const draft = captureDraftPayload();
  if (draft) await persistCaptureDraft(draft).catch(() => {});
  return state.captureDraftVersion;
}

async function saveWithoutAudioAfterDeadline(recordingId, storyPayload, editorText) {
  try {
    await api.cancelRecording(recordingId);
  } catch (error) {
    if (!isRecordingStateConflict(error)) {
      error.audioAssemblyPromptRetry = true;
      throw error;
    }
    let reread = null;
    try {
      reread = await api.recording(recordingId);
    } catch {
      // The ruled state-conflict sequence is closed. An unreadable race result
      // cannot authorize audio success, so it proceeds to typed-only fallback.
    }
    if (['assembled', 'attached'].includes(recordingState(reread))) {
      try {
        return {
          result: await api.createStory(storyPayload),
          savedWithoutAudio: false,
        };
      } catch {
        // The single E7 race attempt lost. The ruled typed-only fallback below
        // is the terminal client path; there is no further E7 attempt.
      }
    }
    const persistedDraftVersion = await preserveCancelledRecordingDraft(
      recordingId,
      editorText,
    );
    const payload = typedStoryPayload(storyPayload, editorText);
    if (Number.isInteger(persistedDraftVersion)) {
      payload.draftVersion = persistedDraftVersion;
    }
    const result = await api.createStory(payload);
    try {
      await api.cancelRecording(recordingId);
    } catch {
      // Exactly one second E5 attempt is permitted. The maintenance sweep owns
      // a still-conflicted or unreachable session after the typed story exists.
    }
    return { result, savedWithoutAudio: true };
  }

  const persistedDraftVersion = await preserveCancelledRecordingDraft(
    recordingId,
    editorText,
  );
  const payload = typedStoryPayload(storyPayload, editorText);
  if (Number.isInteger(persistedDraftVersion)) {
    payload.draftVersion = persistedDraftVersion;
  }
  return {
    result: await api.createStory(payload),
    savedWithoutAudio: true,
  };
}

function promptForAudioAssemblyDecision({
  initiator,
  saveWithoutAudio,
}) {
  return new Promise((resolve, reject) => {
    activeAudioAssemblyPrompt?.interrupt();
    const layer = document.createElement('div');
    layer.className = 'audioAssemblyLayer';
    layer.innerHTML = `<section class="audioAssemblyDialog" role="alertdialog" aria-modal="true" aria-labelledby="audioAssemblyTitle" aria-describedby="audioAssemblyBody" tabindex="-1">
      <h2 id="audioAssemblyTitle">Your audio is still being prepared</h2>
      <p id="audioAssemblyBody">Every word of your story is already captured below and will be saved with it. Only the audio is still being prepared. You can keep waiting, or save your story now without the audio.</p>
      <div class="audioAssemblyActions">
        <button type="button" class="audioAssemblyKeep">Keep Waiting</button>
        <button type="button" class="audioAssemblySave">Save Without Audio</button>
      </div>
    </section>`;
    const dialog = $('.audioAssemblyDialog', layer);
    const keepButton = $('.audioAssemblyKeep', layer);
    const saveButton = $('.audioAssemblySave', layer);
    const background = [...document.body.children].filter((node) => node.id !== 'toast');
    const priorInert = background.map((node) => [node, node.hasAttribute('inert')]);
    let closed = false;
    let saving = false;
    let interrupted = false;

    function restoreBackground() {
      priorInert.forEach(([node, wasInert]) => {
        if (!wasInert) node.removeAttribute('inert');
      });
    }

    function close() {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', trapKeyboard, true);
      document.removeEventListener('focusin', containFocus, true);
      layer.remove();
      restoreBackground();
      if (activeAudioAssemblyPrompt?.layer === layer) {
        activeAudioAssemblyPrompt = null;
      }
      if (initiator?.isConnected) initiator.focus({ preventScroll: true });
    }

    function keepWaiting() {
      if (saving || closed) return;
      close();
      resolve({ keepWaiting: true });
    }

    async function chooseSaveWithoutAudio() {
      if (saving || closed) return;
      saving = true;
      dialog.focus({ preventScroll: true });
      keepButton.disabled = true;
      saveButton.disabled = true;
      try {
        const outcome = await withBusy(saveWithoutAudio);
        close();
        resolve(outcome);
      } catch (error) {
        if (interrupted) {
          resolve({ interrupted: true });
          return;
        }
        if (error?.audioAssemblyPromptRetry) {
          saving = false;
          keepButton.disabled = false;
          saveButton.disabled = false;
          notify(error.message || 'StoryForge could not save that change.');
          keepButton.focus({ preventScroll: true });
          return;
        }
        close();
        reject(error);
      }
    }

    function trapKeyboard(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        keepWaiting();
        return;
      }
      if (event.key !== 'Tab') return;
      event.stopImmediatePropagation();
      const focusable = [keepButton, saveButton].filter((button) => !button.disabled);
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function containFocus(event) {
      if (closed || dialog.contains(event.target)) return;
      event.stopImmediatePropagation();
      const target = [keepButton, saveButton].find((button) => !button.disabled);
      (target || dialog).focus({ preventScroll: true });
    }

    layer.addEventListener('mousedown', (event) => {
      if (event.target === layer) {
        event.preventDefault();
        event.stopPropagation();
        keepWaiting();
      }
    });
    keepButton.addEventListener('click', keepWaiting);
    saveButton.addEventListener('click', () => {
      void chooseSaveWithoutAudio();
    });

    activeAudioAssemblyPrompt = {
      layer,
      interrupt() {
        if (closed) return;
        interrupted = true;
        close();
        if (!saving) resolve({ interrupted: true });
      },
    };
    background.forEach((node) => node.setAttribute('inert', ''));
    document.body.append(layer);
    document.addEventListener('keydown', trapKeyboard, true);
    document.addEventListener('focusin', containFocus, true);
    dialog.scrollIntoView({ block: 'nearest' });
    keepButton.focus({ preventScroll: true });
  });
}

async function saveRecordedStoryWhenAssembled(recordingId, storyPayload) {
  const deadline = Date.now() + voiceAssemblyWaitMs;
  while (true) {
    const payload = await api.recording(recordingId);
    if (captureSaveInterrupted) return { captureSaveInterrupted: true };
    const currentRecordingState = recordingState(payload);
    if (currentRecordingState === 'failed') {
      stopVoicePolling();
      cleanupVoiceMedia();
      await voiceState.uploadQueue.catch(() => {});
      await clearVoiceSegments(recordingId).catch(() => {});
      if (voiceState.visibilityHandler) {
        document.removeEventListener('visibilitychange', voiceState.visibilityHandler);
      }
      window.clearTimeout(state.captureDraftSaveTimer);
      state.captureDraftSaveTimer = 0;
      await captureDraftSavePromise.catch(() => {});
      const preservedText = $('#capBody')?.value || '';
      voiceState = newVoiceState({ text: preservedText });
      renderVoiceDock('idle');
      const typedDraft = captureDraftPayload();
      if (typedDraft) await persistCaptureDraft(typedDraft);
      throw Object.assign(new Error(VOICE_ERROR_COPY.attachFailed), {
        code: 'assembly_failed',
      });
    }
    if (['assembled', 'attached'].includes(currentRecordingState)) {
      try {
        return {
          result: await api.createStory(storyPayload),
          savedWithoutAudio: false,
        };
      } catch (error) {
        if (error.code !== 'voice_assembly_pending') throw error;
      }
    }
    if (Date.now() >= deadline) {
      return audioAssemblyDecisionRequired;
    }
    await voiceDelay(voiceAssemblyRetryMs);
  }
}

async function saveCapture(form) {
  if (captureSaveInFlight) return;
  captureSaveInFlight = true;
  captureSaveInterrupted = false;
  try {
    if (
      voiceState.recordingId
      && ['rec', 'paused', 'arming'].includes(voiceState.mode)
    ) {
      await voiceDone();
    }
    if (recorder?.state === 'recording') {
      notify('Finish the recording before saving.');
      return;
    }
    await recordingStopPromise;
    const title = $('#capTitle', form)?.value.trim();
    if (!title) return;
    const lesson = $('#capLesson', form)?.value.trim() || '';
    const themes = JSON.parse(capture.dataset.themes || '[]');
    const studentScore = Number(capture.dataset.score || 0) || null;
    const prefixEnabled = capture.dataset.prefixEnabled !== 'false';
    const destinationQuestionId = state.capturePairQuestionId;
    const recordingId = voiceState.recordingId;
    const saveInitiator = $('[type="submit"]', form);
    let recordingPrepared = false;
    let outcome;
    while (!outcome) {
      const windowResult = await withBusy(async () => {
        window.clearTimeout(state.captureDraftSaveTimer);
        state.captureDraftSaveTimer = 0;
        await captureDraftSavePromise;
        if (recordingId && !recordingPrepared) {
          await voiceState.uploadQueue.catch(() => {});
          const pending = await flushVoiceSegments();
          if (voiceState.error === VOICE_ERROR_COPY.voiceDisabled) {
            throw Object.assign(
              new Error(VOICE_ERROR_COPY.voiceDisabled),
              { code: 'voice_disabled' },
            );
          }
          if (
            pending.length
            || [
              VOICE_ERROR_COPY.reconnecting,
              VOICE_ERROR_COPY.deviceFailure,
              VOICE_ERROR_COPY.dailyLimit,
            ].includes(voiceState.error)
          ) {
            throw Object.assign(
              new Error('Your recording is still safe on this device, but it has not finished uploading. Retry the upload before saving.'),
              { code: 'recording_upload_pending' },
            );
          }
          await api.finishRecording(recordingId, voiceState.durationMs);
          await pollVoiceRecording();
          recordingPrepared = true;
        }
        const editorText = $('#capBody', form)?.value || '';
        const text = recordingId || state.captureTypedOnlyFromAudio
          ? editorText
          : editorText.trim();
        const storyPayload = {
          title,
          text,
          captureType: recordingId || recordedBlob ? 'audio' : 'text',
          lesson,
          prefixEnabled,
          themes,
          studentScore,
          ...(recordingId ? { recordingId } : {}),
          draftVersion: state.captureDraftVersion ?? 0,
          surface: 'quick',
        };
        const saveResult = recordingId
          ? await saveRecordedStoryWhenAssembled(recordingId, storyPayload)
          : {
            result: await api.createStory(storyPayload),
            savedWithoutAudio: false,
          };
        if (saveResult.captureSaveInterrupted) {
          return { captureSaveInterrupted: true };
        }
        if (saveResult.audioAssemblyDecisionRequired) {
          return {
            audioAssemblyDecisionRequired: true,
            storyPayload,
          };
        }
        const story = unwrapStory(saveResult.result);
        if (!recordingId && recordedBlob) await uploadRecordedAudio(story.id);
        if (destinationQuestionId) {
          await api.createPair({
            storyId: story.id,
            questionId: destinationQuestionId,
            studentStrength: 3,
            surface: 'workshop-capture',
          });
        }
        return {
          story,
          savedWithoutAudio: saveResult.savedWithoutAudio,
        };
      });
      if (!windowResult || windowResult.captureSaveInterrupted) return;
      if (!windowResult.audioAssemblyDecisionRequired) {
        outcome = windowResult;
        break;
      }
      const decision = await promptForAudioAssemblyDecision({
        initiator: saveInitiator,
        saveWithoutAudio: async () => {
          const editorText = $('#capBody', form)?.value || '';
          const saveResult = await saveWithoutAudioAfterDeadline(
            recordingId,
            {
              ...windowResult.storyPayload,
              text: editorText,
              draftVersion: state.captureDraftVersion ?? 0,
            },
            editorText,
          );
          const story = unwrapStory(saveResult.result);
          if (destinationQuestionId) {
            await api.createPair({
              storyId: story.id,
              questionId: destinationQuestionId,
              studentStrength: 3,
              surface: 'workshop-capture',
            });
          }
          return {
            story,
            savedWithoutAudio: saveResult.savedWithoutAudio,
          };
        },
      });
      if (decision?.interrupted) return;
      if (!decision?.keepWaiting) outcome = decision;
    }
    const created = outcome?.story;
    if (!created) return;
    stopVoicePolling();
    cleanupVoiceMedia();
    if (recordingId) await clearVoiceSegments(recordingId).catch(() => {});
    if (voiceState.visibilityHandler) {
      document.removeEventListener('visibilitychange', voiceState.visibilityHandler);
    }
    voiceState = newVoiceState();
    stopRecording();
    recordedBlob = null;
    recordedDurationMs = 0;
    state.captureDraftSuppressCloseSave = true;
    state.captureTypedOnlyFromAudio = false;
    state.capturePairQuestionId = null;
    closeOverlay(capture);
    setMotionEnergy('success');
    window.setTimeout(() => {
      if (!capture.classList.contains('open')) setMotionEnergy('low');
    }, 900);
    await loadStories();
    renderShell();
    if (outcome.savedWithoutAudio) {
      if (destinationQuestionId) await openWorkshop(destinationQuestionId);
      else renderHome();
      notify('Saved. Every word was kept — this story has no audio attached.');
    } else if (destinationQuestionId) {
      await openWorkshop(destinationQuestionId);
      notify(`Saved and paired. “${storyTitle(created)}” now appears in this Question Workshop.`);
    } else {
      renderHome();
      notify(`Saved. “${storyTitle(created)}” is private until you submit it for review.`);
    }
  } finally {
    captureSaveInFlight = false;
    captureSaveInterrupted = false;
  }
}

/* ========================= Story workspace ========================= */

function normalizePair(raw = {}) {
  return {
    ...raw,
    id: String(firstDefined(raw.id, raw.pair_id, '')),
    storyId: String(firstDefined(raw.storyId, raw.story_id, '')),
    questionId: String(firstDefined(raw.questionId, raw.question_id, '')),
    questionText: String(firstDefined(raw.questionText, raw.question_text, raw.text, '')),
    confirmed: Boolean(firstDefined(raw.confirmed, raw.is_confirmed, raw.mentor_confirmed, raw.state === 'confirmed', raw.status === 'confirmed')),
    studentStrength: Number(firstDefined(raw.studentStrength, raw.student_strength, raw.s_student, 0)) || 0,
    mentorStrength: Number(firstDefined(raw.mentorStrength, raw.mentor_strength, raw.s_mentor, 0)) || 0,
    why: String(firstDefined(raw.why, raw.rationale, '')),
    proposedBy: String(firstDefined(raw.proposedBy, raw.proposed_by_name, raw.proposed_by, '')),
    followups: asArray(firstDefined(raw.followups, raw.follow_ups)),
  };
}

function pairQuestion(pair) {
  return state.questions.find((question) => question.id === pair.questionId)
    || normalizeQuestion({ id: pair.questionId, text: pair.questionText, family: 'custom' });
}

function feedbackBody(item) {
  return String(firstDefined(item.body, item.text, item.feedback, ''));
}

function feedbackAuthor(item) {
  return String(firstDefined(
    item.reviewerName,
    item.reviewer_name,
    item.mentorName,
    item.mentor_name,
    item.actor_name,
    state.storyDetail?.reviewedByName,
    'Reviewer',
  ));
}

function feedbackTime(item) {
  return firstDefined(item.createdAt, item.created_at, item.sent_at);
}

function normalizeMentorNote(raw = {}) {
  return {
    ...raw,
    id: String(firstDefined(raw.id, raw.noteId, raw.note_id, '')),
    storyId: String(firstDefined(raw.storyId, raw.story_id, '')),
    body: String(firstDefined(raw.body, raw.transcript, raw.text, '')),
    transcript: String(firstDefined(raw.transcript, raw.body, '')),
    internalOnly: Boolean(firstDefined(raw.internalOnly, raw.internal_only, false)),
    state: String(firstDefined(raw.state, raw.status, 'draft')),
    authorName: String(firstDefined(raw.authorName, raw.author_name, raw.mentor_name, 'Reviewer')),
    rowVersion: Number(firstDefined(raw.rowVersion, raw.row_version, 0)) || 0,
    audioAssetId: String(firstDefined(raw.audioAssetId, raw.audio_asset_id, raw.audio?.id, '')),
    hasAudio: Boolean(firstDefined(raw.hasAudio, raw.has_audio, raw.audioState === 'verified', raw.audioAssetId, raw.audio_asset_id, false)),
    createdAt: isoValue(firstDefined(raw.createdAt, raw.created_at)),
    publishedAt: isoValue(firstDefined(raw.publishedAt, raw.published_at)),
  };
}

function canWriteMentorNotes() {
  return Boolean(state.capabilities?.mentorNotes) && (isMentor() || canAdminReview());
}

function visibleMentorNotes(story) {
  const notes = asArray(story.mentorNotes).map(normalizeMentorNote);
  if (canWriteMentorNotes()) return notes;
  return notes.filter((note) => note.state === 'published' && !note.internalOnly);
}

function mentorNotesMarkup(story) {
  const unavailableToWriter = v2FeatureOn('visibility')
    ? storyVisibility(story) === 'private'
    : story.status === 'private';
  if ((!state.capabilities?.mentorNotesRead && !canWriteMentorNotes())
      || (canWriteMentorNotes() && unavailableToWriter)
      || (!canWriteMentorNotes() && !visibleMentorNotes(story).length)) return '';
  const notes = visibleMentorNotes(story);
  const published = notes.filter((note) => note.state === 'published');
  const draft = canWriteMentorNotes()
    ? normalizeMentorNote(state.mentorNoteDraft || notes.find((note) => note.state === 'draft') || {})
    : null;
  if (draft?.id) state.mentorNoteDraft = draft;
  const recordingState = state.mentorNoteRecording?.recorder?.state || '';
  const isRecording = recordingState === 'recording';
  const isPaused = recordingState === 'paused';
  const adminWriter = canWriteMentorNotes() && canAdminReview();
  return `<section class="railCard b1511MentorNotes b1513r3Feedback" aria-labelledby="b1513r3FeedbackTitle">
    <div class="b1513r3FeedbackHeader"><div><div class="rLbl label-cy" id="b1513r3FeedbackTitle">Mentor feedback</div><p>${canWriteMentorNotes() ? 'Type feedback or speak instead of typing. Review the transcript before publishing it to the student.' : 'Your mentor’s words stay readable here, with the original voice recording whenever one was shared.'}</p></div><span class="b1513r3FeedbackBadge">Transcript + original voice</span></div>
    <div class="b1511MentorNoteList">${published.length ? published.map((note) => `<article class="b1511MentorNote b1513r3FeedbackNote ${note.internalOnly ? 'internal' : ''}">
      <div class="b1513r3FeedbackKind"><span aria-hidden="true">${note.internalOnly ? '◆' : '▤'}</span>${note.internalOnly ? 'Private admin note · never shown to student' : 'Readable transcript'}</div>
      <div class="b1513r3Transcript">${esc(note.body)}</div><div class="b1513r3FeedbackMeta">${esc(note.authorName)} · ${esc(formatDateTime(note.publishedAt || note.createdAt))}</div>
      ${!note.internalOnly && (note.hasAudio || note.audioAssetId) ? `<div class="b1513r3AudioRow"><button class="rowBtn pri" type="button" data-play-mentor-note="${attr(note.id)}">▶ Listen to original voice</button><span class="b1513r3AudioPromise"><b>Original mentor recording</b><br>Authorized playback for this student only.</span><div class="b1511MentorAudio" data-mentor-note-player="${attr(note.id)}"></div></div>` : ''}
    </article>`).join('') : '<div class="storyEmpty">No published mentor feedback yet.</div>'}</div>
    ${canWriteMentorNotes() ? `<div class="b1511MentorComposer b1513r3Composer" data-mentor-note-composer>
      <div class="b1513r3ComposerTop"><div class="b1513r3ComposerTitle">Speak instead of type<span>Your recording becomes an editable transcript; the original audio stays attached.</span></div><span class="b1513r3RecordState ${isRecording ? 'recording' : ''}" aria-live="polite"><i></i>${isRecording ? 'Recording now' : isPaused ? 'Recording paused' : draft?.hasAudio ? 'Audio captured · transcript ready' : 'Ready'}</span></div>
      <label class="fLbl" for="mentorNoteText">${draft?.id ? 'Editable transcript or typed feedback' : 'Student-facing feedback'}</label>
      <textarea id="mentorNoteText" rows="6" placeholder="Type feedback, or record and edit the transcript before publishing.">${esc(draft?.body || '')}</textarea>
      <div class="b1513r3TranscriptHint"><span aria-hidden="true">✎</span><span>Transcription is a draft. Correct names or clinical terminology here before the student sees it.</span></div>
      ${adminWriter ? `<label class="b1513r3Internal"><input id="mentorNoteInternal" type="checkbox" ${draft?.internalOnly ? 'checked' : ''} ${draft?.id ? 'disabled' : ''}><span><b>Private admin note</b>Never visible to the student and never eligible for student audio playback.</span></label>` : ''}
      <div class="inlineActions">
        <button class="rowBtn" type="button" data-save-mentor-note>${draft?.id ? 'Update draft' : 'Save draft'}</button>
        ${globalThis.MediaRecorder ? `<button class="rowBtn ${isRecording ? 'danger' : ''}" type="button" data-record-mentor-note>${isRecording || isPaused ? '■ Stop & transcribe' : '🎙 Record feedback'}</button>${isRecording ? '<button class="rowBtn" type="button" data-pause-mentor-note>Ⅱ Pause</button>' : ''}${isPaused ? '<button class="rowBtn" type="button" data-resume-mentor-note>▶ Resume</button>' : ''}` : ''}
        ${draft?.id ? `<button class="noteSend" type="button" data-publish-mentor-note ${draft.internalOnly ? 'disabled' : ''}>Publish transcript + audio</button><button class="rowBtn" type="button" data-discard-mentor-note>Discard draft</button>` : ''}
      </div><div class="b1513r3PublishLaw"><b>Publication boundary:</b> only a published, student-facing note appears for the student. Drafts remain reviewer-only. Private admin notes remain admin-only.</div>
    </div>` : ''}
  </section>`;
}

function reflectionQuestion(item) {
  return String(firstDefined(item.prompt, item.question, item.q, 'Reflection'));
}

function reflectionAnswer(item) {
  return String(firstDefined(item.answer, item.a, ''));
}

function reflectionFromMentor(item) {
  return Boolean(firstDefined(item.fromMentor, item.from_mentor, firstDefined(item.from, item.source) === 'mentor', false));
}

function storyTimestamps(story) {
  const lines = [
    ['Submitted', story.submittedAt],
    ['First opened by mentor', story.openedAt],
    ['Last reviewed', story.reviewedAt, story.reviewedByName ? ` by ${story.reviewedByName}` : ''],
    ['Feedback sent', story.feedbackSentAt],
    ['Feedback opened', story.feedbackOpenedAt],
    ['Revised / responded', story.studentRespondedAt],
    ['Last edited', story.updatedAt],
  ].filter(([, value]) => value);
  return lines.length
    ? lines.map(([label, value, suffix = '']) => `<div class="tsLine"><span class="tk">${esc(label)}</span><span>${esc(formatDateTime(value))}${esc(suffix)}</span></div>`).join('')
    : `<div class="tsLine"><span class="tk">Captured</span><span>${esc(formatDateTime(story.createdAt))}</span></div>`;
}

function classificationButtons(story, scope = 'room') {
  return `<div class="fLbl">Bird personality type <span>— pick any that fit</span></div>
    <div class="classChips">
      ${BIRDS.map((bird) => `<button class="cChip tone-${bird.id} ${story.birds.includes(bird.id) ? 'on' : ''}" type="button"
        data-classification="${bird.id}" data-kind="birds" data-scope="${scope}" title="${attr(bird.hint)}">${bird.emo} ${esc(bird.label)}</button>`).join('')}
    </div>
    <div class="fLbl">Ideal for position <span>— who this story lands with</span></div>
    <div class="classChips">
      ${POSITIONS.map((position) => `<button class="cChip ${story.positions.includes(position.id) ? 'on' : ''}" type="button"
        data-classification="${position.id}" data-kind="positions" data-scope="${scope}">${esc(position.label)}</button>`).join('')}
    </div>`;
}

function categoryButtons(story, { admin = false, readOnly = false } = {}) {
  return `<div class="b1511Taxonomy" role="group" aria-label="Story categories">
    ${presentationTaxonomy('categories', { includeSelected: story.categories }).map((category) => `<button type="button" data-${admin ? 'admin-' : ''}taxonomy="${attr(category.id)}" data-taxonomy-kind="categories"
      class="${story.categories.includes(category.id) ? 'on' : ''}" aria-pressed="${story.categories.includes(category.id)}" ${readOnly ? 'disabled' : ''}>${esc(category.label)}</button>`).join('')}
  </div>`;
}

function intendedUseButtons(story, { admin = false, readOnly = false } = {}) {
  return `<div class="useBtns b1511Uses">${presentationTaxonomy('intendedUses', { includeSelected: story.uses }).map((use) => {
    const suggestion = story.useSuggestions.find((item) => (
      firstDefined(item.useKey, item.use_key) === use.id
      && !firstDefined(item.withdrawnAt, item.withdrawn_at)
    ));
    return `<button class="useBtn ${story.uses.includes(use.id) ? 'on' : ''}" type="button" data-${admin ? 'admin-' : ''}taxonomy="${attr(use.id)}" data-taxonomy-kind="uses"
      aria-pressed="${story.uses.includes(use.id)}" ${readOnly ? 'disabled' : ''}>${esc(use.label)}${!admin && suggestion && !story.uses.includes(use.id) ? `<span class="sugTag">${esc(firstDefined(suggestion.suggestedByName, suggestion.suggested_by_name, 'Mentor'))} suggests</span>` : ''}<span class="chk">✓</span></button>`;
  }).join('')}</div>`;
}

function legacyIntendedUseButtons(story) {
  return `<div class="useBtns">${LEGACY_USES.map((use) => {
    const suggestion = story.useSuggestions.find((item) => (
      firstDefined(item.useKey, item.use_key) === use.id
      && !firstDefined(item.withdrawnAt, item.withdrawn_at)
    ));
    return `<button class="useBtn ${story.uses.includes(use.id) ? 'on' : ''}" type="button" data-toggle-use="${attr(use.id)}">${esc(use.label)}${suggestion && !story.uses.includes(use.id) ? `<span class="sugTag">${esc(firstDefined(suggestion.suggestedByName, suggestion.suggested_by_name, 'Mentor'))} suggests</span>` : ''}<span class="chk">✓</span></button>`;
  }).join('')}</div>`;
}

function mappedQuestionMarkup(story, limit = Infinity) {
  const pairs = story.mappings.map(normalizePair).slice(0, limit);
  return pairs.length ? pairs.map((pair) => {
    const question = pairQuestion(pair);
    return `<div class="qLink ${pair.confirmed ? 'on' : 'prop'}">
      <span class="qm">${pair.confirmed ? '✓' : '◌'}</span>
      <span>${esc(question.text || 'Interview question')}
        <small>${pair.confirmed ? 'Confirmed' : 'Suggested, not yet confirmed'} · self ${pair.studentStrength || '—'}/5 · mentor ${pair.mentorStrength || '—'}/5</small>
      </span>
    </div>`;
  }).join('') : '<div class="stageHint">None yet. “Assign” opens the question library.</div>';
}

function feedbackMarkup(story) {
  return story.feedback.length
    ? story.feedback.map((item) => `<div class="noteItem">
      <div class="nt">“${esc(feedbackBody(item))}”</div>
      <div class="nd">${esc(feedbackAuthor(item))} · ${esc(formatDateTime(feedbackTime(item)))}</div>
    </div>`).join('')
    : '<div class="stageHint">No written feedback yet.</div>';
}

function audioMarkup(story, compact = false) {
  const audio = firstDefined(story.audio, story.audio_asset, story.audioAsset);
  if (!audio && !story.audioAssetId && story.captureType !== 'audio') return '';
  const audioId = firstDefined(audio?.id, story.audioAssetId);
  const durationMs = Number(firstDefined(
    story.audioDurationMs,
    audio?.durationMs,
    audio?.duration_ms,
    0,
  ));
  const duration = durationMs > 0 ? formatDuration(durationMs) : '—:—';
  const player = audioId && audioReplay.id === String(audioId)
    ? audioReplay
    : { phase: 'idle', currentSeconds: 0 };
  const current = player.phase === 'complete'
    ? durationMs / 1000
    : Number(player.currentSeconds || 0);
  const percent = durationMs > 0 ? Math.min(100, (current * 1000 / durationMs) * 100) : 0;
  const phase = player.phase || 'idle';
  const isPlaying = phase === 'playing';
  const label = isPlaying
    ? 'Pause original audio'
    : phase === 'paused'
      ? 'Resume original audio'
      : phase === 'error'
        ? 'Retry original audio'
        : 'Play original audio';
  const glyph = isPlaying ? '❚❚' : '▶';
  const card = `<div class="audioCard${compact ? ' compact' : ''}" ${audioId ? `data-audio-card="${attr(audioId)}"` : ''} data-audio-total-ms="${durationMs > 0 ? durationMs : 0}">
    <button class="audPlay" type="button" ${audioId ? `data-play-audio="${attr(audioId)}"` : 'disabled'} aria-label="${label}" aria-busy="${phase === 'loading'}">${glyph}</button>
    <div class="audBody">
      <div class="audLbl">Original audio · preserved forever <span>— your spoken telling, separate from any later editing</span></div>
      <div class="audTrack" role="slider" ${audioId ? `tabindex="0" data-seek-audio="${attr(audioId)}"` : 'aria-disabled="true"'} aria-label="Original audio playback position" aria-valuemin="0" aria-valuemax="${Math.max(0, Math.round(durationMs / 1000))}" aria-valuenow="${Math.max(0, Math.round(current))}" aria-valuetext="${esc(formatDuration(current * 1000))} of ${esc(duration)}"><i style="width:${percent.toFixed(2)}%"></i></div>
      ${compact ? '' : `<div class="audWave" aria-hidden="true">${Array.from({ length: 46 }, (_, index) => `<i class="${index / 46 <= percent / 100 ? 'hot' : ''}" style="height:${4 + Math.abs(Math.sin(index * 1.7)) * 12}px"></i>`).join('')}</div>`}
      <div class="audioStatus" role="status" aria-live="polite"></div>
    </div>
    <div class="audTime"><span data-audio-current>${esc(formatDuration(current * 1000))}</span> / <span data-audio-total>${esc(duration)}</span></div>
  </div>`;
  return compact
    ? card
    : `${card}<div class="audioBridge">Original audio → transcribed below as the Original telling → edit safely in the Working version</div>`;
}

const HISTORY_ACTION_LABELS = Object.freeze({
  'story.captured': 'Captured the story',
  'story.working_version_edited': 'Edited the working version',
  'story.revised_and_resubmitted': 'Revised and resubmitted',
  'story.title_renamed': 'Renamed the story',
  'story.lesson_edited': 'Updated the lesson',
  'story.student_score_updated': 'Updated own rating',
  'story.student_star_updated': 'Updated own star',
  'story.submitted': 'Submitted for review',
  'story.resubmitted': 'Resubmitted for review',
  'story.opened': 'Opened the story for review',
  'story.feedback_opened': 'Opened mentor feedback',
  'story.status_changed': 'Changed review status',
  'story.feedback_added': 'Left feedback',
  'story.ask_added': 'Asked a reflection question',
  'story.reflection_prompt_added': 'Added a reflection prompt',
  'story.ask_answered': 'Answered a mentor question',
  'story.reflection_answered': 'Answered a reflection prompt',
  'story.evaluation_updated': 'Updated scores or classifications',
  'story.use_suggested': 'Suggested an interview use',
  'story.use_suggestion_withdrawn': 'Withdrew an interview-use suggestion',
  'story.archived': 'Archived the story',
  'story.restored': 'Restored the story',
  'question.pair_created': 'Assigned an interview question',
  'question.pair_updated': 'Updated an interview-question pairing',
  'question.pair_reviewed': 'Reviewed an interview-question pairing',
  'question.pair_removed': 'Removed an interview-question pairing',
  'story.craft_updated': 'Updated Story Anatomy',
});

function historyValue(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function historyAction(event) {
  const action = String(event.action || '');
  if (HISTORY_ACTION_LABELS[action]) return HISTORY_ACTION_LABELS[action];
  return action
    .replace(/^[^.]+\./, '')
    .replaceAll('_', ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase()) || 'Recorded an action';
}

function historyDetail(event) {
  if (event.detail) return String(event.detail);
  const next = historyValue(firstDefined(event.new_value, event.newValue));
  if (next.status) return `to ${STATUS[canonicalStatus(next.status)]?.label || next.status}`;
  if (next.mentor_score != null) return `mentor score ${next.mentor_score}/5`;
  if (next.student_score != null) return `student score ${next.student_score}/5`;
  if (next.revision_no != null) return `revision ${next.revision_no}`;
  if (next.prompt) return `“${String(next.prompt).slice(0, 120)}”`;
  if (next.use_key) return String(next.use_key);
  return '';
}

function historyPrevious(event) {
  const previous = historyValue(firstDefined(event.previous_value, event.previousValue));
  if (previous.status) return STATUS[canonicalStatus(previous.status)]?.label || String(previous.status);
  if (previous.mentor_score != null) return `${previous.mentor_score}/5`;
  if (previous.student_score != null) return `${previous.student_score}/5`;
  if (previous.title) return String(previous.title);
  return '';
}

function storyHistoryMarkup(story) {
  const events = asArray(story.history);
  const visible = state.storyHistoryExpanded ? events : events.slice(0, 6);
  if (!visible.length) {
    return '<div class="stageHint">No audited story actions have been recorded yet.</div>';
  }
  return `${visible.map((event) => {
    const previous = historyPrevious(event);
    const detail = historyDetail(event);
    return `<div class="hRow"><span class="hw">${esc(formatDateTime(firstDefined(event.created_at, event.createdAt)))}</span><span><b>${esc(firstDefined(event.actor_display, event.actorDisplay, 'StoryForge system'))}</b> — ${esc(historyAction(event))}${detail ? ` · ${esc(detail)}` : ''}${previous ? ` <span class="prev">(was: ${esc(previous)})</span>` : ''}</span></div>`;
  }).join('')}${events.length > 6 && !state.storyHistoryExpanded
    ? `<button class="reflAdd" type="button" data-expand-story-history>Show full history (${events.length})</button>`
    : ''}`;
}

async function fetchStoryDetail(id, surface = 'workspace') {
  if (isMentor()) {
    try {
      await api.viewStory(id, surface);
    } catch (error) {
      if (![404, 405, 501].includes(error.status)) throw error;
    }
  }
  const story = unwrapStory(await api.story(id));
  state.mentorNoteDraft = null;
  if ((state.capabilities?.mentorNotesRead || canWriteMentorNotes()) && story.status !== 'private') {
    const payload = await optionalRequest(`/api/stories/${id}/mentor-notes`, { notes: [] });
    story.mentorNotes = asArray(payload?.notes).map(normalizeMentorNote);
  }
  if (state.capabilities?.storyMedia) {
    const payload = await api.storyMedia(id);
    story.media = asArray(payload?.media);
  }
  state.storyVersions = [];
  if (state.capabilities?.storyVersions) {
    const payload = await api.storyVersions(id);
    state.storyVersions = asArray(payload?.versions);
  }
  return story;
}

async function openStory(id, completionIntent = null) {
  state.returnFocus = document.activeElement;
  state.storyCompletionIntent = completionIntent;
  room.innerHTML = `<div class="roomSheet">${loadingView('Opening the complete story workspace…')}</div>`;
  room.classList.add('open');
  try {
    state.storyDetail = await fetchStoryDetail(id, 'workspace');
    state.storyTab = completionIntent ? 'working' : state.storyDetail.revised ? 'working' : 'original';
    state.storyHistoryExpanded = false;
    renderStoryRoom();
    room.scrollTop = 0;
    updateStoryCompletionGuidance($('#storyEditForm', room), { focusFirst: Boolean(completionIntent) });
  } catch (error) {
    state.storyCompletionIntent = null;
    closeOverlay(room);
    notify(error.message);
  }
}

async function reloadStorySurface(surface = 'room') {
  const id = state.storyDetail?.id || state.quick?.currentId;
  if (!id) return;
  const story = await fetchStoryDetail(id, surface);
  state.storyDetail = story;
  state.stories = state.stories.map((item) => item.id === story.id ? story : item);
  renderShell();
  if (room.classList.contains('open')) renderStoryRoom();
  if (quick.classList.contains('open')) {
    state.quick.story = story;
    renderQuick();
  }
}

function normalizeStoryMedia(raw = {}) {
  return {
    ...raw,
    id: String(firstDefined(raw.id, raw.mediaId, raw.media_id, '')),
    kind: String(firstDefined(raw.kind, raw.media_kind, 'photo')),
    mimeType: String(firstDefined(raw.mimeType, raw.mime_type, '')),
    byteSize: Number(firstDefined(raw.byteSize, raw.byte_size, 0)) || 0,
    durationMs: Number(firstDefined(raw.durationMs, raw.duration_ms, 0)) || 0,
    caption: String(firstDefined(raw.caption, '')),
    sortOrder: Number(firstDefined(raw.sortOrder, raw.sort_order, 0)) || 0,
    rowVersion: Number(firstDefined(raw.rowVersion, raw.row_version, 0)) || 0,
    createdAt: isoValue(firstDefined(raw.createdAt, raw.created_at)),
  };
}

function storyMediaMarkup(story) {
  if (!state.capabilities?.storyMedia) return '';
  const media = asArray(story.media).map(normalizeStoryMedia);
  return `<section class="b1512StoryMedia" aria-labelledby="storyMediaTitle">
    <div class="b1512MediaHead"><div><div class="lbl" id="storyMediaTitle">Photos &amp; short videos</div><p class="stageHint">Private media stays with this story. Photos: JPEG, PNG, WebP up to 5 MB. Videos: MP4 or WebM up to 50 MB and 60 seconds.</p></div><span class="rolePill">${media.length}/12</span></div>
    ${media.length ? `<div class="b1512MediaGrid">${media.map((item, index) => `<article class="b1512MediaCard" data-story-media-card="${attr(item.id)}">
      <button class="b1512MediaPreview" type="button" data-story-media-open="${attr(item.id)}" data-story-media-kind="${attr(item.kind)}" aria-label="Open ${item.kind === 'photo' ? 'photo' : 'video'}${item.caption ? `: ${attr(item.caption)}` : ''}"><span>Loading private ${esc(item.kind)}…</span></button>
      <div class="b1512MediaMeta"><span>${item.kind === 'photo' ? 'Photo' : `Video · ${formatDuration(item.durationMs)}`} · ${esc(formatDate(item.createdAt))}</span>
      ${isStudent() ? `<form data-story-media-meta="${attr(item.id)}"><label class="srOnly" for="media-caption-${attr(item.id)}">Photo or video description</label><input id="media-caption-${attr(item.id)}" value="${attr(item.caption)}" maxlength="240" placeholder="Add a short description"><input type="hidden" name="rowVersion" value="${item.rowVersion}"><input type="hidden" name="sortOrder" value="${item.sortOrder}"><div class="inlineActions"><button class="rowBtn" type="submit">Save description</button><button class="rowBtn" type="button" data-story-media-move="-1" data-story-media-id="${attr(item.id)}" ${index === 0 ? 'disabled' : ''}>Move earlier</button><button class="rowBtn" type="button" data-story-media-move="1" data-story-media-id="${attr(item.id)}" ${index === media.length - 1 ? 'disabled' : ''}>Move later</button><button class="rowBtn danger" type="button" data-story-media-remove="${attr(item.id)}">Remove</button></div></form>` : `<p>${esc(item.caption || 'No description provided.')}</p>`}</div>
    </article>`).join('')}</div>` : '<p class="storyEmpty">No photos or videos attached yet.</p>'}
    ${isStudent() && media.length < 12 ? `<form id="storyMediaUploadForm" class="b1512MediaUpload"><label class="rowBtn" for="storyMediaFile">Choose photo or short video</label><input id="storyMediaFile" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" required><label for="storyMediaCaption">Description <span>optional</span></label><input id="storyMediaCaption" maxlength="240" placeholder="What should you remember about this media?"><div class="b1512UploadProgress" data-story-media-progress hidden><i></i><span>Preparing private upload…</span></div><div class="inlineActions"><button class="rowBtn pri" type="submit">Attach privately</button><button class="rowBtn" type="button" data-story-media-cancel hidden>Cancel upload</button><button class="rowBtn" type="submit" data-story-media-retry hidden>Retry</button></div></form>` : ''}
  </section>`;
}

async function hydrateStoryMedia(root = room) {
  for (const button of $$('[data-story-media-open]', root)) {
    const id = button.dataset.storyMediaOpen;
    try {
      const result = await api.storyMediaPlayback(id);
      const [url] = playbackUrls(result);
      button.dataset.storyMediaUrl = url;
      if (button.dataset.storyMediaKind === 'photo') {
        button.innerHTML = `<img src="${attr(url)}" alt="${attr(button.getAttribute('aria-label') || 'Story photo')}">`;
      } else {
        button.innerHTML = '<span class="b1512VideoMark">▶</span><span>Play private video</span>';
      }
    } catch {
      button.innerHTML = '<span>Private preview unavailable · select to retry</span>';
    }
  }
}

function storyMediaVideoDuration(file) {
  if (!String(file?.type || '').startsWith('video/')) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      const durationMs = Math.round(video.duration * 1000);
      if (!Number.isFinite(durationMs) || durationMs < 1 || durationMs > 60_000) reject(new Error('Videos must be 60 seconds or shorter.'));
      else resolve(durationMs);
    };
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('StoryForge could not read this video.')); };
    video.src = url;
  });
}

function putStoryMedia(uploadUrl, file, progress, mediaId) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    state.storyMediaUpload = { xhr, mediaId };
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !progress) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      $('i', progress).style.width = `${percent}%`;
      $('span', progress).textContent = `Uploading privately… ${percent}%`;
    };
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Private media upload did not complete.'));
    xhr.onerror = () => reject(new Error('Private media upload was interrupted.'));
    xhr.onabort = () => reject(Object.assign(new Error('Private media upload canceled.'), { code: 'upload_canceled' }));
    xhr.send(file);
  });
}

async function uploadStoryMedia(form) {
  const file = $('#storyMediaFile', form)?.files?.[0];
  if (!file || !state.storyDetail) return;
  const progress = $('[data-story-media-progress]', form);
  progress.hidden = false;
  $('[data-story-media-cancel]', form).hidden = false;
  $('[data-story-media-retry]', form).hidden = true;
  let mediaId = null;
  try {
    const durationMs = await storyMediaVideoDuration(file);
    const allocation = await api.allocateStoryMedia(state.storyDetail.id, {
      mimeType: file.type,
      byteSize: file.size,
      caption: $('#storyMediaCaption', form)?.value || '',
    });
    mediaId = allocation.media.id;
    await putStoryMedia(allocation.upload.uploadUrl, file, progress, mediaId);
    $('span', progress).textContent = 'Verifying private media…';
    await api.verifyStoryMedia(mediaId, { durationMs });
    state.storyMediaUpload = null;
    await reloadStorySurface('workspace');
    notify('Private story media attached.', '✓');
  } catch (error) {
    if (mediaId) await api.removeStoryMedia(mediaId).catch(() => {});
    state.storyMediaUpload = null;
    $('span', progress).textContent = error.message || 'Private media upload failed.';
    $('[data-story-media-cancel]', form).hidden = true;
    $('[data-story-media-retry]', form).hidden = false;
    if (error.code !== 'upload_canceled') notify(error.message || 'Private media upload failed.');
  }
}

async function saveStoryMediaMetadata(form) {
  const id = form.dataset.storyMediaMeta;
  await api.updateStoryMedia(id, {
    caption: $('input:not([type="hidden"])', form)?.value || '',
    expectedVersion: Number($('[name="rowVersion"]', form)?.value),
    sortOrder: Number($('[name="sortOrder"]', form)?.value),
  });
  await reloadStorySurface('workspace');
  notify('Media description saved.', '✓');
}

async function moveStoryMedia(id, delta) {
  const media = asArray(state.storyDetail?.media).map(normalizeStoryMedia)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.createdAt.localeCompare(right.createdAt));
  const index = media.findIndex((item) => item.id === id);
  const destination = index + Number(delta);
  if (index < 0 || destination < 0 || destination >= media.length) return;
  const current = media[index];
  const neighbor = media[destination];
  await api.updateStoryMedia(current.id, { caption: current.caption, expectedVersion: current.rowVersion, sortOrder: neighbor.sortOrder });
  await api.updateStoryMedia(neighbor.id, { caption: neighbor.caption, expectedVersion: neighbor.rowVersion, sortOrder: current.sortOrder });
  await reloadStorySurface('workspace');
  notify('Media order saved.', '✓');
}

function adminReviewRailMarkup(story) {
  const notes = asArray(story.internalNotes);
  return `<form id="adminStoryReviewForm" class="railCard adminReviewForm">
    <div class="rLbl">Administrator review</div>
    <label class="fLbl" for="adminReviewStatus">Review status</label><select id="adminReviewStatus" class="releaseSelect">${['in_review', 'changes', 'reviewed', 'approved'].map((status) => `<option value="${status}" ${story.status === status ? 'selected' : ''}>${esc(STATUS[status].label)}</option>`).join('')}</select>
    <label class="fLbl" for="adminReviewScore">Administrator score</label><select id="adminReviewScore" class="releaseSelect"><option value="">Not scored</option>${[1, 2, 3, 4, 5].map((score) => `<option value="${score}" ${story.mentorScore === score ? 'selected' : ''}>${score} / 5</option>`).join('')}</select>
    <label class="fLbl" for="adminReviewSuitability">Story suitability</label><select id="adminReviewSuitability" class="releaseSelect"><option value="">Not classified</option>${Object.entries(SUITABILITY).map(([value, label]) => `<option value="${value}" ${story.reviewSuitability === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select>
    <label class="fLbl" for="adminStudentFeedback">Student-visible feedback</label><textarea id="adminStudentFeedback" rows="5" placeholder="The student will see this feedback and your administrator attribution."></textarea>
    <label class="fLbl" for="adminInternalNote">Internal administrator note</label><textarea id="adminInternalNote" class="internalNoteField" rows="4" placeholder="Visible only to StoryForge administrators."></textarea>
    <p class="stageHint">Internal notes never appear to students or mentors. Saving is version-checked and audit logged.</p>
    <button class="noteSend" type="submit">Save review</button>
  </form>${state.capabilities?.taxonomy ? `<div class="railCard b1511AdminTaxonomy"><div class="rLbl">Story categories</div>${categoryButtons(story, { admin: true })}<div class="rLbl b1511TaxonomyHeading">Where this story could be used</div>${intendedUseButtons(story, { admin: true })}</div>` : ''}<div class="railCard adminInternalNotes"><div class="rLbl">Internal administrator notes</div>${notes.length ? notes.map((note) => `<div class="noteItem"><div class="nt">${esc(note.body)}</div><div class="nd">${esc(firstDefined(note.adminName, note.admin_name, 'Administrator'))} · ${esc(formatDateTime(firstDefined(note.createdAt, note.created_at)))}</div></div>`).join('') : '<div class="stageHint">No internal notes.</div>'}</div>`;
}

function renderStoryRoom({ adminStory = null } = {}) {
  const story = adminStory || state.storyDetail;
  if (!story) return;
  const adminReviewer = Boolean(adminStory);
  const mentor = isMentor() || adminReviewer;
  const host = adminReviewer ? main : room;
  const versionTab = ['thirty_second', 'nnq_setup'].includes(state.storyTab) ? state.storyTab : null;
  const selectedVersion = versionTab
    ? state.storyVersions.find((version) => version.key === versionTab) || null
    : null;
  const originalTab = state.storyTab === 'original';
  const workingTab = state.storyTab === 'working';
  const title = originalTab ? story.originalTitle : story.title;
  const text = versionTab ? selectedVersion?.body || '' : originalTab ? story.originalText : story.text;
  const versionWords = versionTab ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const completionMissing = state.storyCompletionIntent
    ? storyCompletionMissing(story, state.storyCompletionIntent)
    : [];
  const incompleteText = completionMissing.some((item) => item.id === 'text');
  const incompleteLesson = completionMissing.some((item) => item.id === 'lesson');
  const incompleteCategories = completionMissing.some((item) => item.id === 'categories');
  const incompleteUses = completionMissing.some((item) => item.id === 'uses');

  host.innerHTML = `<div class="roomSheet ${adminReviewer ? 'adminStoryReview live' : ''}" ${adminReviewer ? 'role="region" data-view="admin-story"' : 'role="dialog" aria-modal="true"'} aria-labelledby="roomStoryTitle">
    <div class="roomTop">
      ${adminReviewer ? `<button class="backBtn" type="button" data-nav="student" data-nav-id="${attr(story.studentId)}">‹ ${esc(story.studentName)}’s submitted stories</button>` : `<button class="backBtn" type="button" data-close-overlay>‹ ${mentor ? `${esc(story.studentName)}’s stories` : 'Your library'}</button>`}
      <span class="eyebrow">Captured ${esc(formatDate(story.createdAt))}${story.captureType === 'audio' ? ' · from a voice note' : ''} · ${esc(developmentState(story))}</span>
    </div>
    ${mentor && story.revised ? `<div class="respStrip">✎ ${esc(story.studentName.split(/\s+/)[0])} revised this story after feedback (${esc(formatDateTime(story.studentRespondedAt || story.updatedAt))}). You’re looking at the revision — the original telling is one tab away.</div>` : ''}
    <div class="roomTitleWrap">
      ${story.prefixEnabled ? '<div class="roomPre">The One Where</div>' : ''}
      <h1 class="roomTitle" id="roomStoryTitle">${esc(story.title)}</h1>
    </div>
    <div class="roomMeta">
      ${statusChip(story)}
      ${visibilityChip(story)}
      ${scoreDots(story.studentScore, 'student', mentor ? 'Student’s own rating' : 'My rating')}
      ${story.status === 'private' ? '' : scoreDots(story.mentorScore, 'mentor', story.reviewedByRole === 'admin' ? 'Administrator score' : 'Mentor score')}
      ${birdMini(story)}
      <span class="flex-spacer"></span>
      <button class="rowBtn" type="button" data-open-assign="${attr(story.id)}">Assign interview questions</button>
    </div>
    ${state.storyCompletionIntent ? `<div class="b1512CompletionSummary" role="status" aria-live="polite" tabindex="-1" data-completion-summary data-complete="${completionMissing.length === 0}">
      <span class="b1512IncompleteIcon" aria-hidden="true">!</span>
      <span><strong>Please complete the items highlighted below.</strong> This will help you and your mentor understand and develop your story.<small data-completion-count>${completionMissing.length ? `${completionMissing.length} ${completionMissing.length === 1 ? 'item needs' : 'items need'} your attention.` : 'Everything required here is complete.'}</small></span>
    </div>` : ''}
    <div class="roomGrid">
      <div>
        ${audioMarkup(story)}
        <div class="voiceTabs" role="tablist" aria-label="Story versions">
          <button type="button" role="tab" class="${originalTab ? 'on' : ''}" aria-selected="${originalTab}" data-story-tab="original">Original telling</button>
          <button type="button" role="tab" class="${workingTab ? 'on' : ''}" aria-selected="${workingTab}" data-story-tab="working">Full Story <span class="srOnly">— Working version</span></button>
          ${state.capabilities?.storyVersions ? `<button type="button" role="tab" class="${versionTab === 'thirty_second' ? 'on' : ''}" aria-selected="${versionTab === 'thirty_second'}" data-story-tab="thirty_second">30-Second Version</button><button type="button" role="tab" class="${versionTab === 'nnq_setup' ? 'on' : ''}" aria-selected="${versionTab === 'nnq_setup'}" data-story-tab="nnq_setup">NNQ Setup</button>` : ''}
        </div>
        ${versionTab ? `<form id="storyVersionForm" data-version-key="${attr(versionTab)}" data-row-version="${attr(selectedVersion?.rowVersion || 0)}" data-save-mode="save">
          <div class="b1514VersionIntro"><div><span class="eyebrow">Purposeful telling</span><h2>${versionTab === 'thirty_second' ? '30-Second Version' : 'NNQ Setup'}</h2><p>${versionTab === 'thirty_second' ? 'Shape the essential moment for a concise interview response. Aim for about 75–90 spoken words (≈30 seconds).' : 'Set up the story so it naturally ends on a question you want the interviewer to ask.'}</p></div>${selectedVersion ? `<span class="cohortChip">Started ${esc(formatDate(selectedVersion.createdAt))} · ${selectedVersion.source === 'voice' ? '🎙 voice' : '⌨ typed'} · saved ${esc(formatDateTime(selectedVersion.updatedAt))}</span>` : '<span class="cohortChip">Not started — type it, or tell it out loud</span>'}</div>
          ${mentor ? `<div class="storyProse" data-empty="${text ? 'false' : 'true'}">${text ? esc(text) : '<span class="storyEmpty">This purposeful version has not been written yet.</span>'}</div>` : `<label class="srOnly" for="storyVersionText">${versionTab === 'thirty_second' ? '30-Second Version' : 'NNQ Setup'}</label><textarea class="storyProse storyProseEdit b1514VersionEditor" id="storyVersionText" maxlength="20000" placeholder="Keep the same truth. Shape this telling for its purpose.">${esc(text)}</textarea><div class="inlineActions"><button class="btnSave" type="submit">Save this version</button>${state.capabilities?.voiceCapture ? '<button class="rowBtn" type="button" data-version-voice>🎙 Speak instead of type</button>' : ''}${selectedVersion ? '<button class="rowBtn" type="button" data-version-mode="append">Append</button><button class="rowBtn" type="button" data-version-mode="retell">Retell from scratch</button>' : ''}<span class="saveState" data-version-voice-status>Every saved change remains in version history.</span></div>${selectedVersion?.audioAssetId ? `<div class="b1514VersionAudio"><button class="rowBtn" type="button" data-version-audio="${attr(selectedVersion.audioAssetId)}">▶ Play original telling</button><div data-version-audio-host></div></div>` : ''}`}
          ${!mentor ? `<div class="b1514VersionCount" data-version-word-count aria-live="polite">${versionWords ? `≈ ${versionWords} words${versionTab === 'thirty_second' ? ` · ${versionWords <= 95 ? 'inside' : 'over'} the ~30-second target` : ''}` : ''}</div><div class="origNote">Append adds to what’s here. Retell starts fresh — your previous telling is kept in this version’s history and can be restored.</div>` : ''}
          ${selectedVersion?.history?.length ? `<details class="b1514VersionHistory"><summary>Earlier tellings (${selectedVersion.history.length})</summary>${selectedVersion.history.map((revision) => `<article><p>${esc(revision.body)}</p><div class="inlineActions"><small>${esc(formatDateTime(revision.savedAt))} · ${revision.source === 'voice' ? '🎙 voice' : '⌨ typed'}</small>${revision.audioAssetId ? `<button class="rowBtn" type="button" data-version-audio="${attr(revision.audioAssetId)}">▶ Play original telling</button><div data-version-audio-host></div>` : ''}${!mentor ? `<button class="rowBtn" type="button" data-version-restore="${attr(revision.id)}">Restore this telling</button>` : ''}</div></article>`).join('')}</details>` : ''}
        </form>` : !mentor && workingTab ? `<form id="storyEditForm">
          <label class="srOnly" for="storyEditTitle">Story title</label>
          <input class="roomTitle roomTitleInput" id="storyEditTitle" value="${attr(story.title)}" required>
          ${presentationSectionVisible('workingVersion') ? `<div class="b1512CompletionField ${incompleteText ? 'b1512Incomplete' : ''}" data-completion-field="text">
            <label class="lbl" for="storyEditText">${esc(presentationSection('workingVersion').title)}</label>
            <textarea class="storyProse storyProseEdit" id="storyEditText" data-empty="${text ? 'false' : 'true'}" ${incompleteText ? `${state.storyCompletionIntent === 'submit' ? 'aria-invalid="true" ' : ''}aria-describedby="completion-help-text"` : ''} placeholder="Tell it like you’d tell a trusted friend. Don’t polish it — just get it down.">${esc(text)}</textarea>
            <p class="b1512IncompleteHelp" id="completion-help-text" data-completion-help="text" ${incompleteText ? '' : 'hidden'}>${esc(completionMissing.find((item) => item.id === 'text')?.message || '')}</p>
          </div>
          <div class="origNote">${esc(presentationSection('workingVersion').helper)}</div>` : `<input type="hidden" id="storyEditText" value="${attr(text)}">`}
          ${presentationSectionVisible('learningLesson') ? `<div class="lessonBlock b1512CompletionField ${incompleteLesson ? 'b1512Incomplete' : ''}" data-completion-field="lesson"><label class="lbl" for="storyLesson">${esc(presentationSection('learningLesson').title)}</label>
            <p class="stageHint">${esc(presentationSection('learningLesson').helper)}</p>
            <textarea class="lessonTxt lessonEdit" id="storyLesson" ${incompleteLesson ? 'aria-describedby="completion-help-lesson"' : ''} placeholder="One or two honest sentences. What did this leave you with?">${esc(story.lesson)}</textarea>
            <p class="b1512IncompleteHelp" id="completion-help-lesson" data-completion-help="lesson" ${incompleteLesson ? '' : 'hidden'}>${esc(completionMissing.find((item) => item.id === 'lesson')?.message || '')}</p>
          </div>` : '<input type="hidden" id="storyLesson" value="">'}
          <div class="inlineActions"><button class="btnSave" type="submit">Save working version</button><span class="saveState">Durable only after StoryForge confirms the save.</span></div>
        </form>` : `
          <div class="storyProse" data-empty="${text ? 'false' : 'true'}">${text ? esc(text) : '<span class="storyEmpty">No telling has been written yet.</span>'}</div>
          <div class="origNote">${originalTab ? '🔒 Preserved exactly as first told — your authentic voice, kept safe' : `${mentor ? `${esc(story.studentName.split(/\s+/)[0])}’s` : 'Your'} editable working copy — the original stays untouched`}</div>
          ${presentationSectionVisible('learningLesson') ? `<div class="lessonBlock"><div class="lbl">${esc(presentationSection('learningLesson').title)}</div>
            <div class="lessonTxt">${story.lesson ? esc(story.lesson) : '<span class="storyEmpty">No lesson added yet.</span>'}</div>
          </div>` : ''}`}

        ${storyMediaMarkup(story)}
        <div class="reflBlock">
          <div class="eyebrow">Reflection</div>
          ${story.reflections.length ? story.reflections.map((reflection) => `<div class="reflQ ${reflectionFromMentor(reflection) ? 'fromMentor' : ''}">
            <div class="qTag">${reflectionFromMentor(reflection) ? `${esc(firstDefined(reflection.author_name, feedbackAuthor(reflection)))} asks` : 'Prompt'}</div>
            <div class="q">${esc(reflectionQuestion(reflection))}</div>
            ${mentor ? `<div class="a">${esc(reflectionAnswer(reflection)) || '<span class="storyEmpty">Waiting for the student’s reflection.</span>'}</div>` : `<textarea class="a" data-reflection-answer="${attr(reflection.id)}" placeholder="Write what this brings up…">${esc(reflectionAnswer(reflection))}</textarea>
              <button class="rowBtn" type="button" data-save-reflection="${attr(reflection.id)}">Save reflection</button>`}
          </div>`).join('') : '<div class="storyEmpty">No reflection prompts yet.</div>'}
          ${mentor && !adminReviewer ? `<div class="askRow"><input id="mentorAskText" placeholder="Ask ${esc(story.studentName.split(/\s+/)[0])} a question that deepens this story…"><button class="noteSend" type="button" data-send-ask>Ask</button></div>`
            : '<button class="reflAdd" type="button" data-add-reflection>+ Pull another reflection prompt</button>'}
        </div>
      </div>

      <aside>
        ${visibilityCard(story, mentor)}
        ${adminReviewer ? adminReviewRailMarkup(story) : presentationSectionVisible('reviewSubmission') ? `<div class="railCard ${mentor ? 'advPanel' : ''}">
          <div class="rLbl">${esc(presentationSection('reviewSubmission').title)}</div>
          <div>${statusChip(story)}</div>
          <div class="stageHint">${esc(presentationSection('reviewSubmission').helper || STATUS[story.status].hint)}</div>
          ${mentor ? `<div class="statusRow">${['in_review', 'changes', 'reviewed', 'approved'].map((status) => `<button type="button" data-set-status="${status}" class="${story.status === status ? `on ${STATUS[status].col}` : ''}">${esc(STATUS[status].label)}</button>`).join('')}</div>`
            : ['private', 'changes'].includes(story.status) ? studentReviewAction(story)
              : story.status === 'awaiting' && state.capabilities?.submissionReview ? `<div class="b1511Withdraw"><button class="rowBtn" type="button" data-withdraw-story>Return to Private</button><p class="stageHint">This removes reviewer access until you submit the story again.</p></div>` : ''}
          ${story.reviewSuitability ? `<div class="reviewSuitability"><span class="fLbl">Reviewer classification</span><span class="cohortChip">${esc(SUITABILITY[story.reviewSuitability] || story.reviewSuitability)}</span></div>` : ''}
          <div class="tsList">${storyTimestamps(story)}</div>
        </div>` : ''}

        <div class="railCard">
          <div class="rLbl">Scores</div>
          <div class="fLbl">${mentor ? `${esc(story.studentName.split(/\s+/)[0])}’s own rating` : 'My rating — how much this story matters to you'}</div>
          ${mentor ? `<span class="scoreTag">${story.studentScore ? `<b>${story.studentScore}</b>/5` : 'not rated yet'}</span>` : scorePicker('room-student', story.studentScore)}
          <div class="fLbl">${story.reviewedByRole === 'admin' ? 'Administrator' : 'Mentor'} score${story.reviewedByName ? ` — ${esc(story.reviewedByName)}` : ''}</div>
          ${mentor && !adminReviewer ? scorePicker('room-mentor', story.mentorScore, true) : `<span class="scoreTag">${story.mentorScore ? `<b>${story.mentorScore}</b>/5` : 'not scored yet'}</span>`}
          <div class="classChips">
            <button class="starBtn ${story.studentStar ? 'on' : ''}" type="button" data-toggle-star="${attr(story.id)}" data-star-kind="student" ${mentor ? 'disabled' : ''}>★</button><span>Student star</span>
            <button class="starBtn mentor ${story.mentorStar ? 'on' : ''}" type="button" data-toggle-star="${attr(story.id)}" data-star-kind="mentor" ${mentor && !adminReviewer ? '' : 'disabled'}>★</button><span>Mentor star</span>
          </div>
        </div>

        <div class="railCard"><div class="rLbl">Classification</div>${classificationButtons(story)}</div>
        ${state.capabilities?.taxonomy && presentationSectionVisible('storyCategories') ? `<div class="railCard b1512CompletionField ${incompleteCategories ? 'b1512Incomplete' : ''}" data-completion-field="categories"><div class="rLbl">${esc(presentationSection('storyCategories').title)}</div>
          <p class="stageHint">${esc(presentationSection('storyCategories').helper)}</p>
          ${categoryButtons(story, adminReviewer ? { admin: true } : { readOnly: mentor })}
          <p class="b1512IncompleteHelp" data-completion-help="categories" ${incompleteCategories ? '' : 'hidden'}>${esc(completionMissing.find((item) => item.id === 'categories')?.message || '')}</p>
        </div>` : ''}
        <div class="railCard">
          <div class="rLbl">Interview questions <button class="pMore" type="button" data-open-assign="${attr(story.id)}">Assign ▸</button></div>
          ${mappedQuestionMarkup(story)}
        </div>
        ${presentationSectionVisible('intendedUses') ? `<div class="railCard b1512CompletionField ${incompleteUses ? 'b1512Incomplete' : ''}" data-completion-field="uses">
          <div class="rLbl">${esc(presentationSection('intendedUses').title)}</div>
          <p class="stageHint">${esc(presentationSection('intendedUses').helper)}</p>
          ${state.capabilities?.taxonomy ? intendedUseButtons(story, adminReviewer ? { admin: true } : { readOnly: mentor }) : legacyIntendedUseButtons(story)}
          <p class="b1512IncompleteHelp" data-completion-help="uses" ${incompleteUses ? '' : 'hidden'}>${esc(completionMissing.find((item) => item.id === 'uses')?.message || '')}</p>
        </div>` : ''}
        ${story.status !== 'private' || mentor ? `<div class="railCard ${mentor ? '' : 'advPanel'}">
          <div class="rLbl label-cy">Mentor feedback</div>
          ${feedbackMarkup(story)}
          ${mentor && !adminReviewer ? `<div class="noteCompose"><textarea id="mentorFeedback" placeholder="Leave ${esc(story.studentName.split(/\s+/)[0])} feedback…"></textarea><button class="noteSend" type="button" data-send-feedback>Send feedback</button></div>` : ''}
        </div>` : ''}
        ${mentorNotesMarkup(story)}
        <div class="railCard">
          <div class="rLbl">History</div>
          ${storyHistoryMarkup(story)}
        </div>
      </aside>
    </div>
  </div>`;
  void hydrateStoryMedia(host);
}

async function openQuick(id) {
  state.returnFocus = document.activeElement;
  const ids = filteredStories().map((story) => story.id);
  state.quick = { ids: ids.includes(id) ? ids : [id], index: Math.max(0, ids.indexOf(id)), currentId: id, story: null };
  quick.innerHTML = `<div class="drawer">${loadingView('Opening Quick Look…')}</div>`;
  quick.classList.add('open');
  try {
    state.quick.story = await fetchStoryDetail(id, 'quick');
    renderQuick();
  } catch (error) {
    closeOverlay(quick);
    notify(error.message);
  }
}

function renderQuick() {
  const context = state.quick;
  const story = context?.story;
  if (!context || !story) return;
  const mentor = isMentor();
  quick.innerHTML = `
    <button class="qNavSide prev" type="button" data-quick-move="-1" ${context.index === 0 ? 'disabled' : ''} aria-label="Previous story">‹</button>
    <button class="qNavSide next" type="button" data-quick-move="1" ${context.index >= context.ids.length - 1 ? 'disabled' : ''} aria-label="Next story">›</button>
    <div class="drawer" role="dialog" aria-modal="true" aria-labelledby="quickTitle">
    <div class="drHead">
      <div>
        <div class="eyebrow">${mentor ? 'Quick review' : 'Quick look'}${mentor ? ` · ${esc(story.studentName)}` : ''} · ${context.index + 1} of ${context.ids.length}</div>
        <h2 class="h2" id="quickTitle">${story.prefixEnabled ? '<span class="roomPre">The One Where</span>' : ''}${esc(story.title)}</h2>
        <div class="inlineActions">${statusChip(story)}${birdMini(story)}<span class="scoreTag">${esc(developmentState(story))}</span></div>
      </div>
      <button class="drClose" type="button" data-close-overlay aria-label="Close Quick Look">✕</button>
    </div>
    <div class="drBody">
      ${audioMarkup(story, true)}
      <div class="drSec"><div class="dsLbl">The story</div><div class="drExc">${story.text ? esc(story.text) : '<span class="storyEmpty">No telling yet.</span>'}</div>
        ${story.lesson ? `<div class="qkLesson">Lesson: “${esc(story.lesson)}”</div>` : ''}</div>
      <div class="drSec"><div class="dsLbl">Review status</div>
        ${mentor ? `<div class="statusRow">${['in_review', 'changes', 'reviewed', 'approved'].map((status) => `<button type="button" data-set-status="${status}" class="${story.status === status ? `on ${STATUS[status].col}` : ''}">${esc(STATUS[status].label)}</button>`).join('')}</div>`
          : ['private', 'changes'].includes(story.status) ? studentReviewAction(story) : `<div class="stageHint">${esc(STATUS[story.status].hint)}</div>`}
        ${storyTimestamps(story)}
      </div>
      <div class="drSec"><div class="dsLbl">${mentor ? 'Your score (mentor)' : 'My rating — how much this story matters to me'}</div>
        ${scorePicker(mentor ? 'quick-mentor' : 'quick-student', mentor ? story.mentorScore : story.studentScore, mentor)}
        <div class="stageHint">${mentor ? `${esc(story.studentName.split(/\s+/)[0])}’s own rating: ${story.studentScore || 'not rated'}` : `Mentor score: ${story.mentorScore || 'not scored yet'}`}</div>
        <button class="quickStar starBtn ${mentor ? 'mentor' : ''} ${(mentor ? story.mentorStar : story.studentStar) ? 'on' : ''}" type="button"
          data-toggle-star="${attr(story.id)}" data-star-kind="${mentor ? 'mentor' : 'student'}"
          aria-pressed="${mentor ? story.mentorStar : story.studentStar}">★ <span>${mentor ? 'Star as mentor' : 'Star this story'}</span></button>
      </div>
      <div class="drSec"><div class="dsLbl">Classification</div>${classificationButtons(story, 'quick')}</div>
      ${state.capabilities?.taxonomy ? `<div class="drSec"><div class="dsLbl">Story categories</div>${categoryButtons(story, { readOnly: mentor })}</div>` : ''}
      <div class="drSec"><div class="dsLbl">Interview questions (${story.mappings.length}) <button class="pMore" type="button" data-open-assign="${attr(story.id)}">Assign ▸</button></div>${mappedQuestionMarkup(story, 4)}</div>
      <div class="drSec"><div class="dsLbl">${mentor ? 'Leave feedback' : 'Mentor feedback'}</div>${feedbackMarkup(story)}
        ${mentor ? `<div class="noteCompose"><textarea id="quickFeedback" placeholder="Feedback for ${esc(story.studentName.split(/\s+/)[0])}…"></textarea><button class="noteSend" type="button" data-send-feedback data-feedback-source="quick">Send feedback</button></div>` : ''}
      </div>
    </div>
    <div class="drFoot">
      <button class="rowBtn" type="button" data-quick-move="-1" ${context.index === 0 ? 'disabled' : ''}>‹ Previous</button>
      <button class="rowBtn" type="button" data-quick-move="1" ${context.index >= context.ids.length - 1 ? 'disabled' : ''}>Next ›</button>
      <span class="flex-spacer"></span>
      <button class="rowBtn pri" type="button" data-quick-full="${attr(story.id)}">Open full story</button>
    </div>
  </div>`;
}

async function moveQuick(delta) {
  if (!state.quick) return;
  const index = state.quick.index + Number(delta);
  if (index < 0 || index >= state.quick.ids.length) return;
  stopAudioPlayback();
  state.quick.index = index;
  state.quick.currentId = state.quick.ids[index];
  quick.innerHTML = `<div class="drawer">${loadingView('Opening next story…')}</div>`;
  state.quick.story = await fetchStoryDetail(state.quick.currentId, 'quick');
  renderQuick();
}

async function saveStoryEdit(form) {
  const story = state.storyDetail;
  if (!story) return;
  const resubmitting = story.status === 'changes'
    && $('#storyEditText', form).value.trim() !== story.text;
  const result = await withBusy(() => api.updateStory(story.id, {
    title: $('#storyEditTitle', form).value.trim(),
    text: $('#storyEditText', form).value.trim(),
    lesson: $('#storyLesson', form).value.trim(),
    prefixEnabled: story.prefixEnabled,
    expectedVersion: story.rowVersion ?? 0,
    surface: 'workspace',
  }));
  if (!result) return;
  await reloadStorySurface('workspace');
  notify(resubmitting
    ? 'Revision saved and returned to Awaiting review. Your mentor will see that it needs another review.'
    : 'Working version saved. The original telling remains preserved.');
}

async function submitCurrentStory() {
  const story = quick.classList.contains('open') ? state.quick?.story : state.storyDetail;
  if (!story) return;
  const missing = storyCompletionMissing(story, 'submit');
  if (missing.length) {
    if (quick.classList.contains('open')) {
      const id = story.id;
      closeOverlay(quick);
      await openStory(id, 'submit');
      notify('Please complete the highlighted Working version before submitting for review.');
      return;
    }
    const existingForm = $('#storyEditForm', room);
    const unsaved = existingForm ? {
      title: $('#storyEditTitle', existingForm)?.value,
      text: $('#storyEditText', existingForm)?.value,
      lesson: $('#storyLesson', existingForm)?.value,
    } : null;
    state.storyCompletionIntent = 'submit';
    state.storyTab = 'working';
    renderStoryRoom();
    const nextForm = $('#storyEditForm', room);
    if (unsaved && nextForm) {
      $('#storyEditTitle', nextForm).value = unsaved.title;
      $('#storyEditText', nextForm).value = unsaved.text;
      $('#storyLesson', nextForm).value = unsaved.lesson;
    }
    updateStoryCompletionGuidance(nextForm, { focusFirst: true });
    notify('Please complete the highlighted Working version before submitting for review.');
    return;
  }
  await withBusy(() => api.submitStory(story.id, room.classList.contains('open') ? 'workspace' : 'quick'));
  state.storyCompletionIntent = null;
  await reloadStorySurface(room.classList.contains('open') ? 'workspace' : 'quick');
  notify(story.status === 'changes' ? 'Resubmitted. Your mentor will see that it needs another review.' : 'Submitted for review.');
}

async function withdrawCurrentStory() {
  const story = state.storyDetail;
  if (!story || !isStudent() || !state.capabilities?.submissionReview || story.status !== 'awaiting') return;
  await withBusy(() => api.withdrawStory(story.id, {
    expectedVersion: story.rowVersion ?? 0,
    surface: 'workspace',
  }));
  await reloadStorySurface('workspace');
  notify('Story returned to Private. Reviewer access has been removed.');
}

async function setCurrentStatus(status) {
  const story = state.storyDetail || state.quick?.story;
  if (!story || !isMentor()) return;
  await withBusy(async () => {
    try {
      return await api.storyStatus(story.id, status, room.classList.contains('open') ? 'workspace' : 'quick');
    } catch (error) {
      if (![404, 405, 501].includes(error.status)) throw error;
      return api.legacyReview(story.id, {
        status: serverStatus(status),
        mentorScore: story.mentorScore || null,
        feedback: null,
        needsFollowup: status === 'changes',
        classification: story.birds[0] || null,
        surface: room.classList.contains('open') ? 'workspace' : 'quick',
      });
    }
  });
  await reloadStorySurface(room.classList.contains('open') ? 'workspace' : 'quick');
  notify(`Status set to “${STATUS[status].label}” — saved with your name and time.`);
}

async function updateEvaluation(patch) {
  const story = state.storyDetail || state.quick?.story || state.stories.find((item) => item.id === patch.storyId);
  if (!story) return;
  const body = { ...patch, surface: room.classList.contains('open') ? 'workspace' : quick.classList.contains('open') ? 'quick' : 'library' };
  delete body.storyId;
  await withBusy(async () => {
    try {
      return await api.evaluation(story.id, body);
    } catch (error) {
      if (![404, 405, 501].includes(error.status) || isMentor()) throw error;
      return api.updateStory(story.id, {
        title: story.title,
        text: story.text,
        studentScore: body.studentScore,
        uses: story.uses,
        surface: body.surface,
      });
    }
  });
  if (room.classList.contains('open') || quick.classList.contains('open')) await reloadStorySurface(body.surface);
  else {
    await loadStories();
    renderRoute();
  }
}

async function toggleStar(id, kind = isMentor() ? 'mentor' : 'student') {
  const story = state.storyDetail?.id === id ? state.storyDetail
    : state.quick?.story?.id === id ? state.quick.story
      : state.stories.find((item) => item.id === id);
  if (!story) return;
  const libraryRow = $(`[data-story-row="${CSS.escape(id)}"]`, $('#libraryRows') || document);
  if (libraryRow && !room.classList.contains('open') && !quick.classList.contains('open')) {
    if (libraryMutationIds.has(id)) return;
    const field = kind === 'mentor' ? 'mentorStar' : 'studentStar';
    const previous = story;
    const optimistic = { ...story, [field]: !story[field] };
    const button = $('[data-toggle-star]', libraryRow);
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    libraryMutationIds.add(id);
    replaceStoryInState(optimistic);
    button?.classList.toggle('on', optimistic[field]);
    button?.setAttribute('aria-pressed', String(optimistic[field]));
    try {
      const result = await api.evaluation(id, {
        [field]: optimistic[field],
        expectedVersion: story.rowVersion ?? 0,
        surface: 'library',
      });
      const saved = unwrapStory({ ...optimistic, ...(result?.story || result) });
      replaceStoryInState(saved);
      button?.classList.toggle('on', saved[field]);
      button?.setAttribute('aria-pressed', String(saved[field]));
      if (state.library.star) renderLibraryRowsOnly();
      notify(`${kind === 'mentor' ? 'Mentor' : 'Story'} star ${saved[field] ? 'added' : 'removed'}.`);
    } catch (error) {
      replaceStoryInState(previous);
      button?.classList.toggle('on', previous[field]);
      button?.setAttribute('aria-pressed', String(previous[field]));
      notify(error.status === 409
        ? 'Star changed elsewhere. The previous value was restored.'
        : (error.message || 'Star was not saved. The previous value was restored.'));
    } finally {
      libraryMutationIds.delete(id);
      button?.focus({ preventScroll: true });
      window.scrollTo(scrollX, scrollY);
    }
    return;
  }
  const patch = kind === 'mentor'
    ? { storyId: id, mentorStar: !story.mentorStar }
    : { storyId: id, studentStar: !story.studentStar };
  await updateEvaluation(patch);
  notify(`${kind === 'mentor' ? 'Mentor' : 'Story'} star ${kind === 'mentor' ? !story.mentorStar : !story.studentStar ? 'added' : 'updated'}.`);
}

async function toggleClassification(kind, id) {
  const story = state.storyDetail || state.quick?.story;
  if (!story) return;
  const values = story[kind].includes(id) ? story[kind].filter((value) => value !== id) : [...story[kind], id];
  await updateEvaluation({ storyId: story.id, [kind]: values });
  notify('Classification saved.');
}

async function updateStoryTaxonomy(kind, id) {
  const story = state.storyDetail || state.quick?.story;
  if (!story || !isStudent() || !state.capabilities?.taxonomy || !['categories', 'uses'].includes(kind)) return;
  const previous = [...story[kind]];
  const values = previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id];
  story[kind] = values;
  const button = $(`[data-taxonomy="${CSS.escape(id)}"][data-taxonomy-kind="${kind}"]`);
  button?.classList.toggle('on', values.includes(id));
  button?.setAttribute('aria-pressed', String(values.includes(id)));
  try {
    const result = await api.storyTaxonomy(story.id, {
      categories: kind === 'categories' ? values : story.categories,
      uses: kind === 'uses' ? values : story.uses,
      expectedVersion: story.rowVersion ?? 0,
      surface: 'workspace',
    });
    const saved = unwrapStory({ ...story, ...(result?.story || result) });
    state.storyDetail = state.storyDetail?.id === saved.id ? saved : state.storyDetail;
    if (state.quick?.story?.id === saved.id) state.quick.story = saved;
    state.stories = state.stories.map((item) => item.id === saved.id ? saved : item);
    if (room.classList.contains('open')) renderStoryRoom();
    if (quick.classList.contains('open')) renderQuick();
    notify(kind === 'categories' ? 'Story categories saved.' : 'Intended uses saved.');
  } catch (error) {
    story[kind] = previous;
    button?.classList.toggle('on', previous.includes(id));
    button?.setAttribute('aria-pressed', String(previous.includes(id)));
    notify(error.message || 'StoryForge could not save that classification.');
  }
}

async function toggleUse(id) {
  const story = state.storyDetail;
  if (!story) return;
  if (isMentor()) {
    const active = story.useSuggestions.some((item) => (
      firstDefined(item.useKey, item.use_key) === id
      && !firstDefined(item.withdrawnAt, item.withdrawn_at)
    ));
    await withBusy(() => api.useSuggestion(story.id, id, !active));
    await reloadStorySurface('workspace');
    notify(active ? 'Suggestion withdrawn.' : `Suggested to ${story.studentName.split(/\s+/)[0]}.`);
    return;
  }
  const uses = story.uses.includes(id) ? story.uses.filter((value) => value !== id) : [...story.uses, id];
  await withBusy(() => api.updateStory(story.id, {
    title: story.title,
    text: story.text,
    lesson: story.lesson,
    uses,
    expectedVersion: story.rowVersion ?? 0,
    surface: 'workspace',
  }));
  await reloadStorySurface('workspace');
  notify('Where it could serve saved.');
}

async function sendFeedback(source = 'room') {
  const story = state.storyDetail || state.quick?.story;
  const field = source === 'quick' ? $('#quickFeedback') : $('#mentorFeedback');
  const body = field?.value.trim();
  if (!story || !body || !isMentor()) return;
  await withBusy(async () => {
    try {
      return await api.feedback(story.id, { body, surface: source === 'quick' ? 'quick' : 'workspace' });
    } catch (error) {
      if (![404, 405, 501].includes(error.status)) throw error;
      return api.legacyReview(story.id, {
        feedback: body,
        status: serverStatus(story.status === 'awaiting' ? 'in_review' : story.status),
        mentorScore: story.mentorScore || null,
        needsFollowup: false,
        classification: story.birds[0] || null,
        surface: source === 'quick' ? 'quick' : 'workspace',
      });
    }
  });
  await reloadStorySurface(source === 'quick' ? 'quick' : 'workspace');
  notify('Feedback sent. The student was notified.');
}

async function sendAsk() {
  const story = state.storyDetail;
  const prompt = $('#mentorAskText')?.value.trim();
  if (!story || !prompt || !isMentor()) return;
  await withBusy(() => api.ask(story.id, prompt));
  await reloadStorySurface('workspace');
  notify('Reflection question sent to the student.');
}

async function addReflection() {
  const story = state.storyDetail;
  if (!story || isMentor()) return;
  const used = new Set(story.reflections.map(reflectionQuestion));
  const prompt = REFLECTION_PROMPTS.find((value) => !used.has(value));
  if (!prompt) {
    notify('You’ve pulled every reflection prompt for this story.');
    return;
  }
  await withBusy(() => api.addReflection(story.id, prompt));
  await reloadStorySurface('workspace');
}

async function saveReflection(id) {
  const story = state.storyDetail;
  const field = $(`[data-reflection-answer="${CSS.escape(id)}"]`);
  if (!story || !field || isMentor()) return;
  await withBusy(() => api.answerReflection(story.id, id, field.value.trim()));
  await reloadStorySurface('workspace');
  notify('Reflection saved.');
}

const audioReplay = {
  id: null,
  urls: [],
  index: 0,
  audio: null,
  phase: 'idle',
  completedSeconds: 0,
  currentSeconds: 0,
  totalSeconds: 0,
  retryUsed: false,
  generation: 0,
};

function audioReplayCards(id = audioReplay.id) {
  if (!id) return [];
  return $$(`[data-audio-card="${CSS.escape(String(id))}"]`);
}

function audioReplayStatus() {
  if (audioReplay.phase === 'loading') return 'Loading private audio…';
  if (audioReplay.phase === 'playing') return 'Playing original audio.';
  if (audioReplay.phase === 'paused') {
    return `Paused at ${formatDuration(audioReplay.currentSeconds * 1000)}.`;
  }
  if (audioReplay.phase === 'complete') return 'Original audio finished.';
  if (audioReplay.phase === 'error') return 'Playback unavailable. Try again.';
  return '';
}

function renderAudioReplayState({ announce = false } = {}) {
  const current = Math.max(0, Number(audioReplay.currentSeconds || 0));
  const total = Math.max(0, Number(audioReplay.totalSeconds || 0));
  const percent = total > 0 ? Math.min(100, (current / total) * 100) : 0;
  const phase = audioReplay.phase;
  for (const card of audioReplayCards()) {
    const button = $('[data-play-audio]', card);
    const track = $('.audTrack', card);
    const fill = $('.audTrack i', card);
    const status = $('.audioStatus', card);
    if (button) {
      const labels = {
        loading: 'Loading original audio',
        playing: 'Pause original audio',
        paused: 'Resume original audio',
        complete: 'Replay original audio',
        error: 'Retry original audio',
      };
      button.disabled = false;
      button.setAttribute('aria-busy', String(phase === 'loading'));
      button.setAttribute('aria-disabled', String(phase === 'loading'));
      button.setAttribute('aria-label', labels[phase] || 'Play original audio');
      button.textContent = phase === 'playing' ? '❚❚' : '▶';
    }
    if (fill) fill.style.width = `${percent.toFixed(2)}%`;
    if (track) {
      track.setAttribute('aria-valuemax', String(Math.round(total)));
      track.setAttribute('aria-valuenow', String(Math.round(current)));
      track.setAttribute(
        'aria-valuetext',
        `${formatDuration(current * 1000)} of ${total > 0 ? formatDuration(total * 1000) : 'unknown'}`,
      );
    }
    $('[data-audio-current]', card)?.replaceChildren(formatDuration(current * 1000));
    if (total > 0) {
      $('[data-audio-total]', card)?.replaceChildren(formatDuration(total * 1000));
    }
    $$('.audWave i', card).forEach((bar, index, bars) => {
      bar.classList.toggle('hot', index / bars.length <= percent / 100);
    });
    if (status && announce) {
      const next = audioReplayStatus();
      if (status.textContent !== next) status.textContent = next;
    }
  }
}

function stopAudioPlayback({ preserveCompletion = false } = {}) {
  const previousId = audioReplay.id;
  audioReplay.generation += 1;
  if (audioReplay.audio) {
    try {
      audioReplay.audio.pause?.();
      audioReplay.audio.removeAttribute?.('src');
      audioReplay.audio.load?.();
    } catch {
      // The player is already being discarded; no media detail is surfaced.
    }
  }
  if (previousId && !preserveCompletion) {
    Object.assign(audioReplay, {
      phase: 'idle',
      completedSeconds: 0,
      currentSeconds: 0,
    });
    renderAudioReplayState();
  }
  Object.assign(audioReplay, {
    id: preserveCompletion ? previousId : null,
    urls: [],
    index: 0,
    audio: null,
    phase: preserveCompletion ? 'complete' : 'idle',
    completedSeconds: preserveCompletion ? audioReplay.totalSeconds : 0,
    currentSeconds: preserveCompletion ? audioReplay.totalSeconds : 0,
    retryUsed: false,
  });
  if (previousId && preserveCompletion) renderAudioReplayState({ announce: true });
}

function playbackUrls(result) {
  const values = asArray(firstDefined(
    result?.playbackUrls,
    result?.playback_urls,
    [firstDefined(result?.playbackUrl, result?.playback_url, result?.url)].filter(Boolean),
  ));
  return values.map((value) => {
    const parsed = new URL(String(value));
    if (parsed.protocol !== 'https:') throw new Error('invalid_playback_url');
    return parsed.href;
  });
}

async function refreshAudioReplayUrls(expectedCount = 0) {
  const result = await api.audioPlayback(audioReplay.id);
  const urls = playbackUrls(result);
  if (!urls.length || (expectedCount && urls.length !== expectedCount)) {
    throw new Error('invalid_playback_manifest');
  }
  const durationMs = Number(firstDefined(result?.durationMs, result?.duration_ms, 0));
  if (durationMs > 0) audioReplay.totalSeconds = durationMs / 1000;
  audioReplay.urls = urls;
}

function failAudioPlayback() {
  const id = audioReplay.id;
  audioReplay.generation += 1;
  try {
    audioReplay.audio?.pause?.();
  } catch {
    // Failure is already represented by the bounded player state.
  }
  audioReplay.audio = null;
  audioReplay.phase = 'error';
  audioReplay.id = id;
  renderAudioReplayState({ announce: true });
  notify('Private audio playback could not start.');
}

function seekAudioReplay(id, targetSeconds) {
  if (String(id) !== String(audioReplay.id) || !audioReplay.audio) return false;
  const segmentDuration = Number(audioReplay.audio.duration);
  if (!Number.isFinite(segmentDuration) || segmentDuration <= 0) return false;
  const segmentStart = Math.max(0, Number(audioReplay.completedSeconds || 0));
  const absoluteTarget = Math.max(
    segmentStart,
    Math.min(segmentStart + segmentDuration, Number(targetSeconds || 0)),
  );
  try {
    audioReplay.audio.currentTime = absoluteTarget - segmentStart;
  } catch {
    return false;
  }
  audioReplay.currentSeconds = absoluteTarget;
  renderAudioReplayState({ announce: true });
  return true;
}

function seekAudioReplayFromTrack(track, clientX) {
  const bounds = track.getBoundingClientRect();
  if (!Number.isFinite(bounds.width) || bounds.width <= 0) return false;
  const ratio = Math.max(0, Math.min(1, (Number(clientX) - bounds.left) / bounds.width));
  return seekAudioReplay(track.dataset.seekAudio, ratio * audioReplay.totalSeconds);
}

async function recoverAudioReplaySegment(generation) {
  if (generation !== audioReplay.generation || audioReplay.retryUsed) {
    failAudioPlayback();
    return;
  }
  audioReplay.retryUsed = true;
  const resumeAt = Math.max(0, Number(audioReplay.audio?.currentTime || 0));
  try {
    await refreshAudioReplayUrls(audioReplay.urls.length);
    if (generation !== audioReplay.generation) return;
    await startAudioReplaySegment({ resumeAt, refresh: false, generation });
  } catch {
    if (generation === audioReplay.generation) failAudioPlayback();
  }
}

async function startAudioReplaySegment({
  resumeAt = 0,
  refresh = audioReplay.index > 0,
  generation = audioReplay.generation,
} = {}) {
  if (refresh) await refreshAudioReplayUrls(audioReplay.urls.length);
  if (generation !== audioReplay.generation) return;
  const url = audioReplay.urls[audioReplay.index];
  if (!url) throw new Error('invalid_playback_manifest');
  const audio = new Audio(url);
  audioReplay.audio = audio;
  audio.preload = 'metadata';
  const currentTime = () => Math.max(0, Number(audio.currentTime || 0));
  audio.addEventListener('loadedmetadata', () => {
    if (generation !== audioReplay.generation || resumeAt <= 0) return;
    try {
      audio.currentTime = Math.min(resumeAt, Number(audio.duration) || resumeAt);
    } catch {
      // A media element that cannot restore its offset will retry from its start.
    }
  }, { once: true });
  audio.addEventListener('timeupdate', () => {
    if (generation !== audioReplay.generation) return;
    audioReplay.currentSeconds = audioReplay.completedSeconds + currentTime();
    renderAudioReplayState();
  });
  audio.addEventListener('play', () => {
    if (generation !== audioReplay.generation) return;
    audioReplay.phase = 'playing';
    renderAudioReplayState({ announce: true });
  });
  audio.addEventListener('pause', () => {
    if (generation !== audioReplay.generation || audio.ended) return;
    audioReplay.currentSeconds = audioReplay.completedSeconds + currentTime();
    audioReplay.phase = 'paused';
    renderAudioReplayState({ announce: true });
  });
  audio.addEventListener('ended', () => {
    if (generation !== audioReplay.generation) return;
    const segmentSeconds = Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : currentTime();
    audioReplay.completedSeconds += segmentSeconds;
    audioReplay.currentSeconds = audioReplay.completedSeconds;
    audioReplay.index += 1;
    audioReplay.retryUsed = false;
    if (audioReplay.index >= audioReplay.urls.length) {
      if (audioReplay.totalSeconds <= 0) audioReplay.totalSeconds = audioReplay.currentSeconds;
      stopAudioPlayback({ preserveCompletion: true });
      return;
    }
    audioReplay.phase = 'loading';
    renderAudioReplayState({ announce: true });
    void startAudioReplaySegment({ generation }).catch(() => {
      if (generation === audioReplay.generation) failAudioPlayback();
    });
  }, { once: true });
  audio.addEventListener('error', () => {
    if (generation === audioReplay.generation) {
      void recoverAudioReplaySegment(generation);
    }
  }, { once: true });
  try {
    await audio.play();
  } catch {
    if (generation === audioReplay.generation) {
      await recoverAudioReplaySegment(generation);
    }
    return;
  }
  if (generation === audioReplay.generation && audioReplay.phase === 'loading') {
    audioReplay.phase = 'playing';
    renderAudioReplayState({ announce: true });
  }
}

async function playAudio(id) {
  const targetId = String(id);
  if (audioReplay.id === targetId && audioReplay.phase === 'playing') {
    audioReplay.audio?.pause?.();
    if (audioReplay.phase === 'playing') {
      audioReplay.phase = 'paused';
      renderAudioReplayState({ announce: true });
    }
    return;
  }
  if (audioReplay.id === targetId && audioReplay.phase === 'paused') {
    try {
      await audioReplay.audio?.play?.();
      audioReplay.phase = 'playing';
      renderAudioReplayState({ announce: true });
    } catch {
      await recoverAudioReplaySegment(audioReplay.generation);
    }
    return;
  }
  if (audioReplay.id === targetId && audioReplay.phase === 'loading') return;
  stopAudioPlayback();
  const card = audioReplayCards(targetId)[0];
  Object.assign(audioReplay, {
    id: targetId,
    phase: 'loading',
    totalSeconds: Math.max(0, Number(card?.dataset.audioTotalMs || 0) / 1000),
  });
  const generation = audioReplay.generation;
  renderAudioReplayState({ announce: true });
  try {
    await refreshAudioReplayUrls();
    if (generation !== audioReplay.generation) return;
    await startAudioReplaySegment({ refresh: false, generation });
  } catch {
    if (generation === audioReplay.generation) failAudioPlayback();
  }
}

async function openAssign(storyId) {
  state.returnFocus = document.activeElement;
  state.assign = { storyId, query: '' };
  qad.innerHTML = `<div class="drawer">${loadingView('Opening the question library…')}</div>`;
  qad.classList.add('open');
  try {
    if (!state.questions.length) await loadQuestions();
    if (state.storyDetail?.id !== storyId && state.quick?.story?.id !== storyId) {
      state.storyDetail = await fetchStoryDetail(storyId, 'assign');
    }
    renderAssign();
  } catch (error) {
    closeOverlay(qad);
    notify(error.message);
  }
}

function renderAssign() {
  const context = state.assign;
  const story = state.storyDetail?.id === context?.storyId ? state.storyDetail : state.quick?.story;
  if (!context || !story) return;
  const query = context.query.trim().toLowerCase();
  const pairs = story.mappings.map(normalizePair);
  const families = [...new Set(state.questions.map((question) => question.family))];
  qad.innerHTML = `<div class="drawer" role="dialog" aria-modal="true" aria-labelledby="assignTitle">
    <div class="drHead"><div><div class="eyebrow">Assign interview questions</div><h2 class="h2" id="assignTitle">“${esc(story.title)}”</h2>
      <div class="stageHint">Pick every question this story could answer, then score how well it answers each one. Strength belongs to this exact story–question pair.</div></div>
      <button class="drClose" type="button" data-close-overlay aria-label="Close question assignment">✕</button>
    </div>
    <div class="drBody">
      <input type="search" id="assignSearch" placeholder="Search questions…" value="${attr(context.query)}">
      ${families.map((family) => {
        const questions = state.questions.filter((question) => question.family === family && (!query || question.text.toLowerCase().includes(query)));
        if (!questions.length) return '';
        const familyMeta = FAMILIES.find((item) => item.id === family);
        return `<div class="drSec"><div class="dsLbl">${esc(familyMeta?.label || family)}</div>
          ${questions.map((question) => {
            const pair = pairs.find((item) => item.questionId === question.id);
            return `<div class="qaRow ${pair ? 'sel' : ''}">
              <div class="qaTop">
                <button class="qaCk" type="button" data-toggle-pair="${attr(question.id)}" aria-pressed="${Boolean(pair)}">✓</button>
                <div><div class="qq2">${esc(question.text)}</div>${pair ? `<div class="qaHist">${pair.confirmed ? 'Assigned' : 'Suggested'}${pair.proposedBy ? ` by ${esc(pair.proposedBy)}` : ''}</div>` : ''}</div>
                ${pair ? `<span class="qaState">${pair.confirmed ? 'assigned' : 'suggested'}</span>` : ''}
              </div>
              ${pair ? `<div class="qaCtl"><span class="fLbl">Strength — this story vs this question</span>
                ${scorePicker(`pair-${attr(pair.id)}-${isMentor() ? 'mentor' : 'student'}`, isMentor() ? pair.mentorStrength : pair.studentStrength, isMentor())}
                <span class="stageHint">${isMentor() ? `self: ${pair.studentStrength || '—'}/5` : `mentor: ${pair.mentorStrength || '—'}/5`}</span>
                ${isMentor() && !pair.confirmed ? `<button class="rowBtn pri" type="button" data-confirm-pair="${attr(pair.id)}">Confirm</button><button class="rowBtn" type="button" data-reject-pair="${attr(pair.id)}">Reject</button>` : ''}
              </div>` : ''}
            </div>`;
          }).join('')}
        </div>`;
      }).join('')}
      <div class="drSec"><div class="dsLbl">Custom questions</div><p class="stageHint">Custom questions are governed records. Add and review them in the Question Library.</p><button class="rowBtn" type="button" data-go-question-library>Open Question Library</button></div>
    </div>
    <div class="drFoot"><span>${pairs.length} question${pairs.length === 1 ? '' : 's'} on this story · every confirmed change is logged</span><button class="rowBtn pri" type="button" data-close-overlay>Done</button></div>
  </div>`;
}

async function refreshAssignedStory() {
  const id = state.assign?.storyId;
  if (!id) return;
  const story = await fetchStoryDetail(id, 'assign');
  state.storyDetail = story;
  if (state.quick?.story?.id === id) state.quick.story = story;
  renderAssign();
}

async function togglePair(questionId) {
  const story = state.storyDetail;
  if (!story) return;
  const pair = story.mappings.map(normalizePair).find((item) => item.questionId === questionId);
  if (pair) {
    await withBusy(() => api.removePair(pair.id));
    notify('Question removed from this story.');
  } else {
    await withBusy(() => api.createPair({
      storyId: story.id,
      questionId,
      studentStrength: isMentor() ? undefined : 3,
      surface: 'assign',
    }));
    notify(isMentor() ? 'Question assigned to this story.' : 'Question suggested for mentor confirmation.');
  }
  await refreshAssignedStory();
}

async function updatePairScore(scope, score) {
  const match = scope.match(/^pair-(.+)-(mentor|student)$/);
  if (!match) return;
  const [, pairId, owner] = match;
  await withBusy(() => api.updatePair(pairId, {
    [owner === 'mentor' ? 'mentorStrength' : 'studentStrength']: Number(score),
    surface: 'assign',
  }));
  await refreshAssignedStory();
  notify('Question strength saved.');
}

/* ========================= Interview intelligence ========================= */

function familyMeta(id) {
  return FAMILIES.find((family) => family.id === id) || FAMILIES.at(-1);
}

function questionState(raw) {
  const stateValue = String(firstDefined(raw.state, raw.coverage_state, 'none'));
  if (['ready', 'progress', 'none'].includes(stateValue)) return stateValue;
  if (['covered', 'complete'].includes(stateValue)) return 'ready';
  if (['in_progress', 'suggested'].includes(stateValue)) return 'progress';
  return 'none';
}

function questionStateLabel(value) {
  return ({ ready: 'Ready', progress: 'In progress', none: 'No story yet' })[value] || 'No story yet';
}

function normalizeIntelligence(payload = {}) {
  const questions = asArray(firstDefined(payload.questions, payload.questionCoverage, payload.question_coverage))
    .map((raw) => {
      const pairs = asArray(raw.pairs);
      return {
        ...normalizeQuestion(raw),
        state: questionState(raw),
        pairs,
        pairCount: Number(firstDefined(raw.pairCount, raw.pair_count, pairs.length)) || 0,
        bestStudentStrength: Number(firstDefined(raw.bestStudentStrength, raw.best_student_strength, 0)) || 0,
        bestMentorStrength: Number(firstDefined(raw.bestMentorStrength, raw.best_mentor_strength, 0)) || 0,
        followupsTotal: Number(firstDefined(raw.followupsTotal, raw.followups_total, 0)) || 0,
        followupsPrepared: Number(firstDefined(raw.followupsPrepared, raw.followups_prepared, 0)) || 0,
      };
    });
  const serverFamilies = asArray(payload.families);
  const families = FAMILIES.map((meta) => {
    const source = serverFamilies.find((item) => firstDefined(item.id, item.family) === meta.id) || {};
    const familyQuestions = questions.filter((question) => question.family === meta.id);
    return {
      ...meta,
      count: Number(firstDefined(source.count, source.question_count, familyQuestions.length)) || familyQuestions.length,
      ready: Number(firstDefined(source.ready, source.ready_count, familyQuestions.filter((question) => question.state === 'ready').length)) || 0,
      progress: Number(firstDefined(source.progress, source.progress_count, familyQuestions.filter((question) => question.state === 'progress').length)) || 0,
    };
  });
  const ready = questions.filter((question) => question.state === 'ready').length;
  const progress = questions.filter((question) => question.state === 'progress').length;
  const readiness = firstDefined(payload.readiness, payload.stats, {});
  return {
    questions,
    families,
    readiness: {
      ready: Number(firstDefined(readiness.ready, readiness.ready_count, ready)) || 0,
      progress: Number(firstDefined(readiness.progress, readiness.progress_count, progress)) || 0,
      gaps: Number(firstDefined(readiness.gaps, readiness.gap_count, Math.max(0, questions.length - ready - progress))) || 0,
      total: Number(firstDefined(readiness.total, readiness.question_count, questions.length)) || questions.length,
      percent: Number(firstDefined(readiness.percent, readiness.percentage, questions.length ? Math.round((ready / questions.length) * 100) : 0)) || 0,
      followupsTotal: Number(firstDefined(readiness.followupsTotal, readiness.followups_total, 0)) || 0,
      followupsPrepared: Number(firstDefined(readiness.followupsPrepared, readiness.followups_prepared, 0)) || 0,
    },
  };
}

async function loadIntelligence() {
  const studentId = isMentor() ? firstDefined(state.selectedStudent?.id, state.routeId, '') : '';
  try {
    state.intelligence = normalizeIntelligence(await api.intelligence(studentId));
  } catch (error) {
    if (![404, 405, 501].includes(error.status)) throw error;
    if (!state.questions.length) await loadQuestions();
    state.intelligence = normalizeIntelligence({ questions: state.questions });
  }
  return state.intelligence;
}

function renderPrep() {
  const intelligence = state.intelligence || normalizeIntelligence();
  const readiness = intelligence.readiness;
  const studentLabel = isMentor() && state.selectedStudent ? ` · ${state.selectedStudent.name}` : '';
  const visibleFamilies = intelligence.families.filter((family) => family.id !== 'custom' || family.count);
  const visibleQuestions = intelligence.questions.filter((question) => {
    if (state.questionFamily !== 'all' && question.family !== state.questionFamily) return false;
    if (state.questionStatus && question.state !== state.questionStatus) return false;
    return !state.questionQuery
      || question.text.toLowerCase().includes(state.questionQuery.trim().toLowerCase());
  });

  main.innerHTML = `<section data-view="prep" class="live">
    ${isMentor() && state.selectedStudent ? `<button class="backBtn" type="button" data-nav="student" data-nav-id="${attr(state.selectedStudent.id)}">‹ ${esc(state.selectedStudent.first)}’s stories</button>` : ''}
    <div class="eyebrow">Interview Prep${esc(studentLabel)}</div>
    <h1 class="h1">Become difficult <em>to surprise</em>.</h1>

    <div class="readyStrip">
      <div class="fstat"><div class="n metric-green">${readiness.ready}</div><div class="l">Ready</div></div>
      <div class="fstat"><div class="n metric-cyan">${readiness.progress}</div><div class="l">In progress</div></div>
      <div class="fstat"><div class="n metric-dim">${readiness.gaps}</div><div class="l">No story yet</div></div>
      <div class="fstat"><div class="n">${firstDefined(state.intelligence?.readiness?.followupsPrepared, 0)}<span>/${firstDefined(state.intelligence?.readiness?.followupsTotal, 0)}</span></div><div class="l">Follow-ups prepared</div></div>
      <div class="push-right"><button class="rowBtn" type="button" data-nav="qlib">Question Library</button><p class="stageHint">Every question opens a workshop: stories, strengths, and the follow-up questions your answer will invite.</p></div>
    </div>

    <div class="famGrid">
      ${visibleFamilies.map((family) => {
        const covered = family.ready + family.progress;
        const width = family.count ? Math.round((covered / family.count) * 100) : 0;
        return `<button class="famCard family-${family.id} ${state.questionFamily === family.id ? 'on' : ''}" type="button"
          data-prep-family="${family.id}">
        <span class="fName"><span class="fIco">${family.ico}</span>${esc(family.label)}</span>
        <span class="fDesc">${esc(family.desc)}</span>
        <progress class="famBar" max="100" value="${width}" aria-label="${width}% of ${esc(family.label)} questions have a story"></progress>
        <span class="fCnt">${covered} of ${family.count} have a story</span>
      </button>`;
      }).join('')}
    </div>

    <div class="listBar">
      <input type="text" id="prepQ" placeholder="Search questions…" value="${attr(state.questionQuery)}">
      <select id="prepSt" aria-label="Question status">
        <option value="">Status: all</option>
        <option value="ready" ${state.questionStatus === 'ready' ? 'selected' : ''}>Ready</option>
        <option value="progress" ${state.questionStatus === 'progress' ? 'selected' : ''}>In progress</option>
        <option value="none" ${state.questionStatus === 'none' ? 'selected' : ''}>No story yet</option>
      </select>
      ${state.questionFamily !== 'all' ? `<button class="rowBtn" type="button" data-clear-prep-family>Family: ${esc(familyMeta(state.questionFamily).label)} ✕</button>` : ''}
      <span class="countNote">${visibleQuestions.length} of ${intelligence.questions.length} questions · click any question to open its workshop</span>
    </div>
    ${visibleQuestions.map((question) => {
      const meta = familyMeta(question.family);
      const stateValue = question.state;
      const pairCount = question.pairCount;
      return `<button class="qiRow family-${meta.id}" type="button" data-open-workshop="${attr(question.id)}">
        <span class="qiCopy"><span class="qFam">${meta.ico} ${esc(meta.label)}${question.source && question.source !== 'MissionMed' ? ` · ${esc(question.source)}` : ''}</span>
          <span class="qTxt">“${esc(question.text)}”</span></span>
        ${pairCount ? `<span class="scoreTag">${pairCount} ${pairCount === 1 ? 'story' : 'stories'}</span>` : ''}
        ${pairCount ? scoreDots(question.bestMentorStrength, 'mentor', 'Best mentor strength for this question') : ''}
        ${question.followupsTotal ? `<span class="scoreTag" title="Follow-up questions prepared">${question.followupsPrepared}/${question.followupsTotal} follow-ups</span>` : ''}
        <span class="qiSt ${stateValue}">${esc(questionStateLabel(stateValue))}</span>
      </button>`;
    }).join('') || emptyState('No questions match.', 'Clear a filter or choose another family.')}
  </section>`;
}

function normalizeWorkshopPair(raw = {}) {
  const pair = normalizePair(raw);
  const storyRaw = firstDefined(raw.story, raw.story_detail, {});
  const story = normalizeStory({
    ...storyRaw,
    id: firstDefined(storyRaw.id, pair.storyId),
    title: firstDefined(storyRaw.title, raw.story_title, raw.title),
    text: firstDefined(storyRaw.text, raw.story_text, raw.story_excerpt, raw.current_text),
    status: firstDefined(storyRaw.status, raw.story_status, 'submitted'),
    student_name: firstDefined(storyRaw.student_name, raw.student_name),
  });
  return {
    ...pair,
    clinical: Boolean(firstDefined(raw.clinical, pair.clinical, false)),
    followups: pair.followups
      .map(normalizeFollowup)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)),
    story,
  };
}

function normalizeWorkshop(payload = {}) {
  const question = normalizeQuestion(firstDefined(payload.question, payload, {}));
  const pairs = asArray(firstDefined(payload.pairs, payload.storyPairs, payload.story_pairs)).map(normalizeWorkshopPair);
  return {
    question,
    state: questionState(firstDefined(payload.state, payload.question, {})),
    preferredStoryId: String(firstDefined(payload.preferredStoryId, payload.preferred_story_id, '')),
    pairs,
    suggestedStories: asArray(firstDefined(payload.suggestedStories, payload.suggested_stories)).map(normalizeStory),
    coachingNotes: asArray(firstDefined(payload.coachingNotes, payload.coaching_notes)),
    gaps: Array.isArray(payload.gaps)
      ? payload.gaps.map((item) => typeof item === 'string' ? item : String(firstDefined(item.text, item.gap, '')))
      : [
        !payload.gaps?.preferredStoryChosen ? 'Choose a preferred story for this question.' : '',
        !payload.gaps?.mentorConfirmed ? 'A mentor still needs to confirm the story–question fit.' : '',
        !payload.gaps?.followupsMapped ? 'Map the natural follow-up questions this story invites.' : '',
        payload.gaps?.followupsMapped && !payload.gaps?.allFollowupsPrepared ? 'Prepare every mapped follow-up before interview day.' : '',
      ].filter(Boolean),
  };
}

async function openWorkshop(questionId) {
  state.route = 'qshop';
  state.routeId = questionId;
  pushPath('qshop', questionId);
  main.innerHTML = loadingView('Opening Question Workshop…');
  try {
    const studentId = isMentor() ? state.selectedStudent?.id || '' : '';
    state.workshop = normalizeWorkshop(await api.workshop(questionId, studentId));
    state.workshopFocusPairId = null;
    renderShell();
    renderQuestionWorkshop();
  } catch (error) {
    notify(error.message);
    await navigate('prep', null, { replace: true });
  }
}

function coachingNoteText(note) {
  return String(typeof note === 'string' ? note : firstDefined(note.body, note.text, note.note, ''));
}

function followupText(item) {
  return String(typeof item === 'string' ? item : firstDefined(item.text, item.question, ''));
}

function normalizeFollowup(raw = {}, index = 0) {
  if (typeof raw === 'string') {
    return {
      id: '',
      text: raw,
      source: 'student',
      clinical: false,
      prepared: false,
      note: '',
      sortOrder: index,
      rowVersion: 0,
      createdAt: '',
    };
  }
  return {
    ...raw,
    id: String(firstDefined(raw.id, raw.followup_id, '')),
    text: followupText(raw),
    source: String(firstDefined(raw.source, raw.created_by_role, 'student')).toLowerCase(),
    clinical: Boolean(firstDefined(raw.clinical, false)),
    prepared: Boolean(firstDefined(raw.prepared, false)),
    note: String(firstDefined(raw.note, raw.preparationNote, raw.preparation_note, '')),
    sortOrder: Number(firstDefined(raw.sortOrder, raw.sort_order, index)) || 0,
    rowVersion: Number(firstDefined(raw.rowVersion, raw.row_version, 0)) || 0,
    createdAt: String(firstDefined(raw.createdAt, raw.created_at, '')),
  };
}

function followupSourceMeta(followup) {
  if (followup.source === 'ai') return { className: 'ai', label: 'AI', title: 'Accepted from an AI suggestion' };
  if (followup.source === 'mentor') return { className: 'mentor', label: 'DB', title: 'Added by mentor' };
  return { className: 'student', label: 'You', title: 'Added by student' };
}

function workshopThemeIds(family) {
  return ({
    core: ['identity', 'growth'],
    behavioral: ['mistake', 'conflict', 'leader', 'team', 'growth', 'resil', 'comm'],
    clinical: ['patient', 'advoc', 'mistake'],
    cv: ['identity', 'leader', 'team'],
    redflag: ['resil', 'growth', 'mistake'],
    personal: ['identity', 'resil'],
    custom: [],
  })[family] || [];
}

function workshopSuggestedStories(workshop) {
  const pairedIds = new Set(workshop.pairs.map((pair) => pair.story.id));
  const familyThemes = workshopThemeIds(workshop.question.family);
  return [...new Map(workshop.suggestedStories.map((story) => [story.id, story])).values()]
    .filter((story) => !pairedIds.has(story.id))
    .filter((story) => !familyThemes.length || story.themes.some((theme) => familyThemes.includes(theme)))
    .sort((a, b) => (b.mentorScore || b.studentScore) - (a.mentorScore || a.studentScore))
    .slice(0, 3);
}

function renderQuestionWorkshop() {
  const workshop = state.workshop;
  if (!workshop) return;
  const question = workshop.question;
  const family = familyMeta(question.family);
  const studentName = state.selectedStudent?.first || 'the student';
  const focusPair = workshop.pairs.find((pair) => pair.id === state.workshopFocusPairId)
    || workshop.pairs.find((pair) => pair.story.id === workshop.preferredStoryId)
    || workshop.pairs[0]
    || null;
  if (focusPair) state.workshopFocusPairId = focusPair.id;
  const suggested = workshopSuggestedStories(workshop);
  const clinicalMode = Boolean(
    focusPair
    && (
      focusPair.clinical
      || question.family === 'clinical'
      || focusPair.story.themes.includes('patient')
      || focusPair.followups.some((followup) => followup.clinical)
    )
  );
  const gaps = [
    { ok: workshop.pairs.length > 0, text: workshop.pairs.length ? 'At least one story assigned' : 'Assign a story that can answer this' },
    { ok: Boolean(workshop.preferredStoryId), text: workshop.preferredStoryId ? 'Preferred answer chosen' : 'Choose the preferred story for this question' },
    { ok: workshop.pairs.some((pair) => pair.confirmed), text: workshop.pairs.some((pair) => pair.confirmed) ? 'Mentor confirmed a pairing' : 'Awaiting mentor confirmation' },
    { ok: Boolean(focusPair?.followups.length), text: focusPair?.followups.length ? 'Follow-up questions mapped' : 'Map the follow-up questions this answer invites' },
    { ok: Boolean(focusPair?.followups.length && focusPair.followups.every((followup) => followup.prepared)), text: 'Every follow-up marked prepared' },
  ];

  main.innerHTML = `<section data-view="qshop" class="live">
    <button class="backBtn" type="button" data-nav="prep">‹ Interview Prep</button>
    <div class="qshopMeta"><span class="qFam family-${family.id}">${family.ico} ${esc(family.label)}</span><span class="qiSt ${workshop.state}">${esc(questionStateLabel(workshop.state))}</span>
      ${isMentor() ? '' : '<span class="stageHint">Your mentor sees this same workshop and can confirm or adjust your judgments.</span>'}</div>
    <h1 class="h1">“${esc(question.text)}”</h1>

    <div class="wsGrid">
      <div>
        <div class="panel workshopStories"><div class="pHead"><div class="h2">Stories that <em>answer this</em></div><button class="pMore" type="button" data-nav="library">+ Assign a story ▸</button></div>
          <div class="pBody">
            ${isStudent() ? `<button class="rowBtn pri workshopCapture" type="button" data-open-capture
              data-pair-question-id="${attr(question.id)}" data-capture-prompt="${attr(question.text)}">＋ Capture a new story for this question</button>` : ''}
            ${workshop.pairs.length ? workshop.pairs.map((pair) => {
              const preferred = workshop.preferredStoryId === pair.story.id;
              return `<article class="pairCard ${preferred ? 'pref' : ''}">
                <div class="pTop"><button class="pTtl" type="button" data-open-story="${attr(pair.story.id)}">${esc(storyTitle(pair.story))}</button>
                  ${preferred ? '<span class="prefTag">★ Preferred answer</span>' : `<button class="prefBtn" type="button" data-prefer-story="${attr(pair.story.id)}">Make preferred</button>`}
                  ${pair.story.audioAssetId || pair.story.captureType === 'audio' ? '<span class="audChip" title="Original audio preserved">🎙</span>' : ''}
                </div>
                <div class="pairCtl"><span class="fLbl">Strength for this question</span>${scoreDots(pair.studentStrength, 'student', 'Student strength')}${scoreDots(pair.mentorStrength, 'mentor', 'Mentor strength')}
                  ${scorePicker(`workshop-${attr(pair.id)}-${isMentor() ? 'mentor' : 'student'}`, isMentor() ? pair.mentorStrength : pair.studentStrength, isMentor())}
                  <span class="confTag ${pair.confirmed ? 'confirmed' : 'suggested'}">${pair.confirmed ? '✓ Confirmed by mentor' : '◌ Suggested — awaiting confirmation'}</span>
                  ${isMentor() && !pair.confirmed ? `<button class="rowBtn pri" type="button" data-confirm-pair="${attr(pair.id)}">Confirm</button><button class="rowBtn" type="button" data-reject-pair="${attr(pair.id)}">Reject</button>` : ''}
                </div>
                <label class="srOnly" for="pairWhy-${attr(pair.id)}">Why this story works for this question</label>
                <textarea class="pairWhy" id="pairWhy-${attr(pair.id)}" data-pair-why="${attr(pair.id)}" placeholder="Why this story works for this question — one or two sentences…">${esc(pair.why)}</textarea>
                <button class="rowBtn savePairWhy" type="button" data-save-pair-why="${attr(pair.id)}">Save why</button>
              </article>`;
            }).join('') : `<div class="storyEmpty"><b>No story is assigned yet.</b>${isMentor() ? `Open a submitted story from ${esc(studentName)} and assign this question.` : 'Open one of your stories and assign this question.'}<br><button class="rowBtn pri" type="button" data-nav="library">Open Story Library</button></div>`}
            ${suggested.length ? `<div class="dsLbl couldAlso">Could also answer this</div>${suggested.map((story) => `<div class="shortItem"><span class="si">${esc(storyTitle(story))}</span>${scoreDots(story.mentorScore, 'mentor', 'Overall mentor score')}<button class="rowBtn push-right" type="button" data-add-suggested-story="${attr(story.id)}">+ Assign</button></div>`).join('')}` : ''}
          </div>
        </div>
        <div class="panel coachingPanel"><div class="pHead"><div class="h2">Coaching <em>notes</em></div></div><div class="pBody">
          ${workshop.coachingNotes.length ? workshop.coachingNotes.map((note) => `<div class="noteItem"><div class="nt">“${esc(coachingNoteText(note))}”</div><div class="nd">${esc(firstDefined(note.mentor_name, note.mentorName, 'Mentor'))} · ${esc(formatDateTime(firstDefined(note.created_at, note.createdAt)))}</div></div>`).join('') : '<div class="stageHint">No coaching notes on this question yet.</div>'}
          ${isMentor() ? `<div class="askRow"><input id="coachingNote" placeholder="Coach ${esc(studentName)} on this question…"><button class="noteSend" type="button" data-send-coaching>Add</button></div>` : ''}
        </div></div>
        <div class="panel gapsPanel"><div class="pHead"><div class="h2">Gaps to <em>close</em></div></div><div class="pBody"><div class="gapChecklist">
          ${gaps.map((gap) => `<div class="gc ${gap.ok ? 'done' : ''}"><i>${gap.ok ? '✓' : '○'}</i>${esc(gap.text)}</div>`).join('')}
        </div></div></div>
      </div>

      <aside class="nnqPanel ${clinicalMode ? 'clinical' : ''}">
        <div class="nnqHead"><h2 class="h2">Next natural <em>questions</em></h2>${clinicalMode ? '<span class="srcB clin">✚ Clinical mode</span>' : ''}</div>
        <p class="stageHint">Your answer creates the interviewer’s next question. Map them here, prepare each one, and you become difficult to surprise.</p>
        ${focusPair ? `${workshop.pairs.length > 1 ? `<label class="fLbl" for="workshopFocusPair">Follow-ups for</label>
            <select class="tSel workshopPairSelect" id="workshopFocusPair">${workshop.pairs.map((pair) => `<option value="${attr(pair.id)}" ${pair.id === focusPair.id ? 'selected' : ''}>${esc(storyTitle(pair.story).slice(0, 52))}</option>`).join('')}</select>`
          : `<div class="fLbl">For: ${esc(storyTitle(focusPair.story))}</div>`}
          ${focusPair.followups.length ? focusPair.followups.map((followup, index) => {
            const source = followupSourceMeta(followup);
            return `<div class="fupRow ${followup.prepared ? 'prep' : ''}">
              <div class="fTop"><label class="fupCk"><input class="srOnly" type="checkbox" data-followup-prepared="${attr(followup.id)}" ${followup.prepared ? 'checked' : ''}><span>✓</span></label>
                <input class="fupQ" data-followup-text="${attr(followup.id)}" value="${attr(followup.text)}" aria-label="Follow-up question">
                <span class="srcB ${source.className}" title="${attr(source.title)}">${source.label}</span>
                <label class="clinicalToggle" title="Mark as a clinical follow-up"><input type="checkbox" data-followup-clinical="${attr(followup.id)}" ${followup.clinical ? 'checked' : ''}><span class="srcB clin">✚ Clinical</span></label>
              </div>
              <textarea class="fupNote" data-followup-note="${attr(followup.id)}" placeholder="Answer notes — what you’ll actually say…">${esc(followup.note)}</textarea>
              <div class="fupTools">
                <button type="button" data-move-followup="${attr(followup.id)}" data-move-delta="-1" ${index === 0 ? 'disabled' : ''} title="Move up">↑ Up</button>
                <button type="button" data-move-followup="${attr(followup.id)}" data-move-delta="1" ${index === focusPair.followups.length - 1 ? 'disabled' : ''} title="Move down">↓ Down</button>
                <button type="button" data-save-followup="${attr(followup.id)}">Save edits</button>
                <button type="button" data-remove-followup="${attr(followup.id)}" class="dangerText">Remove</button>
              </div>
            </div>`;
          }).join('') : '<div class="stageHint">None mapped yet — add the questions your answer will invite.</div>'}
          <div class="askRow followupAdd"><input data-new-followup="${attr(focusPair.id)}" placeholder="Add a follow-up question the interviewer might ask…">
            <label class="clinicalToggle"><input type="checkbox" data-new-followup-clinical="${attr(focusPair.id)}" ${clinicalMode ? 'checked' : ''}><span class="srcB clin">✚ Clinical</span></label>
            <button class="noteSend" type="button" data-add-followup="${attr(focusPair.id)}">Add</button></div>`
          : '<div class="truthState">Assign a story first. Strength for this question, Make preferred, Confirmed by mentor, and Next natural questions all belong to a real story–question pairing.</div>'}
        <div class="aiBoundary"><p>StoryForge never invents a student story or clinical fact.</p>
          ${state.config?.ai?.[isMentor() ? 'aiClinicalMentor' : 'aiClinicalStudent']
            ? '<button class="rowBtn" type="button" data-request-ai>✦ Suggest follow-ups (AI)</button><div id="aiResult" class="aiSug" hidden></div>'
            : '<span class="apiHint">AI suggestions are not enabled for this signed role.</span>'}
        </div>
      </aside>
    </div>
  </section>`;
}

async function reloadWorkshop() {
  if (!state.workshop?.question.id) return;
  const studentId = isMentor() ? state.selectedStudent?.id || '' : '';
  state.workshop = normalizeWorkshop(await api.workshop(state.workshop.question.id, studentId));
  renderQuestionWorkshop();
}

async function workshopScore(scope, score) {
  const match = scope.match(/^workshop-(.+)-(student|mentor)$/);
  if (!match) return;
  const [, pairId, owner] = match;
  if (owner === 'mentor' && !isMentor()) return;
  await withBusy(() => api.updatePair(pairId, {
    [owner === 'mentor' ? 'mentorStrength' : 'studentStrength']: Number(score),
    surface: 'workshop',
  }));
  await reloadWorkshop();
  notify('Question strength saved.');
}

async function preferStory(storyId) {
  if (!state.workshop) return;
  await withBusy(() => api.preferenceForQuestion(state.workshop.question.id, {
    ...(isMentor() && state.selectedStudent ? { studentId: state.selectedStudent.id } : {}),
    storyId,
    surface: 'workshop',
  }));
  await reloadWorkshop();
  notify('Preferred story saved for this question.');
}

async function addSuggestedStory(storyId) {
  if (!state.workshop) return;
  await withBusy(() => api.createPair({
    storyId,
    questionId: state.workshop.question.id,
    studentStrength: isMentor() ? undefined : 3,
    surface: 'workshop',
  }));
  await reloadWorkshop();
  notify(isMentor() ? 'Story assigned to this question.' : 'Story suggested for mentor confirmation.');
}

async function savePairWhy(pairId) {
  const value = $(`[data-pair-why="${CSS.escape(pairId)}"]`)?.value.trim() || '';
  await withBusy(() => api.updatePair(pairId, { why: value, surface: 'workshop' }));
  await reloadWorkshop();
  notify('Why this story works saved.');
}

async function addFollowup(pairId) {
  const field = $(`[data-new-followup="${CSS.escape(pairId)}"]`);
  const text = field?.value.trim();
  if (!text) return;
  const clinical = Boolean($(`[data-new-followup-clinical="${CSS.escape(pairId)}"]`)?.checked);
  await withBusy(() => api.addFollowup(pairId, { text, clinical, surface: 'workshop' }));
  await reloadWorkshop();
  notify('Next natural question added.');
}

function workshopFollowup(id) {
  for (const pair of state.workshop?.pairs || []) {
    const followup = pair.followups.find((item) => item.id === id);
    if (followup) return { pair, followup };
  }
  return null;
}

async function saveFollowup(id) {
  const context = workshopFollowup(id);
  if (!context) return;
  const text = $(`[data-followup-text="${CSS.escape(id)}"]`)?.value.trim() || '';
  const note = $(`[data-followup-note="${CSS.escape(id)}"]`)?.value.trim() || '';
  const clinical = Boolean($(`[data-followup-clinical="${CSS.escape(id)}"]`)?.checked);
  if (!text) {
    notify('A follow-up question cannot be empty.');
    return;
  }
  await withBusy(() => api.updateFollowup(id, {
    text,
    note,
    clinical,
    expectedVersion: context.followup.rowVersion ?? 0,
    surface: 'workshop',
  }));
  await reloadWorkshop();
  notify('Follow-up question and answer notes saved.');
}

async function moveFollowup(id, delta) {
  const context = workshopFollowup(id);
  if (!context) return;
  const list = context.pair.followups;
  const index = list.findIndex((item) => item.id === id);
  const nextIndex = index + Number(delta);
  if (index < 0 || nextIndex < 0 || nextIndex >= list.length) return;
  const neighbor = list[nextIndex];
  const currentOrder = context.followup.sortOrder;
  const neighborOrder = neighbor.sortOrder;
  await withBusy(async () => {
    await api.updateFollowup(context.followup.id, {
      sortOrder: neighborOrder,
      expectedVersion: context.followup.rowVersion ?? 0,
      surface: 'workshop',
    });
    await api.updateFollowup(neighbor.id, {
      sortOrder: currentOrder,
      expectedVersion: neighbor.rowVersion ?? 0,
      surface: 'workshop',
    });
  });
  await reloadWorkshop();
  notify('Follow-up order saved.');
}

async function sendCoaching() {
  const body = $('#coachingNote')?.value.trim();
  if (!body || !state.workshop || !state.selectedStudent) return;
  await withBusy(() => api.coaching({
    studentId: state.selectedStudent.id,
    questionId: state.workshop.question.id,
    body,
    surface: 'workshop',
  }));
  await reloadWorkshop();
  notify('Coaching note sent.');
}

async function requestAiSuggestion() {
  if (!state.workshop) return;
  const target = $('#aiResult');
  try {
    const result = await withBusy(() => api.aiSuggest({
      mode: 'clinical',
      questionId: state.workshop.question.id,
      studentId: state.selectedStudent?.id,
    }));
    const suggestion = firstDefined(result?.suggestion, result?.text, '');
    if (!suggestion) throw new Error('The configured provider returned no grounded suggestion.');
    target.hidden = false;
    target.textContent = suggestion;
  } catch (error) {
    notify(error.message);
  }
}

function questionLibraryRows() {
  const query = state.questionQuery.trim().toLowerCase();
  return state.questions.filter((question) => {
    if (state.questionFamily !== 'all' && question.family !== state.questionFamily) return false;
    if (state.questionSource && questionSourceKey(question) !== state.questionSource) return false;
    return !query || question.text.toLowerCase().includes(query);
  });
}

function questionSourceKey(question) {
  const source = String(question.source || '').toLowerCase();
  if (source === 'student' || source === 'custom') return 'custom';
  if (source === 'mentor') return 'mentor';
  if (source === 'imported') return 'imported';
  return 'missionmed';
}

function questionSourceLabel(question) {
  return ({ missionmed: 'MissionMed', mentor: 'Mentor', custom: 'Custom', imported: 'Imported' })[questionSourceKey(question)];
}

function renderQuestionLibrary() {
  const rows = questionLibraryRows();
  const groups = FAMILIES.filter((family) => rows.some((question) => question.family === family.id));
  main.innerHTML = `<section data-view="qlib" class="live">
    ${isAdmin() ? '' : '<button class="backBtn" type="button" data-nav="prep">‹ Interview Prep</button>'}
    <div class="eyebrow">MissionMed Question Library</div>
    <h1 class="h1">${state.questions.length} questions, <em>one shared library</em>.</h1>
    <p class="questionLibraryIntro">Institutional MissionMed questions, mentor-written questions, and student-specific customs live side by side, always labeled by source. Assign from any story or workshop; manage and import here.</p>
    <div class="listBar">
      <input id="questionSearch" type="search" placeholder="Search the library…" value="${attr(state.questionQuery)}">
      <select id="questionFamily">
        <option value="all">Family: all</option>
        ${FAMILIES.map((family) => `<option value="${family.id}" ${state.questionFamily === family.id ? 'selected' : ''}>${esc(family.label)}</option>`).join('')}
      </select>
      <select id="questionSource">
        <option value="">Source: all</option>
        <option value="missionmed" ${state.questionSource === 'missionmed' ? 'selected' : ''}>MissionMed</option>
        <option value="mentor" ${state.questionSource === 'mentor' ? 'selected' : ''}>Mentor</option>
        <option value="imported" ${state.questionSource === 'imported' ? 'selected' : ''}>Imported</option>
        <option value="custom" ${state.questionSource === 'custom' ? 'selected' : ''}>Custom</option>
      </select>
      <span class="countNote">${rows.length} of ${state.questions.length}</span>
    </div>
    ${canGovernQuestions() ? `<div class="impBox">
      <div class="h2">Import <em>question candidates</em></div>
      <p class="stageHint">Paste one question per line, optionally “question | family,” or choose a real CSV/XLSX file. Review every family and duplicate flag before any selected draft is committed.</p>
      <textarea id="importText" placeholder="Tell me about a time… | Behavioral"></textarea>
      <div class="inlineActions"><label class="rowBtn" for="importFile">Choose CSV/XLSX</label><input id="importFile" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"><span class="stageHint" id="importSourceName">${esc(state.importSource.name === 'pasted-questions' ? 'No file selected — paste mode' : state.importSource.name)}</span></div>
      <div class="inlineActions"><button class="rowBtn" type="button" data-preview-import>Preview</button><button class="rowBtn pri" type="button" data-commit-import ${state.importPreview.some((row) => row.selected) ? '' : 'disabled'}>Commit selected drafts</button></div>
      <div id="importPreview">${renderImportPreview()}</div>
      ${renderImportHistory()}
    </div>` : ''}
    ${state.user.role === 'admin' ? '' : `<form id="questionAddForm" class="listBar questionAdd">
      <input type="text" name="text" placeholder="${isMentor() ? 'Add a question draft for review…' : 'Add a private custom question for your own prep…'}" required>
      <select name="family" aria-label="New question family">${FAMILIES.map((family) => `<option value="${family.id}">${esc(family.label)}</option>`).join('')}</select>
      <button class="noteSend" type="submit">Add</button>
      <span class="apiHint">${isMentor() ? 'Mentor questions remain governed drafts until approved.' : 'Student customs remain private to their owner.'}</span>
    </form>`}
    ${groups.length ? groups.map((family) => {
      const familyRows = rows.filter((question) => question.family === family.id);
      return `<div class="libGroup"><div class="gTitle"><div class="h2 familyHeading family-${family.id}">${family.ico} ${esc(family.label)}</div><span class="cnt">${familyRows.length}</span></div>
        ${familyRows.map((question) => `<div class="qlibRow">
          <span class="qt">“${esc(question.text)}”</span>
          <span class="srcB ${questionSourceKey(question) === 'custom' ? 'student' : questionSourceKey(question)}" title="Source">${esc(questionSourceLabel(question))}</span>
          <span class="scoreTag">${esc(question.governanceState)}</span>
          <span class="scoreTag">${question.storyCount || 0} assigned</span>
          ${canGovernQuestions() && ['draft', 'review'].includes(question.governanceState) && !firstDefined(question.owner_student_id, question.ownerStudentId)
            ? `<button class="rowBtn" type="button" data-approve-question="${attr(question.id)}">Approve for shared library</button>`
            : ''}
          ${isAdmin() ? '' : `<button class="rowBtn pri" type="button" data-open-workshop="${attr(question.id)}">Open workshop</button>`}
        </div>`).join('')}</div>`;
    }).join('') : emptyState('No questions match.', 'Clear the search or choose another family.')}
  </section>`;
}

async function createCustomQuestion(form) {
  const values = new FormData(form);
  const text = String(values.get('text') || '').trim();
  const family = String(values.get('family') || 'custom');
  if (!text) return;
  await withBusy(() => api.createQuestion({ text, family, surface: 'library' }));
  await loadQuestions();
  renderQuestionLibrary();
  notify(isMentor() ? 'Question saved as a governed draft.' : 'Private custom question added.');
}

async function approveQuestion(id) {
  await withBusy(() => api.approveQuestion(id, 'library'));
  await loadQuestions();
  renderQuestionLibrary();
  notify('Question explicitly approved for the shared library.');
}

function renderImportPreview() {
  return state.importPreview.map((row, index) => `<label class="impRow ${row.exactDuplicateId || row.nearDuplicateId ? 'dup' : ''}">
    <input type="checkbox" data-import-row="${index}" ${row.selected ? 'checked' : ''} ${row.error || row.exactDuplicateId ? 'disabled' : ''}>
    <span>${esc(row.rowNumber)}</span><span class="it">${esc(row.text || 'Empty row')}<small>${esc(row.error || (row.exactDuplicateId ? 'Exact duplicate — cannot be added twice' : row.nearDuplicateId ? `Possible duplicate · ${row.similarity} — unchecked by default` : 'Ready for draft review'))}</small></span>
    <select data-import-family="${index}" aria-label="Family for import row ${index + 1}">
      ${FAMILIES.map((family) => `<option value="${family.id}" ${row.family === family.id ? 'selected' : ''}>${esc(family.label)}</option>`).join('')}
    </select>
  </label>`).join('');
}

function renderImportHistory() {
  if (!state.importBatches.length) {
    return '<div class="impHistory"><div class="fLbl">Recent import batches</div><p class="stageHint">No import batch has been committed by this account.</p></div>';
  }
  return `<div class="impHistory"><div class="fLbl">Recent import batches</div>
    ${state.importBatches.map((batch) => {
      const id = String(batch.id || '');
      const status = String(batch.state || 'committed');
      const count = Number(firstDefined(batch.created_question_count, batch.createdQuestionCount, 0)) || 0;
      return `<div class="impBatch">
        <span><b>${esc(firstDefined(batch.source_name, batch.sourceName, 'Untitled import'))}</b>
          <small>${count} draft${count === 1 ? '' : 's'} · ${esc(status.replaceAll('_', ' '))} · ${esc(formatDateTime(firstDefined(batch.committed_at, batch.created_at)))}</small></span>
        ${status === 'committed'
          ? `<button class="rowBtn" type="button" data-rollback-import="${attr(id)}">Roll back this import batch</button>`
          : '<span class="scoreTag">Rolled back</span>'}
      </div>`;
    }).join('')}
  </div>`;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

async function previewImport() {
  const file = $('#importFile')?.files?.[0] || null;
  let body;
  if (file) {
    const format = file.name.toLowerCase().endsWith('.csv')
      ? 'csv'
      : file.name.toLowerCase().endsWith('.xlsx')
        ? 'xlsx'
        : '';
    if (!format) throw new Error('Choose a CSV or XLSX file.');
    if (!file.size || file.size > 5 * 1024 * 1024) {
      throw new Error('Import files must be non-empty and no larger than 5 MB.');
    }
    body = { format, dataBase64: arrayBufferToBase64(await file.arrayBuffer()) };
    state.importSource = { name: file.name, format };
  } else {
    body = { format: 'paste', text: $('#importText')?.value || '' };
    state.importSource = { name: 'pasted-questions', format: 'paste' };
  }
  const result = await withBusy(() => api.importPreview(body));
  state.importPreview = asArray(result?.rows);
  state.importReviewFingerprint = String(result?.reviewFingerprint || '');
  renderQuestionLibrary();
}

async function commitImport() {
  const result = await withBusy(() => api.importCommit({
    sourceName: state.importSource.name,
    format: state.importSource.format,
    rows: state.importPreview,
    reviewFingerprint: state.importReviewFingerprint,
  }));
  const committed = firstDefined(result?.batch, result);
  state.importPreview = [];
  state.importReviewFingerprint = '';
  state.importSource = { name: 'pasted-questions', format: 'paste' };
  await Promise.all([loadQuestions(), loadImportBatches()]);
  renderQuestionLibrary();
  notify(`Selected questions committed as governed drafts${committed?.id ? ' in a reversible batch' : ''}.`);
}

async function rollbackImport(batchId) {
  const batch = state.importBatches.find((item) => String(item.id) === String(batchId));
  const label = firstDefined(batch?.source_name, batch?.sourceName, 'this import batch');
  if (!window.confirm(`Roll back “${label}”? Its still-draft imported questions will be retired. This cannot roll back questions already approved or in use.`)) return;
  await withBusy(() => api.importRollback(batchId));
  await Promise.all([loadQuestions(), loadImportBatches()]);
  renderQuestionLibrary();
  notify('Import batch rolled back. Its unused drafts are retired and the action is audited.');
}

/* ========================= Mentor workspace ========================= */

const QUEUE_BUCKETS = Object.freeze([
  ['awaiting', 'Awaiting my review'],
  ['revised', 'Revised — needs re-review'],
  ['waiting', 'Waiting on student'],
  ['reviewed', 'Reviewed'],
  ['approved', 'Approved'],
]);

const CRAFT = Object.freeze([
  { id: 'detail', label: 'Specific detail', hint: 'The tomatillos. The nine names. Details prove it happened.' },
  { id: 'stakes', label: 'Real stakes', hint: 'Something a reader can feel was at risk.' },
  { id: 'turn', label: 'The turn', hint: 'A before and an after — the moment something changed.' },
  { id: 'honest', label: 'Honest reflection', hint: 'The writer admits something true and unflattering.' },
  { id: 'lesson', label: 'Transferable lesson', hint: 'It predicts the doctor they will be.' },
]);

function mentorState() {
  if (!state.mentor) {
    state.mentor = {
      home: null,
      studentQuery: '',
      studentCohort: '',
      studentSort: 'attention',
      storyQuery: '',
      storyFilter: '',
      storySort: 'new',
      queue: [],
      queueCohort: '',
      activity: [],
      activityFilters: { student: '', cohort: '', type: '', period: 'week', from: '', to: '' },
      teaching: null,
      session: null,
    };
  }
  return state.mentor;
}

function queueBucket(story, rawBucket = '') {
  const value = String(rawBucket || story.bucket || '').toLowerCase();
  if (['awaiting', 'awaiting_review'].includes(value)) return story.revised ? 'revised' : 'awaiting';
  if (['revised', 're_review', 'needs_re_review'].includes(value)) return 'revised';
  if (['waiting', 'waiting_on_student'].includes(value)) return 'waiting';
  if (['reviewed', 'approved'].includes(value)) return value;
  if (story.status === 'awaiting') return story.revised ? 'revised' : 'awaiting';
  if (story.status === 'in_review') return 'awaiting';
  if (story.status === 'changes') return 'waiting';
  return story.status;
}

function activityRecord(raw = {}) {
  const action = String(firstDefined(raw.action, raw.event_type, raw.type, 'Updated story'));
  return {
    ...raw,
    id: String(firstDefined(raw.id, raw.event_id, '')),
    storyId: String(firstDefined(raw.storyId, raw.story_id, '')),
    storyTitle: String(firstDefined(raw.storyTitle, raw.story_title, 'Story')),
    studentId: String(firstDefined(raw.studentId, raw.student_id, '')),
    studentName: String(firstDefined(raw.studentName, raw.student_name, 'Student')),
    mentorName: String(firstDefined(raw.mentorName, raw.mentor_name, raw.actor_name, state.user?.display_name, 'Mentor')),
    action: humanActivityAction(action),
    detail: String(firstDefined(raw.detail, raw.description, '')),
    cohort: String(firstDefined(raw.cohort, '')),
    createdAt: firstDefined(raw.createdAt, raw.created_at, raw.occurred_at),
  };
}

function humanActivityAction(action) {
  const exact = {
    'question.assigned': 'Assigned an interview question',
    'question.confirmed': 'Confirmed an interview-question pairing',
    'question.rejected': 'Rejected an interview-question pairing',
    'story.opened': 'Opened a story for review',
    'story.status_changed': 'Changed the review status',
    'story.evaluation_updated': 'Updated story scores or classification',
    'story.feedback_added': 'Left feedback',
    'story.feedback_opened': 'Feedback was opened',
    'story.updated': 'Updated the working story',
    'story.submitted': 'Received a submitted story',
    'story.star_updated': 'Updated a story star',
    'pair.preferred': 'Chose the preferred story',
    'pair.followup_added': 'Added a follow-up question',
    'pair.followup_updated': 'Updated a follow-up question',
    'coaching.note_added': 'Added a coaching note',
  };
  if (exact[action]) return exact[action];
  if (!/^[a-z][a-z0-9_.-]*$/.test(action)) return action;
  const words = action.split(/[._-]+/).filter(Boolean);
  const phrase = words.join(' ');
  return phrase ? `${phrase[0].toUpperCase()}${phrase.slice(1)}` : 'Updated story';
}

async function loadQueue() {
  const payload = await api.queue();
  mentorState().queue = asArray(firstDefined(payload?.stories, payload?.queue, payload?.items)).map((raw) => {
    const story = normalizeStory(raw.story ? { ...raw.story, ...raw } : raw);
    return { story, bucket: queueBucket(story, raw.bucket) };
  });
  return mentorState().queue;
}

async function loadActivity() {
  const filters = mentorState().activityFilters;
  const params = new URLSearchParams();
  if (filters.student) params.set('studentId', filters.student);
  if (filters.cohort) params.set('cohort', filters.cohort);
  if (filters.type) params.set('type', filters.type);
  params.set('period', ({ today: 'day', week: 'week', month: 'month', all: 'all', custom: 'all' })[filters.period] || 'week');
  if (filters.period === 'custom') {
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
  }
  const payload = await api.activity(params.toString());
  mentorState().activity = asArray(firstDefined(payload?.activity, payload?.events, payload?.items)).map(activityRecord);
  return mentorState().activity;
}

async function loadMentorHome() {
  const mentor = mentorState();
  try {
    mentor.home = await api.mentorHome();
  } catch (error) {
    if (![404, 405, 501].includes(error.status)) throw error;
    await Promise.all([loadQueue(), loadActivity().catch(() => [])]);
    mentor.home = null;
  }
  return mentor.home;
}

function mentorHomeMetric(key, fallback = 0) {
  const home = mentorState().home || {};
  const metrics = firstDefined(home.metrics, home.stats, home.counts, home);
  return Number(firstDefined(metrics?.[key], metrics?.[key.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`)], fallback)) || 0;
}

function renderMentorHome() {
  const mentor = mentorState();
  const queue = mentor.queue;
  const awaiting = mentorHomeMetric('awaitingReview', queue.filter((item) => item.bucket === 'awaiting').length);
  const revised = mentorHomeMetric('revised', queue.filter((item) => item.bucket === 'revised').length);
  const waiting = mentorHomeMetric('waitingOnStudent', queue.filter((item) => item.bucket === 'waiting').length);
  const recent = asArray(firstDefined(mentor.home?.recentActivity, mentor.home?.recent_activity, mentor.activity)).map(activityRecord).slice(0, 5);
  const outstanding = asArray(firstDefined(mentor.home?.awaiting, queue.map((item) => item.story)));
  const outstandingNames = [...new Set(outstanding
    .filter((item) => ['awaiting', 'revised', 'awaiting_review'].includes(String(firstDefined(item.bucket, queueBucket(normalizeStory(item))))))
    .map((item) => String(firstDefined(item.studentName, item.student_name, '')).trim())
    .filter(Boolean))];
  const todayKey = new Date().toDateString();
  const actionsToday = mentor.activity.filter((item) => new Date(item.createdAt).toDateString() === todayKey).length;
  const actionsThisWeek = mentor.activity.filter((item) => (
    item.createdAt && Date.now() - new Date(item.createdAt).getTime() < 7 * 86_400_000
  )).length;

  main.innerHTML = `<section data-view="mhome" class="live">
    <div class="homeHero">
      <div class="eyebrow">Mentor View · ${state.students.length} students</div>
      <h1 class="h1">Welcome, <em>${esc(state.user.display_name)}</em>.</h1>
      <p class="greetSub">Find a student, work the review queue, or start teaching — everything else lives one click away.</p>
    </div>
    <div class="inlineActions mentorActions">
      <button class="bigAction" type="button" data-nav="students"><span class="ba1">Find a student</span><span class="ba2">All ${state.students.length} students with search, cohort, and activity filters.</span><span class="baGo">Open Students ▸</span></button>
      <button class="bigAction" type="button" data-nav="queue"><span class="ba1">Review queue</span><span class="ba2"><b>${awaiting + revised} stories</b> are waiting for your review${revised ? ` — ${revised} revised for a second look` : ''}.</span><span class="baGo">Open Review Queue ▸</span></button>
      <button class="bigAction" type="button" data-open-teaching><span class="ba1">Teaching Mode</span><span class="ba2">Present any submitted story, score its craft live, compare two, and hide names for class.</span><span class="baGo">Start Teaching ▸</span></button>
    </div>
    <div class="homeGrid">
      <div class="panel"><div class="pHead"><div class="h2">Outstanding <em>work</em></div><button class="pMore" type="button" data-nav="queue">Review Queue ▸</button></div>
        <div class="pBody"><div class="forgeStats">
          <div class="fstat"><div class="n"><em>${awaiting}</em></div><div class="l">Awaiting review</div></div>
          <div class="fstat"><div class="n metric-green">${revised}</div><div class="l">Revised · re-review</div></div>
          <div class="fstat"><div class="n metric-ember">${waiting}</div><div class="l">Waiting on students</div></div>
        </div>
          <p class="outstandingNames">Students with outstanding review work:
            <b>${esc(outstandingNames.slice(0, 6).join(', ') || 'none')}</b>${outstandingNames.length > 6 ? ` <button class="pMore inlineMore" type="button" data-nav="students">+${outstandingNames.length - 6} more ▸</button>` : ''}
          </p>
        </div>
      </div>
      <div class="panel"><div class="pHead"><div class="h2">Your recent <em>activity</em></div><button class="pMore" type="button" data-nav="activity">My Activity ▸</button></div>
        <div class="pBody"><div class="forgeStats activitySummary">
          <div class="fstat"><div class="n">${actionsToday}</div><div class="l">Actions today</div></div>
          <div class="fstat"><div class="n">${actionsThisWeek}</div><div class="l">This week</div></div>
        </div>${recent.length ? recent.map((item) => `<button class="actRow" type="button" data-open-story="${attr(item.storyId)}">
          <span class="aw">${esc(formatDate(item.createdAt))}</span><span>${esc(item.action)}${item.detail ? ` · ${esc(item.detail)}` : ''} — <b>“${esc(item.storyTitle)}”</b> (${esc(item.studentName)})</span>
        </button>`).join('') : '<div class="stageHint">No recent mentor activity.</div>'}</div>
      </div>
    </div>
  </section>`;
}

function filteredStudents() {
  const mentor = mentorState();
  const query = mentor.studentQuery.trim().toLowerCase();
  const result = state.students.filter((student) => {
    if (mentor.studentCohort && student.cohort !== mentor.studentCohort) return false;
    return !query || `${student.name} ${student.specialty} ${student.year} ${student.cohort}`.toLowerCase().includes(query);
  });
  const sorters = {
    attention: (a, b) => (b.awaitingReview + b.revised) - (a.awaitingReview + a.revised),
    active: (a, b) => String(b.lastCaptureAt).localeCompare(String(a.lastCaptureAt)),
    submitted: (a, b) => String(b.lastSubmittedAt || b.lastCaptureAt).localeCompare(String(a.lastSubmittedAt || a.lastCaptureAt)),
    unscored: (a, b) => b.unscored - a.unscored,
    name: (a, b) => a.name.localeCompare(b.name),
  };
  return [...result].sort(sorters[mentor.studentSort] || sorters.attention);
}

function renderStudents() {
  const mentor = mentorState();
  const students = filteredStudents();
  const cohorts = [...new Set(state.students.map((student) => student.cohort).filter(Boolean))].sort();
  main.innerHTML = `<section data-view="mstudents" class="live">
    <div class="eyebrow">Students</div>
    <h1 class="h1">${state.students.length} students, <em>each mid-story</em>.</h1>
    <div class="listBar">
      <input id="studentSearch" type="search" placeholder="Search by name, specialty, cohort…" value="${attr(mentor.studentQuery)}">
      <select id="studentCohort"><option value="">Cohort: all</option>${cohorts.map((cohort) => `<option ${mentor.studentCohort === cohort ? 'selected' : ''}>${esc(cohort)}</option>`).join('')}</select>
      <select id="studentSort">
        <option value="attention" ${mentor.studentSort === 'attention' ? 'selected' : ''}>Sort: most needing review</option>
        <option value="active" ${mentor.studentSort === 'active' ? 'selected' : ''}>Recently active</option>
        <option value="submitted" ${mentor.studentSort === 'submitted' ? 'selected' : ''}>Recently submitted</option>
        <option value="unscored" ${mentor.studentSort === 'unscored' ? 'selected' : ''}>Most unscored</option>
        <option value="name" ${mentor.studentSort === 'name' ? 'selected' : ''}>Name A–Z</option>
      </select>
      <span class="countNote">${students.length} of ${state.students.length} · press K to jump</span>
    </div>
    ${students.length ? students.map((student) => `<button class="mStuRow" type="button" data-open-student="${attr(student.id)}">
      <span class="stuAv">${esc(student.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join(''))}</span>
      <span class="rMain"><span class="rTitle">${esc(student.name)}</span><span class="rSub">${esc([student.year, student.specialty].filter(Boolean).join(' · '))} · last active ${esc(ago(student.lastCaptureAt))}</span></span>
      ${student.cohort ? `<span class="cohortChip">${esc(student.cohort)}</span>` : ''}
      <span class="numPair"><span class="n">${student.storyCount}</span><span class="l">Submitted</span></span>
      <span class="numPair"><span class="n">${student.awaitingReview + student.revised}</span><span class="l">To review</span></span>
      <span class="numPair"><span class="n metric-violet">${student.unscored}</span><span class="l">Unscored</span></span>
      <span class="rowBtn pri">Open</span>
    </button>`).join('') : emptyState('No student matches.', 'Clear a filter or search another name.')}
  </section>`;
}

async function openStudentWorkspace(id) {
  state.route = 'student';
  state.routeId = id;
  pushPath('student', id);
  main.innerHTML = loadingView('Opening the student workspace…');
  try {
    const payload = await api.mentorStudent(id);
    const student = normalizeStudent(firstDefined(payload?.student, state.students.find((item) => item.id === id), { id }));
    student.stories = asArray(firstDefined(payload?.stories, payload?.student?.stories)).map(normalizeStory);
    student.history = asArray(firstDefined(payload?.history, payload?.activity, payload?.student?.history)).map(activityRecord);
    student.mappingsLoaded = false;
    state.selectedStudent = student;
    state.stories = student.stories;
    if (!state.questions.length) await loadQuestions();
    renderShell();
    renderStudentWorkspace();
  } catch (error) {
    notify(error.message);
    await navigate('students', null, { replace: true });
  }
}

function filteredStudentStories() {
  const mentor = mentorState();
  const student = state.selectedStudent;
  if (!student) return [];
  const query = mentor.storyQuery.trim().toLowerCase();
  const stories = student.stories.filter((story) => {
    if (mentor.storyFilter === 'unreviewed' && !['awaiting', 'in_review'].includes(story.status)) return false;
    if (mentor.storyFilter === 'unscored' && story.mentorScore) return false;
    if (mentor.storyFilter === 'changes' && story.status !== 'changes') return false;
    if (mentor.storyFilter === 'approved' && story.status !== 'approved') return false;
    if (mentor.storyFilter === 'starStudent' && !story.studentStar) return false;
    if (mentor.storyFilter === 'starMentor' && !story.mentorStar) return false;
    if (mentor.storyFilter.startsWith('bird:') && !story.birds.includes(mentor.storyFilter.slice(5))) return false;
    if (mentor.storyFilter.startsWith('position:') && !story.positions.includes(mentor.storyFilter.slice(9))) return false;
    if (mentor.storyFilter.startsWith('question:') && !story.mappings.some((pair) => (
      normalizePair(pair).questionId === mentor.storyFilter.slice(9)
    ))) return false;
    if (query && !`${storyTitle(story)} ${story.text}`.toLowerCase().includes(query)) return false;
    return true;
  });
  const sorters = {
    new: (a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)),
    old: (a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)),
    high: (a, b) => b.mentorScore - a.mentorScore,
    low: (a, b) => (a.mentorScore || 9) - (b.mentorScore || 9),
  };
  return [...stories].sort(sorters[mentor.storySort] || sorters.new);
}

async function ensureStudentStoryMappings() {
  const student = state.selectedStudent;
  if (!student || student.mappingsLoaded) return;
  const stories = await Promise.all(student.stories.map(async (story) => {
    try {
      const detail = unwrapStory(await api.story(story.id));
      return normalizeStory({ ...story, ...detail });
    } catch {
      return story;
    }
  }));
  student.stories = stories;
  student.mappingsLoaded = true;
  state.stories = stories;
}

function renderStudentWorkspace() {
  const student = state.selectedStudent;
  if (!student) return;
  const mentor = mentorState();
  const stories = filteredStudentStories();
  main.innerHTML = `<section data-view="mstudent" class="live">
    <button class="backBtn" type="button" data-nav="students">‹ All students</button>
    <div class="profHead">
      <span class="stuAv">${esc(student.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join(''))}</span>
      <div><h1 class="h1">${esc(student.first)} <em>${esc(student.name.split(/\s+/).slice(1).join(' '))}</em></h1>
        <div class="eyebrow">${esc([student.year, student.specialty, student.cohort, student.cycle].filter(Boolean).join(' · '))}</div></div>
      <div class="profActions">
        <button class="btnGhost" type="button" data-student-prep>Interview Prep</button>
        <button class="btnGhost" type="button" data-toggle-history>Coaching history</button>
        <button class="btnGhost" type="button" data-open-teaching data-student-id="${attr(student.id)}">Teach from this library</button>
        <button class="btnSesh" type="button" data-start-session="${attr(student.id)}">Start 1:1 session</button>
      </div>
    </div>
    <div class="listBar">
      <input id="studentStorySearch" type="search" placeholder="Search ${attr(student.first)}’s stories…" value="${attr(mentor.storyQuery)}">
      <select id="studentStoryFilter">
        <option value="">Show: all submitted</option>
        <option value="unreviewed" ${mentor.storyFilter === 'unreviewed' ? 'selected' : ''}>Not yet reviewed</option>
        <option value="unscored" ${mentor.storyFilter === 'unscored' ? 'selected' : ''}>Not yet scored</option>
        <option value="changes" ${mentor.storyFilter === 'changes' ? 'selected' : ''}>Changes requested</option>
        <option value="approved" ${mentor.storyFilter === 'approved' ? 'selected' : ''}>Approved</option>
        <option value="starStudent" ${mentor.storyFilter === 'starStudent' ? 'selected' : ''}>Starred by student</option>
        <option value="starMentor" ${mentor.storyFilter === 'starMentor' ? 'selected' : ''}>Starred by me</option>
        <optgroup label="Bird type">${BIRDS.map((bird) => `<option value="bird:${bird.id}" ${mentor.storyFilter === `bird:${bird.id}` ? 'selected' : ''}>${bird.emo} ${esc(bird.label)}</option>`).join('')}</optgroup>
        <optgroup label="Ideal for">${POSITIONS.map((position) => `<option value="position:${position.id}" ${mentor.storyFilter === `position:${position.id}` ? 'selected' : ''}>${esc(position.label)}</option>`).join('')}</optgroup>
        <optgroup label="Interview question">${state.questions.map((question) => `<option value="question:${attr(question.id)}" ${mentor.storyFilter === `question:${question.id}` ? 'selected' : ''}>${esc(question.text.slice(0, 52))}${question.text.length > 52 ? '…' : ''}</option>`).join('')}</optgroup>
      </select>
      <select id="studentStorySort">
        <option value="new" ${mentor.storySort === 'new' ? 'selected' : ''}>Sort: newest</option>
        <option value="old" ${mentor.storySort === 'old' ? 'selected' : ''}>Oldest</option>
        <option value="high" ${mentor.storySort === 'high' ? 'selected' : ''}>My score (high→low)</option>
        <option value="low" ${mentor.storySort === 'low' ? 'selected' : ''}>My score (low→high)</option>
      </select>
      <span class="countNote">${stories.length} of ${student.stories.length} submitted</span>
    </div>
    <div id="studentHistory" class="panel" hidden><div class="pHead"><div class="h2">Coaching <em>history</em></div></div>
      <div class="pBody">${student.history.length ? student.history.map((item) => `<div class="histRow"><span class="hd">${esc(formatDate(item.createdAt))}</span><span>${esc(item.action)}${item.detail ? ` · ${esc(item.detail)}` : ''}</span></div>`).join('') : '<div class="stageHint">No coaching history yet.</div>'}</div>
    </div>
    ${stories.length ? stories.map((story) => storyRow(story)).join('') : emptyState('No stories match this filter.', 'Choose another filter.')}
  </section>`;
}

function renderQueue() {
  const mentor = mentorState();
  const cohorts = [...new Set(mentor.queue.map((item) => item.story.cohort || item.story.student_cohort).filter(Boolean))].sort();
  const filtered = mentor.queue.filter((item) => !mentor.queueCohort || firstDefined(item.story.cohort, item.story.student_cohort) === mentor.queueCohort);
  const counts = Object.fromEntries(QUEUE_BUCKETS.map(([key]) => [key, filtered.filter((item) => item.bucket === key).length]));
  const activeBucket = mentor.queueBucket || 'awaiting';
  const list = filtered.filter((item) => item.bucket === activeBucket);
  main.innerHTML = `<section data-view="mqueue" class="live">
    <div class="eyebrow">Review Queue · every student</div>
    <h1 class="h1">${(counts.awaiting || 0) + (counts.revised || 0)} stories <em>waiting on you</em>.</h1>
    <div class="listBar">
      <div class="bucketChips">${QUEUE_BUCKETS.map(([key, label]) => `<button class="bChip ${activeBucket === key ? 'on' : ''}" type="button" data-queue-bucket="${key}">${esc(label)}<span class="bn">${counts[key] || 0}</span></button>`).join('')}</div>
      <select id="queueCohort"><option value="">Cohort: all</option>${cohorts.map((cohort) => `<option ${mentor.queueCohort === cohort ? 'selected' : ''}>${esc(cohort)}</option>`).join('')}</select>
    </div>
    ${list.length ? list.map(({ story }) => storyRow(story, { showStudent: true })).join('') : emptyState(`Nothing in “${QUEUE_BUCKETS.find(([key]) => key === activeBucket)?.[1] || 'this queue'}”.`, 'That’s what an empty queue is supposed to look like.')}
  </section>`;
}

function renderActivity() {
  const mentor = mentorState();
  const filters = mentor.activityFilters;
  const cohorts = [...new Set(state.students.map((student) => student.cohort).filter(Boolean))].sort();
  main.innerHTML = `<section data-view="mactivity" class="live">
    <div class="eyebrow">My Review Activity</div>
    <h1 class="h1">${mentor.activity.length} actions <em>in this view</em>.</h1>
    <div class="listBar">
      <select id="activityStudent"><option value="">Student: all</option>${state.students.map((student) => `<option value="${attr(student.id)}" ${filters.student === student.id ? 'selected' : ''}>${esc(student.name)}</option>`).join('')}</select>
      <select id="activityCohort"><option value="">Cohort: all</option>${cohorts.map((cohort) => `<option ${filters.cohort === cohort ? 'selected' : ''}>${esc(cohort)}</option>`).join('')}</select>
      <select id="activityType"><option value="">Action: all</option>${['status', 'feedback', 'score', 'question', 'star'].map((type) => `<option value="${type}" ${filters.type === type ? 'selected' : ''}>${type[0].toUpperCase()}${type.slice(1)}</option>`).join('')}</select>
      <select id="activityPeriod"><option value="today" ${filters.period === 'today' ? 'selected' : ''}>Today</option><option value="week" ${filters.period === 'week' ? 'selected' : ''}>This week</option><option value="month" ${filters.period === 'month' ? 'selected' : ''}>This month</option><option value="custom" ${filters.period === 'custom' ? 'selected' : ''}>Custom range…</option><option value="all" ${filters.period === 'all' ? 'selected' : ''}>All time</option></select>
      ${filters.period === 'custom' ? `<input id="activityFrom" type="date" value="${attr(filters.from)}"><span>to</span><input id="activityTo" type="date" value="${attr(filters.to)}">` : ''}
    </div>
    <div class="panel"><div class="pBody">
      ${mentor.activity.length ? mentor.activity.map((item) => `<button class="actRow" type="button" data-open-story="${attr(item.storyId)}">
        <span class="aw">${esc(formatDateTime(item.createdAt))}</span><span><b>${esc(item.mentorName)}</b> — ${esc(item.action)}${item.detail ? ` · ${esc(item.detail)}` : ''} on <b>“${esc(item.storyTitle)}”</b> · ${esc(item.studentName)}${item.cohort ? ` (${esc(item.cohort)})` : ''}</span>
      </button>`).join('') : '<div class="stageHint">No mentor actions in this period.</div>'}
    </div></div>
  </section>`;
}

async function reloadActivityView() {
  await loadActivity();
  renderActivity();
}

function teachingEntry(raw = {}) {
  const story = normalizeStory(raw.story ? { ...raw.story, ...raw } : raw);
  return {
    story,
    student: normalizeStudent(firstDefined(raw.student, {
      id: story.studentId,
      display_name: story.studentName,
    })),
    craft: firstDefined(raw.craft, raw.craft_scores, story.craft, {}),
  };
}

async function openTeaching(studentId = '') {
  if (!isMentor()) return;
  state.returnFocus = document.activeElement;
  teaching.innerHTML = loadingView('Opening Teaching Mode…');
  teaching.classList.add('open');
  try {
    const payload = await api.teachingStories(studentId);
    const entries = asArray(firstDefined(payload?.stories, payload?.items)).map(teachingEntry);
    mentorState().teaching = {
      entries,
      a: entries[0] || null,
      b: null,
      anonymous: true,
    };
    renderTeaching();
  } catch (error) {
    teaching.innerHTML = `<div class="teachUnavailable" role="dialog" aria-modal="true">
      <h2>Teaching Mode is unavailable</h2><p>${esc(error.message)}</p><button class="rowBtn" type="button" data-close-overlay>Close</button>
    </div>`;
  }
}

function teachingColumn(entry, side) {
  if (!entry) return '';
  const { story, student, craft } = entry;
  const context = mentorState().teaching;
  const score = CRAFT.reduce((sum, dimension) => sum + (Number(craft?.[dimension.id]) || 0), 0);
  return `<div class="tCol">
    <div class="tWho">${context.anonymous ? `Story ${side}` : `${esc(student.name)}${student.year ? ` · ${esc(student.year)}` : ''}`} · ${esc(STATUS[story.status].label)}${story.mentorScore ? ` · Mentor score ${story.mentorScore}/5` : ''}</div>
    ${story.prefixEnabled ? '<div class="tPre">The One Where</div>' : ''}<div class="tTtl">${esc(story.title)}</div>
    <div class="tBody">${esc(story.text)}</div>${story.lesson ? `<div class="tLesson">“${esc(story.lesson)}”</div>` : ''}
    <div class="anatomy"><div class="aHead">Story anatomy · ${score}/15</div><div class="aSub">Score it live — segments light as you teach why this story works.</div>
      ${CRAFT.map((dimension) => {
        const value = Number(craft?.[dimension.id]) || 0;
        return `<div class="aDim"><span class="al">${esc(dimension.label)}</span><span class="segs" data-teach-side="${side}" data-craft="${dimension.id}">${[1, 2, 3].map((n) => `<button type="button" data-craft-score="${n}" class="${value >= n ? 'lit' : ''}" aria-label="${esc(dimension.label)} ${n}"></button>`).join('')}</span><span class="tScore">${value}</span></div><div class="tHint">${esc(dimension.hint)}</div>`;
      }).join('')}
    </div>
    <div class="tActs"><span class="fLbl">Live actions</span>
      <div class="statusRow">${['in_review', 'changes', 'reviewed', 'approved'].map((status) => `<button type="button" data-teach-status="${side}:${status}" class="${story.status === status ? `on ${STATUS[status].col}` : ''}">${esc(STATUS[status].label)}</button>`).join('')}</div>
      ${scorePicker(`teach-${side}`, story.mentorScore, true)}
      <button class="rowBtn" type="button" data-teach-assign="${side}">Assign questions</button>
      <div class="askRow"><input data-teach-comment="${side}" placeholder="Comment — saves to the story, notifies the student…"><button class="noteSend" type="button" data-send-teach-comment="${side}">Send</button></div>
    </div>
  </div>`;
}

function renderTeaching() {
  const context = mentorState().teaching;
  if (!context) return;
  if (!context.entries.length) {
    teaching.innerHTML = `<div class="teachUnavailable" role="dialog" aria-modal="true"><h2>No submitted stories are available</h2><p>Teaching Mode never reveals private stories.</p><button class="rowBtn" type="button" data-close-overlay>Close</button></div>`;
    return;
  }
  const optionMarkup = (selected) => context.entries.map((entry) => `<option value="${attr(entry.story.id)}" ${selected?.story.id === entry.story.id ? 'selected' : ''}>${context.anonymous ? 'Story' : esc(entry.student.name)} — ${esc(storyTitle(entry.story).slice(0, 48))}</option>`).join('');
  teaching.innerHTML = `<div role="dialog" aria-modal="true" aria-label="Teaching Mode">
    <div class="tBar">
      <div class="tTitle">Teaching <em>Mode</em></div>
      <select class="tSel" id="teachA">${optionMarkup(context.a)}</select>
      <select class="tSel" id="teachB"><option value="">+ Compare with…</option>${optionMarkup(context.b)}</select>
      <div class="tglRow"><button class="tgl ${context.anonymous ? 'on' : ''}" type="button" data-toggle-anonymous aria-pressed="${context.anonymous}" aria-label="Hide student names"><i></i></button> Hide names<span class="tglHint">— on by default for class</span></div>
      <button class="btnGhost" type="button" data-close-overlay>Exit Teaching Mode</button>
    </div>
    <div class="teachGrid ${context.b ? 'two' : ''}">${teachingColumn(context.a, 'A')}${teachingColumn(context.b, 'B')}</div>
  </div>`;
}

function teachingSide(side) {
  return side === 'A' ? mentorState().teaching?.a : mentorState().teaching?.b;
}

async function setCraft(side, dimension, score) {
  const entry = teachingSide(side);
  if (!entry) return;
  const current = Number(entry.craft?.[dimension]) || 0;
  const value = current === Number(score) ? Math.max(0, Number(score) - 1) : Number(score);
  await withBusy(() => api.craft(entry.story.id, { [dimension]: value }));
  entry.craft = { ...entry.craft, [dimension]: value };
  renderTeaching();
}

async function startSession(studentId) {
  try {
    const result = await withBusy(() => api.createSession(studentId));
    const session = firstDefined(result?.session, result);
    mentorState().session = {
      id: String(firstDefined(session.id, session.session_id, '')),
      studentId,
      studentName: String(firstDefined(session.student_name, state.selectedStudent?.name, 'Student')),
      items: asArray(firstDefined(session.items, result?.items)).map((item) => ({
        ...item,
        id: String(firstDefined(item.id, item.item_id, '')),
        label: String(firstDefined(item.label, item.text, item.title, 'Agenda item')),
        covered: Boolean(firstDefined(item.covered, item.completed, false)),
        storyId: String(firstDefined(item.storyId, item.story_id, '')),
        questionId: String(firstDefined(item.questionId, item.question_id, '')),
      })),
      expanded: false,
    };
    renderSessionBar();
    notify(`1:1 session started with ${mentorState().session.studentName}. Work the agenda in any order; tap the circle when an item is covered.`);
  } catch (error) {
    notify(error.message);
  }
}

function renderSessionBar() {
  const session = mentorState().session;
  if (!session) {
    sessionBar.classList.remove('on');
    sessionBar.innerHTML = '';
    document.body.classList.remove('seshOn');
    return;
  }
  const covered = session.items.filter((item) => item.covered).length;
  sessionBar.classList.add('on');
  sessionBar.classList.toggle('exp', session.expanded);
  document.body.classList.add('seshOn');
  sessionBar.innerHTML = `<span class="sLbl">1:1 · ${esc(session.studentName)}</span>
    <button class="agSum" type="button" data-expand-session>Agenda ${covered}/${session.items.length} ${session.expanded ? '▾' : '▴'}</button>
    <div class="agWrap">${session.items.map((item) => `<button class="agChip ${item.covered ? 'done' : ''}" type="button" data-session-item="${attr(item.id)}" data-story-id="${attr(item.storyId)}" data-question-id="${attr(item.questionId)}"><i class="agCk">${item.covered ? '✓' : ''}</i>${esc(item.label)}</button>`).join('')}</div>
    <button class="rowBtn" type="button" data-end-session>End session</button>`;
}

async function toggleSessionItem(itemId) {
  const session = mentorState().session;
  const item = session?.items.find((entry) => entry.id === itemId);
  if (!session || !item) return;
  const result = await withBusy(() => api.coverSessionItem(session.id, item.id, !item.covered));
  item.covered = Boolean(firstDefined(result?.item?.covered, !item.covered));
  renderSessionBar();
}

async function endSession() {
  const session = mentorState().session;
  if (!session) return;
  await withBusy(() => api.endSession(session.id));
  const covered = session.items.filter((item) => item.covered).length;
  notify(`Session logged — ${covered} of ${session.items.length} agenda items covered.`);
  mentorState().session = null;
  renderSessionBar();
}

function openPalette() {
  if (!isMentor()) return;
  state.returnFocus = document.activeElement;
  renderPalette('');
  palette.classList.add('open');
  window.setTimeout(() => $('#paletteSearch')?.focus(), 30);
}

function renderPalette(query) {
  const value = query.trim().toLowerCase();
  const students = state.students.filter((student) => !value || `${student.name} ${student.specialty} ${student.cohort}`.toLowerCase().includes(value)).slice(0, 8);
  const stories = value ? state.stories.filter((story) => `${storyTitle(story)} ${story.text}`.toLowerCase().includes(value)).slice(0, 5) : [];
  palette.innerHTML = `<div class="palBox" role="dialog" aria-modal="true" aria-label="Find a student">
    <input id="paletteSearch" placeholder="Jump to a student — or search submitted stories…" value="${attr(query)}" autocomplete="off">
    ${students.map((student) => `<button class="palItem" type="button" data-open-student="${attr(student.id)}"><span class="stuAv">${esc(student.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join(''))}</span><span class="pn">${esc(student.name)}</span><span class="pm">${esc(student.cohort)} · ${esc(student.specialty)}${student.awaitingReview ? `<br><span class="attn">${student.awaitingReview} to review</span>` : ''}</span></button>`).join('')}
    ${stories.length ? '<div class="palSec">Stories · submitted students</div>' : ''}
    ${stories.map((story) => `<button class="palItem" type="button" data-open-story="${attr(story.id)}"><span class="stuAv">S</span><span class="pn">${esc(storyTitle(story))}</span><span class="pm">${esc(story.studentName)}</span></button>`).join('')}
    ${students.length || stories.length ? '' : '<div class="deskClear">No student or submitted story matches.</div>'}
  </div>`;
}

function adminConsoleState() {
  return state.adminConsole;
}

function adminQuery(values) {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== null && value !== undefined && String(value).trim()) query.set(key, String(value));
  });
  return query.toString();
}

function adminStoryRow(story, { showStudent = true } = {}) {
  const current = normalizeStory(story);
  return `<article class="mStuRow adminStoryRow">
    <span class="stuAv">${esc((current.studentName || 'S').split(/\s+/).map((part) => part[0]).slice(0, 2).join(''))}</span>
    <span class="rMain"><span class="rTitle">${esc(current.title)}</span><span class="rSub">${showStudent ? `${esc(current.studentName)} · ` : ''}${esc(formatDateTime(current.updatedAt))}</span></span>
    ${statusChip(current)}
    ${scoreDots(current.mentorScore, 'mentor', 'Reviewer score')}
    ${current.reviewSuitability ? `<span class="cohortChip">${esc(SUITABILITY[current.reviewSuitability] || current.reviewSuitability)}</span>` : ''}
    <button class="rowBtn pri" type="button" data-admin-open-story="${attr(current.id)}">Review</button>
  </article>`;
}

async function loadAdminHome() {
  adminConsoleState().home = await api.adminHome();
}

async function loadAdminStudents() {
  const admin = adminConsoleState();
  const payload = state.capabilities?.adminDirectory
    ? await api.adminDirectory(adminQuery({
      q: admin.studentQuery,
      filter: admin.studentFilter,
      session: admin.studentSession,
      sort: admin.studentSort,
      page: admin.studentPage,
      pageSize: 25,
    }))
    : await api.adminStudents(adminQuery({
    q: admin.studentQuery,
    status: admin.studentStatus,
    limit: 25,
    }));
  admin.students = asArray(payload?.students).map(normalizeStudent);
  admin.studentsCursor = payload?.nextCursor || null;
  admin.studentTotal = Number(payload?.total || admin.students.length);
  if (state.capabilities?.adminDirectory) {
    const views = await api.adminSavedViews().catch(() => ({ views: [] }));
    admin.savedViews = asArray(views?.views);
  }
}

async function loadAdminStudent(id) {
  const [payload, directory] = await Promise.all([
    api.adminStudent(id),
    state.capabilities?.adminDirectory
      ? api.adminDirectoryStudent(id).catch(() => null)
      : Promise.resolve(null),
  ]);
  adminConsoleState().selectedStudent = {
    ...normalizeStudent(payload?.student || { id }),
    stories: asArray(payload?.stories).map(normalizeStory),
  };
  adminConsoleState().directoryDetail = directory?.student || null;
}

async function loadAdminQueue() {
  const admin = adminConsoleState();
  const payload = await api.adminQueue(adminQuery({
    q: admin.queueQuery,
    status: admin.queueStatus,
    session: admin.queueSession,
    sort: admin.queueSort,
    page: admin.queuePage,
    pageSize: state.capabilities?.adminDirectory ? 25 : '',
    limit: state.capabilities?.adminDirectory ? '' : 25,
  }));
  admin.queue = asArray(payload?.stories).map(normalizeStory);
  admin.queueCursor = payload?.nextCursor || null;
}

async function loadAdminContent() {
  if (!state.capabilities?.inspirationAdmin) return;
  const payload = await api.adminInspiration();
  adminConsoleState().contentPrompts = asArray(payload?.prompts);
}

async function loadAdminStory(id) {
  const [payload, versionsPayload] = await Promise.all([
    api.adminStory(id),
    state.capabilities?.storyVersions
      ? api.storyVersions(id).catch(() => ({ versions: [] }))
      : Promise.resolve({ versions: [] }),
  ]);
  const story = normalizeStory({
    ...(payload?.story || {}),
    feedback: payload?.feedback,
    revisions: payload?.revisions,
    reflections: payload?.reflections,
    craft: payload?.craft,
    internalNotes: payload?.internalNotes,
  });
  state.mentorNoteDraft = null;
  if ((state.capabilities?.mentorNotesRead || canWriteMentorNotes()) && story.status !== 'private') {
    const notesPayload = await optionalRequest(`/api/stories/${id}/mentor-notes?reviewer=1`, { notes: [] });
    story.mentorNotes = asArray(notesPayload?.notes).map(normalizeMentorNote);
  }
  state.storyVersions = asArray(versionsPayload?.versions);
  state.storyTab = 'working';
  adminConsoleState().story = story;
}

function renderAdminHome() {
  const payload = adminConsoleState().home || {};
  const metrics = payload.metrics || {};
  const recent = asArray(payload.recent).map(normalizeStory);
  main.innerHTML = `<section data-view="admin-home" class="live">
    <div class="homeHero"><div class="eyebrow">Administrator workspace</div><h1 class="h1">Review StoryForge, <em>without crossing privacy lines</em>.</h1>
      <p class="greetSub">Search eligible students, work submitted stories, and leave clearly attributed review decisions. Private stories remain invisible.</p></div>
    <div class="forgeStats adminMetrics">
      <div class="fstat"><div class="n">${Number(metrics.submittedStories || 0)}</div><div class="l">Submitted stories</div></div>
      <div class="fstat"><div class="n metric-ember">${Number(metrics.awaitingReview || 0)}</div><div class="l">Awaiting review</div></div>
      <div class="fstat"><div class="n metric-cyan">${Number(metrics.inReview || 0)}</div><div class="l">In review</div></div>
      <div class="fstat"><div class="n metric-green">${Number(metrics.approved || 0)}</div><div class="l">Approved</div></div>
      <div class="fstat"><div class="n metric-violet">${Number(metrics.unscored || 0)}</div><div class="l">Unscored</div></div>
    </div>
    <div class="inlineActions mentorActions">
      <button class="bigAction" type="button" data-nav="students"><span class="ba1">Find a student</span><span class="ba2">Search only the eligible StoryForge population with submitted work.</span><span class="baGo">Open Students ▸</span></button>
      <button class="bigAction" type="button" data-nav="queue"><span class="ba1">Review queue</span><span class="ba2">Filter submitted stories by review state without exposing private drafts.</span><span class="baGo">Open Review Queue ▸</span></button>
    </div>
    <div class="panel panel-spaced"><div class="pHead"><div class="h2">Recently active <em>submitted stories</em></div></div><div class="pBody">
      ${recent.length ? recent.map((story) => adminStoryRow(story)).join('') : '<div class="stageHint">No submitted stories are available.</div>'}
    </div></div>
  </section>`;
}

function renderAdminStudents() {
  const admin = adminConsoleState();
  main.innerHTML = `<section data-view="admin-students" class="live">
    <div class="eyebrow">Administrator · Students</div>
    <h1 class="h1">Find the right <em>student account</em>.</h1>
    <form class="listBar" id="adminStudentSearchForm" role="search">
      <label class="srOnly" for="adminStudentSearch">Search students</label>
      <input id="adminStudentSearch" type="search" placeholder="Name, WordPress ID, cohort…" value="${attr(admin.studentQuery)}" autocomplete="off">
      <label class="srOnly" for="adminStudentStatus">Review status</label>
      <select id="adminStudentStatus" ${state.capabilities?.adminDirectory ? 'hidden' : ''}>
        <option value="">All submitted work</option>
        ${['awaiting', 'in_review', 'changes', 'reviewed', 'approved', 'unscored'].map((status) => `<option value="${status}" ${admin.studentStatus === status ? 'selected' : ''}>${esc(status === 'unscored' ? 'Unscored' : STATUS[status].label)}</option>`).join('')}
      </select>${state.capabilities?.adminDirectory ? `<select id="adminStudentFilter" aria-label="Attention filter">${[['all','All students'],['awaiting','Awaiting review'],['needs_review','Needs review'],['never_active','Never active'],['never_started','Never started'],['needs_nudge','Needs a nudge'],['inactive_7','Inactive 7+ days'],['inactive_30','Inactive 30+ days']].map(([value,label])=>`<option value="${value}" ${admin.studentFilter===value?'selected':''}>${label}</option>`).join('')}</select><select id="adminStudentSession" aria-label="Session filter"><option value="">Any session</option><option value="active" ${admin.studentSession==='active'?'selected':''}>Active now</option><option value="idle" ${admin.studentSession==='idle'?'selected':''}>Idle</option><option value="offline" ${admin.studentSession==='offline'?'selected':''}>Offline</option></select><select id="adminStudentSort" aria-label="Sort students">${[['attention','Needs attention'],['name','Name'],['recent','Most recent'],['quiet','Quietest'],['stories','Story count']].map(([value,label])=>`<option value="${value}" ${admin.studentSort===value?'selected':''}>${label}</option>`).join('')}</select>` : ''}
      <button class="rowBtn pri" type="submit">Search</button><span class="countNote" id="adminStudentCount">${admin.students.length} results · server-authorized</span>
    </form>
    ${state.capabilities?.adminDirectory ? `<div class="b1514SavedViews"><label for="adminSavedView">Saved view</label><select id="adminSavedView"><option value="">Choose a saved view</option>${admin.savedViews.map((view)=>`<option value="${attr(view.id)}" ${admin.selectedSavedView===view.id?'selected':''}>${esc(view.label)}</option>`).join('')}</select><button class="rowBtn" type="button" data-admin-save-view>Save current view</button><button class="rowBtn danger" type="button" data-admin-delete-view ${admin.selectedSavedView?'':'disabled'}>Delete selected view</button></div>` : ''}
    <div id="adminStudentResults">${adminStudentRowsMarkup()}</div>
    ${state.capabilities?.adminDirectory ? `<div class="inlineActions b1514AdminPager"><button class="rowBtn" type="button" data-admin-student-page="${Math.max(1,admin.studentPage-1)}" ${admin.studentPage<=1?'disabled':''}>‹ Previous</button><span>Page ${admin.studentPage} · ${admin.studentTotal} authorized students</span><button class="rowBtn" type="button" data-admin-student-page="${admin.studentPage+1}" ${admin.studentPage*25>=admin.studentTotal?'disabled':''}>Next ›</button></div>` : ''}<div id="adminStudentSearchStatus" class="srOnly" role="status" aria-live="polite"></div>
  </section>`;
}

function adminStudentRowsMarkup() {
  const students = adminConsoleState().students;
  return students.length ? students.map((student) => `<article class="mStuRow">
      <span class="stuAv">${esc(student.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join(''))}</span>
      <span class="rMain"><span class="rTitle">${esc(student.name)}</span><span class="rSub">${esc([student.year, student.specialty, student.cohort].filter(Boolean).join(' · '))}</span></span>
      <span class="numPair"><span class="n">${student.storyCount}</span><span class="l">Submitted</span></span>
      <span class="numPair"><span class="n">${student.awaitingReview}</span><span class="l">Awaiting</span></span>
      <span class="numPair"><span class="n metric-violet">${student.unscored}</span><span class="l">Unscored</span></span>
      <button class="rowBtn pri" type="button" data-admin-open-student="${attr(student.id)}">Open</button>
    </article>`).join('') : emptyState('No student matches.', 'Try a different name, WordPress ID, cohort, or review filter.');
}

function renderAdminStudentRowsOnly() {
  const rows = $('#adminStudentResults');
  if (rows) rows.innerHTML = adminStudentRowsMarkup();
  const count = $('#adminStudentCount');
  if (count) count.textContent = `${adminConsoleState().students.length} results · server-authorized`;
  const status = $('#adminStudentSearchStatus');
  if (status) status.textContent = `${adminConsoleState().students.length} authorized student results.`;
}

function renderAdminStudent() {
  const student = adminConsoleState().selectedStudent;
  if (!student) return;
  main.innerHTML = `<section data-view="admin-student" class="live">
    <button class="backBtn" type="button" data-nav="students">‹ All students</button>
    <div class="profHead"><span class="stuAv">${esc(student.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join(''))}</span><div>
      <div class="eyebrow">Administrator · submitted StoryForge account</div><h1 class="h1">${esc(student.first)} <em>${esc(student.name.split(/\s+/).slice(1).join(' '))}</em></h1>
      <p class="stageHint">${esc([student.year, student.specialty, student.cohort, student.cycle].filter(Boolean).join(' · '))}</p></div></div>
    <div class="privacyBoundary" role="note">Private and archived stories are intentionally absent. This workspace cannot enumerate or open them.</div>
    ${adminConsoleState().directoryDetail ? `<div class="forgeStats b1514DirectoryStats"><div class="fstat"><div class="n">${Number(adminConsoleState().directoryDetail.submittedStories || 0)}</div><div class="l">Submitted</div></div><div class="fstat"><div class="n">${Number(adminConsoleState().directoryDetail.awaitingReview || 0)}</div><div class="l">Awaiting</div></div><div class="fstat"><div class="n">${Number(adminConsoleState().directoryDetail.privateStoryCount || 0)}</div><div class="l">Private count only</div></div></div>${adminConsoleState().directoryDetail.activity ? `<div class="railCard"><div class="rLbl">Activity boundary</div><p>${esc(adminConsoleState().directoryDetail.activity.label || 'No recent session signal.')}</p><small>Content, keystrokes, drafts, and private story text are never tracked.</small></div>` : ''}${state.capabilities?.reviewCheck ? `<div class="inlineActions"><button class="rowBtn" type="button" data-review-check-preview="${attr(student.id)}">Preview Review Check</button><button class="rowBtn pri" type="button" data-review-check-send="${attr(student.id)}">Send Review Check</button></div>` : ''}` : ''}
    ${student.stories.length ? student.stories.map((story) => adminStoryRow({ ...story, studentName: student.name }, { showStudent: false })).join('') : emptyState('No submitted stories.', 'Private work remains private until the student submits it.')}
  </section>`;
}

function renderAdminQueue() {
  const admin = adminConsoleState();
  main.innerHTML = `<section data-view="admin-queue" class="live">
    <div class="eyebrow">Administrator · Review Queue</div><h1 class="h1">Submitted stories, <em>bounded and auditable</em>.</h1>
    <div class="listBar">${state.capabilities?.adminDirectory ? '<label class="srOnly" for="adminQueueSearch">Search queue</label><input id="adminQueueSearch" type="search" placeholder="Student or story…" value="'+attr(admin.queueQuery)+'">' : ''}<label class="srOnly" for="adminQueueStatus">Review status</label><select id="adminQueueStatus">
      <option value="">All submitted stories</option>
      ${['awaiting', 'in_review', 'changes', 'reviewed', 'approved', 'unscored'].map((status) => `<option value="${status}" ${admin.queueStatus === status ? 'selected' : ''}>${esc(status === 'unscored' ? 'Unscored' : STATUS[status].label)}</option>`).join('')}
    </select>${state.capabilities?.adminDirectory ? `<select id="adminQueueSession" aria-label="Queue session"><option value="">Any session</option><option value="active" ${admin.queueSession==='active'?'selected':''}>Active now</option><option value="idle" ${admin.queueSession==='idle'?'selected':''}>Idle</option><option value="offline" ${admin.queueSession==='offline'?'selected':''}>Offline</option></select><select id="adminQueueSort" aria-label="Queue order"><option value="oldest" ${admin.queueSort==='oldest'?'selected':''}>Oldest awaiting</option><option value="newest" ${admin.queueSort==='newest'?'selected':''}>Newest</option><option value="updated" ${admin.queueSort==='updated'?'selected':''}>Recently updated</option><option value="student" ${admin.queueSort==='student'?'selected':''}>Student</option></select><button class="rowBtn pri" type="button" data-admin-queue-search>Apply</button>` : ''}<span class="countNote">${admin.queue.length} results · private stories excluded</span></div>
    ${admin.queue.length ? admin.queue.map((story) => adminStoryRow(story)).join('') : emptyState('Nothing in this queue.', 'Choose another review state.')}${state.capabilities?.adminDirectory ? `<div class="inlineActions b1514AdminPager"><button class="rowBtn" type="button" data-admin-queue-page="${Math.max(1,admin.queuePage-1)}" ${admin.queuePage<=1?'disabled':''}>‹ Previous</button><span>Page ${admin.queuePage}</span><button class="rowBtn" type="button" data-admin-queue-page="${admin.queuePage+1}" ${admin.queue.length<25?'disabled':''}>Next ›</button></div>` : ''}
  </section>`;
}

function renderAdminContent() {
  const prompts = adminConsoleState().contentPrompts;
  main.innerHTML = `<section data-view="admin-content" class="live b1514ContentStudio"><div class="eyebrow">Administrator · Content Studio</div><h1 class="h1">Govern <em>Inspiration</em>.</h1><p class="greetSub">Validate one prompt or import a reviewed CSV. Bulk imports always land retired and require explicit publication.</p>
    <form id="adminInspirationForm" class="railCard"><label>Prompt question<textarea id="adminPromptText" maxlength="400" required></textarea></label><div class="b1514FieldGrid"><label>Territory<input id="adminPromptTerritory" value="clinical_growth" required></label><label>Order<input id="adminPromptOrder" type="number" min="1" max="100000" value="100" required></label></div><label>Follow-up<input id="adminPromptFollowup" value="What changed because of that moment?" required></label><label>Interview use<input id="adminPromptUse" value="Shows reflection and growth." required></label><div class="inlineActions"><button class="rowBtn" type="button" data-admin-prompt-validate>Validate</button><button class="btnSave" type="submit">Publish active prompt</button></div></form>
    <form id="adminInspirationBulkForm" class="railCard"><label>Governed CSV<textarea id="adminPromptCsv" rows="6" placeholder="Paste the exact 13-column governed CSV"></textarea></label><div class="inlineActions"><button class="rowBtn" type="submit">Parse safely</button></div></form>
    <div class="panel panel-spaced"><div class="pHead"><div class="h2">Prompt bank <em>${prompts.length}</em></div></div><div class="pBody">${prompts.map((prompt)=>`<article class="mStuRow"><span class="rMain"><span class="rTitle">${esc(prompt.key)} · ${esc(prompt.text)}</span><span class="rSub">${esc(prompt.territory)} · version ${Number(prompt.rowVersion||0)}</span></span><span class="cohortChip">${esc(prompt.state)}</span><button class="rowBtn" type="button" data-admin-prompt-history="${attr(prompt.id)}">History</button></article>`).join('')||'<div class="stageHint">No prompts match.</div>'}</div></div></section>`;
}

function adminInspirationDraft(form) {
  return {
    id: null,
    libraryKey: null,
    text: $('#adminPromptText', form)?.value.trim() || '',
    who: ['you'],
    whoDetail: [],
    domain: ['personal'],
    energy: ['serious'],
    territory: $('#adminPromptTerritory', form)?.value.trim() || '',
    followUp: $('#adminPromptFollowup', form)?.value.trim() || '',
    interviewUse: $('#adminPromptUse', form)?.value.trim() || '',
    state: 'active',
    recommended: false,
    sortOrder: Number($('#adminPromptOrder', form)?.value || 0),
    expectedVersion: null,
  };
}

function renderAdminStory() {
  const story = adminConsoleState().story;
  if (!story) return;
  state.storyDetail = story;
  renderStoryRoom({ adminStory: story });
}

async function saveAdminStoryReview(form) {
  const story = adminConsoleState().story;
  if (!story) return;
  const feedback = $('#adminStudentFeedback', form)?.value.trim() || '';
  const internalNote = $('#adminInternalNote', form)?.value.trim() || '';
  const scoreValue = $('#adminReviewScore', form)?.value || '';
  const suitability = $('#adminReviewSuitability', form)?.value || '';
  const result = await withBusy(() => api.adminReview(story.id, {
    expectedVersion: story.rowVersion,
    patch: {
      status: $('#adminReviewStatus', form)?.value || story.status,
      mentorScore: scoreValue ? Number(scoreValue) : null,
      suitability: suitability || null,
      ...(feedback ? { studentFeedback: feedback } : {}),
      ...(internalNote ? { internalNote } : {}),
    },
  }));
  adminConsoleState().story = normalizeStory({
    ...(result?.story || {}),
    feedback: result?.feedback,
    revisions: result?.revisions,
    reflections: result?.reflections,
    craft: result?.craft,
    internalNotes: result?.internalNotes,
  });
  renderAdminStory();
  notify('Administrator review saved and audited.', '✓');
}

async function updateAdminTaxonomy(kind, id) {
  const story = adminConsoleState().story;
  if (!story || !canAdminReview() || !state.capabilities?.taxonomy || !['categories', 'uses'].includes(kind)) return;
  const previous = [...story[kind]];
  const values = previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id];
  story[kind] = values;
  const button = $(`[data-admin-taxonomy="${CSS.escape(id)}"][data-taxonomy-kind="${kind}"]`);
  button?.classList.toggle('on', values.includes(id));
  button?.setAttribute('aria-pressed', String(values.includes(id)));
  try {
    const result = await api.adminTaxonomy(story.id, {
      categories: kind === 'categories' ? values : story.categories,
      uses: kind === 'uses' ? values : story.uses,
      expectedVersion: story.rowVersion ?? 0,
      surface: 'workspace',
    });
    adminConsoleState().story = normalizeStory({ ...story, ...(result?.story || result) });
    renderAdminStory();
    notify(kind === 'categories' ? 'Administrator category change saved and audited.' : 'Administrator intended-use change saved and audited.');
  } catch (error) {
    story[kind] = previous;
    button?.classList.toggle('on', previous.includes(id));
    button?.setAttribute('aria-pressed', String(previous.includes(id)));
    notify(error.message || 'StoryForge could not save that administrator classification.');
  }
}

function activeMentorNoteStory() {
  return room.classList.contains('open') ? state.storyDetail : adminConsoleState().story;
}

function storeMentorNote(note) {
  const story = activeMentorNoteStory();
  const notes = asArray(story?.mentorNotes).map(normalizeMentorNote);
  const incomingId = String(firstDefined(note?.id, note?.noteId, note?.note_id, ''));
  const existing = notes.find((item) => item.id === incomingId)
    || (state.mentorNoteDraft?.id ? normalizeMentorNote(state.mentorNoteDraft) : null);
  const normalized = normalizeMentorNote({ ...(existing || {}), ...note, id: incomingId || existing?.id });
  if (!story) return normalized;
  story.mentorNotes = notes.some((item) => item.id === normalized.id)
    ? notes.map((item) => item.id === normalized.id ? normalized : item)
    : [...notes, normalized];
  state.mentorNoteDraft = normalized.state === 'draft' ? normalized : null;
  return normalized;
}

function renderActiveMentorNoteSurface() {
  if (room.classList.contains('open')) renderStoryRoom();
  else if (canAdminReview() && adminConsoleState().story) renderAdminStory();
}

async function saveMentorNoteDraft({ allowEmpty = false } = {}) {
  const story = activeMentorNoteStory();
  const field = $('#mentorNoteText');
  const body = field?.value.trim() || '';
  if (!story || !canWriteMentorNotes() || (!body && !allowEmpty)) return null;
  const draft = state.mentorNoteDraft?.id ? normalizeMentorNote(state.mentorNoteDraft) : null;
  const result = draft
    ? await api.updateMentorNote(draft.id, { body, expectedVersion: draft.rowVersion, surface: 'workspace' })
    : await api.createMentorNote(story.id, {
      body,
      internalOnly: Boolean($('#mentorNoteInternal')?.checked),
      surface: 'workspace',
    });
  const saved = storeMentorNote(result?.note || result);
  renderActiveMentorNoteSurface();
  notify('Mentor note draft saved. It is not visible to the student.');
  return saved;
}

async function publishMentorNote() {
  let draft = await saveMentorNoteDraft();
  if (!draft) return;
  if (draft.internalOnly) {
    notify('Internal-only notes cannot be published to the student.');
    return;
  }
  const result = await api.publishMentorNote(draft.id, { expectedVersion: draft.rowVersion, surface: 'workspace' });
  storeMentorNote(result?.note || result);
  renderActiveMentorNoteSurface();
  notify('Mentor note published to the student and audited.', '✓');
}

async function discardMentorNote() {
  const draft = state.mentorNoteDraft?.id ? normalizeMentorNote(state.mentorNoteDraft) : null;
  const story = activeMentorNoteStory();
  if (!draft || !story || !canWriteMentorNotes()) return;
  await api.discardMentorNote(draft.id, { expectedVersion: draft.rowVersion, surface: 'workspace' });
  story.mentorNotes = asArray(story.mentorNotes).filter((item) => normalizeMentorNote(item).id !== draft.id);
  state.mentorNoteDraft = null;
  renderActiveMentorNoteSurface();
  notify('Unpublished mentor note discarded.');
}

async function toggleMentorNoteRecording() {
  if (!canWriteMentorNotes() || !globalThis.MediaRecorder) return;
  if (['recording', 'paused'].includes(state.mentorNoteRecording?.recorder?.state)) {
    state.mentorNoteRecording.recorder.stop();
    return;
  }
  const draft = state.mentorNoteDraft?.id ? normalizeMentorNote(state.mentorNoteDraft) : await saveMentorNoteDraft({ allowEmpty: true });
  if (!draft) return;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks = [];
  const startedAt = performance.now();
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data?.size) chunks.push(event.data);
  });
  recorder.addEventListener('stop', async () => {
    stream.getTracks().forEach((track) => track.stop());
    const activeDraft = normalizeMentorNote(state.mentorNoteDraft || draft);
    const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
    const form = new FormData();
    form.append('segment', blob, 'mentor-note.webm');
    form.append('mimeType', blob.type);
    form.append('durationMs', String(Math.max(0, Math.round(performance.now() - startedAt))));
    form.append('expectedVersion', String(activeDraft.rowVersion));
    try {
      const result = await api.uploadMentorNoteAudio(activeDraft.id, form);
      storeMentorNote(result?.note || result);
      notify('Mentor audio transcribed. Review and edit the draft before publishing.', '✓');
    } catch (error) {
      notify(error.message || 'Mentor audio could not be saved. The draft remains private.');
    } finally {
      state.mentorNoteRecording = null;
      renderActiveMentorNoteSurface();
    }
  }, { once: true });
  state.mentorNoteRecording = { recorder, stream, startedAt };
  recorder.start();
  renderActiveMentorNoteSurface();
  notify('Recording mentor note. Stop when you are finished.');
}

async function playMentorNote(id, button) {
  const result = await api.mentorNotePlayback(id);
  const url = firstDefined(result?.url, result?.playbackUrl, result?.playback_url);
  if (!url) throw new Error('Mentor note playback is unavailable.');
  const [playbackUrl] = playbackUrls({ url });
  const host = button?.closest('.b1511MentorNote')?.querySelector(`[data-mentor-note-player="${CSS.escape(id)}"]`);
  if (!host) throw new Error('Mentor note playback controls are unavailable.');
  const audio = document.createElement('audio');
  audio.controls = true;
  audio.preload = 'metadata';
  audio.setAttribute('aria-label', 'Mentor note audio');
  audio.src = playbackUrl;
  host.replaceChildren(audio);
  await audio.play();
}

/* ========================= Routing, events, and signed boot ========================= */

async function renderRoute() {
  if (!state.user) return;
  setMotionEnergy('low');
  renderShell();
  main.innerHTML = loadingView(`Opening ${routeTitle()}…`);

  if (isAdmin()) {
    if (canAdminReview()) {
      if (state.route === 'home') {
        await loadAdminHome();
        renderAdminHome();
        return;
      }
      if (state.route === 'students') {
        await loadAdminStudents();
        renderAdminStudents();
        return;
      }
      if (state.route === 'student' && state.routeId) {
        await loadAdminStudent(state.routeId);
        renderAdminStudent();
        return;
      }
      if (state.route === 'queue') {
        await loadAdminQueue();
        renderAdminQueue();
        return;
      }
      if (state.route === 'content' && state.capabilities?.inspirationAdmin) {
        await loadAdminContent();
        renderAdminContent();
        return;
      }
      if (state.route === 'story' && state.routeId) {
        await loadAdminStory(state.routeId);
        renderAdminStory();
        return;
      }
    }
    if (state.route === 'qlib') {
      await Promise.all([loadQuestions(), loadImportBatches()]);
      renderQuestionLibrary();
      return;
    }
    if (state.route === 'settings') {
      await loadAdminReleaseControls();
      renderAdminReleaseControls();
      return;
    }
    await navigate(canAdminReview() ? 'home' : 'qlib', null, { replace: true });
    return;
  }

  if (!isMentor()) {
    if (state.route === 'home') {
      await Promise.all([loadStories(), loadNotifications(), loadHomeRecommendations()]);
      renderShell();
      renderHome();
      return;
    }
    if (state.route === 'library') {
      await Promise.all([loadStories(), loadNotifications().catch(() => [])]);
      renderShell();
      renderLibrary();
      return;
    }
    if (state.route === 'inspiration' && state.capabilities?.inspiration) {
      await loadInspiration();
      renderInspiration();
      return;
    }
    if (state.route === 'requests' && state.capabilities?.requestAStory) {
      await loadRequests();
      renderRequests();
      return;
    }
    if (state.route === 'notifications') {
      await loadNotifications();
      renderShell();
      renderNotifications();
      return;
    }
    if (state.route === 'settings') {
      renderSettings();
      return;
    }
    if (state.route === 'prep') {
      await loadIntelligence();
      renderPrep();
      return;
    }
    if (state.route === 'qshop' && state.routeId) {
      const payload = await api.workshop(state.routeId);
      state.workshop = normalizeWorkshop(payload);
      renderQuestionWorkshop();
      return;
    }
    if (state.route === 'qlib') {
      await loadQuestions();
      renderQuestionLibrary();
      return;
    }
    if (state.route === 'story' && state.routeId) {
      await Promise.all([loadStories(), loadNotifications()]);
      renderShell();
      renderLibrary();
      await openStory(state.routeId);
      return;
    }
    await navigate('home', null, { replace: true });
    return;
  }

  if (state.route === 'home') {
    await Promise.all([
      loadStudents(),
      loadQueue(),
      loadActivity().catch(() => []),
      loadMentorHome().catch(() => null),
    ]);
    renderShell();
    renderMentorHome();
    return;
  }
  if (state.route === 'students') {
    await loadStudents();
    renderStudents();
    return;
  }
  if (state.route === 'student' && state.routeId) {
    await openStudentWorkspace(state.routeId);
    return;
  }
  if (state.route === 'queue') {
    await loadQueue();
    state.stories = mentorState().queue.map((item) => item.story);
    renderQueue();
    return;
  }
  if (state.route === 'activity') {
    await Promise.all([loadStudents(), loadActivity()]);
    renderActivity();
    return;
  }
  if (state.route === 'prep') {
    await loadIntelligence();
    renderPrep();
    return;
  }
  if (state.route === 'qshop' && state.routeId) {
    const studentId = state.selectedStudent?.id || '';
    state.workshop = normalizeWorkshop(await api.workshop(state.routeId, studentId));
    renderQuestionWorkshop();
    return;
  }
  if (state.route === 'qlib') {
    await Promise.all([loadQuestions(), loadImportBatches()]);
    renderQuestionLibrary();
    return;
  }
  if (state.route === 'settings') {
    renderSettings();
    return;
  }
  if (state.route === 'story' && state.routeId) {
    await Promise.all([loadStudents(), loadQueue()]);
    state.stories = mentorState().queue.map((item) => item.story);
    renderMentorHome();
    await openStory(state.routeId);
    return;
  }
  await navigate('home', null, { replace: true });
}

function selectBackground(id) {
  if (!BACKGROUNDS.some((background) => background.id === id)) return;
  state.settingsPreview.selectedBackground = id;
  renderSettings();
  $(`[data-select-background="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
}

function previewBackground() {
  const id = state.settingsPreview.selectedBackground || savedBackground();
  state.settingsPreview.previewBackground = id;
  applyEnvironment();
  renderSettings();
  notify(`${BACKGROUNDS.find((background) => background.id === id).name} preview is active. Save to keep it.`);
}

async function saveBackgroundPreference() {
  const id = state.settingsPreview.selectedBackground || savedBackground();
  const result = await withBusy(() => api.preference(id));
  if (!result) return;
  state.user.background_preference = firstDefined(result?.backgroundPreference, result?.background_preference, id);
  state.settingsPreview.previewBackground = null;
  state.settingsPreview.selectedBackground = null;
  applyEnvironment();
  renderSettings();
  notify(`${BACKGROUNDS.find((background) => background.id === id).name} saved.`, '✓');
}

function cancelBackgroundPreview() {
  state.settingsPreview.previewBackground = null;
  state.settingsPreview.selectedBackground = savedBackground();
  applyEnvironment();
  renderSettings();
  notify('Environment preview canceled. Your saved environment is restored.');
}

function selectTextSize(id) {
  if (!['standard', 'large', 'extra_large'].includes(id)) return;
  state.settingsPreview.selectedTextSize = id;
  renderSettings();
  $(`[data-select-text-size="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
}

function previewTextSize() {
  state.settingsPreview.previewTextSize = state.settingsPreview.selectedTextSize || savedTextSize();
  applyEnvironment();
  renderSettings();
  notify('Text-size preview is active. Save to keep it.');
}

async function saveTextSizePreference() {
  const id = state.settingsPreview.selectedTextSize || savedTextSize();
  const result = await withBusy(() => api.textSizePreference(id));
  if (!result) return;
  state.user.reading_size_preference = firstDefined(result?.textSize, result?.reading_size_preference, id);
  state.settingsPreview.previewTextSize = null;
  state.settingsPreview.selectedTextSize = null;
  applyEnvironment();
  renderSettings();
  notify('Text-size preference saved.', '✓');
}

function cancelTextSizePreview() {
  state.settingsPreview.previewTextSize = null;
  state.settingsPreview.selectedTextSize = savedTextSize();
  applyEnvironment();
  renderSettings();
  notify('Text-size preview canceled. Your saved size is restored.');
}

async function saveThemePreference(theme) {
  if (!['dark', 'light', 'auto'].includes(theme)) return;
  const result = await withBusy(() => api.themePreference(theme));
  if (!result) return;
  state.user.theme_preference = firstDefined(result?.themePreference, result?.theme_preference, theme);
  applyTheme();
  renderSettings();
  notify(theme === 'auto' ? 'Auto theme on — StoryForge follows your device.' : `${theme === 'light' ? 'Light' : 'Dark'} theme saved.`, '✓');
}

async function togglePurposefulVersionVoice(button) {
  if (state.versionVoice?.recorder?.state === 'recording') {
    const current = state.versionVoice;
    const stopped = new Promise((resolve) => current.recorder.addEventListener('stop', resolve, { once: true }));
    current.recorder.stop();
    await stopped;
    current.stream.getTracks().forEach((track) => track.stop());
    const durationMs = Math.max(1, Date.now() - current.startedAt);
    const blob = new Blob(current.chunks, { type: current.mimeType });
    if (!blob.size) throw new Error('No voice recording was captured.');
    const form = new FormData();
    form.set('seq', '0');
    form.set('durationMs', String(durationMs));
    form.set('segment', blob, voiceFileName(0, current.mimeType));
    button.disabled = true;
    button.textContent = 'Preparing transcript…';
    await api.uploadRecordingSegment(current.recordingId, form);
    await api.finishRecording(current.recordingId, durationMs);
    let assembled = false;
    for (let attempt = 0; attempt < 46; attempt += 1) {
      const payload = await api.recording(current.recordingId);
      const status = recordingState(payload);
      if (['assembled', 'attached'].includes(status)) { assembled = true; break; }
      if (status === 'failed') throw new Error('StoryForge could not prepare this recording. Your typed version is unchanged.');
      await voiceDelay(2_000);
    }
    if (!assembled) throw new Error('Your recording is still safe, but preparation is taking longer than expected. Try again shortly.');
    const attached = await api.attachVersionRecording(state.storyDetail.id, current.recordingId);
    const field = $('#storyVersionText');
    if (field) {
      const transcript = String(attached?.transcript || '');
      const form = field.closest('#storyVersionForm');
      field.value = form?.dataset.saveMode === 'append' && field.value.trim()
        ? `${field.value.trimEnd()}\n\n${transcript}`
        : transcript;
    }
    state.versionVoice = {
      recordingId: current.recordingId,
      audioAssetId: String(attached?.audioAssetId || ''),
      transcript: String(attached?.transcript || ''),
    };
    button.disabled = false;
    button.textContent = '🎙 Record again';
    const status = $('[data-version-voice-status]');
    if (status) status.textContent = 'Transcript ready to edit. Original voice will be preserved when you save.';
    return;
  }
  if (state.versionVoice) await cancelPurposefulVersionVoice();
  const recording = await api.createRecording();
  const recordingId = String(firstDefined(recording?.recordingId, recording?.recording_id, recording?.recording?.id, ''));
  if (!recordingId) throw new Error('StoryForge could not open a private recording session.');
  state.versionVoice = { recordingId };
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const mimeType = supportedVoiceMimeType();
    if (!mimeType) { stream.getTracks().forEach((track) => track.stop()); throw new Error('No supported recording format is available.'); }
    const chunks = [];
    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    mediaRecorder.addEventListener('dataavailable', (event) => { if (event.data.size) chunks.push(event.data); });
    state.versionVoice = { recorder: mediaRecorder, stream, chunks, mimeType, recordingId, startedAt: Date.now() };
    mediaRecorder.start();
  } catch (error) {
    await cancelPurposefulVersionVoice();
    throw error;
  }
  button.textContent = '■ Stop and transcribe';
  const status = $('[data-version-voice-status]');
  if (status) status.textContent = 'Recording this purposeful telling. You can edit the transcript before saving.';
  window.setTimeout(() => {
    if (state.versionVoice?.recordingId === recordingId && state.versionVoice?.recorder?.state === 'recording') button.click();
  }, 10 * 60_000);
}

async function cancelPurposefulVersionVoice() {
  const current = state.versionVoice;
  state.versionVoice = null;
  if (!current) return;
  if (current.recorder?.state === 'recording') current.recorder.stop();
  current.stream?.getTracks().forEach((track) => track.stop());
  if (current.audioAssetId) {
    await api.deleteAudio(current.audioAssetId).catch(() => {});
  } else if (current.recordingId) {
    await api.cancelRecording(current.recordingId).catch(() => {});
  }
}

async function playPurposefulVersionAudio(assetId, button = null) {
  const result = await api.audioPlayback(assetId);
  const [url] = playbackUrls(result || {});
  if (!url) throw new Error('Original telling playback is unavailable.');
  const host = button?.parentElement?.querySelector('[data-version-audio-host]')
    || $('[data-version-audio-host]');
  if (!host) return;
  const audio = document.createElement('audio');
  audio.controls = true;
  audio.preload = 'metadata';
  audio.src = url;
  audio.setAttribute('aria-label', 'Original purposeful telling');
  host.replaceChildren(audio);
  await audio.play();
}

async function savePurposefulVersion(form, mode = 'save') {
  const key = form.dataset.versionKey;
  const current = state.storyVersions.find((version) => version.key === key);
  const field = $('#storyVersionText', form);
  const body = field?.value || '';
  const voice = state.versionVoice?.recordingId && state.versionVoice?.audioAssetId
    ? state.versionVoice
    : null;
  const result = await withBusy(() => api.saveStoryVersion(state.storyDetail.id, key, {
    body,
    mode,
    source: voice ? 'voice' : 'typed',
    expectedVersion: Number(current?.rowVersion || 0),
    ...(voice ? { recordingId: voice.recordingId, audioAssetId: voice.audioAssetId } : {}),
  }));
  const version = result?.version || result;
  if (mode === 'retell') {
    state.storyVersions = state.storyVersions.map((item) => item.key === key ? version : item);
  }
  await reloadStorySurface('workspace');
  state.storyTab = key;
  state.versionVoice = null;
  form.dataset.saveMode = 'save';
  renderStoryRoom();
  notify(mode === 'retell' ? 'A fresh telling is ready.' : 'Purposeful version saved.', '✓');
}

async function restorePurposefulVersion(revisionId) {
  const key = state.storyTab;
  const current = state.storyVersions.find((version) => version.key === key);
  await withBusy(() => api.restoreStoryVersion(state.storyDetail.id, {
    versionKey: key,
    revisionId,
    expectedVersion: Number(current?.rowVersion || 0),
  }));
  await reloadStorySurface('workspace');
  state.storyTab = key;
  renderStoryRoom();
  notify('Earlier telling restored. The replaced version remains in history.', '✓');
}

async function createStoryRequest(form) {
  const ui = state.v2.requestUi;
  const creating = !ui.editingId && !ui.reinviteFrom;
  const draft = {
    recipientFirstName: $('#requestFirstName', form)?.value || '',
    relationship: $('#requestRelationship', form)?.value || '',
    email: $('#requestEmail', form)?.value || '',
    personalMessage: $('#requestMessage', form)?.value || '',
  };
  ui.draft = draft;
  let invitation;
  if (ui.reinviteFrom) {
    const source = state.v2.invitations.find((item) => item.id === ui.reinviteFrom);
    invitation = await withBusy(() => api.reinviteRequest(
      ui.reinviteFrom,
      Number(source?.rowVersion || 0),
      draft.email,
    ));
  } else if (ui.editingId) {
    const source = state.v2.invitations.find((item) => item.id === ui.editingId);
    invitation = await withBusy(() => api.updateRequest(ui.editingId, {
      ...draft,
      expectedVersion: Number(source?.rowVersion || 0),
    }));
  } else {
    const created = await withBusy(() => api.createRequest(draft));
    invitation = created?.invitation || created;
  }
  const preview = await withBusy(() => api.previewRequest(invitation.id, Number(invitation.rowVersion || 0)));
  ui.preview = preview;
  ui.editingId = invitation.id;
  ui.reinviteFrom = '';
  ui.view = 'preview';
  await loadRequests();
  renderRequests();
  if (creating) notify('Private invitation created. Review it, then send when ready.', '✓');
}

function openRequestEditor(invitation = null, { reinvite = false } = {}) {
  const ui = state.v2.requestUi;
  ui.view = 'edit';
  ui.preview = null;
  ui.editingId = invitation && !reinvite ? invitation.id : '';
  ui.reinviteFrom = invitation && reinvite ? invitation.id : '';
  ui.draft = invitation ? {
    recipientFirstName: invitation.recipientFirstName,
    relationship: invitation.relationship,
    email: '',
    personalMessage: invitation.personalMessage || '',
  } : { recipientFirstName: '', relationship: '', email: '', personalMessage: '' };
  renderRequests();
}

async function previewStoryRequest(invitationId, expectedVersion) {
  const ui = state.v2.requestUi;
  ui.preview = await withBusy(() => api.previewRequest(invitationId, expectedVersion));
  ui.editingId = invitationId;
  ui.view = 'preview';
  renderRequests();
}

async function sendStoryRequest(invitationId, expectedVersion) {
  const result = await withBusy(() => api.sendRequest(invitationId, expectedVersion));
  if (result?.dryRun) notify('Delivery is in dry-run mode. Nothing was sent. Your draft remains private.');
  else notify('Handed to the email service. Delivered will appear only when the service confirms it.', '✓');
  state.v2.requestUi = { view: 'home', editingId: '', reinviteFrom: '', preview: null, draft: null };
  await loadRequests();
  renderRequests();
}

async function openNotification(id, storyId) {
  const item = state.notifications.find((notification) => String(notification.id) === String(id));
  if (item && !notificationRead(item)) {
    await withBusy(() => api.readNotification(id));
    await loadNotifications();
    renderShell();
  }
  if (storyId) await openStory(storyId);
  else renderNotifications();
}

async function readAllNotifications() {
  await withBusy(async () => {
    try {
      return await api.readAllNotifications();
    } catch (error) {
      if (![404, 405, 501].includes(error.status)) throw error;
      return Promise.all(state.notifications.filter((item) => !notificationRead(item)).map((item) => api.readNotification(item.id)));
    }
  });
  await loadNotifications();
  renderShell();
  renderNotifications();
  notify('All notifications marked as read.');
}

async function confirmPair(id) {
  await withBusy(() => api.confirmPair(id));
  if (qad.classList.contains('open')) await refreshAssignedStory();
  else await reloadWorkshop();
  notify('Question assignment confirmed.');
}

async function rejectPair(id) {
  await withBusy(() => api.rejectPair(id));
  if (qad.classList.contains('open')) await refreshAssignedStory();
  else await reloadWorkshop();
  notify('Question assignment removed.');
}

async function removeFollowup(id) {
  await withBusy(() => api.removeFollowup(id));
  await reloadWorkshop();
  notify('Follow-up removed.');
}

async function updateFollowupPrepared(id, prepared) {
  const context = workshopFollowup(id);
  if (!context) return;
  await withBusy(() => api.updateFollowup(id, {
    prepared,
    expectedVersion: context.followup.rowVersion ?? 0,
    surface: 'workshop',
  }));
  await reloadWorkshop();
}

function selectTeaching(side, storyId) {
  const context = mentorState().teaching;
  if (!context) return;
  context[side === 'A' ? 'a' : 'b'] = storyId ? context.entries.find((entry) => entry.story.id === storyId) || null : null;
  renderTeaching();
}

async function teachingEvaluation(side, patch) {
  const entry = teachingSide(side);
  if (!entry) return;
  await withBusy(() => api.evaluation(entry.story.id, { ...patch, surface: 'teach' }));
  Object.assign(entry.story, {
    ...(patch.mentorScore !== undefined ? { mentorScore: patch.mentorScore } : {}),
    ...(patch.mentorStar !== undefined ? { mentorStar: patch.mentorStar } : {}),
  });
  renderTeaching();
  notify('Teaching action saved to the story record.');
}

async function teachingStatus(side, status) {
  const entry = teachingSide(side);
  if (!entry) return;
  await withBusy(() => api.storyStatus(entry.story.id, status, 'teach'));
  entry.story.status = status;
  renderTeaching();
  notify(`“${STATUS[status].label}” saved and logged with your name.`);
}

async function teachingComment(side) {
  const entry = teachingSide(side);
  const body = $(`[data-teach-comment="${side}"]`)?.value.trim();
  if (!entry || !body) return;
  await withBusy(() => api.feedback(entry.story.id, { body, surface: 'teach' }));
  notify('Comment saved to the story record. The student was notified.');
  const field = $(`[data-teach-comment="${side}"]`);
  if (field) field.value = '';
}

async function handleScore(scope, score) {
  const value = Number(score);
  if (scope === 'capture') {
    capture.dataset.score = String(value);
    $$('[data-score-scope="capture"] [data-score]').forEach((button) => button.classList.toggle('on', Number(button.dataset.score) <= value));
    const output = $('[data-score-scope="capture"] .spv');
    if (output) output.textContent = `self ${value}/5`;
    scheduleCaptureDraftSave();
    return;
  }
  if (scope === 'room-student' || scope === 'quick-student') {
    await updateEvaluation({ storyId: (state.storyDetail || state.quick?.story).id, studentScore: value });
    return;
  }
  if (scope === 'room-mentor' || scope === 'quick-mentor') {
    await updateEvaluation({ storyId: (state.storyDetail || state.quick?.story).id, mentorScore: value });
    return;
  }
  if (scope.startsWith('pair-')) {
    await updatePairScore(scope, value);
    return;
  }
  if (scope.startsWith('workshop-')) {
    await workshopScore(scope, value);
    return;
  }
  if (scope.startsWith('teach-')) {
    await teachingEvaluation(scope.slice(-1), { mentorScore: value });
  }
}

function rerenderWithFocus(render, selector, value) {
  render();
  const input = $(selector);
  if (input) {
    input.focus();
    if ('setSelectionRange' in input) input.setSelectionRange(value.length, value.length);
  }
}

let searchDebounceTimer = 0;
const searchComposing = new WeakSet();
const searchActiveOption = new Map();

function normalizedSearch(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function storyMatchesQuery(story, query) {
  const needle = normalizedSearch(query);
  if (!needle) return true;
  const categories = story.categories.map((id) => presentationTaxonomyLabel('categories', id));
  const uses = story.uses.map((id) => presentationTaxonomyLabel('intendedUses', id));
  const haystack = normalizedSearch(`${storyTitle(story)} ${story.text} ${story.lesson} ${categories.join(' ')} ${uses.join(' ')}`);
  return needle.split(/\s+/).every((token) => haystack.includes(token));
}

function closeSearchSuggestions(inputId) {
  const input = $(`#${CSS.escape(inputId)}`);
  const list = $(`#${inputId === 'omni' ? 'omniSuggestions' : 'libSearchSuggestions'}`);
  if (list) {
    list.hidden = true;
    list.innerHTML = '';
  }
  input?.setAttribute('aria-expanded', 'false');
  input?.removeAttribute('aria-activedescendant');
  searchActiveOption.delete(inputId);
}

function renderStorySearchSuggestions(inputId, query) {
  const input = $(`#${CSS.escape(inputId)}`);
  const listId = inputId === 'omni' ? 'omniSuggestions' : 'libSearchSuggestions';
  const list = $(`#${listId}`);
  if (!input || !list) return;
  if (!state.capabilities?.storySearch) {
    closeSearchSuggestions(inputId);
    return;
  }
  const matches = query.trim() ? state.stories.filter((story) => storyMatchesQuery(story, query)).slice(0, 6) : [];
  if (!matches.length) {
    closeSearchSuggestions(inputId);
    return;
  }
  list.innerHTML = matches.map((story, index) => `<button type="button" id="${listId}-${index}" role="option" aria-selected="false" data-search-story="${attr(story.id)}">
    <span>${esc(storyTitle(story))}</span><small>${esc(story.categories[0] ? presentationTaxonomyLabel('categories', story.categories[0]) : developmentState(story))}</small>
  </button>`).join('');
  list.hidden = false;
  input.setAttribute('aria-expanded', 'true');
  searchActiveOption.set(inputId, -1);
  const status = $(`#${inputId === 'omni' ? 'omniSearchStatus' : 'librarySearchStatus'}`);
  if (status) status.textContent = `${matches.length} story suggestions available.`;
}

function moveSearchSuggestion(input, delta) {
  const inputId = input.id;
  const list = $(`#${inputId === 'omni' ? 'omniSuggestions' : 'libSearchSuggestions'}`);
  const options = list ? $$('[role="option"]', list) : [];
  if (!options.length) return false;
  const previous = searchActiveOption.get(inputId) ?? -1;
  const next = Math.max(0, Math.min(options.length - 1, previous + delta));
  options.forEach((option, index) => option.setAttribute('aria-selected', String(index === next)));
  input.setAttribute('aria-activedescendant', options[next].id);
  searchActiveOption.set(inputId, next);
  options[next].scrollIntoView({ block: 'nearest' });
  return true;
}

function scheduleStudentSearch(inputId, value) {
  window.clearTimeout(searchDebounceTimer);
  searchDebounceTimer = window.setTimeout(() => {
    renderLibraryRowsOnly();
    renderStorySearchSuggestions(inputId, value);
  }, 200);
}

function scheduleAdminStudentSearch(value, inputId = 'adminStudentSearch') {
  window.clearTimeout(searchDebounceTimer);
  searchDebounceTimer = window.setTimeout(async () => {
    try {
      await loadAdminStudents();
      if (state.route === 'students' && canAdminReview()) {
        if ($('#adminStudentResults')) renderAdminStudentRowsOnly();
        else renderAdminStudents();
      }
      if (inputId === 'omni' && state.capabilities?.storySearch) {
        const list = $('#omniSuggestions');
        const input = $('#omni');
        if (list && input && value.trim()) {
          list.innerHTML = adminConsoleState().students.slice(0, 6).map((student, index) => `<button type="button" id="omniSuggestions-${index}" role="option" aria-selected="false" data-admin-open-student="${attr(student.id)}"><span>${esc(student.name)}</span><small>${esc([student.cohort, student.specialty].filter(Boolean).join(' · '))}</small></button>`).join('');
          list.hidden = !adminConsoleState().students.length;
          input.setAttribute('aria-expanded', String(Boolean(adminConsoleState().students.length)));
        }
      }
    } catch (error) {
      notify(error.message || 'Search is temporarily unavailable.');
    }
  }, 220);
}

function overlayContaining(target) {
  return [qad, quick, capture, room, palette, teaching].find((node) => node.contains(target) && node.classList.contains('open'));
}

document.addEventListener('click', async (event) => {
  const target = event.target;
  const seekTrack = target.closest('[data-seek-audio]');
  if (seekTrack) {
    event.preventDefault();
    seekAudioReplayFromTrack(seekTrack, event.clientX);
    return;
  }
  const button = target.closest('button, a');
  if (!button) return;
  try {
    if (button.matches('[data-switch-view]')) {
      const nextRole = button.dataset.switchView;
      if (
        (nextRole === 'student' && state.user?.role === 'student')
        || (nextRole === 'admin' && canSwitchAdministratorView())
      ) {
        state.activeRole = nextRole;
        state.route = 'home';
        state.routeId = null;
        clearOverlays();
        pushPath('home', null, true);
        await renderRoute();
      }
      return;
    }
    if (button.matches('[data-consent-decision]')) {
      await decideConsent(button.dataset.consentDecision);
      return;
    }
    if (button.matches('[data-close-mentorship-policy]')) {
      closeConsent();
      return;
    }
    if (button.matches('[data-review-mentorship-policy]')) {
      await showConsent();
      return;
    }
    if (button.matches('[data-set-story-visibility]') && !button.disabled) {
      await setStoryVisibility(button.dataset.setStoryVisibility);
      return;
    }
    if (button.matches('[data-theme-preference]')) {
      await saveThemePreference(button.dataset.themePreference);
      return;
    }
    if (button.matches('[data-recommend-prompt]')) {
      await openCapture({ prompt: button.dataset.recommendPrompt });
      return;
    }
    if (button.matches('[data-inspiration-layout]')) {
      state.v2.inspiration.layout = button.dataset.inspirationLayout;
      await api.inspirationLayout(state.v2.inspiration.layout);
      await loadInspiration();
      renderInspiration();
      return;
    }
    if (button.matches('[data-inspiration-answer]')) {
      const prompt = state.v2.inspiration.prompts.find((item) => item.id === button.dataset.inspirationAnswer);
      if (prompt) await openCapture({ prompt: prompt.text });
      return;
    }
    if (button.matches('[data-inspiration-favorite]')) {
      await api.inspirationFavorite(button.dataset.inspirationFavorite, button.dataset.enabled === '1');
      await loadInspiration();
      renderInspiration();
      return;
    }
    if (button.matches('[data-inspiration-pin]')) {
      await api.inspirationPin(
        button.dataset.inspirationPin,
        button.dataset.position === '' ? null : Number(button.dataset.position),
      );
      await loadInspiration();
      renderInspiration();
      return;
    }
    if (button.matches('[data-request-home]')) {
      state.v2.requestUi = { view: 'home', editingId: '', reinviteFrom: '', preview: null, draft: null };
      renderRequests();
      return;
    }
    if (button.matches('[data-request-new]')) {
      openRequestEditor();
      return;
    }
    if (button.matches('[data-request-edit]')) {
      const invitation = state.v2.invitations.find((item) => item.id === button.dataset.requestEdit);
      if (invitation?.status === 'draft') openRequestEditor(invitation);
      return;
    }
    if (button.matches('[data-request-preview]')) {
      await previewStoryRequest(button.dataset.requestPreview, Number(button.dataset.version || 0));
      return;
    }
    if (button.matches('[data-request-confirm-send]')) {
      await sendStoryRequest(button.dataset.requestConfirmSend, Number(button.dataset.version || 0));
      return;
    }
    if (button.matches('[data-request-remind]')) {
      const result = await withBusy(() => api.remindRequest(
        button.dataset.requestRemind,
        Number(button.dataset.version || 0),
      ));
      await loadRequests();
      renderRequests();
      notify(result?.dryRun ? 'Reminder is in dry-run mode. Nothing was sent.' : 'Gentle reminder handed to the email service.', result?.dryRun ? '' : '✓');
      return;
    }
    if (button.matches('[data-request-reinvite]')) {
      const invitation = state.v2.invitations.find((item) => item.id === button.dataset.requestReinvite);
      if (invitation?.status === 'bounced') openRequestEditor(invitation, { reinvite: true });
      return;
    }
    if (button.matches('[data-guest-start-text]')) {
      const guest = state.v2.guest;
      if (!asArray(guest.invitation?.prompts).length) throw new Error('No memory questions are available for this invitation.');
      await guestJson(`${guest.route.basePath}api/requests/guest/${guest.route.token}/started`, {
        method: 'POST', body: '{}',
      });
      guest.mode = 'question';
      guest.captureMode = '';
      renderGuestContribution();
      return;
    }
    if (button.matches('[data-guest-start-voice]')) {
      await startGuestVoice();
      return;
    }
    if (button.matches('[data-guest-type-story]')) {
      state.v2.guest.captureMode = 'text';
      renderGuestContribution();
      $('#guestStory')?.focus({ preventScroll: true });
      return;
    }
    if (button.matches('[data-guest-stop-voice]')) {
      await stopGuestVoice();
      return;
    }
    if (button.matches('[data-guest-retry-upload]')) {
      await retryGuestVoiceUpload();
      return;
    }
    if (button.matches('[data-guest-retry-voice]')) {
      await retryGuestVoiceTranscription();
      return;
    }
    if (button.matches('[data-guest-cancel-voice]')) {
      await cancelGuestVoice();
      state.v2.guest.captureMode = 'text';
      renderGuestContribution();
      return;
    }
    if (button.matches('[data-guest-different-question]')) {
      const guest = state.v2.guest;
      guest.promptIndex = (guest.promptIndex + 1) % Math.max(1, asArray(guest.invitation?.prompts).length);
      guest.text = '';
      renderGuestContribution();
      return;
    }
    if (button.matches('[data-guest-back]')) {
      state.v2.guest.mode = 'landing';
      renderGuestContribution();
      return;
    }
    if (button.matches('[data-guest-edit-story]')) {
      state.v2.guest.text = $('#guestReviewText')?.value || state.v2.guest.text;
      state.v2.guest.mode = state.v2.guest.voice ? 'voice_review' : 'question';
      renderGuestContribution();
      $('#guestReviewText')?.focus({ preventScroll: true });
      return;
    }
    if (button.matches('[data-guest-tell-another]')) {
      const guest = state.v2.guest;
      guest.promptIndex = (guest.promptIndex + 1) % Math.max(1, asArray(guest.invitation?.prompts).length);
      guest.promptId = '';
      guest.text = '';
      guest.captureMode = '';
      guest.voice = null;
      guest.mode = 'question';
      renderGuestContribution();
      return;
    }
    if (button.matches('[data-request-revoke]')) {
      await withBusy(() => api.revokeRequest(button.dataset.requestRevoke));
      await loadRequests();
      renderRequests();
      notify('Invitation revoked. Its guest link no longer works.', '✓');
      return;
    }
    if (button.matches('[data-contribution-state]')) {
      await withBusy(() => api.contributionState(
        button.dataset.contributionState,
        button.dataset.state,
      ));
      await loadRequests();
      renderRequests();
      return;
    }
    if (button.matches('[data-contribution-audio]')) {
      await playContributionAudio(button.dataset.contributionAudio, button);
      return;
    }
    if (button.matches('[data-contribution-promote]')) {
      const result = await withBusy(() => api.promoteContribution(
        button.dataset.contributionPromote,
        '',
      ));
      await Promise.all([loadRequests(), loadStories()]);
      renderRequests();
      notify('A new private story was created from this contribution.', '✓');
      if (result?.storyId) await openStory(result.storyId);
      return;
    }
    if (button.matches('[data-review-check-preview]')) {
      const result = await api.adminReviewCheck({ studentId: button.dataset.reviewCheckPreview, preview: true });
      notify(result?.message || 'Review Check preview is ready. No notification was sent.');
      return;
    }
    if (button.matches('[data-review-check-send]')) {
      const result = await api.adminReviewCheck({ studentId: button.dataset.reviewCheckSend, preview: false });
      notify(result?.message || 'Review Check sent.', '✓');
      return;
    }
    if (button.matches('[data-admin-save-view]')) {
      const admin = adminConsoleState();
      const label = window.prompt('Name this private administrator view:');
      if (!label) return;
      await api.adminSaveView({ label, state: { filter: admin.studentFilter, session: admin.studentSession, sort: admin.studentSort } });
      await loadAdminStudents();
      renderAdminStudents();
      notify('Administrator view saved.', '✓');
      return;
    }
    if (button.matches('[data-admin-delete-view]')) {
      const id = $('#adminSavedView')?.value || '';
      if (!id) return;
      await api.adminDeleteView(id);
      adminConsoleState().selectedSavedView = '';
      await loadAdminStudents();
      renderAdminStudents();
      notify('Administrator view deleted.', '✓');
      return;
    }
    if (button.matches('[data-admin-student-page]')) {
      adminConsoleState().studentPage = Number(button.dataset.adminStudentPage || 1);
      await loadAdminStudents();
      renderAdminStudents();
      return;
    }
    if (button.matches('[data-admin-queue-page]')) {
      adminConsoleState().queuePage = Number(button.dataset.adminQueuePage || 1);
      await loadAdminQueue();
      renderAdminQueue();
      return;
    }
    if (button.matches('[data-admin-queue-search]')) {
      const admin = adminConsoleState();
      admin.queueQuery = $('#adminQueueSearch')?.value.trim() || '';
      admin.queueSort = $('#adminQueueSort')?.value || 'oldest';
      admin.queuePage = 1;
      await loadAdminQueue();
      renderAdminQueue();
      return;
    }
    if (button.matches('[data-admin-prompt-validate]')) {
      const draft = adminInspirationDraft($('#adminInspirationForm'));
      await api.adminInspirationValidate({ prompt: draft });
      notify('Prompt is valid plain text and ready to publish.', '✓');
      return;
    }
    if (button.matches('[data-admin-prompt-history]')) {
      const result = await api.adminInspirationHistory(button.dataset.adminPromptHistory);
      notify(`${asArray(result?.history).length} immutable prompt revisions found.`);
      return;
    }
    if (button.matches('[data-version-voice]')) {
      await togglePurposefulVersionVoice(button);
      return;
    }
    if (button.matches('[data-version-audio]')) {
      await playPurposefulVersionAudio(button.dataset.versionAudio, button);
      return;
    }
    if (button.matches('[data-nav]')) {
      event.preventDefault();
      await navigate(button.dataset.nav, button.dataset.navId || null);
      return;
    }
    if (button.matches('[data-close-overlay]')) {
      event.preventDefault();
      const overlay = overlayContaining(button);
      if (overlay === capture && captureSaveInFlight) return;
      if (overlay === room) await cancelPurposefulVersionVoice();
      closeOverlay(overlay);
      if (button.closest('#qad') && quick.classList.contains('open')) renderQuick();
      if (button.closest('#qad') && room.classList.contains('open')) renderStoryRoom();
      return;
    }
    if (button.matches('[data-change-fixture]')) {
      signOut();
      return;
    }
    if (button.matches('[data-open-capture]')) {
      const sourceId = button.dataset.captureTitleFrom;
      const title = sourceId ? $(`#${CSS.escape(sourceId)}`)?.value.trim() || '' : '';
      if (button.hasAttribute('data-capture-voice')) {
        try {
          localStorage.setItem(VOICE_HINT_KEY, '1');
        } catch {
          // The hint is cosmetic; capture remains available when storage is blocked.
        }
      }
      await openCapture({
        title,
        prompt: button.dataset.capturePrompt || '',
        voice: button.hasAttribute('data-capture-voice'),
        pairQuestionId: button.dataset.pairQuestionId || null,
      });
      return;
    }
    if (button.matches('[data-capture-title-from]')) {
      await openCapture({ title: $(`#${CSS.escape(button.dataset.captureTitleFrom)}`)?.value.trim() || '' });
      return;
    }
    if (button.matches('[data-capture-prompt]')) {
      await openCapture({ prompt: button.dataset.capturePrompt });
      return;
    }
    if (button.matches('[data-next-prompt]')) {
      state.promptIndex = (state.promptIndex + 1) % MEMORY_PROMPTS.length;
      renderHome();
      return;
    }
    if (button.matches('[data-library-status]')) {
      state.library.status = button.dataset.libraryStatus;
      await navigate('library');
      return;
    }
    if (button.matches('[data-open-quick]')) {
      await openQuick(button.dataset.openQuick);
      return;
    }
    if (button.matches('[data-admin-open-student]')) {
      await navigate('student', button.dataset.adminOpenStudent);
      return;
    }
    if (button.matches('[data-admin-open-story]')) {
      await navigate('story', button.dataset.adminOpenStory);
      return;
    }
    if (button.matches('[data-open-story]')) {
      if (palette.classList.contains('open')) closeOverlay(palette);
      await openStory(button.dataset.openStory, button.dataset.completionGuidance || null);
      return;
    }
    if (button.matches('[data-search-story]')) {
      closeSearchSuggestions(button.closest('.hSearch') ? 'omni' : 'libQ');
      await openStory(button.dataset.searchStory);
      return;
    }
    if (button.matches('[data-open-notification]')) {
      await openNotification(button.dataset.openNotification, button.dataset.storyId);
      return;
    }
    if (button.matches('[data-read-all]')) {
      await readAllNotifications();
      return;
    }
    if (button.matches('[data-select-background]')) {
      selectBackground(button.dataset.selectBackground);
      return;
    }
    if (button.matches('[data-preview-background]')) {
      previewBackground();
      return;
    }
    if (button.matches('[data-save-background]')) {
      await saveBackgroundPreference();
      return;
    }
    if (button.matches('[data-cancel-background]')) {
      cancelBackgroundPreview();
      return;
    }
    if (button.matches('[data-select-text-size]')) {
      selectTextSize(button.dataset.selectTextSize);
      return;
    }
    if (button.matches('[data-preview-text-size]')) {
      previewTextSize();
      return;
    }
    if (button.matches('[data-save-text-size]')) {
      await saveTextSizePreference();
      return;
    }
    if (button.matches('[data-cancel-text-size]')) {
      cancelTextSizePreview();
      return;
    }
    if (button.matches('[data-config-add]')) {
      const draft = syncContentDisplayDraft();
      const key = button.dataset.configAdd;
      const entries = draft.taxonomy?.[key];
      if (!Array.isArray(entries)) return;
      const id = crypto.randomUUID();
      entries.push({ id, label: 'New value', sortOrder: (entries.length + 1) * 10, state: 'active', builtin: false });
      renderAdminReleaseControls();
      $(`[data-config-tax-id="${CSS.escape(id)}"] [data-config-tax-label]`)?.select();
      return;
    }
    if (button.matches('[data-config-move]')) {
      const draft = syncContentDisplayDraft();
      const entries = draft.taxonomy?.[button.dataset.configKind];
      const index = asArray(entries).findIndex((entry) => entry.id === button.dataset.configId);
      const destination = index + Number(button.dataset.configMove);
      if (index < 0 || destination < 0 || destination >= entries.length) return;
      [entries[index], entries[destination]] = [entries[destination], entries[index]];
      entries.forEach((entry, order) => { entry.sortOrder = (order + 1) * 10; });
      renderAdminReleaseControls();
      $(`[data-config-id="${CSS.escape(button.dataset.configId)}"][data-config-move="${attr(button.dataset.configMove)}"]`)?.focus({ preventScroll: true });
      return;
    }
    if (button.matches('[data-config-preview]')) {
      await previewContentDisplay();
      return;
    }
    if (button.matches('[data-config-cancel-preview]')) {
      state.presentation = cloneContentDisplay(state.adminContentDisplay?.configuration?.payload || BUNDLED_PRESENTATION);
      state.adminContentDraft = cloneContentDisplay(state.adminContentDisplay?.configuration?.payload || BUNDLED_PRESENTATION);
      state.adminContentPreviewing = false;
      renderShell();
      renderAdminReleaseControls();
      notify('Content & Display preview canceled.');
      return;
    }
    if (button.matches('[data-config-restore-defaults]')) {
      await restoreContentDisplayDefaults();
      return;
    }
    if (button.matches('[data-story-media-open]')) {
      const result = await api.storyMediaPlayback(button.dataset.storyMediaOpen);
      const [url] = playbackUrls(result);
      if (button.dataset.storyMediaKind === 'video') {
        const video = document.createElement('video');
        video.controls = true;
        video.preload = 'metadata';
        video.src = url;
        video.setAttribute('aria-label', button.getAttribute('aria-label') || 'Private story video');
        button.replaceWith(video);
        await video.play();
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      return;
    }
    if (button.matches('[data-story-media-cancel]')) {
      state.storyMediaUpload?.xhr?.abort();
      return;
    }
    if (button.matches('[data-story-media-move]')) {
      await moveStoryMedia(button.dataset.storyMediaId, button.dataset.storyMediaMove);
      return;
    }
    if (button.matches('[data-story-media-remove]')) {
      if (!window.confirm('Remove this private photo or video from the story?')) return;
      await withBusy(() => api.removeStoryMedia(button.dataset.storyMediaRemove));
      await reloadStorySurface('workspace');
      notify('Private story media removed.', '✓');
      return;
    }
    if (button.matches('[data-admin-release-reload]')) {
      await loadAdminReleaseControls();
      renderAdminReleaseControls();
      return;
    }
    if (button.id === 'capturePrefix') {
      const enabled = capture.dataset.prefixEnabled !== 'false';
      capture.dataset.prefixEnabled = String(!enabled);
      button.classList.toggle('off', enabled);
      button.setAttribute('aria-pressed', String(!enabled));
      scheduleCaptureDraftSave();
      return;
    }
    if (button.matches('[data-capture-theme]')) {
      const themes = JSON.parse(capture.dataset.themes || '[]');
      const id = button.dataset.captureTheme;
      capture.dataset.themes = JSON.stringify(themes.includes(id) ? themes.filter((value) => value !== id) : [...themes, id]);
      button.classList.toggle('on');
      scheduleCaptureDraftSave();
      return;
    }
    if (button.matches('[data-record-audio]')) {
      await toggleRecording(button);
      return;
    }
    if (button.matches('[data-voice-start], [data-voice-more]')) {
      await voiceStart();
      return;
    }
    if (button.matches('[data-voice-pause]')) {
      await voicePause(false);
      return;
    }
    if (button.matches('[data-voice-resume]')) {
      await voiceResume();
      return;
    }
    if (button.matches('[data-voice-done]')) {
      await voiceDone();
      return;
    }
    if (button.matches('[data-voice-discard]')) {
      await voiceDiscard();
      return;
    }
    if (button.matches('[data-voice-review]')) {
      voiceState.mode = 'review';
      renderVoiceDock('review');
      return;
    }
    if (button.matches('[data-voice-retry]')) {
      await retryVoiceTranscription();
      return;
    }
    if (button.matches('[data-voice-retry-upload]')) {
      await retryVoiceUpload();
      return;
    }
    if (button.matches('[data-voice-fix]')) {
      applyVoiceFix(Number(button.dataset.voiceFix));
      return;
    }
    if (button.matches('[data-voice-fix-all]')) {
      applyAllVoiceFixes();
      return;
    }
    if (button.matches('[data-story-tab]')) {
      await cancelPurposefulVersionVoice();
      state.storyTab = button.dataset.storyTab;
      if (isAdmin() && adminConsoleState().story) renderAdminStory();
      else renderStoryRoom();
      return;
    }
    if (button.matches('[data-version-mode]')) {
      const form = button.closest('#storyVersionForm');
      const field = $('#storyVersionText', form);
      if (!form || !field) return;
      if (button.dataset.versionMode === 'append') {
        form.dataset.saveMode = 'append';
        field.value = `${field.value.trimEnd()}${field.value.trim() ? '\n\n' : ''}`;
        field.focus();
        field.setSelectionRange(field.value.length, field.value.length);
        const status = $('[data-version-voice-status]', form);
        if (status) status.textContent = 'Append mode — add to the telling, then save. The prior version remains in history.';
      } else {
        if (!window.confirm('Start a fresh retelling? Your current telling will remain in version history and can be restored.')) return;
        await cancelPurposefulVersionVoice();
        form.dataset.saveMode = 'retell';
        field.value = '';
        field.focus();
        const status = $('[data-version-voice-status]', form);
        if (status) status.textContent = 'Fresh retelling ready. Your previous telling is preserved until you save this one.';
      }
      return;
    }
    if (button.matches('[data-version-restore]')) {
      await restorePurposefulVersion(button.dataset.versionRestore);
      return;
    }
    if (button.matches('[data-set-status]')) {
      await setCurrentStatus(button.dataset.setStatus);
      return;
    }
    if (button.matches('[data-submit-story]')) {
      await submitCurrentStory();
      return;
    }
    if (button.matches('[data-withdraw-story]')) {
      await withdrawCurrentStory();
      return;
    }
    if (button.matches('[data-score]')) {
      const picker = button.closest('[data-score-scope]');
      if (picker) await handleScore(picker.dataset.scoreScope, button.dataset.score);
      return;
    }
    if (button.matches('[data-library-priority]')) {
      await updateLibraryPriority(button.dataset.storyId, button.dataset.libraryPriority, button);
      return;
    }
    if (button.matches('[data-toggle-star]')) {
      await toggleStar(button.dataset.toggleStar, button.dataset.starKind);
      return;
    }
    if (button.matches('[data-library-category], [data-library-use]')) {
      const kind = button.matches('[data-library-category]') ? 'categories' : 'uses';
      const id = button.dataset.libraryCategory || button.dataset.libraryUse;
      state.library[kind] = state.library[kind].includes(id)
        ? state.library[kind].filter((value) => value !== id)
        : [...state.library[kind], id];
      button.classList.toggle('on', state.library[kind].includes(id));
      button.setAttribute('aria-pressed', String(state.library[kind].includes(id)));
      renderLibraryRowsOnly();
      return;
    }
    if (button.matches('[data-taxonomy]')) {
      await updateStoryTaxonomy(button.dataset.taxonomyKind, button.dataset.taxonomy);
      return;
    }
    if (button.matches('[data-admin-taxonomy]')) {
      await updateAdminTaxonomy(button.dataset.taxonomyKind, button.dataset.adminTaxonomy);
      return;
    }
    if (button.matches('[data-classification]')) {
      await toggleClassification(button.dataset.kind, button.dataset.classification);
      return;
    }
    if (button.matches('[data-toggle-use]')) {
      await toggleUse(button.dataset.toggleUse);
      return;
    }
    if (button.matches('[data-send-feedback]')) {
      await sendFeedback(button.dataset.feedbackSource || 'room');
      return;
    }
    if (button.matches('[data-save-mentor-note]')) {
      await saveMentorNoteDraft();
      return;
    }
    if (button.matches('[data-publish-mentor-note]')) {
      await publishMentorNote();
      return;
    }
    if (button.matches('[data-discard-mentor-note]')) {
      await discardMentorNote();
      return;
    }
    if (button.matches('[data-record-mentor-note]')) {
      await toggleMentorNoteRecording();
      return;
    }
    if (button.matches('[data-pause-mentor-note]')) {
      const activeRecorder = state.mentorNoteRecording?.recorder;
      if (activeRecorder?.state === 'recording') {
        activeRecorder.pause();
        renderActiveMentorNoteSurface();
        notify('Mentor recording paused.');
      }
      return;
    }
    if (button.matches('[data-resume-mentor-note]')) {
      const activeRecorder = state.mentorNoteRecording?.recorder;
      if (activeRecorder?.state === 'paused') {
        activeRecorder.resume();
        renderActiveMentorNoteSurface();
        notify('Mentor recording resumed.');
      }
      return;
    }
    if (button.matches('[data-play-mentor-note]')) {
      await playMentorNote(button.dataset.playMentorNote, button);
      return;
    }
    if (button.matches('[data-send-ask]')) {
      await sendAsk();
      return;
    }
    if (button.matches('[data-add-reflection]')) {
      await addReflection();
      return;
    }
    if (button.matches('[data-save-reflection]')) {
      await saveReflection(button.dataset.saveReflection);
      return;
    }
    if (button.matches('[data-play-audio]')) {
      await playAudio(button.dataset.playAudio, button);
      return;
    }
    if (button.matches('[data-open-assign]')) {
      await openAssign(button.dataset.openAssign);
      return;
    }
    if (button.matches('[data-quick-move]')) {
      await moveQuick(button.dataset.quickMove);
      return;
    }
    if (button.matches('[data-quick-full]')) {
      const id = button.dataset.quickFull;
      closeOverlay(quick);
      await openStory(id);
      return;
    }
    if (button.matches('[data-toggle-pair]')) {
      await togglePair(button.dataset.togglePair);
      return;
    }
    if (button.matches('[data-confirm-pair]')) {
      await confirmPair(button.dataset.confirmPair);
      return;
    }
    if (button.matches('[data-reject-pair]')) {
      await rejectPair(button.dataset.rejectPair);
      return;
    }
    if (button.matches('[data-go-question-library]')) {
      closeOverlay(qad);
      await navigate('qlib');
      return;
    }
    if (button.matches('[data-prep-family]')) {
      state.questionFamily = state.questionFamily === button.dataset.prepFamily
        ? 'all'
        : button.dataset.prepFamily;
      renderPrep();
      return;
    }
    if (button.matches('[data-clear-prep-family]')) {
      state.questionFamily = 'all';
      renderPrep();
      return;
    }
    if (button.matches('[data-open-workshop]')) {
      await openWorkshop(button.dataset.openWorkshop);
      return;
    }
    if (button.matches('[data-prefer-story]')) {
      await preferStory(button.dataset.preferStory);
      return;
    }
    if (button.matches('[data-add-suggested-story]')) {
      await addSuggestedStory(button.dataset.addSuggestedStory);
      return;
    }
    if (button.matches('[data-save-pair-why]')) {
      await savePairWhy(button.dataset.savePairWhy);
      return;
    }
    if (button.matches('[data-add-followup]')) {
      await addFollowup(button.dataset.addFollowup);
      return;
    }
    if (button.matches('[data-save-followup]')) {
      await saveFollowup(button.dataset.saveFollowup);
      return;
    }
    if (button.matches('[data-move-followup]')) {
      await moveFollowup(button.dataset.moveFollowup, button.dataset.moveDelta);
      return;
    }
    if (button.matches('[data-remove-followup]')) {
      await removeFollowup(button.dataset.removeFollowup);
      return;
    }
    if (button.matches('[data-send-coaching]')) {
      await sendCoaching();
      return;
    }
    if (button.matches('[data-request-ai]')) {
      await requestAiSuggestion();
      return;
    }
    if (button.matches('[data-preview-import]')) {
      await previewImport();
      return;
    }
    if (button.matches('[data-commit-import]')) {
      await commitImport();
      return;
    }
    if (button.matches('[data-rollback-import]')) {
      await rollbackImport(button.dataset.rollbackImport);
      return;
    }
    if (button.matches('[data-approve-question]')) {
      await approveQuestion(button.dataset.approveQuestion);
      return;
    }
    if (button.matches('[data-expand-story-history]')) {
      state.storyHistoryExpanded = true;
      renderStoryRoom();
      return;
    }
    if (button.matches('[data-open-student]')) {
      if (palette.classList.contains('open')) closeOverlay(palette);
      await openStudentWorkspace(button.dataset.openStudent);
      return;
    }
    if (button.matches('[data-student-prep]')) {
      state.route = 'prep';
      state.routeId = null;
      pushPath('prep');
      await loadIntelligence();
      renderShell();
      renderPrep();
      return;
    }
    if (button.matches('[data-toggle-history]')) {
      const panel = $('#studentHistory');
      if (panel) panel.hidden = !panel.hidden;
      return;
    }
    if (button.matches('[data-queue-bucket]')) {
      mentorState().queueBucket = button.dataset.queueBucket;
      renderQueue();
      return;
    }
    if (button.matches('[data-open-teaching]')) {
      await openTeaching(button.dataset.studentId || state.selectedStudent?.id || '');
      return;
    }
    if (button.matches('[data-open-palette]')) {
      openPalette();
      return;
    }
    if (button.matches('[data-toggle-anonymous]')) {
      mentorState().teaching.anonymous = !mentorState().teaching.anonymous;
      renderTeaching();
      return;
    }
    if (button.matches('[data-craft-score]')) {
      const group = button.closest('[data-teach-side]');
      await setCraft(group.dataset.teachSide, group.dataset.craft, button.dataset.craftScore);
      return;
    }
    if (button.matches('[data-teach-status]')) {
      const [side, status] = button.dataset.teachStatus.split(':');
      await teachingStatus(side, status);
      return;
    }
    if (button.matches('[data-teach-assign]')) {
      const entry = teachingSide(button.dataset.teachAssign);
      if (entry) await openAssign(entry.story.id);
      return;
    }
    if (button.matches('[data-send-teach-comment]')) {
      await teachingComment(button.dataset.sendTeachComment);
      return;
    }
    if (button.matches('[data-start-session]')) {
      await startSession(button.dataset.startSession);
      return;
    }
    if (button.matches('[data-expand-session]')) {
      mentorState().session.expanded = !mentorState().session.expanded;
      renderSessionBar();
      return;
    }
    if (button.matches('[data-session-item]')) {
      if (target.closest('.agCk')) await toggleSessionItem(button.dataset.sessionItem);
      else if (button.dataset.storyId) await openQuick(button.dataset.storyId);
      else if (button.dataset.questionId) await openWorkshop(button.dataset.questionId);
      return;
    }
    if (button.matches('[data-end-session]')) {
      await endSession();
    }
  } catch (error) {
    notify(error.message || 'StoryForge could not complete that action.');
  }
});

document.addEventListener('submit', async (event) => {
  try {
    if (event.target.id === 'captureForm') {
      event.preventDefault();
      await saveCapture(event.target);
    }
    if (event.target.id === 'storyEditForm') {
      event.preventDefault();
      await saveStoryEdit(event.target);
    }
    if (event.target.id === 'storyVersionForm') {
      event.preventDefault();
      await savePurposefulVersion(event.target, event.target.dataset.saveMode || 'save');
    }
    if (event.target.id === 'inspirationSearchForm') {
      event.preventDefault();
      state.v2.inspiration.query = $('#inspirationSearch', event.target)?.value.trim() || '';
      await loadInspiration();
      renderInspiration();
    }
    if (event.target.id === 'requestStoryForm') {
      event.preventDefault();
      await createStoryRequest(event.target);
    }
    if (event.target.id === 'guestDraftForm') {
      event.preventDefault();
      const guest = state.v2.guest;
      const prompts = asArray(guest.invitation?.prompts);
      const prompt = prompts[guest.promptIndex % Math.max(1, prompts.length)];
      guest.text = $('#guestStory', event.target)?.value.trim() || '';
      guest.promptId = prompt?.id || '';
      if (!guest.text || !guest.promptId) throw new Error('Tell one story before continuing.');
      guest.mode = 'review';
      renderGuestContribution();
    }
    if (event.target.id === 'guestReviewForm') {
      event.preventDefault();
      const guest = state.v2.guest;
      guest.text = $('#guestReviewText', event.target)?.value.trim() || '';
      if (!guest.text || !guest.promptId) throw new Error('Your story and its memory question are required.');
      if (guest.voice?.recordingId) {
        await guestJson(
          `${guest.route.basePath}api/requests/guest/${guest.route.token}/voice/${guest.voice.recordingId}/finish`,
          {
            method: 'POST',
            body: JSON.stringify({ promptId: guest.promptId, transcript: guest.text }),
          },
        );
        stopGuestVoiceClock(guest.voice);
        guest.voice = null;
      } else {
        await guestJson(`${guest.route.basePath}api/requests/guest/${guest.route.token}/contributions`, {
          method: 'POST',
          body: JSON.stringify({
            promptId: guest.promptId,
            transcript: guest.text,
            kind: 'text',
          }),
        });
      }
      guest.sentCount += 1;
      guest.mode = 'thanks';
      renderGuestContribution();
    }
    if (event.target.id === 'questionAddForm') {
      event.preventDefault();
      await createCustomQuestion(event.target);
    }
    if (event.target.id === 'voiceFeatureForm') {
      event.preventDefault();
      await saveAdminReleaseControls(event.target);
    }
    if (event.target.id === 'adminConsoleFeatureForm') {
      event.preventDefault();
      await saveAdminConsoleReleaseControl(event.target);
    }
    if (event.target.id === 'contentDisplayForm') {
      event.preventDefault();
      await publishContentDisplay(event.target);
    }
    if (event.target.id === 'storyMediaUploadForm') {
      event.preventDefault();
      await uploadStoryMedia(event.target);
    }
    if (event.target.matches('[data-story-media-meta]')) {
      event.preventDefault();
      await saveStoryMediaMetadata(event.target);
    }
    if (event.target.id === 'adminStudentSearchForm') {
      event.preventDefault();
      const admin = adminConsoleState();
      admin.studentQuery = $('#adminStudentSearch', event.target)?.value.trim() || '';
      admin.studentStatus = $('#adminStudentStatus', event.target)?.value || '';
      admin.studentFilter = $('#adminStudentFilter', event.target)?.value || 'all';
      admin.studentSession = $('#adminStudentSession', event.target)?.value || '';
      admin.studentSort = $('#adminStudentSort', event.target)?.value || 'attention';
      admin.studentPage = 1;
      await loadAdminStudents();
      renderAdminStudents();
    }
    if (event.target.id === 'adminInspirationForm') {
      event.preventDefault();
      await api.adminInspirationPublish({ prompt: adminInspirationDraft(event.target) });
      event.target.reset();
      await loadAdminContent();
      renderAdminContent();
      notify('Inspiration prompt published with immutable history.', '✓');
    }
    if (event.target.id === 'adminInspirationBulkForm') {
      event.preventDefault();
      const parsed = await api.adminInspirationBulkParse($('#adminPromptCsv', event.target)?.value || '');
      if (!asArray(parsed?.prompts).length) throw new Error('No governed prompts were parsed.');
      if (!window.confirm(`${parsed.count} prompts passed validation. Import them as retired drafts?`)) return;
      await api.adminInspirationBulkCommit(parsed.prompts);
      await loadAdminContent();
      renderAdminContent();
      notify(`${parsed.count} prompts imported as retired drafts.`, '✓');
    }
    if (event.target.id === 'adminStoryReviewForm') {
      event.preventDefault();
      await saveAdminStoryReview(event.target);
    }
  } catch (error) {
    notify(error.message || 'StoryForge could not save that change.');
  }
});

document.addEventListener('beforeinput', (event) => {
  const target = event.target;
  if (capture.contains(target) && target.id === 'capBody') {
    voiceState.pendingEdit = {
      previous: target.value,
      start: target.selectionStart,
      end: target.selectionEnd,
      inputType: event.inputType,
    };
  }
});

document.addEventListener('compositionstart', (event) => {
  if (['omni', 'libQ', 'adminStudentSearch'].includes(event.target.id)) searchComposing.add(event.target);
});

document.addEventListener('compositionend', (event) => {
  const target = event.target;
  searchComposing.delete(target);
  if (target.id === 'omni' && canAdminReview()) {
    adminConsoleState().studentQuery = target.value;
    scheduleAdminStudentSearch(target.value, 'omni');
  } else if (target.id === 'omni' || target.id === 'libQ') {
    state.library.query = target.value;
    scheduleStudentSearch(target.id, target.value);
  } else if (target.id === 'adminStudentSearch') {
    adminConsoleState().studentQuery = target.value;
    scheduleAdminStudentSearch(target.value);
  }
});

document.addEventListener('input', (event) => {
  const target = event.target;
  if (target.id === 'storyVersionText') {
    const words = target.value.trim().split(/\s+/).filter(Boolean).length;
    const counter = $('[data-version-word-count]', target.form);
    const key = target.form?.dataset.versionKey;
    if (counter) counter.textContent = words
      ? `≈ ${words} words${key === 'thirty_second' ? ` · ${words <= 95 ? 'inside' : 'over'} the ~30-second target` : ''}`
      : '';
  } else if (room.contains(target) && ['storyEditText', 'storyLesson'].includes(target.id) && state.storyCompletionIntent) {
    updateStoryCompletionGuidance(target.form);
  } else if (capture.contains(target) && ['capTitle', 'capBody', 'capLesson'].includes(target.id)) {
    if (target.id === 'capBody') trackVoiceTextEdit(target.value);
    scheduleCaptureDraftSave();
  } else if (target.id === 'omni' && canAdminReview()) {
    adminConsoleState().studentQuery = target.value;
    if (state.route !== 'students') {
      state.route = 'students';
      state.routeId = null;
      pushPath('students');
      main.innerHTML = loadingView('Searching authorized students…');
    }
    if (!searchComposing.has(target)) scheduleAdminStudentSearch(target.value, 'omni');
  } else if (target.id === 'omni' && !isMentor()) {
    state.library.query = target.value;
    if (state.route !== 'library') {
      state.route = 'library';
      state.routeId = null;
      pushPath('library');
      renderLibrary();
    }
    const libraryInput = $('#libQ');
    if (libraryInput) libraryInput.value = target.value;
    if (!searchComposing.has(target)) scheduleStudentSearch('omni', target.value);
  } else if (target.id === 'libQ') {
    state.library.query = target.value;
    const omni = $('#omni');
    if (omni && !isMentor() && !canAdminReview()) omni.value = target.value;
    if (!searchComposing.has(target)) scheduleStudentSearch('libQ', target.value);
  } else if (target.id === 'adminStudentSearch') {
    adminConsoleState().studentQuery = target.value;
    if (!searchComposing.has(target)) scheduleAdminStudentSearch(target.value);
  } else if (target.id === 'assignSearch') {
    state.assign.query = target.value;
    rerenderWithFocus(renderAssign, '#assignSearch', target.value);
  } else if (target.id === 'questionSearch') {
    state.questionQuery = target.value;
    rerenderWithFocus(renderQuestionLibrary, '#questionSearch', target.value);
  } else if (target.id === 'prepQ') {
    state.questionQuery = target.value;
    rerenderWithFocus(renderPrep, '#prepQ', target.value);
  } else if (target.id === 'studentSearch') {
    mentorState().studentQuery = target.value;
    rerenderWithFocus(renderStudents, '#studentSearch', target.value);
  } else if (target.id === 'studentStorySearch') {
    mentorState().storyQuery = target.value;
    rerenderWithFocus(renderStudentWorkspace, '#studentStorySearch', target.value);
  } else if (target.id === 'paletteSearch') {
    renderPalette(target.value);
    const next = $('#paletteSearch');
    next?.focus();
    next?.setSelectionRange(next.value.length, next.value.length);
  }
});

document.addEventListener('focusin', (event) => {
  if (event.target.id === 'omni' && isMentor()) {
    event.target.blur();
    openPalette();
  }
});

document.addEventListener('change', async (event) => {
  const target = event.target;
  try {
    if (target.matches?.('[data-consent-confirm]')) {
      const accept = document.querySelector('[data-consent-decision="accept"]');
      if (accept) accept.disabled = !target.checked;
    } else if (target.id === 'libStatus') {
      state.library.status = target.value;
      renderLibrary();
    } else if (target.id === 'libSort') {
      state.library.sort = target.value;
      renderLibrary();
    } else if (target.id === 'libStar') {
      state.library.star = target.value;
      renderLibrary();
    } else if (target.id === 'libBird') {
      state.library.bird = target.value;
      renderLibrary();
    } else if (target.id === 'libPosition') {
      state.library.position = target.value;
      renderLibrary();
    } else if (target.id === 'prepSt') {
      state.questionStatus = target.value;
      renderPrep();
    } else if (target.id === 'questionFamily') {
      state.questionFamily = target.value;
      renderQuestionLibrary();
    } else if (target.id === 'questionSource') {
      state.questionSource = target.value;
      renderQuestionLibrary();
    } else if (target.matches('[data-import-row]')) {
      state.importPreview[Number(target.dataset.importRow)].selected = target.checked;
      renderQuestionLibrary();
    } else if (target.matches('[data-import-family]')) {
      state.importPreview[Number(target.dataset.importFamily)].family = target.value;
    } else if (target.id === 'importFile') {
      const file = target.files?.[0];
      state.importSource = file
        ? { name: file.name, format: file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'xlsx' }
        : { name: 'pasted-questions', format: 'paste' };
      const label = $('#importSourceName');
      if (label) label.textContent = file?.name || 'No file selected — paste mode';
    } else if (target.matches('[data-followup-prepared]')) {
      await updateFollowupPrepared(target.dataset.followupPrepared, target.checked);
    } else if (target.id === 'workshopFocusPair') {
      state.workshopFocusPairId = target.value;
      renderQuestionWorkshop();
    } else if (target.id === 'studentCohort') {
      mentorState().studentCohort = target.value;
      renderStudents();
    } else if (target.id === 'studentSort') {
      mentorState().studentSort = target.value;
      renderStudents();
    } else if (target.id === 'studentStoryFilter') {
      if (target.value.startsWith('question:')) await ensureStudentStoryMappings();
      mentorState().storyFilter = target.value;
      renderStudentWorkspace();
    } else if (target.id === 'studentStorySort') {
      mentorState().storySort = target.value;
      renderStudentWorkspace();
    } else if (target.id === 'queueCohort') {
      mentorState().queueCohort = target.value;
      renderQueue();
    } else if (target.id === 'adminQueueStatus') {
      adminConsoleState().queueStatus = target.value;
      await loadAdminQueue();
      renderAdminQueue();
    } else if (target.id === 'adminQueueSession') {
      adminConsoleState().queueSession = target.value;
      adminConsoleState().queuePage = 1;
      await loadAdminQueue();
      renderAdminQueue();
    } else if (target.id === 'adminSavedView') {
      adminConsoleState().selectedSavedView = target.value;
      const view = adminConsoleState().savedViews.find((item) => item.id === target.value);
      if (view) {
        const admin = adminConsoleState();
        admin.studentFilter = view.state?.filter || 'all';
        admin.studentSession = view.state?.session || '';
        admin.studentSort = view.state?.sort || 'attention';
        admin.studentPage = 1;
        await loadAdminStudents();
        renderAdminStudents();
      } else {
        $('[data-admin-delete-view]')?.setAttribute('disabled', '');
      }
    } else if (target.id === 'activityStudent') {
      mentorState().activityFilters.student = target.value;
      await reloadActivityView();
    } else if (target.id === 'activityCohort') {
      mentorState().activityFilters.cohort = target.value;
      await reloadActivityView();
    } else if (target.id === 'activityType') {
      mentorState().activityFilters.type = target.value;
      await reloadActivityView();
    } else if (target.id === 'activityPeriod') {
      mentorState().activityFilters.period = target.value;
      await reloadActivityView();
    } else if (target.id === 'activityFrom') {
      mentorState().activityFilters.from = target.value;
      await reloadActivityView();
    } else if (target.id === 'activityTo') {
      mentorState().activityFilters.to = target.value;
      await reloadActivityView();
    } else if (target.id === 'teachA') {
      selectTeaching('A', target.value);
    } else if (target.id === 'teachB') {
      selectTeaching('B', target.value);
    }
  } catch (error) {
    notify(error.message);
  }
});

document.addEventListener('mousedown', (event) => {
  for (const node of [qad, quick, capture, room, palette]) {
    if (node.classList.contains('open') && event.target === node) {
      if (node === capture && captureSaveInFlight) return;
      if (node === room) void cancelPurposefulVersionVoice();
      closeOverlay(node);
      break;
    }
  }
});

document.addEventListener('keydown', (event) => {
  const storyTab = event.target.closest?.('[data-story-tab]');
  if (storyTab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    const tabs = $$('[data-story-tab]', storyTab.closest('[role="tablist"]'));
    const index = tabs.indexOf(storyTab);
    const next = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault();
    tabs[next]?.focus();
    tabs[next]?.click();
    return;
  }
  if (['omni', 'libQ'].includes(event.target.id)) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (moveSearchSuggestion(event.target, event.key === 'ArrowDown' ? 1 : -1)) event.preventDefault();
    } else if (event.key === 'Enter') {
      const inputId = event.target.id;
      const list = $(`#${inputId === 'omni' ? 'omniSuggestions' : 'libSearchSuggestions'}`);
      const option = list?.querySelector('[aria-selected="true"]');
      if (option) {
        event.preventDefault();
        option.click();
      }
    } else if (event.key === 'Escape') {
      closeSearchSuggestions(event.target.id);
    }
  }
  const seekTrack = event.target.closest?.('[data-seek-audio]');
  if (seekTrack && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const current = Math.max(0, Number(audioReplay.currentSeconds || 0));
    const total = Math.max(0, Number(audioReplay.totalSeconds || 0));
    const target = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? total
        : current + (event.key === 'ArrowRight' ? 5 : -5);
    seekAudioReplay(seekTrack.dataset.seekAudio, target);
    return;
  }
  const consentOverlay = document.getElementById('b1513Consent');
  if (consentOverlay?.classList.contains('b1513ConsentOpen')) {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (consentOverlay.querySelector('[data-close-mentorship-policy]')) closeConsent();
      return;
    }
    if (event.key === 'Tab') {
      const focusable = $$('button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])', consentOverlay)
        .filter((item) => item.offsetParent !== null);
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
  }
  const openOverlay = [qad, quick, capture, room, palette, teaching].find((node) => node.classList.contains('open'));
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  if (event.key === 'Escape') {
    if (openOverlay) {
      event.preventDefault();
      if (openOverlay === capture && captureSaveInFlight) return;
      if (openOverlay === room) void cancelPurposefulVersionVoice();
      closeOverlay(openOverlay);
    }
    return;
  }
  if (event.key === 'Tab' && openOverlay) {
    const focusable = $$('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])', openOverlay)
      .filter((item) => item.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
    return;
  }
  if (typing) return;
  if ((event.key === 'n' || event.key === 'N') && isStudent()) {
    event.preventDefault();
    void openCapture();
  }
  if ((event.key === 'k' || event.key === 'K') && isMentor()) {
    event.preventDefault();
    openPalette();
  }
  if (event.key === '/') {
    event.preventDefault();
    if (isMentor()) openPalette();
    else if (canAdminReview()) {
      if (state.route !== 'students') navigate('students').then(() => $('#adminStudentSearch')?.focus());
      else $('#adminStudentSearch')?.focus();
    }
    else if (state.route !== 'library') navigate('library').then(() => $('#libQ')?.focus());
    else $('#libQ')?.focus();
  }
});

function hideApplicationChrome() {
  rail.innerHTML = '';
  hdr.innerHTML = '';
  advBanner.classList.remove('show');
  clearOverlays();
  document.body.classList.add('is-booting');
}

function gateMarkup({ eyebrow, heading, message, action = '' }) {
  return `<section class="gatePage">
    <div class="gateShell">
      <div class="gateArt"><div class="gateLogo">Story<em>Forge</em><small>MissionMed 360</small></div><blockquote>“Your story is evidence of how you notice, decide, and grow.”</blockquote><span>Private by default · Original preserved · Real mentor attribution</span></div>
      <div class="gateBody"><div role="${eyebrow === 'Identity required' ? 'status' : 'alert'}" aria-live="assertive"><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(heading)}</h1><p>${esc(message)}</p></div>${action}</div>
    </div>
  </section>`;
}

function renderLogin(errorMessage = '') {
  hideApplicationChrome();
  const fixtureButtons = state.config?.devAuth ? `<div class="fixtureGrid">
    <button class="gateBtn" type="button" data-fixture-persona="student">Student · Maya</button>
    <button class="gateBtn" type="button" data-fixture-persona="founderStudent">Founder · Student + Admin</button>
    <button class="gateBtn" type="button" data-fixture-persona="studentOther">Second student · privacy boundary</button>
    <button class="gateBtn" type="button" data-fixture-persona="mentor">Mentor · Dr. Chen</button>
    <button class="gateBtn" type="button" data-fixture-persona="mentorTwo">Second mentor · Dr. Rivera</button>
    <button class="gateBtn" type="button" data-fixture-persona="unassignedMentor">Unassigned mentor · privacy probe</button>
    <button class="gateBtn" type="button" data-fixture-persona="admin">Admin · least privilege</button>
  </div>` : `<div class="truthState">Open StoryForge through your signed-in MissionMed 360 account.</div>`;
  main.innerHTML = gateMarkup({
    eyebrow: 'Identity required',
    heading: 'Enter StoryForge',
    message: errorMessage || (state.config?.devAuth
      ? 'Choose a locally signed fixture identity. This is test infrastructure, not production WordPress SSO.'
      : 'The production StoryForge issuer has not supplied an eligible session.'),
    action: fixtureButtons,
  });
  const heading = $('h1', main);
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}

function lockoutPresentation(lockoutState) {
  const presentations = {
    eligibility_revoked: ['Access changed', 'Your 360 access has changed.', 'StoryForge locked as soon as WordPress reported the eligibility change.'],
    session_required: ['Session unavailable', 'Your MissionMed session ended.', 'Sign in through MissionMed to return to this exact StoryForge page.'],
    session_ended: ['Session unavailable', 'Your MissionMed session ended.', 'Sign in through MissionMed to return to this exact StoryForge page.'],
    user_not_enabled: ['Access unavailable', 'StoryForge is not enabled for this account.', 'Return to Matrix to continue using the tools enabled for this account.'],
    role_not_enabled: ['Access unavailable', 'StoryForge is not enabled for this account.', 'Return to Matrix to continue using the tools enabled for this account.'],
    cohort_not_enabled: ['Access unavailable', 'StoryForge is not enabled for this account.', 'Return to Matrix to continue using the tools enabled for this account.'],
    storyforge_disabled: ['Pilot unavailable', 'StoryForge is not enabled yet.', 'Return to Matrix while this pilot remains off.'],
  };
  return presentations[lockoutState] || ['Temporarily unavailable', 'StoryForge could not open safely.', 'Return to Matrix and try again in a moment.'];
}

function renderLockout(lockoutState = 'access_unavailable', message = '') {
  hideApplicationChrome();
  const [eyebrow, heading, fallback] = lockoutPresentation(lockoutState);
  main.innerHTML = gateMarkup({
    eyebrow,
    heading,
    message: message || fallback,
    action: `<a class="gateBtn" href="${attr(matrixHref())}">Back to Matrix</a>`,
  });
  const headingNode = $('h1', main);
  if (headingNode) {
    headingNode.tabIndex = -1;
    headingNode.focus({ preventScroll: true });
  }
}

function renderStartupFailure(message = '') {
  hideApplicationChrome();
  main.innerHTML = gateMarkup({
    eyebrow: 'Temporarily unavailable',
    heading: 'StoryForge could not open safely.',
    message: message || 'We could not reach the StoryForge service. Your stories were not changed.',
    action: `<div class="gateActions"><button class="gateBtn" type="button" data-retry-startup>Retry</button><a class="gateBtn" href="${attr(matrixHref())}">Back to Matrix</a></div>`,
  });
  const heading = $('h1', main);
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}

function guestRoute() {
  const match = location.pathname.match(/^(.*\/storyforge\/)guest\/([A-Za-z0-9_-]{43})\/?$/);
  return match ? { basePath: match[1], token: match[2] } : null;
}

async function guestJson(pathname, options = {}) {
  const multipart = globalThis.FormData && options.body instanceof FormData;
  const response = await fetch(new URL(pathname, location.origin), {
    ...options,
    credentials: 'omit',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(options.body && !multipart ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || 'This private invitation is unavailable.');
    error.code = payload?.error?.code || 'invitation_not_found';
    throw error;
  }
  return payload;
}

function guestWelcomeLine(relationship) {
  if (['parent', 'sibling', 'spouse_partner', 'grandparent', 'cousin'].includes(relationship)) return 'You watched them become who they are. The small moments you remember are exactly what matters.';
  if (['best_friend', 'childhood_friend', 'medschool_friend'].includes(relationship)) return 'You know a version of them that exists outside applications and medicine. That is the story only you can tell.';
  if (['faculty', 'mentor', 'coworker', 'supervisor', 'teammate'].includes(relationship)) return 'You have seen how they learn, take feedback, help a team, and grow. One specific moment is enough.';
  return 'You remember moments they may never think to tell themselves. One specific memory is enough.';
}

function guestPromptText(value, firstName) {
  return String(value || '').replaceAll('{name}', firstName);
}

function guestVoiceMimeType() {
  return supportedVoiceMimeType().split(';')[0];
}

function guestVoiceTime(milliseconds) {
  const seconds = Math.max(0, Math.floor(Number(milliseconds || 0) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function stopGuestVoiceClock(voice = state.v2.guest.voice) {
  if (voice?.clock) window.clearInterval(voice.clock);
  if (voice?.poll) window.clearTimeout(voice.poll);
  if (voice) {
    voice.clock = null;
    voice.poll = null;
  }
}

function updateGuestVoiceClock() {
  const voice = state.v2.guest.voice;
  const node = $('[data-guest-voice-time]');
  if (voice && node) node.textContent = guestVoiceTime(Date.now() - voice.startedAt);
}

async function refreshGuestVoiceStatus({ rerender = true } = {}) {
  const guest = state.v2.guest;
  const voice = guest.voice;
  if (!voice?.recordingId) return null;
  const payload = await guestJson(
    `${guest.route.basePath}api/requests/guest/${guest.route.token}/voice/${voice.recordingId}`,
  );
  if (guest.voice?.recordingId !== voice.recordingId) return payload;
  voice.server = payload;
  const segments = asArray(payload.segments);
  voice.liveTranscript = segments
    .filter((segment) => segment.transcribeState === 'transcribed')
    .map((segment) => String(segment.transcript || '').trim())
    .filter(Boolean)
    .join(' ');
  voice.failedSegments = segments
    .filter((segment) => segment.transcribeState === 'transcribe_failed')
    .map((segment) => Number(segment.seq));
  if (rerender && ['voice_recording', 'voice_preparing'].includes(guest.mode)) renderGuestContribution();
  return payload;
}

function scheduleGuestVoiceStatus() {
  const voice = state.v2.guest.voice;
  if (!voice || voice.poll || !['voice_recording', 'voice_preparing'].includes(state.v2.guest.mode)) return;
  voice.poll = window.setTimeout(async () => {
    voice.poll = null;
    try {
      await refreshGuestVoiceStatus();
    } catch (error) {
      voice.statusMessage = error.message || 'Live transcription is reconnecting…';
    }
    scheduleGuestVoiceStatus();
  }, 2_000);
}

function enqueueGuestVoiceSegment(blob, durationMs) {
  const guest = state.v2.guest;
  const voice = guest.voice;
  if (!voice || !blob?.size) return;
  const seq = voice.seq;
  voice.seq += 1;
  const form = new FormData();
  const mimeType = guestVoiceMimeType() || String(blob.type || '').split(';')[0];
  form.set('seq', String(seq));
  form.set('durationMs', String(Math.max(1, Math.min(60_000, Math.round(durationMs)))));
  form.set('mimeType', mimeType);
  form.set('segment', new Blob([blob], { type: mimeType }), voiceFileName(seq, mimeType));
  voice.uploadChain = voice.uploadChain.then(async () => {
    voice.uploading = true;
    renderGuestContribution();
    await guestJson(
      `${guest.route.basePath}api/requests/guest/${guest.route.token}/voice/${voice.recordingId}/segments`,
      { method: 'POST', body: form },
    );
    voice.uploading = false;
    await refreshGuestVoiceStatus();
  }).catch((error) => {
    voice.uploading = false;
    voice.uploadError = error;
    voice.failedUpload = { form, seq };
    if (voice.recorder?.state === 'recording') voice.recorder.pause();
    renderGuestContribution();
    return null;
  });
}

async function retryGuestVoiceUpload() {
  const guest = state.v2.guest;
  const voice = guest.voice;
  const failed = voice?.failedUpload;
  if (!voice || !failed) return;
  voice.uploadError = null;
  voice.uploading = true;
  renderGuestContribution();
  voice.uploadChain = guestJson(
    `${guest.route.basePath}api/requests/guest/${guest.route.token}/voice/${voice.recordingId}/segments`,
    { method: 'POST', body: failed.form },
  ).then(async () => {
    voice.failedUpload = null;
    voice.uploading = false;
    if (voice.recorder?.state === 'paused') voice.recorder.resume();
    await refreshGuestVoiceStatus();
  }).catch((error) => {
    voice.uploading = false;
    voice.uploadError = error;
    renderGuestContribution();
    throw error;
  });
  await voice.uploadChain;
}

async function cancelGuestVoice({ returnToQuestion = true } = {}) {
  const guest = state.v2.guest;
  const voice = guest.voice;
  guest.voice = null;
  stopGuestVoiceClock(voice);
  if (voice?.recorder && voice.recorder.state !== 'inactive') {
    voice.discarding = true;
    voice.recorder.stop();
  }
  voice?.stream?.getTracks().forEach((track) => track.stop());
  if (voice?.recordingId) {
    await guestJson(
      `${guest.route.basePath}api/requests/guest/${guest.route.token}/voice/${voice.recordingId}`,
      { method: 'DELETE' },
    ).catch(() => {});
  }
  if (returnToQuestion) {
    guest.mode = 'question';
    renderGuestContribution();
  }
}

async function startGuestVoice() {
  const guest = state.v2.guest;
  if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder || !guestVoiceMimeType()) {
    throw new Error('Voice recording is unavailable in this browser. You can still type your story.');
  }
  const prompts = asArray(guest.invitation?.prompts);
  const prompt = prompts[guest.promptIndex % Math.max(1, prompts.length)];
  if (!prompt?.id) throw new Error('No memory question is available for this invitation.');
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  let opened;
  try {
    opened = await guestJson(`${guest.route.basePath}api/requests/guest/${guest.route.token}/voice`, {
      method: 'POST', body: '{}',
    });
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    throw error;
  }
  const mimeType = guestVoiceMimeType();
  const restoredStatus = await guestJson(
    `${guest.route.basePath}api/requests/guest/${guest.route.token}/voice/${opened.recordingId}`,
  );
  if (opened.state === 'finishing') {
    stream.getTracks().forEach((track) => track.stop());
    guest.voice = {
      recordingId: String(opened.recordingId || ''),
      startedAt: Date.now(),
      uploadChain: Promise.resolve(),
      liveTranscript: '',
      failedSegments: [],
      server: opened,
      stopping: true,
    };
    guest.mode = 'voice_preparing';
    const recovered = await refreshGuestVoiceStatus({ rerender: false });
    guest.promptId = String(recovered?.promptId || prompt.id);
    await awaitGuestVoiceTranscript();
    return;
  }
  const recorder = new MediaRecorder(stream, { mimeType });
  const voice = {
    recordingId: String(opened.recordingId || ''),
    recorder,
    stream,
    mimeType,
    seq: Number(restoredStatus.segmentCount || 0),
    startedAt: Date.now(),
    lastChunkAt: Date.now(),
    uploadChain: Promise.resolve(),
    liveTranscript: asArray(restoredStatus.segments)
      .filter((segment) => segment.transcribeState === 'transcribed')
      .map((segment) => String(segment.transcript || '').trim())
      .filter(Boolean)
      .join(' '),
    failedSegments: [],
    server: restoredStatus,
    uploading: false,
    uploadError: null,
    statusMessage: '',
    stopping: false,
  };
  guest.voice = voice;
  guest.promptId = prompt.id;
  guest.mode = 'voice_recording';
  recorder.addEventListener('dataavailable', (event) => {
    if (voice.discarding || !event.data?.size) return;
    const endedAt = Date.now();
    enqueueGuestVoiceSegment(event.data, endedAt - voice.lastChunkAt);
    voice.lastChunkAt = endedAt;
  });
  recorder.addEventListener('stop', () => {
    stream.getTracks().forEach((track) => track.stop());
  }, { once: true });
  recorder.start(15_000);
  voice.clock = window.setInterval(updateGuestVoiceClock, 1_000);
  scheduleGuestVoiceStatus();
  renderGuestContribution();
}

async function stopGuestVoice() {
  const guest = state.v2.guest;
  const voice = guest.voice;
  if (!voice?.recorder || voice.recorder.state === 'inactive' || voice.stopping) return;
  voice.stopping = true;
  guest.mode = 'voice_preparing';
  stopGuestVoiceClock(voice);
  const stopped = new Promise((resolve) => voice.recorder.addEventListener('stop', resolve, { once: true }));
  voice.recorder.stop();
  renderGuestContribution();
  await stopped;
  await voice.uploadChain;
  await awaitGuestVoiceTranscript();
}

async function awaitGuestVoiceTranscript() {
  const guest = state.v2.guest;
  const voice = guest.voice;
  if (!voice?.recordingId) return;
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const payload = await refreshGuestVoiceStatus({ rerender: false });
    const segments = asArray(payload?.segments);
    const failed = segments.filter((segment) => segment.transcribeState === 'transcribe_failed');
    if (failed.length) {
      guest.mode = 'voice_recovery';
      voice.failedSegments = failed.map((segment) => Number(segment.seq));
      renderGuestContribution();
      return;
    }
    if (segments.length && segments.every((segment) => segment.transcribeState === 'transcribed')) {
      guest.text = segments.map((segment) => String(segment.transcript || '').trim()).filter(Boolean).join(' ');
      guest.mode = 'voice_review';
      renderGuestContribution();
      return;
    }
    await voiceDelay(2_000);
  }
  throw new Error('Your recording is safe, but transcription is taking longer than expected. Try again shortly.');
}

async function retryGuestVoiceTranscription() {
  const guest = state.v2.guest;
  const voice = guest.voice;
  if (!voice?.failedSegments?.length) return;
  guest.mode = 'voice_preparing';
  renderGuestContribution();
  for (const seq of voice.failedSegments) {
    await guestJson(
      `${guest.route.basePath}api/requests/guest/${guest.route.token}/voice/${voice.recordingId}/retry`,
      { method: 'POST', body: JSON.stringify({ seq }) },
    );
  }
  voice.failedSegments = [];
  await awaitGuestVoiceTranscript();
}

function renderGuestContribution() {
  const guest = state.v2.guest;
  const invitation = guest.invitation;
  const route = guest.route;
  hideApplicationChrome();
  document.body.classList.remove('is-booting');
  const prompts = asArray(invitation.prompts);
  const firstName = invitation.student?.firstName || 'your student';
  const prompt = prompts[guest.promptIndex % Math.max(1, prompts.length)] || null;
  const voice = guest.voice;
  let body;
  if (guest.mode === 'thanks') {
    body = `<div class="b1514RaGuestCenter"><h1 class="h1" id="guestTitle">Thank you. ❤</h1><p>Your story is on its way to ${esc(firstName)} — and only to ${esc(firstName)}.</p><p>You can close this page now, or tell one more if another memory came to mind.</p><button class="btnSave b1514RaGuestPrimary" type="button" data-guest-tell-another>Tell another story</button></div>`;
  } else if (guest.mode === 'voice_recording' && prompt && voice) {
    body = `<div class="b1514RaGuestQuestion b1514RaVoice"><div class="eyebrow">Recording privately</div><h1 class="h1" id="guestTitle">Tell it the way you remember it.</h1><div class="b1514RaGuestAsked"><b>${esc(firstName)} asked</b><span>“${esc(guestPromptText(prompt.text, firstName))}”</span></div><div class="b1514RaVoiceOrb" aria-hidden="true"><span></span></div><div class="b1514RaVoiceTime" data-guest-voice-time>${esc(guestVoiceTime(Date.now() - voice.startedAt))}</div><p role="status" aria-live="polite">${voice.uploadError ? 'One segment needs a secure upload retry. Recording is paused.' : voice.uploading ? 'Keeping this part safe and transcribing…' : 'Listening — speak naturally. StoryForge is typing while you talk.'}</p>${voice.liveTranscript ? `<div class="b1514RaLiveTranscript"><b>Live transcript</b><p>${esc(voice.liveTranscript)}</p></div>` : ''}<div class="inlineActions">${voice.uploadError ? '<button class="btnSave b1514RaGuestPrimary" type="button" data-guest-retry-upload>Retry secure upload</button>' : '<button class="btnSave b1514RaGuestPrimary danger" type="button" data-guest-stop-voice>■ Stop &amp; review</button>'}<button class="rowBtn" type="button" data-guest-cancel-voice>Discard recording</button></div></div>`;
  } else if (guest.mode === 'voice_preparing' && prompt && voice) {
    body = `<div class="b1514RaGuestQuestion b1514RaVoice"><div class="eyebrow">Preparing your words</div><h1 class="h1" id="guestTitle">Your recording is safe.</h1><div class="b1514RaVoiceOrb preparing" aria-hidden="true"><span></span></div><p role="status" aria-live="polite">StoryForge is finishing the transcript. Nothing has been shared yet.</p>${voice.liveTranscript ? `<div class="b1514RaLiveTranscript"><b>Transcript so far</b><p>${esc(voice.liveTranscript)}</p></div>` : ''}</div>`;
  } else if (guest.mode === 'voice_recovery' && prompt && voice) {
    body = `<div class="b1514RaGuestQuestion b1514RaVoice"><div class="eyebrow">Recording preserved</div><h1 class="h1" id="guestTitle">One part needs another transcription attempt.</h1><p role="status">Your recording has not been shared or lost. Retry the transcript, or discard it and type instead.</p><div class="inlineActions"><button class="btnSave b1514RaGuestPrimary" type="button" data-guest-retry-voice>Retry transcript</button><button class="rowBtn" type="button" data-guest-cancel-voice>Discard &amp; type instead</button></div></div>`;
  } else if (guest.mode === 'question' && prompt) {
    body = `<div class="b1514RaGuestQuestion"><div class="eyebrow">${esc(firstName)} would love to hear…</div><h1 class="h1" id="guestTitle">${esc(guestPromptText(prompt.text, firstName))}</h1>${prompt.hint ? `<p>${esc(guestPromptText(prompt.hint, firstName))}</p>` : ''}<button class="rowBtn" type="button" data-guest-different-question>↻ A different question</button>
      <div class="b1514RaCaptureChoice"><button class="btnSave b1514RaGuestPrimary" type="button" data-guest-start-voice>🎤 TELL A STORY</button><span>or</span><button class="rowBtn" type="button" data-guest-type-story>Type instead</button></div><form id="guestDraftForm" ${guest.captureMode === 'text' ? '' : 'hidden'}><label class="srOnly" for="guestStory">Your story</label><textarea id="guestStory" maxlength="20000" required placeholder="Just tell it the way you remember it…">${esc(guest.text)}</textarea><div class="inlineActions"><button class="btnSave b1514RaGuestPrimary" type="submit">Review my story ▸</button><button class="rowBtn" type="button" data-guest-back>‹ Back</button></div></form></div>`;
  } else if (['review', 'voice_review'].includes(guest.mode) && prompt) {
    body = `<div class="b1514RaGuestQuestion"><div class="eyebrow">Review before sharing</div><h1 class="h1" id="guestTitle">These are your words.</h1><p>Read them through and fix anything you want. Nothing is shared until you press the button below.</p><div class="b1514RaGuestAsked"><b>You answered</b><span>“${esc(guestPromptText(prompt.text, firstName))}”</span></div><form id="guestReviewForm" data-guest-base="${attr(route.basePath)}" data-guest-token="${attr(route.token)}"><label for="guestReviewText">Your story</label><textarea id="guestReviewText" maxlength="20000" required>${esc(guest.text)}</textarea><div class="inlineActions"><button class="btnSave b1514RaGuestPrimary" type="submit">SEND TO ${esc(firstName.toUpperCase())} ➤</button><button class="rowBtn" type="button" data-guest-edit-story>Keep editing</button></div></form></div>`;
  } else {
    body = `<div class="b1514RaGuestCenter"><div class="eyebrow">A private invitation from ${esc(firstName)}</div><h1 class="h1" id="guestTitle">${esc(firstName)} asked for your help.</h1>${invitation.personalMessage ? `<blockquote>“${esc(invitation.personalMessage)}”</blockquote>` : ''}<p>${esc(firstName)} is collecting real stories from people who know them well.</p><p class="b1514RaGuestJourney">${esc(invitation.journeyLine || guestWelcomeLine(invitation.relationship))}</p><div class="b1514RaGuestHow" role="list"><span role="listitem"><b>1</b> Pick one memory</span><span role="listitem"><b>2</b> Tell it in your own words</span><span role="listitem"><b>3</b> Review it before sharing</span></div><p class="b1514RaGuestBig">You do not need to write perfectly.<br>Just tell it the way you remember it.</p><button class="btnSave b1514RaGuestPrimary" type="button" data-guest-start-text>BEGIN</button></div>`;
  }
  main.innerHTML = `<section class="storyforgeGuest" aria-labelledby="guestTitle">
    <div class="logo" aria-label="StoryForge">Story<b>Forge</b></div>${body}
    <div class="b1513ConsentCopy"><p>Your contribution is private to the student who invited you. It does not give you Matrix access. The link expires automatically and can be revoked.</p><small>Privacy notice ${esc(invitation.disclosureVersion)} · expires ${esc(formatDate(invitation.expiresAt))}</small></div>
    <div class="b1514RaGuestFoot">MissionMed StoryForge · private invitation · nothing is public</div>
  </section>`;
}

async function initGuest(route) {
  try {
    const invitation = await guestJson(`${route.basePath}api/requests/guest/${route.token}`);
    state.v2.guest = {
      invitation,
      route,
      mode: 'landing',
      promptIndex: 0,
      promptId: '',
      text: '',
      sentCount: 0,
      captureMode: '',
      voice: null,
    };
    if (!guestPagehideBound) {
      guestPagehideBound = true;
      window.addEventListener('pagehide', () => {
        const guest = state.v2.guest;
        const voice = guest?.voice;
        if (!guest?.route || !voice?.recordingId || guest.mode === 'thanks') return;
        stopGuestVoiceClock(voice);
        voice.stream?.getTracks().forEach((track) => track.stop());
        fetch(new URL(
          `${guest.route.basePath}api/requests/guest/${guest.route.token}/voice/${voice.recordingId}`,
          location.origin,
        ), { method: 'DELETE', credentials: 'omit', keepalive: true }).catch(() => {});
      });
    }
    renderGuestContribution();
  } catch (error) {
    hideApplicationChrome();
    document.body.classList.remove('is-booting');
    main.innerHTML = gateMarkup({ eyebrow: 'Private invitation', heading: 'This invitation is unavailable.', message: error.message, action: '' });
  }
}

async function enterFixturePersona(persona) {
  if (!FIXTURE_PERSONAS.has(persona)) throw new Error('Unknown local fixture identity.');
  const { token } = await api.fixture(persona);
  auth.setToken(token);
  sessionStorage.setItem(FIXTURE_PERSONA_KEY, persona);
  await bootstrapSession();
}

function signOut() {
  suspendVoiceForIdentityExit();
  stopActivityBeacon();
  state.user = null;
  state.capabilities = Object.freeze({
    voiceCapture: false,
    adminConsole: false,
    submissionReview: false,
    taxonomy: false,
    inlinePriority: false,
    storySearch: false,
    mentorNotes: false,
    mentorNotesRead: false,
    storyMedia: false,
    storyVersions: false,
    inspiration: false,
    requestAStory: false,
    activityTracking: false,
    inspirationAdmin: false,
    adminDirectory: false,
    reviewCheck: false,
    adminReviewControls: false,
    storyFollowup: false,
  });
  state.captureRecovering = false;
  state.lockout = null;
  auth.clear();
  sessionStorage.removeItem(FIXTURE_PERSONA_KEY);
  renderLogin();
}

async function recoverVoiceDraftOnBoot() {
  if (!isStudent() || !state.capabilities?.voiceCapture || state.captureRecovering) return;
  const result = await api.storyDraft().catch(() => null);
  const draft = result?.draft?.payload;
  if (!draft?.voice?.recordingId && !draft?.recordingId) return;
  await openCapture();
}

function announceVoiceHintOnBoot() {
  if (!isStudent() || !state.capabilities?.voiceCapture) return;
  window.setTimeout(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(VOICE_HINT_KEY) === '1';
    } catch {
      seen = true;
    }
    if (!seen && !capture.classList.contains('open')) {
      notify('New in StoryForge — tap the mic and it types while you talk.', '🎙');
    }
  }, 1300);
}

const activityBeacon = {
  installed: false,
  timer: 0,
  sessionId: '',
  lastMeaningfulAt: 0,
  lastBeatAt: 0,
  pending: false,
};

function activitySurface() {
  if (capture.classList.contains('open')) return 'capture';
  return ({
    home: 'home',
    library: 'library',
    story: 'story_detail',
    settings: 'settings',
    notifications: 'notifications',
    prep: 'interview_prep',
    qshop: 'interview_prep',
    qlib: 'interview_prep',
    inspiration: 'inspiration',
  })[state.route] || 'home';
}

function newActivitySession() {
  activityBeacon.sessionId = crypto.randomUUID();
  activityBeacon.lastBeatAt = 0;
}

function noteMeaningfulActivity() {
  if (!state.capabilities?.activityTracking || document.visibilityState !== 'visible') return;
  const now = Date.now();
  if (!activityBeacon.sessionId || (activityBeacon.lastBeatAt && now - activityBeacon.lastBeatAt >= 30 * 60_000)) {
    newActivitySession();
  }
  activityBeacon.lastMeaningfulAt = now;
}

async function flushActivityBeacon() {
  if (
    !state.capabilities?.activityTracking
    || document.visibilityState !== 'visible'
    || activityBeacon.pending
    || !activityBeacon.lastMeaningfulAt
  ) return;
  const now = Date.now();
  if (now - activityBeacon.lastMeaningfulAt > 120_000) return;
  if (activityBeacon.lastBeatAt && now - activityBeacon.lastBeatAt < 55_000) return;
  if (!activityBeacon.sessionId || (activityBeacon.lastBeatAt && now - activityBeacon.lastBeatAt >= 30 * 60_000)) {
    newActivitySession();
  }
  const activeMs = activityBeacon.lastBeatAt
    ? Math.max(0, Math.min(60_000, now - activityBeacon.lastBeatAt))
    : 0;
  activityBeacon.lastBeatAt = now;
  activityBeacon.pending = true;
  try {
    await api.activityHeartbeat({
      sessionId: activityBeacon.sessionId,
      surface: activitySurface(),
      activeMs,
    });
  } catch {
    // Engagement analytics are deliberately fail-silent and never block product work.
  } finally {
    activityBeacon.pending = false;
  }
}

function startActivityBeacon() {
  stopActivityBeacon();
  if (!state.capabilities?.activityTracking || !isStudent()) return;
  if (!activityBeacon.installed) {
    ['pointerdown', 'keydown', 'scroll', 'input'].forEach((eventName) => {
      document.addEventListener(eventName, noteMeaningfulActivity, { passive: true, capture: true });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') noteMeaningfulActivity();
      else void flushActivityBeacon();
    });
    activityBeacon.installed = true;
  }
  activityBeacon.sessionId = '';
  activityBeacon.lastMeaningfulAt = 0;
  activityBeacon.lastBeatAt = 0;
  activityBeacon.timer = window.setInterval(() => { void flushActivityBeacon(); }, 60_000);
}

function stopActivityBeacon() {
  if (activityBeacon.timer) window.clearInterval(activityBeacon.timer);
  activityBeacon.timer = 0;
  activityBeacon.sessionId = '';
  activityBeacon.lastMeaningfulAt = 0;
  activityBeacon.lastBeatAt = 0;
  activityBeacon.pending = false;
}

async function bootstrapSession() {
  const session = await api.session();
  const { user } = session;
  state.user = user;
  state.v2.session = Object.freeze({
    features: Object.freeze({
      visibility: session?.capabilities?.visibilityConsent === true,
      inspiration: session?.capabilities?.inspiration === true,
    }),
  });
  state.v2.consent = session?.mentorship?.consent || null;
  state.v2.consentDeferredThisSession = false;
  state.v2.homeRecommendations = [];
  state.v2.inspiration.layout = user?.inspiration_layout === 'grid' ? 'grid' : 'list';
  const presentation = await api.presentation().catch(() => null);
  state.presentation = presentation?.configuration?.payload || BUNDLED_PRESENTATION;
  state.settingsPreview.selectedBackground = null;
  state.settingsPreview.previewBackground = null;
  state.settingsPreview.selectedTextSize = null;
  state.settingsPreview.previewTextSize = null;
  state.activeRole = user.role;
  state.capabilities = Object.freeze({
    voiceCapture: Boolean(session?.capabilities?.voiceCapture),
    adminConsole: Boolean(session?.capabilities?.adminConsole),
    submissionReview: Boolean(session?.capabilities?.submissionReview),
    taxonomy: Boolean(session?.capabilities?.taxonomy),
    inlinePriority: Boolean(session?.capabilities?.inlinePriority),
    storySearch: Boolean(session?.capabilities?.storySearch),
    mentorNotes: Boolean(session?.capabilities?.mentorNotes),
    mentorNotesRead: Boolean(session?.capabilities?.mentorNotesRead),
    storyMedia: Boolean(session?.capabilities?.storyMedia),
    visibilityConsent: Boolean(session?.capabilities?.visibilityConsent),
    inspiration: Boolean(session?.capabilities?.inspiration),
    storyVersions: Boolean(session?.capabilities?.storyVersions),
    requestAStory: Boolean(session?.capabilities?.requestAStory),
    activityTracking: Boolean(session?.capabilities?.activityTracking),
    inspirationAdmin: Boolean(session?.capabilities?.inspirationAdmin),
    adminDirectory: Boolean(session?.capabilities?.adminDirectory),
    reviewCheck: Boolean(session?.capabilities?.reviewCheck),
    adminReviewControls: Boolean(session?.capabilities?.adminReviewControls),
    storyFollowup: false,
  });
  state.library.sort = state.capabilities.inlinePriority ? 'priority' : 'new';
  state.captureRecovering = false;
  state.lockout = null;
  state.selectedStudent = null;
  parseRoute();
  const studentRoutes = new Set(['home', 'library', 'inspiration', 'requests', 'notifications', 'settings', 'prep', 'qshop', 'qlib', 'story']);
  const mentorRoutes = new Set(['home', 'students', 'student', 'queue', 'activity', 'settings', 'prep', 'qshop', 'qlib', 'story']);
  const adminRoutes = new Set(canAdminReview()
    ? ['home', 'students', 'student', 'queue', 'story', 'content', 'qlib', 'settings']
    : ['qlib', 'settings']);
  const allowedRoutes = isAdmin() ? adminRoutes : isMentor() ? mentorRoutes : studentRoutes;
  if (!isAdmin() && !interviewPrepVisible() && ['prep', 'qshop', 'qlib'].includes(state.route)) {
    state.route = 'home';
    state.routeId = null;
    pushPath('home', null, true);
  }
  if (!allowedRoutes.has(state.route)) {
    state.route = isAdmin() && !canAdminReview() ? 'qlib' : 'home';
    state.routeId = null;
    pushPath(state.route, null, true);
  }
  await renderRoute();
  startActivityBeacon();
  await maybeShowConsent();
  await recoverVoiceDraftOnBoot();
  announceVoiceHintOnBoot();
}

async function init() {
  const guest = guestRoute();
  if (guest) {
    await initGuest(guest);
    return;
  }
  hideApplicationChrome();
  setMotionEnergy('active');
  main.innerHTML = `<section class="storyforgeIntro" role="status" aria-live="polite">
    <img class="introLogo" src="./missionmed-logo.png" alt="MissionMed Institute">
    <p class="introCreator">Dr Brian's IV Prep On-Call</p>
    <p class="introInstitution">MissionMed Institute</p>
    <p class="introDivision">Mission:Residency Division</p>
    <h1 class="introProduct">Story<span>Forge</span></h1>
    <p class="introStatus">Opening your private story workspace…</p>
  </section>`;
  try {
    state.config = await api.config();
    document.body.classList.toggle('motion-enabled', state.config.premiumMotion === true);
    startEnvironmentEngine();
    auth.configure(state.config);
    if (state.config.devAuth) {
      const remembered = sessionStorage.getItem(FIXTURE_PERSONA_KEY);
      if (FIXTURE_PERSONAS.has(remembered)) {
        await enterFixturePersona(remembered);
        return;
      }
      renderLogin();
      return;
    }
    await auth.exchange();
    await bootstrapSession();
  } catch (error) {
    if (!error.redirecting && !state.lockout) renderStartupFailure();
  }
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-fixture-persona], [data-retry-startup]');
  if (!button) return;
  try {
    button.disabled = true;
    if (button.dataset.fixturePersona) await enterFixturePersona(button.dataset.fixturePersona);
    else await init();
  } catch (error) {
    renderLogin(error.message);
  }
});

window.addEventListener('popstate', async () => {
  if (!state.user) return;
  parseRoute();
  clearOverlays();
  try {
    await renderRoute();
  } catch (error) {
    notify(error.message);
  }
});

$('.skip-link')?.addEventListener('click', (event) => {
  event.preventDefault();
  const heading = $('h1, .h1', main);
  heading?.setAttribute('tabindex', '-1');
  heading?.focus();
});

let environmentEngineStarted = false;

function startEnvironmentEngine() {
  if (environmentEngineStarted || !document.body.classList.contains('motion-enabled')) return;
  const canvas = $('#bgfx');
  const context = canvas?.getContext('2d');
  if (!context) return;
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  if (motionPreference.matches) return;
  environmentEngineStarted = true;
  let particles = [];
  let stars = [];
  let builtFor = '';
  let tick = 0;
  let seed = 0x5101cafe;
  const random = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(bounds.width * ratio) || canvas.height !== Math.round(bounds.height * ratio)) {
      canvas.width = Math.round(bounds.width * ratio);
      canvas.height = Math.round(bounds.height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
    return bounds;
  };
  const build = (mode) => {
    builtFor = mode;
    seed = 0x5101cafe;
    particles = Array.from({ length: 64 }, () => ({ x: random(), y: random(), size: random(), phase: random() * 7 }));
    stars = Array.from({ length: 110 }, () => ({ x: random(), y: random(), size: random(), phase: random() * 7 }));
  };
  const frame = () => {
    if (motionPreference.matches || !document.body.classList.contains('motion-enabled')) {
      environmentEngineStarted = false;
      context.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const bounds = resize();
    const mode = document.body.dataset.background || 'ember';
    const energy = document.body.dataset.motionEnergy || 'low';
    const energyFactor = ({ low: 0.72, active: 1.08, recording: 1.45, success: 0.9 })[energy] || 0.72;
    if (builtFor !== mode) build(mode);
    context.clearRect(0, 0, bounds.width, bounds.height);
    tick += 0.012 * energyFactor;
    if (mode === 'ember') {
      particles.forEach((particle) => {
        particle.y -= ((0.04 + particle.size * 0.12) / 150) * energyFactor;
        particle.x += Math.sin(tick + particle.phase) * 0.00012 * energyFactor;
        if (particle.y < -0.02) {
          particle.y = 1.02;
          particle.x = random();
        }
        const color = particle.size > 0.45 ? '255,179,64' : '57,214,255';
        context.fillStyle = `rgba(${color},${(0.05 + particle.size * 0.11) * Math.min(1.35, energyFactor)})`;
        context.beginPath();
        context.arc(particle.x * bounds.width, particle.y * bounds.height, 0.7 + particle.size * 1.7, 0, Math.PI * 2);
        context.fill();
      });
    } else if (mode === 'constellation') {
      stars.forEach((star) => {
        const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(tick * 0.8 + star.phase * 3));
        context.fillStyle = `rgba(${star.size > 0.6 ? '233,238,251' : '159,216,255'},${(0.15 + star.size * 0.5) * twinkle})`;
        context.beginPath();
        context.arc(star.x * bounds.width, star.y * bounds.height, 0.5 + star.size * 1.3, 0, Math.PI * 2);
        context.fill();
      });
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

try {
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (savedTheme() === 'auto') applyTheme();
  });
} catch {
  // Older engines resolve AUTO on the next environment pass.
}

init();
