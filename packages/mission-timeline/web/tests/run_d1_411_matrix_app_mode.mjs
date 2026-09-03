import { createRequire } from "node:module";
import { existsSync } from "node:fs";

const require = createRequire(import.meta.url);
const playwrightRuntime = process.env.CODEX_PLAYWRIGHT_RUNTIME ||
  "/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright";
const chromeExecutable = process.env.CHROME_EXECUTABLE ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = process.env.PORT || "8793";
const origin = `http://127.0.0.1:${port}`;
const errors = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function observe(page, label) {
  page.on("pageerror", (error) => errors.push(`${label}:pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`${label}:console:${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    errors.push(`${label}:requestfailed:${request.url()}:${request.failure()?.errorText || "unknown"}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().includes("/api/timeline/")) {
      errors.push(`${label}:response:${response.status()}:${response.url()}`);
    }
  });
}

async function runtimeSnapshot(page) {
  return page.evaluate(() => ({
    url: location.href,
    runtime: window.MMEDTimeline ? {
      version: window.MMEDTimeline.version,
      mode: window.MMEDTimeline.mode,
      sourceAuthority: window.MMEDTimeline.sourceAuthority,
      returnUrl: window.MMEDTimeline.returnUrl,
    } : null,
    hasEngineering: Boolean(window.D1_407F_ENGINEERING),
    hasBridge: Boolean(window.D1_407F_TEST),
    hasUxr: Boolean(window.D1_UXR_002),
    hydrating: document.documentElement.classList.contains("d1-hydrating"),
    appShells: document.querySelectorAll("#app,.app-shell").length,
    activeRoutes: [...document.querySelectorAll("section[data-view].live")].map((node) => node.dataset.view),
    duplicateIds: [...document.querySelectorAll("[id]")]
      .map((node) => node.id)
      .filter((id, index, all) => all.indexOf(id) !== index),
    entitlement: document.querySelector("#entitlement407F")?.dataset.access || "",
    header: document.querySelector("header")?.textContent.replace(/\s+/g, " ").trim() || "",
    rail: [...document.querySelectorAll("#rail [data-v]")].map((node) => `${node.dataset.v}:${node.textContent.trim()}`),
    scripts: [...document.querySelectorAll("script[src]")].map((node) => new URL(node.src).pathname),
    styles: [...document.styleSheets].map((sheet) => {
      try { return sheet.href ? new URL(sheet.href).pathname : "inline"; } catch { return "unreadable"; }
    }),
  }));
}

assert(existsSync(chromeExecutable), `Chrome executable not found: ${chromeExecutable}`);
const { chromium } = require(playwrightRuntime);
const browser = await chromium.launch({ headless: true, executablePath: chromeExecutable });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });

try {
  const matrixPage = await context.newPage();
  observe(matrixPage, "matrix");
  await matrixPage.goto(`${origin}/matrix/demo/`, { waitUntil: "networkidle" });
  await matrixPage.getByRole("button", { name: "Open Mission Timeline" }).click();
  await matrixPage.waitForURL(/\/web\/\?matrixAppMode=local/);
  await matrixPage.waitForFunction(() => Boolean(window.D1_407F_ENGINEERING && window.D1_407F_TEST));
  await matrixPage.waitForSelector('#entitlement407F[data-access="FULL"]');
  const matrix = await runtimeSnapshot(matrixPage);

  assert(matrix.runtime?.version === "413.0.0-rc.0", `wrong runtime version: ${matrix.runtime?.version}`);
  assert(matrix.runtime?.mode === "MATRIX_APP_MODE", `wrong runtime mode: ${matrix.runtime?.mode}`);
  assert(matrix.runtime?.returnUrl === "/matrix/demo/", `wrong return URL: ${matrix.runtime?.returnUrl}`);
  assert(matrix.hasEngineering && matrix.hasBridge, "current 407F runtime did not boot");
  assert(!matrix.hasUxr, "superseded UXR runtime booted");
  assert(!matrix.hydrating, "hydration gate remained active");
  assert(matrix.appShells === 0, `unexpected legacy app shells: ${matrix.appShells}`);
  assert(matrix.activeRoutes.length === 1, `expected one active route: ${matrix.activeRoutes.join(",")}`);
  assert(matrix.duplicateIds.length === 0, `duplicate IDs: ${matrix.duplicateIds.join(",")}`);
  assert(matrix.entitlement === "FULL", `entitlement did not resolve: ${matrix.entitlement}`);

  const directPage = await context.newPage();
  observe(directPage, "direct");
  await directPage.goto(`${origin}/web/`, { waitUntil: "networkidle" });
  await directPage.waitForFunction(() => Boolean(window.D1_407F_ENGINEERING && window.D1_407F_TEST));
  const direct = await runtimeSnapshot(directPage);
  assert(JSON.stringify(matrix.rail) === JSON.stringify(direct.rail), "Matrix/direct navigation differs");
  assert(matrix.header === direct.header, "Matrix/direct header differs");
  assert(JSON.stringify(matrix.activeRoutes) === JSON.stringify(direct.activeRoutes), "Matrix/direct initial route differs");
  assert(JSON.stringify(matrix.scripts) === JSON.stringify(direct.scripts), "Matrix/direct scripts differ");
  assert(JSON.stringify(matrix.styles) === JSON.stringify(direct.styles), "Matrix/direct styles differ");
  await directPage.close();

  await matrixPage.getByRole("link", { name: "Return to Matrix dashboard" }).click();
  await matrixPage.waitForURL(`${origin}/matrix/demo/`);
  assert(await matrixPage.getByRole("button", { name: "Open Mission Timeline" }).isVisible(), "Matrix dashboard did not return");
  assert(errors.length === 0, errors.join("\n"));
  console.log(JSON.stringify({ status: "PASS", matrixUrl: matrix.url, errors }));
} finally {
  await context.close();
  await browser.close();
}
