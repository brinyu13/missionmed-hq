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
		this.countdownTimer = null;
		this.refreshTimer = null;
		this.headerTimer = null;

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

	LiveSessionView.prototype.apiGet = function (endpoint) {
		if (this.app.api && typeof this.app.api.get === "function") {
			return this.app.api.get(endpoint);
		}
		return Promise.reject(new Error("Matrix API is unavailable."));
	};

	LiveSessionView.prototype.load = function () {
		var self = this;
		return this.apiGet("/meetings/" + this.eventId + "/join").then(function (info) {
			self.joinInfo = info || {};
			if (!self.joinInfo.can_join) {
				self.renderWaiting();
				return;
			}
			if (!self.joinInfo.widget_enabled) {
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
			body,
			"</section>"
		].join("");
		this.bindCommon();
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
			info.meeting_url ? '<button type="button" class="mmed-live-secondary" data-copy-meeting>Copy Link</button>' : "",
			"</div>",
			"</div>"
		].join("");

		this.renderPage(body, true);
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

		/* TODO: Verify Webex Widget CDN URL. Official docs currently describe the Meetings Widget as NPM-only, so this view falls back when no widget global is available. */
		if (!guestToken || !destination || !window.webex || !window.webex.widget || !widgetEl) {
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

	window.LiveSessionView = LiveSessionView;
})();
