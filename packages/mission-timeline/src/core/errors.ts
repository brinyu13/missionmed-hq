export class TimelineError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "TimelineError";
  }
}

export function asTimelineError(error: unknown): TimelineError {
  if (error instanceof TimelineError) return error;
  const message = error instanceof Error ? error.message : "Unexpected Timeline error";
  return new TimelineError("INTERNAL_ERROR", message, 500);
}
