import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { CORPUS_MANIFEST_SHA256, SEED_QUESTIONS } from '../../ivprep-v6/public/questions/mission-residency-corpus.mjs';
import {
  ASTRA_PACKS_SHA256,
  CANONICAL_CORPUS_MANIFEST_SHA256,
  assertQuestionLibraryBinding,
} from './question-library.mjs';
import {
  assertPresentationBoundary,
  presentationBoundaryViolations,
} from './presentation-boundary.mjs';

const packs = JSON.parse(await readFile(new URL('../fixtures/question-packs.v1.json', import.meta.url), 'utf8'));

test('193 canonical questions bind to all 20 Astra packs by immutable id', () => {
  const binding = assertQuestionLibraryBinding(SEED_QUESTIONS, packs);
  assert.equal(binding.question_count, 193);
  assert.equal(binding.pack_count, 20);
  assert.equal(binding.pack_ids[0], 'PACK-STANDARD-RESIDENCY');
  assert.equal(binding.pack_ids.at(-1), 'PACK-UNUSUAL');
  assert.equal(CORPUS_MANIFEST_SHA256, CANONICAL_CORPUS_MANIFEST_SHA256);
  assert.equal(binding.provenance.astra_packs_sha256, ASTRA_PACKS_SHA256);
});

test('pack binding rejects missing questions and provenance inflation', () => {
  assert.throws(() => assertQuestionLibraryBinding(SEED_QUESTIONS.slice(1), packs), /193/);
  const changed = structuredClone(packs);
  changed[0].question_ids.push('UNKNOWN-001');
  changed[0].question_count += 1;
  assert.throws(() => assertQuestionLibraryBinding(SEED_QUESTIONS, changed), /invalid canonical question/);
  const inflated = structuredClone(packs);
  inflated[0].origin = 'historical canonical pack membership';
  assert.throws(() => assertQuestionLibraryBinding(SEED_QUESTIONS, inflated), /provenance limit/);
});

test('presentation lint rejects capability imports and component contract bypasses', () => {
  assert.deepEqual(
    presentationBoundaryViolations('ivoc/ui/components/Home.mjs', "import x from '../../ivoc/core/index.mjs';"),
    [{ specifier: '../../ivoc/core/index.mjs', reason: 'capability implementation import' }],
  );
  assert.deepEqual(
    presentationBoundaryViolations('ivoc/ui/components/Home.mjs', "import x from '../../ivoc/contracts/index.mjs';"),
    [{ specifier: '../../ivoc/contracts/index.mjs', reason: 'component bypasses view-model adapter' }],
  );
  assert.equal(assertPresentationBoundary([
    { path: 'ivoc/ui/adapters/session.mjs', source: "import x from '../../ivoc/contracts/index.mjs';" },
    { path: 'ivoc/ui/components/Home.mjs', source: "import x from '../adapters/session.mjs';" },
  ]), true);
});
