import assert from "node:assert/strict";
import test from "node:test";
import "fake-indexeddb/auto";

import { HybridIndexedDbAdapter } from "../matrix/hybrid-indexeddb-adapter.js";

function localRecord(id = "timeline_hybrid") {
  return {
    id,
    sequence: 1,
    document: {
      id,
      schemaVersion: "d1-timeline-document-409.1",
      studentOwnerId: "LOCAL_STUDENT_OWNER_PLACEHOLDER",
      programId: "program_internal_medicine",
      title: "Hybrid Timeline",
      theme: "keynote",
      revision: 0,
      events: [],
    },
  };
}

test("hybrid adapter saves locally without queuing remote work before consent", async () => {
  const states = [];
  const adapter = new HybridIndexedDbAdapter({
    name: `hybrid-local-${Date.now()}`,
    apiClient: { configured: false },
    programId: "program_internal_medicine",
    onStatus: (value) => states.push(value.state),
  });
  await adapter.open();
  const record = localRecord();
  await adapter.atomicPut([
    { store: "documents", key: record.id, value: record },
    { store: "checkpoints", key: "checkpoint_1", value: { id: "checkpoint_1", documentId: record.id, sequence: 1, reason: "AUTOSAVE" } },
  ]);
  assert.equal((await adapter.get("documents", record.id)).document.title, "Hybrid Timeline");
  assert.equal((await adapter.pending()).length, 0);
  const result = await adapter.flush();
  assert.equal(result.consentRequired, true);
  assert.equal(states.includes("REMOTE_CONSENT_REQUIRED"), true);
  adapter.close();
});

test("hybrid adapter creates remote document, coalesces checkpoints, and syncs named version", async () => {
  const calls = [];
  const apiClient = {
    configured: true,
    async createDocument(document) { calls.push(["create", document.id]); return { document: { revision: 0 } }; },
    async checkpoint(documentId, _deviceId, revision) { calls.push(["checkpoint", documentId, revision]); return {}; },
    async createVersion(documentId, revision, _snapshot, label) { calls.push(["version", documentId, revision, label]); return { revision: revision + 1 }; },
  };
  const adapter = new HybridIndexedDbAdapter({ name: `hybrid-sync-${Date.now()}`, apiClient, programId: "program_internal_medicine", remoteSyncConsent: true });
  await adapter.open();
  const first = localRecord();
  await adapter.atomicPut([{ store: "documents", key: first.id, value: first }]);
  await adapter.atomicPut([{ store: "documents", key: first.id, value: { ...first, sequence: 2 } }]);
  await adapter.put("versions", { id: "local_version", documentId: first.id, label: "Advisor version", createdAt: "2026-07-15T12:00:00Z", documentSnapshot: first.document });
  const result = await adapter.flush();
  assert.equal(result.pending, 0);
  assert.equal(calls.filter(([kind]) => kind === "create").length, 1);
  assert.equal(calls.filter(([kind]) => kind === "checkpoint").length, 1);
  assert.equal(calls.filter(([kind]) => kind === "version").length, 1);
  adapter.close();
});

test("hybrid adapter keeps revision conflict for explicit recovery", async () => {
  const apiClient = {
    configured: true,
    async createDocument() { return { document: { revision: 0 } }; },
    async checkpoint() { const error = new Error("conflict"); error.status = 409; error.code = "REVISION_CONFLICT"; throw error; },
  };
  const adapter = new HybridIndexedDbAdapter({ name: `hybrid-conflict-${Date.now()}`, apiClient, programId: "program_internal_medicine", remoteSyncConsent: true });
  await adapter.open();
  const record = localRecord();
  await adapter.atomicPut([{ store: "documents", key: record.id, value: record }]);
  const result = await adapter.flush();
  assert.equal(result.pending, 1);
  assert.equal((await adapter.pending())[0].status, "CONFLICT");
  const second = await adapter.flush();
  assert.equal(second.conflict, true);
  adapter.close();
});
