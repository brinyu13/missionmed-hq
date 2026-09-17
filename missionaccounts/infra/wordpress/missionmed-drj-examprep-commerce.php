<?php
/**
 * Plugin Name: MissionMed Dr J ExamPrep Commerce Guard
 * Description: Enforces the 5404D ExamPrep catalog, private offers, and order-to-course lifecycle.
 * Version: 1.1.0
 */

defined( 'ABSPATH' ) || exit;

const MMDRJ_VERSION                       = '1.1.0';
const MMDRJ_ELIGIBILITY_META              = '_mmed_drj_pricing_eligibility';
const MMDRJ_REQUIRED_ELIGIBILITY_META     = '_mmed_drj_required_eligibility';
const MMDRJ_PAYMENT_ARCHITECTURE_META     = '_mmi_payment_architecture';
const MMDRJ_PAYMENT_ARCHITECTURE_DIVISION = 'division_platform';
const MMDRJ_TEAM_COURSE_ID                = 3655;
const MMDRJ_DAILY_DRILLS_COURSE_ID        = 6357;
const MMDRJ_TEAM_PRODUCT_ID               = 3651;
const MMDRJ_TUTORING_PRODUCT_ID           = 3652;
const MMDRJ_DAILY_DRILLS_PRODUCT_ID       = 6360;
const MMDRJ_PLANNING_PRODUCT_ID           = 9015;
const MMDRJ_TUTORING_PACK_PRODUCT_ID      = 9016;
const MMDRJ_DAILY_DRILLS_AUDIO_PRODUCT_ID = 9017;
const MMDRJ_ADDON_PRODUCT_OPTION          = 'mmdrj_daily_drills_addon_product_id';
const MMDRJ_ACCOUNT_UUID_META             = '_missionmed_missionaccounts_user_id';
const MMDRJ_PRIVATE_STUDENT_META          = '_mmdrj_private_offer_student_uuid';
const MMDRJ_PRIVATE_USER_META             = '_mmdrj_private_offer_user_id';
const MMDRJ_PRIVATE_REVOKED_META          = '_mmdrj_private_offer_revoked_at';
const MMDRJ_PRIVATE_REDEEMED_META         = '_mmdrj_private_offer_redeemed_at';

function mmdrj_user_eligibilities( $user_id ) {
	$value = get_user_meta( absint( $user_id ), MMDRJ_ELIGIBILITY_META, true );
	if ( is_string( $value ) ) {
		$value = preg_split( '/[\s,]+/', $value );
	}
	return array_values( array_unique( array_filter( array_map( 'sanitize_key', is_array( $value ) ? $value : array() ) ) ) );
}

function mmdrj_product_ids() {
	return array_values( array_filter( array_unique( array(
		3651, 3652, 6360, 9015, 9016, 9017, absint( get_option( MMDRJ_ADDON_PRODUCT_OPTION, 0 ) ),
	) ) ) );
}

function mmdrj_catalog_prices() {
	$prices = array(
		MMDRJ_TEAM_PRODUCT_ID               => '300.00',
		MMDRJ_TUTORING_PRODUCT_ID           => '85.00',
		MMDRJ_DAILY_DRILLS_PRODUCT_ID       => '99.99',
		MMDRJ_PLANNING_PRODUCT_ID           => '50.00',
		MMDRJ_TUTORING_PACK_PRODUCT_ID      => '800.00',
		MMDRJ_DAILY_DRILLS_AUDIO_PRODUCT_ID => '149.99',
	);
	$addon = absint( get_option( MMDRJ_ADDON_PRODUCT_OPTION, 0 ) );
	if ( $addon ) {
		$prices[ $addon ] = '19.99';
	}
	return $prices;
}

/**
 * Enforce the registered 5404D price only for a new checkout line. Existing
 * subscriptions and switches retain their own contracted order prices.
 */
function mmdrj_enforce_new_checkout_prices( $cart ) {
	if ( ! is_object( $cart ) || ! method_exists( $cart, 'get_cart' ) ) {
		return;
	}
	foreach ( $cart->get_cart() as $item ) {
		if ( ! empty( $item['subscription_renewal'] ) || ! empty( $item['subscription_switch'] ) ) {
			continue;
		}
		$product = $item['data'] ?? null;
		if ( ! is_object( $product ) || ! method_exists( $product, 'get_id' ) || ! method_exists( $product, 'set_price' ) ) {
			continue;
		}
		$parent_id = method_exists( $product, 'get_parent_id' ) ? absint( $product->get_parent_id() ) : 0;
		$product_id = $parent_id ?: absint( $product->get_id() );
		$prices = mmdrj_catalog_prices();
		if ( isset( $prices[ $product_id ] ) ) {
			$product->set_price( $prices[ $product_id ] );
		}
	}
}
add_action( 'woocommerce_before_calculate_totals', 'mmdrj_enforce_new_checkout_prices', 5 );

