<?php
/**
 * Plugin Name: MissionMed Mission Residency Legacy Popup
 * Description: Targeted Mission Residency transition popup for legacy missionresidency.com redirect traffic.
 * Version: 2.0.0
 * Author: MissionMed
 *
 * MR-BRAND-TRANSITION-002 / MR-BRAND-TRANSITION-004 (visual redesign)
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! function_exists( 'mm_mr_legacy_popup_is_mission_residency_path' ) ) {
	/**
	 * Keep output limited to the Mission Residency page path.
	 *
	 * The JavaScript performs the query-parameter gate. Loading the tiny snippet
	 * on the base page avoids query-string cache variance causing false negatives.
	 *
	 * @return bool
	 */
	function mm_mr_legacy_popup_is_mission_residency_path() {
		if ( is_admin() ) {
			return false;
		}

		$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
		$path        = function_exists( 'wp_parse_url' ) ? wp_parse_url( $request_uri, PHP_URL_PATH ) : parse_url( $request_uri, PHP_URL_PATH );

		if ( ! is_string( $path ) || '' === $path ) {
			return false;
		}

		$normalized_path = '/' . trim( $path, '/' ) . '/';

		return '/mission-residency/' === $normalized_path;
	}
}

if ( ! function_exists( 'mm_mr_legacy_popup_print_styles' ) ) {
	/**
	 * Print scoped popup styles on the Mission Residency page only.
	 *
	 * @return void
	 */
	function mm_mr_legacy_popup_print_styles() {
		if ( ! mm_mr_legacy_popup_is_mission_residency_path() ) {
			return;
		}
		?>
<style id="mm-mr-legacy-popup-css">
/* MR-BRAND-TRANSITION-004 — Premium MissionMed editorial popup */

body.mm-mr-legacy-popup-open {
	overflow: hidden !important;
}

.mm-mr-legacy-overlay,
.mm-mr-legacy-banner-wrap {
	box-sizing: border-box;
	font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
}

.mm-mr-legacy-overlay *,
.mm-mr-legacy-banner-wrap * {
	box-sizing: border-box;
}

/* ---- Desktop overlay ---- */

.mm-mr-legacy-overlay {
	position: fixed;
	inset: 0;
	z-index: 999980;
	display: grid;
	place-items: center;
	padding: 24px;
	background: rgba(2, 4, 8, 0.72);
	backdrop-filter: blur(12px) saturate(1.1);
	-webkit-backdrop-filter: blur(12px) saturate(1.1);
	animation: mmMrOverlayIn 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes mmMrOverlayIn {
	from { opacity: 0; }
	to   { opacity: 1; }
}

/* ---- Card (desktop) & Banner (mobile) shared ---- */

.mm-mr-legacy-card,
.mm-mr-legacy-banner {
	position: relative;
	width: min(480px, 100%);
	border: 1px solid rgba(201, 168, 76, 0.18);
	border-radius: 14px;
	background: linear-gradient(168deg, #141c2b 0%, #0b1120 100%);
	box-shadow:
		0 0 0 1px rgba(255, 255, 255, 0.04),
		0 32px 64px -12px rgba(0, 0, 0, 0.55),
		0 0 80px -20px rgba(201, 168, 76, 0.06);
	color: #e8e0cc;
}

/* ---- Card (desktop modal) ---- */

.mm-mr-legacy-card {
	padding: 40px 38px 36px;
	animation: mmMrCardIn 380ms cubic-bezier(0.16, 1, 0.3, 1) 60ms both;
}

@keyframes mmMrCardIn {
	from { opacity: 0; transform: translateY(12px) scale(0.97); }
	to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* ---- Kicker accent ---- */

.mm-mr-legacy-kicker {
	width: 32px;
	height: 2px;
	margin: 0 0 22px;
	border-radius: 1px;
	background: linear-gradient(90deg, #c9a84c, #dbc278);
	opacity: 0.8;
}

/* ---- Title ---- */

.mm-mr-legacy-title {
	margin: 0 32px 14px 0;
	color: #ffffff;
	font-size: 26px;
	font-weight: 600;
	line-height: 1.15;
	letter-spacing: -0.01em;
}

/* ---- Body copy ---- */

.mm-mr-legacy-copy {
	margin: 0 0 28px;
	color: rgba(232, 224, 204, 0.78);
	font-size: 15px;
	line-height: 1.65;
	letter-spacing: 0.005em;
	overflow-wrap: anywhere;
}

/* ---- Actions ---- */

.mm-mr-legacy-actions {
	display: flex;
	flex-direction: column;
	gap: 12px;
	align-items: stretch;
}

.mm-mr-legacy-cta,
.mm-mr-legacy-dismiss,
.mm-mr-legacy-close {
	appearance: none;
	border: 0;
	font: inherit;
	cursor: pointer;
}

/* ---- CTA button ---- */

.mm-mr-legacy-cta {
	width: 100%;
	min-height: 46px;
	padding: 13px 24px;
	border: 1px solid rgba(201, 168, 76, 0.35);
	border-radius: 8px;
	background: linear-gradient(180deg, rgba(201, 168, 76, 0.14) 0%, rgba(201, 168, 76, 0.06) 100%);
	color: #dbc278;
	font-size: 13.5px;
	font-weight: 600;
	line-height: 1.3;
	text-align: center;
	letter-spacing: 0.03em;
	white-space: normal;
	overflow-wrap: anywhere;
	transition: background-color 200ms ease, border-color 200ms ease, color 200ms ease, transform 200ms ease;
}

.mm-mr-legacy-cta:hover,
.mm-mr-legacy-cta:focus-visible {
	background: linear-gradient(180deg, rgba(201, 168, 76, 0.22) 0%, rgba(201, 168, 76, 0.10) 100%);
	border-color: rgba(201, 168, 76, 0.55);
	color: #e8d48e;
	transform: translateY(-1px);
	outline: none;
}

.mm-mr-legacy-cta:active {
	transform: translateY(0);
}

/* ---- Dismiss link ---- */

.mm-mr-legacy-dismiss {
	align-self: center;
	padding: 6px 4px;
	background: transparent;
	color: rgba(232, 224, 204, 0.45);
	font-size: 13px;
	font-weight: 400;
	line-height: 1.4;
	text-decoration: none;
	letter-spacing: 0.01em;
	transition: color 180ms ease;
}

.mm-mr-legacy-dismiss:hover,
.mm-mr-legacy-dismiss:focus-visible {
	color: rgba(232, 224, 204, 0.75);
	outline: none;
}

/* ---- Close (X) button ---- */

.mm-mr-legacy-close {
	position: absolute;
	top: 18px;
	right: 18px;
	display: grid;
	width: 28px;
	height: 28px;
	place-items: center;
	border-radius: 6px;
	background: transparent;
	color: rgba(232, 224, 204, 0.35);
	font-size: 18px;
	line-height: 1;
	transition: color 180ms ease, background-color 180ms ease;
}

.mm-mr-legacy-close:hover,
.mm-mr-legacy-close:focus-visible {
	background: rgba(255, 255, 255, 0.06);
	color: rgba(232, 224, 204, 0.7);
	outline: none;
}

/* ---- Mobile banner wrap ---- */

.mm-mr-legacy-banner-wrap {
	position: relative;
	z-index: 20;
	width: 100%;
	padding: 0;
	background: transparent;
	overflow-x: hidden;
}

.mm-mr-legacy-banner {
	width: 100%;
	max-width: 100%;
	margin: 0;
	padding: 24px 20px 22px;
	border-radius: 0;
	border-left: 0;
	border-right: 0;
	border-top: 0;
	border-bottom: 1px solid rgba(201, 168, 76, 0.15);
	background: linear-gradient(180deg, #0f1726 0%, #0b1120 100%);
	animation: mmMrBannerIn 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes mmMrBannerIn {
	from { opacity: 0; transform: translateY(-8px); }
	to   { opacity: 1; transform: translateY(0); }
}

.mm-mr-legacy-banner .mm-mr-legacy-kicker {
	width: 24px;
	margin-bottom: 16px;
}

.mm-mr-legacy-banner .mm-mr-legacy-title {
	margin-right: 36px;
	font-size: 20px;
}

.mm-mr-legacy-banner .mm-mr-legacy-copy {
	font-size: 14px;
	line-height: 1.55;
	margin-bottom: 20px;
}

.mm-mr-legacy-banner .mm-mr-legacy-cta {
	padding: 11px 16px;
	font-size: 13px;
	min-height: 42px;
}

.mm-mr-legacy-banner .mm-mr-legacy-dismiss {
	font-size: 12px;
}

.mm-mr-legacy-banner .mm-mr-legacy-close {
	top: 16px;
	right: 14px;
	width: 26px;
	height: 26px;
	font-size: 16px;
}

/* ---- Responsive: mobile breakpoint ---- */

@media (max-width: 599px) {
	body.mm-mr-legacy-popup-open {
		overflow: auto !important;
	}

	.mm-mr-legacy-overlay {
		display: block;
		position: static;
		padding: 0;
		background: transparent;
		backdrop-filter: none;
		-webkit-backdrop-filter: none;
	}
}

@media (max-width: 430px) {
	.mm-mr-legacy-banner {
		padding: 20px 16px 18px;
	}

	.mm-mr-legacy-banner .mm-mr-legacy-title {
		font-size: 18px;
	}

	.mm-mr-legacy-banner .mm-mr-legacy-copy {
		font-size: 13px;
	}

	.mm-mr-legacy-banner .mm-mr-legacy-cta {
		min-height: 40px;
		padding: 10px 14px;
		font-size: 12.5px;
	}
}

/* ---- Reduced motion ---- */

@media (prefers-reduced-motion: reduce) {
	.mm-mr-legacy-overlay,
	.mm-mr-legacy-card,
	.mm-mr-legacy-banner,
	.mm-mr-legacy-cta {
		animation: none !important;
		transition: none !important;
	}

	.mm-mr-legacy-cta:hover,
	.mm-mr-legacy-cta:focus-visible {
		transform: none;
	}
}
</style>
		<?php
	}
}

if ( ! function_exists( 'mm_mr_legacy_popup_print_script' ) ) {
	/**
	 * Print popup behavior on the Mission Residency page only.
	 *
	 * @return void
	 */
	function mm_mr_legacy_popup_print_script() {
		if ( ! mm_mr_legacy_popup_is_mission_residency_path() ) {
			return;
		}
		?>
<script id="mm-mr-legacy-popup-js">
(function () {
	'use strict';

	var STORAGE_KEY = 'mr_legacy_popup_seen';
	var ROOT_ID = 'mm-mr-legacy-popup-root';
	var VERSION = 'MR-BRAND-TRANSITION-004_20260524T155500Z';
	var previousFocus = null;
	var root = null;
	var isMobile = false;

	window.__MM_MR_LEGACY_POPUP_VERSION = VERSION;

	function isMissionResidencyPath() {
		var path = window.location.pathname.replace(/\/+$/, '') + '/';
		return path === '/mission-residency/';
	}

	function hasLegacySource() {
		try {
			return new URLSearchParams(window.location.search).get('legacy_source') === 'missionresidency';
		} catch (_error) {
			return window.location.search.indexOf('legacy_source=missionresidency') !== -1;
		}
	}

	function localStorageSeen() {
		try {
			return window.localStorage && window.localStorage.getItem(STORAGE_KEY) === 'true';
		} catch (_error) {
			return false;
		}
	}

	function cookieSeen() {
		return document.cookie.split(';').some(function (part) {
			return part.trim() === STORAGE_KEY + '=true';
		});
	}

	function hasSeenPopup() {
		return localStorageSeen() || cookieSeen();
	}

	function setSeenPopup() {
		try {
			if (window.localStorage) {
				window.localStorage.setItem(STORAGE_KEY, 'true');
			}
		} catch (_error) {}

		document.cookie = STORAGE_KEY + '=true; max-age=31536000; path=/';
	}

	function findScrollTarget() {
		var stableSelectors = ['#programs', '#cta', '#cost'];

		for (var i = 0; i < stableSelectors.length; i += 1) {
			var stableTarget = document.querySelector(stableSelectors[i]);
			if (stableTarget) {
				return stableTarget;
			}
		}

		var ctaPattern = /(enroll|apply|book strategy|book a call|get started|see programs|view programs)/i;
		var candidates = Array.prototype.slice.call(document.querySelectorAll('a, button'));

		for (var j = 0; j < candidates.length; j += 1) {
			var label = (candidates[j].textContent || '').replace(/\s+/g, ' ').trim();
			if (ctaPattern.test(label)) {
				return candidates[j].closest('[id], section, .elementor-section, .elementor-container') || candidates[j];
			}
		}

		return null;
	}

	function getFocusableElements() {
		if (!root) {
			return [];
		}

		return Array.prototype.slice.call(root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
			.filter(function (element) {
				return !element.hasAttribute('disabled') && element.offsetParent !== null;
			});
	}

	function closePopup() {
		if (!root) {
			return;
		}

		setSeenPopup();
		document.removeEventListener('keydown', handleKeydown);
		document.body.classList.remove('mm-mr-legacy-popup-open');
		root.remove();
		root = null;

		if (previousFocus && typeof previousFocus.focus === 'function') {
			try {
				previousFocus.focus({ preventScroll: true });
			} catch (_error) {
				previousFocus.focus();
			}
		}
	}

	function handleKeydown(event) {
		if (event.key === 'Escape') {
			event.preventDefault();
			closePopup();
			return;
		}

		if (isMobile || event.key !== 'Tab' || !root) {
			return;
		}

		var focusable = getFocusableElements();
		if (focusable.length === 0) {
			return;
		}

		var first = focusable[0];
		var last = focusable[focusable.length - 1];

		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}

	function handleCta() {
		var target = findScrollTarget();
		closePopup();

		if (target && typeof target.scrollIntoView === 'function') {
			window.setTimeout(function () {
				target.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}, 60);
		}
	}

	function buildMarkup() {
		var shellRole = isMobile
			? 'role="region" aria-label="Mission Residency update"'
			: 'role="dialog" aria-modal="true" aria-labelledby="mm-mr-legacy-title" aria-describedby="mm-mr-legacy-copy"';

		return '' +
			'<div class="' + (isMobile ? 'mm-mr-legacy-banner' : 'mm-mr-legacy-card') + '" ' + shellRole + '>' +
				'<button type="button" class="mm-mr-legacy-close" data-mm-mr-close aria-label="Close Mission Residency update">&times;</button>' +
				'<div class="mm-mr-legacy-kicker" aria-hidden="true"></div>' +
				'<h2 class="mm-mr-legacy-title" id="mm-mr-legacy-title">Welcome home.</h2>' +
				'<p class="mm-mr-legacy-copy" id="mm-mr-legacy-copy">Mission Residency is now part of MissionMed Institute. Same mentor. Same mission. Same Match-focused strategy. Everything students trusted has been brought into a bigger home with more tools, more programs, and the same personal coaching from Dr. Brian.</p>' +
				'<div class="mm-mr-legacy-actions">' +
					'<button type="button" class="mm-mr-legacy-cta" data-mm-mr-cta>Explore Mission Residency at MissionMed</button>' +
					'<button type="button" class="mm-mr-legacy-dismiss" data-mm-mr-close>Got it, thanks</button>' +
				'</div>' +
			'</div>';
	}

	function showPopup() {
		if (!isMissionResidencyPath() || !hasLegacySource() || hasSeenPopup() || document.getElementById(ROOT_ID)) {
			return;
		}

		isMobile = window.matchMedia('(max-width: 599px)').matches;
		previousFocus = document.activeElement;
		root = document.createElement('div');
		root.id = ROOT_ID;
		root.className = isMobile ? 'mm-mr-legacy-banner-wrap' : 'mm-mr-legacy-overlay';
		root.innerHTML = buildMarkup();

		if (isMobile && document.body.firstChild) {
			document.body.insertBefore(root, document.body.firstChild);
		} else {
			document.body.appendChild(root);
		}

		setSeenPopup();

		if (!isMobile) {
			document.body.classList.add('mm-mr-legacy-popup-open');
			root.addEventListener('click', function (event) {
				if (event.target === root) {
					closePopup();
				}
			});
		}

		root.querySelectorAll('[data-mm-mr-close]').forEach(function (button) {
			button.addEventListener('click', closePopup);
		});

		var cta = root.querySelector('[data-mm-mr-cta]');
		if (cta) {
			cta.addEventListener('click', handleCta);
		}

		document.addEventListener('keydown', handleKeydown);

		var focusTarget = cta || root.querySelector('[data-mm-mr-close]');
		if (focusTarget) {
			focusTarget.focus({ preventScroll: true });
		}
	}

	function schedulePopup() {
		window.setTimeout(showPopup, 1500);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', schedulePopup, { once: true });
	} else {
		schedulePopup();
	}
})();
</script>
		<?php
	}
}

add_action( 'wp_head', 'mm_mr_legacy_popup_print_styles', 20 );
add_action( 'wp_footer', 'mm_mr_legacy_popup_print_script', 20 );
