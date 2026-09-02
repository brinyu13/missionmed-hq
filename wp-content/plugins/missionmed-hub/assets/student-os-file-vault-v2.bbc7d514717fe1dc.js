(function (window, document) {
	"use strict";

	var STATUS = {
		draft: { label: "Draft", tone: "muted" },
		uploaded: { label: "Uploaded", tone: "muted" },
		submitted: { label: "Submitted", tone: "cyan" },
		in_review: { label: "In Review", tone: "gold" },
		needs_changes: { label: "Needs Changes", tone: "red" },
		reviewed: { label: "Reviewed", tone: "violet" },
		final: { label: "Final", tone: "green" },
		missing: { label: "Missing", tone: "red" }
	};
	var ACCEPTED_EXTENSIONS = ["pdf", "docx", "png", "jpg", "jpeg", "mp4", "webm"];
	var PROGRAM_OPTIONS = ["360 Match Mentorship", "IV Prep Complete", "IV Prep Essentials", "PS-Only"];
	var SESSION_OPTIONS = ["A", "B", "C", "D", "E", "F", "G"];
	var CUSTOM_NAME_TYPES = ["lor_related", "other"];
	var MIME_FALLBACKS = {
		pdf: "application/pdf",
		docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		png: "image/png",
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		mp4: "video/mp4",
		webm: "video/webm"
	};
	var STUDENT_VIEWS = ["vault", "upload", "files", "recent", "library", "shared", "activity", "journey"];
	var STAFF_VIEWS = ["command", "review", "vault", "upload", "files", "recent", "library", "shared", "activity", "journey", "audit"];
	var PREFS_KEY = "mmed.fileVaultV2.preferences";
	var INTRO_KEY = "mmed.fileVaultV2.introSeen";
	var LEGACY_V1_ROUTE_MARKER = "Private student file metadata with direct R2 upload wiring";
	var LEGACY_V1_ROUTE_SAFE_MARKER = "Private student file metadata with direct R2 upload\u200b wiring";
	var currentInstance = null;
	var integration = {
		fallbackActive: false,
		legacyObject: null,
		legacyDescriptor: null,
		v1Renderer: null,
		runtime: null,
		runtimeModule: null,
		originalRuntimeModule: null,
		observedRoot: null,
		rootObserver: null,
		takeoverPendingUntil: 0,
		mountPromise: null,
		mountRoot: null
	};

	var ICONS = {
		activity: '<path d="M3 12h4l3-9 4 18 3-9h4"/>',
		alert: '<path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
		arrowLeft: '<path d="m15 18-6-6 6-6"/>',
		arrowRight: '<path d="m9 18 6-6-6-6"/>',
		bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
		check: '<path d="m20 6-11 11-5-5"/>',
		clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
		close: '<path d="M18 6 6 18M6 6l12 12"/>',
		comment: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/>',
		download: '<path d="M12 3v12m0 0 5-5m-5 5-5-5"/><path d="M5 21h14"/>',
		file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
		folder: '<path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
		grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
		home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
		journey: '<path d="M5 19 19 5M7 5h12v12"/>',
		library: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
		list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
		lock: '<rect width="16" height="11" x="4" y="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
		refresh: '<path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"/>',
		search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
		settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
		upload: '<path d="M12 21V9m0 0-5 5m5-5 5 5"/><path d="M5 3h14"/>',
		users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
		vault: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M12 9v-2M12 17v-2M9 12H7M17 12h-2"/>'
	};

	function icon(name, className) {
		return '<svg class="fv2-icon' + (className ? " " + escAttr(className) : "") + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONS[name] || ICONS.file) + "</svg>";
	}

	function esc(value) {
		return String(value === undefined || value === null ? "" : value).replace(/[&<>"']/g, function (character) {
			return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character];
		});
	}

	function escAttr(value) {
		return esc(value).replace(/`/g, "&#096;");
	}

	function positiveInt(value) {
		var parsed = parseInt(value, 10);
		return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
	}

	function boundedInt(value, minimum, maximum) {
		var parsed = parseInt(value, 10);
		if (!Number.isFinite(parsed)) return minimum;
		return Math.min(maximum, Math.max(minimum, parsed));
	}

	function formatSize(value) {
		var bytes = Math.max(0, Number(value) || 0);
		if (bytes < 1024) return Math.round(bytes) + " B";
		if (bytes < 1048576) return (bytes / 1024).toFixed(bytes < 10240 ? 1 : 0) + " KB";
		return (bytes / 1048576).toFixed(bytes < 10485760 ? 1 : 0) + " MB";
	}

	function formatDate(value, withTime) {
		if (!value) return "Not recorded";
		var date = new Date(value);
		if (Number.isNaN(date.getTime())) return "Not recorded";
		var options = withTime
			? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" }
			: { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" };
		try {
			return new Intl.DateTimeFormat(undefined, options).format(date);
		} catch (error) {
			return date.toLocaleString();
		}
	}

	function documentUploadedAt(documentItem) {
		var versions = documentItem && Array.isArray(documentItem.versions) ? documentItem.versions : [];
		var uploadedAt = versions.reduce(function (latest, version) {
			var candidate = String(version && version.uploaded_at || "");
			if (!candidate || Number.isNaN(new Date(candidate).getTime())) return latest;
			return !latest || new Date(candidate).getTime() > new Date(latest).getTime() ? candidate : latest;
		}, "");
		return uploadedAt || String(documentItem && documentItem.created_at || documentItem && documentItem.updated_at || "");
	}

	function documentFileKind(documentItem) {
		var mime = String(documentItem && documentItem.mime_type || "").toLowerCase();
		var name = String(documentItem && (documentItem.original_name || documentItem.canonical_name || documentItem.name) || "").toLowerCase();
		if (mime === "application/pdf" || /[.]pdf$/.test(name)) return { key: "pdf", label: "PDF" };
		if (mime.indexOf("wordprocessingml") !== -1 || /[.]docx$/.test(name)) return { key: "docx", label: "DOCX" };
		if (mime.indexOf("image/") === 0 || /[.](png|jpe?g)$/.test(name)) return { key: "image", label: "IMG" };
		if (mime.indexOf("video/") === 0 || /[.](mp4|webm)$/.test(name)) return { key: "video", label: "VIDEO" };
		return { key: "file", label: "FILE" };
	}

	function slugify(value) {
		return String(value || "item").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "item";
	}

	function statusInfo(status, serverLabel) {
		var key = String(status || "draft").toLowerCase();
		var known = STATUS[key] || { label: serverLabel || key.replace(/_/g, " "), tone: "muted" };
		return { key: key, label: serverLabel || known.label, tone: known.tone };
	}

	function statusBadge(status, serverLabel) {
		var meta = statusInfo(status, serverLabel);
		return '<span class="fv2-status fv2-status-' + escAttr(meta.tone) + '"><span aria-hidden="true"></span>' + esc(meta.label) + "</span>";
	}

	function errorMessage(error, fallback) {
		return error && error.message ? String(error.message) : (fallback || "The request could not be completed.");
	}

	function isStaffRole(role) {
		return role === "admin" || role === "mentor";
	}

	function normalizedProgramOption(value) {
		var label = String(value || "").trim();
		if (PROGRAM_OPTIONS.indexOf(label) !== -1) return label;
		var normalized = label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
		if (/\b360\b/.test(normalized)) return "360 Match Mentorship";
		if (/\biv prep complete\b/.test(normalized) || normalized === "complete") return "IV Prep Complete";
		if (/\biv prep essentials?\b/.test(normalized) || normalized === "foundation") return "IV Prep Essentials";
		if (/\bps only\b/.test(normalized) || /\bpersonal statement only\b/.test(normalized)) return "PS-Only";
		return "";
	}

	function isTypingTarget(target) {
		if (!target) return false;
		return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable;
	}

	function isFileVaultRoute() {
		return String(window.location.hash || "").replace(/^#\/?/, "").split(/[?&]/)[0] === "filevault";
	}

	function resolveRoot(target) {
		if (target && target.nodeType === 1) return target;
		if (typeof target === "string") return document.querySelector(target);
		return document.getElementById("sos-content");
	}

	function defaultPreferences() {
		return { reducedMotion: false, density: "comfortable", sound: false, volume: 0.35 };
	}

	function readPreferences() {
		var defaults = defaultPreferences();
		try {
			var stored = JSON.parse(window.localStorage.getItem(PREFS_KEY) || "{}");
			return {
				reducedMotion: stored.reducedMotion === true,
				density: stored.density === "compact" ? "compact" : defaults.density,
				sound: stored.sound === true,
				volume: Math.min(1, Math.max(0, Number(stored.volume === undefined ? defaults.volume : stored.volume)))
			};
		} catch (error) {
			return defaults;
		}
	}

	function writePreferences(preferences) {
		try {
			window.localStorage.setItem(PREFS_KEY, JSON.stringify(preferences));
		} catch (error) {
			// Preferences remain available for the current session when storage is blocked.
		}
	}

	function neutralizeLegacyV1RouteMarker(root) {
		var app = root && root.querySelector ? root.querySelector("[data-fv2-app]") : null;
		if (!app) return;
		while (String(app.textContent || "").indexOf(LEGACY_V1_ROUTE_MARKER) !== -1) {
			var walker = document.createTreeWalker(app, 4);
			var nodes = [];
			var aggregate = "";
			var node;
			while ((node = walker.nextNode())) {
				nodes.push(node);
				aggregate += String(node.nodeValue || "");
			}
			var markerIndex = aggregate.indexOf(LEGACY_V1_ROUTE_MARKER);
			if (markerIndex === -1) return;
			var insertionIndex = markerIndex + LEGACY_V1_ROUTE_SAFE_MARKER.indexOf("\u200b");
			var cursor = 0;
			var changed = false;
			nodes.some(function (textNode) {
				var value = String(textNode.nodeValue || "");
				if (insertionIndex > cursor + value.length) {
					cursor += value.length;
					return false;
				}
				var offset = Math.max(0, insertionIndex - cursor);
				textNode.nodeValue = value.slice(0, offset) + "\u200b" + value.slice(offset);
				changed = true;
				return true;
			});
			if (!changed) return;
		}
	}

	function FileVaultV2(root, options) {
		this.root = root;
		this.options = options || {};
		this.config = Object.assign({}, window.mmedFileVaultV2Config || {}, this.options.config || {});
		this.injectedApi = this.options.api || null;
		this.uploadFactory = this.options.uploadTransport || null;
		this.hashFileFactory = this.options.hashFile || null;
		this.runtimeSignal = this.options.signal || null;
		this.destroyed = false;
		this.listeners = [];
		this.requests = new Set();
		this.transfers = new Set();
		this.timers = new Set();
		this.fileSearchTimer = 0;
		this.staffSearchTimer = 0;
		this.staffSearchToken = 0;
		this.staffSearchController = null;
		this.studentRequestToken = 0;
		this.studentRequestController = null;
		this.internalNotesRequestToken = 0;
		this.overlayIsolation = [];
		this.legacyGuardObserver = null;
		this.audioContext = null;
		this.preferences = readPreferences();
		this.introVisible = false;
		if (!this.options.harness) {
			try { this.introVisible = window.sessionStorage.getItem(INTRO_KEY) !== "1"; } catch (error) { this.introVisible = true; }
		}
		this.motionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
		this.mobileQuery = window.matchMedia ? window.matchMedia("(max-width: 980px)") : { matches: false };
		this.state = {
			loading: true,
			error: "",
			data: null,
			staffData: null,
			view: "vault",
			selectedDocumentId: 0,
			documentDetail: null,
			documentLoading: false,
			documentError: "",
			workspaceTab: "score",
			audit: null,
			auditLoading: false,
			auditLoadingMore: false,
			auditError: "",
			auditPagination: null,
			auditSearch: "",
			commandSearch: "",
			staffSearchData: null,
			staffSearchLoading: false,
			staffSearchError: "",
			fileSearch: "",
			fileType: "",
			fileStatus: "",
			fileSort: "updated_desc",
			fileLayout: "list",
			homeUploadType: "",
			lensMode: String(this.config.role || "student").toLowerCase() === "admin" ? "administrator" : "student",
			mobileNavOpen: false,
			staffLoadingMore: false,
			staffLoadError: "",
			paginationAnnouncement: "",
			selectedStudentId: 0,
			lastStudentId: 0,
			studentLoading: false,
			busy: {},
			overlay: "",
			upload: null,
			reviewStatus: "reviewed",
			reviewNote: "",
			scoreDraft: {},
			scoreNotes: "",
			internalNotes: [],
			internalNotesLoading: false,
			internalNotesError: "",
			shares: { missionmed: [], student_shared: [] },
			sharesLoading: { missionmed: false, student_shared: false },
			sharesError: { missionmed: "", student_shared: "" },
			sharePagination: { missionmed: null, student_shared: null },
			audiences: null,
			audiencesLoading: false,
			audiencesError: "",
			audienceSearch: "",
			preview: null,
			previewLoading: false,
			previewError: "",
			downloads: null,
			downloadsLoading: false,
			downloadsError: "",
			recipients: null,
			recipientsLoading: false,
			recipientsError: "",
			fallbackLoading: false
		};
		this.refs = {};
		this.returnFocus = null;
	}

	FileVaultV2.prototype.mount = function () {
		var self = this;
		if (!this.root) return Promise.reject(new Error("File Vault mount point was not found."));
		this.activateAppMode(true);
		this.root.classList.add("mmed-fv2-host");
		this.root.innerHTML = this.shellMarkup();
		var matrixFallback = document.getElementById("mmed-matrix-app-return");
		if (matrixFallback && matrixFallback.parentNode) matrixFallback.parentNode.removeChild(matrixFallback);
		this.refs.app = this.root.querySelector("[data-fv2-app]");
		this.refs.frame = this.root.querySelector("[data-fv2-frame]");
		this.refs.nav = this.root.querySelector("[data-fv2-nav]");
		this.refs.stage = this.root.querySelector("[data-fv2-stage]");
		this.refs.overlay = this.root.querySelector("[data-fv2-overlay]");
		this.refs.toasts = this.root.querySelector("[data-fv2-toasts]");
		this.refs.live = this.root.querySelector("[data-fv2-live]");
		this.refs.student = this.root.querySelector("[data-fv2-student]");
		this.refs.lens = this.root.querySelector("[data-fv2-lens]");
		this.refs.role = this.root.querySelector("[data-fv2-role]");
		this.refs.headerSearch = this.root.querySelector("[data-fv2-header-search]");
		this.refs.headerUpload = this.root.querySelector(".fv2-header-upload");
		this.refs.storage = this.root.querySelector("[data-fv2-storage]");
		this.refs.settings = this.root.querySelector('[data-fv2-action="open-settings"]');
		this.refs.intro = this.root.querySelector("[data-fv2-intro]");
		neutralizeLegacyV1RouteMarker(this.root);
		if (typeof window.MutationObserver === "function") {
			this.legacyGuardObserver = new window.MutationObserver(function () {
				neutralizeLegacyV1RouteMarker(self.root);
			});
			this.legacyGuardObserver.observe(this.root, { childList: true, characterData: true, subtree: true });
		}

		this.listen(this.root, "click", function (event) { self.handleClick(event); });
		this.listen(this.refs.settings, "click", function (event) {
			event.preventDefault();
			event.stopPropagation();
			self.openOverlay("settings");
		});
		this.listen(this.root, "change", function (event) { self.handleChange(event); });
		this.listen(this.root, "input", function (event) { self.handleInput(event); });
		this.listen(this.root, "submit", function (event) { self.handleSubmit(event); });
		this.listen(this.root, "dragover", function (event) { self.handleDragOver(event); });
		this.listen(this.root, "dragleave", function (event) { self.handleDragLeave(event); });
		this.listen(this.root, "drop", function (event) { self.handleDrop(event); });
		this.listen(document, "keydown", function (event) { self.handleKeydown(event); });
			this.listenMedia(this.motionQuery, function () { self.applyPreferences(); self.renderOverlay(); });
			this.listenMedia(this.mobileQuery, function () { self.handleViewportChange(); });
			if (this.runtimeSignal && typeof this.runtimeSignal.addEventListener === "function") {
				this.listen(this.runtimeSignal, "abort", function () {
					if (currentInstance === self) publicUnmount();
					else self.unmount();
				}, { once: true });
			}
		this.applyPreferences();
		if (this.introVisible && this.refs.intro) {
			try { window.sessionStorage.setItem(INTRO_KEY, "1"); } catch (error) { /* Session-only replay protection remains best effort. */ }
			var introButton = this.refs.intro.querySelector("button");
			if (introButton && typeof introButton.focus === "function") introButton.focus({ preventScroll: true });
			var introTimer = window.setTimeout(function () {
				self.timers.delete(introTimer);
				self.dismissIntro();
			}, this.preferences.reducedMotion || (this.motionQuery && this.motionQuery.matches) ? 450 : 1650);
			this.timers.add(introTimer);
		}
		return this.reload();
	};

	FileVaultV2.prototype.dismissIntro = function () {
		if (!this.introVisible) return;
		this.introVisible = false;
		if (!this.refs.intro) return;
		var restoreFocus = this.refs.intro.contains(document.activeElement);
		this.refs.intro.classList.add("is-leaving");
		if (this.refs.frame) {
			this.refs.frame.inert = false;
			this.refs.frame.removeAttribute("inert");
			this.refs.frame.removeAttribute("aria-hidden");
		}
		var intro = this.refs.intro;
		var self = this;
		var timer = window.setTimeout(function () {
			self.timers.delete(timer);
			if (intro.parentNode) intro.parentNode.removeChild(intro);
			self.refs.intro = null;
			if (restoreFocus && self.refs.stage && typeof self.refs.stage.focus === "function") self.refs.stage.focus({ preventScroll: true });
		}, this.preferences.reducedMotion || (this.motionQuery && this.motionQuery.matches) ? 0 : 360);
		this.timers.add(timer);
	};

	FileVaultV2.prototype.shellMarkup = function () {
		var matrixUrl = String(this.config.matrixUrl || "/member-dashboard/");
		return [
			'<section class="mmed-fv2" data-fv2-app aria-label="MissionMed File Vault">',
			this.introVisible ? '<div class="fv2-intro" data-fv2-intro role="dialog" aria-modal="true" aria-labelledby="fv2-intro-title" aria-describedby="fv2-intro-description"><div class="fv2-intro-mark" aria-hidden="true">M</div><span>MissionMed / Mission Residency</span><h1 id="fv2-intro-title">FILE <em>VAULT</em></h1><p id="fv2-intro-description">Your Residency Document Workspace</p><button type="button" data-fv2-action="skip-intro">Enter File Vault</button></div>' : '',
			'<span class="sos-filevault-v1 fv2-v1-guard-sentinel" hidden aria-hidden="true"></span>',
			'<div class="fv2-frame" data-fv2-frame' + (this.introVisible ? ' aria-hidden="true" inert' : '') + '>',
			'<header class="fv2-hud">',
			'<a class="fv2-matrix-return" href="' + escAttr(matrixUrl) + '" aria-label="Return to Matrix" data-matrix-app-mode-return="1" data-matrix-dashboard-return="true">' + icon("arrowLeft") + '<span>Matrix</span></a>',
			'<div class="fv2-brand" aria-label="MissionMed File Vault"><span class="fv2-brand-matrix">MissionMed</span><span class="fv2-brand-slash">//</span><strong>FileVault</strong></div>',
			'<div class="fv2-hud-context"><span class="fv2-lens" data-fv2-lens>Vault</span><span class="fv2-student" data-fv2-student></span></div>',
			'<div class="fv2-hud-actions">',
			'<span class="fv2-role-pill" data-fv2-role>Student view</span>',
			'<label class="fv2-header-search">' + icon("search") + '<span class="fv2-sr-only">Search your files</span><input type="search" autocomplete="off" placeholder="Search your files..." data-fv2-header-search></label>',
			'<span class="fv2-security" data-fv2-storage>' + icon("lock") + '<span>Private</span></span>',
			'<button type="button" class="fv2-header-upload" data-fv2-action="open-upload" aria-label="Open upload workflow">' + icon("upload") + '<span>Upload</span></button>',
			"</div>",
			"</header>",
			'<div class="fv2-layout">',
			'<nav class="fv2-rail" data-fv2-nav aria-label="File Vault views"></nav>',
			'<main class="fv2-stage" id="mmed-file-vault-v2-content" data-fv2-stage tabindex="-1"></main>',
			"</div>",
			"</div>",
			'<div class="fv2-overlay-host" data-fv2-overlay hidden inert></div>',
			'<div class="fv2-toasts" data-fv2-toasts aria-live="polite" aria-atomic="false"></div>',
			'<div class="fv2-sr-only" data-fv2-live aria-live="polite" aria-atomic="true"></div>',
			"</section>"
		].join("");
	};

	FileVaultV2.prototype.listen = function (target, type, handler, options) {
		if (!target || typeof target.addEventListener !== "function") return;
		target.addEventListener(type, handler, options);
		this.listeners.push(function () { target.removeEventListener(type, handler, options); });
	};

	FileVaultV2.prototype.listenMedia = function (query, handler) {
		if (!query) return;
		if (typeof query.addEventListener === "function") {
			this.listen(query, "change", handler);
		} else if (typeof query.addListener === "function") {
			query.addListener(handler);
			this.listeners.push(function () { query.removeListener(handler); });
		}
	};

	FileVaultV2.prototype.activateAppMode = function (active) {
		if (this.options.harness) return;
		if (window.MMEDMatrixAppMode && typeof window.MMEDMatrixAppMode.set === "function") {
			window.MMEDMatrixAppMode.set(active, active ? "filevault" : "");
		} else if (window.MMEDMatrixAppMode && typeof window.MMEDMatrixAppMode.activate === "function") {
			if (active) window.MMEDMatrixAppMode.activate("filevault");
			else if (typeof window.MMEDMatrixAppMode.deactivate === "function") window.MMEDMatrixAppMode.deactivate("filevault");
		}
		[document.documentElement, document.body, document.getElementById("student-os-root")].forEach(function (node) {
			if (!node || !node.classList) return;
			node.classList.toggle("mmed-filevault-fullscreen", active);
			node.classList.toggle("mmed-filevault-v2-active", active);
		});
	};

	FileVaultV2.prototype.applyPreferences = function () {
		if (!this.refs.app) return;
		var systemReduced = !!(this.motionQuery && this.motionQuery.matches);
		this.refs.app.classList.toggle("fv2-reduced-motion", systemReduced || this.preferences.reducedMotion);
		this.refs.app.classList.toggle("fv2-density-compact", this.preferences.density === "compact");
	};

	FileVaultV2.prototype.request = function (method, path, body, query, externalSignal) {
		var self = this;
		var controller = typeof window.AbortController === "function" ? new window.AbortController() : null;
		var signal = controller ? controller.signal : externalSignal || null;
		var abortFromExternal = null;
		if (controller) {
			this.requests.add(controller);
			if (externalSignal && typeof externalSignal.addEventListener === "function") {
				abortFromExternal = function () { controller.abort(); };
				if (externalSignal.aborted) controller.abort();
				else externalSignal.addEventListener("abort", abortFromExternal, { once: true });
			}
		}

		function finish() {
			if (controller) self.requests.delete(controller);
			if (externalSignal && abortFromExternal && typeof externalSignal.removeEventListener === "function") {
				externalSignal.removeEventListener("abort", abortFromExternal);
			}
		}

		var promise;
		if (this.injectedApi) {
			try {
				if (typeof this.injectedApi === "function") {
					promise = this.injectedApi({ method: method, path: path, body: body, query: query || {}, signal: signal });
				} else if (typeof this.injectedApi.request === "function") {
					promise = this.injectedApi.request({ method: method, path: path, body: body, query: query || {}, signal: signal });
				} else {
					throw new Error("The fixture API does not expose request().");
				}
			} catch (error) {
				promise = Promise.reject(error);
			}
		} else {
			promise = this.fetchRequest(method, path, body, query, signal);
		}
		return Promise.resolve(promise).then(function (value) { finish(); return value; }, function (error) { finish(); throw error; });
	};

	FileVaultV2.prototype.fetchRequest = function (method, path, body, query, signal, nonceRetried) {
		var self = this;
		var base = String(this.config.restUrl || "").replace(/\/$/, "");
		if (!base) return Promise.reject(new Error("File Vault REST configuration is unavailable."));
		var url;
		try {
			url = new URL(base + (path.charAt(0) === "/" ? path : "/" + path), window.location.href);
		} catch (error) {
			return Promise.reject(new Error("File Vault REST configuration is invalid."));
		}
		Object.keys(query || {}).forEach(function (key) {
			var value = query[key];
			if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
		});
		var headers = { Accept: "application/json" };
		if (this.config.nonce) headers["X-WP-Nonce"] = String(this.config.nonce);
		if (body !== undefined && body !== null) headers["Content-Type"] = "application/json";
		return window.fetch(url.toString(), {
			method: method,
			headers: headers,
			credentials: "same-origin",
			body: body === undefined || body === null ? undefined : JSON.stringify(body),
			signal: signal || undefined
		}).then(function (response) {
			return response.text().then(function (text) {
				var payload = null;
				if (text) {
					try { payload = JSON.parse(text); } catch (error) { payload = null; }
				}
				if (!response.ok) {
					var code = payload && payload.code ? String(payload.code) : "";
					if (!nonceRetried && response.status === 403 && ["rest_cookie_invalid_nonce", "mmed_file_vault_v2_nonce_required", "mmed_file_vault_v2_nonce_invalid"].indexOf(code) !== -1) {
						return self.refreshNonce(signal).then(function () {
							return self.fetchRequest(method, path, body, query, signal, true);
						});
					}
					var requestError = new Error(payload && payload.message ? payload.message : "File Vault request failed (" + response.status + ").");
					requestError.status = response.status;
					requestError.code = code;
					throw requestError;
				}
				return payload === null ? {} : payload;
			});
		});
	};

	FileVaultV2.prototype.refreshNonce = function (signal) {
		var self = this;
		var configured = String(this.config.nonceRefreshUrl || "");
		var url;
		try {
			url = new URL(configured, window.location.href);
		} catch (error) {
			return Promise.reject(new Error("File Vault session refresh is unavailable."));
		}
		var loopbackHttp = url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].indexOf(url.hostname) !== -1;
		if (!configured || url.origin !== window.location.origin || (url.protocol !== "https:" && !loopbackHttp)) {
			return Promise.reject(new Error("File Vault session refresh is unavailable."));
		}
		return window.fetch(url.toString(), {
			method: "GET",
			headers: { Accept: "application/json" },
			credentials: "same-origin",
			signal: signal || undefined
		}).then(function (response) {
			return response.text().then(function (text) {
				var payload = null;
				if (text) {
					try { payload = JSON.parse(text); } catch (error) { payload = null; }
				}
				var nonce = payload && payload.success === true && payload.data ? String(payload.data.nonce || "") : "";
				if (!response.ok || !nonce) throw new Error("File Vault session refresh failed.");
				self.config.nonce = nonce;
				return nonce;
			});
		});
	};

	FileVaultV2.prototype.reload = function (options) {
		var self = this;
		var preserveView = !!(options && options.preserveView);
		this.state.loading = true;
		this.state.error = "";
		this.render();
		var query = {};
		if (this.state.selectedStudentId && this.roleIsStaff()) query.student_id = this.state.selectedStudentId;
		return this.request("GET", "/bootstrap", null, query).then(function (data) {
			if (self.destroyed) return self;
			self.acceptBootstrap(self.validateBootstrap(data), preserveView);
			self.state.loading = false;
			self.render();
			if (self.roleIsStaff() && self.state.data && self.state.data.staff_pagination && self.state.data.staff_pagination.deferred) {
				self.loadMoreStaff();
			}
			return self;
		}).catch(function (error) {
			if (self.destroyed || (error && error.name === "AbortError")) return self;
			self.state.loading = false;
			self.state.error = errorMessage(error, "File Vault could not be loaded.");
			self.render();
			return self;
		});
	};

	FileVaultV2.prototype.validateBootstrap = function (data) {
		if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("File Vault returned malformed bootstrap data.");
		var role = String(data.viewer_role || "").toLowerCase();
		if (["student", "mentor", "admin"].indexOf(role) === -1) throw new Error("File Vault returned an invalid server role.");
		if (!Array.isArray(data.documents) || !Array.isArray(data.library) || !Array.isArray(data.activity)) {
			throw new Error("File Vault returned incomplete document collections.");
		}
		if (!data.journey || typeof data.journey !== "object" || !data.storage || typeof data.storage !== "object" || !data.capabilities || typeof data.capabilities !== "object" || !data.document_types || typeof data.document_types !== "object" || Array.isArray(data.document_types) || !data.rubrics || typeof data.rubrics !== "object" || Array.isArray(data.rubrics)) {
			throw new Error("File Vault returned incomplete workflow state.");
		}
		if (isStaffRole(role) && (!Array.isArray(data.students) || !Array.isArray(data.review_queue))) {
			throw new Error("File Vault returned incomplete staff scope.");
		}
		return data;
	};

	FileVaultV2.prototype.acceptBootstrap = function (data, preserveView) {
		data.viewer_role = String(data.viewer_role).toLowerCase();
		data.documents = Array.isArray(data.documents) ? data.documents : [];
		data.library = Array.isArray(data.library) ? data.library : [];
		data.activity = Array.isArray(data.activity) ? data.activity : [];
		data.rubrics = data.rubrics && typeof data.rubrics === "object" && !Array.isArray(data.rubrics) ? data.rubrics : {};
		data.document_types = data.document_types && typeof data.document_types === "object" && !Array.isArray(data.document_types) ? data.document_types : {};
		data.capabilities = data.capabilities && typeof data.capabilities === "object" ? data.capabilities : {};
		if (isStaffRole(data.viewer_role)) {
			data.students = Array.isArray(data.students) ? data.students : (this.state.staffData && this.state.staffData.students) || [];
			data.review_queue = Array.isArray(data.review_queue) ? data.review_queue : (this.state.staffData && this.state.staffData.review_queue) || [];
			data.command = data.command && typeof data.command === "object" ? data.command : (this.state.staffData && this.state.staffData.command) || {};
			data.staff_pagination = data.staff_pagination && typeof data.staff_pagination === "object" ? data.staff_pagination : (this.state.staffData && this.state.staffData.staff_pagination) || { page: 1, per_page: 50, has_more: false, next_page: null, scope_complete: true };
			if (!data.student || !this.state.staffData) this.state.staffData = data;
			this.state.selectedStudentId = positiveInt(data.student && data.student.id) || this.state.selectedStudentId;
		} else {
			this.state.selectedStudentId = positiveInt(data.student && data.student.id);
		}
		this.state.data = data;
		var allowed = isStaffRole(data.viewer_role) ? STAFF_VIEWS.concat(["docdocs"]) : STUDENT_VIEWS.concat(["docdocs"]);
		if (!preserveView || allowed.indexOf(this.state.view) === -1) {
			this.state.view = isStaffRole(data.viewer_role) ? "command" : "vault";
		}
		if (this.state.selectedDocumentId && !this.getDocument(this.state.selectedDocumentId)) {
			this.state.selectedDocumentId = 0;
			this.state.documentDetail = null;
		}
	};

	FileVaultV2.prototype.role = function () {
		return this.state.data ? this.state.data.viewer_role : String(this.config.role || "student").toLowerCase();
	};

	FileVaultV2.prototype.roleIsStaff = function () {
		return isStaffRole(this.role());
	};

	FileVaultV2.prototype.isStudentLens = function () {
		return this.role() === "admin" && this.state.lensMode === "student";
	};

	FileVaultV2.prototype.capability = function (name) {
		if (this.isStudentLens() && ["review", "score", "finalize", "internal_notes", "share_mission_file", "view_audit"].indexOf(name) !== -1) return false;
		return !!(this.state.data && this.state.data.capabilities && this.state.data.capabilities[name]);
	};

	FileVaultV2.prototype.storageReady = function () {
		return !!(this.state.data && this.state.data.storage && this.state.data.storage.ready);
	};

	FileVaultV2.prototype.getDocument = function (id) {
		id = positiveInt(id);
		if (this.state.documentDetail && positiveInt(this.state.documentDetail.id) === id) return this.state.documentDetail;
		var documents = this.state.data && Array.isArray(this.state.data.documents) ? this.state.data.documents : [];
		return documents.find(function (documentItem) { return positiveInt(documentItem.id) === id; }) || null;
	};

	FileVaultV2.prototype.captureFocusKey = function () {
		var active = document.activeElement;
		if (!active || !this.root.contains(active)) return "";
		return active.getAttribute("data-fv2-focus-key") || "";
	};

	FileVaultV2.prototype.restoreFocusKey = function (key) {
		if (!key || this.state.overlay) return;
		var target = Array.prototype.slice.call(this.root.querySelectorAll("[data-fv2-focus-key]")).find(function (candidate) {
			return candidate.getAttribute("data-fv2-focus-key") === key;
		});
		if (target && typeof target.focus === "function") target.focus({ preventScroll: true });
	};

	FileVaultV2.prototype.render = function (options) {
		if (this.destroyed || !this.refs.stage) return;
		var focusKey = options && options.focusKey !== undefined ? options.focusKey : this.captureFocusKey();
		this.updateHeader();
		if (this.state.loading) {
			this.refs.nav.innerHTML = this.loadingNavMarkup();
			this.refs.stage.innerHTML = this.loadingMarkup();
			return;
		}
		if (this.state.fallbackLoading) {
			this.refs.nav.innerHTML = "";
			this.refs.stage.innerHTML = this.stateMessageMarkup("loading", "Opening classic File Vault", "Loading the configured V1 assets.", "");
			return;
		}
		if (this.state.error) {
			this.refs.nav.innerHTML = "";
			var fallbackButton = this.classicFallbackAvailable() ? '<button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="fallback-v1">Use classic File Vault</button>' : "";
			this.refs.stage.innerHTML = this.stateMessageMarkup("error", "File Vault is unavailable", this.state.error, '<button type="button" class="fv2-button fv2-button-primary" data-fv2-action="retry-bootstrap">' + icon("refresh") + "Retry</button>" + fallbackButton);
			return;
		}
		this.refs.nav.innerHTML = this.navigationMarkup();
		this.refs.stage.innerHTML = this.viewMarkup();
		this.renderOverlay();
		this.restoreFocusKey(focusKey);
	};

	FileVaultV2.prototype.updateHeader = function () {
		if (!this.refs.lens) return;
		var labels = { vault: "Home", upload: "Upload", files: "Your Files", recent: "Recently Uploaded", journey: "Journey", library: "Mission Files", shared: "Student Shared Files", activity: "Notifications", command: "Students", review: "Review Queue", audit: "Activity", docdocs: "Doc Docs" };
		this.refs.lens.textContent = labels[this.state.view] || "File Vault";
		var student = this.state.data && this.state.data.student;
		this.refs.student.textContent = student && student.display_name ? String(student.display_name) : (this.roleIsStaff() ? "Staff review" : "");
		if (this.refs.role) this.refs.role.textContent = this.isStudentLens() || !this.roleIsStaff() ? "Student view" : "Staff view";
		if (this.refs.headerSearch && this.refs.headerSearch.value !== this.state.fileSearch) this.refs.headerSearch.value = this.state.fileSearch;
		if (this.refs.headerUpload) {
			this.refs.headerUpload.disabled = !this.storageReady() || !(this.capability("upload") && (!this.roleIsStaff() || this.state.selectedStudentId) || this.capability("share_mission_file"));
		}
		if (this.refs.storage) {
			var ready = !this.state.data || this.storageReady();
			this.refs.storage.classList.toggle("fv2-security-blocked", !ready);
			var text = this.refs.storage.querySelector("span");
			if (text) text.textContent = ready ? "Private" : "Storage unavailable";
		}
	};

	FileVaultV2.prototype.loadingNavMarkup = function () {
		return '<div class="fv2-rail-loading" aria-hidden="true"><span></span><span></span><span></span><span></span></div>';
	};

	FileVaultV2.prototype.loadingMarkup = function () {
		return [
			'<div class="fv2-loading" role="status" aria-label="Loading File Vault">',
			'<div class="fv2-loading-title"></div>',
			'<div class="fv2-loading-action"></div>',
			'<div class="fv2-loading-rows"><span></span><span></span><span></span><span></span></div>',
			'<p>Loading your private document record...</p>',
			"</div>"
		].join("");
	};

	FileVaultV2.prototype.stateMessageMarkup = function (kind, title, message, actions) {
		var iconName = kind === "error" || kind === "blocked" ? "alert" : (kind === "loading" ? "refresh" : "folder");
		return '<section class="fv2-state fv2-state-' + escAttr(kind) + '" role="' + (kind === "error" ? "alert" : "status") + '"><span class="fv2-state-icon">' + icon(iconName) + "</span><h1>" + esc(title) + "</h1><p>" + esc(message) + '</p><div class="fv2-state-actions">' + (actions || "") + "</div></section>";
	};

	FileVaultV2.prototype.navigationMarkup = function () {
		var self = this;
		var role = this.role();
		var isAdmin = role === "admin";
		var subjectMode = isStaffRole(role) && !!this.state.selectedStudentId;
		var studentItems = [
			["vault", "home", "Home"],
			["files", "folder", "Your Files"],
			["recent", "clock", "Recently Uploaded"],
			["library", "library", "Mission Files"],
			["shared", "users", "Student Shared Files"],
			["activity", "bell", "Notifications"],
			["settings", "settings", "Settings"]
		];
		var items = isStaffRole(role) && !subjectMode
			? [["command", "users", "Students"], ["library", "library", "Mission Files"], ["shared", "users", "Student Shared Files"], ["audit", "activity", "Activity"], ["settings", "settings", "Settings"]]
			: studentItems;
		var queueCount = this.state.data && Array.isArray(this.state.data.review_queue) ? this.state.data.review_queue.length : 0;
		function itemMarkup(item, className) {
			var active = item[0] !== "settings" && self.state.view === item[0];
			var count = item[0] === "review" && queueCount ? '<span class="fv2-nav-count">' + esc(queueCount) + "</span>" : "";
			var action = item[0] === "settings" ? "open-settings" : "navigate";
			return '<button type="button" class="' + escAttr(className || "fv2-nav-item") + (active ? " is-active" : "") + '" aria-label="' + escAttr(item[2]) + '" data-fv2-action="' + action + '"' + (item[0] === "settings" ? "" : ' data-fv2-view="' + escAttr(item[0]) + '"') + ' data-fv2-focus-key="nav-' + escAttr(item[0]) + '"' + (active ? ' aria-current="page"' : "") + ">" + icon(item[1]) + "<span>" + esc(item[2]) + "</span>" + count + "</button>";
		}
		var lensButtons = isAdmin ? '<button type="button" data-fv2-action="set-lens" data-fv2-lens-mode="student" aria-pressed="' + (this.state.lensMode === "student" ? "true" : "false") + '" class="' + (this.state.lensMode === "student" ? "is-active" : "") + '">Student view</button><button type="button" data-fv2-action="set-lens" data-fv2-lens-mode="administrator" aria-pressed="' + (this.state.lensMode === "administrator" ? "true" : "false") + '" class="' + (this.state.lensMode === "administrator" ? "is-active" : "") + '">Administrator view</button>' : "";
		var mobileViewAs = isAdmin ? '<div class="fv2-mobile-view-as" role="group" aria-label="View File Vault as"><span>Viewing as</span>' + lensButtons + "</div>" : "";
		var markup = items.map(function (item, index) {
			return itemMarkup(item, "fv2-nav-item" + (index >= 4 ? " fv2-nav-overflow" : ""));
		}).join("");
		var overflow = items.slice(4);
		if (overflow.length || isAdmin) {
			var mobileMenuLabel = isAdmin ? "More File Vault controls" : (overflow.length ? "More File Vault destinations" : "More File Vault controls");
			markup += '<button type="button" class="fv2-nav-more' + (isAdmin ? " fv2-admin-nav-more" : "") + '" aria-label="More" aria-controls="fv2-mobile-nav-menu" aria-expanded="' + (this.state.mobileNavOpen ? "true" : "false") + '" data-fv2-action="toggle-mobile-nav" data-fv2-focus-key="nav-more">' + icon("grid") + "<span>More</span></button>";
			if (this.state.mobileNavOpen) {
				markup += '<div id="fv2-mobile-nav-menu" class="fv2-mobile-nav-menu' + (isAdmin ? " fv2-mobile-nav-admin" : "") + '" role="group" aria-label="' + mobileMenuLabel + '">' + overflow.map(function (item) {
					return itemMarkup(item, "fv2-mobile-nav-option");
				}).join("") + mobileViewAs + "</div>";
			}
		}
		var roleLabel = subjectMode ? "Student Vault" : (role === "mentor" ? "Mentor tools" : (role === "admin" ? "Administrator" : "Student Vault"));
		var uploadCta = subjectMode || !isStaffRole(role) || this.isStudentLens()
			? '<button type="button" class="fv2-rail-upload" data-fv2-action="navigate" data-fv2-view="upload"' + (this.capability("upload") && this.storageReady() ? "" : " disabled") + '>' + icon("upload") + '<span>Upload</span></button>'
			: (this.capability("share_mission_file") ? '<button type="button" class="fv2-rail-upload" data-fv2-action="open-share-upload" data-fv2-share-source="missionmed"' + (this.storageReady() ? "" : " disabled") + '>' + icon("upload") + '<span>Share Mission File</span></button>' : "");
		var matrixUrl = String(this.config.matrixUrl || "/member-dashboard/");
		var viewAs = isAdmin ? '<div class="fv2-view-as"><span>Viewing as</span>' + lensButtons + "</div>" : "";
		var accountName = String(this.config.viewerName || (role === "admin" ? "MissionMed administrator" : (role === "mentor" ? "MissionMed mentor" : (this.state.data && this.state.data.student && this.state.data.student.display_name) || "MissionMed student")));
		return '<div class="fv2-rail-brand"><strong>File<em>Vault</em></strong><span>MISSIONMED</span></div>' + uploadCta + '<div class="fv2-rail-label">' + esc(roleLabel) + "</div>" + markup + '<a class="fv2-rail-matrix" href="' + escAttr(matrixUrl) + '">' + icon("arrowLeft") + '<span>Back to Matrix</span></a><div class="fv2-rail-bottom">' + viewAs + '<div class="fv2-rail-account"><span>' + esc(accountName.charAt(0).toUpperCase() || "M") + '</span><strong>' + esc(accountName) + '</strong></div><div class="fv2-rail-foot"><span>Private by design</span><span>Secure document workflow</span></div></div>';
	};

	FileVaultV2.prototype.viewMarkup = function () {
		var markup = "";
		switch (this.state.view) {
			case "upload": markup = this.uploadLandingMarkup(); break;
			case "files": markup = this.filesMarkup(); break;
			case "recent": markup = this.recentMarkup(); break;
			case "journey": markup = this.journeyMarkup(); break;
			case "library": markup = this.libraryMarkup(); break;
			case "shared": markup = this.sharedMarkup(); break;
			case "activity": markup = this.activityMarkup(); break;
			case "command": markup = this.commandMarkup(); break;
			case "review": markup = this.reviewQueueMarkup(); break;
			case "audit": markup = this.auditMarkup(); break;
			case "docdocs": markup = this.docDocsMarkup(); break;
			default: markup = this.vaultMarkup();
		}
		return (this.roleIsStaff() && !this.isStudentLens() && this.state.selectedStudentId && ["command", "review"].indexOf(this.state.view) === -1 ? this.staffSubjectBannerMarkup() : "") + markup;
	};

	FileVaultV2.prototype.pageHeadingMarkup = function (kicker, title, subtitle, actions) {
		return [
			'<header class="fv2-page-heading">',
			'<div><span class="fv2-kicker">' + esc(kicker) + '</span><h1 tabindex="-1" data-fv2-page-heading>' + esc(title) + "</h1><p>" + esc(subtitle || "") + "</p></div>",
			'<div class="fv2-heading-actions">' + (actions || "") + "</div>",
			"</header>"
		].join("");
	};

	FileVaultV2.prototype.focusViewHeading = function () {
		var heading = this.refs.stage && this.refs.stage.querySelector("[data-fv2-page-heading]");
		if (heading && typeof heading.focus === "function") heading.focus({ preventScroll: true });
	};

	FileVaultV2.prototype.focusLensContext = function () {
		var mode = this.state.lensMode === "student" ? "student" : "administrator";
		var candidates = Array.prototype.slice.call(this.root.querySelectorAll('[data-fv2-action="set-lens"][data-fv2-lens-mode="' + mode + '"]'));
		var target = candidates.find(function (candidate) { return candidate.getClientRects().length > 0; });
		if (!target) {
			var mobileMore = this.root.querySelector('[data-fv2-focus-key="nav-more"]');
			if (mobileMore && mobileMore.getClientRects().length > 0) target = mobileMore;
		}
		if (!target && this.refs.stage) target = this.refs.stage.querySelector("[data-fv2-page-heading]");
		if (target && typeof target.focus === "function") target.focus({ preventScroll: true });
	};

	FileVaultV2.prototype.nextActionMarkup = function () {
		var action = this.state.data && this.state.data.next_action;
		if (!action || typeof action !== "object" || !action.title) return "";
		var kind = String(action.kind || "");
		var label = "";
		if (kind === "open_document" && positiveInt(action.document_id)) label = "Open document";
		else if (kind === "upload" && action.document_type) label = "Add document";
		else if (kind === "submit" && positiveInt(action.document_id)) label = "Review draft";
		else if (kind === "journey") label = "Open journey";
		var button = label ? '<button type="button" class="fv2-button fv2-button-primary" data-fv2-action="next-action">' + esc(label) + icon("arrowRight") + "</button>" : "";
		return [
			'<section class="fv2-next-action" aria-labelledby="fv2-next-action-title">',
			'<div class="fv2-next-marker">' + icon("journey") + "</div>",
			'<div><span>Server next action</span><h2 id="fv2-next-action-title">' + esc(action.title) + "</h2><p>" + esc(action.detail || "") + "</p></div>",
			button,
			"</section>"
		].join("");
	};

	FileVaultV2.prototype.homeActionsMarkup = function () {
		var canUpload = this.capability("upload") && this.storageReady();
		var categories = this.uploadCategories();
		return '<div class="fv2-upload-launcher"><span class="fv2-upload-launcher-label">Choose a document type</span><div class="fv2-upload-choices" role="group" aria-label="Choose what to upload">' + categories.map(function (category, index) {
			return '<button type="button" class="fv2-upload-choice is-art-' + ((index % 4) + 1) + '" data-fv2-action="open-upload" data-fv2-document-type="' + escAttr(category[0]) + '" data-fv2-display-name="' + (category[1] === "Miscellaneous" ? "" : escAttr(category[1])) + '"' + (canUpload ? "" : " disabled") + '><span class="fv2-upload-choice-art" aria-hidden="true"></span><span class="fv2-upload-choice-copy"><small>' + esc(category[2]) + '</small><strong>' + esc(category[1]) + '</strong><em>Upload</em></span><span class="fv2-upload-choice-icon" aria-hidden="true">' + icon(category[3]) + "</span></button>";
		}).join("") + "</div></div>";
	};

	FileVaultV2.prototype.uploadCategories = function () {
		return [
			["curriculum_vitae", "CV", "Core profile", "file"],
			["personal_statement", "Personal Statement", "Written narrative", "file"],
			["lor_related", "LOR-Related", "Letters and requests", "comment"],
			["timeline", "Timeline", "Application chronology", "journey"],
			["score_report", "Score Report", "Exam records", "activity"],
			["certification", "Certification", "Credential records", "check"],
			["other", "Miscellaneous", "Name it yourself", "folder"]
		];
	};

	FileVaultV2.prototype.studentDocuments = function () {
		var documents = this.state.data && Array.isArray(this.state.data.documents) ? this.state.data.documents : [];
		return documents.filter(function (documentItem) { return documentItem.category !== "admin"; });
	};

	FileVaultV2.prototype.documentForTypes = function (types) {
		types = Array.isArray(types) ? types : [types];
		return this.studentDocuments().find(function (documentItem) {
			return types.indexOf(String(documentItem.document_type || "other")) !== -1;
		}) || null;
	};

	FileVaultV2.prototype.shortcutMarkup = function (label, eyebrow, iconName, documentItem, options) {
		options = options || {};
		var canUpload = this.capability("upload") && this.storageReady();
		var action = documentItem ? "open-workspace" : (options.view ? "navigate" : "open-upload");
		var attributes = documentItem
			? ' data-fv2-document-id="' + positiveInt(documentItem.id) + '"'
			: (options.view ? ' data-fv2-view="' + escAttr(options.view) + '"' : ' data-fv2-document-type="' + escAttr(options.documentType || "other") + '" data-fv2-display-name="' + escAttr(options.displayName || label) + '"');
		var disabled = !documentItem && !options.view && !canUpload ? " disabled" : "";
		var state = documentItem ? statusInfo(documentItem.status, documentItem.status_label).label : (options.view ? options.emptyLabel || "Open" : "Upload");
		return '<button type="button" class="fv2-shortcut-card fv2-shortcut-' + escAttr(slugify(label)) + '" data-fv2-action="' + action + '"' + attributes + disabled + '><span class="fv2-shortcut-art" aria-hidden="true"></span><span class="fv2-shortcut-copy"><small>' + esc(eyebrow) + '</small><strong>' + esc(label) + '</strong><em>' + esc(state) + '</em></span><span class="fv2-shortcut-icon">' + icon(iconName) + '</span></button>';
	};

	FileVaultV2.prototype.homeSummaryMarkup = function () {
		var documents = this.studentDocuments();
		var groups = [
			["Profile", "profile", ["curriculum_vitae", "personal_statement", "application_photo"]],
			["Academic", "academic", ["mspe", "medical_school_transcript", "usmle_transcript", "ecfmg_status_report", "score_report", "certification", "timeline"]],
			["LOR-Related", "letters", ["lor_related", "letter_of_recommendation_1", "letter_of_recommendation_2", "letter_of_recommendation_3"]],
			["Miscellaneous", "other", ["other"]]
		];
		var counts = '<div class="fv2-home-counts">' + groups.map(function (group) {
			var count = documents.filter(function (documentItem) { return group[2].indexOf(documentItem.document_type) !== -1; }).length;
			return '<button type="button" data-fv2-action="open-file-group" data-fv2-file-group="' + escAttr(group[1]) + '"><span>' + esc(group[0]) + '</span><strong>' + esc(count) + "</strong></button>";
		}).join("") + "</div>";
		var recent = documents.slice().sort(function (left, right) { return documentUploadedAt(right).localeCompare(documentUploadedAt(left)); })[0] || null;
		var reviewed = documents.filter(function (documentItem) {
			return ["reviewed", "final", "needs_changes"].indexOf(documentItem.status) !== -1 || !!documentItem.latest_score;
		}).sort(function (left, right) { return String(right.updated_at || "").localeCompare(String(left.updated_at || "")); })[0] || null;
		function record(label, documentItem, dateValue) {
			return documentItem
				? '<button type="button" class="fv2-home-record" data-fv2-action="open-from-home" data-fv2-document-id="' + positiveInt(documentItem.id) + '"><span>' + esc(label) + '</span><strong>' + esc(documentItem.name || "Document") + '</strong><small>' + esc(formatDate(dateValue || documentItem.updated_at)) + "</small>" + icon("arrowRight") + "</button>"
				: '<div class="fv2-home-record is-empty"><span>' + esc(label) + '</span><strong>Nothing recorded yet</strong><small>Your latest File Vault activity will appear here.</small></div>';
		}
		return '<section class="fv2-home-summary"><div class="fv2-section-heading"><div><span>Document summary</span><h2>Find what changed</h2></div><button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="navigate" data-fv2-view="files">Open Your Files' + icon("arrowRight") + "</button></div>" + counts + '<div class="fv2-home-records">' + record("Most recently uploaded", recent, documentUploadedAt(recent)) + record("Most recently reviewed", reviewed, reviewed && reviewed.updated_at) + "</div></section>";
	};

	FileVaultV2.prototype.staffSubjectBannerMarkup = function () {
		var student = this.state.data && this.state.data.student;
		if (!student) return "";
		var activityAction = this.state.view === "audit"
			? '<button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="navigate" data-fv2-view="vault">' + icon("arrowLeft") + "Return to student Home</button>"
			: '<button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="navigate" data-fv2-view="audit">' + icon("activity") + "Staff activity</button>";
		return '<aside class="fv2-subject-banner" role="note"><span>' + icon("users") + '</span><div class="fv2-subject-copy"><strong>Inside ' + esc(student.display_name || "Student") + '\'s File Vault</strong><small>Reviewing this student\'s files as MissionMed staff.</small></div><div class="fv2-subject-actions">' + this.studentPickerMarkup() + activityAction + '<button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="exit-student">' + icon("arrowLeft") + "Back to Students</button></div></aside>";
	};

	FileVaultV2.prototype.vaultMarkup = function () {
		var data = this.state.data || {};
		if (this.state.studentLoading) return this.pageHeadingMarkup("Staff review", "Loading student Vault", "Opening this student's private workspace.", "") + this.loadingMarkup();
		if (this.roleIsStaff() && !data.student) return this.commandMarkup();
		var studentName = data.student && data.student.display_name ? String(data.student.display_name).trim().split(/\s+/)[0] : "there";
		var currentHour = new Date().getHours();
		var greeting = currentHour < 12 ? "Good morning" : (currentHour < 18 ? "Good afternoon" : "Good evening");
		var monogram = String(studentName || "F").trim().charAt(0).toUpperCase() || "F";
		var canUpload = this.capability("upload") && this.storageReady();
		var cv = this.documentForTypes("curriculum_vitae");
		var statement = this.documentForTypes("personal_statement");
		var missionCount = Array.isArray(data.library) ? data.library.length : 0;
		var storageNotice = this.storageReady() ? "" : this.inlineNoticeMarkup("blocked", "Private storage is unavailable", "Existing metadata remains visible. Uploads and secure downloads stay blocked until storage is restored.");
		var selectedType = this.state.homeUploadType || "";
		var selectorOptions = this.uploadCategories().map(function (category) {
			return '<option value="' + escAttr(category[0]) + '" data-fv2-label="' + escAttr(category[1]) + '"' + (category[0] === selectedType ? " selected" : "") + '>' + esc(category[1]) + "</option>";
		}).join("");
		return '<section class="fv2-home-hero"><div class="fv2-home-greeting"><span class="fv2-home-avatar" aria-hidden="true">' + esc(monogram) + '</span><h1 tabindex="-1" data-fv2-page-heading>' + esc(greeting) + ', <em>' + esc(studentName) + '.</em></h1></div><p>What document do you need to move forward today?</p><div class="fv2-home-selector"><label><span>What type of document would you like to upload?</span><select data-fv2-home-upload-type' + (canUpload ? "" : " disabled") + '><option value="">Choose a document type</option>' + selectorOptions + '</select></label><button type="button" data-fv2-action="launch-home-upload" aria-label="Open guided upload"' + (canUpload && selectedType ? "" : " disabled") + '>' + icon("upload") + '<span>Continue</span></button></div><div class="fv2-home-how"><span>How this works</span><p>Choose a document type, review the MissionMed filename, then add it to your private File Vault.</p></div></section>' + storageNotice +
			'<section class="fv2-shortcuts" aria-labelledby="fv2-shortcuts-title"><div class="fv2-section-heading"><div><span>Open fast</span><h2 id="fv2-shortcuts-title">Your key files</h2></div></div><div class="fv2-shortcut-grid">' +
			this.shortcutMarkup("CV", "Profile", "file", cv, { documentType: "curriculum_vitae" }) +
			this.shortcutMarkup("Timeline", "Application journey", "journey", null, { view: "journey", emptyLabel: "Open journey" }) +
			this.shortcutMarkup("Personal Statement", "Written narrative", "file", statement, { documentType: "personal_statement" }) +
			this.shortcutMarkup("Shared by MissionMed", "Mission Files", "library", null, { view: "library", emptyLabel: missionCount + (missionCount === 1 ? " file" : " files") }) +
			"</div></section>" + this.homeSummaryMarkup();
	};

	FileVaultV2.prototype.uploadLandingMarkup = function () {
		if (this.roleIsStaff() && !this.state.selectedStudentId) return this.commandMarkup();
		return this.pageHeadingMarkup("Private File Vault", "Upload", "Choose a category, then confirm the file and details in the guided workflow.", "") +
			'<section class="fv2-upload-landing"><div class="fv2-upload-question"><span>' + icon("upload") + '</span><div><h2>What would you like to upload?</h2><p>Every choice opens the same secure upload experience.</p></div></div>' + this.homeActionsMarkup() + "</section>";
	};

	FileVaultV2.prototype.vaultSecondaryActionsMarkup = function (dropzone) {
		return [
			'<section class="fv2-vault-secondary" aria-label="Additional Vault actions">',
			'<button type="button" class="fv2-journey-shortcut" data-fv2-action="navigate" data-fv2-view="journey">' + icon("journey") + '<span><small>Application record</small><strong>Open application journey</strong></span>' + icon("arrowRight") + "</button>",
			this.nextActionMarkup(),
			dropzone || "",
			"</section>"
		].join("");
	};

	FileVaultV2.prototype.studentPickerMarkup = function () {
		if (!this.roleIsStaff()) return "";
		var students = this.state.staffData && Array.isArray(this.state.staffData.students) ? this.state.staffData.students : [];
		if (!students.length) return "";
		var selected = this.state.selectedStudentId;
		return '<label class="fv2-student-picker"><span>Student</span><select data-fv2-student-picker aria-label="Select a student vault"><option value="">Choose a student</option>' + students.map(function (student) {
			var id = positiveInt(student.id);
			return '<option value="' + id + '"' + (id === selected ? " selected" : "") + ">" + esc(student.display_name || "Student") + "</option>";
		}).join("") + "</select></label>";
	};

	FileVaultV2.prototype.filesMarkup = function () {
		var data = this.state.data || {};
		if (this.state.studentLoading) {
			return this.pageHeadingMarkup("Staff review", "Loading student Vault", "Opening this student's private workspace.", this.studentPickerMarkup()) + this.loadingMarkup();
		}
		if (this.roleIsStaff() && !data.student) {
			return this.commandMarkup();
		}

		var studentName = data.student && data.student.display_name ? data.student.display_name : "Your Files";
		var documentCount = this.studentDocuments().length;
		var headingActions = "";
		if (this.capability("upload") && this.storageReady()) {
			headingActions += '<button type="button" class="fv2-button fv2-button-primary" data-fv2-action="open-upload">' + icon("upload") + "Upload</button>";
		}
		var heading = '<section class="fv2-library-hero"><div><span>Your document library</span><h1 tabindex="-1" data-fv2-page-heading>' + esc(documentCount) + ' document' + (documentCount === 1 ? "" : "s") + ', <em>nothing lost.</em></h1><p>Every private document stays organized here with its current version, review state, and MissionMed history.</p></div>' + headingActions + '</section>';
		var storageNotice = "";
		if (!this.storageReady()) {
			storageNotice = this.inlineNoticeMarkup("blocked", "Private storage is unavailable", "Existing metadata remains visible. Uploads and secure downloads are blocked until storage is restored.");
		}

		var journeyItems = data.journey && Array.isArray(data.journey.items) ? data.journey.items : [];
		var matchedDocumentIds = new Set();
		var entries = journeyItems.map(function (item) {
			var documentId = positiveInt(item.document_id);
			if (documentId) matchedDocumentIds.add(documentId);
			return { item: item, document: documentId ? this.getDocument(documentId) : null };
		}, this);
		(data.documents || []).forEach(function (documentItem) {
			var id = positiveInt(documentItem.id);
			if (!id || matchedDocumentIds.has(id) || documentItem.category === "admin") return;
			entries.push({ item: { document_type: documentItem.document_type, label: "Additional document", status: documentItem.status }, document: documentItem });
		}, this);
		var query = this.state.fileSearch.trim().toLowerCase();
		var groupTypes = {
			profile: ["curriculum_vitae", "personal_statement", "application_photo"],
			academic: ["mspe", "medical_school_transcript", "usmle_transcript", "ecfmg_status_report", "timeline"],
			letters: ["letter_of_recommendation_1", "letter_of_recommendation_2", "letter_of_recommendation_3"],
			other: ["other"]
		};
		var folderItems = [["", "All Files"], ["profile", "Profile"], ["academic", "Academic"], ["letters", "LOR-Related"], ["other", "Miscellaneous"]];
		var folderStrip = '<nav class="fv2-folder-strip" aria-label="File folders"><span>' + icon("folder") + "Vault</span>" + folderItems.map(function (folder) {
			var active = this.state.fileType === folder[0];
			return '<button type="button" data-fv2-action="open-file-group" data-fv2-file-group="' + escAttr(folder[0]) + '"' + (active ? ' aria-current="page" class="is-active"' : "") + ">" + icon("folder") + esc(folder[1]) + "</button>";
		}, this).join("") + "</nav>";
		entries = entries.filter(function (entry) {
			var documentItem = entry.document;
			var type = String((documentItem && documentItem.document_type) || entry.item.document_type || "other");
			var status = String((documentItem && documentItem.status) || entry.item.status || "missing");
			var text = [documentItem && documentItem.name, documentItem && documentItem.original_name, entry.item.label, type, status].join(" ").toLowerCase();
			var typeMatch = !this.state.fileType || type === this.state.fileType || (groupTypes[this.state.fileType] || []).indexOf(type) !== -1;
			return (!query || text.indexOf(query) !== -1) && typeMatch && (!this.state.fileStatus || status === this.state.fileStatus);
		}, this);
		entries.sort(function (left, right) {
			var leftDocument = left.document;
			var rightDocument = right.document;
			if (!leftDocument && rightDocument) return 1;
			if (leftDocument && !rightDocument) return -1;
			if (this.state.fileSort === "name") return String((leftDocument && leftDocument.name) || left.item.label || "").localeCompare(String((rightDocument && rightDocument.name) || right.item.label || ""));
			var compared = String((rightDocument && rightDocument.updated_at) || "").localeCompare(String((leftDocument && leftDocument.updated_at) || ""));
			return this.state.fileSort === "updated_asc" ? -compared : compared;
		}.bind(this));
		var rows = entries.map(function (entry) {
			return entry.document ? this.documentRowMarkup(entry.document, entry.item.label) : this.requirementRowMarkup(entry.item, null);
		}, this);

		var emptyActions = this.capability("upload") && this.storageReady()
			? '<button type="button" class="fv2-button fv2-button-primary" data-fv2-action="open-upload">' + icon("upload") + "Upload first document</button>"
			: "";
		var listBody = rows.length
			? '<div class="fv2-document-list fv2-document-' + escAttr(this.state.fileLayout) + '">' + rows.join("") + "</div>"
			: this.stateMessageMarkup("empty", query || this.state.fileType || this.state.fileStatus ? "No files match these filters" : "Your Files is ready", query || this.state.fileType || this.state.fileStatus ? "Try a different search, folder, or status." : "Upload your first document to begin a private, organized history.", emptyActions);
		var dropzone = this.capability("upload") && this.storageReady() ? [
			'<div class="fv2-dropzone" data-fv2-dropzone>',
			'<span class="fv2-dropzone-icon">' + icon("upload") + "</span>",
			'<div><strong>Add a document</strong><span>Drop a supported file here or use the guided upload.</span></div>',
			'<button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="open-upload">Choose file</button>',
			"</div>"
		].join("") : "";

		var selected = this.getDocument(this.state.selectedDocumentId);
		var desktopDetail = selected && !this.mobileQuery.matches ? this.documentDetailMarkup(selected, false) : "";
		var groupOptions = [["profile", "Profile files"], ["academic", "Academic files"], ["letters", "LOR-related files"]].map(function (group) {
			return '<option value="' + group[0] + '"' + (this.state.fileType === group[0] ? " selected" : "") + ">" + group[1] + "</option>";
		}, this).join("");
		var typeOptions = Object.keys(data.document_types || {}).sort(function (left, right) {
			return String(data.document_types[left]).localeCompare(String(data.document_types[right]));
		}).map(function (type) {
			return '<option value="' + escAttr(type) + '"' + (this.state.fileType === type ? " selected" : "") + ">" + esc(data.document_types[type]) + "</option>";
		}, this).join("");
		var finder = '<section class="fv2-finder" aria-label="Your Files controls"><label class="fv2-finder-search">' + icon("search") + '<span class="fv2-sr-only">Search your files</span><input type="search" data-fv2-file-search data-fv2-focus-key="file-search" value="' + escAttr(this.state.fileSearch) + '" placeholder="Search file names, types, and status"></label><label><span class="fv2-sr-only">Filter by document type</span><select data-fv2-file-type data-fv2-focus-key="file-type"><option value="">All types</option>' + groupOptions + typeOptions + '</select></label><label><span class="fv2-sr-only">Filter by status</span><select data-fv2-file-status data-fv2-focus-key="file-status"><option value="">All statuses</option>' + Object.keys(STATUS).map(function (status) { return '<option value="' + status + '"' + (this.state.fileStatus === status ? " selected" : "") + ">" + esc(STATUS[status].label) + "</option>"; }, this).join("") + '</select></label><label><span class="fv2-sr-only">Sort files</span><select data-fv2-file-sort data-fv2-focus-key="file-sort"><option value="updated_desc"' + (this.state.fileSort === "updated_desc" ? " selected" : "") + '>Newest updated</option><option value="updated_asc"' + (this.state.fileSort === "updated_asc" ? " selected" : "") + '>Oldest updated</option><option value="name"' + (this.state.fileSort === "name" ? " selected" : "") + '>Name A-Z</option></select></label><div class="fv2-finder-layout" role="group" aria-label="File layout"><button type="button" data-fv2-action="file-layout" data-fv2-layout="list" data-fv2-focus-key="file-layout-list" aria-label="List view" aria-pressed="' + (this.state.fileLayout === "list" ? "true" : "false") + '" class="' + (this.state.fileLayout === "list" ? "is-active" : "") + '">' + icon("list") + '</button><button type="button" data-fv2-action="file-layout" data-fv2-layout="grid" data-fv2-focus-key="file-layout-grid" aria-label="Grid view" aria-pressed="' + (this.state.fileLayout === "grid" ? "true" : "false") + '" class="' + (this.state.fileLayout === "grid" ? "is-active" : "") + '">' + icon("grid") + "</button></div></section>";
		return heading + storageNotice + folderStrip + finder +
			'<div class="fv2-vault-layout' + (desktopDetail ? " has-detail" : "") + '"><section class="fv2-list-panel" aria-labelledby="fv2-document-list-title"><div class="fv2-section-heading"><div><span>' + esc(studentName) + '</span><h2 id="fv2-document-list-title">Your documents</h2></div><strong>' + esc(rows.length) + " shown</strong></div>" + listBody + "</section>" + desktopDetail + "</div>" +
			'<section class="fv2-files-secondary">' + dropzone + '<button type="button" class="fv2-journey-shortcut" data-fv2-action="navigate" data-fv2-view="journey">' + icon("journey") + '<span><small>Application record</small><strong>Open application journey</strong></span>' + icon("arrowRight") + "</button></section>";
	};

	FileVaultV2.prototype.inlineNoticeMarkup = function (kind, title, message) {
		return '<div class="fv2-inline-notice fv2-inline-' + escAttr(kind) + '" role="status">' + icon(kind === "blocked" || kind === "error" ? "alert" : "check") + '<div><strong>' + esc(title) + "</strong><span>" + esc(message) + "</span></div></div>";
	};

	FileVaultV2.prototype.requirementRowMarkup = function (item, documentItem) {
		var label = item && item.label ? item.label : "Document requirement";
		if (documentItem) return this.documentRowMarkup(documentItem, label);
		var storageReady = this.storageReady() && this.capability("upload");
		return [
				'<button type="button" class="fv2-document-row is-missing" data-fv2-action="open-upload" data-fv2-document-type="' + escAttr(item && item.document_type || "other") + '" data-fv2-display-name="' + escAttr(label) + '" data-fv2-focus-key="requirement-' + escAttr(item && item.document_type || "other") + '"' + (storageReady ? "" : " disabled") + ">",
			'<span class="fv2-file-glyph">' + icon("file") + "</span>",
			'<span class="fv2-row-copy"><strong>' + esc(label) + '</strong><span>Required document is not in this Vault.</span></span>',
			statusBadge("missing"),
			'<span class="fv2-row-action">' + (storageReady ? "Add" : "Blocked") + icon("arrowRight") + "</span>",
			"</button>"
		].join("");
	};

	FileVaultV2.prototype.documentRowMarkup = function (documentItem, requirementLabel, options) {
		options = options || {};
		var id = positiveInt(documentItem.id);
		var selected = id === this.state.selectedDocumentId;
		var kind = documentFileKind(documentItem);
		var dateValue = options.dateKind === "uploaded" ? documentUploadedAt(documentItem) : documentItem.updated_at;
		var dateLabel = options.dateKind === "uploaded" ? "Uploaded " + formatDate(dateValue) : formatDate(dateValue);
		var metadata = ["v" + Math.max(1, positiveInt(documentItem.version)), documentItem.is_final ? "Final" : "", formatSize(documentItem.file_size), dateLabel].filter(Boolean).join(" / ");
		var visualType = String(documentItem.document_type || "other").replace(/[^a-z0-9_-]/ig, "-");
		return [
				'<button type="button" class="fv2-document-row fv2-document-type-' + escAttr(visualType) + (selected ? " is-selected" : "") + '" data-fv2-action="select-document" data-fv2-document-id="' + id + '" data-fv2-focus-key="document-' + id + '"' + (selected ? ' aria-current="true"' : "") + ">",
			'<span class="fv2-file-glyph fv2-file-kind-' + escAttr(kind.key) + '">' + icon("file") + "<small>" + esc(kind.label) + "</small></span>",
			'<span class="fv2-row-copy"><strong>' + esc(documentItem.name || requirementLabel || "Document") + "</strong><span>" + esc(requirementLabel || documentItem.original_name || "Document") + ' <span aria-hidden="true">/</span> ' + esc(metadata) + "</span></span>",
			statusBadge(documentItem.status, documentItem.status_label),
			'<span class="fv2-row-action">Quick Look' + icon("arrowRight") + "</span>",
			"</button>"
		].join("");
	};

	FileVaultV2.prototype.documentDetailMarkup = function (documentItem, mobile) {
		var id = positiveInt(documentItem.id);
		var canDownload = this.capability("download") && documentItem.download_available !== false && this.storageReady();
		var canVersion = this.capability("upload") && this.storageReady();
		var verified = documentItem.verification_state === "ready_clean";
		var canSubmit = verified && this.capability("submit") && ["draft", "uploaded", "needs_changes"].indexOf(documentItem.status) !== -1;
		var notes = "";
		if (documentItem.review_note) notes += '<div class="fv2-detail-note fv2-detail-note-review"><span>Review note</span><p>' + esc(documentItem.review_note).replace(/\n/g, "<br>") + "</p></div>";
		if (documentItem.note) notes += '<div class="fv2-detail-note"><span>Version note</span><p>' + esc(documentItem.note).replace(/\n/g, "<br>") + "</p></div>";
		if (!verified) notes += '<div class="fv2-inline-notice fv2-inline-blocked" role="status">' + icon("alert") + '<div><strong>Imported legacy file</strong><span>Upload a verified V2 version before review, scoring, or V2 download.</span></div></div>';
		var actions = [
			'<button type="button" class="fv2-button fv2-button-primary" data-fv2-action="open-workspace" data-fv2-document-id="' + id + '">' + icon("file") + "Open Doc Docs</button>"
		];
		actions.push('<button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="quicklook-document" data-fv2-document-id="' + id + '">Quick Look</button>');
		if (canDownload) actions.push('<button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="download" data-fv2-document-id="' + id + '">' + icon("download") + "Download</button>");
		if (!canDownload && documentItem.download_available === false && this.classicFallbackAvailable()) actions.push('<button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="fallback-v1">' + icon("refresh") + "Open classic File Vault</button>");
		if (canVersion) actions.push('<button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="open-version" data-fv2-document-id="' + id + '">' + icon("upload") + "New version</button>");
		if (canSubmit) actions.push('<button type="button" class="fv2-button fv2-button-success" data-fv2-action="submit-document" data-fv2-document-id="' + id + '" data-fv2-focus-key="submit-' + id + '">' + icon("check") + "Submit for review</button>");
		return [
			'<aside class="fv2-detail-panel' + (mobile ? " is-mobile" : "") + '" aria-labelledby="fv2-detail-title">',
			'<div class="fv2-detail-top"><span>Selected document</span><button type="button" class="fv2-icon-button" data-fv2-action="close-detail" aria-label="Close document details">' + icon("close") + "</button></div>",
			'<div class="fv2-detail-file">' + icon("file") + '<div><h2 id="fv2-detail-title">' + esc(documentItem.name || "Document") + "</h2><p>" + esc(documentItem.original_name || documentItem.canonical_name || "Private file") + "</p></div></div>",
			statusBadge(documentItem.status, documentItem.status_label),
			'<dl class="fv2-detail-ledger"><div><dt>Version</dt><dd>' + esc(Math.max(1, positiveInt(documentItem.version))) + (documentItem.is_final ? " · Final" : "") + "</dd></div><div><dt>Size</dt><dd>" + esc(formatSize(documentItem.file_size)) + "</dd></div><div><dt>Updated</dt><dd>" + esc(formatDate(documentItem.updated_at)) + "</dd></div><div><dt>Comments</dt><dd>" + esc(Math.max(0, Number(documentItem.open_comment_count) || 0)) + " open</dd></div></dl>",
			notes,
			'<div class="fv2-detail-actions">' + actions.join("") + "</div>",
			"</aside>"
		].join("");
	};

	FileVaultV2.prototype.journeyMarkup = function () {
		var journey = this.state.data && this.state.data.journey ? this.state.data.journey : {};
		var items = Array.isArray(journey.items) ? journey.items : [];
		var percent = boundedInt(journey.coverage_percent, 0, 100);
		var requirementSet = journey.requirement_set && typeof journey.requirement_set === "object" ? journey.requirement_set : {};
		var summary = esc(Math.max(0, Number(journey.complete_count) || 0)) + " of " + esc(Math.max(0, Number(journey.total_count) || items.length)) + " assigned documents in the review loop";
		var rows = items.map(function (item) {
			var id = positiveInt(item.document_id);
			var hasDocument = !!id;
			var canUpload = this.capability("upload") && this.storageReady();
			return '<button type="button" class="fv2-journey-row" data-fv2-action="' + (hasDocument ? "open-journey-document" : "open-upload") + '"' + (hasDocument ? ' data-fv2-document-id="' + id + '"' : ' data-fv2-document-type="' + escAttr(item.document_type || "other") + '" data-fv2-display-name="' + escAttr(item.label || "Document") + '"' + (canUpload ? "" : " disabled")) + '><span class="fv2-journey-node" aria-hidden="true"></span><span><strong>' + esc(item.label || "Document requirement") + "</strong><small>" + (hasDocument ? "Open document" : "No document uploaded") + "</small></span>" + statusBadge(item.status || (hasDocument ? "uploaded" : "missing")) + icon("arrowRight") + "</button>";
		}, this).join("");
		var gates = journey && Array.isArray(journey.gates) ? journey.gates : [];
		var gatesMarkup = gates.length ? '<div class="fv2-gate-list">' + gates.map(function (gate) {
			return '<div class="fv2-gate-row"><span>' + icon("clock") + "</span><div><strong>" + esc(gate.label || "Application date") + "</strong><small>" + esc(formatDate(gate.date)) + "</small></div></div>";
		}).join("") + "</div>" : this.stateMessageMarkup("empty", "No journey dates yet", "Milestone dates will appear when they are added to your plan.", "");
		return this.pageHeadingMarkup("Application record", "Journey", "Keep your document plan and application milestones together.", "") +
			'<section class="fv2-journey-summary"><div><span>' + esc(journey.label || "Application document coverage") + '</span><strong>' + percent + "%</strong><p>" + summary + '</p></div><div class="fv2-progress" role="progressbar" aria-label="Document coverage" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + percent + '"><span style="width:' + percent + '%"></span></div></section>' +
			'<div class="fv2-two-column"><section class="fv2-section"><div class="fv2-section-heading"><div><span>Your plan</span><h2>' + esc(requirementSet.label || "Document coverage") + '</h2>' + (requirementSet.source ? '<small>Source: ' + esc(requirementSet.source) + '</small>' : "") + '</div></div>' + (rows || this.stateMessageMarkup("empty", "No document plan assigned", "Your required documents will appear here when your plan is ready.", "")) + '</section><section class="fv2-section"><div class="fv2-section-heading"><div><span>Milestones</span><h2>Journey dates</h2></div></div>' + gatesMarkup + "</section></div>";
	};

	FileVaultV2.prototype.recentMarkup = function () {
		var documents = this.studentDocuments().slice().sort(function (left, right) {
			return documentUploadedAt(right).localeCompare(documentUploadedAt(left));
		});
		var rows = documents.map(function (documentItem) { return this.documentRowMarkup(documentItem, "", { dateKind: "uploaded" }); }, this).join("");
		var selected = this.getDocument(this.state.selectedDocumentId);
		var desktopDetail = selected && !this.mobileQuery.matches ? this.documentDetailMarkup(selected, false) : "";
		var body = rows ? '<div class="fv2-document-list">' + rows + '</div>' : this.stateMessageMarkup("empty", "Your recent uploads will appear here", "Add a document whenever you are ready.", '<button type="button" class="fv2-button fv2-button-primary" data-fv2-action="open-upload">' + icon("upload") + "Upload a document</button>");
		return this.pageHeadingMarkup("Newest first", "Recently Uploaded", "Your newest uploads appear first.", "") + '<div class="fv2-vault-layout' + (desktopDetail ? " has-detail" : "") + '"><section class="fv2-list-panel"><div class="fv2-section-heading"><div><span>Private document history</span><h2>Latest files</h2></div><strong>' + esc(documents.length) + " files</strong></div>" + body + "</section>" + desktopDetail + "</div>";
	};

	FileVaultV2.prototype.libraryMarkup = function () {
		var legacy = this.state.data && Array.isArray(this.state.data.library) ? this.state.data.library : [];
		var rows = this.state.shares.missionmed || [];
		var pagination = this.state.sharePagination.missionmed || {};
		var actions = this.capability("share_mission_file") && !this.isStudentLens() ? '<button type="button" class="fv2-button fv2-button-primary" data-fv2-action="open-share-upload" data-fv2-share-source="missionmed">' + icon("upload") + 'Share Mission File</button>' : "";
		var legacyBody = legacy.map(function (documentItem) {
			var id = positiveInt(documentItem.id);
			var canDownload = this.capability("download") && documentItem.download_available !== false && this.storageReady();
			return '<article class="fv2-library-row"><span class="fv2-file-glyph">' + icon("library") + '</span><div><h2>' + esc(documentItem.name || "Shared document") + "</h2><p>" + esc([documentItem.original_name || "Private file", "v" + Math.max(1, positiveInt(documentItem.version)), formatSize(documentItem.file_size)].join(" / ")) + '</p></div><div class="fv2-share-row-actions"><button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="quicklook-document" data-fv2-document-id="' + id + '">Quick Look</button>' + (canDownload ? '<button type="button" class="fv2-icon-button" data-fv2-action="download" data-fv2-document-id="' + id + '" aria-label="Securely download ' + escAttr(documentItem.name || "document") + '" title="Download">' + icon("download") + "</button>" : '<span class="fv2-library-blocked">Unavailable</span>') + "</div></article>";
		}, this).join("");
		var normalizedBody = rows.map(function (share) { return this.shareRowMarkup(share); }, this).join("");
		var loading = this.state.sharesLoading.missionmed && !rows.length ? this.stateMessageMarkup("loading", "Loading Mission Files", "Checking your current access.", "") : "";
		var error = this.state.sharesError.missionmed ? this.stateMessageMarkup("error", "Mission Files unavailable", this.state.sharesError.missionmed, '<button type="button" class="fv2-button fv2-button-primary" data-fv2-action="retry-shares" data-fv2-share-source="missionmed">' + icon("refresh") + "Retry</button>") : "";
		var body = loading || error || (normalizedBody + legacyBody ? '<div class="fv2-library-list">' + normalizedBody + legacyBody + "</div>" : this.stateMessageMarkup("empty", "Nothing shared with you yet", "When MissionMed shares a file, it will appear here automatically.", actions));
		var loadMore = pagination.has_more ? '<div class="fv2-modal-actions"><button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="load-more-shares" data-fv2-share-source="missionmed"' + (this.state.sharesLoading.missionmed ? " disabled" : "") + ">" + icon("refresh") + (this.state.sharesLoading.missionmed ? "Loading files" : "Load more files") + "</button></div>" : "";
		return this.pageHeadingMarkup("Shared by MissionMed", "Mission Files", "MissionMed resources remain private to their intended audience.", actions) + '<section class="fv2-section"><div class="fv2-section-heading"><div><span>Your Mission Files</span><h2>Shared with this Vault</h2></div><strong>' + esc(rows.length + legacy.length) + " files</strong></div>" + body + loadMore + "</section>";
	};

	FileVaultV2.prototype.sharedMarkup = function () {
		var rows = this.state.shares.student_shared || [];
		var pagination = this.state.sharePagination.student_shared || {};
		var canShare = this.capability("share_student_file") && !this.roleIsStaff();
		var actions = canShare ? '<button type="button" class="fv2-button fv2-button-primary" data-fv2-action="open-share-upload" data-fv2-share-source="student_shared">' + icon("upload") + 'Share with students</button>' : "";
		var loading = this.state.sharesLoading.student_shared && !rows.length ? this.stateMessageMarkup("loading", "Loading shared files", "Checking current enrollment access.", "") : "";
		var error = this.state.sharesError.student_shared ? this.stateMessageMarkup("error", "Student shared files unavailable", this.state.sharesError.student_shared, '<button type="button" class="fv2-button fv2-button-primary" data-fv2-action="retry-shares" data-fv2-share-source="student_shared">' + icon("refresh") + "Retry</button>") : "";
		var body = loading || error || (rows.length ? '<div class="fv2-library-list">' + rows.map(function (share) { return this.shareRowMarkup(share); }, this).join("") + "</div>" : this.stateMessageMarkup("empty", "No student files shared here yet", "Controlled sharing is limited to current enrolled peers and remains visible to MissionMed staff.", actions));
		var loadMore = pagination.has_more ? '<div class="fv2-modal-actions"><button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="load-more-shares" data-fv2-share-source="student_shared"' + (this.state.sharesLoading.student_shared ? " disabled" : "") + ">" + icon("refresh") + (this.state.sharesLoading.student_shared ? "Loading files" : "Load more files") + "</button></div>" : "";
		return this.pageHeadingMarkup("Controlled student sharing", "Student Shared Files", "Files are visible only to the server-approved audience and can be disabled by MissionMed.", actions) + '<section class="fv2-section"><div class="fv2-section-heading"><div><span>Shared by enrolled students</span><h2>Current resources</h2></div><strong>' + esc(rows.length) + " files</strong></div>" + body + loadMore + "</section>";
	};

	FileVaultV2.prototype.shareRowMarkup = function (share) {
		var id = positiveInt(share && share.id);
		var active = String(share && share.status || "active") === "active";
		var isAdmin = this.role() === "admin" && !this.isStudentLens();
		var managementActions = isAdmin
			? '<button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="share-recipients" data-fv2-share-id="' + id + '">Access status</button>'
			: "";
		var canShowManagement = share && share.can_manage && (!this.roleIsStaff() || !this.isStudentLens());
		if (canShowManagement && (active || share.can_reactivate)) managementActions += '<button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="share-status" data-fv2-share-id="' + id + '" data-fv2-share-status="' + (active ? "disabled" : "active") + '">' + (active ? "Disable" : "Reactivate") + "</button>";
		var statusLabel = active ? "Active" : (share && share.moderation_status ? "Disabled by MissionMed" : "Disabled");
		return '<article class="fv2-library-row fv2-share-row"><span class="fv2-file-glyph">' + icon(share && String(share.mime_type || "").indexOf("video/") === 0 ? "activity" : "library") + '</span><div><span class="fv2-share-provenance">' + esc(share && share.source_class === "missionmed" ? "MISSIONMED" : "ENROLLED STUDENT") + '</span><h2>' + esc(share && share.title || "Shared file") + '</h2><p>' + esc([share && share.uploader_name || "MissionMed", formatSize(share && share.file_size), formatDate(share && share.shared_at)].join(" / ")) + '</p></div>' + statusBadge(active ? "final" : "missing", statusLabel) + '<div class="fv2-share-row-actions"><button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="quicklook-share" data-fv2-share-id="' + id + '">Quick Look</button><button type="button" class="fv2-icon-button" data-fv2-action="download-share" data-fv2-share-id="' + id + '" aria-label="Download ' + escAttr(share && share.title || "shared file") + '" title="Download"' + (active ? "" : " disabled") + '>' + icon("download") + "</button>" + managementActions + "</div></article>";
	};

	FileVaultV2.prototype.activityMarkup = function () {
		var events = this.state.data && Array.isArray(this.state.data.activity) ? this.state.data.activity : [];
		var body = events.length ? '<div class="fv2-activity-list">' + events.map(function (eventItem) {
			return '<article class="fv2-activity-row"><span class="fv2-activity-mark">' + icon("activity") + '</span><div><h2>' + esc(eventItem.message || "File Vault activity") + "</h2><p>" + esc(eventItem.document_name || "Document") + "</p></div><div><strong>" + esc(eventItem.actor || "MissionMed user") + "</strong><time datetime=\"" + escAttr(eventItem.at || "") + "\">" + esc(formatDate(eventItem.at, true)) + "</time></div></article>";
		}).join("") + "</div>" : this.stateMessageMarkup("empty", "No document updates", "Your latest File Vault updates will appear here.", "");
		return this.pageHeadingMarkup("Latest document updates", "Notifications", "Your latest File Vault updates appear here.", "") + '<section class="fv2-section"><div class="fv2-section-heading"><div><span>Vault activity</span><h2>Recent updates</h2></div><strong>' + esc(events.length) + " events</strong></div>" + body + "</section>";
	};

	FileVaultV2.prototype.reviewQueueMarkup = function () {
		if (!this.roleIsStaff()) return this.vaultMarkup();
		var data = this.state.staffData || this.state.data || {};
		var queue = Array.isArray(data.review_queue) ? data.review_queue : [];
		var rows = queue.length ? '<div class="fv2-queue-list">' + queue.map(function (documentItem) {
			var id = positiveInt(documentItem.id);
			var studentId = positiveInt(documentItem.student && documentItem.student.id);
			return '<button type="button" class="fv2-queue-row" data-fv2-action="open-queue-document" data-fv2-student-id="' + studentId + '" data-fv2-document-id="' + id + '" data-fv2-focus-key="queue-' + id + '"><span class="fv2-file-glyph">' + icon("file") + '</span><span><strong>' + esc(documentItem.name || "Document") + '</strong><small>' + esc(documentItem.student && documentItem.student.display_name || "Student") + ' / Updated ' + esc(formatDate(documentItem.updated_at)) + '</small></span>' + statusBadge(documentItem.status, documentItem.status_label) + icon("arrowRight") + '</button>';
		}).join("") + "</div>" : this.stateMessageMarkup("empty", "Review queue is clear", "No server-scoped documents are waiting in an active review state.", "");
		return this.pageHeadingMarkup("Staff workflow", "Review Queue", "Open a document to enter the same student Vault with explicit staff context.", "") + '<section class="fv2-section"><div class="fv2-section-heading"><div><span>Oldest loaded updates first</span><h2>Documents awaiting review</h2></div><strong>' + esc(queue.length) + " loaded</strong></div>" + rows + "</section>";
	};

	FileVaultV2.prototype.commandMarkup = function () {
		if (!this.roleIsStaff()) return this.vaultMarkup();
		var data = this.state.staffData || this.state.data || {};
		var query = this.state.commandSearch.trim().toLowerCase();
		var listing = query && this.state.staffSearchData ? this.state.staffSearchData : data;
		var pagination = listing.staff_pagination && typeof listing.staff_pagination === "object" ? listing.staff_pagination : { has_more: false, scope_complete: true };
		var students = Array.isArray(listing.students) ? listing.students : [];
		var studentRows = students.length ? '<div class="fv2-command-list">' + students.map(function (student) {
			var id = positiveInt(student.id);
			var documentCount = Math.max(0, Number(student.document_count) || 0);
			var attentionCount = Math.max(0, Number(student.needs_attention) || 0);
			var detail = documentCount + (documentCount === 1 ? " document" : " documents");
			if (attentionCount) detail += " / " + attentionCount + " need" + (attentionCount === 1 ? "s" : "") + " attention";
			return '<button type="button" class="fv2-command-row" data-fv2-action="load-student" data-fv2-student-id="' + id + '" data-fv2-focus-key="student-' + id + '"><span class="fv2-student-monogram" aria-hidden="true">' + esc(String(student.display_name || "S").charAt(0).toUpperCase()) + '</span><span class="fv2-command-student"><strong>' + esc(student.display_name || "Student") + '</strong><small>' + esc(detail) + '</small></span><span class="fv2-command-open">Open File Vault</span>' + icon("arrowRight") + "</button>";
		}).join("") + "</div>" : this.stateMessageMarkup("empty", query ? "No matching students" : "No students in scope", query ? "Try a different name." : "No students are available in this staff view.", "");
		if (query && this.state.staffSearchLoading) studentRows = this.stateMessageMarkup("loading", "Searching students", "Checking your MissionMed roster.", "");
		else if (query && this.state.staffSearchError) studentRows = this.stateMessageMarkup("error", "Student search unavailable", this.state.staffSearchError, "");
		var loadMore = pagination.has_more || this.state.staffLoadError ? '<div class="fv2-modal-actions">' + (this.state.staffLoadError ? '<span role="alert">' + esc(this.state.staffLoadError) + "</span>" : "") + '<button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="load-more-staff" data-fv2-focus-key="staff-load-more"' + (this.state.staffLoadingMore ? " disabled" : "") + ">" + icon("refresh") + (this.state.staffLoadingMore ? "Loading roster" : "Load more students") + "</button></div>" : "";
		var queue = Array.isArray(data.review_queue) ? data.review_queue : [];
			return '<div class="fv2-staff-workspace"><section class="fv2-staff-entry"><span class="fv2-home-eyebrow">MissionMed staff workspace</span><h1 tabindex="-1" data-fv2-page-heading>Whose File Vault would you like to <em>open?</em></h1><p>Find a student and open their File Vault.</p><label class="fv2-staff-search">' + icon("search") + '<span class="fv2-sr-only">Search students</span><input type="search" data-fv2-command-search data-fv2-focus-key="command-search" value="' + escAttr(this.state.commandSearch) + '" placeholder="Search students by name"></label><div class="fv2-staff-entry-actions"><button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="navigate" data-fv2-view="review">' + icon("clock") + 'Review Queue <span>' + esc(queue.length) + '</span></button><button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="navigate" data-fv2-view="audit">' + icon("activity") + 'Staff Activity</button></div></section><section class="fv2-section fv2-students-section"><div class="fv2-section-heading"><div><span>Your students</span><h2>Open a student File Vault</h2></div></div>' + studentRows + loadMore + '</section></div><p class="fv2-sr-only" aria-live="polite">' + esc(this.state.paginationAnnouncement) + "</p>";
	};

	FileVaultV2.prototype.auditMarkup = function () {
		if (!this.roleIsStaff()) return this.activityMarkup();
		if (this.state.auditLoading) return this.pageHeadingMarkup("Staff record", "Activity review", "Loading the authorized operational event feed.", "") + this.loadingMarkup();
		if (this.state.auditError && (!Array.isArray(this.state.audit) || !this.state.audit.length)) {
			return this.pageHeadingMarkup("Staff record", "Activity review", "Every returned event is scoped by the server.", "") + this.stateMessageMarkup("error", "Operational history unavailable", this.state.auditError, '<button type="button" class="fv2-button fv2-button-primary" data-fv2-action="retry-audit">' + icon("refresh") + "Retry</button>");
		}
		var events = Array.isArray(this.state.audit) ? this.state.audit : [];
		var query = this.state.auditSearch.trim().toLowerCase();
		var filtered = query ? events.filter(function (eventItem) {
			return [eventItem.message, eventItem.document_name, eventItem.actor, eventItem.student && eventItem.student.display_name].join(" ").toLowerCase().indexOf(query) !== -1;
		}) : events;
		var body = filtered.length ? '<div class="fv2-audit-list">' + filtered.map(function (eventItem, index) {
			var eventKey = String(eventItem.id || "event-" + index).replace(/[^A-Za-z0-9_-]/g, "_");
			return '<article class="fv2-audit-row" tabindex="-1" data-fv2-focus-key="audit-event-' + escAttr(eventKey) + '"><span>' + icon("activity") + '</span><div><h2>' + esc(eventItem.message || "File Vault event") + "</h2><p>" + esc(eventItem.document_name || "Document") + " / " + esc(eventItem.student && eventItem.student.display_name || "Student") + "</p></div><div><strong>" + esc(eventItem.actor || "MissionMed user") + "</strong><time datetime=\"" + escAttr(eventItem.at || "") + "\">" + esc(formatDate(eventItem.at, true)) + "</time></div></article>";
		}).join("") + "</div>" : this.stateMessageMarkup("empty", query ? "No matching events" : "No operational events returned", query ? "Try a different search." : "Authorized document events will appear here.", "");
		var pagination = this.state.auditPagination || {};
		var loadMore = pagination.has_more || this.state.auditError ? '<div class="fv2-modal-actions">' + (this.state.auditError ? '<span role="alert">' + esc(this.state.auditError) + "</span>" : "") + '<button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="load-more-audit" data-fv2-focus-key="audit-load-more"' + (this.state.auditLoadingMore ? " disabled" : "") + ">" + icon("refresh") + (this.state.auditLoadingMore ? "Loading activity" : "Load more activity") + "</button></div>" : "";
		var downloads = Array.isArray(this.state.downloads) ? this.state.downloads : [];
		var downloadBody = this.state.downloadsLoading ? this.stateMessageMarkup("loading", "Loading access evidence", "Reading normalized signed-link events.", "") : (this.state.downloadsError ? this.stateMessageMarkup("error", "Access evidence unavailable", this.state.downloadsError, "") : (downloads.length ? '<div class="fv2-audit-list">' + downloads.map(function (item) { return '<article class="fv2-audit-row"><span>' + icon("download") + '</span><div><h2>' + esc(item.file_name || "Shared file") + '</h2><p>' + esc(String(item.source_class || "private").replace(/_/g, " ")) + ' / Version ' + esc(item.version || 1) + '</p></div><div><strong>' + esc(item.user_name || "MissionMed user") + '</strong><time datetime="' + escAttr(item.created_at || "") + '">' + esc(formatDate(item.created_at, true)) + '</time></div></article>'; }).join("") + '</div>' : this.stateMessageMarkup("empty", "No signed links issued", "Authorized download-link issuance will appear here.", "")));
		return this.pageHeadingMarkup("Staff record", "Activity review", "Server-scoped document and signed-download-link evidence for authorized staff.", "") + '<p class="fv2-sr-only" aria-live="polite">' + esc(this.state.paginationAnnouncement) + '</p><section class="fv2-section" tabindex="-1" data-fv2-focus-key="audit-feed"><div class="fv2-section-heading"><div><span>Authorized event feed</span><h2>Document activity</h2></div><label class="fv2-search">' + icon("search") + '<span class="fv2-sr-only">Search loaded activity</span><input type="search" data-fv2-audit-search data-fv2-focus-key="audit-search" value="' + escAttr(this.state.auditSearch) + '" placeholder="Search loaded activity"></label></div>' + body + loadMore + '</section><section class="fv2-section"><div class="fv2-section-heading"><div><span>Normalized access evidence</span><h2>Signed links issued</h2></div><strong>' + esc(downloads.length) + ' loaded</strong></div>' + downloadBody + "</section>";
	};

	FileVaultV2.prototype.docDocsMarkup = function () {
		var documentItem = this.getDocument(this.state.selectedDocumentId);
		var back = '<button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="back-vault">' + icon("arrowLeft") + "Back to Your Files</button>";
		if (this.state.documentLoading) return this.pageHeadingMarkup("Binary document workspace", "Doc Docs", "Loading the selected document record.", back) + this.loadingMarkup();
		if (this.state.documentError) {
			return this.pageHeadingMarkup("Binary document workspace", "Doc Docs", "The file itself remains private.", back) + this.stateMessageMarkup("error", "Document unavailable", this.state.documentError, '<button type="button" class="fv2-button fv2-button-primary" data-fv2-action="retry-document">' + icon("refresh") + "Retry</button>");
		}
		if (!documentItem) return this.pageHeadingMarkup("Binary document workspace", "Doc Docs", "Select a Vault document to begin.", back) + this.stateMessageMarkup("empty", "No document selected", "Return to Vault and select a document.", back);

		var id = positiveInt(documentItem.id);
		var canDownload = this.capability("download") && documentItem.download_available !== false && this.storageReady();
		var actions = back;
		if (canDownload) actions += '<button type="button" class="fv2-button fv2-button-primary" data-fv2-action="download" data-fv2-document-id="' + id + '">' + icon("download") + "Download current</button>";
		if (!canDownload && documentItem.download_available === false && this.classicFallbackAvailable()) actions += '<button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="fallback-v1">' + icon("refresh") + "Open classic File Vault</button>";
		if (this.capability("upload") && this.storageReady()) actions += '<button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="open-version" data-fv2-document-id="' + id + '">' + icon("upload") + "Upload new version</button>";
		var workspaceTabs = [["score", "Score"], ["versions", "Versions"], ["comments", "Comments"]];
		if (this.roleIsStaff() && this.capability("internal_notes")) workspaceTabs.push(["internal-notes", "Internal notes"]);
		var tabs = workspaceTabs.map(function (tab) {
			var count = tab[0] === "comments" && Number(documentItem.open_comment_count) > 0 ? " " + Math.max(0, Number(documentItem.open_comment_count) || 0) : "";
				return '<button type="button" role="tab" id="fv2-tab-' + escAttr(tab[0]) + '" aria-controls="fv2-workspace-panel" tabindex="' + (this.state.workspaceTab === tab[0] ? "0" : "-1") + '" class="' + (this.state.workspaceTab === tab[0] ? "is-active" : "") + '" aria-selected="' + (this.state.workspaceTab === tab[0] ? "true" : "false") + '" data-fv2-action="workspace-tab" data-fv2-tab="' + tab[0] + '" data-fv2-focus-key="workspace-' + tab[0] + '">' + esc(tab[1] + count) + "</button>";
		}, this).join("");
		var panel = this.state.workspaceTab === "versions" ? this.versionsMarkup(documentItem) : (this.state.workspaceTab === "comments" ? this.commentsMarkup(documentItem) : (this.state.workspaceTab === "internal-notes" ? this.internalNotesMarkup(documentItem) : this.scoreMarkup(documentItem)));
		return this.pageHeadingMarkup("Binary document workspace", documentItem.name || "Doc Docs", "Review, versions, feedback, and staff workflow for the selected private file.", actions) +
			'<section class="fv2-binary-workspace"><div class="fv2-binary-file">' + icon("file") + '<div><span>Binary document</span><h2>' + esc(documentItem.original_name || documentItem.name || "Private file") + "</h2><p>Download this file to read or edit it in its native application. File Vault does not edit binary documents in the browser.</p></div>" + statusBadge(documentItem.status, documentItem.status_label) + "</div>" +
				'<div class="fv2-workspace-tabs" role="tablist" aria-label="Document workspace">' + tabs + '</div><div class="fv2-workspace-panel" id="fv2-workspace-panel" role="tabpanel" aria-labelledby="fv2-tab-' + escAttr(this.state.workspaceTab) + '">' + panel + "</div></section>";
	};

	FileVaultV2.prototype.rubricForDocument = function (documentItem) {
		var rubrics = this.state.data && this.state.data.rubrics && typeof this.state.data.rubrics === "object" ? this.state.data.rubrics : {};
		var rubric = rubrics[String(documentItem && documentItem.document_type || "other")] || [];
		return Array.isArray(rubric) ? rubric : [];
	};

	FileVaultV2.prototype.scoreMaximum = function (score, rubric) {
		var explicit = positiveInt(score && score.max_score);
		if (explicit) return Math.min(100, explicit);
		var categories = score && score.category_scores && typeof score.category_scores === "object" ? Object.keys(score.category_scores) : [];
		if (categories.length) return Math.min(100, categories.length * 10);
		return Array.isArray(rubric) && rubric.length ? Math.min(100, rubric.length * 10) : 100;
	};

	FileVaultV2.prototype.scoreMarkup = function (documentItem) {
		var rubric = this.rubricForDocument(documentItem);
		var latest = documentItem.latest_score && typeof documentItem.latest_score === "object" ? documentItem.latest_score : null;
		var latestMaximum = this.scoreMaximum(latest, rubric);
		var latestMarkup = latest ? [
				'<section class="fv2-score-summary"><div><span>Latest rubric score</span><strong>' + esc(boundedInt(latest.total_score, 0, latestMaximum)) + '<small>/' + esc(latestMaximum) + '</small></strong></div><div><span>Record status</span><strong>' + esc(latest.readiness_label || "Score recorded") + "</strong><small>v" + esc(Math.max(1, positiveInt(latest.version))) + " / " + esc(formatDate(latest.created_at)) + " / " + esc(latest.scorer_name || "MissionMed staff") + "</small></div></section>"
			].join("") : this.inlineNoticeMarkup("empty", "No score recorded", "A rubric score appears only after authorized staff saves one.");
		if (documentItem.verification_state !== "ready_clean") return this.inlineNoticeMarkup("blocked", "Verified version required", "Upload and verify a V2 version before review or scoring.") + latestMarkup + this.scoreHistoryMarkup(documentItem);
		if (!this.roleIsStaff() || !this.capability("score")) return latestMarkup + this.scoreHistoryMarkup(documentItem);

		var fields = rubric.map(function (label) {
			var key = slugify(label);
			var value = this.state.scoreDraft[key] === undefined ? 0 : boundedInt(this.state.scoreDraft[key], 0, 10);
			return '<label class="fv2-rubric-field"><span>' + esc(label) + '</span><input type="number" min="0" max="10" step="1" inputmode="numeric" value="' + value + '" data-fv2-score-key="' + escAttr(key) + '" aria-label="' + escAttr(label) + ' score out of 10"><small>/10</small></label>';
		}, this).join("");
		var total = this.scoreDraftTotal();
		var maximum = Math.max(10, rubric.length * 10);
		var scoreForm = rubric.length ? '<form class="fv2-score-form" data-fv2-form="score"><div class="fv2-form-heading"><div><span>Staff scoring</span><h2>Document rubric</h2></div><strong><span data-fv2-score-total>' + total + "</span>/" + maximum + "</strong></div><div class=\"fv2-rubric-grid\">" + fields + '</div><label class="fv2-field"><span>Score notes</span><textarea rows="3" maxlength="2000" data-fv2-score-notes placeholder="Optional notes stored with this score">' + esc(this.state.scoreNotes) + '</textarea></label><button type="submit" class="fv2-button fv2-button-primary"' + (this.state.busy.score ? " disabled" : "") + ">" + icon("check") + (this.state.busy.score ? "Saving..." : "Save score") + "</button></form>" : this.inlineNoticeMarkup("empty", "No rubric returned", "Scoring is unavailable until the server returns a rubric for this document type.");
		return latestMarkup + this.reviewStatusMarkup(documentItem) + scoreForm + this.scoreHistoryMarkup(documentItem);
	};

	FileVaultV2.prototype.reviewStatusMarkup = function (documentItem) {
		if (!this.capability("review")) return "";
		var options = this.reviewStatusOptions(documentItem);
		if (!options.length) {
			return this.inlineNoticeMarkup("empty", "No review transition available", "This document has no next status available for your server role.");
		}
		var selected = options.some(function (option) { return option.value === this.state.reviewStatus; }, this)
			? this.state.reviewStatus
			: options[0].value;
		var optionMarkup = options.map(function (option) {
			return '<option value="' + escAttr(option.value) + '"' + (selected === option.value ? " selected" : "") + ">" + esc(option.label) + "</option>";
		}).join("");
		return '<form class="fv2-review-form" data-fv2-form="review-status"><div class="fv2-form-heading"><div><span>Staff decision</span><h2>Review status</h2></div>' + statusBadge(documentItem.status, documentItem.status_label) + '</div><div class="fv2-review-fields"><label class="fv2-field"><span>Next status</span><select data-fv2-review-status>' + optionMarkup + '</select></label><label class="fv2-field fv2-field-grow"><span>Review note</span><textarea rows="3" maxlength="2000" data-fv2-review-note placeholder="Required when changes are needed">' + esc(this.state.reviewNote) + '</textarea></label><button type="submit" class="fv2-button fv2-button-primary"' + (this.state.busy.review ? " disabled" : "") + ">" + icon("check") + (this.state.busy.review ? "Saving..." : "Save status") + "</button></div></form>";
	};

	FileVaultV2.prototype.reviewStatusOptions = function (documentItem) {
		var current = String(documentItem && documentItem.status || "").toLowerCase();
		var transitions;
		if (this.role() === "mentor") {
			transitions = {
				submitted: ["in_review"],
				in_review: ["needs_changes", "reviewed"]
			};
		} else {
			transitions = {
				draft: ["submitted", "in_review"],
				uploaded: ["submitted", "in_review"],
				submitted: ["in_review", "needs_changes", "reviewed", "final"],
				in_review: ["needs_changes", "reviewed", "final"],
				needs_changes: ["submitted", "in_review", "reviewed", "final"],
				reviewed: ["needs_changes", "final"],
				final: []
			};
		}
		return (transitions[current] || []).filter(function (status) {
			return status !== "final" || this.capability("finalize");
		}, this).map(function (status) {
			return { value: status, label: statusInfo(status).label };
		});
	};

	FileVaultV2.prototype.scoreHistoryMarkup = function (documentItem) {
		var scores = Array.isArray(documentItem.scores) ? documentItem.scores.slice().reverse() : [];
		if (!scores.length) return "";
		return '<section class="fv2-history"><div class="fv2-section-heading"><div><span>Recorded entries</span><h2>Score history</h2></div></div>' + scores.map(function (score) {
			var maximum = this.scoreMaximum(score, this.rubricForDocument(documentItem));
			return '<article class="fv2-history-row"><strong>' + esc(boundedInt(score.total_score, 0, maximum)) + '/' + esc(maximum) + '</strong><div><span>' + esc(score.readiness_label || "Recorded") + " / v" + esc(Math.max(1, positiveInt(score.version))) + "</span><small>" + esc(score.scorer_name || "MissionMed staff") + " / " + esc(formatDate(score.created_at, true)) + "</small></div></article>";
		}, this).join("") + "</section>";
	};

	FileVaultV2.prototype.versionsMarkup = function (documentItem) {
		var versions = Array.isArray(documentItem.versions) ? documentItem.versions.slice().reverse() : [];
		if (!versions.length) return this.stateMessageMarkup("empty", "No versions returned", "Version history appears after the server returns immutable file records.", "");
		var canDownload = this.capability("download") && documentItem.download_available !== false && this.storageReady();
		return '<div class="fv2-version-list">' + versions.map(function (version) {
			var number = Math.max(1, positiveInt(version.number));
			var scoreMaximum = Math.max(1, positiveInt(version.score_max) || 100);
			return '<article class="fv2-version-row"><span class="fv2-version-number">v' + number + '</span><div><h2>' + esc(version.original_name || documentItem.name || "Document") + "</h2><p>" + esc([version.uploader_name || "MissionMed user", formatDate(version.uploaded_at, true), formatSize(version.file_size)].join(" / ")) + "</p>" + (version.note ? "<small>" + esc(version.note) + "</small>" : "") + "</div>" + (version.is_final ? statusBadge("final", "Final") : "") + (version.score !== undefined ? '<span class="fv2-version-score">' + esc(boundedInt(version.score, 0, scoreMaximum)) + "/" + esc(scoreMaximum) + "</span>" : "") + (canDownload ? '<button type="button" class="fv2-icon-button" data-fv2-action="download" data-fv2-document-id="' + positiveInt(documentItem.id) + '" data-fv2-version="' + number + '" aria-label="Download version ' + number + '" title="Download version">' + icon("download") + "</button>" : "") + "</article>";
		}).join("") + "</div>";
	};

	FileVaultV2.prototype.resetInternalNotes = function () {
		this.internalNotesRequestToken += 1;
		this.state.internalNotes = [];
		this.state.internalNotesLoading = false;
		this.state.internalNotesError = "";
		this.state.busy.internalNote = false;
	};

	FileVaultV2.prototype.internalNotesContextMatches = function (studentContext, documentId, requestToken) {
		return requestToken === this.internalNotesRequestToken &&
			!this.isStudentLens() &&
			this.roleIsStaff() &&
			this.capability("internal_notes") &&
			this.studentContextMatches(studentContext) &&
			positiveInt(this.state.selectedDocumentId) === positiveInt(documentId);
	};

	FileVaultV2.prototype.commentsMarkup = function (documentItem) {
		var comments = Array.isArray(documentItem.comments) ? documentItem.comments.slice().reverse() : [];
		var list = comments.length ? '<div class="fv2-comment-list">' + comments.map(function (comment) {
			var canResolve = this.roleIsStaff() && this.capability("review") && !comment.resolved;
			return '<article class="fv2-comment' + (comment.resolved ? " is-resolved" : "") + '"><div class="fv2-comment-meta"><strong>' + esc(comment.author_name || "MissionMed user") + "</strong><span>" + esc(comment.author_role || "user") + " / v" + esc(Math.max(1, positiveInt(comment.version))) + " / " + esc(formatDate(comment.created_at, true)) + "</span></div><p>" + esc(comment.body || "").replace(/\n/g, "<br>") + "</p><div>" + (comment.resolved ? '<span class="fv2-resolved">' + icon("check") + "Resolved</span>" : (canResolve ? '<button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="resolve-comment" data-fv2-comment-id="' + escAttr(comment.id || "") + '" data-fv2-document-id="' + positiveInt(documentItem.id) + '">Resolve</button>' : '<span class="fv2-open-comment">Open</span>')) + "</div></article>";
		}, this).join("") + "</div>" : this.inlineNoticeMarkup("empty", "No comments yet", "Comments are stored on the selected document and version.");
		var form = this.capability("comment") ? '<form class="fv2-comment-form" data-fv2-form="comment"><label class="fv2-field"><span>Add comment</span><textarea rows="4" maxlength="2000" required data-fv2-comment-body placeholder="Write a document comment"></textarea></label><div><small>1 to 2,000 characters</small><button type="submit" class="fv2-button fv2-button-primary"' + (this.state.busy.comment ? " disabled" : "") + ">" + icon("comment") + (this.state.busy.comment ? "Posting..." : "Post comment") + "</button></div></form>" : "";
		return form + list;
	};

	FileVaultV2.prototype.internalNotesMarkup = function () {
		if (!this.roleIsStaff() || !this.capability("internal_notes")) return this.inlineNoticeMarkup("blocked", "Internal notes unavailable", "This staff-only channel is not available for the current server role.");
		if (this.state.internalNotesLoading) return this.loadingMarkup();
		if (this.state.internalNotesError) return this.stateMessageMarkup("error", "Internal notes unavailable", this.state.internalNotesError, '<button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="retry-internal-notes">' + icon("refresh") + "Retry</button>");
		var notes = Array.isArray(this.state.internalNotes) ? this.state.internalNotes.slice().reverse() : [];
		var list = notes.length ? '<div class="fv2-comment-list fv2-internal-note-list">' + notes.map(function (note) {
			return '<article class="fv2-comment fv2-internal-note"><div class="fv2-comment-meta"><strong>' + esc(note.author_name || "MissionMed staff") + '</strong><span>Internal staff note / ' + esc(formatDate(note.created_at, true)) + '</span></div><p>' + esc(note.body || "").replace(/\n/g, "<br>") + '</p></article>';
		}).join("") + "</div>" : this.inlineNoticeMarkup("empty", "No internal notes", "Only authorized staff can read or add notes in this channel.");
		var form = '<form class="fv2-comment-form fv2-internal-note-form" data-fv2-form="internal-note"><label class="fv2-field"><span>Add internal staff note</span><textarea rows="4" maxlength="2000" required data-fv2-internal-note-body placeholder="Visible only to authorized MissionMed staff"></textarea></label><div><small>Never included in student bootstrap or document responses.</small><button type="submit" class="fv2-button fv2-button-primary"' + (this.state.busy.internalNote ? " disabled" : "") + '>' + icon("lock") + (this.state.busy.internalNote ? "Saving..." : "Save internal note") + "</button></div></form>";
		return form + list;
	};

	FileVaultV2.prototype.scoreDraftTotal = function () {
		var scoreDraft = this.state.scoreDraft;
		return Object.keys(scoreDraft).reduce(function (sum, key) {
			return sum + boundedInt(scoreDraft[key], 0, 10);
		}, 0);
	};

	FileVaultV2.prototype.handleClick = function (event) {
		var button = event.target.closest("[data-fv2-action]");
		if (!button || !this.root.contains(button) || button.disabled) return;
		var action = button.getAttribute("data-fv2-action");
		var documentId = positiveInt(button.getAttribute("data-fv2-document-id"));
		var studentId = positiveInt(button.getAttribute("data-fv2-student-id"));
		var shareId = positiveInt(button.getAttribute("data-fv2-share-id"));
		switch (action) {
			case "skip-intro":
				this.dismissIntro();
				break;
			case "set-lens":
				if (this.role() !== "admin") break;
				var requestedLens = button.getAttribute("data-fv2-lens-mode") === "student" ? "student" : "administrator";
				if (requestedLens === this.state.lensMode) {
					this.state.mobileNavOpen = false;
					this.render({ focusKey: "" });
					this.focusLensContext();
					break;
				}
				this.state.lensMode = requestedLens;
				this.state.mobileNavOpen = false;
				if (this.state.lensMode === "student") {
					if (this.state.workspaceTab === "internal-notes") this.state.workspaceTab = "comments";
					this.resetInternalNotes();
					var availableStudents = this.state.staffData && Array.isArray(this.state.staffData.students) ? this.state.staffData.students : [];
					var lensStudentId = positiveInt(this.state.selectedStudentId) || positiveInt(this.state.lastStudentId) || positiveInt(availableStudents[0] && availableStudents[0].id);
					if (lensStudentId && positiveInt(this.state.selectedStudentId) !== lensStudentId) {
						this.loadStudent(lensStudentId, { view: "vault" }).then(function () {
							if (this.destroyed || this.state.lensMode !== "student") return;
							this.focusLensContext();
							this.toast("Student view", "You are viewing the selected student's real File Vault experience. Staff-only controls remain hidden.", "success");
						}.bind(this));
						break;
					}
					this.state.view = lensStudentId ? "vault" : "command";
					this.render({ focusKey: "" });
					this.focusLensContext();
					this.toast("Student view", lensStudentId ? "Staff-only controls are hidden while you preview this student's File Vault." : "Choose a student before opening the student preview.", lensStudentId ? "success" : "error");
					break;
				}
				this.state.lastStudentId = positiveInt(this.state.selectedStudentId) || positiveInt(this.state.lastStudentId);
				this.exitStudentVault();
				this.focusLensContext();
				this.toast("Administrator view", "The staff directory and student File Vault tools are available again.", "success");
				break;
			case "navigate":
				this.state.mobileNavOpen = false;
				this.navigate(button.getAttribute("data-fv2-view"));
				break;
			case "open-settings":
				this.state.mobileNavOpen = false;
				this.openOverlay("settings");
				break;
			case "toggle-mobile-nav":
				this.state.mobileNavOpen = !this.state.mobileNavOpen;
				this.render({ focusKey: "" });
				break;
			case "close-overlay":
				this.closeOverlay();
				break;
			case "choose-upload-file":
				var uploadInput = this.refs.overlay && this.refs.overlay.querySelector("[data-fv2-upload-file]");
				if (uploadInput) uploadInput.click();
				break;
			case "remove-upload-file":
				if (this.state.upload) {
					this.state.upload.file = null;
					this.state.upload.fileError = "";
					this.state.upload.sha256 = "";
					this.renderOverlay();
				}
				break;
			case "retry-bootstrap":
				this.reload({ preserveView: true });
				break;
			case "fallback-v1":
				this.beginV1Fallback();
				break;
			case "select-document":
				this.selectDocument(documentId, button);
				break;
			case "quicklook-document":
				this.openDocumentPreview(documentId, button);
				break;
			case "quicklook-share":
				this.openSharePreview(shareId, button);
				break;
			case "download-share":
				this.downloadShare(shareId, button);
				break;
			case "share-recipients":
				this.openRecipientStatus(shareId, button);
				break;
			case "share-status":
				this.updateShareStatus(shareId, button.getAttribute("data-fv2-share-status") || "disabled", button);
				break;
			case "retry-shares":
				this.loadShares(button.getAttribute("data-fv2-share-source") || "missionmed", true);
				break;
			case "load-more-shares":
				this.loadShares(button.getAttribute("data-fv2-share-source") || "missionmed", false, true);
				break;
			case "load-more-audiences":
				this.loadAudiences({ append: true });
				break;
			case "load-more-recipients":
				this.loadRecipientPage(shareId || positiveInt(this.state.preview && this.state.preview.item && this.state.preview.item.id), true);
				break;
			case "close-detail":
				if (this.state.overlay === "detail") this.closeOverlay();
				else {
					this.state.selectedDocumentId = 0;
					this.state.documentDetail = null;
					this.render({ focusKey: "" });
				}
				break;
			case "open-upload":
				this.openUpload({
					documentType: button.getAttribute("data-fv2-document-type") || "",
					displayName: button.getAttribute("data-fv2-display-name") || "",
					shareSource: this.role() === "admin" && !this.state.selectedStudentId ? "missionmed" : ""
				});
				break;
			case "open-share-upload":
				this.openUpload({ shareSource: button.getAttribute("data-fv2-share-source") || (this.role() === "admin" ? "missionmed" : "student_shared") });
				break;
			case "launch-home-upload":
				var homeCategory = this.uploadCategories().find(function (category) { return category[0] === this.state.homeUploadType; }, this);
				if (homeCategory) this.openUpload({ documentType: homeCategory[0], displayName: homeCategory[1] === "Miscellaneous" ? "" : homeCategory[1] });
				break;
			case "open-version":
				this.openUpload({ documentId: documentId });
				break;
			case "next-action":
				this.performNextAction();
				break;
			case "open-journey-document":
				this.state.view = "files";
				this.selectDocument(documentId, button);
				break;
			case "open-from-home":
				this.state.view = "files";
				this.selectDocument(documentId, null);
				break;
			case "open-file-group":
				this.state.fileType = button.getAttribute("data-fv2-file-group") || "";
				this.navigate("files");
				break;
			case "file-layout":
				this.state.fileLayout = button.getAttribute("data-fv2-layout") === "grid" ? "grid" : "list";
				this.render({ focusKey: button.getAttribute("data-fv2-focus-key") || "" });
				break;
			case "open-workspace":
				this.openWorkspace(documentId);
				break;
			case "back-vault":
				this.navigate("files");
				break;
			case "workspace-tab":
				this.state.workspaceTab = button.getAttribute("data-fv2-tab") || "score";
				this.render({ focusKey: button.getAttribute("data-fv2-focus-key") || "" });
				if (this.state.workspaceTab === "internal-notes") this.loadInternalNotes(this.state.selectedDocumentId);
				break;
			case "retry-internal-notes":
				this.loadInternalNotes(this.state.selectedDocumentId);
				break;
			case "download":
				this.downloadDocument(documentId, positiveInt(button.getAttribute("data-fv2-version")), button);
				break;
			case "submit-document":
				this.submitDocument(documentId);
				break;
			case "resolve-comment":
				this.resolveComment(documentId, button.getAttribute("data-fv2-comment-id") || "");
				break;
			case "load-student":
				this.loadStudent(studentId, { view: "vault" });
				break;
			case "exit-student":
				this.exitStudentVault();
				break;
			case "open-queue-document":
				this.loadStudent(studentId, { view: "docdocs", documentId: documentId });
				break;
			case "load-more-staff":
				this.loadMoreStaff();
				break;
			case "retry-audit":
				this.loadAudit(1, false);
				break;
			case "load-more-audit":
				this.loadAudit(positiveInt(this.state.auditPagination && this.state.auditPagination.next_page) || 1, true);
				break;
			case "retry-document":
				this.openWorkspace(this.state.selectedDocumentId);
				break;
			case "setting-reduced":
				if (!(this.motionQuery && this.motionQuery.matches)) {
					this.preferences.reducedMotion = !this.preferences.reducedMotion;
					this.saveAndApplyPreferences();
					this.renderOverlay();
				}
				break;
			case "setting-sound":
				this.preferences.sound = !this.preferences.sound;
				this.saveAndApplyPreferences();
				this.renderOverlay();
				break;
			case "setting-density":
				this.preferences.density = button.getAttribute("data-fv2-density") === "compact" ? "compact" : "comfortable";
				this.saveAndApplyPreferences();
				this.renderOverlay();
				break;
			case "reset-settings":
				this.preferences = defaultPreferences();
				this.saveAndApplyPreferences();
				this.renderOverlay();
				this.toast("Preferences reset", "File Vault settings returned to defaults.", "success");
				break;
			case "upload-back":
				if (this.state.upload) {
					this.state.upload.step = Math.max(1, this.state.upload.step - 1);
					this.renderOverlay();
				}
				break;
			case "upload-next":
				this.advanceUpload();
				break;
			case "upload-start":
				this.startUpload("sign");
				break;
			case "upload-abort":
				this.abortUpload(false);
				break;
			case "upload-retry":
				this.startUpload(this.state.upload && this.state.upload.retryStage || "sign");
				break;
			case "upload-restart":
				if (this.state.upload) {
					this.state.upload.step = 2;
					this.state.upload.phase = "idle";
					this.state.upload.intent = null;
					this.state.upload.error = "";
					this.state.upload.progress = 0;
					this.renderOverlay();
				}
				break;
			case "upload-done":
				this.closeOverlay({ keepUpload: false });
				if (this.state.selectedDocumentId) this.selectDocument(this.state.selectedDocumentId, null);
				break;
			case "upload-open-files":
				this.closeOverlay({ keepUpload: false });
				this.navigate("files");
				break;
			case "upload-open-shares":
				var completedShareSource = this.state.upload && this.state.upload.shareSource || "missionmed";
				this.closeOverlay({ keepUpload: false });
				this.navigate(completedShareSource === "student_shared" ? "shared" : "library");
				break;
			case "upload-view-document":
				this.closeOverlay({ keepUpload: false });
				this.state.view = "files";
				this.selectDocument(documentId || this.state.selectedDocumentId, null);
				break;
			case "upload-another":
				var previousUploadType = this.state.upload && this.state.upload.documentType || "";
				var previousShareSource = this.state.upload && this.state.upload.shareSource || "";
				this.closeOverlay({ keepUpload: false });
				this.openUpload({ documentType: previousUploadType, shareSource: previousShareSource });
				break;
		}
	};

	FileVaultV2.prototype.handleChange = function (event) {
		var target = event.target;
		if (target.matches("[data-fv2-home-upload-type]")) {
			this.state.homeUploadType = target.value;
			this.render({ focusKey: "home-upload-type" });
			var selector = this.refs.stage && this.refs.stage.querySelector("[data-fv2-home-upload-type]");
			if (selector) {
				selector.setAttribute("data-fv2-focus-key", "home-upload-type");
				selector.focus({ preventScroll: true });
			}
			return;
		}
		if (target.matches("[data-fv2-student-picker]")) {
			var studentId = positiveInt(target.value);
			if (studentId) this.loadStudent(studentId, { view: "vault" });
			return;
		}
		if (target.matches("[data-fv2-file-type]")) {
			this.state.fileType = target.value;
			this.render({ focusKey: "file-type" });
			return;
		}
		if (target.matches("[data-fv2-file-status]")) {
			this.state.fileStatus = target.value;
			this.render({ focusKey: "file-status" });
			return;
		}
		if (target.matches("[data-fv2-file-sort]")) {
			this.state.fileSort = target.value;
			this.render({ focusKey: "file-sort" });
			return;
		}
		if (target.matches("[data-fv2-upload-file]")) {
			var file = target.files && target.files[0] ? target.files[0] : null;
			if (this.state.upload) {
				this.state.upload.file = file;
				this.state.upload.fileError = this.validateFile(file, this.state.upload.documentType);
				this.state.upload.sha256 = "";
				if (file && !this.state.upload.displayName && !this.state.upload.documentId && this.documentNameRequiresInput(this.state.upload.documentType)) {
					this.state.upload.displayName = file.name.replace(/\.[^.]+$/, "");
				}
				this.renderOverlay();
			}
			return;
		}
		if (target.matches("[data-fv2-upload-name]") && this.state.upload) {
			this.state.upload.displayName = target.value.trim();
			if (!this.state.upload.replacementChoiceTouched) this.syncUploadLineage();
			var replacementSelect = this.refs.overlay && this.refs.overlay.querySelector("[data-fv2-upload-replaces]");
			if (replacementSelect) replacementSelect.value = this.state.upload.replacesDocumentId ? String(this.state.upload.replacesDocumentId) : "";
			var versionDisplay = this.refs.overlay && this.refs.overlay.querySelector("[data-fv2-upload-version] strong");
			if (versionDisplay) versionDisplay.textContent = "Version " + String(Math.max(1, positiveInt(this.state.upload.version)));
			var changedNamePreview = this.refs.overlay && this.refs.overlay.querySelector("[data-fv2-canonical-preview]");
			if (changedNamePreview) changedNamePreview.textContent = this.canonicalFilenamePreview();
			this.updateUploadNextButton();
			return;
		}
		if (target.matches("[data-fv2-upload-type]") && this.state.upload) {
			this.state.upload.documentType = target.value || "other";
			this.state.upload.displayName = this.canonicalDocumentName(this.state.upload.documentType);
			this.state.upload.documentId = 0;
			this.state.upload.replacesDocumentId = 0;
			this.state.upload.version = 1;
			this.state.upload.draftLabel = "Version01";
			this.state.upload.isFinal = false;
			this.state.upload.replacementChoiceTouched = false;
			this.syncUploadLineage();
			this.state.upload.fileError = this.validateFile(this.state.upload.file, this.state.upload.documentType);
			this.renderOverlay({ focusKey: "upload-type" });
			return;
		}
		if (target.matches("[data-fv2-upload-program]") && this.state.upload) {
			this.state.upload.program = target.value;
			this.updateUploadNextButton();
			var programPreview = this.refs.overlay && this.refs.overlay.querySelector("[data-fv2-canonical-preview]");
			if (programPreview) programPreview.textContent = this.canonicalFilenamePreview();
			return;
		}
		if (target.matches("[data-fv2-upload-replaces]") && this.state.upload) {
			var replacement = this.getDocument(positiveInt(target.value));
			this.state.upload.replacementChoiceTouched = true;
			this.applyUploadReplacement(replacement);
			this.renderOverlay({ focusKey: "upload-replaces" });
			return;
		}
		if (target.matches("[data-fv2-upload-ready]") && this.state.upload) {
			this.state.upload.readyForReview = target.checked;
			return;
		}
		if (target.matches("[data-fv2-upload-final]") && this.state.upload) {
			this.state.upload.isFinal = !!target.checked;
			return;
		}
		if (target.matches("[data-fv2-upload-mission-file]") && this.state.upload) {
			this.state.upload.shareAsMissionFile = target.checked;
			return;
		}
		if (target.matches("[data-fv2-share-audience]") && this.state.upload) {
			this.state.upload.audienceMode = target.value;
			this.renderOverlay({ focusKey: "share-audience" });
			return;
		}
		if (target.matches("[data-fv2-share-group]") && this.state.upload) {
			var groupId = positiveInt(target.value);
			this.state.upload.groupIds = this.toggleNumericSelection(this.state.upload.groupIds, groupId, target.checked);
			this.updateShareAudienceControls();
			return;
		}
		if (target.matches("[data-fv2-share-student]") && this.state.upload) {
			var recipientId = positiveInt(target.value);
			this.state.upload.userIds = this.toggleNumericSelection(this.state.upload.userIds, recipientId, target.checked);
			this.updateShareAudienceControls();
			return;
		}
		if (target.matches("[data-fv2-upload-session]") && this.state.upload) {
			this.state.upload.sessionLetter = String(target.value || "").toUpperCase();
			this.updateUploadNextButton();
			var sessionPreview = this.refs.overlay && this.refs.overlay.querySelector("[data-fv2-canonical-preview]");
			if (sessionPreview) sessionPreview.textContent = this.canonicalFilenamePreview();
			return;
		}
		if (target.matches("[data-fv2-review-status]")) {
			this.state.reviewStatus = target.value;
			return;
		}
	};

	FileVaultV2.prototype.handleInput = function (event) {
		var target = event.target;
		if (target.matches("[data-fv2-header-search]")) {
			this.state.fileSearch = target.value;
			this.state.view = "files";
			this.render({ focusKey: "header-search" });
			if (this.refs.headerSearch) {
				this.refs.headerSearch.setAttribute("data-fv2-focus-key", "header-search");
				this.refs.headerSearch.focus({ preventScroll: true });
			}
			return;
		}
		if (target.matches("[data-fv2-file-search]")) {
			var self = this;
			this.state.fileSearch = target.value;
			if (this.fileSearchTimer) {
				window.clearTimeout(this.fileSearchTimer);
				this.timers.delete(this.fileSearchTimer);
			}
			this.fileSearchTimer = window.setTimeout(function () {
				self.timers.delete(self.fileSearchTimer);
				self.fileSearchTimer = 0;
				if (!self.destroyed) self.render({ focusKey: "file-search" });
			}, 500);
			this.timers.add(this.fileSearchTimer);
			return;
		}
		if (target.matches("[data-fv2-command-search]")) {
			var staffSelf = this;
			this.state.commandSearch = target.value;
			if (this.staffSearchTimer) {
				window.clearTimeout(this.staffSearchTimer);
				this.timers.delete(this.staffSearchTimer);
			}
			if (!this.state.commandSearch.trim()) {
				this.loadStaffSearch("");
				return;
			}
			this.state.staffSearchLoading = true;
			this.state.staffSearchError = "";
			this.render({ focusKey: "command-search" });
			this.staffSearchTimer = window.setTimeout(function () {
				staffSelf.timers.delete(staffSelf.staffSearchTimer);
				staffSelf.staffSearchTimer = 0;
				staffSelf.loadStaffSearch(staffSelf.state.commandSearch);
			}, 250);
			this.timers.add(this.staffSearchTimer);
			return;
		}
		if (target.matches("[data-fv2-audit-search]")) {
			this.state.auditSearch = target.value;
			this.render({ focusKey: "audit-search" });
			return;
		}
		if (target.matches("[data-fv2-audience-search]")) {
			var audienceSelf = this;
			this.state.audienceSearch = target.value;
			if (this.audienceSearchTimer) {
				window.clearTimeout(this.audienceSearchTimer);
				this.timers.delete(this.audienceSearchTimer);
			}
			this.audienceSearchTimer = window.setTimeout(function () {
				audienceSelf.timers.delete(audienceSelf.audienceSearchTimer);
				audienceSelf.audienceSearchTimer = 0;
				if (!audienceSelf.destroyed && audienceSelf.state.overlay === "upload" && audienceSelf.state.upload) audienceSelf.loadAudiences({ append: false });
			}, 250);
			this.timers.add(this.audienceSearchTimer);
			return;
		}
		if (target.matches("[data-fv2-upload-name]") && this.state.upload) {
			this.state.upload.displayName = target.value;
			if (!this.state.upload.replacementChoiceTouched) this.syncUploadLineage();
			var replacementSelect = this.refs.overlay && this.refs.overlay.querySelector("[data-fv2-upload-replaces]");
			if (replacementSelect) replacementSelect.value = this.state.upload.replacesDocumentId ? String(this.state.upload.replacesDocumentId) : "";
			var versionDisplay = this.refs.overlay && this.refs.overlay.querySelector("[data-fv2-upload-version] strong");
			if (versionDisplay) versionDisplay.textContent = "Version " + String(Math.max(1, positiveInt(this.state.upload.version)));
			this.updateUploadNextButton();
			var namePreview = this.refs.overlay && this.refs.overlay.querySelector("[data-fv2-canonical-preview]");
			if (namePreview) namePreview.textContent = this.canonicalFilenamePreview();
			return;
		}
		if (target.matches("[data-fv2-upload-note]") && this.state.upload) {
			this.state.upload.note = target.value;
			return;
		}
		if (target.matches("[data-fv2-upload-session]") && this.state.upload) {
			this.state.upload.sessionLetter = String(target.value || "").replace(/[^a-z]/ig, "").slice(0, 1).toUpperCase();
			target.value = this.state.upload.sessionLetter;
			this.updateUploadNextButton();
			var preview = this.refs.overlay && this.refs.overlay.querySelector("[data-fv2-canonical-preview]");
			if (preview) preview.textContent = this.canonicalFilenamePreview();
			return;
		}
		if (target.matches("[data-fv2-score-key]")) {
			this.state.scoreDraft[target.getAttribute("data-fv2-score-key")] = boundedInt(target.value, 0, 10);
			target.value = this.state.scoreDraft[target.getAttribute("data-fv2-score-key")];
			var total = this.root.querySelector("[data-fv2-score-total]");
			if (total) total.textContent = this.scoreDraftTotal();
			return;
		}
		if (target.matches("[data-fv2-score-notes]")) {
			this.state.scoreNotes = target.value;
			return;
		}
		if (target.matches("[data-fv2-review-note]")) {
			this.state.reviewNote = target.value;
			return;
		}
		if (target.matches("[data-fv2-volume]")) {
			this.preferences.volume = Math.min(1, Math.max(0, Number(target.value) || 0));
			this.saveAndApplyPreferences();
		}
	};

	FileVaultV2.prototype.handleSubmit = function (event) {
		var form = event.target.closest("[data-fv2-form]");
		if (!form) return;
		event.preventDefault();
		var kind = form.getAttribute("data-fv2-form");
		if (kind === "comment") this.addComment(form);
		else if (kind === "internal-note") this.addInternalNote(form);
		else if (kind === "score") this.saveScore();
		else if (kind === "review-status") this.saveReviewStatus();
	};

	FileVaultV2.prototype.handleDragOver = function (event) {
		var dropzone = event.target.closest("[data-fv2-dropzone]");
		if (!dropzone || !this.storageReady() || !this.capability("upload")) return;
		event.preventDefault();
		dropzone.classList.add("is-dragging");
	};

	FileVaultV2.prototype.handleDragLeave = function (event) {
		var dropzone = event.target.closest("[data-fv2-dropzone]");
		if (dropzone && !dropzone.contains(event.relatedTarget)) dropzone.classList.remove("is-dragging");
	};

	FileVaultV2.prototype.handleDrop = function (event) {
		var dropzone = event.target.closest("[data-fv2-dropzone]");
		if (!dropzone || !this.storageReady() || !this.capability("upload")) return;
		event.preventDefault();
		dropzone.classList.remove("is-dragging");
		var file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
		if (!file) return;
		if (this.state.overlay === "upload" && this.state.upload && this.refs.overlay && this.refs.overlay.contains(dropzone)) {
			this.state.upload.file = file;
			this.state.upload.fileError = this.validateFile(file, this.state.upload.documentType);
			this.state.upload.sha256 = "";
			if (!this.state.upload.displayName && !this.state.upload.documentId && this.documentNameRequiresInput(this.state.upload.documentType)) this.state.upload.displayName = file.name.replace(/\.[^.]+$/, "");
			this.renderOverlay();
			return;
		}
		this.openUpload({ file: file });
	};

	FileVaultV2.prototype.handleKeydown = function (event) {
		if (this.destroyed) return;
		if (this.introVisible && event.key === "Escape") {
			event.preventDefault();
			this.dismissIntro();
			return;
		}
		if (this.state.overlay) {
			if (event.key === "Escape") {
				event.preventDefault();
				this.closeOverlay();
				return;
			}
			if (event.key === "Tab") this.trapFocus(event);
			return;
		}
		if (this.state.mobileNavOpen && event.key === "Escape") {
			event.preventDefault();
			this.state.mobileNavOpen = false;
			this.render({ focusKey: "nav-more" });
			return;
		}
		var activeTab = event.target && event.target.closest ? event.target.closest('[role="tab"]') : null;
		if (activeTab && ["ArrowLeft", "ArrowRight", "Home", "End"].indexOf(event.key) !== -1) {
			var tabs = Array.prototype.slice.call(activeTab.closest('[role="tablist"]').querySelectorAll('[role="tab"]'));
			var currentIndex = tabs.indexOf(activeTab);
			var nextIndex = event.key === "Home" ? 0 : (event.key === "End" ? tabs.length - 1 : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length);
			event.preventDefault();
			tabs[nextIndex].focus();
			tabs[nextIndex].click();
			return;
		}
		if (isTypingTarget(event.target) || event.altKey || event.ctrlKey || event.metaKey) return;
	};

	FileVaultV2.prototype.handleViewportChange = function () {
		if (this.destroyed) return;
		if (!this.mobileQuery.matches && this.state.overlay === "detail") {
			this.closeOverlay({ restoreFocus: false });
			this.render();
			return;
		}
		if (this.mobileQuery.matches && ["files", "recent"].indexOf(this.state.view) !== -1 && this.state.selectedDocumentId && !this.state.overlay) {
			this.render();
			this.openOverlay("detail", { preserveReturnFocus: true });
			return;
		}
		this.render();
	};

	FileVaultV2.prototype.navigate = function (view) {
		var allowed = this.roleIsStaff() ? STAFF_VIEWS : STUDENT_VIEWS;
		if (allowed.indexOf(view) === -1) return;
		if (this.state.overlay) this.closeOverlay({ restoreFocus: false });
		this.state.view = view;
		this.state.documentError = "";
		this.render({ focusKey: "" });
		this.focusViewHeading();
		if (view === "audit" && this.state.audit === null && !this.state.auditLoading) this.loadAudit();
		if (view === "audit" && this.state.downloads === null && !this.state.downloadsLoading) this.loadDownloads();
		if (view === "library") this.loadShares("missionmed");
		if (view === "shared") this.loadShares("student_shared");
	};

	FileVaultV2.prototype.toggleNumericSelection = function (values, id, selected) {
		var list = Array.isArray(values) ? values.map(positiveInt).filter(Boolean) : [];
		list = list.filter(function (value) { return value !== id; });
		if (selected && id) list.push(id);
		return list;
	};

	FileVaultV2.prototype.loadShares = function (sourceClass, force, append) {
		var self = this;
		sourceClass = sourceClass === "student_shared" ? "student_shared" : "missionmed";
		append = !!append;
		var pagination = this.state.sharePagination[sourceClass] || {};
		if (this.state.sharesLoading[sourceClass] || (!force && !append && this.state.sharePagination[sourceClass]) || (append && !pagination.has_more)) return Promise.resolve();
		var page = append && pagination.next_page ? positiveInt(pagination.next_page) : 1;
		this.state.sharesLoading[sourceClass] = true;
		this.state.sharesError[sourceClass] = "";
		this.render();
		return this.request("GET", "/shares", null, { source_class: sourceClass, page: page, per_page: 50 }).then(function (payload) {
			if (self.destroyed || !payload || !Array.isArray(payload.items)) throw new Error("File Vault returned malformed shared-file data.");
			var items = append ? (self.state.shares[sourceClass] || []).concat(payload.items) : payload.items;
			var seen = {};
			self.state.shares[sourceClass] = items.filter(function (share) { var id = positiveInt(share && share.id); if (!id || seen[id]) return false; seen[id] = true; return true; });
			self.state.sharePagination[sourceClass] = payload.pagination || { has_more: false };
		}).catch(function (error) {
			if (error && error.name === "AbortError") return;
			self.state.sharesError[sourceClass] = errorMessage(error, "Shared files could not be loaded.");
		}).finally(function () {
			self.state.sharesLoading[sourceClass] = false;
			if (!self.destroyed) self.render();
		});
	};

	FileVaultV2.prototype.loadAudiences = function (options) {
		var self = this;
		options = options || {};
		if (this.state.audiencesLoading) return Promise.resolve();
		var append = !!options.append;
		var current = this.state.audiences || {};
		var page = append && current.pagination && current.pagination.next_page ? positiveInt(current.pagination.next_page) : 1;
		this.state.audiencesLoading = true;
		this.state.audiencesError = "";
		this.renderOverlay();
		return this.request("GET", "/audiences", null, { search: this.state.audienceSearch.trim(), page: page, per_page: 50 }).then(function (payload) {
			if (!payload || !Array.isArray(payload.groups) || !Array.isArray(payload.students)) throw new Error("File Vault returned malformed audience data.");
			var students = append ? (current.students || []).concat(payload.students) : payload.students;
			var unique = {};
			students = students.filter(function (student) { var id = positiveInt(student.id); if (!id || unique[id]) return false; unique[id] = true; return true; });
			self.state.audiences = { groups: payload.groups, students: students, policy: payload.policy || {}, pagination: payload.pagination || { has_more: false } };
		}).catch(function (error) {
			if (error && error.name === "AbortError") return;
			self.state.audiencesError = errorMessage(error, "Sharing audiences could not be loaded.");
		}).finally(function () {
			self.state.audiencesLoading = false;
			if (!self.destroyed && self.state.overlay === "upload") self.renderOverlay();
		});
	};

	FileVaultV2.prototype.loadDownloads = function () {
		var self = this;
		if (!this.roleIsStaff() || this.state.downloadsLoading) return Promise.resolve();
		this.state.downloadsLoading = true;
		this.state.downloadsError = "";
		return this.request("GET", "/downloads", null, { page: 1, per_page: 50 }).then(function (payload) {
			if (!payload || !Array.isArray(payload.items)) throw new Error("File Vault returned malformed download activity.");
			self.state.downloads = payload.items;
		}).catch(function (error) {
			if (error && error.name === "AbortError") return;
			self.state.downloadsError = errorMessage(error, "Download activity could not be loaded.");
		}).finally(function () {
			self.state.downloadsLoading = false;
			if (!self.destroyed && self.state.view === "audit") self.render();
		});
	};

	FileVaultV2.prototype.performNextAction = function () {
		var action = this.state.data && this.state.data.next_action;
		if (!action) return;
		if (action.kind === "open_document") {
			this.state.view = "files";
			this.selectDocument(positiveInt(action.document_id), null);
		}
		else if (action.kind === "upload") this.openUpload({ documentType: action.document_type, displayName: String(action.title || "").replace(/^Add\s+/i, "") });
		else if (action.kind === "submit") {
			this.state.view = "files";
			this.state.selectedDocumentId = positiveInt(action.document_id);
			this.render({ focusKey: "submit-" + this.state.selectedDocumentId });
			if (this.mobileQuery.matches) this.openOverlay("detail");
		} else if (action.kind === "journey") this.navigate("journey");
	};

	FileVaultV2.prototype.selectDocument = function (documentId, source) {
		if (!this.getDocument(documentId)) return;
		this.state.selectedDocumentId = documentId;
		this.state.documentDetail = null;
		var focusKey = source && source.getAttribute ? source.getAttribute("data-fv2-focus-key") : "document-" + documentId;
		this.render({ focusKey: focusKey });
		if (this.mobileQuery.matches) this.openOverlay("detail", { preserveReturnFocus: true });
	};

	FileVaultV2.prototype.openDocumentPreview = function (documentId, source) {
		var self = this;
		var item = this.getDocument(documentId);
		if (!item) return;
		this.state.selectedDocumentId = documentId;
		this.state.preview = { kind: "document", item: item, payload: null };
		this.state.previewLoading = true;
		this.state.previewError = "";
		this.openOverlay("quicklook", { preserveReturnFocus: true });
		this.request("GET", "/files/" + documentId + "/preview").then(function (payload) {
			if (!self.state.preview || self.state.preview.kind !== "document" || positiveInt(self.state.preview.item.id) !== documentId) return;
			self.state.preview.payload = payload || {};
		}).catch(function (error) {
			self.state.previewError = errorMessage(error, "Preview could not be loaded.");
		}).finally(function () {
			self.state.previewLoading = false;
			if (self.state.overlay === "quicklook") self.renderOverlay();
		});
	};

	FileVaultV2.prototype.openSharePreview = function (shareId, source) {
		var self = this;
		var item = [this.state.shares.missionmed, this.state.shares.student_shared].reduce(function (all, list) { return all.concat(list || []); }, []).find(function (share) { return positiveInt(share.id) === shareId; });
		if (!item) return;
		this.state.preview = { kind: "share", item: item, payload: null };
		this.state.previewLoading = true;
		this.state.previewError = "";
		this.openOverlay("quicklook", { preserveReturnFocus: true });
		this.request("GET", "/shares/" + shareId + "/preview").then(function (payload) {
			if (!self.state.preview || self.state.preview.kind !== "share" || positiveInt(self.state.preview.item.id) !== shareId) return;
			self.state.preview.payload = payload || {};
		}).catch(function (error) {
			self.state.previewError = errorMessage(error, "Preview could not be loaded.");
		}).finally(function () {
			self.state.previewLoading = false;
			if (self.state.overlay === "quicklook") self.renderOverlay();
		});
	};

	FileVaultV2.prototype.exitStudentVault = function () {
		if (!this.roleIsStaff() || !this.state.staffData) return;
		if (this.studentRequestController && typeof this.studentRequestController.abort === "function") this.studentRequestController.abort();
		this.studentRequestToken += 1;
		this.studentRequestController = null;
		this.state.data = this.state.staffData;
		this.state.selectedStudentId = 0;
		this.state.selectedDocumentId = 0;
		this.state.documentDetail = null;
		this.state.documentError = "";
		this.state.studentLoading = false;
		this.resetInternalNotes();
		this.state.busy = {};
		this.state.view = "command";
		this.render({ focusKey: "" });
		this.focusViewHeading();
	};

	FileVaultV2.prototype.captureStudentContext = function () {
		return {
			token: this.studentRequestToken,
			studentId: this.roleIsStaff() ? positiveInt(this.state.selectedStudentId) : 0
		};
	};

	FileVaultV2.prototype.studentContextMatches = function (context) {
		if (this.destroyed || !context || context.token !== this.studentRequestToken) return false;
		var currentStudentId = this.roleIsStaff() ? positiveInt(this.state.selectedStudentId) : 0;
		if (currentStudentId !== positiveInt(context.studentId)) return false;
		if (this.roleIsStaff() && currentStudentId) {
			return positiveInt(this.state.data && this.state.data.student && this.state.data.student.id) === currentStudentId;
		}
		return true;
	};

	FileVaultV2.prototype.loadStudent = function (studentId, options) {
		var self = this;
		if (!this.roleIsStaff() || !studentId) return Promise.resolve();
		if (this.studentRequestController && typeof this.studentRequestController.abort === "function") this.studentRequestController.abort();
		var requestToken = ++this.studentRequestToken;
		var requestController = typeof window.AbortController === "function" ? new window.AbortController() : null;
		this.studentRequestController = requestController;
		if (this.state.overlay) this.closeOverlay({ restoreFocus: false });
		this.state.data = this.state.staffData;
		this.state.studentLoading = true;
		this.state.staffLoadingMore = false;
		this.state.selectedStudentId = studentId;
		this.state.view = options && options.view === "docdocs" ? "command" : "vault";
		this.state.selectedDocumentId = 0;
		this.state.documentDetail = null;
		this.state.documentLoading = false;
		this.state.documentError = "";
		this.state.workspaceTab = "score";
		this.state.reviewStatus = "reviewed";
		this.state.reviewNote = "";
		this.state.scoreDraft = {};
		this.state.scoreNotes = "";
		this.resetInternalNotes();
		this.state.busy = {};
		this.render();
		return this.request("GET", "/students/" + studentId, null, null, requestController && requestController.signal).then(function (scoped) {
			if (self.destroyed || requestToken !== self.studentRequestToken || self.state.selectedStudentId !== studentId) return;
			if (!scoped || typeof scoped !== "object" || Array.isArray(scoped)) throw new Error("File Vault returned malformed student scope data.");
			var staff = self.state.staffData || self.state.data || {};
			scoped = Object.assign({}, scoped);
			scoped.viewer_role = staff.viewer_role || self.role();
			scoped.students = Array.isArray(staff.students) ? staff.students : [];
			scoped.review_queue = Array.isArray(staff.review_queue) ? staff.review_queue : [];
			scoped.command = staff.command || {};
			scoped.staff_pagination = staff.staff_pagination || { page: 1, per_page: 50, has_more: false, next_page: null, scope_complete: true };
			var validated = self.validateBootstrap(scoped);
			if (positiveInt(validated.student && validated.student.id) !== studentId) {
				throw new Error("File Vault returned the wrong student scope.");
			}
			self.studentRequestController = null;
			self.state.studentLoading = false;
			self.acceptBootstrap(validated, true);
			self.state.lastStudentId = studentId;
			self.state.view = "vault";
			self.render();
			if (self.refs.live) self.refs.live.textContent = "Opened " + String(validated.student && validated.student.display_name || "student") + "'s File Vault.";
			if (options && options.documentId) self.openWorkspace(options.documentId);
			else self.focusViewHeading();
		}).catch(function (error) {
			if (self.destroyed || requestToken !== self.studentRequestToken || self.state.selectedStudentId !== studentId || (error && error.name === "AbortError")) return;
			self.studentRequestController = null;
			self.state.data = self.state.staffData;
			self.state.selectedStudentId = 0;
			self.state.selectedDocumentId = 0;
			self.state.documentDetail = null;
			self.state.documentLoading = false;
			self.state.documentError = "";
			self.state.studentLoading = false;
			self.state.busy = {};
			self.state.view = "command";
			self.render();
			self.toast("Student Vault unavailable", errorMessage(error), "error");
		});
	};

	FileVaultV2.prototype.staffCommand = function (students, queue) {
		students = Array.isArray(students) ? students : [];
		queue = Array.isArray(queue) ? queue : [];
		return {
			student_count: students.length,
			document_count: students.reduce(function (total, student) { return total + Math.max(0, Number(student.document_count) || 0); }, 0),
			review_count: queue.length,
			attention_count: students.reduce(function (total, student) { return total + Math.max(0, Number(student.needs_attention) || 0); }, 0)
		};
	};

	FileVaultV2.prototype.mergeStaffRows = function (current, incoming) {
		var seen = {};
		return (Array.isArray(current) ? current : []).concat(Array.isArray(incoming) ? incoming : []).filter(function (item) {
			var id = positiveInt(item && item.id);
			if (!id || seen[id]) return false;
			seen[id] = true;
			return true;
		});
	};

	FileVaultV2.prototype.loadStaffSearch = function (query) {
		var self = this;
		query = String(query || "").trim();
		if (!this.roleIsStaff()) return Promise.resolve();
		if (this.staffSearchController && typeof this.staffSearchController.abort === "function") this.staffSearchController.abort();
		this.staffSearchController = null;
		var requestToken = ++this.staffSearchToken;
		if (!query) {
			this.state.staffSearchData = null;
			this.state.staffSearchLoading = false;
			this.state.staffSearchError = "";
			this.state.staffLoadingMore = false;
			this.state.staffLoadError = "";
			this.render({ focusKey: "command-search" });
			return Promise.resolve();
		}
		var controller = typeof window.AbortController === "function" ? new window.AbortController() : null;
		this.staffSearchController = controller;
		this.state.staffSearchLoading = true;
		this.state.staffSearchError = "";
		this.state.staffLoadError = "";
		this.state.staffLoadingMore = false;
		this.render({ focusKey: "command-search" });
		return this.request("GET", "/students", null, { search: query, page: 1, per_page: 50 }, controller && controller.signal).then(function (payload) {
			if (self.destroyed || requestToken !== self.staffSearchToken || self.state.commandSearch.trim() !== query) return;
			if (!payload || typeof payload !== "object" || !Array.isArray(payload.students) || !payload.pagination || typeof payload.pagination !== "object") {
				throw new Error("File Vault returned malformed student search data.");
			}
			self.staffSearchController = null;
			self.state.staffSearchData = {
				students: payload.students,
				staff_pagination: payload.pagination
			};
			self.state.staffSearchLoading = false;
			self.state.paginationAnnouncement = payload.students.length + (payload.students.length === 1 ? " matching student found." : " matching students found.");
			self.render({ focusKey: "command-search" });
		}).catch(function (error) {
			if (self.destroyed || requestToken !== self.staffSearchToken || (error && error.name === "AbortError")) return;
			self.staffSearchController = null;
			self.state.staffSearchData = null;
			self.state.staffSearchLoading = false;
			self.state.staffSearchError = errorMessage(error, "Student search could not be completed.");
			self.state.paginationAnnouncement = "Student search unavailable.";
			self.render({ focusKey: "command-search" });
		});
	};

	FileVaultV2.prototype.loadMoreStaff = function () {
		var self = this;
		var searchQuery = this.state.commandSearch.trim();
		var data = searchQuery && this.state.staffSearchData ? this.state.staffSearchData : (this.state.staffData || this.state.data || {});
		var pagination = data.staff_pagination || {};
		var page = positiveInt(pagination.next_page);
		if (!this.roleIsStaff() || !page || this.state.staffLoadingMore) return Promise.resolve();
		var searchToken = this.staffSearchToken;
		var selectedStudentId = positiveInt(this.state.selectedStudentId);
		var requestController = null;
		if (searchQuery && typeof window.AbortController === "function") {
			if (this.staffSearchController && typeof this.staffSearchController.abort === "function") this.staffSearchController.abort();
			requestController = new window.AbortController();
			this.staffSearchController = requestController;
		}
		this.state.staffLoadingMore = true;
		this.state.staffLoadError = "";
		this.state.paginationAnnouncement = "";
		this.render({ focusKey: "staff-load-more" });
		return this.request("GET", "/students", null, { search: searchQuery, page: page, per_page: positiveInt(pagination.per_page) || 50 }, requestController && requestController.signal).then(function (payload) {
			if (self.destroyed || positiveInt(self.state.selectedStudentId) !== selectedStudentId || (searchQuery && (searchToken !== self.staffSearchToken || self.state.commandSearch.trim() !== searchQuery))) return;
			if (!payload || typeof payload !== "object" || !Array.isArray(payload.students) || !Array.isArray(payload.review_queue) || !payload.pagination || typeof payload.pagination !== "object") {
				throw new Error("File Vault returned malformed staff pagination data.");
			}
			if (searchQuery && self.staffSearchController === requestController) self.staffSearchController = null;
			data.students = self.mergeStaffRows(data.students, payload.students);
			data.staff_pagination = payload.pagination;
			if (searchQuery) self.state.staffSearchData = data;
			else {
				data.review_queue = self.mergeStaffRows(data.review_queue, payload.review_queue).sort(function (left, right) {
					return String(left.updated_at || "").localeCompare(String(right.updated_at || ""));
				});
				data.command = self.staffCommand(data.students, data.review_queue);
				self.state.staffData = data;
				self.state.data = data;
			}
			self.state.staffLoadingMore = false;
			self.state.paginationAnnouncement = payload.students.length + (payload.students.length === 1 ? " student loaded." : " students loaded.");
			var studentQuery = self.state.commandSearch.trim().toLowerCase();
			var firstVisibleStudent = payload.students[0];
			var firstStudentId = positiveInt(firstVisibleStudent && firstVisibleStudent.id);
			self.render({ focusKey: firstStudentId ? "student-" + firstStudentId : (studentQuery ? "command-search" : (payload.pagination.has_more ? "staff-load-more" : "nav-command")) });
		}).catch(function (error) {
			if (self.destroyed || positiveInt(self.state.selectedStudentId) !== selectedStudentId || (searchQuery && (searchToken !== self.staffSearchToken || self.state.commandSearch.trim() !== searchQuery)) || (error && error.name === "AbortError")) return;
			if (searchQuery && self.staffSearchController === requestController) self.staffSearchController = null;
			self.state.staffLoadingMore = false;
			self.state.staffLoadError = errorMessage(error, "The next roster page could not be loaded.");
			self.state.paginationAnnouncement = "Roster page not loaded.";
			self.render({ focusKey: "staff-load-more" });
		});
	};

	FileVaultV2.prototype.loadAudit = function (page, append) {
		var self = this;
		if (!this.roleIsStaff()) return;
		page = positiveInt(page) || 1;
		append = !!append;
		if ((append && this.state.auditLoadingMore) || (!append && this.state.auditLoading)) return;
		this.state.auditLoading = !append;
		this.state.auditLoadingMore = append;
		this.state.auditError = "";
		if (!append) this.state.paginationAnnouncement = "";
		this.render();
		var cursor = append && this.state.auditPagination ? this.state.auditPagination : {};
		this.request("GET", "/audit", null, {
			page: page,
			per_page: positiveInt(cursor.per_page) || 50,
			event_limit: positiveInt(cursor.event_limit) || 200,
			before_at: cursor.next_before_at || "",
			before_id: cursor.next_before_id || ""
		}).then(function (payload) {
			if (self.destroyed) return;
			if (!payload || typeof payload !== "object" || !Array.isArray(payload.events) || !payload.pagination || typeof payload.pagination !== "object") throw new Error("File Vault returned malformed audit data.");
			var combined = append ? (Array.isArray(self.state.audit) ? self.state.audit : []).concat(payload.events) : payload.events;
			var seen = {};
			self.state.audit = combined.filter(function (eventItem, index) {
				var key = String(eventItem.id || [eventItem.at, eventItem.document_id, eventItem.type, eventItem.message, index].join("|"));
				if (seen[key]) return false;
				seen[key] = true;
				return true;
			}).sort(function (left, right) {
				var timeOrder = String(right.at || "").localeCompare(String(left.at || ""));
				return timeOrder || String(right.id || "").localeCompare(String(left.id || ""));
			});
			self.state.auditPagination = payload.pagination;
			self.state.auditLoading = false;
			self.state.auditLoadingMore = false;
			if (append) self.state.paginationAnnouncement = payload.events.length + (payload.events.length === 1 ? " activity event loaded." : " activity events loaded.");
			var auditQuery = self.state.auditSearch.trim().toLowerCase();
			var firstVisibleEvent = payload.events.find(function (eventItem) {
				return !auditQuery || [eventItem.message, eventItem.document_name, eventItem.actor, eventItem.student && eventItem.student.display_name].join(" ").toLowerCase().indexOf(auditQuery) !== -1;
			});
			var firstEventId = firstVisibleEvent && String(firstVisibleEvent.id || "").replace(/[^A-Za-z0-9_-]/g, "_");
			self.render({ focusKey: append ? (firstEventId ? "audit-event-" + firstEventId : (auditQuery ? "audit-search" : (payload.pagination.has_more ? "audit-load-more" : "audit-feed"))) : "nav-audit" });
		}).catch(function (error) {
			if (self.destroyed || (error && error.name === "AbortError")) return;
			self.state.auditLoading = false;
			self.state.auditLoadingMore = false;
			self.state.auditError = errorMessage(error, "The audit feed could not be loaded.");
			self.state.paginationAnnouncement = append ? "Activity page not loaded." : "";
			self.render({ focusKey: append ? "audit-load-more" : "nav-audit" });
		});
	};

	FileVaultV2.prototype.openWorkspace = function (documentId) {
		var self = this;
		if (!documentId) return;
		if (this.state.overlay) this.closeOverlay({ restoreFocus: false });
		this.state.selectedDocumentId = documentId;
		this.state.view = "docdocs";
		this.state.workspaceTab = "score";
		this.state.documentLoading = true;
		this.state.documentError = "";
		this.resetInternalNotes();
		var studentContext = this.captureStudentContext();
		this.render();
		this.focusStageStart();
		this.request("GET", "/files/" + documentId).then(function (documentItem) {
			if (!self.studentContextMatches(studentContext) || positiveInt(self.state.selectedDocumentId) !== positiveInt(documentId)) return;
			if (!documentItem || typeof documentItem !== "object" || Array.isArray(documentItem) || positiveInt(documentItem.id) !== positiveInt(documentId)) {
				throw new Error("File Vault returned a malformed document record.");
			}
			self.state.documentDetail = documentItem;
			self.upsertDocument(documentItem);
			self.state.documentLoading = false;
			self.initializeReviewDrafts(documentItem);
			self.render();
			self.focusStageStart();
		}).catch(function (error) {
			if (!self.studentContextMatches(studentContext) || positiveInt(self.state.selectedDocumentId) !== positiveInt(documentId) || (error && error.name === "AbortError")) return;
			self.state.documentLoading = false;
			self.state.documentError = errorMessage(error, "The document record could not be loaded.");
			self.render();
		});
	};

	FileVaultV2.prototype.focusStageStart = function () {
		if (!this.refs.stage) return;
		this.refs.stage.scrollTop = 0;
		if (typeof this.refs.stage.focus === "function") this.refs.stage.focus({ preventScroll: true });
	};

	FileVaultV2.prototype.initializeReviewDrafts = function (documentItem) {
		var latest = documentItem && documentItem.latest_score && typeof documentItem.latest_score === "object" ? documentItem.latest_score : null;
		this.state.scoreDraft = {};
		var rubric = this.rubricForDocument(documentItem);
		rubric.forEach(function (label) {
			var key = slugify(label);
			this.state.scoreDraft[key] = latest && latest.category_scores ? boundedInt(latest.category_scores[key], 0, 10) : 0;
		}, this);
		this.state.scoreNotes = "";
		var reviewOptions = this.reviewStatusOptions(documentItem);
		this.state.reviewStatus = reviewOptions.length ? reviewOptions[0].value : "";
		this.state.reviewNote = documentItem.review_note || "";
	};

	FileVaultV2.prototype.upsertDocument = function (documentItem) {
		if (!documentItem || !this.state.data) return;
		var id = positiveInt(documentItem.id);
		var documents = Array.isArray(this.state.data.documents) ? this.state.data.documents : [];
		var index = documents.findIndex(function (candidate) { return positiveInt(candidate.id) === id; });
		if (index === -1) documents.unshift(documentItem);
		else documents[index] = documentItem;
		this.state.data.documents = documents;
		if (this.state.documentDetail && positiveInt(this.state.documentDetail.id) === id) this.state.documentDetail = documentItem;
	};

	FileVaultV2.prototype.refreshAfterMutation = function (studentContext) {
		var self = this;
		studentContext = studentContext || this.captureStudentContext();
		var selectedId = this.state.selectedDocumentId;
		var selectedView = this.state.view;
		var query = this.roleIsStaff() && studentContext.studentId ? { student_id: studentContext.studentId } : {};
		return this.request("GET", "/bootstrap", null, query).then(function (data) {
			if (!self.studentContextMatches(studentContext)) return;
			var validated = self.validateBootstrap(data);
			if (self.roleIsStaff() && studentContext.studentId && positiveInt(validated.student && validated.student.id) !== positiveInt(studentContext.studentId)) {
				throw new Error("File Vault returned the wrong student scope.");
			}
			self.acceptBootstrap(validated, true);
			self.state.view = selectedView;
			self.state.selectedDocumentId = selectedId;
			var refreshed = self.getDocument(selectedId);
			if (refreshed) self.state.documentDetail = refreshed;
			self.render();
		}).catch(function (error) {
			if (!self.studentContextMatches(studentContext) || (error && error.name === "AbortError")) return;
			self.toast("Record refresh delayed", "The completed change is saved, but the latest summary could not be reloaded.", "error");
		});
	};

	FileVaultV2.prototype.submitDocument = function (documentId) {
		var self = this;
		if (!documentId || this.state.busy.submit) return;
		var studentContext = this.captureStudentContext();
		this.state.busy.submit = true;
		this.render({ focusKey: "submit-" + documentId });
		this.request("POST", "/files/" + documentId + "/submit", {}).then(function (documentItem) {
			if (!self.studentContextMatches(studentContext)) return;
			self.upsertDocument(documentItem);
			self.toast("Submitted for review", String(documentItem.name || "Document") + " is now in the review loop.", "success");
			self.playSuccessSound();
			return self.refreshAfterMutation(studentContext);
		}).catch(function (error) {
			if (!self.studentContextMatches(studentContext) || (error && error.name === "AbortError")) return;
			self.toast("Submission failed", errorMessage(error), "error");
		}).finally(function () {
			if (!self.studentContextMatches(studentContext)) return;
			self.state.busy.submit = false;
			self.render({ focusKey: "submit-" + documentId });
		});
	};

	FileVaultV2.prototype.addComment = function (form) {
		var self = this;
		var field = form.querySelector("[data-fv2-comment-body]");
		var body = field ? field.value.trim() : "";
		var documentItem = this.getDocument(this.state.selectedDocumentId);
		if (!documentItem || !body || body.length > 2000 || this.state.busy.comment) return;
		var studentContext = this.captureStudentContext();
		this.state.busy.comment = true;
		this.render({ focusKey: "workspace-comments" });
		this.request("POST", "/files/" + positiveInt(documentItem.id) + "/comments", { body: body }).then(function (comment) {
			if (!self.studentContextMatches(studentContext)) return;
			var comments = Array.isArray(documentItem.comments) ? documentItem.comments : [];
			comments.push(comment);
			documentItem.comments = comments;
			documentItem.open_comment_count = Math.max(0, Number(documentItem.open_comment_count) || 0) + 1;
			self.upsertDocument(documentItem);
			self.toast("Comment posted", "The comment is stored on this document.", "success");
			self.playSuccessSound();
			return self.refreshAfterMutation(studentContext);
		}).catch(function (error) {
			if (!self.studentContextMatches(studentContext) || (error && error.name === "AbortError")) return;
			self.toast("Comment not posted", errorMessage(error), "error");
		}).finally(function () {
			if (!self.studentContextMatches(studentContext)) return;
			self.state.busy.comment = false;
			self.render({ focusKey: "workspace-comments" });
		});
	};

	FileVaultV2.prototype.loadInternalNotes = function (documentId) {
		var self = this;
		if (!documentId || !this.roleIsStaff() || !this.capability("internal_notes") || this.state.internalNotesLoading) return Promise.resolve();
		var studentContext = this.captureStudentContext();
		var requestToken = ++this.internalNotesRequestToken;
		this.state.internalNotesLoading = true;
		this.state.internalNotesError = "";
		this.render({ focusKey: "workspace-internal-notes" });
		return this.request("GET", "/files/" + positiveInt(documentId) + "/internal-notes").then(function (notes) {
			if (!self.internalNotesContextMatches(studentContext, documentId, requestToken)) return;
			if (!Array.isArray(notes)) throw new Error("File Vault returned malformed internal note data.");
			self.state.internalNotes = notes;
			self.state.internalNotesLoading = false;
			self.render({ focusKey: "workspace-internal-notes" });
		}).catch(function (error) {
			if (!self.internalNotesContextMatches(studentContext, documentId, requestToken) || (error && error.name === "AbortError")) return;
			self.state.internalNotesLoading = false;
			self.state.internalNotesError = errorMessage(error, "Internal notes could not be loaded.");
			self.render({ focusKey: "workspace-internal-notes" });
		});
	};

	FileVaultV2.prototype.addInternalNote = function (form) {
		var self = this;
		var field = form.querySelector("[data-fv2-internal-note-body]");
		var body = field ? field.value.trim() : "";
		var documentId = positiveInt(this.state.selectedDocumentId);
		if (!documentId || !this.roleIsStaff() || !this.capability("internal_notes") || !body || body.length > 2000 || this.state.busy.internalNote) return;
		var studentContext = this.captureStudentContext();
		var requestToken = ++this.internalNotesRequestToken;
		this.state.busy.internalNote = true;
		this.render({ focusKey: "workspace-internal-notes" });
		this.request("POST", "/files/" + documentId + "/internal-notes", { body: body }).then(function (note) {
			if (!self.internalNotesContextMatches(studentContext, documentId, requestToken)) return;
			self.state.internalNotes = (Array.isArray(self.state.internalNotes) ? self.state.internalNotes : []).concat([note]);
			self.toast("Internal note saved", "The note is available only to authorized MissionMed staff.", "success");
			self.playSuccessSound();
		}).catch(function (error) {
			if (!self.internalNotesContextMatches(studentContext, documentId, requestToken) || (error && error.name === "AbortError")) return;
			self.toast("Internal note not saved", errorMessage(error), "error");
		}).finally(function () {
			if (!self.internalNotesContextMatches(studentContext, documentId, requestToken)) return;
			self.state.busy.internalNote = false;
			self.render({ focusKey: "workspace-internal-notes" });
		});
	};

	FileVaultV2.prototype.resolveComment = function (documentId, commentId) {
		var self = this;
		if (!documentId || !commentId || this.state.busy.resolve) return;
		var studentContext = this.captureStudentContext();
		this.state.busy.resolve = true;
		this.request("PUT", "/files/" + documentId + "/comments/" + encodeURIComponent(commentId) + "/resolve", {}).then(function (comment) {
			if (!self.studentContextMatches(studentContext)) return;
			var documentItem = self.getDocument(documentId);
			if (documentItem && Array.isArray(documentItem.comments)) {
				documentItem.comments = documentItem.comments.map(function (candidate) { return candidate.id === comment.id ? comment : candidate; });
				documentItem.open_comment_count = documentItem.comments.filter(function (candidate) { return !candidate.resolved; }).length;
				self.upsertDocument(documentItem);
			}
			self.toast("Comment resolved", "The server recorded the resolution.", "success");
			self.playSuccessSound();
			self.render({ focusKey: "workspace-comments" });
		}).catch(function (error) {
			if (!self.studentContextMatches(studentContext) || (error && error.name === "AbortError")) return;
			self.toast("Comment not resolved", errorMessage(error), "error");
		}).finally(function () { if (self.studentContextMatches(studentContext)) self.state.busy.resolve = false; });
	};

	FileVaultV2.prototype.saveReviewStatus = function () {
		var self = this;
		var documentItem = this.getDocument(this.state.selectedDocumentId);
		var status = this.state.reviewStatus;
		var note = this.state.reviewNote.trim();
		if (!documentItem || this.state.busy.review) return;
		var studentContext = this.captureStudentContext();
		var allowedStatuses = this.reviewStatusOptions(documentItem).map(function (option) { return option.value; });
		if (allowedStatuses.indexOf(status) === -1) {
			this.toast("Choose a review status", "Choose an available next status for this document.", "error");
			return;
		}
		if (status === "needs_changes" && !note) {
			this.toast("Review note required", "Describe the changes the student should make.", "error");
			return;
		}
		this.state.busy.review = true;
		this.render({ focusKey: "workspace-score" });
		this.request("PUT", "/files/" + positiveInt(documentItem.id) + "/status", { status: status, note: note }).then(function (updated) {
			if (!self.studentContextMatches(studentContext)) return;
			self.upsertDocument(updated);
			self.state.documentDetail = updated;
			self.toast("Review status saved", String(updated.status_label || statusInfo(status).label) + " is now recorded.", "success");
			self.playSuccessSound();
			return self.refreshAfterMutation(studentContext);
		}).catch(function (error) {
			if (!self.studentContextMatches(studentContext) || (error && error.name === "AbortError")) return;
			self.toast("Status not saved", errorMessage(error), "error");
		}).finally(function () {
			if (!self.studentContextMatches(studentContext)) return;
			self.state.busy.review = false;
			self.render({ focusKey: "workspace-score" });
		});
	};

	FileVaultV2.prototype.saveScore = function () {
		var self = this;
		var documentItem = this.getDocument(this.state.selectedDocumentId);
		if (!documentItem || this.state.busy.score) return;
		var studentContext = this.captureStudentContext();
		var rubric = this.rubricForDocument(documentItem);
		if (!rubric.length) return;
		var categories = {};
		rubric.forEach(function (label) {
			var key = slugify(label);
			categories[key] = boundedInt(self.state.scoreDraft[key], 0, 10);
		});
		this.state.busy.score = true;
		this.render({ focusKey: "workspace-score" });
		this.request("POST", "/files/" + positiveInt(documentItem.id) + "/score", {
			total_score: this.scoreDraftTotal(),
			category_scores: categories,
			notes: this.state.scoreNotes.trim()
		}).then(function (score) {
			if (!self.studentContextMatches(studentContext)) return;
			var scores = Array.isArray(documentItem.scores) ? documentItem.scores : [];
			scores.push(score);
			documentItem.scores = scores;
			documentItem.latest_score = score;
			self.upsertDocument(documentItem);
			self.toast("Score saved", String(score.total_score) + "/" + String(self.scoreMaximum(score, rubric)) + " is now recorded for v" + String(score.version) + ".", "success");
			self.playSuccessSound();
			return self.refreshAfterMutation(studentContext);
		}).catch(function (error) {
			if (!self.studentContextMatches(studentContext) || (error && error.name === "AbortError")) return;
			self.toast("Score not saved", errorMessage(error), "error");
		}).finally(function () {
			if (!self.studentContextMatches(studentContext)) return;
			self.state.busy.score = false;
			self.render({ focusKey: "workspace-score" });
		});
	};

	FileVaultV2.prototype.downloadDocument = function (documentId, version, button) {
		var self = this;
		if (!documentId) return;
		var studentContext = this.captureStudentContext();
		if (button) {
			button.disabled = true;
			button.setAttribute("aria-busy", "true");
		}
		this.request("GET", "/files/" + documentId + "/download", null, version ? { version: version } : {}).then(function (payload) {
			if (!self.studentContextMatches(studentContext)) return;
			var url = self.safeDownloadUrl(payload && payload.url);
			if (!url) throw new Error("The server returned an invalid secure download URL.");
			var link = document.createElement("a");
			link.href = url;
			link.target = "_blank";
			link.rel = "noopener noreferrer";
			if (payload && payload.filename) link.download = String(payload.filename);
			link.hidden = true;
			document.body.appendChild(link);
			link.click();
			link.remove();
			var expires = Math.max(1, Number(payload && payload.expires) || 60);
			self.toast("Private download ready", "This download link expires in " + String(expires) + " seconds.", "success");
		}).catch(function (error) {
			if (!self.studentContextMatches(studentContext) || (error && error.name === "AbortError")) return;
			self.toast("Download unavailable", errorMessage(error), "error");
		}).finally(function () {
			if (button && document.contains(button)) {
				button.disabled = false;
				button.removeAttribute("aria-busy");
			}
		});
	};

	FileVaultV2.prototype.downloadShare = function (shareId, button) {
		var self = this;
		if (!shareId) return;
		if (button) { button.disabled = true; button.setAttribute("aria-busy", "true"); }
		this.request("GET", "/shares/" + shareId + "/download").then(function (payload) {
			var url = self.safeDownloadUrl(payload && payload.url);
			if (!url) throw new Error("The server returned an invalid secure download URL.");
			var link = document.createElement("a");
			link.href = url;
			link.target = "_blank";
			link.rel = "noopener noreferrer";
			if (payload && payload.filename) link.download = String(payload.filename);
			link.hidden = true;
			document.body.appendChild(link);
			link.click();
			link.remove();
			self.toast("Secure download ready", "The access event was recorded and the link expires shortly.", "success");
		}).catch(function (error) {
			self.toast("Download unavailable", errorMessage(error), "error");
		}).finally(function () {
			if (button && document.contains(button)) { button.disabled = false; button.removeAttribute("aria-busy"); }
		});
	};

	FileVaultV2.prototype.updateShareStatus = function (shareId, status, button) {
		var self = this;
		if (!shareId || this.state.busy["share-status-" + shareId]) return;
		this.state.busy["share-status-" + shareId] = true;
		if (button) button.disabled = true;
		this.request("PATCH", "/shares/" + shareId + "/status", { status: status }).then(function (share) {
			["missionmed", "student_shared"].forEach(function (sourceClass) {
				self.state.shares[sourceClass] = (self.state.shares[sourceClass] || []).map(function (candidate) { return positiveInt(candidate.id) === shareId ? share : candidate; });
			});
			self.toast("Sharing updated", status === "active" ? "The approved audience can access this file again." : "Recipient access is now disabled.", "success");
		}).catch(function (error) {
			self.toast("Sharing not updated", errorMessage(error), "error");
		}).finally(function () {
			delete self.state.busy["share-status-" + shareId];
			self.render();
		});
	};

	FileVaultV2.prototype.openRecipientStatus = function (shareId, source) {
		this.state.recipients = null;
		this.state.recipientsLoading = true;
		this.state.recipientsError = "";
		this.state.preview = { kind: "recipients", item: { id: shareId }, payload: null };
		this.openOverlay("recipients", { preserveReturnFocus: true });
		this.loadRecipientPage(shareId, false);
	};

	FileVaultV2.prototype.loadRecipientPage = function (shareId, append) {
		var self = this;
		if (!shareId || (append && this.state.recipientsLoading)) return Promise.resolve();
		var current = this.state.recipients || {};
		var page = append && current.pagination && current.pagination.next_page ? positiveInt(current.pagination.next_page) : 1;
		this.state.recipientsLoading = true;
		this.state.recipientsError = "";
		if (this.state.overlay === "recipients") this.renderOverlay();
		return this.request("GET", "/shares/" + shareId + "/recipients", null, { page: page, per_page: 100 }).then(function (payload) {
			if (!payload || !Array.isArray(payload.items)) throw new Error("File Vault returned malformed recipient status.");
			var items = append ? (current.items || []).concat(payload.items) : payload.items;
			self.state.recipients = { items: items, counts: payload.counts || {}, evidence: payload.evidence || {}, pagination: payload.pagination || { has_more: false } };
		}).catch(function (error) {
			self.state.recipientsError = errorMessage(error, "Recipient status could not be loaded.");
		}).finally(function () {
			self.state.recipientsLoading = false;
			if (self.state.overlay === "recipients") self.renderOverlay();
		});
	};

	FileVaultV2.prototype.safeDownloadUrl = function (value) {
		try {
			var url = new URL(String(value || ""), window.location.href);
			return url.protocol === "https:" ? url.toString() : "";
		} catch (error) {
			return "";
		}
	};

	FileVaultV2.prototype.saveAndApplyPreferences = function () {
		writePreferences(this.preferences);
		this.applyPreferences();
	};

	FileVaultV2.prototype.toast = function (title, message, type) {
		if (!this.refs.toasts || this.destroyed) return;
		var self = this;
		var toast = document.createElement("div");
		toast.className = "fv2-toast fv2-toast-" + (type === "error" ? "error" : "success");
		toast.setAttribute("role", type === "error" ? "alert" : "status");
		var marker = document.createElement("span");
		marker.className = "fv2-toast-marker";
		marker.textContent = type === "error" ? "!" : "OK";
		var copy = document.createElement("div");
		var heading = document.createElement("strong");
		heading.textContent = title;
		var detail = document.createElement("span");
		detail.textContent = message || "";
		copy.appendChild(heading);
		copy.appendChild(detail);
		toast.appendChild(marker);
		toast.appendChild(copy);
		this.refs.toasts.appendChild(toast);
		while (this.refs.toasts.children.length > 2) this.refs.toasts.firstElementChild.remove();
		if (this.refs.live) this.refs.live.textContent = title + (message ? ". " + message : "");
		var timer = window.setTimeout(function () {
			self.timers.delete(timer);
			if (toast.parentNode) toast.remove();
		}, 5200);
		this.timers.add(timer);
	};

	FileVaultV2.prototype.playSuccessSound = function () {
		if (!this.preferences.sound || document.visibilityState !== "visible" || this.destroyed) return;
		var AudioContext = window.AudioContext || window.webkitAudioContext;
		if (!AudioContext) return;
		try {
			this.audioContext = this.audioContext || new AudioContext();
			var context = this.audioContext;
			var oscillator = context.createOscillator();
			var gain = context.createGain();
			var now = context.currentTime;
			oscillator.type = "sine";
			oscillator.frequency.setValueAtTime(520, now);
			oscillator.frequency.linearRampToValueAtTime(660, now + 0.12);
			gain.gain.setValueAtTime(0.0001, now);
			gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, this.preferences.volume * 0.045), now + 0.015);
			gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
			oscillator.connect(gain);
			gain.connect(context.destination);
			oscillator.start(now);
			oscillator.stop(now + 0.2);
		} catch (error) {
			// Audio is optional and never affects the completed action.
		}
	};

	FileVaultV2.prototype.openOverlay = function (type, options) {
		if (!this.refs.overlay || !document.contains(this.refs.overlay)) this.refs.overlay = this.root.querySelector("[data-fv2-overlay]");
		if (!this.refs.overlay) return;
		if (!this.state.overlay || !(options && options.preserveReturnFocus)) this.returnFocus = document.activeElement;
		this.state.overlay = type;
		this.refs.overlay.hidden = false;
		this.refs.overlay.inert = false;
		this.refs.overlay.removeAttribute("inert");
		if (this.refs.frame) {
			this.refs.frame.inert = true;
			this.refs.frame.setAttribute("inert", "");
			this.refs.frame.setAttribute("aria-hidden", "true");
		}
		this.setExternalOverlayIsolation(true);
		this.renderOverlay();
	};

	FileVaultV2.prototype.setExternalOverlayIsolation = function (active) {
		if (active) {
			if (document.body && document.body.classList) document.body.classList.add("mmed-fv2-overlay-open");
			if (this.overlayIsolation.length) return;
			var nodes = [document.getElementById("mmed-matrix-app-return"), document.getElementById("wpadminbar")].filter(Boolean);
			this.overlayIsolation = nodes.map(function (node) {
				var previous = {
					node: node,
					hadInert: node.hasAttribute("inert"),
					ariaHidden: node.getAttribute("aria-hidden")
				};
				node.inert = true;
				node.setAttribute("inert", "");
				node.setAttribute("aria-hidden", "true");
				return previous;
			});
			return;
		}
		if (document.body && document.body.classList) document.body.classList.remove("mmed-fv2-overlay-open");
		this.overlayIsolation.splice(0).forEach(function (previous) {
			if (!previous.node || !document.contains(previous.node)) return;
			if (previous.hadInert) {
				previous.node.inert = true;
				previous.node.setAttribute("inert", "");
			} else {
				previous.node.inert = false;
				previous.node.removeAttribute("inert");
			}
			if (previous.ariaHidden === null) previous.node.removeAttribute("aria-hidden");
			else previous.node.setAttribute("aria-hidden", previous.ariaHidden);
		});
	};

	FileVaultV2.prototype.closeOverlay = function (options) {
		options = options || {};
		if (!this.state.overlay || !this.refs.overlay) return;
		if (this.state.overlay === "upload" && !options.keepUpload) this.abortUpload(true);
		this.state.overlay = "";
		if (!options.keepUpload) this.state.upload = null;
		this.state.preview = null;
		this.state.previewLoading = false;
		this.state.previewError = "";
		this.state.recipients = null;
		this.state.recipientsLoading = false;
		this.state.recipientsError = "";
		this.refs.overlay.innerHTML = "";
		this.refs.overlay.hidden = true;
		this.refs.overlay.inert = true;
		this.refs.overlay.setAttribute("inert", "");
		if (this.refs.frame) {
			this.refs.frame.inert = false;
			this.refs.frame.removeAttribute("inert");
			this.refs.frame.removeAttribute("aria-hidden");
		}
		this.setExternalOverlayIsolation(false);
		var returnFocus = this.returnFocus;
		this.returnFocus = null;
		if (options.restoreFocus !== false && returnFocus && document.contains(returnFocus) && typeof returnFocus.focus === "function") {
			returnFocus.focus({ preventScroll: true });
		}
	};

	FileVaultV2.prototype.renderOverlay = function (options) {
		var self = this;
		if (!this.refs.overlay || !document.contains(this.refs.overlay)) this.refs.overlay = this.root.querySelector("[data-fv2-overlay]");
		if (!this.refs.overlay || !this.state.overlay) return;
		var type = this.state.overlay;
		var overlayFocus = options && options.focusKey ? options.focusKey : "";
		if (!overlayFocus && document.activeElement && this.refs.overlay.contains(document.activeElement)) {
			overlayFocus = document.activeElement.getAttribute("data-fv2-overlay-focus") || document.activeElement.getAttribute("data-fv2-settings-focus") || "";
		}
		var content = "";
		var panelClass = "fv2-modal";
		var label = "File Vault dialog";
		if (type === "settings") {
			content = this.settingsMarkup();
			panelClass = "fv2-drawer";
			label = "File Vault settings";
		} else if (type === "upload") {
			content = this.uploadMarkup();
			panelClass += " fv2-upload-modal";
			label = this.state.upload && this.state.upload.documentId ? "Upload a new document version" : "Upload a document";
		} else if (type === "detail") {
			var documentItem = this.getDocument(this.state.selectedDocumentId);
			if (!documentItem) {
				this.closeOverlay();
				return;
			}
			content = this.documentDetailMarkup(documentItem, true);
			panelClass = "fv2-mobile-sheet";
			label = "Document details";
		} else if (type === "quicklook") {
			content = this.quickLookMarkup();
			panelClass += " fv2-quicklook-modal";
			label = "File quick look";
		} else if (type === "recipients") {
			content = this.recipientStatusMarkup();
			panelClass += " fv2-recipient-modal";
			label = "Recipient download status";
		}
		this.refs.overlay.innerHTML = '<div class="fv2-scrim" data-fv2-action="close-overlay" aria-hidden="true"></div><section class="fv2-overlay-panel ' + panelClass + '" data-fv2-overlay-panel role="dialog" aria-modal="true" aria-label="' + escAttr(label) + '">' + content + "</section>";
		var preferred = null;
		if (overlayFocus) {
			preferred = Array.prototype.slice.call(this.refs.overlay.querySelectorAll("[data-fv2-overlay-focus],[data-fv2-settings-focus]")).find(function (candidate) {
					return (candidate.getAttribute("data-fv2-overlay-focus") || candidate.getAttribute("data-fv2-settings-focus")) === overlayFocus;
			}) || null;
		}
		preferred = preferred || this.refs.overlay.querySelector("[data-fv2-autofocus]");
		var focusable = preferred || this.focusableElements(this.refs.overlay)[0] || this.refs.overlay.querySelector("[data-fv2-overlay-panel]");
		if (focusable) {
			if (!focusable.hasAttribute("tabindex") && focusable.matches("[data-fv2-overlay-panel]")) focusable.setAttribute("tabindex", "-1");
			focusable.focus({ preventScroll: true });
			window.requestAnimationFrame(function () {
				if (self.destroyed || !self.state.overlay || !document.contains(focusable)) return;
				if (self.refs.overlay && self.refs.overlay.contains(document.activeElement)) return;
				focusable.focus({ preventScroll: true });
			});
		}
	};

	FileVaultV2.prototype.quickLookMarkup = function () {
		var preview = this.state.preview || {};
		var item = preview.item || {};
		var payload = preview.payload || {};
		var title = item.title || item.name || "File preview";
		var mime = String(payload.mime_type || item.mime_type || "").toLowerCase();
		var url = this.safeDownloadUrl(payload.url);
		var media = "";
		if (this.state.previewLoading) media = this.stateMessageMarkup("loading", "Preparing preview", "Opening a short-lived private view.", "");
		else if (this.state.previewError) media = this.stateMessageMarkup("error", "Preview unavailable", this.state.previewError, "");
		else if (!payload.previewable || !url) media = this.stateMessageMarkup("empty", "No browser preview for this file", "Download it to open in its native application.", "");
		else if (mime.indexOf("image/") === 0) media = '<img class="fv2-preview-image" src="' + escAttr(url) + '" alt="Preview of ' + escAttr(title) + '">';
		else if (mime.indexOf("video/") === 0) media = '<video class="fv2-preview-video" src="' + escAttr(url) + '" controls preload="metadata" playsinline></video>';
		else media = '<iframe class="fv2-preview-frame" src="' + escAttr(url) + '" title="Preview of ' + escAttr(title) + '" referrerpolicy="no-referrer"></iframe>';
		var id = positiveInt(item.id);
		var downloadAction = preview.kind === "share" ? "download-share" : "download";
		var dataId = preview.kind === "share" ? ' data-fv2-share-id="' + id + '"' : ' data-fv2-document-id="' + id + '"';
		return '<header class="fv2-overlay-header"><div><span>Quick Look</span><h1>' + esc(title) + '</h1></div><button type="button" class="fv2-icon-button" data-fv2-action="close-overlay" data-fv2-autofocus aria-label="Close preview">' + icon("close") + '</button></header><div class="fv2-quicklook-body"><div class="fv2-preview-stage">' + media + '</div><aside class="fv2-preview-meta"><span>' + esc(documentFileKind(item).label) + '</span><h2>' + esc(item.filename || item.original_name || item.canonical_name || title) + '</h2><dl><div><dt>Size</dt><dd>' + esc(formatSize(item.file_size)) + '</dd></div><div><dt>Version</dt><dd>' + esc(item.current_revision || item.version || 1) + '</dd></div><div><dt>Shared by</dt><dd>' + esc(item.uploader_name || "Private Vault") + '</dd></div></dl><button type="button" class="fv2-button fv2-button-primary" data-fv2-action="' + downloadAction + '"' + dataId + '>' + icon("download") + 'Download</button></aside></div>';
	};

	FileVaultV2.prototype.recipientStatusMarkup = function () {
		var data = this.state.recipients || {};
		var counts = data.counts || {};
		var body = "";
		if (this.state.recipientsLoading) body = this.stateMessageMarkup("loading", "Loading recipient status", "Checking current enrollment and signed-download access evidence.", "");
		else if (this.state.recipientsError) body = this.stateMessageMarkup("error", "Recipient status unavailable", this.state.recipientsError, "");
		else body = '<div class="fv2-recipient-summary"><span><strong>' + esc(counts.targeted || 0) + '</strong> Targeted</span><span><strong>' + esc(counts.access_issued || 0) + '</strong> Link issued</span><span><strong>' + esc(counts.not_issued || 0) + '</strong> No link issued</span></div><p class="fv2-security-copy">' + icon("lock") + ' This records when MissionMed issued a signed download link. Direct R2 byte-transfer completion is not claimed.</p><div class="fv2-recipient-list">' + (data.items || []).map(function (recipient) { return '<div><span>' + esc(recipient.display_name || "Student") + '</span><strong class="' + (recipient.access_issued ? "is-issued" : "") + '">' + (recipient.access_issued ? "Link issued " + esc(formatDate(recipient.last_access_issued_at, true)) : "No link issued") + '</strong></div>'; }).join("") + '</div>' + (data.pagination && data.pagination.has_more ? '<div class="fv2-modal-actions"><button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="load-more-recipients" data-fv2-share-id="' + positiveInt(this.state.preview && this.state.preview.item && this.state.preview.item.id) + '">Load more recipients</button></div>' : '');
		return '<header class="fv2-overlay-header"><div><span>Signed-download evidence</span><h1>Recipient access status</h1></div><button type="button" class="fv2-icon-button" data-fv2-action="close-overlay" data-fv2-autofocus aria-label="Close recipient access status">' + icon("close") + '</button></header><div class="fv2-recipient-body">' + body + '</div>';
	};

	FileVaultV2.prototype.focusableElements = function (root) {
		if (!root) return [];
		return Array.prototype.slice.call(root.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(function (element) {
			return !element.hidden && element.getAttribute("aria-hidden") !== "true" && element.offsetParent !== null;
		});
	};

	FileVaultV2.prototype.trapFocus = function (event) {
		var panel = this.refs.overlay && this.refs.overlay.querySelector("[data-fv2-overlay-panel]");
		if (!panel) return;
		var focusable = this.focusableElements(panel);
		if (!focusable.length) {
			event.preventDefault();
			panel.focus();
			return;
		}
		var first = focusable[0];
		var last = focusable[focusable.length - 1];
		if (!panel.contains(document.activeElement)) {
			event.preventDefault();
			first.focus();
		} else if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	};

	FileVaultV2.prototype.settingsMarkup = function () {
		var systemReduced = !!(this.motionQuery && this.motionQuery.matches);
		var reducedOn = systemReduced || this.preferences.reducedMotion;
		return [
			'<header class="fv2-overlay-header"><div><span>Preferences</span><h1>Settings</h1></div><button type="button" class="fv2-icon-button" data-fv2-action="close-overlay" data-fv2-settings-focus="close" data-fv2-autofocus aria-label="Close settings">' + icon("close") + "</button></header>",
			'<div class="fv2-settings-body">',
			'<p class="fv2-settings-note">Preferences are saved on this device.</p>',
			'<section><h2>Appearance</h2>',
			'<div class="fv2-setting-row"><div><strong>Reduced motion</strong><span>' + (systemReduced ? "On because your operating system requests it." : "Reduce interface transitions and progress motion.") + '</span></div><button type="button" class="fv2-switch' + (reducedOn ? " is-on" : "") + '" role="switch" aria-checked="' + (reducedOn ? "true" : "false") + '" data-fv2-action="setting-reduced" data-fv2-settings-focus="reduced"' + (systemReduced ? " disabled" : "") + '><span></span><span class="fv2-sr-only">Toggle reduced motion</span></button></div>',
			'<div class="fv2-setting-row"><div><strong>Density</strong><span>Choose row spacing for repeated document work.</span></div><div class="fv2-segmented" role="group" aria-label="Interface density"><button type="button" data-fv2-action="setting-density" data-fv2-density="comfortable" data-fv2-settings-focus="density-comfortable" aria-pressed="' + (this.preferences.density === "comfortable" ? "true" : "false") + '" class="' + (this.preferences.density === "comfortable" ? "is-active" : "") + '">Comfortable</button><button type="button" data-fv2-action="setting-density" data-fv2-density="compact" data-fv2-settings-focus="density-compact" aria-pressed="' + (this.preferences.density === "compact" ? "true" : "false") + '" class="' + (this.preferences.density === "compact" ? "is-active" : "") + '">Compact</button></div></div>',
			"</section>",
			'<section><h2>Sound</h2>',
			'<div class="fv2-setting-row"><div><strong>Completion sound</strong><span>Off by default. Plays only for visible-tab success states.</span></div><button type="button" class="fv2-switch' + (this.preferences.sound ? " is-on" : "") + '" role="switch" aria-checked="' + (this.preferences.sound ? "true" : "false") + '" data-fv2-action="setting-sound" data-fv2-settings-focus="sound"><span></span><span class="fv2-sr-only">Toggle completion sounds</span></button></div>',
			'<label class="fv2-setting-row fv2-volume"><div><strong>Volume</strong><span>' + esc(Math.round(this.preferences.volume * 100)) + '%</span></div><input type="range" min="0" max="1" step="0.05" value="' + escAttr(this.preferences.volume) + '" data-fv2-volume data-fv2-settings-focus="volume"' + (this.preferences.sound ? "" : " disabled") + ' aria-label="Completion sound volume"></label>',
			"</section>",
			'<button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="reset-settings" data-fv2-settings-focus="reset">Reset preferences</button>',
			"</div>"
		].join("");
	};

	FileVaultV2.prototype.openUpload = function (options) {
		options = options || {};
		var shareSource = options.shareSource === "missionmed" ? "missionmed" : (options.shareSource === "student_shared" ? "student_shared" : "");
		var canShare = shareSource === "missionmed" ? this.capability("share_mission_file") : (shareSource === "student_shared" ? this.capability("share_student_file") : false);
		if (!this.capability("upload") && !canShare) {
			this.toast("Upload unavailable", "Your server role does not allow uploads in this Vault.", "error");
			return;
		}
		if (!this.storageReady()) {
			this.toast("Private storage unavailable", "Uploads are blocked until the server storage gate is restored.", "error");
			return;
		}
		if (this.roleIsStaff() && !this.state.selectedStudentId && !shareSource) {
			this.toast("Choose a student", "Select a server-scoped student before uploading.", "error");
			return;
		}
		var documentItem = options.documentId ? this.getDocument(options.documentId) : null;
		var context = this.uploadContext();
		var contextPrograms = Array.isArray(context.programs) ? context.programs.map(String).filter(Boolean) : [];
		var initialProgram = [documentItem && documentItem.program, context.program].concat(contextPrograms).map(normalizedProgramOption).find(Boolean) || (shareSource ? PROGRAM_OPTIONS[0] : "");
		var initialSession = documentItem && documentItem.session_letter ? String(documentItem.session_letter) : String(context.session_letter || "");
		if (shareSource && SESSION_OPTIONS.indexOf(initialSession.toUpperCase()) === -1) initialSession = "A";
		var initialVersion = documentItem ? Math.max(1, positiveInt(documentItem.version) + 1) : 1;
		this.state.upload = {
			step: 1,
			documentId: documentItem ? positiveInt(documentItem.id) : 0,
			documentType: documentItem ? String(documentItem.document_type || "other") : String(options.documentType || ""),
			displayName: documentItem ? String(documentItem.name || "Document") : String(options.displayName || ""),
			division: documentItem && documentItem.division ? String(documentItem.division) : String(context.division || ""),
			program: initialProgram,
			programs: PROGRAM_OPTIONS.slice(),
			sessionLetter: SESSION_OPTIONS.indexOf(initialSession.toUpperCase()) !== -1 ? initialSession.toUpperCase() : "",
			submissionDate: String(context.submission_date || new Date().toISOString().slice(0, 10)),
			version: initialVersion,
			draftLabel: "Version" + String(initialVersion).padStart(2, "0"),
			isFinal: false,
			replacesDocumentId: documentItem ? positiveInt(documentItem.id) : 0,
			forcedVersion: !!documentItem,
			replacementChoiceTouched: !!documentItem,
			canonicalName: "",
			note: "",
			readyForReview: false,
			shareAsMissionFile: shareSource === "missionmed",
			file: options.file || null,
			fileError: "",
			phase: "idle",
			progress: 0,
			intent: null,
			result: null,
			error: "",
			retryStage: "sign",
			active: false,
			abortRequested: false,
			controller: null,
			transfer: null,
			currentStage: "sign",
			sha256: ""
		};
		this.state.upload.shareSource = shareSource;
		this.state.audienceSearch = "";
		this.state.upload.audienceMode = shareSource === "missionmed" ? "all_eligible" : "groups";
		this.state.upload.groupIds = [];
		this.state.upload.userIds = [];
		this.state.upload.shareDescription = "";
		if (!documentItem && this.state.upload.documentType) {
			if (!this.state.upload.displayName) this.state.upload.displayName = this.canonicalDocumentName(this.state.upload.documentType);
			this.syncUploadLineage();
		}
		this.state.upload.fileError = this.validateFile(this.state.upload.file, this.state.upload.documentType);
		this.openOverlay("upload");
		if (shareSource) this.loadAudiences();
	};

	FileVaultV2.prototype.uploadMarkup = function () {
		var upload = this.state.upload;
		if (!upload) return "";
		var title = upload.shareSource === "missionmed" ? "Share Mission File" : (upload.shareSource === "student_shared" ? "Share with students" : (upload.documentId ? "Upload new version" : "Add document"));
		var steps = ["Details", "Review", "Upload"].map(function (label, index) {
			var number = index + 1;
			return '<li class="' + (upload.step === number ? "is-current" : (upload.step > number ? "is-complete" : "")) + '" aria-current="' + (upload.step === number ? "step" : "false") + '"><span>' + (upload.step > number ? icon("check") : number) + "</span><strong>" + esc(label) + "</strong></li>";
		}).join("");
		var body = upload.step === 1 ? this.uploadDetailsMarkup() : (upload.step === 2 ? this.uploadReviewMarkup() : this.uploadProgressMarkup());
		return '<header class="fv2-overlay-header"><div><span>Private File Vault</span><h1>' + esc(title) + '</h1></div><button type="button" class="fv2-icon-button" data-fv2-action="close-overlay" aria-label="Close upload">' + icon("close") + '</button></header><ol class="fv2-upload-steps" aria-label="Upload steps">' + steps + '</ol><div class="fv2-upload-body">' + body + "</div>";
	};

	FileVaultV2.prototype.uploadDetailsMarkup = function () {
		var upload = this.state.upload;
		var file = upload.file;
		var contract = this.uploadContract(upload.documentType);
		var fileTypeLabel = upload.documentType === "application_photo" ? "JPEG application photo" : (upload.documentType ? "PDF, DOCX, image, MP4, or WebM" : "PDF, DOCX, image, MP4, or WebM");
		var fileSummary = file ? '<div class="fv2-file-choice ' + (upload.fileError ? "has-error" : "is-valid") + '">' + icon(upload.fileError ? "alert" : "file") + '<div><strong>' + esc(file.name) + "</strong><span>" + esc(formatSize(file.size)) + (upload.fileError ? " / " + esc(upload.fileError) : " / Ready to review") + '</span></div><button type="button" class="fv2-icon-button" data-fv2-action="remove-upload-file" aria-label="Remove selected file">' + icon("close") + "</button></div>" : '<div class="fv2-file-choice"><span class="fv2-file-glyph">' + icon("upload") + "</span><div><strong>Choose a file or drop it here</strong><span>" + esc(fileTypeLabel) + " up to " + esc(formatSize(contract.maxFileSize)) + ".</span></div></div>";
		var typeField = upload.forcedVersion
			? '<div class="fv2-field"><span>Document type</span><strong class="fv2-readonly-value">' + esc(this.documentTypeLabel(upload.documentType)) + "</strong></div>"
			: '<label class="fv2-field fv2-select-field"><span>Document type</span><select data-fv2-upload-type data-fv2-overlay-focus="upload-type" required><option value="">Choose a document type</option>' + this.uploadTypeOptionsMarkup(upload.documentType) + "</select></label>";
		var nameField = this.documentNameRequiresInput(upload.documentType)
			? '<label class="fv2-field"><span>Document name</span><input type="text" maxlength="140" required value="' + escAttr(upload.displayName) + '" data-fv2-upload-name data-fv2-overlay-focus="upload-name" placeholder="Name this document"></label>'
			: '<div class="fv2-field"><span>Document name</span><strong class="fv2-readonly-value">' + esc(upload.displayName || this.canonicalDocumentName(upload.documentType)) + '</strong><small>Standardized automatically</small></div>';
		var programField = '<label class="fv2-field fv2-select-field"><span>Course / program</span><select required data-fv2-upload-program data-fv2-overlay-focus="upload-program"><option value="">Choose course / program</option>' + PROGRAM_OPTIONS.map(function (program) { return '<option value="' + escAttr(program) + '"' + (program === upload.program ? " selected" : "") + '>' + esc(program) + '</option>'; }).join("") + '</select><small>Used to organize your private document.</small></label>';
		var sessionField = '<label class="fv2-field fv2-select-field"><span>Session letter</span><select required data-fv2-upload-session data-fv2-overlay-focus="upload-session"><option value="">Choose session</option>' + SESSION_OPTIONS.map(function (session) { return '<option value="' + session + '"' + (upload.sessionLetter === session ? " selected" : "") + '>Session ' + session + '</option>'; }).join("") + '</select><small>Preselected from your student profile when known.</small></label>';
		var candidates = upload.forcedVersion ? [] : this.uploadReplacementCandidates(upload.documentType);
		var replacementField = candidates.length
			? '<label class="fv2-field fv2-field-wide fv2-select-field"><span>Continue an existing document?</span><select data-fv2-upload-replaces data-fv2-overlay-focus="upload-replaces">' + candidates.map(function (documentItem) { return '<option value="' + positiveInt(documentItem.id) + '"' + (positiveInt(documentItem.id) === upload.replacesDocumentId ? " selected" : "") + '>Yes — continue ' + esc(documentItem.name || "Document") + ' · Version ' + esc(Math.max(1, positiveInt(documentItem.version))) + '</option>'; }).join("") + '<option value=""' + (!upload.replacesDocumentId ? " selected" : "") + '>No — create a separate document</option></select><small>Your earlier versions always remain available.</small></label>'
			: "";
		var ready = this.capability("submit") ? '<label class="fv2-check-row"><input type="checkbox" data-fv2-upload-ready' + (upload.readyForReview ? " checked" : "") + '><span>' + icon("check") + '</span><div><strong>Ready for review</strong><small>Submit this confirmed version to the staff review queue after upload.</small></div></label>' : "";
		var missionShare = this.role() === "admin" && this.capability("share_mission_file") && !upload.documentId && !upload.shareSource ? '<label class="fv2-check-row fv2-mission-share"><input type="checkbox" data-fv2-upload-mission-file' + (upload.shareAsMissionFile ? " checked" : "") + '><span>' + icon("library") + '</span><div><strong>Share as a Mission File</strong><small>MissionMed provenance is recorded and the student receives this in Shared by MissionMed, not as a student-owned upload.</small></div></label>' : "";
		var versionField = '<div class="fv2-field fv2-version-assignment" data-fv2-upload-version aria-label="Version assigned automatically"><span>Version</span><strong>Version ' + esc(Math.max(1, positiveInt(upload.version))) + '</strong><small>Assigned automatically from this document\'s history.</small></div>';
		var finalField = '<label class="fv2-check-row fv2-final-version"><input type="checkbox" data-fv2-upload-final data-fv2-overlay-focus="upload-final"' + (upload.isFinal ? " checked" : "") + '><span>' + icon("check") + '</span><div><strong>Mark this version Final</strong><small>Final is a status marker. It does not replace the version number or delete prior versions.</small></div></label>';
		var audience = upload.shareSource ? this.shareAudienceMarkup(upload) : "";
		return '<div class="fv2-upload-dropzone' + (file ? " has-file" : "") + '" data-fv2-dropzone><button type="button" class="fv2-upload-file-field" data-fv2-action="choose-upload-file" data-fv2-overlay-focus="choose-file"><span class="fv2-dropzone-icon">' + icon("upload") + '</span><span><strong>' + (file ? 'Change selected file' : 'Choose a file') + '</strong><small>Click to browse or drag and drop</small></span></button><input id="fv2-upload-file" type="file" tabindex="-1" aria-label="Upload file" accept="' + escAttr(this.uploadAccept(contract)) + '" data-fv2-upload-file>' + fileSummary + '</div><div class="fv2-form-grid">' + typeField + nameField + '<div class="fv2-field"><span>Division</span><strong class="fv2-readonly-value">' + esc(upload.division || "Not recorded") + '</strong><small>From your MissionMed account</small></div>' + programField + sessionField + versionField + replacementField + '</div>' + finalField + '<label class="fv2-field"><span>' + (upload.shareSource ? "Description (optional)" : "Note to advisor (optional)") + '</span><textarea rows="3" maxlength="1000" data-fv2-upload-note placeholder="' + (upload.shareSource ? "What should recipients know about this file?" : "What changed, or what should your advisor know?") + '">' + esc(upload.note) + '</textarea></label><section class="fv2-canonical-preview"><span>Filename preview</span><strong data-fv2-canonical-preview>' + esc(this.canonicalFilenamePreview()) + '</strong><small>MissionMed confirms the final name and next version before the upload begins.</small></section>' + ready + missionShare + audience + '<div class="fv2-modal-actions"><button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="close-overlay">Cancel</button><button type="button" class="fv2-button fv2-button-primary" data-fv2-action="upload-next" data-fv2-upload-next' + (this.uploadStepOneError() ? " disabled" : "") + ">Review" + icon("arrowRight") + "</button></div>";
	};

	FileVaultV2.prototype.shareAudienceMarkup = function (upload) {
		if (this.state.audiencesLoading) return this.stateMessageMarkup("loading", "Loading eligible audiences", "Only current enrollment records will be shown.", "");
		if (this.state.audiencesError) return this.stateMessageMarkup("error", "Sharing audiences unavailable", this.state.audiencesError, "");
		var directory = this.state.audiences || { groups: [], students: [], policy: {} };
		var modes = [];
		if (upload.shareSource === "missionmed" && directory.policy && directory.policy.all_eligible) modes.push(["all_eligible", "All eligible students"]);
		if (directory.policy && directory.policy.groups) modes.push(["groups", "Selected programs / groups"]);
		if (directory.policy && directory.policy.individuals) modes.push(["selected", "Selected students"]);
		var groupChoices = upload.audienceMode === "groups" ? '<div class="fv2-audience-checks">' + directory.groups.map(function (group) { var id = positiveInt(group.id); return '<label><input type="checkbox" data-fv2-share-group value="' + id + '"' + (upload.groupIds.indexOf(id) !== -1 ? " checked" : "") + '><span>' + esc(group.label || "Program") + '</span></label>'; }).join("") + '</div>' : "";
		var studentChoices = upload.audienceMode === "selected" ? '<label class="fv2-field fv2-audience-search"><span>Find an enrolled student</span><input type="search" data-fv2-audience-search data-fv2-overlay-focus="audience-search" value="' + escAttr(this.state.audienceSearch) + '" placeholder="Search by name or program"></label><div class="fv2-audience-result-count">' + esc(directory.students.length) + ' matching students loaded · ' + esc(upload.userIds.length) + ' selected</div><div class="fv2-audience-checks fv2-audience-students">' + directory.students.map(function (student) { var id = positiveInt(student.id); return '<label><input type="checkbox" data-fv2-share-student value="' + id + '"' + (upload.userIds.indexOf(id) !== -1 ? " checked" : "") + '><span><strong>' + esc(student.display_name || "Student") + '</strong><small>' + esc(student.program_label || "Current enrollment") + '</small></span></label>'; }).join("") + '</div>' + (directory.pagination && directory.pagination.has_more ? '<button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="load-more-audiences">Load more students</button>' : '') : "";
		return '<section class="fv2-share-audience"><span>Who can access this file?</span><label class="fv2-field fv2-select-field"><span>Audience</span><select data-fv2-share-audience data-fv2-overlay-focus="share-audience">' + modes.map(function (mode) { return '<option value="' + mode[0] + '"' + (upload.audienceMode === mode[0] ? " selected" : "") + '>' + esc(mode[1]) + '</option>'; }).join("") + '</select></label>' + groupChoices + studentChoices + '<small>Access is rechecked against current enrollment every time the file is opened.</small></section>';
	};

	FileVaultV2.prototype.uploadReviewMarkup = function () {
		var upload = this.state.upload;
		var file = upload.file;
		var versionLabel = "Version " + esc(upload.version) + (upload.isFinal ? " · Final" : "");
		var audienceLabel = upload.audienceMode === "all_eligible" ? "All eligible students" : (upload.audienceMode === "groups" ? upload.groupIds.length + " selected group" + (upload.groupIds.length === 1 ? "" : "s") : upload.userIds.length + " selected student" + (upload.userIds.length === 1 ? "" : "s"));
		var afterUpload = upload.shareSource ? "Publish to " + audienceLabel : (upload.shareAsMissionFile ? "Share as a Mission File" : (upload.readyForReview ? "Send to staff review" : "Keep in Your Files"));
		return '<section class="fv2-upload-review"><span>Ready when you are</span><h2>' + esc(upload.displayName || "Document") + '</h2><dl><div><dt>Original file</dt><dd>' + esc(file ? file.name : "No file") + "</dd></div><div><dt>Size</dt><dd>" + esc(file ? formatSize(file.size) : "0 B") + "</dd></div><div><dt>Type</dt><dd>" + esc(this.documentTypeLabel(upload.documentType)) + "</dd></div><div><dt>Course / session</dt><dd>" + esc(upload.program + " / " + upload.sessionLetter) + "</dd></div><div><dt>Next version</dt><dd>" + versionLabel + "</dd></div><div><dt>After upload</dt><dd>" + esc(afterUpload) + "</dd></div></dl><div class=\"fv2-review-note fv2-review-filename\"><span>Filename preview</span><p>" + esc(upload.canonicalName || this.canonicalFilenamePreview()) + "</p></div>" + (upload.note ? '<div class="fv2-review-note"><span>' + (upload.shareSource ? "Recipient description" : "Note to advisor") + '</span><p>' + esc(upload.note).replace(/\n/g, "<br>") + "</p></div>" : "") + '<p class="fv2-security-copy">' + icon("lock") + (upload.shareSource ? " The source remains private in R2. Access is granted by current server-owned audience rules." : " Your file stays private. MissionMed verifies it before adding it to Your Files.") + '</p></section><div class="fv2-modal-actions"><button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="upload-back">' + icon("arrowLeft") + 'Back</button><button type="button" class="fv2-button fv2-button-primary" data-fv2-action="upload-start">' + icon("upload") + (upload.shareSource ? "Upload and publish" : "Upload securely") + "</button></div>";
	};

	FileVaultV2.prototype.uploadProgressMarkup = function () {
		var upload = this.state.upload;
		if (upload.phase === "success" && upload.result) {
			var result = upload.result;
			var resultVersion = Math.max(1, positiveInt(result.version));
			var successActions = upload.shareSource
				? '<button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="upload-another">' + icon("upload") + 'Share another</button><button type="button" class="fv2-button fv2-button-primary" data-fv2-action="upload-open-shares">Open shared files</button>'
				: '<button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="upload-another">' + icon("upload") + 'Upload another</button><button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="upload-open-files">Open Your Files</button><button type="button" class="fv2-button fv2-button-primary" data-fv2-action="upload-view-document" data-fv2-document-id="' + positiveInt(result.id) + '">' + icon("file") + 'View document</button>';
			return '<section class="fv2-upload-celebration" role="status"><span class="fv2-celebration-mark">' + icon("check") + '</span><span class="fv2-celebration-kicker">' + (upload.shareSource ? "Private share confirmed" : "Private upload confirmed") + '</span><h2>' + (upload.shareSource ? "Your file is verified and shared." : "Your document is safely in the Vault.") + '</h2><p>' + esc(result.name || upload.displayName || "Document") + ' is now Version ' + esc(resultVersion) + (result.is_final ? " and marked Final" : "") + '.</p><div class="fv2-celebration-facts"><span>' + icon("lock") + '<strong>Private</strong><small>Only the approved audience can open it</small></span><span>' + icon("check") + '<strong>Verified</strong><small>Stored and confirmed by MissionMed</small></span><span>' + icon("journey") + '<strong>Version ' + esc(resultVersion) + '</strong><small>Earlier versions remain available</small></span></div><div class="fv2-celebration-name"><span>Saved as</span><strong>' + esc(result.filename || upload.canonicalName || result.name || "Document") + '</strong></div></section><div class="fv2-modal-actions fv2-celebration-actions">' + successActions + '</div>';
		}
		var phaseCopy = {
			idle: ["Ready to upload", "Your private upload begins after review."],
			hashing: ["Checking your file", "MissionMed is preparing your document for secure upload."],
			signing: ["Preparing private upload", "MissionMed is creating a protected connection for your document."],
			transferring: ["Uploading securely", "Keep this window open while your document uploads."],
			confirming: ["Verifying upload", "MissionMed is checking the stored object and finalizing the record."],
			success: ["Upload confirmed", "Your document is safely in the Vault."],
			aborted: ["Upload stopped", "The active transfer was canceled. You can retry safely."],
			error: ["Upload not completed", upload.error || "The secure upload could not be completed."]
		};
		var copy = phaseCopy[upload.phase] || phaseCopy.idle;
		var active = ["hashing", "signing", "transferring", "confirming"].indexOf(upload.phase) !== -1;
		var stateIcon = upload.phase === "success" ? "check" : (upload.phase === "error" || upload.phase === "aborted" ? "alert" : "upload");
		var actions = "";
		if (active) actions = '<button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="upload-abort">Stop upload</button>';
		else if (upload.phase === "success") actions = '<button type="button" class="fv2-button fv2-button-primary" data-fv2-action="upload-done">Done</button>';
		else if (upload.phase === "error" || upload.phase === "aborted") actions = '<button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="upload-restart">Review details</button><button type="button" class="fv2-button fv2-button-primary" data-fv2-action="upload-retry">' + icon("refresh") + "Retry</button>";
		else actions = '<button type="button" class="fv2-button fv2-button-primary" data-fv2-action="upload-start">Start upload</button>';
		return '<section class="fv2-upload-progress fv2-upload-' + escAttr(upload.phase) + '" role="status"><span class="fv2-upload-state-icon">' + icon(stateIcon) + "</span><h2>" + esc(copy[0]) + "</h2><p>" + esc(copy[1]) + '</p><div class="fv2-transfer-bar" role="progressbar" aria-label="Upload progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + boundedInt(upload.progress, 0, 100) + '"><span data-fv2-progress-bar style="width:' + boundedInt(upload.progress, 0, 100) + '%"></span></div><strong data-fv2-progress-text>' + boundedInt(upload.progress, 0, 100) + '%</strong>' + (upload.result ? '<div class="fv2-upload-result">' + statusBadge(upload.result.status, upload.result.status_label) + "<span>v" + esc(Math.max(1, positiveInt(upload.result.version))) + " recorded</span></div>" : "") + '</section><div class="fv2-modal-actions">' + actions + "</div>";
	};

	FileVaultV2.prototype.uploadTypeOptionsMarkup = function (selected) {
		var labels = Object.assign({}, this.state.data && this.state.data.document_types || {});
		var journey = this.state.data && this.state.data.journey;
		(Array.isArray(journey && journey.items) ? journey.items : []).forEach(function (item) {
			if (item.document_type) labels[item.document_type] = item.label || item.document_type;
		});
		(this.state.data && Array.isArray(this.state.data.documents) ? this.state.data.documents : []).forEach(function (documentItem) {
			if (documentItem.document_type && !labels[documentItem.document_type]) labels[documentItem.document_type] = documentItem.name || documentItem.document_type;
		});
		labels.other = labels.other || "Other Document";
		return Object.keys(labels).map(function (key) {
			return '<option value="' + escAttr(key) + '"' + (key === selected ? " selected" : "") + ">" + esc(labels[key]) + "</option>";
		}).join("");
	};

	FileVaultV2.prototype.documentTypeLabel = function (type) {
		var labels = this.state.data && this.state.data.document_types;
		if (labels && labels[type]) return String(labels[type]);
		var journey = this.state.data && this.state.data.journey;
		var match = (Array.isArray(journey && journey.items) ? journey.items : []).find(function (item) { return item.document_type === type; });
		if (match && match.label) return match.label;
		var documentItem = this.state.data && Array.isArray(this.state.data.documents) ? this.state.data.documents.find(function (candidate) { return candidate.document_type === type; }) : null;
		return documentItem && documentItem.name ? documentItem.name : (type === "other" ? "Other Document" : String(type || "Document").replace(/_/g, " "));
	};

	FileVaultV2.prototype.documentNameRequiresInput = function (type) {
		return CUSTOM_NAME_TYPES.indexOf(String(type || "")) !== -1;
	};

	FileVaultV2.prototype.canonicalDocumentName = function (type) {
		return this.documentNameRequiresInput(type) ? "" : String(this.documentTypeLabel(type) || "Document");
	};

	FileVaultV2.prototype.uploadContext = function () {
		var context = this.state.data && this.state.data.upload_context;
		return context && typeof context === "object" && !Array.isArray(context) ? context : {};
	};

	FileVaultV2.prototype.uploadReplacementCandidates = function (documentType) {
		if (!documentType) return [];
		return this.studentDocuments().filter(function (documentItem) {
			return String(documentItem.document_type || "other") === documentType;
		}).sort(function (left, right) {
			return positiveInt(right.version) - positiveInt(left.version) || positiveInt(right.id) - positiveInt(left.id);
		});
	};

	FileVaultV2.prototype.preferredUploadReplacement = function (documentType, displayName) {
		var candidates = this.uploadReplacementCandidates(documentType);
		if (!candidates.length) return null;
		var normalizedName = String(displayName || "").trim().toLowerCase();
		var exact = normalizedName ? candidates.find(function (documentItem) {
			return String(documentItem.name || "").trim().toLowerCase() === normalizedName;
		}) : null;
		if (exact) return exact;
		return this.documentNameRequiresInput(documentType) ? null : candidates[0];
	};

	FileVaultV2.prototype.applyUploadReplacement = function (replacement) {
		var upload = this.state.upload;
		if (!upload) return;
		upload.replacesDocumentId = replacement ? positiveInt(replacement.id) : 0;
		upload.documentId = upload.replacesDocumentId;
		upload.version = replacement ? Math.max(1, positiveInt(replacement.version) + 1) : 1;
		upload.draftLabel = "Version" + String(upload.version).padStart(2, "0");
		if (replacement && (upload.forcedVersion || this.documentNameRequiresInput(upload.documentType))) {
			upload.displayName = String(replacement.name || upload.displayName);
		}
	};

	FileVaultV2.prototype.syncUploadLineage = function () {
		var upload = this.state.upload;
		if (!upload || upload.forcedVersion || upload.replacementChoiceTouched) return;
		this.applyUploadReplacement(this.preferredUploadReplacement(upload.documentType, upload.displayName));
	};

	FileVaultV2.prototype.canonicalFilenameToken = function (value, fallback) {
		value = String(value || "").normalize ? String(value || "").normalize("NFKD") : String(value || "");
		value = value.replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "").slice(0, 60);
		return value || fallback;
	};

	FileVaultV2.prototype.canonicalFilenamePreview = function () {
		var upload = this.state.upload || {};
		var context = this.uploadContext();
		var identity = context.identity && typeof context.identity === "object" ? context.identity : {};
		var label = this.documentNameRequiresInput(upload.documentType) ? upload.displayName : this.documentTypeLabel(upload.documentType);
		var fileName = String(upload.file && upload.file.name || "");
		var extension = fileName.indexOf(".") !== -1 ? fileName.split(".").pop().toLowerCase() : "ext";
		return [
			this.canonicalFilenameToken(identity.first_name, "Student"),
			this.canonicalFilenameToken(identity.last_name, "User"),
			this.canonicalFilenameToken(upload.program, "MissionMed"),
			this.canonicalFilenameToken(upload.sessionLetter, "X"),
			this.canonicalFilenameToken(label, "Document"),
			this.canonicalFilenameToken(upload.draftLabel || ("Version" + String(Math.max(1, positiveInt(upload.version))).padStart(2, "0")), "Version01"),
			/^\d{4}-\d{2}-\d{2}$/.test(String(upload.submissionDate || "")) ? String(upload.submissionDate) : new Date().toISOString().slice(0, 10)
		].join("_") + "." + extension;
	};

	FileVaultV2.prototype.uploadContract = function (documentType) {
		var storage = this.state.data && this.state.data.storage || {};
		var contracts = storage.contracts && typeof storage.contracts === "object" ? storage.contracts : {};
		var fallback = documentType === "application_photo"
			? { extensions: ["jpg", "jpeg"], max_file_size: 153600 }
			: { extensions: documentType ? ["pdf", "docx", "png"] : ACCEPTED_EXTENSIONS, max_file_size: Number(storage.max_file_size) || Number(this.config.maxFileSize) || 26214400 };
		var source = documentType ? (contracts[documentType] || contracts.default || fallback) : fallback;
		var extensions = Array.isArray(source.extensions) ? source.extensions.map(function (extension) { return String(extension).toLowerCase(); }).filter(function (extension) { return ACCEPTED_EXTENSIONS.indexOf(extension) !== -1; }) : fallback.extensions;
		return {
			extensions: extensions.length ? extensions : fallback.extensions,
			maxFileSize: Math.max(1, Number(source.max_file_size) || fallback.max_file_size)
		};
	};

	FileVaultV2.prototype.uploadAccept = function (contract) {
		var values = [];
		(contract.extensions || []).forEach(function (extension) {
			values.push("." + extension);
			if (MIME_FALLBACKS[extension] && values.indexOf(MIME_FALLBACKS[extension]) === -1) values.push(MIME_FALLBACKS[extension]);
		});
		return values.join(",");
	};

	FileVaultV2.prototype.maxFileSize = function (documentType) {
		if (documentType) return this.uploadContract(documentType).maxFileSize;
		var fromBootstrap = this.state.data && this.state.data.storage && Number(this.state.data.storage.max_file_size);
		var fromConfig = Number(this.config.maxFileSize);
		return Math.max(1, fromBootstrap || fromConfig || 26214400);
	};

	FileVaultV2.prototype.validateFile = function (file, documentType) {
		if (!file) return "Choose a file.";
		var rawName = String(file.name || "");
		var extension = rawName.split(".").pop().toLowerCase();
		var stem = rawName.slice(0, -(extension.length + 1));
		var contract = this.uploadContract(documentType);
		if (rawName.length > 180 || /[\u0000-\u001f\u007f\\/]/.test(rawName) || /[\u202a-\u202e\u2066-\u2069]/i.test(rawName) || stem.indexOf(".") !== -1) return "Choose a filename with one safe extension.";
		if (contract.extensions.indexOf(extension) === -1) return documentType === "application_photo" ? "Choose a JPEG application photo." : "Unsupported file type.";
		var mime = this.mimeForFile(file);
		if (mime !== MIME_FALLBACKS[extension]) return "The file MIME type does not match its extension.";
		if (!file.size || file.size > contract.maxFileSize) return "File must be between 1 byte and " + formatSize(contract.maxFileSize) + ".";
		return "";
	};

	FileVaultV2.prototype.uploadStepOneError = function () {
		var upload = this.state.upload;
		if (!upload) return "Upload is unavailable.";
		var audienceError = upload.shareSource && this.state.audiencesError ? this.state.audiencesError : "";
		if (upload.shareSource && this.state.audiencesLoading) audienceError = "Wait for eligible sharing audiences to load.";
		if (upload.shareSource && upload.audienceMode === "groups" && !upload.groupIds.length) audienceError = "Choose at least one eligible program or group.";
		if (upload.shareSource && upload.audienceMode === "selected" && !upload.userIds.length) audienceError = "Choose at least one eligible student.";
		return this.validateFile(upload.file, upload.documentType) || (!upload.documentType ? "Choose a document type." : "") || (!upload.displayName.trim() ? "Enter a document name." : "") || (PROGRAM_OPTIONS.indexOf(upload.program) === -1 ? "Choose a MissionMed course or program." : "") || (SESSION_OPTIONS.indexOf(upload.sessionLetter) === -1 ? "Choose session A through G." : "") || audienceError;
	};

	FileVaultV2.prototype.updateUploadNextButton = function () {
		var button = this.refs.overlay && this.refs.overlay.querySelector("[data-fv2-upload-next]");
		if (button) button.disabled = !!this.uploadStepOneError();
	};

	FileVaultV2.prototype.updateShareAudienceControls = function () {
		this.updateUploadNextButton();
		var upload = this.state.upload;
		var resultCount = this.refs.overlay && this.refs.overlay.querySelector(".fv2-audience-result-count");
		if (!upload || !resultCount) return;
		var directory = this.state.audiences || { students: [] };
		resultCount.textContent = directory.students.length + " matching students loaded · " + upload.userIds.length + " selected";
	};

	FileVaultV2.prototype.advanceUpload = function () {
		var message = this.uploadStepOneError();
		if (message) {
			this.toast("Upload details incomplete", message, "error");
			return;
		}
		this.state.upload.step = 2;
		this.renderOverlay();
	};

	FileVaultV2.prototype.mimeForFile = function (file) {
		var extension = String(file && file.name || "").split(".").pop().toLowerCase();
		return String(file && file.type || MIME_FALLBACKS[extension] || "application/octet-stream");
	};

	FileVaultV2.prototype.computeFileSha256 = function (file, signal) {
		var self = this;
		if (this.hashFileFactory) {
			return Promise.resolve(this.hashFileFactory({ file: file, signal: signal })).then(function (hash) {
				hash = String(hash || "").toLowerCase();
				if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("The fixture checksum provider returned an invalid SHA-256 value.");
				return hash;
			});
		}
		if (!window.crypto || !window.crypto.subtle || typeof window.crypto.subtle.digest !== "function") {
			return Promise.reject(new Error("This browser cannot calculate the required SHA-256 checksum."));
		}
		return this.readFileBuffer(file, signal).then(function (buffer) {
			if (signal && signal.aborted) {
				var aborted = new Error("Checksum calculation was stopped.");
				aborted.name = "AbortError";
				throw aborted;
			}
			return window.crypto.subtle.digest("SHA-256", buffer);
		}).then(function (digest) {
			if (signal && signal.aborted) {
				var aborted = new Error("Checksum calculation was stopped.");
				aborted.name = "AbortError";
				throw aborted;
			}
			return Array.prototype.map.call(new Uint8Array(digest), function (byte) {
				return byte.toString(16).padStart(2, "0");
			}).join("");
		}).then(function (hash) {
			if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("The browser produced an invalid SHA-256 checksum.");
			return hash;
		}).catch(function (error) {
			if (self.destroyed && (!error || error.name !== "AbortError")) {
				var aborted = new Error("Checksum calculation was stopped.");
				aborted.name = "AbortError";
				throw aborted;
			}
			throw error;
		});
	};

	FileVaultV2.prototype.readFileBuffer = function (file, signal) {
		if (file && typeof file.arrayBuffer === "function") return file.arrayBuffer();
		return new Promise(function (resolve, reject) {
			var reader = new window.FileReader();
			var abortFromSignal = function () { if (reader.readyState === 1) reader.abort(); };
			reader.onload = function () { resolve(reader.result); };
			reader.onerror = function () { reject(new Error("The selected file could not be read for checksum calculation.")); };
			reader.onabort = function () {
				var error = new Error("Checksum calculation was stopped.");
				error.name = "AbortError";
				reject(error);
			};
			if (signal && typeof signal.addEventListener === "function") {
				if (signal.aborted) {
					var aborted = new Error("Checksum calculation was stopped.");
					aborted.name = "AbortError";
					reject(aborted);
					return;
				}
				signal.addEventListener("abort", abortFromSignal, { once: true });
			}
			reader.readAsArrayBuffer(file);
		});
	};

	FileVaultV2.prototype.startUpload = function (startAt) {
		var self = this;
		var upload = this.state.upload;
		if (!upload || upload.active) return;
		var studentContext = this.captureStudentContext();
		var validation = this.uploadStepOneError();
		if (validation) {
			this.toast("Upload details incomplete", validation, "error");
			return;
		}
		upload.step = 3;
		upload.active = true;
		upload.abortRequested = false;
		upload.error = "";
		upload.controller = typeof window.AbortController === "function" ? new window.AbortController() : null;
		if (startAt === "sign") {
			upload.intent = null;
			upload.progress = 0;
		}

		function assertStudentContext() {
			if (self.studentContextMatches(studentContext)) return;
			var error = new Error("The selected student Vault changed during upload.");
			error.name = "AbortError";
			throw error;
		}

		function hash() {
			assertStudentContext();
			upload.currentStage = "hash";
			upload.retryStage = "hash";
			upload.phase = "hashing";
			upload.progress = 0;
			self.renderOverlay();
			return self.computeFileSha256(upload.file, upload.controller && upload.controller.signal).then(function (sha256) {
				assertStudentContext();
				upload.sha256 = sha256;
				return sign();
			});
		}

		function sign() {
			assertStudentContext();
			upload.currentStage = "sign";
			upload.retryStage = "sign";
			upload.phase = "signing";
			self.renderOverlay();
			var file = upload.file;
			var payload = {
				filename: file.name,
				mime_type: self.mimeForFile(file),
				file_size: file.size,
				sha256: upload.sha256,
				document_type: upload.documentType || "other",
				display_name: upload.displayName.trim(),
				program: upload.program.trim(),
				session_letter: upload.sessionLetter,
				is_final: !!upload.isFinal,
				note: upload.note.trim(),
				ready_for_review: !!upload.readyForReview,
				share_as_mission_file: !!upload.shareAsMissionFile,
				share_source: upload.shareSource || undefined
			};
			if (self.roleIsStaff() && !upload.shareSource && studentContext.studentId) payload.student_id = studentContext.studentId;
			var path = upload.documentId ? "/files/" + upload.documentId + "/versions" : "/uploads";
			return self.request("POST", path, payload, null, upload.controller && upload.controller.signal).then(function (intent) {
				assertStudentContext();
				if (!intent || !/^[a-f0-9-]{36}$/i.test(String(intent.upload_id || "")) || !/^[a-f0-9]{64}$/i.test(String(intent.confirm_token || "")) || !intent.upload_url || !intent.required_headers || typeof intent.required_headers !== "object") {
					throw new Error("The upload intent did not include the required secure fields.");
				}
				upload.intent = intent;
				upload.version = Math.max(1, positiveInt(intent.version));
				upload.draftLabel = "Version" + String(upload.version).padStart(2, "0");
				upload.canonicalName = String(intent.canonical_name || upload.canonicalName || self.canonicalFilenamePreview());
				return put();
			});
		}

		function put() {
			assertStudentContext();
			if (!upload.intent || !upload.intent.upload_url) throw new Error("The upload intent did not include a signed URL.");
			upload.currentStage = "put";
			upload.retryStage = "put";
			upload.phase = "transferring";
			upload.progress = 0;
			self.renderOverlay();
			var transfer = self.createUploadTransfer(upload.intent.upload_url, upload.file, upload.intent.required_headers, function (percent) {
				if (!self.studentContextMatches(studentContext) || self.state.upload !== upload) return;
				upload.progress = boundedInt(percent, 0, 100);
				var bar = self.refs.overlay && self.refs.overlay.querySelector("[data-fv2-progress-bar]");
				var text = self.refs.overlay && self.refs.overlay.querySelector("[data-fv2-progress-text]");
				var progress = self.refs.overlay && self.refs.overlay.querySelector('[role="progressbar"]');
				if (bar) bar.style.width = upload.progress + "%";
				if (text) text.textContent = upload.progress + "%";
				if (progress) progress.setAttribute("aria-valuenow", String(upload.progress));
			}, upload.controller && upload.controller.signal);
			upload.transfer = transfer;
			self.transfers.add(transfer);
			return transfer.promise.then(function () {
				assertStudentContext();
				self.transfers.delete(transfer);
				upload.transfer = null;
				upload.progress = 100;
				return confirm();
			}, function (error) {
				self.transfers.delete(transfer);
				upload.transfer = null;
				throw error;
			});
		}

		function confirm() {
			assertStudentContext();
			upload.currentStage = "confirm";
			upload.retryStage = "confirm";
			upload.phase = "confirming";
			upload.progress = 100;
			self.renderOverlay();
			return self.request("POST", "/uploads/" + encodeURIComponent(upload.intent.upload_id) + "/confirm", { confirm_token: upload.intent.confirm_token }, null, upload.controller && upload.controller.signal).then(function (documentItem) {
				assertStudentContext();
				upload.result = documentItem;
				return upload.shareSource ? publish(documentItem) : finish(documentItem);
			});
		}

		function publish(documentItem) {
			assertStudentContext();
			upload.currentStage = "publish";
			upload.retryStage = "publish";
			upload.phase = "confirming";
			self.renderOverlay();
			return self.request("POST", "/shares", {
				file_id: positiveInt(documentItem.id),
				title: upload.displayName.trim(),
				description: upload.note.trim(),
				category: upload.documentType || "resource",
				audience_mode: upload.audienceMode,
				group_ids: upload.groupIds,
				user_ids: upload.userIds
			}, null, upload.controller && upload.controller.signal).then(function (share) {
				assertStudentContext();
				upload.shareResult = share;
				return finish(documentItem);
			});
		}

		function finish(documentItem) {
				assertStudentContext();
				upload.phase = "success";
				upload.retryStage = "";
				upload.progress = 100;
				self.state.selectedDocumentId = positiveInt(documentItem.id);
				self.state.documentDetail = documentItem;
				self.upsertDocument(documentItem);
				self.render();
				self.renderOverlay();
				self.toast(upload.shareSource ? "File published" : "Upload confirmed", upload.shareSource ? "The approved audience can now access this verified file." : String(documentItem.name || "Document") + " v" + String(documentItem.version || 1) + " is recorded.", "success");
				self.playSuccessSound();
				return upload.shareSource ? self.loadShares(upload.shareSource, true) : self.refreshAfterMutation(studentContext);
		}

		var run = startAt === "publish" ? publish(upload.result) : (startAt === "confirm" ? confirm() : (startAt === "put" ? put() : (upload.sha256 && startAt !== "hash" ? sign() : hash())));
		Promise.resolve(run).catch(function (error) {
			if (!self.studentContextMatches(studentContext) || self.state.upload !== upload) return;
			if (upload.abortRequested || (error && error.name === "AbortError")) {
				upload.phase = "aborted";
				upload.error = "The upload was stopped.";
				upload.retryStage = upload.intent ? "put" : "sign";
			} else {
				upload.phase = "error";
				upload.error = errorMessage(error, "The secure upload could not be completed.");
				upload.retryStage = upload.currentStage || "sign";
			}
			self.renderOverlay();
		}).finally(function () {
			if (!self.studentContextMatches(studentContext) || self.state.upload !== upload) return;
			upload.active = false;
			upload.controller = null;
			upload.transfer = null;
		});
	};

	FileVaultV2.prototype.createUploadTransfer = function (url, file, requiredHeaders, onProgress, signal) {
		var safeUrl = this.safeUploadUrl(url);
		var headers = this.normalizeRequiredHeaders(requiredHeaders);
		var contentType = "";
		Object.keys(headers).some(function (name) {
			if (name.toLowerCase() !== "content-type") return false;
			contentType = headers[name];
			return true;
		});
		if (contentType !== this.mimeForFile(file)) throw new Error("The signed upload Content-Type does not match the selected file.");
		if (this.uploadFactory) {
			var supplied = this.uploadFactory({ url: safeUrl, file: file, mimeType: this.mimeForFile(file), requiredHeaders: headers, onProgress: onProgress, signal: signal });
			if (supplied && supplied.promise && typeof supplied.abort === "function") return supplied;
			if (supplied && typeof supplied.then === "function") return { promise: supplied, abort: function () {} };
			throw new Error("The fixture upload transport must return { promise, abort }.");
		}
		var xhr = new window.XMLHttpRequest();
		var abortFromSignal = null;
		var promise = new Promise(function (resolve, reject) {
			xhr.open("PUT", safeUrl, true);
			xhr.withCredentials = false;
			Object.keys(headers).forEach(function (name) { xhr.setRequestHeader(name, headers[name]); });
			xhr.upload.addEventListener("progress", function (event) {
				if (event.lengthComputable && event.total > 0) onProgress(Math.round((event.loaded / event.total) * 100));
			});
			xhr.addEventListener("load", function () {
				if (xhr.status >= 200 && xhr.status < 300) resolve();
				else reject(new Error("Private storage rejected the upload (" + xhr.status + ")."));
			});
			xhr.addEventListener("error", function () { reject(new Error("The private storage transfer failed.")); });
			xhr.addEventListener("timeout", function () { reject(new Error("The private storage transfer timed out.")); });
			xhr.addEventListener("abort", function () {
				var error = new Error("The upload was stopped.");
				error.name = "AbortError";
				reject(error);
			});
			xhr.timeout = 20 * 60 * 1000;
			if (signal && typeof signal.addEventListener === "function") {
				abortFromSignal = function () { xhr.abort(); };
				if (signal.aborted) abortFromSignal();
				else signal.addEventListener("abort", abortFromSignal, { once: true });
			}
			xhr.send(file);
		});
		promise = promise.finally(function () {
			if (signal && abortFromSignal && typeof signal.removeEventListener === "function") signal.removeEventListener("abort", abortFromSignal);
		});
		return { promise: promise, abort: function () { if (xhr.readyState !== 4) xhr.abort(); } };
	};

	FileVaultV2.prototype.safeUploadUrl = function (value) {
		try {
			var url = new URL(String(value || ""), window.location.href);
			var localHarness = this.options.harness && url.protocol === "http:" && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname);
			if (url.protocol !== "https:" && !localHarness) throw new Error("The signed upload URL uses an unsafe protocol.");
			return url.toString();
		} catch (error) {
			throw new Error("The server returned an invalid signed upload URL.");
		}
	};

	FileVaultV2.prototype.normalizeRequiredHeaders = function (requiredHeaders) {
		if (!requiredHeaders || typeof requiredHeaders !== "object" || Array.isArray(requiredHeaders)) throw new Error("The upload intent did not include required PUT headers.");
		var normalized = {};
		Object.keys(requiredHeaders).forEach(function (name) {
			var value = String(requiredHeaders[name]);
			if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) || /[\r\n]/.test(value)) throw new Error("The upload intent included an invalid required header.");
			normalized[name] = value;
		});
		var lower = {};
		Object.keys(normalized).forEach(function (name) { lower[name.toLowerCase()] = normalized[name]; });
		if (!lower["content-type"] || !/^[A-Za-z0-9+/.-]+$/.test(lower["content-type"])) throw new Error("The upload intent did not bind Content-Type.");
		if (!lower["x-amz-checksum-sha256"] || !/^[A-Za-z0-9+/]{43}=$/.test(lower["x-amz-checksum-sha256"])) throw new Error("The upload intent did not bind SHA-256.");
		return normalized;
	};

	FileVaultV2.prototype.abortUpload = function (silent) {
		var upload = this.state.upload;
		if (!upload) return;
		upload.abortRequested = true;
		if (upload.controller && typeof upload.controller.abort === "function") upload.controller.abort();
		if (upload.transfer && typeof upload.transfer.abort === "function") upload.transfer.abort();
		upload.phase = "aborted";
		upload.error = "The upload was stopped.";
		upload.retryStage = upload.intent ? "put" : "sign";
		if (!silent) this.renderOverlay();
	};

	FileVaultV2.prototype.hasV1Config = function () {
		return !!(this.config.v1 && (this.config.v1.css || this.config.v1.js));
	};

	FileVaultV2.prototype.classicFallbackAvailable = function () {
		return !this.roleIsStaff() && this.hasV1Config();
	};

	FileVaultV2.prototype.beginV1Fallback = function () {
		var self = this;
		if (this.state.fallbackLoading || !this.classicFallbackAvailable()) return;
		this.state.fallbackLoading = true;
		this.render();
		integration.fallbackActive = true;
		restoreLegacyPatch();
		restoreRuntimeModule();
		loadConfiguredV1(this.config).then(function () {
			var v1 = window.MMED_FILE_VAULT_V1;
			if (!v1 || typeof v1.render !== "function") throw new Error("The classic File Vault runtime did not register.");
			self.unmount();
			if (currentInstance === self) currentInstance = null;
			v1.render();
		}).catch(function (error) {
			integration.fallbackActive = false;
			registerRuntimeModule();
			installLegacyPatch();
			if (self.destroyed) return;
			self.state.fallbackLoading = false;
			self.state.error = "Classic File Vault fallback failed: " + errorMessage(error);
			self.render();
		});
	};

	FileVaultV2.prototype.unmount = function () {
		if (this.destroyed) return;
		this.destroyed = true;
		this.staffSearchToken += 1;
		if (this.staffSearchController && typeof this.staffSearchController.abort === "function") this.staffSearchController.abort();
		this.staffSearchController = null;
		this.studentRequestToken += 1;
		if (this.studentRequestController && typeof this.studentRequestController.abort === "function") this.studentRequestController.abort();
		this.studentRequestController = null;
		this.requests.forEach(function (controller) {
			if (controller && typeof controller.abort === "function") controller.abort();
		});
		this.requests.clear();
		this.transfers.forEach(function (transfer) {
			if (transfer && typeof transfer.abort === "function") transfer.abort();
		});
		this.transfers.clear();
		this.timers.forEach(function (timer) { window.clearTimeout(timer); });
		this.timers.clear();
		this.listeners.splice(0).reverse().forEach(function (remove) {
			try { remove(); } catch (error) { /* Listener cleanup is best effort. */ }
		});
		if (this.legacyGuardObserver) this.legacyGuardObserver.disconnect();
		this.legacyGuardObserver = null;
		if (this.audioContext && typeof this.audioContext.close === "function") {
			try { this.audioContext.close(); } catch (error) { /* Optional audio cleanup. */ }
		}
		this.audioContext = null;
		this.returnFocus = null;
		this.setExternalOverlayIsolation(false);
		if (this.refs.frame) {
			this.refs.frame.inert = false;
			this.refs.frame.removeAttribute("inert");
			this.refs.frame.removeAttribute("aria-hidden");
		}
		this.activateAppMode(false);
		if (this.root) {
			this.root.classList.remove("mmed-fv2-host");
			this.root.innerHTML = "";
		}
		this.refs = {};
	};

	function safeAssetUrl(value) {
		try {
			var url = new URL(String(value || ""), window.location.href);
			var local = url.protocol === "http:" && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname);
			return (url.protocol === "https:" || local) && url.origin === window.location.origin ? url.toString() : "";
		} catch (error) {
			return "";
		}
	}

	function loadStyle(url) {
		if (!url) return Promise.resolve();
		var id = "mmed-file-vault-v1-fallback-css";
		var existing = document.getElementById(id);
		if (existing) return Promise.resolve();
		return new Promise(function (resolve, reject) {
			var link = document.createElement("link");
			link.id = id;
			link.rel = "stylesheet";
			link.href = url;
			link.onload = function () { resolve(); };
			link.onerror = function () { reject(new Error("The configured classic File Vault stylesheet could not be loaded.")); };
			document.head.appendChild(link);
		});
	}

	function loadScript(url) {
		if (window.MMED_FILE_VAULT_V1 && typeof window.MMED_FILE_VAULT_V1.render === "function") return Promise.resolve();
		if (!url) return Promise.reject(new Error("No classic File Vault script URL is configured."));
		var id = "mmed-file-vault-v1-fallback-js";
		var existing = document.getElementById(id);
		if (existing) {
			return new Promise(function (resolve, reject) {
				var attempts = 0;
				var timer = window.setInterval(function () {
					attempts += 1;
					if (window.MMED_FILE_VAULT_V1 && typeof window.MMED_FILE_VAULT_V1.render === "function") {
						window.clearInterval(timer);
						resolve();
					} else if (attempts >= 40) {
						window.clearInterval(timer);
						reject(new Error("The classic File Vault runtime did not become available."));
					}
				}, 100);
			});
		}
		return new Promise(function (resolve, reject) {
			var script = document.createElement("script");
			script.id = id;
			script.src = url;
			script.async = false;
			script.onload = function () {
				if (window.MMED_FILE_VAULT_V1 && typeof window.MMED_FILE_VAULT_V1.render === "function") resolve();
				else reject(new Error("The configured classic File Vault script loaded without registering its runtime."));
			};
			script.onerror = function () { reject(new Error("The configured classic File Vault script could not be loaded.")); };
			document.body.appendChild(script);
		});
	}

	function loadConfiguredV1(config) {
		var v1 = config && config.v1 ? config.v1 : {};
		var css = safeAssetUrl(v1.css);
		var js = safeAssetUrl(v1.js);
		if (v1.css && !css) return Promise.reject(new Error("The configured classic File Vault stylesheet URL is unsafe."));
		if (v1.js && !js) return Promise.reject(new Error("The configured classic File Vault script URL is unsafe."));
		return loadStyle(css).then(function () { return loadScript(js); });
	}

	function legacyRenderV2() {
		return publicMount(document.getElementById("sos-content"), { source: "legacy" });
	}

	function installLegacyPatch() {
		if (integration.fallbackActive) return false;
		var app = window.MMED_OS;
		if (!app || !app.render) return false;
		var render = app.render;
		if (integration.legacyObject === render && render.fileVault === legacyRenderV2) return true;
		var descriptor = Object.getOwnPropertyDescriptor(render, "fileVault");
		var current = render.fileVault;
		if (typeof current === "function" && current !== legacyRenderV2) integration.v1Renderer = current;
		integration.legacyObject = render;
		integration.legacyDescriptor = descriptor || null;
		try {
			Object.defineProperty(render, "fileVault", {
				configurable: true,
				enumerable: descriptor ? descriptor.enumerable : true,
				get: function () { return legacyRenderV2; },
				set: function (value) {
					if (typeof value === "function" && value !== legacyRenderV2) integration.v1Renderer = value;
				}
			});
		} catch (error) {
			render.fileVault = legacyRenderV2;
		}
		return render.fileVault === legacyRenderV2;
	}

	function restoreLegacyPatch() {
		var render = integration.legacyObject;
		if (!render) return;
		var descriptor = integration.legacyDescriptor;
		try {
			delete render.fileVault;
			if (descriptor && !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
				Object.defineProperty(render, "fileVault", descriptor);
				if (integration.v1Renderer) render.fileVault = integration.v1Renderer;
			} else {
				Object.defineProperty(render, "fileVault", {
					configurable: descriptor ? descriptor.configurable !== false : true,
					enumerable: descriptor ? descriptor.enumerable : true,
					writable: descriptor ? descriptor.writable !== false : true,
					value: integration.v1Renderer || (descriptor && descriptor.value) || function () {}
				});
			}
		} catch (error) {
			if (integration.v1Renderer) render.fileVault = integration.v1Renderer;
		}
		integration.legacyObject = null;
		integration.legacyDescriptor = null;
	}

	function runtimeModuleDefinition() {
		return {
			id: "filevault-v2",
			label: "File Vault",
			route: "filevault",
			icon: "Fv",
			section: "Documents",
			authRequirement: "current_user",
			errorState: "File Vault could not be loaded.",
			emptyState: "No File Vault documents are available yet.",
			performanceBudget: { requests: 20, usableMs: 4000 },
			load: function () { return Promise.resolve(); },
			mount: function (context) {
				var root = context && context.refs ? context.refs.content : document.getElementById("sos-content");
				return publicMount(root, { source: "runtime", signal: context && context.signal });
			},
			unmount: function () { publicUnmount(); }
		};
	}

	function registerRuntimeModule() {
		if (integration.fallbackActive || !window.MatrixRuntime || typeof window.MatrixRuntime.register !== "function") return false;
		var runtime = window.MatrixRuntime;
		if (integration.runtime !== runtime) {
			integration.runtime = runtime;
			integration.originalRuntimeModule = runtime.modules && runtime.modules.filevault ? runtime.modules.filevault : null;
			integration.runtimeModule = runtimeModuleDefinition();
		}
		runtime.register(integration.runtimeModule);
		return true;
	}

	function restoreRuntimeModule() {
		if (!integration.runtime || !integration.originalRuntimeModule) return;
		integration.runtime.register(integration.originalRuntimeModule);
		if (integration.runtime.current && integration.runtime.current.route === "filevault") {
			integration.runtime.current.module = integration.originalRuntimeModule;
		}
	}

	function replacementIsMounted() {
		var root = document.getElementById("sos-content");
		var mounted = !!(root && currentInstance && !currentInstance.destroyed && currentInstance.root === root && root.querySelector("[data-fv2-app]"));
		if (mounted) integration.takeoverPendingUntil = 0;
		return mounted;
	}

	function scheduleReplacementActivation(delay) {
		window.setTimeout(function () {
			installReplacementGuard();
			activateReplacementForCurrentRoute();
		}, Math.max(0, Number(delay) || 0));
	}

	function installReplacementGuard() {
		var root = document.getElementById("sos-content");
		if (!root || typeof window.MutationObserver !== "function" || integration.observedRoot === root) return;
		if (integration.rootObserver) integration.rootObserver.disconnect();
		integration.observedRoot = root;
		integration.rootObserver = new window.MutationObserver(function () {
			if (integration.fallbackActive || !isFileVaultRoute() || replacementIsMounted()) return;
			var pending = Math.max(0, integration.takeoverPendingUntil - Date.now());
			scheduleReplacementActivation(pending ? pending + 10 : 0);
		});
		integration.rootObserver.observe(root, { childList: true });
	}

	function activateReplacementForCurrentRoute() {
		installReplacementGuard();
		if (integration.fallbackActive || !isFileVaultRoute()) return false;
		installLegacyPatch();
		registerRuntimeModule();
		if (replacementIsMounted()) return true;
		if (integration.mountPromise) return false;
		if (Date.now() < integration.takeoverPendingUntil) return false;

		var runtime = integration.runtime;
		if (runtime && runtime.enabled && typeof runtime.navigate === "function") {
			if (runtime.current && runtime.current.route === "filevault") runtime.current.mounted = false;
			integration.takeoverPendingUntil = Date.now() + 400;
			runtime.navigate("filevault");
			return false;
		}

		if (!runtime || !runtime.enabled) {
			integration.takeoverPendingUntil = Date.now() + 400;
			legacyRenderV2().catch(function () { integration.takeoverPendingUntil = 0; });
		}
		return false;
	}

	function publicMount(target, options) {
		var root = resolveRoot(target);
		if (!root) return Promise.reject(new Error("File Vault mount point was not found."));
		if (integration.mountPromise && integration.mountRoot === root) return integration.mountPromise;
		if (currentInstance && !currentInstance.destroyed && currentInstance.root === root && root.querySelector("[data-fv2-app]")) {
			return Promise.resolve(currentInstance);
		}
		if (currentInstance) currentInstance.unmount();
		var instance = new FileVaultV2(root, options || {});
		currentInstance = instance;
		integration.mountRoot = root;
		var mountPromise = instance.mount().then(function () { return instance; });
		integration.mountPromise = mountPromise;
		return mountPromise.then(function (value) {
			if (integration.mountPromise === mountPromise) {
				integration.mountPromise = null;
				integration.mountRoot = null;
			}
			if (!replacementIsMounted() && isFileVaultRoute()) scheduleReplacementActivation(0);
			return value;
		}, function (error) {
			if (integration.mountPromise === mountPromise) {
				integration.mountPromise = null;
				integration.mountRoot = null;
			}
			if (!replacementIsMounted() && isFileVaultRoute()) scheduleReplacementActivation(0);
			throw error;
		});
	}

	function publicUnmount() {
		if (!currentInstance) return;
		var instance = currentInstance;
		currentInstance = null;
		if (integration.mountPromise && integration.mountRoot === instance.root) {
			integration.mountPromise = null;
			integration.mountRoot = null;
		}
		instance.unmount();
	}

	function mountHarness(target, options) {
		options = Object.assign({}, options || {}, { harness: true });
		if (!options.api) return Promise.reject(new Error("The File Vault harness requires an explicit mock API."));
		return publicMount(target, options);
	}

	window.MMED_FILE_VAULT_V2 = {
		mount: publicMount,
		unmount: publicUnmount,
		mountHarness: mountHarness,
		fallbackToV1: function () { if (currentInstance) currentInstance.beginV1Fallback(); },
		esc: esc,
		escAttr: escAttr
	};

	registerRuntimeModule();
	installLegacyPatch();
	installReplacementGuard();
	[0, 80, 320, 1200, 4000, 9000].forEach(scheduleReplacementActivation);
	window.addEventListener("hashchange", function () {
		scheduleReplacementActivation(0);
		scheduleReplacementActivation(250);
	});
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", function () {
			installReplacementGuard();
			scheduleReplacementActivation(0);
			scheduleReplacementActivation(250);
		}, { once: true });
	}
}(window, document));
