(function () {
	"use strict";

	var app = window.MMED_OS || {};
	var refs = {};

	if (window.mmedStudentOsFeatureFlags && window.mmedStudentOsFeatureFlags.feature_flags) {
		app.feature_flags = window.mmedStudentOsFeatureFlags.feature_flags;
	}

	app.feature_flags = app.feature_flags || {};
	app.runtime_v2 = normalizeRuntimeV2Config(window.mmedStudentOsFeatureFlags && window.mmedStudentOsFeatureFlags.runtime_v2);

	app.state = {
		profile: app.profile || {},
		stats: app.stats || {},
		modules: Array.isArray(app.modules) ? app.modules : [],
		route: "dashboard",
		statsLoaded: false,
		statsLoading: false,
		courses: null,
		courseShell: null,
		orders: null,
		notifications: null,
		messages: null,
		communications: null,
		files: null,
			dashboardOverview: {
				loaded: false,
				loading: false,
				events: [],
				schedulerEvents: [],
				messages: [],
				files: [],
				todos: [],
			arenaBattles: [],
			errors: {}
		},
		appointments: {
			loaded: false,
			loading: false,
			upcoming: [],
			history: [],
			error: "",
			notice: "",
			busyId: ""
		},
		studentProfile: {
			loaded: false,
			loading: false,
			saving: false,
			data: null,
			progress: null,
			requiredFields: ["first_name", "last_name", "phone_mobile", "primary_specialty"],
			promptDismissed: false,
			promptShown: false,
			sessionReminded: false,
			activeTab: "basics",
			status: ""
		},
		ranklist: null,
		lor: null,
		arena: null,
		ssa: app.ssa || {},
		fileCategory: "documents",
		fileVaultView: "list",
		fileSearch: "",
		filePreviewId: "",
		uploads: [],
		calendar: {
			month: startOfMonth(new Date()),
			selectedDate: dateKey(new Date()),
			events: [],
			loadedKey: "",
			loading: false
		},
		study: {
			date: dateKey(new Date()),
			blocks: [],
			weekBlocks: [],
			loading: false
		}
	};

	/* --- Access Gate --- */
	var accessData = app.access || {};
	var accessTier = accessData.tier || "enrolled";
	var freeModules = Array.isArray(accessData.free_modules) ? accessData.free_modules : ["dashboard", "arena"];
	var isEnrolled = accessData.is_enrolled !== false;
	var profileAccessData = app.profile || app.state.profile || {};
	var isAdminFullAccess = truthyAccessFlag(accessData.admin_full_access) || truthyAccessFlag(accessData.is_admin) || truthyAccessFlag(profileAccessData.admin_full_access) || truthyAccessFlag(profileAccessData.is_admin);
	var promoCourses = Array.isArray(accessData.promo_courses) ? accessData.promo_courses : [];
	var modulePermissions = accessData.module_permissions && typeof accessData.module_permissions === "object" ? accessData.module_permissions : {};
	var MATRIX_TEMPORARY_OPEN_ROUTES = ["dashboard", "calendar", "scheduler", "appointments", "profile", "filevault"];

	function truthyAccessFlag(value) {
		return value === true || value === 1 || value === "1" || value === "true";
	}

	function normalizeMatrixRoute(route) {
		return String(route || "dashboard").replace(/^#\/?/, "") || "dashboard";
	}

	function isMatrixTemporaryOpenRoute(route) {
		return MATRIX_TEMPORARY_OPEN_ROUTES.indexOf(normalizeMatrixRoute(route)) !== -1;
	}

	function isMatrixTemporarilyLocked(route) {
		return !isMatrixTemporaryOpenRoute(route);
	}

	function hasModulePermission(route) {
		return truthyAccessFlag(modulePermissions[normalizeMatrixRoute(route)]);
	}

	function isModuleLocked(route) {
		route = normalizeMatrixRoute(route);
		if (route === "cam") return !hasModulePermission("cam");
		if (isAdminFullAccess) return false;
		if (hasModulePermission(route)) return false;
		if (isMatrixTemporarilyLocked(route)) return true;
		if (isEnrolled) return false;
		if (route === "messages") return false;
		return freeModules.indexOf(route) === -1;
	}

	var MATRIX_APP_MODE_CLASS = "matrix-app-mode";
	var MATRIX_APP_MODE_MODULE_CLASSES = [
		"matrix-app-mode-calendar",
		"matrix-app-mode-scheduler",
		"matrix-app-mode-file-vault",
		"matrix-app-mode-messages",
		"matrix-app-mode-storyforge"
	];
	var MATRIX_APP_MODE_CLASS_BY_NAME = {
		calendar: "matrix-app-mode-calendar",
		scheduler: "matrix-app-mode-scheduler",
		filevault: "matrix-app-mode-file-vault",
		"file-vault": "matrix-app-mode-file-vault",
		messages: "matrix-app-mode-messages",
		storyforge: "matrix-app-mode-storyforge"
	};
	var MATRIX_APP_MODE_ROUTE_BY_NAME = {
		calendar: "calendar",
		scheduler: "scheduler",
		filevault: "filevault",
		messages: "messages",
		storyforge: "storyforge"
	};

	var MATRIX_APP_RETURN_ID = "mmed-matrix-app-return";

	function matrixBody() {
		return document.body || null;
	}

	function clearMatrixAppModeClasses(body) {
		if (!body) {
			return;
		}

		removeMatrixAppModeReturn();
		body.classList.remove(MATRIX_APP_MODE_CLASS);
		MATRIX_APP_MODE_MODULE_CLASSES.forEach(function (className) {
			body.classList.remove(className);
		});
		body.removeAttribute("data-matrix-app-mode");
	}

	function removeMatrixAppModeReturn() {
		var existing = document.getElementById(MATRIX_APP_RETURN_ID);
		if (existing && existing.parentNode) {
			existing.parentNode.removeChild(existing);
		}
	}

	function hasNativeMatrixReturn(root) {
		return !!(
			root &&
			root.querySelector(
				".sos-scheduler-dashboard-return, " +
				".sos-filevault-dashboard-return, " +
				".sos-calendar-dashboard-return, " +
				".sos-messages-dashboard-return, " +
				".sos-storyforge-dashboard-return, " +
				"[data-matrix-app-mode-return]:not(#" + MATRIX_APP_RETURN_ID + "), " +
				"[data-matrix-dashboard-return]:not(#" + MATRIX_APP_RETURN_ID + ")"
			)
		);
	}

	function ensureMatrixAppModeReturn(mode) {
		var root = refs.root || document.getElementById("student-os-root");

		if (!root || !MATRIX_APP_MODE_CLASS_BY_NAME[mode]) {
			removeMatrixAppModeReturn();
			return;
		}

		if (hasNativeMatrixReturn(root)) {
			removeMatrixAppModeReturn();
			return;
		}

		if (document.getElementById(MATRIX_APP_RETURN_ID)) {
			return;
		}

		var link = document.createElement("a");
		link.id = MATRIX_APP_RETURN_ID;
		link.className = "sos-matrix-app-return matrix-app-mode-return";
		link.href = "#dashboard";
		link.setAttribute("aria-label", "Return to Matrix Dashboard");
		link.setAttribute("data-matrix-app-mode-return", "1");
		link.setAttribute("data-matrix-dashboard-return", "true");
		link.innerHTML = '<span aria-hidden="true">D</span><strong>Return to Matrix Dashboard</strong>';
		root.appendChild(link);
	}

	function scheduleMatrixAppModeReturn(mode) {
		window.setTimeout(function () {
			ensureMatrixAppModeReturn(mode);
		}, 0);
		window.setTimeout(function () {
			ensureMatrixAppModeReturn(mode);
		}, 250);
	}

	function syncMatrixAppModeForRoute(route) {
		var appModeName = MATRIX_APP_MODE_ROUTE_BY_NAME[route] || "";

		if (appModeName && app.appMode && typeof app.appMode.activate === "function") {
			app.appMode.activate(appModeName);
			return;
		}

		if (app.appMode && typeof app.appMode.deactivateUnless === "function") {
			app.appMode.deactivateUnless(route);
		}
	}

	app.appMode = {
		activate: function (mode) {
			var body = matrixBody();
			var className = MATRIX_APP_MODE_CLASS_BY_NAME[mode];

			if (!body || !className) {
				return;
			}

			MATRIX_APP_MODE_MODULE_CLASSES.forEach(function (moduleClass) {
				if (moduleClass !== className) {
					body.classList.remove(moduleClass);
				}
			});
			body.classList.add(MATRIX_APP_MODE_CLASS, className);
			body.setAttribute("data-matrix-app-mode", mode);
			scheduleMatrixAppModeReturn(mode);
		},
		deactivate: function (mode) {
			var body = matrixBody();

			if (!body) {
				return;
			}

			if (mode && body.getAttribute("data-matrix-app-mode") !== mode) {
				return;
			}

			clearMatrixAppModeClasses(body);
		},
		deactivateAll: function () {
			clearMatrixAppModeClasses(matrixBody());
		},
		deactivateUnless: function (route) {
			var body = matrixBody();
			var expectedMode = MATRIX_APP_MODE_ROUTE_BY_NAME[route] || "";

			if (!body) {
				return;
			}

			if (!expectedMode || (body.getAttribute("data-matrix-app-mode") && body.getAttribute("data-matrix-app-mode") !== expectedMode)) {
				clearMatrixAppModeClasses(body);
			}
		}
	};
	window.MMEDMatrixAppMode = app.appMode;


	app.api = {
		base: "/wp-json/mmed/v1",
		nonce: "",
		getCache: {},
		getInflight: {},
		getCacheTtl: 15000,

		init: function (root) {
			this.base = root.getAttribute("data-api-base") || this.base;
			this.nonce = root.getAttribute("data-nonce") || "";
		},

		url: function (endpoint, params) {
			var base = this.base.replace(/\/$/, "");
			var path = String(endpoint || "").replace(/^\//, "");
			var url = new URL(base + "/" + path, window.location.origin);

			Object.keys(params || {}).forEach(function (key) {
				if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
					url.searchParams.set(key, params[key]);
				}
			});

			return url;
		},

		cacheKey: function (endpoint, params) {
			var normalized = {};

			Object.keys(params || {}).sort().forEach(function (key) {
				normalized[key] = params[key];
			});

			return this.url(endpoint, normalized).toString();
		},

		clearGetCache: function () {
			this.getCache = {};
			this.getInflight = {};
		},

		request: function (endpoint, options, params) {
			options = options || {};
			options.credentials = "same-origin";
			options.headers = options.headers || {};
			options.headers["X-WP-Nonce"] = this.nonce;

			return fetch(this.url(endpoint, params), options).then(function (response) {
				return response.json().then(function (payload) {
					if (!response.ok) {
						throw new Error(payload && payload.message ? payload.message : "Request failed");
					}

					return payload;
				});
			});
		},

		get: function (endpoint, params) {
			var key = this.cacheKey(endpoint, params);
			var cached = this.getCache[key];
			var api = this;
			var request;

			if (cached && cached.expires > Date.now()) {
				return Promise.resolve(cached.payload);
			}

			if (this.getInflight[key]) {
				return this.getInflight[key];
			}

			request = this.request(endpoint, { method: "GET" }, params).then(function (payload) {
				api.getCache[key] = {
					expires: Date.now() + api.getCacheTtl,
					payload: payload
				};
				delete api.getInflight[key];
				return payload;
			}, function (error) {
				delete api.getInflight[key];
				throw error;
			});

			this.getInflight[key] = request;
			return request;
		},

		post: function (endpoint, body) {
			this.clearGetCache();
			return this.request(endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body || {})
			});
		},

		put: function (endpoint, body) {
			this.clearGetCache();
			return this.request(endpoint, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body || {})
			});
		},

		delete: function (endpoint) {
			this.clearGetCache();
			return this.request(endpoint, { method: "DELETE" });
		}
	};

	app.router = {
		start: function () {
			window.addEventListener("hashchange", this.route.bind(this));

			if (!window.location.hash) {
				window.history.replaceState(null, "", "#dashboard");
			}

			this.route();
		},

		route: function () {
			var route = window.location.hash.replace(/^#\/?/, "") || "dashboard";
			var allowed = app.components.navItems().map(function (item) {
				return item.route;
			});

			if (allowed.indexOf(route) === -1) {
				route = "dashboard";
			}

				if (isModuleLocked(route)) {
					var fallbackRoute = app.state.route && !isModuleLocked(app.state.route) ? app.state.route : "dashboard";
					showLockedRouteNotice(route);
					window.history.replaceState(null, "", "#" + fallbackRoute);
					route = fallbackRoute;
				}

			app.state.route = route;
			syncMatrixAppModeForRoute(route);
			app.render.sidebar();
			if (
				app.runtime &&
				typeof app.runtime.navigate === "function" &&
				app.runtime_v2 &&
				app.runtime_v2.enabled
			) {
				app.runtime.navigate(route);
				return;
			}

			app.render.page(route);
		}
	};

	app.components = {
		navItems: function () {
			var items = [
				{ route: "dashboard", label: "Dashboard", icon: "D", section: "Command" }
			];

			app.state.modules.forEach(function (module) {
				if (!module || module.enabled === false) {
					return;
				}

				var route = module.route || module.slug || module.id;
				var label = matrixDisplayLabel(module.label || module.name);

				if (!route || !label) {
					return;
				}

					items.push({
						route: String(route).replace(/^#/, ""),
						label: label,
						icon: module.icon || label.charAt(0),
						section: module.section || "Matrix",
						badge: module.badge,
						launchUrl: module.launch_url || ""
					});
				});

				var schedulerIndex = items.findIndex(function (item) {
					return item && item.route === "scheduler";
				});

				if (schedulerIndex !== -1 && !items.some(function (item) { return item && item.label === "My Appointments"; })) {
					items.splice(schedulerIndex + 1, 0, {
						route: "appointments",
						label: "My Appointments",
						icon: "Ap",
						section: items[schedulerIndex].section || "Planning"
					});
				}

				return items;
			},

		pageHeader: function (eyebrow, title, copy) {
			return [
				'<header class="sos-page-header">',
				'<span class="sos-eyebrow">' + escapeHTML(eyebrow) + "</span>",
				'<h1 class="sos-page-title">' + escapeHTML(title) + "</h1>",
				copy ? '<p class="sos-page-copy">' + escapeHTML(copy) + "</p>" : "",
				"</header>"
			].join("");
		},

		statCard: function (value, label, tone, sublabel) {
			return [
				'<div class="sos-card sos-stat">',
				"<div>",
				'<span class="sos-stat-value" style="color:' + escapeAttr(tone || "var(--gold2)") + '">' + escapeHTML(value) + "</span>",
				'<span class="sos-stat-label">' + escapeHTML(label) + "</span>",
				sublabel ? '<span class="sos-stat-sub">' + escapeHTML(sublabel) + "</span>" : "",
				"</div>",
				"</div>"
			].join("");
		},

		tracker: function (phase) {
			var phases = phase && Array.isArray(phase.phases) ? phase.phases : [];
			var currentIndex = phase && typeof phase.current_index === "number" ? phase.current_index : 0;
			var currentPhase = phases[currentIndex] || null;

			if (!phases.length) {
				return [
					'<div class="sos-tracker-board">',
					'<div class="sos-tracker-title">Matrix<span>Journey</span></div>',
					'<div class="sos-empty">No phase tracker is available for this account yet.</div>',
					"</div>"
				].join("");
			}

			return [
				'<div class="sos-tracker-board">',
				'<div class="sos-tracker-top"><div>',
				'<div class="sos-tracker-title">Matrix<span>Journey</span></div>',
				'<div class="sos-tracker-copy">Completed segments turn green; your current phase pulses orange.</div>',
				"</div></div>",
				'<div class="sos-tracker-labels" style="grid-template-columns:repeat(' + phases.length + ',1fr)">',
				phases.map(function (item) {
					return "<span>" + escapeHTML(item.name || item.id || "") + "</span>";
				}).join(""),
				"</div>",
				'<div class="sos-segment-bar" style="grid-template-columns:repeat(' + phases.length + ',1fr)">',
				phases.map(function (item, index) {
					var classes = ["sos-segment"];
					if (item.complete) {
						classes.push("is-complete");
					} else if (index === currentIndex) {
						classes.push("is-active");
					}

					return '<div class="' + classes.join(" ") + '">' + (index + 1) + "</div>";
				}).join(""),
				"</div>",
				'<div class="sos-status-strip">Current phase: <strong>' + escapeHTML(currentPhase ? currentPhase.name || currentPhase.id : "Assigned") + "</strong></div>",
				"</div>"
			].join("");
		},

		loading: function (label) {
			return '<div class="sos-loading">' + escapeHTML(label || "Loading Matrix data...") + "</div>";
		},

		empty: function (title, copy) {
			return [
				'<div class="sos-empty sos-empty-rich">',
				'<div class="sos-empty-icon">MM</div>',
				'<h3>' + escapeHTML(title) + "</h3>",
				'<p>' + escapeHTML(copy || "") + "</p>",
				"</div>"
			].join("");
		}
	};

	app.render = {
		sidebar: function () {
			var profile = app.state.profile || {};
			var grouped = groupBySection(app.components.navItems());
			var sections = Object.keys(grouped).map(function (section) {
				return [
					'<div class="sos-nav-section">',
					'<div class="sos-nav-label">' + escapeHTML(section) + "</div>",
					'<ul class="sos-nav-list">',
					grouped[section].map(function (item) {
						var active = item.route === app.state.route ? " is-active" : "";
						var locked = isModuleLocked(item.route);
						var badge = item.badge ? '<span class="sos-nav-badge">' + escapeHTML(item.badge) + "</span>" : "";
						var lockIcon = locked ? '<svg class="sos-nav-lock-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' : "";
						var camLaunchUrl = item.route === "cam" ? safeCamLaunchUrl(item.launchUrl) : "";
						var href = locked ? "javascript:void(0)" : (camLaunchUrl ? escapeAttr(camLaunchUrl) : "#" + escapeAttr(item.route));
						var lockedClass = locked ? " sos-nav-locked" : "";
						var lockedAttr = locked ? ' data-locked="true" data-route="' + escapeAttr(item.route) + '" aria-disabled="true" title="Temporarily locked"' : "";
						var lockedBadge = locked ? '<span class="sos-nav-locked-label">Locked</span>' : "";

						return [
							"<li>",
							'<a class="sos-nav-link' + active + lockedClass + '" href="' + href + '"' + lockedAttr + '>',
							'<span class="sos-nav-icon">' + escapeHTML(String(item.icon || "").slice(0, 2).toUpperCase()) + "</span>",
							"<span>" + escapeHTML(item.label) + "</span>",
							lockedBadge,
							lockIcon,
							badge,
							"</a>",
							"</li>"
						].join("");
					}).join(""),
					"</ul>",
					"</div>"
				].join("");
			}).join("");

			refs.sidebar.innerHTML = [
				'<div class="sos-brand">',
				'<div class="sos-brand-mark">MM</div>',
				'<div class="sos-brand-title">Matrix<small>MissionMed</small></div>',
				"</div>",
				sections,
				'<div class="sos-sidebar-footer">',
				'<div class="sos-user">',
				avatarMarkup(profile),
				"<div>",
				'<div class="sos-user-name">' + escapeHTML(profile.display_name || "Student") + "</div>",
				'<div class="sos-user-role">' + escapeHTML(formatProgram(profile.program_tier || profile.division || "Matrix")) + "</div>",
				"</div>",
			"</div>",
			'<a class="sos-logout-link" href="' + escapeAttr((app.state.profile && app.state.profile.logout_url) || "/my-account/customer-logout/") + '">',
			'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
			'<span>Log Out</span>',
			"</a>",
			"</div>"
			].join("");

				refs.sidebar.querySelectorAll("[data-locked]").forEach(function (link) {
					link.addEventListener("click", function (event) {
						event.preventDefault();
						event.stopPropagation();
						showLockedRouteNotice(link.getAttribute("data-route"));
					});
				});
			},

		page: function (route) {
			if (route !== "scheduler" && window.MMEDScheduler && typeof window.MMEDScheduler.unmount === "function") {
				window.MMEDScheduler.unmount();
			}

			var renderMap = {
				dashboard: this.dashboard,
				calendar: this.calendar,
				scheduler: this.scheduler,
				appointments: this.appointments,
				courses: this.courses,
				profile: this.profile,
				orders: this.orders,
				settings: this.settings,
				notifications: this.notifications,
				messages: this.messages,
				cam: this.cam,
				storyforge: this.storyforge,
				help: this.help,
				filevault: this.fileVault,
				study: this.study,
				ranklist: this.ranklist,
				lor: this.lor,
				arena: this.arena
			};

			(renderMap[route] || this.dashboard).call(this);
		},

		dashboard: function () {
			var profile = app.state.profile || {};
			var stats = app.state.stats || {};
			var taskTotal = getNumber(stats.tasks_total, profile.tasks && profile.tasks.total);
			var taskApproved = getNumber(stats.tasks_approved, profile.tasks && profile.tasks.approved);
			var taskPercent = taskTotal ? Math.round((taskApproved / taskTotal) * 100) : 0;
			var activeCourses = getNumber(stats.active_courses, 0);
			var daysToNext = getNumber(stats.days_to_next_step, 0);
			var nextStep = stats.next_step_label || "No open step";
			var eventsWeek = getNumber(stats.upcoming_events_week, 0);
			var unreadMessages = getNumber(stats.unread_messages, 0);
			var firstName = firstNameFrom(profile.display_name || "Student");

			refs.content.innerHTML = [
				'<section class="sos-page">',
				app.components.pageHeader("Student Dashboard", "Welcome back, " + firstName + ".", "Your Matrix dashboard is synced to your MissionMed courses, calendar, messages, files, and live-session links."),
				'<div class="sos-grid sos-grid-stats">',
				app.components.statCard(activeCourses, "Active Courses", "var(--blue2)", "LearnDash enrollments"),
				app.components.statCard(taskApproved + "/" + taskTotal, "Task Progress", "var(--gold2)", "Approved Hub tasks"),
				app.components.statCard(daysToNext, "Days to Next Step", "var(--orange2)", nextStep),
				app.components.statCard(eventsWeek, "Events This Week", "var(--green)", "Calendar entries"),
				app.components.statCard(unreadMessages, "Unread Messages", "var(--blue2)", "Advisor inbox"),
				"</div>",
				app.components.tracker(profile.phase),
				renderDashboardOverview(stats),
				'<div class="sos-grid sos-grid-two">',
				'<div class="sos-card sos-card-pad">',
				'<div class="sos-panel-title">Current Focus</div>',
				'<h2 class="sos-panel-heading">' + escapeHTML(nextStep) + "</h2>",
				'<p class="sos-panel-copy">' + escapeHTML(taskTotal ? taskApproved + " of " + taskTotal + " assigned Hub tasks are approved." : "No assigned Hub tasks are available yet.") + "</p>",
				'<div class="sos-progress-line"><span>Approved tasks</span><span>' + escapeHTML(taskApproved + "/" + taskTotal) + "</span></div>",
				'<div class="sos-progress"><div class="sos-progress-fill" style="width:' + clampPercent(taskPercent) + '%"></div></div>',
				"</div>",
				'<div class="sos-card sos-card-pad">',
				'<div class="sos-panel-title">Learning</div>',
				'<h2 class="sos-panel-heading">' + escapeHTML(activeCourses + " active course" + (activeCourses === 1 ? "" : "s")) + "</h2>",
				'<p class="sos-panel-copy">' + escapeHTML(getNumber(stats.courses_in_progress, 0) + " course" + (getNumber(stats.courses_in_progress, 0) === 1 ? "" : "s") + " currently show progress.") + "</p>",
				"</div>",
				"</div>",
				!isEnrolled ? [
					'<div class="sos-arena-cta">',
					'<div class="sos-arena-cta-glow"></div>',
					'<div class="sos-arena-cta-content">',
					'<div class="sos-arena-cta-icon">AR</div>',
					"<div>",
					'<h2 class="sos-arena-cta-title">Enter the Arena</h2>',
					'<p class="sos-arena-cta-copy">Test your medical knowledge against AI opponents. Free for all registered MissionMed users.</p>',
					"</div>",
					'<a class="sos-btn sos-btn-primary" href="#arena">Launch Arena</a>',
					"</div>",
					"</div>"
				].join("") : "",
				"</section>"
			].join("");

			if (!app.state.statsLoaded && !app.state.statsLoading) {
				this.loadDashboardStats();
			}

			if (!app.state.dashboardOverview.loaded && !app.state.dashboardOverview.loading) {
				this.loadDashboardOverview();
			}

			maybeShowStudentProfilePrompt();
		},

		loadDashboardStats: function () {
			app.state.statsLoading = true;
			app.api.get("/user/stats").then(function (stats) {
				app.state.stats = stats || {};
				app.state.statsLoaded = true;
				app.state.statsLoading = false;

				if (app.state.route === "dashboard") {
					app.render.dashboard();
				}
			}).catch(showError);
		},

		loadDashboardOverview: function () {
			var overview = app.state.dashboardOverview;
			var today = new Date();
			var end = addDays(today, 7);
			var requests = [];
			var finish = function () {
				overview.loaded = true;
				overview.loading = false;
				if (app.state.route === "dashboard") {
					app.render.dashboard();
				}
			};

			overview.loading = true;
			overview.errors = {};

				requests.push(overviewRequest("/events", {
					start: dateKey(today) + "T00:00:00",
					end: dateKey(end) + "T23:59:59",
					no_sync: "1"
					}, "events", function (payload) {
						overview.events = payload && Array.isArray(payload.events) ? payload.events : [];
					}));

				requests.push(schedulerOverviewRequest("/calendar-feed", {
					start: dateKey(today) + "T00:00:00",
					end: dateKey(end) + "T23:59:59"
				}, "schedulerEvents", function (payload) {
					overview.schedulerEvents = payload && Array.isArray(payload.events) ? payload.events : [];
				}));

				requests.push(overviewRequest("/messages", { limit: 5 }, "messages", function (payload) {
					overview.messages = payload && Array.isArray(payload.messages) ? payload.messages : [];
			}));

			requests.push(overviewRequest("/files", {}, "files", function (payload) {
				overview.files = payload && Array.isArray(payload.files) ? payload.files : [];
			}));

			requests.push(overviewRequest("/todos", {}, "todos", function (payload) {
				overview.todos = payload && Array.isArray(payload.todos) ? payload.todos : [];
			}));

			if (app.feature_flags && app.feature_flags.arena_live_battles) {
				requests.push(overviewRequest("/arena-battles/active", {}, "arenaBattles", function (payload) {
					overview.arenaBattles = payload && Array.isArray(payload.battles) ? payload.battles : [];
				}));
			} else {
				overview.arenaBattles = [];
			}

			Promise.all(requests).then(finish).catch(finish);
		},

		calendar: function () {
			var month = app.state.calendar.month;
			var monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
			var eventsByDay = bucketEventsByDay(app.state.calendar.events);

			refs.content.innerHTML = [
				'<section class="sos-page sos-calendar-page">',
				app.components.pageHeader("Calendar", monthLabel, "Create, drag, and resize live Matrix events. Changes persist to the database."),
				'<div class="sos-toolbar">',
				'<button class="sos-btn sos-btn-icon" type="button" data-cal-prev aria-label="Previous month">&lt;</button>',
				'<button class="sos-btn" type="button" data-cal-today>Today</button>',
				'<button class="sos-btn sos-btn-icon" type="button" data-cal-next aria-label="Next month">&gt;</button>',
				'<button class="sos-btn sos-btn-primary" type="button" data-event-new>New Event</button>',
				ssaStatusPill(),
				'<button class="sos-btn sos-ssa-sync" type="button" data-ssa-sync>Sync SSA</button>',
				"</div>",
				'<div class="sos-calendar-layout">',
				'<div class="sos-card sos-calendar-card">',
				renderCalendarGrid(month, eventsByDay),
				"</div>",
				renderDaySchedule(app.state.calendar.selectedDate, eventsByDay[app.state.calendar.selectedDate] || []),
				"</div>",
				"</section>"
			].join("");

			bindCalendar();
			loadCalendarIfNeeded();
		},

		scheduler: function () {
			refs.content.innerHTML = [
				'<section class="sos-page sos-scheduler-native-page">',
				'<div id="mmed-scheduler-native-root">',
				app.components.loading("Loading Scheduler..."),
				"</div>",
				"</section>"
			].join("");

			mountNativeScheduler();
		},

		appointments: function () {
			var appointments = app.state.appointments || {};
			var upcoming = Array.isArray(appointments.upcoming) ? appointments.upcoming : [];
			var history = Array.isArray(appointments.history) ? appointments.history : [];

			refs.content.innerHTML = [
				'<section class="sos-page sos-appointments-page">',
				app.components.pageHeader("Scheduler", "My Appointments", "Upcoming and past Scheduler sessions."),
				appointments.notice ? '<div class="sos-card sos-card-pad sos-status-strip">' + escapeHTML(appointments.notice) + "</div>" : "",
				appointments.error ? '<div class="sos-card sos-card-pad sos-empty">' + escapeHTML(appointments.error) + "</div>" : "",
				appointments.loading && !appointments.loaded ? app.components.loading("Loading appointments...") : "",
				'<div class="sos-grid sos-grid-two">',
				renderAppointmentSection("Upcoming Appointments", upcoming, "No upcoming appointments found.", false),
				renderAppointmentSection("Past Appointments", history, "No past appointments found.", true),
				"</div>",
				"</section>"
			].join("");

			bindAppointments();
			if (!appointments.loaded && !appointments.loading) {
				loadMyAppointments(false);
			}
		},

		courses: function () {
			refs.content.innerHTML = '<section class="sos-page">' + app.components.pageHeader("Learning", "My Match Training", "Your course path, weekly priorities, and Match season signals.") + app.components.loading("Loading training...") + "</section>";

			app.api.get("/course-shell", freshReadParams()).then(function (data) {
				app.state.courseShell = data || {};
				app.state.courses = data && Array.isArray(data.courses) ? data.courses : [];
				renderCourseShell();
			}).catch(function (error) {
				app.state.courseShell = null;
				app.state.courses = [];
				renderCourseShellError(error);
			});
		},

		profile: function () {
			if (!app.state.studentProfile.loaded && !app.state.studentProfile.loading) {
				refs.content.innerHTML = '<section class="sos-page sos-profile-page">' + app.components.pageHeader("Ecosystem Profile", "My Profile", "Tell MissionMed your goals, timeline, scores, strengths, and avatar so every Matrix app can understand the same student profile.") + app.components.loading("Loading profile...") + "</section>";
				loadStudentProfile().then(function () {
					if (app.state.route === "profile") {
						app.render.profile();
					}
				}).catch(showError);
				return;
			}

			refs.content.innerHTML = renderStudentProfile();
			bindStudentProfile();
		},

		orders: function () {
			refs.content.innerHTML = '<section class="sos-page">' + app.components.pageHeader("Account", "Orders", "Your WooCommerce subscription and order history.") + app.components.loading("Loading orders...") + "</section>";

			app.api.get("/orders").then(function (data) {
				app.state.orders = data || { orders: [], subscription: {} };
				renderOrders();
			}).catch(showError);
		},

		settings: function () {
			var profile = app.state.profile || {};
			refs.content.innerHTML = [
				'<section class="sos-page">',
				app.components.pageHeader("Account", "Settings", "Your Matrix profile badge is read-only for this phase."),
				'<div class="sos-id-card sos-card">',
				avatarMarkup(profile, "large"),
				'<div class="sos-id-main">',
				'<span class="sos-panel-title">Student Identity</span>',
				'<h2>' + escapeHTML(profile.display_name || "Student") + "</h2>",
				'<p>' + escapeHTML(profile.email || "") + "</p>",
				'<div class="sos-badge-row">',
				'<span class="sos-pill">Division: ' + escapeHTML(formatProgram(profile.division || "Unassigned")) + "</span>",
				'<span class="sos-pill">Tier: ' + escapeHTML(formatProgram(profile.program_tier || "Matrix")) + "</span>",
				'<span class="sos-pill">Placement: ' + escapeHTML(profile.placement_ready ? "Ready" : "In Progress") + "</span>",
				"</div>",
				"</div>",
				"</div>",
				"</section>"
			].join("");
		},

		notifications: function () {
			refs.content.innerHTML = '<section class="sos-page">' + app.components.pageHeader("Account", "Notifications", "Task, event, and system activity from live MissionMed data.") + app.components.loading("Loading notifications...") + "</section>";

			app.api.get("/notifications", { limit: 20 }).then(function (data) {
				app.state.notifications = data && Array.isArray(data.notifications) ? data.notifications : [];
				renderNotifications();
			}).catch(showError);
		},

		messages: function () {
			refs.content.innerHTML = '<section class="sos-page">' + app.components.pageHeader("MissionMed Messages", "Messages", "Private conversations with your MissionMed mentors.") + app.components.loading("Loading messages...") + "</section>";
			loadCommunications();
		},

		cam: function () {
			var module = app.state.modules.filter(function (item) {
				return item && String(item.route || item.id || "") === "cam";
			})[0] || {};
			var launchUrl = safeCamLaunchUrl(module.launch_url || "");

			if (!hasModulePermission("cam") || !launchUrl) {
				refs.content.innerHTML = '<section class="sos-page">' + app.components.pageHeader("CAM Interview", "CAM unavailable", "CAM requires a current MissionMed 360 entitlement and an approved release target.") + app.components.empty("Access unavailable", "Return to Matrix and try again later.") + "</section>";
				return;
			}

			refs.content.innerHTML = [
				'<section class="sos-page">',
				app.components.pageHeader("Match Prep", "CAM Interview", "Practice and review your interview reps in the protected CAM workspace."),
				'<div class="sos-card sos-card-pad">',
				'<a class="sos-btn sos-btn-primary" href="' + escapeAttr(launchUrl) + '">Open CAM Interview</a>',
				"</div>",
				"</section>"
			].join("");
		},

		storyforge: function () {
			refs.content.innerHTML = [
				'<section class="sos-page">',
				app.components.pageHeader("StoryForge", "StoryForge", "StoryForge loads as a standalone Matrix Runtime v2 app."),
				app.components.empty("Runtime v2 required", "Refresh Matrix or ask support to confirm the Matrix runtime flag is enabled."),
				"</section>"
			].join("");
		},

		help: function () {
			var email = supportEmail();
			refs.content.innerHTML = [
				'<section class="sos-page">',
				app.components.pageHeader("Support", "Help", "Quick answers, advisor contact, and support routes."),
				'<div class="sos-grid sos-grid-two">',
				'<div class="sos-card sos-card-pad sos-help-card">',
				'<details open><summary>How do I know what to do next?</summary><p>Your Dashboard Current Focus card pulls from your live Hub task queue.</p></details>',
				'<details><summary>Where are my courses?</summary><p>Open My Match Training to continue the next available LearnDash lesson.</p></details>',
				'<details><summary>Can I upload documents?</summary><p>File Vault stores metadata now and uploads directly to private R2 storage when credentials are configured.</p></details>',
				"</div>",
				'<div class="sos-card sos-card-pad sos-contact-card">',
				'<div class="sos-panel-title">Advisor Contact</div>',
				'<h2 class="sos-panel-heading">Need a human hand?</h2>',
				'<p class="sos-panel-copy">Use the advisor email route for urgent program questions.</p>',
				'<a class="sos-btn sos-btn-primary sos-btn-block" href="mailto:' + escapeAttr(email) + '">Email Advisor</a>',
				'<div class="sos-ticket-box"><strong>Support Ticket</strong><span>Ticket intake is planned for a later Matrix support cycle.</span></div>',
				"</div>",
				"</div>",
				"</section>"
			].join("");
		},

		fileVault: function () {
			refs.content.innerHTML = '<section class="sos-page">' + app.components.pageHeader("Documents", "File Vault", "Private student file metadata with direct R2 upload wiring.") + app.components.loading("Loading file vault...") + "</section>";

			loadFileVaultData().then(function () {
				renderFileVault();
			}).catch(showError);
		},

		study: function () {
			refs.content.innerHTML = '<section class="sos-page">' + app.components.pageHeader("Learning", "Study Schedule", "Daily study blocks backed by the Matrix calendar event engine.") + app.components.loading("Loading study schedule...") + "</section>";
			loadStudy();
		},

		ranklist: function () {
			refs.content.innerHTML = '<section class="sos-page">' + app.components.pageHeader("Match Prep", "RankList IQ", "A live Matrix summary of your existing RankListIQ strategy board.") + app.components.loading("Loading RankListIQ...") + "</section>";

			app.api.get("/ranklist").then(function (data) {
				app.state.ranklist = data || { programs: [], counts: {}, match_probability: 0, supabase_connected: false };
				renderRanklist();
			}).catch(showError);
		},

		lor: function () {
			refs.content.innerHTML = '<section class="sos-page">' + app.components.pageHeader("Match Prep", "LOR Writer", "Track recommendation requests through the GhostWriter pipeline.") + app.components.loading("Loading LOR requests...") + "</section>";

			app.api.get("/lor").then(function (data) {
				app.state.lor = data || { requests: [], counts: {}, statuses: [] };
				renderLOR();
			}).catch(showError);
		},

		arena: function () {
			refs.content.innerHTML = '<section class="sos-page">' + app.components.pageHeader("Training", "Arena", "Live training stats from the standalone MissionMed Arena.") + app.components.loading("Loading Arena stats...") + "</section>";

			app.api.get("/arena/stats").then(function (data) {
				app.state.arena = data || { player: {}, recent_activity: {}, supabase_connected: false };
				renderArena();
			}).catch(showError);
		}
	};

		function overviewRequest(endpoint, params, key, applyPayload) {
			return app.api.get(endpoint, params).then(function (payload) {
				applyPayload(payload || {});
				return payload;
		}, function (error) {
			app.state.dashboardOverview.errors[key] = error && error.message ? error.message : "Unavailable";
				return null;
			});
		}

		var schedulerAuthState = {
			payload: null,
			promise: null
		};

		function schedulerOverviewRequest(endpoint, params, key, applyPayload) {
			return schedulerApiRequest(endpoint, { params: params }).then(function (payload) {
				applyPayload(payload || {});
				return payload;
			}, function (error) {
				app.state.dashboardOverview.errors[key] = error && error.message ? error.message : "Unavailable";
				return null;
			});
		}

		function schedulerApiRequest(endpoint, options) {
			options = options || {};
			return ensureSchedulerAuthSession().then(function () {
				return schedulerFetchOnce(endpoint, options);
			}).then(function (result) {
				if ((result.status === 401 || result.status === 403) && !options._retried) {
					schedulerAuthState.payload = null;
					schedulerAuthState.promise = null;
					return ensureSchedulerAuthSession().then(function () {
						return schedulerFetchOnce(endpoint, Object.assign({}, options, { _retried: true }));
					});
				}
				return result;
			}).then(function (result) {
				if (!result.ok) {
					throw new Error(schedulerPayloadMessage(result.payload) || "Scheduler feed unavailable");
				}
				return unwrapSchedulerPayload(result.payload);
			});
		}

		function schedulerFetchOnce(endpoint, options) {
			var headers = Object.assign({ Accept: "application/json" }, options.headers || {});
			var auth = schedulerAuthState.payload || {};
			var body = options.body;

			if (auth.csrfToken) {
				headers["x-mmhq-csrf"] = auth.csrfToken;
			}
			if (auth.accessToken) {
				headers.Authorization = "Bearer " + auth.accessToken;
			}
			if (body && !headers["Content-Type"]) {
				headers["Content-Type"] = "application/json";
			}

			return fetch(schedulerApiUrl(endpoint, options.params), {
				method: options.method || "GET",
				credentials: "same-origin",
				cache: "no-store",
				headers: headers,
				body: body ? JSON.stringify(body) : undefined
			}).then(function (resp) {
				return resp.json().catch(function () {
					return {};
				}).then(function (payload) {
					return { ok: resp.ok, status: resp.status, payload: payload };
				});
			});
		}

		function ensureSchedulerAuthSession() {
			if (schedulerAuthState.payload && schedulerAuthState.payload.authenticated && schedulerAuthState.payload.accessToken) {
				return Promise.resolve(schedulerAuthState.payload);
			}
			if (schedulerAuthState.promise) {
				return schedulerAuthState.promise;
			}

			schedulerAuthState.promise = fetchSchedulerAuthSession().then(function (payload) {
				if (payload && payload.authenticated) {
					return payload;
				}
				return exchangeSchedulerAuthSession(payload);
			}).then(function (payload) {
				if (!payload || !payload.authenticated || !payload.accessToken) {
					throw new Error("Scheduler authentication unavailable");
				}
				schedulerAuthState.payload = payload;
				schedulerAuthState.promise = null;
				return payload;
			}, function (error) {
				schedulerAuthState.payload = null;
				schedulerAuthState.promise = null;
				throw error;
			});

			return schedulerAuthState.promise;
		}

		function fetchSchedulerAuthSession() {
			return fetch("/api/auth/session?mm_scheduler_exchange=1&audience=scheduler", {
				method: "GET",
				credentials: "same-origin",
				cache: "no-store",
				headers: { Accept: "application/json" }
			}).then(function (resp) {
				return resp.json().catch(function () {
					return {};
				});
			});
		}

		function exchangeSchedulerAuthSession(previousPayload) {
			return fetch("/api/auth/exchange", {
				method: "POST",
				credentials: "same-origin",
				cache: "no-store",
				headers: {
					Accept: "application/json",
					"Content-Type": "application/json"
				},
				body: JSON.stringify({ audience: "scheduler" })
			}).then(function (resp) {
				return resp.json().catch(function () {
					return previousPayload || {};
				});
			});
		}

		function schedulerPayloadMessage(payload) {
			var data = payload && (payload.data || payload);
			return (data && (data.message || data.error)) || (payload && (payload.message || payload.error)) || "";
		}

		function schedulerApiUrl(endpoint, params) {
			var path = String(endpoint || "").charAt(0) === "/" ? endpoint : "/" + String(endpoint || "");
			var url = new URL("/api/scheduler" + path, window.location.origin);
			Object.keys(params || {}).forEach(function (key) {
				if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
					url.searchParams.set(key, params[key]);
				}
			});
			return url.toString();
		}

		function unwrapSchedulerPayload(payload) {
			var data = payload && (payload.data || payload);
			if (data && data.data && !Array.isArray(data.events)) {
				data = data.data;
			}
			return data || {};
		}

		function schedulerPayloadAppointments(payload) {
			var data = unwrapSchedulerPayload(payload);
			return data && Array.isArray(data.appointments) ? data.appointments : [];
		}

		function schedulerPayloadEvents(payload) {
			var data = unwrapSchedulerPayload(payload);
			return data && Array.isArray(data.events) ? data.events : [];
		}

		function normalizeSchedulerAppointment(row, eventIndex) {
			row = row || {};
			var id = row.id || row.appointment_id || row.appointmentId || "";
			var event = id && eventIndex ? eventIndex[id] : null;
			var meta = event && event.meta_json && typeof event.meta_json === "object" ? event.meta_json : {};
			var title = row.title || (event && event.title) || row.appointment_type_name || row.appointmentTypeName || (row.appointment_type && row.appointment_type.name) || "Scheduler appointment";
			var provider = row.provider_name || row.providerName || row.provider_display_name || row.providerDisplayName || (row.provider && (row.provider.display_name || row.provider.name)) || meta.provider_name || "Provider details unavailable";
			var startAt = row.start_at || row.startAt || row.start || "";
			var endAt = row.end_at || row.endAt || row.end || "";
			var status = row.status || "booked";
			var meetingUrl = row.meeting_url || row.join_url || row.joinUrl || row.webex_url || row.webexUrl || (event && (event.meeting_url || event.join_url)) || meta.meeting_url || meta.join_url || "";
			var rescheduleUrl = row.reschedule_url || row.rescheduleUrl || meta.reschedule_url || "";

			return {
				id: id,
				title: title,
				provider: provider,
				startAt: startAt,
				endAt: endAt,
				status: status,
				meetingUrl: meetingUrl,
				canCancel: canCancelSchedulerAppointment(row, id, status),
				canReschedule: !!(row.can_reschedule || row.canReschedule || meta.can_reschedule || rescheduleUrl),
				rescheduleUrl: rescheduleUrl
			};
		}

		function normalizeSchedulerAppointmentEvent(row) {
			var appt = normalizeSchedulerAppointment(row);
			return {
				id: "scheduler:" + (appt.id || appt.startAt || appt.title),
				source: "scheduler",
				source_id: appt.id,
				category: "my-appointments",
				event_type: "appointment",
				title: appt.title,
				start_at: appt.startAt,
				end_at: appt.endAt,
				meeting_url: appt.meetingUrl,
				provider_name: appt.provider,
				status: appt.status
			};
		}

		function canCancelSchedulerAppointment(row, id, status) {
			var normalized = String(status || "").toLowerCase();
			if (!id || normalized === "canceled" || normalized === "cancelled" || normalized === "complete" || normalized === "completed") {
				return false;
			}
			if (row.can_cancel === false || row.canCancel === false) {
				return false;
			}
			return true;
		}

		function renderDashboardOverview(stats) {
			var overview = app.state.dashboardOverview || {};
			var combinedEvents = mergeOverviewEvents(overview.events || [], overview.schedulerEvents || []);
			var events = nextSevenDayEvents(combinedEvents).slice(0, 4);
			var appointments = upcomingAppointments(combinedEvents, stats && stats.next_scheduler_appointment).slice(0, 3);
			var messages = recentMessages(overview.messages || []).slice(0, 3);
			var files = recentFiles(overview.files || []).slice(0, 3);
			var todos = activeTodos(overview.todos || []).slice(0, 4);
		var arenaBattles = incomingArenaBattles(overview.arenaBattles || []).slice(0, 3);

		return [
			'<section class="sos-dashboard-overview" aria-label="Matrix dashboard overview">',
			'<div class="sos-overview-topline">',
			'<span class="sos-panel-title">Matrix Overview</span>',
			overview.loading ? '<span class="sos-overview-sync">Checking live Matrix data...</span>' : "",
			"</div>",
				'<div class="sos-overview-grid">',
				dashboardOverviewWidget("Next 7 Days Schedule", events.map(eventOverviewItem), "No scheduled events in the next 7 days.", "#calendar", "Open App"),
				dashboardOverviewWidget("My Appointments", appointments.map(eventOverviewItem), "No upcoming appointments yet.", "#appointments", "Open My Appointments"),
				dashboardOverviewWidget("Latest Messages Inbox", messages.map(messageOverviewItem), "No recent messages.", "#messages", "Open App"),
				dashboardOverviewWidget("Recently Shared Files", files.map(fileOverviewItem), "No recently shared files.", "#filevault", "Open App"),
				dashboardOverviewWidget("Study Schedule locked", [], "Your guided study schedule will unlock after orientation.", "#study", "Open App", { locked: true }),
			dashboardOverviewWidget("Calendar To-Do List", todos.map(todoOverviewItem), "No active to-dos yet.", "#calendar", "Open App"),
			dashboardOverviewWidget("Incoming Arena Challenges", arenaBattles.map(arenaBattleOverviewItem), "No incoming challenges right now.", "#arena", "Open App"),
			"</div>",
			"</section>"
		].join("");
	}

	function dashboardOverviewWidget(title, items, emptyCopy, route, ctaText, options) {
		options = options || {};
		return [
			'<article class="sos-card sos-overview-card' + (options.locked ? " is-locked" : "") + '">',
			'<div class="sos-overview-card-head">',
			'<h2>' + escapeHTML(title) + "</h2>",
			options.locked ? '<span class="sos-overview-lock">Locked</span>' : "",
			"</div>",
			items.length ? '<div class="sos-overview-list">' + items.map(overviewListItem).join("") + "</div>" : '<p class="sos-overview-empty">' + escapeHTML(emptyCopy) + "</p>",
			route ? '<a class="sos-overview-cta" href="' + escapeAttr(route) + '">' + escapeHTML(ctaText || "Open App") + "</a>" : "",
			"</article>"
		].join("");
	}

	function overviewListItem(item) {
		return [
			'<div class="sos-overview-item">',
			'<strong>' + escapeHTML(item.title || "Matrix item") + "</strong>",
			item.meta ? '<span>' + escapeHTML(item.meta) + "</span>" : "",
			item.detail ? '<small>' + escapeHTML(item.detail) + "</small>" : "",
			"</div>"
		].join("");
	}

		function eventOverviewItem(event) {
			return {
				title: event.title || "Calendar event",
				meta: event.all_day || event.allDay ? "All day" : timeRange(event.start_at || event.start, event.end_at || event.end),
				detail: formatDateTime(event.start_at || event.start)
			};
		}

	function messageOverviewItem(message) {
		return {
			title: message.title || message.from || "Message",
			meta: message.from ? "From " + message.from : formatRelativeTime(message.timestamp || message.created_at),
			detail: message.message || message.preview || ""
		};
	}

	function fileOverviewItem(file) {
		return {
			title: file.title || file.name || file.filename || "Shared file",
			meta: file.category || file.status || "File Vault",
			detail: formatRelativeTime(file.updated_at || file.created_at || file.uploaded_at)
		};
	}

	function todoOverviewItem(todo) {
		return {
			title: todo.title || todo.name || "To-do",
			meta: todo.due_at || todo.due_date ? "Due " + formatDateTime(todo.due_at || todo.due_date) : (todo.status || "Open"),
			detail: todo.description || todo.notes || ""
		};
	}

	function arenaBattleOverviewItem(battle) {
		return {
			title: battle.title || battle.name || formatProgram(battle.battle_format || "Arena challenge"),
			meta: battle.event_date || battle.status || "Incoming",
			detail: battle.session_group_name || battle.description || ""
		};
	}

	function nextSevenDayEvents(events) {
		var now = new Date();
			var end = addDays(now, 7);
			return sortUpcoming(events).filter(function (event) {
				var start = new Date(event.start_at || event.start || event.date || "");
				return !Number.isNaN(start.getTime()) && start >= startOfDay(now) && start <= end;
			});
		}

	function upcomingAppointments(events, statAppointment) {
		var appointments = sortUpcoming(events).filter(isAppointmentEvent);
		if (!appointments.length && statAppointment) {
			appointments.push(statAppointment);
		}
		return appointments;
	}

	function recentMessages(messages) {
		return (messages || []).slice().sort(function (a, b) {
			return dateSortValue(b.timestamp || b.created_at) - dateSortValue(a.timestamp || a.created_at);
		});
	}

	function recentFiles(files) {
		return (files || []).slice().sort(function (a, b) {
			return dateSortValue(b.updated_at || b.created_at || b.uploaded_at) - dateSortValue(a.updated_at || a.created_at || a.uploaded_at);
		});
	}

	function activeTodos(todos) {
		return (todos || []).filter(function (todo) {
			var status = String(todo.status || "").toLowerCase();
			return todo.completed !== true && status !== "complete" && status !== "completed" && status !== "done";
		}).sort(function (a, b) {
			return dateSortValue(a.due_at || a.due_date) - dateSortValue(b.due_at || b.due_date);
		});
	}

	function incomingArenaBattles(battles) {
		return (battles || []).filter(function (battle) {
			var status = String(battle.status || "").toLowerCase();
			return status !== "ended" && status !== "complete" && status !== "completed";
		});
	}

		function sortUpcoming(events) {
			return (events || []).slice().sort(function (a, b) {
				return dateSortValue(a.start_at || a.start || a.date) - dateSortValue(b.start_at || b.start || b.date);
			});
		}

		function mergeOverviewEvents(events, schedulerEvents) {
			var output = [];
			var seen = {};
			(events || []).concat(schedulerEvents || []).forEach(function (event) {
				var key = overviewEventKey(event);
				if (key && seen[key]) {
					var index = seen[key] - 1;
					if (isAppointmentEvent(event)) {
						output[index] = event;
					}
					return;
				}
				output.push(event);
				if (key) {
					seen[key] = output.length;
				}
			});
			return output;
		}

		function overviewEventKey(event) {
			if (!event) {
				return "";
			}
			var source = String(event.source || "").toLowerCase();
			var sourceId = event.source_id || event.sourceId || "";
			if (source === "scheduler" && sourceId) {
				return "scheduler:" + sourceId;
			}
			if (source === "scheduler" && event.id) {
				return "scheduler-id:" + event.id;
			}
			return [
				event.title || "",
				event.start_at || event.start || event.date || "",
				event.end_at || event.end || ""
			].join("|").toLowerCase();
		}

	function isAppointmentEvent(event) {
		var haystack = [
			event.source,
			event.event_type,
			event.category,
			event.type,
			event.title
		].join(" ").toLowerCase();

		return haystack.indexOf("ssa") !== -1 ||
			haystack.indexOf("appointment") !== -1 ||
			haystack.indexOf("scheduler") !== -1 ||
			haystack.indexOf("meeting") !== -1 ||
			haystack.indexOf("1-on-1") !== -1 ||
			haystack.indexOf("one-on-one") !== -1;
	}

	function dateSortValue(value) {
		var date = new Date(value || "");
		return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime();
	}

	function startOfDay(value) {
		var date = new Date(value);
		date.setHours(0, 0, 0, 0);
		return date;
	}

	function mountNativeScheduler() {
		var target = "#mmed-scheduler-native-root";
		if (window.MMEDScheduler && typeof window.MMEDScheduler.mount === "function") {
			window.MMEDScheduler.mount(target, { apiBase: "/api/scheduler" });
			return;
		}

		document.addEventListener("mmed-scheduler-ready", function onSchedulerReady() {
			document.removeEventListener("mmed-scheduler-ready", onSchedulerReady);
			if (app.state.route === "scheduler" && window.MMEDScheduler && typeof window.MMEDScheduler.mount === "function") {
				window.MMEDScheduler.mount(target, { apiBase: "/api/scheduler" });
			}
		});
	}

	function loadMyAppointments(force) {
		var state = app.state.appointments;
		if (!state || (state.loading && !force)) {
			return Promise.resolve();
		}
		if (state.loaded && !force) {
			return Promise.resolve(state);
		}

		state.loading = true;
		state.error = "";

		return Promise.all([
			schedulerApiRequest("/my-appointments"),
			schedulerApiRequest("/my-appointment-history"),
			schedulerApiRequest("/calendar-feed", {
				params: {
					start: "2026-05-01T00:00:00",
					end: "2027-03-31T23:59:59"
				}
			}).catch(function () {
				return { events: [] };
			})
		]).then(function (results) {
			var eventIndex = schedulerAppointmentEventIndex(schedulerPayloadEvents(results[2]));
			state.upcoming = dedupeSchedulerAppointments(schedulerPayloadAppointments(results[0]).map(function (row) {
				return normalizeSchedulerAppointment(row, eventIndex);
			}));
			state.history = dedupeSchedulerAppointments(schedulerPayloadAppointments(results[1]).map(function (row) {
				return normalizeSchedulerAppointment(row, eventIndex);
			}));
			state.loaded = true;
			state.loading = false;
			return state;
		}, function (error) {
			state.loading = false;
			state.error = error && error.message ? error.message : "Appointments are unavailable right now.";
			return state;
		}).then(function (result) {
			if (app.state.route === "appointments") {
				app.render.appointments();
			}
			return result;
		});
	}

	function renderAppointmentSection(title, rows, emptyCopy, history) {
		rows = Array.isArray(rows) ? rows : [];
		return [
			'<section class="sos-card sos-card-pad sos-appointment-section">',
			'<div class="sos-panel-title">' + escapeHTML(title) + "</div>",
			rows.length ? rows.map(function (appointment) {
				return renderAppointmentCard(appointment, history);
			}).join("") : '<p class="sos-panel-copy">' + escapeHTML(emptyCopy) + "</p>",
			"</section>"
		].join("");
	}

	function renderAppointmentCard(appointment, history) {
		appointment = appointment || {};
		var busy = app.state.appointments && app.state.appointments.busyId === appointment.id;
		var date = appointment.startAt ? formatDateTime(appointment.startAt) : "Date pending";
		var time = appointment.startAt ? timeRange(appointment.startAt, appointment.endAt) : "Time pending";
		var join = appointment.meetingUrl ?
			'<a class="sos-btn sos-btn-primary" href="' + escapeAttr(appointment.meetingUrl) + '" target="_blank" rel="noopener" data-appointment-join>Join/Webex</a>' :
			'<button class="sos-btn" type="button" disabled>Join link pending</button>';
		var cancel = "";
		var reschedule = "";

		if (!history) {
			cancel = appointment.canCancel ?
				'<button class="sos-btn sos-btn-secondary" type="button" data-appointment-cancel="' + escapeAttr(appointment.id) + '"' + (busy ? " disabled" : "") + '>' + escapeHTML(busy ? "Canceling..." : "Cancel Appointment") + "</button>" :
				'<button class="sos-btn" type="button" disabled>Cancel unavailable</button>';

			reschedule = appointment.canReschedule && appointment.rescheduleUrl ?
				'<a class="sos-btn sos-btn-secondary" href="' + escapeAttr(appointment.rescheduleUrl) + '">Reschedule Appointment</a>' :
				'<span class="sos-panel-copy">Reschedule is not available in the current Scheduler runtime.</span>';
		}

		return [
			'<article class="sos-overview-item sos-appointment-card" data-appointment-id="' + escapeAttr(appointment.id || "") + '">',
			'<strong>' + escapeHTML(appointment.title || "Scheduler appointment") + "</strong>",
			'<span>Provider: ' + escapeHTML(appointment.provider || "MissionMed") + "</span>",
			'<span>Date: ' + escapeHTML(date) + "</span>",
			'<span>Time: ' + escapeHTML(time) + "</span>",
			'<small>Status: ' + escapeHTML(appointment.status || "booked") + "</small>",
			'<div class="sos-form-actions">',
			join,
			cancel,
			reschedule,
			"</div>",
			"</article>"
		].join("");
	}

	function bindAppointments() {
		if (!refs.content) {
			return;
		}

		refs.content.querySelectorAll("[data-appointment-cancel]").forEach(function (button) {
			button.addEventListener("click", function () {
				cancelMyAppointment(button.getAttribute("data-appointment-cancel") || "");
			});
		});
	}

	function cancelMyAppointment(appointmentId) {
		appointmentId = String(appointmentId || "").trim();
		if (!appointmentId || (app.state.appointments && app.state.appointments.busyId)) {
			return;
		}
		if (!window.confirm("Cancel this appointment?")) {
			return;
		}

		app.state.appointments.busyId = appointmentId;
		app.state.appointments.notice = "";
		if (app.state.route === "appointments") {
			app.render.appointments();
		}

		schedulerApiRequest("/cancel", {
			method: "POST",
			body: {
				appointment_id: appointmentId,
				idempotency_key: "student-cancel-" + Date.now() + "-" + Math.random().toString(16).slice(2),
				reason: "student_cancelled_from_my_appointments"
			}
		}).then(function (payload) {
			app.state.appointments.busyId = "";
			app.state.appointments.loaded = false;
			app.state.appointments.notice = (payload && payload.message) || "Appointment canceled.";
			app.state.dashboardOverview.loaded = false;
			app.state.dashboardOverview.schedulerEvents = [];
			return loadMyAppointments(true);
		}, function (error) {
			app.state.appointments.busyId = "";
			app.state.appointments.error = error && error.message ? error.message : "We could not cancel that appointment.";
			if (app.state.route === "appointments") {
				app.render.appointments();
			}
		});
	}

	function dedupeSchedulerAppointments(rows) {
		var seen = {};
		return (rows || []).filter(function (row) {
			var key = row.id || [row.title, row.provider, row.startAt, row.endAt].join("|");
			if (!key) {
				return true;
			}
			if (seen[key]) {
				return false;
			}
			seen[key] = true;
			return true;
		}).sort(function (a, b) {
			return dateSortValue(a.startAt) - dateSortValue(b.startAt);
		});
	}

	function schedulerAppointmentEventIndex(events) {
		var index = {};
		(events || []).forEach(function (event) {
			var meta = event && event.meta_json && typeof event.meta_json === "object" ? event.meta_json : {};
			var id = event && (event.source_id || event.sourceId || event.appointment_id || event.appointmentId || meta.appointment_id);
			if (id) {
				index[id] = event;
			}
		});
		return index;
	}

	function renderCourseShell() {
			var shell = app.state.courseShell || {};
			var courses = Array.isArray(shell.courses) ? shell.courses : [];
			var cards = shell.cards || {};
			var programs = Array.isArray(shell.canonical_programs) ? shell.canonical_programs : [];
			var season = shell.season || cards.current_phase || {};

			refs.content.innerHTML = [
				'<section class="sos-page sos-match-shell">',
					app.components.pageHeader("Learning", "My Match Training", "Your course path, weekly priorities, and Match season signals."),
				courseShellHero(shell, courses, programs, season),
				courseShellCardGrid(cards, courses, programs, season),
				courseShellCourseSection(courses),
				courseShellResources(cards.resources || []),
				"</section>"
			].join("");

			bindCourseShellEvents();
		}

		function renderCourseShellError(error) {
			refs.content.innerHTML = [
				'<section class="sos-page sos-match-shell">',
				app.components.pageHeader("Learning", "My Match Training", "Your course path, weekly priorities, and Match season signals."),
				'<div class="sos-card sos-card-pad sos-match-error">',
				'<div class="sos-panel-title">Course Path Unavailable</div>',
				'<h2 class="sos-panel-heading">We could not load your Match path.</h2>',
				'<p class="sos-panel-copy">' + escapeHTML(error && error.message ? error.message : "Please retry in a moment.") + "</p>",
				'<button class="sos-btn sos-btn-primary" type="button" data-course-shell-retry>Retry</button>',
				"</div>",
				"</section>"
			].join("");

			bindCourseShellEvents();
		}

		function courseShellHero(shell, courses, programs, season) {
			var primaryProgram = programs[0] || {};
			var access = shell.access || {};
			var programLabel = primaryProgram.label || (access.programs && access.programs[0]) || "MissionMed Match Path";
			var phaseLabel = season.label || "Application Prep";
			var progress = shell.cards && shell.cards.progress ? clampPercent(shell.cards.progress.average_progress) : 0;

			return [
				'<div class="sos-match-hero sos-card">',
				'<div class="sos-match-hero-main">',
				'<span class="sos-pill sos-pill-gold">' + escapeHTML(phaseLabel) + "</span>",
				'<h2>' + escapeHTML(programLabel) + "</h2>",
				'<p>' + escapeHTML(season.advisor_signal || "Your Matrix command center is connected to LearnDash course access and progress.") + "</p>",
				'<div class="sos-match-hero-actions">',
				'<a class="sos-btn sos-btn-primary" href="#scheduler">Upcoming Sessions</a>',
				'<a class="sos-btn sos-btn-secondary" href="#filevault">File Vault</a>',
				"</div>",
				"</div>",
				'<div class="sos-match-hero-meter">',
				'<strong>' + escapeHTML(progress + "%") + "</strong>",
				'<span>' + escapeHTML(courses.length + " active course" + (courses.length === 1 ? "" : "s")) + "</span>",
				'<div class="sos-chunky-progress"><div style="width:' + progress + '%"></div></div>',
				"</div>",
				"</div>"
			].join("");
		}

		function courseShellCardGrid(cards, courses, programs, season) {
			var continueCard = cards.continue_lesson || {};
			var progress = cards.progress || {};
			var fileUploads = cards.file_uploads || {};
			var advisor = cards.advisor_notes || {};
			var due = Array.isArray(cards.due_this_week) ? cards.due_this_week : [];
			var sessions = Array.isArray(cards.upcoming_sessions) ? cards.upcoming_sessions : [];
			var filesTotal = getNumber(fileUploads.total, 0);
			var filesPending = getNumber(fileUploads.pending_review, 0);
			var advisorDays = getNumber(advisor.days_to_due, 0);

			return [
				'<div class="sos-match-card-grid">',
				courseShellContinueCard(continueCard, courses),
				courseShellPhaseZeroCard(courses),
				courseShellMiniCard("Where You Are", season.label || "Application Prep", season.advisor_signal || "Your advisor will update your phase as your cycle progresses.", "#scheduler", "Review Calendar", "sos-match-card-phase"),
				courseShellMiniCard("This Week", due.length ? due.length + " task" + (due.length === 1 ? "" : "s") : "Nothing due", due.length ? due[0].title : "Nothing due this week. You're on track.", "#messages", "Open Tasks", "sos-match-card-week"),
				courseShellMiniCard("From Your Advisor", advisor.title || "No advisor note yet", advisorDays ? advisorDays + " day" + (advisorDays === 1 ? "" : "s") + " to due date" : "Your advisor's guidance will appear here. Focus on your current lesson.", advisor.route || "#messages", "Open Inbox", "sos-match-card-advisor"),
				courseShellMiniCard("Upcoming Sessions", sessions.length ? formatDateTime(sessions[0].start_at) : "None scheduled", sessions.length ? sessions[0].title : "No sessions scheduled yet. Your advisor will pin your next session.", "#scheduler", "Open Scheduler"),
				courseShellMiniCard("Required Documents", filesPending ? filesPending + " pending review" : filesTotal + " file" + (filesTotal === 1 ? "" : "s"), filesTotal ? "Uploads and reviewed documents stay in File Vault." : "No uploads required right now. Documents will appear here as your path progresses.", fileUploads.route || "#filevault", "Open Vault"),
				courseShellSessionInfoCard(),
				courseShellVaultInfoCard(),
				courseShellProgressCard(progress, courses),
				courseShellPathCard(programs, courses),
				"</div>"
			].join("");
		}

		function courseShellContinueCard(card, courses) {
			var state = card.state || "ready";
			var actionUrl = card.action_url || "#courses";
			var actionText = card.action_text || "Continue";
			var title = card.title || "Your path is being prepared";
			var copy = card.copy || (card.course ? "Continue inside " + card.course + "." : "Your path is being prepared. Check back soon.");
			var stepLabel = getLaunchStepLabel(card, courses);

			return [
				'<article class="sos-match-card sos-card sos-match-card-feature">',
				'<span class="sos-panel-title">Continue Your Path</span>',
				'<h3>' + escapeHTML(title) + "</h3>",
				stepLabel ? '<div class="sos-match-kicker">' + escapeHTML(stepLabel) + "</div>" : "",
				'<p>' + escapeHTML(copy) + "</p>",
				'<span class="sos-match-state">' + escapeHTML(formatProgram(state)) + "</span>",
				'<a class="sos-btn sos-btn-primary sos-btn-block" href="' + escapeAttr(actionUrl) + '">' + escapeHTML(actionText) + "</a>",
				"</article>"
			].join("");
		}

		function courseShellPhaseZeroCard(courses) {
			var course = getCourseById(courses, 3893) || {};
			var next = course.next_lesson || {};
			var hasStartHere = String(next.title || "").indexOf("Start Here") !== -1;

			return [
				'<article class="sos-match-card sos-card sos-match-card-phase-zero">',
				'<span class="sos-panel-title">Phase 0 Orientation</span>',
				'<h3>' + escapeHTML(hasStartHere ? "Start Here is your first step" : "Orientation opens your path") + "</h3>",
				'<div class="sos-match-kicker">Live orientation: Sunday, June 7</div>',
				'<p>Your 360 system opens from the Phase 0 orientation flow. Start with the welcome lesson, then use Matrix for your calendar, sessions, files, and advisor touchpoints.</p>',
				'<a class="sos-match-link" href="' + escapeAttr(course.url ? course.url + "?mmed_phase0=locked" : "/courses/mission-residency-360-match-mentorship/?mmed_phase0=locked") + '">View Phase 0</a>',
				"</article>"
			].join("");
		}

		function courseShellSessionInfoCard() {
			return [
				'<article class="sos-match-card sos-card sos-match-card-session-info">',
				'<span class="sos-panel-title">Sessions + Calendar</span>',
				"<h3>Find links on the event day</h3>",
				'<p>Your link for every session, class, meeting, or 1-on-1 appears on the calendar day for that event inside Matrix.</p>',
				'<a class="sos-match-link" href="#calendar">Open Calendar</a>',
				"</article>"
			].join("");
		}

		function courseShellVaultInfoCard() {
			return [
				'<article class="sos-match-card sos-card sos-match-card-vault-info">',
				'<span class="sos-panel-title">Files + Resources</span>',
				"<h3>Use File Vault for documents</h3>",
				'<p>Drafts, uploads, templates, and reviewed documents stay in File Vault when your advisor asks for a file or resource.</p>',
				'<a class="sos-match-link" href="#filevault">Open File Vault</a>',
				"</article>"
			].join("");
		}

		function courseShellMiniCard(label, value, copy, route, actionText, extraClass) {
			return [
				'<article class="sos-match-card sos-card' + (extraClass ? " " + escapeAttr(extraClass) : "") + '">',
				'<span class="sos-panel-title">' + escapeHTML(label) + "</span>",
				'<h3>' + escapeHTML(value || "Ready") + "</h3>",
				'<p>' + escapeHTML(copy || "") + "</p>",
				route ? '<a class="sos-match-link" href="' + escapeAttr(route) + '">' + escapeHTML(actionText || "Open") + "</a>" : "",
				"</article>"
			].join("");
		}

		function courseShellProgressCard(progress, courses) {
			var primaryCourse = getCourseById(courses, 3893) || courses[0] || {};
			var percent = clampPercent(primaryCourse.progress || progress.average_progress);
			var done = Math.min(getNumber(primaryCourse.lessons_completed, progress.lessons_completed), 65);
			var total = primaryCourse.id === 3893 ? 65 : getNumber(primaryCourse.lessons_total, progress.lessons_total);

			return [
				'<article class="sos-match-card sos-card">',
				'<span class="sos-panel-title">Your Progress</span>',
				'<h3>' + escapeHTML(percent + "% complete") + "</h3>",
				'<div class="sos-chunky-progress"><div style="width:' + percent + '%"></div></div>',
				'<p>' + escapeHTML(total ? done + " of " + total + " launch steps complete." : "You're just getting started. Complete your first lesson to begin tracking.") + "</p>",
				"</article>"
			].join("");
		}

		function courseShellPathCard(programs, courses) {
			var items = programs.length ? programs.map(function (program) {
				return '<li><strong>' + escapeHTML(program.label) + '</strong><span>Course ' + escapeHTML(program.course_id || "") + "</span></li>";
			}).join("") : courses.map(function (course) {
				return '<li><strong>' + escapeHTML(course.title || "Course") + '</strong><span>' + escapeHTML(formatProgram(course.status || "active")) + "</span></li>";
			}).join("");

			return [
				'<article class="sos-match-card sos-card">',
				'<span class="sos-panel-title">My Course Path</span>',
				items ? '<ul class="sos-match-list">' + items + "</ul>" : '<p>No active course access is connected to this account yet.</p>',
				"</article>"
			].join("");
		}

		function courseShellCourseSection(courses) {
			if (!courses.length) {
				return '<div class="sos-match-section">' + app.components.empty("No active course path", "Your MissionMed course path will appear here after access is connected.") + "</div>";
			}

			return [
				'<div class="sos-match-section">',
				'<div class="sos-section-heading"><span class="sos-panel-title">Full Path</span><h2>Course Path</h2></div>',
				'<div id="sos-course-detail-panel"></div>',
				'<div class="sos-course-grid">' + courses.map(courseCard).join("") + "</div>",
				"</div>"
			].join("");
		}

		function courseShellResources(resources) {
			resources = Array.isArray(resources) ? resources : [];
			if (!resources.length) {
				return "";
			}

			return [
				'<div class="sos-match-section">',
				'<div class="sos-section-heading"><span class="sos-panel-title">Resources</span><h2>Matrix Tools</h2></div>',
				'<div class="sos-resource-grid">' + resources.map(function (resource) {
					return [
						'<a class="sos-resource-card sos-card" href="' + escapeAttr(resource.route || "#") + '">',
						'<strong>' + escapeHTML(resource.label || "Resource") + "</strong>",
						'<span>' + escapeHTML(resource.copy || "") + "</span>",
						"</a>"
					].join("");
				}).join("") + "</div>",
				"</div>"
			].join("");
		}

		function courseCard(course) {
			var progress = clampPercent(course.progress);
			var next = course.next_lesson || {};
			var url = next.url || course.url || "#";
			var status = progress >= 100 ? "Review" : progress > 0 ? "Continue" : "Start";
			var glow = progress >= 100 ? " is-complete" : "";
			var lessonsTotal = getNumber(course.lessons_total, 0);
			var zeroStep = lessonsTotal === 0 && getNumber(course.quizzes_total, 0) === 0;
			var zeroCopy = zeroStepCourseCopy(course);

			return [
				'<article class="sos-course-card sos-card' + glow + '">',
				'<div class="sos-course-top">',
				'<span class="sos-pill">' + escapeHTML(formatProgram(course.status || "course")) + "</span>",
				'<strong>' + escapeHTML(progress + "%") + "</strong>",
				"</div>",
				'<h2>' + escapeHTML(course.title || "Untitled Course") + "</h2>",
				'<p>' + escapeHTML(zeroStep ? zeroCopy : course.instructor ? "Instructor: " + course.instructor : "MissionMed course") + "</p>",
				'<div class="sos-chunky-progress"><div style="width:' + progress + '%"></div></div>',
				'<div class="sos-course-meta">',
				'<span>' + escapeHTML(getNumber(course.lessons_completed, 0) + "/" + lessonsTotal + " lessons") + "</span>",
				'<span>' + escapeHTML(getNumber(course.quizzes_completed, 0) + "/" + getNumber(course.quizzes_total, 0) + " quizzes") + "</span>",
				"</div>",
				'<div class="sos-next-lesson">' + escapeHTML(next.title ? "Next: " + next.title : zeroStep ? "Course content coming soon" : progress >= 100 ? "Course completed" : "Ready to begin") + "</div>",
				'<div class="sos-course-actions">',
				'<button class="sos-btn sos-btn-secondary" type="button" data-course-shell-detail="' + escapeAttr(course.id || "") + '">View Path</button>',
				'<a class="sos-btn sos-btn-primary" href="' + escapeAttr(url) + '">' + escapeHTML(status) + "</a>",
				"</div>",
				"</article>"
			].join("");
		}

		function bindCourseShellEvents() {
			var retry = refs.content.querySelector("[data-course-shell-retry]");
			if (retry) {
				retry.addEventListener("click", function () {
					app.render.courses();
				});
			}

			refs.content.querySelectorAll("[data-course-shell-detail]").forEach(function (button) {
				button.addEventListener("click", function () {
					renderCourseDetail(button.getAttribute("data-course-shell-detail"));
				});
			});
		}

		function renderCourseDetail(courseId) {
			var panel = document.getElementById("sos-course-detail-panel");
			if (!panel || !courseId) {
				return;
			}

			panel.innerHTML = app.components.loading("Loading course path...");
			app.api.get("/course-shell/courses/" + encodeURIComponent(courseId), freshReadParams()).then(function (data) {
				var course = data && data.course ? data.course : {};
				panel.innerHTML = courseDetailMarkup(course);
			}).catch(function (error) {
				panel.innerHTML = [
					'<div class="sos-card sos-card-pad sos-match-error">',
					'<div class="sos-panel-title">Course Path</div>',
					'<h2 class="sos-panel-heading">This course could not be opened.</h2>',
					'<p class="sos-panel-copy">' + escapeHTML(error && error.message ? error.message : "Please retry in a moment.") + "</p>",
					"</div>"
				].join("");
			});
		}

		function courseDetailMarkup(course) {
			var outline = Array.isArray(course.outline) ? course.outline : [];
			var empty = course.empty_state || {};
			var progress = clampPercent(course.progress);

			return [
				'<article class="sos-card sos-card-pad sos-course-detail">',
				'<div class="sos-course-top">',
				'<span class="sos-pill">' + escapeHTML(formatProgram(course.status || "course")) + "</span>",
				'<strong>' + escapeHTML(progress + "%") + "</strong>",
				"</div>",
				'<h2 class="sos-panel-heading">' + escapeHTML(course.title || "Course Path") + "</h2>",
				'<div class="sos-chunky-progress"><div style="width:' + progress + '%"></div></div>',
				outline.length ? '<ol class="sos-outline-list">' + outline.map(courseOutlineItem).join("") + "</ol>" : '<div class="sos-empty-rich"><h3>' + escapeHTML(empty.title || "Path is ready") + '</h3><p>' + escapeHTML(empty.copy || zeroStepCourseCopy(course)) + "</p></div>",
				course.url ? '<a class="sos-btn sos-btn-secondary" href="' + escapeAttr(course.url) + '">View in Full Page Mode</a>' : "",
				"</article>"
			].join("");
		}

		function courseOutlineItem(item) {
			var complete = item.complete ? " is-complete" : "";
			return [
				'<li class="sos-outline-item' + complete + '">',
				'<span>' + escapeHTML(formatProgram(item.type || "step")) + "</span>",
				'<strong>' + escapeHTML(item.title || "Course step") + "</strong>",
				item.url ? '<a href="' + escapeAttr(item.url) + '">Open</a>' : "",
				"</li>"
			].join("");
		}

		function freshReadParams() {
			return { _mmed_read: String(Date.now()) };
		}

		function getCourseById(courses, id) {
			courses = Array.isArray(courses) ? courses : [];
			for (var i = 0; i < courses.length; i += 1) {
				if (parseInt(courses[i].id, 10) === parseInt(id, 10)) {
					return courses[i];
				}
			}
			return null;
		}

		function getLaunchStepLabel(card, courses) {
			var launchIds = [
				6183, 6184, 6185, 6186, 6187, 6188, 6189, 6190, 6191, 6192,
				6193, 6194, 6195, 6196, 6197, 6198, 6199, 6200, 6201, 6202,
				6203, 6204, 6205, 6206, 6207, 6208, 6209, 6210, 6211, 6212,
				6213, 6214, 6215, 6216, 6217, 6218, 6219, 6220, 6221, 6222,
				6223, 6224, 6225, 6226, 6227, 6228, 6229, 6230, 6231, 6232,
				6233, 6234, 6235, 6236, 6237, 6238, 6239, 6240, 6241, 6242,
				6243, 6244, 6245, 6246, 6247
			];
			var nextId = parseInt(card.course_id, 10) === 3893 && card.title ? findNextLessonIdByTitle(courses, 3893, card.title) : 0;
			var index;

			if (!nextId && card.action_url) {
				nextId = findLaunchIdByUrl(launchIds, card.action_url);
			}

			index = launchIds.indexOf(nextId);
			if (index >= 0) {
				return "Step " + (index + 1) + " of 65";
			}

			return parseInt(card.course_id, 10) === 3893 ? "Step 1 of 65" : "";
		}

		function findNextLessonIdByTitle(courses, courseId, title) {
			var course = getCourseById(courses, courseId);
			var next = course && course.next_lesson ? course.next_lesson : {};
			return next.title === title ? parseInt(next.id, 10) : 0;
		}

		function findLaunchIdByUrl(ids, url) {
			var id;
			for (var i = 0; i < ids.length; i += 1) {
				id = ids[i];
				if (String(url).indexOf("/lessons/") !== -1 && String(url).indexOf(String(id)) !== -1) {
					return id;
				}
			}
			return 0;
		}

		function zeroStepCourseCopy(course) {
			var title = String(course.title || "This program");
			if (parseInt(course.id, 10) === 5227 || title.indexOf("Match Prep Pro") !== -1) {
				return "Your Match Prep Pro program content is being built. While we prepare your path, your advisor tasks, sessions, file uploads, and resources are available below.";
			}
			if (parseInt(course.id, 10) === 3646 || title.indexOf("IV Prep Complete") !== -1) {
				return "Your IV Prep Complete Masterclass content is in development. Live sessions and practice resources are available now.";
			}
			return "This program is being prepared. Your advisor and session schedule are available. Course lessons will appear here when ready.";
		}

		function renderOrders() {
		var data = app.state.orders || {};
		var sub = data.subscription || {};
		var orders = Array.isArray(data.orders) ? data.orders : [];

		refs.content.innerHTML = [
			'<section class="sos-page">',
			app.components.pageHeader("Account", "Orders", "Your WooCommerce subscription and order history."),
			'<div class="sos-card sos-card-pad sos-sub-card">',
			'<div class="sos-panel-title">Subscription</div>',
			'<h2 class="sos-panel-heading">' + escapeHTML(sub.plan_name || "No active plan found") + "</h2>",
			'<div class="sos-badge-row">',
			'<span class="sos-pill sos-pill-status">' + escapeHTML(formatProgram(sub.status || "No subscription")) + "</span>",
			'<span class="sos-pill">Renewal: ' + escapeHTML(sub.renewal_date || "Not scheduled") + "</span>",
			'<span class="sos-pill">Auto renew: ' + escapeHTML(sub.auto_renew ? "Yes" : "No") + "</span>",
			"</div>",
			"</div>",
			orders.length ? renderOrderTable(orders) : app.components.empty("No orders found", "WooCommerce order history will appear here after purchases are attached to this account."),
			"</section>"
		].join("");
	}

	function renderOrderTable(orders) {
		return [
			'<div class="sos-card sos-table-card">',
			'<table class="sos-table"><thead><tr><th>Order</th><th>Date</th><th>Item</th><th>Status</th><th>Amount</th></tr></thead><tbody>',
			orders.map(function (order) {
				return [
					"<tr>",
					"<td>MM-" + escapeHTML(order.number || order.id) + "</td>",
					"<td>" + escapeHTML(order.date || "") + "</td>",
					"<td>" + escapeHTML(order.item || "MissionMed") + "</td>",
					"<td><span class=\"sos-pill\">" + escapeHTML(formatProgram(order.status || "")) + "</span></td>",
					"<td>" + escapeHTML(formatMoney(order.amount, order.currency)) + "</td>",
					"</tr>"
				].join("");
			}).join(""),
			"</tbody></table></div>"
		].join("");
	}

	function renderNotifications() {
		var items = app.state.notifications || [];
		refs.content.innerHTML = [
			'<section class="sos-page">',
			app.components.pageHeader("Account", "Notifications", "Task, event, and system activity from live MissionMed data."),
			items.length ? '<div class="sos-feed">' + items.map(feedItem).join("") + "</div>" : app.components.empty("All caught up", "No notifications need your attention right now."),
			"</section>"
		].join("");
	}

	function loadCommunications() {
		var state = getCommState();
		state.loading = true;
		state.error = "";
		state.notice = "";

		if (!hasAdminCommunicationsContext()) {
			loadStudentCommunications();
			return;
		}

		app.api.get("/communications/admin/conversations", { mentor_key: state.mentorFilter || "" }).then(function (data) {
			state.mode = "admin";
			state.loading = false;
			state.conversations = data && Array.isArray(data.conversations) ? data.conversations : [];
			state.mentors = data && Array.isArray(data.mentors) ? data.mentors : state.mentors;
			if (!state.selectedId && state.conversations.length) {
				openCommunication(state.conversations[0].id);
				return;
			}
			renderCommunications();
		}).catch(function () {
			loadStudentCommunications();
		});
	}

	function hasAdminCommunicationsContext() {
		var adminBar = document.getElementById("wpadminbar");
		if (!adminBar) {
			return false;
		}

		return !!adminBar.querySelector("#wp-admin-bar-new-content, #wp-admin-bar-customize, #wp-admin-bar-edit, #wp-admin-bar-wpcode-admin-bar-info");
	}

	function loadStudentCommunications() {
		var state = getCommState();
		app.api.get("/communications/student/conversations").then(function (data) {
			state.mode = "student";
			state.loading = false;
			state.conversations = data && Array.isArray(data.conversations) ? data.conversations : [];
			state.mentors = data && Array.isArray(data.mentors) ? data.mentors : state.mentors;
			if (!state.selectedId && state.conversations.length) {
				openCommunication(state.conversations[0].id);
				return;
			}
			renderCommunications();
		}).catch(function (error) {
			state.loading = false;
			state.error = error && error.message ? error.message : "Messages could not be loaded.";
			renderCommunications();
		});
	}

	function getCommState() {
		if (!app.state.communications) {
			app.state.communications = {
				mode: "student",
				loading: false,
				mentors: [
					{ key: "dr_brian", label: "Dr. Brian" },
					{ key: "dr_j", label: "Dr. J" }
				],
				conversations: [],
				selectedId: null,
				selected: null,
				messages: [],
				searchResults: [],
				selectedStudents: [],
				adminComposerOpen: false,
				videoModalOpen: false,
				openRequestToken: 0,
				threadLoadingId: null,
				mentorFilter: "",
				composeMentor: "dr_brian",
				notice: "",
				error: ""
			};
		}

		return app.state.communications;
	}

	function renderCommunications() {
		var state = getCommState();
		var title = state.mode === "admin" ? "Communications" : "MissionMed Messages";
		var subtitle = state.mode === "admin" ? "Send private mentor messages and review student replies." : "Message Dr. Brian or Dr. J and keep every thread in one place.";

		refs.content.innerHTML = [
			'<section class="sos-page sos-comm-page msg-page">',
			app.components.pageHeader("MissionMed Messages", title, subtitle),
			state.notice ? '<div class="sos-comm-alert msg-alert is-success">' + escapeHTML(state.notice) + "</div>" : "",
			state.error ? '<div class="sos-comm-alert msg-alert is-error">' + escapeHTML(state.error) + "</div>" : "",
			state.loading ? app.components.loading("Loading messages...") : [
				'<div class="sos-comm-shell msg-shell">',
				'<aside class="sos-comm-sidebar msg-sidebar">',
				state.mode === "admin" ? "" : renderStudentComposer(state),
				renderConversationList(state),
				"</aside>",
				'<main class="sos-comm-thread msg-chat">',
				state.selected ? renderConversationTimeline(state) : renderNoConversation(state),
				"</main>",
				"</div>",
				state.mode === "admin" && state.adminComposerOpen ? renderAdminComposer(state) : "",
				state.videoModalOpen && state.selectedId ? renderVideoRecorderModal(state) : ""
			].join(""),
			"</section>"
		].join("");

		bindCommunications();
	}

	function renderAdminComposer(state) {
		return [
			'<div class="msg-admin-compose-layer" role="presentation">',
			'<button class="msg-modal-backdrop" type="button" data-comm-close-admin-composer aria-label="Close new message"></button>',
			'<div class="sos-comm-panel msg-compose-panel msg-admin-compose-modal" role="dialog" aria-modal="true" aria-labelledby="msg-admin-compose-title">',
			'<button class="msg-modal-close" type="button" data-comm-close-admin-composer aria-label="Close new message">&times;</button>',
			'<div id="msg-admin-compose-title" class="sos-comm-panel-title msg-panel-kicker">New Admin Message</div>',
			'<label class="sos-comm-label msg-field-label">Mentor context' + mentorSelect("sos-comm-admin-mentor", state.composeMentor, state.mentors) + "</label>",
			'<label class="sos-comm-label msg-field-label">Find students</label>',
			'<div class="sos-comm-search-row msg-search-row">',
			'<input id="sos-comm-student-search" class="sos-comm-input" type="search" placeholder="Search name or email">',
			'<button class="sos-btn sos-btn-primary" type="button" data-comm-search>Search</button>',
			"</div>",
			'<div class="sos-comm-student-results msg-student-results">',
			(state.searchResults || []).map(function (student) {
				var checked = selectedStudentIds(state).indexOf(getNumber(student.id, 0)) !== -1 ? " checked" : "";
				return [
					'<label class="sos-comm-student-row msg-student-row">',
					'<input type="checkbox" data-comm-student="' + escapeAttr(student.id) + '"' + checked + '>',
					'<span class="msg-student-avatar">' + escapeHTML(initials(student.display_name || "Student")) + "</span>",
					'<span><strong>' + escapeHTML(student.display_name || "Student") + '</strong><small>' + escapeHTML(student.email || "") + "</small></span>",
					"</label>"
				].join("");
			}).join(""),
			"</div>",
			state.selectedStudents.length ? '<div class="sos-comm-selected msg-selected">' + state.selectedStudents.map(function (student) {
				return '<span class="sos-pill">' + escapeHTML(student.display_name || "Student") + "</span>";
			}).join("") + "</div>" : '<div class="sos-comm-help msg-help">Select one or more students. Group sends create private 1:1 threads.</div>',
			'<form class="msg-compose-form" data-comm-admin-send>',
			'<textarea class="sos-comm-textarea" name="body" placeholder="Write a private message..." required></textarea>',
			renderComposerTools("admin"),
			'<button class="sos-btn sos-btn-primary sos-btn-block" type="submit">Send Message</button>',
			"</form>",
			renderSmsPanel(),
			"</div>",
			"</div>"
		].join("");
	}

	function renderStudentComposer(state) {
		return [
			'<div class="sos-comm-panel msg-compose-panel">',
			'<div class="sos-comm-panel-title msg-panel-kicker">New Message</div>',
			'<form class="msg-compose-form" data-comm-student-start>',
			'<label class="sos-comm-label msg-field-label">Send to' + mentorSelect("sos-comm-student-mentor", state.composeMentor, state.mentors) + "</label>",
			'<textarea class="sos-comm-textarea" name="body" placeholder="Write to your mentor..." required></textarea>',
			renderComposerTools("student"),
			'<button class="sos-btn sos-btn-primary sos-btn-block" type="submit">Start Thread</button>',
			"</form>",
			renderSmsPanel(),
			"</div>"
		].join("");
	}

	function renderComposerTools(scope) {
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
			'<strong>Attachment preview</strong>',
			'<p>Select a file to preview. Private storage is pending.</p>',
			'<input type="file" data-comm-attachment-input hidden>',
			'<small data-comm-attachment-status>No file selected.</small>',
			"</div>",
			"</div>"
		].join("");
	}

	function renderVideoRecorderModal() {
		return [
			'<div class="msg-video-modal-layer" data-comm-video-modal-layer role="presentation">',
			'<button class="msg-modal-backdrop" type="button" data-comm-video-close aria-label="Close video recorder"></button>',
			'<div class="msg-demo-panel msg-video-panel is-open" data-comm-video-panel role="dialog" aria-modal="true" aria-labelledby="msg-video-title">',
			'<button class="msg-video-close" type="button" data-comm-video-close aria-label="Close video recorder">&times;</button>',
			'<button class="msg-video-cancel" type="button" data-comm-video-close>Cancel</button>',
			'<div class="msg-video-head">',
			'<strong id="msg-video-title">Send a video message</strong>',
			'<p>Click Start Recording. You will get a 3, 2, 1, ACTION countdown, a live recording HUD, then a preview before anything is sent.</p>',
			"</div>",
			'<div class="msg-video-steps">',
			'<span><b>1</b> Record</span>',
			'<span><b>2</b> Preview</span>',
			'<span><b>3</b> Approve and send</span>',
			"</div>",
			'<div class="msg-demo-actions msg-video-actions">',
			'<button class="msg-video-record-action" type="button" data-comm-video-record>Start Recording</button>',
			'<button class="msg-video-stop-action" type="button" data-comm-video-stop disabled>Stop Recording</button>',
			'<button class="msg-video-rerecord-action" type="button" data-comm-video-rerecord disabled>Re-record</button>',
			"</div>",
			'<div class="msg-video-stage">',
			'<video data-comm-video-preview playsinline muted controls></video>',
			'<div class="msg-video-countdown" data-comm-video-countdown aria-live="assertive"></div>',
			'<div class="msg-video-hud" data-comm-video-hud><span></span><strong>RECORDING</strong><em data-comm-video-timer>00:00</em></div>',
			"</div>",
			'<div class="msg-video-processing" data-comm-video-processing aria-hidden="true">',
			'<span>Processing preview</span>',
			'<div><i data-comm-video-progress></i></div>',
			"</div>",
			'<input class="msg-video-caption" type="text" data-comm-video-caption placeholder="Optional video caption">',
			'<button class="msg-video-send" type="button" data-comm-video-send disabled>Approve &amp; Send Video</button>',
			'<small data-comm-video-status>Camera opens only after the countdown.</small>',
			"</div>",
			"</div>"
		].join("");
	}

	function renderSmsPanel() {
		return [
			'<div class="msg-sms-panel">',
			'<strong>SMS alerts pending</strong>',
			'<span>Production path: opt-in, STOP handling, and inbound replies.</span>',
			"</div>"
		].join("");
	}

	function renderConversationList(state) {
		var conversations = state.conversations || [];
		return [
			'<div class="sos-comm-panel sos-comm-list-panel msg-list-panel">',
			'<div class="sos-comm-list-head msg-list-head">',
			'<div class="msg-list-title-row">',
			'<div class="sos-comm-panel-title msg-panel-kicker">Chats</div>',
			state.mode === "admin" ? '<button class="msg-new-thread-btn" type="button" data-comm-open-admin-composer>New Message</button>' : "",
			"</div>",
			state.mode === "admin" ? mentorFilter(state) : "",
			"</div>",
			conversations.length ? '<div class="sos-comm-list msg-thread-list">' + conversations.map(function (conversation) {
				var active = getNumber(conversation.id, 0) === getNumber(state.selectedId, 0) ? " is-active" : "";
				var unread = getNumber(conversation.unread_count, 0);
				var person = state.mode === "admin" ? (conversation.student && conversation.student.display_name) || "Student" : conversation.mentor_label || "Mentor";
				var preview = conversation.last_message_preview || "No messages yet";
				return [
					'<button class="sos-comm-thread-btn msg-thread-btn' + active + '" type="button" data-comm-conversation="' + escapeAttr(conversation.id) + '">',
					'<span class="msg-avatar">' + escapeHTML(initials(person)) + "</span>",
					'<span class="msg-thread-copy">',
					'<span class="sos-comm-thread-top msg-thread-top"><strong>' + escapeHTML(person) + '</strong>' + (unread ? '<em>' + escapeHTML(unread) + "</em>" : "") + "</span>",
					'<span class="sos-comm-thread-preview msg-thread-preview">' + escapeHTML(preview) + "</span>",
					'<span class="sos-comm-thread-meta msg-thread-meta">' + escapeHTML(conversation.mentor_label || "MissionMed") + " · " + escapeHTML(formatRelativeTime(conversation.last_message_at || conversation.updated_at)) + "</span>",
					readReceiptBadge(conversation.latest_outbound_read),
					"</span>",
					"</button>"
				].join("");
			}).join("") + "</div>" : app.components.empty("No threads yet", state.mode === "admin" ? "Send a message to create a private student thread." : "Start a message to Dr. Brian or Dr. J."),
			"</div>"
		].join("");
	}

	function renderNoConversation(state) {
		return [
			'<div class="sos-card sos-card-pad sos-comm-empty-thread msg-empty-thread">',
			'<div class="sos-panel-title">' + escapeHTML(state.mode === "admin" ? "Select a student thread" : "Select a conversation") + "</div>",
			'<h2 class="sos-panel-heading">Chat will appear here</h2>',
			'<p class="sos-panel-copy">Open a thread to see messages, replies, and read receipts.</p>',
			"</div>"
		].join("");
	}

	function renderConversationTimeline(state) {
		var selected = state.selected || {};
		var messages = state.messages || [];
		var loadingThread = getNumber(state.threadLoadingId, 0) === getNumber(state.selectedId, 0);
		var heading = state.mode === "admin" ? ((selected.student && selected.student.display_name) || "Student") : (selected.mentor_label || "MissionMed Mentor");

		return [
			'<div class="sos-comm-thread-card sos-card msg-chat-card">',
			'<div class="sos-comm-thread-header msg-chat-header">',
			'<div class="msg-avatar msg-avatar-large">' + escapeHTML(initials(heading)) + "</div>",
			"<div>",
			'<div class="sos-panel-title">' + escapeHTML(selected.mentor_label || "MissionMed") + "</div>",
			'<h2 class="sos-panel-heading">' + escapeHTML(heading) + "</h2>",
			"</div>",
			'<span class="sos-pill msg-count-pill">' + escapeHTML(getNumber(messages.length, 0) + " message" + (messages.length === 1 ? "" : "s")) + "</span>",
			"</div>",
			'<div class="sos-comm-timeline msg-chat-history">',
			loadingThread ? app.components.loading("Loading thread...") : messages.length ? messages.map(messageBubble).join("") : app.components.empty("No messages yet", "Send the first message in this private thread."),
			"</div>",
			'<form class="sos-comm-reply msg-reply-form" data-comm-reply>',
			'<textarea class="sos-comm-textarea" name="body" placeholder="Reply..." required></textarea>',
			renderComposerTools("reply"),
			'<button class="sos-btn sos-btn-primary msg-send-btn" type="submit">Send</button>',
			"</form>",
			"</div>"
		].join("");
	}

	function messageBubble(message) {
		var mine = message.is_mine ? " is-mine" : "";
		var readLabel = message.is_mine ? messageReadLabel(message) : (message.read_at ? "Read " + formatMessageTime(message.read_at) : "Unread");
		var senderName = messageSenderName(message);
		return [
			'<article class="sos-comm-bubble msg-bubble' + mine + '">',
			'<div class="sos-comm-bubble-meta msg-bubble-meta">',
			'<strong>' + escapeHTML(senderName) + "</strong>",
			'<span>' + escapeHTML(formatMessageTime(message.created_at)) + "</span>",
			"</div>",
			'<p>' + escapeHTML(message.body || "") + "</p>",
			renderMessageAttachments(message),
			renderAdminReadControl(message),
			'<div class="sos-comm-read msg-read">' + escapeHTML(readLabel) + "</div>",
			"</article>"
		].join("");
	}

	function messageSenderName(message) {
		var state = getCommState();
		var selected = state.selected || {};
		var role = String(message.sender_role || "").toLowerCase();
		if ((role === "admin" || role === "mentor") && selected.mentor_label) {
			return selected.mentor_label;
		}
		return message.sender_name || formatProgram(role || "Mentor");
	}

	function renderAdminReadControl(message) {
		var state = getCommState();
		if (state.mode !== "admin" || message.is_mine || message.sender_role !== "student") {
			return "";
		}

		if (message.read_at) {
			return '<div class="msg-admin-read-control is-shared"><span>&#10003;</span> Student can see you read this at ' + escapeHTML(formatMessageTime(message.read_at)) + "</div>";
		}

		return [
			'<label class="msg-admin-read-control">',
			'<input type="checkbox" data-comm-mark-message-read="' + escapeAttr(message.id) + '">',
			'<span>Show student I read this message</span>',
			"</label>"
		].join("");
	}

	function renderMessageAttachments(message) {
		var attachments = Array.isArray(message.attachments) ? message.attachments : [];
		if (!attachments.length) {
			return "";
		}

		return '<div class="msg-attachments">' + attachments.map(function (attachment) {
			if (attachment.type === "video") {
				return [
					'<figure class="msg-video-attachment">',
					'<video class="msg-video-player" controls playsinline preload="metadata" src="' + escapeAttr(attachment.stream_url || "") + '"></video>',
					'<figcaption>',
					'<span>' + escapeHTML(attachment.original_name || "Video message") + "</span>",
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

	function bindCommunications() {
		var state = getCommState();
		var searchButton = refs.content.querySelector("[data-comm-search]");
		var searchInput = refs.content.querySelector("#sos-comm-student-search");
		var adminMentor = refs.content.querySelector("#sos-comm-admin-mentor");
		var studentMentor = refs.content.querySelector("#sos-comm-student-mentor");
		var mentorFilterInput = refs.content.querySelector("#sos-comm-mentor-filter");
		var adminSend = refs.content.querySelector("[data-comm-admin-send]");
		var studentStart = refs.content.querySelector("[data-comm-student-start]");
		var replyForm = refs.content.querySelector("[data-comm-reply]");
		var openAdminComposer = refs.content.querySelector("[data-comm-open-admin-composer]");

		if (openAdminComposer) {
			openAdminComposer.addEventListener("click", function () {
				state.adminComposerOpen = true;
				state.error = "";
				state.notice = "";
				renderCommunications();
			});
		}

		refs.content.querySelectorAll("[data-comm-close-admin-composer]").forEach(function (button) {
			button.addEventListener("click", function () {
				state.adminComposerOpen = false;
				renderCommunications();
			});
		});

		if (searchButton && searchInput) {
			searchButton.addEventListener("click", function () {
				searchAdminStudents(searchInput.value);
			});
			searchInput.addEventListener("keydown", function (event) {
				if (event.key === "Enter") {
					event.preventDefault();
					searchAdminStudents(searchInput.value);
				}
			});
		}

		if (adminMentor) {
			adminMentor.addEventListener("change", function () {
				state.composeMentor = adminMentor.value;
			});
		}

		if (studentMentor) {
			studentMentor.addEventListener("change", function () {
				state.composeMentor = studentMentor.value;
			});
		}

		if (mentorFilterInput) {
			mentorFilterInput.addEventListener("change", function () {
				state.mentorFilter = mentorFilterInput.value;
				loadAdminConversations();
			});
		}

		refs.content.querySelectorAll("[data-comm-student]").forEach(function (input) {
			input.addEventListener("change", function () {
				toggleSelectedStudent(input.getAttribute("data-comm-student"), input.checked);
				renderCommunications();
			});
		});

		refs.content.querySelectorAll("[data-comm-conversation]").forEach(function (button) {
			button.addEventListener("click", function () {
				openCommunication(button.getAttribute("data-comm-conversation"));
			});
		});

		if (adminSend) {
			adminSend.addEventListener("submit", function (event) {
				event.preventDefault();
				sendAdminCommunication(adminSend);
			});
		}

		if (studentStart) {
			studentStart.addEventListener("submit", function (event) {
				event.preventDefault();
				startStudentCommunication(studentStart);
			});
		}

		if (replyForm) {
			replyForm.addEventListener("submit", function (event) {
				event.preventDefault();
				replyCommunication(replyForm);
			});
		}

		bindComposerEnhancements();
	}

	function bindComposerEnhancements() {
		var state = getCommState();

		refs.content.querySelectorAll(".sos-comm-textarea").forEach(function (textarea) {
			textarea.addEventListener("focus", function () {
				refs.content.__commActiveTextarea = textarea;
			});

			textarea.addEventListener("keydown", function (event) {
				var form = textarea.closest("form");
				if (event.key === "Enter" && !event.shiftKey && form) {
					event.preventDefault();
					if (form.requestSubmit) {
						form.requestSubmit();
					} else {
						form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
					}
				}
			});
		});

		refs.content.querySelectorAll("[data-comm-emoji-toggle]").forEach(function (button) {
			button.addEventListener("click", function (event) {
				event.preventDefault();
				event.stopPropagation();
				var tools = button.closest("[data-comm-toolbox]");
				var picker = tools ? tools.querySelector("[data-comm-emoji-picker]") : null;
				refs.content.querySelectorAll("[data-comm-emoji-picker]").forEach(function (panel) {
					if (panel !== picker) panel.classList.remove("is-open");
				});
				if (picker) picker.classList.toggle("is-open");
			});
		});

		refs.content.querySelectorAll("[data-comm-emoji]").forEach(function (button) {
			button.addEventListener("click", function (event) {
				event.preventDefault();
				event.stopPropagation();
				var textarea = composerTextarea(button);
				if (!textarea) return;
				insertAtCursor(textarea, emojiButtonValue(button));
				var picker = button.closest("[data-comm-emoji-picker]");
				if (picker) picker.classList.remove("is-open");
			});
		});

		refs.content.querySelectorAll("[data-comm-video-toggle]").forEach(function (button) {
			button.addEventListener("click", function () {
				state.videoModalOpen = true;
				state.error = "";
				state.notice = "";
				renderCommunications();
			});
		});

		refs.content.querySelectorAll("[data-comm-video-record]").forEach(function (button) {
			button.addEventListener("click", function () {
				startVideoPreview(button);
			});
		});

		refs.content.querySelectorAll("[data-comm-video-stop]").forEach(function (button) {
			button.addEventListener("click", function () {
				stopVideoPreview(button);
			});
		});

		refs.content.querySelectorAll("[data-comm-video-rerecord]").forEach(function (button) {
			button.addEventListener("click", function () {
				rerecordVideoPreview(button);
			});
		});

		refs.content.querySelectorAll("[data-comm-video-send]").forEach(function (button) {
			button.addEventListener("click", function () {
				sendVideoCommunication(button);
			});
		});

		refs.content.querySelectorAll("[data-comm-video-close]").forEach(function (button) {
			button.addEventListener("click", function () {
				closeVideoModal(button.closest("[data-comm-video-modal-layer]"));
			});
		});

		refs.content.querySelectorAll("[data-comm-mark-message-read]").forEach(function (input) {
			input.addEventListener("change", function () {
				if (input.checked) {
					markAdminMessageRead(input);
				}
			});
		});

		refs.content.querySelectorAll("[data-comm-save-vault]").forEach(function (button) {
			button.addEventListener("click", function () {
				saveCommunicationAttachmentToVault(button);
			});
		});

		refs.content.querySelectorAll("[data-comm-attachment-toggle]").forEach(function (button) {
			button.addEventListener("click", function () {
				var panel = composerPanel(button, "[data-comm-attachment-panel]");
				var input = panel ? panel.querySelector("[data-comm-attachment-input]") : null;
				if (panel) panel.classList.add("is-open");
				if (input) input.click();
			});
		});

		refs.content.querySelectorAll("[data-comm-attachment-input]").forEach(function (input) {
			input.addEventListener("change", function () {
				var file = input.files && input.files[0];
				var status = input.closest("[data-comm-attachment-panel]").querySelector("[data-comm-attachment-status]");
				if (status) {
					status.textContent = file ? file.name + " selected for demo preview. Secure upload is pending." : "No file selected.";
				}
			});
		});
	}

	function composerTextarea(node) {
		var tools = node ? node.closest("[data-comm-toolbox]") : null;
		var form = tools ? tools.closest("form") : node ? node.closest("form") : null;
		if (form) {
			return form.querySelector(".sos-comm-textarea, textarea");
		}
		if (refs.content && refs.content.__commActiveTextarea && refs.content.contains(refs.content.__commActiveTextarea)) {
			return refs.content.__commActiveTextarea;
		}
		return refs.content ? refs.content.querySelector(".msg-reply-form textarea, .msg-compose-form textarea") : null;
	}

	function emojiButtonValue(button) {
		var value = button ? (button.getAttribute("data-comm-emoji-value") || button.textContent || button.innerText || "") : "";
		var decoder = document.createElement("textarea");
		decoder.innerHTML = value;
		return decoder.value || value;
	}

	function composerPanel(node, selector) {
		var tools = node ? node.closest("[data-comm-toolbox]") : null;
		return tools ? tools.querySelector(selector) : null;
	}

	function insertAtCursor(textarea, value) {
		var start = typeof textarea.selectionStart === "number" ? textarea.selectionStart : textarea.value.length;
		var end = typeof textarea.selectionEnd === "number" ? textarea.selectionEnd : textarea.value.length;
		textarea.value = textarea.value.slice(0, start) + value + textarea.value.slice(end);
		textarea.focus();
		textarea.selectionStart = textarea.selectionEnd = start + value.length;
		textarea.dispatchEvent(new Event("input", { bubbles: true }));
	}

	function startVideoPreview(button) {
		var panel = button.closest("[data-comm-video-panel]");
		var video = panel ? panel.querySelector("[data-comm-video-preview]") : null;
		var status = panel ? panel.querySelector("[data-comm-video-status]") : null;
		if (!video || !status) return;
		if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
			status.textContent = "Video preview is not supported in this browser.";
			return;
		}

		if (panel._commCountdownActive) return;

		runVideoCountdown(panel, function () {
			beginVideoCapture(button);
		});
	}

	function runVideoCountdown(panel, done) {
		var countdown = panel ? panel.querySelector("[data-comm-video-countdown]") : null;
		var status = panel ? panel.querySelector("[data-comm-video-status]") : null;
		var recordButton = panel ? panel.querySelector("[data-comm-video-record]") : null;
		var stopButton = panel ? panel.querySelector("[data-comm-video-stop]") : null;
		var sendButton = panel ? panel.querySelector("[data-comm-video-send]") : null;
		var rerecordButton = panel ? panel.querySelector("[data-comm-video-rerecord]") : null;
		var steps = ["3", "2", "1", "ACTION"];
		var index = 0;

		if (!panel || !countdown) return;

		panel._commCountdownActive = true;
		panel.classList.add("is-counting");
		panel.classList.remove("is-recording", "is-preview-ready");
		if (recordButton) recordButton.disabled = true;
		if (stopButton) stopButton.disabled = true;
		if (sendButton) sendButton.disabled = true;
		if (rerecordButton) rerecordButton.disabled = true;
		if (status) status.textContent = "Get ready. Recording starts after ACTION.";

		function tick() {
			if (index >= steps.length) {
				panel._commCountdownActive = false;
				panel.classList.remove("is-counting");
				countdown.textContent = "";
				if (typeof done === "function") done();
				return;
			}

			var label = steps[index];
			countdown.textContent = label || "";
			countdown.classList.remove("is-pop");
			countdown.offsetWidth;
			countdown.classList.add("is-pop");
			playVideoCue(label === "ACTION");
			index += 1;
			window.setTimeout(tick, label === "ACTION" ? 520 : 780);
		}

		tick();
	}

	function playVideoCue(action) {
		try {
			var AudioContext = window.AudioContext || window.webkitAudioContext;
			if (!AudioContext) return;
			var ctx = window._mmedCommAudioContext || new AudioContext();
			window._mmedCommAudioContext = ctx;
			if (ctx.state === "suspended") ctx.resume();
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

	function beginVideoCapture(button) {
		var panel = button.closest("[data-comm-video-panel]");
		var video = panel ? panel.querySelector("[data-comm-video-preview]") : null;
		var status = panel ? panel.querySelector("[data-comm-video-status]") : null;
		if (!video || !status) return;
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
			startVideoTimer(panel);
			if (sendButton) sendButton.disabled = true;
			if (recordButton) recordButton.disabled = true;
			if (rerecordButton) rerecordButton.disabled = true;
			if (stopButton) stopButton.disabled = false;
			if (window.MediaRecorder) {
				try {
					panel._commChunks = [];
					panel._commRecorder = new MediaRecorder(stream);
					panel._commRecorder.ondataavailable = function (event) {
						if (event.data && event.data.size) panel._commChunks.push(event.data);
					};
					panel._commRecorder.onstop = function () {
						var blob = new Blob(panel._commChunks || [], { type: "video/webm" });
						stopVideoTimer(panel);
						showVideoProcessing(panel);
						window.setTimeout(function () {
							video.srcObject = null;
							video.src = URL.createObjectURL(blob);
							video.muted = false;
							video.controls = true;
							video.pause();
							panel._commVideoBlob = blob;
							panel._commVideoName = "missionmed-video-" + Date.now() + ".webm";
							panel.classList.remove("is-recording", "is-processing");
							panel.classList.add("is-preview-ready");
							finishVideoProcessing(panel);
							if (sendButton && blob.size) sendButton.disabled = false;
							if (recordButton) recordButton.disabled = false;
							if (rerecordButton) rerecordButton.disabled = false;
							if (stopButton) stopButton.disabled = true;
							status.textContent = blob.size ? "Preview ready. Press play to review, approve and send, or re-record." : "No video was recorded.";
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
			stopVideoTimer(panel);
			var recordButton = panel.querySelector("[data-comm-video-record]");
			if (recordButton) recordButton.disabled = false;
			status.textContent = "Camera permission was not granted.";
		});
	}

	function startVideoTimer(panel) {
		var timer = panel ? panel.querySelector("[data-comm-video-timer]") : null;
		if (!timer) return;
		panel._commVideoStartedAt = Date.now();
		window.clearInterval(panel._commVideoTimer);
		panel._commVideoTimer = window.setInterval(function () {
			var seconds = Math.max(0, Math.floor((Date.now() - panel._commVideoStartedAt) / 1000));
			var mins = Math.floor(seconds / 60);
			var secs = seconds % 60;
			timer.textContent = String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
		}, 250);
	}

	function stopVideoTimer(panel) {
		if (!panel) return;
		window.clearInterval(panel._commVideoTimer);
		panel._commVideoTimer = null;
	}

	function showVideoProcessing(panel) {
		var progress = panel ? panel.querySelector("[data-comm-video-progress]") : null;
		var status = panel ? panel.querySelector("[data-comm-video-status]") : null;
		if (!panel) return;
		panel.classList.remove("is-recording");
		panel.classList.add("is-processing");
		if (status) status.textContent = "Processing your preview...";
		if (progress) {
			progress.style.width = "12%";
			window.setTimeout(function () { progress.style.width = "68%"; }, 60);
			window.setTimeout(function () { progress.style.width = "100%"; }, 560);
		}
	}

	function finishVideoProcessing(panel) {
		var progress = panel ? panel.querySelector("[data-comm-video-progress]") : null;
		if (progress) {
			progress.style.width = "0%";
		}
	}

	function stopVideoPreview(button) {
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
			stopVideoTimer(panel);
		}
		if (video && video.srcObject) {
			video.pause();
			video.srcObject = null;
		}
		if (status && !(panel && panel._commRecorder)) status.textContent = "Local preview stopped.";
	}

	function closeVideoModal(layer) {
		var state = getCommState();
		var panel = layer ? layer.querySelector("[data-comm-video-panel]") : document.querySelector("[data-comm-video-panel]");
		if (!panel) {
			state.videoModalOpen = false;
			renderCommunications();
			return;
		}
		if (panel._commRecorder && panel._commRecorder.state !== "inactive") {
			panel._commRecorder.stop();
		}
		if (panel._commStream) {
			panel._commStream.getTracks().forEach(function (track) {
				track.stop();
			});
			panel._commStream = null;
		}
		stopVideoTimer(panel);
		state.videoModalOpen = false;
		renderCommunications();
	}

	function rerecordVideoPreview(button) {
		var panel = button.closest("[data-comm-video-panel]");
		var video = panel ? panel.querySelector("[data-comm-video-preview]") : null;
		var status = panel ? panel.querySelector("[data-comm-video-status]") : null;
		var sendButton = panel ? panel.querySelector("[data-comm-video-send]") : null;

		if (!panel) return;

		if (panel._commStream) {
			panel._commStream.getTracks().forEach(function (track) {
				track.stop();
			});
			panel._commStream = null;
		}

		panel._commVideoBlob = null;
		panel._commVideoName = "";
		panel.classList.remove("is-preview-ready", "is-processing", "is-recording");
		finishVideoProcessing(panel);
		if (sendButton) sendButton.disabled = true;
		button.disabled = true;
		if (video) {
			video.pause();
			video.removeAttribute("src");
			video.srcObject = null;
			video.load();
		}
		if (status) status.textContent = "Starting a new recording...";
		startVideoPreview(button);
	}

	function sendVideoCommunication(button) {
		var state = getCommState();
		var panel = button.closest("[data-comm-video-panel]");
		var status = panel ? panel.querySelector("[data-comm-video-status]") : null;
		var caption = panel ? panel.querySelector("[data-comm-video-caption]") : null;
		var id = getNumber(state.selectedId, 0);
		var blob = panel ? panel._commVideoBlob : null;

		if (!id) {
			if (status) status.textContent = "Open a conversation before sending video.";
			return;
		}

		if (!blob || !blob.size) {
			if (status) status.textContent = "Record a video before sending.";
			return;
		}

		var endpoint = state.mode === "admin" ? "/communications/admin/conversations/" + id + "/video" : "/communications/student/conversations/" + id + "/video";
		var form = new FormData();
		form.append("video", blob, panel._commVideoName || "missionmed-video.webm");
		form.append("body", caption ? caption.value || "" : "");

		button.disabled = true;
		if (status) status.textContent = "Uploading video privately...";

		fetch(app.api.url(endpoint), {
			method: "POST",
			credentials: "same-origin",
			headers: { "X-WP-Nonce": app.api.nonce },
			body: form
		}).then(function (response) {
			return response.json().then(function (payload) {
				if (!response.ok) {
					throw new Error(payload && payload.message ? payload.message : "Video upload failed");
				}
				return payload;
			});
		}).then(function (data) {
			state.selected = data && data.conversation ? data.conversation : null;
			state.messages = data && Array.isArray(data.messages) ? data.messages : [];
			state.notice = "Video sent.";
			state.error = "";
			panel._commVideoBlob = null;
			panel._commVideoName = "";
			if (caption) caption.value = "";
			if (status) status.textContent = "Video sent.";
			return state.mode === "admin"
				? app.api.get("/communications/admin/conversations", { mentor_key: state.mentorFilter || "" })
				: app.api.get("/communications/student/conversations");
		}).then(function (data) {
			state.conversations = data && Array.isArray(data.conversations) ? data.conversations : [];
			renderCommunications();
		}).catch(function (error) {
			button.disabled = false;
			state.error = error && error.message ? error.message : "Video could not be sent.";
			if (status) status.textContent = state.error;
			renderCommunications();
		});
	}

	function saveCommunicationAttachmentToVault(button) {
		var state = getCommState();
		var streamUrl = button.getAttribute("data-comm-attachment-stream") || "";
		var filename = button.getAttribute("data-comm-attachment-name") || "MissionMed video message.webm";
		var mimeType = button.getAttribute("data-comm-attachment-mime") || "video/webm";

		if (!streamUrl) {
			state.error = "Video could not be saved because the private stream is unavailable.";
			renderCommunications();
			return;
		}

		button.disabled = true;
		button.textContent = "Saving...";
		state.error = "";
		state.notice = "";

		fetch(streamUrl, { credentials: "same-origin" }).then(function (response) {
			if (!response.ok) {
				throw new Error("Video could not be opened for File Vault save.");
			}
			return response.blob();
		}).then(function (blob) {
			return app.api.post("/files/upload-url", {
				filename: filename,
				mime_type: mimeType || blob.type || "video/webm",
				category: "other"
			}).then(function (upload) {
				return fetch(upload.upload_url, {
					method: "PUT",
					headers: { "Content-Type": mimeType || blob.type || "video/webm" },
					body: blob
				}).then(function (uploadResponse) {
					if (!uploadResponse.ok) {
						throw new Error("File Vault upload failed.");
					}
					return app.api.post("/files/" + upload.file_id + "/confirm", { file_size: blob.size });
				});
			});
		}).then(function () {
			state.notice = "Video saved to File Vault.";
			state.error = "";
			renderCommunications();
		}).catch(function (error) {
			state.error = error && error.message ? error.message : "File Vault save is not available yet.";
			renderCommunications();
		});
	}

	function markAdminMessageRead(input) {
		var state = getCommState();
		var messageId = getNumber(input.getAttribute("data-comm-mark-message-read"), 0);
		if (!messageId || state.mode !== "admin") {
			input.checked = false;
			return;
		}

		input.disabled = true;
		app.api.post("/communications/admin/messages/" + messageId + "/read", {}).then(function (data) {
			state.selected = data && data.conversation ? data.conversation : state.selected;
			state.messages = data && Array.isArray(data.messages) ? data.messages : state.messages;
			state.notice = "Read receipt shared.";
			state.error = "";
			renderCommunications();
		}).catch(function (error) {
			input.disabled = false;
			input.checked = false;
			state.error = error && error.message ? error.message : "Read receipt could not be shared.";
			renderCommunications();
		});
	}

	function loadAdminConversations() {
		var state = getCommState();
		app.api.get("/communications/admin/conversations", { mentor_key: state.mentorFilter || "" }).then(function (data) {
			state.mode = "admin";
			state.conversations = data && Array.isArray(data.conversations) ? data.conversations : [];
			state.mentors = data && Array.isArray(data.mentors) ? data.mentors : state.mentors;
			var selectedVisible = state.conversations.some(function (conversation) {
				return getNumber(conversation.id, 0) === getNumber(state.selectedId, 0);
			});
			if ((!state.selectedId || !selectedVisible) && state.conversations.length) {
				openCommunication(state.conversations[0].id);
				return;
			}
			if (!state.conversations.length) {
				state.selectedId = null;
				state.selected = null;
				state.messages = [];
			}
			renderCommunications();
		}).catch(function (error) {
			state.error = error && error.message ? error.message : "Threads could not be loaded.";
			renderCommunications();
		});
	}

	function loadStudentConversations(openId) {
		var state = getCommState();
		app.api.get("/communications/student/conversations").then(function (data) {
			state.mode = "student";
			state.conversations = data && Array.isArray(data.conversations) ? data.conversations : [];
			state.mentors = data && Array.isArray(data.mentors) ? data.mentors : state.mentors;
			if (openId) {
				openCommunication(openId);
			} else if (!state.selectedId && state.conversations.length) {
				openCommunication(state.conversations[0].id);
			} else {
				renderCommunications();
			}
		}).catch(function (error) {
			state.error = error && error.message ? error.message : "Threads could not be loaded.";
			renderCommunications();
		});
	}

	function searchAdminStudents(query) {
		var state = getCommState();
		if (state.mode !== "admin") {
			return;
		}
		app.api.get("/communications/admin/students", { search: query || "", limit: 20 }).then(function (data) {
			state.searchResults = data && Array.isArray(data.students) ? data.students : [];
			renderCommunications();
		}).catch(function (error) {
			state.error = error && error.message ? error.message : "Student search failed.";
			renderCommunications();
		});
	}

	function sendAdminCommunication(form) {
		var state = getCommState();
		var body = form.elements.body ? form.elements.body.value : "";
		state.error = "";
		state.notice = "";
		app.api.post("/communications/admin/send", {
			mentor_key: state.composeMentor || "dr_brian",
			student_user_ids: selectedStudentIds(state),
			body: body
		}).then(function (data) {
			state.notice = "Message sent to " + getNumber(data.sent, 0) + " student" + (getNumber(data.sent, 0) === 1 ? "." : "s.");
			state.selectedStudents = [];
			state.searchResults = [];
			state.adminComposerOpen = false;
			return app.api.get("/communications/admin/conversations", { mentor_key: state.mentorFilter || "" });
		}).then(function (data) {
			state.conversations = data && Array.isArray(data.conversations) ? data.conversations : [];
			if (state.conversations.length) {
				openCommunication(state.conversations[0].id);
				return;
			}
			renderCommunications();
		}).catch(function (error) {
			state.error = error && error.message ? error.message : "Message could not be sent.";
			renderCommunications();
		});
	}

	function startStudentCommunication(form) {
		var state = getCommState();
		var body = form.elements.body ? form.elements.body.value : "";
		state.error = "";
		state.notice = "";
		app.api.post("/communications/student/start", {
			mentor_key: state.composeMentor || "dr_brian",
			body: body
		}).then(function (data) {
			state.notice = "Message sent.";
			var id = data && data.conversation ? data.conversation.id : null;
			loadStudentConversations(id);
		}).catch(function (error) {
			state.error = error && error.message ? error.message : "Message could not be sent.";
			renderCommunications();
		});
	}

	function replyCommunication(form) {
		var state = getCommState();
		var id = state.selectedId;
		var body = form.elements.body ? form.elements.body.value : "";
		var endpoint = state.mode === "admin" ? "/communications/admin/conversations/" + id + "/reply" : "/communications/student/conversations/" + id + "/reply";
		state.error = "";
		state.notice = "";
		app.api.post(endpoint, { body: body }).then(function (data) {
			state.selected = data && data.conversation ? data.conversation : null;
			state.messages = data && Array.isArray(data.messages) ? data.messages : [];
			state.notice = "Reply sent.";
			if (state.mode === "admin") {
				return app.api.get("/communications/admin/conversations", { mentor_key: state.mentorFilter || "" });
			}
			return app.api.get("/communications/student/conversations");
		}).then(function (data) {
			state.conversations = data && Array.isArray(data.conversations) ? data.conversations : [];
			renderCommunications();
		}).catch(function (error) {
			state.error = error && error.message ? error.message : "Reply could not be sent.";
			renderCommunications();
		});
	}

	function openCommunication(id) {
		var state = getCommState();
		var mode = state.mode;
		var selectedId = getNumber(id, 0);
		if (!selectedId) {
			state.error = "That thread could not be opened.";
			renderCommunications();
			return;
		}
		var endpoint = mode === "admin" ? "/communications/admin/conversations/" + selectedId : "/communications/student/conversations/" + selectedId;
		var selectedSummary = (state.conversations || []).filter(function (conversation) {
			return getNumber(conversation.id, 0) === selectedId;
		})[0];
		var requestToken = (state.openRequestToken || 0) + 1;
		state.openRequestToken = requestToken;

		state.selectedId = selectedId;
		state.threadLoadingId = selectedId;
		state.error = "";
		state.notice = "";
		if (selectedSummary) {
			state.selected = selectedSummary;
			if (!state.selected || getNumber(state.selected.id, 0) !== selectedId) {
				state.messages = [];
			} else if (getNumber((state.messages || [])[0] && (state.messages || [])[0].conversation_id, selectedId) !== selectedId) {
				state.messages = [];
			}
			renderCommunications();
		}

		app.api.get(endpoint).then(function (data) {
			if (state.openRequestToken !== requestToken) return null;
			state.selectedId = selectedId;
			state.threadLoadingId = null;
			state.selected = data && data.conversation ? data.conversation : null;
			state.messages = data && Array.isArray(data.messages) ? data.messages : [];
			state.error = "";
			renderCommunications();

			if (mode === "admin") {
				return app.api.get("/communications/admin/conversations", { mentor_key: state.mentorFilter || "" }).then(function (listData) {
					if (state.openRequestToken !== requestToken) return;
					state.conversations = listData && Array.isArray(listData.conversations) ? listData.conversations : state.conversations;
					renderCommunications();
				}).catch(function () {});
			}

			return app.api.get("/communications/student/conversations").then(function (listData) {
				if (state.openRequestToken !== requestToken) return;
				state.conversations = listData && Array.isArray(listData.conversations) ? listData.conversations : state.conversations;
				renderCommunications();
			}).catch(function () {});
		}).catch(function (error) {
			if (state.openRequestToken !== requestToken) return;
			state.threadLoadingId = null;
			state.error = error && error.message ? error.message : "Conversation could not be opened.";
			renderCommunications();
		});
	}

	function toggleSelectedStudent(id, checked) {
		var state = getCommState();
		var studentId = getNumber(id, 0);
		var existing = state.selectedStudents.filter(function (student) {
			return getNumber(student.id, 0) === studentId;
		})[0];

		if (!checked) {
			state.selectedStudents = state.selectedStudents.filter(function (student) {
				return getNumber(student.id, 0) !== studentId;
			});
			return;
		}

		if (!existing) {
			var source = state.searchResults.filter(function (student) {
				return getNumber(student.id, 0) === studentId;
			})[0];
			if (source) {
				state.selectedStudents.push(source);
			}
		}
	}

	function selectedStudentIds(state) {
		return (state.selectedStudents || []).map(function (student) {
			return getNumber(student.id, 0);
		}).filter(Boolean);
	}

	function mentorSelect(id, selected, mentors) {
		return [
			'<select id="' + escapeAttr(id) + '" class="sos-comm-select">',
			(mentors || []).map(function (mentor) {
				var key = mentor.key || "";
				return '<option value="' + escapeAttr(key) + '"' + (key === selected ? " selected" : "") + ">" + escapeHTML(mentor.label || key) + "</option>";
			}).join(""),
			"</select>"
		].join("");
	}

	function mentorFilter(state) {
		return [
			'<select id="sos-comm-mentor-filter" class="sos-comm-filter">',
			'<option value="">All mentors</option>',
			(state.mentors || []).map(function (mentor) {
				var key = mentor.key || "";
				return '<option value="' + escapeAttr(key) + '"' + (key === state.mentorFilter ? " selected" : "") + ">" + escapeHTML(mentor.label || key) + "</option>";
			}).join(""),
			"</select>"
		].join("");
	}

	function readReceiptBadge(status) {
		if (!status || status.status === "none") {
			return "";
		}
		return '<span class="sos-comm-receipt msg-receipt">' + escapeHTML(status.read_at ? "Read " + formatMessageTime(status.read_at) : "Sent") + "</span>";
	}

	function messageReadLabel(message) {
		return message.recipient_read_at ? "Read " + formatMessageTime(message.recipient_read_at) : "Sent";
	}

	function feedItem(item) {
		return [
			'<article class="sos-feed-card sos-card">',
			'<span class="sos-pill">' + escapeHTML(formatProgram(item.type || "notice")) + "</span>",
			"<h2>" + escapeHTML(item.title || "Notification") + "</h2>",
			"<p>" + escapeHTML(item.message || "") + "</p>",
			"<time>" + escapeHTML(formatDateTime(item.timestamp)) + "</time>",
			"</article>"
		].join("");
	}

	function messageItem(item) {
		return [
			'<article class="sos-message-card sos-card">',
			'<div class="sos-message-avatar">' + escapeHTML(initials(item.from || "Advisor")) + "</div>",
			"<div>",
			"<h2>" + escapeHTML(item.title || "Advisor note") + "</h2>",
			"<p>" + escapeHTML(item.message || "") + "</p>",
			"<time>" + escapeHTML(item.from || "Advisor") + " - " + escapeHTML(formatDateTime(item.timestamp)) + "</time>",
			"</div>",
			"</article>"
		].join("");
	}

	function renderFileVault() {
			var data = app.state.files || {};
			var files = Array.isArray(data.files) ? data.files : [];
			var uploads = (app.state.uploads || []).filter(function (upload) {
				return upload.category === app.state.fileCategory;
			});
			var cards = uploads.map(uploadCard).join("") + files.map(fileCard).join("");
			var categories = fileVaultCategories();

			refs.content.innerHTML = [
				'<section class="sos-page">',
			app.components.pageHeader("Documents", "File Vault", "Private student file metadata with direct R2 upload wiring."),
			data.storage_configured ? "" : '<div class="sos-banner">File storage is being configured. Upload will be available soon.</div>',
			'<div class="sos-tabs">' + categories.map(function (item) {
				var active = app.state.fileCategory === item[0] ? " is-active" : "";
				return '<button type="button" class="sos-tab' + active + '" data-file-category="' + escapeAttr(item[0]) + '">' + escapeHTML(item[1]) + "</button>";
			}).join("") + "</div>",
			'<div class="sos-upload-zone" data-upload-zone>',
			'<input type="file" id="sos-file-input" multiple hidden>',
			'<div class="sos-upload-icon">FV</div>',
			'<h2>Drop files here or tap to browse</h2>',
			'<p>Large, private, and ready for direct R2 upload when storage is configured.</p>',
			"</div>",
			cards ? '<div class="sos-file-grid">' + cards + "</div>" : app.components.empty("No files in this category", "Upload metadata and review status will appear here."),
			"</section>"
		].join("");

			bindFileVault(data.storage_configured);
		}

		function fileVaultCategories() {
			return [
				["documents", "Documents"],
				["medical_records", "Medical Records"],
				["letters", "Letters"],
				["certifications", "Certifications"],
				["other", "Other"]
			];
		}

		function loadFileVaultData() {
			return app.api.get("/files", { category: app.state.fileCategory }).then(function (data) {
				app.state.files = data || { files: [], counts: {}, storage_configured: false };
				return app.state.files;
			});
		}

		function isFileVaultAppModeActive() {
			return !!(document.body && document.body.classList.contains("matrix-app-mode-file-vault"));
		}

		function renderCurrentFileVault() {
			if (isFileVaultAppModeActive()) {
				renderFileVaultAppMode();
				return;
			}

			renderFileVault();
		}

		function renderFileVaultAppMode() {
			var data = app.state.files || {};
			var files = Array.isArray(data.files) ? data.files : [];
			var uploads = (app.state.uploads || []).filter(function (upload) {
				return upload.category === app.state.fileCategory;
			});
			var filteredFiles = filterFileVaultFiles(files);
			var selectedFile = selectedFileVaultFile(files, filteredFiles);
			var storageReady = data.storage_configured === true;
			var categories = fileVaultCategories();
			var activeView = app.state.fileVaultView === "grid" ? "grid" : "list";

			refs.content.innerHTML = [
				'<section class="sos-page sos-runtime-v2-page sos-filevault-app-mode" data-runtime-route="filevault">',
				'<header class="sos-filevault-app-header">',
				'<a class="sos-filevault-dashboard-return" href="#dashboard" aria-label="Return to Matrix Dashboard">',
				'<span class="sos-filevault-dashboard-return-icon" aria-hidden="true">D</span>',
				'<span>Return to Matrix Dashboard</span>',
				"</a>",
				'<div class="sos-filevault-app-heading">',
				"<span>Documents</span>",
				"<strong>File Vault</strong>",
				"</div>",
				'<span class="sos-filevault-private-pill">Private Vault</span>',
				"</header>",
				'<div class="sos-filevault-toolbar">',
				'<div class="sos-filevault-mode-toggle" aria-label="File Vault mode">',
				'<button class="is-active" type="button">Student</button>',
				'<button type="button" disabled>Doc Docs</button>',
				"</div>",
				'<label class="sos-filevault-search">',
				'<span>Search files</span>',
				'<input type="search" data-file-search value="' + escapeAttr(app.state.fileSearch || "") + '" placeholder="Search File Vault">',
				"</label>",
				'<div class="sos-filevault-view-toggle" aria-label="View mode">',
				'<button class="' + (activeView === "list" ? "is-active" : "") + '" type="button" data-file-view="list">List</button>',
				'<button class="' + (activeView === "grid" ? "is-active" : "") + '" type="button" data-file-view="grid">Grid</button>',
				"</div>",
				'<button class="sos-filevault-filter-toggle" type="button" data-file-filter-toggle>Filters</button>',
				'<button class="sos-filevault-upload-action" type="button" data-file-upload-action>Upload</button>',
				"</div>",
				'<div class="sos-filevault-filter-drawer" data-file-filter-drawer>',
				'<div><span>Status</span><button type="button">Uploaded</button><button type="button">Review</button><button type="button">Needs Work</button></div>',
				'<div><span>Security</span><button type="button">Private</button><button type="button">Course Scoped</button><button type="button">No Public Links</button></div>',
				"</div>",
				'<div class="sos-filevault-canvas">',
				'<aside class="sos-filevault-left-rail">',
				'<div class="sos-filevault-rail-card">',
				'<div class="sos-filevault-rail-title">Folders</div>',
				fileVaultCategoryRail(categories, data.counts || {}),
				"</div>",
				'<div class="sos-filevault-rail-card">',
				'<div class="sos-filevault-rail-title">Storage</div>',
				'<div class="sos-filevault-storage-state ' + (storageReady ? "is-ready" : "is-pending") + '">',
				storageReady ? "Direct private uploads ready" : "Upload storage is being configured",
				"</div>",
				"</div>",
				"</aside>",
				'<main class="sos-filevault-workspace">',
				'<div class="sos-filevault-workspace-top">',
				'<div><span>Current folder</span><strong>' + escapeHTML(activeFileVaultCategoryLabel(categories)) + "</strong></div>",
				'<div class="sos-filevault-summary"><span>' + escapeHTML(String(filteredFiles.length)) + " files</span><span>" + escapeHTML(String(uploads.length)) + " active uploads</span></div>",
				"</div>",
				storageReady ? "" : '<div class="sos-filevault-banner">File storage is being configured. Upload will be available soon.</div>',
				'<div class="sos-filevault-dropzone" data-upload-zone>',
				'<input type="file" id="sos-file-input" multiple hidden>',
				'<div class="sos-filevault-drop-icon">FV</div>',
				"<h2>Drop files here or tap to browse</h2>",
				"<p>Private document metadata and direct R2 upload wiring stay inside Matrix.</p>",
				"</div>",
				uploads.length ? '<div class="sos-filevault-upload-strip">' + uploads.map(fileVaultUploadItem).join("") + "</div>" : "",
				filteredFiles.length ? '<div class="sos-filevault-files sos-filevault-files-' + activeView + '">' + (activeView === "grid" ? filteredFiles.map(fileVaultGridCard).join("") : fileVaultListHeader() + filteredFiles.map(fileVaultListRow).join("")) + "</div>" : app.components.empty("No files in this folder", "Upload metadata and review status will appear here."),
				"</main>",
				'<aside class="sos-filevault-preview">',
				fileVaultPreview(selectedFile),
				"</aside>",
				"</div>",
				"</section>"
			].join("");

			bindFileVaultAppMode(storageReady);
		}

		function activeFileVaultCategoryLabel(categories) {
			var active = app.state.fileCategory;
			var match = categories.filter(function (item) {
				return item[0] === active;
			})[0];
			return match ? match[1] : "Documents";
		}

		function fileVaultCategoryRail(categories, counts) {
			return categories.map(function (item) {
				var active = app.state.fileCategory === item[0] ? " is-active" : "";
				var count = counts && counts[item[0]] !== undefined ? counts[item[0]] : "";
				return [
					'<button type="button" class="sos-filevault-category' + active + '" data-file-category="' + escapeAttr(item[0]) + '">',
					'<span>' + escapeHTML(item[1]) + "</span>",
					count !== "" ? '<b>' + escapeHTML(String(count)) + "</b>" : "",
					"</button>"
				].join("");
			}).join("");
		}

		function fileVaultSearchText(file) {
			return [
				file.original_name,
				file.filename,
				file.status,
				file.category,
				file.mime_type,
				file.created_at
			].join(" ").toLowerCase();
		}

		function filterFileVaultFiles(files) {
			var query = String(app.state.fileSearch || "").trim().toLowerCase();
			if (!query) {
				return files;
			}

			return files.filter(function (file) {
				return fileVaultSearchText(file).indexOf(query) !== -1;
			});
		}

		function fileVaultFileId(file, index) {
			return String(file.id || file.file_id || file.key || file.filename || file.original_name || ("file-" + index));
		}

		function selectedFileVaultFile(files, filteredFiles) {
			var selectedId = String(app.state.filePreviewId || "");
			var selected = null;

			files.forEach(function (file, index) {
				if (fileVaultFileId(file, index) === selectedId) {
					selected = file;
				}
			});

			if (selected) {
				return selected;
			}

			return filteredFiles[0] || null;
		}

		function fileVaultStatusClass(status) {
			status = String(status || "uploaded").toLowerCase();
			if (status.indexOf("review") !== -1) return "is-review";
			if (status.indexOf("need") !== -1 || status.indexOf("error") !== -1) return "is-needs-work";
			if (status.indexOf("final") !== -1 || status.indexOf("approved") !== -1) return "is-final";
			return "is-uploaded";
		}

		function fileVaultStatusPill(status) {
			var label = formatProgram(status || "uploaded");
			return '<span class="sos-filevault-status ' + fileVaultStatusClass(status) + '">' + escapeHTML(label) + "</span>";
		}

		function fileVaultListHeader() {
			return [
				'<div class="sos-filevault-list-head" aria-hidden="true">',
				"<span></span><span>Name</span><span>Status</span><span>Size</span><span>Updated</span><span></span>",
				"</div>"
			].join("");
		}

		function fileVaultListRow(file, index) {
			var id = fileVaultFileId(file, index);
			var selected = String(app.state.filePreviewId || "") === id ? " is-selected" : "";
			var name = file.original_name || file.filename || "File";
			return [
				'<button type="button" class="sos-filevault-file-row' + selected + '" data-file-preview="' + escapeAttr(id) + '">',
				'<span class="sos-filevault-file-icon">' + escapeHTML(fileIcon(file.mime_type)) + "</span>",
				'<span class="sos-filevault-file-name"><strong>' + escapeHTML(name) + "</strong><small>" + escapeHTML(file.filename || "Private Matrix document") + "</small></span>",
				fileVaultStatusPill(file.status),
				'<span class="sos-filevault-muted">' + escapeHTML(formatBytes(file.file_size || 0)) + "</span>",
				'<span class="sos-filevault-muted">' + escapeHTML(formatDateTime(file.created_at)) + "</span>",
				'<span class="sos-filevault-row-action">Preview</span>',
				"</button>"
			].join("");
		}

		function fileVaultGridCard(file, index) {
			var id = fileVaultFileId(file, index);
			var selected = String(app.state.filePreviewId || "") === id ? " is-selected" : "";
			var name = file.original_name || file.filename || "File";
			return [
				'<button type="button" class="sos-filevault-grid-card' + selected + '" data-file-preview="' + escapeAttr(id) + '">',
				'<span class="sos-filevault-grid-icon">' + escapeHTML(fileIcon(file.mime_type)) + "</span>",
				"<strong>" + escapeHTML(name) + "</strong>",
				"<small>" + escapeHTML(formatBytes(file.file_size || 0)) + " - " + escapeHTML(formatDateTime(file.created_at)) + "</small>",
				fileVaultStatusPill(file.status),
				"</button>"
			].join("");
		}

		function fileVaultUploadItem(upload) {
			return [
				'<div class="sos-filevault-upload-item" data-upload-id="' + escapeAttr(upload.id) + '">',
				'<span>' + escapeHTML(upload.name || "Uploading file") + "</span>",
				'<div class="sos-upload-progress"><div class="sos-upload-progress-bar" style="width:' + clampPercent(upload.progress) + '%"></div></div>',
				'<b class="sos-upload-progress-text">' + escapeHTML(clampPercent(upload.progress) + "%") + "</b>",
				"</div>"
			].join("");
		}

		function fileVaultPreview(file) {
			if (!file) {
				return [
					'<div class="sos-filevault-preview-empty">',
					"<span>FV</span>",
					"<h2>Select a file to preview</h2>",
					"<p>Metadata, review status, and private storage state will appear here.</p>",
					"</div>"
				].join("");
			}

			var name = file.original_name || file.filename || "File";
			return [
				'<div class="sos-filevault-preview-card">',
				'<div class="sos-filevault-preview-doc">',
				'<span class="sos-filevault-preview-icon">' + escapeHTML(fileIcon(file.mime_type)) + "</span>",
				"<h2>" + escapeHTML(name) + "</h2>",
				"<p>" + escapeHTML(file.filename || "Private Matrix document") + "</p>",
				"</div>",
				'<div class="sos-filevault-preview-meta">',
				"<div><span>Status</span>" + fileVaultStatusPill(file.status) + "</div>",
				"<div><span>Size</span><strong>" + escapeHTML(formatBytes(file.file_size || 0)) + "</strong></div>",
				"<div><span>Updated</span><strong>" + escapeHTML(formatDateTime(file.created_at)) + "</strong></div>",
				"<div><span>Security</span><strong>Private Matrix scope</strong></div>",
				"</div>",
				"</div>"
			].join("");
		}

	function renderRanklist() {
		var data = app.state.ranklist || {};
		var programs = Array.isArray(data.programs) ? data.programs : [];
		var counts = data.counts || {};
		var probability = clampPercent(data.match_probability);
		var topPrograms = programs.slice(0, 3);
		var configured = data.configured !== false;
		var linked = data.linked !== false && data.supabase_connected === true;

		refs.content.innerHTML = [
			'<section class="sos-page sos-ranklist-page">',
			app.components.pageHeader("Match Prep", "RankList IQ", "A live Matrix summary of your existing RankListIQ strategy board."),
			!configured || !linked ? accountLinkBanner(data, "RankListIQ") : "",
			'<div class="sos-grid sos-grid-stats">',
			app.components.statCard(getNumber(counts.total, programs.length), "Programs", "var(--gold2)", "Total tracked"),
			app.components.statCard(getNumber(counts.ranked, 0), "Ranked", "var(--green)", "With rank position"),
			app.components.statCard(getNumber(counts.needs_scoring, 0), "Need Scoring", "var(--orange2)", "Missing score"),
			app.components.statCard(probability + "%", "Match Probability", "var(--blue2)", "RankListIQ signal"),
			"</div>",
			'<div class="sos-grid sos-grid-two">',
			'<div class="sos-card sos-card-pad sos-ranklist-board">',
			'<div class="sos-panel-title">Top Programs</div>',
			topPrograms.length ? topPrograms.map(rankProgramCard).join("") : app.components.empty("No programs synced", configured ? "Open RankListIQ to build or connect your rank list." : "Supabase credentials are needed before Matrix can read RankListIQ."),
			"</div>",
			'<div class="sos-card sos-card-pad sos-launch-card">',
			'<div class="sos-panel-title">Launcher</div>',
			'<div class="sos-gauge" style="--value:' + probability + '"><strong>' + probability + "%</strong><span>Match Signal</span></div>",
			'<p class="sos-panel-copy">Last synced: ' + escapeHTML(data.last_updated ? formatDateTime(data.last_updated) : "Not synced yet") + "</p>",
			'<a class="sos-btn sos-btn-primary sos-btn-block" href="' + escapeAttr(data.standalone_url || "/ranklistiq/") + '">Open RankListIQ</a>',
			"</div>",
			"</div>",
			"</section>"
		].join("");

		bindSupabaseRelink("ranklist");
	}

	function rankProgramCard(program, index) {
		var tier = String(program.tier || "medium").toLowerCase();
		return [
			'<article class="sos-rank-program">',
			'<div class="sos-rank-num">' + escapeHTML(program.rank_position || index + 1) + "</div>",
			"<div>",
			"<h2>" + escapeHTML(program.name || program.program_name || "Program") + "</h2>",
			"<p>" + escapeHTML([program.specialty, program.state].filter(Boolean).join(" - ") || "RankListIQ program") + "</p>",
			"</div>",
			'<span class="sos-tier sos-tier-' + escapeAttr(tier) + '">' + escapeHTML(formatProgram(tier)) + "</span>",
			'<strong class="sos-score">' + escapeHTML(getNumber(program.score, 0)) + "</strong>",
			"</article>"
		].join("");
	}

	function renderArena() {
		var data = app.state.arena || {};
		var player = data.player || {};
		var activity = data.recent_activity || {};
		var configured = data.configured !== false;
		var linked = data.linked !== false && data.supabase_connected === true;
		var winRate = clampPercent(player.win_rate);
		var avatar = player.avatar_url
			? '<img src="' + escapeAttr(player.avatar_url) + '" alt="" loading="lazy">'
			: "AR";

		refs.content.innerHTML = [
			'<section class="sos-page sos-arena-page">',
			app.components.pageHeader("Training", "Arena", "A read-only Matrix view of your live Arena performance."),
			!configured || !linked ? accountLinkBanner(data, "Arena") : "",
			'<div class="sos-grid sos-grid-stats">',
			app.components.statCard(player.rank ? "#" + player.rank : "-", "Arena Rank", "var(--gold2)", player.rank ? "Leaderboard position" : "Not ranked yet"),
			app.components.statCard(getNumber(player.total_score, 0).toLocaleString(), "Score", "var(--blue2)", "Arena rating"),
			app.components.statCard(getNumber(player.win_streak, 0), "Win Streak", "var(--green)", "Current run"),
			app.components.statCard(getNumber(player.matches_played, 0), "Matches", "var(--orange2)", "Recorded duels"),
			"</div>",
			'<div class="sos-grid sos-grid-two">',
			'<div class="sos-card sos-card-pad sos-arena-hero">',
			'<div class="sos-panel-title">Player Card</div>',
			'<div class="sos-arena-avatar">' + avatar + "</div>",
			'<h2>' + escapeHTML(player.display_name || "Arena Player") + "</h2>",
			'<div class="sos-gauge sos-arena-gauge" style="--value:' + winRate + '"><strong>' + winRate + "%</strong><span>Win Rate</span></div>",
			'<a class="sos-btn sos-btn-primary sos-btn-block" href="' + escapeAttr(data.standalone_url || "/homepage-arena/") + '">Enter Arena</a>',
			"</div>",
			'<div class="sos-card sos-card-pad sos-arena-activity">',
			'<div class="sos-panel-title">Recent Activity</div>',
			'<div class="sos-arena-row"><span>Matches last 7 days</span><strong>' + escapeHTML(getNumber(activity.matches_last_7_days, 0)) + "</strong></div>",
			'<div class="sos-arena-row"><span>Accuracy last 7 days</span><strong>' + escapeHTML(clampPercent(activity.accuracy_last_7_days) + "%") + "</strong></div>",
			'<div class="sos-arena-row"><span>Answers tracked</span><strong>' + escapeHTML(getNumber(activity.answers_total, 0).toLocaleString()) + "</strong></div>",
			'<p class="sos-panel-copy">Last synced: ' + escapeHTML(data.last_updated ? formatDateTime(data.last_updated) : "Not synced yet") + "</p>",
			"</div>",
			"</div>",
			"</section>"
		].join("");

		bindSupabaseRelink("arena");
	}

	function accountLinkBanner(data, label) {
		var canRetry = data && data.relink_available !== false && data.configured !== false;
		var message = data && data.message ? data.message : label + " is waiting for account connection.";

		return [
			'<div class="sos-banner sos-link-banner">',
			'<span>' + escapeHTML(message) + "</span>",
			canRetry ? '<button type="button" class="sos-btn sos-btn-secondary" data-supabase-relink>Retry Link</button>' : "",
			"</div>"
		].join("");
	}

	function bindSupabaseRelink(route) {
		refs.content.querySelectorAll("[data-supabase-relink]").forEach(function (button) {
			button.addEventListener("click", function () {
				button.disabled = true;
				button.textContent = "Checking...";

				app.api.post("/user/relink-supabase", {}).then(function () {
					if (route === "arena") {
						app.render.arena();
					} else {
						app.render.ranklist();
					}
				}).catch(function (error) {
					button.disabled = false;
					button.textContent = "Retry Link";
					showError(error);
				});
			});
		});
	}

	function renderLOR() {
		var data = app.state.lor || {};
		var requests = Array.isArray(data.requests) ? data.requests : [];
		var counts = data.counts || {};

		refs.content.innerHTML = [
			'<section class="sos-page sos-lor-page">',
			app.components.pageHeader("Match Prep", "LOR Writer", "Track recommendation requests through the GhostWriter pipeline."),
			'<div class="sos-grid sos-grid-stats">',
			app.components.statCard(getNumber(counts.total, requests.length), "Total Requests", "var(--gold2)", "Faculty tracked"),
			app.components.statCard(getNumber(counts.active, 0), "Active", "var(--blue2)", "Needs movement"),
			app.components.statCard(getNumber(counts.submitted, 0), "Submitted", "var(--green)", "Letters received"),
			app.components.statCard(getNumber(counts.revision, 0), "Revision", "var(--orange2)", "Needs follow-up"),
			"</div>",
			'<div class="sos-grid sos-grid-two sos-lor-layout">',
			lorFormCard(),
			'<div class="sos-card sos-card-pad sos-lor-stack">',
			'<div class="sos-panel-title">Request Pipeline</div>',
			requests.length ? requests.map(lorRequestCard).join("") : app.components.empty("No LOR requests yet", "Add a faculty recommender to start tracking the request."),
			"</div>",
			"</div>",
			"</section>"
		].join("");

		bindLOR();
	}

	function lorFormCard() {
		var today = new Date();
		today.setDate(today.getDate() + 21);

		return [
			'<form class="sos-card sos-card-pad sos-lor-form" data-lor-form>',
			'<div class="sos-panel-title">New Request</div>',
			"<h2>Add a recommender</h2>",
			'<label>Faculty name<input name="faculty_name" type="text" placeholder="Dr. Name" required></label>',
			'<label>Email<input name="faculty_email" type="email" placeholder="doctor@example.edu"></label>',
			'<label>Institution<input name="faculty_institution" type="text" placeholder="Hospital or university"></label>',
			'<div class="sos-form-row">',
			'<label>Specialty<input name="specialty" type="text" placeholder="Internal Medicine"></label>',
			'<label>Due date<input name="due_date" type="date" value="' + escapeAttr(dateKey(today)) + '"></label>',
			"</div>",
			'<label>Relationship<select name="relationship"><option>Attending</option><option>Program Director</option><option>Research Mentor</option><option>Clerkship Director</option><option>Advisor</option><option>Other</option></select></label>',
			'<label>Notes<textarea name="notes" rows="4" placeholder="Context, waiver status, reminder notes"></textarea></label>',
			'<button class="sos-btn sos-btn-primary sos-btn-block" type="submit">Create LOR Request</button>',
			"</form>"
		].join("");
	}

	function lorRequestCard(item) {
		var status = item.status || "draft";
		var dateText = item.due_date ? "Due " + formatDateTime(item.due_date) : "No due date";

		return [
			'<article class="sos-lor-card sos-card" data-lor-id="' + escapeAttr(item.id) + '">',
			'<div class="sos-lor-card-top">',
			'<div class="sos-lor-seal">LR</div>',
			"<div>",
			"<h2>" + escapeHTML(item.faculty_name || "Faculty recommender") + "</h2>",
			"<p>" + escapeHTML([item.specialty, item.faculty_institution].filter(Boolean).join(" - ") || "Recommendation request") + "</p>",
			"</div>",
			'<span class="sos-lor-status sos-lor-status-' + escapeAttr(status) + '">' + escapeHTML(item.status_label || formatProgram(status)) + "</span>",
			"</div>",
			'<div class="sos-lor-meta">',
			"<span>" + escapeHTML(dateText) + "</span>",
			"<span>" + escapeHTML(item.relationship || "Relationship pending") + "</span>",
			"</div>",
			item.notes ? '<p class="sos-lor-notes">' + escapeHTML(item.notes) + "</p>" : "",
			'<div class="sos-lor-stepper" role="group" aria-label="LOR status">',
			lorStatusButton(item.id, status, "draft", "Draft"),
			lorStatusButton(item.id, status, "requested", "Requested"),
			lorStatusButton(item.id, status, "in_review", "Review"),
			lorStatusButton(item.id, status, "revision", "Revision"),
			lorStatusButton(item.id, status, "submitted", "Submitted"),
			lorStatusButton(item.id, status, "completed", "Done"),
			"</div>",
			"</article>"
		].join("");
	}

	function lorStatusButton(id, current, status, label) {
		var active = current === status ? " is-active" : "";
		return '<button type="button" class="sos-lor-step' + active + '" data-lor-id="' + escapeAttr(id) + '" data-lor-status="' + escapeAttr(status) + '">' + escapeHTML(label) + "</button>";
	}

	function bindLOR() {
		var form = refs.content.querySelector("[data-lor-form]");
		if (form) {
			form.addEventListener("submit", function (event) {
				event.preventDefault();
				var data = new FormData(event.currentTarget);
				var payload = {
					faculty_name: data.get("faculty_name"),
					faculty_email: data.get("faculty_email"),
					faculty_institution: data.get("faculty_institution"),
					specialty: data.get("specialty"),
					relationship: data.get("relationship"),
					due_date: data.get("due_date"),
					notes: data.get("notes"),
					status: "draft"
				};

				app.api.post("/lor", payload).then(function () {
					return app.api.get("/lor");
				}).then(function (fresh) {
					app.state.lor = fresh || { requests: [], counts: {}, statuses: [] };
					renderLOR();
				}).catch(showError);
			});
		}

		refs.content.querySelectorAll("[data-lor-status]").forEach(function (button) {
			button.addEventListener("click", function () {
				var id = button.getAttribute("data-lor-id");
				var status = button.getAttribute("data-lor-status");

				button.classList.add("is-pressing");
				app.api.put("/lor/" + id + "/status", { status: status }).then(function () {
					return app.api.get("/lor");
				}).then(function (fresh) {
					app.state.lor = fresh || { requests: [], counts: {}, statuses: [] };
					renderLOR();
				}).catch(showError);
			});
		});
	}

	function uploadCard(upload) {
		return [
			'<article class="sos-file-card sos-card is-uploading" data-upload-id="' + escapeAttr(upload.id) + '">',
			'<div class="sos-file-tab"></div>',
			'<div class="sos-file-icon">UP</div>',
			"<h2>" + escapeHTML(upload.name || "Uploading file") + "</h2>",
			"<p>" + escapeHTML(formatBytes(upload.size || 0)) + " - " + escapeHTML(upload.status || "Preparing upload") + "</p>",
			'<div class="sos-upload-progress"><div class="sos-upload-progress-bar" style="width:' + clampPercent(upload.progress) + '%"></div></div>',
			'<span class="sos-pill sos-upload-progress-text">' + escapeHTML(clampPercent(upload.progress) + "%") + "</span>",
			"</article>"
		].join("");
	}

	function fileCard(file) {
		return [
			'<article class="sos-file-card sos-card">',
			'<div class="sos-file-tab"></div>',
			'<div class="sos-file-icon">' + escapeHTML(fileIcon(file.mime_type)) + "</div>",
			"<h2>" + escapeHTML(file.original_name || file.filename || "File") + "</h2>",
			"<p>" + escapeHTML(formatBytes(file.file_size || 0)) + " - " + escapeHTML(formatDateTime(file.created_at)) + "</p>",
			'<span class="sos-pill">' + escapeHTML(formatProgram(file.status || "uploaded")) + "</span>",
			"</article>"
		].join("");
	}

	function renderStudy() {
		var date = app.state.study.date;
		var blocks = app.state.study.blocks || [];
		var byHour = bucketBlocksByHour(blocks);

		refs.content.innerHTML = [
			'<section class="sos-page sos-study-page">',
			app.components.pageHeader("Learning", "Study Schedule", "Daily study blocks backed by the Matrix calendar event engine."),
			'<div class="sos-toolbar">',
			'<button class="sos-btn sos-btn-icon" type="button" data-study-prev>&lt;</button>',
			'<input class="sos-date-input" type="date" data-study-date value="' + escapeAttr(date) + '">',
			'<button class="sos-btn sos-btn-icon" type="button" data-study-next>&gt;</button>',
			'<button class="sos-btn sos-btn-primary" type="button" data-study-new>New Block</button>',
			"</div>",
			renderWeekStrip(),
			'<div class="sos-study-timeline">',
			hourRange().map(function (hour) {
				return [
					'<div class="sos-hour-row" data-hour="' + hour + '">',
					'<div class="sos-hour-label">' + formatHour(hour) + "</div>",
					'<div class="sos-hour-slot">',
					(byHour[hour] || []).map(studyBlock).join(""),
					"</div>",
					"</div>"
				].join("");
			}).join(""),
			"</div>",
			"</section>"
		].join("");

		bindStudy();
	}

	function studyBlock(block) {
		var completed = block.completed ? " is-complete" : "";
		var minutes = Math.max(30, getNumber(block.duration, 60));
		var height = Math.max(58, Math.round(minutes * 1.05));

		return [
			'<article class="sos-study-block' + completed + '" data-study-id="' + escapeAttr(block.id) + '" style="min-height:' + height + 'px">',
			'<strong>' + escapeHTML(block.subject || block.title || "Study") + "</strong>",
			'<span>' + escapeHTML(timeRange(block.start_at, block.end_at)) + "</span>",
			'<small>' + escapeHTML(block.notes || "Tap to mark complete. Drag to reschedule.") + "</small>",
			'<button class="sos-study-resize" type="button" aria-label="Resize study block"></button>',
			"</article>"
		].join("");
	}

	function renderWeekStrip() {
		var start = startOfWeek(parseDateKey(app.state.study.date));
		var blocksByDay = bucketStudyByDay(app.state.study.weekBlocks || []);

		return [
			'<div class="sos-week-strip">',
			[0, 1, 2, 3, 4, 5, 6].map(function (offset) {
				var day = addDays(start, offset);
				var key = dateKey(day);
				var density = Math.min(5, (blocksByDay[key] || []).length);
				var active = key === app.state.study.date ? " is-active" : "";
				return [
					'<button class="sos-week-day' + active + '" type="button" data-study-day="' + key + '">',
					'<span>' + escapeHTML(day.toLocaleDateString(undefined, { weekday: "short" })) + "</span>",
					'<strong>' + day.getDate() + "</strong>",
					'<i style="--density:' + density + '"></i>',
					"</button>"
				].join("");
			}).join(""),
			"</div>"
		].join("");
	}

	function renderCalendarGrid(month, eventsByDay) {
		var start = startOfWeek(startOfMonth(month));
		var cells = [];
		var labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

		for (var i = 0; i < 42; i++) {
			cells.push(addDays(start, i));
		}

		return [
			'<div class="sos-calendar-weekdays">' + labels.map(function (label) { return "<span>" + label + "</span>"; }).join("") + "</div>",
			'<div class="sos-calendar-grid">',
			cells.map(function (day) {
				var key = dateKey(day);
				var muted = day.getMonth() !== month.getMonth() ? " is-muted" : "";
				var selected = key === app.state.calendar.selectedDate ? " is-selected" : "";
				var today = key === dateKey(new Date()) ? " is-today" : "";
				var events = eventsByDay[key] || [];

				return [
					'<button type="button" class="sos-day' + muted + selected + today + '" data-date="' + key + '">',
					'<span class="sos-day-num">' + day.getDate() + "</span>",
					'<div class="sos-day-events">' + events.slice(0, 3).map(eventChip).join("") + "</div>",
					events.length > 3 ? '<span class="sos-more">+' + (events.length - 3) + "</span>" : "",
					"</button>"
				].join("");
			}).join(""),
			"</div>"
		].join("");
	}

	function eventChip(event) {
		var classes = ["sos-event-chip"];
		var label = "";

		if (event && event.source === "ssa") {
			classes.push("sos-event-chip-ssa");
			label = '<small>Appointment</small>';
		}

		return '<span class="' + classes.join(" ") + '" data-event-id="' + escapeAttr(event.id) + '">' + label + escapeHTML(event.title || "Event") + '<span class="sos-event-resize" data-resize-event="' + escapeAttr(event.id) + '"></span></span>';
	}

	function renderDaySchedule(dayKey, events) {
		events = events.slice().sort(function (a, b) {
			return String(a.start_at).localeCompare(String(b.start_at));
		});

		return [
			'<aside class="sos-card sos-day-panel">',
			'<div class="sos-panel-title">Daily Schedule</div>',
			'<h2 class="sos-panel-heading">' + escapeHTML(formatDate(dayKey)) + "</h2>",
			events.length ? '<div class="sos-day-list">' + events.map(function (event) {
				return [
					'<article class="sos-mini-event' + (event.source === "ssa" ? " sos-mini-event-ssa" : "") + '">',
					'<strong>' + escapeHTML(event.title || "Event") + "</strong>",
					'<span>' + escapeHTML(event.all_day ? "All day" : timeRange(event.start_at, event.end_at)) + "</span>",
					event.source === "ssa" ? '<em>SSA appointment</em>' : "",
					"</article>"
				].join("");
			}).join("") + "</div>" : app.components.empty("No events", "Tap any day or use New Event to add one."),
			"</aside>"
		].join("");
	}

	function bindCalendar() {
		var prev = refs.content.querySelector("[data-cal-prev]");
		var next = refs.content.querySelector("[data-cal-next]");
		var today = refs.content.querySelector("[data-cal-today]");
		var create = refs.content.querySelector("[data-event-new]");
		var ssaSync = refs.content.querySelector("[data-ssa-sync]");

		if (prev) {
			prev.addEventListener("click", function () {
				app.state.calendar.month = addMonths(app.state.calendar.month, -1);
				app.state.calendar.loadedKey = "";
				app.render.calendar();
			});
		}

		if (next) {
			next.addEventListener("click", function () {
				app.state.calendar.month = addMonths(app.state.calendar.month, 1);
				app.state.calendar.loadedKey = "";
				app.render.calendar();
			});
		}

		if (today) {
			today.addEventListener("click", function () {
				app.state.calendar.month = startOfMonth(new Date());
				app.state.calendar.selectedDate = dateKey(new Date());
				app.state.calendar.loadedKey = "";
				app.render.calendar();
			});
		}

		if (create) {
			create.addEventListener("click", function () {
				openEventPanel(app.state.calendar.selectedDate);
			});
		}

		if (ssaSync) {
			ssaSync.addEventListener("click", function () {
				syncSSA(ssaSync);
			});
		}

		refs.content.querySelectorAll(".sos-day").forEach(function (day) {
			day.addEventListener("click", function (event) {
				if (event.target.closest(".sos-event-chip")) {
					return;
				}

				app.state.calendar.selectedDate = day.getAttribute("data-date");
				app.render.calendar();
				openEventPanel(app.state.calendar.selectedDate);
			});

			day.addEventListener("dblclick", function () {
				openEventPanel(day.getAttribute("data-date"));
			});
		});

		refs.content.querySelectorAll(".sos-event-chip").forEach(function (chip) {
			chip.addEventListener("pointerdown", beginEventDrag);
		});
	}

	function loadCalendarIfNeeded() {
		var monthKey = app.state.calendar.month.getFullYear() + "-" + app.state.calendar.month.getMonth();

		if (app.state.calendar.loadedKey === monthKey || app.state.calendar.loading) {
			return;
		}

		var rangeStart = startOfWeek(startOfMonth(app.state.calendar.month));
		var rangeEnd = addDays(rangeStart, 42);
		app.state.calendar.loading = true;

			app.api.get("/events", {
				start: dateKey(rangeStart) + "T00:00:00",
				end: dateKey(rangeEnd) + "T23:59:59",
				no_sync: "1"
			}).then(function (data) {
			app.state.calendar.events = data && Array.isArray(data.events) ? data.events : [];
			app.state.calendar.loadedKey = monthKey;
			app.state.calendar.loading = false;
			if (app.state.route === "calendar") {
				app.render.calendar();
			}
		}).catch(function (error) {
			app.state.calendar.loading = false;
			showError(error);
		});
	}

	function ssaStatusPill() {
		var status = app.state.ssa || {};
		var available = status.active && status.enabled;
		var label = available ? "SSA ready" : "SSA dormant";
		var detail = status.last_synced ? "Last synced " + formatDateTime(status.last_synced) : (status.message || "SSA sync is waiting for setup.");

		return '<span class="sos-ssa-status' + (available ? " is-ready" : " is-dormant") + '" title="' + escapeAttr(detail) + '">' + escapeHTML(label) + "</span>";
	}

	function syncSSA(button) {
		if (button) {
			button.disabled = true;
			button.classList.add("is-loading");
			button.textContent = "Syncing...";
		}

		app.api.post("/ssa/sync", {}).then(function (data) {
			app.state.ssa = data && data.status ? data.status : {};
			app.state.calendar.loadedKey = "";
			showNotice(data && data.message ? data.message : "SSA sync checked.");
			app.render.calendar();
		}).catch(showError).finally(function () {
			if (button) {
				button.disabled = false;
				button.classList.remove("is-loading");
				button.textContent = "Sync SSA";
			}
		});
	}

	function openEventPanel(dayKey) {
		var panel = document.createElement("div");
		panel.className = "sos-slide-panel";
		panel.innerHTML = [
			'<div class="sos-slide-backdrop" data-close-panel></div>',
			'<form class="sos-slide-card sos-card" data-event-form>',
			'<button class="sos-panel-close" type="button" data-close-panel>&times;</button>',
			'<div class="sos-panel-title">New Event</div>',
			'<h2>Create calendar event</h2>',
			'<label>Title<input name="title" required placeholder="Advisor call, exam block, deadline..."></label>',
			'<label>Date<input name="date" type="date" value="' + escapeAttr(dayKey) + '" required></label>',
			'<div class="sos-form-row"><label>Start<input name="start" type="time" value="09:00"></label><label>End<input name="end" type="time" value="10:00"></label></div>',
			'<label>Category<input name="category" placeholder="advisor, exam, application"></label>',
			'<label>Notes<textarea name="description" rows="4"></textarea></label>',
			'<button class="sos-btn sos-btn-primary sos-btn-block" type="submit">Save Event</button>',
			"</form>"
		].join("");

		document.body.appendChild(panel);

		panel.querySelectorAll("[data-close-panel]").forEach(function (button) {
			button.addEventListener("click", function () {
				panel.remove();
			});
		});

		panel.querySelector("[data-event-form]").addEventListener("submit", function (event) {
			event.preventDefault();
			var form = event.currentTarget;
			var date = form.elements.date.value;
			var body = {
				title: form.elements.title.value,
				start_at: date + "T" + (form.elements.start.value || "09:00") + ":00",
				end_at: date + "T" + (form.elements.end.value || "10:00") + ":00",
				event_type: "general",
				category: form.elements.category.value || "manual",
				description: form.elements.description.value || ""
			};

			app.api.post("/events", body).then(function () {
				panel.remove();
				app.state.calendar.loadedKey = "";
				app.render.calendar();
			}).catch(showError);
		});
	}

	function beginEventDrag(event) {
		var chip = event.currentTarget;
		var resize = event.target.closest(".sos-event-resize");
		var id = getNumber(chip.getAttribute("data-event-id"), 0);
		var source = findById(app.state.calendar.events, id);

		if (!source) {
			return;
		}

		event.preventDefault();
		chip.setPointerCapture(event.pointerId);
		chip.classList.add("is-dragging");

		var mode = resize ? "resize" : "move";
		var latestDay = null;

		function move(pointerEvent) {
			var day = getCalendarDropDay(pointerEvent);
			refs.content.querySelectorAll(".sos-day.is-drop-target").forEach(function (item) {
				item.classList.remove("is-drop-target");
			});

			if (day) {
				latestDay = day.getAttribute("data-date");
				day.classList.add("is-drop-target");
			}
		}

		function up(pointerEvent) {
			document.removeEventListener("pointermove", move);
			document.removeEventListener("pointerup", up);
			chip.classList.remove("is-dragging");
			refs.content.querySelectorAll(".sos-day.is-drop-target").forEach(function (item) {
				item.classList.remove("is-drop-target");
			});

			var dropDate = latestDay;
			var dropDay = null;

			if (!dropDate) {
				dropDay = getCalendarDropDay(pointerEvent);
				dropDate = dropDay ? dropDay.getAttribute("data-date") : "";
			}

			if (!dropDate) {
				return;
			}

			var payload = mode === "resize" ? resizedEventPayload(source, dropDate) : movedEventPayload(source, dropDate);
			app.api.put("/events/" + id, payload).then(function () {
				app.state.calendar.loadedKey = "";
				app.render.calendar();
			}).catch(showError);
		}

		document.addEventListener("pointermove", move);
		document.addEventListener("pointerup", up);
	}

	function getCalendarDropDay(pointerEvent) {
		if (!pointerEvent || typeof pointerEvent.clientX !== "number" || typeof pointerEvent.clientY !== "number") {
			return null;
		}

		var el = document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY);
		return el && el.closest ? el.closest(".sos-day") : null;
	}

	function movedEventPayload(event, targetDay) {
		var start = new Date(event.start_at);
		var end = event.end_at ? new Date(event.end_at) : new Date(start.getTime() + 60 * 60000);
		var duration = end.getTime() - start.getTime();
		var nextStart = dateWithTime(targetDay, start);
		var nextEnd = new Date(nextStart.getTime() + duration);

		return {
			start_at: localDateTime(nextStart),
			end_at: localDateTime(nextEnd)
		};
	}

	function resizedEventPayload(event, targetDay) {
		var start = new Date(event.start_at);
		var end = event.end_at ? new Date(event.end_at) : new Date(start.getTime() + 60 * 60000);
		var nextEnd = dateWithTime(targetDay, end);

		if (nextEnd.getTime() < start.getTime()) {
			nextEnd = new Date(start.getTime() + 30 * 60000);
		}

		return { end_at: localDateTime(nextEnd) };
	}

	function bindFileVault(storageReady) {
		refs.content.querySelectorAll("[data-file-category]").forEach(function (button) {
			button.addEventListener("click", function () {
				app.state.fileCategory = button.getAttribute("data-file-category");
				app.state.filePreviewId = "";
				if (isFileVaultAppModeActive()) {
					loadFileVaultData().then(function () {
						renderFileVaultAppMode();
					}).catch(showError);
					return;
				}
				app.render.fileVault();
			});
		});

		var zone = refs.content.querySelector("[data-upload-zone]");
		var input = refs.content.querySelector("#sos-file-input");

		if (!zone || !input) {
			return;
		}

		zone.addEventListener("click", function () {
			input.click();
		});

		zone.addEventListener("dragover", function (event) {
			event.preventDefault();
			zone.classList.add("is-hot");
		});

		zone.addEventListener("dragleave", function () {
			zone.classList.remove("is-hot");
		});

		zone.addEventListener("drop", function (event) {
			event.preventDefault();
			zone.classList.remove("is-hot");
			handleFiles(event.dataTransfer.files, storageReady);
		});

		input.addEventListener("change", function () {
			handleFiles(input.files, storageReady);
		});
	}

	function bindFileVaultAppMode(storageReady) {
		bindFileVault(storageReady);

		var search = refs.content.querySelector("[data-file-search]");
		if (search) {
			search.addEventListener("input", function () {
				var cursor = search.selectionStart;
				app.state.fileSearch = search.value || "";
				app.state.filePreviewId = "";
				renderFileVaultAppMode();
				var nextSearch = refs.content.querySelector("[data-file-search]");
				if (nextSearch) {
					nextSearch.focus();
					if (typeof nextSearch.setSelectionRange === "function" && typeof cursor === "number") {
						nextSearch.setSelectionRange(cursor, cursor);
					}
				}
			});
		}

		refs.content.querySelectorAll("[data-file-view]").forEach(function (button) {
			button.addEventListener("click", function () {
				app.state.fileVaultView = button.getAttribute("data-file-view") === "grid" ? "grid" : "list";
				renderFileVaultAppMode();
			});
		});

		refs.content.querySelectorAll("[data-file-preview]").forEach(function (button) {
			button.addEventListener("click", function () {
				app.state.filePreviewId = button.getAttribute("data-file-preview") || "";
				renderFileVaultAppMode();
			});
		});

		var filterToggle = refs.content.querySelector("[data-file-filter-toggle]");
		var filterDrawer = refs.content.querySelector("[data-file-filter-drawer]");
		if (filterToggle && filterDrawer) {
			filterToggle.addEventListener("click", function () {
				filterDrawer.classList.toggle("is-open");
			});
		}

		var uploadAction = refs.content.querySelector("[data-file-upload-action]");
		var input = refs.content.querySelector("#sos-file-input");
		if (uploadAction && input) {
			uploadAction.addEventListener("click", function () {
				input.click();
			});
		}
	}

	function handleFiles(fileList, storageReady) {
		var files = Array.prototype.slice.call(fileList || []);

		if (!storageReady) {
			showError(new Error("File storage is being configured. Upload will be available soon."));
			return;
		}

		var queued = files.map(function (file, index) {
			return {
				id: "upload-" + Date.now() + "-" + index,
				file: file,
				name: file.name,
				size: file.size,
				category: app.state.fileCategory,
				progress: 0,
				status: "Queued"
			};
		});

		app.state.uploads = app.state.uploads.concat(queued);
		renderCurrentFileVault();

		queued.reduce(function (chain, upload) {
			return chain.then(function () {
				return uploadVaultFile(upload);
			});
		}, Promise.resolve()).then(function () {
			app.state.uploads = app.state.uploads.filter(function (upload) {
				return queued.indexOf(upload) === -1;
			});
			if (isFileVaultAppModeActive()) {
				return loadFileVaultData().then(function () {
					renderFileVaultAppMode();
				});
			}
			app.render.fileVault();
		}).catch(showError);
	}

	function uploadVaultFile(upload) {
		var file = upload.file;
		upload.status = "Requesting private URL";
		upload.progress = 6;
		updateUploadProgress(upload);

		return app.api.post("/files/upload-url", {
			filename: file.name,
			mime_type: file.type || "application/octet-stream",
			category: app.state.fileCategory
		}).then(function (data) {
			upload.status = "Uploading to storage";
			upload.progress = 12;
			updateUploadProgress(upload);

			return uploadToPresignedUrl(data.upload_url, file, upload).then(function () {
				upload.status = "Finalizing";
				upload.progress = 96;
				updateUploadProgress(upload);
				return app.api.post("/files/" + data.file_id + "/confirm", { file_size: file.size });
			}).then(function () {
				upload.status = "Saved";
				upload.progress = 100;
				updateUploadProgress(upload);
			});
		});
	}

	function uploadToPresignedUrl(url, file, upload) {
		return new Promise(function (resolve, reject) {
			var xhr = new XMLHttpRequest();
			xhr.open("PUT", url, true);
			xhr.upload.onprogress = function (event) {
				if (event.lengthComputable) {
					upload.progress = Math.max(12, Math.min(94, Math.round((event.loaded / event.total) * 82) + 12));
					updateUploadProgress(upload);
				}
			};
			xhr.onload = function () {
				if (xhr.status >= 200 && xhr.status < 300) {
					resolve();
				} else {
					reject(new Error("Upload failed with status " + xhr.status));
				}
			};
			xhr.onerror = function () {
				reject(new Error("Upload failed."));
			};
			xhr.send(file);
		});
	}

	function updateUploadProgress(upload) {
		var card = refs.content && refs.content.querySelector('[data-upload-id="' + String(upload.id).replace(/"/g, "") + '"]');
		if (!card) {
			return;
		}

		var bar = card.querySelector(".sos-upload-progress-bar");
		var text = card.querySelector(".sos-upload-progress-text");
		var copy = card.querySelector("p");
		if (bar) {
			bar.style.width = clampPercent(upload.progress) + "%";
		}
		if (text) {
			text.textContent = clampPercent(upload.progress) + "%";
		}
		if (copy) {
			copy.textContent = formatBytes(upload.size || 0) + " - " + (upload.status || "Uploading");
		}
	}

	function loadStudy() {
		var date = app.state.study.date;
		var start = startOfWeek(parseDateKey(date));
		var end = addDays(start, 7);
		app.state.study.loading = true;

		Promise.all([
			app.api.get("/study-blocks", { date: date }),
			app.api.get("/study-blocks", { start: dateKey(start) + "T00:00:00", end: dateKey(end) + "T23:59:59" })
		]).then(function (responses) {
			app.state.study.blocks = responses[0] && Array.isArray(responses[0].blocks) ? responses[0].blocks : [];
			app.state.study.weekBlocks = responses[1] && Array.isArray(responses[1].blocks) ? responses[1].blocks : [];
			app.state.study.loading = false;
			renderStudy();
		}).catch(function (error) {
			app.state.study.loading = false;
			showError(error);
		});
	}

	function bindStudy() {
		var dateInput = refs.content.querySelector("[data-study-date]");
		if (dateInput) {
			dateInput.addEventListener("change", function () {
				app.state.study.date = dateInput.value;
				loadStudy();
			});
		}

		bindClick("[data-study-prev]", function () {
			app.state.study.date = dateKey(addDays(parseDateKey(app.state.study.date), -1));
			loadStudy();
		});

		bindClick("[data-study-next]", function () {
			app.state.study.date = dateKey(addDays(parseDateKey(app.state.study.date), 1));
			loadStudy();
		});

		bindClick("[data-study-new]", function () {
			openStudyPanel(app.state.study.date, 9);
		});

		refs.content.querySelectorAll("[data-study-day]").forEach(function (button) {
			button.addEventListener("click", function () {
				app.state.study.date = button.getAttribute("data-study-day");
				loadStudy();
			});
		});

		refs.content.querySelectorAll(".sos-hour-row").forEach(function (row) {
			row.addEventListener("click", function (event) {
				if (event.target.closest(".sos-study-block")) {
					return;
				}
				openStudyPanel(app.state.study.date, getNumber(row.getAttribute("data-hour"), 9));
			});
		});

		refs.content.querySelectorAll(".sos-study-block").forEach(function (block) {
			block.addEventListener("pointerdown", beginStudyDrag);
			block.addEventListener("click", function (event) {
				if (event.target.closest(".sos-study-resize") || block.dataset.dragged === "1") {
					block.dataset.dragged = "0";
					return;
				}
				toggleStudyBlock(getNumber(block.getAttribute("data-study-id"), 0));
			});
		});
	}

	function beginStudyDrag(event) {
		var blockEl = event.currentTarget;
		var id = getNumber(blockEl.getAttribute("data-study-id"), 0);
		var block = findById(app.state.study.blocks, id);
		var resizing = !!event.target.closest(".sos-study-resize");
		var targetHour = null;

		if (!block) {
			return;
		}

		event.preventDefault();
		blockEl.setPointerCapture(event.pointerId);
		blockEl.classList.add("is-dragging");

		function move(pointerEvent) {
			blockEl.dataset.dragged = "1";
			var el = document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY);
			var row = el && el.closest ? el.closest(".sos-hour-row") : null;
			refs.content.querySelectorAll(".sos-hour-row.is-drop-target").forEach(function (item) {
				item.classList.remove("is-drop-target");
			});
			if (row) {
				targetHour = getNumber(row.getAttribute("data-hour"), 9);
				row.classList.add("is-drop-target");
			}
		}

		function up() {
			document.removeEventListener("pointermove", move);
			document.removeEventListener("pointerup", up);
			blockEl.classList.remove("is-dragging");
			refs.content.querySelectorAll(".sos-hour-row.is-drop-target").forEach(function (item) {
				item.classList.remove("is-drop-target");
			});

			if (targetHour === null) {
				return;
			}

			var payload = resizing ? resizedStudyPayload(block, targetHour) : movedStudyPayload(block, targetHour);
			app.api.put("/study-blocks/" + id, payload).then(loadStudy).catch(showError);
		}

		document.addEventListener("pointermove", move);
		document.addEventListener("pointerup", up);
	}

	function movedStudyPayload(block, hour) {
		var start = new Date(block.start_at);
		var duration = getNumber(block.duration, 60);
		var nextStart = parseDateKey(app.state.study.date);
		nextStart.setHours(hour, start.getMinutes(), 0, 0);
		var nextEnd = new Date(nextStart.getTime() + duration * 60000);

		return {
			start_at: localDateTime(nextStart),
			end_at: localDateTime(nextEnd),
			duration: duration
		};
	}

	function resizedStudyPayload(block, hour) {
		var start = new Date(block.start_at);
		var end = parseDateKey(app.state.study.date);
		end.setHours(hour + 1, 0, 0, 0);
		var minutes = Math.max(30, Math.round((end.getTime() - start.getTime()) / 60000));

		return {
			end_at: localDateTime(new Date(start.getTime() + minutes * 60000)),
			duration: minutes
		};
	}

	function toggleStudyBlock(id) {
		var block = findById(app.state.study.blocks, id);
		if (!block) {
			return;
		}

		app.api.put("/study-blocks/" + id, { completed: !block.completed }).then(loadStudy).catch(showError);
	}

	function openStudyPanel(dayKey, hour) {
		var start = parseDateKey(dayKey);
		start.setHours(hour, 0, 0, 0);
		var panel = document.createElement("div");
		panel.className = "sos-slide-panel";
		panel.innerHTML = [
			'<div class="sos-slide-backdrop" data-close-panel></div>',
			'<form class="sos-slide-card sos-card" data-study-form>',
			'<button class="sos-panel-close" type="button" data-close-panel>&times;</button>',
			'<div class="sos-panel-title">Study Block</div>',
			'<h2>Plan a focused session</h2>',
			'<label>Subject<select name="subject"><option>USMLE</option><option>Interview Prep</option><option>CV Review</option><option>Research</option><option>Applications</option></select></label>',
			'<label>Start<input name="start" type="datetime-local" value="' + escapeAttr(localDateTime(start).slice(0, 16)) + '"></label>',
			'<label>Duration<select name="duration"><option value="60">60 minutes</option><option value="90">90 minutes</option><option value="120">120 minutes</option><option value="180">180 minutes</option></select></label>',
			'<label>Notes<textarea name="notes" rows="4"></textarea></label>',
			'<button class="sos-btn sos-btn-primary sos-btn-block" type="submit">Save Study Block</button>',
			"</form>"
		].join("");
		document.body.appendChild(panel);

		panel.querySelectorAll("[data-close-panel]").forEach(function (button) {
			button.addEventListener("click", function () {
				panel.remove();
			});
		});

		panel.querySelector("[data-study-form]").addEventListener("submit", function (event) {
			event.preventDefault();
			var form = event.currentTarget;
			app.api.post("/study-blocks", {
				subject: form.elements.subject.value,
				start_at: form.elements.start.value + ":00",
				duration: form.elements.duration.value,
				notes: form.elements.notes.value
			}).then(function () {
				panel.remove();
				loadStudy();
			}).catch(showError);
		});
	}

	function profileOptionSets() {
		var years = [["", "Select year"]];
		var currentYear = new Date().getFullYear();
		var countries = [
			"Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
			"Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
			"Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Cote d'Ivoire", "Croatia", "Cuba", "Cyprus", "Czech Republic",
			"Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica", "Dominican Republic",
			"Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia",
			"Fiji", "Finland", "France",
			"Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
			"Haiti", "Honduras", "Hungary",
			"Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy",
			"Jamaica", "Japan", "Jordan",
			"Kazakhstan", "Kenya", "Kiribati", "Kosovo", "Kuwait", "Kyrgyzstan",
			"Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
			"Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar",
			"Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway",
			"Oman",
			"Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
			"Qatar",
			"Romania", "Russia", "Rwanda",
			"Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
			"Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
			"Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan",
			"Vanuatu", "Vatican City", "Venezuela", "Vietnam",
			"Yemen",
			"Zambia", "Zimbabwe"
		];
		var specialties = [
			"Allergy and Immunology", "Anesthesiology", "Child Neurology", "Dermatology", "Diagnostic Radiology", "Emergency Medicine", "Family Medicine", "General Surgery", "Internal Medicine", "Internal Medicine-Pediatrics", "Interventional Radiology", "Medical Genetics and Genomics", "Neurological Surgery", "Neurology", "Nuclear Medicine", "Obstetrics and Gynecology", "Ophthalmology", "Orthopaedic Surgery", "Otolaryngology", "Pathology", "Pediatrics", "Physical Medicine and Rehabilitation", "Plastic Surgery", "Preliminary Medicine", "Preliminary Surgery", "Preventive Medicine", "Psychiatry", "Radiation Oncology", "Surgery", "Thoracic Surgery", "Transitional Year", "Urology", "Vascular Surgery", "Undecided", "Other"
		];

		for (var year = currentYear + 8; year >= 1990; year--) {
			years.push([String(year), String(year)]);
		}

		return {
			yesNoUnsure: [["", "Select"], ["yes", "Yes"], ["no", "No"], ["unsure", "Unsure"]],
			contact: [["", "Select"], ["email", "Email"], ["phone", "Phone"], ["text", "Text"], ["whatsapp", "WhatsApp"], ["either", "Either email or phone"]],
			status: [["", "Select"], ["medical_student", "Medical student"], ["graduate", "Graduate"], ["resident_outside_us", "Resident outside the US"], ["practicing_physician_outside_us", "Practicing physician outside the US"], ["other", "Other"]],
			medYear: [["", "Select"], ["ms1", "MS1"], ["ms2", "MS2"], ["ms3", "MS3"], ["ms4", "MS4"], ["graduate", "Graduated"]],
			years: years,
			countries: [["", "Select country"]].concat(countries.map(function (country) { return [country, country]; })),
			specialties: [["", "Select specialty"]].concat(specialties.map(function (specialty) { return [specialty, specialty]; })),
			fellowships: [["", "Select fellowship"], ["Cardiology", "Cardiology"], ["Gastroenterology", "Gastroenterology"], ["Hematology/Oncology", "Hematology/Oncology"], ["Pulmonary/Critical Care", "Pulmonary/Critical Care"], ["Infectious Disease", "Infectious Disease"], ["Endocrinology", "Endocrinology"], ["Nephrology", "Nephrology"], ["Rheumatology", "Rheumatology"], ["Sports Medicine", "Sports Medicine"], ["Child Psychiatry", "Child Psychiatry"], ["Undecided", "Undecided"], ["Other", "Other"]],
			longTerm: [["", "Select"], ["community_practice", "Community practice"], ["academic_medicine", "Academic medicine"], ["hospitalist", "Hospitalist"], ["fellowship", "Fellowship"], ["primary_care", "Primary care"], ["undecided", "Undecided"], ["other", "Other"]],
			examStatus: [["", "Select"], ["passed", "Passed"], ["failed_attempt", "Failed attempt"], ["not_taken", "Not taken"], ["scheduled", "Scheduled"], ["target_date", "Target date"]],
			ecfmg: [["", "Select"], ["certified", "Certified"], ["pathway_in_progress", "Pathway in progress"], ["not_started", "Not started"], ["unsure", "Unsure"]],
			matchCycles: [["", "Select"], ["2026", "2026 Match"], ["2027", "2027 Match"], ["2028", "2028 Match"], ["future", "Future cycle"], ["undecided", "Undecided"]],
			priorCycles: [["", "Select"], ["0", "0"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4+"]],
			visa: [["", "Select"], ["us_citizen", "US citizen"], ["permanent_resident", "Permanent resident"], ["j1_required", "J-1 required"], ["h1b_required", "H-1B required"], ["f1_opt", "F-1/OPT"], ["other", "Other"], ["unsure", "Unsure"]],
			usceSetting: [["", "Select"], ["teaching_hospital", "Teaching hospital"], ["community_hospital", "Community hospital"], ["clinic", "Clinic"], ["observership", "Observership"], ["externship", "Externship"], ["none_yet", "None yet"]],
			lor: [["", "Select"], ["none", "None"], ["1_us_lor", "1 US LOR"], ["2_us_lors", "2 US LORs"], ["3_plus_us_lors", "3+ US LORs"], ["waived_uploaded", "Waived LORs uploaded"], ["unsure", "Unsure"]],
			research: [["", "Select"], ["none", "None"], ["current_project", "Current project"], ["submitted", "Submitted"], ["published", "Published"], ["multiple_publications", "Multiple publications"]],
			languages: ["English", "Spanish", "Arabic", "Hindi", "Urdu", "Mandarin", "French", "Portuguese", "Russian", "Tagalog", "Bengali", "Other"],
			redFlags: ["Low score", "Attempt", "Gap", "Old graduate", "Prior unmatched", "Visa concern", "No USCE", "Weak LORs", "Specialty switch", "Other"],
			avatarGender: [["", "Select"], ["male", "Male"], ["female", "Female"]],
			avatarBodyTypes: [["", "Select"], ["slim", "Slim"], ["athletic", "Athletic"], ["strong", "Strong"]],
			avatarStyles: [["", "Select"], ["doctor", "Doctor"], ["superhero", "Superhero"]]
		};
	}

	function studentProfileData() {
		return app.state.studentProfile.data || {};
	}

	function profileValue(name) {
		var data = studentProfileData();
		return data[name] === undefined || data[name] === null ? "" : data[name];
	}

	function profileOptionsHtml(options, selected) {
		return options.map(function (item) {
			return '<option value="' + escapeAttr(item[0]) + '"' + (String(item[0]) === String(selected) ? " selected" : "") + ">" + escapeHTML(item[1]) + "</option>";
		}).join("");
	}

	function profileField(name, label, required, attrs) {
		attrs = attrs || {};
		var value = profileValue(name);
		var note = attrs.note ? '<small>' + escapeHTML(attrs.note) + "</small>" : "";

		return [
			'<label class="sos-profile-field' + (required ? " is-required" : "") + '" data-profile-field-wrap="' + escapeAttr(name) + '">',
			'<span>' + escapeHTML(label) + (required ? " *" : "") + "</span>",
			'<input type="' + escapeAttr(attrs.type || "text") + '" name="' + escapeAttr(name) + '" value="' + escapeAttr(value) + '"' + (required ? " required" : "") + (attrs.readonly ? " readonly" : "") + ">",
			note,
			"</label>"
		].join("");
	}

	function profileSelect(name, label, options, required, attrs) {
		attrs = attrs || {};
		return [
			'<label class="sos-profile-field' + (required ? " is-required" : "") + '" data-profile-field-wrap="' + escapeAttr(name) + '">',
			'<span>' + escapeHTML(label) + (required ? " *" : "") + "</span>",
			'<select name="' + escapeAttr(name) + '"' + (required ? " required" : "") + ">",
			profileOptionsHtml(options, profileValue(name)),
			"</select>",
			attrs.note ? '<small>' + escapeHTML(attrs.note) + "</small>" : "",
			"</label>"
		].join("");
	}

	function profileTextarea(name, label, attrs) {
		attrs = attrs || {};
		return [
			'<label class="sos-profile-field sos-profile-field-wide" data-profile-field-wrap="' + escapeAttr(name) + '">',
			'<span>' + escapeHTML(label) + "</span>",
			'<textarea name="' + escapeAttr(name) + '" rows="' + escapeAttr(attrs.rows || 3) + '">' + escapeHTML(profileValue(name)) + "</textarea>",
			attrs.note ? '<small>' + escapeHTML(attrs.note) + "</small>" : "",
			"</label>"
		].join("");
	}

	function profileChecklist(name, label, options) {
		var selected = profileValue(name);
		selected = Array.isArray(selected) ? selected : [];

		return [
			'<fieldset class="sos-profile-check-group sos-profile-field-wide">',
			'<legend>' + escapeHTML(label) + "</legend>",
			'<div class="sos-profile-check-grid">',
			options.map(function (option) {
				return [
					'<label class="sos-profile-check">',
					'<input type="checkbox" name="' + escapeAttr(name) + '" value="' + escapeAttr(option) + '"' + (selected.indexOf(option) !== -1 ? " checked" : "") + ">",
					'<span>' + escapeHTML(option) + "</span>",
					"</label>"
				].join("");
			}).join(""),
			"</div>",
			"</fieldset>"
		].join("");
	}

	function profileHiddenField(name, value) {
		return '<input type="hidden" name="' + escapeAttr(name) + '" value="' + escapeAttr(value) + '">';
	}

	function profilePanel(id, title, copy, body) {
		return [
			'<section class="sos-profile-panel' + (app.state.studentProfile.activeTab === id ? " is-active" : "") + '" data-profile-panel="' + escapeAttr(id) + '">',
			'<div class="sos-profile-panel-head">',
			'<span class="sos-panel-title">' + escapeHTML(title) + "</span>",
			copy ? '<p>' + escapeHTML(copy) + "</p>" : "",
			"</div>",
			'<div class="sos-profile-form-grid">',
			body,
			"</div>",
			"</section>"
		].join("");
	}

	function renderStudentProfileProgress() {
		var progress = app.state.studentProfile.progress || { percentage: 0, filled: 0, total: 0, missing_required: [] };
		var percentage = clampPercent(progress.percentage || 0);
		var missing = progress.missing_required || [];

		return [
			'<div class="sos-profile-progress sos-card">',
			"<div>",
			'<span class="sos-panel-title">Profile Progress</span>',
			"<h2>" + escapeHTML(percentage + "% complete") + "</h2>",
			"<p>" + escapeHTML(missing.length ? "Required: first name, last name, phone/mobile, specialty." : "Required fields are complete. Keep adding details when you have time.") + "</p>",
			"</div>",
			'<div class="sos-profile-progress-meter">',
			'<div class="sos-progress"><div class="sos-progress-fill" style="width:' + percentage + '%"></div></div>',
			"<span>" + escapeHTML((progress.filled || 0) + " of " + (progress.total || 0) + " profile signals") + "</span>",
			"</div>",
			"</div>"
		].join("");
	}

	function renderStudentProfile() {
		var opts = profileOptionSets();
		var data = studentProfileData();
		var activeTab = app.state.studentProfile.activeTab || "basics";
		var tabs = [["basics", "Basics"], ["training", "Training"], ["goals", "Goals"], ["exams", "Exams"], ["match", "Match"], ["img", "IMG"], ["experience", "Experience"], ["avatar", "Avatar"]];
		var primarySpecialtyOther = profileValue("primary_specialty") === "Other" ? profileField("primary_specialty_other", "Other specialty", true) : "";
		var backupSpecialtyOther = profileValue("backup_specialty") === "Other" ? profileField("backup_specialty_other", "Other backup specialty", false) : "";
		var avatarStyle = String(data.avatar_style || "");
		var avatarImage = String(data.avatar_thumbnail_url || data.avatar_url || "");
		var avatarSource = String(data.avatar_generation_source || "matrix_profile_contract");
		var avatarBridgeRows = [
			["Version", "v3"],
			["Gender", data.avatar_gender ? formatProgram(data.avatar_gender) : "Not selected"],
			["Body", data.avatar_body_type ? formatProgram(data.avatar_body_type) : "Not selected"],
			["Style", avatarStyle ? formatProgram(avatarStyle) : "Not selected"],
			["Active ID", data.active_avatar_id || "Arena locker pending"]
		];
		var avatarPreview = [
			'<div class="sos-profile-avatar-stage sos-profile-field-wide">',
			'<div class="sos-profile-avatar-figure sos-profile-avatar-figure-' + escapeAttr(avatarStyle || "doctor") + '">',
			avatarImage ? '<img src="' + escapeAttr(avatarImage) + '" alt="Arena avatar preview">' : '<div class="sos-profile-avatar-figure-person"></div>',
			"</div>",
			'<div class="sos-profile-avatar-meta">',
			'<span class="sos-panel-title">Arena Avatar Studio v3</span>',
			"<strong>" + escapeHTML(avatarStyle ? formatProgram(avatarStyle) : "Doctor or Superhero") + "</strong>",
			"<p>" + escapeHTML("Matrix stores the same Avatar Studio v3 choices Arena uses: gender, body type, and style.") + "</p>",
			'<div class="sos-profile-avatar-bridge">',
			avatarBridgeRows.map(function (row) {
				return '<span><b>' + escapeHTML(row[0]) + '</b>' + escapeHTML(row[1]) + "</span>";
			}).join(""),
			"</div>",
			'<a class="sos-btn sos-profile-avatar-action" href="/homepage-arena/">Open Arena Avatar Studio</a>',
			"<small>" + escapeHTML("Generation and photo upload remain owned by Arena; this profile keeps the shared contract ready.") + "</small>",
			"</div>",
			"</div>",
			profileHiddenField("avatar_version", "v3"),
			profileHiddenField("avatar_generation_source", avatarSource)
		].join("");

		return [
			'<section class="sos-page sos-profile-page">',
			app.components.pageHeader("Ecosystem Profile", "My Profile", "A single student profile for Matrix now, and Arena later."),
			renderStudentProfileProgress(),
			'<form class="sos-profile-form" data-student-profile-form>',
			'<div class="sos-profile-tabs" role="tablist">',
			tabs.map(function (tab) {
				return '<button type="button" class="sos-profile-tab' + (activeTab === tab[0] ? " is-active" : "") + '" data-profile-tab="' + escapeAttr(tab[0]) + '">' + escapeHTML(tab[1]) + "</button>";
			}).join(""),
			"</div>",
			'<div class="sos-profile-panels">',
			profilePanel("basics", "Basics", "Only four fields are required; everything else can be saved for later.", [profileField("first_name", "First name", true), profileField("last_name", "Last name", true), profileField("phone_mobile", "Phone/mobile", true, { type: "tel" }), profileField("email", "Email", false, { readonly: true, note: "Pulled from your WordPress account." }), profileField("current_location", "Location during application season", false), profileField("time_zone", "Time zone", false), profileSelect("preferred_contact_method", "Preferred contact method", opts.contact, false)].join("")),
			profilePanel("training", "Medical School / Training", "Tell us where you are in training so advising starts from the right context.", [profileField("medical_school", "Medical school", false), profileSelect("medical_school_country", "Country of medical school", opts.countries, false), profileSelect("current_status", "Current status", opts.status, false), profileSelect("medical_school_year", "Med school year if not graduated", opts.medYear, false), profileSelect("graduation_year", "Graduation or expected graduation year", opts.years, false), profileSelect("is_img", "Are you an IMG/international graduate?", opts.yesNoUnsure, false)].join("")),
			profilePanel("goals", "Specialty Goals", "Use quick selections where possible; free text can wait.", [profileSelect("primary_specialty", "Specialty of choice", opts.specialties, true), primarySpecialtyOther, profileSelect("backup_specialty", "Backup specialty choice", opts.specialties, false), backupSpecialtyOther, profileSelect("primary_care_interest", "Interested in primary care?", opts.yesNoUnsure, false), profileSelect("fellowship_interest", "Interested in fellowship?", opts.yesNoUnsure, false), profileSelect("fellowship_goal", "Which fellowship?", opts.fellowships, false), profileSelect("long_term_goal", "Long-term goal", opts.longTerm, false)].join("")),
			profilePanel("exams", "Exams", "USMLE and COMLEX entries can be scores, attempts, scheduled dates, or target dates.", [profileSelect("step1_status", "Step 1 / Level 1 status", opts.examStatus, false), profileField("step1_score", "Step 1 / Level 1 score", false), profileSelect("step1_attempts", "Step 1 / Level 1 attempts", opts.priorCycles, false), profileField("step1_target_date", "Step 1 / Level 1 target date", false, { type: "date" }), profileSelect("step2_status", "Step 2 CK / Level 2 status", opts.examStatus, false), profileField("step2_score", "Step 2 CK / Level 2 score", false), profileSelect("step2_attempts", "Step 2 CK / Level 2 attempts", opts.priorCycles, false), profileField("step2_target_date", "Step 2 CK / Level 2 target date", false, { type: "date" }), profileSelect("step3_status", "Step 3 / Level 3 status", opts.examStatus, false), profileField("step3_score", "Step 3 / Level 3 score", false), profileSelect("step3_attempts", "Step 3 / Level 3 attempts", opts.priorCycles, false), profileField("step3_target_date", "Step 3 / Level 3 target date", false, { type: "date" }), profileSelect("ecfmg_status", "ECFMG certification status", opts.ecfmg, false)].join("")),
			profilePanel("match", "Match History", "Especially important for graduates and IMGs.", [profileSelect("match_cycle", "Applying for which Match cycle?", opts.matchCycles, false), profileSelect("prior_match_cycles", "Number of prior Match cycles", opts.priorCycles, false), profileSelect("previously_unmatched", "Previously unmatched?", opts.yesNoUnsure, false), profileSelect("soap_history", "SOAP history?", opts.yesNoUnsure, false), profileField("interviews_last_cycle", "Interviews last cycle", false, { type: "number" }), profileSelect("matched_prelim", "Matched before into prelim/transitional?", opts.yesNoUnsure, false)].join("")),
			profilePanel("img", "IMG-Specific", "International graduates can keep visa, USCE, and LOR context in one place.", [profileSelect("visa_status", "Visa/citizenship status", opts.visa, false), profileField("img_specialty_practiced", "Specialty practiced outside the US", false), profileField("img_years_practicing", "Years practicing outside the US", false, { type: "number" }), profileField("most_recent_clinical_work_date", "Most recent clinical work date", false, { type: "date" }), profileField("usce_months", "USCE months completed", false, { type: "number" }), profileSelect("usce_setting", "USCE setting", opts.usceSetting, false), profileSelect("lor_status", "LOR status", opts.lor, false)].join("")),
			profilePanel("experience", "Experience / Strengths", "Advisor context: languages, hobbies, research, leadership, and any red flags to plan around.", [profileField("publications_count", "Research publications, first/second author only", false, { type: "number" }), profileField("presentations_count", "Posters/presentations", false, { type: "number" }), profileSelect("research_experience", "Research experience", opts.research, false), profileSelect("pubmed_indexed", "PubMed indexed?", opts.yesNoUnsure, false), profileChecklist("languages_spoken", "Languages spoken", opts.languages), profileField("leadership_experience", "Leadership experience", false), profileField("volunteer_service", "Volunteer/community service", false), profileField("teaching_experience", "Teaching/mentoring experience", false), profileChecklist("red_flags", "Areas you want help explaining", opts.redFlags), profileTextarea("hobbies", "Hobbies", { rows: 2 }), profileTextarea("other_red_flags", "Other red flags or context", { rows: 2 }), profileTextarea("advisor_notes", "Anything else Dr Brian should know?", { rows: 3 })].join("")),
			profilePanel("avatar", "Avatar", "Uses the same Avatar Studio v3 selection contract as Arena lobby/profile.", [avatarPreview, profileSelect("avatar_gender", "Presentation", opts.avatarGender, false), profileSelect("avatar_body_type", "Body type", opts.avatarBodyTypes, false), profileSelect("avatar_style", "Avatar style", opts.avatarStyles, false)].join("")),
			"</div>",
			'<div class="sos-profile-actions"><span class="sos-profile-status" data-profile-status>' + escapeHTML(app.state.studentProfile.status || "") + '</span><button type="button" class="sos-btn" data-profile-save-draft>Save and finish later</button><button type="submit" class="sos-btn sos-btn-primary">Save Profile</button></div>',
			"</form>",
			"</section>"
		].join("");
	}

	function collectStudentProfileForm(form) {
		var data = Object.assign({}, studentProfileData());
		var arrays = { languages_spoken: [], red_flags: [] };

		Array.prototype.forEach.call(form.elements, function (field) {
			if (!field.name || field.disabled) return;
			if (arrays[field.name]) {
				if (field.checked) arrays[field.name].push(field.value);
				return;
			}
			if ((field.type === "checkbox" || field.type === "radio") && !field.checked) return;
			data[field.name] = field.value;
		});

		Object.keys(arrays).forEach(function (key) {
			data[key] = arrays[key];
		});

		data.avatar_version = "v3";
		data.avatar_generation_source = data.avatar_generation_source || "matrix_profile_contract";
		return data;
	}

	function saveStudentProfile(markComplete) {
		var form = refs.content.querySelector("[data-student-profile-form]");
		var payload;
		var missing;

		if (!form || app.state.studentProfile.saving) return;

		payload = collectStudentProfileForm(form);
		missing = ["first_name", "last_name", "phone_mobile", "primary_specialty"].filter(function (field) {
			return !String(payload[field] || "").trim();
		});

		if (payload.primary_specialty === "Other" && !String(payload.primary_specialty_other || "").trim()) {
			missing.push("primary_specialty_other");
		}

		if (markComplete && missing.length) {
			app.state.studentProfile.status = "Please complete first name, last name, phone/mobile, specialty, and other specialty when selected.";
			app.state.studentProfile.data = payload;
			app.render.profile();
			return;
		}

		app.state.studentProfile.saving = true;
		app.state.studentProfile.status = "Saving...";
		app.state.studentProfile.data = payload;
		app.render.profile();

		app.api.post("/profile/me", { profile: payload, mark_complete: !!markComplete }).then(function (data) {
			app.state.studentProfile.loaded = true;
			app.state.studentProfile.saving = false;
			app.state.studentProfile.data = data.profile || {};
			app.state.studentProfile.progress = data.progress || null;
			app.state.studentProfile.promptDismissed = !!data.prompt_dismissed;
			app.state.studentProfile.status = markComplete ? "Profile saved." : "Draft saved. You can finish later.";
			if (app.state.route === "profile") app.render.profile();
		}).catch(function (error) {
			app.state.studentProfile.saving = false;
			app.state.studentProfile.status = error && error.message ? error.message : "Profile could not be saved.";
			if (app.state.route === "profile") app.render.profile();
		});
	}

	function bindStudentProfile() {
		var form = refs.content.querySelector("[data-student-profile-form]");
		if (!form) return;

		refs.content.querySelectorAll("[data-profile-tab]").forEach(function (button) {
			button.addEventListener("click", function () {
				app.state.studentProfile.data = collectStudentProfileForm(form);
				app.state.studentProfile.activeTab = button.getAttribute("data-profile-tab") || "basics";
				app.render.profile();
			});
		});

		["primary_specialty", "backup_specialty"].forEach(function (name) {
			var field = form.elements[name];
			if (!field) return;
			field.addEventListener("change", function () {
				app.state.studentProfile.data = collectStudentProfileForm(form);
				app.render.profile();
			});
		});

		bindClick("[data-profile-save-draft]", function () {
			saveStudentProfile(false);
		});

		form.addEventListener("submit", function (event) {
			event.preventDefault();
			saveStudentProfile(true);
		});
	}

	function loadStudentProfile() {
		app.state.studentProfile.loading = true;

		return app.api.get("/profile/me").then(function (data) {
			app.state.studentProfile.loaded = true;
			app.state.studentProfile.loading = false;
			app.state.studentProfile.data = data.profile || {};
			app.state.studentProfile.progress = data.progress || null;
			app.state.studentProfile.requiredFields = data.required_fields || app.state.studentProfile.requiredFields;
			app.state.studentProfile.promptDismissed = !!data.prompt_dismissed;
			return data;
		}, function (error) {
			app.state.studentProfile.loading = false;
			throw error;
		});
	}

	function maybeShowStudentProfilePrompt() {
		if (app.state.route !== "dashboard" || app.state.studentProfile.loading || app.state.studentProfile.promptShown || app.state.studentProfile.sessionReminded || app.state.studentProfile.promptDismissed) return;

		loadStudentProfile().then(function () {
			var progress = app.state.studentProfile.progress || {};
			if (app.state.route !== "dashboard" || app.state.studentProfile.promptDismissed || app.state.studentProfile.sessionReminded || Number(progress.percentage || 0) >= 100) return;
			showStudentProfilePrompt(progress);
		}).catch(function () {
			/* The prompt is noncritical; keep the dashboard usable if profile loading fails. */
		});
	}

	function closeStudentProfilePrompt() {
		var existing = document.getElementById("sos-profile-prompt");
		if (existing) existing.remove();
	}

	function showStudentProfilePrompt(progress) {
		var layer = document.createElement("div");

		closeStudentProfilePrompt();
		app.state.studentProfile.promptShown = true;
		layer.id = "sos-profile-prompt";
		layer.className = "sos-profile-prompt-layer";
		layer.innerHTML = [
			'<div class="sos-profile-prompt-card" role="dialog" aria-modal="true" aria-labelledby="sos-profile-prompt-title">',
			'<span class="sos-panel-title">Profile setup</span>',
			'<h2 id="sos-profile-prompt-title">Complete your MissionMed Profile</h2>',
			"<p>This helps Dr Brian and the MissionMed team understand your goals, timeline, scores, background, and match strategy.</p>",
			'<div class="sos-progress"><div class="sos-progress-fill" style="width:' + clampPercent(progress && progress.percentage ? progress.percentage : 0) + '%"></div></div>',
			'<div class="sos-profile-prompt-actions"><button type="button" class="sos-btn sos-btn-primary" data-profile-prompt-complete>Complete Profile</button><button type="button" class="sos-btn" data-profile-prompt-later>Remind Me Later</button><button type="button" class="sos-profile-prompt-link" data-profile-prompt-dismiss>Don\'t Show Again</button></div>',
			"</div>"
		].join("");

		document.body.appendChild(layer);
		layer.querySelector("[data-profile-prompt-complete]").addEventListener("click", function () {
			closeStudentProfilePrompt();
			window.location.hash = "#profile";
		});
		layer.querySelector("[data-profile-prompt-later]").addEventListener("click", function () {
			app.state.studentProfile.sessionReminded = true;
			closeStudentProfilePrompt();
		});
		layer.querySelector("[data-profile-prompt-dismiss]").addEventListener("click", function () {
			app.api.post("/profile/me/dismiss-prompt", {}).then(function () {
				app.state.studentProfile.promptDismissed = true;
				closeStudentProfilePrompt();
			}).catch(function () {
				app.state.studentProfile.sessionReminded = true;
				closeStudentProfilePrompt();
			});
		});
	}

	function bindClick(selector, handler) {
		var el = refs.content.querySelector(selector);
		if (el) {
			el.addEventListener("click", handler);
		}
	}

	function showError(error) {
		var message = error && error.message ? error.message : "Matrix data could not be loaded.";
		refs.content.insertAdjacentHTML("beforeend", '<div class="sos-error">' + escapeHTML(message) + "</div>");
	}

	function showNotice(message) {
		if (!message) {
			return;
		}

		refs.content.insertAdjacentHTML("beforeend", '<div class="sos-notice">' + escapeHTML(message) + "</div>");
	}

	function avatarMarkup(profile, size) {
		var name = profile.display_name || "Student";
		var classes = "sos-user-avatar" + (size === "large" ? " sos-user-avatar-large" : "");

		if (profile.avatar_url) {
			return '<div class="' + classes + '"><img src="' + escapeAttr(profile.avatar_url) + '" alt="" loading="lazy"></div>';
		}

		return '<div class="' + classes + '">' + escapeHTML(initials(name)) + "</div>";
	}

	function groupBySection(items) {
		return items.reduce(function (groups, item) {
			var section = item.section || "Matrix";
			if (!groups[section]) {
				groups[section] = [];
			}

			groups[section].push(item);
			return groups;
		}, {});
	}

	function firstNameFrom(name) {
		return String(name || "Student").trim().split(/\s+/)[0] || "Student";
	}

	function initials(name) {
		return String(name || "MM").split(/\s+/).filter(Boolean).map(function (part) {
			return part.charAt(0);
		}).join("").slice(0, 2).toUpperCase() || "MM";
	}

	function formatProgram(value) {
		return String(value || "")
			.replace(/^_+|_+$/g, "")
			.replace(/[_-]+/g, " ")
			.replace(/\b\w/g, function (letter) {
				return letter.toUpperCase();
			});
	}

	function matrixDisplayLabel(value) {
		return String(value || "").replace(/\bMy Match Path\b/g, "My Match Training");
	}

	function getNumber(primary, fallback) {
		var value = primary;
		if (value === undefined || value === null || value === "") {
			value = fallback;
		}
		value = Number(value);
		return Number.isFinite(value) ? value : 0;
	}

	function clampPercent(value) {
		value = getNumber(value, 0);
		return Math.max(0, Math.min(100, value));
	}

	function dateKey(date) {
		var d = new Date(date.getTime());
		d.setHours(12, 0, 0, 0);
		return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
	}

	function parseDateKey(value) {
		var parts = String(value || dateKey(new Date())).split("-");
		return new Date(getNumber(parts[0], 1970), getNumber(parts[1], 1) - 1, getNumber(parts[2], 1), 12, 0, 0, 0);
	}

	function startOfMonth(date) {
		return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
	}

	function startOfWeek(date) {
		var d = new Date(date.getTime());
		d.setDate(d.getDate() - d.getDay());
		d.setHours(12, 0, 0, 0);
		return d;
	}

	function addDays(date, days) {
		var d = new Date(date.getTime());
		d.setDate(d.getDate() + days);
		return d;
	}

	function addMonths(date, months) {
		return new Date(date.getFullYear(), date.getMonth() + months, 1, 12, 0, 0, 0);
	}

	function pad(value) {
		return String(value).padStart(2, "0");
	}

	function localDateTime(date) {
		return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + "T" + pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":00";
	}

	function dateWithTime(dayKey, timeSource) {
		var d = parseDateKey(dayKey);
		d.setHours(timeSource.getHours(), timeSource.getMinutes(), timeSource.getSeconds(), 0);
		return d;
	}

	function bucketEventsByDay(events) {
		return (events || []).reduce(function (buckets, event) {
			var start = new Date(event.start_at);
			var end = event.end_at ? new Date(event.end_at) : start;
			var cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0);
			var last = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12, 0, 0, 0);
			var guard = 0;

			while (cursor <= last && guard < 45) {
				var key = dateKey(cursor);
				if (!buckets[key]) {
					buckets[key] = [];
				}
				buckets[key].push(event);
				cursor = addDays(cursor, 1);
				guard++;
			}

			return buckets;
		}, {});
	}

	function bucketBlocksByHour(blocks) {
		return (blocks || []).reduce(function (buckets, block) {
			var hour = new Date(block.start_at).getHours();
			if (!buckets[hour]) {
				buckets[hour] = [];
			}
			buckets[hour].push(block);
			return buckets;
		}, {});
	}

	function bucketStudyByDay(blocks) {
		return (blocks || []).reduce(function (buckets, block) {
			var key = dateKey(new Date(block.start_at));
			if (!buckets[key]) {
				buckets[key] = [];
			}
			buckets[key].push(block);
			return buckets;
		}, {});
	}

	function eventSpansDays(event) {
		if (!event.end_at) {
			return false;
		}
		return dateKey(new Date(event.start_at)) !== dateKey(new Date(event.end_at));
	}

	function findById(items, id) {
		return (items || []).filter(function (item) {
			return getNumber(item.id, 0) === getNumber(id, 0);
		})[0] || null;
	}

	function hourRange() {
		var hours = [];
		for (var hour = 7; hour <= 23; hour++) {
			hours.push(hour);
		}
		return hours;
	}

	function formatHour(hour) {
		var suffix = hour >= 12 ? "PM" : "AM";
		var display = hour % 12 || 12;
		return display + " " + suffix;
	}

	function formatDate(value) {
		var date = typeof value === "string" ? parseDateKey(value) : value;
		return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
	}

	function formatDateTime(value) {
		if (!value) {
			return "Now";
		}
		var date = new Date(value);
		return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
	}

	function formatMessageTime(value) {
		if (!value) {
			return "Now";
		}
		var date = new Date(value);
		if (Number.isNaN(date.getTime())) {
			return String(value);
		}
		var today = new Date();
		var sameDay = date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
		return sameDay ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
	}

	function formatRelativeTime(value) {
		if (!value) {
			return "Now";
		}
		var date = new Date(value);
		if (Number.isNaN(date.getTime())) {
			return String(value);
		}
		var seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
		if (seconds < 60) return "Now";
		if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
		if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
		if (seconds < 604800) return Math.floor(seconds / 86400) + "d ago";
		return date.toLocaleDateString([], { month: "short", day: "numeric" });
	}

	function timeRange(start, end) {
		var a = new Date(start);
		var b = end ? new Date(end) : null;
		var first = Number.isNaN(a.getTime()) ? "" : a.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
		var second = b && !Number.isNaN(b.getTime()) ? b.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
		return second ? first + " - " + second : first;
	}

	function formatMoney(amount, currency) {
		try {
			return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(getNumber(amount, 0));
		} catch (error) {
			return "$" + getNumber(amount, 0).toFixed(2);
		}
	}

	function formatBytes(bytes) {
		bytes = getNumber(bytes, 0);
		if (bytes < 1024) {
			return bytes + " B";
		}
		if (bytes < 1024 * 1024) {
			return (bytes / 1024).toFixed(1) + " KB";
		}
		return (bytes / (1024 * 1024)).toFixed(1) + " MB";
	}

	function fileIcon(mime) {
		if (String(mime).indexOf("pdf") !== -1) {
			return "PDF";
		}
		if (String(mime).indexOf("image") !== -1) {
			return "IMG";
		}
		return "DOC";
	}

	function supportEmail() {
		var division = app.state.profile && app.state.profile.division;
		if (division === "clinicals") {
			return "clinicals@missionmedinstitute.com";
		}
		return "info@missionmedinstitute.com";
	}

	function escapeHTML(value) {
		return String(value === undefined || value === null ? "" : value)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}

	function escapeAttr(value) {
		return escapeHTML(value).replace(/`/g, "&#096;");
	}

	function matrixRouteLabel(route) {
		var normalized = normalizeMatrixRoute(route);
		var match = app.components.navItems().filter(function (item) {
			return item.route === normalized;
		})[0];

		return match && match.label ? match.label : normalized.replace(/[-_]/g, " ");
	}

	function safeCamLaunchUrl(value) {
		try {
			var url = new URL(String(value || ""), window.location.href);
			var hqOrigin = "https://cam-hq-production-cam-production.up.railway.app";
			var returnTarget = "https://missionmedinstitute.com/member-dashboard/#dashboard";
			var allowedKeys = ["audience", "entry", "return_to", "final"];
			var queryKeys = [];
			url.searchParams.forEach(function (_queryValue, queryKey) {
				queryKeys.push(queryKey);
			});

			if (
				url.origin !== hqOrigin
				|| url.pathname !== "/api/auth/start"
				|| url.hash
				|| url.username
				|| url.password
				|| queryKeys.length !== allowedKeys.length
				|| queryKeys.some(function (queryKey) { return allowedKeys.indexOf(queryKey) === -1; })
				|| allowedKeys.some(function (queryKey) { return url.searchParams.getAll(queryKey).length !== 1; })
				|| url.searchParams.get("audience") !== "cam"
				|| url.searchParams.get("entry") !== "matrix"
				|| url.searchParams.get("return_to") !== returnTarget
			) {
				return "";
			}

			var finalUrl = new URL(url.searchParams.get("final"));
			var finalKeys = [];
			finalUrl.searchParams.forEach(function (_finalValue, finalKey) {
				finalKeys.push(finalKey);
			});
			if (
				finalUrl.origin !== hqOrigin
				|| finalUrl.pathname !== "/cam/"
				|| finalUrl.hash
				|| finalUrl.username
				|| finalUrl.password
				|| finalKeys.length !== 2
				|| finalUrl.searchParams.getAll("entry").length !== 1
				|| finalUrl.searchParams.getAll("return_to").length !== 1
				|| finalKeys.some(function (finalKey) { return ["entry", "return_to"].indexOf(finalKey) === -1; })
				|| finalUrl.searchParams.get("entry") !== "matrix"
				|| finalUrl.searchParams.get("return_to") !== returnTarget
			) {
				return "";
			}

			return url.toString();
		} catch (error) {
			return "";
		}
	}

	function closeMatrixTemporaryLockOverlay() {
		var existing = document.getElementById("sos-matrix-temp-lock");
		if (existing) {
			existing.remove();
		}
	}

	function showMatrixTemporaryLockOverlay(route) {
		var label = matrixRouteLabel(route);
		var container = document.createElement("div");

		closeMatrixTemporaryLockOverlay();
		container.id = "sos-matrix-temp-lock";
		container.className = "sos-matrix-temp-lock";
		container.innerHTML = [
			'<div class="sos-matrix-temp-lock-backdrop" data-matrix-temp-lock-close="1"></div>',
			'<section class="sos-matrix-temp-lock-card" role="dialog" aria-modal="true" aria-labelledby="sos-matrix-temp-lock-title">',
			'<button class="sos-matrix-temp-lock-close" type="button" aria-label="Close" data-matrix-temp-lock-close="1">x</button>',
			'<span class="sos-matrix-temp-lock-kicker">Matrix module locked</span>',
			'<h2 id="sos-matrix-temp-lock-title">' + escapeHTML(label) + ' is temporarily locked.</h2>',
			'<p>Calendar, Scheduler, and My Profile are open while we finish the current Matrix app-mode stabilization pass.</p>',
			'<div class="sos-matrix-temp-lock-actions">',
			'<a class="sos-btn sos-btn-primary" href="#calendar">Open Calendar</a>',
			'<a class="sos-btn" href="#scheduler">Open Scheduler</a>',
			"</div>",
			"</section>"
		].join("");

		document.body.appendChild(container);
		container.querySelectorAll("[data-matrix-temp-lock-close]").forEach(function (node) {
			node.addEventListener("click", closeMatrixTemporaryLockOverlay);
		});
	}

	function showLockedRouteNotice(route) {
		if (isMatrixTemporarilyLocked(route)) {
			showMatrixTemporaryLockOverlay(route);
			return;
		}

		showFOMOOverlay();
	}

	function showFOMOOverlay() {
  if (document.getElementById('sos-fomo3-css')) return;

  /* ═══════ INLINE CSS (cache-resilient) ═══════ */
  var styleTag = document.createElement('style');
  styleTag.id = 'sos-fomo3-css';
  styleTag.textContent = '.sos-fomo3-backdrop{position:fixed;inset:0;z-index:999998;background:rgba(0,0,0,0.82);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;transition:opacity .4s ease}.sos-fomo3-backdrop.is-visible{opacity:1}.sos-fomo3-modal{position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;transform:translateY(24px) scale(0.97);transition:opacity .5s ease,transform .5s ease}.sos-fomo3-modal.is-visible{opacity:1;transform:translateY(0) scale(1)}.sos-fomo3-card{position:relative;width:100%;max-width:900px;max-height:90vh;overflow-y:auto;border-radius:16px;background:linear-gradient(170deg,#0a2540 0%,#0d3868 50%,#0a2540 100%);box-shadow:0 40px 120px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1)}.sos-fomo3-close{position:absolute;top:16px;right:16px;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#fff;font-size:18px;cursor:pointer;display:grid;place-items:center;transition:background .2s}.sos-fomo3-close:hover{background:rgba(255,255,255,0.2)}.sos-fomo3-hero{position:relative;height:200px;overflow:hidden;border-radius:16px 16px 0 0}.sos-fomo3-hero img{width:100%;height:100%;object-fit:cover}.sos-fomo3-hero-overlay{position:absolute;inset:0;background:linear-gradient(to top,#0a2540 0%,transparent 60%)}.sos-fomo3-badge{position:absolute;top:16px;left:16px;padding:6px 14px;border-radius:20px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase}.sos-fomo3-body{padding:32px 36px 28px}.sos-fomo3-title{font-family:var(--matrix-heading,Montserrat,sans-serif);font-size:28px;font-weight:800;color:#fff;margin:0 0 6px;line-height:1.2}.sos-fomo3-subtitle{font-size:15px;color:rgba(255,255,255,0.65);margin:0 0 24px;line-height:1.5}.sos-fomo3-tracker-section{margin-bottom:28px}.sos-fomo3-tracker-label{font-size:12px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px}.sos-fomo3-tracker-board{padding:16px;border:1px solid rgba(255,255,255,0.15);border-radius:8px;background:linear-gradient(180deg,#0b78a8,#0a5687);box-shadow:inset 0 0 0 2px rgba(255,255,255,0.06),0 16px 48px rgba(0,0,0,0.3)}.sos-fomo3-segment-bar{display:grid;grid-template-columns:repeat(4,1fr);overflow:hidden;border:2px solid rgba(255,255,255,0.6);border-radius:999px;background:#637689}.sos-fomo3-segment{position:relative;display:grid;min-height:52px;place-items:center;background:linear-gradient(180deg,#8ca0b2,#5d7285);clip-path:polygon(0 0,calc(100% - 12px) 0,100% 50%,calc(100% - 12px) 100%,0 100%,12px 50%);color:rgba(255,255,255,0.5);font-family:var(--matrix-heading,Montserrat,sans-serif);font-size:13px;font-weight:800;text-align:center;padding:4px 14px;cursor:pointer;transition:filter .2s}.sos-fomo3-segment:first-child{clip-path:polygon(0 0,calc(100% - 12px) 0,100% 50%,calc(100% - 12px) 100%,0 100%)}.sos-fomo3-segment:last-child{clip-path:polygon(0 0,100% 0,100% 100%,0 100%,12px 50%)}.sos-fomo3-segment:hover{filter:brightness(1.2)}.sos-fomo3-segment.is-locked{background:linear-gradient(180deg,#8ca0b2,#5d7285);color:rgba(255,255,255,0.5)}.sos-fomo3-programs{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px}.sos-fomo3-pcard{position:relative;border-radius:12px;overflow:hidden;height:140px;cursor:pointer;border:1px solid rgba(255,255,255,0.12);transition:transform .2s,box-shadow .2s}.sos-fomo3-pcard:hover{transform:translateY(-3px);box-shadow:0 12px 32px rgba(0,0,0,0.4)}.sos-fomo3-pcard img{width:100%;height:100%;object-fit:cover}.sos-fomo3-pcard-overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.2) 100%);display:flex;align-items:flex-end;padding:12px}.sos-fomo3-pcard-name{color:#fff;font-family:var(--matrix-heading,Montserrat,sans-serif);font-size:13px;font-weight:700;line-height:1.2}.sos-fomo3-testimonial{padding:20px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);margin-bottom:24px;min-height:80px;transition:opacity .4s ease}.sos-fomo3-tquote{font-size:14px;color:rgba(255,255,255,0.8);font-style:italic;line-height:1.5;margin:0 0 8px}.sos-fomo3-tauthor{font-size:12px;color:rgba(255,255,255,0.5);font-weight:600;margin:0}.sos-fomo3-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px;padding:16px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08)}.sos-fomo3-stat{text-align:center}.sos-fomo3-stat-val{font-family:var(--matrix-heading,Montserrat,sans-serif);font-size:22px;font-weight:800;color:#f59e0b}.sos-fomo3-stat-lbl{font-size:11px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.5px;margin-top:2px}.sos-fomo3-cta{display:block;width:100%;padding:16px;border:none;border-radius:10px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#0a2540;font-family:var(--matrix-heading,Montserrat,sans-serif);font-size:16px;font-weight:800;text-align:center;cursor:pointer;transition:transform .2s,box-shadow .2s;text-decoration:none}.sos-fomo3-cta:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(245,158,11,0.4)}.sos-fomo3-popup-overlay{position:fixed;inset:0;z-index:1000000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,0.85);backdrop-filter:blur(4px);opacity:0;transition:opacity .3s}.sos-fomo3-popup-overlay.is-visible{opacity:1}.sos-fomo3-popup{width:100%;max-width:520px;border-radius:14px;background:linear-gradient(170deg,#0d3868,#0a2540);border:1px solid rgba(255,255,255,0.12);box-shadow:0 32px 80px rgba(0,0,0,0.5);overflow:hidden;transform:scale(0.95);transition:transform .3s}.sos-fomo3-popup-overlay.is-visible .sos-fomo3-popup{transform:scale(1)}.sos-fomo3-popup-hero{height:180px;position:relative;overflow:hidden}.sos-fomo3-popup-hero img{width:100%;height:100%;object-fit:cover}.sos-fomo3-popup-hero-grad{position:absolute;inset:0;background:linear-gradient(to top,#0a2540,transparent 60%)}.sos-fomo3-popup-body{padding:24px 28px 28px}.sos-fomo3-popup-title{font-family:var(--matrix-heading,Montserrat,sans-serif);font-size:22px;font-weight:800;color:#fff;margin:0 0 8px}.sos-fomo3-popup-desc{font-size:14px;color:rgba(255,255,255,0.7);line-height:1.6;margin:0 0 20px}.sos-fomo3-popup-btns{display:flex;gap:12px}.sos-fomo3-popup-btn{flex:1;padding:12px 16px;border-radius:8px;font-family:var(--matrix-heading,Montserrat,sans-serif);font-size:13px;font-weight:700;text-align:center;cursor:pointer;border:none;transition:transform .2s,background .2s;text-decoration:none}.sos-fomo3-popup-btn.back{background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2)}.sos-fomo3-popup-btn.back:hover{background:rgba(255,255,255,0.15)}.sos-fomo3-popup-btn.go{background:linear-gradient(135deg,#f59e0b,#d97706);color:#0a2540}.sos-fomo3-popup-btn.go:hover{transform:translateY(-1px)}@media(max-width:700px){.sos-fomo3-programs{grid-template-columns:repeat(2,1fr)}.sos-fomo3-segment-bar{grid-template-columns:repeat(2,1fr)}.sos-fomo3-stats{grid-template-columns:1fr}.sos-fomo3-card{max-width:100%;border-radius:12px}.sos-fomo3-hero{height:140px}.sos-fomo3-body{padding:20px 18px}.sos-fomo3-popup-btns{flex-direction:column}}';
  document.head.appendChild(styleTag);

  /* ═══════ DATA ═══════ */
  var programs = [
    {key:'mr', name:'Mission Residency', tagline:'Full-spectrum residency match preparation with 1-on-1 mentorship, mock interviews, and strategic application building.', img:'/wp-content/uploads/2026/03/mission-residency-run.webp', url:'/mission-residency/', color:'#31c46f'},
    {key:'ep', name:'ExamPrep', tagline:'Live drill sessions, structured USMLE review, and performance analytics to crush your boards with confidence.', img:'/wp-content/uploads/2026/01/Dr-J-ExamPrep-Hero-Section.png', url:'/examprep/', color:'#3b82f6'},
    {key:'cl', name:'Clinicals', tagline:'Clinical rotations guidance, evaluations strategy, and USCE optimization for IMGs navigating the US system.', img:'/wp-content/uploads/2026/05/medical-team-collaborating-on-anatomy-study-in-hos-2026-03-24-05-03-34-utc-scaled.jpg', url:'/clinicals/', color:'#8b5cf6'},
    {key:'arena', name:'The Arena', tagline:'Competitive prep environment with live group drills, leaderboards, and peer-driven accountability for exam mastery.', img:'/wp-content/uploads/2026/04/bg_missionmed_arena_v2_blue._assets-scaled.png', url:'/arena/', color:'#ef4444'}
  ];

  var testimonials = [
    {quote:'Coming up to you was one of the best decisions in my life. I just probably saved a year or two in my life.', author:'Maisha, Matched Resident'},
    {quote:'It is a beautiful experience. That would be the best gift you can give to yourself. It is not only for residency, it is forever.', author:'Yamina, Matched Resident'},
    {quote:'You will feel the difference after doing the classes in your day-to-day life, in everything you do, in everything you talk about.', author:'Kriti, MissionMed Student'},
    {quote:'There are no words to express this feeling right now. It is like having your baby for the first time.', author:'Sudha, Matched Resident'}
  ];

  var tIdx = Math.floor(Math.random() * testimonials.length);
  var t = testimonials[tIdx];

  var trackerPhases = ['Mission Residency','ExamPrep','Clinicals','MATCH DAY'];

  /* ═══════ BUILD HTML ═══════ */
  var segmentsHTML = trackerPhases.map(function(ph, idx) {
    var pKey = idx === 0 ? 'mr' : idx === 1 ? 'ep' : idx === 2 ? 'cl' : 'arena';
    return '<div class="sos-fomo3-segment is-locked" data-division="' + pKey + '">' + ph + '</div>';
  }).join('');

  var cardsHTML = programs.map(function(p) {
    return '<div class="sos-fomo3-pcard" data-division="' + p.key + '"><img src="' + p.img + '" alt="' + p.name + '" loading="lazy"><div class="sos-fomo3-pcard-overlay"><span class="sos-fomo3-pcard-name">' + p.name + '</span></div></div>';
  }).join('');

  var html = '<div class="sos-fomo3-backdrop" id="fomo3-backdrop"></div>'
    + '<div class="sos-fomo3-modal" id="fomo3-modal">'
    + '<div class="sos-fomo3-card">'
    + '<button class="sos-fomo3-close" id="fomo3-close">&times;</button>'
    + '<div class="sos-fomo3-hero"><img src="/wp-content/uploads/2026/03/mission-residency-run.webp" alt="MissionMed"><div class="sos-fomo3-hero-overlay"></div><div class="sos-fomo3-badge">Limited Access</div></div>'
    + '<div class="sos-fomo3-body">'
    + '<h2 class="sos-fomo3-title">Your Journey Starts Here</h2>'
    + '<p class="sos-fomo3-subtitle">Unlock the full MissionMed Matrix and join thousands of students who matched into their dream residency programs.</p>'
    + '<div class="sos-fomo3-tracker-section"><div class="sos-fomo3-tracker-label">Your Matrix Journey</div><div class="sos-fomo3-tracker-board"><div class="sos-fomo3-segment-bar">' + segmentsHTML + '</div></div></div>'
    + '<div class="sos-fomo3-programs">' + cardsHTML + '</div>'
    + '<div class="sos-fomo3-testimonial" id="fomo3-testimonial"><p class="sos-fomo3-tquote">"' + t.quote + '"</p><p class="sos-fomo3-tauthor">' + t.author + '</p></div>'
    + '<div class="sos-fomo3-stats"><div class="sos-fomo3-stat"><div class="sos-fomo3-stat-val">89.1%</div><div class="sos-fomo3-stat-lbl">Match Rate</div></div><div class="sos-fomo3-stat"><div class="sos-fomo3-stat-val">3,000+</div><div class="sos-fomo3-stat-lbl">Students Matched</div></div><div class="sos-fomo3-stat"><div class="sos-fomo3-stat-val">17+</div><div class="sos-fomo3-stat-lbl">Years Experience</div></div></div>'
    + '<a href="/" class="sos-fomo3-cta">Explore Programs</a>'
    + '</div></div></div>';

  /* ═══════ INJECT ═══════ */
  var container = document.createElement('div');
  container.id = 'sos-fomo3-root';
  container.innerHTML = html;
  document.body.appendChild(container);

  /* ═══════ ANIMATE IN ═══════ */
  requestAnimationFrame(function() {
    setTimeout(function() {
      document.getElementById('fomo3-backdrop').classList.add('is-visible');
      document.getElementById('fomo3-modal').classList.add('is-visible');
    }, 50);
  });

  /* ═══════ TESTIMONIAL ROTATION ═══════ */
  var rotateInterval = setInterval(function() {
    tIdx = (tIdx + 1) % testimonials.length;
    var el = document.getElementById('fomo3-testimonial');
    if (!el) { clearInterval(rotateInterval); return; }
    el.style.opacity = '0';
    setTimeout(function() {
      var nt = testimonials[tIdx];
      el.querySelector('.sos-fomo3-tquote').textContent = '"' + nt.quote + '"';
      el.querySelector('.sos-fomo3-tauthor').textContent = nt.author;
      el.style.opacity = '1';
    }, 400);
  }, 6000);

  /* ═══════ DIVISION POPUP ═══════ */
  function showDivisionPopup(divKey) {
    var prog = null;
    for (var pi = 0; pi < programs.length; pi++) {
      if (programs[pi].key === divKey) { prog = programs[pi]; break; }
    }
    if (!prog) return;

    var popupHTML = '<div class="sos-fomo3-popup-overlay" id="fomo3-popup-overlay">'
      + '<div class="sos-fomo3-popup">'
      + '<div class="sos-fomo3-popup-hero"><img src="' + prog.img + '" alt="' + prog.name + '"><div class="sos-fomo3-popup-hero-grad"></div></div>'
      + '<div class="sos-fomo3-popup-body">'
      + '<h3 class="sos-fomo3-popup-title">' + prog.name + '</h3>'
      + '<p class="sos-fomo3-popup-desc">' + prog.tagline + '</p>'
      + '<div class="sos-fomo3-popup-btns">'
      + '<button class="sos-fomo3-popup-btn back" id="fomo3-popup-back">Back to Dashboard</button>'
      + '<a href="' + prog.url + '" class="sos-fomo3-popup-btn go">Visit ' + prog.name + '</a>'
      + '</div></div></div></div>';

    var popupContainer = document.createElement('div');
    popupContainer.id = 'fomo3-popup-container';
    popupContainer.innerHTML = popupHTML;
    document.body.appendChild(popupContainer);

    setTimeout(function() {
      var overlay = document.getElementById('fomo3-popup-overlay');
      if (overlay) overlay.classList.add('is-visible');
    }, 30);

    document.getElementById('fomo3-popup-back').addEventListener('click', function() {
      closeDivisionPopup();
    });
    document.getElementById('fomo3-popup-overlay').addEventListener('click', function(e) {
      if (e.target === this) closeDivisionPopup();
    });
  }

  function closeDivisionPopup() {
    var overlay = document.getElementById('fomo3-popup-overlay');
    if (overlay) {
      overlay.classList.remove('is-visible');
      setTimeout(function() {
        var pc = document.getElementById('fomo3-popup-container');
        if (pc) pc.remove();
      }, 300);
    }
  }

  /* ═══════ EVENT HANDLERS ═══════ */
  /* Program cards click -> popup */
  container.querySelectorAll('.sos-fomo3-pcard').forEach(function(card) {
    card.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      showDivisionPopup(this.getAttribute('data-division'));
    });
  });

  /* Tracker segments click -> popup */
  container.querySelectorAll('.sos-fomo3-segment').forEach(function(seg) {
    seg.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      var divKey = this.getAttribute('data-division');
      if (divKey) showDivisionPopup(divKey);
    });
  });

  /* Close overlay */
  function closeFOMO() {
    clearInterval(rotateInterval);
    document.getElementById('fomo3-backdrop').classList.remove('is-visible');
    document.getElementById('fomo3-modal').classList.remove('is-visible');
    setTimeout(function() {
      var root = document.getElementById('sos-fomo3-root');
      if (root) root.remove();
      var css = document.getElementById('sos-fomo3-css');
      if (css) css.remove();
    }, 500);
  }

  document.getElementById('fomo3-close').addEventListener('click', closeFOMO);
  document.getElementById('fomo3-backdrop').addEventListener('click', closeFOMO);
}

	function showDivisionPopup(divName, parentOverlay) {
		var d = {
			"Mission Residency": {
				icon: "MR", color: "#c8a84e", url: "/mission-residency/",
				features: ["1-on-1 Interview Coaching", "LOR Writing Strategy", "Rank List Optimization", "Personal Statement Review", "Match Strategy Sessions", "Application Review", "Mock Interviews"],
				quote: { text: "This was purely the skills I learned from you. I was only able to really use up that chance because of you.", name: "Bonnie", detail: "Matched OBGYN, 2026" },
				pitch: "The most comprehensive residency match mentorship program for IMGs. Every tool, every strategy, every edge you need."
			},
			"ExamPrep": {
				icon: "EP", color: "#4ea0c8", url: "/examprep/",
				features: ["Adaptive Question Drills", "Performance Analytics", "Score Tracking", "Arena Practice System", "Study Schedule Builder", "Weak Area Targeting", "Progress Reports"],
				quote: { text: "You are the keys for the car, to be honest.", name: "Deep", detail: "Matched 2024" },
				pitch: "USMLE-focused study system built for IMGs. Adaptive drills, real-time analytics, and Arena access to sharpen your edge."
			},
			"Clinicals": {
				icon: "CL", color: "#4ec870", url: "/clinicals/",
				features: ["Clinical Placement Coordination", "Compliance Tracking", "Site Scheduling", "Document Management", "Onboarding Support", "HIPAA Training", "Supervisor Matching"],
				quote: { text: "They never took any IMGs. I was the only one interviewing that day, and I felt like I was some celebrity.", name: "Naiya", detail: "Matched 1st Choice, 2023" },
				pitch: "USCE clinical placement with full compliance tracking, scheduling, and onboarding. The clinical experience programs want to see."
			}
		};

		var info = d[divName];
		if (!info) return;

		var existingPopup = document.querySelector(".sos-fomo2-divpopup");
		if (existingPopup) existingPopup.remove();

		var featureList = info.features.map(function(f) {
			return '<li class="sos-fomo2-div-feature"><svg viewBox="0 0 24 24" fill="none" stroke="' + info.color + '" stroke-width="2.5" width="16" height="16"><path d="M20 6L9 17l-5-5"/></svg>' + escapeHTML(f) + '</li>';
		}).join("");

		var popupHtml = [
			'<div class="sos-fomo2-divpopup">',
			'<div class="sos-fomo2-divpopup-card">',
			'<button class="sos-fomo2-divpopup-close">&times;</button>',
			'<div class="sos-fomo2-divpopup-header" style="border-color:' + info.color + '">',
			'<div class="sos-fomo2-divpopup-icon" style="background:' + info.color + '">' + escapeHTML(info.icon) + '</div>',
			'<h3 class="sos-fomo2-divpopup-name">' + escapeHTML(divName) + '</h3>',
			'</div>',
			'<p class="sos-fomo2-divpopup-pitch">' + escapeHTML(info.pitch) + '</p>',
			'<ul class="sos-fomo2-div-features">' + featureList + '</ul>',
			'<div class="sos-fomo2-divpopup-quote">',
			'<p>&ldquo;' + escapeHTML(info.quote.text) + '&rdquo;</p>',
			'<span>' + escapeHTML(info.quote.name) + ' &middot; ' + escapeHTML(info.quote.detail) + '</span>',
			'</div>',
			'<a class="sos-fomo2-divpopup-btn" href="' + escapeAttr(info.url) + '" target="_blank" rel="noopener">Learn More About ' + escapeHTML(divName) + ' &rarr;</a>',
			'</div>',
			'</div>'
		].join("");

		parentOverlay.querySelector(".sos-fomo2-modal").insertAdjacentHTML("beforeend", popupHtml);
		var popup = parentOverlay.querySelector(".sos-fomo2-divpopup");
		popup.querySelector(".sos-fomo2-divpopup-close").addEventListener("click", function() { popup.remove(); });
		popup.addEventListener("click", function(e) { if (e.target === popup) popup.remove(); });
		setTimeout(function() { popup.classList.add("sos-fomo2-divpopup-visible"); }, 30);
	}

	function normalizeRuntimeV2Config(config) {
		config = config || {};
		return {
			enabled: config.enabled === true || config.enabled === "1" || config.enabled === 1,
			flag: config.flag || "mmed_matrix_runtime_v2",
			assets: config.assets || {}
		};
	}

	function createMatrixRuntime() {
		var config = app.runtime_v2 || {};
		var runtime = {
			enabled: !!config.enabled,
			flag: config.flag || "mmed_matrix_runtime_v2",
			assetPromises: {},
			modules: {},
			current: null,
			controller: null,
			mountToken: 0,
			originalRenderers: {},
			metrics: {
				flag: config.flag || "mmed_matrix_runtime_v2",
				enabled: !!config.enabled,
				routes: {},
				assets: {}
			}
		};

		runtime.mark = function (route, name, data) {
			var key = String(route || "shell");
			var entry = {
				name: name,
				at: Math.round(performance.now()),
				data: data || {}
			};

			if (!runtime.metrics.routes[key]) {
				runtime.metrics.routes[key] = [];
			}

			runtime.metrics.routes[key].push(entry);

			if (window.performance && typeof window.performance.mark === "function") {
				try {
					window.performance.mark("matrix-runtime-v2:" + key + ":" + name);
				} catch (error) {
					// Performance markers are diagnostic only.
				}
			}
		};

		runtime.register = function (module) {
			if (!module || !module.route) {
				return;
			}

			runtime.modules[module.route] = module;
		};

		runtime.navigate = function (route) {
			var module = runtime.modules[route] || runtime.modules.dashboard;
			var token = ++runtime.mountToken;
			var previous = runtime.current;
			var controller = typeof AbortController !== "undefined" ? new AbortController() : null;

			if (!module) {
				app.render.page(route);
				return;
			}

			if (app.appMode) {
				var appModeName = MATRIX_APP_MODE_ROUTE_BY_NAME[module.route] || "";
				if (appModeName && typeof app.appMode.activate === "function") {
					app.appMode.activate(appModeName);
				} else if (typeof app.appMode.deactivateUnless === "function") {
					app.appMode.deactivateUnless(module.route);
				}
			}

			if (previous && previous.route === module.route && previous.mounted) {
				runtime.mark(module.route, "duplicate_mount_prevented");
				return;
			}

			if (runtime.controller && typeof runtime.controller.abort === "function") {
				runtime.controller.abort();
			}

			runtime.controller = controller;

			if (previous && previous.module && typeof previous.module.unmount === "function") {
				try {
					previous.module.unmount(buildRuntimeContext(runtime, previous.module, token, controller));
					runtime.mark(previous.route, "unmount");
				} catch (error) {
					runtime.mark(previous.route, "unmount_error", { message: error.message || String(error) });
				}
			}

			runtime.current = {
				route: module.route,
				module: module,
				mounted: false
			};

			renderRuntimeSkeleton(module);
			runtime.mark(module.route, "shell_visible");

			Promise.resolve()
				.then(function () {
					runtime.mark(module.route, "load_start");
					return module.load ? module.load(buildRuntimeContext(runtime, module, token, controller)) : null;
				})
				.then(function () {
					if (token !== runtime.mountToken || (controller && controller.signal.aborted)) {
						runtime.mark(module.route, "mount_skipped");
						return;
					}

					runtime.mark(module.route, "mount_start");
					return module.mount(buildRuntimeContext(runtime, module, token, controller));
				})
				.then(function () {
					if (token !== runtime.mountToken || (controller && controller.signal.aborted)) {
						return;
					}

					runtime.current.mounted = true;
					runtime.mark(module.route, "usable");
				})
				.catch(function (error) {
					if (controller && controller.signal.aborted) {
						return;
					}

					runtime.mark(module.route, "error", { message: error.message || String(error) });
					renderRuntimeError(module, error);
				});
		};

		return runtime;
	}

	function buildRuntimeContext(runtime, module, token, controller) {
		return {
			app: app,
			api: app.api,
			refs: refs,
			route: module.route,
			module: module,
			runtime: runtime,
			signal: controller ? controller.signal : null,
			token: token,
			auth: {
				profile: app.state.profile || {},
				access: accessData,
				tier: accessTier,
				isEnrolled: isEnrolled
			},
			mark: function (name, data) {
				runtime.mark(module.route, name, data);
			}
		};
	}

	function renderRuntimeSkeleton(module) {
		if (!refs.content) {
			return;
		}

		if (module.route === "calendar") {
			refs.content.innerHTML = [
				'<section class="sos-page sos-runtime-v2-page sos-calendar-app-loader" data-runtime-route="calendar">',
				'<div class="sos-calendar-loader-shell">',
				'<div class="sos-calendar-loader-header">',
				'<div class="sos-calendar-loader-brand"><span class="sos-calendar-loader-mark">M</span><strong>MATRIX <span>Calendar</span></strong></div>',
				'<div class="sos-calendar-loader-tabs"><span>Month</span><span>Week</span><span>Day</span><span>Agenda</span></div>',
				'</div>',
				'<div class="sos-calendar-loader-track"></div>',
				'<div class="sos-calendar-loader-grid" aria-label="Loading Calendar App Mode">',
				'<span></span><span></span><span></span><span></span><span></span><span></span><span></span>',
				'</div>',
				'<p>Loading Matrix Calendar...</p>',
				'</div>',
				"</section>"
			].join("");
			return;
		}

			if (module.route === "scheduler") {
				refs.content.innerHTML = [
					'<section class="sos-page sos-runtime-v2-page sos-scheduler-app-loader" data-runtime-route="scheduler">',
				'<div class="sos-scheduler-loader-shell">',
				'<div class="sos-scheduler-loader-header">',
				'<div class="sos-scheduler-loader-brand"><span class="sos-scheduler-loader-mark">Sc</span><strong>MATRIX <span>Scheduler</span></strong></div>',
				'<div class="sos-scheduler-loader-steps"><span>Details</span><span>Time</span><span>Review</span></div>',
				'</div>',
				'<div class="sos-scheduler-loader-track"><span></span><span></span><span></span></div>',
				'<div class="sos-scheduler-loader-grid" aria-label="Loading Scheduler App Mode">',
				'<span></span><span></span><span></span><span></span><span></span>',
				'<span></span><span></span><span></span><span></span><span></span>',
				'</div>',
				'<p>Loading Matrix Scheduler...</p>',
				'</div>',
				"</section>"
			].join("");
				return;
			}

			if (module.route === "filevault") {
				refs.content.innerHTML = [
					'<section class="sos-page sos-runtime-v2-page sos-filevault-app-loader" data-runtime-route="filevault">',
					'<div class="sos-filevault-loader-shell">',
					'<div class="sos-filevault-loader-header">',
					'<div class="sos-filevault-loader-brand"><span class="sos-filevault-loader-mark">FV</span><strong>MATRIX <span>File Vault</span></strong></div>',
					'<div class="sos-filevault-loader-steps"><span>Folders</span><span>Files</span><span>Preview</span></div>',
					"</div>",
					'<div class="sos-filevault-loader-track"><span></span><span></span><span></span></div>',
					'<div class="sos-filevault-loader-grid" aria-label="Loading File Vault App Mode">',
					"<span></span><span></span><span></span><span></span><span></span><span></span>",
					"</div>",
					"<p>Loading Matrix File Vault...</p>",
					"</div>",
					"</section>"
				].join("");
				return;
			}

			refs.content.innerHTML = [
				'<section class="sos-page sos-runtime-v2-page" data-runtime-route="' + escapeAttr(module.route) + '">',
			app.components.pageHeader(module.section || "Matrix", module.label || "Matrix", module.emptyState || ""),
			app.components.loading(module.loadingLabel || "Loading " + (module.label || "module") + "..."),
			"</section>"
		].join("");
	}

	function renderRuntimeError(module, error) {
		if (!refs.content) {
			return;
		}

		refs.content.innerHTML = [
			'<section class="sos-page sos-runtime-v2-page">',
			app.components.pageHeader(module.section || "Matrix", module.label || "Matrix", module.errorState || "This Matrix module could not finish loading."),
			app.components.empty("Module unavailable", error && error.message ? error.message : "Please refresh and try again."),
			"</section>"
		].join("");
	}

	function runtimeAsset(name) {
		var asset = app.runtime_v2 && app.runtime_v2.assets ? app.runtime_v2.assets[name] : null;
		if (!asset || asset.exists === false || !asset.url) {
			return null;
		}

		return asset;
	}

	function runtimeAssetUrl(asset) {
		var url = asset.url;
		if (asset.version) {
			url += (url.indexOf("?") === -1 ? "?" : "&") + "ver=" + encodeURIComponent(asset.version);
		}
		return url;
	}

	function loadRuntimeStyle(runtime, key, asset) {
		if (!asset) {
			return Promise.resolve();
		}

		var id = "mmed-runtime-v2-css-" + key;
		if (document.getElementById(id)) {
			return Promise.resolve();
		}

		return new Promise(function (resolve, reject) {
			var link = document.createElement("link");
			link.id = id;
			link.rel = "stylesheet";
			link.href = runtimeAssetUrl(asset);
			link.setAttribute("data-mmed-runtime-v2-asset", key);
			link.onload = function () {
				runtime.metrics.assets[key] = "loaded";
				resolve();
			};
			link.onerror = function () {
				reject(new Error("Failed to load " + key));
			};
			document.head.appendChild(link);
		});
	}

	function loadRuntimeScript(runtime, key, asset, signal) {
		if (!asset) {
			return Promise.resolve();
		}

		if (runtime.assetPromises[key]) {
			return runtime.assetPromises[key];
		}

		var existing = document.querySelector('script[data-mmed-runtime-v2-asset="' + key + '"]');
		if (existing) {
			runtime.assetPromises[key] = Promise.resolve();
			return runtime.assetPromises[key];
		}

		runtime.assetPromises[key] = new Promise(function (resolve, reject) {
			var script = document.createElement("script");
			var done = false;

			function cleanup() {
				if (signal && typeof signal.removeEventListener === "function") {
					signal.removeEventListener("abort", onAbort);
				}
			}

			function finish(callback) {
				if (done) {
					return;
				}
				done = true;
				cleanup();
				callback();
			}

			function onAbort() {
				if (script.parentNode) {
					script.parentNode.removeChild(script);
				}
				finish(function () {
					reject(new Error("Aborted " + key));
				});
			}

			script.async = false;
			script.src = runtimeAssetUrl(asset);
			script.setAttribute("data-mmed-runtime-v2-asset", key);
			script.onload = function () {
				runtime.metrics.assets[key] = "loaded";
				finish(resolve);
			};
			script.onerror = function () {
				finish(function () {
					reject(new Error("Failed to load " + key));
				});
			};

			if (signal && typeof signal.addEventListener === "function") {
				if (signal.aborted) {
					onAbort();
					return;
				}
				signal.addEventListener("abort", onAbort, { once: true });
			}

			document.body.appendChild(script);
		});

		return runtime.assetPromises[key];
	}

	function loadRuntimeAssets(context, assets) {
		return assets.reduce(function (promise, item) {
			return promise.then(function () {
				var asset = runtimeAsset(item.name);
				if (!asset) {
					return null;
				}

				if (item.type === "style") {
					return loadRuntimeStyle(context.runtime, item.name, asset);
				}

				return loadRuntimeScript(context.runtime, item.name, asset, context.signal);
			});
		}, Promise.resolve());
	}

	function waitForRuntime(check, timeoutMs) {
		var started = performance.now();
		timeoutMs = timeoutMs || 6000;

		return new Promise(function (resolve, reject) {
			(function poll() {
				if (check()) {
					resolve();
					return;
				}

				if (performance.now() - started > timeoutMs) {
					reject(new Error("Timed out waiting for Matrix module runtime"));
					return;
				}

				window.setTimeout(poll, 50);
			}());
		});
	}

	function mountLegacyRuntimeRoute(route) {
		return function () {
			var renderer = route === "filevault" ? app.render.fileVault : app.render[route];
			if (typeof renderer === "function") {
				renderer.call(app.render);
			} else {
				app.render.dashboard();
			}
		};
	}

	function unmountSchedulerRuntime() {
		if (window.MMEDScheduler && typeof window.MMEDScheduler.unmount === "function") {
			window.MMEDScheduler.unmount();
		}
	}

	function loadSchedulerRuntime(context) {
		return loadRuntimeAssets(context, [
			{ name: "scheduler_js", type: "script" }
		]).then(function () {
			return waitForRuntime(function () {
				return window.MMEDScheduler && typeof window.MMEDScheduler.mount === "function";
			}, 8000);
		});
	}

		function mountSchedulerRuntime() {
			refs.content.innerHTML = [
				'<section class="sos-page sos-runtime-v2-page sos-scheduler-app-mode" data-runtime-route="scheduler">',
			'<header class="sos-scheduler-app-topbar">',
			'<a class="sos-scheduler-dashboard-return" href="#dashboard" aria-label="Return to Matrix Dashboard">',
			'<span class="sos-scheduler-dashboard-return-icon" aria-hidden="true">D</span>',
			'<span>Return to Matrix Dashboard</span>',
			"</a>",
			'<div class="sos-scheduler-app-heading">',
			"<span>Planning</span>",
			"<strong>Matrix Scheduler</strong>",
			"</div>",
			'<span class="sos-scheduler-app-zone">Eastern / New York</span>',
			"</header>",
			'<div class="sos-scheduler-app-canvas">',
			'<div id="mmed-scheduler-native-root" class="mmed-scheduler-app-root">',
			'<div class="sos-scheduler-native-boot">',
			'<div class="sos-scheduler-native-boot-kicker">Loading appointment options</div>',
			'<div class="sos-scheduler-native-boot-title">Checking scheduling access</div>',
			'<div class="sos-scheduler-native-boot-bar"><span></span></div>',
			"</div>",
			"</div>",
			"</div>",
			"</section>"
		].join("");

		if (!window.MMEDScheduler || typeof window.MMEDScheduler.mount !== "function") {
			throw new Error("Scheduler runtime is not available.");
		}

			return window.MMEDScheduler.mount("#mmed-scheduler-native-root", { apiBase: "/api/scheduler" });
		}

		function loadFileVaultRuntime(context) {
			return loadRuntimeAssets(context, assetsForLegacyRoute("filevault")).then(function () {
				return waitForRuntime(function () {
					return window.MMED_FILE_VAULT_V1 && typeof window.MMED_FILE_VAULT_V1.render === "function";
				}, 8000);
			});
		}

		function mountFileVaultRuntime() {
			if (window.MMED_FILE_VAULT_V1 && typeof window.MMED_FILE_VAULT_V1.render === "function") {
				window.MMED_FILE_VAULT_V1.render();
				return;
			}

			throw new Error("File Vault 006D runtime is unavailable.");
		}

		function unmountFileVaultRuntime() {
			[document.documentElement, document.body, document.getElementById("student-os-root")].forEach(function (node) {
				if (!node || !node.classList) {
					return;
				}
				node.classList.remove("mmed-filevault-fullscreen", "matrix-app-mode-filevault");
			});

			if (refs.content) {
				refs.content.innerHTML = "";
			}
		}

		function calendarRuntimeAssets() {
			var assets = [
				{ name: "calendar_css", type: "style" },
			{ name: "calendar_js", type: "script" },
			{ name: "live_session_css", type: "style" },
			{ name: "live_session_js", type: "script" }
		];

		if (app.feature_flags && app.feature_flags.webex_embedded_widget) {
			assets.splice(2, 0, { name: "webex_widget_js", type: "script" });
		}

		if (app.feature_flags && app.feature_flags.office_hours_queue) {
			assets.push({ name: "office_hours_js", type: "script" });
			assets.push({ name: "office_hours_css", type: "style" });
		}

		return assets;
	}

	function loadCalendarRuntime(context) {
		var previousRenderer = context.runtime.originalRenderers.calendar || app.render.calendar;
		context.runtime.originalRenderers.calendar = previousRenderer;

		return loadRuntimeAssets(context, calendarRuntimeAssets()).then(function () {
			return waitForRuntime(function () {
				return (window.MMEDCalendarV4 && typeof window.MMEDCalendarV4.mount === "function") || app.render.calendar !== previousRenderer;
			}, 8000);
		});
	}

	function mountCalendarRuntime(context) {
		if (window.MMEDCalendarV4 && typeof window.MMEDCalendarV4.mount === "function") {
			window.MMEDCalendarV4.mount(app);
			return;
		}

		if (
			app.render.calendar &&
			context.runtime &&
			context.runtime.originalRenderers &&
			app.render.calendar !== context.runtime.originalRenderers.calendar
		) {
			app.render.calendar.call(app.render);
			return;
		}

		context.mark("calendar_legacy_mount_blocked");
		throw new Error("Calendar App Mode runtime is unavailable.");
	}

	function unmountCalendarRuntime() {
		if (window.MMEDCalendarV4 && typeof window.MMEDCalendarV4.unmount === "function") {
			window.MMEDCalendarV4.unmount();
			return;
		}

		if (refs.content) {
			refs.content.innerHTML = "";
		}
	}

	function storyForgeRuntimeAssets() {
		return [
			{ name: "storyforge_css", type: "style" },
			{ name: "storyforge_js", type: "script" }
		];
	}

	function loadStoryForgeRuntime(context) {
		return loadRuntimeAssets(context, storyForgeRuntimeAssets()).then(function () {
			return waitForRuntime(function () {
				return window.MMEDStoryForge && typeof window.MMEDStoryForge.mount === "function";
			}, 8000);
		});
	}

	function mountStoryForgeRuntime(context) {
		if (window.MMEDStoryForge && typeof window.MMEDStoryForge.mount === "function") {
			return window.MMEDStoryForge.mount(context);
		}

		throw new Error("StoryForge runtime is unavailable.");
	}

	function unmountStoryForgeRuntime() {
		if (window.MMEDStoryForge && typeof window.MMEDStoryForge.unmount === "function") {
			window.MMEDStoryForge.unmount();
			return;
		}

		if (refs.content) {
			refs.content.innerHTML = "";
		}
	}

	function assetsForLegacyRoute(route) {
		if (route === "filevault") {
			return [
				{ name: "file_vault_css", type: "style" },
				{ name: "file_vault_js", type: "script" }
			];
		}

		if (route === "arena" && app.feature_flags && app.feature_flags.arena_live_battles) {
			return [
				{ name: "arena_battle_css", type: "style" },
				{ name: "arena_battle_js", type: "script" }
			];
		}

		if (route === "interview-prep" && app.feature_flags && app.feature_flags.interview_prep_rooms) {
			return [
				{ name: "interview_prep_css", type: "style" },
				{ name: "interview_prep_js", type: "script" }
			];
		}

		return [];
	}

	function buildRuntimeModules(runtime) {
		runtime.register({
			id: "dashboard",
			label: "Dashboard",
			route: "dashboard",
			icon: "D",
			section: "Command",
			authRequirement: "current_user",
			errorState: "Dashboard data could not be loaded.",
			emptyState: "",
			performanceBudget: { requests: 60, usableMs: 2000 },
			load: function () {
				return Promise.resolve();
			},
			mount: mountLegacyRuntimeRoute("dashboard"),
			unmount: function () {}
		});

		runtime.register({
			id: "scheduler",
			label: "Scheduler",
			route: "scheduler",
			icon: "Sc",
			section: "Planning",
			authRequirement: "current_user",
			errorState: "Scheduler could not be loaded.",
			emptyState: "No scheduler appointment types are available yet.",
			performanceBudget: { requests: 120, usableMs: 4000 },
			load: loadSchedulerRuntime,
			mount: mountSchedulerRuntime,
			unmount: unmountSchedulerRuntime
		});

			runtime.register({
				id: "calendar",
				label: "Calendar",
				route: "calendar",
			icon: "Cal",
			section: "Planning",
			authRequirement: "current_user",
			errorState: "Calendar could not be loaded.",
			emptyState: "No calendar events are available yet.",
			performanceBudget: { requests: 120, usableMs: 4000 },
			load: loadCalendarRuntime,
				mount: mountCalendarRuntime,
				unmount: unmountCalendarRuntime
			});

			runtime.register({
				id: "filevault",
				label: "File Vault",
				route: "filevault",
				icon: "Fv",
				section: "Documents",
				authRequirement: "current_user",
				errorState: "File Vault could not be loaded.",
				emptyState: "No File Vault documents are available yet.",
				performanceBudget: { requests: 100, usableMs: 4000 },
				load: loadFileVaultRuntime,
				mount: mountFileVaultRuntime,
				unmount: unmountFileVaultRuntime
			});

			runtime.register({
				id: "storyforge",
				label: "StoryForge",
				route: "storyforge",
				icon: "SF",
				section: "Match Prep",
				authRequirement: "current_user",
				errorState: "StoryForge could not be loaded.",
				emptyState: "StoryForge bootstrap data is not available yet.",
				performanceBudget: { requests: 80, usableMs: 3500 },
				load: loadStoryForgeRuntime,
				mount: mountStoryForgeRuntime,
				unmount: unmountStoryForgeRuntime
			});

			app.components.navItems().forEach(function (item) {
			var route = item.route;
			if (!route || runtime.modules[route]) {
				return;
			}

			runtime.register({
				id: route,
				label: item.label || route,
				route: route,
				icon: item.icon || "",
				section: item.section || "Matrix",
				authRequirement: "current_user",
				errorState: "This Matrix module could not be loaded.",
				emptyState: "",
				performanceBudget: { requests: 100, usableMs: 4000 },
				load: function (context) {
					return loadRuntimeAssets(context, assetsForLegacyRoute(route));
				},
				mount: mountLegacyRuntimeRoute(route),
				unmount: function () {}
			});
		});
	}

	app.runtime = createMatrixRuntime();
	buildRuntimeModules(app.runtime);
	window.MatrixRuntime = app.runtime;

	app.init = function () {
		refs.root = document.getElementById("student-os-root");

		if (!refs.root) {
			return;
		}

		refs.sidebar = document.getElementById("sos-sidebar");
		refs.content = document.getElementById("sos-content");

		if (!refs.sidebar || !refs.content) {
			return;
		}

		app.state.profile = app.profile || app.state.profile || {};
		app.state.stats = app.stats || app.state.stats || {};
		app.state.modules = Array.isArray(app.modules) ? app.modules : app.state.modules || [];
		app.api.init(refs.root);
		app.router.start();
	};

	window.MMED_OS = app;

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", app.init);
	} else {
		app.init();
	}
}());
