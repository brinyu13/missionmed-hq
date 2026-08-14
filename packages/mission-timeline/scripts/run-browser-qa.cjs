const fs = require("fs");
const path = require("path");
const { chromium } = require("/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const appUrl = process.env.D1_MATRIX_URL || "http://127.0.0.1:8792/matrix/demo/";
const evidence = process.env.D1_412_EVIDENCE || "/Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE/evidence/412";
const shots = path.join(evidence, "screenshots");
fs.mkdirSync(shots, { recursive: true });

const result = {
  generatedAt: new Date().toISOString(),
  appUrl,
  tests: [],
  consoleErrors: [],
  requestFailures: [],
  unexpectedRequests: [],
  screenshots: [],
  performance: {},
};

function record(name, pass, detail = "") {
  result.tests.push({ name, status: pass ? "PASS" : "FAIL", detail });
}

async function run() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }]) {
      const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
      const page = await context.newPage();
      page.on("console", (message) => {
        if (message.type() === "error") result.consoleErrors.push({ viewport, message: message.text() });
      });
      page.on("pageerror", (error) => result.consoleErrors.push({ viewport, message: error.message }));
      page.on("requestfailed", (request) => result.requestFailures.push({ viewport, url: request.url(), error: request.failure()?.errorText }));
      page.on("response", (response) => {
        if (response.status() >= 400) result.requestFailures.push({ viewport, url: response.url(), error: `HTTP_${response.status()}` });
      });
      page.on("request", (request) => {
        const url = request.url();
        if (!url.startsWith("http://127.0.0.1:8792/") && !url.startsWith("data:") && !url.startsWith("blob:")) {
          result.unexpectedRequests.push({ viewport, url });
        }
      });
      const started = performance.now();
      await page.goto(appUrl, { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Open Mission Timeline" }).click();
      await page.waitForFunction(() => window.D1_410_READY === true && window.MMEDTimeline?.mode === "MATRIX_APP_MODE", null, { timeout: 25_000 });
      const startupMs = performance.now() - started;
      result.performance[`${viewport.width}x${viewport.height}`] = { startupMs: +startupMs.toFixed(2) };

      const state = await page.evaluate(() => ({
        mode: window.MMEDTimeline.mode,
        sourceAuthority: window.MMEDTimeline.sourceAuthority,
        usesIframe: document.querySelectorAll("iframe").length,
        blankEvents: window.D1_406A_TEST.state.user.events.length,
        theme: window.D1_406A_TEST.state.canvasTheme,
        adapter: window.D1_409_TEST.context.adapter.kind,
        syncState: window.MMEDTimeline.syncState,
        duplicateIds: [...document.querySelectorAll("[id]")].map((node) => node.id).filter((id, index, all) => all.indexOf(id) !== index),
        unnamedButtons: [...document.querySelectorAll("button")].filter((button) => !(button.innerText || button.getAttribute("aria-label") || button.getAttribute("title"))).length,
      }));
      record(`${viewport.width}x${viewport.height} boots in Matrix App Mode`, state.mode === "MATRIX_APP_MODE", state.mode);
      record(`${viewport.width}x${viewport.height} uses no iframe`, state.usesIframe === 0, String(state.usesIframe));
      record(`${viewport.width}x${viewport.height} preserves D1-410 authority`, state.sourceAuthority === "D1_410_RELEASE_CANDIDATE", state.sourceAuthority);
      record(`${viewport.width}x${viewport.height} preserves blank builder`, state.blankEvents === 0, String(state.blankEvents));
      record(`${viewport.width}x${viewport.height} preserves Keynote theme`, state.theme === "keynote", state.theme);
      record(`${viewport.width}x${viewport.height} injects hybrid persistence`, state.adapter === "HYBRID_INDEXED_DB", state.adapter);
      record(`${viewport.width}x${viewport.height} has unique IDs`, state.duplicateIds.length === 0, state.duplicateIds.join(","));
      record(`${viewport.width}x${viewport.height} has named buttons`, state.unnamedButtons === 0, String(state.unnamedButtons));

      await page.keyboard.press("Home");
      await page.keyboard.press("Tab");
      const focus = await page.evaluate(() => ({ text: document.activeElement?.textContent?.trim(), outline: getComputedStyle(document.activeElement).outlineStyle }));
      record(`${viewport.width}x${viewport.height} return control is keyboard reachable`, focus.text === "RETURN TO MATRIX", `${focus.text}:${focus.outline}`);

      const name = `matrix_app_mode_${viewport.width}x${viewport.height}_412.png`;
      await page.screenshot({ path: path.join(shots, name), fullPage: false });
      result.screenshots.push({ name, viewport, path: path.join(shots, name) });
      await context.close();
    }

    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Open Mission Timeline" }).click();
    await page.waitForFunction(() => window.D1_410_READY === true);
    await page.getByRole("button", { name: "Return to Matrix dashboard" }).click();
    await page.waitForURL(/\/matrix\/demo\/$/);
    record("Return to Matrix performs clean host navigation", await page.getByRole("button", { name: "Open Mission Timeline" }).isVisible(), page.url());
    await context.close();
  } finally {
    await browser.close();
  }

  record("No console errors", result.consoleErrors.length === 0, JSON.stringify(result.consoleErrors));
  record("No request failures", result.requestFailures.length === 0, JSON.stringify(result.requestFailures));
  record("No unexpected network requests", result.unexpectedRequests.length === 0, JSON.stringify(result.unexpectedRequests));
  result.summary = {
    total: result.tests.length,
    passed: result.tests.filter((item) => item.status === "PASS").length,
    failed: result.tests.filter((item) => item.status === "FAIL").length,
  };
  fs.writeFileSync(path.join(evidence, "browser_qa_412.json"), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result.summary)}\n`);
  if (result.summary.failed) process.exitCode = 1;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
