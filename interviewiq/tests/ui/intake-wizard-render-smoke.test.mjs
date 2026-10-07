import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Render smoke test: executes the real views.js wizard renderers inside a VM with the
// runtime globals stubbed, so a template or helper regression throws here instead of
// in a student's browser. No DOM is needed; the wizard renders to an HTML string.
const views = readFileSync(new URL('../../public/source/views.js', import.meta.url), 'utf8');
const actions = readFileSync(new URL('../../public/source/actions.js', import.meta.url), 'utf8');
const freshSrc = actions.slice(actions.indexOf('function freshIntake('), actions.indexOf('\nfunction ', actions.indexOf('function freshIntake(') + 1));
const stepsSrc = actions.match(/const INTAKE_STEPS=\[[^\]]+\];/)[0];

function harness(overrides = {}) {
  const ctx = {
    document: { querySelector: () => null, getElementById: () => null, addEventListener() {} },
    console, Intl, Date, Math, Number, String, Object, Array, Set, Map, JSON, RegExp, Error, crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000000' },
    esc: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]),
    intakeEnabled: () => true, calendarV2: () => true, loiTargetsEnabled: () => true, deepResearch: () => true, coreOnly: () => false,
    todayKey: () => '2026-10-07', fmtInZone: (iso) => 'Tue, Oct 14 · 8:00 AM', now: () => Date.parse('2026-10-07T12:00:00Z'),
    ZONES: ['America/New_York', 'America/Chicago', 'UTC'],
    F: { student_zone: 'America/New_York', programs: [] },
    actor: { id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', role: 'student', tier: '360', eligible: true },
    capabilities: { contributions: true, deepResearch: true },
    S: { interviews: [], loiTargets: { targets: [] }, programMedia: {}, demands: {}, why: {}, debriefs: {}, learning: {}, practice: {} },
    intakeFlow: null,
    ...overrides,
  };
  vm.createContext(ctx);
  vm.runInContext(stepsSrc + '\n' + freshSrc + '\n' + views, ctx, { filename: 'views.js' });
  return ctx;
}
const program = { id: 'rise_example_im_cat', name: 'Example Hospital Internal Medicine', specialty: 'Internal Medicine', track: 'Categorical', acgmeId: '1401234567', registryReleaseId: 'registry-v1', institution: 'Example Hospital', city: 'Rochester', state: 'MN' };
function flowAt(ctx, step, patch = {}) {
  const f = vm.runInContext('freshIntake(null)', ctx);
  Object.assign(f, { step, matches: [program, { ...program, id: 'rise_example_im_prelim', track: 'Preliminary' }], searchTotal: 2, searchText: 'Example' }, patch);
  f.identity.invitationLabel = 'Example Hospital IM';
  ctx.intakeFlow = f;
  return f;
}
const render = ctx => vm.runInContext('renderIntakeWizard()', ctx);

test('every wizard step renders without throwing and carries the V2 chrome', () => {
  const ctx = harness();
  for (let step = 1; step <= 7; step++) {
    flowAt(ctx, step, step === 3 ? { events: [{ clientKey: 'k', kind: 'DINNER', schedule: { date: '2026-10-13', time: null, zone: 'UTC', fold: null, duration: null, format: 'unknown', joining: '' }, required: 'UNKNOWN', location: null, note: '' }] } : step === 4 ? { experiences: [{ kind: 'RESEARCH', department: null, startDate: null, endDate: null, description: '', contact: null, confirmed: false }], details: { relationshipState: 'YES' } } : {});
    const html = render(ctx);
    assert.ok(html.includes('class="intakeWizard"'), `step ${step} renders wizard`);
    assert.ok(html.includes(`STEP ${step} OF 7`), `step ${step} header`);
    assert.ok(html.includes('class="intakeProgress"') && html.includes('aria-current="step"'), `step ${step} progress tracker`);
    assert.ok(html.includes('class="wizNeed'), `step ${step} need/help pill`);
    assert.ok(!html.includes('undefined'), `step ${step} has no leaked undefined`);
    assert.ok(!html.includes('[object Object]'), `step ${step} has no leaked objects`);
  }
});

