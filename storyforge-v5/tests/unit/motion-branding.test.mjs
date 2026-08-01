import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [html, app, styles, config, server] = await Promise.all([
  readFile(new URL('../../public/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../../public/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../../public/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../../server/config.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../../server/app.mjs', import.meta.url), 'utf8'),
]);

test('opening hierarchy uses exact approved Founder and MissionMed copy with the official asset', () => {
  for (const copy of [
    "Dr Brian's IV Prep On-Call",
    'MissionMed Institute',
    'Mission:Residency Division',
    'Story<span>Forge</span>',
  ]) assert.match(html, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(html, /src="\.\/missionmed-logo\.png"/);
  assert.doesNotMatch(html, /Tyler Perry/i);
});

test('premium motion is independently kill-switched and disabled by default', () => {
  assert.match(config, /premiumMotion:\s*flag\('STORYFORGE_PREMIUM_MOTION'\)/);
  assert.match(server, /premiumMotion:\s*config\.premiumMotion/);
  assert.match(app, /classList\.toggle\('motion-enabled', state\.config\.premiumMotion === true\)/);
  assert.match(styles, /body\.motion-enabled \.(?:aur|storyforgeIntro)/);
});

test('motion has low active recording and success states without random runtime layout', () => {
  for (const state of ['low', 'active', 'recording', 'success']) {
    assert.match(app, new RegExp(`['\"]${state}['\"]`));
  }
  assert.match(app, /seed = 0x5101cafe/);
  assert.doesNotMatch(app.slice(app.indexOf('function startEnvironmentEngine')), /Math\.random/);
  assert.match(styles, /data-motion-energy="recording"/);
});

test('reduced motion prevents the canvas loop and retains a static rich fallback', () => {
  assert.match(app, /motionPreference\.matches/);
  assert.match(app, /if \(motionPreference\.matches\) return/);
  assert.match(styles, /@media \(prefers-reduced-motion:reduce\)/);
  assert.match(styles, /\.storyforgeIntro:before/);
});

test('motion source contains no rapid flashing or full-screen brightness animation', () => {
  const motionStart = styles.indexOf('Concise Founder presentation');
  const motionStyles = styles.slice(motionStart, styles.indexOf('/* ============ SHELL', motionStart));
  assert.doesNotMatch(motionStyles, /@keyframes\s+(?:flash|strobe|blink)\b/i);
  assert.doesNotMatch(motionStyles, /filter:\s*brightness\([^)]*\)[^;}]*animation/i);
  assert.doesNotMatch(app, /setInterval\([^,]+,\s*(?:[0-9]|[1-9][0-9]|1[0-9]{2})\s*\)/);
});
