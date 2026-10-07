import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Executes the real interview-card, research-CTA, journey-nav and quick-action
// renderers from shell.js with runtime globals stubbed.
const shell = readFileSync(new URL('../../public/source/shell.js', import.meta.url), 'utf8');
const views = readFileSync(new URL('../../public/source/views.js', import.meta.url), 'utf8');
const slice = (src, start, end) => { const a = src.indexOf(start); assert.ok(a > -1, `missing ${start}`); const b = src.indexOf(end, a + 1); return src.slice(a, b > -1 ? b : undefined); };
const code = [
  slice(views, 'function chip(', '\nfunction '), slice(views, 'function fmtDateOnly(', '\nfunction '), slice(views, 'function programHero(', '\nfunction '),
  slice(shell, 'function dateBlock(', '\nfunction stateChip('), slice(shell, 'function stateChip(', '\n/* V2 research CTAs'),
  slice(shell, '/* V2 research CTAs', 'function renderInterviews('), slice(shell, '/* V2 journey navigation', 'function renderRoom('),
].join('\n');

function harness(over = {}) {
  const ctx = {
    Intl, Date, Object, Array, String, Number, RegExp, JSON, Set, Map, console,
    esc: s => String(s ?? ''), owns: () => true, roleName: () => 'student', coreOnly: () => false, deepResearch: () => true, calendarV2: () => true, coreSection: () => true,
    comingSoonBadge: () => '<i class="soonBadge">soon</i>', now: () => Date.parse('2026-10-07T12:00:00Z'), zoneParts: () => ({ day: '14' }),
    researchState: () => ({ state: 'unknown' }), loiState: () => ({ current: null }), whyMatches: () => [],
    title: i => i.programName, metaLine: () => 'Internal Medicine · Wed, Oct 14', pulseSVG: () => '<div class="lifeline"></div>', nextMove: () => ({ label: 'Confirm the program', why: 'Research starts after confirmation', section: 'identify', act: 'open-section' }),
    stateLabel: () => 'Scheduled', isInactive: () => false, P: () => ({ specialty: 'Internal Medicine', name: 'Example IM' }),
    F: { student_zone: 'America/New_York' }, capabilities: { contributions: true }, S: { demands: {}, programMedia: {}, why: {}, practice: {}, debriefs: {}, learning: {} }, actor: { id: 'me', role: 'student' },
    ...over,
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx, { filename: 'shell-slice.js' });
  return ctx;
}
const iv = (patch = {}) => ({ id: 'iv-1', owner: 'me', program: 'rise_x', programName: 'Example IM', instant: '2026-10-14T12:00:00Z', zone: 'America/New_York', format: 'virtual', track: 'Categorical', intake: { positionType: 'CATEGORICAL', specialty: 'Internal Medicine', details: { invitationReceivedDate: '2026-09-20' } }, ...patch });

test('interview card renders chips, invite date, research CTA and actions', () => {
  const ctx = harness(); ctx.S.demands['iv-1'] = { requestId: 'r', status: 'available' };
  const html = vm.runInContext('interviewCard(' + JSON.stringify(iv()) + ')', ctx);
  assert.ok(html.includes('class="sRow ivCard"') && html.includes('id="row-iv-1"'));
  assert.ok(html.includes('chip spec">Internal Medicine') && html.includes('chip pos">CATEGORICAL') && html.includes('chip fmt">virtual') && html.includes('>Categorical<'), 'chips');
  assert.ok(html.includes('Invite received Sun, Sep 20'), 'invite received');
  assert.ok(html.includes('Program intelligence ready'), 'available research state');
  assert.ok(html.includes('data-act="open-interview"') && html.includes('>Go<'), 'actions');
  assert.ok(!html.includes('undefined'), 'no leaked undefined');
});

test('research CTA follows demand status and never dispatches a paid request', () => {
  const ctx = harness();
  const run = (demand) => { ctx.S.demands['iv-1'] = demand; return vm.runInContext('researchCta(' + JSON.stringify(iv()) + ')', ctx); };
  assert.ok(run(undefined).includes('Deep research this program') && run(undefined).includes('data-section="brief"'), 'no demand → deep research CTA to brief');
  assert.ok(run({ requestId: 'r', status: 'researching' }).includes('Researching your program…'), 'researching');
  assert.ok(run({ requestId: 'r', status: 'partial' }).includes('Refresh research') && run({ requestId: 'r', status: 'partial' }).includes('data-act="research-refresh"'), 'partial → refresh (research.check)');
  assert.ok(vm.runInContext('researchCta(' + JSON.stringify(iv({ program: null })) + ')', ctx).includes('Confirm program for research'), 'unresolved → identity');
  const core = harness({ coreOnly: () => true, deepResearch: () => false });
  assert.ok(vm.runInContext('researchCta(' + JSON.stringify(iv()) + ')', core).includes('data-act="coming-soon"'), 'core-only → coming soon');
});

test('journey nav groups stages with current/done/upcoming and keeps tab semantics', () => {
  const ctx = harness(); ctx.S.why['iv-1'] = { text: 'I value the program.' };
  const secs = [['brief', 'Brief'], ['why', 'Why this program'], ['rehearse', 'Rehearse'], ['day', 'Interview day'], ['loi', 'Letter of Interest'], ['schedule', 'Schedule & details']];
  const html = vm.runInContext(`journeyNav(${JSON.stringify(iv())},${JSON.stringify(secs)},'rehearse')`, ctx);
  assert.ok(html.includes('role="tablist"') && (html.match(/role="tab"/g) || []).length === 6, 'six tabs');
  assert.ok(html.includes('>Know the program<') && html.includes('>Get ready<') && html.includes('>Logistics &amp; outreach<') || html.includes('>Logistics & outreach<'), 'groups');
  assert.ok(!html.includes('>Afterwards<'), 'empty groups omitted');
  assert.ok(html.includes('class="stage current visited"') || html.includes('class="stage current'), 'current stage');
  assert.ok(html.includes('class="stage done visited"'), 'why done (text present) and visited');
  assert.ok(html.includes('>You are here<') && html.includes('>Done<') && html.includes('>Open<'), 'readable states');
});

test('quick actions permanently surface research, LOI, why, timeline, preparation, itinerary and debrief', () => {
  const ctx = harness();
  const secs = [['brief', 'Brief'], ['why', 'Why this program'], ['rehearse', 'Rehearse'], ['loi', 'Letter of Interest'], ['schedule', 'Schedule & details']];
  const html = vm.runInContext(`roomQuickActions(${JSON.stringify(iv())},${JSON.stringify(secs)})`, ctx);
  for (const s of ['Deep research this program', 'Help research this program', 'Letter of Interest', 'Why This Program', 'Timeline', 'Preparation', 'Itinerary', 'Debrief']) assert.ok(html.includes(s), s);
  assert.ok(html.includes('data-act="itinerary-open"'), 'itinerary available when calendarV2 + own');
  assert.ok(html.includes('disabled title="Available after the interview"'), 'debrief disabled pre-interview');
  assert.ok(html.includes('Timeline<i class="soonBadge">') && html.includes('data-label="Timeline · BEING CONNECTED"'), 'timeline coming soon');
});
