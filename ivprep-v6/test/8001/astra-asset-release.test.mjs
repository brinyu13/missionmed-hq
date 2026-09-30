import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const assets = join(root, 'ivprep-v6/public/studio/astra-assets');
const html = readFileSync(join(root, 'ivprep-v6/public/studio/index.html'), 'utf8');
const script = readFileSync(join(root, 'ivprep-v6/public/studio/studio.mjs'), 'utf8');
const railwayIgnore = readFileSync(join(root, '.railwayignore'), 'utf8');

test('Astra presentation photos use release-eligible, lossless WebP assets', () => {
  assert.doesNotMatch(railwayIgnore, /^\*\.webp\s*$/mu);
  for (const name of ['iv-prep-on-call', 'rise', 'storyforge', 'synthetic-candidate']) {
    const path = join(assets, `${name}.webp`);
    assert.equal(existsSync(path), true, `${name} must ship with the release`);
    const bytes = readFileSync(path);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    assert.ok(html.includes(`${name}.webp`) || script.includes(`${name}.webp`));
    assert.ok(!html.includes(`${name}.png`) && !script.includes(`${name}.png`));
  }
});
