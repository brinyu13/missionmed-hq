import type {
  AdvisorAssignment,
  ApprovalEvent,
  ArtifactType,
  AuditEvent,
  CheckpointRecord,
  DocumentRecord,
  ExportJob,
  PrincipalContext,
  ReviewComment,
  ReviewRequest,
  TimelineAction,
  TimelineDocument,
  TimelineVersion,
} from "../contracts/types.js";
import {
  canonicalDocumentHash,
  clone,
  newId,
  now,
  safeText,
  sha256,
  stableStringify,
  validateTimelineDocument,
} from "../core/canonical.js";
import { TimelineError } from "../core/errors.js";
import type { TimelineRepository } from "../persistence/repository.js";
import { decide, type AuthorizedResource } from "../security/authorization.js";
import { assertContentSafe } from "../security/content-policy.js";

export interface CreateDocumentInput {
  id?: string;
  programId: string;
  title: string;
  theme?: string;
  document?: Partial<TimelineDocument>;
}

const ARTIFACT_TYPES = new Set<ArtifactType>([
  "TIMELINE_INTERVIEWER_SAFE_PNG",
  "TIMELINE_FULL_STORY_PNG",
  "TIMELINE_PRINT_PDF",
  "TIMELINE_ADVISOR_PACKET_PDF",
  "TIMELINE_ARCHIVE",
  "TIMELINE_SOURCE_JSON",
  "TIMELINE_ACCESSIBLE_HTML",
]);

const EXPORT_SCOPES = new Set(["INTERVIEWER_SAFE", "FULL_STORY", "ADVISOR_PACKET", "PRINT", "ARCHIVE", "SOURCE", "ACCESSIBLE"]);

