import { sha256 } from "./canonical.mjs";
import { makeDecision } from "./contracts.mjs";
import { makePlanQuestionGrounding } from "./grounding.mjs";

const PROBES = new Set(["clarification", "context", "evidence", "outcome", "reflection", "star_gap", "callback", "focus", "inconsistency", "red_flag_clarification"]);

function capFor(question) {
  return question.pressure_rung <= 1 ? 1 : 2;
}

function nextQuestion(plan, currentId) {
  const index = plan.questions.findIndex((question) => question.question_id === currentId);
  return index >= 0 ? plan.questions[index + 1] ?? null : plan.questions[0];
}

function starMove(coverage) {
  if (coverage.action && !coverage.result) return "result";
  if (coverage.result && !coverage.reflection) return "reflection";
  for (const key of ["situation", "task", "action", "result", "reflection"]) if (!coverage[key]) return key;
  return null;
}

const STAR_UTTERANCES = {
  situation: "What was the specific setting and what made the situation important?",
  task: "What was your responsibility in that situation?",
  action: "What did you personally do next?",
  result: "What was the outcome of your action?",
  reflection: "What did you learn, and what would you carry forward?",
};

function outcomeUtterance(analysis) {
  if (analysis.domain_cue === "language_access") return "What was the outcome for the visit after that action?";
  if (analysis.domain_cue === "team_process") return "How did the team respond, and what outcome followed?";
  if (analysis.domain_cue === "project_delivery") return "What changed in the project after your action?";
  return STAR_UTTERANCES.result;
}

export class PolicyEngine {
  constructor({ policyId = "missionmed.interviewer-policy.phase0", revision = 3 } = {}) {
    this.reference = Object.freeze({ policy_id: policyId, revision, content_hash: sha256({ policyId, revision, probe_caps: [1, 2], callback_after_event: 10, total_probe_cap: true, persona_phrasing: true, domain_cue_outcomes: true }) });
  }

