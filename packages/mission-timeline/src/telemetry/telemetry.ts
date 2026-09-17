import { sha256 } from "../core/canonical.js";

export interface TelemetryEvent {
  name: string;
  timestamp: string;
  attributes: Record<string, string | number | boolean | null>;
}

export interface TelemetrySink {
  emit(event: TelemetryEvent): void | Promise<void>;
}

const ALLOWED_EVENTS = new Set([
  "api.request",
  "api.error",
  "document.created",
  "document.versioned",
  "sync.completed",
  "sync.conflict",
  "review.requested",
  "review.decided",
  "export.queued",
  "export.completed",
  "filevault.published",
  "object.confirmed",
  "security.denied",
]);

const PROHIBITED_KEY = /(name|email|title|body|text|note|comment|event|document_json|signed_url|object_key|filename)/i;
const SENSITIVE_VALUE = /(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|https?:\/\/|-----BEGIN|bearer\s+[a-z0-9._-]+)/i;

export class PrivacySafeTelemetry {
  constructor(
    private readonly sink: TelemetrySink,
    private readonly environment: string,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async emit(name: string, attributes: Record<string, unknown> = {}): Promise<void> {
    if (!ALLOWED_EVENTS.has(name)) throw new Error("TELEMETRY_EVENT_NOT_ALLOWED");
    const sanitized: Record<string, string | number | boolean | null> = { environment: this.environment };
    for (const [key, value] of Object.entries(attributes)) {
      if (PROHIBITED_KEY.test(key)) throw new Error(`TELEMETRY_ATTRIBUTE_PROHIBITED:${key}`);
      if (value === null || typeof value === "number" || typeof value === "boolean") {
        sanitized[key] = value;
        continue;
      }
      if (typeof value !== "string") continue;
      if (SENSITIVE_VALUE.test(value)) throw new Error(`TELEMETRY_VALUE_PROHIBITED:${key}`);
      sanitized[key] = value.length > 160 ? `${value.slice(0, 120)}:${sha256(value).slice(0, 12)}` : value;
    }
    await this.sink.emit({ name, timestamp: this.clock().toISOString(), attributes: sanitized });
  }
}

export class InMemoryTelemetrySink implements TelemetrySink {
  readonly events: TelemetryEvent[] = [];

  emit(event: TelemetryEvent): void {
    this.events.push(structuredClone(event));
  }
}
