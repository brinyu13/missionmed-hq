// IVOC Application Intelligence — lane entry point (pure domain core).
// Nothing in production imports this yet; Codex wires it after reset
// (see IVOC_APPINTEL_8002_HANDOFF.md).
export * from './contracts/index.mjs';
export { intakeProjections, IntakeError, SUPPORTED_PROJECTION_TYPES } from './normalize/intake.mjs';
export {
  canonicalJson, sha256Hex, hashValue, factId, signalId, derivePackId,
  sourceReceiptFromProjection, packVersion, invalidationReasons,
} from './provenance/receipts.mjs';
export { deriveSignals, AIS_RULES_VERSION, GAP_MIN_MONTHS } from './signals/rules.mjs';
export { findInconsistencies, experienceKey } from './signals/consistency.mjs';
export { salienceFor, confidenceFor, recencyScore, programAffinity } from './signals/salience.mjs';
export { assembleContextPack, packReuseDecision } from './pack/assemble.mjs';
export { serializeForActor, redactForRole, factLine, ACTOR_RULES } from './pack/serialize.mjs';
export { buildTriggerIndex, tokenize, normalizeLexeme, lexemesFromText } from './pack/trigger-index.mjs';
export { evaluateReactiveTriggers, evaluateLiveConsistency, extractDurationMentions } from './director/triggers.mjs';
export {
  DeterministicSemanticMatcher, UnavailableSemanticMatcher, sanitizeMatcherResult, SEMANTIC_MATCHER_CONTRACT,
} from './director/semantic-matcher.mjs';
export {
  arbitrate, createMemory, applyMemoryDelta, LANE_PRIORS, PROACTIVE_SALIENCE_THRESHOLD, REACTIVE_BOOST,
} from './director/arbitrate.mjs';
