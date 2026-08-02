import type { JsonSchema } from "./contracts.ts";

export function validateSchema(payload: unknown, schema: JsonSchema): string[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return ["output must be an object"];
  const record = payload as Record<string, unknown>;
  const errors: string[] = [];
  const required = Array.isArray(schema.required) ? schema.required.filter((key): key is string => typeof key === "string") : [];
  for (const key of required) if (!(key in record)) errors.push(`${key} is required`);
  for (const [key, unknownRule] of Object.entries(schema.properties)) {
    if (!(key in record)) continue;
    const rule = unknownRule as { type?: string };
    const value = record[key];
    const actual = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
    if (rule.type && actual !== rule.type) errors.push(`${key} must be ${rule.type}, got ${actual}`);
  }
  if (schema.additionalProperties === false) {
    for (const key of Object.keys(record)) if (!(key in schema.properties)) errors.push(`${key} is not allowed`);
  }
  return errors;
}
