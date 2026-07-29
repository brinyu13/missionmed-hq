#!/usr/bin/env node
import assert from "node:assert/strict";

import {
  LocalMacProRenderCoordinator,
  LocalMacProWorkerSimulator,
  MAC_PRO_STAGING_MODE,
} from "../../src/export/staging/mac-pro-renderer-staging.ts";
import { canonicalDocumentHash } from "../../src/core/canonical.ts";

const envelopeSecret = process.env.D1_MAC_PRO_ENVELOPE_SECRET;
const workerSecret = process.env.D1_MAC_PRO_WORKER_SECRET;
if (!envelopeSecret || !workerSecret) {
  console.error("D1_MAC_PRO_ENVELOPE_SECRET and D1_MAC_PRO_WORKER_SECRET are required for the local acceptance fixture.");
  process.exitCode = 2;
} else {
  const authority = {
    approvedTemplateId: "timeline-2025-canonical",
    templateSha256: "113d22efb8ca2c00c29d8e57b92c1eb24ff2c66931f7138bbf23daa66dbba706",
    rendererVersion: "mac-pro-local-fixture-413.1",
    rendererSha256: "a".repeat(64),
    fontManifestSha256: "b".repeat(64),
    assetManifestSha256: "c".repeat(64),
  };
  const coordinator = new LocalMacProRenderCoordinator({
    envelopeKeyId: "d1-413-local-envelope-key",
    envelopeSecret,
    workerSecret,
    authority,
  });
  const worker = new LocalMacProWorkerSimulator({
    workerId: "mac-pro-local-staging-fixture",
    workerSecret,
    freeDiskBytes: 20 * 1024 * 1024 * 1024,
    minimumFreeDiskBytes: 10 * 1024 * 1024 * 1024,
  });
  const document = {
    id: "timeline_acceptance_413",
    schemaVersion: "d1-timeline-document-409.1",
    studentOwnerId: "acceptance-owner-not-forwarded",
    programId: "acceptance-program-not-forwarded",
    title: "Acceptance Timeline",
    theme: "keynote",
    revision: 1,
    events: [{
      id: "event_acceptance",
      title: "Accepted event",
      categoryId: "work",
      eventType: "bar",
      startDate: "2026-01",
      endDate: "2026-02",
      visibilityState: "INTERVIEWER_SAFE",
    }],
  };
  const contentHash = canonicalDocumentHash(document);
  const submission = {
    jobId: "render_acceptance_413",
    idempotencyKey: "render-acceptance-413",
    artifactType: "TIMELINE_INTERVIEWER_SAFE_PNG",
    scope: "INTERVIEWER_SAFE",
    document,
    sourceVersionId: "version_acceptance_413",
    sourceContentSha256: contentHash,
    approval: { decision: "APPROVED", sourceVersionId: "version_acceptance_413", sourceContentSha256: contentHash, approvedAt: new Date().toISOString() },
    authority,
    requestedFormats: ["PNG"],
  };
  const queued = coordinator.submit(submission);
  const completed = worker.runOnce(coordinator);
  const replay = coordinator.submit(submission);
  assert.equal(coordinator.mode, MAC_PRO_STAGING_MODE);
  assert.equal(coordinator.connected, false);
  assert.equal(queued.status, "QUEUED");
  assert.equal(completed?.status, "COMPLETED");
  assert.equal(replay.status, "COMPLETED");
  assert.equal(completed?.outputs[0]?.width, 1920);
  assert.equal(completed?.outputs[0]?.height, 1080);
  console.log(JSON.stringify({
    status: "PASS",
    mode: coordinator.mode,
    connected: coordinator.connected,
    firstCompletion: completed?.status,
    replayStatus: replay.status,
    output: {
      mimeType: completed?.outputs[0]?.mimeType,
      width: completed?.outputs[0]?.width,
      height: completed?.outputs[0]?.height,
      sha256: completed?.outputs[0]?.sha256,
    },
  }, null, 2));
}
