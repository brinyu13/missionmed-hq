<?php
defined( 'ABSPATH' ) || exit;

$paid_order_id     = 9148;
$failed_order_id   = 9138;
$active_sub_id     = 9149;
$pending_sub_id    = 9144;
$coupon_id         = 9141;
$coupon_code       = 'DRJFOUNDER1';
$product_id        = 6360;
$course_id         = 6357;
$expected_user_id  = 1;
$backup_dir        = dirname( ABSPATH ) . '/private/codex-backups/DRJ-EXAMPREP-0921C';
$backup_file       = $backup_dir . '/founder-payment-cleanup-preimage-' . gmdate( 'Ymd-His' ) . '.json';

$paid_order   = wc_get_order( $paid_order_id );
$failed_order = wc_get_order( $failed_order_id );
$active_sub   = wcs_get_subscription( $active_sub_id );
$pending_sub  = wcs_get_subscription( $pending_sub_id );
$coupon       = new WC_Coupon( $coupon_id );

$subscription_products = static function ( $subscription ) {
	$ids = array();
	foreach ( $subscription->get_items( 'line_item' ) as $item ) {
		$ids[] = (int) $item->get_product_id();
		if ( $item->get_variation_id() ) {
			$ids[] = (int) $item->get_variation_id();
		}
	}
	return array_values( array_unique( array_filter( $ids ) ) );
};

if (
	! $paid_order instanceof WC_Order ||
	! $paid_order->is_paid() ||
	'1.00' !== number_format( (float) $paid_order->get_total(), 2, '.', '' ) ||
	$expected_user_id !== (int) $paid_order->get_user_id() ||
	! in_array( strtolower( $coupon_code ), array_map( 'strtolower', $paid_order->get_coupon_codes() ), true )
) {
	throw new RuntimeException( 'Paid parent order preflight failed.' );
}

if (
	! $failed_order instanceof WC_Order ||
	$failed_order->is_paid() ||
	$expected_user_id !== (int) $failed_order->get_user_id()
) {
	throw new RuntimeException( 'Failed-attempt parent order preflight failed.' );
}

$checks = array(
	array( $active_sub, $active_sub_id, $paid_order_id, 'active' ),
	array( $pending_sub, $pending_sub_id, $failed_order_id, 'pending' ),
);
foreach ( $checks as $check ) {
	list( $subscription, $subscription_id, $parent_id, $expected_status ) = $check;
	if (
		! $subscription instanceof WC_Subscription ||
		$subscription_id !== $subscription->get_id() ||
		$parent_id !== (int) $subscription->get_parent_id() ||
		$expected_user_id !== (int) $subscription->get_user_id() ||
		$expected_status !== $subscription->get_status() ||
		'99.99' !== number_format( (float) $subscription->get_total(), 2, '.', '' ) ||
		'month' !== $subscription->get_billing_period() ||
		'1' !== (string) $subscription->get_billing_interval() ||
		! in_array( $product_id, $subscription_products( $subscription ), true )
	) {
		throw new RuntimeException( 'Subscription preflight failed for ' . $subscription_id . '.' );
	}
}

if (
	$coupon_id !== $coupon->get_id() ||
	strtolower( $coupon_code ) !== strtolower( $coupon->get_code() ) ||
	'publish' !== get_post_status( $coupon_id ) ||
	1 !== $coupon->get_usage_count() ||
	'initial_cart' !== $coupon->get_discount_type() ||
	'98.99' !== number_format( (float) $coupon->get_amount(), 2, '.', '' ) ||
	array( $product_id ) !== array_map( 'intval', $coupon->get_product_ids() )
) {
	throw new RuntimeException( 'Founder coupon preflight failed.' );
}

$subscription_snapshot = static function ( $subscription ) use ( $subscription_products ) {
	return array(
		'id'               => $subscription->get_id(),
		'status'           => $subscription->get_status(),
		'parent_id'        => $subscription->get_parent_id(),
		'user_id'          => $subscription->get_user_id(),
		'total'            => $subscription->get_total(),
		'currency'         => $subscription->get_currency(),
		'billing_period'   => $subscription->get_billing_period(),
		'billing_interval' => $subscription->get_billing_interval(),
		'next_payment_utc' => $subscription->get_date( 'next_payment', 'gmt' ) ?: null,
		'end_utc'          => $subscription->get_date( 'end', 'gmt' ) ?: null,
		'product_ids'      => $subscription_products( $subscription ),
	);
};

