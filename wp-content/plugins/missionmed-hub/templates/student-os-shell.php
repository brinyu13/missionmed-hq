<?php
/**
 * MissionMed Matrix shell template.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$user      = wp_get_current_user();
$user_data = MMED_Student_OS::get_initial_data( $user->ID );
$api_base  = rest_url( 'mmed/v1' );
$dashboard_experience = class_exists( 'MMED_Dashboard_Experience' )
	? MMED_Dashboard_Experience::resolve( $user->ID )
	: 'classic';
$matrix2_first_paint = 'matrix2' === $dashboard_experience;
?>
<?php if ( $matrix2_first_paint ) : ?>
	<style id="mmed-matrix2-first-paint-guard">
		#student-os-root .mmed-matrix2-first-paint { display: none; }
		#student-os-root[data-dashboard-experience="matrix2"][data-dashboard-first-paint="pending"]:not(.mmdv2-active) #sos-content { visibility: hidden; }
		#student-os-root[data-dashboard-experience="matrix2"][data-dashboard-first-paint="pending"]:not(.mmdv2-active) .mmed-matrix2-first-paint {
			display: grid;
			min-height: min(70vh, 620px);
			place-content: center;
			position: relative;
			z-index: 2;
			color: #f7f3ea;
			text-align: center;
		}
		.mmed-matrix2-first-paint__eyebrow { font: 700 0.75rem/1.2 Rajdhani, sans-serif; letter-spacing: 0.18em; text-transform: uppercase; }
		.mmed-matrix2-first-paint__title { margin: 0.6rem 0 0; font: 800 clamp(2rem, 6vw, 4.5rem)/0.95 Archivo, sans-serif; }
		.mmed-matrix2-first-paint__line { width: min(14rem, 55vw); height: 2px; margin: 1.4rem auto 0; background: linear-gradient(90deg, transparent, #d6a84a, transparent); }
	</style>
<?php endif; ?>
<div
	id="student-os-root"
	class="mmed-matrix-shell"
	data-nonce="<?php echo esc_attr( wp_create_nonce( 'wp_rest' ) ); ?>"
	data-api-base="<?php echo esc_url( $api_base ); ?>"
	data-dashboard-experience="<?php echo esc_attr( $dashboard_experience ); ?>"
	<?php if ( $matrix2_first_paint ) : ?>data-dashboard-first-paint="pending"<?php endif; ?>
>
	<?php if ( $matrix2_first_paint ) : ?>
		<script>
			(function (root) {
				var route = String(window.location.hash || '').replace(/^#\/?/, '') || 'dashboard';
				if (route !== 'dashboard') {
					root.removeAttribute('data-dashboard-first-paint');
					return;
				}
				var timeout;
				var observer = new MutationObserver(function () {
					if (!root.classList.contains('mmdv2-active')) return;
					root.removeAttribute('data-dashboard-first-paint');
					observer.disconnect();
					window.clearTimeout(timeout);
				});
				observer.observe(root, { attributes: true, attributeFilter: ['class'] });
				timeout = window.setTimeout(function () {
					root.removeAttribute('data-dashboard-first-paint');
					root.setAttribute('data-dashboard-v2-failed', '1');
					observer.disconnect();
				}, 8000);
			})(document.currentScript.parentElement);
		</script>
	<?php endif; ?>
	<aside id="sos-sidebar" aria-label="<?php echo esc_attr__( 'MissionMed Matrix navigation', 'missionmed-hub' ); ?>"></aside>
	<main id="sos-main">
		<div id="sos-bg-layer" aria-hidden="true">
			<div class="sos-bg sos-bg-a"></div>
			<div class="sos-bg sos-bg-b"></div>
			<div class="sos-bg sos-bg-c"></div>
		</div>
		<?php if ( $matrix2_first_paint ) : ?>
			<div class="mmed-matrix2-first-paint" role="status" aria-live="polite">
				<div>
					<div class="mmed-matrix2-first-paint__eyebrow"><?php echo esc_html__( 'MissionMed Matrix 2.0', 'missionmed-hub' ); ?></div>
					<div class="mmed-matrix2-first-paint__title"><?php echo esc_html__( 'Your mission starts here.', 'missionmed-hub' ); ?></div>
					<div class="mmed-matrix2-first-paint__line" aria-hidden="true"></div>
				</div>
			</div>
		<?php endif; ?>
		<div id="sos-content" aria-live="polite"></div>
	</main>
</div>
<script>
	window.MMED_OS = <?php echo wp_json_encode( $user_data ); ?>;
</script>
