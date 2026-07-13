import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { handleMmcCoachingPipelineRoute } from '../routes/mmc-coaching-pipeline.mjs';

const tmp = mkdtempSync(path.join(os.tmpdir(), 'mmc-webex-trigger-route-'));
const previousEnv = {
  MMHQ_MMC_WEBEX_ACCESS_TOKEN: process.env.MMHQ_MMC_WEBEX_ACCESS_TOKEN,
  MMHQ_MMC_WEBEX_API_BASE: process.env.MMHQ_MMC_WEBEX_API_BASE,
  MMHQ_MMC_WEBEX_DROP_ZONE_PATH: process.env.MMHQ_MMC_WEBEX_DROP_ZONE_PATH,
  MMHQ_MMC_WEBEX_ALLOWED_TRIGGERS: process.env.MMHQ_MMC_WEBEX_ALLOWED_TRIGGERS,
  MMHQ_MMC_WEBEX_PULL_ENABLED: process.env.MMHQ_MMC_WEBEX_PULL_ENABLED,
};

try {
  process.env.MMHQ_MMC_WEBEX_ACCESS_TOKEN = 'route-secret-token';
  process.env.MMHQ_MMC_WEBEX_API_BASE = 'https://webexapis.com/v1';
  process.env.MMHQ_MMC_WEBEX_DROP_ZONE_PATH = tmp;
  process.env.MMHQ_MMC_WEBEX_ALLOWED_TRIGGERS = '[MM-ADV]';
  process.env.MMHQ_MMC_WEBEX_PULL_ENABLED = 'true';

  const db = makeMemoryDb();
  const fetchLog = [];
  const deps = makeDeps(db, async (url, options = {}) => {
    const parsed = new URL(String(url));
    fetchLog.push({ url: String(url), method: options.method || 'GET' });
    if (parsed.pathname === '/v1/recordings') {
      return jsonResponse({
        items: [
          { id: 'adv-route-1', topic: '[MM-ADV] Route validation advising', meetingId: 'route-meeting-1', createdTime: '2026-06-29T18:00:00Z' },
          { id: 'ignored-route-1', topic: 'General non-advising recording', meetingId: 'route-meeting-2', createdTime: '2026-06-29T19:00:00Z' },
        ],
      });
    }
    if (parsed.pathname === '/v1/recordings/adv-route-1') {
      return jsonResponse({
        id: 'adv-route-1',
        topic: '[MM-ADV] Route validation advising',
        meetingId: 'route-meeting-1',
        createdTime: '2026-06-29T18:00:00Z',
        temporaryDirectDownloadLinks: {
          videoFile: 'https://downloads.example.test/adv-route-1.mp4',
          transcriptFile: 'https://downloads.example.test/adv-route-1.vtt',
        },
      });
    }
    if (parsed.hostname === 'downloads.example.test' && parsed.pathname.endsWith('.mp4')) {
      return binaryResponse(Buffer.from('route-video-bytes'));
    }
    if (parsed.hostname === 'downloads.example.test' && parsed.pathname.endsWith('.vtt')) {
      return binaryResponse(Buffer.from('WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nStudent: I need help with my next move.\n'));
    }
    throw new Error(`Unexpected fetch ${url}`);
  });

  const status = await callRoute('/webex/status', 'GET', null, deps);
  assert.equal(status.status, 'VERIFIED');
  assert.equal(status.tokenConfigured, true);
  assert.equal(status.pullEnabled, true);

  const inventory = await callRoute('/webex/recordings?limit=10&allowed_triggers=%5BMM-ADV%5D', 'GET', null, deps);
  assert.equal(inventory.status, 'VERIFIED');
  assert.equal(inventory.allowed.length, 1);
  assert.equal(inventory.ignored.length, 1);
  assert.equal(inventory.allowed[0].hasRecordingDownloadUrl, false);

  const pull = await callRoute('/webex/pull', 'POST', {
    allowedTriggers: '[MM-ADV]',
    dropZonePath: tmp,
    limit: 10,
  }, deps);
  assert.equal(pull.status, 'VERIFIED');
  assert.equal(pull.staged.length, 1);
  assert.equal(pull.ignored.length, 1);
  assert.equal(pull.workerImport.imported.length, 1);
  assert.equal(db.tables.coaching_source_assets.length, 1);
  assert.equal(db.tables.coaching_source_assets[0].source_system, 'coaching_drop_zone');
  assert.equal(db.tables.coaching_source_assets[0].metadata.original_metadata.webex_recording_id, 'adv-route-1');
  assert.equal(db.tables.coaching_source_assets[0].metadata.original_metadata.no_name_only_auto_attach, true);
  assert.equal(db.tables.coaching_source_assets[0].metadata.student_resolution.status, 'MANUAL_REVIEW');
  assert.equal(existsSync(path.join(tmp, 'video_registry.json')), false);
  assert.equal(fetchLog.some((entry) => /ignored-route-1/u.test(entry.url)), false, 'Ignored Webex records must not be pulled.');
  assert.equal(db.tables.audit_events.some((row) => row.action === 'mmc507_webex_trigger_pull_completed'), true);
} finally {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(tmp, { recursive: true, force: true });
}

console.log('MMC-507 Webex trigger route validation passed.');

