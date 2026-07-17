import assert from "node:assert/strict";
import test from "node:test";
import { sha256 } from "../src/canonical.mjs";
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

test("replay synchronization coordinates independently authorized ranges within 100 ms", async () => {
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
  await controller.play();
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

test("replay synchronization rejects extra players and rolls back a failed group play", async () => {
  const session = { id: "session_1", clock: sessionClock };
  const manifest = createReplaySyncManifest(session, [
    { member_id: "moment_a", segment_id: "segment_1", media_revision_ref: "media_revision_1", t0_ms: 1_000, t1_ms: 8_000, content_hash: "a".repeat(64) },
    { member_id: "moment_b", segment_id: "segment_1", media_revision_ref: "media_revision_1", t0_ms: 10_000, t1_ms: 15_000, content_hash: "b".repeat(64) }
  ]);
  assert.throws(() => new ReplaySyncController(manifest, [player("moment_a"), player("moment_b"), player("extra")]), { code: "REPLAY_PLAYER_SET_INVALID" });

  const first = player("moment_a");
  const second = player("moment_b");
  second.play = () => Promise.reject(new Error("synthetic playback denial"));
  const controller = new ReplaySyncController(manifest, [first, second]);
  await assert.rejects(controller.play(), /synthetic playback denial/u);
  assert.equal(controller.state, "PAUSED");
  assert.equal(first.playing, false);

  first.set(0.1);
  second.play = () => undefined;
  await controller.play();
  controller.correctDrift("moment_a");
  assert.equal(first.currentTime(), 1);
  controller.pause();
});

test("replay start is single-flight and cannot resurrect a closed controller", async () => {
  const session = { id: "session_1", clock: sessionClock };
  const manifest = createReplaySyncManifest(session, [
    { member_id: "moment", segment_id: "segment_1", media_revision_ref: "media_revision_1", t0_ms: 0, t1_ms: 1_000, content_hash: "a".repeat(64) }
  ]);
  let releasePlay;
  let playCalls = 0;
  let pauseCalls = 0;
  const deferredPlayer = {
    memberId: "moment",
    play() {
      playCalls += 1;
      return new Promise((resolve) => { releasePlay = resolve; });
    },
    pause() { pauseCalls += 1; },
    seek() {},
    currentTime() { return 0; }
  };
  const controller = new ReplaySyncController(manifest, [deferredPlayer]);
  const firstPlay = controller.play();
  await Promise.resolve();
  assert.equal(controller.state, "STARTING");
  await assert.rejects(controller.play(), { code: "REPLAY_STATE_INVALID" });
  assert.equal(playCalls, 1);

  controller.close();
  assert.equal(controller.state, "CLOSED");
  releasePlay();
  await assert.rejects(firstPlay, { code: "REPLAY_OPERATION_CANCELLED" });
  assert.equal(controller.state, "CLOSED");
  assert.ok(pauseCalls >= 2);
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
  const manifest = createReplaySyncManifest(session, [
    { member_id: "moment", segment_id: "segment_1", media_revision_ref: "media_revision_1", t0_ms: 0, t1_ms: 1_000, content_hash: "a".repeat(64) }
  ]);
  assert.throws(() => new ReplaySyncController({ ...manifest, session_clock_hash: "b".repeat(64) }, [player("moment")]), { code: "REPLAY_MANIFEST_HASH_MISMATCH" });
  assert.throws(() => new ReplaySyncController({ ...manifest, contract_version: "cie.replay-sync-manifest.v2" }, [player("moment")]), { code: "REPLAY_MANIFEST_INVALID" });
  const invertedBody = {
    ...manifest,
    members: [{ ...manifest.members[0], media_t0_ms: 2_000, media_t1_ms: 1_000 }]
  };
  delete invertedBody.content_hash;
  const inverted = { ...invertedBody, content_hash: sha256(invertedBody) };
  assert.throws(() => new ReplaySyncController(inverted, [player("moment")]), { code: "REPLAY_MANIFEST_INVALID" });
});
