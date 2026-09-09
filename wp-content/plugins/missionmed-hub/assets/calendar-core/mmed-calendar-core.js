/**
 * Matrix Calendar shared behavioral core.
 * Renderers receive normalized state and commands; all network and time behavior lives here.
 */
(function (global) {
	'use strict';

	var ZONE = 'America/New_York';
	var ZONE_LABEL = 'Eastern Time (ET)';
	var MINUTE = 60000;
	var config = (global.mmedStudentOsFeatureFlags && global.mmedStudentOsFeatureFlags.calendar_experience) || {};
	var sharedPrimaryCache = {};
	var localIdSequence = 0;
	var PRIMARY_TIMEOUT_MS = Math.max(50, Number(config.primary_timeout_ms) || 8000);
	var SCHEDULER_TIMEOUT_MS = Math.max(50, Number(config.scheduler_timeout_ms) || 2500);

	var DRILL_TOPICS = {
		'Step/Level 1': ['Cardiology','Pulmonary','Renal / GU','GIT / HEP','Endocrine','Neurology','Derm / Ophtho','Micro / Infectious Disease','Viruses / Protozoa / Parasites','Immunology','Muscle / Rheumatology','Heme / Onc','Oncology by Systems','Repro / GYN / OB','Biochem / Genetics / Vitamins','Psych / Ethics','Biostats / Public Health','ER Medicine','Mixed Review'],
		'Step/Level 2/3': ['Cardiology','Pulmonary','Renal / GU / Electrolytes','GIT / HEP','Endocrine','Neurology','Derm / Ophtho','Infectious Disease','Rheumatology','Preventative / Vaccines / Vitamins','Heme / Onc','OB','GYN','Pediatrics','Psych / Ethics','Biostats / Public Health','ER Medicine','Surgery','Mixed Review']
	};

	function text(value) {
		return String(value == null ? '' : value).replace(/[<>]/g, '');
	}

	function zonedParts(value) {
		var parts = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(value);
		var map = {};
		parts.forEach(function (part) { if (part.type !== 'literal') map[part.type] = Number(part.value); });
		return map;
	}

	function zonedDate(year, month, day, hour, minute, second) {
		var desired = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0);
		var guess = new Date(desired);
		for (var attempt = 0; attempt < 3; attempt += 1) {
			var parts = zonedParts(guess);
			var represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
			var correction = desired - represented;
			if (!correction) break;
			guess = new Date(guess.getTime() + correction);
		}
		return guess;
	}

	function parseDate(value, fallback) {
		if (value instanceof Date) return isNaN(value.getTime()) ? fallback : new Date(value.getTime());
		var raw = String(value || '').trim();
		if (!raw) return fallback || new Date();
		var dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
		if (dateOnly) return zonedDate(Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3]), 12, 0, 0);
		var local = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
		if (local) return zonedDate(Number(local[1]), Number(local[2]), Number(local[3]), Number(local[4]), Number(local[5]), Number(local[6] || 0));
		var parsed = new Date(raw);
		return isNaN(parsed.getTime()) ? (fallback || new Date()) : parsed;
	}

	function format(value, options) {
		return new Intl.DateTimeFormat('en-US', Object.assign({ timeZone: ZONE }, options || {})).format(parseDate(value));
	}

	function dateKey(value) {
		var parts = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(parseDate(value));
		var map = {};
		parts.forEach(function (part) { map[part.type] = part.value; });
		return [map.year, map.month, map.day].join('-');
	}

	function localDateTime(value) {
		var d = zonedParts(parseDate(value));
		function pad(n) { return String(n).padStart(2, '0'); }
		return d.year + '-' + pad(d.month) + '-' + pad(d.day) + 'T' + pad(d.hour) + ':' + pad(d.minute) + ':' + pad(d.second);
	}

	function metaOf(raw) {
		if (raw && raw.meta && typeof raw.meta === 'object') return raw.meta;
		if (raw && raw.meta_json && typeof raw.meta_json === 'object') return raw.meta_json;
		if (raw && typeof raw.meta_json === 'string') {
			try { return JSON.parse(raw.meta_json) || {}; } catch (ignore) { return {}; }
		}
		return {};
	}

	function safeUrl(value) {
		var raw = text(value).trim();
		if (!raw) return '';
		try {
			var url = new URL(raw, global.location && global.location.origin ? global.location.origin : 'https://missionmedinstitute.com');
			return /^(https?):$/.test(url.protocol) ? url.toString() : '';
		} catch (ignore) {
			return '';
		}
	}

	function categoryOf(raw, source, title) {
		var key = String(raw || 'general').toLowerCase();
		var session = String(title || '').match(/(?:session|group)\s*([a-f])\b/i);
		if (/^personal-/.test(key) || /^system-/.test(key)) return key;
		if (source === 'scheduler' || key === 'appointment') return 'appointment';
		if (key === 'drill_step1') return 'drill_step1';
		if (key === 'drill_step23') return 'drill_step23';
		if (key === 'nrmp' || key === 'nrmp_date') return 'nrmp';
		if (key === 'deadline') return 'deadline';
		if (key === 'assignment') return 'assignment';
		if (/^mr_session_[a-f]$/.test(key)) return key;
		if (key === 'mr_session' || key === 'mr_class_schedule') return session ? 'mr_session_' + session[1].toLowerCase() : 'mission_residency';
		if (key === 'mission_residency') return 'mission_residency';
		if (key === 'rotation') return 'clinicals';
		if (key === 'arena_event') return 'arena';
		if (key === 'mock_interview' || /session|workshop|interview/i.test(title || '')) return 'live';
		return key;
	}

	function favoriteKey(event) {
		if (!event) return '';
		if (event.source && event.sourceId) return event.source + ':' + event.sourceId;
		return 'event:' + String(event.id == null ? '' : event.id);
	}

	function normalizeEvent(raw, capabilities) {
		raw = raw || {};
		var meta = metaOf(raw);
		var start = parseDate(raw.start_at || raw.start, new Date());
		var end = raw.end_at || raw.end ? parseDate(raw.end_at || raw.end, new Date(start.getTime() + 60 * MINUTE)) : new Date(start.getTime() + 60 * MINUTE);
		if (isNaN(end.getTime()) || end <= start) end = new Date(start.getTime() + 60 * MINUTE);
		var eventType = text(raw.event_type || raw.category || 'general').toLowerCase();
		var source = text(raw.source || '').toLowerCase();
		var scheduler = source === 'scheduler' || eventType === 'appointment';
		var joinUrl = safeUrl(raw.meeting_url || raw.join_url || raw.joinUrl || (raw.join_button && raw.join_button.url) || meta.meeting_url || meta.join_url || meta.classroom_url);
		var replayUrl = safeUrl(raw.recording_url || raw.replay_url || meta.recording_url || meta.replay_url);
		var isAdmin = !!(capabilities && capabilities.admin);
		var globalEvent = Number(raw.user_id || 0) === 0;
		var event = {
			id: raw.id,
			title: text(raw.title || 'Untitled event'),
			start: start,
			end: end,
			allDay: !!(raw.all_day || raw.allDay),
			description: text(raw.description || raw.content || meta.description || ''),
			eventType: eventType,
			category: categoryOf(raw.category || eventType, scheduler ? 'scheduler' : source, raw.title),
			source: scheduler ? 'scheduler' : source,
			sourceId: text(raw.source_id || raw.sourceId || raw.appointment_id || raw.appointmentId || ''),
			userId: raw.user_id || raw.userId || null,
			meta: meta,
			joinUrl: joinUrl,
			meetingPlatform: text(raw.meeting_platform || raw.meetingPlatform || meta.meeting_platform || meta.meeting_provider || ''),
			audience: text(raw.audience || meta.audience || ''),
			replayUrl: replayUrl,
			recordingStatus: text(raw.recording_status || meta.recording_status || ''),
			writable: !scheduler && (isAdmin ? true : !(globalEvent || source === 'system')),
			favoriteKey: '',
			favorite: false,
			important: !!(meta.important || meta.match_day || eventType === 'deadline' || /MATCH DAY|SOAP|deadline|certification/i.test(raw.title || ''))
		};
		event.favoriteKey = favoriteKey(event);
		return event;
	}

	function normalizeCategory(raw) {
		raw = raw || {};
		return {
			id: text(raw.id || raw.key || ''),
			parentId: text(raw.parent_id || raw.parentId || ''),
			name: text(raw.name || raw.label || 'Category'),
			color: /^#[0-9a-f]{6}$/i.test(String(raw.color || '')) ? String(raw.color) : '#94a3b8',
			ownerScope: text(raw.owner_scope || raw.ownerScope || (raw.system ? 'system' : 'personal')),
			ownerId: Number(raw.owner_id || raw.ownerId || 0),
			system: raw.system === true || raw.system === 1 || raw.system === '1',
			sortOrder: Number(raw.sort_order || raw.sortOrder || 100),
			source: text(raw.source || ''),
			eventType: text(raw.event_type || raw.eventType || ''),
			session: text(raw.session || ''),
			adminOnly: raw.admin_only === true || raw.admin_only === 1 || raw.admin_only === '1'
		};
	}

	function normalizeTodo(raw) {
		raw = raw || {};
		return {
			id: raw.id,
			title: text(raw.title || raw.text || 'Task'),
			completed: !!(raw.completed || raw.done),
			priority: text(raw.priority || 'medium'),
			dueDate: text(raw.due_date || raw.date || ''),
			category: text(raw.category || ''),
			subtasks: Array.isArray(raw.subtasks) ? raw.subtasks.map(function (item) { return { title: text(item.title || ''), completed: !!item.completed }; }) : [],
			sortOrder: Number(raw.sort_order || 0),
			notes: text(raw.notes || ''),
			meetingUrl: safeUrl(raw.meeting_url || raw.meetingUrl || ''),
			meetingPlatform: text(raw.meeting_platform || raw.meetingPlatform || '')
		};
	}

	function eventKey(event) {
		if (!event) return '';
		if (event.source === 'scheduler' && event.sourceId) return 'scheduler:' + event.sourceId;
		return [event.title, event.start && event.start.toISOString(), event.end && event.end.toISOString(), event.category].join('|').toLowerCase();
	}

	function mergeEvents(primary, scheduler) {
		var result = [];
		var seen = {};
		function add(event, enrich) {
			var key = eventKey(event);
			if (key && seen[key] !== undefined) {
				if (enrich) {
					var canonical = result[seen[key]];
					var enriched = Object.assign({}, canonical);
					['joinUrl','replayUrl','meetingPlatform','recordingStatus','sourceId'].forEach(function (field) {
						if (!enriched[field] && event[field]) enriched[field] = event[field];
					});
					enriched.meta = Object.assign({}, event.meta || {}, canonical.meta || {});
					result[seen[key]] = enriched;
				}
				return;
			}
			if (key) seen[key] = result.length;
			result.push(event);
		}
		(primary || []).forEach(function (event) { add(event, false); });
		(scheduler || []).forEach(function (event) { add(event, true); });
		return result.sort(function (a, b) { return a.start - b.start; });
	}

	function timeout(promise, milliseconds, label) {
		return new Promise(function (resolve, reject) {
			var timer = global.setTimeout(function () { reject(new Error(label || 'Request timed out')); }, milliseconds);
			Promise.resolve(promise).then(function (value) {
				global.clearTimeout(timer);
				resolve(value);
			}, function (error) {
				global.clearTimeout(timer);
				reject(error);
			});
		});
	}

	function requestWithDeadline(factory, milliseconds, outerSignal, label) {
		var controller = global.AbortController ? new global.AbortController() : null;
		var signal = controller ? controller.signal : outerSignal;
		var settled = false;
		var timer = 0;
		var onOuterAbort = function () { if (controller) controller.abort(); };
		if (outerSignal) {
			if (outerSignal.aborted) onOuterAbort();
			else if (typeof outerSignal.addEventListener === 'function') outerSignal.addEventListener('abort', onOuterAbort, { once: true });
		}
		function cleanup() {
			if (timer) global.clearTimeout(timer);
			if (outerSignal && typeof outerSignal.removeEventListener === 'function') outerSignal.removeEventListener('abort', onOuterAbort);
		}
		var request;
		try {
			request = factory(signal);
		} catch (error) {
			cleanup();
			return Promise.reject(error);
		}
		return new Promise(function (resolve, reject) {
			timer = global.setTimeout(function () {
				if (settled) return;
				settled = true;
				if (controller) controller.abort();
				var error = new Error(label || 'Request timed out');
				error.name = 'TimeoutError';
				cleanup();
				reject(error);
			}, milliseconds);
			Promise.resolve(request).then(function (value) {
				if (settled) return;
				settled = true;
				cleanup();
				resolve(value);
			}, function (error) {
				if (settled) return;
				settled = true;
				cleanup();
				reject(error);
			});
		});
	}

	function isAdmin(app) {
		var profile = (app && app.state && app.state.profile) || (app && app.profile) || {};
		return profile.is_admin === true || profile.is_admin === 1 || profile.is_admin === '1';
	}

	function apiDelete(api, endpoint) {
		if (api && typeof api.delete === 'function') return api.delete(endpoint);
		if (api && typeof api.del === 'function') return api.del(endpoint);
		return Promise.reject(new Error('Delete is unavailable'));
	}

	function eventPayload(event) {
		var meta = Object.assign({}, event.meta || {});
		return {
			title: event.title,
			event_type: event.eventType || (event.category === 'drills' ? 'drill_step1' : 'custom'),
			start_at: localDateTime(event.start),
			end_at: localDateTime(event.end),
			all_day: !!event.allDay,
			description: event.description || '',
			meeting_url: safeUrl(event.joinUrl || ''),
			meeting_platform: event.meetingPlatform || '',
			category: event.category || '',
			priority: event.priority || 0,
			audience: event.audience || '',
			meta: meta
		};
	}

	function todoPayload(todo) {
		return {
			title: todo.title || todo.text || 'Task',
			completed: !!(todo.completed || todo.done),
			priority: todo.priority === 'med' ? 'medium' : (todo.priority || 'medium'),
			due_date: todo.dueDate || todo.due_date || todo.date || '',
			category: todo.category || '',
			subtasks: Array.isArray(todo.subtasks) ? todo.subtasks : [],
			sort_order: Number(todo.sortOrder || todo.sort_order || 0),
			notes: todo.notes || '',
			meeting_url: safeUrl(todo.meetingUrl || todo.meeting_url || ''),
			meeting_platform: todo.meetingPlatform || todo.meeting_platform || ''
		};
	}

	function addDays(value, amount) {
		var parts = zonedParts(parseDate(value));
		var calendar = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount, parts.hour, parts.minute, parts.second));
		return zonedDate(calendar.getUTCFullYear(), calendar.getUTCMonth() + 1, calendar.getUTCDate(), calendar.getUTCHours(), calendar.getUTCMinutes(), calendar.getUTCSeconds());
	}

	function addMonths(value, amount) {
		var parts = zonedParts(parseDate(value));
		var calendar = new Date(Date.UTC(parts.year, parts.month - 1 + amount, 1, parts.hour, parts.minute, parts.second));
		var lastDay = new Date(Date.UTC(calendar.getUTCFullYear(), calendar.getUTCMonth() + 1, 0)).getUTCDate();
		return zonedDate(calendar.getUTCFullYear(), calendar.getUTCMonth() + 1, Math.min(parts.day, lastDay), calendar.getUTCHours(), calendar.getUTCMinutes(), calendar.getUTCSeconds());
	}

	function eventView(event) {
		return Object.assign({}, event, {
			dateKey: dateKey(event.start),
			timeLabel: event.allDay ? 'All day' : format(event.start, { hour: 'numeric', minute: '2-digit' }),
			dateLabel: format(event.start, { weekday: 'short', month: 'short', day: 'numeric' }),
			fullDateLabel: format(event.start, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
			endTimeLabel: event.allDay ? '' : format(event.end, { hour: 'numeric', minute: '2-digit' })
		});
	}

	function daysForMonth(value) {
		var date = parseDate(value);
		var parts = zonedParts(date);
		var first = zonedDate(parts.year, parts.month, 1, 12, 0, 0);
		var firstWeekday = new Date(dateKey(first) + 'T12:00:00Z').getUTCDay();
		var cursor = addDays(first, -firstWeekday);
		var days = [];
		for (var i = 0; i < 42; i += 1) {
			var day = addDays(cursor, i);
			var dayParts = zonedParts(day);
			days.push({
				key: dateKey(day),
				label: format(day, { day: 'numeric' }),
				weekday: format(day, { weekday: 'short' }),
				fullLabel: format(day, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
				outside: dayParts.month !== parts.month
			});
		}
		return days;
	}

	function daysForWeek(value) {
		var date = parseDate(value);
		var weekday = new Date(dateKey(date) + 'T12:00:00Z').getUTCDay();
		var first = addDays(date, -weekday);
		var days = [];
		for (var i = 0; i < 7; i += 1) {
			var day = addDays(first, i);
			days.push({ key: dateKey(day), label: format(day, { day: 'numeric' }), weekday: format(day, { weekday: 'short' }), fullLabel: format(day, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) });
		}
		return days;
	}

	function categoryVisible(categoryId, visibility, categories) {
		var byId = {};
		(categories || []).forEach(function (category) { if (category && category.id) byId[String(category.id)] = category; });
		var cursor = String(categoryId || '');
		var visited = {};
		while (cursor && !visited[cursor]) {
			visited[cursor] = true;
			if (visibility && visibility[cursor] === false) return false;
			cursor = byId[cursor] && byId[cursor].parentId ? String(byId[cursor].parentId) : '';
		}
		return true;
	}

	function visibleEvents(state) {
		return (state.events || []).filter(function (event) { return categoryVisible(event.category, state.visibility || {}, state.categories || []); });
	}

	function viewModel(state) {
		var events = visibleEvents(state).map(eventView);
		var byDay = {};
		events.forEach(function (event) { if (!byDay[event.dateKey]) byDay[event.dateKey] = []; byDay[event.dateKey].push(event); });
		var today = new Date();
		var todayKey = dateKey(today);
		var monthDays = daysForMonth(state.date).map(function (day) { return Object.assign({}, day, { today: day.key === todayKey, events: byDay[day.key] || [] }); });
		var weekDays = daysForWeek(state.date).map(function (day) { return Object.assign({}, day, { today: day.key === todayKey, events: byDay[day.key] || [] }); });
		var selectedKey = dateKey(state.selectedDate || state.date);
		var future = events.filter(function (event) { return event.end >= today; });
		var weekTitle = format(parseDate(weekDays[0].key), { month: 'short', day: 'numeric' }) + ' – ' + format(parseDate(weekDays[6].key), { month: 'short', day: 'numeric' });
		return {
			view: state.view,
			events: events,
			title: state.view === 'month' ? format(state.date, { month: 'long', year: 'numeric' }) : state.view === 'week' ? weekTitle : format(state.selectedDate || state.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
			todayLabel: format(today, { month: 'long', day: 'numeric' }),
			todayKey: todayKey,
			selectedKey: selectedKey,
			monthDays: monthDays,
			weekDays: weekDays,
			selectedEvents: byDay[selectedKey] || [],
			todayEvents: byDay[todayKey] || [],
			agenda: future.slice(0, 60),
			deadlines: future.filter(function (event) { return event.category === 'deadline'; }).slice(0, 4),
			appointments: future.filter(function (event) { return event.category === 'appointment'; }).slice(0, 2),
			replays: events.filter(function (event) { return !!event.replayUrl; }).slice(-4).reverse(),
			todos: (state.todos || []).slice(0, 5)
		};
	}

	function buildDrillEvent(day, topic, level) {
		if (!DRILL_TOPICS[level] || DRILL_TOPICS[level].indexOf(topic) === -1) throw new Error('Unknown Drills topic.');
		var stepOne = level === 'Step/Level 1';
		var key = dateKey(parseDate(day));
		var match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
		var date = zonedDate(Number(match[1]), Number(match[2]), Number(match[3]), stepOne ? 10 : 14, 0, 0);
		var end = new Date(date.getTime() + 120 * MINUTE);
		return {
			title: topic + ' (' + level + ')',
			start: date,
			end: end,
			allDay: false,
			description: 'Live drill with Dr. J',
			eventType: stepOne ? 'drill_step1' : 'drill_step23',
			category: stepOne ? 'drill_step1' : 'drill_step23',
			meetingPlatform: '',
			joinUrl: '',
			meta: { drill_level: level, drill_topic: topic },
			audience: 'all_students'
		};
	}

	function classicFormat(value, type) {
		var options = {};
		if (type === 'monthYear') options = { month: 'long', year: 'numeric' };
		else if (type === 'shortDay') return format(value, { weekday: 'short' }).toUpperCase();
		else if (type === 'dayName') options = { weekday: 'long' };
		else if (type === 'shortMonth') options = { month: 'short' };
		else if (type === 'full') options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
		else if (type === 'time') options = { hour: 'numeric', minute: '2-digit' };
		else if (type === 'agendaDate') options = { month: 'short', day: 'numeric' };
		else options = { month: 'numeric', day: 'numeric', year: 'numeric' };
		return format(value, options);
	}

	function sameDay(a, b) { return dateKey(a) === dateKey(b); }
	function isToday(value) { return dateKey(value) === dateKey(new Date()); }
	function eventsOn(events, day) {
		return (events || []).filter(function (event) { return sameDay(event.start, day); }).sort(function (a, b) { return a.start - b.start; });
	}
	function eventLayout(event, minimumHeight) {
		var start = zonedParts(event.start);
		var end = zonedParts(event.end);
		var startHour = start.hour + start.minute / 60;
		var endHour = end.hour + end.minute / 60;
		return { top: Math.max(0, startHour - 6) * 60, height: Math.max(minimumHeight || 28, (endHour - startHour) * 60) };
	}
	function classicMonthGrid(value, selected, events) {
		var date = parseDate(value);
		var parts = zonedParts(date);
		return {
			title: classicFormat(date, 'monthYear'),
			cells: daysForMonth(date).map(function (day) {
				var parsed = parseDate(day.key);
				return Object.assign({}, day, {
					value: day.key,
					outside: zonedParts(parsed).month !== parts.month,
					today: isToday(parsed),
					selected: sameDay(parsed, selected),
					events: eventsOn(events, parsed)
				});
			})
		};
	}
	function classicWeekGrid(value, events) {
		var days = daysForWeek(value).map(function (day) {
			var parsed = parseDate(day.key);
			return Object.assign({}, day, {
				today: isToday(parsed),
				events: eventsOn(events, parsed).filter(function (event) { return !event.allDay; }).map(function (event) { return Object.assign({}, event, { layout: eventLayout(event, 28) }); })
			});
		});
		return { title: classicFormat(days[0].key, 'shortMonth') + ' ' + format(days[0].key, { day: 'numeric' }) + ' - ' + classicFormat(days[6].key, 'shortMonth') + ' ' + format(days[6].key, { day: 'numeric', year: 'numeric' }), days: days };
	}
	function classicDayGrid(value, events) {
		var date = parseDate(value);
		return {
			title: classicFormat(date, 'full'),
			dayName: classicFormat(date, 'dayName'),
			dayFull: format(date, { month: 'short', day: 'numeric', year: 'numeric' }),
			events: eventsOn(events, date).filter(function (event) { return !event.allDay; }).map(function (event) { return Object.assign({}, event, { layout: eventLayout(event, 38) }); })
		};
	}
	function classicAgendaGroups(value, events) {
		var anchor = zonedParts(parseDate(value));
		var monthStart = zonedDate(anchor.year, anchor.month, 1, 0, 0, 0);
		var groups = {};
		(events || []).filter(function (event) { return event.start >= monthStart; }).sort(function (a, b) { return a.start - b.start; }).forEach(function (event) {
			var key = dateKey(event.start);
			if (!groups[key]) groups[key] = [];
			groups[key].push(event);
		});
		return Object.keys(groups).sort().slice(0, 14).map(function (key) { return { key: key, date: parseDate(key), today: isToday(key), events: groups[key] }; });
	}
	function trackerModel(phases, matchDay) {
		var now = new Date();
		var active = null;
		var modeled = (phases || []).map(function (phase) {
			var start = parseDate(phase.start);
			var end = parseDate(phase.end);
			var status = now >= start && now <= end ? 'active' : now > end ? 'completed' : 'future';
			if (status === 'active') active = phase;
			return Object.assign({}, phase, { status: status });
		});
		return { phases: modeled, active: active, daysUntil: Math.ceil((parseDate(matchDay) - now) / (24 * 60 * MINUTE)) };
	}
	function dateInput(value) { return dateKey(value); }
	function timeInput(value) {
		var parts = zonedParts(parseDate(value));
		return String(parts.hour).padStart(2, '0') + ':' + String(parts.minute).padStart(2, '0');
	}
	function combineDateTime(day, startTime, endTime) {
		var date = String(day || '').split('-').map(Number);
		var start = String(startTime || '00:00').split(':').map(Number);
		var end = String(endTime || '00:00').split(':').map(Number);
		return { start: zonedDate(date[0], date[1], date[2], start[0], start[1], 0), end: zonedDate(date[0], date[1], date[2], end[0], end[1], 0) };
	}
	function resizeEnd(start, height) { return new Date(parseDate(start).getTime() + Math.round((Math.max(28, height) / 60) * 60 / 15) * 15 * MINUTE); }
	function moveEventToDate(event, day) {
		var target = zonedParts(parseDate(day));
		var source = zonedParts(parseDate(event.start));
		var end = zonedParts(parseDate(event.end));
		return Object.assign({}, event, {
			start: zonedDate(target.year, target.month, target.day, source.hour, source.minute, source.second),
			end: zonedDate(target.year, target.month, target.day, end.hour, end.minute, end.second)
		});
	}
	function adjustEventDuration(event, minutes) {
		var start = parseDate(event && event.start);
		var end = parseDate(event && event.end);
		var adjusted = new Date(end.getTime() + Number(minutes || 0) * MINUTE);
		if (adjusted.getTime() - start.getTime() < 15 * MINUTE) return event;
		return Object.assign({}, event, { end: adjusted });
	}
	function icsDate(value) {
		var date = parseDate(value);
		function pad(number) { return String(number).padStart(2, '0'); }
		return date.getUTCFullYear() + pad(date.getUTCMonth() + 1) + pad(date.getUTCDate()) + 'T' + pad(date.getUTCHours()) + pad(date.getUTCMinutes()) + pad(date.getUTCSeconds()) + 'Z';
	}
	function icsDateOnly(value) { return dateKey(value).replace(/-/g, ''); }
	function nextLocalId() { localIdSequence += 1; return 'local-' + String(localIdSequence); }

	function create(app) {
		var api = app && app.api;
		var capabilities = { admin: isAdmin(app) };
		var listeners = [];
		var CACHE_FRESH_MS = 30000;
		var rangeGeneration = 0;
		var rangeAbortController = null;
		var primaryEvents = [];
		var schedulerEvents = [];
		var schedulerRetryTimer = 0;
		var destroyed = false;
		var today = new Date();
		var state = {
			view: 'month',
			date: today,
			selectedDate: today,
			events: [],
			todos: [],
			categories: [],
			visibility: {},
			favorites: [],
			wpStatus: 'loading',
			schedulerStatus: 'loading',
			todosStatus: 'loading',
			categoriesStatus: 'loading',
			timezone: ZONE,
			timezoneLabel: config.timezone_label || ZONE_LABEL,
			capabilities: capabilities,
			experience: config.experience || 'classic',
			forcedClassic: !!config.forced,
			busy: false,
			error: '',
			requestRange: null,
			cacheStatus: 'cold',
			telemetry: { primaryLoadMs: 0, cacheHits: 0, cancelledRanges: 0 }
		};

		function emit() { if (!destroyed) listeners.slice().forEach(function (listener) { listener(state); }); }
		function set(patch) { Object.keys(patch).forEach(function (key) { state[key] = patch[key]; }); emit(); }
		function subscribe(listener) { listeners.push(listener); listener(state); return function () { listeners = listeners.filter(function (item) { return item !== listener; }); }; }
		function applyFavorites(events, favorites) {
			var lookup = {};
			(favorites || state.favorites || []).forEach(function (key) { lookup[String(key)] = true; });
			return (events || []).map(function (event) { return Object.assign({}, event, { favorite: !!lookup[event.favoriteKey] }); });
		}

		function range() {
			var anchor = parseDate(state.selectedDate || state.date);
			var start;
			var end;
			if (state.view === 'month') {
				var parts = zonedParts(state.date);
				var first = zonedDate(parts.year, parts.month, 1, 12, 0, 0);
				start = addDays(first, -14);
				end = addDays(addMonths(first, 1), 14);
			} else if (state.view === 'week') {
				var weekday = new Date(dateKey(state.date) + 'T12:00:00Z').getUTCDay();
				start = addDays(state.date, -weekday - 7);
				end = addDays(state.date, 20 - weekday);
			} else if (state.view === 'day') {
				start = addDays(anchor, -7);
				end = addDays(anchor, 8);
			} else {
				start = addDays(anchor, -7);
				end = addDays(anchor, 90);
			}
			return { start: dateKey(start) + 'T00:00:00', end: dateKey(end) + 'T23:59:59', no_sync: '1' };
		}

		function loadSupportingData(generation, signal) {
			var todoRequest = typeof api.request === 'function' ? api.request('/todos', { method: 'GET', signal: signal }, {}) : api.get('/todos');
			todoRequest.then(function (payload) {
				var todos = payload && Array.isArray(payload.todos) ? payload.todos.map(normalizeTodo) : [];
				if (generation === rangeGeneration) set({ todos: todos, todosStatus: todos.length ? 'ready' : 'empty' });
			}).catch(function (error) { if (!(error && error.name === 'AbortError') && generation === rangeGeneration) set({ todosStatus: 'error' }); });
			var categoryRequest = typeof api.request === 'function' ? api.request('/calendar/categories', { method: 'GET', signal: signal }, {}) : api.get('/calendar/categories');
			categoryRequest.then(function (payload) {
				var source = payload && payload.categories ? payload.categories : [];
				var list = Array.isArray(source) ? source : Object.keys(source || {}).map(function (id) { return Object.assign({ id: id }, source[id]); });
				var favorites = payload && Array.isArray(payload.favorites) ? payload.favorites.map(String) : [];
				if (generation === rangeGeneration) {
					primaryEvents = applyFavorites(primaryEvents, favorites);
					schedulerEvents = applyFavorites(schedulerEvents, favorites);
					set({ categories: list.map(normalizeCategory), visibility: payload && payload.visibility && typeof payload.visibility === 'object' ? payload.visibility : {}, favorites: favorites, events: mergeEvents(primaryEvents, schedulerEvents), categoriesStatus: list.length ? 'ready' : 'empty' });
				}
			}).catch(function (error) { if (!(error && error.name === 'AbortError') && generation === rangeGeneration) set({ categoriesStatus: 'error' }); });
		}

		function loadPrimary(generation, signal) {
			if (!api || (typeof api.request !== 'function' && typeof api.get !== 'function')) {
				set({ wpStatus: 'error', todosStatus: 'error', error: 'Calendar service is unavailable.' });
				return Promise.reject(new Error('Calendar service is unavailable'));
			}
			var params = range();
			var key = String(api.base || '') + '|' + (capabilities.admin ? 'admin' : 'student') + '|' + params.start + '|' + params.end;
			var cached = sharedPrimaryCache[key];
			set({ requestRange: { start: params.start, end: params.end }, cacheStatus: cached ? 'hit' : 'miss' });
			if (cached) {
				state.telemetry.cacheHits += 1;
				primaryEvents = applyFavorites(cached.events.slice());
				set({ events: mergeEvents(primaryEvents, schedulerEvents), wpStatus: primaryEvents.length ? 'ready' : 'empty', error: '' });
				if (global.console && typeof global.console.info === 'function') global.console.info('[Matrix Calendar] primary cache=hit range=' + key);
				if (Date.now() - cached.savedAt < CACHE_FRESH_MS) {
					loadSupportingData(generation, signal);
					return Promise.resolve(cached.events.slice());
				}
			}
			var startedAt = Date.now();
			if (global.console && typeof global.console.info === 'function') global.console.info('[Matrix Calendar] primary start cache=' + (cached ? 'stale' : 'miss') + ' range=' + key);
			var request = requestWithDeadline(function (requestSignal) {
				return typeof api.request === 'function' ? api.request('/events', { method: 'GET', signal: requestSignal }, params) : api.get('/events', params);
			}, PRIMARY_TIMEOUT_MS, signal, 'Primary Matrix Calendar request timed out');
			var events = request.then(function (payload) {
				var normalized = payload && Array.isArray(payload.events) ? applyFavorites(payload.events.map(function (event) { return normalizeEvent(event, capabilities); })) : [];
				sharedPrimaryCache[key] = { events: normalized.slice(), savedAt: Date.now() };
				primaryEvents = normalized.slice();
				state.telemetry.primaryLoadMs = Date.now() - startedAt;
				if (global.console && typeof global.console.info === 'function') global.console.info('[Matrix Calendar] primary success cache=' + (cached ? 'revalidated' : 'miss') + ' duration_ms=' + state.telemetry.primaryLoadMs + ' events=' + normalized.length + ' range=' + key);
				if (generation === rangeGeneration) set({ events: mergeEvents(primaryEvents, schedulerEvents), wpStatus: normalized.length ? 'ready' : 'empty', cacheStatus: cached ? 'revalidated' : 'stored', error: '' });
				return normalized;
			}).catch(function (error) {
				if (error && error.name === 'AbortError' && (destroyed || generation !== rangeGeneration || (signal && signal.aborted))) return [];
				if (global.console && typeof global.console.warn === 'function') global.console.warn('[Matrix Calendar] primary failure class=' + String(error && error.name || 'Error') + ' status=' + String(error && error.status || 0) + ' duration_ms=' + (Date.now() - startedAt) + ' cache=' + (cached ? 'stale' : 'none') + ' stale_age_ms=' + (cached ? Date.now() - cached.savedAt : 0));
				if (generation === rangeGeneration) {
					if (cached) set({ wpStatus: primaryEvents.length ? 'ready' : 'empty', error: 'Live Matrix events could not be refreshed. Showing recently cached events.' });
					else set({ wpStatus: 'error', error: 'Live Matrix events could not be loaded.' });
				}
				throw error;
			});
			events.then(function () {
				if (!destroyed && generation === rangeGeneration) loadSupportingData(generation, signal);
			}, function () {
				if (!destroyed && generation === rangeGeneration) loadSupportingData(generation, signal);
			});
			return events;
		}

		var schedulerAuth = null;
		function sessionJson(url, options) {
			return global.fetch(url, options).then(function (response) {
				return response.json().catch(function () { return {}; }).then(function (payload) {
					if (!response.ok) {
						var error = new Error('Scheduler returned ' + response.status);
						error.status = response.status;
						throw error;
					}
					return payload;
				});
			});
		}
		function schedulerSession() {
			if (schedulerAuth && schedulerAuth.accessToken) return Promise.resolve(schedulerAuth);
			return sessionJson('/api/auth/session?mm_scheduler_exchange=1&audience=scheduler', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } }).then(function (payload) {
				if (payload.authenticated && payload.accessToken) return payload;
				return sessionJson('/api/auth/exchange', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ audience: 'scheduler' }) });
			}).then(function (payload) {
				if (!payload.authenticated || !payload.accessToken) throw new Error('Scheduler authentication unavailable');
				schedulerAuth = payload;
				return payload;
			});
		}
		function schedulerJson(url, signal, retry) {
			return schedulerSession().then(function (auth) {
				var headers = { Accept: 'application/json', Authorization: 'Bearer ' + auth.accessToken };
				if (auth.csrfToken) headers['x-mmhq-csrf'] = auth.csrfToken;
				return sessionJson(url, { credentials: 'same-origin', cache: 'no-store', headers: headers, signal: signal });
			}).catch(function (error) {
				if (retry !== false && error && (error.status === 401 || error.status === 403)) {
					schedulerAuth = null;
					return schedulerJson(url, signal, false);
				}
				throw error;
			});
		}
		function loadScheduler(generation, signal) {
			if (schedulerRetryTimer) { global.clearTimeout(schedulerRetryTimer); schedulerRetryTimer = 0; }
			set({ schedulerStatus: 'loading' });
			var params = range();
			var endpoint = capabilities.admin ? '/api/scheduler/admin/calendar-feed' : '/api/scheduler/calendar-feed';
			var url = new URL(endpoint, global.location.origin);
			Object.keys(params).forEach(function (key) { if (key !== 'no_sync') url.searchParams.set(key, params[key]); });
			var request = requestWithDeadline(function (requestSignal) { return schedulerJson(url.toString(), requestSignal, true); }, SCHEDULER_TIMEOUT_MS, signal, 'Scheduler enrichment timed out').then(function (payload) {
				var data = payload && (payload.data || payload);
				var events = data && Array.isArray(data.events) ? applyFavorites(data.events.map(function (event) { return normalizeEvent(event, capabilities); })) : [];
				if (generation === rangeGeneration) {
					schedulerEvents = events.slice();
					set({ events: mergeEvents(primaryEvents, schedulerEvents), schedulerStatus: events.length ? 'ready' : 'empty' });
				}
				return events;
			});
			return request.catch(function () {
				if (destroyed || (signal && signal.aborted)) return [];
				if (generation === rangeGeneration) {
					set({ schedulerStatus: 'degraded' });
					// MM-SEV1-504-001: remain degraded until an explicit route or user refresh.
					// Polling this recursive authentication path can exhaust the PHP worker pool.
				}
				return [];
			});
		}

		function beginGeneration() {
			if (schedulerRetryTimer) { global.clearTimeout(schedulerRetryTimer); schedulerRetryTimer = 0; }
			if (rangeAbortController) {
				rangeAbortController.abort();
				state.telemetry.cancelledRanges += 1;
			}
			rangeAbortController = global.AbortController ? new global.AbortController() : null;
			rangeGeneration += 1;
			primaryEvents = [];
			schedulerEvents = [];
			return { generation: rangeGeneration, signal: rangeAbortController ? rangeAbortController.signal : undefined };
		}

		function start() {
			var request = beginGeneration();
			var primary = loadPrimary(request.generation, request.signal);
			loadScheduler(request.generation, request.signal);
			return primary;
		}

		function refreshRange() {
			var request = beginGeneration();
			var primary = loadPrimary(request.generation, request.signal);
			loadScheduler(request.generation, request.signal);
			return primary;
		}

		function createEvent(candidate) {
			if (!api || typeof api.post !== 'function') return Promise.reject(new Error('Calendar editing is unavailable.'));
			if (!capabilities.admin && /^drill_/.test(String(candidate && candidate.eventType || ''))) return Promise.reject(new Error('Drills scheduling requires administrator access.'));
			set({ busy: true, error: '' });
			var hasAudience = candidate && Object.prototype.hasOwnProperty.call(candidate, 'audience');
			var authorizedCandidate = Object.assign({}, candidate, { audience: capabilities.admin ? (hasAudience ? candidate.audience : 'all_students') : '' });
			return api.post('/events', eventPayload(authorizedCandidate)).then(function (saved) {
				var event = applyFavorites([normalizeEvent(saved && (saved.event || saved), capabilities)])[0];
				primaryEvents = mergeEvents(primaryEvents, [event]);
				set({ events: mergeEvents(primaryEvents, schedulerEvents), busy: false });
				return event;
			}).catch(function (error) { set({ busy: false, error: 'The event was not saved. Nothing changed.' }); throw error; });
		}

		function updateEvent(event) {
			if (!event || !event.writable || !api || typeof api.put !== 'function') return Promise.reject(new Error('This event is read-only.'));
			set({ busy: true, error: '' });
			return api.put('/events/' + encodeURIComponent(event.id), eventPayload(event)).then(function (saved) {
				var normalized = normalizeEvent(saved && (saved.event || saved), capabilities);
				primaryEvents = primaryEvents.map(function (item) { return String(item.id) === String(normalized.id) ? normalized : item; });
				set({ events: mergeEvents(primaryEvents, schedulerEvents), busy: false });
				return normalized;
			}).catch(function (error) { set({ busy: false, error: 'The event was not updated. Nothing changed.' }); throw error; });
		}

		function deleteEvent(event) {
			if (!event || !event.writable) return Promise.reject(new Error('This event is read-only.'));
			set({ busy: true, error: '' });
			return apiDelete(api, '/events/' + encodeURIComponent(event.id)).then(function () {
				primaryEvents = primaryEvents.filter(function (item) { return String(item.id) !== String(event.id); });
				set({ events: mergeEvents(primaryEvents, schedulerEvents), busy: false });
			}).catch(function (error) { set({ busy: false, error: 'The event was not deleted. Nothing changed.' }); throw error; });
		}

		function createTodo(candidate) {
			if (!api || typeof api.post !== 'function') return Promise.reject(new Error('Task editing is unavailable.'));
			set({ busy: true, error: '' });
			return api.post('/todos', todoPayload(candidate)).then(function (saved) {
				var todo = normalizeTodo(saved && (saved.todo || saved));
				set({ todos: state.todos.concat([todo]), todosStatus: 'ready', busy: false });
				return todo;
			}).catch(function (error) { set({ busy: false, error: 'The task was not saved. Nothing changed.' }); throw error; });
		}

		function updateTodo(todo) {
			if (!todo || !api || typeof api.put !== 'function') return Promise.reject(new Error('Task editing is unavailable.'));
			set({ busy: true, error: '' });
			return api.put('/todos/' + encodeURIComponent(todo.id), todoPayload(todo)).then(function (saved) {
				var normalized = normalizeTodo(saved && (saved.todo || saved));
				set({ todos: state.todos.map(function (item) { return String(item.id) === String(normalized.id) ? normalized : item; }), busy: false });
				return normalized;
			}).catch(function (error) { set({ busy: false, error: 'The task was not updated. Nothing changed.' }); throw error; });
		}

		function deleteTodo(todo) {
			if (!todo) return Promise.reject(new Error('Task editing is unavailable.'));
			set({ busy: true, error: '' });
			return apiDelete(api, '/todos/' + encodeURIComponent(todo.id)).then(function () {
				set({ todos: state.todos.filter(function (item) { return String(item.id) !== String(todo.id); }), busy: false });
			}).catch(function (error) { set({ busy: false, error: 'The task was not deleted. Nothing changed.' }); throw error; });
		}

		function refreshRecording(event) {
			if (event && event.replayUrl) return Promise.resolve({ ready: true, event: event });
			if (!event || event.source !== 'scheduler' || !event.sourceId) return Promise.reject(new Error('Recording is unavailable.'));
			return schedulerJson('/api/scheduler/appointments/' + encodeURIComponent(event.sourceId) + '/recording', undefined, true).then(function (payload) {
				var data = payload && (payload.data || payload);
				var url = safeUrl(data && (data.recording_url || data.playback_url || (data.recording && data.recording.playback_url)));
				if (!url) return { ready: false, event: event };
				var updated = Object.assign({}, event, { replayUrl: url, recordingStatus: 'ready' });
				set({ events: state.events.map(function (item) { return String(item.id) === String(event.id) ? updated : item; }) });
				return { ready: true, event: updated };
			});
		}

		function getJoinInfo(event) {
			if (!event || !event.id || !api) return Promise.reject(new Error('Join information is unavailable.'));
			if (event.joinUrl) return Promise.resolve({ available: true, joinUrl: safeUrl(event.joinUrl), reason: '' });
			var request = typeof api.get === 'function' ? api.get('/meetings/' + encodeURIComponent(event.id) + '/join') : api.request('/meetings/' + encodeURIComponent(event.id) + '/join', { method: 'GET' }, {});
			return request.then(function (payload) {
				var available = !!(payload && (payload.available || payload.can_join || payload.join_url || payload.meeting_url));
				return {
					available: available,
					joinUrl: available ? safeUrl(payload && (payload.meeting_url || payload.join_url || payload.url || (payload.join && payload.join.url))) : '',
					reason: text(payload && (payload.reason || payload.message || ''))
				};
			});
		}

		function setCategoryVisibility(id, visible) {
			if (!api || typeof api.put !== 'function') return Promise.reject(new Error('Category preferences are unavailable.'));
			var next = Object.assign({}, state.visibility || {});
			next[String(id)] = !!visible;
			return api.put('/calendar/category-visibility', { visibility: next }).then(function () { set({ visibility: next }); return next; });
		}

		function saveFavorites(next) {
			if (!api || typeof api.put !== 'function') return Promise.reject(new Error('Favorites are unavailable.'));
			return api.put('/calendar/favorites', { favorites: next }).then(function (payload) {
				var saved = payload && Array.isArray(payload.favorites) ? payload.favorites.map(String) : next;
				primaryEvents = applyFavorites(primaryEvents, saved);
				schedulerEvents = applyFavorites(schedulerEvents, saved);
				set({ favorites: saved, events: mergeEvents(primaryEvents, schedulerEvents) });
				return saved;
			});
		}

		function toggleFavorite(event) {
			var key = event && (event.favoriteKey || favoriteKey(event));
			if (!key) return Promise.reject(new Error('This item cannot be favorited.'));
			var next = (state.favorites || []).slice();
			var index = next.indexOf(key);
			if (index === -1) next.push(key); else next.splice(index, 1);
			return saveFavorites(next);
		}

		function createCategory(category) {
			if (!api || typeof api.post !== 'function') return Promise.reject(new Error('Category editing is unavailable.'));
			return api.post('/calendar/categories', category).then(function (payload) {
				var next = payload && payload.state && Array.isArray(payload.state.categories) ? payload.state.categories.map(normalizeCategory) : state.categories.concat([normalizeCategory(payload.category || payload)]);
				set({ categories: next, categoriesStatus: 'ready' });
				return payload.category || payload;
			});
		}

		function updateCategory(category) {
			if (!category || !category.id || !api || typeof api.put !== 'function') return Promise.reject(new Error('Category editing is unavailable.'));
			return api.put('/calendar/categories/' + encodeURIComponent(category.id), category).then(function (payload) {
				var next = payload && payload.state && Array.isArray(payload.state.categories) ? payload.state.categories.map(normalizeCategory) : state.categories.map(function (item) { return item.id === category.id ? normalizeCategory(payload.category || category) : item; });
				set({ categories: next });
				return payload.category || payload;
			});
		}

		function deleteCategory(category) {
			if (!category || !category.id) return Promise.reject(new Error('Category editing is unavailable.'));
			return apiDelete(api, '/calendar/categories/' + encodeURIComponent(category.id)).then(function () { set({ categories: state.categories.filter(function (item) { return item.id !== category.id; }) }); });
		}

		function destroy() {
			destroyed = true;
			if (schedulerRetryTimer) { global.clearTimeout(schedulerRetryTimer); schedulerRetryTimer = 0; }
			if (rangeAbortController) rangeAbortController.abort();
			listeners = [];
		}

		function setPreference(experience) {
			if (config.forced) return Promise.reject(new Error('Force Classic is active.'));
			if (experience !== 'classic' && experience !== 'storyforge') return Promise.reject(new Error('Unknown calendar experience.'));
			if (!api || typeof api.put !== 'function') return Promise.reject(new Error('Preference service unavailable.'));
			return api.put('/me/calendar-experience', { experience: experience });
		}

		return {
			state: state,
			start: start,
			subscribe: subscribe,
				setView: function (view) { if (['today','month','week','day','agenda'].indexOf(view) !== -1 && view !== state.view) { set({ view: view }); return refreshRange(); } return Promise.resolve(state.events); },
				setDate: function (date) { var next = parseDate(date); set({ date: next, selectedDate: next }); return refreshRange(); },
				navigate: function (amount) { var next = state.view === 'week' ? addDays(state.date, amount * 7) : state.view === 'day' ? addDays(state.date, amount) : addMonths(state.date, amount); set({ date: next, selectedDate: next }); return refreshRange(); },
				today: function () { var now = new Date(); set({ date: now, selectedDate: now }); return refreshRange(); },
			createEvent: createEvent,
			updateEvent: updateEvent,
			deleteEvent: deleteEvent,
			createTodo: createTodo,
			updateTodo: updateTodo,
			deleteTodo: deleteTodo,
			refreshRecording: refreshRecording,
			getJoinInfo: getJoinInfo,
			setCategoryVisibility: setCategoryVisibility,
			toggleFavorite: toggleFavorite,
			createCategory: createCategory,
			updateCategory: updateCategory,
			deleteCategory: deleteCategory,
			setPreference: setPreference,
				reloadScheduler: function () { return loadScheduler(rangeGeneration, rangeAbortController ? rangeAbortController.signal : undefined); },
				reloadRange: refreshRange,
				destroy: destroy
		};
	}

	global.MMEDCalendarCore = {
		version: '4200c.2',
		zone: ZONE,
		zoneLabel: ZONE_LABEL,
		drillTopics: DRILL_TOPICS,
		parseDate: parseDate,
		zonedDate: zonedDate,
		zonedParts: zonedParts,
		format: format,
		dateKey: dateKey,
		localDateTime: localDateTime,
		normalizeEvent: normalizeEvent,
		normalizeTodo: normalizeTodo,
		normalizeCategory: normalizeCategory,
		favoriteKey: favoriteKey,
		mergeEvents: mergeEvents,
		viewModel: viewModel,
		buildDrillEvent: buildDrillEvent,
		classicFormat: classicFormat,
		sameDay: sameDay,
		isToday: isToday,
		eventsOn: eventsOn,
		classicMonthGrid: classicMonthGrid,
		classicWeekGrid: classicWeekGrid,
		classicDayGrid: classicDayGrid,
		classicAgendaGroups: classicAgendaGroups,
		trackerModel: trackerModel,
		dateInput: dateInput,
		timeInput: timeInput,
		combineDateTime: combineDateTime,
		resizeEnd: resizeEnd,
		moveEventToDate: moveEventToDate,
		adjustEventDuration: adjustEventDuration,
		categoryVisible: categoryVisible,
		visibleEvents: visibleEvents,
		icsDate: icsDate,
		icsDateOnly: icsDateOnly,
		now: function () { return new Date(); },
		nextLocalId: nextLocalId,
		safeUrl: safeUrl,
		timeout: timeout,
		eventPayload: eventPayload,
		todoPayload: todoPayload,
		create: create
	};
})(window);
