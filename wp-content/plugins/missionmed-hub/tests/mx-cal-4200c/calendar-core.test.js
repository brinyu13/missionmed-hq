'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const pluginRoot = path.resolve(__dirname, '../..');
const coreSource = fs.readFileSync(path.join(pluginRoot, 'assets/calendar-core/mmed-calendar-core.js'), 'utf8');
const v2Source = fs.readFileSync(path.join(pluginRoot, 'assets/calendar-v2/mmed-calendar-v2.js'), 'utf8');

test('StoryForge renderer defers route mounting to Matrix Runtime v2', () => {
	assert.match(
		v2Source,
		/route === 'calendar' && !\(app\.runtime && app\.runtime\.enabled\)/,
		'Runtime-managed Calendar must not self-mount and duplicate or abort the primary request set'
	);
});

function loadCore(overrides) {
	const context = Object.assign({
		console,
		Date,
		Intl,
		URL,
		Promise,
		JSON,
		Object,
		String,
		Number,
		Array,
		RegExp,
		Error,
		AbortController,
		setTimeout,
		clearTimeout,
		location: { origin: 'https://missionmedinstitute.com' },
		mmedStudentOsFeatureFlags: { calendar_experience: { experience: 'storyforge', timezone_label: 'Eastern Time (ET)' } },
		fetch: () => Promise.reject(new Error('offline'))
	}, overrides || {});
	context.window = context;
	vm.runInNewContext(coreSource, context, { filename: 'mmed-calendar-core.js' });
	return context.MMEDCalendarCore;
}

test('normalizes join and replay as separate safe actions', () => {
	const core = loadCore();
	const event = core.normalizeEvent({
		id: 7,
		title: 'Workshop replay',
		start_at: '2026-09-01T15:00:00-04:00',
		end_at: '2026-09-01T16:00:00-04:00',
		meeting_url: 'https://example.com/join/7',
		recording_url: 'https://example.com/replay/7'
	}, { admin: false });
	assert.match(event.joinUrl, /\/join\/7$/);
	assert.match(event.replayUrl, /\/replay\/7$/);
	assert.notEqual(event.joinUrl, event.replayUrl);
	assert.equal(core.safeUrl('javascript:alert(1)'), '');
});

test('preserves server audience and persisted importance metadata', () => {
	const core = loadCore();
	const event = core.normalizeEvent({ id: 77, title: 'Private clinical', start_at: '2026-09-01T10:00:00', end_at: '2026-09-01T11:00:00', audience: '', meta: { audience: '', important: true } }, { admin: true });
	assert.equal(event.audience, '');
	assert.equal(event.important, true);
});

test('preserves both production Drills inventories and event types', () => {
	const core = loadCore();
	assert.equal(core.drillTopics['Step/Level 1'].length, 19);
	assert.equal(core.drillTopics['Step/Level 2/3'].length, 19);
	assert.ok(core.drillTopics['Step/Level 1'].includes('Micro / Infectious Disease'));
	assert.ok(core.drillTopics['Step/Level 2/3'].includes('Surgery'));
	assert.equal(core.buildDrillEvent('2026-09-03', 'Cardiology', 'Step/Level 1').eventType, 'drill_step1');
	assert.equal(core.buildDrillEvent('2026-09-03', 'Cardiology', 'Step/Level 1').category, 'drill_step1');
	assert.equal(core.buildDrillEvent('2026-09-03', 'Cardiology', 'Step/Level 2/3').eventType, 'drill_step23');
	assert.equal(core.buildDrillEvent('2026-09-03', 'Cardiology', 'Step/Level 2/3').category, 'drill_step23');
});

test('write payloads strip unsafe meeting URLs', () => {
	const core = loadCore();
	assert.equal(core.eventPayload({ title: 'Safe', start: '2026-09-01T10:00:00', end: '2026-09-01T11:00:00', joinUrl: 'javascript:alert(1)' }).meeting_url, '');
	assert.equal(core.todoPayload({ title: 'Safe', meetingUrl: 'data:text/html,bad' }).meeting_url, '');
});

