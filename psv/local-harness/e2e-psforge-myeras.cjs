// Focused PSForge MyERAS acceptance against the disposable WordPress harness.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const base = 'http://127.0.0.1:8088';
let passed = 0;
function ok(name, value) { assert.ok(value, name); console.log('PASS ' + name); passed++; }

(async () => {
	const harnessRoot = process.env.MMPS_HARNESS_ROOT;
	assert.ok(harnessRoot, 'MMPS_HARNESS_ROOT is required for the disposable fixture');
	const fixture = `$_SERVER['HTTP_HOST']='127.0.0.1:8088';$_SERVER['REQUEST_URI']='/';require ${JSON.stringify(harnessRoot + '/site/wp-load.php')};$text="Fictional opening paragraph for a disposable PSForge test.\n\nFictional program paragraph for a disposable PSForge test.\n\nFictional closing paragraph for a disposable PSForge test.";$doc=array('doc_uuid'=>'10000000-0000-4000-8000-000000009901','root_id'=>9901,'run_id'=>9901,'specialty_label'=>'Internal Medicine','program_specialty_id'=>'rise:fictional:im:9901','acgme_id'=>'9999999901','program_name'=>'Fictional Lakeside Medical Center Program','institution'=>'Fictional Lakeside Medical Center','city'=>'Testville','state'=>'NY','tier'=>'ESSENTIAL','version_number'=>1,'status'=>'APPROVED','title'=>'Fictional Lakeside Program Statement','root_label'=>'Disposable synthetic fixture','full_text'=>$text,'full_text_sha256'=>hash('sha256',$text),'region_text'=>'Fictional program paragraph for a disposable PSForge test.','metadata_json'=>wp_json_encode(array('trainingType'=>'Categorical','trainingTypes'=>array('Categorical'),'trainingTypeStatus'=>'RESOLVED','nrmpCode'=>'9999999C0','nrmpCodes'=>array('9999999C0'),'nrmpTrackStatus'=>'RESOLVED','myErasIdentity'=>array('fixture'=>true),'myErasIdentityStatus'=>'RESOLVED','regionIndex'=>1)));if(!MMPS_Store::insert_document(3,$doc)){exit(1);}`;
	execFileSync('php', ['-r', fixture], { stdio: 'ignore' });
	const browser = await chromium.launch({ channel: process.env.MMPS_BROWSER_CHANNEL || 'chrome' });
	const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
	const page = await context.newPage();
	const errors = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.goto(base + '/wp-login.php');
	await page.fill('#user_login', 'tester');
	await page.fill('#user_pass', 'Tester-Local-1!');
	await Promise.all([page.waitForNavigation(), page.click('#wp-submit')]);
	await context.addCookies([{ name: 'mmhq_rise_session', value: 'good-session', url: base }]);
	await page.goto(base + '/?mmed_ps_proto=1');
	await page.waitForSelector('#mmps-app');

	const api = async (method, path, body) => page.evaluate(async ({ method, path, body }) => {
		const config = JSON.parse(document.getElementById('mmps-config').textContent);
		const response = await fetch(config.restUrl.replace(/\/$/, '') + path, {
			method, credentials: 'same-origin', cache: 'no-store',
			headers: { 'X-WP-Nonce': config.nonce, 'Content-Type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		});
		return { status: response.status, body: await response.json() };
	}, { method, path, body });

	let response = await api('GET', '/library/eras-plan');
	ok('plan returns approved statements and configured provider cards', response.status === 200 && response.body.manifest.items.length > 0 && response.body.providers.length === 2 && response.body.statements[response.body.manifest.items[0].psvDocId]);
	ok('official MyERAS route is the verified root only', response.body.officialPortal === 'https://myeras.aamc.org/');

	response = await api('POST', '/library/myeras-package', { mode: 'BULK', provider: 'claude', inline: true });
	if (response.status !== 200) { console.error('Bulk package response', response); }
	const pkg = response.body;
	ok('AI Bulk Setup creates one owner-bound ZIP contract', response.status === 200 && /PSForge_MyERAS_AI_Assistant_File_/.test(pkg.fileName) && pkg.documents > 0 && /^[a-f0-9]{64}$/.test(pkg.sha256));
	ok('bulk mission starts with execute language and mandates two passes', pkg.missionMarkdown.startsWith('EXECUTE THIS MISSION.') && pkg.missionMarkdown.includes('PASS 1 - CREATE + ASSIGN') && pkg.missionMarkdown.includes('PASS 2 - START OVER AND READ BACK'));
	ok('bulk mission embeds absolute forbidden actions', pkg.missionMarkdown.includes('NEVER APPLY, PAY, CERTIFY, SUBMIT, WITHDRAW, SIGNAL, OR MESSAGE'));
	const binaryPackage = await page.evaluate(async () => {
		const config = JSON.parse(document.getElementById('mmps-config').textContent);
		const response = await fetch(config.restUrl.replace(/\/$/, '') + '/library/myeras-package', {
			method: 'POST', credentials: 'same-origin', cache: 'no-store',
			headers: { 'X-WP-Nonce': config.nonce, 'Content-Type': 'application/json' },
			body: JSON.stringify({ mode: 'BULK', provider: 'codex' })
		});
		const bytes = new Uint8Array(await response.arrayBuffer());
		return { status: response.status, type: response.headers.get('content-type'), disposition: response.headers.get('content-disposition'), first: Array.from(bytes.slice(0, 2)), length: bytes.length };
	});
	ok('student download is one real ZIP with a friendly filename', binaryPackage.status === 200 && /application\/zip/.test(binaryPackage.type || '') && /PSForge_MyERAS_AI_Assistant_File_/.test(binaryPackage.disposition || '') && binaryPackage.first.join(',') === '80,75' && binaryPackage.length > 1000);

	response = await api('POST', '/library/myeras-package', { mode: 'DOUBLE_CHECK', provider: 'codex', inline: true });
	const check = response.body;
	ok('Double-Check package is separate and strictly read-only', response.status === 200 && /Double_Check_File/.test(check.fileName) && check.missionMarkdown.includes('STRICTLY READ-ONLY') && check.missionMarkdown.includes('Never silently repair'));

	const completion = JSON.parse(JSON.stringify(check.returnSchema));
	completion.completedAt = '2026-09-22T22:00:00Z';
	completion.results = completion.results.map(result => Object.assign(result, {
		creationStatus: 'NOT_CHECKED', assignmentStatus: 'ASSIGNED', verificationResult: 'AI_READBACK_CORRECT',
		observedProgram: result.programName, observedTrack: result.trainingType, observedStatementTitle: result.myErasTitle,
		normalizedContentCheck: 'MATCH', attentionReason: '', timestamp: '2026-09-22T22:00:00Z'
	}));
	completion.results[0] = Object.assign(completion.results[0], {
		assignmentStatus: 'NOT_CHECKED', verificationResult: 'COULD_NOT_VERIFY',
		observedProgram: '', observedTrack: '', observedStatementTitle: '',
		normalizedContentCheck: 'NOT_CHECKED', attentionReason: 'The current page did not expose an authoritative assignment row.'
	});
	const markdown = '# PSForge MyERAS Completion\n\n```json\n' + JSON.stringify(completion, null, 2) + '\n```';
	response = await api('POST', '/library/myeras-completion', { content: markdown });
ok('valid exact-plan completion separates confirmed, attention, and unknown counts', response.status === 200 && response.body.validated && response.body.counts.correct === completion.results.length - 1 && response.body.counts.attention === 0 && response.body.counts.couldNotVerify === 1 && response.body.truthLabel === 'AI-VERIFIED MYERAS READBACK' && response.body.missionMedIndependentVerification === false);
	const wrong = JSON.parse(JSON.stringify(completion)); wrong.missionId = 'PSF-WRONGOWNERORPLAN';
	response = await api('POST', '/library/myeras-completion', { content: '# Completion\n```json\n' + JSON.stringify(wrong) + '\n```' });
	ok('wrong mission or owner binding is rejected', response.status === 409 && response.body.code === 'mmps_myeras_completion_owner_plan');
	response = await api('POST', '/library/myeras-completion', { content: '<script>alert(1)</script>\n```json\n{}\n```' });
	ok('active-content upload is rejected', response.status === 422 && response.body.code === 'mmps_myeras_completion_format');

	await page.click('.hdrNav [data-view="library"]');
	await page.waitForSelector('[data-view="myeras"]');
	await page.click('[data-view="myeras"]');
	await page.waitForSelector('[data-screen="bulk"]');
	ok('entry shows two equal paths and standalone double-check', await page.locator('[data-screen="bulk"]').isVisible() && await page.locator('[data-screen="manual"]').isVisible() && await page.locator('[data-screen="double"]').isVisible());
	await page.click('[data-screen="manual"]');
	await page.waitForSelector('[data-act="copy-statement"]');
	ok('manual path is one-item-at-a-time with obvious actions', await page.getByText(/Statement 1 of/).isVisible() && await page.getByText('COPY TITLE').isVisible() && await page.getByText('COPY STATEMENT').isVisible() && await page.getByText('SKIP FOR NOW').isVisible());
	await page.setViewportSize({ width: 390, height: 844 });
	ok('manual queue has no horizontal overflow at phone width', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
	await page.getByText('Exit guided setup').click();
	await page.waitForSelector('[data-myeras-file]');
	await page.evaluate(completion => {
		const input = document.querySelector('[data-myeras-file]');
		const markdown = '# PSForge MyERAS Completion\n\n```json\n' + JSON.stringify(completion, null, 2) + '\n```';
		const file = new File([markdown], 'PSForge_MyERAS_Completion.md', { type: 'text/markdown' });
		const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files;
		input.dispatchEvent(new Event('change', { bubbles: true }));
	}, completion);
	await page.waitForSelector('[data-act="scroll-myeras-issues"]');
	ok('validated return exposes the required issue-review action', await page.getByText('Review 1 Issues').isVisible());
	if (errors.length) { console.error('Browser exceptions', errors); }
	ok('focused MyERAS flow has no JavaScript exception', errors.length === 0);

	console.log('PSFORGE_MYERAS_UI_PASS ' + passed);
	await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
