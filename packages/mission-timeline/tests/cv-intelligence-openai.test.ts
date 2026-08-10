import assert from "node:assert/strict";
import test from "node:test";

import { OpenAiCvIntelligenceProvider } from "../src/intelligence/openai-cv-intelligence.js";
import type { CvIntelligenceRequest } from "../src/intelligence/cv-intelligence-schema.js";

const request: CvIntelligenceRequest = {
  source: { objectId: "object_source_test", sha256: "a".repeat(64), mimeType: "application/pdf" },
  blocks: [{ id: "block_1", pageNumber: 1, section: "Education", text: "2018 Medical Degree" }],
  documentType: "CV",
  existingEvents: [],
  consentVersion: "d1-ux-007-ai-v1",
  idempotencyKey: "openai-provider-test",
};

test("OpenAI adapter uses server authorization, no provider storage, and strict structured output", async () => {
  let capturedUrl = "";
  let captured: RequestInit | undefined;
  const provider = new OpenAiCvIntelligenceProvider({
    apiKey: "server-only-test-key-0123456789",
    model: "gpt-test-pinned",
    fetchImpl: async (input, init) => {
      capturedUrl = String(input);
      captured = init;
      return new Response(JSON.stringify({
        output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ candidates: [], qualitySuggestions: [], unresolvedQuestions: [] }) }] }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const result = await provider.analyze(request);
  assert.deepEqual(result, { candidates: [], qualitySuggestions: [], unresolvedQuestions: [] });
  assert.equal(capturedUrl, "https://api.openai.com/v1/responses");
  const headers = captured!.headers as Record<string, string>;
  assert.equal(headers.authorization, "Bearer server-only-test-key-0123456789");
  const payload = JSON.parse(String(captured!.body));
  assert.equal(payload.store, false);
  assert.equal(payload.text.format.type, "json_schema");
  assert.equal(payload.text.format.strict, true);
  assert.equal(payload.model, "gpt-test-pinned");
  assert.equal(JSON.stringify(payload).includes("object_source_test"), false);
});
