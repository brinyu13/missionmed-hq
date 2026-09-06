import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const TOOL_DIR = dirname(fileURLToPath(import.meta.url));
const TOOL_PATH = join(TOOL_DIR, 'sanitize_runtime_corpus_probe.mjs');
const TOOL_SOURCE = await readFile(TOOL_PATH, 'utf8');

const RUNTIME_HOST = 'mmvs-backend-production.up.railway.app';
const CDN_HOST = 'cdn.missionmedinstitute.com';

const CANARY = Object.freeze({
  idA: 'RAW_PRIVATE_VIDEO_ID_ALPHA_7f8f',
  idB: 'RAW_PRIVATE_VIDEO_ID_BETA_6e7e',
  idNetwork: 'RAW_PRIVATE_VIDEO_ID_NETWORK_5d6d',
  idRedirect: 'RAW_PRIVATE_VIDEO_ID_REDIRECT_4c5c',
  idMime: 'RAW_PRIVATE_VIDEO_ID_MIME_3b4b',
  idSize: 'RAW_PRIVATE_VIDEO_ID_SIZE_2a3a',
  idShape: 'RAW_PRIVATE_VIDEO_ID_SHAPE_1929',
  idMismatch: 'RAW_PRIVATE_VIDEO_ID_BIND_0818',
  idDerived: 'RAW_PRIVATE_VIDEO_ID_DERIVED_d5e5',
  idHostile: 'RAW_PRIVATE_VIDEO_ID_HOSTILE_f707',
  idUnsafe: 'RAW_PRIVATE_VIDEO_ID_UNSAFE/segment',
  wrongBodyId: 'WRONG_BODY_VIDEO_ID_CANARY_e6f6',
  title: 'RAW PRIVATE TITLE CANARY keep out of receipts',
  text: 'RAW TRANSCRIPT TEXT CANARY keep out of receipts',
  speaker: 'RAW SPEAKER LABEL CANARY keep out of receipts',
  secret: 'sk_test_CANARY_NETWORK_SECRET_never_emit',
  redirect: 'https://evil.invalid/RAW_REDIRECT_CANARY',
  hostileUrl: 'https://evil.invalid/private/RAW_HOST_CANARY.transcript.json',
  noncanonicalDirect: `https://${CDN_HOST}/arbitrary/private.json`,
});

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function legacyEntityAlias(id) {
  return `entity_sha256_${sha256(`missionmed-entity-v1\0${id}`)}`;
}

function legacySetRoot(values, domain) {
  const leaves = [...new Set(values)]
    .map((value) => sha256(`${domain}:leaf\0${value}`))
    .sort();
  return sha256(`${domain}:root\0${leaves.join('\n')}`);
}

function jsonResponse(value, overrides = {}) {
  const body = typeof value === 'string' ? value : JSON.stringify(value);
  return {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-length': String(Buffer.byteLength(body)),
      ...(overrides.headers ?? {}),
    },
    body,
    ...Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== 'headers')),
  };
}

function headFor(body, overrides = {}) {
  return {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(body)),
      ...(overrides.headers ?? {}),
    },
    body: '',
    ...Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== 'headers')),
  };
}

