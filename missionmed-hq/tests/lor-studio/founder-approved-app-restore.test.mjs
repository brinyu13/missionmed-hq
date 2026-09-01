import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM, VirtualConsole } from 'jsdom';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.resolve(here, '..', '..', 'public', 'lor-studio');
const html = await readFile(path.join(publicRoot, 'index.html'), 'utf8');
const adapter = await readFile(path.join(publicRoot, 'production-adapter.js'), 'utf8');
const adapterCss = await readFile(path.join(publicRoot, 'production-adapter.css'), 'utf8');
const approvedArtifact = await readFile('/Users/brianb/Dropbox (Personal)/SCREENSHOTS/F2-LOR-1012_LOR_STUDIO_STANDALONE_REVIEW_2026-08-24.html');
const artifactSha = createHash('sha256').update(approvedArtifact).digest('hex');

const consent = [{
  id: 'consent-1',
  policyVersion: 'dr-133-identified-education-record-v1',
  scopes: ['builder_autosave', 'faculty_handoff', 'ai_drafting', 'evidence_grounding'],
  recordedAt: '2026-09-01T12:00:00.000Z',
}];
const waiver = [{ id: 'waiver-1', waived: false, recordedAt: '2026-09-01T12:01:00.000Z' }];
const steps = {
  case_basics: { studentName: 'Founder canary student', degree: 'MD', specialty: 'im', summary: 'Evidence-first recommendation preparation.', intentPath: 'asked', programName: 'Internal Medicine planning' },
  writer_relationship: { writerName: 'Dr. Faculty Canary', writerCredentials: 'MD', writerRole: 'Attending Physician', institution: 'MissionMed Teaching Service', specialty: 'Internal Medicine', relationshipSummary: 'Direct clinical supervision.', observationDays: 16, observationWeeks: 4 },
  evidence_selection: { selectedEvidenceIds: ['evidence-1'] },
  timeline_highlights: { rotationName: 'Inpatient Internal Medicine', setting: 'Teaching hospital', role: 'Acting intern', startDate: '2026-07-01', endDate: '2026-07-31' },
  writer_preferences: { writerWelcome: 'Dear Dr. Canary, thank you for supporting this recommendation.', shareTimeline: true, shareHighlights: true, shareApplicantDraft: true },
  consent_and_waiver: { consentRecorded: true, waiverDecision: 'kept_access' },
  review: { approvedAppState: { situation: 'asked', builderStep: 8, builderCompleted: true, studentName: 'Founder canary student', studentFirst: 'Founder', currentView: 'build', favoriteSamples: [], sampleTags: {}, recentSamples: [] } },
  faculty_handoff: { deadline: '2026-09-15', recipientEmail: 'faculty@example.test' },
};
const studentProjection = Object.freeze({
  schemaVersion: 'missionmed.lor.student-projection.v1',
  caseId: 'case-024',
  revision: 12,
  status: 'draft',
  builder: { sessionId: 'builder-024', totalSteps: 8, completedStepIds: Object.keys(steps), currentStepId: null, stepData: steps },
  studentEvidence: [{ id: 'evidence-1', title: 'Clinical communication', text: 'Explained a complex care plan clearly and confirmed understanding.' }],
  applicantOptions: [],
  consentReceipts: consent,
  waiverReceipts: waiver,
  delivery: { status: 'not_started' },
  finalDocument: null,
});

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function quietConsole() {
  const console = new VirtualConsole();
  console.on('jsdomError', (error) => {
    if (!/Not implemented: navigation/u.test(String(error?.message || ''))) throw error;
  });
  return console;
}

async function boot(projection) {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: `https://hq.example.test/lor-studio/?case=${projection.caseId}`,
    virtualConsole: quietConsole(),
  });
  const requests = [];
  dom.window.fetch = async (input, init = {}) => {
    const requestPath = String(input);
    requests.push({ path: requestPath, init });
    if (requestPath === `/api/lor-studio/bootstrap?case=${projection.caseId}`) {
      return response(200, { operational: true, runtimeMode: 'live', storageMode: 'durable', providersReady: true, csrfToken: 'csrf-local' });
    }
    if (requestPath === `/api/lor-studio/cases/${projection.caseId}`) return response(200, { case: projection });
    return response(404, { error: 'not_stubbed' });
  };
  dom.window.eval(adapter);
  for (let tick = 0; tick < 24; tick += 1) await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
  return { dom, requests };
}

