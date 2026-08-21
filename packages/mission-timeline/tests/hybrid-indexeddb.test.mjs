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
  assert.equal(states.includes("LOCAL_SAVED"), true);
  assert.equal(adapter.getSyncStatus().state, "LOCAL_ONLY");
  adapter.close();
});

test("local save remains pending until the remote acknowledgement completes", async () => {
  const statuses = [];
  let acknowledgeRemote;
  let reportSyncing;
  const remoteAcknowledgement = new Promise((resolve) => { acknowledgeRemote = resolve; });
  const syncing = new Promise((resolve) => { reportSyncing = resolve; });
  const apiClient = {
    configured: true,
    async createDocument() {
      await remoteAcknowledgement;
      return { document: { revision: 0 } };
    },
  };
  const adapter = new HybridIndexedDbAdapter({
    name: `hybrid-ack-${Date.now()}`,
    apiClient,
    programId: "program_internal_medicine",
    remoteSyncConsent: true,
    onStatus: (status) => {
      statuses.push(status);
      if(status.syncState==="SYNCING")reportSyncing();
    },
  });
  await adapter.open();
  const record = localRecord("timeline_ack");
  await adapter.atomicPut([{ store: "documents", key: record.id, value: record }]);
  assert.deepEqual(
    statuses.filter(({ state }) => ["LOCAL_SAVED", "SYNC_PENDING"].includes(state)).map(({ state, syncState }) => [state, syncState]),
    [["LOCAL_SAVED", "LOCAL_SAVED"], ["SYNC_PENDING", "SYNC_PENDING"]],
  );
  assert.equal(adapter.getSyncStatus().state, "SYNC_PENDING");

  const flushing = adapter.flush();
  await syncing;
  assert.equal(adapter.getSyncStatus().state, "SYNCING");
  assert.equal(statuses.some(({ syncState }) => syncState === "SYNCED"), false);

  acknowledgeRemote();
  assert.deepEqual(await flushing, { synced: 1, pending: 0 });
  assert.equal(adapter.getSyncStatus().state, "SYNCED");
  assert.equal(statuses.at(-1).syncState, "SYNCED");
  adapter.close();
});

test("twenty rapid local edits coalesce to one acknowledged remote checkpoint", async () => {
  let versionCalls = 0;
  const apiClient = {
    configured: true,
    async createVersion(_documentId, revision, snapshot) {
      versionCalls += 1;
      assert.equal(snapshot.title, "Rapid edit 20");
      return { revision: revision + 1 };
    },
  };
  const adapter = new HybridIndexedDbAdapter({
    name: `hybrid-coalesce-20-${Date.now()}`,
    apiClient,
    programId: "program_internal_medicine",
    remoteSyncConsent: true,
  });
  await adapter.open();
  const record = localRecord("timeline_coalesce_20");
  await adapter.put("settings", {
    id: `remote-revision:${record.id}`,
    documentId: record.id,
    revision: 7,
    updatedAt: new Date().toISOString(),
  });
  for (let sequence = 1; sequence <= 20; sequence += 1) {
    const value = structuredClone(record);
    value.sequence = sequence;
    value.document.title = `Rapid edit ${sequence}`;
    await adapter.atomicPut([{ store: "documents", key: value.id, value }]);
  }
  assert.equal((await adapter.pending()).length, 20);
  assert.equal(adapter.getSyncStatus().state, "SYNC_PENDING");
  assert.deepEqual(await adapter.flush(), { synced: 1, pending: 0 });
  assert.equal(versionCalls, 1);
  assert.equal(adapter.getSyncStatus().state, "SYNCED");
  assert.equal(await adapter.getRemoteRevision(record.id), 8);
  assert.equal((await adapter.get("documents", record.id)).document.title, "Rapid edit 20");
  adapter.close();
});

