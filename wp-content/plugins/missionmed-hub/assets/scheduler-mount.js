(function () {
	"use strict";

	var standaloneMount = null;
	var bundlePromise = null;
	var mountedRoot = null;
	var mountRunId = 0;
	var DEFAULT_SCHEDULER_ASSET_URL = "https://cdn.missionmedinstitute.com/html-system/LIVE/scheduler/scheduler_v1.html";

	function schedulerHtmlUrl() {
		return (window.MMED_OS && window.MMED_OS.scheduler_asset_url) || DEFAULT_SCHEDULER_ASSET_URL;
	}

	function escapeHTML(value) {
		return String(value === undefined || value === null ? "" : value)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}

	function queryTarget(selector) {
		return typeof selector === "string" ? document.querySelector(selector) : selector;
	}

	function installSchedulerArenaSuppressionStyle() {
		var styleId = "mmed-scheduler-arena-suppression";
		if (document.getElementById(styleId)) {
			return;
		}
		var style = document.createElement("style");
		style.id = styleId;
		style.textContent = [
			"#schedule-root .mm-arena-modebox",
			"#schedule-root .sos-arena-cta",
			".sos-scheduler-matrix-app-mode .mm-arena-modebox",
			".sos-scheduler-matrix-app-mode .sos-arena-cta"
		].join(",") + "{display:none!important;visibility:hidden!important;pointer-events:none!important;}";
		(document.head || document.documentElement).appendChild(style);
	}

	function isSchedulerAppModeHost(host) {
		return !!(
			(document.body && document.body.classList.contains("matrix-app-mode-scheduler")) ||
			(host && typeof host.closest === "function" && host.closest(".sos-scheduler-app-mode"))
		);
	}

	function schedulerSurfaceRoot(host) {
		if (!host || typeof host.closest !== "function") {
			return host || null;
		}
		return host.closest(".sos-scheduler-app-mode") || host.closest("#schedule-root") || host;
	}

	function removeSchedulerArenaArtifacts(host) {
		var scope = schedulerSurfaceRoot(host);
		if (!scope || typeof scope.querySelectorAll !== "function") {
			return;
		}

		function containsSchedulerBookingUi(node) {
			return !!(node && typeof node.querySelector === "function" && node.querySelector(
				"[data-booking-form], [data-action='next-step'], [data-action='confirm-booking'], .sos-sched-week, .sos-week-nav, .sos-booking-fields, .sos-panel-heading"
			));
		}

		scope.querySelectorAll(".sos-arena-cta").forEach(function (node) {
			node.remove();
		});

		scope.querySelectorAll("a[href*='/arena'], a[href*='homepage-arena'], a[href='#arena']").forEach(function (link) {
			var node = link;
			var candidate = null;
			for (var depth = 0; node && node !== scope && depth < 7; depth++) {
				var text = String(node.textContent || "").replace(/\s+/g, " ").trim();
				var className = String(node.className || "");
				if (/enter\s+arena|missionmed\s+arena|play\s+now|daily\s+rounds|timed\s+duels|clinical\s+pressure/i.test(text) || /\barena\b|\bfomo\b/i.test(className)) {
					candidate = node;
				}
				if (candidate && (node.tagName === "SECTION" || node.tagName === "ARTICLE" || /\bsos-card\b|\bcard\b|\bcta\b|\bpcard\b|\bmodule\b/i.test(className))) {
					break;
				}
				node = node.parentElement;
			}
			if (candidate && candidate !== scope && !candidate.closest("nav,header,footer,.main-navigation")) {
				if (containsSchedulerBookingUi(candidate)) {
					link.remove();
				} else {
					candidate.remove();
				}
			}
		});
	}

	function installSchedulerSurfaceGuard(host) {
		var scope = schedulerSurfaceRoot(host);
		if (!scope || scope.__mmedSchedulerSurfaceGuard || typeof MutationObserver === "undefined") {
			return;
		}
		scope.__mmedSchedulerSurfaceGuard = new MutationObserver(function () {
			window.requestAnimationFrame(function () {
				removeSchedulerArenaArtifacts(scope);
			});
		});
		scope.__mmedSchedulerSurfaceGuard.observe(scope, { childList: true, subtree: true });
	}

	function repairSchedulerEmptyFlow(root) {
		var scheduler = window.MMEDScheduler;
		var flow = root && root.querySelector ? root.querySelector(".sos-book-flow") : null;
		var state = scheduler && scheduler.state ? scheduler.state : null;
			if (!scheduler || !scheduler.render || typeof scheduler.render.page !== "function" || !state || !flow) {
				return false;
			}
			if (state.loading || state.catalogLoading || state.availabilityLoading) {
				return false;
			}
			var stepTwoDataReady = state.bookingStep === 2 && !state.availabilityLoading && Array.isArray(state.slots) && state.slots.length > 0;
			var stepThreeReady = state.bookingStep === 3 && !state.availabilityLoading;
			if ((stepTwoDataReady || stepThreeReady) && !flow.children.length) {
				scheduler.render.page(state.route || "book");
				flow = root && root.querySelector ? root.querySelector(".sos-book-flow") : null;
				return !!(flow && flow.children.length);
			}
			return false;
		}

	function installSchedulerFlowGuard(root) {
		if (!root || root.__mmedSchedulerFlowGuard) {
			return;
		}
			var attempts = 0;
			root.__mmedSchedulerFlowGuard = window.setInterval(function () {
				if (!root.isConnected) {
					window.clearInterval(root.__mmedSchedulerFlowGuard);
					root.__mmedSchedulerFlowGuard = null;
					return;
				}
				removeSchedulerArenaArtifacts(root);
				if (repairSchedulerEmptyFlow(root)) {
					attempts += 1;
				}
			if (attempts >= 5) {
				window.clearInterval(root.__mmedSchedulerFlowGuard);
				root.__mmedSchedulerFlowGuard = null;
			}
		}, 350);
		window.setTimeout(function () {
			if (root.__mmedSchedulerFlowGuard) {
				window.clearInterval(root.__mmedSchedulerFlowGuard);
				root.__mmedSchedulerFlowGuard = null;
			}
		}, 60000);
	}

	function extractFirstStyle(html) {
		var match = String(html || "").match(/<style[^>]*>([\s\S]*?)<\/style>/i);
		return match ? match[1] : "";
	}

	function extractSchedulerScript(html) {
		var scripts = String(html || "").match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
		for (var i = scripts.length - 1; i >= 0; i--) {
			if (scripts[i].indexOf("window.MMEDScheduler = scheduler") !== -1) {
				return rewriteSchedulerScript(scripts[i].replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, ""));
			}
		}
		return "";
	}

	/**
	 * MX-APPT-5002B — patch integrity assertions.
	 *
	 * These patches are byte-exact string replacements against a CDN bundle that is served
	 * no-store, is unversioned and carries no SRI. Before MX-APPT-5002 a patch that stopped
	 * matching returned the input unchanged with no log, no counter and no assertion, so a
	 * single whitespace change upstream could silently revert a behaviour fix with no signal
	 * anywhere.
	 *
	 * Patches are identified by the first non-empty line of their search text plus its byte
	 * length, so no call site had to change. Regenerate the table with:
	 *   node _SYSTEM/tools/scheduler_patch_audit.mjs --emit-expectations \
	 *     > _SYSTEM/tools/scheduler_patch_expectations.json
	 *
	 * expected: 0 means a deliberate no-op, not a failure. See the notes below.
	 *
	 * Expectations are keyed by canonical source revision, because the adapter has to keep
	 * working against two bundles at once: the legacy CDN artifact that is live today, and the
	 * canonical source (MX-APPT-5002A) once it is published. Several patches had their
	 * behaviour folded into the canonical source, so they are correctly no-ops there while
	 * still being required against legacy. A bundle with no MMED_SCHEDULER_SOURCE_REV marker
	 * is the legacy artifact.
	 *
	 * Keep this table in step with _SYSTEM/tools/scheduler_patch_expectations.json.
	 */
	var SCHEDULER_PATCH_PROFILES = {
		legacy: {
			"function matrixTimeRows() {/525": { id: "P01-matrix-time-rows-slot-derived", expected: 1, required: true },
			"function slotForMatrixCell(dateKey, timeKey) {/52": { id: "P02-slot-for-matrix-cell", expected: 1, required: true },
			"var isSelected = slot && scheduler.state.selectedSlotKey ===/678": { id: "P03-grid-cell-selected-state", expected: 1, required: true },
			"function selectDetailsStep() {/1223": { id: "P04-select-details-step", expected: 1, required: true },
			// Deliberate no-op. Dual-variant fallback: exactly one of variant A / variant B
			// matches by design. Variant B (P09) carries the change.
			"function reviewConfirmStep() {/1349": { id: "P05-review-confirm-step-variant-A", expected: 0, required: true },
			"function reviewConfirmStep() {/1566": { id: "P09-review-confirm-step-variant-B", expected: 1, required: true },
			"function visitTypeSelectMarkup() {/858": { id: "P06-visit-type-select-markup", expected: 1, required: true },
			"function mentorSelectMarkup() {/730": { id: "P07-mentor-select-markup", expected: 1, required: true },
			"refs.content.querySelectorAll(\"[data-slot-key]\").forEach(fun/350": { id: "P10-slot-button-delegation", expected: 1, required: true },
			"scheduler.state.division = divisionSelect.value;/329": { id: "P11-division-change-handler", expected: 1, required: true },
			"scheduler.state.appointmentTypeId = typeSelect.value;/274": { id: "P12-appointment-type-change-handler", expected: 1, required: true },
			"function loadProviders() {/882": { id: "P08-load-providers", expected: 1, required: true },
			// Deliberate no-op. The legacy bundle already contains this patched form (the
			// appointment_type_id fallback), so the patch is redundant, not lost.
			"scheduler.api.post(\"/book\", {/301": { id: "P13-book-appointment-type-fallback", expected: 0, required: true }
		},
		"MX-APPT-5002C": {
			// Folded into the canonical source; retained for the legacy bundle.
			"function matrixTimeRows() {/525": { id: "P01-matrix-time-rows-slot-derived", expected: 0, required: true },
			// Guarded in rewriteSchedulerScript by an indexOf check, so it does not execute
			// against the canonical source at all and produces no result row.
			"function slotForMatrixCell(dateKey, timeKey) {/52": { id: "P02-slot-for-matrix-cell", expected: 0, required: false },
			"var isSelected = slot && scheduler.state.selectedSlotKey ===/678": { id: "P03-grid-cell-selected-state", expected: 0, required: true },
			"function selectDetailsStep() {/1223": { id: "P04-select-details-step", expected: 1, required: true },
			"function reviewConfirmStep() {/1349": { id: "P05-review-confirm-step-variant-A", expected: 0, required: true },
			"function reviewConfirmStep() {/1566": { id: "P09-review-confirm-step-variant-B", expected: 1, required: true },
			"function visitTypeSelectMarkup() {/858": { id: "P06-visit-type-select-markup", expected: 1, required: true },
			"function mentorSelectMarkup() {/730": { id: "P07-mentor-select-markup", expected: 1, required: true },
			"refs.content.querySelectorAll(\"[data-slot-key]\").forEach(fun/350": { id: "P10-slot-button-delegation", expected: 0, required: true },
			"scheduler.state.division = divisionSelect.value;/329": { id: "P11-division-change-handler", expected: 1, required: true },
			"scheduler.state.appointmentTypeId = typeSelect.value;/274": { id: "P12-appointment-type-change-handler", expected: 1, required: true },
			"function loadProviders() {/882": { id: "P08-load-providers", expected: 1, required: true },
			"scheduler.api.post(\"/book\", {/301": { id: "P13-book-appointment-type-fallback", expected: 0, required: true }
		}
	};
	// MX-APPT-5003G changes presentation only. The Classic core and every folded
	// MX-APPT-5002 repair retain the same byte-exact adapter expectations.
	SCHEDULER_PATCH_PROFILES["MX-APPT-5003G"] = SCHEDULER_PATCH_PROFILES["MX-APPT-5002C"];

	var SCHEDULER_PATCH_EXPECTATIONS = SCHEDULER_PATCH_PROFILES.legacy;
	var schedulerSourceRev = "legacy";

	function selectSchedulerPatchProfile(scriptText) {
		var match = String(scriptText || "").match(/MMED_SCHEDULER_SOURCE_REV\s*=\s*"([^"]+)"/);
		schedulerSourceRev = (match && match[1]) || "legacy";
		SCHEDULER_PATCH_EXPECTATIONS = SCHEDULER_PATCH_PROFILES[schedulerSourceRev] || null;
		return SCHEDULER_PATCH_EXPECTATIONS !== null;
	}

	var schedulerPatchResults = [];

	function schedulerPatchKey(search) {
		var text = String(search);
		var parts = text.split("\n");
		var head = "";
		for (var i = 0; i < parts.length; i++) {
			var trimmed = parts[i].replace(/^\s+|\s+$/g, "");
			if (trimmed) { head = trimmed; break; }
		}
		return head.slice(0, 60) + "/" + text.length;
	}

	function replaceSchedulerText(text, search, replacement) {
		var key = schedulerPatchKey(search);
		var spec = SCHEDULER_PATCH_EXPECTATIONS ? SCHEDULER_PATCH_EXPECTATIONS[key] : null;
		var actual = text.split(search).length - 1;
		schedulerPatchResults.push({
			id: spec ? spec.id : "UNREGISTERED",
			key: key,
			expected: spec ? spec.expected : null,
			actual: actual,
			required: spec ? spec.required !== false : false,
			status: !spec ? "UNREGISTERED" : (actual === spec.expected ? "PASS" : "FAIL")
		});
		return actual === 0 ? text : text.split(search).join(replacement);
	}

	function schedulerDiagnosticsEnabled() {
		try {
			if (window.MMED_OS && window.MMED_OS.scheduler_diagnostics) { return true; }
			return String((window.location && window.location.search) || "").indexOf("mmed_scheduler_debug=1") !== -1;
		} catch (e) {
			return false;
		}
	}

	/**
	 * Result of the last patch pass. Read by diagnostics and, in a later ticket, by the V2
	 * gate: a required-patch failure must keep the student on V1 rather than serve a partially
	 * patched V2.
	 *
	 * This deliberately does NOT block V1. V1 ships today with two expected no-ops, and hard
	 * failing here would take down a working booking flow — the opposite of fail-safe.
	 */
	function schedulerPatchAudit() {
		var failures = [];
		for (var i = 0; i < schedulerPatchResults.length; i++) {
			var result = schedulerPatchResults[i];
			if (result.required && result.status !== "PASS") { failures.push(result); }
		}
		return {
			ok: failures.length === 0 && SCHEDULER_PATCH_EXPECTATIONS !== null,
			sourceRev: schedulerSourceRev,
			knownProfile: SCHEDULER_PATCH_EXPECTATIONS !== null,
			total: schedulerPatchResults.length,
			failures: failures,
			results: schedulerPatchResults.slice()
		};
	}

	function reportSchedulerPatchAudit() {
		var audit = schedulerPatchAudit();
		try { window.MMEDSchedulerPatchAudit = audit; } catch (e) {}
		if (!audit.knownProfile) {
			if (typeof console !== "undefined" && console.error) {
				console.error(
					"[MMED Scheduler] unknown bundle revision \"" + audit.sourceRev + "\". This adapter " +
					"has no patch expectations for it, so patch integrity cannot be asserted. V1 continues; " +
					"do not enable V2 until this adapter is updated."
				);
			}
		} else if (!audit.ok) {
			if (typeof console !== "undefined" && console.error) {
				console.error(
					"[MMED Scheduler] patch integrity FAILED — " + audit.failures.length + " of " +
					audit.total + " required patches did not match on bundle revision \"" + audit.sourceRev +
					"\". The bundle has changed underneath the adapter. V1 continues; do not enable V2 " +
					"until this is resolved.",
					audit.failures
				);
			}
		} else if (schedulerDiagnosticsEnabled() && typeof console !== "undefined" && console.info) {
			console.info(
				"[MMED Scheduler] patch integrity OK — " + audit.total + "/" + audit.total +
				" patches as expected on bundle revision \"" + audit.sourceRev + "\"."
			);
		}
		return audit;
	}

	function rewriteSchedulerScript(scriptText) {
		schedulerPatchResults.length = 0;
		selectSchedulerPatchProfile(scriptText);
		var text = String(scriptText || "")
			.replace(/fetch\((["'])\/api\/auth\/session(?!\?mm_scheduler_exchange=1&audience=scheduler)\1/g, "fetch($1/api/auth/session?mm_scheduler_exchange=1&audience=scheduler$1")
			.replace(/\/api\/auth\/session\?mm_scheduler_exchange=1&audience=scheduler\?mm_scheduler_exchange=1&audience=scheduler/g, "/api/auth/session?mm_scheduler_exchange=1&audience=scheduler")
			.split("scheduler.mount();").join("window.MMEDSchedulerAutoMountSuppressed = true;");
		text = replaceSchedulerText(text, [
			'      function matrixTimeRows() {',
			'        var defaultRows = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];',
			'        var keys = {};',
			'        defaultRows.forEach(function (key) { keys[key] = true; });',
			'        sortedSlots().forEach(function (slot) {',
			'          keys[easternTimeKey(slotStart(slot))] = true;',
			'        });',
			'        return Object.keys(keys).sort().map(function (key) {',
			'          return { key: key, label: matrixTimeLabel(key) };',
			'        });',
			'      }'
		].join("\n"), [
			'      function matrixTimeRows() {',
			'        var keys = {};',
			'        sortedSlots().forEach(function (slot) {',
			'          var start = slotStart(slot);',
			'          if (start) {',
			'            keys[easternTimeKey(start)] = true;',
			'          }',
			'        });',
			'        return Object.keys(keys).sort().map(function (key) {',
			'          return { key: key, label: matrixTimeLabel(key) };',
			'        });',
			'      }'
		].join("\n"));
		if (text.indexOf("function matrixSlotReserved") === -1) {
			text = replaceSchedulerText(text, '      function slotForMatrixCell(dateKey, timeKey) {', [
				'      function matrixSlotReserved(slot) {',
				'        var status = String(slot && (slot.status || slot.state || slot.availability_status || slot.availabilityStatus) || "").toLowerCase();',
				'        return status.indexOf("reserv") >= 0 || status.indexOf("book") >= 0 || status.indexOf("held") >= 0 || status.indexOf("unavailable") >= 0;',
				'      }',
				'',
				'      function slotForMatrixCell(dateKey, timeKey) {'
			].join("\n"));
		}
		text = replaceSchedulerText(text, [
			'              var isSelected = slot && scheduler.state.selectedSlotKey === slotKey(slot);',
			'              var cellClasses = ["sos-sched-grid-cell"];',
			'              if (slot) cellClasses.push("is-open");',
			'              if (isSelected) cellClasses.push("is-selected");',
			'              return [',
			'                \'<div class="\' + cellClasses.join(" ") + \'" role="gridcell">\',',
			'                slot ? \'<button class="sos-sched-open-slot" type="button" data-slot-key="\' + escapeAttr(slotKey(slot)) + \'" aria-pressed="\' + String(isSelected) + \'">\' + escapeHTML(isSelected ? "Selected" : "Open") + \'</button>\' : \'<div class="sos-sched-empty" aria-hidden="true"></div>\',',
			'                \'</div>\''
		].join("\n"), [
			'              var isSelected = slot && scheduler.state.selectedSlotKey === slotKey(slot);',
			'              var isReserved = slot && matrixSlotReserved(slot);',
			'              var cellClasses = ["sos-sched-grid-cell"];',
			'              if (slot) cellClasses.push(isReserved ? "is-reserved" : "is-open");',
			'              if (isSelected) cellClasses.push("is-selected");',
			'              return [',
			'                \'<div class="\' + cellClasses.join(" ") + \'" role="gridcell">\',',
			'                slot ? (isReserved ? \'<div class="sos-sched-reserved-slot">Reserved</div>\' : \'<button class="sos-sched-open-slot" type="button" data-slot-key="\' + escapeAttr(slotKey(slot)) + \'" aria-pressed="\' + String(isSelected) + \'">\' + escapeHTML(isSelected ? "Selected" : "Open") + \'</button>\') : \'<div class="sos-sched-empty" aria-hidden="true"></div>\',',
			'                \'</div>\''
		].join("\n"));
		text = replaceSchedulerText(text, [
			'      function selectDetailsStep() {',
			'        var type = selectedAppointmentType();',
			'        var canContinue = Boolean(scheduler.state.division && scheduler.state.appointmentTypeId && scheduler.state.providerId && !isTypeLocked(type));',
			'        return [',
			'          \'<form class="sos-card sos-card-pad" data-booking-form>\',',
			'          \'<div class="sos-booking-fields">\',',
			'          divisionSelectMarkup(),',
			'          scheduler.state.division ? visitTypeSelectMarkup() : "",',
			'          scheduler.state.appointmentTypeId ? mentorSelectMarkup() : "",',
			'          "</div>",',
			'          scheduler.state.catalogLoading ? \'<div class="sos-notice"><strong>Loading appointment options</strong><span>Program options are loading from the Scheduler API.</span></div>\' : "",',
			'          scheduler.state.division && !visitTypeOptions().length ? noVisitTypesNoticeMarkup() : "",',
			'          lockedTypeNoticeMarkup(type),',
			'          \'<div class="sos-form-actions">\',',
			'          \'<button class="sos-btn sos-btn-primary" type="button" data-action="next-step"\' + (canContinue ? "" : " disabled") + ">Next</button>",',
			'          \'<span class="sos-pill sos-tier-medium">Eastern / New York</span>\',',
			'          "</div>",',
			'          "</form>"',
			'        ].join("");',
			'      }'
		].join("\n"), [
			'      function schedulerInlineLoaderMarkup(kind, title, copy) {',
			'        return \'<div class="sos-sched-inline-loader" data-loading-kind="\' + escapeAttr(kind || "scheduler") + \'"><span class="sos-sched-inline-dot"></span><div><strong>\' + escapeHTML(title || "Loading") + \'</strong><small>\' + escapeHTML(copy || "One moment while Scheduler updates these options.") + \'</small></div><i></i></div>\';',
			'      }',
			'',
			'      function selectDetailsStep() {',
			'        var type = selectedAppointmentType();',
			'        var canContinue = Boolean(scheduler.state.division && scheduler.state.appointmentTypeId && scheduler.state.providerId && !isTypeLocked(type));',
			'        return [',
			'          \'<form class="sos-card sos-card-pad" data-booking-form>\',',
			'          \'<div class="sos-booking-fields sos-booking-fields-ready">\',',
			'          divisionSelectMarkup(),',
			'          visitTypeSelectMarkup(),',
			'          mentorSelectMarkup(),',
			'          "</div>",',
			'          scheduler.state.catalogLoading ? schedulerInlineLoaderMarkup("catalog", "Loading appointment types", "Checking the Scheduler API for this account.") : "",',
			'          scheduler.state.appointmentTypeUiLoading ? schedulerInlineLoaderMarkup("appointment-types", "Loading appointment types", "Filtering visit types for " + (selectedDivisionName() || "this division") + ".") : "",',
			'          scheduler.state.providersLoading ? schedulerInlineLoaderMarkup("mentors", "Loading available mentors", "Checking mentor availability for this appointment type.") : "",',
			'          scheduler.state.division && !scheduler.state.appointmentTypeUiLoading && !visitTypeOptions().length ? noVisitTypesNoticeMarkup() : "",',
			'          lockedTypeNoticeMarkup(type),',
			'          \'<div class="sos-form-actions">\',',
			'          \'<button class="sos-btn sos-btn-primary" type="button" data-action="next-step"\' + (canContinue ? "" : " disabled") + ">Next</button>",',
			'          \'<span class="sos-pill sos-tier-medium">Eastern / New York</span>\',',
			'          "</div>",',
			'          "</form>"',
			'        ].join("");',
			'      }'
		].join("\n"));
		text = replaceSchedulerText(text, [
			'      function reviewConfirmStep() {',
			'        var type = selectedAppointmentType();',
			'        var provider = selectedProvider();',
			'        var slot = selectedSlot();',
			'        var canConfirm = Boolean(type && provider && slot);',
			'        return [',
			'          \'<section class="sos-card sos-card-pad">\',',
			'          \'<div class="sos-panel-title">Review & Confirm</div>\',',
			'          \'<h2 class="sos-panel-heading">Confirm your session</h2>\',',
			'          \'<p class="sos-panel-copy">Review the details before we reserve the time through the MissionMed scheduler.</p>\',',
			'          selectedSummaryRows(true),',
			'          reviewPreferencesMarkup(type),',
			'          \'<div class="sos-meeting-note">\' + escapeHTML(meetingExpectationCopy()) + \'</div>\',',
			'          \'<div class="sos-sched-help">You can request a change later from your appointment list when reschedule or cancellation rules allow it.</div>\',',
			'          \'<div class="sos-form-actions">\',',
			'          \'<button class="sos-btn" type="button" data-action="previous-step">Back</button>\',',
			'          \'<button class="sos-btn sos-btn-primary" type="button" data-action="confirm-booking"\' + (canConfirm ? "" : " disabled") + ">Confirm session</button>",',
			'          \'<span class="sos-pill sos-tier-medium">\' + escapeHTML(scheduler.state.bookingState) + "</span>",',
			'          "</div>",',
			'          "</section>"',
			'        ].join("");',
			'      }'
		].join("\n"), [
			'      function reviewConfirmStep() {',
			'        var type = selectedAppointmentType();',
			'        var provider = selectedProvider();',
			'        var slot = selectedSlot();',
			'        var canConfirm = Boolean(type && provider && slot);',
			'        return [',
			'          \'<section class="sos-card sos-card-pad sos-review-compact">\',',
			'          \'<div class="sos-panel-title">Review & Confirm</div>\',',
			'          \'<h2 class="sos-panel-heading">Confirm your session</h2>\',',
			'          \'<p class="sos-panel-copy">Review the details before we reserve the time through the MissionMed scheduler.</p>\',',
			'          selectedSummaryRows(false),',
			'          reviewPreferencesMarkup(type),',
			'          \'<div class="sos-meeting-note">\' + escapeHTML(meetingExpectationCopy()) + \'</div>\',',
			'          \'<div class="sos-form-actions">\',',
			'          \'<button class="sos-btn" type="button" data-action="previous-step">Back</button>\',',
			'          \'<button class="sos-btn sos-btn-primary" type="button" data-action="confirm-booking"\' + (canConfirm ? "" : " disabled") + ">Confirm session</button>",',
			'          \'<span class="sos-pill sos-tier-medium">\' + escapeHTML(scheduler.state.bookingState) + "</span>",',
			'          "</div>",',
			'          "</section>"',
			'        ].join("");',
			'      }'
		].join("\n"));
		text = replaceSchedulerText(text, [
			'      function reviewConfirmStep() {',
			'        var type = selectedAppointmentType();',
			'        var provider = selectedProvider();',
			'        var slot = selectedSlot();',
			'        var isSubmitting = scheduler.state.bookingSubmitting || scheduler.state.bookingState === "Sending";',
			'        var canConfirm = Boolean(type && provider && slot && !isSubmitting && !scheduler.state.bookingConfirmed);',
			'        return [',
			'          \'<section class="sos-card sos-card-pad">\',',
			'          \'<div class="sos-panel-title">Review & Confirm</div>\',',
			'          \'<h2 class="sos-panel-heading">Confirm your session</h2>\',',
			'          \'<p class="sos-panel-copy">Review the details before we reserve the time through the MissionMed scheduler.</p>\',',
			'          selectedSummaryRows(true),',
			'          reviewPreferencesMarkup(type),',
			'          \'<div class="sos-meeting-note">\' + escapeHTML(meetingExpectationCopy()) + \'</div>\',',
			'          \'<div class="sos-sched-help">You can request a change later from your appointment list when reschedule or cancellation rules allow it.</div>\',',
			'          \'<div class="sos-form-actions">\',',
			'          \'<button class="sos-btn" type="button" data-action="previous-step">Back</button>\',',
			'          \'<button class="sos-btn sos-btn-primary" type="button" data-action="confirm-booking"\' + (canConfirm ? "" : " disabled") + ">" + escapeHTML(isSubmitting ? "Confirming..." : "Confirm session") + "</button>",',
			'          \'<span class="sos-pill sos-tier-medium">\' + escapeHTML(scheduler.state.bookingState) + "</span>",',
			'          "</div>",',
			'          "</section>"',
			'        ].join("");',
			'      }'
		].join("\n"), [
			'      function reviewConfirmStep() {',
			'        var type = selectedAppointmentType();',
			'        var provider = selectedProvider();',
			'        var slot = selectedSlot();',
			'        var isSubmitting = scheduler.state.bookingSubmitting || scheduler.state.bookingState === "Sending";',
			'        var canConfirm = Boolean(type && provider && slot && !isSubmitting && !scheduler.state.bookingConfirmed);',
			'        return [',
			'          \'<section class="sos-card sos-card-pad sos-review-compact">\',',
			'          \'<div class="sos-panel-title">Review & Confirm</div>\',',
			'          \'<h2 class="sos-panel-heading">Confirm your session</h2>\',',
			'          \'<p class="sos-panel-copy">Review the details before we reserve the time through the MissionMed scheduler.</p>\',',
			'          selectedSummaryRows(false),',
			'          reviewPreferencesMarkup(type),',
			'          \'<div class="sos-meeting-note">\' + escapeHTML(meetingExpectationCopy()) + \'</div>\',',
			'          \'<div class="sos-form-actions">\',',
			'          \'<button class="sos-btn" type="button" data-action="previous-step">Back</button>\',',
			'          \'<button class="sos-btn sos-btn-primary" type="button" data-action="confirm-booking"\' + (canConfirm ? "" : " disabled") + ">" + escapeHTML(isSubmitting ? "Confirming..." : "Confirm session") + "</button>",',
			'          \'<span class="sos-pill sos-tier-medium">\' + escapeHTML(scheduler.state.bookingState) + "</span>",',
			'          "</div>",',
			'          "</section>"',
			'        ].join("");',
			'      }'
		].join("\n"));
		text = replaceSchedulerText(text, [
			'      function visitTypeSelectMarkup() {',
			'        var options = visitTypeOptions();',
			'        return [',
			'          \'<div class="sos-field">\',',
			'          \'<label for="schedule-appointment-type">Type of appointment</label>\',',
			'          \'<select id="schedule-appointment-type" name="appointment-type">\',',
			'          \'<option value="">Choose appointment type</option>\',',
			'          options.map(function (option) {',
			'            var locked = isTypeLocked(option.type);',
			'            var suffix = locked ? " · locked" : entitlementSuffix(option.type);',
			'            return \'<option value="\' + escapeAttr(option.type.id) + \'"\' + (scheduler.state.appointmentTypeId === option.type.id ? " selected" : "") + (locked ? " disabled" : "") + ">" + escapeHTML(option.label + suffix) + "</option>";',
			'          }).join(""),',
			'          "</select>",',
			'          "</div>"',
			'        ].join("");',
			'      }'
		].join("\n"), [
			'      function visitTypeSelectMarkup() {',
			'        var options = visitTypeOptions();',
			'        var disabled = !scheduler.state.division || scheduler.state.appointmentTypeUiLoading || scheduler.state.catalogLoading;',
			'        var placeholder = !scheduler.state.division ? "Choose a division first" : (scheduler.state.appointmentTypeUiLoading || scheduler.state.catalogLoading ? "Loading appointment types..." : "Choose appointment type");',
			'        return [',
			'          \'<div class="sos-field sos-field-select-type">\',',
			'          \'<label for="schedule-appointment-type">Type of appointment</label>\',',
			'          \'<select id="schedule-appointment-type" name="appointment-type"\' + (disabled ? " disabled" : "") + ">",',
			'          \'<option value="">\' + escapeHTML(placeholder) + "</option>",',
			'          options.map(function (option) {',
			'            var locked = isTypeLocked(option.type);',
			'            var suffix = locked ? " · locked" : entitlementSuffix(option.type);',
			'            return \'<option value="\' + escapeAttr(option.type.id) + \'"\' + (scheduler.state.appointmentTypeId === option.type.id ? " selected" : "") + (locked ? " disabled" : "") + ">" + escapeHTML(option.label + suffix) + "</option>";',
			'          }).join(""),',
			'          "</select>",',
			'          "</div>"',
			'        ].join("");',
			'      }'
		].join("\n"));
		text = replaceSchedulerText(text, [
			'      function mentorSelectMarkup() {',
			'        var options = mentorOptions();',
			'        return [',
			'          \'<div class="sos-field">\',',
			'          \'<label for="schedule-provider">Mentor</label>\',',
			'          \'<select id="schedule-provider" name="provider">\',',
			'          \'<option value="">Choose a mentor</option>\',',
			'          options.map(function (option) {',
			'            var suffix = option.availableSoon ? " · availability coming soon" : "";',
			'            return \'<option value="\' + escapeAttr(option.provider.id) + \'"\' + (scheduler.state.providerId === option.provider.id ? " selected" : "") + ">" + escapeHTML(option.label + suffix) + "</option>";',
			'          }).join(""),',
			'          "</select>",',
			'          "</div>"',
			'        ].join("");',
			'      }'
		].join("\n"), [
			'      function mentorSelectMarkup() {',
			'        var options = mentorOptions();',
			'        var disabled = !scheduler.state.appointmentTypeId || scheduler.state.providersLoading;',
			'        var placeholder = !scheduler.state.appointmentTypeId ? "Choose appointment type first" : (scheduler.state.providersLoading ? "Loading available mentors..." : (options.length ? "Choose a mentor" : "No mentors available yet"));',
			'        return [',
			'          \'<div class="sos-field sos-field-select-provider">\',',
			'          \'<label for="schedule-provider">Mentor</label>\',',
			'          \'<select id="schedule-provider" name="provider"\' + (disabled ? " disabled" : "") + ">",',
			'          \'<option value="">\' + escapeHTML(placeholder) + "</option>",',
			'          options.map(function (option) {',
			'            var suffix = option.availableSoon ? " · availability coming soon" : "";',
			'            return \'<option value="\' + escapeAttr(option.provider.id) + \'"\' + (scheduler.state.providerId === option.provider.id ? " selected" : "") + ">" + escapeHTML(option.label + suffix) + "</option>";',
			'          }).join(""),',
			'          "</select>",',
			'          "</div>"',
			'        ].join("");',
			'      }'
		].join("\n"));
		text = replaceSchedulerText(text, [
			'        refs.content.querySelectorAll("[data-slot-key]").forEach(function (button) {',
			'          button.addEventListener("click", function () {',
			'            clickFeedback(button);',
			'            scheduler.state.selectedSlotKey = button.getAttribute("data-slot-key") || "";',
			'            scheduler.render.page(scheduler.state.route);',
			'          });',
			'        });'
		].join("\n"), [
			'        refs.content.querySelectorAll("[data-slot-key]").forEach(function (button) {',
			'          button.addEventListener("click", function () {',
			'            clickFeedback(button);',
			'            scheduler.state.selectedSlotKey = button.getAttribute("data-slot-key") || "";',
			'            var clickedSlot = selectedSlot();',
			'            if (clickedSlot) {',
			'              scheduler.state.providerId = String(clickedSlot.provider_id || clickedSlot.providerId || scheduler.state.providerId || "");',
			'              scheduler.state.appointmentTypeId = String(clickedSlot.appointment_type_id || clickedSlot.appointmentTypeId || scheduler.state.appointmentTypeId || "");',
			'            }',
			'            scheduler.render.page(scheduler.state.route);',
			'          });',
			'        });'
		].join("\n"));
		text = replaceSchedulerText(text, [
			'            scheduler.state.division = divisionSelect.value;',
			'            scheduler.state.appointmentTypeId = "";',
			'            scheduler.state.providerId = "";',
			'            scheduler.state.selectedSlotKey = "";',
			'            scheduler.state.slots = [];',
			'            scheduler.state.bookingStep = 1;',
			'            renderBookingStepOnly();'
		].join("\n"), [
			'            scheduler.state.division = divisionSelect.value;',
			'            scheduler.state.appointmentTypeId = "";',
			'            scheduler.state.providerId = "";',
			'            scheduler.state.selectedSlotKey = "";',
			'            scheduler.state.slots = [];',
			'            scheduler.state.providers = [];',
			'            scheduler.state.providersLoading = false;',
			'            scheduler.state.appointmentTypeUiLoading = Boolean(divisionSelect.value);',
			'            scheduler.state.bookingStep = 1;',
			'            renderBookingStepOnly();',
			'            if (scheduler.state.appointmentTypeUiLoading) {',
			'              window.setTimeout(function () {',
			'                scheduler.state.appointmentTypeUiLoading = false;',
			'                renderBookingStepOnly();',
			'              }, 360);',
			'            }'
		].join("\n"));
		text = replaceSchedulerText(text, [
			'            scheduler.state.appointmentTypeId = typeSelect.value;',
			'            scheduler.state.providerId = "";',
			'            scheduler.state.selectedSlotKey = "";',
			'            scheduler.state.slots = [];',
			'            scheduler.state.bookingStep = 1;',
			'            loadProviders();'
		].join("\n"), [
			'            scheduler.state.appointmentTypeId = typeSelect.value;',
			'            scheduler.state.providerId = "";',
			'            scheduler.state.selectedSlotKey = "";',
			'            scheduler.state.slots = [];',
			'            scheduler.state.providersLoading = Boolean(typeSelect.value);',
			'            scheduler.state.bookingStep = 1;',
			'            renderBookingStepOnly();',
			'            loadProviders();'
		].join("\n"));
		text = replaceSchedulerText(text, [
			'      function loadProviders() {',
			'        readFormState();',
			'        if (!scheduler.state.appointmentTypeId) {',
			'          scheduler.state.providers = [];',
			'          renderBookingStepOnly();',
			'          return Promise.resolve();',
			'        }',
			'        var query = new URLSearchParams();',
			'        if (scheduler.state.appointmentTypeId) {',
			'          query.set("appointment_type_id", scheduler.state.appointmentTypeId);',
			'        }',
			'        return scheduler.api.get("/providers?" + query.toString()).then(function (result) {',
			'          scheduler.state.providers = result.ok ? result.data.providers || [] : (isLocalPreview() ? localPreviewProviders() : []);',
			'          if (!result.ok) {',
			'            setNotice(isLocalPreview() ? "" : "We could not load providers yet. Try again after the scheduler server is connected.", !isLocalPreview());',
			'          }',
			'          renderBookingStepOnly();',
			'        });',
			'      }'
		].join("\n"), [
			'      function loadProviders() {',
			'        readFormState();',
			'        if (!scheduler.state.appointmentTypeId) {',
			'          scheduler.state.providers = [];',
			'          scheduler.state.providersLoading = false;',
			'          renderBookingStepOnly();',
			'          return Promise.resolve();',
			'        }',
			'        scheduler.state.providersLoading = true;',
			'        renderBookingStepOnly();',
			'        var query = new URLSearchParams();',
			'        if (scheduler.state.appointmentTypeId) {',
			'          query.set("appointment_type_id", scheduler.state.appointmentTypeId);',
			'        }',
			'        return scheduler.api.get("/providers?" + query.toString()).then(function (result) {',
			'          scheduler.state.providers = result.ok ? result.data.providers || [] : (isLocalPreview() ? localPreviewProviders() : []);',
			'          if (!result.ok) {',
			'            setNotice(isLocalPreview() ? "" : "We could not load providers yet. Try again after the scheduler server is connected.", !isLocalPreview());',
			'          }',
			'        }).catch(function () {',
			'          scheduler.state.providers = [];',
			'          setNotice("We could not load mentors yet. Try again after the scheduler server is connected.", true);',
			'        }).then(function () {',
			'          scheduler.state.providersLoading = false;',
			'          renderBookingStepOnly();',
			'        });',
			'      }'
		].join("\n"));
		text = replaceSchedulerText(text, [
			'        scheduler.api.post("/book", {',
			'          idempotency_key: "student-" + Date.now() + "-" + Math.random().toString(16).slice(2),',
			'          appointment_type_id: scheduler.state.appointmentTypeId,',
			'          provider_id: scheduler.state.providerId,',
			'          start_at: slot.startAt || slot.start_at,'
		].join("\n"), [
			'        scheduler.api.post("/book", {',
			'          idempotency_key: "student-" + Date.now() + "-" + Math.random().toString(16).slice(2),',
			'          appointment_type_id: slot.appointment_type_id || slot.appointmentTypeId || scheduler.state.appointmentTypeId,',
			'          provider_id: slot.provider_id || slot.providerId || scheduler.state.providerId,',
			'          start_at: slot.startAt || slot.start_at,'
		].join("\n"));
		reportSchedulerPatchAudit();
		return text;
	}

	function extractAuthHandoffScript(html) {
		var scripts = String(html || "").match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
		for (var i = scripts.length - 1; i >= 0; i--) {
			var scriptText = scripts[i].replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "");
			if (scriptText.indexOf("window.MMEDSchedulerAuthHandoff") !== -1 && scriptText.indexOf("window.MMEDScheduler = scheduler") === -1) {
				return scriptText;
			}
		}
		return "";
	}

	function injectSchedulerStyle(cssText) {
		if (!cssText || document.getElementById("mmed-scheduler-native-style")) {
			return;
		}

		var style = document.createElement("style");
		style.id = "mmed-scheduler-native-style";
		style.textContent = cssText + [
			"",
			"/* MM-SCHED-057D embedded layout invariant: the Matrix Scheduler must stay inside the Matrix content lane. */",
			"#mmed-scheduler-native-root{display:block;width:100%;max-width:100%;min-width:0;overflow:hidden;}",
			"#mmed-scheduler-native-root *{box-sizing:border-box;letter-spacing:0;}",
			"#schedule-root.sos-schedule-embedded{display:block;width:100%;max-width:100%;min-width:0;min-height:auto;margin:0;background:transparent;overflow:visible;}",
			"#schedule-root.sos-schedule-embedded .sos-page{width:100%;max-width:100%;min-width:0;min-height:auto;padding:0;overflow:visible;}",
			"#schedule-root.sos-schedule-embedded .sos-book-flow,#schedule-root.sos-schedule-embedded .sos-tracker-board,#schedule-root.sos-schedule-embedded .sos-card,#schedule-root.sos-schedule-embedded .sos-card-pad,#schedule-root.sos-schedule-embedded .sos-load-shell{width:100%;max-width:100%;min-width:0;}",
			"#schedule-root.sos-schedule-embedded .sos-booking-fields{grid-template-columns:minmax(0,1fr);align-items:end;}",
			"#schedule-root.sos-schedule-embedded .sos-booking-fields>*{width:100%;max-width:100%;min-width:0;}",
			"#schedule-root.sos-schedule-embedded select,#schedule-root.sos-schedule-embedded input,#schedule-root.sos-schedule-embedded textarea{width:100%;max-width:100%;min-width:0;}",
			"#schedule-root.sos-schedule-embedded .sos-form-actions{display:flex;max-width:100%;min-width:0;flex-wrap:wrap;justify-content:flex-end;gap:12px;}",
			"#schedule-root.sos-schedule-embedded .sos-review-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr));}",
			"#schedule-root.sos-schedule-embedded .sos-review-preferences{grid-template-columns:minmax(0,1fr) minmax(220px,.72fr);}",
			"#schedule-root.sos-schedule-embedded .sos-sched-matrix-wrap{display:block;width:100%;max-width:100%;min-width:0;overflow-x:auto;overscroll-behavior-x:contain;}",
			"#schedule-root.sos-schedule-embedded .sos-sched-week{min-width:770px;width:100%;}",
			"#schedule-root.sos-schedule-embedded .sos-sched-grid-cell.is-reserved{background:rgba(245,158,11,.12);border-color:rgba(250,204,21,.3);}",
			"#schedule-root.sos-schedule-embedded .sos-sched-reserved-slot{display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:34px;border-radius:8px;color:#f8d66d;font-weight:800;text-transform:uppercase;letter-spacing:.04em;font-size:11px;}",
			"",
			"/* MM-SCHED-063 Scheduler Matrix-owned App Mode isolation. */",
			"body.matrix-app-mode-scheduler #mmed-scheduler-native-root{display:block;width:100%;height:100%;max-width:100%;min-width:0;min-height:0;overflow:hidden;}",
			"body.matrix-app-mode-scheduler #mmed-scheduler-native-root *{box-sizing:border-box;letter-spacing:0;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode{display:block;width:100%;height:100%;max-width:100%;min-width:0;min-height:0;margin:0;background:transparent;color:#fff;overflow:hidden;font-family:Poppins,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-page{display:block;width:100%;height:100%;max-width:1480px;min-width:0;min-height:0;margin:0 auto;padding:0;overflow:auto;scrollbar-gutter:stable;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-page-header{margin-bottom:14px;padding:0;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-page-title{font-size:32px;line-height:1.05;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-page-copy{max-width:760px;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-schedule-tracker{margin-bottom:14px;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-book-flow,body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-card,body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-card-pad,body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-load-shell{width:100%;max-width:100%;min-width:0;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-card-pad{padding:18px;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-booking-fields{grid-template-columns:minmax(0,1fr);gap:14px;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode input,body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode select,body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode textarea{width:100%;max-width:100%;min-width:0;min-height:44px;color:#fff;background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.02)),rgba(6,23,39,.42);border:1px solid rgba(255,255,255,.12);border-radius:10px;box-shadow:inset 0 1px 0 rgba(255,255,255,.08);}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-notice{display:grid;gap:4px;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-notice strong,body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-notice span{display:block;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-compact-options{display:grid;gap:8px;align-content:start;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-compact-check{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:40px;padding:8px 10px;border-radius:10px;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-compact-check input[type='checkbox']{appearance:auto!important;-webkit-appearance:checkbox!important;flex:0 0 18px!important;width:18px!important;height:18px!important;min-width:18px!important;min-height:18px!important;max-width:18px!important;max-height:18px!important;margin:0!important;padding:0!important;border-radius:3px!important;transform:none!important;box-shadow:none!important;accent-color:#4f8dff!important;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-arena-cta{display:none!important;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode button{font:inherit;color:inherit;letter-spacing:0;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-form-actions{display:flex;max-width:100%;min-width:0;flex-wrap:wrap;justify-content:flex-end;gap:12px;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-sched-matrix-wrap{display:block;width:100%;max-width:100%;min-width:0;overflow-x:auto;overscroll-behavior-x:contain;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-sched-week{width:100%;min-width:760px;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-booking-fields-ready{grid-template-columns:repeat(3,minmax(0,1fr));align-items:end;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-field select:disabled{opacity:.72;color:rgba(255,255,255,.66);background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.015)),rgba(6,23,39,.34);cursor:not-allowed;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-sched-inline-loader{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:12px;margin-top:14px;padding:12px 14px;border:1px solid rgba(120,212,255,.28);border-radius:12px;background:linear-gradient(180deg,rgba(12,69,106,.74),rgba(7,38,65,.86));box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 12px 30px rgba(0,0,0,.18);overflow:hidden;color:#e9f8ff;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-sched-inline-loader strong{display:block;font-size:13px;font-weight:900;text-transform:uppercase;color:#ffe08a;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-sched-inline-loader small{display:block;margin-top:2px;color:rgba(255,255,255,.72);font-size:12px;line-height:1.35;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-sched-inline-loader i{position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,#ffcc4d,#78d4ff,#3dff9a);background-size:220% 100%;animation:mmed-sched-loadbar 1.15s ease-in-out infinite;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-sched-inline-dot{width:14px;height:14px;border-radius:50%;background:#78d4ff;box-shadow:0 0 0 0 rgba(120,212,255,.5),0 0 18px rgba(120,212,255,.5);animation:mmed-sched-pulse 1.05s ease-in-out infinite;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-sched-grid-cell.is-open{background:linear-gradient(180deg,rgba(61,255,154,.14),rgba(61,255,154,.06));border-color:rgba(61,255,154,.34);}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-sched-grid-cell.is-selected{border-color:rgba(255,220,116,.92);background:radial-gradient(circle at 50% 0%,rgba(255,220,116,.36),rgba(23,163,207,.18) 62%,rgba(23,163,207,.1));box-shadow:0 0 0 1px rgba(255,220,116,.22),0 0 26px rgba(255,204,77,.28),inset 0 1px 0 rgba(255,255,255,.2);}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-sched-open-slot{position:relative;isolation:isolate;min-height:36px;overflow:hidden;color:#d8ffe8;background:linear-gradient(180deg,rgba(157,255,197,.42) 0%,rgba(48,185,122,.34) 44%,rgba(12,101,72,.46) 100%);border:1px solid rgba(159,255,205,.56);border-radius:10px;text-shadow:0 1px 0 rgba(0,0,0,.45);box-shadow:inset 0 1px 0 rgba(255,255,255,.45),inset 0 -10px 18px rgba(0,0,0,.18),0 10px 18px rgba(0,0,0,.24),0 0 14px rgba(61,255,154,.12);transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease,background .16s ease;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-sched-open-slot:before{content:'';position:absolute;z-index:-1;inset:1px 2px auto 2px;height:42%;border-radius:8px;background:linear-gradient(180deg,rgba(255,255,255,.46),rgba(255,255,255,0));pointer-events:none;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-sched-open-slot:hover,body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-sched-open-slot:focus-visible{transform:translateY(-2px) scale(1.03);border-color:rgba(255,232,147,.85);box-shadow:inset 0 1px 0 rgba(255,255,255,.58),inset 0 -10px 18px rgba(0,0,0,.16),0 14px 22px rgba(0,0,0,.28),0 0 22px rgba(255,204,77,.22);outline:none;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-sched-open-slot:active{transform:translateY(1px) scale(.99);box-shadow:inset 0 2px 12px rgba(0,0,0,.32),0 4px 10px rgba(0,0,0,.24);}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-sched-open-slot[aria-pressed='true']{color:#102033;background:linear-gradient(180deg,#fff2a8 0%,#f7c85b 45%,#c98f22 100%);border-color:rgba(255,244,181,.98);box-shadow:inset 0 1px 0 rgba(255,255,255,.72),inset 0 -10px 18px rgba(79,45,0,.16),0 12px 24px rgba(0,0,0,.3),0 0 30px rgba(255,204,77,.42);text-shadow:0 1px 0 rgba(255,255,255,.38);}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-review-compact{padding:14px 18px;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-review-compact .sos-panel-heading{margin:4px 0 4px;font-size:22px;line-height:1.1;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-review-compact .sos-panel-copy{margin:0 0 10px;font-size:13px;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-review-compact .sos-review-summary-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:10px;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-review-compact .sos-review-summary-card{min-height:auto;padding:9px 11px;border-radius:10px;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-review-compact .sos-review-summary-card span{font-size:10px;line-height:1.1;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-review-compact .sos-review-summary-card strong{margin-top:3px;font-size:13px;line-height:1.2;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-review-compact .sos-review-preferences{grid-template-columns:minmax(0,1fr) minmax(220px,.38fr);gap:12px;margin-top:12px;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-review-compact #schedule-intake{min-height:72px;height:72px;padding:12px 14px;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-review-compact .sos-compact-options{gap:8px;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-review-compact .sos-compact-check{min-height:40px;padding:8px 10px;border-radius:10px;font-size:12px;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-review-compact .sos-compact-check input[type='checkbox']{appearance:auto!important;-webkit-appearance:checkbox!important;width:18px!important;height:18px!important;min-width:18px!important;min-height:18px!important;max-width:18px!important;max-height:18px!important;margin:0!important;padding:0!important;border-radius:3px!important;transform:none!important;box-shadow:none!important;accent-color:#4f8dff;}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-review-compact .sos-meeting-note{margin-top:10px;padding:10px 12px;font-size:12px;line-height:1.35;}",
			"@keyframes mmed-sched-pulse{0%,100%{transform:scale(.86);box-shadow:0 0 0 0 rgba(120,212,255,.48),0 0 18px rgba(120,212,255,.5)}50%{transform:scale(1.08);box-shadow:0 0 0 8px rgba(120,212,255,0),0 0 24px rgba(120,212,255,.75)}}",
			"@keyframes mmed-sched-loadbar{0%{background-position:120% 0}100%{background-position:-120% 0}}",
			"body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-empty{max-width:720px;margin:10vh auto 0;color:#fff;}",
			"@media (max-width:1280px){#schedule-root.sos-schedule-embedded .sos-review-preferences,#schedule-root.sos-schedule-embedded .sos-review-summary-grid{grid-template-columns:1fr;}}",
			"@media (max-width:1180px){body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-booking-fields-ready{grid-template-columns:1fr;}body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-review-compact .sos-review-summary-grid,body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-review-compact .sos-review-preferences{grid-template-columns:1fr;}}",
			"@media (max-width:980px){#schedule-root.sos-schedule-embedded .sos-booking-fields,#schedule-root.sos-schedule-embedded .sos-sched-discovery,#schedule-root.sos-schedule-embedded .sos-grid-two,#schedule-root.sos-schedule-embedded .sos-confirmation-grid{grid-template-columns:1fr;}#schedule-root.sos-schedule-embedded .sos-form-actions{justify-content:flex-start;}#schedule-root.sos-schedule-embedded .sos-sched-week{min-width:720px;}#schedule-root.sos-schedule-embedded .sos-file-vault-callout{align-items:flex-start;flex-direction:column;}}",
			"@media (max-width:800px){body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-page{max-width:none;}body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-page-title{font-size:28px;}body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-sched-week{min-width:700px;}body.matrix-app-mode-scheduler #schedule-root.sos-schedule-embedded.sos-scheduler-matrix-app-mode .sos-card-pad{padding:15px;}}"
		].join("\n");
		document.head.appendChild(style);
	}

	function executeSchedulerScript(scriptText) {
		if (!scriptText) {
			throw new Error("Scheduler mount script was not found.");
		}

		var script = document.createElement("script");
		script.text = scriptText;
		document.head.appendChild(script);
		script.remove();
	}

	function injectEmbeddedLoadingStyle() {
		if (document.getElementById("mmed-scheduler-preload-style")) {
			return;
		}
		var style = document.createElement("style");
		style.id = "mmed-scheduler-preload-style";
		style.textContent = [
			"#schedule-root.sos-scheduler-native-host{display:block;width:100%;max-width:100%;min-width:0;overflow:visible;}",
			"#schedule-root .mmed-scheduler-preload{display:grid;gap:16px;color:#fff;font-family:Poppins,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}",
			"#schedule-root .mmed-scheduler-preload *{box-sizing:border-box;letter-spacing:0;}",
			"#schedule-root .mmed-preload-eyebrow{display:inline-flex;align-items:center;width:max-content;min-height:24px;padding:4px 12px;border-radius:999px;background:linear-gradient(180deg,#ffde78,#b8892f);color:#0b2033;font-size:11px;font-weight:800;text-transform:uppercase;}",
			"#schedule-root .mmed-preload-title{margin:10px 0 4px;font-size:42px;line-height:1.05;font-weight:800;}",
			"#schedule-root .mmed-preload-copy{margin:0;color:rgba(255,255,255,.72);font-size:15px;line-height:1.45;}",
			"#schedule-root .mmed-preload-tracker{border:1px solid rgba(120,212,255,.38);border-radius:14px;background:linear-gradient(180deg,rgba(19,160,207,.76),rgba(7,93,132,.7));padding:14px;box-shadow:0 14px 40px rgba(0,0,0,.16),inset 0 1px 0 rgba(255,255,255,.18);}",
			"#schedule-root .mmed-preload-tracker-title{font-weight:900;text-transform:uppercase;}#schedule-root .mmed-preload-tracker-title span{display:block;color:#dff4ff;font-size:12px;}",
			"#schedule-root .mmed-preload-track{display:grid;grid-template-columns:repeat(3,1fr);height:34px;margin-top:10px;border:1px solid rgba(255,255,255,.64);border-radius:999px;overflow:hidden;background:linear-gradient(180deg,rgba(239,249,255,.74),rgba(92,120,137,.82));}",
			"#schedule-root .mmed-preload-segment{display:grid;place-items:center;position:relative;color:rgba(255,255,255,.7);font-weight:900;}#schedule-root .mmed-preload-segment:first-child{background:linear-gradient(180deg,#ffe582,#f0a94b);color:#fff7de;}",
			"#schedule-root .mmed-preload-loader{position:relative;display:grid;gap:14px;padding:20px;border:1px solid rgba(120,212,255,.22);border-radius:14px;background:linear-gradient(180deg,rgba(9,62,92,.74),rgba(5,28,48,.88)),rgba(6,23,39,.72);box-shadow:0 20px 58px rgba(0,0,0,.2),inset 0 1px 0 rgba(255,255,255,.08);overflow:hidden;}",
			"#schedule-root .mmed-preload-loader:before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 16% 0%,rgba(255,204,77,.12),transparent 28%),repeating-linear-gradient(0deg,rgba(255,255,255,.025) 0 1px,transparent 1px 20px);pointer-events:none;}",
			"#schedule-root .mmed-preload-head{position:relative;z-index:1;display:grid;grid-template-columns:minmax(0,1fr) 210px;gap:18px;align-items:start;}",
			"#schedule-root .mmed-preload-kicker{margin:0 0 5px;color:#ffe08a;font-size:11px;font-weight:800;text-transform:uppercase;}#schedule-root .mmed-preload-loader-title{margin:0;font-size:22px;line-height:1.15;font-weight:800;}#schedule-root .mmed-preload-message{margin:7px 0 0;color:rgba(255,255,255,.68);font-size:14px;line-height:1.48;}",
			"#schedule-root .mmed-preload-progress{display:grid;gap:10px;}#schedule-root .mmed-preload-meta{display:flex;justify-content:space-between;gap:10px;color:rgba(255,255,255,.78);font-size:13px;font-weight:900;text-transform:uppercase;}#schedule-root .mmed-preload-bar{height:18px;border:1px solid rgba(255,255,255,.26);border-radius:999px;overflow:hidden;background:rgba(255,255,255,.1);box-shadow:inset 0 1px 8px rgba(0,0,0,.24);}#schedule-root .mmed-preload-fill{height:100%;width:58%;border-radius:inherit;background:linear-gradient(90deg,#ffcc4d,#ff8a3d,#78d4ff);box-shadow:0 0 22px rgba(255,204,77,.34);animation:mmed-preload-progress 2.4s ease-in-out infinite;}",
			"#schedule-root .mmed-preload-grid{position:relative;z-index:1;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;padding:11px;border:1px solid rgba(120,212,255,.16);border-radius:12px;background:rgba(4,27,45,.72);}",
			"#schedule-root .mmed-preload-day{display:grid;gap:8px;min-width:0;}#schedule-root .mmed-preload-day h3{margin:0;color:rgba(255,255,255,.76);font-size:11px;font-weight:800;text-align:center;text-transform:uppercase;}#schedule-root .mmed-preload-slot{min-height:34px;border:1px solid rgba(120,212,255,.18);border-radius:8px;background:linear-gradient(90deg,rgba(255,255,255,.06),rgba(120,212,255,.18),rgba(255,255,255,.06));background-size:220% 100%;animation:mmed-preload-shimmer 1.5s ease-in-out infinite;}#schedule-root .mmed-preload-slot.is-open{border-color:rgba(61,255,154,.48);background:rgba(61,255,154,.12);animation:none;}",
			"#schedule-root .mmed-preload-foot{position:relative;z-index:1;display:flex;justify-content:flex-end;}#schedule-root .mmed-preload-pill{display:inline-flex;align-items:center;min-height:32px;padding:6px 12px;border-radius:999px;background:rgba(217,184,91,.18);color:#ffe08a;font-size:12px;font-weight:800;}",
			"@keyframes mmed-preload-shimmer{0%{background-position:120% 0}100%{background-position:-120% 0}}@keyframes mmed-preload-progress{0%{width:18%}45%{width:72%}100%{width:92%}}",
			"@media (max-width:800px){#schedule-root .mmed-preload-title{font-size:32px}#schedule-root .mmed-preload-head,#schedule-root .mmed-preload-grid{grid-template-columns:1fr}#schedule-root .mmed-preload-loader{padding:16px}}"
		].join("");
		document.head.appendChild(style);
	}

	function embeddedSlotGridLoadingMarkup() {
		var days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
		var grid = days.map(function (day, dayIndex) {
			var lines = ['<div class="mmed-preload-day"><h3>' + escapeHTML(day) + "</h3>"];
			for (var i = 0; i < 4; i += 1) {
				lines.push('<div class="mmed-preload-slot' + ((dayIndex + i) % 3 === 0 ? " is-open" : "") + '"></div>');
			}
			lines.push("</div>");
			return lines.join("");
		}).join("");
		return [
			'<section class="mmed-scheduler-preload" aria-live="polite">',
			'<header><span class="mmed-preload-eyebrow">Planning</span><h1 class="mmed-preload-title">Book a Session</h1><p class="mmed-preload-copy">Select your division, choose a mentor, then reserve a published time.</p></header>',
			'<div class="mmed-preload-tracker"><div class="mmed-preload-tracker-title">Schedule<span>Journey</span></div><div class="mmed-preload-track"><div class="mmed-preload-segment">1</div><div class="mmed-preload-segment">2</div><div class="mmed-preload-segment">3</div></div></div>',
			'<div class="mmed-preload-loader">',
			'<div class="mmed-preload-head"><div><p class="mmed-preload-kicker">Loading appointment options</p><h2 class="mmed-preload-loader-title">Checking scheduling access</h2><p class="mmed-preload-message">Searching available appointments for your account.</p></div><div class="mmed-preload-progress"><div class="mmed-preload-meta"><span>58%</span><span>Loading</span></div><div class="mmed-preload-bar"><div class="mmed-preload-fill"></div></div></div></div>',
			'<div class="mmed-preload-grid">' + grid + "</div>",
			'<div class="mmed-preload-foot"><span class="mmed-preload-pill">Eastern / New York</span></div>',
			"</div>",
			"</section>"
		].join("");
	}

	function ensureBundle() {
		if (standaloneMount && window.MMEDScheduler) {
			return Promise.resolve(window.MMEDScheduler);
		}

		if (bundlePromise) {
			return bundlePromise;
		}

		var controller = window.AbortController ? new AbortController() : null;
		var timeout = controller ? window.setTimeout(function () {
			controller.abort();
		}, 15000) : null;

		bundlePromise = fetch(schedulerHtmlUrl(), {
			credentials: "omit",
			headers: { Accept: "text/html" },
			signal: controller ? controller.signal : undefined
		}).then(function (response) {
			if (timeout) {
				window.clearTimeout(timeout);
			}
			if (!response.ok) {
				throw new Error("Scheduler asset returned " + response.status + ".");
			}
			return response.text();
		}).then(function (html) {
			var handoffScript = extractAuthHandoffScript(html);
			injectSchedulerStyle(extractFirstStyle(html));
			if (handoffScript) {
				executeSchedulerScript(handoffScript);
			}
			executeSchedulerScript(extractSchedulerScript(html));

			if (!window.MMEDScheduler || typeof window.MMEDScheduler.mount !== "function") {
				throw new Error("Scheduler mount API is unavailable.");
			}

			standaloneMount = window.MMEDScheduler.mount.bind(window.MMEDScheduler);
			window.MMEDScheduler.mountStandalone = standaloneMount;
			window.MMEDScheduler.mount = mount;
			window.MMEDScheduler.unmount = unmount;
			window.MMEDScheduler.ensureBundle = ensureBundle;
			window.MMEDScheduler.__nativeMountReady = true;

			return window.MMEDScheduler;
		}).catch(function (error) {
			if (timeout) {
				window.clearTimeout(timeout);
			}
			throw error;
		});

		return bundlePromise;
	}

	function renderLoading(host) {
		injectEmbeddedLoadingStyle();
		var appModeClass = isSchedulerAppModeHost(host) ? " sos-scheduler-matrix-app-mode" : "";
		host.innerHTML = [
			'<div id="schedule-root" class="sos-scheduler-native-host' + appModeClass + '" data-mode="embedded" data-api-base="/api/scheduler">',
			embeddedSlotGridLoadingMarkup(),
			"</div>"
		].join("");
		mountedRoot = host.querySelector("#schedule-root");
		return mountedRoot;
	}

	function mount(selector, config) {
		var host = queryTarget(selector);
		if (!host) {
			return Promise.resolve(false);
		}

		var runId = ++mountRunId;
		var root = renderLoading(host);
		installSchedulerArenaSuppressionStyle();
		var appMode = isSchedulerAppModeHost(host);
		if (appMode) {
			root.classList.add("sos-scheduler-matrix-app-mode");
		}
		return ensureBundle().then(function () {
			if (runId !== mountRunId || !root.isConnected) {
				return false;
			}
			if (!standaloneMount) {
				throw new Error("Scheduler mount API is unavailable.");
			}

			standaloneMount({
				target: root,
				mode: "embedded",
				matrixAppMode: appMode,
				apiBase: (config && config.apiBase) || "/api/scheduler"
			});
			if (appMode) {
				removeSchedulerArenaArtifacts(root);
				installSchedulerSurfaceGuard(root);
				installSchedulerFlowGuard(root);
				window.setTimeout(function () {
					removeSchedulerArenaArtifacts(root);
					repairSchedulerEmptyFlow(root);
				}, 120);
				window.setTimeout(function () {
					removeSchedulerArenaArtifacts(root);
					repairSchedulerEmptyFlow(root);
				}, 700);
			}
			return true;
		}).catch(function (error) {
			host.innerHTML = [
				'<div class="sos-empty sos-empty-rich">',
				'<div class="sos-empty-icon">Sc</div>',
				"<h3>Scheduler could not load</h3>",
				"<p>" + escapeHTML(error && error.message ? error.message : "Please refresh and try again.") + "</p>",
				'<a class="sos-btn sos-btn-primary" href="/schedule">Open Scheduler</a>',
				"</div>"
			].join("");
			return false;
		});
	}

	function unmount() {
		mountRunId++;
		if (mountedRoot && mountedRoot.parentNode) {
			mountedRoot.parentNode.innerHTML = "";
		}
		mountedRoot = null;
	}

	window.MMEDScheduler = window.MMEDScheduler || {};
	window.MMEDScheduler.mount = mount;
	window.MMEDScheduler.unmount = unmount;
	window.MMEDScheduler.ensureBundle = ensureBundle;

	document.dispatchEvent(new CustomEvent("mmed-scheduler-ready"));
}());
