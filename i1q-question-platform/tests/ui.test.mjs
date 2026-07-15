import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const htmlPath = new URL('../public/index.html', import.meta.url);
const cssPath = new URL('../public/styles.css', import.meta.url);
const appPath = new URL('../public/app.js', import.meta.url);

test('review app exposes all seventeen required workflows', async () => {
  const html = await readFile(htmlPath, 'utf8');
  const screens = [...html.matchAll(/data-screen="([a-z]+)"/gu)].map((match) => match[1]);
  assert.equal(screens.length, 17);
  assert.deepEqual(screens, [
    'dashboard', 'inventory', 'source', 'privacy', 'transcript', 'extraction',
    'triage', 'editor', 'distractors', 'evidence', 'editorial', 'physician',
    'diff', 'search', 'release', 'incidents', 'audit',
  ]);
});

test('static shell has accessible landmarks, live regions, and named controls', async () => {
  const html = await readFile(htmlPath, 'utf8');
  assert.match(html, /<main id="workspace"/u);
  assert.match(html, /<nav id="primary-nav"/u);
  assert.match(html, /aria-live="polite"/u);
  assert.match(html, /aria-live="assertive"/u);
  const buttons = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gu)];
  assert.ok(buttons.length > 0);
  for (const [, attributes, content] of buttons) {
    assert.ok(content.replace(/<[^>]+>/gu, '').trim() || /aria-label="[^"]+"/u.test(attributes), 'all buttons need an accessible name');
  }
});

test('responsive, focus, reduced-motion, and non-color status rules exist', async () => {
  const css = await readFile(cssPath, 'utf8');
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\.badge::before/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient/);
});

test('navigation uses native keyboard-activated buttons', async () => {
  const html = await readFile(htmlPath, 'utf8');
  const nav = html.match(/<nav id="primary-nav"[\s\S]*?<\/nav>/u)?.[0] || '';
  const controls = [...nav.matchAll(/<button\b([^>]*)data-screen="([a-z]+)"([^>]*)>/gu)];
  assert.equal(controls.length, 17);
  for (const [, before, , after] of controls) {
    assert.match(`${before}${after}`, /type="button"/u);
    assert.doesNotMatch(`${before}${after}`, /tabindex="(?:-[^1]|[1-9])/u);
  }
});

test('client declares every required operational state and privacy class', async () => {
  const app = await readFile(appPath, 'utf8');
  for (const state of [
    'loading', 'empty', 'blocked', 'unauthorized', 'error', 'partial-source',
    'privacy-blocked', 'rights-blocked', 'expired-evidence', 'review-conflict',
    'stale-edit', 'concurrent-edit', 'extraction-queued', 'extraction-running',
    'extraction-failed', 'extraction-resumable',
  ]) {
    assert.match(app, new RegExp(`'${state}'`, 'u'));
  }
  for (const privacyClass of [
    'NON_DRJ_SPEECH', 'STUDENT_NAME', 'STUDENT_OTHER_IDENTIFIER',
    'PATIENT_DIRECT_IDENTIFIER', 'PATIENT_QUASI_IDENTIFIER',
    'THIRD_PARTY_IDENTITY', 'IDENTIFYING_CLINICAL_ANECDOTE', 'SOURCE_METADATA',
  ]) {
    assert.match(app, new RegExp(`'${privacyClass}'`, 'u'));
  }
});