test("configured remote sync reports OFFLINE while queued work remains local", async (t) => {
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { onLine: false },
  });
  t.after(() => {
    if (navigatorDescriptor) Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
    else delete globalThis.navigator;
  });
  const adapter = new HybridIndexedDbAdapter({
    name: `hybrid-offline-${Date.now()}`,
    apiClient: { configured: true },
    programId: "program_internal_medicine",
    remoteSyncConsent: true,
  });
  await adapter.open();
  t.after(() => adapter.close());
  const record = localRecord("timeline_offline");
  await adapter.atomicPut([{ store: "documents", key: record.id, value: record }]);
  assert.deepEqual(await adapter.flush(), { synced: 0, pending: 1 });
  assert.equal(adapter.getSyncStatus().state, "OFFLINE");
  assert.equal((await adapter.pending()).length, 1);
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
  assert.equal(adapter.getSyncStatus().state, "ERROR");
  const second = await adapter.flush();
  assert.equal(second.pending, 1);
  assert.equal(adapter.getSyncStatus().state, "ERROR");
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
  assert.equal(adapter.getSyncStatus().state, "CONFLICT");
  const second = await adapter.flush();
  assert.equal(second.conflict, true);
  assert.equal(adapter.getSyncStatus().state, "CONFLICT");
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

test("conflict recovery can preserve the local copy and save it on top of the server revision", async () => {
  let savedSnapshot = null;
  const adapter = new HybridIndexedDbAdapter({
    name: `hybrid-reconcile-local-${Date.now()}`,
    apiClient: {
      configured: true,
      async createVersion(_documentId, revision, snapshot) {
        savedSnapshot = structuredClone(snapshot);
        assert.equal(revision, 2);
        return { revision: 3 };
      },
    },
    programId: "program_internal_medicine",
    remoteSyncConsent: true,
  });
  await adapter.open();
  const local = localRecord("timeline_reconcile_local");
  local.document.title = "Unsynced local title";
  await adapter.put("settings", { id: `remote-revision:${local.id}`, documentId: local.id, revision: 1, updatedAt: new Date().toISOString() });
  await adapter.atomicPut([{ store: "documents", key: local.id, value: local }]);
  const server = { ...structuredClone(local.document), title: "Newer server title", revision: 2 };
  await adapter.reconcileAuthoritative([], { documentId: local.id, serverRevision: 2, serverSnapshot: server });
  const result = await adapter.resolveConflict(local.id, "KEEP_LOCAL");
  assert.equal(result.pending, 0);
  assert.equal(savedSnapshot.title, "Unsynced local title");
  assert.equal(savedSnapshot.revision, 2);
  assert.equal(await adapter.get("settings", `remote-conflict:${local.id}`), undefined);
  const recovery = await adapter.get("versions", result.recoveryVersionId);
  assert.equal(recovery.documentSnapshot.title, "Newer server title");
  adapter.close();
});

test("conflict recovery can use the server copy while retaining the local copy as a recovery version", async () => {
  const adapter = new HybridIndexedDbAdapter({
    name: `hybrid-reconcile-server-${Date.now()}`,
    apiClient: { configured: true },
    programId: "program_internal_medicine",
    remoteSyncConsent: true,
  });
  await adapter.open();
  const local = localRecord("timeline_reconcile_server");
  local.document.title = "Unsynced local title";
  await adapter.put("settings", { id: `remote-revision:${local.id}`, documentId: local.id, revision: 1, updatedAt: new Date().toISOString() });
  await adapter.atomicPut([{ store: "documents", key: local.id, value: local }]);
  const server = { ...structuredClone(local.document), title: "Authoritative server title", revision: 2 };
  await adapter.reconcileAuthoritative([], { documentId: local.id, serverRevision: 2, serverSnapshot: server });
  const result = await adapter.resolveConflict(local.id, "USE_SERVER");
  assert.equal(result.pending, 0);
  assert.equal((await adapter.get("documents", local.id)).document.title, "Authoritative server title");
  assert.equal((await adapter.pending()).length, 0);
  const recovery = await adapter.get("versions", result.recoveryVersionId);
  assert.equal(recovery.documentSnapshot.title, "Unsynced local title");
  adapter.close();
});
