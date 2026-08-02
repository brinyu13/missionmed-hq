import { randomUUID } from "node:crypto";
import type { MirContext, MirRequest } from "../../../packages/mir-core/src/index.ts";
import type { Claim, SourceRecord } from "./domain.ts";

export const profileOutputSchema = {
  type: "object" as const,
  required: ["claims", "limitations"],
  additionalProperties: false,
  properties: {
    claims: {
      type: "array" as const,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "text", "confidence", "sourceIds"],
        properties: {
          kind: { type: "string" }, text: { type: "string" }, confidence: { type: "string", enum: ["low", "medium", "high"] },
          sourceIds: { type: "array", minItems: 1, items: { type: "string" } },
        },
      },
    },
    limitations: { type: "array" as const, items: { type: "string" } },
  },
};

export function buildProfileRequest(context: MirContext, sources: SourceRecord[]): MirRequest {
  const usable = sources.filter((source) => source.status === "available");
  if (usable.length < 3) throw new Error("PUBLIC_SOURCE_COVERAGE_INSUFFICIENT");
  return {
    capability: "reasoning_high", context, promptVersion: "priq-profile-v1.0.0", maxOutputTokens: 2400,
    instructions: [
      "Produce evidence-bound interview research claims.",
      "Do not infer protected traits, diagnose personality, or invent facts.",
      "Every claim must cite source IDs supplied in input; uncertainty must remain explicit.",
      "Bird style is optional shorthand, never a diagnosis, and must be omitted without behavioral evidence.",
    ].join(" "),
    input: { sources: usable.map(({ id, title, uri, sourceType, authority }) => ({ id, title, uri, sourceType, authority })) },
    output: { name: "priq_profile", schema: profileOutputSchema },
  };
}

export function materializeClaims(payload: unknown, sources: SourceRecord[], subjectId: string, actorId: string): Claim[] {
  const record = payload as { claims?: Array<{ kind?: unknown; text?: unknown; confidence?: unknown; sourceIds?: unknown }> };
  if (!Array.isArray(record.claims)) throw new Error("PROFILE_CLAIMS_MISSING");
  const allowed = new Set(sources.filter((source) => source.status === "available").map((source) => source.id));
  return record.claims.map((item) => {
    if (typeof item.kind !== "string" || typeof item.text !== "string" || !["low", "medium", "high"].includes(String(item.confidence))) throw new Error("PROFILE_CLAIM_INVALID");
    if (!Array.isArray(item.sourceIds) || item.sourceIds.length === 0 || item.sourceIds.some((id) => typeof id !== "string" || !allowed.has(id))) throw new Error("PROFILE_CLAIM_EVIDENCE_INVALID");
    return {
      id: randomUUID(), subjectId, kind: item.kind, text: item.text, confidence: item.confidence as Claim["confidence"],
      evidence: item.sourceIds.map((sourceId) => ({ sourceId: String(sourceId), locator: "model-selected source" })),
      status: "draft", version: 1, createdBy: actorId, createdAt: new Date().toISOString(),
    };
  });
}
