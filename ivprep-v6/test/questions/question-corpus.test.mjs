// Y1-Y2-CAM-V6-3500 / CC-25 acceptance tests.
//
// Acceptance from the 3494A consolidated plan: counts exact (10/142/41); CORE
// surfaces first; [sic] preserved; exclusion test green.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  BEHAVIORAL_COLLECTION,
  CORPUS_MANIFEST_SHA256,
  EXCLUDED_SOURCE_SECTIONS,
  QUESTION_TAXONOMY,
  SEED_QUESTIONS,
} from '../../public/questions/mission-residency-corpus.mjs';
import {
  COLLECTIONS,
  MissionResidencyQuestionProvider,
  QuestionProviderRegistry,
  QuestionStore,
  SORTS,
  createDefaultQuestionStore,
} from '../../public/questions/question-store.mjs';
import { parseManifest } from '../../scripts/questions/import-mvp-corpus.mjs';

const MANIFEST_URL = new URL(
  '../../../_AI_HANDOFFS/from_cowork/Y1-Y2-CAM-V6-3494A_FABLE_PRODUCTION_AUTHORITY/'
  + '3494A_CONSOLIDATED/Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md',
  import.meta.url,
);

const bySource = (source) => SEED_QUESTIONS.filter((question) => question.source === source);

test('corpus counts are exact', () => {
  assert.equal(bySource('founder_core').length, 10, 'CORE');
  assert.equal(bySource('mr142').length, 142, 'MR142');
  assert.equal(bySource('mr_behavioral').length, 41, 'BEHAVIORAL questions');
  assert.equal(SEED_QUESTIONS.length, 193, 'total question records');
  assert.equal(BEHAVIORAL_COLLECTION.is_collection_description, true);
  assert.equal(BEHAVIORAL_COLLECTION.question_id, 'BEH-042');
});

test('the excluded applicant-asked sections are structurally absent', () => {
  // The three "Questions to Ask ..." sections are applicant-asked questions and
  // must never enter the interviewer corpus.
  assert.deepEqual(EXCLUDED_SOURCE_SECTIONS, [
    'Questions to Ask the Faculty',
    'Questions to Ask the Program Director',
    'Questions to Ask the Residents',
  ]);
  assert.deepEqual(createDefaultQuestionStore().excludedSectionViolations(), []);

  // Grep the corpus for the excluded phrasing in any form, per the taxonomy doc's
  // CI requirement.
  for (const question of SEED_QUESTIONS) {
    assert.doesNotMatch(question.canonical_text, /Questions to Ask/iu, question.question_id);
  }
  assert.equal(SEED_QUESTIONS.some((q) => q.question_id.startsWith('ASK-')), false);
});

test('CORE 10 carries the canonical Founder wording and is pinned first', () => {
  const store = createDefaultQuestionStore();
  const core = store.core();
  assert.equal(core.length, 10);
  assert.deepEqual(core.map((question) => question.question_id), [
    'CORE-01', 'CORE-02', 'CORE-03', 'CORE-04', 'CORE-05',
    'CORE-06', 'CORE-07', 'CORE-08', 'CORE-09', 'CORE-10',
  ]);

  // Founder wording, not the prototype fixture wording which appended
  // "and what brought you to internal medicine".
  assert.equal(core[0].canonical_text, 'Tell me about yourself.');
  assert.equal(core[9].canonical_text, 'Tell me about an error that you made in patient care.');
  for (const question of core) {
    assert.equal(question.core_priority, true);
    assert.ok(question.tags.includes('CORE'), `${question.question_id} must carry the CORE pin`);
  }

  // CORE first in the default ordering and in every collection-free query.
  assert.equal(store.all()[0].question_id, 'CORE-01');
  assert.equal(store.query({})[0].question_id, 'CORE-01');
  assert.equal(store.query({ sort: SORTS.DIFFICULTY })[0].core_priority, true);
});

