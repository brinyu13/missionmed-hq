import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { sha256, stableJson } from "../src/canonical.mjs";
import { validateTrackItemInput } from "../src/contracts.mjs";
import { FileCieRepository } from "../src/repository/fileRepository.mjs";
import { MemoryCieRepository } from "../src/repository/memoryRepository.mjs";
import { observedClaim, sessionClock } from "./fixtures.mjs";
import { testUuid } from "./testIds.mjs";

const session = {
  id: testUuid(0x8001),
  owner_user_id: testUuid(0x8002),
  external_session_ref: "cam_rep_1",
  mode_ref: "M1",
  media_revision_ref: "media_revision_1",
  clock: sessionClock,
  contract_version: "cie.c0.v1",
  state: "DRAFT",
  created_at: "2026-07-17T12:00:00.000Z",
  row_version: 1
};

test("canonical hashing distinguishes hostile own keys without prototype mutation", () => {
  const hostile = JSON.parse('{"__proto__":{"polluted":true},"safe":1}');
  assert.notEqual(sha256(hostile), sha256({ safe: 1 }));
  assert.match(stableJson(hostile), /"__proto__"/u);
  assert.equal({}.polluted, undefined);
  assert.throws(() => stableJson({ invalid: Number.NaN }), /non-finite/u);
});

