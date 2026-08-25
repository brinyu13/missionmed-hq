#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const baseUrl = process.env.FV2_BASE_URL || "http://127.0.0.1:8765/tests/fixtures/file-vault-v2-harness.html";
const evidenceDir = process.env.FV2_EVIDENCE_DIR || "";
const systemChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
let passed = 0;
const failures = [];

function assert(condition, message) {
	if (condition) {
		passed += 1;
		return;
	}
	failures.push(message);
}

function fixtureUrl(query) {
	const url = new URL(baseUrl);
	Object.entries(query || {}).forEach(([key, value]) => url.searchParams.set(key, value));
	return url.toString();
}

async function waitForHarness(page) {
	await page.waitForSelector('html[data-harness-ready="true"]', { timeout: 8000 });
	await page.waitForSelector(".mmed-fv2", { timeout: 8000 });
}

async function createPage(browser, query, viewport, options = {}) {
	const context = await browser.newContext({
		viewport: viewport || { width: 1440, height: 1000 },
		reducedMotion: options.reducedMotion || "no-preference"
	});
	const page = await context.newPage();
	const diagnostics = [];
	page.on("pageerror", error => diagnostics.push(`pageerror: ${error.message}`));
	page.on("console", message => {
		if (message.type() === "error") diagnostics.push(`console: ${message.text()}`);
	});
	await page.goto(fixtureUrl(query), { waitUntil: "domcontentloaded" });
	await waitForHarness(page);
	return { context, page, diagnostics };
}

async function browserAccessibilityAudit(page, label) {
	const audit = await page.evaluate(() => {
		const parseRgb = value => {
			const match = String(value || "").match(/[\d.]+/g);
			return match && match.length >= 3 ? match.slice(0, 3).map(Number) : null;
		};
		const luminance = rgb => {
			const channels = rgb.map(value => {
				const normalized = value / 255;
				return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
			});
			return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
		};
		const contrast = (foreground, background) => {
			const lighter = Math.max(luminance(foreground), luminance(background));
			const darker = Math.min(luminance(foreground), luminance(background));
			return (lighter + 0.05) / (darker + 0.05);
		};
		const lowContrastHeadings = [...document.querySelectorAll(".mmed-fv2 h1,.mmed-fv2 h2")]
			.filter(heading => heading.getClientRects().length > 0)
			.map(heading => {
				const foreground = parseRgb(getComputedStyle(heading).color);
				let ancestor = heading;
				let background = null;
				while (ancestor && !background) {
					const candidate = getComputedStyle(ancestor).backgroundColor;
					if (candidate && candidate !== "transparent" && candidate !== "rgba(0, 0, 0, 0)") background = parseRgb(candidate);
					ancestor = ancestor.parentElement;
				}
				const ratio = foreground && background ? contrast(foreground, background) : 0;
				return { tag: heading.tagName, className: heading.className, ratio };
			})
			.filter(heading => heading.ratio < 4.5);
		const duplicateIds = [...document.querySelectorAll("[id]")]
			.map(node => node.id)
			.filter((id, index, ids) => id && ids.indexOf(id) !== index);
		const unnamedButtons = [...document.querySelectorAll("button")].filter(button => {
			const name = button.getAttribute("aria-label") || button.getAttribute("title") || button.textContent.trim();
			return !name;
		}).length;
		const unlabeledFields = [...document.querySelectorAll('input:not([type="hidden"]),select,textarea')].filter(field => {
			return !field.closest("label") && !field.getAttribute("aria-label") && !field.getAttribute("aria-labelledby");
		}).length;
			const smallTargets = [...document.querySelectorAll("button:not([disabled])")].filter(button => {
			const rect = button.getBoundingClientRect();
			return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44);
		}).map(button => ({ text: button.textContent.trim(), width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height }));
			const buttonsWithListitemRole = document.querySelectorAll('button[role="listitem"]').length;
			return { duplicateIds, unnamedButtons, unlabeledFields, smallTargets, buttonsWithListitemRole, lowContrastHeadings };
	});
	assert(audit.duplicateIds.length === 0, `${label}: duplicate DOM IDs: ${audit.duplicateIds.join(", ")}`);
	assert(audit.unnamedButtons === 0, `${label}: ${audit.unnamedButtons} unnamed buttons`);
	assert(audit.unlabeledFields === 0, `${label}: ${audit.unlabeledFields} unlabeled fields`);
	assert(audit.smallTargets.length === 0, `${label}: undersized button targets ${JSON.stringify(audit.smallTargets)}`);
	assert(audit.buttonsWithListitemRole === 0, `${label}: ${audit.buttonsWithListitemRole} buttons lost button semantics to listitem roles`);
	assert(audit.lowContrastHeadings.length === 0, `${label}: low-contrast headings ${JSON.stringify(audit.lowContrastHeadings)}`);
}

async function overflowAudit(page, label) {
	const metrics = await page.evaluate(() => {
		const app = document.querySelector(".mmed-fv2");
		const stage = document.querySelector(".fv2-stage");
		return {
			viewport: window.innerWidth,
			documentWidth: document.documentElement.scrollWidth,
			appWidth: app ? app.scrollWidth : 0,
			appClient: app ? app.clientWidth : 0,
			stageWidth: stage ? stage.scrollWidth : 0,
			stageClient: stage ? stage.clientWidth : 0
		};
	});
	assert(metrics.documentWidth <= metrics.viewport + 1, `${label}: document overflow ${JSON.stringify(metrics)}`);
	assert(metrics.appWidth <= metrics.appClient + 1, `${label}: app overflow ${JSON.stringify(metrics)}`);
	assert(metrics.stageWidth <= metrics.stageClient + 1, `${label}: stage overflow ${JSON.stringify(metrics)}`);
}

