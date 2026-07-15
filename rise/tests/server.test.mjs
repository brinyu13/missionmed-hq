import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, test } from "node:test";

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  createRiseServer,
  isProductionEnvironment,
  loadRegistryIndex,
  loadWebBuild,
  validateListenConfiguration,
} from "../server.mjs";

function known(value) {
  return { knowledge: { state: "known", value, explicit: true } };
}

function unknown() {
  return { knowledge: { state: "unknown", explicit: true } };
}

function record({ id, name, designation, state = "NY", memberships, j1, h1b, type = "University-based" }) {
  return {
    id: `program-${id}`,
    programSpecialtyId: `ps-${id}`,
    display: { programName: name, institution: `${name} Institution`, hospital: `${name} Hospital`, city: "Albany", state, zip: "12208" },
    designation,
    kind: designation.includes("/") ? "combined" : "single",
    entryFormat: "categorical",
    components: designation.split("/"),
    identifiers: [{ namespace: "ACGME_PROGRAM", value: id === "im" ? "1400000001" : `fixture-${id}` }],
    browseMemberships: memberships,
    fields: {
      "Program Best Described As": known(type),
      J1: j1 === undefined ? unknown() : known(j1),
      H1B: h1b === undefined ? unknown() : known(h1b),
      "Program Director": known("Test Director"),
    },
    evidence: { knownClaims: 4, evidenceLabeledClaims: 3, quarantinedClaims: 0, coveragePercent: 75, matchableClaims: 0 },
    source: { authority: "FREIDA_GME_CENSUS", assertionClass: "program_reported", urls: ["https://example.test/program"], retrievedAt: "2026-07-09", sourceUpdatedAt: "2026-02-01" },
  };
}

const registryIndex = {
  schemaVersion: 1,
  registryReleaseId: "rise_registry_test",
  sourceSnapshotId: "rise_snapshot_test",
  activationStatus: "test_fixture",
  dataClassification: "synthetic_test_fixture",
  releaseGate: { sourceRightsApproved: false },
  counts: {
    rawSourceRows: 3,
    activeSourceRows: 3,
    quarantinedSourceRows: 1,
    uniquePrograms: 3,
    programSpecialties: 3,
    browseMemberships: 4,
    additionalBrowseMemberships: 1,
    specialtyTabs: 3,
    exactSpecialtyDesignations: 3,
    evidenceLabeledClaims: 9,
    unknownClaimsFromAmbiguousNegatives: 2,
    omittedBlankCells: 10,
    matchableClaims: 0,
  },
  filters: { states: ["CA", "NY"], specialties: ["Internal Medicine", "Pediatrics", "Psychiatry"] },
  programs: [
    record({
      id: "im",
      name: "Alpha Internal Medicine Program",
      designation: "Internal Medicine",
      j1: true,
      memberships: [{ browseSpecialty: "Internal Medicine", relationship: "EXACT_DESIGNATION" }],
    }),
    record({
      id: "combined",
      name: "Beta Medicine Pediatrics Program",
      designation: "Internal Medicine/Pediatrics",
      state: "CA",
      h1b: true,
      memberships: [
        { browseSpecialty: "Internal Medicine", relationship: "RELATED_COMBINED" },
        { browseSpecialty: "Pediatrics", relationship: "RELATED_COMBINED" },
      ],
    }),
    record({
      id: "psych",
      name: "Gamma Psychiatry Program",
      designation: "Psychiatry",
      memberships: [{ browseSpecialty: "Psychiatry", relationship: "EXACT_DESIGNATION" }],
    }),
  ],
};

function sourceControlledIndex() {
  const authorizationSha256 = "b".repeat(64);
  return {
    index: {
      ...registryIndex,
      dataClassification: "source_controlled_registry",
      releaseGate: {
        sourceRightsApproved: true,
        sourceRights: [{
          source: "FREIDA",
          status: "approved",
          sha256: authorizationSha256,
          sourceOwnerGrantSha256: "d".repeat(64),
          sourceOwnerGrantBytesVerified: true,
          authorizationId: "fixture-authorization",
          decisionRecordId: "fixture-decision",
          validThrough: "2099-12-31",
        }],
      },
    },
    authorizationSha256,
  };
}

let server;
let baseUrl;

