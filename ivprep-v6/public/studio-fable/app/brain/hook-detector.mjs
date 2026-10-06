// ivoc.hook-detector.v1 — MissionMed "bottom lining" / conversational-bait recognition.
//
// Pure, deterministic, no I/O. The rule layer is the authority: an optional
// model-assisted scorer may only re-rank or re-phrase hooks this module found
// (see assistHooks). Nothing here infers emotion, personality or intent beyond
// the observable discourse structure of the transcript.
//
// Contract (see IVOC_FABLE51_INTERVIEWBRAIN_TEACHING.md):
//   detectHooks({ question, answer, priorTurns, context, policy }) -> HookReport
//
// HookReport {
//   version, hooks: Hook[] (sorted desc by total), primary: Hook|null,
//   decision: 'FOLLOW_HOOK' | 'PROBE_VAGUE' | 'CLARIFY_CONTRADICTION' | 'MOVE_ON',
//   flags: { candidateQuestion, fillerHeavy, rambling, shortAnswer },
//   blockedBy: null | 'DEPTH' | 'TIME' | 'PHASE', reasons: string[]
// }

export const HOOK_DETECTOR_VERSION = 'ivoc.hook-detector.v1';

export const HOOK_CATEGORIES = Object.freeze({
  OL: 'OPEN_LOOP_TEASE',
  NE: 'NAMED_EXPERIENCE_UNEXPLAINED',
  UC: 'UNUSUAL_CLAIM',
  SD: 'SALIENT_DETAIL',
  LS: 'LEARNED_SOMETHING_UNSTATED',
  SU: 'SUPERLATIVE_UNEXPLAINED',
  QR: 'RESULT_WITHOUT_METHOD',
  DB: 'DELIBERATE_BAIT_MARKER',
  CT: 'CONTRADICTION',
  VC: 'VAGUE_CLAIM',
});

export const DEFAULT_POLICY = Object.freeze({
  maxDepth: 1,
  depthUsedThisQuestion: 0,
  remainingReserveMs: Infinity,
  closingReserveMs: 90_000,
  followThreshold: 0.62,
  phase: 'QUESTION',
});

const WEIGHTS = Object.freeze({ dangling: 0.30, specificity: 0.15, relevance: 0.25, resolvability: 0.10, salience: 0.10, intent: 0.10 });

// ---------- lexicons ----------

const STOP = new Set(('a an the and or but so of to in on at for with by from as is was were be been being it its this that these those i me my we our you your he she they them his her their there here then than very really quite pretty just about into out up down over under again once still also actually which who whom whose what when where why how all any both each few more most other some such no nor not only own same too s t can will would should could may might must do does did doing have has had having am are').split(' '));

const NARRATIVE_IRREGULAR = new Set('went said told saw took gave made came got found caught brought began ran wrote spoke met left led became built taught thought felt knew kept lost won sat stood held heard read put set cut sent showed did ended'.split(' '));

const COMPETENCY = ['company', 'business', 'startup', 'found', 'director', 'captain', 'organiz', 'nonprofit', 'venture', 'manag', 'teach', 'learn', 'patient', 'team', 'communicat', 'lead', 'mistake', 'error', 'feedback', 'safety', 'trust', 'priorit', 'conflict', 'decision', 'escalat', 'handoff', 'handover', 'discharge', 'diagnos', 'treat', 'care', 'research', 'result', 'triag', 'code', 'resident', 'attending', 'nurse', 'pressure', 'conversation', 'hardest', 'taught', 'reason', 'project', 'fellow', 'rotation', 'clinic', 'hospital', 'ward', 'icu', 'ed', 'floor', 'ventilator', 'textbook', 'tour', 'program', 'faculty', 'curriculum', 'delirium', 'case', 'qi', 'quality', 'protocol'];

const TAG_LEXICON = Object.freeze({
  CORE: ['background', 'train', 'research', 'hospital', 'teach', 'learn', 'family', 'work', 'outside', 'year', 'father', 'mother'],
  TRADITIONAL: ['background', 'train', 'research', 'hospital', 'teach', 'learn', 'family', 'work'],
  BEHAVIORAL: ['team', 'conflict', 'decision', 'lead', 'escalat', 'communicat', 'feedback', 'resident', 'attending', 'nurse', 'project', 'handover', 'handoff', 'discharge', 'qi', 'quality'],
  TEAMWORK: ['team', 'project', 'handover', 'handoff', 'discharge', 'qi', 'quality', 'attending', 'resident', 'nurse'],
  CONFLICT: ['conflict', 'escalat', 'resident', 'attending', 'conversation', 'disagree', 'night'],
  LEADERSHIP: ['lead', 'chief', 'project', 'handover', 'handoff', 'team', 'class', 'schedule', 'quality'],
  SITUATIONAL: ['team', 'decision', 'escalat', 'patient', 'safety'],
  CLINICAL_EXPERIENCE: ['patient', 'diagnos', 'safety', 'error', 'mistake', 'delirium', 'case', 'ed', 'icu', 'floor', 'treat', 'code', 'result', 'team', 'confusion'],
  PATIENT_INTERACTION: ['patient', 'family', 'daughter', 'conversation', 'bedside', 'team', 'message', 'case', 'ed'],
  MISTAKE_SAFETY: ['error', 'mistake', 'safety', 'patient', 'learn', 'result', 'attending', 'nurse', 'potassium', 'read'],
  PERSONAL: ['hobby', 'run', 'cook', 'family', 'outside', 'mountain'],
  HOBBIES: ['hobby', 'run', 'cook', 'read', 'hik', 'outside', 'mountain'],
  BACKGROUND: ['train', 'graduat', 'research', 'observership', 'year', 'position'],
  RESEARCH: ['research', 'result', 'thesis', 'study', 'enroll', 'department', 'data', 'site', 'patient'],
  PROGRAM_FIT: ['program', 'tour', 'faculty', 'curriculum', 'track', 'block', 'resident', 'reason', 'said'],
  MOTIVATION: ['specialty', 'surgery', 'medicine', 'chose', 'reason', 'left', 'year'],
  SPECIALTY: ['specialty', 'surgery', 'medicine', 'chose', 'reason', 'left', 'year', 'family'],
  FAILURE: ['fail', 'step', 'pressure', 'rebuild', 'learn', 'taught', 'attempt', 'score'],
  ADVERSITY: ['fail', 'pressure', 'learn', 'taught', 'hard'],
  WEAKNESSES: ['weakness', 'improve', 'learn', 'feedback'],
  COMMUNICATION: ['conversation', 'patient', 'family', 'daughter', 'tell', 'language', 'silence', 'hardest', 'medicine'],
  ETHICS: ['decision', 'ventilator', 'textbook', 'patient', 'dilemma', 'made'],
  STRENGTHS: ['example', 'code', 'communicator', 'pressure', 'calm', 'strength'],
  STRESS_PRESSURE: ['pressure', 'calm', 'code', 'night'],
  CAREER_GOALS: ['fellowship', 'year', 'future', 'finish'],
  CV_BASED: ['research', 'position', 'observership', 'publication', 'project'],
  CLOSING: [],
});

