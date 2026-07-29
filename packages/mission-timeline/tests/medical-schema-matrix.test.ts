import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { reviewMedicalEducationTimeline } from "../src/medical-education/reviewer.js";
import { document, event } from "./fixtures.js";

const root = new URL("../", import.meta.url);

test("medical education review permits either Step order and does not auto-correct source content", () => {
  const source = document({
    events: [
      event({ id: "step2", title: "Step 2 CK", categoryId: "usmle", startDate: "2023-01", endDate: null }),
      event({ id: "step1", title: "Step 1", categoryId: "usmle", startDate: "2023-06", endDate: null }),
      event({ id: "usce", title: "USCE Clinic", categoryId: "usce", startDate: "2025-01", endDate: "2025-02", siteName: "", location: "" }),
      event({ id: "personal", title: "Pregnancy and family transition", categoryId: "personal", startDate: "2024-01", visibilityState: "INTERVIEWER_SAFE" }),
    ],
  });
  const before = structuredClone(source);
  const review = reviewMedicalEducationTimeline(source);
  assert.ok(!review.findings.some((item) => item.code === "USMLE_SEQUENCE_REVIEW"));
  assert.ok(review.findings.some((item) => item.code === "USCE_SITE_MISSING"));
  assert.ok(review.findings.some((item) => item.code === "INTERVIEWER_SAFE_SENSITIVE_CONTEXT"));
  assert.equal(review.requiresAdvisorReview, true);
  assert.deepEqual(source, before);
  assert.match(review.disclaimer, /does not verify credentials/i);
});

test("medical education review asks for verification when an exam date is ambiguous", () => {
  const source = document({
    events: [event({ id: "step1", title: "Step 1", categoryId: "usmle", startDate: "2023", datePrecision: "YEAR" })],
  });
  const finding = reviewMedicalEducationTimeline(source).findings.find((item) => item.code === "USMLE_DATE_REVIEW");
  assert.deepEqual(finding?.eventIds, ["step1"]);
  assert.match(finding?.recommendation ?? "", /either order/i);
});

test("gap review uses merged visible coverage instead of adjacent event order", () => {
  const source = document({
    events: [
      event({ id: "long", title: "Long verified role", startDate: "2019-01", endDate: "2025-01" }),
      event({ id: "nested", title: "Nested project", startDate: "2020-01", endDate: "2020-02" }),
      event({ id: "later", title: "Later milestone", startDate: "2021-04", endDate: null, eventType: "milestone" }),
    ],
  });
  assert.ok(!reviewMedicalEducationTimeline(source).findings.some((item) => item.code === "CHRONOLOGY_GAP_REVIEW"));
});

test("dense overlap review detects concurrent non-identical intervals", () => {
  const source = document({
    events: [
      event({ id: "a", startDate: "2024-01", endDate: "2024-12" }),
      event({ id: "b", startDate: "2024-02", endDate: "2024-11" }),
      event({ id: "c", startDate: "2024-03", endDate: "2024-10" }),
      event({ id: "d", startDate: "2024-04", endDate: "2024-09" }),
    ],
  });
  const finding = reviewMedicalEducationTimeline(source).findings.find((item) => item.code === "DENSE_OVERLAP_REVIEW");
  assert.equal(finding?.eventIds.length, 4);
  assert.match(finding?.message ?? "", /overlap during 2024-04/i);
});

test("database migration enables RLS on every protected table and revokes public access", async () => {
  const sql = await readFile(new URL("database/migrations/202607150001_timeline_v1.sql", root), "utf8");
  const tables = [
    "principals", "principal_programs", "documents", "versions", "checkpoints", "advisor_assignments",
    "faculty_grants", "review_requests", "comments", "approval_events", "media_objects", "export_jobs",
    "artifacts", "artifact_files", "filevault_links", "outbox_events", "idempotency_keys", "audit_events", "deletion_requests",
  ];
  tables.forEach((table) => assert.match(sql, new RegExp(`alter table timeline\\.${table} enable row level security`, "i")));
  assert.match(sql, /revoke all on all tables in schema timeline from public/i);
  assert.match(sql, /owner_principal_id = timeline\.current_principal_id\(\)/);
  assert.match(sql, /advisor_assignments/);
  assert.match(sql, /faculty_grants/);
  assert.match(sql, /service_has_scope/);
  assert.doesNotMatch(sql, /using\s*\(\s*true\s*\)/i);
});

