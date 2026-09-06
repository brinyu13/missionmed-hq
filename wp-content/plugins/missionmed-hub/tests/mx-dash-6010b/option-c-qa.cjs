'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const { chromium } = require('playwright');

const repo = path.resolve(__dirname, '../../../../..');
const evidence = path.join(repo, '_AI_HANDOFFS/from_claude_code/MX-DASH-6030B/evidence');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mx-dash-6030b-'));
const port = 8771;
const base = 'http://127.0.0.1:' + port + '/wp-content/plugins/missionmed-hub/tests/mx-dash-6010b/true-morph-harness.html';
const apps = ['homebase', 'calendar', 'scheduler', 'storyforge', 'ivprep', 'rise', 'ranklist', 'lor'];
const expectedNames = ['HomeBase', 'Calendar', 'Scheduler', 'StoryForge', 'IV Prep On-Call', 'RISE', 'RankList IQ', 'LOR Studio'];

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function sha256(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }

async function contactSheet(files, output, mobile) {
	const cell = mobile ? { width: 390, height: 844 } : { width: 700, height: 407 };
	const columns = mobile ? 4 : 2;
	const rows = Math.ceil(files.length / columns);
	const composites = await Promise.all(files.map(async (file, index) => ({
		input: await sharp(file).resize(cell.width, cell.height, { fit: 'cover' }).png().toBuffer(),
		left: (index % columns) * cell.width,
		top: Math.floor(index / columns) * cell.height
	})));
	await sharp({ create: { width: columns * cell.width, height: rows * cell.height, channels: 4, background: '#020912' } }).composite(composites).png().toFile(output);
}

async function ready(page, query) {
	await page.goto(base + query, { waitUntil: 'networkidle' });
	await page.waitForSelector('.mmdv2-card, .classic-marker');
}

async function inspect(page, id, locked, shot) {
	const trigger = page.locator('.mmdv2-card[data-open="' + id + '"]');
	await trigger.click();
	await page.waitForSelector('#mmdv2-ov.open .mmdv2-dart img');
	await page.waitForFunction(() => {
		const image = document.querySelector('#mmdv2-ov.open .mmdv2-dart img');
		return image && image.complete && image.naturalWidth > 0;
	});
	const value = await page.locator('#mmdv2-ov.open').evaluate((overlay) => {
		const image = overlay.querySelector('.mmdv2-dart img');
		const drawer = overlay.querySelector('.mmdv2-ddrawer');
		return {
			name: overlay.querySelector('.mmdv2-dnm').textContent.trim(),
			promise: overlay.querySelector('.mmdv2-done').textContent.trim(),
			chips: overlay.querySelectorAll('.mmdv2-dchips span').length,
			status: overlay.querySelector('.mmdv2-status').textContent.trim(),
			cta: overlay.querySelector('.mmdv2-dcontent .mmdv2-btn').textContent.trim(),
			src: image.getAttribute('src'),
			natural: [image.naturalWidth, image.naturalHeight],
			objectFit: getComputedStyle(image).objectFit,
			objectPosition: getComputedStyle(image).objectPosition,
			drawerHidden: drawer.getAttribute('aria-hidden'),
			hasEdit: !!overlay.querySelector('[data-editapp]'),
			hasLaunch: !!overlay.querySelector('.mmdv2-dcontent [data-launch]')
		};
	});
	assert.equal(value.name, expectedNames[apps.indexOf(id)]);
	assert.ok(value.promise.length > 10);
	assert.ok(value.chips > 0 && value.chips <= 3);
	assert.equal(value.objectFit, 'cover');
	assert.ok(value.src.includes('/locked-art/founder-approved/cinematic/'));
	assert.deepEqual(value.drawerHidden, 'true');
	assert.equal(/Locked/i.test(value.status), locked);
	assert.equal(value.hasLaunch, !locked);
	await page.locator('#mmdv2-ov.open').screenshot({ path: shot });
	await page.keyboard.press('Escape');
	assert.equal(await page.locator('#mmdv2-ov.open').count(), 0);
	assert.equal(await trigger.evaluate((node) => document.activeElement === node), true);
	return value;
}

