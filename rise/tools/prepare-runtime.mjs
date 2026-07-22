import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const ARTIFACTS = [
  {
    name: "registry index",
    urlEnvironment: "RISE_INDEX_URL",
    hashEnvironment: "RISE_INDEX_SHA256",
    pathEnvironment: "RISE_INDEX_PATH",
    filename: "api-index.json",
    maxBytes: 128 * 1024 * 1024,
  },
  {
    name: "index manifest",
    urlEnvironment: "RISE_INDEX_MANIFEST_URL",
    hashEnvironment: "RISE_INDEX_MANIFEST_SHA256",
    pathEnvironment: "RISE_INDEX_MANIFEST_PATH",
    filename: "index-manifest.json",
    maxBytes: 1024 * 1024,
  },
  {
    name: "activation receipt",
    urlEnvironment: "RISE_ACTIVATION_RECEIPT_URL",
    hashEnvironment: "RISE_ACTIVATION_RECEIPT_SHA256",
    pathEnvironment: "RISE_ACTIVATION_RECEIPT_PATH",
    filename: "activation-receipt.json",
    maxBytes: 128 * 1024,
  },
];

function requiredString(value, name, minimumLength = 1) {
  const normalized = String(value ?? "").trim();
  if (normalized.length < minimumLength) throw new Error(`${name} is required`);
  return normalized;
}

function exactOrigin(value, { allowInsecureLoopback = false } = {}) {
  const url = new URL(requiredString(value, "RISE_ARTIFACT_ORIGIN"));
  const loopback = new Set(["127.0.0.1", "localhost", "::1"]);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("RISE_ARTIFACT_ORIGIN must be an exact origin");
  }
  if (url.protocol !== "https:" && !(allowInsecureLoopback && url.protocol === "http:" && loopback.has(url.hostname))) {
    throw new Error("RISE_ARTIFACT_ORIGIN must use HTTPS");
  }
  return url.origin;
}

function artifactUrl(value, environmentName, origin) {
  const url = new URL(requiredString(value, environmentName));
  if (url.username || url.password || url.hash || url.origin !== origin || !url.pathname.startsWith("/")) {
    throw new Error(`${environmentName} must be an exact artifact URL on RISE_ARTIFACT_ORIGIN`);
  }
  return url;
}

async function downloadArtifact({ url, outputPath, expectedSha256, maxBytes, bearerToken, timeoutMs, fetchImpl }) {
  if (!/^[a-f0-9]{64}$/.test(expectedSha256)) throw new Error("Runtime artifact SHA-256 is invalid");
  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${bearerToken}`,
    },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Runtime artifact fetch failed with HTTP ${response.status}`);
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > maxBytes) throw new Error("Runtime artifact exceeds its size limit");
  const handle = await fs.open(outputPath, "wx", 0o600);
  const hash = createHash("sha256");
  let size = 0;
  try {
    for await (const chunk of response.body ?? []) {
      const bytes = Buffer.from(chunk);
      size += bytes.length;
      if (size > maxBytes) throw new Error("Runtime artifact exceeds its size limit");
      hash.update(bytes);
      await handle.write(bytes);
    }
  } catch (error) {
    await handle.close();
    await fs.rm(outputPath, { force: true });
    throw error;
  }
  await handle.close();
  const actualSha256 = hash.digest("hex");
  if (actualSha256 !== expectedSha256) {
    await fs.rm(outputPath, { force: true });
    throw new Error("Runtime artifact hash mismatch");
  }
  return { sha256: actualSha256, size };
}

export async function prepareRuntimeArtifacts({
  environment = process.env,
  fetchImpl = globalThis.fetch,
  allowInsecureLoopback = environment.RISE_ALLOW_INSECURE_LOOPBACK_ARTIFACTS === "true",
  timeoutMs = Number.parseInt(environment.RISE_ARTIFACT_TIMEOUT_MS ?? "30000", 10),
  outputParent = os.tmpdir(),
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required");
  const production = environment.NODE_ENV === "production" || environment.RISE_ENVIRONMENT === "production";
  if (production && allowInsecureLoopback) {
    throw new Error("RISE_ALLOW_INSECURE_LOOPBACK_ARTIFACTS is prohibited in production");
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
    throw new Error("RISE_ARTIFACT_TIMEOUT_MS must be between 1000 and 120000");
  }
  const origin = exactOrigin(environment.RISE_ARTIFACT_ORIGIN, { allowInsecureLoopback });
  const bearerToken = requiredString(environment.RISE_ARTIFACT_BEARER_TOKEN, "RISE_ARTIFACT_BEARER_TOKEN", 32);
  const outputDirectory = await fs.mkdtemp(path.join(outputParent, "rise-runtime-"));
  const receipts = [];
  try {
    for (const artifact of ARTIFACTS) {
      const url = artifactUrl(environment[artifact.urlEnvironment], artifact.urlEnvironment, origin);
      const outputPath = path.join(outputDirectory, artifact.filename);
      const receipt = await downloadArtifact({
        url,
        outputPath,
        expectedSha256: environment[artifact.hashEnvironment],
        maxBytes: artifact.maxBytes,
        bearerToken,
        timeoutMs,
        fetchImpl,
      });
      environment[artifact.pathEnvironment] = outputPath;
      receipts.push({ name: artifact.name, path: outputPath, ...receipt });
    }
    return { outputDirectory, artifacts: receipts };
  } catch (error) {
    await fs.rm(outputDirectory, { recursive: true, force: true });
    throw error;
  }
}
