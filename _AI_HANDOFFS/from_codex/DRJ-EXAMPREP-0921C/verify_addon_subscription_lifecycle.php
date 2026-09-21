<?php
defined( 'ABSPATH' ) || exit;

$assert = static function ( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
};

add_filter( 'woocommerce_webhook_should_deliver', '__return_false', 999 );
foreach ( array( 'new_order', 'cancelled_order', 'failed_order', 'customer_processing_order', 'customer_completed_order', 'customer_on_hold_order', 'customer_invoice', 'cancelled_subscription', 'expired_subscription', 'suspended_subscription', 'new_renewal_order', 'customer_renewal_invoice', 'customer_processing_renewal_order', 'customer_completed_renewal_order' ) as $email_id ) {
	add_filter( 'woocommerce_email_enabled_' . $email_id, '__return_false', 999 );
}

$user_id = 0;
$orders  = array();
$subs    = array();
$result  = array();

try {
	$user_id = wp_insert_user(
		array(
			'user_login' => 'mmdrj_accept_' . strtolower( wp_generate_password( 8, false, false ) ),
			'user_pass'  => wp_generate_password( 24, true, true ),
			'user_email' => 'mmdrj-acceptance-' . time() . '@invalid.example',
			'role'       => 'subscriber',
		)
	);
	$assert( ! is_wp_error( $user_id ) && $user_id > 0, 'Could not create isolated lifecycle user.' );

	$make_subscription = static function ( $product_id, $amount ) use ( $user_id, &$orders, &$subs, $assert ) {
		$product = wc_get_product( $product_id );
		$assert( $product, 'Lifecycle product missing: ' . $product_id );
		$order = wc_create_order( array( 'customer_id' => $user_id, 'created_via' => 'mmdrj_acceptance' ) );
		$assert( ! is_wp_error( $order ), 'Could not create lifecycle parent order.' );
		$order->add_product( $product, 1, array( 'subtotal' => $amount, 'total' => $amount ) );
		$order->calculate_totals();
		$order->set_status( 'processing' );
		$order->save();
		$orders[] = $order;

		$subscription = wcs_create_subscription(
			array(
				'order_id'         => $order->get_id(),
				'customer_id'      => $user_id,
				'status'           => 'pending',
				'billing_period'   => 'month',
				'billing_interval' => 1,
				'start_date'       => gmdate( 'Y-m-d H:i:s' ),
			)
		);
		$assert( ! is_wp_error( $subscription ), 'Could not create lifecycle subscription.' );
		$subscription->add_product( $product, 1, array( 'subtotal' => $amount, 'total' => $amount ) );
		$subscription->calculate_totals();
		$subscription->update_status( 'active' );
		$subs[] = $subscription;
		return $subscription;
	};

	$live  = $make_subscription( 3668, 300 );
	$addon = $make_subscription( 9109, 19.99 );
	$assert( mmdrj_user_has_active_live_group( $user_id ), 'Live eligibility did not activate.' );
	$assert( 'active' === $addon->get_status(), 'Add-on did not begin active.' );

	$live->update_status( 'cancelled', '0921C isolated lifecycle acceptance.', true );
	$addon = wcs_get_subscription( $addon->get_id() );
	$assert( 'cancelled' === $addon->get_status(), 'Add-on remained active after Live eligibility ended.' );

	$result = array(
		'pass'                       => true,
		'live_status_after_end'      => $live->get_status(),
		'addon_status_after_live_end'=> $addon->get_status(),
		'emails_enabled'             => false,
		'webhooks_enabled'           => false,
		'orders_created_for_acceptance' => 2,
		'money_moved_cents'          => 0,
	);
} finally {
	foreach ( array_reverse( $subs ) as $subscription ) {
		if ( is_object( $subscription ) ) {
			$subscription->delete( true );
		}
	}
	foreach ( array_reverse( $orders ) as $order ) {
		if ( is_object( $order ) ) {
			$order->delete( true );
		}
	}
	if ( $user_id && ! is_wp_error( $user_id ) ) {
		require_once ABSPATH . 'wp-admin/includes/user.php';
		wp_delete_user( $user_id );
	}
}

$result['acceptance_records_deleted'] = true;
echo wp_json_encode( $result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . "\n";
