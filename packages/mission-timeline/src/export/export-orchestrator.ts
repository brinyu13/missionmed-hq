import type {
  ArtifactFile,
  ExportJob,
  PrincipalContext,
  TimelineArtifact,
  TimelineDocument,
  VisibilityState,
} from "../contracts/types.js";
import { clone, newId, now, sha256, stableStringify } from "../core/canonical.js";
import { TimelineError } from "../core/errors.js";
import type { TimelineRepository } from "../persistence/repository.js";
import type { PrivateObjectStore } from "../storage/private-object-store.js";
import type { TimelineRenderer } from "./renderer.js";

const SCOPE_VISIBILITY: Record<string, VisibilityState[]> = {
  INTERVIEWER_SAFE: ["INTERVIEWER_SAFE"],
  FULL_STORY: ["INTERVIEWER_SAFE", "FULL_STORY"],
  ADVISOR_PACKET: ["INTERVIEWER_SAFE", "FULL_STORY", "ADVISOR_ONLY"],
  PRINT: ["INTERVIEWER_SAFE"],
  SOURCE: ["INTERVIEWER_SAFE", "FULL_STORY", "ADVISOR_ONLY", "STUDENT_ONLY"],
  ARCHIVE: ["INTERVIEWER_SAFE", "FULL_STORY", "ADVISOR_ONLY", "STUDENT_ONLY"],
  ACCESSIBLE: ["INTERVIEWER_SAFE"],
};

export function projectDocumentForExport(document: TimelineDocument, scope: string): TimelineDocument {
  const allowed = SCOPE_VISIBILITY[scope];
  if (!allowed) throw new TimelineError("EXPORT_SCOPE_INVALID", "Export scope is not supported.", 400);
  const projected = clone(document);
  projected.events = projected.events.filter((event) => allowed.includes(event.visibilityState));
  projected.mediaItems = (projected.mediaItems ?? []).filter((item) => {
    const media = item as { visibilityState?: unknown; visibility?: unknown };
    const visibility = media.visibilityState ?? media.visibility;
    return typeof visibility === "string" && allowed.includes(visibility as VisibilityState);
  });
  delete projected.documentPages;
  delete projected.sourceBlocks;
  delete projected.extractionCandidates;
  delete projected.candidateConflicts;
  delete projected.humanReviewActions;
  delete projected.persistence;
  delete projected.recovery;
  delete projected.advisorReview;
  delete projected.generatedQuestions;
  delete projected.interviewPractice;
  delete projected.comments;
  projected.sourceDocuments = (projected.sourceDocuments ?? []).map((item) => {
    const source = item as Record<string, unknown>;
    return { id: source.id, kind: source.kind, sha256: source.sha256, removed: source.removed };
  });
  projected.metadata = { exportScope: scope, sanitizedForServerRender: true };
  return projected;
}

