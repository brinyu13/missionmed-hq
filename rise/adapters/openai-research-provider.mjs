import { createHash } from "node:crypto";

import { createCanonicalEvidenceClaim } from "../src/evidence.mjs";
import { canonicalProgramSpecialtyIdentity } from "../src/identity.mjs";

const API_URL = "https://api.openai.com/v1/responses";
const PROVIDERS = Object.freeze({
  OPENAI_TERRA: Object.freeze({ modelKey: "gpt-5.6-terra", inputPerMillion: 2, cachedPerMillion: 0.2, outputPerMillion: 12 }),
  OPENAI_SOL: Object.freeze({ modelKey: "gpt-5.6-sol", inputPerMillion: 4, cachedPerMillion: 0.4, outputPerMillion: 20 }),
});
const FIELDS = Object.freeze([
  "program_overview", "visa", "application_requirements", "resident_roster", "leadership",
  "salary_benefits", "curriculum", "fellowship_inventory", "outcomes",
  "img_accessibility", "do_accessibility", "caribbean_accessibility", "usmd_accessibility",
]);

function sha256(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

function outputText(response) {
  return (response?.output ?? []).flatMap((item) => item?.content ?? [])
    .filter((item) => item?.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text).join("");
}

function citationUrls(response) {
  const urls = new Set();
  for (const item of response?.output ?? []) {
    if (item?.type !== "web_search_call") continue;
    for (const source of item?.action?.sources ?? []) {
      if (typeof source?.url === "string" && source.url.startsWith("https://")) urls.add(source.url);
    }
  }
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    if (value.type === "url_citation" && typeof value.url === "string" && value.url.startsWith("https://")) urls.add(value.url);
    if (value.url_citation?.url?.startsWith?.("https://")) urls.add(value.url_citation.url);
    for (const item of Object.values(value)) visit(item);
  };
  visit(response?.output ?? []);
  return urls;
}

function parseValue(finding) {
  if (finding.status === "NOT_FOUND") {
    return { state: "RESEARCHED_NOT_FOUND", note: finding.summary };
  }
  try { return JSON.parse(finding.value_json); } catch { return { summary: finding.summary }; }
}

export function calculateOpenAiResearchCost({ providerKey, usage = {}, webSearchCalls = 0 }) {
  const pricing = PROVIDERS[providerKey];
  if (!pricing) throw new Error(`Unsupported OpenAI research provider: ${providerKey}`);
  const input = Math.max(0, Number(usage.input_tokens) || 0);
  const cached = Math.min(input, Math.max(0, Number(usage.input_tokens_details?.cached_tokens) || 0));
  const output = Math.max(0, Number(usage.output_tokens) || 0);
  const tokenCost = ((input - cached) * pricing.inputPerMillion + cached * pricing.cachedPerMillion + output * pricing.outputPerMillion) / 1_000_000;
  return Math.ceil((tokenCost + Math.max(0, Number(webSearchCalls) || 0) * 0.01) * 10_000) / 10_000;
}

function researchSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["program_identity", "findings", "research_summary"],
    properties: {
      program_identity: {
        type: "object", additionalProperties: false,
        required: ["acgme_id", "program_name", "institution", "specialty", "state"],
        properties: {
          acgme_id: { type: "string" }, program_name: { type: "string" }, institution: { type: "string" },
          specialty: { type: "string" }, state: { type: "string" },
        },
      },
      findings: {
        type: "array", maxItems: FIELDS.length,
        items: {
          type: "object", additionalProperties: false,
          required: ["field", "status", "summary", "value_json", "source_urls"],
          properties: {
            field: { type: "string", enum: [...FIELDS] },
            status: { type: "string", enum: ["FOUND", "NOT_FOUND", "CONFLICT"] },
            summary: { type: "string", maxLength: 600 },
            value_json: { type: "string", maxLength: 4000 },
            source_urls: { type: "array", maxItems: 8, items: { type: "string" } },
          },
        },
      },
      research_summary: { type: "string", maxLength: 2400 },
    },
  };
}

