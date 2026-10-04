import { createHash } from "node:crypto";

import { createCanonicalEvidenceClaim } from "../src/evidence.mjs";
import { canonicalProgramSpecialtyIdentity } from "../src/identity.mjs";
import {
  DEEP_RESEARCH_DOSSIER_V2,
  DEEP_RESEARCH_DOMAIN_KEYS,
  DEEP_RESEARCH_FIELD_KEYS,
  evaluateDossierCompletion,
  mergeDossierCompletionMatrix,
} from "../src/research-router.mjs";

const API_URL = "https://api.openai.com/v1/responses";
const PROVIDERS = Object.freeze({
  OPENAI_TERRA: Object.freeze({ modelKey: "gpt-5.6-terra", inputPerMillion: 2, cachedPerMillion: 0.2, outputPerMillion: 12 }),
  OPENAI_SOL: Object.freeze({ modelKey: "gpt-5.6-sol", inputPerMillion: 4, cachedPerMillion: 0.4, outputPerMillion: 20 }),
});
const FIELDS = Object.freeze(DEEP_RESEARCH_FIELD_KEYS.map((field) => field.replace(/^research\./, "")));
const DOMAIN_BY_KEY = new Map(DEEP_RESEARCH_DOSSIER_V2.domains.map((domain) => [domain.key, domain]));

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

const ARRAY_FINDING_FIELDS = new Set([
  "resident_roster", "resident_medical_schools", "leadership", "core_faculty",
  "faculty_training_graph", "fellowship_inventory", "program_differentiators",
]);

function validateDossierCrossFieldConsistency(parsed) {
  const values = new Map();
  for (const finding of parsed.findings ?? []) {
    if (finding.status !== "FOUND") continue;
    const value = parseValue(finding);
    if (ARRAY_FINDING_FIELDS.has(finding.field) && !Array.isArray(value)) {
      throw Object.assign(new Error(`Deep research ${finding.field} must be a structured array`), {
        code: "DOSSIER_FIELD_SHAPE_INVALID",
      });
    }
    values.set(finding.field, value);
  }

  const roster = values.get("resident_roster");
  const schools = values.get("resident_medical_schools");
  const rosterVerified = parsed.completion_matrix?.current_resident_roster?.state === "VERIFIED";
  const schoolsVerified = parsed.completion_matrix?.resident_medical_schools?.state === "VERIFIED";
  if (rosterVerified && schoolsVerified && Array.isArray(roster) && Array.isArray(schools)
    && roster.length !== schools.length) {
    throw Object.assign(new Error("Deep research roster and medical-school counts disagree"), {
      code: "DOSSIER_CROSS_FIELD_INCONSISTENT",
    });
  }

  const expectedRosterCount = Array.isArray(roster) ? roster.length
    : (schoolsVerified && Array.isArray(schools) ? schools.length : null);
  if (expectedRosterCount != null) {
    for (const field of ["img_accessibility", "do_accessibility", "usmd_accessibility", "caribbean_accessibility"]) {
      const value = values.get(field);
      if (value && Number.isInteger(Number(value.observed_roster_count))
        && Number(value.observed_roster_count) !== expectedRosterCount) {
        throw Object.assign(new Error(`Deep research ${field} denominator disagrees with the verified roster`), {
          code: "DOSSIER_CROSS_FIELD_INCONSISTENT",
        });
      }
    }
  }
}

export function calculateOpenAiResearchCost({ providerKey, usage = {}, webSearchCalls = 0 }) {
  const pricing = typeof providerKey === "string" && Object.hasOwn(PROVIDERS,providerKey) ? PROVIDERS[providerKey] : null;
  if (!pricing) throw new Error(`Unsupported OpenAI research provider: ${providerKey}`);
  const input = Math.max(0, Number(usage.input_tokens) || 0);
  const cached = Math.min(input, Math.max(0, Number(usage.input_tokens_details?.cached_tokens) || 0));
  const output = Math.max(0, Number(usage.output_tokens) || 0);
  const tokenCost = ((input - cached) * pricing.inputPerMillion + cached * pricing.cachedPerMillion + output * pricing.outputPerMillion) / 1_000_000;
  return Math.ceil((tokenCost + Math.max(0, Number(webSearchCalls) || 0) * 0.01) * 10_000) / 10_000;
}