function track(overrides) {
  const validated = validateTrackItemInput({
    track_item_id: overrides.track_item_id,
    item_revision: overrides.item_revision,
    supersedes_item_revision: overrides.supersedes_item_revision,
    segment_id: "segment_1",
    media_revision_ref: "media_revision_1",
    kind: "event",
    range_kind: overrides.t0_ms === overrides.t1_ms ? "POINT" : "SPAN",
    t0_ms: overrides.t0_ms,
    t1_ms: overrides.t1_ms,
    payload_schema_version: "cie.test-event.v1",
    payload: { synthetic: true },
    provenance: observedClaim,
    visibility: "private",
    consent_receipt_ids: []
  }, { authorRole: "student", sourceKind: "human" });
  const base = {
    ...validated,
    owner_user_id: session.owner_user_id,
    session_id: session.id,
    event_seq: overrides.event_seq,
    author: { subject_id: session.owner_user_id, role: "student" },
    contract_version: "cie.track-item.v1",
    created_at: "2026-07-17T12:00:01.000Z"
  };
  return { ...base, content_hash: sha256(base) };
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
  const witnessPath = path.join(directory, "witness", "state.jsonl");
  try {
    const repository = await FileCieRepository.open(file, { witnessPath });
    await repository.transaction(async (store) => {
      store.insertSession(session);
      store.appendTrackItem(track({ track_item_id: "track_1", item_revision: 1, supersedes_item_revision: null, event_seq: 1, session_id: session.id, t0_ms: 0, t1_ms: 100 }));
    });
    const firstBytes = await readFile(file, "utf8");
    const reopened = await FileCieRepository.open(file, { witnessPath });
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
    owner_user_id: session.owner_user_id,
    operation: "create_moment",
    idempotency_key: "moment-op-1",
    request_hash: "a".repeat(64),
    state: "accepted",
    response: null
  };
  await repository.transaction(async (store) => {
    assert.equal(store.beginMutation(receipt).replay, false);
    store.completeMutation(session.owner_user_id, "create_moment", "moment-op-1", { id: "moment_1" }, session.id, "2026-07-17T12:00:01.000Z");
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

test("file repository rejects stale writers, tampering, and state rollback", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "cie-repository-fence-"));
  const file = path.join(directory, "state.json");
  const witnessPath = path.join(directory, "witness", "state.jsonl");
  try {
    const firstWriter = await FileCieRepository.open(file, { witnessPath });
    const staleWriter = await FileCieRepository.open(file, { witnessPath });
    await firstWriter.transaction(async (store) => store.insertSession(session));
    await assert.rejects(staleWriter.transaction(async () => undefined), { code: "FILE_REPOSITORY_STALE" });

    const generationOne = await readFile(file, "utf8");
    const generationOneAnchor = await readFile(`${file}.anchor`, "utf8");
    const current = await FileCieRepository.open(file, { witnessPath });
    await current.transaction(async (store) => store.appendTrackItem(track({ track_item_id: "track_fence", item_revision: 1, supersedes_item_revision: null, event_seq: 1, session_id: session.id, t0_ms: 0, t1_ms: 10 })));

    await writeFile(file, generationOne, "utf8");
    await assert.rejects(FileCieRepository.open(file, { witnessPath }), { code: "FILE_REPOSITORY_ROLLBACK_DETECTED" });
    await writeFile(`${file}.anchor`, generationOneAnchor, "utf8");
    await assert.rejects(FileCieRepository.open(file, { witnessPath }), { code: "FILE_REPOSITORY_ROLLBACK_DETECTED" });
    const envelope = JSON.parse(generationOne);
    envelope.state.sessions[0].mode_ref = "TAMPERED";
    await writeFile(file, `${JSON.stringify(envelope)}\n`, "utf8");
    await assert.rejects(FileCieRepository.open(file, { witnessPath }), { code: "FILE_REPOSITORY_TAMPERED" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("file repository recovers interrupted commits and dead writer locks", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "cie-repository-recovery-"));
  const file = path.join(directory, "state.json");
  const witnessPath = path.join(directory, "external-witness", "state.jsonl");
  try {
    const interrupted = await FileCieRepository.open(file, { witnessPath, faultInjectionStage: "state" });
    await assert.rejects(interrupted.transaction(async (store) => store.insertSession(session)), /Synthetic fault/u);
    const recovered = await FileCieRepository.open(file, { witnessPath });
    assert.equal(recovered.getSession(session.id).external_session_ref, session.external_session_ref);

    await writeFile(`${file}.lock`, "2147483647\n", { mode: 0o600 });
    await recovered.transaction(async (store) => {
      store.appendTrackItem(track({ track_item_id: "track_recovered", item_revision: 1, supersedes_item_revision: null, event_seq: 1, session_id: session.id, t0_ms: 0, t1_ms: 10 }));
    });
    assert.equal((await FileCieRepository.open(file, { witnessPath })).getTrackItem("track_recovered", 1).t1_ms, 10);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("file repository rejects hash-valid semantic corruption on restore", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "cie-repository-semantic-"));
  const file = path.join(directory, "state.json");
  const witnessPath = path.join(directory, "witness", "state.jsonl");
  try {
    const repository = await FileCieRepository.open(file, { witnessPath });
    await repository.transaction(async (store) => {
      store.insertSession(session);
      store.appendTrackItem(track({ track_item_id: "track_semantic", item_revision: 1, supersedes_item_revision: null, event_seq: 1, t0_ms: 0, t1_ms: 10 }));
    });
    const envelope = JSON.parse(await readFile(file, "utf8"));
    const anchor = JSON.parse(await readFile(`${file}.anchor`, "utf8"));
    const corrupted = envelope.state.track_items[0];
    corrupted.owner_user_id = testUuid(0x8fff);
    corrupted.event_seq = -7;
    const corruptedBody = { ...corrupted };
    delete corruptedBody.content_hash;
    corrupted.content_hash = sha256(corruptedBody);
    const unsignedEnvelope = { file_format: envelope.file_format, generation: envelope.generation, state: envelope.state };
    envelope.root_hash = sha256(unsignedEnvelope);
    anchor.root_hash = envelope.root_hash;
    const witness = JSON.parse((await readFile(witnessPath, "utf8")).trim());
    const witnessUnsigned = { ...witness, root_hash: envelope.root_hash };
    delete witnessUnsigned.entry_hash;
    const updatedWitness = { ...witnessUnsigned, entry_hash: sha256(witnessUnsigned) };
    await writeFile(file, `${JSON.stringify(envelope)}\n`, "utf8");
    await writeFile(`${file}.anchor`, `${JSON.stringify(anchor)}\n`, "utf8");
    await writeFile(witnessPath, `${JSON.stringify(updatedWitness)}\n`, "utf8");
    await assert.rejects(FileCieRepository.open(file, { witnessPath }), { code: "REPOSITORY_STATE_INVALID" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("repository restore rejects unknown persisted contract versions even when hashes are recomputed", async () => {
  const repository = new MemoryCieRepository();
  await repository.transaction(async (store) => {
    store.insertSession(session);
    store.appendTrackItem(track({ track_item_id: "track_version", item_revision: 1, supersedes_item_revision: null, event_seq: 1, t0_ms: 0, t1_ms: 10 }));
  });
  const state = repository.exportState();
  const corrupted = state.track_items[0];
  corrupted.contract_version = "evil.track-item.v99";
  const body = { ...corrupted };
  delete body.content_hash;
  corrupted.content_hash = sha256(body);
  assert.throws(() => new MemoryCieRepository(state), { code: "REPOSITORY_STATE_INVALID" });
});
