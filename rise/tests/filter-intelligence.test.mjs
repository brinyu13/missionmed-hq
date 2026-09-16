import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import {
  FILTER_INTELLIGENCE_CONFIG,
  buildFilterIntelligence,
  expandFilterIntelligenceRecord,
  researchDepthFor,
  staticFilterFacts,
} from "../src/filter-intelligence.mjs";
import { createRiseFilterIntelligenceStore } from "../adapters/postgres-runtime.mjs";

test("embedded runtime contract matches the checked-in JSON contract", async () => {
  const contract = JSON.parse(await fs.readFile(
    new URL("../config/filter-intelligence.v1.json", import.meta.url),
    "utf8",
  ));
  assert.deepEqual(FILTER_INTELLIGENCE_CONFIG, contract);
});

function known(value) {
  return { knowledge: { state: "known", value, explicit: true } };
}

function program(id, fields = {}, { soap = false } = {}) {
  return {
    id: `program-${id}`,
    programSpecialtyId: `program-specialty-${id}`,
    identifiers: [{ namespace: "ACGME_PROGRAM", value: id.padStart(10, "0") }],
    fields,
    soap2026: soap ? { appeared: true } : null,
  };
}

const strongCore = {
  "Program Website": known("https://example.test/program"),
  "Program Best Described As": known("University-based"),
  "Application Deadline": known("2026-11-30"),
  "Visa Sponsorship": known("J-1 through ECFMG"),
  "IMG Graduates Percent": known("21.5%"),
};

test("static filters use explicit visa evidence and positive resident composition", () => {
  const facts = staticFilterFacts(program("1", {
    ...strongCore,
    J1: known(true),
    H1B: known(false),
    "DO Graduates Percent": known("0.0%"),
    "US MD Graduates Percent": known("78.5%"),
  }));
  assert.deepEqual(facts.visa, { j1: true, h1b: false, j1OrH1b: true, any: true });
  assert.deepEqual(facts.residentEvidence, { img: true, do: false, caribbean: false, usmd: true });
  assert.equal(facts.coreDomainCount, 5);

  const vague = staticFilterFacts(program("2", {
    "Visa Sponsorship": known("International graduates accepted; ECFMG required"),
  }));
  assert.equal(vague.visa.any, false);
});

test("research depth is deterministic and provider neutral", () => {
  const p = program("3", { ...strongCore, "Step Preferences": known("USMLE Step 1 passed: Yes") });
  const deepFields = [
    "research.visa", "research.resident_roster", "research.leadership",
    "research.abim", "research.fellowship_inventory", "research.img_accessibility", "research.curriculum",
  ];
  assert.equal(researchDepthFor(p, { fields: deepFields, provider: "PARALLEL" }), "deep");
  assert.equal(researchDepthFor(p, { fields: deepFields, provider: "CLAUDE_OPUS" }), "deep");
  assert.equal(researchDepthFor(p, { fields: ["research.visa", "research.leadership"] }), "enriched");
  assert.equal(researchDepthFor(p, null), "basic");
  assert.equal(researchDepthFor(program("30", {
    "Program Website": known("https://example.test"),
    "Program Best Described As": known("University-based"),
  }), null), "basic");
  assert.equal(researchDepthFor(program("4", { "Program Website": known("https://example.test") }), null), "pending");
});

test("a completed Dossier V2 automatically promotes research depth without a frontend list", () => {
  const matrix = Object.fromEntries([
    "identity", "application_basics", "visa", "exams", "yog", "usce", "ecfmg",
    "deadline", "signaling", "resident_roster", "resident_schools", "leadership",
    "salary_benefits", "structure", "curriculum", "fellowships", "outcomes", "culture",
  ].map((domain) => [domain, { state: "RESEARCHED_NOT_FOUND" }]));
  matrix.identity = { state: "VERIFIED" };
  assert.equal(researchDepthFor(program("31", {}), null, {
    status: "COMPLETED",
    completionMatrix: matrix,
    completionScore: 1,
    dossierOutcome: "DEEP",
  }), "deep");
});

