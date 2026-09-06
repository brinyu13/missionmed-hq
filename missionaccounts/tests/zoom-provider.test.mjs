import test from 'node:test';
import assert from 'node:assert/strict';
import { ZoomAttendanceProvider } from '../src/domain/zoom-provider.mjs';

test('ZoomAttendanceProvider fails closed without an explicitly configured client', async () => {
  const provider = new ZoomAttendanceProvider();
  assert.equal(provider.isConfigured(), false);
  assert.throws(() => provider.assertConfigured(), /not configured/i);
  await assert.rejects(
    provider.ingestWindow({ from: '2026-09-01T00:00:00Z', to: '2026-09-02T00:00:00Z' }),
    /not configured/i,
  );
});

test('ZoomAttendanceProvider emits normalized source evidence without identity or billing decisions', async () => {
  const meeting = {
    provider_meeting_id: 'zoom-meeting-1',
    provider_instance_id: 'zoom-instance-1',
    cycle_key: '2026-cycle-3',
    starts_at: '2026-09-01T16:00:00Z',
    held_on: '2026-09-01',
    time_zone: 'America/New_York',
    step: 's1',
    state: 'candidate',
    topic: 'Provider-owned raw meeting title',
  };
  const participant = {
    provider_source_id: 'zoom-row-1',
    participant_source_id: 'zoom-participant-1',
    display_name: 'Unresolved attendee',
    joined_at: '2026-09-01T16:01:00Z',
    left_at: '2026-09-01T17:00:00Z',
    duration_seconds: 3540,
  };
  const provider = new ZoomAttendanceProvider({
    mode: 'configured',
    now: () => new Date('2026-09-02T12:00:00Z'),
    client: {
      async listCompletedMeetings({ from, to }) {
        assert.equal(from, '2026-09-01T00:00:00.000Z');
        assert.equal(to, '2026-09-02T00:00:00.000Z');
        return [meeting];
      },
      async listParticipants({ meeting: received }) {
        assert.equal(received, meeting);
        return [participant];
      },
    },
  });
  assert.equal(provider.isConfigured(), true);
  const result = await provider.ingestWindow({
    from: '2026-09-01T00:00:00Z',
    to: '2026-09-02T00:00:00Z',
  });
  assert.equal(result.state, 'ready_to_persist');
  assert.deepEqual(result.stats, { completed_meetings: 1, classified_sessions: 1, source_rows: 1 });
  assert.equal(result.sessions[0].provider_instance_id, 'zoom-instance-1');
  assert.equal(result.source_rows[0].provider_source_id, 'zoom-row-1');
  assert.match(result.source_rows[0].payload_sha256, /^[0-9a-f]{64}$/);
  assert.match(result.artifact.sha256, /^[0-9a-f]{64}$/);
  assert.equal(Object.hasOwn(result.source_rows[0], 'student_id'), false);
  assert.equal(Object.hasOwn(result, 'attendance_events'), false);
  assert.equal(Object.hasOwn(result, 'charges'), false);
});

test('ZoomAttendanceProvider rejects an oversized window and duplicate provider rows', async () => {
  const duplicateProvider = new ZoomAttendanceProvider({
    mode: 'configured',
    client: {
      async listCompletedMeetings() {
        return [
          { cycle_key: '2026-cycle-3', provider_meeting_id: 'm1', provider_instance_id: 'i1', starts_at: '2026-09-01T16:00:00Z', held_on: '2026-09-01' },
          { cycle_key: '2026-cycle-3', provider_meeting_id: 'm2', provider_instance_id: 'i2', starts_at: '2026-09-02T16:00:00Z', held_on: '2026-09-02' },
        ];
      },
      async listParticipants() {
        return [{ provider_source_id: 'duplicate-row', display_name: 'Unresolved attendee' }];
      },
    },
  });
  await assert.rejects(
    duplicateProvider.ingestWindow({ from: '2026-09-01T00:00:00Z', to: '2026-10-03T00:00:00Z' }),
    /no longer than 31 days/i,
  );
  await assert.rejects(
    duplicateProvider.ingestWindow({ from: '2026-09-01T00:00:00Z', to: '2026-09-03T00:00:00Z' }),
    /duplicate provider source rows/i,
  );
});
