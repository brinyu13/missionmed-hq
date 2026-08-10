#!/usr/bin/env node
/* V4 adversarial a11y verification run — axe + keyboard + overflow checks. */
import { chromium } from '/home/claude/b1-513/prototype/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'file:///home/claude/b1-513/prototype/B1-513_STORYFORGE_STAGE2_WORKING_PROTOTYPE.html';
const AXE = readFileSync('/home/claude/b1-513/prototype/node_modules/axe-core/axe.min.js', 'utf8');
const results = { axe: {}, keyboard: {}, overflow: {}, errors: [] };

async function boot(page, persona = 'founderStudent') {
  await page.addInitScript((p) => { sessionStorage.setItem('storyforge_local_fixture_persona', p); }, persona);
  await page.goto(FILE, { waitUntil: 'load' });
  await page.waitForFunction(() => !document.body.classList.contains('is-booting'), { timeout: 20000 });
  await page.waitForTimeout(700);
}

async function runAxe(page, label, context) {
  await page.evaluate(AXE);
  const r = await page.evaluate(async (ctx) => {
    const options = { resultTypes: ['violations'] };
    const res = ctx ? await window.axe.run(document.querySelector(ctx) || document, options) : await window.axe.run(document, options);
    return res.violations.map((v) => ({
      id: v.id, impact: v.impact, help: v.help,
      nodes: v.nodes.slice(0, 6).map((n) => ({ target: n.target.join(' '), html: n.html.slice(0, 220), failure: (n.failureSummary || '').slice(0, 300) })),
      count: v.nodes.length,
    }));
  }, context || null);
  results.axe[label] = r;
  console.log(`AXE ${label}: ${r.length} violation types (${r.filter(v => ['serious','critical'].includes(v.impact)).length} serious/critical)`);
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error') results.errors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => results.errors.push(String(e).slice(0, 200)));

/* ---------- founder student surfaces ---------- */
await boot(page);
await runAxe(page, 'home');

await page.click('[data-nav="library"]'); await page.waitForTimeout(500);
await runAxe(page, 'library');

await page.click('[data-open-story="s-106"]'); await page.waitForTimeout(700);
await page.click('[data-story-tab="thirty"]'); await page.waitForTimeout(400);
const histBtn = await page.$('[data-b1513-version-history]');
if (histBtn) { await histBtn.click(); await page.waitForTimeout(300); }
await runAxe(page, 'storyroom-thirty');

/* keyboard: version tabs */
{
  const k = {};
  // focus first tab and check tab strip keyboard operation
  await page.focus('[data-story-tab="original"]');
  k.tabRolesPresent = await page.evaluate(() => {
    const strip = document.querySelector('.b1513VersionTabs');
    return strip ? { role: strip.getAttribute('role'), tabs: [...strip.querySelectorAll('[role=tab]')].map(t => ({ sel: t.getAttribute('aria-selected'), ti: t.tabIndex, txt: t.textContent.trim() })) } : null;
  });
  await page.keyboard.press('ArrowRight');
  k.afterArrowRight = await page.evaluate(() => document.activeElement?.dataset?.storyTab || document.activeElement?.textContent?.trim() || 'unknown');
  // Enter activation from focused tab (Tab to next tab manually)
  await page.focus('[data-story-tab="nnq"]');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  k.enterActivatesNnq = await page.evaluate(() => document.querySelector('[data-story-tab="nnq"]')?.getAttribute('aria-selected'));
  k.focusAfterActivation = await page.evaluate(() => document.activeElement?.tagName + '.' + (document.activeElement?.className || '').slice(0, 40));
  results.keyboard.versionTabs = k;
  console.log('KEYBOARD versionTabs', JSON.stringify(k));
}
await page.click('[data-close-overlay]'); await page.waitForTimeout(300);

/* inspiration question step: who=you -> domain=personal -> energy=light */
await page.click('[data-nav="inspiration"]'); await page.waitForTimeout(600);
await page.click('[data-b1513-wizard-pick="who"][data-b1513-wizard-value="you"]'); await page.waitForTimeout(350);
await page.click('[data-b1513-wizard-pick="domain"][data-b1513-wizard-value="personal"]'); await page.waitForTimeout(350);
await page.click('[data-b1513-wizard-pick="energy"][data-b1513-wizard-value="light"]'); await page.waitForTimeout(700);
results.keyboard.inspirationQuestionVisible = await page.evaluate(() => Boolean(document.querySelector('.b1513QuestionCard')));
await runAxe(page, 'inspiration-question');

/* settings */
await page.click('[data-nav="settings"]'); await page.waitForTimeout(500);
await runAxe(page, 'settings');

/* admin directory */
await page.click('[data-switch-view="admin"]'); await page.waitForTimeout(800);
await page.click('[data-nav="students"]'); await page.waitForTimeout(700);
await runAxe(page, 'admin-directory');

/* admin story review */
await page.click('[data-nav="queue"]'); await page.waitForTimeout(600);
await page.click('[data-admin-open-story="s-202"]'); await page.waitForTimeout(700);
await runAxe(page, 'admin-story-review');

/* keyboard: star rating */
{
  const k = {};
  k.starRoles = await page.evaluate(() => {
    const g = document.querySelector('.b1513Stars');
    return g ? { role: g.getAttribute('role'), labelledby: g.getAttribute('aria-labelledby'), stars: [...g.querySelectorAll('[role=radio]')].map(s => ({ checked: s.getAttribute('aria-checked'), ti: s.tabIndex })) } : null;
  });
  await page.focus('[data-b1513-admin-score="3"]');
  await page.keyboard.press('ArrowRight');
  k.afterArrowRight = await page.evaluate(() => document.activeElement?.dataset?.b1513AdminScore || document.activeElement?.tagName || 'unknown');
  await page.focus('[data-b1513-admin-score="3"]');
  await page.keyboard.press('Space');
  await page.waitForTimeout(600);
  k.afterSpaceScore = await page.evaluate(() => {
    const s = document.querySelector('.b1513Stars');
    return s ? s.querySelector('.spv')?.textContent : null;
  });
  k.liveRegion = await page.evaluate(() => {
    const live = document.querySelector('[data-b1513-review-live]');
    return live ? { ariaLive: live.getAttribute('aria-live'), text: live.textContent.slice(0, 80) } : null;
  });
  results.keyboard.stars = k;
  console.log('KEYBOARD stars', JSON.stringify(k));
}

/* aria-live audit for save states across surfaces */
results.keyboard.liveRegions = await page.evaluate(() => {
  return [...document.querySelectorAll('[aria-live], [role=status], [role=alert]')].map(n => ({
    id: n.id || null, cls: (n.className || '').toString().slice(0, 50), live: n.getAttribute('aria-live'), role: n.getAttribute('role'),
  })).slice(0, 20);
});

/* ---------- consent modal (student persona) ---------- */
const page2 = await context.newPage();
page2.on('pageerror', (e) => results.errors.push('maya:' + String(e).slice(0, 200)));
await boot(page2, 'student');
await page2.waitForTimeout(500);
const consentVisible = await page2.evaluate(() => Boolean(document.querySelector('.b1513ConsentSheet')));
results.keyboard.consent = { visible: consentVisible };
if (consentVisible) {
  await runAxe(page2, 'consent-modal');
  const c = results.keyboard.consent;
  c.initialFocus = await page2.evaluate(() => ({ tag: document.activeElement?.tagName, id: document.activeElement?.id }));
  c.dialogAttrs = await page2.evaluate(() => {
    const d = document.querySelector('.b1513ConsentSheet');
    return { role: d.getAttribute('role'), modal: d.getAttribute('aria-modal'), labelledby: d.getAttribute('aria-labelledby') };
  });
  // Escape behavior
  await page2.keyboard.press('Escape');
  await page2.waitForTimeout(300);
  c.escapeDismissed = await page2.evaluate(() => !document.querySelector('.b1513ConsentSheet'));
  // focus trap: tab repeatedly, see if focus leaves the dialog
  if (!c.escapeDismissed) {
    const path = [];
    for (let i = 0; i < 14; i++) {
      await page2.keyboard.press('Tab');
      path.push(await page2.evaluate(() => {
        const inDialog = document.querySelector('.b1513ConsentSheet')?.contains(document.activeElement);
        return { inDialog, el: (document.activeElement?.tagName || '') + (document.activeElement?.id ? '#' + document.activeElement.id : '') + '.' + (document.activeElement?.className || '').toString().slice(0, 30) };
      }));
    }
    c.tabPath = path;
    c.focusEscapes = path.some(p => p.inDialog === false);
    // background inert?
    c.backgroundInert = await page2.evaluate(() => document.getElementById('main')?.hasAttribute('inert') || false);
    // keyboard-complete the decision
    await page2.focus('[data-b1513-consent-check]');
    await page2.keyboard.press('Space');
    await page2.waitForTimeout(200);
    c.acceptEnabledAfterCheck = await page2.evaluate(() => !document.querySelector('[data-b1513-consent-accept]')?.disabled);
  }
  console.log('CONSENT', JSON.stringify(results.keyboard.consent, null, 1).slice(0, 1200));
}
await page2.close();

/* ---------- 390x844 overflow ---------- */
const page3 = await context.newPage();
await page3.setViewportSize({ width: 390, height: 844 });
await boot(page3);
const measure = async (label) => {
  const w = await page3.evaluate(() => ({ scrollW: document.scrollingElement.scrollWidth, innerW: window.innerWidth }));
  results.overflow[label] = w;
  console.log('OVERFLOW', label, JSON.stringify(w));
};
await measure('home');
await page3.click('[data-nav="library"]'); await page3.waitForTimeout(500); await measure('library');
await page3.click('[data-nav="inspiration"]'); await page3.waitForTimeout(500); await measure('inspiration');
await page3.click('[data-b1513-wizard-pick="who"][data-b1513-wizard-value="you"]'); await page3.waitForTimeout(300);
await page3.click('[data-b1513-wizard-pick="domain"][data-b1513-wizard-value="personal"]'); await page3.waitForTimeout(300);
await page3.click('[data-b1513-wizard-pick="energy"][data-b1513-wizard-value="light"]'); await page3.waitForTimeout(600);
await measure('inspiration-question');
await page3.click('[data-nav="library"]'); await page3.waitForTimeout(400);
await page3.click('[data-open-story="s-106"]'); await page3.waitForTimeout(700);
await measure('storyroom');
await page3.click('[data-story-tab="thirty"]'); await page3.waitForTimeout(400);
await measure('storyroom-thirty');
await page3.close();

await browser.close();
writeFileSync('/home/claude/b1-513/verify/a11y-results.json', JSON.stringify(results, null, 2));
console.log('WROTE /home/claude/b1-513/verify/a11y-results.json');
console.log('PAGE ERRORS:', results.errors.length);
