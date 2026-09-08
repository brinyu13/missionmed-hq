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

	function secondsLabel(seconds) {
		seconds = Math.max(0, parseInt(seconds || 0, 10));
		var minutes = Math.floor(seconds / 60);
		var rest = seconds % 60;
		return minutes + ":" + (rest < 10 ? "0" + rest : rest);
	}

	function featureEnabled(app, flag) {
		var flags = (app && app.feature_flags) || (window.MMED_OS && window.MMED_OS.feature_flags) || {};
		return flags[flag] === true;
	}

	function ArenaBattleView(app) {
		this.app = app || window.MMED_OS || {};
		this.root = document.getElementById("sos-content");
		this.battleId = 0;
		this.state = null;
		this.pollTimer = null;
		this.countdownTimer = null;
		this.displayDeadline = 0;
		this.fatal = false;
	}

	ArenaBattleView.prototype.init = function (battleId) {
		this.destroy(false);
		this.root = document.getElementById("sos-content");
		this.battleId = parseInt(battleId, 10);
		this.renderLoading();
		this.load(true);
	};

	ArenaBattleView.prototype.destroy = function (clearContent) {
		window.clearInterval(this.pollTimer);
		window.clearInterval(this.countdownTimer);
		this.pollTimer = null;
		this.countdownTimer = null;
		if (clearContent !== false && this.root) {
			this.root.innerHTML = "";
		}
	};

	ArenaBattleView.prototype.apiGet = function (endpoint, params) {
		if (this.app.api && typeof this.app.api.get === "function") {
			return this.app.api.get(endpoint, params || {});
		}
		return Promise.reject(new Error("Matrix API is unavailable."));
	};

	ArenaBattleView.prototype.apiPost = function (endpoint, body) {
		if (this.app.api && typeof this.app.api.post === "function") {
			return this.app.api.post(endpoint, body || {});
		}
		return Promise.reject(new Error("Matrix API is unavailable."));
	};

	ArenaBattleView.prototype.load = function (restartPoll) {
		var self = this;
		if (this.fatal) return Promise.resolve();

		return this.apiGet("/arena-battles/" + this.battleId + "/state").then(function (payload) {
			self.state = payload || {};
			self.render();
			if (restartPoll) {
				self.startPolling();
			}
		}).catch(function (error) {
			self.renderError(error);
			self.fatal = true;
			self.destroy(false);
		});
	};

	ArenaBattleView.prototype.startPolling = function () {
		var self = this;
		window.clearInterval(this.pollTimer);
		this.pollTimer = window.setInterval(function () {
			var status = self.state && self.state.battle ? self.state.battle.status : "";
			if (status === "completed" || self.fatal) {
				window.clearInterval(self.pollTimer);
				return;
			}
			self.load(false);
		}, 2000);
	};

	ArenaBattleView.prototype.startDisplayTimer = function () {
		var self = this;
		window.clearInterval(this.countdownTimer);
		var remaining = this.state ? parseInt(this.state.time_remaining || 0, 10) : 0;
		this.displayDeadline = Date.now() + remaining * 1000;
		this.countdownTimer = window.setInterval(function () {
			var el = self.root ? self.root.querySelector("[data-arena-countdown]") : null;
			if (!el) return;
			var seconds = Math.max(0, Math.ceil((self.displayDeadline - Date.now()) / 1000));
			el.textContent = secondsLabel(seconds);
		}, 250);
	};

	ArenaBattleView.prototype.renderLoading = function () {
		if (!this.root) return;
		this.root.innerHTML = '<section class="mmed-arena-battle-page"><div class="mmed-arena-battle-loading">Loading Arena Battle...</div></section>';
	};

	ArenaBattleView.prototype.renderError = function (error) {
		if (!this.root) return;
		this.root.innerHTML = [
			'<section class="mmed-arena-battle-page">',
			'<div class="mmed-arena-battle-error">',
			"<h1>Battle unavailable</h1>",
			"<p>" + esc(error && error.message ? error.message : "This Arena Battle could not be loaded.") + "</p>",
			'<button type="button" class="sos-btn sos-btn-secondary" data-arena-back>Back to Calendar</button>',
			"</div>",
			"</section>"
		].join("");
		this.bindBack();
	};

	ArenaBattleView.prototype.render = function () {
		if (!this.root || !this.state) return;
		var battle = this.state.battle || {};
		var question = this.state.current_question || null;
		var response = this.state.current_response || null;
		var status = battle.status || "draft";
		var completed = status === "completed";

		this.root.innerHTML = [
			'<section class="mmed-arena-battle-page">',
			'<header class="mmed-arena-battle-head">',
			'<button type="button" class="mmed-live-back" data-arena-back aria-label="Back to live session">‹</button>',
			"<div>",
			'<span class="mmed-arena-kicker">Arena Battle</span>',
			"<h1>" + esc(battle.battle_title || "Arena Battle") + "</h1>",
			'<p>' + esc(formatFormat(battle.battle_format)) + "</p>",
			"</div>",
			'<div class="mmed-arena-battle-timer"><span data-arena-countdown>' + secondsLabel(this.state.time_remaining) + '</span><small>server timer</small></div>',
			"</header>",
			'<div class="mmed-arena-battle-grid">',
			'<main class="mmed-arena-battle-main">',
			completed ? this.renderComplete() : (question ? this.renderQuestion(question, response) : this.renderLobby(status)),
			"</main>",
			this.renderSidePanel(),
			"</div>",
			"</section>"
		].join("");

		this.bind();
		this.startDisplayTimer();
		if (completed) {
			window.clearInterval(this.pollTimer);
		}
	};

	ArenaBattleView.prototype.renderLobby = function (status) {
		return [
			'<div class="mmed-arena-question-card">',
			'<span class="mmed-arena-kicker">' + esc(status === "active" ? "Ready" : "Lobby") + "</span>",
			"<h2>Waiting for the next question</h2>",
			"<p>The host controls the battle clock. Keep Webex open and get ready.</p>",
			"</div>"
		].join("");
	};

	ArenaBattleView.prototype.renderQuestion = function (question, response) {
		var answered = !!response;
		var options = Array.isArray(question.options) ? question.options : [];
		var controls = "";

		if (question.question_type === "mcq") {
			controls = options.map(function (option, index) {
				var selected = answered && String(response.answer) === String(index);
				return '<button type="button" class="mmed-arena-answer' + (selected ? " is-selected" : "") + '" data-arena-answer="' + index + '"' + (answered ? " disabled" : "") + '><span>' + String.fromCharCode(65 + index) + '</span>' + esc(option) + "</button>";
			}).join("");
		} else {
			controls = [
				'<form class="mmed-arena-free-form" data-arena-free-form>',
				'<textarea name="answer" rows="4" maxlength="1000"' + (answered ? " disabled" : "") + ">" + (answered ? esc(response.answer) : "") + "</textarea>",
				'<button type="submit" class="sos-btn sos-btn-primary"' + (answered ? " disabled" : "") + ">Submit Answer</button>",
				"</form>"
			].join("");
		}

		return [
			'<article class="mmed-arena-question-card">',
			'<div class="mmed-arena-question-meta">',
			'<span>Question ' + (parseInt(question.question_index || 0, 10) + 1) + '</span>',
			'<span>' + parseInt(question.points || 0, 10) + " points</span>",
			"</div>",
			"<h2>" + esc(question.question_text) + "</h2>",
			'<div class="mmed-arena-answer-grid">' + controls + "</div>",
			answered ? this.renderFeedback(question, response) : "",
			"</article>"
		].join("");
	};

	ArenaBattleView.prototype.renderFeedback = function (question, response) {
		var correct = response && response.is_correct;
		return [
			'<div class="mmed-arena-feedback ' + (correct ? "is-correct" : "is-incorrect") + '">',
			"<strong>" + (correct ? "Correct" : "Submitted") + "</strong>",
			'<span>' + parseInt(response.points_earned || 0, 10) + " points earned</span>",
			question.explanation ? "<p>" + esc(question.explanation) + "</p>" : "",
			"</div>"
		].join("");
	};

	ArenaBattleView.prototype.renderComplete = function () {
		var rank = parseInt(this.state.user_rank || 0, 10);
		var score = parseInt(this.state.current_score || 0, 10);
		return [
			'<div class="mmed-arena-complete">',
			'<span class="mmed-arena-kicker">Battle Complete</span>',
			"<h2>" + (rank ? "You finished #" + rank : "Final scores are in") + "</h2>",
			"<p>Your final score: " + score + " points.</p>",
			'<button type="button" class="sos-btn sos-btn-primary" data-arena-back>Back to Session</button>',
			"</div>"
		].join("");
	};

	ArenaBattleView.prototype.renderSidePanel = function () {
		var board = Array.isArray(this.state.leaderboard) ? this.state.leaderboard : [];
		var rows = board.slice(0, 5).map(function (row) {
			return [
				'<li class="' + (parseInt(row.rank || 0, 10) === 1 ? "is-first" : "") + '">',
				"<span>#" + parseInt(row.rank || 0, 10) + " " + esc(row.display_name || "Student") + "</span>",
				"<strong>" + parseInt(row.total_points || 0, 10) + "</strong>",
				"</li>"
			].join("");
		}).join("");

		return [
			'<aside class="mmed-arena-battle-side">',
			'<div class="mmed-arena-score-card">',
			"<span>Current Score</span>",
			"<strong>" + parseInt(this.state.current_score || 0, 10) + "</strong>",
			"</div>",
			'<div class="mmed-arena-score-card">',
			"<span>Participants</span>",
			"<strong>" + parseInt(this.state.participant_count || 0, 10) + "</strong>",
			"</div>",
			'<div class="mmed-arena-leaders">',
			"<h2>Top 5</h2>",
			"<ol>" + (rows || '<li><span>No scores yet</span><strong>0</strong></li>') + "</ol>",
			"</div>",
			"</aside>"
		].join("");
	};

	ArenaBattleView.prototype.bind = function () {
		var self = this;
		this.bindBack();

		this.root.querySelectorAll("[data-arena-answer]").forEach(function (button) {
			button.addEventListener("click", function () {
				self.submitAnswer(button.getAttribute("data-arena-answer"));
			});
		});

		var freeForm = this.root.querySelector("[data-arena-free-form]");
		if (freeForm) {
			freeForm.addEventListener("submit", function (event) {
				event.preventDefault();
				self.submitAnswer(freeForm.elements.answer.value);
			});
		}
	};

	ArenaBattleView.prototype.bindBack = function () {
		var self = this;
		if (!this.root) return;
		this.root.querySelectorAll("[data-arena-back]").forEach(function (button) {
			button.addEventListener("click", function () {
				self.destroy(false);
				window.location.hash = "#/calendar";
			});
		});
	};

	ArenaBattleView.prototype.submitAnswer = function (answer) {
		var self = this;
		var question = this.state && this.state.current_question;
		if (!question) return;

		this.root.querySelectorAll("[data-arena-answer], [data-arena-free-form] button").forEach(function (button) {
			button.disabled = true;
		});

		this.apiPost("/arena-battles/" + this.battleId + "/respond", {
			question_id: question.id,
			answer: String(answer),
			response_time_ms: Math.max(0, Math.round((Date.now() - (this.displayDeadline - parseInt(this.state.time_remaining || 0, 10) * 1000))))
		}).then(function (payload) {
			self.state = payload && payload.state ? payload.state : self.state;
			self.render();
		}).catch(function (error) {
			self.renderError(error);
		});
	};

	function formatFormat(value) {
		return String(value || "lightning").replace(/_/g, " ").replace(/\b\w/g, function (letter) {
			return letter.toUpperCase();
		});
	}

	function installRoute(app) {
		if (!app || !app.router || app.router._mmedArenaBattlePatched) return;

		var originalRoute = app.router.route.bind(app.router);
		app.router._mmedArenaBattlePatched = true;

		app.router.route = function () {
			var raw = window.location.hash.replace(/^#\/?/, "") || "dashboard";
			var match = raw.match(/^arena-battle\/(\d+)$/);

			if (match) {
				if (window.mmedLiveSessionView && typeof window.mmedLiveSessionView.destroy === "function") {
					window.mmedLiveSessionView.destroy();
					window.mmedLiveSessionView = null;
				}
				if (window.mmedArenaBattleView && typeof window.mmedArenaBattleView.destroy === "function") {
					window.mmedArenaBattleView.destroy();
				}

				app.state.route = raw;
				app.render.sidebar();

				if (!featureEnabled(app, "arena_live_battles")) {
					var content = document.getElementById("sos-content");
					if (content) content.innerHTML = '<section class="mmed-arena-battle-page"><div class="mmed-arena-battle-error"><h1>Battle unavailable</h1><p>Arena Battle is not enabled.</p></div></section>';
					return;
				}

				window.mmedArenaBattleView = new ArenaBattleView(app);
				window.mmedArenaBattleView.init(match[1]);
				return;
			}

			if (window.mmedArenaBattleView && typeof window.mmedArenaBattleView.destroy === "function") {
				window.mmedArenaBattleView.destroy();
				window.mmedArenaBattleView = null;
			}

			originalRoute();
		};

		if (/^#\/?arena-battle\/\d+$/.test(window.location.hash || "")) {
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
		installRoute(window.MMED_OS);
	}, 100);

	window.MMEDArenaBattleView = ArenaBattleView;
})();