test('scheduler entries merge without duplicating WordPress events', () => {
	const core = loadCore();
	const primary = core.normalizeEvent({ id: 1, title: 'Advising', source: 'scheduler', source_id: 'a-1', start_at: '2026-09-01T15:00:00-04:00' }, {});
	const enriched = core.normalizeEvent({ id: 99, title: 'Advising', source: 'scheduler', source_id: 'a-1', start_at: '2026-09-01T15:00:00-04:00', meeting_url: 'https://example.com/join' }, {});
	const merged = core.mergeEvents([primary], [enriched]);
	assert.equal(merged.length, 1);
	assert.equal(merged[0].id, 1, 'Scheduler enrichment must preserve the canonical WordPress event id');
	assert.match(merged[0].joinUrl, /\/join$/);
});

test('parent category visibility hides descendant events', () => {
	const core = loadCore();
	const state = {
		visibility: { exam_prep: false, drill_step1: true },
		categories: [{ id: 'exam_prep', parentId: '' }, { id: 'drill_step1', parentId: 'exam_prep' }],
		events: [core.normalizeEvent({ id: 1, title: 'Cardiology', event_type: 'drill_step1', category: 'drill_step1', start_at: '2026-09-03T10:00:00-04:00' }, {})]
	};
	assert.equal(core.visibleEvents(state).length, 0);
});

test('event create is server-success-first', async () => {
	let resolvePost;
	const posted = new Promise((resolve) => { resolvePost = resolve; });
	const app = {
		profile: { is_admin: true },
		api: {
			post: () => posted,
			get: () => Promise.resolve({ events: [], todos: [] }),
			put: () => Promise.resolve({})
		}
	};
	const core = loadCore();
	const calendar = core.create(app);
	const candidate = core.buildDrillEvent('2026-09-03', 'Cardiology', 'Step/Level 1');
	const mutation = calendar.createEvent(candidate);
	assert.equal(calendar.state.events.length, 0, 'candidate must not render before server success');
	resolvePost({ id: 51, ...core.eventPayload(candidate) });
	await mutation;
	assert.equal(calendar.state.events.length, 1);
	assert.equal(calendar.state.events[0].id, 51);
});

test('todo create update and delete mirror confirmed server state', async () => {
	const app = {
		profile: { is_admin: false },
		api: {
			post: (endpoint, payload) => Promise.resolve({ todo: { id: 61, ...payload } }),
			put: (endpoint, payload) => Promise.resolve({ todo: { id: 61, ...payload } }),
			delete: () => Promise.resolve({ success: true })
		}
	};
	const calendar = loadCore().create(app);
	const created = await calendar.createTodo({ title: 'QA task', priority: 'high', meetingUrl: 'https://example.com/qa' });
	assert.equal(created.id, 61);
	assert.equal(calendar.state.todos.length, 1);
	assert.equal(calendar.state.todos[0].meetingUrl, 'https://example.com/qa');
	const updated = await calendar.updateTodo({ ...created, title: 'QA task updated', completed: true });
	assert.equal(updated.title, 'QA task updated');
	assert.equal(calendar.state.todos[0].completed, true);
	await calendar.deleteTodo(updated);
	assert.equal(calendar.state.todos.length, 0);
});

test('view ranges are bounded and warm revisits use the shared cache', async () => {
	const eventCalls = [];
	const app = {
		profile: { is_admin: false },
		api: {
			get: (endpoint, params) => {
				if (endpoint === '/events') eventCalls.push({ start: params.start, end: params.end });
				return Promise.resolve(endpoint === '/events' ? { events: [] } : { todos: [] });
			}
		}
	};
	const core = loadCore({
		fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ authenticated: true, accessToken: 'test-only', data: { events: [] } }) })
	});
	const calendar = core.create(app);
	await calendar.start();
	assert.equal(eventCalls.length, 1);
	const initial = eventCalls[0];
	assert.ok((new Date(initial.end) - new Date(initial.start)) < 65 * 86400000, 'month fetch must stay within a bounded view window');
	await calendar.navigate(1);
	assert.equal(eventCalls.length, 2);
	await calendar.navigate(-1);
	assert.equal(eventCalls.length, 2, 'warm revisit must not fetch the primary feed again');
	assert.ok(calendar.state.telemetry.cacheHits >= 1);
	await calendar.setView('day');
	const dayRange = eventCalls[eventCalls.length - 1];
	assert.ok((new Date(dayRange.end) - new Date(dayRange.start)) < 17 * 86400000, 'day fetch must stay within a bounded prefetch window');
});

