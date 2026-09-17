import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const ROOT = new URL('../../fixtures/analytics/', import.meta.url);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('sealed manifest authenticates every synthetic ground-truth fixture', async () => {
  const manifestBytes = await readFile(new URL('manifest.v1.json', ROOT));
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.schema, 'missionmed.ivprep.analytics.fixtures.v1');
  assert.equal(manifest.dataPolicy, 'synthetic-only');
  assert.ok(manifest.fixtures.length >= 5);

  for (const fixture of manifest.fixtures) {
    assert.match(fixture.path, /\.json$/u);
    assert.match(fixture.sha256, /^[a-f0-9]{64}$/u);
    const bytes = await readFile(new URL(fixture.path, ROOT));
    assert.equal(sha256(bytes), fixture.sha256, fixture.path);
    assert.doesNotThrow(() => JSON.parse(bytes), fixture.path);
  }
});
