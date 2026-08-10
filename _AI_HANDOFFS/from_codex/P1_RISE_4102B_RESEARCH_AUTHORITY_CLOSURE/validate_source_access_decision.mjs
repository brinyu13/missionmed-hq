import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const decisionPath = args.find((arg) => !arg.startsWith("--"));
const atIndex = args.indexOf("--at");
const evaluatedAt = atIndex >= 0 ? new Date(args[atIndex + 1]) : new Date();

if (!decisionPath || Number.isNaN(evaluatedAt.getTime())) {
  throw new Error("Usage: node validate_source_access_decision.mjs <decision.json> [--at <ISO-8601>]");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hostMatchesDomain(urlValue, domain, label) {
  assert(typeof urlValue === "string", `${label} is required for an allowing decision`);
  const hostname = new URL(urlValue).hostname.toLowerCase();
  assert(hostname === domain || hostname.endsWith(`.${domain}`), `${label} host ${hostname} is outside reviewed domain ${domain}`);
}

const raw = await readFile(resolve(decisionPath));
const decision = JSON.parse(raw);
const allowedKeys = new Set([
  "schemaVersion",
  "decisionId",
  "domain",
  "sourceType",
  "reviewedAt",
  "reviewedBy",
  "termsUrl",
  "termsStatus",
  "robotsUrl",
  "robotsStatus",
  "accessControlsStatus",
  "researchDecision",
  "storageDecision",
  "derivationDecision",
  "automationDecision",
  "collectionMode",
  "requestsPerMinute",
  "maxConcurrency",
  "respectRetryAfter",
  "decisionAuthority",
  "allowedPaths",
  "prohibitedActions",
  "evidence",
  "privacyDecisionId",
  "expiresAt",
]);
for (const key of Object.keys(decision)) {
  assert(allowedKeys.has(key), `Unexpected decision property: ${key}`);
}
for (const key of allowedKeys) {
  if (key === "privacyDecisionId") continue;
  assert(Object.hasOwn(decision, key), `Missing decision property: ${key}`);
}

assert(decision.schemaVersion === "rise.source.access.decision.v1", "Schema version mismatch");
assert(/^rise_sad_[a-z0-9._-]+$/.test(decision.decisionId), "Decision ID is invalid");
assert(/^[a-z0-9.-]+$/.test(decision.domain), "Domain is invalid");
assert(decision.domain === decision.domain.toLowerCase(), "Domain must be lowercase");
assert(typeof decision.reviewedBy === "string" && decision.reviewedBy.trim(), "reviewedBy is required");
assert(new Set([
  "OFFICIAL_RESIDENCY_PROGRAM_PAGE",
  "OFFICIAL_HOSPITAL_OR_INSTITUTION_PAGE",
  "OFFICIAL_FACULTY_OR_LEADERSHIP_PAGE",
  "OFFICIAL_RESIDENT_ROSTER_PAGE",
]).has(decision.sourceType), "Source type is not allowed");
assert(new Set(["ALLOW_MINIMAL_FACT_RESEARCH", "DENY", "MANUAL_REVIEW_REQUIRED"]).has(decision.researchDecision), "Research decision is invalid");
assert(new Set(["ALLOW_MINIMAL_DISCRETE_FACT_STORAGE", "DENY", "MANUAL_REVIEW_REQUIRED"]).has(decision.storageDecision), "Storage decision is invalid");
assert(new Set(["ALLOW_PROVENANCE_BOUND_DERIVATION", "DENY", "MANUAL_REVIEW_REQUIRED"]).has(decision.derivationDecision), "Derivation decision is invalid");
assert(new Set(["ALLOW_BOUNDED_AUTOMATION", "DENY", "MANUAL_REVIEW_REQUIRED"]).has(decision.automationDecision), "Automation decision is invalid");
assert(new Set(["EXPLICIT_SITE_TERMS", "NAMED_HUMAN_SOURCE_RIGHTS_APPROVAL"]).has(decision.decisionAuthority), "Decision authority is invalid");

const reviewedAt = new Date(decision.reviewedAt);
const expiresAt = new Date(decision.expiresAt);
assert(!Number.isNaN(reviewedAt.getTime()), "reviewedAt is invalid");
assert(!Number.isNaN(expiresAt.getTime()), "expiresAt is invalid");
assert(reviewedAt <= evaluatedAt, "Decision review date is in the future");
assert(expiresAt > evaluatedAt, "Source-access decision is expired");
assert(expiresAt - reviewedAt <= 90 * 24 * 60 * 60 * 1000, "Source-access decision exceeds 90-day validity");

assert(Array.isArray(decision.allowedPaths) && decision.allowedPaths.length > 0, "allowedPaths is required");
assert(decision.allowedPaths.every((path) => typeof path === "string" && path.startsWith("/")), "allowedPaths must be absolute URL paths");
assert(new Set(decision.allowedPaths).size === decision.allowedPaths.length, "allowedPaths contains duplicates");

const requiredProhibitions = [
  "RAW_HTML_ARCHIVE",
  "IMAGE_DOWNLOAD",
  "EXPRESSIVE_TEXT_COPY",
  "AUTHENTICATION_BYPASS",
  "ACCESS_CONTROL_BYPASS",
  "BULK_SITE_MIRROR",
  "STUDENT_DISPLAY",
  "RAW_REDISTRIBUTION",
];
assert(Array.isArray(decision.prohibitedActions), "prohibitedActions is required");
for (const action of requiredProhibitions) {
  assert(decision.prohibitedActions.includes(action), `Missing prohibited action: ${action}`);
}

assert(Number.isInteger(decision.requestsPerMinute) && decision.requestsPerMinute >= 1 && decision.requestsPerMinute <= 10, "requestsPerMinute must be 1-10");
assert(Number.isInteger(decision.maxConcurrency) && decision.maxConcurrency >= 1 && decision.maxConcurrency <= 2, "maxConcurrency must be 1-2");
assert(decision.respectRetryAfter === true, "Retry-After must be respected");
assert(Array.isArray(decision.evidence) && decision.evidence.length > 0, "Evidence is required");

const researchAllowed = decision.researchDecision === "ALLOW_MINIMAL_FACT_RESEARCH";
const storageAllowed = decision.storageDecision === "ALLOW_MINIMAL_DISCRETE_FACT_STORAGE";
const derivationAllowed = decision.derivationDecision === "ALLOW_PROVENANCE_BOUND_DERIVATION";
const automationAllowed = decision.automationDecision === "ALLOW_BOUNDED_AUTOMATION";
const anyAllowed = researchAllowed || storageAllowed || derivationAllowed || automationAllowed;

if (anyAllowed) {
  assert(researchAllowed, "Storage, derivation, or automation cannot be allowed when research is denied");
  assert(decision.termsStatus === "EXPLICITLY_PERMITS_REQUESTED_OPERATIONS", "Explicit terms must permit every requested operation");
  assert(decision.robotsStatus === "ALLOWS_REVIEWED_PATHS", "Robots policy must allow reviewed paths");
  assert(decision.accessControlsStatus === "PUBLIC_NO_BYPASS", "Access must be public with no bypass");
  hostMatchesDomain(decision.termsUrl, decision.domain, "termsUrl");
  hostMatchesDomain(decision.robotsUrl, decision.domain, "robotsUrl");
  for (const [index, evidence] of decision.evidence.entries()) {
    hostMatchesDomain(evidence.url, decision.domain, `evidence[${index}].url`);
    assert(typeof evidence.locator === "string" && evidence.locator.trim(), `evidence[${index}].locator is required`);
    const retrievedAt = new Date(evidence.retrievedAt);
    assert(!Number.isNaN(retrievedAt.getTime()) && retrievedAt <= evaluatedAt, `evidence[${index}].retrievedAt is invalid`);
  }
}

if (automationAllowed) {
  assert(decision.collectionMode === "BOUNDED_AUTOMATION", "Automation requires BOUNDED_AUTOMATION mode");
} else {
  assert(decision.collectionMode === "HUMAN_REVIEW_ONLY", "Non-automated decisions must use HUMAN_REVIEW_ONLY mode");
}
if (decision.sourceType === "OFFICIAL_RESIDENT_ROSTER_PAGE") {
  assert(/^rise_priv_[a-z0-9._-]+$/.test(decision.privacyDecisionId ?? ""), "Resident-roster source decision requires privacyDecisionId");
}

console.log(JSON.stringify({
  result: "PASS",
  decisionId: decision.decisionId,
  decisionSha256: sha256(raw),
  domain: decision.domain,
  evaluatedAt: evaluatedAt.toISOString(),
  expiresAt: expiresAt.toISOString(),
  permissions: {
    researchAllowed,
    storageAllowed,
    derivationAllowed,
    automationAllowed,
  },
}, null, 2));
