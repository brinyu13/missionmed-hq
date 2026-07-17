import { createServer as createNodeServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CieApiAdapter } from "./apiAdapter.mjs";
import { createAuthorityAdapter } from "./authority.mjs";
import { FileCieRepository } from "./repository/fileRepository.mjs";
import { CieService } from "./service.mjs";

const MAX_BODY_BYTES = 256 * 1024;

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
  response.writeHead(result.status, { ...result.headers, "content-security-policy": "default-src 'none'; frame-ancestors 'none'", "x-content-type-options": "nosniff" });
  response.end(`${JSON.stringify(result.body)}\n`);
}

export async function createLocalCieServer(options = {}) {
  if ((options.runtimeMode || process.env.CIE_RUNTIME_MODE) !== "local") throw new Error("CIE local server refuses to start outside explicit local mode");
  const statePath = options.statePath || process.env.CIE_LOCAL_STATE_PATH || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.local/cie-state.json");
  const repository = await FileCieRepository.open(statePath);
  const service = new CieService(repository, options.serviceOptions);
  const adapter = new CieApiAdapter(service);
  const localAuthority = createAuthorityAdapter(async (source) => source, "cie-local-test-authority");
  const server = createNodeServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
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
  return { server, repository, service, adapter };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { server } = await createLocalCieServer();
  const host = process.env.CIE_LOCAL_HOST || "127.0.0.1";
  const port = Number(process.env.PORT || 4321);
  server.listen(port, host, () => process.stdout.write(`CIE C0 local API listening on http://${host}:${port}\n`));
}
