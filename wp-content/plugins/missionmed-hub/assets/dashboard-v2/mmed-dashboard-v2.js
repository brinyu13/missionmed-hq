/**
 * Matrix Dashboard 2.0 renderer — MX-DASH-6000C.
 *
 * Additive override of MMED_OS.render.dashboard (the same pattern
 * student-os-calendar-v4.js uses for the calendar route). Dashboard V1 code is
 * untouched: when the server resolves the experience to "classic" this file
 * either does nothing or (invite mode) appends a small "Try Matrix 2.0" banner
 * after V1 renders.
 *
 * Data is the real Matrix data V1 already loads (stats + dashboard overview).
 * Authorization is server-resolved (mmedDashboardV2.is_admin from
 * manage_options); admin edits go through REST routes whose
 * permission_callback re-checks the capability. No client toggle grants rights.
 */
(function () {
	'use strict';

	const app = window.MMED_OS;
	const cfg = window.mmedDashboardV2;
	const ART = window.MMED_DASH_ART || {};
	if (!app || !cfg || !app.render) { return; }

	const $ = (s, r) => (r || document).querySelector(s);
	const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
	const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
	const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const isNarrow = () => window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
	const morphCanary = cfg.experience === 'matrix2' && !!cfg.is_admin;
	const lockedArtRoot = String(cfg.asset_base || '').replace(/\/?$/, '/') + 'locked-art/';
	const lockedArtURL = (a, phase) => morphCanary && a && !(a.card_image || a.detail_image) ? lockedArtRoot + phase + '/' + encodeURIComponent(a.id) + '.png' : '';

	/* ------------------------------------------------------------------ */
	/* Invite mode: Classic stays Classic, plus one dismissible banner.    */
	/* ------------------------------------------------------------------ */
	if (cfg.experience !== 'matrix2') {
		if (!cfg.invite) { return; }
		const originalDashboard = app.render.dashboard;
		app.render.dashboard = function () {
			originalDashboard.apply(this, arguments);
			const content = document.getElementById('sos-content');
			const page = content && content.querySelector('.sos-page');
			if (!page || page.querySelector('.mmdv2-invite') || sessionStorage.getItem('mmdv2-invite-dismissed')) { return; }
			const bar = document.createElement('div');
			bar.className = 'mmdv2-invite';
			bar.innerHTML = '<span class="mmdv2-invite-mark">2.0</span><span><b>Matrix 2.0 is available.</b> A new front door: ask for what you need, browse featured apps, keep Classic any time.</span>'
				+ '<button type="button" class="mmdv2-invite-go">Try Matrix 2.0</button><button type="button" class="mmdv2-invite-x" aria-label="Dismiss">×</button>';
			page.insertBefore(bar, page.firstChild);
			bar.querySelector('.mmdv2-invite-go').addEventListener('click', () => setExperience('matrix2'));
			bar.querySelector('.mmdv2-invite-x').addEventListener('click', () => { try { sessionStorage.setItem('mmdv2-invite-dismissed', '1'); } catch (e) { /* noop */ } bar.remove(); });
		};
		return;
	}

	/* ------------------------------------------------------------------ */
	/* Matrix 2.0                                                          */
	/* ------------------------------------------------------------------ */
	const FEATURED = ['homebase', 'calendar', 'scheduler', 'storyforge', 'ivprep', 'rise', 'ranklist', 'lor'];
	const state = {
		apps: normalizeApps(cfg.apps),
		isAdmin: !!cfg.is_admin,
		perspective: cfg.is_admin ? 'admin' : 'student',
		editMode: false,
		detail: null,
		query: '',
		saving: false,
	};

	function normalizeApps(raw) {
		const out = {};
		FEATURED.forEach((id) => { out[id] = Object.assign({ id, benefits: [] }, (raw && raw[id]) || (cfg.defaults && cfg.defaults[id]) || {}); });
		return out;
	}
	const appOf = (id) => state.apps[id];

	/* Search routing — deterministic keyword tables (no AI implied). */
	const ROUTES = [
		{ app: 'rise', keys: ['program', 'programs', 'apply', 'research', 'target list', 'compare', 'img'], why: 'Program research and target lists live in RISE.' },
		{ app: 'ivprep', keys: ['practice', 'mock', 'answer', 'nervous', 'confident', 'interview questions', 'rehearse'], why: 'Repeatable interview practice is what IV Prep On-Call is for.' },
		{ app: 'storyforge', keys: ['story', 'stories', 'experience', 'personal statement', 'narrative', 'anecdote', 'behavioral'], why: 'StoryForge turns experiences into interview-ready stories.' },
		{ app: 'scheduler', keys: ['book', 'booking', 'appointment', 'advising', 'meet', 'time with', 'schedule', 'session with', 'mentor', 'dr. brian', 'dr brian'], why: 'Booking time with a mentor happens in Scheduler.' },
		{ app: 'calendar', keys: ['coming up', "what's next", 'whats next', 'upcoming', 'today', 'this week', 'when is', 'calendar', 'drills', 'live session'], why: 'Calendar shows everything scheduled, next item first.' },
		{ app: 'ranklist', keys: ['rank', 'ranking', 'order', 'prioritize', 'match list', 'certify'], why: 'RankList IQ turns priorities into a defensible order.' },
		{ app: 'lor', keys: ['letter', 'recommendation', 'lor', 'recommender', 'reference'], why: 'LOR Builder prepares what recommenders need.' },
		{ app: 'homebase', keys: ['work on', 'focus', 'what should i', 'where do i start', 'plan', 'priorities', 'overwhelmed', 'lost'], why: 'HomeBase answers "what should I do today?"', contextual: true },
	];
	const RELATED = { storyforge: ['ivprep', 'lor'], ivprep: ['storyforge', 'scheduler'], rise: ['ranklist', 'lor'], ranklist: ['rise'], scheduler: ['calendar', 'ivprep'], calendar: ['scheduler'], lor: ['storyforge', 'rise'], homebase: ['calendar', 'scheduler'] };
	const SUGGESTIONS = ["I don't know which programs to apply to", 'I need to practice for interviews', 'I need better stories for interviews', 'I need to book time with a mentor', "What's coming up?", "I don't know how to rank my programs", 'I need a letter of recommendation', 'What should I work on today?'];

	/* Functional subtitles for the module catalog row (non-featured apps). */
	const MODULE_SUBS = {
		appointments: 'Your booked sessions — join, reschedule, or cancel.', courses: 'Your enrolled MissionMed courses and progress.', study: 'A day-by-day study plan built around your exam date.',
		filevault: 'Your documents — CV, transcripts, letters — organized and shareable.', arena: 'Test medical knowledge against AI opponents, live.', 'interview-prep': 'Interview practice rooms.',
		cam: 'CAM interview simulation.', orders: 'Your MissionMed purchases and receipts.', profile: 'Your identity, cohort, and application details.', settings: 'Preferences and dashboard experience.',
		notifications: 'What changed since you were last here.', messages: 'Conversations with your advisors and mentors.', help: 'Guides and a direct line to the MissionMed team.',
	};

	/* ------------------------------------------------------------------ */
	/* Override the dashboard renderer                                     */
	/* ------------------------------------------------------------------ */
	app.render.dashboard = function () { renderDashboard(); };

	function content() { return document.getElementById('sos-content'); }

	function renderDashboard() {
		const el = content();
		if (!el) { return; }
		morph.dispose();
		const root = document.getElementById('student-os-root');
		if (root) { root.classList.add('mmdv2-active'); }
		const profile = app.state.profile || {};
		const firstName = (profile.display_name || 'Student').trim().split(/\s+/)[0];
		const admin = state.isAdmin && state.perspective === 'admin';

		el.innerHTML = `
		<section class="sos-page mmdv2" data-perspective="${admin ? 'admin' : 'student'}"${state.editMode ? ' data-edit="1"' : ''}>
			<div class="mmdv2-bg" aria-hidden="true"><canvas class="mmdv2-stars"></canvas><i class="mmdv2-aur mmdv2-aur-a"></i><i class="mmdv2-aur mmdv2-aur-b"></i><i class="mmdv2-vig"></i></div>
			<div class="mmdv2-in">
				<div class="mmdv2-top">
					<span class="sos-eyebrow">${admin ? 'Administrator dashboard' : 'Student dashboard'}</span>
					<span class="mmdv2-top-sp"></span>
					${state.isAdmin ? `<div class="mmdv2-seg" role="group" aria-label="Viewing as">
						<button type="button" data-persp="admin" class="${state.perspective === 'admin' ? 'on' : ''}">Admin view</button>
						<button type="button" data-persp="student" class="${state.perspective === 'student' ? 'on' : ''}">Preview as student</button></div>` : ''}
					${admin ? `<button type="button" class="mmdv2-btn mmdv2-btn-ghost mmdv2-edit-toggle${state.editMode ? ' on' : ''}" data-edit-toggle>${state.editMode ? 'Done editing' : 'Edit featured apps'}</button>` : ''}
					<button type="button" class="mmdv2-link" data-exp="classic" title="Switch this account back to Dashboard V1">Use Classic</button>
				</div>
				${admin ? `<div class="mmdv2-adminbar"><b>Administrator view</b> · you are seeing admin subtitles${state.editMode ? ' and edit controls. Changes save for every student.' : '. Click <i>Edit featured apps</i> to change copy or images.'}${cfg.settings_url ? ` <a href="${esc(cfg.settings_url)}">Experience settings →</a>` : ''}</div>` : ''}

				<div class="mmdv2-hero">
					<h1 class="mmdv2-h1">Welcome back, ${esc(firstName)}. <em>Where can I take you today?</em></h1>
					<p class="mmdv2-lede">Type what you need to do — or the problem you have — and Matrix takes you to the right tool.</p>
					<div class="mmdv2-launcher">
						<div class="mmdv2-lwrap${state.query ? ' has-text' : ''}">
							<span class="mmdv2-pfx" aria-hidden="true">Take me to…</span>
							<input type="text" class="mmdv2-q" autocomplete="off" spellcheck="false" placeholder="e.g. I need to practice for interviews" aria-label="Where can I take you today?" value="${esc(state.query)}">
							<button type="button" class="mmdv2-lclear" aria-label="Clear">×</button>
							<button type="button" class="mmdv2-lgo">Go</button>
						</div>
						<div class="mmdv2-results" aria-live="polite"></div>
					</div>
					<div class="mmdv2-chips">${SUGGESTIONS.map((s) => `<button type="button" class="mmdv2-chip" data-q="${esc(s)}">${esc(s)}</button>`).join('')}</div>
				</div>

				<div class="mmdv2-sechead"><h2 class="mmdv2-h2">Featured apps</h2><span class="mmdv2-tag">${admin ? 'admin subtitles' : 'tap a card to learn what it does'}</span></div>
				<div class="mmdv2-featured">${FEATURED.map((id, i) => cardHTML(appOf(id), 'c' + i, admin)).join('')}</div>

				${todayHTML(admin)}
				${catalogHTML()}
			</div>
		</section>`;

		bindDashboard(el);
		morph.bind(el);
		startBackground(el);
		ensureOverlays();
		kickOffData();
		if (state.query) { renderResults(state.query); }
	}

	/* ------------------------------------------------------------------ */
	/* Featured cards                                                      */
	/* ------------------------------------------------------------------ */
	function mediaHTML(a, uid, kind) {
		const locked = lockedArtURL(a, kind === 'detail' ? 'cinematic' : 'pencil');
		if (locked) {
			if (kind === 'detail') {
				return '<span class="mmdv2-media-front mmdv2-locked-detail"><img class="mmdv2-img" src="' + esc(locked) + '" alt="" decoding="async"></span>';
			}
			const target = lockedArtURL(a, 'cinematic');
			return '<span class="mmdv2-morph" data-morph-app="' + esc(a.id) + '"><img class="mmdv2-morph-pencil" src="' + esc(locked) + '" alt="" loading="lazy" decoding="async"><img class="mmdv2-morph-cinematic" data-src="' + esc(target) + '" alt="" decoding="async"></span>';
		}
		const url = kind === 'detail' ? (a.detail_image || a.card_image) : a.card_image;
		const fn = ART[a.id];
		if (kind === 'detail') {
			/* Detail panel: a blurred cover layer behind a contained layer, so any image ratio fills the
			   panel without cropping the subject or bleeding past the rounded edge. */
			const back = url ? `<img class="mmdv2-img" src="${esc(url)}" alt="" decoding="async">` : (fn ? fn(uid + 'b') : '');
			const front = url ? `<img class="mmdv2-img" src="${esc(url)}" alt="" decoding="async">` : (fn ? fn(uid + 'f').replace('preserveAspectRatio="xMidYMid slice"', 'preserveAspectRatio="xMidYMid meet"') : '');
			return `<span class="mmdv2-media-back">${back}</span><span class="mmdv2-media-front">${front}</span>`;
		}
		if (url) { return `<img class="mmdv2-img" src="${esc(url)}" alt="" loading="lazy" decoding="async">`; }
		return fn ? fn(uid) : `<div class="mmdv2-img-fallback" style="background:${esc(a.hue || '#0e3559')}"></div>`;
	}

	function cardHTML(a, uid, admin) {
		const sub = admin ? (a.adminSub || a.sub) : a.sub;
		const locked = !!lockedArtURL(a, 'pencil');
		return `<div class="mmdv2-card-wrap">
			<button type="button" class="mmdv2-card${locked ? ' mmdv2-card-locked' : ''}" data-open="${a.id}" style="--hue:${esc(a.hue || '#ffb340')}" aria-label="${esc(a.name)} — ${esc(sub)}">
				<span class="mmdv2-media">${mediaHTML(a, uid, 'card')}</span>
				<span class="mmdv2-scrim"></span>
				<span class="mmdv2-cat">${esc(a.cat)}</span>
				<span class="mmdv2-meta"><span class="mmdv2-nm">${esc(a.name)}</span><span class="mmdv2-sub">${esc(sub)}</span></span>
				<span class="mmdv2-go" aria-hidden="true">→</span>
			</button>
			${admin && state.editMode ? `<button type="button" class="mmdv2-editbtn" data-editapp="${a.id}" aria-label="Edit ${esc(a.name)}">✎ Edit${a.edited ? ' · customized' : ''}</button>` : ''}
		</div>`;
	}

	/* ------------------------------------------------------------------ */
	/* Today — real Matrix data (V1's stats + overview endpoints)          */
	/* ------------------------------------------------------------------ */
	function kickOffData() {
		if (!app.state.statsLoaded && !app.state.statsLoading && typeof app.render.loadDashboardStats === 'function') { app.render.loadDashboardStats(); }
		const ov = app.state.dashboardOverview;
		if (ov && !ov.loaded && !ov.loading && typeof app.render.loadDashboardOverview === 'function') { app.render.loadDashboardOverview(); }
	}
	const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : (d || 0); };
	const dateOf = (e) => new Date(e.start_at || e.start || e.date || e.due_at || e.due_date || '');
	const sortByDate = (arr) => arr.slice().sort((a, b) => { const x = dateOf(a).getTime(), y = dateOf(b).getTime(); return (isNaN(x) ? 9e15 : x) - (isNaN(y) ? 9e15 : y); });
	const fmtWhen = (d) => { if (isNaN(d.getTime())) { return 'Date pending'; } return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); };
	const fmtRel = (d) => { const ms = d.getTime() - Date.now(); if (isNaN(ms)) { return ''; } const h = Math.round(ms / 36e5); if (h < 1) { return 'now'; } if (h < 24) { return 'in ' + h + ' h'; } const days = Math.round(h / 24); return 'in ' + days + (days === 1 ? ' day' : ' days'); };
	const isAppointment = (e) => /appointment|scheduler|ssa|meeting|1-on-1|one-on-one/i.test([e.source, e.event_type, e.category, e.type, e.title].join(' '));

	function todayHTML(admin) {
		const ov = app.state.dashboardOverview || {};
		const stats = app.state.stats || {};
		const events = sortByDate((ov.events || []).concat(ov.schedulerEvents || [])).filter((e) => { const d = dateOf(e); return !isNaN(d.getTime()) && d.getTime() > Date.now() - 36e5; });
		const next = events[0];
		const todos = sortByDate((ov.todos || []).filter((t) => t.completed !== true && !/^(complete|completed|done)$/i.test(String(t.status || '')))).slice(0, 3);
		const messages = (ov.messages || []).slice().sort((a, b) => new Date(b.timestamp || b.created_at || 0) - new Date(a.timestamp || a.created_at || 0)).slice(0, 2);
		const loading = ov.loading && !ov.loaded;
		const unread = num(stats.unread_messages, 0);
		const taskTotal = num(stats.tasks_total, 0), taskDone = num(stats.tasks_approved, 0);

		return `
		<div class="mmdv2-sechead"><h2 class="mmdv2-h2">Today</h2>${loading ? '<span class="mmdv2-tag">syncing live Matrix data…</span>' : ''}<button type="button" class="mmdv2-more" data-open="homebase">Why HomeBase →</button></div>
		<div class="mmdv2-today">
			<div class="mmdv2-panel"><div class="mmdv2-phead"><span class="mmdv2-eyebrow">Next up</span><a class="mmdv2-pmore" href="#calendar">Calendar</a></div><div class="mmdv2-pbody">
				${next ? `<div class="mmdv2-next-title">${esc(next.title || 'Calendar event')}</div><div class="mmdv2-next-when">${esc(fmtWhen(dateOf(next)))}</div><span class="mmdv2-rel">${esc(fmtRel(dateOf(next)))}</span>
					<div class="mmdv2-acts">${next.meeting_url || next.join_url || next.url ? `<a class="mmdv2-btn mmdv2-btn-p mmdv2-btn-s" href="${esc(next.meeting_url || next.join_url || next.url)}" target="_blank" rel="noopener">Join</a>` : ''}<a class="mmdv2-btn mmdv2-btn-ghost mmdv2-btn-s" href="${isAppointment(next) ? '#appointments' : '#calendar'}">${isAppointment(next) ? 'Manage' : 'Open Calendar'}</a></div>`
					: `<p class="mmdv2-empty">${loading ? 'Checking your schedule…' : 'Nothing scheduled in the next 7 days.'}</p><div class="mmdv2-acts"><a class="mmdv2-btn mmdv2-btn-ghost mmdv2-btn-s" href="#scheduler">Find a time</a></div>`}
				${taskTotal ? `<div class="mmdv2-progress"><div class="mmdv2-pl"><span>Hub tasks approved</span><span>${taskDone}/${taskTotal}</span></div><div class="mmdv2-bar"><i style="width:${Math.min(100, Math.round(taskDone / taskTotal * 100))}%"></i></div></div>` : ''}
			</div></div>
			<div class="mmdv2-panel"><div class="mmdv2-phead"><span class="mmdv2-eyebrow">To-do</span><a class="mmdv2-pmore" href="#calendar">All</a></div><div class="mmdv2-pbody">
				${todos.length ? `<div class="mmdv2-list">${todos.map((t) => `<a class="mmdv2-row" href="#calendar"><span class="mmdv2-sw"></span><span class="mmdv2-row-t">${esc(t.title || t.name || 'To-do')}</span><span class="mmdv2-row-d">${t.due_at || t.due_date ? esc(fmtWhen(dateOf(t)).split(' · ')[0]) : esc(t.status || 'Open')}</span></a>`).join('')}</div>`
					: `<p class="mmdv2-empty">${loading ? 'Loading to-dos…' : 'No active to-dos.'}</p>`}
			</div></div>
			<div class="mmdv2-panel"><div class="mmdv2-phead"><span class="mmdv2-eyebrow">Messages</span><a class="mmdv2-pmore" href="#messages">${unread ? unread + ' unread' : 'Inbox'}</a></div><div class="mmdv2-pbody">
				${messages.length ? messages.map((m) => `<a class="mmdv2-msg" href="#messages"><span class="mmdv2-msg-from">${esc(m.from || m.title || 'Message')}</span><span class="mmdv2-msg-t">${esc(m.message || m.preview || m.title || '')}</span></a>`).join('')
					: `<p class="mmdv2-empty">${loading ? 'Loading messages…' : 'No recent messages.'}</p>`}
			</div></div>
		</div>`;
	}

	/* Everything else — real registered modules, each with a functional subtitle. */
	function catalogHTML() {
		let items = [];
		try { items = app.components.navItems().filter((it) => it.route !== 'dashboard'); } catch (e) { items = []; }
		if (!items.length) { return ''; }
		const featuredRoutes = new Set(FEATURED.map((id) => (appOf(id).launch || '').replace(/^#/, '')));
		items = items.filter((it) => !featuredRoutes.has(it.route));
		return `<div class="mmdv2-sechead"><h2 class="mmdv2-h2">Everything else in Matrix</h2><span class="mmdv2-tag">${items.length} more</span></div>
		<div class="mmdv2-catalog">${items.map((it) => `<a class="mmdv2-acard" href="${it.launchUrl ? esc(it.launchUrl) : '#' + esc(it.route)}"><span class="mmdv2-ic">${esc(it.icon || it.label.charAt(0))}</span><span><span class="mmdv2-anm">${esc(it.label)}</span><span class="mmdv2-asub">${esc(MODULE_SUBS[it.route] || (it.section ? it.section + ' · Matrix app' : 'Matrix app'))}</span></span></a>`).join('')}</div>`;
	}

	/* ------------------------------------------------------------------ */
	/* Bindings                                                            */
	/* ------------------------------------------------------------------ */
	function bindDashboard(el) {
		const q = $('.mmdv2-q', el);
		const wrap = $('.mmdv2-lwrap', el);
		const upd = () => { state.query = q.value; wrap.classList.toggle('has-text', !!q.value); renderResults(q.value); };
		q.addEventListener('input', upd);
		q.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') { const r = route(q.value); if (r && r.app && !r.contextual) { launch(r.app); } }
			if (e.key === 'Escape') { q.value = ''; upd(); q.blur(); }
		});
		$('.mmdv2-lgo', el).addEventListener('click', () => { if (!q.value.trim()) { q.focus(); return; } const r = route(q.value); if (r && r.app && !r.contextual) { launch(r.app); } else { renderResults(q.value); } });
		$('.mmdv2-lclear', el).addEventListener('click', () => { q.value = ''; upd(); q.focus(); });
		$$('.mmdv2-chip', el).forEach((c) => c.addEventListener('click', () => { q.value = c.getAttribute('data-q'); upd(); q.focus(); }));
		$$('[data-persp]', el).forEach((b) => b.addEventListener('click', () => { state.perspective = b.getAttribute('data-persp'); if (state.perspective === 'student') { state.editMode = false; } renderDashboard(); }));
		const et = $('[data-edit-toggle]', el);
		if (et) { et.addEventListener('click', () => { state.editMode = !state.editMode; renderDashboard(); toast(state.editMode ? 'Edit mode on — click ✎ Edit on any card.' : 'Edit mode off.'); }); }
		$$('[data-exp]', el).forEach((b) => b.addEventListener('click', () => setExperience(b.getAttribute('data-exp'))));
		el.addEventListener('click', (e) => {
			const open = e.target.closest('[data-open]'); if (open) { openDetail(open.getAttribute('data-open')); return; }
			const ed = e.target.closest('[data-editapp]'); if (ed) { openEditor(ed.getAttribute('data-editapp')); }
		});
		document.addEventListener('click', onDocClick);
		if (state.perspective === 'admin' && state.editMode) { $$('.mmdv2-editbtn', el).forEach((b) => b.classList.add('mmdv2-editbtn-visible')); }
	}
	function onDocClick(e) { if (!e.target.closest('.mmdv2-launcher')) { const r = $('.mmdv2-results'); if (r) { r.classList.remove('open'); } } }

	/* ------------------------------------------------------------------ */
	/* Search                                                              */
	/* ------------------------------------------------------------------ */
	function route(raw) {
		const q = (raw || '').trim().toLowerCase();
		if (!q) { return null; }
		const direct = FEATURED.map(appOf).find((a) => (a.name || '').toLowerCase() === q || (a.name || '').toLowerCase().startsWith(q));
		if (direct) { return { app: direct.id, why: 'You asked for ' + direct.name + ' by name.', related: RELATED[direct.id] || [] }; }
		const scored = ROUTES.map((r) => ({ r, s: r.keys.reduce((n, k) => n + (q.indexOf(k) !== -1 ? k.length : 0), 0) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
		if (!scored.length) { return { none: true }; }
		const best = scored[0].r;
		const related = Array.from(new Set(scored.slice(1, 3).map((x) => x.r.app).concat(RELATED[best.app] || []))).filter((id) => id !== best.app).slice(0, 2);
		return { app: best.app, why: best.why, related, contextual: !!best.contextual };
	}

	function renderResults(q) {
		const box = $('.mmdv2-results'); if (!box) { return; }
		const res = route(q);
		if (!res) { box.classList.remove('open'); box.innerHTML = ''; return; }
		if (res.none) { box.innerHTML = `<div class="mmdv2-rempty">No direct match for <b>“${esc(q)}”</b>. Try a task (“book time”, “rank programs”) or pick a card below.</div>`; box.classList.add('open'); return; }
		const a = appOf(res.app);
		if (res.contextual) {
			const ov = app.state.dashboardOverview || {};
			const events = sortByDate((ov.events || []).concat(ov.schedulerEvents || [])).filter((e) => dateOf(e).getTime() > Date.now() - 36e5).slice(0, 2);
			const todos = sortByDate((ov.todos || []).filter((t) => t.completed !== true)).slice(0, 2);
			const lines = events.map((e) => `<a class="mmdv2-rline" href="#calendar"><span class="mmdv2-rk">Next</span><span class="mmdv2-rt">${esc(e.title || 'Event')}</span><span class="mmdv2-rd">${esc(fmtWhen(dateOf(e)))}</span></a>`)
				.concat(todos.map((t) => `<a class="mmdv2-rline" href="#calendar"><span class="mmdv2-rk">Due</span><span class="mmdv2-rt">${esc(t.title || t.name || 'To-do')}</span><span class="mmdv2-rd">${t.due_at || t.due_date ? esc(fmtWhen(dateOf(t)).split(' · ')[0]) : ''}</span></a>`));
			box.innerHTML = `<div class="mmdv2-rlbl">Today, in order</div>${lines.length ? lines.join('') : '<div class="mmdv2-rempty">Nothing scheduled or due — a good day for interview practice.</div>'}<div class="mmdv2-rrel"><button type="button" data-open="ivprep"><span class="mmdv2-sw" style="background:${esc(appOf('ivprep').hue)}"></span>IV Prep On-Call</button><button type="button" data-open="storyforge"><span class="mmdv2-sw" style="background:${esc(appOf('storyforge').hue)}"></span>StoryForge</button></div>`;
			box.classList.add('open'); return;
		}
		box.innerHTML = `<div class="mmdv2-rlbl">Best match</div>
			<div class="mmdv2-rbest"><span class="mmdv2-rthumb">${mediaHTML(a, 'rb' + a.id, 'card')}</span>
				<span><span class="mmdv2-rnm">${esc(a.name)}</span><span class="mmdv2-rsub">${esc(a.sub)}</span><span class="mmdv2-rwhy">${esc(res.why)}</span></span>
				<span class="mmdv2-racts"><button type="button" class="mmdv2-btn mmdv2-btn-p mmdv2-btn-s" data-launch="${a.id}">${esc(a.cta)}</button><button type="button" class="mmdv2-btn mmdv2-btn-ghost mmdv2-btn-s" data-open="${a.id}">What is it?</button></span></div>
			${res.related.length ? `<div class="mmdv2-rrel"><span class="mmdv2-rlbl">Also related</span>${res.related.map((id) => `<button type="button" data-open="${id}"><span class="mmdv2-sw" style="background:${esc(appOf(id).hue)}"></span>${esc(appOf(id).name)}</button>`).join('')}</div>` : ''}`;
		box.classList.add('open');
		$$('[data-launch]', box).forEach((b) => b.addEventListener('click', () => launch(b.getAttribute('data-launch'))));
	}

	/* ------------------------------------------------------------------ */
	/* Launch                                                              */
	/* ------------------------------------------------------------------ */
	function launch(id) {
		const a = appOf(id); if (!a) { return; }
		closeDetail();
		const target = (a.launch || '').trim();
		if (!target || target === '#dashboard') { const t = $('.mmdv2-today'); if (t) { t.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' }); } return; }
		if (/^https?:\/\//i.test(target)) { window.location.href = target; return; }
		const routeName = target.replace(/^#\/?/, '');
		let items = [];
		try { items = app.components.navItems(); } catch (e) { items = []; }
		const mod = items.find((it) => it.route === routeName);
		if (!mod) { toast(`<b>${esc(a.name)}</b> isn't available on your account yet. <a href="#help">Ask the MissionMed team →</a>`); return; }
		if (mod.launchUrl) { window.location.href = mod.launchUrl; return; }
		window.location.hash = routeName;
	}

	function setExperience(exp) {
		if (!app.api || typeof app.api.put !== 'function') { return; }
		app.api.put('/me/dashboard-experience', { experience: exp }).then(() => { window.location.reload(); }, () => toast('Could not save your dashboard preference. Please try again.'));
	}

	/* ------------------------------------------------------------------ */
	/* Detail overlay                                                      */
	/* ------------------------------------------------------------------ */
	function ensureOverlays() {
		if (!document.getElementById('mmdv2-ov')) {
			const ov = document.createElement('div'); ov.id = 'mmdv2-ov'; ov.className = 'mmdv2-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.innerHTML = '<div class="mmdv2-dlg"></div>';
			document.body.appendChild(ov);
			ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-dclose]')) { closeDetail(); } const d = e.target.closest('[data-dnav]'); if (d) { stepDetail(+d.getAttribute('data-dnav')); } const l = e.target.closest('[data-launch]'); if (l) { launch(l.getAttribute('data-launch')); } const ed = e.target.closest('[data-editapp]'); if (ed) { openEditor(ed.getAttribute('data-editapp')); } });
			document.addEventListener('keydown', (e) => {
				if ($('#mmdv2-ed.open')) { if (e.key === 'Escape') { closeEditor(); } return; }
				if (!state.detail) { return; }
				if (e.key === 'Escape') { closeDetail(); } if (e.key === 'ArrowRight') { stepDetail(1); } if (e.key === 'ArrowLeft') { stepDetail(-1); }
			});
		}
		if (!document.getElementById('mmdv2-toast')) { const t = document.createElement('div'); t.id = 'mmdv2-toast'; t.className = 'mmdv2-toast'; document.body.appendChild(t); }
	}

	function openDetail(id) {
		const a = appOf(id); if (!a) { return; }
		state.detail = id;
		const admin = state.isAdmin && state.perspective === 'admin';
		const i = FEATURED.indexOf(id);
		$('#mmdv2-ov .mmdv2-dlg').innerHTML = `
			<div class="mmdv2-dart" style="--hue:${esc(a.hue || '#ffb340')}"><span class="mmdv2-media">${mediaHTML(a, 'd' + a.id, 'detail')}</span><span class="mmdv2-dscrim"></span>
				<div class="mmdv2-dnav"><button type="button" data-dnav="-1" aria-label="Previous app">‹</button><button type="button" data-dnav="1" aria-label="Next app">›</button></div>
				<div class="mmdv2-dcap"><div class="mmdv2-dtag">${esc(a.cat)} · ${i + 1} of ${FEATURED.length}</div><div class="mmdv2-dnm" id="mmdv2-dname">${esc(a.name)}</div><div class="mmdv2-done">${esc(a.one)}</div></div></div>
			<button type="button" class="mmdv2-dclose" data-dclose aria-label="Close">×</button>
			<div class="mmdv2-dbody">
				${admin ? `<div class="mmdv2-dadmin"><span>Administrator</span><button type="button" class="mmdv2-btn mmdv2-btn-ghost mmdv2-btn-s" data-editapp="${a.id}">✎ Edit this app</button></div>` : ''}
				<div class="mmdv2-dsec"><div class="mmdv2-dlb">What this helps you solve</div><div class="mmdv2-dq">“${esc(a.problem)}”</div></div>
				<div class="mmdv2-dsec"><div class="mmdv2-dlb">How ${esc(a.name)} helps</div><p>${esc(a.how)}</p></div>
				<div class="mmdv2-dsec"><div class="mmdv2-dlb">What you get</div><div class="mmdv2-bens">${(a.benefits || []).map((p) => `<div class="mmdv2-ben"><div class="mmdv2-benf">${esc(p[0])}</div><div class="mmdv2-benb">${esc(p[1])}</div></div>`).join('')}</div></div>
				<div class="mmdv2-outcome"><div class="mmdv2-dlb">After you use it</div><div class="mmdv2-outt">${esc(a.outcome)}</div>${a.when ? `<div class="mmdv2-outw">When to use it: ${esc(a.when)}</div>` : ''}</div>
				<div class="mmdv2-dacts"><button type="button" class="mmdv2-btn mmdv2-btn-p mmdv2-btn-catch" data-launch="${a.id}">${esc(a.cta || 'Open')}</button>${a.cta2 ? `<button type="button" class="mmdv2-btn mmdv2-btn-ghost" data-launch="${a.id}">${esc(a.cta2)}</button>` : ''}<span class="mmdv2-dhint">← → browse · esc close</span></div>
			</div>`;
		const ov = $('#mmdv2-ov'); ov.classList.add('open'); document.body.classList.add('mmdv2-lock');
		const c = $('.mmdv2-dclose', ov); if (c) { c.focus(); }
	}
	function closeDetail() { if (!state.detail) { return; } state.detail = null; const ov = $('#mmdv2-ov'); if (ov) { ov.classList.remove('open'); } document.body.classList.remove('mmdv2-lock'); }
	function stepDetail(d) { const i = FEATURED.indexOf(state.detail); openDetail(FEATURED[(i + d + FEATURED.length) % FEATURED.length]); }

	/* ------------------------------------------------------------------ */
	/* Admin editor (UI only renders for server-resolved admins; the REST  */
	/* route re-checks manage_options on every write).                     */
	/* ------------------------------------------------------------------ */
	function openEditor(id) {
		if (!state.isAdmin) { return; }
		const a = appOf(id);
		state.editing = id;
		let ed = document.getElementById('mmdv2-ed');
		if (!ed) { ed = document.createElement('div'); ed.id = 'mmdv2-ed'; ed.className = 'mmdv2-ed'; ed.setAttribute('role', 'dialog'); ed.setAttribute('aria-modal', 'true'); document.body.appendChild(ed); }
		const bens = (a.benefits || []).slice(0, 5); while (bens.length < 4) { bens.push(['', '']); }
		const field = (k, label, hint, textarea) => `<label class="mmdv2-f"><span>${label}${hint ? ` <small>${hint}</small>` : ''}</span>${textarea ? `<textarea name="${k}" rows="4">${esc(a[k] || '')}</textarea>` : `<input type="text" name="${k}" value="${esc(a[k] || '')}">`}</label>`;
		const imgField = (k, label) => `<div class="mmdv2-f mmdv2-fimg"><span>${label} <small>16:10 works best · JPG/PNG/WebP</small></span>
			<div class="mmdv2-imgrow"><span class="mmdv2-imgprev" data-prev="${k}">${a[k] ? `<img src="${esc(a[k])}" alt="">` : `<span class="mmdv2-imgprev-art">${ART[a.id] ? ART[a.id]('ed' + k + a.id) : ''}</span>`}</span>
				<div class="mmdv2-imgacts">${window.wp && window.wp.media ? `<button type="button" class="mmdv2-btn mmdv2-btn-ghost mmdv2-btn-s" data-pick="${k}">Choose from Media Library</button>` : ''}<input type="url" name="${k}" placeholder="…or paste an image URL" value="${esc(a[k] || '')}"><input type="hidden" name="${k}_id" value="${esc(a[k + '_id'] || '')}"><button type="button" class="mmdv2-link" data-clearimg="${k}">Use built-in art</button></div></div></div>`;
		ed.innerHTML = `<div class="mmdv2-edlg">
			<div class="mmdv2-edhead"><div><div class="mmdv2-dlb">Edit featured app</div><div class="mmdv2-edtitle">${esc(a.name)}</div></div><button type="button" class="mmdv2-dclose" data-edclose aria-label="Close">×</button></div>
			<form class="mmdv2-edform" novalidate>
				<div class="mmdv2-edcols">
					<div class="mmdv2-edcol"><div class="mmdv2-dlb">Card</div>
						${field('name', 'Title')}${field('cat', 'Category tag')}${field('sub', 'Subtitle (students see)')}${field('adminSub', 'Subtitle (admins see)')}
						${imgField('card_image', 'Card background image')}
					</div>
					<div class="mmdv2-edcol"><div class="mmdv2-dlb">Popup / detail</div>
						${field('one', 'Headline · one-line explainer')}${field('problem', 'Student problem', 'shown as a quote')}${field('how', 'How it helps', '', true)}
						<div class="mmdv2-f"><span>Features → benefits <small>up to 5</small></span><div class="mmdv2-bengrid">${bens.map((p, k) => `<input type="text" name="bf${k}" placeholder="Feature" value="${esc(p[0])}"><input type="text" name="bb${k}" placeholder="Benefit" value="${esc(p[1])}">`).join('')}</div></div>
						${field('outcome', 'Outcome · after you use it')}${field('when', 'When to use it')}
						<div class="mmdv2-f2">${field('cta', 'Primary button')}${field('cta2', 'Secondary button', 'optional')}</div>
						${field('launch', 'Launch target', 'Matrix route like #storyforge, or an https:// URL')}
						${imgField('detail_image', 'Popup background image')}
					</div>
				</div>
				<div class="mmdv2-edacts"><button type="submit" class="mmdv2-btn mmdv2-btn-p">Save for all students</button><button type="button" class="mmdv2-btn mmdv2-btn-ghost" data-edclose>Cancel</button><span class="mmdv2-edsp"></span>${a.edited ? `<button type="button" class="mmdv2-link mmdv2-danger" data-reset="${a.id}">Reset to MissionMed defaults</button>` : ''}<span class="mmdv2-edstatus"></span></div>
			</form></div>`;
		ed.classList.add('open'); document.body.classList.add('mmdv2-lock');
		const form = $('form', ed);
		form.addEventListener('submit', (e) => { e.preventDefault(); saveEditor(a.id, form, ed); });
		$$('[data-edclose]', ed).forEach((b) => b.addEventListener('click', closeEditor));
		ed.addEventListener('click', (e) => { if (e.target === ed) { closeEditor(); } });
		$$('[data-pick]', ed).forEach((b) => b.addEventListener('click', () => pickImage(b.getAttribute('data-pick'), form)));
		$$('[data-clearimg]', ed).forEach((b) => b.addEventListener('click', () => { const k = b.getAttribute('data-clearimg'); form.elements[k].value = ''; form.elements[k + '_id'].value = ''; refreshPreview(k, form, a); }));
		$$('input[type=url]', ed).forEach((inp) => inp.addEventListener('change', () => { form.elements[inp.name + '_id'].value = ''; refreshPreview(inp.name, form, a); }));
		const rs = $('[data-reset]', ed); if (rs) { rs.addEventListener('click', () => resetApp(a.id, ed)); }
		const first = $('input[name=name]', ed); if (first) { first.focus(); }
	}
	function closeEditor() { state.editing = null; const ed = document.getElementById('mmdv2-ed'); if (ed) { ed.classList.remove('open'); ed.innerHTML = ''; } if (!state.detail) { document.body.classList.remove('mmdv2-lock'); } }
	function refreshPreview(k, form, a) {
		const prev = $(`[data-prev="${k}"]`); if (!prev) { return; }
		const url = form.elements[k].value.trim();
		prev.innerHTML = url ? `<img src="${esc(url)}" alt="">` : `<span class="mmdv2-imgprev-art">${ART[a.id] ? ART[a.id]('ed2' + k + a.id) : ''}</span>`;
	}
	function pickImage(k, form) {
		if (!(window.wp && window.wp.media)) { return; }
		const frame = window.wp.media({ title: 'Choose an image', button: { text: 'Use this image' }, library: { type: 'image' }, multiple: false });
		frame.on('select', () => {
			const att = frame.state().get('selection').first().toJSON();
			const size = att.sizes && (att.sizes.large || att.sizes.full) ? (att.sizes.large || att.sizes.full).url : att.url;
			form.elements[k].value = size; form.elements[k + '_id'].value = att.id;
			refreshPreview(k, form, appOf(state.editing || FEATURED[0]));
		});
		frame.open();
	}
	function collectEditor(form) {
		const g = (n) => (form.elements[n] ? form.elements[n].value.trim() : '');
		const payload = {};
		['name', 'cat', 'sub', 'adminSub', 'one', 'problem', 'how', 'outcome', 'when', 'cta', 'cta2', 'launch', 'card_image', 'detail_image'].forEach((k) => { payload[k] = g(k); });
		payload.card_image_id = g('card_image_id'); payload.detail_image_id = g('detail_image_id');
		payload.benefits = [];
		for (let k = 0; k < 5; k++) { const f = g('bf' + k), b = g('bb' + k); if (f) { payload.benefits.push([f, b]); } }
		return payload;
	}
	function saveEditor(id, form, ed) {
		if (state.saving) { return; }
		const status = $('.mmdv2-edstatus', ed); state.saving = true; status.textContent = 'Saving…';
		app.api.put('/dashboard/featured-apps/' + id, collectEditor(form)).then((res) => {
			state.saving = false;
			if (res && res.apps) { state.apps = normalizeApps(res.apps); }
			closeEditor(); renderDashboard(); if (state.detail === id) { openDetail(id); }
			toast(`<b>${esc(appOf(id).name)}</b> saved. Every student sees the update on their next load.`);
		}, (err) => { state.saving = false; status.textContent = (err && err.message) ? err.message : 'Save failed — check you are still signed in as an administrator.'; });
	}
	function resetApp(id, ed) {
		if (!window.confirm('Reset ' + appOf(id).name + ' to the MissionMed default copy and built-in art?')) { return; }
		app.api.delete('/dashboard/featured-apps/' + id).then((res) => {
			if (res && res.apps) { state.apps = normalizeApps(res.apps); }
			closeEditor(); renderDashboard(); if (state.detail === id) { openDetail(id); } toast('Defaults restored.');
		}, () => toast('Reset failed — please try again.'));
	}

	/* ------------------------------------------------------------------ */
	/* Locked-art WebGL morph — MX-DASH-6010B admin canary only.           */
	/* ------------------------------------------------------------------ */
	const morph = (() => {
		const duration = 820;
		const diag = window.MMED_DASH_MORPH_DIAGNOSTICS = {
			canary: morphCanary, mode: 'idle', transitions: 0, frames: 0,
			averageFrameInterval: 0, maxFrameInterval: 0, activeContexts: 0,
			maxContexts: 0, contextsCreated: 0, contextsDisposed: 0, failures: 0,
			resourceSetsCreated: 0, resourceSetsDisposed: 0,
			shaderCompileMs: 0, lastApp: null, endpoint: 'pencil'
		};
		let active = null, preloadObserver = null, viewportObserver = null;
		let listeners = [], nodes = [], intervalTotal = 0, intervalCount = 0;
		let sharedCanvas = null, sharedGL = null, sharedProgram = null, sharedBuffer = null, sharedPosition = -1, sharedProgressLocation = null, warmCancel = null;

		const vertexSource = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main(){v_uv=(a_position+1.0)*0.5;gl_Position=vec4(a_position,0.0,1.0);}`;
		const fragmentSource = `#version 300 es
precision highp float;
uniform sampler2D u_pencil;
uniform sampler2D u_cinematic;
uniform float u_progress;
uniform vec2 u_resolution;
in vec2 v_uv;
out vec4 outColor;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
void main(){
  if(u_progress<=0.00001){outColor=texture(u_pencil,v_uv);return;}
  if(u_progress>=0.99999){outColor=texture(u_cinematic,v_uv);return;}
  float p=clamp(u_progress,0.0,1.0);
  float grain=hash(floor(v_uv*u_resolution*0.18));
  float sweep=v_uv.x*0.64+(1.0-v_uv.y)*0.36+(grain-0.5)*0.16;
  float mask=smoothstep(sweep-0.105,sweep+0.105,p);
  float pulse=sin(3.14159265*p);
  vec2 wave=vec2(sin(v_uv.y*18.0+grain*4.0),cos(v_uv.x*15.0-grain*3.0))*0.018*pulse;
  vec4 pencil=texture(u_pencil,clamp(v_uv-wave*mask,0.0,1.0));
  vec4 cinema=texture(u_cinematic,clamp(v_uv+wave*(1.0-mask),0.0,1.0));
  vec2 px=1.0/u_resolution;
  float l0=dot(texture(u_pencil,v_uv).rgb,vec3(0.299,0.587,0.114));
  float lx=dot(texture(u_pencil,clamp(v_uv+vec2(px.x*2.0,0.0),0.0,1.0)).rgb,vec3(0.299,0.587,0.114));
  float ly=dot(texture(u_pencil,clamp(v_uv+vec2(0.0,px.y*2.0),0.0,1.0)).rgb,vec3(0.299,0.587,0.114));
  float edge=clamp((abs(l0-lx)+abs(l0-ly))*4.2,0.0,1.0);
  float seam=1.0-smoothstep(0.0,0.055,abs(sweep-p));
  vec3 color=mix(pencil.rgb,cinema.rgb,mask);
  color+=vec3(1.0,0.62,0.18)*edge*seam*0.55;
  color=(color-0.5)*(1.0+0.16*pulse)+0.5;
  outColor=vec4(color,mix(pencil.a,cinema.a,mask));
}`;

		function listen(node, type, fn) { node.addEventListener(type, fn); listeners.push(() => node.removeEventListener(type, fn)); }
		function loadTarget(node) {
			const img = $('.mmdv2-morph-cinematic', node);
			if (!img) { return Promise.reject(new Error('Missing cinematic endpoint')); }
			if (!img.getAttribute('src')) { img.src = img.getAttribute('data-src') || ''; }
			if (img.complete && img.naturalWidth) { return Promise.resolve(img); }
			return new Promise((resolve, reject) => {
				img.addEventListener('load', () => resolve(img), { once: true });
				img.addEventListener('error', () => reject(new Error('Cinematic endpoint failed to load')), { once: true });
			});
		}
		function compile(gl, type, source) {
			const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { const message = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(message || 'Shader compile failed'); }
			return shader;
		}
		function texture(gl, image, unit) {
			const value = gl.createTexture(); gl.activeTexture(unit); gl.bindTexture(gl.TEXTURE_2D, value);
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image); return value;
		}
		function ensureRenderer() {
			if (sharedGL && sharedProgram && sharedBuffer) {
				return { canvas: sharedCanvas, gl: sharedGL, program: sharedProgram, buffer: sharedBuffer, position: sharedPosition, progressLocation: sharedProgressLocation };
			}
			if (!sharedCanvas) { sharedCanvas = document.createElement('canvas'); sharedCanvas.className = 'mmdv2-morph-canvas'; sharedCanvas.setAttribute('aria-hidden', 'true'); }
			const started = performance.now();
			const gl = sharedCanvas.getContext('webgl2', { alpha: false, antialias: true, powerPreference: 'high-performance' });
			if (!gl) { sharedCanvas = null; return null; }
			sharedGL = gl; diag.contextsCreated += 1;
			try {
				const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource), fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
				const program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment);
				if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { throw new Error(gl.getProgramInfoLog(program) || 'Program link failed'); }
				const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
				sharedProgram = program; sharedBuffer = buffer; sharedPosition = gl.getAttribLocation(program, 'a_position'); sharedProgressLocation = gl.getUniformLocation(program, 'u_progress');
				diag.shaderCompileMs = performance.now() - started;
				return { canvas: sharedCanvas, gl, program, buffer, position: sharedPosition, progressLocation: sharedProgressLocation };
			} catch (error) {
				diag.failures += 1; destroySharedContext(); return null;
			}
		}
		function fallback(node, on, reason) {
			loadTarget(node).catch(() => { diag.failures += 1; });
			node.classList.add('mmdv2-morph-fallback');
			node.classList.toggle('is-target', on);
			diag.mode = reduceMotion() ? 'reduced-motion' : 'css-fallback';
			diag.lastApp = node.getAttribute('data-morph-app'); diag.endpoint = on ? 'cinematic' : 'pencil';
			if (reason) { node.setAttribute('data-morph-fallback', reason); }
		}
		function releaseContext(item, endpoint) {
			if (!item) { return; }
			if (item.raf) { cancelAnimationFrame(item.raf); }
			const gl = item.gl;
			if (gl) {
				item.textures.forEach((value) => gl.deleteTexture(value));
				diag.resourceSetsDisposed += 1; diag.activeContexts = Math.max(0, diag.activeContexts - 1);
			}
			if (item.canvas && item.canvas.isConnected) { item.canvas.remove(); }
			item.node.classList.remove('is-running');
			if (endpoint === 'cinematic') { item.node.classList.add('is-target'); }
			if (endpoint === 'pencil') { item.node.classList.remove('is-target'); }
			if (active === item) { active = null; }
			diag.endpoint = endpoint || diag.endpoint;
		}
		function destroySharedContext() {
			if (sharedGL) {
				if (sharedBuffer) { sharedGL.deleteBuffer(sharedBuffer); }
				if (sharedProgram) { sharedGL.deleteProgram(sharedProgram); }
				const lose = sharedGL.getExtension('WEBGL_lose_context'); if (lose) { lose.loseContext(); }
				diag.contextsDisposed += 1; sharedGL = null;
			}
			if (sharedCanvas && sharedCanvas.isConnected) { sharedCanvas.remove(); }
			sharedCanvas = null; sharedProgram = null; sharedBuffer = null; sharedPosition = -1; sharedProgressLocation = null;
		}
		function render(item) {
			item.gl.useProgram(item.program);
			item.gl.uniform1f(item.progressLocation, item.progress);
			item.gl.drawArrays(item.gl.TRIANGLES, 0, 6);
		}
		function tick(time) {
			const item = active; if (!item) { return; }
			if (document.hidden) { item.raf = 0; item.lastTime = 0; return; }
			if (item.lastTime) {
				const rawInterval = time - item.lastTime, step = Math.min(80, rawInterval);
				item.progress = Math.max(0, Math.min(1, item.progress + item.direction * step / duration));
				intervalTotal += rawInterval; intervalCount += 1; diag.averageFrameInterval = intervalTotal / intervalCount; diag.maxFrameInterval = Math.max(diag.maxFrameInterval, rawInterval);
			}
			item.lastTime = time; diag.frames += 1; render(item);
			if ((item.direction > 0 && item.progress >= 1) || (item.direction < 0 && item.progress <= 0)) {
				releaseContext(item, item.progress >= 1 ? 'cinematic' : 'pencil'); return;
			}
			item.raf = requestAnimationFrame(tick);
		}
		async function start(node, on) {
			node._mmdv2MorphWanted = on;
			if (reduceMotion()) { fallback(node, on, 'reduced-motion'); return; }
			try { await loadTarget(node); } catch (error) { diag.failures += 1; fallback(node, on, 'image-load'); return; }
			if (node._mmdv2MorphWanted !== on || !node.isConnected) { return; }
			if (active && active.node === node) {
				active.direction = on ? 1 : -1; active.lastTime = 0; diag.transitions += 1;
				if (!active.raf) { active.raf = requestAnimationFrame(tick); } return;
			}
			if (active) { releaseContext(active, active.progress >= .5 ? 'cinematic' : 'pencil'); }
			if (warmCancel) { warmCancel(); warmCancel = null; }
			const renderer = ensureRenderer();
			if (!renderer) { fallback(node, on, 'webgl2-unavailable'); return; }
			const canvas = renderer.canvas, gl = renderer.gl, program = renderer.program, buffer = renderer.buffer;
			node.appendChild(canvas);
			const pencil = $('.mmdv2-morph-pencil', node), cinematic = $('.mmdv2-morph-cinematic', node);
			try {
				const rect = node.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
				canvas.width = Math.max(1, Math.round(rect.width * dpr)); canvas.height = Math.max(1, Math.round(rect.height * dpr)); gl.viewport(0, 0, canvas.width, canvas.height);
				gl.useProgram(program);
				gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.enableVertexAttribArray(renderer.position); gl.vertexAttribPointer(renderer.position, 2, gl.FLOAT, false, 0, 0);
				const textures = [texture(gl, pencil, gl.TEXTURE0), texture(gl, cinematic, gl.TEXTURE1)];
				gl.uniform1i(gl.getUniformLocation(program, 'u_pencil'), 0); gl.uniform1i(gl.getUniformLocation(program, 'u_cinematic'), 1);
				gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), canvas.width, canvas.height);
				active = { node, canvas, gl, program, textures, progressLocation: renderer.progressLocation, progress: node.classList.contains('is-target') ? 1 : 0, direction: on ? 1 : -1, lastTime: 0, raf: 0 };
				diag.mode = 'webgl2'; diag.transitions += 1; diag.resourceSetsCreated += 1; diag.activeContexts += 1; diag.maxContexts = Math.max(diag.maxContexts, diag.activeContexts); diag.lastApp = node.getAttribute('data-morph-app');
				node.classList.remove('mmdv2-morph-fallback'); node.classList.add('is-running'); active.raf = requestAnimationFrame(tick);
			} catch (error) {
				diag.failures += 1; destroySharedContext();
				fallback(node, on, 'webgl-init');
			}
		}
		function set(node, on) { if (node) { start(node, on); } }
		function bind(root) {
			dispose(); nodes = $$('.mmdv2-morph', root);
			if (!nodes.length) { diag.mode = morphCanary ? 'idle' : 'disabled'; return; }
			if (window.IntersectionObserver) {
				preloadObserver = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { loadTarget(entry.target).catch(() => { diag.failures += 1; }); preloadObserver.unobserve(entry.target); } }), { rootMargin: '280px' });
				nodes.forEach((node) => preloadObserver.observe(node));
			}
			const coarse = window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches;
			nodes.forEach((node) => {
				if (!coarse) {
					const card = node.closest('.mmdv2-card') || node;
					listen(card, 'mouseenter', () => set(node, true)); listen(card, 'mouseleave', () => set(node, false));
					listen(card, 'focusin', () => set(node, true)); listen(card, 'focusout', () => set(node, false));
				}
			});
			if (coarse && window.IntersectionObserver) {
				viewportObserver = new IntersectionObserver((entries) => entries.forEach((entry) => {
					if (entry.intersectionRatio >= .72) { set(entry.target, true); } else if (active && active.node === entry.target && entry.intersectionRatio < .35) { set(entry.target, false); }
				}), { threshold: [.35, .72] }); nodes.forEach((node) => viewportObserver.observe(node));
			}
			if (!reduceMotion()) {
				const warm = () => { warmCancel = null; ensureRenderer(); };
				if (window.requestIdleCallback) {
					const id = requestIdleCallback(warm, { timeout: 600 }); warmCancel = () => cancelIdleCallback(id);
				} else {
					const id = setTimeout(warm, 60); warmCancel = () => clearTimeout(id);
				}
			}
		}
		function dispose() {
			if (preloadObserver) { preloadObserver.disconnect(); preloadObserver = null; }
			if (viewportObserver) { viewportObserver.disconnect(); viewportObserver = null; }
			if (warmCancel) { warmCancel(); warmCancel = null; }
			listeners.forEach((off) => off()); listeners = []; nodes.forEach((node) => { node._mmdv2MorphWanted = false; }); nodes = [];
			if (active) { releaseContext(active, active.progress >= .5 ? 'cinematic' : 'pencil'); }
			destroySharedContext();
		}
		document.addEventListener('visibilitychange', () => { if (!active || document.hidden || active.raf) { return; } active.lastTime = 0; active.raf = requestAnimationFrame(tick); });
		return { bind, dispose };
	})();

	/* ------------------------------------------------------------------ */
	/* Ambient background — constellation canvas + CSS aurora              */
	/* ------------------------------------------------------------------ */
	let bgFrame = 0, bgCanvas = null;
	function startBackground(el) {
		const canvas = $('.mmdv2-stars', el);
		if (!canvas) { return; }
		if (bgFrame) { cancelAnimationFrame(bgFrame); bgFrame = 0; }
		bgCanvas = canvas;
		if (reduceMotion()) { drawStatic(canvas); return; }
		const ctx = canvas.getContext('2d'); if (!ctx) { return; }
		const count = isNarrow() ? 28 : 64;
		let w = 0, h = 0, pts = [], last = 0;
		const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
		const resize = () => { const r = canvas.parentElement.getBoundingClientRect(); w = Math.max(1, r.width); h = Math.max(1, r.height); canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); if (!pts.length) { for (let i = 0; i < count; i++) { pts.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .12, vy: (Math.random() - .5) * .09, r: .6 + Math.random() * 1.4, p: Math.random() * Math.PI * 2 }); } } };
		resize();
		const ro = window.ResizeObserver ? new ResizeObserver(resize) : null; if (ro) { ro.observe(canvas.parentElement); }
		const tick = (t) => {
			bgFrame = requestAnimationFrame(tick);
			if (document.hidden || !canvas.isConnected) { return; }
			if (t - last < 33) { return; } last = t;
			ctx.clearRect(0, 0, w, h);
			for (const p of pts) { p.x += p.vx; p.y += p.vy; if (p.x < -10) { p.x = w + 10; } if (p.x > w + 10) { p.x = -10; } if (p.y < -10) { p.y = h + 10; } if (p.y > h + 10) { p.y = -10; } }
			ctx.lineWidth = 1;
			for (let i = 0; i < pts.length; i++) { for (let j = i + 1; j < pts.length; j++) { const a = pts[i], b = pts[j]; const dx = a.x - b.x, dy = a.y - b.y; const d2 = dx * dx + dy * dy; if (d2 < 150 * 150) { ctx.strokeStyle = `rgba(120,200,255,${(0.16 * (1 - Math.sqrt(d2) / 150)).toFixed(3)})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } } }
			for (const p of pts) { const tw = .55 + .45 * Math.sin(t / 1400 + p.p); ctx.fillStyle = `rgba(200,236,255,${(0.5 * tw).toFixed(3)})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
		};
		bgFrame = requestAnimationFrame(tick);
	}
	function drawStatic(canvas) {
		const ctx = canvas.getContext('2d'); if (!ctx) { return; }
		const r = canvas.parentElement.getBoundingClientRect(); canvas.width = r.width; canvas.height = r.height;
		for (let i = 0; i < 60; i++) { ctx.fillStyle = `rgba(200,236,255,${(0.2 + Math.random() * 0.4).toFixed(2)})`; ctx.beginPath(); ctx.arc(Math.random() * r.width, Math.random() * r.height, .6 + Math.random() * 1.2, 0, Math.PI * 2); ctx.fill(); }
	}
	window.addEventListener('hashchange', () => { if ((window.location.hash.replace(/^#\/?/, '') || 'dashboard') !== 'dashboard') { morph.dispose(); if (bgFrame) { cancelAnimationFrame(bgFrame); bgFrame = 0; } const root = document.getElementById('student-os-root'); if (root) { root.classList.remove('mmdv2-active'); } closeDetail(); closeEditor(); } });

	/* ------------------------------------------------------------------ */
	let toastTimer = 0;
	function toast(html) { const t = document.getElementById('mmdv2-toast'); if (!t) { return; } t.innerHTML = html; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 3200); }

	/* Re-render on data arrival is handled by V1's loaders calling app.render.dashboard(). */
})();
