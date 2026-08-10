import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../../public/index.html', import.meta.url), 'utf8');
const integration = await readFile(new URL('../../public/v6-integration.mjs', import.meta.url), 'utf8');

test('Founder journey has an obvious entry, exact Dexter identity, and no simulated join chain', () => {
  assert.match(index, /id="test-live-interviewer"[^>]*>TEST LIVE INTERVIEWER</);
  assert.match(index, /function testLiveInterviewer\(\)\{\s*enterApp\('admin'\);nav\('registry'\)/);
  assert.doesNotMatch(index, /function testLiveInterviewer\(\)\{\s*if\(window\.V6Frontier\?\.openFounderHarness\)/);
  assert.match(integration, /Founder Conversation Rail \+ Model \+ Voice Studio/);
  assert.match(index, /Dexter · MissionMed AI Faculty/);
  assert.match(index, /founderLive=window\.V6Frontier\?\.state\?\.founderHarness===true/);
  assert.match(index, /if\(founderLive\)\{ivSet\(false,false\);toast\('Connecting the selected live interviewer\. No simulated participant state is shown\.'/);
  assert.match(index, /if\(!founderLive&&talk&&RUN\.qi===0\)/);
});

test('Founder preflight exposes actual audible voice and audio authority without relabeling W. Clint', () => {
  assert.match(integration, /Audible interviewer: \$\{state\.audibleVoiceTruth\}/);
  assert.match(integration, /Audio authority: \$\{state\.audioAuthority\}/);
  assert.match(integration, /Authenticated evidence confirms both records, but LITE exposes no W\. Clint voice selector/);
  assert.match(integration, /bd43ce31-7425-4379-8407-60f029548e61/);
  assert.match(integration, /a33a57ab-8388-49fc-a069-dbcfd1bc5405/);
  assert.match(integration, /PROVIDER CREDITS REQUIRED/);
  assert.match(integration, /synchronized supplied OpenAI cedar PCM is the configured audible path/);
  assert.match(integration, /AI interviewer using a provider stock avatar; not a real physician/);
});

test('Founder Start waits for session decision and End waits for cleanup before releasing media', () => {
  assert.match(integration, /start\.onclick = async \(\) =>[\s\S]*await ensureAlphaSession\(\)[\s\S]*bridge\.startInterview\(\)/);
  assert.match(integration, /end\.onclick = async \(\) =>[\s\S]*await endAlphaSession\('ended'\)[\s\S]*bridge\.stopMedia\(\)/);
  assert.match(integration, /Session ended — provider cleanup acknowledged; camera and microphone released/);
  assert.match(integration, /Remote avatar cleanup is unconfirmed — click End interview to retry/);
  assert.match(integration, /avatarState\.setAttribute\('aria-live', 'polite'\)/);
  assert.match(integration, /if \(persisted && avatarCleanup\.acknowledged && state\.alphaSessionId === id\) \{[\s\S]*state\.founderHarness = false;/);
  assert.match(integration, /founder-test-reconnect/);
  assert.match(integration, /Export avatar evidence/);
  assert.match(integration, /Y1-Y2-CAM-V6-3430-avatar-evidence-final-/);
  assert.match(integration, /visualLipSyncRequiresHumanObservation: true/);
  assert.match(integration, /visibleMouthStopRequiresHumanObservation: true/);
});
