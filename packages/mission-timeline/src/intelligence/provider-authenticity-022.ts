import { createHmac, timingSafeEqual } from "node:crypto";
import type { TimelineDocument } from "../contracts/types.js";
import { clone, sha256, stableStringify } from "../core/canonical.js";
import { qualitySourceSha022 } from "../admin/quality-fingerprint.js";
import { isTransportProviderReceipt } from "./provider-receipt.js";
import { canonicalServerQuality022 } from './server-quality-022.js';

type JsonObject = Record<string, unknown>;
export type ProviderWorkflow022 = "CV" | "GUARDIAN" | "RESCUE";
export interface ProviderAuthenticity022 {
  version: "d1-provider-authenticity-022.1";
  keyId: string;
  workflow: ProviderWorkflow022;
  documentId: string;
  ownerPrincipalId: string;
  sourceObjectId: string | null;
  sourceSha256: string;
  issuedAt: string;
  resultSha256: string;
  payload: JsonObject;
  signature: string;
  /** Recreated after verification; this unsigned convenience marker grants nothing. */
  serverVerified: true;
}
const object = (value: unknown): JsonObject => value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
const HASH = /^[a-f0-9]{64}$/;
const DOMAIN = "missionmed.timeline.provider-authenticity.022\0";
const MAX_PAYLOAD_BYTES = 1_500_000;

/** Uses an existing server-only key with domain separation. No credential is sent
 * to a browser, persisted in a document, or derived from client-authored data. */
export class ProviderAuthenticityService022 {
  constructor(private readonly activeKeyId: string, private readonly keys: ReadonlyMap<string, Uint8Array>, private readonly clock = () => new Date()) {
    if (!keys.get(activeKeyId) || keys.get(activeKeyId)!.byteLength < 32) throw new Error("PROVIDER_AUTHENTICITY_KEY_INVALID");
  }

  sign(document: TimelineDocument, workflow: ProviderWorkflow022, result: object, source?: { objectId: string; sha256: string }): ProviderAuthenticity022 | null {
    const raw = result as JsonObject;
    if (!isTransportProviderReceipt(raw.providerReceipt) || !raw.providerReceipt.responseId || !raw.providerReceipt.model
        || raw.status !== "COMPLETE" || raw.mode !== "SERVER_AI") return null;
    if (workflow !== "GUARDIAN" && (!source?.objectId || !HASH.test(source.sha256))) return null;
    const payload = clone(raw);
    delete payload.providerAuthenticity;
    const serialized = stableStringify(payload);
    if (Buffer.byteLength(serialized) > MAX_PAYLOAD_BYTES) return null;
    const body = {
      version: "d1-provider-authenticity-022.1" as const, keyId: this.activeKeyId, workflow,
      documentId: document.id, ownerPrincipalId: document.studentOwnerId,
      sourceObjectId: workflow === "GUARDIAN" ? null : source!.objectId,
      sourceSha256: workflow === "GUARDIAN" ? qualitySourceSha022(document) : source!.sha256,
      issuedAt: this.clock().toISOString(), resultSha256: sha256(serialized), payload,
    };
    return { ...body, signature: this.mac(body, this.keys.get(this.activeKeyId)!), serverVerified: true };
  }

