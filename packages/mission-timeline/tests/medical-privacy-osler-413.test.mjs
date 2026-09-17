import assert from "node:assert/strict";
import test from "node:test";

import { buildCandidates } from "../web/js/ingestion/candidate-builder.js";
import { classifyEvent } from "../web/js/ingestion/event-classifier.js";
import { resetCandidateRelations } from "../web/js/ingestion/ingestion-state.js";
import { detectPrivacy } from "../web/js/ingestion/privacy-detector.js";
import { eventsForScope } from "../web/js/export/timeline-canvas-renderer.js";

const sourceDocument = {
  id: "source_osler_413",
  fileName: "deidentified-osler-fixture.pdf",
  detectedType: "CV",
  effectiveType: "CV",
  userDeclaredType: null,
  extractionMethod: "TEXT_LAYER",
  parserVersion: "413-osler-test",
};

function sourceRecord(title, overrides = {}) {
  const index = String(title).replace(/\W+/g, "-").toLowerCase();
  const block = {
    id: `block-${index}`,
    pageId: "page-osler-1",
    pageNumber: 1,
    section: overrides.section ?? "experiences",
    text: overrides.rawText ?? title,
  };
  return {
    title,
    organization: "",
    location: "",
    description: "",
    section: "experiences",
    dates: "January 2024",
    pageNumber: 1,
    rawText: title,
    sourceBlocks: [block],
    ...overrides,
  };
}

function buildCandidate(title, overrides = {}) {
  return buildCandidates([sourceRecord(title, overrides)], sourceDocument)[0];
}

function browserEvent(candidate) {
  return {
    id: `event-${candidate.id}`,
    title: candidate.title,
    categoryId: candidate.categoryId,
    startDate: candidate.startDate,
    endDate: candidate.endDate,
    visibilityState: candidate.visibilityRecommendation,
  };
}

test("Osler ECFMG polarity probes fail closed while explicit completed wording remains recognized", () => {
  const nonFinal = [
    "Not yet ECFMG-certified",
    "ECFMG certification pending",
    "Provisional ECFMG certificate",
    "ECFMG certificate expired",
    "ECFMG Pathway approved",
  ];
  for (const title of nonFinal) {
    const classified = classifyEvent(sourceRecord(title), {});
    assert.equal(classified.canonicalType, "UNCLASSIFIED", title);
    assert.ok(classified.warnings.some((warning) => /human review|must not be treated/i.test(warning)), title);

    const candidate = buildCandidate(title);
    assert.equal(candidate.canonicalType, "UNCLASSIFIED", title);
    assert.equal(candidate.confidence.level, "NEEDS_REVIEW", title);
    assert.equal(candidate.safeToBulkAccept, false, title);
  }

  for (const title of ["ECFMG Certified", "Received my ECFMG certification", "ECFMG certification completed"]) {
    const candidate = buildCandidate(title);
    assert.equal(candidate.canonicalType, "ECFMG_CERTIFICATION", title);
    assert.notEqual(candidate.confidence.level, "NEEDS_REVIEW", title);
  }
});

test("Osler USCE probes reject negation and prose state-code collisions", () => {
  const adversarial = [
    sourceRecord("No USCE experience"),
    sourceRecord("CLINICAL ROTATION IN NIGERIA"),
    sourceRecord("Clinical Rotation", { description: "Worked in ICU AND OR", location: "Lagos, Nigeria" }),
  ];
  for (const record of adversarial) {
    const candidate = buildCandidates([record], sourceDocument)[0];
    assert.equal(candidate.canonicalType, "UNCLASSIFIED", record.title);
    assert.equal(candidate.confidence.level, "NEEDS_REVIEW", record.title);
    assert.equal(candidate.safeToBulkAccept, false, record.title);
    assert.ok(candidate.warnings.some((warning) => /USCE|clinical experience/i.test(warning)), record.title);
  }
});

test("explicit positive USCE or structured US location remains classifiable with whole-word subtype matching", () => {
  const controls = [
    [sourceRecord("USCE Internal Medicine Rotation", { location: "Newark, NJ" }), "USCE_TEACHING_HOSPITAL", "th"],
    [sourceRecord("Clinical Rotation", { location: "Newark, NJ" }), "USCE_TEACHING_HOSPITAL", "th"],
    [sourceRecord("USCE outpatient clinic", { location: "Newark, NJ" }), "USCE_CLINIC", "cl"],
    [sourceRecord("Clinical Rotation", { description: "Clinical education", location: "Newark, NJ" }), "USCE_TEACHING_HOSPITAL", "th"],
  ];
  for (const [record, canonicalType, categoryId] of controls) {
    const candidate = buildCandidates([record], sourceDocument)[0];
    assert.equal(candidate.canonicalType, canonicalType, record.title);
    assert.equal(candidate.categoryId, categoryId, record.title);
  }
});

test("personal and sensitive context is private by default through candidate and browser projection", () => {
  const records = [
    sourceRecord("Pregnancy and family transition"),
    sourceRecord("Raising Daughter"),
    sourceRecord("Parental leave"),
    sourceRecord("Mental health leave"),
    sourceRecord("Spouse caregiving"),
    sourceRecord("Private timeline context", { section: "personal" }),
  ];

  for (const record of records) {
    const candidate = buildCandidates([record], sourceDocument)[0];
    assert.equal(candidate.privacy.sensitive, true, record.title);
    assert.equal(candidate.privacy.requiresExplicitDisclosure, true, record.title);
    assert.equal(candidate.visibilityRecommendation, "ADVISOR_ONLY", record.title);
    assert.equal(candidate.candidateKind, "PRIVACY", record.title);
    assert.equal(candidate.confidence.level, "NEEDS_REVIEW", record.title);
    assert.equal(candidate.safeToBulkAccept, false, record.title);
    assert.deepEqual(eventsForScope({ events: [browserEvent(candidate)] }, "INTERVIEWER_SAFE"), [], record.title);
  }
});

test("personal taxonomy remains private and non-bulk-safe even if lexical flags are absent", () => {
  const candidate = buildCandidate("Private timeline context", { section: "personal" });
  assert.equal(candidate.canonicalType, "PERSONAL_NOT_ON_CV");
  assert.equal(candidate.privacy.privateByTaxonomy, true);

  candidate.privacy = { sensitive: false, requiresExplicitDisclosure: false };
  candidate.confidence = { ...candidate.confidence, level: "HIGH" };
  candidate.reviewStatus = "PENDING";
  resetCandidateRelations(candidate);
  assert.equal(candidate.candidateKind, "PRIVACY");
  assert.equal(candidate.safeToBulkAccept, false);
});

test("Family Medicine is not itself a privacy trigger", () => {
  const record = sourceRecord("Family Medicine Clinical Rotation", { location: "Newark, NJ" });
  const privacy = detectPrivacy(record);
  const candidate = buildCandidates([record], sourceDocument)[0];
  assert.equal(privacy.sensitive, false);
  assert.equal(candidate.canonicalType, "USCE_CLINIC");
  assert.equal(candidate.privacy.sensitive, false);
});
