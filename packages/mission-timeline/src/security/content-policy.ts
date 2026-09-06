export interface ContentFinding {
  code: string;
  severity: "INFO" | "WARNING" | "BLOCK";
  field: string;
  message: string;
}

const HTML_PATTERN = /<\/?(?:script|iframe|object|embed|svg|math|style|link|meta)\b|javascript\s*:/i;
const PATIENT_IDENTIFIER_PATTERN = /\b(?:patient|mrn|medical record|date of birth|dob)\s*[:#-]?\s*[a-z0-9/-]{3,}/i;
const SECRET_PATTERN = /(?:-----BEGIN [A-Z ]+ PRIVATE KEY-----|sk_live_[a-z0-9]+|service_role)/i;

export function inspectUntrustedText(field: string, value: unknown): ContentFinding[] {
  const text = String(value ?? "");
  const findings: ContentFinding[] = [];
  if (HTML_PATTERN.test(text)) {
    findings.push({ code: "ACTIVE_CONTENT_BLOCKED", severity: "BLOCK", field, message: "Active markup is not allowed." });
  }
  if (SECRET_PATTERN.test(text)) {
    findings.push({ code: "SECRET_PATTERN_BLOCKED", severity: "BLOCK", field, message: "Possible credential material is not allowed." });
  }
  if (PATIENT_IDENTIFIER_PATTERN.test(text)) {
    findings.push({ code: "PATIENT_IDENTIFIER_REVIEW", severity: "BLOCK", field, message: "Possible patient identifier requires removal." });
  }
  return findings;
}

export function assertContentSafe(fields: Record<string, unknown>): void {
  const findings = Object.entries(fields).flatMap(([field, value]) => inspectUntrustedText(field, value));
  const blocked = findings.filter((item) => item.severity === "BLOCK");
  if (blocked.length) {
    throw new TimelineError("CONTENT_POLICY_BLOCK", "Content contains material that cannot be stored.", 422, {
      findings: blocked.map(({ code, field }) => ({ code, field })),
    });
  }
}
import { TimelineError } from "../core/errors.js";
