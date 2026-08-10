import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const decisionPath = args.find((arg) => !arg.startsWith("--"));
const atIndex = args.indexOf("--at");
const evaluatedAt = atIndex >= 0 ? new Date(args[atIndex + 1]) : new Date();

if (!decisionPath || Number.isNaN(evaluatedAt.getTime())) {
  throw new Error("Usage: node validate_privacy_collection_decision.mjs <decision.json> [--at <ISO-8601>]");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const raw = await readFile(resolve(decisionPath));
const decision = JSON.parse(raw);
const exactKeys = [
  "schemaVersion",
  "decisionId",
  "dataClass",
  "decision",
  "controller",
  "approvedBy",
  "approvedAt",
  "purpose",
  "allowedFields",
  "prohibitedFields",
  "accessRoles",
  "retentionDays",
  "deletionProcedure",
  "purposeExpiresAt",
  "auditLogLocation",
  "studentDisplayAllowed",
  "sensitiveInferenceAllowed",
].sort();
assert(JSON.stringify(Object.keys(decision).sort()) === JSON.stringify(exactKeys), "Privacy decision fields do not match the contract");
assert(decision.schemaVersion === "rise.privacy.collection.decision.v1", "Schema version mismatch");
assert(/^rise_priv_[a-z0-9._-]+$/.test(decision.decisionId), "Decision ID is invalid");
assert(decision.dataClass === "PUBLIC_RESIDENT_ROSTER", "Data class mismatch");
assert(decision.decision === "APPROVED", "Privacy decision does not authorize collection");
assert(typeof decision.controller === "string" && decision.controller.trim(), "Named controller is required");
assert(typeof decision.approvedBy === "string" && decision.approvedBy.trim(), "Named approver is required");
assert(decision.purpose === "RESIDENCY_PROGRAM_ROSTER_RESEARCH", "Purpose is not allowed");

const approvedAt = new Date(decision.approvedAt);
const purposeExpiresAt = new Date(decision.purposeExpiresAt);
assert(!Number.isNaN(approvedAt.getTime()) && approvedAt <= evaluatedAt, "approvedAt is invalid");
assert(!Number.isNaN(purposeExpiresAt.getTime()) && purposeExpiresAt > evaluatedAt, "Privacy decision is expired");
assert(Number.isInteger(decision.retentionDays) && decision.retentionDays >= 1 && decision.retentionDays <= 90, "retentionDays must be 1-90");
assert(purposeExpiresAt - approvedAt <= decision.retentionDays * 24 * 60 * 60 * 1000, "Purpose expiry exceeds approved retention");

const allowedFieldSet = new Set([
  "public_display_name",
  "training_year",
  "official_role",
  "medical_school",
  "medical_degree",
  "official_profile_url",
]);
assert(Array.isArray(decision.allowedFields) && decision.allowedFields.length > 0, "allowedFields is required");
assert(new Set(decision.allowedFields).size === decision.allowedFields.length, "allowedFields contains duplicates");
for (const field of decision.allowedFields) {
  assert(allowedFieldSet.has(field), `Prohibited or unknown allowed field: ${field}`);
}

const requiredProhibitedFields = [
  "personal_email",
  "personal_phone",
  "home_address",
  "photo",
  "biography_text",
  "date_of_birth",
  "race",
  "ethnicity",
  "nationality",
  "citizenship",
  "visa_status",
  "religion",
  "disability",
  "sexual_orientation",
  "gender_identity",
  "family_status",
];
assert(JSON.stringify(decision.prohibitedFields) === JSON.stringify(requiredProhibitedFields), "prohibitedFields must equal the immutable sensitive-field blocklist");
assert(!decision.allowedFields.some((field) => requiredProhibitedFields.includes(field)), "Allowed and prohibited fields overlap");

const accessRoleSet = new Set(["RISE_RESEARCHER", "RISE_PRIVACY_REVIEWER"]);
assert(Array.isArray(decision.accessRoles) && decision.accessRoles.length > 0, "accessRoles is required");
assert(decision.accessRoles.every((role) => accessRoleSet.has(role)), "Unknown access role");
assert(typeof decision.deletionProcedure === "string" && decision.deletionProcedure.trim(), "Deletion procedure is required");
assert(typeof decision.auditLogLocation === "string" && decision.auditLogLocation.trim(), "Audit log location is required");
assert(decision.studentDisplayAllowed === false, "Student display must remain disabled");
assert(decision.sensitiveInferenceAllowed === false, "Sensitive inference must remain disabled");

console.log(JSON.stringify({
  result: "PASS",
  decisionId: decision.decisionId,
  decisionSha256: sha256(raw),
  evaluatedAt: evaluatedAt.toISOString(),
  purposeExpiresAt: purposeExpiresAt.toISOString(),
  retentionDays: decision.retentionDays,
  collectionAuthorized: true,
}, null, 2));
