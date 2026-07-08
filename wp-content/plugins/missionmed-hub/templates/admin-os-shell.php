<?php
/**
 * Matrix HQ Runtime v2 shell.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$admin_os_data = isset( $mmed_admin_os_data ) && is_array( $mmed_admin_os_data ) ? $mmed_admin_os_data : MMED_Admin_OS::get_initial_data();
$admin_user    = isset( $admin_os_data['currentUser'] ) && is_array( $admin_os_data['currentUser'] ) ? $admin_os_data['currentUser'] : array();
$display_name  = ! empty( $admin_user['displayName'] ) ? $admin_user['displayName'] : __( 'Admin', 'missionmed-hub' );
?>
<div id="admin-os-root" class="mmed-admin-os" data-runtime-version="2" data-feature-flag="mmed_admin_os_enabled">
	<aside id="amos-sidebar" aria-label="<?php echo esc_attr__( 'Matrix HQ navigation', 'missionmed-hub' ); ?>">
		<div class="amos-shell-skeleton">
			<span class="amos-skeleton-logo"></span>
			<span class="amos-skeleton-line"></span>
			<span class="amos-skeleton-line short"></span>
		</div>
	</aside>

	<main id="amos-main">
		<div class="amos-aurora" aria-hidden="true">
			<span class="amos-aurora-band band-a"></span>
			<span class="amos-aurora-band band-b"></span>
			<span class="amos-aurora-band band-c"></span>
		</div>

		<header class="amos-topbar">
			<div>
				<span class="amos-eyebrow">Administration</span>
				<h1>Matrix HQ</h1>
			</div>
			<div class="amos-topbar-actions">
				<span class="amos-health"><i aria-hidden="true"></i> Runtime v2</span>
				<span class="amos-user"><?php echo esc_html( $display_name ); ?></span>
			</div>
		</header>

		<noscript>
			<div class="amos-error-card">
				<h2><?php echo esc_html__( 'JavaScript is required.', 'missionmed-hub' ); ?></h2>
				<p><?php echo esc_html__( 'Matrix HQ needs JavaScript to load admin modules.', 'missionmed-hub' ); ?></p>
			</div>
		</noscript>

		<section id="amos-content" aria-live="polite">
			<div class="amos-module-skeleton">
				<span></span>
				<span></span>
				<span></span>
			</div>
		</section>
	</main>
</div>
<script>
	window.MMED_ADMIN_OS = <?php echo wp_json_encode( $admin_os_data ); ?>;
</script>
