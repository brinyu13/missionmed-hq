import { requireVerifiedPrincipal } from "./authority.mjs";
import { invariant } from "./errors.mjs";

export function normalizeAuthContext(input) {
  return requireVerifiedPrincipal(input);
}

export function hasCapability(auth, capability) {
  return auth.capabilities.includes(capability);
}

export function requireCapability(auth, capability) {
  invariant(hasCapability(auth, capability), 403, "CAPABILITY_REQUIRED", "The verified integration capability is required");
}

export function requireOwner(auth, ownerUserId) {
  invariant(auth.subject_id === ownerUserId, 403, "OWNER_REQUIRED", "Only the resource owner may perform this action");
}
