import { sha256 } from "./canonical.mjs";
import { makeGroundingRef } from "./contracts.mjs";

export function makePlanQuestionGrounding(plan, question) {
  return makeGroundingRef({
    grounding_id: `grounding:${sha256(`${plan.content_hash}:${question.question_id}`).slice(0, 24)}`,
    source_kind: "synthetic_domain_pack",
    source_id: question.question_id,
    source_version: String(plan.revision),
    source_hash: sha256(question.prompt),
    turn_id: null,
    span: { start: 0, end: question.prompt.length, quote: question.prompt },
    consent_receipt_ids: [],
    authorization: { decision: "ALLOWED", basis: "synthetic_phase0" },
    untrusted_data: true,
    simulated: true,
  });
}

export function makeInstructorFocusGrounding({ focusId, text, version = "1" }) {
  return makeGroundingRef({
    grounding_id: `grounding:${sha256(`${focusId}:${version}:${text}`).slice(0, 24)}`,
    source_kind: "synthetic_instructor_focus",
    source_id: focusId,
    source_version: version,
    source_hash: sha256(text),
    turn_id: null,
    span: { start: 0, end: text.length, quote: text },
    consent_receipt_ids: [],
    authorization: { decision: "ALLOWED", basis: "synthetic_phase0" },
    untrusted_data: true,
    simulated: true,
  });
}
