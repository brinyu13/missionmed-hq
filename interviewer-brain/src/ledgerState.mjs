import { sealContent, VERSIONS } from "./contracts.mjs";

export function initialLedgerState({ sessionId, personaRef, planRef, policyRef, modelRef, firstQuestionId }) {
  return sealContent({
    contract_version: VERSIONS.ledger,
    session_id: sessionId,
    revision: 1,
    last_event_sequence: 1,
    previous_revision_hash: null,
    reconnect_epoch: 0,
    persona_ref: personaRef,
    plan_ref: planRef,
    policy_ref: policyRef,
    model_ref: modelRef,
    claims: [], topics: [{ topic_id: firstQuestionId, label: firstQuestionId, status: "OPEN" }], callbacks: [],
    threads: [{ thread_id: `thread:${firstQuestionId}`, question_id: firstQuestionId, probe_count: 0, status: "OPEN" }],
    possible_inconsistencies: [],
    star_coverage: { situation: false, task: false, action: false, result: false, reflection: false },
    status: "ACTIVE",
  });
}

export function reduceLedgerState({ previous, analysis, decision, plan, lastEventSequence, reconnect = false }) {
  const threads = previous.threads.map((entry) => ({ ...entry }));
  const active = threads.find((entry) => entry.status === "OPEN");
  const probing = !["transition", "wrap_up", "silence_recovery", "policy_refusal", "injection_defense", "designed_recovery"].includes(decision.move);
  if (active && probing) active.probe_count += 1;
  if (active && decision.move === "transition") {
    active.status = "CLOSED";
    const index = plan.questions.findIndex((question) => question.question_id === active.question_id);
    const next = plan.questions[index + 1];
    if (next) threads.push({ thread_id: `thread:${next.question_id}`, question_id: next.question_id, probe_count: 0, status: "OPEN" });
  }
  if (active && decision.move === "wrap_up") active.status = "CLOSED";
  const inconsistencies = [...previous.possible_inconsistencies];
  if (analysis.possible_inconsistency) inconsistencies.push({ inconsistency_id: `inconsistency:${decision.decision_id.split(":").at(-1)}`, left_grounding_ref_id: analysis.possible_inconsistency.prior_claim.grounding_ref_id, right_grounding_ref_id: analysis.possible_inconsistency.current_claim.grounding_ref_id, status: "POSSIBLE" });
  const callbacks = previous.callbacks.map((entry) => decision.move === "callback" && decision.grounding_ref_ids.includes(entry.grounding_ref_id) ? { ...entry, status: "USED" } : { ...entry });
  if (analysis.claims[0] && callbacks.length === 0) callbacks.push({ callback_id: `callback:${analysis.claims[0].claim_id.split(":").at(-1)}`, grounding_ref_id: analysis.claims[0].grounding_ref_id, label: analysis.claims[0].text.slice(0, 240), status: "OPEN" });
  return sealContent({
    ...previous,
    revision: previous.revision + 1,
    last_event_sequence: lastEventSequence,
    previous_revision_hash: previous.content_hash,
    reconnect_epoch: previous.reconnect_epoch + (reconnect ? 1 : 0),
    claims: [...previous.claims, ...analysis.claims],
    callbacks,
    threads,
    possible_inconsistencies: inconsistencies,
    star_coverage: Object.fromEntries(Object.keys(previous.star_coverage).map((key) => [key, previous.star_coverage[key] || analysis.star_coverage[key]])),
    status: decision.move === "wrap_up" ? "COMPLETE" : reconnect ? "RECOVERING" : "ACTIVE",
  });
}
