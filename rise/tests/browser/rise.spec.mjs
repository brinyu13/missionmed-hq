import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";
import axe from "axe-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const artifactDirectory = path.resolve(
  here,
  "../../../_AI_HANDOFFS/from_codex/P1_RISE_5007_PRIVATE_BETA_FULL_REGISTRY_STUDENT_INTEL/artifacts/browser",
);

async function openRise(page, hash = "home") {
  await page.goto(`/rise/#/${hash}`);
  await expect(page.locator("body")).not.toHaveClass(/is-booting/);
  await expect(page.locator("#main")).toBeVisible();
}

async function expectNoCriticalA11yViolations(page) {
  await page.evaluate(axe.source);
  const result = await page.evaluate(() => window.axe.run(document, {
    rules: { "color-contrast": { enabled: false } },
  }));
  const critical = result.violations.filter((violation) => violation.impact === "critical");
  expect(critical).toEqual([]);
}

test.beforeAll(async () => {
  await fs.mkdir(artifactDirectory, { recursive: true });
});

test("private-beta notice is explicit, persistent, and acknowledged server-side", async ({ page }) => {
  await openRise(page);
  await expect(page.locator("#modal")).toContainText("RISE private beta");
  await expect(page.locator("#modal")).toContainText("Missing means unknown—not no");
  await page.getByRole("button", { name: "I understand" }).click();
  await expect(page.locator("#modal")).not.toHaveClass(/open/);
  await expect(page.locator(".founderChip")).toContainText("BETA · VERIFY WITH PROGRAM");
  await page.reload();
  await expect(page.locator("#modal")).not.toHaveClass(/open/);
});

