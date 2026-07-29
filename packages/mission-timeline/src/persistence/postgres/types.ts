import type { PrincipalContext, Role } from "../../contracts/types.js";

export const POSTGRES_TIMELINE_SCHEMA_VERSION = "d1-timeline-db-413.2";
export const POSTGRES_TIMELINE_DOCUMENT_SCHEMA_VERSION = "d1-timeline-document-409.1";

export interface PostgresQueryResult<Row = Record<string, unknown>> {
  rows: Row[];
  rowCount: number | null;
}

export interface PostgresQueryable {
  query<Row = Record<string, unknown>>(text: string, values?: unknown[]): Promise<PostgresQueryResult<Row>>;
}

export interface PostgresTransactionClient extends PostgresQueryable {
  release(error?: Error | boolean): void;
}

export interface PostgresPool extends PostgresQueryable {
  connect(): Promise<PostgresTransactionClient>;
}

export interface PostgresRlsClaims {
  sub: string;
  timeline_role: Role;
  program_ids: string[];
  service_scopes: string[];
  break_glass_audit_id?: string;
  break_glass_granted_by?: string;
  break_glass_reason?: string;
  break_glass_expires_at?: string;
}

export interface PostgresBreakGlassGrant {
  auditId: string;
  grantedByPrincipalId: string;
  grantedToPrincipalId: string;
  reason: string;
  expiresAt: string;
}

export interface CommentBodyCodec {
  encrypt(plaintext: string): Promise<string> | string;
  decrypt(ciphertext: string): Promise<string> | string;
}

export interface PostgresTimelineRepositoryOptions {
  rlsClaims?: PostgresRlsClaims;
  commentBodyCodec?: CommentBodyCodec;
  clock?: () => Date;
}

export type DeletionRequestStatus = "REQUESTED" | "LEGAL_HOLD" | "IN_PROGRESS" | "COMPLETED" | "DENIED";

export interface DeletionRequestRecord {
  id: string;
  principalId: string;
  documentId: string;
  status: DeletionRequestStatus;
  legalHold: boolean;
  createdAt: string;
  completedAt: string | null;
}

export interface IdempotencyKeyRecord {
  principalId: string;
  operation: string;
  idempotencyKey: string;
  responseSha256: string;
  expiresAt: string;
  createdAt: string;
}

export interface RecordIdempotencyResultInput {
  principalId: string;
  operation: string;
  idempotencyKey: string;
  response: unknown;
  expiresAt: string;
  createdAt?: string;
}

export function postgresClaimsFromPrincipal(
  context: PrincipalContext,
  breakGlassGrant?: PostgresBreakGlassGrant,
): PostgresRlsClaims {
  const claims: PostgresRlsClaims = {
    sub: context.principalId,
    timeline_role: context.role,
    program_ids: [...context.programIds],
    service_scopes: [...context.serviceScopes],
  };
  if (!breakGlassGrant) return claims;

  const contextGrant = context.breakGlass;
  const expiresAt = new Date(breakGlassGrant.expiresAt);
  if (
    context.role !== "PLATFORM_ADMIN" ||
    !contextGrant ||
    !breakGlassGrant.auditId.trim() ||
    !breakGlassGrant.grantedByPrincipalId.trim() ||
    breakGlassGrant.grantedByPrincipalId === context.principalId ||
    breakGlassGrant.grantedToPrincipalId !== context.principalId ||
    !breakGlassGrant.reason.trim() ||
    breakGlassGrant.reason !== contextGrant.reason ||
    breakGlassGrant.expiresAt !== contextGrant.expiresAt ||
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.toISOString() !== breakGlassGrant.expiresAt
  ) {
    throw new TypeError("PostgreSQL break-glass claims require a matching independent audited grant.");
  }

  return {
    ...claims,
    break_glass_audit_id: breakGlassGrant.auditId,
    break_glass_granted_by: breakGlassGrant.grantedByPrincipalId,
    break_glass_reason: breakGlassGrant.reason,
    break_glass_expires_at: breakGlassGrant.expiresAt,
  };
}
