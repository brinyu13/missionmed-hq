import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = await readFile(new URL('../../public/app.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../../public/styles.css', import.meta.url), 'utf8');

test('B1-514 uses the signed, explicitly enabled V2 feature map', () => {
  assert.match(app, /state\.v2\.session\?\.features\?\.\[key\] === true/);
  assert.match(app, /visibility: session\?\.capabilities\?\.visibilityConsent === true/);
  assert.match(app, /inspiration: session\?\.capabilities\?\.inspiration === true/);
  assert.match(app, /state\.v2\.consent = session\?\.mentorship\?\.consent \|\| null/);
  assert.doesNotMatch(app, /window\.__B1513R3/);
  assert.doesNotMatch(app, /renderHome\s*=\s*b1513/);
});

test('B1-514 visibility is private-safe and does not infer from review status', () => {
  assert.match(app, /return story\?\.visibility === 'mentor_visible' \? 'mentor_visible' : 'private'/);
  assert.match(app, /Historical V1 stories are never silently widened/);
  assert.match(app, /Mentor visibility and formal submission are separate choices/);
  assert.match(app, /\/api\/stories\/\$\{id\}\/visibility/);
});

test('B1-514 recommendations require real API data and the enabled flag', () => {
  const loader = app.match(/async function loadHomeRecommendations\(\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(app, /if \(!isStudent\(\) \|\| !v2FeatureOn\('inspiration'\)\) return \[\]/);
  assert.match(app, /auth\.request\(`\/api\/inspiration\/browse\?query=/);
  assert.match(app, /prompt\?\.recommended === true/);
  assert.doesNotMatch(loader, /R2_QUEUE_SEED|FIXTURE_PERSONA_KEY|FIXTURE_PERSONAS/);
});

test('B1-514 ports the accepted R3 Home, consent, and mentor-audio surfaces', () => {
  for (const marker of [
    'b1513r3Recommends',
    'b1513r3Hud',
    'b1513r3ConsentSheet',
    'b1513r3Feedback',
  ]) {
    assert.match(app, new RegExp(marker));
    assert.match(styles, new RegExp(marker));
  }
  for (const marker of [
    'data-pause-mentor-note',
    'data-resume-mentor-note',
    'Publish transcript + audio',
  ]) {
    assert.match(app, new RegExp(marker.replaceAll('+', '\\+')));
  }
});

test('B1-514 adds first-class theme and energetic environment controls', () => {
  assert.match(app, /\/api\/preferences\/theme/);
  assert.match(app, /data-theme-preference="\$\{value\}"/);
  assert.match(app, /id: 'emberstorm', name: 'Ember Storm'/);
  assert.match(app, /id: 'lumen', name: 'Lumen Drift'/);
  assert.match(styles, /body\[data-theme="light"\]/);
  assert.match(styles, /data-background="emberstorm"/);
  assert.match(styles, /data-background="lumen"/);
  assert.doesNotMatch(styles, /body\[data-theme="light"\][^{]*\{[^}]*!important/s);
});

test('B1-514 mounts four purposeful tellings and governed student-only destinations in the sole renderer', () => {
  for (const marker of [
    'Original telling',
    'Full Story',
    '— Working version',
    '30-Second Version',
    'NNQ Setup',
    'data-version-restore',
    "['inspiration', 'Inspiration'",
    "['requests', 'Request a Story'",
    'Private invitation created',
    'guestRoute',
    'credentials: \'omit\'',
  ]) assert.match(app, new RegExp(marker.replaceAll('[', '\\[')));
  assert.match(app, /state\.capabilities\?\.storyVersions/);
  assert.match(app, /state\.capabilities\?\.requestAStory/);
  assert.match(styles, /\.b1514VersionEditor/);
  assert.match(styles, /\.b1514PromptCard/);
  assert.match(styles, /\.b1514Invitation/);
});

test('B1-514 purposeful tellings preserve append-retell semantics, original audio, and keyboard access', () => {
  assert.match(app, /Append mode — add to the telling, then save/);
  assert.match(app, /Start a fresh retelling\? Your current telling will remain in version history/);
  assert.match(app, /event\.target\.dataset\.saveMode \|\| 'save'/);
  assert.match(app, /Transcript ready to edit\. Original voice will be preserved when you save/);
  assert.match(app, /data-version-audio=/);
  assert.match(app, /Earlier tellings \(/);
  assert.match(app, /inside' : 'over'\} the ~30-second target/);
  assert.match(app, /storyTab && \['ArrowLeft', 'ArrowRight', 'Home', 'End'\]/);
  assert.match(app, /void cancelPurposefulVersionVoice\(\)/);
});

test('Administrator review reuses authorized story telling and signed-audio surfaces without exposing private work', () => {
  assert.match(app, /async function loadAdminStory\(id\)[\s\S]*api\.storyVersions\(id\)/);
  assert.match(app, /function renderAdminStory\(\)[\s\S]*renderStoryRoom\(\{ adminStory: story \}\)/);
  assert.match(app, /function renderStoryRoom\(\{ adminStory = null \} = \{\}\)[\s\S]*audioMarkup\(story\)/);
  assert.doesNotMatch(app, /function adminStoryTellingsMarkup/);
  assert.match(app, /if \(isAdmin\(\) && adminConsoleState\(\)\.story\) renderAdminStory\(\)/);
  assert.match(app, /Private and archived stories are intentionally absent/);
});

test('Administrator scale controls expose bounded paging, session filtering, and saved-view deletion', () => {
  for (const marker of [
    'data-admin-student-page',
    'data-admin-queue-page',
    'id="adminQueueSession"',
    'data-admin-delete-view',
  ]) assert.match(app, new RegExp(marker.replaceAll('.', '\\.')));
  assert.ok(app.includes('api.adminDeleteView(id)'));
  assert.match(app, /admin\.studentPage\*25>=admin\.studentTotal/);
  assert.match(styles, /\.b1514AdminPager/);
});
