(function () {
	"use strict";

	var config = window.MMED_ADMIN_OS || window.MMED_ADMIN_OS_CONFIG || {};
	var refs = {};
	var state = {
		activeModuleId: null,
		activeModule: null,
		activeAbort: null,
		loaded: {},
		inFlightLoads: {},
		metrics: {
			bootAt: performance.now(),
			route_unknown: 0,
			error_state: 0,
			duplicate_mount_prevented: 0,
			auth_refresh: 0,
			railway_auth_exchange: 0
		},
		cache: new Map(),
		requests: new Map()
	};
	var FEATURES = normalizeFeatures(config.features || {});
	var wpApi = createWpApiClient();
	var railwayClient = createRailwayClient();
		var adminCalendarBridgeState = {
			previousOs: null,
			active: false,
			styleId: "mmed-admin-calendar-v4-css",
			scriptId: "mmed-admin-calendar-v4-js",
			layoutTimer: null
		};

		var CANONICAL = {
			schedulerOps: "/hq/scheduler-ops",
			schedulerFallback: "/hq/scheduler",
			studentMatrix: "/member-dashboard/",
			welcomeEmailsAdmin: (config.endpoints && config.endpoints.welcomeEmailsAdmin) || "/wp-admin/admin.php?page=mmed-welcome-emails",
			studentScheduler: "/member-dashboard/#scheduler",
		studentCalendar: "/member-dashboard/#calendar",
		studentFileVault: "/member-dashboard/#filevault",
		studentMessages: "/member-dashboard/#messages",
			studentStoryForge: "/member-dashboard/#storyforge"
		};

		var CANONICAL_DEMO_PATHS = {
			scheduler: "/wp-content/plugins/missionmed-hub/assets/admin-sources/scheduler-admin-source.html",
			calendar: "/wp-content/plugins/missionmed-hub/assets/admin-sources/matrix-calendar-prototype-v4.html",
			fileVault: "/wp-content/plugins/missionmed-hub/assets/admin-sources/mx-filevault-006d-nexus-clarity-final-demo.html",
			storyForge: "/wp-content/plugins/missionmed-hub/assets/admin-sources/storyforge-admin-source.html"
		};

	var PRODUCT_NAME = "Matrix Admin HQ";
	var ADMIN_APP_MODE_CLASS = "matrix-admin-app-mode";
	var ADMIN_APP_MODE_MODULE_CLASSES = [
		"matrix-admin-app-mode-calendar",
		"matrix-admin-app-mode-scheduler",
		"matrix-admin-app-mode-file-vault",
		"matrix-admin-app-mode-communications",
		"matrix-admin-app-mode-storyforge"
	];
	var ADMIN_APP_MODE_CLASS_BY_ROUTE = {
		"calendar-admin": "matrix-admin-app-mode-calendar",
		"scheduler-ops": "matrix-admin-app-mode-scheduler",
		"file-vault-admin": "matrix-admin-app-mode-file-vault",
		communications: "matrix-admin-app-mode-communications",
		"storyforge-admin": "matrix-admin-app-mode-storyforge"
	};
	var LEGACY_LIVE_MODULE_IDS = [
		"daily-command",
		"alerts",
		"student-management",
		"newly-enrolled",
		"leads",
		"enrollment-status",
		"payments",
		"course-access",
		"mission-residency",
		"exam-prep",
		"usce-clinicals",
		"usce-offers",
		"arena-stat",
		"audit-logs",
		"reports",
		"system-health"
	];
	var LOCAL_WP_LIVE_MODULE_IDS = [
		"daily-command",
		"alerts",
		"student-management",
		"newly-enrolled",
		"leads",
		"enrollment-status",
		"payments",
		"course-access",
		"mission-residency",
		"exam-prep",
		"usce-clinicals",
		"usce-offers",
		"arena-stat",
		"audit-logs",
		"reports",
		"system-health"
	];
	var LEGACY_APP_MODE_CLASS_BY_ROUTE = LEGACY_LIVE_MODULE_IDS.reduce(function (routes, id) {
		routes[id] = "matrix-admin-app-mode-legacy";
		return routes;
	}, {});
	var LIVE_MODULE_OPERATOR_SCOPE = {
		"usce-clinicals": ["brian", "phil"],
		"usce-offers": ["brian", "phil"],
		"mission-residency": ["brian"],
		"exam-prep": ["brian", "dr_j"]
	};

	LOCAL_WP_LIVE_MODULE_IDS.forEach(function (routeId) {
		ADMIN_APP_MODE_CLASS_BY_ROUTE[routeId] = "matrix-admin-app-mode-legacy";
	});
	if (ADMIN_APP_MODE_MODULE_CLASSES.indexOf("matrix-admin-app-mode-legacy") === -1) {
		ADMIN_APP_MODE_MODULE_CLASSES = ADMIN_APP_MODE_MODULE_CLASSES.concat(["matrix-admin-app-mode-legacy"]);
	}

	if (FEATURES.live_data) {
		Object.keys(LEGACY_APP_MODE_CLASS_BY_ROUTE).forEach(function (routeId) {
			ADMIN_APP_MODE_CLASS_BY_ROUTE[routeId] = LEGACY_APP_MODE_CLASS_BY_ROUTE[routeId];
		});
		if (ADMIN_APP_MODE_MODULE_CLASSES.indexOf("matrix-admin-app-mode-legacy") === -1) {
			ADMIN_APP_MODE_MODULE_CLASSES = ADMIN_APP_MODE_MODULE_CLASSES.concat(["matrix-admin-app-mode-legacy"]);
		}
	}

	syncAdminAppModeForHash();

	var SOURCE_PACKAGES = [
		{
			name: "Calendar Admin",
			status: "Source Found",
			tone: "blue",
			path: CANONICAL_DEMO_PATHS.calendar,
			detail: "Prototype v4 includes an admin toggle and Quick Schedule panel. It is the approved candidate for the Calendar admin package."
		},
		{
			name: "File Vault Admin",
			status: "Source Found",
			tone: "gold",
			path: CANONICAL_DEMO_PATHS.fileVault,
			detail: "CLARITY demo includes Admin Command Center mode, review queue, student browser, scoring, and feedback workflow."
		},
		{
			name: "StoryForge Admin",
			status: "Source Found",
			tone: "gold",
			path: CANONICAL_DEMO_PATHS.storyForge,
			detail: "Matrix Mimic includes Advisor mode with student review grid, quality scoring, flags, and pending review states."
		},
		{
			name: "Scheduler Ops",
			status: "Live Route",
			tone: "green",
			path: CANONICAL.schedulerOps,
			detail: "Canonical live Scheduler Ops remains source locked. HQ launches it instead of rebuilding business logic."
		},
		{
			name: "USCE Offer Engine",
			status: "Standalone Source",
			tone: "blue",
			path: "/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/USCE_ADMIN_REDESIGN/",
			detail: "USCE admin demos exist as standalone concepts. Matrix Admin HQ needs a scoped source lock before wiring live workflows."
		}
	];

	var MODULE_META = {
		dashboard: {
			id: "dashboard",
			label: "Dashboard",
			route: "#dashboard",
			icon: "HQ",
			group: "Command",
			status: "Live",
			tone: "green",
			purpose: "Admin command center for daily MissionMed operations.",
			mirror: null,
			load: loadDashboardModule,
			mount: mountDashboard
		},
		"daily-command": {
			id: "daily-command",
			label: "Daily Command",
			route: "#daily-command",
			icon: "DC",
			group: "Command",
			status: "Live",
			tone: "green",
			purpose: "One-day operating view for appointments, follow-ups, messages, billing flags, and urgent admin tasks.",
			mirror: "Dashboard",
			moduleState: "Live WordPress calendar, notification, student, and communications signals are wired.",
			nextAction: "Use the billing and enrollment sections for read-only review; source writes stay in their owner systems.",
			panels: ["Today's appointments", "Follow-ups due", "Messages waiting", "Billing alerts", "New enrollment checks"],
			load: loadStaticModule,
			mount: mountWpDailyCommand
		},
		alerts: {
			id: "alerts",
			label: "Alerts / Tasks",
			route: "#alerts",
			icon: "AT",
			group: "Command",
			status: "Live",
			tone: "green",
			purpose: "Fail-closed admin queue for operational alerts and tasks.",
			mirror: "Notifications",
			moduleState: "WordPress notification and unread communications queues are wired.",
			nextAction: "Add task completion/write tools only after the task source contract is approved.",
			panels: ["Priority alerts", "Admin tasks", "Overdue follow-ups", "System notes"],
			load: loadStaticModule,
			mount: mountWpAlerts
		},
		"student-management": {
			id: "student-management",
			label: "Student Management",
			route: "#student-management",
			icon: "SM",
			group: "Students",
			status: "Live",
			tone: "green",
			purpose: "Admin CRM surface for student lookup, status, program ownership, and support context.",
			mirror: "Settings",
			moduleState: "Student lookup is wired through WordPress users with WooCommerce, LearnDash, and File Vault signals.",
			nextAction: "Add profile edits and program ownership writes only after CRM source contracts are approved.",
			panels: ["Student lookup", "Program ownership", "Support context", "Recent activity"],
			load: loadStaticModule,
			mount: mountWpStudentManagement
		},
		"newly-enrolled": {
			id: "newly-enrolled",
			label: "Newly Enrolled",
			route: "#newly-enrolled",
			icon: "NE",
			group: "Students",
			status: "WP Live",
			tone: "green",
			purpose: "Onboarding command queue for recent enrollments and course access checks.",
			mirror: "Courses",
			moduleState: "Recent enrollment orders and LearnDash access checks are read from WordPress/WooCommerce.",
			nextAction: "Use Course Access for manual review before any LearnDash changes.",
			panels: ["New enrollments", "Access checks", "Welcome tasks", "Advisor handoff"]
		},
		"welcome-emails": {
			id: "welcome-emails",
			label: "Welcome Emails",
			route: "#welcome-emails",
			icon: "WE",
			group: "Students",
			status: "WP Live",
			tone: "green",
			purpose: "Course-specific welcome email preview and manual batch sending for enrolled students.",
			mirror: "Newly Enrolled",
			moduleState: "360 Match Mentorship welcome sends are live. Other course templates stay disabled until approved.",
			nextAction: "Preview selected 360 students and send welcome emails manually. Automation remains off until explicitly enabled.",
			panels: ["360 welcome sends", "Preview", "Batch selection", "Automation settings"],
			load: loadStaticModule,
			mount: mountWelcomeEmailsAdmin
		},
		leads: {
			id: "leads",
			label: "Leads",
			route: "#leads",
			icon: "LD",
			group: "Students",
			status: "WP Signals",
			tone: "green",
			purpose: "Prospect and lead review for admissions and sales follow-up.",
			mirror: null,
			moduleState: "Lead-like signals come from WooCommerce checkout status and recent WordPress registrations.",
			nextAction: "Attach a dedicated CRM feed when the canonical lead source is approved.",
			panels: ["Prospect queue", "Follow-up status", "Offer interest", "Conversion notes"]
		},
		"enrollment-status": {
			id: "enrollment-status",
			label: "Enrollment Status",
			route: "#enrollment-status",
			icon: "ES",
			group: "Students",
			status: "WP Live",
			tone: "green",
			purpose: "Cross-check program enrollment, course access, and onboarding state.",
			mirror: "Courses",
			moduleState: "WooCommerce mapped orders are cross-checked against LearnDash course access.",
			nextAction: "Keep writes in WooCommerce/LearnDash admin until a dedicated action policy is approved.",
			panels: ["Program enrollment", "Course access", "Entitlement status", "Manual review"]
		},
		payments: {
			id: "payments",
			label: "Payments / Billing",
			route: "#payments",
			icon: "PB",
			group: "Students",
			status: "WP Live",
			tone: "green",
			purpose: "Billing review surface for alerts and payment support.",
			mirror: "Orders",
			moduleState: "Read-only WooCommerce order and billing exception review is wired.",
			nextAction: "Stripe detail stays behind WooCommerce/admin systems; no payment writes happen here.",
			panels: ["Billing alerts", "Order review", "Subscription status", "Payment support"]
		},
		"course-access": {
			id: "course-access",
			label: "Course Access",
			route: "#course-access",
			icon: "CA",
			group: "Students",
			status: "WP Live",
			tone: "green",
			purpose: "Course and product access review for support operations.",
			mirror: "Courses",
			moduleState: "MissionMed access-audit mappings, WooCommerce paid orders, and LearnDash course access are wired read-only.",
			nextAction: "Use this to identify access gaps before making changes in LearnDash/WooCommerce.",
			panels: ["Product mapping", "Course access", "Group status", "Manual exceptions"]
		},
		"scheduler-ops": {
			id: "scheduler-ops",
			label: "Scheduler Ops",
			route: "#scheduler-ops",
			icon: "SO",
			group: "Operations",
			status: "Live",
			tone: "green",
			purpose: "Source-locked scheduler operations app mode for availability, appointment types, appointments, and audit review.",
			mirror: "Scheduler",
			load: loadStaticModule,
			mount: mountSchedulerOps,
			panels: ["Canonical Scheduler Ops", "Provider availability", "Appointment types", "Audit log"]
		},
		"calendar-admin": {
			id: "calendar-admin",
			label: "Calendar Admin",
			route: "#calendar-admin",
			icon: "CL",
			group: "Operations",
			status: "Live",
			tone: "green",
			purpose: "Admin calendar command surface for scheduling, drill calendar packages, and event review.",
			mirror: "Calendar",
			source: SOURCE_PACKAGES[0],
			moduleState: "WordPress Matrix calendar CRUD is wired for admin event management.",
			nextAction: "Add student targeting only after a scoped permission model is approved.",
			panels: ["Event create", "Event update", "Event delete", "Calendar categories"],
			load: loadStaticModule,
			mount: mountAdminCalendarApp
		},
		communications: {
			id: "communications",
			label: "Communications",
			route: "#communications",
			icon: "CM",
			group: "Operations",
			status: "Live",
			tone: "green",
			purpose: "Admin MedMail and message response center.",
			mirror: "Messages",
			moduleState: "Admin-to-student communications are wired through the MissionMed communications REST engine.",
			nextAction: "Add templates and broadcast approvals after one-to-one exchange is validated.",
			panels: ["Inbox", "Student search", "Send message", "Reply thread"],
			load: loadStaticModule,
			mount: mountAdminCommunicationsApp
		},
		"file-vault-admin": {
			id: "file-vault-admin",
			label: "File Vault Admin",
			route: "#file-vault-admin",
			icon: "FV",
			group: "Operations",
			status: "Live",
			tone: "green",
			purpose: "Document review command center for uploads, scoring, and advisor feedback.",
			mirror: "File Vault",
			source: SOURCE_PACKAGES[1],
			moduleState: "Admins can browse each student's dedicated File Vault tree, upload/share files, download, and update review status.",
			nextAction: "Keep R2 permissions unchanged; use this Matrix-owned admin surface for student file exchange.",
			panels: ["Review queue", "Student browser", "Document scoring", "Feedback threads"],
			load: loadStaticModule,
			mount: mountAdminFileVaultApp
		},
		"storyforge-admin": {
			id: "storyforge-admin",
			label: "StoryForge Admin",
			route: "#storyforge-admin",
			icon: "SF",
			group: "Operations",
			status: "Source Found",
			tone: "gold",
			purpose: "Advisor review surface for story quality, gates, flags, and interview readiness.",
			mirror: "StoryForge",
			source: SOURCE_PACKAGES[2],
			moduleState: "Advisor mode source is identified. Live backend wiring is deferred.",
			nextAction: "Promote Advisor mode into a lazy Matrix Admin HQ module after source approval.",
			panels: ["Student review grid", "Quality scoring", "Story flags", "Gate progression"],
			load: loadStaticModule,
			mount: mountAdminStoryForgeApp
		},
		"mission-residency": {
			id: "mission-residency",
			label: "Mission Residency",
			route: "#mission-residency",
			icon: "MR",
			group: "Programs",
			status: "WP Live",
			tone: "green",
			purpose: "Program operations view for Mission Residency support.",
			mirror: "Courses",
			moduleState: "Residency program signals are read from access mappings, course enrollments, orders, calendar, and file/message systems.",
			nextAction: "Add approved program write tools only after the program owner workflow is locked.",
			panels: ["Active students", "Appointments", "Documents", "Advisor tasks"]
		},
		"exam-prep": {
			id: "exam-prep",
			label: "Exam Prep",
			route: "#exam-prep",
			icon: "EP",
			group: "Programs",
			status: "WP Live",
			tone: "green",
			purpose: "Exam Prep operations, drills, and advising status.",
			mirror: "Arena",
			moduleState: "Exam Prep signals are read-only through LearnDash courses, video manifest assets, and operational queues.",
			nextAction: "Drill/Arena writes remain untouched.",
			panels: ["Drills", "Advising sessions", "Zoom status", "Student progress"]
		},
		"usce-clinicals": {
			id: "usce-clinicals",
			label: "USCE / Clinicals",
			route: "#usce-clinicals",
			icon: "UC",
			group: "Programs",
			status: "WP Live",
			tone: "green",
			purpose: "Clinical operations overview for USCE requests and status.",
			mirror: null,
			moduleState: "USCE onboarding course/order access is visible through WordPress. Offer-engine actions stay behind the Railway source.",
			nextAction: "Enable the dedicated USCE offer engine only after Railway DNS/auth is clean.",
			panels: ["Requests", "Placements", "Student status", "Offer tracking"]
		},
		"usce-offers": {
			id: "usce-offers",
			label: "USCE Offer Engine",
			route: "#usce-offers",
			icon: "UO",
			group: "Programs",
			status: "WP Bridge",
			tone: "gold",
			purpose: "Admin-only offer creation and tracking workflow for USCE / Clinicals.",
			mirror: null,
			moduleState: "USCE clinical/order/access signals are visible now; offer action routes remain behind Railway DNS/API proof.",
			nextAction: "Do not send offers from this bridge until the Railway offer engine is reachable and authenticated.",
			panels: ["Requests queue", "Offer candidates", "Access review", "Railway blocker"]
		},
		"arena-stat": {
			id: "arena-stat",
			label: "Arena / STAT Oversight",
			route: "#arena-stat",
			icon: "AS",
			group: "Programs",
			status: "WP Health",
			tone: "green",
			purpose: "Admin oversight slot for Arena and STAT status.",
			mirror: "Arena",
			moduleState: "Read-only runtime health and media/course signals are visible. Arena/STAT systems are not mutated.",
			nextAction: "Add deeper Arena/STAT analytics only through their protected runtime plan.",
			panels: ["Arena health", "STAT status", "Progress signals", "Support review"]
		},
		"audit-logs": {
			id: "audit-logs",
			label: "Audit Logs",
			route: "#audit-logs",
			icon: "AL",
			group: "Review",
			status: "WP Live",
			tone: "green",
			purpose: "Review and audit area for access and admin activity.",
			mirror: null,
			moduleState: "Existing access-audit and system signals are wrapped inside Matrix Admin HQ.",
			nextAction: "Keep the full write-capable audit tools in their source admin screens.",
			panels: ["Access audit", "Scheduler audit", "Admin events", "Security review"]
		},
		reports: {
			id: "reports",
			label: "Reports",
			route: "#reports",
			icon: "RP",
			group: "Review",
			status: "WP Live",
			tone: "green",
			purpose: "Operational reporting surface for admin summaries.",
			mirror: null,
			moduleState: "Reports aggregate WordPress, WooCommerce, LearnDash, communications, and video manifest signals.",
			nextAction: "Add export/write workflows only after report ownership is approved.",
			panels: ["Operational reports", "Student reports", "Revenue review", "Program summaries"]
		},
		"system-health": {
			id: "system-health",
			label: "System Health",
			route: "#system-health",
			icon: "SH",
			group: "Review",
			status: "WP Live",
			tone: "green",
			purpose: "Runtime, route, and integration health overview.",
			mirror: null,
			moduleState: "Narrow same-origin health checks are wired without exposing secrets.",
			nextAction: "Use this before deploys and leave live-data OFF until HQ DNS/auth is clean.",
			panels: ["Runtime v2", "Student Matrix protected", "Scheduler route", "Source packages"],
			load: loadStaticModule,
			mount: mountSystemHealth
		},
		"source-packages": {
			id: "source-packages",
			label: "Source Packages",
			route: "#source-packages",
			icon: "SP",
			group: "Review",
			status: "Reference",
			tone: "blue",
			purpose: "Internal source map for admin module package candidates.",
			mirror: null,
			moduleState: "Demoted from the primary dashboard. Used for source-truth review only.",
			nextAction: "Approve each package before live module migration.",
			panels: [],
			load: loadStaticModule,
			mount: mountSourcePackages
		}
	};

	var NAV_SECTIONS = [
		{ label: "Command", items: ["dashboard", "daily-command", "alerts"] },
		{ label: "Students", items: ["student-management", "newly-enrolled", "welcome-emails", "leads", "enrollment-status", "payments", "course-access"] },
		{ label: "Operations", items: ["scheduler-ops", "calendar-admin", "communications", "file-vault-admin", "storyforge-admin"] },
		{ label: "Programs", items: ["mission-residency", "exam-prep", "usce-clinicals", "usce-offers", "arena-stat"] },
		{ label: "Review", items: ["audit-logs", "reports", "system-health", "source-packages"] }
	];

	var MODULES = Object.keys(MODULE_META).map(function (id) {
		return moduleFromMeta(MODULE_META[id]);
	});

	function matrixAdminBody() {
		return document.body || null;
	}

	function routeIdFromHash() {
		return (window.location.hash || "#dashboard").replace(/^#\/?/, "") || "dashboard";
	}

	function syncAdminAppModeForHash() {
		applyAdminAppMode(routeIdFromHash());
	}

	function applyAdminAppMode(routeId) {
		if (ADMIN_APP_MODE_CLASS_BY_ROUTE[routeId]) {
			activateAdminAppMode(routeId);
			return;
		}
		deactivateAdminAppMode();
	}

	function activateAdminAppMode(routeId) {
		var body = matrixAdminBody();
		var className = ADMIN_APP_MODE_CLASS_BY_ROUTE[routeId];

		if (!body || !className) {
			return;
		}

		ADMIN_APP_MODE_MODULE_CLASSES.forEach(function (moduleClass) {
			if (moduleClass !== className) {
				body.classList.remove(moduleClass);
			}
		});
		body.classList.add(ADMIN_APP_MODE_CLASS, className);
		body.setAttribute("data-matrix-admin-app-mode", routeId);
	}

	function deactivateAdminAppMode() {
		var body = matrixAdminBody();
		if (!body) {
			return;
		}

		body.classList.remove(ADMIN_APP_MODE_CLASS);
		ADMIN_APP_MODE_MODULE_CLASSES.forEach(function (className) {
			body.classList.remove(className);
		});
		body.removeAttribute("data-matrix-admin-app-mode");
	}

	function moduleFromMeta(meta) {
		return {
			id: meta.id,
			label: meta.label,
			route: meta.route,
			icon: meta.icon,
			permission: "cap:manage_options",
			studentMirrorModule: meta.mirror,
			authRequirement: "admin",
			requiredData: [],
			prefetchPolicy: "none",
			performanceBudget: { timeToSkeletonMs: 200, timeToUsableMs: 1000 },
			maxInitialRequests: meta.id === "dashboard" ? 1 : 0,
			maxInitialPayloadKB: meta.id === "dashboard" ? 50 : 20,
			auditRequirement: meta.id === "scheduler-ops" ? "full" : "read-only",
			load: meta.load || loadStaticModule,
			mount: meta.mount || function (container, runtimeContext) {
				if (isLocalWpLiveModule(meta.id)) {
					mountWpLegacyModule(container, runtimeContext, meta);
					return;
				}
				if (FEATURES.live_data && isLegacyLiveModule(meta.id)) {
					mountLegacyModule(container, runtimeContext, meta);
					return;
				}
				mountCommandModule(container, runtimeContext, meta);
			},
			unmount: meta.id === "scheduler-ops" ? unmountAdminSchedulerRuntime : meta.id === "calendar-admin" ? unmountAdminCalendarRuntime : unmountNoop,
			errorState: moduleErrorState,
			emptyState: moduleEmptyState
		};
	}

	function isLegacyLiveModule(id) {
		return LEGACY_LIVE_MODULE_IDS.indexOf(id) !== -1;
	}

		function isLocalWpLiveModule(id) {
			return LOCAL_WP_LIVE_MODULE_IDS.indexOf(id) !== -1 && (id !== "usce-offers" || !FEATURES.live_data);
		}

	function currentOperator() {
		var scope = config.auth && config.auth.operatorScope ? config.auth.operatorScope : {};
		return String(config.operator || scope.operator || "").toLowerCase() || "brian";
	}

	function moduleVisible(meta) {
		var allowed = meta && LIVE_MODULE_OPERATOR_SCOPE[meta.id];
		if (!FEATURES.live_data || !allowed) {
			return true;
		}
		return allowed.indexOf(currentOperator()) !== -1;
	}

	var context = null;

	function init() {
		refs.root = document.getElementById("admin-os-root");
		refs.sidebar = document.getElementById("amos-sidebar");
		refs.content = document.getElementById("amos-content");

		if (!refs.root || !refs.sidebar || !refs.content) {
			return;
		}

		renameStaticShell();

		window.AdminRuntime = {
			state: state,
			metrics: state.metrics,
			modules: MODULES,
			version: "2-stage1-d8-439a-admin-app-mode",
			route: resolveRoute
		};
		window.MMEDAdminAppMode = {
			activate: activateAdminAppMode,
			deactivateAll: deactivateAdminAppMode,
			classByRoute: ADMIN_APP_MODE_CLASS_BY_ROUTE,
			returnTarget: adminDashboardUrl
		};

		renderSidebar();
		buildContext().then(function (runtimeContext) {
			context = Object.freeze(runtimeContext);
			state.metrics.shellVisibleMs = Math.round(performance.now() - state.metrics.bootAt);
			window.addEventListener("hashchange", route);
			window.addEventListener("popstate", route);
			refs.root.addEventListener("click", handleInternalRouteClick);
			if (!window.location.hash) {
				window.history.replaceState(null, "", "#dashboard");
			}
			route();
		}).catch(function (error) {
			refs.content.innerHTML = renderAuthError(error);
		});
	}

	function handleInternalRouteClick(event) {
		var returnButton = event.target && event.target.closest ? event.target.closest("[data-amos-return-dashboard]") : null;
		if (returnButton && refs.root.contains(returnButton)) {
			event.preventDefault();
			deactivateAdminAppMode();
			if (window.location.hash !== "#dashboard") {
				window.history.pushState(null, "", "#dashboard");
			}
			route();
			return;
		}

		var link = event.target && event.target.closest ? event.target.closest('a[href^="#"]') : null;
		if (!link || !refs.root.contains(link)) {
			return;
		}

		var nextHash = link.getAttribute("href");
		if (!nextHash || nextHash === "#") {
			return;
		}

		event.preventDefault();
		if (window.location.hash !== nextHash) {
			window.history.pushState(null, "", nextHash);
		}
		route();
	}

	function buildContext() {
		var adminAuth = Object.assign({}, config.auth || {}, {
			user: Object.assign({}, config.currentUser || {}),
			featureFlag: Object.assign({}, config.flag || {})
		});

		var api = createApiClient();
		var authSession = api.get(config.endpoints && config.endpoints.authSession, {
			cacheKey: "auth-session",
			ttl: 30000,
			allowFailure: true
		});
		var railwaySession = FEATURES.live_data ? railwayClient.exchange() : Promise.resolve(null);

		return Promise.all([authSession, railwaySession]).then(function (results) {
			var session = results[0];
			var railwayAuth = results[1];
			adminAuth.session = session || { authenticated: false, unavailable: true };
			adminAuth.sessionState = session && session.authenticated === false ? "anonymous" : "authenticated";
			adminAuth.railwaySession = railwayAuth || { authenticated: false, unavailable: FEATURES.live_data, disabled: !FEATURES.live_data };

			return {
				auth: Object.freeze(adminAuth),
				api: api,
				wpApi: wpApi,
				railway: railwayClient,
				features: FEATURES,
				cache: state.cache,
				metrics: state.metrics,
				config: config,
				modules: MODULE_META,
				sourcePackages: SOURCE_PACKAGES
			};
		});
	}

	function normalizeFeatures(features) {
		features = features || {};
		return Object.assign({}, features, {
			live_data: isTruthyFlag(features.live_data)
		});
	}

	function isTruthyFlag(value) {
		return value === true || value === 1 || value === "1" || value === "true";
	}

	function normalizeBaseUrl(url) {
		return String(url || "").replace(/\/+$/, "");
	}

	function normalizeEndpointPath(path) {
		path = String(path || "");
		if (/^https?:\/\//.test(path)) {
			return path;
		}
		return path.charAt(0) === "/" ? path : "/" + path;
	}

	function appendParams(url, params) {
		if (!params) {
			return url;
		}
		var query = Object.keys(params).filter(function (key) {
			return params[key] !== undefined && params[key] !== null && params[key] !== "";
		}).map(function (key) {
			return encodeURIComponent(key) + "=" + encodeURIComponent(params[key]);
		}).join("&");
		if (!query) {
			return url;
		}
		return url + (url.indexOf("?") === -1 ? "?" : "&") + query;
	}

	function requestJson(url, options) {
		return fetch(url, options).then(function (response) {
			return response.text().then(function (text) {
				var payload = parseJson(text);
				if (!response.ok) {
					var message = payload && (payload.message || payload.error) ? (payload.message || payload.error) : "Request failed.";
					var error = new Error(message);
					error.status = response.status;
					error.payload = payload;
					throw error;
				}
				return payload;
			});
		});
	}

	function withTimeout(promise, ms, message) {
		var timer = null;
		return new Promise(function (resolve, reject) {
			timer = window.setTimeout(function () {
				reject(new Error(message || "Request timed out."));
			}, ms || 10000);
			promise.then(function (value) {
				window.clearTimeout(timer);
				resolve(value);
			}).catch(function (error) {
				window.clearTimeout(timer);
				reject(error);
			});
		});
	}

	function createWpApiClient() {
		var auth = config.auth || {};
		var base = normalizeBaseUrl(auth.restBase || "/wp-json/mmed/v1");
		var nonce = auth.nonce || "";

		function url(endpoint, params) {
			var path = normalizeEndpointPath(endpoint);
			var resolved = /^https?:\/\//.test(path) ? path : base + path;
			return appendParams(resolved, params);
		}

		function request(endpoint, options, params) {
			options = options || {};
			options.credentials = "same-origin";
			options.headers = Object.assign({}, options.headers || {}, {
				Accept: "application/json",
				"X-WP-Nonce": nonce
			});
			return requestJson(url(endpoint, params), options);
		}

		return {
			url: url,
			request: request,
			get: function (endpoint, params) {
				return request(endpoint, { method: "GET" }, params);
			},
			post: function (endpoint, body) {
				return request(endpoint, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body || {})
				});
			},
			put: function (endpoint, body) {
				return request(endpoint, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body || {})
				});
			},
			delete: function (endpoint) {
				return request(endpoint, { method: "DELETE" });
			}
		};
	}

	function createRailwayClient() {
		var base = normalizeBaseUrl(config.railwayBase || "https://hq.missionmedinstitute.com");
		var sessionReady = null;
		var exchanged = false;
		var lastError = null;

		function exchange() {
			if (!FEATURES.live_data) {
				return Promise.resolve(null);
			}
			if (sessionReady) {
				return sessionReady;
			}
			sessionReady = requestJson(base + "/api/auth/exchange", {
				method: "POST",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json"
				},
				body: JSON.stringify({
					wp_user_id: config.user && config.user.id ? config.user.id : config.currentUser && config.currentUser.id,
					wp_nonce: config.auth && config.auth.nonce,
					wp_rest_url: config.auth && config.auth.restBase
				})
			}).then(function (payload) {
				exchanged = true;
				lastError = null;
				state.metrics.railway_auth_exchange += 1;
				return payload;
			}).catch(function (error) {
				console.warn("[AdminOS] Railway auth exchange failed:", error);
				lastError = error;
				sessionReady = null;
				return null;
			});
			return sessionReady;
		}

		function request(method, path, body, options) {
			options = options || {};
			if (!FEATURES.live_data) {
				return Promise.reject(new Error("Railway live data is disabled."));
			}

			var doFetch = function () {
				var headers = Object.assign({ Accept: "application/json" }, options.headers || {});
				var fetchOptions = {
					method: method,
					credentials: "include",
					headers: headers,
					signal: options.signal
				};
				if (body !== undefined) {
					fetchOptions.headers["Content-Type"] = "application/json";
					fetchOptions.body = JSON.stringify(body || {});
				}
				var requestUrl = /^https?:\/\//.test(path) ? path : base + normalizeEndpointPath(path);
				return requestJson(requestUrl, fetchOptions);
			};

			if (exchanged) {
				return doFetch();
			}

			return exchange().then(function (session) {
				if (!session) {
					throw new Error("No Railway session");
				}
				return doFetch();
			});
		}

		return {
			exchange: exchange,
			get: function (path, params, options) {
				return request("GET", appendParams(path, params), undefined, options);
			},
			post: function (path, body, options) {
				return request("POST", path, body, options);
			},
			patch: function (path, body, options) {
				return request("PATCH", path, body, options);
			},
			isEnabled: function () {
				return FEATURES.live_data;
			},
			isExchanged: function () {
				return exchanged;
			},
			getLastError: function () {
				return lastError;
			}
		};
	}

	function createApiClient() {
		return {
			get: function (url, options) {
				options = options || {};
				if (!url) {
					return Promise.resolve(null);
				}

				var cacheKey = options.cacheKey || url;
				var cached = state.cache.get(cacheKey);
				if (cached && cached.expiresAt > Date.now()) {
					return Promise.resolve(cached.value);
				}

				var requestKey = "GET:" + url;
				if (state.requests.has(requestKey)) {
					return state.requests.get(requestKey);
				}

				var promise = fetch(url, {
					method: "GET",
					credentials: "include",
					headers: { Accept: "application/json" },
					signal: options.signal
				}).then(function (response) {
					return response.text().then(function (text) {
						var payload = parseJson(text);
						if (!response.ok) {
							var message = payload && (payload.message || payload.error) ? (payload.message || payload.error) : "Request failed.";
							var error = new Error(message);
							error.status = response.status;
							error.payload = payload;
							throw error;
						}
						return payload;
					});
				}).then(function (payload) {
					if (options.ttl) {
						state.cache.set(cacheKey, {
							value: payload,
							expiresAt: Date.now() + options.ttl
						});
					}
					return payload;
				}).catch(function (error) {
					if (options.allowFailure) {
						return { ok: false, error: error.message || "request_failed", status: error.status || 0 };
					}
					throw error;
				}).finally(function () {
					state.requests.delete(requestKey);
				});

				state.requests.set(requestKey, promise);
				return promise;
			}
		};
	}

	function route() {
		var startedAt = performance.now();
		var target = resolveRoute();
		state.metrics.routeResolveMs = Math.round(performance.now() - startedAt);

		if (state.activeModuleId === target.id) {
			applyAdminAppMode(target.id);
			state.metrics.duplicate_mount_prevented += 1;
			return;
		}

		applyAdminAppMode(target.id);
		renderSidebar(target.id);
		renderSkeleton(target);

		if (state.activeModule && typeof state.activeModule.unmount === "function") {
			state.activeModule.unmount();
		}
		if (state.activeAbort) {
			state.activeAbort.abort();
		}

		state.activeAbort = new AbortController();
		state.activeModuleId = target.id;
		state.activeModule = target;

		loadModule(target).then(function () {
			if (state.activeModuleId !== target.id) {
				return;
			}
			var mountStartedAt = performance.now();
			target.mount(refs.content, Object.assign({}, context, {
				routeSignal: state.activeAbort.signal,
				module: target
			}));
			bindAdminAppControls(refs.content);
			state.metrics.moduleMountMs = Math.round(performance.now() - mountStartedAt);
			state.metrics.activeModule = target.id;
		}).catch(function (error) {
			state.metrics.error_state += 1;
			refs.content.innerHTML = target.errorState(target, error);
			bindRetry(target);
		});
	}

	function resolveRoute() {
		var hash = (window.location.hash || "#dashboard").replace(/^#\/?/, "");
		var module = MODULES.find(function (item) {
			return item.id === hash || item.route === "#" + hash;
		});

		if (!module) {
			state.metrics.route_unknown += 1;
			return MODULES[0];
		}

		if (!hasPermission(module)) {
			return {
				id: "locked",
				label: "Locked",
				route: "#locked",
				errorState: moduleErrorState,
				load: function () { return Promise.resolve(); },
				mount: function () {
					refs.content.innerHTML = lockedState(module);
				},
				unmount: unmountNoop
			};
		}

		return module;
	}

	function hasPermission(module) {
		if (!moduleVisible(MODULE_META[module.id])) {
			return false;
		}
		if (module.permission === "cap:manage_options") {
			return Boolean(config.auth && config.auth.canManageOptions);
		}
		return true;
	}

	function loadModule(module) {
		if (state.loaded[module.id]) {
			return Promise.resolve(state.loaded[module.id]);
		}

		if (state.inFlightLoads[module.id]) {
			return state.inFlightLoads[module.id];
		}

		var startedAt = performance.now();
		var promise = Promise.resolve()
			.then(module.load)
			.then(function (loaded) {
				state.loaded[module.id] = loaded || true;
				state.metrics.moduleLoadMs = Math.round(performance.now() - startedAt);
				return loaded;
			})
			.finally(function () {
				delete state.inFlightLoads[module.id];
			});

		state.inFlightLoads[module.id] = promise;
		return promise;
	}

	function renderSidebar(activeId) {
		activeId = activeId || (resolveRoute().id || "dashboard");

		refs.sidebar.innerHTML = [
			'<div class="amos-sidebar-inner">',
			'<a class="amos-brand" href="#dashboard" aria-label="Matrix Admin HQ dashboard">',
			'<span class="amos-brand-mark">MM</span>',
			'<span class="amos-brand-copy"><strong>' + escapeHTML(PRODUCT_NAME) + '</strong><small>Admin Engine</small></span>',
			"</a>",
			NAV_SECTIONS.map(function (section) {
				return [
					'<nav class="amos-nav-section" aria-label="' + escapeAttr(section.label) + '">',
					'<span class="amos-nav-kicker">' + escapeHTML(section.label) + "</span>",
					section.items.map(function (id) {
						var meta = MODULE_META[id];
						return meta && moduleVisible(meta) ? navItem(meta, activeId) : "";
					}).join(""),
					"</nav>"
				].join("");
			}).join(""),
			'<div class="amos-sidebar-card"><span>Runtime v2</span><p>Shell first. Active admin app only. Student Matrix runtime remains isolated.</p></div>',
			"</div>"
		].join("");
	}

	function navItem(meta, activeId) {
		var active = meta.id === activeId ? " is-active" : "";
		var badge = meta.status && meta.id !== "dashboard" && meta.status !== "Planned" ? '<span class="amos-soon">' + escapeHTML(meta.status) + "</span>" : "";
		return [
			'<a class="amos-nav-link' + active + '" href="' + escapeAttr(meta.route) + '">',
			'<span class="amos-nav-icon">' + escapeHTML(meta.icon) + "</span>",
			'<span class="amos-nav-label">' + escapeHTML(meta.label) + "</span>",
			badge,
			"</a>"
		].join("");
	}

	function renderSkeleton(module) {
		state.metrics.moduleSkeletonMs = Math.round(performance.now() - state.metrics.bootAt);
		if (ADMIN_APP_MODE_CLASS_BY_ROUTE[module.id]) {
			refs.content.innerHTML = [
				'<section class="amos-admin-app-loader" data-admin-app-route="' + escapeAttr(module.id) + '">',
				'<div class="amos-admin-loader-shell">',
				'<a class="amos-return-btn" href="' + escapeAttr(adminDashboardUrl()) + '" data-amos-return-dashboard aria-label="Return to Matrix Admin HQ">',
				'<span aria-hidden="true">&larr;</span><span>Return to Matrix Admin HQ</span>',
				"</a>",
				'<div class="amos-admin-loader-brand"><span>MM</span><strong>' + escapeHTML(PRODUCT_NAME) + " <em>" + escapeHTML(module.label) + "</em></strong></div>",
				'<div class="amos-admin-loader-track"><span></span><span></span><span></span></div>',
				'<p>Loading focused admin app mode...</p>',
				"</div>",
				"</section>"
			].join("");
			return;
		}
		refs.content.innerHTML = [
			'<section class="amos-page">',
			'<div class="amos-page-head">',
			'<span class="amos-eyebrow">' + escapeHTML(PRODUCT_NAME) + "</span>",
			'<h2>' + escapeHTML(module.label) + "</h2>",
			"</div>",
			'<div class="amos-module-skeleton" aria-label="Loading ' + escapeAttr(module.label) + '">',
			"<span></span><span></span><span></span><span></span>",
			"</div>",
			"</section>"
		].join("");
	}

	function loadDashboardModule() {
		return Promise.resolve({ id: "dashboard", mode: "command-center" });
	}

	function loadStaticModule() {
		return Promise.resolve({ id: "static" });
	}

	function mountDashboard(container, runtimeContext) {
		if (FEATURES.live_data) {
			mountLiveDashboard(container, runtimeContext);
			return;
		}
		mountWpDashboard(container, runtimeContext);
	}

	function mountWpDashboard(container, runtimeContext) {
		container.innerHTML = [
			'<section class="amos-page amos-dashboard">',
			pageHeader(PRODUCT_NAME, "Command Center", "Calendar, Scheduler, Communications, File Vault, enrollment, billing, access, and media signals are wired through same-origin WordPress admin endpoints.", "WP live"),
			'<div class="amos-command-strip">',
			overviewCard({ label: "Calendar Admin", value: "Open", note: "Matrix Calendar v4 source app", tone: "green", route: "#calendar-admin" }),
			overviewCard({ label: "Messages", value: "Open", note: "Admin/student threads", tone: "green", route: "#communications" }),
			overviewCard({ label: "Scheduler Ops", value: "Open", note: "Native scheduler runtime", tone: "green", route: "#scheduler-ops" }),
			overviewCard({ label: "Enrollments", value: "Loading", note: "Woo + LearnDash", tone: "blue", route: "#newly-enrolled" }),
			overviewCard({ label: "Welcome Emails", value: "Open", note: "360 manual/batch sender", tone: "green", route: "#welcome-emails" }),
			overviewCard({ label: "Payments", value: "Loading", note: "WooCommerce read-only", tone: "blue", route: "#payments" }),
			overviewCard({ label: "Video Library", value: "Loading", note: "R2/video manifest", tone: "blue", route: "#reports" }),
			"</div>",
			'<div class="amos-grid two">',
			'<article class="amos-card amos-hero-card">',
			'<div class="amos-card-heading"><h3>Live Operations</h3><span class="amos-pill green">WP live</span></div>',
			'<p>Core linked systems open immediately, and the legacy panels read from the same production sources admins already rely on.</p>',
			'<div class="amos-action-row">',
			'<a class="amos-btn" href="#calendar-admin">Open Calendar Admin</a>',
			'<a class="amos-btn secondary" href="#communications">Open Communications</a>',
			'<a class="amos-btn secondary" href="#scheduler-ops">Open Scheduler Ops</a>',
			"</div>",
			"</article>",
			'<article class="amos-card amos-hero-card">',
			'<div class="amos-card-heading"><h3>Operational Feeds</h3><span class="amos-pill green">Read only</span></div>',
			'<ul class="amos-queue-list">',
			queueItem("Enrollment / Course Access", "WooCommerce mapped products are cross-checked against LearnDash access.", "#course-access"),
			queueItem("Payments / Billing", "WooCommerce recent orders and exception statuses are visible without payment writes.", "#payments"),
			queueItem("Video Library", "Reports read the existing video manifest/R2 playback inventory.", "#reports"),
			queueItem("Leads", "Local prospect signals come from Woo checkout state and WordPress registrations.", "#leads"),
			"</ul>",
			"</article>",
			"</div>",
			"</section>"
		].join("");

		var todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);
		var todayEnd = new Date(todayStart.getTime() + 86400000 - 1);
		Promise.all([
			wpGetSafe("/events", { start: todayStart.toISOString(), end: todayEnd.toISOString() }, runtimeContext),
			wpGetSafe("/communications/admin/conversations", null, runtimeContext),
			wpGetSafe("/admin/hq/students", { limit: 50 }, runtimeContext),
			wpGetSafe("/notifications", { limit: 20 }, runtimeContext),
			wpGetSafe("/admin/hq/overview", null, runtimeContext)
		]).then(function (results) {
			if (runtimeContext && runtimeContext.routeSignal && runtimeContext.routeSignal.aborted) {
				return;
			}
			var events = normalizeCalendarEvents(resultItems(results[0], ["events", "items", "data"]));
			var commPayload = resultData(results[1]);
			var conversations = normalizeArray(commPayload.conversations);
			var unread = conversations.reduce(function (sum, item) {
				return sum + safeCount(firstValue(item, ["unread_count"], 0));
			}, 0);
			var students = normalizeArray(resultData(results[2]).students);
			var notifications = resultItems(results[3], ["notifications", "items", "data"]);
			var hq = resultData(results[4]);
			var hqSummary = hq.summary || {};
			var paymentSummary = getPath(hq, "payments.summary") || {};
			var enrollmentSummary = getPath(hq, "enrollments.summary") || {};
			var leadSummary = getPath(hq, "leads.summary") || {};
			var overview = [
				{ label: "Today's appointments", value: events.length, note: "WP Matrix calendar events", tone: "green", route: "#calendar-admin" },
				{ label: "Pending follow-ups", value: notifications.length, note: "WP notifications", tone: "blue", route: "#alerts" },
				{ label: "Student records", value: students.length, note: "Searchable admin recipients", tone: "green", route: "#student-management" },
				{ label: "Messages", value: conversations.length, note: unread + " unread", tone: unread ? "gold" : "green", route: "#communications" },
				{ label: "New enrollments", value: formatCount(enrollmentSummary.recent_enrollments || hqSummary.recent_enrollments || 0), note: formatCount(enrollmentSummary.access_reviews || hqSummary.access_reviews || 0) + " access reviews", tone: (enrollmentSummary.access_reviews || hqSummary.access_reviews) ? "gold" : "green", route: "#newly-enrolled" },
				{ label: "Welcome Emails", value: "Open", note: "360 manual/batch sender", tone: "green", route: "#welcome-emails" },
				{ label: "Billing alerts", value: formatCount(paymentSummary.exceptions || hqSummary.payment_exceptions || 0), note: formatMoney(paymentSummary.captured_revenue || 0) + " recent captured", tone: (paymentSummary.exceptions || hqSummary.payment_exceptions) ? "gold" : "green", route: "#payments" },
				{ label: "Lead signals", value: formatCount(leadSummary.total || hqSummary.lead_signals || 0), note: "Woo checkout + WP registrations", tone: "blue", route: "#leads" },
				{ label: "Video assets", value: formatCount(hqSummary.video_assets || 0), note: "R2/video manifest", tone: "blue", route: "#reports" }
			];
			var groups = [
				{
					title: "Student Operations",
					copy: "Student lookup, recent enrollments, billing review, and access checks are wired through WordPress, WooCommerce, and LearnDash.",
					items: ["student-management", "newly-enrolled", "welcome-emails", "leads", "enrollment-status", "payments", "course-access"]
				},
				{
					title: "Scheduling Operations",
					copy: "Scheduler Ops and Calendar Admin are live Matrix-owned admin surfaces.",
					items: ["scheduler-ops", "calendar-admin", "alerts"]
				},
				{
					title: "Communications",
					copy: "Admin-to-student messages are live through the MissionMed communications REST engine.",
					items: ["communications"]
				},
				{
					title: "Program Operations",
					copy: "Mission Residency, Exam Prep, USCE / Clinicals, USCE Offers, and Arena / STAT oversight are hydrated from their approved read models.",
					items: ["mission-residency", "exam-prep", "usce-clinicals", "usce-offers", "arena-stat"]
				},
				{
					title: "Review / Audit",
					copy: "Reports, access audit, system health, source packages, and video inventory are read-only operational views.",
					items: ["audit-logs", "reports", "system-health", "source-packages"]
				}
			];

			container.innerHTML = [
				'<section class="amos-page amos-dashboard">',
				pageHeader(PRODUCT_NAME, "Command Center", "Live WordPress admin signals are active for calendar, students, communications, enrollments, billing, access, and media. Railway live-data remains off until DNS/API is clean.", "WP live"),
				renderEndpointIssues(results),
				'<div class="amos-command-strip">',
				overview.map(function (item) {
					return overviewCard(item);
				}).join(""),
				"</div>",
				'<div class="amos-grid two">',
				'<article class="amos-card amos-hero-card">',
				'<div class="amos-card-heading"><h3>Live Operations</h3><span class="amos-pill green">WP live</span></div>',
				'<p>Calendar Admin, Scheduler Ops, Communications, File Vault, and the broader legacy panels now use active production sources instead of placeholder shells.</p>',
				'<div class="amos-action-row">',
				'<a class="amos-btn" href="#calendar-admin">Open Calendar Admin</a>',
				'<a class="amos-btn secondary" href="#communications">Open Communications</a>',
				'<a class="amos-btn secondary" href="#scheduler-ops">Open Scheduler Ops</a>',
				"</div>",
				'<div class="amos-mini-grid">',
				miniStat("Runtime", "Admin app mode", "Native"),
				miniStat("Auth", authLabel(runtimeContext), "WP"),
				miniStat("Railway", "Live-data flag", FEATURES.live_data ? "ON" : "OFF"),
				"</div>",
				"</article>",
				'<article class="amos-card amos-hero-card">',
				'<div class="amos-card-heading"><h3>Legacy Feeds</h3><span class="amos-pill green">WP live</span></div>',
				'<ul class="amos-queue-list">',
				queueItem("Enrollment / Course Access", "WooCommerce mapped products are checked against LearnDash access.", "#course-access"),
				queueItem("Payments / Billing", "WooCommerce orders are visible read-only; no Stripe or payment writes happen here.", "#payments"),
				queueItem("Video Library", "Reports read the existing video manifest/R2 playback inventory.", "#reports"),
				queueItem("Leads", "Local prospect signals are visible; dedicated CRM source still not claimed.", "#leads"),
				"</ul>",
				"</article>",
				"</div>",
				'<div class="amos-section-grid">',
				groups.map(groupCard).join(""),
				"</div>",
				"</section>"
			].join("");
			state.metrics.moduleUsableMs = Math.round(performance.now() - state.metrics.bootAt);
		}).catch(function (error) {
			container.innerHTML = renderLiveException("Dashboard", error);
		});
	}

	function mountWpDailyCommand(container, runtimeContext, meta) {
		meta = meta || (runtimeContext && runtimeContext.module) || MODULE_META["daily-command"];
		container.innerHTML = adminAppShell(meta, {
			kicker: "Command",
			title: "Daily Command",
			copy: "One-day operating view for calendar, notifications, student access, and message follow-up.",
			source: "mmed/v1/events + communications + notifications",
			modifier: "legacy",
			modeBadge: "WP live",
			modeBadgeTone: "green",
			statusNote: "Feature flag live-data can stay OFF. This route reads existing WordPress admin REST endpoints.",
			body: '<div class="amos-live-body" data-amos-wp-daily-root>' + renderWpLoading("Daily Command") + "</div>"
		});

		var todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);
		var todayEnd = new Date(todayStart.getTime() + 86400000 - 1);

		Promise.all([
			wpGetSafe("/events", { start: todayStart.toISOString(), end: todayEnd.toISOString() }, runtimeContext),
			wpGetSafe("/communications/admin/conversations", null, runtimeContext),
			wpGetSafe("/admin/hq/students", { limit: 25 }, runtimeContext),
			wpGetSafe("/notifications", { limit: 25 }, runtimeContext),
			wpGetSafe("/admin/hq/payments", { limit: 40 }, runtimeContext),
			wpGetSafe("/admin/hq/enrollments", { limit: 40 }, runtimeContext)
		]).then(function (results) {
			if (runtimeContext && runtimeContext.routeSignal && runtimeContext.routeSignal.aborted) {
				return;
			}
			var root = container.querySelector("[data-amos-wp-daily-root]");
			if (!root) {
				return;
			}
			var events = normalizeCalendarEvents(resultItems(results[0], ["events", "items", "data"]));
			var conversations = normalizeArray(resultData(results[1]).conversations);
			var students = normalizeArray(resultData(results[2]).students);
			var notifications = resultItems(results[3], ["notifications", "items", "data"]);
			var paymentData = resultData(results[4]);
			var enrollmentData = resultData(results[5]);
			var paymentExceptions = normalizeArray(paymentData.exceptions);
			var enrollmentReviews = normalizeArray(enrollmentData.access_reviews);
			var unread = conversations.reduce(function (sum, item) {
				return sum + safeCount(firstValue(item, ["unread_count"], 0));
			}, 0);
				var cards = [
					{ label: "Today's calendar", value: events.length, note: "events loaded", tone: "green" },
					{ label: "Unread messages", value: unread, note: conversations.length + " conversations", tone: unread ? "gold" : "green" },
					{ label: "Notifications", value: notifications.length, note: "admin-visible", tone: "blue" },
					{ label: "Students", value: students.length, note: "WP/LearnDash sample", tone: "green" },
					{ label: "Billing alerts", value: paymentExceptions.length, note: "WooCommerce exceptions", tone: paymentExceptions.length ? "gold" : "green" },
					{ label: "Access reviews", value: enrollmentReviews.length, note: "Woo + LearnDash", tone: enrollmentReviews.length ? "gold" : "green" }
				];

			root.innerHTML = [
				renderEndpointIssues(results),
				renderLiveCards(cards),
				'<div class="amos-grid two">',
				livePanel("Today\'s Appointments", renderSimpleList(events.slice(0, 8), function (event) {
					return [
						firstValue(event, ["title", "summary"], "Calendar event"),
						formatDateTime(firstValue(event, ["start", "start_at", "starts_at"], "")),
						firstValue(event, ["type", "category", "platform"], "Calendar")
					];
				}, "No appointments are loaded for today.")),
				livePanel("Messages Needing Review", renderSimpleList(conversations.filter(function (item) {
					return safeCount(firstValue(item, ["unread_count"], 0)) > 0;
				}).slice(0, 8), conversationSummaryRow, "No unread message threads.")),
				livePanel("Follow-Ups / Notifications", renderSimpleList(notifications.slice(0, 8), notificationRow, "No notifications returned.")),
				livePanel("Billing Alerts", renderSimpleList(paymentExceptions.slice(0, 8), paymentExceptionSummary, "No WooCommerce billing exceptions in the current sample.")),
				livePanel("New Enrollment Access Reviews", renderSimpleList(enrollmentReviews.slice(0, 8), enrollmentReviewSummary, "No mapped enrollment access gaps in the current sample.")),
				"</div>"
			].join("");
			state.metrics.moduleUsableMs = Math.round(performance.now() - state.metrics.bootAt);
		}).catch(function (error) {
			var root = container.querySelector("[data-amos-wp-daily-root]");
			if (root) {
				root.innerHTML = renderLiveException(meta.label, error);
			}
		});
	}

	function mountWpAlerts(container, runtimeContext, meta) {
		meta = meta || (runtimeContext && runtimeContext.module) || MODULE_META.alerts;
		container.innerHTML = adminAppShell(meta, {
			kicker: "Command",
			title: "Alerts / Tasks",
			copy: "Admin alert center for WordPress notifications and communications follow-up.",
			source: "mmed/v1/notifications + communications/admin/conversations",
			modifier: "legacy",
			modeBadge: "WP live",
			modeBadgeTone: "green",
			statusNote: "Read-only alert review is live. Task writes stay disabled until the task source is approved.",
			body: '<div class="amos-live-body" data-amos-wp-alerts-root>' + renderWpLoading("Alerts / Tasks") + "</div>"
		});

		Promise.all([
			wpGetSafe("/notifications", { limit: 50 }, runtimeContext),
			wpGetSafe("/communications/admin/conversations", null, runtimeContext),
			wpGetSafe("/events", { start: new Date().toISOString() }, runtimeContext)
		]).then(function (results) {
			if (runtimeContext && runtimeContext.routeSignal && runtimeContext.routeSignal.aborted) {
				return;
			}
			var root = container.querySelector("[data-amos-wp-alerts-root]");
			if (!root) {
				return;
			}
			var notifications = resultItems(results[0], ["notifications", "items", "data"]);
			var conversations = normalizeArray(resultData(results[1]).conversations);
			var unreadConversations = conversations.filter(function (item) {
				return safeCount(firstValue(item, ["unread_count"], 0)) > 0;
			});
			var upcomingEvents = normalizeCalendarEvents(resultItems(results[2], ["events", "items", "data"]));
			var cards = [
				{ label: "Notifications", value: notifications.length, note: "available now", tone: "blue" },
				{ label: "Unread threads", value: unreadConversations.length, note: "communications", tone: unreadConversations.length ? "gold" : "green" },
				{ label: "Upcoming events", value: upcomingEvents.length, note: "calendar", tone: "green" },
				{ label: "Task writes", value: "Off", note: "source contract needed", tone: "blue" }
			];

			root.innerHTML = [
				renderEndpointIssues(results),
				renderLiveCards(cards),
				'<div class="amos-grid two">',
				livePanel("Priority Alerts", renderSimpleList(notifications.slice(0, 12), notificationRow, "No notification alerts returned.")),
				livePanel("Unread Message Threads", renderSimpleList(unreadConversations.slice(0, 12), conversationSummaryRow, "No unread message threads.")),
				livePanel("Calendar Follow-Up", renderSimpleList(upcomingEvents.slice(0, 8), function (event) {
					return [
						firstValue(event, ["title", "summary"], "Calendar event"),
						formatDateTime(firstValue(event, ["start", "start_at", "starts_at"], "")),
						firstValue(event, ["type", "category", "platform"], "Calendar")
					];
				}, "No upcoming calendar follow-up events returned.")),
				livePanel("Controlled Write Policy", '<div class="amos-route-list">' +
					routeRow("Message replies", "Use Communications for real admin/student replies.") +
					routeRow("Calendar changes", "Use Calendar Admin for event create/update/delete.") +
					routeRow("Task completion", "Disabled until task source and permissions are source-locked.") +
					"</div>"),
				"</div>"
			].join("");
			state.metrics.moduleUsableMs = Math.round(performance.now() - state.metrics.bootAt);
		}).catch(function (error) {
			var root = container.querySelector("[data-amos-wp-alerts-root]");
			if (root) {
				root.innerHTML = renderLiveException(meta.label, error);
			}
		});
	}

	function mountWpStudentManagement(container, runtimeContext, meta) {
		meta = meta || (runtimeContext && runtimeContext.module) || MODULE_META["student-management"];
		container.innerHTML = adminAppShell(meta, {
			kicker: "Students",
			title: "Student Management",
				copy: "Searchable student directory for admin communications and support triage.",
				source: "mmed/v1/admin/hq/students",
			modifier: "legacy",
			modeBadge: "WP live",
			modeBadgeTone: "green",
			statusNote: "This is a live read surface. Profile/payment/enrollment writes remain disabled until their sources are approved.",
			body: '<div class="amos-live-body" data-amos-wp-students-root>' + renderWpLoading("Student Management") + "</div>"
		});

		loadWpStudentDirectory(container, runtimeContext, "");
	}

	function loadWpStudentDirectory(container, runtimeContext, search) {
		var root = container.querySelector("[data-amos-wp-students-root]");
		if (!root) {
			return;
		}
		root.innerHTML = renderWpLoading("Student Management");
			wpGetSafe("/admin/hq/students", { search: search || "", limit: 50 }, runtimeContext).then(function (result) {
			if (runtimeContext && runtimeContext.routeSignal && runtimeContext.routeSignal.aborted) {
				return;
			}
			var students = normalizeArray(resultData(result).students);
			root.innerHTML = [
				renderEndpointIssues([result]),
				renderLiveCards([
						{ label: "Students found", value: students.length, note: search ? "filtered" : "latest directory sample", tone: "green" },
						{ label: "Search", value: search ? "Active" : "Ready", note: "server-scoped", tone: "blue" },
						{ label: "Course access", value: formatCount(students.reduce(function (sum, student) { return sum + safeCount(student.course_count); }, 0)), note: "LearnDash courses sampled", tone: "green" },
						{ label: "Vault files", value: formatCount(students.reduce(function (sum, student) { return sum + safeCount(getPath(student, "file_counts.total")); }, 0)), note: "File Vault counts", tone: "blue" }
				]),
				'<div class="amos-grid two">',
				'<section class="amos-app-card">',
				'<div class="amos-card-heading"><h3>Student Lookup</h3><span class="amos-pill green">Live</span></div>',
				'<form class="amos-live-form" data-amos-student-search-form>',
				'<div class="amos-form-grid">',
				'<label><span>Search name or email</span><input type="search" name="search" value="' + escapeAttr(search || "") + '" placeholder="student@example.com"></label>',
				"</div>",
				'<div class="amos-action-row">',
				'<button class="amos-inline-btn" type="submit">Search</button>',
				'<button class="amos-inline-btn secondary" type="button" data-amos-student-search-clear>Clear</button>',
				'<a class="amos-inline-btn secondary" href="#communications">Open Communications</a>',
				"</div>",
				"</form>",
				'<div class="amos-comm-student-results">' + renderStudentDirectoryRows(students) + "</div>",
				"</section>",
					livePanel("Support Context", '<div class="amos-route-list">' +
						routeRow("Messaging", "Use Communications to send/reply as Dr. Brian or Dr. J.") +
						routeRow("Program ownership", "Read from LearnDash course access and WooCommerce order signals.") +
						routeRow("Enrollment/access", "Use Course Access for product-to-course review.") +
						routeRow("Payments", "Use Payments / Billing for WooCommerce order detail.") +
						"</div>"),
				"</div>"
			].join("");
			bindWpStudentDirectory(container, runtimeContext);
			state.metrics.moduleUsableMs = Math.round(performance.now() - state.metrics.bootAt);
		}).catch(function (error) {
			root.innerHTML = renderLiveException("Student Management", error);
		});
	}

	function bindWpStudentDirectory(container, runtimeContext) {
		var form = container.querySelector("[data-amos-student-search-form]");
		if (form) {
			form.addEventListener("submit", function (event) {
				event.preventDefault();
				var search = getField(form, "search");
				loadWpStudentDirectory(container, runtimeContext, search);
			});
		}
		var clear = container.querySelector("[data-amos-student-search-clear]");
		if (clear) {
			clear.addEventListener("click", function () {
				loadWpStudentDirectory(container, runtimeContext, "");
			});
		}
		container.querySelectorAll("[data-amos-student-message]").forEach(function (button) {
			button.addEventListener("click", function () {
				var name = button.getAttribute("data-student-name") || "student";
				showToast("Opening Communications for " + name + ".");
				window.location.hash = "#communications";
			});
		});
	}

	function renderStudentDirectoryRows(students) {
		if (!students.length) {
			return '<div class="amos-empty">No students were returned for this search.</div>';
		}
			return students.map(function (student) {
				var name = firstValue(student, ["display_name", "name", "student_name", "full_name"], "Student");
				var email = firstValue(student, ["email", "user_email"], "No email");
				var id = firstValue(student, ["id", "user_id", "student_id"], "");
				var program = firstValue(student, ["program", "latest_order_item"], "Unassigned");
				var courses = safeCount(firstValue(student, ["course_count"], 0));
				var vault = safeCount(getPath(student, "file_counts.total"));
				return [
					'<article class="amos-comm-student">',
					"<strong>" + escapeHTML(name) + "</strong>",
					"<span>" + escapeHTML(email) + (id ? " · ID " + escapeHTML(id) : "") + "</span>",
					"<span>" + escapeHTML(program) + " / " + escapeHTML(courses) + " courses / " + escapeHTML(vault) + " vault files</span>",
					'<button class="amos-inline-btn secondary" type="button" data-amos-student-message data-student-name="' + escapeAttr(name) + '">Message</button>',
					"</article>"
				].join("");
		}).join("");
	}

	function notificationRow(item) {
		return [
			firstValue(item, ["title", "label", "message", "text"], "Notification"),
			firstValue(item, ["message", "description", "body", "type"], "Admin alert"),
			formatDateTime(firstValue(item, ["created_at", "date", "time", "updated_at"], ""))
		];
	}

	function conversationSummaryRow(item) {
		var unread = safeCount(firstValue(item, ["unread_count"], 0));
		return [
			firstValue(item, ["student.display_name", "student.name"], "Student"),
			firstValue(item, ["last_message_preview", "subject"], "No message preview"),
			firstValue(item, ["mentor_label"], "Mentor") + (unread ? " / " + unread + " unread" : "")
		];
	}

	function renderWpLoading(label) {
		return '<div class="amos-card amos-live-loading"><span></span><strong>Loading ' + escapeHTML(label) + "</strong><small>WordPress REST</small></div>";
	}

		function mountSchedulerOps(container, runtimeContext, meta) {
			meta = meta || (runtimeContext && runtimeContext.module) || MODULE_META["scheduler-ops"];
			mountMatrixOwnedHtmlApp(container, runtimeContext, meta, {
				kind: "scheduler-admin",
				kicker: "Scheduling",
				title: "Scheduler Ops",
				modifier: "scheduler",
				modeBadge: "Admin scheduler source",
				source: canonicalDemoUrl(CANONICAL_DEMO_PATHS.scheduler)
			});
			state.metrics.moduleUsableMs = Math.round(performance.now() - state.metrics.bootAt);
		}

			function mountAdminCalendarApp(container, runtimeContext, meta) {
				meta = meta || (runtimeContext && runtimeContext.module) || MODULE_META["calendar-admin"];
				container.innerHTML = matrixOwnedRuntimeShell(meta, {
					kicker: "Scheduling",
					title: "Calendar Admin",
					modifier: "calendar",
					modeBadge: "Student Calendar v4 runtime",
					modeBadgeTone: "green",
					source: "student-os-calendar-v4.js",
					statusNote: "Uses the same Matrix Calendar runtime and WordPress event/todo APIs as the student dashboard.",
					body: [
						'<div class="amos-student-calendar-bridge" data-amos-admin-calendar-root>',
						'<div id="sos-content" class="sos-content amos-student-calendar-host">',
						'<div class="amos-native-boot">',
						'<span>Loading Calendar v4</span>',
						'<strong>Connecting Matrix Calendar runtime</strong>',
						'<i></i>',
						"</div>",
						"</div>",
						"</div>"
					].join("")
				});
				mountAdminCalendarRuntime(container, runtimeContext);
				state.metrics.moduleUsableMs = Math.round(performance.now() - state.metrics.bootAt);
			}

		function mountAdminFileVaultApp(container, runtimeContext, meta) {
			meta = meta || (runtimeContext && runtimeContext.module) || MODULE_META["file-vault-admin"];
			container.innerHTML = matrixOwnedRuntimeShell(meta, {
				kicker: "Documents",
				title: "File Vault Admin",
				modifier: "file-vault",
				modeBadge: "WP + R2 live",
				modeBadgeTone: "green",
				source: "mmed/v1/admin/file-vault",
				statusNote: "Admins browse each student's dedicated vault tree and share files through the same student-facing File Vault storage.",
				body: '<div class="amos-native-html-host amos-file-vault-live-host" data-amos-admin-file-vault-root>' + renderWpLoading("File Vault Admin") + "</div>"
			});
			loadAdminFileVaultApp(container, runtimeContext);
			state.metrics.moduleUsableMs = Math.round(performance.now() - state.metrics.bootAt);
		}

	function mountAdminCommunicationsApp(container, runtimeContext, meta) {
		meta = meta || (runtimeContext && runtimeContext.module) || MODULE_META.communications;
		container.innerHTML = matrixOwnedRuntimeShell(meta, {
			kicker: "Administration",
			title: "Communications",
			modifier: "communications",
			modeBadge: "WP messages live",
			modeBadgeTone: "green",
			source: "mmed/v1/communications/admin",
			body: '<div class="amos-native-html-host amos-communications-live-host" data-amos-admin-communications-root>' + renderWpLoading("Communications") + "</div>"
		});
		loadAdminCommunicationsApp(container, runtimeContext);
		state.metrics.moduleUsableMs = Math.round(performance.now() - state.metrics.bootAt);
	}

		function mountAdminStoryForgeApp(container, runtimeContext, meta) {
			meta = meta || (runtimeContext && runtimeContext.module) || MODULE_META["storyforge-admin"];
			mountMatrixOwnedHtmlApp(container, runtimeContext, meta, {
				kind: "storyforge-advisor",
				kicker: "Advising",
				title: "StoryForge Admin",
				modifier: "storyforge",
				modeBadge: "Matrix-owned source",
				source: canonicalDemoUrl(CANONICAL_DEMO_PATHS.storyForge)
			});
			state.metrics.moduleUsableMs = Math.round(performance.now() - state.metrics.bootAt);
		}

	function loadAdminCalendarApp(container, runtimeContext) {
		var root = container.querySelector("[data-amos-admin-calendar-root]");
		if (!root) {
			return;
		}
		var range = calendarRange(new Date());
		Promise.all([
			wpGetSafe("/events", { start: range.start, end: range.end }, runtimeContext),
			wpGetSafe("/calendar/categories", null, runtimeContext)
		]).then(function (results) {
			if (runtimeContext && runtimeContext.routeSignal && runtimeContext.routeSignal.aborted) {
				return;
			}
			var eventsResult = results[0];
			var categoriesResult = results[1];
			var events = normalizeCalendarEvents(resultItems(eventsResult, ["events", "items", "data"]));
			var categories = resultData(categoriesResult).categories || {};
			root.innerHTML = renderAdminCalendar(events, categories, results);
			bindAdminCalendarControls(root, runtimeContext, categories);
		}).catch(function (error) {
			root.innerHTML = renderLiveException("Calendar Admin", error);
		});
	}

	function calendarRange(date) {
		var base = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
		var start = new Date(base.getFullYear(), base.getMonth() - 2, 1, 0, 0, 0);
		var end = new Date(base.getFullYear(), base.getMonth() + 4, 0, 23, 59, 59);
		return {
			start: start.toISOString(),
			end: end.toISOString()
		};
	}

	function normalizeCalendarEvents(items) {
		return normalizeArray(items).filter(function (event) {
			return event && typeof event === "object";
		}).sort(function (a, b) {
			return dateValue(firstValue(a, ["start_at", "start", "date"], "")) - dateValue(firstValue(b, ["start_at", "start", "date"], ""));
		});
	}

	function renderAdminCalendar(events, categories, results) {
		var upcoming = events.filter(function (event) {
			return dateValue(firstValue(event, ["start_at", "start"], "")) >= Date.now() - 86400000;
		});
		return [
			'<div class="amos-wp-calendar">',
			renderEndpointIssues(results),
			renderLiveCards([
				{ label: "Events Loaded", value: events.length, note: "WP Matrix calendar", tone: "green" },
				{ label: "Upcoming", value: upcoming.length, note: "Active events in range", tone: "blue" },
				{ label: "Admin CRUD", value: "Ready", note: "Create, update, delete", tone: "gold" }
			]),
			'<div class="amos-live-layout amos-calendar-live-layout">',
			'<section class="amos-app-card amos-calendar-editor">',
			'<div class="amos-card-heading"><h3>Event Editor</h3><span class="amos-pill green">Live WP</span></div>',
			renderCalendarForm(categories),
			"</section>",
			'<section class="amos-app-card amos-calendar-event-list">',
			'<div class="amos-card-heading"><h3>Calendar Events</h3><span class="amos-pill blue">' + escapeHTML(events.length) + " loaded</span></div>",
			'<div class="amos-live-toolbar"><label><span>Filter</span><input type="search" data-amos-calendar-filter placeholder="Search title, type, category"></label><button type="button" class="amos-inline-btn secondary" data-amos-calendar-refresh>Refresh</button></div>',
			'<div data-amos-calendar-events>' + renderCalendarEventRows(events, categories) + "</div>",
			"</section>",
			"</div>",
			"</div>"
		].join("");
	}

	function renderCalendarForm(categories) {
		var now = new Date();
		now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
		var end = new Date(now.getTime() + 60 * 60000);
		return [
			'<form class="amos-live-form amos-calendar-form" data-amos-calendar-form>',
			'<input type="hidden" data-amos-calendar-id>',
			'<label><span>Title</span><input type="text" data-amos-calendar-title required placeholder="Session, deadline, office hours"></label>',
			'<div class="amos-form-grid">',
			'<label><span>Start</span><input type="datetime-local" data-amos-calendar-start required value="' + escapeAttr(toDatetimeLocal(now)) + '"></label>',
			'<label><span>End</span><input type="datetime-local" data-amos-calendar-end value="' + escapeAttr(toDatetimeLocal(end)) + '"></label>',
			"</div>",
			'<div class="amos-form-grid">',
			'<label><span>Type</span><select data-amos-calendar-type>' + calendarTypeOptions("general") + "</select></label>",
			'<label><span>Category</span><select data-amos-calendar-category>' + calendarCategoryOptions(categories, "general") + "</select></label>",
			"</div>",
			'<label><span>Audience</span><select data-amos-calendar-audience><option value="all_students">All students</option><option value="admin_only">Admin only</option></select></label>',
			'<div class="amos-form-grid">',
			'<label><span>Meeting Platform</span><select data-amos-calendar-platform><option value="">None</option><option value="webex">Webex</option><option value="zoom">Zoom</option><option value="google_meet">Google Meet</option><option value="teams">Teams</option></select></label>',
			'<label><span>Meeting URL</span><input type="url" data-amos-calendar-meeting placeholder="https://"></label>',
			"</div>",
			'<label><span>Description</span><textarea data-amos-calendar-description rows="4" placeholder="Notes for this event"></textarea></label>',
			'<div class="amos-inline-actions">',
			'<button type="submit" class="amos-inline-btn">Save Event</button>',
			'<button type="button" class="amos-inline-btn secondary" data-amos-calendar-clear>New Event</button>',
			'<button type="button" class="amos-inline-btn danger" data-amos-calendar-delete disabled>Delete Event</button>',
			"</div>",
			"</form>"
		].join("");
	}

	function calendarTypeOptions(selected) {
		var types = ["general", "appointment", "office_hours", "study_block", "deadline", "milestone", "exam", "interview", "drill_step1", "drill_step23", "mr_session", "mock_interview", "nrmp_date", "rotation", "arena_event", "custom"];
		return types.map(function (type) {
			return '<option value="' + escapeAttr(type) + '"' + (type === selected ? " selected" : "") + ">" + escapeHTML(titleize(type)) + "</option>";
		}).join("");
	}

	function calendarCategoryOptions(categories, selected) {
		var keys = Object.keys(categories || {});
		if (!keys.length) {
			keys = ["general", "appointment", "office_hours", "study_block", "deadline", "custom"];
		}
		return keys.map(function (key) {
			var item = categories[key] || {};
			return '<option value="' + escapeAttr(key) + '"' + (key === selected ? " selected" : "") + ">" + escapeHTML(item.label || titleize(key)) + "</option>";
		}).join("");
	}

	function renderCalendarEventRows(events, categories) {
		if (!events.length) {
			return '<div class="amos-empty">No calendar events returned. Create one from the editor.</div>';
		}
		return [
			'<div class="amos-live-list amos-calendar-events-list">',
			events.map(function (event) {
				var id = firstValue(event, ["id"], "");
				var category = firstValue(event, ["category"], "general");
				var categoryLabel = categories && categories[category] ? categories[category].label : titleize(category);
				return [
					'<button type="button" class="amos-calendar-event-row" data-amos-calendar-event-id="' + escapeAttr(id) + '" data-amos-calendar-event="' + escapeAttr(JSON.stringify(event)) + '">',
					'<strong>' + escapeHTML(firstValue(event, ["title"], "Untitled event")) + "</strong>",
					'<span>' + escapeHTML(formatDateTime(firstValue(event, ["start_at"], ""))) + " - " + escapeHTML(formatDateTime(firstValue(event, ["end_at"], ""))) + "</span>",
					'<em>' + escapeHTML(titleize(firstValue(event, ["event_type"], "general"))) + " / " + escapeHTML(categoryLabel) + "</em>",
					"</button>"
				].join("");
			}).join(""),
			"</div>"
		].join("");
	}

	function bindAdminCalendarControls(root, runtimeContext, categories) {
		var form = root.querySelector("[data-amos-calendar-form]");
		var rows = root.querySelector("[data-amos-calendar-events]");
		var filter = root.querySelector("[data-amos-calendar-filter]");
		var clearButton = root.querySelector("[data-amos-calendar-clear]");
		var deleteButton = root.querySelector("[data-amos-calendar-delete]");
		var refreshButton = root.querySelector("[data-amos-calendar-refresh]");
		var events = Array.prototype.map.call(root.querySelectorAll("[data-amos-calendar-event]"), function (row) {
			return parseJson(row.getAttribute("data-amos-calendar-event") || "{}") || {};
		});

		function refresh() {
			loadAdminCalendarApp(root.closest("[data-admin-app-route]") || document, runtimeContext);
		}

		function fill(event) {
			if (!form || !event) {
				return;
			}
			setField(form, "calendar-id", firstValue(event, ["id"], ""));
			setField(form, "calendar-title", firstValue(event, ["title"], ""));
			setField(form, "calendar-start", toDatetimeLocal(firstValue(event, ["start_at"], "")));
			setField(form, "calendar-end", toDatetimeLocal(firstValue(event, ["end_at"], "")));
			setField(form, "calendar-type", firstValue(event, ["event_type"], "general"));
			setField(form, "calendar-category", firstValue(event, ["category"], "general"));
			setField(form, "calendar-audience", safeCount(firstValue(event, ["user_id"], 0)) === 0 ? "all_students" : "admin_only");
			setField(form, "calendar-platform", firstValue(event, ["meeting_platform"], ""));
			setField(form, "calendar-meeting", firstValue(event, ["meeting_url"], ""));
			setField(form, "calendar-description", firstValue(event, ["description"], ""));
			if (deleteButton) {
				deleteButton.disabled = !firstValue(event, ["id"], "");
			}
		}

		function clear() {
			if (form) {
				form.reset();
				setField(form, "calendar-id", "");
			}
			if (deleteButton) {
				deleteButton.disabled = true;
			}
		}

		if (rows) {
			rows.addEventListener("click", function (event) {
				var row = event.target && event.target.closest ? event.target.closest("[data-amos-calendar-event]") : null;
				if (!row) {
					return;
				}
				fill(parseJson(row.getAttribute("data-amos-calendar-event") || "{}") || {});
			});
		}

		if (filter && rows) {
			filter.addEventListener("input", function () {
				var query = filter.value.trim().toLowerCase();
				var filtered = !query ? events : events.filter(function (event) {
					return JSON.stringify(event).toLowerCase().indexOf(query) !== -1;
				});
				rows.innerHTML = renderCalendarEventRows(filtered, categories);
			});
		}

		if (clearButton) {
			clearButton.addEventListener("click", clear);
		}
		if (refreshButton) {
			refreshButton.addEventListener("click", refresh);
		}
		if (deleteButton) {
			deleteButton.addEventListener("click", function () {
				var id = getField(form, "calendar-id");
				if (!id || !window.confirm("Delete this calendar event?")) {
					return;
				}
				deleteButton.disabled = true;
				wpDeleteSafe("/events/" + encodeURIComponent(id), runtimeContext).then(function (result) {
					showToast(result.ok ? "Calendar event deleted." : errorSummary(result));
					refresh();
				});
			});
		}
		if (form) {
			form.addEventListener("submit", function (event) {
				event.preventDefault();
				var id = getField(form, "calendar-id");
				var payload = {
					title: getField(form, "calendar-title"),
					start_at: getField(form, "calendar-start"),
					end_at: getField(form, "calendar-end"),
					event_type: getField(form, "calendar-type") || "general",
					category: getField(form, "calendar-category") || "general",
					audience: getField(form, "calendar-audience") || "all_students",
					meeting_platform: getField(form, "calendar-platform"),
					meeting_url: getField(form, "calendar-meeting"),
					description: getField(form, "calendar-description"),
					source: "admin"
				};
				var request = id ? wpPutSafe("/events/" + encodeURIComponent(id), payload, runtimeContext) : wpPostSafe("/events", payload, runtimeContext);
				request.then(function (result) {
					showToast(result.ok ? "Calendar event saved." : errorSummary(result));
					if (result.ok) {
						refresh();
					}
				});
			});
		}
	}

	function loadAdminFileVaultApp(container, runtimeContext) {
		var root = container.querySelector("[data-amos-admin-file-vault-root]");
		if (!root) {
			return;
		}
		root.innerHTML = renderWpLoading("File Vault Admin");
		wpGetSafe("/admin/file-vault/students", { limit: 40 }, runtimeContext).then(function (result) {
			if (runtimeContext && runtimeContext.routeSignal && runtimeContext.routeSignal.aborted) {
				return;
			}
			var data = resultData(result);
			var students = normalizeArray(data.students);
			root.innerHTML = renderAdminFileVault(students, result);
			bindAdminFileVaultControls(root, runtimeContext);
			if (students.length) {
				loadAdminFileVaultStudent(root, runtimeContext, students[0].id);
			}
		}).catch(function (error) {
			root.innerHTML = renderLiveException("File Vault Admin", error);
		});
	}

	function loadAdminFileVaultStudents(root, runtimeContext, query) {
		var list = root.querySelector("[data-amos-vault-students]");
		if (list) {
			list.innerHTML = '<div class="amos-empty">Searching students...</div>';
		}
		wpGetSafe("/admin/file-vault/students", { search: query || "", limit: 60 }, runtimeContext).then(function (result) {
			var data = resultData(result);
			var students = normalizeArray(data.students);
			if (list) {
				list.innerHTML = renderFileVaultStudents(students, root.dataset.amosVaultStudent || "");
			}
			if (!root.dataset.amosVaultStudent && students.length) {
				loadAdminFileVaultStudent(root, runtimeContext, students[0].id);
			}
		});
	}

	function loadAdminFileVaultStudent(root, runtimeContext, studentId, category) {
		if (!studentId) {
			return;
		}
		root.dataset.amosVaultStudent = String(studentId);
		if (category !== undefined) {
			root.dataset.amosVaultCategory = category || "";
		}
		var selectedCategory = root.dataset.amosVaultCategory || "";
		var workspace = root.querySelector("[data-amos-vault-workspace]");
		root.querySelectorAll("[data-amos-vault-student]").forEach(function (button) {
			button.classList.toggle("is-active", button.getAttribute("data-amos-vault-student") === String(studentId));
		});
		if (workspace) {
			workspace.innerHTML = renderWpLoading("student vault");
		}
		wpGetSafe("/admin/file-vault/students/" + encodeURIComponent(studentId) + "/files", selectedCategory ? { category: selectedCategory } : null, runtimeContext).then(function (result) {
			if (runtimeContext && runtimeContext.routeSignal && runtimeContext.routeSignal.aborted) {
				return;
			}
			if (workspace) {
				workspace.innerHTML = result.ok ? renderFileVaultWorkspace(resultData(result), selectedCategory) : renderLiveUnavailable("Student File Vault", result);
			}
		});
	}

	function renderAdminFileVault(students, result) {
		var totals = students.reduce(function (memo, student) {
			var counts = student.counts || {};
			memo.files += safeCount(counts.total);
			memo.pending += safeCount(counts.pending_review);
			memo.verified += safeCount(counts.verified);
			return memo;
		}, { files: 0, pending: 0, verified: 0 });
		return [
			'<div class="amos-file-vault-live">',
			renderEndpointIssues([result]),
			renderLiveCards([
				{ label: "Student Vaults", value: students.length, note: "Dedicated R2 prefixes", tone: "green" },
				{ label: "Files", value: totals.files, note: "Visible through student folders", tone: "blue" },
				{ label: "Pending Review", value: totals.pending, note: "Needs admin decision", tone: totals.pending ? "gold" : "green" }
			]),
			'<div class="amos-file-vault-layout">',
			'<aside class="amos-vault-sidebar">',
			'<div class="amos-vault-panel">',
			'<div class="amos-vault-panel-head"><strong>Students</strong><span>' + escapeHTML(students.length) + "</span></div>",
			'<div class="amos-vault-search"><input type="search" data-amos-vault-student-search placeholder="Search name or email"><button type="button" data-amos-vault-student-search-run>Search</button></div>',
			'<div class="amos-vault-students" data-amos-vault-students>' + renderFileVaultStudents(students, students[0] && students[0].id) + "</div>",
			"</div>",
			"</aside>",
			'<section class="amos-vault-workspace" data-amos-vault-workspace>',
			'<div class="amos-empty">Select a student to open their File Vault.</div>',
			"</section>",
			"</div>",
			"</div>"
		].join("");
	}

	function renderFileVaultStudents(students, selectedId) {
		if (!students.length) {
			return '<div class="amos-empty">No students returned. Try a different search.</div>';
		}
		return students.map(function (student) {
			var counts = student.counts || {};
			var active = String(student.id) === String(selectedId) ? " is-active" : "";
			return [
				'<button class="amos-vault-student' + active + '" type="button" data-amos-vault-student="' + escapeAttr(student.id) + '">',
				"<strong>" + escapeHTML(firstValue(student, ["display_name", "name"], "Student")) + "</strong>",
				"<span>" + escapeHTML(firstValue(student, ["email"], "")) + "</span>",
				"<small>" + escapeHTML(formatCount(counts.total || 0)) + " files / " + escapeHTML(formatCount(counts.pending_review || 0)) + " pending</small>",
				"</button>"
			].join("");
		}).join("");
	}

	function renderFileVaultWorkspace(payload, selectedCategory) {
		payload = payload || {};
		var student = payload.student || {};
		var files = normalizeArray(payload.files);
		var folders = normalizeArray(payload.folders);
		var counts = payload.counts || {};
		return [
			'<div class="amos-vault-student-head">',
			"<div><span>Student File Vault</span><strong>" + escapeHTML(firstValue(student, ["display_name", "name"], "Student")) + "</strong><small>" + escapeHTML(firstValue(student, ["email"], "")) + "</small></div>",
			'<code>' + escapeHTML(payload.vault_prefix || firstValue(student, ["vault_prefix"], "")) + "</code>",
			"</div>",
			renderLiveCards([
				{ label: "Total Files", value: counts.total || 0, note: "All folders", tone: "blue" },
				{ label: "Verified", value: counts.verified || 0, note: "Visible and accepted", tone: "green" },
				{ label: "Pending", value: counts.pending_review || 0, note: "Uploaded or pending review", tone: counts.pending_review ? "gold" : "blue" }
			]),
			payload.storage_configured ? "" : '<div class="amos-live-issues"><strong>Storage notice</strong><span>' + escapeHTML(payload.storage_message || "R2 storage is not configured.") + "</span></div>",
			'<div class="amos-vault-folders" data-amos-vault-folders>',
			renderFileVaultFolderButtons(folders, selectedCategory || ""),
			"</div>",
			'<div class="amos-vault-main-grid">',
			'<section class="amos-vault-panel">',
			'<div class="amos-vault-panel-head"><strong>Folder Contents</strong><span>' + escapeHTML(files.length) + "</span></div>",
			'<div class="amos-vault-files" data-amos-vault-files>' + renderFileVaultFiles(files) + "</div>",
			"</section>",
			'<section class="amos-vault-panel">',
			'<div class="amos-vault-panel-head"><strong>Share File With Student</strong><span>R2</span></div>',
			renderFileVaultUploadForm(folders, selectedCategory || "", payload.storage_configured),
			"</section>",
			"</div>"
		].join("");
	}

	function renderFileVaultFolderButtons(folders, selectedCategory) {
		var allActive = selectedCategory ? "" : " is-active";
		return [
			'<button type="button" class="amos-vault-folder' + allActive + '" data-amos-vault-folder="">All Files<span></span></button>',
			folders.map(function (folder) {
				var active = String(folder.key) === String(selectedCategory) ? " is-active" : "";
				return [
					'<button type="button" class="amos-vault-folder' + active + '" data-amos-vault-folder="' + escapeAttr(folder.key) + '">',
					escapeHTML(folder.label || titleize(folder.key)),
					"<span>" + escapeHTML(folder.count || 0) + "</span>",
					"</button>"
				].join("");
			}).join("")
		].join("");
	}

	function renderFileVaultUploadForm(folders, selectedCategory, storageConfigured) {
		return [
			'<form class="amos-vault-upload-form" data-amos-vault-upload-form>',
			"<p>Drop a file into the selected student's dedicated vault tree. Students see confirmed admin-shared files in their File Vault.</p>",
			'<label><span>Folder</span><select data-amos-vault-upload-category>' + renderFileVaultCategoryOptions(folders, selectedCategory || "documents") + "</select></label>",
			'<label><span>File</span><input type="file" data-amos-vault-upload-file ' + (storageConfigured ? "" : "disabled") + "></label>",
			'<button class="amos-inline-btn" type="submit" ' + (storageConfigured ? "" : "disabled") + ">Upload & Share</button>",
			'<small data-amos-vault-upload-status>' + (storageConfigured ? "Ready to upload through R2 presigned storage." : "R2 storage is not configured.") + "</small>",
			"</form>"
		].join("");
	}

	function renderFileVaultCategoryOptions(folders, selectedCategory) {
		var items = folders.length ? folders : [
			{ key: "documents", label: "Documents" },
			{ key: "medical_records", label: "Medical Records" },
			{ key: "letters", label: "Letters" },
			{ key: "certifications", label: "Certifications" },
			{ key: "academic", label: "Academic" },
			{ key: "clinical", label: "Clinical" },
			{ key: "personal", label: "Personal" },
			{ key: "admin", label: "Admin Shared" }
		];
		return items.map(function (folder) {
			return '<option value="' + escapeAttr(folder.key) + '"' + (folder.key === selectedCategory ? " selected" : "") + ">" + escapeHTML(folder.label || titleize(folder.key)) + "</option>";
		}).join("");
	}

	function renderFileVaultFiles(files) {
		if (!files.length) {
			return '<div class="amos-empty">No files in this folder yet.</div>';
		}
		return files.map(function (file) {
			var status = statusText(file).toLowerCase();
			return [
				'<article class="amos-vault-file">',
				'<div><strong>' + escapeHTML(firstValue(file, ["original_name", "filename"], "Untitled file")) + "</strong>",
				"<span>" + escapeHTML(firstValue(file, ["folder_label"], titleize(firstValue(file, ["category"], "documents")))) + " / " + escapeHTML(formatFileSize(firstValue(file, ["file_size"], 0))) + "</span>",
				"<small>" + escapeHTML(firstValue(file, ["vault_path"], "")) + "</small></div>",
				'<em class="amos-vault-status ' + escapeAttr(status) + '">' + escapeHTML(titleize(status)) + "</em>",
				'<div class="amos-vault-file-actions">',
				'<button type="button" class="amos-inline-btn secondary" data-amos-vault-download="' + escapeAttr(file.id) + '">Download</button>',
				'<button type="button" class="amos-inline-btn" data-amos-vault-status="verified" data-amos-vault-file="' + escapeAttr(file.id) + '">Verify</button>',
				'<button type="button" class="amos-inline-btn secondary" data-amos-vault-status="pending_review" data-amos-vault-file="' + escapeAttr(file.id) + '">Pending</button>',
				'<button type="button" class="amos-inline-btn danger" data-amos-vault-status="rejected" data-amos-vault-file="' + escapeAttr(file.id) + '">Reject</button>',
				"</div>",
				"</article>"
			].join("");
		}).join("");
	}

	function bindAdminFileVaultControls(root, runtimeContext) {
		if (!root || root.dataset.amosVaultBound === "1") {
			return;
		}
		root.dataset.amosVaultBound = "1";
		var searchTimer = null;

		root.addEventListener("click", function (event) {
			var studentButton = event.target && event.target.closest ? event.target.closest("[data-amos-vault-student]") : null;
			var folderButton = event.target && event.target.closest ? event.target.closest("[data-amos-vault-folder]") : null;
			var searchButton = event.target && event.target.closest ? event.target.closest("[data-amos-vault-student-search-run]") : null;
			var downloadButton = event.target && event.target.closest ? event.target.closest("[data-amos-vault-download]") : null;
			var statusButton = event.target && event.target.closest ? event.target.closest("[data-amos-vault-status][data-amos-vault-file]") : null;

			if (studentButton) {
				loadAdminFileVaultStudent(root, runtimeContext, studentButton.getAttribute("data-amos-vault-student"), "");
				return;
			}
			if (folderButton) {
				loadAdminFileVaultStudent(root, runtimeContext, root.dataset.amosVaultStudent, folderButton.getAttribute("data-amos-vault-folder") || "");
				return;
			}
			if (searchButton) {
				var search = root.querySelector("[data-amos-vault-student-search]");
				loadAdminFileVaultStudents(root, runtimeContext, search ? search.value : "");
				return;
			}
			if (downloadButton) {
				downloadAdminVaultFile(downloadButton.getAttribute("data-amos-vault-download"), runtimeContext);
				return;
			}
			if (statusButton) {
				updateAdminVaultFileStatus(root, runtimeContext, statusButton.getAttribute("data-amos-vault-file"), statusButton.getAttribute("data-amos-vault-status"));
			}
		});

		root.addEventListener("input", function (event) {
			if (!event.target || !event.target.matches("[data-amos-vault-student-search]")) {
				return;
			}
			window.clearTimeout(searchTimer);
			searchTimer = window.setTimeout(function () {
				loadAdminFileVaultStudents(root, runtimeContext, event.target.value || "");
			}, 350);
		});

		root.addEventListener("submit", function (event) {
			var form = event.target && event.target.matches("[data-amos-vault-upload-form]") ? event.target : null;
			if (!form) {
				return;
			}
			event.preventDefault();
			uploadAdminVaultFile(root, runtimeContext, form);
		});
	}

	function downloadAdminVaultFile(fileId, runtimeContext) {
		if (!fileId) {
			return;
		}
		wpGetSafe("/admin/file-vault/files/" + encodeURIComponent(fileId) + "/download", null, runtimeContext).then(function (result) {
			var data = resultData(result);
			if (!result.ok || !data.url) {
				showToast(errorSummary(result));
				return;
			}
			window.open(data.url, "_blank", "noopener");
		});
	}

	function updateAdminVaultFileStatus(root, runtimeContext, fileId, status) {
		if (!fileId || !status) {
			return;
		}
		wpPutSafe("/admin/file-vault/files/" + encodeURIComponent(fileId) + "/status", { status: status }, runtimeContext).then(function (result) {
			showToast(result.ok ? "File status updated." : errorSummary(result));
			if (result.ok) {
				loadAdminFileVaultStudent(root, runtimeContext, root.dataset.amosVaultStudent, root.dataset.amosVaultCategory || "");
			}
		});
	}

	function uploadAdminVaultFile(root, runtimeContext, form) {
		var input = form.querySelector("[data-amos-vault-upload-file]");
		var category = form.querySelector("[data-amos-vault-upload-category]");
		var status = form.querySelector("[data-amos-vault-upload-status]");
		var file = input && input.files ? input.files[0] : null;
		var studentId = root.dataset.amosVaultStudent || "";
		if (!studentId || !file) {
			showToast("Choose a student and a file first.");
			return;
		}
		if (status) {
			status.textContent = "Requesting secure upload URL...";
		}
		wpPostSafe("/admin/file-vault/students/" + encodeURIComponent(studentId) + "/upload-url", {
			filename: file.name,
			mime_type: file.type || "application/octet-stream",
			category: category ? category.value : "documents"
		}, runtimeContext).then(function (result) {
			var data = resultData(result);
			if (!result.ok || !data.upload_url || !data.file_id) {
				throw new Error(errorSummary(result));
			}
			if (status) {
				status.textContent = "Uploading to the student's R2 vault...";
			}
			return fetch(data.upload_url, {
				method: "PUT",
				headers: { "Content-Type": file.type || "application/octet-stream" },
				body: file
			}).then(function (response) {
				if (!response.ok) {
					throw new Error("R2 upload failed with HTTP " + response.status + ".");
				}
				if (status) {
					status.textContent = "Confirming shared file...";
				}
				return wpPostSafe("/admin/file-vault/students/" + encodeURIComponent(studentId) + "/files/" + encodeURIComponent(data.file_id) + "/confirm", {
					file_size: file.size || 0
				}, runtimeContext);
			});
		}).then(function (result) {
			if (!result.ok) {
				throw new Error(errorSummary(result));
			}
			if (status) {
				status.textContent = "Uploaded and shared with the student.";
			}
			if (input) {
				input.value = "";
			}
			showToast("File shared with student.");
			loadAdminFileVaultStudent(root, runtimeContext, studentId, root.dataset.amosVaultCategory || "");
		}).catch(function (error) {
			if (status) {
				status.textContent = error && error.message ? error.message : "Upload failed.";
			}
			showToast(error && error.message ? error.message : "Upload failed.");
		});
	}

	function formatFileSize(value) {
		var bytes = Number(value || 0);
		if (!isFinite(bytes) || bytes <= 0) {
			return "0 KB";
		}
		if (bytes < 1024 * 1024) {
			return Math.max(1, Math.round(bytes / 1024)) + " KB";
		}
		return (bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0) + " MB";
	}

	function loadAdminCommunicationsApp(container, runtimeContext) {
		var root = container.querySelector("[data-amos-admin-communications-root]");
		if (!root) {
			return;
		}
		Promise.all([
			wpGetSafe("/communications/admin/conversations", null, runtimeContext),
			wpGetSafe("/communications/admin/students", { limit: 25 }, runtimeContext)
		]).then(function (results) {
			if (runtimeContext && runtimeContext.routeSignal && runtimeContext.routeSignal.aborted) {
				return;
			}
			var conversationsResult = results[0];
			var studentsResult = results[1];
			var payload = resultData(conversationsResult);
			var conversations = normalizeArray(payload.conversations);
			var mentors = normalizeArray(payload.mentors);
			var students = normalizeArray(resultData(studentsResult).students);
			root.innerHTML = renderAdminCommunications(conversations, students, mentors, results);
			bindAdminCommunicationsControls(root, runtimeContext);
			if (conversations.length) {
				openAdminCommunication(root, runtimeContext, conversations[0].id);
			}
		}).catch(function (error) {
			root.innerHTML = renderLiveException("Communications", error);
		});
	}

	function renderAdminCommunications(conversations, students, mentors, results) {
		var unread = conversations.reduce(function (sum, item) {
			return sum + safeCount(firstValue(item, ["unread_count"], 0));
		}, 0);
		return [
			'<div class="sos-comm-page amos-communications-live">',
			renderEndpointIssues(results),
			renderLiveCards([
				{ label: "Conversations", value: conversations.length, note: "Admin/student threads", tone: "green" },
				{ label: "Unread", value: unread, note: "Student replies needing review", tone: unread ? "gold" : "blue" },
				{ label: "Send / Reply", value: "Ready", note: "Dr. Brian / Dr. J routes", tone: "green" }
			]),
			'<div class="sos-comm-shell">',
			'<aside class="sos-comm-sidebar">',
			'<section class="sos-comm-panel">',
			'<div class="sos-comm-list-head"><div class="sos-comm-panel-title">Inbox</div><span class="sos-pill">' + escapeHTML(conversations.length) + "</span></div>",
			'<div data-amos-comm-conversations>' + renderConversationRows(conversations) + "</div>",
			"</section>",
			'<section class="sos-comm-panel">',
			'<div class="sos-comm-panel-title">New Message</div>',
			renderCommCompose(students, mentors),
			"</section>",
			"</aside>",
			'<section class="sos-comm-thread-card" data-amos-comm-thread>',
			renderConversationThread(null, []),
			"</section>",
			"</div>",
			"</div>"
		].join("");
	}

	function normalizeCommPriority(value) {
		value = String(value || "normal").toLowerCase();
		return ["low", "normal", "high", "urgent"].indexOf(value) >= 0 ? value : "normal";
	}

	function renderCommPriorityOptions(selected) {
		selected = normalizeCommPriority(selected);
		return ["low", "normal", "high", "urgent"].map(function (priority) {
			return '<option value="' + priority + '"' + (priority === selected ? " selected" : "") + ">" + escapeHTML(titleize(priority)) + "</option>";
		}).join("");
	}

	function renderCommBadges(item) {
		var badges = [];
		var priority = normalizeCommPriority(firstValue(item, ["priority"], "normal"));
		var unread = safeCount(firstValue(item, ["unread_count"], 0));
		if (isTruthyFlag(firstValue(item, ["is_starred"], false))) {
			badges.push('<span class="sos-comm-badge is-starred">Starred</span>');
		}
		if (unread > 0) {
			badges.push('<span class="sos-comm-badge is-unread">Unread</span>');
		} else {
			badges.push('<span class="sos-comm-badge is-read">Read</span>');
		}
		if (isTruthyFlag(firstValue(item, ["time_sensitive"], false))) {
			badges.push('<span class="sos-comm-badge is-time-sensitive">Time sensitive</span>');
		}
		if (priority !== "normal") {
			badges.push('<span class="sos-comm-badge is-priority-' + escapeAttr(priority) + '">' + escapeHTML(titleize(priority)) + "</span>");
		}
		return badges.length ? '<span class="sos-comm-badges">' + badges.join("") + "</span>" : "";
	}

	function renderConversationRows(conversations) {
		if (!conversations.length) {
			return '<div class="amos-empty">No conversations yet. Send the first message from the composer.</div>';
		}
		return '<div class="sos-comm-list">' + conversations.map(function (item) {
			var unread = safeCount(item.unread_count);
			var priority = normalizeCommPriority(firstValue(item, ["priority"], "normal"));
			var classes = [
				"sos-comm-thread-btn",
				unread ? "is-unread" : "is-read",
				isTruthyFlag(firstValue(item, ["is_starred"], false)) ? "is-starred" : "",
				isTruthyFlag(firstValue(item, ["time_sensitive"], false)) ? "is-time-sensitive" : "",
				"is-priority-" + priority
			].filter(Boolean).join(" ");
			return [
				'<button type="button" class="' + escapeAttr(classes) + '" data-amos-comm-conversation-id="' + escapeAttr(item.id) + '">',
				'<span class="sos-comm-thread-top"><strong>' + escapeHTML(firstValue(item, ["student.display_name"], "Student")) + "</strong>" + (unread ? "<em>" + unread + "</em>" : "") + "</span>",
				renderCommBadges(item),
				'<span class="sos-comm-thread-preview">' + escapeHTML(firstValue(item, ["last_message_preview"], "No messages yet")) + "</span>",
				'<span class="sos-comm-thread-meta">' + escapeHTML(firstValue(item, ["mentor_label"], "MissionMed")) + " · " + escapeHTML(formatDateTime(firstValue(item, ["last_message_at", "updated_at", "created_at"], ""))) + "</span>",
				"</button>"
			].join("");
		}).join("") + "</div>";
	}

	function renderConversationThread(conversation, messages) {
		if (!conversation) {
			return [
				'<div class="sos-comm-thread-header"><div><div class="sos-comm-panel-title">Select a student thread</div><p class="sos-comm-help">Open a thread to see messages, replies, and read receipts.</p></div></div>',
				'<div class="sos-comm-empty-thread amos-empty">Choose a thread or send a new message to begin.</div>'
			].join("");
		}
		messages = normalizeArray(messages);
		var priority = normalizeCommPriority(firstValue(conversation, ["priority"], "normal"));
		var starred = isTruthyFlag(firstValue(conversation, ["is_starred"], false));
		var timeSensitive = isTruthyFlag(firstValue(conversation, ["time_sensitive"], false));
		return [
			'<div class="sos-comm-thread-header">',
			'<div><div class="sos-comm-panel-title">' + escapeHTML(firstValue(conversation, ["student.display_name"], "Student")) + '</div><p class="sos-comm-help">' + escapeHTML(firstValue(conversation, ["mentor_label"], "MissionMed")) + "</p></div>",
			'<div class="sos-comm-thread-header-actions">',
			renderCommBadges(conversation),
			'<span class="sos-pill">' + escapeHTML(messages.length + " message" + (messages.length === 1 ? "" : "s")) + "</span>",
			"</div>",
			"</div>",
			'<form class="sos-comm-thread-controls" data-amos-comm-meta-form data-amos-comm-active-id="' + escapeAttr(conversation.id) + '">',
			'<button type="button" class="sos-comm-star-btn' + (starred ? " is-starred" : "") + '" data-amos-comm-star-toggle data-amos-comm-starred="' + (starred ? "1" : "0") + '">' + (starred ? "Unstar" : "Star") + "</button>",
			'<label class="sos-comm-inline-label">Priority<select class="sos-comm-select" data-amos-comm-thread-priority>' + renderCommPriorityOptions(priority) + "</select></label>",
			'<label class="sos-comm-check"><input type="checkbox" data-amos-comm-thread-time-sensitive' + (timeSensitive ? " checked" : "") + "> Time sensitive</label>",
			'<button type="submit" class="amos-inline-btn">Save flags</button>',
			'<button type="button" class="amos-inline-btn is-danger" data-amos-comm-delete>Delete thread</button>',
			'<small data-amos-comm-thread-status>Thread controls ready.</small>',
			"</form>",
			'<div class="sos-comm-timeline">',
			messages.map(renderCommMessage).join("") || '<div class="amos-empty">No messages in this thread.</div>',
			"</div>",
				'<form class="sos-comm-reply msg-reply-form" data-amos-comm-reply-form data-amos-comm-active-id="' + escapeAttr(conversation.id) + '">',
				'<textarea class="sos-comm-textarea" rows="4" data-amos-comm-reply-body placeholder="Reply as admin"></textarea>',
				renderAdminCommComposerTools("reply"),
				'<div class="sos-comm-send-options"><label class="sos-comm-check"><input type="checkbox" data-amos-comm-reply-time-sensitive> Time sensitive</label><small data-amos-comm-send-status>Ready.</small></div>',
				'<button type="submit" class="amos-inline-btn" data-amos-comm-send-button>Send Reply</button>',
				"</form>"
			].join("");
		}

	function renderCommMessage(message) {
		var mine = message.sender_role !== "student";
		var timeSensitive = isTruthyFlag(firstValue(message, ["time_sensitive"], false));
		var classes = ["sos-comm-bubble", mine ? "is-mine is-admin" : "is-student", timeSensitive ? "is-time-sensitive" : ""].filter(Boolean).join(" ");
		return [
			'<article class="' + escapeAttr(classes) + '">',
				'<div class="sos-comm-bubble-meta"><strong>' + escapeHTML(firstValue(message, ["sender_name", "sender_role"], mine ? "Admin" : "Student")) + "</strong>",
				"<span>" + (timeSensitive ? '<b class="sos-comm-badge is-time-sensitive">Time sensitive</b> ' : "") + escapeHTML(formatDateTime(firstValue(message, ["created_at"], ""))) + " · " + escapeHTML(firstValue(message, ["read_status"], "sent")) + "</span></div>",
				"<p>" + escapeHTML(firstValue(message, ["body"], "")) + "</p>",
				renderAdminCommAttachments(message),
				"</article>"
			].join("");
		}

	function renderCommCompose(students, mentors) {
		return [
			'<form data-amos-comm-new-form>',
			'<label class="sos-comm-label">Search students<input class="sos-comm-input" type="search" data-amos-comm-student-search placeholder="Name or email"></label>',
			'<div class="sos-comm-student-results" data-amos-comm-students>' + renderCommStudents(students) + "</div>",
			'<input type="hidden" data-amos-comm-student-id>',
				'<label class="sos-comm-label">Mentor context<select class="sos-comm-select" data-amos-comm-mentor>' + renderMentorOptions(mentors) + "</select></label>",
				'<label class="sos-comm-label">Priority<select class="sos-comm-select" data-amos-comm-priority>' + renderCommPriorityOptions("normal") + "</select></label>",
				'<label class="sos-comm-label">Message<textarea class="sos-comm-textarea" rows="6" data-amos-comm-body placeholder="Write a dependable student message"></textarea></label>',
				renderAdminCommComposerTools("admin"),
				'<div class="sos-comm-send-options"><label class="sos-comm-check"><input type="checkbox" data-amos-comm-time-sensitive> Time sensitive</label><small data-amos-comm-send-status>Ready.</small></div>',
				'<button type="submit" class="amos-inline-btn" data-amos-comm-send-button>Send Message</button>',
				"</form>"
			].join("");
		}

		function renderAdminCommComposerTools(scope) {
			var emojis = ["&#128512;", "&#128578;", "&#128514;", "&#128525;", "&#128293;", "&#128079;", "&#128591;", "&#128153;", "&#128155;", "&#9989;", "&#127919;", "&#128218;", "&#129658;", "&#127942;"];
			var canSendVideo = scope === "reply";
			return [
				'<div class="msg-composer-tools" data-comm-toolbox="' + escapeAttr(scope || "reply") + '">',
				'<button class="msg-tool-btn" type="button" data-comm-emoji-toggle aria-label="Add emoji">&#128512;</button>',
				canSendVideo ? '<button class="msg-tool-btn msg-tool-video-btn" type="button" data-comm-video-toggle aria-label="Record and send a video message"><span>&#127909;</span><strong>Record Video Message</strong></button>' : "",
				'<button class="msg-tool-btn" type="button" data-comm-attachment-toggle aria-label="Attach file">&#128206;</button>',
				'<div class="msg-emoji-picker" data-comm-emoji-picker>',
				emojis.map(function (emoji) {
					return '<button type="button" data-comm-emoji data-comm-emoji-value="' + emoji + '">' + emoji + "</button>";
				}).join(""),
				"</div>",
				'<div class="msg-demo-panel msg-file-panel" data-comm-attachment-panel>',
				"<strong>Attachment preview</strong>",
				"<p>Video messages are sent from an open thread. General file upload remains routed through File Vault.</p>",
				'<input type="file" data-comm-attachment-input hidden>',
				'<small data-comm-attachment-status>No file selected.</small>',
				"</div>",
				"</div>"
			].join("");
		}

		function renderAdminCommVideoRecorderModal() {
			return [
				'<div class="msg-video-modal-layer" data-comm-video-modal-layer role="presentation">',
				'<button class="msg-modal-backdrop" type="button" data-comm-video-close aria-label="Close video recorder"></button>',
				'<div class="msg-demo-panel msg-video-panel is-open" data-comm-video-panel role="dialog" aria-modal="true" aria-labelledby="msg-video-title">',
				'<button class="msg-video-close" type="button" data-comm-video-close aria-label="Close video recorder">&times;</button>',
				'<button class="msg-video-cancel" type="button" data-comm-video-close>Cancel</button>',
				'<div class="msg-video-head">',
				'<strong id="msg-video-title">Send a video message</strong>',
				"<p>Click Start Recording. You will get a 3, 2, 1, ACTION countdown, a local preview, then a final approve step before anything is sent.</p>",
				"</div>",
				'<div class="msg-video-steps">',
				"<span><b>1</b> Record</span>",
				"<span><b>2</b> Preview</span>",
				"<span><b>3</b> Approve and send</span>",
				"</div>",
				'<div class="msg-demo-actions msg-video-actions">',
				'<button class="msg-video-record-action" type="button" data-comm-video-record>Start Recording</button>',
				'<button class="msg-video-stop-action" type="button" data-comm-video-stop disabled>Stop Recording</button>',
				'<button class="msg-video-rerecord-action" type="button" data-comm-video-rerecord disabled>Re-record</button>',
				'<button class="msg-video-pick-action" type="button" data-comm-video-pick>Select Video File</button>',
				'<input type="file" accept="video/*" data-comm-video-file hidden>',
				"</div>",
				'<div class="msg-video-stage">',
				'<video data-comm-video-preview playsinline muted controls></video>',
				'<div class="msg-video-countdown" data-comm-video-countdown aria-live="assertive"></div>',
				'<div class="msg-video-hud" data-comm-video-hud><span></span><strong>RECORDING</strong><em data-comm-video-timer>00:00</em></div>',
				"</div>",
				'<div class="msg-video-processing" data-comm-video-processing aria-hidden="true">',
				"<span>Processing preview</span>",
				'<div><i data-comm-video-progress></i></div>',
				"</div>",
				'<input class="msg-video-caption" type="text" data-comm-video-caption placeholder="Optional video caption">',
				'<button class="msg-video-send" type="button" data-comm-video-send disabled>Approve &amp; Send Video</button>',
				'<small data-comm-video-status>Camera opens only after the countdown.</small>',
				"</div>",
				"</div>"
			].join("");
		}

		function renderAdminCommAttachments(message) {
			var attachments = Array.isArray(message && message.attachments) ? message.attachments : [];
			if (!attachments.length) {
				return "";
			}
			return '<div class="msg-attachments">' + attachments.map(function (attachment) {
				if (attachment.type === "video") {
					return [
						'<figure class="msg-video-attachment">',
						'<video class="msg-video-player" controls playsinline preload="metadata" src="' + escapeAttr(attachment.stream_url || "") + '"></video>',
						"<figcaption>",
						"<span>" + escapeHTML(attachment.original_name || "Video message") + "</span>",
						'<span class="msg-video-attachment-actions">',
						attachment.download_url ? '<a class="msg-video-download" href="' + escapeAttr(attachment.download_url) + '" download>Download video</a>' : "",
						attachment.stream_url ? '<button class="msg-video-vault" type="button" data-comm-save-vault data-comm-attachment-stream="' + escapeAttr(attachment.stream_url) + '" data-comm-attachment-name="' + escapeAttr(attachment.original_name || "MissionMed video message.webm") + '" data-comm-attachment-mime="' + escapeAttr(attachment.mime_type || "video/webm") + '">Save to File Vault</button>' : "",
						"</span>",
						"</figcaption>",
						"</figure>"
					].join("");
				}
				return '<div class="msg-file-attachment">' + escapeHTML(attachment.original_name || "Attachment") + "</div>";
			}).join("") + "</div>";
		}

	function renderCommStudents(students) {
		if (!students.length) {
			return '<div class="amos-empty">No students returned. Try a search.</div>';
		}
		return students.map(function (student) {
			return [
				'<label class="sos-comm-student-row" data-amos-comm-select-student="' + escapeAttr(student.id) + '">',
				'<input type="radio" name="amos-comm-student" value="' + escapeAttr(student.id) + '">',
				"<span><strong>" + escapeHTML(firstValue(student, ["display_name", "name"], "Student")) + "</strong>",
				"<small>" + escapeHTML(firstValue(student, ["email"], "")) + "</small></span>",
				"</label>"
			].join("");
		}).join("");
	}

	function renderMentorOptions(mentors) {
		var items = mentors.length ? mentors : [{ key: "dr_brian", label: "Dr. Brian" }, { key: "dr_j", label: "Dr. J" }];
		return items.map(function (mentor) {
			return '<option value="' + escapeAttr(mentor.key) + '">' + escapeHTML(mentor.label || titleize(mentor.key)) + "</option>";
		}).join("");
	}

	function bindAdminCommunicationsControls(root, runtimeContext) {
		var thread = root.querySelector("[data-amos-comm-thread]");
		var conversations = root.querySelector("[data-amos-comm-conversations]");
		var studentsWrap = root.querySelector("[data-amos-comm-students]");
		var studentSearch = root.querySelector("[data-amos-comm-student-search]");
		var selectedStudent = root.querySelector("[data-amos-comm-student-id]");
		var newForm = root.querySelector("[data-amos-comm-new-form]");

		function reload() {
			loadAdminCommunicationsApp(root.closest("[data-admin-app-route]") || document, runtimeContext);
		}

		function setSendingState(form, sending, label) {
			var button = form ? form.querySelector("[data-amos-comm-send-button]") : null;
			var status = form ? form.querySelector("[data-amos-comm-send-status]") : null;
			if (button) {
				button.disabled = !!sending;
				button.classList.toggle("is-sending", !!sending);
			}
			if (status) {
				status.textContent = label || (sending ? "Sending..." : "Ready.");
			}
		}

		function threadMetaPayload(form, override) {
			var starButton = form ? form.querySelector("[data-amos-comm-star-toggle]") : null;
			var priority = form ? form.querySelector("[data-amos-comm-thread-priority]") : null;
			var timeSensitive = form ? form.querySelector("[data-amos-comm-thread-time-sensitive]") : null;
			return Object.assign({
				is_starred: starButton ? starButton.getAttribute("data-amos-comm-starred") === "1" : false,
				priority: priority ? priority.value : "normal",
				time_sensitive: timeSensitive ? timeSensitive.checked : false
			}, override || {});
		}

		function saveThreadMeta(form, override) {
			var id = form ? form.getAttribute("data-amos-comm-active-id") : "";
			var status = form ? form.querySelector("[data-amos-comm-thread-status]") : null;
			if (!id) {
				showToast("Open a thread first.");
				return Promise.resolve({ ok: false });
			}
			if (status) {
				status.textContent = "Saving thread controls...";
			}
			return wpPutSafe("/communications/admin/conversations/" + encodeURIComponent(id) + "/meta", threadMetaPayload(form, override), runtimeContext).then(function (result) {
				if (status) {
					status.textContent = result.ok ? "Thread controls saved." : errorSummary(result);
				}
				showToast(result.ok ? "Thread controls saved." : errorSummary(result));
				if (result.ok) {
					refreshAdminCommThread(root, runtimeContext, id);
					refreshAdminCommConversations(root, runtimeContext, id);
				}
				return result;
			});
		}

			if (conversations && thread && conversations.dataset.amosBound !== "1") {
				conversations.dataset.amosBound = "1";
				conversations.addEventListener("click", function (event) {
				var row = event.target && event.target.closest ? event.target.closest("[data-amos-comm-conversation-id]") : null;
				if (!row) {
					return;
				}
				var id = row.getAttribute("data-amos-comm-conversation-id");
				openAdminCommunication(root, runtimeContext, id);
			});
		}

			if (studentsWrap && selectedStudent && studentsWrap.dataset.amosSelectBound !== "1") {
				studentsWrap.dataset.amosSelectBound = "1";
				studentsWrap.addEventListener("click", function (event) {
				var button = event.target && event.target.closest ? event.target.closest("[data-amos-comm-select-student]") : null;
				if (!button) {
					return;
				}
				studentsWrap.querySelectorAll(".is-selected").forEach(function (node) {
					node.classList.remove("is-selected");
				});
				button.classList.add("is-selected");
				selectedStudent.value = button.getAttribute("data-amos-comm-select-student") || "";
				var radio = button.querySelector("input[type='radio']");
				if (radio) {
					radio.checked = true;
				}
			});
		}

			if (studentSearch && studentsWrap && studentSearch.dataset.amosBound !== "1") {
				studentSearch.dataset.amosBound = "1";
				var searchTimer = null;
				studentSearch.addEventListener("input", function () {
				window.clearTimeout(searchTimer);
				searchTimer = window.setTimeout(function () {
					wpGetSafe("/communications/admin/students", { search: studentSearch.value.trim(), limit: 25 }, runtimeContext).then(function (result) {
						studentsWrap.innerHTML = renderCommStudents(normalizeArray(resultData(result).students));
					});
				}, 240);
			});
		}

			if (newForm && newForm.dataset.amosBound !== "1") {
				newForm.dataset.amosBound = "1";
				newForm.addEventListener("submit", function (event) {
				event.preventDefault();
				var studentId = getField(newForm, "comm-student-id");
				var body = getField(newForm, "comm-body");
				if (!studentId || !body.trim()) {
					showToast("Choose a student and write a message.");
					return;
				}
				wpPostSafe("/communications/admin/send", {
					student_user_ids: [Number(studentId)],
					mentor_key: getField(newForm, "comm-mentor") || "dr_brian",
					body: body,
					priority: getField(newForm, "comm-priority") || "normal",
					time_sensitive: !!(newForm.querySelector("[data-amos-comm-time-sensitive]") || {}).checked
				}, runtimeContext).then(function (result) {
					showToast(result.ok ? "Message sent." : errorSummary(result));
					if (result.ok) {
						reload();
					}
					setSendingState(newForm, false, result.ok ? "Sent." : "Send failed.");
				}).catch(function () {
					setSendingState(newForm, false, "Send failed.");
				});
				setSendingState(newForm, true, "Sending message...");
			});
		}

				root.querySelectorAll("[data-amos-comm-meta-form]").forEach(function (form) {
					if (form.dataset.amosBound === "1") {
						return;
					}
					form.dataset.amosBound = "1";
					form.addEventListener("submit", function (event) {
						event.preventDefault();
						saveThreadMeta(form);
					});
					var starButton = form.querySelector("[data-amos-comm-star-toggle]");
					if (starButton) {
						starButton.addEventListener("click", function (event) {
							event.preventDefault();
							var next = starButton.getAttribute("data-amos-comm-starred") === "1" ? "0" : "1";
							starButton.setAttribute("data-amos-comm-starred", next);
							starButton.classList.toggle("is-starred", next === "1");
							starButton.textContent = next === "1" ? "Unstar" : "Star";
							saveThreadMeta(form, { is_starred: next === "1" });
						});
					}
					var deleteButton = form.querySelector("[data-amos-comm-delete]");
					if (deleteButton) {
						deleteButton.addEventListener("click", function (event) {
							event.preventDefault();
							var id = form.getAttribute("data-amos-comm-active-id");
							if (!id || !window.confirm("Delete this thread from the admin inbox? The student copy is preserved.")) {
								return;
							}
							deleteButton.disabled = true;
							deleteButton.classList.add("is-sending");
							wpDeleteSafe("/communications/admin/conversations/" + encodeURIComponent(id), runtimeContext).then(function (result) {
								showToast(result.ok ? "Thread removed from admin inbox." : errorSummary(result));
								if (result.ok) {
									reload();
								} else {
									deleteButton.disabled = false;
									deleteButton.classList.remove("is-sending");
								}
							}).catch(function () {
								deleteButton.disabled = false;
								deleteButton.classList.remove("is-sending");
								showToast("Thread delete failed.");
							});
						});
					}
				});

				root.querySelectorAll("[data-amos-comm-reply-form]").forEach(function (form) {
					if (form.dataset.amosBound === "1") {
						return;
					}
					form.dataset.amosBound = "1";
					form.addEventListener("submit", function (event) {
					event.preventDefault();
				var id = form.getAttribute("data-amos-comm-active-id");
				var body = getField(form, "comm-reply-body");
				if (!id || !body.trim()) {
					showToast("Write a reply first.");
					return;
				}
				setSendingState(form, true, "Sending reply...");
				wpPostSafe("/communications/admin/conversations/" + encodeURIComponent(id) + "/reply", {
					body: body,
					time_sensitive: !!(form.querySelector("[data-amos-comm-reply-time-sensitive]") || {}).checked
				}, runtimeContext).then(function (result) {
					showToast(result.ok ? "Reply sent." : errorSummary(result));
					if (result.ok && thread) {
						wpGetSafe("/communications/admin/conversations/" + encodeURIComponent(id), null, runtimeContext).then(function (next) {
							var data = resultData(next);
							thread.innerHTML = next.ok ? renderConversationThread(data.conversation, data.messages || []) : renderLiveUnavailable("Conversation", next);
							bindAdminCommunicationsControls(root, runtimeContext);
							refreshAdminCommConversations(root, runtimeContext, id);
						});
					}
					setSendingState(form, false, result.ok ? "Sent." : "Send failed.");
					if (!result.ok) {
						return;
					}
				}).catch(function () {
					setSendingState(form, false, "Send failed.");
					});
			});
			});
			bindAdminCommComposerEnhancements(root, runtimeContext);
		}

		function bindAdminCommComposerEnhancements(root, runtimeContext) {
			if (!root) {
				return;
			}

			root.querySelectorAll("[data-comm-emoji-toggle]").forEach(function (button) {
				if (button.dataset.amosBound === "1") {
					return;
				}
				button.dataset.amosBound = "1";
				button.addEventListener("click", function (event) {
					event.preventDefault();
					event.stopPropagation();
					var tools = button.closest("[data-comm-toolbox]");
					var picker = tools ? tools.querySelector("[data-comm-emoji-picker]") : null;
					root.querySelectorAll("[data-comm-emoji-picker]").forEach(function (panel) {
						if (panel !== picker) {
							panel.classList.remove("is-open");
						}
					});
					if (picker) {
						picker.classList.toggle("is-open");
					}
				});
			});

			root.querySelectorAll("[data-comm-emoji]").forEach(function (button) {
				if (button.dataset.amosBound === "1") {
					return;
				}
				button.dataset.amosBound = "1";
				button.addEventListener("click", function (event) {
					event.preventDefault();
					event.stopPropagation();
					var textarea = adminCommComposerTextarea(button, root);
					if (!textarea) {
						return;
					}
					insertAtCursor(textarea, adminCommEmojiValue(button));
					var picker = button.closest("[data-comm-emoji-picker]");
					if (picker) {
						picker.classList.remove("is-open");
					}
				});
			});

			root.querySelectorAll("[data-comm-video-toggle]").forEach(function (button) {
				if (button.dataset.amosBound === "1") {
					return;
				}
				button.dataset.amosBound = "1";
				button.addEventListener("click", function (event) {
					event.preventDefault();
					openAdminCommVideoModal(root, runtimeContext);
				});
			});

			root.querySelectorAll("[data-comm-attachment-toggle]").forEach(function (button) {
				if (button.dataset.amosBound === "1") {
					return;
				}
				button.dataset.amosBound = "1";
				button.addEventListener("click", function () {
					var panel = adminCommComposerPanel(button, "[data-comm-attachment-panel]");
					var input = panel ? panel.querySelector("[data-comm-attachment-input]") : null;
					if (panel) {
						panel.classList.add("is-open");
					}
					if (input) {
						input.click();
					}
				});
			});

			root.querySelectorAll("[data-comm-attachment-input]").forEach(function (input) {
				if (input.dataset.amosBound === "1") {
					return;
				}
				input.dataset.amosBound = "1";
				input.addEventListener("change", function () {
					var file = input.files && input.files[0];
					var panel = input.closest("[data-comm-attachment-panel]");
					var status = panel ? panel.querySelector("[data-comm-attachment-status]") : null;
					if (status) {
						status.textContent = file ? file.name + " selected. Use video messages for immediate thread delivery." : "No file selected.";
					}
				});
			});

			root.querySelectorAll("[data-comm-save-vault]").forEach(function (button) {
				if (button.dataset.amosBound === "1") {
					return;
				}
				button.dataset.amosBound = "1";
				button.addEventListener("click", function () {
					showToast("Open File Vault Admin to save reviewed communication assets.");
				});
			});
		}

		function openAdminCommVideoModal(root, runtimeContext) {
			var activeForm = root.querySelector("[data-amos-comm-reply-form]");
			var activeId = activeForm ? activeForm.getAttribute("data-amos-comm-active-id") : "";
			if (!activeId) {
				showToast("Open a conversation before recording video.");
				return;
			}
			root.querySelectorAll("[data-comm-video-modal-layer]").forEach(function (node) {
				node.remove();
			});
			root.insertAdjacentHTML("beforeend", renderAdminCommVideoRecorderModal());
			var modal = root.querySelector("[data-comm-video-modal-layer]");
			if (modal) {
				modal.setAttribute("data-amos-comm-active-id", activeId);
			}
			bindAdminCommVideoModal(root, runtimeContext);
		}

		function bindAdminCommVideoModal(root, runtimeContext) {
			var modal = root ? root.querySelector("[data-comm-video-modal-layer]") : null;
			if (!modal) {
				return;
			}

			modal.querySelectorAll("[data-comm-video-record]").forEach(function (button) {
				button.addEventListener("click", function () {
					startAdminCommVideoPreview(button);
				});
			});
			modal.querySelectorAll("[data-comm-video-stop]").forEach(function (button) {
				button.addEventListener("click", function () {
					stopAdminCommVideoPreview(button);
				});
			});
			modal.querySelectorAll("[data-comm-video-rerecord]").forEach(function (button) {
				button.addEventListener("click", function () {
					rerecordAdminCommVideoPreview(button);
				});
			});
			modal.querySelectorAll("[data-comm-video-pick]").forEach(function (button) {
				button.addEventListener("click", function () {
					var panel = button.closest("[data-comm-video-panel]");
					var input = panel ? panel.querySelector("[data-comm-video-file]") : null;
					if (input) {
						input.click();
					}
				});
			});
			modal.querySelectorAll("[data-comm-video-file]").forEach(function (input) {
				input.addEventListener("change", function () {
					previewAdminCommVideoFile(input);
				});
			});
			modal.querySelectorAll("[data-comm-video-send]").forEach(function (button) {
				button.addEventListener("click", function () {
					sendAdminCommVideo(button, root, runtimeContext);
				});
			});
			modal.querySelectorAll("[data-comm-video-close]").forEach(function (button) {
				button.addEventListener("click", function () {
					closeAdminCommVideoModal(modal);
				});
			});
		}

		function adminCommComposerTextarea(node, root) {
			var tools = node ? node.closest("[data-comm-toolbox]") : null;
			var form = tools ? tools.closest("form") : node ? node.closest("form") : null;
			if (form) {
				return form.querySelector(".sos-comm-textarea, textarea");
			}
			return root ? root.querySelector(".msg-reply-form textarea, [data-amos-comm-new-form] textarea") : null;
		}

		function adminCommComposerPanel(node, selector) {
			var tools = node ? node.closest("[data-comm-toolbox]") : null;
			return tools ? tools.querySelector(selector) : null;
		}

		function adminCommEmojiValue(button) {
			var value = button ? (button.getAttribute("data-comm-emoji-value") || button.textContent || button.innerText || "") : "";
			var decoder = document.createElement("textarea");
			decoder.innerHTML = value;
			return decoder.value || value;
		}

		function insertAtCursor(textarea, value) {
			var start = typeof textarea.selectionStart === "number" ? textarea.selectionStart : textarea.value.length;
			var end = typeof textarea.selectionEnd === "number" ? textarea.selectionEnd : textarea.value.length;
			textarea.value = textarea.value.slice(0, start) + value + textarea.value.slice(end);
			textarea.focus();
			textarea.selectionStart = textarea.selectionEnd = start + value.length;
			textarea.dispatchEvent(new Event("input", { bubbles: true }));
		}

		function startAdminCommVideoPreview(button) {
			var panel = button.closest("[data-comm-video-panel]");
			var video = panel ? panel.querySelector("[data-comm-video-preview]") : null;
			var status = panel ? panel.querySelector("[data-comm-video-status]") : null;
			if (!video || !status) {
				return;
			}
			if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
				status.textContent = "Video preview is not supported in this browser.";
				return;
			}
			if (panel._commCountdownActive) {
				return;
			}
			runAdminCommVideoCountdown(panel, function () {
				beginAdminCommVideoCapture(button);
			});
		}

		function preferredAdminCommVideoMime() {
			var fallback = "video/webm";
			if (!window.MediaRecorder || typeof MediaRecorder.isTypeSupported !== "function") {
				return "";
			}
			var types = [
				"video/webm;codecs=vp9,opus",
				"video/webm;codecs=vp8,opus",
				"video/webm",
				"video/mp4"
			];
			for (var i = 0; i < types.length; i += 1) {
				if (MediaRecorder.isTypeSupported(types[i])) {
					return types[i];
				}
			}
			return fallback;
		}

		function adminCommVideoExtension(mime, name) {
			var fileName = String(name || "").toLowerCase();
			if (fileName.indexOf(".mp4") > -1) {
				return "mp4";
			}
			if (fileName.indexOf(".mov") > -1) {
				return "mov";
			}
			if (String(mime || "").indexOf("mp4") > -1) {
				return "mp4";
			}
			return "webm";
		}

		function setAdminCommVideoPreviewReady(panel, blob, name, statusText) {
			var video = panel ? panel.querySelector("[data-comm-video-preview]") : null;
			var sendButton = panel ? panel.querySelector("[data-comm-video-send]") : null;
			var rerecordButton = panel ? panel.querySelector("[data-comm-video-rerecord]") : null;
			var stopButton = panel ? panel.querySelector("[data-comm-video-stop]") : null;
			var recordButton = panel ? panel.querySelector("[data-comm-video-record]") : null;
			var status = panel ? panel.querySelector("[data-comm-video-status]") : null;
			if (!panel || !video || !blob || !blob.size) {
				return;
			}
			if (panel._commStream) {
				panel._commStream.getTracks().forEach(function (track) {
					track.stop();
				});
				panel._commStream = null;
			}
			stopAdminCommVideoTimer(panel);
			video.pause();
			video.srcObject = null;
			video.src = URL.createObjectURL(blob);
			video.muted = false;
			video.controls = true;
			panel._commVideoBlob = blob;
			panel._commVideoName = name || ("missionmed-admin-video-" + Date.now() + "." + adminCommVideoExtension(blob.type, name));
			panel.classList.remove("is-recording", "is-processing", "is-counting");
			panel.classList.add("is-preview-ready");
			finishAdminCommVideoProcessing(panel);
			if (sendButton) {
				sendButton.disabled = false;
			}
			if (recordButton) {
				recordButton.disabled = false;
			}
			if (rerecordButton) {
				rerecordButton.disabled = false;
			}
			if (stopButton) {
				stopButton.disabled = true;
			}
			if (status) {
				status.textContent = statusText || "Preview ready. Press play to review, approve and send, or re-record.";
			}
		}

		function previewAdminCommVideoFile(input) {
			var file = input.files && input.files[0];
			var panel = input.closest("[data-comm-video-panel]");
			var status = panel ? panel.querySelector("[data-comm-video-status]") : null;
			if (!file || !panel) {
				return;
			}
			if (!/^video\//.test(file.type || "")) {
				if (status) {
					status.textContent = "Choose a video file before approving.";
				}
				return;
			}
			setAdminCommVideoPreviewReady(panel, file, file.name || "missionmed-admin-video.mp4", "Preview ready from selected video. Press play to review before approving.");
		}

		function runAdminCommVideoCountdown(panel, done) {
			var countdown = panel ? panel.querySelector("[data-comm-video-countdown]") : null;
			var status = panel ? panel.querySelector("[data-comm-video-status]") : null;
			var recordButton = panel ? panel.querySelector("[data-comm-video-record]") : null;
			var stopButton = panel ? panel.querySelector("[data-comm-video-stop]") : null;
			var sendButton = panel ? panel.querySelector("[data-comm-video-send]") : null;
			var rerecordButton = panel ? panel.querySelector("[data-comm-video-rerecord]") : null;
			var steps = ["3", "2", "1", "ACTION"];
			var index = 0;
			if (!panel || !countdown) {
				return;
			}
			panel._commCountdownActive = true;
			panel.classList.add("is-counting");
			panel.classList.remove("is-recording", "is-preview-ready");
			if (recordButton) {
				recordButton.disabled = true;
			}
			if (stopButton) {
				stopButton.disabled = true;
			}
			if (sendButton) {
				sendButton.disabled = true;
			}
			if (rerecordButton) {
				rerecordButton.disabled = true;
			}
			if (status) {
				status.textContent = "Get ready. Recording starts after ACTION.";
			}

			function tick() {
				if (index >= steps.length) {
					panel._commCountdownActive = false;
					panel.classList.remove("is-counting");
					countdown.textContent = "";
					if (typeof done === "function") {
						done();
					}
					return;
				}
				var label = steps[index];
				countdown.textContent = label || "";
				countdown.classList.remove("is-pop");
				countdown.offsetWidth;
				countdown.classList.add("is-pop");
				playAdminCommVideoCue(label === "ACTION");
				index += 1;
				window.setTimeout(tick, label === "ACTION" ? 520 : 780);
			}

			tick();
		}

		function playAdminCommVideoCue(action) {
			try {
				var AudioContext = window.AudioContext || window.webkitAudioContext;
				if (!AudioContext) {
					return;
				}
				var ctx = window._mmedCommAudioContext || new AudioContext();
				window._mmedCommAudioContext = ctx;
				if (ctx.state === "suspended") {
					ctx.resume();
				}
				var osc = ctx.createOscillator();
				var gain = ctx.createGain();
				osc.type = "sine";
				osc.frequency.value = action ? 880 : 520;
				gain.gain.setValueAtTime(0.001, ctx.currentTime);
				gain.gain.exponentialRampToValueAtTime(action ? 0.18 : 0.1, ctx.currentTime + 0.015);
				gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (action ? 0.24 : 0.14));
				osc.connect(gain);
				gain.connect(ctx.destination);
				osc.start(ctx.currentTime);
				osc.stop(ctx.currentTime + (action ? 0.25 : 0.15));
			} catch (error) {}
		}

		function beginAdminCommVideoCapture(button) {
			var panel = button.closest("[data-comm-video-panel]");
			var video = panel ? panel.querySelector("[data-comm-video-preview]") : null;
			var status = panel ? panel.querySelector("[data-comm-video-status]") : null;
			if (!video || !status) {
				return;
			}
			status.textContent = "Opening local camera preview...";
			navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(function (stream) {
				var sendButton = panel.querySelector("[data-comm-video-send]");
				var rerecordButton = panel.querySelector("[data-comm-video-rerecord]");
				var stopButton = panel.querySelector("[data-comm-video-stop]");
				var recordButton = panel.querySelector("[data-comm-video-record]");
				video.srcObject = stream;
				video.controls = true;
				video.muted = true;
				video.play();
				panel._commStream = stream;
				panel._commVideoBlob = null;
				panel._commVideoName = "";
				panel.classList.add("is-recording");
				panel.classList.remove("is-preview-ready", "is-processing");
				startAdminCommVideoTimer(panel);
				if (sendButton) {
					sendButton.disabled = true;
				}
				if (recordButton) {
					recordButton.disabled = true;
				}
				if (rerecordButton) {
					rerecordButton.disabled = true;
				}
				if (stopButton) {
					stopButton.disabled = false;
				}
				if (window.MediaRecorder) {
					try {
						panel._commChunks = [];
						var mime = preferredAdminCommVideoMime();
						panel._commRecorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
						panel._commRecorder.ondataavailable = function (event) {
							if (event.data && event.data.size) {
								panel._commChunks.push(event.data);
							}
						};
						panel._commRecorder.onstop = function () {
							var firstChunk = panel._commChunks && panel._commChunks[0] ? panel._commChunks[0] : null;
							var blobType = panel._commRecorder && panel._commRecorder.mimeType ? panel._commRecorder.mimeType : firstChunk && firstChunk.type ? firstChunk.type : mime || "video/webm";
							var blob = new Blob(panel._commChunks || [], { type: blobType });
							stopAdminCommVideoTimer(panel);
							showAdminCommVideoProcessing(panel);
							window.setTimeout(function () {
								var extension = adminCommVideoExtension(blob.type, "");
								setAdminCommVideoPreviewReady(panel, blob, "missionmed-admin-video-" + Date.now() + "." + extension, blob.size ? "Preview ready. Press play to review, approve and send, or re-record." : "No video was recorded.");
							}, 850);
						};
						panel._commRecorder.start();
						status.textContent = "Recording. Stop when you are ready to send.";
					} catch (error) {
						status.textContent = "Local preview active. Recording is not supported here.";
					}
				} else {
					status.textContent = "Local preview active. Recording is not supported here.";
				}
			}).catch(function () {
				panel.classList.remove("is-counting", "is-recording");
				stopAdminCommVideoTimer(panel);
				var recordButton = panel.querySelector("[data-comm-video-record]");
				if (recordButton) {
					recordButton.disabled = false;
				}
				status.textContent = "Camera permission was not granted.";
			});
		}

		function startAdminCommVideoTimer(panel) {
			var timer = panel ? panel.querySelector("[data-comm-video-timer]") : null;
			if (!timer) {
				return;
			}
			panel._commVideoStartedAt = Date.now();
			window.clearInterval(panel._commVideoTimer);
			panel._commVideoTimer = window.setInterval(function () {
				var seconds = Math.max(0, Math.floor((Date.now() - panel._commVideoStartedAt) / 1000));
				var mins = Math.floor(seconds / 60);
				var secs = seconds % 60;
				timer.textContent = String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
			}, 250);
		}

		function stopAdminCommVideoTimer(panel) {
			if (!panel) {
				return;
			}
			window.clearInterval(panel._commVideoTimer);
			panel._commVideoTimer = null;
		}

		function showAdminCommVideoProcessing(panel) {
			var progress = panel ? panel.querySelector("[data-comm-video-progress]") : null;
			var status = panel ? panel.querySelector("[data-comm-video-status]") : null;
			if (!panel) {
				return;
			}
			panel.classList.remove("is-recording");
			panel.classList.add("is-processing");
			if (status) {
				status.textContent = "Processing your preview...";
			}
			if (progress) {
				progress.style.width = "12%";
				window.setTimeout(function () { progress.style.width = "68%"; }, 60);
				window.setTimeout(function () { progress.style.width = "100%"; }, 560);
			}
		}

		function finishAdminCommVideoProcessing(panel) {
			var progress = panel ? panel.querySelector("[data-comm-video-progress]") : null;
			if (progress) {
				progress.style.width = "0%";
			}
		}

		function stopAdminCommVideoPreview(button) {
			var panel = button.closest("[data-comm-video-panel]");
			var video = panel ? panel.querySelector("[data-comm-video-preview]") : null;
			var status = panel ? panel.querySelector("[data-comm-video-status]") : null;
			if (panel && panel._commRecorder && panel._commRecorder.state !== "inactive") {
				panel._commRecorder.stop();
			}
			if (panel && panel._commStream) {
				panel._commStream.getTracks().forEach(function (track) {
					track.stop();
				});
				panel._commStream = null;
			}
			if (panel) {
				panel.classList.remove("is-recording");
				stopAdminCommVideoTimer(panel);
			}
			if (video && video.srcObject) {
				video.pause();
				video.srcObject = null;
			}
			if (status && !(panel && panel._commRecorder)) {
				status.textContent = "Local preview stopped.";
			}
		}

		function closeAdminCommVideoModal(layer) {
			var panel = layer ? layer.querySelector("[data-comm-video-panel]") : document.querySelector("[data-comm-video-panel]");
			if (panel && panel._commRecorder && panel._commRecorder.state !== "inactive") {
				panel._commRecorder.stop();
			}
			if (panel && panel._commStream) {
				panel._commStream.getTracks().forEach(function (track) {
					track.stop();
				});
				panel._commStream = null;
			}
			stopAdminCommVideoTimer(panel);
			if (layer && layer.parentNode) {
				layer.parentNode.removeChild(layer);
			}
		}

		function rerecordAdminCommVideoPreview(button) {
			var panel = button.closest("[data-comm-video-panel]");
			var video = panel ? panel.querySelector("[data-comm-video-preview]") : null;
			var status = panel ? panel.querySelector("[data-comm-video-status]") : null;
			var sendButton = panel ? panel.querySelector("[data-comm-video-send]") : null;
			if (!panel) {
				return;
			}
			if (panel._commStream) {
				panel._commStream.getTracks().forEach(function (track) {
					track.stop();
				});
				panel._commStream = null;
			}
			panel._commVideoBlob = null;
			panel._commVideoName = "";
			panel.classList.remove("is-preview-ready", "is-processing", "is-recording");
			finishAdminCommVideoProcessing(panel);
			if (sendButton) {
				sendButton.disabled = true;
			}
			button.disabled = true;
			if (video) {
				video.pause();
				video.removeAttribute("src");
				video.srcObject = null;
				video.load();
			}
			if (status) {
				status.textContent = "Starting a new recording...";
			}
			startAdminCommVideoPreview(button);
		}

		function sendAdminCommVideo(button, root, runtimeContext) {
			var panel = button.closest("[data-comm-video-panel]");
			var layer = panel ? panel.closest("[data-comm-video-modal-layer]") : null;
			var status = panel ? panel.querySelector("[data-comm-video-status]") : null;
			var caption = panel ? panel.querySelector("[data-comm-video-caption]") : null;
			var id = layer ? layer.getAttribute("data-amos-comm-active-id") : "";
			var blob = panel ? panel._commVideoBlob : null;
			if (!id) {
				if (status) {
					status.textContent = "Open a conversation before sending video.";
				}
				return;
			}
			if (!blob || !blob.size) {
				if (status) {
					status.textContent = "Record a video before sending.";
				}
				return;
			}
			var form = new FormData();
			form.append("video", blob, panel._commVideoName || "missionmed-admin-video.webm");
			form.append("body", caption ? caption.value || "" : "");
			button.disabled = true;
			if (status) {
				status.textContent = "Uploading video privately...";
			}
			fetch(wpApi.url("/communications/admin/conversations/" + encodeURIComponent(id) + "/video"), {
				method: "POST",
				credentials: "same-origin",
				headers: { "X-WP-Nonce": config.auth && config.auth.nonce ? config.auth.nonce : "" },
				body: form
			}).then(function (response) {
				return response.json().then(function (payload) {
					if (!response.ok) {
						throw new Error(payload && payload.message ? payload.message : "Video upload failed.");
					}
					return payload;
				});
			}).then(function () {
				if (status) {
					status.textContent = "Video sent.";
				}
				showToast("Video message sent.");
				closeAdminCommVideoModal(layer);
				refreshAdminCommThread(root, runtimeContext, id);
			}).catch(function (error) {
				button.disabled = false;
				if (status) {
					status.textContent = error && error.message ? error.message : "Video upload failed.";
				}
				showToast(error && error.message ? error.message : "Video upload failed.");
			});
		}

		function refreshAdminCommThread(root, runtimeContext, id) {
			var thread = root ? root.querySelector("[data-amos-comm-thread]") : null;
			if (!thread || !id) {
				return;
			}
			wpGetSafe("/communications/admin/conversations/" + encodeURIComponent(id), null, runtimeContext).then(function (result) {
				var data = resultData(result);
				thread.innerHTML = result.ok ? renderConversationThread(data.conversation, data.messages || []) : renderLiveUnavailable("Conversation", result);
				bindAdminCommunicationsControls(root, runtimeContext);
			});
		}

		function refreshAdminCommConversations(root, runtimeContext, activeId) {
			var conversations = root ? root.querySelector("[data-amos-comm-conversations]") : null;
			if (!conversations) {
				return;
			}
			wpGetSafe("/communications/admin/conversations", null, runtimeContext).then(function (result) {
				var payload = resultData(result);
				conversations.innerHTML = result.ok ? renderConversationRows(normalizeArray(payload.conversations)) : renderLiveUnavailable("Inbox", result);
				conversations.dataset.amosBound = "";
				bindAdminCommunicationsControls(root, runtimeContext);
				if (activeId) {
					root.querySelectorAll("[data-amos-comm-conversation-id]").forEach(function (button) {
						button.classList.toggle("is-active", String(button.getAttribute("data-amos-comm-conversation-id")) === String(activeId));
					});
				}
			});
		}

	function openAdminCommunication(root, runtimeContext, id) {
		var thread = root.querySelector("[data-amos-comm-thread]");
		if (!thread || !id) {
			return;
		}
		root.querySelectorAll("[data-amos-comm-conversation-id]").forEach(function (button) {
			button.classList.toggle("is-active", String(button.getAttribute("data-amos-comm-conversation-id")) === String(id));
		});
		thread.innerHTML = renderWpLoading("conversation");
		wpGetSafe("/communications/admin/conversations/" + encodeURIComponent(id), null, runtimeContext).then(function (result) {
			var data = resultData(result);
			thread.innerHTML = result.ok ? renderConversationThread(data.conversation, data.messages || []) : renderLiveUnavailable("Conversation", result);
			bindAdminCommunicationsControls(root, runtimeContext);
			if (result.ok) {
				refreshAdminCommConversations(root, runtimeContext, id);
			}
		});
	}

	function mountLiveDashboard(container, runtimeContext) {
		container.innerHTML = [
			'<section class="amos-page amos-dashboard">',
			pageHeader(PRODUCT_NAME, "Command Center", "Admin-grade Matrix mirror for daily operations. Railway live data is loading through the feature-flagged admin session.", "Railway live"),
			'<div class="amos-module-skeleton" aria-label="Loading live dashboard">',
			"<span></span><span></span><span></span><span></span>",
			"</div>",
			"</section>"
		].join("");

		fetchDashboardBundle(runtimeContext).then(function (bundle) {
			if (runtimeContext.routeSignal && runtimeContext.routeSignal.aborted) {
				return;
			}
			container.innerHTML = renderLiveDashboard(bundle, runtimeContext);
			state.metrics.moduleUsableMs = Math.round(performance.now() - state.metrics.bootAt);
		});
	}

	function fetchDashboardBundle(runtimeContext) {
		return Promise.all([
			railwayGetSafe("/api/hq/summary", null, runtimeContext),
			railwayGetSafe("/api/supabase/leads/summary", null, runtimeContext),
			railwayGetSafe("/api/hq/payments/overview", null, runtimeContext),
			railwayGetSafe("/api/hq/tasks", null, runtimeContext),
			railwayGetSafe("/api/hq/notifications", null, runtimeContext)
		]).then(function (results) {
			return {
				summary: results[0],
				leads: results[1],
				payments: results[2],
				tasks: results[3],
				notifications: results[4]
			};
		});
	}

	function renderLiveDashboard(bundle, runtimeContext) {
		var summary = resultData(bundle.summary);
		var summaryMetrics = summary.metrics || {};
		var leadMetrics = resultData(bundle.leads).metrics || resultData(bundle.leads) || {};
		var paymentData = resultData(bundle.payments);
		var paymentCards = firstArray(paymentData, ["cards"]) || [];
		var taskItems = resultItems(bundle.tasks, ["items", "tasks"]);
		var notificationItems = resultItems(bundle.notifications, ["items", "notifications"]);
		var billingExceptions = getPath(paymentData, "meta.failed_transactions") || getPath(paymentData, "summary.total") || 0;
		var leadTotal = leadMetrics.total || safeCount(resultItems(bundle.leads, ["items", "topLeads"]));
		var hotLeads = leadMetrics.high_probability || getPath(leadMetrics, "stage_counts.hot") || 0;
		var studentActionCount = safeCount(summary.studentsNeedingAction);
		var overview = [
			{ label: "Today's appointments", value: formatCount(summaryMetrics.appointments || summaryMetrics.scheduler || "Open"), note: "Use Scheduler Ops for canonical queue", tone: "green", route: "#scheduler-ops" },
			{ label: "Pending follow-ups", value: formatCount(summaryMetrics.openTasks || taskItems.length), note: "Open task queue", tone: "blue", route: "#alerts" },
			{ label: "New leads", value: formatCount(leadTotal), note: formatCount(hotLeads) + " hot lead signals", tone: "gold", route: "#leads" },
			{ label: "New enrollments", value: formatCount(studentActionCount), note: "Students needing action", tone: "gold", route: "#newly-enrolled" },
			{ label: "Welcome Emails", value: "Open", note: "360 manual/batch sender", tone: "green", route: "#welcome-emails" },
			{ label: "Billing alerts", value: formatCount(billingExceptions), note: "Payment exceptions", tone: "blue", route: "#payments" },
			{ label: "Messages", value: formatCount(summaryMetrics.emailDrafts || notificationItems.length), note: "Notifications and MedMail signals", tone: "blue", route: "#communications" }
		];
		var groups = [
			{
				title: "Student Operations",
				copy: "Find students, review enrollment state, and check access without touching LearnDash or WooCommerce data.",
				items: ["student-management", "newly-enrolled", "welcome-emails", "leads", "enrollment-status", "payments", "course-access"]
			},
			{
				title: "Scheduling Operations",
				copy: "Keep live Scheduler Ops source locked while Calendar Admin moves through package approval.",
				items: ["scheduler-ops", "calendar-admin", "alerts"]
			},
			{
				title: "Program Operations",
				copy: "Mission Residency, Exam Prep, USCE / Clinicals, USCE Offer Engine, and Arena / STAT oversight.",
				items: ["mission-residency", "exam-prep", "usce-clinicals", "usce-offers", "arena-stat"]
			},
			{
				title: "Review / Audit",
				copy: "Audit logs, system health, reports, and source packages live here instead of dominating the main dashboard.",
				items: ["audit-logs", "reports", "system-health", "source-packages"]
			}
		];

		return [
			'<section class="amos-page amos-dashboard">',
			pageHeader(PRODUCT_NAME, "Command Center", "Admin-grade Matrix mirror for daily operations. Live Railway reads are enabled by mmed_admin_os_live_data.", "Railway live"),
			'<div class="amos-command-strip">',
			overview.map(function (item) {
				return overviewCard(item);
			}).join(""),
			"</div>",
			'<div class="amos-grid two">',
			'<article class="amos-card amos-hero-card">',
			'<div class="amos-card-heading"><h3>Live Operations</h3><span class="amos-pill green">Protected</span></div>',
			'<p>Railway HQ provides read-only operating data while Scheduler Ops, Calendar, File Vault, Communications, and StoryForge remain source-locked.</p>',
			'<div class="amos-action-row">',
			'<a class="amos-btn" href="#student-management">Open Student Management</a>',
			'<a class="amos-btn secondary" href="#system-health">System Health</a>',
			"</div>",
			'<div class="amos-mini-grid">',
			miniStat("Students", "Railway summary", formatCount(summaryMetrics.students || 0)),
			miniStat("Auth", authLabel(runtimeContext), runtimeContext.railway && runtimeContext.railway.isExchanged() ? "Railway" : "WP"),
			miniStat("Live flag", "mmed_admin_os_live_data", "ON"),
			"</div>",
			renderEndpointIssues([bundle.summary, bundle.leads, bundle.payments, bundle.tasks, bundle.notifications]),
			"</article>",
			'<article class="amos-card amos-hero-card">',
			'<div class="amos-card-heading"><h3>Payment Snapshot</h3><span class="amos-pill blue">Read only</span></div>',
			paymentCards.length ? '<div class="amos-route-list">' + paymentCards.slice(0, 5).map(function (card) {
				return routeRow(firstValue(card, ["label", "title", "name"], "Payment metric"), formatMoney(firstValue(card, ["value", "amount", "total"], 0)));
			}).join("") + "</div>" : "<p>No payment cards were returned by Railway.</p>",
			"</article>",
			"</div>",
			'<div class="amos-section-grid">',
			groups.map(groupCard).join(""),
			"</div>",
			"</section>"
		].join("");
	}

	function mountWelcomeEmailsAdmin(container, runtimeContext, meta) {
		meta = meta || MODULE_META["welcome-emails"];
		var adminUrl = CANONICAL.welcomeEmailsAdmin;
		container.innerHTML = adminAppShell(meta, {
			kicker: "Students",
			title: "Welcome Emails",
			copy: "Course-specific welcome email review, preview, and manual batch sending for enrolled students.",
			source: "WordPress admin sender",
			modifier: "welcome-emails",
			modeBadge: "WP Live",
			modeBadgeTone: "green",
			statusNote: "360 Match Mentorship manual sends are live. Automation remains disabled until explicitly enabled.",
			body: [
				'<div class="amos-grid one">',
				'<section class="amos-app-card amos-welcome-email-card">',
				'<div class="amos-card-heading"><h3>Course Welcome Sender</h3><span class="amos-pill green">Admin protected</span></div>',
				'<p>Open the protected sender to preview enrolled 360 students, choose recipients, and send the approved Michelle welcome email. Other course templates remain disabled until their final templates are approved.</p>',
				'<div class="amos-route-list">',
				routeRow("360 Match Mentorship", "Manual/batch welcome email sender is live."),
				routeRow("Automation", "Installed but off by default. Enable only after the next production approval step."),
				routeRow("Safety", "No email sends until selected students are checked and the Send button is submitted."),
				"</div>",
				'<div class="amos-action-row">',
				'<a class="amos-btn" href="' + escapeAttr(adminUrl) + '">Open Welcome Emails</a>',
				'<a class="amos-btn secondary" href="' + escapeAttr(adminUrl) + '" target="_blank" rel="noopener">Open in New Tab</a>',
				"</div>",
				'<iframe class="amos-admin-embed" title="MissionMed Welcome Emails" src="' + escapeAttr(adminUrl) + '"></iframe>',
				"</section>",
				"</div>"
			].join("")
		});
		bindAdminAppControls(container);
		if (runtimeContext && runtimeContext.routeSignal && runtimeContext.routeSignal.aborted) {
			return;
		}
	}

	function mountWpLegacyModule(container, runtimeContext, meta) {
		container.innerHTML = adminAppShell(meta, {
			kicker: meta.group || "Matrix Admin HQ",
			title: meta.label,
			copy: meta.purpose,
			source: "WordPress admin REST",
			modifier: "legacy",
			modeBadge: "WP Live",
			modeBadgeTone: "green",
			statusNote: "Same-origin read-only WordPress endpoints hydrate this panel while mmed_admin_os_live_data remains OFF.",
			body: '<div class="amos-live-body" data-amos-wp-legacy-body>' + renderWpLoading(meta.label) + "</div>"
		});

		loadWpLegacyModuleContent(meta, runtimeContext).then(function (rendered) {
			if (runtimeContext.routeSignal && runtimeContext.routeSignal.aborted) {
				return;
			}
			var body = container.querySelector("[data-amos-wp-legacy-body]");
			if (!body) {
				return;
			}
			body.innerHTML = rendered.html;
			bindLiveModuleControls(container, runtimeContext, meta, rendered.data || {});
			bindAdminAppControls(container);
			state.metrics.moduleUsableMs = Math.round(performance.now() - state.metrics.bootAt);
		}).catch(function (error) {
			var body = container.querySelector("[data-amos-wp-legacy-body]");
			if (body) {
				body.innerHTML = renderLiveException(meta.label, error);
			}
		});
	}

	function loadWpLegacyModuleContent(meta, runtimeContext) {
		if (meta.id === "newly-enrolled") {
			return renderWpNewlyEnrolledModule(runtimeContext);
		}
		if (meta.id === "leads") {
			return renderWpLeadsModule(runtimeContext);
		}
		if (meta.id === "enrollment-status") {
			return renderWpEnrollmentStatusModule(runtimeContext);
		}
		if (meta.id === "payments") {
			return renderWpPaymentsModule(runtimeContext);
		}
		if (meta.id === "course-access") {
			return renderWpCourseAccessModule(runtimeContext);
		}
		if (meta.id === "mission-residency") {
			return renderWpProgramModule(runtimeContext, "Mission Residency", "residency", /residency|match|interview|360|iv prep/i);
		}
		if (meta.id === "exam-prep") {
			return renderWpProgramModule(runtimeContext, "Exam Prep", "", /exam|usmle|step|drill|prep/i);
		}
			if (meta.id === "usce-clinicals") {
				return renderWpProgramModule(runtimeContext, "USCE / Clinicals", "clinicals", /usce|clinical/i);
			}
			if (meta.id === "usce-offers") {
				return renderWpUsceOffersBridgeModule(runtimeContext);
			}
			if (meta.id === "arena-stat") {
				return renderWpArenaStatModule(runtimeContext);
			}
		if (meta.id === "audit-logs") {
			return renderWpAuditLogsModule(runtimeContext);
		}
		if (meta.id === "reports") {
			return renderWpReportsModule(runtimeContext);
		}
		if (meta.id === "system-health") {
			return renderWpSystemHealthModule(runtimeContext);
		}
		return Promise.resolve({
			html: renderLiveUnavailable(meta.label, { ok: false, error: "No WordPress live renderer is registered for this module.", status: 0 }),
			data: {}
		});
	}

	function renderWpNewlyEnrolledModule(runtimeContext) {
		return wpGetSafe("/admin/hq/enrollments", { limit: 75 }, runtimeContext).then(function (result) {
			var data = resultData(result);
			var enrollments = normalizeArray(data.enrollments);
			var reviews = normalizeArray(data.access_reviews);
			var summary = data.summary || {};
			return {
				html: [
					renderEndpointIssues([result]),
					renderLiveCards([
						{ label: "Recent Enrollments", value: formatCount(summary.recent_enrollments || enrollments.length), note: "WooCommerce mapped orders", tone: "green" },
						{ label: "Access Reviews", value: formatCount(summary.access_reviews || reviews.length), note: "LearnDash cross-check", tone: reviews.length ? "gold" : "green" },
						{ label: "Paid Orders", value: formatCount(summary.paid_orders || 0), note: "processing/completed", tone: "blue" }
					]),
					'<div class="amos-live-layout">',
					livePanel("Onboarding Queue", renderEnrollmentRows(enrollments)),
					livePanel("Access Review Queue", renderSimpleList(reviews.slice(0, 16), enrollmentReviewSummary, "No access review items in the current Woo/LearnDash sample.")),
					"</div>"
				].join(""),
				data: { enrollments: enrollments }
			};
		});
	}

	function renderWpLeadsModule(runtimeContext) {
		return wpGetSafe("/admin/hq/leads", { limit: 75 }, runtimeContext).then(function (result) {
			var data = resultData(result);
			var leads = normalizeLeads(data.leads);
			var summary = data.summary || {};
			return {
				html: [
					renderEndpointIssues([result]),
					renderLiveCards([
						{ label: "Lead Signals", value: formatCount(summary.total || leads.length), note: "local WP/Woo signals", tone: "green" },
						{ label: "High Probability", value: formatCount(summary.high_probability || hotLeadCount(leads)), note: "pending checkout / on-hold", tone: "gold" },
						{ label: "CRM Feed", value: "Not claimed", note: "no fake CRM data", tone: "blue" }
					]),
					'<section class="amos-app-card">',
					'<div class="amos-live-toolbar">',
					'<label><span>Status</span><select data-amos-lead-filter><option value="all">All signals</option><option value="hot">Hot</option><option value="warm">Warm</option><option value="cold">Cold</option></select></label>',
					'<span class="amos-live-count" data-amos-lead-count>' + escapeHTML(leads.length) + " records</span>",
					"</div>",
					'<div data-amos-leads-table>' + renderLeadRows(leads) + "</div>",
					"</section>",
					livePanel("Source Contract", '<div class="amos-route-list">' +
						routeRow("WooCommerce checkout", "Pending, on-hold, failed, and cancelled orders are treated as follow-up signals.") +
						routeRow("WordPress registrations", "Recent accounts without sampled orders are visible as account leads.") +
						routeRow("Dedicated CRM", "Not claimed here until the canonical source is identified.") +
						"</div>")
				].join(""),
				data: { leads: leads }
			};
		});
	}

	function renderWpEnrollmentStatusModule(runtimeContext) {
		return Promise.all([
			wpGetSafe("/admin/hq/enrollments", { limit: 100 }, runtimeContext),
			wpGetSafe("/admin/hq/course-access", { limit: 125 }, runtimeContext)
		]).then(function (results) {
			var enrollData = resultData(results[0]);
			var accessData = resultData(results[1]);
			var enrollments = normalizeArray(enrollData.enrollments);
			var snapshots = normalizeArray(accessData.students);
			var reviews = normalizeArray(enrollData.access_reviews);
			return {
				html: [
					renderEndpointIssues(results),
					renderLiveCards([
						{ label: "Enrollment Rows", value: enrollments.length, note: "WooCommerce mapped products", tone: "green" },
						{ label: "Access Snapshots", value: snapshots.length, note: "LearnDash + access audit", tone: "blue" },
						{ label: "Manual Reviews", value: reviews.length, note: "payment/access mismatch", tone: reviews.length ? "gold" : "green" }
					]),
					'<div class="amos-live-grid two">',
					livePanel("Enrollment Cross-check", renderEnrollmentRows(enrollments)),
					livePanel("Access Snapshot", renderAccessSnapshotRows(snapshots)),
					livePanel("Manual Review", renderSimpleList(reviews.slice(0, 16), enrollmentReviewSummary, "No manual-review enrollment rows in the current sample.")),
					livePanel("Read-only Policy", '<div class="amos-route-list">' +
						routeRow("WooCommerce", "Orders are read only in Matrix Admin HQ.") +
						routeRow("LearnDash", "Course access is observed here, not changed.") +
						routeRow("Action path", "Make access/payment corrections in the source admin systems.") +
						"</div>"),
					"</div>"
				].join(""),
				data: {}
			};
		});
	}

	function renderWpPaymentsModule(runtimeContext) {
		return wpGetSafe("/admin/hq/payments", { limit: 100 }, runtimeContext).then(function (result) {
			var data = resultData(result);
			var summary = data.summary || {};
			var orders = normalizeArray(data.orders);
			var exceptions = normalizeArray(data.exceptions);
			return {
				html: [
					renderEndpointIssues([result]),
					renderLiveCards([
						{ label: "Recent Orders", value: formatCount(summary.orders || orders.length), note: "WooCommerce", tone: "green" },
						{ label: "Captured Revenue", value: formatMoney(summary.captured_revenue || 0), note: "recent processing/completed", tone: "green" },
						{ label: "Exceptions", value: formatCount(summary.exceptions || exceptions.length), note: "pending/on-hold/failed", tone: exceptions.length ? "gold" : "green" }
					]),
					'<div class="amos-live-layout">',
					'<section class="amos-app-card">',
					'<div class="amos-card-heading"><h3>Recent WooCommerce Orders</h3><span class="amos-pill blue">Read only</span></div>',
					renderPaymentRows(orders),
					"</section>",
					'<aside class="amos-app-card">',
					'<div class="amos-card-heading"><h3>Billing Exceptions</h3><span class="amos-pill gold">' + escapeHTML(exceptions.length) + "</span></div>",
					renderSimpleList(exceptions.slice(0, 16), paymentExceptionSummary, "No billing exceptions in the current WooCommerce sample."),
					'<div class="amos-card-heading"><h3>Stripe Boundary</h3><span class="amos-pill blue">Safe</span></div>',
					'<div class="amos-route-list">' + routeRow("Stripe", summary.stripe_note || "Represented through WooCommerce order status only.") + routeRow("Writes", "No payment, refund, subscription, or Stripe write actions are exposed here.") + "</div>",
					"</aside>",
					"</div>"
				].join(""),
				data: {}
			};
		});
	}

	function renderWpCourseAccessModule(runtimeContext) {
		return wpGetSafe("/admin/hq/course-access", { limit: 150 }, runtimeContext).then(function (result) {
			var data = resultData(result);
			var summary = data.summary || {};
			var mappings = normalizeArray(data.mappings);
			var snapshots = normalizeArray(data.students);
			var alerts = snapshots.filter(function (snapshot) {
				return safeCount(snapshot.alert_total) > 0;
			});
			return {
				html: [
					renderEndpointIssues([result]),
					renderLiveCards([
						{ label: "Mapped Students", value: formatCount(summary.total || snapshots.length), note: "products/courses matched", tone: "green" },
						{ label: "Healthy", value: formatCount(summary.healthy || 0), note: "no alert in sample", tone: "green" },
						{ label: "Access Reviews", value: formatCount(summary.access_reviews || alerts.length), note: "needs source-admin review", tone: alerts.length ? "gold" : "green" },
						{ label: "Mappings", value: formatCount(summary.mappings || mappings.length), note: "MissionMed settings", tone: "blue" }
					]),
					'<div class="amos-live-grid two">',
					livePanel("Product-to-course Mappings", renderAccessMappingRows(mappings)),
					livePanel("Students Needing Review", renderSimpleList(alerts.slice(0, 16), accessAlertSummary, "No access gaps in the current sample.")),
					livePanel("Access Snapshot", renderAccessSnapshotRows(snapshots)),
					livePanel("Warnings", renderWarnings(data.warnings || [])),
					"</div>"
				].join(""),
				data: {}
			};
		});
	}

		function renderWpProgramModule(runtimeContext, label, division, matcher) {
			return Promise.all([
				wpGetSafe("/admin/hq/course-access", division ? { division: division, limit: 150 } : { limit: 150 }, runtimeContext),
			wpGetSafe("/admin/hq/students", { limit: 75 }, runtimeContext),
			wpGetSafe("/admin/hq/media", null, runtimeContext),
			wpGetSafe("/events", { start: new Date().toISOString() }, runtimeContext)
		]).then(function (results) {
			var accessData = resultData(results[0]);
			var students = normalizeStudents(resultData(results[1]).students);
			var snapshots = normalizeArray(accessData.students);
			var videos = normalizeArray(resultData(results[2]).videos).filter(function (video) {
				return matcher.test([video.title, video.division_label, video.category_label, (video.topics || []).join(" ")].join(" "));
			});
			var events = normalizeCalendarEvents(resultItems(results[3], ["events", "items", "data"])).filter(function (event) {
				return matcher.test([firstValue(event, ["title"], ""), firstValue(event, ["event_type", "type"], ""), firstValue(event, ["category"], "")].join(" "));
			});
			var programStudents = snapshots.length ? snapshots : students.filter(function (student) {
				return matcher.test([programName(student), firstValue(student, ["latest_order_item"], ""), (student.courses || []).map(function (course) { return course.title; }).join(" ")].join(" "));
			});
			var alerts = programStudents.filter(function (student) {
				return safeCount(student.alert_total) > 0 || /pending|review|hold|missing|not_unlocked/i.test(JSON.stringify(student));
			});
			return {
				html: [
					renderEndpointIssues(results),
					renderLiveCards([
						{ label: "Students", value: programStudents.length, note: label + " scope", tone: "green" },
						{ label: "Reviews", value: alerts.length, note: "access/order signals", tone: alerts.length ? "gold" : "green" },
						{ label: "Calendar", value: events.length, note: "upcoming matched events", tone: "blue" },
						{ label: "Videos", value: videos.length, note: "manifest matches", tone: "blue" }
					]),
					'<div class="amos-live-grid two">',
					livePanel(label + " Students", renderAccessSnapshotRows(programStudents)),
					livePanel("Upcoming Calendar", renderSimpleList(events.slice(0, 12), calendarEventSummary, "No matched upcoming calendar events.")),
					livePanel("Video Library Matches", renderSimpleList(videos.slice(0, 12), videoSummary, "No matched video assets in the manifest sample.")),
					livePanel("Operational Boundary", '<div class="amos-route-list">' +
						routeRow("Course access", "Observed through LearnDash and access-audit mappings.") +
						routeRow("Payments", "Observed through WooCommerce orders only.") +
						routeRow("Writes", "Program write tools remain in source systems.") +
						"</div>"),
					"</div>"
				].join(""),
				data: {}
			};
			});
		}

		function renderWpUsceOffersBridgeModule(runtimeContext) {
			return Promise.all([
				wpGetSafe("/admin/hq/course-access", { division: "clinicals", limit: 150 }, runtimeContext),
				wpGetSafe("/admin/hq/enrollments", { limit: 100 }, runtimeContext),
				wpGetSafe("/admin/hq/system-health", null, runtimeContext)
			]).then(function (results) {
				var accessData = resultData(results[0]);
				var enrollmentData = resultData(results[1]);
				var snapshots = normalizeArray(accessData.students);
				var clinicalEnrollments = normalizeArray(enrollmentData.enrollments).filter(function (row) {
					return /usce|clinical/i.test([row.program, row.product, row.course, row.division].join(" "));
				});
				var reviews = snapshots.filter(function (snapshot) {
					return safeCount(snapshot.alert_total) > 0;
				});
				return {
					html: [
						renderEndpointIssues(results),
						renderLiveCards([
							{ label: "Clinical Students", value: formatCount(snapshots.length), note: "WP/LearnDash access", tone: "green" },
							{ label: "Offer Candidates", value: formatCount(clinicalEnrollments.length), note: "USCE order/access signals", tone: "blue" },
							{ label: "Access Reviews", value: formatCount(reviews.length), note: "resolve before offers", tone: reviews.length ? "gold" : "green" },
							{ label: "Offer Actions", value: "Blocked", note: "Railway DNS/API proof required", tone: "gold" }
						]),
						'<div class="amos-live-grid two">',
						livePanel("USCE Offer Candidate Queue", renderEnrollmentRows(clinicalEnrollments)),
						livePanel("Clinical Access Review", renderSimpleList(reviews.slice(0, 16), accessAlertSummary, "No clinical access review rows in the current sample.")),
						livePanel("Clinical Student Snapshot", renderAccessSnapshotRows(snapshots)),
						livePanel("Action Boundary", '<div class="amos-route-list">' +
							routeRow("Visible now", "Clinical order/course/access context is hydrated from WordPress, WooCommerce, and LearnDash.") +
							routeRow("Still blocked", "Offer creation, send, revoke, and decision actions require the Railway USCE offer engine to resolve and authenticate.") +
							routeRow("Feature flag", "mmed_admin_os_live_data can stay OFF; this bridge does not call Railway.") +
							"</div>"),
						"</div>"
					].join(""),
					data: {}
				};
			});
		}

		function renderWpArenaStatModule(runtimeContext) {
		return Promise.all([
			wpGetSafe("/admin/hq/system-health", null, runtimeContext),
			wpGetSafe("/admin/hq/media", null, runtimeContext),
			wpGetSafe("/admin/hq/students", { limit: 50 }, runtimeContext)
		]).then(function (results) {
			var health = resultData(results[0]);
			var media = resultData(results[1]);
			var students = normalizeStudents(resultData(results[2]).students);
			return {
				html: [
					renderEndpointIssues(results),
					renderLiveCards([
						{ label: "Arena Class", value: getPath(health, "classes.arena") ? "Loaded" : "Unavailable", note: "read-only class check", tone: getPath(health, "classes.arena") ? "green" : "gold" },
						{ label: "Drill Engine", value: getPath(health, "classes.drill_game") ? "Loaded" : "Unavailable", note: "no drill mutation", tone: getPath(health, "classes.drill_game") ? "green" : "gold" },
						{ label: "Students", value: students.length, note: "support sample", tone: "blue" },
						{ label: "Video Assets", value: formatCount(getPath(media, "summary.total_videos") || 0), note: "R2/video manifest", tone: "blue" }
					]),
					livePanel("Protected Oversight", '<div class="amos-route-list">' +
						routeRow("Arena / STAT", "Health is visible here; runtime files and scoring systems are untouched.") +
						routeRow("Drills / Daily", "No drill pipeline endpoints, schemas, registries, or assets are changed by this panel.") +
						routeRow("Support use", "Use this as a triage surface before opening protected Arena/STAT tools.") +
						"</div>")
				].join(""),
				data: {}
			};
		});
	}

	function renderWpAuditLogsModule(runtimeContext) {
		return Promise.all([
			wpGetSafe("/admin/hq/course-access", { limit: 150 }, runtimeContext),
			wpGetSafe("/admin/hq/system-health", null, runtimeContext),
			wpGetSafe("/notifications", { limit: 30 }, runtimeContext)
		]).then(function (results) {
			var access = resultData(results[0]);
			var snapshots = normalizeArray(access.students);
			var alerts = snapshots.filter(function (snapshot) {
				return safeCount(snapshot.alert_total) > 0;
			});
			var notifications = resultItems(results[2], ["notifications", "items", "data"]);
			return {
				html: [
					renderEndpointIssues(results),
					renderLiveCards([
						{ label: "Access Alerts", value: alerts.length, note: "Woo/LearnDash audit", tone: alerts.length ? "gold" : "green" },
						{ label: "Notifications", value: notifications.length, note: "WP user notifications", tone: "blue" },
						{ label: "Health Routes", value: safeCount(getPath(resultData(results[1]), "routes")), note: "Admin HQ endpoints", tone: "green" }
					]),
					'<div class="amos-live-grid two">',
					livePanel("Access Audit Alerts", renderSimpleList(alerts.slice(0, 16), accessAlertSummary, "No access audit alerts in the current sample.")),
					livePanel("Notifications", renderSimpleList(notifications.slice(0, 16), notificationSummary, "No notifications returned.")),
					livePanel("Runtime Files", '<div class="amos-route-list">' + objectRows(getPath(resultData(results[1]), "files") || {}).join("") + "</div>"),
					livePanel("Audit Boundary", '<div class="amos-route-list">' +
						routeRow("Read model", "Matrix Admin HQ wraps source data for review.") +
						routeRow("Write model", "Corrections stay in WooCommerce, LearnDash, Scheduler, and source admin tools.") +
						"</div>"),
					"</div>"
				].join(""),
				data: {}
			};
		});
	}

	function renderWpReportsModule(runtimeContext) {
		return Promise.all([
			wpGetSafe("/admin/hq/overview", null, runtimeContext),
			wpGetSafe("/admin/hq/payments", { limit: 100 }, runtimeContext),
			wpGetSafe("/admin/hq/course-access", { limit: 150 }, runtimeContext),
			wpGetSafe("/admin/hq/media", null, runtimeContext)
		]).then(function (results) {
			var overview = resultData(results[0]).summary || {};
			var payments = resultData(results[1]).summary || {};
			var access = resultData(results[2]).summary || {};
			var media = resultData(results[3]);
			var videos = normalizeArray(media.videos);
			return {
				html: [
					renderEndpointIssues(results),
					renderLiveCards([
						{ label: "Students", value: formatCount(overview.students || 0), note: "WP sample", tone: "green" },
						{ label: "Revenue", value: formatMoney(payments.captured_revenue || 0), note: "recent WooCommerce", tone: "gold" },
						{ label: "Access Reviews", value: formatCount(access.access_reviews || 0), note: "LearnDash/Woo audit", tone: access.access_reviews ? "gold" : "green" },
						{ label: "Video Assets", value: formatCount(getPath(media, "summary.total_videos") || videos.length), note: "R2/video manifest", tone: "blue" }
					]),
					'<div class="amos-live-grid two">',
					livePanel("Operational Summary", '<div class="amos-route-list">' + objectRows(overview).join("") + "</div>"),
					livePanel("Payment Overview", '<div class="amos-route-list">' + objectRows(payments).join("") + "</div>"),
					livePanel("Course Access Summary", '<div class="amos-route-list">' + objectRows(access).join("") + "</div>"),
					livePanel("Video Library", renderSimpleList(videos.slice(0, 16), videoSummary, "No videos returned from the manifest.")),
					"</div>"
				].join(""),
				data: {}
			};
		});
	}

	function renderWpSystemHealthModule(runtimeContext) {
		return wpGetSafe("/admin/hq/system-health", null, runtimeContext).then(function (result) {
			var data = resultData(result);
			var summary = data.summary || {};
			return {
				html: [
					renderEndpointIssues([result]),
					renderLiveCards([
						{ label: "Feature Flag", value: summary.feature_flag === "1" ? "ON" : "OFF", note: "mmed_admin_os_live_data", tone: summary.feature_flag === "1" ? "gold" : "green" },
						{ label: "WooCommerce", value: summary.woocommerce_active ? "Loaded" : "Unavailable", note: "payments/enrollment source", tone: summary.woocommerce_active ? "green" : "gold" },
						{ label: "LearnDash", value: summary.learndash_active ? "Loaded" : "Unavailable", note: "course access source", tone: summary.learndash_active ? "green" : "gold" },
						{ label: "Admin Routes", value: safeCount(data.routes), note: "same-origin endpoints", tone: "blue" }
					]),
					'<div class="amos-live-grid two">',
					livePanel("Runtime Classes", '<div class="amos-route-list">' + objectRows(data.classes || {}).join("") + "</div>"),
					livePanel("Source Files", '<div class="amos-route-list">' + objectRows(data.files || {}).join("") + "</div>"),
					livePanel("Admin HQ Routes", renderSimpleList(normalizeArray(data.routes).map(function (route) { return { route: route }; }), function (item) { return [item.route, "Registered admin endpoint", "mmed/v1"]; }, "No Admin HQ routes returned.")),
					livePanel("Protected Systems", '<div class="amos-route-list">' +
						routeRow("Student Matrix", "Not touched by this Admin HQ panel wiring.") +
						routeRow("Payments/LearnDash", "Read-only in Matrix Admin HQ.") +
						routeRow("R2/Supabase/Railway/DNS", "No configuration changes from this panel.") +
						"</div>"),
					"</div>"
				].join(""),
				data: {}
			};
		});
	}

	function mountLegacyModule(container, runtimeContext, meta) {
		container.innerHTML = adminAppShell(meta, {
			kicker: "Railway HQ",
			title: meta.label,
			copy: meta.purpose,
			source: "Railway HQ API",
			modifier: "legacy",
			modeBadge: "Railway Live",
			modeBadgeTone: "green",
			statusNote: "Feature flag mmed_admin_os_live_data is ON. Railway calls are scoped to this module.",
			body: '<div class="amos-live-body" data-amos-live-module-body>' + renderLiveLoading(meta.label) + "</div>"
		});

		loadLegacyModuleContent(meta, runtimeContext).then(function (rendered) {
			if (runtimeContext.routeSignal && runtimeContext.routeSignal.aborted) {
				return;
			}
			var body = container.querySelector("[data-amos-live-module-body]");
			if (!body) {
				return;
			}
			body.innerHTML = rendered.html;
			bindLiveModuleControls(container, runtimeContext, meta, rendered.data || {});
			bindAdminAppControls(container);
			state.metrics.moduleUsableMs = Math.round(performance.now() - state.metrics.bootAt);
		}).catch(function (error) {
			var body = container.querySelector("[data-amos-live-module-body]");
			if (body) {
				body.innerHTML = renderLiveException(meta.label, error);
			}
		});
	}

	function loadLegacyModuleContent(meta, runtimeContext) {
		if (meta.id === "student-management") {
			return renderStudentManagementModule(runtimeContext);
		}
		if (meta.id === "leads") {
			return renderLeadsModule(runtimeContext);
		}
		if (meta.id === "payments") {
			return renderPaymentsModule(runtimeContext);
		}
		if (meta.id === "newly-enrolled") {
			return renderNewlyEnrolledModule(runtimeContext);
		}
		if (meta.id === "enrollment-status") {
			return renderEnrollmentStatusModule(runtimeContext);
		}
		if (meta.id === "course-access") {
			return renderCourseAccessModule(runtimeContext);
		}
		if (meta.id === "alerts") {
			return renderAlertsModule(runtimeContext);
		}
		if (meta.id === "daily-command") {
			return renderDailyCommandModule(runtimeContext);
		}
		if (meta.id === "usce-clinicals") {
			return renderUsceClinicalsModule(runtimeContext);
		}
		if (meta.id === "usce-offers") {
			return renderUsceOffersModule(runtimeContext);
		}
		if (meta.id === "mission-residency") {
			return renderProgramModule(runtimeContext, "Mission Residency", /mission\s*residency|residency|mr/i);
		}
		if (meta.id === "exam-prep") {
			return renderProgramModule(runtimeContext, "Exam Prep", /exam|usmle|step|drill|prep/i);
		}
		if (meta.id === "arena-stat") {
			return renderArenaStatModule(runtimeContext);
		}
		if (meta.id === "reports") {
			return renderReportsModule(runtimeContext);
		}
		if (meta.id === "system-health") {
			return renderSystemHealthModule(runtimeContext);
		}
		if (meta.id === "audit-logs") {
			return renderAuditLogsModule(runtimeContext);
		}
		return Promise.resolve({
			html: renderLiveUnavailable(meta.label, { ok: false, error: "No live renderer is registered for this module.", status: 0 }),
			data: {}
		});
	}

	function renderStudentManagementModule(runtimeContext) {
		return railwayGetSafe("/api/hq/students", null, runtimeContext).then(function (studentsResult) {
			var students = normalizeStudents(resultItems(studentsResult, ["items", "students", "data"]));
			var needingAction = students.filter(function (student) {
				return /review|pending|inactive|action|hold/i.test(statusText(student));
			});
			return {
				html: [
					renderEndpointIssues([studentsResult]),
					renderLiveCards([
						{ label: "Students", value: students.length, note: "Railway student records", tone: "green" },
						{ label: "Needs Action", value: needingAction.length, note: "Pending, review, inactive, or hold", tone: "gold" },
						{ label: "Operator", value: operatorLabel(), note: "UI scope hint only", tone: "blue" }
					]),
					'<div class="amos-live-layout">',
					'<section class="amos-app-card">',
					'<div class="amos-live-toolbar">',
					'<label><span>Search students</span><input type="search" data-amos-student-search placeholder="Name, email, or program"></label>',
					'<span class="amos-live-count" data-amos-student-count>' + escapeHTML(students.length) + " records</span>",
					"</div>",
					'<div data-amos-students-table>' + renderStudentRows(students) + "</div>",
					"</section>",
					'<aside class="amos-app-card amos-live-detail" data-amos-student-detail>',
					renderStudentDetail(students[0]),
					"</aside>",
					"</div>"
				].join(""),
				data: { students: students }
			};
		});
	}

	function renderLeadsModule(runtimeContext) {
		return Promise.all([
			railwayGetSafe("/api/hq/leads", null, runtimeContext),
			railwayGetSafe("/api/supabase/leads/summary", null, runtimeContext)
		]).then(function (results) {
			var leadsResult = results[0];
			var summaryResult = results[1];
			var leads = normalizeLeads(resultItems(leadsResult, ["items", "leads", "data", "topLeads"]));
			var metrics = resultData(summaryResult).metrics || resultData(summaryResult) || {};
			return {
				html: [
					renderEndpointIssues(results),
					renderLiveCards([
						{ label: "Leads", value: metrics.total || leads.length, note: "Total lead records", tone: "green" },
						{ label: "High Probability", value: metrics.high_probability || hotLeadCount(leads), note: "Hot follow-up signals", tone: "gold" },
						{ label: "Average Score", value: formatCount(metrics.average_score || averageLeadScore(leads)), note: "Railway summary", tone: "blue" }
					]),
					'<section class="amos-app-card">',
					'<div class="amos-live-toolbar">',
					'<label><span>Status</span><select data-amos-lead-filter><option value="all">All leads</option><option value="hot">Hot</option><option value="warm">Warm</option><option value="cold">Cold</option></select></label>',
					'<span class="amos-live-count" data-amos-lead-count>' + escapeHTML(leads.length) + " records</span>",
					"</div>",
					'<div data-amos-leads-table>' + renderLeadRows(leads) + "</div>",
					"</section>"
				].join(""),
				data: { leads: leads }
			};
		});
	}

	function renderPaymentsModule(runtimeContext) {
		return Promise.all([
			railwayGetSafe("/api/hq/payments/overview", null, runtimeContext),
			railwayGetSafe("/api/hq/payments", null, runtimeContext),
			railwayGetSafe("/api/hq/payments/exceptions", null, runtimeContext),
			railwayGetSafe("/api/hq/payments/stripe-accounts", null, runtimeContext)
		]).then(function (results) {
			var overview = resultData(results[0]);
			var payments = resultItems(results[1], ["items", "payments", "transactions", "data"]);
			var exceptions = resultItems(results[2], ["failed_payments", "items", "exceptions", "missing_enrollments"]);
			var stripeAccounts = resultItems(results[3], ["items", "accounts", "stripe_accounts"]);
			var overviewCards = firstArray(overview, ["cards"]) || [];
			var meta = overview.meta || {};
			return {
				html: [
					renderEndpointIssues(results),
					renderLiveCards([
						{ label: "Captured Revenue", value: formatMoney(firstPaymentCardValue(overviewCards) || meta.captured_revenue || meta.revenue || 0), note: "Railway payment overview", tone: "green" },
						{ label: "Transactions", value: meta.transaction_count || payments.length, note: "Payment records", tone: "blue" },
						{ label: "Exceptions", value: meta.failed_transactions || exceptions.length, note: "Failed or unmapped payments", tone: "gold" },
						{ label: "Stripe Accounts", value: meta.stripe_accounts || stripeAccounts.length, note: "Read-only status", tone: "blue" }
					]),
					'<div class="amos-live-layout">',
					'<section class="amos-app-card">',
					'<div class="amos-card-heading"><h3>Recent Payments</h3><span class="amos-pill blue">Read only</span></div>',
					renderPaymentRows(payments),
					"</section>",
					'<aside class="amos-app-card">',
					'<div class="amos-card-heading"><h3>Exceptions</h3><span class="amos-pill gold">' + escapeHTML(exceptions.length) + "</span></div>",
					renderSimpleList(exceptions.slice(0, 12), paymentExceptionSummary, "No payment exceptions returned."),
					'<div class="amos-card-heading"><h3>Stripe Accounts</h3><span class="amos-pill blue">' + escapeHTML(stripeAccounts.length) + "</span></div>",
					renderSimpleList(stripeAccounts.slice(0, 8), stripeAccountSummary, "No Stripe account rows returned."),
					"</aside>",
					"</div>"
				].join(""),
				data: {}
			};
		});
	}

	function renderNewlyEnrolledModule(runtimeContext) {
		return railwayGetSafe("/api/hq/students", { recent: 1 }, runtimeContext).then(function (studentsResult) {
			var students = normalizeStudents(resultItems(studentsResult, ["items", "students", "data"]));
			var recent = students.slice().sort(function (a, b) {
				return timestampFromStudent(b) - timestampFromStudent(a);
			}).slice(0, 40);
			return {
				html: [
					renderEndpointIssues([studentsResult]),
					renderLiveCards([
						{ label: "Recent Enrollments", value: recent.length, note: "Sorted by enrollment signal", tone: "green" },
						{ label: "Needs Onboarding", value: recent.filter(function (student) { return /new|pending|onboarding|review/i.test(statusText(student)); }).length, note: "Welcome or access review", tone: "gold" }
					]),
					'<section class="amos-app-card">',
					'<div class="amos-card-heading"><h3>Onboarding Queue</h3><span class="amos-pill green">Read only</span></div>',
					renderStudentRows(recent),
					"</section>"
				].join(""),
				data: { students: recent }
			};
		});
	}

	function renderEnrollmentStatusModule(runtimeContext) {
		return railwayGetSafe("/api/hq/students", null, runtimeContext).then(function (studentsResult) {
			var students = normalizeStudents(resultItems(studentsResult, ["items", "students", "data"]));
			var rows = students.map(function (student) {
				return [
					personName(student),
					programName(student),
					firstValue(student, ["enrollment_status", "enrollmentStatus", "enrollment.status", "status"], "Unknown"),
					firstValue(student, ["access_status", "accessStatus", "course_access", "access"], "Unknown"),
					firstValue(student, ["payment_status", "paymentStatus", "billing.status"], "Unknown")
				];
			});
			return {
				html: [
					renderEndpointIssues([studentsResult]),
					renderLiveCards([
						{ label: "Enrollment Rows", value: students.length, note: "Railway student feed", tone: "green" },
						{ label: "Manual Review", value: rows.filter(function (row) { return /unknown|pending|manual|hold/i.test(row.join(" ")); }).length, note: "Cross-check candidates", tone: "gold" }
					]),
					'<section class="amos-app-card">',
					'<div class="amos-card-heading"><h3>Enrollment Cross-check</h3><span class="amos-pill blue">Read only</span></div>',
					liveTable(["Student", "Program", "Enrollment", "Access", "Payment"], rows, "No enrollment rows returned."),
					"</section>"
				].join(""),
				data: {}
			};
		});
	}

	function renderCourseAccessModule(runtimeContext) {
		return railwayGetSafe("/api/hq/students", null, runtimeContext).then(function (studentsResult) {
			var students = normalizeStudents(resultItems(studentsResult, ["items", "students", "data"]));
			var groups = groupBy(students, programName);
			var groupRows = Object.keys(groups).sort().map(function (program) {
				var items = groups[program];
				var pending = items.filter(function (student) {
					return /pending|manual|hold|unknown|missing/i.test(firstValue(student, ["access_status", "accessStatus", "course_access", "access"], ""));
				});
				return [program, items.length, pending.length, "Railway student access feed"];
			});
			return {
				html: [
					renderEndpointIssues([studentsResult]),
					renderLiveCards([
						{ label: "Programs", value: groupRows.length, note: "Grouped by course/program", tone: "green" },
						{ label: "Access Reviews", value: groupRows.reduce(function (sum, row) { return sum + Number(row[2] || 0); }, 0), note: "Pending or unknown access", tone: "gold" }
					]),
					'<section class="amos-app-card">',
					'<div class="amos-card-heading"><h3>Product-to-course Verification</h3><span class="amos-pill blue">Read only</span></div>',
					liveTable(["Program / Course", "Students", "Access Reviews", "Source"], groupRows, "No course access records returned."),
					"</section>"
				].join(""),
				data: {}
			};
		});
	}

	function renderAlertsModule(runtimeContext) {
		return Promise.all([
			railwayGetSafe("/api/hq/tasks", null, runtimeContext),
			railwayGetSafe("/api/hq/notifications", null, runtimeContext)
		]).then(function (results) {
			var tasks = normalizeTasks(resultItems(results[0], ["items", "tasks", "data"]));
			var notifications = resultItems(results[1], ["items", "notifications", "data"]);
			var openTasks = tasks.filter(function (task) {
				return !/done|closed|complete/i.test(statusText(task));
			});
			return {
				html: [
					renderEndpointIssues(results),
					renderLiveCards([
						{ label: "Open Tasks", value: openTasks.length, note: "Railway task queue", tone: "gold" },
						{ label: "Notifications", value: notifications.length, note: "Admin notification stream", tone: "blue" }
					]),
					'<div class="amos-live-layout">',
					'<section class="amos-app-card">',
					'<div class="amos-card-heading"><h3>Priority Queue</h3><span class="amos-pill gold">PATCH enabled</span></div>',
					renderTaskRows(tasks),
					"</section>",
					'<aside class="amos-app-card">',
					'<div class="amos-card-heading"><h3>Notifications</h3><span class="amos-pill blue">' + escapeHTML(notifications.length) + "</span></div>",
					renderSimpleList(notifications.slice(0, 16), notificationSummary, "No notifications returned."),
					"</aside>",
					"</div>"
				].join(""),
				data: { tasks: tasks }
			};
		});
	}

	function renderDailyCommandModule(runtimeContext) {
		return Promise.all([
			railwayGetSafe("/api/hq/tasks", { due: "today" }, runtimeContext),
			railwayGetSafe("/api/hq/payments/exceptions", null, runtimeContext),
			railwayGetSafe("/api/hq/students", { recent: 1 }, runtimeContext),
			railwayGetSafe("/api/hq/notifications", null, runtimeContext),
			railwayGetSafe("/api/hq/medmail", null, runtimeContext)
		]).then(function (results) {
			var tasks = normalizeTasks(resultItems(results[0], ["items", "tasks", "data"]));
			var exceptions = resultItems(results[1], ["failed_payments", "items", "exceptions", "missing_enrollments"]);
			var students = normalizeStudents(resultItems(results[2], ["items", "students", "data"]));
			var notifications = resultItems(results[3], ["items", "notifications", "data"]);
			var medmail = resultItems(results[4], ["items", "emails", "messages", "data"]);
			return {
				html: [
					renderEndpointIssues(results),
					renderLiveCards([
						{ label: "Tasks Due", value: tasks.length, note: "Due today filter", tone: "gold" },
						{ label: "Payment Exceptions", value: exceptions.length, note: "Billing review", tone: "blue" },
						{ label: "Recent Students", value: students.length, note: "Enrollment/onboarding signals", tone: "green" },
						{ label: "Messages", value: medmail.length || notifications.length, note: "MedMail and notifications", tone: "blue" }
					]),
					'<div class="amos-live-grid two">',
					livePanel("Tasks Due Today", renderTaskRows(tasks.slice(0, 12))),
					livePanel("Payment Exceptions", renderSimpleList(exceptions.slice(0, 12), paymentExceptionSummary, "No payment exceptions returned.")),
					livePanel("Recent Enrollments", renderStudentRows(students.slice(0, 12))),
					livePanel("Notifications", renderSimpleList(notifications.slice(0, 12), notificationSummary, "No notifications returned.")),
					"</div>"
				].join(""),
				data: { tasks: tasks }
			};
		});
	}

	function renderUsceClinicalsModule(runtimeContext) {
		return Promise.all([
			railwayGetSafe("/api/usce/analytics/summary", null, runtimeContext),
			railwayGetSafe("/api/usce/requests", null, runtimeContext),
			railwayGetSafe("/api/usce/programs", null, runtimeContext)
		]).then(function (results) {
			var analytics = resultData(results[0]);
			var metrics = analytics.metrics || analytics || {};
			var requests = resultItems(results[1], ["items", "requests", "data"]);
			var programs = resultItems(results[2], ["items", "programs", "data"]);
			return {
				html: [
					renderEndpointIssues(results),
					renderLiveCards([
						{ label: "Requests", value: metrics.total_requests || requests.length, note: "USCE request queue", tone: "green" },
						{ label: "Active Offers", value: metrics.active_offers || metrics.activeOffers || 0, note: "Offer pipeline", tone: "gold" },
						{ label: "Confirmed", value: metrics.confirmed_placements || metrics.confirmedPlacements || 0, note: "Placements", tone: "blue" },
						{ label: "Revenue", value: formatMoney(metrics.revenue || metrics.captured_revenue || 0), note: "USCE analytics", tone: "green" }
					]),
					'<div class="amos-live-layout">',
					'<section class="amos-app-card">',
					'<div class="amos-card-heading"><h3>Request Queue</h3><span class="amos-pill blue">Operator scoped</span></div>',
					renderUsceRequestRows(requests),
					"</section>",
					'<aside class="amos-app-card">',
					'<div class="amos-card-heading"><h3>Clinical Programs</h3><span class="amos-pill gold">' + escapeHTML(programs.length) + "</span></div>",
					renderSimpleList(programs.slice(0, 16), usceProgramSummary, "No clinical programs returned."),
					"</aside>",
					"</div>"
				].join(""),
				data: { requests: requests }
			};
		});
	}

	function renderUsceOffersModule(runtimeContext) {
		return railwayGetSafe("/api/usce/offers", null, runtimeContext).then(function (offersResult) {
			var offers = resultItems(offersResult, ["items", "offers", "data"]);
			var pipeline = groupBy(offers, function (offer) {
				return offerStage(offer);
			});
			return {
				html: [
					renderEndpointIssues([offersResult]),
					renderLiveCards([
						{ label: "Offers", value: offers.length, note: "USCE offer records", tone: "green" },
						{ label: "Confirmed", value: offers.filter(function (offer) { return /confirm/i.test(statusText(offer)); }).length, note: "Confirmed placements", tone: "blue" },
						{ label: "Pending Payment", value: offers.filter(function (offer) { return /payment|invoice|checkout/i.test(statusText(offer)); }).length, note: "Payment state from Railway", tone: "gold" }
					]),
					'<section class="amos-app-card">',
					'<div class="amos-card-heading"><h3>Offer Pipeline</h3><span class="amos-pill gold">Admin workflow</span></div>',
					renderOfferPipeline(pipeline),
					"</section>"
				].join(""),
				data: { offers: offers }
			};
		});
	}

	function renderProgramModule(runtimeContext, label, matcher) {
		return railwayGetSafe("/api/hq/students", null, runtimeContext).then(function (studentsResult) {
			var students = normalizeStudents(resultItems(studentsResult, ["items", "students", "data"]));
			var programStudents = students.filter(function (student) {
				return matcher.test(programName(student) + " " + firstValue(student, ["product", "course", "division"], ""));
			});
			return {
				html: [
					renderEndpointIssues([studentsResult]),
					renderLiveCards([
						{ label: "Active Students", value: programStudents.length, note: label + " program scope", tone: "green" },
						{ label: "Needs Review", value: programStudents.filter(function (student) { return /pending|review|hold|inactive/i.test(statusText(student)); }).length, note: "Status signals", tone: "gold" }
					]),
					'<section class="amos-app-card">',
					'<div class="amos-card-heading"><h3>' + escapeHTML(label) + ' Students</h3><span class="amos-pill blue">Read only</span></div>',
					renderStudentRows(programStudents),
					"</section>"
				].join(""),
				data: { students: programStudents }
			};
		});
	}

	function renderArenaStatModule(runtimeContext) {
		return railwayGetSafe("/api/hq/summary", null, runtimeContext).then(function (summaryResult) {
			var summary = resultData(summaryResult);
			var metrics = summary.metrics || {};
			return {
				html: [
					renderEndpointIssues([summaryResult]),
					renderLiveCards([
						{ label: "Students", value: metrics.students || 0, note: "HQ summary", tone: "green" },
						{ label: "Open Tasks", value: metrics.openTasks || 0, note: "Arena/STAT support proxy", tone: "gold" },
						{ label: "Media Ready", value: metrics.mediaReady || 0, note: "Video/media readiness", tone: "blue" }
					]),
					livePanel("Oversight Signals", '<div class="amos-route-list">' + [
						routeRow("Arena health", "Read-only HQ summary signal"),
						routeRow("STAT status", "No Arena or STAT runtime mutation"),
						routeRow("Support review", formatCount(metrics.openTasks || 0) + " open tasks")
					].join("") + "</div>")
				].join(""),
				data: {}
			};
		});
	}

	function renderReportsModule(runtimeContext) {
		return Promise.all([
			railwayGetSafe("/api/hq/summary", null, runtimeContext),
			railwayGetSafe("/api/hq/payments/overview", null, runtimeContext),
			railwayGetSafe("/api/hq/students", null, runtimeContext),
			railwayGetSafe("/api/media/unified/stats", null, runtimeContext),
			railwayGetSafe("/api/hq/video-workflow", null, runtimeContext)
		]).then(function (results) {
			var summary = resultData(results[0]);
			var metrics = summary.metrics || {};
			var paymentMeta = resultData(results[1]).meta || {};
			var students = resultItems(results[2], ["items", "students", "data"]);
			var media = resultData(results[3]);
			var workflow = resultData(results[4]);
			return {
				html: [
					renderEndpointIssues(results),
					renderLiveCards([
						{ label: "Students", value: metrics.students || students.length, note: "Student reporting", tone: "green" },
						{ label: "Revenue", value: formatMoney(metrics.capturedRevenue || paymentMeta.captured_revenue || paymentMeta.revenue || 0), note: "Payment overview", tone: "gold" },
						{ label: "Media Assets", value: getPath(media, "counts.total") || getPath(media, "total") || 0, note: "Unified media stats", tone: "blue" },
						{ label: "Video Items", value: safeCount(firstArray(workflow, ["items", "courses", "recent_publications"])), note: "Video workflow", tone: "blue" }
					]),
					'<div class="amos-live-grid two">',
					livePanel("Operational Summary", '<div class="amos-route-list">' + objectRows(metrics).join("") + "</div>"),
					livePanel("Payment Overview", '<div class="amos-route-list">' + objectRows(paymentMeta).join("") + "</div>"),
					livePanel("Media Stats", '<div class="amos-route-list">' + objectRows(media.counts || media.metrics || media).join("") + "</div>"),
					livePanel("Video Workflow", '<div class="amos-route-list">' + objectRows(workflow.metrics || workflow).join("") + "</div>"),
					"</div>"
				].join(""),
				data: {}
			};
		});
	}

	function renderAuditLogsModule(runtimeContext) {
		return Promise.all([
			railwayGetSafe("/api/hq/notifications", null, runtimeContext),
			railwayGetSafe("/api/hq/tasks", null, runtimeContext),
			railwayGetSafe("/api/auth/session", null, runtimeContext)
		]).then(function (results) {
			var notifications = resultItems(results[0], ["items", "notifications", "data"]);
			var tasks = normalizeTasks(resultItems(results[1], ["items", "tasks", "data"]));
			var session = resultData(results[2]);
			return {
				html: [
					renderEndpointIssues(results),
					renderLiveCards([
						{ label: "Notifications", value: notifications.length, note: "Activity proxy", tone: "blue" },
						{ label: "Tasks", value: tasks.length, note: "Admin task history", tone: "gold" },
						{ label: "Railway Session", value: session.authenticated === false ? "Closed" : "Checked", note: "Auth/session probe", tone: "green" }
					]),
					'<div class="amos-live-layout">',
					livePanel("Recent Admin Signals", renderSimpleList(notifications.slice(0, 16), notificationSummary, "No notifications returned.")),
					livePanel("Task Activity", renderTaskRows(tasks.slice(0, 16))),
					"</div>"
				].join(""),
				data: { tasks: tasks }
			};
		});
	}

	function renderSystemHealthModule(runtimeContext) {
		return Promise.all([
			railwayGetSafe("/api/auth/session", null, runtimeContext),
			railwayGetSafe("/api/bootstrap", null, runtimeContext),
			railwayGetSafe("/api/stripe/status", null, runtimeContext)
		]).then(function (results) {
			var session = resultData(results[0]);
			var bootstrap = resultData(results[1]);
			var stripe = resultData(results[2]);
			return {
				html: [
					renderEndpointIssues(results),
					renderLiveCards([
						{ label: "Feature Flag", value: FEATURES.live_data ? "ON" : "OFF", note: "mmed_admin_os_live_data", tone: "green" },
						{ label: "Railway Exchange", value: runtimeContext.railway && runtimeContext.railway.isExchanged() ? "Ready" : "Pending", note: "Matrix-owned auth exchange", tone: runtimeContext.railway && runtimeContext.railway.isExchanged() ? "green" : "gold" },
						{ label: "Session", value: session.authenticated === false ? "Anonymous" : "Checked", note: "/api/auth/session", tone: "blue" },
						{ label: "Stripe", value: firstValue(stripe, ["status", "mode", "connection"], "Checked"), note: "/api/stripe/status", tone: "blue" }
					]),
					'<div class="amos-live-grid two">',
					livePanel("Bootstrap", '<div class="amos-route-list">' + objectRows(bootstrap).join("") + "</div>"),
					livePanel("Stripe Status", '<div class="amos-route-list">' + objectRows(stripe).join("") + "</div>"),
					livePanel("Auth Session", '<div class="amos-route-list">' + objectRows(session).join("") + "</div>"),
					livePanel("Protected Systems", '<div class="amos-route-list">' + [
						routeRow("Student Matrix", "Untouched by Admin HQ wiring"),
						routeRow("No-touch modules", "Scheduler, Calendar, File Vault, Communications, StoryForge"),
						routeRow("Rollback", "Set mmed_admin_os_live_data to 0")
					].join("") + "</div>"),
					"</div>"
				].join(""),
				data: {}
			};
		});
	}

	function railwayGetSafe(path, params, runtimeContext) {
		var client = runtimeContext && runtimeContext.railway ? runtimeContext.railway : railwayClient;
		return client.get(path, params, {
			signal: runtimeContext && runtimeContext.routeSignal
		}).then(function (data) {
			return { ok: true, data: data, path: path, status: 200 };
		}).catch(function (error) {
			return {
				ok: false,
				data: {},
				path: path,
				status: error && error.status ? error.status : 0,
				error: error && error.message ? error.message : "Railway request failed."
			};
		});
	}

	function railwayPostSafe(path, body, runtimeContext) {
		var client = runtimeContext && runtimeContext.railway ? runtimeContext.railway : railwayClient;
		return client.post(path, body || {}, {
			signal: runtimeContext && runtimeContext.routeSignal
		}).then(function (data) {
			return { ok: true, data: data, path: path, status: 200 };
		}).catch(function (error) {
			return {
				ok: false,
				data: {},
				path: path,
				status: error && error.status ? error.status : 0,
				error: error && error.message ? error.message : "Railway write failed."
			};
		});
	}

	function railwayPatchSafe(path, body, runtimeContext) {
		var client = runtimeContext && runtimeContext.railway ? runtimeContext.railway : railwayClient;
		return client.patch(path, body || {}, {
			signal: runtimeContext && runtimeContext.routeSignal
		}).then(function (data) {
			return { ok: true, data: data, path: path, status: 200 };
		}).catch(function (error) {
			return {
				ok: false,
				data: {},
				path: path,
				status: error && error.status ? error.status : 0,
				error: error && error.message ? error.message : "Railway patch failed."
			};
		});
	}

	function wpGetSafe(path, params, runtimeContext) {
		return withTimeout(wpApi.get(path, params, {
			signal: runtimeContext && runtimeContext.routeSignal
		}), 25000, "WordPress request timed out.").then(function (data) {
			return { ok: true, data: data, path: path, status: 200 };
		}).catch(function (error) {
			return {
				ok: false,
				data: {},
				path: path,
				status: error && error.status ? error.status : 0,
				error: error && error.message ? error.message : "WordPress request failed."
			};
		});
	}

	function wpPostSafe(path, body, runtimeContext) {
		return wpApi.post(path, body || {}, {
			signal: runtimeContext && runtimeContext.routeSignal
		}).then(function (data) {
			return { ok: true, data: data, path: path, status: 200 };
		}).catch(function (error) {
			return {
				ok: false,
				data: {},
				path: path,
				status: error && error.status ? error.status : 0,
				error: error && error.message ? error.message : "WordPress write failed."
			};
		});
	}

	function wpPutSafe(path, body, runtimeContext) {
		return wpApi.put(path, body || {}, {
			signal: runtimeContext && runtimeContext.routeSignal
		}).then(function (data) {
			return { ok: true, data: data, path: path, status: 200 };
		}).catch(function (error) {
			return {
				ok: false,
				data: {},
				path: path,
				status: error && error.status ? error.status : 0,
				error: error && error.message ? error.message : "WordPress update failed."
			};
		});
	}

	function wpDeleteSafe(path, runtimeContext) {
		return wpApi.delete(path, {
			signal: runtimeContext && runtimeContext.routeSignal
		}).then(function (data) {
			return { ok: true, data: data, path: path, status: 200 };
		}).catch(function (error) {
			return {
				ok: false,
				data: {},
				path: path,
				status: error && error.status ? error.status : 0,
				error: error && error.message ? error.message : "WordPress delete failed."
			};
		});
	}

	function resultData(result) {
		return result && result.ok && result.data ? result.data : {};
	}

	function resultItems(result, keys) {
		return normalizeArray(firstArray(resultData(result), keys || ["items", "data", "rows"]));
	}

	function firstArray(payload, keys) {
		if (Array.isArray(payload)) {
			return payload;
		}
		if (!payload || typeof payload !== "object") {
			return [];
		}
		keys = keys || ["items", "data", "rows"];
		for (var i = 0; i < keys.length; i += 1) {
			var value = getPath(payload, keys[i]);
			if (Array.isArray(value)) {
				return value;
			}
		}
		var objectKeys = Object.keys(payload);
		for (var j = 0; j < objectKeys.length; j += 1) {
			if (Array.isArray(payload[objectKeys[j]])) {
				return payload[objectKeys[j]];
			}
		}
		return [];
	}

	function normalizeArray(value) {
		return Array.isArray(value) ? value : [];
	}

	function getPath(object, path) {
		if (!object || !path) {
			return undefined;
		}
		return String(path).split(".").reduce(function (value, key) {
			return value && value[key] !== undefined ? value[key] : undefined;
		}, object);
	}

	function firstValue(object, keys, fallback) {
		for (var i = 0; i < keys.length; i += 1) {
			var value = getPath(object, keys[i]);
			if (value !== undefined && value !== null && value !== "") {
				return value;
			}
		}
		return fallback;
	}

	function safeCount(value) {
		if (Array.isArray(value)) {
			return value.length;
		}
		if (typeof value === "number" && isFinite(value)) {
			return value;
		}
		var parsed = Number(value);
		return isFinite(parsed) ? parsed : 0;
	}

	function formatCount(value) {
		if (typeof value === "string" && !/^\d+(\.\d+)?$/.test(value)) {
			return value;
		}
		return String(Math.round(safeCount(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	}

	function formatMoney(value) {
		if (typeof value === "string" && value.indexOf("$") === 0) {
			return value;
		}
		var number = Number(value);
		if (!isFinite(number)) {
			number = 0;
		}
		return "$" + number.toLocaleString(undefined, { maximumFractionDigits: 0 });
	}

	function formatDate(value) {
		if (!value) {
			return "Unknown";
		}
		var date = new Date(value);
		if (isNaN(date.getTime())) {
			return String(value);
		}
		return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
	}

	function formatDateTime(value) {
		if (!value) {
			return "Unknown";
		}
		var date = new Date(value);
		if (isNaN(date.getTime())) {
			return String(value);
		}
		return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
	}

	function dateValue(value) {
		var date = new Date(value || "");
		return isNaN(date.getTime()) ? 0 : date.getTime();
	}

	function toDatetimeLocal(value) {
		var date = value instanceof Date ? value : new Date(value || "");
		if (isNaN(date.getTime())) {
			return "";
		}
		var offsetMs = date.getTimezoneOffset() * 60000;
		return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
	}

	function fieldBySuffix(form, suffix) {
		return form ? form.querySelector("[data-amos-" + suffix + "]") : null;
	}

	function getField(form, suffix) {
		var field = fieldBySuffix(form, suffix);
		return field ? field.value || "" : "";
	}

	function setField(form, suffix, value) {
		var field = fieldBySuffix(form, suffix);
		if (field) {
			field.value = value == null ? "" : value;
		}
	}

	function titleize(value) {
		return String(value || "Unknown").replace(/[_-]+/g, " ").replace(/\b\w/g, function (char) {
			return char.toUpperCase();
		});
	}

	function operatorLabel() {
		var scope = config.auth && config.auth.operatorScope ? config.auth.operatorScope : {};
		return scope.ownerName || titleize(currentOperator());
	}

	function renderLiveLoading(label) {
		return '<div class="amos-card amos-live-loading"><span></span><strong>Loading ' + escapeHTML(label) + "</strong><small>Railway HQ API</small></div>";
	}

	function renderLiveException(label, error) {
		return '<div class="amos-live-unavailable"><strong>' + escapeHTML(label) + ' unavailable</strong><span>' + escapeHTML(error && error.message ? error.message : "Railway request failed.") + "</span></div>";
	}

	function renderLiveUnavailable(label, result) {
		return '<div class="amos-live-unavailable"><strong>' + escapeHTML(label) + ' unavailable</strong><span>' + escapeHTML(errorSummary(result)) + "</span></div>";
	}

	function errorSummary(result) {
		if (!result) {
			return "Endpoint did not return a usable response.";
		}
		var status = result.status ? "HTTP " + result.status + ": " : "";
		return status + (result.error || "Endpoint did not return a usable response.");
	}

	function renderEndpointIssues(results) {
		var failures = (results || []).filter(function (result) {
			return result && !result.ok;
		});
		if (!failures.length) {
			return "";
		}
		return [
			'<div class="amos-live-issues" role="status">',
			"<strong>Endpoint notice</strong>",
			failures.map(function (result) {
				return '<span><code>' + escapeHTML(result.path || "endpoint") + "</code> " + escapeHTML(errorSummary(result)) + "</span>";
			}).join(""),
			"</div>"
		].join("");
	}

	function renderLiveCards(cards) {
		return '<div class="amos-live-metrics">' + cards.map(function (card) {
			return [
				'<article class="amos-live-metric ' + escapeAttr(card.tone || "blue") + '">',
				"<span>" + escapeHTML(card.label) + "</span>",
				"<strong>" + escapeHTML(card.value) + "</strong>",
				"<small>" + escapeHTML(card.note || "") + "</small>",
				"</article>"
			].join("");
		}).join("") + "</div>";
	}

	function livePanel(title, body) {
		return [
			'<section class="amos-app-card">',
			'<div class="amos-card-heading"><h3>' + escapeHTML(title) + '</h3><span class="amos-pill blue">Live</span></div>',
			body || '<div class="amos-empty">No data returned.</div>',
			"</section>"
		].join("");
	}

	function liveTable(headers, rows, emptyText) {
		if (!rows.length) {
			return '<div class="amos-empty">' + escapeHTML(emptyText || "No rows returned.") + "</div>";
		}
		return [
			'<div class="amos-live-table-wrap"><table class="amos-table amos-live-table">',
			"<thead><tr>" + headers.map(function (header) { return "<th>" + escapeHTML(header) + "</th>"; }).join("") + "</tr></thead>",
			"<tbody>",
			rows.map(function (row) {
				return "<tr>" + row.map(function (cell) { return "<td>" + escapeHTML(cell) + "</td>"; }).join("") + "</tr>";
			}).join(""),
			"</tbody></table></div>"
		].join("");
	}

	function renderSimpleList(items, mapper, emptyText) {
		if (!items.length) {
			return '<div class="amos-empty">' + escapeHTML(emptyText || "No records returned.") + "</div>";
		}
		return '<div class="amos-live-list">' + items.map(function (item) {
			var row = mapper(item);
			return '<div class="amos-live-list-row"><strong>' + escapeHTML(row[0]) + '</strong><span>' + escapeHTML(row[1]) + '</span><em>' + escapeHTML(row[2]) + "</em></div>";
		}).join("") + "</div>";
	}

	function normalizeStudents(items) {
		return normalizeArray(items).filter(function (item) {
			return item && typeof item === "object";
		});
	}

	function personName(student) {
		return firstValue(student, ["name", "full_name", "fullName", "display_name", "displayName", "student_name", "profile.name", "user.name"], "Unknown student");
	}

	function studentEmail(student) {
		return firstValue(student, ["email", "user_email", "student_email", "profile.email", "user.email"], "No email");
	}

	function programName(student) {
		return firstValue(student, ["program", "program_name", "programName", "division", "course", "product", "enrollment.program"], "Unassigned");
	}

	function statusText(item) {
		return String(firstValue(item, ["status", "state", "stage", "enrollment_status", "enrollmentStatus", "task_status"], "Unknown"));
	}

	function timestampFromStudent(student) {
		var value = firstValue(student, ["enrolled_at", "enrollment_date", "enrollmentDate", "created_at", "createdAt", "updated_at"], "");
		var date = new Date(value);
		return isNaN(date.getTime()) ? 0 : date.getTime();
	}

	function renderStudentRows(students) {
		if (!students.length) {
			return '<div class="amos-empty">No student rows returned.</div>';
		}
		return [
			'<div class="amos-live-table-wrap"><table class="amos-table amos-live-table">',
			"<thead><tr><th>Student</th><th>Email</th><th>Program</th><th>Enrollment</th><th>Status</th></tr></thead>",
			"<tbody>",
			students.map(function (student, index) {
				return [
					'<tr data-amos-student-row="' + escapeAttr(index) + '">',
					"<td>" + escapeHTML(personName(student)) + "</td>",
					"<td>" + escapeHTML(studentEmail(student)) + "</td>",
					"<td>" + escapeHTML(programName(student)) + "</td>",
					"<td>" + escapeHTML(formatDate(firstValue(student, ["enrolled_at", "enrollment_date", "enrollmentDate", "created_at"], ""))) + "</td>",
					"<td>" + escapeHTML(statusText(student)) + "</td>",
					"</tr>"
				].join("");
			}).join(""),
			"</tbody></table></div>"
		].join("");
	}

	function renderStudentDetail(student) {
		if (!student) {
			return '<div class="amos-empty">Select a student row for detail.</div>';
		}
		return [
			'<div class="amos-card-heading"><h3>' + escapeHTML(personName(student)) + '</h3><span class="amos-pill blue">Read only</span></div>',
			'<div class="amos-route-list">',
			routeRow("Email", studentEmail(student)),
			routeRow("Program", programName(student)),
			routeRow("Status", statusText(student)),
			routeRow("Enrollment", formatDate(firstValue(student, ["enrolled_at", "enrollment_date", "enrollmentDate", "created_at"], ""))),
			routeRow("Last Active", formatDate(firstValue(student, ["last_active", "lastActive", "updated_at", "updatedAt"], ""))),
			"</div>"
		].join("");
	}

	function normalizeLeads(items) {
		return normalizeArray(items).filter(function (item) {
			return item && typeof item === "object";
		});
	}

	function leadScore(lead) {
		return safeCount(firstValue(lead, ["score", "probability", "lead_score", "leadScore"], 0));
	}

	function leadBucket(lead) {
		var text = String(firstValue(lead, ["status", "stage", "bucket", "temperature"], "")).toLowerCase();
		if (/hot|high/.test(text) || leadScore(lead) >= 75) {
			return "hot";
		}
		if (/warm|medium/.test(text) || leadScore(lead) >= 40) {
			return "warm";
		}
		return "cold";
	}

	function hotLeadCount(leads) {
		return leads.filter(function (lead) {
			return leadBucket(lead) === "hot";
		}).length;
	}

	function averageLeadScore(leads) {
		if (!leads.length) {
			return 0;
		}
		return Math.round(leads.reduce(function (sum, lead) {
			return sum + leadScore(lead);
		}, 0) / leads.length);
	}

	function renderLeadRows(leads) {
		if (!leads.length) {
			return '<div class="amos-empty">No lead rows returned.</div>';
		}
		return liveTable(["Lead", "Source", "Score", "Status", "Last Contact"], leads.map(function (lead) {
			return [
				firstValue(lead, ["name", "full_name", "contact_name", "email"], "Unknown lead"),
				firstValue(lead, ["source", "channel", "utm_source"], "Unknown"),
				leadScore(lead),
				titleize(leadBucket(lead)),
				formatDate(firstValue(lead, ["last_contact", "lastContact", "updated_at", "created_at"], ""))
			];
		}), "No lead rows returned.");
	}

	function firstPaymentCardValue(cards) {
		var card = cards && cards[0] ? cards[0] : null;
		return card ? firstValue(card, ["value", "amount", "total"], 0) : 0;
	}

	function renderPaymentRows(payments) {
		if (!payments.length) {
			return '<div class="amos-empty">No payment rows returned.</div>';
		}
		return liveTable(["Payment", "Student", "Amount", "Status", "Date"], payments.slice(0, 40).map(function (payment) {
			return [
				firstValue(payment, ["id", "payment_id", "stripe_payment_intent", "invoice"], "Payment"),
				firstValue(payment, ["student", "student_name", "customer", "email"], "Unknown"),
				formatMoney(firstValue(payment, ["amount", "total", "gross", "captured_amount"], 0)),
				titleize(firstValue(payment, ["status", "state", "payment_status"], "Unknown")),
				formatDate(firstValue(payment, ["created_at", "created", "date", "paid_at"], ""))
			];
		}), "No payment rows returned.");
	}

	function paymentExceptionSummary(item) {
		return [
			firstValue(item, ["student", "student_name", "customer", "email", "id"], "Payment exception"),
			firstValue(item, ["reason", "message", "status", "type"], "Needs review"),
			formatDate(firstValue(item, ["created_at", "updated_at", "date"], ""))
		];
	}

	function renderEnrollmentRows(rows) {
		rows = normalizeArray(rows);
		if (!rows.length) {
			return '<div class="amos-empty">No mapped enrollment rows returned.</div>';
		}
		return liveTable(["Student", "Program", "Payment", "Course Access", "Order"], rows.slice(0, 60).map(function (row) {
			return [
				firstValue(row, ["student", "name"], "Unknown student"),
				firstValue(row, ["program", "product"], "MissionMed Program"),
				titleize(firstValue(row, ["payment_status", "status"], "Unknown")),
				titleize(firstValue(row, ["access_status"], "Unknown")),
				"#" + firstValue(row, ["order_id", "id"], "") + " / " + formatDate(firstValue(row, ["date"], ""))
			];
		}), "No mapped enrollment rows returned.");
	}

	function enrollmentReviewSummary(item) {
		return [
			firstValue(item, ["student", "name", "email"], "Enrollment review"),
			firstValue(item, ["review_reason", "access_status", "payment_status"], "Needs source-admin review"),
			firstValue(item, ["program", "product", "course"], "WooCommerce + LearnDash")
		];
	}

		function renderAccessMappingRows(mappings) {
			mappings = normalizeArray(mappings);
			if (!mappings.length) {
				return '<div class="amos-empty">No access mappings returned.</div>';
			}
			return liveTable(["Program", "Woo Product", "LearnDash Course", "Division"], mappings.map(function (mapping) {
				var products = labelList(mapping.products, ["label", "name", "title", "id"]);
				return [
					firstValue(mapping, ["label", "slug"], "Program"),
					products || firstValue(mapping, ["product.label", "product_id"], "Not configured"),
				firstValue(mapping, ["course.label", "course_id"], "Not configured"),
				titleize(firstValue(mapping, ["division"], "Unknown"))
			];
		}), "No access mappings returned.");
	}

	function renderAccessSnapshotRows(students) {
		students = normalizeArray(students);
		if (!students.length) {
			return '<div class="amos-empty">No access snapshot rows returned.</div>';
		}
			return liveTable(["Student", "Programs", "Courses", "Alerts", "Status"], students.slice(0, 80).map(function (student) {
				return [
					firstValue(student, ["display_name", "name", "student"], "Unknown student"),
					labelList(student.programs, ["label", "name", "title", "program"]) || programName(student),
					labelList(student.courses, ["title", "label", "name", "course"]) || firstValue(student, ["course", "latest_order_item"], "No course"),
					formatCount(firstValue(student, ["alert_total"], 0)),
					titleize(firstValue(student, ["status"], "Unknown"))
				];
		}), "No access snapshot rows returned.");
	}

		function accessAlertSummary(item) {
			return [
				firstValue(item, ["display_name", "student", "name"], "Access alert"),
				normalizeArray(item.missing_access).concat(normalizeArray(item.unexpected_access)).join("; ") || "Needs review",
				labelList(item.programs, ["label", "name", "title", "program"]) || "Access audit"
			];
		}

		function labelList(items, keys) {
			return normalizeArray(items).map(function (item) {
				if (item && typeof item === "object") {
					return firstValue(item, keys || ["label", "name", "title", "id"], "");
				}
				return item == null ? "" : String(item);
			}).filter(Boolean).join(", ");
		}

	function renderWarnings(warnings) {
		warnings = normalizeArray(warnings);
		if (!warnings.length) {
			return '<div class="amos-empty">No access mapping warnings returned.</div>';
		}
		return '<div class="amos-route-list">' + warnings.map(function (warning) {
			return routeRow("Warning", warning);
		}).join("") + "</div>";
	}

	function calendarEventSummary(event) {
		return [
			firstValue(event, ["title", "summary"], "Calendar event"),
			firstValue(event, ["event_type", "type", "category"], "Calendar"),
			formatDateTime(firstValue(event, ["start_at", "start", "date"], ""))
		];
	}

	function videoSummary(video) {
		return [
			firstValue(video, ["title", "id"], "Video"),
			firstValue(video, ["division_label", "category_label"], "Video library"),
			firstValue(video, ["duration_label", "segment_count"], "R2")
		];
	}

	function stripeAccountSummary(item) {
		return [
			firstValue(item, ["name", "account", "id"], "Stripe account"),
			firstValue(item, ["status", "state", "charges_enabled"], "Checked"),
			firstValue(item, ["mode", "country", "currency"], "Stripe")
		];
	}

	function normalizeTasks(items) {
		return normalizeArray(items).filter(function (item) {
			return item && typeof item === "object";
		}).sort(function (a, b) {
			return taskPriorityScore(b) - taskPriorityScore(a);
		});
	}

	function taskPriorityScore(task) {
		var priority = String(firstValue(task, ["priority", "severity", "tone"], "")).toLowerCase();
		if (/urgent|critical|high/.test(priority)) {
			return 3;
		}
		if (/medium|normal/.test(priority)) {
			return 2;
		}
		return 1;
	}

	function taskId(task) {
		return firstValue(task, ["id", "task_id", "uuid"], "");
	}

	function taskTitle(task) {
		return firstValue(task, ["title", "subject", "name", "message"], "Untitled task");
	}

	function renderTaskRows(tasks) {
		if (!tasks.length) {
			return '<div class="amos-empty">No task rows returned.</div>';
		}
		return '<div class="amos-live-list amos-task-list">' + tasks.map(function (task) {
			var id = taskId(task);
			var actionButtons = id ? [
				'<button type="button" class="amos-inline-btn" data-amos-task-status="completed" data-amos-task-id="' + escapeAttr(id) + '">Complete</button>',
				'<button type="button" class="amos-inline-btn secondary" data-amos-task-status="dismissed" data-amos-task-id="' + escapeAttr(id) + '">Dismiss</button>'
			].join("") : "";
			return [
				'<div class="amos-live-list-row amos-task-row">',
				"<strong>" + escapeHTML(taskTitle(task)) + "</strong>",
				"<span>" + escapeHTML(firstValue(task, ["description", "details", "assignee", "owner"], "No details")) + "</span>",
				"<em>" + escapeHTML(titleize(statusText(task))) + "</em>",
				'<div class="amos-inline-actions">' + actionButtons + "</div>",
				"</div>"
			].join("");
		}).join("") + "</div>";
	}

	function notificationSummary(item) {
		return [
			firstValue(item, ["title", "subject", "message", "type"], "Notification"),
			firstValue(item, ["body", "description", "summary", "status"], "Admin notification"),
			formatDate(firstValue(item, ["created_at", "createdAt", "date", "updated_at"], ""))
		];
	}

	function renderUsceRequestRows(requests) {
		if (!requests.length) {
			return '<div class="amos-empty">No USCE requests returned.</div>';
		}
		return liveTable(["Student", "Program", "Submitted", "Status", "Coordinator"], requests.map(function (request) {
			return [
				firstValue(request, ["student_name", "student", "name", "email"], "Unknown"),
				firstValue(request, ["program", "program_name", "rotation", "specialty"], "Unknown"),
				formatDate(firstValue(request, ["submitted_at", "created_at", "date"], "")),
				titleize(firstValue(request, ["status", "state"], "Unknown")),
				firstValue(request, ["coordinator", "owner", "assigned_to"], "Unassigned")
			];
		}), "No USCE requests returned.");
	}

	function usceProgramSummary(program) {
		return [
			firstValue(program, ["name", "program", "title"], "Clinical program"),
			formatMoney(firstValue(program, ["price", "tuition", "amount"], 0)) + " / " + formatCount(firstValue(program, ["available_slots", "slots", "capacity"], 0)) + " slots",
			titleize(firstValue(program, ["status", "state"], "Unknown"))
		];
	}

	function renderOfferPipeline(pipeline) {
		var stages = ["Draft", "Sent", "Responded", "Payment", "Confirmed", "Declined", "Revoked"];
		return '<div class="amos-offer-pipeline">' + stages.map(function (stage) {
			var offers = pipeline[stage] || [];
			return [
				'<section class="amos-offer-stage">',
				"<h4>" + escapeHTML(stage) + '<span>' + escapeHTML(offers.length) + "</span></h4>",
				offers.length ? offers.map(renderOfferCard).join("") : '<div class="amos-empty">No offers</div>',
				"</section>"
			].join("");
		}).join("") + "</div>";
	}

	function offerStage(offer) {
		var status = String(firstValue(offer, ["status", "state", "stage"], "draft")).toLowerCase();
		if (/confirm|placed|onboard/.test(status)) {
			return "Confirmed";
		}
		if (/declin|reject/.test(status)) {
			return "Declined";
		}
		if (/revok|cancel|void/.test(status)) {
			return "Revoked";
		}
		if (/pay|checkout|invoice/.test(status)) {
			return "Payment";
		}
		if (/respond|accept/.test(status)) {
			return "Responded";
		}
		if (/sent|deliver|email/.test(status)) {
			return "Sent";
		}
		return "Draft";
	}

	function renderOfferCard(offer) {
		var id = firstValue(offer, ["id", "offer_id", "uuid"], "");
		var actions = id ? [
			'<button type="button" class="amos-inline-btn secondary" data-amos-usce-action="preview" data-amos-offer-id="' + escapeAttr(id) + '">Preview</button>',
			'<button type="button" class="amos-inline-btn" data-amos-usce-action="send" data-amos-offer-id="' + escapeAttr(id) + '">Send</button>',
			'<button type="button" class="amos-inline-btn" data-amos-usce-action="approve" data-amos-offer-id="' + escapeAttr(id) + '">Approve</button>',
			'<button type="button" class="amos-inline-btn secondary" data-amos-usce-action="revoke" data-amos-offer-id="' + escapeAttr(id) + '">Revoke</button>',
			'<button type="button" class="amos-inline-btn" data-amos-usce-action="onboard" data-amos-offer-id="' + escapeAttr(id) + '">Onboard</button>'
		].join("") : "";
		return [
			'<article class="amos-offer-card">',
			"<strong>" + escapeHTML(firstValue(offer, ["student_name", "student", "name", "email"], "Unknown student")) + "</strong>",
			"<span>" + escapeHTML(firstValue(offer, ["program", "program_name", "rotation"], "USCE")) + "</span>",
			"<em>" + escapeHTML(formatMoney(firstValue(offer, ["amount", "price", "total"], 0))) + " - " + escapeHTML(formatDate(firstValue(offer, ["sent_at", "response_at", "created_at"], ""))) + "</em>",
			'<div class="amos-inline-actions">' + actions + "</div>",
			"</article>"
		].join("");
	}

	function groupBy(items, keyFn) {
		return normalizeArray(items).reduce(function (groups, item) {
			var key = keyFn(item) || "Unknown";
			groups[key] = groups[key] || [];
			groups[key].push(item);
			return groups;
		}, {});
	}

	function objectRows(object) {
		return Object.keys(object || {}).slice(0, 12).map(function (key) {
			var value = object[key];
			if (value && typeof value === "object") {
				value = Array.isArray(value) ? value.length + " items" : "Available";
			}
			return routeRow(titleize(key), value == null ? "Unknown" : String(value));
		});
	}

	function bindLiveModuleControls(container, runtimeContext, meta, data) {
		bindStudentControls(container, runtimeContext, data.students || []);
		bindLeadControls(container, data.leads || []);
		bindTaskControls(container, runtimeContext);
		bindUsceOfferControls(container, runtimeContext);
	}

	function bindStudentControls(container, runtimeContext, students) {
		var table = container.querySelector("[data-amos-students-table]");
		var detail = container.querySelector("[data-amos-student-detail]");
		var count = container.querySelector("[data-amos-student-count]");
		var search = container.querySelector("[data-amos-student-search]");
		var current = students || [];

		function render(items) {
			current = items || [];
			if (table) {
				table.innerHTML = renderStudentRows(current);
			}
			if (detail) {
				detail.innerHTML = renderStudentDetail(current[0]);
			}
			if (count) {
				count.textContent = current.length + " records";
			}
		}

		if (table && detail) {
			table.addEventListener("click", function (event) {
				var row = event.target && event.target.closest ? event.target.closest("[data-amos-student-row]") : null;
				if (!row) {
					return;
				}
				detail.innerHTML = renderStudentDetail(current[Number(row.getAttribute("data-amos-student-row"))]);
			});
		}

		if (search && table) {
			var timer = null;
			search.addEventListener("input", function () {
				window.clearTimeout(timer);
				timer = window.setTimeout(function () {
					var query = search.value.trim();
					if (!query) {
						render(students);
						return;
					}
					table.innerHTML = renderLiveLoading("student search");
					railwayGetSafe("/api/hq/students", { q: query }, runtimeContext).then(function (result) {
						render(normalizeStudents(resultItems(result, ["items", "students", "data"])));
					});
				}, 260);
			});
		}
	}

	function bindLeadControls(container, leads) {
		var filter = container.querySelector("[data-amos-lead-filter]");
		var table = container.querySelector("[data-amos-leads-table]");
		var count = container.querySelector("[data-amos-lead-count]");
		if (!filter || !table) {
			return;
		}
		filter.addEventListener("change", function () {
			var value = filter.value;
			var filtered = value === "all" ? leads : leads.filter(function (lead) {
				return leadBucket(lead) === value;
			});
			table.innerHTML = renderLeadRows(filtered);
			if (count) {
				count.textContent = filtered.length + " records";
			}
		});
	}

	function bindTaskControls(container, runtimeContext) {
		container.querySelectorAll("[data-amos-task-status]").forEach(function (button) {
			button.addEventListener("click", function () {
				var id = button.getAttribute("data-amos-task-id");
				var status = button.getAttribute("data-amos-task-status");
				if (!id || !status || !window.confirm("Update this task status to " + status + "?")) {
					return;
				}
				button.disabled = true;
				railwayPatchSafe("/api/hq/tasks/" + encodeURIComponent(id), { status: status }, runtimeContext).then(function (result) {
					button.disabled = false;
					showToast(result.ok ? "Task updated." : errorSummary(result));
				});
			});
		});
	}

	function bindUsceOfferControls(container, runtimeContext) {
		container.querySelectorAll("[data-amos-usce-action]").forEach(function (button) {
			button.addEventListener("click", function () {
				var id = button.getAttribute("data-amos-offer-id");
				var action = button.getAttribute("data-amos-usce-action");
				if (!id || !action) {
					return;
				}
				if (action !== "preview" && !window.confirm("Run USCE offer action: " + action + "?")) {
					return;
				}
				button.disabled = true;
				var request = action === "preview"
					? railwayGetSafe("/api/usce/offers/" + encodeURIComponent(id) + "/preview", null, runtimeContext)
					: railwayPostSafe("/api/usce/offers/" + encodeURIComponent(id) + "/" + action, {}, runtimeContext);
				request.then(function (result) {
					button.disabled = false;
					showToast(result.ok ? "USCE action completed." : errorSummary(result));
				});
			});
		});
	}


	function mountCommandModule(container, runtimeContext, meta) {
		var source = meta.source;
		var primaryHref = meta.primaryHref || "#dashboard";
		var primaryLabel = meta.primaryLabel || "Back to Command Center";
		var mirrorHref = mirrorUrl(meta.mirror);

		container.innerHTML = [
			'<section class="amos-page">',
			pageHeader(meta.group || PRODUCT_NAME, meta.label, meta.purpose, meta.mirror ? "Student side: " + meta.mirror : "Admin-only"),
			'<div class="amos-status-grid">',
			statCard("Status", meta.status || "Planned", meta.moduleState || "No live data is loaded.", meta.tone || "blue"),
			statCard("Runtime", "Lazy", "Inactive until route", "green"),
			statCard("Data", "Fail closed", "No browser secrets", "green"),
			statCard("Next", "Scoped", meta.nextAction || "Source approval required", "gold"),
			"</div>",
			'<div class="amos-grid two">',
			'<article class="amos-card amos-hero-card">',
			'<div class="amos-card-heading"><h3>Command Module</h3><span class="amos-pill ' + escapeAttr(meta.tone || "blue") + '">' + escapeHTML(meta.status || "Planned") + "</span></div>",
			"<p>" + escapeHTML(meta.moduleState || "This Matrix Admin HQ module is prepared as a polished command slot. Live wiring is intentionally scoped.") + "</p>",
			'<div class="amos-action-row">',
			'<a class="amos-btn" href="' + escapeAttr(primaryHref) + '">' + escapeHTML(primaryLabel) + "</a>",
			mirrorHref ? '<a class="amos-btn secondary" href="' + escapeAttr(absoluteUrl(mirrorHref)) + '">Open Student Mirror</a>' : "",
			'<a class="amos-btn secondary" href="#dashboard">Matrix Admin HQ Dashboard</a>',
			"</div>",
			'<div class="amos-route-list">',
			(meta.panels || []).map(function (item) {
				return routeRow(item, "Open the module to use the approved source-owned workflow or read model.");
			}).join(""),
			"</div>",
			"</article>",
			'<article class="amos-card amos-hero-card">',
			'<div class="amos-card-heading"><h3>Source And Safety</h3><span class="amos-pill blue">Protected</span></div>',
			source ? sourceBlock(source) : "<p>No canonical source is loaded by this shell yet. This avoids fake live data and prevents accidental writes.</p>",
			'<ul class="amos-contract-list">',
			"<li>Inactive modules do not fetch data.</li>",
			"<li>No service keys or provider secrets are exposed.</li>",
			"<li>Student Matrix Runtime v2 remains untouched.</li>",
			"<li>Live writes require a source-locked module migration.</li>",
			"</ul>",
			"</article>",
			"</div>",
			"</section>"
		].join("");
		state.metrics.moduleUsableMs = Math.round(performance.now() - state.metrics.bootAt);
	}

	function mountSystemHealth(container, runtimeContext) {
		mountWpLegacyModule(container, runtimeContext, MODULE_META["system-health"]);
	}

	function mountSourcePackages(container) {
		container.innerHTML = [
			'<section class="amos-page">',
			pageHeader("Review", "Source Packages", "Internal source-truth map for future admin module migrations. This is intentionally secondary, not the main HQ experience.", "Admin-only"),
			'<div class="amos-source-package-grid">',
			SOURCE_PACKAGES.map(function (source) {
				return [
					'<article class="amos-card amos-source-package">',
					'<div class="amos-card-heading"><h3>' + escapeHTML(source.name) + '</h3><span class="amos-pill ' + escapeAttr(source.tone) + '">' + escapeHTML(source.status) + "</span></div>",
					'<p>' + escapeHTML(source.detail) + "</p>",
					'<code>' + escapeHTML(source.path) + "</code>",
					"</article>"
				].join("");
			}).join(""),
			"</div>",
			"</section>"
		].join("");
		state.metrics.moduleUsableMs = Math.round(performance.now() - state.metrics.bootAt);
	}

	function authLabel(runtimeContext) {
		if (runtimeContext.auth.session && runtimeContext.auth.session.authenticated === false) {
			return "WP admin";
		}
		return "Ready";
	}

	function renameStaticShell() {
		var title = refs.root.querySelector(".amos-topbar h1");
		var sidebarLabel = refs.root.querySelector(".amos-brand-copy strong");
		if (title) {
			title.textContent = PRODUCT_NAME;
		}
		if (sidebarLabel) {
			sidebarLabel.textContent = PRODUCT_NAME;
		}
	}

		function adminDashboardUrl() {
			var base = "/wp-admin/admin.php?page=mmed-admin-matrix";
			if (window.location && /(?:^|[?&])page=mmed-admin-matrix(?:&|$)/.test(window.location.search || "")) {
				base = window.location.pathname + window.location.search;
			}
			return base + "#dashboard";
		}

		function canonicalDemoUrl(path) {
			if (!path) {
				return "";
			}
			if (/^https?:\/\//.test(path)) {
				return path;
			}
			return (window.location && window.location.origin ? window.location.origin : "") + path;
		}

		function matrixOwnedRuntimeShell(meta, options) {
			options = options || {};
			var source = options.source ? '<span class="amos-source-chip">Source: ' + escapeHTML(options.source) + "</span>" : "";
			var modeBadgeTone = options.modeBadgeTone === "green" ? "" : " blue";
			return [
				'<section class="amos-native-app amos-native-app-' + escapeAttr(options.modifier || meta.id) + '" data-admin-app-route="' + escapeAttr(meta.id) + '">',
				'<header class="amos-native-app-topbar">',
				'<a class="amos-return-btn" href="' + escapeAttr(adminDashboardUrl()) + '" data-amos-return-dashboard aria-label="Return to Matrix Admin HQ">',
				'<span aria-hidden="true">&larr;</span><span>Return to Matrix Admin HQ</span>',
				"</a>",
				'<div class="amos-admin-app-heading">',
				'<span>' + escapeHTML(options.kicker || "Administration") + "</span>",
				"<strong>" + escapeHTML(options.title || meta.label) + "</strong>",
				"</div>",
				'<div class="amos-admin-app-badges">',
				'<span class="amos-app-badge"><i></i>App Mode</span>',
				'<span class="amos-app-badge' + modeBadgeTone + '">' + escapeHTML(options.modeBadge || "Matrix-owned app") + "</span>",
				source,
				"</div>",
				"</header>",
				'<div class="amos-native-app-canvas">',
				options.body || "",
				"</div>",
				"</section>"
			].join("");
		}

		function mountMatrixOwnedHtmlApp(container, runtimeContext, meta, options) {
			options = options || {};
			container.innerHTML = matrixOwnedRuntimeShell(meta, {
				kicker: options.kicker,
				title: options.title,
				modifier: options.modifier,
				modeBadge: options.modeBadge,
				source: options.source,
				body: [
					'<div class="amos-native-html-host" data-amos-native-html-host="' + escapeAttr(options.kind || meta.id) + '">',
					'<div class="amos-native-boot">',
					'<span>Loading source package</span>',
					"<strong>" + escapeHTML(options.title || meta.label) + "</strong>",
					'<i></i>',
					"</div>",
					"</div>"
				].join("")
			});

			var host = container.querySelector("[data-amos-native-html-host]");
			fetchStandaloneHtml(options.source, runtimeContext).then(function (html) {
				if (runtimeContext && runtimeContext.routeSignal && runtimeContext.routeSignal.aborted) {
					return;
				}
				renderStandaloneHtml(host, html, options);
				activateSourceMode(host, options.kind);
			}).catch(function (error) {
				renderSourceUnavailable(host, meta, options, error);
			});
		}

		function fetchStandaloneHtml(url, runtimeContext) {
			if (!url) {
				return Promise.reject(new Error("No source package URL is configured."));
			}
			return fetch(url, {
				cache: "no-store",
				credentials: "omit",
				headers: { Accept: "text/html" },
				signal: runtimeContext && runtimeContext.routeSignal
			}).then(function (response) {
				if (!response.ok) {
					throw new Error("Source package returned " + response.status + ".");
				}
				return response.text();
			});
		}

		function renderStandaloneHtml(host, html, options) {
			if (!host) {
				return;
			}
			var doc = new DOMParser().parseFromString(String(html || ""), "text/html");
			var body = doc.body ? doc.body.cloneNode(true) : null;
			if (!body) {
				throw new Error("Source package body is unavailable.");
			}

			var scripts = Array.prototype.slice.call(body.querySelectorAll("script"));
			scripts.forEach(function (script) {
				if (script.parentNode) {
					script.parentNode.removeChild(script);
				}
			});

			Array.prototype.slice.call(doc.head ? doc.head.querySelectorAll("style, link[rel='stylesheet']") : []).forEach(function (asset) {
				var clone = asset.cloneNode(true);
				if (clone.tagName && clone.tagName.toLowerCase() === "link" && clone.getAttribute("href")) {
					clone.setAttribute("href", resolveSourceUrl(clone.getAttribute("href"), options.source));
				}
				body.insertBefore(clone, body.firstChild);
			});

			host.classList.add("is-loaded");
			host.innerHTML = "";
			Array.prototype.slice.call(body.childNodes).forEach(function (node) {
				host.appendChild(node);
			});

			executeStandaloneScripts(scripts, options);
		}

		function resolveSourceUrl(path, baseUrl) {
			if (!path || /^data:|^blob:|^https?:\/\//i.test(path)) {
				return path || "";
			}
			try {
				return new URL(path, baseUrl).href;
			} catch (error) {
				return path;
			}
		}

		function executeStandaloneScripts(scripts, options) {
			var readyCallbacks = [];
			var originalAddEventListener = document.addEventListener;
			var sourceKind = options && options.kind ? options.kind : "matrix-source";

			document.querySelectorAll('script[data-amos-source-script="' + sourceKind + '"]').forEach(function (script) {
				if (script.parentNode) {
					script.parentNode.removeChild(script);
				}
			});

			document.addEventListener = function (type, listener, listenerOptions) {
				if (type === "DOMContentLoaded" && typeof listener === "function") {
					readyCallbacks.push(listener);
					return;
				}
				return originalAddEventListener.call(document, type, listener, listenerOptions);
			};

			scripts.reduce(function (promise, script) {
				return promise.then(function () {
					return new Promise(function (resolve, reject) {
						var next = document.createElement("script");
						Array.prototype.slice.call(script.attributes || []).forEach(function (attr) {
							next.setAttribute(attr.name, attr.value);
						});
						if (script.getAttribute("src")) {
							next.onload = resolve;
							next.onerror = function () {
								reject(new Error("Failed to load source script."));
							};
							next.src = resolveSourceUrl(script.getAttribute("src"), options && options.source);
						} else {
							next.text = script.textContent || "";
						}
						next.setAttribute("data-amos-source-script", sourceKind);
						document.body.appendChild(next);
						if (!script.src) {
							resolve();
						}
					});
				});
			}, Promise.resolve()).then(function () {
				document.addEventListener = originalAddEventListener;
				readyCallbacks.forEach(function (listener) {
					try {
						listener.call(document, new Event("DOMContentLoaded"));
					} catch (error) {
						state.metrics.error_state += 1;
					}
				});
			}).catch(function () {
				document.addEventListener = originalAddEventListener;
				state.metrics.error_state += 1;
			});
		}

		function renderSourceUnavailable(host, meta, options, error) {
			if (!host) {
				return;
			}
			host.innerHTML = [
				'<div class="amos-native-unavailable">',
				'<span>' + escapeHTML(meta.icon || "MM") + "</span>",
				"<h2>" + escapeHTML(options.title || meta.label) + " source is not available</h2>",
				"<p>" + escapeHTML(error && error.message ? error.message : "The Matrix-owned source package could not be loaded.") + "</p>",
				'<code>' + escapeHTML(options.source || "") + "</code>",
				'<a class="amos-btn" href="' + escapeAttr(adminDashboardUrl()) + '" data-amos-return-dashboard>Return to Matrix Admin HQ</a>',
				"</div>"
			].join("");
		}

		function adminAppShell(meta, options) {
			options = options || {};
			var source = options.source ? '<span class="amos-source-chip">Source: ' + escapeHTML(options.source) + "</span>" : "";
			var modeBadge = options.modeBadge || "Fixture / Safe Preview";
			var modeBadgeTone = options.modeBadgeTone === "green" ? "" : " blue";
			var statusNote = options.statusNote || "Backend/live wiring remains deferred until Brian approves the UI and route behavior.";
			return [
			'<section class="amos-admin-app amos-admin-app-' + escapeAttr(options.modifier || meta.id) + '" data-admin-app-route="' + escapeAttr(meta.id) + '">',
			'<header class="amos-admin-app-topbar">',
			'<a class="amos-return-btn" href="' + escapeAttr(adminDashboardUrl()) + '" data-amos-return-dashboard aria-label="Return to Matrix Admin HQ">',
			'<span aria-hidden="true">&larr;</span><span>Return to Matrix Admin HQ</span>',
			"</a>",
			'<div class="amos-admin-app-heading">',
			'<span>' + escapeHTML(options.kicker || "Administration") + "</span>",
			"<strong>" + escapeHTML(options.title || meta.label) + "</strong>",
			"</div>",
			'<div class="amos-admin-app-badges">',
			'<span class="amos-app-badge"><i></i>App Mode</span>',
			'<span class="amos-app-badge' + modeBadgeTone + '">' + escapeHTML(modeBadge) + "</span>",
			source,
			"</div>",
			"</header>",
			'<div class="amos-admin-app-canvas">',
			'<div class="amos-admin-app-intro">',
			"<p>" + escapeHTML(options.copy || meta.purpose || "") + "</p>",
			"<span>" + escapeHTML(statusNote) + "</span>",
			"</div>",
			options.body || "",
			"</div>",
			"</section>"
		].join("");
	}

	function adminAppTabs(labels, activeLabel) {
		return [
			'<div class="amos-admin-app-tabs" role="tablist">',
			labels.map(function (label) {
				var active = label === activeLabel ? " is-active" : "";
				return '<button type="button" class="' + active + '" data-amos-app-tab="' + escapeAttr(label) + '">' + escapeHTML(label) + "</button>";
			}).join(""),
			"</div>"
		].join("");
	}

		function bindAdminAppControls(container) {
			if (!container) {
				return;
			}

			container.querySelectorAll("[data-amos-app-tab]").forEach(function (button) {
				button.addEventListener("click", function () {
					var tab = button.getAttribute("data-amos-app-tab");
					var app = button.closest(".amos-admin-app");
				if (!app || !tab) {
					return;
				}
				app.querySelectorAll("[data-amos-app-tab]").forEach(function (item) {
					item.classList.toggle("is-active", item === button);
				});
				app.querySelectorAll("[data-amos-tab-panel]").forEach(function (panel) {
					panel.classList.toggle("is-active", panel.getAttribute("data-amos-tab-panel") === tab);
				});
			});
		});

		container.querySelectorAll("[data-amos-disabled-action]").forEach(function (button) {
			button.addEventListener("click", function (event) {
				event.preventDefault();
				showToast(button.getAttribute("data-amos-disabled-action") || "Preview only. Backend wiring deferred.");
				});
			});
		}

		function mountAdminSchedulerRuntime(container, runtimeContext) {
			var target = container && container.querySelector ? container.querySelector("#mmed-admin-scheduler-root") : null;
			if (!target) {
				return;
			}

			function isCurrentRoute() {
				return !(runtimeContext && runtimeContext.routeSignal && runtimeContext.routeSignal.aborted);
			}

			function mountScheduler() {
				if (!isCurrentRoute()) {
					return;
				}
				try {
					if (!window.MMEDScheduler || typeof window.MMEDScheduler.mount !== "function") {
						throw new Error("Scheduler runtime is unavailable.");
					}
					window.MMEDScheduler.mount("#mmed-admin-scheduler-root", { apiBase: "/api/scheduler" });
				} catch (error) {
					state.metrics.error_state += 1;
					target.innerHTML = [
						'<div class="amos-native-unavailable">',
						"<span>SO</span>",
						"<h2>Scheduler Ops could not load</h2>",
						"<p>" + escapeHTML(error && error.message ? error.message : "Scheduler runtime is unavailable.") + "</p>",
						'<a class="amos-btn" href="' + escapeAttr(adminDashboardUrl()) + '" data-amos-return-dashboard>Return to Matrix Admin HQ</a>',
						"</div>"
					].join("");
				}
			}

			if (window.MMEDScheduler && typeof window.MMEDScheduler.mount === "function") {
				mountScheduler();
				return;
			}

			document.addEventListener("mmed-scheduler-ready", mountScheduler, { once: true });
			window.setTimeout(function () {
				if (target && target.querySelector(".amos-native-boot")) {
					mountScheduler();
				}
			}, 8000);
		}

			function unmountAdminSchedulerRuntime() {
				if (window.MMEDScheduler && typeof window.MMEDScheduler.unmount === "function") {
					window.MMEDScheduler.unmount();
				}
			}

			function mountAdminCalendarRuntime(container, runtimeContext) {
				var host = container && container.querySelector ? container.querySelector("#sos-content") : null;
				if (!host) {
					return;
				}

				adminCalendarBridgeState.previousOs = window.MMED_OS;
				adminCalendarBridgeState.active = true;
				window.MMED_OS = createAdminCalendarBridge(runtimeContext);
				window.MMED_ADMIN_CALENDAR_OS = window.MMED_OS;
				ensureAdminRuntimeStylesheet(
					adminCalendarBridgeState.styleId,
					absoluteUrl("/wp-content/plugins/missionmed-hub/assets/student-os-calendar-v4.css")
				);

				reloadAdminRuntimeScript(
					adminCalendarBridgeState.scriptId,
					absoluteUrl("/wp-content/plugins/missionmed-hub/assets/student-os-calendar-v4.js") + "?admin_hq=" + encodeURIComponent(String(Date.now())),
					runtimeContext
				).then(function () {
					if (runtimeContext && runtimeContext.routeSignal && runtimeContext.routeSignal.aborted) {
						return;
					}
					installAdminCalendarOperationsLayout(window.MMED_OS);
					window.setTimeout(function () {
						if (window.MMED_OS && window.MMED_OS.render && typeof window.MMED_OS.render.calendar === "function") {
							window.MMED_OS.render.calendar();
						}
						scheduleAdminCalendarOperationsLayout();
					}, 180);
				}).catch(function (error) {
					state.metrics.error_state += 1;
					host.innerHTML = [
						'<div class="amos-native-unavailable">',
						"<span>CL</span>",
						"<h2>Calendar runtime could not load</h2>",
						"<p>" + escapeHTML(error && error.message ? error.message : "Student Calendar v4 runtime is unavailable.") + "</p>",
						'<a class="amos-btn" href="' + escapeAttr(adminDashboardUrl()) + '" data-amos-return-dashboard>Return to Matrix Admin HQ</a>',
						"</div>"
					].join("");
				});
			}

				function createAdminCalendarBridge(runtimeContext) {
					var month = new Date();
					month = new Date(month.getFullYear(), month.getMonth(), 1, 12);
					var adminProfile = {
						is_admin: true,
						context: "matrix-admin"
					};
					var bridge = {
						profile: adminProfile,
						state: {
							route: "calendar",
							profile: adminProfile,
							calendar: {
								month: month,
								selectedDate: new Date().toISOString().slice(0, 10),
							events: [],
							loading: false,
							error: null
						}
					},
					api: {
						nonce: config.auth && config.auth.nonce ? config.auth.nonce : "",
						url: function (endpoint, params) {
							return wpApi.url(endpoint, params);
						},
						get: function (endpoint, params) {
							return wpApi.get(endpoint, params).then(function (payload) {
								return normalizeAdminCalendarRuntimePayload(endpoint, payload);
							});
						},
						post: function (endpoint, body) {
							var payload = body || {};
							if (endpoint === "/events") {
								payload = Object.assign({ audience: "all_students" }, payload);
							}
							return wpApi.post(endpoint, payload).then(function (result) {
								return normalizeAdminCalendarRuntimePayload(endpoint, result);
							});
						},
						put: function (endpoint, body) {
							return wpApi.put(endpoint, body || {}).then(function (result) {
								return normalizeAdminCalendarRuntimePayload(endpoint, result);
							});
						},
						del: function (endpoint) {
							return wpApi.delete(endpoint);
						},
						delete: function (endpoint) {
							return wpApi.delete(endpoint);
						}
					},
					components: {
						loading: function (label) {
							return renderWpLoading(label || "Calendar");
						},
						empty: function (title, copy) {
							return '<div class="amos-empty"><strong>' + escapeHTML(title || "Nothing here yet") + "</strong><span>" + escapeHTML(copy || "") + "</span></div>";
						},
						pageHeader: function (eyebrow, title, copy) {
							return pageHeader(eyebrow || "Matrix Calendar", title || "Calendar", copy || "");
						}
					},
					render: {
						sidebar: function () {},
						calendar: function () {
							var content = document.getElementById("sos-content");
							if (content) {
								content.innerHTML = renderWpLoading("Calendar");
							}
						}
					},
					router: {
						route: function () {
							bridge.state.route = "calendar";
							if (bridge.render && typeof bridge.render.calendar === "function") {
								bridge.render.calendar();
							}
						}
					}
				};

					bridge.runtimeContext = runtimeContext || {};
					return bridge;
				}

				function installAdminCalendarOperationsLayout(bridge) {
					if (!bridge || !bridge.render || typeof bridge.render.calendar !== "function" || bridge.__amosAdminCalendarOpsInstalled) {
						scheduleAdminCalendarOperationsLayout();
						return;
					}

					bridge.__amosAdminCalendarOpsInstalled = true;
					var originalCalendarRender = bridge.render.calendar;
					bridge.render.calendar = function () {
						var result = originalCalendarRender.apply(this, arguments);
						scheduleAdminCalendarOperationsLayout();
						return result;
					};
					scheduleAdminCalendarOperationsLayout();
				}

				function scheduleAdminCalendarOperationsLayout() {
					window.clearTimeout(adminCalendarBridgeState.layoutTimer);
					adminCalendarBridgeState.layoutTimer = window.setTimeout(applyAdminCalendarOperationsLayout, 80);
				}

				function applyAdminCalendarOperationsLayout() {
					if (!document.body || !document.body.classList.contains("matrix-admin-app-mode-calendar")) {
						return;
					}

					var host = document.querySelector(".amos-student-calendar-host") || document.getElementById("sos-content");
					var app = host && host.querySelector ? host.querySelector(".cal-app") : null;
					if (!app) {
						return;
					}

					app.classList.add("amos-admin-calendar-ops");
					var tracker = app.querySelector("#trackerModule, .cal-tracker");
					if (tracker) {
						tracker.hidden = true;
						tracker.setAttribute("aria-hidden", "true");
					}

					moveAdminCalendarTopicsIntoRail(app);
					hideAdminCalendarStudentOnlyItems(app);
					wireAdminCalendarTopicsButton(app);
					fixAdminCalendarModalContrast();
				}

				function moveAdminCalendarTopicsIntoRail(app) {
					var panelContent = app.querySelector("#panelContent");
					var adminPanel = app.querySelector("#adminPanel");
					if (!panelContent || !adminPanel) {
						return;
					}

					var topicSection = app.querySelector("#amosAdminCalendarTopicSection");
					if (!topicSection) {
						topicSection = document.createElement("div");
						topicSection.className = "panel-section admin-topic-section";
						topicSection.id = "amosAdminCalendarTopicSection";
						topicSection.innerHTML = [
							'<div class="panel-section-title">',
							"Medical Topics",
							'<span class="badge-count">Dr. J</span>',
							"</div>",
							'<div class="amos-admin-topic-slot"></div>'
						].join("");
					}

					var todoSection = app.querySelector("#todoSection");
					if (todoSection && todoSection.parentNode) {
						todoSection.parentNode.replaceChild(topicSection, todoSection);
					} else if (!topicSection.parentNode) {
						var catSection = app.querySelector("#catSection");
						if (catSection && catSection.parentNode) {
							catSection.parentNode.insertBefore(topicSection, catSection.nextSibling);
						} else {
							panelContent.appendChild(topicSection);
						}
					}

					var slot = topicSection.querySelector(".amos-admin-topic-slot") || topicSection;
					if (adminPanel.parentNode !== slot) {
						slot.appendChild(adminPanel);
					}
					adminPanel.classList.add("show");
					adminPanel.style.display = "block";

					var topicTitle = adminPanel.querySelector(".cal-admin-title");
					if (topicTitle) {
						topicTitle.innerHTML = "Quick Schedule: Dr. J's Drills";
					}

					var todoCollapsedTab = app.querySelector('.ptab[data-section="todos"], .ptab[data-section="topics"]');
					if (todoCollapsedTab) {
						todoCollapsedTab.setAttribute("data-section", "topics");
						var icon = todoCollapsedTab.querySelector(".ptab-icon");
						var tooltip = todoCollapsedTab.querySelector(".ptab-tooltip");
						var badge = todoCollapsedTab.querySelector(".ptab-badge");
						if (icon) {
							icon.innerHTML = "&#128300;";
						}
						if (tooltip) {
							tooltip.textContent = "Medical Topics";
						}
						if (badge) {
							badge.remove();
						}
					}
				}

				function hideAdminCalendarStudentOnlyItems(app) {
					app.querySelectorAll('.cat-filter[data-cat="rotations"], .cat-filter[data-cat="study"]').forEach(function (item) {
						item.classList.add("amos-admin-calendar-hidden");
						item.setAttribute("aria-hidden", "true");
					});

					app.querySelectorAll(".cal-event-chip, .cal-week-event, .cal-day-view-event, .cal-agenda-item").forEach(function (item) {
						var text = item.textContent || "";
						if (/IM Rotation|Surgery Rotation|UWorld|Anki Review|FA Review/i.test(text)) {
							item.classList.add("amos-admin-calendar-hidden");
							item.setAttribute("aria-hidden", "true");
						}
					});
				}

				function wireAdminCalendarTopicsButton(app) {
					var button = app.querySelector("#adminToggle");
					var topicSection = app.querySelector("#amosAdminCalendarTopicSection");
					if (!button || button.__amosTopicsButton || !topicSection) {
						return;
					}

					button.__amosTopicsButton = true;
					button.innerHTML = "&#128300; Topics";
					button.addEventListener("click", function () {
						window.setTimeout(function () {
							var adminPanel = app.querySelector("#adminPanel");
							if (adminPanel) {
								adminPanel.classList.add("show");
								adminPanel.style.display = "block";
							}
							topicSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
						}, 0);
					});
				}

				function fixAdminCalendarModalContrast() {
					document.querySelectorAll(".cal-modal").forEach(function (modal) {
						modal.classList.add("amos-admin-calendar-modal");
					});
				}

				function normalizeAdminCalendarRuntimePayload(endpoint, payload) {
				if (endpoint !== "/events" || !payload || typeof payload !== "object") {
					return payload;
				}
				var adminUserId = safeCount(config.currentUser && config.currentUser.id ? config.currentUser.id : config.user && config.user.id ? config.user.id : 1) || 1;
				var next = Object.assign({}, payload);
				if (Array.isArray(next.events)) {
					next.events = next.events.map(function (event) {
						return normalizeAdminCalendarRuntimeEvent(event, adminUserId);
					});
				}
				if (Array.isArray(next.items)) {
					next.items = next.items.map(function (event) {
						return normalizeAdminCalendarRuntimeEvent(event, adminUserId);
					});
				}
				if (next.id) {
					return normalizeAdminCalendarRuntimeEvent(next, adminUserId);
				}
				return next;
			}

			function normalizeAdminCalendarRuntimeEvent(event, adminUserId) {
				if (!event || typeof event !== "object") {
					return event;
				}
				if (safeCount(event.user_id) !== 0 || String(event.source || "manual") === "scheduler") {
					return event;
				}
				var next = Object.assign({}, event);
				next.admin_audience = "all_students";
				next.original_user_id = 0;
				next.user_id = adminUserId;
				if (String(next.source || "") === "system") {
					next.source = "manual";
				}
				next.meta = Object.assign({}, next.meta || {}, { audience: "all_students" });
				return next;
			}

			function ensureAdminRuntimeStylesheet(id, href) {
				if (!href) {
					return;
				}
				var existing = document.getElementById(id);
				if (existing) {
					existing.setAttribute("href", href);
					return;
				}
				var link = document.createElement("link");
				link.id = id;
				link.rel = "stylesheet";
				link.href = href;
				document.head.appendChild(link);
			}

			function reloadAdminRuntimeScript(id, src, runtimeContext) {
				return new Promise(function (resolve, reject) {
					document.querySelectorAll("#" + id).forEach(function (script) {
						if (script.parentNode) {
							script.parentNode.removeChild(script);
						}
					});
					var next = document.createElement("script");
					next.id = id;
					next.async = false;
					next.onload = resolve;
					next.onerror = function () {
						reject(new Error("Failed to load " + src + "."));
					};
					next.src = src;
					if (runtimeContext && runtimeContext.routeSignal && runtimeContext.routeSignal.aborted) {
						resolve();
						return;
					}
					document.body.appendChild(next);
				});
			}

			function unmountAdminCalendarRuntime() {
				if (!adminCalendarBridgeState.active) {
					return;
					}
					adminCalendarBridgeState.active = false;
					window.clearTimeout(adminCalendarBridgeState.layoutTimer);
					adminCalendarBridgeState.layoutTimer = null;
					var script = document.getElementById(adminCalendarBridgeState.scriptId);
				if (script && script.parentNode) {
					script.parentNode.removeChild(script);
				}
				if (window.MMED_OS === window.MMED_ADMIN_CALENDAR_OS) {
					window.MMED_OS = adminCalendarBridgeState.previousOs || undefined;
				}
				window.MMED_ADMIN_CALENDAR_OS = null;
				adminCalendarBridgeState.previousOs = null;
			}

			function activateSourceMode(root, kind) {
			if (!root) {
				return;
			}
			try {
				if (kind === "calendar") {
					var adminToggle = root.querySelector("#adminToggle");
					var adminPanel = root.querySelector("#adminPanel");
					if (adminToggle && adminPanel && !/\bshow\b/.test(adminPanel.className || "")) {
						adminToggle.click();
					}
				}
				if (kind === "file-vault-admin") {
					var modeButtons = root.querySelectorAll("#modeTg button");
					if (modeButtons[1]) {
						modeButtons[1].click();
					}
				}
				if (kind === "storyforge-advisor") {
					var advisorButton = root.querySelector("#roleAdvisor");
					if (advisorButton) {
						advisorButton.click();
					}
					var reviewButton = Array.prototype.find.call(root.querySelectorAll("button"), function (button) {
						return /Advisor Review/.test(button.textContent || "");
					});
					if (reviewButton) {
						reviewButton.click();
					}
				}
			} catch (error) {
				state.metrics.error_state += 1;
			}
		}

		function showToast(message) {
			var toast = document.querySelector(".amos-toast");
		if (!toast) {
			toast = document.createElement("div");
			toast.className = "amos-toast";
			toast.setAttribute("role", "status");
			document.body.appendChild(toast);
		}
		toast.textContent = message;
		toast.classList.add("is-visible");
		window.clearTimeout(showToast.timer);
		showToast.timer = window.setTimeout(function () {
			toast.classList.remove("is-visible");
		}, 2600);
	}

	function disabledButton(label, tooltip) {
		return '<button type="button" class="amos-btn amos-btn-disabled" aria-disabled="true" data-amos-disabled-action="' + escapeAttr(tooltip || "Preview only. Backend wiring deferred.") + '">' + escapeHTML(label) + "</button>";
	}

	function formPreview(label, value) {
		return '<label class="amos-form-preview"><span>' + escapeHTML(label) + '</span><strong>' + escapeHTML(value) + "</strong></label>";
	}

	function adminDataTable(headers, rows) {
		return [
			'<div class="amos-table-wrap"><table class="amos-table">',
			"<thead><tr>" + headers.map(function (header) { return "<th>" + escapeHTML(header) + "</th>"; }).join("") + "</tr></thead>",
			"<tbody>",
			rows.map(function (row) {
				return "<tr>" + row.map(function (cell) { return "<td>" + escapeHTML(cell) + "</td>"; }).join("") + "</tr>";
			}).join(""),
			"</tbody></table></div>"
		].join("");
	}

	function pageHeader(eyebrow, title, copy, mirrorBadge) {
		return [
			'<header class="amos-page-head">',
			'<div class="amos-page-kickers"><span class="amos-eyebrow">' + escapeHTML(eyebrow) + "</span>",
			mirrorBadge ? '<span class="amos-mirror">' + escapeHTML(mirrorBadge) + "</span>" : "",
			"</div>",
			"<h2>" + escapeHTML(title) + "</h2>",
			copy ? "<p>" + escapeHTML(copy) + "</p>" : "",
			"</header>"
		].join("");
	}

	function overviewCard(item) {
		return [
			'<a class="amos-overview-card ' + escapeAttr(item.tone || "blue") + '" href="' + escapeAttr(item.route || "#dashboard") + '">',
			'<span>' + escapeHTML(item.label) + "</span>",
			"<strong>" + escapeHTML(item.value) + "</strong>",
			"<small>" + escapeHTML(item.note) + "</small>",
			"</a>"
		].join("");
	}

	function groupCard(group) {
		return [
			'<article class="amos-card amos-group-card">',
			"<h3>" + escapeHTML(group.title) + "</h3>",
			"<p>" + escapeHTML(group.copy) + "</p>",
			'<div class="amos-chip-grid">',
			group.items.map(function (id) {
				var meta = MODULE_META[id];
				if (!meta || !moduleVisible(meta)) {
					return "";
				}
				return '<a class="amos-chip" href="' + escapeAttr(meta.route) + '"><span>' + escapeHTML(meta.icon) + "</span>" + escapeHTML(meta.label) + "</a>";
			}).join(""),
			"</div>",
			"</article>"
		].join("");
	}

	function statCard(label, value, sublabel, tone) {
		return [
			'<article class="amos-stat-card ' + escapeAttr(tone || "blue") + '">',
			"<span>" + escapeHTML(label) + "</span>",
			"<strong>" + escapeHTML(value) + "</strong>",
			"<small>" + escapeHTML(sublabel) + "</small>",
			"</article>"
		].join("");
	}

	function miniStat(label, copy, value) {
		return [
			'<div class="mini-stat">',
			"<span>" + escapeHTML(label) + "</span>",
			"<strong>" + escapeHTML(value) + "</strong>",
			"<small>" + escapeHTML(copy) + "</small>",
			"</div>"
		].join("");
	}

	function queueItem(title, copy, href) {
		return [
			'<li>',
			'<a href="' + escapeAttr(href || "#dashboard") + '">',
			"<strong>" + escapeHTML(title) + "</strong>",
			"<span>" + escapeHTML(copy) + "</span>",
			"</a>",
			"</li>"
		].join("");
	}

	function routeRow(label, value) {
		return [
			'<div class="amos-route-row">',
			"<dt>" + escapeHTML(label) + "</dt>",
			"<dd>" + escapeHTML(value) + "</dd>",
			"</div>"
		].join("");
	}

	function sourceBlock(source) {
		return [
			'<div class="amos-source-block">',
			'<span class="amos-pill ' + escapeAttr(source.tone || "blue") + '">' + escapeHTML(source.status || "Source") + "</span>",
			"<p>" + escapeHTML(source.detail || "") + "</p>",
			"<code>" + escapeHTML(source.path || "") + "</code>",
			"</div>"
		].join("");
	}

	function mirrorUrl(mirror) {
		if (!mirror) {
			return "";
		}
		var lower = String(mirror).toLowerCase();
		if (lower === "scheduler") {
			return CANONICAL.studentScheduler;
		}
		if (lower === "calendar") {
			return CANONICAL.studentCalendar;
		}
		if (lower === "file vault") {
			return CANONICAL.studentFileVault;
		}
		if (lower === "messages") {
			return CANONICAL.studentMessages;
		}
		if (lower === "storyforge") {
			return CANONICAL.studentStoryForge;
		}
		return CANONICAL.studentMatrix;
	}

	function moduleErrorState(module, error) {
		return [
			'<section class="amos-page">',
			'<div class="amos-error-card">',
			"<h2>" + escapeHTML(module.label || "Module") + " could not load</h2>",
			"<p>" + escapeHTML(error && error.message ? error.message : "The module returned an error.") + "</p>",
			'<button type="button" class="amos-btn" data-amos-retry>Try Again</button>',
			"</div>",
			"</section>"
		].join("");
	}

	function moduleEmptyState(module) {
		return '<div class="amos-empty">No ' + escapeHTML(module.label || "module data") + " yet.</div>";
	}

	function lockedState(module) {
		return '<section class="amos-page"><div class="amos-error-card"><h2>Insufficient Permissions</h2><p>' + escapeHTML(module.label || "This module") + " is not available for this admin context.</p></div></section>";
	}

	function renderAuthError(error) {
		return '<section class="amos-page"><div class="amos-error-card"><h2>' + escapeHTML(PRODUCT_NAME) + ' could not start</h2><p>' + escapeHTML(error && error.message ? error.message : "Auth bootstrap failed closed.") + "</p></div></section>";
	}

	function bindRetry(module) {
		var retry = refs.content.querySelector("[data-amos-retry]");
		if (!retry) {
			return;
		}
		retry.addEventListener("click", function () {
			delete state.loaded[module.id];
			state.activeModuleId = null;
			route();
		});
	}

	function unmountNoop() {}

	function parseJson(text) {
		if (!text) {
			return null;
		}
		try {
			return JSON.parse(text);
		} catch (error) {
			return { raw: text };
		}
	}

	function absoluteUrl(path) {
		if (!path) {
			return "";
		}
		if (/^https?:\/\//.test(path)) {
			return path;
		}
		return window.location.origin + path;
	}

	function escapeHTML(value) {
		return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
			return {
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				'"': "&quot;",
				"'": "&#039;"
			}[char];
		});
	}

	function escapeAttr(value) {
		return escapeHTML(value);
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
