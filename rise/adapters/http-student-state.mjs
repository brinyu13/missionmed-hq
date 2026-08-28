import { createHmac } from "node:crypto";

const DEFAULT_TIMEOUT_MS = 3_000;
const MAX_RESPONSE_BYTES = 512 * 1024;
const STATES = new Set(["SAVED", "APPLIED", "INTERVIEWING", "RANKED"]);

function requiredString(value, name, minimumLength = 1) {
  const normalized = String(value ?? "").trim();
  if (normalized.length < minimumLength) throw new Error(`${name} is required`);
  return normalized;
}

function controlEndpoint(value, { allowInsecureLoopback = false } = {}) {
  const url = new URL(requiredString(value, "RISE_STUDENT_STATE_CONTROL_URL"));
  const loopback = new Set(["127.0.0.1", "localhost", "::1"]);
  if (url.username || url.password || url.hash || url.search) {
    throw new Error("RISE_STUDENT_STATE_CONTROL_URL must be an exact endpoint without credentials or query data");
  }
  if (url.protocol !== "https:" && !(allowInsecureLoopback && url.protocol === "http:" && loopback.has(url.hostname))) {
    throw new Error("RISE_STUDENT_STATE_CONTROL_URL must use HTTPS");
  }
  return url;
}

async function readLimitedJson(response) {
  if (Number(response.headers.get("content-length") ?? 0) > MAX_RESPONSE_BYTES) {
    throw new Error("Student-state response exceeds the RISE limit");
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of response.body ?? []) {
    const bytes = Buffer.from(chunk);
    total += bytes.length;
    if (total > MAX_RESPONSE_BYTES) throw new Error("Student-state response exceeds the RISE limit");
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function validRecord(value) {
  return value &&
    typeof value.programSpecialtyId === "string" && /^[A-Za-z0-9:_-]{1,160}$/.test(value.programSpecialtyId) &&
    STATES.has(value.state) &&
    typeof value.notes === "string" && value.notes.length <= 4_000 && !/\0/.test(value.notes) &&
    Number.isFinite(Date.parse(String(value.updatedAt ?? "")));
}

export function createRiseStudentStore({
  controlUrl = process.env.RISE_STUDENT_STATE_CONTROL_URL,
  bearerToken = process.env.RISE_STUDENT_STATE_CONTROL_TOKEN,
  subjectHmacKey = process.env.RISE_STUDENT_STATE_SUBJECT_HMAC_KEY,
  timeoutMs = Number.parseInt(process.env.RISE_STUDENT_STATE_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS), 10),
  allowInsecureLoopback = process.env.RISE_ALLOW_INSECURE_LOOPBACK_STUDENT_STATE === "true",
  fetchImpl = globalThis.fetch,
} = {}) {
  const endpoint = controlEndpoint(controlUrl, { allowInsecureLoopback });
  const token = requiredString(bearerToken, "RISE_STUDENT_STATE_CONTROL_TOKEN", 32);
  const hmacKey = Buffer.from(requiredString(subjectHmacKey, "RISE_STUDENT_STATE_SUBJECT_HMAC_KEY", 32));
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 250 || timeoutMs > 10_000) {
    throw new Error("RISE_STUDENT_STATE_TIMEOUT_MS must be between 250 and 10000");
  }

  async function request(action, { subject, releaseId, programSpecialtyId, state, notes } = {}) {
    const subjectKey = createHmac("sha256", hmacKey)
      .update("rise-student-state-v1\0")
      .update(requiredString(subject, "subject"))
      .digest("hex");
    const payload = {
      schemaVersion: 1,
      service: "missionmed-rise",
      action,
      subjectKey,
      releaseId: requiredString(releaseId, "releaseId"),
      ...(programSpecialtyId ? { programSpecialtyId } : {}),
      ...(state ? { state } : {}),
      ...(notes !== undefined ? { notes } : {}),
    };
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
    if (!response.ok) throw new Error(`Student-state service rejected ${action}`);
    const body = await readLimitedJson(response);
    if (body?.schemaVersion !== 1 || body?.subjectKey !== subjectKey) {
      throw new Error("Student-state response is not bound to the authenticated subject");
    }
    return body;
  }

  return {
    scope: "durable_private",
    async list(input) {
      const body = await request("list", input);
      if (!Array.isArray(body.records) || !body.records.every(validRecord)) {
        throw new Error("Student-state list response is invalid");
      }
      return body.records;
    },
    async put(input) {
      const body = await request("upsert", input);
      if (!validRecord(body.record)) throw new Error("Student-state upsert response is invalid");
      return body.record;
    },
    async delete(input) {
      const body = await request("delete", input);
      if (typeof body.deleted !== "boolean") throw new Error("Student-state delete response is invalid");
      return body.deleted;
    },
  };
}
