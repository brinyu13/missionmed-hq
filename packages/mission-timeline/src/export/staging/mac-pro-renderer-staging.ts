import { createHmac, timingSafeEqual } from "node:crypto";
import { deflateSync } from "node:zlib";

import type { ArtifactType, TimelineDocument, TimelineEvent, VisibilityState } from "../../contracts/types.js";
import { canonicalDocumentHash, sha256, stableStringify } from "../../core/canonical.js";
import { TimelineError } from "../../core/errors.js";

export const MAC_PRO_STAGING_MODE = "LOCAL_WORKER_SIMULATOR_NOT_CONNECTED" as const;

export type RenderFormat = "PNG" | "PDF" | "HTML" | "JSON" | "ZIP";
export type RenderJobStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
export type WorkerFailureMode =
  | "SUCCESS"
  | "CRASH"
  | "LOST_HEARTBEAT"
  | "LOW_DISK"
  | "PARTIAL_OUTPUT"
  | "CORRUPT_OUTPUT"
  | "DUPLICATE_COMPLETION";

export interface MacProAuthorityPolicy {
  approvedTemplateId: string;
  templateSha256: string;
  rendererVersion: string;
  rendererSha256: string;
  fontManifestSha256: string;
  assetManifestSha256: string;
}

export interface RenderApprovalBinding {
  decision: "APPROVED" | "CHANGES_REQUESTED" | "INVALIDATED";
  sourceVersionId: string;
  sourceContentSha256: string;
  approvedAt: string;
}

export interface MacProRenderSubmission {
  jobId: string;
  idempotencyKey: string;
  artifactType: ArtifactType;
  scope: string;
  document: TimelineDocument;
  sourceVersionId: string;
  sourceContentSha256: string;
  approval: RenderApprovalBinding;
  authority: MacProAuthorityPolicy;
  requestedFormats: RenderFormat[];
}

export interface SanitizedRenderEvent {
  id: string;
  title: string;
  categoryId: string;
  eventType: "bar" | "milestone";
  startDate: string;
  endDate: string | null;
  visibilityState: VisibilityState;
  siteName?: string;
  location?: string;
}

export interface SanitizedRenderProjection {
  documentId: string;
  schemaVersion: string;
  title: string;
  theme: string;
  revision: number;
  events: SanitizedRenderEvent[];
}

export interface MacProJobEnvelope {
  schemaVersion: "d1-mac-pro-render-job-413.1";
  mode: typeof MAC_PRO_STAGING_MODE;
  connected: false;
  jobId: string;
  idempotencyKey: string;
  artifactType: ArtifactType;
  scope: string;
  source: {
    documentId: string;
    versionId: string;
    contentSha256: string;
  };
  projection: SanitizedRenderProjection;
  authority: MacProAuthorityPolicy;
  requestedFormats: RenderFormat[];
  submittedAt: string;
  auth: {
    algorithm: "HMAC-SHA256";
    keyId: string;
    signature: string;
  };
}

export interface WorkerCommand {
  workerId: string;
  action: "CLAIM" | "HEARTBEAT" | "COMPLETE" | "FAIL";
  jobId: string;
  at: string;
  signature: string;
}

export interface StagingRenderOutput {
  format: RenderFormat;
  role: "PRIMARY" | "PREVIEW" | "ACCESSIBLE_HTML" | "ACCESSIBLE_TEXT" | "MANIFEST";
  filename: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  byteSize: number;
  sha256: string;
  bytes: Uint8Array;
}

export interface RenderCompletionAuthority {
  templateId: string;
  templateSha256: string;
  rendererVersion: string;
  rendererSha256: string;
  fontManifestSha256: string;
  assetManifestSha256: string;
}

export interface RenderJobSnapshot {
  jobId: string;
  idempotencyKey: string;
  status: RenderJobStatus;
  attempt: number;
  maxAttempts: number;
  workerId: string | null;
  startedAt: string | null;
  lastHeartbeatAt: string | null;
  leaseExpiresAt: string | null;
  errorCode: string | null;
  envelope: MacProJobEnvelope;
  outputs: StagingRenderOutput[];
  completedAt: string | null;
}