function buildPrompt(job) {
  const payload = job.taskPayload ?? {};
  const officialUrls = Array.isArray(payload.officialUrls) ? payload.officialUrls.filter((url) => String(url).startsWith("https://")).slice(0, 8) : [];
  return [
    "Research one US residency program for MissionMed RISE.",
    "Use current official institutional/program sources first. Web search is enabled only to locate and verify those sources.",
    "Never infer visa sponsorship, IMG/DO/Caribbean evidence, requirements, or outcomes from vague language.",
    "For each supported domain, return FOUND with a compact JSON value and direct source URLs. Return NOT_FOUND only after a real search. Use CONFLICT for unresolved disagreement.",
    "For resident_roster, leadership, and fellowship_inventory, value_json must be a JSON array of compact objects. Roster objects use name, degree, medical_school, pgy, classification, and source_url; leadership uses name, role, credentials, and source_url; fellowships use name, classification, and source_url. Omit unsupported keys rather than inventing values.",
    "Keep each finding concise: summary under 300 characters and value_json under 1500 characters.",
    "Do not include private contact data. Resident names may be included only when displayed on a current official roster and are observational evidence, not admissions policy.",
    `ACGME ID: ${job.acgmeId}`,
    `Program: ${payload.programName ?? "Unknown"}`,
    `Institution: ${payload.institution ?? "Unknown"}`,
    `Specialty: ${job.specialty}`,
    `State: ${job.state}`,
    `Known official URLs: ${officialUrls.join(", ") || "none supplied"}`,
    `Research domains: ${FIELDS.join(", ")}`,
  ].join("\n");
}

