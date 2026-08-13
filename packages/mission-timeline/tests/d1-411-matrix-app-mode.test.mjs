import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("D1-411 Matrix App Mode launches the canonical current web application", async () => {
  const launcher = await readFile(new URL("matrix/timeline-app-mode.js", root), "utf8");
  const demo = await readFile(new URL("matrix/demo/index.html", root), "utf8");
  const adapter = await readFile(new URL("web/js/407f-engineering-adapter.js", root), "utf8");

  assert.match(launcher, /matrixAppMode.*local/);
  assert.match(launcher, /returnUrl/);
  assert.match(launcher, /location\.assign\(route\.target\.href\)/);
  assert.match(launcher, /413\.0\.0-rc\.0/);
  assert.doesNotMatch(launcher, /DOMParser|replaceChildren|js\/app\.js|styles\.css|createElement\(["']iframe/);
  assert.match(demo, /assetBase:"\/web\/"/);

  assert.match(adapter, /parameters\.get\("matrixAppMode"\)!=="local"/);
  assert.match(adapter, /candidate\.origin!==locationObject\.origin/);
  assert.match(adapter, /back\.setAttribute\("aria-label","Return to Matrix dashboard"\)/);
  assert.match(adapter, /mode:"MATRIX_APP_MODE"/);
  assert.match(adapter, /version:"413\.0\.0-rc\.0"/);
});
