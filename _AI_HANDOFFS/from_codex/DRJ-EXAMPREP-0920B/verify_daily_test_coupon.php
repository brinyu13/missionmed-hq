<?php
defined( 'ABSPATH' ) || exit;

$code       = 'DRJTEST1-DAILY-0920A';
$product_id = 6360;
$coupon_id  = wc_get_coupon_id_by_code( $code );
if ( ! $coupon_id ) {
	throw new RuntimeException( 'Controlled test coupon not found.' );
}

$coupon = new WC_Coupon( $coupon_id );

if ( ! WC()->session ) {
	WC()->session = new WC_Session_Handler();
	WC()->session->init();
}
WC()->customer = new WC_Customer( 0, true );
WC()->cart     = new WC_Cart();
WC()->cart->empty_cart();

$cart_key = WC()->cart->add_to_cart( $product_id, 1 );
$applied  = $cart_key ? WC()->cart->apply_coupon( $code ) : false;
WC()->cart->calculate_totals();

$recurring = array();
foreach ( (array) ( WC()->cart->recurring_carts ?? array() ) as $key => $cart ) {
	$recurring[] = array(
		'key'             => $key,
		'total'           => number_format( (float) $cart->get_total( 'edit' ), 2, '.', '' ),
		'applied_coupons' => $cart->get_applied_coupons(),
	);
}

echo wp_json_encode(
	array(
		'coupon_id'          => $coupon_id,
		'code'               => $code,
		'status'             => get_post_status( $coupon_id ),
		'discount_type'      => $coupon->get_discount_type(),
		'amount'             => number_format( (float) $coupon->get_amount(), 2, '.', '' ),
		'product_ids'        => array_map( 'absint', $coupon->get_product_ids() ),
		'usage_count'        => $coupon->get_usage_count(),
		'usage_limit'        => $coupon->get_usage_limit(),
		'usage_limit_user'   => $coupon->get_usage_limit_per_user(),
		'expires_at'         => $coupon->get_date_expires() ? $coupon->get_date_expires()->date( 'c' ) : null,
		'cart_item_added'    => (bool) $cart_key,
		'coupon_applied'     => (bool) $applied,
		'initial_total'      => number_format( (float) WC()->cart->get_total( 'edit' ), 2, '.', '' ),
		'initial_subtotal'   => number_format( (float) WC()->cart->get_subtotal(), 2, '.', '' ),
		'recurring_carts'    => $recurring,
		'money_moved_cents'  => 0,
	),
	JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
) . "\n";

WC()->cart->empty_cart();
