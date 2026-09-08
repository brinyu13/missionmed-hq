(function () {
	"use strict";

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

	function featureEnabled(app) {
		var flags = (app && app.feature_flags) || (window.MMED_OS && window.MMED_OS.feature_flags) || {};
		return flags.interview_prep_rooms === true;
	}

	function typeLabel(value) {
		var labels = {
			behavioral: "Behavioral",
			clinical: "Clinical",
			traditional: "Traditional",
			mmi: "MMI"
		};
		return labels[value] || value || "Interview";
	}

	function statusLabel(value) {
		return String(value || "scheduled").replace(/_/g, " ").replace(/\b\w/g, function (letter) {
			return letter.toUpperCase();
		});
	}

	function dateLabel(date, time) {
		if (!date) return "";
		var parsed = new Date(date + "T" + (time || "00:00:00"));
		if (isNaN(parsed.getTime())) return date;
		return parsed.toLocaleDateString([], {month: "short", day: "numeric"}) + " at " + parsed.toLocaleTimeString([], {hour: "numeric", minute: "2-digit"});
	}

	function scoreAverage(rubric) {
		var total = 0;
		var count = 0;
		Object.keys(rubric || {}).forEach(function (key) {
			var item = rubric[key] || {};
			var score = parseInt(item.score || 0, 10);
			if (score > 0) {
				total += score;
				count++;
			}
		});
		return count ? (total / count) : 0;
	}

	function formatScore(value) {
		return value ? value.toFixed(1) : "N/A";
	}

	function InterviewPrepView(app) {
		this.app = app || window.MMED_OS || {};
		this.root = document.getElementById("sos-content");
		this.sessions = [];
		this.slots = [];
		this.questions = {};
		this.timer = null;
		this.sessionId = 0;
		this.currentSession = null;
	}

	InterviewPrepView.prototype.destroy = function (clearContent) {
		window.clearInterval(this.timer);
		this.timer = null;
		if (clearContent !== false && this.root) {
			this.root.innerHTML = "";
		}
	};

	InterviewPrepView.prototype.apiGet = function (endpoint, params) {
		if (this.app.api && typeof this.app.api.get === "function") {
			return this.app.api.get(endpoint, params || {});
		}
		return Promise.reject(new Error("Matrix API is unavailable."));
	};

	InterviewPrepView.prototype.apiPost = function (endpoint, body) {
		if (this.app.api && typeof this.app.api.post === "function") {
			return this.app.api.post(endpoint, body || {});
		}
		return Promise.reject(new Error("Matrix API is unavailable."));
	};

	InterviewPrepView.prototype.initDashboard = function () {
		this.destroy(false);
		this.root = document.getElementById("sos-content");
		this.renderLoading("Loading Interview Prep...");
		this.loadDashboard();
	};

	InterviewPrepView.prototype.loadDashboard = function () {
		var self = this;
		Promise.all([
			this.apiGet("/interviews/me"),
			this.apiGet("/interviews/questions"),
			this.apiGet("/interviews/slots")
		]).then(function (results) {
			self.sessions = (results[0] && results[0].sessions) || [];
			self.questions = (results[1] && results[1].questions) || {};
			self.slots = (results[2] && results[2].slots) || [];
			self.renderDashboard();
		}).catch(function (error) {
			self.renderError(error);
		});
	};

	InterviewPrepView.prototype.initSession = function (sessionId) {
		this.destroy(false);
		this.root = document.getElementById("sos-content");
		this.sessionId = parseInt(sessionId, 10);
		this.renderLoading("Loading interview room...");
		this.loadSession();
	};

	InterviewPrepView.prototype.loadSession = function () {
		var self = this;
		Promise.all([
			this.apiGet("/interviews/" + this.sessionId),
			this.apiGet("/interviews/questions")
		]).then(function (results) {
			self.currentSession = results[0] || {};
			self.questions = (results[1] && results[1].questions) || {};
			self.renderSession();
		}).catch(function (error) {
			self.renderError(error);
		});
	};

	InterviewPrepView.prototype.renderLoading = function (message) {
		if (!this.root) return;
		this.root.innerHTML = '<section class="mmed-interview-page"><div class="mmed-interview-loading">' + esc(message) + "</div></section>";
	};

	InterviewPrepView.prototype.renderError = function (error) {
		if (!this.root) return;
		this.root.innerHTML = [
			'<section class="mmed-interview-page">',
			'<div class="mmed-interview-error">',
			"<h1>Interview Prep unavailable</h1>",
			"<p>" + esc(error && error.message ? error.message : "Interview Prep could not be loaded.") + "</p>",
			'<button type="button" class="sos-btn sos-btn-secondary" data-interview-back>Back to Dashboard</button>',
			"</div>",
			"</section>"
		].join("");
		this.bindBack();
	};

	InterviewPrepView.prototype.renderDashboard = function () {
		if (!this.root) return;
		var completed = this.sessions.filter(function (item) { return item.status === "completed"; });
		var upcoming = this.sessions.filter(function (item) { return item.status === "scheduled" || item.status === "in_progress"; });
		var next = upcoming.slice().sort(sortSessions)[0] || null;
		var average = averageRubric(completed);

		this.root.innerHTML = [
			'<section class="mmed-interview-page">',
			'<header class="mmed-interview-hero">',
			'<span class="mmed-interview-kicker">Interview Prep</span>',
			"<h1>Prep rooms, question reps, and private feedback</h1>",
			'<button type="button" class="mmed-interview-primary" data-interview-book>Book Interview</button>',
			"</header>",
			'<div class="mmed-interview-stats">',
			statCard(completed.length, "Completed interviews"),
			statCard(upcoming.length, "Upcoming"),
			statCard(formatScore(average), "Average rubric"),
			statCard(next ? dateLabel(next.scheduled_date, next.scheduled_time) : "None", "Next session"),
			"</div>",
			'<div class="mmed-interview-grid">',
			'<main>',
			renderUpcoming(upcoming),
			renderHistory(this.sessions),
			"</main>",
			'<aside>',
			renderSlots(this.slots),
			renderQuestionPreview(this.questions),
			"</aside>",
			"</div>",
			"</section>"
		].join("");

		this.bindDashboard();
	};

	InterviewPrepView.prototype.renderSession = function () {
		if (!this.root || !this.currentSession) return;
		var session = this.currentSession;
		var completed = session.status === "completed";

		this.root.innerHTML = [
			'<section class="mmed-interview-page">',
			'<header class="mmed-interview-room-head">',
			'<button type="button" class="mmed-live-back" data-interview-back aria-label="Back to Interview Prep">‹</button>',
			"<div>",
			'<span class="mmed-interview-kicker">' + esc(typeLabel(session.interview_type)) + "</span>",
			"<h1>Interview Prep Room</h1>",
			"<p>" + esc(dateLabel(session.scheduled_date, session.scheduled_time)) + "</p>",
			"</div>",
			'<span class="mmed-interview-status">' + esc(statusLabel(session.status)) + "</span>",
			"</header>",
			'<div class="mmed-interview-room-grid">',
			'<main>',
			completed ? this.renderCompleted(session) : this.renderActiveRoom(session),
			"</main>",
			'<aside>',
			this.renderQuestionBank(session.interview_type),
			this.renderRubricReference(),
			"</aside>",
			"</div>",
			"</section>"
		].join("");

		this.bindSession();
		this.startCountdown(session);
	};

	InterviewPrepView.prototype.renderActiveRoom = function (session) {
		return [
			'<div class="mmed-interview-room-card">',
			"<h2>Session room</h2>",
			'<div class="mmed-interview-countdown" data-interview-countdown>--:--</div>',
			'<div class="mmed-interview-actions">',
			session.meeting_url ? '<a class="mmed-interview-primary" href="' + attr(session.meeting_url) + '" target="_blank" rel="noopener">Join Webex</a>' : '<span class="mmed-interview-muted">Webex link pending</span>',
			'<button type="button" class="mmed-interview-secondary" data-random-question>Random Question</button>',
			"</div>",
			'<div class="mmed-interview-random" data-random-question-output></div>',
			session.can_manage_feedback ? renderFeedbackForm(session) : "",
			"</div>"
		].join("");
	};

	InterviewPrepView.prototype.renderCompleted = function (session) {
		return [
			'<div class="mmed-interview-room-card">',
			"<h2>Completed feedback</h2>",
			renderRubricChart(session.rubric || {}),
			session.feedback && session.feedback.text ? '<div class="mmed-interview-feedback"><h3>Feedback</h3><p>' + esc(session.feedback.text) + "</p></div>" : '<p class="mmed-interview-muted">Feedback is not available yet.</p>',
			'<button type="button" class="mmed-interview-secondary" data-print-interview>Print View</button>',
			"</div>"
		].join("");
	};

	InterviewPrepView.prototype.renderQuestionBank = function (activeType) {
		var bank = this.questions || {};
		return [
			'<div class="mmed-interview-side">',
			"<h3>Question bank</h3>",
			Object.keys(bank).map(function (type) {
				var questions = bank[type] || [];
				return [
					'<div class="mmed-interview-question-group' + (type === activeType ? " is-active" : "") + '">',
					"<h4>" + esc(typeLabel(type)) + "</h4>",
					questions.slice(0, 8).map(function (question) {
						return "<p>" + esc(question) + "</p>";
					}).join(""),
					"</div>"
				].join("");
			}).join(""),
			"</div>"
		].join("");
	};

	InterviewPrepView.prototype.renderRubricReference = function () {
		var labels = ["Communication", "Clinical reasoning", "Professionalism", "Composure", "Answer structure", "Overall"];
		return [
			'<div class="mmed-interview-side">',
			"<h3>Rubric reference</h3>",
			labels.map(function (label) {
				return '<span class="mmed-interview-rubric-pill">' + esc(label) + "</span>";
			}).join(""),
			"</div>"
		].join("");
	};

	InterviewPrepView.prototype.bindBack = function () {
		var back = this.root ? this.root.querySelector("[data-interview-back]") : null;
		if (back) {
			back.addEventListener("click", function () {
				window.location.hash = "#/interview-prep";
			});
		}
	};

	InterviewPrepView.prototype.bindDashboard = function () {
		var self = this;
		var book = this.root.querySelector("[data-interview-book]");
		if (book) {
			book.addEventListener("click", function () {
				var target = self.root.querySelector("[data-interview-slots]");
				if (target) target.scrollIntoView({behavior: "smooth", block: "start"});
			});
		}

		this.root.querySelectorAll("[data-interview-open]").forEach(function (button) {
			button.addEventListener("click", function () {
				window.location.hash = "#/interview-session/" + button.getAttribute("data-interview-open");
			});
		});

		this.root.querySelectorAll("[data-claim-slot]").forEach(function (button) {
			button.addEventListener("click", function () {
				button.disabled = true;
				self.apiPost("/interviews/slots/" + button.getAttribute("data-claim-slot") + "/claim", {}).then(function (payload) {
					var session = payload && payload.session ? payload.session : null;
					if (session && session.id) {
						window.location.hash = "#/interview-session/" + session.id;
						return;
					}
					self.loadDashboard();
				}).catch(function (error) {
					button.disabled = false;
					self.renderError(error);
				});
			});
		});
	};

	InterviewPrepView.prototype.bindSession = function () {
		var self = this;
		this.bindBack();

		var random = this.root.querySelector("[data-random-question]");
		if (random) {
			random.addEventListener("click", function () {
				var type = (self.currentSession && self.currentSession.interview_type) || "traditional";
				var questions = self.questions[type] || [];
				var output = self.root.querySelector("[data-random-question-output]");
				if (output && questions.length) {
					output.textContent = questions[Math.floor(Math.random() * questions.length)];
				}
			});
		}

		var print = this.root.querySelector("[data-print-interview]");
		if (print) {
			print.addEventListener("click", function () {
				window.print();
			});
		}

		var form = this.root.querySelector("[data-interview-feedback-form]");
		if (form) {
			form.addEventListener("submit", function (event) {
				event.preventDefault();
				self.submitFeedback(form);
			});
		}
	};

	InterviewPrepView.prototype.submitFeedback = function (form) {
		var self = this;
		var rubric = {};
		form.querySelectorAll("[data-rubric-category]").forEach(function (row) {
			var category = row.getAttribute("data-rubric-category");
			rubric[category] = {
				score: parseInt(row.querySelector("select").value || "1", 10),
				notes: row.querySelector("input").value || ""
			};
		});

		var button = form.querySelector("button[type='submit']");
		if (button) button.disabled = true;

		this.apiPost("/admin/interviews/" + this.sessionId + "/feedback", {
			rubric_scores: rubric,
			feedback_text: form.querySelector("textarea").value || ""
		}).then(function () {
			self.loadSession();
		}).catch(function (error) {
			if (button) button.disabled = false;
			self.renderError(error);
		});
	};

	InterviewPrepView.prototype.startCountdown = function (session) {
		var self = this;
		window.clearInterval(this.timer);
		if (!session || session.status === "completed") return;

		function tick() {
			var el = self.root ? self.root.querySelector("[data-interview-countdown]") : null;
			if (!el) return;
			var start = new Date(session.scheduled_date + "T" + session.scheduled_time);
			var end = new Date(start.getTime() + parseInt(session.duration_minutes || 20, 10) * 60000);
			var remaining = Math.max(0, end.getTime() - Date.now());
			var minutes = Math.floor(remaining / 60000);
			var seconds = Math.floor((remaining % 60000) / 1000);
			el.textContent = minutes + ":" + (seconds < 10 ? "0" + seconds : seconds);
			el.classList.toggle("is-yellow", remaining <= 5 * 60000 && remaining > 60000);
			el.classList.toggle("is-red", remaining <= 60000);
		}

		tick();
		this.timer = window.setInterval(tick, 1000);
	};

	function statCard(value, label) {
		return [
			'<div class="mmed-interview-stat">',
			"<strong>" + esc(value) + "</strong>",
			"<span>" + esc(label) + "</span>",
			"</div>"
		].join("");
	}

	function sortSessions(a, b) {
		return String(a.scheduled_date + " " + a.scheduled_time).localeCompare(String(b.scheduled_date + " " + b.scheduled_time));
	}

	function averageRubric(sessions) {
		var total = 0;
		var count = 0;
		sessions.forEach(function (session) {
			var score = scoreAverage(session.rubric || {});
			if (score) {
				total += score;
				count++;
			}
		});
		return count ? total / count : 0;
	}

	function renderUpcoming(sessions) {
		return [
			'<section class="mmed-interview-panel">',
			"<h2>Upcoming interviews</h2>",
			sessions.length ? sessions.slice().sort(sortSessions).map(renderSessionRow).join("") : '<p class="mmed-interview-muted">No upcoming interviews yet.</p>',
			"</section>"
		].join("");
	}

	function renderHistory(sessions) {
		return [
			'<section class="mmed-interview-panel">',
			"<h2>Interview history</h2>",
			sessions.length ? sessions.map(renderSessionRow).join("") : '<p class="mmed-interview-muted">Your interview history will appear here.</p>',
			"</section>"
		].join("");
	}

	function renderSessionRow(session) {
		return [
			'<article class="mmed-interview-row">',
			"<div>",
			"<strong>" + esc(typeLabel(session.interview_type)) + "</strong>",
			"<span>" + esc(dateLabel(session.scheduled_date, session.scheduled_time)) + "</span>",
			"</div>",
			'<span class="mmed-interview-status">' + esc(statusLabel(session.status)) + "</span>",
			'<button type="button" class="mmed-interview-secondary" data-interview-open="' + attr(session.id) + '">Open</button>',
			"</article>"
		].join("");
	}

	function renderSlots(slots) {
		return [
			'<section class="mmed-interview-panel" data-interview-slots>',
			"<h2>Open slots</h2>",
			slots.length ? slots.map(function (slot) {
				return [
					'<article class="mmed-interview-slot">',
					"<div><strong>" + esc(typeLabel(slot.interview_type)) + "</strong><span>" + esc(dateLabel(slot.slot_date, slot.slot_time)) + "</span></div>",
					'<button type="button" class="mmed-interview-primary" data-claim-slot="' + attr(slot.id) + '">Claim</button>',
					"</article>"
				].join("");
			}).join("") : '<p class="mmed-interview-muted">No open manual slots are available.</p>',
			"</section>"
		].join("");
	}

	function renderQuestionPreview(bank) {
		return [
			'<section class="mmed-interview-panel">',
			"<h2>Practice question sets</h2>",
			Object.keys(bank || {}).map(function (type) {
				return '<span class="mmed-interview-rubric-pill">' + esc(typeLabel(type)) + " " + esc((bank[type] || []).length) + "</span>";
			}).join(""),
			"</section>"
		].join("");
	}

	function renderFeedbackForm() {
		var categories = [
			["communication", "Communication"],
			["clinical_reasoning", "Clinical reasoning"],
			["professionalism", "Professionalism"],
			["composure", "Composure"],
			["answer_structure", "Answer structure"],
			["overall", "Overall"]
		];

		return [
			'<form class="mmed-interview-feedback-form" data-interview-feedback-form>',
			"<h3>Private interviewer feedback</h3>",
			categories.map(function (item) {
				return [
					'<div class="mmed-interview-rubric-row" data-rubric-category="' + attr(item[0]) + '">',
					"<label>" + esc(item[1]) + '<select><option>1</option><option>2</option><option>3</option><option>4</option><option selected>5</option></select></label>',
					'<input maxlength="500" placeholder="Notes">',
					"</div>"
				].join("");
			}).join(""),
			'<textarea rows="5" maxlength="2000" placeholder="Feedback for the student"></textarea>',
			'<button type="submit" class="mmed-interview-primary">End Interview</button>',
			"</form>"
		].join("");
	}

	function renderRubricChart(rubric) {
		var keys = Object.keys(rubric || {});
		if (!keys.length) {
			return '<p class="mmed-interview-muted">Rubric scores are not available yet.</p>';
		}

		return [
			'<svg class="mmed-interview-chart" viewBox="0 0 420 ' + (keys.length * 42 + 20) + '" role="img" aria-label="Rubric scores">',
			keys.map(function (key, index) {
				var score = parseInt((rubric[key] || {}).score || 0, 10);
				var width = Math.max(0, Math.min(5, score)) * 52;
				var y = index * 42 + 10;
				return [
					'<text x="0" y="' + (y + 20) + '">' + esc(key.replace(/_/g, " ")) + "</text>",
					'<rect x="150" y="' + y + '" width="260" height="22" rx="4" fill="rgba(255,255,255,0.08)"></rect>',
					'<rect x="150" y="' + y + '" width="' + width + '" height="22" rx="4" fill="#36c071"></rect>',
					'<text x="370" y="' + (y + 17) + '">' + score + "/5</text>"
				].join("");
			}).join(""),
			"</svg>"
		].join("");
	}

	function installRoutes(app) {
		if (!app || !app.router || app.router._mmedInterviewPatched) return;

		var originalRoute = app.router.route.bind(app.router);
		app.router._mmedInterviewPatched = true;

		app.router.route = function () {
			var raw = window.location.hash.replace(/^#\/?/, "") || "dashboard";
			var sessionMatch = raw.match(/^interview-session\/(\d+)$/);
			var isDashboard = raw === "interview-prep";

			if (isDashboard || sessionMatch) {
				if (window.mmedLiveSessionView && typeof window.mmedLiveSessionView.destroy === "function") {
					window.mmedLiveSessionView.destroy();
					window.mmedLiveSessionView = null;
				}
				if (window.mmedInterviewPrepView && typeof window.mmedInterviewPrepView.destroy === "function") {
					window.mmedInterviewPrepView.destroy();
				}

				app.state.route = isDashboard ? "interview-prep" : raw;
				app.render.sidebar();
				window.mmedInterviewPrepView = new InterviewPrepView(app);

				if (!featureEnabled(app)) {
					window.mmedInterviewPrepView.renderError(new Error("Interview Prep is not enabled."));
					return;
				}

				if (sessionMatch) {
					window.mmedInterviewPrepView.initSession(sessionMatch[1]);
				} else {
					window.mmedInterviewPrepView.initDashboard();
				}
				return;
			}

			if (window.mmedInterviewPrepView && typeof window.mmedInterviewPrepView.destroy === "function") {
				window.mmedInterviewPrepView.destroy();
				window.mmedInterviewPrepView = null;
			}

			originalRoute();
		};

		if (/^#\/?interview-prep$/.test(window.location.hash || "") || /^#\/?interview-session\/\d+$/.test(window.location.hash || "")) {
			window.setTimeout(app.router.route.bind(app.router), 0);
		}
	}

	var attempts = 0;
	var boot = window.setInterval(function () {
		attempts++;
		if (attempts > 50) {
			window.clearInterval(boot);
			return;
		}
		if (!window.MMED_OS) return;
		window.clearInterval(boot);
		installRoutes(window.MMED_OS);
	}, 100);

	window.MMEDInterviewPrepView = InterviewPrepView;
})();
