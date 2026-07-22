const DEFAULT_TIMEOUT_MS = 2_000;
const MAX_RESPONSE_BYTES = 16 * 1024;
const MAX_DECISION_AGE_MS = 60_000;
const MAX_DECISION_LIFETIME_MS = 5 * 60_000;
const MAX_AUTHORIZATIONS = 32;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function requiredString(value, name, minimumLength = 1) {
  const normalized = String(value ?? "").trim();
  if (normalized.length < minimumLength) throw new Error(`${name} is required`);
  return normalized;
}

function controlEndpoint(value, { allowInsecureLoopback = false } = {}) {
  const url = new URL(requiredString(value, "RISE_SOURCE_RIGHTS_CONTROL_URL"));
  const loopback = new Set(["127.0.0.1", "localhost", "::1"]);
  if (url.username || url.password || url.hash || url.search) {
    throw new Error("RISE_SOURCE_RIGHTS_CONTROL_URL must be an exact endpoint without credentials or query data");
  }
  if (url.protocol !== "https:" && !(allowInsecureLoopback && url.protocol === "http:" && loopback.has(url.hostname))) {
    throw new Error("RISE_SOURCE_RIGHTS_CONTROL_URL must use HTTPS");
  }
  return url;
}

function normalizedSha256s(value) {
  if (!Array.isArray(value) || !value.length || value.length > MAX_AUTHORIZATIONS) return null;
  const normalized = [...new Set(value.map((item) => String(item).trim().toLowerCase()))].sort();
  return normalized.every((item) => SHA256_PATTERN.test(item)) ? normalized : null;
}

async function readLimitedJson(response) {
  if (Number(response.headers.get("content-length") ?? 0) > MAX_RESPONSE_BYTES) {
    throw new Error("Source-rights response exceeds the RISE limit");
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of response.body ?? []) {
    const bytes = Buffer.from(chunk);
    total += bytes.length;
    if (total > MAX_RESPONSE_BYTES) throw new Error("Source-rights response exceeds the RISE limit");
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function validDecision(payload, request, now) {
  const checkedAt = Date.parse(String(payload?.checkedAt ?? ""));
  const validUntil = Date.parse(String(payload?.validUntil ?? ""));
  const responseSha256s = normalizedSha256s(payload?.authorizationSha256s);
  return payload?.schemaVersion === 1 &&
    payload?.current === true &&
    payload?.registryReleaseId === request.registryReleaseId &&
    Array.isArray(responseSha256s) &&
    responseSha256s.length === request.authorizationSha256s.length &&
    responseSha256s.every((sha256, index) => sha256 === request.authorizationSha256s[index]) &&
    Number.isFinite(checkedAt) && checkedAt <= now + 5_000 && now - checkedAt <= MAX_DECISION_AGE_MS &&
    Number.isFinite(validUntil) && validUntil > now && validUntil >= checkedAt &&
    validUntil - checkedAt <= MAX_DECISION_LIFETIME_MS &&
    typeof payload?.decisionId === "string" && payload.decisionId.trim().length > 0;
}

export function createRiseSourceRightsController({
  controlUrl = process.env.RISE_SOURCE_RIGHTS_CONTROL_URL,
  bearerToken = process.env.RISE_SOURCE_RIGHTS_CONTROL_TOKEN,
  timeoutMs = Number.parseInt(process.env.RISE_SOURCE_RIGHTS_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS), 10),
  allowInsecureLoopback = process.env.RISE_ALLOW_INSECURE_LOOPBACK_SOURCE_RIGHTS === "true",
  fetchImpl = globalThis.fetch,
  now = Date.now,
} = {}) {
  const endpoint = controlEndpoint(controlUrl, { allowInsecureLoopback });
  const token = requiredString(bearerToken, "RISE_SOURCE_RIGHTS_CONTROL_TOKEN", 32);
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 250 || timeoutMs > 10_000) {
    throw new Error("RISE_SOURCE_RIGHTS_TIMEOUT_MS must be between 250 and 10000");
  }

  return {
    scope: "shared_durable_current",
    async assertCurrent({ registryReleaseId, authorizationSha256s }) {
      const request = {
        schemaVersion: 1,
        service: "missionmed-rise",
        registryReleaseId: String(registryReleaseId ?? "").trim(),
        authorizationSha256s: normalizedSha256s(authorizationSha256s),
      };
      if (!request.registryReleaseId || !request.authorizationSha256s) return false;
      try {
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request),
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok || !String(response.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
          return false;
        }
        const payload = await readLimitedJson(response);
        if (!validDecision(payload, request, now())) return false;
        return {
          current: true,
          decisionId: payload.decisionId.trim(),
          checkedAt: new Date(Date.parse(payload.checkedAt)).toISOString(),
          validUntil: new Date(Date.parse(payload.validUntil)).toISOString(),
        };
      } catch {
        return false;
      }
    },
  };
}
