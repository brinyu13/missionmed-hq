import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import type { FacultyGrant, PrincipalContext, Role, TimelineAction } from "../../contracts/types.js";
import { TimelineError } from "../../core/errors.js";

const MAX_TOKEN_TTL_SECONDS = 15 * 60;
const CLOCK_SKEW_SECONDS = 30;

export interface StagingPrincipalRecord {
  principalId: string;
  wpUserId: number;
  role: Role;
  programIds: string[];
  assignedDocumentIds: string[];
  facultyGrants?: FacultyGrant[];
  serviceScopes?: TimelineAction[];
  active: boolean;
  membershipVersion: number;
}

export interface MatrixSessionProof {
  wpUserId: number;
  sessionId: string;
  nonce: string;
}

export interface MatrixProofVerification {
  valid: boolean;
  proofId: string;
  wpUserId: number;
  sessionId: string;
}

/** Matrix remains the login authority. This boundary only verifies its session proof. */
export interface MatrixSessionAuthority {
  verifyProof(proof: MatrixSessionProof): Promise<MatrixProofVerification>;
  isSessionActive(session: { wpUserId: number; sessionId: string }): Promise<boolean>;
}

export interface StagingSessionOptions {
  issuer: string;
  audience: string;
  signingSecret: string;
  ttlSeconds?: number;
  clock?: () => Date;
}

export interface VerifySessionOptions {
  requestId: string;
  /** Use only for a single-use operation such as an exchange or destructive mutation. */
  replayKey?: string;
}

interface SessionClaims {
  iss: string;
  aud: string;
  sub: string;
  wpuid: number;
  role: Role;
  programs: string[];
  mv: number;
  sid: string;
  jti: string;
  iat: number;
  exp: number;
}

const TOKEN_HEADER = { alg: "HS256", typ: "MMTL+JWT" } as const;

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeJson<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

