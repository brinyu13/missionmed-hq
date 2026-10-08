<?php
/**
 * Plugin Name: Mission Residency October 10 Orientation Notice
 * Description: Date-copy adapter for the existing customer next-steps template. No mail dispatch or commerce mutation.
 * Version: 2026.10.08.1
 */
defined( 'ABSPATH' ) || exit;

function mm_mr_orientation_oct10_email_next_steps( $order, $sent_to_admin, $plain_text, $email ) {
	if ( ! function_exists( 'mm_mr_zelle_email_next_steps' ) ) {
		return;
	}
	// Preserve the accepted callback's paid-order, identity and email-type guards.
	ob_start();
	mm_mr_zelle_email_next_steps( $order, $sent_to_admin, $plain_text, $email );
	$content = ob_get_clean();
	echo str_replace(
		'October 8-18, 2026.',
		'October 10-18, 2026. Orientation + Match Primer is Saturday, October 10, 12:00-3:00 PM Eastern Time (EDT).',
		$content
	);
}

function mm_mr_orientation_oct10_bind_email_copy() {
	if ( 20 === has_action( 'woocommerce_email_after_order_table', 'mm_mr_zelle_email_next_steps' ) ) {
		remove_action( 'woocommerce_email_after_order_table', 'mm_mr_zelle_email_next_steps', 20 );
		add_action( 'woocommerce_email_after_order_table', 'mm_mr_orientation_oct10_email_next_steps', 20, 4 );
	}
}
add_action( 'init', 'mm_mr_orientation_oct10_bind_email_copy', 30 );
