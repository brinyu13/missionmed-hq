import { sha256, sortedUnique } from './canonical.mjs';

const PROMPT = /(?:\?|\b(?:what|which|why|how|where|when|who|name|describe|define|explain|tell me|walk me through|give me|list|compare|differentiate|diagnose|treat|manage)\b)/iu;
const ADMIN = /\b(?:attendance|break|schedule|zoom|microphone|camera|mute|time is it|homework|assignment|page|slide)\b/iu;
const JUMPING = /\bjump(?:ing)?[ -]?in\b/iu;
const GREETING = /^(?:hi|hello|good (?:morning|afternoon|evening)|how are you)\b/iu;
const MEDICAL = /\b(?:anatom|diagnos|treat|patient|symptom|disease|medic(?:al|ation)|drug|dose|blood|heart|lung|kidney|liver|brain|nerve|muscle|bone|pain|fever|infect|cancer|clinical|pathophysi|etiolog|management|therapy|surg|lab|imaging|x-?ray|ct|mri|ultrasound|syndrome|vital|pressure|pulse|respir|cardi|neuro|renal|hepatic|gastro|endocr|immun|hemat|dermat|obstet|gynec|pediatr|psychiatr|differential|viral|bacterial|antibiotic)\w*\b/iu;
const ACK_TAG_ONLY = /^(?:okay|right|good|huh|see)\s*\?$/iu;
const AUDIENCE_SOLICITATION = /^(?:(?:any|more)\s+)?questions?(?:\s*,?\s*(?:anybody|anyone))?(?:\s+else)?\s*\?$/iu;
const ANYBODY_ONLY = /^(?:anybody|anyone)(?:\s+else)?\s*\?$/iu;
const DOCUMENT_NAVIGATION = /\b(?:first|last)\s+sentence\s*\?|\b(?:page|slide)\b.*\?/iu;
const PUNCTUATION_ONLY = /^[\p{P}\p{S}\s]+$/u;
const META_NAVIGATION = /\b(?:where\s+do\s+i|where\s+were\s+we|first\s+sentence|last\s+sentence|page|slide)\b/iu;
const RHETORICAL_TAG = /,\s*(?:okay|right|see|good)\s*\?$/iu;
const LEADING_FILLER = /^(?:(?:okay|good|so|well|um+|uh+|oh|all right|then)[, ]+)+/iu;
const QUESTION_SURFACE = /^(?:what|which|why|how|where|when|who)\b/iu;
const IMPERATIVE_SURFACE = /^(?:name|describe|define|explain|tell\s+me|walk\s+me\s+through|give\s+me|list|compare|differentiate|diagnose|treat|manage)\b/iu;
const OTHERWISE_KNOWN_AS = /^otherwise\s+known\s+as\s*\?$/iu;
const ANSWER_SURFACE = /\b(?:what|which|why|how|where|when|who|name|describe|define|explain|tell\s+me|walk\s+me\s+through|give\s+me|list|compare|differentiate|diagnose|treat|manage)\b/iu;
const EXAM_TARGET = /\b(?:bug|test|finding|presentation|present|mechanism|cause|organism|diagnosis|differential|treatment|management|drug|medication|dose|lab|imaging|sign|symptom|disease|syndrome|patient|clinical|anatomy|physiology|pathology|risk\s+factors?|diffusion|ventilation|perfusion)\w*\b/iu;
const GENERIC_META_QUESTION = /^(?:what\s+do\s+you\s+think|what\s+are\s+we\s+doing|does\s+that\s+make\s+sense|do\s+you\s+understand|you\s+know\s+what\s+i\s+mean)\s*\?$/iu;
const TEACHING_EMBEDDED_WH = /\b(?:explained|discussed|taught|reviewed|said|mentioned)\b[^?]*\b(?:what|which|why|how|where|when|who)\b[^?]*\?$/iu;
const TERMINAL_ANSWER_SLOT = /\b(?:presents?|due\s+to|caused\s+by|treated\s+with|diagnosed\s+by|known\s+as)\s+(?:what|which|why|how|where|when|who)\s*\?$/iu;
const STUDY_CHECK_IN = /\b(?:(?:did|have|are|were|do)\s+you\s+(?:study|studying|review|prepare)|how\s+(?:much|long)\s+did\s+you\s+study|(?:i|we)\s+(?:studied|reviewed|prepared|was\s+studying|were\s+studying)|study\s+session)\b/iu;
const QUESTION_META = /\b(?:how\s+many\s+questions?|more\s+questions?|same\s+question|question\s+number|did\s+i\s+ask|have\s+i\s+asked|compare\s+(?:these|the)\s+questions?|how\s+(?:am\s+i|are\s+you)\s+doing|did\s+i\s+get\s+this|was\s+that\s+better|performance|score)\b/iu;
const KNOWLEDGE_CHECK = /\b(?:(?:do|did)\s+you\s+know|are\s+you\s+sure\s+you\s+know)\s+(?:the\s+)?(?:diagnosis|answer)\b/iu;
const ANSWER_META = /\b(?:right\s+answer|correct\s+answer|is\s+that\s+(?:right|correct)|am\s+i\s+right)\b/iu;
const AUXILIARY_QUESTION_SURFACE = /^(?:is|are|was|were|do|does|did|can|could|would|should|will|has|have|had)\b/iu;
const GENERIC_CONFIRMATION_QUESTION = /^(?:is|are|was|were|do|does|did|can|could|would|should|will|has|have|had)\s+(?:that|this|it|you|we)\s+(?:okay|right|correct|good|clear|fine|true)\s*\?$/iu;
const TERMINAL_WH_SLOT = /\b(?:what|which|why|how|where|when|who)\s*\?$/iu;
const VIGNETTE_META = /\b(?:where\s+(?:are|were)\s+(?:we|you)\s+in\s+(?:this|the)\s+vignette|(?:what|which)\s+(?:part|line|sentence|word|clue)\s+(?:in|of)\s+(?:this|the)\s+vignette)\b/iu;
const RHETORICAL_PATHOLOGY_CHANGE = /\b(?:change|changing)\b[^?]*\b(?:vignette|pathology|diagnosis)\b[^?]*\?$/iu;
const VIGNETTE_COACHING_META = /\b(?:vignette|case|stem)\b[^?]{0,100}\b(?:part|line|sentence|word|clue|position|place|point|read|looking|give(?:s|n)?\s+away|tell(?:s)?\s+you)\b|\b(?:part|line|sentence|word|clue|position|place|point|read|looking|give(?:s|n)?\s+away|tell(?:s)?\s+you)\b[^?]{0,100}\b(?:vignette|case|stem)\b/iu;
const DEMOGRAPHIC_COACHING_META = /\b(?:age|sex|gender|race|ethnicity|demographic)\b[^?]{0,90}\b(?:clue|give(?:s|n)?\s+away|matter\s+for\s+(?:this|the)\s+(?:question|stem|vignette)|tell(?:s)?\s+you\s+(?:where|what|which))\b/iu;
const SESSION_OR_DRILL_LOGISTICS = /\b(?:how\s+many\s+(?:more\s+)?(?:questions?|drills?|cases?)|(?:finish|get\s+through|do)\s+(?:all\s+)?(?:the\s+)?(?:questions?|drills?|cases?)|(?:next|last)\s+(?:question|drill|session)|(?:question|drill|session)\s+(?:count|number)|(?:when|what\s+time)\b[^?]{0,50}\b(?:break|finish|done))\b/iu;
const SCHOOL_REVIEW_PLANNING = /\b(?:school|class|study\s+session|review\s+session)\b[^?]{0,80}\b(?:today|tomorrow|later|next|plan|planning|going\s+to|want\s+to|need\s+to|start|finish)\b|\b(?:today|tomorrow|later|next|plan|planning|going\s+to|want\s+to|need\s+to|start|finish)\b[^?]{0,80}\b(?:school|class|study\s+session|review\s+session)\b/iu;
const GARBLED_STUDENT_SELECTION = /\bwho\s+was\s+me\s+too\b/iu;
const QUESTION_SET_ACTIVITY_META = /\bwhat\s+questions?\s+(?:are|were|do|did|will)\s+you\s+(?:doing|do|study|studying|review|reviewing)\b/iu;
const SENTENCE_METACOGNITIVE_COACHING = /\b(?:first|opening|initial)\s+sentence\b[^?]{0,180}\b(?:what\s+do\s+i\s+know|have\s+to\s+know|know\s+what\s+it\s+is|pushing\s+too\s+hard)\b|\b(?:what\s+do\s+i\s+know|have\s+to\s+know|know\s+what\s+it\s+is|pushing\s+too\s+hard)\b[^?]{0,180}\b(?:first|opening|initial)\s+sentence\b/iu;
const DEMOGRAPHIC_TOUGHNESS_RHETORIC = /\b(?:guy|man|male|woman|female|farmer)\b[^?]{0,100}\b(?:tough|strong)\s+(?:guy|man|person)\b/iu;
const SELF_REFERENTIAL_CONVERSATIONAL_RHETORIC = /\bwhy\s+did\s+i\b[^?]{0,120}\b(?:go\s+through\s+(?:this|that)\s+craziness|this\s+craziness)\b/iu;

