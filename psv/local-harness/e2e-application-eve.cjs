// Focused Application-Eve acceptance against the disposable WordPress harness.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:8088';
let passed = 0;
function ok(name, value) { assert.ok(value, name); console.log('PASS ' + name); passed++; }

(async () => {
	const browser = await chromium.launch({ channel: 'chrome' });
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
			method,
			credentials: 'same-origin',
			cache: 'no-store',
			headers: { 'X-WP-Nonce': config.nonce, 'Content-Type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		});
		return { status: response.status, body: await response.json() };
	}, { method, path, body });

	const templateText = [
		'Opening memory about learning to listen before acting.',
		'A second protected paragraph develops the applicant voice.',
		'A preceding paragraph asks what kind of residency will sustain that discipline.',
		'***',
		'[Program Paragraph Here]',
		'***',
		'The following paragraph returns to service and responsibility.',
		'Closing reflection that remains protected.'
	].join('\n\n');
	let response = await api('POST', '/roots', { source: 'PASTED', specialtyLabel: 'Internal Medicine', text: templateText });
	ok('blank Founder template ROOT is accepted', response.status === 200);
	const root = response.body.root;
	ok('template markers are stripped before private ROOT storage', root.paragraphs.length === 6 && root.paragraphs.every(p => p !== '***'));
	ok('exact blank region is automatically and explicitly authorized', root.region.authorization === 'ROOT_TEMPLATE_MARKERS' && root.region.template.kind === 'BLANK' && root.region.paragraphIndex === 3);
	const protectedBefore = root.paragraphs.filter((_, index) => index !== root.region.paragraphIndex);
	response = await api('PUT', `/roots/${root.id}/template`, { behavior: 'USE_TEMPLATE' });
	ok('student can explicitly confirm full-paragraph template behavior', response.status === 200 && response.body.root.region.template.behavior === 'USE_TEMPLATE');
	response = await api('PUT', `/roots/${root.id}/prefs`, { categories: { population: { on: true, terms: ['Community-based care'] } }, location: { on: false, states: [], reason: '', mayMention: false } });
	ok('template ROOT preferences persist', response.status === 200);
	response = await api('POST', '/generate', { rootId: root.id, programSpecialtyId: 'ps_ess_003', tier: 'ESSENTIAL' });
	const generated = response.body;
	ok('blank template writes one complete five-candidate Program Answer set', response.status === 200 && generated.status === 'OK' && generated.candidates.length === 5);
	ok('final Program Answer contains no markers, bracket metadata, or em dash', generated.candidates.every(c => !/\*\*\*|\[[^\]]+\]|—/.test(c.replacement)));
	ok('every protected ROOT paragraph remains byte-identical', generated.paragraphs.filter((_, index) => index !== root.region.paragraphIndex).every((p, index) => p === protectedBefore[index]) && generated.rootIntegrity.ok === true);

	response = await api('GET', '/rise/my-program-index');
	const index = response.body.programs;
	ok('owner RISE import excludes Gold, Silver, and ambiguous rows from unattended bulk', index.filter(p => p.bulkEligible).length === 3 && index.find(p => p.priorityClass === 'GOLD') && index.find(p => p.priorityClass === 'SILVER'));
	response = await api('POST', '/batch/jobs', { rootId: root.id, outputMode: 'FULL_PARAGRAPH', programs: index.map(p => ({ programSpecialtyId: p.programSpecialtyId, tier: p.defaultTier })) });
	let job = response.body.job;
	ok('Full Paragraph job records authenticated RISE source and exclusions', response.status === 200 && job.total === 3 && job.config.source === 'AUTHENTICATED_STUDENT_RISE_LIST' && job.config.excluded.GOLD === 1 && job.config.excluded.SILVER === 1);
	for (let step = 0; step < 12 && job.processed < job.total; step++) {
		response = await api('POST', `/batch/jobs/${job.jobUuid}/process`, {});
		job = response.body.job;
	}
	ok('Bulk Rush is resumable and preserves partial success', job.ready === 2 && job.failed === 1 && job.status === 'COMPLETE_WITH_EXCEPTIONS');
	const ready = job.items.find(item => item.status === 'READY');
	response = await api('GET', `/batch/jobs/${job.jobUuid}/items/${ready.itemUuid}/run`);
	ok('eligible bulk program has one validated recommended paragraph by default', response.status === 200 && response.body.candidates.length === 1 && response.body.canApprove === true);
	response = await api('POST', `/batch/jobs/${job.jobUuid}/items/${ready.itemUuid}/alternatives`, {});
	ok('five meaningfully separate candidates remain available on demand', response.status === 200 && response.body.run.candidates.length === 5 && new Set(response.body.run.candidates.map(c => c.candidateId)).size === 5);

	response = await api('POST', '/batch/jobs', { rootId: root.id, outputMode: 'TOP_3_REASONS', programs: [{ programSpecialtyId: 'ps_ess_003', tier: 'ESSENTIAL' }] });
	let reasonJob = response.body.job;
	response = await api('POST', `/batch/jobs/${reasonJob.jobUuid}/process`, {});
	reasonJob = response.body.job;
	const reasonItem = reasonJob.items[0];
	ok('Top 3 Reasons is deterministic, evidence-backed, and does not create a prose run', reasonItem.status === 'READY' && reasonItem.runId === '' && reasonItem.evidence.reasons.length === 3 && reasonItem.evidence.reasons.every(reason => reason.factId && reason.retrievedAt));

	response = await api('POST', `/batch/jobs/${job.jobUuid}/approve-ready`, {});
	ok('explicit batch confirmation approves only clean defaults', response.status === 200 && response.body.approved >= 1);
	response = await api('POST', '/library/eras-manifest', { inline: true });
	const manifest = response.body.manifest;
	ok('canonical ERAS manifest includes only approved owner statements', response.status === 200 && manifest.schema === 'missionmed.psv.eras-assignment-manifest.v1' && manifest.items.length >= 1 && manifest.items.every(item => item.approvalStatus === 'APPROVED'));
	ok('manifest carries canonical identity and unresolved MyERAS status instead of guessing', manifest.items.every(item => item.acgmeId && item.programSpecialtyId && item.specialty && item.statementTitle && item.exportFilename && item.myErasIdentity === null && item.myErasIdentityStatus === 'UNRESOLVED'));
	ok('assignment contract is two-phase and forbids application/payment side effects', manifest.commitPolicy === 'PREPARE_THEN_EXPLICIT_CONFIRMATION' && ['APPLY', 'PAY', 'CERTIFY', 'SUBMIT', 'WITHDRAW', 'SIGNAL', 'MESSAGE'].every(action => manifest.forbiddenActions.includes(action)));

	await page.reload();
	await page.waitForSelector('#mmps-app');
	await page.click('button:has-text("Start a new ROOT")');
	await page.waitForSelector('[data-act="source"]');
	await page.waitForFunction(() => !document.body.innerText.includes('Checking File Vault'));
	await page.click('[data-source="FILE_VAULT"]');
	await page.locator('[data-act="pick-file"]:not([disabled])').first().click();
	await page.click('[data-act="create-root"]');
	await page.waitForSelector('[data-act="save-region"]');
	await page.click('[data-act="save-region"]');
	await page.waitForSelector('[data-act="save-prefs"]');
	await page.click('[data-act="save-prefs"]');
	await page.waitForSelector('[data-act="toggle-program"]');
	await page.click('.hdrNav [data-view="batch"]');
	await page.waitForSelector('[data-act="batch-create"]');
	ok('student UI makes Full Paragraph and Top 3 Reasons explicit', await page.locator('[data-mode="FULL_PARAGRAPH"]').isVisible() && await page.locator('[data-mode="TOP_3_REASONS"]').isVisible());
	ok('student UI visibly keeps protected priorities in High Priority Review', await page.getByText(/High Priority Review/).count() >= 1);
	await page.setViewportSize({ width: 390, height: 844 });
	ok('Bulk Rush has no horizontal overflow at phone width', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
	await page.click('.hdrNav [data-view="library"]');
	await page.waitForSelector('[data-act="eras-manifest"]');
	ok('library exposes selected, Download All, and ERAS manifest workflows', await page.locator('[data-act="bulk-selected"]').isVisible() && await page.locator('[data-act="bulk-approved"]').isVisible() && await page.locator('[data-act="eras-manifest"]').isVisible());
	ok('library has no horizontal overflow at phone width', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
	ok('focused Application-Eve browser flow has no JavaScript exception', errors.length === 0);

	console.log('APPLICATION_EVE_UI_PASS ' + passed);
	await browser.close();
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
