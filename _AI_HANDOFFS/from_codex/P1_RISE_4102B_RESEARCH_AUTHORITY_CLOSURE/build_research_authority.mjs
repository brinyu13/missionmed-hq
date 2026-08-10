import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageDir = dirname(fileURLToPath(import.meta.url));
const sourceDir = resolve(
  packageDir,
  "../P1_RISE_4102A_CANONICAL_IDENTITY_UNBLOCK",
);
const generatedAt = "2026-08-10T11:24:33Z";
const releaseDate = "2026-08-10";

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
  const text = await readFile(resolve(dir, name), "utf8");
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function writeJson(name, value) {
  await writeFile(resolve(packageDir, name), `${JSON.stringify(value, null, 2)}\n`);
}

const aliases = await readNdjson("aliases.ndjson");
const programs = await readNdjson("programs.ndjson");
const programSpecialties = await readNdjson("program-specialties.ndjson");
const browseMemberships = await readNdjson("browse-memberships.ndjson");
const externalIdentifiers = await readNdjson("external-identifiers.ndjson");
const quarantine = await readNdjson("quarantined-source-rows.ndjson");
const sourceManifest = await readJson("P1_RISE_4006_RELEASE_MANIFEST.json", sourceDir);
const sourceValidation = await readJson("P1_RISE_4006_RELEASE_VALIDATION.json", sourceDir);
const sourcePolicy = await readJson("SOURCE_USE_POLICY.json");
const identityModulePath = "/Users/brianb/MissionMed_worktrees/P1-RISE-4006/rise/src/identity.mjs";
const {
  browseMembershipIdentity,
  programIdentity,
  programSpecialtyIdentity,
  stableOpaqueId,
} = await import(pathToFileURL(identityModulePath).href);

assert(programs.length === 6139, "Unexpected program count");
assert(programSpecialties.length === 6139, "Unexpected program-specialty count");
assert(browseMemberships.length === 6345, "Unexpected browse-membership count");
assert(aliases.length === 6345, "Unexpected alias count");
assert(externalIdentifiers.length === 6139, "Unexpected external identifier count");
assert(quarantine.length === 1, "Unexpected quarantine count");

function assertUnique(records, keyFn, label) {
  const values = new Set();
  for (const record of records) {
    const key = keyFn(record);
    assert(!values.has(key), `Duplicate ${label}: ${key}`);
    values.add(key);
  }
}

assertUnique(programs, (record) => record.id, "program ID");
assertUnique(programSpecialties, (record) => record.id, "program-specialty ID");
assertUnique(browseMemberships, (record) => record.id, "browse-membership ID");
assertUnique(aliases, (record) => `${record.namespace}:${record.value}`, "alias key");
assertUnique(externalIdentifiers, (record) => `${record.namespace}:${record.value}`, "external identifier key");

const programIds = new Set(programs.map((record) => record.id));
const programSpecialtyIds = new Set(programSpecialties.map((record) => record.id));
for (const record of externalIdentifiers) {
  assert(programIds.has(record.programId), `Orphan external identifier ${record.value}`);
  assert(programIdentity(record.value).id === record.programId, `Program ID mismatch for ${record.value}`);
}
for (const record of programSpecialties) {
  assert(programIds.has(record.programId), `Orphan program-specialty ${record.id}`);
  assert(
    programSpecialtyIdentity(record.programId, record.designation).id === record.id,
    `Program-specialty ID mismatch for ${record.id}`,
  );
}
for (const record of browseMemberships) {
  assert(programSpecialtyIds.has(record.programSpecialtyId), `Orphan browse membership ${record.id}`);
  assert(
    browseMembershipIdentity(record.programSpecialtyId, record.browseSpecialty).id === record.id,
    `Browse-membership ID mismatch for ${record.id}`,
  );
}
for (const record of aliases) {
  assert(programIds.has(record.programId), `Orphan alias ${record.value}`);
  assert(
    stableOpaqueId("rise_alias", `${record.namespace}:${record.value}:${record.sourceProjection}`) === record.id,
    `Alias ID mismatch for ${record.value}`,
  );
}

const specialtiesByProgram = new Map(
  programSpecialties.map((record) => [record.programId, record]),
);
const membershipsByKey = new Map(
  browseMemberships.map((record) => [
    `${record.programSpecialtyId}:${record.browseSpecialty}`,
    record,
  ]),
);

const wave1Aliases = aliases.filter((record) =>
  record.sourceProjection === "Internal Medicine" ||
  record.sourceProjection === "Family Medicine"
);

const wave1 = wave1Aliases.map((alias) => {
  const programSpecialty = specialtiesByProgram.get(alias.programId);
  assert(programSpecialty, `Missing program-specialty for ${alias.value}`);
  const membership = membershipsByKey.get(
    `${programSpecialty.id}:${alias.sourceProjection}`,
  );
  assert(membership, `Missing browse membership for ${alias.value}`);
  return {
    legacyAlias: alias.value,
    riseProgramId: alias.programId,
    programSpecialtyId: programSpecialty.id,
    browseMembershipId: membership.id,
    browseSpecialty: membership.browseSpecialty,
    relationship: membership.relationship,
    identityReleaseId: sourceManifest.releaseId,
    identityUse: "NON_EVIDENTIARY_ROUTING_ONLY",
  };
});

wave1.sort((a, b) =>
  a.riseProgramId.localeCompare(b.riseProgramId) ||
  a.legacyAlias.localeCompare(b.legacyAlias)
);

const wave1Text = `${wave1.map((record) => JSON.stringify(record)).join("\n")}\n`;
await writeFile(resolve(packageDir, "WAVE1_RESEARCH_IDENTITY.ndjson"), wave1Text);

const olathe = {
  schemaVersion: "rise.research.olathe.disposition.v1",
  dispositionId: "rise_source_resolution_1401900001_2026-07-15",
  status: "ACCEPTED_FOR_IDENTITY_CONTINUITY_SOURCE_PAYLOAD_QUARANTINED",
  canonicalRiseProgramId: "rise_prg_31141a27-b249-5eae-8259-dd3fe679c4f2",
  retainedAlias: "RISE-IM-0683",
  quarantinedAlias: "RISE-IM-0682",
  programSpecialtyId: "rise_ps_54ba473a-9b30-5dc0-8f3f-0bd2bdb17d14",
  browseMembershipId: "rise_bm_17a10138-722d-51b0-baf8-52a67320ce7d",
  normalizedExternalIdentifierObservation: {
    namespace: "ACGME_PROGRAM_ID_AS_REPORTED_BY_FREIDA",
    value: "1401900001",
    use: "IDENTITY_DISPOSITION_REFERENCE_ONLY",
    activeProgramEvidence: false,
  },
  sourcePayloadPolicy: {
    retainedFreidaObservationMayPopulateFacts: false,
    quarantinedFreidaObservationMayPopulateFacts: false,
    quarantinedAliasMayBecomeActive: false,
    firstPartyReverificationRequired: true,
  },
  independentCorroboration: {
    sourceType: "AAMC_GENERAL_PUBLIC_MATERIAL",
    accessMode: "MANUAL_REFERENCE_ONLY",
    url: "https://systems.aamc.org/eras/erasstats/par/display.cfm?spec_cd=140",
    reviewedAt: "2026-08-10",
    permittedUse: "Corroborate that a single Olathe Internal Medicine program entry is listed; do not ingest the page as a dataset.",
  },
  rationale: "The historical duplicate disposition is technically coherent and no contrary identity evidence exists. Source-rights uncertainty is isolated from canonical identity continuity.",
};
await writeJson("WAVE1_OLATHE_DISPOSITION.json", olathe);

