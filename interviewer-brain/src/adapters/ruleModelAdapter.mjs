import { sha256 } from "../canonical.mjs";
import { makeGroundingRef, sealContent, validateModelAdapterDescriptor, VERSIONS } from "../contracts.mjs";
import { invariant } from "../errors.mjs";

const INJECTION = /\b(?:ignore (?:all |the )?(?:previous|prior|system|developer) instructions?|disregard (?:the )?(?:policy|instructions?)|begin override|expose (?:the )?(?:private reasoning|hidden prompt)|reveal (?:the )?(?:system prompt|developer message|hidden prompt|chain of thought)|jailbreak|act as an? (?:unrestricted|different) (?:assistant|system)|print (?:your )?(?:prompt|policy|secrets?))\b/i;
const POLICY_REQUEST = /\b(?:will i match|match probability|rank me|where will i rank|am i ready|residency readiness|program fit|diagnose me|assess my personality|tell me if i am (?:honest|confident|anxious|stressed))\b/i;
const SENSITIVE = /\b(?:pregnan(?:t|cy)|married|marital|children|family planning|disab(?:ility|led)|diagnosis|medical condition|mental health|religion|race|ethnicity|national origin|citizenship|immigration status|sexual orientation|gender identity|arrest|criminal history|military discharge)\b/i;
const DECLINE = /\b(?:prefer not to (?:say|answer|discuss)|skip (?:this|that)|rather not|do not want to discuss)\b/i;
const YEAR = /\b(?:19|20)\d{2}\b/g;
const NEGATED_ACTION = /\b(?:i did not|i didn't|i never)\b/i;
const POSITIVE_ACTION = /\b(?:i did|i was|i have|i led|i managed|i completed|i worked)\b/i;

const STAR_PATTERNS = {
  situation: /\b(?:when|while|during|at the time|in that setting|the situation|the context|in (?:a|the|this) (?:fictional )?(?:[a-z]+ )?(?:clinic|project|group|setting|team|rotation|hospital|program|case))\b/i,
  task: /\b(?:my task|my role|responsible for|needed to|my goal|i was asked)\b/i,
  action: /\b(?:i (?:did|asked|organized|spoke|called|created|changed|led|managed|prepared|reviewed|decided|explained|worked|apologized|followed up|mapped|built|ran|adjusted|scheduled|drafted|compared|helped|reorganized|proposed|documented|summarized|facilitated|rebuilt|added|used|checked|confirmed|sought))\b/i,
  result: /\b(?:the result|the outcome|ultimately|as a result|this led to|afterward|in the end|full agreement|rechecked|improved|resolved|reduced|increased|decreased|met the|completed the|succeeded)\b/i,
  reflection: /\b(?:i learned|i realized|next time|i would|that taught me|since then)\b/i,
};

function sentenceSpans(text) {
  const spans = [];
  const pattern = /\S(?:[\s\S]*?)(?:[.!?](?=\s|$)|$)/g;
  for (const match of text.matchAll(pattern)) {
    const leading = match[0].match(/^\s*/)?.[0].length ?? 0;
    const quote = match[0].trim();
    if (!quote) continue;
    const start = (match.index ?? 0) + leading;
    spans.push({ start, end: start + quote.length, quote });
  }
  return spans;
}

function groundingForSpan({ turnId, textHash, span, index }) {
  const groundingId = `grounding:${sha256(`${turnId}:${index}:${span.start}:${span.end}`).slice(0, 24)}`;
  return makeGroundingRef({
    grounding_id: groundingId,
    source_kind: "synthetic_answer",
    source_id: turnId,
    source_version: "1",
    source_hash: textHash,
    turn_id: turnId,
    span,
    consent_receipt_ids: [],
    authorization: { decision: "ALLOWED", basis: "synthetic_phase0" },
    untrusted_data: true,
    simulated: true,
  });
}

function overlapTokens(left, right) {
  const stop = new Set(["the", "and", "that", "this", "with", "from", "was", "were", "have", "had", "for", "but", "not", "did", "i"]);
  const words = (text) => new Set((text.toLowerCase().match(/[a-z]{3,}/g) ?? []).filter((word) => !stop.has(word)));
  const a = words(left);
  const b = words(right);
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared >= 2;
}

function findPossibleInconsistency(claims, currentClaims) {
  for (const current of currentClaims) {
    const currentYears = current.text.match(YEAR) ?? [];
    for (const prior of claims) {
      if (!overlapTokens(prior.text, current.text)) continue;
      const priorYears = prior.text.match(YEAR) ?? [];
      const yearConflict = currentYears.length > 0 && priorYears.length > 0 && currentYears.every((year) => !priorYears.includes(year));
      const polarityConflict = (NEGATED_ACTION.test(prior.text) && POSITIVE_ACTION.test(current.text)) || (POSITIVE_ACTION.test(prior.text) && NEGATED_ACTION.test(current.text));
      if (yearConflict || polarityConflict) {
        return {
          prior_claim: prior,
          current_claim: current,
          basis: yearConflict ? "CONFLICTING_YEAR" : "CONFLICTING_ACTION_POLARITY",
        };
      }
    }
  }
  return null;
}

export class RuleModelAdapter {
  #descriptor;

  constructor() {
    this.#descriptor = validateModelAdapterDescriptor(
      sealContent({
        contract_version: VERSIONS.modelAdapter,
        adapter_id: "missionmed.rule-model.phase0",
        revision: 1,
        mode: "deterministic_rule",
        network_access: false,
        provider: null,
        retention_profile: "none",
        raw_output_persisted: false,
      }),
    );
  }

  get descriptor() {
    return this.#descriptor;
  }

  analyzeTurn({ turnId, text, priorClaims = [] }) {
    invariant(typeof turnId === "string" && turnId.length >= 3, "MODEL_TURN_ID_REQUIRED", "turnId is required");
    invariant(typeof text === "string" && text.length <= 12000, "MODEL_TEXT_INVALID", "Synthetic turn text must be a string of at most 12,000 characters");
    invariant(Array.isArray(priorClaims), "MODEL_PRIOR_CLAIMS_INVALID", "priorClaims must be an array");

    const normalized = text.replace(/\r\n/g, "\n").trim();
    if (!normalized) {
      return Object.freeze({
        analysis_version: "missionmed.rule-analysis.v1",
        turn_id: turnId,
        silence: true,
        declined: false,
        injection_detected: false,
        policy_request_detected: false,
        sensitive_boundary_detected: false,
        grounding_refs: [],
        claims: [],
        star_coverage: { situation: false, task: false, action: false, result: false, reflection: false },
        context_present: false,
        evidence_present: false,
        ambiguous: false,
        possible_inconsistency: null,
      });
    }

    const textHash = sha256(normalized);
    const spans = sentenceSpans(normalized);
    const groundingRefs = spans.map((span, index) => groundingForSpan({ turnId, textHash, span, index }));
    const claims = groundingRefs.map((ref, index) => ({
      claim_id: `claim:${sha256(`${turnId}:${index}:${ref.content_hash}`).slice(0, 24)}`,
      turn_id: turnId,
      grounding_ref_id: ref.grounding_id,
      text: ref.span.quote,
      status: "ASSERTED_UNVERIFIED",
    }));
    const starCoverage = Object.fromEntries(Object.entries(STAR_PATTERNS).map(([key, pattern]) => [key, pattern.test(normalized)]));
    const evidencePresent = starCoverage.action || /\b(?:for example|specifically|such as|one example)\b/i.test(normalized);
    const contextPresent = starCoverage.situation;
    const ambiguous = normalized.length < 32 || (/\b(?:it|that|they|things|stuff|somehow)\b/i.test(normalized) && !evidencePresent && !contextPresent);
    const domainCue = /\b(?:interpreter|language line|family waiting|visit order)\b/i.test(normalized)
      ? "language_access"
      : /\b(?:team|teammate|disagreement|inclusion criteria|handoff)\b/i.test(normalized)
        ? "team_process"
        : /\b(?:schedule|deadline|project)\b/i.test(normalized)
          ? "project_delivery"
          : "general";

    return Object.freeze({
      analysis_version: "missionmed.rule-analysis.v1",
      turn_id: turnId,
      silence: false,
      declined: DECLINE.test(normalized),
      injection_detected: INJECTION.test(normalized),
      policy_request_detected: POLICY_REQUEST.test(normalized),
      sensitive_boundary_detected: SENSITIVE.test(normalized),
      grounding_refs: Object.freeze(groundingRefs),
      claims: Object.freeze(claims),
      star_coverage: Object.freeze(starCoverage),
      context_present: contextPresent,
      evidence_present: evidencePresent,
      detailed_unfocused: normalized.length >= 380,
      proposal_present: /\bi proposed\b/i.test(normalized),
      off_topic: /\b(?:cafeteria|movie instead|change the subject|unrelated topic)\b/i.test(normalized),
      domain_cue: domainCue,
      ambiguous,
      possible_inconsistency: findPossibleInconsistency(priorClaims, claims),
    });
  }
}
