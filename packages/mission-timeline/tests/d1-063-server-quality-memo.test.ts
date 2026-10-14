// TL-AAA-STABILIZE-20261013 (Silma/Ismat): the rule-based Guardian report ran in full on every
// save, checkpoint, list and read, blocking the API event loop for seconds per CV-imported
// document. The exact-key memo must return the identical report for unchanged content and
// never a stale one when anything the analysis reads changes.
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalServerQuality022 } from "../src/intelligence/server-quality-022.js";
import { sanitizeProviderMetadata022 } from "../src/intelligence/provider-authenticity-022.js";
import { document } from "./fixtures.js";

function dense() {
  const doc = document();
  const hospitals = ["Hackensack University Medical Center", "Jersey Shore University Medical Center", "Robert Wood Johnson University Hospital", "Newark Beth Israel Medical Center", "Saint Peter's University Hospital", "Morristown Medical Center"];
  const specialties = ["Internal Medicine", "General Surgery", "Pediatrics", "Obstetrics and Gynecology", "Psychiatry", "Family Medicine"];
  doc.events = [
    ...doc.events,
    ...hospitals.map((siteName, index) => ({
      id: `rotation-${index + 1}`, title: "Clinical Clerkship", siteName, categoryId: "clinical", eventType: "duration",
      startDate: `2024-${String(index * 2 + 1).padStart(2, "0")}`, endDate: `2024-${String(index * 2 + 2).padStart(2, "0")}`,
      openEnded: false, visibilityState: "INTERVIEWER_SAFE", fields: { canonicalType: "CLERKSHIP", specialty: specialties[index], institution: siteName, city: "Newark", state: "NJ" },
    })),
  ] as never;
  return doc;
}
const strip = (value: unknown) => JSON.parse(JSON.stringify(value, (key, item) => (key === "checkedAt" ? undefined : item)));

test("an unchanged document receives the identical report from the memo, far faster", () => {
  const doc = dense();
  const started = performance.now();
  const first = canonicalServerQuality022(doc);
  const firstMs = performance.now() - started;
  const again = performance.now();
  const second = canonicalServerQuality022(structuredClone(doc));
  const secondMs = performance.now() - again;
  assert.deepEqual(strip(second), strip(first));
  assert.notEqual(second, first, "callers receive their own copy, never the cached object");
  assert.ok(Number(first.findingCount) >= 1, "the dense fixture exercises a real Founder composition");
  assert.ok(secondMs < Math.max(50, firstMs / 5), `memo hit took ${Math.round(secondMs)}ms against ${Math.round(firstMs)}ms`);
});

test("anything the analysis reads invalidates the memo: revision, Guardian metadata, events, overrides", () => {
  const base = dense();
  const baseline = canonicalServerQuality022(base);
  const bumped = structuredClone(base); bumped.revision = Number(base.revision || 0) + 7;
  assert.equal(canonicalServerQuality022(bumped).generatedFromRevision, bumped.revision);
  const fixed = structuredClone(base); fixed.metadata = { ...(fixed.metadata ?? {}), qualityGuardian: { appliedFixes: ["CONCISE_LABELS"] } };
  assert.deepEqual((canonicalServerQuality022(fixed).oversight as { appliedFixes: string[] }).appliedFixes, ["CONCISE_LABELS"]);
  assert.deepEqual((baseline.oversight as { appliedFixes: string[] }).appliedFixes, []);
  const edited = structuredClone(base); const rotation = (edited.events as { id: string; startDate: string; endDate: string }[]).find((event) => event.id === "rotation-1")!;
  rotation.startDate = "2024-06"; rotation.endDate = "2024-01";
  const codes = (report: Record<string, unknown>) => (report.findings as { code: string }[]).map((finding) => finding.code);
  assert.ok(codes(canonicalServerQuality022(edited)).includes("END_BEFORE_START"));
  assert.ok(!codes(baseline).includes("END_BEFORE_START"));
});

test("a version save of unchanged content (new revision, new timestamp, builder drafts) is a memo hit with the request's revision stamp", () => {
  const doc = dense();
  const first = canonicalServerQuality022(doc);
  const saved = structuredClone(doc);
  saved.revision = Number(doc.revision || 0) + 1;
  saved.metadata = { ...(saved.metadata ?? {}), updatedAt: "2026-10-13T00:00:02.000Z", applicationVersion: "D1-412.0" };
  (saved as { builder?: unknown }).builder = { drafts: { work: { role: "typing" } } };
  const started = performance.now();
  const second = canonicalServerQuality022(saved);
  const ms = performance.now() - started;
  assert.equal(second.generatedFromRevision, saved.revision);
  assert.deepEqual(strip({ ...second, generatedFromRevision: 0 }), strip({ ...first, generatedFromRevision: 0 }));
  assert.ok(ms < 200, `version-save memo hit took ${Math.round(ms)}ms`);
});

test("the sanitizer's own rewrites (report, summary, save timestamps) do not defeat the memo", () => {
  const doc = dense();
  const sanitizedOnce = sanitizeProviderMetadata022(doc);
  const started = performance.now();
  const sanitizedTwice = sanitizeProviderMetadata022({ ...sanitizedOnce, metadata: { ...sanitizedOnce.metadata, updatedAt: "2026-10-13T00:00:01.000Z" } } as never);
  const ms = performance.now() - started;
  assert.deepEqual(strip(sanitizedTwice.metadata?.qualityReport022), strip(sanitizedOnce.metadata?.qualityReport022));
  assert.equal((sanitizedTwice.metadata?.qualitySummary022 as { basis: string }).basis, "MISSIONMED_RULE");
  assert.ok(ms < 400, `re-sanitizing unchanged content took ${Math.round(ms)}ms`);
});
