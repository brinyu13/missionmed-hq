import assert from "node:assert/strict";
import test from "node:test";

import {
  applicationFacetCounts,
  buildApplicationIntelligence,
  evaluateApplicationCompatibility,
  medicalSchoolCountry,
  normalizeMedicalSchoolName,
  normalizeResidentRoster,
  rosterCategory,
} from "../src/application-intelligence.mjs";

function known(value) {
  return { knowledge: { state: "known", value, explicit: true } };
}

function program(fields = {}) {
  return { programSpecialtyId: "ps-1", fields };
}

test("resident normalization uses school evidence, never a person's name, for category and country", () => {
  const rows = normalizeResidentRoster({
    pgy_1: [{ name: "A. Resident", degree: "DO", medical_school: "Lake Erie College of Osteopathic Medicine", pgy: "PGY-1" }],
    pgy_2: [{ name: "B. Resident", classification: "IMG", medical_school: "Dow Medical College, Karachi, Pakistan", pgy: "PGY-2" }],
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].category, "US_DO");
  assert.equal(rows[0].medicalSchoolCountry, "United States");
  assert.equal(rows[1].category, "IMG_NON_CARIBBEAN");
  assert.equal(rows[1].medicalSchoolCountry, "Pakistan");
  assert.equal(medicalSchoolCountry("Unidentified medical school", null, null), null);
  assert.equal(rosterCategory({ name: "India Pakistan", medical_school: "Unknown" }), "UNKNOWN");
  assert.equal(normalizeMedicalSchoolName("SGU").canonical, "st georges university school of medicine");
});

test("application intelligence combines registry and approved research conservatively", () => {
  const p = program({
    J1: known(true), H1B: known(false), "Visa Sponsorship": known("J-1 through ECFMG"),
    "Medical School Graduation Timeline": known("5 years"),
    "Gap Experience Requirement": known("US clinical experience in the US required"),
    "IMG Graduates Percent": known("32%"), "DO Graduates Percent": known("12%"),
    "IMG Step 2 Required": known(true),
  });
  const facts = [
    { field: "research.application_requirements", canonicalValue: { step2_minimum: 240, maximum_exam_attempts: 2, usce_minimum_months: 3 } },
    { field: "research.resident_roster", canonicalValue: [{ name: "Resident", classification: "IMG", medical_school: "Aga Khan University, Pakistan" }] },
    { field: "research.fellowship_inventory", canonicalValue: [{ name: "Cardiology" }, { name: "GI" }] },
  ];
  const intel = buildApplicationIntelligence(p, facts, { is_img: true, medical_school: "Aga Khan University, Pakistan", medical_school_country: "Pakistan" });
  assert.equal(intel.visa.j1, true);
  assert.equal(intel.exams.step2Minimum, 240);
  assert.equal(intel.exams.maxAttempts, 2);
  assert.equal(intel.yog.years, 5);
  assert.equal(intel.usce.minimumMonths, 3);
  assert.equal(intel.roster.sameSchoolCount, 1);
  assert.equal(intel.roster.sameCountryCount, 1);
  assert.equal(intel.fellowshipCount, 2);
});

test("compatibility labels blockers, cautions, positives, and unknowns without match odds", () => {
  const intel = buildApplicationIntelligence(program({
    J1: known(false), "Medical School Graduation Timeline": known("3 years"),
  }), [{ field: "research.application_requirements", canonicalValue: { step2_minimum: 240 } }], {});
  const result = evaluateApplicationCompatibility(intel, { step2_score: 238, graduation_year: new Date().getUTCFullYear() - 5, visa_status: "J-1 needed" });
  assert.ok(result.blockers.some((item) => item.criterion === "step2"));
  assert.ok(result.blockers.some((item) => item.criterion === "yog"));
  assert.ok(result.unknowns.some((item) => item.criterion === "visa"));
  assert.doesNotMatch(JSON.stringify(result), /probability|chance|percentile/i);
});

test("application facet counts are derived from canonical records", () => {
  const records = [
    { application: buildApplicationIntelligence(program({ "DO COMLEX Level 2 Required": known(true) }), [], {}) },
    { application: buildApplicationIntelligence(program({}), [], {}) },
  ];
  const counts = applicationFacetCounts(records);
  assert.equal(counts.comlexLevel2Accepted, 1);
  assert.equal(counts.yogNoPublishedCutoff, 2);
});