function mmdrj_validate_checkout_catalog_prices() {
	if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
		return;
	}
	$prices = mmdrj_catalog_prices();
	foreach ( WC()->cart->get_cart() as $item ) {
		if ( ! empty( $item['subscription_renewal'] ) || ! empty( $item['subscription_switch'] ) ) {
			continue;
		}
		$product = $item['data'] ?? null;
		if ( ! is_object( $product ) || ! method_exists( $product, 'get_id' ) || ! method_exists( $product, 'get_price' ) ) {
			continue;
		}
		$parent_id = method_exists( $product, 'get_parent_id' ) ? absint( $product->get_parent_id() ) : 0;
		$product_id = $parent_id ?: absint( $product->get_id() );
		if ( isset( $prices[ $product_id ] ) && number_format( (float) $product->get_price(), 2, '.', '' ) !== $prices[ $product_id ] ) {
			wc_add_notice( __( 'ExamPrep checkout pricing could not be verified. Please refresh and try again.', 'missionmed' ), 'error' );
		}
	}
}
add_action( 'woocommerce_check_cart_items', 'mmdrj_validate_checkout_catalog_prices', 30 );

function mmdrj_product_course_map() {
	$map = array(
		MMDRJ_TEAM_PRODUCT_ID               => MMDRJ_TEAM_COURSE_ID,
		MMDRJ_DAILY_DRILLS_PRODUCT_ID       => MMDRJ_DAILY_DRILLS_COURSE_ID,
		MMDRJ_DAILY_DRILLS_AUDIO_PRODUCT_ID => MMDRJ_DAILY_DRILLS_COURSE_ID,
	);
	$addon = absint( get_option( MMDRJ_ADDON_PRODUCT_OPTION, 0 ) );
	if ( $addon ) {
		$map[ $addon ] = MMDRJ_DAILY_DRILLS_COURSE_ID;
	}
	return $map;
}

function mmdrj_user_has_active_live_group( $user_id ) {
	if ( ! function_exists( 'wcs_get_users_subscriptions' ) ) {
		return false;
	}
	foreach ( (array) wcs_get_users_subscriptions( absint( $user_id ) ) as $subscription ) {
		if ( ! is_object( $subscription ) || ! in_array( $subscription->get_status(), array( 'active', 'pending-cancel' ), true ) ) {
			continue;
		}
		foreach ( $subscription->get_items() as $item ) {
			if ( MMDRJ_TEAM_PRODUCT_ID === absint( $item->get_product_id() ) ) {
				return true;
			}
		}
	}
	return false;
}

function mmdrj_user_meets_product_requirement( $user_id, $product_id ) {
	$required = sanitize_key( (string) get_post_meta( absint( $product_id ), MMDRJ_REQUIRED_ELIGIBILITY_META, true ) );
	if ( '' === $required ) {
		return true;
	}
	if ( $user_id <= 0 ) {
		return false;
	}
	if ( 'live_groups_addon' === $required ) {
		return mmdrj_user_has_active_live_group( $user_id );
	}
	return in_array( $required, mmdrj_user_eligibilities( $user_id ), true );
}

function mmdrj_restrict_product_purchase( $purchasable, $product ) {
	if ( ! $purchasable || ! is_object( $product ) || ! method_exists( $product, 'get_id' ) ) {
		return $purchasable;
	}
	$parent = method_exists( $product, 'get_parent_id' ) ? absint( $product->get_parent_id() ) : 0;
	return mmdrj_user_meets_product_requirement( get_current_user_id(), $parent ?: absint( $product->get_id() ) );
}
add_filter( 'woocommerce_is_purchasable', 'mmdrj_restrict_product_purchase', 20, 2 );
add_filter( 'woocommerce_variation_is_purchasable', 'mmdrj_restrict_product_purchase', 20, 2 );

function mmdrj_validate_restricted_add_to_cart( $passed, $product_id ) {
	if ( $passed && ! mmdrj_user_meets_product_requirement( get_current_user_id(), absint( $product_id ) ) ) {
		wc_add_notice( __( 'This ExamPrep offer is available only to the verified account it was issued for.', 'missionmed' ), 'error' );
		return false;
	}
	return $passed;
}
add_filter( 'woocommerce_add_to_cart_validation', 'mmdrj_validate_restricted_add_to_cart', 20, 2 );

function mmdrj_course_grant_meta( $course_id ) {
	return '_mmdrj_course_grant_orders_' . absint( $course_id );
}

function mmdrj_course_preexisting_meta( $course_id ) {
	return '_mmdrj_course_access_preexisting_' . absint( $course_id );
}

