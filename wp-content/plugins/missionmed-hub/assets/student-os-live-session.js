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

	function formatTime(value) {
		if (!value) return "";
		var date = new Date(value.replace(" ", "T"));
		if (isNaN(date.getTime())) return "";
		return date.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"});
	}

	function formatCountdown(ms) {
		ms = Math.max(0, ms);
		var total = Math.floor(ms / 1000);
		var hours = Math.floor(total / 3600);
		var minutes = Math.floor((total % 3600) / 60);
		var seconds = total % 60;
		return [
			hours,
			minutes < 10 ? "0" + minutes : minutes,
			seconds < 10 ? "0" + seconds : seconds
		].join(":");
	}

	function LiveSessionView(app) {
		this.app = app || window.MMED_OS || {};
		this.root = document.getElementById("sos-content");
		this.eventId = null;
		this.joinInfo = null;
		this.widget = null;
		this.countdownTimer = null;
		this.refreshTimer = null;
		this.headerTimer = null;
		this.chatTimer = null;
		this.battleTimer = null;
		this.chatMessages = [];
		this.chatOpen = true;
		this.activeBattle = null;
		this.drillState = null;
	}

	LiveSessionView.prototype.init = function (eventId) {
		this.destroy(false);
		this.root = document.getElementById("sos-content");
		this.eventId = parseInt(eventId, 10);
		this.renderLoading();
		return this.load();
	};

	LiveSessionView.prototype.destroy = function (clearContent) {
		window.clearInterval(this.countdownTimer);
		window.clearInterval(this.refreshTimer);
		window.clearInterval(this.headerTimer);
		window.clearInterval(this.chatTimer);
		window.clearInterval(this.battleTimer);
		this.countdownTimer = null;
		this.refreshTimer = null;
		this.headerTimer = null;
		this.chatTimer = null;
		this.battleTimer = null;

		if (window.MMEDDrillGamePanel && typeof window.MMEDDrillGamePanel.stop === "function") {
			window.MMEDDrillGamePanel.stop(this);
		}
		if (window.MMEDOfficeHoursPanel && typeof window.MMEDOfficeHoursPanel.stop === "function") {
			window.MMEDOfficeHoursPanel.stop(this);
		}

		if (this.widget) {
			try {
				if (typeof this.widget.leave === "function") this.widget.leave();
				if (typeof this.widget.close === "function") this.widget.close();
				if (typeof this.widget.destroy === "function") this.widget.destroy();
			} catch (error) {
				/* Ignore widget cleanup errors. */
			}
		}

		this.widget = null;

		if (clearContent !== false && this.root) {
			this.root.innerHTML = "";
		}
	};

	LiveSessionView.prototype.apiGet = function (endpoint, params) {
		if (this.app.api && typeof this.app.api.get === "function") {
			return this.app.api.get(endpoint, params || {});
		}
		return Promise.reject(new Error("Matrix API is unavailable."));
	};

	LiveSessionView.prototype.apiPost = function (endpoint, body) {
		if (this.app.api && typeof this.app.api.post === "function") {
			return this.app.api.post(endpoint, body || {});
		}
		return Promise.reject(new Error("Matrix API is unavailable."));
	};

	LiveSessionView.prototype.featureEnabled = function (flag) {
		var flags = (this.app && this.app.feature_flags) || (window.MMED_OS && window.MMED_OS.feature_flags) || {};
		return flags[flag] === true;
	};

	LiveSessionView.prototype.canUseEmbeddedWidget = function () {
		return !!(this.joinInfo && this.joinInfo.widget_enabled && this.featureEnabled("webex_embedded_widget"));
	};

	LiveSessionView.prototype.recordingAvailable = function () {
		return !!(this.joinInfo && this.joinInfo.has_recording && this.featureEnabled("session_recordings"));
	};

	LiveSessionView.prototype.isOfficeHours = function () {
		return !!(this.joinInfo && this.joinInfo.event_type === "office_hours" && this.featureEnabled("office_hours_queue") && window.MMEDOfficeHoursPanel);
	};

	LiveSessionView.prototype.load = function () {
		var self = this;
		return this.apiGet("/meetings/" + this.eventId + "/join").then(function (info) {
			self.joinInfo = info || {};
			if (self.isEnded()) {
				self.renderEnded();
				return;
			}
			if (self.isOfficeHours()) {
				self.renderOfficeHoursQueue();
				if (window.MMEDOfficeHoursPanel && typeof window.MMEDOfficeHoursPanel.start === "function") {
					window.MMEDOfficeHoursPanel.start(self);
				}
				return;
			}
			if (!self.joinInfo.can_join) {
				self.renderWaiting();
				return;
			}
			if (!self.canUseEmbeddedWidget()) {
				self.renderExternalFallback();
				return;
			}
			self.renderWidgetLoading();
			return self.apiGet("/webex/guest-token").then(function (token) {
				self.initializeWidget(token && token.token);
			}).catch(function (error) {
				self.renderError(error, true);
			});
		}).catch(function (error) {
			self.renderError(error, false);
		});
	};

	LiveSessionView.prototype.renderHeader = function (live) {
		var info = this.joinInfo || {};
		var title = info.title || "Live Session";
		var start = formatTime(info.start_at);
		var end = formatTime(info.end_at);
		var time = [start, end].filter(Boolean).join(" to ");

		return [
			'<header class="mmed-live-session-header">',
			'<button type="button" class="mmed-live-back" data-live-back aria-label="Back to calendar">‹</button>',
			'<div class="mmed-live-title-wrap">',
			'<div class="mmed-live-title-row">',
			'<h1>' + esc(title) + "</h1>",
			live ? '<span class="mmed-live-pill"><span class="mmed-live-indicator"></span>LIVE</span>' : "",
			"</div>",
			time ? '<p>' + esc(time) + "</p>" : "",
			"</div>",
			'<span class="mmed-live-time-badge" data-live-time-badge>' + esc(this.timeBadgeText()) + "</span>",
			'<button type="button" class="mmed-live-leave" data-live-leave>Leave Session</button>',
			"</header>"
		].join("");
	};

	LiveSessionView.prototype.renderPage = function (body, live) {
		if (!this.root) return;
		this.root.innerHTML = [
			'<section class="mmed-live-session-container">',
			this.renderHeader(live),
			'<div class="mmed-live-layout">',
			'<main class="mmed-live-main">',
			this.renderArenaBattleHost(),
			body,
			this.renderDrillGamePanel(live),
			"</main>",
			this.renderChatSidebar(live),
			"</div>",
			"</section>"
		].join("");
		this.bindCommon();
		this.bindChat();
		this.loadChat();
		this.startArenaBattlePolling();
		this.bindDrillGame();
		this.startHeaderTimer();
	};

	LiveSessionView.prototype.renderOfficeHoursQueue = function () {
		if (!this.root) return;
		this.root.innerHTML = [
			'<section class="mmed-live-session-container">',
			this.renderHeader(true),
			'<div class="mmed-live-layout mmed-live-office-hours-layout">',
			'<main class="mmed-live-main">',
			window.MMEDOfficeHoursPanel && typeof window.MMEDOfficeHoursPanel.render === "function" ? window.MMEDOfficeHoursPanel.render(this) : "",
			"</main>",
			"</div>",
			"</section>"
		].join("");
		this.bindCommon();
		if (window.MMEDOfficeHoursPanel && typeof window.MMEDOfficeHoursPanel.bind === "function") {
			window.MMEDOfficeHoursPanel.bind(this);
		}
		this.startHeaderTimer();
	};

	LiveSessionView.prototype.renderLoading = function () {
		if (!this.root) return;
		this.root.innerHTML = '<section class="mmed-live-session-container"><div class="mmed-live-loading">Loading live session...</div></section>';
	};

	LiveSessionView.prototype.renderWaiting = function () {
		var self = this;
		var info = this.joinInfo || {};
		var body = [
			'<div class="mmed-waiting-room">',
			'<span class="mmed-waiting-kicker">Waiting Room</span>',
			'<h2>' + esc(info.title || "Live Session") + "</h2>",
			info.description ? '<p>' + esc(info.description) + "</p>" : "",
			'<div class="mmed-countdown" data-live-countdown>' + esc(this.countdownText()) + "</div>",
			'<span class="mmed-waiting-note">This room opens 15 minutes before start time.</span>',
			"</div>"
		].join("");

		this.renderPage(body, false);
		this.countdownTimer = window.setInterval(function () {
			var el = self.root ? self.root.querySelector("[data-live-countdown]") : null;
			if (el) el.textContent = self.countdownText();
		}, 1000);
		this.refreshTimer = window.setInterval(function () {
			self.load();
		}, 30000);
	};

	LiveSessionView.prototype.renderExternalFallback = function () {
		var info = this.joinInfo || {};
		var body = [
			'<div class="mmed-live-fallback">',
			"<h2>Open in Webex</h2>",
			'<p>This session is ready. Embedded joining is not enabled for this meeting yet.</p>',
			'<div class="mmed-live-fallback-actions">',
			info.meeting_url ? '<a class="mmed-live-primary" href="' + attr(info.meeting_url) + '" target="_blank" rel="noopener">Open in Webex</a>' : "",
			this.recordingAvailable() ? '<button type="button" class="mmed-live-secondary" data-live-recording>Watch Recording</button>' : "",
			info.meeting_url ? '<button type="button" class="mmed-live-secondary" data-copy-meeting>Copy Link</button>' : "",
			"</div>",
			"</div>"
		].join("");

		this.renderPage(body, true);
	};

	LiveSessionView.prototype.renderEnded = function () {
		var copy = this.featureEnabled("session_chat") ? "This live session has ended. Chat history remains available for review." : "This live session has ended.";
		var body = [
			'<div class="mmed-live-fallback">',
			"<h2>Session ended</h2>",
			"<p>" + esc(copy) + "</p>",
			'<div class="mmed-live-fallback-actions">',
			this.recordingAvailable() ? '<button type="button" class="mmed-live-primary" data-live-recording>Watch Recording</button>' : '<span class="mmed-live-secondary">Recording not available yet</span>',
			"</div>",
			"</div>"
		].join("");

		this.renderPage(body, false);
	};

	LiveSessionView.prototype.renderWidgetLoading = function () {
		var body = [
			'<div class="mmed-webex-stage">',
			'<div id="webex-meeting-widget" aria-label="Webex meeting widget">',
			'<div class="mmed-live-loading">Starting embedded Webex session...</div>',
			"</div>",
			"</div>"
		].join("");
		this.renderPage(body, true);
	};

	LiveSessionView.prototype.initializeWidget = function (guestToken) {
		var info = this.joinInfo || {};
		var widgetEl = document.getElementById("webex-meeting-widget");
		var destination = info.sip_address || info.meeting_url || "";

		if (!guestToken || !destination || !widgetEl) {
			this.renderExternalFallback();
			return;
		}

		if (window.MmedWebexWidget && typeof window.MmedWebexWidget.init === "function") {
			this.widget = window.MmedWebexWidget.init(widgetEl, guestToken, destination);
			return;
		}

		if (!window.webex || !window.webex.widget) {
			this.renderExternalFallback();
			return;
		}

		this.widget = window.webex.widget(widgetEl).meetings.open({
			destination: destination,
			destinationType: info.sip_address ? "sip" : "uri",
			accessToken: guestToken,
			theme: "dark",
			layout: "Grid",
			controls: {
				mute: true,
				camera: true,
				share: true,
				participants: true,
				leave: true,
				fullscreen: true
			}
		});
	};

	LiveSessionView.prototype.renderError = function (error, hasJoinInfo) {
		var info = this.joinInfo || {};
		var body = [
			'<div class="mmed-live-error">',
			"<h2>Could not start the session</h2>",
			'<p>' + esc(error && error.message ? error.message : "Something went wrong while loading this meeting.") + "</p>",
			'<div class="mmed-live-fallback-actions">',
			'<button type="button" class="mmed-live-primary" data-live-retry>Try Again</button>',
			hasJoinInfo && info.meeting_url ? '<a class="mmed-live-secondary" href="' + attr(info.meeting_url) + '" target="_blank" rel="noopener">Open in Webex</a>' : "",
			"</div>",
			"</div>"
		].join("");
		this.renderPage(body, !!(hasJoinInfo && info.can_join));
	};

	LiveSessionView.prototype.bindCommon = function () {
		var self = this;
		if (!this.root) return;

		this.root.querySelectorAll("[data-live-back], [data-live-leave]").forEach(function (button) {
			button.addEventListener("click", function () {
				self.destroy(false);
				window.location.hash = "#/calendar";
			});
		});

		var retry = this.root.querySelector("[data-live-retry]");
		if (retry) {
			retry.addEventListener("click", function () {
				self.renderLoading();
				self.load();
			});
		}

		var copy = this.root.querySelector("[data-copy-meeting]");
		if (copy) {
			copy.addEventListener("click", function () {
				if (navigator.clipboard && navigator.clipboard.writeText && self.joinInfo && self.joinInfo.meeting_url) {
					navigator.clipboard.writeText(self.joinInfo.meeting_url);
				}
			});
		}

		var recording = this.root.querySelector("[data-live-recording]");
		if (recording) {
			recording.addEventListener("click", function () {
				self.apiGet("/meetings/" + self.eventId + "/recording").then(function (payload) {
					var url = payload && (payload.recording_url || (payload.recording && payload.recording.playback_url));
					if (url) {
						window.open(url, "_blank", "noopener");
					}
				}).catch(function (error) {
					self.renderError(error, true);
				});
			});
		}

		this.bindArenaBattleBanner();
	};

	LiveSessionView.prototype.bindArenaBattleBanner = function () {
		var self = this;
		var battle = this.root ? this.root.querySelector("[data-join-arena-battle]") : null;
		if (!battle || battle.getAttribute("data-bound") === "1") {
			return;
		}

		battle.setAttribute("data-bound", "1");
		battle.addEventListener("click", function () {
			var battleId = parseInt(battle.getAttribute("data-join-arena-battle"), 10);
			if (battleId) {
				self.destroy(false);
				window.location.hash = "#/arena-battle/" + battleId;
			}
		});
	};

	LiveSessionView.prototype.renderArenaBattleHost = function () {
		if (!this.featureEnabled("arena_live_battles")) {
			return "";
		}

		return '<div data-arena-live-battle-host>' + this.renderArenaBattleBanner() + "</div>";
	};

	LiveSessionView.prototype.renderArenaBattleBanner = function () {
		var battle = this.activeBattle || null;
		if (!battle || !battle.id) {
			return "";
		}

		return [
			'<div class="mmed-arena-live-banner">',
			"<div>",
			"<strong>Arena Battle is LIVE</strong>",
			"<span>" + esc(battle.battle_title || "Join the active battle") + "</span>",
			"</div>",
			'<button type="button" data-join-arena-battle="' + attr(battle.id) + '">Join Battle</button>',
			"</div>"
		].join("");
	};

	LiveSessionView.prototype.startArenaBattlePolling = function () {
		var self = this;
		var info = this.joinInfo || {};
		if (!this.featureEnabled("arena_live_battles") || !info.session_group_id || !info.event_date) {
			window.clearInterval(this.battleTimer);
			this.battleTimer = null;
			this.activeBattle = null;
			return;
		}

		this.loadActiveBattle();

		if (!this.battleTimer) {
			this.battleTimer = window.setInterval(function () {
				self.loadActiveBattle();
			}, 5000);
		}
	};

	LiveSessionView.prototype.loadActiveBattle = function () {
		var self = this;
		var info = this.joinInfo || {};
		return this.apiGet("/arena-battles/active", {
			session_group_id: info.session_group_id,
			date: info.event_date
		}).then(function (payload) {
			var battles = payload && Array.isArray(payload.battles) ? payload.battles : [];
			self.activeBattle = battles.length ? battles[0] : null;
			self.refreshArenaBattleBanner();
		}).catch(function () {
			self.activeBattle = null;
			self.refreshArenaBattleBanner();
		});
	};

	LiveSessionView.prototype.refreshArenaBattleBanner = function () {
		var host = this.root ? this.root.querySelector("[data-arena-live-battle-host]") : null;
		if (!host) {
			return;
		}
		host.innerHTML = this.renderArenaBattleBanner();
		this.bindArenaBattleBanner();
	};

	LiveSessionView.prototype.renderDrillGamePanel = function (live) {
		if (!live || !window.MMEDDrillGamePanel || typeof window.MMEDDrillGamePanel.render !== "function") {
			return "";
		}
		return window.MMEDDrillGamePanel.render(this);
	};

	LiveSessionView.prototype.bindDrillGame = function () {
		if (!window.MMEDDrillGamePanel) {
			return;
		}
		if (typeof window.MMEDDrillGamePanel.bind === "function") {
			window.MMEDDrillGamePanel.bind(this);
		}
		if (typeof window.MMEDDrillGamePanel.start === "function") {
			window.MMEDDrillGamePanel.start(this);
		}
	};

	LiveSessionView.prototype.renderChatSidebar = function (live) {
		var info = this.joinInfo || {};
		if (!this.featureEnabled("session_chat")) {
			return "";
		}

		if (!info.session_group_id || !info.event_date) {
			return "";
		}

		var profile = this.app && this.app.state ? this.app.state.profile || {} : {};
		var currentUserId = parseInt(profile.id || 0, 10);
		var messages = this.chatMessages.map(function (message) {
			var own = parseInt(message.user_id || 0, 10) === currentUserId;
			return [
				'<div class="mmed-chat-message' + (own ? " is-own" : "") + (message.is_question ? " is-question" : "") + (message.pinned ? " is-pinned" : "") + '">',
				'<div class="mmed-chat-meta">',
				message.pinned ? '<span class="mmed-chat-pin">Pinned</span>' : "",
				message.is_question ? '<span class="mmed-chat-q">?</span>' : "",
				message.is_answered ? '<span class="mmed-chat-answered">✓</span>' : "",
				'<strong>' + esc(message.user_name || "Student") + "</strong>",
				"</div>",
				'<div class="mmed-chat-bubble">' + esc(message.message || "") + "</div>",
				"</div>"
			].join("");
		}).join("");

		return [
			'<aside class="mmed-live-chat' + (this.chatOpen ? "" : " is-collapsed") + '">',
			'<button type="button" class="mmed-chat-toggle" data-chat-toggle>' + (this.chatOpen ? "Hide Chat" : "Show Chat") + "</button>",
			'<div class="mmed-chat-panel">',
			'<div class="mmed-chat-head"><h2>Session Chat</h2><span>' + (live ? "Live" : "History") + "</span></div>",
			'<div class="mmed-chat-messages" data-chat-messages>' + (messages || '<div class="mmed-chat-empty">No messages yet.</div>') + "</div>",
			'<form class="mmed-chat-form" data-chat-form>',
			'<label class="mmed-chat-question"><input type="checkbox" name="is_question"> Question</label>',
			'<div class="mmed-chat-input-row"><input name="message" autocomplete="off" placeholder="Message or question..." maxlength="1000"><button type="submit">Send</button></div>',
			"</form>",
			"</div>",
			"</aside>"
		].join("");
	};

	LiveSessionView.prototype.bindChat = function () {
		var self = this;
		var toggle = this.root ? this.root.querySelector("[data-chat-toggle]") : null;
		var form = this.root ? this.root.querySelector("[data-chat-form]") : null;

		if (toggle) {
			toggle.addEventListener("click", function () {
				self.chatOpen = !self.chatOpen;
				var chat = self.root ? self.root.querySelector(".mmed-live-chat") : null;
				if (chat) {
					chat.classList.toggle("is-collapsed", !self.chatOpen);
				}
				toggle.textContent = self.chatOpen ? "Hide Chat" : "Show Chat";
			});
		}

		if (form) {
			form.addEventListener("submit", function (event) {
				event.preventDefault();
				var input = form.elements.message;
				var text = input.value.trim();
				if (!text) {
					return;
				}

				self.apiPost("/sessions/" + self.joinInfo.session_group_id + "/chat", {
					date: self.joinInfo.event_date,
					message: text,
					is_question: form.elements.is_question.checked
				}).then(function () {
					input.value = "";
					form.elements.is_question.checked = false;
					self.loadChat(true);
				}).catch(function (error) {
					window.alert(error.message || "Could not send message.");
				});
			});
		}
	};

	LiveSessionView.prototype.loadChat = function (force) {
		var self = this;
		var info = this.joinInfo || {};
		if (!this.featureEnabled("session_chat")) {
			return;
		}

		if (!info.session_group_id || !info.event_date) {
			return;
		}

		if (!force && this.chatTimer) {
			return;
		}

		this.apiGet("/sessions/" + info.session_group_id + "/chat", {
			date: info.event_date,
			limit: 50,
			offset: 0
		}).then(function (payload) {
			self.chatMessages = payload && Array.isArray(payload.messages) ? payload.messages : [];
			self.refreshChatDom();
		}).catch(function () {});

		if (!this.chatTimer) {
			this.chatTimer = window.setInterval(function () {
				self.loadChat(true);
			}, info.can_join ? 5000 : 30000);
		}
	};

	LiveSessionView.prototype.refreshChatDom = function () {
		var panel = this.root ? this.root.querySelector(".mmed-live-chat") : null;
		if (!panel) {
			return;
		}
		var oldScroll = panel.querySelector("[data-chat-messages]");
		var atBottom = oldScroll ? oldScroll.scrollTop + oldScroll.clientHeight >= oldScroll.scrollHeight - 20 : true;
		var replacement = document.createElement("div");
		replacement.innerHTML = this.renderChatSidebar(!!(this.joinInfo && this.joinInfo.can_join));
		panel.replaceWith(replacement.firstChild);
		this.bindChat();
		var messages = this.root ? this.root.querySelector("[data-chat-messages]") : null;
		if (messages && atBottom) {
			messages.scrollTop = messages.scrollHeight;
		}
	};

	LiveSessionView.prototype.currentBody = function () {
		if (this.isEnded()) {
			var copy = this.featureEnabled("session_chat") ? "This live session has ended. Chat history remains available for review." : "This live session has ended.";
			return '<div class="mmed-live-fallback"><h2>Session ended</h2><p>' + esc(copy) + '</p><div class="mmed-live-fallback-actions">' + (this.recordingAvailable() ? '<button type="button" class="mmed-live-primary" data-live-recording>Watch Recording</button>' : '<span class="mmed-live-secondary">Recording not available yet</span>') + "</div></div>";
		}
		if (this.joinInfo && this.joinInfo.can_join) {
			return '<div class="mmed-live-fallback"><h2>Open in Webex</h2><p>This session is ready. Embedded joining is not enabled for this meeting yet.</p></div>';
		}
		return '<div class="mmed-waiting-room"><span class="mmed-waiting-kicker">Waiting Room</span><h2>' + esc((this.joinInfo && this.joinInfo.title) || "Live Session") + '</h2><div class="mmed-countdown" data-live-countdown>' + esc(this.countdownText()) + '</div><span class="mmed-waiting-note">This room opens 15 minutes before start time.</span></div>';
	};

	LiveSessionView.prototype.startHeaderTimer = function () {
		var self = this;
		this.headerTimer = window.setInterval(function () {
			var badge = self.root ? self.root.querySelector("[data-live-time-badge]") : null;
			if (badge) badge.textContent = self.timeBadgeText();
		}, 30000);
	};

	LiveSessionView.prototype.countdownText = function () {
		var info = this.joinInfo || {};
		var start = info.start_at ? new Date(String(info.start_at).replace(" ", "T")).getTime() : 0;
		return start ? formatCountdown(start - Date.now()) : "0:00:00";
	};

	LiveSessionView.prototype.timeBadgeText = function () {
		var info = this.joinInfo || {};
		var now = Date.now();
		var start = info.start_at ? new Date(String(info.start_at).replace(" ", "T")).getTime() : 0;
		var end = info.end_at ? new Date(String(info.end_at).replace(" ", "T")).getTime() : 0;

		if (start && now < start) {
			return "Starts in " + Math.max(0, Math.round((start - now) / 60000)) + " min";
		}

		if (end && now <= end) {
			return Math.max(0, Math.round((end - now) / 60000)) + " min left";
		}

		return "Session ended";
	};

	LiveSessionView.prototype.isEnded = function () {
		var info = this.joinInfo || {};
		var end = info.end_at ? new Date(String(info.end_at).replace(" ", "T")).getTime() : 0;
		return !!(end && Date.now() > end);
	};

	function currentLiveSessionMatch() {
		var raw = String(window.location.hash || "").replace(/^#\/?/, "");
		return raw.match(/^live-session\/(\d+)$/);
	}

	function installLiveSessionRoute() {
		var app = window.MMED_OS || null;
		var content = document.getElementById("sos-content");
		if (!app || !app.router || typeof app.router.route !== "function" || !app.render || !content) {
			return false;
		}

		if (app.router._mmedLiveSessionPatched) {
			return true;
		}

		var originalRoute = app.router._mmedLiveSessionOriginalRoute || app.router.route.bind(app.router);
		app.router._mmedLiveSessionOriginalRoute = originalRoute;
		app.router._mmedLiveSessionPatched = true;

		app.router.route = function () {
			var match = currentLiveSessionMatch();
			if (match) {
				if (window.mmedLiveSessionView && typeof window.mmedLiveSessionView.destroy === "function") {
					window.mmedLiveSessionView.destroy(false);
				}

				app.state = app.state || {};
				app.state.route = "live-session/" + match[1];
				if (app.render && typeof app.render.sidebar === "function") {
					app.render.sidebar();
				}

				if (!document.getElementById("sos-content")) {
					window.setTimeout(app.router.route.bind(app.router), 80);
					return;
				}

				window.mmedLiveSessionView = new window.LiveSessionView(app);
				window.mmedLiveSessionView.init(match[1]);
				return;
			}

			if (window.mmedLiveSessionView && typeof window.mmedLiveSessionView.destroy === "function") {
				window.mmedLiveSessionView.destroy(false);
				window.mmedLiveSessionView = null;
			}

			return originalRoute();
		};

		return true;
	}

	function scheduleLiveSessionRouteInstall() {
		var attempts = 0;
		var timer = window.setInterval(function () {
			attempts += 1;
			if (installLiveSessionRoute() || attempts >= 80) {
				window.clearInterval(timer);
				if (currentLiveSessionMatch() && window.MMED_OS && window.MMED_OS.router && typeof window.MMED_OS.router.route === "function") {
					window.setTimeout(window.MMED_OS.router.route.bind(window.MMED_OS.router), 0);
				}
			}
		}, 100);
	}

	window.LiveSessionView = LiveSessionView;
	scheduleLiveSessionRouteInstall();
})();
