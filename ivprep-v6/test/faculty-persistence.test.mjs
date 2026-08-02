import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  FACULTY_ROSTER,
  VERIFIED_DEXTER_AVATAR_ID,
  publicFacultyRoster,
  surpriseAssignment,
} from '../config/faculty-roster.mjs';
import { AlphaStore, INACTIVE_COMMERCIALIZATION_CONTROLS } from '../persistence/alpha-store.mjs';

test('faculty roster contains all sixteen required honest categories', () => {
  assert.equal(FACULTY_ROSTER.length, 16);
  assert.equal(VERIFIED_DEXTER_AVATAR_ID, 'bd43ce31-7425-4379-8407-60f029548e61');
  assert.equal(FACULTY_ROSTER.filter((record) => record.avatarId).length, 1);
  assert.equal(FACULTY_ROSTER.filter((record) => record.id.startsWith('doc-hollywood')).every((record) => record.availability === 'custom-avatar-required'), true);
  assert.equal(FACULTY_ROSTER.filter((record) => record.id.startsWith('indian-faculty')).every((record) => /no accent is fabricated/i.test(record.founderOnlyNotes)), true);
});

test('provider readiness controls availability and Surprise Me eligibility', () => {
  assert.equal(publicFacultyRoster({ liveAvatarConfigured: false, openaiConfigured: true }).some((record) => record.available), false);
  const ready = publicFacultyRoster({ liveAvatarConfigured: true, openaiConfigured: true });
  assert.deepEqual(ready.filter((record) => record.available).map((record) => record.id), ['senior-academic-pd-male']);
  assert.equal(surpriseAssignment({ specialty: 'Internal Medicine', liveAvatarConfigured: true, openaiConfigured: true, random: () => 0 }).id, 'senior-academic-pd-male');
  assert.equal(surpriseAssignment({ specialty: 'Pediatrics', liveAvatarConfigured: true, openaiConfigured: true }), null);
});

test('durable alpha store enforces one active identity and the twenty-minute hard cap', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ivprep-alpha-store-'));
  const path = join(directory, 'sessions.json');
  let now = 1_000_000;
  const first = new AlphaStore({ path, now: () => now });
  const session = first.startSession({
    testIdentity: 'founder-test', durationMinutes: 99, selectedInterviewer: 'senior-academic-pd-male',
    model: 'gpt-5.6-terra', voice: 'cedar', avatar: VERIFIED_DEXTER_AVATAR_ID, behavior: 'direct-program-director', mode: 'voice-only',
  });
  assert.equal(session.durationMinutes, 20);
  assert.throws(() => first.startSession({ testIdentity: 'founder-test' }), /already has an active interview/);
  now += 5 * 60_000;
  first.appendEvent(session.id, { transcript: { question: 'Tell me about yourself.', answer: 'A concise answer.' }, modelUsage: { inputTokens: 12, outputTokens: 8 } });
  const ended = first.endSession(session.id, 'completed');
  assert.equal(ended.usage.estimatedMinutes, 5);
  assert.equal(ended.transcript.length, 1);
  assert.equal(ended.instructorRecord.length, 0);
  assert.doesNotMatch(readFileSync(path, 'utf8'), /livekit_client_token|session_token|api[_-]?key/i);
  const restarted = new AlphaStore({ path, now: () => now });
  assert.equal(restarted.getSession(session.id).terminationState, 'completed');
  assert.equal(restarted.usageLedger().length, 1);
});

test('emergency disable fails closed and commercialization controls remain inactive', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ivprep-alpha-disable-'));
  const store = new AlphaStore({ path: join(directory, 'sessions.json') });
  assert.equal(store.setDisabled(true), true);
  assert.throws(() => store.startSession({ testIdentity: 'founder-disabled' }), /globally disabled/);
  assert.equal(INACTIVE_COMMERCIALIZATION_CONTROLS.active, false);
  assert.equal(INACTIVE_COMMERCIALIZATION_CONTROLS.paidTopUps, false);
  assert.deepEqual(INACTIVE_COMMERCIALIZATION_CONTROLS.warnings, [75, 90, 100]);
});

test('fifteen-minute default, twenty-minute hard cap, concurrency, and restart usage remain durable', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ivprep-alpha-release-'));
  const path = join(directory, 'sessions.json');
  let now = 10_000_000;
  const store = new AlphaStore({ path, now: () => now });
  const defaultSession = store.startSession({
    testIdentity: 'synthetic-a', selectedInterviewer: 'senior-academic-pd-male', model: 'gpt-5.6-terra',
    voice: 'cedar', avatar: VERIFIED_DEXTER_AVATAR_ID, behavior: 'direct-program-director', mode: 'voice-only',
  });
  const concurrent = store.startSession({
    testIdentity: 'synthetic-b', durationMinutes: 20, selectedInterviewer: 'senior-academic-pd-male', model: 'gpt-5.6-terra',
    voice: 'cedar', avatar: VERIFIED_DEXTER_AVATAR_ID, behavior: 'direct-program-director', mode: 'voice-only',
  });
  assert.equal(defaultSession.durationMinutes, 15);
  assert.equal(concurrent.durationMinutes, 20);
  now += 20 * 60_000;
  assert.equal(store.getSession(defaultSession.id).terminationState, 'hard-cap');
  assert.equal(store.getSession(concurrent.id).terminationState, 'hard-cap');
  assert.deepEqual(store.usageLedger().map((entry) => entry.estimatedMinutes), [15, 20]);
  const restarted = new AlphaStore({ path, now: () => now });
  assert.equal(restarted.listSessions().length, 2);
  assert.equal(restarted.usageLedger().length, 2);
  assert.doesNotThrow(() => restarted.startSession({ testIdentity: 'synthetic-a' }));
});