function mmdrj_order_product_ids( $order ) {
	$ids = array();
	if ( is_object( $order ) && method_exists( $order, 'get_items' ) ) {
		foreach ( $order->get_items() as $item ) {
			$ids[] = absint( $item->get_product_id() );
			$ids[] = absint( $item->get_variation_id() );
		}
	}
	return array_values( array_filter( array_unique( $ids ) ) );
}

function mmdrj_order_courses( $order ) {
	$map = mmdrj_product_course_map();
	$courses = array();
	foreach ( mmdrj_order_product_ids( $order ) as $product_id ) {
		if ( isset( $map[ $product_id ] ) ) {
			$courses[] = $map[ $product_id ];
		}
	}
	return array_values( array_unique( $courses ) );
}

function mmdrj_grant_courses_from_order( $order_or_id ) {
	if ( ! function_exists( 'wc_get_order' ) || ! function_exists( 'ld_update_course_access' ) ) {
		return;
	}
	$order = is_numeric( $order_or_id ) ? wc_get_order( absint( $order_or_id ) ) : $order_or_id;
	$user_id = $order ? absint( $order->get_user_id() ) : 0;
	$order_id = $order ? absint( $order->get_id() ) : 0;
	if ( ! $user_id || ! $order_id ) {
		return;
	}
	foreach ( mmdrj_order_courses( $order ) as $course_id ) {
		$meta = mmdrj_course_grant_meta( $course_id );
		$orders = array_values( array_unique( array_merge( (array) get_user_meta( $user_id, $meta, true ), array( $order_id ) ) ) );
		if ( ! get_user_meta( $user_id, mmdrj_course_preexisting_meta( $course_id ), true ) && function_exists( 'sfwd_lms_has_access' ) ) {
			update_user_meta( $user_id, mmdrj_course_preexisting_meta( $course_id ), sfwd_lms_has_access( $course_id, $user_id ) ? 'yes' : 'no' );
		}
		ld_update_course_access( $user_id, $course_id );
		update_user_meta( $user_id, $meta, array_map( 'absint', $orders ) );
	}
}

function mmdrj_order_is_currently_paid( $order ) {
	return is_object( $order ) && in_array( $order->get_status(), array( 'processing', 'completed', 'active', 'pending-cancel' ), true );
}

function mmdrj_course_has_active_plugin_grant( $user_id, $course_id ) {
	foreach ( (array) get_user_meta( $user_id, mmdrj_course_grant_meta( $course_id ), true ) as $order_id ) {
		$order = function_exists( 'wc_get_order' ) ? wc_get_order( absint( $order_id ) ) : false;
		if ( $order && mmdrj_order_is_currently_paid( $order ) && in_array( $course_id, mmdrj_order_courses( $order ), true ) ) {
			return true;
		}
	}
	return false;
}

function mmdrj_revoke_courses_from_order( $order_or_id ) {
	if ( ! function_exists( 'wc_get_order' ) || ! function_exists( 'ld_update_course_access' ) ) {
		return;
	}
	$order = is_numeric( $order_or_id ) ? wc_get_order( absint( $order_or_id ) ) : $order_or_id;
	$user_id = $order ? absint( $order->get_user_id() ) : 0;
	$order_id = $order ? absint( $order->get_id() ) : 0;
	if ( ! $user_id || ! $order_id ) {
		return;
	}
	foreach ( mmdrj_order_courses( $order ) as $course_id ) {
		$meta = mmdrj_course_grant_meta( $course_id );
		$orders = array_values( array_diff( array_map( 'absint', (array) get_user_meta( $user_id, $meta, true ) ), array( $order_id ) ) );
		update_user_meta( $user_id, $meta, $orders );
		$preexisting = 'yes' === get_user_meta( $user_id, mmdrj_course_preexisting_meta( $course_id ), true );
		$guarantee = MMDRJ_TEAM_COURSE_ID === $course_id && in_array( 'guarantee_live_group_free', mmdrj_user_eligibilities( $user_id ), true );
		if ( ! $preexisting && ! $guarantee && ! mmdrj_course_has_active_plugin_grant( $user_id, $course_id ) ) {
			ld_update_course_access( $user_id, $course_id, true );
		}
	}
}

foreach ( array( 'processing', 'completed' ) as $status ) {
	add_action( 'woocommerce_order_status_' . $status, 'mmdrj_grant_courses_from_order', 20 );
}
foreach ( array( 'cancelled', 'failed', 'refunded' ) as $status ) {
	add_action( 'woocommerce_order_status_' . $status, 'mmdrj_revoke_courses_from_order', 20 );
}
foreach ( array( 'active', 'pending-cancel' ) as $status ) {
	add_action( 'woocommerce_subscription_status_' . $status, 'mmdrj_grant_courses_from_order', 20 );
}
foreach ( array( 'cancelled', 'expired', 'on-hold' ) as $status ) {
	add_action( 'woocommerce_subscription_status_' . $status, 'mmdrj_revoke_courses_from_order', 20 );
}