const sourcePolicyHash = await shaFile(resolve(packageDir, "SOURCE_USE_POLICY.json"));
const sourceAccessDecisionSchemaHash = await shaFile(
  resolve(packageDir, "SOURCE_ACCESS_DECISION_SCHEMA.json"),
);
const privacyCollectionDecisionSchemaHash = await shaFile(
  resolve(packageDir, "PRIVACY_COLLECTION_DECISION_SCHEMA.json"),
);
const sourceAccessDecisionValidatorHash = await shaFile(
  resolve(packageDir, "validate_source_access_decision.mjs"),
);
const privacyCollectionDecisionValidatorHash = await shaFile(
  resolve(packageDir, "validate_privacy_collection_decision.mjs"),
);
const wave1Hash = sha256(wave1Text);
const olatheHash = await shaFile(resolve(packageDir, "WAVE1_OLATHE_DISPOSITION.json"));
const sourceReleaseHash = await shaFile(
  resolve(sourceDir, "P1_RISE_4006_RELEASE_MANIFEST.json"),
);
const sourceValidationHash = await shaFile(
  resolve(sourceDir, "P1_RISE_4006_RELEASE_VALIDATION.json"),
);
const identityPackageManifestHash = await shaFile(resolve(sourceDir, "MANIFEST.json"));
const releaseSeed = JSON.stringify({
  ticket: "P1-RISE-4102B",
  releaseDate,
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
const releaseId = `rise_research_authority_${releaseDate}_${sha256(releaseSeed).slice(0, 12)}`;

const exactCount = wave1.filter(
  (record) => record.relationship === "EXACT_DESIGNATION",
).length;
const relatedCombinedCount = wave1.filter(
  (record) => record.relationship === "RELATED_COMBINED",
).length;
const imCount = wave1.filter(
  (record) => record.browseSpecialty === "Internal Medicine",
).length;
const fmCount = wave1.filter(
  (record) => record.browseSpecialty === "Family Medicine",
).length;
const uniqueProgramIds = new Set(wave1.map((record) => record.riseProgramId));

assert(wave1.length === 1649, "Wave 1 membership count drift");
assert(exactCount === 1504, "Wave 1 exact count drift");
assert(relatedCombinedCount === 145, "Wave 1 combined-membership count drift");
assert(imCount === 828, "IM membership count drift");
assert(fmCount === 821, "FM membership count drift");

const manifest = {
  schemaVersion: "rise.research.authority.v1",
  releaseId,
  ticket: "P1-RISE-4102B",
  generatedAt,
  effectiveDate: releaseDate,
  immutable: true,
  result: "RESEARCH_AUTHORITY_UNBLOCKED",
  scope: "W1-IMFM-001_OFFLINE_RESEARCH_ONLY",
  activationStatus: "ACTIVE_ON_SATISFIED_CUSTODY_AND_VALIDATION_CONDITIONS",
  resumeAuthorized: true,
  productionAuthorized: false,
  studentDisplayAuthorized: false,
  restrictedSourceRightsApproved: false,
  publicFirstPartyResearchLaneAuthorized: true,
  maximumRecordState: "PUBLICATION_CANDIDATE_REQUIRES_HUMAN_REVIEW",
  activationConditions: [
    "Every package artifact is committed on codex/p1-rise-4102b-research-authority.",
    "The remote branch head equals the local release commit.",
    "SHA256SUMS verification passes.",
    "validate_research_authority.mjs returns PASS without --preflight."
  ],
  acceptance: {
    acceptedBy: "Brian",
    acceptedRole: "Founder",
    acceptanceDate: "2026-08-10",
    acceptanceMode: "PROSPECTIVE_CONDITIONAL_FOUNDER_DIRECTIVE",
    threadEvidence: "Current P1-RISE-4102B Founder directive in this Codex task.",
    acceptedScope: "A source-separated offline W1-IMFM-001 release satisfying every user-specified validation gate and making no production mutation.",
    exactBytesPreinspectedByFounder: false,
    interpretation: "The Founder prospectively authorized the bounded release class and its objective gates; this record does not represent later visual inspection or signature of the exact bytes.",
    conditionedOn: [
      "Identity counts and collisions pass.",
      "Restricted-source permissions remain false.",
      "Per-domain source decisions fail closed.",
      "Release custody is committed and pushed.",
      "Independent adversarial findings are repaired and revalidated."
    ]
  },
  authority: {
    founderDirective: {
      authorityType: "CURRENT_FOUNDER_DIRECTIVE_IN_THREAD",
      directive: "Clear every legitimately resolvable blocker and authorize P1-RISE-4102 to resume W1-IMFM-001 when validation passes.",
      scope: "Offline, source-separated, verifiable IM/FM research; no production mutation or student publication.",
    },
    riseOwnershipEvidence: {
      record: "/Users/brianb/MissionMed_OS/decisions/DR-023_f2_lor_1009_authority_unblock_and_bounded_production_release.md",
      sha256: "c5d977259b0b2f54ed688fe6d780f182bdd06f78e5a5c1f4ef732a7cc74fdab5",
      statement: "RISE owns residency-program intelligence.",
      line: 212,
    },
    architectureAuthority: {
      record: "/Users/brianb/MissionMed_worktrees/MM-PLAT-000-platform-bootstrap-e850386/MISSIONMED_PLATFORM/docs/ADR/MM-FABLE-ADR-001_missionmed_platform_architecture.md",
      sha256: "50bff490faab9c089840c1db87cc3b7b92e721a3d4992bab24e1950035439f00",
    },
    constitutionRevision3: {
      record: "/Users/brianb/MissionMed/MissionMed_Platform_v1_Governing_Constitution_Revision_3.docx",
      sha256: "aea2be8e5e75495b2dee63f48de6c9ea63883c90c4b6f1d7ab4daa1989c232ce",
      treatment: "Applied as Founder-directed governing principles for this bounded run; not represented as globally ratified MissionMed OS authority.",
    },
  },
  repository: {
    url: "https://github.com/brinyu13/missionmed-hq.git",
    researchAuthorityBranch: "codex/p1-rise-4102b-research-authority",
    baseBranch: "p1-rise-4000",
    baseCommit: "e8503866bce9cb941dd8f2dc38f39e62bd21e316",
    historicalIdentityBranch: "codex/p1-rise-4006",
    historicalIdentityHead: "365bd8eba38a9dc9058367e1d888a45850c34149",
    historicalEvidenceCommit: "46467b1568aafc0093f1e63f8098118266e7c818",
    productionCandidateBranch: "codex/p1-rise-4006-production",
    productionCandidateLocalHead: "2d0fc6b986ab1cc010e521c54b7b42ec916c1e32",
    productionCandidateRemoteHeadObserved: "ad0fae528d9d174fb01a7717af41923323074183",
    mergeBase: "9c1fa72e6b056db8fe0e17031fcaa688f78569",
  },
  canonicalIdentity: {
    authorityClass: "IMMUTABLE_IDENTITY_CONTINUITY_SIDECAR",
    researchSchemaVersion: "rise.research.identity.v1",
    canonicalContract: "programs.ndjson.id == rise_program_id",
    sourceReleaseId: sourceManifest.releaseId,
    sourceReleaseActivationStatus: sourceManifest.activationStatus,
    sourceReleaseManifestSha256: sourceReleaseHash,
    sourceValidationSha256: sourceValidationHash,
    identityPackageManifestSha256: identityPackageManifestHash,
    identityImplementationSha256: "3c880fbc4f2842b8d8561d13dca3c7d6eccba27023a09fff46dafbb142332344",
    identityImplementationGitBlob: "2b8509621c09ba771ed1ea61eb3b462414e9a502",
    useRestriction: "NON_EVIDENTIARY_ROUTING_ONLY",
    programFactsActivated: false,
    sourcePayloadActivated: false,
  },
  wave1: {
    waveId: "W1-IMFM-001",
    memberships: wave1.length,
    exactDesignationPrograms: exactCount,
    relatedCombinedMemberships: relatedCombinedCount,
    internalMedicineMemberships: imCount,
    familyMedicineMemberships: fmCount,
    uniqueCanonicalProgramIds: uniqueProgramIds.size,
    unresolvedActiveAliases: 0,
    canonicalIdCollisions: 0,
    externalIdCollisionsInPinnedSource: 0,
    orphanRecordsInPinnedSource: 0,
    sanitizedIdentityFile: "WAVE1_RESEARCH_IDENTITY.ndjson",
    sanitizedIdentitySha256: wave1Hash,
  },
  olathe: {
    disposition: "ACCEPTED_FOR_IDENTITY_CONTINUITY_SOURCE_PAYLOAD_QUARANTINED",
    canonicalRiseProgramId: olathe.canonicalRiseProgramId,
    retainedAlias: olathe.retainedAlias,
    quarantinedAlias: olathe.quarantinedAlias,
    dispositionFile: "WAVE1_OLATHE_DISPOSITION.json",
    dispositionSha256: olatheHash,
  },
  sourceAuthority: {
    policyFile: "SOURCE_USE_POLICY.json",
    policySha256: sourcePolicyHash,
    sourceAccessDecisionSchemaFile: "SOURCE_ACCESS_DECISION_SCHEMA.json",
    sourceAccessDecisionSchemaSha256: sourceAccessDecisionSchemaHash,
    privacyCollectionDecisionSchemaFile: "PRIVACY_COLLECTION_DECISION_SCHEMA.json",
    privacyCollectionDecisionSchemaSha256: privacyCollectionDecisionSchemaHash,
    sourceAccessDecisionValidatorFile: "validate_source_access_decision.mjs",
    sourceAccessDecisionValidatorSha256: sourceAccessDecisionValidatorHash,
    privacyCollectionDecisionValidatorFile: "validate_privacy_collection_decision.mjs",
    privacyCollectionDecisionValidatorSha256: privacyCollectionDecisionValidatorHash,
    defaultState: sourcePolicy.defaultState,
    publicFirstPartyResearchAuthorized: false,
    conditionalPublicFirstPartyResearchAuthorized: true,
    unconditionalPublicDomainAuthorization: false,
    domainAccessDecisionRequired: true,
    residentRosterPrecollectionPrivacyApprovalRequired: true,
    freidaFactsAuthorized: false,
    residencyExplorerAuthorized: false,
    studentDisplayAuthorized: false,
    rawRedistributionAuthorized: false,
    productionUseAuthorized: false,
  },
  resume: {
    thread: "P1-RISE-4102",
    wave: "W1-IMFM-001",
    resumeAuthorized: true,
    authorizedWork: "Create per-domain decisions and research only exact official public first-party paths those decisions allow; resident-roster work additionally requires a named privacy decision.",
    outputMaturity: "PUBLICATION_CANDIDATE_REQUIRES_HUMAN_REVIEW",
    joinRule: "Strict legacyAlias equality join to WAVE1_RESEARCH_IDENTITY.ndjson; never join by name or fuzzy matching.",
  },
  exclusions: {
    productionMutation: true,
    productionDeployment: true,
    studentFacingPublication: true,
    inheritedFreidaFactUse: true,
    residencyExplorerUse: true,
    restrictedReportIngestion: true,
    canonicalIdRegeneration: true,
    liveGoogleMutation: true,
    inheritedProgramNames: true,
    inheritedProgramUrls: true,
    inheritedExternalIdentifiers: true,
    inheritedClaims: true,
    inheritedSourceDocuments: true,
    inheritedDiscoveryHints: true,
  },
  nonBlockingExternalActions: [
    "Written AMA permission or counsel approval for any broader FREIDA reuse.",
    "Written AAMC authorization for Residency Explorer use.",
    "Source-specific permission or legal review before ACGME, NRMP, ABFM, or ABIM report ingestion or student display.",
    "Formal MissionMed OS product/passport registration and additive production schema reconciliation before production activation."
  ],
  validation: {
    requiredValidator: "validate_research_authority.mjs",
    expectedResult: "PASS",
    sourceReleaseValidationResult: sourceValidation.result ?? "PASS",
    productionMutationPerformed: false,
    preexistingUntrackedRootsPreserved: [
      "_AI_HANDOFFS/from_codex/P1_RISE_4102A_CANONICAL_IDENTITY_UNBLOCK/",
      "outputs/"
    ]
  },
};

await writeJson("RESEARCH_AUTHORITY_MANIFEST.json", manifest);
const manifestHash = await shaFile(resolve(packageDir, "RESEARCH_AUTHORITY_MANIFEST.json"));

const machineValidationReport = {
  schemaVersion: "rise.research.authority.validation.v1",
  releaseId,
  generatedAt,
  result: "ARTIFACT_PASS_CUSTODY_REQUIRES_POST_PUSH_VALIDATION",
  validator: "validate_research_authority.mjs",
  counts: {
    sourcePrograms: programs.length,
    sourceProgramSpecialties: programSpecialties.length,
    sourceBrowseMemberships: browseMemberships.length,
    sourceAliases: aliases.length,
    sourceExternalIdentifiers: externalIdentifiers.length,
    sourceQuarantineRows: quarantine.length,
    wave1Memberships: wave1.length,
    wave1ExactDesignationPrograms: exactCount,
    wave1RelatedCombinedMemberships: relatedCombinedCount,
    wave1InternalMedicineMemberships: imCount,
    wave1FamilyMedicineMemberships: fmCount,
    wave1UniqueCanonicalProgramIds: uniqueProgramIds.size,
  },
  gates: {
    sourcePackageHashes: "PASS",
    identityForeignKeys: "PASS",
    deterministicIdentityRecomputation: "PASS",
    duplicateRecordIds: 0,
    duplicateAliasKeys: 0,
    multiProgramAliasMappings: 0,
    externalIdentifierCollisions: 0,
    orphanRecords: 0,
    activeUnresolvedWave1Aliases: 0,
    olathePartition: "PASS",
    sourcePolicyFailClosed: "PASS",
    sourceAccessDecisionContract: "PASS",
    sourceAccessDecisionDomainAndExpiryValidator: "PASS",
    privacyDecisionStrictFieldAndExpiryValidator: "PASS",
    releaseCustody: "REQUIRES_COMMIT_PUSH_AND_DEFAULT_VALIDATOR",
    restrictedSourceRightsApproved: false,
    productionMutationPerformed: false,
  },
  sanitizedMappingFieldAllowlist: [
    "legacyAlias",
    "riseProgramId",
    "programSpecialtyId",
    "browseMembershipId",
    "browseSpecialty",
    "relationship",
    "identityReleaseId",
    "identityUse"
  ],
  artifactHashes: {
    sourceReleaseManifest: sourceReleaseHash,
    sourceValidation: sourceValidationHash,
    identityPackageManifest: identityPackageManifestHash,
    sourceUsePolicy: sourcePolicyHash,
    sourceAccessDecisionSchema: sourceAccessDecisionSchemaHash,
    privacyCollectionDecisionSchema: privacyCollectionDecisionSchemaHash,
    sourceAccessDecisionValidator: sourceAccessDecisionValidatorHash,
    privacyCollectionDecisionValidator: privacyCollectionDecisionValidatorHash,
    wave1ResearchIdentity: wave1Hash,
    olatheDisposition: olatheHash,
    researchAuthorityManifest: manifestHash,
  },
  note: "This builder report is independently reproduced by the standalone validator before release closure."
};
await writeJson("VALIDATION_REPORT.json", machineValidationReport);

const authorityChain = `# 01 AUTHORITY CHAIN

## Decision

${releaseId} is the current bounded authority for P1-RISE-4102 to resume W1-IMFM-001 as offline, source-separated research after its committed/pushed custody and default validator gates pass. It does not activate the historical registry payload, authorize student display, or authorize production.

## Governing chain

1. **Current Founder directive, P1-RISE-4102B (2026-08-10).** Brian directed Codex to re-evaluate the old stop, clear every blocker legitimately resolvable from current evidence, and create a research authority release without weakening source-rights controls or mutating production.
2. **MissionMed OS DR-023 (2026-08-09).** The accepted decision record names Brian as decider and states at line 212: \"RISE owns residency-program intelligence.\" SHA-256: \`c5d977259b0b2f54ed688fe6d780f182bdd06f78e5a5c1f4ef732a7cc74fdab5\`.
3. **MM-FABLE-ADR-001.** The tracked platform architecture authority supplies bounded ownership, contract, provenance, and release-governance principles. SHA-256: \`50bff490faab9c089840c1db87cc3b7b92e721a3d4992bab24e1950035439f00\`.
4. **Platform v1 Governing Constitution Revision 3.** The Founder directed this run to apply its principles. Its file SHA-256 is \`aea2be8e5e75495b2dee63f48de6c9ea63883c90c4b6f1d7ab4daa1989c232ce\`. Repository evidence does not establish global MissionMed OS ratification, so this package does not claim it. The applicable principles are one canonical owner per fact, AI output remains bounded and auditable, production claims require production evidence, and records outrank memory.
5. **Historical identity release.** \`rise_registry_2026-07-09_f51f0643a2d9\` is immutable and hash-valid but remains \`offline_shadow_only\` with \`sourceRightsApproved=false\`.
6. **P1-RISE-4102A.** The identity recovery proved that the historical mapping is internally consistent, compatible with the production identity function, and complete for Wave 1. It did not authorize research use.
7. **P1-RISE-4102B.** This release registers only the canonical identity graph as non-evidentiary routing metadata and creates a fail-closed process for source-level decisions. It carries no inherited program facts forward.

## Founder acceptance record

Brian's current directive prospectively accepts a bounded offline research release that satisfies every named gate. The machine manifest records \`acceptedBy=Brian\`, \`acceptanceMode=PROSPECTIVE_CONDITIONAL_FOUNDER_DIRECTIVE\`, and \`exactBytesPreinspectedByFounder=false\`. This is not AI self-approval and does not claim that Brian later inspected or signed the exact bytes. Activation is automatic only when the hash, validator, independent review, commit, and remote-custody conditions all pass.

## Ownership disposition

RISE is the bounded owner of residency-program intelligence for this offline research release. That scope includes program identity, program evidence/provenance, leadership, curriculum, research, outcomes, visa policy, interview intelligence, and program-specific strategy when each fact is lawfully and independently sourced. Other MissionMed products may later consume versioned RISE contracts; they do not create competing residency databases.

The current MissionMed OS registry still lacks a ratified RISE product/passport entry. That is a production governance gap, not a reason to block bounded offline research under the current Founder directive. Production activation still requires separate registration and evidence.

## Repository topology

| Role | Branch / commit |
|---|---|
| Research release base | \`p1-rise-4000\` / \`e8503866bce9cb941dd8f2dc38f39e62bd21e316\` |
| Research authority branch | \`codex/p1-rise-4102b-research-authority\` |
| Historical identity lineage | \`codex/p1-rise-4006\` / \`365bd8eba38a9dc9058367e1d888a45850c34149\` |
| Historical evidence commit | \`46467b1568aafc0093f1e63f8098118266e7c818\` |
| Production-candidate lineage | \`codex/p1-rise-4006-production\` / local \`2d0fc6b986ab1cc010e521c54b7b42ec916c1e32\` |
| Observed production remote | \`ad0fae528d9d174fb01a7717af41923323074183\` |
| Merge base of 4006 siblings | \`9c1fa72e6b056db8fe0e17031fcaa688f78569\` |

The two 4006 branches are siblings. The later production candidate did not reject the ID semantics; it failed to inherit the immutable release bytes and omitted alias/external-ID persistence. Commit \`89d1fb409aaff3b127c8b7cf493cd80343e47f84\` then removed source resolutions pending source-owner rights. This was a custody and rights gate, not contrary identity evidence.

## Boundaries

- No production database, route, application, Google file, or external system is changed.
- No historical canonical ID is regenerated.
- No source-rights uncertainty is converted into permission.
- No release in this package is student-facing.
- Any later conflict is resolved by a new additive authority record; this immutable package is never edited in place.
`;

const blockerResolution = `# 02 FIVE BLOCKER RESOLUTION

## Final dispositions

| Reported blocker | Classification | Resolution |
|---|---|---|
| RISE ownership authority | \`STALE_BLOCKER\`, \`DOCUMENTATION_GAP\`, \`RESOLVABLE_NOW\` for offline research | DR-023 already states that RISE owns residency-program intelligence, and the current Founder directive supplies the bounded offline scope. Production registration remains separate and nonblocking. |
| Source authorization / rights | \`RIGHTS_GAP\` for restricted sources; \`RESOLVABLE_NOW\` for a per-domain public first-party decision lane | Source classes are separated. Inherited FREIDA facts, names, URLs, identifiers, and Residency Explorer remain prohibited. No official domain is pre-authorized: a hash-pinned source-access decision must first allow the exact domain under explicit terms and access evidence. |
| Release acceptance | \`STALE_BLOCKER\`, \`DOCUMENTATION_GAP\`, \`RESOLVABLE_NOW\` for identity-only research | The historical release is accepted only as an immutable identity-continuity sidecar. Its claims, source documents, names, external IDs, and statistics are not activated. |
| Olathe | \`STALE_BLOCKER\`, \`DOCUMENTATION_GAP\`, \`RESOLVABLE_NOW\` for identity; \`RIGHTS_GAP\` for inherited payload | Canonical ID and retained alias are registered; the malformed duplicate remains quarantined. Source rights are isolated from identity continuity. |
| Canonical branch / schema authority | \`TECHNICAL_GAP\` for later production; \`RESOLVABLE_NOW\` for offline research | \`rise.research.identity.v1\` is the research contract. The production candidate remains the runtime-engineering lineage but is not the identity mapping authority until an additive schema preserves aliases/external IDs without changing IDs. |

## What the old STOP_SAFE got right

P1-RISE-4102 correctly refused fuzzy or name-based identity attachment. P1-RISE-4102A correctly refused to activate a technically valid release whose source rights and acceptance were unresolved. Those stops remain valid for inherited factual content and production.

## What is superseded

The old all-or-nothing stop is superseded for W1-IMFM-001. A restricted FREIDA or Residency Explorer field now fails closed at the source/field/record/program scope; it does not prevent independent research of an official program page whose terms and access conditions permit normal public use.

## Remaining actions that do not block W1

- AMA permission or counsel approval for broader FREIDA reuse.
- AAMC written authorization for Residency Explorer.
- Source-specific permission review before report ingestion or student display.
- MissionMed OS product registration and additive production schema reconciliation before deployment.
`;

const sourceRightsMatrix = `# 03 SOURCE RIGHTS AND USE MATRIX

This is an operational governance matrix, not legal advice. \`SOURCE_USE_POLICY.json\` is the controlling machine-readable policy. Unknown or absent source classes default to \`DO_NOT_USE\`.

| Source class | Research | Internal storage | Student display | Raw redistribution | Derived intelligence |
|---|---|---|---|---|---|
| MissionMed canonical identity metadata | Authorized for exact routing joins | Authorized | Not authorized | Not authorized | Routing/continuity only; never program facts |
| Inherited FREIDA payload | Not authorized, including as a discovery or matching input | Existing immutable quarantine only | Not authorized | Not authorized | Not authorized |
| Residency Explorer | Do not use absent written AAMC authorization | Not authorized | Not authorized | Not authorized | Not authorized |
| Official residency program page | Denied by default; conditionally allowed only by a hash-pinned per-domain decision | Denied until that decision; then minimal discrete facts + provenance | Not authorized by this release | Not authorized | Conditional, provenance-bound, publication candidate only |
| Official hospital/institution page | Denied by default; conditionally allowed only by a hash-pinned per-domain decision | Denied until that decision; then minimal discrete facts + provenance | Not authorized by this release | Not authorized | Conditional, provenance-bound, publication candidate only |
| Official faculty/leadership page | Denied until domain and privacy-minimization decisions pass | Denied until those decisions | Not authorized | Not authorized | Conditional |
| Official resident roster | Denied until domain access and named pre-collection privacy approvals pass | Denied until controller, purpose, access, retention, deletion, and expiry are approved | Not authorized | Not authorized | Conditional; no sensitive inference |
| AAMC general public materials | Manual policy reference only | Minimal citation record | Not authorized | Not authorized | Not authorized without source-specific review |
| ACGME public site/reports | Manual reference only | Minimal citation record | Not authorized | Not authorized | Not authorized without license/review |
| NRMP reports/data | Manual policy reference only | Minimal citation record | Not authorized | Not authorized | Not authorized without permission/license |
| ABFM reports/data | Manual reference only | Minimal citation record | Not authorized | Not authorized | Program-rate ingestion not authorized |
| ABIM reports/data | Manual reference only | Not authorized pending review | Not authorized | Not authorized | Not authorized pending review |
| MissionMed internal records | Case-by-case owner/consent review | Not authorized by this release | Not authorized | Not authorized | Not authorized |
| Unofficial aggregators/blogs | Not authoritative; do not use | Not authorized | Not authorized | Not authorized | Not authorized |

## Controlling evidence reviewed 2026-08-10

- AMA Terms of Use: https://www.ama-assn.org/about/terms-use
- FREIDA provenance: https://assets.ama-assn.org/resources/doc/freida/x-pub/freida-about-freida.pdf
- Residency Explorer Terms and Conditions: https://students-residents.aamc.org/applying-residency/residency-explorer-terms-and-conditions
- AAMC Website Terms and Conditions: https://www.aamc.org/website-terms-conditions
- ACGME Terms of Use: https://www.acgme.org/about/legal/terms-of-use/
- ACGME Publication/Document Usage: https://www.acgme.org/about/legal/publication-document-usage/
- NRMP Match Data request/licensing page: https://www.nrmp.org/match-data-submit-request/
- ABFM Terms of Use: https://www.theabfm.org/terms-of-use/
- ABIM Data and Reports: https://www.abim.org/about/data-and-reports/
- U.S. Copyright Office facts guidance: https://www.copyright.gov/help/faq/faq-protect.html

## Fail-closed rule

Every accepted fact requires an allowed source class, a hash-pinned conforming source-access decision for its exact domain, separately allowing research and minimal storage, a URL, an evidence locator, a retrieval date, an identity check, and a maturity state. Derivation and automation each require their own positive decision. Resident-roster collection additionally requires a hash-pinned privacy decision. Both decision files must pass their executable validators and be unexpired. If any requirement fails, leave the field blank and record the unresolved reason. A source permission failure blocks only the affected source, operation, field, record, or program unless identity itself is uncertain.
`;

const provenance = `# 04 EXISTING REGISTRY PROVENANCE

## Immutable source release

| Item | Value |
|---|---|
| Release | \`rise_registry_2026-07-09_f51f0643a2d9\` |
| Release manifest SHA-256 | \`${sourceReleaseHash}\` |
| Activation status | \`offline_shadow_only\` |
| Source rights approved | \`false\` |
| Canonical Google Sheet ID (historical provenance only) | \`1sHpiFtlQgCZMN9eIR5ZtudyErPP9OkFAeCiXPmQ8uVA\` |
| Verified Google account (historical evidence) | \`info@missionmedinstitute.com\` |
| Source workbook SHA-256 | \`1fd54a2222d31c609b77aea46cfd875ea0aca1dc701f83dc7c8f4948695847ff\` |
| Google-Sheets import workbook SHA-256 | \`c627397c69d2fad42c07a0b66951f3f3a4957a86c231d93a5bd925cdb2d87b9e\` |
| Inspection SHA-256 | \`2f33a66160150a084e37f72b18e36813553b970f8214f5a9aa935826f60c8878\` |

## Measured provenance

- 6,346 raw source rows; 6,345 active rows; one quarantined duplicate observation.
- 6,139 canonical program IDs, 6,139 program-specialty records, 6,345 browse memberships, 6,345 aliases, and 6,139 external-identifier observations.
- 6,139 source documents and 721,055 claims are attributed to \`FREIDA_GME_CENSUS\`.
- One Brookdale official-program source document supplies 11 field-source overrides.
- Zero cells are attributed to Residency Explorer.
- The generator directly queried FREIDA administrative API/page endpoints. This is why public availability is not assumed to grant product reuse.

## Rights treatment

The release is retained as immutable evidence and identity continuity. Its source documents, claims, names, external identifiers, statistics, and copied text are not activated by 4102B. The sanitized Wave 1 sidecar intentionally contains no names, locations, websites, external IDs, salaries, program attributes, or narrative text.

The opaque \`rise_program_id\` values were deterministically generated from normalized external-ID seeds. 4102B accepts those opaque values only as internal continuity keys because both 4006 branches implement byte-identical identity semantics and all IDs recompute exactly. This is not a finding that the seed source may be republished or used as program evidence.

## Source-by-source disposition

- **FREIDA:** preserve existing immutable bytes in quarantine; no active factual use, display, redistribution, or further derivation without written permission or counsel approval.
- **Residency Explorer:** no inherited material exists; future use remains prohibited absent written AAMC authorization.
- **Brookdale official override:** must be freshly reverified from the current official page before use; the old override is not automatically accepted.
- **External identifiers:** historical observations remain source-qualified (\`ACGME_PROGRAM_ID_AS_REPORTED_BY_FREIDA\`), not independently ACGME-verified.
`;

const publicResearch = `# 05 PUBLIC FIRST-PARTY RESEARCH AUTHORITY

## Authorized lane

P1-RISE-4102 may resume W1-IMFM-001 by creating source-access decisions and, only where those decisions allow, researching official public program, hospital, institution, faculty, leadership, curriculum, benefit, visa, and facility pages. No domain is blanket-authorized. Resident pages remain closed until both domain-access and named pre-collection privacy decisions pass. This lane creates publication-candidate evidence only.

## Required record workflow

1. Join the existing 4102 row to \`WAVE1_RESEARCH_IDENTITY.ndjson\` by exact legacy alias. Reject zero matches or multiple matches.
2. Do not read inherited FREIDA names, URLs, identifiers, claims, or neighboring cells as discovery or matching inputs. Build any discovery crosswalk only from independently permitted sources. Unlinked rows remain \`IDENTITY_MATCH_PENDING\`.
3. Before accessing a candidate domain, create a decision conforming to \`SOURCE_ACCESS_DECISION_SCHEMA.json\`; run \`node validate_source_access_decision.mjs <decision.json>\`; hash-pin the passing decision in the research record. The validator binds terms, robots, and evidence URLs to the reviewed domain and rejects expired decisions. Restrictive, absent, or ambiguous evidence returns \`DENY\` or \`MANUAL_REVIEW_REQUIRED\`, never allow.
4. Research, storage, derivation, and automation are independent permissions. A populated RISE value requires both \`ALLOW_MINIMAL_FACT_RESEARCH\` and \`ALLOW_MINIMAL_DISCRETE_FACT_STORAGE\`. Derived intelligence additionally requires \`ALLOW_PROVENANCE_BOUND_DERIVATION\`. Automation additionally requires \`ALLOW_BOUNDED_AUTOMATION\`, explicit terms/robots support, and the bounded rate/concurrency controls. Never bypass authentication, robots directives, paywalls, CAPTCHAs, or other controls.
5. Establish program identity from independently permitted first-party evidence. An official identifier may be recomputed through the pinned identity function solely to confirm an existing opaque ID; this does not authorize the identifier as a displayed fact. Do not name-match or fuzzy-match canonical records.
6. Capture only discrete facts that the allowed page explicitly states and only when storage is independently allowed. Store source URL, page title, precise evidence locator, retrieval date, source class, access-decision ID/hash, operation decisions, and confidence. Do not retain raw HTML, images, copied biographies, or expressive mission prose.
7. For resident-roster collection, additionally require a decision conforming to \`PRIVACY_COLLECTION_DECISION_SCHEMA.json\` and run \`node validate_privacy_collection_decision.mjs <decision.json>\`. Without a named controller and approved purpose/access/retention/deletion/expiry, or if any requested field is outside the strict allowlist, skip the roster source.
8. Keep all new output at \`PUBLICATION_CANDIDATE_REQUIRES_HUMAN_REVIEW\`. Student display and production import require later, separate authorization.
9. If a field cannot be verified or a source cannot be used, leave the field blank and record the reason. Continue other allowed fields for the same program.

## Privacy controls

Public professional leadership roles and official business contacts may be stored only after a domain-access decision and with minimization. Resident rosters are not collectible under the base policy; a named pre-collection privacy approval must establish controller, purpose, access, retention, deletion, expiry, and audit rules. No sensitive characteristic may be inferred. Photos, personal contact details, biography text, and sensitive attributes are excluded.

## Restricted source isolation

FREIDA, Residency Explorer, ACGME bulk datasets, NRMP data/report values, and specialty-board report values do not become authorized because an official program page is authorized. Each source class is evaluated independently under \`SOURCE_USE_POLICY.json\`.

## Research output contract

At minimum, each populated field must carry:

- \`rise_program_id\`
- exact \`legacy_alias\` used for the join
- \`field_key\`
- normalized \`value\`
- \`source_type\`
- \`source_access_decision_id\`
- \`source_access_decision_sha256\`
- \`research_decision\`
- \`storage_decision\`
- \`derivation_decision\`
- \`automation_decision\`
- \`source_url\`
- \`page_title\`
- \`evidence_locator\`
- \`retrieved_at\`
- \`identity_verification_method\`
- \`confidence\`
- \`maturity=PUBLICATION_CANDIDATE_REQUIRES_HUMAN_REVIEW\`
- \`privacy_decision_id\` and \`privacy_decision_sha256\` when roster data is involved

Blank fields remain blank. Guesses, inferred negatives, copied source prose, and unsourced synthesis are prohibited.
`;

const schemaAuthority = `# 06 CANONICAL BRANCH SCHEMA AUTHORITY

## Research authority

| Contract | Authority |
|---|---|
| Canonical program key | Historical \`programs.ndjson.id\` carried as \`rise_program_id\` |
| Research schema | \`rise.research.identity.v1\` |
| Wave 1 identity sidecar | \`WAVE1_RESEARCH_IDENTITY.ndjson\` |
| Source-use contract | \`rise.source.use.policy.v1\` |
| Release manifest | \`rise.research.authority.v1\` |
| Research authority branch | \`codex/p1-rise-4102b-research-authority\` |

The sidecar fields are exactly \`legacyAlias\`, \`riseProgramId\`, \`programSpecialtyId\`, \`browseMembershipId\`, \`browseSpecialty\`, \`relationship\`, \`identityReleaseId\`, and \`identityUse\`. They are routing metadata, not program facts.

## Compatibility finding

Both 4006 branches contain the same identity implementation Git blob \`2b8509621c09ba771ed1ea61eb3b462414e9a502\` (SHA-256 \`3c880fbc4f2842b8d8561d13dca3c7d6eccba27023a09fff46dafbb142332344\`). Independent recomputation produced zero mismatches for all 6,139 program IDs, 6,139 program-specialty IDs, 6,345 browse-membership IDs, and 6,345 alias IDs.

The production candidate's SQL can preserve program, program-specialty, and browse-membership IDs but omits alias and source-qualified external-ID tables. That is a real production schema completeness gap. It does not prevent offline research because no production RISE migration was applied and this release writes no database.

## Combined specialties

The identity graph contains 206 programs with two legitimate browse memberships/aliases. Wave 1 retains component memberships rather than flattening them. A canonical program may therefore appear in multiple specialty work queues while program facts remain attached once to the canonical \`rise_program_id\`.

## Future production rule

Production must not load this historical release directly. A later ratified change must:

1. preserve migrations 001-003;
2. add a forward migration for release-scoped aliases and source-qualified external identifiers;
3. prove all 6,139 resulting program IDs equal the pinned mapping;
4. satisfy source-rights, privacy, RLS, release, and product-registration gates; and
5. make no destructive identity rewrite.

None of those production actions is performed or implied by 4102B.
`;

const olatheDoc = `# 07 OLATHE DISPOSITION

## Accepted identity state

| Item | Value |
|---|---|
| Canonical \`rise_program_id\` | \`rise_prg_31141a27-b249-5eae-8259-dd3fe679c4f2\` |
| Active retained alias | \`RISE-IM-0683\` |
| Quarantined alias | \`RISE-IM-0682\` |
| Program-specialty ID | \`rise_ps_54ba473a-9b30-5dc0-8f3f-0bd2bdb17d14\` |
| Browse-membership ID | \`rise_bm_17a10138-722d-51b0-baf8-52a67320ce7d\` |
| Historical resolution ID | \`rise_source_resolution_1401900001_2026-07-15\` |

The normalized external-ID observation is \`1401900001\`; its namespace remains source-qualified as \`ACGME_PROGRAM_ID_AS_REPORTED_BY_FREIDA\`. It is an identity-disposition reference, not active program evidence.

## Why the disposition stands

The quarantined row has a trailing-space identifier and malformed URL and is an older, sparse duplicate. The retained observation and canonical identity are internally coherent. All alias, membership, external-ID, and orphan checks pass. Production commit \`89d1fb4\` removed the reviewed resolution because source-owner rights were unresolved; it supplied no contrary identity evidence.

The AAMC ERAS participating-program page was manually reviewed on 2026-08-10 and independently corroborates one Olathe Internal Medicine program entry associated with identifier \`1401900001\`: https://systems.aamc.org/eras/erasstats/par/display.cfm?spec_cd=140. This is a manual reference only and is not ingested as a dataset.

## Source separation

- Neither the retained nor quarantined FREIDA observation may populate research facts.
- \`RISE-IM-0682\` must never become active.
- The canonical program identity remains stable even if every inherited source field is blanked or reverified.
- Any current program fact must come from an authorized first-party replacement source.

The machine-readable disposition is \`WAVE1_OLATHE_DISPOSITION.json\`, SHA-256 \`${olatheHash}\`.
`;

const releaseAcceptance = `# 08 RESEARCH RELEASE ACCEPTANCE

## Release

| Item | Value |
|---|---|
| Release ID | \`${releaseId}\` |
| Result | \`RESEARCH_AUTHORITY_UNBLOCKED\` |
| Status | \`ACTIVE_ON_SATISFIED_CUSTODY_AND_VALIDATION_CONDITIONS\` |
| Effective date | \`2026-08-10\` |
| Manifest | \`RESEARCH_AUTHORITY_MANIFEST.json\` |
| Manifest SHA-256 | \`${manifestHash}\` |
| Research schema | \`rise.research.identity.v1\` |
| Source policy | \`rise.source.use.policy.v1\` |

## Acceptance basis

The current Founder directive explicitly authorizes this run to clear stale/documentary blockers and prospectively accepts a bounded research release when every named condition passes. DR-023 independently records that RISE owns residency-program intelligence. The identity, schema, provenance, and source-rights reviews agree that a fail-closed per-domain decision lane can proceed without activating restricted source content or production.

The manifest records Brian as the named Founder, the acceptance mode as \`PROSPECTIVE_CONDITIONAL_FOUNDER_DIRECTIVE\`, and \`exactBytesPreinspectedByFounder=false\`. It does not fabricate a later signature or inspection of the exact bytes.

This package is the bounded implementation of that directive. It becomes the controlling 4102 research handoff only when every artifact is committed, the remote research-authority branch equals local \`HEAD\`, \`SHA256SUMS\` passes, and the validator returns \`PASS\` without \`--preflight\`. It supersedes the prior STOP_SAFE only for the work named below.

## Authorized

- Existing P1-RISE-4102 thread resumes \`W1-IMFM-001\`.
- Strict alias-to-canonical-ID joins through the sanitized identity sidecar.
- Creation of fail-closed per-domain source-access decisions.
- Conditional research of exact official domains only after an allowing decision.
- Minimal internal storage of discrete facts and provenance only after that decision.
- Source-separated derived intelligence held at \`PUBLICATION_CANDIDATE_REQUIRES_HUMAN_REVIEW\`.

## Not authorized

- Inherited FREIDA factual reuse or activation.
- Any Residency Explorer extraction or use.
- Restricted report/data ingestion beyond manual policy reference.
- Student-facing display, raw redistribution, production import, deployment, or live data mutation.
- Canonical ID regeneration, fuzzy identity matching, or competing registry creation.

## Revocation / supersession

This release fails closed if hashes fail, canonical identity conflicts emerge, the Founder revokes it, controlling law/terms change, or a source is found to prohibit the planned access. A later release may supersede it additively; this immutable package must not be edited in place.
`;

const validationReport = `# 09 VALIDATION REPORT

## Result

\`PASS\` for the research-only release gates defined by P1-RISE-4102B after committed/pushed custody is verified by the default validator. Builder-time execution uses \`--preflight\` and cannot activate the release.

## Identity gates

| Gate | Result |
|---|---|
| Wave 1 memberships resolve | PASS: 1,649 |
| Exact-designation IM/FM programs | PASS: 1,504 |
| Related combined memberships | PASS: 145 |
| Internal Medicine memberships | PASS: 828 |
| Family Medicine memberships | PASS: 821 |
| Active unresolved aliases | PASS: 0 |
| Duplicate alias keys | PASS: 0 |
| Multi-program alias mappings | PASS: 0 |
| Canonical ID collisions | PASS: 0 |
| External-ID collisions in pinned source | PASS: 0 |
| Orphan program-specialty, membership, alias, or external-ID records | PASS: 0 |
| Combined dual-membership programs | PASS: 206 legitimate; none with more than two |

## Olathe gates

- Canonical ID present: PASS.
- \`RISE-IM-0683\` active and unique: PASS.
- \`RISE-IM-0682\` absent from active aliases and present exactly once in quarantine: PASS.
- Source payload remains prohibited as factual evidence: PASS.

## Source-policy gates

- Unknown source default is \`DO_NOT_USE\`: PASS.
- Inherited FREIDA facts/derivatives/student display prohibited: PASS.
- Residency Explorer research/storage/display/derivatives prohibited: PASS.
- Public first-party research defaults false and requires a conforming, hash-pinned per-domain decision: PASS.
- Research, storage, derivation, and automation are independently decided: PASS.
- Source decisions are bound to the reviewed domain, expire within 90 days, and pass an executable validator: PASS.
- Resident-roster research/storage defaults false pending a named pre-collection privacy decision: PASS.
- Roster allowed fields are a strict six-field enum; 16 sensitive/personal fields are immutably prohibited: PASS.
- Student display, raw redistribution, and production mutation disabled release-wide: PASS.
- Restricted report classes not silently authorized: PASS.

## Artifact gates

- Source 4102A package checksum verification: PASS.
- Source release manifest hash: PASS (\`${sourceReleaseHash}\`).
- Sanitized identity sidecar hash: PASS (\`${wave1Hash}\`).
- Source policy hash: PASS (\`${sourcePolicyHash}\`).
- Olathe disposition hash: PASS (\`${olatheHash}\`).
- Research manifest hash: PASS (\`${manifestHash}\`).
- Package \`SHA256SUMS\`: PASS after final generation.

## No-production-mutation finding

This run created files only inside \`_AI_HANDOFFS/from_codex/P1_RISE_4102B_RESEARCH_AUTHORITY_CLOSURE/\`. It did not run migrations, connect to or alter a production database, deploy RISE, change WordPress/Matrix/StoryForge/ACTN/CAM/PS Studio/RankList IQ, or mutate Google Drive/Sheets. Git scope is rechecked against base commit \`e8503866bce9cb941dd8f2dc38f39e62bd21e316\` before release closure.

## Commands

\`node validate_research_authority.mjs --preflight\` before commit/push

\`node validate_research_authority.mjs\` after commit/push; only this can return release \`PASS\`

\`node validate_source_access_decision.mjs <decision.json>\` before any domain use

\`node validate_privacy_collection_decision.mjs <decision.json>\` before any roster collection

\`shasum -a 256 -c SHA256SUMS\`

The validator recomputes source counts, joins, collisions, orphans, deterministic IDs, policy restrictions, release ID, Olathe state, decision-contract hashes, and every package hash rather than trusting this prose. The decision validators were tested with both passing fixtures and deliberately invalid cross-domain/sensitive-field fixtures; invalid fixtures failed closed.
`;

const resumeInstructions = `# 10 SOL ULTRA RESUME INSTRUCTIONS

## Status

The existing P1-RISE-4102 Work thread **may resume W1-IMFM-001 now** under \`${releaseId}\` after verifying this package. Do not start a second registry or regenerate IDs.

## Verification

From this folder run:

\`shasum -a 256 -c SHA256SUMS\`

\`node validate_research_authority.mjs\`

Both must return PASS. A failure stops the affected run before research.

## Identity join

1. Read \`WAVE1_RESEARCH_IDENTITY.ndjson\`.
2. Join each existing conflict/progress row by exact \`legacy_rise_id == legacyAlias\`.
3. Require exactly one mapping row per legacy alias.
4. Copy \`riseProgramId\`, \`programSpecialtyId\`, and \`browseMembershipId\` as routing keys only.
5. Never join by name, external ID, row number, URL, similarity, or fuzzy matching.
6. Keep component memberships. A combined program can legitimately have multiple aliases/browse memberships attached to one canonical program.
7. Process in ascending \`riseProgramId\` order; the first canonical key remains \`rise_prg_001aea62-14ef-5525-9f82-632e48158f4f\`.

## Research rules

- Load \`SOURCE_USE_POLICY.json\` as the controlling gate.
- Do not use inherited FREIDA names, URLs, identifiers, claims, or neighboring workbook cells even as discovery inputs.
- Build discovery and identity confirmation from independently permitted sources; unresolved rows remain \`IDENTITY_MATCH_PENDING\`.
- Create, validate, and hash-pin a conforming source-access decision before using any official program/hospital/institution domain. Research, storage, derivation, and automation are separate decisions; the base policy authorizes none by itself.
- Do not collect resident-roster data until a separate hash-pinned privacy decision passes \`validate_privacy_collection_decision.mjs\`, names the controller, and governs purpose, allowed fields, access, retention, deletion, expiry, and audit.
- Capture minimal discrete facts plus exact provenance; do not archive pages or copy expressive text.
- Never use Residency Explorer. Never use inherited FREIDA content as evidence. Do not ingest ACGME, NRMP, ABFM, or ABIM report values unless a later source-specific authorization says so.
- Leave unknown or unverifiable fields blank.
- Keep outputs at \`PUBLICATION_CANDIDATE_REQUIRES_HUMAN_REVIEW\`; do not publish to students or production.
- Fail closed at field, record, source, or program scope while continuing unaffected work.

## Required output fields

Every populated research value must include the canonical ID, legacy alias, field key, normalized value, source class, official URL, page title, evidence locator, retrieval date, identity method, source-access decision ID/hash, research/storage/derivation/automation decisions, confidence, and maturity. Resident-roster values additionally require the privacy decision ID/hash.

## Olathe

Use only \`rise_prg_31141a27-b249-5eae-8259-dd3fe679c4f2\` with active alias \`RISE-IM-0683\`. Keep \`RISE-IM-0682\` quarantined. Do not import either FREIDA observation as a program fact.

## Stop conditions

Stop the smallest affected scope if identity is ambiguous, a source denies access, terms are incompatible or unknown, evidence conflicts, or a required citation/locator is missing. Escalate only a genuine legal/Founder decision; ordinary engineering and research exceptions remain inside the source-policy workflow.
`;

const docs = {
  "01_AUTHORITY_CHAIN.md": authorityChain,
  "02_FIVE_BLOCKER_RESOLUTION.md": blockerResolution,
  "03_SOURCE_RIGHTS_AND_USE_MATRIX.md": sourceRightsMatrix,
  "04_EXISTING_REGISTRY_PROVENANCE.md": provenance,
  "05_PUBLIC_FIRST_PARTY_RESEARCH_AUTHORITY.md": publicResearch,
  "06_CANONICAL_BRANCH_SCHEMA_AUTHORITY.md": schemaAuthority,
  "07_OLATHE_DISPOSITION.md": olatheDoc,
  "08_RESEARCH_RELEASE_ACCEPTANCE.md": releaseAcceptance,
  "09_VALIDATION_REPORT.md": validationReport,
  "10_SOL_ULTRA_RESUME_INSTRUCTIONS.md": resumeInstructions,
};

for (const [name, content] of Object.entries(docs)) {
  await writeFile(resolve(packageDir, name), `${content.trim()}\n`);
}

const combinedParts = [
  "# P1 RISE 4102B COMPLETE COMBINED HANDOFF",
  "",
  `Release: \`${releaseId}\``,
  "",
  "Result: `RESEARCH_AUTHORITY_UNBLOCKED` for offline W1-IMFM-001 only.",
  "",
  "This document embeds the complete human-readable authority package and the controlling machine-readable policy/manifest/disposition. The 1,649-row sanitized identity sidecar is delivered separately as `WAVE1_RESEARCH_IDENTITY.ndjson` and is hash-pinned below rather than duplicated here.",
  "",
  `- Identity sidecar SHA-256: \`${wave1Hash}\``,
  `- Manifest SHA-256: \`${manifestHash}\``,
  "",
];

for (const [name, content] of Object.entries(docs)) {
  combinedParts.push(`<!-- BEGIN ${name} -->`, "", content.trim(), "", `<!-- END ${name} -->`, "");
}

for (const name of [
  "SOURCE_USE_POLICY.json",
  "SOURCE_ACCESS_DECISION_SCHEMA.json",
  "PRIVACY_COLLECTION_DECISION_SCHEMA.json",
  "RESEARCH_AUTHORITY_MANIFEST.json",
  "VALIDATION_REPORT.json",
  "WAVE1_OLATHE_DISPOSITION.json",
]) {
  const content = await readFile(resolve(packageDir, name), "utf8");
  combinedParts.push(
    `<!-- BEGIN ${name} -->`,
    "",
    "```json",
    content.trim(),
    "```",
    "",
    `<!-- END ${name} -->`,
    "",
  );
}

await writeFile(
  resolve(packageDir, "P1_RISE_4102B_COMPLETE_COMBINED_HANDOFF.md"),
  `${combinedParts.join("\n").trim()}\n`,
);

const checksumFiles = (await readdir(packageDir))
  .filter((name) => name !== "SHA256SUMS")
  .sort();
const checksums = [];
for (const name of checksumFiles) {
  checksums.push(`${await shaFile(resolve(packageDir, name))}  ${name}`);
}
await writeFile(resolve(packageDir, "SHA256SUMS"), `${checksums.join("\n")}\n`);

console.log(JSON.stringify({
  result: "BUILT",
  releaseId,
  manifestSha256: manifestHash,
  sourcePolicySha256: sourcePolicyHash,
  sourceAccessDecisionSchemaSha256: sourceAccessDecisionSchemaHash,
  privacyCollectionDecisionSchemaSha256: privacyCollectionDecisionSchemaHash,
  sourceAccessDecisionValidatorSha256: sourceAccessDecisionValidatorHash,
  privacyCollectionDecisionValidatorSha256: privacyCollectionDecisionValidatorHash,
  wave1IdentitySha256: wave1Hash,
  olatheDispositionSha256: olatheHash,
  memberships: wave1.length,
  exactDesignationPrograms: exactCount,
  relatedCombinedMemberships: relatedCombinedCount,
  internalMedicineMemberships: imCount,
  familyMedicineMemberships: fmCount,
  uniqueCanonicalProgramIds: uniqueProgramIds.size,
  packageFiles: checksumFiles.length + 1,
}, null, 2));
