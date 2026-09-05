'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const repo = path.resolve(__dirname, '../../../../..');
const evidence = path.join(repo, '_AI_HANDOFFS/from_claude_code/MX-DASH-6021/evidence');
const port = 8766;
const base = 'http://127.0.0.1:' + port + '/wp-content/plugins/missionmed-hub/tests/mx-dash-6010b/true-morph-harness.html';
const apps = ['homebase', 'calendar', 'scheduler', 'storyforge', 'ivprep', 'rise', 'ranklist', 'lor'];

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function ready(page, query) {
	await page.goto(base + (query || '?admin=1'), { waitUntil: 'networkidle' });
	await page.waitForSelector('.mmdv2-card, .classic-marker');
}

async function inspectPopup(page, app) {
	await page.locator('.mmdv2-card[data-open="' + app + '"]').click();
	await page.waitForSelector('#mmdv2-ov.open .mmdv2-locked-detail img');
	await page.waitForFunction(() => {
		const img = document.querySelector('#mmdv2-ov.open .mmdv2-locked-detail img');
		return !!img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
	});
	const result = await page.locator('#mmdv2-ov.open').evaluate((overlay) => {
		const img = overlay.querySelector('.mmdv2-locked-detail img');
		const visual = overlay.querySelector('.mmdv2-dart');
		const style = getComputedStyle(img);
		const imageBox = img.getBoundingClientRect();
		const visualBox = visual.getBoundingClientRect();
		const scale = Math.min(imageBox.width / img.naturalWidth, imageBox.height / img.naturalHeight);
		return {
			name: overlay.querySelector('.mmdv2-dnm').textContent.trim(),
			src: img.getAttribute('src'),
			natural: [img.naturalWidth, img.naturalHeight],
			naturalRatio: img.naturalWidth / img.naturalHeight,
			objectFit: style.objectFit,
			objectPosition: style.objectPosition,
			imageBox: [Math.round(imageBox.width), Math.round(imageBox.height)],
			visualBox: [Math.round(visualBox.width), Math.round(visualBox.height)],
			containedPaint: [Math.round(img.naturalWidth * scale), Math.round(img.naturalHeight * scale)],
			adminEditVisible: !!overlay.querySelector('[data-editapp]'),
			closeVisible: !!overlay.querySelector('[data-dclose]'),
			previousVisible: !!overlay.querySelector('[data-dnav="-1"]'),
			nextVisible: !!overlay.querySelector('[data-dnav="1"]'),
			ctaVisible: !!overlay.querySelector('[data-launch]')
		};
	});
	assert.equal(result.objectFit, 'contain');
	assert.equal(result.objectPosition, '50% 50%');
	assert.ok(result.natural[0] > 0 && result.natural[1] > 0);
	assert.ok(result.containedPaint[0] <= result.imageBox[0] && result.containedPaint[1] <= result.imageBox[1]);
	assert.ok(result.adminEditVisible && result.closeVisible && result.previousVisible && result.nextVisible && result.ctaVisible);
	await page.locator('[data-dclose]').click();
	return result;
}

(async function () {
	fs.mkdirSync(evidence, { recursive: true });
	const server = childProcess.spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: repo, stdio: 'ignore' });
	const results = { startedAt: new Date().toISOString(), checks: {}, desktop: {}, mobile: {}, failures: [] };
	let browser;
	try {
		await sleep(500);
		browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });

		const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
		const desktop = await desktopContext.newPage();
		await ready(desktop, '?admin=1');
		await desktop.addStyleTag({ content: ':is(#student-os-root,body) .mmdv2-locked-detail img{object-fit:fill!important}' });
		await desktop.locator('.mmdv2-card[data-open="homebase"]').click();
		await desktop.locator('#mmdv2-ov.open').screenshot({ path: path.join(evidence, 'desktop-before.png') });
		await desktop.locator('[data-dclose]').click();
		await ready(desktop, '?admin=1');
		for (const app of apps) { results.desktop[app] = await inspectPopup(desktop, app); }
		assert.equal(new Set(Object.values(results.desktop).map((item) => item.naturalRatio.toFixed(6))).size, 8);
		await desktop.locator('.mmdv2-card[data-open="homebase"]').click();
		await desktop.keyboard.press('ArrowRight');
		assert.equal((await desktop.locator('.mmdv2-dnm').textContent()).trim(), 'Calendar');
		await desktop.keyboard.press('ArrowLeft');
		assert.equal((await desktop.locator('.mmdv2-dnm').textContent()).trim(), 'HomeBase');
		await desktop.locator('#mmdv2-ov.open').screenshot({ path: path.join(evidence, 'desktop-after.png') });
		await desktop.keyboard.press('Escape');
		assert.equal(await desktop.locator('#mmdv2-ov.open').count(), 0);
		results.checks.desktopAllEight = 'PASS';
		results.checks.keyboardAndControls = 'PASS';
		await desktopContext.close();

		const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
		const mobile = await mobileContext.newPage();
		await ready(mobile, '?admin=1');
		results.mobile.homebase = await inspectPopup(mobile, 'homebase');
		results.mobile.scheduler = await inspectPopup(mobile, 'scheduler');
		await mobile.locator('.mmdv2-card[data-open="homebase"]').click();
		await mobile.locator('#mmdv2-ov.open').screenshot({ path: path.join(evidence, 'mobile-after.png') });
		const mobileLayout = await mobile.evaluate(() => ({ viewport: [innerWidth, innerHeight], documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth }));
		assert.deepEqual(mobileLayout.viewport, [390, 844]);
		assert.ok(mobileLayout.documentWidth <= 390 && mobileLayout.bodyWidth <= 390);
		results.mobile.layout = mobileLayout;
		results.checks.mobile390x844 = 'PASS';
		await mobileContext.close();

		const studentContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
		const student = await studentContext.newPage();
		await ready(student, '?admin=0');
		assert.equal(await student.locator('.mmdv2-card-locked').count(), 8);
		await student.locator('.mmdv2-card[data-open="homebase"]').click();
		assert.equal(await student.locator('#mmdv2-ov [data-editapp]').count(), 0);
		assert.equal(await student.locator('#mmdv2-ov [data-launch="homebase"]').count(), 1);
		results.checks.studentLockedState = 'PASS';
		await studentContext.close();

		const classicContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
		const classic = await classicContext.newPage();
		await ready(classic, '?admin=1&classic=1');
		assert.equal(await classic.locator('.classic-marker').count(), 1);
		results.checks.classic = 'PASS';
		await classicContext.close();

		const reducedContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
		const reduced = await reducedContext.newPage();
		await ready(reduced, '?admin=1');
		assert.equal(await reduced.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
		results.checks.reducedMotion = 'PASS';
		await reducedContext.close();
	} catch (error) {
		results.failures.push(error.stack || String(error));
		process.exitCode = 1;
	} finally {
		results.finishedAt = new Date().toISOString();
		fs.writeFileSync(path.join(evidence, 'popup-aspect-ratio-results.json'), JSON.stringify(results, null, 2) + '\n');
		if (browser) { await browser.close(); }
		server.kill('SIGTERM');
		if (results.failures.length) { console.error(results.failures.join('\n')); } else { console.log(JSON.stringify(results.checks)); }
	}
}());
