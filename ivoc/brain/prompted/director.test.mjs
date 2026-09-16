import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PromptedMockDirector } from './director.mjs';

const pool = JSON.parse(await readFile(new URL('../../fixtures/question-pool.v1.json', import.meta.url), 'utf8'));

test('Prompted Mock returns deterministic ask moves for Next and spacebar', () => {
  const director = new PromptedMockDirector(pool);
  const first = director.handleInput('next', 'move-1');
  assert.equal(first.question.canonical_id, pool.expanded_question_ids[0]);
  assert.deepEqual(director.handleInput('next', 'move-1'), first);
  assert.equal(director.handleInput('spacebar', 'move-2').question.canonical_id, pool.expanded_question_ids[1]);
  assert.equal(director.handleInput('next', 'move-3').move, 'close');
  assert.throws(() => director.handleInput('auto', 'move-4'), /Next or spacebar/);
});
