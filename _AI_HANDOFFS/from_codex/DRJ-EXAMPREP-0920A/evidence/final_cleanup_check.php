<?php
defined( 'ABSPATH' ) || exit;

global $wpdb;

$temporary_users = (int) $wpdb->get_var(
	"SELECT COUNT(*) FROM {$wpdb->users} WHERE user_login LIKE 'drj0920a-%'"
);

$temporary_coupons = (int) $wpdb->get_var(
	$wpdb->prepare(
		"SELECT COUNT(DISTINCT p.ID)
		 FROM {$wpdb->posts} p
		 INNER JOIN {$wpdb->postmeta} pm ON pm.post_id = p.ID
		 WHERE p.post_type = 'shop_coupon'
		   AND pm.meta_key = %s
		   AND pm.meta_value LIKE %s",
		'_mmdrj_private_offer_reason',
		'%0920A controlled%'
	)
);

$subscriptions = array();
foreach ( array( 3651, 6360, 9017, 9109 ) as $product_id ) {
	$subscriptions[ $product_id ] = function_exists( 'wcs_get_subscriptions_for_product' )
		? count( wcs_get_subscriptions_for_product( $product_id, array( 'subscriptions_per_page' => -1 ) ) )
		: null;
}

echo wp_json_encode(
	array(
		'temporary_users'   => $temporary_users,
		'temporary_coupons' => $temporary_coupons,
		'subscriptions'     => $subscriptions,
	),
	JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
) . "\n";