function facultyProjection(caseId = 'case-faculty-024') {
  return {
    schemaVersion: 'missionmed.lor.faculty-projection.v1',
    caseId,
    revision: 21,
    status: 'faculty_review',
    studentShared: { evidence: [{ id: 'evidence-1', title: 'Clinical communication', text: 'Explained a complex plan clearly.' }], applicantOptions: [], consentReceipts: consent, waiverState: { decided: true, waived: false, receiptId: 'waiver-1' } },
    facultyPrivate: { answers: [], notes: [], draftText: null, finalDocument: null },
    delivery: { status: 'not_started', destinationClass: null, deliveredAt: null },
  };
}

async function settle(dom, ticks = 12) {
  for (let tick = 0; tick < ticks; tick += 1) await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
}

test('Ticket 024 is bound to the exact August 24 Founder-approved artifact and makes it executable', () => {
  assert.equal(artifactSha, 'c249373619a45c31a1b895363fb1d3806d966c8fc413e0acdc4df0870c5a51b7');
  assert.match(html, /id="lorFounderApprovedRuntime" type="text\/javascript"/u);
  assert.match(html, /productionStrategy:'approved_app_fixture_seams_replaced_with_production_adapters'/u);
  assert.doesNotMatch(html, /production-projection-ui\.js/u);
  assert.match(adapterCss, /html\[data-lor-runtime="live"\] #lorProductionRoot \{\s*display: none !important;/u);
  assert.doesNotMatch(adapterCss, /html\[data-lor-runtime="live"\] body > :not\(#lorProductionRoot\)/u);
});

test('student production hydration opens the approved Home and every approved product area without fixture state', async (t) => {
  const { dom } = await boot(studentProjection);
  t.after(() => dom.window.close());
  const { document } = dom.window;
  assert.equal(document.documentElement.dataset.lorRuntime, 'live');
  assert.equal(dom.window.localStorage.length, 0);
  assert.equal(document.getElementById('lorProductionRoot').childElementCount, 0);
  assert.equal(document.getElementById('rolePill').hidden, true);
  assert.equal(dom.window.getComputedStyle(document.getElementById('rolePill')).display, 'none');
  assert.match(document.getElementById('main').textContent, /Did your preceptor ask you to write the letter\?/u);
  assert.deepEqual([...document.querySelectorAll('#topNav button')].map((node) => node.textContent.trim()), [
    '✦ Build My LOR', 'Examples & Templates', 'Writer Depot', 'My Letters', 'Intelligence', 'Settings',
  ]);
  document.querySelector('#rolePill [data-r="mentor"]').click();
  assert.deepEqual([...document.querySelectorAll('#topNav button')].map((node) => node.textContent.trim()), [
    '✦ Build My LOR', 'Examples & Templates', 'Writer Depot', 'My Letters', 'Intelligence', 'Settings',
  ], 'a client-side role-switch attempt cannot override the server-selected student projection');

  const expected = new Map([
    ['library', /50 synthetic samples/u],
    ['depot', /one private page per writer/u],
    ['letters', /one honest timeline/u],
    ['intel', /The engine under the Builder/u],
    ['settings', /Reference data/u],
  ]);
  for (const [view, marker] of expected) {
    document.querySelector(`#topNav [data-nav="${view}"]`).click();
    assert.match(document.getElementById('main').textContent, marker, view);
  }
  document.querySelector('#topNav [data-nav="depot"]').click();
  const depotText = document.getElementById('main').textContent;
  assert.match(depotText, /Production invitation & privacy/u);
  assert.match(depotText, /recipient-bound invitation/u);
  assert.doesNotMatch(depotText, /prototype|simulated security|demo data|coming soon/iu);
});

test('a student case without a selected writer renders a coherent Writer Depot gate', async (t) => {
  const projection = structuredClone(studentProjection);
  projection.builder.stepData.writer_relationship = {};
  projection.builder.stepData.timeline_highlights = {};
  projection.builder.stepData.faculty_handoff = {};
  const { dom } = await boot(projection);
  t.after(() => dom.window.close());
  const { document } = dom.window;

  document.querySelector('#topNav [data-nav="settings"]').click();
  assert.match(document.getElementById('main').textContent, /Reference data/u);
  document.querySelector('#topNav [data-nav="depot"]').click();

  assert.equal(document.querySelector('#topNav [data-nav="depot"]').classList.contains('on'), true);
  assert.equal(document.querySelector('#main section').dataset.view, 'depot');
  assert.match(document.getElementById('main').textContent, /Choose a faculty writer first/u);
  assert.match(document.getElementById('main').textContent, /Writer needed/u);
  assert.notEqual(document.getElementById('lorDepotChooseWriter'), null);
  assert.equal(dom.window.localStorage.length, 0);
});

test('mentor production hydration keeps the approved mentor information architecture and exact read-only boundary', async (t) => {
  const projection = {
    schemaVersion: 'missionmed.lor.mentor-projection.v1',
    caseId: 'case-mentor-024',
    status: 'faculty_review',
    strategyStatus: 'faculty_review',
    nextMilestone: 'faculty_approval',
    deliveryStatus: 'not_started',
  };
  const { dom } = await boot(projection);
  t.after(() => dom.window.close());
  const { document } = dom.window;
  assert.equal(document.documentElement.dataset.lorRuntime, 'live');
  assert.deepEqual([...document.querySelectorAll('#topNav button')].map((node) => node.textContent.trim()), ['Overview', 'Coverage', 'Deadlines', 'Settings']);
  assert.match(document.getElementById('main').textContent, /Recommendation portfolio/u);
  assert.match(document.getElementById('main').textContent, /Faculty-private answers and letter content are never included/u);
  const visibleMentorText = [document.getElementById('topNav'), document.getElementById('mentorBanner'), document.getElementById('main')]
    .map((node) => node.textContent)
    .join(' ');
  assert.doesNotMatch(visibleMentorText, /Amara|Whitfield|Okafor|private faculty draft/iu);
});

test('faculty production hydration opens the approved private workspace with real AI, save, release and export controls', async (t) => {
  const projection = facultyProjection();
  const { dom } = await boot(projection);
  t.after(() => dom.window.close());
  const { document } = dom.window;
  assert.equal(document.documentElement.dataset.lorRuntime, 'live');
  assert.match(document.getElementById('facWrap').textContent, /Secure faculty workspace/u);
  assert.match(document.getElementById('facWrap').textContent, /Identity verified · production/u);
  assert.doesNotMatch(document.getElementById('facWrap').textContent, /prototype|simulation/iu);
  document.querySelector('[data-fstep="5"]').click();
  assert.match(document.getElementById('facWrap').textContent, /Request grounded AI proposal/u);
  assert.ok(document.getElementById('facProductionDraft'));
  document.querySelector('[data-fstep="7"]').click();
  assert.match(document.getElementById('facWrap').textContent, /Approve, sign & release to student/u);
  assert.match(document.getElementById('facWrap').textContent, /Download approved DOCX/u);
});

test('student Builder resumes into only durable applicant options and never invokes fixture generation', async (t) => {
  const projection = {
    ...studentProjection,
    applicantOptions: [{ id: 'server-option-1', text: 'SERVER DURABLE APPLICANT OPTION' }],
    builder: {
      ...studentProjection.builder,
      stepData: {
        ...steps,
        review: { approvedAppState: { ...steps.review.approvedAppState, builderStep: 5, currentView: 'build' } },
      },
    },
  };
  const { dom } = await boot(projection);
  t.after(() => dom.window.close());
  const { document } = dom.window;
  const resume = document.querySelector('[data-resume="case-024"]');
  assert.ok(resume, 'the approved Builder exposes durable re-entry');
  resume.click();
  assert.match(document.getElementById('main').textContent, /SERVER DURABLE APPLICANT OPTION/u);
  assert.match(document.getElementById('main').textContent, /Durable applicant-prepared options from this case/u);
  assert.doesNotMatch(document.getElementById('main').textContent, /Prototype generation|demo logic|Regenerate all four/iu);
  assert.equal(document.querySelectorAll('.letterCard').length, 1);
});

test('student chosen wording re-enters from the durable builder review without local regeneration', async (t) => {
  const projection = {
    ...studentProjection,
    applicantOptions: [],
    builder: {
      ...studentProjection.builder,
      stepData: {
        ...steps,
        review: { approvedAppState: { ...steps.review.approvedAppState, builderStep: 6, currentView: 'build', chosenOption: 'A', applicantPreparedText: 'DURABLY SAVED CHOSEN WORDING' } },
      },
    },
  };
  const { dom } = await boot(projection);
  t.after(() => dom.window.close());
  const { document } = dom.window;
  document.querySelector('[data-resume="case-024"]').click();
  assert.match(document.getElementById('main').textContent, /DURABLY SAVED CHOSEN WORDING/u);
  assert.doesNotMatch(document.getElementById('main').textContent, /Prototype generation|demo logic|Regenerate all four/iu);
  assert.equal(document.querySelectorAll('.letterCard').length, 1);
});

test('accepted faculty AI wording records accepted provenance and cannot cross a projection hydration boundary', async (t) => {
  const projection = facultyProjection('case-ai-a');
  const { dom } = await boot(projection);
  t.after(() => dom.window.close());
  const { document } = dom.window;
  const decisions = [];
  dom.window.fetch = async (input, init = {}) => {
    const requestPath = String(input);
    if (requestPath === '/api/lor-studio/cases/case-ai-a/ai-proposals' && init.method === 'POST') {
      return response(201, { proposal: { id: 'proposal-a', text: 'PRIVATE AI PROPOSAL FOR CASE A' } });
    }
    if (requestPath === '/api/lor-studio/cases/case-ai-a/ai-proposals/proposal-a/decision' && init.method === 'POST') {
      decisions.push(JSON.parse(init.body));
      return response(201, { decision: { action: 'accepted' } });
    }
    return response(404, { error: 'not_stubbed' });
  };
  document.querySelector('[data-fstep="5"]').click();
  document.getElementById('facAi').click();
  await settle(dom);
  assert.match(document.getElementById('facWrap').textContent, /PRIVATE AI PROPOSAL FOR CASE A/u);
  const accept = [...document.querySelectorAll('#facWrap button')].find((button) => /Accept as editable faculty draft/u.test(button.textContent));
  assert.ok(accept);
  accept.click();
  await settle(dom);
  assert.deepEqual(decisions, [{ action: 'accepted' }]);
  assert.match(document.getElementById('facWrap').textContent, /PRIVATE AI PROPOSAL FOR CASE A/u);

  const ui = dom.window.LorProductionProjectionUi();
  await ui.renderProductionProjection(facultyProjection('case-ai-b'), {
    runtimeMode: 'live', actorRole: 'faculty', projectionSchema: 'missionmed.lor.faculty-projection.v1', persistToLocalStorage: false,
  });
  document.querySelector('[data-fstep="5"]').click();
  assert.doesNotMatch(document.getElementById('facWrap').textContent, /PRIVATE AI PROPOSAL FOR CASE A/u);
});

test('released kept-access student sees authoritative final document and protected export, never a self-reported upload', async (t) => {
  const projection = {
    ...studentProjection,
    status: 'delivered',
    delivery: { status: 'delivered', destinationClass: 'student_release', deliveredAt: '2026-09-01T13:05:00.000Z' },
    finalDocument: {
      id: 'document-024', text: 'RELEASED PRIVATE LETTER TEXT', contentHash: 'a'.repeat(64), mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', releasedToStudentAt: '2026-09-01T13:00:00.000Z',
    },
  };
  const { dom, requests } = await boot(projection);
  t.after(() => dom.window.close());
  const { document } = dom.window;
  document.querySelector('#topNav [data-nav="letters"]').click();
  const text = document.getElementById('main').textContent;
  assert.match(text, /RELEASED PRIVATE LETTER TEXT/u);
  assert.match(text, /Released to you/u);
  assert.doesNotMatch(text, /self-reported/u);
  assert.doesNotMatch(text, /Assign .* letter to programs/u);
  assert.doesNotMatch(text, /letter\(s\) uploaded/u);
  const download = document.getElementById('lorStudentExportFinal');
  assert.ok(download);
  download.click();
  await settle(dom);
  assert.ok(requests.some((request) => request.path === '/api/lor-studio/cases/case-024/final-document/export' && request.init.method === 'GET'));
});

test('waived student never receives final wording or export even from a malformed overbroad projection', async (t) => {
  const projection = {
    ...studentProjection,
    waiverReceipts: [{ id: 'waiver-2', waived: true, recordedAt: '2026-09-01T12:01:00.000Z' }],
    finalDocument: { id: 'forbidden-document', text: 'MUST NOT RENDER', contentHash: null, mimeType: 'text/plain', releasedToStudentAt: '2026-09-01T13:00:00.000Z' },
  };
  const { dom } = await boot(projection);
  t.after(() => dom.window.close());
  const { document } = dom.window;
  document.querySelector('#topNav [data-nav="letters"]').click();
  assert.doesNotMatch(document.getElementById('main').textContent, /MUST NOT RENDER/u);
  assert.equal(document.getElementById('lorStudentExportFinal'), null);
  assert.match(document.getElementById('main').textContent, /waived access/u);
});
