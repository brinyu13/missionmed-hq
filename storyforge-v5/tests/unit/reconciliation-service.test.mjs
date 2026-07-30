import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  ELIGIBLE_AGE_DAYS,
  INTENT_MAX_ATTEMPTS,
  LEASE_DURATION_MS,
  LEASE_RENEWAL_MS,
  MAX_DELETES_PER_RUN,
  MAX_PAGES_PER_RUN,
  PAGE_SIZE,
  STORYFORGE_PREFIXES,
  createReconciliationService,
  parseReconciliationKey,
  reconciliationCursorDigest,
} from '../../server/reconciliation.mjs';
import {
  RECONCILIATION_INTERVAL_MS,
  startReconciliationScheduler,
} from '../../server/reconciliation-scheduler.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const studentId = '11111111-1111-4111-8111-111111111111';
const storyId = '22222222-2222-4222-8222-222222222222';

function inertPool() {
  return { async query() { return { rows: [] }; } };
}

test('T4-05 short in-scope key is invalid', () => {
  assert.deepEqual(parseReconciliationKey('storyforge-audio/short'), {
    inScope: true,
    key: 'storyforge-audio/short',
    kind: 'storyforge-audio',
    studentRef: null,
    storyRef: null,
    refState: 'invalid_key',
  });
});

test('T4-06 storyforge-audio key extracts student and story references', () => {
  const key = `storyforge-audio/${studentId}/${storyId}/asset.webm`;
  assert.deepEqual(parseReconciliationKey(key), {
    inScope: true,
    key,
    kind: 'storyforge-audio',
    studentRef: studentId,
    storyRef: storyId,
    refState: null,
  });
});

test('T4-07 storyforge-rec key extracts student and keeps story null', () => {
  const key = `storyforge-rec/${studentId}/${storyId}/seg-00000.webm`;
  assert.deepEqual(parseReconciliationKey(key), {
    inScope: true,
    key,
    kind: 'storyforge-rec',
    studentRef: studentId,
    storyRef: null,
    refState: null,
  });
});

test('T4-08 out-of-scope key is explicitly skipped', () => {
  assert.deepEqual(parseReconciliationKey(`other/${studentId}/${storyId}/x`), {
    inScope: false,
    key: `other/${studentId}/${storyId}/x`,
  });
});

test('T3-12 cursor digest is empty or a 64-character SHA-256', () => {
  assert.equal(reconciliationCursorDigest(''), '');
  assert.match(reconciliationCursorDigest('storyforge-audio/example'), /^[a-f0-9]{64}$/);
});

test('T6-11 replica identity is unique per service boot', () => {
  const first = createReconciliationService({ pool: inertPool() });
  const second = createReconciliationService({ pool: inertPool() });
  assert.notEqual(first.replicaId, second.replicaId);
});

test('T6-12 lease SQL uses database now and no client wall clock', () => {
  const source = readFileSync(path.join(packageDir, 'server', 'reconciliation.mjs'), 'utf8');
  for (const fragment of [
    "lease_expires_at = now() + interval '30 minutes'",
    'lease_expires_at < now()',
    'lease_expires_at > now()',
  ]) {
    assert.match(source, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(source, /Date\.now\s*\(/);
});

test('T6-13 lease and reconciliation constants are fixed', () => {
  assert.equal(LEASE_DURATION_MS, 1_800_000);
  assert.equal(LEASE_RENEWAL_MS, 300_000);
  assert.equal(PAGE_SIZE, 1000);
  assert.equal(MAX_PAGES_PER_RUN, 5);
  assert.equal(MAX_DELETES_PER_RUN, 200);
  assert.equal(INTENT_MAX_ATTEMPTS, 3);
  assert.equal(ELIGIBLE_AGE_DAYS, 7);
  assert.deepEqual(STORYFORGE_PREFIXES, ['storyforge-audio/', 'storyforge-rec/']);
});

test('T6-15 replica count never selects safety behavior', () => {
  const source = readFileSync(path.join(packageDir, 'server', 'reconciliation.mjs'), 'utf8');
  assert.doesNotMatch(source, /replicaCount|replica_count|numberOfReplicas/);
  assert.match(source, /replica_id/);
});

test('T8-07 off mode does not create a timer', () => {
  let calls = 0;
  const scheduler = startReconciliationScheduler({ async run() {} }, {
    environment: { STORYFORGE_AUDIO_RECONCILIATION: 'off' },
    setIntervalFn() {
      calls += 1;
    },
  });
  assert.equal(scheduler.active, false);
  assert.equal(calls, 0);
});

test('T8-08 dry_run mode schedules the bounded weekly service', () => {
  let interval;
  const scheduler = startReconciliationScheduler({ async run() {} }, {
    environment: { STORYFORGE_AUDIO_RECONCILIATION: 'dry_run' },
    setIntervalFn(_operation, milliseconds) {
      interval = milliseconds;
      return { unref() {} };
    },
    clearIntervalFn() {},
  });
  assert.equal(scheduler.active, true);
  assert.equal(interval, RECONCILIATION_INTERVAL_MS);
});

test('T8-09 on mode schedules the bounded weekly service', () => {
  let scheduled = false;
  const scheduler = startReconciliationScheduler({ async run() {} }, {
    environment: { STORYFORGE_AUDIO_RECONCILIATION: 'on' },
    setIntervalFn() {
      scheduled = true;
      return { unref() {} };
    },
    clearIntervalFn() {},
  });
  assert.equal(scheduler.active, true);
  assert.equal(scheduled, true);
});

test('T8-15 weekly interval is fixed at exactly seven days', () => {
  assert.equal(RECONCILIATION_INTERVAL_MS, 7 * 24 * 60 * 60 * 1000);
});

test('T8-06 suspension prevents scheduling before any reconciliation call', () => {
  let called = false;
  const scheduler = startReconciliationScheduler({ async run() { called = true; } }, {
    environment: {
      STORYFORGE_AUDIO_RECONCILIATION: 'on',
      STORYFORGE_AUDIO_RECONCILIATION_SUSPENDED: 'maintenance',
    },
    setIntervalFn() {
      called = true;
    },
  });
  assert.equal(scheduler.active, false);
  assert.equal(called, false);
});
