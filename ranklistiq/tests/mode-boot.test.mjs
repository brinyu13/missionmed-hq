import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const modeBoot = require("../src/dual-mode/mode-boot.js");

test("mode resolution is query, then storage, then selector", () => {
  assert.deepEqual(modeBoot.resolveMode({ queryMode: "application", storedMode: "rank" }), { mode: "application", source: "query", selectorRequired: false });
  assert.deepEqual(modeBoot.resolveMode({ queryMode: "invalid", storedMode: "rank" }), { mode: "rank", source: "storage", selectorRequired: false });
  assert.deepEqual(modeBoot.resolveMode({}), { mode: "rank", source: "selector", selectorRequired: true });
});

test("reload URL preserves unrelated parameters", () => {
  const next = new URL(modeBoot.urlForMode({ href: "https://example.test/rank-list/?preview=1" }, "application"));
  assert.equal(next.searchParams.get("preview"), "1");
  assert.equal(next.searchParams.get("mode"), "application");
});