function mockModuleSource(scenario) {
  return `
import { appendFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';

const scenario = ${JSON.stringify(scenario)};
const offsets = new Map();

function nextFixture(key) {
  const fixtures = scenario[key] ?? [];
  const offset = offsets.get(key) ?? 0;
  offsets.set(key, offset + 1);
  return fixtures[offset] ?? fixtures.at(-1) ?? {
    kind: 'network_error',
    message: 'UNCONFIGURED_MOCK_ROUTE_CANARY',
  };
}

function record(key) {
  if (process.env.MOCK_COUNTER_FILE) {
    appendFileSync(process.env.MOCK_COUNTER_FILE, key + '\\n', 'utf8');
  }
}

export default {
  request(options, callback) {
    const request = new EventEmitter();
    request.setTimeout = () => request;
    request.destroy = (error) => {
      if (error) queueMicrotask(() => request.emit('error', error));
      return request;
    };
    request.end = () => {
      queueMicrotask(() => {
        const key = String(options.method) + ' ' + String(options.path);
        record(key);
        const fixture = nextFixture(key);
        if (fixture.kind === 'network_error') {
          request.emit('error', new Error(fixture.message ?? 'transport failure'));
          return;
        }
        const body = Buffer.from(fixture.body ?? '', fixture.body_encoding ?? 'utf8');
        const response = Readable.from(body.length ? [body] : []);
        response.statusCode = fixture.status ?? 200;
        response.headers = fixture.headers ?? {};
        callback(response);
      });
    };
    return request;
  },
};
`;
}

async function createHarness(t, scenario = {}) {
  const root = await mkdtemp(join(tmpdir(), 'missionmed-probe-test-'));
  const tools = join(root, 'tools');
  const reports = join(root, 'reports');
  const instrumentedTool = join(tools, 'sanitize_runtime_corpus_probe.mjs');
  const mockModule = join(tools, 'mock-https.mjs');
  const counter = join(root, 'mock-network-calls.txt');
  await mkdir(tools, { recursive: true });
  await mkdir(reports, { recursive: true });

  const transformed = TOOL_SOURCE.replace(
    "import https from 'node:https';",
    "import https from './mock-https.mjs';",
  );
  assert.notEqual(transformed, TOOL_SOURCE, 'test harness must replace the live transport');
  await writeFile(instrumentedTool, transformed, { mode: 0o700 });
  await writeFile(mockModule, mockModuleSource(scenario), { mode: 0o600 });

  t.after(async () => rm(root, { recursive: true, force: true }));

  return {
    root,
    reports,
    counter,
    output: join(reports, 'sanitized-report.json'),
    run(args) {
      return spawnSync(process.execPath, [instrumentedTool, ...args], {
        encoding: 'utf8',
        env: { MOCK_COUNTER_FILE: counter },
        maxBuffer: 8 * 1024 * 1024,
        timeout: 30_000,
      });
    },
    async calls() {
      try {
        return (await readFile(counter, 'utf8')).trim().split('\n').filter(Boolean);
      } catch (error) {
        if (error?.code === 'ENOENT') return [];
        throw error;
      }
    },
  };
}

function artifactUrl(id, artifactClass) {
  const suffix = artifactClass === 'nodes_json' ? 'nodes' : 'transcript';
  return `https://${CDN_HOST}/videos/v2/usmle/${id}.${suffix}.json`;
}

function artifactPath(id, artifactClass) {
  const suffix = artifactClass === 'nodes_json' ? 'nodes' : 'transcript';
  return `/videos/v2/usmle/${id}.${suffix}.json`;
}

function record(id, {
  transcriptUrl = artifactUrl(id, 'transcript_json'),
  nodesUrl = null,
} = {}) {
  const value = {
    video_id: id,
    division: 'USMLE',
    title: CANARY.title,
  };
  if (transcriptUrl) value.transcript_url = transcriptUrl;
  if (nodesUrl) value.nodes_url = nodesUrl;
  return value;
}

