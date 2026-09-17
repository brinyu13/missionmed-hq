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
?>
<div
	id="student-os-root"
	class="mmed-matrix-shell"
	data-nonce="<?php echo esc_attr( wp_create_nonce( 'wp_rest' ) ); ?>"
	data-api-base="<?php echo esc_url( $api_base ); ?>"
>
	<aside id="sos-sidebar" aria-label="<?php echo esc_attr__( 'MissionMed Matrix navigation', 'missionmed-hub' ); ?>"></aside>
	<main id="sos-main">
		<div id="sos-bg-layer" aria-hidden="true">
			<div class="sos-bg sos-bg-a"></div>
			<div class="sos-bg sos-bg-b"></div>
			<div class="sos-bg sos-bg-c"></div>
		</div>
		<div id="sos-content" aria-live="polite"></div>
	</main>
</div>
<script>
	window.MMED_OS = <?php echo wp_json_encode( $user_data ); ?>;
</script>
