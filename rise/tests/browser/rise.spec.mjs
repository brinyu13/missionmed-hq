import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";
import axe from "axe-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const screenshotDirectory = path.join(root, "_AI_HANDOFFS/from_codex/P1_RISE_4006_PRODUCTION_COMPLETION/artifacts/screenshots");
const ATLAS_IDENTITY = "Atlas Internal Medicine Program; Internal Medicine; New York, NY; program-specialty ID rise_ps_atlas_im";
const BEACON_IDENTITY = "Beacon Medicine Pediatrics Program; Internal Medicine/Pediatrics; Chicago, IL; program-specialty ID rise_ps_beacon_medpeds";
const DUPLICATE_BEACON_IDENTITY = "Atlas Internal Medicine Program; Internal Medicine/Pediatrics; Chicago, IL; program-specialty ID rise_ps_beacon_medpeds";
const immutableGetCache = new Map();

function monitorPage(page) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

async function waitForRegistry(page) {
  await expect(page.locator("#sidebar-registry")).not.toHaveText("Loading");
}

async function axeViolations(page) {
  await page.evaluate(axe.source);
  return page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"] },
    });
    return result.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      targets: violation.nodes.map((node) => node.target),
    }));
  });
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function expectStaleRouteToStayDiscarded(page, { pattern, hash, staleHeading }) {
  const started = deferred();
  const release = deferred();
  const handler = async (route) => {
    started.resolve();
    await release.promise;
    await route.continue().catch(() => {});
  };
  await page.route(pattern, handler);

  await page.evaluate((nextHash) => { window.location.hash = nextHash; }, hash);
  await started.promise;
  await page.locator('.side-nav [data-route="home"]').click();
  await expect(page.getByRole("heading", { name: "Residency intelligence registry" })).toBeVisible();
  await expect(page.locator("#route-announcer")).toHaveText("Command view loaded");
  await expect(page.locator("#viewport")).toBeFocused();

  release.resolve();
  await page.waitForTimeout(150);
  await expect(page).toHaveURL(/#home$/);
  await expect(page.getByRole("heading", { name: staleHeading, exact: true })).toHaveCount(0);
  await expect(page.locator("#route-announcer")).toHaveText("Command view loaded");
  await expect(page.locator("#viewport")).toBeFocused();
  await page.unroute(pattern, handler);
}

test.beforeAll(async () => {
  await fs.mkdir(screenshotDirectory, { recursive: true });
});

test.beforeEach(async ({ page }) => {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const cacheable = request.method() === "GET" && (
      url.pathname.startsWith("/rise") ||
      url.pathname === "/vendor/lucide.js" ||
      url.pathname.startsWith("/api/rise/v1/")
    );
    if (!cacheable) {
      await route.fallback();
      return;
    }
    const key = `${request.method()} ${url.pathname}${url.search}`;
    const cached = immutableGetCache.get(key);
    if (cached) {
      await route.fulfill(cached);
      return;
    }
    const response = await route.fetch();
    const headers = response.headers();
    delete headers["content-encoding"];
    delete headers["content-length"];
    delete headers["transfer-encoding"];
    const entry = { status: response.status(), headers, body: await response.body() };
    if (response.status() !== 429) immutableGetCache.set(key, entry);
    await route.fulfill(entry);
  });
});

