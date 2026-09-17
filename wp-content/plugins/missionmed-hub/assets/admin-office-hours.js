(function () {
	"use strict";

	var root = document.getElementById("mmed-office-hours-root");
	var config = window.mmedOfficeHoursAdmin || {};

	if (!root || !config.featureEnabled) {
		return;
	}

	var state = {
		groups: [],
		selectedGroupId: "",
		eventDate: today(),
		queue: [],
		stats: {},
		settings: {},
		loading: false,
		timer: null
	};

	function esc(value) {
		return String(value || "").replace(/[&<>"']/g, function (char) {
			return {
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				'"': "&quot;",
				"'": "&#039;"
			}[char];
		});
	}

	function attr(value) {
		return esc(value).replace(/`/g, "&#096;");
	}

	function today() {
		return new Date().toISOString().slice(0, 10);
	}

	function api(url, options) {
		options = options || {};
		options.credentials = "same-origin";
		options.headers = options.headers || {};
		options.headers["X-WP-Nonce"] = config.nonce || "";
		if (options.body && typeof options.body !== "string") {
			options.headers["Content-Type"] = "application/json";
			options.body = JSON.stringify(options.body);
		}

		return fetch(url, options).then(function (response) {
			return response.text().then(function (text) {
				var payload = text ? JSON.parse(text) : {};
				if (!response.ok) {
					throw new Error(payload.message || "Request failed.");
				}
				return payload;
			});
		});
	}

	function officeUrl(groupId, path) {
		return String(config.officeRestUrl || "").replace(/\/$/, "") + "/" + parseInt(groupId || 0, 10) + (path || "");
	}

	function sessionsUrl() {
		return String(config.sessionsRestUrl || "").replace(/\/$/, "");
	}

	function toast(message, type) {
		var tray = root.querySelector("[data-office-toast-tray]");
		if (!tray) return;
		var note = document.createElement("div");
		note.className = "mmed-office-toast is-" + (type || "success");
		note.textContent = message;
		tray.appendChild(note);
		window.setTimeout(function () {
			note.remove();
		}, 4200);
	}

	function formatLabel(value) {
		return String(value || "").replace(/_/g, " ").replace(/\b\w/g, function (letter) {
			return letter.toUpperCase();
		});
	}

	function render() {
		root.innerHTML = [
			'<section class="mmed-office-admin">',
			'<div class="mmed-office-admin-head">',
			'<div>',
			'<p class="mmed-session-eyebrow">Office Hours Queue</p>',
			"<h2>Queue Control</h2>",
			"<p>Manage student office-hours flow without exposing the private queue to students.</p>",
			"</div>",
			'<button type="button" class="button" data-office-refresh>Refresh</button>',
			"</div>",
			'<div class="mmed-office-toolbar">',
			'<label>Session Group<select data-office-group>' + renderGroupOptions() + "</select></label>",
			'<label>Event Date<input type="date" data-office-date value="' + attr(state.eventDate) + '"></label>',
			"</div>",
			'<div class="mmed-office-admin-grid">',
			renderStatsPanel(),
			renderQueuePanel(),
			"</div>",
			'<div class="mmed-office-toast-tray" data-office-toast-tray></div>',
			"</section>"
		].join("");
		bind();
	}

	function renderGroupOptions() {
		if (!state.groups.length) {
			return '<option value="">No office hours groups loaded</option>';
		}
		return state.groups.map(function (group) {
			var selected = String(group.id) === String(state.selectedGroupId) ? " selected" : "";
			return '<option value="' + attr(group.id) + '"' + selected + ">" + esc(group.group_name || group.group_slug) + " (" + esc(formatLabel(group.event_type)) + ")</option>";
		}).join("");
	}

	function renderStatsPanel() {
		var stats = state.stats || {};
		var settings = state.settings || {};
		var studentsSeen = stats.students_seen_today || stats.students_seen || 0;
		var averageWait = stats.average_wait || stats.average_wait_minutes || 0;
		return [
			'<aside class="mmed-office-panel">',
			'<div class="mmed-office-panel-head"><h3>Today</h3><span>' + esc(state.eventDate) + "</span></div>",
			'<div class="mmed-office-stat-grid">',
			statCard(stats.total_waiting || 0, "Waiting"),
			statCard(studentsSeen, "Seen"),
			statCard(averageWait, "Avg wait"),
			statCard(settings.slot_duration_minutes || 10, "Slot min"),
			"</div>",
			'<div class="mmed-office-actions">',
			'<button type="button" class="button button-primary" data-office-admit>Admit Next</button>',
			'<button type="button" class="button" data-office-complete>Complete Current</button>',
			"</div>",
			"</aside>"
		].join("");
	}

	function statCard(value, label) {
		return '<div class="mmed-office-stat"><strong>' + esc(value) + '</strong><span>' + esc(label) + "</span></div>";
	}

	function renderQueuePanel() {
		var rows = state.queue.map(function (entry) {
			var waitMinutes = entry.wait_minutes === undefined ? minutesSince(entry.joined_at) : entry.wait_minutes;
			return [
				'<tr class="is-' + attr(entry.status) + '">',
				"<td>#" + parseInt(entry.queue_position || 0, 10) + "</td>",
				"<td><strong>" + esc(entry.student_name || "Student") + '</strong><span class="mmed-session-sub">ID ' + parseInt(entry.user_id || 0, 10) + "</span></td>",
				"<td>" + esc(entry.question_preview || "") + "</td>",
				'<td><span class="mmed-office-status is-' + attr(entry.status) + '">' + esc(entry.status || "") + "</span></td>",
				"<td>" + parseInt(waitMinutes || 0, 10) + " min</td>",
				'<td>' + (entry.status === "waiting" ? '<button type="button" class="button button-link-delete" data-office-skip="' + attr(entry.id) + '">Skip</button>' : "") + "</td>",
				"</tr>"
			].join("");
		}).join("");

		return [
			'<main class="mmed-office-panel mmed-office-queue-panel">',
			'<div class="mmed-office-panel-head"><h3>Queue</h3><span>' + state.queue.length + " entries</span></div>",
			state.loading ? '<div class="mmed-session-loading"><span class="spinner is-active"></span> Loading queue...</div>' : "",
			'<table class="widefat striped mmed-office-table">',
			"<thead><tr><th>Pos</th><th>Student</th><th>Question preview</th><th>Status</th><th>Wait</th><th>Actions</th></tr></thead>",
			"<tbody>" + (rows || '<tr><td colspan="6">No queue entries for this date.</td></tr>') + "</tbody>",
			"</table>",
			"</main>"
		].join("");
	}

	function minutesSince(value) {
		if (!value) return 0;
		var date = new Date(String(value).replace(" ", "T"));
		if (isNaN(date.getTime())) return 0;
		return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
	}

	function bind() {
		var refresh = root.querySelector("[data-office-refresh]");
		var group = root.querySelector("[data-office-group]");
		var date = root.querySelector("[data-office-date]");
		var admit = root.querySelector("[data-office-admit]");
		var complete = root.querySelector("[data-office-complete]");

		if (refresh) refresh.addEventListener("click", loadQueue);
		if (group) {
			group.addEventListener("change", function () {
				state.selectedGroupId = group.value;
				loadQueue();
			});
		}
		if (date) {
			date.addEventListener("change", function () {
				state.eventDate = date.value || today();
				loadQueue();
			});
		}
		if (admit) admit.addEventListener("click", admitNext);
		if (complete) complete.addEventListener("click", completeCurrent);

		root.querySelectorAll("[data-office-skip]").forEach(function (button) {
			button.addEventListener("click", function () {
				skipStudent(button.getAttribute("data-office-skip"));
			});
		});
	}

	function loadGroups() {
		if (!sessionsUrl()) return Promise.resolve();
		return api(sessionsUrl() + "?active_only=1", {method: "GET"}).then(function (payload) {
			var groups = payload && Array.isArray(payload.groups) ? payload.groups : [];
			state.groups = groups.filter(function (group) {
				return group.event_type === "office_hours";
			});
			if (!state.selectedGroupId && state.groups.length) {
				state.selectedGroupId = String(state.groups[0].id);
			}
		});
	}

	function loadQueue() {
		if (!state.selectedGroupId) {
			state.queue = [];
			state.stats = {};
			state.settings = {};
			render();
			return Promise.resolve();
		}

		state.loading = true;
		render();
		return api(officeUrl(state.selectedGroupId, "/queue") + "?event_date=" + encodeURIComponent(state.eventDate), {method: "GET"}).then(function (payload) {
			state.queue = payload && Array.isArray(payload.queue) ? payload.queue : [];
			state.stats = payload && payload.stats ? payload.stats : {};
			state.settings = payload && payload.settings ? payload.settings : {};
			state.loading = false;
			render();
		}).catch(function (error) {
			state.loading = false;
			render();
			toast(error.message || "Could not load queue.", "error");
		});
	}

	function admitNext() {
		if (!state.selectedGroupId) return;
		api(officeUrl(state.selectedGroupId, "/admit-next"), {
			method: "POST",
			body: {event_date: state.eventDate}
		}).then(function () {
			toast("Next student admitted.");
			loadQueue();
		}).catch(function (error) {
			toast(error.message || "Could not admit next student.", "error");
		});
	}

	function completeCurrent() {
		if (!state.selectedGroupId) return;
		api(officeUrl(state.selectedGroupId, "/complete-current"), {
			method: "POST",
			body: {event_date: state.eventDate}
		}).then(function () {
			toast("Current student completed.");
			loadQueue();
		}).catch(function (error) {
			toast(error.message || "Could not complete current student.", "error");
		});
	}

	function skipStudent(queueId) {
		queueId = parseInt(queueId || 0, 10);
		if (!queueId) return;
		api(officeUrl(queueId, "/skip"), {method: "POST"}).then(function () {
			toast("Student skipped.");
			loadQueue();
		}).catch(function (error) {
			toast(error.message || "Could not skip student.", "error");
		});
	}

	function startPolling() {
		window.clearInterval(state.timer);
		state.timer = window.setInterval(function () {
			if (!document.body.contains(root)) {
				window.clearInterval(state.timer);
				return;
			}
			if (!document.hidden) {
				loadQueue();
			}
		}, 10000);
		window.addEventListener("beforeunload", function () {
			window.clearInterval(state.timer);
		}, {once: true});
	}

	render();
	loadGroups().then(loadQueue).catch(function (error) {
		toast(error.message || "Could not load Office Hours admin.", "error");
	});
	startPolling();
})();
