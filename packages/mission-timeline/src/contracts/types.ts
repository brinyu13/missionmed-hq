export type Role =
  | "STUDENT"
  | "ADVISOR"
  | "PROGRAM_ADMIN"
  | "PLATFORM_ADMIN"
  | "FACULTY"
  | "SERVICE";

export type VisibilityState =
  | "INTERVIEWER_SAFE"
  | "FULL_STORY"
  | "ADVISOR_ONLY"
  | "STUDENT_ONLY"
  | "HIDDEN";

export type TimelineAction =
  | "document:create"
  | "document:read"
  | "document:edit"
  | "version:create"
  | "review:request"
  | "review:read"
  | "review:comment"
  | "review:decide"
  | "artifact:create"
  | "artifact:read"
  | "filevault:publish"
  | "audit:read"
  | "document:delete";

export interface MatrixIdentity {
  wpUserId: number;
  displayName: string;
  email?: string;
  nonceVerified: boolean;
  sessionId: string;
}

export interface FacultyGrant {
  documentId: string;
  versionId?: string;
  actions: TimelineAction[];
  expiresAt: string;
}

export interface PrincipalContext {
  principalId: string;
  role: Role;
  programIds: string[];
  assignedDocumentIds: string[];
  facultyGrants: FacultyGrant[];
  serviceScopes: TimelineAction[];
  breakGlass?: {
    reason: string;
    expiresAt: string;
  };
  sessionId: string;
  requestId: string;
}

export interface TimelineEvent {
  id: string;
  title: string;
  categoryId: string;
  eventType?: "bar" | "milestone";
  startDate: string;
  endDate?: string | null;
  visibilityState: VisibilityState;
  siteName?: string;
  location?: string;
  notes?: string;
  provenance?: unknown;
  [key: string]: unknown;
}