test("command view reports the immutable evidence posture", async ({ page }) => {
  const errors = monitorPage(page);
  await page.goto("/rise/#home");
  await waitForRegistry(page);

  await expect(page.getByRole("heading", { name: "Residency intelligence registry" })).toBeVisible();
  await expect(page.locator(".truth-stat").filter({ hasText: "Unique programs" })).toContainText("4");
  await expect(page.getByText("Hard-match claims").first()).toBeVisible();
  await expect(page.getByText("Unknown is not no.")).toBeVisible();
  await expect(page.getByText("Synthetic interaction fixture; never deployable")).toBeVisible();
  await expect(page.getByText("Included source observations", { exact: true })).toBeVisible();
  await expect(page.getByText("Component-specialty browse projections", { exact: true })).toBeVisible();
  await expect(page.getByText("Active observations", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Combined memberships", { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-route="home"]').first()).toHaveAttribute("aria-current", "page");
  expect(errors).toEqual([]);
});

test("synthetic and current-availability notices persist on every view", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("rise-compare", JSON.stringify(["rise_ps_atlas_im"])));
  await page.goto("/rise/#home");
  await waitForRegistry(page);
  for (const { route, heading } of [
    { route: "home", heading: "Residency intelligence registry" },
    { route: "explorer?specialty=Internal+Medicine&includeCombined=true", heading: "Program Explorer" },
    { route: "profile/rise_ps_atlas_im", heading: "Atlas Internal Medicine Program" },
    { route: "compare", heading: "Program comparison" },
    { route: "actn", heading: "Ecosystem handoffs" },
    { route: "queue", heading: "Operator queue" },
  ]) {
    await page.evaluate((nextRoute) => {
      if (window.location.hash !== `#${nextRoute}`) window.location.hash = nextRoute;
    }, route);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(page.getByText("Synthetic test fixture.", { exact: true })).toBeVisible();
    await expect(page.getByText("Current program availability is not established.", { exact: true })).toBeVisible();
    await expect(page.locator("#viewport .registry-notices")).toHaveCount(1);
  }
});

