import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const dossierContract = require("../config/deep-research-dossier-v2.json");

export const DEEP_RESEARCH_DOSSIER_V2 = Object.freeze({
  ...dossierContract,
  terminalStates: Object.freeze([...dossierContract.terminalStates]),
  requestClasses: Object.freeze([...dossierContract.requestClasses]),
  domains: Object.freeze(dossierContract.domains.map((domain) => Object.freeze({
    ...domain,
    fields: Object.freeze([...domain.fields]),
  }))),
});
export const DEEP_RESEARCH_DOMAIN_KEYS = Object.freeze(DEEP_RESEARCH_DOSSIER_V2.domains.map((domain) => domain.key));
export const DEEP_RESEARCH_FIELD_KEYS = Object.freeze([...new Set(DEEP_RESEARCH_DOSSIER_V2.domains.flatMap((domain) => domain.fields))]);
export const DEEP_RESEARCH_TERMINAL_STATES = Object.freeze([...DEEP_RESEARCH_DOSSIER_V2.terminalStates]);

export const RESEARCH_ROUTER_CONFIG = Object.freeze({
  schemaVersion: 1,
  contractId: "rise-on-demand-research-router-2026-09-10-5012e",
  buildMode: "LIVE_PRODUCTION",
  defaults: Object.freeze({
    globalEnabled: false,
    studentEnabled: false,
    emergencyKillSwitch: true,
    specialtyScope: Object.freeze(["Neurology"]),
    stateScope: Object.freeze(["FL", "TX"]),
    canaryMode: "PROGRAM_ID_ALLOWLIST",
    canaryProgramIds: Object.freeze([
      "1854831078",
      "1851113100",
    ]),
    entitlementScope: Object.freeze(["rise:private-beta"]),
    subjectAllowlistHashes: Object.freeze([]),
    defaultQuota: 30,
    quotaWindowDays: 30,
    budgetCapUsd: 12,
    concurrencyCap: 1,
    primaryProvider: "RISE_REPLAY_TEST",
    fallbackProvider: null,
    escalationProvider: null,
  }),
  providers: Object.freeze([
    Object.freeze({
      providerKey: "RISE_REPLAY_TEST",
      modelKey: "deterministic-private-replay-v1",
      state: "TEST_ONLY",
      enabled: true,
      networkAllowed: false,
      spendAllowed: false,
    }),
    Object.freeze({
      providerKey: "OPENAI_TERRA",
      modelKey: "gpt-5.6-terra",
      state: "PAUSED",
      enabled: false,
      networkAllowed: false,
      spendAllowed: false,
      budgetCapUsd: 6,
      concurrencyCap: 1,
    }),
    Object.freeze({
      providerKey: "OPENAI_SOL",
      modelKey: "gpt-5.6-sol",
      state: "PAUSED",
      enabled: false,
      networkAllowed: false,
      spendAllowed: false,
      budgetCapUsd: 6,
      concurrencyCap: 1,
    }),
    Object.freeze({
      providerKey: "PARALLEL",
      modelKey: "unconfigured",
      state: "PAUSED",
      enabled: false,
      networkAllowed: false,
      spendAllowed: false,
    }),
    Object.freeze({
      providerKey: "CLAUDE_OPUS",
      modelKey: "unconfigured",
      state: "PAUSED",
      enabled: false,
      networkAllowed: false,
      spendAllowed: false,
    }),
  ]),
});

export const RESEARCH_PROVIDER_STATES = Object.freeze([
  "DISABLED", "CONFIGURED", "TEST_ONLY", "BENCHMARKING", "PRODUCTION_APPROVED", "PAUSED",
]);
export const AUTHORIZED_PROVIDER_KEYS = Object.freeze(["OPENAI_TERRA", "OPENAI_SOL"]);
export const AUTHORIZED_COMBINED_SPEND_USD = 12;
export const RESEARCH_JOB_TERMINAL_STATES = Object.freeze([
  "COMPLETED", "PARTIAL", "NEEDS_REVIEW", "FAILED", "CANCELLED", "REFUNDED",
]);

const STATE_NAMES = new Map([
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
  ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
  ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"],
  ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"],
  ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"],
  ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"],
  ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"],
  ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"],
  ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["PR", "Puerto Rico"],
  ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"],
  ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"],
  ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
]);
const STATE_CODES = new Map([...STATE_NAMES].flatMap(([code, name]) => [
  [code, code],
  [name.toUpperCase(), code],
]));

function boundedString(value, name, { maximum = 128, nullable = false } = {}) {
  if (nullable && (value === null || value === undefined || value === "")) return null;
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > maximum || /[\0\r\n]/.test(normalized)) {
    throw Object.assign(new Error(`${name} is invalid`), { code: "RESEARCH_CONTROL_INVALID" });
  }
  return normalized;
}