before(async () => {
  server = createRiseServer({
    registryIndex,
    logger: { info() {}, error() {} },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("health is public and static responses include restrictive headers", async () => {
  const health = await fetch(`${baseUrl}/api/rise/v1/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).registryReleaseId, "rise_registry_test");

  const page = await fetch(`${baseUrl}/rise/`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-security-policy"), /default-src 'self'/);
  assert.equal(page.headers.get("x-frame-options"), "DENY");
  assert.equal(page.headers.get("cache-control"), "no-cache");
  assert.ok(page.headers.get("x-request-id"));

  const vendor = await fetch(`${baseUrl}/vendor/lucide.js`);
  assert.equal(vendor.status, 200);
  assert.equal(vendor.headers.get("cache-control"), "no-cache");

  const traversal = await fetch(`${baseUrl}/rise/%2e%2e/package.json`);
  assert.equal(traversal.status, 404);
  assert.equal((await traversal.json()).error.code, "NOT_FOUND");
});

test("local preview session is explicit and status is evidence truthful", async () => {
  const response = await fetch(`${baseUrl}/api/rise/v1/status`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-rise-preview"), "true");
  assert.equal(body.activationStatus, "test_fixture");
  assert.equal(body.dataClassification, "synthetic_test_fixture");
  assert.equal(body.sourceRightsApproved, false);
  assert.equal(body.integrations.matrix, "disabled");
  assert.equal(body.counts.matchableClaims, 0);
});

test("combined records require explicit inclusion for specialty browsing", async () => {
  const exact = await fetch(`${baseUrl}/api/rise/v1/programs?specialty=Internal%20Medicine&includeCombined=false`);
  const exactBody = await exact.json();
  assert.equal(exactBody.total, 1);
  assert.equal(exactBody.records[0].designation, "Internal Medicine");

  const withCombined = await fetch(`${baseUrl}/api/rise/v1/programs?specialty=Internal%20Medicine&includeCombined=true`);
  const combinedBody = await withCombined.json();
  assert.equal(combinedBody.total, 2);
  assert.deepEqual(combinedBody.records.map((item) => item.designation), ["Internal Medicine", "Internal Medicine/Pediatrics"]);
});

test("search includes immutable and external program identifiers", async () => {
  const byExternal = await fetch(`${baseUrl}/api/rise/v1/programs?q=1400000001`);
  assert.equal((await byExternal.json()).records[0].programSpecialtyId, "ps-im");
  const byOffering = await fetch(`${baseUrl}/api/rise/v1/programs?q=ps-combined`);
  assert.equal((await byOffering.json()).records[0].programSpecialtyId, "ps-combined");
});

test("visa filters include only confirmed affirmative evidence", async () => {
  const j1 = await fetch(`${baseUrl}/api/rise/v1/programs?visa=J1`);
  const j1Body = await j1.json();
  assert.equal(j1Body.total, 1);
  assert.equal(j1Body.records[0].programSpecialtyId, "ps-im");

  const h1b = await fetch(`${baseUrl}/api/rise/v1/programs?visa=H1B`);
  const h1bBody = await h1b.json();
  assert.equal(h1bBody.total, 1);
  assert.equal(h1bBody.records[0].programSpecialtyId, "ps-combined");
});

test("pagination is bounded and malformed filter values fail harmlessly", async () => {
  const bounded = await fetch(`${baseUrl}/api/rise/v1/programs?page=999&pageSize=10000&sort=unexpected`);
  const boundedBody = await bounded.json();
  assert.equal(boundedBody.pageSize, 50);
  assert.equal(boundedBody.records.length, 0);
  assert.equal(boundedBody.total, 3);

  const malformed = await fetch(`${baseUrl}/api/rise/v1/programs?evidence=%3Cscript%3E&visa=INVALID`);
  const malformedBody = await malformed.json();
  assert.equal(malformed.status, 200);
  assert.equal(malformedBody.total, 0);
});

test("profiles return evidence records and unknowns without coercion", async () => {
  const response = await fetch(`${baseUrl}/api/rise/v1/program-specialties/ps-psych`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.program.fields.J1.knowledge.state, "unknown");

  const missing = await fetch(`${baseUrl}/api/rise/v1/program-specialties/does-not-exist`);
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, "PROGRAM_NOT_FOUND");
});

test("matching, integrations, and operator writes fail closed", async () => {
  const match = await fetch(`${baseUrl}/api/rise/v1/matches:evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ programSpecialtyId: "ps-im" }),
  });
  assert.equal(match.status, 409);
  assert.equal((await match.json()).error.code, "MATCHING_EVIDENCE_NOT_READY");

  const handoff = await fetch(`${baseUrl}/api/rise/v1/handoffs/actn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(handoff.status, 409);
  assert.equal((await handoff.json()).error.code, "INTEGRATION_DISABLED");

  const queue = await fetch(`${baseUrl}/api/rise/v1/operator/queue`);
  assert.equal(queue.status, 409);
  assert.equal((await queue.json()).error.details.quarantinedSourceRows, 1);
});

test("oversized and invalid request bodies are rejected", async () => {
  const invalid = await fetch(`${baseUrl}/api/rise/v1/matches:evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error.code, "INVALID_JSON");

  const large = await fetch(`${baseUrl}/api/rise/v1/matches:evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: "x".repeat(70_000) }),
  });
  assert.equal(large.status, 413);
  assert.equal((await large.json()).error.code, "BODY_TOO_LARGE");
});

test("production refuses preview auth and injected host sessions require audience and capability", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    assert.throws(() => createRiseServer({ registryIndex, authMode: "local-preview" }), /prohibited in production/);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }

  const authenticated = createRiseServer({
    registryIndex,
    authMode: "injected",
    authenticator: async (request) => request.headers.cookie === "missionmed_session=accepted"
      ? { subject: "user-1", role: "student", audience: "rise", capabilities: ["rise:read"] }
      : null,
    logger: { info() {}, error() {} },
  });
  await new Promise((resolve) => authenticated.listen(0, "127.0.0.1", resolve));
  const authBase = `http://127.0.0.1:${authenticated.address().port}`;
  try {
    assert.equal((await fetch(`${authBase}/api/rise/v1/status`)).status, 401);
    const bearerRejected = await fetch(`${authBase}/api/rise/v1/session`, {
      headers: { Authorization: "Bearer test-token", Cookie: "missionmed_session=accepted" },
    });
    assert.equal(bearerRejected.status, 401);
    const accepted = await fetch(`${authBase}/api/rise/v1/session`, {
      headers: { Cookie: "missionmed_session=accepted" },
    });
    assert.equal(accepted.status, 200);
    assert.equal((await accepted.json()).subject, "user-1");
  } finally {
    await new Promise((resolve, reject) => authenticated.close((error) => error ? reject(error) : resolve()));
  }
});

test("production requires a shared durable abuse controller", () => {
  const source = sourceControlledIndex();
  const options = {
    registryIndex: source.index,
    authMode: "injected",
    authenticator: async () => ({ subject: "test", audience: "rise", capabilities: ["rise:read"] }),
    production: true,
    expectedSourceAuthorizationSha256s: source.authorizationSha256,
  };
  assert.throws(() => createRiseServer(options), /shared durable abuse controller/);
  createRiseServer({
    ...options,
    abuseController: {
      scope: "shared_durable",
      async allowPreAuth() { return true; },
      async allowAuthenticatedSubject() { return true; },
    },
  });
});

test("pre-auth abuse control rejects requests before authentication work", async () => {
  let authenticatorCalls = 0;
  const protectedServer = createRiseServer({
    registryIndex,
    authMode: "injected",
    authenticator: async () => {
      authenticatorCalls += 1;
      return { subject: "test", audience: "rise", capabilities: ["rise:read"] };
    },
    abuseController: {
      scope: "test",
      async allowPreAuth() { return false; },
      async allowAuthenticatedSubject() { return true; },
    },
    logger: { info() {}, error() {} },
  });
  await new Promise((resolve) => protectedServer.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${protectedServer.address().port}/api/rise/v1/status`);
    assert.equal(response.status, 429);
    assert.equal((await response.json()).error.code, "PRE_AUTH_RATE_LIMITED");
    assert.equal(authenticatorCalls, 0);
  } finally {
    await new Promise((resolve, reject) => protectedServer.close((error) => error ? reject(error) : resolve()));
  }
});

test("RISE_ENVIRONMENT production independently enables every production guard", () => {
  assert.equal(isProductionEnvironment({ nodeEnv: "test", riseEnvironment: "production" }), true);
  assert.throws(() => createRiseServer({
    registryIndex,
    authMode: "injected",
    authenticator: async () => ({ subject: "test", audience: "rise", capabilities: ["rise:read"] }),
    environment: "production",
  }), /Synthetic RISE fixtures are prohibited in production/);
  assert.throws(
    () => validateListenConfiguration({
      host: "127.0.0.1",
      authMode: "local-preview",
      nodeEnv: "test",
      riseEnvironment: "production",
    }),
    /prohibited in production/,
  );
});

test("injected sessions without RISE capabilities are forbidden", async () => {
  const restricted = createRiseServer({
    registryIndex,
    authMode: "injected",
    authenticator: async () => ({ subject: "user-2", audience: "rise", capabilities: [] }),
    logger: { info() {}, error() {} },
  });
  await new Promise((resolve) => restricted.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${restricted.address().port}/api/rise/v1/status`);
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, "FORBIDDEN");
  } finally {
    await new Promise((resolve, reject) => restricted.close((error) => error ? reject(error) : resolve()));
  }
});

