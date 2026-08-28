#!/usr/bin/env node
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const here = path.dirname(fileURLToPath(import.meta.url));
const releaseDirectory = path.resolve(here, "../releases/student-rights-safe");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function requiredString(value, name) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${name} is required`);
  return normalized;
}

function assertStudentSafeProgram(program) {
  if (Object.keys(program.fields ?? {}).length !== 0) throw new Error(`Student program has unapproved deep fields: ${program.id}`);
  const namespaces = (program.identifiers ?? []).map((identifier) => identifier.namespace);
  if (namespaces.some((namespace) => namespace !== "MISSIONMED_RISE_ID")) {
    throw new Error(`Student program has a restricted external identifier: ${program.id}`);
  }
  const serialized = JSON.stringify(program);
  for (const prohibited of ["ACGME_PROGRAM", "NRMP", "FREIDA URL", "Program Director", "Visa Sponsorship", "Salary PGY1"]) {
    if (serialized.includes(prohibited)) throw new Error(`Student program contains prohibited field material: ${prohibited}`);
  }
}

export async function seedRightsSafeRuntime({
  databaseUrl = process.env.RISE_MIGRATION_DATABASE_URL,
  sslMode = process.env.RISE_DATABASE_SSL_MODE ?? "require",
} = {}) {
  const connectionString = requiredString(databaseUrl, "RISE_MIGRATION_DATABASE_URL");
  const indexBytes = await fs.readFile(path.join(releaseDirectory, "api-index.json"));
  const manifestBytes = await fs.readFile(path.join(releaseDirectory, "index-manifest.json"));
  const receiptBytes = await fs.readFile(path.join(releaseDirectory, "activation-receipt.json"));
  const authorizationBytes = await fs.readFile(path.join(releaseDirectory, "hrsa-source-authorization.json"));
  const index = JSON.parse(indexBytes);
  const manifest = JSON.parse(manifestBytes);
  const receipt = JSON.parse(receiptBytes);
  const authorization = JSON.parse(authorizationBytes);
  const indexSha256 = sha256(indexBytes);
  const manifestSha256 = sha256(manifestBytes);
  const authorizationSha256 = sha256(authorizationBytes);
  if (
    indexSha256 !== manifest.apiIndexSha256 ||
    receipt.apiIndexSha256 !== indexSha256 ||
    receipt.indexManifestSha256 !== manifestSha256 ||
    receipt.registryReleaseId !== index.registryReleaseId ||
    index.releaseProjection !== "STUDENT_RIGHTS_SAFE_RISE" ||
    index.programs.length !== 26 ||
    index.source.legacyFieldsExcluded !== 196 ||
    index.releaseGate.sourceRights[0].sha256 !== authorizationSha256
  ) throw new Error("Rights-safe release artifacts do not form one immutable activation set");
  index.programs.forEach(assertStudentSafeProgram);

  const client = new Client({
    connectionString,
    application_name: "missionmed-rise-migration",
    statement_timeout: 15_000,
    ssl: sslMode === "require" ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE rise_runtime.registry_releases SET active = false WHERE active = true AND release_id <> $1", [index.registryReleaseId]);
    await client.query(`
      INSERT INTO rise_runtime.registry_releases (
        release_id, projection, api_index_sha256, index_manifest_sha256,
        program_count, rights_blocked_field_count, active
      ) VALUES ($1, 'STUDENT_RIGHTS_SAFE_RISE', $2, $3, $4, $5, true)
      ON CONFLICT (release_id) DO UPDATE SET active = true
    `, [index.registryReleaseId, indexSha256, manifestSha256, index.programs.length, index.source.legacyFieldsExcluded]);
    await client.query(`
      INSERT INTO rise_runtime.source_authorizations (
        release_id, source, authorization_sha256, rights_evidence_sha256,
        authorization_basis, decision_record_id, valid_through
      ) VALUES ($1, $2, $3, $4, 'government_public_domain_factual_projection', $5, $6)
      ON CONFLICT (release_id, source) DO NOTHING
    `, [
      index.registryReleaseId,
      index.releaseGate.sourceRights[0].source,
      authorizationSha256,
      authorization.sourceOwnerGrantSha256,
      authorization.missionMedReview.decisionRecordId,
      authorization.validThrough.slice(0, 10),
    ]);
    for (const program of index.programs) {
      await client.query(`
        INSERT INTO rise_runtime.registry_programs (release_id, program_specialty_id, public_record)
        VALUES ($1, $2, $3::jsonb)
        ON CONFLICT (release_id, program_specialty_id) DO NOTHING
      `, [index.registryReleaseId, program.programSpecialtyId, JSON.stringify(program)]);
    }
    const readback = await client.query(`
      SELECT r.release_id, r.program_count, r.rights_blocked_field_count,
             count(p.program_specialty_id)::int AS stored_program_count,
             count(*) FILTER (WHERE p.public_record ? 'fields' AND p.public_record->'fields' <> '{}'::jsonb)::int AS deep_field_leaks
      FROM rise_runtime.registry_releases r
      JOIN rise_runtime.registry_programs p ON p.release_id = r.release_id
      WHERE r.release_id = $1 AND r.active = true
      GROUP BY r.release_id, r.program_count, r.rights_blocked_field_count
    `, [index.registryReleaseId]);
    const row = readback.rows[0];
    if (!row || row.stored_program_count !== 26 || row.deep_field_leaks !== 0 || row.rights_blocked_field_count !== 196) {
      throw new Error("Provider readback failed the rights-safe release invariant");
    }
    await client.query("COMMIT");
    return { ...row, apiIndexSha256: indexSha256, indexManifestSha256: manifestSha256 };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  seedRightsSafeRuntime().then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }).catch((error) => {
    process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
    process.exitCode = 1;
  });
}
