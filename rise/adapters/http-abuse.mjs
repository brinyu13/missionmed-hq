const DEFAULT_TIMEOUT_MS = 2_000;
const MAX_RESPONSE_BYTES = 8 * 1024;

function requiredString(value, name, minimumLength = 1) {
  const normalized = String(value ?? "").trim();
  if (normalized.length < minimumLength) throw new Error(`${name} is required`);
  return normalized;
}

function controlEndpoint(value, { allowInsecureLoopback = false } = {}) {
  const url = new URL(requiredString(value, "RISE_ABUSE_CONTROL_URL"));
  const loopback = new Set(["127.0.0.1", "localhost", "::1"]);
  if (url.username || url.password || url.hash || url.search) {
    throw new Error("RISE_ABUSE_CONTROL_URL must be an exact endpoint without credentials or query data");
  }
  if (url.protocol !== "https:" && !(allowInsecureLoopback && url.protocol === "http:" && loopback.has(url.hostname))) {
    throw new Error("RISE_ABUSE_CONTROL_URL must use HTTPS");
  }
  return url;
}

function normalizeDecision(payload) {
  return payload?.schemaVersion === 1 && typeof payload.allowed === "boolean"
    ? payload.allowed
    : false;
}

async function readLimitedJson(response) {
  if (Number(response.headers.get("content-length") ?? 0) > MAX_RESPONSE_BYTES) {
    throw new Error("Abuse-controller response exceeds the RISE limit");
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of response.body ?? []) {
    const bytes = Buffer.from(chunk);
    total += bytes.length;
    if (total > MAX_RESPONSE_BYTES) throw new Error("Abuse-controller response exceeds the RISE limit");
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function createRiseAbuseController({
  controlUrl = process.env.RISE_ABUSE_CONTROL_URL,
  bearerToken = process.env.RISE_ABUSE_CONTROL_TOKEN,
  timeoutMs = Number.parseInt(process.env.RISE_ABUSE_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS), 10),
  allowInsecureLoopback = process.env.RISE_ALLOW_INSECURE_LOOPBACK_ABUSE === "true",
  fetchImpl = globalThis.fetch,
} = {}) {
  const endpoint = controlEndpoint(controlUrl, { allowInsecureLoopback });
  const token = requiredString(bearerToken, "RISE_ABUSE_CONTROL_TOKEN", 32);
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 250 || timeoutMs > 10_000) {
    throw new Error("RISE_ABUSE_TIMEOUT_MS must be between 250 and 10000");
  }

  async function allowed(scope, input) {
    const payload = {
      schemaVersion: 1,
      service: "missionmed-rise",
      scope,
      method: String(input.method ?? "GET").slice(0, 16),
      path: String(input.path ?? "/").slice(0, 512),
      cost: Math.min(100, Math.max(1, Number(input.cost) || 1)),
      ...(scope === "authenticated_subject" ? { subjectKey: String(input.subjectKey ?? "") } : {}),
    };
    if (scope === "authenticated_subject" && !/^[a-f0-9]{32}$/.test(payload.subjectKey)) return false;
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) return false;
      return normalizeDecision(await readLimitedJson(response));
    } catch {
      return false;
    }
  }

  return {
    scope: "shared_durable",
    allowPreAuth(input) {
      return allowed("pre_auth_global", input);
    },
    allowAuthenticatedSubject(input) {
      return allowed("authenticated_subject", input);
    },
  };
}
