import assert from 'node:assert/strict';
import test from 'node:test';
import { allocateCandidateCapture, sealCandidateCapture, publicCaptureReceipt, recordingSealTimebase } from '../../ivoc/candidate-audio.mjs';

const parent = { id: 'parent', session_id: 'session', owner_subject: 'wp:42', status: 'uploading', recording_role: 'conversation' };
const session = { id: 'session', owner_subject: 'wp:42', state: 'active' };
const input = { parentRecordingId: 'parent', captureVersion: 'direct-mic-v1', mime: 'audio/webm;codecs=opus' };
const allocate = (overrides = {}) => allocateCandidateCapture({ input, parent, session, actor: 'wp:42', recordingId: 'child', allocatedAt: 'now', ...overrides });
const row = () => ({ id: 'child', session_id: 'session', parent_recording_id: 'parent', recording_role: 'candidate_audio', mime_type: input.mime, capture_receipt: allocate() });
const seal = { mime: input.mime, sizeBytes: 2048, durationMs: 9000,
  captureTiming: { recordingStartSessionMs: 300, recordingDurationMs: 9000, playableDurationMs: null, pausedSpans: [{ startMs: 400, endMs: 1000 }] } };

test('replay timebase is captured from first seal without inventing a legacy zero origin', () => {
  assert.equal(recordingSealTimebase(parent, { durationMs: 1000 }), null);
  const input = { recordingStartSessionMs: 500, recordingDurationMs: 1000, playableDurationMs: null,
    durationMs: 1000, pausedSpans: [{ startMs: 700, endMs: 900 }] };
  const map = recordingSealTimebase(parent, input);
  assert.equal(map.recordingId, parent.id); assert.equal(map.ownerSubject, parent.owner_subject);
  assert.equal(map.recordingStartSessionMs, 500);
  for (const patch of [{ recordingStartSessionMs: null }, { recordingDurationMs: -1 },
    { playableDurationMs: undefined }, { durationMs: 1 },
    { pausedSpans: [{ startMs: 499, endMs: 700 }] },
    { pausedSpans: [{ startMs: 1600, endMs: 1700 }] },
    { pausedSpans: [{ startMs: 700, endMs: 900 }, { startMs: 800, endMs: 1000 }] }]) {
    assert.throws(() => recordingSealTimebase(parent, { ...input, ...patch }));
  }
});

test('server capture custody is exact, private, and never claims verified attribution', () => {
  const receipt = allocate();
  assert.equal(receipt.analysisEligibility, 'UNVERIFIED');
  assert.equal(receipt.recordingId, 'child');
  const sealed = sealCandidateCapture(row(), seal, { sealedAt: 'later', etag: 'private-etag' });
  assert.equal(sealed.status, 'SEALED');
  assert.equal(sealed.analysisEligibility, 'UNVERIFIED');
  assert.equal(sealed.timing.clientAttested, true);
  assert.equal(publicCaptureReceipt(sealed).etag, undefined);
  assert.equal(publicCaptureReceipt(sealed).timing.recordingStartSessionMs, 300);
});
test('foreign, child, inactive, wrong-session and invalid MIME parents fail', () => {
  for (const overrides of [
    { actor: 'wp:7' }, { parent: { ...parent, owner_subject: 'wp:7' } },
    { parent: { ...parent, session_id: 'other' } }, { parent: { ...parent, recording_role: 'candidate_audio' } },
    { parent: { ...parent, status: 'error' } }, { session: { ...session, state: 'saved' } },
    { input: { ...input, mime: 'video/webm' } }, { input: { ...input, captureVersion: 'trusted-by-client' } },
  ]) assert.throws(() => allocate(overrides));
});
test('sealing rejects mutated identities, invalid and unordered timing before storage', () => {
  for (const invalidRow of [
    { ...row(), id: 'other' }, { ...row(), session_id: 'other' }, { ...row(), parent_recording_id: 'other' },
    { ...row(), capture_receipt: { ...allocate(), status: 'SEALED' } },
  ]) assert.throws(() => sealCandidateCapture(invalidRow, seal, {}));
  for (const patch of [
    { mime: 'video/webm' }, { sizeBytes: 0 }, { durationMs: 9001 },
    { captureTiming: { ...seal.captureTiming, recordingStartSessionMs: null } },
    { captureTiming: { ...seal.captureTiming, recordingDurationMs: 0 } },
    { captureTiming: { ...seal.captureTiming, pausedSpans: [{ startMs: 1, endMs: 2 }] } },
    { captureTiming: { ...seal.captureTiming, pausedSpans: [{ startMs: 400, endMs: 1000 }, { startMs: 500, endMs: 800 }] } },
  ]) assert.throws(() => sealCandidateCapture(row(), { ...seal, ...patch }, {}));
});