function canonicalStrings(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function sameStrings(left: string[], right: string[]): boolean {
  const a = canonicalStrings(left);
  const b = canonicalStrings(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function validatePrincipal(record: StagingPrincipalRecord): StagingPrincipalRecord {
  if (!record.principalId || !Number.isInteger(record.wpUserId) || record.wpUserId <= 0) {
    throw new TimelineError("PRINCIPAL_MAPPING_INVALID", "The Matrix principal mapping is invalid.", 400);
  }
  if (!Number.isSafeInteger(record.membershipVersion) || record.membershipVersion < 1) {
    throw new TimelineError("MEMBERSHIP_VERSION_INVALID", "Membership version must be a positive integer.", 400);
  }
  return {
    ...structuredClone(record),
    programIds: canonicalStrings(record.programIds),
    assignedDocumentIds: canonicalStrings(record.assignedDocumentIds),
    facultyGrants: structuredClone(record.facultyGrants ?? []),
    serviceScopes: [...new Set(record.serviceScopes ?? [])].sort(),
  };
}

function authError(code: string, message: string, status = 401, details: Record<string, unknown> = {}): TimelineError {
  return new TimelineError(code, message, status, {
    preserveLocalDraft: true,
    recoveryAction: "REAUTHENTICATE_WITH_MATRIX",
    ...details,
  });
}

function matrixAuthorityUnavailableError(): TimelineError {
  return authError(
    "MATRIX_AUTHORITY_UNAVAILABLE",
    "Matrix session authority is temporarily unavailable.",
    503,
  );
}

export class InMemoryStagingPrincipalDirectory {
  private readonly byWpUserId = new Map<number, StagingPrincipalRecord>();
  private readonly wpUserIdByPrincipal = new Map<string, number>();

  register(record: StagingPrincipalRecord): void {
    const canonical = validatePrincipal(record);
    const existingForWp = this.byWpUserId.get(canonical.wpUserId);
    const existingWpForPrincipal = this.wpUserIdByPrincipal.get(canonical.principalId);
    if (existingForWp && existingForWp.principalId !== canonical.principalId) {
      throw new TimelineError("WP_USER_MAPPING_IMMUTABLE", "A WordPress user cannot be reassigned to another principal.", 409);
    }
    if (existingWpForPrincipal !== undefined && existingWpForPrincipal !== canonical.wpUserId) {
      throw new TimelineError("PRINCIPAL_MAPPING_IMMUTABLE", "A principal cannot be reassigned to another WordPress user.", 409);
    }
    if (existingForWp && canonical.membershipVersion <= existingForWp.membershipVersion) {
      throw new TimelineError("MEMBERSHIP_VERSION_NOT_ADVANCED", "Membership updates require a newer version.", 409);
    }
    this.byWpUserId.set(canonical.wpUserId, canonical);
    this.wpUserIdByPrincipal.set(canonical.principalId, canonical.wpUserId);
  }

  resolveByWpUserId(wpUserId: number): StagingPrincipalRecord | null {
    const record = this.byWpUserId.get(wpUserId);
    return record ? structuredClone(record) : null;
  }

  resolveByPrincipalId(principalId: string): StagingPrincipalRecord | null {
    const wpUserId = this.wpUserIdByPrincipal.get(principalId);
    return wpUserId === undefined ? null : this.resolveByWpUserId(wpUserId);
  }

  deletePrincipal(principalId: string): void {
    const wpUserId = this.wpUserIdByPrincipal.get(principalId);
    if (wpUserId === undefined) return;
    this.wpUserIdByPrincipal.delete(principalId);
    this.byWpUserId.delete(wpUserId);
  }
}

export class StagingMatrixSessionExchange {
  readonly issuer: string;
  readonly audience: string;
  readonly ttlSeconds: number;

  readonly #directory: InMemoryStagingPrincipalDirectory;
  readonly #matrix: MatrixSessionAuthority;
  readonly #signingSecret: string;
  readonly #clock: () => Date;
  readonly #usedProofs = new Map<string, number>();
  readonly #usedReplayKeys = new Map<string, number>();

  constructor(
    directory: InMemoryStagingPrincipalDirectory,
    matrix: MatrixSessionAuthority,
    options: StagingSessionOptions,
  ) {
    if (!options.issuer || !options.audience) throw new Error("SESSION_ISSUER_AND_AUDIENCE_REQUIRED");
    if (options.signingSecret.length < 32) throw new Error("SESSION_SIGNING_SECRET_TOO_SHORT");
    const ttlSeconds = options.ttlSeconds ?? 300;
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 30 || ttlSeconds > MAX_TOKEN_TTL_SECONDS) {
      throw new Error("SESSION_TTL_OUT_OF_RANGE");
    }
    this.#directory = directory;
    this.#matrix = matrix;
    this.#signingSecret = options.signingSecret;
    this.#clock = options.clock ?? (() => new Date());
    this.issuer = options.issuer;
    this.audience = options.audience;
    this.ttlSeconds = ttlSeconds;
  }

  async exchange(proof: MatrixSessionProof): Promise<{ token: string; expiresAt: string }> {
    if (!Number.isInteger(proof.wpUserId) || proof.wpUserId <= 0 || !proof.sessionId || !proof.nonce) {
      throw authError("MATRIX_SESSION_PROOF_INVALID", "Matrix session proof is incomplete.");
    }
    const verified = await this.#callMatrixAuthority(async () => (
      structuredClone(await this.#matrix.verifyProof(structuredClone(proof)))
    ));
    if (
      !verified
      || typeof verified !== "object"
      || !verified.valid ||
      !verified.proofId ||
      verified.wpUserId !== proof.wpUserId ||
      verified.sessionId !== proof.sessionId
    ) {
      throw authError("MATRIX_SESSION_PROOF_INVALID", "Matrix rejected the session or nonce.");
    }

    const current = this.#nowSeconds();
    this.#purgeReplayState(current);
    if ((this.#usedProofs.get(verified.proofId) ?? 0) > current) {
      throw authError("MATRIX_SESSION_PROOF_REPLAYED", "Matrix session proof has already been exchanged.");
    }

    const principal = this.#directory.resolveByWpUserId(proof.wpUserId);
    if (!principal?.active) {
      throw authError("PRINCIPAL_NOT_ACTIVE", "MissionMed principal is unavailable.", 403);
    }
    if (!(await this.#isMatrixSessionActive(proof.wpUserId, proof.sessionId))) {
      throw authError("MATRIX_SESSION_REVOKED", "Matrix session is no longer active.");
    }

    const claims: SessionClaims = {
      iss: this.issuer,
      aud: this.audience,
      sub: principal.principalId,
      wpuid: principal.wpUserId,
      role: principal.role,
      programs: canonicalStrings(principal.programIds),
      mv: principal.membershipVersion,
      sid: proof.sessionId,
      jti: randomUUID(),
      iat: current,
      exp: current + this.ttlSeconds,
    };
    const header = encodeJson(TOKEN_HEADER);
    const payload = encodeJson(claims);
    const signature = this.#sign(`${header}.${payload}`);
    this.#usedProofs.set(verified.proofId, claims.exp);
    return { token: `${header}.${payload}.${signature}`, expiresAt: new Date(claims.exp * 1000).toISOString() };
  }

  async verify(token: string, options: VerifySessionOptions): Promise<PrincipalContext> {
    const claims = this.#verifyCryptographicEnvelope(token);
    const current = this.#nowSeconds();
    this.#purgeReplayState(current);

    if (claims.iss !== this.issuer) {
      throw authError("SESSION_ISSUER_INVALID", "Timeline session issuer is invalid.");
    }
    if (claims.aud !== this.audience) {
      throw authError("SESSION_AUDIENCE_INVALID", "Timeline session audience is invalid.");
    }
    if (!Number.isSafeInteger(claims.iat) || claims.iat > current + CLOCK_SKEW_SECONDS) {
      throw authError("SESSION_ISSUED_AT_INVALID", "Timeline session issue time is invalid.");
    }
    if (!Number.isSafeInteger(claims.exp) || claims.exp <= current || claims.exp - claims.iat > MAX_TOKEN_TTL_SECONDS) {
      throw authError("SESSION_TOKEN_EXPIRED", "Timeline session expired.");
    }

    const principal = this.#directory.resolveByPrincipalId(claims.sub);
    if (!principal?.active) {
      throw authError("PRINCIPAL_NOT_ACTIVE", "MissionMed principal is unavailable.", 403);
    }
    if (
      principal.wpUserId !== claims.wpuid ||
      principal.role !== claims.role ||
      !sameStrings(principal.programIds, claims.programs)
    ) {
      throw authError("SESSION_PRINCIPAL_CLAIMS_STALE", "Timeline session claims no longer match Matrix membership.", 401);
    }
    if (principal.membershipVersion !== claims.mv) {
      throw authError("SESSION_MEMBERSHIP_STALE", "Timeline membership changed; reauthentication is required.", 401, {
        currentMembershipVersion: principal.membershipVersion,
      });
    }
    if (!(await this.#isMatrixSessionActive(claims.wpuid, claims.sid))) {
      throw authError("MATRIX_SESSION_REVOKED", "Matrix session is no longer active.");
    }

    if (options.replayKey) {
      if (!options.replayKey.trim()) throw authError("SESSION_REPLAY_KEY_INVALID", "Replay key is invalid.");
      const replayScope = `${claims.jti}:${options.replayKey}`;
      if ((this.#usedReplayKeys.get(replayScope) ?? 0) > current) {
        throw authError("SESSION_REQUEST_REPLAYED", "This single-use session operation was already accepted.", 409);
      }
      this.#usedReplayKeys.set(replayScope, claims.exp);
    }

    return {
      principalId: principal.principalId,
      role: principal.role,
      programIds: structuredClone(principal.programIds),
      assignedDocumentIds: structuredClone(principal.assignedDocumentIds),
      facultyGrants: structuredClone(principal.facultyGrants ?? []),
      serviceScopes: structuredClone(principal.serviceScopes ?? []),
      sessionId: claims.sid,
      requestId: options.requestId,
    };
  }

  #verifyCryptographicEnvelope(token: string): SessionClaims {
    const [encodedHeader, encodedPayload, signature, extra] = token.split(".");
    if (!encodedHeader || !encodedPayload || !signature || extra) {
      throw authError("SESSION_TOKEN_INVALID", "Timeline session token is invalid.");
    }
    const signed = `${encodedHeader}.${encodedPayload}`;
    if (!this.#safeEqual(signature, this.#sign(signed))) {
      throw authError("SESSION_TOKEN_INVALID", "Timeline session token is invalid.");
    }
    try {
      const header = decodeJson<Record<string, unknown>>(encodedHeader);
      if (header.alg !== TOKEN_HEADER.alg || header.typ !== TOKEN_HEADER.typ) {
        throw new Error("header");
      }
      const claims = decodeJson<SessionClaims>(encodedPayload);
      if (
        !claims ||
        typeof claims.sub !== "string" ||
        typeof claims.sid !== "string" ||
        typeof claims.jti !== "string" ||
        !Number.isInteger(claims.wpuid) ||
        !Array.isArray(claims.programs)
      ) {
        throw new Error("claims");
      }
      return claims;
    } catch {
      throw authError("SESSION_TOKEN_INVALID", "Timeline session token is invalid.");
    }
  }

  #sign(value: string): string {
    return createHmac("sha256", this.#signingSecret).update(value).digest("base64url");
  }

  #safeEqual(left: string, right: string): boolean {
    try {
      const a = Buffer.from(left, "base64url");
      const b = Buffer.from(right, "base64url");
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  async #isMatrixSessionActive(wpUserId: number, sessionId: string): Promise<boolean> {
    return (await this.#callMatrixAuthority(() => this.#matrix.isSessionActive({ wpUserId, sessionId }))) === true;
  }

  async #callMatrixAuthority<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch {
      throw matrixAuthorityUnavailableError();
    }
  }

  #nowSeconds(): number {
    return Math.floor(this.#clock().getTime() / 1000);
  }

  #purgeReplayState(current: number): void {
    for (const [key, expiresAt] of this.#usedProofs) if (expiresAt <= current) this.#usedProofs.delete(key);
    for (const [key, expiresAt] of this.#usedReplayKeys) if (expiresAt <= current) this.#usedReplayKeys.delete(key);
  }
}