function boundedInteger(value, name, minimum, maximum) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw Object.assign(new Error(`${name} must be an integer from ${minimum} to ${maximum}`), {
      code: "RESEARCH_CONTROL_INVALID",
    });
  }
  return number;
}

function boundedMoney(value, name, maximum = 1_000_000) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > maximum || Math.round(number * 10_000) !== number * 10_000) {
    throw Object.assign(new Error(`${name} must be a non-negative amount with at most four decimals`), {
      code: "RESEARCH_CONTROL_INVALID",
    });
  }
  return number;
}

function distinctStrings(values, name, { maximumItems = 64, itemMaximum = 128 } = {}) {
  if (!Array.isArray(values) || values.length > maximumItems) {
    throw Object.assign(new Error(`${name} must be a bounded list`), { code: "RESEARCH_CONTROL_INVALID" });
  }
  const normalized = values.map((value) => boundedString(value, name, { maximum: itemMaximum }));
  if (new Set(normalized).size !== normalized.length) {
    throw Object.assign(new Error(`${name} must not contain duplicates`), { code: "RESEARCH_CONTROL_INVALID" });
  }
  return normalized;
}

export function canonicalStateCode(value) {
  return STATE_CODES.get(String(value ?? "").trim().toUpperCase()) ?? null;
}

export function researchSubjectHash(subject, auditKey) {
  const normalizedSubject = boundedString(subject, "subject", { maximum: 256 });
  const normalizedKey = boundedString(auditKey, "audit key", { maximum: 4096 });
  return createHash("sha256")
    .update("rise-research-subject-v1\0")
    .update(normalizedKey)
    .update("\0")
    .update(normalizedSubject)
    .digest("hex");
}

export function normalizeResearchControls(input = {}) {
  const defaults = RESEARCH_ROUTER_CONFIG.defaults;
  const source = { ...defaults, ...input };
  const specialtyScope = distinctStrings(source.specialtyScope, "specialtyScope", { maximumItems: 32 });
  const stateScope = distinctStrings(source.stateScope, "stateScope", { maximumItems: 64, itemMaximum: 32 })
    .map((state) => canonicalStateCode(state))
    .filter(Boolean);
  if (!specialtyScope.length || !stateScope.length || new Set(stateScope).size !== stateScope.length) {
    throw Object.assign(new Error("Research specialty and state scope must be non-empty and canonical"), {
      code: "RESEARCH_CONTROL_INVALID",
    });
  }
  const entitlementScope = distinctStrings(source.entitlementScope, "entitlementScope", { maximumItems: 32 });
  if (!entitlementScope.length || entitlementScope.some((value) => !/^[a-z0-9:_-]{1,128}$/.test(value))) {
    throw Object.assign(new Error("Research entitlement scope is invalid"), { code: "RESEARCH_CONTROL_INVALID" });
  }
  const subjectAllowlistHashes = distinctStrings(source.subjectAllowlistHashes, "subjectAllowlistHashes", {
    maximumItems: 100,
    itemMaximum: 64,
  });
  if (subjectAllowlistHashes.some((value) => !/^[a-f0-9]{64}$/.test(value))) {
    throw Object.assign(new Error("Research subject allowlist entries must be SHA-256 hashes"), {
      code: "RESEARCH_CONTROL_INVALID",
    });
  }
  const canaryMode = boundedString(source.canaryMode, "canaryMode", { maximum: 32 });
  if (canaryMode !== "PROGRAM_ID_ALLOWLIST") {
    throw Object.assign(new Error("Research canary mode must be PROGRAM_ID_ALLOWLIST"), {
      code: "RESEARCH_CONTROL_INVALID",
    });
  }
  const canaryProgramIds = distinctStrings(
    source.canaryProgramIds,
    "canaryProgramIds",
    { maximumItems: 100, itemMaximum: 10 },
  );
  if (!canaryProgramIds.length || canaryProgramIds.some((value) => !/^\d{10}$/.test(value))) {
    throw Object.assign(new Error("Research canary ACGME program IDs are invalid"), {
      code: "RESEARCH_CONTROL_INVALID",
    });
  }
  const primaryProvider = boundedString(source.primaryProvider, "primaryProvider", { maximum: 64 });
  const fallbackProvider = boundedString(source.fallbackProvider, "fallbackProvider", { maximum: 64, nullable: true });
  const escalationProvider = boundedString(source.escalationProvider, "escalationProvider", { maximum: 64, nullable: true });
  return {
    globalEnabled: source.globalEnabled === true,
    studentEnabled: source.studentEnabled === true,
    emergencyKillSwitch: source.emergencyKillSwitch !== false,
    specialtyScope,
    stateScope,
    canaryMode,
    canaryProgramIds,
    entitlementScope,
    subjectAllowlistHashes,
    defaultQuota: boundedInteger(source.defaultQuota, "defaultQuota", 0, 100),
    quotaWindowDays: boundedInteger(source.quotaWindowDays, "quotaWindowDays", 1, 366),
    budgetCapUsd: boundedMoney(source.budgetCapUsd, "budgetCapUsd"),
    concurrencyCap: boundedInteger(source.concurrencyCap, "concurrencyCap", 1, 32),
    primaryProvider,
    fallbackProvider,
    escalationProvider,
  };
}

