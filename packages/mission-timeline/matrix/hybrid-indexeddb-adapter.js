import { IndexedDbAdapter } from "../web/js/persistence/indexeddb-adapter.js";

const SYNC_PREFIX = "remote:";
export const REMOTE_DOCUMENT_SCHEMA = "d1-timeline-document-409.1";
const REMOTE_SOURCE_SCHEMAS = new Set([REMOTE_DOCUMENT_SCHEMA, "d1-uxr-002.1"]);
const OBSERVABLE_SYNC_STATES = new Set([
  "LOCAL_SAVED",
  "SYNC_PENDING",
  "SYNCING",
  "SYNCED",
  "CONFLICT",
  "ERROR",
  "OFFLINE",
  "LOCAL_ONLY",
]);

function isoNow() {
  return new Date().toISOString();
}

function syncId(operation, documentId, sequence) {
  return `${SYNC_PREFIX}${operation}:${documentId}:${sequence}`;
}

function observableSyncState(eventState, detail, currentState) {
  if (OBSERVABLE_SYNC_STATES.has(eventState)) return eventState;
  if (eventState === "LOCAL_PENDING") return "SYNC_PENDING";
  if (eventState === "SERVER_HYDRATED") return Number(detail.pending ?? 0) > 0 ? "SYNC_PENDING" : "SYNCED";
  if (eventState === "REMOTE_CONSENT_REQUIRED") return "LOCAL_ONLY";
  return currentState;
}

export function toRemoteTimelineDocument(document) {
  if (!document || typeof document !== "object") {
    throw Object.assign(new Error("Timeline document is required for remote sync."), {
      code: "REMOTE_DOCUMENT_REQUIRED",
    });
  }
  const snapshot = structuredClone(document);
  const clientSchemaVersion = String(snapshot.schemaVersion || "");
  if (!REMOTE_SOURCE_SCHEMAS.has(clientSchemaVersion)) {
    throw Object.assign(new Error("Timeline document schema is not supported for remote sync."), {
      code: "DOCUMENT_SCHEMA_UNSUPPORTED",
    });
  }
  snapshot.schemaVersion = REMOTE_DOCUMENT_SCHEMA;
  return snapshot;
}

export class HybridIndexedDbAdapter extends IndexedDbAdapter {
  constructor({ apiClient, programId, deviceId = `browser-${crypto.randomUUID()}`, onStatus = () => {}, remoteSyncConsent = false, ...indexedDb } = {}) {
    super(indexedDb);
    this.kind = "HYBRID_INDEXED_DB";
    this.apiClient = apiClient;
    this.programId = programId;
    this.deviceId = deviceId;
    this.onStatus = onStatus;
    this.remoteSyncConsent = remoteSyncConsent === true;
    this.flushing = null;
    this.flushTimer = null;
    this.syncStatus = Object.freeze({
      state: "LOCAL_ONLY",
      event: "INITIAL",
      at: isoNow(),
      pending: 0,
    });
    this.onlineHandler = () => this.flush().catch(() => {});
  }

  async open() {
    await super.open();
    globalThis.addEventListener?.("online", this.onlineHandler);
    this.report("LOCAL_READY", { pending: (await this.pending()).length });
    if (this.remoteSyncConsent) this.scheduleFlush(100);
    else this.report("REMOTE_CONSENT_REQUIRED", { pending: 0 });
    return this;
  }

  async atomicPut(entries) {
    await super.atomicPut(entries);
    const documentEntry = entries.find((entry) => entry.store === "documents");
    const checkpointEntry = entries.find((entry) => entry.store === "checkpoints");
    if (documentEntry?.value?.document) {
      this.report("LOCAL_SAVED", {
        documentId: documentEntry.value.document.id,
        pending: (await this.pending()).length,
      });
      if (this.remoteSyncConsent) {
        await this.enqueue({
          operation: "CHECKPOINT",
          documentId: documentEntry.value.document.id,
          document: documentEntry.value.document,
          sequence: documentEntry.value.sequence ?? checkpointEntry?.value?.sequence ?? Date.now(),
          reason: checkpointEntry?.value?.reason ?? "LOCAL_SAVE",
        });
      } else this.report("REMOTE_CONSENT_REQUIRED", { documentId: documentEntry.value.document.id, pending: 0 });
    }
    if (this.remoteSyncConsent) this.scheduleFlush();
  }

  async hydrateAuthoritative(entries) {
    await super.atomicPut(entries);
    this.report("SERVER_HYDRATED", { pending: (await this.pending()).length });
  }