async function callRoute(route, method, body, deps) {
  const url = new URL(`http://127.0.0.1/api/mmc/coaching-pipeline${route}`);
  const request = { method, body };
  const response = makeResponse();
  await handleMmcCoachingPipelineRoute(request, response, url, deps);
  assert.ok(response.payload, `Expected route payload for ${method} ${route}`);
  assert.ok(response.statusCode >= 200 && response.statusCode < 300, `Expected 2xx for ${method} ${route}: ${JSON.stringify(response.payload)}`);
  return response.payload;
}

function makeResponse() {
  return {
    statusCode: 0,
    headers: {},
    payload: null,
  };
}

function makeDeps(db, fetchImpl) {
  const context = {
    principal: {
      id: randomUUID(),
      role: 'admin',
      authSubjectId: 'wp:admin:1',
      displayName: 'MMC Admin',
    },
    config: {
      projectRef: 'test-staging',
    },
  };
  db.ensure('mentors', {
    auth_subject_id: context.principal.authSubjectId,
    role: 'admin',
    status: 'active',
  });

  return {
    session: { user: { email: 'admin@example.test' } },
    authHeaders: {},
    fetch: fetchImpl,
    isAuthorizedMmcPrivateSession: () => true,
    getMmcPersistenceConfig: () => ({ ok: true, projectRef: 'test-staging' }),
    buildMmcPersistenceContext: () => context,
    ensureMmcMentor: async () => db.ensure('mentors', {
      auth_subject_id: context.principal.authSubjectId,
      role: 'admin',
      status: 'active',
    }),
    ensureMmcSubjectRef: async (_context, studentId, student) => db.ensure('identity_references', {
      primary_anchor_type: 'mmc_fixture_student',
      primary_anchor_hash: studentId,
      reference_status: 'unverified',
      metadata: { student_id: studentId, student_name: student?.name || studentId },
    }),
    ensureMmcAssignment: async (_context, mentor, subjectRef, studentId) => db.ensure('mentor_assignments', {
      mentor_id: mentor.id,
      subject_ref_id: subjectRef.id,
      status: 'active',
      metadata: { student_id: studentId },
    }),
    selectMmcRows: async (_context, table, query) => db.select(table, query),
    insertMmcRow: async (_context, table, row) => db.insert(table, row),
    updateMmcRow: async (_context, table, id, patch) => db.update(table, id, patch),
    readJsonBody: async (request) => request.body || {},
    sendJson: (response, statusCode, payload) => {
      response.statusCode = statusCode;
      response.payload = payload;
    },
  };
}

function makeMemoryDb() {
  const tables = {
    mentors: [],
    identity_references: [],
    mentor_assignments: [],
    coaching_source_assets: [],
    coaching_analysis_runs: [],
    coaching_sessions: [],
    ai_prompt_versions: [],
    session_artifacts: [],
    intelligence_snapshots: [],
    action_items: [],
    mentor_memory: [],
    open_loops: [],
    audit_events: [],
  };

  return {
    tables,
    ensure(table, row) {
      const existing = tables[table].find((item) => {
        if (table === 'mentors') return item.auth_subject_id === row.auth_subject_id;
        if (table === 'identity_references') return item.primary_anchor_hash === row.primary_anchor_hash;
        if (table === 'mentor_assignments') return item.mentor_id === row.mentor_id && item.subject_ref_id === row.subject_ref_id;
        return false;
      });
      return existing || this.insert(table, row);
    },
    select(table, query) {
      let rows = [...(tables[table] || [])];
      const id = extractEq(query, 'id');
      const sourceSystem = extractEq(query, 'source_system');
      const sourceId = extractEq(query, 'source_id');
      const promptKey = extractEq(query, 'prompt_key');
      const status = extractEq(query, 'status');
      const mentorId = extractEq(query, 'mentor_id');
      const assignmentId = extractEq(query, 'assignment_id');
      const subjectRefId = extractEq(query, 'subject_ref_id');
      if (id) rows = rows.filter((row) => row.id === id);
      if (sourceSystem) rows = rows.filter((row) => row.source_system === sourceSystem);
      if (sourceId) rows = rows.filter((row) => row.source_id === sourceId);
      if (promptKey) rows = rows.filter((row) => row.prompt_key === promptKey);
      if (status) rows = rows.filter((row) => row.status === status);
      if (mentorId) rows = rows.filter((row) => row.mentor_id === mentorId);
      if (assignmentId) rows = rows.filter((row) => row.assignment_id === assignmentId || row.id === assignmentId);
      if (subjectRefId) rows = rows.filter((row) => row.subject_ref_id === subjectRefId);
      return rows;
    },
    insert(table, row) {
      const created = {
        id: randomUUID(),
        created_at: new Date().toISOString(),
        deleted_at: null,
        ...row,
      };
      tables[table].push(created);
      return created;
    },
    update(table, id, patch) {
      const row = tables[table].find((item) => item.id === id);
      assert.ok(row, `Missing row ${table}:${id}`);
      Object.assign(row, patch, { updated_at: new Date().toISOString() });
      return row;
    },
  };
}

function extractEq(query, key) {
  const match = String(query || '').match(new RegExp(`(?:^|&)${key}=eq\\.([^&]+)`, 'u'));
  return match ? decodeURIComponent(match[1]) : '';
}

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => payload,
    text: async () => JSON.stringify(payload),
    arrayBuffer: async () => Buffer.from(JSON.stringify(payload)).buffer,
  };
}

function binaryResponse(buffer, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/octet-stream' },
    json: async () => JSON.parse(buffer.toString('utf8')),
    text: async () => buffer.toString('utf8'),
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  };
}
