import type {
  AdvisorAssignment,
  ApprovalEvent,
  ArtifactType,
  AuditEvent,
  CheckpointRecord,
  DocumentRecord,
  ExportJob,
  FileVaultLink,
  OutboxEvent,
  ReviewComment,
  ReviewRequest,
  TimelineArtifact,
  TimelineVersion,
} from "../contracts/types.js";
import { clone } from "../core/canonical.js";
import { TimelineError } from "../core/errors.js";

export interface TimelineRepository {
  createDocument(record: DocumentRecord): Promise<DocumentRecord>;
  getDocument(id: string): Promise<DocumentRecord | null>;
  listDocumentsForOwner(ownerPrincipalId: string): Promise<DocumentRecord[]>;
  saveCheckpoint(checkpoint: CheckpointRecord): Promise<CheckpointRecord>;
  saveVersion(
    documentId: string,
    expectedRevision: number,
    nextRecord: DocumentRecord,
    version: TimelineVersion,
  ): Promise<TimelineVersion>;
  getVersion(id: string): Promise<TimelineVersion | null>;
  listVersions(documentId: string): Promise<TimelineVersion[]>;
  addAssignment(assignment: AdvisorAssignment): Promise<AdvisorAssignment>;
  findActiveAssignment(documentId: string, at: string): Promise<AdvisorAssignment | null>;
  createReview(review: ReviewRequest): Promise<ReviewRequest>;
  getReview(id: string): Promise<ReviewRequest | null>;
  updateReview(review: ReviewRequest): Promise<ReviewRequest>;
  addComment(comment: ReviewComment): Promise<ReviewComment>;
  listComments(reviewRequestId: string): Promise<ReviewComment[]>;
  addApproval(event: ApprovalEvent): Promise<ApprovalEvent>;
  listApprovals(documentId: string): Promise<ApprovalEvent[]>;
  createExportJob(job: ExportJob): Promise<ExportJob>;
  getExportJob(id: string): Promise<ExportJob | null>;
  updateExportJob(job: ExportJob): Promise<ExportJob>;
  findExportJobByIdempotencyKey(key: string): Promise<ExportJob | null>;
  addArtifact(artifact: TimelineArtifact): Promise<TimelineArtifact>;
  getArtifact(id: string): Promise<TimelineArtifact | null>;
  saveFileVaultLink(link: FileVaultLink): Promise<FileVaultLink>;
  getFileVaultLink(artifactId: string, adapter: FileVaultLink["adapter"]): Promise<FileVaultLink | null>;
  addAudit(event: AuditEvent): Promise<void>;
  listAudit(resourceId?: string): Promise<AuditEvent[]>;
  addOutbox(event: OutboxEvent): Promise<void>;
  pendingOutbox(limit?: number): Promise<OutboxEvent[]>;
  markOutboxPublished(id: string, publishedAt: string): Promise<void>;
}

export class InMemoryTimelineRepository implements TimelineRepository {
  private readonly documents = new Map<string, DocumentRecord>();
  private readonly versions = new Map<string, TimelineVersion>();
  private readonly checkpoints = new Map<string, CheckpointRecord>();
  private readonly assignments: AdvisorAssignment[] = [];
  private readonly reviews = new Map<string, ReviewRequest>();
  private readonly comments = new Map<string, ReviewComment>();
  private readonly approvals: ApprovalEvent[] = [];
  private readonly jobs = new Map<string, ExportJob>();
  private readonly artifacts = new Map<string, TimelineArtifact>();
  private readonly fileVaultLinks = new Map<string, FileVaultLink>();
  private readonly audit: AuditEvent[] = [];
  private readonly outbox = new Map<string, OutboxEvent>();

  async createDocument(record: DocumentRecord): Promise<DocumentRecord> {
    if (this.documents.has(record.document.id)) throw new TimelineError("DOCUMENT_EXISTS", "Document already exists.", 409);
    this.documents.set(record.document.id, clone(record));
    return clone(record);
  }

  async getDocument(id: string): Promise<DocumentRecord | null> {
    const value = this.documents.get(id);
    return value ? clone(value) : null;
  }

