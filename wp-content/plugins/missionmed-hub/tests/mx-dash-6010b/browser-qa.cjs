'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const repo = path.resolve(__dirname, '../../../../..');
const evidence = path.join(repo, '_AI_HANDOFFS/from_codex/MX-DASH-6010B/evidence');
const port = 8765;
const base = 'http://127.0.0.1:' + port + '/wp-content/plugins/missionmed-hub/tests/mx-dash-6010b/harness.html';
fs.mkdirSync(evidence, { recursive: true });

function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
async function ready(page, suffix) {
	await page.goto(base + (suffix || ''), { waitUntil: 'networkidle' });
	await page.waitForSelector('.mmdv2, .classic-marker');
}
function collectFailures(page, bucket) {
	page.on('console', function (message) { if (message.type() === 'error') { bucket.push('console: ' + message.text()); } });
	page.on('pageerror', function (error) { bucket.push('pageerror: ' + error.message); });
	page.on('response', function (response) { if (response.status() >= 400 && !/favicon\.ico$/.test(response.url())) { bucket.push('http ' + response.status() + ': ' + response.url()); } });
}

(async function () {
	const server = childProcess.spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: repo, stdio: 'ignore' });
	const results = { startedAt:new Date().toISOString(), checks:{}, metrics:{}, failures:[] };
	let browser;
	try {
		await sleep(500);
		browser = await chromium.launch({ headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args:['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
		const context = await browser.newContext({ viewport:{width:1440,height:1200}, deviceScaleFactor:1 });
		const page = await context.newPage();
		collectFailures(page, results.failures);
		await ready(page, '?admin=1');

		assert.equal(await page.locator('.mmdv2-card-locked').count(), 8);
		assert.equal(await page.locator('.mmdv2-morph').count(), 8);
		assert.equal(await page.locator('.mmdv2-card-locked .mmdv2-meta:visible').count(), 0);
		assert.equal(await page.locator('.mmdv2-card-locked .mmdv2-cat:visible').count(), 0);
		const sources = await page.locator('.mmdv2-morph').evaluateAll(function (nodes) {
			return nodes.map(function (node) {
				var pencil = node.querySelector('.mmdv2-morph-pencil');
				return { id:node.dataset.morphApp, pencil:pencil.getAttribute('src'), width:pencil.naturalWidth, height:pencil.naturalHeight, target:node.querySelector('.mmdv2-morph-cinematic').dataset.src };
			});
		});
		assert.equal(sources.length, 8);
		sources.forEach(function (source) {
			assert.match(source.pencil, new RegExp('/locked-art/pencil/' + source.id + '\\.png$'));
			assert.match(source.target, new RegExp('/locked-art/cinematic/' + source.id + '\\.png$'));
			assert.ok(source.width > 0 && source.height > 0);
		});
		results.checks.adminLockedEndpoints = 'PASS';
		await page.screenshot({ path:path.join(evidence, 'admin-pencil-desktop.png'), animations:'disabled', timeout:90000 });

		const first = page.locator('.mmdv2-card').first();
		await first.hover();
		await page.waitForFunction(function () { return document.querySelector('.mmdv2-morph').classList.contains('is-target'); }, null, { timeout:5000 });
		let diag = await page.evaluate(function () { return window.MMED_DASH_MORPH_DIAGNOSTICS; });
		assert.equal(diag.mode, 'webgl2');
		assert.equal(diag.endpoint, 'cinematic');
		assert.equal(diag.activeContexts, 0);
		assert.equal(diag.maxContexts, 1);
		results.metrics.homeBase = {
			diagnostics:Object.assign({}, diag),
			endpointStyles:await page.locator('.mmdv2-morph').first().evaluate(function (node) {
				var pencil = node.querySelector('.mmdv2-morph-pencil');
				var cinematic = node.querySelector('.mmdv2-morph-cinematic');
				return {
					nodeClass:node.className,
					pencilOpacity:getComputedStyle(pencil).opacity,
					cinematicOpacity:getComputedStyle(cinematic).opacity,
					canvasCount:node.querySelectorAll('canvas').length
				};
			})
		};
		await first.screenshot({ path:path.join(evidence, 'homebase-cinematic.png') });
		await page.mouse.move(2, 2);
		await page.waitForFunction(function () { var node = document.querySelector('.mmdv2-morph'); return !node.classList.contains('is-target') && window.MMED_DASH_MORPH_DIAGNOSTICS.activeContexts === 0; }, null, { timeout:5000 });
		diag = await page.evaluate(function () { return window.MMED_DASH_MORPH_DIAGNOSTICS; });
		assert.equal(diag.endpoint, 'pencil');
		assert.equal(diag.activeContexts, 0);
		results.checks.homeBaseForwardReverse = 'PASS';

		await first.hover();
		await page.waitForTimeout(410);
		assert.ok(await page.locator('.mmdv2-morph').first().evaluate(function (node) { return node.classList.contains('is-running') && node.querySelectorAll('canvas').length === 1; }));
		await first.screenshot({ path:path.join(evidence, 'homebase-morph-midpoint.png') });
		await page.waitForFunction(function () { return document.querySelector('.mmdv2-morph').classList.contains('is-target'); }, null, { timeout:5000 });
		await page.mouse.move(2, 2);
		await page.waitForFunction(function () { var node = document.querySelector('.mmdv2-morph'); return !node.classList.contains('is-target') && window.MMED_DASH_MORPH_DIAGNOSTICS.activeContexts === 0; }, null, { timeout:5000 });
		results.checks.shaderMidpoint = 'PASS';

		await first.focus();
		await page.waitForFunction(function () { return document.querySelector('.mmdv2-morph').classList.contains('is-target'); }, null, { timeout:5000 });
		assert.ok(await page.locator('.mmdv2-morph').first().evaluate(function (node) { return node.classList.contains('is-target'); }));
		await page.locator('.mmdv2-q').focus();
		await page.waitForFunction(function () { var node = document.querySelector('.mmdv2-morph'); return !node.classList.contains('is-target') && window.MMED_DASH_MORPH_DIAGNOSTICS.activeContexts === 0; }, null, { timeout:5000 });
		results.checks.keyboard = 'PASS';

		for (let i = 0; i < 8; i += 1) {
			await page.locator('.mmdv2-card').nth(i).hover();
			await page.waitForFunction(function (index) { return document.querySelectorAll('.mmdv2-morph')[index].classList.contains('is-target'); }, i, { timeout:5000 });
			assert.ok(await page.locator('.mmdv2-morph').nth(i).evaluate(function (node) { return node.classList.contains('is-target'); }));
			await page.mouse.move(2, 2);
			await page.waitForFunction(function (index) { var node = document.querySelectorAll('.mmdv2-morph')[index]; return !node.classList.contains('is-target') && window.MMED_DASH_MORPH_DIAGNOSTICS.activeContexts === 0; }, i, { timeout:5000 });
		}
		results.checks.allEight = 'PASS';

		for (let i = 0; i < 30; i += 1) {
			await first.hover(); await page.waitForTimeout(45);
			await page.mouse.move(2, 2); await page.waitForTimeout(45);
		}
		await page.waitForTimeout(950);
		diag = await page.evaluate(function () { return window.MMED_DASH_MORPH_DIAGNOSTICS; });
		assert.equal(diag.activeContexts, 0);
		assert.equal(diag.maxContexts, 1);
		assert.equal(diag.contextsCreated, 1);
		assert.equal(diag.resourceSetsCreated, diag.resourceSetsDisposed);
		assert.equal(diag.failures, 0);
		assert.equal(diag.mode, 'webgl2');
		results.checks.stressNoLeak = 'PASS';
		results.metrics.stress = Object.assign({}, diag);

		await first.hover(); await page.waitForTimeout(120);
		await page.evaluate(function () { location.hash = 'calendar'; });
		await page.waitForTimeout(100);
		diag = await page.evaluate(function () { return window.MMED_DASH_MORPH_DIAGNOSTICS; });
		assert.equal(diag.activeContexts, 0);
		assert.equal(diag.contextsCreated, diag.contextsDisposed);
		assert.equal(await page.locator('#student-os-root.mmdv2-active').count(), 0);
		results.checks.routeCleanup = 'PASS';
		results.metrics.routeCleanup = Object.assign({}, diag);

		await ready(page, '?admin=1');
		await page.locator('.mmdv2-card').nth(1).click();
		assert.equal(await page.locator('#mmdv2-ov.open').count(), 1);
		assert.match(await page.locator('.mmdv2-locked-detail img').getAttribute('src'), /locked-art\/cinematic\/calendar\.png$/);
		assert.equal(await page.locator('#mmdv2-ov [data-launch="calendar"]').count(), 1);
		await page.locator('#mmdv2-ov [data-launch="calendar"]').first().click();
		assert.equal(await page.evaluate(function () { return location.hash; }), '#calendar');
		results.checks.cardDetailLaunch = 'PASS';

		await ready(page, '?admin=1');
		await page.locator('[data-edit-toggle]').click();
		await page.locator('[data-editapp="homebase"]').first().click();
		assert.equal(await page.locator('#mmdv2-ed.open form').count(), 1);
		assert.equal(await page.locator('#mmdv2-ed input[name="card_image"]').count(), 1);
		results.checks.editorPreserved = 'PASS';
		await page.locator('#mmdv2-ed [data-edclose]').first().click();

		await ready(page, '?admin=1&override=homebase');
		assert.equal(await page.locator('.mmdv2-morph').count(), 7);
		assert.equal(await page.locator('.mmdv2-card[data-open="homebase"].mmdv2-card-locked').count(), 0);
		assert.equal(await page.locator('.mmdv2-card[data-open="homebase"] .mmdv2-meta:visible').count(), 1);
		results.checks.adminOverride = 'PASS';

		await ready(page, '?admin=1&copyoverride=homebase');
		assert.equal(await page.locator('.mmdv2-morph').count(), 8);
		assert.equal(await page.locator('.mmdv2-card[data-open="homebase"].mmdv2-card-locked').count(), 1);
		results.checks.copyOnlyOverride = 'PASS';

		await ready(page, '?admin=0');
		assert.equal(await page.locator('.mmdv2-morph').count(), 0);
		assert.equal(await page.locator('[data-edit-toggle], [data-persp]').count(), 0);
		results.checks.studentUnchanged = 'PASS';

		await ready(page, '?classic=1&admin=1');
		assert.equal(await page.locator('.classic-marker').count(), 1);
		assert.equal(await page.locator('.mmdv2').count(), 0);
		results.checks.classic = 'PASS';
		await context.close();

		const reducedContext = await browser.newContext({ viewport:{width:1200,height:900}, reducedMotion:'reduce' });
		const reducedPage = await reducedContext.newPage();
		collectFailures(reducedPage, results.failures);
		await ready(reducedPage, '?admin=1');
		await reducedPage.locator('.mmdv2-card').first().focus();
		await reducedPage.waitForTimeout(250);
		diag = await reducedPage.evaluate(function () { return window.MMED_DASH_MORPH_DIAGNOSTICS; });
		assert.equal(diag.mode, 'reduced-motion');
		assert.ok(await reducedPage.locator('.mmdv2-morph').first().evaluate(function (node) { return node.classList.contains('is-target'); }));
		results.checks.reducedMotion = 'PASS';
		await reducedContext.close();

		const fallbackContext = await browser.newContext({ viewport:{width:1200,height:900} });
		const fallbackPage = await fallbackContext.newPage();
		collectFailures(fallbackPage, results.failures);
		await ready(fallbackPage, '?admin=1&fallback=1');
		await fallbackPage.locator('.mmdv2-card').first().hover();
		await fallbackPage.waitForTimeout(300);
		diag = await fallbackPage.evaluate(function () { return window.MMED_DASH_MORPH_DIAGNOSTICS; });
		assert.equal(diag.mode, 'css-fallback');
		assert.ok(await fallbackPage.locator('.mmdv2-morph').first().evaluate(function (node) { return node.classList.contains('is-target'); }));
		results.checks.webglFallback = 'PASS';
		await fallbackContext.close();

		const mobileContext = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:1, isMobile:true, hasTouch:true });
		const mobilePage = await mobileContext.newPage();
		collectFailures(mobilePage, results.failures);
		await ready(mobilePage, '?admin=1');
		await mobilePage.locator('.mmdv2-card').first().scrollIntoViewIfNeeded();
		await mobilePage.waitForTimeout(1100);
		const mobile = await mobilePage.evaluate(function () {
			var card = document.querySelector('.mmdv2-card');
			var rect = card.getBoundingClientRect();
			return {
				viewport:[innerWidth,innerHeight], documentWidth:document.documentElement.scrollWidth,
				card:{left:rect.left,right:rect.right,width:rect.width},
				diag:window.MMED_DASH_MORPH_DIAGNOSTICS
			};
		});
		assert.ok(mobile.documentWidth <= 391);
		assert.ok(mobile.card.left >= -1 && mobile.card.right <= 391);
		assert.ok(mobile.diag.transitions > 0);
		await mobilePage.locator('.mmdv2-card').nth(1).click();
		assert.equal(await mobilePage.locator('#mmdv2-ov.open').count(), 1);
		assert.ok(await mobilePage.locator('#mmdv2-ov [data-launch="calendar"]').first().isVisible());
		await mobilePage.screenshot({ path:path.join(evidence, 'admin-mobile-390x844.png'), animations:'disabled', timeout:90000 });
		results.checks.mobile390x844 = 'PASS';
		results.metrics.mobile = mobile;
		await mobileContext.close();

		assert.deepEqual(results.failures, []);
		results.finishedAt = new Date().toISOString();
		fs.writeFileSync(path.join(evidence, 'browser-qa-results.json'), JSON.stringify(results, null, 2) + '\n');
		process.stdout.write(JSON.stringify(results, null, 2) + '\n');
	} catch (error) {
		results.finishedAt = new Date().toISOString();
		results.error = error.stack || String(error);
		fs.writeFileSync(path.join(evidence, 'browser-qa-results.json'), JSON.stringify(results, null, 2) + '\n');
		process.stderr.write(results.error + '\n');
		process.exitCode = 1;
	} finally {
		if (browser) { await browser.close(); }
		server.kill('SIGTERM');
	}
}());
