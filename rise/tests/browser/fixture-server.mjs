import { createRiseServer } from "../../server.mjs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SELECTED_FIELD_COUNT = 72;

function known(value) {
  return {
    knowledge: { state: "known", value, explicit: true },
    claimId: `synthetic-claim-${String(value).replace(/[^a-z0-9]+/gi, "-").slice(0, 30)}`,
    sourceDocumentId: "synthetic-source",
    assertionClass: "synthetic_fixture",
    sourceUpdatedAt: "2026-07-09",
    retrievedAt: "2026-07-10",
    missionMedVerifiedAt: "2026-07-09",
    missionMedVerifiedBy: "Synthetic test reviewer",
  };
}

function unknown() {
  return { knowledge: { state: "unknown", explicit: true } };
}

function program({ id, name, designation, city, state, memberships, j1, h1b, director, imgPercent, doPercent, usmdPercent, deadline, soap2026 = null, sparse = false }) {
  const fields = {
    "Program Website": known("https://example.test/program"),
    "Program Best Described As": known("University-based"),
    "Program Director": known(director),
    "Program Director Credentials": known("MD"),
    "Program Coordinator": known("Synthetic Coordinator"),
    "Total Residents": known(36),
    "Residents Per Year": known(12),
    "Salary PGY1": known(72000),
    Vacation: known("20 days"),
    J1: j1 ? known(true) : unknown(),
    H1B: h1b ? known(true) : unknown(),
    "Visa Sponsorship": j1 || h1b ? known([j1 ? "J-1 through ECFMG" : "", h1b ? "H-1B" : ""].filter(Boolean).join("; ")) : unknown(),
    "COMLEX Accepted": unknown(),
    "Research Track": known(false),
  };
  if (imgPercent !== undefined) fields["IMG Graduates Percent"] = known(`${imgPercent}%`);
  if (doPercent !== undefined) fields["DO Graduates Percent"] = known(`${doPercent}%`);
  if (usmdPercent !== undefined) fields["US MD Graduates Percent"] = known(`${usmdPercent}%`);
  if (deadline) fields["Application Deadline"] = known(deadline);
  if (sparse) {
    for (const field of Object.keys(fields)) {
      if (field !== "Program Website") delete fields[field];
    }
  }
  const knownSelectedClaims = Object.values(fields)
    .filter((field) => field.knowledge.state === "known").length;
  return {
    id: `rise_prg_${id}`,
    programSpecialtyId: `rise_ps_${id}`,
    display: {
      programName: name,
      institution: `${name} Institution`,
      hospital: `${name} Teaching Hospital`,
      city,
      state,
      zip: "10001",
    },
    designation,
    kind: designation.includes("/") ? "combined" : "single",
    entryFormat: "categorical",
    components: designation.split("/"),
    identifiers: [{ namespace: "ACGME_PROGRAM", value: `synthetic-${id}` }],
    browseMemberships: memberships,
    soap2026,
    fields,
    evidence: {
      knownClaims: knownSelectedClaims,
      knownEvidenceLabeledClaims: knownSelectedClaims,
      knownSelectedClaims,
      evidenceLabeledClaims: Object.keys(fields).length,
      quarantinedClaims: 0,
      coveragePercent: Math.round(knownSelectedClaims / SELECTED_FIELD_COUNT * 1000) / 10,
      selectedFieldCount: SELECTED_FIELD_COUNT,
      absentSelectedClaims: SELECTED_FIELD_COUNT - Object.keys(fields).length,
      unknownSelectedClaims: SELECTED_FIELD_COUNT - knownSelectedClaims,
      matchableClaims: 0,
    },
    source: {
      sourceDocumentId: "synthetic-source",
      authority: "SYNTHETIC_TEST",
      assertionClass: "synthetic_fixture",
      urls: [],
      retrievedAt: "2026-07-09",
      sourceUpdatedAt: "2026-07-09",
      missionMedVerifiedAt: "2026-07-09",
      missionMedVerifiedBy: "Synthetic test reviewer",
    },
  };
}

