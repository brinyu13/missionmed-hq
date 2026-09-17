import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import type { TimelineArtifact, TimelineDocument } from "../src/contracts/types.js";
import { sha256, stableStringify } from "../src/core/canonical.js";
import { TimelineError } from "../src/core/errors.js";
import {
  LocalLegacyFileVaultContractFixture,
  type LegacyPublishInput,
} from "../src/filevault/staging/legacy-filevault-staging.js";
import {
  InMemoryStagingPrincipalDirectory,
  StagingMatrixSessionExchange,
  type MatrixSessionAuthority,
  type MatrixSessionProof,
} from "../src/identity/staging/index.js";
import {
  InMemoryStagingLocalDraftStore,
  STAGING_RECOVERY_ENVELOPE_SCHEMA_VERSION,
  STAGING_RECOVERY_PAYLOAD_SCHEMA_VERSION,
  StagingHybridSyncCoordinator,
  verifyStagingRecoveryJson,
  type StagingCheckpointRequest,
  type StagingRemoteTimelineClient,
  type StagingVersionRequest,
} from "../src/persistence/staging-hybrid.js";

const NOW = "2026-07-15T12:00:00.000Z";
const SESSION_SECRET = "d1-413-adapter-session-secret-0123456789abcdef";
const FILEVAULT_SECRET = "d1-413-adapter-filevault-secret";

function hasCode(expected: string): (error: unknown) => boolean {
  return (error) => error instanceof TimelineError && error.code === expected;
}

function directory(): InMemoryStagingPrincipalDirectory {
  const value = new InMemoryStagingPrincipalDirectory();
  value.register({
    principalId: "principal_student",
    wpUserId: 42,
    role: "STUDENT",
    programIds: ["program_internal_medicine"],
    assignedDocumentIds: [],
    active: true,
    membershipVersion: 1,
  });
  return value;
}

class FailingMatrixAuthority implements MatrixSessionAuthority {
  failure: "VERIFY_PROOF" | "SESSION_ACTIVE" | null = null;

  async verifyProof(proof: MatrixSessionProof) {
    if (this.failure === "VERIFY_PROOF") throw new Error("matrix-password=credential-do-not-leak");
    return {
      valid: true,
      proofId: `${proof.wpUserId}:${proof.sessionId}:${proof.nonce}`,
      wpUserId: proof.wpUserId,
      sessionId: proof.sessionId,
    };
  }

  async isSessionActive() {
    if (this.failure === "SESSION_ACTIVE") throw new Error("matrix-session-secret=credential-do-not-leak");
    return true;
  }
}

function exchange(authority: MatrixSessionAuthority): StagingMatrixSessionExchange {
  return new StagingMatrixSessionExchange(directory(), authority, {
    issuer: "https://matrix.missionmed.test",
    audience: "mission-timeline-staging",
    signingSecret: SESSION_SECRET,
    ttlSeconds: 60,
    clock: () => new Date(NOW),
  });
}

async function rejectsSanitizedAuthorityFailure(operation: Promise<unknown>): Promise<void> {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof TimelineError);
    assert.equal(error.code, "MATRIX_AUTHORITY_UNAVAILABLE");
    assert.equal(error.status, 503);
    assert.equal(error.details.preserveLocalDraft, true);
    assert.equal(error.details.recoveryAction, "REAUTHENTICATE_WITH_MATRIX");
    assert.doesNotMatch(`${error.message}\n${error.stack ?? ""}\n${JSON.stringify(error.details)}`, /password|secret|credential-do-not-leak/i);
    return true;
  });
}

test("Matrix authority exceptions are sanitized at proof and active-session boundaries", async () => {
  const proofFailure = new FailingMatrixAuthority();
  proofFailure.failure = "VERIFY_PROOF";
  await rejectsSanitizedAuthorityFailure(
    exchange(proofFailure).exchange({ wpUserId: 42, sessionId: "matrix-proof-outage", nonce: "nonce-proof-outage" }),
  );

  const exchangeFailure = new FailingMatrixAuthority();
  exchangeFailure.failure = "SESSION_ACTIVE";
  await rejectsSanitizedAuthorityFailure(
    exchange(exchangeFailure).exchange({ wpUserId: 42, sessionId: "matrix-active-outage", nonce: "nonce-active-outage" }),
  );

  const verificationFailure = new FailingMatrixAuthority();
  const sessionExchange = exchange(verificationFailure);
  const { token } = await sessionExchange.exchange({
    wpUserId: 42,
    sessionId: "matrix-verify-outage",
    nonce: "nonce-verify-outage",
  });
  verificationFailure.failure = "SESSION_ACTIVE";
  await rejectsSanitizedAuthorityFailure(sessionExchange.verify(token, { requestId: "request-authority-outage" }));
});

