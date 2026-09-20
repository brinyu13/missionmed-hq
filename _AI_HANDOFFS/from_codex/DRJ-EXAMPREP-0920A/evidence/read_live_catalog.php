<?php
defined( 'ABSPATH' ) || exit;

$ids = array( 3651, 3652, 6360, 9015, 9016, 9017 );
$addon_id = absint( get_option( 'mmdrj_daily_drills_addon_product_id', 0 ) );
if ( $addon_id ) {
	$ids[] = $addon_id;
}

$matching = get_posts(
	array(
		'post_type'   => 'product',
		'post_status' => array( 'publish', 'draft', 'private', 'pending' ),
		'numberposts' => -1,
		'fields'      => 'ids',
		's'           => 'Daily Rounds Arena Pro Daily Drills',
	)
);
$ids = array_values( array_unique( array_merge( $ids, array_map( 'absint', $matching ) ) ) );
sort( $ids );

$products = array();
foreach ( $ids as $id ) {
	$product = wc_get_product( $id );
	if ( ! $product ) {
		continue;
	}
	$children = method_exists( $product, 'get_children' ) ? array_map( 'absint', $product->get_children() ) : array();
	$products[] = array(
		'id'                    => $id,
		'name'                  => $product->get_name(),
		'slug'                  => get_post_field( 'post_name', $id ),
		'status'                => get_post_status( $id ),
		'type'                  => $product->get_type(),
		'price'                 => (string) $product->get_price(),
		'regular_price'         => (string) $product->get_regular_price(),
		'sale_price'            => (string) $product->get_sale_price(),
		'purchasable_anonymous' => (bool) $product->is_purchasable(),
		'period'                => (string) get_post_meta( $id, '_subscription_period', true ),
		'interval'              => (string) get_post_meta( $id, '_subscription_period_interval', true ),
		'sign_up_fee'           => (string) get_post_meta( $id, '_subscription_sign_up_fee', true ),
		'required_eligibility'  => (string) get_post_meta( $id, '_mmed_drj_required_eligibility', true ),
		'payment_architecture'  => (string) get_post_meta( $id, '_mmi_payment_architecture', true ),
		'instructor_id'         => absint( get_post_meta( $id, '_mmi_instructor_id', true ) ),
		'catalog_visibility'    => method_exists( $product, 'get_catalog_visibility' ) ? $product->get_catalog_visibility() : '',
		'children'              => $children,
		'url'                   => get_permalink( $id ),
	);
	foreach ( $children as $child_id ) {
		$child = wc_get_product( $child_id );
		if ( ! $child ) {
			continue;
		}
		$products[] = array(
			'id'                    => $child_id,
			'parent_id'             => $id,
			'name'                  => $child->get_name(),
			'status'                => get_post_status( $child_id ),
			'type'                  => $child->get_type(),
			'price'                 => (string) $child->get_price(),
			'regular_price'         => (string) $child->get_regular_price(),
			'sale_price'            => (string) $child->get_sale_price(),
			'purchasable_anonymous' => (bool) $child->is_purchasable(),
			'period'                => (string) get_post_meta( $child_id, '_subscription_period', true ),
			'interval'              => (string) get_post_meta( $child_id, '_subscription_period_interval', true ),
			'sign_up_fee'           => (string) get_post_meta( $child_id, '_subscription_sign_up_fee', true ),
		);
	}
}

$coupons = array();
foreach ( get_posts( array( 'post_type' => 'shop_coupon', 'post_status' => array( 'publish', 'draft', 'private' ), 'numberposts' => -1 ) ) as $post ) {
	$code = strtoupper( (string) $post->post_title );
	if ( 0 !== strpos( $code, 'DRJ' ) ) {
		continue;
	}
	$coupon = new WC_Coupon( $post->ID );
	$coupons[] = array(
		'id'                       => absint( $post->ID ),
		'code'                     => $code,
		'status'                   => $post->post_status,
		'discount_type'            => $coupon->get_discount_type(),
		'amount'                   => (string) $coupon->get_amount(),
		'product_ids'              => array_map( 'absint', $coupon->get_product_ids() ),
		'individual_use'           => (bool) $coupon->get_individual_use(),
		'usage_count'              => absint( $coupon->get_usage_count() ),
		'usage_limit'              => absint( $coupon->get_usage_limit() ),
		'usage_limit_per_user'     => absint( $coupon->get_usage_limit_per_user() ),
		'email_restrictions_count' => count( $coupon->get_email_restrictions() ),
		'expires'                  => $coupon->get_date_expires() ? $coupon->get_date_expires()->date( DATE_ATOM ) : null,
		'private_bound'            => (bool) get_post_meta( $post->ID, '_mmdrj_private_offer_student_uuid', true ),
		'private_redeemed'         => (bool) get_post_meta( $post->ID, '_mmdrj_private_offer_redeemed_at', true ),
		'private_revoked'          => (bool) get_post_meta( $post->ID, '_mmdrj_private_offer_revoked_at', true ),
	);
}

$output = array(
	'home'         => home_url( '/' ),
	'wc_version'   => defined( 'WC_VERSION' ) ? WC_VERSION : null,
	'wcs_version'  => defined( 'WCS_VERSION' ) ? WCS_VERSION : null,
	'addon_option' => $addon_id,
	'course_map'   => array(
		'daily_rounds_course' => absint( get_option( 'mmed_course_drills_on_call', 0 ) ),
		'product'             => absint( get_option( 'mmed_product_drills_on_call', 0 ) ),
		'aliases'             => (string) get_option( 'mmed_product_drills_on_call_aliases', '' ),
	),
	'products'     => $products,
	'coupons'      => $coupons,
);

echo wp_json_encode( $output, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . "\n";
