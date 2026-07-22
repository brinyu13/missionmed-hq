import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the local prototype shell and restrictive content policy", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /MissionMed Learning Studio · P4 Prototype/);
  assert.match(html, /Preparing your local prototype/);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /object-src 'none'/);
  assert.doesNotMatch(html, /fonts\.googleapis|googletagmanager|segment\.com/i);
});

test("implements every required learning and analytics surface", async () => {
  const [ui, data] = await Promise.all([
    source("app/LearningStudio.tsx"),
    source("app/studio-data.ts"),
  ]);
  for (const label of [
    "Quick Review",
    "Board Review",
    "Clinical Mastery",
    "Adaptive",
  ]) {
    assert.match(data, new RegExp(label));
  }
  for (const label of [
    "Current session",
    "Lifetime",
    "Mastery proxy",
    "Heatmaps",
    "Trends",
    "Replay usage",
    "Explanation usage",
    "Confidence history",
  ]) {
    assert.match(ui, new RegExp(label));
  }
  assert.match(ui, /Simulated · not validated/);
  assert.match(ui, /simulated 95% confidence interval/);
  assert.match(ui, /synthetic\s+model\s+standard error/);
  assert.match(ui, /Last 8 demo sessions/);
});

test("keeps data, replay, notes, and production boundaries explicit", async () => {
  const [ui, state, data, layout] = await Promise.all([
    source("app/LearningStudio.tsx"),
    source("app/studio-state.ts"),
    source("app/studio-data.ts"),
    source("app/layout.tsx"),
  ]);
  assert.match(data, /missionmed\.learning-studio\.i1q4000\.v1/);
  assert.match(ui, /Simulated replay placeholder/);
  assert.match(ui, /not Zoom data/i);
  assert.match(ui, /Local Question Note/);
  assert.match(ui, /Not deployed · not medically validated/);
  assert.match(layout, /connect-src 'self'/);
  assert.doesNotMatch(
    `${ui}\n${state}`,
    /fetch\s*\(|XMLHttpRequest|WebSocket\s*\(/,
  );
  assert.doesNotMatch(`${ui}\n${state}`, /supabase|RANKLISTIQ|\/api\/drills/i);
});

test("includes deterministic persistence and responsive accessibility contracts", async () => {
  const [state, css] = await Promise.all([
    source("app/studio-state.ts"),
    source("app/globals.css"),
  ]);
  assert.match(state, /function stableStringify/);
  assert.match(state, /payloadChecksum/);
  assert.match(state, /future-schema/);
  assert.match(state, /No synthetic questions match that exact intersection/);
  assert.match(css, /max-width:\s*390px/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /min-height: 44px/);
  assert.match(
    css,
    /\.studio-shell\.in-session \.sidebar\s*\{[\s\S]*?display:\s*none/,
  );
});

test("builds unique exact-intersection queues without silent repetition", async () => {
  const { INITIAL_BUILDER, buildQueue } = await import(
    "../app/studio-state.ts"
  );
  const single = buildQueue(
    {
      ...INITIAL_BUILDER,
      drillIds: ["syn-drill-0718"],
      subjectIds: ["syn-cardio"],
      length: 8,
    },
    [],
  );
  assert.equal(single.error, null);
  assert.equal(single.queue.length, 1);
  assert.equal(new Set(single.queue.map((slot) => slot.questionId)).size, 1);

  const mixed = buildQueue(
    {
      ...INITIAL_BUILDER,
      drillIds: [
        "syn-drill-0718",
        "syn-drill-0716",
        "syn-drill-0712",
        "syn-drill-0708",
      ],
      subjectIds: ["syn-cardio", "syn-micro", "syn-neuro", "syn-endo"],
      length: 8,
    },
    [],
  );
  assert.equal(mixed.queue.length, 8);
  assert.equal(new Set(mixed.queue.map((slot) => slot.questionId)).size, 8);
});

test("keeps drill catalog counts and subject coverage aligned to occurrences", async () => {
  const { DRILLS, QUESTIONS } = await import("../app/studio-data.ts");
  for (const drill of DRILLS) {
    const questions = QUESTIONS.filter((item) => item.drillId === drill.id);
    assert.equal(questions.length, drill.questionCount, drill.id);
    assert.deepEqual(
      [...new Set(questions.map((item) => item.subjectId))].sort(),
      [...drill.subjectIds].sort(),
      drill.id,
    );
  }
});

test("enforces reducer ordering, durable Quick reveal, and a genuinely empty reset", async () => {
  const { INITIAL_BUILDER, INITIAL_STATE, createSession, studioReducer } =
    await import("../app/studio-state.ts");
  const at = "2026-07-22T12:00:00.000Z";
  const built = createSession(
    { ...INITIAL_BUILDER, templateId: "board-review", length: 2 },
    [],
    "test-board",
    at,
  );
  assert.ok(built.session);
  const slotId = built.session.queue[0].slotId;
  let state = { ...INITIAL_STATE, hydrated: true };
  state = studioReducer(state, {
    type: "START_SESSION",
    session: built.session,
  });
  state = studioReducer(state, {
    type: "SELECT_ANSWER",
    slotId,
    selectedIndex: 0,
  });
  state = studioReducer(state, { type: "COMMIT_RESPONSE", slotId, at });
  assert.equal(state.activeSession.responses[slotId]?.committed, false);
  state = studioReducer(state, {
    type: "SET_CONFIDENCE",
    slotId,
    confidence: "high",
  });
  state = studioReducer(state, { type: "COMMIT_RESPONSE", slotId, at });
  assert.equal(state.activeSession.responses[slotId].committed, true);
  state = studioReducer(state, { type: "JUMP_TO", index: 1 });
  assert.equal(state.activeSession.cursor, 0);
  state = studioReducer(state, { type: "ADVANCE", at });
  assert.equal(state.activeSession.cursor, 0);
  state = studioReducer(state, { type: "COMPLETE_SESSION", at });
  assert.equal(state.activeSession.status, "active");
  state = studioReducer(state, { type: "REVEAL_FEEDBACK", slotId, at });
  state = studioReducer(state, { type: "ADVANCE", at });
  assert.equal(state.activeSession.cursor, 1);

  const quick = createSession(
    { ...INITIAL_BUILDER, templateId: "quick-review", length: 1 },
    [],
    "test-quick",
    at,
  ).session;
  assert.ok(quick);
  const quickSlot = quick.queue[0].slotId;
  state = studioReducer(state, { type: "START_SESSION", session: quick });
  state = studioReducer(state, {
    type: "REVEAL_QUICK",
    slotId: quickSlot,
    at,
  });
  assert.equal(state.activeSession.responses[quickSlot].revealed, true);
  state = studioReducer(state, { type: "COMPLETE_SESSION", at });
  assert.equal(state.activeSession.status, "active");
  state = studioReducer(state, {
    type: "SELF_REPORT",
    slotId: quickSlot,
    outcome: "knew",
    at,
  });
  state = studioReducer(state, { type: "COMPLETE_SESSION", at });
  assert.equal(state.activeSession.status, "completed");
  assert.equal(state.savedSessions.length, 1);
  state = studioReducer(state, {
    type: "REMOVE_SAVED_SESSION",
    sessionId: quick.id,
  });
  assert.equal(state.activeSession, null);
  assert.deepEqual(state.savedSessions, []);
  state = studioReducer(state, { type: "RESET_LOCAL_DATA" });
  assert.deepEqual(state.favorites, []);
  assert.deepEqual(state.savedSessions, []);
});

test("applies explicit builder presets and hydrates an active session exactly", async () => {
  const {
    INITIAL_BUILDER,
    INITIAL_STATE,
    createSession,
    parsePersistedEnvelope,
    studioReducer,
    toPersistedEnvelope,
  } = await import("../app/studio-state.ts");
  const at = "2026-07-22T12:00:00.000Z";
  let state = studioReducer(
    { ...INITIAL_STATE, hydrated: true },
    {
      type: "OPEN_BUILDER",
      origin: "direct",
      templateId: "quick-review",
      drillIds: ["syn-drill-0712"],
      subjectIds: ["syn-micro"],
      focus: "all",
    },
  );
  assert.deepEqual(state.builder.drillIds, ["syn-drill-0712"]);
  assert.deepEqual(state.builder.subjectIds, ["syn-micro"]);
  assert.equal(state.builder.focus, "all");

  const active = createSession(
    { ...INITIAL_BUILDER, templateId: "quick-review", length: 1 },
    [],
    "hydrate-active",
    at,
  ).session;
  assert.ok(active);
  const envelope = toPersistedEnvelope(
    {
      builder: INITIAL_BUILDER,
      activeSession: active,
      savedSessions: [],
      favorites: [],
      questionNotes: {},
      founderDecisions: {},
    },
    at,
  );
  const parsed = parsePersistedEnvelope(JSON.stringify(envelope));
  assert.equal(parsed.status, "ok");
  state = studioReducer(INITIAL_STATE, {
    type: "HYDRATE",
    payload: parsed.payload,
  });
  assert.equal(state.view, "session");
  assert.equal(state.activeSession.id, "hydrate-active");
});

test("rejects checksum-valid malformed persisted payloads", async () => {
  const { INITIAL_BUILDER, lightweightChecksum, parsePersistedEnvelope } =
    await import("../app/studio-state.ts");
  const malformed = {
    builder: INITIAL_BUILDER,
    activeSession: null,
    favorites: [],
    questionNotes: {},
    founderDecisions: {},
  };
  const envelope = {
    schema: "missionmed.learning-studio.local",
    schemaVersion: 1,
    catalogDigest: "i1q4000-synthetic-catalog-v1-20260722",
    savedAt: "2026-07-22T12:00:00.000Z",
    payloadChecksum: lightweightChecksum(malformed),
    payload: malformed,
  };
  assert.equal(
    parsePersistedEnvelope(JSON.stringify(envelope)).status,
    "corrupt",
  );
});
