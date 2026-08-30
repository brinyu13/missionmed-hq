import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { buildDatabasePoolConfiguration, createRiseCanonicalEvidenceStore } from "../adapters/postgres-runtime.mjs";
import { importSoap2026 } from "../tools/import-soap-2026.mjs";

test("Postgres runtime pins encrypted Railway transport outside URL overrides", () => {
  const configuration = buildDatabasePoolConfiguration({
    databaseUrl: "postgresql://rise:secret@postgres.railway.internal:5432/railway?sslmode=require&application_name=unsafe",
    sslMode: "require",
  });
  const parsed = new URL(configuration.connectionString);
  assert.equal(parsed.search, "");
  assert.deepEqual(configuration.ssl, { rejectUnauthorized: false });
  assert.equal(configuration.application_name, "missionmed-rise");
});

test("durable Student Intel promotion and provider ingestion target the same canonical evidence tables", async () => {
  const source = await fs.readFile(new URL("../adapters/postgres-runtime.mjs", import.meta.url), "utf8");
  assert.match(source, /canonicalPromotionMode: "live"/);
  assert.match(source, /INSERT INTO rise_runtime\.canonical_evidence_sources/);
  assert.match(source, /INSERT INTO rise_runtime\.canonical_evidence_claims/);
  assert.match(source, /INSERT INTO rise_runtime\.provider_ingest_runs/);
  assert.match(source, /new_spend_usd, claim_count[\s\S]*'INGESTED', 0/);
  assert.match(source, /ON CONFLICT \(content_sha256\) DO NOTHING/);
});

test("SOAP backfill atomically converges identities and mixed-exposure historical claims at zero spend", async () => {
  const executed = [];
  const client = {
    async query(sql, parameters = []) {
      executed.push({ sql, parameters });
      if (sql.includes("INSERT INTO rise_runtime.provider_ingest_runs")) {
        return { rows: [{ ingest_run_id: "fixture-run", inserted: true, replay_count: 0 }], rowCount: 1 };
      }
      return { rows: [], rowCount: sql.includes("INSERT INTO rise_runtime.canonical_evidence_claims") ? 1 : 1 };
    },
    release() {},
  };
  const pool = {
    async query() { return { rows: [] }; },
    async connect() { return client; },
  };
  const imported = await importSoap2026({ write: false });
  const store = await createRiseCanonicalEvidenceStore({ pool });
  const result = await store.ingestSoapDataset({
    release: imported.release,
    claims: imported.claims,
    sourceFile: "/read-only/07_SOAP_IMPORT_DATA.json",
    sourceFileSha256: imported.manifest.sourceSha256,
  });
  assert.equal(result.claimCount, 925);
  assert.equal(result.identityCount, 886);
  assert.equal(result.newSpendUsd, 0);
  assert.equal(executed.filter(({ sql }) => sql.includes("INSERT INTO rise_runtime.canonical_evidence_claims")).length, 925);
  assert.equal(executed.filter(({ sql }) => sql.includes("INSERT INTO rise_runtime.canonical_program_identities")).length, 886);
  assert.ok(executed.some(({ sql }) => sql.includes("'NRMP_SOAP_CLOSURE'") && sql.includes("new_spend_usd")));
  assert.ok(executed.some(({ sql }) => sql.includes("ON CONFLICT (idempotency_key) DO UPDATE")));
  assert.equal(executed.at(-1).sql.trim(), "COMMIT");
});

test("Postgres runtime rejects missing credentials and unknown TLS modes", () => {
  assert.throws(
    () => buildDatabasePoolConfiguration({ databaseUrl: "postgresql://postgres.railway.internal/railway", sslMode: "require" }),
    /authenticated PostgreSQL URL/,
  );
  assert.throws(
    () => buildDatabasePoolConfiguration({ databaseUrl: "postgresql://rise:secret@postgres.railway.internal/railway", sslMode: "prefer" }),
    /must be require or disable/,
  );
});
