/** StoryForge Calendar V2 renderer — R6 V1-first reskin. */
(function (global, document) {
	'use strict';

	var instance = null;
	var unsubscribe = null;
	var selectedEventId = '';
	var drawerReturnEventId = '';
	var drawerNeedsFocus = false;
	var drillTab = 'Step/Level 1';
	var armedDrill = null;
	var announcement = '';
	var perspective = '';
	var drillsOpen = false;
	var eventFormMode = '';
	var eventFormId = '';
	var todoDetailId = '';
	var dragEventId = '';
	var syncOpen = false;
	var categoryCollapsed = {};
	var mobileRailOpen = false;
	var eventPrefillCategory = '';
	var eventPrefillDate = '';

	var V1_CATEGORIES = [
		{ id: 'exam_prep', name: 'ExamPrep', color: '#24b7ed', sortOrder: 10, parentId: '', adminOnly: false },
		{ id: 'drill_step1', name: "Dr. J\u2019s Drills \u2014 Step/Level 1", color: '#35c8f5', sortOrder: 11, parentId: 'exam_prep', adminOnly: true },
		{ id: 'drill_step23', name: "Dr. J\u2019s Drills \u2014 Step/Level 2 & 3", color: '#7b8cff', sortOrder: 12, parentId: 'exam_prep', adminOnly: true },
		{ id: 'mission_residency', name: 'Mission Residency', color: '#efc84f', sortOrder: 20, parentId: '', adminOnly: false },
		{ id: 'mr_session_a', name: 'Session A', color: '#f4d56e', sortOrder: 21, parentId: 'mission_residency', adminOnly: false },
		{ id: 'mr_session_b', name: 'Session B', color: '#f4d56e', sortOrder: 22, parentId: 'mission_residency', adminOnly: false },
		{ id: 'mr_session_c', name: 'Session C', color: '#f4d56e', sortOrder: 23, parentId: 'mission_residency', adminOnly: false },
		{ id: 'mr_session_d', name: 'Session D', color: '#f4d56e', sortOrder: 24, parentId: 'mission_residency', adminOnly: false },
		{ id: 'mr_session_e', name: 'Session E', color: '#f4d56e', sortOrder: 25, parentId: 'mission_residency', adminOnly: false },
		{ id: 'mr_session_f', name: 'Session F', color: '#f4d56e', sortOrder: 26, parentId: 'mission_residency', adminOnly: false },
		{ id: 'clinicals', name: 'Clinicals', color: '#3ed597', sortOrder: 30, parentId: '', adminOnly: false },
		{ id: 'nrmp', name: 'NRMP', color: '#ff5c7a', sortOrder: 40, parentId: '', adminOnly: false },
		{ id: 'arena', name: 'Arena', color: '#8b5cf6', sortOrder: 50, parentId: '', adminOnly: false },
		{ id: 'appointments', name: 'My Appointments', color: '#56d8f5', sortOrder: 60, parentId: '', adminOnly: false }
	];

	var TRACKER_PHASES = [
		{ id: 'cv', label: 'CV Building', start: '2026-01-01', end: '2026-04-30', icon: '&#128196;' },
		{ id: 'lors-ps', label: 'LORs & PS', start: '2026-05-01', end: '2026-07-31', icon: '&#9997;' },
		{ id: 'eras', label: 'ERAS Application', start: '2026-08-01', end: '2026-10-31', icon: '&#128233;' },
		{ id: 'interviews', label: 'Interviews', start: '2026-11-01', end: '2027-01-31', icon: '&#127908;' },
		{ id: 'rank', label: 'Rank List', start: '2027-02-01', end: '2027-02-28', icon: '&#128202;' },
		{ id: 'match', label: 'Match', start: '2027-03-01', end: '2027-03-31', icon: '&#127942;' }
	];
	var MATCH_DAY = '2027-03-15';
	var SPECIALTIES = ['Internal Medicine','Family Medicine','Pediatrics','OB/GYN','Surgery','Psychiatry','Neurology','Emergency Medicine','Radiology','Pathology','Anesthesiology','Dermatology','Ophthalmology','Orthopedics','Urology','PM&R','Cardiology','Pulmonology','Other'];

	function esc(value) {
		return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character];
		});
	}

	function categoryLabel(category) {
		return { live: 'Live session', strategy: 'Strategy session', appointment: 'Appointment', deadline: 'Deadline', assignment: 'Assignment', drills: 'Drills', drill_step1: 'Drills \u00b7 Step/Level 1', drill_step23: 'Drills \u00b7 Step/Level 2 & 3', nrmp: 'NRMP', clinicals: 'Clinicals', arena: 'Arena', mission_residency: 'Mission Residency', mr_session_a: 'Session A', mr_session_b: 'Session B', mr_session_c: 'Session C', mr_session_d: 'Session D', mr_session_e: 'Session E', mr_session_f: 'Session F' }[category] || 'Calendar';
	}

	function effectivePerspective(state, requested) {
		if (!state || !state.capabilities || !state.capabilities.admin) return 'student';
		return (requested || perspective) === 'student' ? 'student' : 'administrator';
	}

	function perspectiveControl(state) {
		if (!state.capabilities || !state.capabilities.admin) return '<span class="mcv2-role-pill">Student view</span>';
		var active = effectivePerspective(state);
		return '<div class="mcv2-perspective" role="group" aria-label="Calendar perspective">' +
			'<button type="button" data-perspective="student" aria-pressed="' + (active === 'student') + '">Student view</button>' +
			'<button type="button" data-perspective="administrator" aria-pressed="' + (active === 'administrator') + '">Administrator view</button>' +
			'</div>';
	}

	function viewSwitcher(state) {
		return '<div class="mcv2-view-switcher" role="group" aria-label="Calendar view">' + ['month','week','day','agenda'].map(function (view) {
			return '<button type="button" data-view="' + view + '" aria-pressed="' + (state.view === view) + '">' + view.charAt(0).toUpperCase() + view.slice(1) + '</button>';
		}).join('') + '</div>';
	}

	function viewHeading(view) {
		var label = { month: 'Month', week: 'Week', day: 'Day', agenda: 'Agenda' }[view] || 'Today';
		return esc(label) + (view === 'today' ? '' : ' <em>view</em>');
	}

	function eventRow(event, compact, draggable) {
		var dragAttr = draggable && event.writable ? ' draggable="true" data-drag-event="' + esc(event.id) + '"' : '';
		return '<button type="button" class="mcv2-event mcv2-event--' + esc(event.category) + (compact ? ' is-compact' : '') + '" data-event-id="' + esc(event.id) + '"' + dragAttr + '>' +
			'<span class="mcv2-event-time">' + esc(event.timeLabel) + '</span>' +
			'<span class="mcv2-event-copy"><strong>' + esc(event.title) + '</strong><small>' + esc(categoryLabel(event.category)) + '</small></span>' +
			(event.favorite || event.important ? '<span class="mcv2-star" aria-label="Important">\u2605</span>' : '') +
			(event.replayUrl ? '<span class="mcv2-chip is-replay">Watch replay</span>' : event.joinUrl ? '<span class="mcv2-chip">Join</span>' : '') +
			'</button>';
	}

	function durationBar(event) {
		if (!event.writable) return '';
		return '<div class="mcv2-duration-bar">' +
			'<button type="button" data-duration-minus="' + esc(event.id) + '" aria-label="Shorten 15 min">&minus;</button>' +
			'<span class="mcv2-duration-label">' + esc(event.timeLabel + (event.endTimeLabel ? ' \u2013 ' + event.endTimeLabel : '')) + '</span>' +
			'<button type="button" data-duration-plus="' + esc(event.id) + '" aria-label="Extend 15 min">+</button>' +
			'</div>';
	}

	function categoryRail(state) {
		var categories = state.categories && state.categories.length ? state.categories : [];
		if (!categories.length) {
			var message = state.categoriesStatus === 'error' ? 'Calendar sources could not be loaded.' : state.categoriesStatus === 'empty' ? 'No Calendar sources are available.' : 'Loading Calendar sources…';
			return '<section class="mcv2-category-rail" aria-label="Calendar sources"><p class="mcv2-rail-label">Sources</p>' + empty(message) + '</section>';
		}
		categories = categories.slice().sort(function (a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); });
		var byParent = {};
		categories.forEach(function (c) { var key = c.parentId || ''; if (!byParent[key]) byParent[key] = []; byParent[key].push(c); });
		function draw(parentId, depth) {
			return (byParent[parentId] || []).map(function (cat) {
				if (cat.adminOnly && effectivePerspective(state) !== 'administrator') return '';
				var children = byParent[cat.id];
				var hasChildren = children && children.length > 0;
				var collapsed = hasChildren && categoryCollapsed[cat.id] !== false;
				var visible = state.visibility && state.visibility[cat.id] === false ? false : true;
				var toggle = hasChildren ? '<button type="button" class="mcv2-category-toggle" data-toggle-collapse="' + esc(cat.id) + '" aria-label="' + (collapsed ? 'Expand' : 'Collapse') + ' ' + esc(cat.name) + '">' + (collapsed ? '\u25b8' : '\u25be') + '</button>' : '';
				var draggable = !hasChildren && effectivePerspective(state) === 'administrator' && !/^drill_/.test(cat.id) ? ' draggable="true" data-drag-category="' + esc(cat.id) + '"' : '';
				var childHtml = hasChildren && !collapsed ? draw(cat.id, depth + 1) : '';
				return '<div class="mcv2-category-node mcv2-category-node--depth-' + depth + '"><div class="mcv2-category-row">' + toggle +
					'<button type="button" class="mcv2-category" data-category-id="' + esc(cat.id) + '" aria-pressed="' + visible + '" style="--category-color:' + esc(cat.color) + '"' + draggable + '><span class="mcv2-category-dot"></span><span>' + esc(cat.name) + '</span></button></div>' + childHtml + (cat.id === 'exam_prep' && effectivePerspective(state) === 'administrator' && !collapsed ? '<button type="button" class="mcv2-drills-button" data-toggle-drills aria-expanded="' + drillsOpen + '"><span aria-hidden="true">&#10022;</span> Schedule Dr. J\'s Drills</button>' + renderDrillsRail(state) : '') + '</div>';
			}).join('');
		}
		return '<section class="mcv2-category-rail" aria-label="Calendar sources"><p class="mcv2-rail-label">Sources</p>' + draw('', 0) + '</section>';
	}

	function miniCalendar(model, state) {
		return '<section class="mcv2-mini-calendar" aria-label="Mini calendar"><header><button type="button" data-mini-nav="-1" aria-label="Previous month">&lsaquo;</button><strong>' + esc(global.MMEDCalendarCore.classicFormat(state.date, 'monthYear')) + '</strong><button type="button" data-mini-nav="1" aria-label="Next month">&rsaquo;</button></header><div class="mcv2-mini-grid">' + model.monthDays.map(function (day) { return '<button type="button" class="' + (day.outside ? 'is-outside ' : '') + (day.key === model.selectedKey ? 'is-selected ' : '') + (day.today ? 'is-today' : '') + '" data-mini-day="' + day.key + '">' + esc(day.label) + '</button>'; }).join('') + '<button type="button" class="mcv2-mini-today" data-today>Today</button></div></section>';
	}

	function todoRail(state) {
		var todos = state.todos || [];
		var pending = todos.filter(function (t) { return !t.completed; });
		var done = todos.filter(function (t) { return t.completed; });
		var sorted = pending.concat(done).slice(0, 8);
		return '<section class="mcv2-todo-rail" aria-label="My tasks"><header><p class="mcv2-rail-label">My tasks</p><span>' + pending.length + '</span></header>' + (sorted.map(function (todo) {
			var pri = todo.priority === 'high' ? ' is-high' : todo.priority === 'low' ? ' is-low' : '';
			return '<div class="mcv2-todo-item' + (todo.completed ? ' is-done' : '') + pri + '"><input type="checkbox" data-toggle-todo="' + esc(todo.id) + '"' + (todo.completed ? ' checked' : '') + '><button type="button" class="mcv2-todo-text" data-todo-detail="' + esc(todo.id) + '">' + esc(todo.title) + (todo.dueDate ? '<small>' + esc(todo.dueDate) + '</small>' : '') + '</button></div>';
		}).join('') || empty('No tasks yet.')) + '<form class="mcv2-todo-form" data-create-todo><input name="title" type="text" maxlength="120" placeholder="Add a task" aria-label="Add a task"><button type="submit" aria-label="Add task">+</button></form></section>';
	}

	function empty(message) {
		return '<p class="mcv2-empty">' + esc(message) + '</p>';
	}

	function renderMonth(model, state) {
		var isAdmin = effectivePerspective(state) === 'administrator';
		var eventLimit = global.innerWidth <= 560 ? 4 : global.innerHeight <= 900 ? 1 : 3;
		var weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(function (day) { return '<div class="mcv2-weekday">' + day + '</div>'; }).join('');
		var cells = model.monthDays.map(function (day) {
			var events = day.events.slice(0, eventLimit).map(function (event) { return eventRow(event, true, isAdmin); }).join('');
			var more = day.events.length > eventLimit ? '<button type="button" class="mcv2-more" data-day="' + day.key + '">+' + (day.events.length - eventLimit) + ' more</button>' : '';
			return '<section class="mcv2-month-day' + (day.outside ? ' is-outside' : '') + (day.today ? ' is-today' : '') + '" data-drop-day="' + day.key + '" aria-label="' + esc(day.fullLabel) + '">' +
				'<button type="button" class="mcv2-day-number" data-day="' + day.key + '" aria-label="Open ' + esc(day.fullLabel) + '">' + esc(day.label) + '</button>' +
				'<div class="mcv2-day-events">' + events + more + '</div>' +
				(state.capabilities.admin && armedDrill ? '<button type="button" class="mcv2-schedule-here" data-schedule-day="' + day.key + '">Schedule here</button>' : '') +
				'</section>';
		}).join('');
		return '<div class="mcv2-month" role="grid" aria-label="' + esc(model.title) + '"><div class="mcv2-weekdays">' + weekdays + '</div><div class="mcv2-month-grid">' + cells + '</div></div>';
	}

	function timeLabels() {
		var labels = [];
		for (var hour = 6; hour <= 22; hour += 1) labels.push('<span style="top:' + ((hour - 6) * 60) + 'px">' + esc(hour === 12 ? '12 PM' : hour > 12 ? (hour - 12) + ' PM' : hour + ' AM') + '</span>');
		return labels.join('');
	}

	function timeEvent(event, isAdmin) {
		var top = event.layout ? event.layout.top : 0;
		var height = event.layout ? event.layout.height : 38;
		var drag = isAdmin && event.writable ? ' draggable="true" data-drag-event="' + esc(event.id) + '"' : '';
		return '<div class="mcv2-time-event mcv2-event--' + esc(event.category) + '" style="top:' + top + 'px;height:' + height + 'px"' + drag + '>' +
			'<button type="button" data-event-id="' + esc(event.id) + '"><span>' + esc(global.MMEDCalendarCore.classicFormat(event.start, 'time')) + '</span><strong>' + esc(event.title) + '</strong></button>' +
			(isAdmin && event.writable ? '<button type="button" class="mcv2-resize-handle" data-resize-event="' + esc(event.id) + '" aria-label="Adjust duration of ' + esc(event.title) + '"></button>' : '') +
			'</div>';
	}

	function renderWeek(model, state) {
		var isAdmin = effectivePerspective(state) === 'administrator';
		var grid = global.MMEDCalendarCore.classicWeekGrid(state.date, global.MMEDCalendarCore.visibleEvents(state));
		var heads = grid.days.map(function (day) { return '<div class="mcv2-time-day-head' + (day.today ? ' is-today' : '') + '"><span>' + esc(global.MMEDCalendarCore.classicFormat(day.key, 'shortDay')) + '</span><strong>' + esc(day.label) + '</strong></div>'; }).join('');
		var columns = grid.days.map(function (day) { return '<section class="mcv2-time-day' + (day.today ? ' is-today' : '') + '" data-drop-day="' + day.key + '">' + day.events.map(function (event) { return timeEvent(event, isAdmin); }).join('') + (state.capabilities.admin && armedDrill ? '<button type="button" class="mcv2-schedule-here" data-schedule-day="' + day.key + '">Schedule here</button>' : '') + '</section>'; }).join('');
		return '<div class="mcv2-time-grid mcv2-time-grid--week"><div class="mcv2-time-head-spacer"></div><div class="mcv2-time-heads">' + heads + '</div><div class="mcv2-time-scroll"><div class="mcv2-time-labels">' + timeLabels() + '</div><div class="mcv2-time-columns">' + columns + '</div></div></div>';
	}

	function renderDay(model, state) {
		var isAdmin = effectivePerspective(state) === 'administrator';
		var grid = global.MMEDCalendarCore.classicDayGrid(state.selectedDate || state.date, global.MMEDCalendarCore.visibleEvents(state));
		return '<div class="mcv2-time-grid mcv2-time-grid--day"><div class="mcv2-time-day-title"><span>' + esc(grid.dayName) + '</span><strong>' + esc(grid.dayFull) + '</strong></div><div class="mcv2-time-scroll"><div class="mcv2-time-labels">' + timeLabels() + '</div><section class="mcv2-time-columns mcv2-time-columns--day"><div class="mcv2-time-day" data-drop-day="' + esc(global.MMEDCalendarCore.dateKey(state.selectedDate || state.date)) + '">' + grid.events.map(function (event) { return timeEvent(event, isAdmin); }).join('') + (state.capabilities.admin && armedDrill ? '<button type="button" class="mcv2-schedule-here" data-schedule-day="' + esc(global.MMEDCalendarCore.dateKey(state.selectedDate || state.date)) + '">Schedule here</button>' : '') + '</div></section></div></div>';
	}

	function renderAgenda(model) {
		return '<section class="mcv2-list-panel"><p class="mcv2-kicker">Upcoming</p>' +
			(model.agenda.length ? model.agenda.map(function (event) { return '<div class="mcv2-agenda-date">' + esc(event.dateLabel) + '</div>' + eventRow(event, false); }).join('') : empty('No upcoming events.')) + '</section>';
	}

	function panel(title, items, fallback, className) {
		return '<section class="mcv2-card ' + (className || '') + '"><h2>' + esc(title) + '</h2>' + (items.length ? items.join('') : empty(fallback)) + '</section>';
	}

	function renderToday(model, state) {
		var schedule = model.todayEvents.map(function (event) { return eventRow(event, false); });
		var deadlines = model.deadlines.map(function (event) { return eventRow(event, true); });
		var appointments = model.appointments.map(function (event) { return eventRow(event, true); });
		var replays = model.replays.map(function (event) { return eventRow(event, false); });
		var todos = model.todos.map(function (todo) { return '<div class="mcv2-task"><span aria-hidden="true">' + (todo.completed ? '&#9745;' : '&#9744;') + '</span><span>' + esc(todo.title) + '</span></div>'; });
		return '<div class="mcv2-today"><div class="mcv2-today-main">' +
			panel("Today's schedule", schedule, 'Nothing scheduled today.', 'is-schedule') +
			panel('Replay ready', replays, 'No replays are ready yet.', 'is-replays') +
			'</div><aside class="mcv2-today-side">' +
			panel('Upcoming deadlines', deadlines, 'No upcoming deadlines.') +
			panel('My appointments', appointments, state.schedulerStatus === 'loading' ? 'Checking Scheduler\u2026' : state.schedulerStatus === 'degraded' ? 'Scheduler is temporarily offline. Calendar remains available.' : 'No upcoming appointments.') +
			panel('My tasks', todos, state.todosStatus === 'loading' ? 'Loading tasks\u2026' : 'No current tasks.') +
			'</aside></div>';
	}

	function renderTracker() {
		var tracker = global.MMEDCalendarCore.trackerModel(TRACKER_PHASES, MATCH_DAY);
		var bar = tracker.phases.map(function (p) {
			return '<button type="button" class="mcv2-tracker-seg is-' + p.status + '" data-tracker-phase="' + esc(p.id) + '" title="' + esc(p.label) + '">' + p.icon + '</button>';
		}).join('');
		var labels = tracker.phases.map(function (p) {
			return '<span class="mcv2-tracker-lbl' + (p.status === 'active' ? ' is-active' : '') + '">' + esc(p.label) + '</span>';
		}).join('');
		var countdown = tracker.daysUntil > 0
			? '<span class="num">' + tracker.daysUntil + '</span> days until Match Day' + (tracker.active ? ' &mdash; Currently: <strong>' + esc(tracker.active.label) + '</strong>' : '')
			: '<strong>Match Day!</strong>';
		return '<section class="mcv2-tracker" aria-label="Match Cycle Tracker">' +
			'<p class="mcv2-tracker-title">Match Cycle Tracker &mdash; 2026\u20132027</p>' +
			'<div class="mcv2-tracker-bar">' + bar + '</div>' +
			'<div class="mcv2-tracker-labels">' + labels + '</div>' +
			'<div class="mcv2-tracker-countdown">' + countdown + '</div></section>';
	}

	function icsText(v) { return String(v || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }

	function renderSyncDialog(state) {
		if (!syncOpen) return '';
		return '<div class="mcv2-backdrop" data-close-sync></div><dialog class="mcv2-sync-dialog" open aria-labelledby="mcv2-sync-title">' +
			'<button type="button" class="mcv2-close" data-close-sync aria-label="Close">&times;</button>' +
			'<h2 id="mcv2-sync-title">Export Calendar</h2>' +
			'<p class="mcv2-kicker">Download your Matrix Calendar events as an .ics file you can import into Google Calendar, Apple Calendar, or Outlook.</p>' +
			'<div class="mcv2-sync-options">' +
			'<button type="button" class="mcv2-sync-option" data-download-ics><span class="mcv2-sync-icon" style="background:linear-gradient(135deg,#4285f4,#34a853)">G</span><span><strong>Google Calendar</strong><small>Download .ics, then import</small></span></button>' +
			'<button type="button" class="mcv2-sync-option" data-download-ics><span class="mcv2-sync-icon" style="background:linear-gradient(135deg,#333,#555)">&#63743;</span><span><strong>Apple Calendar</strong><small>Download .ics, then open</small></span></button>' +
			'<button type="button" class="mcv2-sync-option" data-download-ics><span class="mcv2-sync-icon" style="background:linear-gradient(135deg,#24b7ed,#3ed597)">&#128197;</span><span><strong>Export .ics</strong><small>Download all visible events</small></span></button>' +
			'</div>' +
			'<p class="mcv2-sync-note">This download is generated from the events currently loaded in Matrix.</p>' +
			'</dialog>';
	}

	function renderDrawer(state) {
		var event = state.events.filter(function (item) { return String(item.id) === String(selectedEventId); })[0];
		if (!event) return '';
		var view = global.MMEDCalendarCore.viewModel(Object.assign({}, state, { selectedDate: event.start }));
		var normalized = view.selectedEvents.filter(function (item) { return String(item.id) === String(event.id); })[0] || event;
		return '<div class="mcv2-backdrop" data-close-drawer></div><aside class="mcv2-drawer" role="dialog" aria-modal="true" aria-labelledby="mcv2-drawer-title"><button type="button" class="mcv2-close" data-close-drawer aria-label="Close event details">&times;</button>' +
			'<span class="mcv2-chip mcv2-chip--' + esc(normalized.category) + '">' + esc(categoryLabel(normalized.category)) + '</span>' +
			'<h2 id="mcv2-drawer-title">' + esc(normalized.title) + '</h2>' +
			'<dl><dt>Date &amp; time</dt><dd>' + esc(normalized.fullDateLabel) + '<br>' + esc(normalized.timeLabel) + (normalized.endTimeLabel ? ' \u2013 ' + esc(normalized.endTimeLabel) : '') + '<br><small>' + esc(state.timezoneLabel) + '</small></dd>' +
			(normalized.description ? '<dt>Description</dt><dd>' + esc(normalized.description) + '</dd>' : '') +
			(normalized.meta && normalized.meta.specialty ? '<dt>Specialty</dt><dd>' + esc(normalized.meta.specialty) + '</dd>' : '') + '</dl>' +
			'<div class="mcv2-drawer-actions"><button type="button" class="mcv2-action is-favorite" data-favorite-event="' + esc(normalized.id) + '" aria-pressed="' + (!!normalized.favorite) + '">' + (normalized.favorite ? '\u2605 Favorited' : '\u2606 Add favorite') + '</button>' +
			(normalized.replayUrl || normalized.recordingStatus ? '<button type="button" class="mcv2-action is-replay" data-replay-event="' + esc(normalized.id) + '">Watch replay</button>' : '') +
			(normalized.joinUrl || normalized.source === 'scheduler' ? '<button type="button" class="mcv2-action" data-join-event="' + esc(normalized.id) + '">Join session</button>' : '') +
			(normalized.writable && effectivePerspective(state) === 'administrator' ? '<button type="button" class="mcv2-action" data-edit-event="' + esc(normalized.id) + '">Edit</button><button type="button" class="mcv2-action is-danger" data-delete-event="' + esc(normalized.id) + '">Delete</button>' : '') +
			'</div></aside>';
	}

	function renderSettings(state) {
		var disabled = state.forcedClassic ? ' disabled' : '';
		return '<dialog class="mcv2-settings" id="mcv2-settings" aria-labelledby="mcv2-settings-title"><form method="dialog"><button type="button" class="mcv2-close" data-close-settings aria-label="Close settings">&times;</button><h2 id="mcv2-settings-title">Calendar settings</h2><p class="mcv2-kicker">Calendar experience &mdash; your preference</p>' +
			'<label><input type="radio" name="calendar-experience" value="classic"' + (state.experience === 'classic' ? ' checked' : '') + disabled + '><span><strong>Classic</strong><small>The familiar Matrix Calendar.</small></span></label>' +
			'<label><input type="radio" name="calendar-experience" value="storyforge"' + (state.experience === 'storyforge' ? ' checked' : '') + disabled + '><span><strong>StoryForge</strong><small>Calendar-first navigation with the same live Calendar data.</small></span></label>' +
			(state.forcedClassic ? '<p class="mcv2-force-note">Force Classic is active. Your saved preference is preserved.</p>' : '') +
			'<div class="mcv2-settings-actions"><button type="button" data-close-settings>Cancel</button><button type="button" class="mcv2-primary" data-save-settings' + disabled + '>Save</button></div></form></dialog>';
	}

	function selectableCategories(state) {
		var parents = {};
		(state.categories || []).forEach(function (c) { if (c.parentId) parents[String(c.parentId)] = true; });
		return (state.categories || []).filter(function (c) {
			return !parents[String(c.id)] &&
				!/^drill_/.test(c.id) &&
				c.source !== 'scheduler' &&
				(!c.adminOnly || effectivePerspective(state) === 'administrator');
		});
	}

	function renderDrillsRail(state) {
		if (effectivePerspective(state) !== 'administrator' || !drillsOpen) return '';
		var topics = global.MMEDCalendarCore.drillTopics[drillTab] || [];
		return '<section class="mcv2-drills-rail" aria-label="Drills quick schedule">' +
			'<div class="mcv2-drill-tabs" role="tablist"><button type="button" role="tab" data-drill-tab="Step/Level 1" aria-selected="' + (drillTab === 'Step/Level 1') + '">Step/Level 1</button><button type="button" role="tab" data-drill-tab="Step/Level 2/3" aria-selected="' + (drillTab === 'Step/Level 2/3') + '">Step/Level 2 &amp; 3</button></div>' +
			(armedDrill ? '<div class="mcv2-drill-state"><strong>' + esc(armedDrill.topic) + '</strong> armed</div>' : '') +
			'<div class="mcv2-drill-topics-rail" role="list">' + topics.map(function (topic) {
				var active = armedDrill && armedDrill.topic === topic && armedDrill.level === drillTab;
				return '<button type="button" role="listitem" draggable="true" class="mcv2-drill-topic-rail' + (active ? ' is-armed' : '') + '" data-drill-topic="' + esc(topic) + '" data-drill-level="' + esc(drillTab) + '">' + esc(topic) + '</button>';
			}).join('') + '</div></section>';
	}

	function renderEventForm(state) {
		if (!eventFormMode) return '';
		var isEdit = eventFormMode === 'edit';
		var ev = isEdit ? (state.events || []).filter(function (e) { return String(e.id) === String(eventFormId); })[0] : null;
		if (isEdit && !ev) { eventFormMode = ''; return ''; }
		var cats = selectableCategories(state);
		var selectedCategory = isEdit ? ev.category : eventPrefillCategory;
		if (!selectedCategory) {
			selectedCategory = cats[0] ? cats[0].id : '';
		}
		var catOptions = cats.map(function (c) {
			var selected = selectedCategory === c.id ? ' selected' : '';
			return '<option value="' + esc(c.id) + '"' + selected + '>' + esc(c.name) + '</option>';
		}).join('');
		var title = isEdit ? ev.title : '';
		var dateVal = isEdit ? global.MMEDCalendarCore.dateInput(ev.start) : (eventPrefillDate || global.MMEDCalendarCore.dateInput(state.selectedDate || state.date));
		var startVal = isEdit ? global.MMEDCalendarCore.timeInput(ev.start) : '10:00';
		var endVal = isEdit ? global.MMEDCalendarCore.timeInput(ev.end) : '11:00';
		var meetPlat = isEdit ? (ev.meetingPlatform || '') : '';
		var meetUrl = isEdit ? (ev.joinUrl || '') : '';
		var desc = isEdit ? (ev.description || '') : '';
		var imp = isEdit ? !!ev.important : false;
		var specialty = isEdit && ev.meta ? (ev.meta.specialty || '') : '';
		var audience = isEdit ? (ev.audience || (ev.meta && ev.meta.audience) || '') : 'all_students';
		var specialties = SPECIALTIES.map(function (item) { return '<option value="' + esc(item) + '"' + (specialty === item ? ' selected' : '') + '>' + esc(item) + '</option>'; }).join('');
		return '<div class="mcv2-backdrop" data-close-form></div><dialog class="mcv2-event-form" open aria-labelledby="mcv2-form-title">' +
			'<button type="button" class="mcv2-close" data-close-form aria-label="Close">&times;</button>' +
			'<h2 id="mcv2-form-title">' + (isEdit ? 'Edit Event' : 'New Event') + '</h2>' +
			'<div class="mcv2-form-grid">' +
			'<label class="mcv2-field"><span>Title</span><input type="text" name="ev-title" maxlength="200" value="' + esc(title) + '" placeholder="Event title"></label>' +
			'<label class="mcv2-field"><span>Category</span><select name="ev-category">' + catOptions + '</select></label>' +
			'<label class="mcv2-field"><span>Audience</span><select name="ev-audience"><option value="all_students"' + (audience === 'all_students' ? ' selected' : '') + '>All students</option><option value=""' + (audience !== 'all_students' ? ' selected' : '') + '>Only me</option></select></label>' +
			'<label class="mcv2-field"><span>Date</span><input type="date" name="ev-date" value="' + esc(dateVal) + '"></label>' +
			'<div class="mcv2-field-row"><label class="mcv2-field"><span>Start</span><input type="time" name="ev-start" value="' + esc(startVal) + '"></label>' +
			'<label class="mcv2-field"><span>End</span><input type="time" name="ev-end" value="' + esc(endVal) + '"></label></div>' +
			'<label class="mcv2-field mcv2-specialty-field" style="display:' + (selectedCategory === 'clinicals' ? 'grid' : 'none') + '"><span>Specialty</span><select name="ev-specialty"><option value="">Select a specialty</option>' + specialties + '</select></label>' +
			'<label class="mcv2-field"><span>Meeting</span><select name="ev-meet-platform"><option value="">None</option><option value="webex"' + (String(meetPlat).toLowerCase() === 'webex' ? ' selected' : '') + '>Webex</option><option value="zoom"' + (String(meetPlat).toLowerCase() === 'zoom' ? ' selected' : '') + '>Zoom</option><option value="google_meet"' + (/google/i.test(meetPlat) ? ' selected' : '') + '>Google Meet</option><option value="teams"' + (String(meetPlat).toLowerCase() === 'teams' ? ' selected' : '') + '>Microsoft Teams</option></select></label>' +
			'<label class="mcv2-field"><span>Meeting URL</span><input type="url" name="ev-meet-url" value="' + esc(meetUrl) + '" placeholder="https://..."></label>' +
			'<label class="mcv2-field"><span>Notes</span><textarea name="ev-notes" rows="3" placeholder="Optional notes">' + esc(desc) + '</textarea></label>' +
			'<label class="mcv2-field-check"><input type="checkbox" name="ev-important"' + (imp ? ' checked' : '') + '><span>Mark as important</span></label>' +
			'</div>' +
			'<div class="mcv2-form-actions">' +
			'<button type="button" data-submit-event class="mcv2-primary">' + (isEdit ? 'Save Changes' : 'Create Event') + '</button>' +
			(isEdit ? '<button type="button" data-delete-form-event="' + esc(ev.id) + '" class="mcv2-action is-danger">Delete</button>' : '') +
			'<button type="button" data-close-form>Cancel</button>' +
			'</div></dialog>';
	}

	function renderTodoDetail(state) {
		if (!todoDetailId) return '';
		var todo = (state.todos || []).filter(function (t) { return String(t.id) === String(todoDetailId); })[0];
		if (!todo) { todoDetailId = ''; return ''; }
		return '<div class="mcv2-backdrop" data-close-todo-detail></div><dialog class="mcv2-todo-detail" open aria-labelledby="mcv2-todo-title">' +
			'<button type="button" class="mcv2-close" data-close-todo-detail aria-label="Close">&times;</button>' +
			'<h2 id="mcv2-todo-title">Task Details</h2>' +
			'<div class="mcv2-form-grid">' +
			'<label class="mcv2-field"><span>Task</span><input type="text" name="todo-title" maxlength="200" value="' + esc(todo.title) + '"></label>' +
			'<div class="mcv2-field-row"><label class="mcv2-field"><span>Priority</span><select name="todo-priority"><option value="high"' + (todo.priority === 'high' ? ' selected' : '') + '>High</option><option value="medium"' + (todo.priority === 'medium' || todo.priority === 'med' ? ' selected' : '') + '>Medium</option><option value="low"' + (todo.priority === 'low' ? ' selected' : '') + '>Low</option></select></label>' +
			'<label class="mcv2-field"><span>Due Date</span><input type="date" name="todo-date" value="' + esc(todo.dueDate || '') + '"></label></div>' +
			'<label class="mcv2-field"><span>Notes</span><textarea name="todo-notes" rows="3" placeholder="Add notes...">' + esc(todo.notes || '') + '</textarea></label>' +
			'<label class="mcv2-field"><span>Meeting</span><select name="todo-meeting-platform"><option value="">None</option><option value="webex"' + (String(todo.meetingPlatform).toLowerCase() === 'webex' ? ' selected' : '') + '>Webex</option><option value="zoom"' + (String(todo.meetingPlatform).toLowerCase() === 'zoom' ? ' selected' : '') + '>Zoom</option><option value="google_meet"' + (/google/i.test(todo.meetingPlatform) ? ' selected' : '') + '>Google Meet</option><option value="teams"' + (String(todo.meetingPlatform).toLowerCase() === 'teams' ? ' selected' : '') + '>Microsoft Teams</option></select></label>' +
			'<label class="mcv2-field"><span>Meeting URL</span><input type="url" name="todo-meeting-url" value="' + esc(todo.meetingUrl || '') + '" placeholder="https://..."></label>' +
			'<label class="mcv2-field-check"><input type="checkbox" name="todo-done"' + (todo.completed ? ' checked' : '') + '><span>' + (todo.completed ? 'Completed' : 'Mark as complete') + '</span></label>' +
			'</div>' +
			'<div class="mcv2-form-actions">' +
			'<button type="button" data-save-todo class="mcv2-primary">Save Changes</button>' +
			'<button type="button" data-delete-todo="' + esc(todo.id) + '" class="mcv2-action is-danger">Delete</button>' +
			'<button type="button" data-close-todo-detail>Cancel</button>' +
			'</div></dialog>';
	}

	function render(state) {
		var root = document.querySelector('.mmed-calendar-v2');
		if (!root) return;
		var model = global.MMEDCalendarCore.viewModel(state);
		if (!perspective) perspective = effectivePerspective(state, state.capabilities && state.capabilities.admin ? 'administrator' : 'student');
		perspective = effectivePerspective(state, perspective);
		var content;
		if (state.wpStatus === 'loading' && state.events && state.events.length > 0) {
			content = state.view === 'month' ? renderMonth(model, state) : state.view === 'week' ? renderWeek(model, state) : state.view === 'day' ? renderDay(model, state) : renderAgenda(model);
		} else if (state.wpStatus === 'loading') {
			content = '<div class="mcv2-skeleton" role="status">Loading live Calendar events\u2026</div>';
		} else if (state.wpStatus === 'error') {
			content = '<div class="mcv2-error" role="alert">' + esc(state.error || 'Calendar unavailable.') + '</div>';
		} else {
			content = state.view === 'today' ? renderToday(model, state) : state.view === 'month' ? renderMonth(model, state) : state.view === 'week' ? renderWeek(model, state) : state.view === 'day' ? renderDay(model, state) : renderAgenda(model);
		}
		root.setAttribute('data-perspective', perspective);
		var newEventBtn = perspective === 'administrator' ? '<button type="button" data-new-event class="mcv2-new-event-btn">+ New</button>' : '';
		root.innerHTML =
			'<div class="mcv2-shell' + (mobileRailOpen ? ' is-rail-open' : '') + '">' +
			'<header class="mcv2-topbar">' +
				'<button type="button" class="mcv2-sources-toggle" data-toggle-sources aria-expanded="' + mobileRailOpen + '">Sources</button>' +
				'<a class="mcv2-matrix-link" href="#" aria-label="Return to Matrix">&larr; Matrix</a>' +
				'<div class="mcv2-wordmark"><strong>MissionMed<span>//</span>Calendar</strong><small>Mission:Residency division</small></div>' +
				'<div class="mcv2-topbar-tools">' + perspectiveControl(state) + '<span class="mcv2-timezone">&#9673; ' + esc(state.timezoneLabel) + '</span></div>' +
			'</header>' +
			'<aside class="mcv2-rail">' +
				'<button type="button" class="mcv2-rail-close" data-toggle-sources aria-label="Close sources">&times;</button>' +
				'<div class="mcv2-brand"><strong>Matrix <em>Calendar</em></strong><small>MissionMed</small></div>' +
				categoryRail(state) +
				'<button type="button" class="mcv2-sync-button" data-open-sync>&#128197; Sync / Export</button>' +
				'<button type="button" class="mcv2-settings-button" data-open-settings>&#9881; Settings</button>' +
				miniCalendar(model, state) +
				todoRail(state) +
				'<div class="mcv2-rail-perspective"><span>Viewing as</span><strong>' + (perspective === 'administrator' ? 'Administrator view' : 'Student view') + '</strong></div>' +
				'<div class="mcv2-zone">' + esc(state.timezoneLabel) + '</div>' +
			'</aside>' +
			'<main class="mcv2-main">' +
				'<header class="mcv2-header">' +
					'<div><p class="mcv2-kicker">LIVE CALENDAR</p><h1>' + viewHeading(state.view) + '</h1></div>' +
					'<div class="mcv2-command-row">' + viewSwitcher(state) +
					'<div class="mcv2-header-actions">' +
						'<button type="button" data-nav="-1" aria-label="Previous">&larr;</button>' +
						'<button type="button" data-today>Today</button>' +
						'<button type="button" data-nav="1" aria-label="Next">&rarr;</button>' +
						'<strong>' + esc(model.title) + '</strong>' +
						newEventBtn +
					'</div></div>' +
				'</header>' +
				renderTracker() +
				(state.schedulerStatus === 'degraded' ? '<div class="mcv2-notice" role="status">Scheduler enrichment is temporarily offline. Matrix events remain available. <button type="button" data-retry-scheduler>Retry</button></div>' : '') +
				(state.error ? '<div class="mcv2-notice is-error" role="alert">' + esc(state.error) + '</div>' : '') +
				'<div class="mcv2-content">' + content + '</div>' +
			'</main></div>' +
			renderDrawer(state) + renderEventForm(state) + renderTodoDetail(state) + renderSyncDialog(state) + renderSettings(state) +
			'<div class="mcv2-live" aria-live="polite">' + esc(announcement) + '</div>';
		bind(root, state);
		if (drawerNeedsFocus) {
			drawerNeedsFocus = false;
			global.setTimeout(function () { var close = root.querySelector('.mcv2-drawer [data-close-drawer]'); if (close) close.focus(); }, 0);
		}
	}

	function closeDrawer(root) {
		var returnId = drawerReturnEventId;
		selectedEventId = '';
		drawerReturnEventId = '';
		render(instance.state);
		global.setTimeout(function () {
			var triggers = root.querySelectorAll('[data-event-id]');
			for (var i = 0; i < triggers.length; i += 1) {
				if (triggers[i].getAttribute('data-event-id') === returnId) { triggers[i].focus(); break; }
			}
		}, 0);
	}

	function trapDrawerFocus(event, drawer, root) {
		if (event.key === 'Escape') { event.preventDefault(); closeDrawer(root); return; }
		if (event.key !== 'Tab') return;
		var controls = drawer.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');
		if (!controls.length) { event.preventDefault(); return; }
		var first = controls[0];
		var last = controls[controls.length - 1];
		if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
		else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
	}

	function schedule(day) {
		if (!armedDrill) return;
		var scheduledDrill = armedDrill;
		var candidate;
		try { candidate = global.MMEDCalendarCore.buildDrillEvent(day, scheduledDrill.topic, scheduledDrill.level); }
		catch (error) { announcement = error.message; render(instance.state); return; }
		announcement = 'Saving ' + candidate.title + '\u2026';
		render(instance.state);
		instance.createEvent(candidate).then(function () {
			announcement = candidate.title + ' scheduled.';
			render(instance.state);
		}).catch(function () { announcement = 'The drill was not scheduled. Nothing changed.'; render(instance.state); });
	}

	function bind(root, state) {
		root.querySelectorAll('[data-toggle-sources]').forEach(function (button) { button.addEventListener('click', function () { mobileRailOpen = !mobileRailOpen; render(instance.state); }); });
		root.querySelectorAll('[data-view]').forEach(function (button) { button.addEventListener('click', function () { instance.setView(button.getAttribute('data-view')); }); });
		root.querySelectorAll('[data-perspective]').forEach(function (button) { button.addEventListener('click', function () { perspective = effectivePerspective(state, button.getAttribute('data-perspective')); armedDrill = null; drillsOpen = false; announcement = perspective === 'administrator' ? 'Administrator presentation enabled.' : 'Student presentation enabled. Administrative capability has not changed.'; render(instance.state); }); });
		var toggleDrills = root.querySelector('[data-toggle-drills]'); if (toggleDrills) toggleDrills.addEventListener('click', function () { drillsOpen = !drillsOpen; armedDrill = null; announcement = drillsOpen ? 'Drills scheduling opened.' : 'Drills scheduling closed.'; render(instance.state); });
		root.querySelectorAll('[data-nav]').forEach(function (button) { button.addEventListener('click', function () { instance.navigate(Number(button.getAttribute('data-nav'))); }); });
		root.querySelectorAll('[data-today]').forEach(function (button) { button.addEventListener('click', instance.today); });
		root.querySelectorAll('[data-mini-nav]').forEach(function (button) { button.addEventListener('click', function () { instance.navigate(Number(button.getAttribute('data-mini-nav'))); }); });
		root.querySelectorAll('[data-day],[data-schedule-day]').forEach(function (button) { button.addEventListener('click', function () { var day = button.getAttribute('data-schedule-day') || button.getAttribute('data-day'); if (button.hasAttribute('data-schedule-day')) schedule(day); else { instance.setDate(day); instance.setView('day'); } }); });
		root.querySelectorAll('[data-mini-day]').forEach(function (button) { button.addEventListener('click', function () { instance.setDate(button.getAttribute('data-mini-day')); }); });
		root.querySelectorAll('[data-event-id]').forEach(function (button) { button.addEventListener('click', function (event) { event.stopPropagation(); selectedEventId = button.getAttribute('data-event-id'); drawerReturnEventId = selectedEventId; drawerNeedsFocus = true; render(instance.state); }); });
		root.querySelectorAll('[data-close-drawer]').forEach(function (button) { button.addEventListener('click', function () { closeDrawer(root); }); });
		var drawer = root.querySelector('.mcv2-drawer'); if (drawer) drawer.addEventListener('keydown', function (event) { trapDrawerFocus(event, drawer, root); });
		root.querySelectorAll('[data-drill-tab]').forEach(function (button) { button.addEventListener('click', function () { drillTab = button.getAttribute('data-drill-tab'); armedDrill = null; render(instance.state); }); });
		root.querySelectorAll('[data-drill-topic]').forEach(function (button) {
			button.addEventListener('click', function () { armedDrill = { topic: button.getAttribute('data-drill-topic'), level: button.getAttribute('data-drill-level') }; announcement = armedDrill.topic + ' selected. Choose a calendar day.'; render(instance.state); });
			button.addEventListener('dragstart', function (event) { event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData('application/x-mmed-drill', JSON.stringify({ topic: button.getAttribute('data-drill-topic'), level: button.getAttribute('data-drill-level') })); });
		});
		root.querySelectorAll('[data-category-id]').forEach(function (button) { button.addEventListener('click', function () { var id = button.getAttribute('data-category-id'); var visible = button.getAttribute('aria-pressed') !== 'true'; instance.setCategoryVisibility(id, visible).then(function () { announcement = (visible ? 'Showing ' : 'Hiding ') + button.textContent.trim() + '.'; render(instance.state); }).catch(function () { announcement = 'Category visibility was not saved.'; render(instance.state); }); }); });
		root.querySelectorAll('[data-drag-category]').forEach(function (button) { button.addEventListener('dragstart', function (event) { event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData('application/x-mmed-category', button.getAttribute('data-drag-category')); }); });
		root.querySelectorAll('[data-toggle-collapse]').forEach(function (button) {
			button.addEventListener('click', function (e) {
				e.stopPropagation();
				var id = button.getAttribute('data-toggle-collapse');
				categoryCollapsed[id] = categoryCollapsed[id] === false ? true : false;
				render(instance.state);
			});
		});
		root.querySelectorAll('[data-toggle-todo]').forEach(function (checkbox) { checkbox.addEventListener('change', function () { var todo = state.todos.filter(function (item) { return String(item.id) === String(checkbox.getAttribute('data-toggle-todo')); })[0]; if (!todo) return; todo = Object.assign({}, todo, { completed: checkbox.checked }); instance.updateTodo(todo).catch(function () { render(instance.state); }); }); });
		var createTodoForm = root.querySelector('[data-create-todo]'); if (createTodoForm) createTodoForm.addEventListener('submit', function (event) { event.preventDefault(); var input = createTodoForm.querySelector('input[name="title"]'); if (!input || !input.value.trim()) return; instance.createTodo({ title: input.value.trim(), category: 'personal' }).then(function () { announcement = 'Task added.'; render(instance.state); }).catch(function () { announcement = 'The task was not saved.'; render(instance.state); }); });
		root.querySelectorAll('[data-favorite-event]').forEach(function (button) { button.addEventListener('click', function () { var target = state.events.filter(function (event) { return String(event.id) === String(button.getAttribute('data-favorite-event')); })[0]; if (!target) return; instance.toggleFavorite(target).then(function () { announcement = 'Favorite updated.'; render(instance.state); }).catch(function () { announcement = 'Favorite was not saved.'; render(instance.state); }); }); });
		root.querySelectorAll('[data-join-event]').forEach(function (button) { button.addEventListener('click', function () { var target = state.events.filter(function (event) { return String(event.id) === String(button.getAttribute('data-join-event')); })[0]; if (!target) return; button.disabled = true; instance.getJoinInfo(target).then(function (info) { button.disabled = false; if (info.joinUrl) global.open(info.joinUrl, '_blank', 'noopener'); else { announcement = info.reason || 'Join opens when the session window is active.'; render(instance.state); } }).catch(function () { button.disabled = false; announcement = 'Join information is temporarily unavailable.'; render(instance.state); }); }); });
		root.querySelectorAll('[data-replay-event]').forEach(function (button) { button.addEventListener('click', function () { var target = state.events.filter(function (event) { return String(event.id) === String(button.getAttribute('data-replay-event')); })[0]; if (!target) return; button.disabled = true; instance.refreshRecording(target).then(function (result) { button.disabled = false; if (result && result.event && result.event.replayUrl) global.open(result.event.replayUrl, '_blank', 'noopener'); else { announcement = 'Replay is not ready yet.'; render(instance.state); } }).catch(function () { button.disabled = false; announcement = 'Replay is temporarily unavailable.'; render(instance.state); }); }); });
		var openSettings = root.querySelector('[data-open-settings]'); if (openSettings) openSettings.addEventListener('click', function () { root.querySelector('#mcv2-settings').showModal(); });
		root.querySelectorAll('[data-close-settings]').forEach(function (btn) { btn.addEventListener('click', function () { var dialog = root.querySelector('#mcv2-settings'); if (dialog) dialog.close(); }); });
		var saveSettings = root.querySelector('[data-save-settings]'); if (saveSettings) saveSettings.addEventListener('click', function () { var choice = root.querySelector('input[name="calendar-experience"]:checked'); if (!choice) return; saveSettings.disabled = true; instance.setPreference(choice.value).then(function () { global.location.reload(); }).catch(function (error) { saveSettings.disabled = false; announcement = error.message; render(instance.state); }); });
		var retry = root.querySelector('[data-retry-scheduler]'); if (retry) retry.addEventListener('click', instance.reloadScheduler);
		root.querySelectorAll('[data-tracker-phase]').forEach(function (seg) { seg.addEventListener('click', function () { var phase = TRACKER_PHASES.filter(function (p) { return p.id === seg.getAttribute('data-tracker-phase'); })[0]; if (phase) { instance.setDate(phase.start); announcement = 'Jumped to ' + phase.label + '.'; render(instance.state); } }); });
		var openSync = root.querySelector('[data-open-sync]'); if (openSync) openSync.addEventListener('click', function () { syncOpen = true; render(instance.state); });
		root.querySelectorAll('[data-close-sync]').forEach(function (btn) { btn.addEventListener('click', function () { syncOpen = false; render(instance.state); }); });
		root.querySelectorAll('[data-download-ics]').forEach(function (btn) { btn.addEventListener('click', function () {
			var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MissionMed Matrix//Calendar V2//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
			global.MMEDCalendarCore.visibleEvents(state).forEach(function (ev) {
				lines.push('BEGIN:VEVENT');
				lines.push('UID:missionmed-matrix-' + String(ev.id) + '@missionmedinstitute.com');
				lines.push('DTSTAMP:' + global.MMEDCalendarCore.icsDate(global.MMEDCalendarCore.now()));
				if (ev.allDay) { lines.push('DTSTART;VALUE=DATE:' + global.MMEDCalendarCore.icsDateOnly(ev.start)); }
				else { lines.push('DTSTART:' + global.MMEDCalendarCore.icsDate(ev.start)); lines.push('DTEND:' + global.MMEDCalendarCore.icsDate(ev.end)); }
				lines.push('SUMMARY:' + icsText(ev.title));
				if (ev.description) lines.push('DESCRIPTION:' + icsText(ev.description + (ev.joinUrl ? '\\n' + ev.joinUrl : '')));
				if (ev.joinUrl) lines.push('URL:' + icsText(ev.joinUrl));
				lines.push('CATEGORIES:' + icsText(categoryLabel(ev.category)));
				lines.push('END:VEVENT');
			});
			lines.push('END:VCALENDAR');
			var blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
			var url = URL.createObjectURL(blob);
			var a = document.createElement('a'); a.href = url; a.download = 'missionmed-matrix-calendar.ics';
			document.body.appendChild(a); a.click();
			global.setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
			syncOpen = false; announcement = 'Calendar export ready.'; render(instance.state);
		}); });
		var remove = root.querySelector('[data-delete-event]'); if (remove) remove.addEventListener('click', function () { var target = state.events.filter(function (event) { return String(event.id) === String(remove.getAttribute('data-delete-event')); })[0]; if (!target || !global.confirm('Delete this event? This cannot be undone.')) return; instance.deleteEvent(target).then(function () { selectedEventId = ''; announcement = 'Event deleted.'; render(instance.state); }).catch(function () { announcement = 'The event was not deleted. Nothing changed.'; render(instance.state); }); });
		var newEventBtn = root.querySelector('[data-new-event]'); if (newEventBtn) newEventBtn.addEventListener('click', function () { eventFormMode = 'create'; eventFormId = ''; eventPrefillCategory = ''; eventPrefillDate = ''; selectedEventId = ''; render(instance.state); });
		var editBtn = root.querySelector('[data-edit-event]'); if (editBtn) editBtn.addEventListener('click', function () { eventFormMode = 'edit'; eventFormId = editBtn.getAttribute('data-edit-event'); selectedEventId = ''; render(instance.state); });
		root.querySelectorAll('[data-close-form]').forEach(function (btn) { btn.addEventListener('click', function () { eventFormMode = ''; eventFormId = ''; eventPrefillCategory = ''; eventPrefillDate = ''; render(instance.state); }); });
		var eventCategorySelect = root.querySelector('[name="ev-category"]'); if (eventCategorySelect) eventCategorySelect.addEventListener('change', function () { var field = root.querySelector('.mcv2-specialty-field'); if (field) field.style.display = eventCategorySelect.value === 'clinicals' ? 'grid' : 'none'; });
		var submitEvent = root.querySelector('[data-submit-event]'); if (submitEvent) submitEvent.addEventListener('click', function () {
			var form = root.querySelector('.mcv2-event-form');
			if (!form) return;
			var title = (form.querySelector('[name="ev-title"]').value || '').trim();
			if (!title) { announcement = 'Please enter a title.'; render(instance.state); return; }
			var cat = form.querySelector('[name="ev-category"]').value;
			var dateVal = form.querySelector('[name="ev-date"]').value;
			var startVal = form.querySelector('[name="ev-start"]').value;
			var endVal = form.querySelector('[name="ev-end"]').value;
			var meetPlat = form.querySelector('[name="ev-meet-platform"]').value;
			var meetUrl = form.querySelector('[name="ev-meet-url"]').value;
			var notes = form.querySelector('[name="ev-notes"]').value;
			var imp = form.querySelector('[name="ev-important"]').checked;
			var audience = form.querySelector('[name="ev-audience"]').value;
			var specialty = form.querySelector('[name="ev-specialty"]').value;
			var categoryRecord = (instance.state.categories || []).filter(function (item) { return String(item.id) === String(cat); })[0] || {};
			var eventType = categoryRecord.eventType || 'custom';
			var meta = { important: imp, audience: audience };
			if (specialty && cat === 'clinicals') meta.specialty = specialty;
			if (categoryRecord.session) meta.session = categoryRecord.session;
			var times = global.MMEDCalendarCore.combineDateTime(dateVal, startVal, endVal);
			if (eventFormMode === 'edit') {
				var ev = (instance.state.events || []).filter(function (e) { return String(e.id) === String(eventFormId); })[0];
				if (!ev) return;
				var updated = Object.assign({}, ev, { title: title, category: cat, eventType: eventType, start: times.start, end: times.end, description: notes, joinUrl: meetUrl, meetingPlatform: meetPlat, audience: audience, important: imp, meta: Object.assign({}, ev.meta || {}, meta) });
				announcement = 'Saving changes\u2026';
				submitEvent.disabled = true;
				instance.updateEvent(updated).then(function () { eventFormMode = ''; eventFormId = ''; announcement = 'Event updated.'; render(instance.state); }).catch(function () { submitEvent.disabled = false; announcement = 'The event was not updated. Nothing changed.'; render(instance.state); });
			} else {
				var candidate = { title: title, category: cat, start: times.start, end: times.end, description: notes, joinUrl: meetUrl, meetingPlatform: meetPlat, audience: audience, important: imp, allDay: false, eventType: eventType, meta: meta };
				announcement = 'Creating event\u2026';
				submitEvent.disabled = true;
				instance.createEvent(candidate).then(function () { eventFormMode = ''; announcement = 'Event created.'; render(instance.state); }).catch(function () { submitEvent.disabled = false; announcement = 'The event was not created. Nothing changed.'; render(instance.state); });
			}
		});
		var deleteFormEvent = root.querySelector('[data-delete-form-event]'); if (deleteFormEvent) deleteFormEvent.addEventListener('click', function () {
			var target = (instance.state.events || []).filter(function (e) { return String(e.id) === String(deleteFormEvent.getAttribute('data-delete-form-event')); })[0];
			if (!target || !global.confirm('Delete this event? This cannot be undone.')) return;
			instance.deleteEvent(target).then(function () { eventFormMode = ''; eventFormId = ''; announcement = 'Event deleted.'; render(instance.state); }).catch(function () { announcement = 'The event was not deleted.'; render(instance.state); });
		});
		root.querySelectorAll('[data-todo-detail]').forEach(function (btn) { btn.addEventListener('click', function (e) { e.stopPropagation(); todoDetailId = btn.getAttribute('data-todo-detail'); render(instance.state); }); });
		root.querySelectorAll('[data-close-todo-detail]').forEach(function (btn) { btn.addEventListener('click', function () { todoDetailId = ''; render(instance.state); }); });
		var saveTodo = root.querySelector('[data-save-todo]'); if (saveTodo) saveTodo.addEventListener('click', function () {
			var form = root.querySelector('.mcv2-todo-detail');
			if (!form) return;
			var todo = (instance.state.todos || []).filter(function (t) { return String(t.id) === String(todoDetailId); })[0];
			if (!todo) return;
			var updated = Object.assign({}, todo, { title: (form.querySelector('[name="todo-title"]').value || '').trim() || todo.title, priority: form.querySelector('[name="todo-priority"]').value, dueDate: form.querySelector('[name="todo-date"]').value, notes: form.querySelector('[name="todo-notes"]').value, meetingPlatform: form.querySelector('[name="todo-meeting-platform"]').value, meetingUrl: form.querySelector('[name="todo-meeting-url"]').value, completed: form.querySelector('[name="todo-done"]').checked });
			saveTodo.disabled = true;
			instance.updateTodo(updated).then(function () { todoDetailId = ''; announcement = 'Task updated.'; render(instance.state); }).catch(function () { saveTodo.disabled = false; announcement = 'The task was not updated.'; render(instance.state); });
		});
		var deleteTodo = root.querySelector('[data-delete-todo]'); if (deleteTodo) deleteTodo.addEventListener('click', function () {
			var todo = (instance.state.todos || []).filter(function (t) { return String(t.id) === String(deleteTodo.getAttribute('data-delete-todo')); })[0];
			if (!todo || !global.confirm('Delete this task?')) return;
			instance.deleteTodo(todo).then(function () { todoDetailId = ''; announcement = 'Task deleted.'; render(instance.state); }).catch(function () { announcement = 'The task was not deleted.'; render(instance.state); });
		});
		root.querySelectorAll('[data-drag-event]').forEach(function (el) {
			el.addEventListener('dragstart', function (event) { dragEventId = el.getAttribute('data-drag-event'); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', dragEventId); });
		});
		root.querySelectorAll('[data-drop-day]').forEach(function (cell) {
			cell.addEventListener('dragover', function (event) {
				if (dragEventId || event.dataTransfer.types.indexOf('application/x-mmed-drill') !== -1 || event.dataTransfer.types.indexOf('application/x-mmed-category') !== -1) { event.preventDefault(); cell.classList.add('is-drop-target'); }
			});
			cell.addEventListener('dragleave', function () { cell.classList.remove('is-drop-target'); });
			cell.addEventListener('drop', function (event) {
				event.preventDefault(); cell.classList.remove('is-drop-target');
				var day = cell.getAttribute('data-drop-day');
				if (dragEventId) {
					var ev = (instance.state.events || []).filter(function (e) { return String(e.id) === String(dragEventId); })[0];
					dragEventId = '';
					if (!ev || !ev.writable) return;
					var moved = global.MMEDCalendarCore.moveEventToDate(ev, day);
					announcement = 'Moving event\u2026';
					instance.updateEvent(moved).then(function () { announcement = 'Event moved.'; render(instance.state); }).catch(function () { announcement = 'The event was not moved.'; render(instance.state); });
				} else if (event.dataTransfer.types.indexOf('application/x-mmed-category') !== -1) {
					eventPrefillCategory = event.dataTransfer.getData('application/x-mmed-category');
					eventPrefillDate = day;
					eventFormMode = 'create';
					mobileRailOpen = false;
					render(instance.state);
				} else {
					try { armedDrill = JSON.parse(event.dataTransfer.getData('application/x-mmed-drill')); schedule(day); } catch (ignore) { announcement = 'That item could not be scheduled.'; render(instance.state); }
				}
			});
		});
		root.querySelectorAll('[data-resize-event]').forEach(function (handle) {
			handle.addEventListener('pointerdown', function (event) {
				event.preventDefault(); event.stopPropagation();
				var eventId = handle.getAttribute('data-resize-event');
				var target = (instance.state.events || []).filter(function (item) { return String(item.id) === String(eventId); })[0];
				var block = handle.parentElement;
				if (!target || !target.writable || !block) return;
				var startY = event.clientY;
				var startHeight = block.getBoundingClientRect().height;
				function move(pointer) { block.style.height = Math.max(28, startHeight + pointer.clientY - startY) + 'px'; }
				function finish(pointer) {
					global.removeEventListener('pointermove', move); global.removeEventListener('pointerup', finish);
					var end = global.MMEDCalendarCore.resizeEnd(target.start, Math.max(28, startHeight + pointer.clientY - startY));
					var updated = Object.assign({}, target, { end: end });
					announcement = 'Saving duration…';
					instance.updateEvent(updated).then(function () { announcement = 'Duration adjusted.'; render(instance.state); }).catch(function () { announcement = 'Duration was not adjusted.'; render(instance.state); });
				}
				global.addEventListener('pointermove', move); global.addEventListener('pointerup', finish);
			});
		});
		root.querySelectorAll('[data-duration-minus],[data-duration-plus]').forEach(function (btn) {
			btn.addEventListener('click', function (e) {
				e.stopPropagation();
				var evId = btn.getAttribute('data-duration-minus') || btn.getAttribute('data-duration-plus');
				var delta = btn.hasAttribute('data-duration-plus') ? 15 : -15;
				var ev = (instance.state.events || []).filter(function (x) { return String(x.id) === String(evId); })[0];
				if (!ev || !ev.writable) return;
				var updated = global.MMEDCalendarCore.adjustEventDuration(ev, delta);
				if (!updated) return;
				btn.disabled = true;
				instance.updateEvent(updated).then(function () {
					announcement = 'Duration adjusted.';
					render(instance.state);
				}).catch(function () {
					btn.disabled = false;
					announcement = 'Duration was not adjusted.';
					render(instance.state);
				});
			});
		});
	}

	function activate() {
		document.body.classList.add('matrix-app-mode', 'matrix-app-mode-calendar', 'matrix-calendar-storyforge');
		document.body.setAttribute('data-matrix-calendar-experience', 'storyforge');
	}

	function mount(app) {
		var content = document.getElementById('sos-content');
		if (!content || !global.MMEDCalendarCore) return;
		unmount();
		activate();
		content.innerHTML = '<section class="sos-page mmed-calendar-v2" data-calendar-experience="storyforge"></section>';
		instance = global.MMEDCalendarCore.create(app);
		unsubscribe = instance.subscribe(render);
		instance.start().catch(function () {});
	}

	function unmount() {
		if (unsubscribe) unsubscribe();
		unsubscribe = null;
		if (instance && typeof instance.destroy === 'function') instance.destroy();
		instance = null;
		selectedEventId = '';
		drawerReturnEventId = '';
		drawerNeedsFocus = false;
		perspective = '';
		drillsOpen = false;
		eventFormMode = '';
		eventFormId = '';
		todoDetailId = '';
		dragEventId = '';
		syncOpen = false;
		mobileRailOpen = false;
		eventPrefillCategory = '';
		eventPrefillDate = '';
		document.body.classList.remove('matrix-app-mode-calendar', 'matrix-calendar-storyforge');
		document.body.removeAttribute('data-matrix-calendar-experience');
	}

	function boot() {
		var tries = 0;
		var timer = global.setInterval(function () {
			tries += 1;
			var app = global.MMED_OS;
			if (!app && tries < 60) return;
			global.clearInterval(timer);
			if (!app || !app.render) return;
			app.render.calendar = function () { mount(app); };
			// Matrix Runtime owns route mounting once its v2 contract is active.
			// Self-mounting here would create a first core instance that Runtime
			// immediately destroys, aborting and duplicating the live request set.
			if (app.state && app.state.route === 'calendar' && !(app.runtime && app.runtime.enabled)) mount(app);
		}, 100);
	}

	global.MMEDCalendarV2 = { mount: mount, unmount: unmount, __test: { effectivePerspective: effectivePerspective } };
	global.MMEDCalendarV4 = global.MMEDCalendarV2;
	boot();
})(window, document);
