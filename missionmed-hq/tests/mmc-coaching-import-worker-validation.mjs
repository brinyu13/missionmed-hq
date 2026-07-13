import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  getCoachingImportWorkerStatus,
  scanCoachingDropZone,
} from '../lib/mmc-coaching-import-worker.mjs';

const root = mkdtempSync(path.join(os.tmpdir(), 'mmc-coaching-worker-'));

try {
  const base = '2026-06-28__Amara_Okafor__Mentorship__S01';
  writeFileSync(path.join(root, `${base}.mp4`), 'fixture-video-bytes');
  writeFileSync(path.join(root, `${base}.vtt`), [
    'WEBVTT',
    '',
    '00:00:01.000 --> 00:00:04.000',
    'Dr Brian: Let us identify the next coaching move.',
  ].join('\n'));
  writeFileSync(path.join(root, `${base}.metadata.json`), JSON.stringify({
    mmc_student_id: 'amara',
    meeting_match_status: 'verified',
    auto_analyze: false,
  }));
  writeFileSync(path.join(root, '2026-06-28__No_Transcript__Mentorship__S02.mp4'), 'incomplete-video');

  const status = getCoachingImportWorkerStatus({
    dropZonePath: root,
    minStableAgeMs: 0,
  });
  assert.equal(status.status, 'VERIFIED');
  assert.equal(status.dropZone.exists, true);
  assert.equal(status.protections.dailyDrillsWatcherStarted, false);
  assert.equal(status.protections.videoRegistryWritten, false);

  const scan = scanCoachingDropZone({
    dropZonePath: root,
    minStableAgeMs: 0,
    includeIncomplete: true,
    limit: 10,
  });
  assert.equal(scan.status, 'VERIFIED');
  assert.equal(scan.candidates.length, 1);
  assert.equal(scan.incomplete.length, 1);
  assert.equal(scan.protections.dailyDrillsWatcherStarted, false);
  assert.equal(scan.protections.r2Touched, false);
  assert.equal(scan.protections.streamTouched, false);

  const candidate = scan.candidates[0];
  assert.equal(candidate.complete, true);
  assert.equal(candidate.sourceSystem, 'coaching_drop_zone');
  assert.equal(candidate.sourceId.length, 64);
  assert.equal(candidate.idempotencyKey, candidate.sourceId);
  assert.equal(candidate.parsedName.studentName, 'Amara Okafor');
  assert.equal(candidate.studentId, 'amara');
  assert.equal(candidate.meetingMatchStatus, 'verified');
  assert.equal(candidate.subjectMatchStatus, 'probable');
  assert.equal(candidate.video.stable, true);
  assert.equal(candidate.transcript.stable, true);
  assert.match(candidate.video.sha256, /^[0-9a-f]{64}$/u);
  assert.match(candidate.transcript.sha256, /^[0-9a-f]{64}$/u);
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log('MMC-502 coaching import worker validation passed.');