export function createOpenAiResearchProvider({ providerKey, apiKey = process.env.RISE_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY, fetchImpl = fetch } = {}) {
  const configuration = PROVIDERS[providerKey];
  if (!configuration) throw new Error(`Unsupported OpenAI research provider: ${providerKey}`);
  if (!String(apiKey ?? "").trim()) throw new Error("RISE_OPENAI_API_KEY is required");
  return {
    providerKey,
    modelKey: configuration.modelKey,
    async execute({ job }) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 180_000);
      let responsePayload = null;
      const started = Date.now();
      try {
        const response = await fetchImpl(API_URL, {
          method: "POST",
          signal: controller.signal,
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: configuration.modelKey,
            store: false,
            reasoning: { effort: "medium" },
            max_output_tokens: 8000,
            max_tool_calls: 3,
            tools: [{ type: "web_search" }],
            tool_choice: "auto",
            include: ["web_search_call.action.sources"],
            input: buildPrompt(job),
            text: { format: { type: "json_schema", name: "rise_program_research", strict: true, schema: researchSchema() } },
            metadata: { ticket: "P1-RISE-5012E", job_id: job.jobId, task_class: job.taskClass },
          }),
        });
        responsePayload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const error = Object.assign(new Error(`OpenAI research request failed with HTTP ${response.status}`), {
            code: "OPENAI_PROVIDER_HTTP_ERROR", providerResponseId: responsePayload?.id ?? null,
          });
          throw error;
        }
        const parsed = JSON.parse(outputText(responsePayload));
        if (String(parsed.program_identity?.acgme_id) !== String(job.acgmeId)) {
          throw Object.assign(new Error("OpenAI research response identity mismatch"), { code: "OPENAI_IDENTITY_MISMATCH" });
        }
        const citations = citationUrls(responsePayload);
        const dossierSourceUrls = [...citations].sort();
        const retrievedAt = new Date().toISOString();
        const providerRunId = responsePayload.id;
        const identity = canonicalProgramSpecialtyIdentity(job.acgmeId, job.specialty);
        const seenFields = new Set();
        const claims = [];
        const benchmarkFindings = [];
        for (const finding of parsed.findings ?? []) {
          if (!FIELDS.includes(finding.field) || seenFields.has(finding.field)) continue;
          seenFields.add(finding.field);
          const directSourceUrls = [...new Set((finding.source_urls ?? []).filter((url) => citations.has(url)))].sort();
          // Structured Responses do not always repeat tool citations inside JSON.
          // Preserve exact direct links when present, and otherwise retain the
          // provider-returned web-search source set as dossier-level evidence,
          // matching the existing provider-neutral research-factory contract.
          const sourceUrls = [...new Set([...directSourceUrls, ...dossierSourceUrls])].sort();
          const value = parseValue(finding);
          const claim = createCanonicalEvidenceClaim({
            subjectId: identity.program.id,
            field: `research.${finding.field}`,
            value,
            provider: "OPENAI",
            providerRunId,
            sourceType: "openai_responses_web_search",
            sourceUrl: sourceUrls[0] ?? null,
            sourceLocator: `openai-responses://${providerRunId}#/findings/${finding.field}`,
            retrievedAt,
            publicationState: "REVIEW_REQUIRED",
            reviewState: "PENDING",
          });
          claims.push({ ...claim, provider: "OPENAI", directSourceUrls, dossierSourceUrls, sourceUrls });
          benchmarkFindings.push({
            field: finding.field,
            status: finding.status,
            summary: finding.summary,
            value,
            sourceUrls,
          });
        }
        const rawBytes = Buffer.from(JSON.stringify(responsePayload));
        const webSearchCalls = (responsePayload.output ?? []).filter((item) => item?.type === "web_search_call").length;
        const actualCostUsd = calculateOpenAiResearchCost({ providerKey, usage: responsePayload.usage, webSearchCalls });
        const ingest = {
          provider: "OPENAI",
          campaignId: "P1-RISE-5012E",
          acgmeId: String(job.acgmeId),
          stagedAt: retrievedAt,
          sourceFile: `openai-responses://${providerRunId}`,
          sourceFileSha256: sha256(rawBytes),
          providerRunId,
          idempotencyKey: sha256(`OPENAI\0P1-RISE-5012E\0${job.acgmeId}\0${providerRunId}`),
          claims,
          newSpendUsd: actualCostUsd,
          providerKey,
          modelKey: configuration.modelKey,
        };
        return {
          providerKey, modelKey: configuration.modelKey, providerResponseId: providerRunId,
          networkUsed: true, newSpendUsd: actualCostUsd, actualCostUsd,
          latencyMs: Date.now() - started, usage: responsePayload.usage ?? {}, webSearchCalls,
          publicationState: "REVIEW_REQUIRED", canonicalPromotion: "REVIEW_REQUIRED",
          programSpecialtyId: job.programSpecialtyId, acgmeId: job.acgmeId,
          specialty: job.specialty, state: job.state,
          researchSummary: parsed.research_summary, findingCount: claims.length,
          benchmarkFindings,
          benchmarkMetrics: {
            foundCount: benchmarkFindings.filter((finding) => finding.status === "FOUND").length,
            researchedNotFoundCount: benchmarkFindings.filter((finding) => finding.status === "NOT_FOUND").length,
            conflictCount: benchmarkFindings.filter((finding) => finding.status === "CONFLICT").length,
            sourceBackedCount: benchmarkFindings.filter((finding) => finding.sourceUrls.length > 0).length,
          },
          ingest,
        };
      } catch (error) {
        const webSearchCalls = (responsePayload?.output ?? []).filter((item) => item?.type === "web_search_call").length;
        const cost = responsePayload?.usage
          ? calculateOpenAiResearchCost({ providerKey, usage: responsePayload.usage, webSearchCalls })
          : 0;
        error.actualCostUsd = cost;
        error.costKnown = Boolean(responsePayload?.usage);
        error.usage = responsePayload?.usage ?? {};
        error.providerResponseId ??= responsePayload?.id ?? null;
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export async function createResearchProviders(options = {}) {
  return [
    createOpenAiResearchProvider({ ...options, providerKey: "OPENAI_TERRA" }),
    createOpenAiResearchProvider({ ...options, providerKey: "OPENAI_SOL" }),
  ];
}
