import type { PrincipalContext, TimelineAction } from "../contracts/types.js";
import { TimelineError } from "../core/errors.js";

export interface AuthorizedResource {
  documentId?: string;
  ownerPrincipalId?: string;
  programId?: string;
  versionId?: string;
}

export interface AuthorizationDecision {
  allowed: boolean;
  reason: string;
}

function activeBreakGlass(context: PrincipalContext, now = new Date()): boolean {
  return Boolean(
    context.role === "PLATFORM_ADMIN" &&
      context.breakGlass?.reason &&
      context.breakGlass.expiresAt > now.toISOString(),
  );
}

export function decide(
  context: PrincipalContext,
  action: TimelineAction,
  resource: AuthorizedResource = {},
  clock: () => Date = () => new Date(),
): AuthorizationDecision {
  if (context.role === "SERVICE") {
    return context.serviceScopes.includes(action)
      ? { allowed: true, reason: "SERVICE_SCOPE" }
      : { allowed: false, reason: "SERVICE_SCOPE_MISSING" };
  }

  if (activeBreakGlass(context, clock())) return { allowed: true, reason: "ACTIVE_BREAK_GLASS" };

  if (action === "document:create") {
    return context.role === "STUDENT"
      ? { allowed: true, reason: "STUDENT_CREATE" }
      : { allowed: false, reason: "STUDENT_ROLE_REQUIRED" };
  }

  const owns = Boolean(resource.ownerPrincipalId && resource.ownerPrincipalId === context.principalId);
  const sameProgram = Boolean(resource.programId && context.programIds.includes(resource.programId));
  const assigned = Boolean(resource.documentId && context.assignedDocumentIds.includes(resource.documentId));

  if (context.role === "STUDENT") {
    const studentActions: TimelineAction[] = [
      "document:read",
      "document:edit",
      "version:create",
      "review:request",
      "review:read",
      "review:comment",
      "artifact:create",
      "artifact:read",
      "document:delete",
    ];
    return owns && studentActions.includes(action)
      ? { allowed: true, reason: "STUDENT_OWNER" }
      : { allowed: false, reason: "STUDENT_NOT_OWNER_OR_ACTION_DENIED" };
  }

  if (context.role === "ADVISOR") {
    const advisorActions: TimelineAction[] = [
      "document:read",
      "review:read",
      "review:comment",
      "review:decide",
      "artifact:create",
      "artifact:read",
    ];
    return assigned && sameProgram && advisorActions.includes(action)
      ? { allowed: true, reason: "ACTIVE_ADVISOR_ASSIGNMENT" }
      : { allowed: false, reason: "ADVISOR_NOT_ASSIGNED_OR_ACTION_DENIED" };
  }

  if (context.role === "PROGRAM_ADMIN") {
    if (!resource.documentId) return { allowed: false, reason: "ADMIN_RESOURCE_REQUIRED" };
    const grant = context.facultyGrants.find(
      (item) =>
        item.documentId === resource.documentId
        && (!resource.versionId || !item.versionId || item.versionId === resource.versionId)
        && item.expiresAt > clock().toISOString(),
    );
    return grant?.actions.includes(action)
      ? { allowed: true, reason: "ACTIVE_ADMIN_RESOURCE_GRANT" }
      : { allowed: false, reason: "ADMIN_RESOURCE_GRANT_MISSING" };
  }

  if (context.role === "FACULTY" && resource.documentId) {
    const grant = context.facultyGrants.find(
      (item) =>
        item.documentId === resource.documentId &&
        (!resource.versionId || !item.versionId || item.versionId === resource.versionId) &&
        item.expiresAt > clock().toISOString(),
    );
    return grant?.actions.includes(action)
      ? { allowed: true, reason: "ACTIVE_FACULTY_GRANT" }
      : { allowed: false, reason: "FACULTY_GRANT_MISSING" };
  }

  return { allowed: false, reason: "DENY_BY_DEFAULT" };
}

export function authorize(
  context: PrincipalContext,
  action: TimelineAction,
  resource: AuthorizedResource = {},
  clock?: () => Date,
): void {
  const decision = decide(context, action, resource, clock);
  if (!decision.allowed) {
    throw new TimelineError("FORBIDDEN", `Timeline action denied: ${decision.reason}`, 403, {
      action,
      reason: decision.reason,
    });
  }
}