export class TimelineService {
  constructor(
    readonly repository: TimelineRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async createDocument(context: PrincipalContext, input: CreateDocumentInput): Promise<DocumentRecord> {
    await this.require(context, "document:create", {}, "document", input.id ?? "new");
    if (!context.programIds.includes(input.programId)) {
      await this.audit(context, "document:create", "document", input.id ?? "new", "DENY", "PROGRAM_SCOPE_MISSING");
      throw new TimelineError("PROGRAM_SCOPE_MISSING", "Student is not a member of this program.", 403);
    }
    assertContentSafe({ title: input.title });
    const createdAt = now(this.clock);
    const document: TimelineDocument = {
      ...(clone(input.document ?? {}) as TimelineDocument),
      id: input.id ?? newId("timeline"),
      schemaVersion: "d1-timeline-document-409.1",
      studentOwnerId: context.principalId,
      programId: input.programId,
      title: safeText(input.title, 200),
      theme: input.theme ?? "keynote",
      revision: 0,
      events: clone(input.document?.events ?? []),
      metadata: {
        ...(clone(input.document?.metadata ?? {}) as Record<string, unknown>),
        applicationVersion: "D1-412.0",
        source: "mission-timeline-repo-package",
        updatedAt: createdAt,
      },
    };
    validateTimelineDocument(document);
    this.assertDocumentContentSafe(document);
    const record: DocumentRecord = {
      document,
      currentVersionId: null,
      status: "DRAFT",
      createdAt,
      updatedAt: createdAt,
    };
    const created = await this.repository.createDocument(record);
    await this.repository.addOutbox({
      id: newId("outbox"),
      aggregateId: document.id,
      eventType: "timeline.document.created",
      payload: { documentId: document.id, ownerPrincipalId: context.principalId, programId: input.programId },
      attempts: 0,
      availableAt: createdAt,
      publishedAt: null,
    });
    await this.audit(context, "document:create", "document", document.id, "SUCCESS", "CREATED");
    return created;
  }

  async listOwnDocuments(context: PrincipalContext): Promise<DocumentRecord[]> {
    if (context.role !== "STUDENT") throw new TimelineError("FORBIDDEN", "Student role required.", 403);
    return this.repository.listDocumentsForOwner(context.principalId);
  }

  async getDocument(context: PrincipalContext, documentId: string): Promise<DocumentRecord> {
    const record = await this.requireDocument(documentId);
    await this.require(context, "document:read", this.resource(record), "document", documentId);
    return record;
  }

  async saveCheckpoint(
    context: PrincipalContext,
    documentId: string,
    deviceId: string,
    baseRevision: number,
    snapshot: TimelineDocument,
  ): Promise<CheckpointRecord> {
    const record = await this.requireDocument(documentId);
    await this.require(context, "document:edit", this.resource(record), "document", documentId);
    if (record.document.revision !== baseRevision) {
      throw new TimelineError("REVISION_CONFLICT", "Checkpoint is based on a stale revision.", 409, {
        baseRevision,
        currentRevision: record.document.revision,
      });
    }
    const sanitized = clone(snapshot);
    sanitized.id = documentId;
    sanitized.studentOwnerId = record.document.studentOwnerId;
    sanitized.programId = record.document.programId;
    sanitized.revision = baseRevision;
    validateTimelineDocument(sanitized);
    this.assertDocumentContentSafe(sanitized);
    const createdAt = now(this.clock);
    const checkpoint: CheckpointRecord = {
      id: `${documentId}:${safeText(deviceId, 100)}`,
      documentId,
      deviceId: safeText(deviceId, 100),
      baseRevision,
      snapshot: sanitized,
      createdAt,
      expiresAt: new Date(this.clock().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const saved = await this.repository.saveCheckpoint(checkpoint);
    await this.audit(context, "document:edit", "checkpoint", checkpoint.id, "SUCCESS", "CHECKPOINT_SAVED");
    return saved;
  }

  async createVersion(
    context: PrincipalContext,
    documentId: string,
    expectedRevision: number,
    snapshot: TimelineDocument,
    label: string,
  ): Promise<TimelineVersion> {
    const record = await this.requireDocument(documentId);
    await this.require(context, "version:create", this.resource(record), "document", documentId);
    const next = clone(snapshot);
    next.id = documentId;
    next.schemaVersion = "d1-timeline-document-409.1";
    next.studentOwnerId = record.document.studentOwnerId;
    next.programId = record.document.programId;
    next.revision = expectedRevision + 1;
    next.metadata = { ...(next.metadata ?? {}), updatedAt: now(this.clock), applicationVersion: "D1-412.0" };
    validateTimelineDocument(next);
    this.assertDocumentContentSafe(next);
    const contentSha256 = canonicalDocumentHash(next);
    const createdAt = now(this.clock);
    const version: TimelineVersion = {
      id: `version_${sha256(stableStringify([documentId, next.revision, contentSha256])).slice(0, 32)}`,
      documentId,
      revision: next.revision,
      parentVersionId: record.currentVersionId,
      label: safeText(label || `Version ${next.revision}`, 160),
      snapshot: next,
      contentSha256,
      createdBy: context.principalId,
      createdAt,
    };
    const nextRecord: DocumentRecord = {
      ...record,
      document: next,
      currentVersionId: version.id,
      status: "DRAFT",
      updatedAt: createdAt,
    };
    const saved = await this.repository.saveVersion(documentId, expectedRevision, nextRecord, version);
    await this.invalidatePriorApproval(context, documentId, saved);
    await this.repository.addOutbox({
      id: newId("outbox"),
      aggregateId: documentId,
      eventType: "timeline.document.versioned",
      payload: { documentId, versionId: saved.id, revision: saved.revision, contentSha256: saved.contentSha256 },
      attempts: 0,
      availableAt: createdAt,
      publishedAt: null,
    });
    await this.audit(context, "version:create", "version", version.id, "SUCCESS", "VERSION_CREATED");
    return saved;
  }

  async assignAdvisor(context: PrincipalContext, assignment: AdvisorAssignment): Promise<AdvisorAssignment> {
    const record = await this.requireDocument(assignment.documentId);
    if (context.role !== "PROGRAM_ADMIN" || !context.programIds.includes(record.document.programId)) {
      throw new TimelineError("FORBIDDEN", "Program administrator scope is required.", 403);
    }
    if (assignment.programId !== record.document.programId) throw new TimelineError("ASSIGNMENT_PROGRAM_MISMATCH", "Program mismatch.", 400);
    const saved = await this.repository.addAssignment(assignment);
    await this.audit(context, "review:request", "assignment", assignment.documentId, "SUCCESS", "ADVISOR_ASSIGNED");
    return saved;
  }

  async requestReview(context: PrincipalContext, documentId: string, versionId: string): Promise<ReviewRequest> {
    const record = await this.requireDocument(documentId);
    await this.require(context, "review:request", this.resource(record), "document", documentId);
    const version = await this.repository.getVersion(versionId);
    if (!version || version.documentId !== documentId) throw new TimelineError("VERSION_NOT_FOUND", "Version not found.", 404);
    const at = now(this.clock);
    const assignment = await this.repository.findActiveAssignment(documentId, at);
    if (!assignment) throw new TimelineError("ADVISOR_NOT_ASSIGNED", "No active advisor assignment exists.", 409);
    const review: ReviewRequest = {
      id: `review_${sha256(stableStringify([documentId, versionId, assignment.advisorPrincipalId])).slice(0, 32)}`,
      documentId,
      versionId,
      versionHash: version.contentSha256,
      requestedBy: context.principalId,
      assignedTo: assignment.advisorPrincipalId,
      status: "REQUESTED",
      createdAt: at,
      updatedAt: at,
    };
    const saved = await this.repository.createReview(review);
    await this.repository.addOutbox({
      id: newId("outbox"),
      aggregateId: documentId,
      eventType: "timeline.review.requested",
      payload: { documentId, versionId, reviewRequestId: saved.id, assignedTo: assignment.advisorPrincipalId },
      attempts: 0,
      availableAt: at,
      publishedAt: null,
    });
    await this.audit(context, "review:request", "review", review.id, "SUCCESS", "REVIEW_REQUESTED");
    return saved;
  }

  async addComment(
    context: PrincipalContext,
    reviewId: string,
    body: string,
    visibility: "SHARED" | "ADVISOR_ONLY",
    anchor: Record<string, unknown> = {},
  ): Promise<ReviewComment> {
    const { review, record } = await this.reviewAndDocument(reviewId);
    await this.require(context, "review:comment", { ...this.resource(record), versionId: review.versionId }, "review", reviewId);
    if (context.role === "STUDENT" && visibility === "ADVISOR_ONLY") {
      throw new TimelineError("COMMENT_VISIBILITY_DENIED", "Students cannot create advisor-only comments.", 403);
    }
    assertContentSafe({ body });
    const createdAt = now(this.clock);
    const comment: ReviewComment = {
      id: newId("comment"),
      reviewRequestId: reviewId,
      authorId: context.principalId,
      authorRole: context.role,
      body: safeText(body, 4_000),
      visibility,
      anchor: clone(anchor),
      status: "OPEN",
      createdAt,
    };
    const saved = await this.repository.addComment(comment);
    await this.repository.addOutbox({
      id: newId("outbox"),
      aggregateId: review.documentId,
      eventType: "timeline.comment.created",
      payload: { documentId: review.documentId, reviewRequestId: reviewId, commentId: saved.id, visibility },
      attempts: 0,
      availableAt: createdAt,
      publishedAt: null,
    });
    await this.audit(context, "review:comment", "comment", comment.id, "SUCCESS", "COMMENT_CREATED");
    return saved;
  }

  async decideReview(
    context: PrincipalContext,
    reviewId: string,
    decision: "APPROVED" | "CHANGES_REQUESTED",
    reason: string,
  ): Promise<ApprovalEvent> {
    const { review, record } = await this.reviewAndDocument(reviewId);
    await this.require(context, "review:decide", { ...this.resource(record), versionId: review.versionId }, "review", reviewId);
    if (context.principalId !== review.assignedTo && context.role !== "PROGRAM_ADMIN") {
      throw new TimelineError("REVIEW_ASSIGNMENT_MISMATCH", "Reviewer is not assigned to this request.", 403);
    }
    const version = await this.repository.getVersion(review.versionId);
    if (!version || version.contentSha256 !== review.versionHash) throw new TimelineError("REVIEW_VERSION_INVALID", "Review version changed.", 409);
    assertContentSafe({ reason });
    const createdAt = now(this.clock);
    const event: ApprovalEvent = {
      id: newId("approval"),
      reviewRequestId: reviewId,
      documentId: review.documentId,
      versionId: review.versionId,
      contentSha256: review.versionHash,
      decision,
      actorId: context.principalId,
      reason: safeText(reason, 1_000),
      createdAt,
    };
    await this.repository.addApproval(event);
    review.status = decision;
    review.updatedAt = createdAt;
    await this.repository.updateReview(review);
    await this.repository.addOutbox({
      id: newId("outbox"),
      aggregateId: review.documentId,
      eventType: decision === "APPROVED" ? "timeline.review.approved" : "timeline.review.changes_requested",
      payload: { documentId: review.documentId, versionId: review.versionId, reviewRequestId: reviewId },
      attempts: 0,
      availableAt: createdAt,
      publishedAt: null,
    });
    await this.audit(context, "review:decide", "review", reviewId, "SUCCESS", decision);
    return event;
  }

  async createExportJob(
    context: PrincipalContext,
    documentId: string,
    versionId: string,
    artifactType: ArtifactType,
    scope: string,
    renderer: ExportJob["renderer"] = "MAC_PRO_AUTHORITY",
  ): Promise<ExportJob> {
    const record = await this.requireDocument(documentId);
    await this.require(context, "artifact:create", { ...this.resource(record), versionId }, "document", documentId);
    const version = await this.repository.getVersion(versionId);
    if (!version || version.documentId !== documentId) throw new TimelineError("VERSION_NOT_FOUND", "Version not found.", 404);
    if (!ARTIFACT_TYPES.has(artifactType)) throw new TimelineError("ARTIFACT_TYPE_INVALID", "Artifact type is not supported.", 400);
    if (!EXPORT_SCOPES.has(scope)) throw new TimelineError("EXPORT_SCOPE_INVALID", "Export scope is not supported.", 400);
    if (renderer === "MAC_PRO_AUTHORITY" && !(await this.isApproved(documentId, versionId, version.contentSha256))) {
      throw new TimelineError("APPROVAL_REQUIRED", "Official export requires approval of this exact version.", 409);
    }
    const idempotencyKey = sha256(stableStringify([documentId, versionId, artifactType, scope, renderer]));
    const existing = await this.repository.findExportJobByIdempotencyKey(idempotencyKey);
    if (existing) return existing;
    const createdAt = now(this.clock);
    const job: ExportJob = {
      id: newId("export"),
      documentId,
      versionId,
      artifactType,
      scope,
      requestedBy: context.principalId,
      renderer,
      status: "QUEUED",
      idempotencyKey,
      createdAt,
      updatedAt: createdAt,
    };
    const saved = await this.repository.createExportJob(job);
    await this.repository.addOutbox({
      id: newId("outbox"),
      aggregateId: documentId,
      eventType: "timeline.export.requested",
      payload: { exportJobId: saved.id, documentId, versionId, artifactType, scope, renderer },
      attempts: 0,
      availableAt: createdAt,
      publishedAt: null,
    });
    await this.audit(context, "artifact:create", "export_job", job.id, "SUCCESS", "EXPORT_QUEUED");
    return saved;
  }

  async getExportJob(context: PrincipalContext, jobId: string): Promise<ExportJob> {
    const job = await this.repository.getExportJob(jobId);
    if (!job) throw new TimelineError("EXPORT_JOB_NOT_FOUND", "Export job not found.", 404);
    const record = await this.requireDocument(job.documentId);
    await this.require(context, "artifact:read", { ...this.resource(record), versionId: job.versionId }, "export_job", jobId);
    return job;
  }

  async isApproved(documentId: string, versionId: string, contentSha256: string): Promise<boolean> {
    const events = await this.repository.listApprovals(documentId);
    const relevant = events.filter((item) => item.versionId === versionId && item.contentSha256 === contentSha256);
    const latest = relevant.at(-1);
    return latest?.decision === "APPROVED";
  }

  private async invalidatePriorApproval(
    context: PrincipalContext,
    documentId: string,
    nextVersion: TimelineVersion,
  ): Promise<void> {
    const approvals = await this.repository.listApprovals(documentId);
    const currentApproval = [...approvals].reverse().find((item) => item.decision === "APPROVED");
    if (!currentApproval || currentApproval.contentSha256 === nextVersion.contentSha256) return;
    const createdAt = now(this.clock);
    await this.repository.addApproval({
      id: newId("approval"),
      reviewRequestId: currentApproval.reviewRequestId,
      documentId,
      versionId: currentApproval.versionId,
      contentSha256: currentApproval.contentSha256,
      decision: "INVALIDATED",
      actorId: context.principalId,
      reason: `Material document revision ${nextVersion.revision} created.`,
      createdAt,
    });
    await this.repository.addOutbox({
      id: newId("outbox"),
      aggregateId: documentId,
      eventType: "timeline.approval.invalidated",
      payload: { documentId, previousVersionId: currentApproval.versionId, newVersionId: nextVersion.id },
      attempts: 0,
      availableAt: createdAt,
      publishedAt: null,
    });
  }

  private async reviewAndDocument(reviewId: string): Promise<{ review: ReviewRequest; record: DocumentRecord }> {
    const review = await this.repository.getReview(reviewId);
    if (!review) throw new TimelineError("REVIEW_NOT_FOUND", "Review request not found.", 404);
    return { review, record: await this.requireDocument(review.documentId) };
  }

  private async requireDocument(documentId: string): Promise<DocumentRecord> {
    const record = await this.repository.getDocument(documentId);
    if (!record || record.status === "DELETED") throw new TimelineError("DOCUMENT_NOT_FOUND", "Document not found.", 404);
    return record;
  }

  private resource(record: DocumentRecord): AuthorizedResource {
    return {
      documentId: record.document.id,
      ownerPrincipalId: record.document.studentOwnerId,
      programId: record.document.programId,
      versionId: record.currentVersionId ?? undefined,
    };
  }

  private assertDocumentContentSafe(document: TimelineDocument): void {
    const fields: Record<string, unknown> = { title: document.title };
    document.events.forEach((event, index) => {
      fields[`events.${index}.title`] = event.title;
      fields[`events.${index}.siteName`] = event.siteName;
      fields[`events.${index}.location`] = event.location;
      fields[`events.${index}.notes`] = event.notes;
    });
    assertContentSafe(fields);
  }

  private async require(
    context: PrincipalContext,
    action: TimelineAction,
    resource: AuthorizedResource,
    resourceType: string,
    resourceId: string,
  ): Promise<void> {
    const decision = decide(context, action, resource, this.clock);
    if (!decision.allowed) {
      await this.audit(context, action, resourceType, resourceId, "DENY", decision.reason);
      throw new TimelineError("FORBIDDEN", `Timeline action denied: ${decision.reason}`, 403, {
        action,
        reason: decision.reason,
      });
    }
  }

  private async audit(
    context: PrincipalContext,
    action: string,
    resourceType: string,
    resourceId: string,
    outcome: AuditEvent["outcome"],
    reason: string,
  ): Promise<void> {
    await this.repository.addAudit({
      id: newId("audit"),
      actorId: context.principalId,
      action,
      resourceType,
      resourceId,
      outcome,
      requestId: context.requestId,
      metadata: { reason },
      createdAt: now(this.clock),
    });
  }
}