const registryIndex = {
  schemaVersion: 1,
  registryReleaseId: "rise_registry_synthetic_browser_fixture",
  sourceSnapshotId: "rise_snapshot_synthetic_browser_fixture",
  activationStatus: "test_fixture",
  dataClassification: "synthetic_test_fixture",
  releaseGate: { sourceRightsApproved: false },
  sourcePolicy: {
    freida: "not_present_in_synthetic_fixture",
    residencyExplorer: "not_present_in_synthetic_fixture",
  },
  counts: {
    rawSourceRows: 4,
    activeSourceRows: 4,
    quarantinedSourceRows: 0,
    uniquePrograms: 4,
    programSpecialties: 4,
    browseMemberships: 5,
    additionalBrowseMemberships: 1,
    specialtyTabs: 3,
    exactSpecialtyDesignations: 4,
    evidenceLabeledClaims: 48,
    unknownClaimsFromAmbiguousNegatives: 0,
    omittedBlankCells: 0,
    matchableClaims: 0,
  },
  filters: {
    states: ["CA", "IL", "NY", "WA"],
    specialties: ["Internal Medicine", "Neurology", "Pediatrics"],
    designations: ["Internal Medicine", "Internal Medicine/Pediatrics", "Neurology", "Pediatrics"],
  },
  programs: [
    program({
      id: "atlas_im",
      name: "Atlas Internal Medicine Program",
      designation: "Internal Medicine",
      city: "New York",
      state: "NY",
      j1: true,
      imgPercent: 35,
      doPercent: 12,
      usmdPercent: 53,
      deadline: "2026-11-30",
      director: "Dr. Test Director",
      memberships: [{ browseSpecialty: "Internal Medicine", relationship: "EXACT_DESIGNATION" }],
      soap2026: {
        appeared: true,
        cycle: 2026,
        wording: "SOAP 2026 - This program appeared in the 2026 SOAP results.",
        context: "SOAP participation reflects the 2026 Match cycle and does not predict future availability or match likelihood.",
        tracks: [{ programType: "Categorical", nrmpProgramCode: "9999140C0", availablePositions: 3 }],
      },
    }),
    program({
      id: "beacon_medpeds",
      name: "Beacon Medicine Pediatrics Program",
      designation: "Internal Medicine/Pediatrics",
      city: "Chicago",
      state: "IL",
      h1b: true,
      deadline: "2026-12-01",
      director: "Dr. Synthetic Director",
      memberships: [
        { browseSpecialty: "Internal Medicine", relationship: "RELATED_COMBINED" },
        { browseSpecialty: "Pediatrics", relationship: "RELATED_COMBINED" },
      ],
    }),
    program({
      id: "cascade_neuro",
      name: "Cascade Neurology Program",
      designation: "Neurology",
      city: "Seattle",
      state: "WA",
      imgPercent: 0,
      doPercent: 0,
      usmdPercent: 100,
      deadline: "2026-12-15",
      director: "Dr. Fixture Director",
      memberships: [{ browseSpecialty: "Neurology", relationship: "EXACT_DESIGNATION" }],
    }),
    program({
      id: "delta_peds",
      name: "Delta Pediatrics Program",
      designation: "Pediatrics",
      city: "Los Angeles",
      state: "CA",
      director: "Dr. Example Director",
      sparse: true,
      memberships: [{ browseSpecialty: "Pediatrics", relationship: "EXACT_DESIGNATION" }],
    }),
  ],
};

const port = Number.parseInt(process.env.RISE_FIXTURE_PORT ?? "4178", 10);
const server = createRiseServer({
  registryIndex,
  authMode: "local-preview",
  buildId: "synthetic-browser-fixture",
  environment: "test",
  webDirectory: process.env.RISE_BROWSER_DIST
    ? path.resolve(process.env.RISE_BROWSER_DIST)
    : fileURLToPath(new URL("../../dist/", import.meta.url)),
  abuseController: {
    scope: "browser_test_fixture",
    async allowPreAuth() { return true; },
    async allowAuthenticatedSubject() { return true; },
  },
  logger: { info() {}, error() {} },
  filterIntelligenceStore: {
    scope: "process_local_test_only",
    async read() {
      return {
        researchCoverage: [
          {
            acgmeId: "synthetic-atlas_im",
            fields: [
              "research.visa", "research.resident_roster", "research.leadership", "research.abim",
              "research.fellowship_inventory", "research.img_accessibility", "research.do_accessibility",
              "research.caribbean_accessibility", "research.application_requirements", "research.curriculum",
            ],
          },
          {
            acgmeId: "synthetic-beacon_medpeds",
            fields: ["research.visa", "research.resident_roster", "research.leadership"],
          },
        ],
        currentFacts: [
          {
            subjectId: "rise_prg_beacon_medpeds",
            field: "research.resident_roster",
            canonicalValue: [
              { classification: "IMG", caribbean: "YES" },
              { classification: "US_DO", degree: "DO", caribbean: "NO" },
            ],
          },
        ],
      };
    },
  },
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`RISE synthetic browser fixture listening on http://127.0.0.1:${port}/rise/\n`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