test('verbatim source text including [sic] is preserved byte-exact', async () => {
  const markdown = await readFile(MANIFEST_URL, 'utf8');
  const parsed = parseManifest(markdown);
  const fresh = new Map([...parsed.core, ...parsed.mr142, ...parsed.behavioral]
    .map((question) => [question.question_id, question.canonical_text]));

  // Every shipped string must still equal what the manifest says today.
  for (const question of SEED_QUESTIONS) {
    assert.equal(question.canonical_text, fresh.get(question.question_id), question.question_id);
  }

  const sic = SEED_QUESTIONS.filter((question) => question.verbatim_sic);
  assert.equal(sic.length, 9, 'nine [sic] records in the source');
  // MR142-009 is missing its leading "I" in the source. It must not be silently repaired.
  const nine = SEED_QUESTIONS.find((question) => question.question_id === 'MR142-009');
  assert.match(nine.canonical_text, /^f you were going to die in 5 minutes/u);
  assert.ok(nine.verbatim_sic);

  // Typographic characters from the source survive (U+2010 hyphen, U+2013 en dash).
  const years = SEED_QUESTIONS.find((question) => question.question_id === 'MR142-093');
  assert.equal(years.canonical_text, 'Where do you see yourself in 5‐10 years?');
  const identity = SEED_QUESTIONS.find((question) => question.question_id === 'MR142-014');
  assert.ok(identity.canonical_text.includes('–'));
});

test('records satisfy the canonical Question contract', () => {
  const ids = new Set();
  for (const question of SEED_QUESTIONS) {
    assert.match(question.question_id, /^(CORE-\d{2}|MR142-\d{3}|BEH-\d{3})$/u);
    assert.equal(ids.has(question.question_id), false, `duplicate ${question.question_id}`);
    ids.add(question.question_id);

    assert.ok(question.canonical_text.length > 0);
    assert.ok(Array.isArray(question.tags) && question.tags.length >= 1, question.question_id);
    for (const tag of question.tags) {
      assert.ok(QUESTION_TAXONOMY.includes(tag), `${question.question_id} has off-taxonomy tag ${tag}`);
    }
    assert.ok(Array.isArray(question.style) && question.style.length >= 1);
    assert.ok([1, 2, 3].includes(question.difficulty));
    // difficulty is a seed heuristic, not Fable-authored; it must say so.
    assert.equal(question.difficulty_origin, 'import_seed_heuristic');
    assert.deepEqual(question.links, [], 'duplicate review is a later, additive process');
    assert.equal(question.revision, 1);
    assert.deepEqual(Object.keys(question.assets).sort(), ['kelly', 'woods']);
    // Question records must never carry denormalized practice counts.
    assert.equal('stats' in question, false, `${question.question_id} must not store stats`);
    assert.equal('attempts' in question, false);
  }

  // Asset status: planned for CORE x {Kelly, Woods}, none elsewhere.
  for (const question of SEED_QUESTIONS) {
    const expected = question.core_priority ? 'planned' : 'none';
    assert.equal(question.assets.kelly, expected, question.question_id);
    assert.equal(question.assets.woods, expected, question.question_id);
  }

  // followup_eligible defaults true except CLOSING.
  for (const question of SEED_QUESTIONS) {
    assert.equal(question.followup_eligible, !question.tags.includes('CLOSING'), question.question_id);
  }

  // behavioral flag set for every BEH record and for MR142 items tagged BEHAVIORAL.
  for (const question of bySource('mr_behavioral')) assert.equal(question.behavioral, true, question.question_id);
  for (const question of SEED_QUESTIONS) {
    assert.equal(question.behavioral, question.tags.includes('BEHAVIORAL'), question.question_id);
  }
});