async function saveEvidence(page, filename) {
	if (!evidenceDir) return;
	fs.mkdirSync(evidenceDir, { recursive: true });
	await page.screenshot({ path: path.join(evidenceDir, filename), fullPage: false });
}

async function studentFlow(browser) {
	const { context, page, diagnostics } = await createPage(browser, { role: "student" });
	try {
		assert(await page.getByRole("heading", { name: "Avery Rivera (Fixture)", exact: true }).isVisible(), "student: Vault heading missing");
		const primaryActions = await page.locator(".fv2-home-action strong").allTextContents();
		assert(primaryActions.join("|") === "Add Document|Files From MissionMed", `student: primary action hierarchy is incorrect ${primaryActions.join("|")}`);
		assert(await page.getByRole("button", { name: "Journey", exact: true }).count() === 0, "student: Journey remains an equal top-level destination");
		assert(await page.getByRole("heading", { name: "My Documents", exact: true }).isVisible(), "student: My Documents heading missing");
		assert(await page.locator('[data-fv2-action="next-action"]').count() === 1, "student: expected one highlighted next action");
		assert(await page.locator('[data-fv2-action="select-document"]').count() === 4, "student: expected four document rows");
		assert(await page.evaluate(() => window.__FV2_HARNESS__.instance.safeDownloadUrl("http://unsafe.example/file") === ""), "student: HTTP download URL was not rejected");
		await overflowAudit(page, "student desktop");
		await browserAccessibilityAudit(page, "student Vault");
		await saveEvidence(page, "01-student-vault-default.png");

		await page.locator('[data-fv2-action="select-document"][data-fv2-document-id="1101"]').click();
		await page.waitForSelector(".fv2-detail-panel");
		assert(await page.getByRole("heading", { name: "Personal Statement", exact: true }).last().isVisible(), "student: selected detail missing");
		await saveEvidence(page, "02-student-document-selected.png");

		await page.locator('[data-fv2-action="download"][data-fv2-document-id="1101"]').first().click();
		await page.waitForFunction(() => window.__FV2_HARNESS__.downloads.length === 1);
		assert(await page.evaluate(() => window.__FV2_HARNESS__.downloads[0].href.startsWith("https://secure-files.fixture.invalid/")), "student: secure download was not issued through fixture");

			await page.locator('[data-fv2-action="open-workspace"][data-fv2-document-id="1101"]').click();
			await page.waitForSelector(".fv2-binary-workspace");
			const workspaceFocus = await page.evaluate(() => ({ activeId: document.activeElement && document.activeElement.id, scrollTop: document.querySelector(".fv2-stage").scrollTop }));
			assert(workspaceFocus.activeId === "mmed-file-vault-v2-content" && workspaceFocus.scrollTop === 0, `student: Doc Docs did not focus its stage at the top ${JSON.stringify(workspaceFocus)}`);
			assert(await page.getByRole("heading", { name: "avery_personal_statement_v2.docx" }).isVisible(), "student: Doc Docs binary filename missing");
		assert(await page.getByText("File Vault does not edit binary documents in the browser.").isVisible(), "student: binary-editing truth statement missing");
			await page.getByRole("tab", { name: /^Versions/ }).click();
			assert(await page.locator(".fv2-version-row").count() === 2, "student: version history missing");
			await page.getByRole("tab", { name: /^Versions/ }).press("ArrowRight");
			assert(await page.getByRole("tab", { name: /^Comments/ }).getAttribute("aria-selected") === "true", "student: tab arrow-key navigation failed");
			await page.locator("[data-fv2-comment-body]").fill("Fixture student follow-up comment.");
		await page.getByRole("button", { name: /Post comment/ }).click();
		await page.waitForFunction(() => window.__FV2_HARNESS__.mutations.some(item => item.type === "comment"));
		assert(await page.getByText("Fixture student follow-up comment.").isVisible(), "student: posted comment did not return after refresh");
		if (evidenceDir) await page.waitForTimeout(5300);
		await saveEvidence(page, "03-doc-docs-workspace.png");

		await page.getByRole("button", { name: /Back to Vault/ }).click();
		const settingsButton = page.locator('[data-fv2-action="open-settings"]');
		await settingsButton.focus();
		await page.keyboard.press("Enter");
		await page.waitForSelector('[role="dialog"][aria-label="File Vault settings"]');
		assert(await page.getByText("Preferences are saved on this device.", { exact: true }).isVisible(), "student: settings persistence scope is not disclosed");
		assert(await page.locator('[data-fv2-action="setting-sound"]').getAttribute("aria-checked") === "false", "student: sound should default off");
		await page.locator('[data-fv2-action="setting-density"][data-fv2-density="compact"]').click();
		const compactDensity = page.locator('[data-fv2-action="setting-density"][data-fv2-density="compact"]');
		assert(await compactDensity.getAttribute("aria-pressed") === "true", "student: compact density state is not announced");
		await page.waitForFunction(() => document.activeElement && document.activeElement.getAttribute("data-fv2-settings-focus") === "density-compact");
		assert(await compactDensity.evaluate(button => document.activeElement === button), "student: density rerender lost control focus");
		const soundSwitch = page.locator('[data-fv2-action="setting-sound"]');
		await soundSwitch.focus();
		await page.keyboard.press("Space");
		assert(await soundSwitch.getAttribute("aria-checked") === "true", "student: Space did not activate the sound switch");
		await page.waitForFunction(() => document.activeElement && document.activeElement.getAttribute("data-fv2-settings-focus") === "sound");
		assert(await soundSwitch.evaluate(button => document.activeElement === button), "student: sound rerender lost control focus");
		const closeSettings = page.getByRole("button", { name: "Close settings" });
		const resetSettings = page.getByRole("button", { name: "Reset preferences" });
		await closeSettings.focus();
		await page.keyboard.press("Shift+Tab");
		assert(await resetSettings.evaluate(button => document.activeElement === button), "student: Shift+Tab did not wrap to the last settings control");
		await page.keyboard.press("Tab");
		assert(await closeSettings.evaluate(button => document.activeElement === button), "student: Tab did not wrap to the first settings control");
		await saveEvidence(page, "08-settings.png");
		await page.keyboard.press("Escape");
		assert(await settingsButton.evaluate(button => document.activeElement === button), "student: settings focus did not return to trigger");
		assert(await page.locator(".mmed-fv2.fv2-density-compact").count() === 1, "student: compact density did not apply");

		await page.reload({ waitUntil: "domcontentloaded" });
		await waitForHarness(page);
		assert(await page.locator(".mmed-fv2.fv2-density-compact").count() === 1, "student: density preference did not persist");
		await page.getByRole("button", { name: /Open application journey/ }).click();
		assert(await page.getByRole("heading", { name: "Journey", exact: true }).isVisible(), "student: Journey navigation failed");
		assert(await page.getByRole("heading", { name: "Journey", exact: true }).evaluate(heading => document.activeElement === heading), "student: Journey navigation did not focus the page heading");
		assert(await page.getByText("Source: Deterministic browser fixture", { exact: true }).isVisible(), "student: assigned requirement provenance is missing");
		await saveEvidence(page, "07-journey.png");

		await page.getByRole("button", { name: "Vault", exact: true }).click();
		await page.locator('[data-fv2-action="open-upload"]').first().click();
		await page.locator("[data-fv2-upload-file]").focus();
		const filePickerFocus = await page.locator(".fv2-upload-file-field > .fv2-button").evaluate(node => {
			const style = getComputedStyle(node);
			return { style: style.outlineStyle, width: parseFloat(style.outlineWidth), offset: parseFloat(style.outlineOffset) };
		});
		assert(filePickerFocus.style !== "none" && filePickerFocus.width >= 2 && filePickerFocus.offset >= 2, `student: Choose File lacks a visible keyboard focus indicator ${JSON.stringify(filePickerFocus)}`);
		assert((await page.locator("[data-fv2-upload-file]").getAttribute("accept")).includes(".jpg"), "student: unselected picker does not allow the natural file-first photo flow");
		await page.setInputFiles("[data-fv2-upload-file]", {
			name: "fixture_photo.jpg",
			mimeType: "image/jpeg",
			buffer: Buffer.alloc(153600, 1)
		});
		assert(await page.locator("[data-fv2-upload-next]").isDisabled(), "student: file-first photo bypassed the required document type selection");
		await page.locator("[data-fv2-upload-type]").selectOption("application_photo");
		assert(!(await page.locator("[data-fv2-upload-next]").isDisabled()), "student: selecting application photo did not revalidate a valid file-first JPEG");
		assert((await page.locator("[data-fv2-upload-file]").getAttribute("accept")) === ".jpg,image/jpeg,.jpeg", "student: application photo picker does not expose the server-owned JPEG contract");
		await page.setInputFiles("[data-fv2-upload-file]", {
			name: "fixture_photo.png",
			mimeType: "image/png",
			buffer: Buffer.from("not an accepted IMG application photo")
		});
		assert(await page.locator(".fv2-file-choice").getByText("Choose a JPEG application photo.", { exact: false }).isVisible(), "student: PNG application photo was not rejected");
		await page.setInputFiles("[data-fv2-upload-file]", {
			name: "fixture_photo.jpg",
			mimeType: "image/jpeg",
			buffer: Buffer.alloc(153601, 1)
		});
		assert(await page.locator(".fv2-file-choice").getByText("150 KB", { exact: false }).isVisible(), "student: application photo 150 KB cap was not enforced");
		await page.setInputFiles("[data-fv2-upload-file]", {
			name: "fixture_photo.jpg",
			mimeType: "image/jpeg",
			buffer: Buffer.alloc(153600, 1)
		});
		assert(!(await page.locator("[data-fv2-upload-next]").isDisabled()), "student: valid JPEG application photo did not enable Review");
		await page.getByRole("button", { name: "Close upload" }).click();
		await page.locator('[data-fv2-action="open-upload"]').first().click();
			await page.setInputFiles("[data-fv2-upload-file]", {
			name: "fixture_cv.pdf",
			mimeType: "application/pdf",
			buffer: Buffer.from("deterministic fixture PDF bytes")
			});
			await page.locator("[data-fv2-upload-type]").selectOption("curriculum_vitae");
			assert(!(await page.locator("[data-fv2-upload-next]").isDisabled()), "student: natural file-then-type upload flow left Review disabled");
			await page.locator("[data-fv2-upload-next]").click();
			assert(await page.getByRole("heading", { name: "fixture_cv", exact: true }).isVisible(), "student: upload review step missing");
		await saveEvidence(page, "04-upload-review.png");
		await page.locator('[data-fv2-action="upload-start"]').click();
		await page.getByRole("heading", { name: "Upload confirmed" }).waitFor({ timeout: 8000 });
		assert(await page.evaluate(() => window.__FV2_HARNESS__.mutations.some(item => item.type === "confirm")), "student: upload confirmation mutation missing");
		assert(await page.locator('[role="progressbar"][aria-valuenow="100"]').count() === 1, "student: upload progress did not reach 100");
		assert(diagnostics.length === 0, `student: browser diagnostics ${diagnostics.join(" | ")}`);
	} finally {
		await context.close();
	}
}

