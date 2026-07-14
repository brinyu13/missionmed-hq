import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const htmlPath = new URL('../public/index.html', import.meta.url);
const cssPath = new URL('../public/styles.css', import.meta.url);
const appPath = new URL('../public/app.js', import.meta.url);

test('review app exposes all twelve primary workflows', async () => {
  const html = await readFile(htmlPath, 'utf8');
  const screens = [...html.matchAll(/data-screen="([a-z]+)"/gu)].map((match) => match[1]);
  assert.equal(screens.length, 12);
  assert.deepEqual(screens, [
    'dashboard', 'inventory', 'transcript', 'triage', 'editor', 'evidence',
    'editorial', 'physician', 'diff', 'search', 'release', 'incidents',
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

test('navigation has explicit Enter and Space activation support', async () => {
  const app = await readFile(appPath, 'utf8');
  assert.match(app, /addEventListener\('keydown'/u);
  assert.match(app, /\['Enter', ' '\]\.includes\(event\.key\)/u);
  assert.match(app, /button\.click\(\)/u);
});
