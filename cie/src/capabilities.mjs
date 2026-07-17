import { immutableCopy } from "./canonical.mjs";
import { invariant } from "./errors.mjs";

const entries = [
  { capability_key: "mentor_manual_opportunity", phase: "C0", activation_state: "ACTIVE", accepted_writes: true, implementation_ref: "cie.service.createOpportunity", provider_ref: null },
  { capability_key: "transcript_generation", phase: "FUTURE", activation_state: "INACTIVE", accepted_writes: false, implementation_ref: null, provider_ref: null },
  { capability_key: "storyforge_linkage", phase: "FUTURE", activation_state: "INACTIVE", accepted_writes: false, implementation_ref: null, provider_ref: null },
  { capability_key: "polar_ingestion", phase: "FUTURE", activation_state: "INACTIVE", accepted_writes: false, implementation_ref: null, provider_ref: null },
  { capability_key: "mode_pack_registry", phase: "FUTURE", activation_state: "INACTIVE", accepted_writes: false, implementation_ref: null, provider_ref: null },
  { capability_key: "wordpress_skill_sync", phase: "C1", activation_state: "INACTIVE", accepted_writes: false, implementation_ref: null, provider_ref: null },
  { capability_key: "ai_opportunity_source", phase: "RESEARCH", activation_state: "INACTIVE", accepted_writes: false, implementation_ref: null, provider_ref: null },
  { capability_key: "voice_persona_provider", phase: "RESEARCH", activation_state: "INACTIVE", accepted_writes: false, implementation_ref: null, provider_ref: null }
].map((entry) => ({
  contract_version: "cie.capability-registry-entry.v1",
  input_schema_ref: null,
  output_schema_ref: null,
  consent_purpose: null,
  deletion_class: "BLOCK_COMPLETE_WHEN_NONEMPTY",
  unlock_evidence: entry.activation_state === "ACTIVE" ? "Y1-CIE-C0-0001" : null,
  ...entry
}));

export const CAPABILITY_REGISTRY = immutableCopy(entries);

export function getCapability(key) {
  return CAPABILITY_REGISTRY.find((entry) => entry.capability_key === key) || null;
}

export function requireActiveCapability(key) {
  const entry = getCapability(key);
  invariant(entry && entry.activation_state === "ACTIVE" && entry.accepted_writes === true, 409, "CAPABILITY_INACTIVE", "Capability is not active in C0");
  return entry;
}
