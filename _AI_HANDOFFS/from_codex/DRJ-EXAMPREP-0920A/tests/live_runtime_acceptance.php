<?php
defined( 'ABSPATH' ) || exit;

if ( ! function_exists( 'wcs_create_subscription' ) || ! function_exists( 'ld_update_course_access' ) ) {
	throw new RuntimeException( 'Required subscription or LearnDash runtime is unavailable.' );
}

foreach ( array(
	'new_order',
	'cancelled_order',
	'failed_order',
	'customer_completed_order',
	'customer_processing_order',
	'customer_on_hold_order',
	'new_renewal_order',
	'customer_renewal_invoice',
	'cancelled_subscription',
	'expired_subscription',
	'on_hold_subscription',
) as $email_id ) {
	add_filter( 'woocommerce_email_enabled_' . $email_id, '__return_false', 999 );
}
add_filter( 'woocommerce_webhook_should_deliver', '__return_false', 999 );

$mmdrj_accept_users = array();
$mmdrj_accept_subscriptions = array();
$mmdrj_accept_coupons = array();
$mmdrj_accept_result = array( 'money_moved_cents' => 0 );

$mmdrj_accept_assert = static function ( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
};

$mmdrj_accept_new_user = static function ( $label ) use ( &$mmdrj_accept_users ) {
	$username = 'drj0920a-' . sanitize_key( $label ) . '-' . strtolower( wp_generate_password( 8, false, false ) );
	$user_id = wp_create_user( $username, wp_generate_password( 28, true, true ), $username . '@example.invalid' );
	if ( is_wp_error( $user_id ) ) {
		throw new RuntimeException( 'Could not create controlled acceptance user.' );
	}
	$mmdrj_accept_users[] = absint( $user_id );
	return absint( $user_id );
};

$mmdrj_accept_new_subscription = static function ( $user_id, $product_id ) use ( &$mmdrj_accept_subscriptions ) {
	$product = wc_get_product( $product_id );
	if ( ! $product ) {
		throw new RuntimeException( 'Acceptance product was unavailable: ' . $product_id );
	}
	$subscription = wcs_create_subscription( array(
		'customer_id' => absint( $user_id ),
		'status' => 'pending',
		'billing_period' => 'month',
		'billing_interval' => 1,
		'start_date' => gmdate( 'Y-m-d H:i:s' ),
	) );
	if ( is_wp_error( $subscription ) || ! $subscription instanceof WC_Subscription ) {
		throw new RuntimeException( 'Could not create controlled acceptance subscription.' );
	}
	$subscription->add_product( $product, 1 );
	$subscription->calculate_totals();
	$subscription->save();
	$mmdrj_accept_subscriptions[] = $subscription;
	$subscription->update_status( 'active', 'DRJ-EXAMPREP-0920A controlled zero-money acceptance.', true );
	return $subscription;
};