  async reconcileAuthoritative(entries, { documentId, serverRevision, serverSnapshot } = {}) {
    const pending = (await this.pending()).filter((record) => record.documentId === documentId);
    const local = await super.get("documents", documentId);
    if (!pending.length || !local?.document) {
      await this.hydrateAuthoritative(entries);
      return { state: "SERVER_HYDRATED", pending: 0 };
    }
    const remote = await super.get("settings", `remote-revision:${documentId}`);
    if (Number(remote?.revision) === Number(serverRevision)) {
      this.report("LOCAL_PENDING", { documentId, pending: pending.length });
      return { state: "LOCAL_PENDING", pending: pending.length };
    }
    for (const record of pending) {
      await super.put("syncRecords", {
        ...record,
        status: "CONFLICT",
        errorCode: "REVISION_CONFLICT",
        serverRevision: Number(serverRevision),
        updatedAt: isoNow(),
      });
    }
    await super.put("settings", {
      id: `remote-conflict:${documentId}`,
      documentId,
      revision: Number(serverRevision),
      serverSnapshot: structuredClone(serverSnapshot),
      updatedAt: isoNow(),
    });
    this.report("CONFLICT", { documentId, pending: pending.length });
    return { state: "CONFLICT", pending: pending.length };
  }

  async getConflict(documentId) {
    const conflict = await super.get("settings", `remote-conflict:${documentId}`);
    if (!conflict?.serverSnapshot) return null;
    const local = await super.get("documents", documentId);
    if (!local?.document) return null;
    return structuredClone({
      documentId,
      serverRevision: Number(conflict.revision),
      localDocument: local.document,
      serverDocument: conflict.serverSnapshot,
      detectedAt: conflict.updatedAt,
    });
  }

  async resolveConflict(documentId, strategy) {
    if (!["KEEP_LOCAL", "USE_SERVER"].includes(strategy)) {
      throw Object.assign(new Error("Choose a valid Timeline conflict recovery option."), {
        code: "CONFLICT_STRATEGY_INVALID",
      });
    }
    const conflict = await this.getConflict(documentId);
    if (!conflict) {
      throw Object.assign(new Error("The Timeline conflict is no longer available."), {
        code: "CONFLICT_NOT_FOUND",
      });
    }
    const now = isoNow();
    const pending = (await this.pending()).filter((record) => record.documentId === documentId);
    const recoveryDocument = strategy === "KEEP_LOCAL" ? conflict.serverDocument : conflict.localDocument;
    const recoveryId = `conflict-recovery:${documentId}:${Date.now()}`;
    await super.put("versions", {
      id: recoveryId,
      documentId,
      name: strategy === "KEEP_LOCAL"
        ? "Conflict recovery · server copy"
        : "Conflict recovery · local copy",
      kind: "conflict-recovery",
      createdAt: now,
      eventCount: Array.isArray(recoveryDocument.events) ? recoveryDocument.events.length : 0,
      documentSnapshot: structuredClone(recoveryDocument),
    });
    for (const record of pending) await super.delete("syncRecords", record.id);
    await super.put("settings", {
      id: `remote-revision:${documentId}`,
      documentId,
      revision: conflict.serverRevision,
      updatedAt: now,
    });
    await super.delete("settings", `remote-conflict:${documentId}`);
    if (strategy === "USE_SERVER") {
      const existing = await super.get("documents", documentId);
      await super.put("documents", {
        ...existing,
        id: documentId,
        document: structuredClone(conflict.serverDocument),
        schemaVersion: conflict.serverDocument.schemaVersion,
        savedAt: now,
        sequence: Number(conflict.serverDocument.revision || conflict.serverRevision),
        reason: "CONFLICT_USE_SERVER",
      });
      this.report("SYNCED", { documentId, pending: 0, resolution: strategy });
      return { strategy, pending: 0, recoveryVersionId: recoveryId };
    }
    await this.enqueue({
      operation: "CHECKPOINT",
      documentId,
      document: structuredClone(conflict.localDocument),
      sequence: Date.now(),
      reason: "CONFLICT_KEEP_LOCAL",
    });
    const result = await this.flush();
    return { strategy, ...result, recoveryVersionId: recoveryId };
  }

  async put(store, value, key = value?.id) {
    const record = await super.put(store, value, key);
    if (store === "versions" && value?.documentSnapshot) {
      if (this.remoteSyncConsent) {
        await this.enqueue({
          operation: "VERSION",
          documentId: value.documentId,
          document: value.documentSnapshot,
          sequence: value.createdAt ?? Date.now(),
          label: value.label ?? "Named version",
        });
        this.scheduleFlush();
      } else this.report("REMOTE_CONSENT_REQUIRED", { documentId: value.documentId, pending: 0 });
    }
    return record;
  }

  async enqueue(operation) {
    if (!this.remoteSyncConsent) {
      this.report("REMOTE_CONSENT_REQUIRED", { documentId: operation.documentId, pending: 0 });
      return null;
    }
    const id = syncId(operation.operation, operation.documentId, operation.sequence);
    await super.put("syncRecords", {
      id,
      ...operation,
      status: "SYNC_PENDING",
      attempts: 0,
      createdAt: isoNow(),
      updatedAt: isoNow(),
    });
    this.report("SYNC_PENDING", {
      documentId: operation.documentId,
      pending: (await this.pending()).length,
    });
    return id;
  }

  pending() {
    return super.list("syncRecords", (record) => record.id.startsWith(SYNC_PREFIX) && ["SYNC_PENDING", "ERROR", "CONFLICT"].includes(record.status));
  }

