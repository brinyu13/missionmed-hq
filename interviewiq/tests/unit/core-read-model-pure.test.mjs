import test from 'node:test';
import assert from 'node:assert/strict';
import { comingSoon } from '../../server/core-read-model.mjs';

// ── comingSoon ──────────────────────────────────────────────────────

test('comingSoon is an array', () => {
  assert.ok(Array.isArray(comingSoon));
});

test('comingSoon has 15 entries', () => {
  assert.equal(comingSoon.length, 15);
});

test('comingSoon is not frozen (plain array constant)', () => {
  // comingSoon is a module-level const but not Object.freeze'd
  assert.ok(!Object.isFrozen(comingSoon));
});

test('comingSoon contains rise', () => {
  assert.ok(comingSoon.includes('rise'));
});

test('comingSoon contains storyforge', () => {
  assert.ok(comingSoon.includes('storyforge'));
});

test('comingSoon contains research', () => {
  assert.ok(comingSoon.includes('research'));
});

test('comingSoon contains mentor', () => {
  assert.ok(comingSoon.includes('mentor'));
});

test('comingSoon contains admin', () => {
  assert.ok(comingSoon.includes('admin'));
});

test('comingSoon contains debrief', () => {
  assert.ok(comingSoon.includes('debrief'));
});

test('comingSoon contains all expected feature names', () => {
  const expected = ['rise', 'storyforge', 'ivoc', 'speech', 'publication', 'research', 'contributions', 'growth', 'mentor', 'admin', 'notifications', 'ranklist', 'debrief', 'prepare', 'export'];
  assert.deepEqual([...comingSoon].sort(), [...expected].sort());
});

test('comingSoon entries are all strings', () => {
  for (const name of comingSoon) {
    assert.equal(typeof name, 'string');
  }
});

test('comingSoon has no duplicates', () => {
  assert.equal(new Set(comingSoon).size, comingSoon.length);
});
