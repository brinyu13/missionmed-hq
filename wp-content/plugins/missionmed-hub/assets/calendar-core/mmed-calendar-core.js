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
		if (source === 'scheduler' || key === 'appointment') return 'appointment';
		if (key.indexOf('drill') === 0) return 'drills';
		if (key === 'deadline' || key === 'nrmp_date') return 'deadline';
		if (key === 'assignment') return 'assignment';
		if (key === 'mr_session' || key === 'mr_class_schedule') return 'strategy';
		if (key === 'mock_interview' || /session|workshop|interview/i.test(title || '')) return 'live';
		return key;
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
		return {
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
			replayUrl: replayUrl,
			recordingStatus: text(raw.recording_status || meta.recording_status || ''),
			writable: !scheduler && (isAdmin ? source !== 'system' : !(globalEvent || source === 'system')),
			important: !!(scheduler || meta.important || meta.match_2027 || meta.match_day || eventType === 'deadline' || /MATCH DAY|SOAP|deadline|certification/i.test(raw.title || ''))
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
		function add(event, replace) {
			var key = eventKey(event);
			if (key && seen[key] !== undefined) {
				if (replace) result[seen[key]] = event;
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
		var meta = Object.assign({}, event.meta || {}, { important: !!event.important });
		return {
			title: event.title,
			event_type: event.eventType || (event.category === 'drills' ? 'drill_step1' : 'custom'),
			start_at: localDateTime(event.start),
			end_at: localDateTime(event.end),
			all_day: !!event.allDay,
			description: event.description || '',
			meeting_url: event.joinUrl || '',
			meeting_platform: event.meetingPlatform || '',
			category: event.category || '',
			priority: event.important ? 1 : 0,
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
			notes: todo.notes || '',
			meeting_url: todo.meetingUrl || todo.meeting_url || '',
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

	function viewModel(state) {
		var events = (state.events || []).map(eventView);
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
			category: 'drills',
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
		var destroyed = false;
		var today = new Date();
		var state = {
			view: 'month',
			date: today,
			selectedDate: today,
			events: [],
			todos: [],
			wpStatus: 'loading',
			schedulerStatus: 'loading',
			todosStatus: 'loading',
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

		function loadPrimary(generation, signal) {
			if (!api || (typeof api.request !== 'function' && typeof api.get !== 'function')) {
				set({ wpStatus: 'error', todosStatus: 'error', error: 'Calendar service is unavailable.' });
				return Promise.reject(new Error('Calendar service is unavailable'));
			}
			var params = range();
			var key = String(api.base || '') + '|' + (capabilities.admin ? 'admin' : 'student') + '|' + params.start + '|' + params.end;
			var cached = sharedPrimaryCache[key];
			var todoRequest = typeof api.request === 'function' ? api.request('/todos', { method: 'GET', signal: signal }, {}) : api.get('/todos');
			todoRequest.then(function (payload) {
				var todos = payload && Array.isArray(payload.todos) ? payload.todos.map(normalizeTodo) : [];
				if (generation === rangeGeneration) set({ todos: todos, todosStatus: todos.length ? 'ready' : 'empty' });
			}).catch(function (error) { if (!(error && error.name === 'AbortError') && generation === rangeGeneration) set({ todosStatus: 'error' }); });
			set({ requestRange: { start: params.start, end: params.end }, cacheStatus: cached ? 'hit' : 'miss' });
			if (cached) {
				state.telemetry.cacheHits += 1;
				set({ events: cached.events.slice(), wpStatus: cached.events.length ? 'ready' : 'empty', error: '' });
				if (global.console && typeof global.console.info === 'function') global.console.info('[Matrix Calendar] primary cache=hit range=' + key);
				if (Date.now() - cached.savedAt < CACHE_FRESH_MS) return Promise.resolve(cached.events.slice());
			}
			var startedAt = Date.now();
			var request = typeof api.request === 'function' ? api.request('/events', { method: 'GET', signal: signal }, params) : api.get('/events', params);
			var events = request.then(function (payload) {
				var normalized = payload && Array.isArray(payload.events) ? payload.events.map(function (event) { return normalizeEvent(event, capabilities); }) : [];
				sharedPrimaryCache[key] = { events: normalized.slice(), savedAt: Date.now() };
				state.telemetry.primaryLoadMs = Date.now() - startedAt;
				if (global.console && typeof global.console.info === 'function') global.console.info('[Matrix Calendar] primary cache=' + (cached ? 'revalidated' : 'miss') + ' duration_ms=' + state.telemetry.primaryLoadMs + ' range=' + key);
				if (generation === rangeGeneration) set({ events: normalized, wpStatus: normalized.length ? 'ready' : 'empty', cacheStatus: cached ? 'revalidated' : 'stored', error: '' });
				return normalized;
			}).catch(function (error) {
				if (error && error.name === 'AbortError') return [];
				if (generation === rangeGeneration) set({ wpStatus: 'error', error: 'Live Matrix events could not be loaded.' });
				throw error;
			});
			return events;
		}

		var schedulerAuth = null;
		function sessionJson(url, options) {
			return global.fetch(url, options).then(function (response) {
				return response.json().catch(function () { return {}; }).then(function (payload) {
					if (!response.ok) throw new Error('Scheduler returned ' + response.status);
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
		function loadScheduler(generation, signal) {
			set({ schedulerStatus: 'loading' });
			var request = schedulerSession().then(function (auth) {
				var params = range();
				var endpoint = capabilities.admin ? '/api/scheduler/admin/calendar-feed' : '/api/scheduler/calendar-feed';
				var url = new URL(endpoint, global.location.origin);
				Object.keys(params).forEach(function (key) { if (key !== 'no_sync') url.searchParams.set(key, params[key]); });
				var headers = { Accept: 'application/json', Authorization: 'Bearer ' + auth.accessToken };
				if (auth.csrfToken) headers['x-mmhq-csrf'] = auth.csrfToken;
				return sessionJson(url.toString(), { credentials: 'same-origin', cache: 'no-store', headers: headers, signal: signal });
			}).then(function (payload) {
				var data = payload && (payload.data || payload);
				var events = data && Array.isArray(data.events) ? data.events.map(function (event) { return normalizeEvent(event, capabilities); }) : [];
				if (generation === rangeGeneration) set({ events: mergeEvents(state.events, events), schedulerStatus: events.length ? 'ready' : 'empty' });
				return events;
			});
			return timeout(request, 2500, 'Scheduler enrichment timed out').catch(function () {
				if (destroyed || (signal && signal.aborted)) return [];
				if (generation === rangeGeneration) {
					set({ schedulerStatus: 'degraded' });
					global.setTimeout(function () { loadScheduler(generation, signal).catch(function () {}); }, 10000);
				}
				return [];
			});
		}

		function beginGeneration() {
			if (rangeAbortController) {
				rangeAbortController.abort();
				state.telemetry.cancelledRanges += 1;
			}
			rangeAbortController = global.AbortController ? new global.AbortController() : null;
			rangeGeneration += 1;
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
			if (!capabilities.admin || !api || typeof api.post !== 'function') return Promise.reject(new Error('Calendar editing is unavailable.'));
			set({ busy: true, error: '' });
			var authorizedCandidate = Object.assign({}, candidate, { audience: candidate.audience || 'all_students' });
			return api.post('/events', eventPayload(authorizedCandidate)).then(function (saved) {
				var event = normalizeEvent(saved && (saved.event || saved), capabilities);
				set({ events: mergeEvents(state.events, [event]), busy: false });
				return event;
			}).catch(function (error) { set({ busy: false, error: 'The event was not saved. Nothing changed.' }); throw error; });
		}

		function updateEvent(event) {
			if (!event || !event.writable || !api || typeof api.put !== 'function') return Promise.reject(new Error('This event is read-only.'));
			set({ busy: true, error: '' });
			return api.put('/events/' + encodeURIComponent(event.id), eventPayload(event)).then(function (saved) {
				var normalized = normalizeEvent(saved && (saved.event || saved), capabilities);
				set({ events: state.events.map(function (item) { return String(item.id) === String(normalized.id) ? normalized : item; }), busy: false });
				return normalized;
			}).catch(function (error) { set({ busy: false, error: 'The event was not updated. Nothing changed.' }); throw error; });
		}

		function deleteEvent(event) {
			if (!event || !event.writable) return Promise.reject(new Error('This event is read-only.'));
			set({ busy: true, error: '' });
			return apiDelete(api, '/events/' + encodeURIComponent(event.id)).then(function () {
				set({ events: state.events.filter(function (item) { return String(item.id) !== String(event.id); }), busy: false });
			}).catch(function (error) { set({ busy: false, error: 'The event was not deleted. Nothing changed.' }); throw error; });
		}

		function createTodo(candidate) {
			if (!capabilities.admin || !api || typeof api.post !== 'function') return Promise.reject(new Error('Task editing is unavailable.'));
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
			if (!event || !event.sourceId) return Promise.reject(new Error('Recording is unavailable.'));
			return sessionJson('/api/scheduler/appointments/' + encodeURIComponent(event.sourceId) + '/recording', { method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (payload) {
				var data = payload && (payload.data || payload);
				var url = safeUrl(data && (data.recording_url || data.playback_url || (data.recording && data.recording.playback_url)));
				if (!url) return { ready: false, event: event };
				var updated = Object.assign({}, event, { replayUrl: url, recordingStatus: 'ready' });
				set({ events: state.events.map(function (item) { return String(item.id) === String(event.id) ? updated : item; }) });
				return { ready: true, event: updated };
			});
		}

		function destroy() {
			destroyed = true;
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