function mmdrj_private_offer_admin() {
	return is_user_logged_in() && ( current_user_can( 'manage_woocommerce' ) || current_user_can( 'manage_options' ) );
}

function mmdrj_private_offer_user( $student_uuid ) {
	if ( ! preg_match( '/^[a-f0-9-]{36}$/', $student_uuid ) ) {
		return new WP_Error( 'invalid_student', 'A canonical student account is required.', array( 'status' => 400 ) );
	}
	$users = get_users( array( 'meta_key' => MMDRJ_ACCOUNT_UUID_META, 'meta_value' => $student_uuid, 'fields' => 'all', 'number' => 2 ) );
	if ( 1 !== count( $users ) ) {
		return new WP_Error( 'student_account_resolution_failed', 'Exactly one linked MissionMed account is required.', array( 'status' => 409 ) );
	}
	return $users[0];
}

function mmdrj_private_offer_eligible( $user_id ) {
	return (bool) array_intersect( array( 'ucc', 'mul', 'guarantee_ucc_mul' ), mmdrj_user_eligibilities( $user_id ) );
}

function mmdrj_active_private_coupon_ids( $student_uuid ) {
	return get_posts( array(
		'post_type' => 'shop_coupon', 'post_status' => array( 'publish', 'draft' ), 'numberposts' => -1,
		'fields' => 'ids', 'meta_key' => MMDRJ_PRIVATE_STUDENT_META, 'meta_value' => $student_uuid,
	) );
}

function mmdrj_revoke_private_coupons( $student_uuid, $reason ) {
	$count = 0;
	foreach ( mmdrj_active_private_coupon_ids( $student_uuid ) as $coupon_id ) {
		if ( get_post_meta( $coupon_id, MMDRJ_PRIVATE_REVOKED_META, true ) ) {
			continue;
		}
		update_post_meta( $coupon_id, MMDRJ_PRIVATE_REVOKED_META, gmdate( 'c' ) );
		update_post_meta( $coupon_id, '_mmdrj_private_offer_revoke_reason', sanitize_textarea_field( $reason ) );
		wp_update_post( array( 'ID' => $coupon_id, 'post_status' => 'draft' ) );
		$count++;
	}
	return $count;
}

function mmdrj_issue_private_offer( WP_REST_Request $request ) {
	$student_uuid = strtolower( sanitize_text_field( (string) $request->get_param( 'student_uuid' ) ) );
	$reason = trim( sanitize_textarea_field( (string) $request->get_param( 'reason' ) ) );
	if ( strlen( $reason ) < 3 ) {
		return new WP_Error( 'reason_required', 'A documented reason is required.', array( 'status' => 400 ) );
	}
	$user = mmdrj_private_offer_user( $student_uuid );
	if ( is_wp_error( $user ) ) {
		return $user;
	}
	if ( ! mmdrj_private_offer_eligible( $user->ID ) ) {
		return new WP_Error( 'private_offer_not_eligible', 'The linked account is not currently eligible.', array( 'status' => 403 ) );
	}
	if ( ! class_exists( 'WC_Coupon' ) || ! get_post( MMDRJ_DAILY_DRILLS_PRODUCT_ID ) ) {
		return new WP_Error( 'commerce_unavailable', 'WooCommerce private offers are unavailable.', array( 'status' => 503 ) );
	}
	mmdrj_revoke_private_coupons( $student_uuid, 'Replaced by a newly issued offer.' );
	$code = 'MM-' . strtoupper( wp_generate_password( 22, false, false ) );
	$coupon = new WC_Coupon();
	$coupon->set_code( $code );
	$coupon->set_description( 'Account-bound MissionMed ExamPrep private offer.' );
	$coupon->set_discount_type( class_exists( 'WC_Subscriptions' ) ? 'recurring_product' : 'fixed_product' );
	$coupon->set_amount( '60.00' );
	$coupon->set_individual_use( true );
	$coupon->set_product_ids( array( MMDRJ_DAILY_DRILLS_PRODUCT_ID ) );
	$coupon->set_email_restrictions( array( $user->user_email ) );
	$coupon->set_usage_limit( 1 );
	$coupon->set_usage_limit_per_user( 1 );
	$coupon->set_date_expires( time() + 14 * DAY_IN_SECONDS );
	$coupon_id = $coupon->save();
	update_post_meta( $coupon_id, MMDRJ_PRIVATE_STUDENT_META, $student_uuid );
	update_post_meta( $coupon_id, MMDRJ_PRIVATE_USER_META, absint( $user->ID ) );
	update_post_meta( $coupon_id, '_mmdrj_private_offer_reason', $reason );
	update_post_meta( $coupon_id, '_mmdrj_private_offer_issued_by', get_current_user_id() );
	return new WP_REST_Response( array(
		'issued' => true, 'student_uuid' => $student_uuid, 'code' => $code,
		'expires_at' => gmdate( 'c', time() + 14 * DAY_IN_SECONDS ), 'amount_cents' => 3999,
		'usage_limit' => 1, 'provider_action' => 'coupon_created', 'money_moved_cents' => 0,
	), 201 );
}