export function normalizeProviderRoute(input = {}) {
  const providerKey = boundedString(input.providerKey, "providerKey", { maximum: 64 });
  if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(providerKey)) {
    throw Object.assign(new Error("Provider key is invalid"), { code: "RESEARCH_CONTROL_INVALID" });
  }
  const state = boundedString(input.state, "state", { maximum: 32 }).toUpperCase();
  if (!RESEARCH_PROVIDER_STATES.includes(state)) {
    throw Object.assign(new Error("Provider state is invalid"), { code: "RESEARCH_CONTROL_INVALID" });
  }
  const modelKey = boundedString(input.modelKey, "modelKey", { maximum: 128 });
  const enabled = input.enabled === true;
  const networkAllowed = input.networkAllowed === true;
  const spendAllowed = input.spendAllowed === true;
  const budgetCapUsd = boundedMoney(input.budgetCapUsd ?? 0, "provider budgetCapUsd");
  const concurrencyCap = boundedInteger(input.concurrencyCap ?? 1, "provider concurrencyCap", 1, 32);
  if (providerKey === "RISE_REPLAY_TEST" && (networkAllowed || spendAllowed || budgetCapUsd !== 0)) {
    throw Object.assign(new Error("Replay provider must remain offline and zero-spend"), {
      code: "RESEARCH_CONTROL_INVALID",
    });
  }
  if (spendAllowed && !AUTHORIZED_PROVIDER_KEYS.includes(providerKey)) {
    throw Object.assign(new Error("Spend requires an authorized OpenAI research provider"), {
      code: "RESEARCH_CONTROL_INVALID",
    });
  }
  if (!["BENCHMARKING", "PRODUCTION_APPROVED"].includes(state) && spendAllowed) {
    throw Object.assign(new Error("Spend requires a benchmarking or production-approved provider"), {
      code: "RESEARCH_CONTROL_INVALID",
    });
  }
  return { providerKey, modelKey, state, enabled, networkAllowed, spendAllowed, budgetCapUsd, concurrencyCap };
}

export function programDescriptor(program) {
  const specialty = String(program?.designation ?? program?.specialty ?? "").trim();
  const state = canonicalStateCode(program?.display?.state ?? program?.state);
  const programSpecialtyId = String(program?.programSpecialtyId ?? "").trim();
  const acgmeId = (program?.identifiers ?? []).find((identifier) => identifier.namespace === "ACGME_PROGRAM")?.value ?? null;
  return { specialty, state, programSpecialtyId, acgmeId };
}

export function evaluateResearchEligibility({
  program,
  session,
  controls,
  subjectHash,
  source = "STUDENT",
} = {}) {
  const normalizedControls = normalizeResearchControls(controls);
  const descriptor = programDescriptor(program);
  const reasons = [];
  const administrator = source === "ADMIN" && (
    session?.capabilities?.includes("rise:operator") || session?.capabilities?.includes("rise:admin")
  );
  if (normalizedControls.emergencyKillSwitch) reasons.push("EMERGENCY_KILL_SWITCH");
  if (!normalizedControls.globalEnabled) reasons.push("GLOBAL_PAUSED");
  if (!administrator && !normalizedControls.studentEnabled) reasons.push("STUDENT_PAUSED");
  if (!descriptor.programSpecialtyId || !descriptor.acgmeId) reasons.push("PROGRAM_IDENTITY_UNAVAILABLE");
  if (!normalizedControls.canaryProgramIds.includes(descriptor.acgmeId)) {
    reasons.push("PROGRAM_OUT_OF_CANARY");
  }
  if (!administrator) {
    const capabilities = new Set(session?.capabilities ?? []);
    if (!normalizedControls.entitlementScope.some((capability) => capabilities.has(capability) || capabilities.has("rise:admin"))) {
      reasons.push("ENTITLEMENT_REQUIRED");
    }
    if (
      normalizedControls.subjectAllowlistHashes.length
      && !normalizedControls.subjectAllowlistHashes.includes(String(subjectHash ?? ""))
    ) reasons.push("SUBJECT_OUT_OF_CANARY");
  }
  return {
    eligible: reasons.length === 0,
    reasons,
    source: administrator ? "ADMIN" : "STUDENT",
    scope: {
      specialty: descriptor.specialty,
      state: descriptor.state,
      programSpecialtyId: descriptor.programSpecialtyId,
      acgmeId: descriptor.acgmeId,
    },
  };
}