function requestedContract(job) {
  const payload = job.taskPayload ?? {};
  const requestedDomains = [...new Set(payload.requestedDomains ?? DEEP_RESEARCH_DOMAIN_KEYS)]
    .filter((domain) => DEEP_RESEARCH_DOMAIN_KEYS.includes(domain));
  const requestedFields = [...new Set(payload.requestedFields ?? DEEP_RESEARCH_FIELD_KEYS)]
    .filter((field) => DEEP_RESEARCH_FIELD_KEYS.includes(field));
  if (!requestedDomains.length || !requestedFields.length) {
    throw Object.assign(new Error("Deep research request contains no valid work"), { code: "DOSSIER_REQUEST_EMPTY" });
  }
  return { requestedDomains, requestedFields };
}

function researchSchema(job) {
  const { requestedDomains, requestedFields } = requestedContract(job);
  const completionProperties = Object.fromEntries(requestedDomains.map((domain) => [domain, {
    type: "object", additionalProperties: false,
    required: ["state", "summary", "source_urls"],
    properties: {
      state: { type: "string", enum: [...DEEP_RESEARCH_DOSSIER_V2.terminalStates] },
      summary: { type: "string", maxLength: 600 },
      source_urls: { type: "array", maxItems: 12, items: { type: "string" } },
    },
  }]));
  return {
    type: "object",
    additionalProperties: false,
    required: ["program_identity", "completion_matrix", "findings", "research_summary"],
    properties: {
      program_identity: {
        type: "object", additionalProperties: false,
        required: ["acgme_id", "program_name", "institution", "specialty", "state"],
        properties: {
          acgme_id: { type: "string" }, program_name: { type: "string" }, institution: { type: "string" },
          specialty: { type: "string" }, state: { type: "string" },
        },
      },
      completion_matrix: {
        type: "object", additionalProperties: false,
        required: requestedDomains,
        properties: completionProperties,
      },
      findings: {
        type: "array", maxItems: Math.max(1, requestedFields.length + 8),
        items: {
          type: "object", additionalProperties: false,
          required: ["field", "status", "summary", "value_json", "source_urls"],
          properties: {
            field: { type: "string", enum: requestedFields.map((field) => field.replace(/^research\./, "")) },
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
  const { requestedDomains, requestedFields } = requestedContract(job);
  const officialUrls = Array.isArray(payload.officialUrls) ? payload.officialUrls.filter((url) => String(url).startsWith("https://")).slice(0, 8) : [];
  return [
    `Execute ${DEEP_RESEARCH_DOSSIER_V2.contractId} for one US residency program.`,
    `Request class: ${payload.requestClass ?? "FULL"}. Attempt every requested domain systematically; do not stop after an arbitrary number of findings.`,
    "Use current official institutional/program sources first. Web search is enabled only to locate and verify those sources.",
    "Never infer visa sponsorship, IMG/DO/Caribbean/USMD composition, requirements, trained-here relationships, board performance, or outcomes from vague language.",
    "Resolve every requested completion_matrix domain to exactly one terminal state. RESEARCHED_NOT_FOUND means a meaningful search was performed and no supportable public answer was found. UNAVAILABLE means the source could not be reached or assessed. Do not use NOT_RESEARCHED.",
    "For each supportable fact, return FOUND with compact JSON and direct source URLs. Return NOT_FOUND only after a real search. Use CONFLICT for unresolved disagreement.",
    "application_requirements must separately address Step 2, COMLEX, attempts, YOG, USCE, ECFMG, deadline, signaling, citizenship/visa and graduation restrictions without inventing cutoffs.",
    "resident_roster must use public professional roster data only and include name, degree, medical_school, medical_school_raw, pgy, track, roster_year and source_url where published. resident_medical_schools should preserve resident association and conservative school normalization. Accessibility fields are observational roster evidence, never admissions-policy claims.",
    "leadership and core_faculty should include names, roles and public professional training/interests where published. faculty_training_graph uses explicit YES/NO/UNKNOWN flags for residency_at_current_program and fellowship_at_current_institution; do not infer from dates alone.",
    "program_differentiators must be a JSON array of 5-12 source-backed, program-specific objects when available: title, detail, applicant_relevance, category, source_url, retrieved_at. Reject generic filler.",
    "Board and graduate outcomes must retain year/cohort and distinguish complete lists from selected examples. Salary should prefer current institutional GME sources. Curriculum, research, culture and facilities must be concrete and program-specific.",
    "For resident_roster, resident_medical_schools, leadership, core_faculty, faculty_training_graph, fellowship_inventory and program_differentiators, value_json should be an array of compact objects. Omit unsupported keys rather than inventing values.",
    "Keep each finding concise: summary under 500 characters and value_json under 3500 characters.",
    "Do not include private contact data. Resident names may be included only when displayed on a current official roster and are observational evidence, not admissions policy.",
    `ACGME ID: ${job.acgmeId}`,
    `Program: ${payload.programName ?? "Unknown"}`,
    `Institution: ${payload.institution ?? "Unknown"}`,
    `Specialty: ${job.specialty}`,
    `State: ${job.state}`,
    `Known official URLs: ${officialUrls.join(", ") || "none supplied"}`,
    `Requested completion domains: ${requestedDomains.join(", ")}`,
    `Requested canonical fields: ${requestedFields.join(", ")}`,
    `Prior completion matrix for DELTA/REFRESH context: ${JSON.stringify(payload.baselineCompletionMatrix ?? {})}`,
  ].join("\n");
}

function completionMatrix(parsed, job, citations) {
  const { requestedDomains } = requestedContract(job);
  const result = {};
  for (const domain of requestedDomains) {
    const entry = parsed.completion_matrix?.[domain];
    if (!entry || !DEEP_RESEARCH_DOSSIER_V2.terminalStates.includes(entry.state)) {
      throw Object.assign(new Error(`Deep research response did not resolve ${domain}`), { code: "DOSSIER_COMPLETION_INVALID" });
    }
    const direct = [...new Set((entry.source_urls ?? []).filter((url) => citations.has(url)))].sort();
    result[domain] = {
      state: entry.state,
      summary: String(entry.summary ?? "").slice(0, 600),
      sourceUrls: direct.length ? direct : [...citations].sort(),
    };
  }
  return result;
}

const RECOVERY_MAX_BYTES = 8 * 1024 * 1024;
const recoveryError = code => Object.assign(new Error("Research provider recovery execution failed"), {code});
const RECOVERY_CODES = new Set(['OPENAI_PROVIDER_HTTP_ERROR','OPENAI_IDENTITY_MISMATCH','DOSSIER_FIELD_SHAPE_INVALID',
  'DOSSIER_CROSS_FIELD_INCONSISTENT','DOSSIER_REQUEST_EMPTY','DOSSIER_COMPLETION_INVALID','DOSSIER_FINDING_MISSING',
  'RESEARCH_RECOVERY_ABORTED','RESEARCH_RECOVERY_RESPONSE_TOO_LARGE','RESEARCH_RECOVERY_CHECKPOINT_FAILED']);

function recoveryAccounting(payload) {
  const u=payload?.usage;
  const valid=u && typeof u==='object' && Number.isSafeInteger(u.input_tokens) && u.input_tokens>=0
    && Number.isSafeInteger(u.output_tokens) && u.output_tokens>=0
    && (u.input_tokens_details?.cached_tokens===undefined || (Number.isSafeInteger(u.input_tokens_details.cached_tokens)
      && u.input_tokens_details.cached_tokens>=0 && u.input_tokens_details.cached_tokens<=u.input_tokens));
  return {known:Boolean(valid), usage:valid?{input_tokens:u.input_tokens,output_tokens:u.output_tokens,
    input_tokens_details:{cached_tokens:u.input_tokens_details?.cached_tokens??0}}:{},
    webSearchCalls:Array.isArray(payload?.output)?payload.output.filter(x=>x?.type==='web_search_call').length:0,
    responseId:typeof payload?.id==='string' && /^resp_[a-zA-Z0-9_-]{1,180}$(?![\s\S])/.test(payload.id)?payload.id:null};
}

async function recoveryWait(run, signal, timeoutMs = null) {
  if (signal.aborted) throw recoveryError('RESEARCH_RECOVERY_ABORTED');
  let listener, timer;
  try {
    return await Promise.race([Promise.resolve().then(() => {
      if (signal.aborted) throw recoveryError('RESEARCH_RECOVERY_ABORTED');
      return run();
    }), new Promise((_, reject) => {
      listener = () => reject(recoveryError('RESEARCH_RECOVERY_ABORTED'));
      signal.addEventListener('abort', listener, {once:true});
      if (timeoutMs !== null) timer = setTimeout(() => reject(recoveryError('RESEARCH_RECOVERY_CHECKPOINT_FAILED')), timeoutMs);
    })]);
  } finally {
    signal.removeEventListener('abort', listener);
    clearTimeout(timer);
  }
}

async function checkpointRawResponse(response, {signal, checkpointResponse}, providerKey, modelKey) {
  const reader = response.body?.getReader();
  if (!reader) throw recoveryError('RESEARCH_RECOVERY_CHECKPOINT_FAILED');
  const chunks = []; let size = 0;
  try {
    while (true) {
      const {done, value} = await recoveryWait(() => reader.read(), signal);
      if (done) break;
      size += value.byteLength;
      if (size > RECOVERY_MAX_BYTES) throw recoveryError('RESEARCH_RECOVERY_RESPONSE_TOO_LARGE');
      chunks.push(Buffer.from(value));
    }
    const raw = Buffer.concat(chunks);
    const record = Object.freeze({rawBodyBase64:raw.toString('base64'),
      sha256:createHash('sha256').update(raw).digest('hex'), httpStatus:response.status,
      providerKey, modelKey, receivedAt:new Date().toISOString()});
    await recoveryWait(async () => {
      try { await checkpointResponse(record); }
      catch { throw recoveryError('RESEARCH_RECOVERY_CHECKPOINT_FAILED'); }
    }, signal, 5000);
    if (signal.aborted) throw recoveryError('RESEARCH_RECOVERY_ABORTED');
    return record;
  } finally {
    // Cancellation is best-effort and must not wait on an uncooperative stream.
    Promise.resolve(reader.cancel()).catch(() => {});
    reader.releaseLock();
  }
}

function snapshotRecoveryJob(job) {
  const copy=structuredClone(job);
  if(!copy || !['jobId','programSpecialtyId','acgmeId','specialty','state'].every(k=>typeof copy[k]==='string'&&copy[k].length>0&&copy[k].length<=180) ||
    !/^[0-9]{10}$(?![\s\S])/.test(copy.acgmeId) || !/^[A-Z]{2}$(?![\s\S])/.test(copy.state))throw recoveryError('RESEARCH_RECOVERY_INVALID');
  requestedContract(copy);
  return copy;
}

function normalizeResponse({job, providerKey, responsePayload, receipt=null, latencyMs=0, strict=false}) {
  const configuration=typeof providerKey==='string' && Object.hasOwn(PROVIDERS,providerKey)?PROVIDERS[providerKey]:null;
  if(!configuration) throw recoveryError('RESEARCH_RECOVERY_INVALID');
  if(strict && (responsePayload?.status!=='completed' || responsePayload?.model!==configuration.modelKey || !recoveryAccounting(responsePayload).known || !recoveryAccounting(responsePayload).responseId || !Array.isArray(responsePayload?.output))) throw recoveryError('RESEARCH_RECOVERY_FAILED');
        const parsed = JSON.parse(outputText(responsePayload));
        if (String(parsed.program_identity?.acgme_id) !== String(job.acgmeId)) {
          throw Object.assign(new Error("OpenAI research response identity mismatch"), { code: "OPENAI_IDENTITY_MISMATCH" });
        }
        if(strict) {
          const identity=parsed.program_identity;
          if(!identity || !['acgme_id','program_name','institution','specialty','state'].every(k=>typeof identity[k]==='string'&&identity[k].trim().length>0&&identity[k].length<=500) ||
            identity.specialty.trim().toLowerCase()!==job.specialty.trim().toLowerCase() || identity.state.trim().toUpperCase()!==job.state)throw recoveryError('OPENAI_IDENTITY_MISMATCH');
          const requested=requestedContract(job), seen=new Set();
          if(!Array.isArray(parsed.findings)||parsed.findings.length>requested.requestedFields.length+8 ||
            typeof parsed.research_summary!=='string'||parsed.research_summary.length>2400)throw recoveryError('RESEARCH_RECOVERY_FAILED');
          for(const f of parsed.findings) {
            if(!f || !requested.requestedFields.includes(`research.${f.field}`)||seen.has(f.field)||
              !['FOUND','NOT_FOUND','CONFLICT'].includes(f.status)||typeof f.summary!=='string'||f.summary.length>600||
              typeof f.value_json!=='string'||f.value_json.length>4000||!Array.isArray(f.source_urls)||f.source_urls.length>8||
              f.source_urls.some(u=>typeof u!=='string'||u.length>2048))throw recoveryError('RESEARCH_RECOVERY_FAILED');
            seen.add(f.field);if(f.status!=='NOT_FOUND')JSON.parse(f.value_json);
          }
          for(const d of requested.requestedDomains) {
            const e=parsed.completion_matrix?.[d];
            if(!e||typeof e.summary!=='string'||e.summary.length>600||!Array.isArray(e.source_urls)||e.source_urls.length>12||
              e.source_urls.some(u=>typeof u!=='string'||u.length>2048))throw recoveryError('RESEARCH_RECOVERY_FAILED');
          }
        }
        validateDossierCrossFieldConsistency(parsed);
        const citations = citationUrls(responsePayload);
        const completionUpdate = completionMatrix(parsed, job, citations);
        const mergedCompletion = mergeDossierCompletionMatrix(job.taskPayload?.baselineCompletionMatrix ?? {}, completionUpdate);
        const dossierCompletion = evaluateDossierCompletion(mergedCompletion);
        const dossierSourceUrls = [...citations].sort();
        const retrievedAt = receipt?.receivedAt ?? new Date().toISOString();
        const providerRunId = !strict ? responsePayload.id : recoveryAccounting(responsePayload).responseId;
        const identity = canonicalProgramSpecialtyIdentity(job.acgmeId, job.specialty);
        const seenFields = new Set();
        const claims = [];
        const benchmarkFindings = [];
        for (const finding of parsed.findings ?? []) {
          if (!FIELDS.includes(finding.field) || seenFields.has(finding.field)) continue;
          seenFields.add(finding.field);
          const directSourceUrls = [...new Set((finding.source_urls ?? []).filter((url) => citations.has(url)))].sort();
          // Prefer the finding's direct citations. Structured Responses do not
          // always repeat tool citations inside JSON, so retain the dossier-wide
          // discovery set only when no direct citation survived validation.
          const sourceUrls = strict ? directSourceUrls : (directSourceUrls.length ? directSourceUrls : dossierSourceUrls);
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
          claims.push({ ...claim, provider: "OPENAI", directSourceUrls, dossierSourceUrls, sourceUrls,
            ...(strict && finding.status!=="FOUND" ? {evidenceState:finding.status==="CONFLICT"?"CONFLICT":"RESEARCHED_NOT_FOUND"} : {}) });
          benchmarkFindings.push({
            field: finding.field,
            status: finding.status,
            summary: finding.summary,
            value,
            sourceUrls,
          });
        }
        for (const domainKey of requestedContract(job).requestedDomains) {
          const domain = DOMAIN_BY_KEY.get(domainKey);
          const entry = completionUpdate[domainKey];
          const hasFinding = domain.fields.some((field) => seenFields.has(field.replace(/^research\./, "")));
          if (["VERIFIED", "PARTIALLY_VERIFIED"].includes(entry.state) && !hasFinding) {
            throw Object.assign(new Error(`Deep research response resolved ${domainKey} without a structured finding`), {
              code: "DOSSIER_FINDING_MISSING",
            });
          }
          if (hasFinding) continue;
          const field = domain.fields[0];
          const sourceUrls = strict ? [...new Set((parsed.completion_matrix?.[domainKey]?.source_urls ?? []).filter(url => citations.has(url)))].sort() : entry.sourceUrls;
          const claim = createCanonicalEvidenceClaim({
            subjectId: identity.program.id,
            field,
            value: { state: entry.state, note: entry.summary },
            provider: "OPENAI",
            providerRunId,
            sourceType: "openai_responses_web_search",
            sourceUrl: sourceUrls[0] ?? null,
            sourceLocator: `openai-responses://${providerRunId}#/completion_matrix/${domainKey}`,
            retrievedAt,
            publicationState: "REVIEW_REQUIRED",
            reviewState: "PENDING",
          });
          claims.push({ ...claim, provider: "OPENAI", directSourceUrls: sourceUrls, dossierSourceUrls, sourceUrls });
        }
        const rawBytes = Buffer.from(JSON.stringify(responsePayload));
        const webSearchCalls = (responsePayload.output ?? []).filter((item) => item?.type === "web_search_call").length;
        const usage = !strict ? (responsePayload.usage ?? {}) : recoveryAccounting(responsePayload).usage;
        const actualCostUsd = calculateOpenAiResearchCost({ providerKey, usage, webSearchCalls });
        if(strict && !Number.isFinite(actualCostUsd))throw recoveryError('RESEARCH_RECOVERY_FAILED');
        const ingest = {
          provider: "OPENAI",
          campaignId: "P1-RISE-5012F",
          acgmeId: String(job.acgmeId),
          stagedAt: retrievedAt,
          sourceFile: `openai-responses://${providerRunId}`,
          sourceFileSha256: receipt?.sha256 ?? sha256(rawBytes),
          providerRunId,
          idempotencyKey: sha256(`OPENAI\0P1-RISE-5012F\0${job.acgmeId}\0${providerRunId}`),
          claims,
          newSpendUsd: actualCostUsd,
          providerKey,
          modelKey: configuration.modelKey,
        };
        return {
          providerKey, modelKey: configuration.modelKey, providerResponseId: providerRunId,
          networkUsed: true, newSpendUsd: actualCostUsd, actualCostUsd,
          latencyMs, usage, webSearchCalls,
          ...(strict ? {costBasis:"configured_estimate", rawResponseSha256:receipt.sha256} : {}),
          publicationState: "REVIEW_REQUIRED", canonicalPromotion: "REVIEW_REQUIRED",
          programSpecialtyId: job.programSpecialtyId, acgmeId: job.acgmeId,
          specialty: job.specialty, state: job.state,
          researchSummary: parsed.research_summary, findingCount: claims.length,
          contractId: DEEP_RESEARCH_DOSSIER_V2.contractId,
          contractVersion: DEEP_RESEARCH_DOSSIER_V2.contractVersion,
          resultSchemaVersion: DEEP_RESEARCH_DOSSIER_V2.resultSchemaVersion,
          requestClass: job.taskPayload?.requestClass ?? "FULL",
          requestedDomains: requestedContract(job).requestedDomains,
          requestedFields: requestedContract(job).requestedFields,
          completionMatrix: dossierCompletion.matrix,
          completionScore: dossierCompletion.completionScore,
          dossierOutcome: dossierCompletion.outcome,
          researchTimestamp: retrievedAt,
          benchmarkFindings,
          benchmarkMetrics: {
            foundCount: benchmarkFindings.filter((finding) => finding.status === "FOUND").length,
            researchedNotFoundCount: benchmarkFindings.filter((finding) => finding.status === "NOT_FOUND").length,
            conflictCount: benchmarkFindings.filter((finding) => finding.status === "CONFLICT").length,
            sourceBackedCount: benchmarkFindings.filter((finding) => finding.sourceUrls.length > 0).length,
          },
          ingest,
        };
}

export function recoverOpenAiResearchResponse({job,providerKey,receipt,latencyMs=0}={}) {
  let payload=null;
  try {
    job=snapshotRecoveryJob(job);
    const configuration=typeof providerKey==='string' && Object.hasOwn(PROVIDERS,providerKey)?PROVIDERS[providerKey]:null;
    if(!configuration || receipt?.providerKey!==providerKey || receipt?.modelKey!==configuration.modelKey ||
      !Number.isInteger(receipt.httpStatus) || receipt.httpStatus<100 || receipt.httpStatus>599 ||
      typeof receipt.rawBodyBase64!=='string' || receipt.rawBodyBase64.length>Math.ceil(RECOVERY_MAX_BYTES/3)*4 ||
      typeof receipt.sha256!=='string' || !/^[a-f0-9]{64}$(?![\s\S])/.test(receipt.sha256) ||
      typeof receipt.receivedAt!=='string' || !Number.isFinite(Date.parse(receipt.receivedAt)) ||
      new Date(receipt.receivedAt).toISOString()!==receipt.receivedAt) throw recoveryError('RESEARCH_RECOVERY_INVALID');
    const raw=Buffer.from(receipt.rawBodyBase64,'base64');
    if(!raw.length || raw.length>RECOVERY_MAX_BYTES || raw.toString('base64')!==receipt.rawBodyBase64 ||
      createHash('sha256').update(raw).digest('hex')!==receipt.sha256) throw recoveryError('RESEARCH_RECOVERY_INVALID');
    payload=JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(raw));
    if(receipt.httpStatus<200 || receipt.httpStatus>=300) throw Object.assign(recoveryError('OPENAI_PROVIDER_HTTP_ERROR'),{httpStatus:receipt.httpStatus});
    return normalizeResponse({job,providerKey,responsePayload:payload,receipt,latencyMs,strict:true});
  } catch(error) {
    const safe=recoveryError(RECOVERY_CODES.has(error?.code)?error.code:'RESEARCH_RECOVERY_FAILED');
    const accounting=recoveryAccounting(payload);
    Object.assign(safe,{costKnown:accounting.known,usage:accounting.usage,providerResponseId:accounting.responseId,
      actualCostUsd:accounting.known?calculateOpenAiResearchCost({providerKey,usage:accounting.usage,webSearchCalls:accounting.webSearchCalls}):0});
    if(error?.httpStatus) safe.httpStatus=error.httpStatus;
    throw safe;
  }
}

export function createOpenAiResearchProvider({ providerKey, apiKey = process.env.RISE_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY, fetchImpl = fetch } = {}) {
  const configuration = typeof providerKey === "string" && Object.hasOwn(PROVIDERS,providerKey) ? PROVIDERS[providerKey] : null;
  if (!configuration) throw new Error(`Unsupported OpenAI research provider: ${providerKey}`);
  if (!String(apiKey ?? "").trim()) throw new Error("RISE_OPENAI_API_KEY is required");
  return {
    providerKey,
    modelKey: configuration.modelKey,
    async execute({ job, recovery }) {
      if (recovery !== undefined && (typeof recovery?.checkpointResponse !== 'function' || !(recovery.signal instanceof AbortSignal))) {
        throw Object.assign(recoveryError('RESEARCH_RECOVERY_INVALID'), {costKnown:true, actualCostUsd:0});
      }
      if(recovery !== undefined) {
        try {job=snapshotRecoveryJob(job);} catch {throw Object.assign(recoveryError('RESEARCH_RECOVERY_INVALID'),{costKnown:true,actualCostUsd:0});}
      }
      const controller = new AbortController();
      const checkpointResponse = recovery?.checkpointResponse;
      const outerSignal = recovery?.signal;
      const onAbort = () => controller.abort();
      if (outerSignal) {
        outerSignal.addEventListener('abort', onAbort, {once:true});
        if (outerSignal.aborted) controller.abort();
      }
      const timeout = setTimeout(() => controller.abort(), 180_000);
      let responsePayload = null, rawReceipt = null;
      const started = Date.now();
      try {
        const dispatch = () => fetchImpl(API_URL, {
          method: "POST",
          signal: controller.signal,
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: configuration.modelKey,
            store: false,
            reasoning: { effort: "medium" },
            max_output_tokens: 16000,
            max_tool_calls: 8,
            tools: [{ type: "web_search" }],
            tool_choice: "auto",
            include: ["web_search_call.action.sources"],
            input: buildPrompt(job),
            text: { format: { type: "json_schema", name: "rise_deep_research_dossier_v2", strict: true, schema: researchSchema(job) } },
            metadata: { ticket: "P1-RISE-5012F", job_id: job.jobId, task_class: job.taskClass, contract: "DOSSIER_V2" },
          }),
        });
        const response = recovery === undefined ? await dispatch()
          : await recoveryWait(dispatch, controller.signal);
        if(recovery === undefined) responsePayload=await response.json().catch(()=>({}));
        else {
          rawReceipt=await checkpointRawResponse(response,{signal:controller.signal,checkpointResponse},providerKey,configuration.modelKey);
          responsePayload=JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(Buffer.from(rawReceipt.rawBodyBase64,'base64')));
        }
        if (!response.ok) {
          const error = Object.assign(new Error(`OpenAI research request failed with HTTP ${response.status}`), {
            code: "OPENAI_PROVIDER_HTTP_ERROR", httpStatus:response.status, providerResponseId: responsePayload?.id ?? null,
          });
          throw error;
        }
        if (recovery !== undefined && (!recoveryAccounting(responsePayload).known || !recoveryAccounting(responsePayload).responseId || !Array.isArray(responsePayload?.output))) {
          throw recoveryError('RESEARCH_RECOVERY_FAILED');
        }
        if (recovery !== undefined && controller.signal.aborted) throw recoveryError('RESEARCH_RECOVERY_ABORTED');
        return recovery === undefined
          ? normalizeResponse({job,providerKey,responsePayload,latencyMs:Date.now()-started})
          : recoverOpenAiResearchResponse({job,providerKey,receipt:rawReceipt,latencyMs:Date.now()-started});
      } catch (error) {
        if (recovery !== undefined) {
          controller.abort();
          const httpStatus=error?.httpStatus;
          error = recoveryError(RECOVERY_CODES.has(error?.code) ? error.code : 'RESEARCH_RECOVERY_FAILED');
          if(Number.isInteger(httpStatus))error.httpStatus=httpStatus;
          const accounting=recoveryAccounting(responsePayload);
          error.actualCostUsd=accounting.known?calculateOpenAiResearchCost({providerKey,usage:accounting.usage,webSearchCalls:accounting.webSearchCalls}):0;
          error.costKnown=accounting.known;error.usage=accounting.usage;error.providerResponseId=accounting.responseId;
          throw error;
        }
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
        outerSignal?.removeEventListener('abort', onAbort);
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