function mmdrj_revoke_private_offer( WP_REST_Request $request ) {
	$student_uuid = strtolower( sanitize_text_field( (string) $request->get_param( 'student_uuid' ) ) );
	$reason = trim( sanitize_textarea_field( (string) $request->get_param( 'reason' ) ) );
	$user = mmdrj_private_offer_user( $student_uuid );
	if ( strlen( $reason ) < 3 || is_wp_error( $user ) ) {
		return new WP_Error( 'invalid_revoke', 'A linked account and documented reason are required.', array( 'status' => 400 ) );
	}
	return new WP_REST_Response( array( 'revoked' => mmdrj_revoke_private_coupons( $student_uuid, $reason ), 'money_moved_cents' => 0 ), 200 );
}

function mmdrj_validate_private_coupon( $valid, $coupon ) {
	if ( ! $valid || ! is_object( $coupon ) ) {
		return $valid;
	}
	$coupon_id = absint( $coupon->get_id() );
	$student_uuid = (string) get_post_meta( $coupon_id, MMDRJ_PRIVATE_STUDENT_META, true );
	if ( '' === $student_uuid ) {
		return $valid;
	}
	$user_id = get_current_user_id();
	return $user_id > 0
		&& $user_id === absint( get_post_meta( $coupon_id, MMDRJ_PRIVATE_USER_META, true ) )
		&& hash_equals( $student_uuid, strtolower( (string) get_user_meta( $user_id, MMDRJ_ACCOUNT_UUID_META, true ) ) )
		&& mmdrj_private_offer_eligible( $user_id )
		&& ! get_post_meta( $coupon_id, MMDRJ_PRIVATE_REVOKED_META, true );
}
add_filter( 'woocommerce_coupon_is_valid', 'mmdrj_validate_private_coupon', 30, 2 );

function mmdrj_mark_private_offer_redeemed( $order_id ) {
	$order = function_exists( 'wc_get_order' ) ? wc_get_order( $order_id ) : false;
	if ( ! $order ) {
		return;
	}
	foreach ( $order->get_coupon_codes() as $code ) {
		$coupon = new WC_Coupon( $code );
		if ( get_post_meta( $coupon->get_id(), MMDRJ_PRIVATE_STUDENT_META, true ) ) {
			update_post_meta( $coupon->get_id(), MMDRJ_PRIVATE_REDEEMED_META, gmdate( 'c' ) );
			update_post_meta( $coupon->get_id(), '_mmdrj_private_offer_order_id', absint( $order_id ) );
		}
	}
}
add_action( 'woocommerce_order_status_processing', 'mmdrj_mark_private_offer_redeemed', 30 );
add_action( 'woocommerce_order_status_completed', 'mmdrj_mark_private_offer_redeemed', 30 );

function mmdrj_provision_addon_product( WP_REST_Request $request ) {
	if ( 'PROVISION-EXAMPREP-ADDON-19.99' !== (string) $request->get_param( 'confirmation' ) ) {
		return new WP_Error( 'confirmation_required', 'Exact catalog confirmation is required.', array( 'status' => 400 ) );
	}
	$existing = absint( get_option( MMDRJ_ADDON_PRODUCT_OPTION, 0 ) );
	if ( $existing && get_post( $existing ) ) {
		return new WP_REST_Response( array( 'created' => false, 'product_id' => $existing, 'price' => '19.99', 'money_moved_cents' => 0 ), 200 );
	}
	if ( ! class_exists( 'WC_Product_Subscription' ) ) {
		return new WP_Error( 'subscriptions_required', 'WooCommerce Subscriptions is required.', array( 'status' => 503 ) );
	}
	$product = new WC_Product_Subscription();
	$product->set_name( 'Daily Drills Add-on for Live Group Students' );
	$product->set_slug( 'daily-drills-live-group-addon-monthly' );
	$product->set_status( 'publish' );
	$product->set_catalog_visibility( 'hidden' );
	$product->set_virtual( true );
	$product->set_sku( 'examprep-daily-drills-live-group-addon-monthly' );
	$product->set_regular_price( '19.99' );
	$product->set_price( '19.99' );
	$product->set_description( 'Monthly Daily Drills add-on for students with an active Live Group Drilling subscription.' );
	$product_id = $product->save();
	update_post_meta( $product_id, '_subscription_price', '19.99' );
	update_post_meta( $product_id, '_subscription_period', 'month' );
	update_post_meta( $product_id, '_subscription_period_interval', '1' );
	update_post_meta( $product_id, MMDRJ_REQUIRED_ELIGIBILITY_META, 'live_groups_addon' );
	update_post_meta( $product_id, MMDRJ_PAYMENT_ARCHITECTURE_META, MMDRJ_PAYMENT_ARCHITECTURE_DIVISION );
	update_option( MMDRJ_ADDON_PRODUCT_OPTION, $product_id, false );
	return new WP_REST_Response( array( 'created' => true, 'product_id' => $product_id, 'price' => '19.99', 'money_moved_cents' => 0 ), 201 );
}

