import type { PrincipalContext, TimelineDocument, TimelineEvent } from "../src/contracts/types.js";

export const FIXED_NOW = new Date("2026-07-15T12:00:00.000Z");
export const fixedClock = () => new Date(FIXED_NOW);

export function context(
  role: PrincipalContext["role"],
  principalId: string,
  overrides: Partial<PrincipalContext> = {},
): PrincipalContext {
  return {
    principalId,
    role,
    programIds: ["program_internal_medicine"],
    assignedDocumentIds: [],
    facultyGrants: [],
    serviceScopes: [],
    sessionId: `session_${principalId}`,
    requestId: `request_${principalId}`,
    ...overrides,
  };
}

export const student = context("STUDENT", "principal_student");
export const otherStudent = context("STUDENT", "principal_other_student");
export const advisor = context("ADVISOR", "principal_advisor", { assignedDocumentIds: ["timeline_test"] });
export const programAdmin = context("PROGRAM_ADMIN", "principal_admin", {
  facultyGrants: [{
    documentId: "timeline_test",
    actions: [
      "document:read",
      "document:edit",
      "version:create",
      "review:request",
      "review:read",
      "review:comment",
      "review:decide",
      "artifact:read",
      "audit:read",
    ],
    expiresAt: "2027-01-01T00:00:00.000Z",
  }],
});
export const exportService = context("SERVICE", "service_export", { serviceScopes: ["artifact:create", "document:read"] });
export const fileVaultService = context("SERVICE", "service_filevault", { serviceScopes: ["filevault:publish"] });

export function event(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: "event_work",
    title: "Clinical Research Coordinator",
    categoryId: "work",
    eventType: "bar",
    startDate: "2024-01",
    endDate: "2024-08",
    visibilityState: "INTERVIEWER_SAFE",
    ...overrides,
  };
}

export function document(overrides: Partial<TimelineDocument> = {}): TimelineDocument {
  return {
    id: "timeline_test",
    schemaVersion: "d1-timeline-document-409.1",
    studentOwnerId: student.principalId,
    programId: "program_internal_medicine",
    title: "Mission Timeline",
    theme: "keynote",
    revision: 0,
    events: [event()],
    mediaItems: [],
    sourceDocuments: [],
    metadata: {},
    ...overrides,
  };
}
