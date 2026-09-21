import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { buildHtml } from "../tools/build.mjs";

test("zero-module build reproduces the sanitized base byte-for-byte", async () => {
  const result = await buildHtml({ zero: true });
  assert.equal(result.html, await readFile(result.basePath, "utf8"));
});

test("full build has one balanced marker pair per seam and embeds exact config", async () => {
  const result = await buildHtml({ buildId: "unit-test", sourceCommit: "test-sha" });
  for (const seam of ["S1", "S2", "S3", "S4", "S5", "S5_BRIDGE"]) {
    assert.equal((result.html.match(new RegExp(`RLQ_DUAL:${seam} START`, "g")) || []).length, 1);
    assert.equal((result.html.match(new RegExp(`RLQ_DUAL:${seam} END`, "g")) || []).length, 1);
  }
  const configText = await readFile(new URL("../config/eras-signal-rules.2027.v1.json", import.meta.url), "utf8");
  assert.equal(result.configSha256, createHash("sha256").update(configText).digest("hex"));
  assert.ok(result.html.includes(`window.RLQ_SIGNAL_CONFIG = ${JSON.stringify(JSON.parse(configText))};`));
  assert.ok(result.html.includes("window.RLQ_ENGINE = {"));
  assert.ok(result.html.includes('window.__RANKLISTIQ_BUILD__ = {"id":"unit-test"'));
});

