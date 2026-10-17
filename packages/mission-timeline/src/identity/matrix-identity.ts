import { createHmac, timingSafeEqual } from "node:crypto";

import type { FacultyGrant, MatrixIdentity, PrincipalContext, Role, TimelineAction } from "../contracts/types.js";
import { TimelineError } from "../core/errors.js";

export interface PrincipalRecord {
  principalId: string;
  wpUserId: number;
  role: Role;
  programIds: string[];
  assignedDocumentIds: string[];
  facultyGrants?: FacultyGrant[];
  serviceScopes?: TimelineAction[];
  active: boolean;
}

export interface MatrixNonceVerifier {
  verify(identity: MatrixIdentity): Promise<boolean>;
}

export class InMemoryPrincipalDirectory {
  private readonly byWordPressId = new Map<number, PrincipalRecord>();

  register(record: PrincipalRecord): void {
    if (!record.principalId || !Number.isInteger(record.wpUserId)) throw new Error("PRINCIPAL_INVALID");
    this.byWordPressId.set(record.wpUserId, structuredClone(record));
  }

  resolve(wpUserId: number): PrincipalRecord | null {
    const record = this.byWordPressId.get(wpUserId);
    return record ? structuredClone(record) : null;
  }
}

interface SessionClaims {
  sub: string;
  role: Role;
  programs: string[];
  assignments: string[];
  facultyGrants: FacultyGrant[];
  serviceScopes: TimelineAction[];
  sessionId: string;
  iat: number;
  exp: number;
  aud: "mission-timeline";
}

function encode(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function decode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

export class MatrixSessionExchange {
  constructor(
    private readonly directory: InMemoryPrincipalDirectory,
    private readonly nonceVerifier: MatrixNonceVerifier,
    private readonly signingSecret: string,
    private readonly ttlSeconds = 600,
    private readonly clock: () => Date = () => new Date(),
  ) {
    if (signingSecret.length < 32) throw new Error("SESSION_SIGNING_SECRET_TOO_SHORT");
  }

  async exchange(identity: MatrixIdentity): Promise<{ token: string; expiresAt: string }> {
    if (!identity.nonceVerified || !(await this.nonceVerifier.verify(identity))) {
      throw new TimelineError("MATRIX_NONCE_INVALID", "Matrix session verification failed.", 401);
    }
    const principal = this.directory.resolve(identity.wpUserId);
    if (!principal?.active) throw new TimelineError("PRINCIPAL_NOT_MAPPED", "MissionMed principal is unavailable.", 403);
    const issuedAt = Math.floor(this.clock().getTime() / 1000);
    const claims: SessionClaims = {
      sub: principal.principalId,
      role: principal.role,
      programs: principal.programIds,
      assignments: principal.assignedDocumentIds,
      facultyGrants: principal.facultyGrants ?? [],
      serviceScopes: principal.serviceScopes ?? [],
      sessionId: identity.sessionId,
      iat: issuedAt,
      exp: issuedAt + this.ttlSeconds,
      aud: "mission-timeline",
    };
    const payload = encode(JSON.stringify(claims));
    const signature = this.sign(payload);
    return { token: `${payload}.${signature}`, expiresAt: new Date(claims.exp * 1000).toISOString() };
  }

  verify(token: string, requestId: string): PrincipalContext {
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra || !this.safeEqual(signature, this.sign(payload))) {
      throw new TimelineError("SESSION_TOKEN_INVALID", "Timeline session token is invalid.", 401);
    }
    const claims = JSON.parse(decode(payload)) as SessionClaims;
    const current = Math.floor(this.clock().getTime() / 1000);
    if (claims.aud !== "mission-timeline" || claims.exp <= current) {
      throw new TimelineError("SESSION_TOKEN_EXPIRED", "Timeline session token expired.", 401);
    }
    return {
      principalId: claims.sub,
      role: claims.role,
      programIds: claims.programs,
      assignedDocumentIds: claims.assignments,
      facultyGrants: claims.facultyGrants,
      serviceScopes: claims.serviceScopes,
      sessionId: claims.sessionId,
      requestId,
    };
  }

  private sign(payload: string): string {
    return createHmac("sha256", this.signingSecret).update(payload).digest("base64url");
  }

  private safeEqual(left: string, right: string): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
