<?php
defined( 'ABSPATH' ) || exit;

$assert = static function ( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
};

if ( ! function_exists( 'wc_load_cart' ) ) {
	require_once WC_ABSPATH . 'includes/wc-cart-functions.php';
}
wc_load_cart();
WC()->cart->empty_cart( true );
wc_clear_notices();
wp_set_current_user( 0 );

$addon_direct = WC()->cart->add_to_cart( 9109, 1 );
$assert( false === $addon_direct, 'Anonymous forced add-on attempt did not fail closed.' );
WC()->cart->empty_cart( true );
wc_clear_notices();

$live_key = WC()->cart->add_to_cart( 3651, 1, 3668, array( 'attribute_exam-track' => 'Step 1 / Level 1' ) );
$assert( is_string( $live_key ) && '' !== $live_key, 'Live-only cart could not be created.' );
WC()->cart->calculate_totals();
$assert( '0.00' === number_format( (float) WC()->cart->get_total( 'edit' ), 2, '.', '' ), 'Live first-week trial did not resolve to $0 today.' );
$assert( 1 === count( WC()->cart->get_cart() ), 'Live-only cart contains an unexpected line.' );
$live_item = WC()->cart->get_cart()[ $live_key ];
$assert( 3651 === absint( $live_item['product_id'] ) && 3668 === absint( $live_item['variation_id'] ), 'Live-only cart identity mismatch.' );

WC()->cart->empty_cart( true );
wc_clear_notices();
$_REQUEST['mmdrj_add_daily_rounds'] = 'yes';
$live_key = WC()->cart->add_to_cart( 3651, 1, 3668, array( 'attribute_exam-track' => 'Step 1 / Level 1' ) );
unset( $_REQUEST['mmdrj_add_daily_rounds'] );
$assert( is_string( $live_key ) && '' !== $live_key, 'Live + Daily Rounds cart could not be created.' );
WC()->cart->calculate_totals();
$ids = array_values( array_map( static fn( $item ) => absint( $item['product_id'] ), WC()->cart->get_cart() ) );
sort( $ids );
$diagnostic = array(
	'cart_ids' => $ids,
	'notices'  => wc_get_notices(),
);
if ( array( 3651, 9109 ) !== $ids ) {
	echo wp_json_encode( $diagnostic, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . "\n";
}
$assert( array( 3651, 9109 ) === $ids, 'Explicit opt-in did not create exactly the Live and Daily Rounds lines.' );
$assert( '19.99' === number_format( (float) WC()->cart->get_total( 'edit' ), 2, '.', '' ), 'Live + add-on initial total is not the disclosed $19.99.' );
$recurring = WC()->cart->recurring_carts ?? array();
$renewals = array();
foreach ( $recurring as $key => $cart ) {
	$renewals[] = array(
		'key'   => $key,
		'total' => number_format( (float) $cart->get_total( 'edit' ), 2, '.', '' ),
		'items' => array_values( array_map( static fn( $item ) => absint( $item['product_id'] ), $cart->get_cart() ) ),
	);
}
$renewal_totals = array_column( $renewals, 'total' );
$assert( in_array( '300.00', $renewal_totals, true ) && in_array( '19.99', $renewal_totals, true ), 'Recurring carts do not disclose both $300 and $19.99 renewals.' );

WC()->cart->remove_cart_item( $live_key );
mmdrj_remove_orphaned_addon_from_cart();
$assert( 0 === count( WC()->cart->get_cart() ), 'Removing Live left an orphaned reduced-rate add-on in cart.' );
WC()->cart->empty_cart( true );
wc_clear_notices();

echo wp_json_encode(
	array(
		'pass'                  => true,
		'live_only_today_cents' => 0,
		'live_renewal_cents'    => 30000,
		'bundle_today_cents'    => 1999,
		'addon_renewal_cents'   => 1999,
		'renewal_carts'         => $renewals,
		'ineligible_forced_addon_rejected' => true,
		'orphan_cart_cleanup'   => true,
		'orders_created'        => 0,
		'money_moved_cents'     => 0,
	),
	JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
) . "\n";
