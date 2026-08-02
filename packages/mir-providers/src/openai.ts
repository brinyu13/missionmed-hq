import type { MirProvider, MirRequest, ProviderResult } from "../../mir-core/src/index.ts";
import { OpenAICredentialResolver, type OpenAICredentialSource, type OpenAISecretProvider } from "./runtime-key-source.ts";

interface OpenAIResponse {
  id?: string;
  status?: string;
  output_text?: string;
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string; refusal?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { code?: string; message?: string };
}

export class ProviderConfigurationError extends Error {}

export class OpenAIResponsesProvider implements MirProvider {
  readonly name = "openai";
  readonly restrictedDataApproved: boolean;
  private readonly timeoutMs: number;
  private readonly credentials: OpenAICredentialResolver;
  constructor(env: NodeJS.ProcessEnv = process.env, private readonly fetcher: typeof fetch = fetch, secretProvider?: OpenAISecretProvider) {
    this.credentials = new OpenAICredentialResolver(env, secretProvider);
    this.timeoutMs = Number(env.MIR_TIMEOUT_MS ?? "45000");
    this.restrictedDataApproved = env.MIR_OPENAI_RESTRICTED_DATA_APPROVED === "true";
  }

  async health() {
    const credential = await this.credentials.resolve();
    return credential.value
      ? { configured: true, detail: "configured" }
      : { configured: false, detail: "credential health unavailable" };
  }

  async credentialSource(): Promise<OpenAICredentialSource> {
    return (await this.credentials.resolve()).source;
  }

  async invoke(request: MirRequest, model: string): Promise<ProviderResult> {
    const credential = await this.credentials.resolve();
    if (!credential.value) throw new ProviderConfigurationError("OPENAI_CREDENTIAL_HEALTH_ERROR");
    const started = Date.now();
    const wrappedInput = request.input as { payload?: unknown; reasoningEffort?: string };
    const response = await this.fetcher("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: { "authorization": `Bearer ${credential.value}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        store: false,
        instructions: request.instructions,
        input: JSON.stringify(wrappedInput.payload ?? request.input),
        max_output_tokens: request.maxOutputTokens,
        reasoning: wrappedInput.reasoningEffort ? { effort: wrappedInput.reasoningEffort } : undefined,
        safety_identifier: request.context.userId,
        text: { format: { type: "json_schema", name: request.output.name, strict: true, schema: request.output.schema } },
      }),
    });
    const body = await response.json() as OpenAIResponse;
    if (!response.ok) throw new Error(`OPENAI_REQUEST_FAILED:${response.status}:${body.error?.code ?? "unknown"}`);
    if (body.status === "incomplete") throw new Error("OPENAI_RESPONSE_INCOMPLETE");
    const refusal = body.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "refusal");
    if (refusal) throw new Error("OPENAI_RESPONSE_REFUSED");
    const text = body.output_text ?? body.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
    if (!text) throw new Error("OPENAI_OUTPUT_TEXT_MISSING");
    return {
      provider: this.name, model, payload: JSON.parse(text),
      inputTokens: body.usage?.input_tokens ?? 0, outputTokens: body.usage?.output_tokens ?? 0,
      latencyMs: Date.now() - started, httpStatus: response.status, providerRequestId: body.id,
    };
  }
}
