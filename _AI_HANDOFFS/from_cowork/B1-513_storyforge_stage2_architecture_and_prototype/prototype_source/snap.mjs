#!/usr/bin/env node
/* B1-513 prototype smoke + screenshot harness (Playwright, file:// load). */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const FILE = 'file:///home/claude/b1-513/prototype/B1-513_STORYFORGE_STAGE2_WORKING_PROTOTYPE.html';
const OUT = '/home/claude/b1-513/screenshots';
mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const only = args[0] || '';

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  laptop: { width: 1280, height: 800 },
  tablet: { width: 834, height: 1112 },
  mobile: { width: 390, height: 844 },
};

async function boot(page, persona = 'founderStudent') {
  await page.addInitScript((p) => { sessionStorage.setItem('storyforge_local_fixture_persona', p); }, persona);
  await page.goto(FILE, { waitUntil: 'load' });
  await page.waitForFunction(() => !document.body.classList.contains('is-booting'), { timeout: 15000 });
  await page.waitForTimeout(600);
}

const errors = [];
async function run() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'] });
  const context = await browser.newContext({ viewport: VIEWPORTS.desktop, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(String(err)));

  const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  const fullshot = (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });

  /* ---------- Founder Student View ---------- */
  await boot(page);
  await fullshot('01-home-student-desktop');

  // Library
  await page.click('[data-nav="library"]');
  await page.waitForTimeout(500);
  await fullshot('02-library-student-desktop');

  // Story Detail — multi-version showcase (s-106 has all four)
  await page.click('[data-open-story="s-106"]');
  await page.waitForTimeout(700);
  await shot('03-story-original-telling');
  await page.click('[data-story-tab="working"]');
  await page.waitForTimeout(400);
  await shot('04-story-full-story');
  await page.click('[data-story-tab="thirty"]');
  await page.waitForTimeout(400);
  await shot('05-story-thirty-second');
  // version history open
  const hist = await page.$('[data-b1513-version-history]');
  if (hist) { await hist.click(); await page.waitForTimeout(300); await shot('06-story-thirty-history'); }
  await page.click('[data-story-tab="nnq"]');
  await page.waitForTimeout(400);
  await shot('07-story-nnq-setup');
  // voice append demo
  const voiceBtn = await page.$('[data-b1513-version-voice="append"]');
  if (voiceBtn) {
    await voiceBtn.click();
    await page.waitForTimeout(3600);
    await shot('08-story-version-voice-append');
    await page.click('[data-b1513-version-rec-done]');
    await page.waitForTimeout(700);
  }
  await page.click('[data-close-overlay]');
  await page.waitForTimeout(400);

  // Story with visibility private + empty versions (s-104)
  await page.click('[data-open-story="s-104"]');
  await page.waitForTimeout(600);
  await shot('09-story-private-visibility');
  await page.click('[data-close-overlay]');
  await page.waitForTimeout(300);

  // Inspiration wizard
  await page.click('[data-nav="inspiration"]');
  await page.waitForTimeout(600);
  await fullshot('10-inspiration-step-who');
  await page.click('[data-b1513-wizard-pick="who"][data-b1513-wizard-value="family"]');
  await page.waitForTimeout(400);
  await shot('11-inspiration-step-who-detail');
  const more = await page.$('[data-b1513-wizard-more]');
  if (more) { await more.click(); await page.waitForTimeout(300); await shot('12-inspiration-who-detail-more'); }
  await page.click('[data-b1513-wizard-pick="whoDetail"][data-b1513-wizard-value="parents"]');
  await page.waitForTimeout(400);
  await shot('13-inspiration-step-domain');
  await page.click('[data-b1513-wizard-pick="domain"][data-b1513-wizard-value="personal"]');
  await page.waitForTimeout(400);
  await shot('14-inspiration-step-energy');
  await page.click('[data-b1513-wizard-pick="energy"][data-b1513-wizard-value="light"]');
  await page.waitForTimeout(700);
  await fullshot('15-inspiration-question');
  await page.fill('[data-b1513-answer]', 'My mother kept a drawer of every school report I ever brought home. When I matched into my first choice, she added the match letter to the drawer and finally showed me the whole collection.');
  await page.waitForTimeout(300);
  await shot('16-inspiration-answered');
  await page.click('[data-b1513-add-library]');
  await page.waitForTimeout(800);
  await shot('17-inspiration-added-to-library');

  // Settings incl. privacy panel
  await page.click('[data-nav="settings"]');
  await page.waitForTimeout(500);
  await fullshot('18-settings-student');

  /* ---------- Administrator View ---------- */
  await page.click('[data-switch-view="admin"]');
  await page.waitForTimeout(800);
  await fullshot('20-admin-home');
  await page.click('[data-nav="students"]');
  await page.waitForTimeout(700);
  await fullshot('21-admin-directory');
  await page.click('[data-b1513-dir-filter="never_active"]');
  await page.waitForTimeout(500);
  await shot('22-admin-directory-never-active');
  await page.click('[data-b1513-dir-filter=""]');
  await page.waitForTimeout(500);
  await page.click('[data-b1513-open-profile="u-maya"]');
  await page.waitForTimeout(700);
  await shot('23-admin-profile-overview');
  await page.click('[data-b1513-profile-tab="activity"]');
  await page.waitForTimeout(400);
  await shot('24-admin-profile-activity');
  await page.click('[data-b1513-profile-tab="stories"]');
  await page.waitForTimeout(400);
  await shot('25-admin-profile-stories');
  // Review Check flow on a no-submission student
  await page.click('[data-b1513-close-profile]');
  await page.waitForTimeout(300);
  await page.click('[data-b1513-open-profile="u-st6"]');
  await page.waitForTimeout(600);
  await page.click('[data-b1513-review-check-preview="u-st6"]');
  await page.waitForTimeout(500);
  await shot('26-admin-review-check-preview');
  await page.click('[data-b1513-review-check-send="u-st6"]');
  await page.waitForTimeout(700);
  await shot('27-admin-review-check-sent');
  await page.click('[data-b1513-close-profile]');
  await page.waitForTimeout(300);

  // Admin story review with direct controls
  await page.click('[data-nav="queue"]');
  await page.waitForTimeout(600);
  await fullshot('28-admin-queue');
  await page.click('[data-admin-open-story="s-202"]');
  await page.waitForTimeout(700);
  await fullshot('29-admin-story-review');
  await page.click('[data-b1513-admin-score="4"]');
  await page.waitForTimeout(600);
  await shot('30-admin-review-star-saved');
  await page.click('[data-b1513-admin-status="in_review"]');
  await page.waitForTimeout(600);
  await shot('31-admin-review-status-saved');

  // Release Controls / configuration
  await page.click('[data-nav="settings"]');
  await page.waitForTimeout(800);
  await fullshot('32-admin-release-controls');
  const loadInsp = await page.$('[data-b1513-load-insp-admin]');
  if (loadInsp) { await loadInsp.click(); await page.waitForTimeout(700); await fullshot('33-admin-inspiration-config'); }

  /* ---------- Maya: first-use consent ---------- */
  const page2 = await context.newPage();
  page2.on('console', (msg) => { if (msg.type() === 'error') errors.push('maya: ' + msg.text()); });
  page2.on('pageerror', (err) => errors.push('maya: ' + String(err)));
  await page2.addInitScript(() => { sessionStorage.setItem('storyforge_local_fixture_persona', 'student'); });
  await page2.goto(FILE, { waitUntil: 'load' });
  await page2.waitForFunction(() => !document.body.classList.contains('is-booting'), { timeout: 15000 });
  await page2.waitForTimeout(800);
  await page2.screenshot({ path: `${OUT}/40-consent-first-use.png`, fullPage: false });
  await page2.check('[data-b1513-consent-check]');
  await page2.waitForTimeout(200);
  await page2.screenshot({ path: `${OUT}/41-consent-affirmed.png` });
  await page2.click('[data-b1513-consent-accept]');
  await page2.waitForTimeout(900);
  await page2.screenshot({ path: `${OUT}/42-consent-accepted-home.png` });
  await page2.close();

  /* ---------- text sizes ---------- */
  await page.click('[data-switch-view="student"]');
  await page.waitForTimeout(700);
  await page.click('[data-nav="settings"]');
  await page.waitForTimeout(500);
  await page.click('[data-select-text-size="large"]');
  await page.click('[data-preview-text-size]');
  await page.waitForTimeout(400);
  await shot('50-settings-large-preview');
  await page.click('[data-select-text-size="extra_large"]');
  await page.click('[data-preview-text-size]');
  await page.waitForTimeout(400);
  await shot('51-settings-extra-large-preview');
  // XL across story detail + inspiration
  await page.click('[data-nav="library"]');
  await page.waitForTimeout(500);
  await page.click('[data-open-story="s-106"]');
  await page.waitForTimeout(600);
  await shot('52-story-extra-large');
  await page.click('[data-close-overlay]');
  await page.click('[data-nav="inspiration"]');
  await page.waitForTimeout(500);
  await shot('53-inspiration-extra-large');
  await page.click('[data-nav="settings"]');
  await page.waitForTimeout(400);
  await page.click('[data-cancel-text-size]');
  await page.waitForTimeout(300);

  /* ---------- responsive ---------- */
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    if (name === 'desktop') continue;
    await page.setViewportSize(viewport);
    await page.click('[data-nav="home"]').catch(() => {});
    await page.waitForTimeout(500);
    await shot(`60-home-${name}`);
    await page.click('[data-nav="library"]').catch(() => {});
    await page.waitForTimeout(400);
    await shot(`61-library-${name}`);
    await page.click('[data-nav="inspiration"]').catch(() => {});
    await page.waitForTimeout(400);
    await shot(`62-inspiration-${name}`);
    await page.click('[data-open-story="s-106"]').catch(() => {});
    await page.waitForTimeout(500);
    await shot(`63-story-${name}`);
    await page.click('[data-close-overlay]').catch(() => {});
    await page.waitForTimeout(200);
  }
  // tablet admin directory (switch views at desktop width, then resize)
  await page.setViewportSize(VIEWPORTS.desktop);
  await page.waitForTimeout(300);
  await page.click('[data-switch-view="admin"]');
  await page.waitForTimeout(700);
  await page.click('[data-nav="students"]');
  await page.waitForTimeout(600);
  await page.setViewportSize(VIEWPORTS.tablet);
  await page.waitForTimeout(500);
  await shot('64-admin-directory-tablet');
  await page.setViewportSize(VIEWPORTS.mobile);
  await page.waitForTimeout(500);
  await shot('65-admin-directory-mobile');

  /* ---------- reduced motion ---------- */
  const contextRM = await browser.newContext({ viewport: VIEWPORTS.desktop, reducedMotion: 'reduce' });
  const pageRM = await contextRM.newPage();
  await pageRM.addInitScript(() => { sessionStorage.setItem('storyforge_local_fixture_persona', 'founderStudent'); });
  await pageRM.goto(FILE, { waitUntil: 'load' });
  await pageRM.waitForFunction(() => !document.body.classList.contains('is-booting'), { timeout: 15000 });
  await pageRM.waitForTimeout(600);
  await pageRM.screenshot({ path: `${OUT}/70-reduced-motion-home.png` });
  await contextRM.close();

  await browser.close();
  console.log('DONE');
  if (errors.length) {
    console.log(`CONSOLE/PAGE ERRORS (${errors.length}):`);
    [...new Set(errors)].slice(0, 30).forEach((error) => console.log('  !', error.slice(0, 300)));
  } else {
    console.log('No console or page errors.');
  }
}

run().catch((error) => { console.error('HARNESS FAILURE:', error); process.exit(1); });