test('primary Matrix requests receive AbortSignal and navigation physically aborts stale work', async () => {
	const calls = [];
	const app = {
		profile: { is_admin: false },
		api: {
			base: '/wp-json/mmed/v1',
			request: (endpoint, options, params) => {
				if (endpoint === '/todos') return Promise.resolve({ todos: [] });
				if (endpoint === '/calendar/categories') return Promise.resolve({ categories: [] });
				return new Promise((resolve, reject) => {
					const call = { options, params, resolve, reject };
					calls.push(call);
					options.signal.addEventListener('abort', () => {
						const error = new Error('aborted');
						error.name = 'AbortError';
						reject(error);
					}, { once: true });
				});
			}
		}
	};
	const core = loadCore({ fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ authenticated: true, accessToken: 'test-only', data: { events: [] } }) }) });
	const calendar = core.create(app);
	const first = calendar.start();
	assert.equal(calls.length, 1);
	const second = calendar.navigate(1);
	assert.equal(calls[0].options.signal.aborted, true);
	assert.equal(calls.length, 2);
	calls[1].resolve({ events: [] });
	await Promise.all([first, second]);
});

test('same-range revisit starts a current-generation request after stale abort', async () => {
	const calls = [];
	const app = {
		profile: { is_admin: false },
		api: {
			base: '/wp-json/mmed/v1',
			request: (endpoint, options, params) => {
				if (endpoint === '/todos') return Promise.resolve({ todos: [] });
				if (endpoint === '/calendar/categories') return Promise.resolve({ categories: [] });
				return new Promise((resolve, reject) => {
					calls.push({ options, params, resolve });
					options.signal.addEventListener('abort', () => {
						const error = new Error('aborted'); error.name = 'AbortError'; reject(error);
					}, { once: true });
				});
			}
		}
	};
	const core = loadCore({ fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ authenticated: true, accessToken: 'test-only', data: { events: [] } }) }) });
	const calendar = core.create(app);
	const first = calendar.start();
	const second = calendar.navigate(1);
	const third = calendar.navigate(-1);
	assert.equal(calls.length, 3, 'revisited range must not reuse the aborted generation-one promise');
	assert.equal(calls[0].params.start, calls[2].params.start);
	calls[2].resolve({ events: [] });
	await Promise.all([first, second, third]);
});

test('module-lived SWR cache survives route unmount/remount within 400 ms', async () => {
	let eventRequests = 0;
	let todoRequests = 0;
	const app = {
		profile: { is_admin: false },
		api: {
			base: '/wp-json/mmed/v1',
			request: (endpoint) => {
				if (endpoint === '/events') eventRequests += 1;
				if (endpoint === '/todos') todoRequests += 1;
				return Promise.resolve(endpoint === '/events' ? { events: [] } : { todos: [{ id: 71, title: 'Warm remount task' }] });
			}
		}
	};
	const core = loadCore({ fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ authenticated: true, accessToken: 'test-only', data: { events: [] } }) }) });
	const first = core.create(app);
	await first.start();
	first.destroy();
	const started = performance.now();
	const remounted = core.create(app);
	await remounted.start();
	const elapsed = performance.now() - started;
	assert.equal(eventRequests, 1, 'warm remount must use the shared SWR cache');
	assert.ok(elapsed <= 400, `warm remount exceeded 400 ms: ${elapsed}`);
	assert.equal(remounted.state.cacheStatus, 'hit');
	assert.equal(todoRequests, 2, 'each core instance must load todos independently of the shared event cache');
	assert.equal(remounted.state.todosStatus, 'ready', 'warm remount must not leave todos loading');
	assert.equal(remounted.state.todos.length, 1, 'warm remount must hydrate current todo data');
	assert.equal(remounted.state.todos[0].title, 'Warm remount task');
});

test('Scheduler failure is non-blocking when primary Matrix events succeed', async () => {
	const app = { profile: { is_admin: false }, api: { base: '/wp-json/mmed/v1', request: (endpoint) => Promise.resolve(endpoint === '/events' ? { events: [{ id: 81, title: 'Matrix event', start_at: '2026-09-03T15:00:00-04:00' }] } : endpoint === '/todos' ? { todos: [] } : { categories: [] }) } };
	const core = loadCore({ fetch: () => Promise.reject(new Error('Scheduler offline')) });
	const calendar = core.create(app);
	await calendar.start();
	await new Promise((resolve) => setTimeout(resolve, 0));
	assert.equal(calendar.state.wpStatus, 'ready');
	assert.equal(calendar.state.events[0].id, 81);
	assert.equal(calendar.state.schedulerStatus, 'degraded');
	calendar.destroy();
});

