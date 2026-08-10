#!/usr/bin/env node
/* B1-513R2 prototype smoke + screenshot harness (full R2 walkthrough). */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const FILE = 'file:///home/claude/b1-513r/B1-513R2_FINAL_WORKING_PROTOTYPE.html';
const OUT = '/home/claude/b1-513r2-out/screenshots';
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
await page.waitForTimeout(900);
await fullshot('01-home-with-recommends');

/* Library — intro + refined rows survive */
await page.click('[data-nav="library"]');
await page.waitForTimeout(500);
await fullshot('02-library-intro');

/* Inspiration — LIST default, pins, recommends */
await page.click('[data-nav="inspiration"]');
await page.waitForTimeout(900);
await fullshot('10-inspiration-list-default');
await page.click('[data-b1513r2-layout="grid"]');
await page.waitForTimeout(500);
await fullshot('11-inspiration-grid-toggle');
await page.click('[data-b1513r2-layout="list"]');
await page.waitForTimeout(400);
/* pin an unpinned question then reorder pins with the accessible buttons */
const pinBtn = await page.$('.b1513r2QList [data-b1513r2-pin]:not(.on)');
if (pinBtn) { await pinBtn.click(); await page.waitForTimeout(500); }
await shot('12-inspiration-pinned-section');
const moveDown = await page.$('[data-b1513r2-pin-move="1"]:not([disabled])');
if (moveDown) { await moveDown.click(); await page.waitForTimeout(500); await shot('13-inspiration-pin-reordered'); }
/* answer inline from the list */
const answerBtn = await page.$('.b1513r2QList [data-b1513r-answer-now]');
if (answerBtn) {
  await answerBtn.click();
  await page.waitForTimeout(400);
  await page.fill('#b1513rBrowseAnswer', 'The kitchen always smelled of cardamom on Sundays, and my grandmother would let me stir the pot while she told me who taught her the recipe.');
  await page.waitForTimeout(300);
  await shot('14-inspiration-list-answer-inline');
  await page.click('[data-b1513r-close-prompt]');
  await page.waitForTimeout(300);
}

/* Request a Story — process strip, truthful lifecycle, preview-before-send */
await page.click('[data-nav="requests"]');
await page.waitForTimeout(800);
await fullshot('20-requests-process-lifecycle');
await page.click('[data-b1513r-new-invite]');
await page.waitForTimeout(400);
await shot('21-requests-step1-form');
await page.click('[data-b1513r-rel="parent"]');
await page.waitForTimeout(300);
await page.fill('#b1513rInvName', 'Aunt Lidia');
await page.fill('#b1513rInvEmail', 'lidia@example.com');
await page.fill('#b1513rInvMsg', 'Tía — I’m collecting stories for my residency applications. Anything you remember counts.');
await page.click('#b1513rInviteForm button[type="submit"]');
await page.waitForTimeout(900);
await fullshot('22-requests-step2-preview-before-send');
await page.click('[data-b1513r2-confirm-send]');
await page.waitForTimeout(900);
await fullshot('23-requests-after-confirm-send');

/* Guest journeys — parent vs friend vs mentor */
await page.click('[data-b1513r-guest-preview="rs-demo-rosa"]');
await page.waitForTimeout(800);
await shot('24-guest-parent-landing');
await page.click('[data-b1513r2-guest-start="voice"]');
await page.waitForTimeout(400);
await shot('25-guest-parent-question');
await page.click('[data-b1513r-guest-close]');
await page.waitForTimeout(400);
await page.click('[data-b1513r-guest-preview="rs-demo-sam"]');
await page.waitForTimeout(700);
await page.click('[data-b1513r2-guest-start="type"]');
await page.waitForTimeout(400);
await shot('26-guest-friend-question');
await page.click('[data-b1513r-guest-close]');
await page.waitForTimeout(400);
await page.click('[data-b1513r-guest-preview="rs-demo-ken"]');
await page.waitForTimeout(700);
await page.click('[data-b1513r2-guest-start="type"]');
await page.waitForTimeout(400);
await shot('27-guest-mentor-question');
await page.click('[data-b1513r-guest-close]');
await page.waitForTimeout(400);

