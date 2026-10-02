import assert from 'node:assert/strict';
import test from 'node:test';

import { AccountRecordingController, putWithRetry } from '../../public/ivoc-standalone/app/recording.mjs';

class FakeRecorder extends EventTarget {
  static isTypeSupported() { return true; }
  constructor() { super(); this.state = 'inactive'; this.mimeType = 'video/webm'; }
  start() { this.state = 'recording'; }
  pause() { this.state = 'paused'; }
  resume() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    const data = new Event('dataavailable'); data.data = new Blob(['real-media-bytes'], { type: this.mimeType }); this.dispatchEvent(data);
    this.dispatchEvent(new Event('stop'));
  }
}

test('mic-only controller allocates separate artifact, seals bounded capture timing, deduplicates retry upload', async () => {
  const oldRecorder = globalThis.MediaRecorder; const oldFetch = globalThis.fetch;
  let now = 1000; let uploads = 0; let seals = 0; let allocation; let timing;
  class AudioRecorder extends FakeRecorder {
    constructor(stream, options) { super(); this.mimeType = options.mimeType; assert.equal(stream.getVideoTracks().length, 0); }
  }
  globalThis.MediaRecorder = AudioRecorder;
  globalThis.fetch = async () => { uploads += 1; return { ok: true }; };
  const receipt = { schema: 'ivoc.candidate-audio.v1', captureVersion: 'direct-mic-v1', status: 'ALLOCATED' };
  const api = { csrfToken: 'csrf', createRecording: () => { throw new Error('wrong-artifact'); },
    createCandidateAudio: async (session, input) => {
      allocation = { session, input };
      return { id: 'mic1', recordingRole: 'candidate_audio', parentRecordingId: 'video1', captureReceipt: receipt,
        uploadUrl: 'https://media.test/mic', uploadToken: 'token', uploadExpiresAtMs: Date.now() + 60000 };
    },
    sealRecording: async (id, input) => {
      seals += 1; timing = input.captureTiming;
      if (seals === 1) throw new Error('seal-offline');
      return { recording: { id, status: 'saved' }, captureReceipt: { ...receipt, status: 'SEALED',
        assurance: 'CLIENT_MIC_CAPTURE_DECLARATION', analysisEligibility: 'UNVERIFIED' } };
    } };
  try {
    const controller = new AccountRecordingController({ api, stream: {
      getVideoTracks: () => [], getAudioTracks: () => [{ kind: 'audio' }],
    }, sessionId: 's1', recordingRole: 'candidate_audio', parentRecordingId: 'video1',
      now: () => now, sessionNow: () => now - 900, probePlayableDuration: async () => 1950 });
    await controller.start();
    assert.equal(allocation.input.mime, 'audio/webm;codecs=opus');
    assert.equal(allocation.input.captureVersion, 'direct-mic-v1');
    now = 1500; controller.pause(); now = 2000; controller.resume(); now = 3500;
    await assert.rejects(controller.stopAndSeal(), /seal-offline/);
    const [a, b] = await Promise.all([controller.stopAndSeal(), controller.stopAndSeal()]);
    assert.equal(a, b); assert.equal(uploads, 1); assert.equal(seals, 2);
    assert.deepEqual(timing, { recordingStartSessionMs: 100, recordingDurationMs: 2000,
      playableDurationMs: 1950, pausedSpans: [{ startMs: 600, endMs: 1100 }] });
    assert.equal(a.captureReceipt.analysisEligibility, 'UNVERIFIED');
    await controller.stopAndSeal(); assert.equal(uploads, 1); assert.equal(seals, 2);
    controller.destroy(); assert.equal(controller.finalBlob, null);
  } finally { globalThis.MediaRecorder = oldRecorder; globalThis.fetch = oldFetch; }
});

