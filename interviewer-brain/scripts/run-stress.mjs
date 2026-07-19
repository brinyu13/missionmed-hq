import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { FileSessionLedger, sealContent } from "../src/index.mjs";
import { cleanupRun, createFixtureHarness, readDevelopmentFixtures } from "../tests/helpers/harness.mjs";

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function nextRevision(previous, eventSequence) {
  return sealContent({
    ...previous,
    revision: previous.revision + 1,
    last_event_sequence: eventSequence,
    previous_revision_hash: previous.content_hash,
    reconnect_epoch: previous.reconnect_epoch + 1,
    status: "RECOVERING",
  });
}

async function commitSynthetic(ledger, sessionId, index, expectedRevision = null) {
  const previous = ledger.getLatestRevision(sessionId);
  return ledger.commit({
    sessionId,
    expectedRevision: expectedRevision ?? previous.revision,
    eventType: "session.reconnected",
    actor: { type: "system", id: "system:stress" },
    payload: { synthetic_stress_event: index, simulated: true },
    idempotencyKey: `stress:event:${index}`,
    correlationId: `correlation:${sessionId}`,
    ledgerState: nextRevision(previous, previous.last_event_sequence + 1),
  });
}

const output = resolve(option("--output", "../Y2-3100-3101-3102/evidence/Y2_3101_STRESS_RESULTS.json"));
const eventTarget = Number(option("--events", "1000"));
if (!Number.isSafeInteger(eventTarget) || eventTarget < 100 || eventTarget > 2000) throw new Error("--events must be 100..2000");
const corpus = await readDevelopmentFixtures();
const deterministicRows = [];
for (const fixture of corpus.cases) {
  const harness = await createFixtureHarness(fixture);
  try {
    const previous = harness.ledger.getLatestRevision(harness.sessionId);
    const turn = fixture.turns[0];
    const analysis = harness.brain.model.analyzeTurn({ turnId: `turn:${fixture.id.toLowerCase()}:stress`, text: turn.answer, priorClaims: previous.claims });
    const baseline = JSON.stringify(harness.brain.policy.decide({ sessionId: harness.sessionId, turnId: `turn:${fixture.id.toLowerCase()}:stress`, persona: harness.persona, plan: harness.plan, ledger: previous, analysis }));
    let identical = true;
    for (let index = 0; index < 100; index += 1) {
      const repeatedAnalysis = harness.brain.model.analyzeTurn({ turnId: `turn:${fixture.id.toLowerCase()}:stress`, text: turn.answer, priorClaims: previous.claims });
      const repeated = harness.brain.policy.decide({ sessionId: harness.sessionId, turnId: `turn:${fixture.id.toLowerCase()}:stress`, persona: harness.persona, plan: harness.plan, ledger: previous, analysis: repeatedAnalysis });
      if (JSON.stringify(repeated) !== baseline) identical = false;
    }
    deterministicRows.push({ fixture_id: fixture.id, iterations: 100, identical });
  } finally {
    await cleanupRun(harness);
  }
}

const stressFixture = corpus.cases.find((fixture) => fixture.id === "ADAPT-SHORT-001");
const longRun = await createFixtureHarness(stressFixture);
let longSession;
try {
  for (let index = 2; index <= eventTarget; index += 1) await commitSynthetic(longRun.ledger, longRun.sessionId, index);
  const reopened = await FileSessionLedger.open({ path: longRun.path, clock: longRun.clock });
  longSession = reopened.getSession(longRun.sessionId);
} finally {
  await cleanupRun(longRun);
}

const concurrent = await createFixtureHarness(stressFixture);
let staleWriterDenied = false;
let staleWriterRolledBack = false;
try {
  const writerA = await FileSessionLedger.open({ path: concurrent.path, clock: concurrent.clock });
  const writerB = await FileSessionLedger.open({ path: concurrent.path, clock: concurrent.clock });
  await commitSynthetic(writerA, concurrent.sessionId, 2);
  try { await commitSynthetic(writerB, concurrent.sessionId, 3); }
  catch (error) { staleWriterDenied = error.code === "LEDGER_STALE_WRITER"; }
  staleWriterRolledBack = writerB.getSession(concurrent.sessionId).events.length === 1;
} finally {
  await cleanupRun(concurrent);
}

const report = {
  contract_version: "missionmed.y2.brain-stress.v1",
  deterministic_fixture_count: deterministicRows.length,
  deterministic_iterations_per_fixture: 100,
  deterministic_rows: deterministicRows,
  long_session_target_events: eventTarget,
  long_session_actual_events: longSession.events.length,
  long_session_revision_count: longSession.revisions.length,
  stale_writer_denied: staleWriterDenied,
  stale_writer_rollback_verified: staleWriterRolledBack,
};
report.pass = deterministicRows.every((row) => row.identical) && longSession.events.length === eventTarget && longSession.revisions.length === eventTarget && staleWriterDenied && staleWriterRolledBack;
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ output, deterministic_fixture_count: report.deterministic_fixture_count, iterations_per_fixture: 100, long_session_events: report.long_session_actual_events, stale_writer_denied: report.stale_writer_denied, pass: report.pass }));
if (!report.pass) process.exitCode = 1;