export interface MacProCoordinatorOptions {
  envelopeKeyId: string;
  envelopeSecret: string;
  workerSecret: string;
  authority: MacProAuthorityPolicy;
  maxAttempts?: number;
  leaseMs?: number;
  heartbeatTimeoutMs?: number;
  maxExecutionMs?: number;
  clock?: () => Date;
}

interface InternalRenderJob extends RenderJobSnapshot {
  submissionFingerprint: string;
  completionFingerprint: string | null;
}

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const FORMAT_SPEC: Record<RenderFormat, { mimeType: string; width: number | null; height: number | null }> = {
  PNG: { mimeType: "image/png", width: 1920, height: 1080 },
  PDF: { mimeType: "application/pdf", width: null, height: null },
  HTML: { mimeType: "text/html", width: null, height: null },
  JSON: { mimeType: "application/json", width: null, height: null },
  ZIP: { mimeType: "application/zip", width: null, height: null },
};

const FORMAT_BY_ARTIFACT: Record<ArtifactType, RenderFormat[]> = {
  TIMELINE_INTERVIEWER_SAFE_PNG: ["PNG"],
  TIMELINE_FULL_STORY_PNG: ["PNG"],
  TIMELINE_PRINT_PDF: ["PDF"],
  TIMELINE_ADVISOR_PACKET_PDF: ["PDF"],
  TIMELINE_ARCHIVE: ["ZIP"],
  TIMELINE_SOURCE_JSON: ["JSON"],
  TIMELINE_ACCESSIBLE_HTML: ["HTML"],
};

const SCOPE_BY_ARTIFACT: Record<ArtifactType, string> = {
  TIMELINE_INTERVIEWER_SAFE_PNG: "INTERVIEWER_SAFE",
  TIMELINE_FULL_STORY_PNG: "FULL_STORY",
  TIMELINE_PRINT_PDF: "PRINT",
  TIMELINE_ADVISOR_PACKET_PDF: "ADVISOR_PACKET",
  TIMELINE_ARCHIVE: "ARCHIVE",
  TIMELINE_SOURCE_JSON: "SOURCE",
  TIMELINE_ACCESSIBLE_HTML: "ACCESSIBLE",
};

const SCOPE_VISIBILITY: Record<string, VisibilityState[]> = {
  INTERVIEWER_SAFE: ["INTERVIEWER_SAFE"],
  PRINT: ["INTERVIEWER_SAFE"],
  ACCESSIBLE: ["INTERVIEWER_SAFE"],
  FULL_STORY: ["INTERVIEWER_SAFE", "FULL_STORY"],
  ADVISOR_PACKET: ["INTERVIEWER_SAFE", "FULL_STORY", "ADVISOR_ONLY"],
  SOURCE: ["INTERVIEWER_SAFE", "FULL_STORY", "ADVISOR_ONLY", "STUDENT_ONLY"],
  ARCHIVE: ["INTERVIEWER_SAFE", "FULL_STORY", "ADVISOR_ONLY", "STUDENT_ONLY"],
};

export class LocalMacProRenderCoordinator {
  readonly mode = MAC_PRO_STAGING_MODE;
  readonly connected = false as const;

  private readonly jobs = new Map<string, InternalRenderJob>();
  private readonly idempotency = new Map<string, string>();
  private readonly consumedClaimSignatures = new Set<string>();
  private readonly clock: () => Date;
  private readonly maxAttempts: number;
  private readonly leaseMs: number;
  private readonly heartbeatTimeoutMs: number;
  private readonly maxExecutionMs: number;

  constructor(private readonly options: MacProCoordinatorOptions) {
    if (options.envelopeSecret.length < 16 || options.workerSecret.length < 16) {
      throw new TimelineError("RENDER_STAGING_SECRET_WEAK", "Local fixture secrets must contain at least 16 characters.", 500);
    }
    validateAuthority(options.authority);
    this.clock = options.clock ?? (() => new Date());
    this.maxAttempts = options.maxAttempts ?? 3;
    this.leaseMs = options.leaseMs ?? 30_000;
    this.heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? 15_000;
    this.maxExecutionMs = options.maxExecutionMs ?? 120_000;
  }