async function rapidStudentSwitchFlow(browser) {
	const { context, page, diagnostics } = await createPage(browser, { role: "admin", scenario: "switch-race" }, { width: 1280, height: 800 });
	try {
		await page.locator('[data-fv2-action="load-student"][data-fv2-student-id="101"]').click();
		const picker = page.locator("[data-fv2-student-picker]");
		await picker.waitFor();
		await picker.selectOption("102");
		await page.getByRole("heading", { name: "Jordan Lee (Fixture)", exact: true }).waitFor();
		await page.waitForTimeout(240);
		assert(await page.getByRole("heading", { name: "Jordan Lee (Fixture)", exact: true }).isVisible(), "admin switching: stale first response replaced the latest student");
		assert(await page.evaluate(() => window.__FV2_HARNESS__.instance.state.selectedStudentId === 102), "admin switching: selected student ID is stale");
		assert(await page.locator('[data-fv2-action="select-document"][data-fv2-document-id="1101"]').count() === 0, "admin switching: previous student document state leaked into the new Vault");
		assert(await page.evaluate(() => window.__FV2_HARNESS__.calls.filter(call => /^\/students\/(101|102)$/.test(call.path)).length === 2), "admin switching: rapid selections did not issue both scoped requests");
		assert(diagnostics.length === 0, `admin switching: browser diagnostics ${diagnostics.join(" | ")}`);
	} finally {
		await context.close();
	}
}