function normalizedWords(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase('en-US').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/u).filter(Boolean);
}

export function ineligiblePromptCategory(text) {
  const value = String(text ?? '').normalize('NFC').trim();
  if (!value) return null;
  if (PUNCTUATION_ONLY.test(value)) return 'NONMEDICAL_INSTRUCTION';
  if (ACK_TAG_ONLY.test(value)) return 'BANTER';
  if (AUDIENCE_SOLICITATION.test(value) || ANYBODY_ONLY.test(value) || DOCUMENT_NAVIGATION.test(value)) return 'ADMINISTRATION';
  return null;
}

export function classifyFullSourceExclusion(text) {
  const original = String(text ?? '').normalize('NFC').trim();
  if (STUDY_CHECK_IN.test(original)) return { eligible: false, category: 'NONMEDICAL_INSTRUCTION', basis: 'KNOWLEDGE_OR_STUDY_CHECK' };
  if (QUESTION_META.test(original) || SESSION_OR_DRILL_LOGISTICS.test(original)) return { eligible: false, category: 'ADMINISTRATION', basis: SESSION_OR_DRILL_LOGISTICS.test(original) ? 'SESSION_OR_DRILL_LOGISTICS' : 'QUESTION_COUNT_OR_COMPARISON_META' };
  if (VIGNETTE_META.test(original) || VIGNETTE_COACHING_META.test(original)) return { eligible: false, category: 'ADMINISTRATION', basis: VIGNETTE_COACHING_META.test(original) ? 'VIGNETTE_COACHING_META' : 'VIGNETTE_POSITION_META' };
  if (DEMOGRAPHIC_COACHING_META.test(original)) return { eligible: false, category: 'BANTER', basis: 'DEMOGRAPHIC_COACHING_META' };
  if (SCHOOL_REVIEW_PLANNING.test(original)) return { eligible: false, category: 'NONMEDICAL_INSTRUCTION', basis: 'SCHOOL_REVIEW_PLANNING' };
  if (GARBLED_STUDENT_SELECTION.test(original)) return { eligible: false, category: 'ADMINISTRATION', basis: 'GARBLED_STUDENT_SELECTION' };
  if (QUESTION_SET_ACTIVITY_META.test(original)) return { eligible: false, category: 'NONMEDICAL_INSTRUCTION', basis: 'QUESTION_SET_ACTIVITY_META' };
  if (SENTENCE_METACOGNITIVE_COACHING.test(original)) return { eligible: false, category: 'ADMINISTRATION', basis: 'SENTENCE_METACOGNITIVE_COACHING' };
  if (DEMOGRAPHIC_TOUGHNESS_RHETORIC.test(original)) return { eligible: false, category: 'BANTER', basis: 'DEMOGRAPHIC_TOUGHNESS_RHETORIC' };
  if (SELF_REFERENTIAL_CONVERSATIONAL_RHETORIC.test(original)) return { eligible: false, category: 'BANTER', basis: 'SELF_REFERENTIAL_CONVERSATIONAL_RHETORIC' };
  return null;
}