const TANGENT_DOMAIN = ['soccer', 'football', 'basketball', 'baseball', 'game', 'match', 'movie', 'film', 'weather', 'traffic', 'birthday', 'party', 'vacation', 'holiday', 'concert', 'netflix', 'score', 'won', 'lost', 'tournament', 'season'];
const STRONG_PROFESSIONAL = ['patient', 'hospital', 'clinic', 'resident', 'attending', 'nurse', 'teach', 'research', 'triag', 'code', 'ward', 'icu', 'ed', 'diagnos', 'treat', 'safety', 'handoff', 'handover', 'escalat', 'decision', 'textbook', 'department', 'ventilator', 'conversation', 'program', 'tour', 'faculty', 'specialty', 'medicine', 'surgery'];

const GUARDED = /\b(medical (situation|condition|issue|leave|reason)|health (situation|condition|issue|problem|reason)|diagnos(ed|is) with|illness|cancer|depress|anxiety|therapy|pregnan|maternity|disab|wheelchair|religio|church|mosque|temple|visa|immigration|green card|citizenship|married|divorce|husband|wife|spouse|boyfriend|girlfriend|sexual|orientation|ethnic|race\b|racial|my age|years old|elderly|mental health|rehab|addiction|sober|miscarriage|fertility|surgery i had|my own (diagnosis|condition|illness))\b/i;

const WITHHELD = /\b(asked me not to (say|share|tell|disclose)|can'?t say who|cannot say who|confidential|i'?d rather not say|i would rather not say|prefer not to say)\b/i;

const TIME_WORDS = /\b(yesterday|today|tonight|last (week|year|night|month|summer)|night|morning|afternoon|evening|saturday|sunday|monday|tuesday|wednesday|thursday|friday|week|day|month|year|years|days|hours|minutes|ago|\d{1,2}\s?(a\.?m\.?|p\.?m\.?)|second|first|third)\b/i;
const PLACE_WORDS = /\b(in|at|on|across|during) (the |my |our |a )?(ed|er|icu|or|floor|clinic|hospital|mountains|tour|rotation|lab|ward|unit|department|bedside|ambulance|hallway|stairwell|night shift|medicine floor|two sites|kenya|boston|lagos|karachi|rural [a-z]+|[A-Z][a-z]+)\b/;
const ROLE_WORDS = /\b(son|daughter|father|mother|parent|kid|child|patient|attending|resident|nurse|fellow|team|family|department|mentor|chief|intern|sub-intern|student|senior|colleague|classmate|professor|dr\.? [a-z]+)\b/i;
const NUMBER_WORDS = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|half|double|twice|hundred|thousand|first|second|third|youngest|only)\b/i;
const PROPER_NOUN = /\b(?<![.!?]\s)(?<!^)[A-Z][a-z]{2,}\b/;

const GENERIC_NOUNS = new Set(['things', 'thing', 'stuff', 'experiences', 'experience', 'lot', 'much', 'something', 'anything', 'everything', 'issues', 'issue']);

const NARRATIVE_EXCLUDE = new Set(['called', 'named', 'known', 'surprised', 'stuck', 'stayed', 'changed', 'taught', 'learned', 'learnt', 'realized', 'realised', 'happened', 'mentioned', 'won', 'cut', 'reduced', 'improved', 'increased']);

const SPECIALTIES = ['internal medicine', 'family medicine', 'emergency medicine', 'psychiatry', 'surgery', 'general surgery', 'pediatrics', 'neurology', 'anesthesiology', 'radiology', 'pathology', 'obstetrics', 'ob/gyn', 'dermatology', 'orthopedics', 'ophthalmology', 'urology', 'cardiology', 'oncology', 'physical medicine', 'preventive medicine', 'neurosurgery'];

// ---------- text utilities ----------

const ABBREVIATIONS = /\b(dr|mr|mrs|ms|prof|st|vs|etc|e\.g|i\.e|a\.m|p\.m|jr|sr|no|md|phd|pgy|rn|np|pa|ob|gyn|u\.s)\.$/i;

export function splitSentences(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const out = [];
  let start = 0;
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (ch !== '.' && ch !== '!' && ch !== '?') continue;
    // Swallow runs of terminal punctuation.
    let j = i;
    while (j + 1 < clean.length && /[.!?]/.test(clean[j + 1])) j += 1;
    const before = clean.slice(start, j + 1);
    const next = clean[j + 1];
    const isEnd = j + 1 >= clean.length;
    const decimal = ch === '.' && /\d$/.test(clean.slice(0, i)) && /^\d/.test(clean.slice(i + 1));
    const abbreviation = ch === '.' && ABBREVIATIONS.test(before.trimEnd());
    const boundary = isEnd || (next === ' ' && !decimal && !abbreviation);
    if (!boundary) { i = j; continue; }
    const raw = clean.slice(start, j + 1);
    const t = raw.trim();
    if (t) out.push({ index: out.length, text: t, start: start + (raw.length - raw.trimStart().length), end: start + raw.length });
    start = j + 1;
    i = j;
  }
  const tail = clean.slice(start).trim();
  if (tail) out.push({ index: out.length, text: tail, start: clean.length - clean.slice(start).trimStart().length, end: clean.length });
  return out;
}

