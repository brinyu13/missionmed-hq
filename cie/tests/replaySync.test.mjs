import assert from "node:assert/strict";
import test from "node:test";
import { createReplaySyncManifest, ReplaySyncController } from "../src/replaySync.mjs";
import { sessionClock } from "./fixtures.mjs";

function player(memberId, start = 0) {
  let current = start;
  let playing = false;
  return {
    memberId,
    play() { playing = true; },
    pause() { playing = false; },
    seek(value) { current = value; },
    currentTime() { return current; },
    set(value) { current = value; },
    get playing() { return playing; }
  };
}

test("replay synchronization coordinates independently authorized ranges within 100 ms", () => {
  const session = { id: "session_1", clock: sessionClock };
  const manifest = createReplaySyncManifest(session, [
    { member_id: "moment_a", segment_id: "segment_1", media_revision_ref: "media_revision_1", t0_ms: 1_000, t1_ms: 8_000, content_hash: "a".repeat(64) },
    { member_id: "moment_b", segment_id: "segment_1", media_revision_ref: "media_revision_1", t0_ms: 10_000, t1_ms: 15_000, content_hash: "b".repeat(64) }
  ]);
  const a = player("moment_a");
  const b = player("moment_b");
  const controller = new ReplaySyncController(manifest, [a, b], { toleranceMs: 100 });
  controller.seek(2_000);
  assert.equal(a.currentTime(), 3);
  assert.equal(b.currentTime(), 12);
  controller.play();
  a.set(4.2);
  b.set(13.05);
  controller.correctDrift("moment_a");
  assert.equal(b.currentTime(), 13.2);
  assert.ok(Math.abs((a.currentTime() - 1) - (b.currentTime() - 10)) <= 0.1);
  controller.pause();
  controller.seek(99_000);
  assert.equal(a.currentTime(), 8);
  assert.equal(b.currentTime(), 15);
  controller.close();
  assert.equal(controller.state, "CLOSED");
  assert.throws(() => controller.seek(0), { code: "REPLAY_STATE_INVALID" });
});

test("replay manifests reject duplicate members, cross-segment media, and mutable evidence", () => {
  const session = { id: "session_1", clock: sessionClock };
  assert.throws(() => createReplaySyncManifest(session, [
    { member_id: "same", segment_id: "segment_1", media_revision_ref: "media_revision_1", t0_ms: 0, t1_ms: 1_000, content_hash: "a".repeat(64) },
    { member_id: "same", segment_id: "segment_1", media_revision_ref: "media_revision_1", t0_ms: 2_000, t1_ms: 3_000, content_hash: "b".repeat(64) }
  ]), { code: "REPLAY_MEMBER_ID_INVALID" });
  assert.throws(() => createReplaySyncManifest(session, [
    { member_id: "moment", segment_id: "segment_1", media_revision_ref: "wrong", t0_ms: 0, t1_ms: 1_000, content_hash: "a".repeat(64) }
  ]), { code: "REPLAY_MEDIA_BINDING_INVALID" });
  assert.throws(() => createReplaySyncManifest(session, [
    { member_id: "moment", segment_id: "segment_1", media_revision_ref: "media_revision_1", t0_ms: 0, t1_ms: 1_000, content_hash: null }
  ]), { code: "REPLAY_EVIDENCE_HASH_INVALID" });
});
