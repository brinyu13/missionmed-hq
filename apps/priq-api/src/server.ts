import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { extname, join, resolve } from "node:path";
import { BudgetExceeded, BudgetLedger, MirRuntime, PolicyDenied, type MirProvider, type MirRequest, type PriqRole, type RouteTable } from "../../../packages/mir-core/src/index.ts";
import { OpenAIResponsesProvider, ProviderConfigurationError, UnconfiguredProvider } from "../../../packages/mir-providers/src/index.ts";
import { AuditLedger } from "../../../packages/mir-telemetry/src/index.ts";
import { PriqRepository, studentProjection, validateUploadManifest, type PrivateUploadManifestItem } from "./domain.ts";
import { CueGovernor, FeatureController } from "./features.ts";
import { siblingReality } from "./integrations.ts";
import { approvedPublicSources, PERSON_ID, PROGRAM_ID, resolveConradFischer, sourceTypeCoverage, SUBJECT_ID } from "./research.ts";
import { developmentFixture } from "./development-fixture.ts";
import { deriveUiStates } from "./state.ts";
import { establishBrowserSession, exchangeBearerPrincipal, principal, PriqAuthError, type PriqPrincipal } from "./auth.ts";
import { aiFeatureRegistry, buildAskRequest, buildCopilotRequest, buildDebriefRequest, buildFounderNoteRequest, buildProfileLabRequest, buildPublicResearchRequest } from "./ai-features.ts";
import { buildProfileRequest, materializeClaims } from "./profile.ts";

const publicRoot = process.env.PRIQ_WEB_ROOT ? resolve(process.env.PRIQ_WEB_ROOT) : join(process.cwd(), "apps/priq-web/public");
const routesConfig = JSON.parse(readFileSync(join(process.cwd(), "config/priq/mir-routes.json"), "utf8")) as { routes: RouteTable };
const openai = new OpenAIResponsesProvider();
const providers = new Map<string, MirProvider>([
  ["openai", openai],
  ["local-worker", new UnconfiguredProvider("local-worker")],
]);
const flags = new FeatureController();
const audit = new AuditLedger();
const tenantId = "missionmed-local-foundation";
const runtime = new MirRuntime(providers, routesConfig.routes as RouteTable, new BudgetLedger(
  Number(process.env.MIR_DAILY_BUDGET_USD ?? "8"), Number(process.env.MIR_MONTHLY_BUDGET_USD ?? "250"),
), () => flags.get().mirEnabled);
const repository = new PriqRepository([{
  subject: developmentFixture.subject,
  program: developmentFixture.program,
  person: developmentFixture.person,
  sources: approvedPublicSources, claims: [], founderReviewStatus: "not_started",
}]);
const controlSettings = {
  monthlyBudgetUsd: Number(process.env.MIR_MONTHLY_BUDGET_USD ?? "250"),
  providerRoute: "openai:gpt-5.6-sol",
  cueMinGapSeconds: 20,
  persistence: "local in-memory provisional",
};
let cueGovernor = new CueGovernor(controlSettings.cueMinGapSeconds * 1_000);
let hydration = { enabled: false, epoch: 0, changedAt: null as string | null, changedBy: null as string | null };

class HttpError extends Error { constructor(readonly status: number, message: string) { super(message); } }
function requireRole(role: PriqRole, allowed: PriqRole[]): void { if (!allowed.includes(role)) throw new HttpError(403, "ROLE_DENIED"); }
function requireHydration(): void { if (!flags.get().hydrationEnabled || !hydration.enabled) throw new HttpError(409, "FOUNDER_HYDRATION_REQUIRED"); }

async function body<T>(req: IncomingMessage): Promise<T> {
  let raw = "";
  for await (const chunk of req) { raw += chunk; if (raw.length > 1_000_000) throw new HttpError(413, "BODY_TOO_LARGE"); }
  try { return JSON.parse(raw) as T; } catch { throw new HttpError(400, "INVALID_JSON"); }
}

function send(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8", "cache-control": "no-store",
    "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  });
  res.end(JSON.stringify(payload));
}

function authEntry(res: ServerResponse): void {
  const nonce = randomBytes(16).toString("base64");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PRIQ secure entry</title><style nonce="${nonce}">body{font:16px system-ui;max-width:42rem;margin:10vh auto;padding:2rem;color:#18202a}#status{font-weight:650}</style></head><body><h1>PRIQ secure entry</h1><p id="status">Authenticated MissionMed server handoff required.</p><p>This development runtime is closed to students. Browser tokens and URL-fragment credentials are not accepted.</p></body></html>`;
  res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "content-security-policy": `default-src 'none'; style-src 'nonce-${nonce}'; frame-ancestors 'none'` });
  res.end(html);
}

