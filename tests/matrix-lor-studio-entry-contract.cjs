#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "wp-content/plugins/missionmed-hub/assets/student-os.js");
const source = fs.readFileSync(sourcePath, "utf8");
const expectedSourceSha256 = "56c7c339ee12cdd06874241fa6134e1db41721e425dc9d988b4af110368dc3fa";
const launchUrl = "https://missionmed-hq-production.up.railway.app/api/lor-studio/auth/start";
let checks = 0;

function assert(condition, message) {
	checks += 1;
	if (!condition) {
		throw new Error(`FAIL: ${message}`);
	}
}

function createNode(attributes) {
	return {
		innerHTML: "",
		getAttribute(name) {
			return Object.prototype.hasOwnProperty.call(attributes || {}, name) ? attributes[name] : null;
		},
		querySelectorAll() {
			return [];
		}
	};
}

function createHarness(entry, options) {
	options = options || {};
	const assigned = [];
	const rendered = [];
	const baseUrl = "https://missionmedinstitute.com/member-dashboard/";
	const location = {
		hash: options.hash || "#dashboard",
		href: baseUrl + (options.hash || "#dashboard"),
		origin: "https://missionmedinstitute.com",
		assign(value) {
			assigned.push(String(value));
		}
	};
	const history = {
		replaceState(_state, _title, value) {
			const next = String(value || "");
			if (next.charAt(0) === "#") {
				location.hash = next;
				location.href = baseUrl + next;
			}
		}
	};
	const nodes = {};
	const document = {
		readyState: "loading",
		documentElement: null,
		body: null,
		head: null,
		addEventListener() {},
		removeEventListener() {},
		getElementById(id) {
			return nodes[id] || null;
		}
	};
	const matrix = {
		access: {
			is_enrolled: true,
			admin_full_access: options.admin === true,
			module_permissions: options.modulePermissions || {}
		},
		modules: options.modules || [],
		profile: {}
	};
	const window = {
		MMED_OS: matrix,
		mmedStudentOsFeatureFlags: { runtime_v2: { enabled: false } },
		mmedLorStudioMatrixEntry: entry,
		location,
		history,
		document,
		performance,
		addEventListener() {},
		setTimeout,
		clearTimeout,
		sessionStorage: {
			getItem() { return "1"; },
			setItem() {}
		}
	};
	window.window = window;

	const context = {
		window,
		document,
		performance,
		URL,
		Promise,
		AbortController,
		FormData: class FormDataStub {},
		console,
		setTimeout,
		clearTimeout
	};
	vm.createContext(context);
	vm.runInContext(source, context, { filename: sourcePath });

	const originalSidebarRenderer = matrix.render.sidebar;
	matrix.render.sidebar = function () {};
	matrix.render.page = function (route) { rendered.push(route); };
	matrix.appMode = {
		activate() {},
		deactivateUnless() {}
	};
	matrix.runtime_v2.enabled = false;

	return {
		matrix,
		window,
		document,
		location,
		assigned,
		rendered,
		navItems() {
			return matrix.components.navItems();
		},
		route(hash) {
			assigned.length = 0;
			rendered.length = 0;
			location.hash = hash;
			location.href = baseUrl + hash;
			matrix.router.route();
		},
		renderSidebar() {
			const rootNode = createNode({ "data-api-base": "/wp-json/mmed/v1", "data-nonce": "fixture" });
			const sidebarNode = createNode();
			const contentNode = createNode();
			nodes["student-os-root"] = rootNode;
			nodes["sos-sidebar"] = sidebarNode;
			nodes["sos-content"] = contentNode;
			matrix.router.start = function () {};
			matrix.init();
			originalSidebarRenderer.call(matrix.render);
			return sidebarNode.innerHTML;
		}
	};
}

function routes(harness) {
	return harness.navItems().map(item => item.route);
}

