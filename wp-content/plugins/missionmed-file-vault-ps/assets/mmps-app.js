/* MissionMed File Vault · Program-Specific PS (prototype). Vanilla JS, no build, no inline styles (strict CSP). */
(function () {
	'use strict';

	var cfg = JSON.parse(document.getElementById('mmps-config').textContent);
	var app = document.getElementById('mmps-app');

	var STEPS = [
		{ key: 'root', n: 1, name: 'Choose ROOT', hint: 'One statement, one specialty' },
		{ key: 'region', n: 2, name: 'Confirm region', hint: 'The only part that changes' },
		{ key: 'prefs', n: 3, name: 'Preferences', hint: 'Once, not per program' },
		{ key: 'programs', n: 4, name: 'Programs', hint: 'From RISE' },
		{ key: 'generate', n: 5, name: 'Tier and generate', hint: 'Essential or Deep' },
		{ key: 'preview', n: 6, name: 'Preview and save', hint: 'Full statement' }
	];
	var SPECIALTIES = ['Internal Medicine', 'Family Medicine', 'Pediatrics', 'Psychiatry', 'Neurology', 'General Surgery', 'Emergency Medicine', 'Anesthesiology', 'Obstetrics and Gynecology', 'Pathology', 'Radiology', 'Physical Medicine and Rehabilitation'];
	var CATS = [
		{ key: 'fellowship', title: 'Fellowship or subspecialty', hint: 'Only the ones you are seriously considering. A fellowship you did not name is never used as a reason.', options: ['Cardiology', 'Gastroenterology', 'Pulmonary and critical care', 'Hematology and oncology', 'Nephrology', 'Endocrinology', 'Infectious disease', 'Rheumatology', 'Geriatrics', 'Palliative care', 'Hospital medicine', 'Sports medicine'] },
		{ key: 'research', title: 'Research', hint: 'The kind of scholarly work you want to keep doing.', options: ['Clinical research', 'Quality improvement', 'Health services and outcomes', 'Medical education research', 'Translational science', 'Global health research'] },
		{ key: 'teaching', title: 'Academic and teaching', hint: 'How you like to be taught, and to teach.', options: ['Bedside teaching', 'Resident as teacher', 'Medical student teaching', 'Clinician educator track', 'Morning report'] },
		{ key: 'curriculum', title: 'Curriculum and training', hint: 'Structure that matters to you.', options: ['X+Y scheduling', 'Intensive care training', 'Procedural training', 'Point-of-care ultrasound', 'Primary care track', 'Hospitalist track', 'Simulation'] },
		{ key: 'population', title: 'Patient population', hint: 'Who you want to care for.', options: ['Underserved communities', 'Safety-net hospital', 'Veterans', 'Immigrant and refugee health', 'Rural health', 'Urban tertiary care'] },
		{ key: 'mission', title: 'Community and mission', hint: 'What the program stands for.', options: ['Community outreach', 'Health equity', 'Global health', 'Free clinics', 'Mentorship and wellness'] },
		{ key: 'other', title: 'Other differentiators', hint: 'Anything else RISE might hold evidence for.', options: [] }
	];
	var STATES = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', PR: 'Puerto Rico', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming' };
	var STRATEGY = { TRAINING_ENVIRONMENT: 'Training environment', STUDENT_GOAL_FORWARD: 'Your goals first', RESEARCH_FELLOWSHIP: 'Research or fellowship', LOCATION_PROGRAM_TYPE: 'Location and program setting', BALANCED_QUIET_SPECIFIC: 'Balanced and quietly specific', TRAINING_ENVIRONMENT_FIRST: 'Training environment first', BRIDGE_FROM_EXPERIENCE: 'Bridge from experience', GOAL_FORWARD: 'Goal forward', QUIET_SPECIFIC: 'Quiet and specific', PLACE_AND_PEOPLE: 'Place and people' };
	var MAX_PROGRAMS = 5;

	var S = {
		boot: null, view: 'home', root: null, detection: null,
		rootForm: { source: '', specialty: 'Internal Medicine', text: '', syntheticKey: 'im', fileKey: '' },
		candidates: null, regionDraft: null, prefs: null, stateCodes: [],
		list: { status: 'idle', programs: [], total: 0, error: null }, search: { q: '', status: 'idle', results: [], error: null },
		programs: {}, selected: [], tiers: {}, runs: {}, current: '', showOriginal: false,
		prompt: {}, doc: null, selectedDocs: {},
		batch: { index: null, current: null, running: false }, busy: {}, toast: null
	};

	/* ---------- utilities ---------- */
	function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
	function api(method, path, body) {
		var opts = { method: method, credentials: 'same-origin', headers: { 'X-WP-Nonce': cfg.nonce, 'Accept': 'application/json' }, cache: 'no-store' };
		if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
		return fetch(cfg.restUrl.replace(/\/$/, '') + path, opts).then(function (res) {
			return res.text().then(function (text) {
				var data = null;
				try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
				if (!res.ok) { var err = new Error((data && data.message) || ('Request failed (' + res.status + ').')); err.code = (data && data.code) || 'http_' + res.status; err.status = res.status; throw err; }
				return data;
			});
		});
	}
	function toast(message, kind) {
		S.toast = { message: message, kind: kind || '' };
		render();
		clearTimeout(toast.t);
		toast.t = setTimeout(function () { S.toast = null; render(); }, 5200);
	}
	function busy(key, on) { if (on) { S.busy[key] = true; } else { delete S.busy[key]; } render(); }
	function fail(err) { toast(err && err.message ? err.message : 'Something went wrong.', 'err'); }
	function ageLabel(days) { if (days == null || days === '') { return 'date unknown'; } if (days < 1) { return 'today'; } if (days < 45) { return days + ' days ago'; } if (days < 365) { return Math.round(days / 30) + ' months ago'; } return 'over a year ago'; }
	function programLabel(p) { return p ? (p.programName || p.institution || 'Program') : 'Program'; }
	function placeLabel(p) { return p ? [p.city, p.state].filter(Boolean).join(', ') : ''; }
	function qualityTag(q) {
		if (!q) { return ''; }
		if (q.label === 'DEEP_READY') { return '<span class="tag vi">Deep ready · ' + q.deepEligibleCount + ' facts</span>'; }
		if (q.label === 'ONE_DEEP_FACT') { return '<span class="tag em">One deep fact</span>'; }
		return '<span class="tag">Essential only</span>';
	}
	function ingredients(has) {
		if (!has) { return ''; }
		var items = [['programName', 'Name'], ['programType', 'Type'], ['location', 'Location'], ['programDirector', 'PD']];
		return '<span class="ing">' + items.map(function (i) { return has[i[0]] ? '<b>✓ ' + i[1] + '</b>' : '<i>– ' + i[1] + '</i>'; }).join(' ') + '</span>';
	}
	function blankPrefs() {
		var p = { categories: {}, location: { on: false, states: [], cities: [], reason: '', mayMention: false }, otherText: '' };
		CATS.forEach(function (c) { p.categories[c.key] = { on: false, terms: [], note: '' }; });
		return p;
	}
	function loadPrefs(root) {
		var p = blankPrefs(), saved = root && root.prefs && root.prefs.categories ? root.prefs : null;
		if (saved) {
			CATS.forEach(function (c) { if (saved.categories[c.key]) { p.categories[c.key] = { on: !!saved.categories[c.key].on, terms: (saved.categories[c.key].terms || []).slice(), note: saved.categories[c.key].note || '' }; } });
			if (saved.location) { p.location = { on: !!saved.location.on, states: (saved.location.states || []).slice(), cities: (saved.location.cities || []).slice(), reason: saved.location.reason || '', mayMention: !!saved.location.mayMention }; }
			p.otherText = saved.otherText || '';
		}
		S.stateCodes = Object.keys(STATES).filter(function (code) { return p.location.states.indexOf(code) !== -1; });
		return p;
	}
	function stepDone(key) {
		var r = S.root;
		if (key === 'root') { return !!r; }
		if (key === 'region') { return !!(r && r.region && r.region.mode); }
		if (key === 'prefs') { return !!(r && r.prefs && r.prefs.categories); }
		if (key === 'programs') { return S.selected.length > 0; }
		if (key === 'generate') { return Object.keys(S.runs).length > 0; }
		return false;
	}
	function stepOpen(key) {
		if (key === 'root') { return true; }
		if (key === 'region') { return stepDone('root'); }
		if (key === 'prefs') { return stepDone('region'); }
		if (key === 'programs') { return stepDone('region'); }
		if (key === 'generate') { return stepDone('region') && S.selected.length > 0; }
		if (key === 'preview') { return Object.keys(S.runs).length > 0; }
		return false;
	}
	function go(view) { S.view = view; render(); window.scrollTo(0, 0); if (view === 'programs' && S.list.status === 'idle') { loadMyPrograms(0); } if (view === 'root' && !S.candidates) { loadCandidates(); } if (view === 'batch' && !S.batch.index) { loadBatchIndex(); } }

	/* ---------- data actions ---------- */
	function boot() {
		api('GET', '/bootstrap').then(function (data) { S.boot = data; app.setAttribute('data-state', 'ready'); render(); }).catch(function (err) {
			app.innerHTML = '<div class="boot"><span class="bootMark">MissionMed</span><span class="bootLine">' + esc(err.message) + '</span></div>';
		});
	}
	function refreshBoot() { return api('GET', '/bootstrap').then(function (data) { S.boot = data; render(); }); }
	function loadCandidates() { api('GET', '/root-candidates').then(function (data) { S.candidates = data; render(); }).catch(fail); }
	function openRoot(id) {
		busy('root', true);
		api('GET', '/roots/' + id).then(function (data) { adoptRoot(data); busy('root', false); go(stepDone('region') ? 'programs' : 'region'); }).catch(function (e) { busy('root', false); fail(e); });
	}
	function adoptRoot(data) {
		S.root = data.root; S.detection = data.detection || S.detection;
		S.prefs = loadPrefs(S.root);
		var region = S.root.region && S.root.region.mode ? S.root.region : null;
		S.regionDraft = region ? { mode: region.mode, index: region.paragraphIndex } : { mode: 'REPLACE_PARAGRAPH', index: S.detection && S.detection.proposedIndex != null ? S.detection.proposedIndex : null };
		S.runs = {}; S.current = '';
	}
	function createRoot() {
		var f = S.rootForm, body = { source: f.source, specialtyLabel: f.specialty };
		if (f.source === 'PASTED') { body.text = f.text; }
		if (f.source === 'SYNTHETIC') { body.syntheticKey = f.syntheticKey; }
		if (f.source === 'FILE_VAULT') { var parts = f.fileKey.split(':'); body.fileId = parseInt(parts[0], 10); body.versionNumber = parseInt(parts[1], 10); }
		busy('root', true);
		api('POST', '/roots', body).then(function (data) { adoptRoot(data); busy('root', false); refreshBoot(); go('region'); }).catch(function (e) { busy('root', false); fail(e); });
	}
	function saveRegion() {
		busy('region', true);
		api('PUT', '/roots/' + S.root.id + '/region', { mode: S.regionDraft.mode, paragraphIndex: S.regionDraft.index }).then(function (data) {
			S.root = data.root; S.runs = {}; busy('region', false); go('prefs');
		}).catch(function (e) { busy('region', false); fail(e); });
	}
	function savePrefs() {
		var p = JSON.parse(JSON.stringify(S.prefs));
		p.location.states = [];
		S.stateCodes.forEach(function (code) { p.location.states.push(code); p.location.states.push(STATES[code]); });
		busy('prefs', true);
		api('PUT', '/roots/' + S.root.id + '/prefs', p).then(function (data) { S.root = data.root; busy('prefs', false); go('programs'); }).catch(function (e) { busy('prefs', false); fail(e); });
	}
	function loadMyPrograms(offset) {
		S.list.status = 'loading'; S.list.error = null; render();
		api('GET', '/rise/my-programs?offset=' + offset + '&limit=6').then(function (data) {
			S.list.status = 'ready'; S.list.total = data.total;
			S.list.programs = offset ? S.list.programs.concat(data.programs) : data.programs;
			data.programs.forEach(function (p) { if (!p.error) { S.programs[p.programSpecialtyId] = p; if (!S.tiers[p.programSpecialtyId]) { S.tiers[p.programSpecialtyId] = p.defaultTier; } } });
			render();
		}).catch(function (e) { S.list.status = 'error'; S.list.error = e; render(); });
	}
	function runSearch() {
		var q = S.search.q.trim();
		if (q.length < 3) { toast('Type at least three letters.', 'err'); return; }
		S.search.status = 'loading'; S.search.error = null; render();
		api('GET', '/rise/search?q=' + encodeURIComponent(q)).then(function (data) { S.search.status = 'ready'; S.search.results = data.programs; render(); }).catch(function (e) { S.search.status = 'error'; S.search.error = e; render(); });
	}
	function toggleProgram(id, identity) {
		var at = S.selected.indexOf(id);
		if (at !== -1) { S.selected.splice(at, 1); render(); return; }
		if (S.selected.length >= MAX_PROGRAMS) { toast('The prototype works with up to ' + MAX_PROGRAMS + ' programs at a time.', 'err'); return; }
		S.selected.push(id);
		if (!S.programs[id] || !S.programs[id].evidenceQuality) {
			S.programs[id] = { programSpecialtyId: id, identity: identity || {}, defaultTier: 'ESSENTIAL', pending: true };
			if (!S.tiers[id]) { S.tiers[id] = 'ESSENTIAL'; }
			api('GET', '/rise/bundle?id=' + encodeURIComponent(id)).then(function (data) {
				S.programs[id] = Object.assign({ programSpecialtyId: id, defaultTier: 'ESSENTIAL', fromSearch: true }, data.summary); render();
			}).catch(function (e) { S.programs[id].pending = false; S.programs[id].error = e.code; render(); });
		}
		render();
	}
	function generate(id, tier) {
		tier = tier || S.tiers[id] || 'ESSENTIAL';
		busy('gen:' + id, true);
		return api('POST', '/generate', { rootId: S.root.id, programSpecialtyId: id, tier: tier, otherProgramIds: S.selected.filter(function (x) { return x !== id; }) }).then(function (data) {
			S.runs[id] = data; delete S.prompt[id]; busy('gen:' + id, false); return data;
		}).catch(function (e) { busy('gen:' + id, false); fail(e); throw e; });
	}
	function selectCandidate(run, candidateId) {
		var chosen = (run.candidates || []).filter(function (candidate) { return candidate.candidateId === candidateId; })[0];
		if (!chosen || !chosen.canApprove) { toast('That alternative did not pass every server-side check.', 'err'); return; }
		run.selectedCandidateId = chosen.candidateId;
		run.strategy = chosen.strategy;
		run.replacement = chosen.replacement;
		run.segments = chosen.segments;
		run.paragraphs = chosen.paragraphs;
		run.facts = chosen.facts;
		run.selectedValidation = chosen.validation;
		run.rootIntegrity = chosen.rootIntegrity;
		run.canApprove = chosen.canApprove;
		render();
	}
	function generateAll() {
		var queue = S.selected.filter(function (id) { return !S.runs[id]; });
		busy('all', true);
		(function next() {
			if (!queue.length) { busy('all', false); return; }
			generate(queue.shift()).then(next, function () { busy('all', false); });
		})();
	}
	function save(status) {
		var run = S.runs[S.current];
		busy('save', true);
		api('POST', '/library', { runId: run.runId, candidateId: run.selectedCandidateId || run.recommendedCandidateId || run.strategy, status: status }).then(function (data) {
			run.saved = data.document; busy('save', false);
			toast(data.alreadySaved ? 'This run is already in your prototype library.' : 'Saved to your prototype library as ' + data.document.status + '.', 'ok');
			refreshBoot();
		}).catch(function (e) { busy('save', false); fail(e); });
	}
	function researchPrompt(id) {
		busy('prompt', true);
		api('POST', '/research-prompt', { programSpecialtyId: id }).then(function (data) { S.prompt[id] = data.prompt; busy('prompt', false); }).catch(function (e) { busy('prompt', false); fail(e); });
	}
	function openDoc(uuid) { api('GET', '/library/' + uuid).then(function (data) { S.doc = data.document; go('doc'); }).catch(fail); }
	function setDocStatus(uuid, status) { api('POST', '/library/' + uuid + '/status', { status: status }).then(function (data) { if (S.doc && S.doc.docUuid === uuid) { S.doc = Object.assign(S.doc, { status: data.document.status }); } refreshBoot(); }).catch(fail); }
	function copyText(text) {
		if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(function () { toast('Copied.', 'ok'); }, function () { toast('Select the text and copy it manually.', 'err'); }); } else { toast('Select the text and copy it manually.', 'err'); }
	}
	function loadBatchIndex() {
		busy('batch-index', true);
		api('GET', '/rise/my-program-index').then(function (data) { S.batch.index = data; busy('batch-index', false); }).catch(function (e) { busy('batch-index', false); fail(e); });
	}
	function createBatch() {
		if (!S.root) { toast('Open the ROOT for this specialty first.', 'err'); return; }
		if (!S.batch.index || !S.batch.index.programs.length) { toast('Import your RISE program list first.', 'err'); return; }
		busy('batch-create', true);
		api('POST', '/batch/jobs', { rootId: S.root.id, programs: S.batch.index.programs.map(function (p) { return { programSpecialtyId: p.programSpecialtyId, priorityPosition: p.priorityPosition, goldStarred: p.goldStarred, tier: p.defaultTier }; }) }).then(function (data) {
			S.batch.current = data.job; busy('batch-create', false); refreshBoot();
		}).catch(function (e) { busy('batch-create', false); fail(e); });
	}
	function openBatch(uuid) {
		busy('batch-open', true);
		api('GET', '/batch/jobs/' + uuid).then(function (data) { S.batch.current = data.job; busy('batch-open', false); go('batch'); }).catch(function (e) { busy('batch-open', false); fail(e); });
	}
	function runBatch() {
		var job = S.batch.current;
		if (!job || S.batch.running) { return; }
		S.batch.running = true; render();
		var stopped = false;
		function worker() {
			if (stopped || !S.batch.running) { return Promise.resolve(); }
			return api('POST', '/batch/jobs/' + job.jobUuid + '/process', {}).then(function (data) {
				S.batch.current = data.job;
				var queued = data.job.items.filter(function (item) { return item.status === 'QUEUED'; }).length;
				render();
				if (!data.item && !queued) { return; }
				return worker();
			}).catch(function (e) { stopped = true; fail(e); });
		}
		var workers = [];
		for (var i = 0; i < Math.min(2, (S.boot.limits && S.boot.limits.batchWorkers) || 2); i++) { workers.push(worker()); }
		Promise.all(workers).then(function () { S.batch.running = false; refreshBoot(); render(); });
	}
	function stopBatch() { S.batch.running = false; render(); }
	function batchTier(item, tier) {
		busy('batch-tier:' + item.itemUuid, true);
		api('PUT', '/batch/jobs/' + S.batch.current.jobUuid + '/items/' + item.itemUuid + '/tier', { tier: tier }).then(function (data) { S.batch.current = data.job; busy('batch-tier:' + item.itemUuid, false); }).catch(function (e) { busy('batch-tier:' + item.itemUuid, false); fail(e); });
	}
	function openBatchRun(item) {
		busy('batch-run', true);
		api('GET', '/batch/jobs/' + S.batch.current.jobUuid + '/items/' + item.itemUuid + '/run').then(function (run) {
			S.runs[item.programSpecialtyId] = run;
			S.programs[item.programSpecialtyId] = { identity: run.program };
			if (S.selected.indexOf(item.programSpecialtyId) === -1) { S.selected.push(item.programSpecialtyId); }
			S.current = item.programSpecialtyId; busy('batch-run', false); go('preview');
		}).catch(function (e) { busy('batch-run', false); fail(e); });
	}
	function approveBatchItem(item) {
		busy('batch-approve:' + item.itemUuid, true);
		api('POST', '/batch/jobs/' + S.batch.current.jobUuid + '/items/' + item.itemUuid + '/approve', {}).then(function (data) { S.batch.current = data.job; busy('batch-approve:' + item.itemUuid, false); refreshBoot(); toast('Approved recommended version.', 'ok'); }).catch(function (e) { busy('batch-approve:' + item.itemUuid, false); fail(e); });
	}
	function approveBatchReady() {
		busy('batch-approve-all', true);
		api('POST', '/batch/jobs/' + S.batch.current.jobUuid + '/approve-ready', {}).then(function (data) { S.batch.current = data.job; busy('batch-approve-all', false); refreshBoot(); toast('Approved ' + data.approved + ' clean recommended version' + (data.approved === 1 ? '.' : 's.'), data.errors.length ? 'err' : 'ok'); }).catch(function (e) { busy('batch-approve-all', false); fail(e); });
	}
	function bulkDownload(allApproved) {
		var ids = Object.keys(S.selectedDocs).filter(function (id) { return S.selectedDocs[id]; });
		if (!allApproved && !ids.length) { toast('Select at least one statement.', 'err'); return; }
		busy('bulk', true);
		fetch(cfg.restUrl.replace(/\/$/, '') + '/library/bulk-download', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'X-WP-Nonce': cfg.nonce, 'Content-Type': 'application/json' }, body: JSON.stringify({ docUuids: ids, allApproved: !!allApproved }) }).then(function (res) {
			if (!res.ok) { return res.json().then(function (d) { throw new Error(d.message || 'Bulk download failed.'); }); }
			return res.blob().then(function (blob) { return { blob: blob, disposition: res.headers.get('content-disposition') || '' }; });
		}).then(function (result) {
			var match = result.disposition.match(/filename="([^"]+)"/), a = document.createElement('a');
			a.href = URL.createObjectURL(result.blob); a.download = match ? match[1] : 'MissionMed_Program_Specific_PS.zip'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000); busy('bulk', false);
		}).catch(function (e) { busy('bulk', false); fail(e); });
	}

	/* ---------- views ---------- */
	function header() {
		var pv = S.boot.provider, pill;
		if (pv.provider === 'openai-responses') { pill = '<span class="pill ok hideS"><span class="dot"></span>AI live · ' + esc(pv.model) + '</span>'; } else if (pv.provider === 'simulator') { pill = '<span class="pill warn hideS"><span class="dot"></span>AI simulator · not real writing</span>'; } else { pill = '<span class="pill warn hideS"><span class="dot"></span>AI not configured</span>'; }
		return '<header class="hdr"><div class="brand"><span class="brandTitle">File Vault <em>·</em> Program-Specific PS</span><span class="brandSub">MissionMed · Personal Statements</span></div><span class="hdrSpace"></span>' +
			'<span class="pill vi">Prototype · allowlist only</span>' + pill +
			'<button class="btn sm ghost" data-act="go" data-view="batch">Batch' + (S.boot.batches && S.boot.batches.length ? ' · ' + S.boot.batches.length : '') + '</button>' +
			'<button class="btn sm ghost" data-act="go" data-view="library">Library' + (S.boot.library.length ? ' · ' + S.boot.library.length : '') + '</button>' +
			'<a class="btn sm" href="' + esc(cfg.backUrl) + '">← File Vault</a></header>';
	}
	function rail() {
		var html = '<nav class="rail" aria-label="Steps"><div class="railLabel">Workflow</div>';
		html += '<button class="stepBtn' + (S.view === 'home' ? ' on' : '') + '" data-act="go" data-view="home"><span class="stepNum">⌂</span><span><span class="stepName">Start</span></span></button>';
		STEPS.forEach(function (s) {
			html += '<button class="stepBtn' + (S.view === s.key ? ' on' : '') + (stepDone(s.key) ? ' done' : '') + '" data-act="go" data-view="' + s.key + '"' + (stepOpen(s.key) ? '' : ' disabled') + '><span class="stepNum">' + (stepDone(s.key) && S.view !== s.key ? '✓' : s.n) + '</span><span><span class="stepName">' + s.name + '</span><br><span class="stepHint">' + s.hint + '</span></span></button>';
		});
		html += '<div class="railSep"></div><button class="stepBtn' + (S.view === 'library' || S.view === 'doc' ? ' on' : '') + '" data-act="go" data-view="library"><span class="stepNum">▤</span><span><span class="stepName">Prototype library</span><br><span class="stepHint">Isolated from File Vault</span></span></button>';
		html += '<button class="stepBtn' + (S.view === 'batch' ? ' on' : '') + '" data-act="go" data-view="batch"><span class="stepNum">⇉</span><span><span class="stepName">Batch workspace</span><br><span class="stepHint">50–100 programs · resumable</span></span></button>';
		if (S.root) { html += '<div class="railSep"></div><div class="railNote"><strong>ROOT</strong><br>' + esc(S.root.specialtyLabel) + '<br>' + esc(S.root.rootLabel) + '</div>'; }
		return html + '</nav>';
	}
	function head(eyebrow, title, lede) { return '<div class="eyebrow">' + eyebrow + '</div><h1 class="h1">' + title + '</h1>' + (lede ? '<p class="lede">' + lede + '</p>' : ''); }

	function viewHome() {
		var b = S.boot, html = head('File Vault · Personal Statements', 'One statement. <em>Every program.</em>', 'Pick your finished statement, confirm the one paragraph that may change, and get a complete, program-specific version for each program, written only from verified RISE facts.');
		html += '<div class="row mt"><button class="btn primary" data-act="go" data-view="root">Start a new ROOT →</button>' + (b.library.length ? '<button class="btn" data-act="go" data-view="library">Open library</button>' : '') + '</div>';
		html += '<div class="grid3 mt">' +
			'<div class="panel"><div class="eyebrow">Protected</div><div class="h2 mtS">Your ROOT never changes</div><p class="mid small mtS">Only the region you authorize is rewritten. Every other paragraph is hash-checked against the ROOT before anything is shown or saved.</p></div>' +
			'<div class="panel"><div class="eyebrow">Verified</div><div class="h2 mtS">Facts come from RISE</div><p class="mid small mtS">Each program claim traces to a supplied RISE fact with its source. If RISE cannot support a Deep paragraph, you see “Deep research needed”, never a guess.</p></div>' +
			'<div class="panel"><div class="eyebrow">Isolated</div><div class="h2 mtS">Nothing touches File Vault records</div><p class="mid small mtS">Outputs live in a separate prototype library. No File Vault document, journey slot, review queue or activity entry is created.</p></div></div>';
		html += statusPanel();
		if (b.roots.length) {
			html += '<div class="panel mt"><div class="panelHead"><div><div class="eyebrow">Resume</div><div class="h2">Your ROOTs</div></div></div>' + b.roots.map(function (r) {
				return '<div class="prog"><div><div class="progName">' + esc(r.specialtyLabel) + ' ' + (r.isSynthetic ? '<span class="tag cy">Synthetic</span>' : '<span class="tag gold">Real statement</span>') + '</div><div class="progMeta">' + esc(r.rootLabel) + ' · ' + r.paragraphCount + ' paragraphs · ' + r.wordCount + ' words' + (r.regionConfirmed ? ' · region confirmed' : '') + '</div></div><button class="btn sm" data-act="open-root" data-id="' + r.id + '">Open</button></div>';
			}).join('') + '</div>';
		}
		return html;
	}
	function statusPanel() {
		var b = S.boot, pv = b.provider, rows = '';
		rows += '<dt>RISE</dt><dd>' + (b.rise.configured ? (b.rise.sessionPresent ? '<span class="tag ok">Connected</span> student-session read contract' : '<span class="tag em">Open RISE once</span> <a href="' + esc(cfg.riseUrl) + '" target="_blank" rel="noopener">Open RISE</a> in this browser, then reload') : '<span class="tag rd">Not configured</span> RISE origin is not set on this site') + '</dd>';
		rows += '<dt>AI writer</dt><dd>' + (pv.provider === 'openai-responses' ? '<span class="tag ok">Live</span> ' + esc(pv.model) + ' · request storage off' : pv.provider === 'simulator' ? '<span class="tag rd">Simulator</span> clearly labelled placeholder text, not real writing' : '<span class="tag rd">Not configured</span> generation is unavailable') + '</dd>';
		rows += '<dt>Privacy gate</dt><dd>' + (pv.realRootAllowed ? '<span class="tag gold">Real statements allowed</span> Founder decision recorded on this site' : '<span class="tag cy">Synthetic only</span> real statement text is not sent to the AI provider until the Founder privacy decision is recorded') + '</dd>';
		rows += '<dt>File Vault</dt><dd>' + (b.fileVault.available ? '<span class="tag ok">Readable</span> your own verified Personal Statement versions, read-only' : '<span class="tag">Not available here</span> use the synthetic or pasted ROOT') + '</dd>';
		rows += '<dt>Today</dt><dd>' + b.limits.runsToday + ' of ' + b.limits.dailyRunCap + ' prototype generations used</dd>';
		return '<div class="panel mt"><div class="panelHead"><div><div class="eyebrow">System</div><div class="h2">What is live right now</div></div></div><dl class="kv">' + rows + '</dl></div>';
	}

	function viewRoot() {
		var f = S.rootForm, c = S.candidates, pv = S.boot.provider, html = head('Step 1', 'Choose your <em>ROOT</em> statement', 'The ROOT is the finished statement every program version is built from. One ROOT belongs to one specialty.');
		html += '<div class="panel mt"><label class="f">Specialty this ROOT is for<select data-bind="specialty"' + (f.source === 'SYNTHETIC' ? ' disabled' : '') + '>' + SPECIALTIES.map(function (s) { return '<option' + (s === f.specialty ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select></label><p class="tiny dim mtS">Applying to more than one specialty? Each specialty gets its own ROOT. The prototype handles one at a time.</p></div>';
		html += '<div class="grid3 mt">';
		html += '<button class="choice' + (f.source === 'FILE_VAULT' ? ' on' : '') + '" data-act="source" data-source="FILE_VAULT"' + (c && c.fileVaultAvailable && c.candidates.length ? '' : ' disabled') + '><span class="choiceTitle">From File Vault <span class="tag gold">Real</span></span><span class="choiceBody">' + (!c ? 'Checking File Vault…' : !c.fileVaultAvailable ? 'File Vault is not readable on this site.' : c.candidates.length ? 'Your own Personal Statement versions, read-only.' : 'No Personal Statement versions found for your account.') + '</span></button>';
		html += '<button class="choice' + (f.source === 'SYNTHETIC' ? ' on' : '') + '" data-act="source" data-source="SYNTHETIC"><span class="choiceTitle">Synthetic test ROOT <span class="tag cy">Safe for AI</span></span><span class="choiceBody">Fictional applicants written for this prototype, in two different voices. No real person. Use these to judge the AI writing today.</span></button>';
		html += '<button class="choice' + (f.source === 'PASTED' ? ' on' : '') + '" data-act="source" data-source="PASTED"><span class="choiceTitle">Paste text</span><span class="choiceBody">Paste a statement with a blank line between paragraphs. Pasted text is always treated as a real statement.</span></button></div>';
		if (f.source === 'FILE_VAULT' && c) {
			html += '<div class="panel mt"><div class="h2">Pick a version</div><div class="mtS">' + c.candidates.map(function (v) {
				var key = v.fileId + ':' + v.versionNumber;
				return '<button class="choice mtS' + (f.fileKey === key ? ' on' : '') + '" data-act="pick-file" data-key="' + key + '"' + (v.usable ? '' : ' disabled') + '><span class="choiceTitle">' + esc(v.documentName || 'Personal Statement') + ' · v' + v.versionNumber + (v.isFinal ? ' <span class="tag ok">Final</span>' : '') + (v.versionLabel ? ' <span class="tag">' + esc(v.versionLabel) + '</span>' : '') + '</span><span class="choiceBody">' + esc(v.fileName) + (v.uploadedAt ? ' · uploaded ' + esc(v.uploadedAt) : '') + (v.usable ? '' : ' · ' + esc(v.whyNot)) + '</span></button>';
			}).join('') + '</div>' + (pv.realRootAllowed ? '' : '<div class="notice gold mtS"><strong>Privacy gate.</strong> You can select a real statement and confirm its region, but this site will not send real statement text to the AI provider until the Founder privacy decision is recorded. Use the synthetic ROOT for the AI step.</div>') + '</div>';
		}
		if (f.source === 'SYNTHETIC' && c && c.synthetics) {
			html += '<div class="panel mt"><div class="h2">Pick a voice</div><div class="grid2 mtS">' + c.synthetics.map(function (x) {
				return '<button class="choice' + (f.syntheticKey === x.key ? ' on' : '') + '" data-act="pick-synthetic" data-key="' + esc(x.key) + '"><span class="choiceTitle">' + esc(x.specialty) + ' <span class="tag cy">Synthetic</span></span><span class="choiceBody">' + esc(x.label) + ' · ' + x.paragraphCount + ' paragraphs. The specialty is set by this ROOT.</span></button>';
			}).join('') + '</div></div>';
		}
		if (f.source === 'PASTED') {
			html += '<div class="panel mt"><label class="f">Statement text<textarea data-bind="text" placeholder="Paste the full statement. Leave a blank line between paragraphs.">' + esc(f.text) + '</textarea></label>' + (pv.realRootAllowed ? '' : '<div class="notice gold mtS"><strong>Privacy gate.</strong> Pasted text counts as a real statement. You can confirm its region and preferences, but it will not be sent to the AI provider until the Founder privacy decision is recorded on this site. Use a synthetic ROOT to see AI writing today.</div>') + '</div>';
		}
		var ready = f.source === 'SYNTHETIC' || (f.source === 'PASTED' && f.text.trim().length > 200) || (f.source === 'FILE_VAULT' && f.fileKey);
		html += '<div class="footBar"><button class="btn ghost" data-act="go" data-view="home">← Back</button><button class="btn primary" data-act="create-root"' + (ready && !S.busy.root ? '' : ' disabled') + '>' + (S.busy.root ? '<span class="spin"></span>Reading…' : 'Use this ROOT →') + '</button></div>';
		return html;
	}

	function viewRegion() {
		var r = S.root, d = S.regionDraft, det = S.detection || {}, html = head('Step 2', 'Confirm the <em>only</em> part that may change', 'Everything outside the highlighted region is locked. It is hash-checked against your ROOT before any version is shown or saved.');
		var conf = det.proposedIndex == null ? '<span class="tag rd">No clear program paragraph found</span>' : '<span class="tag ' + (det.confidence === 'HIGH' ? 'ok' : 'em') + '">Suggestion confidence: ' + esc(det.confidence) + '</span>';
		html += '<div class="panel mt"><div class="spread"><div class="row">' + conf + '<span class="small mid">' + (det.proposedIndex == null ? 'Click the paragraph to replace, or choose where a new paragraph should go.' : 'We suggested paragraph ' + (det.proposedIndex + 1) + '. Click any other paragraph to change it.') + '</span>' + (d.index != null ? '<button class="btn sm ghost" data-act="jump">Jump to it ↓</button>' : '') + '</div><div class="seg"><button data-act="region-mode" data-mode="REPLACE_PARAGRAPH" class="' + (d.mode === 'REPLACE_PARAGRAPH' ? 'on' : '') + '">Replace a paragraph</button><button data-act="region-mode" data-mode="INSERT_BEFORE" class="' + (d.mode === 'INSERT_BEFORE' ? 'on' : '') + '">Insert a new paragraph</button></div></div></div>';
		html += '<div class="paper mt">';
		r.paragraphs.forEach(function (p, i) {
			if (d.mode === 'INSERT_BEFORE' && i >= 1) { html += '<button class="insertSlot' + (d.index === i ? ' on' : '') + '" data-act="region-pick" data-index="' + i + '">' + (d.index === i ? 'New program paragraph goes here' : 'Insert here') + '</button>'; }
			var isRegion = d.mode === 'REPLACE_PARAGRAPH' && d.index === i, pick = d.mode === 'REPLACE_PARAGRAPH' && i >= 1;
			html += '<div class="para' + (isRegion ? ' region' : ' locked') + (pick ? ' pick' : '') + (det.proposedIndex === i ? ' proposed' : '') + '"' + (pick ? ' data-act="region-pick" data-index="' + i + '" tabindex="0" role="button"' : '') + '><span class="pn">' + (i + 1) + '</span>' + (isRegion ? '<div class="paraFlag">✎ Editable region · this paragraph will be rewritten per program</div>' : '') + esc(p) + '</div>';
		});
		if (d.mode === 'INSERT_BEFORE') { html += '<button class="insertSlot' + (d.index === r.paragraphs.length ? ' on' : '') + '" data-act="region-pick" data-index="' + r.paragraphs.length + '">' + (d.index === r.paragraphs.length ? 'New program paragraph goes here' : 'Insert at the end') + '</button>'; }
		html += '</div><p class="tiny dim mtS">Integrity rule: ' + esc(S.boot.contract.normalizationRule) + ' · ROOT text ' + esc(r.textSha256.slice(0, 16)) + '…</p>';
		html += '<div class="footBar"><button class="btn ghost" data-act="go" data-view="root">← Back</button><button class="btn primary" data-act="save-region"' + (d.index == null || S.busy.region ? ' disabled' : '') + '>' + (S.busy.region ? '<span class="spin"></span>Saving…' : 'Confirm this region →') + '</button></div>';
		return html;
	}

	function viewPrefs() {
		var p = S.prefs, html = head('Step 3', 'What matters to <em>you</em>', 'Answer once. These are matched against verified RISE facts for every program. A preference is never turned into a claim about a program.');
		if (!S.boot.provider.realRootAllowed) { html += '<div class="notice mt"><strong>What is sent to the AI writer.</strong> The options you tick and any words you type on this page are sent with the statement. While the privacy gate is closed, type test details for the fictional applicant only, never a real applicant’s personal details.</div>'; }
		html += '<div class="stack mt">';
		CATS.forEach(function (c) {
			var v = p.categories[c.key];
			html += '<div class="panel"><div class="spread"><div><div class="h2">' + c.title + '</div><div class="small mid">' + c.hint + '</div></div><div class="seg"><button data-act="cat" data-key="' + c.key + '" data-on="0" class="' + (v.on ? '' : 'on') + '">Not a priority</button><button data-act="cat" data-key="' + c.key + '" data-on="1" class="' + (v.on ? 'on' : '') + '">Matters to me</button></div></div>';
			if (v.on) {
				if (c.options.length) { html += '<div class="chips mtS">' + c.options.map(function (o) { return '<button class="chip' + (v.terms.indexOf(o) !== -1 ? ' on' : '') + '" data-act="term" data-key="' + c.key + '" data-term="' + esc(o) + '">' + esc(o) + '</button>'; }).join('') + '</div>'; }
				var extra = v.terms.filter(function (t) { return c.options.indexOf(t) === -1; });
				if (extra.length) { html += '<div class="chips mtS">' + extra.map(function (t) { return '<button class="chip on" data-act="term" data-key="' + c.key + '" data-term="' + esc(t) + '">' + esc(t) + ' ×</button>'; }).join('') + '</div>'; }
				html += '<div class="grid2 mtS"><label class="f">Add your own (press Enter)<input type="text" data-add="' + c.key + '" placeholder="e.g. advanced heart failure" maxlength="60"></label><label class="f">One line in your own words (optional)<input type="text" data-note="' + c.key + '" value="' + esc(v.note) + '" maxlength="200" placeholder="Why this matters to you"></label></div><p class="tiny dim mtS">Up to six per category.</p>';
			}
			html += '</div>';
		});
		var loc = p.location;
		html += '<div class="panel"><div class="spread"><div><div class="h2">Geography and location</div><div class="small mid">Where you want to train. A personal reason is only ever used if you allow it, and only for programs in those places.</div></div><div class="seg"><button data-act="loc" data-on="0" class="' + (loc.on ? '' : 'on') + '">Open to anywhere</button><button data-act="loc" data-on="1" class="' + (loc.on ? 'on' : '') + '">I have a preference</button></div></div>';
		if (loc.on) {
			html += '<div class="grid2 mtS"><label class="f">Add a state<select data-state-add><option value="">Choose…</option>' + Object.keys(STATES).map(function (code) { return '<option value="' + code + '">' + STATES[code] + '</option>'; }).join('') + '</select></label><label class="f">Cities (comma separated, optional)<input type="text" data-cities value="' + esc(loc.cities.join(', ')) + '" placeholder="e.g. Rochester, Buffalo"></label></div>';
			if (S.stateCodes.length) { html += '<div class="chips mtS">' + S.stateCodes.map(function (code) { return '<button class="chip on" data-act="state-remove" data-code="' + code + '">' + STATES[code] + ' ×</button>'; }).join('') + '</div>'; }
			html += '<label class="f mtS">Your reason, in your own words (optional)<input type="text" data-loc-reason value="' + esc(loc.reason) + '" maxlength="200" placeholder="e.g. my clinical rotations were in western New York"></label><label class="check mtS"><input type="checkbox" data-loc-mention' + (loc.mayMention ? ' checked' : '') + '><span>The writer may mention this reason for programs in these places. <span class="dim">Leave unticked to keep it private; it will then only guide which programs feel like a fit.</span></span></label>';
		}
		html += '</div></div><div class="footBar"><button class="btn ghost" data-act="go" data-view="region">← Back</button><button class="btn primary" data-act="save-prefs"' + (S.busy.prefs ? ' disabled' : '') + '>' + (S.busy.prefs ? '<span class="spin"></span>Saving…' : 'Save preferences →') + '</button></div>';
		return html;
	}

	function riseProblem(err) {
		if (err.code === 'mmps_rise_session_required') { return '<div class="notice gold"><strong>Open RISE once in this browser.</strong> Program data is read through your own RISE student session, so RISE has to be open in this browser first. <a href="' + esc(cfg.riseUrl) + '" target="_blank" rel="noopener">Open RISE</a>, then <button class="btn sm cy" data-act="retry-list">Try again</button></div>'; }
		return '<div class="notice rd"><strong>RISE could not be read.</strong> ' + esc(err.message) + ' <button class="btn sm" data-act="retry-list">Try again</button></div>';
	}
	function programRow(id, identity, extra, selectable) {
		var on = S.selected.indexOf(id) !== -1, rec = S.programs[id] || extra || {};
		return '<div class="prog' + (on ? ' on' : '') + '"><div><div class="progName">' + esc(programLabel(identity)) + '</div><div class="progMeta">' + esc([identity.institution !== identity.programName ? identity.institution : '', placeLabel(identity), identity.acgmeId ? 'ACGME ' + identity.acgmeId : ''].filter(Boolean).join(' · ')) + '</div><div class="row mtS">' + (extra && extra.goldStarred ? '<span class="tag gold">★ Gold</span>' : '') + (extra && extra.priorityPosition ? '<span class="tag gold">Priority #' + extra.priorityPosition + '</span>' : '') + qualityTag(rec.evidenceQuality) + ingredients(rec.essentialHas) + '</div></div>' + (selectable ? '<button class="btn sm' + (on ? ' primary' : '') + '" data-act="toggle-program" data-id="' + esc(id) + '">' + (on ? '✓ Selected' : 'Select') + '</button>' : '') + '</div>';
	}
	function viewPrograms() {
		var L = S.list, html = head('Step 4', 'Choose programs from <em>RISE</em>', 'Pick three to five with different evidence depth. Program names, IDs and facts come from RISE; nothing is typed by hand.');
		html += '<div class="panel mt"><div class="panelHead"><div><div class="eyebrow">Your RISE list</div><div class="h2">Priority order, Gold first</div></div><span class="tag">' + S.selected.length + ' of ' + MAX_PROGRAMS + ' selected</span></div>';
		if (L.status === 'loading' && !L.programs.length) { html += '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>'; }
		if (L.status === 'error') { html += riseProblem(L.error); }
		if (L.status === 'ready' && !L.programs.length) { html += '<div class="notice">Your RISE list is empty. Search the RISE registry below, or add programs in RISE first.</div>'; }
		html += L.programs.map(function (p) { return p.error ? '<div class="prog"><div><div class="progName dim">' + esc(p.programSpecialtyId) + '</div><div class="progMeta">Could not be read from RISE (' + esc(p.error) + ')</div></div></div>' : programRow(p.programSpecialtyId, p.identity, p, true); }).join('');
		if (L.status !== 'error' && L.programs.length < L.total) { html += '<div class="row mtS"><button class="btn sm" data-act="more-list"' + (L.status === 'loading' ? ' disabled' : '') + '>' + (L.status === 'loading' ? '<span class="spin"></span>Loading…' : 'Load more (' + (L.total - L.programs.length) + ' left)') + '</button></div>'; }
		html += '</div><div class="panel"><div class="panelHead"><div><div class="eyebrow">RISE registry</div><div class="h2">Search for a program</div></div></div><div class="row"><input type="search" data-search placeholder="Program or institution name" value="' + esc(S.search.q) + '"><button class="btn" data-act="search"' + (S.search.status === 'loading' ? ' disabled' : '') + '>' + (S.search.status === 'loading' ? '<span class="spin"></span>' : '') + 'Search</button></div>';
		if (S.search.status === 'error') { html += '<div class="mtS">' + riseProblem(S.search.error) + '</div>'; }
		if (S.search.status === 'ready') { html += '<div class="mtS">' + (S.search.results.length ? S.search.results.map(function (p) { return programRow(p.programSpecialtyId, p, null, true); }).join('') : '<div class="notice">No programs matched.</div>') + '</div>'; }
		html += '</div><div class="footBar"><button class="btn ghost" data-act="go" data-view="prefs">← Back</button><button class="btn primary" data-act="go" data-view="generate"' + (S.selected.length ? '' : ' disabled') + '>Choose tiers →</button></div>';
		return html;
	}

	function runTag(run) {
		if (!run) { return ''; }
		if (run.status === 'OK') { return '<span class="tag ok">Ready</span>'; }
		if (run.status === 'RESEARCH_NEEDED') { return '<span class="tag vi">Deep research needed</span>'; }
		return '<span class="tag rd">Needs attention</span>';
	}
	function viewGenerate() {
		var b = S.boot, html = head('Step 5', 'Essential or <em>Deep</em>', 'Your top programs default to Deep. Everything else defaults to Essential. You can change any of them.');
		html += '<div class="grid2 mt"><div class="tierCard ess"><div class="row"><span class="tag em">Essential</span><span class="small mid">default outside your top ' + b.limits.priorityDeepCutoff + '</span></div><ul><li>Verified identity ingredients: program name, type, city and state, current program director when RISE can prove it.</li><li>They are ingredients, not a checklist. The writer uses what reads naturally.</li><li>Always available.</li></ul></div><div class="tierCard deep"><div class="row"><span class="tag vi">Deep</span><span class="small mid">default for Gold and top ' + b.limits.priorityDeepCutoff + '</span></div><ul><li>Everything in Essential, plus ' + b.limits.deepMinFacts + ' to ' + b.limits.deepMaxFacts + ' verified RISE details, chosen to match your preferences where RISE has them. A fellowship you did not name is never used.</li><li>If RISE cannot support it you get “Deep research needed”, never invented detail.</li></ul></div></div>';
		if (S.root && !S.root.isSynthetic && b.provider.provider === 'openai-responses' && !b.provider.realRootAllowed) { html += '<div class="notice gold mt"><strong>Privacy gate closed.</strong> This ROOT is a real statement, so it will not be sent to the AI provider. Switch to the synthetic ROOT to see real AI writing.</div>'; }
		if (b.provider.provider === 'simulator') { html += '<div class="notice rd mt"><strong>Simulator.</strong> No AI key is configured on this site, so output is labelled placeholder text that only exercises the pipeline.</div>'; }
		if (b.provider.provider === 'none') { html += '<div class="notice rd mt"><strong>AI provider not configured.</strong> Generation is unavailable until the key is set in wp-config.</div>'; }
		html += '<div class="panel mt"><div class="panelHead"><div><div class="eyebrow">Selected programs</div><div class="h2">' + S.selected.length + ' program' + (S.selected.length === 1 ? '' : 's') + '</div></div><button class="btn primary sm" data-act="generate-all"' + (S.busy.all || b.provider.provider === 'none' ? ' disabled' : '') + '>' + (S.busy.all ? '<span class="spin"></span>Writing…' : 'Generate all') + '</button></div>';
		html += S.selected.map(function (id) {
			var rec = S.programs[id] || {}, identity = rec.identity || {}, tier = S.tiers[id] || 'ESSENTIAL', run = S.runs[id], working = S.busy['gen:' + id];
			return '<div class="prog"><div><div class="progName">' + esc(programLabel(identity)) + '</div><div class="progMeta">' + esc(placeLabel(identity)) + '</div><div class="row mtS">' + (rec.goldStarred ? '<span class="tag gold">★ Gold</span>' : '') + (rec.priorityPosition ? '<span class="tag gold">Priority #' + rec.priorityPosition + '</span>' : '') + qualityTag(rec.evidenceQuality) + ingredients(rec.essentialHas) + runTag(run) + '</div></div><div class="row"><div class="seg"><button data-act="tier" data-id="' + esc(id) + '" data-tier="ESSENTIAL" class="' + (tier === 'ESSENTIAL' ? 'on' : '') + '">Essential</button><button data-act="tier" data-id="' + esc(id) + '" data-tier="DEEP" class="deep ' + (tier === 'DEEP' ? 'on' : '') + '">Deep</button></div>' + (run ? '<button class="btn sm cy" data-act="open-run" data-id="' + esc(id) + '">Open preview</button>' : '') + '<button class="btn sm" data-act="generate" data-id="' + esc(id) + '"' + (working || rec.pending || b.provider.provider === 'none' ? ' disabled' : '') + '>' + (working ? '<span class="spin"></span>Writing…' : run ? 'Regenerate' : 'Generate') + '</button></div></div>';
		}).join('');
		html += '</div><div class="footBar"><button class="btn ghost" data-act="go" data-view="programs">← Back</button><button class="btn primary" data-act="go" data-view="preview"' + (Object.keys(S.runs).length ? '' : ' disabled') + '>Open previews →</button></div>';
		return html;
	}

	function factCard(f) {
		var pr = f.provenance || {}, urls = (pr.sourceUrls && pr.sourceUrls.length ? pr.sourceUrls : (pr.sourceUrl ? [pr.sourceUrl] : []));
		var src = urls.slice(0, 2).map(function (u) { return '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(u.replace(/^https:\/\//, '').slice(0, 60)) + '</a>'; }).join(' · ');
		var origin = pr.origin === 'RISE_REGISTRY' ? 'RISE registry' + (pr.authority ? ' · ' + pr.authority : '') : 'RISE research' + (pr.provider ? ' · ' + pr.provider : '');
		return '<div class="fact' + (f.used ? ' used' : '') + '"><div class="factTop"><span class="factLabel">' + esc(f.label) + '</span>' + (f.used ? '<span class="tag gold">Used</span>' : '<span class="tag">Available</span>') + '</div><div class="factText">' + esc(typeof f.value === 'string' && f.value ? f.value : f.text) + '</div><div class="factSrc">' + esc(origin) + ' · ' + esc(ageLabel(pr.ageDays)) + (src ? ' · ' + src : '') + '<br><span class="mono">' + esc(f.factId) + (pr.claimId ? ' · claim ' + esc(pr.claimId) : '') + '</span></div></div>';
	}
	function regionMarkup(run) {
		var joined = (run.segments || []).map(function (s) { return s.text; }).join(' ').replace(/\s+/g, ' ').trim();
		if (!run.segments || !run.segments.length || joined !== run.replacement.replace(/\s+/g, ' ').trim()) { return esc(run.replacement); }
		var labels = {}; (run.facts || []).forEach(function (f) { labels[f.factId] = f.label; });
		return run.segments.map(function (s) {
			if (s.kind === 'program_fact') { return '<span class="seg-fact" title="Verified: ' + esc((s.fact_ids || []).map(function (id) { return labels[id] || id; }).join(', ')) + '">' + esc(s.text) + '</span>'; }
			if (s.kind === 'student_link') { return '<span class="seg-link" title="From your own statement or preferences">' + esc(s.text) + '</span>'; }
			return esc(s.text);
		}).join(' ');
	}
	function viewPreview() {
		var ids = S.selected.filter(function (id) { return S.runs[id]; });
		if (!S.current || !S.runs[S.current]) { S.current = ids[0] || ''; }
		var run = S.runs[S.current], html = head('Step 6', 'Preview the <em>complete</em> statement', '');
		if (!run) { return html + '<div class="notice mt">Generate at least one program first.</div>'; }
		html += '<div class="chips mtS">' + ids.map(function (id) { return '<button class="chip' + (id === S.current ? ' on' : '') + '" data-act="open-run" data-id="' + esc(id) + '">' + esc(programLabel(S.runs[id].program)) + '</button>'; }).join('') + '</div>';
		if (run.status === 'RESEARCH_NEEDED') { return html + researchNeeded(run); }
		if (run.candidates && run.candidates.length) {
			html += '<section class="candidatePanel mt" aria-labelledby="candidate-heading"><div class="spread"><div><div class="eyebrow">Writing choices</div><div class="h2" id="candidate-heading">Choose the paragraph that sounds most like you</div></div><span class="tag">' + run.candidates.length + ' distinct approaches</span></div><p class="small mid mtS">The recommended choice is the strongest unattended default. Alternatives change the rhetorical emphasis, not just the wording.</p><div class="candidateChoices mtS" role="radiogroup" aria-label="Program-specific paragraph alternatives">' + run.candidates.map(function (candidate, index) {
				var selected = candidate.candidateId === run.selectedCandidateId;
				return '<button class="candidateChoice' + (selected ? ' on' : '') + '" role="radio" aria-checked="' + (selected ? 'true' : 'false') + '" data-act="select-candidate" data-candidate="' + esc(candidate.candidateId) + '"' + (candidate.canApprove ? '' : ' disabled') + '><span class="candidateNumber">' + (index + 1) + '</span><span><strong>' + esc(STRATEGY[candidate.strategy] || candidate.strategy) + '</strong>' + (candidate.isRecommended ? ' <span class="tag gold">Recommended</span>' : ' <span class="tag">Alternative</span>') + '<br><span class="small mid">' + esc(candidate.rhetoricalFocus) + '</span></span></button>';
			}).join('') + '</div></section>';
		}
		var flags = (run.validation.blocking || []).map(function (f) { return '<div class="flag block"><strong>' + esc(f.code) + '</strong><span>' + esc(f.message) + '</span></div>'; }).join('') + (run.validation.advisory || []).map(function (f) { return '<div class="flag adv"><strong>' + esc(f.code) + '</strong><span>' + esc(f.message) + '</span></div>'; }).join('');
		if (!flags) { flags = '<div class="flag good"><strong>PASS</strong><span>Every program claim cites a supplied RISE fact. No unsupported names or numbers.</span></div>'; }
		var paper = '<div class="paper">';
		run.paragraphs.forEach(function (p, i) {
			if (i === run.regionIndex) {
				if (S.showOriginal && run.originalRegion) { paper += '<div class="para old"><div class="paraFlag">ROOT paragraph · replaced</div>' + esc(run.originalRegion) + '</div>'; }
				paper += '<div class="para region"><span class="pn">' + (i + 1) + '</span><div class="paraFlag">✎ Written for ' + esc(programLabel(run.program)) + (run.simulated ? ' · SIMULATED' : '') + '</div>' + regionMarkup(run) + '</div>';
			} else { paper += '<div class="para locked"><span class="pn">' + (i + 1) + '</span>' + esc(p) + '</div>'; }
		});
		paper += '</div>';
		var side = '<div class="side"><div class="panel"><dl class="kv"><dt>Program</dt><dd><strong>' + esc(programLabel(run.program)) + '</strong><br><span class="small mid">' + esc(placeLabel(run.program)) + (run.program.acgmeId ? ' · ACGME ' + esc(run.program.acgmeId) : '') + '</span></dd><dt>Tier</dt><dd><span class="tag ' + (run.tierEffective === 'DEEP' ? 'vi' : 'em') + '">' + esc(run.tierEffective) + '</span>' + (run.tierRequested !== run.tierEffective ? ' <span class="tiny dim">requested ' + esc(run.tierRequested) + '</span>' : '') + '</dd><dt>Status</dt><dd>' + runTag(run) + (run.saved ? ' <span class="tag gold">Saved · ' + esc(run.saved.status) + '</span>' : '') + '</dd><dt>Approach</dt><dd>' + esc(STRATEGY[run.strategy] || run.strategy) + '</dd><dt>Writer</dt><dd>' + (run.simulated ? '<span class="tag rd">Simulator</span>' : esc(run.model)) + '</dd><dt>ROOT check</dt><dd>' + (run.rootIntegrity.ok ? '<span class="tag ok">Unchanged</span> <span class="tiny dim">' + run.rootIntegrity.protectedParagraphs + ' protected paragraphs match</span>' : '<span class="tag rd">Failed</span> ' + esc(run.rootIntegrity.message)) + '</dd><dt>Run</dt><dd class="mono">' + esc(run.runId) + '</dd></dl></div>';
		side += '<div class="panel"><div class="eyebrow">Checks</div><div class="mtS">' + flags + '</div></div>';
		side += '<div class="panel"><div class="eyebrow">Facts supplied by RISE</div><div class="mtS">' + run.facts.map(factCard).join('') + '</div><p class="tiny dim mtS">Evidence bundle ' + esc(run.bundleSha256.slice(0, 16)) + '… · ' + esc(S.boot.contract.schema) + '</p></div></div>';
		html += '<div class="panel mt"><div class="spread"><div class="row"><label class="check"><input type="checkbox" data-show-original' + (S.showOriginal ? ' checked' : '') + '><span>Show the ROOT paragraph it replaced</span></label><span class="tiny dim"><span class="seg-fact">gold underline</span> = verified program fact · <span class="seg-link">dotted</span> = from you</span></div><div class="row"><button class="btn sm ghost" data-act="jump">Jump to the new paragraph ↓</button><button class="btn sm" data-act="generate" data-id="' + esc(S.current) + '"' + (S.busy['gen:' + S.current] ? ' disabled' : '') + '>' + (S.busy['gen:' + S.current] ? '<span class="spin"></span>Writing…' : '↻ Regenerate (new approach)') + '</button><button class="btn sm" data-act="save" data-status="DRAFT"' + (run.canApprove && !run.saved && !S.busy.save ? '' : ' disabled') + '>Save draft</button><button class="btn sm primary" data-act="save" data-status="APPROVED"' + (run.canApprove && !run.saved && !S.busy.save ? '' : ' disabled') + '>Approve and save</button></div></div>' + (run.canApprove ? '' : '<p class="small mtS dim">Saving is disabled because a blocking check failed. Regenerate, or switch tier.</p>') + '</div>';
		html += '<div class="previewGrid mt">' + paper + side + '</div>';
		return html;
	}
	function researchNeeded(run) {
		var id = S.current, html = '<div class="panel gold mt"><div class="row"><span class="tag vi">Deep research needed</span><span class="h2">' + esc(programLabel(run.program)) + '</span></div><p class="mid mtS">' + (run.reasons || []).map(esc).join(' ') + ' Nothing was sent to the AI and nothing was invented.</p>';
		if (run.deepCandidates && run.deepCandidates.length) { html += '<div class="mtS">' + run.deepCandidates.map(function (f) { f.used = false; return factCard(f); }).join('') + '</div>'; }
		html += '<div class="row mt"><button class="btn primary" data-act="generate-essential" data-id="' + esc(id) + '"' + (S.busy['gen:' + id] ? ' disabled' : '') + '>' + (S.busy['gen:' + id] ? '<span class="spin"></span>Writing…' : 'Write an Essential version instead') + '</button><button class="btn" data-act="research-prompt" data-id="' + esc(id) + '"' + (S.busy.prompt ? ' disabled' : '') + '>Prepare deep research prompt</button><span class="tag">Planned feature</span></div>';
		if (S.prompt[id]) { html += '<div class="notice vi mt"><strong>Planned workflow.</strong> In the full product you run this prompt in Fable or Astra, upload the returned Markdown file here, RISE validates it, and the verified facts become available to every future student. This prototype stops at the prompt: upload and ingestion are not built.</div><pre class="prompt mtS">' + esc(S.prompt[id]) + '</pre><div class="row mtS"><button class="btn sm cy" data-act="copy-prompt" data-id="' + esc(id) + '">Copy prompt</button></div>'; }
		return html + '</div>';
	}

	function download(uuid, format) { return cfg.restUrl.replace(/\/$/, '') + '/library/' + uuid + '/download?format=' + format + '&_wpnonce=' + encodeURIComponent(cfg.nonce); }
	function statusTag(s) { return '<span class="tag ' + (s === 'APPROVED' ? 'ok' : s === 'ARCHIVED' ? '' : 'em') + '">' + esc(s) + '</span>'; }
	function batchStatusTag(s) {
		var cls = s === 'READY' || s === 'COMPLETE' ? 'ok' : s === 'RESEARCH_NEEDED' || s === 'NEEDS_ATTENTION' || s === 'COMPLETE_WITH_EXCEPTIONS' ? 'gold' : s === 'FAILED' ? 'rd' : 'cy';
		return '<span class="tag ' + cls + '">' + esc(String(s || '').replace(/_/g, ' ')) + '</span>';
	}
	function viewBatch() {
		var b = S.batch, job = b.current, html = head('M3 · Batch workspace', 'Generate a complete <em>program set</em>', 'Import the RISE list for this specialty, keep priority programs Deep by default, and resume safely after a reload. Two bounded workers process one durable item at a time.');
		if (!S.root) {
			html += '<div class="notice gold mt"><strong>Choose a specialty ROOT first.</strong> Every batch is isolated to one ROOT, its preferences and its program set. <button class="btn sm cy" data-act="go" data-view="root">Choose ROOT</button></div>';
		} else {
			html += '<div class="panel mt"><div class="spread"><div><div class="eyebrow">Current specialty</div><div class="h2">' + esc(S.root.specialtyLabel) + '</div><p class="small mid mtS">' + esc(S.root.rootLabel) + ' · priority 1–' + esc(S.boot.limits.priorityDeepCutoff) + ' defaults Deep; all others Essential. Every item can be overridden.</p></div><span class="tag ' + (S.root.isSynthetic ? 'cy' : 'gold') + '">' + (S.root.isSynthetic ? 'Synthetic ROOT' : 'Real ROOT · AI gate closed') + '</span></div></div>';
			if (!S.root.isSynthetic && !S.boot.provider.realRootAllowed) { html += '<div class="notice gold"><strong>Privacy hold is working.</strong> You may prepare and save this batch, but processing real-student prose remains blocked until a separate Founder privacy decision.</div>'; }
			if (!b.index) { html += '<div class="panel"><button class="btn cy" data-act="batch-import"' + (S.busy['batch-index'] ? ' disabled' : '') + '>' + (S.busy['batch-index'] ? '<span class="spin"></span>Importing…' : 'Import full RISE program list') + '</button><p class="tiny dim mtS">Only program IDs, list state and priority are imported. Private RISE notes never enter PSV.</p></div>'; }
			else { html += '<div class="panel"><div class="spread"><div><div class="eyebrow">RISE import</div><div class="h2">' + b.index.programs.length + ' programs ready</div><p class="small mid mtS">' + b.index.programs.filter(function (p) { return p.defaultTier === 'DEEP'; }).length + ' default Deep · ' + b.index.programs.filter(function (p) { return p.defaultTier !== 'DEEP'; }).length + ' default Essential · maximum ' + b.index.limit + '</p></div><button class="btn primary" data-act="batch-create"' + (S.busy['batch-create'] ? ' disabled' : '') + '>' + (S.busy['batch-create'] ? '<span class="spin"></span>Creating…' : 'Create resumable batch →') + '</button></div></div>'; }
		}
		if (!job && S.boot.batches && S.boot.batches.length) {
			html += '<div class="panel mt"><div class="panelHead"><div><div class="eyebrow">Resume</div><div class="h2">Recent batches</div></div></div>' + S.boot.batches.map(function (j) { return '<div class="prog"><div><div class="progName">' + esc(j.specialtyLabel) + ' · ' + j.total + ' programs</div><div class="progMeta">' + j.processed + ' processed · ' + j.ready + ' clean · ' + j.attention + ' exceptions · updated ' + esc(j.updatedAt) + ' UTC</div></div><div class="row">' + batchStatusTag(j.status) + '<button class="btn sm" data-act="batch-open" data-id="' + j.jobUuid + '">Open</button></div></div>'; }).join('') + '</div>';
		}
		if (!job) { return html; }
		var pct = job.total ? Math.round(job.processed * 100 / job.total) : 0;
		html += '<div class="panel mt"><div class="spread"><div><div class="eyebrow">Batch ' + esc(job.jobUuid.slice(0, 8)) + '</div><div class="h2">' + esc(job.specialtyLabel) + ' · ' + job.processed + ' of ' + job.total + ' processed</div></div><div class="row">' + batchStatusTag(job.status) + (b.running ? '<button class="btn sm" data-act="batch-stop">Pause after current items</button>' : '<button class="btn sm primary" data-act="batch-run"' + (job.processed >= job.total ? ' disabled' : '') + '>Resume generation</button>') + (job.ready ? '<button class="btn sm cy" data-act="batch-approve-ready"' + (S.busy['batch-approve-all'] ? ' disabled' : '') + '>Approve clean defaults (' + job.ready + ')</button>' : '') + '</div></div><progress class="batchProgress mtS" max="100" value="' + pct + '" aria-label="Batch generation progress">' + pct + '%</progress><p class="tiny dim mtS">' + pct + '% · ' + job.ready + ' clean · ' + job.attention + ' exception' + (job.attention === 1 ? '' : 's') + ' · ' + job.failed + ' failed. Approved documents are preserved when one item is regenerated.</p></div>';
		html += '<div class="panel"><div class="tblWrap"><table class="lib batchTable"><thead><tr><th>Program</th><th>Default / override</th><th>Status</th><th>Attempt</th><th></th></tr></thead><tbody>' + (job.items || []).map(function (item) {
			var label = item.programName || item.programSpecialtyId, canReview = item.runId && ['READY','NEEDS_ATTENTION','RESEARCH_NEEDED'].indexOf(item.status) !== -1;
			return '<tr><td><div class="libTitle">' + esc(label) + '</div><div class="tiny dim">' + (item.goldStarred ? '★ Gold · ' : '') + (item.priorityPosition ? 'Priority #' + item.priorityPosition + ' · ' : '') + esc(item.programSpecialtyId) + (item.acgmeId ? ' · ACGME ' + esc(item.acgmeId) : '') + '</div></td><td><div class="seg"><button data-act="batch-tier" data-item="' + item.itemUuid + '" data-tier="DEEP" class="' + (item.tierRequested === 'DEEP' ? 'on' : '') + '"' + (item.status === 'PROCESSING' ? ' disabled' : '') + '>Deep</button><button data-act="batch-tier" data-item="' + item.itemUuid + '" data-tier="ESSENTIAL" class="' + (item.tierRequested === 'ESSENTIAL' ? 'on' : '') + '"' + (item.status === 'PROCESSING' ? ' disabled' : '') + '>Essential</button></div></td><td>' + batchStatusTag(item.status) + (item.approvedDocUuid ? ' <span class="tag ok">Approved</span>' : '') + (item.lastErrorCode ? '<div class="tiny rd">' + esc(item.lastErrorCode) + '</div>' : '') + '</td><td class="small mid">' + item.attemptCount + ' / ' + item.maxAttempts + '</td><td><div class="row">' + (canReview ? '<button class="btn sm" data-act="batch-review" data-item="' + item.itemUuid + '" data-id="' + esc(item.programSpecialtyId) + '">Review</button>' : '') + (item.status === 'READY' && !item.approvedDocUuid ? '<button class="btn sm cy" data-act="batch-approve" data-item="' + item.itemUuid + '">Approve default</button>' : '') + '</div></td></tr>';
		}).join('') + '</tbody></table></div></div>';
		return html;
	}
	function viewLibrary() {
		var docs = S.boot.library, html = head('Prototype library', 'Saved <em>complete</em> statements', 'Stored in the prototype’s own tables. Nothing here counts toward File Vault limits, review queues, journey slots or activity.');
		if (!docs.length) { return html + '<div class="notice mt">Nothing saved yet. Approve a preview and it appears here.</div>'; }
		html += '<div class="panel mt"><div class="spread"><p class="small mid">Download one, a selected set, or every approved statement. The ZIP includes body-only DOCX files plus a metadata manifest.</p><div class="row"><button class="btn sm" data-act="bulk-selected"' + (S.busy.bulk ? ' disabled' : '') + '>Download selected</button><button class="btn sm cy" data-act="bulk-approved"' + (S.busy.bulk ? ' disabled' : '') + '>Download All approved</button></div></div><div class="tblWrap mtS"><table class="lib"><thead><tr><th><span class="srOnly">Select</span></th><th>Statement</th><th>Tier</th><th>Status</th><th>Saved</th><th></th></tr></thead><tbody>' + docs.map(function (d) {
			return '<tr><td><input type="checkbox" data-doc-select="' + d.docUuid + '" aria-label="Select ' + esc(d.title) + '"' + (S.selectedDocs[d.docUuid] ? ' checked' : '') + '></td><td><div class="libTitle">' + esc(d.title) + '</div><div class="tiny dim">' + esc(d.rootLabel) + ' · ' + esc([d.city, d.state].filter(Boolean).join(', ')) + '</div></td><td><span class="tag ' + (d.tier === 'DEEP' ? 'vi' : 'em') + '">' + esc(d.tier) + '</span></td><td>' + statusTag(d.status) + '</td><td class="small mid">' + esc(d.createdAt) + ' UTC</td><td><div class="row"><button class="btn sm" data-act="open-doc" data-uuid="' + d.docUuid + '">View</button><a class="btn sm cy" href="' + esc(download(d.docUuid, 'docx')) + '">DOCX</a><a class="btn sm" href="' + esc(download(d.docUuid, 'txt')) + '">TXT</a></div></td></tr>';
		}).join('') + '</tbody></table></div></div>';
		return html;
	}
	function viewDoc() {
		var d = S.doc; if (!d) { return viewLibrary(); }
		var idx = d.metadata && d.metadata.regionIndex != null ? d.metadata.regionIndex : -1, m = d.metadata || {};
		var html = head('Prototype library', esc(d.programName), esc(d.title));
		html += '<div class="panel mt"><div class="spread"><div class="row">' + statusTag(d.status) + '<span class="tag ' + (d.tier === 'DEEP' ? 'vi' : 'em') + '">' + esc(d.tier) + '</span>' + (m.rootIsSynthetic ? '<span class="tag cy">Synthetic ROOT</span>' : '') + '</div><div class="row"><a class="btn sm cy" href="' + esc(download(d.docUuid, 'docx')) + '">Download DOCX</a><a class="btn sm" href="' + esc(download(d.docUuid, 'txt')) + '">Download TXT</a>' + (d.status !== 'APPROVED' ? '<button class="btn sm primary" data-act="doc-status" data-uuid="' + d.docUuid + '" data-status="APPROVED">Approve</button>' : '<button class="btn sm" data-act="doc-status" data-uuid="' + d.docUuid + '" data-status="DRAFT">Back to draft</button>') + (d.status !== 'ARCHIVED' ? '<button class="btn sm ghost" data-act="doc-status" data-uuid="' + d.docUuid + '" data-status="ARCHIVED">Archive</button>' : '') + '</div></div><p class="tiny dim mtS">Downloads contain the statement body only. Metadata stays here.</p></div>';
		html += '<div class="previewGrid mt"><div class="paper">' + d.paragraphs.map(function (p, i) { return '<div class="para ' + (i === idx ? 'region' : 'locked') + '"><span class="pn">' + (i + 1) + '</span>' + (i === idx ? '<div class="paraFlag">Program-specific paragraph</div>' : '') + esc(p) + '</div>'; }).join('') + '</div>';
		html += '<div class="side"><div class="panel"><dl class="kv"><dt>Specialty</dt><dd>' + esc(d.specialtyLabel) + '</dd><dt>Program</dt><dd>' + esc(d.programName) + '<br><span class="small mid">' + esc([d.city, d.state].filter(Boolean).join(', ')) + '</span></dd><dt>Verified ID</dt><dd class="mono">ACGME ' + esc(d.acgmeId || 'n/a') + '<br>' + esc(d.programSpecialtyId) + '</dd><dt>ROOT version</dt><dd>' + esc(d.rootLabel) + '<br><span class="mono">' + esc((m.rootTextSha256 || '').slice(0, 16)) + '…</span></dd><dt>Generated</dt><dd>v' + d.versionNumber + ' · ' + esc(d.createdAt) + ' UTC</dd><dt>Approach</dt><dd>' + esc(STRATEGY[m.strategy] || m.strategy || '') + '</dd><dt>Writer</dt><dd>' + esc(m.provider || '') + ' ' + esc(m.model || '') + '</dd><dt>Evidence</dt><dd class="mono">' + esc((m.bundleSha256 || '').slice(0, 16)) + '… · ' + esc(m.registryReleaseId || '') + '</dd><dt>Text hash</dt><dd class="mono">' + esc(d.fullTextSha256.slice(0, 24)) + '…</dd></dl></div></div></div>';
		html += '<div class="footBar"><button class="btn ghost" data-act="go" data-view="library">← Library</button></div>';
		return html;
	}

	/* ---------- render + events ---------- */
	function render() {
		if (!S.boot) { return; }
		var views = { home: viewHome, root: viewRoot, region: viewRegion, prefs: viewPrefs, programs: viewPrograms, generate: viewGenerate, preview: viewPreview, batch: viewBatch, library: viewLibrary, doc: viewDoc };
		var keep = document.activeElement && document.activeElement.getAttribute ? { search: document.activeElement.hasAttribute('data-search') } : {};
		app.innerHTML = header() + '<div class="protoBar"><strong>PSV-PROTOTYPE-0001</strong><span>Founder review build. Visible to allowlisted accounts only. Separate storage; File Vault records are never written.</span></div><div class="shell">' + rail() + '<main class="main"><div class="view' + (render.last !== S.view ? ' enter' : '') + '">' + (views[S.view] || viewHome)() + '</div></main></div>' + (S.toast ? '<div class="toast ' + S.toast.kind + '" role="status">' + esc(S.toast.message) + '</div>' : '');
		render.last = S.view;
		if (keep.search) { var el = app.querySelector('[data-search]'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }
	}

	app.addEventListener('click', function (event) {
		var el = event.target.closest('[data-act]'); if (!el || el.disabled) { return; }
		var act = el.getAttribute('data-act'), id = el.getAttribute('data-id');
		if (act === 'go') { if (el.getAttribute('data-view') === 'library') { refreshBoot(); } go(el.getAttribute('data-view')); }
		else if (act === 'jump') { var target = app.querySelector('.para.region, .insertSlot.on'); if (target) { target.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }
		else if (act === 'open-root') { openRoot(id); }
		else if (act === 'source') { S.rootForm.source = el.getAttribute('data-source'); render(); }
		else if (act === 'pick-file') { S.rootForm.fileKey = el.getAttribute('data-key'); render(); }
		else if (act === 'pick-synthetic') { S.rootForm.syntheticKey = el.getAttribute('data-key'); render(); }
		else if (act === 'create-root') { createRoot(); }
		else if (act === 'region-mode') { S.regionDraft = { mode: el.getAttribute('data-mode'), index: null }; if (S.regionDraft.mode === 'REPLACE_PARAGRAPH' && S.detection && S.detection.proposedIndex != null) { S.regionDraft.index = S.detection.proposedIndex; } render(); }
		else if (act === 'region-pick') { S.regionDraft.index = parseInt(el.getAttribute('data-index'), 10); render(); }
		else if (act === 'save-region') { saveRegion(); }
		else if (act === 'cat') { S.prefs.categories[el.getAttribute('data-key')].on = el.getAttribute('data-on') === '1'; render(); }
		else if (act === 'term') { var terms = S.prefs.categories[el.getAttribute('data-key')].terms, term = el.getAttribute('data-term'), at = terms.indexOf(term); if (at !== -1) { terms.splice(at, 1); } else if (terms.length < 6) { terms.push(term); } else { toast('Up to six per category.', 'err'); return; } render(); }
		else if (act === 'loc') { S.prefs.location.on = el.getAttribute('data-on') === '1'; render(); }
		else if (act === 'state-remove') { S.stateCodes = S.stateCodes.filter(function (c) { return c !== el.getAttribute('data-code'); }); render(); }
		else if (act === 'save-prefs') { savePrefs(); }
		else if (act === 'retry-list') { refreshBoot(); loadMyPrograms(0); if (S.search.status === 'error') { S.search.status = 'idle'; } }
		else if (act === 'more-list') { loadMyPrograms(S.list.programs.length); }
		else if (act === 'search') { runSearch(); }
		else if (act === 'toggle-program') { var rec = null; S.search.results.forEach(function (p) { if (p.programSpecialtyId === id) { rec = p; } }); toggleProgram(id, rec); }
		else if (act === 'tier') { S.tiers[id] = el.getAttribute('data-tier'); render(); }
		else if (act === 'generate') { generate(id).then(function () { if (S.view === 'preview') { S.current = id; render(); } }, function () {}); }
		else if (act === 'generate-essential') { S.tiers[id] = 'ESSENTIAL'; generate(id, 'ESSENTIAL').then(function () { render(); }, function () {}); }
		else if (act === 'generate-all') { generateAll(); }
		else if (act === 'open-run') { S.current = id; go('preview'); }
		else if (act === 'select-candidate') { selectCandidate(S.runs[S.current], el.getAttribute('data-candidate')); }
		else if (act === 'save') { save(el.getAttribute('data-status')); }
		else if (act === 'research-prompt') { researchPrompt(id); }
			else if (act === 'copy-prompt') { copyText(S.prompt[id] || ''); }
			else if (act === 'batch-import') { loadBatchIndex(); }
			else if (act === 'batch-create') { createBatch(); }
			else if (act === 'batch-open') { openBatch(id); }
			else if (act === 'batch-run') { runBatch(); }
			else if (act === 'batch-stop') { stopBatch(); }
			else if (act === 'batch-tier') { var bi = (S.batch.current.items || []).filter(function (x) { return x.itemUuid === el.getAttribute('data-item'); })[0]; if (bi) { batchTier(bi, el.getAttribute('data-tier')); } }
			else if (act === 'batch-review') { var br = (S.batch.current.items || []).filter(function (x) { return x.itemUuid === el.getAttribute('data-item'); })[0]; if (br) { openBatchRun(br); } }
			else if (act === 'batch-approve') { var ba = (S.batch.current.items || []).filter(function (x) { return x.itemUuid === el.getAttribute('data-item'); })[0]; if (ba) { approveBatchItem(ba); } }
			else if (act === 'batch-approve-ready') { approveBatchReady(); }
			else if (act === 'bulk-selected') { bulkDownload(false); }
			else if (act === 'bulk-approved') { bulkDownload(true); }
			else if (act === 'open-doc') { openDoc(el.getAttribute('data-uuid')); }
		else if (act === 'doc-status') { setDocStatus(el.getAttribute('data-uuid'), el.getAttribute('data-status')); }
	});
	app.addEventListener('keydown', function (event) {
		var t = event.target;
		if (event.key === 'Enter' && t.hasAttribute && t.hasAttribute('data-add')) { event.preventDefault(); var terms = S.prefs.categories[t.getAttribute('data-add')].terms, v = t.value.trim(); if (v && terms.indexOf(v) === -1) { if (terms.length >= 6) { toast('Up to six per category.', 'err'); return; } terms.push(v); render(); } }
		else if (event.key === 'Enter' && t.hasAttribute && t.hasAttribute('data-search')) { event.preventDefault(); runSearch(); }
		else if ((event.key === 'Enter' || event.key === ' ') && t.getAttribute && t.getAttribute('role') === 'button') { event.preventDefault(); t.click(); }
	});
	app.addEventListener('input', function (event) {
		var t = event.target;
		if (t.hasAttribute('data-bind')) { var k = t.getAttribute('data-bind'); if (t.type === 'checkbox') { S.rootForm[k] = t.checked; } else { S.rootForm[k] = t.value; } if (k === 'text') { var btn = app.querySelector('[data-act="create-root"]'); if (btn) { btn.disabled = t.value.trim().length <= 200; } } }
		else if (t.hasAttribute('data-note')) { S.prefs.categories[t.getAttribute('data-note')].note = t.value; }
		else if (t.hasAttribute('data-cities')) { S.prefs.location.cities = t.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 8); }
		else if (t.hasAttribute('data-loc-reason')) { S.prefs.location.reason = t.value; }
		else if (t.hasAttribute('data-search')) { S.search.q = t.value; }
	});
	app.addEventListener('change', function (event) {
		var t = event.target;
		if (t.hasAttribute('data-state-add')) { if (t.value && S.stateCodes.indexOf(t.value) === -1) { if (S.stateCodes.length >= 8) { toast('Up to eight states.', 'err'); return; } S.stateCodes.push(t.value); } render(); }
		else if (t.hasAttribute('data-loc-mention')) { S.prefs.location.mayMention = t.checked; }
			else if (t.hasAttribute('data-show-original')) { S.showOriginal = t.checked; render(); }
			else if (t.hasAttribute('data-doc-select')) { S.selectedDocs[t.getAttribute('data-doc-select')] = t.checked; }
		else if (t.hasAttribute('data-bind') && t.tagName === 'SELECT') { S.rootForm[t.getAttribute('data-bind')] = t.value; }
	});

	boot();
})();