test("Explorer exposes exact accessible filters and component-specialty projections", async ({ page }) => {
  const errors = monitorPage(page);
  await page.goto("/rise/#explorer?specialty=Internal+Medicine&includeCombined=true");
  await waitForRegistry(page);

  await expect(page.getByLabel("Specialty", { exact: true })).toHaveValue("Internal Medicine");
  await expect(page.getByLabel("Jurisdiction", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Sort Results", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Region", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Program Type", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Visa Listed In Source (Not Current Sponsorship)", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Source-attributed Field Completeness", { exact: true })).toBeVisible();
  await expect(page.locator(".result-meta").getByText("2 program-specialty entries", { exact: true })).toBeVisible();

  await page.getByLabel("Include component-specialty browse projections").uncheck();
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.locator(".result-meta").getByText("1 program-specialty entries", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("synthetic profile preserves evidence and supports keyboard tabs", async ({ page }) => {
  const errors = monitorPage(page);
  await page.goto("/rise/#explorer?q=Atlas&specialty=Internal+Medicine&includeCombined=true");
  await waitForRegistry(page);
  const card = page.locator(".program-card").filter({ hasText: "Atlas Internal Medicine Program" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: `Open profile for ${ATLAS_IDENTITY}` }).click();

  await expect(page.getByRole("heading", { name: "Atlas Internal Medicine Program" })).toBeVisible();
  await page.getByRole("tab", { name: "People" }).click();
  await expect(page.locator(".field-row").filter({ has: page.locator("dt", { hasText: "Program Director" }) }).first()).toContainText("Dr. Test Director");
  const overview = page.getByRole("tab", { name: "Overview" });
  await overview.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Training" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "Evidence" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("SYNTHETIC_TEST", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("profile fields disclose true synthetic assertion class and separate provenance metadata", async ({ page }) => {
  await page.route("**/api/rise/v1/program-specialties/rise_ps_atlas_im", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    Object.assign(body.program.fields["Program Website"], {
      authority: "SYNTHETIC_FIELD_SOURCE",
      sourceLocator: "fixture://atlas/program-website",
      period: { kind: "academic_year", label: "2025-2026 synthetic period" },
      retrievedAt: "2026-07-10",
      surveyReceivedAt: "2026-07-08",
      snapshotId: "rise_snapshot_synthetic_test",
      parserVersion: "synthetic-parser-1",
      contentSha256: "a".repeat(64),
    });
    body.program.evidence.unknownSelectedClaims = 47;
    body.program.evidence.absentSelectedClaims = 38;
    await route.fulfill({ response, json: body });
  });
  await page.goto("/rise/#profile/rise_ps_atlas_im");
  await waitForRegistry(page);

  const websiteRow = page.locator(".field-row").filter({ has: page.getByText("Program Website", { exact: true }) });
  const provenance = websiteRow.locator(".field-provenance");
  await expect(provenance.getByText("Assertion class", { exact: true })).toBeVisible();
  await expect(provenance.getByText("Synthetic fixture", { exact: true })).toBeVisible();
  await expect(provenance.getByText("Survey received", { exact: true })).toBeVisible();
  await expect(provenance.getByText("Source updated", { exact: true })).toBeVisible();
  await expect(provenance.getByText("Retrieved", { exact: true })).toBeVisible();
  await expect(provenance.getByText("Reporting period", { exact: true })).toBeVisible();
  await expect(provenance.getByText("2025-2026 synthetic period", { exact: true })).toBeVisible();
  await expect(provenance.getByText("fixture://atlas/program-website", { exact: true })).toBeVisible();
  await expect(provenance.getByText("rise_snapshot_synthetic_test", { exact: true })).toBeVisible();
  await expect(provenance.getByText("synthetic-parser-1", { exact: true })).toBeVisible();
  await expect(page.getByText("Program-reported", { exact: true })).toHaveCount(0);

  await page.getByRole("tab", { name: "Training" }).click();
  await expect(page.locator(".field-row").filter({ has: page.getByText("Research Track", { exact: true }) })).toContainText("Synthetic fixture reports No");
  await page.getByRole("tab", { name: "Application" }).click();
  await expect(page.locator(".field-row").filter({ has: page.getByText(/J-1 listed by source/) })).toContainText("Synthetic fixture reports Yes");
  await expect(page.getByText("F-1 OPT employment authorization listed by source (not visa sponsorship)", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "People" }).click();
  await expect(page.getByText("Graduates of medical schools outside the U.S. (cohort and reporting period unavailable)", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Evidence" }).click();
  const unknownText = await page.locator(".status-row").filter({ hasText: "Unknown selected claims" }).locator("strong").textContent();
  const absentText = await page.locator(".status-row").filter({ hasText: "Absent selected fields" }).locator("strong").textContent();
  expect(Number(unknownText.replaceAll(",", ""))).toBe(47);
  expect(Number(absentText.replaceAll(",", ""))).toBe(38);
});

test("Compare includes claim-level provenance and 44px remove targets", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("rise-compare", JSON.stringify(["rise_ps_atlas_im"])));
  await page.goto("/rise/#compare");
  await waitForRegistry(page);

  const salaryRow = page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "Salary PGY1" }) });
  await expect(salaryRow.getByText("Assertion class", { exact: true })).toBeVisible();
  await expect(salaryRow.getByText("Synthetic fixture", { exact: true })).toBeVisible();
  await expect(salaryRow.getByText("Source updated", { exact: true })).toBeVisible();
  await expect(salaryRow.getByText("Retrieved", { exact: true })).toBeVisible();
  await expect(salaryRow.getByText("Reporting period", { exact: true })).toBeVisible();

  const remove = page.getByRole("button", { name: `Remove ${ATLAS_IDENTITY} from comparison` });
  const box = await remove.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
});

test("comparison uses native actions without nested interactive controls", async ({ page }) => {
  await page.goto("/rise/#explorer?q=Atlas&specialty=Internal+Medicine&includeCombined=true");
  await waitForRegistry(page);
  const card = page.locator(".program-card").filter({ hasText: "Atlas Internal Medicine Program" });
  await card.getByRole("button", { name: `Add ${ATLAS_IDENTITY} to comparison` }).click();
  await page.getByRole("button", { name: "Open program comparison" }).click();
  await expect(page.getByRole("heading", { name: "Program comparison" })).toBeVisible();
  await expect(page.locator(".compare-program-name")).toContainText("Atlas Internal Medicine Program");
  expect(await page.locator("a a, a button, button a, button button").count()).toBe(0);
  expect(await page.evaluate(() => {
    const ids = [...document.querySelectorAll("[id]")].map((node) => node.id);
    return ids.length - new Set(ids).size;
  })).toBe(0);
});

