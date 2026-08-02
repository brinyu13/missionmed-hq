import { randomUUID } from "node:crypto";
import type { DataClass, MirRequest, PriqRole } from "../../../packages/mir-core/src/index.ts";
import type { SourceRecord } from "./domain.ts";

type AiActor = { userId: string; role: Extract<PriqRole, "founder" | "admin"> };
export type PriqAiFeature = "ask" | "public_research" | "profile" | "live_copilot" | "debrief" | "profile_lab" | "founder_note" | "video_analysis";

const stringArray = { type: "array", items: { type: "string" } };
const schemas = {
  ask: {
    type: "object" as const, additionalProperties: false, required: ["answer", "sourceIds", "limitations"],
    properties: { answer: { type: "string" }, sourceIds: stringArray, limitations: stringArray },
  },
  public_research: {
    type: "object" as const, additionalProperties: false, required: ["summary", "findings", "sourceIds", "limitations"],
    properties: { summary: { type: "string" }, findings: stringArray, sourceIds: stringArray, limitations: stringArray },
  },
  live_copilot: {
    type: "object" as const, additionalProperties: false, required: ["cues", "limitations"],
    properties: {
      cues: { type: "array", items: { type: "object", additionalProperties: false, required: ["kind", "text", "evidence"], properties: { kind: { type: "string" }, text: { type: "string" }, evidence: { type: "string" } } } },
      limitations: stringArray,
    },
  },
  debrief: {
    type: "object" as const, additionalProperties: false, required: ["strengths", "improvements", "nextPractice", "limitations"],
    properties: { strengths: stringArray, improvements: stringArray, nextPractice: stringArray, limitations: stringArray },
  },
  profile_lab: {
    type: "object" as const, additionalProperties: false, required: ["observed", "possibleRead", "alternatives", "preparation", "sourceIds", "limitations"],
    properties: { observed: stringArray, possibleRead: stringArray, alternatives: stringArray, preparation: stringArray, sourceIds: stringArray, limitations: stringArray },
  },
  founder_note: {
    type: "object" as const, additionalProperties: false, required: ["coachingUses", "forbiddenUses", "limitations"],
    properties: { coachingUses: stringArray, forbiddenUses: stringArray, limitations: stringArray },
  },
};

function sourceInput(sources: SourceRecord[]): Array<Record<string, unknown>> {
  return sources.filter((source) => source.status === "available").map(({ id, title, uri, sourceType, authority, assertions }) => ({ id, title, uri, sourceType, authority, assertions }));
}

function request(actor: AiActor, feature: PriqAiFeature, capability: MirRequest["capability"], dataClasses: DataClass[], input: unknown, schema: typeof schemas[keyof typeof schemas], maxOutputTokens: number): MirRequest {
  const policyFeature = ({ ask: "research", public_research: "research", live_copilot: "copilot", profile_lab: "lab", founder_note: "profile" } as Partial<Record<PriqAiFeature, string>>)[feature] ?? feature;
  return {
    capability,
    context: { tenantId: "missionmed-priq-dev", userId: actor.userId, role: actor.role, subjectIds: ["student:ezechiel-fenelon"], dataClasses, feature: policyFeature, requestId: randomUUID() },
    instructions: "Return only evidence-bound coaching intelligence. Separate observations from interpretations, preserve uncertainty, do not diagnose personality or infer protected traits, and do not invent sources.",
    input,
    output: { name: `priq_${feature}`, schema },
    promptVersion: `priq-${feature}-m0.75-v1`,
    maxOutputTokens,
  };
}

export function buildAskRequest(actor: AiActor, question: string, sources: SourceRecord[]): MirRequest {
  return request(actor, "ask", "extraction_fast", ["public_professional"], { question, sources: sourceInput(sources) }, schemas.ask, 500);
}

export function buildPublicResearchRequest(actor: AiActor, sources: SourceRecord[]): MirRequest {
  return request(actor, "public_research", "reasoning_high", ["public_professional"], { sources: sourceInput(sources) }, schemas.public_research, 900);
}

export function buildCopilotRequest(actor: AiActor, transcript: string, synthetic: boolean): MirRequest {
  return request(actor, "live_copilot", "live_cue_low_latency", synthetic ? ["public_professional"] : ["student_provided"], { transcript, synthetic }, schemas.live_copilot, 300);
}

export function buildDebriefRequest(actor: AiActor, evidence: Record<string, unknown>, synthetic: boolean): MirRequest {
  return request(actor, "debrief", "extraction_fast", synthetic ? ["public_professional"] : ["student_provided", "founder_private"], { ...evidence, synthetic }, schemas.debrief, 600);
}

export function buildProfileLabRequest(actor: AiActor, question: string, sources: SourceRecord[]): MirRequest {
  return request(actor, "profile_lab", "reasoning_high", ["public_professional"], { question, sources: sourceInput(sources) }, schemas.profile_lab, 700);
}

export function buildFounderNoteRequest(actor: AiActor, note: string): MirRequest {
  return request(actor, "founder_note", "reasoning_high", ["founder_private"], { note }, schemas.founder_note, 500);
}

export const aiFeatureRegistry = [
  { id: "ask", route: "/api/ai/ask", state: "wired", data: "public-professional only" },
  { id: "public_research", route: "/api/ai/research", state: "wired", data: "approved source registry" },
  { id: "profile", route: "/api/ai/profile", state: "wired", data: "draft claims; founder review required" },
  { id: "live_copilot", route: "/api/ai/copilot", state: "wired", data: "restricted unless synthetic" },
  { id: "debrief", route: "/api/ai/debrief", state: "wired", data: "restricted unless synthetic" },
  { id: "profile_lab", route: "/api/ai/profile-lab", state: "wired", data: "public-professional source registry" },
  { id: "founder_note", route: "/api/ai/founder-note", state: "wired-gated", data: "restricted and per-note opt-in" },
  { id: "video_analysis", route: "/api/ai/video-analysis", state: "adapter-blocked", data: "authorized media adapter required" },
] as const;