export function classifyPromptEligibility(text, { accepted_student_names = [], has_prior_eligible_question = false, active_student_sequence = false } = {}) {
  const original = String(text ?? '').normalize('NFC').trim();
  if (META_NAVIGATION.test(original)) return { eligible: false, category: 'ADMINISTRATION', basis: 'META_NAVIGATION' };
  const terminal = original.match(/(?:^|[.!]\s+)([^.!?]+\?)$/u);
  const screened = terminal?.[1]?.trim() ?? original;
  const exactCategory = ineligiblePromptCategory(screened);
  if (exactCategory) return { eligible: false, category: exactCategory, basis: 'EXACT_FORBIDDEN_CLASS' };
  const stripped = screened.replace(LEADING_FILLER, '').trim();
  if (GENERIC_META_QUESTION.test(stripped)) return { eligible: false, category: 'NONMEDICAL_INSTRUCTION', basis: 'GENERIC_META_QUESTION' };
  if (STUDY_CHECK_IN.test(original) || KNOWLEDGE_CHECK.test(original)) return { eligible: false, category: 'NONMEDICAL_INSTRUCTION', basis: 'KNOWLEDGE_OR_STUDY_CHECK' };
  if (QUESTION_META.test(original)) return { eligible: false, category: 'ADMINISTRATION', basis: 'QUESTION_COUNT_OR_COMPARISON_META' };
  if (VIGNETTE_META.test(original)) return { eligible: false, category: 'ADMINISTRATION', basis: 'VIGNETTE_POSITION_META' };
  if (VIGNETTE_COACHING_META.test(original)) return { eligible: false, category: 'ADMINISTRATION', basis: 'VIGNETTE_COACHING_META' };
  if (DEMOGRAPHIC_COACHING_META.test(original)) return { eligible: false, category: 'BANTER', basis: 'DEMOGRAPHIC_COACHING_META' };
  if (SESSION_OR_DRILL_LOGISTICS.test(original)) return { eligible: false, category: 'ADMINISTRATION', basis: 'SESSION_OR_DRILL_LOGISTICS' };
  if (SCHOOL_REVIEW_PLANNING.test(original)) return { eligible: false, category: 'NONMEDICAL_INSTRUCTION', basis: 'SCHOOL_REVIEW_PLANNING' };
  if (RHETORICAL_PATHOLOGY_CHANGE.test(original)) return { eligible: false, category: 'BANTER', basis: 'RHETORICAL_PATHOLOGY_CHANGE' };
  if (ANSWER_META.test(original)) return { eligible: false, category: 'BANTER', basis: 'GENERIC_ANSWER_META' };
  if (GENERIC_CONFIRMATION_QUESTION.test(stripped)) return { eligible: false, category: 'BANTER', basis: 'GENERIC_CONFIRMATION_QUESTION' };
  const nameComparable = stripped.replace(/[\p{P}\p{S}]+/gu, '').replace(/\s+/gu, ' ').trim();
  if (accepted_student_names.some((name) => nameComparable.localeCompare(String(name), 'en-US', { sensitivity: 'base' }) === 0)) {
    return { eligible: false, category: 'BANTER', basis: 'NAME_ONLY_VOCATIVE' };
  }
  if (RHETORICAL_TAG.test(original)) return { eligible: false, category: 'BANTER', basis: 'ASSERTION_RHETORICAL_TAG' };
  if (TEACHING_EMBEDDED_WH.test(original)) return { eligible: false, category: 'TEACHING_STATEMENT', basis: 'DECLARATIVE_TEACHING_WITH_EMBEDDED_WH' };
  const originalWords = normalizedWords(original);
  if (active_student_sequence && stripped.endsWith('?') && TERMINAL_ANSWER_SLOT.test(stripped) && (MEDICAL.test(stripped) || EXAM_TARGET.test(stripped))) {
    return { eligible: true, basis: 'TERMINAL_CLINICAL_ANSWER_SLOT' };
  }
  if (active_student_sequence && original.endsWith('?') && TERMINAL_WH_SLOT.test(original) && originalWords.length >= 2) {
    return { eligible: true, basis: 'TERMINAL_ELLIPTICAL_ANSWER_SLOT' };
  }
  const surfaceMatch = ANSWER_SURFACE.exec(stripped);
  let candidate = stripped;
  if (surfaceMatch && surfaceMatch.index > 0) {
    const prefix = stripped.slice(0, surfaceMatch.index);
    const prefixWords = normalizedWords(prefix);
    const boundedPrefix = prefix.length <= 120 && prefixWords.length <= 12
      && (/[,.:;!\-–—]\s*$/u.test(prefix) || /^[\p{S}\s]+$/u.test(prefix));
    if (!boundedPrefix && !(active_student_sequence && stripped.endsWith('?'))) return { eligible: false, category: 'TEACHING_STATEMENT', basis: 'UNBOUNDED_DECLARATIVE_PREFIX' };
    candidate = stripped.slice(surfaceMatch.index).trim();
  }
  const startsAnswerSurface = QUESTION_SURFACE.test(candidate) || IMPERATIVE_SURFACE.test(candidate) || OTHERWISE_KNOWN_AS.test(candidate);
  const words = normalizedWords(candidate);
  if (words.length <= 1 && !MEDICAL.test(candidate)) return { eligible: false, category: 'NONMEDICAL_INSTRUCTION', basis: 'SINGLE_TOKEN_FRAGMENT' };
  if (OTHERWISE_KNOWN_AS.test(candidate)) return { eligible: true, basis: 'EXPLICIT_ANSWER_TARGET_SURFACE' };
  if (/^what\s+else\s*\?$/iu.test(candidate)) {
    return has_prior_eligible_question
      ? { eligible: true, basis: 'CONTEXTUAL_ANSWER_TARGET_SURFACE' }
      : { eligible: false, category: 'NONMEDICAL_INSTRUCTION', basis: 'UNANCHORED_CONTEXT_FRAGMENT' };
  }
  const hasQuestionMark = candidate.endsWith('?');
  if (hasQuestionMark && /\bor\b/iu.test(candidate) && MEDICAL.test(candidate)) return { eligible: true, basis: 'BINARY_CLINICAL_ALTERNATIVE' };
  if (hasQuestionMark && MEDICAL.test(candidate)) return { eligible: true, basis: 'MEDICAL_DIRECT_QUESTION' };
  if (active_student_sequence && hasQuestionMark && AUXILIARY_QUESTION_SURFACE.test(candidate) && words.length >= 3) return { eligible: true, basis: 'AUXILIARY_OR_BINARY_ANSWER_TARGET' };
  const auxiliaryIndex = words.findIndex((word) => ['is', 'are', 'was', 'were', 'do', 'does', 'did', 'can', 'could', 'would', 'should', 'will', 'has', 'have', 'had'].includes(word));
  const lexicalContentCount = words.filter((word) => !['the', 'a', 'an', 'this', 'that', 'it', 'you', 'we', 'they', 'he', 'she', 'of', 'to', 'in', 'on', 'for', 'with', 'and', 'or', 'is', 'are', 'was', 'were', 'do', 'does', 'did', 'can', 'could', 'would', 'should', 'will', 'has', 'have', 'had'].includes(word)).length;
  if (active_student_sequence && hasQuestionMark && auxiliaryIndex >= 0 && auxiliaryIndex <= 3 && lexicalContentCount >= 2) return { eligible: true, basis: 'ELLIPTICAL_COPULAR_OR_AUXILIARY_TARGET' };
  if (active_student_sequence && hasQuestionMark && EXAM_TARGET.test(candidate) && words.length >= 2) return { eligible: true, basis: 'ELLIPTICAL_EXAM_NOUN_PHRASE' };
  if (startsAnswerSurface) {
    const targetWords = words.filter((word, index) => !(index === 0 && ['what', 'which', 'why', 'how', 'where', 'when', 'who', 'name', 'describe', 'define', 'explain', 'tell', 'walk', 'give', 'list', 'compare', 'differentiate', 'diagnose', 'treat', 'manage'].includes(word)) && !['is', 'are', 'do', 'does', 'did', 'the', 'a', 'an', 'as', 'me', 'through'].includes(word));
    if (targetWords.length > 0 && (hasQuestionMark || (words.length <= 12 && (MEDICAL.test(candidate) || EXAM_TARGET.test(candidate))))) return { eligible: true, basis: hasQuestionMark ? 'EXPLICIT_ANSWER_TARGET_SURFACE' : 'BOUNDED_ORAL_EXAM_TARGET' };
  }
  return { eligible: false, category: hasQuestionMark ? 'NONMEDICAL_INSTRUCTION' : 'TEACHING_STATEMENT', basis: hasQuestionMark ? 'NO_CONTENT_BEARING_ANSWER_TARGET' : 'ASSERTION_WITH_EMBEDDED_PROMPT_TOKEN' };
}

