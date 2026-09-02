'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const pluginRoot = path.resolve(__dirname, '../..');
const coreSource = fs.readFileSync(path.join(pluginRoot, 'assets/calendar-core/mmed-calendar-core.js'), 'utf8');

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

test('preserves both production Drills inventories and event types', () => {
	const core = loadCore();
	assert.equal(core.drillTopics['Step/Level 1'].length, 19);
	assert.equal(core.drillTopics['Step/Level 2/3'].length, 19);
	assert.ok(core.drillTopics['Step/Level 1'].includes('Micro / Infectious Disease'));
	assert.ok(core.drillTopics['Step/Level 2/3'].includes('Surgery'));
	assert.equal(core.buildDrillEvent('2026-09-03', 'Cardiology', 'Step/Level 1').eventType, 'drill_step1');
	assert.equal(core.buildDrillEvent('2026-09-03', 'Cardiology', 'Step/Level 2/3').eventType, 'drill_step23');
});

test('scheduler entries merge without duplicating WordPress events', () => {
	const core = loadCore();
	const primary = core.normalizeEvent({ id: 1, title: 'Advising', source: 'scheduler', source_id: 'a-1', start_at: '2026-09-01T15:00:00-04:00' }, {});
	const enriched = core.normalizeEvent({ id: 99, title: 'Advising', source: 'scheduler', source_id: 'a-1', start_at: '2026-09-01T15:00:00-04:00', meeting_url: 'https://example.com/join' }, {});
	const merged = core.mergeEvents([primary], [enriched]);
	assert.equal(merged.length, 1);
	assert.match(merged[0].joinUrl, /\/join$/);
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

test('ET display contract is explicit and DST-aware', () => {
	const core = loadCore();
	assert.equal(core.zone, 'America/New_York');
	assert.equal(core.format('2026-07-01T19:00:00Z', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }), '3:00 PM EDT');
	assert.equal(core.format('2026-12-01T20:00:00Z', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }), '3:00 PM EST');
	assert.equal(core.dateKey(core.parseDate('2026-09-02')), '2026-09-02');
	assert.equal(core.localDateTime(core.parseDate('2026-09-02T10:00:00')), '2026-09-02T10:00:00');
	assert.equal(core.localDateTime(core.buildDrillEvent('2026-12-03', 'Cardiology', 'Step/Level 1').start), '2026-12-03T10:00:00');
});
