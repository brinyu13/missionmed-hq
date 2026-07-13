import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const baseUrl = String(process.env.MMHQ_MMC_SMOKE_BASE_URL || '').trim();
const sessionCookie = String(process.env.MMHQ_MMC_SMOKE_COOKIE || '').trim();
const expectedProjectRef = String(process.env.MMHQ_MMC_SMOKE_EXPECTED_PROJECT_REF || 'avpdetdkpwmqqxtvomix').trim().toLowerCase();
const smokeStudentId = sanitizeLocalId(process.env.MMHQ_MMC_SMOKE_STUDENT_ID || 'mmc-smoke-student');

if (!baseUrl || !sessionCookie) {
  throw new Error([
    'MMC staging smoke requires:',
    '  MMHQ_MMC_SMOKE_BASE_URL=https://<staging-or-local-hq>',
    '  MMHQ_MMC_SMOKE_COOKIE=<authorized admin mmhq_session cookie>',
    'Optional:',
    '  MMHQ_MMC_SMOKE_EXPECTED_PROJECT_REF=avpdetdkpwmqqxtvomix',
    '  MMHQ_MMC_SMOKE_STUDENT_ID=mmc-smoke-student',
  ].join('\n'));
}

const origin = new URL(baseUrl);
assertSafeSmokeTarget(origin);

const runId = `mmc021-${randomUUID()}`;
const endpoint = new URL('/api/mmc/persistence', origin);

const initial = await requestJson(endpoint, {
  method: 'GET',
  headers: {
    Cookie: sessionCookie,
  },
});

assert.equal(initial.ok, true, 'MMC persistence GET must return ok=true.');
assert.equal(String(initial.projectRef || '').toLowerCase(), expectedProjectRef, 'MMC persistence smoke refused unexpected Supabase project ref.');
assert.equal(initial.localStorageFallback, false, 'MMC persistence route must keep localStorage fallback disabled.');
assert.ok(String(initial.csrfToken || '').trim(), 'MMC persistence GET must return a CSRF token for POST.');

const state = buildSmokeState(runId, smokeStudentId);
const saved = await requestJson(endpoint, {
  method: 'POST',
  headers: {
    Cookie: sessionCookie,
    'Content-Type': 'application/json',
    'X-MMHQ-CSRF': initial.csrfToken,
  },
  body: JSON.stringify({
    reason: 'mmc-021-staging-smoke',
    state,
  }),
});

assert.equal(saved.ok, true, 'MMC persistence POST must return ok=true.');
assert.equal(String(saved.projectRef || '').toLowerCase(), expectedProjectRef, 'MMC persistence POST returned unexpected Supabase project ref.');
assert.equal(saved.localStorageFallback, false, 'MMC persistence POST must keep localStorage fallback disabled.');
assert.ok(Number(saved.writeCount || 0) >= 8, 'MMC persistence POST should write every MMC-owned smoke domain.');

const reloaded = await requestJson(endpoint, {
  method: 'GET',
  headers: {
    Cookie: sessionCookie,
  },
});

assert.equal(reloaded.ok, true, 'MMC persistence reload GET must return ok=true.');
assertPersistedRecord(reloaded.state?.memory, `memory-${runId}`, 'mentor memory');
assertPersistedRecord(reloaded.state?.memory, `note-${runId}`, 'private note');
assertPersistedRecord(reloaded.state?.tasks, `task-${runId}`, 'task');
assertPersistedRecord(reloaded.state?.promises, `promise-${runId}`, 'promise');
assertPersistedRecord(reloaded.state?.goals, `goal-${runId}`, 'goal');
assertPersistedRecord(reloaded.state?.sessions, `session-${runId}`, 'coaching session');
assertPersistedRecord(reloaded.state?.sessionArtifacts, `artifact-${runId}`, 'session artifact');
assertPersistedRecord(reloaded.state?.openLoops, `loop-${runId}`, 'open loop');
assertPersistedRecord(reloaded.state?.intelligenceSnapshots, `snapshot-${runId}`, 'intelligence snapshot');

console.log(JSON.stringify({
  result: 'MMC persistence staging smoke passed',
  baseHost: origin.host,
  projectRef: expectedProjectRef,
  runId,
  writeCount: Number(saved.writeCount || 0),
}, null, 2));

