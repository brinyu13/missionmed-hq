(function () {
	"use strict";

	var config = window.mmedAnalyticsAdmin || {};
	var root = document.getElementById("mmed-analytics-root");
	var state = {
		loading: false,
		data: null,
		from: "",
		to: "",
		template: "360elite"
	};

	if (!root) {
		return;
	}

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

	function request(params) {
		var url = new URL(config.dashboardUrl || window.location.href);
		Object.keys(params || {}).forEach(function (key) {
			if (params[key]) {
				url.searchParams.set(key, params[key]);
			}
		});

		return fetch(url.toString(), {
			method: "GET",
			credentials: "same-origin",
			headers: {
				"X-WP-Nonce": config.nonce || ""
			}
		}).then(function (response) {
			return response.json().then(function (payload) {
				if (!response.ok) {
					throw new Error(payload && payload.message ? payload.message : "Request failed");
				}
				return payload;
			});
		});
	}

	function render() {
		root.innerHTML = [
			'<div class="mmed-analytics-admin">',
			'<div class="mmed-analytics-header">',
			"<div>",
			'<p class="mmed-analytics-eyebrow">MissionMed Matrix Admin</p>',
			"<h1>Session Analytics</h1>",
			"<p>Track live session attendance, engagement trends, and students who need outreach.</p>",
			"</div>",
			"</div>",
			renderFilters(),
			state.loading ? '<div class="mmed-analytics-loading">Loading analytics...</div>' : renderDashboard(),
			"</div>"
		].join("");

		bind();
		drawCharts();
	}

	function renderFilters() {
		var templates = config.templates || [];
		var options = templates.map(function (template) {
			return '<option value="' + attr(template) + '"' + (template === state.template ? " selected" : "") + ">" + esc(template) + "</option>";
		}).join("");

		return [
			'<form class="mmed-analytics-filters" data-analytics-filters>',
			'<label>From<input type="date" name="from" value="' + attr(state.from) + '"></label>',
			'<label>To<input type="date" name="to" value="' + attr(state.to) + '"></label>',
			'<label>Template<select name="template">' + options + "</select></label>",
			'<button type="submit" class="button button-primary">Refresh</button>',
			"</form>"
		].join("");
	}

	function renderDashboard() {
		var data = state.data || {};
		return [
			'<div class="mmed-analytics-grid">',
			renderChartCard("Attendance Trend", "trend-chart"),
			renderChartCard("Readiness Distribution", "distribution-chart"),
			"</div>",
			'<div class="mmed-analytics-grid">',
			renderAttendanceTable(data.attendance_by_session || []),
			renderStudentTable("At Risk Students", data.at_risk_students || []),
			renderStudentTable("Top Attenders", data.top_attenders || []),
			"</div>"
		].join("");
	}

	function renderChartCard(title, canvasId) {
		return [
			'<div class="mmed-analytics-card">',
			"<h2>" + esc(title) + "</h2>",
			'<canvas id="' + attr(canvasId) + '" width="520" height="220"></canvas>',
			"</div>"
		].join("");
	}

	function renderAttendanceTable(rows) {
		var body = rows.length ? rows.map(function (row) {
			return [
				"<tr>",
				"<td>" + esc(row.session_name) + "</td>",
				"<td>" + esc(row.date) + "</td>",
				"<td>" + parseInt(row.total_enrolled || 0, 10) + "</td>",
				"<td>" + parseInt(row.attended || 0, 10) + "</td>",
				"<td>" + parseInt(row.attendance_rate || 0, 10) + "%</td>",
				"</tr>"
			].join("");
		}).join("") : '<tr><td colspan="5">No attendance rows in this range.</td></tr>';

		return [
			'<div class="mmed-analytics-card mmed-analytics-wide">',
			"<h2>Attendance By Session</h2>",
			'<table class="widefat striped"><thead><tr><th>Session</th><th>Date</th><th>Enrolled</th><th>Attended</th><th>Rate</th></tr></thead><tbody>',
			body,
			"</tbody></table>",
			"</div>"
		].join("");
	}

	function renderStudentTable(title, rows) {
		var body = rows.length ? rows.map(function (row) {
			return [
				"<tr>",
				"<td>" + esc(row.name || row.email) + "</td>",
				"<td>" + esc(row.email) + "</td>",
				"<td>" + parseInt(row.attendance_rate || 0, 10) + "%</td>",
				"<td>" + parseInt(row.sessions_attended || 0, 10) + " / " + parseInt(row.sessions_total || 0, 10) + "</td>",
				"</tr>"
			].join("");
		}).join("") : '<tr><td colspan="4">No students to show.</td></tr>';

		return [
			'<div class="mmed-analytics-card">',
			"<h2>" + esc(title) + "</h2>",
			'<table class="widefat striped"><thead><tr><th>Name</th><th>Email</th><th>Rate</th><th>Sessions</th></tr></thead><tbody>',
			body,
			"</tbody></table>",
			"</div>"
		].join("");
	}

	function bind() {
		var form = root.querySelector("[data-analytics-filters]");
		if (!form) {
			return;
		}

		form.addEventListener("submit", function (event) {
			event.preventDefault();
			var data = new FormData(form);
			state.from = data.get("from") || "";
			state.to = data.get("to") || "";
			state.template = data.get("template") || "";
			load();
		});
	}

	function load() {
		state.loading = true;
		render();

		request({
			from: state.from,
			to: state.to,
			template: state.template
		}).then(function (payload) {
			state.data = payload || {};
			state.loading = false;
			render();
		}).catch(function (error) {
			state.loading = false;
			state.data = {};
			render();
			window.alert(error.message || "Could not load analytics.");
		});
	}

	function drawCharts() {
		if (!state.data || state.loading) {
			return;
		}

		drawBars("trend-chart", (state.data.attendance_trend || []).map(function (row) {
			return {label: row.week, value: row.average_rate};
		}), 100);

		drawBars("distribution-chart", (state.data.engagement_score_distribution || []).map(function (row) {
			return {label: row.bucket, value: row.count};
		}), null);
	}

	function drawBars(id, rows, maxOverride) {
		var canvas = document.getElementById(id);
		if (!canvas || !canvas.getContext) {
			return;
		}

		var ctx = canvas.getContext("2d");
		var width = canvas.width;
		var height = canvas.height;
		var max = maxOverride || rows.reduce(function (carry, row) {
			return Math.max(carry, parseInt(row.value || 0, 10));
		}, 1);

		ctx.clearRect(0, 0, width, height);
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, width, height);
		ctx.strokeStyle = "#dcdcde";
		ctx.beginPath();
		ctx.moveTo(36, 16);
		ctx.lineTo(36, height - 36);
		ctx.lineTo(width - 12, height - 36);
		ctx.stroke();

		if (!rows.length) {
			ctx.fillStyle = "#646970";
			ctx.fillText("No data", 48, 64);
			return;
		}

		var gap = 12;
		var barArea = width - 64;
		var barWidth = Math.max(12, (barArea - gap * rows.length) / rows.length);

		rows.forEach(function (row, index) {
			var value = parseInt(row.value || 0, 10);
			var barHeight = Math.round(((height - 64) * value) / Math.max(max, 1));
			var x = 44 + index * (barWidth + gap);
			var y = height - 37 - barHeight;

			ctx.fillStyle = "#0e75a8";
			ctx.fillRect(x, y, barWidth, barHeight);
			ctx.fillStyle = "#1d2327";
			ctx.font = "12px Arial";
			ctx.fillText(String(value), x, Math.max(14, y - 6));
			ctx.fillStyle = "#646970";
			ctx.save();
			ctx.translate(x, height - 20);
			ctx.rotate(-0.45);
			ctx.fillText(String(row.label || ""), 0, 0);
			ctx.restore();
		});
	}

	render();
	load();
})();