export function lemma(token) {
  let t = String(token || '').toLowerCase().replace(/[^a-z0-9'-]/g, '').replace(/'s$/, '').replace(/'/g, '');
  if (t.length > 5 && t.endsWith('ing')) t = t.slice(0, -3);
  else if (t.length > 4 && t.endsWith('ied')) t = `${t.slice(0, -3)}y`;
  else if (t.length > 4 && t.endsWith('ed')) t = t.slice(0, -2);
  else if (t.length > 3 && t.endsWith('es') && !t.endsWith('ses')) t = t.slice(0, -2);
  else if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) t = t.slice(0, -1);
  return t;
}

export function tokens(text) {
  return String(text || '').split(/[^A-Za-z0-9'-]+/).map(lemma).filter((t) => t && !STOP.has(t));
}

function hasStem(list, tok) {
  return list.some((stem) => tok.startsWith(stem));
}

function narrativeVerbs(text) {
  const raw = String(text || '').toLowerCase().split(/[^a-z]+/).filter(Boolean);
  return raw.filter((w) => !NARRATIVE_EXCLUDE.has(w) && ((w.length > 4 && w.endsWith('ed')) || NARRATIVE_IRREGULAR.has(w) || (w.length > 5 && w.endsWith('ing'))));
}

const KEYWORD_EXCLUDE = new Set(['really', 'interest', 'interesting', 'surpris', 'surprising', 'moment', 'time', 'one', 'still', 'whole', 'people', 'find', 'way', 'part', 'happen', 'thing', 'mention', 'actually']);
function contentKeywords(span) {
  return [...new Set(tokens(span).filter((t) => t.length > 2 && !GENERIC_NOUNS.has(t) && !KEYWORD_EXCLUDE.has(t)))];
}
const sameKeyword = (t, k) => t === k || (k.length >= 6 && t.length >= 6 && t.slice(0, 6) === k.slice(0, 6));

// ---------- category detectors ----------
// Each returns { code, span } for the sentence or null. `span` is the dangling phrase.

const OL_PATTERNS = [
  /\b(there was|there's|there is|i had|i have|i remember|i can think of) (one|a|an|this|that|the) (?:(?:really|very|quite|pretty|particularly|rather) )?(?:(?:interesting|surprising|unexpected|strange|memorable|difficult|unusual|remarkable|funny|teaching|defining|pivotal|tough|hard|odd|particular|specific) )*(moment|time|case|patient|night|conversation|experience|situation|incident|day|encounter|episode|story|shift)\b[^.!?]*/i,
  /\b(something|a lot) (surprising|unexpected|interesting|strange|remarkable|unusual) happened\b[^.!?]*/i,
  /\b[^.!?]*\b(stuck|stayed) with me\b[^.!?]*/i,
  /\bi('ll| will) never forget\b[^.!?]*/i,
  /\b[^.!?]*\bsurprised (the whole|everyone|everybody|my|our|the entire|the)\b[^.!?]*/i,
  /\b[^.!?]*\b(that|which) i (still )?(think about|carry with me|come back to)\b[^.!?]*/i,
  /\bfor a reason (most|many|that|few) (people )?(find|found|would find)? ?(surprising|unexpected|strange)\b[^.!?]*/i,
  /\b[^.!?]*\b(not|wasn'?t|was not) (made|done|handled|decided) the way (the |a )?(textbook|book|protocol|guideline|guidelines|policy) (says|say|would|suggests)\b[^.!?]*/i,
  /\b(the )?(clearest|best|biggest|strongest|most recent) example (was|is|would be|came)\b[^.!?]*/i,
  /\b(took|spent) (a year|a few months|some time|time|six months) off (for|because of|due to)\b[^.!?]*/i,
  /\b[^.!?]*\b(there'?s|there is) a (whole )?story behind\b[^.!?]*/i,
];

const SU_PATTERNS = [
  /\bthe (hardest|toughest|best|worst|most (difficult|important|rewarding|interesting|memorable)|scariest|proudest) (part|day|case|conversation|decision|year|moment|thing|night|week)\b[^.!?]*/i,
];

const NE_PATTERNS = [
  /\b(the|my|our) (\w+[- ])?(project|rotation|initiative|committee|elective|protocol|template|audit|program|curriculum)\b,? which i (won'?t|will not|can'?t) go into[^.!?]*/i,
  /\b(proudest of|proud of|most proud of|the reason|is why|what i(?:'m| am) proudest of) (is|was) (the|my|our) (\w+[- ])?(project|rotation|initiative|committee|elective|protocol|template|audit|program|curriculum)\b[^.!?]*/i,
  /\bmy time (at|in) [A-Z][\w-]+[^.!?]*/,
  /\bwhen i was (chief|lead|coordinator|president|captain|the only)\b[^.!?]*/i,
  /\b(something|what) (dr\.? [a-z]+|a resident|an attending|my attending|a nurse|a patient|someone|one of the residents|the program director|a faculty member) (said|told me|mentioned|asked)\b[^.!?]*/i,
  // Structural narrative events: a venture the candidate created or a role they attained, named and then left unexplained.
  /\bi (?:(?:also|then|eventually|later|recently|actually) )?(started|founded|co-founded|launched|built|created|opened|ran) (?:up )?(?:my own |our own |a |an |the )?(?:[\w-]+ ){0,2}?(company|business|startup|start-up|nonprofit|non-profit|clinic|practice|organization|organisation|foundation|charity|lab|podcast|app|platform|initiative|venture)\b(?:[^.!?,:;]|,(?!\s*(?:which|that|where|and|but|so)\b))*/i,
  /\b(?:i )?(became|was promoted to|served as|was elected|was appointed|was named|got promoted to) (?:the |a |an )?(?:[\w-]+ )?(captain|chief|director|president|founder|co-founder|lead|leader|head|coordinator|manager|chair|chairperson|supervisor|officer|ceo|cto|coo|cmo|consultant|editor)\b(?:[^.!?,:;]|,(?!\s*(?:which|that|where|and|but|so)\b))*/i,
];

const UC_PATTERNS = [
  /\b(i was )?the only (one|person|img|resident|student|intern|member)?\s?(on|in|of) (the|my|our) (team|class|program|department|unit|floor|service) [^.!?]*/i,
  /\b(only|first|youngest|last) (img|resident|student|intern|person|one) (to|who|in)\b[^.!?]*/i,
  /\bbefore the (attending|senior|fellow|team|consultant) (did|noticed|saw|caught|realized)\b[^.!?]*/i,
  /\bnever (once )?(missed|lost|failed)\b[^.!?]*/i,
  /\bnobody (thought|believed|expected)\b[^.!?]*/i,
  /\bagainst (the )?(advice|recommendation|instructions)\b[^.!?]*/i,
];

const SD_PATTERNS = [
  /\b(a|one|an) (situation|moment|thing|incident|night|encounter) (in|on|at|during) (the )?[\w' -]+? that i (still )?(think about|remember|use|come back to)\b[^.!?]*/i,
];

const LS_PATTERNS = [
  /\bi (learned|learnt|realized|realised|discovered|understood) something\b[^.!?]*/i,
  /\b(that|it|this|which|the (second attempt|experience|whole thing|process|case|year)) (taught|showed) me (something|a lot|so much|more than)\b[^.!?]*/i,
  /\blearned a lot about (myself|how i|what i)\b[^.!?]*/i,
  /\b[^.!?]*\b(changed|shaped) how i (think|practice|see|approach|work|lead)\b[^.!?]*/i,
  // Natural speech: subject may be a filler-separated fragment ("Um, has really taught me a lot, uh, every single experience").
  /\b(?:has|have|had|that|it|this|which)?,? ?(?:really |truly |honestly |definitely |just |genuinely )?(taught|showed) me (?:a lot|so much|something|many things|different things|more than)\b[^.!?]*/i,
  /\bi (learned|learnt) (?:a lot of |so many |many |several |some |different |various |important |valuable )?(lessons|things)\b[^.!?]*/i,
];

const QR_PATTERNS = [
  /\b(cut|reduced|improved|increased|decreased|raised|lowered|dropped|brought|took) [^.!?]*?\b(by|from) (\d+|one|two|three|four|five|six|seven|eight|nine|ten|half)\b[^.!?]*/i,
  /\bfrom (\w+ )?(\d+|one|two|three|four|five|six|seven|eight|nine|ten) (days|hours|minutes|percent|%|patients|weeks|months) to (\d+|one|two|three|four|five|six|seven|eight|nine|ten|zero|none)\b[^.!?]*/i,
  /\b[^.!?]*\b(by half|in half|doubled|tripled|went from [^.!?]* to [^.!?]*)\b[^.!?]*/i,
  /\bwe (fixed|solved|turned (it |things )?around)\b[^.!?]*/i,
];

const DB_PATTERNS = [
  /^actually,/i,
  /\bfunny enough\b/i,
  /\bi('ll| will)? ?(just )?mention\b/i,
  /\bi won'?t go into (it|that|here|details)\b/i,
  /\bthat'?s a (whole |long )?(other )?(story|another story)\b/i,
  /\blong story\b/i,
  /\bbut that'?s another\b/i,
  /\bthere'?s a story behind\b/i,
  /\bi could tell you (about|a)\b/i,
];

const VC_PATTERNS = [
  /\bi('m| am) (a |an )?(very |really |quite |pretty )?(strong|good|great|natural|excellent|effective) (leader|communicator|team player|listener|clinician|teacher|collaborator)\b/i,
  /\bi work well under pressure\b/i,
  /\bi('m| am) (very |really |quite |extremely )?(organized|empathetic|hard-?working|dedicated|calm under pressure|resilient|adaptable|reliable|compassionate|detail-oriented|a team player)\b/i,
  /\bpatients love me\b/i,
  /\bi('m| am) a team player\b/i,
];

const EXAMPLE_PRESENT = /\b(for example|for instance|one time|once,|once |when i |the clearest example|an example|a time when|last (week|month|year)|on my|during my)\b/i;

const CANDIDATE_QUESTION = /(\b(can|could|may) i ask\b|\b(what|how|do|does|is|are|would|will|could|can|when|where|who)\b[^.!?]*\?)/i;

const METHOD_CLAUSE = /\b(by (\w+ing|using|building|creating|setting|adding|changing|moving|standardizing|introducing)|what we did was|through (a|an|the)\b|because we|we did this by|the way we did it)\b/i;

const FILLER = /\b(um|uh|like|you know|i mean|sort of|kind of|i guess|so,|yeah)\b/gi;

// ---------- scoring helpers ----------

function tagLexiconFor(tags = []) {
  const set = new Set();
  for (const tag of tags) for (const stem of TAG_LEXICON[tag] || []) set.add(stem);
  return [...set];
}

function relevanceScore(span, question, context) {
  const toks = tokens(span);
  const tagLex = tagLexiconFor(question?.tags);
  const specialty = String(context?.specialty || '').toLowerCase().split(/\W+/).filter((t) => t.length > 3);
  const lexicon = [...new Set([...tagLex, ...COMPETENCY, ...specialty])];
  const tangent = toks.some((t) => hasStem(TANGENT_DOMAIN, t));
  const strong = toks.some((t) => hasStem(STRONG_PROFESSIONAL, t));
  if (tangent && !strong) return { value: 0, overlaps: [], tangent: true };
  const overlaps = [...new Set(toks.filter((t) => hasStem(lexicon, t)))];
  if (overlaps.length >= 2) return { value: 1.0, overlaps, tangent: false };
  if (overlaps.length === 1) return { value: 0.6, overlaps, tangent: false };
  const personal = (question?.tags || []).some((t) => ['PERSONAL', 'HOBBIES'].includes(t));
  return { value: personal ? 0.2 : 0.0, overlaps, tangent: false };
}

function specificityScore(span) {
  let score = 0;
  const generic = tokens(span).filter((t) => GENERIC_NOUNS.has(t)).length;
  if (NUMBER_WORDS.test(span) || PROPER_NOUN.test(span)) score += 0.4;
  if (TIME_WORDS.test(span) || PLACE_WORDS.test(span)) score += 0.3;
  if (ROLE_WORDS.test(span)) score += 0.3;
  if (generic > 0 && score === 0) return 0;
  return Math.min(1, Number(score.toFixed(2)));
}

function salienceScore(sentence, sentences, spanEndsSentence) {
  const total = sentences.length;
  if (total === 0) return 0.3;
  if (sentence.index === total - 1) return 1.0;
  const chars = sentences[total - 1].end || 1;
  if (sentence.end >= chars * 0.75) return 0.8;
  if (sentence.index === 0) return 0.3;
  return spanEndsSentence ? 0.55 : 0.5;
}

function resolvabilityFor(code, span) {
  if (WITHHELD.test(span)) return 0;
  switch (code) {
    case 'OL': case 'SD': case 'SU': case 'NE': return 1.0;
    case 'LS': case 'QR': return 0.7;
    case 'UC': return 0.7;
    default: return 0.5;
  }
}

function danglingScore(hookSentence, span, sentences) {
  // Same-sentence elaboration: text after the cue separated by ':' or ' — ' / ' - ' with narrative verbs.
  const idx = hookSentence.text.indexOf(span);
  const after = idx >= 0 ? hookSentence.text.slice(idx + span.length) : '';
  if (/^[\s]*[:—–-]\s*/.test(after) && narrativeVerbs(after).length > 0) return 0.0;
  // A trailing relative/explanatory clause that narrates or defines the span resolves it in the same breath.
  const clause = after.match(/^\s*,?\s*(?:which|that|where|and (?:that|it|this|we|i))\b([\s\S]*)$/i);
  if (clause && (narrativeVerbs(clause[1]).length > 0 || /\b(meant|means|involved|involves|consisted|included|includes|required|taught|is about|was about)\b/i.test(clause[1]))) return 0.0;
  const keys = contentKeywords(span);
  const later = sentences.filter((s) => s.index > hookSentence.index);
  let best = 1.0;
  for (const s of later) {
    const toks = tokens(s.text);
    const overlap = keys.some((k) => toks.some((t) => sameKeyword(t, k)));
    const pronounStart = /^(he|she|they|it|that|this|we)\b/i.test(s.text);
    const narrative = narrativeVerbs(s.text).length > 0;
    if ((overlap || pronounStart) && narrative) return 0.0;
    if (overlap && !narrative) best = Math.min(best, 0.5);
  }
  return best;
}

function intentScore(sentence, hasMarker, spanEndsSentence, isLast) {
  if (hasMarker) return 1.0;
  if (isLast && spanEndsSentence) return 0.6;
  return 0.3;
}

const LEADING_CUES = /^(actually,?\s+|funny enough,?\s+|i('ll| will)?\s?(just )?mention (that )?|(there was|there's|there is|i had|i have|i remember|i can think of)\s+(one|a|an|this|that|the)\s+|(the )?(clearest|best|biggest|strongest|most recent) example (was|is|would be|came)\s+|the part i'?m proudest of is\s+|for\s+)/i;
const EVALUATIVE = /\b(really|very|quite|pretty|particularly|rather|interesting|surprising|unexpected|strange|memorable|remarkable|funny|odd)\s+/gi;
function secondPerson(text) {
  return text
    .replace(/\bmy\b/gi, 'your').replace(/\bmine\b/gi, 'yours').replace(/\bmyself\b/gi, 'yourself')
    .replace(/\bour\b/gi, 'your').replace(/\bours\b/gi, 'yours').replace(/\bwe\b/gi, 'you').replace(/\bus\b/gi, 'you')
    .replace(/\bi'm\b/gi, "you're").replace(/\bi am\b/gi, 'you are').replace(/\bi've\b/gi, "you've").replace(/\bi'd\b/gi, "you'd").replace(/\bi'll\b/gi, "you'll")
    .replace(/\bi\b/g, 'you').replace(/\bme\b/gi, 'you');
}
export function headPhrase(span) {
  let text = String(span).trim().replace(/^[,;:\s]+/, '').replace(/[,.;:!?]+$/, '');
  text = text.replace(LEADING_CUES, '').replace(EVALUATIVE, '');
  text = text.replace(/,?\s+which (i|you) (won'?t|will not|can'?t) go into( here)?/i, '');
  text = text.replace(/,?\s+(but|and|which|so|because|although|makes|made)\b[\s\S]*$/i, '');
  text = secondPerson(text);
  if (/^(a|an)\s+/i.test(text)) text = text.replace(/^(a|an)\s+/i, 'that ');
  else if (!/^(that|the|this|your|those|these|dr\b|what|something|one|how|when|where)/i.test(text)) text = `that ${text}`;
  const words = text.split(/\s+/).filter(Boolean);
  return words.slice(0, 12).join(' ');
}

// Span-specific natural phrasings (checked before the category template).
const SPECIFIC_PHRASINGS = [
  [/for a reason (most|many|that|few)/i, { neutral: 'What was the reason?', direct: 'What was the reason you left?', conversational: 'Go on. What was the reason?' }],
  [/surprised (the whole|everyone|everybody|my|our|the entire|the)/i, { neutral: 'What was the result, and why did it surprise them?', direct: 'What was the result?', conversational: 'What was it? Why the surprise?' }],
  [/(stuck|stayed) with (me|you)/i, { neutral: 'Tell me about the {noun} that stuck with you.', direct: 'What was the {noun}?', conversational: 'Which {noun} was that?' }],
  [/the hardest part .* (wasn'?t|was not)/i, { neutral: 'What was the hardest part?', direct: 'So what was the hardest part?', conversational: 'Okay. What was the hardest part?' }],
  [/not (made|done|handled|decided) the way/i, { neutral: 'How was the decision made?', direct: 'How was it decided, exactly?', conversational: 'How did you actually decide?' }],
  [/(won'?t|will not|can'?t) go into/i, { neutral: 'Go into it. What was {x}?', direct: 'What was {x}?', conversational: '{x}. Go into it.' }],
  [/(something|what) (dr\.? \w+|a resident|an attending|your attending|a nurse|a patient|someone) (said|told you|mentioned|asked)/i, { neutral: 'What did {person} say?', direct: 'What did {person} say?', conversational: 'What did {person} say?' }],
  [/(clearest|best|biggest|strongest|most recent) example/i, { neutral: 'Walk me through that {noun}.', direct: 'Walk me through it.', conversational: 'Walk me through that {noun}.' }],
  [/(changed|shaped) how (i|you) (think|practice|see|approach|work|lead)/i, { neutral: 'What happened that night, and what changed?', direct: 'What happened?', conversational: 'What happened that changed it?' }],
  [/a situation (in|on|at|during)/i, { neutral: 'What happened {where}?', direct: 'What happened {where}?', conversational: 'What happened {where}?' }],
  [/\b(started|founded|co-founded|launched|built|created|opened|ran) (?:up )?(my|your|our|a|an|the)\b/i, { neutral: 'Tell me about {venture}. What does it do, and what was your part in it?', direct: 'What is {venture}, exactly, and what did you do there?', conversational: '{venture}. Tell me more about that.' }],
  [/\b(became|was promoted to|served as|was elected|was appointed|was named|got promoted to)\b/i, { neutral: 'You said you became {role}. What did that involve day to day?', direct: 'What did being {role} actually involve?', conversational: 'What was being {role} like?' }],
];
const VENTURE_RE = /\b(company|business|startup|start-up|nonprofit|non-profit|clinic|practice|organization|organisation|foundation|charity|lab|podcast|app|platform|initiative|venture)\b(?: (?:called|named))? ((?:[A-Z][\w&'-]*)(?: (?:[A-Z][\w&'-]*|of|for|and|&))*)?/;
const ROLE_RE = /\b(?:became|was promoted to|served as|was elected|was appointed|was named|got promoted to) ((?:the |a |an )?(?:[\w-]+ )?(?:captain|chief|director|president|founder|co-founder|lead|leader|head|coordinator|manager|chair|chairperson|supervisor|officer|ceo|cto|coo|cmo|consultant|editor)(?: (?:resident|director|officer))?)/i;
function ventureName(span) {
  const m = String(span).match(VENTURE_RE);
  if (!m) return 'that';
  if (m[2]) return m[2].trim();
  return `the ${m[1].toLowerCase()}`;
}
function roleName(span) {
  const m = String(span).match(ROLE_RE);
  if (!m) return 'that';
  const role = m[1].trim().replace(/^(the|a|an) /i, '');
  return /^(chief|captain|director|president|founder|co-founder|lead|leader|head|coordinator|manager|chair|chairperson|supervisor|officer|consultant|editor)\b/i.test(role) ? `the ${role}` : role;
}
const NOUN_RE = /\b(case|patient|moment|night|conversation|experience|situation|incident|day|encounter|episode|story|shift|code|project|rotation|time)\b/i;

export const FOLLOW_UP_TEMPLATES = Object.freeze({
  OL: { neutral: 'What happened with {x}?', direct: 'Tell me about {x}. What actually happened?', conversational: "Okay, you can't leave me there. What happened with {x}?" },
  NE: { neutral: 'You mentioned {x}. What was that?', direct: 'What was {x}, specifically?', conversational: '{x}. What was that?' },
  UC: { neutral: 'What made you think that, and how did it turn out?', direct: "That's a strong claim. How do you know?", conversational: 'Really? How did that go?' },
  SD: { neutral: 'You said {x}. Why does that detail matter to you?', direct: 'Why {x}?', conversational: '{x}. That is specific. Why that?' },
  LS: { neutral: 'What did you learn?', direct: 'Name the thing you learned.', conversational: 'So what was it you learned?' },
  SU: { neutral: 'What made it the {superlative}?', direct: 'Why the {superlative}?', conversational: 'What made that one the {superlative}?' },
  QR: { neutral: 'How did you get from {before} to {after}? What did you change?', direct: 'That is a big claim. What exactly did you change, and how do you know it was your change?', conversational: 'How did you pull that off?', neutralNoRange: 'How did you do that? What specifically did you change?' },
  DB: { neutral: 'What happened with {x}?', direct: 'Tell me about {x}. What actually happened?', conversational: "Okay, you can't leave me there. What happened with {x}?" },
  CT: { neutral: 'Earlier you said {a}; just now {b}. Help me reconcile those.', direct: 'Which is it, {a} or {b}?', conversational: 'Hang on. Earlier it was {a}, now {b}?' },
  VC: { neutral: 'Give me one concrete example of that.', direct: 'Example.', conversational: 'Show me. One example.' },
});

function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

export function phraseFollowUp(hook, { style = 'neutral', pressure = false } = {}) {
  const variant = pressure ? 'direct' : (style === 'Eagle' ? 'direct' : style === 'Peacock' ? 'conversational' : 'neutral');
  const spanText = hook.span.text;
  let template = null;
  if (!['CT', 'VC', 'QR', 'LS', 'SU'].includes(hook.category) || /hardest part/i.test(spanText)) {
    const hit = SPECIFIC_PHRASINGS.find(([re]) => re.test(spanText));
    if (hit) template = hit[1][variant] || hit[1].neutral;
  }
  if (!template) { const base = FOLLOW_UP_TEMPLATES[hook.category] || FOLLOW_UP_TEMPLATES.OL; template = base[variant] || base.neutral; if (hook.category === 'QR' && variant === 'neutral' && !hook.meta?.before) template = base.neutralNoRange; }
  const x = headPhrase(spanText);
  const noun = (spanText.match(NOUN_RE) || [])[1]?.toLowerCase() || 'moment';
  const person = secondPerson((spanText.match(/(dr\.? \w+|a resident|an attending|my attending|a nurse|a patient|someone)/i) || [])[1] || 'they').replace(/^a (resident|nurse|patient)$/i, 'the $1').replace(/^an attending$/i, 'the attending');
  const where = (spanText.match(/\b((in|on|at|during) (the )?[a-z]+)/i) || [])[1] || 'there';
  const vars = { x, noun, person, where, venture: ventureName(spanText), role: roleName(spanText), superlative: hook.meta?.superlative || 'hardest', before: hook.meta?.before || 'there', after: hook.meta?.after || 'here', a: hook.meta?.a || '', b: hook.meta?.b || '' };
  let out = fill(template, vars).replace(/\s+/g, ' ').trim();
  out = out.charAt(0).toUpperCase() + out.slice(1);
  return out;
}

// ---------- fact slots (contradiction) ----------

export function extractFacts(text) {
  const facts = [];
  const lower = String(text || '').toLowerCase();
  for (const specialty of SPECIALTIES) {
    const re = new RegExp(`\\b(chose|choose|wanted|want|applying to|applied to|committed to|pursue|pursuing|interested in|drawn to|love|came to|decided on|going into|set on) ([a-z]+ )?${specialty.replace('/', '\\/')}\\b`);
    if (re.test(lower)) facts.push({ key: 'specialty', value: specialty });
  }
  const years = lower.match(/\b(graduated|finished medical school) in (\d{4})\b/);
  if (years) facts.push({ key: 'graduation_year', value: years[2] });
  return facts;
}

// ---------- main ----------

export function detectHooks({ question = {}, answer = {}, priorTurns = [], context = {}, policy = {} } = {}) {
  const cfg = { ...DEFAULT_POLICY, ...policy };
  const text = typeof answer === 'string' ? answer : String(answer?.text || '');
  const sentences = splitSentences(text);
  const reasons = [];
  const hooks = [];
  const wordCount = tokens(text).length + 0;
  const rawWords = text.split(/\s+/).filter(Boolean).length;
  const fillerCount = (text.match(FILLER) || []).length;
  const flags = {
    candidateQuestion: false,
    fillerHeavy: rawWords > 0 && fillerCount / Math.max(1, rawWords) >= 0.18,
    rambling: rawWords > 450,
    shortAnswer: rawWords > 0 && rawWords < 12,
  };

  const candidateQuestionSentence = sentences.find((s) => /\?$/.test(s.text) && CANDIDATE_QUESTION.test(s.text));
  if (candidateQuestionSentence) {
    flags.candidateQuestion = true;
    flags.candidateQuestionText = candidateQuestionSentence.text;
    reasons.push('CANDIDATE_QUESTION');
  }

  // Contradictions with prior turns (fact slots).
  const currentFacts = extractFacts(text);
  for (const fact of currentFacts) {
    for (const prior of priorTurns) {
      const priorFacts = Array.isArray(prior?.facts) && prior.facts.length ? prior.facts : extractFacts(prior?.answerText || '');
      const clash = priorFacts.find((f) => f.key === fact.key && f.value !== fact.value);
      if (clash) {
        hooks.push({
          id: `hk-ct-${hooks.length + 1}`,
          category: 'CT',
          categoryName: HOOK_CATEGORIES.CT,
          span: { text: `${clash.value} vs ${fact.value}`, sentenceIndex: -1 },
          cues: [{ kind: 'structural', name: 'fact_slot_mismatch', weight: 1 }],
          scores: { dangling: 1, specificity: 1, relevance: 1, resolvability: 1, salience: 1, intent: 1 },
          total: 1,
          position: 'n/a',
          resolvedInAnswer: false,
          guarded: false,
          meta: { a: clash.value, b: fact.value, slot: fact.key, priorQuestionId: prior?.questionId || null },
        });
        reasons.push(`CONTRADICTION:${fact.key}:${clash.value}->${fact.value}`);
      }
    }
  }

  // Candidate hooks per sentence.
  const detectors = [
    ['OL', OL_PATTERNS], ['SU', SU_PATTERNS], ['NE', NE_PATTERNS], ['UC', UC_PATTERNS], ['SD', SD_PATTERNS], ['LS', LS_PATTERNS], ['QR', QR_PATTERNS],
  ];
  for (const sentence of sentences) {
    if (candidateQuestionSentence && sentence.index === candidateQuestionSentence.index) continue;
    const marker = DB_PATTERNS.some((p) => p.test(sentence.text));
    const seenSpans = new Set();
    for (const [code, patterns] of detectors) {
      for (const pattern of patterns) {
        const m = sentence.text.match(pattern);
        if (!m) continue;
        let span = m[0].trim().replace(/[,.;:!?]+$/, '');
        if (code === 'QR' && METHOD_CLAUSE.test(sentence.text)) continue;
        if (code === 'LS' && /\b(something|a lot|so much) (that|about how i (read|handle|write|work)|about myself)?:/.test(sentence.text)) continue;
        if (code === 'NE' && sentence.text.toLowerCase().indexOf(span.toLowerCase()) !== sentence.text.toLowerCase().lastIndexOf(span.toLowerCase())) continue;
        const key = `${code}:${span.toLowerCase()}`;
        if (seenSpans.has(key)) continue;
        if (hooks.some((h) => h.category === code && h.span.sentenceIndex === sentence.index && h.span.text.toLowerCase().includes(span.toLowerCase()))) continue;
        seenSpans.add(key);
        const spanEndsSentence = sentence.text.trim().replace(/[.!?]+$/, '').endsWith(span.replace(/[.!?]+$/, ''));
        const guarded = GUARDED.test(span) || GUARDED.test(sentence.text);
        const dangling = danglingScore(sentence, span, sentences);
        const specificity = specificityScore(span);
        const relevance = relevanceScore(span, question, context);
        const resolvability = resolvabilityFor(code, sentence.text);
        const isLast = sentence.index === sentences.length - 1;
        const salience = salienceScore(sentence, sentences, spanEndsSentence);
        const intent = intentScore(sentence, marker, spanEndsSentence, isLast);
        const resolvedInAnswer = dangling < 0.5;
        let total = WEIGHTS.dangling * dangling + WEIGHTS.specificity * specificity + WEIGHTS.relevance * relevance.value + WEIGHTS.resolvability * resolvability + WEIGHTS.salience * salience + WEIGHTS.intent * intent;
        if (guarded || resolvedInAnswer) total = 0;
        total = Number(total.toFixed(3));
        const meta = {};
        if (code === 'SU') meta.superlative = (span.match(/\b(hardest|toughest|best|worst|most \w+|scariest|proudest)\b/i) || [])[1]?.toLowerCase() || 'hardest';
        if (code === 'QR') {
          const ft = span.match(/from (\w+ )?(\w+) (\w+) to (\w+)/i);
          if (ft) { meta.before = `${ft[2]} ${ft[3]}`; meta.after = ft[4]; }
        }
        const categoryForHook = marker && ['OL', 'NE', 'SU'].includes(code) ? code : code;
        hooks.push({
          id: `hk-${sentence.index + 1}-${hooks.length + 1}`,
          category: categoryForHook,
          categoryName: HOOK_CATEGORIES[categoryForHook],
          markerPresent: marker,
          span: { text: span, sentenceIndex: sentence.index, startChar: sentence.start + Math.max(0, sentence.text.indexOf(span)), endChar: sentence.start + Math.max(0, sentence.text.indexOf(span)) + span.length },
          cues: [{ kind: 'lexical', name: code, weight: 1 }, ...(marker ? [{ kind: 'structural', name: 'DELIBERATE_BAIT_MARKER', weight: 1 }] : [])],
          scores: { dangling, specificity, relevance: relevance.value, resolvability, salience, intent },
          relevanceOverlaps: relevance.overlaps,
          total,
          position: isLast ? 'end' : sentence.index === 0 ? 'start' : 'middle',
          resolvedInAnswer,
          guarded,
          guardReason: guarded ? 'PROTECTED_TOPIC_GUARD' : null,
          meta,
        });
      }
    }
  }

  // Vague claims.
  const vagueClaims = [];
  for (const sentence of sentences) {
    for (const pattern of VC_PATTERNS) {
      const m = sentence.text.match(pattern);
      if (m) vagueClaims.push({ sentence, text: m[0] });
    }
  }
  const examplePromised = EXAMPLE_PRESENT.test(text) || hooks.some((h) => h.category !== 'CT' && h.total >= cfg.followThreshold && !h.guarded);
  if (vagueClaims.length && !examplePromised) {
    const first = vagueClaims[0];
    hooks.push({
      id: `hk-vc-${hooks.length + 1}`,
      category: 'VC',
      categoryName: HOOK_CATEGORIES.VC,
      span: { text: first.text, sentenceIndex: first.sentence.index },
      cues: [{ kind: 'lexical', name: 'VC', weight: 1 }],
      scores: { dangling: 0, specificity: 0, relevance: 0.6, resolvability: 1, salience: 0.5, intent: 0 },
      total: 0,
      position: 'n/a',
      resolvedInAnswer: false,
      guarded: false,
      meta: { claims: vagueClaims.map((c) => c.text) },
    });
    reasons.push('VAGUE_CLAIM_NO_EXAMPLE');
  }

  // Order: CT first, then by total desc, later position wins ties, then relevance.
  const sorted = hooks.slice().sort((a, b) => {
    if (a.category === 'CT' && b.category !== 'CT') return -1;
    if (b.category === 'CT' && a.category !== 'CT') return 1;
    if (b.total !== a.total) return b.total - a.total;
    if (b.span.sentenceIndex !== a.span.sentenceIndex) return b.span.sentenceIndex - a.span.sentenceIndex;
    return b.scores.relevance - a.scores.relevance;
  });
  for (const h of sorted) h.suggestedFollowUp = h.category === 'VC' ? phraseFollowUp(h, { style: context.style, pressure: context.pressure }) : phraseFollowUp(h, { style: context.style, pressure: context.pressure });

  // Decision.
  const depthAvailable = cfg.depthUsedThisQuestion < cfg.maxDepth;
  const timeAvailable = !(Number.isFinite(cfg.remainingReserveMs) && cfg.remainingReserveMs <= cfg.closingReserveMs);
  const phaseAllows = !['CLOSING_INVITE', 'CANDIDATE_QUESTIONS', 'BOUNDED_ANSWER', 'PROFESSIONAL_CLOSE', 'ENDED'].includes(cfg.phase);
  let decision = 'MOVE_ON';
  let primary = null;
  let blockedBy = null;

  const contradiction = sorted.find((h) => h.category === 'CT');
  const strongest = sorted.find((h) => h.category !== 'CT' && h.category !== 'VC' && !h.guarded && h.total >= cfg.followThreshold && h.scores.dangling >= 0.5 && h.scores.relevance >= 0.4);
  const vague = sorted.find((h) => h.category === 'VC');

  if (!phaseAllows) {
    blockedBy = 'PHASE';
    primary = strongest || contradiction || null;
    reasons.push('PHASE_BLOCKS_FOLLOW_UP');
  } else if (contradiction && depthAvailable) {
    decision = 'CLARIFY_CONTRADICTION';
    primary = contradiction;
  } else if (strongest) {
    primary = strongest;
    if (!depthAvailable) { blockedBy = 'DEPTH'; reasons.push('HOOK_DETECTED_DEPTH_EXHAUSTED'); }
    else if (!timeAvailable) { blockedBy = 'TIME'; reasons.push('HOOK_DETECTED_CLOSING_RESERVE'); }
    else { decision = 'FOLLOW_HOOK'; reasons.push(`FOLLOW_HOOK:${primary.category}`); }
  } else if (vague && depthAvailable && timeAvailable) {
    decision = 'PROBE_VAGUE';
    primary = vague;
  } else {
    if (sorted.length) {
      const top = sorted[0];
      if (top.guarded) reasons.push('PROTECTED_TOPIC_GUARD');
      else if (top.resolvedInAnswer) reasons.push('RESOLVED_IN_ANSWER');
      else if (top.scores.relevance < 0.4) reasons.push('IRRELEVANT_TANGENT');
      else if (top.scores.resolvability === 0) reasons.push('UNRESOLVABLE');
      else reasons.push('BELOW_THRESHOLD');
    } else reasons.push('NO_HOOK');
  }

  for (const h of sorted) h.deferred = primary && h !== primary && h.category !== 'VC' && h.category !== 'CT' && h.total >= cfg.followThreshold && !h.guarded;

  if (flags.fillerHeavy) reasons.push('FILLER_HEAVY');
  if (flags.rambling) reasons.push('RECOVER_RAMBLE');
  if (flags.shortAnswer) reasons.push('RECOVER_SHORT');

  return Object.freeze({
    version: HOOK_DETECTOR_VERSION,
    questionId: question?.id || question?.question_id || null,
    hooks: sorted,
    primary,
    decision,
    blockedBy,
    flags,
    reasons,
    sentenceCount: sentences.length,
    wordCount: rawWords,
  });
}

// Did the interviewer take the bait? Lexical overlap between the hook span and the
// interviewer's next question (>= 1 content lemma, or the category's generic probe).
// Protected-topic guard, exposed so the Director never deepens or challenges a guarded answer.
export function isGuardedText(text) { return GUARDED.test(String(text || '')); }

export function evaluateBite(hook, interviewerText) {
  if (!hook || !interviewerText) return { taken: false, overlap: [] };
  const keys = contentKeywords(hook.span.text);
  const toks = tokens(interviewerText);
  const overlap = keys.filter((k) => toks.some((t) => sameKeyword(t, k)));
  const genericProbe = { LS: /\bwhat did you learn\b/i, UC: /\b(how do you know|how did (it|that) (turn out|go)|what made you think)\b/i, QR: /\b(what did you change|how did you (get|pull))\b/i, VC: /\bexample\b/i, SU: /\bwhat made (it|that)\b/i }[hook.category];
  const taken = overlap.length > 0 || (genericProbe ? genericProbe.test(interviewerText) : false);
  return { taken, overlap };
}

// Optional model-assisted scorer — may only reorder existing hook ids and rephrase
// suggestedFollowUp within 25 words without new facts. Anything else is rejected.
export function assistHooks(report, assist) {
  if (!assist || typeof assist !== 'object') return { report, status: 'ASSIST_ABSENT' };
  const ids = new Set(report.hooks.map((h) => h.id));
  const rerank = Array.isArray(assist.rerank) ? assist.rerank : [];
  if (rerank.some((id) => !ids.has(id))) return { report, status: 'ASSIST_REJECTED' };
  const phrasing = assist.phrasing && typeof assist.phrasing === 'object' ? assist.phrasing : {};
  for (const [id, text] of Object.entries(phrasing)) {
    if (!ids.has(id)) return { report, status: 'ASSIST_REJECTED' };
    const words = String(text).trim().split(/\s+/);
    if (words.length > 25 || GUARDED.test(text)) return { report, status: 'ASSIST_REJECTED' };
  }
  const order = new Map(rerank.map((id, i) => [id, i]));
  const hooks = report.hooks.slice().sort((a, b) => (order.has(a.id) ? order.get(a.id) : 1e3) - (order.has(b.id) ? order.get(b.id) : 1e3))
    .map((h) => (phrasing[h.id] ? { ...h, suggestedFollowUp: String(phrasing[h.id]).trim(), assisted: true } : h));
  // Decision and primary never change; only presentation order and wording.
  const primary = report.primary ? hooks.find((h) => h.id === report.primary.id) : null;
  return { report: Object.freeze({ ...report, hooks, primary }), status: 'ASSIST_APPLIED' };
}
