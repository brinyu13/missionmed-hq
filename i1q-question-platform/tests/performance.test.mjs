import assert from 'node:assert/strict';
import test from 'node:test';
import { performance } from 'node:perf_hooks';
import { MemoryRepository } from '../src/store.mjs';

test('in-memory candidate queue remains bounded under synthetic load', () => {
  const repository = new MemoryRepository();
  const started = performance.now();
  for (let index = 0; index < 5_000; index += 1) {
    repository.create('extraction_candidates', {
      ordinal: index,
      state: index % 2 ? 'candidate' : 'quarantined',
    }, { id: `candidate_${String(index).padStart(6, '0')}` });
  }
  const page = repository.list('extraction_candidates', { limit: 50 });
  const elapsedMs = performance.now() - started;
  assert.equal(page.rows.length, 50);
  assert.equal(page.total, 5_000);
  assert.ok(elapsedMs < 4_000, `synthetic load took ${elapsedMs.toFixed(1)} ms`);
});