/* Settings — theme cards, then LIGHT */
await page.click('[data-nav="settings"]');
await page.waitForTimeout(600);
await fullshot('30-settings-appearance-dark');
await page.click('[data-b1513r2-theme="light"]');
await page.waitForTimeout(700);
await fullshot('31-settings-light-theme');
await page.click('[data-nav="library"]');
await page.waitForTimeout(500);
await fullshot('32-library-light');
await page.click('[data-nav="inspiration"]');
await page.waitForTimeout(600);
await fullshot('33-inspiration-light');
await page.click('[data-nav="home"]');
await page.waitForTimeout(500);
await shot('34-home-light');
/* environment persistence check: pick Ember Storm in light, then route-hop */
await page.click('[data-nav="settings"]');
await page.waitForTimeout(500);
const storm = await page.$('.bgCard.bg-emberstorm');
if (storm) {
  await storm.click();
  await page.waitForTimeout(300);
  const save = await page.$('[data-save-background]');
  if (save) { await save.click(); await page.waitForTimeout(500); }
  await page.click('[data-nav="library"]');
  await page.waitForTimeout(500);
  await shot('35-emberstorm-persists-on-library');
}
/* back to dark for admin walk */
await page.click('[data-nav="settings"]');
await page.waitForTimeout(400);
await page.click('[data-b1513r2-theme="dark"]');
await page.waitForTimeout(500);

/* Admin at scale */
await page.click('[data-switch-view="admin"]');
await page.waitForSelector('[data-view="admin-home"]', { timeout: 10000 });
await page.waitForTimeout(800);
await fullshot('40-admin-home-above-the-fold');
await page.click('[data-nav="students"]');
await page.waitForSelector('[data-view="admin-students"]', { timeout: 10000 });
await page.waitForTimeout(600);
await fullshot('41-admin-directory-scale');
await page.selectOption('#b1513r2DirSession', '360 Spring 2026');
await page.waitForTimeout(600);
await shot('42-admin-directory-session-filter');
const nextPage = await page.$('[data-b1513r2-page^="dir:"]:not([disabled])');
if (nextPage) { await nextPage.click(); await page.waitForTimeout(600); await shot('43-admin-directory-page2'); }
await page.click('[data-b1513r2-view="all-inactive"]');
await page.waitForTimeout(600);
await shot('44-admin-directory-saved-view');
await page.click('[data-b1513-dir-filter=""]');
await page.waitForTimeout(500);
/* workspace + mirrored room untouched — search first (page 1 of 122 may not hold Maya) */
await page.fill('#b1513DirQ', 'maya');
await page.click('#b1513DirectorySearchForm button[type="submit"]');
await page.waitForTimeout(600);
await shot('44b-admin-directory-search-maya');
await page.click('[data-b1513r-open-workspace="u-maya"]');
await page.waitForTimeout(800);
await fullshot('45-admin-maya-workspace');
const openStory = await page.$('[data-open-story="s-202"]');
if (openStory) {
  await openStory.click();
  await page.waitForTimeout(900);
  await fullshot('46-admin-mirrored-review');
  await page.click('[data-close-overlay]');
  await page.waitForTimeout(400);
}
/* queue at scale */
await page.click('[data-nav="queue"]');
await page.waitForTimeout(700);
await fullshot('47-admin-queue-scale');
await page.fill('#b1513r2QueueQ', 'maya');
await page.click('#b1513r2QueueSearch button[type="submit"]');
await page.waitForTimeout(600);
await shot('48-admin-queue-search');
await page.fill('#b1513r2QueueQ', '');
await page.click('#b1513r2QueueSearch button[type="submit"]');
await page.waitForTimeout(500);

/* Content Studio tabs + single add + bulk import */
await page.click('[data-nav="content"]');
await page.waitForTimeout(800);
await fullshot('50-content-studio-categories-tab');
await page.click('[data-b1513r2-cs-tab="versions"]');
await page.waitForTimeout(500);
await shot('51-content-studio-versions-tab');
await page.click('[data-b1513r2-cs-tab="inspiration"]');
await page.waitForTimeout(600);
const loadInsp = await page.$('[data-b1513-load-insp-admin]');
if (loadInsp) { await loadInsp.click(); await page.waitForTimeout(700); }
await fullshot('52-content-studio-inspiration-tab');
await page.click('[data-b1513r2-add-open]');
await page.waitForTimeout(400);
await shot('53-content-studio-add-one');
await page.click('[data-b1513r2-add-open]');
await page.waitForTimeout(300);
await page.click('[data-b1513r2-bulk-open]');
await page.waitForTimeout(400);
await page.click('[data-b1513r2-bulk-sample]');
await page.waitForTimeout(300);
await page.click('[data-b1513r2-bulk-parse]');
await page.waitForTimeout(700);
await fullshot('54-content-studio-bulk-validation-preview');
await page.click('[data-b1513r2-bulk-commit]');
await page.waitForTimeout(800);
await fullshot('55-content-studio-bulk-saved-as-drafts');
await page.click('[data-b1513r2-cs-tab="requests"]');
await page.waitForTimeout(500);
await shot('56-content-studio-requests-tab');
await page.click('[data-nav="settings"]');
await page.waitForTimeout(600);
await fullshot('57-admin-system-controls');

