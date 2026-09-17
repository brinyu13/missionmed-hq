(function () {
	"use strict";

	var state = {
		view: null,
		entry: null,
		settings: {},
		timer: null,
		loading: false,
		error: ""
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

	function featureEnabled(view) {
		var flags = (view.app && view.app.feature_flags) || (window.MMED_OS && window.MMED_OS.feature_flags) || {};
		return flags.office_hours_queue === true;
	}

	function apiGet(view, endpoint, params) {
		if (view && typeof view.apiGet === "function") {
			return view.apiGet(endpoint, params || {});
		}
		return Promise.reject(new Error("Matrix API is unavailable."));
	}

	function apiPost(view, endpoint, body) {
		if (view && typeof view.apiPost === "function") {
			return view.apiPost(endpoint, body || {});
		}
		return Promise.reject(new Error("Matrix API is unavailable."));
	}

	function apiDelete(view, endpoint, params) {
		if (view && view.app && view.app.api && typeof view.app.api.request === "function") {
			return view.app.api.request(endpoint, {method: "DELETE"}, params || {});
		}
		return Promise.reject(new Error("Matrix API is unavailable."));
	}

	function render(view) {
		state.view = view;
		if (!featureEnabled(view)) {
			return '<div class="mmed-office-hours-panel"><h2>Office Hours Queue</h2><p>Office Hours queue is not enabled.</p></div>';
		}

		var entry = state.entry;
		var info = view.joinInfo || {};
		var body = "";

		if (state.error) {
			body += '<div class="mmed-office-hours-alert">' + esc(state.error) + "</div>";
		}

		if (!entry) {
			body += renderJoinForm();
		} else if (entry.status === "admitted") {
			body += renderAdmitted(entry, info);
		} else if (entry.status === "waiting") {
			body += renderWaiting(entry);
		} else {
			body += renderClosed(entry);
		}

		return [
			'<section class="mmed-office-hours-panel">',
			'<div class="mmed-office-hours-head">',
			"<div>",
			"<h2>Office Hours Queue</h2>",
			"<p>Ask for help, wait your turn, and join when admitted.</p>",
			"</div>",
			entry ? '<span class="mmed-office-hours-status">' + esc(statusLabel(entry.status)) + "</span>" : "",
			"</div>",
			body,
			"</section>"
		].join("");
	}

	function renderJoinForm() {
		return [
			'<form class="mmed-office-hours-join" data-office-hours-join>',
			'<label>What do you need help with?<textarea maxlength="200" rows="4" name="question_preview"></textarea></label>',
			'<button type="submit" class="mmed-office-hours-primary"' + (state.loading ? " disabled" : "") + ">Join Queue</button>",
			"</form>"
		].join("");
	}

	function renderWaiting(entry) {
		var wait = Math.max(0, (parseInt(entry.queue_position || 1, 10) - 1) * parseInt((state.settings && state.settings.slot_duration_minutes) || 10, 10));
		return [
			'<div class="mmed-office-hours-waiting">',
			'<div class="mmed-office-hours-pulse"></div>',
			"<strong>You are #" + esc(entry.queue_position) + " in line</strong>",
			"<span>Estimated wait: " + esc(wait) + " minutes</span>",
			'<button type="button" class="mmed-office-hours-secondary" data-office-hours-leave>Leave Queue</button>',
			"</div>"
		].join("");
	}

	function renderAdmitted(entry, info) {
		return [
			'<div class="mmed-office-hours-admitted">',
			"<strong>You're up. Join the meeting now.</strong>",
			'<div class="mmed-office-hours-timer">' + esc(slotRemaining(entry)) + "</div>",
			info.meeting_url ? '<a class="mmed-office-hours-primary" href="' + attr(info.meeting_url) + '" target="_blank" rel="noopener">Join Webex</a>' : '<span class="mmed-office-hours-muted">Meeting link pending</span>',
			'<button type="button" class="mmed-office-hours-secondary" data-office-hours-leave>Leave Queue</button>',
			"</div>"
		].join("");
	}

	function slotRemaining(entry) {
		var minutes = parseInt((state.settings && state.settings.slot_duration_minutes) || 10, 10);
		var total = Math.max(1, minutes) * 60;
		if (entry && entry.admitted_at) {
			var admittedAt = new Date(String(entry.admitted_at).replace(" ", "T"));
			if (!isNaN(admittedAt.getTime())) {
				total = Math.max(0, total - Math.floor((Date.now() - admittedAt.getTime()) / 1000));
			}
		}
		var mins = Math.floor(total / 60);
		var secs = total % 60;
		return mins + ":" + (secs < 10 ? "0" + secs : secs);
	}

	function renderClosed(entry) {
		return [
			'<div class="mmed-office-hours-closed">',
			"<strong>Status: " + esc(statusLabel(entry.status)) + "</strong>",
			"<span>You can rejoin only if the host opens another queue entry.</span>",
			"</div>"
		].join("");
	}

	function bind(view) {
		state.view = view;
		var root = view.root;
		if (!root) return;

		var form = root.querySelector("[data-office-hours-join]");
		if (form) {
			form.addEventListener("submit", function (event) {
				event.preventDefault();
				join(view, form);
			});
		}

		root.querySelectorAll("[data-office-hours-leave]").forEach(function (button) {
			button.addEventListener("click", function () {
				leave(view);
			});
		});
	}

	function start(view) {
		state.view = view;
		loadPosition(view);
		window.clearInterval(state.timer);
		state.timer = window.setInterval(function () {
			loadPosition(view);
		}, 10000);
	}

	function stop() {
		window.clearInterval(state.timer);
		state.timer = null;
		state.view = null;
		state.entry = null;
		state.error = "";
	}

	function refresh(view) {
		if (!view || !view.root || typeof view.renderOfficeHoursQueue !== "function") return;
		view.renderOfficeHoursQueue();
	}

	function loadPosition(view) {
		var info = view.joinInfo || {};
		if (!info.session_group_id || !info.event_date) return Promise.resolve();

		return apiGet(view, "/office-hours/" + info.session_group_id + "/position", {
			event_date: info.event_date
		}).then(function (payload) {
			state.entry = payload && payload.entry ? payload.entry : null;
			state.settings = payload && payload.settings ? payload.settings : {};
			state.error = "";
			refresh(view);
		}).catch(function (error) {
			state.error = error && error.message ? error.message : "Queue position could not be loaded.";
			refresh(view);
		});
	}

	function join(view, form) {
		var info = view.joinInfo || {};
		var field = form.querySelector("textarea");
		var button = form.querySelector("button");
		state.loading = true;
		if (button) button.disabled = true;

		apiPost(view, "/office-hours/" + info.session_group_id + "/join", {
			event_date: info.event_date,
			question_preview: field ? field.value : ""
		}).then(function (payload) {
			state.entry = payload && payload.entry ? payload.entry : null;
			state.error = "";
			state.loading = false;
			refresh(view);
		}).catch(function (error) {
			state.error = error && error.message ? error.message : "Could not join the queue.";
			state.loading = false;
			refresh(view);
		});
	}

	function leave(view) {
		var info = view.joinInfo || {};
		apiDelete(view, "/office-hours/" + info.session_group_id + "/leave", {
			event_date: info.event_date
		}).then(function () {
			state.entry = null;
			state.error = "";
			refresh(view);
		}).catch(function (error) {
			state.error = error && error.message ? error.message : "Could not leave the queue.";
			refresh(view);
		});
	}

	function statusLabel(value) {
		return String(value || "").replace(/_/g, " ").replace(/\b\w/g, function (letter) {
			return letter.toUpperCase();
		});
	}

	window.MMEDOfficeHoursPanel = {
		render: render,
		bind: bind,
		start: start,
		stop: stop
	};
})();