  submit(submission: MacProRenderSubmission): RenderJobSnapshot {
    this.validateSubmission(submission);
    const projection = sanitizeProjection(submission.document, submission.scope);
    const fingerprint = sha256(stableStringify({
      ...submission,
      document: projection,
    }));
    const priorJobId = this.idempotency.get(submission.idempotencyKey);
    if (priorJobId) {
      const prior = this.requireJob(priorJobId);
      if (prior.submissionFingerprint !== fingerprint) {
        throw new TimelineError("RENDER_IDEMPOTENCY_CONFLICT", "Render idempotency key was reused for different input.", 409);
      }
      return snapshot(prior);
    }
    if (this.jobs.has(submission.jobId)) {
      throw new TimelineError("RENDER_JOB_ID_CONFLICT", "Render job identifier already exists.", 409);
    }

    const unsigned = {
      schemaVersion: "d1-mac-pro-render-job-413.1" as const,
      mode: this.mode,
      connected: this.connected,
      jobId: submission.jobId,
      idempotencyKey: submission.idempotencyKey,
      artifactType: submission.artifactType,
      scope: submission.scope,
      source: {
        documentId: submission.document.id,
        versionId: submission.sourceVersionId,
        contentSha256: submission.sourceContentSha256,
      },
      projection,
      authority: structuredClone(submission.authority),
      requestedFormats: [...submission.requestedFormats],
      submittedAt: this.clock().toISOString(),
    };
    const envelope: MacProJobEnvelope = {
      ...unsigned,
      auth: {
        algorithm: "HMAC-SHA256",
        keyId: this.options.envelopeKeyId,
        signature: hmac(this.options.envelopeSecret, stableStringify(unsigned)),
      },
    };
    assertEnvelopePrivacy(envelope);
    const job: InternalRenderJob = {
      jobId: submission.jobId,
      idempotencyKey: submission.idempotencyKey,
      status: "QUEUED",
      attempt: 0,
      maxAttempts: this.maxAttempts,
      workerId: null,
      startedAt: null,
      lastHeartbeatAt: null,
      leaseExpiresAt: null,
      errorCode: null,
      envelope,
      outputs: [],
      completedAt: null,
      submissionFingerprint: fingerprint,
      completionFingerprint: null,
    };
    this.jobs.set(job.jobId, job);
    this.idempotency.set(job.idempotencyKey, job.jobId);
    return snapshot(job);
  }

  claimNext(command: WorkerCommand): RenderJobSnapshot | null {
    this.verifyWorkerCommand(command, "CLAIM", "*");
    if (this.consumedClaimSignatures.has(command.signature)) {
      throw new TimelineError("RENDER_WORKER_COMMAND_REPLAYED", "Worker CLAIM command has already been used.", 401);
    }
    this.consumedClaimSignatures.add(command.signature);
    this.sweepExpired();
    const job = [...this.jobs.values()].find((candidate) => candidate.status === "QUEUED");
    if (!job) return null;
    job.status = "RUNNING";
    job.attempt += 1;
    job.workerId = command.workerId;
    job.startedAt = command.at;
    job.lastHeartbeatAt = command.at;
    job.leaseExpiresAt = new Date(this.clock().getTime() + this.leaseMs).toISOString();
    job.errorCode = null;
    return snapshot(job);
  }

  heartbeat(jobId: string, command: WorkerCommand): RenderJobSnapshot {
    this.verifyWorkerCommand(command, "HEARTBEAT", jobId);
    const job = this.requireRunningJob(jobId, command.workerId);
    const leaseExpiresAt = Date.parse(job.leaseExpiresAt ?? "");
    if (!Number.isFinite(leaseExpiresAt) || this.clock().getTime() > leaseExpiresAt) {
      throw new TimelineError("RENDER_LEASE_EXPIRED", "Render job lease has expired and must be claimed again.", 409);
    }
    job.lastHeartbeatAt = command.at;
    job.leaseExpiresAt = new Date(this.clock().getTime() + this.leaseMs).toISOString();
    return snapshot(job);
  }

  fail(jobId: string, command: WorkerCommand, errorCode: string, retryable: boolean): RenderJobSnapshot {
    this.verifyWorkerCommand(command, "FAIL", jobId);
    const job = this.requireRunningJob(jobId, command.workerId);
    return this.failInternal(job, errorCode, retryable);
  }

