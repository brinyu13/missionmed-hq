import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const htmlUrl = new URL('../../public/studio/index.html', import.meta.url);
const cssUrl = new URL('../../public/studio/studio.css', import.meta.url);
const runtimeUrl = new URL('../../public/studio/studio.mjs', import.meta.url);

const html = await readFile(htmlUrl, 'utf8');
const css = await readFile(cssUrl, 'utf8');
const runtime = await readFile(runtimeUrl, 'utf8');

const digest = (value) => createHash('sha256').update(value).digest('hex');

test('the Founder-facing root declares the sealed Astra candidate.2 presentation lineage', () => {
  assert.match(html, /astra-candidate\.2:dedb726bde521a135bec2286ad4cd5a877a68fc7ecd6144fde16b76bc9c09ac4/u);
  assert.match(html, /<title>IV Prep On-Call · MissionMed<\/title>/u);
  assert.doesNotMatch(html, /<title>[^<]*Performance Studio/iu);
  for (const label of ['Home', 'Build Interview', 'Questions', 'Program Prep', 'Performances',
    'My Progress', 'Performance Intelligence', 'Answer History &amp; Clips',
    'My Interview Context', 'Real Interview Debrief']) {
    assert.match(html, new RegExp(`>${label}(?:\\s|<)`, 'u'), `${label} navigation is missing`);
  }
});

test('the amended six-step builder and independent Question Pool survive integration', () => {
  for (const label of ['Practice Goal', 'Question Plan', 'Interviewer', 'Program',
    'Environment + Context', 'Readiness + Calibration']) {
    assert.match(runtime, new RegExp(`label: '${label.replace('+', '\\+')}'`, 'u'), `${label} step is missing`);
  }
  assert.match(html, /aria-label="Your Question Pool"/u);
  assert.match(html, /id="builder-target"/u);
  assert.match(runtime, /targetQuestions: 5/u);
  assert.match(runtime, /Pool size and session target|target about \$\{state\.targetQuestions\}/u);
});

test('the exact Astra image and font assets are copied with immutable provenance', async () => {
  const expected = new Map([
    ['iv-prep-on-call.png', '9013ad791ce8c004cfe630c26833c4482438891bc2218865ee97ff5604a4d8ab'],
    ['rise.png', '0991518645c5b124f78f13194ae33ee0e8e1db5e89dd2574602d15437dbc972b'],
    ['storyforge.png', '08a8ac3a6e647c69752142c9e3628853acbd605760844711acdf59b2333d0149'],
    ['synthetic-candidate.png', '073ca3fae64a3615aa93b2d377af0ef9b6b64e500d3fdd260b043e55a67706b7'],
  ]);
  for (const [name, sha256] of expected) {
    const value = await readFile(new URL(`../../public/studio/astra-assets/${name}`, import.meta.url));
    assert.equal(digest(value), sha256, `${name} drifted from the verified Astra source`);
  }
  for (const family of ['Archivo', 'Lora', 'Rajdhani']) assert.match(css, new RegExp(`font-family: ${family}`, 'u'));
});

test('presentation integration preserves the proven analytics and media contract anchors', () => {
  for (const id of ['founder-student-video', 'founder-student-stage', 'founder-room-stage',
    'founder-room-wrapper', 'playback', 'communication-analytics-test-root', 'cockpit-video']) {
    assert.match(html, new RegExp(`id="${id}"`, 'u'), `${id} capability host is missing`);
  }
  assert.match(runtime, /initializeAnalyticsUi\(bridge/u);
  assert.match(runtime, /state\.analytics\.onDiagnostic/u);
  assert.match(runtime, /bridge\.primeAudioContext\(\)/u);
  assert.match(runtime, /DurableStudioSession/u);
  assert.match(runtime, /state\.durable\.start/u);
  assert.match(runtime, /state\.durable\.finish/u);
  assert.match(runtime, /state\.durable\.library\('own'\)/u);
});

test('role view controls are bounded by the authenticated MissionMed identity', () => {
  assert.match(runtime, /function permittedRoles\(\)/u);
  assert.match(runtime, /allowed\.has\(role\) \? role : 'student'/u);
  assert.match(runtime, /button\.hidden = !authorized/u);
});

test('the product document has unique element ids', () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/gu)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
});
