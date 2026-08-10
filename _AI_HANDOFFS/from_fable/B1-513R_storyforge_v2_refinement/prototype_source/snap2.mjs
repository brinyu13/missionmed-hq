#!/usr/bin/env node
/* B1-513R prototype smoke + screenshot harness. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const FILE = 'file:///home/claude/b1-513r/B1-513R_FINAL_WORKING_PROTOTYPE.html';
const OUT = '/home/claude/b1-513r-out/screenshots';
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = { desktop: { width: 1440, height: 900 }, laptop: { width: 1280, height: 800 }, tablet: { width: 834, height: 1112 }, mobile: { width: 390, height: 844 } };
const errors = [];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: VIEWPORTS.desktop });
const page = await context.newPage();
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (err) => errors.push(String(err)));
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const fullshot = (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });

await page.addInitScript(() => sessionStorage.setItem('storyforge_local_fixture_persona', 'founderStudent'));
await page.goto(FILE, { waitUntil: 'load' });
await page.waitForFunction(() => !document.body.classList.contains('is-booting'), { timeout: 15000 });
await page.waitForTimeout(700);
await fullshot('01-home');

/* Library — refined rows */
await page.click('[data-nav="library"]');
await page.waitForTimeout(500);
await fullshot('02-library-refined');
await page.click('[data-b1513r-row-more="s-106"]');
await page.waitForTimeout(400);
await shot('03-library-row-expanded');

/* Story Detail — single title, save triad, time guidance */
await page.click('[data-open-story="s-106"]');
await page.waitForTimeout(700);
await shot('04-story-original');
await page.click('[data-story-tab="working"]');
await page.waitForTimeout(400);
await shot('05-story-full-single-title');
await page.click('[data-story-tab="thirty"]');
await page.waitForTimeout(400);
await shot('06-story-thirty-time-guidance');
await page.click('[data-b1513r-time-start]');
await page.waitForTimeout(2500);
await shot('07-story-time-me');
await page.click('[data-b1513r-time-stop]');
await page.waitForTimeout(400);
const histBtn = await page.$('[data-b1513-version-history]');
if (histBtn) { await histBtn.click(); await page.waitForTimeout(300); await shot('08-story-previous-tellings'); }
await page.click('[data-close-overlay]');
await page.waitForTimeout(300);

/* Inspiration — browse default */
await page.click('[data-nav="inspiration"]');
await page.waitForTimeout(800);
await fullshot('10-inspiration-browse');
await page.fill('#b1513rBrowseQ', 'food');
await page.click('#b1513rBrowseSearch button[type="submit"]');
await page.waitForTimeout(500);
await shot('11-inspiration-search-food');
await page.fill('#b1513rBrowseQ', '');
await page.click('#b1513rBrowseSearch button[type="submit"]');
await page.waitForTimeout(400);
const favBtn = await page.$('[data-b1513r-fav]');
if (favBtn) { await favBtn.click(); await page.waitForTimeout(400); }
await page.click('[data-b1513r-browse-fav]');
await page.waitForTimeout(400);
await shot('12-inspiration-favorites');
await page.click('[data-b1513r-browse-fav]');
await page.waitForTimeout(400);
const answerBtn = await page.$('[data-b1513r-answer-now]');
if (answerBtn) {
  await answerBtn.click();
  await page.waitForTimeout(400);
  await page.fill('#b1513rBrowseAnswer', 'The kitchen always smelled of cardamom on Sundays, and my grandmother would let me stir the pot while she told me who taught her the recipe.');
  await page.waitForTimeout(300);
  await shot('13-inspiration-answer-inline');
}
await page.click('[data-b1513r-insp-mode="guide"]');
await page.waitForTimeout(400);
await shot('14-inspiration-guide-me');
await page.click('[data-b1513-wizard-pick="domain"][data-b1513-wizard-value="personal"]');
await page.waitForTimeout(400);
await page.click('[data-b1513-wizard-pick="energy"][data-b1513-wizard-value="light"]');
await page.waitForTimeout(600);
await shot('15-inspiration-guide-question');

/* Request a Story */
await page.click('[data-nav="requests"]');
await page.waitForTimeout(700);
await fullshot('20-requests-home');
await page.click('[data-b1513r-invite-preview="inv-3"]');
await page.waitForTimeout(500);
await shot('21-requests-email-preview');
await page.click('[data-b1513r-preview-close]');
await page.click('[data-b1513r-new-invite]');
await page.waitForTimeout(400);
await shot('22-requests-new-invite');
await page.click('[data-b1513r-rel-more]');
await page.waitForTimeout(300);
await shot('23-requests-relationships-more');
await page.click('[data-b1513r-req-back]');
await page.waitForTimeout(300);

/* Guest contributor preview */
await page.click('[data-b1513r-guest-preview="rs-demo-rosa"]');
await page.waitForTimeout(700);
await shot('24-guest-landing');
await page.click('[data-b1513r-guest-start="voice"]');
await page.waitForTimeout(300);
await shot('25-guest-voice-ready');
await page.click('[data-b1513r-guest-rec-start]');
await page.waitForTimeout(4000);
await shot('26-guest-recording');
await page.click('[data-b1513r-guest-rec-done]');
await page.waitForTimeout(400);
await shot('27-guest-review-send');
await page.click('[data-b1513r-guest-send]');
await page.waitForTimeout(500);
await shot('28-guest-thanks');
await page.click('[data-b1513r-guest-close]');
await page.waitForTimeout(400);

