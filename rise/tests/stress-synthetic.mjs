#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

import { createRiseServer } from "../server.mjs";

function record(index) {
  const designation = index % 5 === 0 ? "Internal Medicine/Pediatrics" : "Internal Medicine";
  const combined = designation.includes("/");
  return {
    id: `rise_prg_stress_${index}`,
    programSpecialtyId: `rise_ps_stress_${index}`,
    display: {
      programName: `Synthetic Stress Program ${String(index).padStart(5, "0")}`,
      institution: `Synthetic Institution ${index % 200}`,
      hospital: `Synthetic Hospital ${index % 300}`,
      city: `Test City ${index % 100}`,
      state: index % 2 ? "NY" : "CA",
      zip: "00000",
    },
    designation,
    kind: combined ? "combined" : "single",
    entryFormat: "categorical",
    components: designation.split("/"),
    browseMemberships: combined
      ? [
        { browseSpecialty: "Internal Medicine", relationship: "RELATED_COMBINED" },
        { browseSpecialty: "Pediatrics", relationship: "RELATED_COMBINED" },
      ]
      : [{ browseSpecialty: "Internal Medicine", relationship: "EXACT_DESIGNATION" }],
    fields: {
      J1: { knowledge: index % 3 === 0 ? { state: "known", value: true } : { state: "unknown" } },
      H1B: { knowledge: index % 7 === 0 ? { state: "known", value: true } : { state: "unknown" } },
      "Program Best Described As": { knowledge: { state: "known", value: "Synthetic university-based" } },
    },
    evidence: {
      knownClaims: 40,
      knownEvidenceLabeledClaims: 40,
      evidenceLabeledClaims: 60,
      quarantinedClaims: 0,
      coveragePercent: index % 100,
      matchableClaims: 0,
    },
    source: {
      authority: "SYNTHETIC_STRESS_TEST",
      retrievedAt: "2026-07-15",
      sourceUpdatedAt: "2026-07-15",
    },
  };
}

function percentile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

const programCount = Number.parseInt(process.env.RISE_STRESS_PROGRAMS ?? "6500", 10);
const requestCount = Number.parseInt(process.env.RISE_STRESS_REQUESTS ?? "100", 10);
const programs = Array.from({ length: programCount }, (_, index) => record(index));
const registryIndex = {
  schemaVersion: 1,
  registryReleaseId: "rise_registry_synthetic_stress_fixture",
  sourceSnapshotId: "rise_snapshot_synthetic_stress_fixture",
  activationStatus: "test_fixture",
  dataClassification: "synthetic_test_fixture",
  releaseGate: { sourceRightsApproved: false },
  counts: {
    activeSourceRows: programCount,
    quarantinedSourceRows: 0,
    uniquePrograms: programCount,
    programSpecialties: programCount,
    additionalBrowseMemberships: Math.floor(programCount / 5),
    evidenceLabeledClaims: programCount * 60,
    unknownClaimsFromAmbiguousNegatives: 0,
    omittedBlankCells: 0,
    matchableClaims: 0,
  },
  filters: { states: ["CA", "NY"], specialties: ["Internal Medicine", "Pediatrics"] },
  programs,
};

const server = createRiseServer({
  registryIndex,
  authMode: "injected",
  authenticator: async (request) => ({
    subject: request.headers["x-test-subject"],
    audience: "rise",
    capabilities: ["rise:read"],
  }),
  buildId: "synthetic-stress-fixture",
  environment: "test",
  logger: { info() {}, error() {} },
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const durations = [];
const startedAt = performance.now();

try {
  const responses = await Promise.all(Array.from({ length: requestCount }, async (_, index) => {
    const requestStartedAt = performance.now();
    const response = await fetch(
      `${baseUrl}/api/rise/v1/programs?specialty=Internal%20Medicine&includeCombined=true&q=synthetic&pageSize=100&sort=${index % 2 ? "evidence" : "name"}`,
      { headers: { "X-Test-Subject": `stress-subject-${index}` } },
    );
    durations.push(performance.now() - requestStartedAt);
    return response;
  }));
  const statusCounts = responses.reduce((result, response) => {
    result[response.status] = (result[response.status] ?? 0) + 1;
    return result;
  }, {});
  const report = {
    generatedAt: new Date().toISOString(),
    dataClassification: "synthetic_test_fixture",
    programCount,
    requestCount,
    statusCounts,
    wallTimeMs: Math.round((performance.now() - startedAt) * 10) / 10,
    latencyMs: {
      median: Math.round(percentile(durations, 0.5) * 10) / 10,
      p95: Math.round(percentile(durations, 0.95) * 10) / 10,
      max: Math.round(Math.max(...durations) * 10) / 10,
    },
    processMemoryMb: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024 * 10) / 10,
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 10) / 10,
    },
  };
  if (statusCounts[200] !== requestCount) process.exitCode = 1;
  const outputIndex = process.argv.indexOf("--out");
  if (outputIndex >= 0 && process.argv[outputIndex + 1]) {
    const outputPath = path.resolve(process.argv[outputIndex + 1]);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
