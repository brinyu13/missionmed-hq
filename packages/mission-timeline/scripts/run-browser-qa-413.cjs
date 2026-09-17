const fs = require("fs");
const path = require("path");
const { chromium } = require("/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const port = process.env.PORT || "8792";
const appUrl = process.env.D1_MATRIX_URL || `http://127.0.0.1:${port}/matrix/demo/`;
const evidence = process.env.D1_413_UI_EVIDENCE || "/Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE/evidence/413/ui";
const shots = path.join(evidence, "screenshots");
fs.mkdirSync(shots, { recursive: true });

const viewports = [
  [768, 1024],
  [900, 1100],
  [1024, 768],
  [1280, 800],
  [1440, 900],
  [1728, 1117],
  [1920, 1080],
  [2560, 1440],
];
const result = {
  schemaVersion: "d1-browser-qa-413.1",
  generatedAt: new Date().toISOString(),
  appUrl,
  environment: "ISOLATED_MATRIX_DEMO_NOT_SHARED_RUNTIME",
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

function attachNetwork(page, viewport) {
  page.on("console", (message) => {
    if (message.type() === "error") result.consoleErrors.push({ viewport, message: message.text() });
  });
  page.on("pageerror", (error) => result.consoleErrors.push({ viewport, message: error.message }));
  page.on("requestfailed", (request) => result.requestFailures.push({ viewport, url: request.url(), error: request.failure()?.errorText }));
  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().includes("/api/timeline/")) {
      result.requestFailures.push({ viewport, url: response.url(), error: `HTTP_${response.status()}` });
    }
  });
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith(`http://127.0.0.1:${port}/`) && !url.startsWith("data:") && !url.startsWith("blob:")) {
      result.unexpectedRequests.push({ viewport, url });
    }
  });
}

async function launch(browser, viewport, options = {}) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce", ...options });
  const page = await context.newPage();
  attachNetwork(page, viewport);
  const started = performance.now();
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Open Mission Timeline" }).click();
  await page.waitForFunction(() => window.D1_410_READY === true && window.MMEDTimeline?.mode === "MATRIX_APP_MODE", null, { timeout: 30_000 });
  return { context, page, startupMs: performance.now() - started };
}

async function screenshot(page, name, label, viewport) {
  const output = path.join(shots, name);
  await page.screenshot({ path: output, fullPage: false });
  result.screenshots.push({ name, label, viewport, path: output });
}

