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

	function esc(value) {
		return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character];
		});
	}

	function categoryLabel(category) {
		return { live: 'Live session', strategy: 'Strategy session', appointment: 'Appointment', deadline: 'Deadline', assignment: 'Assignment', drills: 'Drills' }[category] || 'Calendar';
	}

	function eventRow(event, compact) {
		return '<button type="button" class="mcv2-event mcv2-event--' + esc(event.category) + (compact ? ' is-compact' : '') + '" data-event-id="' + esc(event.id) + '">' +
			'<span class="mcv2-event-time">' + esc(event.timeLabel) + '</span>' +
			'<span class="mcv2-event-copy"><strong>' + esc(event.title) + '</strong><small>' + esc(categoryLabel(event.category)) + '</small></span>' +
			(event.replayUrl ? '<span class="mcv2-chip is-replay">Watch replay</span>' : event.joinUrl ? '<span class="mcv2-chip">Join</span>' : '') +
			'</button>';
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
		if (!state.capabilities.admin) return '';
		var topics = global.MMEDCalendarCore.drillTopics[drillTab] || [];
		return '<section class="mcv2-drills" aria-label="Drills quick schedule"><div class="mcv2-drills-head"><div><p class="mcv2-kicker">Admin scheduling</p><h2>Dr. J’s Drills</h2></div><p>Drag a subject to a calendar day, or select it and use “Schedule here.”</p></div>' +
			'<div class="mcv2-drill-tabs" role="tablist"><button type="button" role="tab" data-drill-tab="Step/Level 1" aria-selected="' + (drillTab === 'Step/Level 1') + '">Step/Level 1</button><button type="button" role="tab" data-drill-tab="Step/Level 2/3" aria-selected="' + (drillTab === 'Step/Level 2/3') + '">Step/Level 2 &amp; 3</button></div>' +
			'<div class="mcv2-drill-topics">' + topics.map(function (topic) {
				var active = armedDrill && armedDrill.topic === topic && armedDrill.level === drillTab;
				return '<button type="button" draggable="true" class="mcv2-drill-topic' + (active ? ' is-armed' : '') + '" data-drill-topic="' + esc(topic) + '" data-drill-level="' + esc(drillTab) + '">' + esc(topic) + '</button>';
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
			'<div class="mcv2-drawer-actions">' +
			(normalized.replayUrl ? '<a class="mcv2-action is-replay" href="' + esc(normalized.replayUrl) + '" target="_blank" rel="noopener">Watch replay</a>' : '') +
			(normalized.joinUrl ? '<a class="mcv2-action" href="' + esc(normalized.joinUrl) + '" target="_blank" rel="noopener">Join session</a>' : '') +
			(normalized.writable ? '<button type="button" class="mcv2-action is-danger" data-delete-event="' + esc(normalized.id) + '">Delete</button>' : '') +
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
		var content = state.wpStatus === 'loading' ? '<div class="mcv2-skeleton" role="status">Loading live Calendar events…</div>' : state.wpStatus === 'error' ? '<div class="mcv2-error" role="alert">' + esc(state.error || 'Calendar unavailable.') + '</div>' :
			state.view === 'today' ? renderToday(model, state) : state.view === 'month' ? renderMonth(model, state) : state.view === 'week' ? renderWeek(model) : state.view === 'day' ? renderDay(model) : renderAgenda(model);
		var nav = ['today','month','week','day','agenda'].map(function (view) { return '<button type="button" data-view="' + view + '"' + (state.view === view ? ' aria-current="page"' : '') + '><span aria-hidden="true">' + ({today:'&#9673;',month:'&#9638;',week:'&#9636;',day:'&#9633;',agenda:'&#9642;'}[view]) + '</span>' + view.charAt(0).toUpperCase() + view.slice(1) + '</button>'; }).join('');
		root.innerHTML = '<div class="mcv2-shell"><aside class="mcv2-rail"><div class="mcv2-brand"><strong>Matrix <em>Calendar</em></strong><small>MissionMed</small></div><nav aria-label="Calendar views">' + nav + '</nav><button type="button" class="mcv2-settings-button" data-open-settings>&#9881; Settings</button><div class="mcv2-zone">' + esc(state.timezoneLabel) + '</div></aside>' +
			'<main class="mcv2-main"><header class="mcv2-header"><div><p class="mcv2-kicker">Matrix Calendar</p><h1>' + (state.view === 'today' ? 'Today, <em>' + esc(model.todayLabel) + '</em>' : esc(state.view.charAt(0).toUpperCase() + state.view.slice(1)) + ' <em>view</em>') + '</h1></div><div class="mcv2-header-actions"><button type="button" data-nav="-1" aria-label="Previous">&larr;</button><button type="button" data-today>Today</button><button type="button" data-nav="1" aria-label="Next">&rarr;</button><strong>' + esc(model.title) + '</strong></div></header>' +
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
		root.querySelectorAll('[data-nav]').forEach(function (button) { button.addEventListener('click', function () { instance.navigate(Number(button.getAttribute('data-nav'))); }); });
		var today = root.querySelector('[data-today]'); if (today) today.addEventListener('click', instance.today);
		root.querySelectorAll('[data-day],[data-schedule-day]').forEach(function (button) { button.addEventListener('click', function () { var day = button.getAttribute('data-schedule-day') || button.getAttribute('data-day'); if (button.hasAttribute('data-schedule-day')) schedule(day); else { instance.setDate(day); instance.setView('day'); } }); });
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
		instance = null;
		selectedEventId = '';
		drawerReturnEventId = '';
		drawerNeedsFocus = false;
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

	global.MMEDCalendarV2 = { mount: mount, unmount: unmount };
	global.MMEDCalendarV4 = global.MMEDCalendarV2;
	boot();
})(window, document);
