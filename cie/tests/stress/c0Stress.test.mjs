import assert from "node:assert/strict";
import test from "node:test";
import { createAuthorityAdapter } from "../../src/authority.mjs";
import { validateTrackItemInput } from "../../src/contracts.mjs";
import { FileCieRepository } from "../../src/repository/fileRepository.mjs";
import { MemoryCieRepository } from "../../src/repository/memoryRepository.mjs";
import { CieService } from "../../src/service.mjs";
import { observedClaim, sessionClock } from "../fixtures.mjs";
import { TEST_SUBJECTS, testUuid } from "../testIds.mjs";

const session = {
  id: testUuid(0x6001),
  owner_user_id: TEST_SUBJECTS.stressStudent,
  external_session_ref: "stress_external",
  mode_ref: "M1",
  media_revision_ref: "media_revision_1",
  clock: sessionClock,
  state: "DRAFT",
  row_version: 1,
  created_at: "2026-07-17T12:00:00.000Z"
};

test("10,000 versioned track items persist and range-query deterministically", async () => {
  const repository = new MemoryCieRepository();
  const total = 10_000;
  await repository.transaction(async (store) => {
    store.insertSession(session);
    for (let index = 0; index < total; index += 1) {
      store.appendTrackItem({
        track_item_id: `track_${String(index).padStart(5, "0")}`,
        item_revision: 1,
        supersedes_item_revision: null,
        event_seq: index + 1,
        session_id: session.id,
        owner_user_id: session.owner_user_id,
        kind: "event",
        t0_ms: index * 10,
        t1_ms: index * 10
      });
    }
  });
  assert.equal(repository.listTrackItems(session.id, { fromMs: 0, toMs: 100_000 }).length, total);
  const window = repository.listTrackItems(session.id, { fromMs: 50_000, toMs: 50_100 });
  assert.deepEqual(window.map((item) => item.event_seq), [5001, 5002, 5003, 5004, 5005, 5006, 5007, 5008, 5009, 5010]);
  assert.equal(new Set(repository.exportState().track_items.map((item) => item.event_seq)).size, total);
});

test("250 concurrent writes allocate unique sequences and survive retries exactly once", async () => {
  const repository = new MemoryCieRepository();
  let id = 0;
  const service = new CieService(repository, {
    now: () => new Date("2026-07-17T12:00:00.000Z"),
    uuid: () => testUuid(++id),
    consentPolicy: async () => ({ policy_version: "v1", policy_text_hash: "a".repeat(64), locale: "en-US", retention_policy_ref: "stress-retention" })
  });
  const authority = createAuthorityAdapter(async (value) => value, "cie-stress-authority");
  const auth = await authority.verify({ subject_id: TEST_SUBJECTS.stressStudent, role: "student", capabilities: [], authority_session_ref: "stress-auth-session" });
  const meta = (name) => ({ idempotencyKey: name, requestId: `request-${name}`, correlationId: "stress-correlation" });
  const created = await service.createSession(auth, { external_session_ref: "stress-cam", mode_ref: "M1", media_revision_ref: "media_revision_1", clock: sessionClock }, meta("create"));
  const consent = await service.recordConsent(auth, created.id, {
    purpose: "evidence_storage",
    granted: true,
    scope: { fixture: true }
  }, meta("consent"));
  const body = (index) => ({
    track_item_id: `concurrent_${index}`,
    item_revision: 1,
    supersedes_item_revision: null,
    segment_id: "segment_1",
    media_revision_ref: "media_revision_1",
    kind: "event",
    range_kind: "POINT",
    t0_ms: index,
    t1_ms: index,
    payload_schema_version: "cie.synthetic-event.v1",
    payload: { index },
    provenance: { ...observedClaim, statement: "Synthetic concurrent event." },
    visibility: "private",
    consent_receipt_ids: [consent.id]
  });
  const writes = await Promise.all(Array.from({ length: 250 }, (_, index) => service.appendTrackItem(auth, created.id, body(index), meta(`track-${index}`))));
  assert.equal(new Set(writes.map((item) => item.event_seq)).size, 250);
  assert.deepEqual(writes.map((item) => item.event_seq).sort((a, b) => a - b), Array.from({ length: 250 }, (_, index) => index + 1));

  const retryMeta = meta("retry-once");
  const first = await service.appendTrackItem(auth, created.id, body(500), retryMeta);
  const retries = await Promise.all(Array.from({ length: 50 }, () => service.appendTrackItem(auth, created.id, body(500), retryMeta)));
  assert.equal(retries.every((item) => item.content_hash === first.content_hash && item.event_seq === first.event_seq), true);
  assert.equal(repository.listTrackItems(created.id, { fromMs: 500, toMs: 501 }).filter((item) => item.track_item_id === "concurrent_500").length, 1);
});

test("malformed time ranges fail closed rather than coercing evidence", () => {
  const invalid = [
    [Number.NaN, 1],
    [-1, 1],
    [2, 1],
    [1.5, 2],
    [Number.MAX_SAFE_INTEGER + 1, Number.MAX_SAFE_INTEGER + 1]
  ];
  for (let iteration = 0; iteration < 500; iteration += 1) {
    const [t0, t1] = invalid[iteration % invalid.length];
    assert.throws(() => validateTrackItemInput({
      item_revision: 1,
      segment_id: "segment_1",
      media_revision_ref: "media_revision_1",
      kind: "event",
      range_kind: "SPAN",
      t0_ms: t0,
      t1_ms: t1,
      payload: {},
      provenance: observedClaim,
      visibility: "private"
    }, { authorRole: "student", sourceKind: "human" }));
  }
});

test("file persistence failure rolls the in-memory transaction back", async () => {
  const repository = new FileCieRepository("/dev/null/cie-state.json");
  await assert.rejects(repository.transaction(async (store) => store.insertSession(session)));
  assert.equal(repository.getSession(session.id), null);
});