async function lateMatrixTakeoverRecoveryFlow(browser) {
	const { context, page, diagnostics } = await createPage(browser, { role: "student" }, { width: 1280, height: 800 });
	try {
		await page.evaluate(() => {
			const harness = window.__FV2_HARNESS__;
			const fixturePrefix = "/__fv2_runtime_fixture__";
			const nativeFetch = window.fetch.bind(window);
			history.replaceState(null, "", "#filevault");
			window.mmedFileVaultV2Config.restUrl = window.location.origin + fixturePrefix;
			window.fetch = function (input, options) {
				const url = new URL(String(input), window.location.href);
				if (url.origin !== window.location.origin || url.pathname.indexOf(fixturePrefix) !== 0) return nativeFetch(input, options);
				let body = null;
				try { body = options && options.body ? JSON.parse(options.body) : null; } catch (error) { body = null; }
				const query = {};
				url.searchParams.forEach((value, key) => { query[key] = value; });
				return harness.api({
					method: options && options.method ? options.method : "GET",
					path: url.pathname.slice(fixturePrefix.length) || "/",
					body: body,
					query: query,
					signal: options && options.signal
				}).then(function (payload) {
					return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
				}, function (error) {
					return new Response(JSON.stringify({ message: error.message || "Fixture request failed." }), { status: error.status || 500, headers: { "Content-Type": "application/json" } });
				});
			};

			const legacyModule = {
				id: "filevault-v1",
				route: "filevault",
				load: function () { return Promise.resolve(); },
				mount: function () { window.MMED_FILE_VAULT_V1.render(); },
				unmount: function () {}
			};
			window.MMED_OS = { render: { fileVault: window.MMED_FILE_VAULT_V1.render } };
			window.MatrixRuntime = {
				enabled: true,
				modules: { filevault: legacyModule },
				current: { route: "filevault", module: legacyModule, mounted: true },
				navigationCount: 0,
				completedMountCount: 0,
				register: function (module) { this.modules[module.route] = module; },
				navigate: function (route) {
					const module = this.modules[route];
					const previous = this.current;
					if (previous && previous.route === route && previous.mounted) return;
					if (previous && previous.module && typeof previous.module.unmount === "function") previous.module.unmount();
					const controller = new AbortController();
					const current = { route: route, module: module, mounted: false };
					this.current = current;
					this.navigationCount += 1;
					document.getElementById("sos-content").innerHTML = '<section data-runtime-skeleton role="status">Loading File Vault</section>';
					return Promise.resolve(module.load({ refs: { content: document.getElementById("sos-content") }, signal: controller.signal }))
						.then(function () { return new Promise(resolve => window.setTimeout(resolve, 25)); })
						.then(function () { return module.mount({ refs: { content: document.getElementById("sos-content") }, signal: controller.signal }); })
						.then(() => { current.mounted = true; this.completedMountCount += 1; });
				}
			};
			harness.v1FallbackRendered = false;
			window.MMED_FILE_VAULT_V1.render();
		});

		await page.waitForSelector("[data-fv2-app]", { timeout: 3000 });
		await page.getByRole("heading", { name: "Avery Rivera (Fixture)", exact: true }).waitFor();
		const firstRecovery = await page.evaluate(() => ({
			v1Rendered: window.__FV2_HARNESS__.v1FallbackRendered === true,
			moduleId: window.MatrixRuntime.current.module.id,
			navigationCount: window.MatrixRuntime.navigationCount,
			completedMountCount: window.MatrixRuntime.completedMountCount
		}));
		assert(firstRecovery.v1Rendered, "Matrix takeover: fixture did not reproduce the late V1 overwrite");
		assert(firstRecovery.moduleId === "filevault-v2", `Matrix takeover: recovery kept ${firstRecovery.moduleId}`);
		assert(firstRecovery.navigationCount === 1 && firstRecovery.completedMountCount === 1, `Matrix takeover: expected one completed recovery ${JSON.stringify(firstRecovery)}`);

		await page.waitForTimeout(9300);
		assert(await page.evaluate(() => window.MatrixRuntime.navigationCount === 1 && window.MatrixRuntime.completedMountCount === 1), "Matrix takeover: bounded retry caused a duplicate recovery");
		await page.evaluate(() => {
			window.MatrixRuntime.current.mounted = true;
			window.MMED_FILE_VAULT_V1.render();
		});
		await page.waitForSelector("[data-fv2-app]", { timeout: 3000 });
		await page.getByRole("heading", { name: "Avery Rivera (Fixture)", exact: true }).waitFor();
		assert(await page.evaluate(() => window.MatrixRuntime.navigationCount === 2 && window.MatrixRuntime.completedMountCount === 2), "Matrix takeover: a later distinct overwrite did not recover exactly once");
		assert(await page.locator("[data-fv2-app]").count() === 1, "Matrix takeover: recovery left duplicate V2 roots");
		assert(diagnostics.length === 0, `Matrix takeover: browser diagnostics ${diagnostics.join(" | ")}`);
	} finally {
		await context.close();
	}
}

