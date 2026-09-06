import { ValidationError } from './errors.js';
import { deepFreeze, hashValue, sha256 } from './value-utils.js';

const BLOCKED_PATTERNS = deepFreeze([
  {
    code: 'PATIENT_IDENTIFIER',
    pattern: /\b(?:mrn|medical\s+record\s+(?:number|#)|patient\s+(?:name|id)|date\s+of\s+birth|dob)\s*[:#-]?\s*[a-z0-9/-]+/iu,
  },
  { code: 'PATIENT_IDENTIFIER', pattern: /\b\d{3}-\d{2}-\d{4}\b/u },
  { code: 'PATIENT_IDENTIFIER', pattern: /\bpatient\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/u },
  {
    code: 'RANKING_OR_SUPERLATIVE',
    pattern: /\b(?:best|greatest|finest|unmatched|unparalleled|number\s+one|#1|top\s+\d+(?:\.\d+)?\s*%|among\s+the\s+top)\b/iu,
  },
  {
    code: 'PROMPT_INJECTION',
    pattern: /(?:ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions|reveal\s+(?:the\s+)?system\s+prompt|developer\s+message|system\s+message|jailbreak|<\|(?:system|assistant|user)\|>)/iu,
  },
]);

/**
 * DR-119 clause 8 - the grounding invariant.
 *
 * The letter is NOT required to equal its claims. LOR Studio is an AI-assisted
 * letter-writing product, so the model may compose salutations, transitions,
 * paragraph structure, rhetorical framing, synthesis and closings. The governing
 * invariant is instead:
 *
 *   EVERY MATERIAL FACTUAL ASSERTION MUST BE GROUNDED IN APPROVED SOURCE MATERIAL.
 *
 * A proposal is therefore an ordered sequence of explicitly typed segments:
 *
 *   { kind: 'factual',    text, supportIds: [...], separator? }
 *   { kind: 'connective', text, separator? }
 *
 * A FACTUAL segment carries provenance and must be affirmatively entailed by the
 * approved facts it cites. Referential existence of a supportId is NEVER treated
 * as factual support. A CONNECTIVE segment carries no provenance, and therefore
 * must be PROVABLY non-factual - not merely un-suspicious. It is screened by a
 * closed ALLOWLIST of genuinely non-factual letter furniture (salutations,
 * valedictions, explicit transitions, and recommendation/opinion statements that
 * assert nothing about the subject's history). Anything outside that allowlist is
 * a MATERIAL FACTUAL ASSERTION and must be moved into a factual segment where it
 * acquires provenance and entailment. Default deny.
 *
 * The rendered letter must be exactly the composition of its segments, so no
 * prose can reach the reader without passing one of those two gates.
 */
export const GROUNDING_MODEL_VERSION = 'missionmed.lor.grounding-model.v1';

export const SEGMENT_KINDS = deepFreeze(['factual', 'connective']);

/** Separator placed BEFORE a segment when composing the letter. Index 0 has none. */
export const SEGMENT_SEPARATORS = deepFreeze({
  paragraph: '\n\n',
  line: '\n',
  inline: ' ',
});

export const DEFAULT_SEGMENT_SEPARATOR = 'paragraph';

export const ENTAILMENT_STATUS = deepFreeze({
  ENTAILED: 'ENTAILED',
  NOT_ENTAILED: 'NOT_ENTAILED',
  UNAVAILABLE: 'UNAVAILABLE',
});

const LIMITS = deepFreeze({
  proposalTextMax: 40000,
  segmentTextMax: 4000,
  segmentsMax: 400,
  supportIdsMax: 32,
  approvedFactsMax: 500,
});

/**
 * SECONDARY denylist for CONNECTIVE prose.
 *
 * This list is NOT the gate. A denylist over natural language is an unbounded
 * surface: it enumerates surface forms ('publication' but not 'published') and
 * therefore admits by default, which is exactly backwards for a safety control.
 * The gate is `CONNECTIVE_ALLOWED_FORMS` below, which admits nothing it cannot
 * prove is non-factual.
 *
 * These rules are kept only as defence in depth and to give operators specific,
 * actionable finding codes. They are deliberately over-inclusive: a false
 * positive costs a regeneration; a false negative ships a fabricated fact in a
 * letter a residency program will rely on. Extend via `additionalConnectiveRules`
 * - note that additional rules can only ever DENY more, never admit more.
 */
export const CONNECTIVE_ASSERTION_RULES = deepFreeze([
  {
    code: 'SUPERLATIVE',
    pattern: /\b(?:most|least|best|worst|finest|greatest|strongest|weakest|top|foremost|premier|exceptional(?:ly)?|outstanding)\b/iu,
  },
  {
    code: 'COMPARATIVE',
    pattern: /\b(?:more|less|fewer|greater|better|worse|stronger|weaker|higher|lower|superior|inferior|rarer|equal(?:led)?)\b/iu,
  },
  {
    code: 'COMPARATIVE',
    pattern: /\b(?:than|compared\s+(?:to|with)|relative\s+to|in\s+contrast\s+to|percentile|rank(?:s|ed|ing)?|cohort|peers?|classmates?)\b/iu,
  },
  { code: 'QUANTITY', pattern: /\d/u },
  {
    code: 'QUANTITY',
    pattern: /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|(?:thir|four|fif|six|seven|eigh|nine)teen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundreds?|thousands?|millions?|billions?|dozens?|scores?|several|numerous|countless|many|multiple|few|every|each|all|both|half|most\s+of|much\s+of|majority|minority|per\s?cent(?:age)?)\b/iu,
  },
  {
    code: 'FREQUENCY_CLAIM',
    pattern: /\b(?:always|never|consistently|invariably|routinely|repeatedly|uniformly|without\s+exception|every\s+time|on\s+each\s+occasion)\b/iu,
  },
  {
    code: 'NAMED_INSTITUTION',
    pattern: /\b(?:university|college|hospital|clinic|institute|medical\s+cent(?:er|re)|medical\s+school|school\s+of\s+medicine|department\s+of|program\s+in|cent(?:er|re)\s+for|residency|fellowship|clerkship|rotation|elective|sub-?internship|externship)\b/iu,
  },
  {
    code: 'TEMPORAL_CLAIM',
    pattern: /\b(?:january|february|march|april|may|june|july|august|september|october|november|december|spring|summer|autumn|fall|winter|academic\s+year|semester|quarter|yesterday)\b/iu,
  },
  {
    code: 'TEMPORAL_CLAIM',
    pattern: /\b(?:last|past|previous|current|recent(?:ly)?|this)\s+(?:year|month|week|term|semester|rotation|block|cycle|season)\b/iu,
  },
  {
    code: 'ATTRIBUTED_OBSERVATION',
    pattern: /\bI\s+(?:have\s+)?(?:observed|supervised|witnessed|watched|precepted|mentored|taught|trained|known|met|treated|examined|reviewed|evaluated|assessed|saw|worked\s+with|rounded\s+with)\b/iu,
  },
  {
    code: 'ATTRIBUTED_OBSERVATION',
    pattern: /\b(?:she|he|they|the\s+(?:student|applicant|candidate|learner))\s+(?:performed|demonstrated|showed|exhibited|completed|achieved|led|managed|diagnosed|presented|published|volunteered|rotated|served|attended|arrived|handled|conducted|authored|received|earned|won|founded|organi[sz]ed|assisted|delivered|cared|followed|identified|recogni[sz]ed)\b/iu,
  },
  {
    code: 'CREDENTIAL_OR_OUTCOME',
    pattern: /\b(?:award(?:s|ed)?|honou?r(?:s|ed)?|prize|scholarship|publication|manuscript|abstract|poster|grant|thesis|degree|board\s+(?:score|certification)|step\s+\d|honor\s+society|dean'?s\s+list)\b/iu,
  },
  {
    // Connective glue that negates or hedges can invert a grounded fact it sits
    // beside, which is a fabrication by composition rather than by wording.
    code: 'NEGATION_OR_DEFICIENCY',
    pattern: /\b(?:not|n't|never|no|none|nor|cannot|rarely|seldom|hardly|barely|scarcely|failed|unable|lacked|lacking|deficient|struggled|difficulty|without)\b/iu,
  },
  {
    code: 'CLINICAL_SETTING',
    pattern: /\b(?:inpatient|outpatient|ambulatory|intensive\s+care|emergency\s+(?:department|room)|operating\s+room|night\s+float|bedside|rounds|census|handoff|sign-?out|consult(?:s|ation)?|admission|discharge)\b/iu,
  },
  // Case-sensitive: these abbreviations collide with common words when folded.
  { code: 'CLINICAL_SETTING', pattern: /\b(?:ICU|NICU|PICU|CCU|ED|ER|OR|MICU|SICU)\b/u },
]);

/**
 * THE CONNECTIVE GATE - a closed allowlist of provably non-factual letter forms.
 *
 * A segment may be declared CONNECTIVE only if EVERY unit of prose in it matches
 * one of these whole-unit, anchored forms. Each form is letter furniture: it
 * addresses the reader, closes the letter, marks a discourse transition, states
 * the recommender's recommendation, or offers contact. None of them predicates
 * anything about the subject's history, training, conduct, or performance.
 *
 * Every other sentence - including ordinary, true, entirely unremarkable ones
 * such as "He passed his boards on the first attempt." - is treated as a
 * MATERIAL FACTUAL ASSERTION. It is not forbidden; it must simply be carried as a
 * factual segment, where it acquires supportIds and must survive entailment.
 *
 * This list is intentionally closed. There is no caller-supplied widening hook:
 * `additionalConnectiveRules` can only add denials. Widening the set of things a
 * letter may assert without provenance is a decision-record change, not a
 * configuration change.
 */
/**
 * Closed vocabulary of salutation addressees. A salutation names a recipient, and the set of
 * recipients a recommendation letter addresses is small and enumerable. Keeping it closed is
 * what prevents the salutation slot from becoming a free-text channel.
 */
const SALUTATION_ROLE_PHRASES = [
  'Admissions Committee', 'Colleague', 'Colleagues', 'Committee', 'Committee Members',
  'Evaluator', 'Fellowship Director', 'Hiring Committee', 'Madam', 'Members of the Committee',
  'Program Coordinator', 'Program Director', 'Residency Program Director',
  'Residency Selection Committee', 'Review Committee', 'Reviewer', 'Search Committee',
  'Selection Committee', 'Sir', 'Sir or Madam', 'Whom It May Concern',
];

const SALUTATION_ROLE_ALTERNATION = SALUTATION_ROLE_PHRASES
  .map((phrase) => phrase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&').replace(/\s+/gu, '\\s+'))
  .join('|');

/**
 * (Dear|To) [the] ( closed role phrase | honorific + 1-2 name tokens | ONE bare token ) [,:]
 *
 * A multi-token free-text addressee is the whole hazard: "Dear Committee Smith Fails Boards,"
 * is grammatically an address and semantically a fabricated disciplinary finding about a named
 * person. Multi-token names are therefore admitted only behind an honorific, and a bare
 * addressee is capped at a SINGLE token, which cannot form a subject-predicate pair.
 */
const SALUTATION_PATTERN = new RegExp(
  '^(?!.*\\b(?:[Hh]e|[Ss]he|[Tt]hey|[Hh]im|[Hh]er|[Hh]ers|[Hh]is|[Tt]heir|[Tt]heirs|[Tt]hem)\\b)'
  + '(?!.*[A-Za-z]{2,}(?:ed|ing)\\b)'
  + '(?:Dear|To)\\s+(?:[Tt]he\\s+)?'
  + '(?:'
    + `(?:${SALUTATION_ROLE_ALTERNATION})`
    + '|(?:Dr|Drs|Prof|Professor|Mr|Mrs|Ms|Mx)\\.?\\s+[A-Z][A-Za-z.\'’-]*(?:\\s+[A-Z][A-Za-z.\'’-]*)?'
    + '|[A-Z][A-Za-z.\'’-]*'
  + ')'
  + '\\s*[,:]$',
  'u',
);

export const CONNECTIVE_ALLOWED_FORMS = deepFreeze([
  {
    // "Dear Program Director," / "Dear Dr. Smith," / "To the Selection Committee:"
    // - an address, not an assertion.
    //
    // Case-SENSITIVE on purpose. A salutation names a role or a person, so every
    // word in it is a proper noun or an honorific. Requiring title case, barring
    // third-person pronouns, and barring verb-inflected tokens together mean a
    // salutation cannot double as a sentence about the subject: the natural-prose
    // shape "Dear reader the applicant lied," fails title case, and its
    // title-cased twin fails the verb guard. A determiner is permitted only
    // directly after Dear/To, so a mid-phrase subject ("Dear Colleague The
    // Applicant Excels,") cannot open a predicate either.
    //
    // The prior implementation allowed any title-cased noun phrase of up to five words here,
    // and documented that as a narrow residual. It was not narrow: an adversarial review
    // landed "Dear Committee Smith Fails Boards," MID-LETTER with no provenance. Two of that
    // comment's claims were false - the form was not pinned to the head of the letter, and
    // the -ed/-ing verb guard does not stop third-person present tense ("Fails", "Falsifies",
    // "Lacks"), so the phrase was a predicate about a named subject, not an address.
    // The addressee is now a CLOSED grammar. See SALUTATION_PATTERN above.
    code: 'SALUTATION',
    pattern: SALUTATION_PATTERN,
  },
  {
    code: 'VALEDICTION',
    pattern:
      /^(?:sincerely|respectfully|cordially|regards|warm(?:est|ly)?\s+regards|best\s+regards|kind(?:est)?\s+regards|with\s+(?:warm\s+)?regards|yours\s+(?:sincerely|truly)|sincerely\s+yours|respectfully\s+(?:yours|submitted)|with\s+(?:appreciation|gratitude|respect)|thank\s+you)\s*[,.]?$/iu,
  },
  {
    code: 'TRANSITION',
    pattern:
      /^(?:in\s+(?:addition|closing|summary|short|sum|conclusion|that\s+regard|this\s+context)|furthermore|moreover|additionally|finally|lastly|to\s+that\s+end|by\s+way\s+of\s+background|on\s+a\s+personal\s+note|with\s+that\s+in\s+mind|that\s+said)\s*[,.:;]?$/iu,
  },
  {
    // The recommendation itself is the recommender's opinion, not a claim about
    // what the subject did. Anything appended to it leaves the allowlist.
    code: 'RECOMMENDATION',
    pattern:
      /^i\s+(?:strongly\s+|gladly\s+|happily\s+|therefore\s+|enthusiastically\s+)?recommend\s+(?:her|him|them|this\s+(?:applicant|candidate|student))(?:\s+(?:to\s+you|to\s+your\s+program|for\s+your\s+program|for\s+your\s+consideration|for\s+this\s+position))?\s*\.$/iu,
  },
  {
    code: 'RECOMMENDATION',
    pattern:
      /^i\s+am\s+(?:pleased|glad|happy|honou?red|delighted)\s+to\s+recommend\s+(?:her|him|them|this\s+(?:applicant|candidate|student))(?:\s+(?:to\s+you|to\s+your\s+program|for\s+your\s+program|for\s+your\s+consideration|for\s+this\s+position))?\s*\.$/iu,
  },
  {
    code: 'OFFER_OF_CONTACT',
    pattern:
      /^please\s+(?:do\s+not\s+hesitate\s+to|feel\s+free\s+to)\s+contact\s+me(?:\s+(?:directly|at\s+any\s+time|with\s+(?:any\s+)?questions?))?\s*\.$/iu,
  },
  {
    code: 'OFFER_OF_CONTACT',
    pattern: /^i\s+am\s+(?:happy|glad|available)\s+to\s+(?:answer\s+(?:any\s+)?questions?|discuss\s+(?:this\s+)?further)\s*\.$/iu,
  },
]);

/** Finding code raised when a connective segment is not provably non-factual. */
export const UNRECOGNIZED_CONNECTIVE_FORM = 'UNRECOGNIZED_CONNECTIVE_FORM';

/**
 * Split connective prose into the units the allowlist is evaluated against: one
 * unit per line and per sentence. Splitting is required so that a permitted form
 * cannot act as a carrier for an impermissible one ("Sincerely, he passed his
 * boards on the first attempt." is two units, and the second is not allowlisted).
 */
const CONNECTIVE_UNIT_BOUNDARY = /(?<=[.!?]["')”’]?)\s+/u;

/**
 * "Dear Dr. Smith," is one unit, not two. Rejoining after an honorific or an
 * initial can only ever make a unit LONGER, and every allowlist form is anchored
 * at both ends, so rejoining can never admit prose that splitting would deny -
 * it only prevents a legitimate salutation from being shredded into fragments.
 */
const HONORIFIC_ABBREVIATION = /(?:\b(?:Dr|Drs|Mr|Mrs|Ms|Mx|Prof|Profs|Rev|Hon|Sr|Jr|St)|\b[A-Z])\.$/u;

function splitConnectiveUnits(text) {
  const units = [];
  for (const line of text.split(/[\r\n]+/u)) {
    let open = null;
    for (const piece of line.split(CONNECTIVE_UNIT_BOUNDARY)) {
      const candidate = piece.trim();
      if (candidate.length === 0) continue;
      if (open !== null && HONORIFIC_ABBREVIATION.test(open)) {
        open = `${open} ${candidate}`;
        units[units.length - 1] = open;
      } else {
        open = candidate;
        units.push(open);
      }
    }
  }
  return units;
}

function normalizeForComparison(value) {
  return value.replace(/\s+/gu, ' ').trim().toLowerCase();
}

function assertBoundedText(value, fieldName, maxLength, details = {}) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} must be non-empty text`, { fieldName, ...details });
  }
  if (value.length > maxLength) {
    throw new ValidationError(`${fieldName} exceeds its maximum length`, { fieldName, maxLength, ...details });
  }
  return value;
}

export function inspectProtectedText(text) {
  if (typeof text !== 'string') throw new ValidationError('Text must be a string');
  const findings = [];
  for (const rule of BLOCKED_PATTERNS) {
    if (rule.pattern.test(text)) findings.push(rule.code);
  }
  return deepFreeze([...new Set(findings)]);
}

function assertRuleShape(rule, index) {
  if (
    !rule ||
    typeof rule.code !== 'string' ||
    rule.code.trim().length === 0 ||
    !(rule.pattern instanceof RegExp) ||
    rule.pattern.global ||
    rule.pattern.sticky
  ) {
    throw new ValidationError('Connective guard rules require a code and a non-stateful RegExp', { index });
  }
  return rule;
}

/**
 * Screen connective prose. Returns finding codes; an EMPTY array means the text
 * was PROVEN to be non-factual letter furniture, not merely un-suspicious.
 *
 * Two independent screens, both of which must be clear:
 *   1. ALLOWLIST (the gate): every unit must match `CONNECTIVE_ALLOWED_FORMS`.
 *      Anything else yields UNRECOGNIZED_CONNECTIVE_FORM - it is a material
 *      factual assertion and belongs in a factual segment with provenance.
 *   2. DENYLIST (defence in depth): the legacy pattern rules plus any caller
 *      -supplied rules, which can only ever deny more.
 *
 * The denylist runs first so operators get the specific code where one exists.
 */
export function inspectConnectiveProse(text, { additionalRules = [] } = {}) {
  if (typeof text !== 'string') throw new ValidationError('Text must be a string');
  if (!Array.isArray(additionalRules)) {
    throw new ValidationError('additionalConnectiveRules must be an array');
  }
  const extra = additionalRules.map((rule, index) => assertRuleShape(rule, index));
  const findings = [];
  for (const rule of [...CONNECTIVE_ASSERTION_RULES, ...extra]) {
    if (rule.pattern.test(text)) findings.push(rule.code);
  }

  // Default deny: an empty or unparseable segment proves nothing, so it fails.
  const units = splitConnectiveUnits(text);
  if (units.length === 0) {
    findings.push(UNRECOGNIZED_CONNECTIVE_FORM);
  }
  for (const unit of units) {
    if (!CONNECTIVE_ALLOWED_FORMS.some((form) => form.pattern.test(unit))) {
      findings.push(UNRECOGNIZED_CONNECTIVE_FORM);
      break;
    }
  }
  return deepFreeze([...new Set(findings)]);
}

/**
 * Entailment verifier port.
 *
 * A bound implementation answers: "is this sentence entailed by these approved
 * facts?" The base port answers UNAVAILABLE, which the validator treats as a
 * hard failure. Absence of the capability fails safely; it never passes.
 */
export class EntailmentVerifierPort {
  get verifierId() {
    return 'missionmed.entailment.unbound';
  }

  async verify() {
    return deepFreeze({
      status: ENTAILMENT_STATUS.UNAVAILABLE,
      verifierId: this.verifierId,
      rationaleCode: 'ENTAILMENT_VERIFIER_NOT_IMPLEMENTED',
    });
  }
}

/**
 * The only entailment relation decidable without a bound provider: the segment
 * reproduces its cited source material verbatim. Anything beyond reproduction -
 * including legitimate synthesis - is reported UNAVAILABLE, never NOT_ENTAILED,
 * because this verifier cannot judge it. Both outcomes fail closed.
 */
export class VerbatimEntailmentVerifier extends EntailmentVerifierPort {
  get verifierId() {
    return 'missionmed.entailment.verbatim.v1';
  }

  async verify({ segmentText, sources }) {
    const candidate = normalizeForComparison(segmentText);
    const reproducesOne = sources.some((source) => normalizeForComparison(source.text) === candidate);
    const reproducesAll =
      sources.length > 1 && normalizeForComparison(sources.map((source) => source.text).join(' ')) === candidate;
    if (reproducesOne || reproducesAll) {
      return deepFreeze({
        status: ENTAILMENT_STATUS.ENTAILED,
        verifierId: this.verifierId,
        rationaleCode: 'VERBATIM_SOURCE_REPRODUCTION',
      });
    }
    return deepFreeze({
      status: ENTAILMENT_STATUS.UNAVAILABLE,
      verifierId: this.verifierId,
      rationaleCode: 'SEMANTIC_ENTAILMENT_REQUIRES_BOUND_VERIFIER',
    });
  }
}

function normalizeSupportIds(supportIds, index) {
  if (!Array.isArray(supportIds) || supportIds.length === 0) {
    throw new ValidationError('Every factual segment requires evidence support', { index });
  }
  if (supportIds.length > LIMITS.supportIdsMax) {
    throw new ValidationError('Factual segment cites too many sources', { index, maximum: LIMITS.supportIdsMax });
  }
  const seen = new Set();
  for (const supportId of supportIds) {
    if (typeof supportId !== 'string' || supportId.trim().length === 0 || seen.has(supportId)) {
      throw new ValidationError('Factual segment support ids must be unique non-empty strings', { index });
    }
    seen.add(supportId);
  }
  return deepFreeze([...supportIds]);
}

function normalizeSegment(raw, index) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ValidationError('Every proposal segment must be an object', { index });
  }
  const kind = raw.kind ?? 'factual';
  if (!SEGMENT_KINDS.includes(kind)) {
    throw new ValidationError('Proposal segments must be typed factual or connective', { index, kind: raw.kind ?? null });
  }
  assertBoundedText(raw.text, 'segment text', LIMITS.segmentTextMax, { index });
  if (raw.text.trim() !== raw.text) {
    throw new ValidationError('Segment text must be exactly trimmed', { index });
  }
  const separator = raw.separator ?? DEFAULT_SEGMENT_SEPARATOR;
  if (!Object.hasOwn(SEGMENT_SEPARATORS, separator)) {
    throw new ValidationError('Unknown segment separator', { index, separator: String(separator) });
  }
  if (kind === 'connective') {
    if (raw.supportIds !== undefined && raw.supportIds !== null) {
      throw new ValidationError('Connective segments carry no provenance and must not cite support', { index });
    }
    return { kind, text: raw.text, separator, supportIds: [] };
  }
  return { kind, text: raw.text, separator, supportIds: normalizeSupportIds(raw.supportIds, index) };
}

function resolveSegments({ segments, claims }) {
  const fromSegments = segments !== undefined && segments !== null;
  const fromClaims = claims !== undefined && claims !== null;
  if (!fromSegments && !fromClaims) {
    throw new ValidationError('AI proposals require a typed, source-linked segment structure');
  }
  const source = fromSegments ? segments : claims;
  if (!Array.isArray(source) || source.length === 0) {
    throw new ValidationError('AI proposals require a typed, source-linked segment structure');
  }
  if (source.length > LIMITS.segmentsMax) {
    throw new ValidationError('Proposal has too many segments', { maximum: LIMITS.segmentsMax });
  }
  const normalized = source.map((raw, index) => normalizeSegment(raw, index));
  if (fromSegments && fromClaims) {
    // A provider may not ship a decoy claim list alongside the real segments.
    if (!Array.isArray(claims)) throw new ValidationError('claims must be an array when supplied');
    const factual = normalized.filter((segment) => segment.kind === 'factual');
    const declared = claims.map((claim, index) => normalizeSegment({ ...claim, kind: 'factual' }, index));
    const encode = (list) => JSON.stringify(list.map((item) => [item.text, [...item.supportIds]]));
    if (encode(factual) !== encode(declared)) {
      throw new ValidationError('Declared claims do not match the factual segments of the proposal');
    }
  }
  return normalized;
}

function composeSegments(segments) {
  return segments
    .map((segment, index) => (index === 0 ? '' : SEGMENT_SEPARATORS[segment.separator]) + segment.text)
    .join('');
}

const SENTENCE_FINAL = /[.!?]["')”’]?$/u;
/** A salutation or heading line legitimately closes on `,` `;` or `:`. */
const BLOCK_FINAL = /[,;:]["')”’]?$/u;
const SENTENCE_INITIAL = /^["'(“‘]?[\p{Lu}\p{N}]/u;

/**
 * EVERY segment boundary must also be a sentence boundary, under EVERY separator.
 *
 * The provider chooses the separator, so a rule that only inspects `inline`
 * inspects nothing: the identical splice is re-submitted as `line` or
 * `paragraph`. The grounded segment "The applicant handled the workload"
 * followed by "poorly, in my judgment." asserts the opposite of what its sources
 * entail, and no wording heuristic on either fragment can see it - the
 * fabrication lives in the join. So the join is what is checked:
 *
 *   - a segment must OPEN a sentence, and
 *   - the preceding segment must CLOSE one.
 *
 * The single exception is a CONNECTIVE segment ending in block punctuation
 * ("Dear Program Director,") when the next segment starts a new line or
 * paragraph. A FACTUAL segment never gets that exception: it must end
 * sentence-finally, so nothing can be appended to the inside of a grounded
 * sentence regardless of which separator the provider picks.
 */
function assertSegmentBoundaries(segments) {
  for (const [index, segment] of segments.entries()) {
    if (index === 0) {
      if (segment.separator === 'inline') {
        throw new ValidationError('The first segment cannot use an inline separator', { index });
      }
      continue;
    }
    const previous = segments[index - 1];
    if (!SENTENCE_INITIAL.test(segment.text)) {
      throw new ValidationError('A segment must begin a new sentence', {
        index,
        separator: segment.separator,
        rationaleCode: 'SUB_SENTENCE_SPLICING_BLOCKED',
      });
    }
    const closesSentence = SENTENCE_FINAL.test(previous.text);
    const closesBlock =
      previous.kind === 'connective' && segment.separator !== 'inline' && BLOCK_FINAL.test(previous.text);
    if (!closesSentence && !closesBlock) {
      throw new ValidationError(
        'A segment must begin a new sentence, and the preceding segment must close one',
        {
          index,
          separator: segment.separator,
          rationaleCode: 'SUB_SENTENCE_SPLICING_BLOCKED',
        },
      );
    }
  }
}

function indexApprovedFacts({ approvedFacts, evidenceReferences }) {
  if (!Array.isArray(approvedFacts) || approvedFacts.length === 0) {
    throw new ValidationError('Grounding requires the approved source material the proposal was built from');
  }
  if (approvedFacts.length > LIMITS.approvedFactsMax) {
    throw new ValidationError('Too many approved facts', { maximum: LIMITS.approvedFactsMax });
  }
  const referenceById = new Map();
  for (const reference of evidenceReferences) {
    if (!reference || typeof reference.id !== 'string' || reference.id.trim().length === 0) {
      throw new ValidationError('Evidence references require ids');
    }
    referenceById.set(reference.id, reference);
  }
  const byId = new Map();
  for (const [index, fact] of approvedFacts.entries()) {
    if (!fact || typeof fact.id !== 'string' || fact.id.trim().length === 0 || byId.has(fact.id)) {
      throw new ValidationError('Approved facts require unique ids', { index });
    }
    assertBoundedText(fact.text, 'approved fact text', LIMITS.segmentTextMax, { index });
    const findings = inspectProtectedText(fact.text);
    if (findings.length > 0) {
      throw new ValidationError('Approved fact contains prohibited content', { index, findings });
    }
    if (evidenceReferences.length > 0) {
      const reference = referenceById.get(fact.id);
      if (!reference) {
        throw new ValidationError('Approved facts must be bound to a consented evidence reference', {
          index,
          factId: fact.id,
        });
      }
      if (typeof reference.contentHash === 'string' && reference.contentHash.length > 0) {
        if (sha256(fact.text) !== reference.contentHash) {
          throw new ValidationError('Approved fact text does not match its consented evidence hash', {
            index,
            factId: fact.id,
          });
        }
      }
    }
    byId.set(fact.id, {
      id: fact.id,
      text: fact.text,
      contentHash: referenceById.get(fact.id)?.contentHash ?? sha256(fact.text),
    });
  }
  return byId;
}

function assertUsableVerifier(entailmentVerifier) {
  if (!entailmentVerifier || typeof entailmentVerifier.verify !== 'function') {
    throw new ValidationError('Grounding requires an entailment verifier; verification is unavailable', {
      status: ENTAILMENT_STATUS.UNAVAILABLE,
      rationaleCode: 'ENTAILMENT_VERIFIER_MISSING',
    });
  }
  return entailmentVerifier;
}

async function attestEntailment({ verifier, segment, sources, index, caseId }) {
  let verdict;
  try {
    verdict = await verifier.verify({
      segmentText: segment.text,
      sources: sources.map((source) => ({ id: source.id, text: source.text, contentHash: source.contentHash })),
      caseId,
    });
  } catch (error) {
    throw new ValidationError('Entailment verification failed closed', {
      index,
      status: ENTAILMENT_STATUS.UNAVAILABLE,
      rationaleCode: 'ENTAILMENT_VERIFIER_THREW',
      supportIds: [...segment.supportIds],
      reason: typeof error?.message === 'string' ? error.message : null,
    });
  }
  const status = verdict?.status;
  const verifierId =
    typeof verdict?.verifierId === 'string' && verdict.verifierId.trim().length > 0 ? verdict.verifierId : null;
  if (!verifierId || !Object.values(ENTAILMENT_STATUS).includes(status)) {
    throw new ValidationError('Entailment verdict is unusable; grounding fails closed', {
      index,
      status: typeof status === 'string' ? status : null,
      rationaleCode: 'ENTAILMENT_VERDICT_MALFORMED',
      supportIds: [...segment.supportIds],
    });
  }
  if (status !== ENTAILMENT_STATUS.ENTAILED) {
    throw new ValidationError('Factual segment is not grounded in approved source material', {
      index,
      status,
      verifierId,
      rationaleCode: typeof verdict.rationaleCode === 'string' ? verdict.rationaleCode : null,
      supportIds: [...segment.supportIds],
    });
  }
  return {
    verifierId,
    rationaleCode: typeof verdict.rationaleCode === 'string' ? verdict.rationaleCode : null,
  };
}

/**
 * Validate an AI proposal against the DR-119 grounding invariant.
 *
 * ASYNCHRONOUS: entailment verification is a port call. Callers must await this;
 * an unawaited call is a bug, never a pass.
 *
 * @param {{
 *   text: string,
 *   segments?: Array<object>,
 *   claims?: Array<object>,
 *   approvedFacts: Array<{ id: string, text: string }>,
 *   evidenceReferences?: Array<{ id: string, contentHash?: string }>,
 *   entailmentVerifier?: EntailmentVerifierPort,
 *   additionalConnectiveRules?: Array<{ code: string, pattern: RegExp }>,
 *   caseId?: string | null,
 * }} input
 */
export async function validateAiProposal({
  text,
  segments,
  claims,
  approvedFacts,
  evidenceReferences = [],
  entailmentVerifier = new VerbatimEntailmentVerifier(),
  additionalConnectiveRules = [],
  caseId = null,
}) {
  assertBoundedText(text, 'AI proposal text', LIMITS.proposalTextMax);
  if (!Array.isArray(evidenceReferences)) {
    throw new ValidationError('evidenceReferences must be an array');
  }
  if (!Array.isArray(additionalConnectiveRules)) {
    throw new ValidationError('additionalConnectiveRules must be an array');
  }
  const verifier = assertUsableVerifier(entailmentVerifier);
  const prohibited = inspectProtectedText(text);
  if (prohibited.length > 0) {
    throw new ValidationError('AI proposal contains prohibited content', { findings: prohibited });
  }

  const resolved = resolveSegments({ segments, claims });
  assertSegmentBoundaries(resolved);
  const factsById = indexApprovedFacts({ approvedFacts, evidenceReferences });

  // Nothing reaches the reader that did not pass a gate: the letter is exactly
  // the composition of its typed segments.
  if (text.trim() !== composeSegments(resolved)) {
    throw new ValidationError('AI proposal text must be exactly the composition of its typed segments');
  }

  const attestations = [];
  const supportIds = new Set();
  let factualCount = 0;
  let connectiveCount = 0;

  for (const [index, segment] of resolved.entries()) {
    const segmentFindings = inspectProtectedText(segment.text);
    if (segmentFindings.length > 0) {
      throw new ValidationError('AI proposal segment contains prohibited content', {
        index,
        kind: segment.kind,
        findings: segmentFindings,
      });
    }

    if (segment.kind === 'connective') {
      connectiveCount += 1;
      const smuggled = inspectConnectiveProse(segment.text, { additionalRules: additionalConnectiveRules });
      if (smuggled.length > 0) {
        throw new ValidationError('Connective segment asserts material fact without provenance', {
          index,
          findings: smuggled,
        });
      }
      attestations.push({
        index,
        kind: 'connective',
        supportIds: [],
        status: 'NO_MATERIAL_ASSERTION',
        verifierId: null,
        rationaleCode: 'CONNECTIVE_GUARD_CLEAR',
        sourceHashes: [],
      });
      continue;
    }

    factualCount += 1;
    const unresolved = segment.supportIds.filter((supportId) => !factsById.has(supportId));
    if (unresolved.length > 0) {
      throw new ValidationError('Factual segment references unsupported evidence', { index, unsupported: unresolved });
    }
    const sources = segment.supportIds.map((supportId) => factsById.get(supportId));
    // Referential existence is not support. The cited facts must actually entail
    // the assertion, and an unavailable verifier fails closed inside this call.
    const attested = await attestEntailment({ verifier, segment, sources, index, caseId });
    for (const supportId of segment.supportIds) supportIds.add(supportId);
    attestations.push({
      index,
      kind: 'factual',
      supportIds: [...segment.supportIds],
      status: ENTAILMENT_STATUS.ENTAILED,
      verifierId: attested.verifierId,
      rationaleCode: attested.rationaleCode,
      sourceHashes: sources.map((source) => source.contentHash),
    });
  }

  if (factualCount === 0) {
    throw new ValidationError('AI proposals require at least one grounded factual segment');
  }

  const grounding = {
    schemaVersion: GROUNDING_MODEL_VERSION,
    valid: true,
    claimCount: factualCount,
    segmentCount: resolved.length,
    factualSegmentCount: factualCount,
    connectiveSegmentCount: connectiveCount,
    supportIds: [...supportIds].sort(),
    segments: resolved.map((segment) => ({
      kind: segment.kind,
      text: segment.text,
      separator: segment.separator,
      supportIds: [...segment.supportIds],
    })),
    attestations,
  };
  return deepFreeze({ ...grounding, attestationHash: hashValue(grounding) });
}