test('step 1 renders program cards, specialty filter, chosen program and confirmation', () => {
  const ctx = harness();
  const f = flowAt(ctx, 1);
  let html = render(ctx);
  assert.ok(html.includes('class="programCard'), 'program cards rendered');
  assert.ok(html.includes('Example Hospital · Rochester, MN'), 'institution and location shown when present');
  assert.ok(html.includes('ACGME ID</small>1401234567'), 'ACGME ID shown');
  assert.ok(html.includes('Several results share this name'), 'ambiguity flagged for duplicate names');
  assert.ok(!html.includes('class="specChip'), 'single specialty: no filter chips');
  f.program = program; f.identity.programId = program.id;
  html = render(ctx);
  assert.ok(html.includes('class="programCard on"'), 'selected card state');
  assert.ok(html.includes('✓ Chosen'), 'chosen label');
  assert.ok(html.includes('Yes — this is the exact program and track that invited me.'), 'explicit confirmation');
  assert.ok(html.includes('class="heroMedia heroFallback compact"'), 'honest hero fallback when no approved media');
});

test('step 1 uses an approved institution exterior as hero only for the matching program', () => {
  const ctx = harness({ S: { interviews: [], loiTargets: { targets: [] }, demands: {}, why: {}, debriefs: {}, learning: {}, practice: {},
    programMedia: { [program.id]: [{ programId: program.id, url: 'https://cdn.example-hospital.org/entrance.jpg', alt: 'Entrance', caption: 'Main entrance', publisher: 'Example Hospital', category: 'INSTITUTION_EXTERIOR', approvalState: 'APPROVED' }],
      rise_other: [{ programId: 'rise_other', url: 'https://cdn.other.org/x.jpg', category: 'INSTITUTION_EXTERIOR', approvalState: 'APPROVED' }] } } });
  const f = flowAt(ctx, 1); f.program = program; f.identity.programId = program.id;
  const html = render(ctx);
  assert.ok(html.includes('<img src="https://cdn.example-hospital.org/entrance.jpg"'), 'approved hero used');
  assert.ok(html.includes('loading="lazy"'), 'lazy loaded');
  assert.ok(!html.includes('cdn.other.org'), 'unrelated hospital never shown');
  // Pending or non-exterior media must not be shown.
  ctx.S.programMedia[program.id] = [{ ...ctx.S.programMedia[program.id][0], approvalState: 'CANDIDATE' }];
  assert.ok(!render(ctx).includes('<img src="https://cdn.example-hospital.org'), 'candidate media hidden');
});

test('step 2 renders the calendar picker with today, choice cards for position/format, and the Advanced PGY-1 panel', () => {
  const ctx = harness();
  const f = flowAt(ctx, 2); f.schedule.date = '2026-10-14'; f.positionType = 'ADVANCED'; f.details.pgy1Applied = 'YES';
  const html = render(ctx);
  assert.ok(html.includes('class="calPickDay on"') && html.includes('data-date="2026-10-14"'), 'selected day');
  assert.ok(html.includes('class="calPickDay today"') && html.includes('data-date="2026-10-07"'), 'today marked');
  assert.ok(html.includes('October 2026'), 'month label');
  assert.ok(html.includes('data-month="2026-09"') && html.includes('data-month="2026-11"'), 'prev/next month');
  assert.ok(html.includes('Selected · Wed, Oct 14 2026'), 'selected value readable');
  assert.ok(html.includes('data-field="positionType" data-value="ADVANCED" aria-pressed="true"'), 'position type card pressed');
  assert.ok(html.includes('Plan your qualifying PGY-1 year') && html.includes('BUILD A PRELIM/TY LETTER OF INTEREST'), 'Advanced bridge retained');
  assert.ok(html.includes('data-field="schedule.format"'), 'format choice cards');
});

test('step 6 renders the invite-received picker and step 7 the review cards + readiness', () => {
  const ctx = harness();
  flowAt(ctx, 6);
  let html = render(ctx);
  assert.ok(html.includes('When did the invite hit your inbox?'), 'friendly invite question');
  assert.ok(html.includes("Don't remember") || html.includes('Don&#39;t remember'), 'unknown affordance');
  const f = flowAt(ctx, 7, { program, details: { relationshipState: 'YES', signalState: 'YES', invitationReceivedDate: '2026-09-20' } });
  f.identity.programId = program.id; f.identity.confirmed = true; f.schedule.date = '2026-10-14'; f.schedule.time = '08:00'; f.schedule.format = 'virtual';
  html = render(ctx);
  assert.ok(html.includes('class="reviewCards"'), 'review cards');
  assert.ok(html.includes('Canonical RISE program confirmed'), 'identity state');
  assert.ok(html.includes('You have been here before'), 'connection summary');
  assert.ok(/(\d) of 9 prep details/.test(html), 'readiness meter');
  assert.ok(html.includes('invite received Sun, Sep 20'), 'invite date in review');
  assert.ok(html.includes('>Save interview<'), 'save CTA');
});

