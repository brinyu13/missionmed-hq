import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createCanonicalEvidenceClaim, evidencePolicyFor, knowledgeFromStaging, soap2026EvidenceClaim } from "../src/evidence.mjs";
import { programIdentity } from "../src/identity.mjs";
import {
  buildBrowseMembership,
  buildProgramSpecialty,
  specialtyIntentRelationship,
} from "../src/specialties.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const combined = JSON.parse(await fs.readFile(path.resolve(here, "../config/combined-specialties.v1.json"), "utf8"));

test("missing values and inferred visa negatives remain unknown", () => {
  assert.deepEqual(knowledgeFromStaging("H1B", ""), { state: "unknown", reason: "not_collected" });
  assert.deepEqual(knowledgeFromStaging("H1B", "No"), { state: "unknown", reason: "source_list_absence" });
  assert.deepEqual(knowledgeFromStaging("J1", "Yes"), { state: "known", value: true, explicit: true });
});

test("canonical evidence requires approval before beta exposure and SOAP wording remains historical", () => {
  assert.throws(() => createCanonicalEvidenceClaim({
    subjectId: "rise_ps_test", field: "visa", value: true, provider: "PARALLEL",
    providerRunId: "run", sourceType: "research", retrievedAt: "2026-08-29T00:00:00.000Z",
    publicationState: "STUDENT_VISIBLE", reviewState: "PENDING",
  }), /must be approved/);
  const claim = soap2026EvidenceClaim({
    programSpecialtyId: "rise_ps_test",
    sourceRow: { Available_Positions: "3", Program_Type_Full: "Categorical", NRMP_Program_Code: "9999140C0" },
    sourceLocator: "source#/rows/0",
    retrievedAt: "2026-08-29T00:00:00.000Z",
  });
  assert.equal(claim.value.wording, "SOAP 2026 - This program appeared in the 2026 SOAP results.");
  assert.match(claim.value.context, /does not predict future availability or match likelihood/);
});

test("editorial staging semantics are quarantined", () => {
  assert.equal(evidencePolicyFor("IMG Friendly Indicators").publication, "quarantined");
  assert.equal(evidencePolicyFor("Program Status").matchable, false);
  assert.equal(evidencePolicyFor("Program Name").publication, "source_attributed_snapshot");
});

test("combined pathways are one exact designation with component browse memberships", () => {
  const programId = programIdentity("7000000002").id;
  const offering = buildProgramSpecialty(programId, "Internal Medicine/Pediatrics", combined);
  assert.equal(offering.kind, "combined");
  assert.deepEqual(offering.components.map((component) => component.label), ["Internal Medicine", "Pediatrics"]);
  const imBrowse = buildBrowseMembership(offering, "Internal Medicine");
  const pedsBrowse = buildBrowseMembership(offering, "Pediatrics");
  assert.equal(imBrowse.relationship, "RELATED_COMBINED");
  assert.equal(pedsBrowse.relationship, "RELATED_COMBINED");
  assert.notEqual(imBrowse.id, pedsBrowse.id);
});

test("categorical intent never silently becomes combined intent", () => {
  const offering = buildProgramSpecialty(
    programIdentity("7000000002").id,
    "Internal Medicine/Pediatrics",
    combined,
  );
  assert.equal(specialtyIntentRelationship("Internal Medicine", offering, false), "NO_MATCH");
  assert.equal(specialtyIntentRelationship("Internal Medicine", offering, true), "RELATED_COMBINED");
});