test("home preserves the approved consumer shell, hierarchy, and four feature doors", async ({ page }) => {
  await openRise(page);
  await expect(page).toHaveTitle("RISE · MissionMed Intelligence");
  await expect(page.locator("#rail .rtab")).toHaveText([
    "Home", "Find Programs", "My Programs", "Rank List", "My Profile",
  ]);
  await expect(page.getByText("Tell me about", { exact: true })).toBeVisible();
  await expect(page.locator(".door")).toHaveCount(4);
  await expect(page.locator(".door .dTitle")).toHaveText([
    "SOAP 2026 Openings", "Alumni Connections", "Letter of Interest", "Match Bridge",
  ]);
  await expect(page.getByText("Integration unavailable", { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Ignacio");
  await expect(page.locator("body")).not.toContainText("Brookdale");
  await page.screenshot({ path: path.join(artifactDirectory, "home-desktop.png"), fullPage: true });
});

test("list-first Find Programs loads canonical identities and toggles to grid", async ({ page }) => {
  await openRise(page, "find");
  await expect(page.locator('[data-view="find"]')).toBeVisible();
  await expect(page.locator(".pRow")).toHaveCount(4);
  await expect(page.locator(".pCard")).toHaveCount(0);
  await expect(page.getByText("Needs more verified data — fit is not forced").first()).toBeVisible();
  await page.getByRole("button", { name: "▦ Grid", exact: true }).click();
  await expect(page.locator(".pCard")).toHaveCount(4);
  await page.getByRole("button", { name: "☰ List", exact: true }).click();
  await expect(page.locator(".pRow")).toHaveCount(4);
});

test("global program lookup and state filters preserve unknown-first program results", async ({ page }) => {
  await openRise(page, "find");
  await page.locator("#omni").fill("Atlas");
  await expect(page.locator("#omniAC")).toContainText("Atlas Internal Medicine Program");
  await page.locator("#omni").fill("");
  await page.locator("select[aria-label='State']").selectOption("CA");
  await expect(page.locator(".pRow")).toHaveCount(1);
  await expect(page.locator(".pRow")).toContainText("Delta Pediatrics Program");
});

test("Program File remains a routed immersive overlay with exactly six primary tabs", async ({ page }) => {
  await openRise(page, "find");
  await page.locator(".pRow .rowBtn.pri").first().click();
  await expect(page).toHaveURL(/#\/program\/rise_ps_atlas_im\/overview$/);
  await expect(page.locator("#file")).toHaveClass(/open/);
  await expect(page.locator(".tabStrip button")).toHaveText([
    "Overview", "Fit", "Residents", "People", "Fellowships & Outcomes", "Details",
  ]);
  await expect(page.locator("#file")).toContainText("synthetic-atlas_im");
  await expect(page.locator("#file")).not.toContainText("demo");
  await expect(page.locator("#file")).toContainText("Student Intel");
  await expect(page.locator("#file .coverageBadge")).toContainText("BASIC PROFILE");
  await page.screenshot({ path: path.join(artifactDirectory, "program-file-desktop.png"), fullPage: true });
});

test("Student Intel contribution and admin moderation remain inside the Fable Program File", async ({ page }) => {
  await openRise(page, "program/rise_ps_atlas_im/overview");
  await expect(page.locator(".intelEmpty")).toContainText("No Student Intel published yet");
  await page.getByRole("button", { name: "+ Contribute Intel" }).click();
  await page.locator("#studentIntelForm select[name='category']").selectOption({ label: "Visa" });
  await page.locator("#studentIntelForm select[name='sourceKind']").selectOption("FIRSTHAND");
  await page.locator("#studentIntelForm textarea[name='claim']").fill("Interview-day materials described a J-1 policy change for this cycle.");
  await page.locator("#studentIntelForm input[name='sourceLabel']").fill("Interview-day materials");
  await page.getByRole("button", { name: "Submit for verification" }).click();
  await expect(page.locator(".intelCard")).toContainText("Verification pending");
  await expect(page.locator(".intelCard")).toContainText("Anonymous MissionMed Student");
  await page.screenshot({ path: path.join(artifactDirectory, "student-intel-student.png"), fullPage: true });

  await openRise(page, "admin/student-intel");
  await expect(page.locator("#main")).toContainText("MissionMed Student");
  await expect(page.locator("#main")).toContainText("Original · immutable");
  await page.getByRole("button", { name: "Mark verified" }).click();
  await page.locator("#modal textarea[name='reason']").fill("Confirmed against an official program source.");
  await page.getByRole("button", { name: "Confirm action" }).click();
  await expect(page.locator("#main")).toContainText("Verified by MissionMed");
  await expect(page.locator("#modal")).not.toHaveClass(/open/);
  await page.screenshot({ path: path.join(artifactDirectory, "student-intel-admin.png"), fullPage: true });
  await page.getByRole("button", { name: "Preview verification queue" }).click();
  await expect(page.locator("#modal")).toContainText("Paid submission is unavailable");
});

test("all six Program File tabs expose evidence-safe content or honest empty states", async ({ page }) => {
  await openRise(page, "program/rise_ps_atlas_im/overview");
  const expectations = new Map([
    ["Overview", "narrative layers remain pending"],
    ["Fit", "RISE does not guess"],
    ["Residents", "Not yet researched"],
    ["People", "Leadership is not yet verified"],
    ["Fellowships & Outcomes", "Fellowship inventory not yet verified"],
    ["Details", "Not published / not yet verified"],
  ]);
  for (const [name, text] of expectations) {
    await page.getByRole("tab", { name, exact: true }).click();
    await expect(page.locator("#fileBody")).toContainText(text);
  }
});

test("Sources & Freshness stays available as a utility drawer", async ({ page }) => {
  await openRise(page, "program/rise_ps_atlas_im/overview");
  await page.getByRole("button", { name: /sources & freshness/i }).click();
  await expect(page.locator("#srcPanel")).toHaveClass(/open/);
  await expect(page.locator("#srcPanel")).toContainText("Freshness by family");
  await expect(page.locator("#srcPanel")).toContainText("Canonical registry source");
  await expect(page.locator("#srcPanel")).toContainText("BETA · VERIFY WITH PROGRAM");
});

test("My Programs save, state, and notes survive a browser reload", async ({ page }) => {
  await openRise(page, "program/rise_ps_atlas_im/overview");
  await page.getByRole("button", { name: "★ Save", exact: true }).click();
  await page.getByRole("button", { name: "Close file", exact: true }).click();
  await page.getByRole("button", { name: /^My Programs/ }).click();
  await expect(page.locator(".pRow")).toHaveCount(1);
  await page.getByRole("button", { name: "saved", exact: true }).click();
  await expect(page.getByRole("button", { name: "applied", exact: true })).toBeVisible();
  await page.locator(".pRow textarea").fill("Interview on October 12");
  await page.locator(".pRow textarea").blur();
  await page.reload();
  await expect(page.locator("body")).not.toHaveClass(/is-booting/);
  await expect(page.getByRole("button", { name: "applied", exact: true })).toBeVisible();
  await expect(page.locator(".pRow textarea")).toHaveValue("Interview on October 12");
});

test("Compare preserves the four-program cap and unknown states", async ({ page }) => {
  await openRise(page, "find");
  for (const id of ["rise_ps_atlas_im", "rise_ps_beacon_medpeds", "rise_ps_cascade_neuro", "rise_ps_delta_peds"]) {
    await page.locator(`.pRow[data-open="${id}"]`).getByRole("button", { name: "⊞ Compare", exact: true }).click();
  }
  await expect(page.locator("#cmpCount")).toHaveText("4");
  await page.locator('[title="Compare tray"]').click();
  await expect(page.locator("#modal")).toHaveClass(/open/);
  await expect(page.locator("#modal")).toContainText("Not published");
});

test("profile, CV, entitlement, RankList IQ, and premium integrations fail closed honestly", async ({ page }) => {
  await openRise(page, "profile");
  await expect(page.locator("#main")).toContainText("Matrix profile integration is unavailable");
  await page.getByRole("button", { name: "Use my CV instead" }).click();
  await expect(page.locator("#modal")).toContainText("File Vault connection unavailable");
  await page.locator("#modal .mBtn.sec").click();
  await page.getByRole("button", { name: "Rank List", exact: true }).click();
  await expect(page.locator("#main")).toContainText("Feature-flagged shell");
  await openRise(page);
  await page.getByText("Alumni Connections", { exact: true }).click();
  await expect(page.locator("#modal")).toContainText("fails closed");
  await expect(page.locator("#modal")).not.toContainText("Preview as member");
});

test("admin command center preserves preview-before-spend and disables unbound paid work", async ({ page }) => {
  await openRise(page);
  await page.getByRole("button", { name: "Admin tools" }).click();
  await expect(page).toHaveURL(/#\/admin\/research$/);
  await expect(page.locator("#main")).toContainText("research factory is not authorized");
  await expect(page.getByRole("button", { name: /run research/i }).first()).toBeDisabled();
  await page.getByPlaceholder(/Describe the research/).fill("Update resident rosters in New Jersey");
  await page.getByRole("button", { name: "Draft it" }).click();
  await expect(page.locator("#nlDraft")).toContainText("task count and cost require an authorized server preview");
  await expect(page.locator("#nlDraft").getByRole("button", { name: "Run research" })).toBeDisabled();
  await page.getByRole("button", { name: "Queue", exact: true }).click();
  await expect(page.locator("#main")).toContainText("No authorized research queue is connected");
  await page.getByRole("button", { name: /^Review/ }).click();
  await expect(page.locator("#main")).toContainText("No authorized review queue is connected");
});

test("narrow viewport preserves the consumer shell without horizontal document overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await openRise(page, "find");
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  await expect(page.locator('[data-view="find"] .eyebrow')).toHaveText("Find Programs");
  await page.screenshot({ path: path.join(artifactDirectory, "find-mobile.png"), fullPage: true });
});

test("production-wired shell has no critical accessibility violations on core routes", async ({ page }) => {
  for (const route of ["home", "find", "profile", "program/rise_ps_atlas_im/overview"]) {
    await openRise(page, route);
    await expectNoCriticalA11yViolations(page);
  }
});