export class ExportOrchestrator {
  constructor(
    private readonly repository: TimelineRepository,
    private readonly objectStore: PrivateObjectStore,
    private readonly renderers: Map<ExportJob["renderer"], TimelineRenderer>,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async process(serviceContext: PrincipalContext, jobId: string): Promise<TimelineArtifact> {
    if (serviceContext.role !== "SERVICE" || !serviceContext.serviceScopes.includes("artifact:create")) {
      throw new TimelineError("EXPORT_SERVICE_SCOPE_REQUIRED", "Export service scope is required.", 403);
    }
    const job = await this.repository.getExportJob(jobId);
    if (!job) throw new TimelineError("EXPORT_JOB_NOT_FOUND", "Export job not found.", 404);
    if (job.status === "COMPLETED" && job.artifactId) {
      const existing = await this.repository.getArtifact(job.artifactId);
      if (existing) return existing;
    }
    const version = await this.repository.getVersion(job.versionId);
    if (!version || version.documentId !== job.documentId) throw new TimelineError("EXPORT_VERSION_NOT_FOUND", "Export version not found.", 404);
    const record = await this.repository.getDocument(job.documentId);
    if (!record) throw new TimelineError("DOCUMENT_NOT_FOUND", "Document not found.", 404);
    const renderer = this.renderers.get(job.renderer);
    if (!renderer || renderer.authority !== job.renderer) throw new TimelineError("RENDERER_UNAVAILABLE", "Requested renderer is unavailable.", 503);
    if (job.renderer === "MAC_PRO_AUTHORITY") {
      const approvals = await this.repository.listApprovals(job.documentId);
      const latest = approvals
        .filter((event) => event.versionId === job.versionId && event.contentSha256 === version.contentSha256)
        .at(-1);
      if (latest?.decision !== "APPROVED") {
        throw new TimelineError("APPROVAL_REQUIRED", "Official export approval is no longer valid for this version.", 409);
      }
    }

    job.status = "RUNNING";
    job.updatedAt = now(this.clock);
    await this.repository.updateExportJob(job);
    try {
      const projected = projectDocumentForExport(version.snapshot, job.scope);
      const render = await renderer.render({
        jobId: job.id,
        artifactType: job.artifactType,
        scope: job.scope,
        document: projected,
        sourceVersionId: version.id,
        sourceContentSha256: version.contentSha256,
        theme: projected.theme,
      });
      const files: ArtifactFile[] = [];
      for (const file of render.files) {
        const fileHash = sha256(file.bytes);
        const object = await this.objectStore.putServiceObject(
          serviceContext,
          {
            documentId: job.documentId,
            ownerPrincipalId: record.document.studentOwnerId,
            objectClass: file.role === "PREVIEW" ? "PREVIEW" : "EXPORT",
            mimeType: file.mimeType,
            byteSize: file.bytes.byteLength,
            sha256: fileHash,
          },
          file.bytes,
        );
        files.push({
          role: file.role,
          objectId: object.id,
          filename: file.filename,
          mimeType: file.mimeType,
          byteSize: file.bytes.byteLength,
          sha256: fileHash,
          contentHash: fileHash,
        });
      }
      const createdAt = now(this.clock);
      const primaryFile = files.find((file) => file.role === "PRIMARY");
      if (!primaryFile) throw new TimelineError("RENDER_PRIMARY_FILE_MISSING", "Renderer returned no primary file.", 502);
      const companionFiles = files.filter((file) => file.role !== "PRIMARY");
      const previewImage = files.find((file) => file.role === "PREVIEW") ?? null;
      const artifactHash = sha256(stableStringify(files.map((file) => ({ role: file.role, sha256: file.sha256 }))));
      const artifact: TimelineArtifact = {
        artifactId: `artifact_${sha256(job.idempotencyKey).slice(0, 32)}`,
        artifactSchemaVersion: "d1-timeline-artifact-409.1",
        artifactType: job.artifactType,
        timelineDocumentId: job.documentId,
        timelineVersionId: job.versionId,
        studentOwnerId: record.document.studentOwnerId,
        programId: record.document.programId,
        createdByRole: "SYSTEM_LOCAL",
        createdAt,
        updatedAt: createdAt,
        displayName: primaryFile.filename,
        description: `Mission Timeline ${job.scope.toLowerCase().replaceAll("_", " ")} export`,
        documentCategory: "MISSION_TIMELINE",
        mimeType: primaryFile.mimeType,
        byteSize: primaryFile.byteSize,
        contentHash: artifactHash,
        exportScope: job.scope as TimelineArtifact["exportScope"],
        visibility: job.scope === "INTERVIEWER_SAFE" || job.scope === "PRINT" || job.scope === "ACCESSIBLE"
          ? "INTERVIEWER_SAFE"
          : job.scope === "ADVISOR_PACKET"
            ? "ADVISOR_ONLY"
            : "FULL_STORY",
        approvalState: { sourceVersionId: version.id, sourceContentSha256: version.contentSha256 },
        theme: projected.theme,
        dimensions: null,
        pageCount: primaryFile.mimeType === "application/pdf" ? 1 : null,
        previewImage,
        primaryFile,
        companionFiles,
        sourceDocumentReferences: (projected.sourceDocuments ?? []).map((item) => clone(item as Record<string, unknown>)),
        timelineEventCount: projected.events.length,
        generatedQuestionCount: Array.isArray(projected.generatedQuestions) ? projected.generatedQuestions.length : 0,
        advisorCommentCount: 0,
        files,
        warnings: [...render.warnings, `RENDERER_${render.rendererVersion}`, `ASSET_MANIFEST_${render.assetManifestSha256}`],
        provenanceSummary: {
          sourceVersionId: version.id,
          sourceContentSha256: version.contentSha256,
          renderer: render.rendererVersion,
          assetManifestSha256: render.assetManifestSha256,
        },
        retentionClass: "STUDENT_CONTROLLED_PRIVATE",
        fileVaultLinkageState: "PENDING",
        legacyVaultReference: null,
        v2VaultReference: null,
        synchronizationStatus: "ARTIFACT_READY",
        synchronizationHistory: [{ status: "ARTIFACT_READY", at: createdAt, actor: "EXPORT_ORCHESTRATOR" }],
        idempotencyKey: job.idempotencyKey,
      };
      const saved = await this.repository.addArtifact(artifact);
      job.status = "COMPLETED";
      job.artifactId = saved.artifactId;
      job.updatedAt = createdAt;
      await this.repository.updateExportJob(job);
      await this.repository.addOutbox({
        id: newId("outbox"),
        aggregateId: job.documentId,
        eventType: "timeline.artifact.ready",
        payload: {
          artifactId: saved.artifactId,
          documentId: job.documentId,
          versionId: job.versionId,
          artifactType: job.artifactType,
          contentHash: saved.contentHash,
        },
        attempts: 0,
        availableAt: createdAt,
        publishedAt: null,
      });
      return saved;
    } catch (error) {
      job.status = "FAILED";
      job.errorCode = error instanceof TimelineError ? error.code : "RENDER_FAILED";
      job.updatedAt = now(this.clock);
      await this.repository.updateExportJob(job);
      throw error;
    }
  }
}
