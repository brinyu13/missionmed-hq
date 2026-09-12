// Keep the runtime contract embedded because the production image copies `src/`
// but intentionally does not copy repository-level configuration files. The
// checked-in JSON remains the human-readable contract and a test below ensures
// these two representations cannot drift.
import {
  applicationFacetCounts,
  buildApplicationIntelligence,
  evaluateApplicationCompatibility,
} from "./application-intelligence.mjs";

export const FILTER_INTELLIGENCE_CONFIG = Object.freeze({
  schemaVersion: 2,
  contractId: "rise-filter-intelligence-2026-09-10",
  researchDepth: {
    providerDomains: {
      visaPublication: ["research.visa"],
      residentRoster: ["research.resident_roster"],
      leadership: ["research.leadership"],
      boardPerformance: ["research.abim"],
      fellowshipOutcomes: ["research.fellowship_inventory", "research.outcomes"],
      applicationRequirements: ["research.application_requirements"],
      curriculumFeatures: ["research.curriculum"],
      salaryBenefits: ["research.salary_benefits"],
      residentComposition: ["research.img_accessibility", "research.do_accessibility", "research.caribbean_accessibility"],
    },
    deepRequiredDomains: ["applicationRequirements", "visaPublication", "residentRoster", "leadership"],
    deepMinimumDomainCount: 8,
    enrichedMinimumDomainCount: 5,
    requiresApprovedProviderDomainForEnriched: true,
    basicMinimumDomainCount: 2,
    coreRegistryDomains: {
      officialWebsite: ["Program Website"],
      programStructure: ["Program Best Described As", "Program Length", "Total Residents", "Residents Per Year", "First Year Positions"],
      applicationTimeline: ["Application Deadline", "Medical School Graduation Timeline", "Application Service"],
      applicationRequirements: ["Step Preferences", "COMLEX Accepted", "IMG Step 1 Required", "IMG Step 2 Required", "DO COMLEX Level 1 Required", "DO COMLEX Level 2 Required", "Minimum LOR", "Maximum LOR", "Specialty Specific LOR Required", "Gap Experience Requirement", "Medical School Graduation Timeline", "Required Supplemental Information"],
      visaPublication: ["J1", "H1B", "Visa Sponsorship"],
      residentComposition: ["IMG Graduates Percent", "DO Graduates Percent", "US MD Graduates Percent"],
      salaryBenefits: ["Salary PGY1", "Salary PGY2", "Salary PGY3", "Salary PGY4", "Benefits", "Vacation", "Educational Stipend", "Meal Allowance"],
      curriculumFeatures: ["Clinic Structure", "Call Schedule", "Night Float", "Research Track", "Average Work Hours", "Required Away Rotations"],
    },
  },
  studentLabels: {
    deep: "Deep Research",
    enriched: "Enriched Research",
    basic: "Basic Profile",
    pending: "Research Pending",
  },
  filterFlagBits: {
    j1: 1,
    h1b: 2,
    anyVisa: 4,
    img: 8,
    do: 16,
    caribbean: 32,
    usmd: 64,
    soap2026: 128,
    abim: 256,
    alumni: 512,
  },
  evidencePolicy: {
    visa: "Only explicit published sponsorship or visa-status evidence is filterable.",
    residentComposition: "Program-reported resident or graduate composition and approved roster evidence are observations, not admissions-policy claims.",
    dynamicFacts: "Only approved, non-conflicting STUDENT_VISIBLE or PRIVATE_BETA canonical current facts may affect student-facing fact filters.",
    researchDepth: "Depth is computed only from approved canonical facts and approved registry domains; review-gated claim presence never increases the tier.",
    pendingEvidence: "Review-gated provider evidence is represented only as a verification-pending state; claim values and personal data remain hidden.",
  },
});
export const FILTER_FLAG_BITS = Object.freeze({ ...FILTER_INTELLIGENCE_CONFIG.filterFlagBits });

const DEPTH_ORDER = Object.freeze(["deep", "enriched", "basic", "pending"]);
const PROVIDER_DOMAIN_ENTRIES = Object.entries(FILTER_INTELLIGENCE_CONFIG.researchDepth.providerDomains);
const VALID_FILTER_FIELDS = new Set([
  ...PROVIDER_DOMAIN_ENTRIES.flatMap(([, fields]) => fields),
  "MissionMed Alumni",
  "ACTN Connections",
]);

