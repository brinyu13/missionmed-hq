import assert from "node:assert/strict";
import test from "node:test";

import { buildDatabasePoolConfiguration } from "../adapters/postgres-runtime.mjs";

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
