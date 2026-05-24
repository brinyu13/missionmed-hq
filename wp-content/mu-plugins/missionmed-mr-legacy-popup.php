<?php
/**
 * Plugin Name: MissionMed Mission Residency Legacy Popup
 * Description: Targeted Mission Residency transition popup for legacy missionresidency.com redirect traffic.
 * Version: 1.0.0
 * Author: MissionMed
 *
 * MR-BRAND-TRANSITION-002
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
body.mm-mr-legacy-popup-open {
	overflow: hidden !important;
}

.mm-mr-legacy-overlay,
.mm-mr-legacy-banner-wrap {
	box-sizing: border-box;
	font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.mm-mr-legacy-overlay *,
.mm-mr-legacy-banner-wrap * {
	box-sizing: border-box;
}

.mm-mr-legacy-overlay {
	position: fixed;
	inset: 0;
	z-index: 999980;
	display: grid;
	place-items: center;
	padding: 24px;
	background: rgba(5, 10, 18, 0.66);
	backdrop-filter: blur(6px);
}

.mm-mr-legacy-card,
.mm-mr-legacy-banner {
	position: relative;
	width: min(520px, 100%);
	border: 1px solid rgba(201, 168, 76, 0.36);
	border-radius: 8px;
	background:
		linear-gradient(180deg, rgba(24, 31, 45, 0.98), rgba(8, 14, 25, 0.99)),
		#101724;
	box-shadow: 0 28px 80px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.07);
	color: #f7f1df;
}

.mm-mr-legacy-card {
	padding: 34px 32px 30px;
}

.mm-mr-legacy-kicker {
	width: 42px;
	height: 3px;
	margin: 0 0 20px;
	border-radius: 999px;
	background: #c9a84c;
}

.mm-mr-legacy-title {
	margin: 0 38px 12px 0;
	color: #ffffff;
	font-size: 30px;
	font-weight: 700;
	line-height: 1.08;
	letter-spacing: 0;
}

.mm-mr-legacy-copy {
	margin: 0 0 24px;
	color: rgba(247, 241, 223, 0.86);
	font-size: 16px;
	line-height: 1.62;
	letter-spacing: 0;
	overflow-wrap: anywhere;
}

.mm-mr-legacy-actions {
	display: flex;
	flex-direction: column;
	gap: 14px;
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

.mm-mr-legacy-cta {
	width: 100%;
	min-height: 48px;
	padding: 14px 20px;
	border-radius: 999px;
	background: #c9a84c;
	color: #111827;
	font-size: 14px;
	font-weight: 800;
	line-height: 1.2;
	text-align: center;
	white-space: normal;
	overflow-wrap: anywhere;
	box-shadow: 0 12px 28px rgba(201, 168, 76, 0.22);
	transition: transform 160ms ease, background-color 160ms ease, box-shadow 160ms ease;
}

.mm-mr-legacy-cta:hover,
.mm-mr-legacy-cta:focus-visible {
	background: #d7b85b;
	box-shadow: 0 16px 34px rgba(201, 168, 76, 0.28);
	transform: translateY(-1px);
	outline: none;
}

.mm-mr-legacy-dismiss {
	align-self: center;
	padding: 4px 2px;
	background: transparent;
	color: rgba(247, 241, 223, 0.72);
	font-size: 14px;
	font-weight: 600;
	line-height: 1.4;
	text-decoration: underline;
	text-underline-offset: 4px;
}

.mm-mr-legacy-dismiss:hover,
.mm-mr-legacy-dismiss:focus-visible {
	color: #ffffff;
	outline: none;
}

.mm-mr-legacy-close {
	position: absolute;
	top: 16px;
	right: 16px;
	display: grid;
	width: 34px;
	height: 34px;
	place-items: center;
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.07);
	color: rgba(255, 255, 255, 0.82);
	font-size: 22px;
	line-height: 1;
}

.mm-mr-legacy-close:hover,
.mm-mr-legacy-close:focus-visible {
	background: rgba(201, 168, 76, 0.22);
	color: #ffffff;
	outline: none;
}

.mm-mr-legacy-banner-wrap {
	position: relative;
	z-index: 20;
	width: 100%;
	padding: 12px;
	background: #080e19;
	overflow-x: hidden;
}

.mm-mr-legacy-banner {
	width: 100%;
	max-width: calc(100vw - 24px);
	padding: 22px 18px 20px;
}

.mm-mr-legacy-banner .mm-mr-legacy-title {
	margin-right: 42px;
	font-size: 24px;
}

.mm-mr-legacy-banner .mm-mr-legacy-copy {
	font-size: 15px;
	line-height: 1.55;
}

.mm-mr-legacy-banner .mm-mr-legacy-cta {
	padding-right: 14px;
	padding-left: 14px;
	font-size: 13px;
	line-height: 1.25;
}

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
	}
}

@media (max-width: 430px) {
	.mm-mr-legacy-banner {
		padding: 20px 16px 18px;
	}

	.mm-mr-legacy-banner .mm-mr-legacy-title {
		font-size: 22px;
	}

	.mm-mr-legacy-banner .mm-mr-legacy-copy {
		font-size: 14px;
	}

	.mm-mr-legacy-banner .mm-mr-legacy-cta {
		min-height: 46px;
		padding-right: 12px;
		padding-left: 12px;
		font-size: 12px;
	}
}

@media (prefers-reduced-motion: reduce) {
	.mm-mr-legacy-cta {
		transition: none;
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
	var VERSION = 'MR-BRAND-TRANSITION-002_20260524T013025Z';
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