async function matrixShellIntegrationFlow(browser) {
	for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
		const label = `Matrix shell ${viewport.width}x${viewport.height}`;
		const { context, page, diagnostics } = await createPage(browser, { role: "admin", shell: "adminbar" }, viewport);
		try {
			const geometry = await page.locator('[data-fv2-action="open-settings"]').evaluate(button => {
				const root = document.getElementById("student-os-root").getBoundingClientRect();
				const app = document.querySelector(".mmed-fv2").getBoundingClientRect();
				const rect = button.getBoundingClientRect();
				const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
				return {
					rootTop: Math.round(root.top),
					rootBottom: Math.round(root.bottom),
					appBottom: Math.round(app.bottom),
					viewportBottom: window.innerHeight,
					hitSettings: !!(hit && hit.closest('[data-fv2-action="open-settings"]'))
				};
			});
			const expectedTop = viewport.width <= 782 ? 46 : 32;
			assert(geometry.rootTop === expectedTop, `${label}: admin offset is wrong ${JSON.stringify(geometry)}`);
			assert(Math.abs(geometry.rootBottom - geometry.viewportBottom) <= 1 && Math.abs(geometry.appBottom - geometry.rootBottom) <= 1, `${label}: V2 canvas exceeds the Matrix shell ${JSON.stringify(geometry)}`);
			assert(geometry.hitSettings, `${label}: WordPress admin UI intercepts the Settings hit target`);
			await page.locator('[data-fv2-action="open-settings"]').click();
			await page.waitForSelector('[role="dialog"][aria-label="File Vault settings"]');
			const isolation = await page.evaluate(() => ({
				bodyClass: document.body.classList.contains("mmed-fv2-overlay-open"),
				adminInert: document.getElementById("wpadminbar").hasAttribute("inert"),
				returnInert: document.getElementById("mmed-matrix-app-return").hasAttribute("inert"),
				returnVisibility: getComputedStyle(document.getElementById("mmed-matrix-app-return")).visibility
			}));
			assert(isolation.bodyClass && isolation.adminInert && isolation.returnInert && isolation.returnVisibility === "hidden", `${label}: dialog did not isolate external Matrix controls ${JSON.stringify(isolation)}`);
			await page.getByRole("button", { name: "Close settings" }).click();
			assert(await page.evaluate(() => !document.getElementById("wpadminbar").hasAttribute("inert") && !document.getElementById("mmed-matrix-app-return").hasAttribute("inert") && !document.body.classList.contains("mmed-fv2-overlay-open")), `${label}: external Matrix controls were not restored`);
			assert(diagnostics.length === 0, `${label}: browser diagnostics ${diagnostics.join(" | ")}`);
		} finally {
			await context.close();
		}
	}
}

