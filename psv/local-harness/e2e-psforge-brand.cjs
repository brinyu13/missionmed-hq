// Focused desktop + phone acceptance for the PSForge title and landing surface.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const base = 'http://127.0.0.1:8088';
const shots = '/tmp/psforge-brand-shots';
fs.mkdirSync(shots, { recursive: true });
let passed = 0;
function ok(name, value) {
	assert.ok(value, name);
	console.log('PASS ' + name);
	passed++;
}

(async () => {
	const browser = await chromium.launch({ channel: process.env.MMPS_BROWSER_CHANNEL || 'chrome', headless: true });
	const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
	const page = await context.newPage();
	const errors = [];
	page.on('pageerror', error => errors.push(error.message));
	page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

	await page.goto(base + '/wp-login.php');
	await page.fill('#user_login', 'tester');
	await page.fill('#user_pass', 'Tester-Local-1!');
	await Promise.all([page.waitForNavigation(), page.click('#wp-submit')]);
	await context.addCookies([{ name: 'mmhq_rise_session', value: 'good-session', url: base }]);
	await page.goto(base + '/?mmed_ps_proto=1');
	await page.waitForSelector('.psforgeHero');
	await page.waitForTimeout(1200);

	ok('browser title uses PSForge', await page.title() === 'PSForge · MissionMed');
	ok('split PSForge wordmark and descriptor are visible', await page.locator('.psforgeWordmark').innerText() === 'PSForge' && await page.getByText('PROGRAM-SPECIFIC PERSONAL STATEMENTS', { exact: true }).isVisible());
	ok('five-second promise is visible', await page.locator('.psforgePromise h2').innerText() === 'Your Personal Statement.\nPersonalized for every residency program.');
	ok('Start Personalizing is the primary action', await page.locator('.psforgePrimary').innerText() === 'Start Personalizing');
ok('PS Library is a visible secondary action', await page.getByRole('button', { name: 'PS Library', exact: true }).isVisible());
	ok('journey shows all five steps', await page.locator('.psforgeJourney li').count() === 5);
	ok('shell has a same-origin Matrix return', await page.locator('.matrixBack').getAttribute('href').then(href => /member-dashboard\/#filevault/.test(href || '')));
	ok('desktop landing has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
	await page.screenshot({ path: shots + '/desktop.png', fullPage: true });

	await page.setViewportSize({ width: 390, height: 844 });
	ok('phone title and primary action remain visible', await page.locator('.psforgeWordmark').isVisible() && await page.locator('.psforgePrimary').isVisible());
	ok('phone actions stack to one column', await page.locator('.psforgeActions').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length === 1));
	ok('phone journey stacks to one column', await page.locator('.psforgeJourney').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length === 1));
	ok('phone landing has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
	await page.screenshot({ path: shots + '/phone.png', fullPage: true });
	if (errors.length) console.error('BROWSER_ERRORS ' + JSON.stringify(errors));
	ok('focused PSForge browser flow has no JavaScript exception', errors.length === 0);

	console.log('PSFORGE_BRAND_UI_PASS ' + passed);
	await browser.close();
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
