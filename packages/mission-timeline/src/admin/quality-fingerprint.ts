import { sha256 } from "../core/canonical.js";
// @ts-expect-error Shared canonical projection is JavaScript, bundled in both runtimes.
import {projectQualitySource022,QUALITY_SOURCE_EXCLUDED_FIELDS_022} from '../../web/js/production/quality-source-projection-022.js';
export {QUALITY_SOURCE_EXCLUDED_FIELDS_022};

const TRANSIENT_KEYS = new Set(["resolvedUrl", "previewUrl"]);
function stableSource(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(item => stableSource(item) ?? null);
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    const item = (value as Record<string, unknown>)[key];
    if (TRANSIENT_KEYS.has(key) || (typeof item === "string" && item.startsWith("blob:"))) continue;
    const child = stableSource(item);
    if (child !== undefined) result[key] = child;
  }
  return result;
}
/** Review freshness is advisory status, never authorization or a release gate. */
export function qualitySourceText022(document: unknown): string {
  return JSON.stringify(stableSource(projectQualitySource022(document)));
}
export function qualitySourceSha022(document: unknown): string { return sha256(qualitySourceText022(document)); }
