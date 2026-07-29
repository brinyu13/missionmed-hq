import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import "fake-indexeddb/auto";

import { HybridIndexedDbAdapter } from "../matrix/hybrid-indexeddb-adapter.js";
import { classifyEvent } from "../web/js/ingestion/event-classifier.js";
import { buildPracticeQuestions } from "../web/js/ui/product-410-ui.js";

const root = new URL("../", import.meta.url);

function localRecord(id = `timeline_privacy_${Date.now()}`) {
  return {
    id,
    sequence: 1,
    document: {
      id,
      schemaVersion: "d1-timeline-document-409.1",
      studentOwnerId: "LOCAL_STUDENT_OWNER_PLACEHOLDER",
      programId: "program_internal_medicine",
      title: "Local private draft",
      theme: "keynote",
      revision: 0,
      events: [],
    },
  };
}

test("ECFMG pending language remains quarantined while explicit completed certification is recognized", () => {
  const pending = classifyEvent({ title: "ECFMG application pending", section: "certifications" }, {});
  assert.equal(pending.canonicalType, "UNCLASSIFIED");
  assert.ok(pending.warnings.some((warning) => /must not be treated as certification/i.test(warning)));

  const complete = classifyEvent({ title: "ECFMG Certified", section: "certifications" }, {});
  assert.equal(complete.canonicalType, "ECFMG_CERTIFICATION");
});

test("non-US clinical rotation is quarantined and explicit USCE remains classifiable", () => {
  const nigeria = classifyEvent({ title: "Internal Medicine Clinical Rotation", location: "Lagos, Nigeria" }, { end: { timelineMonth: "2024-06" } });
  assert.equal(nigeria.canonicalType, "UNCLASSIFIED");
  assert.equal(nigeria.categoryId, "work");
  assert.ok(nigeria.warnings.some((warning) => /do not label.*USCE/i.test(warning)));

  const explicit = classifyEvent({ title: "USCE Internal Medicine Rotation", location: "Newark, NJ" }, { end: { timelineMonth: "2024-06" } });
  assert.equal(explicit.canonicalType, "USCE_TEACHING_HOSPITAL");
  assert.equal(explicit.categoryId, "th");
});

test("immigration wording is retained for human review without a legal-status conclusion", () => {
  const result = classifyEvent({ title: "Green card application pending" }, {});
  assert.equal(result.canonicalType, "UNCLASSIFIED");
  assert.equal(result.categoryId, "personal");
  assert.ok(result.warnings.some((warning) => /do not infer legal status/i.test(warning)));
});

test("practice questions exclude private and sensitive content unless safe disclosure is explicit", () => {
  const events = [
    { id: "public", title: "Research Coordinator", categoryId: "work", visibilityState: "INTERVIEWER_SAFE" },
    { id: "hidden", title: "Hidden Work", categoryId: "work", visibilityState: "HIDDEN" },
    { id: "student", title: "Student Work", categoryId: "work", visibilityState: "STUDENT_ONLY" },
    { id: "advisor-disclosed", title: "Clinic Coordinator", categoryId: "work", visibilityState: "ADVISOR_ONLY", studentConfirmedDisclosure: true },
    { id: "personal", title: "Pregnancy and family transition", categoryId: "personal", visibilityState: "INTERVIEWER_SAFE" },
    { id: "sensitive", title: "Visa and immigration transition", categoryId: "work", visibilityState: "INTERVIEWER_SAFE" },
  ];
  const eventIds = buildPracticeQuestions(events).map((question) => question.eventId);
  assert.deepEqual(eventIds, ["public", "advisor-disclosed"]);
});

test("blank builder contains no fabricated profile, scores, notes, flags, or public personal default", async () => {
  const source = await readFile(new URL("web/js/app-legacy-406a.js", root), "utf8");
  assert.match(source, /function blankProfile\(\)\{return\{name:'',country:'',visa:'',s1:'',s2:'',goal:''\}\}/);
  assert.match(source, /profile:blankProfile\(\)/);
  assert.match(source, /sticky:''/);
  assert.match(source, /comments:\[\]/);
  assert.match(source, /flags:\[\]/);
  assert.match(source, /wiz:\{name:'',country:'',visa:'',grad:''/);
  assert.match(source, /category==='personal'\?\{vis:'student',visibilityState:'STUDENT_ONLY'\}/);
  assert.doesNotMatch(source, /Personal milestone is advisor-only/);
});

test("hybrid browser persistence is local-only until remote sync consent is explicit", async () => {
  const calls = [];
  const states = [];
  const apiClient = {
    configured: true,
    async createDocument(document) { calls.push(["create", document.id]); return { document: { revision: 0 } }; },
    async checkpoint(documentId) { calls.push(["checkpoint", documentId]); return {}; },
  };
  const adapter = new HybridIndexedDbAdapter({
    name: `hybrid-consent-${Date.now()}`,
    apiClient,
    programId: "program_internal_medicine",
    onStatus: ({ state }) => states.push(state),
  });
  await adapter.open();
  const record = localRecord();
  await adapter.atomicPut([{ store: "documents", key: record.id, value: record }]);
  assert.equal((await adapter.get("documents", record.id)).document.title, "Local private draft");
  assert.equal((await adapter.pending()).length, 0);
  assert.deepEqual(await adapter.flush(), { synced: 0, pending: 0, consentRequired: true });
  assert.equal(calls.length, 0);
  assert.ok(states.includes("REMOTE_CONSENT_REQUIRED"));

  adapter.setRemoteSyncConsent(true);
  await adapter.atomicPut([{ store: "documents", key: record.id, value: { ...record, sequence: 2 } }]);
  const synced = await adapter.flush();
  assert.equal(synced.pending, 0);
  assert.equal(calls.some(([kind]) => kind === "create"), true);
  assert.equal(calls.some(([kind]) => kind === "checkpoint"), true);
  adapter.close();
});
