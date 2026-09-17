import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const htmlPath = new URL('./IV_PREP_ON_CALL_LIVE_ANALYTICS_STANDALONE.html', import.meta.url);
const html = await readFile(htmlPath, 'utf8');

assert.match(html, /^<!doctype html>/u);
assert.match(html, /data-standalone-review="true"/u);
assert.match(html, /missionmed-standalone" content="deterministic-review-only"/u);
assert.match(html, /data:image\/png;base64,/u);
assert.match(html, /__IVPREP_STANDALONE__/u);
assert.match(html, /fixtureMode: true/u);
assert.match(html, /queueMicrotask\(async \(\) =>/u);
assert.doesNotMatch(html, /<link\b[^>]*rel=["']stylesheet["']/iu);
assert.doesNotMatch(html, /<script\b[^>]*\bsrc=/iu);
assert.doesNotMatch(html, /\b(?:src|href)=["']\/iv-prep-on-call\/assets\//u);
assert.doesNotMatch(html, /\bfetch\s*\(/u);
assert.doesNotMatch(html, /\bnew\s+Worker\b/u);
assert.doesNotMatch(html, /\bgetUserMedia\b/u);
assert.doesNotMatch(html, /LOCAL_TRANSCRIPT_ENDPOINT/u);
assert.equal((html.match(/founder-face-scanner\.png/gu) || []).length, 0);
assert.equal((html.match(/founder-body-scanner\.png/gu) || []).length, 0);

const inlineModule = html.match(/<script type="module">\s*([\s\S]*?)\s*<\/script>/u)?.[1];
assert.ok(inlineModule, 'standalone inline module is required');
const isolatedContext = {
  URLSearchParams,
  clearInterval,
  clearTimeout,
  console,
  performance,
  queueMicrotask,
  setInterval,
  setTimeout,
};
vm.runInNewContext(inlineModule, isolatedContext, {
  filename: 'IV_PREP_ON_CALL_LIVE_ANALYTICS_STANDALONE.inline.mjs',
  timeout: 5_000,
});
assert.equal(isolatedContext.__IVPREP_STANDALONE__?.sourceSha?.length, 40);
assert.equal(isolatedContext.__IVPREP_STANDALONE__?.mode, 'DETERMINISTIC_LOCAL_SIGNALS');
assert.equal(isolatedContext.__IVPREP_STANDALONE__?.providerSessions, 0);

for (const required of [
  'Head / Face Analytics',
  'Body / Posture Analytics',
  'Volume',
  'Speaking Speed',
  'Vocal Variation',
  'Pitch',
  'Customize analytics',
  'DETERMINISTIC_LOCAL_SIGNALS',
  'providerSessions: 0',
]) assert.match(html, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));

const bytes = Buffer.byteLength(html);
const sha256 = createHash('sha256').update(html).digest('hex');
process.stdout.write(`STANDALONE_VERIFY_PASS\nBYTES=${bytes}\nSHA256=${sha256}\n`);