async function invokeFeature(actor: PriqPrincipal, feature: string, request: MirRequest): Promise<{ output: unknown; telemetry: Record<string, unknown> }> {
  requireHydration();
  const output = await runtime.invoke(request);
  const run = runtime.runs.at(-1);
  if (!run || run.status !== "succeeded") throw new HttpError(502, "MODEL_RUN_NOT_RECORDED");
  audit.record({ tenantId, actorId: actor.userId, action: "ai_feature.invoked", targetType: "ai_feature", targetId: feature, metadata: { modelRunId: run.id, provider: run.provider, model: run.model, costUsd: run.costUsd, latencyMs: run.latencyMs } });
  return {
    output,
    telemetry: { modelRunId: run.id, provider: run.provider, model: run.model, latencyMs: run.latencyMs, inputTokens: run.inputTokens, outputTokens: run.outputTokens, estimatedCostUsd: run.costUsd, httpStatusCategory: run.httpStatusCategory ?? null },
  };
}

async function api(req: IncomingMessage, res: ServerResponse, path: string): Promise<boolean> {
  if (!path.startsWith("/api/") && path !== "/health") return false;
  if (path === "/health" && req.method === "GET") {
    const provider = await openai.health();
    send(res, 200, { status: "ok", provider: { configured: provider.configured }, access: "founder-admin-only", studentAccess: false, hydrationEnabled: flags.get().hydrationEnabled });
    return true;
  }
  if (path === "/api/auth/exchange" && req.method === "POST") {
    const actor = await exchangeBearerPrincipal(req);
    res.setHeader("set-cookie", establishBrowserSession(actor));
    send(res, 200, { authenticated: true, role: actor.role, studentAccess: false });
    return true;
  }
  const actor = await principal(req);
  if (path === "/api/workspace" && req.method === "GET") {
    requireRole(actor.role, ["founder", "admin", "coach"]);
    send(res, 200, repository.get(SUBJECT_ID)); return true;
  }
  if (path === "/api/research" && req.method === "GET") {
    requireRole(actor.role, ["founder", "admin", "coach"]); flags.require("researchEnabled");
    send(res, 200, { identity: resolveConradFischer(approvedPublicSources), coverage: sourceTypeCoverage(approvedPublicSources), sources: approvedPublicSources }); return true;
  }
  if (path === "/api/ui-state" && req.method === "GET") {
    requireRole(actor.role, ["founder", "admin", "coach"]);
    const provider = await openai.health();
    const coverage = sourceTypeCoverage(approvedPublicSources);
    const workspace = repository.get(SUBJECT_ID);
    send(res, 200, {
      fixture: developmentFixture,
      states: deriveUiStates({
        flags: flags.get(), credentialConfigured: provider.configured, restrictedProviderApproved: openai.restrictedDataApproved,
        authorizedPrivatePacket: false, audiovisualSource: coverage.hasAudiovisual, researchInProgress: false,
        founderApproved: workspace?.founderReviewStatus === "approved",
      }),
      flags: flags.get(), settings: controlSettings, provider: { configured: provider.configured }, coverage,
      access: { role: actor.role, founderAdminOnly: true, studentAccess: false },
      hydration, aiFeatures: aiFeatureRegistry,
      runtime: { budget: runtime.budget.snapshot(), runCount: runtime.runs.length, lastLatencyMs: runtime.runs.at(-1)?.latencyMs ?? null },
      authority: { persistence: controlSettings.persistence, developmentConnected: process.env.PRIQ_ENV === "development", productionConnected: false, migrationsApplied: false },
    });
    return true;
  }
  if (path === "/api/profile/readiness" && req.method === "GET") {
    requireRole(actor.role, ["founder", "admin", "coach"]);
    const provider = await openai.health();
    const coverage = sourceTypeCoverage(approvedPublicSources);
    send(res, 200, {
      ready: false,
      gates: {
        authorizedPrivatePacket: false,
        providerCredential: provider.configured,
        restrictedDataProviderApproval: openai.restrictedDataApproved,
        audiovisualSource: coverage.hasAudiovisual,
        founderReview: false,
      },
      nextAction: "Provide an authorized, non-committed Ezechiel manifest and record provider data approval before any restricted-data model call.",
    });
    return true;
  }
  if (path === "/api/intake/validate" && req.method === "POST") {
    requireRole(actor.role, ["founder", "admin"]); flags.require("intakeEnabled");
    const item = await body<PrivateUploadManifestItem>(req); const errors = validateUploadManifest(item);
    send(res, errors.length ? 422 : 200, { accepted: errors.length === 0, errors, note: "Validation does not persist file bytes." }); return true;
  }
  if (path === "/api/ai/features" && req.method === "GET") {
    requireRole(actor.role, ["founder", "admin"]);
    send(res, 200, { hydration, features: aiFeatureRegistry, studentAccess: false }); return true;
  }
  if (path === "/api/ai/ask" && req.method === "POST") {
    requireRole(actor.role, ["founder", "admin"]); flags.require("researchEnabled");
    const input = await body<{ question: string }>(req);
    if (!input.question?.trim() || input.question.length > 4_000) throw new HttpError(422, "QUESTION_REQUIRED");
    send(res, 200, await invokeFeature(actor, "ask", buildAskRequest(actor, input.question.trim(), approvedPublicSources))); return true;
  }
  if (path === "/api/ai/research" && req.method === "POST") {
    requireRole(actor.role, ["founder", "admin"]); flags.require("researchEnabled");
    send(res, 200, await invokeFeature(actor, "public_research", buildPublicResearchRequest(actor, approvedPublicSources))); return true;
  }
  if (path === "/api/ai/profile" && req.method === "POST") {
    requireRole(actor.role, ["founder", "admin"]); flags.require("profileEnabled"); requireHydration();
    const request = buildProfileRequest({ tenantId, userId: actor.userId, role: actor.role, subjectIds: [SUBJECT_ID], dataClasses: ["public_professional"], feature: "profile", requestId: randomUUID() }, approvedPublicSources);
    const result = await invokeFeature(actor, "profile", request);
    const workspace = repository.get(SUBJECT_ID); if (!workspace) throw new HttpError(404, "SUBJECT_NOT_FOUND");
    const claims = materializeClaims(result.output, approvedPublicSources, SUBJECT_ID, actor.userId);
    repository.save({ ...workspace, claims: [...workspace.claims, ...claims], founderReviewStatus: "in_review" });
    send(res, 200, { claimsCreated: claims.length, reviewRequired: true, studentPublished: false, telemetry: result.telemetry }); return true;
  }
  if (path === "/api/ai/copilot" && req.method === "POST") {
    requireRole(actor.role, ["founder", "admin"]); flags.require("liveCopilotEnabled");
    const input = await body<{ transcript: string; synthetic?: boolean }>(req);
    if (!input.transcript?.trim() || input.transcript.length > 20_000) throw new HttpError(422, "TRANSCRIPT_REQUIRED");
    send(res, 200, await invokeFeature(actor, "live_copilot", buildCopilotRequest(actor, input.transcript, input.synthetic === true))); return true;
  }
  if (path === "/api/ai/debrief" && req.method === "POST") {
    requireRole(actor.role, ["founder", "admin"]); flags.require("debriefEnabled");
    const input = await body<{ synthetic?: boolean; transcript?: string; cueIds?: string[]; founderNotes?: string[] }>(req);
    if (!input.transcript?.trim() && !input.cueIds?.length && !input.founderNotes?.length) throw new HttpError(422, "DEBRIEF_EVIDENCE_REQUIRED");
    send(res, 200, await invokeFeature(actor, "debrief", buildDebriefRequest(actor, { transcript: input.transcript?.slice(0, 20_000) ?? "", cueIds: input.cueIds?.slice(0, 100) ?? [], founderNotes: input.founderNotes?.slice(0, 100) ?? [] }, input.synthetic === true))); return true;
  }
  if (path === "/api/ai/profile-lab" && req.method === "POST") {
    requireRole(actor.role, ["founder", "admin"]); flags.require("profileLabEnabled");
    const input = await body<{ question: string }>(req);
    if (!input.question?.trim() || input.question.length > 4_000) throw new HttpError(422, "LAB_QUESTION_REQUIRED");
    send(res, 200, await invokeFeature(actor, "profile_lab", buildProfileLabRequest(actor, input.question.trim(), approvedPublicSources))); return true;
  }
  if (path === "/api/ai/founder-note" && req.method === "POST") {
    requireRole(actor.role, ["founder"]); flags.require("founderNoteAiUseEnabled");
    const input = await body<{ note: string }>(req);
    if (!input.note?.trim() || input.note.length > 4_000) throw new HttpError(422, "FOUNDER_NOTE_REQUIRED");
    send(res, 200, await invokeFeature(actor, "founder_note", buildFounderNoteRequest(actor, input.note.trim()))); return true;
  }
  if (path === "/api/ai/video-analysis" && req.method === "POST") {
    requireRole(actor.role, ["founder", "admin"]); flags.require("videoAnalysisEnabled"); requireHydration();
    throw new HttpError(409, "AUTHORIZED_MEDIA_ADAPTER_REQUIRED");
  }
  if (path === "/api/student/report" && req.method === "GET") {
    requireRole(actor.role, ["founder", "admin"]);
    if (!flags.get().studentWorkspaceEnabled || !flags.get().studentPublicationEnabled) throw new Error("FEATURE_DISABLED:studentAccessLockedOff");
    const workspace = repository.get(SUBJECT_ID); if (!workspace) throw new HttpError(404, "SUBJECT_NOT_FOUND");
    send(res, 200, studentProjection(workspace)); return true;
  }
  if (path === "/api/copilot/cues" && req.method === "POST") {
    requireRole(actor.role, ["founder", "admin", "coach"]);
    if (!flags.get().liveCopilotEnabled) throw new Error("FEATURE_DISABLED:liveCopilotEnabled");
    const input = await body<{ transcript: string; now?: number }>(req);
    if (!input.transcript?.trim()) throw new HttpError(422, "TRANSCRIPT_REQUIRED");
    send(res, 200, { cues: cueGovernor.detect(input.transcript.slice(0, 20_000), input.now), deterministic: true, externalAiUsed: false }); return true;
  }
  if (path === "/api/control/flags" && req.method === "GET") {
    requireRole(actor.role, ["founder", "admin"]); send(res, 200, flags.get()); return true;
  }
  if (path === "/api/control/hydration" && req.method === "POST") {
    requireRole(actor.role, ["founder"]);
    const update = await body<{ state: boolean; reason: string }>(req);
    if (typeof update.state !== "boolean" || !update.reason?.trim()) throw new HttpError(422, "HYDRATION_REASON_REQUIRED");
    if (update.state && !(await openai.health()).configured) throw new HttpError(503, "OPENAI_CREDENTIAL_HEALTH_ERROR");
    hydration = { enabled: update.state, epoch: hydration.epoch + 1, changedAt: new Date().toISOString(), changedBy: actor.userId };
    flags.setHydration(update.state);
    audit.record({ tenantId, actorId: actor.userId, action: update.state ? "hydration.released" : "hydration.paused", targetType: "runtime", targetId: "priq-hydration", metadata: { epoch: hydration.epoch, reason: update.reason.slice(0, 180), studentAccess: false } });
    send(res, 200, { hydration, studentAccess: false }); return true;
  }
  if (path === "/api/control/flags" && req.method === "PATCH") {
    requireRole(actor.role, ["founder"]); const update = await body<{ key: keyof ReturnType<FeatureController["get"]>; value: boolean }>(req);
    if (!(update.key in flags.get()) || typeof update.value !== "boolean") throw new HttpError(422, "INVALID_FLAG_UPDATE");
    if (update.key === "humanReviewRequired" && update.value === false) throw new HttpError(423, "HUMAN_REVIEW_INTERLOCK");
    if (update.key === "hydrationEnabled") throw new HttpError(423, "HYDRATION_REQUIRES_FOUNDER_ACTION");
    if (update.value === true && ["studentWorkspaceEnabled", "studentPublicationEnabled", "studentWorkspaceOverrideEnabled"].includes(update.key)) throw new HttpError(423, "STUDENT_ACCESS_LOCKED_OFF");
    const previous = flags.get()[update.key];
    const updated = flags.set(update.key, update.value);
    audit.record({ tenantId, actorId: actor.userId, action: "feature_flag.updated", targetType: "feature_flag", targetId: update.key, metadata: { previous, enabled: update.value } });
    send(res, 200, updated); return true;
  }
  if (path === "/api/control/settings" && req.method === "PATCH") {
    requireRole(actor.role, ["founder"]);
    const update = await body<{ key: "monthlyBudgetUsd" | "providerRoute" | "cueMinGapSeconds"; value: number | string }>(req);
    if (!(update.key in controlSettings)) throw new HttpError(422, "INVALID_SETTING_UPDATE");
    if (update.key === "monthlyBudgetUsd" && (typeof update.value !== "number" || update.value < 1 || update.value > 10_000)) throw new HttpError(422, "INVALID_MONTHLY_BUDGET");
    if (update.key === "cueMinGapSeconds" && (typeof update.value !== "number" || update.value < 5 || update.value > 120)) throw new HttpError(422, "INVALID_CUE_GAP");
    if (update.key === "providerRoute" && !["openai:gpt-5.6-sol", "openai:gpt-5.6-terra", "openai:gpt-5.6-luna"].includes(String(update.value))) throw new HttpError(422, "INVALID_PROVIDER_ROUTE");
    const previous = controlSettings[update.key];
    (controlSettings as Record<string, number | string>)[update.key] = update.value;
    if (update.key === "monthlyBudgetUsd") runtime.budget.setMonthlyLimit(Number(update.value));
    if (update.key === "cueMinGapSeconds") cueGovernor = new CueGovernor(Number(update.value) * 1_000);
    if (update.key === "providerRoute") {
      const [providerName, model] = String(update.value).split(":");
      for (const route of Object.values(routesConfig.routes)) { route.provider = providerName; route.model = model; }
    }
    audit.record({ tenantId, actorId: actor.userId, action: "control_setting.updated", targetType: "control_setting", targetId: update.key, metadata: { previous, value: update.value } });
    send(res, 200, controlSettings); return true;
  }
  if (path === "/api/control/kill-switch" && req.method === "POST") {
    requireRole(actor.role, ["founder"]);
    const update = await body<{ state: boolean; reason: string }>(req);
    if (typeof update.state !== "boolean" || !update.reason?.trim()) throw new HttpError(422, "KILL_SWITCH_REASON_REQUIRED");
    const previous = !flags.get().mirEnabled;
    flags.set("mirEnabled", !update.state);
    audit.record({ tenantId, actorId: actor.userId, action: update.state ? "kill_switch.engaged" : "kill_switch.released", targetType: "runtime", targetId: "mir", metadata: { previous, state: update.state, reason: update.reason.slice(0, 180) } });
    send(res, 200, { killed: update.state, flags: flags.get() }); return true;
  }
  if (path === "/api/control/audit" && req.method === "GET") {
    requireRole(actor.role, ["founder", "admin"]); send(res, 200, audit.list(tenantId)); return true;
  }
  throw new HttpError(404, "API_NOT_FOUND");
}

