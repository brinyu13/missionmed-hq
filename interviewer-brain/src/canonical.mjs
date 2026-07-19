import { createHash } from "node:crypto";
import { fail } from "./errors.mjs";

const FORBIDDEN_PERSISTED_KEYS = new Set([
  "system_prompt",
  "developer_prompt",
  "chain_of_thought",
  "hidden_reasoning",
  "private_reasoning",
  "raw_model_output",
  "raw_provider_response",
  "provider_token",
  "access_token",
  "refresh_token",
  "secret",
]);

function encode(value, path, seen) {
  if (value === null) return "null";

  const type = typeof value;
  if (type === "string" || type === "boolean") return JSON.stringify(value);
  if (type === "number") {
    if (!Number.isFinite(value)) {
      fail("CANONICAL_NON_FINITE", `Non-finite number at ${path}`);
    }
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }

  if (type !== "object") {
    fail("CANONICAL_UNSUPPORTED_TYPE", `Unsupported ${type} at ${path}`);
  }
  if (seen.has(value)) fail("CANONICAL_CYCLE", `Cycle at ${path}`);
  seen.add(value);

  let result;
  if (Array.isArray(value)) {
    result = `[${value.map((entry, index) => encode(entry, `${path}[${index}]`, seen)).join(",")}]`;
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      fail("CANONICAL_NON_PLAIN_OBJECT", `Non-plain object at ${path}`);
    }
    const keys = Object.keys(value).sort();
    result = `{${keys
      .map((key) => `${JSON.stringify(key)}:${encode(value[key], `${path}.${key}`, seen)}`)
      .join(",")}}`;
  }

  seen.delete(value);
  return result;
}

export function canonicalJson(value) {
  return encode(value, "$", new Set());
}

export function sha256(value) {
  const bytes = typeof value === "string" ? value : canonicalJson(value);
  return createHash("sha256").update(bytes, "utf8").digest("hex");
}

export function withoutKeys(value, omittedKeys) {
  const omitted = new Set(omittedKeys);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !omitted.has(key)));
}

export function contentHash(value) {
  return sha256(withoutKeys(value, ["content_hash"]));
}

export function deepClone(value) {
  return JSON.parse(canonicalJson(value));
}

export function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const entry of Object.values(value)) deepFreeze(entry);
  }
  return value;
}

export function assertPersistable(value, path = "$", seen = new Set()) {
  if (value === null) return;
  const type = typeof value;
  if (type === "string" || type === "boolean") return;
  if (type === "number") {
    if (!Number.isFinite(value)) fail("PERSISTED_NON_FINITE", `Non-finite number at ${path}`);
    return;
  }
  if (type !== "object") fail("PERSISTED_UNSUPPORTED_TYPE", `Unsupported ${type} at ${path}`);
  if (seen.has(value)) fail("PERSISTED_CYCLE", `Cycle at ${path}`);
  seen.add(value);

  if (!Array.isArray(value)) {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      fail("PERSISTED_NON_PLAIN_OBJECT", `Non-plain object at ${path}`);
    }
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_PERSISTED_KEYS.has(key.toLowerCase())) {
        fail("PERSISTED_FORBIDDEN_FIELD", `Forbidden persisted field ${path}.${key}`);
      }
    }
  }

  for (const [key, entry] of Object.entries(value)) {
    assertPersistable(entry, `${path}.${key}`, seen);
  }
  seen.delete(value);
}