test('primary Matrix events are prioritized ahead of supporting WordPress reads', async () => {
	const calls = [];
	let resolveEvents;
	const app = {
		profile: { is_admin: false },
		api: {
			base: '/wp-json/mmed/v1',
			request: (endpoint) => {
				calls.push(endpoint);
				if (endpoint === '/events') return new Promise((resolve) => { resolveEvents = resolve; });
				return Promise.resolve(endpoint === '/todos' ? { todos: [] } : { categories: [] });
			}
		}
	};
	const core = loadCore({ fetch: () => Promise.reject(new Error('Scheduler offline')) });
	const calendar = core.create(app);
	const started = calendar.start();
	assert.deepEqual(calls, ['/events'], 'noncritical WordPress reads must not contend with the primary event request');
	resolveEvents({ events: [{ id: 91, title: 'Primary first', start_at: '2026-09-03T15:00:00-04:00' }] });
	await started;
	await new Promise((resolve) => setTimeout(resolve, 0));
	assert.deepEqual(calls, ['/events', '/todos', '/calendar/categories']);
	assert.equal(calendar.state.events[0].id, 91);
	calendar.destroy();
});

test('a hung primary Matrix request fails closed without a renderer-owned timer', async () => {
	const app = { profile: { is_admin: false }, api: { base: '/wp-json/mmed/v1', request: (endpoint) => endpoint === '/events' ? new Promise(() => {}) : Promise.resolve(endpoint === '/todos' ? { todos: [] } : { categories: [] }) } };
	const core = loadCore({ mmedStudentOsFeatureFlags: { calendar_experience: { experience: 'storyforge', primary_timeout_ms: 50, scheduler_timeout_ms: 50 } }, fetch: () => Promise.reject(new Error('Scheduler offline')) });
	const calendar = core.create(app);
	await assert.rejects(calendar.start(), /Primary Matrix Calendar request timed out/);
	assert.equal(calendar.state.wpStatus, 'error');
	assert.equal(calendar.state.schedulerStatus, 'degraded');
	calendar.destroy();
});

test('join adapter honors Session Manager meeting_url and can_join', async () => {
	const app = { profile: { is_admin: false }, api: { get: () => Promise.resolve({ can_join: true, meeting_url: 'https://example.com/meeting/9' }) } };
	const calendar = loadCore().create(app);
	const result = await calendar.getJoinInfo({ id: 9 });
	assert.equal(result.available, true);
	assert.match(result.joinUrl, /\/meeting\/9$/);
});

test('join adapter preserves V1 direct-link behavior for normalized Calendar events', async () => {
	let apiCalls = 0;
	const app = { profile: { is_admin: true }, api: { get: () => { apiCalls += 1; return Promise.reject(new Error('should not call')); } } };
	const calendar = loadCore().create(app);
	const result = await calendar.getJoinInfo({ id: 10, joinUrl: 'https://example.com/meeting/10' });
	assert.equal(result.available, true);
	assert.match(result.joinUrl, /\/meeting\/10$/);
	assert.equal(apiCalls, 0, 'a server-provided normalized URL must not be rejected by an event-ownership recheck');
});

test('ET display contract is explicit and DST-aware', () => {
	const core = loadCore();
	assert.equal(core.zone, 'America/New_York');
	assert.equal(core.format('2026-07-01T19:00:00Z', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }), '3:00 PM EDT');
	assert.equal(core.format('2026-12-01T20:00:00Z', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }), '3:00 PM EST');
	assert.equal(core.dateKey(core.parseDate('2026-09-02')), '2026-09-02');
	assert.equal(core.localDateTime(core.parseDate('2026-09-02T10:00:00')), '2026-09-02T10:00:00');
	assert.equal(core.localDateTime(core.buildDrillEvent('2026-12-03', 'Cardiology', 'Step/Level 1').start), '2026-12-03T10:00:00');
});
