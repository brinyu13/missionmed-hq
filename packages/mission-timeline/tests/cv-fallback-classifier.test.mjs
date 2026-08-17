import assert from "node:assert/strict";
import test from "node:test";

import { classifyEvent } from "../web/js/ingestion/event-classifier.js";
import { classifyHeading } from "../web/js/ingestion/section-detector.js";

test("limited local fallback keeps awards and education out of Work", () => {
  const award = classifyEvent({ title: "Dean's Award for Clinical Excellence", section: "honors" }, {});
  assert.equal(award.canonicalType, "AWARD_HONOR");
  assert.equal(award.categoryId, "education");

  const education = classifyEvent({ title: "Bachelor of Science in Biology", section: "education" }, { end: { timelineMonth: "2018-05" } });
  assert.equal(education.canonicalType, "EDUCATION");
  assert.equal(education.categoryId, "education");
});

test("research-section context wins over ambiguous fellow wording", () => {
  const research = classifyEvent({ title: "Cardiology Research Fellow", section: "research" }, { end: { timelineMonth: "2020-05" } });
  assert.equal(research.canonicalType, "RESEARCH_EXPERIENCE");
  assert.equal(research.categoryId, "res");
});

test("honors and service is a section boundary rather than inherited research", () => {
  assert.equal(classifyHeading("Honors and Service"), "honors");
});