function primaryFixture() {
  const records = [
    record(CANARY.idA),
    record(CANARY.idB),
    record(CANARY.idNetwork),
    record(CANARY.idRedirect),
    record(CANARY.idMime),
    record(CANARY.idSize),
    record(CANARY.idShape),
    record(CANARY.idMismatch, { nodesUrl: artifactUrl(CANARY.idMismatch, 'nodes_json') }),
    record(CANARY.idDerived, { transcriptUrl: null, nodesUrl: null }),
    record(CANARY.idHostile, { transcriptUrl: CANARY.hostileUrl }),
    record(CANARY.idUnsafe, { transcriptUrl: CANARY.noncanonicalDirect }),
  ];
  const reversed = [...records].reverse();
  const sharedBody = JSON.stringify([{
    start_time: 1,
    end_time: 2,
    speaker: CANARY.speaker,
    text: CANARY.text,
  }]);
  const shapeBody = JSON.stringify({
    video_id: CANARY.idShape,
    text: CANARY.text,
  });
  const mismatchBody = JSON.stringify({
    video_id: CANARY.wrongBodyId,
    segments: [{ start: 1, end: 2, speaker: CANARY.speaker, text: CANARY.text }],
  });
  const mismatchNodesBody = JSON.stringify({
    data: {
      videoId: CANARY.wrongBodyId,
      drill_nodes: [{ start: 1, end: 2, text: CANARY.text }],
    },
  });
  const derivedTranscriptBody = JSON.stringify({
    video_id: CANARY.idDerived,
    segments: [{ start: 1, end: 2, speaker: CANARY.speaker, text: CANARY.text }],
  });
  const derivedNodesBody = JSON.stringify({
    videoId: CANARY.idDerived,
    drill_nodes: [{ start: 1, end: 2, text: CANARY.text }],
  });

  return {
    records,
    sharedBody,
    mismatchBody,
    mismatchNodesBody,
    derivedTranscriptBody,
    derivedNodesBody,
    scenario: {
      'GET /health': [jsonResponse({ status: 'ok' })],
      'GET /videos': [jsonResponse(records), jsonResponse(reversed)],
      'GET /api/drills': [
        jsonResponse({ drills: records }),
        jsonResponse({ drills: reversed }),
      ],
      [`HEAD ${artifactPath(CANARY.idA, 'transcript_json')}`]: [headFor(sharedBody)],
      [`GET ${artifactPath(CANARY.idA, 'transcript_json')}`]: [jsonResponse(sharedBody)],
      [`HEAD ${artifactPath(CANARY.idB, 'transcript_json')}`]: [headFor(sharedBody)],
      [`GET ${artifactPath(CANARY.idB, 'transcript_json')}`]: [jsonResponse(sharedBody)],
      [`HEAD ${artifactPath(CANARY.idNetwork, 'transcript_json')}`]: [{
        kind: 'network_error',
        message: `socket failed with ${CANARY.secret}`,
      }],
      [`HEAD ${artifactPath(CANARY.idRedirect, 'transcript_json')}`]: [{
        status: 302,
        headers: {
          location: CANARY.redirect,
          'content-type': 'application/json',
          'content-length': '0',
        },
        body: '',
      }],
      [`HEAD ${artifactPath(CANARY.idMime, 'transcript_json')}`]: [{
        status: 200,
        headers: { 'content-type': 'text/html', 'content-length': '2' },
        body: '',
      }],
      [`HEAD ${artifactPath(CANARY.idSize, 'transcript_json')}`]: [{
        status: 200,
        headers: { 'content-type': 'application/json', 'content-length': '4096' },
        body: '',
      }],
      [`HEAD ${artifactPath(CANARY.idShape, 'transcript_json')}`]: [headFor(shapeBody)],
      [`GET ${artifactPath(CANARY.idShape, 'transcript_json')}`]: [jsonResponse(shapeBody)],
      [`HEAD ${artifactPath(CANARY.idMismatch, 'transcript_json')}`]: [headFor(mismatchBody)],
      [`GET ${artifactPath(CANARY.idMismatch, 'transcript_json')}`]: [jsonResponse(mismatchBody)],
      [`HEAD ${artifactPath(CANARY.idMismatch, 'nodes_json')}`]: [headFor(mismatchNodesBody)],
      [`GET ${artifactPath(CANARY.idMismatch, 'nodes_json')}`]: [jsonResponse(mismatchNodesBody)],
      [`HEAD ${artifactPath(CANARY.idDerived, 'transcript_json')}`]: [headFor(derivedTranscriptBody)],
      [`GET ${artifactPath(CANARY.idDerived, 'transcript_json')}`]: [
        jsonResponse(derivedTranscriptBody),
      ],
      [`HEAD ${artifactPath(CANARY.idDerived, 'nodes_json')}`]: [headFor(derivedNodesBody)],
      [`GET ${artifactPath(CANARY.idDerived, 'nodes_json')}`]: [jsonResponse(derivedNodesBody)],
    },
  };
}

