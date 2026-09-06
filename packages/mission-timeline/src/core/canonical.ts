import { createHash, randomUUID } from "node:crypto";

import type { TimelineDocument } from "../contracts/types.js";

export function clone<T>(value: T): T {
  return structuredClone(value);
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalize(item)]),
    );
  }
  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalDocumentHash(document: TimelineDocument): string {
  const copy = clone(document);
  delete copy.persistence;
  delete copy.recovery;
  delete copy.exportRecords;
  delete copy.timelineArtifacts;
  if (copy.metadata) {
    delete copy.metadata.updatedAt;
    delete copy.metadata.lastSyncedAt;
  }
  return sha256(stableStringify(copy));
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

export function now(clock: () => Date = () => new Date()): string {
  return clock().toISOString();
}

export function validateTimelineDocument(document: unknown): asserts document is TimelineDocument {
  if (!document || typeof document !== "object") throw new Error("DOCUMENT_REQUIRED");
  const value = document as Partial<TimelineDocument>;
  if (!value.id || !/^[-_a-zA-Z0-9]{8,}$/.test(value.id)) throw new Error("DOCUMENT_ID_INVALID");
  if (value.schemaVersion !== "d1-timeline-document-409.1") throw new Error("DOCUMENT_SCHEMA_UNSUPPORTED");
  if (!value.studentOwnerId) throw new Error("DOCUMENT_OWNER_REQUIRED");
  if (!value.programId) throw new Error("DOCUMENT_PROGRAM_REQUIRED");
  if (!Number.isInteger(value.revision) || Number(value.revision) < 0) throw new Error("DOCUMENT_REVISION_INVALID");
  if (!Array.isArray(value.events)) throw new Error("DOCUMENT_EVENTS_INVALID");
  const ids = new Set<string>();
  for (const event of value.events) {
    if (!event?.id || ids.has(event.id)) throw new Error("EVENT_ID_INVALID_OR_DUPLICATE");
    ids.add(event.id);
    if (!event.title?.trim()) throw new Error("EVENT_TITLE_REQUIRED");
    if (!/^\d{4}-\d{2}(-\d{2})?$/.test(event.startDate)) throw new Error("EVENT_START_DATE_INVALID");
    if (event.endDate && !/^\d{4}-\d{2}(-\d{2})?$/.test(event.endDate)) throw new Error("EVENT_END_DATE_INVALID");
    if (event.endDate && event.endDate < event.startDate) throw new Error("EVENT_DATE_RANGE_INVALID");
  }
}

export function safeText(value: unknown, maxLength = 2_000): string {
  const text = String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
  if (text.length > maxLength) throw new Error("TEXT_TOO_LONG");
  return text;
}