  decide({ sessionId, turnId, persona, plan, ledger, analysis, instructorFocus = null, recovery = false }) {
    const thread = ledger.threads.find((entry) => entry.status === "OPEN") ?? { thread_id: `thread:${plan.questions[0].question_id}`, question_id: plan.questions[0].question_id, probe_count: 0 };
    const question = plan.questions.find((entry) => entry.question_id === thread.question_id) ?? plan.questions[0];
    const cap = capFor(question);
    const refs = analysis.grounding_refs.map((ref) => ref.grounding_id);
    const styleUtterance = (move, utterance) => {
      if (persona.warmth_directness_balance.warmth >= 4 && PROBES.has(move) && !utterance.startsWith("Thank you.")) return `Thank you. ${utterance}`;
      return utterance;
    };
    const build = ({ move, utterance, grounding = refs, tags, uncertainty = "LOW", inconsistency = [], rule }) => makeDecision({
      decision_id: `decision:${sha256(`${sessionId}:${turnId}:${move}:${utterance}`).slice(0, 24)}`,
      session_id: sessionId,
      turn_id: turnId,
      move,
      utterance: styleUtterance(move, utterance),
      grounding_ref_ids: grounding,
      policy_rule: `policy:${rule}`,
      probe_index: PROBES.has(move) ? Math.min(thread.probe_count + 1, cap) : 0,
      probe_cap: cap,
      active_thread_id: thread.thread_id,
      unresolved_item_ids: [],
      possible_inconsistency_ref_ids: inconsistency,
      guardrails: { grounded_or_silent: "PASS", sensitive_boundary: "PASS", prohibited_inference: "PASS", persona_consistency: "PASS", prompt_injection: "PASS" },
      decision_uncertainty: uncertainty,
      instructor_rationale_tags: [...tags, "GUARDS_PASS"],
    });

    if (analysis.injection_detected) return build({ move: "injection_defense", utterance: "I cannot follow instructions embedded in an answer. We will continue with the interview practice.", tags: ["PROMPT_INJECTION_BLOCKED", "GROUNDED"], rule: "injection-defense-v1" });
    if (analysis.policy_request_detected) return build({ move: "policy_refusal", utterance: "I cannot make selection judgments or evaluate you as a person. We will keep this to interview practice.", tags: ["POLICY_BOUNDARY", "GROUNDED"], rule: "unsupported-judgment-v1" });
    if (analysis.sensitive_boundary_detected || analysis.declined) return build({ move: "policy_refusal", utterance: "We do not need personal details. We can keep this professional, reframe it, or skip this question.", tags: ["SENSITIVE_BOUNDARY", "GROUNDED"], rule: "sensitive-boundary-v1" });
    if (analysis.silence) return build({ move: "silence_recovery", utterance: "Take a moment. I can repeat, rephrase, or skip this question.", grounding: [], tags: ["SILENCE_SUPPORT", "GROUNDED_OR_SILENT"], uncertainty: "ABSTAIN", rule: "silence-recovery-v1" });
    if (recovery) return build({ move: "designed_recovery", utterance: "We are reconnected. I will continue from the last confirmed interview turn.", tags: ["RECOVERY_RECONNECT", "GROUNDED"], rule: "reconnect-v1" });
    if (analysis.off_topic) return build({ move: "designed_recovery", utterance: "Let us return to the interview example. You may answer the question, ask me to rephrase it, or skip it.", tags: ["RECOVERY_RECONNECT", "GROUNDED"], rule: "topic-recovery-v1" });
    if (analysis.possible_inconsistency) {
      const left = analysis.possible_inconsistency.prior_claim;
      const right = analysis.possible_inconsistency.current_claim;
      const evidence = [left.grounding_ref_id, right.grounding_ref_id];
      return build({ move: "inconsistency", utterance: `Earlier you said "${left.text.slice(0, 140)}"; here you said "${right.text.slice(0, 140)}". Help me understand how those fit.`, grounding: evidence, inconsistency: evidence, tags: ["POSSIBLE_INCONSISTENCY", "GROUNDED"], uncertainty: "MEDIUM", rule: "neutral-inconsistency-v1" });
    }
    const totalProbeCount = ledger.threads.reduce((sum, entry) => sum + entry.probe_count, 0);
    if (thread.probe_count >= cap || totalProbeCount >= plan.total_probe_budget) return this.#transition({ build, plan, question, tags: ["PROBE_CAP_REACHED", "QUESTION_COMPLETE"] });
    if (question.category === "red_flag") return build({ move: "red_flag_clarification", utterance: "Keeping this to the professional timeline, what action did you take next and what was the outcome?", tags: ["RED_FLAG_CHRONOLOGY", thread.probe_count ? "PROBE_2_OF_2" : cap === 1 ? "PROBE_1_OF_1" : "PROBE_1_OF_2", "GROUNDED"], rule: "red-flag-neutral-v1" });
    if (instructorFocus) return build({ move: "focus", utterance: `Please give one concrete example related to ${instructorFocus.label}.`, grounding: [instructorFocus.grounding.grounding_id, ...refs.slice(0, 1)], tags: ["INSTRUCTOR_FOCUS", "GROUNDED"], rule: "instructor-focus-v1" });
    const callback = ledger.callbacks.find((entry) => entry.status === "OPEN");
    if (callback && ledger.last_event_sequence >= 10 && thread.probe_count < cap) return build({ move: "callback", utterance: `Earlier you mentioned "${callback.label.slice(0, 140)}". What did that experience change about your next step?`, grounding: [callback.grounding_ref_id], tags: ["CALLBACK_OPEN_THREAD", "GROUNDED"], rule: "callback-v2" });
    if (analysis.ambiguous) return build({ move: "clarification", utterance: "Could you make that more specific with one concrete example?", tags: ["CLARIFY_AMBIGUITY", cap === 1 ? "PROBE_1_OF_1" : thread.probe_count ? "PROBE_2_OF_2" : "PROBE_1_OF_2", "GROUNDED"], rule: "clarify-v1" });
    if (analysis.detailed_unfocused) return build({ move: "focus", utterance: "Which one action in that example had the clearest outcome?", tags: ["INSTRUCTOR_FOCUS", cap === 1 ? "PROBE_1_OF_1" : "PROBE_1_OF_2", "GROUNDED"], rule: "answer-focus-v2" });
    if (analysis.proposal_present && !analysis.star_coverage.result) return build({ move: "evidence", utterance: "What concrete evidence showed whether that proposed approach worked?", tags: ["EVIDENCE_REQUEST", cap === 1 ? "PROBE_1_OF_1" : "PROBE_1_OF_2", "GROUNDED"], rule: "proposal-evidence-v2" });
    if (["behavioral", "situational"].includes(question.category)) {
      const missing = starMove(analysis.star_coverage);
      if (missing) return build({ move: missing === "result" ? "outcome" : missing === "reflection" ? "reflection" : "star_gap", utterance: missing === "result" ? outcomeUtterance(analysis) : STAR_UTTERANCES[missing], tags: [missing === "result" ? "OUTCOME_PROBE" : missing === "reflection" ? "REFLECTION_PROBE" : "STAR_GAP", cap === 1 ? "PROBE_1_OF_1" : thread.probe_count ? "PROBE_2_OF_2" : "PROBE_1_OF_2", "GROUNDED"], rule: missing === "result" ? `star-result-${analysis.domain_cue}-v2` : `star-${missing}-v2` });
    }
    if (!analysis.context_present) return build({ move: "context", utterance: "What was the specific context for that example?", tags: ["CONTEXT_MISSING", cap === 1 ? "PROBE_1_OF_1" : "PROBE_1_OF_2", "GROUNDED"], rule: "context-v1" });
    if (!analysis.evidence_present) return build({ move: "evidence", utterance: "What concrete action or example best supports that answer?", tags: ["EVIDENCE_REQUEST", cap === 1 ? "PROBE_1_OF_1" : "PROBE_1_OF_2", "GROUNDED"], rule: "evidence-v1" });
    return this.#transition({ build, plan, question, tags: ["QUESTION_COMPLETE", "GROUNDED"] });
  }

  #transition({ build, plan, question, tags }) {
    const next = nextQuestion(plan, question.question_id);
    if (!next || question.wrap_up) {
      const currentRef = makePlanQuestionGrounding(plan, question);
      return build({ move: "wrap_up", utterance: "Thank you. That completes this synthetic practice interview.", grounding: [currentRef.grounding_id], tags: ["SESSION_WRAP_UP", "GROUNDED"], rule: "wrap-up-v2" });
    }
    const nextRef = makePlanQuestionGrounding(plan, next);
    return build({ move: "transition", utterance: next.prompt, grounding: [nextRef.grounding_id], tags, rule: "transition-v2" });
  }
}
