import { createHash, randomUUID } from "node:crypto";

export type EvidenceClass = "private_student" | "public_person" | "public_program" | "storyforge" | "timeline" | "coach_observation" | "founder_note";
export type ClaimStatus = "draft" | "in_review" | "approved" | "rejected" | "superseded";
export type Confidence = "low" | "medium" | "high";

export interface SourceRecord {
  id: string;
  subjectId: string;
  evidenceClass: EvidenceClass;
  sourceType: "document" | "official_profile" | "program_site" | "publisher" | "audio" | "video" | "sibling_api" | "note";
  title: string;
  uri: string;
  retrievedAt: string;
  sha256?: string;
  authority: "primary" | "secondary" | "private-authorized";
  status: "available" | "pending_upload" | "quarantined" | "adapter_unavailable";
  assertions?: Array<{
    predicate: "person_name" | "organization_affiliation" | "program_specialty" | "professional_role";
    value: string;
    locator: string;
    verification: "browser-visible" | "publisher-metadata";
  }>;
}

export interface EvidenceRef { sourceId: string; locator: string; excerpt?: string }
export interface Claim {
  id: string;
  subjectId: string;
  kind: string;
  text: string;
  confidence: Confidence;
  evidence: EvidenceRef[];
  status: ClaimStatus;
  version: number;
  createdBy: string;
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface PrivateUploadManifestItem {
  logicalName: string;
  expectedClass: "cv" | "personal_statement" | "application" | "recommendation" | "transcript" | "storyforge_export" | "audio" | "video" | "other";
  filename: string;
  mediaType: string;
  byteLength: number;
  sha256: string;
  subjectId: string;
  consentBasis: string;
  retentionUntil: string;
}

export interface SubjectWorkspace {
  subject: { id: string; displayName: string };
  program: { id: string; name: string; specialty: string };
  person: { id: string; displayName: string };
  sources: SourceRecord[];
  claims: Claim[];
  founderReviewStatus: "not_started" | "in_review" | "approved";
  studentPublishedAt?: string;
}

export class PriqRepository {
  private readonly workspaces = new Map<string, SubjectWorkspace>();
  constructor(seed: SubjectWorkspace[] = []) { for (const workspace of seed) this.workspaces.set(workspace.subject.id, structuredClone(workspace)); }
  get(subjectId: string): SubjectWorkspace | undefined { const found = this.workspaces.get(subjectId); return found && structuredClone(found); }
  save(workspace: SubjectWorkspace): void { this.workspaces.set(workspace.subject.id, structuredClone(workspace)); }
}

export function validateUploadManifest(item: PrivateUploadManifestItem, now = new Date()): string[] {
  const errors: string[] = [];
  if (!item.logicalName.trim() || !item.filename.trim()) errors.push("logicalName and filename are required");
  if (!/^[a-f0-9]{64}$/.test(item.sha256)) errors.push("sha256 must be 64 lowercase hex characters");
  if (item.byteLength <= 0 || !Number.isSafeInteger(item.byteLength)) errors.push("byteLength must be a positive integer");
  if (!item.subjectId || !item.consentBasis.trim()) errors.push("subjectId and consentBasis are required");
  if (!item.mediaType.match(/^(application|audio|video|text)\//)) errors.push("mediaType is not allowed");
  const retention = Date.parse(item.retentionUntil);
  if (!Number.isFinite(retention) || retention <= now.getTime()) errors.push("retentionUntil must be a future timestamp");
  return errors;
}

export function contentAddress(bytes: Uint8Array): string { return createHash("sha256").update(bytes).digest("hex"); }

export class ClaimLifecycle {
  create(input: Omit<Claim, "id" | "status" | "version" | "createdAt">): Claim {
    if (input.evidence.length === 0) throw new Error("EVIDENCE_REQUIRED");
    return { ...input, id: randomUUID(), status: "draft", version: 1, createdAt: new Date().toISOString() };
  }
  submit(claim: Claim): Claim {
    if (claim.status !== "draft") throw new Error("INVALID_CLAIM_TRANSITION");
    return { ...claim, status: "in_review", version: claim.version + 1 };
  }
  approve(claim: Claim, founderId: string): Claim {
    if (claim.status !== "in_review") throw new Error("INVALID_CLAIM_TRANSITION");
    return { ...claim, status: "approved", version: claim.version + 1, reviewedBy: founderId, reviewedAt: new Date().toISOString() };
  }
  reject(claim: Claim, founderId: string, reason: string): Claim {
    if (claim.status !== "in_review" || !reason.trim()) throw new Error("INVALID_CLAIM_TRANSITION");
    return { ...claim, status: "rejected", version: claim.version + 1, reviewedBy: founderId, reviewedAt: new Date().toISOString(), rejectionReason: reason };
  }
}

export function studentProjection(workspace: SubjectWorkspace): Pick<SubjectWorkspace, "subject" | "program" | "person" | "claims" | "studentPublishedAt"> {
  if (workspace.founderReviewStatus !== "approved" || !workspace.studentPublishedAt) throw new Error("STUDENT_REPORT_NOT_PUBLISHED");
  return {
    subject: workspace.subject, program: workspace.program, person: workspace.person,
    claims: workspace.claims.filter((claim) => claim.status === "approved"), studentPublishedAt: workspace.studentPublishedAt,
  };
}
