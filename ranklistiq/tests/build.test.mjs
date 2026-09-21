import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { buildHtml, protectedRuntimeWrapper } from "../tools/build.mjs";

test("zero-module build reproduces the sanitized base byte-for-byte", async () => {
  const result = await buildHtml({ zero: true });
  assert.equal(result.html, await readFile(result.basePath, "utf8"));
});

test("sanitized base contains no plaintext developer unlock credential", async () => {
  const result = await buildHtml({ zero: true });
  const forbidden = String.fromCharCode(49, 51, 49, 51, 49, 51);
  assert.equal(result.html.includes(forbidden), false);
  assert.ok(result.html.includes("var ORACLE_DEV_PASSWORD = null;"));
  assert.ok(result.html.includes("var DRIP_DEV_PASSWORD = null;"));
  assert.ok(result.html.includes('if(!ORACLE_DEV_PASSWORD || entered !== ORACLE_DEV_PASSWORD){'));
  assert.ok(result.html.includes('if(!DRIP_DEV_PASSWORD || pass !== DRIP_DEV_PASSWORD){'));
  assert.ok(result.html.includes('if(true){\n          showToast("Dev Mode", "Invalid developer code.");'));
});

test("full build has one balanced marker pair per seam and embeds exact config", async () => {
  const result = await buildHtml({ buildId: "unit-test", sourceCommit: "test-sha" });
  for (const seam of ["S1", "S2", "S3", "S4", "S5", "S5_BRIDGE", "S6", "S7"]) {
    assert.equal((result.html.match(new RegExp(`RLQ_DUAL:${seam} START`, "g")) || []).length, 1);
    assert.equal((result.html.match(new RegExp(`RLQ_DUAL:${seam} END`, "g")) || []).length, 1);
  }
  const configText = await readFile(new URL("../config/eras-signal-rules.2027.v1.json", import.meta.url), "utf8");
  assert.equal(result.configSha256, createHash("sha256").update(configText).digest("hex"));
  assert.ok(result.html.includes(`window.RLQ_SIGNAL_CONFIG = ${JSON.stringify(JSON.parse(configText))};`));
  assert.ok(result.html.includes("window.RLQ_ENGINE = {"));
  assert.ok(result.html.includes('window.__RANKLISTIQ_BUILD__ = {"id":"unit-test"'));
  assert.ok(result.html.includes("window.dataService.saveRankList = async function(rankListPayload)"));
  assert.ok(result.html.includes("return saveRanklistToSupabase(nextPayload);"));
  assert.ok(result.html.indexOf("async function saveRanklistToSupabase") < result.html.indexOf("RLQ_DUAL:S6 START"));
  assert.ok(result.html.indexOf("RLQ_DUAL:S6 END") < result.html.indexOf("function collectFinalizeStatsPayload"));
  assert.ok(result.html.includes('window.RLQ_DUAL.mode === "application"'));
  assert.ok(result.html.includes('skipped:"application-mode"'));
  assert.equal((result.html.match(/flushProgramNotesToUserProgramInterviews\(\{/g) || []).length, 1);
});

test("protected runtime wrapper fails closed outside WordPress and returns exact HTML inside it", () => {
  const html = "<!doctype html><title>QA's exact bytes</title>";
  const wrapper = protectedRuntimeWrapper(html);
  assert.ok(wrapper.includes("if (!defined('ABSPATH'))"));
  assert.ok(wrapper.includes("http_response_code(404)"));
  const encoded = wrapper.match(/base64_decode\('([^']+)'/)[1];
  assert.equal(Buffer.from(encoded, "base64").toString("utf8"), html);
});
