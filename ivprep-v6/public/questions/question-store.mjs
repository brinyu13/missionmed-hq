// Question provider registry + store for IV Prep On-Call.
//
// Y1-Y2-CAM-V6-3494A Question Engine Spec §2/§6. This is the substrate only: the
// drawer, Interview Set and presets are separate slices that read from here.
//
// Two laws this module exists to enforce:
//
//   CORE FIRST. The Founder CORE collection surfaces first everywhere - drawer,
//   wizard step 2, presets. Ordering is applied by the store, so no caller can
//   accidentally bury "Tell me about yourself."
//
//   STATS ARE JOINED, NEVER STORED. Question records carry no attempt counts.
//   Stats are computed from AnswerRecords at read time against question_id, so the
//   drawer's living stats and the Library's question-centric view cannot drift.
//
// Providers emit Question records into one store and the UI enumerates the
// registry, so adding CVQuestionProvider / MentorQuestionProvider / RISE later
// touches no drawer, loadout or session-engine code.

import { BEHAVIORAL_COLLECTION, EXCLUDED_SOURCE_SECTIONS, SEED_QUESTIONS } from './mission-residency-corpus.mjs';

export const COLLECTIONS = Object.freeze({
  CORE: 'CORE',
  BEHAVIORAL: 'BEHAVIORAL',
  CV_DERIVED: 'CV_DERIVED',
  FAVORITES: 'FAVORITES',
  PREVIOUS: 'PREVIOUS',
  NEVER_PRACTICED: 'NEVER_PRACTICED',
  NEEDS_WORK: 'NEEDS_WORK',
});

export const SORTS = Object.freeze({
  SOURCE_ORDER: 'source_order',
  PRACTICE_FREQUENCY: 'practice_frequency',
  DIFFICULTY: 'difficulty',
  RECENCY: 'recency',
});

// Mastery is deliberately NOT scored here. NEEDS WORK reads an explicit mentor
// mark or an explicit student flag; it never infers "needs work" from telemetry.
const NEEDS_WORK_MARKS = Object.freeze(['NEEDS WORK', 'NEEDS_WORK']);

export class QuestionProviderRegistry {
  #providers = new Map();

