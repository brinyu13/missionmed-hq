import { createHash, randomUUID } from "node:crypto";

export function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Canonical JSON accepts plain objects only");
    }
    return Object.keys(value).sort().reduce((result, key) => {
      Object.defineProperty(result, key, {
        value: stableValue(value[key]),
        enumerable: true,
        configurable: true,
        writable: true
      });
      return result;
    }, {});
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new TypeError("Canonical JSON rejects non-finite numbers");
  }
  if (["undefined", "function", "symbol", "bigint"].includes(typeof value)) {
    throw new TypeError("Canonical JSON rejects unsupported values");
  }
  return value;
}

export function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

export function sha256(value) {
  const bytes = typeof value === "string" ? value : stableJson(value);
  return createHash("sha256").update(bytes).digest("hex");
}

export function clone(value) {
  return structuredClone(value);
}

export function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

export function immutableCopy(value) {
  return deepFreeze(clone(value));
}

export function newId(prefix) {
  return `${prefix}_${randomUUID()}`;
}

export function utcNow() {
  return new Date().toISOString();
}
