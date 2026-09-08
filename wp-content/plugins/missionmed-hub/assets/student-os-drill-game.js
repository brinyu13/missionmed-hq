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

	function featureEnabled(view, flag) {
		var app = view && view.app ? view.app : window.MMED_OS || {};
		var flags = app.feature_flags || {};
		return flags[flag] === true;
	}

	function isDrillSession(view) {
		var info = view && view.joinInfo ? view.joinInfo : {};
		return featureEnabled(view, "drill_gamification")
			&& !!info.session_group_id
			&& !!info.event_date
			&& (info.event_type === "drill_step1" || info.event_type === "drill_step23");
	}

	function ensureState(view) {
		if (!view.drillState) {
			view.drillState = {
				score: null,
				leaderboard: [],
				loading: false,
				cooldown: false,
				timer: null
			};
		}
		return view.drillState;
	}

	function emptyScore() {
		return {
			questions_attempted: 0,
			questions_correct: 0,
			accuracy: 0,
			points_earned: 0,
			current_streak: 0,
			streak_max: 0
		};
	}

	function render(view) {
		if (!isDrillSession(view)) {
			return "";
		}

		var state = ensureState(view);
		var score = state.score || emptyScore();
		var board = Array.isArray(state.leaderboard) ? state.leaderboard : [];
		var rows = board.slice(0, 5).map(function (row) {
			return '<li><span>#' + parseInt(row.rank || 0, 10) + " " + esc(row.display_name || "Student") + '</span><strong>' + parseInt(row.points_earned || 0, 10) + "</strong></li>";
		}).join("");

		return [
			'<section class="mmed-drill-game-panel" data-drill-game-panel>',
			'<div class="mmed-drill-game-head">',
			"<div>",
			'<span class="mmed-drill-game-label">Self-reported practice score</span>',
			"<h2>Dr. J Drill Scoreboard</h2>",
			"<p>Practice momentum only. This is not official grading.</p>",
			"</div>",
			'<div class="mmed-drill-game-points"><strong>' + parseInt(score.points_earned || 0, 10) + '</strong><span>points</span></div>',
			"</div>",
			'<div class="mmed-drill-game-actions">',
			'<button type="button" data-drill-answer="true"' + (state.cooldown ? " disabled" : "") + ">Got It Right</button>",
			'<button type="button" data-drill-answer="false"' + (state.cooldown ? " disabled" : "") + ">Got It Wrong</button>",
			"</div>",
			'<div class="mmed-drill-game-stats">',
			stat(score.questions_correct + "/" + score.questions_attempted, "running score"),
			stat(score.accuracy + "%", "accuracy"),
			stat(score.current_streak, "current streak"),
			stat(score.streak_max, "best streak"),
			"</div>",
			'<div class="mmed-drill-game-leaders">',
			"<h3>Top 5</h3>",
			"<ol>" + (rows || '<li><span>No scores yet</span><strong>0</strong></li>') + "</ol>",
			"</div>",
			"</section>"
		].join("");
	}

	function stat(value, label) {
		return '<div><strong>' + esc(value) + '</strong><span>' + esc(label) + "</span></div>";
	}

	function bind(view) {
		if (!isDrillSession(view) || !view.root) {
			return;
		}

		view.root.querySelectorAll("[data-drill-answer]").forEach(function (button) {
			button.addEventListener("click", function () {
				submit(view, button.getAttribute("data-drill-answer") === "true");
			});
		});
	}

	function start(view) {
		if (!isDrillSession(view)) {
			stop(view);
			return;
		}

		var state = ensureState(view);
		refreshPanel(view);
		loadLeaderboard(view);
		if (!state.timer) {
			state.timer = window.setInterval(function () {
				loadLeaderboard(view);
			}, 10000);
		}
	}

	function stop(view) {
		var state = view ? view.drillState : null;
		if (!state) return;
		window.clearInterval(state.timer);
		state.timer = null;
	}

	function submit(view, correct) {
		var state = ensureState(view);
		var info = view.joinInfo || {};
		if (state.cooldown) return;

		state.cooldown = true;
		refreshPanel(view);

		view.apiPost("/drills/answer", {
			session_group_id: info.session_group_id,
			event_date: info.event_date,
			correct: !!correct
		}).then(function (payload) {
			state.score = payload && payload.score ? payload.score : state.score;
			return loadLeaderboard(view);
		}).catch(function (error) {
			if (window.console && console.warn) {
				console.warn(error && error.message ? error.message : "Could not save drill score.");
			}
		}).finally(function () {
			window.setTimeout(function () {
				state.cooldown = false;
				refreshPanel(view);
			}, 500);
		});
	}

	function loadLeaderboard(view) {
		var state = ensureState(view);
		var info = view.joinInfo || {};
		if (!isDrillSession(view)) {
			return Promise.resolve();
		}

		return view.apiGet("/drills/leaderboard", {
			session_group_id: info.session_group_id,
			date: info.event_date
		}).then(function (payload) {
			state.leaderboard = payload && Array.isArray(payload.leaderboard) ? payload.leaderboard : [];
			if (!state.score) {
				var currentUserId = view.app && view.app.state && view.app.state.profile ? parseInt(view.app.state.profile.id || 0, 10) : 0;
				state.score = state.leaderboard.filter(function (row) {
					return parseInt(row.user_id || 0, 10) === currentUserId;
				})[0] || emptyScore();
			}
			refreshPanel(view);
		});
	}

	function refreshPanel(view) {
		if (!view || !view.root) return;
		var html = render(view);
		var old = view.root.querySelector("[data-drill-game-panel]");
		if (!html) {
			if (old && old.parentNode) {
				old.parentNode.removeChild(old);
			}
			return;
		}

		var replacement = document.createElement("div");
		replacement.innerHTML = html;
		var panel = replacement.firstElementChild;
		if (!panel) {
			return;
		}

		if (old) {
			old.replaceWith(panel);
		} else {
			var host = view.root.querySelector("[data-drill-game-mount]") || view.root.querySelector(".mmed-live-main");
			if (!host) {
				return;
			}
			host.appendChild(panel);
		}
		bind(view);
	}

	function attachToActiveView() {
		var view = window.mmedLiveSessionView || null;
		if (!view || !view.root || !view.joinInfo || !isDrillSession(view)) {
			return;
		}
		refreshPanel(view);
		start(view);
	}

	window.MMEDDrillGamePanel = {
		render: render,
		bind: bind,
		start: start,
		stop: stop,
		isDrillSession: isDrillSession,
		refresh: refreshPanel
	};

	window.setTimeout(attachToActiveView, 0);
})();
