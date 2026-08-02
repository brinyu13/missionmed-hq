import { createHash, randomUUID } from "node:crypto";

export interface AuditEvent {
  id: string;
  tenantId: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export class AuditLedger {
  private readonly events: AuditEvent[] = [];
  record(input: Omit<AuditEvent, "id" | "createdAt">): AuditEvent {
    const event = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    this.events.push(event);
    return structuredClone(event);
  }
  list(tenantId: string): AuditEvent[] {
    return this.events.filter((event) => event.tenantId === tenantId).map((event) => structuredClone(event));
  }
}

export function opaqueIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