function assertNoCanaryLeak(serialized) {
  for (const value of Object.values(CANARY)) {
    assert.equal(
      serialized.includes(value),
      false,
      'sanitized process and report output must exclude every synthetic raw-data canary',
    );
  }
}

test('source keeps every request behind the exact read-only host and route allowlist', () => {
  const pathDeclaration = TOOL_SOURCE.match(/const RUNTIME_PATHS = new Set\(\[([^\]]+)]\);/s);
  assert.ok(pathDeclaration, 'runtime path allowlist declaration must remain explicit');
  const paths = [...pathDeclaration[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(paths, ['/health', '/videos', '/api/drills']);

  const methodDeclaration = TOOL_SOURCE.match(/const ALLOWED_METHODS = new Set\(\[([^\]]+)]\);/s);
  assert.ok(methodDeclaration, 'method allowlist declaration must remain explicit');
  const methods = [...methodDeclaration[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(methods, ['GET', 'HEAD']);

  assert.equal((TOOL_SOURCE.match(/https\.request\(/g) ?? []).length, 1);
  assert.match(TOOL_SOURCE, /hostname: url\.hostname/);
  assert.match(TOOL_SOURCE, /assertNetworkTarget\(url, method, purpose\)/);
  assert.equal(TOOL_SOURCE.includes('/api/media/unified'), false);
  assert.equal(TOOL_SOURCE.includes('/api/media/detail'), false);
  assert.equal(TOOL_SOURCE.toLowerCase().includes('backfill'), false);
  assert.equal(TOOL_SOURCE.includes("url.hostname !== RUNTIME_HOST"), true);
  assert.equal(TOOL_SOURCE.includes("url.hostname !== CDN_HOST"), true);
});

test('dry-run performs zero mocked network calls and zero report writes', async (t) => {
  const harness = await createHarness(t);
  const result = harness.run(['--dry-run']);
  assert.equal(result.status, 0, 'dry-run should succeed');
  assert.equal(result.stderr, '');
  const receipt = JSON.parse(result.stdout);
  assert.deepEqual(receipt, {
    mode: 'dry_run',
    result: 'pass',
    network_requests: 0,
    file_writes: 0,
    check_count: 14,
  });
  assert.deepEqual(await harness.calls(), []);
  assert.deepEqual(await readdir(harness.reports), []);
});

test('adversarial fixtures yield deterministic sanitized receipts and fail closed', async (t) => {
  const fixture = primaryFixture();
  const harness = await createHarness(t, fixture.scenario);
  const args = [
    '--output', harness.output,
    '--delay-ms', '100',
    '--timeout-ms', '1000',
    '--max-list-bytes', '65536',
    '--max-artifact-bytes', '2048',
    '--concurrency', '3',
  ];
  const result = harness.run(args);
  assert.equal(result.status, 0, `instrumented probe failed: ${result.stderr}`);
  const reportText = await readFile(harness.output, 'utf8');
  const report = JSON.parse(reportText);
  assertNoCanaryLeak(`${result.stdout}\n${result.stderr}\n${reportText}`);

  assert.equal(report.execution.mode, 'live_read_only_zero_retention');
  assert.deepEqual(report.execution.network_method_classes, ['GET', 'HEAD']);
  assert.equal(report.execution.redirect_policy, 'reject');
  assert.equal(report.execution.raw_retention, 'none');
  assert.deepEqual(report.aliasing, {
    scheme: 'per_run_hmac_sha256',
    key_retention: 'none',
    cross_run_alias_correlation: false,
    content_hash_scope: 'byte_identity_only',
  });
  assert.equal(reportText.includes('aliasKey'), false);
  assert.equal(report.candidate_universe.opaque_id_count, fixture.records.length);
  assert.notEqual(
    report.candidate_universe.opaque_id_set_root,
    legacySetRoot(
      fixture.records.map((entry) => entry.video_id),
      'missionmed-candidate-union-v2',
    ),
  );
  for (const entry of fixture.records) {
    assert.equal(reportText.includes(legacyEntityAlias(entry.video_id)), false);
    assert.equal(reportText.includes(sha256(`missionmed-entity-v2\0${entry.video_id}`)), false);
  }

  assert.equal(report.candidate_universe.all_endpoint_opaque_id_sets_stable, true);
  assert.equal(report.candidate_universe.all_endpoint_candidate_sets_stable, true);
  for (const inventory of report.runtime_inventory) {
    assert.equal(inventory.opaque_id_set_stable, true);
    assert.equal(inventory.candidate_opaque_id_set_stable, true);
    assert.equal(inventory.body_receipt_stable, false);
    assert.equal(inventory.pass_receipts.length, 2);
    assert.equal(
      inventory.pass_receipts[0].opaque_id_set_root,
      inventory.pass_receipts[1].opaque_id_set_root,
    );
    assert.notEqual(
      inventory.pass_receipts[0].body_receipt_hash,
      inventory.pass_receipts[1].body_receipt_hash,
    );
  }

  assert.equal(report.artifact_inventory.length, fixture.records.length * 2);
  const entityAliases = report.artifact_inventory.map((item) => item.entity_alias);
  assert.equal(new Set(entityAliases).size, fixture.records.length);
  assert.equal(entityAliases.every((alias) => /^entity_hmac_sha256_[0-9a-f]{64}$/.test(alias)), true);
  const sharedItems = report.artifact_inventory.filter((item) => (
    item.availability === 'available'
      && item.receipt?.content_hash === sha256(fixture.sharedBody)
  ));
  assert.equal(sharedItems.length, 2);
  assert.equal(sharedItems.every((item) => item.artifact_class === 'transcript_json'), true);
  assert.equal(sharedItems.every((item) => item.receipt.binding_class === 'locator_only'), true);
  assert.equal(sharedItems.every((item) => item.receipt.segment_count === 1), true);
  assert.equal(sharedItems.every((item) => item.receipt.timestamp_count === 2), true);
  assert.equal(sharedItems.every((item) => item.receipt.speaker_label_count === 1), true);
  assert.equal(new Set(sharedItems.map((item) => item.receipt.speaker_label_set_root)).size, 1);

  const duplicate = report.duplicate_clusters.find(
    (cluster) => cluster.content_hash === sha256(fixture.sharedBody),
  );
  assert.ok(duplicate, 'byte-identical artifacts must form a duplicate cluster');
  assert.equal(duplicate.member_count, 2);
  assert.deepEqual(
    duplicate.members.map((member) => member.entity_alias).sort(),
    sharedItems.map((item) => item.entity_alias).sort(),
  );

  const transcriptRejection = (errorClass, rejectionStage) => report.artifact_inventory.find(
    (item) => item.artifact_class === 'transcript_json'
      && item.error_class === errorClass
      && item.rejection_stage === rejectionStage,
  );
  assert.ok(transcriptRejection('transport_failure', 'head'));
  assert.ok(transcriptRejection('redirect_rejected', 'head'));
  assert.ok(transcriptRejection('mime_rejected', 'head'));
  assert.ok(transcriptRejection('body_cap_exceeded', 'head'));
  assert.ok(transcriptRejection('schema_rejected', 'schema'));
  assert.ok(report.artifact_inventory.find((item) => (
    item.artifact_class === 'transcript_json'
      && item.availability === 'rejected'
      && item.error_class === 'transport_failure'
      && item.reference_integrity === 'direct_reference_rejected'
  )));

  const mismatches = report.artifact_inventory.filter(
    (item) => item.error_class === 'entity_binding_mismatch',
  );
  assert.equal(mismatches.length, 2);
  assert.deepEqual(mismatches.map((item) => item.artifact_class).sort(), [
    'nodes_json',
    'transcript_json',
  ]);
  assert.equal(mismatches.every((item) => item.rejection_stage === 'schema'), true);
  assert.equal(
    mismatches.every((item) => item.reference_basis === 'direct_plus_documented_runtime_derivation'),
    true,
  );
  const unsafeOpaqueIdItems = report.artifact_inventory.filter(
    (item) => item.error_class === 'opaque_id_rejected',
  );
  assert.equal(unsafeOpaqueIdItems.length, 2);
  assert.equal(unsafeOpaqueIdItems.every((item) => item.availability === 'rejected'), true);

  const derivedAvailable = report.artifact_inventory.filter((item) => (
    item.availability === 'available'
      && item.reference_basis === 'documented_runtime_derivation'
  ));
  assert.equal(derivedAvailable.length, 2);
  assert.deepEqual(derivedAvailable.map((item) => item.artifact_class).sort(), [
    'nodes_json',
    'transcript_json',
  ]);
  assert.equal(
    derivedAvailable.every((item) => item.receipt.binding_class === 'locator_and_payload'),
    true,
  );
  assert.equal(derivedAvailable.every((item) => item.receipt.declared_identity_count === 1), true);
  assert.equal(report.artifact_summary.documented_derivation_only_count, 10);
  assert.equal(report.artifact_summary.direct_plus_documented_derivation_count, 10);

  const firstAliases = [...new Set(entityAliases)].sort();
  const firstCandidateRoot = report.candidate_universe.opaque_id_set_root;
  const firstBodyReceipts = report.runtime_inventory.flatMap(
    (entry) => entry.pass_receipts.map((receipt) => receipt.body_receipt_hash),
  );
  const secondResult = harness.run(args);
  assert.equal(secondResult.status, 0, `second instrumented probe failed: ${secondResult.stderr}`);
  const secondReportText = await readFile(harness.output, 'utf8');
  const secondReport = JSON.parse(secondReportText);
  assertNoCanaryLeak(`${secondResult.stdout}\n${secondResult.stderr}\n${secondReportText}`);
  const secondAliases = [...new Set(
    secondReport.artifact_inventory.map((item) => item.entity_alias),
  )].sort();
  assert.notEqual(secondReport.candidate_universe.opaque_id_set_root, firstCandidateRoot);
  assert.equal(firstAliases.some((alias) => secondAliases.includes(alias)), false);
  assert.deepEqual(
    secondReport.runtime_inventory.flatMap(
      (entry) => entry.pass_receipts.map((receipt) => receipt.body_receipt_hash),
    ),
    firstBodyReceipts,
  );
  assert.equal(
    secondReport.artifact_inventory.filter(
      (item) => item.availability === 'available'
        && item.receipt?.content_hash === sha256(fixture.sharedBody),
    ).length,
    2,
  );

  const calls = await harness.calls();
  assert.equal(
    calls.includes(`HEAD ${artifactPath(CANARY.idHostile, 'transcript_json')}`),
    true,
    'an invalid direct reference must be ignored in favor of the pinned documented location',
  );
  assert.equal(calls.some((call) => call.includes('/api/media/')), false);
  assert.equal(calls.some((call) => call.includes('/arbitrary/private.json')), false);
  assert.equal(calls.some((call) => call.includes('detail')), false);
  assert.equal(calls.some((call) => call.includes('backfill')), false);

  const outputStats = await stat(harness.output);
  assert.equal(outputStats.mode & 0o777, 0o600);
  assert.deepEqual(
    (await readdir(harness.reports)).filter((name) => name.startsWith('.sanitized-probe-')),
    [],
  );
});

test('list redirects, MIME violations, body caps, and shapes are sanitized rejections', async (t) => {
  const oversized = 'x'.repeat(2048);
  const scalar = JSON.stringify('RAW_LIST_SHAPE_CANARY');
  const scenario = {
    'GET /health': [{
      kind: 'network_error',
      message: `health transport included ${CANARY.secret}`,
    }],
    'GET /videos': [
      {
        status: 302,
        headers: { location: CANARY.redirect, 'content-type': 'application/json' },
        body: '',
      },
      {
        status: 200,
        headers: { 'content-type': 'text/html', 'content-length': '2' },
        body: '{}',
      },
    ],
    'GET /api/drills': [
      {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'content-length': String(Buffer.byteLength(oversized)),
        },
        body: oversized,
      },
      jsonResponse(scalar),
    ],
  };
  const harness = await createHarness(t, scenario);
  const result = harness.run([
    '--output', harness.output,
    '--delay-ms', '100',
    '--timeout-ms', '1000',
    '--max-list-bytes', '1024',
  ]);
  assert.equal(result.status, 0, `instrumented probe failed: ${result.stderr}`);
  const reportText = await readFile(harness.output, 'utf8');
  const report = JSON.parse(reportText);
  assertNoCanaryLeak(`${result.stdout}\n${result.stderr}\n${reportText}`);
  assert.equal(report.health_receipt.error_class, 'transport_failure');

  const byClass = Object.fromEntries(
    report.runtime_inventory.map((entry) => [
      entry.source_class,
      entry.pass_receipts.map((receipt) => receipt.error_class),
    ]),
  );
  assert.deepEqual(byClass.runtime_video_registry, ['redirect_rejected', 'mime_rejected']);
  assert.deepEqual(byClass.runtime_drill_registry, ['body_cap_exceeded', 'schema_rejected']);
  assert.equal(report.candidate_universe.opaque_id_count, 0);
  assert.equal(report.artifact_inventory.length, 0);
});

test('unsafe output destinations fail before any network and never receive bytes', async (t) => {
  const harness = await createHarness(t);
  const outside = resolve(harness.root, '..', `escaped-${sha256(harness.root).slice(0, 12)}.json`);
  await rm(outside, { force: true });
  t.after(async () => rm(outside, { force: true }));

  const result = harness.run(['--output', outside, '--delay-ms', '100']);
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.stderr), {
    result: 'failed',
    error_class: 'output_rejected',
  });
  assert.equal(result.stdout, '');
  assert.deepEqual(await harness.calls(), [], 'output boundary must be checked before live work');
  await assert.rejects(lstat(outside), { code: 'ENOENT' });
  assertNoCanaryLeak(result.stderr);
});

test('symlink output is rejected before network and leaves its target untouched', async (t) => {
  const harness = await createHarness(t);
  const externalRoot = await mkdtemp(join(tmpdir(), 'missionmed-probe-external-'));
  t.after(async () => rm(externalRoot, { recursive: true, force: true }));
  const target = join(externalRoot, 'target.json');
  const link = join(harness.reports, 'linked.json');
  await writeFile(target, 'UNCHANGED_OUTPUT_BOUNDARY_CANARY', 'utf8');
  await symlink(target, link);
  assert.equal(await readlink(link), target);

  const result = harness.run(['--output', link, '--delay-ms', '100']);
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.stderr), {
    result: 'failed',
    error_class: 'output_rejected',
  });
  assert.deepEqual(await harness.calls(), [], 'symlink rejection must precede network');
  assert.equal(await readFile(target, 'utf8'), 'UNCHANGED_OUTPUT_BOUNDARY_CANARY');
});