function mmdrj_register_rest_routes() {
	$common = array( 'permission_callback' => 'mmdrj_private_offer_admin' );
	register_rest_route( 'missionmed/v1', '/examprep/private-offers', array_merge( $common, array( 'methods' => 'POST', 'callback' => 'mmdrj_issue_private_offer' ) ) );
	register_rest_route( 'missionmed/v1', '/examprep/private-offers/revoke', array_merge( $common, array( 'methods' => 'POST', 'callback' => 'mmdrj_revoke_private_offer' ) ) );
	register_rest_route( 'missionmed/v1', '/examprep/catalog/provision', array_merge( $common, array( 'methods' => 'POST', 'callback' => 'mmdrj_provision_addon_product' ) ) );
}
add_action( 'rest_api_init', 'mmdrj_register_rest_routes' );

function mmdrj_private_rest_no_store( $response, $server, $request ) {
	if ( str_starts_with( (string) $request->get_route(), '/missionmed/v1/examprep/' ) && $response instanceof WP_REST_Response ) {
		$response->header( 'Cache-Control', 'no-store, private' );
		$response->header( 'CDN-Cache-Control', 'no-store' );
		$response->header( 'Surrogate-Control', 'no-store' );
		$response->header( 'Vary', 'Authorization, Cookie' );
	}
	return $response;
}
add_filter( 'rest_post_dispatch', 'mmdrj_private_rest_no_store', 20, 3 );

function mmdrj_missionaccounts_commerce_authority( $authority, $user ) {
	$user_id = $user instanceof WP_User ? absint( $user->ID ) : 0;
	if ( ! $user_id ) {
		return array( 'live_group_eligible' => false, 'existing_plan' => null, 'monthly_checkout_url' => null );
	}
	$course_access = function_exists( 'sfwd_lms_has_access' ) && sfwd_lms_has_access( MMDRJ_TEAM_COURSE_ID, $user_id );
	$active_monthly = mmdrj_user_has_active_live_group( $user_id );
	return array(
		'live_group_eligible' => (bool) ( $course_access || $active_monthly || in_array( 'guarantee_live_group_free', mmdrj_user_eligibilities( $user_id ), true ) ),
		'existing_plan' => $active_monthly ? 'monthly' : null,
		'monthly_checkout_url' => esc_url_raw( add_query_arg( 'add-to-cart', MMDRJ_TEAM_PRODUCT_ID, home_url( '/checkout/' ) ) ),
	);
}
add_filter( 'missionmed_missionaccounts_commerce_authority', 'mmdrj_missionaccounts_commerce_authority', 10, 2 );

function mmdrj_public_pricing_panel( $content ) {
	if ( ! is_page( 5687 ) || ! in_the_loop() || ! is_main_query() ) {
		return $content;
	}
	$addon_id = absint( get_option( MMDRJ_ADDON_PRODUCT_OPTION, 0 ) );
	$cards = array(
		array( '1-on-1 tutoring', '$85 per hour', 3652 ),
		array( 'Study planning', '$50 per 30 minutes', 9015 ),
		array( 'Ten-session tutoring pack', '$800', 9016 ),
		array( 'Live Group Drilling', '$300/month prepaid or $25 per attended billable day', 3651 ),
		array( 'Daily Drills add-on', '$19.99/month with an active Live Group plan', $addon_id ),
		array( 'Daily Drills', '$99.99/month', 6360 ),
		array( 'Daily Drills with audio + notes', '$149.99/month', 9017 ),
	);
	$html = '<section class="mmdrj-5404e-pricing" aria-labelledby="mmdrj-pricing-title"><h2 id="mmdrj-pricing-title">Choose the support that fits your prep.</h2><p>Your first five qualifying Live Group class days actually attended are a one-time trial. Missed classes do not count, and multiple sessions on one calendar day count once. After day five, you choose monthly prepaid or pay-go; the trial never charges or converts you automatically.</p><div class="mmdrj-pricing-grid">';
	foreach ( $cards as $card ) {
		$url = $card[2] ? get_permalink( $card[2] ) : home_url( '/missionaccounts/' );
		$html .= '<article><h3>' . esc_html( $card[0] ) . '</h3><p><strong>' . esc_html( $card[1] ) . '</strong></p><a href="' . esc_url( $url ) . '">Explore</a></article>';
	}
	$html .= '</div><details><summary>How does the Live Group trial work?</summary><p>Only qualifying class days you attend count. A missed scheduled class does not use a day. After the fifth attended day, sign in to MyMissionMed Account and explicitly choose your plan.</p></details></section>';
	return $content . $html;
}
add_filter( 'the_content', 'mmdrj_public_pricing_panel', 40 );

