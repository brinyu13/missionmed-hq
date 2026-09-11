import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateOpenAiResearchCost,
  createOpenAiResearchProvider,
} from "../adapters/openai-research-provider.mjs";

function fixtureResponse(acgmeId = "1854831078") {
  const text = JSON.stringify({
    program_identity: {
      acgme_id: acgmeId,
      program_name: "Fixture Child Neurology Program",
      institution: "Fixture Institution",
      specialty: "Child Neurology",
      state: "TX",
    },
    findings: [{
      field: "visa", status: "FOUND", summary: "J-1 sponsorship is published.",
      value_json: JSON.stringify({ j1: true, h1b: false }),
      source_urls: ["https://example.edu/residency/visa", "https://uncited.example/claim"],
    }],
    completion_matrix: {
      visa: { state: "VERIFIED", summary: "Official J-1 sponsorship evidence found.", source_urls: ["https://example.edu/residency/visa"] },
    },
    research_summary: "One official source-backed finding.",
  });
  return {
    id: "resp_fixture_5012e",
    usage: { input_tokens: 1000, input_tokens_details: { cached_tokens: 200 }, output_tokens: 500 },
    output: [
      { type: "web_search_call", action: { sources: [
        { url: "https://example.edu/residency/visa" },
        { url: "https://unrelated.example/reference" },
      ] } },
      { type: "message", content: [{ type: "output_text", text, annotations: [{ type: "url_citation", url: "https://example.edu/residency/visa" }] }] },
    ],
  };
}

function dossierOnlyCitationResponse() {
  const response = fixtureResponse();
  const parsed = JSON.parse(response.output[1].content[0].text);
  parsed.findings[0].source_urls = [];
  response.output[1].content[0].text = JSON.stringify(parsed);
  response.output[1].content[0].annotations = [];
  return response;
}

test("OpenAI research cost uses model token rates plus bounded web-search calls", () => {
  assert.equal(calculateOpenAiResearchCost({
    providerKey: "OPENAI_TERRA",
    usage: { input_tokens: 1000, input_tokens_details: { cached_tokens: 200 }, output_tokens: 500 },
    webSearchCalls: 1,
  }), 0.0177);
  assert.equal(calculateOpenAiResearchCost({
    providerKey: "OPENAI_SOL",
    usage: { input_tokens: 1000, input_tokens_details: { cached_tokens: 200 }, output_tokens: 500 },
    webSearchCalls: 1,
  }), 0.0233);
});

test("Terra adapter emits review-gated canonical claims and keeps only cited URLs", async () => {
  let requestBody;
  const provider = createOpenAiResearchProvider({
    providerKey: "OPENAI_TERRA",
    apiKey: "test-key",
    fetchImpl: async (_url, init) => {
      requestBody = JSON.parse(init.body);
      return new Response(JSON.stringify(fixtureResponse()), {
        status: 200, headers: { "content-type": "application/json" },
      });
    },
  });
  const result = await provider.execute({
    job: {
      jobId: "job-5012e", taskClass: "PROVIDER_BENCHMARK",
      programSpecialtyId: "rise_ps_e1ada2b6-9c76-59c0-89c9-62edf4960026",
      acgmeId: "1854831078", specialty: "Child Neurology", state: "TX",
      taskPayload: { programName: "Fixture", institution: "Fixture", officialUrls: [], requestedDomains: ["visa"], requestedFields: ["research.visa"] },
    },
  });
  assert.equal(result.providerKey, "OPENAI_TERRA");
  assert.equal(requestBody.max_output_tokens, 16000);
  assert.equal(result.findingCount, 1);
  assert.equal(result.ingest.provider, "OPENAI");
  assert.equal(result.ingest.claims[0].publicationState, "REVIEW_REQUIRED");
  assert.deepEqual(result.ingest.claims[0].sourceUrls, ["https://example.edu/residency/visa"]);
  assert.deepEqual(result.benchmarkFindings, [{
    field: "visa",
    status: "FOUND",
    summary: "J-1 sponsorship is published.",
    value: { j1: true, h1b: false },
    sourceUrls: ["https://example.edu/residency/visa"],
  }]);
  assert.deepEqual(result.benchmarkMetrics, {
    foundCount: 1,
    researchedNotFoundCount: 0,
    conflictCount: 0,
    sourceBackedCount: 1,
  });
  assert.equal(result.actualCostUsd, 0.0177);
});