function knownValue(program, field) {
  const claim = program?.fields?.[field];
  return claim?.knowledge?.state === "known" ? claim.knowledge.value : undefined;
}

function hasKnownValue(program, fields) {
  return fields.some((field) => knownValue(program, field) !== undefined);
}

function positivePercent(value) {
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  const match = String(value ?? "").match(/-?\d+(?:\.\d+)?/);
  return Boolean(match) && Number(match[0]) > 0;
}

function affirmative(value) {
  return value === true || /^(?:YES|TRUE|SUPPORTED|PUBLISHED|AVAILABLE|SPONSORED)\b/.test(String(value ?? "").trim().toUpperCase());
}

function programIdentifier(program, namespace) {
  return (program?.identifiers ?? []).find((identifier) => identifier.namespace === namespace)?.value ?? null;
}

function normalizedClassification(value) {
  return String(value ?? "").trim().toUpperCase().replaceAll("-", "_").replaceAll(" ", "_");
}

function rosterRows(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => Array.isArray(row) ? rosterRows(row) : (row && typeof row === "object" ? [row] : []));
}

const SEARCH_TERM_NOISE = new Set([
  "yes", "no", "true", "false", "unknown", "none", "not stated", "not found",
  "found", "researched not found",
]);

function collectApprovedSearchTerms(value, terms, depth = 0) {
  if (depth > 6 || value === null || value === undefined) return;
  if (typeof value === "string") {
    const normalized = value.replace(/\s+/g, " ").trim();
    const lowered = normalized.toLocaleLowerCase("en-US");
    if (normalized.length >= 3 && normalized.length <= 240 && !/^https?:\/\//i.test(normalized) && !SEARCH_TERM_NOISE.has(lowered)) {
      terms.add(normalized);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectApprovedSearchTerms(entry, terms, depth + 1);
    return;
  }
  if (typeof value === "object") {
    for (const entry of Object.values(value)) collectApprovedSearchTerms(entry, terms, depth + 1);
  }
}

function dynamicSearchTerms(facts) {
  const terms = new Set();
  for (const fact of facts) {
    const value = fact.canonicalValue ?? fact.canonical_value ?? fact.knowledge?.value;
    if (fact.field === "research.resident_roster") {
      for (const resident of rosterRows(value)) {
        collectApprovedSearchTerms(resident.medical_school ?? resident.school, terms);
        collectApprovedSearchTerms(resident.medical_school_raw, terms);
      }
    } else if (fact.field === "research.leadership" || fact.field === "research.core_faculty") {
      for (const person of rosterRows(value)) {
        collectApprovedSearchTerms(person.name, terms);
        collectApprovedSearchTerms(person.role ?? person.title, terms);
        collectApprovedSearchTerms(person.subspecialty ?? person.specialty ?? person.clinical_interest, terms);
      }
    } else {
      collectApprovedSearchTerms(value, terms);
    }
  }
  return [...terms].sort().slice(0, 250);
}

function dynamicFactFlags(facts) {
  const flags = {
    j1: false,
    h1b: false,
    img: false,
    do: false,
    caribbean: false,
    usmd: false,
    abim: false,
    alumni: false,
  };
  for (const fact of facts) {
    if (!VALID_FILTER_FIELDS.has(fact.field)) continue;
    const value = fact.canonicalValue ?? fact.canonical_value ?? fact.knowledge?.value;
    if (fact.field === "research.visa" && value && typeof value === "object" && !Array.isArray(value)) {
      const supported = Array.isArray(value.supported) ? value.supported.map(String) : [];
      flags.j1 ||= affirmative(value.j1) || supported.some((item) => /\bJ-?1\b/i.test(item));
      flags.h1b ||= affirmative(value.h1b) || supported.some((item) => /\bH-?1B\b/i.test(item));
    }
    if (fact.field === "research.resident_roster") {
      for (const resident of rosterRows(value)) {
        const classification = normalizedClassification(resident.classification);
        const degree = normalizedClassification(resident.degree ?? resident.degree_credential);
        flags.img ||= classification === "IMG";
        flags.do ||= classification === "DO" || classification === "US_DO" || degree === "DO";
        flags.usmd ||= classification === "US_MD";
        flags.caribbean ||= affirmative(resident.caribbean);
      }
    }
    if (fact.field === "research.abim" && value && typeof value === "object") {
      const passRate = Number.parseFloat(String(value.pass_rate ?? value.passRate ?? "").replace(/[^0-9.]/g, ""));
      flags.abim ||= Number.isFinite(passRate) && passRate >= 0 && passRate <= 100;
    }
    if (fact.field === "MissionMed Alumni" || fact.field === "ACTN Connections") {
      flags.alumni ||= value === true || (Array.isArray(value) && value.length > 0);
    }
  }
  return flags;
}

export function staticFilterFacts(program) {
  const visaText = String(knownValue(program, "Visa Sponsorship") ?? "");
  const j1 = knownValue(program, "J1") === true;
  const h1b = knownValue(program, "H1B") === true;
  const explicitVisaText = /\b(?:J-?1|H-?1B|F-?1)\b/i.test(visaText);
  const coreDomains = FILTER_INTELLIGENCE_CONFIG.researchDepth.coreRegistryDomains;
  const approvedDomains = Object.entries(coreDomains).filter(([name, fields]) => {
    if (name === "visaPublication") return j1 || h1b || explicitVisaText;
    return hasKnownValue(program, fields);
  }).map(([name]) => name);
  return {
    visa: {
      j1,
      h1b,
      j1OrH1b: j1 || h1b,
      any: j1 || h1b || explicitVisaText,
    },
    residentEvidence: {
      img: positivePercent(knownValue(program, "IMG Graduates Percent")),
      do: positivePercent(knownValue(program, "DO Graduates Percent")),
      caribbean: false,
      usmd: positivePercent(knownValue(program, "US MD Graduates Percent")),
    },
    abim: false,
    alumni: false,
    coreDomainCount: approvedDomains.length,
    approvedDomains,
  };
}

function providerDomains(fields = []) {
  const fieldSet = new Set(fields);
  return PROVIDER_DOMAIN_ENTRIES.filter(([, candidates]) => candidates.some((field) => fieldSet.has(field))).map(([name]) => name);
}

function completedDossierDomains(dossier) {
  if (!dossier || !["COMPLETED", "PARTIAL"].includes(String(dossier.status ?? "").toUpperCase())) return [];
  const matrix = dossier.completionMatrix ?? dossier.completion_matrix;
  if (!matrix || typeof matrix !== "object" || Array.isArray(matrix)) return [];
  return Object.entries(matrix)
    .filter(([, value]) => value && typeof value === "object" && value.state !== "NOT_RESEARCHED")
    .map(([domain]) => domain)
    .sort();
}

export function researchDepthDetail(program, researchCoverage, dossier = null) {
  const staticFacts = staticFilterFacts(program);
  const approvedProviderDomains = providerDomains(researchCoverage?.fields);
  const pendingProviderDomains = providerDomains(researchCoverage?.pendingFields);
  const approvedDomains = [...new Set([...staticFacts.approvedDomains, ...approvedProviderDomains])].sort();
  const pendingDomains = [...new Set(pendingProviderDomains.filter((domain) => !approvedDomains.includes(domain)))].sort();
  const dossierDomains = completedDossierDomains(dossier);
  const dossierIsDeep = String(dossier?.dossierOutcome ?? dossier?.dossier_outcome ?? "").toUpperCase() === "DEEP"
    && dossierDomains.length === 18
    && Number(dossier?.completionScore ?? dossier?.completion_score ?? 0) >= 0.8;
  const required = FILTER_INTELLIGENCE_CONFIG.researchDepth.deepRequiredDomains;
  let depth = "pending";
  if (dossierIsDeep) depth = "deep";
  else if (approvedProviderDomains.length > 0
    && approvedDomains.length >= FILTER_INTELLIGENCE_CONFIG.researchDepth.deepMinimumDomainCount
    && required.every((domain) => approvedDomains.includes(domain))) depth = "deep";
  else if (approvedProviderDomains.length > 0
    && approvedDomains.length >= FILTER_INTELLIGENCE_CONFIG.researchDepth.enrichedMinimumDomainCount) depth = "enriched";
  else if (approvedDomains.length >= FILTER_INTELLIGENCE_CONFIG.researchDepth.basicMinimumDomainCount) depth = "basic";
  const researchState = dossierDomains.length || approvedProviderDomains.length
    ? "VERIFIED_RESEARCH"
    : pendingProviderDomains.length
      ? "EVIDENCE_FOUND_VERIFICATION_PENDING"
      : "NOT_YET_RESEARCHED";
  return { depth, approvedDomains, pendingDomains, dossierDomains, researchState };
}

export function researchDepthFor(program, researchCoverage, dossier = null) {
  return researchDepthDetail(program, researchCoverage, dossier).depth;
}

export function expandFilterIntelligenceRecord(record, flagBits = FILTER_FLAG_BITS) {
  const flags = Number(record?.flags ?? 0);
  const enabled = (name) => Boolean(flags & Number(flagBits[name] ?? 0));
  const j1 = enabled("j1");
  const h1b = enabled("h1b");
  return {
    programSpecialtyId: record?.programSpecialtyId,
    visa: { j1, h1b, j1OrH1b: j1 || h1b, any: enabled("anyVisa") },
    residentEvidence: {
      img: enabled("img"),
      do: enabled("do"),
      caribbean: enabled("caribbean"),
      usmd: enabled("usmd"),
    },
    researchDepth: record?.researchDepth,
    researchState: record?.researchState ?? "NOT_YET_RESEARCHED",
    approvedDomainCount: Number(record?.approvedDomainCount ?? 0),
    pendingDomainCount: Number(record?.pendingDomainCount ?? 0),
    dossierDomainCount: Number(record?.dossierDomainCount ?? 0),
    soap2026: enabled("soap2026"),
    abim: enabled("abim"),
    alumni: enabled("alumni"),
    searchTerms: Array.isArray(record?.searchTerms) ? record.searchTerms : [],
    application: record?.application ?? null,
    applicationMatch: record?.applicationMatch ?? null,
  };
}

function emptyCounts() {
  return {
    visaData: 0,
    j1Published: 0,
    h1bPublished: 0,
    j1OrH1bPublished: 0,
    anyVisaEvidence: 0,
    imgResidentEvidence: 0,
    doResidentEvidence: 0,
    caribbeanResidentEvidence: 0,
    usmdResidentEvidence: 0,
    deepResearch: 0,
    enrichedResearch: 0,
    basicProfile: 0,
    researchPending: 0,
    soap2026: 0,
    missionMedAlumni: 0,
    abimVerified: 0,
  };
}

export function buildFilterIntelligence(programs, {
  researchCoverage = [],
  currentFacts = [],
  dossiers = [],
  profile = {},
  generatedAt = new Date().toISOString(),
  includeApplicationMatch = true,
} = {}) {
  const researchByAcgme = new Map(researchCoverage.map((record) => [String(record.acgmeId), record]));
  const dossierByAcgme = new Map(dossiers.map((record) => [String(record.acgmeId), record]));
  const factsBySubject = new Map();
  for (const fact of currentFacts) {
    const keys = [fact.subjectId ?? fact.subject_id, fact.acgmeId ?? fact.acgme_id]
      .map((value) => String(value ?? "")).filter(Boolean);
    for (const key of new Set(keys)) {
      if (!factsBySubject.has(key)) factsBySubject.set(key, []);
      factsBySubject.get(key).push(fact);
    }
  }
  const counts = emptyCounts();
  const records = programs.map((program) => {
    const staticFacts = staticFilterFacts(program);
    const acgmeId = programIdentifier(program, "ACGME_PROGRAM");
    const dynamicFacts = [...(factsBySubject.get(String(program.id)) ?? []), ...(factsBySubject.get(String(acgmeId)) ?? [])];
    const dynamic = dynamicFactFlags([...new Set(dynamicFacts)]);
    const depthDetail = researchDepthDetail(
      program,
      researchByAcgme.get(String(acgmeId)),
      dossierByAcgme.get(String(acgmeId)),
    );
    const depth = depthDetail.depth;
    const filterFacts = {
      programSpecialtyId: program.programSpecialtyId,
      visa: {
        j1: staticFacts.visa.j1 || dynamic.j1,
        h1b: staticFacts.visa.h1b || dynamic.h1b,
        j1OrH1b: staticFacts.visa.j1OrH1b || dynamic.j1 || dynamic.h1b,
        any: staticFacts.visa.any || dynamic.j1 || dynamic.h1b,
      },
      residentEvidence: {
        img: staticFacts.residentEvidence.img || dynamic.img,
        do: staticFacts.residentEvidence.do || dynamic.do,
        caribbean: dynamic.caribbean,
        usmd: staticFacts.residentEvidence.usmd || dynamic.usmd,
      },
      researchDepth: depth,
      soap2026: program.soap2026?.appeared === true,
      abim: dynamic.abim,
      alumni: dynamic.alumni,
    };
    counts.visaData += knownValue(program, "Visa Sponsorship") !== undefined ? 1 : 0;
    counts.j1Published += filterFacts.visa.j1 ? 1 : 0;
    counts.h1bPublished += filterFacts.visa.h1b ? 1 : 0;
    counts.j1OrH1bPublished += filterFacts.visa.j1OrH1b ? 1 : 0;
    counts.anyVisaEvidence += filterFacts.visa.any ? 1 : 0;
    counts.imgResidentEvidence += filterFacts.residentEvidence.img ? 1 : 0;
    counts.doResidentEvidence += filterFacts.residentEvidence.do ? 1 : 0;
    counts.caribbeanResidentEvidence += filterFacts.residentEvidence.caribbean ? 1 : 0;
    counts.usmdResidentEvidence += filterFacts.residentEvidence.usmd ? 1 : 0;
    counts[`${depth === "deep" ? "deepResearch" : depth === "enriched" ? "enrichedResearch" : depth === "basic" ? "basicProfile" : "researchPending"}`] += 1;
    counts.soap2026 += filterFacts.soap2026 ? 1 : 0;
    counts.missionMedAlumni += filterFacts.alumni ? 1 : 0;
    counts.abimVerified += filterFacts.abim ? 1 : 0;
    const flags =
      (filterFacts.visa.j1 ? FILTER_FLAG_BITS.j1 : 0)
      | (filterFacts.visa.h1b ? FILTER_FLAG_BITS.h1b : 0)
      | (filterFacts.visa.any ? FILTER_FLAG_BITS.anyVisa : 0)
      | (filterFacts.residentEvidence.img ? FILTER_FLAG_BITS.img : 0)
      | (filterFacts.residentEvidence.do ? FILTER_FLAG_BITS.do : 0)
      | (filterFacts.residentEvidence.caribbean ? FILTER_FLAG_BITS.caribbean : 0)
      | (filterFacts.residentEvidence.usmd ? FILTER_FLAG_BITS.usmd : 0)
      | (filterFacts.soap2026 ? FILTER_FLAG_BITS.soap2026 : 0)
      | (filterFacts.abim ? FILTER_FLAG_BITS.abim : 0)
      | (filterFacts.alumni ? FILTER_FLAG_BITS.alumni : 0);
    const application = buildApplicationIntelligence(program, dynamicFacts, profile);
    const applicationSummary = {
      ...application,
      roster: {
        ...application.roster,
        schools: undefined,
        countries: undefined,
      },
    };
    return {
      programSpecialtyId: program.programSpecialtyId,
      flags,
      searchTerms: dynamicSearchTerms(dynamicFacts),
      researchDepth: depth,
      researchState: depthDetail.researchState,
      approvedDomainCount: depthDetail.approvedDomains.length,
      pendingDomainCount: depthDetail.pendingDomains.length,
      dossierDomainCount: depthDetail.dossierDomains.length,
      application: applicationSummary,
      applicationMatch: includeApplicationMatch
        ? evaluateApplicationCompatibility(application, profile)
        : null,
    };
  });
  if (DEPTH_ORDER.reduce((sum, depth) => sum + counts[depth === "deep" ? "deepResearch" : depth === "enriched" ? "enrichedResearch" : depth === "basic" ? "basicProfile" : "researchPending"], 0) !== programs.length) {
    throw new Error("RISE research-depth taxonomy must classify every program exactly once");
  }
  return {
    schemaVersion: FILTER_INTELLIGENCE_CONFIG.schemaVersion,
    contractId: FILTER_INTELLIGENCE_CONFIG.contractId,
    generatedAt,
    counts,
    flagBits: FILTER_FLAG_BITS,
    labels: FILTER_INTELLIGENCE_CONFIG.studentLabels,
    evidencePolicy: FILTER_INTELLIGENCE_CONFIG.evidencePolicy,
    applicationFacetCounts: applicationFacetCounts(records),
    profile: {
      available: Boolean(profile && typeof profile === "object" && Object.values(profile).some((value) => value !== null && String(value).trim() !== "")),
      personalizationReady: Boolean(profile?.medical_school || profile?.visa_status || profile?.step2_score || profile?.graduation_year || profile?.usce_months),
    },
    records,
  };
}