test('step 8 celebrates, states truthful visibility and offers readiness-aware next actions', () => {
  const ctx = harness();
  const saved = { id: 'iv-1', owner: ctx.actor.id, program: program.id, programName: program.name, instant: '2026-10-14T12:00:00Z', zone: 'America/New_York', related: [] };
  ctx.S.interviews.push(saved); ctx.S.demands['iv-1'] = { requestId: 'r1', status: 'queued' };
  const f = flowAt(ctx, 8, { program, saveResult: { id: 'iv-1', edited: false } }); f.identity.programId = program.id;
  const html = render(ctx);
  assert.ok(html.includes('class="confetti"'), 'confetti present');
  assert.ok(html.includes('<em>Congratulations!</em> You earned this interview.'), 'congratulations');
  assert.ok(html.includes('Your interview is now visible to Dr Brian and your authorized MissionMed team.'), 'truthful visibility');
  assert.ok(!/notified/i.test(html), 'no notification claim');
  assert.ok(html.includes('Deep research my program') && html.includes('data-section="brief"'), 'research card active with resolved program + capability');
  assert.ok(html.includes('Help research this program') && html.includes('data-route="contribute"'), 'help research routes to contribute');
  assert.ok(html.includes('Build my timeline') && html.includes('data-act="coming-soon"'), 'timeline marked coming soon');
  assert.ok(html.includes('Not now'), 'not now');
  assert.ok(html.includes('What do you want to do next?'), 'next prompt');
  // Edited save: calm confirmation, no confetti.
  f.saveResult = { id: 'iv-1', edited: true };
  const edited = render(ctx);
  assert.ok(!edited.includes('class="confetti"') && edited.includes('Your details are saved.'), 'edits do not re-celebrate');
});

test('core-only mode keeps the wizard truthful: private save, coming-soon research', () => {
  const ctx = harness({ coreOnly: () => true, deepResearch: () => false, capabilities: { coreOnly: true } });
  ctx.S.interviews.push({ id: 'iv-2', owner: ctx.actor.id, program: null, programName: 'Example', date: '2026-10-14', related: [] });
  flowAt(ctx, 8, { saveResult: { id: 'iv-2', edited: false } });
  const html = render(ctx);
  assert.ok(html.includes('Saved privately to your MissionMed workspace.'), 'no team-visibility claim in core mode');
  assert.ok(html.includes('Confirm my program for research'), 'unresolved program routes to identity');
  assert.ok(html.includes('Help research this program · BEING CONNECTED'), 'crowdsourced research coming soon without capability');
});

test('LOI composition shows the derived prelim/TY position context from confirmed own facts only', () => {
  const ctx = harness();
  const me = ctx.actor.id;
  ctx.S.interviews.push(
    { id: 'ty', owner: me, program: 'rise_ty', programName: 'Example TY', intake: { positionType: 'TRANSITIONAL_YEAR', details: { applicationState: 'APPLIED' } } },
    { id: 'adv', owner: me, program: 'rise_adv', programName: 'Example Advanced Dermatology', intake: { positionType: 'ADVANCED', details: { advancedFactConfirmed: true, pgy1Applied: 'YES', prelimTargetId: 't-1' } } },
  );
  const interviewSubject = vm.runInContext(`loiPositionNotice(${JSON.stringify(ctx.S.interviews[0])})`, ctx);
  assert.ok(interviewSubject.includes('Transitional Year (PGY-1) letter'), 'TY letter notice');
  assert.ok(interviewSubject.includes('Example Advanced Dermatology'), 'single confirmed Advanced link is named');
  const programSubject = vm.runInContext(`loiPositionNotice(${JSON.stringify({ targetKind: 'program', targetId: 't-1', program: { id: 'rise_ty' } })})`, ctx);
  assert.ok(programSubject.includes('Transitional Year (PGY-1) letter') && programSubject.includes('Example Advanced Dermatology'), 'program target derives from applied own interview + explicit link');
  assert.equal(vm.runInContext(`loiPositionNotice(${JSON.stringify({ id: 'cat', owner: me, intake: { positionType: 'CATEGORICAL' } })})`, ctx), '', 'categorical → no notice');
  ctx.S.interviews.push({ id: 'adv2', owner: me, program: 'rise_adv2', programName: 'Another Advanced', intake: { positionType: 'ADVANCED', details: { advancedFactConfirmed: true, pgy1Applied: 'YES', prelimTargetId: 't-9' } } });
  assert.ok(vm.runInContext(`loiPositionNotice(${JSON.stringify(ctx.S.interviews[0])})`, ctx).includes('More than one Advanced interview is linked'), 'ambiguous → no name');
});