async function adminFlow(browser) {
	const { context, page, diagnostics } = await createPage(browser, { role: "admin" }, { width: 1440, height: 1000 });
	try {
		assert(await page.getByRole("heading", { name: "Command", exact: true }).isVisible(), "admin: Command heading missing");
		assert(await page.locator(".fv2-metric").count() === 4, "admin: expected four command metrics");
		await page.locator('[data-fv2-action="load-student"][data-fv2-student-id="101"]').click();
		await page.waitForSelector('[data-fv2-action="select-document"][data-fv2-document-id="1102"]');
		assert(await page.getByRole("heading", { name: "Avery Rivera (Fixture)", exact: true }).isVisible(), "admin: student Vault lens failed");
		await saveEvidence(page, "05-admin-student-vault.png");
		await page.locator('[data-fv2-action="select-document"][data-fv2-document-id="1102"]').click();
		await page.locator('[data-fv2-action="open-workspace"][data-fv2-document-id="1102"]').click();
		await page.waitForSelector("[data-fv2-review-status]");
		const adminOptions = await page.locator("[data-fv2-review-status] option").evaluateAll(options => options.map(option => option.value));
		assert(adminOptions.join(",") === "in_review,needs_changes,reviewed,final", `admin: unexpected transition options ${adminOptions.join(",")}`);
		await page.locator("[data-fv2-review-status]").selectOption("in_review");
		await page.locator("[data-fv2-review-note]").fill("Fixture admin began review.");
		await page.getByRole("button", { name: /Save status/ }).click();
		await page.waitForFunction(() => window.__FV2_HARNESS__.mutations.some(item => item.type === "status"));
		await page.locator("[data-fv2-score-key]").first().fill("8");
		await page.getByRole("button", { name: /Save score/ }).click();
		await page.waitForFunction(() => window.__FV2_HARNESS__.mutations.some(item => item.type === "score"));
		assert(await page.getByText(/\/40/).first().isVisible(), "admin: document-scoped score denominator missing");
		await browserAccessibilityAudit(page, "admin Doc Docs");
			await page.getByRole("button", { name: "Activity", exact: true }).click();
		await page.waitForSelector(".fv2-audit-row");
		await page.locator("[data-fv2-audit-search]").fill("Personal Statement");
		assert(await page.locator(".fv2-audit-row").count() >= 1, "admin: audit search returned no matching row");
		if (evidenceDir) await page.waitForTimeout(5300);
		await saveEvidence(page, "06-admin-review-audit.png");
		await overflowAudit(page, "admin desktop");
		assert(diagnostics.length === 0, `admin: browser diagnostics ${diagnostics.join(" | ")}`);
	} finally {
		await context.close();
	}
}

async function staffPaginationFlow(browser) {
	for (const viewport of [{ width: 1440, height: 900 }, { width: 375, height: 812 }]) {
		const label = `staff pagination ${viewport.width}x${viewport.height}`;
		const { context, page, diagnostics } = await createPage(browser, { role: "admin", scenario: "paged" }, viewport);
		try {
			assert(await page.getByText("Server-authorized student roster and review work, loaded in bounded pages.", { exact: true }).isVisible(), `${label}: bounded scope disclosure missing`);
			assert(await page.locator(".fv2-command-row").count() === 2, `${label}: first roster page is not bounded`);
			assert(await page.getByText("Loaded Students", { exact: true }).isVisible(), `${label}: partial metrics are not labeled as loaded`);
			await page.getByRole("button", { name: "Load more students" }).click();
			const loadedStudent = page.getByRole("button", { name: /Sam Okafor/ });
			await loadedStudent.waitFor();
			assert(await page.locator(".fv2-command-row").count() === 3, `${label}: second roster page did not merge`);
			assert(await loadedStudent.evaluate(node => document.activeElement === node), `${label}: keyboard focus did not move to the first newly loaded student`);
			assert(await page.locator('p[aria-live="polite"]').getByText("1 student loaded.", { exact: true }).isVisible(), `${label}: roster pagination was not announced`);
			assert(await page.locator(".fv2-metric span").filter({ hasText: /^Students$/ }).isVisible(), `${label}: completed metrics did not return to complete labeling`);
			assert(await page.evaluate(() => window.__FV2_HARNESS__.calls.some(call => call.path === "/students" && Number(call.query.page) === 2)), `${label}: next server page was not requested`);
			await page.getByRole("button", { name: "Activity", exact: true }).click();
			await page.locator(".fv2-audit-row").first().waitFor();
			assert(await page.locator(".fv2-audit-row").count() === 1, `${label}: first audit page is not bounded`);
			await page.getByRole("button", { name: "Load more activity" }).click();
			await page.waitForFunction(() => document.querySelectorAll(".fv2-audit-row").length === 3);
			const firstNewEvent = page.locator('[data-fv2-focus-key="audit-event-fixture-event-0002"]');
			assert(await firstNewEvent.evaluate(node => document.activeElement === node), `${label}: keyboard focus did not move to the first newly loaded activity event`);
			assert(await page.locator('p[aria-live="polite"]').getByText("2 activity events loaded.", { exact: true }).isVisible(), `${label}: activity pagination was not announced`);
			assert(await page.evaluate(() => window.__FV2_HARNESS__.calls.some(call => call.path === "/audit" && Number(call.query.page) === 2)), `${label}: next audit roster page was not requested`);
			await overflowAudit(page, label);
			await browserAccessibilityAudit(page, label);
			assert(diagnostics.length === 0, `${label}: browser diagnostics ${diagnostics.join(" | ")}`);
		} finally {
			await context.close();
		}
	}
}

