// Keep the runtime contract embedded because the production image copies `src/`
// but intentionally does not copy repository-level configuration files. The
// checked-in JSON remains the human-readable contract and a test below ensures
// these two representations cannot drift.
export const FILTER_INTELLIGENCE_CONFIG = Object.freeze({
  schemaVersion: 1,
  contractId: "rise-filter-intelligence-2026-09-08",
  researchDepth: {
    domainFields: [
      "research.visa",
      "research.resident_roster",
      "research.leadership",
      "research.abim",
      "research.fellowship_inventory",
      "research.img_accessibility",
      "research.do_accessibility",
      "research.caribbean_accessibility",
    ],
    deepRequiredFields: [
      "research.visa",
      "research.resident_roster",
      "research.leadership",
    ],
    deepMinimumDomainCount: 6,
    enrichedMinimumDomainCount: 2,
    basicMinimumCoreDomainCount: 4,
    coreRegistryDomains: {
      officialWebsite: ["Program Website"],
      programStructure: ["Program Best Described As", "Total Residents"],
      applicationTimeline: ["Application Deadline", "Medical School Graduation Timeline"],
      visaPublication: ["J1", "H1B", "Visa Sponsorship"],
      residentComposition: ["IMG Graduates Percent", "DO Graduates Percent", "US MD Graduates Percent"],
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
    researchDepth: "Depth exposes provider-neutral workflow coverage only; it never publishes review-gated claim content.",
  },
});
export const FILTER_FLAG_BITS = Object.freeze({ ...FILTER_INTELLIGENCE_CONFIG.filterFlagBits });

const DEPTH_ORDER = Object.freeze(["deep", "enriched", "basic", "pending"]);
const VALID_FILTER_FIELDS = new Set([
  ...FILTER_INTELLIGENCE_CONFIG.researchDepth.domainFields,
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
  return value === true || ["YES", "TRUE", "SUPPORTED", "PUBLISHED"].includes(String(value ?? "").trim().toUpperCase());
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
      flags.j1 ||= affirmative(value.j1);
      flags.h1b ||= affirmative(value.h1b);
    }
    if (fact.field === "research.resident_roster") {
      for (const resident of rosterRows(value)) {
        const classification = normalizedClassification(resident.classification);
        const degree = normalizedClassification(resident.degree);
        flags.img ||= classification === "IMG";
        flags.do ||= classification === "DO" || classification === "US_DO" || degree === "DO";
        flags.usmd ||= classification === "US_MD";
        flags.caribbean ||= affirmative(resident.caribbean);
      }
    }
    if (fact.field === "research.abim" && value && typeof value === "object") {
      const passRate = Number(value.pass_rate ?? value.passRate);
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
  const coreDomainCount = Object.values(coreDomains).filter((fields) => {
    if (fields === coreDomains.visaPublication) return j1 || h1b || explicitVisaText;
    return hasKnownValue(program, fields);
  }).length;
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
    coreDomainCount,
  };
}

export function researchDepthFor(program, researchCoverage) {
  const staticFacts = staticFilterFacts(program);
  if (researchCoverage) {
    const fields = new Set((researchCoverage.fields ?? []).filter((field) =>
      FILTER_INTELLIGENCE_CONFIG.researchDepth.domainFields.includes(field)));
    const required = FILTER_INTELLIGENCE_CONFIG.researchDepth.deepRequiredFields;
    if (
      fields.size >= FILTER_INTELLIGENCE_CONFIG.researchDepth.deepMinimumDomainCount
      && required.every((field) => fields.has(field))
    ) return "deep";
    if (fields.size >= FILTER_INTELLIGENCE_CONFIG.researchDepth.enrichedMinimumDomainCount) return "enriched";
  }
  return staticFacts.coreDomainCount >= FILTER_INTELLIGENCE_CONFIG.researchDepth.basicMinimumCoreDomainCount
    ? "basic"
    : "pending";
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
    soap2026: enabled("soap2026"),
    abim: enabled("abim"),
    alumni: enabled("alumni"),
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
  generatedAt = new Date().toISOString(),
} = {}) {
  const researchByAcgme = new Map(researchCoverage.map((record) => [String(record.acgmeId), record]));
  const factsBySubject = new Map();
  for (const fact of currentFacts) {
    const subjectId = String(fact.subjectId ?? fact.subject_id ?? "");
    if (!subjectId) continue;
    if (!factsBySubject.has(subjectId)) factsBySubject.set(subjectId, []);
    factsBySubject.get(subjectId).push(fact);
  }
  const counts = emptyCounts();
  const records = programs.map((program) => {
    const staticFacts = staticFilterFacts(program);
    const dynamic = dynamicFactFlags(factsBySubject.get(String(program.id)) ?? []);
    const acgmeId = programIdentifier(program, "ACGME_PROGRAM");
    const depth = researchDepthFor(program, researchByAcgme.get(String(acgmeId)));
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
    return { programSpecialtyId: program.programSpecialtyId, flags, researchDepth: depth };
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
    records,
  };
}