async function staticFile(res: ServerResponse, path: string): Promise<void> {
  const relative = path === "/" ? "index.html" : path.slice(1);
  if (relative.includes("..")) throw new HttpError(400, "INVALID_PATH");
  const target = join(publicRoot, relative);
  try {
    let bytes: Buffer | string = await readFile(target);
    const type = ({ ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" } as Record<string, string>)[extname(target)] ?? "application/octet-stream";
    const nonce = randomBytes(16).toString("base64");
    if (relative === "index.html") {
      bytes = bytes.toString("utf8")
        .replace("<style>", `<style nonce="${nonce}">`)
        .replace("<script>", `<script nonce="${nonce}">`)
        .replace("</body>", `<script nonce="${nonce}" type="module" src="/priq/bootstrap.js"></script></body>`);
    }
    res.writeHead(200, { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff", "content-security-policy": `default-src 'self'; style-src-elem 'self' 'nonce-${nonce}' https://fonts.googleapis.com; style-src-attr 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; script-src-elem 'self' 'nonce-${nonce}'; script-src-attr 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'` });
    res.end(bytes);
  } catch { throw new HttpError(404, "NOT_FOUND"); }
}

export const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url ?? "/", "http://local").pathname;
    if (path === "/auth-entry" && req.method === "GET") authEntry(res);
    else if (!await api(req, res, path)) { await principal(req); await staticFile(res, path); }
  } catch (error) {
    const status = error instanceof HttpError || error instanceof PriqAuthError ? error.status
      : error instanceof ProviderConfigurationError ? 503
        : error instanceof BudgetExceeded ? 429
          : error instanceof PolicyDenied ? 403
      : error instanceof Error && (error.message.startsWith("FEATURE_DISABLED:") || error.message === "STUDENT_REPORT_NOT_PUBLISHED") ? 409
        : 500;
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    send(res, status, { error: message.startsWith("OPENAI_REQUEST_FAILED:") ? "PROVIDER_REQUEST_FAILED" : message });
  }
});

if (process.argv[1]?.endsWith("apps/priq-api/src/server.ts")) {
  const bind = process.env.PRIQ_BIND ?? "127.0.0.1";
  if (bind !== "127.0.0.1" && bind !== "::1" && process.env.PRIQ_AUTH_MODE !== "supabase") throw new Error("PRIQ_PUBLIC_BIND_REQUIRES_SUPABASE_AUTH");
  const port = Number(process.env.PORT ?? process.env.PRIQ_PORT ?? "4310");
  server.listen(port, bind, () => process.stdout.write(`PRIQ ${process.env.PRIQ_ENV ?? "local"} runtime listening on ${bind}:${port}\n`));
}
