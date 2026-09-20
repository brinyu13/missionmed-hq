<?php
defined( 'ABSPATH' ) || exit;

$code       = 'DRJTEST1-DAILY-0920A';
$product_id = 6360;
$product    = wc_get_product( $product_id );

if (
	! $product
	|| 'subscription' !== $product->get_type()
	|| '99.99' !== number_format( (float) $product->get_price(), 2, '.', '' )
	|| 'month' !== get_post_meta( $product_id, '_subscription_period', true )
	|| '1' !== (string) get_post_meta( $product_id, '_subscription_period_interval', true )
) {
	throw new RuntimeException( 'Daily Rounds subscription preflight failed.' );
}

$existing_id = wc_get_coupon_id_by_code( $code );
if ( $existing_id ) {
	$existing = new WC_Coupon( $existing_id );
	$matches  = 'initial_cart' === $existing->get_discount_type()
		&& '98.99' === number_format( (float) $existing->get_amount(), 2, '.', '' )
		&& array( $product_id ) === array_map( 'absint', $existing->get_product_ids() )
		&& 1 === $existing->get_usage_limit()
		&& 0 === $existing->get_usage_count();
	if ( ! $matches ) {
		throw new RuntimeException( 'Coupon code already exists with a different or consumed contract.' );
	}
	echo wp_json_encode(
		array(
			'created'          => false,
			'coupon_id'        => $existing_id,
			'code'             => $code,
			'initial_cents'    => 100,
			'renewal_cents'    => 9999,
			'usage_count'      => $existing->get_usage_count(),
			'usage_limit'      => $existing->get_usage_limit(),
			'money_moved_cents'=> 0,
		),
		JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
	) . "\n";
	return;
}

$backup_root = dirname( rtrim( ABSPATH, '/' ) ) . '/private/codex-backups/DRJ-EXAMPREP-0920B';
if ( ! is_dir( $backup_root ) && ! wp_mkdir_p( $backup_root ) ) {
	throw new RuntimeException( 'Could not create the private rollback directory.' );
}
@chmod( $backup_root, 0700 );
$preimage_file = $backup_root . '/coupon-preimage-' . gmdate( 'Ymd-His' ) . '.json';
$preimage      = array(
	'created_at'         => gmdate( 'c' ),
	'coupon_code'        => $code,
	'existing_coupon_id' => 0,
	'product_id'         => $product_id,
	'product_price'      => '99.99',
	'cadence'            => 'month',
);
if ( false === file_put_contents( $preimage_file, wp_json_encode( $preimage, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ), LOCK_EX ) ) {
	throw new RuntimeException( 'Could not write the coupon preimage.' );
}
@chmod( $preimage_file, 0600 );

$coupon = new WC_Coupon();
$coupon->set_code( $code );
$coupon->set_description( 'Controlled Founder $1 initial-payment test for Daily Rounds; normal $99.99 monthly renewal remains.' );
$coupon->set_discount_type( 'initial_cart' );
$coupon->set_amount( '98.99' );
$coupon->set_individual_use( true );
$coupon->set_product_ids( array( $product_id ) );
$coupon->set_usage_limit( 1 );
$coupon->set_usage_limit_per_user( 1 );
$coupon->set_exclude_sale_items( true );
$coupon->set_date_expires( time() + 2 * HOUR_IN_SECONDS );
$coupon_id = $coupon->save();

if ( ! $coupon_id ) {
	throw new RuntimeException( 'Coupon creation failed.' );
}

update_post_meta( $coupon_id, '_mmdrj_controlled_test', 'DRJ-EXAMPREP-0920B' );
update_post_meta( $coupon_id, '_mmdrj_expected_initial_cents', 100 );
update_post_meta( $coupon_id, '_mmdrj_expected_renewal_cents', 9999 );
update_post_meta( $coupon_id, '_mmdrj_cancel_after_payment', 'yes' );
update_post_meta( $coupon_id, '_mmdrj_test_created_at', gmdate( 'c' ) );

echo wp_json_encode(
	array(
		'created'           => true,
		'coupon_id'         => $coupon_id,
		'code'              => $code,
		'discount_type'     => 'initial_cart',
		'discount_cents'    => 9899,
		'initial_cents'     => 100,
		'renewal_cents'     => 9999,
		'product_ids'       => array( $product_id ),
		'usage_limit'       => 1,
		'usage_limit_user'  => 1,
		'expires_at'        => gmdate( 'c', time() + 2 * HOUR_IN_SECONDS ),
		'preimage_file'     => $preimage_file,
		'money_moved_cents' => 0,
	),
	JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
) . "\n";