function isExactInstructor(record, aliases) {
  const speaker = String(record.speaker ?? '').trim();
  return aliases.some((alias) => speaker.localeCompare(alias, 'en-US', { sensitivity: 'base' }) === 0)
    || /^(?:dr\.?\s*j|doctor\s*j)$/iu.test(speaker);
}

export function resolveInstructor(records, aliases = ['Dr. J', 'Dr J'], acceptedStudentNames = []) {
  const exact = records.find((record) => isExactInstructor(record, aliases));
  if (exact) return { label: String(exact.speaker).trim(), speaker_class: 'DR_J', authority_class: 'INSTRUCTOR', inferred: false };
  const counts = new Map();
  for (const record of records) {
    const label = String(record.speaker ?? '').normalize('NFC').trim();
    if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const unknown = [...counts.entries()].find(([label]) => /^unknown$/iu.test(label));
  if (!unknown) return null;
  const ranked = [...counts.values()].sort((a, b) => b - a);
  const unknownTurns = records.filter((record) => String(record.speaker ?? '').localeCompare(unknown[0], 'en-US', { sensitivity: 'base' }) === 0);
  const namedCalls = unknownTurns.map((record) => studentCall(String(record.text ?? ''), acceptedStudentNames)).filter(Boolean);
  const alternatingNamedAnswers = records.some((record, index) => {
    if (!studentCall(String(record.text ?? ''), acceptedStudentNames) || !isSameSpeaker(record, unknown[0])) return false;
    const next = records[index + 1];
    return next && !isSameSpeaker(next, unknown[0]) && acceptedStudentNames.some((name) => String(next.speaker ?? '').toLocaleLowerCase('en-US').startsWith(name.toLocaleLowerCase('en-US')));
  });
  const promptCount = unknownTurns.filter((record) => PROMPT.test(String(record.text ?? ''))).length;
  const medicalPromptCount = unknownTurns.filter((record) => PROMPT.test(String(record.text ?? '')) && MEDICAL.test(String(record.text ?? ''))).length;
  const convergent = namedCalls.length > 0 && alternatingNamedAnswers && medicalPromptCount > 0;
  const dominant = unknown[1] > records.length / 2 && unknown[1] > 5 * (ranked[1] ?? 0);
  return dominant && promptCount / unknown[1] >= 0.25 && convergent
    ? { label: unknown[0], speaker_class: 'PROBABLE_DR_J', authority_class: 'INFERRED_INSTRUCTOR_AMBIGUOUS', inferred: true }
    : null;
}

function isSameSpeaker(record, label) {
  return String(record.speaker ?? '').trim().localeCompare(label, 'en-US', { sensitivity: 'base' }) === 0;
}

function isResolvedInstructor(record, resolution, aliases) {
  return Boolean(resolution) && (resolution.inferred ? isSameSpeaker(record, resolution.label) : isExactInstructor(record, aliases));
}

function studentCall(text, names) {
  for (const name of [...names].sort((a, b) => b.length - a.length)) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const match = text.match(new RegExp(`(?:^|[.!?]\\s+|(?:okay|all right)[, ]+)(${escaped})(?:[, :]|\\b)`, 'iu'));
    if (match) return { alias: name, start: match.index, end: match.index + match[0].length };
  }
  return null;
}