/* Candidate promote */
await page.waitForTimeout(300);
const promote = await page.$('[data-b1513r-cand-promote]');
if (promote) { await shot('29-requests-candidates'); await promote.click(); await page.waitForTimeout(700); await shot('30-requests-promoted'); }

/* Settings IA */
await page.click('[data-nav="settings"]');
await page.waitForTimeout(600);
await fullshot('31-settings-ia');

/* Admin mirror */
await page.click('[data-switch-view="admin"]');
await page.waitForSelector('[data-view="admin-home"]', { timeout: 10000 });
await page.waitForTimeout(600);
await fullshot('40-admin-home-attention');
await page.click('[data-nav="students"]');
await page.waitForTimeout(600);
await fullshot('41-admin-students-cards');
await page.click('[data-b1513r-open-workspace="u-maya"]');
await page.waitForTimeout(700);
await fullshot('42-admin-student-workspace');
const openStory = await page.$('[data-open-story="s-202"]');
if (openStory) {
  await openStory.click();
  await page.waitForTimeout(800);
  await fullshot('43-admin-mirrored-review');
  await page.click('[data-b1513-admin-score="5"]');
  await page.waitForTimeout(500);
  await shot('44-admin-star-saved-in-room');
  await page.click('[data-close-overlay]');
  await page.waitForTimeout(400);
  await shot('45-admin-back-to-workspace');
}
await page.click('[data-nav="content"]');
await page.waitForTimeout(700);
await fullshot('46-admin-content-studio');
await page.click('[data-nav="settings"]');
await page.waitForTimeout(600);
await fullshot('47-admin-system-controls');
await page.click('[data-nav="queue"]');
await page.waitForTimeout(500);
await shot('48-admin-queue-avatars');

/* Maya consent still works + no avatar fallback */
const page2 = await context.newPage();
page2.on('pageerror', (err) => errors.push('maya: ' + String(err)));
page2.on('console', (msg) => { if (msg.type() === 'error') errors.push('maya: ' + msg.text()); });
await page2.addInitScript(() => sessionStorage.setItem('storyforge_local_fixture_persona', 'student'));
await page2.goto(FILE, { waitUntil: 'load' });
await page2.waitForFunction(() => !document.body.classList.contains('is-booting'), { timeout: 15000 });
await page2.waitForTimeout(700);
await page2.screenshot({ path: `${OUT}/50-consent-maya.png` });
await page2.check('[data-b1513-consent-check]');
await page2.click('[data-b1513-consent-accept]');
await page2.waitForTimeout(600);
await page2.click('[data-nav="settings"]');
await page2.waitForTimeout(500);
await page2.screenshot({ path: `${OUT}/51-maya-settings-no-avatar.png`, fullPage: true });
await page2.close();

/* text sizes + responsive + reduced motion */
await page.click('[data-switch-view="student"]');
await page.waitForTimeout(600);
await page.click('[data-nav="settings"]');
await page.waitForTimeout(400);
await page.click('[data-select-text-size="extra_large"]');
await page.click('[data-preview-text-size]');
await page.waitForTimeout(400);
await page.click('[data-nav="inspiration"]');
await page.waitForTimeout(500);
await shot('60-inspiration-xl');
await page.click('[data-nav="requests"]');
await page.waitForTimeout(500);
await shot('61-requests-xl');
await page.click('[data-nav="settings"]');
await page.waitForTimeout(300);
await page.click('[data-cancel-text-size]');
await page.waitForTimeout(200);

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  if (name === 'desktop') continue;
  await page.setViewportSize(viewport);
  await page.click('[data-nav="library"]').catch(() => {});
  await page.waitForTimeout(400);
  await shot(`62-library-${name}`);
  await page.click('[data-nav="inspiration"]').catch(() => {});
  await page.waitForTimeout(400);
  await shot(`63-inspiration-${name}`);
  await page.click('[data-nav="requests"]').catch(() => {});
  await page.waitForTimeout(400);
  await shot(`64-requests-${name}`);
}
/* guest on mobile */
await page.setViewportSize(VIEWPORTS.mobile);
await page.click('[data-b1513r-guest-preview="rs-demo-rosa"]').catch(() => {});
await page.waitForTimeout(600);
await shot('65-guest-mobile');
await page.click('[data-b1513r-guest-close]').catch(() => {});

const contextRM = await browser.newContext({ viewport: VIEWPORTS.desktop, reducedMotion: 'reduce' });
const pageRM = await contextRM.newPage();
await pageRM.addInitScript(() => sessionStorage.setItem('storyforge_local_fixture_persona', 'founderStudent'));
await pageRM.goto(FILE, { waitUntil: 'load' });
await pageRM.waitForFunction(() => !document.body.classList.contains('is-booting'), { timeout: 15000 });
await pageRM.waitForTimeout(500);
await pageRM.screenshot({ path: `${OUT}/70-reduced-motion.png` });
await contextRM.close();

await browser.close();
console.log('DONE');
if (errors.length) {
  console.log(`ERRORS (${errors.length}):`);
  [...new Set(errors)].slice(0, 20).forEach((error) => console.log(' !', error.slice(0, 240)));
  process.exit(1);
}
console.log('No console or page errors.');
