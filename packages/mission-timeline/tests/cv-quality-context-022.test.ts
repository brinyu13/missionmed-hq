import assert from "node:assert/strict";
import test from "node:test";
import { buildCvQualitySuggestions } from "../src/intelligence/quality-assistant.js";
import { reviewMedicalEducationTimeline } from "../src/medical-education/reviewer.js";
import { document, event } from "./fixtures.js";

test("CV pre-apply review does not turn empty Timeline readiness into a label warning", () => {
  const draft = document({ events: [] });
  assert.deepEqual(buildCvQualitySuggestions(draft, [], [], [], new Map()), []);
  assert.ok(reviewMedicalEducationTimeline(draft).findings.some((item) => item.code === "EMPTY_TIMELINE"));
});

test("CV review retains actual existing Timeline chronology and site findings", () => {
  const draft = document({ events: [
    event({ id: "old", startDate: "2019-01", endDate: "2019-03" }),
    event({ id: "usce", title: "USCE observership", categoryId: "usce", startDate: "2024-01", endDate: "2024-03" }),
  ] });
  const suggestions = buildCvQualitySuggestions(draft, [], [], [], new Map());
  assert.ok(suggestions.some((item) => item.type === "CHRONOLOGY_REVIEW" && item.eventIds.includes("old")));
  assert.ok(suggestions.some((item) => item.reason.includes("no site or location label") && item.eventIds.includes("usce")));
});

test("CV pre-apply review preserves valid provider recommendations", () => {
  const suggestions = buildCvQualitySuggestions(document({ events: [] }), [], [{
    localId: "quality-1", type: "CATEGORY_REVIEW", severity: "REVIEW", candidateIds: [], eventIds: [], sourceBlockIds: [],
    reason: "Confirm whether this elective was a clinical rotation.", recommendation: "Review the source before choosing a category.",
  }], [], new Map());
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0]?.source, "AI_REVIEW");
  assert.equal(suggestions[0]?.type, "CATEGORY_REVIEW");
});
