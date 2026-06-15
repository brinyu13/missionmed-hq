<?php
/**
 * Plugin Name: MissionMed Legacy Residency Transition
 * Description: Standalone premium transition experience for Mission Residency legacy redirects into MissionMed Institute.
 * Author: MissionMed
 * Version: 1.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! function_exists( 'mm_lrt_is_legacy_residency_request' ) ) {
	function mm_lrt_is_legacy_residency_request() {
		if ( is_admin() || wp_doing_ajax() || wp_doing_cron() ) {
			return false;
		}

		if ( ! isset( $_GET['legacy_redirect'] ) ) {
			return false;
		}

		$value = sanitize_key( wp_unslash( $_GET['legacy_redirect'] ) );
		return 'missionresidency' === $value;
	}
}

if ( ! function_exists( 'mm_lrt_has_show_full_override' ) ) {
	function mm_lrt_has_show_full_override() {
		if ( ! isset( $_GET['show_full'] ) ) {
			return false;
		}

		$value = sanitize_key( wp_unslash( $_GET['show_full'] ) );
		return '1' === $value || 'true' === $value;
	}
}

if ( ! function_exists( 'mm_lrt_should_render_standalone' ) ) {
	function mm_lrt_should_render_standalone() {
		return mm_lrt_is_legacy_residency_request() && ! mm_lrt_has_show_full_override();
	}
}

if ( ! function_exists( 'mm_lrt_standalone_css' ) ) {
	function mm_lrt_standalone_css( $hero_image_url ) {
		ob_start();
		?>
		<style id="mm-legacy-residency-transition-css">
			:root {
				--mm-lrt-navy: #061729;
				--mm-lrt-navy-2: #0b2339;
				--mm-lrt-ink: #f7fbff;
				--mm-lrt-muted: rgba(232, 240, 248, 0.78);
				--mm-lrt-soft: rgba(232, 240, 248, 0.58);
				--mm-lrt-gold: #e8b65f;
				--mm-lrt-gold-2: #f8cd78;
				--mm-lrt-line: rgba(232, 182, 95, 0.25);
				--mm-lrt-card: rgba(3, 18, 34, 0.82);
			}

			html {
				background: var(--mm-lrt-navy);
			}

			body.mm-lrt-body {
				background: var(--mm-lrt-navy);
				color: var(--mm-lrt-ink);
				font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
				letter-spacing: 0;
				margin: 0;
				min-height: 100vh;
			}

			.mm-lrt-page,
			.mm-lrt-page * {
				box-sizing: border-box;
			}

			.mm-lrt-page {
				--mm-lrt-bg-y: 0px;
				--mm-lrt-card-y: 0px;
				isolation: isolate;
				min-height: 100vh;
				overflow: hidden;
				position: relative;
			}

			.mm-lrt-page::before {
				background:
					linear-gradient(90deg, rgba(3, 13, 25, 0.98) 0%, rgba(4, 17, 31, 0.92) 34%, rgba(5, 21, 38, 0.55) 62%, rgba(5, 21, 38, 0.86) 100%),
					linear-gradient(180deg, rgba(2, 10, 20, 0.12) 0%, rgba(2, 10, 20, 0.88) 72%, #061729 100%),
					url("<?php echo esc_url( $hero_image_url ); ?>");
				background-position: center right;
				background-size: cover;
				content: "";
				inset: -10% 0 -16%;
				position: absolute;
				transform: translate3d(0, var(--mm-lrt-bg-y), 0) scale(1.02);
				transform-origin: center;
				will-change: transform;
				z-index: -2;
			}

			.mm-lrt-page::after {
				background:
					radial-gradient(circle at 16% 8%, rgba(232, 182, 95, 0.14), transparent 24%),
					linear-gradient(180deg, transparent 0%, rgba(2, 10, 20, 0.5) 100%);
				content: "";
				inset: 0;
				pointer-events: none;
				position: absolute;
				z-index: -1;
			}

			.mm-lrt-wrap {
				margin: 0 auto;
				max-width: 1220px;
				padding: clamp(34px, 5vw, 76px) clamp(20px, 5vw, 58px) 34px;
			}

			.mm-lrt-brand-row {
				align-items: center;
				display: flex;
				gap: clamp(18px, 4vw, 46px);
				justify-content: space-between;
				margin-bottom: clamp(34px, 5vw, 72px);
				max-width: 1120px;
			}

			.mm-lrt-brand-logo {
				align-items: center;
				display: flex;
				min-width: 0;
			}

			.mm-lrt-brand-logo img {
				display: block;
				height: auto;
				max-width: 100%;
			}

			.mm-lrt-brand-residency {
				flex: 0 1 330px;
			}

			.mm-lrt-brand-institute {
				flex: 0 1 380px;
			}

			.mm-lrt-brand-divider {
				align-items: center;
				color: var(--mm-lrt-gold-2);
				display: flex;
				flex: 1 1 160px;
				font-size: 12px;
				font-weight: 850;
				gap: 14px;
				justify-content: center;
				letter-spacing: 0.18em;
				text-transform: uppercase;
				white-space: nowrap;
			}

			.mm-lrt-brand-divider::before,
			.mm-lrt-brand-divider::after {
				background: rgba(232, 182, 95, 0.48);
				content: "";
				display: block;
				height: 1px;
				min-width: 38px;
				width: min(8vw, 82px);
			}

			#mm-legacy-residency-transition {
				display: grid;
				gap: clamp(34px, 4vw, 62px);
			}

			.mm-lrt-hero {
				max-width: 690px;
				padding-top: clamp(18px, 4vh, 56px);
			}

			.mm-lrt-kicker {
				color: var(--mm-lrt-gold-2);
				font-size: clamp(12px, 1.1vw, 15px);
				font-weight: 800;
				letter-spacing: 0.28em;
				line-height: 1.45;
				margin: 0 0 18px;
				text-transform: uppercase;
			}

			.mm-lrt-title {
				color: #ffffff;
				font-family: Georgia, "Times New Roman", serif;
				font-size: clamp(48px, 7.4vw, 96px);
				font-weight: 500;
				letter-spacing: 0;
				line-height: 0.98;
				margin: 0;
				text-wrap: balance;
			}

			.mm-lrt-title span {
				color: var(--mm-lrt-gold-2);
				display: block;
			}

			.mm-lrt-rule {
				background: var(--mm-lrt-gold);
				height: 2px;
				margin: 34px 0 0;
				width: 84px;
			}

			.mm-lrt-copy {
				color: var(--mm-lrt-muted);
				font-size: clamp(17px, 1.55vw, 21px);
				line-height: 1.55;
				margin: 30px 0 0;
				max-width: 610px;
			}

			.mm-lrt-emphasis {
				color: #ffffff;
				font-size: clamp(22px, 2.1vw, 30px);
				font-weight: 850;
				line-height: 1.25;
				margin: 28px 0 0;
			}

			.mm-lrt-gold-line {
				color: var(--mm-lrt-gold-2);
				font-size: clamp(17px, 1.5vw, 20px);
				margin: 22px 0 0;
			}

			.mm-lrt-card {
				backdrop-filter: blur(14px);
				background:
					linear-gradient(180deg, rgba(9, 33, 55, 0.88) 0%, rgba(3, 18, 34, 0.9) 100%);
				border: 1px solid rgba(232, 182, 95, 0.32);
				border-radius: 8px;
				box-shadow: 0 28px 80px rgba(0, 0, 0, 0.42);
				margin-left: auto;
				margin-right: auto;
				max-width: 1120px;
				padding: clamp(28px, 4vw, 54px);
				transform: translate3d(0, var(--mm-lrt-card-y), 0);
				will-change: transform;
			}

			.mm-lrt-card-head {
				text-align: center;
			}

			.mm-lrt-card-kicker {
				color: var(--mm-lrt-gold-2);
				font-size: clamp(14px, 1.4vw, 20px);
				font-weight: 850;
				letter-spacing: 0.22em;
				margin: 0;
				text-transform: uppercase;
			}

			.mm-lrt-card-title {
				color: #ffffff;
				font-family: Georgia, "Times New Roman", serif;
				font-size: clamp(26px, 3vw, 46px);
				font-weight: 500;
				letter-spacing: 0.13em;
				line-height: 1.16;
				margin: 14px 0 0;
				text-transform: uppercase;
			}

			.mm-lrt-card-subtitle {
				color: var(--mm-lrt-soft);
				font-size: clamp(15px, 1.4vw, 18px);
				letter-spacing: 0.18em;
				margin: 12px 0 0;
				text-transform: uppercase;
			}

			.mm-lrt-ecosystem {
				border-bottom: 1px solid rgba(232, 182, 95, 0.16);
				border-top: 1px solid rgba(232, 182, 95, 0.16);
				display: grid;
				grid-template-columns: repeat(4, minmax(0, 1fr));
				margin-top: clamp(28px, 3vw, 42px);
			}

			.mm-lrt-division {
				min-height: 132px;
				padding: 26px 18px;
				text-align: center;
			}

			.mm-lrt-division + .mm-lrt-division {
				border-left: 1px solid rgba(232, 182, 95, 0.16);
			}

			.mm-lrt-division strong {
				color: #ffffff;
				display: block;
				font-size: 17px;
				font-weight: 850;
				line-height: 1.25;
			}

			.mm-lrt-division span {
				color: var(--mm-lrt-soft);
				display: block;
				font-size: 15px;
				line-height: 1.4;
				margin-top: 8px;
			}

			.mm-lrt-actions {
				display: flex;
				flex-wrap: wrap;
				gap: 18px;
				justify-content: center;
				margin-top: clamp(30px, 3.4vw, 48px);
			}

			.mm-lrt-button {
				align-items: center;
				border-radius: 6px;
				display: inline-flex;
				font-size: 16px;
				font-weight: 850;
				justify-content: center;
				letter-spacing: 0;
				line-height: 1.2;
				min-height: 56px;
				min-width: min(100%, 320px);
				padding: 15px 22px;
				text-decoration: none;
				transition: transform 140ms ease, border-color 140ms ease, background 140ms ease, color 140ms ease;
			}

			.mm-lrt-button:hover,
			.mm-lrt-button:focus {
				transform: translateY(-1px);
			}

			.mm-lrt-button-primary {
				background: linear-gradient(180deg, #f5c976 0%, #dfa549 100%);
				border: 1px solid rgba(248, 205, 120, 0.86);
				color: #071427;
			}

			.mm-lrt-button-secondary {
				background: rgba(5, 20, 36, 0.44);
				border: 1px solid rgba(232, 182, 95, 0.7);
				color: #ffffff;
			}

			.mm-lrt-footer {
				color: rgba(232, 240, 248, 0.62);
				font-size: 17px;
				line-height: 1.5;
				padding: 0 0 22px;
				text-align: center;
			}

			.mm-lrt-footer-rule {
				background: var(--mm-lrt-gold);
				display: block;
				height: 2px;
				margin: 18px auto 0;
				width: 96px;
			}

			@media (max-width: 860px) {
				.mm-lrt-page::before {
					background:
						linear-gradient(180deg, rgba(3, 13, 25, 0.94) 0%, rgba(3, 13, 25, 0.88) 48%, rgba(3, 13, 25, 0.98) 100%),
						url("<?php echo esc_url( $hero_image_url ); ?>");
					background-position: center top;
				}

				.mm-lrt-brand-row {
					align-items: flex-start;
					flex-direction: column;
					gap: 16px;
					margin-bottom: 34px;
				}

				.mm-lrt-brand-divider {
					flex: 0 0 auto;
					justify-content: flex-start;
				}

				.mm-lrt-brand-divider::after {
					display: none;
				}

				.mm-lrt-brand-residency {
					max-width: 285px;
				}

				.mm-lrt-brand-institute {
					max-width: 350px;
				}

				.mm-lrt-hero {
					padding-top: 12px;
				}

				.mm-lrt-ecosystem {
					grid-template-columns: 1fr 1fr;
				}

				.mm-lrt-division:nth-child(odd) {
					border-left: 0;
				}

				.mm-lrt-division:nth-child(n+3) {
					border-top: 1px solid rgba(232, 182, 95, 0.16);
				}
			}

			@media (max-width: 560px) {
				.mm-lrt-wrap {
					padding-left: 18px;
					padding-right: 18px;
				}

				.mm-lrt-title {
					font-size: clamp(42px, 15vw, 62px);
				}

				.mm-lrt-kicker {
					letter-spacing: 0.18em;
				}

				.mm-lrt-card-title {
					letter-spacing: 0.08em;
				}

				.mm-lrt-ecosystem {
					grid-template-columns: 1fr;
				}

				.mm-lrt-division,
				.mm-lrt-division + .mm-lrt-division {
					border-left: 0;
				}

				.mm-lrt-division + .mm-lrt-division {
					border-top: 1px solid rgba(232, 182, 95, 0.16);
				}

				.mm-lrt-actions {
					display: grid;
				}
			}

			@media (prefers-reduced-motion: reduce) {
				.mm-lrt-page::before,
				.mm-lrt-card {
					transform: none;
				}
			}
		</style>
		<?php
		return ob_get_clean();
	}
}

if ( ! function_exists( 'mm_lrt_render_standalone_page' ) ) {
	function mm_lrt_render_standalone_page() {
		$hero_image_url = 'https://missionmedinstitute.com/wp-content/uploads/2026/05/medical-team-collaborating-on-anatomy-study-in-hos-2026-03-24-05-03-34-utc-1536x1024.jpg';
		$asset_base_url = content_url( '/uploads/2026/06/mm-legacy-transition/' );
		$residency_logo = $asset_base_url . 'mission-residency-logo-dark.png';
		$missionmed_logo = $asset_base_url . 'missionmed-institute-logo-dark.png';
		$residency_url  = add_query_arg( 'show_full', '1', home_url( '/mission-residency/' ) );
		$institute_url  = home_url( '/' );
		$title          = 'Mission Residency Has Entered a New Era';

		status_header( 200 );
		nocache_headers();
		header( 'X-MissionMed-Legacy-Transition: standalone' );
		?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="robots" content="noindex,follow">
	<title><?php echo esc_html( $title ); ?> - MissionMed Institute</title>
	<?php echo mm_lrt_standalone_css( $hero_image_url ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
</head>
<body class="mm-lrt-body">
	<main class="mm-lrt-page">
		<div class="mm-lrt-wrap">
			<section id="mm-legacy-residency-transition" aria-label="Mission Residency transition to MissionMed Institute">
				<div class="mm-lrt-brand-row" aria-label="Mission Residency and MissionMed Institute">
					<div class="mm-lrt-brand-logo mm-lrt-brand-residency">
						<img src="<?php echo esc_url( $residency_logo ); ?>" alt="Mission Residency">
					</div>
					<div class="mm-lrt-brand-divider" aria-hidden="true">Now part of</div>
					<div class="mm-lrt-brand-logo mm-lrt-brand-institute">
						<img src="<?php echo esc_url( $missionmed_logo ); ?>" alt="MissionMed Institute">
					</div>
				</div>
				<div class="mm-lrt-hero">
					<p class="mm-lrt-kicker">Welcome to the next chapter</p>
					<h1 class="mm-lrt-title">Mission Residency <span>Has Entered a New Era</span></h1>
					<div class="mm-lrt-rule" aria-hidden="true"></div>
					<p class="mm-lrt-copy">
						For nearly two decades, Mission Residency has helped thousands of physicians pursue their residency dreams.
					</p>
					<p class="mm-lrt-copy">
						Today, Mission Residency continues as the flagship residency mentorship division of MissionMed Institute, alongside new programs, technologies, and educational resources designed to support physicians across every stage of their journey.
					</p>
					<p class="mm-lrt-emphasis">Same mission.<br>Bigger vision.</p>
					<p class="mm-lrt-gold-line">You are in the right place.</p>
				</div>

				<section class="mm-lrt-card" aria-label="MissionMed Institute divisions">
					<div class="mm-lrt-card-head">
						<p class="mm-lrt-card-kicker">Mission Residency</p>
						<h2 class="mm-lrt-card-title">Flagship Residency Mentorship Division of MissionMed Institute</h2>
						<p class="mm-lrt-card-subtitle">A focused division inside a larger physician education ecosystem</p>
					</div>

					<div class="mm-lrt-ecosystem" aria-label="MissionMed ecosystem">
						<div class="mm-lrt-division">
							<strong>Mission Residency</strong>
							<span>Residency Mentorship</span>
						</div>
						<div class="mm-lrt-division">
							<strong>Mission USCE</strong>
							<span>Clinical Experience</span>
						</div>
						<div class="mm-lrt-division">
							<strong>Mission Exams</strong>
							<span>USMLE Preparation</span>
						</div>
						<div class="mm-lrt-division">
							<strong>Arena</strong>
							<span>Interactive Learning</span>
						</div>
					</div>

					<div class="mm-lrt-actions">
						<a class="mm-lrt-button mm-lrt-button-primary" href="<?php echo esc_url( $residency_url ); ?>">Continue to Mission Residency</a>
						<a class="mm-lrt-button mm-lrt-button-secondary" href="<?php echo esc_url( $institute_url ); ?>">Explore MissionMed Institute</a>
					</div>
				</section>

				<footer class="mm-lrt-footer">
					Expanding access. Elevating support. Empowering physicians.
					<span class="mm-lrt-footer-rule" aria-hidden="true"></span>
				</footer>
			</section>
		</div>
	</main>
	<script id="mm-legacy-residency-transition-parallax">
		(function () {
			var page = document.querySelector('.mm-lrt-page');
			var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

			if (!page || reduceMotion) {
				return;
			}

			var ticking = false;
			var scheduleFrame = window.requestAnimationFrame || function (callback) {
				return window.setTimeout(callback, 16);
			};

			function updateParallax() {
				var scrollY = window.scrollY || document.documentElement.scrollTop || 0;
				var bgY = Math.min(90, scrollY * 0.16);
				var cardY = Math.max(-30, scrollY * -0.035);

				page.style.setProperty('--mm-lrt-bg-y', bgY.toFixed(1) + 'px');
				page.style.setProperty('--mm-lrt-card-y', cardY.toFixed(1) + 'px');
				ticking = false;
			}

			function requestUpdate() {
				if (!ticking) {
					scheduleFrame(updateParallax);
					ticking = true;
				}
			}

			window.addEventListener('scroll', requestUpdate, { passive: true });
			window.addEventListener('resize', requestUpdate);
			updateParallax();
		})();
	</script>
</body>
</html>
		<?php
		exit;
	}
}

add_action(
	'template_redirect',
	function () {
		if ( mm_lrt_should_render_standalone() ) {
			mm_lrt_render_standalone_page();
		}
	},
	0
);