export interface TimelineDocument {
  id: string;
  schemaVersion: string;
  studentOwnerId: string;
  programId: string;
  title: string;
  theme: string;
  revision: number;
  events: TimelineEvent[];
  mediaItems?: unknown[];
  sourceDocuments?: unknown[];
  extractionCandidates?: unknown[];
  advisorReview?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface TimelineVersion {
  id: string;
  documentId: string;
  revision: number;
  parentVersionId: string | null;
  label: string;
  snapshot: TimelineDocument;
  contentSha256: string;
  createdBy: string;
  createdAt: string;
}

export interface DocumentRecord {
  document: TimelineDocument;
  currentVersionId: string | null;
  status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "ARCHIVED" | "DELETED";
  createdAt: string;
  updatedAt: string;
}

export interface CheckpointRecord {
  id: string;
  documentId: string;
  deviceId: string;
  baseRevision: number;
  snapshot: TimelineDocument;
  createdAt: string;
  expiresAt: string;
}

export interface AdvisorAssignment {
  documentId: string;
  advisorPrincipalId: string;
  programId: string;
  startsAt: string;
  endsAt: string | null;
}

export interface ReviewRequest {
  id: string;
  documentId: string;
  versionId: string;
  versionHash: string;
  requestedBy: string;
  assignedTo: string;
  status: "REQUESTED" | "IN_REVIEW" | "CHANGES_REQUESTED" | "APPROVED" | "CLOSED";
  createdAt: string;
  updatedAt: string;
}

export interface ReviewComment {
  id: string;
  reviewRequestId: string;
  authorId: string;
  authorRole: Role;
  body: string;
  visibility: "SHARED" | "ADVISOR_ONLY";
  anchor: Record<string, unknown>;
  status: "OPEN" | "RESOLVED";
  createdAt: string;
}

export interface ApprovalEvent {
  id: string;
  reviewRequestId: string;
  documentId: string;
  versionId: string;
  contentSha256: string;
  decision: "APPROVED" | "CHANGES_REQUESTED" | "INVALIDATED";
  actorId: string;
  reason: string;
  createdAt: string;
}

export type ArtifactType =
  | "TIMELINE_INTERVIEWER_SAFE_PNG"
  | "TIMELINE_FULL_STORY_PNG"
  | "TIMELINE_PRINT_PDF"
  | "TIMELINE_ADVISOR_PACKET_PDF"
  | "TIMELINE_ARCHIVE"
  | "TIMELINE_SOURCE_JSON"
  | "TIMELINE_ACCESSIBLE_HTML";

export interface ArtifactFile {
  role: "PRIMARY" | "PREVIEW" | "ACCESSIBLE_HTML" | "ACCESSIBLE_TEXT" | "MANIFEST";
  objectId: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  contentHash: string;
}

export interface TimelineArtifact {
  artifactId: string;
  artifactSchemaVersion: "d1-timeline-artifact-409.1";
  artifactType: ArtifactType;
  timelineDocumentId: string;
  timelineVersionId: string;
  studentOwnerId: string;
  programId: string;
  createdByRole: "STUDENT" | "ADVISOR" | "ADMIN" | "SYSTEM_LOCAL";
  createdAt: string;
  updatedAt: string;
  displayName: string;
  description: string;
  documentCategory: "MISSION_TIMELINE";
  mimeType: string;
  byteSize: number;
  contentHash: string;
  exportScope: "INTERVIEWER_SAFE" | "FULL_STORY" | "ADVISOR_PACKET" | "PRINT" | "ARCHIVE" | "SOURCE" | "ACCESSIBLE";
  visibility: VisibilityState;
  approvalState: Record<string, unknown>;
  theme: string;
  dimensions: Record<string, number> | null;
  pageCount: number | null;
  previewImage: ArtifactFile | string | null;
  primaryFile: ArtifactFile;
  companionFiles: ArtifactFile[];
  sourceDocumentReferences: Array<Record<string, unknown>>;
  timelineEventCount: number;
  generatedQuestionCount: number;
  advisorCommentCount: number;
  files: ArtifactFile[];
  warnings: string[];
  provenanceSummary: Record<string, unknown>;
  retentionClass: string;
  fileVaultLinkageState: "UNLINKED" | "PENDING" | "LINKED" | "FAILED";
  legacyVaultReference: Record<string, unknown> | null;
  v2VaultReference: Record<string, unknown> | null;
  synchronizationStatus: string;
  synchronizationHistory: Array<Record<string, unknown>>;
  idempotencyKey: string;
}

export interface ExportJob {
  id: string;
  documentId: string;
  versionId: string;
  artifactType: ArtifactType;
  scope: string;
  requestedBy: string;
  renderer: "MAC_PRO_AUTHORITY" | "WEB_CANDIDATE" | "FIXTURE";
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  idempotencyKey: string;
  artifactId?: string;
  errorCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ObjectRecord {
  id: string;
  ownerPrincipalId: string;
  documentId: string;
  objectClass: "SOURCE" | "MEDIA" | "EXPORT" | "PREVIEW" | "TEMP";
  storageKey: string;
  mimeType: string;
  expectedBytes: number;
  expectedSha256: string;
  status: "PENDING" | "CONFIRMED" | "QUARANTINED" | "DELETED";
  createdAt: string;
  confirmedAt?: string;
  bytes?: Uint8Array;
}

export interface AuditEvent {
  id: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  outcome: "ALLOW" | "DENY" | "SUCCESS" | "FAILURE";
  requestId: string;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export interface OutboxEvent {
  id: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  attempts: number;
  availableAt: string;
  publishedAt: string | null;
}

export interface FileVaultLink {
  id: string;
  artifactId: string;
  adapter: "LEGACY" | "V2";
  externalFileId: string;
  externalVersionId: string;
  status: "LINKED" | "FAILED" | "SUPERSEDED";
  artifactHash: string;
  createdAt: string;
  updatedAt: string;
  errorCode?: string;
}