  complete(
    jobId: string,
    command: WorkerCommand,
    authority: RenderCompletionAuthority,
    outputs: StagingRenderOutput[],
  ): RenderJobSnapshot {
    this.verifyWorkerCommand(command, "COMPLETE", jobId);
    const job = this.requireJob(jobId);
    const completionFingerprint = sha256(stableStringify({
      authority,
      outputs: outputs.map((output) => ({
        format: output.format,
        role: output.role,
        filename: output.filename,
        mimeType: output.mimeType,
        width: output.width,
        height: output.height,
        byteSize: output.byteSize,
        sha256: output.sha256,
        actualSha256: sha256(output.bytes),
      })),
    }));
    if (job.status === "COMPLETED") {
      if (job.completionFingerprint !== completionFingerprint) {
        throw new TimelineError("RENDER_DUPLICATE_COMPLETION_CONFLICT", "Completed job received different output.", 409);
      }
      return snapshot(job);
    }
    this.requireRunningJob(jobId, command.workerId);
    this.validateCompletion(job, authority, outputs);

    // No job state changes until every file and authority field has passed validation.
    job.outputs = outputs.map(cloneOutput);
    job.status = "COMPLETED";
    job.completedAt = command.at;
    job.leaseExpiresAt = null;
    job.lastHeartbeatAt = command.at;
    job.errorCode = null;
    job.completionFingerprint = completionFingerprint;
    return snapshot(job);
  }

  sweepExpired(): RenderJobSnapshot[] {
    const nowMs = this.clock().getTime();
    const changed: RenderJobSnapshot[] = [];
    for (const job of this.jobs.values()) {
      if (job.status !== "RUNNING") continue;
      const startedMs = Date.parse(job.startedAt ?? job.envelope.submittedAt);
      const heartbeatMs = Date.parse(job.lastHeartbeatAt ?? job.envelope.submittedAt);
      const leaseMs = Date.parse(job.leaseExpiresAt ?? job.envelope.submittedAt);
      if (nowMs - startedMs > this.maxExecutionMs) {
        changed.push(this.failInternal(job, "RENDER_TIMEOUT", true));
        continue;
      }
      if (nowMs <= leaseMs && nowMs - heartbeatMs <= this.heartbeatTimeoutMs) continue;
      changed.push(this.failInternal(job, "RENDER_LOST_HEARTBEAT", true));
    }
    return changed;
  }

  getJob(jobId: string): RenderJobSnapshot | null {
    const job = this.jobs.get(jobId);
    return job ? snapshot(job) : null;
  }

  verifyEnvelope(envelope: MacProJobEnvelope): boolean {
    if (envelope.auth.keyId !== this.options.envelopeKeyId || envelope.auth.algorithm !== "HMAC-SHA256") return false;
    const { auth: _auth, ...unsigned } = envelope;
    return secureEqual(envelope.auth.signature, hmac(this.options.envelopeSecret, stableStringify(unsigned)));
  }

