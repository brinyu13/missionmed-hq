import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  classifyWebexRecordingTitle,
  getWebexTriggerPullConfig,
  listWebexRecordings,
  pullTriggeredWebexRecordings,
} from '../lib/mmc-webex-triggered-pull.mjs';
import { scanCoachingDropZone } from '../lib/mmc-coaching-import-worker.mjs';

const tmp = mkdtempSync(path.join(os.tmpdir(), 'mmc-webex-trigger-policy-'));

try {
  assert.equal(classifyWebexRecordingTitle('[MM-ADV] Dr Brian Advising').allowed, true);
  assert.equal(classifyWebexRecordingTitle('Dr Brian Advising').reason, 'missing_trigger');
  assert.equal(classifyWebexRecordingTitle('[MM-IGNORE] [MM-ADV] Test').reason, 'explicit_ignore_trigger');
  assert.equal(classifyWebexRecordingTitle('[MM-GRP] Group Advising').allowed, false);
  assert.equal(classifyWebexRecordingTitle('[MM-GRP] Group Advising', { allowedTriggers: ['[MM-GRP]'] }).allowed, true);

  const config = getWebexTriggerPullConfig({
    MMHQ_MMC_WEBEX_ACCESS_TOKEN: 'secret-token',
    MMHQ_MMC_WEBEX_ALLOWED_TRIGGERS: '[MM-ADV],[MM-GRP]',
    MMHQ_MMC_WEBEX_DROP_ZONE_PATH: tmp,
    MMHQ_MMC_WEBEX_PULL_ENABLED: 'true',
  });
  assert.equal(config.tokenConfigured, true);
  assert.equal(Object.values(config).includes('secret-token'), false);
  assert.deepEqual(config.allowedTriggers, ['[MM-ADV]', '[MM-GRP]']);

  const fetchLog = [];
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(String(url));
    fetchLog.push({ url: String(url), method: options.method || 'GET' });
    if (parsed.pathname === '/v1/recordings') {
      return jsonResponse({
        items: [
          { id: 'adv-1', topic: '[MM-ADV] Ignacio Anzola advising', meetingId: 'meeting-adv-1', createdTime: '2026-06-29T14:00:00Z' },
          { id: 'no-trigger', topic: 'Regular weekly recording', meetingId: 'meeting-2', createdTime: '2026-06-29T15:00:00Z' },
          { id: 'ignore-1', topic: '[MM-IGNORE] Internal staff huddle', meetingId: 'meeting-3', createdTime: '2026-06-29T16:00:00Z' },
          { id: 'group-1', topic: '[MM-GRP] Group session', meetingId: 'meeting-4', createdTime: '2026-06-29T17:00:00Z' },
        ],
      });
    }
    if (parsed.pathname === '/v1/recordings/adv-1') {
      return jsonResponse({
        id: 'adv-1',
        topic: '[MM-ADV] Ignacio Anzola advising',
        meetingId: 'meeting-adv-1',
        createdTime: '2026-06-29T14:00:00Z',
        temporaryDirectDownloadLinks: {
          videoFile: 'https://downloads.example.test/adv-1.mp4',
          transcriptFile: 'https://downloads.example.test/adv-1.vtt',
        },
      });
    }
    if (parsed.hostname === 'downloads.example.test' && parsed.pathname.endsWith('.mp4')) {
      return binaryResponse(Buffer.from('video-bytes'));
    }
    if (parsed.hostname === 'downloads.example.test' && parsed.pathname.endsWith('.vtt')) {
      return binaryResponse(Buffer.from('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nDr Brian: Great next step.\n'));
    }
    throw new Error(`Unexpected fetch ${url}`);
  };

  const inventory = await listWebexRecordings({
    env: { MMHQ_MMC_WEBEX_ACCESS_TOKEN: 'secret-token' },
    apiBase: 'https://webexapis.com/v1',
    fetchImpl,
    allowedTriggers: ['[MM-ADV]'],
  });
  assert.equal(inventory.status, 'VERIFIED');
  assert.equal(inventory.allowed.length, 1);
  assert.equal(inventory.ignored.length, 3);
  assert.equal(inventory.allowed[0].hasRecordingDownloadUrl, false);

  const pulled = await pullTriggeredWebexRecordings({
    env: {
      MMHQ_MMC_WEBEX_ACCESS_TOKEN: 'secret-token',
      MMHQ_MMC_WEBEX_PULL_ENABLED: 'true',
      MMHQ_MMC_WEBEX_DROP_ZONE_PATH: tmp,
    },
    apiBase: 'https://webexapis.com/v1',
    fetchImpl,
    allowedTriggers: ['[MM-ADV]'],
    dropZonePath: tmp,
    limit: 10,
  });
  assert.equal(pulled.status, 'VERIFIED');
  assert.equal(pulled.staged.length, 1);
  assert.equal(pulled.ignored.length, 3);
  assert.equal(pulled.staged[0].completePair, true);
  assert.equal(fetchLog.some((entry) => /no-trigger|ignore-1|group-1/u.test(entry.url)), false, 'Ignored recordings must not receive detail/download fetches.');

  const files = await readdir(tmp);
  assert.equal(files.some((name) => name.endsWith('.mp4')), true);
  assert.equal(files.some((name) => name.endsWith('.vtt')), true);
  assert.equal(files.some((name) => name.endsWith('.metadata.json')), true);
  assert.equal(files.some((name) => /no-trigger|ignore|group/iu.test(name)), false);

  const scan = scanCoachingDropZone({ dropZonePath: tmp, minStableAgeMs: 0, includeIncomplete: true });
  assert.equal(scan.status, 'VERIFIED');
  assert.equal(scan.candidates.length, 1);
  assert.equal(scan.protections.dailyDrillsWatcherStarted, false);
  assert.equal(scan.protections.videoRegistryWritten, false);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log('MMC-507 Webex trigger policy validation passed.');

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