test('practice stats are joined from answer records, never stored', () => {
  const store = createDefaultQuestionStore();
  const answers = [
    { answer_id: 'a1', question_id: 'CORE-01', recorded_at: '2026-08-01T10:00:00.000Z' },
    { answer_id: 'a2', question_id: 'CORE-01', recorded_at: '2026-08-05T10:00:00.000Z', personal_best: true },
    { answer_id: 'a3', question_id: 'CORE-07', recorded_at: '2026-08-06T10:00:00.000Z', mentor_review: { mark: 'NEEDS WORK' } },
  ];

  const joined = store.withStats(answers, { favorites: ['CORE-03'] });
  const core01 = joined.find((question) => question.question_id === 'CORE-01');
  assert.equal(core01.stats.attempts, 2);
  assert.equal(core01.stats.personalBest, 'a2');
  assert.equal(core01.stats.lastPracticed, Date.parse('2026-08-05T10:00:00.000Z'));

  const core07 = joined.find((question) => question.question_id === 'CORE-07');
  assert.equal(core07.stats.needsWork, true);
  assert.equal(core07.stats.mentorReviewed, 1);

  // Collections read the same join.
  const previous = store.query({ collection: COLLECTIONS.PREVIOUS, answerRecords: answers });
  assert.deepEqual(previous.map((q) => q.question_id).sort(), ['CORE-01', 'CORE-07']);
  const never = store.query({ collection: COLLECTIONS.NEVER_PRACTICED, answerRecords: answers });
  assert.equal(never.length, 191);
  const needsWork = store.query({ collection: COLLECTIONS.NEEDS_WORK, answerRecords: answers });
  assert.deepEqual(needsWork.map((q) => q.question_id), ['CORE-07']);
  const favorites = store.query({ collection: COLLECTIONS.FAVORITES, answerRecords: answers, favorites: ['CORE-03'] });
  assert.deepEqual(favorites.map((q) => q.question_id), ['CORE-03']);

  // The stored record is still clean after joining.
  assert.equal('stats' in SEED_QUESTIONS.find((q) => q.question_id === 'CORE-01'), false);
});

test('drawer search and behavioral collection behave', () => {
  const store = createDefaultQuestionStore();
  assert.equal(store.count, 193);

  const conflict = store.query({ search: 'conflict' });
  assert.ok(conflict.length >= 3);
  assert.equal(conflict[0].question_id, 'CORE-07', 'CORE stays first within results');

  const behavioral = store.query({ collection: COLLECTIONS.BEHAVIORAL });
  assert.ok(behavioral.length >= 41);
  assert.ok(behavioral.every((question) => question.behavioral === true));

  // Tag search hits tags as well as text.
  assert.ok(store.query({ search: 'ethics' }).length > 0);
  assert.deepEqual(store.query({ search: 'zzzznomatch' }), []);
  assert.throws(() => store.query({ collection: 'NOPE' }), /Unknown collection/u);
  assert.throws(() => store.query({ sort: 'nope' }), /Unknown sort/u);
});

test('the provider registry is the only source list', () => {
  const registry = new QuestionProviderRegistry();
  assert.deepEqual(registry.ids, []);
  registry.register(MissionResidencyQuestionProvider);
  assert.deepEqual(registry.ids, ['mission_residency']);
  assert.throws(() => registry.register(MissionResidencyQuestionProvider), /already registered/u);
  assert.throws(() => registry.register({ id: '' }), /requires an id/u);
  assert.throws(() => registry.register({ id: 'broken' }), /must expose questions/u);

  // A second provider composes without touching the seed corpus.
  const mentor = {
    id: 'mentor',
    questions: () => [{
      question_id: 'MENT-001', canonical_text: 'Walk me through your research timeline.',
      source: 'mentor', source_number: 1, tags: ['RESEARCH'], style: ['traditional'],
      difficulty: 2, difficulty_origin: 'mentor', core_priority: false, specialties: [],
      cv_relevance: true, behavioral: false, followup_eligible: true, verbatim_sic: false,
      assets: { kelly: 'none', woods: 'none' }, links: [], revision: 1, provenance: {},
    }],
  };
  const store = new QuestionStore(registry.register(mentor));
  assert.equal(store.count, 194);
  assert.equal(store.all()[0].question_id, 'CORE-01', 'CORE still first with a new provider');
  assert.equal(store.query({ search: 'research timeline' })[0].question_id, 'MENT-001');

  // Two providers cannot claim the same id.
  const clash = new QuestionProviderRegistry()
    .register(MissionResidencyQuestionProvider)
    .register({ id: 'rogue', questions: () => [{ question_id: 'CORE-01', canonical_text: 'hijack' }] });
  assert.throws(() => clash.questions(), /claimed by both/u);
});

test('the generated corpus matches the manifest it was generated from', async () => {
  const markdown = await readFile(MANIFEST_URL, 'utf8');
  const { createHash } = await import('node:crypto');
  const sha = createHash('sha256').update(markdown).digest('hex');
  assert.equal(
    CORPUS_MANIFEST_SHA256,
    sha,
    'the authority manifest changed - re-run node scripts/questions/import-mvp-corpus.mjs',
  );
});