  private validateSubmission(submission: MacProRenderSubmission): void {
    if (!/^[-_a-zA-Z0-9]{8,128}$/.test(submission.jobId)) {
      throw new TimelineError("RENDER_JOB_ID_INVALID", "Render job identifier is invalid.", 400);
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,127}$/.test(submission.idempotencyKey)) {
      throw new TimelineError("RENDER_IDEMPOTENCY_KEY_INVALID", "Render idempotency key is invalid.", 400);
    }
    assertHash(submission.sourceContentSha256, "RENDER_SOURCE_HASH_INVALID");
    if (submission.approval.decision !== "APPROVED") {
      throw new TimelineError("RENDER_APPROVAL_REQUIRED", "The immutable source version is not approved.", 409);
    }
    if (submission.approval.sourceVersionId !== submission.sourceVersionId) {
      throw new TimelineError("RENDER_STALE_APPROVAL_VERSION", "Approval does not bind the requested version.", 409);
    }
    if (submission.approval.sourceContentSha256 !== submission.sourceContentSha256) {
      throw new TimelineError("RENDER_STALE_APPROVAL_HASH", "Approval does not bind the requested content hash.", 409);
    }
    if (canonicalDocumentHash(submission.document) !== submission.approval.sourceContentSha256) {
      throw new TimelineError("RENDER_SOURCE_DOCUMENT_HASH_MISMATCH", "Submitted document does not match the approved content hash.", 409);
    }
    if (!SCOPE_VISIBILITY[submission.scope]) {
      throw new TimelineError("RENDER_SCOPE_INVALID", "Render scope is unsupported.", 400);
    }
    if (SCOPE_BY_ARTIFACT[submission.artifactType] !== submission.scope) {
      throw new TimelineError("RENDER_ARTIFACT_SCOPE_MISMATCH", "Artifact type and export scope do not match.", 409);
    }
    const requiredFormats = FORMAT_BY_ARTIFACT[submission.artifactType];
    if (stableStringify([...submission.requestedFormats].sort()) !== stableStringify([...requiredFormats].sort())) {
      throw new TimelineError("RENDER_FORMAT_MISMATCH", "Requested formats do not match the artifact contract.", 409);
    }
    validateAuthority(submission.authority);
    for (const [key, expected] of Object.entries(this.options.authority) as Array<[keyof MacProAuthorityPolicy, string]>) {
      if (submission.authority[key] !== expected) {
        throw new TimelineError(`RENDER_${authorityCode(key)}_MISMATCH`, `Render ${key} does not match the approved authority.`, 409);
      }
    }
  }

  private validateCompletion(
    job: InternalRenderJob,
    authority: RenderCompletionAuthority,
    outputs: StagingRenderOutput[],
  ): void {
    const expected = job.envelope.authority;
    const actual: MacProAuthorityPolicy = {
      approvedTemplateId: authority.templateId,
      templateSha256: authority.templateSha256,
      rendererVersion: authority.rendererVersion,
      rendererSha256: authority.rendererSha256,
      fontManifestSha256: authority.fontManifestSha256,
      assetManifestSha256: authority.assetManifestSha256,
    };
    for (const [key, expectedValue] of Object.entries(expected) as Array<[keyof MacProAuthorityPolicy, string]>) {
      if (actual[key] !== expectedValue) {
        throw new TimelineError(`RENDER_OUTPUT_${authorityCode(key)}_MISMATCH`, `Worker ${key} does not match the job envelope.`, 502);
      }
    }
    const primary = outputs.filter((output) => output.role === "PRIMARY");
    if (primary.length !== 1) {
      throw new TimelineError("RENDER_OUTPUT_PRIMARY_INVALID", "Render completion requires exactly one primary file.", 502);
    }
    for (const expectedFormat of job.envelope.requestedFormats) {
      if (!outputs.some((output) => output.format === expectedFormat && output.role === "PRIMARY")) {
        throw new TimelineError("RENDER_OUTPUT_PARTIAL", `Render output is missing ${expectedFormat}.`, 502);
      }
    }
    for (const output of outputs) validateOutput(output);
  }

  private verifyWorkerCommand(command: WorkerCommand, action: WorkerCommand["action"], jobId: string): void {
    if (command.action !== action || command.jobId !== jobId) {
      throw new TimelineError("RENDER_WORKER_COMMAND_INVALID", "Worker command action or job does not match.", 401);
    }
    const commandTime = Date.parse(command.at);
    if (!Number.isFinite(commandTime) || Math.abs(this.clock().getTime() - commandTime) > 60_000) {
      throw new TimelineError("RENDER_WORKER_COMMAND_EXPIRED", "Worker command timestamp is outside the accepted window.", 401);
    }
    const expected = signWorkerCommand(this.options.workerSecret, command.workerId, action, jobId, command.at);
    if (!secureEqual(command.signature, expected.signature)) {
      throw new TimelineError("RENDER_WORKER_AUTH_INVALID", "Worker command signature is invalid.", 401);
    }
  }

  private requireJob(jobId: string): InternalRenderJob {
    const job = this.jobs.get(jobId);
    if (!job) throw new TimelineError("RENDER_JOB_NOT_FOUND", "Render job does not exist.", 404);
    return job;
  }

  private requireRunningJob(jobId: string, workerId: string): InternalRenderJob {
    const job = this.requireJob(jobId);
    if (job.status !== "RUNNING" || job.workerId !== workerId) {
      throw new TimelineError("RENDER_JOB_NOT_CLAIMED", "Render job is not claimed by this worker.", 409);
    }
    return job;
  }

  private failInternal(job: InternalRenderJob, errorCode: string, retryable: boolean): RenderJobSnapshot {
    job.errorCode = errorCode;
    job.workerId = null;
    job.startedAt = null;
    job.lastHeartbeatAt = null;
    job.leaseExpiresAt = null;
    if (retryable && job.attempt < job.maxAttempts) {
      job.status = "QUEUED";
    } else {
      job.status = "FAILED";
    }
    return snapshot(job);
  }
}

