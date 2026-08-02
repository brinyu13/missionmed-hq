import type { SourceRecord } from "./domain.ts";

export const SUBJECT_ID = "student:ezechiel-fenelon";
export const PERSON_ID = "person:conrad-t-fischer-brooklyn";
export const PROGRAM_ID = "program:obh-brookdale-im";

export const approvedPublicSources: SourceRecord[] = [
  {
    id: "src:obh-fischer-profile", subjectId: PERSON_ID, evidenceClass: "public_person", sourceType: "official_profile",
    title: "Conrad Fischer, MD", uri: "https://onebrooklynhealth.org/doctor/conrad-fischer",
    retrievedAt: "2026-08-02T00:00:00.000Z", authority: "primary", status: "available",
    assertions: [
      { predicate: "person_name", value: "Conrad Fischer, MD", locator: "profile heading", verification: "browser-visible" },
      { predicate: "organization_affiliation", value: "The Brookdale Hospital Medical Center", locator: "hospital affiliations", verification: "browser-visible" },
    ],
  },
  {
    id: "src:obh-brookdale-im", subjectId: PROGRAM_ID, evidenceClass: "public_program", sourceType: "program_site",
    title: "Internal Medicine Residency — Brookdale", uri: "https://onebrooklynhealth.org/health-care-professionals/internal-medicine-residency-brookdale",
    retrievedAt: "2026-08-02T00:00:00.000Z", authority: "primary", status: "available",
    assertions: [
      { predicate: "organization_affiliation", value: "Brookdale Hospital Medical Center", locator: "program identity", verification: "browser-visible" },
      { predicate: "program_specialty", value: "Internal Medicine", locator: "program title", verification: "browser-visible" },
    ],
  },
  {
    id: "src:kaplan-fischer", subjectId: PERSON_ID, evidenceClass: "public_person", sourceType: "publisher",
    title: "Med Educators Blog — Conrad Fischer, MD", uri: "https://www.kaptest.com/blogs/med-educators/author/conrad-fischer-md",
    retrievedAt: "2026-08-02T00:00:00.000Z", authority: "primary", status: "available",
    assertions: [
      { predicate: "person_name", value: "Dr. Conrad Fischer, MD, MA", locator: "author heading", verification: "browser-visible" },
      { predicate: "professional_role", value: "Program Director and Vice-Chair, Department of Medicine", locator: "author heading", verification: "browser-visible" },
      { predicate: "organization_affiliation", value: "Brookdale Hospital Medical Center", locator: "author heading", verification: "browser-visible" },
    ],
  },
  {
    id: "src:simon-schuster-mtb-2026", subjectId: PERSON_ID, evidenceClass: "public_person", sourceType: "publisher",
    title: "Master the Boards USMLE Step 2 CK, Eighth Edition (2026)",
    uri: "https://www.simonandschuster.biz/books/Master-the-Boards-USMLE-Step-2-CK-Eighth-Edition-%282026%29/Conrad-Fischer/Master-the-Boards/9781506289786",
    retrievedAt: "2026-08-02T00:00:00.000Z", authority: "primary", status: "available",
  },
  {
    id: "src:av-pending", subjectId: PERSON_ID, evidenceClass: "public_person", sourceType: "video",
    title: "Approved audiovisual source", uri: "", retrievedAt: "2026-08-02T00:00:00.000Z",
    authority: "primary", status: "pending_upload",
  },
];

export interface IdentityResolution {
  status: "resolved" | "ambiguous";
  canonicalId?: string;
  signals: string[];
  conflicts: string[];
}

export function resolveConradFischer(sources: SourceRecord[]): IdentityResolution {
  const available = sources.filter((source) => source.status === "available");
  const assertions = available.flatMap((source) => (source.assertions ?? []).map((assertion) => ({ ...assertion, sourceId: source.id })));
  const person = assertions.filter((item) => item.predicate === "person_name" && item.value.toLowerCase().includes("conrad fischer"));
  const brookdale = assertions.filter((item) => item.predicate === "organization_affiliation" && item.value.toLowerCase().includes("brookdale"));
  const internalMedicine = assertions.filter((item) => item.predicate === "program_specialty" && item.value.toLowerCase().includes("internal medicine"));
  const educator = assertions.filter((item) => item.predicate === "professional_role" && /program director|educator|vice-chair/i.test(item.value));
  const independent = new Set([...person, ...brookdale, ...internalMedicine, ...educator].map((item) => item.sourceId));
  if (!person.length || !brookdale.length || !internalMedicine.length || !educator.length || independent.size < 3) {
    return { status: "ambiguous", signals: assertions.map((item) => `${item.sourceId}:${item.predicate}`), conflicts: ["Evidence assertions do not yet connect person, Brookdale, Internal Medicine, and educator/program role across three sources."] };
  }
  return {
    status: "resolved", canonicalId: PERSON_ID,
    signals: [
      "One Brooklyn Health profile assertion: Conrad Fischer and Brookdale affiliation",
      "Brookdale program assertion: Internal Medicine",
      "Kaplan author assertion: Conrad Fischer, Program Director/Vice-Chair, Brookdale Department of Medicine",
    ], conflicts: [],
  };
}

export function sourceTypeCoverage(sources: SourceRecord[]) {
  const available = sources.filter((source) => source.status === "available");
  return {
    distinctTypes: new Set(available.map((source) => source.sourceType)).size,
    hasAudiovisual: available.some((source) => source.sourceType === "audio" || source.sourceType === "video"),
  };
}