async function auditCursorBoundaryFlow(browser) {
	for (const viewport of [{ width: 1440, height: 900 }, { width: 375, height: 812 }]) {
		const label = `audit cursor ${viewport.width}x${viewport.height}`;
		const { context, page, diagnostics } = await createPage(browser, { role: "admin", scenario: "audit-boundary" }, viewport);
		try {
			await page.getByRole("button", { name: "Activity", exact: true }).click();
			await page.waitForFunction(() => document.querySelectorAll(".fv2-audit-row").length === 200);
			assert(await page.getByRole("button", { name: "Load more activity" }).isVisible(), `${label}: 200-event boundary did not expose the cursor continuation`);
			await page.getByRole("button", { name: "Load more activity" }).click();
			await page.waitForFunction(() => document.querySelectorAll(".fv2-audit-row").length === 201);
			const eventKeys = await page.locator(".fv2-audit-row").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-fv2-focus-key")));
			assert(new Set(eventKeys).size === 201, `${label}: cursor pagination duplicated or lost an event`);
			const auditCalls = await page.evaluate(() => window.__FV2_HARNESS__.calls.filter(call => call.path === "/audit"));
			assert(auditCalls.length === 2 && Number(auditCalls[1].query.page) === 1 && auditCalls[1].query.before_id === "audit-event-0200" && !!auditCalls[1].query.before_at, `${label}: second request did not use the stable within-page cursor`);
			const lastEvent = page.locator('[data-fv2-focus-key="audit-event-audit-event-0201"]');
			assert(await lastEvent.evaluate(node => document.activeElement === node), `${label}: focus did not move to event 201`);
			assert(await page.locator('p[aria-live="polite"]').getByText("1 activity event loaded.", { exact: true }).isVisible(), `${label}: event 201 was not announced`);
			assert(await page.getByRole("button", { name: "Load more activity" }).count() === 0, `${label}: completed cursor still exposes a continuation control`);
			const times = await page.locator(".fv2-audit-row time").evaluateAll(nodes => nodes.map(node => Date.parse(node.getAttribute("datetime"))));
			assert(times.every((value, index) => index === 0 || times[index - 1] >= value), `${label}: merged activity rows are not globally newest-first`);
			await overflowAudit(page, label);
			await browserAccessibilityAudit(page, label);
			assert(diagnostics.length === 0, `${label}: browser diagnostics ${diagnostics.join(" | ")}`);
		} finally {
			await context.close();
		}
	}
}

async function filteredPaginationFocusFlow(browser) {
	const { context, page, diagnostics } = await createPage(browser, { role: "admin", scenario: "paged" }, { width: 375, height: 812 });
	try {
		const commandSearch = page.locator("[data-fv2-command-search]");
		await commandSearch.fill("Avery");
		await page.getByRole("button", { name: "Load more students" }).click();
		await page.waitForFunction(() => window.__FV2_HARNESS__.calls.some(call => call.path === "/students" && Number(call.query.page) === 2));
		assert(await commandSearch.evaluate(node => document.activeElement === node), "filtered pagination 375x812: hidden incoming roster row did not return focus to student search");
		assert(await page.locator(".fv2-command-row").count() === 1, "filtered pagination 375x812: loaded-only roster filter was not preserved");
		await page.getByRole("button", { name: "Activity", exact: true }).click();
		await page.locator(".fv2-audit-row").first().waitFor();
		const auditSearch = page.locator("[data-fv2-audit-search]");
		await auditSearch.fill("Review note");
		await page.getByRole("button", { name: "Load more activity" }).click();
		await page.waitForFunction(() => window.__FV2_HARNESS__.calls.some(call => call.path === "/audit" && Number(call.query.page) === 2));
		assert(await auditSearch.evaluate(node => document.activeElement === node), "filtered pagination 375x812: hidden incoming activity rows did not return focus to activity search");
		assert(await page.locator(".fv2-audit-row").count() === 1, "filtered pagination 375x812: loaded-only activity filter was not preserved");
		assert(await page.locator('p[aria-live="polite"]').getByText("2 activity events loaded.", { exact: true }).isVisible(), "filtered pagination 375x812: hidden incoming activity count was not announced");
		await overflowAudit(page, "filtered pagination 375x812");
		assert(diagnostics.length === 0, `filtered pagination 375x812: browser diagnostics ${diagnostics.join(" | ")}`);
	} finally {
		await context.close();
	}
}

async function mentorFlow(browser) {
	const { context, page, diagnostics } = await createPage(browser, { role: "mentor" }, { width: 1280, height: 900 });
	try {
		await page.locator('[data-fv2-action="load-student"][data-fv2-student-id="101"]').click();
		assert(await page.locator('[data-fv2-action="open-upload"]:not([disabled])').count() === 0, "mentor: enabled upload control should not be exposed");
		await page.locator('[data-fv2-action="select-document"][data-fv2-document-id="1102"]').click();
		await page.locator('[data-fv2-action="open-workspace"][data-fv2-document-id="1102"]').click();
		await page.waitForSelector("[data-fv2-review-status]");
		const mentorOptions = await page.locator("[data-fv2-review-status] option").evaluateAll(options => options.map(option => option.value));
		assert(mentorOptions.join(",") === "in_review", `mentor: submitted transition should only offer in_review, got ${mentorOptions.join(",")}`);
		assert(await page.locator('[data-fv2-review-status] option[value="final"]').count() === 0, "mentor: final option should be hidden");
		await page.getByRole("button", { name: /Save status/ }).click();
		await page.waitForFunction(() => window.__FV2_HARNESS__.mutations.some(item => item.type === "status"));
		await page.locator('[data-fv2-review-status] option[value="needs_changes"]').waitFor({ state: "attached" });
		const secondStage = await page.locator("[data-fv2-review-status] option").evaluateAll(options => options.map(option => option.value));
		assert(secondStage.join(",") === "needs_changes,reviewed", `mentor: in-review transitions incorrect ${secondStage.join(",")}`);
		assert(diagnostics.length === 0, `mentor: browser diagnostics ${diagnostics.join(" | ")}`);
	} finally {
		await context.close();
	}
}

