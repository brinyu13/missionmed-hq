import assert from "node:assert/strict";
import test from "node:test";
import { classifySourceUrls, normalizeMedicalSchool, reviewResearchCorpus } from "../src/research-review.mjs";

function claim(id, field, value, urls = ["https://hospital.example/medical-education"]) {
  return { id, field, value, provider: "PARALLEL", sourceUrls: urls, directSourceUrls: urls };
}

test("review factory assigns one final disposition and supersedes weaker scalar claims", () => {
  const result = reviewResearchCorpus([{ acgmeId: "1400000000", claims: [
    claim("a", "research.visa", { j1: "YES", h1b: "NO" }),
    { ...claim("b", "research.visa", { j1: "YES", h1b: "UNKNOWN" }), directSourceUrls: [] },
    claim("c", "research.abim", { pass_rate: "UNKNOWN_AFTER_RECOVERY_SEARCH" }, ["https://www.abim.org/report"]),
  ] }]);
  assert.equal(result.decisions.length, 3);
  assert.equal(result.decisions.filter((item) => item.disposition === "APPROVED_CURRENT").length, 1);
  assert.equal(result.decisions.filter((item) => item.disposition === "SUPERSEDED").length, 1);
  assert.equal(result.decisions.filter((item) => item.disposition === "RESEARCHED_NOT_FOUND").length, 1);
  assert.equal(Object.values(result.dispositions).reduce((sum, value) => sum + value, 0), 3);
});

test("roster promotions merge source-linked rows and normalize only safe school aliases", () => {
  const result = reviewResearchCorpus([{ acgmeId: "1400000000", claims: [
    claim("a", "research.resident_roster", [{ name: "Resident A", medical_school: "SGU", degree: "MD", classification: "IMG" }]),
    claim("b", "research.resident_roster", [{ name: "Resident B", medical_school: "Unknown ABC", degree: "DO", classification: "US_DO" }]),
  ] }]);
  assert.equal(result.promotions[0].canonicalValue.length, 2);
  assert.equal(result.promotions[0].canonicalValue[0].medical_school || result.promotions[0].canonicalValue[1].medical_school, "St. George's University School of Medicine");
  assert.equal(normalizeMedicalSchool("Unknown ABC").canonical, "Unknown ABC");
  assert.equal(classifySourceUrls(["https://www.abim.org/x", "https://www.doximity.com/x"]).reference.length, 1);
});

test("protected TX and FL Child Neurology holdouts fail closed", () => {
  assert.throws(() => reviewResearchCorpus([{ acgmeId: "1851113100", claims: [claim("a", "research.visa", { j1: "YES" })] }]), /Protected 5012A canary/);
});