try {
	$offer_user_id = $mmdrj_accept_new_user( 'offer' );
	$student_uuid = wp_generate_uuid4();
	update_user_meta( $offer_user_id, MMDRJ_ACCOUNT_UUID_META, $student_uuid );
	update_user_meta( $offer_user_id, MMDRJ_ELIGIBILITY_META, array( 'mul' ) );

	$request = new WP_REST_Request( 'POST', '/missionmed/v1/examprep/private-offers' );
	$request->set_param( 'student_uuid', $student_uuid );
	$request->set_param( 'reason', 'DRJ-EXAMPREP-0920A controlled issuer acceptance.' );
	$response = mmdrj_issue_private_offer( $request );
	$mmdrj_accept_assert( $response instanceof WP_REST_Response && 201 === $response->get_status(), 'Private offer issuance failed.' );
	$offer = $response->get_data();
	$mmdrj_accept_assert( 1 === preg_match( '/^DRJMUL-[A-Z0-9]{10}$/', $offer['code'] ), 'Private offer code format was not uniform/relevant.' );
	$mmdrj_accept_assert( 4999 === $offer['amount_cents'], 'Private offer result did not resolve to 49.99.' );
	$coupon = new WC_Coupon( $offer['code'] );
	$coupon_id = absint( $coupon->get_id() );
	$mmdrj_accept_coupons[] = $coupon_id;
	$mmdrj_accept_assert( 'recurring_fee' === $coupon->get_discount_type(), 'Private offer was not a recurring fee coupon.' );
	$mmdrj_accept_assert( '50' === (string) $coupon->get_amount() || '50.00' === (string) $coupon->get_amount(), 'Private offer discount was not 50.00.' );
	$mmdrj_accept_assert( array( MMDRJ_DAILY_DRILLS_PRODUCT_ID ) === array_map( 'absint', $coupon->get_product_ids() ), 'Private offer product scope was wrong.' );
	$mmdrj_accept_assert( 1 === absint( $coupon->get_usage_limit() ) && 1 === absint( $coupon->get_usage_limit_per_user() ), 'Private offer usage limits were wrong.' );
	$mmdrj_accept_assert( array( get_userdata( $offer_user_id )->user_email ) === $coupon->get_email_restrictions(), 'Private offer email binding was wrong.' );

	update_user_meta( $offer_user_id, MMDRJ_ELIGIBILITY_META, array( 'ucc' ) );
	$mmdrj_accept_assert( 'DRJUCC' === mmdrj_private_offer_prefix( $offer_user_id ), 'UCC prefix was wrong.' );
	update_user_meta( $offer_user_id, MMDRJ_ELIGIBILITY_META, array( 'guarantee_ucc_mul' ) );
	$mmdrj_accept_assert( 'DRJGUARANTEE' === mmdrj_private_offer_prefix( $offer_user_id ), 'Guarantee prefix was wrong.' );

	$revoke = new WP_REST_Request( 'POST', '/missionmed/v1/examprep/private-offers/revoke' );
	$revoke->set_param( 'student_uuid', $student_uuid );
	$revoke->set_param( 'reason', 'DRJ-EXAMPREP-0920A controlled cleanup.' );
	$revoke_response = mmdrj_revoke_private_offer( $revoke );
	$mmdrj_accept_assert( $revoke_response instanceof WP_REST_Response && 1 === absint( $revoke_response->get_data()['revoked'] ), 'Private offer revoke failed.' );
	$mmdrj_accept_assert( 'draft' === get_post_status( $coupon_id ) && '' !== get_post_meta( $coupon_id, MMDRJ_PRIVATE_REVOKED_META, true ), 'Revoked offer remained usable.' );
	$mmdrj_accept_result['private_offer'] = array(
		'code_shape' => 'DRJMUL-XXXXXXXXXX',
		'other_prefixes' => array( 'DRJUCC', 'DRJGUARANTEE' ),
		'final_price_cents' => 4999,
		'account_bound' => true,
		'revoked' => true,
	);

	$lifecycle_user_id = $mmdrj_accept_new_user( 'lifecycle' );
	ld_update_course_access( $lifecycle_user_id, MMDRJ_DAILY_DRILLS_COURSE_ID, true );
	ld_update_course_access( $lifecycle_user_id, MMDRJ_TEAM_COURSE_ID, true );

	$daily_one = $mmdrj_accept_new_subscription( $lifecycle_user_id, MMDRJ_DAILY_DRILLS_PRODUCT_ID );
	mmdrj_reconcile_daily_rounds_user( $lifecycle_user_id );
	$mmdrj_accept_assert( sfwd_lms_has_access( MMDRJ_DAILY_DRILLS_COURSE_ID, $lifecycle_user_id ), 'Active Daily subscription did not grant the Daily course.' );
	$mmdrj_accept_assert( user_can( $lifecycle_user_id, MMDRJ_DAILY_ROUNDS_CAP ), 'Active Daily subscription did not grant the Daily capability.' );

	$daily_two = $mmdrj_accept_new_subscription( $lifecycle_user_id, MMDRJ_DAILY_DRILLS_PRODUCT_ID );
	$daily_one->update_status( 'cancelled', 'Controlled overlap test.', true );
	mmdrj_reconcile_daily_rounds_user( $lifecycle_user_id );
	$mmdrj_accept_assert( sfwd_lms_has_access( MMDRJ_DAILY_DRILLS_COURSE_ID, $lifecycle_user_id ) && user_can( $lifecycle_user_id, MMDRJ_DAILY_ROUNDS_CAP ), 'Cancelling one of two Daily subscriptions removed access.' );
	$daily_two->update_status( 'cancelled', 'Controlled final cancellation test.', true );
	mmdrj_reconcile_daily_rounds_user( $lifecycle_user_id );
	$mmdrj_accept_assert( ! sfwd_lms_has_access( MMDRJ_DAILY_DRILLS_COURSE_ID, $lifecycle_user_id ) && ! user_can( $lifecycle_user_id, MMDRJ_DAILY_ROUNDS_CAP ), 'Final Daily cancellation did not revoke managed access.' );

	$lifecycle_user = new WP_User( $lifecycle_user_id );
	$lifecycle_user->add_cap( MMDRJ_DAILY_ROUNDS_CAP, true );
	$daily_preexisting = $mmdrj_accept_new_subscription( $lifecycle_user_id, MMDRJ_DAILY_DRILLS_PRODUCT_ID );
	$daily_preexisting->update_status( 'cancelled', 'Controlled preexisting-capability test.', true );
	mmdrj_reconcile_daily_rounds_user( $lifecycle_user_id );
	$mmdrj_accept_assert( user_can( $lifecycle_user_id, MMDRJ_DAILY_ROUNDS_CAP ), 'Preexisting Daily capability was removed.' );
	$mmdrj_accept_assert( ! sfwd_lms_has_access( MMDRJ_DAILY_DRILLS_COURSE_ID, $lifecycle_user_id ), 'Managed Daily course remained after cancellation.' );

	$lifecycle_user->add_cap( 'missionmed_access_arena_pro', true );
	$mmdrj_accept_assert( ! mm_drj_drills_access_user_is_restricted( $lifecycle_user_id ), 'Explicit full Arena access was overridden by the Daily capability.' );
	$lifecycle_user->remove_cap( 'missionmed_access_arena_pro' );
	$mmdrj_accept_assert( mm_drj_drills_access_user_is_restricted( $lifecycle_user_id ), 'Daily-only capability did not apply the premium lock.' );

	$team = $mmdrj_accept_new_subscription( $lifecycle_user_id, 3668 );
	mmdrj_reconcile_team_user( $lifecycle_user_id );
	$mmdrj_accept_assert( sfwd_lms_has_access( MMDRJ_TEAM_COURSE_ID, $lifecycle_user_id ), 'Active Live Group subscription did not grant the team course.' );
	$mmdrj_accept_assert( mmdrj_user_meets_product_requirement( $lifecycle_user_id, 9109 ), 'Active Live Group subscription did not unlock add-on eligibility.' );
	$team->update_status( 'cancelled', 'Controlled Live Group cancellation test.', true );
	mmdrj_reconcile_team_user( $lifecycle_user_id );
	$mmdrj_accept_assert( ! sfwd_lms_has_access( MMDRJ_TEAM_COURSE_ID, $lifecycle_user_id ), 'Live Group cancellation did not revoke the managed team course.' );
	$mmdrj_accept_assert( ! mmdrj_user_meets_product_requirement( $lifecycle_user_id, 9109 ), 'Cancelled Live Group subscription still unlocked add-on eligibility.' );

	$mmdrj_accept_result['entitlements'] = array(
		'daily_active_grant' => true,
		'multiple_active_preserved' => true,
		'final_cancel_revoked' => true,
		'preexisting_cap_preserved' => true,
		'full_access_override_preserved' => true,
		'premium_lock_for_daily_only' => true,
		'live_group_course_grant_revoke' => true,
		'live_group_addon_eligibility_grant_revoke' => true,
	);
} finally {
	foreach ( array_reverse( $mmdrj_accept_subscriptions ) as $subscription ) {
		if ( $subscription instanceof WC_Subscription ) {
			$subscription->delete( true );
		}
	}
	foreach ( array_unique( array_filter( $mmdrj_accept_coupons ) ) as $coupon_id ) {
		wp_delete_post( $coupon_id, true );
	}
	if ( ! function_exists( 'wp_delete_user' ) ) {
		require_once ABSPATH . 'wp-admin/includes/user.php';
	}
	foreach ( array_unique( array_filter( $mmdrj_accept_users ) ) as $user_id ) {
		wp_delete_user( $user_id );
	}
}

echo wp_json_encode( $mmdrj_accept_result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . "\n";
