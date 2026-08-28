#!/usr/bin/env node
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const releaseDirectory = path.resolve(here, "../releases/student-rights-safe");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;

const indexBytes = await fs.readFile(path.join(releaseDirectory, "api-index.json"));
const manifestBytes = await fs.readFile(path.join(releaseDirectory, "index-manifest.json"));
const authorizationBytes = await fs.readFile(path.join(releaseDirectory, "hrsa-source-authorization.json"));
const index = JSON.parse(indexBytes);
const manifest = JSON.parse(manifestBytes);
const authorization = JSON.parse(authorizationBytes);
const indexSha256 = sha256(indexBytes);
const manifestSha256 = sha256(manifestBytes);
const authorizationSha256 = sha256(authorizationBytes);

if (
  index.programs.length !== 26 || index.source.legacyFieldsExcluded !== 196 ||
  manifest.apiIndexSha256 !== indexSha256 ||
  index.releaseGate.sourceRights[0].sha256 !== authorizationSha256
) throw new Error("Rights-safe release invariant failed before SQL rendering");

for (const program of index.programs) {
  if (Object.keys(program.fields ?? {}).length || program.identifiers?.some((item) => item.namespace !== "MISSIONMED_RISE_ID")) {
    throw new Error(`Restricted program material cannot be rendered: ${program.id}`);
  }
}

const statements = [
  "\\set ON_ERROR_STOP on",
  "BEGIN;",
  `UPDATE rise_runtime.registry_releases SET active = false WHERE active = true AND release_id <> ${literal(index.registryReleaseId)};`,
  `INSERT INTO rise_runtime.registry_releases (release_id, projection, api_index_sha256, index_manifest_sha256, program_count, rights_blocked_field_count, active) VALUES (${literal(index.registryReleaseId)}, 'STUDENT_RIGHTS_SAFE_RISE', ${literal(indexSha256)}, ${literal(manifestSha256)}, 26, 196, true) ON CONFLICT (release_id) DO UPDATE SET active = true;`,
  `INSERT INTO rise_runtime.source_authorizations (release_id, source, authorization_sha256, rights_evidence_sha256, authorization_basis, decision_record_id, valid_through) VALUES (${literal(index.registryReleaseId)}, ${literal(index.releaseGate.sourceRights[0].source)}, ${literal(authorizationSha256)}, ${literal(authorization.sourceOwnerGrantSha256)}, 'government_public_domain_factual_projection', ${literal(authorization.missionMedReview.decisionRecordId)}, ${literal(authorization.validThrough.slice(0, 10))}::date) ON CONFLICT (release_id, source) DO NOTHING;`,
];
for (const program of index.programs) {
  statements.push(`INSERT INTO rise_runtime.registry_programs (release_id, program_specialty_id, public_record) VALUES (${literal(index.registryReleaseId)}, ${literal(program.programSpecialtyId)}, ${literal(JSON.stringify(program))}::jsonb) ON CONFLICT (release_id, program_specialty_id) DO NOTHING;`);
}
statements.push(`DO $verify$ DECLARE v_programs integer; v_leaks integer; BEGIN SELECT count(*)::integer, count(*) FILTER (WHERE public_record->'fields' <> '{}'::jsonb)::integer INTO v_programs, v_leaks FROM rise_runtime.registry_programs WHERE release_id = ${literal(index.registryReleaseId)}; IF v_programs <> 26 OR v_leaks <> 0 THEN RAISE EXCEPTION 'rights-safe seed readback failed'; END IF; END $verify$;`);
statements.push("COMMIT;");
process.stdout.write(`${statements.join("\n")}\n`);