test("preview auth cannot bind to a non-loopback host", () => {
  assert.equal(validateListenConfiguration({ host: "127.0.0.1", authMode: "local-preview", nodeEnv: "test" }), true);
  assert.throws(
    () => validateListenConfiguration({ host: "0.0.0.0", authMode: "local-preview", nodeEnv: "test" }),
    /loopback/,
  );
});

test("registry indexes are authenticated by SHA-256 in production", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "rise-index-test-"));
  const indexPath = path.join(directory, "api-index.json");
  await fs.writeFile(indexPath, `${JSON.stringify(registryIndex)}\n`);
  try {
    await assert.rejects(
      loadRegistryIndex(indexPath, { production: true }),
      /RISE_INDEX_SHA256 is required/,
    );
    await assert.rejects(
      loadRegistryIndex(indexPath, { production: false, expectedSha256: "0".repeat(64) }),
      /hash mismatch/,
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("real registry material remains blocked without source-rights approval", () => {
  assert.throws(() => createRiseServer({
    registryIndex: { ...registryIndex, dataClassification: "source_controlled_registry" },
  }), /source rights are not approved/);
});

test("source-controlled indexes require current runtime authorization pins", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "rise-source-pin-test-"));
  const indexPath = path.join(directory, "api-index.json");
  const source = sourceControlledIndex();
  const authorizationSha = source.authorizationSha256;
  const sourceIndex = source.index;
  const bytes = Buffer.from(`${JSON.stringify(sourceIndex)}\n`);
  await fs.writeFile(indexPath, bytes);
  const indexSha = createHash("sha256").update(bytes).digest("hex");
  const manifestPath = path.join(directory, "index-manifest.json");
  await fs.writeFile(manifestPath, JSON.stringify({
    schemaVersion: 1,
    immutable: true,
    registryReleaseId: sourceIndex.registryReleaseId,
    dataClassification: "source_controlled_registry",
    sourceRightsApproved: true,
    sourceRights: sourceIndex.releaseGate.sourceRights,
    apiIndexSha256: indexSha,
  }));
  try {
    await assert.rejects(
      loadRegistryIndex(path.join(directory, "must-not-be-read.json"), {
        production: true,
        expectedSha256: indexSha,
        manifestPath,
      }),
      /SOURCE_AUTHORIZATION_SHA256S is required/,
    );
    await assert.rejects(
      loadRegistryIndex(indexPath, {
        production: true,
        expectedSha256: indexSha,
        manifestPath,
        expectedSourceAuthorizationSha256s: "c".repeat(64),
      }),
      /authorization hashes do not match/,
    );
    const loaded = await loadRegistryIndex(indexPath, {
      production: true,
      expectedSha256: indexSha,
      manifestPath,
      expectedSourceAuthorizationSha256s: authorizationSha,
    });
    assert.equal(loaded.registryReleaseId, registryIndex.registryReleaseId);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("authenticated rate limiting is subject-scoped, bounded, and audit-safe", async () => {
  const logs = [];
  const limited = createRiseServer({
    registryIndex,
    authMode: "injected",
    authenticator: async (request) => ({
      subject: request.headers["x-test-subject"] ?? "user-a",
      audience: "rise",
      capabilities: ["rise:read"],
    }),
    logger: { info(entry) { logs.push(entry); }, error() {} },
  });
  await new Promise((resolve) => limited.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${limited.address().port}/api/rise/v1/programs?pageSize=50`;
  try {
    for (let index = 0; index < 20; index += 1) assert.equal((await fetch(url)).status, 200);
    assert.equal((await fetch(url)).status, 429);
    assert.equal((await fetch(url, { headers: { "X-Test-Subject": "user-b" } })).status, 200);
    assert.ok(logs.some((entry) => /^[a-f0-9]{16}$/.test(entry.subjectAuditId ?? "")));
    assert.equal(logs.some((entry) => entry.subject === "user-a"), false);
  } finally {
    await new Promise((resolve, reject) => limited.close((error) => error ? reject(error) : resolve()));
  }
});

test("web build manifest and every asset hash are authenticated", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "rise-web-build-test-"));
  await fs.writeFile(path.join(directory, "app.js"), "console.log('fixture');\n");
  const assetSha = createHash("sha256").update(await fs.readFile(path.join(directory, "app.js"))).digest("hex");
  const manifest = { schemaVersion: 1, buildId: "rise_web_fixture", files: { "app.js": assetSha } };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest)}\n`);
  await fs.writeFile(path.join(directory, "asset-manifest.json"), manifestBytes);
  const manifestSha = createHash("sha256").update(manifestBytes).digest("hex");
  try {
    assert.equal((await loadWebBuild(directory, { production: true, expectedManifestSha256: manifestSha })).buildId, "rise_web_fixture");
    await fs.appendFile(path.join(directory, "app.js"), "tampered\n");
    await assert.rejects(
      loadWebBuild(directory, { production: true, expectedManifestSha256: manifestSha }),
      /asset hash mismatch/,
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
