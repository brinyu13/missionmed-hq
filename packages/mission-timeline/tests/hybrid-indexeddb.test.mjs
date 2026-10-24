import assert from "node:assert/strict";
import test from "node:test";
import "fake-indexeddb/auto";

import {
  HybridIndexedDbAdapter,
  REMOTE_DOCUMENT_SCHEMA,
  toRemoteTimelineDocument,
} from "../matrix/hybrid-indexeddb-adapter.js";

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
  assert.equal(calls.filter(([kind]) => kind === "version").length, 1);
  assert.equal(calls.find(([kind]) => kind === "version")[2], 0);
  adapter.close();
});

test("hybrid adapter translates the browser schema at the remote boundary without mutating the local draft", async () => {
  const calls = [];
  const apiClient = {
    configured: true,
    async createDocument(document) {
      calls.push(["create", structuredClone(document)]);
      return { document: { revision: 0 } };
    },
    async createVersion(_documentId, revision, snapshot) {
      calls.push(["version", structuredClone(snapshot)]);
      return { revision: revision + 1 };
    },
  };
  const adapter = new HybridIndexedDbAdapter({
    name: `hybrid-schema-bridge-${Date.now()}`,
    apiClient,
    programId: "program_internal_medicine",
    remoteSyncConsent: true,
  });
  await adapter.open();
  const local = localRecord("timeline_schema_bridge");
  local.document.schemaVersion = "d1-uxr-002.1";
  delete local.document.studentOwnerId;
  delete local.document.programId;
  delete local.document.revision;
  local.document.theme = "keynote-classic";
  local.document.events = [{
    id: "event_work",
    title: "Clinical work",
    categoryId: "work",
    eventType: "duration",
    startDate: "2024-01",
    endDate: "2024-08",
    visibilityState: "INTERVIEWER_SAFE",
    fields: { preserved: true },
  }];
  local.document.studentProfile = { fullName: "Local Student" };
  local.document.metadata = { source: "D1-UXR-002", localOnly: true };
  local.document.browserOnlyField = { preserved: true };
  const originalBrowserDocument = structuredClone(local.document);
  await adapter.atomicPut([{ store: "documents", key: local.id, value: local }]);
  await adapter.put("versions", {
    id: "local_schema_version",
    documentId: local.id,
    label: "Schema bridge proof",
    createdAt: "2026-08-02T12:00:00Z",
    documentSnapshot: local.document,
  });
  const result = await adapter.flush();
  assert.equal(result.pending, 0);
  assert.deepEqual((await adapter.get("documents", local.id)).document, originalBrowserDocument);
  assert.equal(calls.length, 2);
  calls.forEach(([kind, document]) => {
    assert.equal(document.schemaVersion, REMOTE_DOCUMENT_SCHEMA);
    assert.deepEqual(document.browserOnlyField, { preserved: true });
    assert.deepEqual(document.events, local.document.events);
    assert.deepEqual(document.studentProfile, local.document.studentProfile);
    assert.deepEqual(document.metadata, local.document.metadata);
    assert.equal(Object.hasOwn(document, "studentOwnerId"), false);
    assert.equal(Object.hasOwn(document, "programId"), false);
    assert.equal(Object.hasOwn(document, "revision"), kind === "create" ? false : true);
  });
  adapter.close();
});

test("hybrid adapter leaves unsupported schemas queued as explicit errors without an API call", async () => {
  let calls = 0;
  const apiClient = {
    configured: true,
    async createDocument() { calls += 1; return { document: { revision: 0 } }; },
    async checkpoint() { calls += 1; return {}; },
  };
  const adapter = new HybridIndexedDbAdapter({
    name: `hybrid-schema-reject-${Date.now()}`,
    apiClient,
    programId: "program_internal_medicine",
    remoteSyncConsent: true,
  });
  await adapter.open();
  const local = localRecord("timeline_schema_reject");
  local.document.schemaVersion = "future-unknown.1";
  await adapter.atomicPut([{ store: "documents", key: local.id, value: local }]);
  const result = await adapter.flush();
  assert.equal(result.synced, 0);
  assert.equal(result.pending, 1);
  assert.equal(calls, 0);
  const [record] = await adapter.pending();
  assert.equal(record.status, "ERROR");
  assert.equal(record.errorCode, "DOCUMENT_SCHEMA_UNSUPPORTED");
  adapter.close();
});

test("remote schema translation rejects a missing document and preserves already-canonical snapshots", () => {
  assert.throws(
    () => toRemoteTimelineDocument(null),
    (error) => error.code === "REMOTE_DOCUMENT_REQUIRED",
  );
  const canonical = localRecord("timeline_canonical_bridge").document;
  const translated = toRemoteTimelineDocument(canonical);
  assert.equal(translated.schemaVersion, REMOTE_DOCUMENT_SCHEMA);
  assert.notEqual(translated, canonical);
  assert.throws(
    () => toRemoteTimelineDocument({ ...canonical, schemaVersion: "future-unknown.1" }),
    (error) => error.code === "DOCUMENT_SCHEMA_UNSUPPORTED",
  );
});

test("hybrid adapter keeps revision conflict for explicit recovery", async () => {
  const apiClient = {
    configured: true,
    async createDocument() { throw new Error("document already exists"); },
    async createVersion() { const error = new Error("conflict"); error.status = 409; error.code = "REVISION_CONFLICT"; throw error; },
  };
  const adapter = new HybridIndexedDbAdapter({ name: `hybrid-conflict-${Date.now()}`, apiClient, programId: "program_internal_medicine", remoteSyncConsent: true });
  await adapter.open();
  const record = localRecord();
  await adapter.put("settings", { id: `remote-revision:${record.id}`, documentId: record.id, revision: 0, updatedAt: new Date().toISOString() });
  await adapter.atomicPut([{ store: "documents", key: record.id, value: record }]);
  const result = await adapter.flush();
  assert.equal(result.pending, 1);
  assert.equal((await adapter.pending())[0].status, "CONFLICT");
  const second = await adapter.flush();
  assert.equal(second.conflict, true);
  adapter.close();
});

test("authoritative reload preserves pending local edits and records a divergent server snapshot", async () => {
  const adapter = new HybridIndexedDbAdapter({
    name: `hybrid-reconcile-${Date.now()}`,
    apiClient: { configured: false },
    programId: "program_internal_medicine",
    remoteSyncConsent: true,
  });
  await adapter.open();
  const local = localRecord("timeline_reconcile");
  await adapter.put("settings", { id: `remote-revision:${local.id}`, documentId: local.id, revision: 1, updatedAt: new Date().toISOString() });
  await adapter.atomicPut([{ store: "documents", key: local.id, value: local }]);
  const server = { ...structuredClone(local.document), title: "Older server copy", revision: 2 };
  const result = await adapter.reconcileAuthoritative([
    { store: "documents", key: local.id, value: { ...local, document: server } },
  ], { documentId: local.id, serverRevision: 2, serverSnapshot: server });
  assert.deepEqual(result, { state: "CONFLICT", pending: 1 });
  assert.equal((await adapter.get("documents", local.id)).document.title, "Hybrid Timeline");
  assert.equal((await adapter.pending())[0].status, "CONFLICT");
  assert.equal((await adapter.get("settings", `remote-conflict:${local.id}`)).serverSnapshot.title, "Older server copy");
  adapter.close();
});
