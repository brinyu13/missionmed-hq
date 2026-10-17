import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

const ROOT = new URL('../../public/assets/vendor/vad-web/0.0.30/', import.meta.url);
const EXPECTED = Object.freeze({
  'bundle.min.js': '206cf2ca0bacee64f115eba1769e33ce68bd979c9b53be31e6e0ec0edbab9ff8',
  'bundle.min.js.LICENSE.txt': '85d829adcdee0fe0a5caa95c238f9e4d49758f2b222944171f5d2e8f926e01b4',
  'ort-wasm-simd-threaded.mjs': '30dd851d9c00622940500f71ddd2ff8820c5cb65270816080175b958705385a8',
  'ort-wasm-simd-threaded.wasm': '71aef04959c5c1b6de461b6538e2058e306610034a85aad2742d0c7fd4533fe4',
  'ort.min.js': '924e4fcdfdf69acccff3d024d6e1ad3f41ca858d27fc4dd59fc4927dd933e7db',
  'silero_vad_v5.onnx': '2623a2953f6ff3d2c1e61740c6cdb7168133479b267dfef114a4a3cc5bdd788f',
  'vad.worklet.bundle.min.js': '8a48fdc7429948a2fde3d29a84bb1a64c1f67b4ba578ccaa7548b7f989f06a74',
});

test('Silero v5 and ONNX assets are exact, bounded, and self-only', async () => {
  let bytes = 0;
  for (const [name, expected] of Object.entries(EXPECTED)) {
    const body = await readFile(new URL(name, ROOT));
    const actual = createHash('sha256').update(body).digest('hex');
    assert.equal(actual, expected, name);
    bytes += (await stat(new URL(name, ROOT))).size;
  }
  assert(bytes < 16_000_000, `unexpected VAD footprint: ${bytes}`);
  const html = await readFile(new URL('../../public/live-analytics/index.html', import.meta.url), 'utf8');
  assert.match(html, /\/iv-prep-on-call\/assets\/vendor\/vad-web\/0\.0\.30\/ort\.min\.js/u);
  assert.match(html, /\/iv-prep-on-call\/assets\/vendor\/vad-web\/0\.0\.30\/bundle\.min\.js/u);
  assert.doesNotMatch(html, /https?:\/\/[^"']*(?:vad|onnx|silero)/iu);
});
