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
	var ACCEPTED_EXTENSIONS = ["pdf", "docx", "png", "jpg", "jpeg"];
	var MIME_FALLBACKS = {
		pdf: "application/pdf",
		docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		png: "image/png",
		jpg: "image/jpeg",
		jpeg: "image/jpeg"
	};
	var STUDENT_VIEWS = ["vault", "journey", "library", "activity"];
	var STAFF_VIEWS = ["command", "vault", "audit"];
	var PREFS_KEY = "mmed.fileVaultV2.preferences";
	var currentInstance = null;
	var integration = {
		fallbackActive: false,
		legacyObject: null,
		legacyDescriptor: null,
		v1Renderer: null,
		runtime: null,
		runtimeModule: null,
		originalRuntimeModule: null
	};

	var ICONS = {
		activity: '<path d="M3 12h4l3-9 4 18 3-9h4"/>',
		alert: '<path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
		arrowLeft: '<path d="m15 18-6-6 6-6"/>',
		arrowRight: '<path d="m9 18 6-6-6-6"/>',
		check: '<path d="m20 6-11 11-5-5"/>',
		clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
		close: '<path d="M18 6 6 18M6 6l12 12"/>',
		comment: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/>',
		download: '<path d="M12 3v12m0 0 5-5m-5 5-5-5"/><path d="M5 21h14"/>',
		file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
		folder: '<path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
		journey: '<path d="M5 19 19 5M7 5h12v12"/>',
		library: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
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
			? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }
			: { month: "short", day: "numeric", year: "numeric" };
		try {
			return new Intl.DateTimeFormat(undefined, options).format(date);
		} catch (error) {
			return date.toLocaleString();
		}
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
		this.audioContext = null;
		this.preferences = readPreferences();
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
			staffLoadingMore: false,
			staffLoadError: "",
			paginationAnnouncement: "",
			selectedStudentId: 0,
			studentLoading: false,
			busy: {},
			overlay: "",
			upload: null,
			reviewStatus: "reviewed",
			reviewNote: "",
			scoreDraft: {},
			scoreNotes: "",
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
		this.refs.app = this.root.querySelector("[data-fv2-app]");
		this.refs.frame = this.root.querySelector("[data-fv2-frame]");
		this.refs.nav = this.root.querySelector("[data-fv2-nav]");
		this.refs.stage = this.root.querySelector("[data-fv2-stage]");
		this.refs.overlay = this.root.querySelector("[data-fv2-overlay]");
		this.refs.toasts = this.root.querySelector("[data-fv2-toasts]");
		this.refs.live = this.root.querySelector("[data-fv2-live]");
		this.refs.student = this.root.querySelector("[data-fv2-student]");
		this.refs.lens = this.root.querySelector("[data-fv2-lens]");
		this.refs.storage = this.root.querySelector("[data-fv2-storage]");

		this.listen(this.root, "click", function (event) { self.handleClick(event); });
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
			this.listen(this.runtimeSignal, "abort", function () { self.unmount(); }, { once: true });
		}
		this.applyPreferences();
		return this.reload();
	};

	FileVaultV2.prototype.shellMarkup = function () {
		return [
			'<section class="mmed-fv2" data-fv2-app aria-label="MissionMed File Vault">',
			'<div class="fv2-frame" data-fv2-frame>',
			'<header class="fv2-hud">',
			'<div class="fv2-brand" aria-label="Matrix File Vault"><span class="fv2-brand-matrix">MATRIX</span><span class="fv2-brand-slash">/</span><strong>FILE VAULT</strong></div>',
			'<div class="fv2-hud-context"><span class="fv2-lens" data-fv2-lens>Vault</span><span class="fv2-student" data-fv2-student></span></div>',
			'<div class="fv2-hud-actions">',
			'<span class="fv2-security" data-fv2-storage>' + icon("lock") + '<span>Private</span></span>',
			'<button type="button" class="fv2-icon-button" data-fv2-action="open-settings" aria-label="Open File Vault settings" title="Settings">' + icon("settings") + "</button>",
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

	FileVaultV2.prototype.fetchRequest = function (method, path, body, query, signal) {
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
					var requestError = new Error(payload && payload.message ? payload.message : "File Vault request failed (" + response.status + ").");
					requestError.status = response.status;
					requestError.code = payload && payload.code ? payload.code : "";
					throw requestError;
				}
				return payload === null ? {} : payload;
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
			this.state.staffData = data;
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

	FileVaultV2.prototype.capability = function (name) {
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
		var labels = { vault: "Vault", journey: "Journey", library: "Library", activity: "Activity", command: "Command", audit: "Audit", docdocs: "Doc Docs" };
		this.refs.lens.textContent = labels[this.state.view] || "File Vault";
		var student = this.state.data && this.state.data.student;
		this.refs.student.textContent = student && student.display_name ? String(student.display_name) : (this.roleIsStaff() ? "Staff review" : "");
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
		var items = isStaffRole(role)
			? [["command", "users", "Command"], ["vault", "vault", "Vault"], ["audit", "activity", "Activity"]]
			: [["vault", "vault", "Vault"], ["journey", "journey", "Journey"], ["library", "library", "Library"], ["activity", "activity", "Activity"]];
		var queueCount = this.state.data && Array.isArray(this.state.data.review_queue) ? this.state.data.review_queue.length : 0;
		var markup = items.map(function (item, index) {
			var count = item[0] === "command" && queueCount ? '<span class="fv2-nav-count">' + esc(queueCount) + "</span>" : '<span class="fv2-nav-key" aria-hidden="true">' + (index + 1) + "</span>";
				return '<button type="button" class="fv2-nav-item' + (self.state.view === item[0] ? " is-active" : "") + '" aria-label="' + escAttr(item[2]) + '" data-fv2-action="navigate" data-fv2-view="' + escAttr(item[0]) + '" data-fv2-focus-key="nav-' + escAttr(item[0]) + '"' + (self.state.view === item[0] ? ' aria-current="page"' : "") + ">" + icon(item[1]) + "<span>" + esc(item[2]) + "</span>" + count + "</button>";
		}).join("");
		var roleLabel = role === "mentor" ? "Mentor review scope" : (role === "admin" ? "Admin review scope" : "Student Vault");
		return '<div class="fv2-rail-label">' + esc(roleLabel) + "</div>" + markup + '<div class="fv2-rail-foot"><span>File Vault V2</span><span>Private document workflow</span></div>';
	};

	FileVaultV2.prototype.viewMarkup = function () {
		switch (this.state.view) {
			case "journey": return this.journeyMarkup();
			case "library": return this.libraryMarkup();
			case "activity": return this.activityMarkup();
			case "command": return this.commandMarkup();
			case "audit": return this.auditMarkup();
			case "docdocs": return this.docDocsMarkup();
			default: return this.vaultMarkup();
		}
	};

	FileVaultV2.prototype.pageHeadingMarkup = function (kicker, title, subtitle, actions) {
		return [
			'<header class="fv2-page-heading">',
			'<div><span class="fv2-kicker">' + esc(kicker) + "</span><h1>" + esc(title) + "</h1><p>" + esc(subtitle || "") + "</p></div>",
			'<div class="fv2-heading-actions">' + (actions || "") + "</div>",
			"</header>"
		].join("");
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

	FileVaultV2.prototype.vaultMarkup = function () {
		var data = this.state.data || {};
		if (this.roleIsStaff() && !data.student) {
			return this.pageHeadingMarkup("Staff review", "Student Vault", "Select a server-scoped student before opening documents.", this.studentPickerMarkup()) +
				this.stateMessageMarkup("empty", "Choose a student", "Open a student from Command or use the student selector above.", '<button type="button" class="fv2-button fv2-button-primary" data-fv2-action="navigate" data-fv2-view="command">' + icon("users") + "Open Command</button>");
		}
		if (this.state.studentLoading) {
			return this.pageHeadingMarkup("Staff review", "Loading student Vault", "Checking the selected server scope.", "") + this.loadingMarkup();
		}

		var studentName = data.student && data.student.display_name ? data.student.display_name : "Student Vault";
		var headingActions = this.studentPickerMarkup();
		if (this.capability("upload") && this.storageReady()) {
			headingActions += '<button type="button" class="fv2-button fv2-button-primary" data-fv2-action="open-upload">' + icon("upload") + "Upload</button>";
		}
		var heading = this.pageHeadingMarkup("Private documents", studentName, "One list, one next action, detail only when you select a document.", headingActions);
		var storageNotice = "";
		if (!this.storageReady()) {
			storageNotice = this.inlineNoticeMarkup("blocked", "Private storage is unavailable", "Existing metadata remains visible. Uploads and secure downloads are blocked until storage is restored.");
		}

		var journeyItems = data.journey && Array.isArray(data.journey.items) ? data.journey.items : [];
		var matchedDocumentIds = new Set();
		var rows = journeyItems.map(function (item) {
			var documentId = positiveInt(item.document_id);
			if (documentId) matchedDocumentIds.add(documentId);
			return this.requirementRowMarkup(item, documentId ? this.getDocument(documentId) : null);
		}, this);
		(data.documents || []).forEach(function (documentItem) {
			var id = positiveInt(documentItem.id);
			if (!id || matchedDocumentIds.has(id) || documentItem.category === "admin") return;
			rows.push(this.documentRowMarkup(documentItem, "Additional document"));
		}, this);

		var emptyActions = this.capability("upload") && this.storageReady()
			? '<button type="button" class="fv2-button fv2-button-primary" data-fv2-action="open-upload">' + icon("upload") + "Upload first document</button>"
			: "";
		var listBody = rows.length
				? '<div class="fv2-document-list">' + rows.join("") + "</div>"
			: this.stateMessageMarkup("empty", "No documents yet", "Your Vault will list requirements and uploaded documents here.", emptyActions);
		var dropzone = this.capability("upload") && this.storageReady() ? [
			'<div class="fv2-dropzone" data-fv2-dropzone>',
			'<span class="fv2-dropzone-icon">' + icon("upload") + "</span>",
			'<div><strong>Add a document</strong><span>Drop a supported file here or use the guided upload.</span></div>',
			'<button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="open-upload">Choose file</button>',
			"</div>"
		].join("") : "";

		var selected = this.getDocument(this.state.selectedDocumentId);
		var desktopDetail = selected && !this.mobileQuery.matches ? this.documentDetailMarkup(selected, false) : "";
		return heading + storageNotice + this.nextActionMarkup() + dropzone +
			'<div class="fv2-vault-layout' + (desktopDetail ? " has-detail" : "") + '"><section class="fv2-list-panel" aria-labelledby="fv2-document-list-title"><div class="fv2-section-heading"><div><span>Application record</span><h2 id="fv2-document-list-title">Documents and requirements</h2></div><strong>' + esc(rows.length) + " rows</strong></div>" + listBody + "</section>" + desktopDetail + "</div>";
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

	FileVaultV2.prototype.documentRowMarkup = function (documentItem, requirementLabel) {
		var id = positiveInt(documentItem.id);
		var selected = id === this.state.selectedDocumentId;
		var metadata = ["v" + Math.max(1, positiveInt(documentItem.version)), formatSize(documentItem.file_size), formatDate(documentItem.updated_at)].join(" / ");
		return [
				'<button type="button" class="fv2-document-row' + (selected ? " is-selected" : "") + '" data-fv2-action="select-document" data-fv2-document-id="' + id + '" data-fv2-focus-key="document-' + id + '"' + (selected ? ' aria-current="true"' : "") + ">",
			'<span class="fv2-file-glyph">' + icon("file") + "</span>",
			'<span class="fv2-row-copy"><strong>' + esc(documentItem.name || requirementLabel || "Document") + "</strong><span>" + esc(requirementLabel || documentItem.original_name || "Document") + ' <span aria-hidden="true">/</span> ' + esc(metadata) + "</span></span>",
			statusBadge(documentItem.status, documentItem.status_label),
			'<span class="fv2-row-action">Details' + icon("arrowRight") + "</span>",
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
		if (canDownload) actions.push('<button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="download" data-fv2-document-id="' + id + '">' + icon("download") + "Download</button>");
		if (!canDownload && documentItem.download_available === false && this.classicFallbackAvailable()) actions.push('<button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="fallback-v1">' + icon("refresh") + "Open classic File Vault</button>");
		if (canVersion) actions.push('<button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="open-version" data-fv2-document-id="' + id + '">' + icon("upload") + "New version</button>");
		if (canSubmit) actions.push('<button type="button" class="fv2-button fv2-button-success" data-fv2-action="submit-document" data-fv2-document-id="' + id + '" data-fv2-focus-key="submit-' + id + '">' + icon("check") + "Submit for review</button>");
		return [
			'<aside class="fv2-detail-panel' + (mobile ? " is-mobile" : "") + '" aria-labelledby="fv2-detail-title">',
			'<div class="fv2-detail-top"><span>Selected document</span><button type="button" class="fv2-icon-button" data-fv2-action="close-detail" aria-label="Close document details">' + icon("close") + "</button></div>",
			'<div class="fv2-detail-file">' + icon("file") + '<div><h2 id="fv2-detail-title">' + esc(documentItem.name || "Document") + "</h2><p>" + esc(documentItem.original_name || documentItem.canonical_name || "Private file") + "</p></div></div>",
			statusBadge(documentItem.status, documentItem.status_label),
			'<dl class="fv2-detail-ledger"><div><dt>Version</dt><dd>' + esc(Math.max(1, positiveInt(documentItem.version))) + "</dd></div><div><dt>Size</dt><dd>" + esc(formatSize(documentItem.file_size)) + "</dd></div><div><dt>Updated</dt><dd>" + esc(formatDate(documentItem.updated_at)) + "</dd></div><div><dt>Comments</dt><dd>" + esc(Math.max(0, Number(documentItem.open_comment_count) || 0)) + " open</dd></div></dl>",
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
		}).join("") + "</div>" : this.stateMessageMarkup("empty", "No journey dates configured", "Dates appear only when they are present in server configuration.", "");
		return this.pageHeadingMarkup("Application record", "Journey", "Coverage and dates come directly from your server record.", "") +
			'<section class="fv2-journey-summary"><div><span>' + esc(journey.label || "Application document coverage") + '</span><strong>' + percent + "%</strong><p>" + summary + '</p></div><div class="fv2-progress" role="progressbar" aria-label="Document coverage" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + percent + '"><span style="width:' + percent + '%"></span></div></section>' +
			'<div class="fv2-two-column"><section class="fv2-section"><div class="fv2-section-heading"><div><span>Assigned set</span><h2>' + esc(requirementSet.label || "Document coverage") + '</h2>' + (requirementSet.source ? '<small>Source: ' + esc(requirementSet.source) + '</small>' : "") + '</div></div>' + (rows || this.stateMessageMarkup("empty", "No document set assigned", "No provenance-bearing requirement set is assigned to this Vault.", "")) + '</section><section class="fv2-section"><div class="fv2-section-heading"><div><span>Server calendar</span><h2>Journey dates</h2></div></div>' + gatesMarkup + "</section></div>";
	};

	FileVaultV2.prototype.libraryMarkup = function () {
		var rows = this.state.data && Array.isArray(this.state.data.library) ? this.state.data.library : [];
		var body = rows.length ? '<div class="fv2-library-list">' + rows.map(function (documentItem) {
			var id = positiveInt(documentItem.id);
			var canDownload = this.capability("download") && documentItem.download_available !== false && this.storageReady();
			return '<article class="fv2-library-row"><span class="fv2-file-glyph">' + icon("library") + '</span><div><h2>' + esc(documentItem.name || "Shared document") + "</h2><p>" + esc([documentItem.original_name || "Private file", "v" + Math.max(1, positiveInt(documentItem.version)), formatSize(documentItem.file_size)].join(" / ")) + "</p></div>" + statusBadge(documentItem.status, documentItem.status_label) + (canDownload ? '<button type="button" class="fv2-icon-button" data-fv2-action="download" data-fv2-document-id="' + id + '" aria-label="Securely download ' + escAttr(documentItem.name || "document") + '" title="Download">' + icon("download") + "</button>" : '<span class="fv2-library-blocked">Unavailable</span>') + "</article>";
		}, this).join("") + "</div>" : this.stateMessageMarkup("empty", "No shared Library documents", "Server-authorized shared files will appear here.", "");
		return this.pageHeadingMarkup("Shared resources", "Library", "Only documents returned in your authorized shared Library are shown.", "") + '<section class="fv2-section"><div class="fv2-section-heading"><div><span>Authorized rows</span><h2>Shared with this Vault</h2></div><strong>' + esc(rows.length) + " files</strong></div>" + body + "</section>";
	};

	FileVaultV2.prototype.activityMarkup = function () {
		var events = this.state.data && Array.isArray(this.state.data.activity) ? this.state.data.activity : [];
		var body = events.length ? '<div class="fv2-activity-list">' + events.map(function (eventItem) {
			return '<article class="fv2-activity-row"><span class="fv2-activity-mark">' + icon("activity") + '</span><div><h2>' + esc(eventItem.message || "File Vault activity") + "</h2><p>" + esc(eventItem.document_name || "Document") + "</p></div><div><strong>" + esc(eventItem.actor || "MissionMed user") + "</strong><time datetime=\"" + escAttr(eventItem.at || "") + "\">" + esc(formatDate(eventItem.at, true)) + "</time></div></article>";
		}).join("") + "</div>" : this.stateMessageMarkup("empty", "No activity recorded", "Document actions will appear here after the server records them.", "");
			return this.pageHeadingMarkup("Operational history", "Activity", "Newest document events stored with this Vault appear first.", "") + '<section class="fv2-section"><div class="fv2-section-heading"><div><span>Vault activity</span><h2>Recent actions</h2></div><strong>' + esc(events.length) + " events</strong></div>" + body + "</section>";
	};

	FileVaultV2.prototype.commandMarkup = function () {
		if (!this.roleIsStaff()) return this.vaultMarkup();
		var data = this.state.staffData || this.state.data || {};
		var command = data.command || {};
		var pagination = data.staff_pagination && typeof data.staff_pagination === "object" ? data.staff_pagination : { has_more: false, scope_complete: true };
		var metricPrefix = pagination.scope_complete === false ? "Loaded " : "";
		var metrics = [
			[metricPrefix + "Students", command.student_count, "users"],
			[metricPrefix + "Documents", command.document_count, "file"],
			[metricPrefix + "Review queue", command.review_count, "clock"],
			[metricPrefix + "Needs attention", command.attention_count, "alert"]
		];
		var metricMarkup = '<div class="fv2-metric-grid">' + metrics.map(function (metric) {
			var value = Math.max(0, Number(metric[1]) || 0);
			return '<section class="fv2-metric"><span>' + icon(metric[2]) + esc(metric[0]) + "</span><strong>" + esc(value.toLocaleString()) + "</strong></section>";
		}).join("") + "</div>";
		var students = Array.isArray(data.students) ? data.students : [];
		var query = this.state.commandSearch.trim().toLowerCase();
		var filtered = query ? students.filter(function (student) { return String(student.display_name || "").toLowerCase().indexOf(query) !== -1; }) : students;
		var studentRows = filtered.length ? '<div class="fv2-command-list">' + filtered.map(function (student) {
			var id = positiveInt(student.id);
			var coverage = boundedInt(student.coverage_percent, 0, 100);
			return '<button type="button" class="fv2-command-row" data-fv2-action="load-student" data-fv2-student-id="' + id + '" data-fv2-focus-key="student-' + id + '"><span class="fv2-student-monogram" aria-hidden="true">' + esc(String(student.display_name || "S").charAt(0).toUpperCase()) + "</span><span><strong>" + esc(student.display_name || "Student") + "</strong><small>" + esc(Math.max(0, Number(student.document_count) || 0)) + " documents</small></span><span class=\"fv2-command-progress\"><i style=\"width:" + coverage + '%\"></i><small>' + coverage + "% coverage</small></span><span class=\"fv2-attention-count\">" + esc(Math.max(0, Number(student.needs_attention) || 0)) + " attention</span>" + icon("arrowRight") + "</button>";
		}).join("") + "</div>" : this.stateMessageMarkup("empty", query ? "No matching students" : "No students in scope", query ? "Try a different search." : "The server returned no students for this staff scope.", "");
		var queue = Array.isArray(data.review_queue) ? data.review_queue : [];
		var queueRows = queue.length ? '<div class="fv2-queue-list">' + queue.map(function (documentItem) {
			var id = positiveInt(documentItem.id);
			var studentId = positiveInt(documentItem.student && documentItem.student.id);
			return '<button type="button" class="fv2-queue-row" data-fv2-action="open-queue-document" data-fv2-student-id="' + studentId + '" data-fv2-document-id="' + id + '" data-fv2-focus-key="queue-' + id + '"><span class="fv2-file-glyph">' + icon("file") + "</span><span><strong>" + esc(documentItem.name || "Document") + "</strong><small>" + esc(documentItem.student && documentItem.student.display_name || "Student") + " / Updated " + esc(formatDate(documentItem.updated_at)) + "</small></span>" + statusBadge(documentItem.status, documentItem.status_label) + icon("arrowRight") + "</button>";
		}).join("") + "</div>" : this.stateMessageMarkup("empty", "Review queue is clear", "No server-scoped documents are waiting in an active review state.", "");
		var loadMore = pagination.has_more || this.state.staffLoadError ? '<div class="fv2-modal-actions">' + (this.state.staffLoadError ? '<span role="alert">' + esc(this.state.staffLoadError) + "</span>" : "") + '<button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="load-more-staff" data-fv2-focus-key="staff-load-more"' + (this.state.staffLoadingMore ? " disabled" : "") + ">" + icon("refresh") + (this.state.staffLoadingMore ? "Loading roster" : "Load more students") + "</button></div>" : "";
		var headingSubtitle = this.role() === "mentor" ? "Assigned students and review work in your paged server scope." : "Server-authorized student roster and review work, loaded in bounded pages.";
		return this.pageHeadingMarkup("Staff operations", "Command", headingSubtitle, "") + '<p class="fv2-sr-only" aria-live="polite">' + esc(this.state.paginationAnnouncement) + "</p>" + metricMarkup + '<div class="fv2-command-grid"><section class="fv2-section"><div class="fv2-section-heading"><div><span>Server-scoped roster</span><h2>Students</h2></div><label class="fv2-search">' + icon("search") + '<span class="fv2-sr-only">Search loaded students</span><input type="search" data-fv2-command-search data-fv2-focus-key="command-search" value="' + escAttr(this.state.commandSearch) + '" placeholder="Search loaded students"></label></div>' + studentRows + '</section><section class="fv2-section"><div class="fv2-section-heading"><div><span>Oldest loaded updates first</span><h2>Review queue</h2></div><strong>' + esc(queue.length) + " loaded</strong></div>" + queueRows + "</section></div>" + loadMore;
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
		return this.pageHeadingMarkup("Staff record", "Activity review", "This is a cursor-paged operational history over bounded roster pages, not an immutable compliance audit log.", "") + '<p class="fv2-sr-only" aria-live="polite">' + esc(this.state.paginationAnnouncement) + '</p><section class="fv2-section" tabindex="-1" data-fv2-focus-key="audit-feed"><div class="fv2-section-heading"><div><span>Authorized event feed</span><h2>Document activity</h2></div><label class="fv2-search">' + icon("search") + '<span class="fv2-sr-only">Search loaded activity</span><input type="search" data-fv2-audit-search data-fv2-focus-key="audit-search" value="' + escAttr(this.state.auditSearch) + '" placeholder="Search loaded activity"></label></div>' + body + loadMore + "</section>";
	};

	FileVaultV2.prototype.docDocsMarkup = function () {
		var documentItem = this.getDocument(this.state.selectedDocumentId);
		var back = '<button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="back-vault">' + icon("arrowLeft") + "Back to Vault</button>";
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
		var tabs = [["score", "Score"], ["versions", "Versions"], ["comments", "Comments"]].map(function (tab) {
			var count = tab[0] === "comments" && Number(documentItem.open_comment_count) > 0 ? " " + Math.max(0, Number(documentItem.open_comment_count) || 0) : "";
				return '<button type="button" role="tab" id="fv2-tab-' + escAttr(tab[0]) + '" aria-controls="fv2-workspace-panel" tabindex="' + (this.state.workspaceTab === tab[0] ? "0" : "-1") + '" class="' + (this.state.workspaceTab === tab[0] ? "is-active" : "") + '" aria-selected="' + (this.state.workspaceTab === tab[0] ? "true" : "false") + '" data-fv2-action="workspace-tab" data-fv2-tab="' + tab[0] + '" data-fv2-focus-key="workspace-' + tab[0] + '">' + esc(tab[1] + count) + "</button>";
		}, this).join("");
		var panel = this.state.workspaceTab === "versions" ? this.versionsMarkup(documentItem) : (this.state.workspaceTab === "comments" ? this.commentsMarkup(documentItem) : this.scoreMarkup(documentItem));
		return this.pageHeadingMarkup("Binary document workspace", documentItem.name || "Doc Docs", "Score, versions, and comments for the selected private file.", actions) +
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
			return '<article class="fv2-version-row"><span class="fv2-version-number">v' + number + '</span><div><h2>' + esc(version.original_name || documentItem.name || "Document") + "</h2><p>" + esc([version.uploader_name || "MissionMed user", formatDate(version.uploaded_at, true), formatSize(version.file_size)].join(" / ")) + "</p>" + (version.note ? "<small>" + esc(version.note) + "</small>" : "") + "</div>" + (version.score !== undefined ? '<span class="fv2-version-score">' + esc(boundedInt(version.score, 0, scoreMaximum)) + "/" + esc(scoreMaximum) + "</span>" : "") + (canDownload ? '<button type="button" class="fv2-icon-button" data-fv2-action="download" data-fv2-document-id="' + positiveInt(documentItem.id) + '" data-fv2-version="' + number + '" aria-label="Download version ' + number + '" title="Download version">' + icon("download") + "</button>" : "") + "</article>";
		}).join("") + "</div>";
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
		switch (action) {
			case "navigate":
				this.navigate(button.getAttribute("data-fv2-view"));
				break;
			case "open-settings":
				this.openOverlay("settings");
				break;
			case "close-overlay":
				this.closeOverlay();
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
					displayName: button.getAttribute("data-fv2-display-name") || ""
				});
				break;
			case "open-version":
				this.openUpload({ documentId: documentId });
				break;
			case "next-action":
				this.performNextAction();
				break;
			case "open-journey-document":
				this.state.view = "vault";
				this.selectDocument(documentId, button);
				break;
			case "open-workspace":
				this.openWorkspace(documentId);
				break;
			case "back-vault":
				this.navigate("vault");
				break;
			case "workspace-tab":
				this.state.workspaceTab = button.getAttribute("data-fv2-tab") || "score";
				this.render({ focusKey: button.getAttribute("data-fv2-focus-key") || "" });
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
		}
	};

	FileVaultV2.prototype.handleChange = function (event) {
		var target = event.target;
		if (target.matches("[data-fv2-student-picker]")) {
			var studentId = positiveInt(target.value);
			if (studentId) this.loadStudent(studentId, { view: "vault" });
			return;
		}
		if (target.matches("[data-fv2-upload-file]")) {
			var file = target.files && target.files[0] ? target.files[0] : null;
			if (this.state.upload) {
				this.state.upload.file = file;
				this.state.upload.fileError = this.validateFile(file, this.state.upload.documentType);
				this.state.upload.sha256 = "";
				if (file && !this.state.upload.displayName && !this.state.upload.documentId) {
					this.state.upload.displayName = file.name.replace(/\.[^.]+$/, "");
				}
				this.renderOverlay();
			}
			return;
		}
		if (target.matches("[data-fv2-upload-type]") && this.state.upload) {
			this.state.upload.documentType = target.value || "other";
			var selectedOption = target.options[target.selectedIndex];
			if (!this.state.upload.displayName && selectedOption) this.state.upload.displayName = selectedOption.textContent;
			this.state.upload.fileError = this.validateFile(this.state.upload.file, this.state.upload.documentType);
			this.renderOverlay();
			return;
		}
		if (target.matches("[data-fv2-upload-ready]") && this.state.upload) {
			this.state.upload.readyForReview = target.checked;
			return;
		}
		if (target.matches("[data-fv2-review-status]")) {
			this.state.reviewStatus = target.value;
			return;
		}
	};

	FileVaultV2.prototype.handleInput = function (event) {
		var target = event.target;
		if (target.matches("[data-fv2-command-search]")) {
			this.state.commandSearch = target.value;
			this.render({ focusKey: "command-search" });
			return;
		}
		if (target.matches("[data-fv2-audit-search]")) {
			this.state.auditSearch = target.value;
			this.render({ focusKey: "audit-search" });
			return;
		}
		if (target.matches("[data-fv2-upload-name]") && this.state.upload) {
			this.state.upload.displayName = target.value;
			this.updateUploadNextButton();
			return;
		}
		if (target.matches("[data-fv2-upload-note]") && this.state.upload) {
			this.state.upload.note = target.value;
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
		if (file) this.openUpload({ file: file });
	};

	FileVaultV2.prototype.handleKeydown = function (event) {
		if (this.destroyed) return;
		if (this.state.overlay) {
			if (event.key === "Escape") {
				event.preventDefault();
				this.closeOverlay();
				return;
			}
			if (event.key === "Tab") this.trapFocus(event);
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
		var number = parseInt(event.key, 10);
		var views = this.roleIsStaff() ? STAFF_VIEWS : STUDENT_VIEWS;
		if (number >= 1 && number <= views.length) {
			event.preventDefault();
			this.navigate(views[number - 1]);
		}
	};

	FileVaultV2.prototype.handleViewportChange = function () {
		if (this.destroyed) return;
		if (!this.mobileQuery.matches && this.state.overlay === "detail") {
			this.closeOverlay({ restoreFocus: false });
			this.render();
			return;
		}
		if (this.mobileQuery.matches && this.state.view === "vault" && this.state.selectedDocumentId && !this.state.overlay) {
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
		this.render({ focusKey: "nav-" + view });
		if (view === "audit" && this.state.audit === null && !this.state.auditLoading) this.loadAudit();
	};

	FileVaultV2.prototype.performNextAction = function () {
		var action = this.state.data && this.state.data.next_action;
		if (!action) return;
		if (action.kind === "open_document") this.selectDocument(positiveInt(action.document_id), null);
		else if (action.kind === "upload") this.openUpload({ documentType: action.document_type, displayName: String(action.title || "").replace(/^Add\s+/i, "") });
		else if (action.kind === "submit") {
			this.state.view = "vault";
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

	FileVaultV2.prototype.loadStudent = function (studentId, options) {
		var self = this;
		if (!this.roleIsStaff() || !studentId || this.state.studentLoading) return Promise.resolve();
		this.state.studentLoading = true;
		this.state.view = options && options.view === "docdocs" ? "command" : "vault";
		this.render();
		return this.request("GET", "/students/" + studentId).then(function (scoped) {
			if (self.destroyed) return;
			if (!scoped || typeof scoped !== "object" || Array.isArray(scoped)) throw new Error("File Vault returned malformed student scope data.");
			var staff = self.state.staffData || self.state.data || {};
			scoped = Object.assign({}, scoped);
			scoped.viewer_role = staff.viewer_role || self.role();
			scoped.students = Array.isArray(staff.students) ? staff.students : [];
			scoped.review_queue = Array.isArray(staff.review_queue) ? staff.review_queue : [];
			scoped.command = staff.command || {};
			scoped.staff_pagination = staff.staff_pagination || { page: 1, per_page: 50, has_more: false, next_page: null, scope_complete: true };
			self.state.selectedStudentId = studentId;
			self.state.studentLoading = false;
			self.acceptBootstrap(self.validateBootstrap(scoped), true);
			self.state.view = options && options.view === "docdocs" ? "vault" : "vault";
			self.render();
			if (options && options.documentId) self.openWorkspace(options.documentId);
		}).catch(function (error) {
			if (self.destroyed || (error && error.name === "AbortError")) return;
			self.state.studentLoading = false;
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

	FileVaultV2.prototype.loadMoreStaff = function () {
		var self = this;
		var data = this.state.staffData || this.state.data || {};
		var pagination = data.staff_pagination || {};
		var page = positiveInt(pagination.next_page);
		if (!this.roleIsStaff() || !page || this.state.staffLoadingMore) return Promise.resolve();
		this.state.staffLoadingMore = true;
		this.state.staffLoadError = "";
		this.state.paginationAnnouncement = "";
		this.render({ focusKey: "staff-load-more" });
		return this.request("GET", "/students", null, { page: page, per_page: positiveInt(pagination.per_page) || 50 }).then(function (payload) {
			if (self.destroyed) return;
			if (!payload || typeof payload !== "object" || !Array.isArray(payload.students) || !Array.isArray(payload.review_queue) || !payload.pagination || typeof payload.pagination !== "object") {
				throw new Error("File Vault returned malformed staff pagination data.");
			}
			data.students = self.mergeStaffRows(data.students, payload.students);
			data.review_queue = self.mergeStaffRows(data.review_queue, payload.review_queue).sort(function (left, right) {
				return String(left.updated_at || "").localeCompare(String(right.updated_at || ""));
			});
			data.staff_pagination = payload.pagination;
			data.command = self.staffCommand(data.students, data.review_queue);
			self.state.staffData = data;
			self.state.data = data;
			self.state.staffLoadingMore = false;
			self.state.paginationAnnouncement = payload.students.length + (payload.students.length === 1 ? " student loaded." : " students loaded.");
			var studentQuery = self.state.commandSearch.trim().toLowerCase();
			var firstVisibleStudent = payload.students.find(function (student) {
				return !studentQuery || String(student.display_name || "").toLowerCase().indexOf(studentQuery) !== -1;
			});
			var firstStudentId = positiveInt(firstVisibleStudent && firstVisibleStudent.id);
			self.render({ focusKey: firstStudentId ? "student-" + firstStudentId : (studentQuery ? "command-search" : (payload.pagination.has_more ? "staff-load-more" : "nav-command")) });
		}).catch(function (error) {
			if (self.destroyed || (error && error.name === "AbortError")) return;
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
		this.render();
		this.focusStageStart();
		this.request("GET", "/files/" + documentId).then(function (documentItem) {
			if (self.destroyed) return;
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
			if (self.destroyed || (error && error.name === "AbortError")) return;
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

	FileVaultV2.prototype.refreshAfterMutation = function () {
		var self = this;
		var selectedId = this.state.selectedDocumentId;
		var selectedView = this.state.view;
		var query = this.roleIsStaff() && this.state.selectedStudentId ? { student_id: this.state.selectedStudentId } : {};
		return this.request("GET", "/bootstrap", null, query).then(function (data) {
			if (self.destroyed) return;
			self.acceptBootstrap(self.validateBootstrap(data), true);
			self.state.view = selectedView;
			self.state.selectedDocumentId = selectedId;
			var refreshed = self.getDocument(selectedId);
			if (refreshed) self.state.documentDetail = refreshed;
			self.render();
		}).catch(function (error) {
			if (error && error.name === "AbortError") return;
			self.toast("Record refresh delayed", "The completed change is saved, but the latest summary could not be reloaded.", "error");
		});
	};

	FileVaultV2.prototype.submitDocument = function (documentId) {
		var self = this;
		if (!documentId || this.state.busy.submit) return;
		this.state.busy.submit = true;
		this.render({ focusKey: "submit-" + documentId });
		this.request("POST", "/files/" + documentId + "/submit", {}).then(function (documentItem) {
			self.upsertDocument(documentItem);
			self.toast("Submitted for review", String(documentItem.name || "Document") + " is now in the review loop.", "success");
			self.playSuccessSound();
			return self.refreshAfterMutation();
		}).catch(function (error) {
			if (error && error.name === "AbortError") return;
			self.toast("Submission failed", errorMessage(error), "error");
		}).finally(function () {
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
		this.state.busy.comment = true;
		this.render({ focusKey: "workspace-comments" });
		this.request("POST", "/files/" + positiveInt(documentItem.id) + "/comments", { body: body }).then(function (comment) {
			var comments = Array.isArray(documentItem.comments) ? documentItem.comments : [];
			comments.push(comment);
			documentItem.comments = comments;
			documentItem.open_comment_count = Math.max(0, Number(documentItem.open_comment_count) || 0) + 1;
			self.upsertDocument(documentItem);
			self.toast("Comment posted", "The comment is stored on this document.", "success");
			self.playSuccessSound();
			return self.refreshAfterMutation();
		}).catch(function (error) {
			if (error && error.name === "AbortError") return;
			self.toast("Comment not posted", errorMessage(error), "error");
		}).finally(function () {
			self.state.busy.comment = false;
			self.render({ focusKey: "workspace-comments" });
		});
	};

	FileVaultV2.prototype.resolveComment = function (documentId, commentId) {
		var self = this;
		if (!documentId || !commentId || this.state.busy.resolve) return;
		this.state.busy.resolve = true;
		this.request("PUT", "/files/" + documentId + "/comments/" + encodeURIComponent(commentId) + "/resolve", {}).then(function (comment) {
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
			if (error && error.name === "AbortError") return;
			self.toast("Comment not resolved", errorMessage(error), "error");
		}).finally(function () { self.state.busy.resolve = false; });
	};

	FileVaultV2.prototype.saveReviewStatus = function () {
		var self = this;
		var documentItem = this.getDocument(this.state.selectedDocumentId);
		var status = this.state.reviewStatus;
		var note = this.state.reviewNote.trim();
		if (!documentItem || this.state.busy.review) return;
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
			self.upsertDocument(updated);
			self.state.documentDetail = updated;
			self.toast("Review status saved", String(updated.status_label || statusInfo(status).label) + " is now recorded.", "success");
			self.playSuccessSound();
			return self.refreshAfterMutation();
		}).catch(function (error) {
			if (error && error.name === "AbortError") return;
			self.toast("Status not saved", errorMessage(error), "error");
		}).finally(function () {
			self.state.busy.review = false;
			self.render({ focusKey: "workspace-score" });
		});
	};

	FileVaultV2.prototype.saveScore = function () {
		var self = this;
		var documentItem = this.getDocument(this.state.selectedDocumentId);
		if (!documentItem || this.state.busy.score) return;
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
			var scores = Array.isArray(documentItem.scores) ? documentItem.scores : [];
			scores.push(score);
			documentItem.scores = scores;
			documentItem.latest_score = score;
			self.upsertDocument(documentItem);
			self.toast("Score saved", String(score.total_score) + "/" + String(self.scoreMaximum(score, rubric)) + " is now recorded for v" + String(score.version) + ".", "success");
			self.playSuccessSound();
			return self.refreshAfterMutation();
		}).catch(function (error) {
			if (error && error.name === "AbortError") return;
			self.toast("Score not saved", errorMessage(error), "error");
		}).finally(function () {
			self.state.busy.score = false;
			self.render({ focusKey: "workspace-score" });
		});
	};

	FileVaultV2.prototype.downloadDocument = function (documentId, version, button) {
		var self = this;
		if (!documentId) return;
		if (button) {
			button.disabled = true;
			button.setAttribute("aria-busy", "true");
		}
		this.request("GET", "/files/" + documentId + "/download", null, version ? { version: version } : {}).then(function (payload) {
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
			self.toast("Secure download issued", "The signed link expires in " + String(expires) + " seconds.", "success");
		}).catch(function (error) {
			if (error && error.name === "AbortError") return;
			self.toast("Download unavailable", errorMessage(error), "error");
		}).finally(function () {
			if (button && document.contains(button)) {
				button.disabled = false;
				button.removeAttribute("aria-busy");
			}
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
		this.renderOverlay();
	};

	FileVaultV2.prototype.closeOverlay = function (options) {
		options = options || {};
		if (!this.state.overlay || !this.refs.overlay) return;
		if (this.state.overlay === "upload" && !options.keepUpload) this.abortUpload(true);
		this.state.overlay = "";
		if (!options.keepUpload) this.state.upload = null;
		this.refs.overlay.innerHTML = "";
		this.refs.overlay.hidden = true;
		this.refs.overlay.inert = true;
		this.refs.overlay.setAttribute("inert", "");
		if (this.refs.frame) {
			this.refs.frame.inert = false;
			this.refs.frame.removeAttribute("inert");
			this.refs.frame.removeAttribute("aria-hidden");
		}
		var returnFocus = this.returnFocus;
		this.returnFocus = null;
		if (options.restoreFocus !== false && returnFocus && document.contains(returnFocus) && typeof returnFocus.focus === "function") {
			returnFocus.focus({ preventScroll: true });
		}
	};

	FileVaultV2.prototype.renderOverlay = function () {
		var self = this;
		if (!this.refs.overlay || !this.state.overlay) return;
		var type = this.state.overlay;
		var content = "";
		var panelClass = "fv2-modal";
		var label = "File Vault dialog";
		if (type === "settings") {
			content = this.settingsMarkup();
			panelClass = "fv2-drawer";
			label = "File Vault settings";
		} else if (type === "upload") {
			content = this.uploadMarkup();
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
		}
		this.refs.overlay.innerHTML = '<div class="fv2-scrim" data-fv2-action="close-overlay" aria-hidden="true"></div><section class="fv2-overlay-panel ' + panelClass + '" data-fv2-overlay-panel role="dialog" aria-modal="true" aria-label="' + escAttr(label) + '">' + content + "</section>";
		window.requestAnimationFrame(function () {
			if (self.destroyed || !self.state.overlay) return;
			var preferred = self.refs.overlay.querySelector("[data-fv2-autofocus]");
			var focusable = preferred || self.focusableElements(self.refs.overlay)[0] || self.refs.overlay.querySelector("[data-fv2-overlay-panel]");
			if (focusable) {
				if (!focusable.hasAttribute("tabindex") && focusable.matches("[data-fv2-overlay-panel]")) focusable.setAttribute("tabindex", "-1");
				focusable.focus({ preventScroll: true });
			}
		});
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
			'<header class="fv2-overlay-header"><div><span>Preferences</span><h1>Settings</h1></div><button type="button" class="fv2-icon-button" data-fv2-action="close-overlay" data-fv2-autofocus aria-label="Close settings">' + icon("close") + "</button></header>",
			'<div class="fv2-settings-body">',
			'<section><h2>Appearance</h2>',
			'<div class="fv2-setting-row"><div><strong>Reduced motion</strong><span>' + (systemReduced ? "On because your operating system requests it." : "Reduce interface transitions and progress motion.") + '</span></div><button type="button" class="fv2-switch' + (reducedOn ? " is-on" : "") + '" role="switch" aria-checked="' + (reducedOn ? "true" : "false") + '" data-fv2-action="setting-reduced"' + (systemReduced ? " disabled" : "") + '><span></span><span class="fv2-sr-only">Toggle reduced motion</span></button></div>',
			'<div class="fv2-setting-row"><div><strong>Density</strong><span>Choose row spacing for repeated document work.</span></div><div class="fv2-segmented" role="group" aria-label="Interface density"><button type="button" data-fv2-action="setting-density" data-fv2-density="comfortable" class="' + (this.preferences.density === "comfortable" ? "is-active" : "") + '">Comfortable</button><button type="button" data-fv2-action="setting-density" data-fv2-density="compact" class="' + (this.preferences.density === "compact" ? "is-active" : "") + '">Compact</button></div></div>',
			"</section>",
			'<section><h2>Sound</h2>',
			'<div class="fv2-setting-row"><div><strong>Completion sound</strong><span>Off by default. Plays only for visible-tab success states.</span></div><button type="button" class="fv2-switch' + (this.preferences.sound ? " is-on" : "") + '" role="switch" aria-checked="' + (this.preferences.sound ? "true" : "false") + '" data-fv2-action="setting-sound"><span></span><span class="fv2-sr-only">Toggle completion sounds</span></button></div>',
			'<label class="fv2-setting-row fv2-volume"><div><strong>Volume</strong><span>' + esc(Math.round(this.preferences.volume * 100)) + '%</span></div><input type="range" min="0" max="1" step="0.05" value="' + escAttr(this.preferences.volume) + '" data-fv2-volume' + (this.preferences.sound ? "" : " disabled") + ' aria-label="Completion sound volume"></label>',
			"</section>",
			'<button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="reset-settings">Reset preferences</button>',
			"</div>"
		].join("");
	};

	FileVaultV2.prototype.openUpload = function (options) {
		options = options || {};
		if (!this.capability("upload")) {
			this.toast("Upload unavailable", "Your server role does not allow uploads in this Vault.", "error");
			return;
		}
		if (!this.storageReady()) {
			this.toast("Private storage unavailable", "Uploads are blocked until the server storage gate is restored.", "error");
			return;
		}
		if (this.roleIsStaff() && !this.state.selectedStudentId) {
			this.toast("Choose a student", "Select a server-scoped student before uploading.", "error");
			return;
		}
		var documentItem = options.documentId ? this.getDocument(options.documentId) : null;
		this.state.upload = {
			step: 1,
			documentId: documentItem ? positiveInt(documentItem.id) : 0,
			documentType: documentItem ? String(documentItem.document_type || "other") : String(options.documentType || ""),
			displayName: documentItem ? String(documentItem.name || "Document") : String(options.displayName || ""),
			note: "",
			readyForReview: false,
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
		this.state.upload.fileError = this.validateFile(this.state.upload.file, this.state.upload.documentType);
		this.openOverlay("upload");
	};

	FileVaultV2.prototype.uploadMarkup = function () {
		var upload = this.state.upload;
		if (!upload) return "";
		var title = upload.documentId ? "Upload new version" : "Add document";
		var steps = ["Details", "Review", "Upload"].map(function (label, index) {
			var number = index + 1;
			return '<li class="' + (upload.step === number ? "is-current" : (upload.step > number ? "is-complete" : "")) + '" aria-current="' + (upload.step === number ? "step" : "false") + '"><span>' + (upload.step > number ? icon("check") : number) + "</span><strong>" + esc(label) + "</strong></li>";
		}).join("");
		var body = upload.step === 1 ? this.uploadDetailsMarkup() : (upload.step === 2 ? this.uploadReviewMarkup() : this.uploadProgressMarkup());
		return '<header class="fv2-overlay-header"><div><span>Private signed upload</span><h1>' + esc(title) + '</h1></div><button type="button" class="fv2-icon-button" data-fv2-action="close-overlay" aria-label="Close upload">' + icon("close") + '</button></header><ol class="fv2-upload-steps" aria-label="Upload steps">' + steps + '</ol><div class="fv2-upload-body">' + body + "</div>";
	};

	FileVaultV2.prototype.uploadDetailsMarkup = function () {
		var upload = this.state.upload;
		var file = upload.file;
		var contract = this.uploadContract(upload.documentType);
		var fileTypeLabel = upload.documentType === "application_photo" ? "JPEG application photo" : (upload.documentType ? "PDF, DOCX, or PNG" : "PDF, DOCX, PNG, or JPEG");
		var fileSummary = file ? '<div class="fv2-file-choice ' + (upload.fileError ? "has-error" : "is-valid") + '">' + icon(upload.fileError ? "alert" : "file") + '<div><strong>' + esc(file.name) + "</strong><span>" + esc(formatSize(file.size)) + (upload.fileError ? " / " + esc(upload.fileError) : " / Ready to review") + "</span></div></div>" : '<div class="fv2-file-choice"><span class="fv2-file-glyph">' + icon("upload") + "</span><div><strong>No file chosen</strong><span>" + esc(fileTypeLabel) + " up to " + esc(formatSize(contract.maxFileSize)) + ".</span></div></div>";
		var typeField = upload.documentId
			? '<div class="fv2-field"><span>Document type</span><strong class="fv2-readonly-value">' + esc(this.documentTypeLabel(upload.documentType)) + "</strong></div>"
			: '<label class="fv2-field"><span>Document type</span><select data-fv2-upload-type required><option value="">Choose a document type</option>' + this.uploadTypeOptionsMarkup(upload.documentType) + "</select></label>";
		var ready = this.capability("submit") ? '<label class="fv2-check-row"><input type="checkbox" data-fv2-upload-ready' + (upload.readyForReview ? " checked" : "") + '><span>' + icon("check") + '</span><div><strong>Submit after upload</strong><small>Place the confirmed version into the staff review queue.</small></div></label>' : "";
		return '<div class="fv2-upload-file-field"><label class="fv2-button fv2-button-secondary" for="fv2-upload-file">' + icon("folder") + 'Choose file</label><input id="fv2-upload-file" type="file" accept="' + escAttr(this.uploadAccept(contract)) + '" data-fv2-upload-file><span>Files upload directly to private storage after review.</span></div>' + fileSummary + '<div class="fv2-form-grid">' + typeField + '<label class="fv2-field"><span>Display name</span><input type="text" maxlength="140" required value="' + escAttr(upload.displayName) + '" data-fv2-upload-name placeholder="Document name"></label></div><label class="fv2-field"><span>Version note</span><textarea rows="3" maxlength="1000" data-fv2-upload-note placeholder="Optional note about this file">' + esc(upload.note) + "</textarea></label>" + ready + '<div class="fv2-modal-actions"><button type="button" class="fv2-button fv2-button-secondary" data-fv2-action="close-overlay">Cancel</button><button type="button" class="fv2-button fv2-button-primary" data-fv2-action="upload-next" data-fv2-upload-next' + (this.uploadStepOneError() ? " disabled" : "") + ">Review" + icon("arrowRight") + "</button></div>";
	};

	FileVaultV2.prototype.uploadReviewMarkup = function () {
		var upload = this.state.upload;
		var file = upload.file;
		return '<section class="fv2-upload-review"><span>Confirm before transfer</span><h2>' + esc(upload.displayName || "Document") + '</h2><dl><div><dt>File</dt><dd>' + esc(file ? file.name : "No file") + "</dd></div><div><dt>Size</dt><dd>" + esc(file ? formatSize(file.size) : "0 B") + "</dd></div><div><dt>Type</dt><dd>" + esc(this.documentTypeLabel(upload.documentType)) + "</dd></div><div><dt>Workflow</dt><dd>" + esc(upload.readyForReview ? "Submit after confirmation" : "Keep as draft") + "</dd></div></dl>" + (upload.note ? '<div class="fv2-review-note"><span>Version note</span><p>' + esc(upload.note).replace(/\n/g, "<br>") + "</p></div>" : "") + '<p class="fv2-security-copy">' + icon("lock") + "The browser requests a short-lived signed URL, uploads the binary directly, then asks MissionMed to verify and confirm it.</p></section><div class=\"fv2-modal-actions\"><button type=\"button\" class=\"fv2-button fv2-button-secondary\" data-fv2-action=\"upload-back\">" + icon("arrowLeft") + 'Back</button><button type="button" class="fv2-button fv2-button-primary" data-fv2-action="upload-start">' + icon("upload") + "Start secure upload</button></div>";
	};

	FileVaultV2.prototype.uploadProgressMarkup = function () {
		var upload = this.state.upload;
		var phaseCopy = {
			idle: ["Ready to upload", "The secure transfer has not started."],
			hashing: ["Checking file integrity", "Your browser is calculating a SHA-256 checksum before requesting upload access."],
			signing: ["Requesting signed access", "MissionMed is creating a short-lived private upload URL."],
			transferring: ["Uploading to private storage", "Keep this window open while the binary transfers."],
			confirming: ["Verifying upload", "MissionMed is checking the stored object and finalizing the record."],
			success: ["Upload confirmed", "The server verified the private object and recorded the document."],
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
		var journey = this.state.data && this.state.data.journey;
		var match = (Array.isArray(journey && journey.items) ? journey.items : []).find(function (item) { return item.document_type === type; });
		if (match && match.label) return match.label;
		var documentItem = this.state.data && Array.isArray(this.state.data.documents) ? this.state.data.documents.find(function (candidate) { return candidate.document_type === type; }) : null;
		return documentItem && documentItem.name ? documentItem.name : (type === "other" ? "Other Document" : String(type || "Document").replace(/_/g, " "));
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
		return this.validateFile(upload.file, upload.documentType) || (!upload.documentType ? "Choose a document type." : "") || (!upload.displayName.trim() ? "Enter a display name." : "");
	};

	FileVaultV2.prototype.updateUploadNextButton = function () {
		var button = this.refs.overlay && this.refs.overlay.querySelector("[data-fv2-upload-next]");
		if (button) button.disabled = !!this.uploadStepOneError();
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

		function hash() {
			upload.currentStage = "hash";
			upload.retryStage = "hash";
			upload.phase = "hashing";
			upload.progress = 0;
			self.renderOverlay();
			return self.computeFileSha256(upload.file, upload.controller && upload.controller.signal).then(function (sha256) {
				upload.sha256 = sha256;
				return sign();
			});
		}

		function sign() {
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
				note: upload.note.trim(),
				ready_for_review: !!upload.readyForReview
			};
			if (self.roleIsStaff()) payload.student_id = self.state.selectedStudentId;
			var path = upload.documentId ? "/files/" + upload.documentId + "/versions" : "/uploads";
			return self.request("POST", path, payload, null, upload.controller && upload.controller.signal).then(function (intent) {
				if (!intent || !/^[a-f0-9-]{36}$/i.test(String(intent.upload_id || "")) || !/^[a-f0-9]{64}$/i.test(String(intent.confirm_token || "")) || !intent.upload_url || !intent.required_headers || typeof intent.required_headers !== "object") {
					throw new Error("The upload intent did not include the required secure fields.");
				}
				upload.intent = intent;
				return put();
			});
		}

		function put() {
			if (!upload.intent || !upload.intent.upload_url) throw new Error("The upload intent did not include a signed URL.");
			upload.currentStage = "put";
			upload.retryStage = "put";
			upload.phase = "transferring";
			upload.progress = 0;
			self.renderOverlay();
			var transfer = self.createUploadTransfer(upload.intent.upload_url, upload.file, upload.intent.required_headers, function (percent) {
				if (self.destroyed || !self.state.upload) return;
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
			upload.currentStage = "confirm";
			upload.retryStage = "confirm";
			upload.phase = "confirming";
			upload.progress = 100;
			self.renderOverlay();
			return self.request("POST", "/uploads/" + encodeURIComponent(upload.intent.upload_id) + "/confirm", { confirm_token: upload.intent.confirm_token }, null, upload.controller && upload.controller.signal).then(function (documentItem) {
				upload.result = documentItem;
				upload.phase = "success";
				upload.retryStage = "";
				upload.progress = 100;
				self.state.selectedDocumentId = positiveInt(documentItem.id);
				self.state.documentDetail = documentItem;
				self.upsertDocument(documentItem);
				self.render();
				self.renderOverlay();
				self.toast("Upload confirmed", String(documentItem.name || "Document") + " v" + String(documentItem.version || 1) + " is recorded.", "success");
				self.playSuccessSound();
				return self.refreshAfterMutation();
			});
		}

		var run = startAt === "confirm" ? confirm() : (startAt === "put" ? put() : (upload.sha256 && startAt !== "hash" ? sign() : hash()));
		Promise.resolve(run).catch(function (error) {
			if (self.destroyed || !self.state.upload) return;
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
		if (this.audioContext && typeof this.audioContext.close === "function") {
			try { this.audioContext.close(); } catch (error) { /* Optional audio cleanup. */ }
		}
		this.audioContext = null;
		this.returnFocus = null;
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

	function activateReplacementForCurrentRoute() {
		var runtime = integration.runtime;
		if (!runtime || !runtime.enabled || !isFileVaultRoute()) return;
		if (runtime.current && runtime.current.route === "filevault" && runtime.current.module !== integration.runtimeModule) {
			runtime.current.mounted = false;
			runtime.navigate("filevault");
		} else if (!runtime.current && typeof runtime.navigate === "function") {
			runtime.navigate("filevault");
		}
	}

	function publicMount(target, options) {
		var root = resolveRoot(target);
		if (!root) return Promise.reject(new Error("File Vault mount point was not found."));
		if (currentInstance) currentInstance.unmount();
		currentInstance = new FileVaultV2(root, options || {});
		return currentInstance.mount().then(function () { return currentInstance; });
	}

	function publicUnmount() {
		if (!currentInstance) return;
		var instance = currentInstance;
		currentInstance = null;
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
	window.setTimeout(function () {
		installLegacyPatch();
		registerRuntimeModule();
		activateReplacementForCurrentRoute();
		if ((!integration.runtime || !integration.runtime.enabled) && isFileVaultRoute() && !currentInstance) legacyRenderV2();
	}, 0);
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", function () {
			installLegacyPatch();
			registerRuntimeModule();
			activateReplacementForCurrentRoute();
		}, { once: true });
	}
}(window, document));