test("compare remove and clear preserve logical keyboard focus", async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("rise-compare", JSON.stringify(["rise_ps_atlas_im", "rise_ps_beacon_medpeds"]));
  });
  await page.goto("/rise/#compare");
  await waitForRegistry(page);

  await page.getByRole("button", { name: `Remove ${ATLAS_IDENTITY} from comparison` }).click();
  const beaconRemove = page.getByRole("button", { name: `Remove ${BEACON_IDENTITY} from comparison` });
  await expect(beaconRemove).toBeFocused();

  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.getByRole("button", { name: "Open Explorer" })).toBeFocused();
});

test("profile compare toggle restores focus to its replacement control", async ({ page }) => {
  await page.goto("/rise/#profile/rise_ps_atlas_im");
  await waitForRegistry(page);
  const add = page.getByRole("button", { name: `Add ${ATLAS_IDENTITY} to comparison` });
  await add.click();
  await expect(page.getByRole("button", { name: `Remove ${ATLAS_IDENTITY} from comparison` })).toBeFocused();
});

test("dialogs trap focus, close with Escape, and restore focus", async ({ page }) => {
  await page.goto("/rise/#home");
  await waitForRegistry(page);
  const trigger = page.getByRole("button", { name: "Search RISE" });
  await trigger.focus();
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "Search RISE" })).toBeVisible();
  await expect(page.locator("#app")).toHaveJSProperty("inert", true);
  await expect(page.locator("#command-search")).toBeFocused();

  const close = page.getByRole("button", { name: "Close dialog" });
  await close.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("#command-results button").last()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.locator("#app")).toHaveJSProperty("inert", false);
  await expect(trigger).toBeFocused();
});

test("integration controls disclose disabled state without writing", async ({ page }) => {
  await page.goto("/rise/#actn");
  await waitForRegistry(page);
  await page.locator('[data-integration="actn"]').click();
  await expect(page.getByRole("dialog", { name: "Integration disabled" })).toBeVisible();
  await expect(page.getByText("INTEGRATION_DISABLED", { exact: true })).toBeVisible();
  await expect(page.getByText("Write performed")).toBeVisible();
  await expect(page.getByText("No", { exact: true })).toBeVisible();
});

test("slow program responses expose a loading state and recover", async ({ page }) => {
  await page.route("**/api/rise/v1/programs**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 650));
    await route.continue();
  });
  await page.goto("/rise/#explorer?specialty=Neurology&includeCombined=true");
  await expect(page.locator("#explorer-results .loading-state")).toBeVisible();
  await expect(page.locator(".program-card").first()).toBeVisible();
  await expect(page.locator("#explorer-results .loading-state")).toBeHidden();
});

test("stale async Explorer, Profile, Compare, and Queue responses cannot overwrite a newer route", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("rise-compare", JSON.stringify(["rise_ps_atlas_im"])));
  await page.goto("/rise/#home");
  await waitForRegistry(page);
  for (const scenario of [
    {
      pattern: "**/api/rise/v1/programs?**",
      hash: "#explorer?specialty=Internal+Medicine&includeCombined=true",
      staleHeading: "Program Explorer",
    },
    {
      pattern: "**/api/rise/v1/program-specialties/rise_ps_atlas_im",
      hash: "#profile/rise_ps_atlas_im",
      staleHeading: "Atlas Internal Medicine Program",
    },
    {
      pattern: "**/api/rise/v1/program-specialties/rise_ps_atlas_im",
      hash: "#compare",
      staleHeading: "Program comparison",
    },
    {
      pattern: "**/api/rise/v1/operator/queue",
      hash: "#queue",
      staleHeading: "Operator queue",
    },
  ]) {
    await expectStaleRouteToStayDiscarded(page, scenario);
  }
});