test("TimelineArtifact TypeScript contract preserves canonical 409 required fields", async () => {
  const types = await readFile(new URL("src/contracts/types.ts", root), "utf8");
  const required = [
    "updatedAt", "mimeType", "byteSize", "visibility", "primaryFile", "companionFiles", "timelineEventCount",
    "provenanceSummary", "synchronizationHistory", "idempotencyKey",
  ];
  required.forEach((field) => assert.match(types, new RegExp(`\\b${field}\\b`)));
  assert.match(types, /artifactSchemaVersion:\s*"d1-timeline-artifact-409\.1"/);
});

test("Matrix App Mode contract is non-iframe, feature-flagged, and reversible", async () => {
  const manifest = JSON.parse(await readFile(new URL("matrix/app-manifest.json", root), "utf8"));
  const lifecycle = await readFile(new URL("matrix/timeline-app-mode.js", root), "utf8");
  assert.equal(manifest.usesIframe, false);
  assert.equal(manifest.authenticationAuthority, "MATRIX");
  assert.equal(manifest.localRecoveryAuthority, "INDEXED_DB");
  assert.match(manifest.featureFlag, /timeline_app_mode/);
  assert.match(lifecycle, /mountMissionTimelineAppMode/);
  assert.match(lifecycle, /unmountMissionTimelineAppMode/);
  assert.doesNotMatch(lifecycle, /createElement\(["']iframe["']\)/i);
  assert.match(lifecycle, /RETURN TO MATRIX/);
});

test("D1-404 M0 serves canonical 407F while the superseded UXR shell remains inactive", async () => {
  const index = await readFile(new URL("web/index.html", root), "utf8");
  const styles = await readFile(new URL("web/styles/uxr-002.css", root), "utf8");
  const app = await readFile(new URL("web/js/uxr-002/app.js", root), "utf8");
  const adapter = await readFile(new URL("web/js/407f-engineering-adapter.js", root), "utf8");
  const authority = await readFile(new URL("docs/D1-404-AUTHORITY.md", root), "utf8");
  const addendumOne = await readFile(new URL("docs/D1-UXR-002-CONTRAST-ADDENDUM-001.md", root), "utf8");
  const addendumTwo = await readFile(new URL("docs/D1-UXR-002-CONTRAST-ADDENDUM-002.md", root), "utf8");
  assert.match(index, /<html lang="en">/);
  assert.match(index, /TIMELINE<b>\/\/S1<\/b>/);
  assert.match(index, /<nav id="rail">/);
  assert.match(index, /window\.D1_407F_TEST=/);
  assert.doesNotMatch(index, /<script type="module" src="\.\/js\/app\.js"><\/script>/);
  assert.doesNotMatch(index, /<link rel="stylesheet" href="\.\/styles\.css">/);
  assert.match(styles, /--accent-gold:#B98A2E/);
  assert.match(styles, /--accent-gold-text:#191C21/);
  assert.match(styles, /--ink-secondary:#565D66/);
  assert.match(styles, /--ink-tertiary:#8A9099/);
  assert.match(app, /new TimelineStore\(\)/);
  assert.match(app, /productionWrites:false/);
  assert.match(adapter, /import\s+\{TimelineStore\}\s+from\s+"\.\/uxr-002\/store\.js"/);
  assert.match(adapter, /canonicalUi:"407F"/);
  assert.match(adapter, /productionWrites:false/);
  assert.match(authority, /ACTIVE — SUPERSEDES WHITE UXR RUNTIME ACTIVATION/);
  assert.match(authority, /23e0f5d420b69cd90da3f04b30e5752183aff41c737860ec30fc4ccbb87beb6b/);
  assert.match(addendumOne, /^# D1-UXR-002-CONTRAST-ADDENDUM-001$/m);
  assert.match(addendumTwo, /^# D1-UXR-002-CONTRAST-ADDENDUM-002$/m);
});
