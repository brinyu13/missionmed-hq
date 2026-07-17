import { deepFreeze } from "./canonical.mjs";
import { invariant } from "./errors.mjs";

const principals = new WeakSet();
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ROLES = new Set(["student", "mentor", "faculty", "admin", "integration"]);

function safeId(value, code, label) {
  const result = String(value || "").trim();
  invariant(SAFE_ID.test(result), 401, code, `${label} is invalid`);
  return result;
}

function subjectId(value) {
  const result = String(value || "").trim();
  invariant(UUID.test(result), 401, "AUTH_SUBJECT_INVALID", "Authority subject must be a UUID");
  return result.toLowerCase();
}

export function createAuthorityAdapter(verifier, authorityRef) {
  invariant(typeof verifier === "function", 500, "AUTHORITY_VERIFIER_REQUIRED", "Authority adapter requires a verifier");
  const ref = safeId(authorityRef, "AUTHORITY_REF_INVALID", "Authority reference");
  return Object.freeze({
    authority_ref: ref,
    async verify(source) {
      const result = await verifier(source);
      invariant(result && typeof result === "object", 401, "AUTH_VERIFICATION_FAILED", "MissionMed authentication could not be verified");
      const role = String(result.role || "");
      invariant(ROLES.has(role), 403, "AUTH_ROLE_INVALID", "Verified auth role is not supported");
      const capabilities = [...new Set(Array.isArray(result.capabilities) ? result.capabilities.map((value) => safeId(value, "AUTH_CAPABILITY_INVALID", "Authority capability")) : [])].sort();
      const principal = deepFreeze({
        subject_id: subjectId(result.subject_id),
        role,
        capabilities,
        authority_ref: ref,
        authority_session_ref: safeId(result.authority_session_ref, "AUTH_SESSION_INVALID", "Authority session")
      });
      principals.add(principal);
      return principal;
    }
  });
}

export function isVerifiedPrincipal(value) {
  return Boolean(value && typeof value === "object" && principals.has(value));
}

export function requireVerifiedPrincipal(value) {
  invariant(isVerifiedPrincipal(value), 401, "AUTH_CONTEXT_UNVERIFIED", "An opaque MissionMed principal is required");
  return value;
}
