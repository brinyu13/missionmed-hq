import assert from "node:assert/strict";
import test from "node:test";
import {
  assertUniqueExternalIdentifiers,
  canonicalProgramSpecialtyIdentity,
  programIdentity,
  programSpecialtyIdentity,
} from "../src/identity.mjs";

test("program identity is independent of row order and display-name changes", () => {
  const source = ["1400000001", "1400000002", "1400000003"];
  const first = new Map(source.map((externalId) => [externalId, programIdentity(externalId).id]));
  const reorderedAndRenamed = [...source].reverse().map((externalId) => ({
    externalId,
    ignoredDisplayName: `Renamed ${externalId}`,
    id: programIdentity(externalId).id,
  }));
  for (const record of reorderedAndRenamed) assert.equal(record.id, first.get(record.externalId));
});

test("canonical ACGME identities use their own namespace and remain specialty-specific", () => {
  const im = canonicalProgramSpecialtyIdentity("1400000001", "Internal Medicine");
  const prelim = canonicalProgramSpecialtyIdentity("1400000001", "Preliminary Medicine");
  assert.equal(im.program.acgmeId, "1400000001");
  assert.match(im.program.externalKey, /^ACGME_PROGRAM:/);
  assert.equal(im.program.id, prelim.program.id);
  assert.notEqual(im.id, prelim.id);
});

test("program-specialty identity distinguishes exact combined intent", () => {
  const programId = programIdentity("1400000001").id;
  const categorical = programSpecialtyIdentity(programId, "Internal Medicine").id;
  const combined = programSpecialtyIdentity(programId, "Internal Medicine/Pediatrics").id;
  assert.notEqual(categorical, combined);
});

test("external identifier collisions fail closed", () => {
  assert.throws(() => assertUniqueExternalIdentifiers([
    { namespace: "FREIDA_PROGRAM", value: "1400000001", programId: "rise_prg_one" },
    { namespace: "FREIDA_PROGRAM", value: "1400000001", programId: "rise_prg_two" },
  ]), (error) => error.code === "RISE_IDENTITY_COLLISION");
});