function questionParts(text, offset = 0) {
  const parts = [];
  const questionPattern = /[^?]+\?/gu;
  for (const match of text.matchAll(questionPattern)) {
    const leading = match[0].match(/^\s*/u)?.[0].length ?? 0;
    const value = match[0].trim();
    const codepointStart = [...text.slice(0, match.index + leading)].length;
    const codepointEnd = [...text.slice(0, match.index + match[0].length)].length;
    if (value) {
      const terminal = value.match(/(?:^|[.!]\s+)([^.!?]+\?)$/u);
      const screeningText = terminal?.[1]?.trim() ?? value;
      const screeningCodepointOffset = terminal ? [...value.slice(0, terminal.index + terminal[0].length - terminal[1].length)].length : 0;
      parts.push({ text: value, screening_text: screeningText, start: offset + codepointStart, end: offset + codepointEnd, screening_start: offset + codepointStart + screeningCodepointOffset, screening_end: offset + codepointEnd });
    }
  }
  if (parts.length === 0 && PROMPT.test(text) && text.trim()) {
    const leading = [...(text.match(/^\s*/u)?.[0] ?? '')].length;
    parts.push({ text: text.trim(), screening_text: text.trim(), start: offset + leading, end: offset + [...text].length, screening_start: offset + leading, screening_end: offset + [...text].length });
  }
  return parts;
}

