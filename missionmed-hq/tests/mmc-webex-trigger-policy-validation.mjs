import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { mkdir, readdir, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  MAX_WEBEX_JSON_BYTES,
  MAX_WEBEX_RECORDING_BYTES,
  classifyWebexRecordingTitle,
  getWebexTriggerPullConfig,
  listWebexRecordings,
  pullTriggeredWebexRecordings,
} from '../lib/mmc-webex-triggered-pull.mjs';
import { scanCoachingDropZone } from '../lib/mmc-coaching-import-worker.mjs';

const tmp = mkdtempSync(path.join(os.tmpdir(), 'mmc-webex-trigger-policy-'));
const configuredRoot = path.join(tmp, 'configured');
const fixtureRoot = path.join(tmp, 'fixture');

try {
  assert.equal(classifyWebexRecordingTitle('[MM-ADV] Dr Brian Advising').allowed, true);
  assert.equal(classifyWebexRecordingTitle('Dr Brian Advising').reason, 'missing_trigger');
  assert.equal(classifyWebexRecordingTitle('[MM-IGNORE] [MM-ADV] Test').reason, 'explicit_ignore_trigger');
  assert.equal(classifyWebexRecordingTitle('[MM-GRP] Group Advising').allowed, false);
  assert.equal(classifyWebexRecordingTitle('[MM-GRP] Group Advising', { allowedTriggers: ['[MM-GRP]'] }).allowed, true);
  assert.equal(classifyWebexRecordingTitle('[MM-ADV] Empty allowlist', { allowedTriggers: [] }).allowed, false);

  const sharedCredentialsOnly = getWebexTriggerPullConfig({
    MMHQ_MMC_WEBEX_ENABLED: 'true',
    MMHQ_WEBEX_ACCESS_TOKEN: 'shared-hq-token',
    SCHEDULER_WEBEX_ACCESS_TOKEN: 'scheduler-token',
    WEBEX_ACCESS_TOKEN: 'global-token',
    SCHEDULER_WEBEX_HOST_EMAIL: 'shared@example.test',
    WEBEX_API_BASE: 'https://attackerwebexapis.com/v1',
  });
  assert.equal(sharedCredentialsOnly.tokenConfigured, false, 'Shared and Scheduler credentials must be ignored.');
  assert.equal(sharedCredentialsOnly.hostEmailConfigured, false, 'Shared host configuration must be ignored.');
  assert.equal(sharedCredentialsOnly.status, 'UNVERIFIED');

  const disabledByDefault = getWebexTriggerPullConfig({
    MMHQ_MMC_WEBEX_ACCESS_TOKEN: 'dedicated-token',
    MMHQ_MMC_WEBEX_PULL_ENABLED: 'true',
  });
  assert.equal(disabledByDefault.enabled, false);
  assert.equal(disabledByDefault.pullEnabled, false);
  assert.equal(disabledByDefault.status, 'UNVERIFIED');

  const enabledConfig = getWebexTriggerPullConfig(baseEnv(configuredRoot));
  assert.equal(enabledConfig.ok, true);
  assert.equal(enabledConfig.enabled, true);
  assert.equal(enabledConfig.tokenConfigured, true);
  assert.equal(enabledConfig.pullEnabled, true);
  assert.deepEqual(enabledConfig.allowedTriggers, ['[MM-ADV]']);
  assert.equal(JSON.stringify(enabledConfig).includes('fixture-secret-token'), false);
  assert.equal(JSON.stringify(enabledConfig).includes(tmp), false, 'Public config must not reveal a filesystem path.');

  const invalidOriginConfig = getWebexTriggerPullConfig({
    ...baseEnv(configuredRoot),
    MMHQ_MMC_WEBEX_API_BASE: 'https://attackerwebexapis.com/v1',
  });
  assert.equal(invalidOriginConfig.ok, false);
  assert.equal(invalidOriginConfig.error, 'webex_api_origin_invalid');
  assert.equal(JSON.stringify(invalidOriginConfig).includes('attackerwebexapis.com'), false);

  let unexpectedFetchCount = 0;
  const neverFetch = async () => {
    unexpectedFetchCount += 1;
    throw new Error('network must not be reached');
  };
  const sharedOnlyInventory = await listWebexRecordings({
    env: {
      MMHQ_MMC_WEBEX_ENABLED: 'true',
      SCHEDULER_WEBEX_ACCESS_TOKEN: 'scheduler-token',
      WEBEX_ACCESS_TOKEN: 'global-token',
    },
    fetchImpl: neverFetch,
  });
  assert.equal(sharedOnlyInventory.status, 'UNVERIFIED');
  assert.equal(unexpectedFetchCount, 0);

  const defaultDisabledInventory = await listWebexRecordings({
    env: { MMHQ_MMC_WEBEX_ACCESS_TOKEN: 'dedicated-token' },
    fetchImpl: neverFetch,
  });
  assert.equal(defaultDisabledInventory.error, 'webex_integration_disabled');
  const defaultDisabledPull = await pullTriggeredWebexRecordings({
    env: {
      MMHQ_MMC_WEBEX_ACCESS_TOKEN: 'dedicated-token',
      MMHQ_MMC_WEBEX_PULL_ENABLED: 'true',
      MMHQ_MMC_WEBEX_DROP_ZONE_PATH: configuredRoot,
    },
    dropZonePath: fixtureRoot,
    fetchImpl: neverFetch,
    force: true,
  });
  assert.equal(defaultDisabledPull.error, 'webex_integration_disabled');
  assert.equal(defaultDisabledPull.dropZonePath, configuredRoot, 'Caller root must be ignored outside explicit fixture mode.');
  assert.equal(JSON.stringify(defaultDisabledPull).includes(tmp), false);
  assert.equal(unexpectedFetchCount, 0);

  const forceCannotEnable = await pullTriggeredWebexRecordings({
    env: {
      ...baseEnv(configuredRoot),
      MMHQ_MMC_WEBEX_PULL_ENABLED: 'false',
    },
    fetchImpl: neverFetch,
    force: true,
  });
  assert.equal(forceCannotEnable.error, 'webex_pull_not_enabled');
  assert.equal(unexpectedFetchCount, 0);

  const symlinkTarget = path.join(tmp, 'symlink-target');
  const symlinkRoot = path.join(tmp, 'symlink-root');
  await mkdir(symlinkTarget, { recursive: true });
  await symlink(symlinkTarget, symlinkRoot, 'dir');
  await expectRejectCode(pullTriggeredWebexRecordings({
    env: baseEnv(configuredRoot),
    fetchImpl: neverFetch,
    fixtureMode: true,
    fixtureDownloadOrigins: ['https://downloads.example.test'],
    dropZonePath: symlinkRoot,
  }), 'webex_staging_symlink_rejected');
  assert.equal(unexpectedFetchCount, 0, 'A symlinked fixture root must fail before any provider request.');

  await expectRejectCode(listWebexRecordings({
    env: {
      ...baseEnv(configuredRoot),
      MMHQ_MMC_WEBEX_API_BASE: 'https://attackerwebexapis.com/v1',
    },
    fetchImpl: neverFetch,
  }), 'webex_api_origin_invalid');
  assert.equal(unexpectedFetchCount, 0, 'Invalid API origins must fail before fetch.');

  const redirectLog = [];
  await expectRejectCode(listWebexRecordings({
    env: baseEnv(configuredRoot),
    fetchImpl: async (url, options) => {
      redirectLog.push({ url: String(url), options });
      return redirectResponse('https://attacker.example.test/steal');
    },
  }), 'webex_redirect_rejected');
  assert.equal(redirectLog.length, 1);
  assert.equal(redirectLog[0].options.redirect, 'manual');
  assert.equal(new URL(redirectLog[0].url).origin, 'https://webexapis.com');

  await expectRejectCode(listWebexRecordings({
    env: baseEnv(configuredRoot),
    fetchImpl: async () => oversizedResponse(MAX_WEBEX_JSON_BYTES + 1),
  }), 'webex_json_too_large');

  const attackerFetchLog = [];
  await expectRejectCode(pullTriggeredWebexRecordings({
    env: baseEnv(configuredRoot),
    fetchImpl: makeScenarioFetch({
      recordingId: 'attacker-suffix-1',
      recordingUrl: 'https://attackerwebexapis.com/recording.mp4',
      fetchLog: attackerFetchLog,
    }),
    fixtureMode: true,
    dropZonePath: path.join(tmp, 'attacker-suffix'),
    allowedTriggers: ['[MM-ADV]'],
  }), 'webex_asset_origin_rejected');
  assert.equal(attackerFetchLog.some((entry) => new URL(entry.url).hostname === 'attackerwebexapis.com'), false);
  assert.equal(attackerFetchLog.every((entry) => entry.options.redirect === 'manual'), true);

  const oversizedRoot = path.join(tmp, 'oversized-download');
  await expectRejectCode(pullTriggeredWebexRecordings({
    env: baseEnv(configuredRoot),
    fetchImpl: makeScenarioFetch({
      recordingId: 'oversized-1',
      recordingUrl: 'https://downloads.example.test/oversized-1.mp4',
      downloadResponse: oversizedResponse(MAX_WEBEX_RECORDING_BYTES + 1),
    }),
    fixtureMode: true,
    fixtureDownloadOrigins: ['https://downloads.example.test'],
    dropZonePath: oversizedRoot,
    allowedTriggers: ['[MM-ADV]'],
  }), 'webex_asset_too_large');
  assert.deepEqual(await readdir(oversizedRoot), [], 'Rejected oversized downloads must not leave staged files.');

  const fetchLog = [];
  const fetchImpl = makeScenarioFetch({
    recordingId: 'adv-1',
    recordingUrl: 'https://downloads.example.test/adv-1.mp4',
    transcriptUrl: 'https://downloads.example.test/adv-1.vtt',
    includeIgnoredFixtures: true,
    fetchLog,
  });

  const inventory = await listWebexRecordings({
    env: baseEnv(configuredRoot),
    fetchImpl,
    allowedTriggers: ['[MM-ADV]', '[MM-GRP]'],
  });
  assert.equal(inventory.status, 'VERIFIED');
  assert.deepEqual(inventory.allowedTriggers, ['[MM-ADV]'], 'Request triggers may only narrow the server allowlist.');
  assert.equal(inventory.allowed.length, 1);
  assert.equal(inventory.ignored.length, 3);
  assert.equal(inventory.allowed[0].hasRecordingDownloadUrl, false);

  const pulled = await pullTriggeredWebexRecordings({
    env: baseEnv(configuredRoot),
    fetchImpl,
    allowedTriggers: ['[MM-ADV]', '[MM-GRP]'],
    fixtureMode: true,
    fixtureDownloadOrigins: ['https://downloads.example.test'],
    dropZonePath: fixtureRoot,
    limit: 10,
  });
  assert.equal(pulled.status, 'VERIFIED');
  assert.deepEqual(pulled.allowedTriggers, ['[MM-ADV]']);
  assert.equal(pulled.staged.length, 1);
  assert.equal(pulled.ignored.length, 3);
  assert.equal(pulled.staged[0].completePair, true);
  assert.equal(Object.hasOwn(pulled.staged[0], 'videoPath'), false);
  assert.equal(Object.hasOwn(pulled.staged[0], 'transcriptPath'), false);
  assert.equal(Object.hasOwn(pulled.staged[0], 'metadataPath'), false);
  assert.equal(JSON.stringify(pulled).includes(tmp), false, 'Public pull response must not reveal staging paths.');
  assert.equal(JSON.stringify(pulled).includes('fixture-secret-token'), false);
  assert.equal(fetchLog.some((entry) => /no-trigger|ignore-1|group-1/u.test(entry.url)), false, 'Ignored recordings must not receive detail/download fetches.');

  const apiFetches = fetchLog.filter((entry) => new URL(entry.url).origin === 'https://webexapis.com');
  const downloadFetches = fetchLog.filter((entry) => new URL(entry.url).origin === 'https://downloads.example.test');
  assert.equal(apiFetches.length > 0, true);
  assert.equal(apiFetches.every((entry) => entry.options.headers.Authorization === 'Bearer fixture-secret-token'), true);
  assert.equal(downloadFetches.length, 2);
  assert.equal(downloadFetches.every((entry) => !entry.options.headers.Authorization), true, 'Token must never leave the exact approved API origin.');
  assert.equal(fetchLog.every((entry) => entry.options.method === 'GET'), true);
  assert.equal(fetchLog.every((entry) => entry.options.redirect === 'manual'), true);

  const files = await readdir(fixtureRoot);
  assert.equal(files.some((name) => name.endsWith('.mp4')), true);
  assert.equal(files.some((name) => name.endsWith('.vtt')), true);
  assert.equal(files.some((name) => name.endsWith('.metadata.json')), true);
  assert.equal(files.some((name) => /no-trigger|ignore|group/iu.test(name)), false);

  const scan = scanCoachingDropZone({ dropZonePath: fixtureRoot, minStableAgeMs: 0, includeIncomplete: true });
  assert.equal(scan.status, 'VERIFIED');
  assert.equal(scan.candidates.length, 1);
  assert.equal(scan.protections.dailyDrillsWatcherStarted, false);
  assert.equal(scan.protections.videoRegistryWritten, false);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log('MMC-507 Webex trigger policy and security validation passed.');

function baseEnv(dropZonePath) {
  return {
    MMHQ_MMC_WEBEX_ENABLED: 'true',
    MMHQ_MMC_WEBEX_PULL_ENABLED: 'true',
    MMHQ_MMC_WEBEX_ACCESS_TOKEN: 'fixture-secret-token',
    MMHQ_MMC_WEBEX_API_BASE: 'https://webexapis.com/v1',
    MMHQ_MMC_WEBEX_ALLOWED_TRIGGERS: '[MM-ADV]',
    MMHQ_MMC_WEBEX_DROP_ZONE_PATH: dropZonePath,
  };
}

function makeScenarioFetch(options) {
  const {
    recordingId,
    recordingUrl,
    transcriptUrl = '',
    downloadResponse,
    includeIgnoredFixtures = false,
    fetchLog = [],
  } = options;
  return async (url, requestOptions = {}) => {
    const parsed = new URL(String(url));
    fetchLog.push({ url: String(url), options: requestOptions });
    if (parsed.pathname === '/v1/recordings') {
      const items = [
        { id: recordingId, topic: '[MM-ADV] Synthetic advising fixture', meetingId: 'meeting-adv-1', createdTime: '2026-06-29T14:00:00Z' },
      ];
      if (includeIgnoredFixtures) {
        items.push(
          { id: 'no-trigger', topic: 'Regular weekly recording', meetingId: 'meeting-2', createdTime: '2026-06-29T15:00:00Z' },
          { id: 'ignore-1', topic: '[MM-IGNORE] [MM-ADV] Internal huddle', meetingId: 'meeting-3', createdTime: '2026-06-29T16:00:00Z' },
          { id: 'group-1', topic: '[MM-GRP] Group session', meetingId: 'meeting-4', createdTime: '2026-06-29T17:00:00Z' },
        );
      }
      return jsonResponse({ items });
    }
    if (parsed.pathname === `/v1/recordings/${recordingId}`) {
      return jsonResponse({
        id: recordingId,
        topic: '[MM-ADV] Synthetic advising fixture',
        meetingId: 'meeting-adv-1',
        createdTime: '2026-06-29T14:00:00Z',
        temporaryDirectDownloadLinks: {
          videoFile: recordingUrl,
          ...(transcriptUrl ? { transcriptFile: transcriptUrl } : {}),
        },
      });
    }
    if (parsed.href === recordingUrl) {
      return downloadResponse || binaryResponse(Buffer.from('video-bytes'));
    }
    if (transcriptUrl && parsed.href === transcriptUrl) {
      return binaryResponse(Buffer.from('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nDr Brian: Great next step.\n'));
    }
    throw new Error('Unexpected synthetic Webex fetch.');
  };
}

async function expectRejectCode(promise, expectedCode) {
  let caught;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  assert.ok(caught, `Expected rejection with ${expectedCode}.`);
  assert.equal(caught.code, expectedCode);
  const publicError = `${caught.message || ''} ${caught.detail || ''}`;
  assert.equal(publicError.includes('fixture-secret-token'), false);
  assert.equal(publicError.includes(tmp), false);
  assert.equal(publicError.includes('attackerwebexapis.com'), false);
  return caught;
}

function jsonResponse(payload, status = 200) {
  const buffer = Buffer.from(JSON.stringify(payload));
  return responseFromBuffer(buffer, status, { 'content-type': 'application/json' });
}

function binaryResponse(buffer, status = 200) {
  return responseFromBuffer(buffer, status, { 'content-type': 'application/octet-stream' });
}

function responseFromBuffer(buffer, status, extraHeaders = {}) {
  const bodyBuffer = Buffer.from(buffer);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: makeHeaders({ ...extraHeaders, 'content-length': String(bodyBuffer.byteLength) }),
    body: makeReadableBody(bodyBuffer),
    text: async () => bodyBuffer.toString('utf8'),
    arrayBuffer: async () => bodyBuffer.buffer.slice(bodyBuffer.byteOffset, bodyBuffer.byteOffset + bodyBuffer.byteLength),
  };
}

function redirectResponse(location) {
  return {
    ok: false,
    status: 302,
    headers: makeHeaders({ location, 'content-length': '0' }),
    body: makeReadableBody(Buffer.alloc(0)),
    text: async () => '',
  };
}

function oversizedResponse(contentLength) {
  return {
    ok: true,
    status: 200,
    headers: makeHeaders({ 'content-length': String(contentLength) }),
    body: {
      getReader() {
        throw new Error('Oversized response body must not be read.');
      },
    },
  };
}

function makeHeaders(values) {
  const normalized = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), String(value)]));
  return { get: (name) => normalized.get(String(name).toLowerCase()) || null };
}

function makeReadableBody(buffer) {
  return {
    getReader() {
      let offset = 0;
      let cancelled = false;
      return {
        async read() {
          if (cancelled || offset >= buffer.byteLength) return { done: true, value: undefined };
          const nextOffset = Math.min(offset + 7, buffer.byteLength);
          const value = buffer.subarray(offset, nextOffset);
          offset = nextOffset;
          return { done: false, value };
        },
        async cancel() {
          cancelled = true;
        },
      };
    },
  };
}
