import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { buildOwnerIntegrationFacts } from '../../public/studio/presentation-view-model.mjs';

test('actual Admin renderer identifies required embodiment without inventing provider acceptance', () => {
  const source = readFileSync(new URL('../../public/studio/studio.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('function renderIntegrationFacts(');
  const end = source.indexOf('\nlet adminOverviewRenderId', start);
  assert.ok(start >= 0 && end > start);
  let facts;
  vm.runInNewContext(source.slice(start, end) + '\nrenderIntegrationFacts({});', {
    state: { durable: { bootstrapPayload: { capabilities: { contextSources: {} } } } },
    buildOwnerIntegrationFacts,
    renderAdminFacts(_host, rows) { facts = rows; },
  });
  const embodiment = facts.find(fact => fact.label === 'LemonSlice');
  assert.equal(embodiment.value, 'REQUIRED · ACCEPTANCE PENDING');
  assert.equal(embodiment.state, 'limited');
  assert.doesNotMatch(embodiment.value, /DEFERRED|VERIFIED|READY|ACTIVE/);
  // Only the presentation status changes; no provider create or activation is involved.
});
