import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../../public/app.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../../public/styles.css', import.meta.url), 'utf8');

function section(start, end) {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `${start} section must exist`);
  return app.slice(from, to);
}

test('Request-a-Story remains in the sole renderer and exposes the accepted default-gated destination', () => {
  assert.equal((app.match(/function renderRequests\(/g) || []).length, 1);
  assert.match(app, /route !== 'requests' \|\| state\.capabilities\?\.requestAStory === true/);
  assert.match(app, /\['requests', 'Request a Story'/);
  assert.match(app, /The people who know you <em>remember stories you can’t\.<\/em>/);
  assert.match(app, /How Request a Story works/);
  assert.match(app, /\['medschool_friend', 'Medical School Friend'\]/);
  for (const phrase of ['Choose someone', 'Personalize', 'They share', 'You receive']) assert.match(app, new RegExp(phrase));
});

test('student create is draft-only and full preview is the only UI path to confirmation', () => {
  const create = section('async function createStoryRequest(', 'function openRequestEditor(');
  assert.match(create, /api\.createRequest\(draft\)/);
  assert.match(create, /api\.previewRequest\(invitation\.id/);
  assert.doesNotMatch(create, /api\.sendRequest/);
  assert.match(app, /Step 2 of 2 · Preview, then send/);
  assert.match(app, /CONFIRM &amp; SEND/);
  assert.match(app, /data-request-confirm-send/);
  assert.match(app, /Sent means accepted by the email service\. Delivered appears only after signed delivery confirmation\./);
  assert.doesNotMatch(app, /innerHTML\s*=\s*preview\.htmlBody/);
});

test('student lifecycle includes draft edit, preview, send, bounded reminder, terminal re-invite, revoke, and honest status explanations', () => {
  for (const endpoint of ['update', 'preview', 'send', 'remind', 'reinvite', 'revoke']) {
    assert.match(app, new RegExp(`/api/requests/\\$\\{id\\}/${endpoint}`));
  }
  for (const control of ['data-request-edit', 'data-request-preview', 'data-request-remind', 'data-request-reinvite', 'data-request-revoke']) {
    assert.match(app, new RegExp(control));
  }
  for (const status of ['Draft', 'Sent', 'Delivered ✓', 'Link visited', 'Started telling', 'Story shared ✓', 'Expired', 'Revoked', 'Bounced — check address']) {
    assert.match(app, new RegExp(status));
  }
  assert.match(app, /Number\(item\.remindersSent \|\| 0\) < 2/);
  assert.match(app, /The bounced link stays dead/);
});

test('guest journey records started explicitly, shows one governed question, reviews words, and offers one more after thanks', () => {
  const guest = section('function renderGuestContribution()', 'async function initGuest(');
  assert.match(app, /api\/requests\/guest\/\$\{guest\.route\.token\}\/started/);
  assert.match(guest, /guest\.promptIndex % Math\.max\(1, prompts\.length\)/);
  assert.match(guest, /A different question/);
  assert.match(guest, /id="guestDraftForm"/);
  assert.match(guest, /Review before sharing/);
  assert.match(guest, /id="guestReviewForm"/);
  assert.match(guest, /Nothing is shared until you press the button below/);
  assert.match(guest, /Thank you\. ❤/);
  assert.match(guest, /Tell another story/);
  assert.match(app, /kind: 'text'/);
});

test('guest voice uses bounded token routes, near-live transcription, explicit review, and interruption cleanup', () => {
  const voice = section('function guestVoiceMimeType()', 'function renderGuestContribution()');
  assert.match(voice, /new MediaRecorder\(stream, \{ mimeType \}\)/);
  assert.match(voice, /recorder\.start\(15_000\)/);
  assert.match(voice, /voice\/\$\{voice\.recordingId\}\/segments/);
  assert.match(voice, /voice\/\$\{voice\.recordingId\}\/retry/);
  assert.match(voice, /method: 'DELETE'/);
  assert.match(voice, /transcribe_failed/);
  assert.match(app, /Nothing is shared until you press the button below/);
  assert.match(app, /voice\/\$\{guest\.voice\.recordingId\}\/finish/);
  assert.match(app, /transcript: guest\.text/);
  assert.match(app, /addEventListener\('pagehide'/);
  assert.match(app, /keepalive: true/);
  assert.match(app, /instanceof FormData/);
});

test('guest and student untrusted fields stay escaped and the text contribution remains bounded', () => {
  assert.match(app, /maxlength="20000"/);
  assert.match(app, /esc\(invitation\.personalMessage\)/);
  assert.match(app, /esc\(guestPromptText\(prompt\.text, firstName\)\)/);
  assert.match(app, /esc\(guest\.text\)/);
  assert.match(app, /esc\(item\.transcript\)/);
  assert.match(app, /credentials: 'omit'/);
  assert.match(app, /cache: 'no-store'/);
  assert.match(app, /data-contribution-audio=/);
  assert.match(app, /api\.contributionPlayback\(contributionId\)/);
  assert.match(app, /Original guest story recording/);
});

test('Request-a-Story additions are namespaced, responsive, and use existing StoryForge tokens', () => {
  for (const selector of ['.b1514RaProcess', '.b1514RaJourney', '.b1514RaPreviewGrid', '.b1514RaGuestQuestion', '.b1514RaVoiceOrb']) {
    assert.match(styles, new RegExp(selector.replace('.', '\\.')));
  }
  assert.match(styles, /@media\(max-width:900px\)/);
  assert.match(styles, /@media\(max-width:560px\)/);
  assert.match(styles, /var\(--card\)/);
  assert.match(styles, /var\(--em\)/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\).*\.b1514RaVoiceOrb/s);
});