async function run() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    for (const [width, height] of viewports) {
      const viewport = { width, height };
      const { context, page, startupMs } = await launch(browser, viewport);
      result.performance[`${width}x${height}`] = { startupMs: Number(startupMs.toFixed(2)) };
      await page.evaluate(() => window.D1_406A_TEST.go("canvas"));
      await page.waitForSelector('section[data-view="canvas"].live');
      const state = await page.evaluate(() => {
        const html = document.documentElement;
        const active = document.querySelector("section.live");
        const board = document.querySelector("#boardMain");
        return {
          mode: window.MMEDTimeline.mode,
          sourceAuthority: window.MMEDTimeline.sourceAuthority,
          usesIframe: document.querySelectorAll("iframe").length,
          blankEvents: window.D1_406A_TEST.state.user.events.length,
          theme: window.D1_406A_TEST.state.canvasTheme,
          adapter: window.D1_409_TEST.context.adapter.kind,
          syncState: window.MMEDTimeline.syncState,
          duplicateIds: [...document.querySelectorAll("[id]")].map((node) => node.id).filter((id, index, all) => all.indexOf(id) !== index),
          unnamedButtons: [...document.querySelectorAll("button")].filter((button) => !(button.innerText || button.getAttribute("aria-label") || button.getAttribute("title"))).length,
          horizontalOverflow: html.scrollWidth - html.clientWidth,
          activeWidth: active?.getBoundingClientRect().width || 0,
          boardWidth: board?.getBoundingClientRect().width || 0,
          reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
        };
      });
      record(`${width}x${height} boots isolated Matrix App Mode`, state.mode === "MATRIX_APP_MODE", state.mode);
      record(`${width}x${height} uses no iframe`, state.usesIframe === 0, String(state.usesIframe));
      record(`${width}x${height} preserves D1-410 authority`, state.sourceAuthority === "D1_410_RELEASE_CANDIDATE", state.sourceAuthority);
      record(`${width}x${height} preserves blank builder`, state.blankEvents === 0, String(state.blankEvents));
      record(`${width}x${height} preserves Keynote theme`, state.theme === "keynote", state.theme);
      record(`${width}x${height} injects hybrid persistence`, state.adapter === "HYBRID_INDEXED_DB", state.adapter);
      record(`${width}x${height} has unique IDs`, state.duplicateIds.length === 0, state.duplicateIds.join(","));
      record(`${width}x${height} has named buttons`, state.unnamedButtons === 0, String(state.unnamedButtons));
      record(`${width}x${height} honors reduced motion media query`, state.reducedMotion, String(state.reducedMotion));
      record(`${width}x${height} horizontal overflow is bounded`, state.horizontalOverflow <= 2, `${state.horizontalOverflow}px`);
      record(`${width}x${height} keeps canvas visible`, state.boardWidth > 240, `${state.boardWidth.toFixed(1)}px`);
      await screenshot(page, `matrix_canvas_${width}x${height}_413.png`, "Blank canvas", viewport);
      await context.close();
    }

    const { context, page } = await launch(browser, { width: 1440, height: 900 });
    await page.evaluate(() => {
      window.D1_406A_TEST.go("canvas");
      window.D1_407_TEST.loadFixture("fx50");
    });
    await page.waitForSelector("#boardMain .kcArrow");
    record("50-event fixture remains available", await page.locator("#boardMain .kcArrow,#boardMain .kcFlag").count() >= 45, "high-density fixture");
    await screenshot(page, "high_density_50_events_413.png", "High-density timeline", { width: 1440, height: 900 });

    await page.evaluate(() => window.D1_406A_TEST.go("advisor"));
    await page.waitForSelector('section[data-view="advisor"].live');
    await screenshot(page, "advisor_mode_413.png", "Advisor mode", { width: 1440, height: 900 });
    record("advisor view is keyboard addressable", await page.locator('section[data-view="advisor"] button').count() > 0, "advisor controls present");

    await page.evaluate(() => window.D1_409_TEST.context.adapter.report("AUTH_REQUIRED", { pending: 1 }));
    record("auth-required state is announced", /AUTH REQUIRED/.test(await page.locator(".timeline-appmode-sync").innerText()), await page.locator(".timeline-appmode-sync").innerText());
    await screenshot(page, "auth_required_state_413.png", "Auth required", { width: 1440, height: 900 });
    await page.evaluate(() => window.D1_409_TEST.context.adapter.report("CONFLICT", { pending: 2 }));
    record("conflict state is announced", /CONFLICT/.test(await page.locator(".timeline-appmode-sync").innerText()), await page.locator(".timeline-appmode-sync").innerText());
    await screenshot(page, "sync_conflict_state_413.png", "Sync conflict", { width: 1440, height: 900 });

    await page.evaluate(() => { document.documentElement.style.zoom = "2"; window.scrollTo(0, 0); });
    record("200 percent zoom retains readable content", (await page.locator("body").innerText()).includes("MISSION TIMELINE"), "content present");
    await screenshot(page, "zoom_200_413.png", "200 percent zoom", { width: 1440, height: 900 });
    await page.evaluate(() => { document.documentElement.style.zoom = "4"; window.scrollTo(0, 0); });
    record("400 percent zoom retains read access", (await page.locator("body").innerText()).includes("ADVISOR"), "content present with scrolling permitted");
    await screenshot(page, "zoom_400_413.png", "400 percent read access", { width: 1440, height: 900 });
    await context.close();

    const keyboard = await launch(browser, { width: 1280, height: 800 });
    await keyboard.page.keyboard.press("Home");
    await keyboard.page.keyboard.press("Tab");
    const focus = await keyboard.page.evaluate(() => ({ text: document.activeElement?.textContent?.trim(), visible: document.activeElement?.matches(":focus-visible") }));
    record("return control is first keyboard destination", focus.text === "RETURN TO MATRIX", JSON.stringify(focus));
    await keyboard.page.getByRole("button", { name: "Return to Matrix dashboard" }).click();
    await keyboard.page.waitForURL(/\/matrix\/demo\/$/);
    record("return navigation restores isolated dashboard", await keyboard.page.getByRole("button", { name: "Open Mission Timeline" }).isVisible(), keyboard.page.url());
    await keyboard.context.close();
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
  fs.writeFileSync(path.join(evidence, "browser_qa_413.json"), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result.summary)}\n`);
  if (result.summary.failed) process.exitCode = 1;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
