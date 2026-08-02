import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { extname, join, resolve } from "node:path";
import { BudgetLedger, MirRuntime, type MirProvider, type PriqRole, type RouteTable } from "../../../packages/mir-core/src/index.ts";
import { OpenAIResponsesProvider, UnconfiguredProvider } from "../../../packages/mir-providers/src/index.ts";
import { AuditLedger } from "../../../packages/mir-telemetry/src/index.ts";
import { PriqRepository, studentProjection, validateUploadManifest, type PrivateUploadManifestItem } from "./domain.ts";
import { CueGovernor, FeatureController } from "./features.ts";
import { siblingReality } from "./integrations.ts";
import { approvedPublicSources, PERSON_ID, PROGRAM_ID, resolveConradFischer, sourceTypeCoverage, SUBJECT_ID } from "./research.ts";
import { developmentFixture } from "./development-fixture.ts";
import { deriveUiStates } from "./state.ts";

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

function principal(req: IncomingMessage): { userId: string; role: PriqRole } {
  if (process.env.PRIQ_DEV_AUTH !== "true") throw new HttpError(503, "OIDC_NOT_CONFIGURED");
  const remote = req.socket.remoteAddress ?? "";
  if (!remote.includes("127.0.0.1") && remote !== "::1") throw new HttpError(403, "DEV_AUTH_LOOPBACK_ONLY");
  const role = String(req.headers["x-priq-role"] ?? "founder") as PriqRole;
  if (!(["founder", "admin", "coach", "student", "service"] as string[]).includes(role)) throw new HttpError(403, "INVALID_ROLE");
  return { userId: String(req.headers["x-priq-user"] ?? "local-founder"), role };
}

class HttpError extends Error { constructor(readonly status: number, message: string) { super(message); } }
function requireRole(role: PriqRole, allowed: PriqRole[]): void { if (!allowed.includes(role)) throw new HttpError(403, "ROLE_DENIED"); }

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

async function api(req: IncomingMessage, res: ServerResponse, path: string): Promise<boolean> {
  if (!path.startsWith("/api/") && path !== "/health") return false;
  const actor = principal(req);
  if (path === "/health" && req.method === "GET") {
    const provider = await openai.health();
    send(res, 200, { status: provider.configured ? "degraded" : "blocked", provider, flags: flags.get(), budget: runtime.budget.snapshot(), persistence: "in-memory; migration candidate not applied", integrations: siblingReality });
    return true;
  }
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
      flags: flags.get(), settings: controlSettings, provider, coverage,
      runtime: { budget: runtime.budget.snapshot(), runCount: runtime.runs.length, lastLatencyMs: runtime.runs.at(-1)?.latencyMs ?? null },
      authority: { persistence: controlSettings.persistence, productionConnected: false, migrationsApplied: false },
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
  if (path === "/api/student/report" && req.method === "GET") {
    requireRole(actor.role, ["founder", "admin", "student"]);
    if (!flags.get().studentWorkspaceEnabled && !flags.get().studentWorkspaceOverrideEnabled) throw new Error("FEATURE_DISABLED:studentWorkspaceAccess");
    flags.require("studentPublicationEnabled");
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
  if (path === "/api/control/flags" && req.method === "PATCH") {
    requireRole(actor.role, ["founder"]); const update = await body<{ key: keyof ReturnType<FeatureController["get"]>; value: boolean }>(req);
    if (!(update.key in flags.get()) || typeof update.value !== "boolean") throw new HttpError(422, "INVALID_FLAG_UPDATE");
    if (update.key === "humanReviewRequired" && update.value === false) throw new HttpError(423, "HUMAN_REVIEW_INTERLOCK");
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
    if (!await api(req, res, path)) await staticFile(res, path);
  } catch (error) {
    const status = error instanceof HttpError ? error.status
      : error instanceof Error && (error.message.startsWith("FEATURE_DISABLED:") || error.message === "STUDENT_REPORT_NOT_PUBLISHED") ? 409
        : 500;
    send(res, status, { error: error instanceof Error ? error.message : "UNKNOWN_ERROR" });
  }
});

if (process.argv[1]?.endsWith("apps/priq-api/src/server.ts")) {
  const bind = process.env.PRIQ_BIND ?? "127.0.0.1";
  if (bind !== "127.0.0.1" && bind !== "::1") throw new Error("PRIQ_BIND_MUST_BE_LOOPBACK_UNTIL_OIDC_IS_CONFIGURED");
  server.listen(Number(process.env.PRIQ_PORT ?? "4310"), bind, () => process.stdout.write(`PRIQ local foundation: http://${bind}:${process.env.PRIQ_PORT ?? "4310"}\n`));
}