  scheduleFlush(delay = 2_500) {
    if (!this.remoteSyncConsent) return;
    clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this.flush().catch(() => {}), delay);
  }

  async flush() {
    if (!this.remoteSyncConsent) {
      this.report("REMOTE_CONSENT_REQUIRED", { pending: 0 });
      return { synced: 0, pending: 0, consentRequired: true };
    }
    if (this.flushing) return this.flushing;
    this.flushing = this.flushPending().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  async flushPending() {
    const records = await this.pending();
    if (!records.length) {
      this.report("SYNCED", { pending: 0 });
      return { synced: 0, pending: 0 };
    }
    if (!this.apiClient?.configured || globalThis.navigator?.onLine === false) {
      this.report(globalThis.navigator?.onLine === false ? "OFFLINE" : "LOCAL_ONLY", { pending: records.length });
      return { synced: 0, pending: records.length };
    }
    if (records.some((record) => record.status === "CONFLICT")) {
      this.report("CONFLICT", { pending: records.length });
      return { synced: 0, pending: records.length, conflict: true };
    }
    this.report("SYNCING", { pending: records.length });
    const ordered = records.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    const latestCheckpoint = new Map();
    ordered.forEach((record) => {
      if (record.operation === "CHECKPOINT") latestCheckpoint.set(record.documentId, record.id);
    });
    let synced = 0;
    for (const record of ordered) {
      if (record.operation === "CHECKPOINT" && latestCheckpoint.get(record.documentId) !== record.id) {
        await super.delete("syncRecords", record.id);
        continue;
      }
      try {
        await this.syncRecord(record);
        await super.delete("syncRecords", record.id);
        synced += 1;
      } catch (error) {
        const status = error?.status === 409 ? "CONFLICT" : "ERROR";
        await super.put("syncRecords", {
          ...record,
          status,
          attempts: Number(record.attempts ?? 0) + 1,
          errorCode: error?.code ?? "SYNC_FAILED",
          updatedAt: isoNow(),
        });
        this.report(status, { documentId: record.documentId, errorCode: error?.code ?? "SYNC_FAILED" });
        if (status === "CONFLICT") break;
      }
    }
    const remaining = await this.pending();
    const pending = remaining.length;
    const finalState = remaining.some((record) => record.status === "CONFLICT")
      ? "CONFLICT"
      : remaining.some((record) => record.status === "ERROR")
        ? "ERROR"
        : pending
          ? "SYNC_PENDING"
          : "SYNCED";
    this.report(finalState, { pending });
    return { synced, pending };
  }

  async syncRecord(record) {
    if (!this.remoteSyncConsent) throw Object.assign(new Error("Remote sync consent is required."), { code: "REMOTE_CONSENT_REQUIRED" });
    const stateKey = `remote-revision:${record.documentId}`;
    const remoteDocument = toRemoteTimelineDocument(record.document);
    let remote = await super.get("settings", stateKey);
    if (!remote) {
      const created = await this.apiClient.createDocument(remoteDocument, this.programId);
      remote = { id: stateKey, revision: created.document.revision, documentId: record.documentId, updatedAt: isoNow() };
      await super.put("settings", remote);
      if (record.operation === "CHECKPOINT") return;
    }
    const snapshot = structuredClone(remoteDocument);
    snapshot.revision = remote.revision;
    const label = record.operation === "VERSION" ? record.label : `Autosave: ${record.reason ?? "LOCAL_SAVE"}`;
    const version = await this.apiClient.createVersion(record.documentId, remote.revision, snapshot, label);
    remote.revision = version.revision;
    remote.updatedAt = isoNow();
    await super.put("settings", remote);
  }

  report(syncState, detail = {}) {
    const at = isoNow();
    const state = observableSyncState(syncState, detail, this.syncStatus.state);
    this.syncStatus = Object.freeze({ state, event: syncState, at, ...detail });
    const statusEvent = { state: syncState, syncState: state, at, ...detail };
    this.onStatus(statusEvent);
    globalThis.dispatchEvent?.(new CustomEvent("mission-timeline-sync", { detail: statusEvent }));
  }

  getSyncStatus() {
    return structuredClone(this.syncStatus);
  }

  async getRemoteRevision(documentId) {
    const remote = await super.get("settings", `remote-revision:${documentId}`);
    const revision = Number(remote?.revision);
    return Number.isInteger(revision) && revision >= 0 ? revision : null;
  }

  setRemoteSyncConsent(consent) {
    this.remoteSyncConsent = consent === true;
    if (!this.remoteSyncConsent) {
      clearTimeout(this.flushTimer);
      this.report("REMOTE_CONSENT_REQUIRED", { pending: 0 });
      return false;
    }
    this.report("REMOTE_SYNC_CONSENTED", {});
    this.scheduleFlush(100);
    return true;
  }

  close() {
    clearTimeout(this.flushTimer);
    globalThis.removeEventListener?.("online", this.onlineHandler);
    super.close();
  }
}
