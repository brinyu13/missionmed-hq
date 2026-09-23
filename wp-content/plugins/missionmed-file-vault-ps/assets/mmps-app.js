/* MissionMed File Vault · Program-Specific PS. Vanilla JS, no build, no inline styles (strict CSP). */
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
	var CORE_FACTORS = [
		{ key: 'clinical_training', title: 'Clinical Training & Experience', hint: 'The clinical settings, curriculum and hands-on growth you value.' },
		{ key: 'fellowship_career', title: 'Fellowship / Career Goals', hint: 'Only goals you genuinely named; PSForge never invents one.' },
		{ key: 'mentorship_teaching', title: 'Mentorship & Teaching', hint: 'How you want to learn, teach and receive guidance.' },
		{ key: 'research_academics', title: 'Research & Academics', hint: 'Scholarly work that fits your actual interests.' },
		{ key: 'location_community', title: 'Location & Community', hint: 'Places or communities that matter for a real reason.' },
		{ key: 'culture_environment', title: 'Program Culture / Size / Environment', hint: 'The kind of team and training environment where you thrive.' },
		{ key: 'patient_population_mission', title: 'Patient Population / Mission', hint: 'The people and mission you want your training to serve.' },
		{ key: 'lifestyle_practical', title: 'Lifestyle / Schedule / Practical Fit', hint: 'Schedule and practical features that truly affect fit.' }
	];
	var STATES = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', PR: 'Puerto Rico', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming' };
	var STRATEGY = { TRAINING_ENVIRONMENT: 'Training environment', STUDENT_GOAL_FORWARD: 'Your goals first', RESEARCH_FELLOWSHIP: 'Research or fellowship', LOCATION_PROGRAM_TYPE: 'Location and program setting', BALANCED_QUIET_SPECIFIC: 'Balanced and quietly specific', TRAINING_ENVIRONMENT_FIRST: 'Training environment first', BRIDGE_FROM_EXPERIENCE: 'Bridge from experience', GOAL_FORWARD: 'Goal forward', QUIET_SPECIFIC: 'Quiet and specific', PLACE_AND_PEOPLE: 'Place and people' };
	var MAX_PROGRAMS = 5;

	var S = {
		boot: null, view: 'home', root: null, detection: null,
		rootForm: { source: '', specialty: 'Internal Medicine', text: '', syntheticKey: 'im', fileKey: '', uploadFile: null, uploadName: '' },
		candidates: null, regionDraft: null, prefs: null, stateCodes: [],
		list: { status: 'idle', programs: [], total: 0, error: null }, search: { q: '', specialty: '', state: '', status: 'idle', results: [], error: null },
		programs: {}, selected: [], tiers: {}, runs: {}, current: '', showOriginal: false,
		prompt: {}, doc: null, selectedDocs: {},
		batch: { index: null, current: null, running: false, mode: 'FULL_PARAGRAPH', selected: {} },
		boost: {}, myEras: { screen: 'entry', plan: null, provider: '', packageMode: '', lastPackage: null, manualIndex: 0, manualProgress: {}, completion: null }, admin: { tab: 'home', loaded: false, prompts: null, research: [], importText: '', qaNotes: {} }, busy: {}, toast: null
	};

	/* ---------- utilities ---------- */
	function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
	function trainingLabel(item) {
		if (item.trainingType) { return item.trainingType; }
		if (item.trainingTypeStatus === 'AMBIGUOUS') { return 'Choose the training type in MyERAS'; }
		return 'Training type not yet available from RISE';
	}
	function nrmpLabel(item) {
		if (item.nrmpCode) { return 'NRMP ' + item.nrmpCode; }
		if (item.nrmpTrackStatus === 'AMBIGUOUS') { return 'Choose the NRMP track in MyERAS'; }
		return 'NRMP track needs confirmation';
	}
	function myErasIdentityLabel(item) { return item.myErasIdentityStatus === 'RESOLVED' ? 'MyERAS identity confirmed' : 'Confirm this program and track in MyERAS'; }
	var nonceRefresh = null;
	function sessionExpired() {
		var err = new Error('Your MissionMed session changed or expired. Your text is still on this page. Sign in again in another tab, then return here and retry.');
		err.code = 'mmps_session_expired'; err.status = 403; return err;
	}
	function refreshNonce() {
		if (nonceRefresh) { return nonceRefresh; }
		var pageUrl = new URL(window.location.href);
		pageUrl.searchParams.set('mmed_ps_proto', '1');
		pageUrl.searchParams.set('mmps_nonce_refresh', String(Date.now()));
		nonceRefresh = fetch(pageUrl.toString(), { method: 'GET', credentials: 'same-origin', headers: { 'Accept': 'text/html' }, cache: 'no-store' }).then(function (res) {
			if (!res.ok) { throw sessionExpired(); }
			return res.text();
		}).then(function (html) {
			var doc = new DOMParser().parseFromString(html, 'text/html'), el = doc.getElementById('mmps-config'), fresh;
			if (!el) { throw sessionExpired(); }
			try { fresh = JSON.parse(el.textContent); } catch (e) { throw sessionExpired(); }
			if (!fresh || typeof fresh.nonce !== 'string' || !fresh.nonce || String(fresh.restUrl || '').replace(/\/$/, '') !== String(cfg.restUrl || '').replace(/\/$/, '')) { throw sessionExpired(); }
			cfg.nonce = fresh.nonce;
			return true;
		});
		nonceRefresh = nonceRefresh.then(function (value) { nonceRefresh = null; return value; }, function (err) { nonceRefresh = null; throw err; });
		return nonceRefresh;
	}
	function api(method, path, body, retried) {
		var opts = { method: method, credentials: 'same-origin', headers: { 'X-WP-Nonce': cfg.nonce, 'Accept': 'application/json' }, cache: 'no-store' };
		if (body !== undefined) {
			if (window.FormData && body instanceof FormData) { opts.body = body; }
			else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
		}
		return fetch(cfg.restUrl.replace(/\/$/, '') + path, opts).then(function (res) {
			return res.text().then(function (text) {
				var data = null;
				try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
				if (!res.ok) {
					if (!retried && data && data.code === 'rest_cookie_invalid_nonce') { return refreshNonce().then(function () { return api(method, path, body, true); }); }
					var err = data && data.code === 'rest_cookie_invalid_nonce' ? sessionExpired() : new Error((data && data.message) || ('Request failed (' + res.status + ').'));
					err.code = err.code || (data && data.code) || 'http_' + res.status; err.status = res.status; err.data = data && data.data ? data.data : {}; throw err;
				}
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
		var p = { schema: 'missionmed.psv.preferences.v2', priorityProfile: [], categories: {}, location: { on: false, states: [], cities: [], reason: '', mayMention: false }, otherText: '' };
		CATS.forEach(function (c) { p.categories[c.key] = { on: false, terms: [], note: '' }; });
		return p;
	}
	function loadPrefs(root) {
		var p = blankPrefs(), saved = root && root.prefs && root.prefs.categories ? root.prefs : null;
		if (saved) {
			p.priorityProfile = (saved.priorityProfile || []).map(function (x) { return { key: x.key, label: x.label || '', details: (x.details || []).slice(), note: x.note || '' }; }).filter(function (x) { return CORE_FACTORS.some(function (f) { return f.key === x.key; }); });
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
	function go(view) {
		var mounted=app.querySelector('[data-review-run]');
		if (mounted && review.runs[mounted.getAttribute('data-review-run')]) { review.runs[mounted.getAttribute('data-review-run')].scroll=window.scrollY; }
		S.view = view; render(); window.scrollTo(0,view==='preview' && S.runs[S.current] ? reviewState(S.runs[S.current]).scroll : 0);
		if (view === 'programs' && S.list.status === 'idle') { loadMyPrograms(0); } if (view === 'root' && !S.candidates) { loadCandidates(); } if (view === 'batch' && !S.batch.index) { loadBatchIndex(); } if (view === 'admin' && !S.admin.loaded) { loadAdmin(); }
	}

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
		api('GET', '/roots/' + id).then(function (data) {
			adoptRoot(data);
			var summary = (S.boot.roots || []).filter(function (item) { return String(item.id) === String(id); })[0];
			if (!summary || !summary.reviewRunId) { busy('root', false); go(stepDone('region') ? 'programs' : 'region'); return null; }
			return api('GET', '/runs/' + summary.reviewRunId).then(function (run) {
				var programId = run.program && run.program.programSpecialtyId ? run.program.programSpecialtyId : '';
				if (!programId) { throw new Error('The stored run has no verified program identity.'); }
				S.programs[programId] = { identity: run.program, evidenceQuality: run.evidenceQuality };
				S.selected = [programId]; S.tiers[programId] = run.tierRequested; S.runs[programId] = run; S.current = programId;
				busy('root', false); go('preview');
			});
		}).catch(function (e) { busy('root', false); fail(e); });
	}
	function adoptRoot(data) {
		S.root = data.root; S.detection = data.detection || S.detection;
		S.prefs = loadPrefs(S.root);
		var region = S.root.region && S.root.region.mode ? S.root.region : null;
		S.regionDraft = region ? { mode: region.mode, index: region.paragraphIndex, templateBehavior: region.template && region.template.behavior ? region.template.behavior : 'USE_TEMPLATE', templateText: region.template ? region.template.sourceText : '' } : { mode: 'REPLACE_PARAGRAPH', index: S.detection && S.detection.proposedIndex != null ? S.detection.proposedIndex : null };
		S.runs = {}; S.current = '';
		S.batch.current = null; S.batch.index = null; S.batch.selected = {}; S.batch.running = false;
	}
	function createRoot() {
		var f = S.rootForm, body = { source: f.source, specialtyLabel: f.specialty };
		if (f.source === 'UPLOADED') {
			if (!f.uploadFile) { toast('Choose a DOCX or TXT personal statement.', 'err'); return; }
			var form = new FormData(); form.append('specialtyLabel', f.specialty); form.append('file', f.uploadFile, f.uploadFile.name);
			busy('root', true);
			api('POST', '/roots/upload', form).then(function (data) { adoptRoot(data); busy('root', false); refreshBoot(); go('region'); }).catch(function (e) { busy('root', false); fail(e); });
			return;
		}
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
	function saveTemplate() {
		busy('region', true);
		api('PUT', '/roots/' + S.root.id + '/template', { behavior: S.regionDraft.templateBehavior, text: S.regionDraft.templateText }).then(function (data) { adoptRoot(data); busy('region', false); go('prefs'); }).catch(function (e) { busy('region', false); fail(e); });
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
		var q = S.search.q.trim(), specialty = S.search.specialty || (S.root && S.root.specialtyLabel) || '', state = S.search.state || '';
		if (q.length > 0 && q.length < 3) { toast('Type at least three letters, or clear the text field to browse with the filters.', 'err'); return; }
		if (!q && !specialty && !state) { toast('Enter a program name or choose a specialty or state.', 'err'); return; }
		S.search.status = 'loading'; S.search.error = null; render();
		api('GET', '/rise/search?q=' + encodeURIComponent(q) + '&specialty=' + encodeURIComponent(specialty) + '&state=' + encodeURIComponent(state)).then(function (data) { S.search.status = 'ready'; S.search.results = data.programs; render(); }).catch(function (e) { S.search.status = 'error'; S.search.error = e; render(); });
	}
	function clearSearch() {
		S.search.q = ''; S.search.specialty = (S.root && S.root.specialtyLabel) || ''; S.search.state = ''; S.search.status = 'idle'; S.search.results = []; S.search.error = null; render();
	}
	function toggleProgram(id, identity) {
		var at = S.selected.indexOf(id);
		if (at !== -1) { S.selected.splice(at, 1); render(); return; }
		if (S.selected.length >= MAX_PROGRAMS) { toast('Choose up to ' + MAX_PROGRAMS + ' programs at a time.', 'err'); return; }
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
		if (!run) { return; }
		var chosen = (run.candidates || []).filter(function (candidate) { return candidate.candidateId === candidateId; })[0];
		if (!chosen) { return; }
		rememberEditor(run);
		run.selectedCandidateId = chosen.candidateId;
		run.strategy = chosen.strategy;
		run.replacement = chosen.replacement;
		run.segments = chosen.segments;
		run.paragraphs = chosen.paragraphs;
		run.facts = chosen.facts;
		run.selectedValidation = chosen.validation;
		run.rootIntegrity = chosen.rootIntegrity;
		run.canApprove = chosen.canApprove;
		delete run.similarityReview;
		patchPreview(true);
	}
	function generateAll() {
		var queue = S.selected.filter(function (id) { return !S.runs[id]; });
		busy('all', true);
		(function next() {
			if (!queue.length) { busy('all', false); return; }
			generate(queue.shift()).then(next, function () { busy('all', false); });
		})();
	}
	function save(status, acknowledgeSimilarity) {
		var run = S.runs[S.current];
		var chosen = selectedOption(run), effective = effectiveOption(run, chosen), rs = reviewState(run);
		if (effective.overlay.dirty || effective.overlay.saving || !effective.canApprove || !rs.capabilities || !rs.capabilities.canApprove) { return; }
		var revisionId = effective.head ? effective.head.id : '', selectionKey = chosen.candidateId + '|' + revisionId;
		if (acknowledgeSimilarity && (!run.similarityReview || run.similarityReview.selectionKey !== selectionKey)) { return; }
		busy('save', true);
		api('POST', '/library', { runId: run.runId, candidateId: chosen.candidateId, editRevisionId: effective.head ? effective.head.id : '', status: status, acknowledgeSimilarity: !!acknowledgeSimilarity }).then(function (data) {
			run.saved = data.document; delete run.similarityReview; busy('save', false);
			if (S.boot && Array.isArray(S.boot.library) && !S.boot.library.some(function (doc) { return doc.docUuid === data.document.docUuid; })) { S.boot.library.push(data.document); }
			toast(data.alreadySaved ? 'This run is already in your PS library.' : 'Saved to your PS library as ' + data.document.status + '.', 'ok');
			refreshBoot();
		}).catch(function (e) {
			busy('save', false);
			if (e.code === 'mmps_similarity_review') {
				var now=selectedOption(run), current=effectiveOption(run,now);
				if (S.runs[S.current] !== run || now.candidateId !== chosen.candidateId || (current.head ? current.head.id : '') !== revisionId || current.overlay.dirty) { return; }
				run.similarityReview = { band: (e.data && e.data.similarity) || 'MODERATE', status: status, message: e.message, selectionKey: selectionKey }; render(); return;
			}
			fail(e);
		});
	}
	function researchPrompt(id) {
		busy('prompt', true);
		api('POST', '/research-prompt', { programSpecialtyId: id }).then(function (data) { S.prompt[id] = data; busy('prompt', false); }).catch(function (e) { busy('prompt', false); fail(e); });
	}
	function uploadResearch(id, file) {
		if (!file) { return; }
		if (!/\.md$/i.test(file.name) || file.size < 400 || file.size > 262144) { toast('Choose one .md artifact between 400 bytes and 256 KB.', 'err'); return; }
		var form = new FormData();
		form.append('file', file, file.name); form.append('programSpecialtyId', id); form.append('rootId', S.root ? S.root.id : 0);
		busy('research-upload', true);
		fetch(cfg.restUrl.replace(/\/$/, '') + '/research-artifacts', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'X-WP-Nonce': cfg.nonce, 'Accept': 'application/json' }, body: form }).then(function (res) {
			return res.text().then(function (body) { var data = null; try { data = JSON.parse(body); } catch (e) {} if (!res.ok) { throw new Error((data && data.message) || 'Research upload failed.'); } return data; });
		}).then(function (data) {
			if (!S.prompt[id]) { S.prompt[id] = { prompt: '', artifacts: [] }; }
			S.prompt[id].artifacts = [data.artifact].concat(S.prompt[id].artifacts || []);
			busy('research-upload', false);
			toast(data.artifact.status === 'VALIDATED_PENDING_RISE_OWNER' ? 'Validated and quarantined for RISE-owner intake.' : 'Quarantined. Fix the listed validation issues and upload a new file.', data.artifact.status === 'VALIDATED_PENDING_RISE_OWNER' ? 'ok' : 'err');
		}).catch(function (e) { busy('research-upload', false); fail(e); });
	}
	function boostIssue(id, provider, reissue) {
		busy('boost:' + id, true);
		api('POST', '/research-missions', { programSpecialtyId: id, rootId: S.root ? S.root.id : 0, providerKey: provider || 'another_ai', reissue: !!reissue }).then(function (data) {
			S.boost[id] = data.mission; busy('boost:' + id, false); render();
		}).catch(function (e) { busy('boost:' + id, false); fail(e); });
	}
	function boostLoad(id) {
		api('GET', '/research-missions/current?programSpecialtyId=' + encodeURIComponent(id)).then(function (data) { S.boost[id] = data.mission || null; render(); }).catch(function () { S.boost[id] = null; render(); });
	}
	function boostRefresh(id) {
		var m = S.boost[id]; if (!m) { return; } busy('boost-refresh:' + id, true);
		api('POST', '/research-missions/' + m.missionId + '/refresh', {}).then(function (data) { S.boost[id] = data.mission; busy('boost-refresh:' + id, false); render(); }).catch(function (e) { busy('boost-refresh:' + id, false); fail(e); });
	}
	function boostUpload(id, file) {
		var m = S.boost[id]; if (!m || !file) { return; }
		if (!/\.md$/i.test(file.name) || file.size < 400 || file.size > 262144) { toast('Choose the completed MissionMed .md file (400 bytes–256 KB).', 'err'); return; }
		var form = new FormData(); form.append('file', file, file.name); busy('boost-upload:' + id, true);
		api('POST', '/research-missions/' + m.missionId + '/submit', form).then(function (data) { S.boost[id] = data.mission; busy('boost-upload:' + id, false); toast(data.artifact.validation.valid ? 'Received. MissionMed is verifying the research.' : 'This file needs corrections before it can be used.', data.artifact.validation.valid ? 'ok' : 'err'); render(); }).catch(function (e) { busy('boost-upload:' + id, false); fail(e); });
	}
	function boostDownload(mid) { return cfg.restUrl.replace(/\/$/, '') + '/research-missions/' + mid + '/download?_wpnonce=' + encodeURIComponent(cfg.nonce); }

	function loadAdmin() {
		if (!S.boot.admin) { return; } busy('admin-load', true);
		Promise.all([api('GET', '/admin/prompts'), api('GET', '/admin/research')]).then(function (rows) { S.admin.prompts = rows[0]; S.admin.research = rows[1].items || []; S.admin.loaded = true; busy('admin-load', false); }).catch(function (e) { busy('admin-load', false); fail(e); });
	}
	function adminPromptAction(action, value) {
		busy('admin-action', true); var request;
		if (action === 'import') { try { request = api('POST', '/admin/prompts/import', JSON.parse(S.admin.importText)); } catch (e) { busy('admin-action', false); toast('The prompt package is not valid JSON.', 'err'); return; } }
		else if (action === 'rollback') { request = api('POST', '/admin/prompts/' + encodeURIComponent(value) + '/rollback', {}); }
		else { request = api('POST', '/admin/prompts/' + value + '/' + action, {}); }
		request.then(function () { S.admin.loaded = false; S.admin.importText = ''; busy('admin-action', false); loadAdmin(); toast('Prompt state updated.', 'ok'); }).catch(function (e) { busy('admin-action', false); fail(e); });
	}
	function adminQa(uuid, decision) {
		busy('admin-action', true); api('POST', '/admin/research/' + uuid + '/qa', { decision: decision, note: S.admin.qaNotes[uuid] || '' }).then(function () { S.admin.loaded = false; busy('admin-action', false); loadAdmin(); toast('Research review recorded.', decision === 'PASS' ? 'ok' : 'err'); }).catch(function (e) { busy('admin-action', false); fail(e); });
	}
	function adminRise(uuid, status) {
		busy('admin-action', true); api('POST', '/admin/research/' + uuid + '/rise-status', { status: status, reference: '' }).then(function () { S.admin.loaded = false; busy('admin-action', false); loadAdmin(); toast('RISE-owner state recorded.', 'ok'); }).catch(function (e) { busy('admin-action', false); fail(e); });
	}
	function openDoc(uuid) { api('GET', '/library/' + uuid).then(function (data) { S.doc = data.document; go('doc'); }).catch(fail); }
	function editLibraryDocument(doc) {
		var runId=doc && doc.metadata && doc.metadata.runId;
		if(!runId){toast('This older statement cannot reopen its original writing review. Regenerate it to edit safely.','err');return;}
		busy('library-edit',true);
		Promise.all([api('GET','/roots/'+doc.rootId),api('GET','/runs/'+runId)]).then(function(rows){
			var rootData=rows[0],run=rows[1],programId=run && run.program && run.program.programSpecialtyId;
			if(!rootData || !rootData.root || String(rootData.root.id)!==String(doc.rootId)){throw new Error('The ROOT behind this saved statement could not be verified.');}
			if(!programId || programId!==doc.programSpecialtyId){throw new Error('The saved statement no longer matches its verified program identity.');}
			adoptRoot(rootData);adaptLegacyReview(run);if(doc.metadata.candidateId){run.selectedCandidateId=doc.metadata.candidateId;}
			S.programs[programId]={identity:run.program,evidenceQuality:run.evidenceQuality};S.selected=[programId];S.tiers[programId]=run.tierRequested;S.runs[programId]=run;S.current=programId;
			busy('library-edit',false);go('preview');
		}).catch(function(e){busy('library-edit',false);fail(e);});
	}
	function setDocStatus(uuid, status) { api('POST', '/library/' + uuid + '/status', { status: status }).then(function (data) { if (S.doc && S.doc.docUuid === uuid) { S.doc = Object.assign(S.doc, { status: data.document.status }); } refreshBoot(); }).catch(fail); }
	function copyText(text) {
		if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(function () { toast('Copied.', 'ok'); }, function () { toast('Select the text and copy it manually.', 'err'); }); } else { toast('Select the text and copy it manually.', 'err'); }
	}
	function loadBatchIndex() {
		busy('batch-index', true);
		api('GET', '/rise/my-program-index').then(function (data) { S.batch.index = data; S.batch.selected = {}; (data.programs || []).forEach(function (p) { if (p.bulkEligible) { S.batch.selected[p.programSpecialtyId] = true; } }); busy('batch-index', false); }).catch(function (e) { busy('batch-index', false); fail(e); });
	}
	function createBatch() {
		if (!S.root) { toast('Open the ROOT for this specialty first.', 'err'); return; }
		if (!S.batch.index || !S.batch.index.programs.length) { toast('Import your RISE program list first.', 'err'); return; }
		busy('batch-create', true);
		var programs = S.batch.index.programs.filter(function (p) { return p.bulkEligible && S.batch.selected[p.programSpecialtyId]; }).map(function (p) { return { programSpecialtyId: p.programSpecialtyId, tier: p.defaultTier }; });
		if (!programs.length) { busy('batch-create', false); toast('Select at least one Bulk Rush eligible program.', 'err'); return; }
		api('POST', '/batch/jobs', { rootId: S.root.id, outputMode: S.batch.mode, programs: programs }).then(function (data) {
			S.batch.current = data.job; busy('batch-create', false); refreshBoot();
		}).catch(function (e) { busy('batch-create', false); fail(e); });
	}
	function openBatch(uuid) {
		busy('batch-open', true);
		api('GET', '/batch/jobs/' + uuid).then(function (data) {
			var job = data.job;
			if (S.root && String(S.root.id) === String(job.rootId)) { return null; }
			return api('GET', '/roots/' + job.rootId).then(function (rootData) { adoptRoot(rootData); });
		}).then(function () {
			return api('GET', '/batch/jobs/' + uuid);
		}).then(function (data) {
			S.batch.current = data.job; busy('batch-open', false); go('batch');
		}).catch(function (e) { busy('batch-open', false); fail(e); });
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
				if (data.paused) { stopped = true; S.batch.running = false; render(); toast('Daily AI attempt limit reached. Your queued items are preserved; resume after the UTC day changes.', 'err'); return; }
				if (data.saturated) { return; }
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
	function batchAlternatives(item) {
		busy('batch-alternatives:' + item.itemUuid, true);
		api('POST', '/batch/jobs/' + S.batch.current.jobUuid + '/items/' + item.itemUuid + '/alternatives', {}).then(function (data) {
			S.batch.current = data.job; busy('batch-alternatives:' + item.itemUuid, false);
			var refreshed = (data.job.items || []).filter(function (x) { return x.itemUuid === item.itemUuid; })[0];
			if (refreshed && refreshed.runId) { openBatchRun(refreshed); }
		}).catch(function (e) { busy('batch-alternatives:' + item.itemUuid, false); fail(e); });
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
		fetch(cfg.restUrl.replace(/\/$/, '') + '/library/bulk-download', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'X-WP-Nonce': cfg.nonce, 'Content-Type': 'application/json' }, body: JSON.stringify({ docUuids: allApproved ? [] : ids, allApproved: !!allApproved }) }).then(function (res) {
			if (!res.ok) { return res.json().then(function (d) { throw new Error(d.message || 'Bulk download failed.'); }); }
			return res.blob().then(function (blob) { return { blob: blob, disposition: res.headers.get('content-disposition') || '' }; });
		}).then(function (result) {
			var match = result.disposition.match(/filename="([^"]+)"/), a = document.createElement('a');
			a.href = URL.createObjectURL(result.blob); a.download = match ? match[1] : 'MissionMed_Program_Specific_PS.zip'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000); busy('bulk', false);
		}).catch(function (e) { busy('bulk', false); fail(e); });
	}
	function downloadErasManifest() {
		busy('eras-manifest', true);
		fetch(cfg.restUrl.replace(/\/$/, '') + '/library/eras-manifest', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'X-WP-Nonce': cfg.nonce, 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).then(function (res) { if (!res.ok) { return res.json().then(function (d) { throw new Error(d.message || 'Manifest download failed.'); }); } return res.blob().then(function (blob) { return {blob:blob, disposition:res.headers.get('content-disposition') || ''}; }); }).then(function (result) { var match=result.disposition.match(/filename="([^"]+)"/), a=document.createElement('a'); a.href=URL.createObjectURL(result.blob); a.download=match?match[1]:'MissionMed_ERAS_Assignment_Manifest.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){URL.revokeObjectURL(a.href);},1000); busy('eras-manifest', false); }).catch(function(e){busy('eras-manifest', false); fail(e);});
	}
	function myErasStorageKey(plan) { return 'psforge-myeras-manual:' + String(plan && plan.planSha256 || ''); }
	function restoreMyErasProgress(plan) {
		var saved = null; try { saved = JSON.parse(localStorage.getItem(myErasStorageKey(plan)) || 'null'); } catch (e) { saved = null; }
		if (saved && saved.planSha256 === plan.planSha256 && saved.progress && typeof saved.progress === 'object') { S.myEras.manualProgress = saved.progress; S.myEras.manualIndex = Math.max(0, Number(saved.index) || 0); }
	}
	function saveMyErasProgress() {
		var p=S.myEras.plan;if(!p){return;} try { localStorage.setItem(myErasStorageKey(p),JSON.stringify({planSha256:p.planSha256,index:S.myEras.manualIndex,progress:S.myEras.manualProgress})); } catch(e) {}
	}
	function loadMyErasPlan() { if(S.myEras.plan || S.busy['eras-plan']){return;} busy('eras-plan',true); api('GET','/library/eras-plan').then(function(data){S.myEras.plan=data;restoreMyErasProgress(data);busy('eras-plan',false);render();}).catch(function(e){busy('eras-plan',false);fail(e);}); }
	function downloadMyErasPackage(mode,provider) {
		busy('myeras-package',true);
		fetch(cfg.restUrl.replace(/\/$/, '') + '/library/myeras-package', {method:'POST',credentials:'same-origin',cache:'no-store',headers:{'X-WP-Nonce':cfg.nonce,'Content-Type':'application/json'},body:JSON.stringify({mode:mode,provider:provider})}).then(function(res){if(!res.ok){return res.json().then(function(d){throw new Error(d.message||'The MyERAS file could not be prepared.');});}return res.blob().then(function(blob){return{blob:blob,disposition:res.headers.get('content-disposition')||''};});}).then(function(result){var match=result.disposition.match(/filename="([^"]+)"/),a=document.createElement('a');a.href=URL.createObjectURL(result.blob);a.download=match?match[1]:'PSForge_MyERAS_File.zip';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);S.myEras.provider=provider;S.myEras.packageMode=mode;S.myEras.lastPackage=a.download;S.myEras.screen=mode==='DOUBLE_CHECK'?'double-ready':'bulk-ready';busy('myeras-package',false);render();}).catch(function(e){busy('myeras-package',false);fail(e);});
	}
	function validateMyErasCompletion(file) {
		if(!file){return;} if(file.size>2000000){toast('Choose a PSForge completion file smaller than 2 MB.','err');return;}
		busy('myeras-completion',true);var reader=new FileReader();reader.onload=function(){api('POST','/library/myeras-completion',{content:String(reader.result||'')}).then(function(data){S.myEras.completion=data;S.myEras.screen='results';busy('myeras-completion',false);render();}).catch(function(e){busy('myeras-completion',false);fail(e);});};reader.onerror=function(){busy('myeras-completion',false);toast('That file could not be read.','err');};reader.readAsText(file);
	}
	function advanceManual(status) {
		var p=S.myEras.plan,items=p&&p.manifest?p.manifest.items:[],item=items[S.myEras.manualIndex];if(!item){return;}S.myEras.manualProgress[item.psvDocId]=status;var next=S.myEras.manualIndex+1;while(next<items.length&&S.myEras.manualProgress[items[next].psvDocId]==='COMPLETE'){next++;}S.myEras.manualIndex=Math.min(next,items.length);saveMyErasProgress();render();
	}

	/* ---------- views ---------- */
	function header() {
		var pv = S.boot.provider, pill;
		if (pv.provider === 'openai-responses') { pill = '<span class="pill ok hideS"><span class="dot"></span>AI writer ready</span>'; } else if (pv.provider === 'simulator') { pill = '<span class="pill warn hideS"><span class="dot"></span>Practice writer</span>'; } else { pill = '<span class="pill warn hideS"><span class="dot"></span>Writer not configured</span>'; }
		return '<header class="hdr"><a class="matrixBack" href="' + esc(cfg.backUrl) + '" aria-label="Back to Matrix"><span aria-hidden="true">←</span><span>Back to Matrix</span></a><div class="brand"><span class="brandTitle"><span>PS</span><em>Forge</em></span><span class="brandSub">Program-Specific Personal Statements</span></div><span class="hdrSpace"></span>' +
			'<span class="pill vi">Private · verified access</span>' + pill +
			'<span class="hdrNav"><button class="btn sm ghost" data-act="go" data-view="batch">Batch' + (S.boot.batches && S.boot.batches.length ? ' · ' + S.boot.batches.length : '') + '</button>' +
			'<button class="btn sm ghost" data-act="go" data-view="library">PS Library' + (S.boot.library.length ? ' · ' + S.boot.library.length : '') + '</button>' +
			(S.boot.admin ? '<button class="btn sm ghost" data-act="go" data-view="admin">PSV Admin</button>' : '') +
			'</span></header>';
	}
	function rail() {
		var html = '<nav class="rail" aria-label="Steps"><div class="railLabel">Workflow</div>';
		html += '<button class="stepBtn' + (S.view === 'home' ? ' on' : '') + '" data-act="go" data-view="home"' + (S.view === 'home' ? ' aria-current="step"' : '') + '><span class="stepNum">⌂</span><span><span class="stepName">PSForge</span></span></button>';
		STEPS.forEach(function (s) {
			html += '<button class="stepBtn' + (S.view === s.key ? ' on' : '') + (stepDone(s.key) ? ' done' : '') + '" data-act="go" data-view="' + s.key + '"' + (S.view === s.key ? ' aria-current="step"' : '') + (stepOpen(s.key) ? '' : ' disabled') + '><span class="stepNum">' + (stepDone(s.key) && S.view !== s.key ? '✓' : s.n) + '</span><span><span class="stepName">' + s.name + '</span><br><span class="stepHint">' + s.hint + '</span></span></button>';
		});
		html += '<div class="railSep"></div><button class="stepBtn' + (S.view === 'library' || S.view === 'doc' ? ' on' : '') + '" data-act="go" data-view="library"' + (S.view === 'library' || S.view === 'doc' ? ' aria-current="step"' : '') + '><span class="stepNum">▤</span><span><span class="stepName">PS library</span><br><span class="stepHint">Approved statements</span></span></button><button class="stepBtn' + (S.view === 'myeras' ? ' on' : '') + '" data-act="go" data-view="myeras"' + (S.view === 'myeras' ? ' aria-current="step"' : '') + '><span class="stepNum">✓</span><span><span class="stepName">Prepare MyERAS</span><br><span class="stepHint">Guided assignment plan</span></span></button>';
		html += '<button class="stepBtn' + (S.view === 'batch' ? ' on' : '') + '" data-act="go" data-view="batch"' + (S.view === 'batch' ? ' aria-current="step"' : '') + '><span class="stepNum">⇉</span><span><span class="stepName">Batch workspace</span><br><span class="stepHint">50–100 programs · resumable</span></span></button>';
		if (S.boot.admin) { html += '<div class="railSep"></div><button class="stepBtn' + (S.view === 'admin' ? ' on' : '') + '" data-act="go" data-view="admin"' + (S.view === 'admin' ? ' aria-current="step"' : '') + '><span class="stepNum">⚙</span><span><span class="stepName">PSV Admin</span><br><span class="stepHint">Prompt management</span></span></button>'; }
		if (S.root) { html += '<div class="railSep"></div><div class="railNote"><strong>ROOT</strong><br>' + esc(S.root.specialtyLabel) + '<br>' + esc(S.root.rootLabel) + '</div>'; }
		return html + '</nav>';
	}
	function head(eyebrow, title, lede) { return '<div class="eyebrow">' + eyebrow + '</div><h1 class="h1">' + title + '</h1>' + (lede ? '<p class="lede">' + lede + '</p>' : ''); }

	function viewHome() {
		var b = S.boot, batches = b.batches || [], hasWork = b.roots.length || batches.length, approved = b.library.filter(function (d) { return d.status === 'APPROVED'; }).length, html = '';
		html += '<section class="psforgeHero" aria-labelledby="psforgeTitle"><div class="psforgeForge" aria-hidden="true"><span class="psforgeHeat"></span><span class="psforgeStrike"></span><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="psforgeLockup"><p class="psforgeCreator">DR BRIAN\'S</p><p class="psforgeProgram">MATCH PREP ON-CALL</p><h1 class="psforgeWordmark" id="psforgeTitle">PS<span>Forge</span></h1><p class="psforgeDescriptor">PROGRAM-SPECIFIC PERSONAL STATEMENTS</p></div><div class="psforgePromise"><h2>Your Personal Statement.<br><em>Personalized for every residency program.</em></h2><p>Start with the statement you already trust. PSForge helps you tailor it with verified program facts, review every complete version, and prepare the approved statements for MyERAS.</p></div><div class="psforgeActions"><button class="btn primary psforgePrimary" data-act="go" data-view="root">Start Personalizing</button>' +
			(hasWork ? '<a class="btn psforgeContinue" href="#psforge-resume">Continue My Statements</a>' : (b.library.length ? '<button class="btn psforgeContinue" data-act="go" data-view="library">Continue My Statements</button>' : '')) +
			'<button class="btn ghost" data-act="go" data-view="library">PS Library</button>' +
			(approved ? '<button class="btn cy" data-act="go" data-view="myeras">Prepare for MyERAS <span class="actionCount">' + approved + ' approved</span></button>' : '') +
			'</div><ol class="psforgeJourney" aria-label="How PSForge works"><li><b>1</b><span><strong>Start with your PS</strong><small>Choose your finished statement.</small></span></li><li><b>2</b><span><strong>Choose programs</strong><small>Bring in your RISE list.</small></span></li><li><b>3</b><span><strong>PSForge personalizes</strong><small>Using verified program facts.</small></span></li><li><b>4</b><span><strong>You review</strong><small>Approve every complete statement.</small></span></li><li><b>5</b><span><strong>Prepare MyERAS</strong><small>Use your approved PS Library.</small></span></li></ol></section>';
		if (b.roots.length || (b.batches && b.batches.length)) {
			html += '<div class="panel mt psforgeResume" id="psforge-resume"><div class="panelHead"><div><div class="eyebrow">Continue My Statements</div><div class="h2">Pick up where you left off</div></div></div>' + b.roots.map(function (r) {
				return '<div class="prog"><div><div class="progName">' + esc(r.specialtyLabel) + '</div><div class="progMeta">' + esc(r.rootLabel) + ' · ' + r.paragraphCount + ' paragraphs · ' + r.wordCount + ' words' + (r.regionConfirmed ? ' · region confirmed' : '') + '</div></div><button class="btn sm" data-act="open-root" data-id="' + r.id + '">' + (r.reviewRunId ? 'Review candidates' : 'Open') + '</button></div>';
			}).join('') + (b.batches || []).slice(0, 3).map(function (j) {
				return '<div class="prog"><div><div class="progName">' + esc(j.specialtyLabel) + ' batch</div><div class="progMeta">' + j.processed + ' of ' + j.total + ' processed · ' + esc(String(j.status || '').replace(/_/g, ' ')) + '</div></div><button class="btn sm" data-act="batch-open" data-id="' + j.jobUuid + '">Resume</button></div>';
			}).join('') + '</div>';
		}
		html += '<div class="grid3 mt">' +
			'<div class="panel"><div class="eyebrow">Protected</div><div class="h2 mtS">Your ROOT never changes</div><p class="mid small mtS">Only the region you authorize is rewritten. Every other paragraph is hash-checked against the ROOT before anything is shown or saved.</p></div>' +
			'<div class="panel"><div class="eyebrow">Verified</div><div class="h2 mtS">Facts come from RISE</div><p class="mid small mtS">Each program claim traces to a supplied RISE fact with its source. If RISE cannot support a Deep paragraph, you see “Deep research needed”, never a guess.</p></div>' +
			'<div class="panel"><div class="eyebrow">Private</div><div class="h2 mtS">Your work stays in your account</div><p class="mid small mtS">ROOTs, drafts and approved versions are owner-scoped. Statement prose is never sent to RISE or exposed to another student.</p></div></div>';
		return html;
	}
	function statusPanel() {
		var b = S.boot, pv = b.provider, rows = '';
		rows += '<dt>RISE</dt><dd>' + (b.rise.configured ? (b.rise.sessionPresent ? '<span class="tag ok">Connected</span> student-session read contract' : '<span class="tag em">Open RISE once</span> <a href="' + esc(cfg.riseUrl) + '" target="_blank" rel="noopener">Open RISE</a> in this browser, then reload') : '<span class="tag rd">Not configured</span> RISE origin is not set on this site') + '</dd>';
		rows += '<dt>AI writer</dt><dd>' + (pv.provider === 'openai-responses' ? '<span class="tag ok">Live</span> ' + esc(pv.model) + ' · request storage off' : pv.provider === 'simulator' ? '<span class="tag rd">Simulator</span> clearly labelled placeholder text, not real writing' : '<span class="tag rd">Not configured</span> generation is unavailable') + '</dd>';
		rows += '<dt>Privacy</dt><dd><span class="tag ok">Protected</span> only your confirmed Program Answer region can be written</dd>';
		rows += '<dt>File Vault</dt><dd>' + (b.fileVault.available ? '<span class="tag ok">Connected</span> your own verified Personal Statement versions, read-only' : '<span class="tag">Not available</span> upload a DOCX/TXT or paste your statement') + '</dd>';
		rows += '<dt>Today</dt><dd>' + b.limits.runsToday + ' of ' + b.limits.dailyRunCap + ' generations used</dd>';
		return '<div class="panel mt"><div class="panelHead"><div><div class="eyebrow">System</div><div class="h2">What is live right now</div></div></div><dl class="kv">' + rows + '</dl></div>';
	}

	function viewRoot() {
		var f = S.rootForm, c = S.candidates, pv = S.boot.provider, html = head('Step 1', 'Choose your <em>ROOT</em> statement', 'The ROOT is the finished statement every program version is built from. One ROOT belongs to one specialty.');
		html += '<div class="panel mt"><label class="f">Specialty this ROOT is for<select data-bind="specialty"' + (f.source === 'SYNTHETIC' ? ' disabled' : '') + '>' + SPECIALTIES.map(function (s) { return '<option' + (s === f.specialty ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select></label><p class="tiny dim mtS">Applying to more than one specialty? Create a separate ROOT and program set for each specialty.</p></div>';
		html += '<div class="grid4 mt">';
		html += '<button class="choice' + (f.source === 'FILE_VAULT' ? ' on' : '') + '" data-act="source" data-source="FILE_VAULT"' + (c && c.fileVaultAvailable && c.candidates.length ? '' : ' disabled') + '><span class="choiceTitle">From File Vault <span class="tag gold">Real</span></span><span class="choiceBody">' + (!c ? 'Checking File Vault…' : !c.fileVaultAvailable ? 'File Vault is not readable on this site.' : c.candidates.length ? 'Your own Personal Statement versions, read-only.' : 'No Personal Statement versions found for your account.') + '</span></button>';
		html += '<button class="choice' + (f.source === 'UPLOADED' ? ' on' : '') + '" data-act="source" data-source="UPLOADED"><span class="choiceTitle">Upload document <span class="tag gold">Real</span></span><span class="choiceBody">Choose a clean DOCX or UTF-8 TXT statement directly. The source file is validated, read once and not added to File Vault.</span></button>';
		if (pv.simulatorAllowed) { html += '<button class="choice' + (f.source === 'SYNTHETIC' ? ' on' : '') + '" data-act="source" data-source="SYNTHETIC"><span class="choiceTitle">Practice fixture</span><span class="choiceBody">Internal writing-pipeline diagnostic. It is not part of the normal student workflow.</span></button>'; }
		html += '<button class="choice' + (f.source === 'PASTED' ? ' on' : '') + '" data-act="source" data-source="PASTED"><span class="choiceTitle">Paste text</span><span class="choiceBody">Paste a statement with a blank line between paragraphs. Pasted text is always treated as a real statement.</span></button></div>';
		if (f.source === 'FILE_VAULT' && c) {
			html += '<div class="panel mt"><div class="h2">Pick a version</div><div class="mtS">' + c.candidates.map(function (v) {
				var key = v.fileId + ':' + v.versionNumber;
				return '<button class="choice mtS' + (f.fileKey === key ? ' on' : '') + '" data-act="pick-file" data-key="' + key + '"' + (v.usable ? '' : ' disabled') + '><span class="choiceTitle">' + esc(v.documentName || 'Personal Statement') + ' · v' + v.versionNumber + (v.isFinal ? ' <span class="tag ok">Final</span>' : '') + (v.versionLabel ? ' <span class="tag">' + esc(v.versionLabel) + '</span>' : '') + '</span><span class="choiceBody">' + esc(v.fileName) + (v.uploadedAt ? ' · uploaded ' + esc(v.uploadedAt) : '') + (v.usable ? '' : ' · ' + esc(v.whyNot)) + '</span></button>';
			}).join('') + '</div></div>';
		}
		if (f.source === 'SYNTHETIC' && c && c.synthetics) {
			html += '<div class="panel mt"><div class="h2">Pick a voice</div><div class="grid2 mtS">' + c.synthetics.map(function (x) {
				return '<button class="choice' + (f.syntheticKey === x.key ? ' on' : '') + '" data-act="pick-synthetic" data-key="' + esc(x.key) + '"><span class="choiceTitle">' + esc(x.specialty) + ' practice fixture</span><span class="choiceBody">' + esc(x.label) + ' · ' + x.paragraphCount + ' paragraphs.</span></button>';
			}).join('') + '</div></div>';
		}
		if (f.source === 'UPLOADED') {
			html += '<div class="panel mt"><div class="h2">Upload your finished statement</div><p class="small mid mtS">DOCX or UTF-8 TXT · maximum 5 MB. Pages and PDF should be exported to a clean DOCX first. The original file is read once and is not retained or written to File Vault.</p><label class="uploadPick mtS"><input class="srOnly" type="file" accept=".docx,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" data-root-file><span class="btn cy">Choose document</span><span class="uploadName">' + esc(f.uploadName || 'No file selected') + '</span></label></div>';
		}
		if (f.source === 'PASTED') {
			html += '<div class="panel mt"><label class="f">Statement text<textarea data-bind="text" placeholder="Paste the full statement. Leave a blank line between paragraphs.">' + esc(f.text) + '</textarea></label></div>';
		}
		var ready = f.source === 'SYNTHETIC' || (f.source === 'PASTED' && f.text.trim().length > 200) || (f.source === 'FILE_VAULT' && f.fileKey) || (f.source === 'UPLOADED' && f.uploadFile);
		html += '<div class="footBar"><button class="btn ghost" data-act="go" data-view="home">← Back</button><button class="btn primary" data-act="create-root"' + (ready && !S.busy.root ? '' : ' disabled') + '>' + (S.busy.root ? '<span class="spin"></span>Reading…' : 'Use this ROOT →') + '</button></div>';
		return html;
	}

	function viewRegion() {
		var r = S.root, d = S.regionDraft, det = S.detection || {}, html = head('Step 2', 'Confirm the <em>only</em> part that may change', 'Everything outside the highlighted region is locked. It is hash-checked against your ROOT before any version is shown or saved.');
		if (r.region && r.region.authorization === 'ROOT_TEMPLATE_MARKERS') {
			var template = r.region.template || {}, kind = template.kind === 'BLANK' ? 'Blank paragraph template' : 'Authored paragraph template';
			html += '<div class="notice mt"><strong>' + esc(kind) + ' recognized.</strong> The single paragraph between your *** markers is the authorized Program Answer region. The markers were removed from the protected ROOT; every other paragraph is locked.</div>';
			if (template.kind === 'SLOTTED' && S.boot.contract.slottedTemplatesAvailable === false) {
				html += '<div class="panel mtS"><div class="h2">Authored Mad-Lib templates are temporarily unavailable</div><p class="small mid mtS">We will not guess what belongs in a program-fact slot. Use a revised ROOT with [Program Paragraph Here], or use an ordinary confirmed region. The exact *Your Program* token remains supported.</p></div>';
				html += '<div class="paper mt">' + r.paragraphs.map(function (p, i) { var active = i === r.region.paragraphIndex; return '<div class="para ' + (active ? 'region' : 'locked') + '"><span class="pn">' + (i + 1) + '</span>' + (active ? '<div class="paraFlag">Template held for semantic review</div>' : '') + esc(p) + '</div>'; }).join('') + '</div>';
				html += '<div class="footBar"><button class="btn ghost" data-act="go" data-view="root">← Back</button></div>';
				return html;
			}
			html += '<div class="panel mtS"><div class="eyebrow">Writing behavior</div><div class="seg mtS"><button data-act="template-behavior" data-behavior="USE_TEMPLATE" class="' + (d.templateBehavior === 'USE_TEMPLATE' ? 'on' : '') + '">Use my template</button><button data-act="template-behavior" data-behavior="AI_REWRITE" class="' + (d.templateBehavior === 'AI_REWRITE' ? 'on' : '') + '">AI rewrite this region</button><button data-act="template-behavior" data-behavior="EDIT_TEMPLATE" class="' + (d.templateBehavior === 'EDIT_TEMPLATE' ? 'on' : '') + '">Edit template</button></div><p class="small mid mtS">' + (d.templateBehavior === 'USE_TEMPLATE' ? 'Authored structure stays fixed while verified slot content is hydrated, recast, or omitted safely.' : d.templateBehavior === 'AI_REWRITE' ? 'The writer may replace the whole authorized paragraph, but no protected paragraph.' : 'Revise the one authorized template paragraph below. Use semantic [slots].') + '</p>' + (d.templateBehavior === 'EDIT_TEMPLATE' ? '<label class="f mtS">Authorized template paragraph<textarea data-template-text maxlength="6000">' + esc(d.templateText) + '</textarea></label>' : '') + '</div>';
			html += '<div class="paper mt">' + r.paragraphs.map(function (p, i) { var active = i === r.region.paragraphIndex; return '<div class="para ' + (active ? 'region' : 'locked') + '"><span class="pn">' + (i + 1) + '</span>' + (active ? '<div class="paraFlag">✎ Template-authorized Program Answer · ' + esc(kind) + '</div>' : '') + esc(p) + '</div>'; }).join('') + '</div>';
			html += '<p class="tiny dim mtS">Integrity rule: ' + esc(S.boot.contract.normalizationRule) + ' · ROOT text ' + esc(r.textSha256.slice(0, 16)) + '…</p>';
			html += '<div class="footBar"><button class="btn ghost" data-act="go" data-view="root">← Back</button><button class="btn primary" data-act="save-template"' + (S.busy.region ? ' disabled' : '') + '>' + (S.busy.region ? '<span class="spin"></span>Saving…' : 'Confirm template →') + '</button></div>';
			return html;
		}
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
		var p = S.prefs, selected = p.priorityProfile || [], html = head('Step 3', 'What matters most to <em>you?</em>', 'Choose only what matters, then drag your choices into priority order. MissionMed keeps searching down the list until it finds strong verified reasons.');
		html += '<div class="notice mt"><strong>Your order guides the search, not the answer.</strong> We skip weak or generic facts even when they match a high priority. If RISE cannot support three strong reasons, we say so.</div>';
		html += '<section class="panel mt"><div class="eyebrow">Your priorities</div><div class="h2 mtS">Drag to rank</div><p class="small mid mtS">Put the most important factor first. Use the arrow buttons if you prefer the keyboard.</p><div class="priorityList mtS">';
		if (!selected.length) { html += '<div class="friendlyEmpty">Choose a factor below to begin.</div>'; }
		selected.forEach(function (v, i) { var f=CORE_FACTORS.filter(function(x){return x.key===v.key;})[0]; if(!f){return;} html += '<article class="priorityCard" draggable="true" data-priority-key="'+esc(v.key)+'"><span class="dragHandle" aria-hidden="true">⋮⋮</span><span class="priorityNumber">'+(i+1)+'</span><div class="priorityBody"><strong>'+esc(f.title)+'</strong><span>'+esc(f.hint)+'</span><details><summary>Optional details</summary><label class="f mtS">What specifically matters? <input type="text" data-priority-details="'+esc(v.key)+'" value="'+esc((v.details||[]).join(', '))+'" maxlength="240" placeholder="A few words, separated by commas"></label><label class="f mtS">Why does this matter to you? <input type="text" data-priority-note="'+esc(v.key)+'" value="'+esc(v.note||'')+'" maxlength="200" placeholder="Optional"></label></details></div><div class="priorityActions"><button class="btn sm" data-act="priority-up" data-key="'+esc(v.key)+'" aria-label="Move '+esc(f.title)+' up"'+(i===0?' disabled':'')+'>↑</button><button class="btn sm" data-act="priority-down" data-key="'+esc(v.key)+'" aria-label="Move '+esc(f.title)+' down"'+(i===selected.length-1?' disabled':'')+'>↓</button><button class="btn sm ghost" data-act="priority-remove" data-key="'+esc(v.key)+'">Remove</button></div></article>'; });
		html += '</div></section><section class="mt"><div class="eyebrow">Choose what matters</div><div class="coreGrid mtS">'+CORE_FACTORS.filter(function(f){return !selected.some(function(v){return v.key===f.key;});}).map(function(f){return '<button class="choice" data-act="priority-add" data-key="'+esc(f.key)+'"><span class="choiceTitle">＋ '+esc(f.title)+'</span><span class="choiceBody">'+esc(f.hint)+'</span></button>';}).join('')+'</div></section>';
		html += '<div class="footBar"><button class="btn ghost" data-act="go" data-view="region">← Back</button><button class="btn primary" data-act="save-prefs"' + (S.busy.prefs || !selected.length ? ' disabled' : '') + '>' + (S.busy.prefs ? '<span class="spin"></span>Saving…' : 'Save my priorities →') + '</button></div>';
		return html;
	}

	function riseProblem(err) {
		if (err.code === 'mmps_rise_session_required') { return '<div class="notice gold"><strong>Open RISE once in this browser.</strong> Program data is read through your own RISE student session, so RISE has to be open in this browser first. <a href="' + esc(cfg.riseUrl) + '" target="_blank" rel="noopener">Open RISE</a>, then <button class="btn sm cy" data-act="retry-list">Try again</button></div>'; }
		return '<div class="notice rd"><strong>RISE could not be read.</strong> ' + esc(err.message) + ' <button class="btn sm" data-act="retry-list">Try again</button></div>';
	}
	function programRow(id, identity, extra, selectable) {
		var on = S.selected.indexOf(id) !== -1, rec = S.programs[id] || extra || {}, specialty = identity.designation || '', canSelect = !!(selectable && id && specialty);
		return '<div class="prog' + (on ? ' on' : '') + '"><div><div class="progName">' + esc(programLabel(identity)) + '</div><div class="progMeta">' + esc([specialty || 'Specialty unavailable', placeLabel(identity), identity.acgmeId ? 'ACGME ' + identity.acgmeId : ''].filter(Boolean).join(' · ')) + '</div>' + (identity.institution && identity.institution !== identity.programName ? '<div class="tiny dim mtS">' + esc(identity.institution) + '</div>' : '') + '<div class="row mtS">' + (extra && extra.goldStarred ? '<span class="tag gold">★ Gold</span>' : '') + (extra && extra.priorityPosition ? '<span class="tag gold">Priority #' + extra.priorityPosition + '</span>' : '') + qualityTag(rec.evidenceQuality) + ingredients(rec.essentialHas) + (!canSelect && selectable ? '<span class="tag rd">Identity unavailable</span>' : '') + '</div></div>' + (selectable ? '<button class="btn sm' + (on ? ' primary' : '') + '" data-act="toggle-program" data-id="' + esc(id) + '" aria-pressed="' + (on ? 'true' : 'false') + '"' + (canSelect ? '' : ' disabled') + '>' + (on ? '✓ Selected' : 'Select') + '</button>' : '') + '</div>';
	}
	function viewPrograms() {
		var L = S.list, html = head('Step 4', 'Choose programs from <em>RISE</em>', 'Pick three to five with different evidence depth. Program names, IDs and facts come from RISE; nothing is typed by hand.');
		if (!S.search.specialty && S.root) { S.search.specialty = S.root.specialtyLabel; }
		html += '<div class="panel mt"><div class="panelHead"><div><div class="eyebrow">Your RISE list</div><div class="h2">Priority order, Gold first</div></div><span class="tag">' + S.selected.length + ' of ' + MAX_PROGRAMS + ' selected</span></div>';
		if (L.status === 'loading' && !L.programs.length) { html += '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>'; }
		if (L.status === 'error') { html += riseProblem(L.error); }
		if (L.status === 'ready' && !L.programs.length) { html += '<div class="notice">Your RISE list is empty. Search the RISE registry below, or add programs in RISE first.</div>'; }
		html += L.programs.map(function (p) { return p.error ? '<div class="prog"><div><div class="progName dim">' + esc(p.programSpecialtyId) + '</div><div class="progMeta">Could not be read from RISE (' + esc(p.error) + ')</div></div></div>' : programRow(p.programSpecialtyId, p.identity, p, true); }).join('');
		if (L.status !== 'error' && L.programs.length < L.total) { html += '<div class="row mtS"><button class="btn sm" data-act="more-list"' + (L.status === 'loading' ? ' disabled' : '') + '>' + (L.status === 'loading' ? '<span class="spin"></span>Loading…' : 'Load more (' + (L.total - L.programs.length) + ' left)') + '</button></div>'; }
		html += '</div><div class="panel"><div class="panelHead"><div><div class="eyebrow">RISE registry</div><div class="h2">Find the exact program</div><div class="small mid mtS">Specialty defaults to this ROOT. Results never cross into another specialty unless you deliberately change it.</div></div></div><div class="grid2"><label class="f">Program or institution<input type="search" data-search autocomplete="off" placeholder="Name, institution, city, or ACGME ID" value="' + esc(S.search.q) + '"></label><label class="f">Specialty<select data-search-specialty>' + SPECIALTIES.map(function (specialty) { return '<option' + (specialty === S.search.specialty ? ' selected' : '') + '>' + esc(specialty) + '</option>'; }).join('') + '</select></label><label class="f">State<select data-search-state><option value="">All states</option>' + Object.keys(STATES).map(function (code) { return '<option value="' + code + '"' + (code === S.search.state ? ' selected' : '') + '>' + STATES[code] + '</option>'; }).join('') + '</select></label><div class="row searchActions"><button class="btn primary" data-act="search"' + (S.search.status === 'loading' ? ' disabled' : '') + '>' + (S.search.status === 'loading' ? '<span class="spin"></span>' : '') + 'Find programs</button><button class="btn ghost" data-act="clear-search">Clear</button></div></div>';
		if (S.search.status === 'error') { html += '<div class="mtS">' + riseProblem(S.search.error) + '</div>'; }
		if (S.search.status === 'ready') { html += '<div class="mtS"><div class="tiny dim mbS">' + S.search.results.length + ' verified RISE match' + (S.search.results.length === 1 ? '' : 'es') + '</div>' + (S.search.results.length ? S.search.results.map(function (p) { return programRow(p.programSpecialtyId, p, null, true); }).join('') : '<div class="notice">No programs matched this specialty and state. Change a filter or clear the search.</div>') + '</div>'; }
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
		return '<div tabindex="-1" data-fact-id="' + esc(f.factId) + '" class="fact' + (f.used ? ' used' : '') + '"><div class="factTop"><span class="factLabel">' + esc(f.label) + '</span>' + (f.used ? '<span class="tag gold">Used</span>' : '<span class="tag">Available</span>') + '</div><div class="factText">' + esc(typeof f.value === 'string' && f.value ? f.value : f.text) + '</div><div class="factSrc">' + esc(origin) + ' · ' + esc(ageLabel(pr.ageDays)) + (src ? ' · ' + src : '') + '<br><span class="mono">' + esc(f.factId) + (pr.claimId ? ' · claim ' + esc(pr.claimId) : '') + '</span></div></div>';
	}
	function regionMarkup(run) {
		var joined = (run.segments || []).map(function (s) { return s.text; }).join(' ').replace(/\s+/g, ' ').trim();
		if (!run.segments || !run.segments.length || joined !== run.replacement.replace(/\s+/g, ' ').trim()) { return esc(run.replacement); }
		var labels = {}; (run.facts || []).forEach(function (f) { labels[f.factId] = f.label; });
		return run.segments.map(function (s) {
			if (s.kind === 'program_fact') { return '<button class="seg-fact" data-act="evidence-fact" data-facts="' + esc((s.fact_ids || []).join(',')) + '" aria-label="' + esc(s.text) + ' — inspect verified evidence">' + esc(s.text) + '</button>'; }
			if (s.kind === 'student_link') { return '<span class="seg-link" title="From your own statement or preferences">' + esc(s.text) + '</span>'; }
			return esc(s.text);
		}).join(' ');
	}
	/* Review adapter: AI candidates stay immutable; selection and draft overlays are local. */
	var review = { runs: {}, dialogReturn: null, dialogScroll: 0, pendingLeave: null };
	function reviewState(run) {
		if (!review.runs[run.runId]) { review.runs[run.runId] = { overlays: {}, heads: {}, capabilities: null, loading: false, loaded: false, scroll: 0 }; }
		return review.runs[run.runId];
	}
	function adaptLegacyReview(run) {
		if (run && run.status === 'OK' && (!run.candidates || !run.candidates.length)) {
			var c=Object.assign({},run); c.candidateId=run.selectedCandidateId || run.strategy; c.isRecommended=true; c.rhetoricalFocus='Original saved generation approach'; delete c.candidates;
			run.candidates=[c]; run.selectedCandidateId=c.candidateId; run.legacySingleOption=true;
		}
	}
	function selectedOption(run) { return (run.candidates || []).filter(function (c) { return c.candidateId === run.selectedCandidateId; })[0] || (run.candidates || [])[0] || run; }
	function editOverlay(run, c) {
		var rs = reviewState(run), h = rs.heads[c.candidateId];
		if (!rs.overlays[c.candidateId]) { rs.overlays[c.candidateId] = { text: h && h.action !== 'RESTORE' ? h.text : c.replacement, editing: false, dirty: false, caret: 0, error: '', saving: false }; }
		return rs.overlays[c.candidateId];
	}
	function effectiveOption(run, c) {
		var rs = reviewState(run), o = editOverlay(run, c), h = rs.heads[c.candidateId], changed = o.text !== c.replacement;
		return { overlay: o, head: h, changed: changed, text: o.text, canApprove: !o.dirty && !o.saving && (h ? !!(h.validation && h.validation.canApprove) : !!c.canApprove), validation: h && !o.dirty ? h.validation : null };
	}
	function reviewLabel(run, c) {
		var e = effectiveOption(run, c);
		return (run.candidates.indexOf(c) + 1) + ' of ' + run.candidates.length + ' · ' + (STRATEGY[c.strategy] || c.strategy);
	}
	function editStatus(run, c) {
		var e = effectiveOption(run, c);
		return e.overlay.saving ? 'Checking…' : e.overlay.dirty ? 'Unsaved edits · Your edits need checking' : e.changed && e.canApprove ? 'Your edits · Checked and ready' : e.changed ? 'Your edits · Saved privately · Needs grounding review' : c.isRecommended ? 'Recommended' : c.canApprove ? 'Alternative' : 'Needs review';
	}
	function restrictedReview(run) { return false; }
	function rememberEditor(run) {
		var el = app.querySelector('[data-review-editor]');
		if (el && run) { var o = editOverlay(run, selectedOption(run)); o.text = el.value; o.caret = el.selectionStart; o.caretEnd = el.selectionEnd; }
	}
	function loadReviewEdits(run) {
		var rs = reviewState(run);
		if (rs.loaded || rs.loading) { return; }
		rs.loading = true;
		api('GET', '/runs/' + run.runId + '/edits').then(function (d) {
			rs.heads = d.heads || {}; rs.capabilities = d.capabilities || {}; rs.loaded = true; rs.loading = false;
			// No editing is enabled before this read completes, so acknowledged state cannot overwrite a draft.
			rs.overlays = {}; if (S.runs[S.current] === run && S.view === 'preview') { patchPreview(false); }
		}).catch(function () { rs.loading = false; rs.loaded = true; rs.capabilities = {}; if (S.runs[S.current] === run) { patchPreview(false); } });
	}
	function saveReviewEdit(run, c, restore) {
		var rs = reviewState(run), o = editOverlay(run, c), h = rs.heads[c.candidateId];
		if (!rs.capabilities || !rs.capabilities.canEdit || o.saving) { return Promise.reject(new Error('Editing is unavailable in this review.')); }
		if (selectedOption(run).candidateId === c.candidateId) { rememberEditor(run); }
		var sent = restore ? c.replacement : o.text;
		var body = { candidateId: c.candidateId, text: sent, action: restore ? 'RESTORE' : 'SAVE', baseRevisionId: h ? h.id : '', requestId: o.retry && o.retry.text === sent && o.retry.action === (restore ? 'RESTORE' : 'SAVE') ? o.retry.id : crypto.randomUUID() };
		o.retry = { text: sent, action: body.action, id: body.requestId }; o.saving = true; o.error = '';
		patchPreview(false);
		return api('POST', '/runs/' + run.runId + '/edits', body).then(function (data) {
			if (!data.revision || data.revision.candidateId !== c.candidateId) { throw new Error('Revision acknowledgement did not match this option.'); }
			rs.heads[c.candidateId] = data.revision; o.saving = false; o.retry = null;
			// A delayed response cannot replace newer typing or another candidate's draft.
			if (o.text === sent || restore) { o.text = restore ? c.replacement : data.revision.text; o.dirty = false; o.editing = false; }
			if (S.runs[S.current] === run && S.view === 'preview') { patchPreview(false); }
			return data;
		}).catch(function (err) {
			o.saving = false; o.error = 'Couldn’t save edits. Your changes are still here.' + (err.status === 409 ? ' This revision changed elsewhere; reload after preserving your draft.' : '');
			if (S.runs[S.current] === run && S.view === 'preview') { patchPreview(false); }
			throw err;
		});
	}
	function revalidateReviewEdit(run, c) {
		var rs=reviewState(run), o=editOverlay(run,c), h=rs.heads[c.candidateId];
		if (!h || o.dirty || o.saving || !rs.capabilities || !rs.capabilities.canRevalidate) { return Promise.reject(new Error('Save this draft before checking it.')); }
		var key=h.id, requestId=o.revalidateRetry && o.revalidateRetry.base===key ? o.revalidateRetry.id : crypto.randomUUID();
		o.revalidateRetry={base:key,id:requestId}; o.saving=true; o.error=''; patchPreview(false);
		return api('POST','/runs/'+run.runId+'/edits/revalidate',{candidateId:c.candidateId,baseRevisionId:key,requestId:requestId}).then(function(data){
			if(!data.revision || data.revision.baseRevisionId!==key){throw new Error('Check acknowledgement did not match this draft.');}
			rs.heads[c.candidateId]=data.revision; o.text=data.revision.text; o.saving=false; o.revalidateRetry=null;
			o.error=data.revision.validation && data.revision.validation.canApprove ? 'Checks passed. This exact revision can now be approved.' : 'Checks found items to revise. Open Evidence & checks for details.';
			patchPreview(false); return data;
		}).catch(function(err){o.saving=false;o.error='Couldn’t finish the checks. Your saved draft is unchanged.';patchPreview(false);throw err;});
	}
	function reviewControls(run) {
		var c = selectedOption(run), rs = reviewState(run), e = effectiveOption(run, c), allowed = e.canApprove && !run.saved && !S.busy.save && !restrictedReview(run) && rs.loaded && !!rs.capabilities.canApprove;
		return '<div class="row"><button class="btn sm" data-act="compare-all">Compare all</button><button class="btn sm" data-act="edit-paragraph"' + (rs.capabilities && rs.capabilities.canEdit && c.canApprove && !e.overlay.saving ? '' : ' disabled') + '>Edit this paragraph</button><button class="btn sm ghost" data-act="evidence">Evidence & checks</button></div>' +
			'<p class="small mid mtS">' + (e.changed ? (e.canApprove ? 'This exact edited revision passed fresh grounding, transition and integrity checks.' : 'Edited text has no inherited verification. Approval requires exact-revision grounding checks.') : '<span class="seg-fact">Gold</span> = verified program fact · <span class="seg-link">dotted</span> = applicant context') + '</p>' +
			(rs.loaded && !rs.capabilities.canEdit ? '<p class="small mid">Editing is unavailable in this review.</p>' : '') +
			'<div class="row mtS">' + (e.changed && e.head && !e.overlay.dirty ? '<button class="btn sm" data-act="revalidate-edit"' + (e.overlay.saving || !rs.capabilities.canRevalidate ? ' disabled' : '') + '>Revalidate</button>' : '') + '<button class="btn sm" data-act="save" data-status="DRAFT"' + (allowed ? '' : ' disabled') + '>Save Draft</button><button class="btn sm primary" data-act="save" data-status="APPROVED"' + (allowed ? '' : ' disabled') + '>Approve and save</button>' +
			(e.head || e.changed ? '<button class="btn sm ghost" data-act="restore-ai"' + (e.overlay.saving ? ' disabled' : '') + '>Restore AI version</button>' : '') + '</div>' +
			(run.saved ? '<div class="savedState" role="status"><span class="tag ok">Saved · ' + esc(run.saved.status) + '</span><span class="small">This complete statement is in your PS library.</span></div>' : '') +
			(run.similarityReview ? '<div class="notice gold mtS"><strong>Private similarity review</strong><p>' + esc(run.similarityReview.message) + ' No other student text or identity is available here. Quality comes first; keep the stronger writing after careful review.</p><button class="btn sm" data-act="save" data-status="' + esc(run.similarityReview.status) + '" data-ack="1"' + (allowed ? '' : ' disabled') + '>I reviewed it — keep this version</button></div>' : '');
	}
	function reviewEvidence(run) {
		var c = selectedOption(run), e = effectiveOption(run, c), v = e.validation || c.validation || run.validation || {}, facts = (c.facts || []).slice().sort(function (a,b) { return Number(b.used) - Number(a.used); });
		var flags = (v.blocking || v.flags || []).concat(v.advisory || []).map(function (f) { return '<div class="flag block"><strong>' + esc(f.code || '') + '</strong><span>' + esc(f.message || f) + '</span></div>'; }).join('');
		return '<p class="small">' + (c.rootIntegrity && c.rootIntegrity.ok ? 'Other paragraphs unchanged' : 'Protected ROOT check failed') + '</p>' + (e.changed || e.overlay.dirty ? (e.canApprove ? '<div class="flag good">This exact edited revision passed fresh checks. Original AI annotations were not reused.</div>' + flags : '<div class="flag block">Your edits need grounding review. These facts describe the original AI option, not the changed text.</div>' + flags) : flags || '<div class="flag good">Original candidate passed its server checks.</div>') +
			'<div class="mtS">' + facts.map(factCard).join('') + '</div><p class="tiny dim mtS">Evidence bundle ' + esc(run.bundleSha256 || '') + ' · ' + esc(S.boot.contract.schema) + '</p>';
	}
	function viewPreview() {
		var ids = S.selected.filter(function (id) { return S.runs[id]; });
		if (!S.current || !S.runs[S.current]) { S.current = ids[0] || ''; }
		var run = S.runs[S.current], html = head('Step 6', 'Preview the <em>complete</em> statement', '');
		if (!run) { return html + '<div class="notice mt">Generate at least one program first.</div>'; }
		adaptLegacyReview(run);
		html += '<div class="chips mtS">' + ids.map(function (id) { return '<button class="chip' + (id === S.current ? ' on' : '') + '" data-act="open-run" data-id="' + esc(id) + '">' + esc(programLabel(S.runs[id].program)) + '</button>'; }).join('') + '</div>';
		if (run.status === 'RESEARCH_NEEDED') { return html + researchNeeded(run); }
		var c = selectedOption(run);
		html += '<section class="reviewView" data-review-run="' + esc(run.runId) + '"><div class="reviewEntry mt"><span>Paragraph options · <span data-review-label>' + esc(reviewLabel(run,c)) + '</span></span><div class="row"><button class="btn sm" data-act="jump">Review paragraph</button><button class="btn sm" data-act="compare-all">Compare all</button></div></div><div class="previewGrid reviewGrid mt"><div class="paper">';
		run.paragraphs.forEach(function (p,i) {
			if (i !== run.regionIndex) { html += '<div class="para locked" data-protected-index="' + i + '"><span class="pn">' + (i+1) + '</span>' + esc(p) + '</div>'; return; }
			html += '<section class="para region reviewRegion" aria-label="Program Answer, Paragraph ' + (i+1) + '"><span class="pn">' + (i+1) + '</span><div class="reviewBand"><div class="paraFlag">Program Answer · Paragraph ' + (i+1) + '</div><div class="reviewArrows">' +
				(run.candidates.length > 1 ? '<button class="btn sm" data-act="candidate-prev" aria-label="Previous paragraph option">← Previous</button>' : '') +
				'<span class="small" data-review-ordinal></span>' + (run.candidates.length > 1 ? '<button class="btn sm" data-act="candidate-next" aria-label="Next paragraph option">Next →</button>' : '') +
				'</div><strong class="reviewStrategy" data-review-strategy></strong><span class="tiny reviewState" data-review-status></span></div><p class="tiny mid reviewHelp">Switch options here. The rest of your statement stays unchanged.</p><label class="reviewMobileOptions small">Choose option<select data-review-select>' +
				run.candidates.map(function (o,j) { return '<option value="' + esc(o.candidateId) + '">' + (j+1) + ' · ' + esc(STRATEGY[o.strategy] || o.strategy) + '</option>'; }).join('') +
				'</select></label><div class="reviewText" data-review-text></div><div data-review-edit-actions></div><div class="reviewBottomArrows row">' +
				(run.candidates.length > 1 ? '<button class="btn sm" data-act="candidate-prev" aria-label="Previous paragraph option">← Previous</button><button class="btn sm" data-act="candidate-next" aria-label="Next paragraph option">Next →</button>' : '') +
				'</div><div class="reviewActions" data-review-actions></div>' + (run.originalRegion ? '<details class="reviewOriginal mtS"><summary>View original ROOT paragraph</summary><div class="para old">' + esc(run.originalRegion) + '</div></details>' : '') + '</section>';
		});
		html += '</div><aside class="reviewRail"><section class="reviewNavigator panel" aria-labelledby="writing-choices-title"><h2 class="h2" id="writing-choices-title">Writing choices</h2><div class="candidateChoices reviewChoices mtS" role="radiogroup" aria-label="Program-specific paragraph alternatives">' +
			run.candidates.map(function (o,j) { return '<button class="candidateChoice" role="radio" aria-checked="false" tabindex="-1" data-act="select-candidate" data-candidate="' + esc(o.candidateId) + '"><span class="candidateNumber">' + (j+1) + '</span><span><strong>' + esc(STRATEGY[o.strategy] || o.strategy) + '</strong><span class="tiny" data-choice-status></span><span class="small mid choiceFocus" hidden>' + esc(o.rhetoricalFocus) + '</span></span></button>'; }).join('') +
			'</div></section><details class="panel reviewEvidence" data-review-evidence><summary>Evidence & checks · <span data-review-factcount></span></summary><div class="evidenceBody" tabindex="0" aria-label="Evidence details" data-review-evidence-body></div></details><details class="panel reviewDetails"><summary>Details</summary><dl class="kv mtS"><dt>Program</dt><dd>' + esc(programLabel(run.program)) + '<br>' + esc(placeLabel(run.program)) + '<br>ACGME ' + esc(run.program.acgmeId || '') + '</dd><dt>Tier</dt><dd>' + esc(run.tierEffective) + '</dd><dt>Writer</dt><dd>' + esc(run.model) + '</dd><dt>Run</dt><dd class="mono">' + esc(run.runId) + '</dd><dt>ROOT</dt><dd class="mono">' + esc(run.rootTextSha256 || '') + '</dd></dl>' +
			'<button class="btn sm mtS" data-act="generate" data-id="' + esc(S.current) + '"' + (S.busy['gen:' + S.current] || restrictedReview(run) ? ' disabled' : '') + '>Regenerate (new approach)</button></details></aside></div><div class="srOnly" role="status" aria-live="polite" data-review-announcement></div></section>';
		return html;
	}
	function patchPreview(announce) {
		var run = S.runs[S.current], region = app.querySelector('.reviewRegion');
		if (S.view !== 'preview' || !run || !region || !run.candidates) { return; }
		var c = selectedOption(run), rs = reviewState(run), e = effectiveOption(run,c), anchor = region.getBoundingClientRect().top, text = region.querySelector('[data-review-text]');
		var priorFocus=document.activeElement, priorAction=priorFocus && priorFocus.getAttribute && priorFocus.getAttribute('data-act');
		app.querySelectorAll('[data-review-label]').forEach(function (n) { n.textContent = reviewLabel(run,c); });
		region.querySelector('[data-review-ordinal]').textContent = (run.candidates.indexOf(c)+1) + ' of ' + run.candidates.length;
		region.querySelector('[data-review-strategy]').textContent = STRATEGY[c.strategy] || c.strategy;
		region.querySelector('[data-review-status]').textContent = editStatus(run,c) + (e.changed && c.isRecommended ? ' · Based on recommended option' : '');
		region.querySelector('[data-review-select]').value = c.candidateId;
		var sig = c.candidateId + '|' + (e.overlay.editing ? 'edit' : e.text);
		if (text._signature !== sig) {
			text.innerHTML = e.overlay.editing ? '<label class="f">Program Answer, Paragraph ' + (run.regionIndex+1) + '. Other paragraphs are locked.<textarea data-review-editor aria-describedby="review-edit-message" maxlength="6000">' + esc(e.text) + '</textarea></label>' : '<div class="reviewProse">' + (e.changed ? esc(e.text) : regionMarkup(c)) + '</div>';
			text._signature = sig;
			var editor = text.querySelector('textarea'); if (editor) { editor.setSelectionRange(e.overlay.caret || 0,e.overlay.caretEnd || e.overlay.caret || 0); editor.readOnly = e.overlay.saving; }
		}
		var editorNow = text.querySelector('textarea'); if (editorNow) { editorNow.readOnly = e.overlay.saving; }
		region.querySelector('[data-review-edit-actions]').innerHTML = (e.overlay.editing ? '<div class="row mtS"><button class="btn sm" data-act="save-edits"' + (!e.overlay.dirty || e.overlay.saving ? ' disabled' : '') + '>Save Draft</button><button class="btn sm ghost" data-act="discard-edits"' + (e.overlay.saving ? ' disabled' : '') + '>Discard</button></div>' : '') + '<p id="review-edit-message" class="small mid" role="status">' + esc(e.overlay.error || (e.head && !e.overlay.dirty && !e.overlay.saving ? (e.changed ? (e.canApprove ? 'Checks passed · Ready for approval.' : 'Draft saved · Not approved. Revalidate when ready.') : 'AI version active.') : '')) + '</p>';
		region.querySelector('[data-review-actions]').innerHTML = reviewControls(run);
		app.querySelectorAll('.reviewChoices .candidateChoice').forEach(function (n,j) {
			var selected = run.candidates[j].candidateId === c.candidateId; n.classList.toggle('on',selected); n.setAttribute('aria-checked',String(selected)); n.tabIndex = selected ? 0 : -1;
			n.querySelector('[data-choice-status]').textContent = editStatus(run,run.candidates[j]); n.querySelector('.choiceFocus').hidden = !selected;
		});
		var evidence = app.querySelector('[data-review-evidence]'); evidence.querySelector('[data-review-factcount]').textContent = (c.facts || []).filter(function (f) { return f.used; }).length + ' facts used';
		evidence.querySelector('[data-review-evidence-body]').innerHTML = reviewEvidence(run);
		if (!c.canApprove || e.changed) { evidence.open = true; }
		if (announce) { app.querySelector('[data-review-announcement]').textContent = 'Option ' + reviewLabel(run,c) + ', ' + editStatus(run,c); }
		measureReview(run);
		window.scrollBy(0,region.getBoundingClientRect().top-anchor);
		if (priorFocus && !priorFocus.isConnected && priorAction) {
			var restoreFocus=Array.from(region.querySelectorAll('[data-act]')).filter(function(n){return n.getAttribute('data-act')===priorAction && !n.disabled;})[0] || region.querySelector('[data-act="edit-paragraph"]');
			if(restoreFocus && !restoreFocus.disabled){restoreFocus.focus({preventScroll:true});}
		}
		loadReviewEdits(run);
	}
	var reviewRule = null;
	function measureReview(run) {
		var region = app.querySelector('.reviewRegion'), slot = region && region.querySelector('.reviewText');
		if (!slot) { return; }
		if (!reviewRule) {
			var sheet = Array.from(document.styleSheets).filter(function (s) { return s.href && s.href.indexOf('mmps-app.css') !== -1; })[0];
			if (sheet) { var n = sheet.insertRule('.reviewView { --review-slot: 0px; --review-header: 64px; }',sheet.cssRules.length); reviewRule = sheet.cssRules[n]; }
		}
		var box = document.createElement('div'); box.className = 'reviewMeasure'; box.setAttribute('aria-hidden','true'); box.inert = true;
		slot.appendChild(box);
		var max = 0;
		run.candidates.forEach(function (c) { box.textContent = effectiveOption(run,c).text; max = Math.max(max,box.getBoundingClientRect().height); });
		box.remove();
		if (reviewRule) { reviewRule.style.setProperty('--review-slot',Math.ceil(max)+'px'); reviewRule.style.setProperty('--review-header',(app.querySelector('.hdr').getBoundingClientRect().height+8)+'px'); }
		region.querySelector('.reviewBottomArrows').hidden = max < window.innerHeight * .45;
	}
	function closeReviewDialog() {
		var d = app.querySelector('.reviewDialog'); if (!d) { return; } d.close(); d.remove();
		window.scrollTo(0,review.dialogScroll);
		if (review.dialogReturn && review.dialogReturn.isConnected) { review.dialogReturn.focus({preventScroll:true}); }
	}
	function openReviewDialog(kind, factIds) {
		if (app.querySelector('.reviewDialog')) { return; }
		var run = S.runs[S.current], c = selectedOption(run);
		review.dialogReturn = document.activeElement; review.dialogScroll = window.scrollY;
		var d = document.createElement('dialog'); d.className = 'reviewDialog';
		d.setAttribute('aria-labelledby','review-dialog-title');
		d.innerHTML = '<div class="dialogTop"><h2 class="h2" id="review-dialog-title">' + (kind === 'compare' ? 'Compare paragraph options' : 'Evidence & checks') + '</h2><button class="btn sm" data-act="close-review-dialog" autofocus>Close</button></div>' +
			(kind === 'compare' ? '<p class="small mid">Compare these paragraphs in the statement to judge transitions.</p><div class="compareGrid mtS">' + run.candidates.map(function (o) { var e=effectiveOption(run,o); return '<article class="panel"><h3 class="small">' + esc(reviewLabel(run,o)) + '</h3><p class="tiny mid">' + esc(editStatus(run,o)) + '</p><div class="compareProse mtS">' + esc(e.text) + '</div><button class="btn sm mtS" data-act="compare-read" data-candidate="' + esc(o.candidateId) + '">Read in statement</button></article>'; }).join('') + '</div>' : reviewEvidence(run));
		d.addEventListener('cancel',function (ev) { ev.preventDefault(); closeReviewDialog(); });
		app.appendChild(d); d.showModal();
		if (factIds && factIds.length) { var fact = Array.from(d.querySelectorAll('[data-fact-id]')).filter(function (n) { return n.getAttribute('data-fact-id') === factIds[0]; })[0]; if (fact) { fact.scrollIntoView({block:'nearest'}); fact.focus({preventScroll:true}); } }
	}
	function jumpReview() {
		var n = app.querySelector('.reviewRegion'); if (!n) { return; }
		window.scrollBy(0,n.getBoundingClientRect().top-app.querySelector('.hdr').getBoundingClientRect().height-110);
	}
	function hasReviewDrafts() {
		return Object.keys(review.runs).some(function(id){return Object.keys(review.runs[id].overlays).some(function(c){var o=review.runs[id].overlays[c];return o.dirty || o.saving;});});
	}
	function reviewQuestion(title,body,actions) {
		review.dialogReturn=document.activeElement; review.dialogScroll=window.scrollY;
		var d=document.createElement('dialog'); d.className='reviewDialog reviewQuestion'; d.setAttribute('aria-labelledby','review-dialog-title');
		d.innerHTML='<h2 class="h2" id="review-dialog-title">'+esc(title)+'</h2><p class="mid mtS">'+esc(body)+'</p><div class="row mt">'+actions+'</div><p class="small mtS" role="status" data-question-error></p>';
		d.addEventListener('cancel',function(ev){ev.preventDefault();closeReviewDialog();review.pendingLeave=null;}); app.appendChild(d);d.showModal();
	}
	function confirmReviewRestore() { reviewQuestion('Restore the original AI paragraph?','Your current edits will be removed from this option. The original AI candidate and private revision history are preserved.','<button class="btn" data-act="close-review-dialog" autofocus>Keep edits</button><button class="btn primary" data-act="confirm-restore">Restore AI version</button>'); }
	function reviewLeaveGuard(event,el,act) {
		if(review.leaveBypass || S.view!=='preview' || !hasReviewDrafts() || ['go','open-root','open-run','generate','open-doc','external-link'].indexOf(act)===-1){return false;}
		event.preventDefault(); review.pendingLeave=el;
		reviewQuestion('Keep your paragraph edits?','You have unsaved edits. Save them privately before leaving, discard them, or keep editing. Saving edits does not approve them.','<button class="btn" data-act="leave-keep" autofocus>Keep editing</button><button class="btn" data-act="leave-discard">Discard changes</button><button class="btn primary" data-act="leave-save">Save edits and leave</button>');return true;
	}
	function finishReviewLeave(saveFirst) {
		var run=S.runs[S.current], rs=reviewState(run), pending=review.pendingLeave;
		if(Object.keys(rs.overlays).some(function(id){return rs.overlays[id].saving;})){app.querySelector('[data-question-error]').textContent='Wait for the current save to finish.';return;}
		var dirty=run.candidates.filter(function(c){return rs.overlays[c.candidateId] && rs.overlays[c.candidateId].dirty;});
		var work=saveFirst?dirty.reduce(function(p,c){return p.then(function(){return saveReviewEdit(run,c,false);});},Promise.resolve()):Promise.resolve();
		work.then(function(){if(!saveFirst){dirty.forEach(function(c){delete rs.overlays[c.candidateId];});} closeReviewDialog();review.pendingLeave=null;review.leaveBypass=true;if(pending && pending.isConnected){pending.click();}review.leaveBypass=false;}).catch(function(){var n=app.querySelector('[data-question-error]');if(n){n.textContent='Edits could not all be saved. Stay here; your drafts are retained.';}});
	}
	app.addEventListener('click',function(event){var a=event.target.closest('a[href]');if(a && a.target!=='_blank' && reviewLeaveGuard(event,a,'external-link')){event.stopImmediatePropagation();}},true);
	function researchNeeded(run) {
		var id = S.current, packet = S.prompt[id], html = '<div class="panel gold mt"><div class="row"><span class="tag vi">Deep research needed</span><span class="h2">' + esc(programLabel(run.program)) + '</span></div><p class="mid mtS">' + (run.reasons || []).map(esc).join(' ') + ' Nothing was sent to the AI and nothing was invented.</p>';
		if (run.deepCandidates && run.deepCandidates.length) { html += '<div class="mtS">' + run.deepCandidates.map(function (f) { f.used = false; return factCard(f); }).join('') + '</div>'; }
		if (S.boot.boost && S.boot.boost.enabled) {
			if (!Object.prototype.hasOwnProperty.call(S.boost, id)) { S.boost[id] = false; setTimeout(function () { boostLoad(id); }, 0); }
			var m = S.boost[id], providers = S.boot.boost.providers || [];
			html += '<div class="deepInvite mt"><div><div class="eyebrow">A closer look at a priority program</div><h2>Want MissionMed to know this program much better?</h2><p>Deeper research can uncover faculty and leadership, resident backgrounds, curriculum and training details, fellowship opportunities, research, and distinctive features ordinary residency databases may miss.</p><p class="small">Your Personal Statement and identity are never included in the research mission. You can still use what MissionMed already knows.</p></div></div>';
			if (m === false) { html += '<div class="panel mtS"><span class="spin"></span> Resuming research mission…</div>'; }
			else if (!m) {
				html += '<div class="providerGrid mtS">' + providers.map(function (p) { return '<button class="choice deepChoice" data-act="boost-start" data-id="' + esc(id) + '" data-provider="' + esc(p.key) + '"><span class="choiceTitle">Unlock Deep Research</span><span class="choiceBody">Use ' + esc(p.displayName) + ' for this program. ' + esc(p.rationale) + '</span></button>'; }).join('') + '</div>';
			} else {
				html += '<div class="panel mtS"><div class="spread"><div><div class="eyebrow">Your deeper program profile</div><div class="h2">' + esc(String(m.step || '').replace(/_/g, ' ')) + '</div><p class="small mid mtS">Your place is saved. Return to this program at any time.</p></div><span class="tag cy">' + esc(m.status) + '</span></div><div class="row mtS"><a class="btn primary" href="' + esc(boostDownload(m.missionId)) + '">Download Research Mission (.md)</a><label class="btn"><input class="srOnly" type="file" accept=".md,text/markdown,text/plain" data-boost-file="' + esc(id) + '"' + (S.busy['boost-upload:' + id] ? ' disabled' : '') + '>Upload completed research</label><button class="btn" data-act="boost-refresh" data-id="' + esc(id) + '">Check for Deep readiness</button></div></div>';
			}
			html += '<div class="row mt"><button class="btn" data-act="generate-essential" data-id="' + esc(id) + '">Use what we already know</button></div>';
			return html + '</div>';
		}
		html += '<div class="row mt"><button class="btn primary" data-act="generate-essential" data-id="' + esc(id) + '"' + (S.busy['gen:' + id] ? ' disabled' : '') + '>' + (S.busy['gen:' + id] ? '<span class="spin"></span>Writing…' : 'Write an Essential version instead') + '</button><button class="btn" data-act="research-prompt" data-id="' + esc(id) + '"' + (S.busy.prompt ? ' disabled' : '') + '>Prepare deep research prompt</button><span class="tag cy">Research upload available</span></div>';
		if (packet) {
			html += '<div class="notice vi mt"><strong>Student-powered, authority-safe research.</strong> Run this prompt in Fable, Astra or another strong research agent, save its exact Markdown output, then upload it here. PSForge validates and quarantines it. It does not become evidence until the RISE owner accepts it; meanwhile Essential remains available.</div><pre class="prompt mtS">' + esc(packet.prompt) + '</pre><div class="row mtS"><button class="btn sm cy" data-act="copy-prompt" data-id="' + esc(id) + '">Copy prompt</button><label class="btn sm"' + (S.busy['research-upload'] ? ' aria-disabled="true"' : '') + '><input class="srOnly" type="file" accept=".md,text/markdown,text/plain" data-research-file="' + esc(id) + '"' + (S.busy['research-upload'] ? ' disabled' : '') + '>' + (S.busy['research-upload'] ? '<span class="spin"></span>Validating…' : 'Upload evidence .md') + '</label></div>';
			if ((packet.artifacts || []).length) { html += '<div class="mt">' + packet.artifacts.map(function (a) {
				var valid = a.status === 'VALIDATED_PENDING_RISE_OWNER', issues = (a.validation.errors || []).map(function (e) { return '<li><span class="mono">' + esc(e.code) + '</span> · ' + esc(e.message) + '</li>'; }).join('');
				return '<div class="researchArtifact"><div class="spread"><div><strong>' + esc(a.fileName) + '</strong><div class="tiny dim">' + a.validation.factCount + ' facts · SHA-256 ' + esc(a.sha256.slice(0, 16)) + '… · ' + esc(a.createdAt) + ' UTC</div></div><span class="tag ' + (valid ? 'em' : 'rd') + '">' + (valid ? 'File validated · awaiting RISE acceptance' : 'Quarantined · rejected') + '</span></div>' + (issues ? '<ul class="small rd mtS">' + issues + '</ul>' : '<p class="small mid mtS">The file remains quarantined. Download the validated handoff for the approved RISE-owner intake; PSForge cannot hydrate RISE directly.</p><a class="btn sm mtS" href="' + esc(researchDownload(a.artifactUuid)) + '">Download owner handoff</a>') + '</div>';
			}).join('') + '</div>'; }
		}
		return html + '</div>';
	}

	function download(uuid, format) { return cfg.restUrl.replace(/\/$/, '') + '/library/' + uuid + '/download?format=' + format + '&_wpnonce=' + encodeURIComponent(cfg.nonce); }
	function researchDownload(uuid) { return cfg.restUrl.replace(/\/$/, '') + '/research-artifacts/' + uuid + '/download?_wpnonce=' + encodeURIComponent(cfg.nonce); }
	function statusTag(s) { return '<span class="tag ' + (s === 'APPROVED' ? 'ok' : s === 'ARCHIVED' ? '' : 'em') + '">' + esc(s) + '</span>'; }
	function batchStatusTag(s) {
		var cls = s === 'READY' || s === 'COMPLETE' ? 'ok' : s === 'RESEARCH_NEEDED' || s === 'NEEDS_ATTENTION' || s === 'COMPLETE_WITH_EXCEPTIONS' ? 'gold' : s === 'FAILED' ? 'rd' : 'cy';
		return '<span class="tag ' + cls + '">' + esc(String(s || '').replace(/_/g, ' ')) + '</span>';
	}
	function viewBatch() {
		var b = S.batch, job = b.current, html = head('Batch Rush', 'Personalize the eligible <em>program set</em>', 'Your authenticated RISE list is the source. Gold, high-priority Silver, and uncertain-priority programs stay in explicit High Priority Review.');
		if (!S.root) {
			html += '<div class="notice gold mt"><strong>Choose a specialty ROOT first.</strong> Every batch is isolated to one ROOT, its preferences and its program set. <button class="btn sm cy" data-act="go" data-view="root">Choose ROOT</button></div>';
		} else {
			html += '<div class="panel mt"><div class="spread"><div><div class="eyebrow">Current specialty</div><div class="h2">' + esc(S.root.specialtyLabel) + '</div><p class="small mid mtS">' + esc(S.root.rootLabel) + ' · one specialty and one immutable ROOT per batch.</p></div><span class="tag gold">ROOT ready</span></div></div>';
			if (!job && !b.index) { html += '<div class="panel"><button class="btn cy" data-act="batch-import"' + (S.busy['batch-index'] ? ' disabled' : '') + '>' + (S.busy['batch-index'] ? '<span class="spin"></span>Importing…' : 'Import full RISE program list') + '</button><p class="tiny dim mtS">Only program IDs, list state and priority are imported. Private RISE notes never enter PSForge.</p></div>'; }
			else if (!job) {
				var eligible = b.index.programs.filter(function (p) { return p.bulkEligible; }), protectedRows = b.index.programs.filter(function (p) { return !p.bulkEligible; }), selected = eligible.filter(function (p) { return b.selected[p.programSpecialtyId]; });
				html += '<div class="panel"><div class="spread"><div><div class="eyebrow">Imported from your RISE list</div><div class="h2">' + b.index.programs.length + ' programs verified</div><p class="small mid mtS">' + eligible.length + ' Bulk Rush eligible · ' + protectedRows.length + ' moved to High Priority Review · maximum ' + b.index.limit + '</p></div><span class="tag ok">Owner-scoped</span></div><div class="seg mtS"><button data-act="batch-mode" data-mode="FULL_PARAGRAPH" class="' + (b.mode === 'FULL_PARAGRAPH' ? 'on' : '') + '">Full Paragraph</button><button data-act="batch-mode" data-mode="TOP_3_REASONS" class="' + (b.mode === 'TOP_3_REASONS' ? 'on' : '') + '">Top 3 Reasons</button></div><p class="small mid mtS">' + (b.mode === 'FULL_PARAGRAPH' ? 'One validated recommended paragraph per program. Five alternatives remain available on demand.' : 'Three evidence-backed proposed reasons for review and future interview preparation.') + '</p><div class="spread mt"><strong>' + selected.length + ' eligible programs selected</strong><button class="btn primary" data-act="batch-create"' + (S.busy['batch-create'] || !selected.length ? ' disabled' : '') + '>' + (S.busy['batch-create'] ? '<span class="spin"></span>Creating…' : 'Create resumable batch →') + '</button></div></div>';
				html += '<div class="panel"><div class="eyebrow">Eligible remainder</div><div class="tblWrap mtS"><table class="lib"><thead><tr><th>Select</th><th>RISE program-specialty ID</th><th>Priority</th><th>Default</th></tr></thead><tbody>' + eligible.map(function (p) { return '<tr><td><input type="checkbox" data-batch-select="' + esc(p.programSpecialtyId) + '"' + (b.selected[p.programSpecialtyId] ? ' checked' : '') + ' aria-label="Include priority ' + p.priorityPosition + '"></td><td class="mono">' + esc(p.programSpecialtyId) + '</td><td>#' + p.priorityPosition + '</td><td>Essential</td></tr>'; }).join('') + '</tbody></table></div></div>';
				if (protectedRows.length) { html += '<div class="notice gold"><strong>High Priority Review · ' + protectedRows.length + '</strong><p class="small mtS">Gold, Silver (priority 1–' + esc(S.boot.limits.priorityDeepCutoff) + '), and uncertain-priority programs are excluded from unattended bulk. They remain available in the detailed Program workspace.</p></div>'; }
			}
		}
		if (!job && S.boot.batches && S.boot.batches.length) {
			html += '<div class="panel mt"><div class="panelHead"><div><div class="eyebrow">Resume</div><div class="h2">Recent batches</div></div></div>' + S.boot.batches.map(function (j) { return '<div class="prog"><div><div class="progName">' + esc(j.specialtyLabel) + ' · ' + j.total + ' programs</div><div class="progMeta">' + j.processed + ' processed · ' + j.ready + ' clean · ' + j.attention + ' exceptions · updated ' + esc(j.updatedAt) + ' UTC</div></div><div class="row">' + batchStatusTag(j.status) + '<button class="btn sm" data-act="batch-open" data-id="' + j.jobUuid + '">Open</button></div></div>'; }).join('') + '</div>';
		}
		if (!job) { return html; }
		var pct = job.total ? Math.round(job.processed * 100 / job.total) : 0;
		var topReasons = job.config && job.config.outputMode === 'TOP_3_REASONS';
		var autoReady = (job.items || []).filter(function (item) { return item.status === 'READY' && !item.approvedDocUuid && !item.goldStarred && item.priorityPosition !== null && Number(item.priorityPosition) > 25; }).length;
		html += '<div class="panel mt"><div class="spread"><div><div class="eyebrow">' + (topReasons ? 'Top 3 Reasons' : 'Full Paragraph') + ' · Batch ' + esc(job.jobUuid.slice(0, 8)) + '</div><div class="h2">' + esc(job.specialtyLabel) + ' · ' + job.processed + ' of ' + job.total + ' processed</div></div><div class="row">' + batchStatusTag(job.status) + (b.running ? '<button class="btn sm" data-act="batch-stop">Pause after current items</button>' : '<button class="btn sm primary" data-act="batch-run"' + (job.processed >= job.total ? ' disabled' : '') + '>Resume generation</button>') + (!topReasons && autoReady ? '<button class="btn sm cy" data-act="batch-approve-ready"' + (S.busy['batch-approve-all'] ? ' disabled' : '') + '>Approve clean defaults (' + autoReady + ')</button>' : '') + '</div></div><progress class="batchProgress mtS" max="100" value="' + pct + '" aria-label="Batch generation progress">' + pct + '%</progress><p class="tiny dim mtS">Exceptions are listed first. ' + pct + '% · ' + job.ready + ' clean · ' + job.attention + ' exception' + (job.attention === 1 ? '' : 's') + ' · ' + job.failed + ' failed.</p></div>';
		var orderedItems = (job.items || []).slice().sort(function (a, b) { var order = {RESEARCH_NEEDED:0,NEEDS_ATTENTION:1,FAILED:2,PROCESSING:3,QUEUED:4,READY:5}; return (order[a.status] == null ? 9 : order[a.status]) - (order[b.status] == null ? 9 : order[b.status]); });
		html += '<div class="panel"><div class="tblWrap"><table class="lib batchTable"><thead><tr><th>Program</th><th>' + (topReasons ? 'Verified proposed reasons' : 'Tier') + '</th><th>Status</th><th>Attempt</th><th></th></tr></thead><tbody>' + orderedItems.map(function (item) {
			var label = item.programName || item.programSpecialtyId, canReview = item.runId && ['READY','NEEDS_ATTENTION','RESEARCH_NEEDED'].indexOf(item.status) !== -1;
			var reasons = item.evidence && item.evidence.reasons ? '<ol class="small">' + item.evidence.reasons.map(function (r) { var source = r.sourceUrl ? '<a href="' + esc(r.sourceUrl) + '" target="_blank" rel="noopener noreferrer">source</a>' : esc(r.sourceAuthority || 'verified RISE evidence'); return '<li>' + esc(r.proposedReason) + (r.matchedOn ? ' <span class="tiny dim">Matched: ' + esc(r.matchedOn) + '</span>' : '') + '<div class="tiny dim">' + source + (r.retrievedAt ? ' · ' + esc(r.retrievedAt) : '') + ' · ' + esc(r.factId) + '</div></li>'; }).join('') + '</ol>' : '<span class="small mid">Pending</span>';
			var tierCell = topReasons ? reasons : '<div class="seg"><button data-act="batch-tier" data-item="' + item.itemUuid + '" data-tier="DEEP" class="deep ' + (item.tierRequested === 'DEEP' ? 'on' : '') + '"' + (item.status === 'PROCESSING' ? ' disabled' : '') + '>Deep</button><button data-act="batch-tier" data-item="' + item.itemUuid + '" data-tier="ESSENTIAL" class="' + (item.tierRequested === 'ESSENTIAL' ? 'on' : '') + '"' + (item.status === 'PROCESSING' ? ' disabled' : '') + '>Essential</button></div>';
			var actions = topReasons ? '' : (canReview ? '<button class="btn sm" data-act="batch-review" data-item="' + item.itemUuid + '">Review default</button>' : '') + (item.status === 'READY' && item.evidence && item.evidence.candidateCount === 1 ? '<button class="btn sm" data-act="batch-alternatives" data-item="' + item.itemUuid + '">Review 5 alternatives</button>' : '') + (item.status === 'READY' && !item.approvedDocUuid ? '<button class="btn sm cy" data-act="batch-approve" data-item="' + item.itemUuid + '">Approve default</button>' : '');
			return '<tr><td><div class="libTitle">' + esc(label) + '</div><div class="tiny dim">Priority #' + item.priorityPosition + ' · ' + esc(item.programSpecialtyId) + (item.acgmeId ? ' · ACGME ' + esc(item.acgmeId) : '') + '</div></td><td>' + tierCell + '</td><td>' + batchStatusTag(item.status) + (item.approvedDocUuid ? ' <span class="tag ok">Approved</span>' : '') + (item.lastErrorCode ? '<div class="tiny rd">' + esc(item.lastErrorCode) + '</div>' : '') + '</td><td class="small mid">' + item.attemptCount + ' / ' + item.maxAttempts + '</td><td><div class="row">' + actions + '</div></td></tr>';
		}).join('') + '</tbody></table></div></div>';
		return html;
	}
	function viewLibrary() {
		var docs = S.boot.library, selectedCount = Object.keys(S.selectedDocs).filter(function (id) { return S.selectedDocs[id]; }).length, html = head('PS library', 'Saved <em>complete</em> statements', 'Review and download your approved program-specific statements.');
		if (!docs.length) { return html + '<div class="notice mt">Nothing saved yet. Approve a preview and it appears here.</div>'; }
		html += '<section class="erasLaunch mt"><div><div class="eyebrow">Ready for MyERAS?</div><h2>Prepare My Personal Statements in MyERAS</h2><p>Your approved statements are organized. Choose AI Bulk Setup, Guided Manual Setup, or have AI double-check everything after you finish.</p></div><button class="btn heroBtn primary" data-act="go" data-view="myeras">Choose MyERAS setup</button></section>';
		html += '<div class="panel mt"><div class="spread"><p class="small mid">Download one, a selected set, or every approved statement.</p><div class="row"><button class="btn sm" data-act="bulk-selected"' + (S.busy.bulk || !selectedCount ? ' disabled' : '') + '>Download selected (' + selectedCount + ')</button><button class="btn sm cy" data-act="bulk-approved"' + (S.busy.bulk ? ' disabled' : '') + '>Download All approved</button><details class="advancedDownloads"><summary>Advanced · Technical Downloads</summary><button class="btn sm mtS" data-act="eras-manifest"' + (S.busy['eras-manifest'] ? ' disabled' : '') + '>Raw ERAS assignment manifest</button></details></div></div><div class="tblWrap mtS"><table class="lib"><thead><tr><th><span class="srOnly">Select</span></th><th>Statement</th><th>Tier</th><th>Status</th><th>Saved</th><th></th></tr></thead><tbody>' + docs.map(function (d) {
			return '<tr><td><input type="checkbox" data-doc-select="' + d.docUuid + '" aria-label="Select ' + esc(d.title) + '"' + (S.selectedDocs[d.docUuid] ? ' checked' : '') + '></td><td><div class="libTitle">' + esc(d.programName) + '</div><div class="tiny dim">' + esc(d.specialtyLabel) + (d.metadata && d.metadata.trainingType ? ' · ' + esc(d.metadata.trainingType) : '') + ' · ACGME ' + esc(d.acgmeId || 'n/a') + ' · v' + d.versionNumber + (d.city || d.state ? ' · ' + esc([d.city, d.state].filter(Boolean).join(', ')) : '') + '</div></td><td><span class="tag ' + (d.tier === 'DEEP' ? 'vi' : 'em') + '">' + esc(d.tier) + '</span></td><td>' + statusTag(d.status) + '</td><td class="small mid">' + esc(d.createdAt) + ' UTC</td><td><div class="row"><button class="btn sm" data-act="open-doc" data-uuid="' + d.docUuid + '">View</button><button class="btn sm primary" data-act="library-edit" data-uuid="' + d.docUuid + '">Edit Program Paragraph</button><a class="btn sm cy" href="' + esc(download(d.docUuid, 'docx')) + '">DOCX</a><a class="btn sm" href="' + esc(download(d.docUuid, 'txt')) + '">TXT</a></div></td></tr>';
		}).join('') + '</tbody></table></div></div>';
		return html;
	}
	function viewAdmin() {
		if (!S.boot.admin) { return viewHome(); }
		var a = S.admin, html = head('Administrator mission control', 'PSV <em>Admin</em>', 'Manage deployless writing contracts and the quarantined research-owner queue. Student prose is never shown here.');
		html += '<div class="seg mt" role="tablist"><button class="' + (a.tab === 'home' ? 'on' : '') + '" data-act="admin-tab" data-tab="home">Home</button><button class="' + (a.tab === 'prompts' ? 'on' : '') + '" data-act="admin-tab" data-tab="prompts">Prompt Management</button><button class="' + (a.tab === 'research' ? 'on' : '') + '" data-act="admin-tab" data-tab="research">Research Queue</button></div>';
		if (!a.loaded) { return html + '<div class="panel mt"><span class="spin"></span> Loading admin state…</div>'; }
		if (a.tab === 'home') {
			var production = (a.prompts.versions || []).filter(function (v) { return v.status === 'PRODUCTION'; }).length;
			return html + '<div class="grid3 mt"><button class="choice" data-act="admin-tab" data-tab="prompts"><span class="choiceTitle">Prompt Management</span><span class="choiceBody">' + production + ' explicit Production contracts · immutable versions · rollback ready.</span></button><button class="choice" data-act="admin-tab" data-tab="research"><span class="choiceTitle">Research Queue</span><span class="choiceBody">' + a.research.length + ' quarantined or owner-routed artifacts. No direct RISE writes.</span></button><div class="panel"><div class="eyebrow">Boundary</div><div class="h2 mtS">Security stays in code</div><p class="small mid mtS">ROOT enforcement, evidence validation, access control and privacy are not editable prompt text.</p></div></div>';
		}
		if (a.tab === 'prompts') {
			html += '<div class="notice vi mt"><strong>Safe workflow:</strong> Import as Draft → mark Testing → explicitly promote. Production versions are never edited in place; one-click rollback retains the previous contract.</div>';
			html += '<div class="panel mt"><div class="panelHead"><div><div class="eyebrow">Fable import</div><div class="h2">Install a versioned prompt package</div></div><span class="tag">' + esc(a.prompts.packageSchema) + '</span></div><div class="row"><label class="btn sm"><input class="srOnly" type="file" accept=".json,application/json" data-admin-package>Choose package JSON</label><span class="small mid">or paste it below</span></div><label class="f mtS">Prompt-package JSON<textarea rows="8" data-admin-import placeholder="Paste the structured package JSON. Imported instructions are stored as configuration data; they are never executed here.">' + esc(a.importText) + '</textarea></label><button class="btn primary mtS" data-act="admin-prompt-import"' + (S.busy['admin-action'] ? ' disabled' : '') + '>Validate and import Draft</button><p class="tiny dim mtS">The richer synthetic comparison bench is the next admin increment; it is not required to change or roll back a production contract safely.</p></div>';
			html += '<div class="panel"><div class="tblWrap"><table class="lib"><thead><tr><th>Family / version</th><th>Status</th><th>Created</th><th>Change note</th><th></th></tr></thead><tbody>' + (a.prompts.versions || []).map(function (v) { var actions = v.status === 'DRAFT' ? '<button class="btn sm" data-act="admin-prompt-testing" data-uuid="' + v.versionId + '">Mark Testing</button>' : v.status === 'TESTING' ? '<button class="btn sm primary" data-act="admin-prompt-promote" data-uuid="' + v.versionId + '">Promote</button>' : v.status === 'PRODUCTION' && v.rollbackTargetId ? '<button class="btn sm" data-act="admin-prompt-rollback" data-family="' + esc(v.familyKey) + '">Rollback</button>' : ''; return '<tr><td><div class="libTitle">' + esc((a.prompts.families[v.familyKey] || {}).label || v.familyKey) + '</div><div class="tiny mono">' + esc(v.versionLabel) + ' · ' + esc(v.versionId) + '<br>SHA-256 ' + esc(v.bodySha256.slice(0, 20)) + '…</div><details class="mtS"><summary>View exact prompt body</summary><pre class="prompt">' + esc(v.promptBody) + '</pre></details></td><td>' + statusTag(v.status) + '</td><td class="small">' + esc(v.createdAt) + '<br>' + esc(v.createdByName) + '</td><td class="small">' + esc(v.changeNote) + '</td><td>' + actions + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
			return html;
		}
		html += '<div class="notice gold mt"><strong>Owner boundary:</strong> PSV validates and quarantines. An administrator reviews source support, downloads the narrow handoff, and records the RISE owner’s decision. PSV never hydrates RISE directly.</div>';
		if (!a.research.length) { return html + '<div class="panel mt">No submitted research artifacts.</div>'; }
		html += '<div class="panel mt"><div class="tblWrap"><table class="lib"><thead><tr><th>Program</th><th>Validation</th><th>Owner state</th><th>Actions</th></tr></thead><tbody>' + a.research.map(function (r) { var qa = r.qaStatus === 'QA_PASSED' ? '<span class="tag ok">QA passed</span>' : r.qaStatus === 'QA_FAILED' ? '<span class="tag rd">QA failed</span>' : '<span class="tag em">Source review needed</span>'; var actions = ''; if (r.status === 'VALIDATED_PENDING_RISE_OWNER' || r.qaStatus === 'MANUAL_CONTENT_SOURCE_REVIEW_REQUIRED') { actions += '<textarea class="adminNote" rows="2" data-admin-qa-note="' + r.artifactUuid + '" placeholder="Required reason when failing"></textarea><div class="row"><button class="btn sm primary" data-act="admin-qa" data-decision="PASS" data-uuid="' + r.artifactUuid + '">Pass source review</button><button class="btn sm" data-act="admin-qa" data-decision="FAIL" data-uuid="' + r.artifactUuid + '">Fail</button></div>'; } if (r.qaStatus === 'QA_PASSED') { actions += '<div class="row"><a class="btn sm cy" href="' + esc(cfg.restUrl.replace(/\/$/, '') + '/admin/research/' + r.artifactUuid + '/handoff?_wpnonce=' + encodeURIComponent(cfg.nonce)) + '">Download RISE handoff</a><button class="btn sm" data-act="admin-rise" data-status="RISE_SUBMITTED" data-uuid="' + r.artifactUuid + '">Mark submitted</button><button class="btn sm" data-act="admin-rise" data-status="RISE_PUBLISHED" data-uuid="' + r.artifactUuid + '">Mark published</button></div>'; } return '<tr><td><div class="libTitle">' + esc(r.programName) + '</div><div class="tiny mono">' + esc(r.programSpecialtyId) + ' · ACGME ' + esc(r.acgmeId) + '</div></td><td>' + qa + '<div class="tiny">' + r.factCount + ' facts · ' + esc(r.status) + '</div></td><td>' + (r.riseStatus ? statusTag(r.riseStatus) : '<span class="tag">Not sent</span>') + '</td><td>' + actions + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
		return html;
	}
	function viewDoc() {
		var d = S.doc; if (!d) { return viewLibrary(); }
		var idx = d.metadata && d.metadata.regionIndex != null ? d.metadata.regionIndex : -1, m = d.metadata || {};
		var html = head('PS library', esc(d.programName), esc(d.title));
		html += '<div class="panel mt"><div class="spread"><div class="row">' + statusTag(d.status) + '<span class="tag ' + (d.tier === 'DEEP' ? 'vi' : 'em') + '">' + esc(d.tier) + '</span>' + (m.rootIsSynthetic ? '<span class="tag cy">Synthetic ROOT</span>' : '') + '</div><div class="row"><button class="btn sm primary" data-act="library-edit" data-uuid="' + d.docUuid + '">Edit Program Paragraph</button><a class="btn sm cy" href="' + esc(download(d.docUuid, 'docx')) + '">Download DOCX</a><a class="btn sm" href="' + esc(download(d.docUuid, 'txt')) + '">Download TXT</a>' + (d.status !== 'APPROVED' ? '<button class="btn sm" data-act="doc-status" data-uuid="' + d.docUuid + '" data-status="APPROVED">Approve</button>' : '<button class="btn sm" data-act="doc-status" data-uuid="' + d.docUuid + '" data-status="DRAFT">Back to draft</button>') + (d.status !== 'ARCHIVED' ? '<button class="btn sm ghost" data-act="doc-status" data-uuid="' + d.docUuid + '" data-status="ARCHIVED">Archive</button>' : '') + '</div></div><p class="tiny dim mtS">Only the Program Answer opens for editing. The rest of your ROOT stays locked.</p></div>';
		html += '<div class="previewGrid mt"><div class="paper">' + d.paragraphs.map(function (p, i) { return '<div class="para ' + (i === idx ? 'region' : 'locked') + '"><span class="pn">' + (i + 1) + '</span>' + (i === idx ? '<div class="paraFlag">Program-specific paragraph</div>' : '') + esc(p) + '</div>'; }).join('') + '</div>';
		html += '<div class="side"><div class="panel"><dl class="kv"><dt>Specialty</dt><dd>' + esc(d.specialtyLabel) + '</dd><dt>Program</dt><dd>' + esc(d.programName) + '<br><span class="small mid">' + esc([d.city, d.state].filter(Boolean).join(', ')) + '</span></dd><dt>Verified ID</dt><dd class="mono">ACGME ' + esc(d.acgmeId || 'n/a') + '<br>' + esc(d.programSpecialtyId) + '</dd><dt>ROOT version</dt><dd>' + esc(d.rootLabel) + '<br><span class="mono">' + esc((m.rootTextSha256 || '').slice(0, 16)) + '…</span></dd><dt>Generated</dt><dd>v' + d.versionNumber + ' · ' + esc(d.createdAt) + ' UTC</dd><dt>Approach</dt><dd>' + esc(STRATEGY[m.strategy] || m.strategy || '') + '</dd><dt>Writer</dt><dd>' + esc(m.provider || '') + ' ' + esc(m.model || '') + '</dd><dt>Evidence</dt><dd class="mono">' + esc((m.bundleSha256 || '').slice(0, 16)) + '… · ' + esc(m.registryReleaseId || '') + '</dd><dt>Text hash</dt><dd class="mono">' + esc(d.fullTextSha256.slice(0, 24)) + '…</dd></dl></div></div></div>';
		html += '<div class="footBar"><button class="btn ghost" data-act="go" data-view="library">← Library</button></div>';
		return html;
	}

	function viewMyEras() {
		var w=S.myEras,p=w.plan,items=p&&p.manifest?p.manifest.items:[],approved=items.length,attention=items.filter(function(x){return !x.assignmentEligible;}).length,ready=approved-attention;
		var html=head('MyERAS','Ready for <em>MyERAS?</em>','Your approved statements are organized. Choose how you want to put them into MyERAS.');
		if(!p){setTimeout(loadMyErasPlan,0);return html+'<div class="wizardHero mt"><span class="spin"></span><h2>Organizing your approved statements…</h2><p>Nothing is being changed in MyERAS.</p></div>';}
		var stats='<div class="wizardStats"><div><strong>'+approved+'</strong><span>Approved statements</span></div><div><strong>'+ready+'</strong><span>Ready</span></div><div><strong>'+attention+'</strong><span>Need attention</span></div></div>';
		var upload='<section class="myerasReturn mt"><div><div class="eyebrow">Your AI finished?</div><h2>Drop the PSForge completion file here.</h2><p>PSForge checks the mission, every requested program, every document ID, duplicates, missing results, and allowed statuses before showing a report. MissionMed cannot currently read MyERAS back automatically; assignments remain Not verified until a valid AI readback is returned.</p></div><label class="myerasDrop"><input class="srOnly" type="file" accept=".md,text/markdown,text/plain" data-myeras-file'+(S.busy['myeras-completion']?' disabled':'')+'>'+(S.busy['myeras-completion']?'<span class="spin"></span> Checking…':'Choose completion file')+'</label></section>';
		if(w.screen==='entry'){
			html+=stats+'<div class="myerasChoices"><button class="myerasChoice" data-act="myeras-screen" data-screen="bulk"><span class="tag cy">Fastest for lots of programs</span><strong>DO IT FOR ME</strong><span>Let your AI handle the repetitive MyERAS work.</span><b>Use AI Bulk Setup →</b></button><button class="myerasChoice" data-act="myeras-screen" data-screen="manual"><strong>I’LL DO IT MYSELF</strong><span>PSForge will walk you through every statement and program.</span><b>Start Guided Setup →</b></button></div><button class="myerasDouble mt" data-act="myeras-screen" data-screen="double"><strong>✓ DOUBLE-CHECK ALL MY ASSIGNMENTS</strong><span>Already finished in MyERAS? Let AI check every program before you submit.</span></button>'+upload;
		}
		if(w.screen==='bulk'||w.screen==='double'){
			var isDouble=w.screen==='double';html+='<section class="wizardHero mt"><div class="eyebrow">'+(isDouble?'AI Double-Check · read-only':'AI Bulk Setup')+'</div><h2>'+(isDouble?'Let AI check every program.':'Let AI handle MyERAS.')+'</h2><p>'+(isDouble?'Choose the AI you use. PSForge will prepare a strictly read-only file that compares MyERAS against your canonical plan.':'Choose the AI you use. PSForge will prepare one file with the statements, program matches, safety rules, and instructions it needs.')+'</p><div class="providerGrid mt">'+(p.providers||[]).map(function(provider){return '<button class="myerasProvider" data-act="myeras-package" data-mode="'+(isDouble?'DOUBLE_CHECK':'BULK')+'" data-provider="'+esc(provider.key)+'"><strong>'+esc(provider.label)+'</strong><span>Recommended execution model: '+esc(provider.modelLabel)+'</span><b>Prepare for '+(provider.key==='claude'?'Claude':'Codex')+' →</b></button>';}).join('')+'</div><button class="btn mt" data-act="myeras-screen" data-screen="entry">← Back</button></section>'+upload;
		}
		if(w.screen==='bulk-ready'||w.screen==='double-ready'){
			var doubleReady=w.screen==='double-ready';html+='<section class="wizardHero mt"><div class="eyebrow">Waiting for your AI</div><h2>Your '+(doubleReady?'PSForge MyERAS Double-Check File':'MyERAS AI Assistant File')+' is ready.</h2><p>When it finishes, bring its PSForge completion file back here.</p><ol class="myerasInstructions"><li>Sign into MyERAS in Chrome.</li><li>Open Claude Cowork or Codex.</li><li>Drop this file into the chat.</li><li>Press Enter and let it work.</li><li>Bring the completion file back here.</li></ol><div class="row center"><button class="btn heroBtn primary" data-act="myeras-package" data-mode="'+esc(w.packageMode)+'" data-provider="'+esc(w.provider)+'">Download again</button><a class="btn heroBtn" href="'+esc(p.officialPortal)+'" target="_blank" rel="noopener noreferrer">Open MyERAS</a></div><p class="tiny mid">Official MyERAS entry point. No brittle checklist deep link. PSForge never asks for or stores your password.</p><button class="btn mt" data-act="myeras-screen" data-screen="entry">← Choose another path</button></section>'+upload;
		}
		if(w.screen==='manual'){
			var complete=items.filter(function(x){return w.manualProgress[x.psvDocId]==='COMPLETE';}).length,skipped=items.filter(function(x){return w.manualProgress[x.psvDocId]==='NEEDS_ATTENTION';}).length,item=items[w.manualIndex];
			html+='<div class="manualProgress mt"><strong>'+complete+' complete</strong><span>'+Math.max(0,approved-complete-skipped)+' remaining</span><span>'+skipped+' need attention</span></div>';
			if(!item){html+='<section class="wizardHero mt"><h2>Guided setup queue complete.</h2><p>Your local progress is saved for this exact assignment plan. Run AI Double-Check before submitting.</p><button class="btn heroBtn primary" data-act="myeras-screen" data-screen="double">Double-Check All My Assignments</button></section>';}
			else{html+='<section class="manualCard mt"><div class="eyebrow">Statement '+(w.manualIndex+1)+' of '+approved+'</div><h2>'+esc(item.programName)+'</h2><p>'+esc(item.specialty)+' · '+esc(trainingLabel(item))+(item.nrmpCode?' · NRMP '+esc(item.nrmpCode):'')+'</p>'+(item.assignmentEligible?'':'<div class="notice gold">This program or track needs attention. Do not guess. Skip it for now and continue.</div>')+'<div class="manualSteps"><div><b>STEP 1</b><span>Create a Personal Statement in MyERAS.</span><a class="btn heroBtn" href="'+esc(p.officialPortal)+'" target="_blank" rel="noopener noreferrer">Open MyERAS</a></div><div><b>STEP 2</b><span>Use this title:</span><code>'+esc(item.myErasTitle)+'</code><button class="btn heroBtn" data-act="copy-value" data-value="'+esc(item.myErasTitle)+'">COPY TITLE</button></div><div><b>STEP 3</b><span>Paste this statement:</span><button class="btn heroBtn" data-act="copy-statement" data-doc="'+esc(item.psvDocId)+'">COPY STATEMENT</button></div><div><b>STEP 4</b><span>Preview and Save.</span><button class="btn heroBtn" data-act="manual-done">DONE</button></div><div><b>STEP 5</b><span>Assign it to '+esc(item.programName)+' · '+esc(trainingLabel(item))+(item.nrmpCode?' · NRMP '+esc(item.nrmpCode):'')+'.</span><button class="btn heroBtn primary" data-act="manual-assigned"'+(item.assignmentEligible?'':' disabled')+'>I ASSIGNED IT</button></div></div><div class="row mt"><button class="btn" data-act="manual-skip">SKIP FOR NOW</button><button class="btn" data-act="myeras-screen" data-screen="entry">Exit guided setup</button></div></section>';}
		}
		if(w.screen==='results'&&w.completion){var c=w.completion,issues=(c.results||[]).filter(function(r){return r.verificationResult!=='AI_READBACK_CORRECT';});html+='<section class="wizardHero mt"><div class="eyebrow">MYERAS DOUBLE-CHECK</div><h2>'+c.counts.checked+' programs checked</h2><div class="wizardStats"><div><strong>✓ '+c.counts.correct+'</strong><span>Correct</span></div><div><strong>⚠ '+c.counts.attention+'</strong><span>Need attention</span></div><div><strong>? '+c.counts.couldNotVerify+'</strong><span>Could not verify</span></div></div><div class="notice vi"><strong>'+esc(c.truthLabel)+'</strong><p>This is an external AI readback, not MissionMed independent verification.</p></div>'+(issues.length?'<button class="btn heroBtn primary mt" data-act="scroll-myeras-issues">Review '+issues.length+' Issues</button><div class="mappingList" id="myeras-issues" tabindex="-1">'+issues.map(function(r){return '<article class="mappingCard"><div><strong>'+esc(r.programName)+'</strong><span>'+esc(r.specialty)+' · '+esc(r.trainingType||'Track needs attention')+'</span></div><div><strong>'+esc(String(r.assignmentStatus||'').replace(/_/g,' '))+'</strong><span>'+esc(r.attentionReason||'Inspect this assignment in MyERAS.')+'</span></div></article>';}).join('')+'</div>':'<p class="notice ok">Every requested assignment was reported correct on the AI readback.</p>')+'<button class="btn heroBtn mt" data-act="myeras-screen" data-screen="double">Run Double-Check Again</button></section>';}
		return html;
	}

	/* ---------- render + events ---------- */
	function render() {
		if (!S.boot) { return; }
		var mountedReview = app.querySelector('[data-review-run]'), activeRun = S.runs[S.current];
		if (S.view === 'preview' && mountedReview && activeRun && mountedReview.getAttribute('data-review-run') === activeRun.runId) {
			patchPreview(false);
			var oldToast = app.querySelector('.toast'); if (oldToast) { oldToast.remove(); }
			if (S.toast) { var toastNode = document.createElement('div'); toastNode.className = 'toast ' + S.toast.kind; toastNode.setAttribute('role','status'); toastNode.textContent = S.toast.message; app.appendChild(toastNode); }
			return;
		}
		var views = { home: viewHome, root: viewRoot, region: viewRegion, prefs: viewPrefs, programs: viewPrograms, generate: viewGenerate, preview: viewPreview, batch: viewBatch, library: viewLibrary, doc: viewDoc, myeras: viewMyEras, admin: viewAdmin };
		var keep = document.activeElement && document.activeElement.getAttribute ? { search: document.activeElement.hasAttribute('data-search') } : {};
		app.innerHTML = header() + '<div class="protoBar"><strong>PSFORGE</strong><span>Your private MissionMed workspace. Your statement and drafts stay in your account.</span></div><div class="shell">' + rail() + '<main class="main"><div class="view' + (render.last !== S.view ? ' enter' : '') + '">' + (views[S.view] || viewHome)() + '</div></main></div>' + (S.toast ? '<div class="toast ' + S.toast.kind + '" role="status">' + esc(S.toast.message) + '</div>' : '');
		render.last = S.view;
		var currentStep = app.querySelector('.stepBtn[aria-current="step"]');
		if (currentStep && window.innerWidth <= 860) { currentStep.scrollIntoView({ block: 'nearest', inline: 'center' }); }
		if (keep.search) { var el = app.querySelector('[data-search]'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }
		if (S.view === 'preview') { patchPreview(false); }
	}

	app.addEventListener('click', function (event) {
		var el = event.target.closest('[data-act]'); if (!el || el.disabled) { return; }
		var act = el.getAttribute('data-act'), id = el.getAttribute('data-id');
		if (reviewLeaveGuard(event, el, act)) { return; }
		if (act === 'go') { if (el.getAttribute('data-view') === 'library') { refreshBoot(); } go(el.getAttribute('data-view')); }
		else if (act === 'jump') { jumpReview(); }
		else if (act === 'open-root') { openRoot(id); }
		else if (act === 'source') { S.rootForm.source = el.getAttribute('data-source'); render(); }
		else if (act === 'pick-file') { S.rootForm.fileKey = el.getAttribute('data-key'); render(); }
		else if (act === 'pick-synthetic') { S.rootForm.syntheticKey = el.getAttribute('data-key'); render(); }
		else if (act === 'create-root') { createRoot(); }
		else if (act === 'region-mode') { S.regionDraft = { mode: el.getAttribute('data-mode'), index: null }; if (S.regionDraft.mode === 'REPLACE_PARAGRAPH' && S.detection && S.detection.proposedIndex != null) { S.regionDraft.index = S.detection.proposedIndex; } render(); }
		else if (act === 'region-pick') { S.regionDraft.index = parseInt(el.getAttribute('data-index'), 10); render(); }
		else if (act === 'save-region') { saveRegion(); }
		else if (act === 'template-behavior') { S.regionDraft.templateBehavior = el.getAttribute('data-behavior'); render(); }
		else if (act === 'save-template') { saveTemplate(); }
		else if (act === 'priority-add') { var pf=CORE_FACTORS.filter(function(x){return x.key===el.getAttribute('data-key');})[0]; if(pf){S.prefs.priorityProfile.push({key:pf.key,label:pf.title,details:[],note:''});render();} }
		else if (act === 'priority-remove') { S.prefs.priorityProfile=S.prefs.priorityProfile.filter(function(x){return x.key!==el.getAttribute('data-key');});render(); }
		else if (act === 'priority-up' || act === 'priority-down') { var pk=el.getAttribute('data-key'), pi=S.prefs.priorityProfile.map(function(x){return x.key;}).indexOf(pk), pj=pi+(act==='priority-up'?-1:1); if(pi>=0&&pj>=0&&pj<S.prefs.priorityProfile.length){var pv=S.prefs.priorityProfile.splice(pi,1)[0];S.prefs.priorityProfile.splice(pj,0,pv);render();} }
		else if (act === 'cat') { S.prefs.categories[el.getAttribute('data-key')].on = el.getAttribute('data-on') === '1'; render(); }
		else if (act === 'term') { var terms = S.prefs.categories[el.getAttribute('data-key')].terms, term = el.getAttribute('data-term'), at = terms.indexOf(term); if (at !== -1) { terms.splice(at, 1); } else if (terms.length < 6) { terms.push(term); } else { toast('Up to six per category.', 'err'); return; } render(); }
		else if (act === 'loc') { S.prefs.location.on = el.getAttribute('data-on') === '1'; render(); }
		else if (act === 'state-remove') { S.stateCodes = S.stateCodes.filter(function (c) { return c !== el.getAttribute('data-code'); }); render(); }
		else if (act === 'save-prefs') { savePrefs(); }
		else if (act === 'retry-list') { refreshBoot(); loadMyPrograms(0); if (S.search.status === 'error') { S.search.status = 'idle'; } }
		else if (act === 'more-list') { loadMyPrograms(S.list.programs.length); }
		else if (act === 'search') { runSearch(); }
		else if (act === 'clear-search') { clearSearch(); }
		else if (act === 'toggle-program') { var rec = null; S.search.results.forEach(function (p) { if (p.programSpecialtyId === id) { rec = p; } }); toggleProgram(id, rec); }
		else if (act === 'tier') { S.tiers[id] = el.getAttribute('data-tier'); render(); }
		else if (act === 'generate') { generate(id).then(function () { if (S.view === 'preview') { S.current = id; render(); } }, function () {}); }
		else if (act === 'generate-essential') { S.tiers[id] = 'ESSENTIAL'; generate(id, 'ESSENTIAL').then(function () { render(); }, function () {}); }
		else if (act === 'generate-all') { generateAll(); }
		else if (act === 'open-run') { S.current = id; go('preview'); }
		else if (act === 'select-candidate') { selectCandidate(S.runs[S.current], el.getAttribute('data-candidate')); }
		else if (act === 'candidate-prev' || act === 'candidate-next') { var cr=S.runs[S.current], ci=cr.candidates.indexOf(selectedOption(cr)); selectCandidate(cr,cr.candidates[(ci+(act==='candidate-next'?1:-1)+cr.candidates.length)%cr.candidates.length].candidateId); }
		else if (act === 'compare-all') { openReviewDialog('compare'); }
		else if (act === 'close-review-dialog') { closeReviewDialog(); }
		else if (act === 'compare-read') { var cid=el.getAttribute('data-candidate'), anchor=app.querySelector('.reviewRegion').getBoundingClientRect().top; closeReviewDialog(); selectCandidate(S.runs[S.current],cid); if(anchor<0 || anchor>window.innerHeight-100) { jumpReview(); } app.querySelector('[data-act="candidate-next"], [data-act="jump"]').focus({preventScroll:true}); }
		else if (act === 'evidence' || act === 'evidence-fact') { openReviewDialog('evidence',(el.getAttribute('data-facts')||'').split(',').filter(Boolean)); }
		else if (act === 'edit-paragraph') { var er=S.runs[S.current], eo=editOverlay(er,selectedOption(er)); eo.editing=true; patchPreview(false); app.querySelector('[data-review-editor]').focus({preventScroll:true}); }
		else if (act === 'save-edits') { saveReviewEdit(S.runs[S.current],selectedOption(S.runs[S.current]),false).catch(function(){}); }
		else if (act === 'revalidate-edit') { revalidateReviewEdit(S.runs[S.current],selectedOption(S.runs[S.current])).catch(function(){}); }
		else if (act === 'discard-edits') { var dr=S.runs[S.current], dc=selectedOption(dr), dh=reviewState(dr).heads[dc.candidateId], od=editOverlay(dr,dc); od.text=dh && dh.action!=='RESTORE'?dh.text:dc.replacement; od.dirty=false; od.editing=false; od.error=''; patchPreview(false); }
		else if (act === 'restore-ai') { confirmReviewRestore(); }
		else if (act === 'confirm-restore') { closeReviewDialog(); saveReviewEdit(S.runs[S.current],selectedOption(S.runs[S.current]),true).catch(function(){}); }
		else if (act === 'leave-keep') { closeReviewDialog(); review.pendingLeave=null; }
		else if (act === 'leave-discard' || act === 'leave-save') { finishReviewLeave(act==='leave-save'); }
		else if (act === 'save') { save(el.getAttribute('data-status'), el.getAttribute('data-ack') === '1'); }
		else if (act === 'research-prompt') { researchPrompt(id); }
			else if (act === 'boost-start') { boostIssue(id, el.getAttribute('data-provider'), false); }
			else if (act === 'boost-refresh') { boostRefresh(id); }
			else if (act === 'admin-tab') { S.admin.tab = el.getAttribute('data-tab'); render(); }
			else if (act === 'admin-prompt-import') { adminPromptAction('import'); }
			else if (act === 'admin-prompt-testing') { adminPromptAction('testing', el.getAttribute('data-uuid')); }
			else if (act === 'admin-prompt-promote') { adminPromptAction('promote', el.getAttribute('data-uuid')); }
			else if (act === 'admin-prompt-rollback') { adminPromptAction('rollback', el.getAttribute('data-family')); }
			else if (act === 'admin-qa') { adminQa(el.getAttribute('data-uuid'), el.getAttribute('data-decision')); }
			else if (act === 'admin-rise') { adminRise(el.getAttribute('data-uuid'), el.getAttribute('data-status')); }
			else if (act === 'copy-prompt') { copyText((S.prompt[id] && S.prompt[id].prompt) || ''); }
			else if (act === 'batch-import') { loadBatchIndex(); }
			else if (act === 'batch-mode') { S.batch.mode = el.getAttribute('data-mode'); render(); }
			else if (act === 'batch-create') { createBatch(); }
			else if (act === 'batch-open') { openBatch(id); }
			else if (act === 'batch-run') { runBatch(); }
			else if (act === 'batch-stop') { stopBatch(); }
			else if (act === 'batch-tier') { var bi = (S.batch.current.items || []).filter(function (x) { return x.itemUuid === el.getAttribute('data-item'); })[0]; if (bi) { batchTier(bi, el.getAttribute('data-tier')); } }
			else if (act === 'batch-review') { var br = (S.batch.current.items || []).filter(function (x) { return x.itemUuid === el.getAttribute('data-item'); })[0]; if (br) { openBatchRun(br); } }
			else if (act === 'batch-alternatives') { var bx = (S.batch.current.items || []).filter(function (x) { return x.itemUuid === el.getAttribute('data-item'); })[0]; if (bx) { batchAlternatives(bx); } }
			else if (act === 'batch-approve') { var ba = (S.batch.current.items || []).filter(function (x) { return x.itemUuid === el.getAttribute('data-item'); })[0]; if (ba) { approveBatchItem(ba); } }
			else if (act === 'batch-approve-ready') { approveBatchReady(); }
			else if (act === 'bulk-selected') { bulkDownload(false); }
			else if (act === 'bulk-approved') { bulkDownload(true); }
			else if (act === 'eras-manifest') { downloadErasManifest(); }
			else if (act === 'myeras-screen') { S.myEras.screen=el.getAttribute('data-screen')||'entry'; render(); }
			else if (act === 'myeras-package') { downloadMyErasPackage(el.getAttribute('data-mode'),el.getAttribute('data-provider')); }
			else if (act === 'copy-value') { copyText(el.getAttribute('data-value')||''); }
			else if (act === 'copy-statement') { copyText((S.myEras.plan.statements||{})[el.getAttribute('data-doc')]||''); }
			else if (act === 'manual-done') { toast('Saved step marked. Assign this exact statement to the program, then continue.','ok'); }
			else if (act === 'manual-assigned') { advanceManual('COMPLETE'); }
			else if (act === 'manual-skip') { advanceManual('NEEDS_ATTENTION'); }
			else if (act === 'scroll-myeras-issues') { var issues=app.querySelector('#myeras-issues');if(issues){issues.scrollIntoView({behavior:'smooth',block:'start'});issues.focus({preventScroll:true});} }
			else if (act === 'open-doc') { openDoc(el.getAttribute('data-uuid')); }
		else if (act === 'library-edit') { var target=(S.boot.library||[]).filter(function(d){return d.docUuid===el.getAttribute('data-uuid');})[0] || (S.doc&&S.doc.docUuid===el.getAttribute('data-uuid')?S.doc:null); if(target){editLibraryDocument(target);} }
		else if (act === 'doc-status') { setDocStatus(el.getAttribute('data-uuid'), el.getAttribute('data-status')); }
	});
	app.addEventListener('keydown', function (event) {
		var t = event.target;
		if (t.matches && t.matches('.reviewChoices [role="radio"]') && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].indexOf(event.key)!==-1) {
			event.preventDefault(); var r=S.runs[S.current], i=r.candidates.indexOf(selectedOption(r)), j=event.key==='Home'?0:event.key==='End'?r.candidates.length-1:(i+(['ArrowRight','ArrowDown'].indexOf(event.key)!==-1?1:-1)+r.candidates.length)%r.candidates.length;
			selectCandidate(r,r.candidates[j].candidateId); app.querySelectorAll('.reviewChoices [role="radio"]')[j].focus({preventScroll:true}); return;
		}
		if (event.key === 'Enter' && t.hasAttribute && t.hasAttribute('data-add')) { event.preventDefault(); var terms = S.prefs.categories[t.getAttribute('data-add')].terms, v = t.value.trim(); if (v && terms.indexOf(v) === -1) { if (terms.length >= 6) { toast('Up to six per category.', 'err'); return; } terms.push(v); render(); } }
		else if (event.key === 'Enter' && t.hasAttribute && t.hasAttribute('data-search')) { event.preventDefault(); runSearch(); }
		else if ((event.key === 'Enter' || event.key === ' ') && t.getAttribute && t.getAttribute('role') === 'button') { event.preventDefault(); t.click(); }
	});
	app.addEventListener('input', function (event) {
		var t = event.target;
		if (t.hasAttribute('data-review-editor')) { var r=S.runs[S.current], c=selectedOption(r), o=editOverlay(r,c), h=reviewState(r).heads[c.candidateId]; o.text=t.value; o.caret=t.selectionStart; o.caretEnd=t.selectionEnd; o.dirty=o.text!==(h && h.action!=='RESTORE'?h.text:c.replacement); o.error=''; delete r.similarityReview; patchPreview(false); return; }
		if (t.hasAttribute('data-template-text')) { S.regionDraft.templateText = t.value; return; }
		if (t.hasAttribute('data-priority-details')) { var pd=S.prefs.priorityProfile.filter(function(x){return x.key===t.getAttribute('data-priority-details');})[0]; if(pd){pd.details=t.value.split(',').map(function(x){return x.trim();}).filter(Boolean).slice(0,8);} return; }
		if (t.hasAttribute('data-priority-note')) { var pn=S.prefs.priorityProfile.filter(function(x){return x.key===t.getAttribute('data-priority-note');})[0]; if(pn){pn.note=t.value;} return; }
		if (t.hasAttribute('data-admin-import')) { S.admin.importText = t.value; return; }
		if (t.hasAttribute('data-admin-qa-note')) { S.admin.qaNotes[t.getAttribute('data-admin-qa-note')] = t.value; return; }
		if (t.hasAttribute('data-bind')) { var k = t.getAttribute('data-bind'); if (t.type === 'checkbox') { S.rootForm[k] = t.checked; } else { S.rootForm[k] = t.value; } if (k === 'text') { var btn = app.querySelector('[data-act="create-root"]'); if (btn) { btn.disabled = t.value.trim().length <= 200; } } }
		else if (t.hasAttribute('data-note')) { S.prefs.categories[t.getAttribute('data-note')].note = t.value; }
		else if (t.hasAttribute('data-cities')) { S.prefs.location.cities = t.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 8); }
		else if (t.hasAttribute('data-loc-reason')) { S.prefs.location.reason = t.value; }
		else if (t.hasAttribute('data-search')) { S.search.q = t.value; }
	});
	app.addEventListener('change', function(event) {
		var t=event.target;if(t.hasAttribute&&t.hasAttribute('data-myeras-file')){validateMyErasCompletion(t.files&&t.files[0]);t.value='';}
	});
	var draggedPriority='';
	app.addEventListener('dragstart',function(event){var card=event.target.closest&&event.target.closest('[data-priority-key]');if(!card){return;}draggedPriority=card.getAttribute('data-priority-key');card.classList.add('dragging');if(event.dataTransfer){event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',draggedPriority);}});
	app.addEventListener('dragend',function(event){var card=event.target.closest&&event.target.closest('[data-priority-key]');if(card){card.classList.remove('dragging');}draggedPriority='';});
	app.addEventListener('dragover',function(event){if(draggedPriority&&event.target.closest&&event.target.closest('[data-priority-key]')){event.preventDefault();}});
	app.addEventListener('drop',function(event){var target=event.target.closest&&event.target.closest('[data-priority-key]');if(!draggedPriority||!target){return;}event.preventDefault();var to=target.getAttribute('data-priority-key'),list=S.prefs.priorityProfile,fromIndex=list.map(function(x){return x.key;}).indexOf(draggedPriority),toIndex=list.map(function(x){return x.key;}).indexOf(to);if(fromIndex>=0&&toIndex>=0&&fromIndex!==toIndex){var moved=list.splice(fromIndex,1)[0];list.splice(toIndex,0,moved);render();}});
	app.addEventListener('change', function (event) {
		var t = event.target;
		if (t.hasAttribute('data-review-select')) { selectCandidate(S.runs[S.current],t.value); return; }
		if (t.hasAttribute('data-batch-select')) { S.batch.selected[t.getAttribute('data-batch-select')] = t.checked; render(); return; }
		if (t.hasAttribute('data-admin-package')) { var pf=t.files&&t.files[0]; if(!pf){return;} if(!/\.json$/i.test(pf.name)||pf.size>131072){toast('Choose one prompt-package JSON file under 128 KB.','err');return;} var reader=new FileReader(); reader.onload=function(){S.admin.importText=String(reader.result||'');render();}; reader.onerror=function(){toast('The prompt package could not be read.','err');}; reader.readAsText(pf); return; }
		if (t.hasAttribute('data-boost-file')) { boostUpload(t.getAttribute('data-boost-file'), t.files && t.files[0]); return; }
		if (t.hasAttribute('data-search-specialty')) { S.search.specialty = t.value; S.search.status = 'idle'; S.search.results = []; render(); return; }
		if (t.hasAttribute('data-search-state')) { S.search.state = t.value; S.search.status = 'idle'; S.search.results = []; render(); return; }
		if (t.hasAttribute('data-root-file')) {
			var file = t.files && t.files[0], ext = file && file.name ? file.name.toLowerCase().split('.').pop() : '';
			if (!file) { S.rootForm.uploadFile = null; S.rootForm.uploadName = ''; render(); return; }
			if (['docx','txt'].indexOf(ext) === -1) { S.rootForm.uploadFile = null; S.rootForm.uploadName = ''; toast('Choose a DOCX or UTF-8 TXT file. Export Pages or PDF to DOCX first.', 'err'); return; }
			if (file.size < 1 || file.size > 5242880) { S.rootForm.uploadFile = null; S.rootForm.uploadName = ''; toast('Choose a file no larger than 5 MB.', 'err'); return; }
			S.rootForm.uploadFile = file; S.rootForm.uploadName = file.name; render(); return;
		}
		if (t.hasAttribute('data-state-add')) { if (t.value && S.stateCodes.indexOf(t.value) === -1) { if (S.stateCodes.length >= 8) { toast('Up to eight states.', 'err'); return; } S.stateCodes.push(t.value); } render(); }
		else if (t.hasAttribute('data-loc-mention')) { S.prefs.location.mayMention = t.checked; }
			else if (t.hasAttribute('data-show-original')) { S.showOriginal = t.checked; render(); }
			else if (t.hasAttribute('data-doc-select')) { S.selectedDocs[t.getAttribute('data-doc-select')] = t.checked; render(); }
			else if (t.hasAttribute('data-research-file')) { uploadResearch(t.getAttribute('data-research-file'), t.files && t.files[0]); }
		else if (t.hasAttribute('data-bind') && t.tagName === 'SELECT') { S.rootForm[t.getAttribute('data-bind')] = t.value; }
	});

	window.addEventListener('beforeunload',function(event){ if(hasReviewDrafts()){event.preventDefault();event.returnValue='';} });
	window.addEventListener('resize',function(){ if(S.view==='preview'){patchPreview(false);} });
	boot();
})();