$preimage = array(
	'captured_at_utc' => gmdate( 'c' ),
	'paid_order'      => array(
		'id'     => $paid_order->get_id(),
		'status' => $paid_order->get_status(),
		'paid'   => $paid_order->is_paid(),
		'total'  => $paid_order->get_total(),
	),
	'failed_order'    => array(
		'id'     => $failed_order->get_id(),
		'status' => $failed_order->get_status(),
		'paid'   => $failed_order->is_paid(),
		'total'  => $failed_order->get_total(),
	),
	'subscriptions'   => array(
		$subscription_snapshot( $active_sub ),
		$subscription_snapshot( $pending_sub ),
	),
	'coupon'          => array(
		'id'          => $coupon->get_id(),
		'code'        => $coupon->get_code(),
		'status'      => get_post_status( $coupon->get_id() ),
		'usage_count' => $coupon->get_usage_count(),
		'expires_at'  => $coupon->get_date_expires() ? $coupon->get_date_expires()->setTimezone( new DateTimeZone( 'UTC' ) )->format( 'c' ) : null,
	),
	'user_meta'       => array(
		'daily_rounds_managed'        => get_user_meta( $expected_user_id, '_mmdrj_daily_rounds_managed', true ),
		'course_preexisting'          => get_user_meta( $expected_user_id, '_mmdrj_daily_rounds_course_preexisting', true ),
		'capability_preexisting'      => get_user_meta( $expected_user_id, '_mmdrj_daily_rounds_cap_preexisting', true ),
	),
);

if ( ! is_dir( $backup_dir ) && ! wp_mkdir_p( $backup_dir ) ) {
	throw new RuntimeException( 'Unable to create private cleanup backup directory.' );
}
$encoded = wp_json_encode( $preimage, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );
if ( strlen( $encoded ) !== file_put_contents( $backup_file, $encoded, LOCK_EX ) ) {
	throw new RuntimeException( 'Unable to write cleanup preimage.' );
}
chmod( $backup_file, 0600 );

$pending_sub->update_status( 'cancelled', 'Founder-authorized cleanup: failed checkout specimen cannot renew.', true );
$active_sub->update_status( 'cancelled', 'Founder-authorized cleanup after successful $1 production payment test; future renewals disabled.', true );

if ( function_exists( 'mmdrj_reconcile_daily_rounds_user' ) ) {
	mmdrj_reconcile_daily_rounds_user( $expected_user_id );
}

$coupon->set_date_expires( time() - MINUTE_IN_SECONDS );
$coupon->save();
wp_update_post( array( 'ID' => $coupon_id, 'post_status' => 'draft' ) );
update_post_meta( $coupon_id, '_mmdrj_private_offer_revoked_at', gmdate( 'c' ) );
update_post_meta( $coupon_id, '_mmdrj_private_offer_revoke_reason', 'Successful Founder payment completed; coupon retired.' );

$active_sub  = wcs_get_subscription( $active_sub_id );
$pending_sub = wcs_get_subscription( $pending_sub_id );
$coupon      = new WC_Coupon( $coupon_id );
$paid_order  = wc_get_order( $paid_order_id );

echo wp_json_encode(
	array(
		'backup'                    => $backup_file,
		'paid_order_id'             => $paid_order->get_id(),
		'paid_order_status'         => $paid_order->get_status(),
		'paid_order_preserved'      => $paid_order->is_paid() && '1.00' === number_format( (float) $paid_order->get_total(), 2, '.', '' ),
		'active_subscription'       => $subscription_snapshot( $active_sub ),
		'pending_subscription'      => $subscription_snapshot( $pending_sub ),
		'coupon_status'             => get_post_status( $coupon_id ),
		'coupon_usage_count'        => $coupon->get_usage_count(),
		'coupon_expired'            => $coupon->get_date_expires() && $coupon->get_date_expires()->getTimestamp() < time(),
		'course_access_after'       => function_exists( 'sfwd_lms_has_access' ) ? (bool) sfwd_lms_has_access( $course_id, $expected_user_id ) : null,
		'drills_capability_after'   => user_can( $expected_user_id, 'missionmed_access_drj_drills' ),
		'full_access_after'         => function_exists( 'mm_drj_drills_access_user_has_full_access' ) ? mm_drj_drills_access_user_has_full_access( $expected_user_id ) : null,
		'restricted_after'          => function_exists( 'mm_drj_drills_access_user_is_restricted' ) ? mm_drj_drills_access_user_is_restricted( $expected_user_id ) : null,
		'money_refunded_cents'      => 0,
	),
	JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
) . "\n";