export interface LocalMacProWorkerOptions {
  workerId: string;
  workerSecret: string;
  freeDiskBytes: number;
  minimumFreeDiskBytes: number;
  clock?: () => Date;
}

export class LocalMacProWorkerSimulator {
  readonly mode = MAC_PRO_STAGING_MODE;
  readonly connected = false as const;
  private readonly clock: () => Date;
  private lastCommandTimeMs = Number.NEGATIVE_INFINITY;

  constructor(private readonly options: LocalMacProWorkerOptions) {
    this.clock = options.clock ?? (() => new Date());
  }

  runOnce(coordinator: LocalMacProRenderCoordinator, failureMode: WorkerFailureMode = "SUCCESS"): RenderJobSnapshot | null {
    const claim = this.command("CLAIM", "*");
    const job = coordinator.claimNext(claim);
    if (!job) return null;
    if (!coordinator.verifyEnvelope(job.envelope)) {
      return coordinator.fail(job.jobId, this.command("FAIL", job.jobId), "RENDER_ENVELOPE_AUTH_INVALID", false);
    }
    assertEnvelopePrivacy(job.envelope);
    if (failureMode === "CRASH" || failureMode === "LOST_HEARTBEAT") return job;
    if (failureMode === "LOW_DISK" || this.options.freeDiskBytes < this.options.minimumFreeDiskBytes) {
      return coordinator.fail(job.jobId, this.command("FAIL", job.jobId), "RENDER_LOW_DISK", true);
    }

    coordinator.heartbeat(job.jobId, this.command("HEARTBEAT", job.jobId));
    const outputs = deterministicOutputs(job.envelope);
    const authority = completionAuthority(job.envelope.authority);
    if (failureMode === "PARTIAL_OUTPUT") {
      try {
        coordinator.complete(job.jobId, this.command("COMPLETE", job.jobId), authority, []);
      } catch (error) {
        if (!(error instanceof TimelineError) || error.code !== "RENDER_OUTPUT_PRIMARY_INVALID") throw error;
      }
      return coordinator.fail(job.jobId, this.command("FAIL", job.jobId), "RENDER_OUTPUT_PARTIAL", true);
    }
    if (failureMode === "CORRUPT_OUTPUT") {
      const corrupted = outputs.map(cloneOutput);
      corrupted[0]!.bytes = Uint8Array.from([...corrupted[0]!.bytes, 0]);
      try {
        coordinator.complete(job.jobId, this.command("COMPLETE", job.jobId), authority, corrupted);
      } catch (error) {
        if (!(error instanceof TimelineError) || error.code !== "RENDER_OUTPUT_SIZE_MISMATCH") throw error;
      }
      return coordinator.fail(job.jobId, this.command("FAIL", job.jobId), "RENDER_OUTPUT_CORRUPT", true);
    }
    const completed = coordinator.complete(job.jobId, this.command("COMPLETE", job.jobId), authority, outputs);
    if (failureMode === "DUPLICATE_COMPLETION") {
      return coordinator.complete(job.jobId, this.command("COMPLETE", job.jobId), authority, outputs);
    }
    return completed;
  }

  private command(action: WorkerCommand["action"], jobId: string): WorkerCommand {
    const commandTimeMs = Math.max(this.clock().getTime(), this.lastCommandTimeMs + 1);
    this.lastCommandTimeMs = commandTimeMs;
    return signWorkerCommand(this.options.workerSecret, this.options.workerId, action, jobId, new Date(commandTimeMs).toISOString());
  }
}

export function signWorkerCommand(
  workerSecret: string,
  workerId: string,
  action: WorkerCommand["action"],
  jobId: string,
  at: string,
): WorkerCommand {
  return {
    workerId,
    action,
    jobId,
    at,
    signature: hmac(workerSecret, stableStringify({ workerId, action, jobId, at })),
  };
}