async function stateAndFallbackFlow(browser) {
	const staffError = await createPage(browser, { role: "admin", scenario: "error" }, { width: 1024, height: 800 });
	try {
		assert(await staffError.page.getByRole("button", { name: "Use classic File Vault" }).count() === 0, "fallback: staff must not receive a student-scoped classic fallback");
		assert(staffError.diagnostics.length === 0, `fallback admin: browser diagnostics ${staffError.diagnostics.join(" | ")}`);
	} finally {
		await staffError.context.close();
	}

	for (const scenario of ["empty", "blocked", "malformed"]) {
		const { context, page, diagnostics } = await createPage(browser, { role: "student", scenario }, { width: 1024, height: 800 });
		try {
			if (scenario === "empty") {
				assert(await page.locator(".fv2-document-row.is-missing").count() === 5, "empty: requirement placeholders missing");
			} else if (scenario === "blocked") {
				assert(await page.locator(".fv2-inline-notice").getByText("Private storage is unavailable", { exact: true }).isVisible(), "blocked: storage notice missing");
				assert(await page.locator('[data-fv2-action="open-upload"]:not([disabled])').count() === 0, "blocked: enabled upload control should be absent");
			} else {
				assert(await page.getByRole("heading", { name: "File Vault is unavailable" }).isVisible(), "malformed: fail-closed state missing");
			}
			assert(diagnostics.length === 0, `${scenario}: browser diagnostics ${diagnostics.join(" | ")}`);
		} finally {
			await context.close();
		}
	}

	const { context, page, diagnostics } = await createPage(browser, { role: "student", scenario: "error" }, { width: 1024, height: 800 });
	try {
		await page.evaluate(() => history.replaceState(null, "", "#filevault"));
		await page.getByRole("button", { name: "Use classic File Vault" }).click();
		await page.waitForSelector("[data-v1-fallback]");
		assert(await page.getByText("Classic File Vault fallback rendered.").isVisible(), "fallback: classic renderer did not run");
		assert(await page.evaluate(() => window.__FV2_HARNESS__.v1FallbackRendered === true), "fallback: harness did not record V1 renderer");
		await page.evaluate(() => window.dispatchEvent(new HashChangeEvent("hashchange")));
		await page.waitForTimeout(650);
		assert(await page.locator("[data-v1-fallback]").count() === 1 && await page.locator("[data-fv2-app]").count() === 0, "fallback: observer or deferred route retry replaced the explicit classic fallback");
		await saveEvidence(page, "10-error-v1-fallback.png");
		assert(diagnostics.length === 0, `fallback: browser diagnostics ${diagnostics.join(" | ")}`);
	} finally {
		await context.close();
	}
}

async function responsiveFlow(browser) {
	for (const viewport of [
		{ width: 320, height: 720 },
		{ width: 375, height: 812 },
		{ width: 390, height: 844 },
		{ width: 760, height: 900 },
		{ width: 768, height: 600 },
		{ width: 1024, height: 768 },
		{ width: 1440, height: 900 }
	]) {
		const { context, page, diagnostics } = await createPage(browser, { role: "student" }, viewport, { reducedMotion: "reduce" });
		try {
			await overflowAudit(page, `responsive ${viewport.width}x${viewport.height}`);
			await browserAccessibilityAudit(page, `responsive ${viewport.width}x${viewport.height}`);
			if (viewport.width <= 760) {
				const mobileLayout = await page.evaluate(() => {
					const rail = document.querySelector(".fv2-rail").getBoundingClientRect();
					return { railBottom: Math.round(rail.bottom), viewportBottom: window.innerHeight };
				});
				assert(Math.abs(mobileLayout.railBottom - mobileLayout.viewportBottom) <= 2, `responsive ${viewport.width}: mobile rail is not bottom anchored`);
				if (viewport.width === 320) await saveEvidence(page, "09-mobile-student-vault.png");
			}
			if (viewport.width <= 980) {
				await page.locator('[data-fv2-action="select-document"][data-fv2-document-id="1101"]').click();
				await page.waitForSelector('.fv2-mobile-sheet[role="dialog"]');
				assert(await page.locator('.fv2-mobile-sheet[role="dialog"]').isVisible(), `responsive ${viewport.width}: detail sheet missing`);
			}
			const motion = await page.locator(".fv2-nav-item").first().evaluate(node => getComputedStyle(node).transitionDuration);
			assert(motion === "1e-05s" || motion === "0.00001s" || motion === "0s", `responsive ${viewport.width}: reduced motion duration is ${motion}`);
			assert(diagnostics.length === 0, `responsive ${viewport.width}: browser diagnostics ${diagnostics.join(" | ")}`);
		} finally {
			await context.close();
		}
	}
}

async function main() {
	const executablePath = process.env.FV2_BROWSER_PATH || (fs.existsSync(systemChrome) ? systemChrome : undefined);
	const browser = await chromium.launch({ headless: true, executablePath });
	try {
		await studentFlow(browser);
		await rapidStudentSwitchFlow(browser);
		await lateMatrixTakeoverRecoveryFlow(browser);
		await matrixShellIntegrationFlow(browser);
		await adminFlow(browser);
		await staffPaginationFlow(browser);
		await auditCursorBoundaryFlow(browser);
		await filteredPaginationFocusFlow(browser);
		await mentorFlow(browser);
		await stateAndFallbackFlow(browser);
		await responsiveFlow(browser);
	} finally {
		await browser.close();
	}

	if (failures.length) {
		console.error(`FAIL: ${failures.length} of ${passed + failures.length} File Vault V2 browser checks failed`);
		failures.forEach((failure, index) => console.error(`${index + 1}. ${failure}`));
		process.exit(1);
	}
	console.log(`PASS: ${passed} File Vault V2 browser, responsive, and accessibility checks`);
}

main().catch(error => {
	console.error(error && error.stack ? error.stack : error);
	process.exit(1);
});
