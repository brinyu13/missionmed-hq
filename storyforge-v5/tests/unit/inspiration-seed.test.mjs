import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { normalizePromptLibrary } from '../../scripts/seed-inspiration-prompts.mjs';

test('canonical Inspiration library yields 81 stable server-owned identifiers', async () => {
  const source = JSON.parse(await readFile(new URL('../../content/inspiration-prompts.json', import.meta.url), 'utf8'));
  const first = normalizePromptLibrary(source);
  const second = normalizePromptLibrary(source);
  assert.equal(first.length, 81);
  assert.deepEqual(first, second);
  assert.equal(new Set(first.map((prompt) => prompt.id)).size, 81);
  assert.equal(new Set(first.map((prompt) => prompt.libraryKey)).size, 81);
  assert.ok(first.every((prompt) => /^[a-f0-9-]{36}$/.test(prompt.id)));
});
