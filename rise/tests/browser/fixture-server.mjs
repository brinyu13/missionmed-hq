import { createRiseServer } from "../../server.mjs";
import { fileURLToPath } from "node:url";

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

function program({ id, name, designation, city, state, memberships, j1, h1b, director }) {
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
    "COMLEX Accepted": unknown(),
    "Research Track": known(false),
  };
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
      director: "Dr. Test Director",
      memberships: [{ browseSpecialty: "Internal Medicine", relationship: "EXACT_DESIGNATION" }],
    }),
    program({
      id: "beacon_medpeds",
      name: "Beacon Medicine Pediatrics Program",
      designation: "Internal Medicine/Pediatrics",
      city: "Chicago",
      state: "IL",
      h1b: true,
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
  webDirectory: fileURLToPath(new URL("../../dist/", import.meta.url)),
  logger: { info() {}, error() {} },
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`RISE synthetic browser fixture listening on http://127.0.0.1:${port}/rise/\n`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
