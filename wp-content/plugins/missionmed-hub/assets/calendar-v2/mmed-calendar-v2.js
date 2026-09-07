/** StoryForge Calendar V2 renderer. Behavior and data access are owned by MMEDCalendarCore. */
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

	function esc(value) {
		return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character];
		});
	}

	function categoryLabel(category) {
		return { live: 'Live session', strategy: 'Strategy session', appointment: 'Appointment', deadline: 'Deadline', assignment: 'Assignment', drills: 'Drills', drill_step1: 'Drills · Step/Level 1', drill_step23: 'Drills · Step/Level 2 & 3', nrmp: 'NRMP', clinicals: 'Clinicals', arena: 'Arena', mission_residency: 'Mission Residency', mr_session_a: 'Session A', mr_session_b: 'Session B', mr_session_c: 'Session C', mr_session_d: 'Session D', mr_session_e: 'Session E', mr_session_f: 'Session F' }[category] || 'Calendar';
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

	function eventLegend() {
		return '<div class="mcv2-legend" aria-label="Event categories">' + ['live','strategy','appointment','deadline','assignment','drills'].map(function (category) {
			return '<span class="mcv2-legend-item mcv2-legend-item--' + category + '"><i></i>' + esc(categoryLabel(category)) + '</span>';
		}).join('') + '</div>';
	}

	function eventRow(event, compact) {
		return '<button type="button" class="mcv2-event mcv2-event--' + esc(event.category) + (compact ? ' is-compact' : '') + '" data-event-id="' + esc(event.id) + '">' +
			'<span class="mcv2-event-time">' + esc(event.timeLabel) + '</span>' +
			'<span class="mcv2-event-copy"><strong>' + esc(event.title) + '</strong><small>' + esc(categoryLabel(event.category)) + '</small></span>' +
			(event.replayUrl ? '<span class="mcv2-chip is-replay">Watch replay</span>' : event.joinUrl ? '<span class="mcv2-chip">Join</span>' : '') +
			'</button>';
	}

	function categoryRail(state) {
		var categories = (state.categories || []).slice().sort(function (a, b) { return a.sortOrder - b.sortOrder; });
		var byParent = {};
		categories.forEach(function (category) { var key = category.parentId || ''; if (!byParent[key]) byParent[key] = []; byParent[key].push(category); });
		function draw(parent, depth) {
			return (byParent[parent] || []).map(function (category) {
				if (category.adminOnly && effectivePerspective(state) !== 'administrator') return '';
				var children = draw(category.id, depth + 1);
				var visible = state.visibility && state.visibility[category.id] === false ? false : true;
				return '<div class="mcv2-category-node mcv2-category-node--depth-' + depth + '"><button type="button" class="mcv2-category" data-category-id="' + esc(category.id) + '" aria-pressed="' + visible + '" style="--category-color:' + esc(category.color) + '"><span class="mcv2-category-dot"></span><span>' + esc(category.name) + '</span><span class="mcv2-category-check" aria-hidden="true">' + (visible ? '✓' : '') + '</span></button>' + children + '</div>';
			}).join('');
		}
		return '<section class="mcv2-category-rail" aria-label="Calendar sources"><p class="mcv2-rail-label">Sources &amp; calendars</p>' + (categories.length ? draw('', 0) : empty('Calendar sources are loading…')) + '</section>';
	}

	function miniCalendar(model, state) {
		return '<section class="mcv2-mini-calendar" aria-label="Mini calendar"><header><strong>' + esc(global.MMEDCalendarCore.classicFormat(state.date, 'monthYear')) + '</strong><button type="button" data-today aria-label="Jump to today">Today</button></header><div class="mcv2-mini-grid">' + model.monthDays.map(function (day) { return '<button type="button" class="' + (day.outside ? 'is-outside ' : '') + (day.selectedKey === model.selectedKey || day.key === model.selectedKey ? 'is-selected ' : '') + (day.today ? 'is-today' : '') + '" data-mini-day="' + day.key + '">' + esc(day.label) + '</button>'; }).join('') + '</div></section>';
	}

	function todoRail(state) {
		var todos = state.todos || [];
		return '<section class="mcv2-todo-rail" aria-label="My tasks"><header><p class="mcv2-rail-label">My tasks</p><span>' + todos.filter(function (todo) { return !todo.completed; }).length + '</span></header>' + (todos.slice(0, 6).map(function (todo) { return '<label class="mcv2-todo-item"><input type="checkbox" data-toggle-todo="' + esc(todo.id) + '"' + (todo.completed ? ' checked' : '') + '><span>' + esc(todo.title) + '</span></label>'; }).join('') || empty('No tasks yet.')) + '<form class="mcv2-todo-form" data-create-todo><input name="title" type="text" maxlength="120" placeholder="Add a task" aria-label="Add a task"><button type="submit" aria-label="Add task">+</button></form></section>';
	}

	function empty(message) {
		return '<p class="mcv2-empty">' + esc(message) + '</p>';
	}

	function renderMonth(model, state) {
		var weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(function (day) { return '<div class="mcv2-weekday">' + day + '</div>'; }).join('');
		var cells = model.monthDays.map(function (day) {
			var events = day.events.slice(0, 3).map(function (event) { return eventRow(event, true); }).join('');
			var more = day.events.length > 3 ? '<button class="mcv2-more" data-day="' + day.key + '">+' + (day.events.length - 3) + ' more</button>' : '';
			return '<section class="mcv2-month-day' + (day.outside ? ' is-outside' : '') + (day.today ? ' is-today' : '') + '" data-drop-day="' + day.key + '" aria-label="' + esc(day.fullLabel) + '">' +
				'<button type="button" class="mcv2-day-number" data-day="' + day.key + '" aria-label="Open ' + esc(day.fullLabel) + '">' + esc(day.label) + '</button>' +
				'<div class="mcv2-day-events">' + events + more + '</div>' +
				(state.capabilities.admin && armedDrill ? '<button type="button" class="mcv2-schedule-here" data-schedule-day="' + day.key + '">Schedule here</button>' : '') +
				'</section>';
		}).join('');
		return '<div class="mcv2-month" role="grid" aria-label="' + esc(model.title) + '"><div class="mcv2-weekdays">' + weekdays + '</div><div class="mcv2-month-grid">' + cells + '</div></div>';
	}

	function renderWeek(model) {
		return '<div class="mcv2-week">' + model.weekDays.map(function (day) {
			return '<section class="mcv2-week-day' + (day.today ? ' is-today' : '') + '" data-drop-day="' + day.key + '"><header><span>' + esc(day.weekday) + '</span><strong>' + esc(day.label) + '</strong></header>' +
				(day.events.length ? day.events.map(function (event) { return eventRow(event, false); }).join('') : empty('No events')) + '</section>';
		}).join('') + '</div>';
	}

	function renderDay(model) {
		return '<section class="mcv2-list-panel"><p class="mcv2-kicker">' + esc(model.title) + '</p>' +
			(model.selectedEvents.length ? model.selectedEvents.map(function (event) { return eventRow(event, false); }).join('') : empty('No events scheduled for this day.')) + '</section>';
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
			panel('My appointments', appointments, state.schedulerStatus === 'loading' ? 'Checking Scheduler…' : state.schedulerStatus === 'degraded' ? 'Scheduler is temporarily offline. Calendar remains available.' : 'No upcoming appointments.') +
			panel('My tasks', todos, state.todosStatus === 'loading' ? 'Loading tasks…' : 'No current tasks.') +
			'</aside></div>';
	}

	function renderDrills(state) {
		if (effectivePerspective(state) !== 'administrator' || !drillsOpen) return '';
		var topics = global.MMEDCalendarCore.drillTopics[drillTab] || [];
		return '<section class="mcv2-drills" aria-label="Drills quick schedule"><div class="mcv2-drills-head"><div><p class="mcv2-kicker">ExamPrep · Authoritative Calendar wiring</p><h2>Dr. J’s <em>Drills</em></h2></div><p>Choose a real subject, then drag it onto a calendar day—or use the keyboard-friendly “Schedule here” action.</p></div>' +
			'<div class="mcv2-drill-tabs" role="tablist"><button type="button" role="tab" data-drill-tab="Step/Level 1" aria-selected="' + (drillTab === 'Step/Level 1') + '">Step/Level 1</button><button type="button" role="tab" data-drill-tab="Step/Level 2/3" aria-selected="' + (drillTab === 'Step/Level 2/3') + '">Step/Level 2 &amp; 3</button></div>' +
			'<div class="mcv2-drill-state">' + (armedDrill ? '<strong>' + esc(armedDrill.topic) + '</strong> is selected. Valid calendar dates are highlighted.' : 'Select or drag any of the 19 subjects below.') + '</div>' +
			'<div class="mcv2-drill-topics" role="list">' + topics.map(function (topic) {
				var active = armedDrill && armedDrill.topic === topic && armedDrill.level === drillTab;
				return '<button type="button" role="listitem" draggable="true" class="mcv2-drill-topic' + (active ? ' is-armed' : '') + '" data-drill-topic="' + esc(topic) + '" data-drill-level="' + esc(drillTab) + '"><span class="mcv2-drag-handle" aria-hidden="true">⠿</span><span>' + esc(topic) + '</span><small>' + (active ? 'Selected' : 'Drag or select') + '</small></button>';
			}).join('') + '</div></section>';
	}

	function renderDrawer(state) {
		var event = state.events.filter(function (item) { return String(item.id) === String(selectedEventId); })[0];
		if (!event) return '';
		var view = global.MMEDCalendarCore.viewModel(Object.assign({}, state, { selectedDate: event.start }));
		var normalized = view.selectedEvents.filter(function (item) { return String(item.id) === String(event.id); })[0] || event;
		return '<div class="mcv2-backdrop" data-close-drawer></div><aside class="mcv2-drawer" role="dialog" aria-modal="true" aria-labelledby="mcv2-drawer-title"><button type="button" class="mcv2-close" data-close-drawer aria-label="Close event details">&times;</button>' +
			'<span class="mcv2-chip mcv2-chip--' + esc(normalized.category) + '">' + esc(categoryLabel(normalized.category)) + '</span>' +
			'<h2 id="mcv2-drawer-title">' + esc(normalized.title) + '</h2>' +
			'<dl><dt>Date &amp; time</dt><dd>' + esc(normalized.fullDateLabel) + '<br>' + esc(normalized.timeLabel) + (normalized.endTimeLabel ? ' – ' + esc(normalized.endTimeLabel) : '') + '<br><small>' + esc(state.timezoneLabel) + '</small></dd>' +
			(normalized.description ? '<dt>Description</dt><dd>' + esc(normalized.description) + '</dd>' : '') + '</dl>' +
			'<div class="mcv2-drawer-actions"><button type="button" class="mcv2-action is-favorite" data-favorite-event="' + esc(normalized.id) + '" aria-pressed="' + (!!normalized.favorite) + '">' + (normalized.favorite ? '★ Favorited' : '☆ Add favorite') + '</button>' +
			(normalized.replayUrl || normalized.recordingStatus ? '<button type="button" class="mcv2-action is-replay" data-replay-event="' + esc(normalized.id) + '">Watch replay</button>' : '') +
			(normalized.joinUrl || normalized.source === 'scheduler' ? '<button type="button" class="mcv2-action" data-join-event="' + esc(normalized.id) + '">Join session</button>' : '') +
			(normalized.writable && effectivePerspective(state) === 'administrator' ? '<button type="button" class="mcv2-action is-danger" data-delete-event="' + esc(normalized.id) + '">Delete</button>' : '') +
			'</div></aside>';
	}

	function renderSettings(state) {
		var disabled = state.forcedClassic ? ' disabled' : '';
		return '<dialog class="mcv2-settings" id="mcv2-settings" aria-labelledby="mcv2-settings-title"><form method="dialog"><button class="mcv2-close" value="cancel" aria-label="Close settings">&times;</button><h2 id="mcv2-settings-title">Calendar settings</h2><p class="mcv2-kicker">Calendar experience — your preference</p>' +
			'<label><input type="radio" name="calendar-experience" value="classic"' + (state.experience === 'classic' ? ' checked' : '') + disabled + '><span><strong>Classic</strong><small>The familiar Matrix Calendar.</small></span></label>' +
			'<label><input type="radio" name="calendar-experience" value="storyforge"' + (state.experience === 'storyforge' ? ' checked' : '') + disabled + '><span><strong>StoryForge</strong><small>Calendar-first navigation with the same live Calendar data.</small></span></label>' +
			(state.forcedClassic ? '<p class="mcv2-force-note">Force Classic is active. Your saved preference is preserved.</p>' : '') +
			'<div class="mcv2-settings-actions"><button value="cancel">Cancel</button><button type="button" class="mcv2-primary" data-save-settings' + disabled + '>Save</button></div></form></dialog>';
	}

	function render(state) {
		var root = document.querySelector('.mmed-calendar-v2');
		if (!root) return;
		var model = global.MMEDCalendarCore.viewModel(state);
		if (!perspective) perspective = effectivePerspective(state, state.capabilities && state.capabilities.admin ? 'administrator' : 'student');
		perspective = effectivePerspective(state, perspective);
		var content = state.wpStatus === 'loading' ? '<div class="mcv2-skeleton" role="status">Loading live Calendar events…</div>' : state.wpStatus === 'error' ? '<div class="mcv2-error" role="alert">' + esc(state.error || 'Calendar unavailable.') + '</div>' :
			state.view === 'today' ? renderToday(model, state) : state.view === 'month' ? renderMonth(model, state) : state.view === 'week' ? renderWeek(model) : state.view === 'day' ? renderDay(model) : renderAgenda(model);
		root.setAttribute('data-perspective', perspective);
		root.innerHTML = '<div class="mcv2-shell"><header class="mcv2-topbar"><a class="mcv2-matrix-link" href="#" aria-label="Return to Matrix">← Matrix</a><div class="mcv2-wordmark"><strong>MissionMed<span>//</span>Calendar</strong><small>Mission:Residency division</small></div><div class="mcv2-topbar-tools">' + perspectiveControl(state) + '<span class="mcv2-timezone">◉ ' + esc(state.timezoneLabel) + '</span></div></header><aside class="mcv2-rail"><div class="mcv2-brand"><strong>Matrix <em>Calendar</em></strong><small>MissionMed</small></div>' + categoryRail(state) + (perspective === 'administrator' ? '<button type="button" class="mcv2-drills-button" data-toggle-drills aria-pressed="' + drillsOpen + '"><span aria-hidden="true">✦</span> Dr. J’s Drills</button>' : '') + '<button type="button" class="mcv2-settings-button" data-open-settings>&#9881; Settings</button>' + miniCalendar(model, state) + todoRail(state) + '<div class="mcv2-rail-perspective"><span>Viewing as</span><strong>' + (perspective === 'administrator' ? 'Administrator view' : 'Student view') + '</strong></div><div class="mcv2-zone">' + esc(state.timezoneLabel) + '</div></aside>' +
			'<main class="mcv2-main"><header class="mcv2-header"><div><p class="mcv2-kicker">Live calendar</p><h1>' + (state.view === 'today' ? 'Today, <em>' + esc(model.todayLabel) + '</em>' : esc(state.view.charAt(0).toUpperCase() + state.view.slice(1)) + ' <em>view</em>') + '</h1><p class="mcv2-subtitle">Clear dates first. StoryForge detail when you need it.</p></div><div class="mcv2-command-row">' + viewSwitcher(state) + '<div class="mcv2-header-actions"><button type="button" data-nav="-1" aria-label="Previous">&larr;</button><button type="button" data-today>Today</button><button type="button" data-nav="1" aria-label="Next">&rarr;</button><strong>' + esc(model.title) + '</strong></div></div></header>' + eventLegend() +
			(state.schedulerStatus === 'degraded' ? '<div class="mcv2-notice" role="status">Scheduler enrichment is temporarily offline. Matrix events remain available. <button type="button" data-retry-scheduler>Retry</button></div>' : '') +
			(state.error ? '<div class="mcv2-notice is-error" role="alert">' + esc(state.error) + '</div>' : '') +
			renderDrills(state) + '<div class="mcv2-content">' + content + '</div></main></div>' + renderDrawer(state) + renderSettings(state) + '<div class="mcv2-live" aria-live="polite">' + esc(announcement) + '</div>';
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
		announcement = 'Saving ' + candidate.title + '…';
		render(instance.state);
		instance.createEvent(candidate).then(function () {
			announcement = candidate.title + ' scheduled.';
			/* Keep the chosen subject armed for repeated scheduling; changing tabs clears it. */
			render(instance.state);
		}).catch(function () { announcement = 'The drill was not scheduled. Nothing changed.'; render(instance.state); });
	}

	function bind(root, state) {
		root.querySelectorAll('[data-view]').forEach(function (button) { button.addEventListener('click', function () { instance.setView(button.getAttribute('data-view')); }); });
		root.querySelectorAll('[data-perspective]').forEach(function (button) { button.addEventListener('click', function () { perspective = effectivePerspective(state, button.getAttribute('data-perspective')); armedDrill = null; drillsOpen = false; announcement = perspective === 'administrator' ? 'Administrator presentation enabled.' : 'Student presentation enabled. Administrative capability has not changed.'; render(instance.state); }); });
		var toggleDrills = root.querySelector('[data-toggle-drills]'); if (toggleDrills) toggleDrills.addEventListener('click', function () { drillsOpen = !drillsOpen; armedDrill = null; announcement = drillsOpen ? 'Dr. J’s Drills scheduling opened.' : 'Dr. J’s Drills scheduling closed.'; render(instance.state); });
		root.querySelectorAll('[data-nav]').forEach(function (button) { button.addEventListener('click', function () { instance.navigate(Number(button.getAttribute('data-nav'))); }); });
		var today = root.querySelector('[data-today]'); if (today) today.addEventListener('click', instance.today);
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
		root.querySelectorAll('[data-drop-day]').forEach(function (cell) {
			cell.addEventListener('dragover', function (event) { if (event.dataTransfer.types.indexOf('application/x-mmed-drill') !== -1) { event.preventDefault(); cell.classList.add('is-drop-target'); } });
			cell.addEventListener('dragleave', function () { cell.classList.remove('is-drop-target'); });
			cell.addEventListener('drop', function (event) { event.preventDefault(); cell.classList.remove('is-drop-target'); try { armedDrill = JSON.parse(event.dataTransfer.getData('application/x-mmed-drill')); schedule(cell.getAttribute('data-drop-day')); } catch (ignore) { announcement = 'That Drills item could not be scheduled.'; render(instance.state); } });
		});
		root.querySelectorAll('[data-category-id]').forEach(function (button) { button.addEventListener('click', function () { var id = button.getAttribute('data-category-id'); var visible = button.getAttribute('aria-pressed') !== 'true'; instance.setCategoryVisibility(id, visible).then(function () { announcement = (visible ? 'Showing ' : 'Hiding ') + button.textContent.trim() + '.'; render(instance.state); }).catch(function () { announcement = 'Category visibility was not saved.'; render(instance.state); }); }); });
		root.querySelectorAll('[data-toggle-todo]').forEach(function (checkbox) { checkbox.addEventListener('change', function () { var todo = state.todos.filter(function (item) { return String(item.id) === String(checkbox.getAttribute('data-toggle-todo')); })[0]; if (!todo) return; todo = Object.assign({}, todo, { completed: checkbox.checked }); instance.updateTodo(todo).catch(function () { render(instance.state); }); }); });
		var createTodoForm = root.querySelector('[data-create-todo]'); if (createTodoForm) createTodoForm.addEventListener('submit', function (event) { event.preventDefault(); var input = createTodoForm.querySelector('input[name="title"]'); if (!input || !input.value.trim()) return; instance.createTodo({ title: input.value.trim(), category: 'personal' }).then(function () { announcement = 'Task added.'; render(instance.state); }).catch(function () { announcement = 'The task was not saved.'; render(instance.state); }); });
		root.querySelectorAll('[data-favorite-event]').forEach(function (button) { button.addEventListener('click', function () { var target = state.events.filter(function (event) { return String(event.id) === String(button.getAttribute('data-favorite-event')); })[0]; if (!target) return; instance.toggleFavorite(target).then(function () { announcement = 'Favorite updated.'; render(instance.state); }).catch(function () { announcement = 'Favorite was not saved.'; render(instance.state); }); }); });
		root.querySelectorAll('[data-join-event]').forEach(function (button) { button.addEventListener('click', function () { var target = state.events.filter(function (event) { return String(event.id) === String(button.getAttribute('data-join-event')); })[0]; if (!target) return; button.disabled = true; instance.getJoinInfo(target).then(function (info) { button.disabled = false; if (info.joinUrl) global.open(info.joinUrl, '_blank', 'noopener'); else { announcement = info.reason || 'Join opens when the session window is active.'; render(instance.state); } }).catch(function () { button.disabled = false; announcement = 'Join information is temporarily unavailable.'; render(instance.state); }); }); });
		root.querySelectorAll('[data-replay-event]').forEach(function (button) { button.addEventListener('click', function () { var target = state.events.filter(function (event) { return String(event.id) === String(button.getAttribute('data-replay-event')); })[0]; if (!target) return; button.disabled = true; instance.refreshRecording(target).then(function (result) { button.disabled = false; if (result && result.event && result.event.replayUrl) global.open(result.event.replayUrl, '_blank', 'noopener'); else { announcement = 'Replay is not ready yet.'; render(instance.state); } }).catch(function () { button.disabled = false; announcement = 'Replay is temporarily unavailable.'; render(instance.state); }); }); });
		var openSettings = root.querySelector('[data-open-settings]'); if (openSettings) openSettings.addEventListener('click', function () { root.querySelector('#mcv2-settings').showModal(); });
		var saveSettings = root.querySelector('[data-save-settings]'); if (saveSettings) saveSettings.addEventListener('click', function () { var choice = root.querySelector('input[name="calendar-experience"]:checked'); if (!choice) return; saveSettings.disabled = true; instance.setPreference(choice.value).then(function () { global.location.reload(); }).catch(function (error) { saveSettings.disabled = false; announcement = error.message; render(instance.state); }); });
		var retry = root.querySelector('[data-retry-scheduler]'); if (retry) retry.addEventListener('click', instance.reloadScheduler);
		var remove = root.querySelector('[data-delete-event]'); if (remove) remove.addEventListener('click', function () { var target = state.events.filter(function (event) { return String(event.id) === String(remove.getAttribute('data-delete-event')); })[0]; if (!target || !global.confirm('Delete this event? This cannot be undone.')) return; instance.deleteEvent(target).then(function () { selectedEventId = ''; announcement = 'Event deleted.'; render(instance.state); }).catch(function () { announcement = 'The event was not deleted. Nothing changed.'; render(instance.state); }); });
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
			if (app.state && app.state.route === 'calendar') mount(app);
		}, 100);
	}

	global.MMEDCalendarV2 = { mount: mount, unmount: unmount, __test: { effectivePerspective: effectivePerspective } };
	global.MMEDCalendarV4 = global.MMEDCalendarV2;
	boot();
})(window, document);
