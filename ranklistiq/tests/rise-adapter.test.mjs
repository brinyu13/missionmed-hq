import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const rise = require("../src/dual-mode/rise-adapter.js");
const listFixture = JSON.parse(await readFile(new URL("./fixtures/rise-list.synthetic.json", import.meta.url)));
const identityFixture = JSON.parse(await readFile(new URL("./fixtures/rise-identity.synthetic.json", import.meta.url)));

function response({ ok = true, status = 200, type = "basic", body = {} } = {}) {
  return { ok, status, type, async json() { return body; } };
}

test("bind opaqueredirect proceeds and all RISE API requests are GET", async () => {
  const calls = [];
  const adapter = rise.createAdapter(async (url, options) => {
    calls.push({ url, options });
    if (url.startsWith("/wp-admin/")) return response({ type: "opaqueredirect", status: 0 });
    if (url === rise.constants.LIST_URL) return response({ body: listFixture });
    return response({ body: identityFixture });
  });
  await adapter.bindSession();
  await adapter.listMyPrograms();
  await adapter.resolveIdentity("rise_ps_synthetic_a");
  assert.ok(calls.every((call) => call.options.method === "GET"));
  assert.ok(calls.filter((call) => call.url.startsWith("/api/rise/")).every((call) => call.options.method === "GET"));
});

test("bind denial stops before any RISE API call", async () => {
  for (const status of [403, 503]) {
    const calls = [];
    const adapter = rise.createAdapter(async (url, options) => {
      calls.push({ url, options });
      return response({ ok: false, status, type: "basic" });
    });
    await assert.rejects(adapter.bindSession(), { code: "RISE_UNAVAILABLE" });
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.startsWith("/wp-admin/"));
  }
});

test("401 after bind becomes RISE_UNAVAILABLE and empty lists stay empty", async () => {
  const unavailable = rise.createAdapter(async () => response({ ok: false, status: 401, body: { code: "RISE_SESSION_REQUIRED" } }));
  await assert.rejects(unavailable.listMyPrograms(), { code: "RISE_UNAVAILABLE" });
  const empty = rise.createAdapter(async () => response({ body: { records: [], persistence: "durable" } }));
  assert.deepEqual(await empty.listMyPrograms(), { records: [], persistence: "durable" });
});

test("ordered list is sorted by priority position", async () => {
  const reversed = structuredClone(listFixture);
  reversed.records.reverse();
  const adapter = rise.createAdapter(async () => response({ body: reversed }));
  const result = await adapter.listMyPrograms();
  assert.deepEqual(result.records.map((record) => record.priorityPosition), [1, 2]);
});

test("batch continues after one 404, preserves order, and caps concurrency at four", async () => {
  let active = 0;
  let maxActive = 0;
  const ids = Array.from({ length: 9 }, (_, index) => `rise_ps_synthetic_${index}`);
  const adapter = rise.createAdapter(async (url) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setImmediate(resolve));
    active -= 1;
    if (url.endsWith("_3")) return response({ ok: false, status: 404, body: { code: "PROGRAM_NOT_FOUND" } });
    return response({ body: identityFixture });
  });
  const progress = [];
  const result = await adapter.importBatch(ids, { concurrency: 99, onProgress: (event) => progress.push(event) });
  assert.equal(maxActive, 4);
  assert.deepEqual(result.results.map((item) => item.id), ids);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].code, "PROGRAM_NOT_FOUND");
  assert.equal(progress.length, ids.length);
});

test("mapping follows the bounded RankListIQ payload contract", () => {
  const mapped = rise.mapToProgramPayload(listFixture.records[0], identityFixture, "2026-09-21T00:00:00Z");
  assert.deepEqual(mapped.programPayload, {
    name: "Synthetic Teaching Hospital",
    location: "Example City, EX",
    specialty: "Internal Medicine",
    programType: "categorical",
    supplementalRequired: false,
    supplementalListId: null,
    includeInMain: true,
    visaSupport: "yes",
    inHouseFellowship: "unknown",
    settingType: "unknown",
    tag: "RISE #1"
  });
  assert.equal(mapped.link.programSpecialtyId, "rise_ps_synthetic_a");
  assert.equal(mapped.link.acgmeId, "0000000000");
  assert.equal(mapped.link.riseOrder, 1);
  assert.equal(mapped.link.goldStarred, true);
});

