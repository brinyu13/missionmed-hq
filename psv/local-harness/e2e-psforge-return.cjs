// Disposable browser acceptance for PSForge's native Return to Matrix control.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.MMPS_BASE_URL || 'http://127.0.0.1:8088';
let passed = 0;
function ok(label, value) { assert.ok(value, label); console.log('PASS ' + label); passed++; }
async function login(page, username, password) {
	for (let attempt = 0; attempt < 2; attempt++) {
		await page.goto(base + '/wp-login.php');
		if (!page.url().includes('/wp-login.php')) return;
		await page.waitForLoadState('networkidle');
		await page.fill('#user_login', username); await page.fill('#user_pass', password);
		await page.waitForFunction(() => document.querySelector('#user_pass')?.value.length > 0);
		await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.locator('#wp-submit').click()]);
		if (!page.url().includes('/wp-login.php')) return;
	}
	throw new Error('disposable WordPress login did not establish a session');
}

(async () => {
	const browser = await chromium.launch({ channel: process.env.MMPS_BROWSER_CHANNEL || 'chrome', headless: true });
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await context.newPage();
	const errors = []; let writes = 0; let nativeDialogs = 0;
	page.on('pageerror', e => errors.push(e.message));
	page.on('dialog', async dialog => { nativeDialogs++; await dialog.dismiss(); });
	page.on('request', r => { if (/mmed-ps-proto/.test(r.url()) && r.method() !== 'GET') writes++; });
	await page.route('https://missionmedinstitute.com/member-dashboard/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<main id="matrix-dashboard">Matrix Dashboard</main>' }));
	await login(page, 'tester', 'Tester-Local-1!');
	await context.addCookies([{ name: 'mmhq_rise_session', value: 'good-session', url: base }]);
	await page.goto(base + '/?mmed_ps_proto=1'); await page.waitForSelector('.matrixBack');
	const back = page.locator('.matrixBack');
	ok('one native Return control', await back.count() === 1);
	ok('exact Matrix Dashboard destination', await back.getAttribute('href') === 'https://missionmedinstitute.com/member-dashboard/#dashboard');
	await back.waitFor({ state: 'visible' });
	ok('visible accessible label', (await back.textContent()) === '←Return to Matrix' && await back.getAttribute('aria-label') === 'Return to Matrix Dashboard');
	await back.focus(); ok('keyboard focus reaches native Return', await back.evaluate(n => document.activeElement === n));
	const before = writes; await Promise.all([page.waitForSelector('#matrix-dashboard'), back.press('Enter')]);
	ok('ordinary activation navigates without a PSV write', writes === before);

	await page.goto(base + '/?mmed_ps_proto=1'); await page.locator('[data-act="go"][data-view="root"]').first().click();
	await page.waitForFunction(() => !document.body.innerText.includes('Checking File Vault'));
	await page.locator('[data-act="source"][data-source="PASTED"]').click();
	const text = Array.from({ length: 6 }, (_, index) => `Disposable local statement paragraph ${index + 1}. ` + 'This fictional sentence provides enough safe text for region detection. '.repeat(3)).join('\n\n');
	await page.locator('[data-bind="text"]').fill(text); await page.locator('.matrixBack').click();
	ok('pasted draft opens leave guard', await page.getByRole('heading', { name: 'Leave PSForge with an unfinished draft?' }).isVisible());
	await page.getByRole('button', { name: 'Stay in PSForge' }).click();
	ok('cancel preserves pasted draft and route', await page.locator('[data-bind="text"]').inputValue() === text && /mmed_ps_proto=1/.test(page.url()));
	ok('cancel restores Return focus', await page.locator('.matrixBack').evaluate(n => document.activeElement === n));

	await page.locator('[data-act="source"][data-source="UPLOADED"]').click();
	await page.locator('[data-root-file]').setInputFiles({ name: 'disposable-root.txt', mimeType: 'text/plain', buffer: Buffer.from(text) });
	await page.locator('.matrixBack').click(); await page.getByRole('button', { name: 'Stay in PSForge' }).click();
	ok('cancel preserves selected local upload', await page.getByText('disposable-root.txt', { exact: true }).isVisible());
	await page.locator('.matrixBack').click();
	ok('confirmed local-draft leave has one app confirmation', await page.getByRole('heading', { name: 'Leave PSForge with an unfinished draft?' }).isVisible());
	await Promise.all([page.waitForSelector('#matrix-dashboard'), page.getByRole('button', { name: 'Leave PSForge' }).click()]);
	ok('confirmed local-draft leave has no second native prompt', nativeDialogs === 0);

	await page.goto(base + '/?mmed_ps_proto=1'); await page.locator('[data-act="go"][data-view="root"]').first().click();
	await page.waitForFunction(() => !document.body.innerText.includes('Checking File Vault'));
	await page.locator('[data-act="source"][data-source="FILE_VAULT"]').click();
	await page.locator('[data-act="pick-file"]:not([disabled])').first().click();
	let releaseRoot; const heldRoot = new Promise(resolve => { releaseRoot = resolve; });
	await page.route('**/wp-json/mmed-ps-proto/v1/roots', async route => { await heldRoot; await route.continue(); }, { times: 1 });
	await page.locator('[data-act="create-root"]').click();
	await page.waitForFunction(() => document.querySelector('[data-act="create-root"]')?.disabled === true);
	const busyWriteBaseline = writes; await page.locator('.matrixBack').click();
	ok('active work blocks Return without navigation or another write', await page.getByRole('heading', { name: 'Please wait before returning to Matrix' }).isVisible() && /mmed_ps_proto=1/.test(page.url()) && writes === busyWriteBaseline);
	await page.getByRole('button', { name: 'Stay in PSForge' }).click(); releaseRoot();
	await page.waitForSelector('[data-act="save-region"]');
	if (await page.locator('[data-act="save-region"]').isDisabled()) { await page.locator('.para.pick').first().click(); }
	await page.locator('[data-act="save-region"]').click();
	for (const key of ['clinical_training', 'research_academics', 'patient_population_mission']) {
		await page.locator('[data-act="priority-add"][data-key="' + key + '"]').click();
	}
	await page.locator('[data-act="save-prefs"]').click();
	await page.waitForSelector('[data-act="toggle-program"][data-id="ps_deep_001"]'); await page.locator('[data-act="toggle-program"][data-id="ps_deep_001"]').click();
	await page.locator('.footBar [data-act="go"][data-view="generate"]').click(); await page.locator('[data-act="generate"][data-id="ps_deep_001"]').click();
	await page.waitForSelector('[data-act="open-run"][data-id="ps_deep_001"]', { timeout: 60000 }); await page.locator('[data-act="open-run"][data-id="ps_deep_001"]').click();
	await page.waitForSelector('[data-act="edit-paragraph"]');
	for (let i = 0; i < 5 && await page.locator('[data-act="edit-paragraph"]').isDisabled(); i++) {
		await page.locator('[data-act="candidate-next"]').first().click();
	}
	ok('a valid generated candidate is editable', !(await page.locator('[data-act="edit-paragraph"]').isDisabled()));
	await page.locator('[data-act="edit-paragraph"]').click();
	const editor = page.locator('[data-review-editor]'); const edited = (await editor.inputValue()) + ' Local review guard proof.'; await editor.fill(edited);
	await page.locator('.matrixBack').click();
	ok('review draft reuses Save Discard Keep policy', await page.getByRole('heading', { name: 'Keep your paragraph edits?' }).isVisible() && await page.getByRole('button', { name: 'Keep editing' }).isVisible() && await page.getByRole('button', { name: 'Discard changes' }).isVisible() && await page.getByRole('button', { name: 'Save edits and leave' }).isVisible());
	await page.getByRole('button', { name: 'Keep editing' }).click();
	ok('review cancel preserves draft and restores Return focus', await editor.inputValue() === edited && await page.locator('.matrixBack').evaluate(n => document.activeElement === n));
	await page.locator('.matrixBack').click(); await Promise.all([page.waitForSelector('#matrix-dashboard'), page.getByRole('button', { name: 'Discard changes' }).click()]);
	ok('review discard leaves without native prompt', nativeDialogs === 0);

	const admin = await context.newPage();
	await login(admin, 'founder', 'Founder-Local-1!'); await context.addCookies([{ name: 'mmhq_rise_session', value: 'good-session', url: base }]);
	await admin.goto(base + '/?mmed_ps_proto=1'); await admin.locator('[data-act="go"][data-view="admin"]').first().click(); await admin.locator('[data-act="admin-tab"][data-tab="prompts"]').first().click();
	const adminDraft = '{"schema":"missionmed.psv.prompt-package.v1","draft":"local-only"}'; await admin.locator('[data-admin-import]').fill(adminDraft); await admin.locator('.matrixBack').click();
	ok('admin import draft opens the same bounded leave guard', await admin.getByRole('heading', { name: 'Leave PSForge with an unfinished draft?' }).isVisible());
	await admin.getByRole('button', { name: 'Stay in PSForge' }).click();
	ok('admin cancel preserves draft and restores Return focus', await admin.locator('[data-admin-import]').inputValue() === adminDraft && await admin.locator('.matrixBack').evaluate(n => document.activeElement === n));

	await admin.setViewportSize({ width: 390, height: 844 });
	ok('390px keeps visible Return label', await admin.locator('.matrixBack').getByText('Return to Matrix', { exact: true }).isVisible());
	ok('390px has no horizontal overflow', await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
	ok('browser flow has no JS exception', errors.length === 0);
	console.log('PSFORGE_RETURN_UI_PASS ' + passed);
	await browser.close();
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });
