import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageDir = dirname(fileURLToPath(import.meta.url));
const repoDir = resolve(packageDir, "../../..");
const sourceDir = resolve(
  packageDir,
  "../P1_RISE_4102A_CANONICAL_IDENTITY_UNBLOCK",
);
const baseCommit = "e8503866bce9cb941dd8f2dc38f39e62bd21e316";
const packagePrefix = "_AI_HANDOFFS/from_codex/P1_RISE_4102B_RESEARCH_AUTHORITY_CLOSURE/";
const identityModulePath = "/Users/brianb/MissionMed_worktrees/P1-RISE-4006/rise/src/identity.mjs";
const productionIdentityModulePath = "/Users/brianb/MissionMed_worktrees/P1-RISE-4006-production/rise/src/identity.mjs";
const expectedIdentityHash = "3c880fbc4f2842b8d8561d13dca3c7d6eccba27023a09fff46dafbb142332344";
const expectedSourceReleaseHash = "85ef67906ad462e0a609dfa28c1e8479bc9fe287d8a05be0084969ea26fce3c8";
const expectedIdentityPackageManifestHash = "76ad89e258fa6a6b4f52e64e9dba071b421dcacabdfa9139b56333e6949b3865";
const preflight = process.argv.includes("--preflight");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function shaFile(path) {
  return sha256(await readFile(path));
}

async function readJson(name, dir = packageDir) {
  return JSON.parse(await readFile(resolve(dir, name), "utf8"));
}

async function readNdjson(name, dir = sourceDir) {
  return (await readFile(resolve(dir, name), "utf8"))
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function assertUnique(records, keyFn, label) {
  const owners = new Map();
  for (const record of records) {
    const key = keyFn(record);
    assert(!owners.has(key), `Duplicate ${label}: ${key}`);
    owners.set(key, record);
  }
  return owners;
}

async function verifyChecksumFile(path, rootDir) {
  const lines = (await readFile(path, "utf8")).split("\n").filter(Boolean);
  const names = [];
  for (const line of lines) {
    const match = line.match(/^([a-f0-9]{64})  (.+)$/);
    assert(match, `Malformed checksum line: ${line}`);
    const [, expected, name] = match;
    assert(await shaFile(resolve(rootDir, name)) === expected, `Checksum mismatch: ${name}`);
    names.push(name);
  }
  return names;
}

const sourceChecksumNames = await verifyChecksumFile(
  resolve(sourceDir, "SHA256SUMS"),
  sourceDir,
);
assert(sourceChecksumNames.length > 0, "Source package checksum file is empty");

const [
  programs,
  programSpecialties,
  browseMemberships,
  aliases,
  externalIdentifiers,
  quarantine,
  wave1,
] = await Promise.all([
  readNdjson("programs.ndjson"),
  readNdjson("program-specialties.ndjson"),
  readNdjson("browse-memberships.ndjson"),
  readNdjson("aliases.ndjson"),
  readNdjson("external-identifiers.ndjson"),
  readNdjson("quarantined-source-rows.ndjson"),
  readNdjson("WAVE1_RESEARCH_IDENTITY.ndjson", packageDir),
]);

assert(programs.length === 6139, "Source program count drift");
assert(programSpecialties.length === 6139, "Source program-specialty count drift");
assert(browseMemberships.length === 6345, "Source browse-membership count drift");
assert(aliases.length === 6345, "Source alias count drift");
assert(externalIdentifiers.length === 6139, "Source external-ID count drift");
assert(quarantine.length === 1, "Source quarantine count drift");

const programById = assertUnique(programs, (record) => record.id, "program ID");
const programSpecialtyById = assertUnique(
  programSpecialties,
  (record) => record.id,
  "program-specialty ID",
);
const browseById = assertUnique(
  browseMemberships,
  (record) => record.id,
  "browse-membership ID",
);
const aliasByKey = assertUnique(
  aliases,
  (record) => `${record.namespace}:${record.value}`,
  "alias key",
);
assertUnique(
  externalIdentifiers,
  (record) => `${record.namespace}:${record.value}`,
  "external identifier key",
);

const {
  browseMembershipIdentity,
  programIdentity,
  programSpecialtyIdentity,
  stableOpaqueId,
} = await import(pathToFileURL(identityModulePath).href);

assert(await shaFile(identityModulePath) === expectedIdentityHash, "Historical identity code hash mismatch");
assert(await shaFile(productionIdentityModulePath) === expectedIdentityHash, "Production identity code hash mismatch");

for (const record of externalIdentifiers) {
  assert(programById.has(record.programId), `Orphan external identifier ${record.value}`);
  assert(programIdentity(record.value).id === record.programId, `Program ID recomputation mismatch: ${record.value}`);
}
for (const record of programSpecialties) {
  assert(programById.has(record.programId), `Orphan program-specialty ${record.id}`);
  assert(
    programSpecialtyIdentity(record.programId, record.designation).id === record.id,
    `Program-specialty recomputation mismatch: ${record.id}`,
  );
}
for (const record of browseMemberships) {
  assert(programSpecialtyById.has(record.programSpecialtyId), `Orphan browse membership ${record.id}`);
  assert(
    browseMembershipIdentity(record.programSpecialtyId, record.browseSpecialty).id === record.id,
    `Browse-membership recomputation mismatch: ${record.id}`,
  );
}
for (const record of aliases) {
  assert(programById.has(record.programId), `Orphan alias ${record.value}`);
  assert(
    stableOpaqueId("rise_alias", `${record.namespace}:${record.value}:${record.sourceProjection}`) === record.id,
    `Alias recomputation mismatch: ${record.value}`,
  );
}

const mappingAllowlist = [
  "legacyAlias",
  "riseProgramId",
  "programSpecialtyId",
  "browseMembershipId",
  "browseSpecialty",
  "relationship",
  "identityReleaseId",
  "identityUse",
].sort();

assert(wave1.length === 1649, "Wave 1 mapping count must be 1,649");
assertUnique(wave1, (record) => record.legacyAlias, "Wave 1 legacy alias");
assertUnique(wave1, (record) => record.riseProgramId, "Wave 1 canonical program ID");

for (const record of wave1) {
  assert(
    JSON.stringify(Object.keys(record).sort()) === JSON.stringify(mappingAllowlist),
    `Sanitized mapping field violation: ${record.legacyAlias}`,
  );
  assert(record.identityUse === "NON_EVIDENTIARY_ROUTING_ONLY", `Identity-use violation: ${record.legacyAlias}`);
  assert(record.identityReleaseId === "rise_registry_2026-07-09_f51f0643a2d9", `Identity release mismatch: ${record.legacyAlias}`);
  assert(
    record.relationship === "EXACT_DESIGNATION" || record.relationship === "RELATED_COMBINED",
    `Unexpected Wave 1 relationship: ${record.relationship}`,
  );
  const alias = aliasByKey.get(`LEGACY_STAGING_RISE_ID:${record.legacyAlias}`);
  assert(alias, `Missing source alias: ${record.legacyAlias}`);
  assert(alias.programId === record.riseProgramId, `Alias program mismatch: ${record.legacyAlias}`);
  const programSpecialty = programSpecialtyById.get(record.programSpecialtyId);
  assert(programSpecialty, `Missing program-specialty: ${record.legacyAlias}`);
  assert(programSpecialty.programId === record.riseProgramId, `Program-specialty owner mismatch: ${record.legacyAlias}`);
  const membership = browseById.get(record.browseMembershipId);
  assert(membership, `Missing browse membership: ${record.legacyAlias}`);
  assert(membership.programSpecialtyId === record.programSpecialtyId, `Membership owner mismatch: ${record.legacyAlias}`);
  assert(membership.browseSpecialty === record.browseSpecialty, `Membership specialty mismatch: ${record.legacyAlias}`);
  assert(membership.relationship === record.relationship, `Membership relationship mismatch: ${record.legacyAlias}`);
}

const sortedWave1 = [...wave1].sort((a, b) =>
  a.riseProgramId.localeCompare(b.riseProgramId) ||
  a.legacyAlias.localeCompare(b.legacyAlias)
);
assert(JSON.stringify(wave1) === JSON.stringify(sortedWave1), "Wave 1 mapping is not deterministically sorted");
assert(wave1.filter((record) => record.browseSpecialty === "Internal Medicine").length === 828, "IM count drift");
assert(wave1.filter((record) => record.browseSpecialty === "Family Medicine").length === 821, "FM count drift");
assert(wave1.filter((record) => record.relationship === "EXACT_DESIGNATION").length === 1504, "Exact count drift");
assert(wave1.filter((record) => record.relationship === "RELATED_COMBINED").length === 145, "Combined count drift");

const sourceManifest = await readJson("P1_RISE_4006_RELEASE_MANIFEST.json", sourceDir);
const policy = await readJson("SOURCE_USE_POLICY.json");
const sourceAccessDecisionSchema = await readJson("SOURCE_ACCESS_DECISION_SCHEMA.json");
const privacyCollectionDecisionSchema = await readJson("PRIVACY_COLLECTION_DECISION_SCHEMA.json");
const manifest = await readJson("RESEARCH_AUTHORITY_MANIFEST.json");
const olathe = await readJson("WAVE1_OLATHE_DISPOSITION.json");
const machineReport = await readJson("VALIDATION_REPORT.json");

assert(await shaFile(resolve(sourceDir, "P1_RISE_4006_RELEASE_MANIFEST.json")) === expectedSourceReleaseHash, "Source release manifest hash mismatch");
assert(await shaFile(resolve(sourceDir, "MANIFEST.json")) === expectedIdentityPackageManifestHash, "4102A manifest hash mismatch");

assert(policy.defaultState === "DO_NOT_USE", "Unknown source policy must fail closed");
assert(policy.releaseWideRules.productionMutationAllowed === false, "Production mutation must remain false");
assert(policy.releaseWideRules.studentDisplayAuthorized === false, "Student display must remain false");
assert(policy.releaseWideRules.rawPageArchiveAllowed === false, "Raw-page archive must remain false");
assert(policy.releaseWideRules.sourceAccessDecisionRequiredForConditionalPublicSources === true, "Per-domain source decisions must be required");
assert(policy.releaseWideRules.residentRosterPrecollectionPrivacyApprovalRequired === true, "Roster privacy approval must be required");
assert(policy.releaseWideRules.operationSpecificSourcePermissionsRequired === true, "Operation-specific source permissions must be required");
assert(policy.releaseWideRules.expiredSourceDecisionsAllowed === false, "Expired source decisions must remain prohibited");

const sourceClass = new Map(policy.sourceClasses.map((record) => [record.source_type, record]));
const requiredPolicyFields = [
  "source_type",
  "owner",
  "access_class",
  "state",
  "research_allowed",
  "internal_storage_allowed",
  "student_display_allowed",
  "raw_redistribution_allowed",
  "derived_data_allowed",
  "reverification_required",
  "citation_required",
  "conditions",
  "authority",
  "notes",
];
for (const record of policy.sourceClasses) {
  for (const field of requiredPolicyFields) {
    assert(Object.hasOwn(record, field), `Source policy field missing: ${record.source_type}.${field}`);
  }
  for (const field of [
    "research_allowed",
    "internal_storage_allowed",
    "student_display_allowed",
    "raw_redistribution_allowed",
    "derived_data_allowed",
    "reverification_required",
    "citation_required",
  ]) {
    assert(typeof record[field] === "boolean", `Source policy permission is not boolean: ${record.source_type}.${field}`);
  }
  assert(record.student_display_allowed === false, `Source class silently authorizes student display: ${record.source_type}`);
  assert(record.raw_redistribution_allowed === false, `Source class silently authorizes raw redistribution: ${record.source_type}`);
}
const freida = sourceClass.get("INHERITED_FREIDA_PAYLOAD");
const residencyExplorer = sourceClass.get("RESIDENCY_EXPLORER");
assert(freida?.research_allowed === false, "FREIDA factual research must remain disabled");
assert(freida?.student_display_allowed === false, "FREIDA display must remain disabled");
assert(freida?.raw_redistribution_allowed === false, "FREIDA redistribution must remain disabled");
assert(freida?.derived_data_allowed === false, "FREIDA derived-data use must remain disabled");
assert(freida?.discovery_hint_allowed === false, "FREIDA discovery hints must remain disabled");
assert(residencyExplorer?.research_allowed === false, "Residency Explorer must remain disabled");
assert(residencyExplorer?.internal_storage_allowed === false, "Residency Explorer storage must remain disabled");
assert(residencyExplorer?.student_display_allowed === false, "Residency Explorer display must remain disabled");
assert(residencyExplorer?.derived_data_allowed === false, "Residency Explorer derived-data use must remain disabled");

for (const type of ["OFFICIAL_RESIDENCY_PROGRAM_PAGE", "OFFICIAL_HOSPITAL_OR_INSTITUTION_PAGE"]) {
  const record = sourceClass.get(type);
  assert(record?.research_allowed === false, `${type} must default deny before a domain decision`);
  assert(record?.conditional_research_allowed === true, `${type} conditional lane must be enabled`);
  assert(record?.internal_storage_allowed === false, `${type} storage must default deny`);
  assert(record?.conditional_internal_storage_allowed === true, `${type} conditional storage lane must be explicit`);
  assert(record?.derived_data_allowed === false, `${type} derived data must default deny`);
  assert(record?.conditional_derived_data_allowed === true, `${type} conditional derived-data lane must be explicit`);
  assert(record?.student_display_allowed === false, `${type} display must be disabled`);
  assert(record?.raw_redistribution_allowed === false, `${type} raw redistribution must be disabled`);
  assert(record?.citation_required === true, `${type} citation must be required`);
  assert(record?.conditions?.length > 0, `${type} must be conditional`);
  assert(record.conditions.some((condition) => condition.includes("SOURCE_ACCESS_DECISION")), `${type} does not require the machine decision contract`);
}

const roster = sourceClass.get("OFFICIAL_RESIDENT_ROSTER_PAGE");
const faculty = sourceClass.get("OFFICIAL_FACULTY_OR_LEADERSHIP_PAGE");
assert(faculty?.research_allowed === false, "Faculty research must default deny");
assert(faculty?.internal_storage_allowed === false, "Faculty storage must default deny");
assert(faculty?.derived_data_allowed === false, "Faculty derivation must default deny");
assert(faculty?.conditions?.some((condition) => condition.includes("SOURCE_ACCESS_DECISION")), "Faculty source-access decision is missing");
assert(roster?.research_allowed === false, "Resident-roster research must default deny");
assert(roster?.internal_storage_allowed === false, "Resident-roster storage must default deny");
assert(roster?.derived_data_allowed === false, "Resident-roster derivation must default deny");
assert(roster?.state === "PRIVACY_APPROVAL_REQUIRED", "Resident-roster privacy gate is missing");
assert(roster?.conditions?.some((condition) => condition.includes("named MissionMed data controller")), "Resident-roster controller requirement is missing");
assert(roster?.conditions?.some((condition) => condition.includes("SOURCE_ACCESS_DECISION")), "Resident-roster source-access decision is missing");

for (const type of [
  "AAMC_GENERAL_PUBLIC_MATERIAL",
  "ACGME_PUBLIC_SITE_OR_REPORT",
  "NRMP_PUBLIC_REPORT_OR_DATA",
  "ABFM_REPORT_OR_DATA",
  "ABIM_REPORT_OR_DATA",
]) {
  const record = sourceClass.get(type);
  assert(record?.research_allowed === false, `${type} must not be blanket-authorized`);
  assert(record?.manual_reference_allowed === true, `${type} manual-reference lane must be explicit`);
}

assert(sourceAccessDecisionSchema.$id === "https://missionmedinstitute.com/schemas/rise/source-access-decision.v1.json", "Source-access schema ID mismatch");
assert(sourceAccessDecisionSchema.additionalProperties === false, "Source-access decisions must reject extra properties");
assert(sourceAccessDecisionSchema.required.includes("researchDecision"), "Source-access decision is missing researchDecision");
for (const field of [
  "storageDecision",
  "derivationDecision",
  "automationDecision",
  "collectionMode",
  "requestsPerMinute",
  "maxConcurrency",
  "respectRetryAfter",
]) {
  assert(sourceAccessDecisionSchema.required.includes(field), `Source-access decision is missing ${field}`);
}
assert(sourceAccessDecisionSchema.required.includes("expiresAt"), "Source-access decision is missing expiry");
const researchAllowRule = sourceAccessDecisionSchema.allOf.find((rule) => rule.if?.properties?.researchDecision?.const === "ALLOW_MINIMAL_FACT_RESEARCH");
const rosterRule = sourceAccessDecisionSchema.allOf.find((rule) => rule.if?.properties?.sourceType?.const === "OFFICIAL_RESIDENT_ROSTER_PAGE");
assert(researchAllowRule?.then?.properties?.termsStatus?.const === "EXPLICITLY_PERMITS_REQUESTED_OPERATIONS", "Source-access ALLOW does not require explicit permitting terms");
assert(researchAllowRule?.then?.properties?.robotsStatus?.const === "ALLOWS_REVIEWED_PATHS", "Source-access ALLOW does not require allowed robots paths");
assert(researchAllowRule?.then?.properties?.accessControlsStatus?.const === "PUBLIC_NO_BYPASS", "Source-access ALLOW does not require public no-bypass access");
assert(rosterRule?.then?.required?.includes("privacyDecisionId"), "Roster source-access decision does not require a privacy decision");
assert(privacyCollectionDecisionSchema.$id === "https://missionmedinstitute.com/schemas/rise/privacy-collection-decision.v1.json", "Privacy-decision schema ID mismatch");
for (const field of [
  "controller",
  "approvedBy",
  "purpose",
  "accessRoles",
  "retentionDays",
  "deletionProcedure",
  "purposeExpiresAt",
  "auditLogLocation",
]) {
  assert(privacyCollectionDecisionSchema.required.includes(field), `Privacy schema is missing ${field}`);
}
assert(privacyCollectionDecisionSchema.properties.studentDisplayAllowed.const === false, "Privacy schema permits student display");
assert(privacyCollectionDecisionSchema.properties.sensitiveInferenceAllowed.const === false, "Privacy schema permits sensitive inference");
assert(privacyCollectionDecisionSchema.properties.retentionDays.maximum === 90, "Privacy schema retention exceeds 90 days");
const privacyAllowedFields = privacyCollectionDecisionSchema.properties.allowedFields.items.enum;
const privacyProhibitedFields = privacyCollectionDecisionSchema.properties.prohibitedFields.const;
assert(Array.isArray(privacyAllowedFields) && privacyAllowedFields.length === 6, "Privacy allowed-field enum mismatch");
assert(Array.isArray(privacyProhibitedFields) && privacyProhibitedFields.length === 16, "Privacy prohibited-field blocklist mismatch");
assert(!privacyAllowedFields.some((field) => privacyProhibitedFields.includes(field)), "Privacy allowed/prohibited fields overlap");

assert(manifest.result === "RESEARCH_AUTHORITY_UNBLOCKED", "Manifest result mismatch");
assert(manifest.scope === "W1-IMFM-001_OFFLINE_RESEARCH_ONLY", "Manifest scope mismatch");
assert(manifest.resumeAuthorized === true, "Resume must be authorized");
assert(manifest.productionAuthorized === false, "Production must not be authorized");
assert(manifest.studentDisplayAuthorized === false, "Student display must not be authorized");
assert(manifest.restrictedSourceRightsApproved === false, "Restricted source rights must not be approved");
assert(manifest.publicFirstPartyResearchLaneAuthorized === true, "Public first-party lane must be authorized");
assert(manifest.maximumRecordState === "PUBLICATION_CANDIDATE_REQUIRES_HUMAN_REVIEW", "Maximum record state mismatch");
assert(manifest.activationStatus === "ACTIVE_ON_SATISFIED_CUSTODY_AND_VALIDATION_CONDITIONS", "Activation status mismatch");
assert(manifest.activationConditions.length === 4, "Activation conditions are incomplete");
assert(manifest.acceptance.acceptedBy === "Brian", "Named Founder acceptance is missing");
assert(manifest.acceptance.acceptedRole === "Founder", "Founder acceptance role mismatch");
assert(manifest.acceptance.acceptanceMode === "PROSPECTIVE_CONDITIONAL_FOUNDER_DIRECTIVE", "Acceptance mode mismatch");
assert(manifest.acceptance.exactBytesPreinspectedByFounder === false, "Manifest fabricates exact-byte Founder inspection");
assert(manifest.canonicalIdentity.identityImplementationSha256 === expectedIdentityHash, "Manifest identity hash mismatch");
assert(manifest.canonicalIdentity.identityPackageManifestSha256 === expectedIdentityPackageManifestHash, "Manifest 4102A hash mismatch");
assert(manifest.canonicalIdentity.sourceReleaseManifestSha256 === expectedSourceReleaseHash, "Manifest source release hash mismatch");
assert(manifest.wave1.memberships === 1649, "Manifest Wave 1 count mismatch");
assert(manifest.wave1.exactDesignationPrograms === 1504, "Manifest exact count mismatch");
assert(manifest.wave1.relatedCombinedMemberships === 145, "Manifest combined count mismatch");
assert(manifest.wave1.uniqueCanonicalProgramIds === 1649, "Manifest unique ID count mismatch");
assert(manifest.validation.productionMutationPerformed === false, "Manifest claims production mutation");

const sourcePolicyHash = await shaFile(resolve(packageDir, "SOURCE_USE_POLICY.json"));
const sourceAccessDecisionSchemaHash = await shaFile(resolve(packageDir, "SOURCE_ACCESS_DECISION_SCHEMA.json"));
const privacyCollectionDecisionSchemaHash = await shaFile(resolve(packageDir, "PRIVACY_COLLECTION_DECISION_SCHEMA.json"));
const sourceAccessDecisionValidatorHash = await shaFile(resolve(packageDir, "validate_source_access_decision.mjs"));
const privacyCollectionDecisionValidatorHash = await shaFile(resolve(packageDir, "validate_privacy_collection_decision.mjs"));
for (const script of [
  "validate_source_access_decision.mjs",
  "validate_privacy_collection_decision.mjs",
]) {
  execFileSync(process.execPath, ["--check", resolve(packageDir, script)], {
    stdio: "ignore",
  });
}
const wave1Hash = await shaFile(resolve(packageDir, "WAVE1_RESEARCH_IDENTITY.ndjson"));
const olatheHash = await shaFile(resolve(packageDir, "WAVE1_OLATHE_DISPOSITION.json"));
const sourceReleaseHash = await shaFile(resolve(sourceDir, "P1_RISE_4006_RELEASE_MANIFEST.json"));
const releaseSeed = JSON.stringify({
  ticket: "P1-RISE-4102B",
  releaseDate: "2026-08-10",
  sourceReleaseId: sourceManifest.releaseId,
  sourceReleaseHash,
  sourcePolicyHash,
  sourceAccessDecisionSchemaHash,
  privacyCollectionDecisionSchemaHash,
  sourceAccessDecisionValidatorHash,
  privacyCollectionDecisionValidatorHash,
  wave1Hash,
  olatheHash,
});
const expectedReleaseId = `rise_research_authority_2026-08-10_${sha256(releaseSeed).slice(0, 12)}`;
assert(manifest.releaseId === expectedReleaseId, "Research release ID mismatch");
assert(manifest.sourceAuthority.policySha256 === sourcePolicyHash, "Source-policy hash mismatch");
assert(manifest.sourceAuthority.sourceAccessDecisionSchemaSha256 === sourceAccessDecisionSchemaHash, "Source-access schema hash mismatch");
assert(manifest.sourceAuthority.privacyCollectionDecisionSchemaSha256 === privacyCollectionDecisionSchemaHash, "Privacy schema hash mismatch");
assert(manifest.sourceAuthority.sourceAccessDecisionValidatorSha256 === sourceAccessDecisionValidatorHash, "Source-access validator hash mismatch");
assert(manifest.sourceAuthority.privacyCollectionDecisionValidatorSha256 === privacyCollectionDecisionValidatorHash, "Privacy validator hash mismatch");
assert(manifest.sourceAuthority.unconditionalPublicDomainAuthorization === false, "Manifest blanket-authorizes public domains");
assert(manifest.sourceAuthority.publicFirstPartyResearchAuthorized === false, "Manifest unconditionally authorizes public first-party research");
assert(manifest.sourceAuthority.conditionalPublicFirstPartyResearchAuthorized === true, "Manifest omits the conditional public first-party lane");
assert(manifest.sourceAuthority.domainAccessDecisionRequired === true, "Manifest omits domain-access decisions");
assert(manifest.sourceAuthority.residentRosterPrecollectionPrivacyApprovalRequired === true, "Manifest omits roster privacy approval");
assert(manifest.wave1.sanitizedIdentitySha256 === wave1Hash, "Wave 1 hash mismatch");
assert(manifest.olathe.dispositionSha256 === olatheHash, "Olathe hash mismatch");

assert(olathe.canonicalRiseProgramId === "rise_prg_31141a27-b249-5eae-8259-dd3fe679c4f2", "Olathe canonical ID mismatch");
assert(olathe.retainedAlias === "RISE-IM-0683", "Olathe retained alias mismatch");
assert(olathe.quarantinedAlias === "RISE-IM-0682", "Olathe quarantined alias mismatch");
assert(olathe.sourcePayloadPolicy.retainedFreidaObservationMayPopulateFacts === false, "Olathe retained payload was activated");
assert(olathe.sourcePayloadPolicy.quarantinedFreidaObservationMayPopulateFacts === false, "Olathe quarantined payload was activated");
assert(wave1.some((record) => record.legacyAlias === "RISE-IM-0683" && record.riseProgramId === olathe.canonicalRiseProgramId), "Olathe retained alias missing from active mapping");
assert(!wave1.some((record) => record.legacyAlias === "RISE-IM-0682"), "Olathe quarantined alias is active");
assert(quarantine[0].legacyRiseId === "RISE-IM-0682", "Olathe quarantine evidence mismatch");
assert(await shaFile(resolve(sourceDir, "quarantined-source-rows.ndjson")) === "cefb46a8648a41968b079c1fd284582d2f3652c0e04d4f6a8d634a24087e437f", "Historical quarantine hash mismatch");

assert(machineReport.result === "ARTIFACT_PASS_CUSTODY_REQUIRES_POST_PUSH_VALIDATION", "Machine validation report result mismatch");
assert(machineReport.releaseId === manifest.releaseId, "Machine validation report release mismatch");
assert(machineReport.gates.restrictedSourceRightsApproved === false, "Machine report approves restricted rights");
assert(machineReport.gates.productionMutationPerformed === false, "Machine report claims production mutation");

const checksumNames = await verifyChecksumFile(resolve(packageDir, "SHA256SUMS"), packageDir);
const packageFiles = (await readdir(packageDir))
  .filter((name) => name !== "SHA256SUMS")
  .sort();
assert(JSON.stringify(checksumNames.sort()) === JSON.stringify(packageFiles), "SHA256SUMS does not cover every package file exactly once");

const currentBranch = execFileSync("git", ["branch", "--show-current"], {
  cwd: repoDir,
  encoding: "utf8",
}).trim();
assert(currentBranch === "codex/p1-rise-4102b-research-authority", `Unexpected branch: ${currentBranch}`);
const localHead = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: repoDir,
  encoding: "utf8",
}).trim();
const committedPaths = execFileSync(
  "git",
  ["diff", "--name-only", `${baseCommit}...HEAD`],
  { cwd: repoDir, encoding: "utf8" },
).split("\n").filter(Boolean);
for (const path of committedPaths) {
  assert(path.startsWith(packagePrefix), `Committed path outside release package: ${path}`);
}
const trackedWorkspaceDiff = execFileSync(
  "git",
  ["diff", "--name-only"],
  { cwd: repoDir, encoding: "utf8" },
).split("\n").filter(Boolean);
const stagedWorkspaceDiff = execFileSync(
  "git",
  ["diff", "--cached", "--name-only"],
  { cwd: repoDir, encoding: "utf8" },
).split("\n").filter(Boolean);
if (preflight) {
  for (const path of [...trackedWorkspaceDiff, ...stagedWorkspaceDiff]) {
    assert(path.startsWith(packagePrefix), `Tracked workspace change outside release package: ${path}`);
  }
} else {
  assert(trackedWorkspaceDiff.length === 0, "Strict release validation requires zero unstaged tracked changes");
  assert(stagedWorkspaceDiff.length === 0, "Strict release validation requires zero staged changes");
}

const statusPaths = execFileSync(
  "git",
  ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
  { cwd: repoDir, encoding: "utf8" },
).split("\0").filter(Boolean).map((line) => line.slice(3));
const preservedUntrackedRoots = [
  "_AI_HANDOFFS/from_codex/P1_RISE_4102A_CANONICAL_IDENTITY_UNBLOCK/",
  "outputs/",
];
for (const path of statusPaths) {
  assert(
    (preflight && path.startsWith(packagePrefix)) || preservedUntrackedRoots.some((root) => path.startsWith(root)),
    `Workspace change outside release package and preserved baseline: ${path}`,
  );
}

if (!preflight) {
  assert(localHead !== baseCommit, "Release custody is absent: HEAD still equals the base commit");
  assert(committedPaths.length > 0, "Release custody is absent: no committed package paths");
  const expectedCommittedPaths = ["SHA256SUMS", ...packageFiles]
    .map((name) => `${packagePrefix}${name}`)
    .sort();
  assert(
    JSON.stringify([...committedPaths].sort()) === JSON.stringify(expectedCommittedPaths),
    "Committed release scope does not exactly equal the package",
  );
  for (const path of expectedCommittedPaths) {
    execFileSync("git", ["ls-files", "--error-unmatch", path], {
      cwd: repoDir,
      stdio: "ignore",
    });
    const headBlob = execFileSync("git", ["rev-parse", `HEAD:${path}`], {
      cwd: repoDir,
      encoding: "utf8",
    }).trim();
    const workingBlob = execFileSync("git", ["hash-object", path], {
      cwd: repoDir,
      encoding: "utf8",
    }).trim();
    assert(headBlob === workingBlob, `Working-tree bytes differ from HEAD: ${path}`);
  }
  const originUrl = execFileSync("git", ["remote", "get-url", "origin"], {
    cwd: repoDir,
    encoding: "utf8",
  }).trim();
  assert(originUrl === "https://github.com/brinyu13/missionmed-hq.git", `Unexpected origin URL: ${originUrl}`);
  const remoteLine = execFileSync(
    "git",
    ["ls-remote", "--heads", "origin", "refs/heads/codex/p1-rise-4102b-research-authority"],
    { cwd: repoDir, encoding: "utf8" },
  ).trim();
  assert(remoteLine, "Remote research-authority branch is missing");
  const remoteHead = remoteLine.split(/\s+/)[0];
  assert(remoteHead === localHead, `Remote branch ${remoteHead} does not equal local HEAD ${localHead}`);
}

console.log(JSON.stringify({
  result: preflight ? "PREFLIGHT_PASS" : "PASS",
  releaseId: manifest.releaseId,
  manifestSha256: await shaFile(resolve(packageDir, "RESEARCH_AUTHORITY_MANIFEST.json")),
  packageSha256SumsSha256: await shaFile(resolve(packageDir, "SHA256SUMS")),
  sourceReleaseManifestSha256: sourceReleaseHash,
  identityPackageManifestSha256: expectedIdentityPackageManifestHash,
  counts: {
    memberships: wave1.length,
    exactDesignationPrograms: 1504,
    relatedCombinedMemberships: 145,
    internalMedicineMemberships: 828,
    familyMedicineMemberships: 821,
    uniqueCanonicalProgramIds: 1649,
    activeUnresolvedAliases: 0,
    canonicalIdCollisions: 0,
    externalIdCollisions: 0,
    orphanRecords: 0,
  },
  olathe: "PASS",
  sourcePolicy: "PASS",
  packageHashes: "PASS",
  releaseCustody: preflight ? "NOT_EVALUATED_IN_PREFLIGHT" : "PASS",
  productionMutationPerformed: false,
}, null, 2));