export function sanitizeProjection(document: TimelineDocument, scope: string): SanitizedRenderProjection {
  const allowed = SCOPE_VISIBILITY[scope];
  if (!allowed) throw new TimelineError("RENDER_SCOPE_INVALID", "Render scope is unsupported.", 400);
  return {
    documentId: document.id,
    schemaVersion: document.schemaVersion,
    title: document.title,
    theme: document.theme,
    revision: document.revision,
    events: document.events
      .filter((event) => allowed.includes(event.visibilityState))
      .map(sanitizeEvent),
  };
}

export function assertEnvelopePrivacy(envelope: MacProJobEnvelope): void {
  const serialized = stableStringify(envelope);
  const forbiddenKeys = [
    "cookie",
    "authorization",
    "databaseUrl",
    "dbPassword",
    "matrixSession",
    "sourceDocuments",
    "documentPages",
    "sourceBlocks",
    "extractionCandidates",
    "advisorReview",
    "notes",
    "provenance",
  ];
  for (const key of forbiddenKeys) {
    if (serialized.includes(`\"${key}\"`)) {
      throw new TimelineError("RENDER_ENVELOPE_PRIVACY_VIOLATION", `Render envelope contains prohibited field ${key}.`, 500);
    }
  }
  if (["INTERVIEWER_SAFE", "PRINT", "ACCESSIBLE"].includes(envelope.scope)) {
    if (envelope.projection.events.some((event) => event.visibilityState !== "INTERVIEWER_SAFE")) {
      throw new TimelineError("RENDER_ENVELOPE_VISIBILITY_VIOLATION", "Interviewer-safe job contains a private event.", 500);
    }
  }
}

function sanitizeEvent(event: TimelineEvent): SanitizedRenderEvent {
  return {
    id: event.id,
    title: event.title,
    categoryId: event.categoryId,
    eventType: event.eventType === "milestone" ? "milestone" : "bar",
    startDate: event.startDate,
    endDate: event.endDate ?? null,
    visibilityState: event.visibilityState,
    ...(typeof event.siteName === "string" ? { siteName: event.siteName } : {}),
    ...(typeof event.location === "string" ? { location: event.location } : {}),
  };
}

function deterministicOutputs(envelope: MacProJobEnvelope): StagingRenderOutput[] {
  const descriptor = sha256(stableStringify({
    jobId: envelope.jobId,
    source: envelope.source,
    projection: envelope.projection,
    authority: envelope.authority,
  }));
  return envelope.requestedFormats.map((format) => {
    const spec = FORMAT_SPEC[format];
    const bytes = outputBytes(format, descriptor, spec.width, spec.height);
    return {
      format,
      role: "PRIMARY" as const,
      filename: `mission-timeline-${envelope.source.versionId}.${extension(format)}`,
      mimeType: spec.mimeType,
      width: spec.width,
      height: spec.height,
      byteSize: bytes.byteLength,
      sha256: sha256(bytes),
      bytes,
    };
  });
}

function outputBytes(format: RenderFormat, descriptor: string, width: number | null, height: number | null): Uint8Array {
  if (format === "PNG") return solidPng(width!, height!, descriptor);
  if (format === "PDF") return new TextEncoder().encode(`%PDF-1.4\n% D1 staging ${descriptor}\n%%EOF\n`);
  if (format === "HTML") return new TextEncoder().encode(`<!doctype html><meta charset=\"utf-8\"><title>D1 staging</title><p>${descriptor}</p>`);
  if (format === "JSON") return new TextEncoder().encode(stableStringify({ fixture: true, descriptor }));
  return Uint8Array.from([...new TextEncoder().encode("PK\u0003\u0004"), ...new TextEncoder().encode(descriptor)]);
}

function solidPng(width: number, height: number, descriptor: string): Uint8Array {
  const red = Number.parseInt(descriptor.slice(0, 2), 16);
  const green = Number.parseInt(descriptor.slice(2, 4), 16);
  const blue = Number.parseInt(descriptor.slice(4, 6), 16);
  const row = Buffer.alloc(width * 4 + 1);
  for (let offset = 1; offset < row.length; offset += 4) {
    row[offset] = red;
    row[offset + 1] = green;
    row[offset + 2] = blue;
    row[offset + 3] = 255;
  }
  const raw = Buffer.alloc(row.length * height);
  for (let index = 0; index < height; index += 1) row.copy(raw, index * row.length);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Uint8Array.from(Buffer.concat([signature, pngChunk("IHDR", ihdr), pngChunk("IDAT", deflateSync(raw, { level: 9 })), pngChunk("IEND", Buffer.alloc(0))]));
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])) >>> 0);
  return Buffer.concat([length, typeBytes, data, checksum]);
}

