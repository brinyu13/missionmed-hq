(function () {
	"use strict";

	var app = window.MMED_OS || {};
	var refs = {};

	app.state = {
		profile: app.profile || {},
		stats: app.stats || {},
		modules: Array.isArray(app.modules) ? app.modules : [],
		route: "dashboard",
		statsLoaded: false,
		statsLoading: false,
		courses: null,
		orders: null,
		notifications: null,
		messages: null,
		files: null,
		fileCategory: "documents",
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

	app.api = {
		base: "/wp-json/mmed/v1",
		nonce: "",

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
			return this.request(endpoint, { method: "GET" }, params);
		},

		post: function (endpoint, body) {
			return this.request(endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body || {})
			});
		},

		put: function (endpoint, body) {
			return this.request(endpoint, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body || {})
			});
		},

		delete: function (endpoint) {
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

			app.state.route = route;
			app.render.sidebar();
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
				var label = module.label || module.name;

				if (!route || !label) {
					return;
				}

				items.push({
					route: String(route).replace(/^#/, ""),
					label: label,
					icon: module.icon || label.charAt(0),
					section: module.section || "Matrix",
					badge: module.badge
				});
			});

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
						var badge = item.badge ? '<span class="sos-nav-badge">' + escapeHTML(item.badge) + "</span>" : "";

						return [
							"<li>",
							'<a class="sos-nav-link' + active + '" href="#' + escapeAttr(item.route) + '">',
							'<span class="sos-nav-icon">' + escapeHTML(String(item.icon || "").slice(0, 2).toUpperCase()) + "</span>",
							"<span>" + escapeHTML(item.label) + "</span>",
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
				"</div>"
			].join("");
		},

		page: function (route) {
			var renderMap = {
				dashboard: this.dashboard,
				calendar: this.calendar,
				courses: this.courses,
				orders: this.orders,
				settings: this.settings,
				notifications: this.notifications,
				messages: this.messages,
				help: this.help,
				filevault: this.fileVault,
				study: this.study
			};

			(renderMap[route] || this.dashboard).call(this);
		},

		dashboard: function () {
			var profile = app.state.profile || {};
			var stats = app.state.stats || {};
			var taskTotal = getNumber(stats.tasks_total, profile.tasks && profile.tasks.total);
			var taskApproved = getNumber(stats.tasks_approved, profile.tasks && profile.tasks.approved);
			var matchReadiness = getNumber(stats.match_readiness, taskTotal ? Math.round((taskApproved / taskTotal) * 100) : 0);
			var activeCourses = getNumber(stats.active_courses, 0);
			var daysToNext = getNumber(stats.days_to_next_step, 0);
			var nextStep = stats.next_step_label || "No open step";
			var firstName = firstNameFrom(profile.display_name || "Student");

			refs.content.innerHTML = [
				'<section class="sos-page">',
				app.components.pageHeader("Student Dashboard", "Welcome back, " + firstName + ".", "Your Matrix dashboard is synced to your MissionMed account, courses, and Hub task progress."),
				'<div class="sos-grid sos-grid-stats">',
				app.components.statCard(matchReadiness + "%", "Match Readiness", "var(--green)", "Task completion ratio"),
				app.components.statCard(activeCourses, "Active Courses", "var(--blue2)", "LearnDash enrollments"),
				app.components.statCard(taskApproved + "/" + taskTotal, "Task Progress", "var(--gold2)", "Approved Hub tasks"),
				app.components.statCard(daysToNext, "Days to Next Step", "var(--orange2)", nextStep),
				"</div>",
				app.components.tracker(profile.phase),
				'<div class="sos-grid sos-grid-two">',
				'<div class="sos-card sos-card-pad">',
				'<div class="sos-panel-title">Current Focus</div>',
				'<h2 class="sos-panel-heading">' + escapeHTML(nextStep) + "</h2>",
				'<p class="sos-panel-copy">' + escapeHTML(taskTotal ? taskApproved + " of " + taskTotal + " assigned Hub tasks are approved." : "No assigned Hub tasks are available yet.") + "</p>",
				'<div class="sos-progress-line"><span>Approved</span><span>' + escapeHTML(matchReadiness + "%") + "</span></div>",
				'<div class="sos-progress"><div class="sos-progress-fill" style="width:' + clampPercent(matchReadiness) + '%"></div></div>',
				"</div>",
				'<div class="sos-card sos-card-pad">',
				'<div class="sos-panel-title">Learning</div>',
				'<h2 class="sos-panel-heading">' + escapeHTML(activeCourses + " active course" + (activeCourses === 1 ? "" : "s")) + "</h2>",
				'<p class="sos-panel-copy">' + escapeHTML(getNumber(stats.courses_in_progress, 0) + " course" + (getNumber(stats.courses_in_progress, 0) === 1 ? "" : "s") + " currently show progress.") + "</p>",
				"</div>",
				"</div>",
				"</section>"
			].join("");

			if (!app.state.statsLoaded && !app.state.statsLoading) {
				this.loadDashboardStats();
			}
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

		courses: function () {
			refs.content.innerHTML = '<section class="sos-page">' + app.components.pageHeader("Learning", "My Courses", "Real LearnDash enrollments, progress, and next lessons.") + app.components.loading("Loading courses...") + "</section>";

			app.api.get("/courses").then(function (data) {
				app.state.courses = data && Array.isArray(data.courses) ? data.courses : [];
				renderCourses();
			}).catch(showError);
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
			refs.content.innerHTML = '<section class="sos-page">' + app.components.pageHeader("Advisor Inbox", "Messages", "Advisor notes and task comments will gather here.") + app.components.loading("Loading messages...") + "</section>";

			app.api.get("/messages", { limit: 20 }).then(function (data) {
				app.state.messages = data && Array.isArray(data.messages) ? data.messages : [];
				renderMessages();
			}).catch(showError);
		},

		help: function () {
			var email = supportEmail();
			refs.content.innerHTML = [
				'<section class="sos-page">',
				app.components.pageHeader("Support", "Help", "Quick answers, advisor contact, and support routes."),
				'<div class="sos-grid sos-grid-two">',
				'<div class="sos-card sos-card-pad sos-help-card">',
				'<details open><summary>How do I know what to do next?</summary><p>Your Dashboard Current Focus card pulls from your live Hub task queue.</p></details>',
				'<details><summary>Where are my courses?</summary><p>Open My Courses to continue the next available LearnDash lesson.</p></details>',
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

			app.api.get("/files", { category: app.state.fileCategory }).then(function (data) {
				app.state.files = data || { files: [], counts: {}, storage_configured: false };
				renderFileVault();
			}).catch(showError);
		},

		study: function () {
			refs.content.innerHTML = '<section class="sos-page">' + app.components.pageHeader("Learning", "Study Schedule", "Daily study blocks backed by the Matrix calendar event engine.") + app.components.loading("Loading study schedule...") + "</section>";
			loadStudy();
		}
	};

	function renderCourses() {
		var courses = app.state.courses || [];

		refs.content.innerHTML = [
			'<section class="sos-page">',
			app.components.pageHeader("Learning", "My Courses", "Real LearnDash enrollments, progress, and next lessons."),
			courses.length ? '<div class="sos-course-grid">' + courses.map(courseCard).join("") + "</div>" : app.components.empty("No courses yet", "Your LearnDash enrollments will appear here as soon as they are connected."),
			"</section>"
		].join("");
	}

	function courseCard(course) {
		var progress = clampPercent(course.progress);
		var next = course.next_lesson || {};
		var url = next.url || course.url || "#";
		var status = progress >= 100 ? "Completed" : progress > 0 ? "Continue" : "Start Course";
		var glow = progress >= 100 ? " is-complete" : "";

		return [
			'<article class="sos-course-card sos-card' + glow + '">',
			'<div class="sos-course-top">',
			'<span class="sos-pill">' + escapeHTML(formatProgram(course.status || "course")) + "</span>",
			'<strong>' + escapeHTML(progress + "%") + "</strong>",
			"</div>",
			'<h2>' + escapeHTML(course.title || "Untitled Course") + "</h2>",
			'<p>' + escapeHTML(course.instructor ? "Instructor: " + course.instructor : "MissionMed course") + "</p>",
			'<div class="sos-chunky-progress"><div style="width:' + progress + '%"></div></div>',
			'<div class="sos-course-meta">',
			'<span>' + escapeHTML(getNumber(course.lessons_completed, 0) + "/" + getNumber(course.lessons_total, 0) + " lessons") + "</span>",
			'<span>' + escapeHTML(getNumber(course.quizzes_completed, 0) + "/" + getNumber(course.quizzes_total, 0) + " quizzes") + "</span>",
			"</div>",
			'<div class="sos-next-lesson">' + escapeHTML(next.title ? "Next: " + next.title : progress >= 100 ? "Course completed" : "Ready to begin") + "</div>",
			'<a class="sos-btn sos-btn-primary sos-btn-block" href="' + escapeAttr(url) + '">' + escapeHTML(status) + "</a>",
			"</article>"
		].join("");
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

	function renderMessages() {
		var items = app.state.messages || [];
		refs.content.innerHTML = [
			'<section class="sos-page">',
			app.components.pageHeader("Advisor Inbox", "Messages", "Advisor notes and task comments will gather here."),
			items.length ? '<div class="sos-inbox">' + items.map(messageItem).join("") + "</div>" : app.components.empty("No messages yet", "Advisor messages will appear here when comments are attached to your Hub tasks."),
			"</section>"
		].join("");
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
		var categories = [
			["documents", "Documents"],
			["medical_records", "Medical Records"],
			["letters", "Letters"],
			["certifications", "Certifications"],
			["other", "Other"]
		];

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
		return '<span class="sos-event-chip" data-event-id="' + escapeAttr(event.id) + '">' + escapeHTML(event.title || "Event") + '<span class="sos-event-resize" data-resize-event="' + escapeAttr(event.id) + '"></span></span>';
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
					'<article class="sos-mini-event">',
					'<strong>' + escapeHTML(event.title || "Event") + "</strong>",
					'<span>' + escapeHTML(event.all_day ? "All day" : timeRange(event.start_at, event.end_at)) + "</span>",
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
			end: dateKey(rangeEnd) + "T23:59:59"
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
		renderFileVault();

		queued.reduce(function (chain, upload) {
			return chain.then(function () {
				return uploadVaultFile(upload);
			});
		}, Promise.resolve()).then(function () {
			app.state.uploads = app.state.uploads.filter(function (upload) {
				return queued.indexOf(upload) === -1;
			});
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
