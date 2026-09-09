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

function recoveryError(code) {
  return Object.assign(new Error(code === "REMOTE_VERSION_IMMUTABLE"
    ? "This server recovery version is immutable. Restore it to continue editing."
    : "Both Timeline copies are retained. Recovery needs a verified server acknowledgement; please try again."), { code });
}
function identityJson(value) {
  const sort = item => Array.isArray(item) ? item.map(sort) : item && typeof item === "object"
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => [key, sort(val)])) : item;
  return JSON.stringify(sort(value));
}
function receiptDocumentIdentity(document) {
  const copy = structuredClone(document);
  // The existing authorized read recomputes deterministic Guardian rules and
  // stamps their check time. This timestamp is not a new saved document edit.
  const summary = copy.metadata?.qualitySummary022;
  if (summary?.serverVerified === true && summary?.aiReview === false && summary?.basis === "MISSIONMED_RULE") delete summary.checkedAt;
  return identityJson(copy);
}
async function recoveryHash(value) {
  if (!globalThis.crypto?.subtle) throw recoveryError("RECOVERY_CRYPTO_UNAVAILABLE");
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identityJson(value)))))
    .map(byte => byte.toString(16).padStart(2, "0")).join("");
}
function validRemoteDocument(document, id, owner) {
  return document?.id === id && (!owner || document.studentOwnerId === owner) &&
    Number.isSafeInteger(document.revision) && document.revision >= 0 && REMOTE_SOURCE_SCHEMAS.has(document.schemaVersion);
}
async function verifyRemoteVersion(version, documentId, owner) {
  if (!version || version.documentId !== documentId || !validRemoteDocument(version.snapshot, documentId, owner) ||
      version.revision !== version.snapshot.revision || version.revision < 1) throw recoveryError("REMOTE_HISTORY_INVALID");
  const snapshot = structuredClone(version.snapshot);
  for (const field of ["persistence", "recovery", "exportRecords", "timelineArtifacts"]) delete snapshot[field];
  if (snapshot.metadata) { delete snapshot.metadata.updatedAt; delete snapshot.metadata.lastSyncedAt; }
  if (version.contentSha256 !== await recoveryHash(snapshot)) throw recoveryError("REMOTE_HISTORY_INVALID");
}
function historyVersion(version) {
  return { id: version.id, documentId: version.documentId, name: version.label, label: version.label,
    kind: "conflict-recovery", createdAt: version.createdAt, revision: version.revision,
    eventCount: version.eventCount ?? version.snapshot?.events?.length ?? 0,
    mediaCount: version.mediaCount ?? version.snapshot?.mediaItems?.length ?? 0,
    contentHash: version.contentSha256, remoteVersion: true,
    ...(version.snapshot ? { documentSnapshot: structuredClone(version.snapshot) } : {}) };
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
    let conflict = await super.get("settings", `remote-conflict:${documentId}`);
    // A 409 during an open session has no hydration snapshot yet. Fetch through
    // the authenticated owner-scoped client, without replacing either copy.
    if (!conflict?.serverSnapshot && this.remoteSyncConsent && this.apiClient?.configured &&
        (await this.pending()).some(record => record.documentId === documentId && record.status === "CONFLICT")) {
      const saved = await this.apiClient.getDocument(documentId);
      const server = saved?.document;
      if (server?.id !== documentId || !Number.isSafeInteger(server?.revision) || server.revision < 0 ||
          !REMOTE_SOURCE_SCHEMAS.has(server?.schemaVersion)) {
        throw Object.assign(new Error("The latest saved Timeline could not be verified. Please try again."), {code:"CONFLICT_SNAPSHOT_INVALID"});
      }
      if (!(await this.pending()).some(record => record.documentId === documentId && record.status === "CONFLICT")) return null;
      conflict = {id:`remote-conflict:${documentId}`,documentId,revision:server.revision,serverSnapshot:structuredClone(server),updatedAt:isoNow()};
      await super.put("settings", conflict);
    }
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
    if (!["KEEP_LOCAL", "USE_SERVER"].includes(strategy)) throw recoveryError("CONFLICT_STRATEGY_INVALID");
    if (this.resolving) throw recoveryError("CONFLICT_RECOVERY_IN_PROGRESS");
    if (!this.remoteSyncConsent || !this.apiClient?.configured || typeof this.apiClient.recoverConflict !== "function") {
      throw recoveryError("CONFLICT_RECOVERY_UNAVAILABLE");
    }
    const work = this.resolveConflictDurably(documentId, strategy);
    this.resolving = work;
    try { return await work; } finally { if (this.resolving === work) this.resolving = null; }
  }

  async resolveConflictDurably(documentId, strategy) {
    if (this.flushing) await this.flushing;
    const intentId = `conflict-recovery-intent:${documentId}`;
    let intent = await super.get("settings", intentId);
    if (intent && intent.input.strategy !== strategy) throw recoveryError("CONFLICT_RECOVERY_RETRY_SAME_CHOICE");
    if (!intent) {
      const conflict = await this.getConflict(documentId);
      if (!conflict) throw recoveryError("CONFLICT_NOT_FOUND");
      const input = JSON.parse(JSON.stringify({ requestId: crypto.randomUUID(), baseRevision: conflict.serverRevision,
        strategy, snapshot: toRemoteTimelineDocument(conflict.localDocument) }));
      intent = { id: intentId, documentId, input, requestSha256: await recoveryHash(input),
        localDocument: structuredClone(conflict.localDocument), serverDocument: structuredClone(conflict.serverDocument),
        pending: (await this.pending()).filter(record => record.documentId === documentId), createdAt: isoNow() };
      // Retain the exact request and both copies before dispatch, including a lost ACK/reload.
      await super.put("settings", intent);
    }
    this.report("CONFLICT", { documentId, pending: (await this.pending()).length, recoveryPending: true });
    try {
      const receipt = await this.apiClient.recoverConflict(documentId, intent.input);
      await this.verifyRecoveryReceipt(intent, receipt);
      const result = await this.commitRecoveryReceipt(intent, receipt);
      const allPending = await this.pending();
      this.report(result.pending ? "CONFLICT" : allPending.length ? "SYNC_PENDING" : "SYNCED", { documentId, pending: allPending.length, resolution: strategy });
      return { strategy, ...result, recoveryVersionId: receipt.recoveryVersion.id, durable: true };
    } catch (error) {
      // Only this explicit CAS denial proves that nothing committed. Other errors
      // retain the exact request identity for an idempotent user-initiated retry.
      if (error?.code === "REVISION_CONFLICT" && typeof this.apiClient.getDocument === "function") {
        const latest = (await this.apiClient.getDocument(documentId)).document;
        if (validRemoteDocument(latest, documentId, intent.serverDocument.studentOwnerId)) {
          await super.put("settings", { id: `remote-conflict:${documentId}`, documentId,
            revision: latest.revision, serverSnapshot: latest, updatedAt: isoNow() });
          await super.delete("settings", intentId);
        }
      }
      this.report("CONFLICT", { documentId, pending: (await this.pending()).length, recoveryPending: true,
        errorCode: error?.code || "CONFLICT_RECOVERY_ACK_UNCERTAIN" });
      throw error;
    }
  }

  async verifyRecoveryReceipt(intent, receipt) {
    const { documentId, input, requestSha256 } = intent;
    if (receipt?.schema !== "d1-022-conflict-recovery.1" || receipt.requestId !== input.requestId ||
        receipt.strategy !== input.strategy || receipt.baseRevision !== input.baseRevision ||
        receipt.requestSha256 !== requestSha256 ||
        !validRemoteDocument(receipt.document, documentId, intent.serverDocument.studentOwnerId)) {
      throw recoveryError("CONFLICT_RECOVERY_ACK_INVALID");
    }
    const losing = receipt.recoveryVersion, chosen = receipt.chosenVersion;
    await verifyRemoteVersion(losing, documentId, intent.serverDocument.studentOwnerId);
    await verifyRemoteVersion(chosen, documentId, intent.serverDocument.studentOwnerId);
    if (!/^conflict_[a-f0-9]{32}_recovery$/.test(losing.id) || chosen.id !== losing.id.replace(/_recovery$/, "_chosen") ||
        losing.revision !== input.baseRevision + 1 || chosen.revision !== input.baseRevision + 2 ||
        chosen.parentVersionId !== losing.id || receipt.document.revision < chosen.revision ||
        losing.snapshot.metadata?.conflictRecovery022?.requestSha256 !== requestSha256 ||
        losing.snapshot.metadata?.conflictRecovery022?.requestId !== input.requestId) {
      throw recoveryError("CONFLICT_RECOVERY_ACK_INVALID");
    }
    if (receipt.document.revision === chosen.revision && receiptDocumentIdentity(receipt.document) !== receiptDocumentIdentity(chosen.snapshot)) {
      throw recoveryError("CONFLICT_RECOVERY_ACK_INVALID");
    }
  }

  async commitRecoveryReceipt(intent, receipt) {
    const documentId = intent.documentId, at = isoNow();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(["documents", "versions", "settings", "syncRecords"], "readwrite");
      const documents = tx.objectStore("documents"), settings = tx.objectStore("settings"), sync = tx.objectStore("syncRecords");
      const readDocument = documents.get(documentId), readPending = sync.getAll();
      let result;
      const commit = () => {
        if (readDocument.readyState !== "done" || readPending.readyState !== "done") return;
        const existing = readDocument.result;
        const pending = readPending.result.filter(record => record.documentId === documentId &&
          record.id.startsWith(SYNC_PREFIX) && ["SYNC_PENDING", "ERROR", "CONFLICT"].includes(record.status));
        const unchanged = identityJson(existing?.document) === identityJson(intent.localDocument) &&
          pending.every(record => intent.pending.some(prior => prior.id === record.id && identityJson(prior.document) === identityJson(record.document)));
        const currentIsChosen = receipt.document.revision === receipt.chosenVersion.revision;
        for (const version of [receipt.recoveryVersion, receipt.chosenVersion]) tx.objectStore("versions").put(historyVersion(version));
        settings.put({ id: `remote-revision:${documentId}`, documentId, revision: receipt.document.revision, updatedAt: at });
        settings.delete(intent.id);
        if (unchanged && currentIsChosen) {
          pending.forEach(record => sync.delete(record.id));
          settings.delete(`remote-conflict:${documentId}`);
          documents.put({ ...existing, id: documentId, document: structuredClone(receipt.document),
            schemaVersion: receipt.document.schemaVersion, savedAt: at, sequence: receipt.document.revision,
            reason: `CONFLICT_${intent.input.strategy}` });
          result = { pending: 0 };
        } else {
          if (!pending.length && existing?.document) pending.push({ id: syncId("CHECKPOINT", documentId, crypto.randomUUID()),
            operation: "CHECKPOINT", documentId, document: structuredClone(existing.document), sequence: Date.now(),
            reason: "CONFLICT_CONCURRENT_CHANGE", createdAt: at, attempts: 0 });
          pending.forEach(record => sync.put({ ...record, status: "CONFLICT", errorCode: "REVISION_CONFLICT",
            serverRevision: receipt.document.revision, updatedAt: at }));
          settings.put({ id: `remote-conflict:${documentId}`, documentId, revision: receipt.document.revision,
            serverSnapshot: structuredClone(receipt.document), updatedAt: at });
          result = { pending: Math.max(1, pending.length), conflict: true };
        }
      };
      readDocument.onsuccess = commit; readPending.onsuccess = commit;
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(tx.error || recoveryError("CONFLICT_RECOVERY_LOCAL_COMMIT_FAILED"));
    });
  }

  async listDocumentVersions(documentId) {
    if (this.remoteSyncConsent && this.apiClient?.configured && typeof this.apiClient.listVersions === "function") {
      const payload = await this.apiClient.listVersions(documentId);
      if (!Array.isArray(payload?.versions) || payload.versions.some(version => version.documentId !== documentId ||
          typeof version.id !== "string" || !Number.isSafeInteger(version.revision) || version.revision < 1)) {
        throw recoveryError("REMOTE_HISTORY_INVALID");
      }
      // Extend existing named local History with the durable conflict records.
      // Autosaves are not promoted to hundreds of unnamed History cards.
      for (const version of payload.versions.filter(version => /^conflict_[a-f0-9]{32}_(recovery|chosen)$/.test(version.id))) {
        const cached = await super.get("versions", version.id);
        await super.put("versions", { ...cached, ...historyVersion(version) });
      }
    }
    return super.list("versions", item => item.documentId === documentId);
  }

  async get(store, key) {
    const value = await super.get(store, key);
    if (store !== "versions" || !value?.remoteVersion) return value;
    if (!this.remoteSyncConsent || !this.apiClient?.configured || typeof this.apiClient.getVersion !== "function") {
      throw recoveryError("REMOTE_HISTORY_UNAVAILABLE");
    }
    const version = await this.apiClient.getVersion(value.documentId, key);
    if (version?.id !== key) throw recoveryError("REMOTE_HISTORY_INVALID");
    const document = await super.get("documents", value.documentId);
    await verifyRemoteVersion(version, value.documentId, document?.document?.studentOwnerId);
    const verified = historyVersion(version);
    await super.put("versions", verified);
    return verified;
  }

  async delete(store, key) {
    if (store === "versions" && (await super.get(store, key))?.remoteVersion) throw recoveryError("REMOTE_VERSION_IMMUTABLE");
    return super.delete(store, key);
  }

  async put(store, value, key = value?.id) {
    if (store === "versions" && (value?.remoteVersion || (await super.get(store, key))?.remoteVersion)) throw recoveryError("REMOTE_VERSION_IMMUTABLE");
    const record = await super.put(store, value, key);
    if (store === "versions" && value?.documentSnapshot) {
      if (this.remoteSyncConsent) {
        await this.enqueue({
          operation: "VERSION",
          documentId: value.documentId,
          document: value.documentSnapshot,
          sequence: value.createdAt ?? Date.now(),
          label: value.label ?? value.name ?? "Named version",
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
    if (this.resolving) return { synced: 0, pending: (await this.pending()).length, conflict: true };
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