test("provider identity mismatch fails closed before canonical ingestion", async () => {
  const provider = createOpenAiResearchProvider({
    providerKey: "OPENAI_SOL",
    apiKey: "test-key",
    fetchImpl: async () => new Response(JSON.stringify(fixtureResponse("1851113100")), { status: 200 }),
  });
  await assert.rejects(provider.execute({
    job: { jobId: "job", taskClass: "PROGRAM_DEEP_RESEARCH", programSpecialtyId: "ps", acgmeId: "1854831078", specialty: "Child Neurology", state: "TX", taskPayload: { requestedDomains: ["visa"], requestedFields: ["research.visa"] } },
  }), /identity mismatch/);
});

test("web-search action sources remain dossier evidence when structured JSON omits URLs", async () => {
  const provider = createOpenAiResearchProvider({
    providerKey: "OPENAI_TERRA",
    apiKey: "test-key",
    fetchImpl: async () => new Response(JSON.stringify(dossierOnlyCitationResponse()), { status: 200 }),
  });
  const result = await provider.execute({
    job: {
      jobId: "job-dossier", taskClass: "PROVIDER_BENCHMARK",
      programSpecialtyId: "rise_ps_e1ada2b6-9c76-59c0-89c9-62edf4960026",
      acgmeId: "1854831078", specialty: "Child Neurology", state: "TX",
      taskPayload: { programName: "Fixture", institution: "Fixture", officialUrls: [], requestedDomains: ["visa"], requestedFields: ["research.visa"] },
    },
  });
  assert.deepEqual(result.ingest.claims[0].directSourceUrls, []);
  assert.deepEqual(result.ingest.claims[0].dossierSourceUrls, [
    "https://example.edu/residency/visa",
    "https://unrelated.example/reference",
  ]);
  assert.deepEqual(result.ingest.claims[0].sourceUrls, [
    "https://example.edu/residency/visa",
    "https://unrelated.example/reference",
  ]);
  assert.equal(result.benchmarkMetrics.sourceBackedCount, 1);
});

test("verified roster evidence fails closed when cross-field counts disagree", async () => {
  const response = fixtureResponse();
  const parsed = JSON.parse(response.output[1].content[0].text);
  parsed.findings = [
    { field: "resident_roster", status: "FOUND", summary: "Two residents.", value_json: JSON.stringify([{ name: "A" }, { name: "B" }]), source_urls: ["https://example.edu/residency/visa"] },
    { field: "resident_medical_schools", status: "FOUND", summary: "Three schools.", value_json: JSON.stringify([{ resident: "A" }, { resident: "B" }, { resident: "C" }]), source_urls: ["https://example.edu/residency/visa"] },
  ];
  parsed.completion_matrix = {
    current_resident_roster: { state: "VERIFIED", summary: "Roster verified.", source_urls: ["https://example.edu/residency/visa"] },
    resident_medical_schools: { state: "VERIFIED", summary: "Schools verified.", source_urls: ["https://example.edu/residency/visa"] },
  };
  response.output[1].content[0].text = JSON.stringify(parsed);
  const provider = createOpenAiResearchProvider({
    providerKey: "OPENAI_TERRA",
    apiKey: "test-key",
    fetchImpl: async () => new Response(JSON.stringify(response), { status: 200 }),
  });
  await assert.rejects(provider.execute({
    job: {
      jobId: "job-roster-mismatch", taskClass: "PROGRAM_DEEP_RESEARCH",
      programSpecialtyId: "rise_ps_e1ada2b6-9c76-59c0-89c9-62edf4960026",
      acgmeId: "1854831078", specialty: "Child Neurology", state: "TX",
      taskPayload: {
        requestedDomains: ["current_resident_roster", "resident_medical_schools"],
        requestedFields: ["research.resident_roster", "research.resident_medical_schools"],
      },
    },
  }), (error) => error?.code === "DOSSIER_CROSS_FIELD_INCONSISTENT");
});
