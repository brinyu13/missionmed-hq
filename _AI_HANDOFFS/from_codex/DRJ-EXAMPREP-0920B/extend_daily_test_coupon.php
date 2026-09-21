<?php

defined( 'ABSPATH' ) || exit;

$coupon_id   = 9135;
$coupon_code = 'DRJTEST1-DAILY-0920A';
$product_id  = 6360;
$coupon      = new WC_Coupon( $coupon_id );

$contract_is_safe = $coupon->get_id() === $coupon_id
	&& strtolower( $coupon->get_code() ) === strtolower( $coupon_code )
	&& 'initial_cart' === $coupon->get_discount_type()
	&& '98.99' === number_format( (float) $coupon->get_amount(), 2, '.', '' )
	&& array( $product_id ) === array_map( 'absint', $coupon->get_product_ids() )
	&& 1 === $coupon->get_usage_limit()
	&& 1 === $coupon->get_usage_limit_per_user()
	&& 0 === $coupon->get_usage_count()
	&& $coupon->get_individual_use();

if ( ! $contract_is_safe ) {
	throw new RuntimeException( 'Coupon contract no longer matches the controlled one-use test.' );
}

$backup_root = dirname( rtrim( ABSPATH, '/' ) ) . '/private/codex-backups/DRJ-EXAMPREP-0920B';
if ( ! is_dir( $backup_root ) && ! wp_mkdir_p( $backup_root ) ) {
	throw new RuntimeException( 'Could not create the private rollback directory.' );
}
@chmod( $backup_root, 0700 );

$preimage_file = $backup_root . '/coupon-extension-preimage-' . gmdate( 'Ymd-His' ) . '.json';
$preimage      = array(
	'captured_at_utc'       => gmdate( 'c' ),
	'coupon_id'             => $coupon->get_id(),
	'coupon_code'           => $coupon->get_code(),
	'post_status'           => get_post_status( $coupon->get_id() ),
	'usage_count'           => $coupon->get_usage_count(),
	'usage_limit'           => $coupon->get_usage_limit(),
	'usage_limit_per_user'  => $coupon->get_usage_limit_per_user(),
	'individual_use'        => $coupon->get_individual_use(),
	'discount_type'         => $coupon->get_discount_type(),
	'amount'                => $coupon->get_amount(),
	'product_ids'           => array_map( 'absint', $coupon->get_product_ids() ),
	'expires_at_utc'        => $coupon->get_date_expires() ? $coupon->get_date_expires()->setTimezone( new DateTimeZone( 'UTC' ) )->format( 'c' ) : null,
);
if ( false === file_put_contents( $preimage_file, wp_json_encode( $preimage, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ), LOCK_EX ) ) {
	throw new RuntimeException( 'Could not write the coupon extension preimage.' );
}
@chmod( $preimage_file, 0600 );

$expires_at = time() + ( 2 * HOUR_IN_SECONDS );
$coupon->set_date_expires( $expires_at );
$coupon->save();
update_post_meta( $coupon_id, '_mmdrj_test_extended_at', gmdate( 'c' ) );

clean_post_cache( $coupon_id );
$verified = new WC_Coupon( $coupon_id );

echo wp_json_encode(
	array(
		'updated'                => true,
		'coupon_id'              => $verified->get_id(),
		'code'                   => $verified->get_code(),
		'usage_count'            => $verified->get_usage_count(),
		'usage_limit'            => $verified->get_usage_limit(),
		'initial_cents'          => 100,
		'renewal_cents'          => 9999,
		'expires_at_utc'         => $verified->get_date_expires() ? $verified->get_date_expires()->setTimezone( new DateTimeZone( 'UTC' ) )->format( 'c' ) : null,
		'preimage_file'          => $preimage_file,
		'money_moved_cents'      => 0,
	),
	JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
) . PHP_EOL;
