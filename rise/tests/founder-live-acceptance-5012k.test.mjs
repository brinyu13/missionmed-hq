import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadNormalizedHydrationPackage } from "../adapters/normalized-hydration-package-ingest.mjs";
import { buildFilterIntelligence } from "../src/filter-intelligence.mjs";
import { REVIEW_RULE_VERSION, reviewResearchCorpus } from "../src/research-review.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE = path.join(ROOT, "config/research-packages/tx-fl-adult-neurology-2026-09-12.v1");
const REGISTRY = path.join(ROOT, "releases/student-rights-safe/api-index.json");

test("5012K keeps one explicit Program Director for all 34 normalized programs", async () => {
  const loaded = await loadNormalizedHydrationPackage(PACKAGE, { registryPath: REGISTRY });
  const review = reviewResearchCorpus(loaded.ingests, { resolvedAcgmeIds: new Set(loaded.summary.acgmeIds) });
  const leadership = review.promotions.filter((promotion) => promotion.field === "research.leadership");
  assert.equal(REVIEW_RULE_VERSION, "5012k.1");
  assert.equal(leadership.length, 34);
  for (const promotion of leadership) {
    const directors = promotion.canonicalValue.filter((person) => person.roleCategory === "PROGRAM_DIRECTOR");
    assert.equal(directors.length, 1, `${promotion.acgmeId} must have one canonical Program Director`);
    assert.ok(directors[0].name);
  }
  assert.equal(leadership.find((item) => item.acgmeId === "1804800006").canonicalValue
    .find((person) => person.roleCategory === "PROGRAM_DIRECTOR").name, "Haseeb Abdul Rahman");
  assert.equal(leadership.find((item) => item.acgmeId === "1804811109").canonicalValue
    .find((person) => person.roleCategory === "PROGRAM_DIRECTOR").name, "Chilvana Patel");
});

test("5012K exposes researched-not-public roster truth in compact live cards", async () => {
  const [loaded, registry] = await Promise.all([
    loadNormalizedHydrationPackage(PACKAGE, { registryPath: REGISTRY }),
    fs.readFile(REGISTRY, "utf8").then(JSON.parse),
  ]);
  const review = reviewResearchCorpus(loaded.ingests, { resolvedAcgmeIds: new Set(loaded.summary.acgmeIds) });
  const acgmeId = "1804800006";
  const program = registry.programs.find((item) => item.identifiers?.some((id) => id.namespace === "ACGME_PROGRAM" && id.value === acgmeId));
  const facts = review.promotions.filter((item) => item.acgmeId === acgmeId).map((item) => ({
    subjectId: program.id, acgmeId, field: item.field, canonicalValue: item.canonicalValue,
  }));
  const result = buildFilterIntelligence([program], { currentFacts: facts });
  assert.ok(!result.records[0].application.roster.total);
  assert.match(result.records[0].application.roster.absence, /residents identifiable by name/i);
  assert.doesNotMatch(result.records[0].application.roster.absence, /not yet researched/i);
});

test("5012K keeps Step 2 timing, preference, unpublished, and conflict states distinct", async () => {
  const [loaded, registry] = await Promise.all([
    loadNormalizedHydrationPackage(PACKAGE, { registryPath: REGISTRY }),
    fs.readFile(REGISTRY, "utf8").then(JSON.parse),
  ]);
  const review = reviewResearchCorpus(loaded.ingests, { resolvedAcgmeIds: new Set(loaded.summary.acgmeIds) });
  const wanted = new Set(loaded.summary.acgmeIds);
  const programs = registry.programs.filter((program) => program.identifiers?.some((id) => id.namespace === "ACGME_PROGRAM" && wanted.has(id.value)));
  const byAcgme = new Map(programs.map((program) => [program.identifiers.find((id) => id.namespace === "ACGME_PROGRAM").value, program]));
  const facts = review.promotions.map((item) => ({
    subjectId: byAcgme.get(item.acgmeId).id,
    acgmeId: item.acgmeId,
    field: item.field,
    canonicalValue: item.canonicalValue,
  }));
  const records = buildFilterIntelligence(programs, { currentFacts: facts }).records;
  const count = (key) => records.filter((record) => record.application.exams[key] === true).length;
  assert.equal(count("step2NoPublishedInitialReviewBarrier"), 8);
  assert.equal(count("step2RequiredBeforeRanking"), 6);
  assert.equal(count("step2TimingConflict"), 9);
  assert.equal(count("step2TimingNotPublished"), 5);
  assert.equal(count("step2RequiredBeforeStart"), 3);
  assert.equal(count("step2RequiredForInterview"), 3);
});

test("5012K makes applicant-first filter order the DOM and accessibility order", async () => {
  const appSource = await fs.readFile(path.join(ROOT, "web/app.js"), "utf8");
  const order = [
    "'.filterComposition'",
    "'.filterExams'",
    "'.filterGraduation'",
    "'.filterVisa'",
    "'.filterResidentEvidence'",
    "'.advancedFilters'",
  ];
  let previous = -1;
  for (const selector of order) {
    const offset = appSource.indexOf(selector, appSource.indexOf("const drawer = dw.querySelector"));
    assert.ok(offset > previous, `${selector} must follow the applicant-first DOM order`);
    previous = offset;
  }
  assert.match(appSource, /drawer\.append\(section\)/);
});

test("5012K gives long At a Glance evidence proportional desktop width", async () => {
  const styles = await fs.readFile(path.join(ROOT, "web/styles.css"), "utf8");
  assert.match(styles, /\.atGlanceGrid\{grid-template-columns:repeat\(12,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.atGlanceGrid>div:nth-child\(6\)\{grid-column:span 8\}/);
  assert.match(styles, /@media\(max-width:700px\)[^}]*[\s\S]*?\.atGlanceGrid>div,\.atGlanceGrid>div:nth-child\(6\)\{grid-column:1\/-1\}/);
});