function crc32(data: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of data) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
  }
  return (value ^ 0xffffffff) >>> 0;
}

function validateOutput(output: StagingRenderOutput): void {
  const spec = FORMAT_SPEC[output.format];
  if (!output.filename || output.filename.includes("/") || output.filename.includes("\\") || output.filename.includes("..")) {
    throw new TimelineError("RENDER_OUTPUT_FILENAME_INVALID", "Render output filename must be a safe basename.", 502);
  }
  if (output.mimeType !== spec.mimeType) throw new TimelineError("RENDER_OUTPUT_MIME_MISMATCH", "Render output MIME does not match format.", 502);
  if (output.width !== spec.width || output.height !== spec.height) {
    throw new TimelineError("RENDER_OUTPUT_DIMENSIONS_MISMATCH", "Render output dimensions do not match the contract.", 502);
  }
  if (output.byteSize !== output.bytes.byteLength) {
    throw new TimelineError("RENDER_OUTPUT_SIZE_MISMATCH", "Render output byte count is invalid.", 502);
  }
  if (!HASH_PATTERN.test(output.sha256) || output.sha256 !== sha256(output.bytes)) {
    throw new TimelineError("RENDER_OUTPUT_HASH_MISMATCH", "Render output SHA-256 is invalid.", 502);
  }
  if (output.format === "PNG" && !Buffer.from(output.bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new TimelineError("RENDER_OUTPUT_MAGIC_MISMATCH", "PNG output signature is invalid.", 502);
  }
  if (output.format === "PDF" && !Buffer.from(output.bytes.subarray(0, 5)).equals(Buffer.from("%PDF-"))) {
    throw new TimelineError("RENDER_OUTPUT_MAGIC_MISMATCH", "PDF output signature is invalid.", 502);
  }
}

function validateAuthority(authority: MacProAuthorityPolicy): void {
  if (!/^[-_.a-zA-Z0-9]{4,128}$/.test(authority.approvedTemplateId)) {
    throw new TimelineError("RENDER_TEMPLATE_ID_INVALID", "Approved template identifier is invalid.", 500);
  }
  for (const [key, value] of Object.entries(authority)) {
    if (key.endsWith("Sha256")) assertHash(value, `RENDER_${authorityCode(key as keyof MacProAuthorityPolicy)}_INVALID`);
  }
  if (!authority.rendererVersion.trim()) throw new TimelineError("RENDER_VERSION_INVALID", "Renderer version is required.", 500);
}

function assertHash(value: string, code: string): void {
  if (!HASH_PATTERN.test(value)) throw new TimelineError(code, "A lowercase SHA-256 value is required.", 400);
}

function authorityCode(key: keyof MacProAuthorityPolicy): string {
  return key.replace(/([a-z])([A-Z])/g, "$1_$2").replace("approved_", "").toUpperCase();
}

function completionAuthority(authority: MacProAuthorityPolicy): RenderCompletionAuthority {
  return {
    templateId: authority.approvedTemplateId,
    templateSha256: authority.templateSha256,
    rendererVersion: authority.rendererVersion,
    rendererSha256: authority.rendererSha256,
    fontManifestSha256: authority.fontManifestSha256,
    assetManifestSha256: authority.assetManifestSha256,
  };
}

function snapshot(job: InternalRenderJob): RenderJobSnapshot {
  return {
    jobId: job.jobId,
    idempotencyKey: job.idempotencyKey,
    status: job.status,
    attempt: job.attempt,
    maxAttempts: job.maxAttempts,
    workerId: job.workerId,
    startedAt: job.startedAt,
    lastHeartbeatAt: job.lastHeartbeatAt,
    leaseExpiresAt: job.leaseExpiresAt,
    errorCode: job.errorCode,
    envelope: structuredClone(job.envelope),
    outputs: job.outputs.map(cloneOutput),
    completedAt: job.completedAt,
  };
}

function cloneOutput(output: StagingRenderOutput): StagingRenderOutput {
  return { ...output, bytes: Uint8Array.from(output.bytes) };
}

function hmac(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function secureEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

function extension(format: RenderFormat): string {
  return format.toLowerCase();
}