function lorStudioAnchor(html) {
	return (html.match(/<a class="sos-nav-link[^>]*>[\s\S]*?<\/a>/g) || [])
		.find(anchor => anchor.includes("<span>LOR Studio</span>")) || "";
}

const sourceHash = crypto.createHash("sha256").update(source).digest("hex");
assert(sourceHash === expectedSourceSha256, "mutable Matrix source matches the reviewed LOR Studio candidate");
assert(source.includes('var LOR_STUDIO_ROUTE = "lor-studio";'), "canonical LOR Studio route is fixed in source");
assert(source.includes(`var LOR_STUDIO_LAUNCH_URL = "${launchUrl}";`), "canonical Railway auth start URL is fixed in source");
assert(source.includes("normalizeLorStudioMatrixEntry(window.mmedLorStudioMatrixEntry)"), "server-resolved entry object is consumed before Matrix initialization");
assert(!source.includes('route: "lor"'), "legacy LOR route is absent from the approved navigation declaration");
assert(!source.includes("LOR Writer"), "legacy LOR Writer label and renderer copy are absent");
assert(!source.includes("app.state.lor"), "legacy LOR state is absent");
assert(!source.includes("renderLOR"), "legacy LOR renderer is absent");
assert(!source.includes("bindLOR"), "legacy LOR mutation binder is absent");
assert(!source.includes("lorFormCard"), "legacy LOR request form is absent");
assert(!source.includes("lorRequestCard"), "legacy LOR request cards are absent");
assert(!/app\.api\.(?:get|post|put|delete)\(\s*["']\/lor(?:["'/])/.test(source), "legacy LOR API requests are absent");

const deniedEntries = [
	undefined,
	null,
	false,
	{},
	{ allowed: false, route: "lor-studio", launchUrl },
	{ allowed: 1, route: "lor-studio", launchUrl },
	{ allowed: "true", route: "lor-studio", launchUrl },
	{ allowed: true, route: "lor", launchUrl },
	{ allowed: true, route: "lor-studio", launchUrl: `${launchUrl}?user=123` },
	{ allowed: true, route: "lor-studio", launchUrl: "https://example.invalid/api/lor-studio/auth/start" }
];

deniedEntries.forEach((entry, index) => {
	const harness = createHarness(entry, {
		admin: true,
		modulePermissions: { "lor-studio": true },
		modules: [{ route: "lor-studio", launch_url: launchUrl }]
	});
	const deniedRoutes = routes(harness);
	assert(!deniedRoutes.includes("lor-studio"), `denied fixture ${index} hides LOR Studio navigation even from admin/module fallbacks`);
	assert(!deniedRoutes.includes("lor"), `denied fixture ${index} never restores the legacy route`);
	harness.route("#lor-studio");
	assert(harness.assigned.length === 0, `denied fixture ${index} does not launch Railway`);
	assert(harness.location.hash === "#dashboard", `denied fixture ${index} normalizes the manual route to Dashboard`);
	assert(harness.matrix.state.route === "dashboard", `denied fixture ${index} renders Dashboard state`);
});

const exactEntry = { allowed: true, route: "lor-studio", launchUrl };
const allowed = createHarness(exactEntry, {
	modules: [{ route: "lor-studio", launch_url: "https://example.invalid/identity?email=student@example.invalid" }]
});
const allowedItems = allowed.navItems();
const allowedRoutes = routes(allowed);
const allowedItem = allowedItems.find(item => item.route === "lor-studio");
assert(allowedRoutes.filter(route => route === "lor-studio").length === 1, "authorized navigation exposes exactly one LOR Studio entry");
assert(!allowedRoutes.includes("lor"), "authorized navigation still excludes the legacy route");
assert(allowedItem && allowedItem.label === "LOR Studio", "authorized entry uses the canonical label");
assert(allowedItem && allowedItem.section === "MATCH TOOLS", "authorized entry is placed in Match Tools");
assert(allowedItem && allowedItem.launchUrl === launchUrl, "server module data cannot replace the fixed launch URL");
assert(!allowed.window.MatrixRuntime.modules["lor-studio"], "LOR Studio is not registered as an internal legacy runtime renderer");
assert(!Object.prototype.hasOwnProperty.call(allowed.matrix.state, "lor"), "runtime state has no legacy LOR slot");
assert(typeof allowed.matrix.render.lor === "undefined", "runtime has no legacy LOR render method");

allowed.route("#lor");
assert(allowed.assigned.length === 0, "legacy #lor never launches Railway");
assert(allowed.location.hash === "#dashboard", "legacy #lor normalizes to Dashboard");
assert(allowed.matrix.state.route === "dashboard", "legacy #lor renders Dashboard state");

allowed.route("#/lor");
assert(allowed.assigned.length === 0, "legacy #/lor never launches Railway");
assert(allowed.location.hash === "#dashboard", "legacy #/lor normalizes to Dashboard");

allowed.route("#lor-studio?email=student@example.invalid");
assert(allowed.assigned.length === 0, "identity-bearing LOR Studio hashes never launch Railway");
assert(allowed.matrix.state.route === "dashboard", "identity-bearing LOR Studio hashes fail closed to Dashboard state");

allowed.route("#lor-studio");
assert(allowed.assigned.length === 1, "authorized manual LOR Studio route launches exactly once");
assert(allowed.assigned[0] === launchUrl, "authorized manual route launches only the fixed Railway auth start URL");
assert(allowed.rendered.length === 0, "authorized manual route does not invoke an internal Matrix renderer");

const sidebarHtml = allowed.renderSidebar();
const anchor = lorStudioAnchor(sidebarHtml);
assert(anchor !== "", "authorized sidebar renders the LOR Studio anchor");
assert(anchor.includes(`href="${launchUrl}"`), "sidebar anchor uses the fixed Railway auth start URL");
assert(anchor.includes('referrerpolicy="no-referrer"'), "sidebar anchor suppresses the Matrix referrer");
assert(!/\starget=/.test(anchor), "sidebar launch remains same-tab");
assert(!anchor.includes("data-locked"), "authorized sidebar entry is not rendered as a locked module");
assert(!anchor.includes("aria-disabled"), "authorized sidebar entry is not marked disabled");
assert(!/[?&](?:email|user|user_id|subject|token|code)=/i.test(anchor), "sidebar launch carries no identity or credential query data");

const hidden = createHarness(undefined);
const hiddenSidebar = hidden.renderSidebar();
assert(!hiddenSidebar.includes("LOR Studio"), "missing server entry leaves no LOR Studio sidebar text");
assert(!hiddenSidebar.includes("LOR Writer"), "missing server entry leaves no legacy LOR sidebar text");

console.log(`PASS: ${checks} Matrix LOR Studio JavaScript contract checks`);
