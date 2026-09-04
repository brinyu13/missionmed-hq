<?php
/**
 * Plugin Name: MissionMed Dr J ExamPrep Commerce Guard
 * Description: Enforces qualified Daily Drills pricing, reconciles Live Group access, and bridges dedicated ExamPrep Stripe routing for DRJ-EXAMPREP-0904B.
 * Version: 1.0.1
 */

defined( 'ABSPATH' ) || exit;

const MMDRJ_ELIGIBILITY_META             = '_mmed_drj_pricing_eligibility';
const MMDRJ_REQUIRED_ELIGIBILITY_META    = '_mmed_drj_required_eligibility';
const MMDRJ_TEAM_COURSE_ID               = 3655;
const MMDRJ_TEAM_PRODUCT_ID              = 3651;
const MMDRJ_TEAM_GRANT_ORDERS_META       = '_mmed_drj_team_grant_order_ids';
const MMDRJ_TEAM_LAST_GRANTED_META       = '_mmed_drj_team_last_granted_at';
const MMDRJ_TEAM_LAST_REVOKED_META       = '_mmed_drj_team_last_revoked_at';
const MMDRJ_GUARANTEE_GRANT_META         = '_mmed_drj_guarantee_live_group_grant';
const MMDRJ_PAYMENT_ARCHITECTURE_META    = '_mmi_payment_architecture';
const MMDRJ_PAYMENT_ARCHITECTURE_DIVISION = 'division_platform';
const MMDRJ_COMMERCE_PRODUCT_IDS         = array( 3651, 3652, 6360, 9015, 9016, 9017 );

/**
 * Return normalized eligibility labels for one user.
 */
function mmdrj_user_eligibilities( $user_id ) {
	$value = get_user_meta( absint( $user_id ), MMDRJ_ELIGIBILITY_META, true );
	if ( is_string( $value ) ) {
		$value = preg_split( '/[\s,]+/', $value );
	}
	$value = is_array( $value ) ? $value : array();
	return array_values( array_unique( array_filter( array_map( 'sanitize_key', $value ) ) ) );
}

/**
 * True when a user has an active Live Group subscription.
 */