export function researchDedupeKey({ programSpecialtyId, taskClass = "PROGRAM_DEEP_RESEARCH", windowKey, providerKey }) {
  const programId = boundedString(programSpecialtyId, "programSpecialtyId", { maximum: 128 });
  const task = boundedString(taskClass, "taskClass", { maximum: 64 });
  // Root-job UUIDs are the durable continuation window for Dossier V2 child
  // stages. Keep calendar/quota keys valid while accepting the canonical UUID.
  const window = boundedString(windowKey, "windowKey", { maximum: 64 });
  const provider = boundedString(providerKey, "providerKey", { maximum: 64 });
  return createHash("sha256")
    .update(["rise-research-dedupe-v1", programId, task, window, provider].join("\0"))
    .digest("hex");
}

function normalizedMatrix(matrix = {}) {
  return Object.fromEntries(DEEP_RESEARCH_DOSSIER_V2.domains.map((domain) => {
    const input = matrix?.[domain.key];
    const state = typeof input === "string" ? input : input?.state;
    return [domain.key, DEEP_RESEARCH_TERMINAL_STATES.includes(state) ? {
      state,
      summary: String(input?.summary ?? "").slice(0, 600),
      sourceUrls: [...new Set((input?.sourceUrls ?? input?.source_urls ?? [])
        .filter((url) => String(url).startsWith("https://")))].slice(0, 12),
    } : null];
  }));
}

export function mergeDossierCompletionMatrix(baseline = {}, update = {}) {
  const left = normalizedMatrix(baseline);
  const right = normalizedMatrix(update);
  return Object.fromEntries(DEEP_RESEARCH_DOMAIN_KEYS.map((key) => [key, right[key] ?? left[key] ?? {
    state: "NOT_RESEARCHED", summary: "", sourceUrls: [],
  }]));
}

export function evaluateDossierCompletion(matrix = {}) {
  const normalized = mergeDossierCompletionMatrix({}, matrix);
  const scoreByState = {
    VERIFIED: 1,
    PARTIALLY_VERIFIED: 0.85,
    RESEARCHED_NOT_FOUND: 1,
    EVIDENCE_FOUND_REVIEW_PENDING: 0.25,
    CONFLICT: 0.65,
    UNAVAILABLE: 1,
    NOT_APPLICABLE: 1,
    NOT_RESEARCHED: 0,
  };
  const counts = Object.fromEntries([...DEEP_RESEARCH_TERMINAL_STATES, "NOT_RESEARCHED"]
    .map((state) => [state, DEEP_RESEARCH_DOMAIN_KEYS.filter((key) => normalized[key].state === state).length]));
  const totalWeight = DEEP_RESEARCH_DOSSIER_V2.domains.reduce((sum, domain) => sum + domain.weight, 0);
  const completedWeight = DEEP_RESEARCH_DOSSIER_V2.domains.reduce(
    (sum, domain) => sum + domain.weight * (scoreByState[normalized[domain.key].state] ?? 0), 0,
  );
  const completionScore = Math.round(completedWeight / totalWeight * 10_000) / 10_000;
  const criticalComplete = DEEP_RESEARCH_DOSSIER_V2.domains
    .filter((domain) => domain.critical)
    .every((domain) => normalized[domain.key].state !== "NOT_RESEARCHED");
  const identityResolved = new Set(["VERIFIED", "PARTIALLY_VERIFIED"])
    .has(normalized.identity_structure.state);
  const deep = counts.NOT_RESEARCHED === 0
    && criticalComplete
    && identityResolved
    && completionScore >= DEEP_RESEARCH_DOSSIER_V2.deepCompletionThreshold;
  return {
    contractId: DEEP_RESEARCH_DOSSIER_V2.contractId,
    contractVersion: DEEP_RESEARCH_DOSSIER_V2.contractVersion,
    requiredDomainCount: DEEP_RESEARCH_DOMAIN_KEYS.length,
    completionScore,
    counts,
    criticalComplete, identityResolved,
    deep,
    outcome: deep ? "DEEP" : "PARTIAL",
    matrix: normalized,
  };
}

