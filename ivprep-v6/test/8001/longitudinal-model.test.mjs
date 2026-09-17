import assert from 'node:assert/strict';
import test from 'node:test';

import { attemptSnapshot, buildLongitudinalModel, compareAttempts } from '../../public/studio/longitudinal-model.mjs';

const saved = ({ id, endedAt, questionId, duration = 8_000, level = -28, clipping = 0, maturity = 'VALIDATED_STUDENT_SAFE' }) => ({
  id, state: 'saved', endedAt, questionId, questionText: `Question ${questionId}`,
  recording: { durationMs: duration },
  results: { payload: { analytics: {
    modalities: { mic: { coverage: .9 }, camera: { coverage: .6 } },
    studentEvents: [
      { metric: 'answer_duration_ms', maturity, observation: { value: duration, unit: 'ms' } },
      { metric: 'captured_level_dbfs', maturity, observation: { value: level, unit: 'dBFS' } },
      { metric: 'digital_clipping_fraction', maturity, observation: { value: clipping, unit: 'fraction' } },
    ],
  } } },
});

test('builds honest progress totals from saved own-library attempts', () => {
  const model = buildLongitudinalModel([
    saved({ id: 'a', endedAt: '2026-09-15T10:00:00Z', questionId: 'Q1', duration: 10_000 }),
    saved({ id: 'b', endedAt: '2026-09-16T10:00:00Z', questionId: 'Q2', duration: 12_000 }),
    { id: 'c', state: 'abandoned', durationMs: 99_000 },
  ]);
  assert.deepEqual(model.totals, { savedSessions: 2, recordedMs: 22_000, activeDays: 2, uniqueQuestions: 2 });
  assert.deepEqual(model.attempts.map((entry) => entry.id), ['b', 'a']);
});

test('excludes non-student-safe events instead of manufacturing a metric', () => {
  const attempt = attemptSnapshot(saved({ id: 'a', endedAt: '2026-09-15T10:00:00Z', questionId: 'Q1', maturity: 'EXPERIMENTAL_FOUNDER_ONLY' }));
  assert.equal(attempt.metrics.answerDurationMs, null);
  assert.equal(attempt.metrics.capturedLevelDbfs, null);
  assert.equal(attempt.evidenceCount, 0);
});

test('pair comparison reports neutral signed deltas and missing evidence', () => {
  const first = attemptSnapshot(saved({ id: 'a', endedAt: '2026-09-15T10:00:00Z', questionId: 'Q1', duration: 10_000, level: -30 }));
  const second = attemptSnapshot(saved({ id: 'b', endedAt: '2026-09-16T10:00:00Z', questionId: 'Q1', duration: 12_500, level: -27 }));
  const comparison = compareAttempts(first, second);
  assert.equal(comparison.metrics.find((entry) => entry.key === 'answerDurationMs').delta, 2_500);
  assert.equal(comparison.metrics.find((entry) => entry.key === 'capturedLevelDbfs').delta, 3);
  assert.equal(compareAttempts(first, first), null);
});
