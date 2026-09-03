import type { TimelineDocument, TimelineVersion } from "../contracts/types.js";
import { clone, newId, now } from "../core/canonical.js";
import { TimelineError } from "../core/errors.js";

export type SyncState = "LOCAL_ONLY" | "SYNC_PENDING" | "SYNCED" | "CONFLICT" | "ERROR";

export interface LocalDraftStore {
  putDocument(document: TimelineDocument): Promise<void>;
  getDocument(id: string): Promise<TimelineDocument | null>;
  putOperation(operation: PendingOperation): Promise<void>;
  listOperations(documentId: string): Promise<PendingOperation[]>;
  removeOperation(id: string): Promise<void>;
}

export interface RemoteTimelineClient {
  saveCheckpoint(document: TimelineDocument, baseRevision: number, deviceId: string): Promise<{ revision: number }>;
  createVersion(document: TimelineDocument, baseRevision: number, label: string): Promise<TimelineVersion>;
}

export interface PendingOperation {
  id: string;
  documentId: string;
  kind: "CHECKPOINT" | "VERSION";
  baseRevision: number;
  document: TimelineDocument;
  label?: string;
  createdAt: string;
  attempts: number;
}

export interface HybridStatus {
  state: SyncState;
  documentId: string;
  localSavedAt: string;
  remoteSyncedAt: string | null;
  pendingOperations: number;
  conflict?: { baseRevision: number; currentRevision?: number };
  errorCode?: string;
}

export class HybridPersistenceCoordinator {
  private readonly statuses = new Map<string, HybridStatus>();

  constructor(
    private readonly local: LocalDraftStore,
    private readonly remote: RemoteTimelineClient,
    private readonly deviceId: string,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async saveLocal(document: TimelineDocument): Promise<HybridStatus> {
    await this.local.putDocument(clone(document));
    const createdAt = now(this.clock);
    const operation: PendingOperation = {
      id: newId("sync"),
      documentId: document.id,
      kind: "CHECKPOINT",
      baseRevision: document.revision,
      document: clone(document),
      createdAt,
      attempts: 0,
    };
    await this.local.putOperation(operation);
    return this.updateStatus(document.id, {
      state: "SYNC_PENDING",
      documentId: document.id,
      localSavedAt: createdAt,
      remoteSyncedAt: this.statuses.get(document.id)?.remoteSyncedAt ?? null,
      pendingOperations: (await this.local.listOperations(document.id)).length,
    });
  }

  async saveVersion(document: TimelineDocument, label: string): Promise<HybridStatus> {
    await this.local.putDocument(clone(document));
    const createdAt = now(this.clock);
    await this.local.putOperation({
      id: newId("sync"),
      documentId: document.id,
      kind: "VERSION",
      baseRevision: document.revision,
      document: clone(document),
      label,
      createdAt,
      attempts: 0,
    });
    return this.updateStatus(document.id, {
      state: "SYNC_PENDING",
      documentId: document.id,
      localSavedAt: createdAt,
      remoteSyncedAt: this.statuses.get(document.id)?.remoteSyncedAt ?? null,
      pendingOperations: (await this.local.listOperations(document.id)).length,
    });
  }

  async flush(documentId: string): Promise<HybridStatus> {
    const operations = await this.coalescedOperations(documentId);
    let status = this.statuses.get(documentId) ?? {
      state: "LOCAL_ONLY" as const,
      documentId,
      localSavedAt: now(this.clock),
      remoteSyncedAt: null,
      pendingOperations: operations.length,
    };
    for (const operation of operations) {
      try {
        if (operation.kind === "VERSION") {
          await this.remote.createVersion(operation.document, operation.baseRevision, operation.label ?? "Named version");
        } else {
          await this.remote.saveCheckpoint(operation.document, operation.baseRevision, this.deviceId);
        }
        await this.local.removeOperation(operation.id);
        status = this.updateStatus(documentId, {
          ...status,
          state: "SYNCED",
          remoteSyncedAt: now(this.clock),
          pendingOperations: (await this.local.listOperations(documentId)).length,
          conflict: undefined,
          errorCode: undefined,
        });
      } catch (error) {
        if (error instanceof TimelineError && error.code === "REVISION_CONFLICT") {
          return this.updateStatus(documentId, {
            ...status,
            state: "CONFLICT",
            pendingOperations: (await this.local.listOperations(documentId)).length,
            conflict: {
              baseRevision: operation.baseRevision,
              currentRevision: Number(error.details.currentRevision ?? NaN) || undefined,
            },
          });
        }
        return this.updateStatus(documentId, {
          ...status,
          state: "ERROR",
          pendingOperations: (await this.local.listOperations(documentId)).length,
          errorCode: error instanceof TimelineError ? error.code : "REMOTE_SYNC_FAILED",
        });
      }
    }
    return status;
  }

  getStatus(documentId: string): HybridStatus | null {
    const status = this.statuses.get(documentId);
    return status ? clone(status) : null;
  }

  private async coalescedOperations(documentId: string): Promise<PendingOperation[]> {
    const operations = await this.local.listOperations(documentId);
    const retained: PendingOperation[] = [];
    let checkpoint: PendingOperation | null = null;
    for (const operation of operations.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      if (operation.kind === "CHECKPOINT") checkpoint = operation;
      else {
        if (checkpoint) retained.push(checkpoint);
        checkpoint = null;
        retained.push(operation);
      }
    }
    if (checkpoint) retained.push(checkpoint);
    const retainedIds = new Set(retained.map((item) => item.id));
    for (const operation of operations) {
      if (!retainedIds.has(operation.id)) await this.local.removeOperation(operation.id);
    }
    return retained;
  }

  private updateStatus(documentId: string, status: HybridStatus): HybridStatus {
    this.statuses.set(documentId, clone(status));
    return clone(status);
  }
}

export class InMemoryLocalDraftStore implements LocalDraftStore {
  private readonly documents = new Map<string, TimelineDocument>();
  private readonly operations = new Map<string, PendingOperation>();

  async putDocument(document: TimelineDocument): Promise<void> {
    this.documents.set(document.id, clone(document));
  }

  async getDocument(id: string): Promise<TimelineDocument | null> {
    const value = this.documents.get(id);
    return value ? clone(value) : null;
  }

  async putOperation(operation: PendingOperation): Promise<void> {
    this.operations.set(operation.id, clone(operation));
  }

  async listOperations(documentId: string): Promise<PendingOperation[]> {
    return [...this.operations.values()]
      .filter((item) => item.documentId === documentId)
      .map(clone)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async removeOperation(id: string): Promise<void> {
    this.operations.delete(id);
  }
}
