// Home command surface router. Pure: free text in, an EXISTING IVOC hash route
// (or a short suggestion list) out. No I/O, no fetch, no generated answers.
// Every emitted href is one of the routes main.mjs already serves.
export const ROUTES = Object.freeze({ practice: '#/practice', mock: '#/mock', prepare: '#/prepare', review: '#/review', progress: '#/progress', devices: '#/devices' });
export const MOCK_LENGTHS = Object.freeze([5, 10, 15, 25]);
export const MOCK_PRESETS = Object.freeze(['balanced', 'warm', 'direct', 'pressure']);
const SAFE_HREF = /^#\/(?:practice|mock|prepare|review|progress|devices)(?:\?[A-Za-z0-9%._~&=-]*)?$|^#\/results\/[A-Za-z0-9_-]+$/;
export function isSafeHref(href) { return SAFE_HREF.test(String(href ?? '')); }

export const DEFAULT_SUGGESTIONS = Object.freeze([
  Object.freeze({ id: 'practice-core', label: 'Practice tell me about yourself', command: 'practice tell me about yourself', href: '#/practice?q=CORE-01' }),
  Object.freeze({ id: 'mock', label: 'Give me a full mock', command: 'give me a full mock', href: ROUTES.mock }),
  Object.freeze({ id: 'prepare', label: 'Prepare me for a program', command: 'prepare me for a program', href: ROUTES.prepare }),
  Object.freeze({ id: 'review', label: 'Show me what to improve', command: 'show me what to improve', href: ROUTES.review }),
]);

const STOPWORDS = new Set(['a', 'an', 'the', 'me', 'my', 'i', 'im', 'to', 'for', 'of', 'on', 'in', 'with', 'about', 'abt', 'please', 'can', 'could', 'you', 'u', 'do', 'does', 'did', 'is', 'are', 'am', 'be', 'was', 'what', 'whats', 'that', 'this', 'it', 'and', 'or', 'your', 'yours', 'practice', 'practise', 'practicing', 'rehearse', 'rehearsing', 'question', 'questions', 'answer', 'answering', 'help', 'want', 'wanna', 'lets', 'let', 'us', 'would', 'like', 'should', 'how', 'at', 'from', 'now', 'again', 'one', 'some', 'time', 'drill', 'rep', 'work']);
const SYNONYMS = { myself: 'yourself', me: 'you', mine: 'your', weaknesses: 'weakness', strengths: 'strength', hobbies: 'hobby', errors: 'error', mistakes: 'error', mistake: 'error', conflicts: 'conflict', goals: 'goal', yrs: 'year', yr: 'year' };
const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20, 'twenty-five': 25, 'twenty five': 25, thirty: 30 };

export function normalizeText(text) {
  return String(text ?? '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}
function stem(word) {
  let w = SYNONYMS[word] || word;
  if (w.length > 5 && w.endsWith('ies')) w = w.slice(0, -3) + 'y';
  else if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith('es') && !w.endsWith('ses')) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  return w;
}
export function tokenize(text) {
  return normalizeText(text).split(' ').filter(Boolean).map(stem).filter(w => w.length > 1 && !STOPWORDS.has(w));
}
function distance(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
  }
  return rows[a.length][b.length];
}
function tokensMatch(a, b) {
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b, longer = shorter === a ? b : a;
  if (shorter.length >= 4 && longer.startsWith(shorter)) return true;
  const tolerance = shorter.length >= 7 ? 2 : shorter.length >= 5 ? 1 : 0;
  return tolerance > 0 && distance(a, b) <= tolerance;
}
const questionTokens = new Map();
function tokensFor(question) {
  const key = question.question_id + '|' + question.canonical_text;
  if (!questionTokens.has(key)) questionTokens.set(key, tokenize(question.canonical_text));
  return questionTokens.get(key);
}
/** Fuzzy match free text against the current question library. Returns null below the confidence floor. */
export function matchQuestion(text, questions = [], { minScore = 0.5 } = {}) {
  const query = tokenize(text);
  if (!query.length) return null;
  let best = null;
  for (const [index, question] of questions.entries()) {
    if (!question?.question_id || !question.canonical_text) continue;
    const target = tokensFor(question);
    if (!target.length) continue;
    let matched = 0;
    const used = new Set();
    for (const token of query) {
      const hit = target.findIndex((t, i) => !used.has(i) && tokensMatch(token, t));
      if (hit >= 0) { used.add(hit); matched++; }
    }
    if (!matched) continue;
    const score = (matched / query.length + matched / target.length) / 2;
    if (score < minScore) continue;
    if (!best || score > best.score || (score === best.score && (question.core_priority === true) > (best.question.core_priority === true)) || (score === best.score && question.core_priority === best.question.core_priority && index < best.index)) best = { question, score, matched, index };
  }
  return best ? { question: best.question, score: Math.round(best.score * 100) / 100, matched: best.matched } : null;
}

