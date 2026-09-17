(function () {
	"use strict";

	var root = document.getElementById("mmed-arena-battles-root");
	var config = window.mmedArenaAdmin || {};

	if (!root || !config.featureEnabled) {
		return;
	}

	var state = {
		groups: [],
		battles: [],
		selectedBattle: null,
		questions: [blankQuestion()],
		loading: false,
		leaderboardTimer: null
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

	function api(url, options) {
		options = options || {};
		var headers = options.headers || {};
		headers["X-WP-Nonce"] = config.nonce || "";
		if (options.body && typeof options.body !== "string") {
			headers["Content-Type"] = "application/json";
			options.body = JSON.stringify(options.body);
		}
		options.headers = headers;

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

	function adminUrl(path) {
		return String(config.arenaRestUrl || "").replace(/\/$/, "") + (path || "");
	}

	function sessionsUrl() {
		return String(config.sessionsRestUrl || "").replace(/\/$/, "");
	}

	function blankQuestion() {
		return {
			question_text: "",
			question_type: "mcq",
			options: ["", "", "", ""],
			correct_answer: "0",
			explanation: "",
			points: 100,
			time_limit_override: ""
		};
	}

	function formatLabel(value) {
		return String(value || "").replace(/_/g, " ").replace(/\b\w/g, function (letter) {
			return letter.toUpperCase();
		});
	}

	function today() {
		return new Date().toISOString().slice(0, 10);
	}

	function toast(message, type) {
		var tray = root.querySelector("[data-arena-toast-tray]");
		if (!tray) return;
		var note = document.createElement("div");
		note.className = "mmed-arena-toast is-" + (type || "success");
		note.textContent = message;
		tray.appendChild(note);
		window.setTimeout(function () {
			note.remove();
		}, 4200);
	}

	function render() {
		root.innerHTML = [
			'<section class="mmed-arena-admin">',
			'<div class="mmed-arena-admin-head">',
			'<div>',
			'<p class="mmed-session-eyebrow">Arena Live Battles</p>',
			"<h2>Battle Control</h2>",
			"<p>Create server-timed Matrix battles for Webex live sessions.</p>",
			"</div>",
			'<button type="button" class="button" data-arena-refresh>Refresh</button>',
			"</div>",
			'<div class="mmed-arena-admin-grid">',
			renderCreatePanel(),
			renderBattleList(),
			"</div>",
			renderLeaderboardPanel(),
			'<div class="mmed-arena-toast-tray" data-arena-toast-tray></div>',
			"</section>"
		].join("");

		bind();
	}

	function renderCreatePanel() {
		return [
			'<form class="mmed-arena-panel" data-arena-create-form>',
			'<div class="mmed-arena-panel-head"><h3>Create Battle</h3><span>Feature-flag gated</span></div>',
			'<div class="mmed-arena-form-grid">',
			'<label>Session Group<select name="session_group_id" required>' + renderGroupOptions() + "</select></label>",
			'<label>Event Date<input type="date" name="event_date" value="' + today() + '" required></label>',
			'<label>Title<input name="battle_title" value="Arena Battle" maxlength="255" required></label>',
			'<label>Format<select name="battle_format">' + renderFormatOptions() + "</select></label>",
			'<label>Seconds Per Question<input type="number" min="5" max="600" name="time_per_question_seconds" value="30"></label>',
			"</div>",
			renderQuestionEditor(),
			'<label class="mmed-arena-bulk">Bulk Import<textarea data-arena-bulk rows="5" placeholder="Question | Option A | Option B | Option C | Option D | Correct index | Explanation"></textarea></label>',
			'<div class="mmed-arena-actions">',
			'<button type="button" class="button" data-arena-import>Import Lines</button>',
			'<button type="button" class="button" data-arena-add-question>Add Question</button>',
			'<button type="submit" class="button button-primary">Create Battle</button>',
			"</div>",
			"</form>"
		].join("");
	}

	function renderGroupOptions() {
		if (!state.groups.length) {
			return '<option value="">No groups loaded</option>';
		}
		return state.groups.map(function (group) {
			return '<option value="' + group.id + '">' + esc(group.group_name || group.group_slug) + " (" + esc(group.event_type) + ")</option>";
		}).join("");
	}

	function renderFormatOptions() {
		var formats = Array.isArray(config.formats) ? config.formats : ["lightning"];
		return formats.map(function (format) {
			return '<option value="' + attr(format) + '">' + esc(formatLabel(format)) + "</option>";
		}).join("");
	}

	function renderQuestionEditor() {
		return [
			'<div class="mmed-arena-question-stack">',
			state.questions.map(renderQuestion).join(""),
			"</div>"
		].join("");
	}

	function renderQuestion(question, index) {
		var letters = ["A", "B", "C", "D"];
		return [
			'<fieldset class="mmed-arena-question" data-question-index="' + index + '">',
			'<legend>Question ' + (index + 1) + "</legend>",
			index > 0 ? '<button type="button" class="button-link-delete mmed-arena-remove" data-remove-question="' + index + '">Remove</button>' : "",
			'<label>Question Text<textarea data-question-field="question_text" rows="3">' + esc(question.question_text) + "</textarea></label>",
			'<div class="mmed-arena-options">',
			letters.map(function (letter, optionIndex) {
				return '<label>' + letter + '<input data-option-index="' + optionIndex + '" value="' + attr(question.options[optionIndex] || "") + '"></label>';
			}).join(""),
			"</div>",
			'<div class="mmed-arena-question-row">',
			'<label>Correct<select data-question-field="correct_answer">' + [0, 1, 2, 3].map(function (optionIndex) {
				return '<option value="' + optionIndex + '"' + (String(question.correct_answer) === String(optionIndex) ? " selected" : "") + ">" + letters[optionIndex] + "</option>";
			}).join("") + "</select></label>",
			'<label>Points<input type="number" min="0" max="10000" data-question-field="points" value="' + attr(question.points) + '"></label>',
			'<label>Override Seconds<input type="number" min="5" max="600" data-question-field="time_limit_override" value="' + attr(question.time_limit_override) + '"></label>',
			"</div>",
			'<label>Explanation<textarea data-question-field="explanation" rows="2">' + esc(question.explanation) + "</textarea></label>",
			"</fieldset>"
		].join("");
	}

	function renderBattleList() {
		var rows = state.battles.map(function (battle) {
			return [
				'<tr data-battle-row="' + battle.id + '">',
				"<td><strong>" + esc(battle.battle_title) + '</strong><span class="mmed-session-sub">' + esc(battle.event_date) + "</span></td>",
				"<td>" + esc(formatLabel(battle.battle_format)) + '</td>',
				'<td><span class="mmed-arena-status is-' + attr(battle.status) + '">' + esc(battle.status) + "</span></td>",
				"<td>" + parseInt(battle.question_count || 0, 10) + "</td>",
				'<td class="mmed-arena-row-actions">',
				'<button type="button" class="button" data-battle-select="' + battle.id + '">Leaderboard</button>',
				battle.status === "draft" ? '<button type="button" class="button button-primary" data-battle-start="' + battle.id + '">Start</button>' : "",
				battle.status === "active" ? '<button type="button" class="button" data-battle-advance="' + battle.id + '">Advance</button>' : "",
				battle.status === "active" ? '<button type="button" class="button button-link-delete" data-battle-end="' + battle.id + '">End</button>' : "",
				"</td>",
				"</tr>"
			].join("");
		}).join("");

		return [
			'<div class="mmed-arena-panel">',
			'<div class="mmed-arena-panel-head"><h3>Battle List</h3><span>' + state.battles.length + " loaded</span></div>",
			state.loading ? '<div class="mmed-session-loading"><span class="spinner is-active"></span> Loading battles...</div>' : "",
			'<table class="widefat striped mmed-arena-table">',
			"<thead><tr><th>Battle</th><th>Format</th><th>Status</th><th>Questions</th><th>Actions</th></tr></thead>",
			"<tbody>" + (rows || '<tr><td colspan="5">No battles yet.</td></tr>') + "</tbody>",
			"</table>",
			"</div>"
		].join("");
	}

	function renderLeaderboardPanel() {
		var battle = state.selectedBattle;
		if (!battle) {
			return '<div class="mmed-arena-panel mmed-arena-leaderboard"><div class="mmed-arena-panel-head"><h3>Live Leaderboard</h3><span>Select a battle</span></div><p class="description">Use the Battle List to view results and monitor scores.</p></div>';
		}

		var board = Array.isArray(battle.leaderboard) ? battle.leaderboard : [];
		var rows = board.slice(0, 10).map(function (row) {
			return '<tr><td>#' + parseInt(row.rank || 0, 10) + '</td><td>' + esc(row.display_name || "Student") + '</td><td>' + parseInt(row.total_points || 0, 10) + '</td><td>' + parseInt(row.correct_count || row.questions_correct || 0, 10) + '</td></tr>';
		}).join("");

		return [
			'<div class="mmed-arena-panel mmed-arena-leaderboard">',
			'<div class="mmed-arena-panel-head"><h3>' + esc(battle.battle_title || "Live Leaderboard") + '</h3><span>' + esc(battle.status || "") + "</span></div>",
			'<table class="widefat striped">',
			"<thead><tr><th>Rank</th><th>Student</th><th>Points</th><th>Correct</th></tr></thead>",
			"<tbody>" + (rows || '<tr><td colspan="4">No responses yet.</td></tr>') + "</tbody>",
			"</table>",
			"</div>"
		].join("");
	}

	function bind() {
		var refresh = root.querySelector("[data-arena-refresh]");
		if (refresh) refresh.addEventListener("click", loadAll);

		var form = root.querySelector("[data-arena-create-form]");
		if (form) form.addEventListener("submit", createBattle);

		root.querySelectorAll("[data-question-field]").forEach(function (input) {
			input.addEventListener("input", syncQuestionsFromDom);
			input.addEventListener("change", syncQuestionsFromDom);
		});

		root.querySelectorAll("[data-option-index]").forEach(function (input) {
			input.addEventListener("input", syncQuestionsFromDom);
		});

		root.querySelectorAll("[data-remove-question]").forEach(function (button) {
			button.addEventListener("click", function () {
				syncQuestionsFromDom();
				state.questions.splice(parseInt(button.getAttribute("data-remove-question"), 10), 1);
				render();
			});
		});

		var add = root.querySelector("[data-arena-add-question]");
		if (add) add.addEventListener("click", function () {
			syncQuestionsFromDom();
			state.questions.push(blankQuestion());
			render();
		});

		var importButton = root.querySelector("[data-arena-import]");
		if (importButton) importButton.addEventListener("click", importBulkQuestions);

		root.querySelectorAll("[data-battle-start]").forEach(function (button) {
			button.addEventListener("click", function () { battleAction(button.getAttribute("data-battle-start"), "/start", "Battle started."); });
		});
		root.querySelectorAll("[data-battle-advance]").forEach(function (button) {
			button.addEventListener("click", function () { battleAction(button.getAttribute("data-battle-advance"), "/advance", "Question advanced."); });
		});
		root.querySelectorAll("[data-battle-end]").forEach(function (button) {
			button.addEventListener("click", function () { battleAction(button.getAttribute("data-battle-end"), "/end", "Battle ended."); });
		});
		root.querySelectorAll("[data-battle-select]").forEach(function (button) {
			button.addEventListener("click", function () { selectBattle(button.getAttribute("data-battle-select")); });
		});
	}

	function syncQuestionsFromDom() {
		root.querySelectorAll("[data-question-index]").forEach(function (fieldset) {
			var index = parseInt(fieldset.getAttribute("data-question-index"), 10);
			var question = state.questions[index] || blankQuestion();
			fieldset.querySelectorAll("[data-question-field]").forEach(function (field) {
				question[field.getAttribute("data-question-field")] = field.value;
			});
			fieldset.querySelectorAll("[data-option-index]").forEach(function (field) {
				question.options[parseInt(field.getAttribute("data-option-index"), 10)] = field.value;
			});
			state.questions[index] = question;
		});
	}

	function importBulkQuestions() {
		var input = root.querySelector("[data-arena-bulk]");
		var lines = input ? input.value.split(/\r?\n/) : [];
		var imported = [];
		lines.forEach(function (line) {
			var parts = line.split("|").map(function (part) { return part.trim(); });
			if (parts.length >= 6 && parts[0]) {
				imported.push({
					question_text: parts[0],
					question_type: "mcq",
					options: [parts[1], parts[2], parts[3], parts[4]],
					correct_answer: String(Math.max(0, Math.min(3, parseInt(parts[5], 10) || 0))),
					explanation: parts[6] || "",
					points: 100,
					time_limit_override: ""
				});
			}
		});

		if (!imported.length) {
			toast("No importable questions found.", "error");
			return;
		}

		syncQuestionsFromDom();
		state.questions = state.questions.concat(imported);
		if (input) input.value = "";
		toast("Imported " + imported.length + " questions.");
		render();
	}

	function createBattle(event) {
		event.preventDefault();
		syncQuestionsFromDom();
		var data = new FormData(event.currentTarget);
		var questions = state.questions.filter(function (question) {
			return question.question_text && question.options.filter(Boolean).length >= 2;
		}).map(function (question) {
			return {
				question_text: question.question_text,
				question_type: "mcq",
				options: question.options,
				correct_answer: String(question.correct_answer || "0"),
				explanation: question.explanation || "",
				points: parseInt(question.points || 100, 10),
				time_limit_override: question.time_limit_override ? parseInt(question.time_limit_override, 10) : ""
			};
		});

		if (!questions.length) {
			toast("Add at least one valid question.", "error");
			return;
		}

		var payload = {
			session_group_id: parseInt(data.get("session_group_id"), 10),
			event_date: data.get("event_date"),
			battle_title: data.get("battle_title"),
			battle_format: data.get("battle_format"),
			time_per_question_seconds: parseInt(data.get("time_per_question_seconds") || 30, 10),
			questions: questions
		};

		api(adminUrl(""), { method: "POST", body: payload }).then(function () {
			state.questions = [blankQuestion()];
			toast("Battle created.");
			loadAll();
		}).catch(function (error) {
			toast(error.message || "Could not create battle.", "error");
		});
	}

	function battleAction(id, action, message) {
		api(adminUrl("/" + parseInt(id, 10) + action), { method: "POST", body: {} }).then(function () {
			toast(message);
			loadBattles();
			if (state.selectedBattle && parseInt(state.selectedBattle.id, 10) === parseInt(id, 10)) {
				selectBattle(id);
			}
		}).catch(function (error) {
			toast(error.message || "Battle action failed.", "error");
		});
	}

	function selectBattle(id) {
		id = parseInt(id, 10);
		var battle = state.battles.filter(function (item) { return parseInt(item.id, 10) === id; })[0] || null;
		if (!battle) return;

		api(adminUrl("/" + id + "/results"), { method: "GET" }).then(function (payload) {
			state.selectedBattle = Object.assign({}, battle, payload || {});
			render();
			startLeaderboardTimer(id);
		}).catch(function (error) {
			toast(error.message || "Could not load leaderboard.", "error");
		});
	}

	function startLeaderboardTimer(id) {
		window.clearInterval(state.leaderboardTimer);
		state.leaderboardTimer = window.setInterval(function () {
			if (!document.body.contains(root)) {
				window.clearInterval(state.leaderboardTimer);
				return;
			}
			selectBattle(id);
		}, 5000);
	}

	function loadGroups() {
		if (!sessionsUrl()) return Promise.resolve();
		return api(sessionsUrl() + "?active_only=1", { method: "GET" }).then(function (payload) {
			state.groups = payload && Array.isArray(payload.groups) ? payload.groups : [];
		});
	}

	function loadBattles() {
		state.loading = true;
		render();
		return api(adminUrl(""), { method: "GET" }).then(function (payload) {
			state.battles = payload && Array.isArray(payload.battles) ? payload.battles : [];
			state.loading = false;
			render();
		}).catch(function (error) {
			state.loading = false;
			render();
			toast(error.message || "Could not load battles.", "error");
		});
	}

	function loadAll() {
		return loadGroups().then(loadBattles).catch(function (error) {
			toast(error.message || "Could not load Arena Battle admin.", "error");
		});
	}

	render();
	loadAll();
})();