function timeline(owner = "principal_student", id = "timeline_adapter_security"): TimelineDocument {
  return {
    id,
    schemaVersion: "d1-timeline-document-409.1",
    studentOwnerId: owner,
    programId: "program_internal_medicine",
    title: "Recoverable local draft",
    theme: "keynote",
    revision: 0,
    events: [],
  };
}

class DisabledRemote implements StagingRemoteTimelineClient {
  getAvailability() {
    return { enabled: false, online: true, authenticated: true };
  }

  async saveCheckpoint(_request: StagingCheckpointRequest): Promise<{ revision: number }> {
    throw new Error("REMOTE_DISABLED");
  }

  async createVersion(_request: StagingVersionRequest): Promise<{ revision: number }> {
    throw new Error("REMOTE_DISABLED");
  }

  async getCurrentDocument(principalId: string, documentId: string): Promise<TimelineDocument> {
    return timeline(principalId, documentId);
  }
}

function coordinator(principalId = "principal_student"): StagingHybridSyncCoordinator {
  return new StagingHybridSyncCoordinator(
    principalId,
    new InMemoryStagingLocalDraftStore(),
    new DisabledRemote(),
    "device-adapter-security",
    { clock: () => new Date(NOW) },
  );
}

test("recovery JSON has a versioned checksum envelope and rejects mutation or unsupported formats", async () => {
  const owner = coordinator();
  await owner.saveLocal(timeline());
  const serialized = await owner.exportRecoveryJson("timeline_adapter_security");
  const packet = JSON.parse(serialized) as Record<string, any>;

  assert.equal(packet.schemaVersion, STAGING_RECOVERY_PAYLOAD_SCHEMA_VERSION);
  assert.match(packet.contentSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(packet.integrity, {
    algorithm: "SHA-256",
    canonicalization: "MISSIONMED_STABLE_JSON_V1",
    contentSha256: packet.contentSha256,
    envelopeSchemaVersion: STAGING_RECOVERY_ENVELOPE_SCHEMA_VERSION,
    payloadSchemaVersion: STAGING_RECOVERY_PAYLOAD_SCHEMA_VERSION,
  });
  assert.equal(verifyStagingRecoveryJson(serialized).draft.document.title, "Recoverable local draft");
  assert.equal(owner.verifyRecoveryJson(serialized, "timeline_adapter_security").contentSha256, packet.contentSha256);

  const tampered = structuredClone(packet);
  tampered.draft.document.title = "Corrupted after export";
  assert.throws(() => verifyStagingRecoveryJson(JSON.stringify(tampered)), hasCode("RECOVERY_CHECKSUM_MISMATCH"));

  const legacyUnverified = structuredClone(packet);
  delete legacyUnverified.contentSha256;
  delete legacyUnverified.integrity;
  assert.throws(() => verifyStagingRecoveryJson(JSON.stringify(legacyUnverified)), hasCode("RECOVERY_INTEGRITY_REQUIRED"));

  const futurePayload = structuredClone(packet);
  futurePayload.schemaVersion = "d1-timeline-hybrid-recovery-414.1";
  futurePayload.integrity.payloadSchemaVersion = futurePayload.schemaVersion;
  assert.throws(() => verifyStagingRecoveryJson(JSON.stringify(futurePayload)), hasCode("RECOVERY_SCHEMA_UNSUPPORTED"));

  const futureEnvelope = structuredClone(packet);
  futureEnvelope.integrity.envelopeSchemaVersion = "d1-timeline-hybrid-recovery-envelope-414.1";
  assert.throws(() => verifyStagingRecoveryJson(JSON.stringify(futureEnvelope)), hasCode("RECOVERY_ENVELOPE_SCHEMA_UNSUPPORTED"));

  const otherOwner = coordinator("principal_other");
  await otherOwner.saveLocal(timeline("principal_other"));
  const otherPacket = await otherOwner.exportRecoveryJson("timeline_adapter_security");
  assert.throws(() => owner.verifyRecoveryJson(otherPacket), hasCode("RECOVERY_PRINCIPAL_MISMATCH"));
  assert.throws(() => owner.verifyRecoveryJson(serialized, "timeline_other"), hasCode("RECOVERY_DOCUMENT_MISMATCH"));
});

function artifactInput(vault: LocalLegacyFileVaultContractFixture): LegacyPublishInput {
  const primaryBytes = new TextEncoder().encode("%PDF-1.4\nadapter security\n%%EOF\n");
  const primaryHash = sha256(primaryBytes);
  const primaryFile = {
    role: "PRIMARY" as const,
    objectId: `object_${primaryHash.slice(0, 12)}`,
    filename: "mission-timeline.pdf",
    mimeType: "application/pdf",
    byteSize: primaryBytes.byteLength,
    sha256: primaryHash,
    contentHash: primaryHash,
  };
  const artifact: TimelineArtifact = {
    artifactId: "artifact_adapter_security_413",
    artifactSchemaVersion: "d1-timeline-artifact-409.1",
    artifactType: "TIMELINE_PRINT_PDF",
    timelineDocumentId: "timeline_adapter_security",
    timelineVersionId: "version_adapter_security_413",
    studentOwnerId: "principal_student",
    programId: "program_internal_medicine",
    createdByRole: "SYSTEM_LOCAL",
    createdAt: NOW,
    updatedAt: NOW,
    displayName: "Mission Timeline",
    description: "Adapter security fixture",
    documentCategory: "MISSION_TIMELINE",
    mimeType: "application/pdf",
    byteSize: primaryBytes.byteLength,
    contentHash: sha256(stableStringify([{ role: "PRIMARY", sha256: primaryHash }])),
    exportScope: "PRINT",
    visibility: "INTERVIEWER_SAFE",
    approvalState: {},
    theme: "keynote",
    dimensions: null,
    pageCount: 1,
    previewImage: null,
    primaryFile,
    companionFiles: [],
    sourceDocumentReferences: [],
    timelineEventCount: 0,
    generatedQuestionCount: 0,
    advisorCommentCount: 0,
    files: [primaryFile],
    warnings: [],
    provenanceSummary: {},
    retentionClass: "STUDENT_CONTROLLED_PRIVATE",
    fileVaultLinkageState: "PENDING",
    legacyVaultReference: null,
    v2VaultReference: null,
    synchronizationStatus: "ARTIFACT_READY",
    synchronizationHistory: [],
    idempotencyKey: "adapter-security-filevault",
  };
  return {
    artifact,
    primaryBytes,
    session: vault.issueSession(101, artifact.studentOwnerId),
  };
}

test("FileVault nonce validation requires the configured issuer", () => {
  const vault = new LocalLegacyFileVaultContractFixture({
    nonceSecret: FILEVAULT_SECRET,
    nonceIssuer: "trusted-matrix-issuer",
    clock: () => new Date(NOW),
  });
  const input = artifactInput(vault);
  const [issuedPayload] = input.session.nonce.split(".");
  assert.ok(issuedPayload);
  const payload = JSON.parse(Buffer.from(issuedPayload, "base64url").toString("utf8")) as Record<string, unknown>;
  const forgedPayload = Buffer.from(
    stableStringify({ ...payload, issuer: "attacker-issuer" }),
    "utf8",
  ).toString("base64url");
  const forgedSignature = createHmac("sha256", FILEVAULT_SECRET).update(forgedPayload).digest("hex");

  assert.throws(
    () => vault.publish({ ...input, session: { ...input.session, nonce: `${forgedPayload}.${forgedSignature}` } }),
    hasCode("FILEVAULT_WORDPRESS_NONCE_INVALID"),
  );
  assert.equal(vault.publish(input).status, "LINKED");
  assert.throws(
    () => new LocalLegacyFileVaultContractFixture({ nonceSecret: FILEVAULT_SECRET, nonceIssuer: "   " }),
    hasCode("FILEVAULT_FIXTURE_NONCE_ISSUER_INVALID"),
  );
});
