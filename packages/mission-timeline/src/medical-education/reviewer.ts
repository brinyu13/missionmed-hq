import type { TimelineDocument, TimelineEvent } from "../contracts/types.js";

export interface MedicalEducationFinding {
  code: string;
  severity: "INFO" | "REVIEW" | "BLOCK_EXPORT";
  eventIds: string[];
  message: string;
  recommendation: string;
}

export interface MedicalEducationReview {
  reviewerVersion: "D1-MED-413.1";
  findingCount: number;
  requiresAdvisorReview: boolean;
  findings: MedicalEducationFinding[];
  disclaimer: string;
}

const SENSITIVE_CONTEXT = /\b(?:pregnan(?:t|cy)|parental(?: leave| responsibilities?)?|maternity|paternity|raising (?:a |my )?(?:daughter|son|child)|daughter|son|child(?:care)?|baby|spouse|husband|wife|family (?:transition|death|reasons?|care|caregiving|responsibilit(?:y|ies)|circumstances?)|caregiver|in-laws?|illness|disab(?:ility|led)?|divorc(?:e|ed)|immigration|visa|green card|miscarriage|mental health|behavioral health|psychiatric)\b/i;

function monthNumber(date: unknown): number | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(date ?? ""));
  if (!match) return null;
  return Number(match[1]) * 12 + Number(match[2]) - 1;
}

function monthLabel(value: number): string {
  return `${Math.floor(value / 12)}-${String((value % 12) + 1).padStart(2, "0")}`;
}

function eventsMatching(document: TimelineDocument, expression: RegExp): TimelineEvent[] {
  return document.events.filter((event) => expression.test(`${event.title} ${event.categoryId}`));
}

export function reviewMedicalEducationTimeline(document: TimelineDocument): MedicalEducationReview {
  const findings: MedicalEducationFinding[] = [];
  if (!document.events.length) {
    findings.push({
      code: "EMPTY_TIMELINE",
      severity: "REVIEW",
      eventIds: [],
      message: "The timeline has no events.",
      recommendation: "Add only verified events that support the applicant's interview story.",
    });
  }

  const usce = document.events.filter((event) =>
    ["usce", "th", "cl"].includes(event.categoryId.toLowerCase()) || /\busce\b/i.test(event.title),
  );
  for (const event of usce) {
    if (!event.siteName?.trim() && !event.location?.trim()) {
      findings.push({
        code: "USCE_SITE_MISSING",
        severity: "REVIEW",
        eventIds: [event.id],
        message: `USCE event "${event.title}" has no site or location label.`,
        recommendation: "Confirm the institution/site name and keep the label readable beside the event bar.",
      });
    }
  }

  const stepEvents = eventsMatching(document, /\bstep\s*(?:1|2\s*(?:ck)?)\b/i);
  for (const event of stepEvents) {
    const start = monthNumber(event.startDate);
    const end = event.endDate == null ? start : monthNumber(event.endDate);
    const precision = String(event.datePrecision ?? event.sourceDatePrecision ?? "").toUpperCase();
    if (start === null || end === null || end < start || ["UNKNOWN", "YEAR", "VAGUE_RANGE"].includes(precision)) {
      findings.push({
        code: "USMLE_DATE_REVIEW",
        severity: "REVIEW",
        eventIds: [event.id],
        message: `The exam date for "${event.title}" is missing, ambiguous, or internally inconsistent.`,
        recommendation: "Verify the date against the student's source material. Step 1 and Step 2 CK may occur in either order; do not infer or auto-correct a sequence.",
      });
    }
  }

  const datedVisible = [...document.events]
    .filter((event) => event.visibilityState !== "HIDDEN")
    .map((event) => {
      const start = monthNumber(event.startDate);
      const parsedEnd = event.endDate == null ? start : monthNumber(event.endDate);
      if (start === null || parsedEnd === null) return null;
      return { event, start, end: Math.max(start, parsedEnd) };
    })
    .filter((item): item is { event: TimelineEvent; start: number; end: number } => item !== null)
    .sort((left, right) => left.start - right.start || left.end - right.end);

  let coverage = datedVisible[0];
  for (let index = 1; coverage && index < datedVisible.length; index += 1) {
    const current = datedVisible[index]!;
    if (current.start <= coverage.end + 1) {
      if (current.end > coverage.end) coverage = { ...current, start: coverage.start };
      continue;
    }
    const gap = current.start - coverage.end - 1;
    if (gap > 12) {
      findings.push({
        code: "CHRONOLOGY_GAP_REVIEW",
        severity: "INFO",
        eventIds: [coverage.event.id, current.event.id],
        message: `A ${gap}-month uncovered interval appears between "${coverage.event.title}" and "${current.event.title}".`,
        recommendation: "Ask the student whether verified professional or personal context belongs in this interval.",
      });
    }
    coverage = current;
  }

  for (const event of document.events) {
    if (event.visibilityState === "INTERVIEWER_SAFE" && SENSITIVE_CONTEXT.test(`${event.title} ${event.notes ?? ""}`)) {
      findings.push({
        code: "INTERVIEWER_SAFE_SENSITIVE_CONTEXT",
        severity: "REVIEW",
        eventIds: [event.id],
        message: `Potentially sensitive context is marked interviewer-safe for "${event.title}".`,
        recommendation: "Confirm that the student intentionally chose this visibility and review phrasing with an advisor.",
      });
    }
  }

  let densest: { month: number; items: TimelineEvent[] } | null = null;
  for (const month of [...new Set(datedVisible.map((item) => item.start))].sort((left, right) => left - right)) {
    const items = datedVisible.filter((item) => item.start <= month && item.end >= month).map((item) => item.event);
    if (!densest || items.length > densest.items.length) densest = { month, items };
  }
  if (densest && densest.items.length >= 4) {
    findings.push({
      code: "DENSE_OVERLAP_REVIEW",
      severity: "INFO",
      eventIds: densest.items.map((item) => item.id),
      message: `${densest.items.length} visible event intervals overlap during ${monthLabel(densest.month)}.`,
      recommendation: "Use lanes and advisor review to confirm that the overlap remains legible and meaningful.",
    });
  }

  return {
    reviewerVersion: "D1-MED-413.1",
    findingCount: findings.length,
    requiresAdvisorReview: findings.some((item) => item.severity !== "INFO"),
    findings,
    disclaimer: "This review checks timeline structure and interview-preparation clarity. It does not verify credentials, provide legal advice, or replace student and advisor confirmation.",
  };
}