function binding(record, part = null) {
  const text = record.text ?? '';
  const start = part?.start ?? 0;
  const end = part?.end ?? [...text].length;
  return {
    record_ordinal: record.record_ordinal,
    segment_start_us: record.start_us ?? 0,
    segment_end_us: record.end_us,
    text_codepoint_start: start,
    text_codepoint_end: end,
    raw_record_hash: record.raw_record_hash,
    text_hash: record.text_hash,
    selected_text_hash: sha256([...text].slice(start, end).join('')),
  };
}

export function detectGoldCandidates(records, options = {}) {
  const instructorAliases = options.instructor_aliases ?? ['Dr. J', 'Dr J'];
  const acceptedStudentNames = options.accepted_student_names ?? [];
  const instructorResolution = resolveInstructor(records, instructorAliases, acceptedStudentNames);
  const nonInstructorLabels = [...new Set(records.filter((record) => !isResolvedInstructor(record, instructorResolution, instructorAliases)).map((record) => String(record.speaker ?? '').normalize('NFC').trim()).filter(Boolean))];
  const implicitSingleStudent = instructorResolution && !instructorResolution.inferred && nonInstructorLabels.length === 1 ? nonInstructorLabels[0] : null;
  const sequences = [];
  const excluded = [];
  const jumpingSpans = [];
  let jumpingAnswerExchangeCount = 0;
  let jumpingActive = false;
  let current = null;

  const finish = () => {
    if (!current) return;
    if (current.questions.length > 0) sequences.push(current);
    else excluded.push({ category: 'NONMEDICAL_INSTRUCTION', bindings: current.call_bindings });
    current = null;
  };

  for (const record of records) {
    const text = String(record.text ?? '').normalize('NFC').trim();
    if (!text) continue;
    const instructor = isResolvedInstructor(record, instructorResolution, instructorAliases);
    if (instructor && JUMPING.test(text)) {
      jumpingActive = true;
      jumpingSpans.push(binding(record));
      excluded.push({ category: 'JUMPING_IN', bindings: [binding(record)] });
      continue;
    }
    if (instructor) {
      const call = studentCall(text, acceptedStudentNames);
      if (call) {
        if (current?.questions.at(-1) && current.questions.at(-1).answers.length === 0) current.questions.at(-1).interrupted = true;
        jumpingActive = false;
        finish();
        current = { called_student_alias: call.alias, call_bindings: [binding(record)], questions: [], medical_context: false, roster_match_status: instructorResolution.inferred ? 'AMBIGUOUS_NAME' : 'EXACT_ACCEPTED_NAME', sequence_basis_codes: instructorResolution.inferred ? ['DOMINANT_UNKNOWN_INSTRUCTOR_INFERENCE', 'EXPLICIT_STUDENT_NAME_PROMPT'] : ['EXACT_ACCEPTED_NAME', 'EXPLICIT_STUDENT_NAME_PROMPT'], ambiguity_flags: instructorResolution.inferred ? ['INSTRUCTOR_DIARIZATION_INFERRED'] : [], speaker_class: instructorResolution.speaker_class, speaker_authority_class: instructorResolution.authority_class };
      }
      const remainderCodeUnitOffset = call?.end ?? 0;
      const remainderOffset = [...text.slice(0, remainderCodeUnitOffset)].length;
      const remainder = text.slice(remainderCodeUnitOffset).trim();
      if (ADMIN.test(remainder) || GREETING.test(remainder)) {
        excluded.push({ category: ADMIN.test(remainder) ? 'ADMINISTRATION' : 'GREETING', bindings: [binding(record)] });
        continue;
      }
      const ineligibleCategory = ineligiblePromptCategory(remainder || text);
      if (ineligibleCategory) {
        excluded.push({ category: ineligibleCategory, bindings: [binding(record)] });
        continue;
      }
      if (!current && implicitSingleStudent && PROMPT.test(remainder) && !ADMIN.test(remainder) && !GREETING.test(remainder)) {
        current = { called_student_alias: implicitSingleStudent, call_bindings: [binding(record)], questions: [], medical_context: false, roster_match_status: 'AMBIGUOUS_NAME', sequence_basis_codes: ['IMPLICIT_SINGLE_STUDENT_SESSION', 'NO_EXPLICIT_NAME_CALL'], ambiguity_flags: ['IMPLICIT_SESSION_SEQUENCE'], speaker_class: instructorResolution.speaker_class, speaker_authority_class: instructorResolution.authority_class };
      }
      if (current && PROMPT.test(remainder)) {
        for (const part of questionParts(text.slice(remainderCodeUnitOffset), remainderOffset)) {
          const eligibilityOptions = { accepted_student_names: acceptedStudentNames, has_prior_eligible_question: current.questions.length > 0, active_student_sequence: true };
          const fullSourceExclusion = classifyFullSourceExclusion(part.text);
          const eligibility = fullSourceExclusion ?? classifyPromptEligibility(part.screening_text, eligibilityOptions);
          if (!eligibility.eligible) {
            excluded.push({ category: eligibility.category, bindings: [binding(record, { ...part, start: part.screening_start, end: part.screening_end })], basis: eligibility.basis });
            continue;
          }
          const medical = MEDICAL.test(part.text) || options.medical_context === true
            || (options.medical_terms ?? []).some((term) => part.text.toLocaleLowerCase('en-US').includes(String(term).toLocaleLowerCase('en-US')));
          if (medical) current.medical_context = true;
          current.questions.push({
            text: part.text,
            eligibility_binding: binding(record, { ...part, start: part.screening_start, end: part.screening_end }),
            eligibility_clause_codepoint_start: part.screening_start - part.start,
            eligibility_clause_codepoint_end: part.screening_end - part.start,
            eligibility_basis: eligibility.basis,
            start_us: record.start_us ?? 0,
            end_us: record.end_us ?? record.start_us ?? 0,
            binding: binding(record, part),
            form: part.text.endsWith('?') ? 'DIRECT_INTERROGATIVE' : 'IMPERATIVE_MEDICAL_PROMPT',
            answers: [],
            medical_status: medical && !instructorResolution.inferred && current.ambiguity_flags.length === 0 ? 'RETAINED' : 'AMBIGUOUS_RETAINED_QUARANTINED',
          });
        }
      } else if (!call && PROMPT.test(text)) {
        excluded.push({ category: 'TEACHING_STATEMENT', bindings: [binding(record)] });
      } else if (!call && (MEDICAL.test(text) || current?.medical_context)) {
        if (current?.questions.at(-1) && current.questions.at(-1).answers.length === 0) current.questions.at(-1).self_answer = true;
        excluded.push({ category: 'TEACHING_STATEMENT', bindings: [binding(record)] });
      }
      continue;
    }
    if (jumpingActive) {
      jumpingSpans.push(binding(record));
      jumpingAnswerExchangeCount += 1;
      excluded.push({ category: 'JUMPING_IN', bindings: [binding(record)] });
      continue;
    }
    if (PROMPT.test(text)) {
      excluded.push({ category: 'LEARNER_QUESTION', bindings: [binding(record)] });
    } else if (current && current.questions.length > 0) {
      current.questions.at(-1).answers.push({
        speaker_alias: record.speaker || 'UNKNOWN',
        start_us: record.start_us ?? current.questions.at(-1).end_us,
        end_us: record.end_us ?? record.start_us ?? current.questions.at(-1).end_us,
        binding: binding(record),
      });
    } else excluded.push({ category: 'LEARNER_STATEMENT', bindings: [binding(record)] });
  }
  finish();
  return {
    sequences,
    excluded,
    jumping: {
      detected: jumpingSpans.length > 0,
      decision: jumpingSpans.length > 0 ? 'EXCLUDED' : 'NOT_DETECTED',
      spans: jumpingSpans,
      excluded_answer_exchange_count: jumpingAnswerExchangeCount,
      basis_codes: sortedUnique(jumpingSpans.length ? ['EXPLICIT_JUMPING_IN_PHRASE', 'FAIL_CLOSED_EXCLUSION'] : ['NO_EXPLICIT_JUMPING_IN_PHRASE']),
    },
    instructor_resolution: instructorResolution,
  };
}

const ORDINARY_ALIAS = new Set(['answer', 'break', 'doctor', 'first', 'hello', 'okay', 'right', 'student', 'there', 'what', 'when', 'where', 'which', 'who', 'why']);

export function deriveAcceptedStudentNames(records, instructorAliases = ['Dr. J', 'Dr J']) {
  const labels = new Set();
  for (const record of records) {
    const label = String(record.speaker ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim();
    if (!label || isExactInstructor(record, instructorAliases) || /^unknown$/iu.test(label)) continue;
    labels.add(label);
    const first = label.split(' ')[0];
    if (first.length >= 3 && !ORDINARY_ALIAS.has(first.toLocaleLowerCase('en-US'))) labels.add(first);
  }
  return [...labels].sort((a, b) => a.localeCompare(b, 'en-US'));
}