function mmdrj_public_styles() {
	if ( ! is_page( 5687 ) ) {
		return;
	}
	echo '<style id="mmdrj-5404e-pricing-css">.mmdrj-5404e-pricing{max-width:1180px;margin:56px auto;padding:40px 24px;color:#132434}.mmdrj-pricing-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:24px 0}.mmdrj-pricing-grid article{padding:22px;border:1px solid #d9d1c1;border-radius:16px;background:#fff}.mmdrj-pricing-grid a{display:inline-block;margin-top:8px;color:#8b4c16;font-weight:700}@media(max-width:760px){.mmdrj-pricing-grid{grid-template-columns:1fr}.mmdrj-5404e-pricing{padding:28px 18px}}</style>';
}
add_action( 'wp_head', 'mmdrj_public_styles', 40 );

function mmdrj_cart_contains_examprep_product() {
	if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
		return false;
	}
	foreach ( WC()->cart->get_cart() as $item ) {
		if ( in_array( absint( $item['product_id'] ?? 0 ), mmdrj_product_ids(), true ) ) {
			return true;
		}
	}
	return false;
}

function mmdrj_direct_examprep_checkout_url( $checkout_url ) {
	return mmdrj_cart_contains_examprep_product() ? home_url( '/checkout/' ) : $checkout_url;
}
add_filter( 'woocommerce_get_checkout_url', 'mmdrj_direct_examprep_checkout_url', 999 );


/** Dedicated Stripe routing and existing header-cart behavior retained from the verified live bridge. */
function mmdrj_environment_value( $key ) {
	$key = (string) $key;
	if ( isset( $_ENV[ $key ] ) ) {
		return trim( (string) $_ENV[ $key ] );
	}
	if ( isset( $_SERVER[ $key ] ) ) {
		return trim( (string) $_SERVER[ $key ] );
	}
	if ( defined( $key ) ) {
		return trim( (string) constant( $key ) );
	}
	$value = getenv( $key );
	return false === $value ? '' : trim( (string) $value );
}

/**
 * Return the first configured value from a list of environment keys.
 */
function mmdrj_first_environment_value( $keys ) {
	foreach ( (array) $keys as $key ) {
		$value = mmdrj_environment_value( $key );
		if ( '' !== $value ) {
			return $value;
		}
	}
	return '';
}

/**
 * Fail closed unless the dedicated live ExamPrep Stripe route is fully ready.
 */
function mmdrj_dr_j_division_router_ready() {
	$enabled = strtolower( mmdrj_environment_value( 'MM_WC_STRIPE_ROUTER_ENABLED' ) );
	if ( ! in_array( $enabled, array( '1', 'true', 'yes', 'on' ), true ) || ! class_exists( 'MissionMed_WC_Stripe_Division_Router' ) ) {
		return false;
	}

	$secret_key = mmdrj_first_environment_value(
		array( 'MM_WC_STRIPE_DR_J_SECRET_KEY', 'MMHQ_STRIPE_EXAMPREP_SECRET_KEY', 'MMHQ_STRIPE_DR_J_SECRET_KEY', 'STRIPE_EXAMPREP_SECRET_KEY' )
	);
	$publishable_key = mmdrj_first_environment_value(
		array( 'MM_WC_STRIPE_DR_J_PUBLISHABLE_KEY', 'MMHQ_STRIPE_EXAMPREP_PUBLISHABLE_KEY', 'MMHQ_STRIPE_DR_J_PUBLISHABLE_KEY', 'STRIPE_EXAMPREP_PUBLISHABLE_KEY' )
	);
	$webhook_secret = mmdrj_first_environment_value(
		array( 'MM_WC_STRIPE_DR_J_WEBHOOK_SECRET', 'MMHQ_STRIPE_EXAMPREP_WEBHOOK_SECRET', 'MMHQ_STRIPE_DR_J_WEBHOOK_SECRET', 'STRIPE_EXAMPREP_WEBHOOK_SECRET' )
	);

	return 0 === strpos( $secret_key, 'sk_live_' )
		&& 0 === strpos( $publishable_key, 'pk_live_' )
		&& 0 === strpos( $webhook_secret, 'whsec_' );
}

