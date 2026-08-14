import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const [html, app, styles, build] = await Promise.all([
  readFile(path.join(packageDir, 'public/index.html'), 'utf8'),
  readFile(path.join(packageDir, 'public/app.js'), 'utf8'),
  readFile(path.join(packageDir, 'public/styles.css'), 'utf8'),
  readFile(path.join(packageDir, 'scripts/build-static.mjs'), 'utf8'),
]);

test('B1-515R2 opening uses the exact integrated lockup and selected subtitle', () => {
  for (const copy of [
    "DR BRIAN'S",
    'MATCH PREP ON-CALL',
    'Story<span>Forge</span>',
    'TURN THE MOMENTS THAT MADE YOU INTO STORIES YOU CAN USE.',
  ]) assert.match(html, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(html, /IV PREP ON-CALL/i);
  assert.match(html, /aria-labelledby="storyforgeOpeningTitle"/);
});

test('runtime cannot inject the raw logo path that broke production', () => {
  assert.doesNotMatch(app, /missionmed-logo\.png/);
  assert.match(build, /runtime code must not inject an unmanifested MissionMed logo path/);
});

test('opening remains bounded, reduced-motion safe, and separate from route loading', () => {
  assert.match(app, /OPENING_MINIMUM_MS = 1650/);
  assert.match(app, /OPENING_REDUCED_MOTION_MS = 650/);
  assert.match(app, /await renderRoute\(\);\s+await completeOpeningExperience\(\);/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)[^{]*\{[^}]*\.storyforgeOpening/s);
  assert.match(styles, /\.introSpark\{display:none\}/);
  const openingStyles = styles.slice(
    styles.indexOf('B1-515R2 signature opening'),
    styles.indexOf('/* ============ SHELL', styles.indexOf('B1-515R2 signature opening')),
  );
  assert.doesNotMatch(openingStyles, /@keyframes\s+(?:flash|strobe|blink)\b/i);
});

test('opening sound is default-off, server-persisted, user-gesture safe, and never requests a microphone', () => {
  assert.match(app, /opening_sound_enabled === true/);
  assert.match(app, /\/api\/preferences\/opening-sound/);
  assert.match(app, /navigator\.userActivation/);
  assert.match(app, /Promise\.race\(\[\s*context\.resume\(\)[\s\S]*delay\(250\)/);
  assert.match(app, /role="switch"[^>]*aria-checked=/);
  const openingSoundStart = app.indexOf('async function playOpeningSound');
  const openingSoundEnd = app.indexOf('async function completeOpeningExperience', openingSoundStart);
  assert.ok(openingSoundStart > -1 && openingSoundEnd > openingSoundStart);
  assert.doesNotMatch(app.slice(openingSoundStart, openingSoundEnd), /getUserMedia|MediaRecorder/);
});

test('guest links bypass the opening and internal navigation has no replay hook', () => {
  assert.match(app, /if \(guest\) \{\s+dismissOpeningExperience\(\{ immediate: true \}\);\s+await initGuest\(guest\)/s);
  const showCalls = [...app.matchAll(/showOpeningExperience\(\);/g)];
  assert.equal(showCalls.length, 2, 'only signed boot and local fixture entry may show the opening');
  assert.match(app, /storyforge_opening_seen_this_tab/);
  assert.match(app, /sessionStorage\.getItem\(OPENING_TAB_KEY\) === '1'/);
  assert.match(app, /sessionStorage\.setItem\(OPENING_TAB_KEY, '1'\)/);
});

test('development build manifests the canonical logo once and ships no raw runtime logo URL', async () => {
  execFileSync(process.execPath, ['scripts/build-static.mjs', '--mode=development'], {
    cwd: packageDir,
    encoding: 'utf8',
  });
  const distDir = path.join(packageDir, '.local/development-dist');
  const builtHtml = await readFile(path.join(distDir, 'index.html'), 'utf8');
  const assetNames = await readdir(path.join(distDir, 'assets'));
  const appName = assetNames.find((name) => /^app\.[a-f0-9]{12}\.js$/.test(name));
  assert.ok(appName, 'fingerprinted application asset is present');
  const builtApp = await readFile(path.join(distDir, 'assets', appName), 'utf8');
  assert.match(builtHtml, /src="\.\/_asset\/[a-f0-9]{12}"/);
  assert.doesNotMatch(builtHtml, /src="\.\/missionmed-logo\.png"/);
  assert.doesNotMatch(builtApp, /missionmed-logo\.png/);
});
