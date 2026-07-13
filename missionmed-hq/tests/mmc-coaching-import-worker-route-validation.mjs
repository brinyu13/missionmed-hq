import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { handleMmcCoachingPipelineRoute } from '../routes/mmc-coaching-pipeline.mjs';

const root = mkdtempSync(path.join(os.tmpdir(), 'mmc-worker-route-'));
const previousDropZone = process.env.MMHQ_MMC_COACHING_DROP_ZONE_PATH;

try {
  process.env.MMHQ_MMC_COACHING_DROP_ZONE_PATH = root;
  const base = '2026-06-28__Amara_Okafor__Mentorship__S01';
  writeFileSync(path.join(root, `${base}.mp4`), 'route-fixture-video');
  writeFileSync(path.join(root, `${base}.vtt`), [
    'WEBVTT',
    '',
    '00:00:01.000 --> 00:00:05.000',
    'Dr Brian: We should make one concrete next move.',
  ].join('\n'));
  writeFileSync(path.join(root, `${base}.metadata.json`), JSON.stringify({
    mmc_student_id: 'amara',
    meeting_match_status: 'verified',
  }));

  const db = makeMemoryDb();
  const deps = makeDeps(db);

  const status = await callRoute('/worker/status', 'GET', null, deps);
  assert.equal(status.status, 'VERIFIED');
  assert.equal(status.dropZone.exists, true);
  assert.equal(status.protections.dailyDrillsWatcherStarted, false);

  const scan = await callRoute('/worker/scan?limit=10&include_incomplete=1&min_stable_age_ms=0', 'GET', null, deps);
  assert.equal(scan.status, 'VERIFIED');
  assert.equal(scan.candidates.length, 1);
  assert.equal(scan.databaseWritten, false);

  const imported = await callRoute('/worker/import', 'POST', { limit: 10, minStableAgeMs: 0 }, deps);
  assert.equal(imported.status, 'VERIFIED');
  assert.equal(imported.imported.length, 1);
  assert.equal(imported.protections.videoRegistryWritten, false);
  assert.equal(db.tables.coaching_source_assets.length, 1);
  assert.equal(db.tables.coaching_source_assets[0].source_system, 'coaching_drop_zone');
  assert.equal(db.tables.coaching_source_assets[0].asset_status, 'candidate');
  assert.equal(db.tables.coaching_source_assets[0].subject_match_status, 'manual_review');
  assert.equal(db.tables.coaching_source_assets[0].metadata.student_resolution.status, 'MANUAL_REVIEW');

  const resolved = await callRoute('/student-resolution/resolve', 'POST', {
    sourceAssetId: db.tables.coaching_source_assets[0].id,
  }, deps);
  assert.equal(resolved.review.status, 'MANUAL_REVIEW');
  assert.equal(resolved.review.suggestedStudentId, '');

  const approved = await callRoute('/student-resolution/approve', 'POST', {
    sourceAssetId: db.tables.coaching_source_assets[0].id,
    studentId: 'amara',
    studentName: 'Amara Okafor',
  }, deps);
  assert.equal(approved.status, 'VERIFIED');
  assert.ok(approved.data.analysisRun.id);
  assert.equal(approved.data.sourceAsset.review_status, 'verified');
  assert.equal(approved.data.sourceAsset.metadata.student_resolution.status, 'VERIFIED');

  const processed = await callRoute('/worker/process', 'POST', {
    limit: 10,
    minStableAgeMs: 0,
    studentId: 'amara',
    analysisMode: 'mock',
  }, deps);
  assert.equal(processed.status, 'VERIFIED', JSON.stringify(processed.blocked || []));
  assert.equal(processed.processed.length, 1);
  assert.ok(db.tables.coaching_analysis_runs.length >= 2);
  assert.ok(db.tables.session_artifacts.some((row) => row.artifact_type === 'ai_meeting_summary'));
  assert.ok(db.tables.intelligence_snapshots.length >= 1);
  assert.ok(db.tables.open_loops.length >= 1);
} finally {
  if (previousDropZone == null) {
    delete process.env.MMHQ_MMC_COACHING_DROP_ZONE_PATH;
  } else {
    process.env.MMHQ_MMC_COACHING_DROP_ZONE_PATH = previousDropZone;
  }
  rmSync(root, { recursive: true, force: true });
}

console.log('MMC-502 coaching import worker route validation passed.');

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

function makeDeps(db) {
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
