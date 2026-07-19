import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import test from "node:test";

import {
  FileSessionLedger,
  MissionMedInterviewerBrain,
  RuleModelAdapter,
  deterministicClock,
} from "../src/index.mjs";
import {
  cleanupRun,
  createFixtureHarness,
  readDevelopmentFixtures,
  runFixture,
} from "./helpers/harness.mjs";

async function fixture(id) {
  const corpus = await readDevelopmentFixtures();
  return corpus.cases.find((entry) => entry.id === id);
}

test("ledger persists a validated event/revision chain and reopens deterministically", async () => {
  const run = await runFixture(await fixture("ADAPT-SHORT-001"), { keepDirectory: true });
  try {
    const reopened = await FileSessionLedger.open({ path: run.path, clock: deterministicClock() });
    assert.deepEqual(reopened.getSession(run.sessionId), run.session);
    assert.equal(run.session.events.length, 2);
    assert.equal(run.session.revisions.length, 2);
    assert.equal(run.session.events[1].previous_event_hash, run.session.events[0].event_hash);
    assert.equal(run.session.revisions[1].previous_revision_hash, run.session.revisions[0].content_hash);
  } finally {
    await cleanupRun(run);
  }
});

test("session start and turn commands are idempotent while conflicting retries fail", async () => {
  const harness = await createFixtureHarness(await fixture("ADAPT-SHORT-001"));
  try {
    await assert.doesNotReject(() => harness.brain.startSession({ sessionId: harness.sessionId, idempotencyKey: "start:ADAPT-SHORT-001" }));
    const command = {
      sessionId: harness.sessionId,
      turnId: "turn:idempotency:1",
      text: "I made our fictional sign-out better.",
      idempotencyKey: "turn:idempotency:1",
    };
    const first = await harness.brain.processTurn(command);
    const second = await harness.brain.processTurn(command);
    assert.deepEqual(second.decision, first.decision);
    assert.equal(harness.ledger.getSession(harness.sessionId).events.length, 2);
    await assert.rejects(
      () => harness.brain.processTurn({ ...command, text: "A different retry payload." }),
      (error) => error.code === "IDEMPOTENCY_CONFLICT",
    );
  } finally {
    await cleanupRun(harness);
  }
});

test("forced reconnect restores only validated durable state", async () => {
  const run = await runFixture(await fixture("MEM-RECONNECT-001"), { keepDirectory: true });
  try {
    assert.equal(run.session.revisions.at(-1).reconnect_epoch, 1);
    assert.ok(run.session.events.some((event) => event.event_type === "session.reconnected"));
    const reopened = await FileSessionLedger.open({ path: run.path, clock: deterministicClock() });
    assert.deepEqual(reopened.getLatestRevision(run.sessionId), run.session.revisions.at(-1));
  } finally {
    await cleanupRun(run);
  }
});

test("ledger corruption fails closed", async () => {
  const run = await runFixture(await fixture("ADAPT-SHORT-001"), { keepDirectory: true });
  try {
    const stored = JSON.parse(await readFile(run.path, "utf8"));
    stored.sessions[0].events[0].payload.first_question_id = "question:tampered";
    await writeFile(run.path, `${JSON.stringify(stored)}\n`, { mode: 0o600 });
    await assert.rejects(
      () => FileSessionLedger.open({ path: run.path, clock: deterministicClock() }),
      (error) => ["LEDGER_FILE_HASH", "EVENT_PAYLOAD_HASH_MISMATCH"].includes(error.code),
    );
  } finally {
    await cleanupRun(run);
  }
});

test("malformed substitute model output cannot partially commit a turn", async () => {
  const base = new RuleModelAdapter();
  const model = { descriptor: base.descriptor, analyzeTurn: () => ({ analysis_version: "malformed" }) };
  const harness = await createFixtureHarness(await fixture("ADAPT-SHORT-001"), { components: { model } });
  try {
    await assert.rejects(() => harness.brain.processTurn({
      sessionId: harness.sessionId,
      turnId: "turn:bad-adapter:1",
      text: "Synthetic input.",
      idempotencyKey: "turn:bad-adapter:1",
    }));
    assert.equal(harness.ledger.getSession(harness.sessionId).events.length, 1);
  } finally {
    await cleanupRun(harness);
  }
});