  verify(document: Pick<TimelineDocument, "id" | "studentOwnerId"> & Record<string, unknown>, workflow: ProviderWorkflow022, value: unknown): ProviderAuthenticity022 | null {
    const candidate = object(value);
    if (candidate.version !== "d1-provider-authenticity-022.1" || candidate.workflow !== workflow
        || candidate.documentId !== document.id || candidate.ownerPrincipalId !== document.studentOwnerId
        || typeof candidate.keyId !== "string" || !HASH.test(String(candidate.signature)) || !HASH.test(String(candidate.sourceSha256))) return null;
    const key = this.keys.get(candidate.keyId);
    if (!key || !Number.isFinite(Date.parse(String(candidate.issuedAt))) || Date.parse(String(candidate.issuedAt)) > this.clock().getTime() + 5000) return null;
    const payload = object(candidate.payload);
    const serialized = stableStringify(payload);
    if (Buffer.byteLength(serialized) > MAX_PAYLOAD_BYTES || sha256(serialized) !== candidate.resultSha256) return null;
    if (workflow === "GUARDIAN" ? candidate.sourceObjectId !== null || candidate.sourceSha256 !== qualitySourceSha022(document)
      : typeof candidate.sourceObjectId !== "string" || !candidate.sourceObjectId) return null;
    const body = {
      version: candidate.version, keyId: candidate.keyId, workflow: candidate.workflow,
      documentId: candidate.documentId, ownerPrincipalId: candidate.ownerPrincipalId,
      sourceObjectId: candidate.sourceObjectId, sourceSha256: candidate.sourceSha256,
      issuedAt: candidate.issuedAt, resultSha256: candidate.resultSha256, payload,
    };
    const expected = Buffer.from(this.mac(body, key), "hex");
    const actual = Buffer.from(String(candidate.signature), "hex");
    if (actual.byteLength !== expected.byteLength || !timingSafeEqual(actual, expected)) return null;
    return { ...clone(body), signature: String(candidate.signature), serverVerified: true } as ProviderAuthenticity022;
  }

  private mac(body: object, key: Uint8Array): string {
    return createHmac("sha256", key).update(DOMAIN).update(stableStringify(body)).digest("hex");
  }
}

/** Every persisted receipt is untrusted input, including a previously stored
 * serverVerified flag. Authentic analyses remain separate from student edits. */
export function sanitizeProviderMetadata022(document: TimelineDocument, authority?: ProviderAuthenticityService022): TimelineDocument {
  const source = clone(document);
  function visit(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== "object") return value;
    const input = object(value);
    const candidate = object(input.providerAuthenticity);
    const workflow = candidate.workflow;
    const verified = authority && ["CV", "GUARDIAN", "RESCUE"].includes(String(workflow))
      ? authority.verify(source, workflow as ProviderWorkflow022, candidate) : null;
    const output: JsonObject = {};
    for (const [key, item] of Object.entries(input)) {
      if (["providerAuthenticity", "providerReceipt", "founderStandardProvenance", "serverVerified"].includes(key)) continue;
      output[key] = visit(item);
    }
    if (verified) {
      output.providerAuthenticity = verified;
      output.providerReceipt = clone(verified.payload.providerReceipt);
      if (verified.payload.founderStandardProvenance) output.founderStandardProvenance = clone(verified.payload.founderStandardProvenance);
    } else if (input.providerReceipt || input.providerAuthenticity || input.intelligenceMode === "SERVER_AI" || input.mode === "SERVER_AI") {
      if (output.intelligenceMode === "SERVER_AI") output.intelligenceMode = "LOCAL_LIMITED";
      if (output.mode === "SERVER_AI") output.mode = "LOCAL_LIMITED";
      if (output.status === "COMPLETE") output.status = "UNAVAILABLE";
      delete output.provider; delete output.model;
    }
    return output;
  }
  const sanitized = visit(source) as TimelineDocument;
  const metadata = object(sanitized.metadata);
  const envelope = authority?.verify(source, "GUARDIAN", object(object(object(source.metadata).qualityReport022).ai).providerAuthenticity);
  delete metadata.qualityReport022;
  delete metadata.qualitySummary022;
  if (envelope && envelope.payload.serverQuality) {
    const report = clone(object(envelope.payload.serverQuality));
    const ai = { ...object(report.ai), providerAuthenticity: envelope, providerReceipt: clone(envelope.payload.providerReceipt) };
    report.ai = ai;
    metadata.qualityReport022 = report;
    metadata.qualitySummary022 = {
      checkedAt: envelope.issuedAt, sourceSha256: envelope.sourceSha256,
      issueCount: Number(report.findingCount) || 0, exportReady: report.exportReady === true,
      aiReview: true, serverVerified: true,
    };
  } else {
    const report=canonicalServerQuality022(sanitized);
    metadata.qualityReport022=report;
    metadata.qualitySummary022={checkedAt:new Date().toISOString(),sourceSha256:qualitySourceSha022(sanitized),
      issueCount:Number(report.findingCount)||0,exportReady:report.exportReady===true,
      aiReview:false,serverVerified:true,basis:'MISSIONMED_RULE'};
  }
  sanitized.metadata = metadata;
  return sanitized;
}
