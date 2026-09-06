import test from 'node:test';
import assert from 'node:assert/strict';
import { ZoomAttendanceProvider, createCycleBoundZoomClassifier } from '../src/domain/zoom-provider.mjs';
import { ZoomS2SClient, parseZoomMeetingRules } from '../src/providers/zoom-s2s-client.mjs';

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

test('cycle-bound Zoom classification applies the approved Drills rule in Eastern time', async () => {
  const classify = createCycleBoundZoomClassifier({
    cycleProvider: async () => [{ key: 'cycle-1', starts_on: '2026-09-01', ends_on: '2026-09-30' }],
  });
  assert.deepEqual(await classify({
    provider_meeting_id: '12345678901',
    provider_instance_id: 'instance-1',
    starts_at: '2026-09-01T15:45:00Z',
    step: 's1',
    participant_count: 16,
  }), {
    cycleKey: 'cycle-1',
    providerMeetingId: '12345678901',
    providerInstanceId: 'instance-1',
    startsAt: '2026-09-01T15:45:00.000Z',
    heldOn: '2026-09-01',
    timeZone: 'America/New_York',
    step: 's1',
    state: 'confirmed',
    classification: {
      rule: 'weekday_11_45_to_16_00_et_and_participants_over_15_ignore_duration',
      participant_count: 16,
      failed_parameters: [],
    },
  });
  const nearMiss = await classify({
    provider_meeting_id: '12345678901',
    provider_instance_id: 'instance-near-miss',
    starts_at: '2026-09-01T15:44:00Z',
    step: 's1',
    participant_count: 15,
  });
  assert.equal(nearMiss.state, 'needs_review');
  assert.deepEqual(nearMiss.classification.failed_parameters, [
    'before_11_45_et',
    'participant_count_not_over_15',
  ]);
  assert.equal(await classify({
    provider_meeting_id: '12345678901',
    provider_instance_id: 'instance-2',
    starts_at: '2026-10-02T16:00:00Z',
    step: 's1',
  }), null);
});

test('Zoom S2S client allowlists meeting IDs, paginates reports, and caches the scoped token', async () => {
  const calls = [];
  const json = body => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  const fetchImpl = async (input, options = {}) => {
    const url = String(input);
    calls.push({ url, options });
    if (url === 'https://zoom.us/oauth/token') {
      assert.match(String(options.headers.authorization), /^Basic /);
      assert.equal(String(options.body), 'grant_type=account_credentials&account_id=zoom-account');
      return json({
        access_token: 'short-lived-private-token',
        token_type: 'bearer',
        expires_in: 3600,
        scope: 'report:read:user:admin report:read:list_meeting_participants:admin',
        api_url: 'https://api.zoom.us',
      });
    }
    const parsed = new URL(url);
    assert.equal(options.headers.authorization, 'Bearer short-lived-private-token');
    if (parsed.pathname === '/v2/report/users/host-user-id/meetings' && !parsed.searchParams.get('next_page_token')) {
      assert.equal(parsed.searchParams.get('page_size'), '300');
      return json({
        meetings: [{
          meeting_id: 12345678901,
          meeting_uuid: '/allowed-instance',
          meeting_start_time: '2026-09-01T16:00:00Z',
          meeting_topic: 'Drills',
          participants: 24,
        }],
        next_page_token: 'meeting-page-2',
      });
    }
    if (parsed.pathname === '/v2/report/users/host-user-id/meetings') {
      assert.equal(parsed.searchParams.get('next_page_token'), 'meeting-page-2');
      return json({
        meetings: [{
          meeting_id: 10999999999,
          meeting_uuid: 'unrelated-instance',
          meeting_start_time: '2026-09-01T18:00:00Z',
          meeting_topic: 'Unrelated meeting',
          participants: 40,
        }, {
          meeting_id: 12345678901,
          meeting_uuid: 'exclusive-window-end',
          meeting_start_time: '2026-09-02T00:00:00Z',
          meeting_topic: 'Next window',
          participants: 22,
        }],
        next_page_token: '',
      });
    }
    if (parsed.pathname === '/v2/report/meetings/%252Fallowed-instance/participants' && !parsed.searchParams.get('next_page_token')) {
      return json({
        participants: [{
          participant_user_id: 'zoom-user-1', name: 'Student One', email: 'student@example.test',
          join_time: '2026-09-01T16:01:00Z', leave_time: '2026-09-01T17:00:00Z', duration: 3540,
        }],
        next_page_token: 'participant-page-2',
      });
    }
    if (parsed.pathname === '/v2/report/meetings/%252Fallowed-instance/participants') {
      return json({
        participants: [{
          participant_user_id: '', name: '', email: '',
          join_time: '2026-09-01T16:03:00Z', leave_time: '2026-09-01T16:50:00Z', duration: 2820,
        }],
        next_page_token: '',
      });
    }
    throw new Error(`Unexpected Zoom test URL: ${url}`);
  };
  const client = new ZoomS2SClient({
    accountId: 'zoom-account',
    clientId: 'zoom-client',
    clientSecret: 'zoom-secret',
    hostUserId: 'host-user-id',
    meetingRules: parseZoomMeetingRules('[{"meeting_id":"12345678901","step":"s1"}]'),
    fetchImpl,
    now: () => new Date('2026-09-02T12:00:00Z'),
  });
  const meetings = await client.listCompletedMeetings({
    from: '2026-09-01T00:00:00Z',
    to: '2026-09-02T00:00:00Z',
  });
  assert.equal(meetings.length, 1);
  assert.equal(meetings[0].provider_meeting_id, '12345678901');
  assert.equal(meetings[0].step, 's1');
  const participants = await client.listParticipants({ meeting: meetings[0] });
  assert.equal(participants.length, 2);
  assert.equal(participants[0].participant_source_id, 'zoom-user-1');
  assert.equal(participants[1].display_name, 'Unidentified Zoom attendee');
  assert.match(participants[0].provider_source_id, /^zoom:[0-9a-f]{64}$/);
  assert.equal(calls.filter(call => call.url === 'https://zoom.us/oauth/token').length, 1);
});

test('Zoom S2S client fails closed on missing report scopes, untrusted API origins, and unsafe rules', async () => {
  assert.throws(() => parseZoomMeetingRules('not-json'), /rules JSON is invalid/i);
  assert.throws(() => parseZoomMeetingRules('[{"meeting_id":"123","step":"s1"}]'), /numeric meeting_id/i);
  const create = tokenBody => new ZoomS2SClient({
    accountId: 'account', clientId: 'client', clientSecret: 'secret', hostUserId: 'host',
    meetingRules: [{ meeting_id: '12345678901', step: 's1' }],
    fetchImpl: async () => new Response(JSON.stringify(tokenBody), { status: 200 }),
  });
  await assert.rejects(
    create({ access_token: 'token', expires_in: 3600, scope: 'user:read:admin', api_url: 'https://api.zoom.us' }).listCompletedMeetings({ from: '2026-09-01', to: '2026-09-01' }),
    /missing the required meeting-report scopes/i,
  );
  await assert.rejects(
    create({ access_token: 'token', expires_in: 3600, scope: 'report:read:admin', api_url: 'https://attacker.invalid' }).listCompletedMeetings({ from: '2026-09-01', to: '2026-09-01' }),
    /untrusted API origin/i,
  );
});
