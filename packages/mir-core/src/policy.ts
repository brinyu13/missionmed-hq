import type { MirContext, MirRequest } from "./contracts.ts";

export class PolicyDenied extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "PolicyDenied";
  }
}

const ROLE_FEATURES: Record<MirContext["role"], readonly string[]> = {
  founder: ["*"],
  admin: ["intake", "research", "profile", "review", "publish", "iv_prep", "lab", "copilot", "debrief", "control"],
  coach: ["research", "profile", "review", "iv_prep", "lab", "copilot", "debrief"],
  student: ["student_view", "lab", "debrief"],
  service: ["research", "profile", "iv_prep", "debrief", "batch"],
};

export function authorize(request: MirRequest, restrictedDataApproved: boolean): void {
  const { context } = request;
  if (!context.tenantId || !context.userId || !context.requestId) {
    throw new PolicyDenied("CONTEXT_INCOMPLETE", "Tenant, user, and request identifiers are required.");
  }
  if (context.subjectIds.length === 0) {
    throw new PolicyDenied("SUBJECT_SCOPE_REQUIRED", "At least one explicit subject is required.");
  }
  const allowed = ROLE_FEATURES[context.role];
  if (!allowed.includes("*") && !allowed.includes(context.feature)) {
    throw new PolicyDenied("ROLE_FEATURE_DENIED", `${context.role} cannot invoke ${context.feature}.`);
  }
  if (context.dataClasses.includes("public_personal")) {
    throw new PolicyDenied("PUBLIC_PERSONAL_DEFAULT_EXCLUDED", "Public personal material is excluded unless a future approved policy explicitly permits it.");
  }
  const restricted = context.dataClasses.some((item) =>
    item === "phi" || item === "student_provided" || item === "founder_private" || item === "missionmed_intel",
  );
  if (restricted && !restrictedDataApproved) {
    throw new PolicyDenied("RESTRICTED_DATA_PROVIDER_UNAPPROVED", "Restricted data is blocked until provider-account approval is recorded.");
  }
  if (context.role === "student" && context.dataClasses.some((item) => item !== "public_professional" && item !== "student_facing_outputs")) {
    throw new PolicyDenied("STUDENT_PRIVATE_INPUT_DENIED", "Student model calls cannot include protected source data.");
  }
}
