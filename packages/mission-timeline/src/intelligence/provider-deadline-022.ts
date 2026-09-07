// Keep every provider attempt inside WordPress's 100-second AI proxy window,
// which in turn finishes before the browser's 110-second AI request deadline.
export const TIMELINE_AI_PROVIDER_MAX_TIMEOUT_MS_022 = 90_000;

export function timelineAiProviderTimeoutMs022(value?: number): number {
  if (value === undefined) return TIMELINE_AI_PROVIDER_MAX_TIMEOUT_MS_022;
  if (!Number.isFinite(value)) throw new TypeError("TIMELINE_AI_TIMEOUT_INVALID");
  return Math.max(5_000, Math.min(TIMELINE_AI_PROVIDER_MAX_TIMEOUT_MS_022, Math.trunc(value)));
}