test("compact filter projection preserves normalized medical-school aliases", () => {
  const [record] = buildFilterIntelligence([program("alias")], {
    currentFacts: [{
      subjectId: "program-alias",
      field: "research.resident_roster",
      canonicalValue: [{ name: "Resident", medical_school: "Lake Erie College of Osteopathic Medicine", degree: "DO" }],
    }],
  }).records;
  assert.ok(record.application.roster.schools[0].aliases.includes("LECOM"));
});

test("approved structured current facts become filterable without frontend program lists", () => {
  const programs = [
    program("1", { ...strongCore, J1: known(true) }, { soap: true }),
    program("2", { "Program Website": known("https://example.test/two") }),
    program("3", strongCore),
    program("4", {}),
  ];
  const result = buildFilterIntelligence(programs, {
    generatedAt: "2026-09-08T00:00:00.000Z",
    researchCoverage: [
      {
        acgmeId: "0000000001",
        fields: [
          "research.visa", "research.resident_roster", "research.leadership",
          "research.abim", "research.fellowship_inventory", "research.img_accessibility", "research.application_requirements", "research.curriculum",
        ],
      },
      { acgmeId: "0000000002", fields: ["research.visa", "research.resident_roster", "research.leadership", "research.abim"] },
    ],
    currentFacts: [
      {
        subjectId: "program-2",
        field: "research.visa",
        canonicalValue: { supported: ["ECFMG J-1", "H-1B"], summary: "ignored narrative" },
      },
      {
        subjectId: "program-2",
        field: "research.resident_roster",
        canonicalValue: [
          { classification: "IMG", caribbean: "YES", medical_school: "International University School of Medicine" },
          { classification: "US_DO", degree: "DO", caribbean: "NO" },
        ],
      },
      {
        subjectId: "program-2",
        field: "research.curriculum",
        canonicalValue: { overnight_call: "Only during adult neurology months" },
      },
    ],
  });
  const expanded = result.records.map((record) => expandFilterIntelligenceRecord(record, result.flagBits));
  assert.equal(expanded[0].researchDepth, "deep");
  assert.equal(expanded[1].researchDepth, "enriched");
  assert.equal(expanded[2].researchDepth, "basic");
  assert.equal(expanded[3].researchDepth, "pending");
  assert.equal(expanded[1].visa.j1, true);
  assert.equal(expanded[1].visa.h1b, true);
  assert.deepEqual(expanded[1].residentEvidence, { img: true, do: true, caribbean: true, usmd: false });
  assert.equal(expanded[1].researchState, "VERIFIED_RESEARCH");
  assert.ok(expanded[1].searchTerms.includes("International University School of Medicine"));
  assert.ok(expanded[1].searchTerms.includes("Only during adult neurology months"));
  assert.equal("entries" in result.records[1].application.roster, false);
  assert.ok(Array.isArray(result.records[1].application.roster.schools));
  assert.ok(Buffer.byteLength(JSON.stringify(result.records[1].application)) < 5_000);
  assert.deepEqual(result.counts, {
    visaData: 2,
    j1Published: 2,
    h1bPublished: 1,
    j1OrH1bPublished: 2,
    anyVisaEvidence: 3,
    imgResidentEvidence: 3,
    doResidentEvidence: 1,
    caribbeanResidentEvidence: 1,
    usmdResidentEvidence: 0,
    deepResearch: 1,
    enrichedResearch: 1,
    basicProfile: 1,
    researchPending: 1,
    soap2026: 1,
    missionMedAlumni: 0,
    abimVerified: 0,
  });
});

