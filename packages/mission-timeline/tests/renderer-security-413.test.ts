import assert from "node:assert/strict";
import test from "node:test";

import type { TimelineDocument } from "../src/contracts/types.js";
import { canonicalDocumentHash } from "../src/core/canonical.js";
import {
  LocalMacProRenderCoordinator,
  signWorkerCommand,
  type MacProAuthorityPolicy,
  type MacProRenderSubmission,
} from "../src/export/staging/mac-pro-renderer-staging.js";
import { document } from "./fixtures.js";

const NOW = "2026-07-15T12:00:00.000Z";
const ENVELOPE_SECRET = "d1-413-security-envelope-secret";
const WORKER_SECRET = "d1-413-security-worker-secret";

const authority: MacProAuthorityPolicy = {
  approvedTemplateId: "timeline-2025-canonical",
  templateSha256: "1".repeat(64),
  rendererVersion: "mac-pro-local-fixture-413.1",
  rendererSha256: "2".repeat(64),
  fontManifestSha256: "3".repeat(64),
  assetManifestSha256: "4".repeat(64),
};

function coordinator(clock: () => Date = () => new Date(NOW)) {
  return new LocalMacProRenderCoordinator({
    envelopeKeyId: "d1-413-security-envelope-key",
    envelopeSecret: ENVELOPE_SECRET,
    workerSecret: WORKER_SECRET,
    authority,
    leaseMs: 1_000,
    heartbeatTimeoutMs: 1_000,
    clock,
  });
}

function submission(
  source: TimelineDocument,
  overrides: Partial<MacProRenderSubmission> = {},
): MacProRenderSubmission {
  const sourceVersionId = overrides.sourceVersionId ?? "version_security_413";
  const sourceContentSha256 = overrides.sourceContentSha256 ?? canonicalDocumentHash(source);
  return {
    jobId: "render_job_security_413",
    idempotencyKey: "render-job-security-413",
    artifactType: "TIMELINE_INTERVIEWER_SAFE_PNG",
    scope: "INTERVIEWER_SAFE",
    document: source,
    sourceVersionId,
    sourceContentSha256,
    approval: {
      decision: "APPROVED",
      sourceVersionId,
      sourceContentSha256,
      approvedAt: NOW,
    },
    authority,
    requestedFormats: ["PNG"],
    ...overrides,
  };
}

function hasCode(code: string) {
  return (error: { code?: string }) => error.code === code;
}

test("renderer recomputes the approved hash from the submitted document", () => {
  const approved = document({ title: "Approved timeline" });
  const approvedHash = canonicalDocumentHash(approved);
  const changed = document({ title: "Changed after approval" });
  const request = submission(changed, {
    sourceContentSha256: approvedHash,
    approval: {
      decision: "APPROVED",
      sourceVersionId: "version_security_413",
      sourceContentSha256: approvedHash,
      approvedAt: NOW,
    },
  });

  assert.throws(() => coordinator().submit(request), hasCode("RENDER_SOURCE_DOCUMENT_HASH_MISMATCH"));
});

test("one signed CLAIM command cannot claim multiple jobs", () => {
  const queue = coordinator();
  queue.submit(submission(document()));
  queue.submit(submission(document({ id: "timeline_security_second" }), {
    jobId: "render_job_security_413_second",
    idempotencyKey: "render-job-security-413-second",
  }));
  const claim = signWorkerCommand(WORKER_SECRET, "worker-security", "CLAIM", "*", NOW);

  assert.ok(queue.claimNext(claim));
  assert.throws(() => queue.claimNext(claim), hasCode("RENDER_WORKER_COMMAND_REPLAYED"));
  assert.equal(queue.getJob("render_job_security_413_second")?.status, "QUEUED");
});

test("an expired lease rejects heartbeat until the job is re-claimed", () => {
  let nowMs = Date.parse(NOW);
  const clock = () => new Date(nowMs);
  const queue = coordinator(clock);
  queue.submit(submission(document()));
  const firstClaim = signWorkerCommand(WORKER_SECRET, "worker-security", "CLAIM", "*", clock().toISOString());
  const first = queue.claimNext(firstClaim);
  assert.ok(first);

  nowMs += 1_001;
  const expiredHeartbeat = signWorkerCommand(WORKER_SECRET, "worker-security", "HEARTBEAT", first.jobId, clock().toISOString());
  assert.throws(() => queue.heartbeat(first.jobId, expiredHeartbeat), hasCode("RENDER_LEASE_EXPIRED"));
  assert.equal(queue.getJob(first.jobId)?.leaseExpiresAt, first.leaseExpiresAt);

  const secondClaim = signWorkerCommand(WORKER_SECRET, "worker-security", "CLAIM", "*", clock().toISOString());
  const reclaimed = queue.claimNext(secondClaim);
  assert.equal(reclaimed?.jobId, first.jobId);
  assert.equal(reclaimed?.attempt, 2);
  const heartbeat = signWorkerCommand(WORKER_SECRET, "worker-security", "HEARTBEAT", first.jobId, clock().toISOString());
  assert.doesNotThrow(() => queue.heartbeat(first.jobId, heartbeat));
});
