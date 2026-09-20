// Browser walkthrough of the prototype against the local harness. Screenshots -> harness/shots/.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'http://127.0.0.1:8088';
const HARNESS_ROOT = process.env.MMPS_HARNESS_ROOT || '/home/claude/wpdev';
const SHOTS = `${HARNESS_ROOT}/harness/shots`;
fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
const ok = (name, cond, detail = '') => { results.push({ name, pass: !!cond }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (!cond && detail ? ' -> ' + detail : '')); };

(async () => {
	const launchOptions = process.env.MMPS_BROWSER_CHANNEL ? { channel: process.env.MMPS_BROWSER_CHANNEL } : {};
	const browser = await chromium.launch(launchOptions);
	const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
	const page = await ctx.newPage();
	const problems = [];
	let expect409 = false;
	page.on('console', (m) => { if (m.type() === 'error' && !(expect409 && /409/.test(m.text()))) problems.push('console: ' + m.text()); });
	page.on('pageerror', (e) => page.url().includes('/wp-admin/') ? null : problems.push('pageerror: ' + e.message + ' @ ' + page.url() + ' :: ' + String(e.stack || '').split('\n').slice(0,3).join(' | ')));
	const shot = async (name) => { await page.waitForTimeout(450); return page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false }); };

	// login
	await page.goto(BASE + '/wp-login.php');
	await page.fill('#user_login', 'tester'); await page.fill('#user_pass', 'Tester-Local-1!');
	await Promise.all([page.waitForNavigation(), page.click('#wp-submit')]);
	await ctx.addCookies([{ name: 'mmhq_rise_session', value: 'good-session', url: BASE }]);

	// File Vault entry
	await page.goto(BASE + '/member-dashboard/');
	await page.waitForTimeout(1200);
	const launcher = page.locator('#mmps-entry-host').locator('a.c');
	ok('launcher visible on the File Vault page', await launcher.isVisible());
	ok('File Vault stage DOM untouched by the launcher', await page.evaluate(() => { const s = document.getElementById('sos-content'); return s.children.length === 1 && s.querySelector('#fv-canary') !== null && !s.querySelector('[data-mmps]'); }));
	await shot('01-file-vault-entry');
	await Promise.all([page.waitForNavigation(), launcher.click()]);
	await page.waitForSelector('.h1');
	ok('prototype opens from File Vault', page.url().includes('mmed_ps_proto=1'));
	await shot('02-home');

	// step 1 ROOT
	await page.click('button:has-text("Start a new ROOT")');
	await page.waitForSelector('[data-act="source"]');
	await page.waitForFunction(() => !document.body.innerText.includes('Checking File Vault'));
	await page.click('[data-source="FILE_VAULT"]');
	await shot('03-root-file-vault-versions');
	ok('File Vault PS versions listed; unverified version disabled', await page.locator('[data-act="pick-file"]').count() === 4 && await page.locator('[data-act="pick-file"][disabled]').count() === 1);
	await page.click('[data-source="SYNTHETIC"]');
	await shot('04-root-synthetic');
	await page.click('[data-act="create-root"]');

	// step 2 region
	await page.waitForSelector('.para.region');
	ok('program paragraph pre-highlighted (paragraph 5)', (await page.locator('.para.region').innerText()).includes('I am looking for a residency program'));
	await shot('05-region');
	await page.locator('.para.pick').nth(2).click();
	ok('user can re-mark the region by clicking another paragraph', (await page.locator('.para.region').innerText()).includes('I wanted to know how often'));
	await page.locator('.para.pick').nth(3).click();
	await page.click('[data-act="region-mode"][data-mode="INSERT_BEFORE"]');
	await shot('06-region-insert-mode');
	await page.click('[data-act="region-mode"][data-mode="REPLACE_PARAGRAPH"]');
	await page.click('[data-act="save-region"]');

	// step 3 preferences
	await page.waitForSelector('[data-act="cat"]');
	await page.click('[data-act="cat"][data-key="fellowship"][data-on="1"]');
	await page.click('[data-act="term"][data-key="fellowship"][data-term="Cardiology"]');
	await page.fill('[data-add="fellowship"]', 'advanced heart failure'); await page.press('[data-add="fellowship"]', 'Enter');
	await page.click('[data-act="cat"][data-key="research"][data-on="1"]');
	await page.click('[data-act="term"][data-key="research"][data-term="Quality improvement"]');
	await page.click('[data-act="cat"][data-key="population"][data-on="1"]');
	await page.click('[data-act="term"][data-key="population"][data-term="Safety-net hospital"]');
	await page.click('[data-act="loc"][data-on="1"]');
	await page.selectOption('[data-state-add]', 'NY');
	await page.fill('[data-loc-reason]', 'my clinical rotations were in western New York');
	await page.check('[data-loc-mention]');
	await page.evaluate(() => window.scrollTo(0, 0));
	await shot('07-preferences');
	await page.click('[data-act="save-prefs"]');

	// step 4 programs
	await page.waitForSelector('.prog');
	await page.waitForFunction(() => document.querySelectorAll('[data-act="toggle-program"]').length >= 3);
	ok('RISE list shows differing evidence quality', (await page.locator('.tag:has-text("Deep ready")').count()) >= 1 && (await page.locator('.tag:has-text("One deep fact")').count()) >= 1 && (await page.locator('.tag:has-text("Essential only")').count()) >= 1);
	for (const id of ['ps_deep_001', 'ps_thin_002', 'ps_ess_003']) { await page.click(`[data-act="toggle-program"][data-id="${id}"]`); }
	await page.fill('[data-search]', 'harborview'); await page.click('[data-act="search"]');
	await page.waitForSelector('[data-act="toggle-program"][data-id="ps_dirty_004"]');
	await page.click('[data-act="toggle-program"][data-id="ps_dirty_004"]');
	await page.waitForTimeout(600);
	await page.evaluate(() => window.scrollTo(0, 0));
	await shot('08-programs');
	await page.click('button:has-text("Choose tiers")');

	// step 5 tiers + generate
	await page.waitForSelector('[data-act="generate-all"]');
	ok('default tiers: Gold/top = Deep, priority 30 = Essential', await page.locator('[data-act="tier"][data-id="ps_deep_001"][data-tier="DEEP"].on').count() === 1 && await page.locator('[data-act="tier"][data-id="ps_ess_003"][data-tier="ESSENTIAL"].on').count() === 1);
	await shot('09-tiers');
	await page.click('[data-act="generate-all"]');
	await page.waitForFunction(() => document.querySelectorAll('[data-act="open-run"]').length === 4, null, { timeout: 60000 });
	ok('statuses: Ready + Deep research needed both present', (await page.locator('.prog .tag:has-text("Ready")').count()) >= 2 && (await page.locator('.prog .tag:has-text("Deep research needed")').count()) === 1);
	await page.evaluate(() => window.scrollTo(0, 0));
	await shot('10-generated');

	// step 6 preview (deep)
	await page.click('[data-act="open-run"][data-id="ps_deep_001"]');
	await page.waitForSelector('.para.region');
	ok('preview: full PS (6 paragraphs), one highlighted region', await page.locator('.paper .para').count() === 6 && await page.locator('.paper .para.region').count() === 1);
	ok('preview: five accessible writing choices with one recommended default', await page.locator('.candidateChoice').count() === 5 && await page.locator('.candidateChoice .tag:has-text("Recommended")').count() === 1 && await page.locator('.candidateChoices[role="radiogroup"]').count() === 1);
	ok('preview: verified-fact underlines rendered from segments', (await page.locator('.seg-fact').count()) >= 2);
	ok('preview: ROOT check Unchanged + selected facts with sources', (await page.locator('.tag:has-text("Unchanged")').count()) === 1 && (await page.locator('.fact.used').count()) >= 2 && (await page.locator('.factSrc a').count()) >= 1);
	await shot('11-preview-deep');
	await page.check('[data-show-original]');
	ok('preview: diff shows the replaced ROOT paragraph', await page.locator('.para.old').count() === 1);
	await page.locator('.para.old').scrollIntoViewIfNeeded();
	await shot('12-preview-diff');
	const beforeChoice = await page.locator('.para.region').innerText();
	await page.locator('.candidateChoice:not(.on)').first().click();
	ok('choosing an alternative reconstructs a different complete-PS preview', (await page.locator('.para.region').innerText()) !== beforeChoice && await page.locator('.candidateChoice.on').count() === 1);
	const before = await page.locator('.para.region').innerText();
	await page.click('[data-act="generate"][data-id="ps_deep_001"]');
	await page.waitForFunction((b) => { const el = document.querySelector('.para.region'); return el && el.innerText !== b; }, before, { timeout: 60000 });
	ok('regenerate produces a different paragraph', true);
	await page.click('[data-act="save"][data-status="APPROVED"]');
	await page.waitForSelector('.tag:has-text("Saved")');
	await page.evaluate(() => window.scrollTo(0, 0));
	await shot('13-preview-saved');

	// research needed
	await page.click('.chips [data-act="open-run"][data-id="ps_thin_002"]');
	await page.waitForSelector('.tag:has-text("Deep research needed")');
	await page.click('[data-act="research-prompt"]');
	await page.waitForSelector('pre.prompt');
	await shot('14-deep-research-needed');
	await page.click('[data-act="generate-essential"]');
	await page.waitForSelector('.para.region', { timeout: 60000 });
	ok('Research Needed -> Essential fallback works', (await page.locator('.tag.em:has-text("ESSENTIAL")').count()) >= 1);
	await page.click('[data-act="save"][data-status="DRAFT"]');
	await page.waitForSelector('.tag:has-text("Saved")');

	// library + document + download
	await page.click('.hdr [data-view="library"]');
	await page.waitForFunction(() => document.querySelectorAll('table.lib tbody tr').length === 2, null, { timeout: 15000 }).catch(() => {});
	ok('library lists saved statements', await page.locator('table.lib tbody tr').count() === 2);
	await shot('15-library');
	const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('table.lib a:has-text("DOCX")').first().click()]);
	const file = `${SHOTS}/../files/ui-download.docx`; await dl.saveAs(file);
	ok('DOCX downloads from the library', fs.statSync(file).size > 1500 && dl.suggestedFilename().endsWith('.docx'), dl.suggestedFilename());
	await page.locator('[data-act="open-doc"]').first().click();
	await page.waitForSelector('.paper');
	await shot('16-library-document');

	// M3 durable batch: import, default tiers, bounded/resumable processing,
	// exception-focused approval and bulk ZIPs.
	await page.click('.hdr [data-view="batch"]');
	await page.waitForSelector('[data-act="batch-create"]');
	ok('batch imports the full RISE list without private notes', /programs ready/.test(await page.locator('.h2').filter({ hasText: 'programs ready' }).innerText()));
	await page.click('[data-act="batch-create"]');
	await page.waitForSelector('.batchTable');
	ok('batch defaults priority programs to Deep and lower programs to Essential', await page.locator('.batchTable [data-tier="DEEP"].on').count() >= 1 && await page.locator('.batchTable [data-tier="ESSENTIAL"].on').count() >= 1);
	await shot('17-batch-created');
	await page.click('[data-act="batch-run"]');
	await page.waitForFunction(() => {
		const el = [...document.querySelectorAll('.h2')].find((n) => /processed/.test(n.textContent));
		const m = el && el.textContent.match(/(\d+) of (\d+) processed/);
		return m && m[1] === m[2];
	}, null, { timeout: 90000 });
	ok('batch finishes with durable per-program statuses and capped attempts', await page.locator('.batchTable tbody tr').count() >= 4 && await page.locator('.batchTable td:nth-child(4)').evaluateAll((els) => els.every((e) => /\d+ \/ 3/.test(e.textContent))));
	ok('batch surfaces clean outputs separately from research/attention exceptions', await page.locator('.batchTable .tag:has-text("Ready")').count() >= 1 && await page.locator('.batchTable .tag:has-text("Research")').count() >= 1);
	await shot('18-batch-complete');
	const approveClean = page.locator('[data-act="batch-approve-ready"]');
	if (await approveClean.count()) { await approveClean.click(); await page.waitForTimeout(900); }
	ok('recommended defaults can be approved without opening every clean item', await page.locator('.batchTable .tag:has-text("Approved")').count() >= 1);

	await page.click('.hdr [data-view="library"]');
	await page.waitForSelector('[data-doc-select]');
	const checkboxes = page.locator('[data-doc-select]');
	await checkboxes.nth(0).check();
	await checkboxes.nth(1).check();
	const [selectedZip] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="bulk-selected"]')]);
	const selectedZipFile = `${SHOTS}/../files/ui-selected.zip`; await selectedZip.saveAs(selectedZipFile);
	ok('selected statements download as a ZIP', fs.statSync(selectedZipFile).size > 500 && fs.readFileSync(selectedZipFile).subarray(0, 2).toString() === 'PK');
	const [allZip] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="bulk-approved"]')]);
	const allZipFile = `${SHOTS}/../files/ui-all-approved.zip`; await allZip.saveAs(allZipFile);
	ok('Download All approved creates a ZIP', fs.statSync(allZipFile).size > 500 && fs.readFileSync(allZipFile).subarray(0, 2).toString() === 'PK');
	await shot('19-library-bulk');

	// responsive
	await page.setViewportSize({ width: 820, height: 1100 });
	await page.click('.rail [data-view="home"]');
	await shot('20-tablet-home');
	ok('no horizontal overflow at 820px', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

	// RISE session missing state
	await page.setViewportSize({ width: 1440, height: 900 });
	expect409 = true;
	await ctx.clearCookies({ name: 'mmhq_rise_session' });
	await page.goto(BASE + '/?mmed_ps_proto=1');
	await page.waitForSelector('[data-act="open-root"]');
	await page.locator('[data-act="open-root"]').first().click();
	await page.waitForSelector('.prog, .notice');
	await page.waitForSelector('text=Open RISE once in this browser');
	await shot('21-rise-session-needed');
	ok('missing RISE session -> clear guidance, no crash', true);

	ok('no console errors, page errors or CSP violations', problems.length === 0, problems.slice(0, 5).join(' | '));
	await browser.close();
	const failed = results.filter((r) => !r.pass);
	console.log(`\n${results.length - failed.length}/${results.length} passed`);
	fs.writeFileSync(`${HARNESS_ROOT}/harness/e2e-ui-results.json`, JSON.stringify({ results, problems }, null, 1));
	process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('WALKTHROUGH CRASHED:', e.message); process.exit(2); });
