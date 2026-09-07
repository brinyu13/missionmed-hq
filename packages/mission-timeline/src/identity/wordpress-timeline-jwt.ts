import { decodeProtectedHeader, jwtVerify } from "jose";

import type { FacultyGrant, PrincipalContext, Role } from "../contracts/types.js";
import { TimelineError } from "../core/errors.js";

const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const COURSE_ID = 3893;
const ALLOWED_ROLES = new Set<Role>(["STUDENT", "PROGRAM_ADMIN"]);

export interface TimelinePrincipalRecord {
  principalId: string;
  wpUserId: number;
  role: Role;
  active: boolean;
  programIds: string[];
  assignedDocumentIds: string[];
  resourceGrants: FacultyGrant[];
}

export interface TimelinePrincipalDirectory {
  resolve(
    principalId: string,
    wpUserId: number,
    role: Role,
    eligibility: { isWordpressAdministrator: boolean; hasLearndash3893Access: boolean },
    at: string,
  ): Promise<TimelinePrincipalRecord | null>;
}

export interface WordPressTimelineJwtVerifierOptions {
  issuer: string;
  audience?: string;
  secretsByKeyId: ReadonlyMap<string, Uint8Array>;
  principalDirectory: TimelinePrincipalDirectory;
  clock?: () => Date;
  clockToleranceSeconds?: number;
}

export class WordPressTimelineJwtVerifier {
  private readonly audience: string;
  private readonly clock: () => Date;
  private readonly clockToleranceSeconds: number;

  constructor(private readonly options: WordPressTimelineJwtVerifierOptions) {
    if (!options.issuer.trim()) throw new TypeError("TIMELINE_JWT_ISSUER_REQUIRED");
    if (options.secretsByKeyId.size < 1) throw new TypeError("TIMELINE_JWT_KEYS_REQUIRED");
    for (const [keyId, secret] of options.secretsByKeyId) {
      if (!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(keyId) || secret.byteLength < 32) {
        throw new TypeError("TIMELINE_JWT_KEY_INVALID");
      }
    }
    this.audience = options.audience ?? "mission-timeline";
    this.clock = options.clock ?? (() => new Date());
    this.clockToleranceSeconds = options.clockToleranceSeconds ?? 5;
  }

  async verify(token: string, requestId: string): Promise<PrincipalContext> {
    let keyId: string;
    try {
      const header = decodeProtectedHeader(token);
      if (header.alg !== "HS256" || header.typ !== "JWT" || typeof header.kid !== "string") {
        throw new Error("header");
      }
      keyId = header.kid;
    } catch {
      throw this.invalid();
    }

    const secret = this.options.secretsByKeyId.get(keyId);
    if (!secret) throw this.invalid();

    let payload: Awaited<ReturnType<typeof jwtVerify>>["payload"];
    try {
      ({ payload } = await jwtVerify(token, secret, {
        algorithms: ["HS256"],
        issuer: this.options.issuer,
        audience: this.audience,
        clockTolerance: this.clockToleranceSeconds,
        currentDate: this.clock(),
        maxTokenAge: "5 minutes",
        requiredClaims: ["sub", "iat", "nbf", "exp", "jti"],
      }));
    } catch {
      throw this.invalid();
    }

    const principalId = String(payload.sub ?? "").toLowerCase();
    const wpUserId = Number(payload.wp_user_id);
    const role = String(payload.timeline_role ?? "") as Role;
    const isWordpressAdministrator = payload.is_wordpress_administrator === true;
    const hasLearndash3893Access = payload.has_learndash_3893_access === true;
    const effectiveEligibility = isWordpressAdministrator || hasLearndash3893Access;
    if (
      !UUID_PATTERN.test(principalId)
      || !UUID_PATTERN.test(String(payload.jti ?? "").toLowerCase())
      || !Number.isSafeInteger(wpUserId)
      || wpUserId < 1
      || !ALLOWED_ROLES.has(role)
      || payload.timeline_eligible !== true
      || Number(payload.course_id) !== COURSE_ID
      || !effectiveEligibility
      || (role === "PROGRAM_ADMIN") !== isWordpressAdministrator
      || (role === "STUDENT") !== !isWordpressAdministrator
    ) {
      throw this.invalid();
    }

    const principal = await this.options.principalDirectory.resolve(
      principalId,
      wpUserId,
      role,
      { isWordpressAdministrator, hasLearndash3893Access },
      this.clock().toISOString(),
    );
    if (!principal?.active || principal.principalId !== principalId || principal.wpUserId !== wpUserId || principal.role !== role) {
      throw new TimelineError("PRINCIPAL_UNAVAILABLE", "Timeline principal is unavailable.", 403);
    }

    // These capabilities come only from the verified current WordPress assertion.
    // No body, local role lens or remote-save consent can grant AI processing.
    const consentVersion = String(payload.timeline_ai_consent_version ?? "");
    const consentedAt = String(payload.timeline_ai_consented_at ?? "");
    const consentTime = Date.parse(consentedAt);
    const aiConsent = role === "STUDENT" && payload.timeline_ai_consent === true
      && /^[a-zA-Z0-9._:-]{1,160}$/.test(consentVersion)
      && /^\d{4}-\d{2}-\d{2}T/.test(consentedAt)
      && Number.isFinite(consentTime) && consentTime <= this.clock().getTime()
      ? { version: consentVersion, consentedAt: new Date(consentTime).toISOString(), source: "WORDPRESS_VERIFIED" as const }
      : undefined;

    return {
      principalId,
      wpUserId,
      isWordpressAdministrator,
      hasLearndash3893Access,
      ...(aiConsent ? { aiConsent } : {}),
      founderStandardsManager: role === "PROGRAM_ADMIN" && isWordpressAdministrator && payload.timeline_founder_standards_manager === true,
      adminWorkspace: role === "PROGRAM_ADMIN" && isWordpressAdministrator && payload.timeline_admin_workspace === true,
      ...(role === "PROGRAM_ADMIN" && isWordpressAdministrator && payload.timeline_admin_workspace === true
        && UUID_PATTERN.test(String(payload.timeline_admin_subject_principal_id ?? "").toLowerCase())
        && Number.isSafeInteger(payload.timeline_admin_subject_wp_user_id) && Number(payload.timeline_admin_subject_wp_user_id) > 0
        ? { adminSubjectPrincipalId: String(payload.timeline_admin_subject_principal_id).toLowerCase(), adminSubjectWpUserId: Number(payload.timeline_admin_subject_wp_user_id) }
        : {}),
      role,
      programIds: [...principal.programIds],
      assignedDocumentIds: [...principal.assignedDocumentIds],
      facultyGrants: principal.resourceGrants.map((grant) => structuredClone(grant)),
      serviceScopes: [],
      sessionId: String(payload.jti),
      requestId,
    };
  }

  private invalid(): TimelineError {
    return new TimelineError("SESSION_TOKEN_INVALID", "Timeline session token is invalid.", 401);
  }
}
