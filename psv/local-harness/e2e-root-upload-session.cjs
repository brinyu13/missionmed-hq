// Focused browser acceptance for direct ROOT upload and expired-cookie recovery.
const { chromium } = require('playwright');
const BASE = process.env.MMPS_BASE_URL || 'http://127.0.0.1:8088';
const results = [];
const ok = (name, condition, detail = '') => {
	results.push({ name, pass: !!condition });
	console.log((condition ? 'PASS ' : 'FAIL ') + name + (!condition && detail ? ' -> ' + detail : ''));
};

async function login(page) {
	await page.goto(BASE + '/wp-login.php');
	await page.fill('#user_login', 'tester');
	await page.fill('#user_pass', 'Tester-Local-1!');
	await page.click('#wp-submit');
	await page.waitForTimeout(1500);
	if (!/\/wp-admin\//.test(page.url())) { throw new Error('Local test login did not reach wp-admin.'); }
}

(async () => {
	const launchOptions = process.env.MMPS_BROWSER_CHANNEL ? { channel: process.env.MMPS_BROWSER_CHANNEL } : {};
	const browser = await chromium.launch(launchOptions);
	const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
	const page = await context.newPage();
	await login(page);
	await page.goto(BASE + '/?mmed_ps_proto=1');
	await page.click('button:has-text("Start a new ROOT")');
	await page.waitForSelector('[data-act="source"]');
	ok('ROOT chooser has four source options', await page.locator('[data-act="source"]').count() === 4);
	await page.click('[data-source="UPLOADED"]');
	await page.waitForSelector('[data-root-file]');
	const fictionalRoot = 'The first fictional paragraph establishes a thoughtful applicant voice and contains no real student information.\n\nThe second fictional paragraph describes careful teamwork during a simulated clinical exercise.\n\nThe third fictional paragraph explains a fictional interest in Internal Medicine and provides enough text to validate direct upload.';
	await page.locator('[data-root-file]').setInputFiles({ name: 'fictional-root.txt', mimeType: 'text/plain', buffer: Buffer.from(fictionalRoot) });
	ok('bounded UTF-8 TXT selection is accepted', await page.locator('.uploadName').innerText() === 'fictional-root.txt');
	ok('Use this ROOT becomes available', await page.locator('[data-act="create-root"]:not([disabled])').count() === 1);
	const uploadPanel = await page.locator('[data-root-file]').locator('xpath=ancestor::div[contains(@class,"panel")]').innerText();
	ok('upload custody and real-ROOT privacy are explicit', uploadPanel.includes('not retained or written to File Vault') && uploadPanel.includes('treated as real ROOTs'));

	const staleContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
	const stalePage = await staleContext.newPage();
	await login(stalePage);
	await stalePage.goto(BASE + '/?mmed_ps_proto=1');
	await stalePage.click('button:has-text("Start a new ROOT")');
	await stalePage.waitForSelector('[data-act="source"]');
	await stalePage.click('[data-source="PASTED"]');
	const retainedPaste = 'Fictional paragraph one is long enough to test that an expired session never destroys text the student already entered.\n\nFictional paragraph two continues the safe local-only fixture and describes a simulated learning experience.\n\nFictional paragraph three completes the statement while remaining entirely invented and free of personal information.';
	await stalePage.fill('[data-bind="text"]', retainedPaste);
	await staleContext.clearCookies();
	await stalePage.click('[data-act="create-root"]');
	await stalePage.waitForSelector('text=Your MissionMed session changed or expired');
	ok('expired cookie yields actionable sign-in guidance', await stalePage.locator('text=Sign in again in another tab').count() === 1);
	ok('expired-cookie failure preserves unsaved ROOT text', await stalePage.locator('[data-bind="text"]').inputValue() === retainedPaste);

	await staleContext.close();
	await context.close();
	await browser.close();
	const failed = results.filter((result) => !result.pass);
	console.log(`\n${results.length - failed.length}/${results.length} passed`);
	process.exit(failed.length ? 1 : 0);
})().catch((error) => {
	console.error('FOCUSED WALKTHROUGH CRASHED:', error.message);
	process.exit(2);
});
