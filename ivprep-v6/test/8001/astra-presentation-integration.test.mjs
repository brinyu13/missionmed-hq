import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const htmlUrl = new URL('../../public/studio/index.html', import.meta.url);
const legacyHtmlUrl = new URL('../../public/aaa/index.html', import.meta.url);
const cssUrl = new URL('../../public/studio/studio.css', import.meta.url);
const runtimeUrl = new URL('../../public/studio/studio.mjs', import.meta.url);
const liveCompatibilityUrl = new URL('../../public/studio/live-interview.mjs', import.meta.url);
const adminLibraryUrl = new URL('../../public/capabilities/admin-student-library.mjs', import.meta.url);

const html = await readFile(htmlUrl, 'utf8');
const legacyHtml = await readFile(legacyHtmlUrl, 'utf8');
const css = await readFile(cssUrl, 'utf8');
const runtime = await readFile(runtimeUrl, 'utf8');
const liveCompatibility = await readFile(liveCompatibilityUrl, 'utf8');
const adminLibrary = await readFile(adminLibraryUrl, 'utf8');

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

test('Matrix return links cross the hosted IVOC boundary to the canonical WordPress Matrix', () => {
  for (const document of [html, legacyHtml]) {
    assert.match(document, /href="https:\/\/missionmedinstitute\.com\/member-dashboard\/"/u);
    assert.doesNotMatch(document, /href="\/member-dashboard\/"/u);
  }
});

test('the amended six-step builder and independent Question Pool survive integration', () => {
  for (const label of ['Practice Goal', 'Question Pool', 'Interviewer', 'Program',
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
  assert.match(runtime, /state\.durable\.analyze/u);
  assert.match(runtime, /state\.durable\.programs/u);
  assert.match(runtime, /Verified RISE program selected/u);
  assert.match(html, /id="context-analyze"/u);
  assert.match(html, /Available transcript and evidence-cited analysis are saved privately/u);
  assert.match(html, /id="device-proceed" disabled/u);
  assert.match(html, /id="simulation-rail"/u);
  assert.match(runtime, /Start AI interview ▸/u);
  assert.match(runtime, /await startLiveInterview\(\)/u);
  assert.match(html, /data-goto="devicecheck" data-launch-mode="practice">Practice one question myself/u);
  assert.match(html, />Build an interview ▸</u);
});

test('the active presentation consumes production behavior through the stable capability boundary', () => {
  assert.match(runtime, /from '\.\/capability-adapter\.mjs'/u);
  assert.match(runtime, /from '\.\/presentation-view-model\.mjs'/u);
  for (const implementation of [
    '../aaa/api-client.mjs', '../questions/question-store.mjs', './durable-session.mjs',
    './metric-bus.mjs', './live-interview.mjs', './longitudinal-model.mjs',
  ]) assert.doesNotMatch(runtime, new RegExp(`from '${implementation.replaceAll('.', '\\.')}'`, 'u'));
  assert.match(css, /\.builder-layout > \.pool-summary \{ display: grid; \}/u);
  assert.doesNotMatch(css, /\.builder-layout > \.pool-summary \{ display: none; \}/u);
  for (const studentJargon of ['student-scoped Scheduler projection', 'Canonical transcript signals', 'hidden-trait inference']) {
    assert.doesNotMatch(runtime, new RegExp(studentJargon, 'u'));
  }
  assert.doesNotMatch(html, /InterviewBrain · Live voice/u);
});

test('GPT-Live remains behind a presentation-neutral capability adapter', () => {
  assert.match(liveCompatibility, /\.\.\/capabilities\/live-interview\.mjs/u);
  assert.match(runtime, /new LiveInterviewSession\(/u);
  assert.match(runtime, /createSession: createLiveInterview/u);
  assert.match(runtime, /endSession: endLiveInterview/u);
});

test('role view controls are bounded by the authenticated MissionMed identity', () => {
  assert.match(runtime, /function permittedRoles\(\)/u);
  assert.match(runtime, /allowed\.has\(role\) \? role : 'student'/u);
  assert.match(runtime, /button\.hidden = !authorized/u);
});

test('Answer History exposes question and evidence filters without inventing semantic claims', () => {
  assert.match(runtime, /Filter Answer History/u);
  assert.match(runtime, /Supported semantic evidence/u);
  assert.match(runtime, /supportedObservationCount/u);
  assert.match(runtime, /Transcript · no supported semantic observations/u);
  assert.match(runtime, /renderId !== vaultRenderId \|\| state\.view !== 'vault'/u);
  assert.match(runtime, /results\.innerHTML = '<span>Review answer<\/span>'/u);
  assert.match(runtime, /const canReview = Boolean\(session\.results/u);
  assert.match(runtime, /renderFullAnalyticsReport\(analytics\)/u);
  assert.match(html, /id="post-analytics-report"/u);
  assert.match(html, /id="post-provenance"/u);
  assert.match(html, /id="post-analytics-report" aria-live="polite"/u);
  assert.match(html, /no emotion, personality, or program-fit inference/u);
});

test('verified program search becomes actionable when the visible query changes', () => {
  assert.match(runtime, /const updateProgramSearchAvailability = \(\) =>/u);
  assert.match(runtime, /input\.addEventListener\('input',[\s\S]*updateProgramSearchAvailability\(\)/u);
  assert.match(runtime, /state\.durable\.programs\(\{/u);
  assert.match(runtime, /event\.key !== 'Enter'[\s\S]*searchButton\?\.click\(\)/u);
});

test('journey actions expose truthful prerequisites instead of false ready states', () => {
  assert.match(html, /id="cockpit-start" disabled/u);
  assert.match(html, /id="cockpit-finish" disabled/u);
  assert.match(html, /id="live-interview-start" disabled/u);
  assert.match(runtime, /function wizardStepComplete\(index\)/u);
  assert.match(runtime, /wizardStepComplete\(index\) \? 'complete'/u);
  assert.match(runtime, /CHOOSE AT LEAST ONE QUESTION BEFORE STARTING/u);
  assert.match(runtime, /Choose at least one question before entering the Interview Room/u);
  assert.match(runtime, /const measuring = state\.session\.state === 'RUNNING'/u);
  assert.match(runtime, /Complete device calibration to begin measurement/u);
});

test('Live Mock Studio stays behind the Scheduler owner capability boundary', () => {
  assert.match(runtime, /LiveMockStudioCapability/u);
  assert.match(runtime, /authorized recording readiness/u);
  assert.match(runtime, /renderId !== liveMockRenderId \|\| state\.role !== 'admin'/u);
  assert.match(html, /id="live-mock-studio" data-admin-only/u);
});

test('Calendar context stays behind a minimized Scheduler capability adapter', () => {
  assert.match(runtime, /InterviewCalendarCapability/u);
  assert.match(runtime, /state\.calendar\.studentCalendar\(\)/u);
  assert.match(runtime, /Join details/u);
  assert.match(runtime, /renderProgramCalendar\(host\)/u);
});

test('presentation loads analytics only through the capability adapter', () => {
  assert.match(runtime, /loadAnalyticsCapabilityModules/u);
  assert.doesNotMatch(runtime, /import\('\.\.\/analytics\//u);
});

test('Founder-amended StoryForge consent and flagship readiness compositions remain present', () => {
  assert.match(runtime, /Yes, show suggestions/u);
  assert.match(runtime, /No, practice unaided/u);
  assert.match(runtime, /Include authorized matching stories/u);
  assert.match(runtime, /storyForgeInclude: false/u);
  assert.match(runtime, /No verified story suggestion is available for this draft yet/u);
  assert.doesNotMatch(runtime, /storyForgeInclude = enabled/u);
  assert.match(runtime, /Visual signals/u);
  assert.match(runtime, /Voice signals/u);
  assert.match(runtime, /Know what is actually ready/u);
  assert.match(css, /grid-template-columns: minmax\(0, 1\.08fr\) minmax\(0, \.92fr\)/u);
  assert.match(css, /\.canon-signal-pick, \.canon-story-include/u);
  assert.match(css, /\.canon-readiness-preview \.stage \{ width: 100%; min-height: 0; height: clamp\(220px, 28vw, 310px\); aspect-ratio: auto; \}/u);
});

test('student presentation does not expose implementation status residue', () => {
  assert.doesNotMatch(runtime, /HYBRID FOLLOW-UP ROUTER PENDING|DR KELLY \/ DR WOODS PACKS PENDING|IVOC does not store the owner URL/iu);
  assert.doesNotMatch(runtime, /No canonical question/iu);
  assert.doesNotMatch(html, /canonical questions/iu);
});

test('Admin student traversal stays behind the stable private-library capability boundary', () => {
  assert.match(runtime, /AdminStudentLibraryCapability/u);
  assert.match(runtime, /state\.adminLibrary\.overview\(\)/u);
  assert.match(runtime, /state\.adminLibrary\.session\(session\.id\)/u);
  assert.match(runtime, /state\.adminLibrary\.playback\(session\.recording\.id\)/u);
  assert.match(adminLibrary, /this\.api\.library\('all'\)/u);
  assert.match(adminLibrary, /this\.api\.session\(id\)/u);
  assert.match(adminLibrary, /this\.api\.playback\(id\)/u);
  assert.match(html, /id="admin-student-library" data-admin-only/u);
});

test('the product document has unique element ids', () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/gu)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
});
