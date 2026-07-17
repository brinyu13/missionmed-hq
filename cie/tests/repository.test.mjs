import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { FileCieRepository } from "../src/repository/fileRepository.mjs";
import { MemoryCieRepository } from "../src/repository/memoryRepository.mjs";

const session = {
  id: "session_1",
  owner_user_id: "user_1",
  external_session_ref: "cam_rep_1",
  mode_ref: "M1",
  media_revision_ref: "media_revision_1",
  clock: { clock_id: "missionmed.cie.monotonic-session-clock", clock_version: 1 },
  created_at: "2026-07-17T12:00:00.000Z"
};

function track(overrides) {
  return {
    owner_user_id: session.owner_user_id,
    kind: "event",
    event_seq: 1,
    ...overrides
  };
}

test("memory transaction rolls back every partial write", async () => {
  const repository = new MemoryCieRepository();
  await assert.rejects(repository.transaction(async (store) => {
    store.insertSession(session);
    store.appendAudit({ id: "audit_1", session_id: session.id });
    throw new Error("fault after audit");
  }), /fault after audit/u);
  assert.equal(repository.getSession(session.id), null);
  assert.deepEqual(repository.listAudit(session.id), []);
});

test("track revisions are append-only, contiguous, and range ordered", async () => {
  const repository = new MemoryCieRepository();
  await repository.transaction(async (store) => {
    store.insertSession(session);
    store.appendTrackItem(track({ track_item_id: "track_b", item_revision: 1, supersedes_item_revision: null, event_seq: 1, session_id: session.id, t0_ms: 300, t1_ms: 500 }));
    store.appendTrackItem(track({ track_item_id: "track_a", item_revision: 1, supersedes_item_revision: null, event_seq: 2, session_id: session.id, t0_ms: 100, t1_ms: 200 }));
    store.appendTrackItem(track({ track_item_id: "track_a", item_revision: 2, supersedes_item_revision: 1, event_seq: 3, session_id: session.id, t0_ms: 100, t1_ms: 250 }));
  });
  assert.deepEqual(repository.listTrackItems(session.id, { fromMs: 0, toMs: 1000 }).map((item) => [item.track_item_id, item.item_revision]), [["track_a", 2], ["track_b", 1]]);
  await assert.rejects(repository.transaction(async (store) => {
    store.appendTrackItem(track({ track_item_id: "track_a", item_revision: 4, supersedes_item_revision: 3, event_seq: 4, session_id: session.id, t0_ms: 100, t1_ms: 250 }));
  }), { code: "TRACK_SUPERSESSION_MISSING" });
});

test("skill snapshot identity is immutable across retries", async () => {
  const repository = new MemoryCieRepository();
  const snapshot = { id: "snapshot_1", skill_id: "CIE-D4-ABA-001", skill_version: "v1.0", content_hash: "a".repeat(64) };
  await repository.transaction(async (store) => {
    store.insertSkillSnapshot(snapshot);
    const replay = store.insertSkillSnapshot({ ...snapshot, id: "snapshot_retry" });
    assert.equal(replay.id, snapshot.id);
  });
  await assert.rejects(repository.transaction(async (store) => {
    store.insertSkillSnapshot({ ...snapshot, id: "snapshot_conflict", content_hash: "b".repeat(64) });
  }), { code: "SNAPSHOT_VERSION_CONFLICT" });
});

test("file repository persists atomically and restores hash-stable records", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "cie-repository-"));
  const file = path.join(directory, "state.json");
  try {
    const repository = await FileCieRepository.open(file);
    await repository.transaction(async (store) => {
      store.insertSession(session);
      store.appendTrackItem(track({ track_item_id: "track_1", item_revision: 1, supersedes_item_revision: null, event_seq: 1, session_id: session.id, t0_ms: 0, t1_ms: 100 }));
    });
    const firstBytes = await readFile(file, "utf8");
    const reopened = await FileCieRepository.open(file);
    assert.deepEqual(reopened.getSession(session.id), session);
    await reopened.transaction(async () => undefined);
    assert.equal(await readFile(file, "utf8"), firstBytes);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("idempotency key replay returns the original response and rejects hash drift", async () => {
  const repository = new MemoryCieRepository();
  const receipt = {
    owner_user_id: "user_1",
    operation: "create_moment",
    idempotency_key: "moment-op-1",
    request_hash: "a".repeat(64),
    state: "accepted",
    response: null
  };
  await repository.transaction(async (store) => {
    assert.equal(store.beginMutation(receipt).replay, false);
    store.completeMutation("user_1", "create_moment", "moment-op-1", { id: "moment_1" });
  });
  await repository.transaction(async (store) => {
    const replay = store.beginMutation(receipt);
    assert.equal(replay.replay, true);
    assert.deepEqual(replay.response, { id: "moment_1" });
  });
  await assert.rejects(repository.transaction(async (store) => {
    store.beginMutation({ ...receipt, request_hash: "b".repeat(64) });
  }), { code: "IDEMPOTENCY_KEY_REUSED" });
});