export function classifyDossierRequest({ completionMatrix = {}, approvedFields = [], researchedAt = null, now = new Date() } = {}) {
  const completion = evaluateDossierCompletion(completionMatrix);
  const hasV2Attempt = Object.values(completionMatrix ?? {}).some(Boolean);
  const ageMs = researchedAt ? now.getTime() - new Date(researchedAt).getTime() : Number.POSITIVE_INFINITY;
  const stale = Number.isFinite(ageMs) && ageMs > DEEP_RESEARCH_DOSSIER_V2.currentForDays * 86_400_000;
  let requestClass = "FULL";
  if (completion.deep) requestClass = stale ? "REFRESH" : "NO_OP";
  else if (hasV2Attempt) requestClass = "DELTA";
  const volatile = new Set([
    "visa", "application_requirements", "current_resident_roster", "resident_medical_schools",
    "resident_composition", "program_leadership", "core_faculty", "board_pass_rate",
    "in_house_fellowships", "salary_benefits",
  ]);
  let requestedDomains;
  if (requestClass === "FULL") requestedDomains = [...DEEP_RESEARCH_DOMAIN_KEYS];
  else if (requestClass === "REFRESH") requestedDomains = DEEP_RESEARCH_DOMAIN_KEYS.filter((key) => volatile.has(key));
  else if (requestClass === "DELTA") requestedDomains = DEEP_RESEARCH_DOMAIN_KEYS.filter((key) => {
    const state = completion.matrix[key]?.state;
    return !["VERIFIED", "RESEARCHED_NOT_FOUND", "UNAVAILABLE", "NOT_APPLICABLE"].includes(state);
  });
  else requestedDomains = [];
  // Existing canonical fields improve the research context, but they are not a
  // Dossier V2 domain-attempt receipt. The first V2 run must attempt all 18
  // domains so terminal rows cannot strand NOT_RESEARCHED states.
  const requestedFields = [...new Set(DEEP_RESEARCH_DOSSIER_V2.domains
    .filter((domain) => requestedDomains.includes(domain.key)).flatMap((domain) => domain.fields))];
  return { requestClass, requestedDomains, requestedFields, completion, stale };
}

export function studentResearchStatus(status) {
  return ({
    QUEUED: "QUEUED", LEASED: "RESEARCHING", RUNNING: "RESEARCHING",
    NORMALIZING: "PROCESSING_REVIEWING", PROMOTING: "PROCESSING_REVIEWING",
    COMPLETED: "UPDATED", PARTIAL: "PARTIAL", NEEDS_REVIEW: "PROCESSING_REVIEWING",
    FAILED: "FAILED_REQUEST_RESTORED", CANCELLED: "FAILED_REQUEST_RESTORED",
    REFUNDED: "FAILED_REQUEST_RESTORED", PAUSED: "QUEUED",
  })[status] ?? "QUEUED";
}

export function publicResearchControls(controls, providers = []) {
  const normalized = normalizeResearchControls(controls);
  return {
    buildMode: RESEARCH_ROUTER_CONFIG.buildMode,
    globalEnabled: normalized.globalEnabled,
    studentEnabled: normalized.studentEnabled,
    emergencyKillSwitch: normalized.emergencyKillSwitch,
    specialtyScope: normalized.specialtyScope,
    stateScope: normalized.stateScope,
    canaryMode: normalized.canaryMode,
    canaryProgramIds: normalized.canaryProgramIds,
    canaryProgramCount: normalized.canaryProgramIds.length,
    entitlementScope: normalized.entitlementScope,
    subjectCanaryRequired: normalized.subjectAllowlistHashes.length > 0,
    subjectCanaryCount: normalized.subjectAllowlistHashes.length,
    defaultQuota: normalized.defaultQuota,
    quotaWindowDays: normalized.quotaWindowDays,
    budgetCapUsd: normalized.budgetCapUsd,
    actualSpendUsd: Number(controls?.actualSpendUsd ?? 0),
    reservedSpendUsd: Number(controls?.reservedSpendUsd ?? 0),
    concurrencyCap: normalized.concurrencyCap,
    primaryProvider: normalized.primaryProvider,
    fallbackProvider: normalized.fallbackProvider,
    escalationProvider: normalized.escalationProvider,
    providers: providers.map((provider) => {
      const route = normalizeProviderRoute(provider);
      return {
        ...route,
        realProvider: route.providerKey !== "RISE_REPLAY_TEST",
      };
    }),
    unapprovedProviderSpendUsd: 0,
  };
}
