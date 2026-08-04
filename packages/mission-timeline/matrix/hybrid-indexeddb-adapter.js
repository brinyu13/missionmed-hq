import { IndexedDbAdapter } from "../web/js/persistence/indexeddb-adapter.js";

const SYNC_PREFIX = "remote:";
export const REMOTE_DOCUMENT_SCHEMA = "d1-timeline-document-409.1";
const REMOTE_SOURCE_SCHEMAS = new Set([REMOTE_DOCUMENT_SCHEMA, "d1-uxr-002.1"]);

function isoNow() {
  return new Date().toISOString();
}

function syncId(operation, documentId, sequence) {
  return `${SYNC_PREFIX}${operation}:${documentId}:${sequence}`;
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
    this.report("SYNC_PENDING", { documentId: operation.documentId });
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
      this.report("LOCAL_ONLY", { pending: records.length });
      return { synced: 0, pending: records.length };
    }
    if (records.some((record) => record.status === "CONFLICT")) {
      this.report("CONFLICT", { pending: records.length });
      return { synced: 0, pending: records.length, conflict: true };
    }
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
    this.report(remaining.some((record) => record.status === "CONFLICT") ? "CONFLICT" : pending ? "SYNC_PENDING" : "SYNCED", { pending });
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
    this.onStatus({ state: syncState, at: isoNow(), ...detail });
    globalThis.dispatchEvent?.(new CustomEvent("mission-timeline-sync", { detail: { state: syncState, ...detail } }));
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
