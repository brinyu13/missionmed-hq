import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../../public/app.js', import.meta.url), 'utf8');
const serverSource = await readFile(new URL('../../server/app.mjs', import.meta.url), 'utf8');
const stylesSource = await readFile(new URL('../../public/styles.css', import.meta.url), 'utf8');

test('real MediaRecorder capture uses the PostgreSQL audio discriminator everywhere', () => {
  assert.match(appSource, /new MediaRecorder\(/);
  assert.match(
    appSource,
    /captureType:\s*\(?\s*recordingId\s*\|\|\s*recordedBlob\s*\)?\s*\?\s*'audio'\s*:\s*'text'/,
  );
  assert.doesNotMatch(appSource, /captureType\s*(?:===|!==)\s*'voice'/);
  assert.match(appSource, /captureType\s*===\s*'audio'.*voice note/);
});

test('Quick Capture is wired to account-scoped durable draft restore and save', () => {
  assert.match(appSource, /storyDraft:\s*\(\)\s*=>\s*auth\.request\('\/api\/drafts\/story-builder'\)/);
  assert.match(appSource, /saveStoryDraft:.*\/api\/drafts\/story-builder/);
  assert.match(appSource, /scheduleCaptureDraftSave\(\)/);
  assert.match(appSource, /Draft restored from your account\./);
  assert.match(appSource, /draftVersion:\s*state\.captureDraftVersion/);
  assert.doesNotMatch(appSource, /await clearCaptureDraft\(\)/);
});

test('story detail returns real audit history and the UI offers curated expansion', () => {
  assert.match(serverSource, /FROM public\.sf_audit_events\s+WHERE story_id = \$1\s+ORDER BY created_at DESC, id DESC/);
  assert.match(serverSource, /history:\s*history\.rows/);
  assert.match(appSource, /events\.slice\(0,\s*6\)/);
  assert.match(appSource, /Show full history/);
  assert.match(appSource, /actor_display/);
});

test('question governance and file import have explicit production UI paths', () => {
  assert.match(appSource, /approveQuestion:.*\/api\/questions\/\$\{id\}\/approve/);
  assert.match(appSource, /data-approve-question/);
  assert.match(appSource, /id="importFile".*accept="\.csv,\.xlsx/);
  assert.match(appSource, /dataBase64:\s*arrayBufferToBase64/);
  assert.match(appSource, /admin:\s*\[\s*\['qlib',\s*'Question Library'/);
  assert.match(appSource, /if \(isAdmin\(\)\) \{\s*if \(state\.route === 'qlib'\)/);
  assert.match(appSource, /canGovernQuestions\(\).*governanceState/s);
  assert.match(appSource, /event\.key === 'N'\) && isStudent\(\)/);
});

test('notification badges retain red identity with dark accessible text', () => {
  assert.match(stylesSource, /\.rtab \.badge\{[^}]*background:var\(--rd\);color:#0a0d14/);
});
