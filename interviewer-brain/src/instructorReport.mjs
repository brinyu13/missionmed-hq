import { contentHash, deepFreeze } from "./canonical.mjs";
import { invariant } from "./errors.mjs";

const DECISION_EVENTS = new Set(["interviewer.turn.decided", "session.reconnected"]);

export function buildInstructorReview(session) {
  invariant(session && typeof session === "object", "INSTRUCTOR_REVIEW_SESSION_REQUIRED", "Session is required");
  invariant(Array.isArray(session.events) && Array.isArray(session.revisions) && session.revisions.length > 0, "INSTRUCTOR_REVIEW_SESSION_INVALID", "Session evidence is incomplete");

  const groundingCatalog = new Map();
  for (const event of session.events) {
    for (const ref of event.payload?.grounding_refs ?? []) groundingCatalog.set(ref.grounding_id, ref);
  }
  const turns = session.events.filter((event) => DECISION_EVENTS.has(event.event_type)).map((event) => ({
    at: event.emitted_at,
    event_sequence: event.sequence,
    answer: event.payload.turn.text,
    move: event.payload.decision.move,
    interviewer_utterance: event.payload.decision.utterance,
    evidence: event.payload.decision.grounding_ref_ids.map((id) => groundingCatalog.get(id)).filter(Boolean).map((ref) => ({
      grounding_id: ref.grounding_id,
      quote: ref.span.quote,
      source_kind: ref.source_kind,
    })),
    policy_rule: event.payload.decision.policy_rule,
    rationale_tags: event.payload.decision.instructor_rationale_tags,
    possible_inconsistency_refs: event.payload.decision.possible_inconsistency_ref_ids,
    guardrails: event.payload.decision.guardrails,
    uncertainty: event.payload.decision.decision_uncertainty,
  }));
  const latest = session.revisions.at(-1);
  const report = {
    contract_version: "missionmed.instructor-review.phase0.v1",
    session_id: session.session_id,
    generated_from_event_count: session.events.length,
    persona_ref: latest.persona_ref,
    plan_ref: latest.plan_ref,
    policy_ref: latest.policy_ref,
    model_ref: latest.model_ref,
    turns,
    unresolved_threads: latest.threads.filter((thread) => thread.status === "OPEN"),
    possible_inconsistencies: latest.possible_inconsistencies,
    reconnect_epoch: latest.reconnect_epoch,
    contains_private_chain_of_thought: false,
  };
  return deepFreeze({ ...report, content_hash: contentHash(report) });
}
