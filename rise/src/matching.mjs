export const CRITERION_OUTCOMES = Object.freeze({
  SATISFIED: "SATISFIED",
  CONTRADICTED: "CONTRADICTED",
  UNKNOWN: "UNKNOWN",
  SOURCE_CONFLICT: "SOURCE_CONFLICT",
  CONDITIONAL: "CONDITIONAL",
  NOT_APPLICABLE: "NOT_APPLICABLE",
});

export const PUBLISHED_REQUIREMENT_RESULTS = Object.freeze({
  NO_PUBLISHED_CONFLICT_OR_UNKNOWN_FOUND: "NO_PUBLISHED_CONFLICT_OR_UNKNOWN_FOUND",
  PUBLISHED_REQUIREMENT_CONFLICT: "PUBLISHED_REQUIREMENT_CONFLICT",
  CONDITIONAL_REVIEW: "CONDITIONAL_REVIEW",
  REQUIREMENTS_INCOMPLETE: "REQUIREMENTS_INCOMPLETE",
  NOT_EVALUATED: "NOT_EVALUATED",
});

export function aggregatePublishedRequirements(criteria) {
  const enabledHard = criteria.filter((criterion) => criterion.enabled !== false && criterion.kind === "hard");
  if (!enabledHard.length) return PUBLISHED_REQUIREMENT_RESULTS.NOT_EVALUATED;
  const outcomes = new Set(enabledHard.map((criterion) => criterion.outcome));
  if (outcomes.has(CRITERION_OUTCOMES.CONTRADICTED)) {
    return PUBLISHED_REQUIREMENT_RESULTS.PUBLISHED_REQUIREMENT_CONFLICT;
  }
  if (outcomes.has(CRITERION_OUTCOMES.SOURCE_CONFLICT) || outcomes.has(CRITERION_OUTCOMES.UNKNOWN)) {
    return PUBLISHED_REQUIREMENT_RESULTS.REQUIREMENTS_INCOMPLETE;
  }
  if (outcomes.has(CRITERION_OUTCOMES.CONDITIONAL)) {
    return PUBLISHED_REQUIREMENT_RESULTS.CONDITIONAL_REVIEW;
  }
  if ([...outcomes].every((outcome) =>
    outcome === CRITERION_OUTCOMES.SATISFIED || outcome === CRITERION_OUTCOMES.NOT_APPLICABLE)) {
    return PUBLISHED_REQUIREMENT_RESULTS.NO_PUBLISHED_CONFLICT_OR_UNKNOWN_FOUND;
  }
  return PUBLISHED_REQUIREMENT_RESULTS.REQUIREMENTS_INCOMPLETE;
}

export function evaluateCriterion(rule, applicantKnowledge, programKnowledge) {
  if (rule.enabled === false) return { ...rule, outcome: CRITERION_OUTCOMES.NOT_APPLICABLE };
  if (rule.modality === "conditional") return { ...rule, outcome: CRITERION_OUTCOMES.CONDITIONAL };
  if (applicantKnowledge.state === "conflict" || programKnowledge.state === "conflict") {
    return { ...rule, outcome: CRITERION_OUTCOMES.SOURCE_CONFLICT };
  }
  if (applicantKnowledge.state !== "known" || programKnowledge.state !== "known") {
    return { ...rule, outcome: CRITERION_OUTCOMES.UNKNOWN };
  }
  let satisfied = false;
  if (rule.operator === "eq") satisfied = applicantKnowledge.value === programKnowledge.value;
  else if (rule.operator === "gte") satisfied = applicantKnowledge.value >= programKnowledge.value;
  else if (rule.operator === "lte") satisfied = applicantKnowledge.value <= programKnowledge.value;
  else if (rule.operator === "contains") {
    satisfied = Array.isArray(programKnowledge.value) && programKnowledge.value.includes(applicantKnowledge.value);
  } else {
    throw new Error(`Unsupported matching operator: ${rule.operator}`);
  }
  return {
    ...rule,
    outcome: satisfied ? CRITERION_OUTCOMES.SATISFIED : CRITERION_OUTCOMES.CONTRADICTED,
  };
}

export function rankContextualSignals(signals) {
  return signals
    .filter((signal) => signal.kind === "contextual" && signal.enabled !== false)
    .reduce((score, signal) => score + Number(signal.weight ?? 0) * Number(signal.value ?? 0), 0);
}
