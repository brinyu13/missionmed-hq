import assert from 'node:assert/strict';
import test from 'node:test';

import { InterviewCalendarCapability } from '../../public/capabilities/calendar-context.mjs';

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test('Calendar projects only minimized interview context and removes owner URLs', async () => {
  const capability = new InterviewCalendarCapability({
    now: () => Date.parse('2026-09-20T12:00:00Z'),
    fetchImpl: async (url, init) => {
      assert.equal(url, '/api/scheduler/calendar-feed');
      assert.equal(init.credentials, 'same-origin');
      return response({ ok: true, data: { events: [{
        id: 'scheduler:appt-1', title: 'Residency mock with faculty', start_at: '2026-09-21T15:00:00Z',
        end_at: '2026-09-21T16:00:00Z', status: 'booked', meeting_provider: 'webex',
        meeting_url: 'https://webex.example/private', recording_url: 'https://webex.example/recording',
        meta_json: { student_email: 'must-not-cross@example.com' },
      }] } });
    },
  });
  const projection = await capability.studentCalendar();
  assert.equal(projection.eventCount, 1);
  assert.equal(projection.upcomingCount, 1);
  assert.deepEqual(projection.nextEvent, {
    id: 'scheduler:appt-1', title: 'Residency mock with faculty', startsAt: '2026-09-21T15:00:00Z',
    endsAt: '2026-09-21T16:00:00Z', status: 'booked', provider: 'webex',
    joinAvailable: true, recordingStatus: 'not_expected',
  });
  assert.doesNotMatch(JSON.stringify(projection), /webex\.example|student_email|must-not-cross/u);
});

test('Calendar reports a connected empty-upcoming state without fabricating an interview', async () => {
  const capability = new InterviewCalendarCapability({
    now: () => Date.parse('2026-09-20T12:00:00Z'),
    fetchImpl: async () => response({ ok: true, data: { events: [
      { id: 'past', title: 'Past mock', start_at: '2026-09-01T12:00:00Z', status: 'booked' },
      { id: 'canceled', title: 'Canceled', start_at: '2026-10-01T12:00:00Z', status: 'canceled' },
    ] } }),
  });
  assert.deepEqual(await capability.studentCalendar(), {
    schema: 'ivoc.calendar-context.v1', eventCount: 1, upcomingCount: 0, nextEvent: null,
  });
});

test('Calendar owner denial fails closed', async () => {
  const capability = new InterviewCalendarCapability({
    fetchImpl: async () => response({ ok: false, error: 'scheduler_student_required' }, 403),
  });
  await assert.rejects(capability.studentCalendar(), /scheduler_student_required/u);
});
