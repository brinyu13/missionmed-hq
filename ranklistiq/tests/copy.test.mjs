import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ui = require("../src/dual-mode/app-mode-ui.js");

test("Application copy is planning-only and directs students to MyERAS", () => {
  const copy = ui.APPLICATION_STRINGS.join(" ");
  assert.match(copy, /Planning only/);
  assert.match(copy, /MyERAS/);
  assert.doesNotMatch(copy, /NRMP/i);
});