function buildSmokeState(localRunId, studentId) {
  return {
    students: [{
      id: studentId,
      name: 'MMC Smoke Student',
      initials: 'MS',
    }],
    memory: [
      {
        id: `memory-${localRunId}`,
        studentId,
        category: 'coaching',
        title: 'MMC-021 smoke mentor memory',
        content: `MMC-021 smoke mentor memory ${localRunId}`,
        sensitive: false,
        verified: true,
        source: 'mmc-021-staging-smoke',
        createdAt: '2026-06-23',
      },
      {
        id: `note-${localRunId}`,
        studentId,
        category: 'private-note',
        title: 'MMC-021 smoke private note',
        content: `MMC-021 smoke private note ${localRunId}`,
        sensitive: true,
        verified: true,
        source: 'mmc-021-staging-smoke',
        createdAt: '2026-06-23',
      },
    ],
    tasks: [
      {
        id: `task-${localRunId}`,
        studentId,
        owner: 'mentor',
        type: 'Follow-up',
        title: `MMC-021 smoke task ${localRunId}`,
        details: 'Created by MMC-021 staging smoke.',
        dueLabel: 'Queued',
        dueAt: 'TBD',
        status: 'open',
        priority: 'medium',
        promiseId: null,
        sourceSessionId: `session-${localRunId}`,
      },
      {
        id: `task-promise-${localRunId}`,
        studentId,
        owner: 'mentor',
        type: 'Promise',
        title: `MMC-021 smoke promise task ${localRunId}`,
        details: 'Created by MMC-021 staging smoke.',
        dueLabel: 'Queued',
        dueAt: 'TBD',
        status: 'open',
        priority: 'high',
        promiseId: `promise-${localRunId}`,
        sourceSessionId: `session-${localRunId}`,
      },
    ],
    promises: [{
      id: `promise-${localRunId}`,
      taskId: `task-promise-${localRunId}`,
      studentId,
      promisor: 'mentor',
      title: `MMC-021 smoke promise ${localRunId}`,
      madeAt: '2026-06-23',
      dueLabel: 'Queued',
      status: 'open',
    }],
    goals: [{
      id: `goal-${localRunId}`,
      studentId,
      title: `MMC-021 smoke coaching goal ${localRunId}`,
      milestone: 'Validate MMC-owned persistence reload path',
      targetDate: 'TBD',
      progress: 10,
      velocity: 'Smoke validation',
      readinessInputs: ['staging smoke', 'mmc-owned persistence', 'reload validation'],
    }],
    sessions: [{
      id: `session-${localRunId}`,
      studentId,
      mentorId: 'mentor-smoke',
      status: 'complete',
      startedAt: '2026-06-23T10:00:00.000Z',
      endedAt: '2026-06-23T10:30:00.000Z',
      title: 'MMC-021 smoke coaching session',
      summary: `MMC-021 smoke session summary ${localRunId}`,
      privateNotes: `MMC-021 smoke session private note ${localRunId}`,
      capturedItemIds: [`task-${localRunId}`, `promise-${localRunId}`],
      studentVisible: false,
    }],
    sessionArtifacts: [{
      id: `artifact-${localRunId}`,
      sessionId: `session-${localRunId}`,
      studentId,
      type: 'post-session-summary',
      title: `MMC-021 smoke artifact ${localRunId}`,
      summary: `MMC-021 smoke artifact summary ${localRunId}`,
      visibility: 'mentor',
      createdAt: '2026-06-23',
    }],
    openLoops: [{
      id: `loop-${localRunId}`,
      studentId,
      title: `MMC-021 smoke open loop ${localRunId}`,
      type: 'follow-through',
      status: 'open',
      severity: 'medium',
      detail: 'Created by MMC-021 staging smoke.',
    }],
    intelligenceSnapshots: [{
      id: `snapshot-${localRunId}`,
      studentId,
      snapshotType: 'student_briefing',
      summary: {
        who: 'MMC smoke subject',
        nextBestMove: 'Confirm persisted reload state',
      },
      confidenceScore: 1,
    }],
  };
}

async function requestJson(url, options) {
  const response = await fetch(url, {
    ...options,
    redirect: 'manual',
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (error) {
    throw new Error(`Expected JSON from ${url.pathname}; received HTTP ${response.status}.`);
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url.pathname}: ${payload?.message || payload?.error || 'request failed'}`);
  }
  return payload;
}

function assertPersistedRecord(records, id, label) {
  assert.ok(Array.isArray(records), `Reloaded ${label} collection must be an array.`);
  assert.ok(records.some((record) => record.id === id), `Reloaded state is missing ${label} ${id}.`);
}

function assertSafeSmokeTarget(url) {
  const host = String(url.hostname || '').toLowerCase();
  if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
    return;
  }
  const forbiddenHostParts = [
    'missionmed-hq-production',
    'missionmed-hq-production.up.railway.app',
    'missionmedinstitute.com',
    'missionmed.com',
  ];
  assert.notEqual(url.protocol, 'http:', 'MMC smoke target must use HTTPS unless it is localhost.');
  for (const forbidden of forbiddenHostParts) {
    assert.equal(host.includes(forbidden), false, `Refusing MMC persistence smoke against production-looking host: ${host}`);
  }
}

function sanitizeLocalId(value) {
  return String(value || '').trim().replace(/[^\w:.-]/gu, '-').slice(0, 120) || 'mmc-smoke-student';
}
