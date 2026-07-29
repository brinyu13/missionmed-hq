import { IndexedDbAdapter } from "../web/js/persistence/indexeddb-adapter.js";

const SYNC_PREFIX = "remote:";

function isoNow() {
  return new Date().toISOString();
}

function syncId(operation, documentId, sequence) {
  return `${SYNC_PREFIX}${operation}:${documentId}:${sequence}`;
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
    let remote = await super.get("settings", stateKey);
    if (!remote) {
      const created = await this.apiClient.createDocument(record.document, this.programId);
      remote = { id: stateKey, revision: created.document.revision, documentId: record.documentId, updatedAt: isoNow() };
      await super.put("settings", remote);
    }
    const snapshot = structuredClone(record.document);
    snapshot.revision = remote.revision;
    if (record.operation === "VERSION") {
      const version = await this.apiClient.createVersion(record.documentId, remote.revision, snapshot, record.label);
      remote.revision = version.revision;
    } else {
      await this.apiClient.checkpoint(record.documentId, this.deviceId, remote.revision, snapshot);
    }
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
