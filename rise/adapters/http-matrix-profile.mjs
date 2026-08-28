const MAX_RESPONSE_BYTES = 256 * 1024;
const DEFAULT_TIMEOUT_MS = 7_500;
const WORDPRESS_COOKIE_PREFIXES = ["wordpress_", "wordpress_logged_in_", "wordpress_sec_"];

function requiredString(value, name) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${name} is required`);
  return normalized;
}

function profileEndpoint(value, { allowInsecureLoopback = false } = {}) {
  const url = new URL(requiredString(value, "RISE_MATRIX_PROFILE_URL"));
  const loopback = new Set(["127.0.0.1", "localhost", "::1"]);
  if (
    url.username || url.password || url.hash || url.search ||
    url.pathname !== "/wp-json/mmed/v1/profile/me" ||
    (url.protocol !== "https:" && !(allowInsecureLoopback && url.protocol === "http:" && loopback.has(url.hostname)))
  ) {
    throw new Error("RISE_MATRIX_PROFILE_URL must identify the exact HTTPS Matrix profile endpoint");
  }
  return url;
}

function cookieEntries(header) {
  return String(header ?? "").split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const separator = part.indexOf("=");
    return separator > 0 ? [part.slice(0, separator).trim(), part.slice(separator + 1).trim()] : ["", ""];
  });
}

function requestCredentials(request) {
  const entries = cookieEntries(request?.headers?.cookie);
  const wordpressCookies = entries.filter(([name]) => WORDPRESS_COOKIE_PREFIXES.some((prefix) => name.startsWith(prefix)));
  const nonceCookie = entries.find(([name]) => name === "mmed_rise_wp_nonce")?.[1] ?? "";
  const nonce = String(request?.headers?.["x-wp-nonce"] ?? nonceCookie).trim();
  if (!wordpressCookies.length || !/^[A-Za-z0-9_-]{8,64}$/.test(nonce)) {
    const error = new Error("Authenticated WordPress cookies and a valid Matrix REST nonce are required");
    error.code = "MATRIX_AUTH_REQUIRED";
    throw error;
  }
  return {
    cookie: wordpressCookies.map(([name, value]) => `${name}=${value}`).join("; "),
    nonce,
  };
}

async function parseJsonResponse(response) {
  if (!String(response.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    throw new Error("Matrix profile owner returned a non-JSON response");
  }
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_RESPONSE_BYTES) throw new Error("Matrix response exceeds the RISE limit");
  const chunks = [];
  let total = 0;
  for await (const chunk of response.body ?? []) {
    const bytes = Buffer.from(chunk);
    total += bytes.length;
    if (total > MAX_RESPONSE_BYTES) throw new Error("Matrix response exceeds the RISE limit");
    chunks.push(bytes);
  }
  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Matrix response must be an object");
  return parsed;
}

function subjectUserId(subject) {
  const match = /^wp:([1-9][0-9]{0,19})$/.exec(String(subject ?? ""));
  if (!match) {
    const error = new Error("RISE subject is not bound to a WordPress user");
    error.code = "MATRIX_SUBJECT_INVALID";
    throw error;
  }
  return match[1];
}

export function createMatrixProfileAdapter({
  profileUrl = process.env.RISE_MATRIX_PROFILE_URL,
  timeoutMs = Number.parseInt(process.env.RISE_MATRIX_PROFILE_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS), 10),
  allowInsecureLoopback = process.env.RISE_ALLOW_INSECURE_LOOPBACK_MATRIX_PROFILE === "true",
  fetchImpl = globalThis.fetch,
} = {}) {
  const endpoint = profileEndpoint(profileUrl, { allowInsecureLoopback });
  const identityUrl = new URL("/wp-json/wp/v2/users/me?context=edit", endpoint.origin);
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 250 || timeoutMs > 15_000) {
    throw new Error("RISE_MATRIX_PROFILE_TIMEOUT_MS must be between 250 and 15000");
  }

  async function requestOwner(url, { method = "GET", credentials, body } = {}) {
    let response;
    try {
      response = await fetchImpl(url, {
        method,
        headers: {
          Accept: "application/json",
          Cookie: credentials.cookie,
          "X-WP-Nonce": credentials.nonce,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      const error = new Error("Canonical Matrix profile owner is unavailable");
      error.code = "MATRIX_PROFILE_UPSTREAM_UNAVAILABLE";
      throw error;
    }
    if (!response.ok) {
      const error = new Error(`Canonical Matrix profile owner rejected the request with HTTP ${response.status}`);
      error.code = response.status === 401 || response.status === 403 ? "MATRIX_AUTH_REJECTED" : "MATRIX_PROFILE_UPSTREAM_REJECTED";
      throw error;
    }
    return parseJsonResponse(response);
  }

  async function verifiedCredentials({ request, subject }) {
    const expectedUserId = subjectUserId(subject);
    const credentials = requestCredentials(request);
    const ownerIdentity = await requestOwner(identityUrl, { credentials });
    if (String(ownerIdentity.id ?? "") !== expectedUserId) {
      const error = new Error("Matrix profile owner identity does not match the authenticated RISE subject");
      error.code = "MATRIX_SUBJECT_MISMATCH";
      throw error;
    }
    return credentials;
  }

  return {
    scope: "canonical_matrix_owner_transport",
    async read({ request, subject }) {
      const credentials = await verifiedCredentials({ request, subject });
      const payload = await requestOwner(endpoint, { credentials });
      if (!payload.profile || typeof payload.profile !== "object" || Array.isArray(payload.profile)) {
        throw new Error("Canonical Matrix profile response has no profile object");
      }
      return payload;
    },
    async write({ request, subject, profile, markComplete = false }) {
      if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
        const error = new Error("Matrix profile update must be an object");
        error.code = "MATRIX_PROFILE_INVALID";
        throw error;
      }
      const credentials = await verifiedCredentials({ request, subject });
      await requestOwner(endpoint, {
        method: "POST",
        credentials,
        body: { profile, mark_complete: markComplete === true },
      });
      const readback = await requestOwner(endpoint, { credentials });
      if (!readback.profile || typeof readback.profile !== "object" || Array.isArray(readback.profile)) {
        throw new Error("Canonical Matrix profile readback has no profile object");
      }
      return { ...readback, canonicalReadback: true };
    },
  };
}