  async listDocumentsForOwner(ownerPrincipalId: string): Promise<DocumentRecord[]> {
    return [...this.documents.values()]
      .filter((record) => record.document.studentOwnerId === ownerPrincipalId && record.status !== "DELETED")
      .map(clone)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async saveCheckpoint(checkpoint: CheckpointRecord): Promise<CheckpointRecord> {
    this.checkpoints.set(checkpoint.id, clone(checkpoint));
    return clone(checkpoint);
  }

  async saveVersion(
    documentId: string,
    expectedRevision: number,
    nextRecord: DocumentRecord,
    version: TimelineVersion,
  ): Promise<TimelineVersion> {
    const current = this.documents.get(documentId);
    if (!current) throw new TimelineError("DOCUMENT_NOT_FOUND", "Document not found.", 404);
    if (current.document.revision !== expectedRevision) {
      throw new TimelineError("REVISION_CONFLICT", "A newer document revision exists.", 409, {
        expectedRevision,
        currentRevision: current.document.revision,
      });
    }
    if (this.versions.has(version.id)) return clone(this.versions.get(version.id)!);
    this.versions.set(version.id, clone(version));
    this.documents.set(documentId, clone(nextRecord));
    return clone(version);
  }

  async getVersion(id: string): Promise<TimelineVersion | null> {
    const value = this.versions.get(id);
    return value ? clone(value) : null;
  }

  async listVersions(documentId: string): Promise<TimelineVersion[]> {
    return [...this.versions.values()]
      .filter((item) => item.documentId === documentId)
      .map(clone)
      .sort((left, right) => right.revision - left.revision);
  }

  async addAssignment(assignment: AdvisorAssignment): Promise<AdvisorAssignment> {
    const existing = this.assignments.findIndex(
      (item) => item.documentId === assignment.documentId && item.advisorPrincipalId === assignment.advisorPrincipalId,
    );
    if (existing >= 0) this.assignments.splice(existing, 1, clone(assignment));
    else this.assignments.push(clone(assignment));
    return clone(assignment);
  }

  async findActiveAssignment(documentId: string, at: string): Promise<AdvisorAssignment | null> {
    const item = this.assignments.find(
      (assignment) =>
        assignment.documentId === documentId &&
        assignment.startsAt <= at &&
        (!assignment.endsAt || assignment.endsAt > at),
    );
    return item ? clone(item) : null;
  }

  async createReview(review: ReviewRequest): Promise<ReviewRequest> {
    if (this.reviews.has(review.id)) return clone(this.reviews.get(review.id)!);
    this.reviews.set(review.id, clone(review));
    return clone(review);
  }

  async getReview(id: string): Promise<ReviewRequest | null> {
    const value = this.reviews.get(id);
    return value ? clone(value) : null;
  }

  async updateReview(review: ReviewRequest): Promise<ReviewRequest> {
    if (!this.reviews.has(review.id)) throw new TimelineError("REVIEW_NOT_FOUND", "Review request not found.", 404);
    this.reviews.set(review.id, clone(review));
    return clone(review);
  }

  async addComment(comment: ReviewComment): Promise<ReviewComment> {
    this.comments.set(comment.id, clone(comment));
    return clone(comment);
  }

  async listComments(reviewRequestId: string): Promise<ReviewComment[]> {
    return [...this.comments.values()]
      .filter((item) => item.reviewRequestId === reviewRequestId)
      .map(clone)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async addApproval(event: ApprovalEvent): Promise<ApprovalEvent> {
    this.approvals.push(clone(event));
    return clone(event);
  }

  async listApprovals(documentId: string): Promise<ApprovalEvent[]> {
    return this.approvals.filter((item) => item.documentId === documentId).map(clone);
  }

  async createExportJob(job: ExportJob): Promise<ExportJob> {
    const existing = await this.findExportJobByIdempotencyKey(job.idempotencyKey);
    if (existing) return existing;
    this.jobs.set(job.id, clone(job));
    return clone(job);
  }

  async getExportJob(id: string): Promise<ExportJob | null> {
    const value = this.jobs.get(id);
    return value ? clone(value) : null;
  }

  async updateExportJob(job: ExportJob): Promise<ExportJob> {
    if (!this.jobs.has(job.id)) throw new TimelineError("EXPORT_JOB_NOT_FOUND", "Export job not found.", 404);
    this.jobs.set(job.id, clone(job));
    return clone(job);
  }

  async findExportJobByIdempotencyKey(key: string): Promise<ExportJob | null> {
    const value = [...this.jobs.values()].find((job) => job.idempotencyKey === key);
    return value ? clone(value) : null;
  }

  async addArtifact(artifact: TimelineArtifact): Promise<TimelineArtifact> {
    const existing = this.artifacts.get(artifact.artifactId);
    if (existing) return clone(existing);
    this.artifacts.set(artifact.artifactId, clone(artifact));
    return clone(artifact);
  }

  async getArtifact(id: string): Promise<TimelineArtifact | null> {
    const value = this.artifacts.get(id);
    return value ? clone(value) : null;
  }

  async saveFileVaultLink(link: FileVaultLink): Promise<FileVaultLink> {
    this.fileVaultLinks.set(`${link.artifactId}:${link.adapter}`, clone(link));
    return clone(link);
  }

  async getFileVaultLink(artifactId: string, adapter: FileVaultLink["adapter"]): Promise<FileVaultLink | null> {
    const value = this.fileVaultLinks.get(`${artifactId}:${adapter}`);
    return value ? clone(value) : null;
  }

  async addAudit(event: AuditEvent): Promise<void> {
    this.audit.push(clone(event));
  }

  async listAudit(resourceId?: string): Promise<AuditEvent[]> {
    return this.audit.filter((item) => !resourceId || item.resourceId === resourceId).map(clone);
  }

  async addOutbox(event: OutboxEvent): Promise<void> {
    if (!this.outbox.has(event.id)) this.outbox.set(event.id, clone(event));
  }

  async pendingOutbox(limit = 100): Promise<OutboxEvent[]> {
    const current = new Date().toISOString();
    return [...this.outbox.values()]
      .filter((item) => !item.publishedAt && item.availableAt <= current)
      .sort((left, right) => left.availableAt.localeCompare(right.availableAt))
      .slice(0, limit)
      .map(clone);
  }

  async markOutboxPublished(id: string, publishedAt: string): Promise<void> {
    const event = this.outbox.get(id);
    if (!event) throw new TimelineError("OUTBOX_EVENT_NOT_FOUND", "Outbox event not found.", 404);
    event.publishedAt = publishedAt;
    this.outbox.set(id, event);
  }

  count(kind: "documents" | "versions" | "reviews" | "comments" | "jobs" | "artifacts" | "outbox"): number {
    if (kind === "documents") return this.documents.size;
    if (kind === "versions") return this.versions.size;
    if (kind === "reviews") return this.reviews.size;
    if (kind === "comments") return this.comments.size;
    if (kind === "jobs") return this.jobs.size;
    if (kind === "artifacts") return this.artifacts.size;
    return this.outbox.size;
  }
}
