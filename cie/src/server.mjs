import { createServer as createNodeServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CieApiAdapter } from "./apiAdapter.mjs";
import { createAuthorityAdapter } from "./authority.mjs";
import { sha256 } from "./canonical.mjs";
import { FileCieRepository } from "./repository/fileRepository.mjs";
import { CieService } from "./service.mjs";

const MAX_BODY_BYTES = 256 * 1024;
const SAFE_PATH_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/u;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);
const PUBLIC_DIRECTORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
const STATIC_SECURITY_HEADERS = Object.freeze({
  "cache-control": "no-store",
  "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; media-src 'self' https://*.videodelivery.net https://*.cloudflarestream.com blob:; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "x-robots-tag": "noindex, nofollow, noarchive"
});
const LOCAL_CONSENT_POLICY = Object.freeze({
  policy_version: "synthetic-local-c0-v1",
  policy_text_hash: sha256("MissionMed CIE synthetic local foundation consent"),
  locale: "en-US",
  retention_policy_ref: "synthetic-local-delete-after-test"
});

async function readJson(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("Request body exceeds 256 KiB");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function localAuthSource(headers) {
  const subject = headers["x-cie-local-subject"];
  const role = headers["x-cie-local-role"];
  if (!subject || !role) return null;
  return {
    subject_id: String(subject),
    role: String(role),
    capabilities: String(headers["x-cie-local-capabilities"] || "").split(",").map((value) => value.trim()).filter(Boolean),
    authority_session_ref: String(headers["x-cie-local-session"] || `local-${subject}`)
  };
}

function write(response, result) {
  response.writeHead(result.status, {
    ...result.headers,
    "cache-control": "no-store",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff"
  });
  response.end(`${JSON.stringify(result.body)}\n`);
}

function writeStatic(response, contentType, body) {
  response.writeHead(200, { ...STATIC_SECURITY_HEADERS, "content-type": contentType });
  response.end(body);
}

function isReviewPath(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  return parts.length === 3 && parts[0] === "review" && SAFE_PATH_ID.test(parts[1]) && SAFE_PATH_ID.test(parts[2]);
}

export async function createLocalCieServer(options = {}) {
  if ((options.runtimeMode || process.env.CIE_RUNTIME_MODE) !== "local") throw new Error("CIE local server refuses to start outside explicit local mode");
  const host = options.host || process.env.CIE_LOCAL_HOST || "127.0.0.1";
  if (!LOOPBACK_HOSTS.has(host)) throw new Error("CIE local server requires an explicit loopback host");
  const statePath = options.statePath || process.env.CIE_LOCAL_STATE_PATH || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.local/cie-state.json");
  const witnessPath = options.witnessPath || process.env.CIE_LOCAL_WITNESS_PATH || undefined;
  const repository = await FileCieRepository.open(statePath, { witnessPath });
  const serviceOptions = { ...options.serviceOptions };
  if (!serviceOptions.consentPolicy) serviceOptions.consentPolicy = async () => LOCAL_CONSENT_POLICY;
  const service = new CieService(repository, serviceOptions);
  const adapter = new CieApiAdapter(service);
  const localAuthority = createAuthorityAdapter(async (source) => source, "cie-local-test-authority");
  const [reviewHtml, reviewCss, reviewJavaScript] = await Promise.all([
    readFile(path.join(PUBLIC_DIRECTORY, "review.html")),
    readFile(path.join(PUBLIC_DIRECTORY, "review.css")),
    readFile(path.join(PUBLIC_DIRECTORY, "review.js"))
  ]);
  const server = createNodeServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (request.method === "GET" && isReviewPath(url.pathname)) return writeStatic(response, "text/html; charset=utf-8", reviewHtml);
    if (request.method === "GET" && url.pathname === "/cie/review.css") return writeStatic(response, "text/css; charset=utf-8", reviewCss);
    if (request.method === "GET" && url.pathname === "/cie/review.js") return writeStatic(response, "text/javascript; charset=utf-8", reviewJavaScript);
    if (request.method === "GET" && url.pathname === "/health") {
      return write(response, { status: 200, headers: { "content-type": "application/json; charset=utf-8" }, body: { ok: true, service: "missionmed-cie-c0", runtime_mode: "local", production_ready: false } });
    }
    try {
      const body = ["POST", "PUT", "PATCH"].includes(request.method || "") ? await readJson(request) : {};
      const authSource = localAuthSource(request.headers);
      const auth = authSource ? await localAuthority.verify(authSource) : null;
      const result = await adapter.handle({ method: request.method, path: url.pathname, query: Object.fromEntries(url.searchParams), headers: request.headers, auth, body });
      return write(response, result);
    } catch (error) {
      return write(response, { status: error.status || 400, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }, body: { ok: false, error: { code: error.status === 413 ? "BODY_TOO_LARGE" : "INVALID_JSON", message: error.status === 413 ? "Request body exceeds 256 KiB" : "Request body is invalid" } } });
    }
  });
  return { server, repository, service, adapter, host };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { server, host } = await createLocalCieServer();
  const port = Number(process.env.PORT || 4321);
  server.listen(port, host, () => process.stdout.write(`CIE C0 local API listening on http://${host}:${port}\n`));
}
