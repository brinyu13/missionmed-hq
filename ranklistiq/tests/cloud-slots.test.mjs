import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const cloud = require("../src/dual-mode/cloud-slots.js");

function interactive(name) {
  const state = { name, programs: [] };
  if (name === "application") state.application = { decisions: {}, signals: {} };
  return {
    kind: "missionmed_ranklist_interactive_share",
    schemaVersion: 1,
    createdAt: 1,
    snapshot: { state },
    uiPrefs: {},
    currentVersionId: "main"
  };
}

function request(workspace) {
  return { ranklist_snapshot: { snapshot: workspace }, profile_data: {}, program_interviews: [] };
}

const noStorage = { length: 0, key() { return null; } };
const storageApi = { APP_SUFFIX: "::app", rawGet() { return null; } };

test("rank save carries the application slot without changing rank snapshot", () => {
  const previousApp = { schema: 1, season: 2027, savedAt: 1, workspace: interactive("application"), application: { decisions: { p: "apply" } } };
  const loaded = interactive("rank-old");
  loaded.applicationWorkspace = previousApp;
  cloud.onCloudEnvelope(loaded);
  const freshRank = interactive("rank-new");
  const result = cloud.decorateSavePayload(request(freshRank), { mode: "rank", storageApi, storageLike: noStorage, now: 2 });
  assert.equal(result.blocked, false);
  assert.deepEqual(result.payload.ranklist_snapshot.snapshot.snapshot, freshRank.snapshot);
  assert.deepEqual(result.payload.ranklist_snapshot.snapshot.applicationWorkspace, previousApp);
});

test("application save preserves the rank slot deep-equal and adds application workspace", () => {
  const rank = interactive("rank-stable");
  cloud.onCloudEnvelope(rank);
  const app = interactive("application");
  const result = cloud.decorateSavePayload(request(app), { mode: "application", storageApi, storageLike: noStorage, now: 9 });
  assert.equal(result.blocked, false);
  const stored = result.payload.ranklist_snapshot.snapshot;
  const rankWithoutApp = structuredClone(stored);
  delete rankWithoutApp.applicationWorkspace;
  assert.deepEqual(rankWithoutApp, rank);
  assert.deepEqual(stored.applicationWorkspace.workspace, app);
  assert.deepEqual(stored.applicationWorkspace.application, app.snapshot.state.application);
});

test("failed cloud load without a local rank slot blocks only application save", () => {
  cloud.markCloudFailure();
  const appResult = cloud.decorateSavePayload(request(interactive("application")), { mode: "application", storageApi, storageLike: noStorage });
  assert.equal(appResult.blocked, true);
  const rankPayload = request(interactive("rank"));
  const rankResult = cloud.decorateSavePayload(rankPayload, { mode: "rank", storageApi, storageLike: noStorage });
  assert.equal(rankResult.blocked, false);
});

test("hydration selects the mode slot and non-envelope payloads pass through", () => {
  const rank = interactive("rank");
  const app = interactive("application");
  rank.applicationWorkspace = { schema: 1, season: 2027, savedAt: 1, workspace: app, application: app.snapshot.state.application };
  assert.deepEqual(cloud.selectHydrationPayload(rank, "rank"), rank);
  assert.deepEqual(cloud.selectHydrationPayload(rank, "application"), app);
  const unrelated = { profile_data: { marker: true } };
  assert.strictEqual(cloud.decorateSavePayload(unrelated, { mode: "application" }).payload, unrelated);
});
