import type { FileVaultLink, PrincipalContext, TimelineArtifact } from "../contracts/types.js";
import { newId, now } from "../core/canonical.js";
import { TimelineError } from "../core/errors.js";
import type { TimelineRepository } from "../persistence/repository.js";

export interface FileVaultPublishResult {
  externalFileId: string;
  externalVersionId: string;
  adapter: FileVaultLink["adapter"];
}

export interface FileVaultAdapter {
  readonly kind: FileVaultLink["adapter"];
  readonly enabled: boolean;
  publish(artifact: TimelineArtifact): Promise<FileVaultPublishResult>;
}

export interface LegacyFileVaultClient {
  createUpload(input: {
    ownerPrincipalId: string;
    category: "timeline";
    filename: string;
    mimeType: string;
    bytes: number;
    contentSha256: string;
  }): Promise<{ fileId: string; uploadId: string }>;
  confirmUpload(fileId: string, uploadId: string, artifactId: string): Promise<{ versionId: string }>;
}

export class LegacyFileVaultAdapter implements FileVaultAdapter {
  readonly kind = "LEGACY" as const;
  readonly enabled = true;

  constructor(private readonly client: LegacyFileVaultClient) {}

  async publish(artifact: TimelineArtifact): Promise<FileVaultPublishResult> {
    const primary = artifact.primaryFile;
    if (!primary) throw new TimelineError("FILEVAULT_PRIMARY_FILE_MISSING", "Artifact has no primary file.", 409);
    const upload = await this.client.createUpload({
      ownerPrincipalId: artifact.studentOwnerId,
      category: "timeline",
      filename: primary.filename,
      mimeType: primary.mimeType,
      bytes: primary.byteSize,
      contentSha256: primary.contentHash,
    });
    const confirmed = await this.client.confirmUpload(upload.fileId, upload.uploadId, artifact.artifactId);
    return { externalFileId: upload.fileId, externalVersionId: confirmed.versionId, adapter: this.kind };
  }
}

export class FileVaultV2Adapter implements FileVaultAdapter {
  readonly kind = "V2" as const;

  constructor(
    readonly enabled = false,
    private readonly publishFn?: (artifact: TimelineArtifact) => Promise<FileVaultPublishResult>,
  ) {}

  async publish(artifact: TimelineArtifact): Promise<FileVaultPublishResult> {
    if (!this.enabled || !this.publishFn) {
      throw new TimelineError("FILEVAULT_V2_NOT_RATIFIED", "FileVault v2 remains disabled until its contract is ratified.", 501);
    }
    const result = await this.publishFn(artifact);
    if (result.adapter !== this.kind) throw new TimelineError("FILEVAULT_V2_RESPONSE_INVALID", "FileVault v2 adapter response is invalid.", 502);
    return result;
  }
}

export class FileVaultPublisher {
  constructor(
    private readonly repository: TimelineRepository,
    private readonly adapters: Map<FileVaultLink["adapter"], FileVaultAdapter>,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async publish(serviceContext: PrincipalContext, artifactId: string, adapterKind: FileVaultLink["adapter"]): Promise<FileVaultLink> {
    if (serviceContext.role !== "SERVICE" || !serviceContext.serviceScopes.includes("filevault:publish")) {
      throw new TimelineError("FILEVAULT_SERVICE_SCOPE_REQUIRED", "FileVault service scope is required.", 403);
    }
    const existing = await this.repository.getFileVaultLink(artifactId, adapterKind);
    if (existing?.status === "LINKED") return existing;
    const artifact = await this.repository.getArtifact(artifactId);
    if (!artifact) throw new TimelineError("ARTIFACT_NOT_FOUND", "Artifact not found.", 404);
    const adapter = this.adapters.get(adapterKind);
    if (!adapter?.enabled) throw new TimelineError("FILEVAULT_ADAPTER_DISABLED", "FileVault adapter is disabled.", 503);
    const createdAt = existing?.createdAt ?? now(this.clock);
    try {
      const result = await adapter.publish(artifact);
      const link: FileVaultLink = {
        id: existing?.id ?? newId("vault_link"),
        artifactId,
        adapter: adapterKind,
        externalFileId: result.externalFileId,
        externalVersionId: result.externalVersionId,
        status: "LINKED",
        artifactHash: artifact.contentHash,
        createdAt,
        updatedAt: now(this.clock),
      };
      const saved = await this.repository.saveFileVaultLink(link);
      await this.repository.addOutbox({
        id: newId("outbox"),
        aggregateId: artifact.timelineDocumentId,
        eventType: "timeline.filevault.published",
        payload: { artifactId, adapter: adapterKind, externalFileId: saved.externalFileId, externalVersionId: saved.externalVersionId },
        attempts: 0,
        availableAt: saved.updatedAt,
        publishedAt: null,
      });
      return saved;
    } catch (error) {
      const failed: FileVaultLink = {
        id: existing?.id ?? newId("vault_link"),
        artifactId,
        adapter: adapterKind,
        externalFileId: existing?.externalFileId ?? "",
        externalVersionId: existing?.externalVersionId ?? "",
        status: "FAILED",
        artifactHash: artifact.contentHash,
        createdAt,
        updatedAt: now(this.clock),
        errorCode: error instanceof TimelineError ? error.code : "FILEVAULT_PUBLISH_FAILED",
      };
      await this.repository.saveFileVaultLink(failed);
      throw error;
    }
  }
}

export class InMemoryLegacyFileVaultClient implements LegacyFileVaultClient {
  private sequence = 0;
  readonly uploads: Array<Record<string, unknown>> = [];

  async createUpload(input: Parameters<LegacyFileVaultClient["createUpload"]>[0]): Promise<{ fileId: string; uploadId: string }> {
    this.sequence += 1;
    const value = { ...input, fileId: `legacy_file_${this.sequence}`, uploadId: `legacy_upload_${this.sequence}` };
    this.uploads.push(value);
    return { fileId: value.fileId, uploadId: value.uploadId };
  }

  async confirmUpload(fileId: string, uploadId: string, artifactId: string): Promise<{ versionId: string }> {
    if (!this.uploads.some((item) => item.fileId === fileId && item.uploadId === uploadId)) {
      throw new TimelineError("LEGACY_UPLOAD_NOT_FOUND", "Legacy FileVault upload not found.", 404);
    }
    return { versionId: `legacy_version_${artifactId.slice(-12)}` };
  }
}