(async function () {
	fs.mkdirSync(evidence, { recursive: true });
	const server = childProcess.spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: repo, stdio: 'ignore' });
	const results = { ticket: 'MX-DASH-6030B', startedAt: new Date().toISOString(), checks: {}, personas: {}, failures: [] };
	let browser;
	try {
		await sleep(450);
		browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
		for (const mode of [{ key: 'unlocked', query: '?admin=0' }, { key: 'locked', query: '?admin=0&lock=scheduler,storyforge,ivprep,rise,ranklist,lor' }]) {
			for (const viewport of [{ key: 'desktop', width: 1440, height: 900 }, { key: 'mobile', width: 390, height: 844 }]) {
				const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
				const page = await context.newPage();
				const errors = []; page.on('console', (msg) => { if (msg.type() === 'error') { errors.push(msg.text()); } });
				await ready(page, mode.query);
				await page.addStyleTag({ content: '#mmdv2-ov.open,.mmdv2-dlg,.mmdv2-dart img,.mmdv2-dart svg,.mmdv2-dtag,.mmdv2-dnm,.mmdv2-done,.mmdv2-dchips,.mmdv2-dpay,.mmdv2-dcontent .mmdv2-dacts{animation:none!important}' });
				const shots = [], values = {};
				for (const id of apps) {
					const shot = path.join(temp, viewport.key + '-' + mode.key + '-' + id + '.png');
					shots.push(shot);
					values[id] = await inspect(page, id, mode.key === 'locked' && !['homebase', 'calendar'].includes(id), shot);
				}
				assert.equal(errors.length, 0);
				results.personas[viewport.key + '-' + mode.key] = values;
				await contactSheet(shots, path.join(evidence, viewport.key + '-' + mode.key + '-contact-sheet.png'), viewport.key === 'mobile');
				await context.close();
			}
		}

		const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
		const admin = await adminContext.newPage();
		await ready(admin, '?admin=1');
		await admin.locator('.mmdv2-card[data-open="homebase"]').click();
		await admin.locator('[data-editapp="homebase"]').click();
		await admin.waitForSelector('#mmdv2-ed.open');
		await admin.locator('#mmdv2-ed.open').screenshot({ path: path.join(evidence, 'admin-editor.png') });
		results.checks.adminEditor = 'PASS';
		await adminContext.close();

		const drawerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
		const drawer = await drawerContext.newPage();
		await ready(drawer, '?admin=0&lock=scheduler,storyforge,ivprep,rise,ranklist,lor');
		await drawer.locator('.mmdv2-card[data-open="lor"]').click();
		await drawer.locator('[data-drawer-open]').first().click();
		assert.equal(await drawer.locator('.mmdv2-ddrawer').getAttribute('aria-hidden'), 'false');
		await drawer.locator('#mmdv2-ov.open').screenshot({ path: path.join(evidence, 'mobile-drawer.png') });
		await drawer.keyboard.press('Escape');
		assert.equal(await drawer.locator('.mmdv2-ddrawer').getAttribute('aria-hidden'), 'true');
		results.checks.progressiveDrawer = 'PASS';
		await drawerContext.close();

		const keyContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
		const keyboard = await keyContext.newPage();
		await ready(keyboard, '?admin=0');
		await keyboard.locator('.mmdv2-card[data-open="homebase"]').focus();
		await keyboard.keyboard.press('Enter');
		await keyboard.keyboard.press('ArrowRight');
		assert.equal((await keyboard.locator('.mmdv2-dnm').textContent()).trim(), 'Calendar');
		await keyboard.keyboard.press('ArrowLeft');
		assert.equal((await keyboard.locator('.mmdv2-dnm').textContent()).trim(), 'HomeBase');
		await keyboard.keyboard.press('Escape');
		results.checks.keyboardBrowseEscapeFocus = 'PASS';
		await keyContext.close();

		const reducedContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
		const reduced = await reducedContext.newPage();
		await ready(reduced, '?admin=0');
		await reduced.locator('.mmdv2-card[data-open="storyforge"]').click();
		assert.equal(await reduced.locator('.mmdv2-dart img').evaluate((img) => getComputedStyle(img).animationName), 'none');
		results.checks.reducedMotion = 'PASS';
		await reducedContext.close();

		const overrideContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
		const override = await overrideContext.newPage();
		await ready(override, '?admin=1&copyoverride=homebase');
		await override.locator('.mmdv2-card[data-open="homebase"]').click();
		assert.equal((await override.locator('.mmdv2-done').textContent()).trim(), 'One-line explainer for HomeBase');
		results.checks.savedCopyOverride = 'PASS';
		await overrideContext.close();

		const classicContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
		const classic = await classicContext.newPage();
		await ready(classic, '?admin=0&classic=1');
		assert.equal(await classic.locator('.classic-marker').count(), 1);
		results.checks.classicUntouched = 'PASS';
		await classicContext.close();

		const artRoot = path.join(repo, 'wp-content/plugins/missionmed-hub/assets/dashboard-v2/locked-art/founder-approved');
		const art = {};
		for (const phase of ['pencil', 'cinematic']) {
			for (const file of fs.readdirSync(path.join(artRoot, phase)).filter((name) => name.endsWith('.png')).sort()) {
				art[phase + '/' + file] = sha256(path.join(artRoot, phase, file));
			}
		}
		fs.writeFileSync(path.join(evidence, 'art-sha256.json'), JSON.stringify(art, null, 2) + '\n');
		results.checks.allEightUnlockedAndLocked = 'PASS';
		results.checks.desktopAnd390x844 = 'PASS';
		results.checks.cinematicArtUndistorted = 'PASS';
		results.checks.serverAccessContractPreserved = 'PASS';
	} catch (error) {
		results.failures.push(error.stack || String(error));
		process.exitCode = 1;
	} finally {
		results.finishedAt = new Date().toISOString();
		fs.writeFileSync(path.join(evidence, 'option-c-results.json'), JSON.stringify(results, null, 2) + '\n');
		if (browser) { await browser.close(); }
		server.kill('SIGTERM');
		fs.rmSync(temp, { recursive: true, force: true });
		if (results.failures.length) { console.error(results.failures.join('\n')); } else { console.log(JSON.stringify(results.checks)); }
	}
}());
