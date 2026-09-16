import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { assertPresentationBoundary } from '../contracts/presentation-boundary.mjs';

test('M1 UI observes the capability boundary and preserves truth copy', async () => {
  const paths = ['ivoc/ui/runtime.mjs', 'ivoc/ui/adapters/m1-view-model.mjs'];
  const files = await Promise.all(paths.map(async (path) => ({ path, source: await readFile(new URL(path.replace('ivoc/ui/', './'), import.meta.url), 'utf8') })));
  assert.equal(assertPresentationBoundary(files), true);
  const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
  assert.match(html, /INTERNAL M1 HARNESS · NOT PRODUCT UI/u);
  assert.match(html, /not the Founder-facing IVOC product shell/u);
  assert.match(html, /Missing signals stay missing/u);
  assert.match(html, /No emotion, honesty, anxiety, personality, competence or fit inference/u);
});