function mmdrj_user_has_active_live_group( $user_id ) {
	if ( ! function_exists( 'wcs_get_users_subscriptions' ) ) {
		return false;
	}

	foreach ( (array) wcs_get_users_subscriptions( absint( $user_id ) ) as $subscription ) {
		if ( ! is_object( $subscription ) || ! method_exists( $subscription, 'get_status' ) ) {
			continue;
		}
		if ( ! in_array( $subscription->get_status(), array( 'active', 'pending-cancel' ), true ) ) {
			continue;
		}
		foreach ( $subscription->get_items() as $item ) {
			if ( is_object( $item ) && method_exists( $item, 'get_product_id' ) && MMDRJ_TEAM_PRODUCT_ID === absint( $item->get_product_id() ) ) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Decide whether the current user can buy a restricted price.
 */
function mmdrj_user_meets_product_requirement( $user_id, $product_id ) {
	$required = sanitize_key( (string) get_post_meta( absint( $product_id ), MMDRJ_REQUIRED_ELIGIBILITY_META, true ) );
	if ( '' === $required ) {
		return true;
	}
	if ( $user_id <= 0 ) {
		return false;
	}

	$eligibilities = mmdrj_user_eligibilities( $user_id );
	if ( in_array( $required, $eligibilities, true ) ) {
		return true;
	}

	return 'live_groups_addon' === $required && mmdrj_user_has_active_live_group( $user_id );
}

/**
 * Hide restricted prices from ineligible buyers.
 */
function mmdrj_restrict_product_purchase( $purchasable, $product ) {
	if ( ! $purchasable || ! is_object( $product ) || ! method_exists( $product, 'get_id' ) ) {
		return $purchasable;
	}
	$product_id = absint( $product->get_id() );
	$parent_id  = method_exists( $product, 'get_parent_id' ) ? absint( $product->get_parent_id() ) : 0;
	$guard_id   = $parent_id > 0 ? $parent_id : $product_id;
	return mmdrj_user_meets_product_requirement( get_current_user_id(), $guard_id ) ? $purchasable : false;
}
add_filter( 'woocommerce_is_purchasable', 'mmdrj_restrict_product_purchase', 20, 2 );
add_filter( 'woocommerce_variation_is_purchasable', 'mmdrj_restrict_product_purchase', 20, 2 );

/**
 * Fail closed if a restricted price is injected into the cart.
 */
function mmdrj_validate_restricted_add_to_cart( $passed, $product_id, $quantity = 1, $variation_id = 0 ) {
	if ( ! $passed ) {
		return false;
	}
	$guard_id = absint( $product_id );
	if ( mmdrj_user_meets_product_requirement( get_current_user_id(), $guard_id ) ) {
		return true;
	}
	wc_add_notice( __( 'This ExamPrep price is reserved for verified eligible students. Sign in with the qualifying account or contact support.', 'missionmed' ), 'error' );
	return false;
}
add_filter( 'woocommerce_add_to_cart_validation', 'mmdrj_validate_restricted_add_to_cart', 20, 4 );

/**
 * Fail closed on cohort coupons. Knowing a code never grants eligibility.
 */
function mmdrj_validate_cohort_coupon( $valid, $coupon ) {
	if ( ! $valid || ! is_object( $coupon ) || ! method_exists( $coupon, 'get_code' ) ) {
		return $valid;
	}
	$code = strtoupper( (string) $coupon->get_code() );
	$map  = array(
		'DRJGROUPS'    => 'live_groups_addon',
		'DRJMUL'       => 'mul',
		'DRJUCC'       => 'ucc',
		'DRJGUARANTEE' => 'guarantee_ucc_mul',
	);
	if ( ! isset( $map[ $code ] ) ) {
		return $valid;
	}
	$user_id = get_current_user_id();
	if ( $user_id <= 0 ) {
		return false;
	}
	if ( 'live_groups_addon' === $map[ $code ] && mmdrj_user_has_active_live_group( $user_id ) ) {
		return true;
	}
	return in_array( $map[ $code ], mmdrj_user_eligibilities( $user_id ), true );
}
add_filter( 'woocommerce_coupon_is_valid', 'mmdrj_validate_cohort_coupon', 20, 2 );

/**
 * True when an order or subscription contains Live Group.
 */
function mmdrj_order_contains_live_group( $order ) {
	if ( ! is_object( $order ) || ! method_exists( $order, 'get_items' ) ) {
		return false;
	}
	foreach ( $order->get_items() as $item ) {
		if ( is_object( $item ) && method_exists( $item, 'get_product_id' ) && MMDRJ_TEAM_PRODUCT_ID === absint( $item->get_product_id() ) ) {
			return true;
		}
	}
	return false;
}

/**
 * Grant the Live Group course from a paid order/subscription.
 */
function mmdrj_grant_live_group_from_order( $order_or_id ) {
	if ( ! function_exists( 'wc_get_order' ) || ! function_exists( 'ld_update_course_access' ) ) {
		return;
	}
	$order = is_numeric( $order_or_id ) ? wc_get_order( absint( $order_or_id ) ) : $order_or_id;
	if ( ! $order || ! mmdrj_order_contains_live_group( $order ) ) {
		return;
	}
	$user_id  = absint( $order->get_user_id() );
	$order_id = absint( $order->get_id() );
	if ( $user_id <= 0 || $order_id <= 0 ) {
		return;
	}
	ld_update_course_access( $user_id, MMDRJ_TEAM_COURSE_ID );
	$order_ids   = get_user_meta( $user_id, MMDRJ_TEAM_GRANT_ORDERS_META, true );
	$order_ids   = is_array( $order_ids ) ? array_map( 'absint', $order_ids ) : array();
	$order_ids[] = $order_id;
	update_user_meta( $user_id, MMDRJ_TEAM_GRANT_ORDERS_META, array_values( array_unique( $order_ids ) ) );
	update_user_meta( $user_id, MMDRJ_TEAM_LAST_GRANTED_META, gmdate( 'c' ) );
	delete_user_meta( $user_id, MMDRJ_TEAM_LAST_REVOKED_META );
}

/**
 * Revoke only access that this bridge granted, and only when no paid/free grant remains.
 */
function mmdrj_revoke_live_group_if_inactive( $order_or_id ) {
	if ( ! function_exists( 'wc_get_order' ) || ! function_exists( 'ld_update_course_access' ) ) {
		return;
	}
	$order = is_numeric( $order_or_id ) ? wc_get_order( absint( $order_or_id ) ) : $order_or_id;
	if ( ! $order || ! mmdrj_order_contains_live_group( $order ) ) {
		return;
	}
	$user_id = absint( $order->get_user_id() );
	if ( $user_id <= 0 || ! get_user_meta( $user_id, MMDRJ_TEAM_GRANT_ORDERS_META, true ) ) {
		return;
	}
	if ( mmdrj_user_has_active_live_group( $user_id ) || in_array( 'guarantee_live_group_free', mmdrj_user_eligibilities( $user_id ), true ) ) {
		return;
	}
	ld_update_course_access( $user_id, MMDRJ_TEAM_COURSE_ID, true );
	delete_user_meta( $user_id, MMDRJ_TEAM_GRANT_ORDERS_META );
	update_user_meta( $user_id, MMDRJ_TEAM_LAST_REVOKED_META, gmdate( 'c' ) );
}

add_action( 'woocommerce_order_status_processing', 'mmdrj_grant_live_group_from_order', 20 );
add_action( 'woocommerce_order_status_completed', 'mmdrj_grant_live_group_from_order', 20 );
add_action( 'woocommerce_subscription_status_active', 'mmdrj_grant_live_group_from_order', 20 );
add_action( 'woocommerce_subscription_status_pending-cancel', 'mmdrj_grant_live_group_from_order', 20 );
add_action( 'woocommerce_order_status_cancelled', 'mmdrj_revoke_live_group_if_inactive', 20 );
add_action( 'woocommerce_order_status_failed', 'mmdrj_revoke_live_group_if_inactive', 20 );
add_action( 'woocommerce_order_status_refunded', 'mmdrj_revoke_live_group_if_inactive', 20 );
add_action( 'woocommerce_subscription_status_cancelled', 'mmdrj_revoke_live_group_if_inactive', 20 );
add_action( 'woocommerce_subscription_status_expired', 'mmdrj_revoke_live_group_if_inactive', 20 );
add_action( 'woocommerce_subscription_status_on-hold', 'mmdrj_revoke_live_group_if_inactive', 20 );

/**
 * Reconcile Founder-verified guarantee eligibility to no-cost Live Group access.
 */
function mmdrj_reconcile_guarantee_live_group_access( $user_id ) {
	if ( ! function_exists( 'ld_update_course_access' ) || absint( $user_id ) <= 0 ) {
		return;
	}
	$user_id  = absint( $user_id );
	$eligible = in_array( 'guarantee_live_group_free', mmdrj_user_eligibilities( $user_id ), true );
	$granted  = (bool) get_user_meta( $user_id, MMDRJ_GUARANTEE_GRANT_META, true );
	if ( $eligible && ! $granted ) {
		ld_update_course_access( $user_id, MMDRJ_TEAM_COURSE_ID );
		update_user_meta( $user_id, MMDRJ_GUARANTEE_GRANT_META, gmdate( 'c' ) );
		return;
	}
	if ( ! $eligible && $granted && ! mmdrj_user_has_active_live_group( $user_id ) ) {
		ld_update_course_access( $user_id, MMDRJ_TEAM_COURSE_ID, true );
		delete_user_meta( $user_id, MMDRJ_GUARANTEE_GRANT_META );
	}
}

function mmdrj_reconcile_current_user() {
	if ( is_user_logged_in() ) {
		mmdrj_reconcile_guarantee_live_group_access( get_current_user_id() );
	}
}
add_action( 'init', 'mmdrj_reconcile_current_user', 30 );

function mmdrj_reconcile_eligibility_meta( $meta_id, $user_id, $meta_key ) {
	if ( MMDRJ_ELIGIBILITY_META === $meta_key ) {
		mmdrj_reconcile_guarantee_live_group_access( $user_id );
	}
}
add_action( 'added_user_meta', 'mmdrj_reconcile_eligibility_meta', 20, 3 );
add_action( 'updated_user_meta', 'mmdrj_reconcile_eligibility_meta', 20, 3 );
add_action( 'deleted_user_meta', 'mmdrj_reconcile_eligibility_meta', 20, 3 );

/**
 * True when the active WooCommerce cart contains a Dr J ExamPrep product.
 */
function mmdrj_cart_contains_examprep_product() {
	if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
		return false;
	}

	foreach ( WC()->cart->get_cart() as $item ) {
		$product_id   = isset( $item['product_id'] ) ? absint( $item['product_id'] ) : 0;
		$variation_id = isset( $item['variation_id'] ) ? absint( $item['variation_id'] ) : 0;
		if ( in_array( $product_id, MMDRJ_COMMERCE_PRODUCT_IDS, true ) || in_array( $variation_id, MMDRJ_COMMERCE_PRODUCT_IDS, true ) ) {
			return true;
		}
	}

	return false;
}

/**
 * Keep ExamPrep checkout direct; the shared pre-checkout page is residency-specific.
 */
function mmdrj_direct_examprep_checkout_url( $checkout_url ) {
	if ( mmdrj_cart_contains_examprep_product() ) {
		return home_url( '/checkout/' );
	}
	return $checkout_url;
}
add_filter( 'woocommerce_get_checkout_url', 'mmdrj_direct_examprep_checkout_url', 999 );

/**
 * Read one environment setting using the same sources as the division router.
 */
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
		if ( ! in_array( $product_id, MMDRJ_COMMERCE_PRODUCT_IDS, true ) ) {
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

/**
 * True on the public ExamPrep journey where a persistent cart affordance is needed.
 */
function mmdrj_is_examprep_commerce_surface() {
	if ( is_admin() ) {
		return false;
	}

	if ( function_exists( 'is_page' ) && is_page( array( 5674, 5687 ) ) ) {
		return true;
	}

	if ( function_exists( 'is_product' ) && is_product() && in_array( get_queried_object_id(), MMDRJ_COMMERCE_PRODUCT_IDS, true ) ) {
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
