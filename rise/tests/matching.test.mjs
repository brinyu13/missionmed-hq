import assert from "node:assert/strict";
import test from "node:test";
import {
  CRITERION_OUTCOMES,
  PUBLISHED_REQUIREMENT_RESULTS,
  aggregatePublishedRequirements,
  evaluateCriterion,
  rankContextualSignals,
} from "../src/matching.mjs";

const hard = (outcome, enabled = true) => ({ kind: "hard", outcome, enabled });

test("hard matching truth table fails closed", () => {
  assert.equal(
    aggregatePublishedRequirements([hard(CRITERION_OUTCOMES.SATISFIED)]),
    PUBLISHED_REQUIREMENT_RESULTS.NO_PUBLISHED_CONFLICT_OR_UNKNOWN_FOUND,
  );
  assert.equal(
    aggregatePublishedRequirements([hard(CRITERION_OUTCOMES.UNKNOWN)]),
    PUBLISHED_REQUIREMENT_RESULTS.REQUIREMENTS_INCOMPLETE,
  );
  assert.equal(
    aggregatePublishedRequirements([hard(CRITERION_OUTCOMES.SOURCE_CONFLICT)]),
    PUBLISHED_REQUIREMENT_RESULTS.REQUIREMENTS_INCOMPLETE,
  );
  assert.equal(
    aggregatePublishedRequirements([hard(CRITERION_OUTCOMES.CONDITIONAL)]),
    PUBLISHED_REQUIREMENT_RESULTS.CONDITIONAL_REVIEW,
  );
  assert.equal(
    aggregatePublishedRequirements([hard(CRITERION_OUTCOMES.SATISFIED), hard(CRITERION_OUTCOMES.CONTRADICTED)]),
    PUBLISHED_REQUIREMENT_RESULTS.PUBLISHED_REQUIREMENT_CONFLICT,
  );
  assert.equal(aggregatePublishedRequirements([hard(CRITERION_OUTCOMES.SATISFIED, false)]), PUBLISHED_REQUIREMENT_RESULTS.NOT_EVALUATED);
});

test("criterion evaluation preserves unknown and explicit contradiction", () => {
  const rule = { id: "visa", kind: "hard", operator: "contains", enabled: true };
  assert.equal(
    evaluateCriterion(rule, { state: "known", value: "J1" }, { state: "unknown", reason: "not_stated" }).outcome,
    CRITERION_OUTCOMES.UNKNOWN,
  );
  assert.equal(
    evaluateCriterion(rule, { state: "known", value: "H1B" }, { state: "known", value: ["J1"] }).outcome,
    CRITERION_OUTCOMES.CONTRADICTED,
  );
});

test("contextual ranking cannot change a hard conflict", () => {
  const hardResult = aggregatePublishedRequirements([hard(CRITERION_OUTCOMES.CONTRADICTED)]);
  assert.equal(rankContextualSignals([
    { kind: "contextual", value: 100, weight: 100 },
    { kind: "contextual", value: 95, weight: 50 },
  ]), 14750);
  assert.equal(hardResult, PUBLISHED_REQUIREMENT_RESULTS.PUBLISHED_REQUIREMENT_CONFLICT);
});
