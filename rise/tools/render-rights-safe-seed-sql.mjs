#!/usr/bin/env node
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const releaseDirectory = path.resolve(process.env.RISE_RELEASE_DIRECTORY ?? path.resolve(here, "../releases/student-rights-safe"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;

const indexBytes = await fs.readFile(path.join(releaseDirectory, "api-index.json"));
const manifestBytes = await fs.readFile(path.join(releaseDirectory, "index-manifest.json"));
const receiptBytes = await fs.readFile(path.join(releaseDirectory, "activation-receipt.json"));
const index = JSON.parse(indexBytes);
const manifest = JSON.parse(manifestBytes);
const receipt = JSON.parse(receiptBytes);
const indexSha256 = sha256(indexBytes);
const manifestSha256 = sha256(manifestBytes);
const authorizationFiles = {
  "HRSA THCGME": "hrsa-source-authorization.json",
  "SOAP 2026": "soap-source-authorization.json",
};
const authorizations = new Map();
for (const right of index.releaseGate?.sourceRights ?? []) {
  const filename = authorizationFiles[right.source];
  if (!filename) throw new Error(`No release authorization artifact is mapped for ${right.source}`);
  const bytes = await fs.readFile(path.join(releaseDirectory, filename));
  const authorization = JSON.parse(bytes);
  const authorizationSha256 = sha256(bytes);
  if (right.sha256 !== authorizationSha256) throw new Error(`${right.source} authorization hash drifted`);
  authorizations.set(right.source, { authorization, authorizationSha256 });
}

if (
  index.programs.length !== manifest.programCount || index.source.legacyFieldsExcluded !== 196 ||
  manifest.apiIndexSha256 !== indexSha256 ||
  receipt.apiIndexSha256 !== indexSha256 || receipt.indexManifestSha256 !== manifestSha256 ||
  receipt.registryReleaseId !== index.registryReleaseId ||
  !receipt.approvedAt || String(receipt.decisionRecordId).startsWith("PENDING-") ||
  authorizations.size !== index.releaseGate.sourceRights.length
) throw new Error("Rights-safe release invariant failed before SQL rendering");

for (const program of index.programs) {
  const soap = program.soap2026?.appeared === true;
  const fields = Object.keys(program.fields ?? {});
  const allowedNamespaces = soap ? new Set(["MISSIONMED_RISE_ID", "ACGME_PROGRAM"]) : new Set(["MISSIONMED_RISE_ID"]);
  if ((soap ? fields.some((field) => field !== "SOAP 2026 Appearance") : fields.length) ||
      program.identifiers?.some((item) => !allowedNamespaces.has(item.namespace))) {
    throw new Error(`Restricted program material cannot be rendered: ${program.id}`);
  }
}

const statements = [
  "\\set ON_ERROR_STOP on",
  "BEGIN;",
  `UPDATE rise_runtime.registry_releases SET active = false WHERE active = true AND release_id <> ${literal(index.registryReleaseId)};`,
  `INSERT INTO rise_runtime.registry_releases (release_id, projection, api_index_sha256, index_manifest_sha256, program_count, rights_blocked_field_count, active) VALUES (${literal(index.registryReleaseId)}, 'STUDENT_RIGHTS_SAFE_RISE', ${literal(indexSha256)}, ${literal(manifestSha256)}, ${index.programs.length}, 196, true) ON CONFLICT (release_id) DO UPDATE SET active = true;`,
];
for (const right of index.releaseGate.sourceRights) {
  const { authorization, authorizationSha256 } = authorizations.get(right.source);
  const basis = right.source === "SOAP 2026" ? "bounded_historical_cycle_projection" : "government_public_domain_factual_projection";
  if (right.source === "HRSA THCGME") {
    statements.push(`INSERT INTO rise_runtime.source_authorizations (release_id, source, authorization_sha256, rights_evidence_sha256, authorization_basis, decision_record_id, valid_through) VALUES (${literal(index.registryReleaseId)}, ${literal(right.source)}, ${literal(authorizationSha256)}, ${literal(authorization.sourceOwnerGrantSha256)}, 'government_public_domain_factual_projection', ${literal(authorization.missionMedReview.decisionRecordId)}, ${literal(authorization.validThrough.slice(0, 10))}::date) ON CONFLICT (release_id, source) DO NOTHING;`);
  }
  if (index.releaseGate.sourceRights.length > 1) {
    statements.push(`INSERT INTO rise_runtime.release_source_rights (release_id, source, authorization_sha256, rights_evidence_sha256, authorization_basis, decision_record_id, valid_through) VALUES (${literal(index.registryReleaseId)}, ${literal(right.source)}, ${literal(authorizationSha256)}, ${literal(authorization.sourceOwnerGrantSha256)}, ${literal(basis)}, ${literal(authorization.missionMedReview.decisionRecordId)}, ${literal(authorization.validThrough.slice(0, 10))}::date) ON CONFLICT (release_id, source) DO NOTHING;`);
  }
}
for (const program of index.programs) {
  statements.push(`INSERT INTO rise_runtime.registry_programs (release_id, program_specialty_id, public_record) VALUES (${literal(index.registryReleaseId)}, ${literal(program.programSpecialtyId)}, ${literal(JSON.stringify(program))}::jsonb) ON CONFLICT (release_id, program_specialty_id) DO NOTHING;`);
}
statements.push(`DO $verify$ DECLARE v_programs integer; v_leaks integer; BEGIN SELECT count(*)::integer, count(*) FILTER (WHERE public_record->'fields' <> '{}'::jsonb AND NOT (public_record ? 'soap2026' AND public_record->'fields' ? 'SOAP 2026 Appearance'))::integer INTO v_programs, v_leaks FROM rise_runtime.registry_programs WHERE release_id = ${literal(index.registryReleaseId)}; IF v_programs <> ${index.programs.length} OR v_leaks <> 0 THEN RAISE EXCEPTION 'rights-safe seed readback failed'; END IF; END $verify$;`);
statements.push("COMMIT;");
process.stdout.write(`${statements.join("\n")}\n`);
