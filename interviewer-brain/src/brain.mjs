import { sha256 } from "./canonical.mjs";
import { validateInterviewPlan, validatePersonaPack } from "./contracts.mjs";
import { makeInstructorFocusGrounding, makePlanQuestionGrounding } from "./grounding.mjs";
import { initialLedgerState, reduceLedgerState } from "./ledgerState.mjs";
import { PolicyEngine } from "./policyEngine.mjs";
import { RuleModelAdapter } from "./adapters/ruleModelAdapter.mjs";
import { InactiveAvatarAdapter, InactiveVoiceRailAdapter } from "./adapters/inactiveCapabilityAdapter.mjs";
import { invariant } from "./errors.mjs";

export class MissionMedInterviewerBrain {
  constructor({ ledger, persona, plan, policy = new PolicyEngine(), model = new RuleModelAdapter() }) {
    this.ledger = ledger; this.persona = validatePersonaPack(persona); this.plan = validateInterviewPlan(plan); this.policy = policy; this.model = model;
    invariant(this.plan.persona_ref.persona_id === this.persona.persona_id && this.plan.persona_ref.revision === this.persona.revision && this.plan.persona_ref.content_hash === this.persona.content_hash, "PLAN_PERSONA_MISMATCH", "Plan persona reference is invalid");
    this.voice = new InactiveVoiceRailAdapter(); this.avatar = new InactiveAvatarAdapter();
  }

  async startSession({ sessionId, idempotencyKey = `session-start:${sessionId}` }) {
    const personaRef = { persona_id: this.persona.persona_id, revision: this.persona.revision, content_hash: this.persona.content_hash };
    const planRef = { plan_id: this.plan.plan_id, revision: this.plan.revision, content_hash: this.plan.content_hash };
    const ledgerState = initialLedgerState({ sessionId, personaRef, planRef, policyRef: this.policy.reference, modelRef: { adapter_id: this.model.descriptor.adapter_id, revision: this.model.descriptor.revision, content_hash: this.model.descriptor.content_hash }, firstQuestionId: this.plan.questions[0].question_id });
    const session = await this.ledger.createSession({ sessionId, personaRef, planRef, policyRef: this.policy.reference, modelRef: ledgerState.model_ref, firstQuestionId: this.plan.questions[0].question_id, ledgerState, idempotencyKey });
    return { session, opening_question: this.plan.questions[0].prompt, voice: this.voice.descriptor, avatar: this.avatar.descriptor };
  }

  async processTurn({ sessionId, turnId, text, idempotencyKey, instructorFocus = null, recovery = false }) {
    const sessionBefore = this.ledger.getSession(sessionId);
    const existing = sessionBefore.events.find((event) => event.idempotency_key === idempotencyKey);
    if (existing) {
      invariant(existing.event_type !== "session.started" && existing.payload?.turn?.turn_id === turnId && existing.payload.turn.text === text && existing.event_type === (recovery ? "session.reconnected" : "interviewer.turn.decided"), "IDEMPOTENCY_CONFLICT", "Idempotency key payload conflict");
      return { decision: existing.payload.decision, ledger_revision: sessionBefore.revisions[existing.sequence - 1], event: existing };
    }
    const previous = this.ledger.getLatestRevision(sessionId);
    const analysis = this.model.analyzeTurn({ turnId, text, priorClaims: previous.claims });
    const focus = instructorFocus ? { label: instructorFocus.label, grounding: makeInstructorFocusGrounding({ focusId: instructorFocus.focus_id, text: instructorFocus.label, version: instructorFocus.version ?? "1" }) } : null;
    const decision = this.policy.decide({ sessionId, turnId, persona: this.persona, plan: this.plan, ledger: previous, analysis, instructorFocus: focus, recovery });
    const next = reduceLedgerState({ previous, analysis, decision, plan: this.plan, lastEventSequence: previous.last_event_sequence + 1, reconnect: recovery });
    const priorGroundings = sessionBefore.events.flatMap((event) => event.payload?.grounding_refs ?? []);
    const contextGroundings = [...this.plan.questions.map((question) => makePlanQuestionGrounding(this.plan, question)), ...(focus ? [focus.grounding] : [])];
    const catalog = new Map([...priorGroundings, ...analysis.grounding_refs, ...contextGroundings].map((ref) => [ref.grounding_id, ref]));
    const selectedContext = decision.grounding_ref_ids.map((id) => catalog.get(id)).filter(Boolean);
    invariant(selectedContext.length === decision.grounding_ref_ids.length, "DECISION_GROUNDING_UNRESOLVED", "Decision contains an unresolved grounding reference");
    const groundingRefs = [...new Map([...analysis.grounding_refs, ...selectedContext].map((ref) => [ref.grounding_id, ref])).values()];
    const result = await this.ledger.commit({ sessionId, expectedRevision: previous.revision, eventType: recovery ? "session.reconnected" : "interviewer.turn.decided", actor: { type: "interviewer_brain", id: "brain:phase0" }, payload: { turn: { turn_id: turnId, text, simulated: true }, configuration: { persona_ref: previous.persona_ref, plan_ref: previous.plan_ref, policy_ref: previous.policy_ref, model_ref: previous.model_ref }, grounding_refs: groundingRefs, decision }, idempotencyKey, correlationId: `correlation:${sessionId}`, causationId: null, ledgerState: next });
    return { decision, ledger_revision: next, event: result.event };
  }
}

export function deterministicClock(startIso = "2026-01-01T00:00:00.000Z", stepMs = 1) {
  let current = Date.parse(startIso);
  return () => { const value = new Date(current).toISOString(); current += stepMs; return value; };
}

export function deterministicSessionId(seed) { return `session:${sha256(seed).slice(0, 24)}`; }