test("Postgres projection derives depth from source-neutral approved current facts, then caches", async () => {
  const calls = [];
  let connects = 0;
  const client = {
    async query(sql) {
      calls.push(String(sql));
      if (String(sql).includes("coverage_signals")) {
        return { rows: [{ acgmeId: "0000000001", fields: ["research.visa", "research.resident_roster"] }] };
      }
      if (String(sql).includes("canonical_current_facts")) {
        return { rows: [{ subjectId: "program-1", field: "research.visa", knowledge: { state: "known" }, canonicalValue: { j1: "YES" } }] };
      }
      if (String(sql).includes("FROM rise_runtime.research_jobs")) {
        return { rows: [{ acgmeId: "0000000001", status: "COMPLETED", completionMatrix: {}, completionScore: "1", dossierOutcome: "DEEP" }] };
      }
      return { rows: [] };
    },
    release() {},
  };
  const pool = {
    async query(sql) {
      calls.push(String(sql));
      return { rows: [] };
    },
    async connect() {
      connects += 1;
      return client;
    },
  };
  const store = await createRiseFilterIntelligenceStore({ pool, cacheTtlMs: 60_000 });
  const first = await store.read();
  const second = await store.read();
  assert.equal(store.scope, "durable_canonical_projection");
  assert.deepEqual(second, first);
  assert.equal(connects, 1);
  assert.ok(calls.some((sql) => sql.includes("SET_CONFIG") || sql.includes("set_config")));
  assert.equal(JSON.stringify(first).includes("canonical_value"), false);
  const coverageQuery = calls.find((sql) => sql.includes("coverage_signals"));
  const factsQuery = calls.find((sql) => sql.includes("canonical_current_facts") && sql.includes("promoted_source_urls"));
  assert.match(coverageQuery, /canonical_current_facts/);
  assert.match(coverageQuery, /publication_state IN \('STUDENT_VISIBLE', 'PRIVATE_BETA'\)/);
  assert.doesNotMatch(coverageQuery, /source_type\s*=/);
  assert.doesNotMatch(coverageQuery, /provider\s*=/);
  assert.match(factsQuery, /WITH promoted_source_urls AS/);
  assert.doesNotMatch(factsQuery, /WHERE l\.promoted_claim_id = f\.claim_id/);
  assert.equal(first.currentFacts[0].field, "research.visa");
  assert.equal(first.dossiers[0].completionScore, 1);
});

test("review-gated claims report pending evidence without inflating research depth", () => {
  const p = program("5", { "Program Website": known("https://example.test/five") });
  const result = buildFilterIntelligence([p], {
    researchCoverage: [{
      acgmeId: "0000000005",
      fields: [],
      pendingFields: ["research.visa", "research.resident_roster", "research.leadership", "research.abim"],
    }],
  });
  const expanded = expandFilterIntelligenceRecord(result.records[0], result.flagBits);
  assert.equal(expanded.researchDepth, "pending");
  assert.equal(expanded.researchState, "EVIDENCE_FOUND_VERIFICATION_PENDING");
  assert.equal(expanded.approvedDomainCount, 1);
  assert.equal(expanded.pendingDomainCount, 4);
});

test("deferred bootstrap can omit personalized application match payloads", () => {
  const result = buildFilterIntelligence([
    program("6", { ...strongCore, J1: known(true) }),
  ], {
    includeApplicationMatch: false,
  });

  assert.equal(result.records[0].applicationMatch, null);
  assert.equal(result.records[0].application.visa.j1, true);
  assert.equal(result.counts.j1Published, 1);
});

test("normalized resident composition counts drive independent IMG DO Caribbean and US MD filters", () => {
  const result = buildFilterIntelligence([program("7", {})], {
    currentFacts: [{
      subjectId: "program-7",
      field: "research.resident_composition",
      canonicalValue: {
        contractId: "rise-roster-composition-estimate-v1",
        percentagesAvailable: true,
        counts: { usMd: 4, do: 3, img: 5, imgOther: 3, caribbeanImg: 2 },
      },
    }],
  });
  const record = expandFilterIntelligenceRecord(result.records[0], result.flagBits);
  assert.deepEqual(record.residentEvidence, { img: true, do: true, caribbean: true, usmd: true });
  assert.equal(result.counts.imgResidentEvidence, 1);
  assert.equal(result.counts.doResidentEvidence, 1);
  assert.equal(result.counts.caribbeanResidentEvidence, 1);
  assert.equal(result.counts.usmdResidentEvidence, 1);
});