test('candidate recorder rejects video/missing-parent/forged receipt before recording or upload', async () => {
  const oldRecorder = globalThis.MediaRecorder; globalThis.MediaRecorder = FakeRecorder;
  let allocations = 0;
  const api = { createCandidateAudio: async () => { allocations += 1; return { id: 'bad', recordingRole: 'conversation' }; } };
  try {
    for (const options of [{ parentRecordingId: null, videos: [] }, { parentRecordingId: 'p', videos: [{}] }]) {
      const controller = new AccountRecordingController({ api, sessionId: 's', recordingRole: 'candidate_audio',
        parentRecordingId: options.parentRecordingId, stream: { getVideoTracks: () => options.videos, getAudioTracks: () => [{}] } });
      await assert.rejects(controller.start(), /candidate_audio_stream_invalid/);
    }
    assert.equal(allocations, 0);
    const controller = new AccountRecordingController({ api, sessionId: 's', recordingRole: 'candidate_audio',
      parentRecordingId: 'p', stream: { getVideoTracks: () => [], getAudioTracks: () => [{}] } });
    await assert.rejects(controller.start(), /candidate_audio_receipt_invalid/);
    assert.equal(controller.recorder, null);
  } finally { globalThis.MediaRecorder = oldRecorder; }
});

test('a hung private upload request fails into the retained retry path instead of waiting forever', async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => new Promise(() => {});
  try {
    await assert.rejects(
      putWithRetry('https://media.test/upload', new Blob(['real-media-bytes']), {
        attempts: 1,
        requestTimeoutMs: 5,
        csrfToken: 'csrf-token',
        uploadToken: 'token',
        uploadExpiresAtMs: Date.now() + 60_000,
      }),
      /recording_upload_timeout/u,
    );
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('recording state machine saves, preserves pause spans, and seals account media', async () => {
  const oldRecorder = globalThis.MediaRecorder;
  const oldFetch = globalThis.fetch;
  const uploads = [];
  globalThis.MediaRecorder = FakeRecorder;
  globalThis.fetch = async (url, options) => { uploads.push({ url, options }); return { ok: true }; };
  let seal = null;
  const api = {
    csrfToken: 'csrf-token',
    createRecording: async () => ({ id: 'r1', uploadUrl: 'https://media.test/upload', uploadToken: 'token', uploadExpiresAtMs: Date.now() + 60_000 }),
    sealRecording: async (_id, body) => { seal = body; return { recording: { id: 'r1', status: 'saved' } }; },
  };
  try {
    const controller = new AccountRecordingController({ api, stream: {}, sessionId: 's1', enabled: true });
    assert.equal(await controller.start(), true);
    assert.equal(controller.state, 'RECORDING');
    assert.equal(controller.pause(), true);
    assert.equal(controller.state, 'PAUSED');
    assert.equal(controller.resume(), true);
    const result = await controller.stopAndSeal();
    assert.equal(controller.state, 'SAVED');
    assert.equal(result.recording.id, 'r1');
    assert.equal(seal.uploadToken, 'token');
    assert.equal(seal.pausedSpans.length, 1);
    assert.ok(seal.sizeBytes > 0);
    assert.equal(uploads.length, 1);
    assert.equal(uploads[0].url, 'https://media.test/upload?part=1&parts=1');
    assert.equal(uploads[0].options.headers['Content-Type'], 'application/octet-stream');
    assert.equal(uploads[0].options.headers['Content-Range'], `bytes 0-${seal.sizeBytes - 1}/${seal.sizeBytes}`);
    assert.equal(uploads[0].options.headers['X-MMHQ-CSRF'], 'csrf-token');
    assert.equal(uploads[0].options.headers['X-IVOC-Upload-Token'], 'token');
  } finally {
    globalThis.MediaRecorder = oldRecorder;
    globalThis.fetch = oldFetch;
  }
});

test('recording duration freezes at stop and excludes pause and upload latency', async () => {
  const oldRecorder = globalThis.MediaRecorder;
  const oldFetch = globalThis.fetch;
  let now = 0;
  let releaseUpload;
  globalThis.MediaRecorder = FakeRecorder;
  globalThis.fetch = async () => new Promise((resolve) => { releaseUpload = () => resolve({ ok: true }); });
  let seal = null;
  const api = {
    csrfToken: 'csrf-token',
    createRecording: async () => ({ id: 'r2', uploadUrl: 'https://media.test/upload', uploadToken: 'token', uploadExpiresAtMs: Date.now() + 60_000 }),
    sealRecording: async (_id, body) => { seal = body; return { recording: { id: 'r2', status: 'saved', durationMs: body.durationMs } }; },
  };
  try {
    const controller = new AccountRecordingController({ api, stream: {}, sessionId: 's2', enabled: true, now: () => now });
    await controller.start();
    now = 5_000;
    controller.pause();
    now = 8_000;
    controller.resume();
    now = 12_000;
    const pending = controller.stopAndSeal();
    await Promise.resolve();
    now = 112_000;
    releaseUpload();
    const result = await pending;
    assert.equal(seal.durationMs, 9_000);
    assert.equal(result.durationMs, 9_000);
    assert.deepEqual(seal.pausedSpans, [{ startMs: 5_000, endMs: 8_000 }]);
    assert.equal(controller.snapshot().elapsedMs, 9_000);
  } finally {
    globalThis.MediaRecorder = oldRecorder;
    globalThis.fetch = oldFetch;
  }
});

test('recording emits session-relative timebase and prefers probed playable duration', async () => {
  const oldRecorder = globalThis.MediaRecorder;
  const oldFetch = globalThis.fetch;
  let now = 1_000;
  let sessionNow = 4_000;
  globalThis.MediaRecorder = FakeRecorder;
  globalThis.fetch = async () => ({ ok: true });
  let seal = null;
  const api = {
    csrfToken: 'csrf-token',
    createRecording: async () => ({ id: 'r3', uploadUrl: 'https://media.test/upload', uploadToken: 'token', uploadExpiresAtMs: Date.now() + 60_000 }),
    sealRecording: async (_id, body) => { seal = body; return { recording: { id: 'r3', status: 'saved', durationMs: body.durationMs } }; },
  };
  try {
    const controller = new AccountRecordingController({
      api,
      stream: {},
      sessionId: 's3',
      enabled: true,
      now: () => now,
      sessionNow: () => sessionNow,
      probePlayableDuration: async () => 8_750,
    });
    await controller.start();
    assert.equal(controller.snapshot().recordingStartSessionMs, 4_000);
    now = 6_000;
    sessionNow = 9_000;
    controller.pause();
    now = 8_000;
    sessionNow = 11_000;
    controller.resume();
    now = 12_000;
    sessionNow = 15_000;
    const result = await controller.stopAndSeal();
    assert.equal(result.recordingDurationMs, 9_000);
    assert.equal(result.playableDurationMs, 8_750);
    assert.equal(result.durationMs, 8_750);
    assert.equal(result.recordingStartSessionMs, 4_000);
    assert.deepEqual(result.pausedSpans, [{ startMs: 9_000, endMs: 11_000 }]);
    assert.deepEqual(seal.timebase, {
      canonical: 'session',
      recordingStartSessionMs: 4_000,
      pausedSpans: [{ startMs: 9_000, endMs: 11_000 }],
    });
    assert.equal(seal.recordingDurationMs, 9_000);
    assert.equal(seal.playableDurationMs, 8_750);
    assert.equal(seal.durationMs, 8_750);
  } finally {
    globalThis.MediaRecorder = oldRecorder;
    globalThis.fetch = oldFetch;
  }
});

test('playable-duration probing fails soft and retains stopwatch duration', async () => {
  const oldRecorder = globalThis.MediaRecorder;
  const oldFetch = globalThis.fetch;
  let now = 0;
  globalThis.MediaRecorder = FakeRecorder;
  globalThis.fetch = async () => ({ ok: true });
  let seal = null;
  const api = {
    csrfToken: 'csrf-token',
    createRecording: async () => ({ id: 'r4', uploadUrl: 'https://media.test/upload', uploadToken: 'token', uploadExpiresAtMs: Date.now() + 60_000 }),
    sealRecording: async (_id, body) => { seal = body; return { recording: { id: 'r4', status: 'saved' } }; },
  };
  try {
    const controller = new AccountRecordingController({
      api,
      stream: {},
      sessionId: 's4',
      enabled: true,
      now: () => now,
      probePlayableDuration: async () => { throw new Error('metadata_unavailable'); },
    });
    await controller.start();
    now = 4_500;
    const result = await controller.stopAndSeal();
    assert.equal(result.durationMs, 4_500);
    assert.equal(result.recordingDurationMs, 4_500);
    assert.equal(result.playableDurationMs, null);
    assert.equal(seal.durationMs, 4_500);
  } finally {
    globalThis.MediaRecorder = oldRecorder;
    globalThis.fetch = oldFetch;
  }
});
