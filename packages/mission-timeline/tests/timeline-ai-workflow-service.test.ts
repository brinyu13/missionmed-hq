import assert from "node:assert/strict";
import test from "node:test";

import { OpenAiTimelineWorkflowProvider } from "../src/intelligence/openai-timeline-ai-workflows.js";
import { TimelineAiWorkflowService } from "../src/intelligence/timeline-ai-workflow-service.js";
import type { TimelineAiWorkflowProvider } from "../src/intelligence/timeline-ai-workflow-provider.js";
import { document, otherStudent, student } from "./fixtures.js";

function provider(): TimelineAiWorkflowProvider {
  return {
    descriptor: { provider: "test-ai", model: "missionmed-test-model" },
    async analyzeQuality() {
      return {
        findings: [
          {
            id: "provider-layout",
            category: "LAYOUT",
            code: "RESTORE_BACKGROUND",
            severity: "REVIEW",
            basis: "PRESENTATION_RECOMMENDATION",
            elementIds: [],
            message: "The canonical background is missing.",
            recommendation: "Restore the protected MissionMed background.",
            confidence: 0.98,
            actionMode: "FIX_FOR_ME",
            fixKind: "RESTORE_THEME_BACKGROUND",
          },
          {
            id: "unsafe-factual-fix",
            category: "CHRONOLOGY",
            code: "CHANGE_DATE",
            severity: "REVIEW",
            basis: "AI_INFERENCE",
            elementIds: [],
            message: "Change the date.",
            recommendation: "Guess a better date.",
            confidence: 0.7,
            actionMode: "FIX_FOR_ME",
            fixKind: "RESTORE_THEME_BACKGROUND",
          },
        ],
        unresolvedQuestions: ["Confirm the ambiguous activity date."],
      };
    },
    async observeRescue() {
      return {
        observations: [{ id: "visible-1", pageOrSlide: 1, text: "2019 Research", geometry: { x: 0.1, y: 0.2, width: 0.3, height: 0.1, unit: "NORMALIZED" }, confidence: 0.97 }],
        unresolvedQuestions: [],
      };
    },
  };
}

test("Quality Guardian server AI is owner-only, standard-versioned, and rejects factual auto-fixes", async () => {
  const service = new TimelineAiWorkflowService(provider(), [student.principalId]);
  const response = await service.analyzeQuality(student, document(), [], true);
  assert.equal(response.status, "COMPLETE");
  assert.equal(response.mode, "SERVER_AI");
  assert.equal(response.provider, "test-ai");
  assert.equal(response.standardVersion, "D1-409H-A1+D1-411A");
  assert.equal(response.findings.length, 1);
  assert.equal(response.findings[0]!.fixKind, "RESTORE_THEME_BACKGROUND");
  assert.match(response.unresolvedQuestions[0]!, /ambiguous activity date/i);
  await assert.rejects(service.analyzeQuality(otherStudent, document(), [], true), (error: { code?: string }) => error.code === "TIMELINE_QUALITY_OWNER_REQUIRED");
});

test("an unavailable provider returns the required truthful state and no canned AI findings", async () => {
  const response = await new TimelineAiWorkflowService(null, [student.principalId]).analyzeQuality(student, document(), [], true);
  assert.equal(response.status, "AI_UNAVAILABLE");
  assert.equal(response.mode, "UNAVAILABLE");
  assert.deepEqual(response.findings, []);
  assert.match(response.unavailableMessage!, /temporarily unavailable/i);
});

test("Rescue observations use the same owner-only provider and never become auto-accepted facts", async () => {
  const response = await new TimelineAiWorkflowService(provider(), [student.principalId]).observeRescue(student, document(), {
    artifactSha256: "a".repeat(64),
    format: "IMAGE",
    pageOrSlideCount: 1,
    objects: [],
    image: { mimeType: "image/png", bytes: new Uint8Array([137, 80, 78, 71]) },
  }, true);
  assert.equal(response.mode, "SERVER_AI");
  assert.equal(response.observations.length, 1);
  assert.equal(response.observations[0]!.text, "2019 Research");
});

test("real-student principals and unmarked requests fail before any provider call", async () => {
  let calls = 0;
  const counted = provider();
  const guarded: TimelineAiWorkflowProvider = {
    ...counted,
    async analyzeQuality(input, signal) { calls += 1; return counted.analyzeQuality(input, signal); },
    async observeRescue(input, signal) { calls += 1; return counted.observeRescue(input, signal); },
  };
  const service = new TimelineAiWorkflowService(guarded, [student.principalId]);
  await assert.rejects(service.analyzeQuality(student, document()), (error: { code?: string }) => error.code === "TIMELINE_AI_SYNTHETIC_PRINCIPAL_REQUIRED");
  await assert.rejects(
    new TimelineAiWorkflowService(guarded, ["different-principal"]).analyzeQuality(student, document(), [], true),
    (error: { code?: string }) => error.code === "TIMELINE_AI_SYNTHETIC_PRINCIPAL_REQUIRED",
  );
  assert.equal(calls, 0);
});

test("OpenAI workflow adapter uses strict non-retained server-side structured requests", async () => {
  let captured: RequestInit | undefined;
  const adapter = new OpenAiTimelineWorkflowProvider({
    apiKey: "server-only-test-key-0123456789",
    model: "gpt-test-pinned",
    fetchImpl: async (_input, init) => {
      captured = init;
      return new Response(JSON.stringify({
        output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ findings: [], unresolvedQuestions: [] }) }] }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  await adapter.analyzeQuality({
    documentId: "timeline_test",
    documentRevision: 1,
    events: [],
    presentation: { theme: "default", backgroundKind: null, advancedObjectCount: 0, deterministicFindings: [] },
    standard: { version: "D1-409H-A1+D1-411A", requirements: [] },
  });
  const headers = captured!.headers as Record<string, string>;
  assert.equal(headers.authorization, "Bearer server-only-test-key-0123456789");
  const payload = JSON.parse(String(captured!.body));
  assert.equal(payload.store, false);
  assert.equal(payload.text.format.type, "json_schema");
  assert.equal(payload.text.format.strict, true);
  assert.equal(payload.model, "gpt-test-pinned");
});