  register(provider) {
    const id = String(provider?.id || '').trim();
    if (!id) throw new TypeError('A question provider requires an id.');
    if (typeof provider.questions !== 'function') throw new TypeError(`Provider ${id} must expose questions().`);
    if (this.#providers.has(id)) throw new Error(`Question provider ${id} is already registered.`);
    this.#providers.set(id, provider);
    return this;
  }

  get ids() { return [...this.#providers.keys()]; }

  get providers() { return [...this.#providers.values()]; }

  questions() {
    const seen = new Map();
    for (const provider of this.#providers.values()) {
      for (const question of provider.questions()) {
        const existing = seen.get(question.question_id);
        if (existing && existing.__providerId !== provider.id) {
          throw new Error(`Question id ${question.question_id} claimed by both ${existing.__providerId} and ${provider.id}.`);
        }
        seen.set(question.question_id, Object.freeze({ ...question, __providerId: provider.id }));
      }
    }
    return [...seen.values()];
  }
}

export const MissionResidencyQuestionProvider = Object.freeze({
  id: 'mission_residency',
  label: 'Mission Residency',
  official: true,
  collectionDescriptions: Object.freeze([BEHAVIORAL_COLLECTION]),
  questions: () => SEED_QUESTIONS,
});

function normalizedText(value) {
  return String(value || '').toLocaleLowerCase();
}

// Answer records are the single source of practice truth. Shape used here is the
// minimum contract: { question_id, recorded_at, personal_best?, mentor_review? }.
function statsIndex(answerRecords) {
  const index = new Map();
  for (const answer of answerRecords || []) {
    const id = answer?.question_id;
    if (!id) continue;
    const entry = index.get(id) || { attempts: 0, lastPracticed: null, personalBest: null, mentorReviewed: 0, marks: [] };
    entry.attempts += 1;
    const at = answer.recorded_at ? Date.parse(answer.recorded_at) : NaN;
    if (Number.isFinite(at) && (entry.lastPracticed === null || at > entry.lastPracticed)) entry.lastPracticed = at;
    if (answer.personal_best === true) entry.personalBest = answer.answer_id ?? true;
    const mark = answer.mentor_review?.mark;
    if (answer.mentor_review) entry.mentorReviewed += 1;
    if (mark) entry.marks.push(String(mark).toUpperCase());
    index.set(id, entry);
  }
  return index;
}

export class QuestionStore {
  #registry;

  constructor(registry = new QuestionProviderRegistry().register(MissionResidencyQuestionProvider)) {
    this.#registry = registry;
  }

  get registry() { return this.#registry; }

  /** All questions, CORE pinned first, then provider/source order. */
  all() {
    return this.#registry.questions().slice().sort(compareCoreFirst);
  }

  get count() { return this.#registry.questions().length; }

  /**
   * Read-time join. Returns questions with a computed `stats` object. Never
   * mutates or denormalizes onto the stored record.
   */
  withStats(answerRecords = [], { favorites = [] } = {}) {
    const index = statsIndex(answerRecords);
    const favorite = new Set(favorites);
    return this.all().map((question) => {
      const entry = index.get(question.question_id);
      return Object.freeze({
        ...question,
        favorite: favorite.has(question.question_id),
        stats: Object.freeze({
          attempts: entry?.attempts ?? 0,
          lastPracticed: entry?.lastPracticed ?? null,
          personalBest: entry?.personalBest ?? null,
          mentorReviewed: entry?.mentorReviewed ?? 0,
          needsWork: Boolean(entry?.marks?.some((mark) => NEEDS_WORK_MARKS.includes(mark))),
        }),
      });
    });
  }

  /**
   * Drawer query. `search` matches canonical_text and tags. Collections and tags
   * intersect. Sorting always keeps CORE first unless an explicit sort is given.
   */
  query({ search = '', collection = null, tags = [], sort = SORTS.SOURCE_ORDER, answerRecords = [], favorites = [] } = {}) {
    const needle = normalizedText(search).trim();
    const wanted = new Set(tags);
    let rows = this.withStats(answerRecords, { favorites });

    if (needle) {
      rows = rows.filter((question) => normalizedText(question.canonical_text).includes(needle)
        || question.tags.some((tag) => normalizedText(tag).includes(needle)));
    }
    if (wanted.size) rows = rows.filter((question) => question.tags.some((tag) => wanted.has(tag)));
    if (collection) rows = rows.filter((question) => inCollection(question, collection));

    return sortRows(rows, sort);
  }

  /** CORE 10 in Founder order - the two-tap path from Home. */
  core() {
    return this.all().filter((question) => question.core_priority === true);
  }

  /**
   * Proves the applicant-asked sections never entered the corpus. Returns the
   * offending records rather than a boolean so failures are diagnosable.
   */
  excludedSectionViolations() {
    return this.all().filter((question) => EXCLUDED_SOURCE_SECTIONS
      .some((heading) => question.canonical_text.includes(heading)));
  }
}

function inCollection(question, collection) {
  switch (collection) {
    case COLLECTIONS.CORE: return question.core_priority === true;
    case COLLECTIONS.BEHAVIORAL: return question.behavioral === true;
    case COLLECTIONS.CV_DERIVED: return question.source === 'cv_generated';
    case COLLECTIONS.FAVORITES: return question.favorite === true;
    case COLLECTIONS.PREVIOUS: return question.stats.attempts > 0;
    case COLLECTIONS.NEVER_PRACTICED: return question.stats.attempts === 0;
    case COLLECTIONS.NEEDS_WORK: return question.stats.needsWork === true;
    default: throw new RangeError(`Unknown collection ${collection}`);
  }
}

function compareCoreFirst(a, b) {
  if (a.core_priority !== b.core_priority) return a.core_priority ? -1 : 1;
  if (a.source !== b.source) return sourceRank(a.source) - sourceRank(b.source);
  return (a.source_number ?? 0) - (b.source_number ?? 0);
}

function sourceRank(source) {
  const order = ['founder_core', 'mr142', 'mr_behavioral', 'cv_generated', 'mentor', 'custom', 'rise_future'];
  const index = order.indexOf(source);
  return index < 0 ? order.length : index;
}

function sortRows(rows, sort) {
  const sorted = rows.slice();
  switch (sort) {
    case SORTS.SOURCE_ORDER:
      return sorted.sort(compareCoreFirst);
    case SORTS.PRACTICE_FREQUENCY:
      return sorted.sort((a, b) => a.stats.attempts - b.stats.attempts || compareCoreFirst(a, b));
    case SORTS.DIFFICULTY:
      return sorted.sort((a, b) => a.difficulty - b.difficulty || compareCoreFirst(a, b));
    case SORTS.RECENCY:
      return sorted.sort((a, b) => (b.stats.lastPracticed ?? -1) - (a.stats.lastPracticed ?? -1) || compareCoreFirst(a, b));
    default:
      throw new RangeError(`Unknown sort ${sort}`);
  }
}

export function createDefaultQuestionStore() {
  return new QuestionStore(new QuestionProviderRegistry().register(MissionResidencyQuestionProvider));
}