/**
 * True only when every cart line is an explicitly classified Dr J division product.
 */
function mmdrj_cart_is_division_platform_examprep_only() {
	if ( ! function_exists( 'WC' ) || ! WC()->cart || WC()->cart->is_empty() ) {
		return false;
	}

	foreach ( WC()->cart->get_cart() as $item ) {
		$product_id = isset( $item['product_id'] ) ? absint( $item['product_id'] ) : 0;
		if ( ! in_array( $product_id, mmdrj_product_ids(), true ) ) {
			return false;
		}
		if ( MMDRJ_PAYMENT_ARCHITECTURE_DIVISION !== get_post_meta( $product_id, MMDRJ_PAYMENT_ARCHITECTURE_META, true ) ) {
			return false;
		}
	}

	return true;
}

/**
 * Resolve the obsolete Connect-account gate only for proven division-platform carts.
 * All mixed-cart, instructor ownership, category, and unrelated checkout errors remain.
 */
function mmdrj_resolve_legacy_connect_conflict( $data, $errors ) {
	if ( ! is_wp_error( $errors ) || ! mmdrj_cart_is_division_platform_examprep_only() || ! mmdrj_dr_j_division_router_ready() ) {
		return;
	}

	$errors->remove( 'mmi_no_stripe_account' );
	$errors->remove( 'mmi_stripe_not_active' );

	if ( class_exists( 'MMI_Stripe_Connect_Router' ) ) {
		remove_action(
			'woocommerce_checkout_create_order',
			array( 'MMI_Stripe_Connect_Router', 'stamp_order_with_instructor' ),
			10
		);
	}
}
add_action( 'woocommerce_after_checkout_validation', 'mmdrj_resolve_legacy_connect_conflict', 20, 2 );

function mmdrj_is_examprep_commerce_surface() {
	if ( is_admin() ) {
		return false;
	}

	if ( function_exists( 'is_page' ) && is_page( array( 5674, 5687 ) ) ) {
		return true;
	}

	if ( function_exists( 'is_product' ) && is_product() && in_array( get_queried_object_id(), mmdrj_product_ids(), true ) ) {
		return true;
	}

	$path = isset( $_SERVER['REQUEST_URI'] ) ? wp_parse_url( wp_unslash( $_SERVER['REQUEST_URI'] ), PHP_URL_PATH ) : '';
	return is_string( $path ) && 0 === strpos( trailingslashit( $path ), '/examprep/' );
}

/**
 * Put a conventional, always-visible Cart link in the custom ExamPrep header.
 * JavaScript placement keeps the existing shared header markup untouched.
 */
function mmdrj_render_header_cart_control() {
	if ( ! mmdrj_is_examprep_commerce_surface() ) {
		return;
	}
	?>
	<style id="mmdrj-header-cart-css">
		.mm-l5__right .mmdrj-header-cart {
			display: inline-flex;
			align-items: center;
			gap: 7px;
			min-height: 42px;
			padding: 0 18px;
			border: 1px solid #d5dae1;
			border-radius: 999px;
			color: #0b1627;
			background: #fff;
			font-size: 13px;
			font-weight: 700;
			letter-spacing: .13em;
			line-height: 1;
			text-decoration: none;
			white-space: nowrap;
		}
		.mm-l5__right .mmdrj-header-cart:hover,
		.mm-l5__right .mmdrj-header-cart:focus-visible {
			border-color: #b78b2d;
			color: #0b1627;
			box-shadow: 0 0 0 3px rgba(183,139,45,.16);
			outline: 0;
		}
		.mm-l5__right .mmdrj-header-cart svg { width: 17px; height: 17px; }
		@media (max-width: 900px) {
			.mm-l5__right .mmdrj-header-cart { min-height: 38px; padding: 0 13px; font-size: 11px; }
		}
	</style>
	<script id="mmdrj-header-cart-js">
	(function () {
		function mountCartLink() {
			var actions = document.querySelector('.mm-l5__right');
			if (!actions || actions.querySelector('.mmdrj-header-cart')) return;
			var link = document.createElement('a');
			link.className = 'mmdrj-header-cart';
			link.href = <?php echo wp_json_encode( home_url( '/cart/' ) ); ?>;
			link.setAttribute('aria-label', 'View shopping cart');
			link.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20.5 7H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg><span>CART</span>';
			var account = actions.querySelector('a[href*="my-account"]');
			actions.insertBefore(link, account || actions.firstChild);
		}

		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', mountCartLink, {once:true});
		} else {
			mountCartLink();
		}
	})();
	</script>
	<?php
}
add_action( 'wp_footer', 'mmdrj_render_header_cart_control', 90 );
