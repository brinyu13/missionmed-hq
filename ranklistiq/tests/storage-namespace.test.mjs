import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const storage = require("../src/dual-mode/storage-namespace.js");
const html = await readFile(new URL("../app/base/rank_list_engine.LIVE_20260921T132844Z.sanitized.html", import.meta.url), "utf8");

test("rank mode never rewrites a key and application mode scopes only workspace keys", () => {
  for (const key of storage.WORKSPACE_EXACT) {
    assert.equal(storage.namespacedKey(key, "rank"), key);
    assert.equal(storage.namespacedKey(key, "application"), `${key}${storage.APP_SUFFIX}`);
  }
  for (const key of storage.SHARED_EXACT) {
    assert.equal(storage.namespacedKey(key, "rank"), key);
    assert.equal(storage.namespacedKey(key, "application"), key);
  }
});

test("captured source storage-key census has no unclassified literal or KEY constant", () => {
  const keys = new Set();
  const constantPattern = /\b(?:var|let|const)\s+[A-Z0-9_]*KEY[A-Z0-9_]*\s*=\s*["']([^"']+)/g;
  const literalPattern = /localStorage\.(?:getItem|setItem|removeItem)\(\s*["']([^"']+)/g;
  for (const pattern of [constantPattern, literalPattern]) {
    for (const match of html.matchAll(pattern)) keys.add(match[1]);
  }
  const unknown = [...keys].filter((key) => storage.classifyKey(key) === "unclassified");
  assert.deepEqual(unknown, []);
});