const PREPARE = /\b(prepare|preparing|prep|programs?|programme|residency|residencies|fellowship|rise)\b/;
const MOCK = /\b(mock|mocks|full interview|whole interview|entire interview|simulat\w*|interview me|run an interview|practice interview|grill me|pressure)\b/;
const PROGRESS = /\b(progress|streak|history|over time|trend|trends|how am i doing|how i.?m doing)\b/;
const IMPROVE = /\b(improve|improvement|improving|what (?:should|do|can|could) i (?:change|fix|work on|do better|improve)|what to (?:change|fix|work on|improve)|priority|priorities|debrief|feedback|results?|how did i do|what went wrong|weak(?:est)? (?:spot|point|area|part)|last (?:rep|answer|mock|interview|session))\b/;
const REVIEW = /\b(review|replay|film room|film|recordings?|compare|watch|debriefs|saved reps?)\b/;
const DEVICES = /\b(camera|webcam|mic|microphone|headset|speakers?|audio|video|devices?|calibrat\w*|signals?|tech check|setup check|sound)\b/;
const PRACTICE = /\b(practice|practise|practicing|rehearse|rehearsal|reps?|drill|answer|question|questions)\b/;

function mockHints(normalized) {
  const params = new URLSearchParams();
  let minutes = null;
  const digits = normalized.match(/\b(\d{1,2})\s*-?\s*(?:min|mins|minute|minutes)\b/);
  if (digits) minutes = Number(digits[1]);
  else { const words = normalized.match(/\b(twenty[- ]five|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty)\s*-?\s*(?:min|mins|minute|minutes)\b/); if (words) minutes = NUMBER_WORDS[words[1].replace(' ', '-')] ?? NUMBER_WORDS[words[1]]; }
  if (minutes == null && /\b(quick|short)\b/.test(normalized)) minutes = 5;
  if (Number.isFinite(minutes)) params.set('min', String(MOCK_LENGTHS.reduce((a, b) => Math.abs(b - minutes) < Math.abs(a - minutes) ? b : a)));
  if (/\b(pressure|tough|hard|skeptical|sceptical|grill\w*|stress\w*|intense)\b/.test(normalized)) params.set('preset', 'pressure');
  else if (/\b(warm|gentle|easy|friendly|kind)\b/.test(normalized)) params.set('preset', 'warm');
  else if (/\b(direct|concise|chief resident|blunt)\b/.test(normalized)) params.set('preset', 'direct');
  const query = params.toString();
  return query ? ROUTES.mock + '?' + query : ROUTES.mock;
}
const FILLER = /^(?:a|an|the|my|this|that|our|some|program|programme|programs|residency|interview|interviews|fellowship|rise|mock|please|me|for|at|to|in|with|search|find|lookup|look up|look|up|open)\b\s*/i;
const TRAILING = /\s*\b(?:program|programme|programs|residency|interview|interviews|fellowship|mock|please|search|lookup)$/i;
export function programQuery(text) {
  let raw = String(text ?? '').replace(/[^\p{L}\p{N}\s&'.,-]/gu, ' ').replace(/\s+/g, ' ').trim();
  const after = raw.match(/.*\b(?:for|at)\s+(.+)$/i);
  if (after) raw = after[1];
  else raw = raw.replace(/^(?:please\s+|help me\s+|i want to\s+|i'd like to\s+|can you\s+|lets\s+|let's\s+)*(?:prepare|preparing|prep|get ready|ready|rehearse)?(?:\s+me)?\s*/i, '');
  let previous;
  do { previous = raw; raw = raw.replace(FILLER, '').replace(TRAILING, '').trim(); } while (raw && raw !== previous);
  raw = raw.replace(/[.,\s]+$/, '').trim();
  return raw.length >= 2 && raw.length <= 80 && /\p{L}|\p{N}/u.test(raw) ? raw : '';
}

function suggestionsFor(text, { latest = null } = {}) {
  const query = new Set(tokenize(text));
  const chips = commandChips({ latest });
  return chips.map((chip, index) => ({ chip, index, overlap: tokenize(chip.command || chip.label).filter(t => query.has(t)).length }))
    .sort((a, b) => b.overlap - a.overlap || a.index - b.index).slice(0, 3).map(x => x.chip);
}

/** Chips shown under the Home command input: the four default workflows plus one personalised retry when a debrief priority exists. */
export function commandChips({ latest = null } = {}) {
  const chips = DEFAULT_SUGGESTIONS.map(chip => chip.id === 'review' && latest?.id ? { ...chip, href: '#/results/' + encodeURIComponent(String(latest.id)) } : { ...chip });
  if (latest?.priorityText && latest.questionId && latest.id) {
    const priority = String(latest.priorityText).replace(/[.\s]+$/, '');
    const label = 'Clear my priority: ' + (priority.length > 48 ? priority.slice(0, 47).trimEnd() + '…' : priority);
    chips.push({ id: 'priority', label, command: 'retry my last question with the priority on screen', href: '#/' + (latest.mode === 'mock' ? 'mock' : 'practice') + '?q=' + encodeURIComponent(String(latest.questionId)) + '&retry=' + encodeURIComponent(String(latest.id)) });
  }
  return chips.filter(chip => isSafeHref(chip.href));
}

/**
 * Resolve free text to one existing workflow.
 * Returns {kind:'route', intent, href, label, question?} or {kind:'suggest', message, suggestions:[chip,chip,chip]}.
 */
export function routeCommand(text, { questions = [], latest = null } = {}) {
  const normalized = normalizeText(text);
  const suggest = message => ({ kind: 'suggest', message, suggestions: suggestionsFor(text, { latest }) });
  if (!normalized) return suggest('Type what you want to work on, or choose a suggestion.');
  const strong = matchQuestion(text, questions, { minScore: 0.75 });
  if (strong && strong.matched >= 2 && !MOCK.test(normalized)) return routePractice(strong);
  if (PREPARE.test(normalized) && !/\bmock\b/.test(normalized)) {
    const q = programQuery(text);
    return { kind: 'route', intent: 'prepare', href: q ? ROUTES.prepare + '?q=' + encodeURIComponent(q) : ROUTES.prepare, label: q ? 'Opening Prepare for a program · searching RISE for “' + q + '”' : 'Opening Prepare for a program' };
  }
  if (MOCK.test(normalized)) return { kind: 'route', intent: 'mock', href: mockHints(normalized), label: 'Opening Mock interview setup' };
  if (PROGRESS.test(normalized)) return { kind: 'route', intent: 'progress', href: ROUTES.progress, label: 'Opening Progress' };
  if (IMPROVE.test(normalized)) return latest?.id
    ? { kind: 'route', intent: 'results', href: '#/results/' + encodeURIComponent(String(latest.id)), label: 'Opening your latest debrief' }
    : { kind: 'route', intent: 'review', href: ROUTES.review, label: 'Opening Review & improve' };
  if (REVIEW.test(normalized)) return { kind: 'route', intent: 'review', href: ROUTES.review, label: 'Opening Review & improve' };
  if (DEVICES.test(normalized) && !PRACTICE.test(normalized)) return { kind: 'route', intent: 'devices', href: ROUTES.devices, label: 'Opening Devices & calibration' };
  const match = matchQuestion(text, questions);
  if (match) return routePractice(match);
  if (DEVICES.test(normalized)) return { kind: 'route', intent: 'devices', href: ROUTES.devices, label: 'Opening Devices & calibration' };
  if (PRACTICE.test(normalized)) return { kind: 'route', intent: 'practice', href: ROUTES.practice, label: 'Opening Practice · choose a question' };
  return suggest('No matching IVOC workflow for that. Closest options:');
}
function routePractice(match) {
  return { kind: 'route', intent: 'practice', href: ROUTES.practice + '?q=' + encodeURIComponent(match.question.question_id), label: 'Opening Practice · “' + match.question.canonical_text + '”', question: match.question };
}
