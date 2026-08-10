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
  assert.match(integration, /W\. Clint is not presented as active until authenticated evidence proves/);
  assert.match(integration, /AI interviewer using a provider stock avatar; not a real physician/);
});

test('Founder Start waits for session decision and End waits for cleanup before releasing media', () => {
  assert.match(integration, /start\.onclick = async \(\) =>[\s\S]*await ensureAlphaSession\(\)[\s\S]*bridge\.startInterview\(\)/);
  assert.match(integration, /end\.onclick = async \(\) =>[\s\S]*await endAlphaSession\('ended'\)[\s\S]*bridge\.stopMedia\(\)/);
  assert.match(integration, /Session ended — camera and microphone released/);
  assert.match(integration, /avatarState\.setAttribute\('aria-live', 'polite'\)/);
  assert.match(integration, /if \(persisted && state\.alphaSessionId === id\) \{[\s\S]*state\.founderHarness = false;/);
});