test("profile deep links preserve browser back and forward navigation", async ({ page }) => {
  await page.goto("/rise/#explorer?q=Atlas&specialty=Internal+Medicine&includeCombined=true");
  const card = page.locator(".program-card").filter({ hasText: "Atlas Internal Medicine Program" });
  await card.getByRole("button", { name: `Open profile for ${ATLAS_IDENTITY}` }).click();
  await expect(page).toHaveURL(/#profile\//);
  await page.goBack();
  await expect(page).toHaveURL(/#explorer\?/);
  await expect(card).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Atlas Internal Medicine Program" })).toBeVisible();
});

test("skip link focuses main content without becoming an SPA route", async ({ page }) => {
  await page.goto("/rise/#home");
  await waitForRegistry(page);
  const skip = page.locator("#skip-link");
  await skip.focus();
  await skip.click();
  await expect(page.locator("#viewport")).toBeFocused();
  await expect(page).toHaveURL(/#home$/);
});

test("route changes reset scroll and move focus to the rendered main view", async ({ page }) => {
  await page.goto("/rise/#explorer?specialty=Internal+Medicine&includeCombined=true");
  await waitForRegistry(page);
  await page.locator("#viewport").evaluate((element) => { element.scrollTop = 500; });
  await page.locator('.side-nav [data-route="home"]').click();
  await expect(page).toHaveURL(/#home$/);
  await expect(page.locator("#viewport")).toBeFocused();
  expect(await page.locator("#viewport").evaluate((element) => element.scrollTop)).toBe(0);
  await expect(page.locator("#route-announcer")).toHaveText("Command view loaded");
});

test("duplicate program names still expose globally unique program action names", async ({ page }) => {
  await page.route("**/api/rise/v1/programs?**", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (body.records?.[1]) body.records[1].display.programName = body.records[0].display.programName;
    await route.fulfill({ response, json: body });
  });
  await page.goto("/rise/#explorer?specialty=Internal+Medicine&includeCombined=true");
  await waitForRegistry(page);
  const allLabels = await page.evaluate(() => [...document.querySelectorAll(".program-actions button")].map((button) => button.getAttribute("aria-label")));
  expect(allLabels.every(Boolean)).toBe(true);
  expect(allLabels).toContain(`Open profile for ${ATLAS_IDENTITY}`);
  expect(allLabels).toContain(`Open profile for ${DUPLICATE_BEACON_IDENTITY}`);
  expect(allLabels.every((label) => label.includes("program-specialty ID rise_ps_"))).toBe(true);
  expect(new Set(allLabels).size).toBe(allLabels.length);
});

test("mobile Explorer keeps secondary filters behind an accessible disclosure", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/rise/#explorer?specialty=Internal+Medicine&includeCombined=true");
  await waitForRegistry(page);
  const toggle = page.getByRole("button", { name: "More filters" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByLabel("Region", { exact: true })).toBeHidden();
  await toggle.click();
  await expect(page.getByRole("button", { name: "Hide filters" })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByLabel("Region", { exact: true })).toBeVisible();
});

test("repeated dialog cycles leave no inert or focus residue", async ({ page }) => {
  await page.goto("/rise/#home");
  await waitForRegistry(page);
  const trigger = page.getByRole("button", { name: "Search RISE" });
  for (let cycle = 0; cycle < 20; cycle += 1) {
    await trigger.click();
    await expect(page.getByRole("dialog", { name: "Search RISE" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  }
  await expect(page.locator("#app")).toHaveJSProperty("inert", false);
  await expect(trigger).toBeFocused();
  expect(await page.locator("#command-search").count()).toBe(0);
});

test("XSS-shaped and Unicode searches remain inert", async ({ page }) => {
  const errors = monitorPage(page);
  await page.goto("/rise/#explorer");
  const payload = '<img src=x onerror="window.__riseXss=true"> 🏥';
  await page.getByLabel("Search Programs").fill(payload);
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByRole("heading", { name: "No programs found" })).toBeVisible();
  expect(await page.evaluate(() => window.__riseXss)).toBeUndefined();
  expect(errors).toEqual([]);
});

test("desktop and mobile views have no serious accessibility violations", async ({ page }) => {
  await page.goto("/rise/#home");
  await waitForRegistry(page);
  expect(await axeViolations(page)).toEqual([]);

  await page.goto("/rise/#profile/rise_ps_atlas_im");
  await expect(page.getByRole("heading", { name: "Atlas Internal Medicine Program" })).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);

  await page.goto("/rise/#explorer?q=Atlas&specialty=Internal+Medicine&includeCombined=true");
  await page.getByRole("button", { name: `Add ${ATLAS_IDENTITY} to comparison` }).click();
  await page.getByRole("button", { name: "Open program comparison" }).click();
  await expect(page.getByRole("heading", { name: "Program comparison" })).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/rise/#explorer?specialty=Pediatrics&includeCombined=true");
  await expect(page.locator(".program-card").first()).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
]) {
  test(`responsive Explorer QA at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const errors = monitorPage(page);
    await page.setViewportSize(viewport);
    await page.goto("/rise/#explorer?specialty=Internal+Medicine&includeCombined=true");
    await expect(page.locator(".program-card").first()).toBeVisible();

    const metrics = await page.evaluate(() => {
      const topbar = document.querySelector(".topbar").getBoundingClientRect();
      const bottomNav = document.querySelector(".bottom-nav");
      const sidebar = document.querySelector(".sidebar");
      const visible = (node) => getComputedStyle(node).display !== "none";
      const controls = [...document.querySelectorAll(".topbar button, .program-actions button, .filter-actions button, input:not([type=checkbox]), select, .check-field")]
        .filter((node) => node.getClientRects().length)
        .map((node) => ({
          name: node.getAttribute("aria-label") || node.textContent.trim(),
          height: node.getBoundingClientRect().height,
          overflow: node.scrollWidth - node.clientWidth,
          iconOnly: node.classList.contains("icon-button"),
        }));
      return {
        globalOverflow: document.documentElement.scrollWidth - window.innerWidth,
        topbarHeight: topbar.height,
        bottomVisible: visible(bottomNav),
        sidebarVisible: visible(sidebar),
        bottomEdge: visible(bottomNav) ? Math.abs(bottomNav.getBoundingClientRect().bottom - window.innerHeight) : 0,
        viewportPaddingBottom: Number.parseFloat(getComputedStyle(document.querySelector("#viewport")).paddingBottom),
        controls,
        nestedInteractive: document.querySelectorAll("a a, a button, button a, button button").length,
      };
    });

    expect(metrics.globalOverflow).toBeLessThanOrEqual(1);
    expect(metrics.nestedInteractive).toBe(0);
    expect(metrics.controls.filter((control) => control.height < 43.5)).toEqual([]);
    expect(metrics.controls.filter((control) => !control.iconOnly && control.overflow > 1)).toEqual([]);
    if (viewport.width <= 700) {
      expect(metrics.topbarHeight).toBe(56);
      expect(metrics.bottomVisible).toBe(true);
      expect(metrics.sidebarVisible).toBe(false);
      expect(metrics.bottomEdge).toBeLessThanOrEqual(1);
      expect(metrics.viewportPaddingBottom).toBeGreaterThanOrEqual(80);
    } else {
      expect(metrics.bottomVisible).toBe(false);
      expect(metrics.sidebarVisible).toBe(true);
    }
    expect(errors).toEqual([]);

    await page.screenshot({
      path: path.join(screenshotDirectory, `rise-explorer-${viewport.width}x${viewport.height}.png`),
      fullPage: false,
      animations: "disabled",
    });
  });
}