/* responsive + light-mobile + reduced motion */
await page.click('[data-switch-view="student"]');
await page.waitForTimeout(700);
for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  if (name === 'desktop') continue;
  await page.setViewportSize(viewport);
  await page.click('[data-nav="inspiration"]').catch(() => {});
  await page.waitForTimeout(500);
  await shot(`60-inspiration-${name}`);
  await page.click('[data-nav="requests"]').catch(() => {});
  await page.waitForTimeout(500);
  await shot(`61-requests-${name}`);
}
await page.setViewportSize(VIEWPORTS.mobile);
await page.click('[data-nav="settings"]').catch(() => {});
await page.waitForTimeout(400);
await page.click('[data-b1513r2-theme="light"]').catch(() => {});
await page.waitForTimeout(500);
await page.click('[data-nav="inspiration"]').catch(() => {});
await page.waitForTimeout(500);
await shot('62-inspiration-light-mobile');
await page.click('[data-nav="settings"]').catch(() => {});
await page.waitForTimeout(400);
await page.click('[data-b1513r2-theme="dark"]').catch(() => {});
await page.waitForTimeout(300);

/* XL text */
await page.setViewportSize(VIEWPORTS.desktop);
await page.click('[data-nav="settings"]').catch(() => {});
await page.waitForTimeout(400);
await page.click('[data-select-text-size="extra_large"]');
await page.click('[data-preview-text-size]');
await page.waitForTimeout(400);
await page.click('[data-nav="inspiration"]');
await page.waitForTimeout(500);
await shot('63-inspiration-xl');
await page.click('[data-nav="settings"]');
await page.waitForTimeout(300);
await page.click('[data-cancel-text-size]');
await page.waitForTimeout(200);

/* reduced motion, dark + light */
const contextRM = await browser.newContext({ viewport: VIEWPORTS.desktop, reducedMotion: 'reduce' });
const pageRM = await contextRM.newPage();
pageRM.on('pageerror', (err) => errors.push('rm: ' + String(err)));
await pageRM.addInitScript(() => sessionStorage.setItem('storyforge_local_fixture_persona', 'founderStudent'));
await pageRM.goto(FILE, { waitUntil: 'load' });
await pageRM.waitForFunction(() => !document.body.classList.contains('is-booting'), { timeout: 15000 });
await pageRM.waitForTimeout(500);
await pageRM.screenshot({ path: `${OUT}/70-reduced-motion-dark.png` });
await pageRM.click('[data-nav="settings"]');
await pageRM.waitForTimeout(500);
await pageRM.click('[data-b1513r2-theme="light"]');
await pageRM.waitForTimeout(500);
await pageRM.screenshot({ path: `${OUT}/71-reduced-motion-light.png` });
await contextRM.close();

/* AUTO theme resolves from the OS */
const contextAuto = await browser.newContext({ viewport: VIEWPORTS.desktop, colorScheme: 'light' });
const pageAuto = await contextAuto.newPage();
pageAuto.on('pageerror', (err) => errors.push('auto: ' + String(err)));
await pageAuto.addInitScript(() => sessionStorage.setItem('storyforge_local_fixture_persona', 'founderStudent'));
await pageAuto.goto(FILE, { waitUntil: 'load' });
await pageAuto.waitForFunction(() => !document.body.classList.contains('is-booting'), { timeout: 15000 });
await pageAuto.click('[data-nav="settings"]');
await pageAuto.waitForTimeout(500);
await pageAuto.click('[data-b1513r2-theme="auto"]');
await pageAuto.waitForTimeout(600);
const resolved = await pageAuto.evaluate(() => document.body.dataset.theme);
if (resolved !== 'light') errors.push(`AUTO theme did not resolve to light under a light OS scheme (got ${resolved})`);
await pageAuto.screenshot({ path: `${OUT}/72-auto-theme-light-os.png` });
await contextAuto.close();

await browser.close();
console.log('DONE');
if (errors.length) {
  console.log(`ERRORS (${errors.length}):`);
  [...new Set(errors)].slice(0, 25).forEach((error) => console.log(' !', error.slice(0, 260)));
  process.exit(1);
}
console.log('No console or page errors.');
