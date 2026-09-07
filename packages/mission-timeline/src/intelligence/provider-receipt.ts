import { createHash } from "node:crypto";

/** Transport evidence lives outside model-authored JSON and cannot be invented by it. */
export interface ProviderReceipt {
  provider: "openai";
  responseId: string | null;
  requestId: string | null;
  model: string | null;
  createdAt: number | null;
  receivedAt: string;
  store: false;
  inputSha256: string;
  outputSha256: string;
}
const receipts = new WeakMap<object, ProviderReceipt>();
const transportReceipts = new WeakSet<object>();
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
const safeId = (value: unknown) => typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,200}$/.test(value) ? value : null;

export function attachProviderReceipt<T>(result: T, response: Response, payload: Record<string, unknown>, requestBody: string, output: string): T {
  if (result && typeof result === "object") {
    const receipt = Object.freeze({
    provider: "openai", responseId: safeId(payload.id), requestId: safeId(response.headers.get("x-request-id")),
    model: safeId(payload.model), createdAt: typeof payload.created_at === "number" ? payload.created_at : null,
    receivedAt: new Date().toISOString(), store: false, inputSha256: digest(requestBody), outputSha256: digest(output),
  } satisfies ProviderReceipt);
    receipts.set(result, receipt);
    transportReceipts.add(receipt);
  }
  return result;
}
/** Only the provider transport can place an object in this process-local set. */
export function isTransportProviderReceipt(receipt: unknown): receipt is ProviderReceipt {
  return Boolean(receipt && typeof receipt === "object" && transportReceipts.has(receipt));
}
export function getProviderReceipt(result: unknown): ProviderReceipt | undefined {
  return result && typeof result === "object" ? receipts.get(result) : undefined;
}
