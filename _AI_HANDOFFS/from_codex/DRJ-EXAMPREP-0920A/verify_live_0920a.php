<?php
defined( 'ABSPATH' ) || exit;

$products = array();
foreach ( array( 3651, 3652, 6360, 9015, 9016, 9017, 9109 ) as $id ) {
	$product = wc_get_product( $id );
	$products[ $id ] = $product ? array(
		'name' => $product->get_name(),
		'type' => $product->get_type(),
		'price' => (string) $product->get_price(),
		'period' => (string) get_post_meta( $id, '_subscription_period', true ),
		'interval' => (string) get_post_meta( $id, '_subscription_period_interval', true ),
		'purchasable_anonymous' => (bool) $product->is_purchasable(),
		'visibility' => $product->get_catalog_visibility(),
		'instructor_id' => absint( get_post_meta( $id, '_mmi_instructor_id', true ) ),
		'required_eligibility' => (string) get_post_meta( $id, '_mmed_drj_required_eligibility', true ),
	) : null;
}
$coupons = array();
foreach ( array( 9023, 9024, 9025, 9026, 9027 ) as $id ) {
	$post = get_post( $id );
	$coupons[ $id ] = $post ? array( 'code' => $post->post_title, 'status' => $post->post_status, 'usage_count' => absint( get_post_meta( $id, 'usage_count', true ) ) ) : null;
}
$pages = array();
foreach ( array( 5674, 5687, 5973 ) as $id ) {
	$content = (string) get_post_field( 'post_content', $id );
	$pages[ $id ] = array(
		'sha256' => hash( 'sha256', $content ),
		'daily_rounds_name' => false !== strpos( $content, 'Drills: Daily Rounds Access' ),
		'arena_pro_name' => false !== strpos( $content, 'ExamPrep: Arena Pro' ),
		'locked' => false !== strpos( $content, 'aria-disabled="true"' ),
	);
}
$output = array(
	'plugin_version' => defined( 'MMDRJ_VERSION' ) ? MMDRJ_VERSION : null,
	'products' => $products,
	'coupons' => $coupons,
	'pages' => $pages,
	'addon_option' => absint( get_option( 'mmdrj_daily_drills_addon_product_id', 0 ) ),
	'daily_products' => function_exists( 'mmdrj_daily_rounds_product_ids' ) ? mmdrj_daily_rounds_product_ids() : array(),
	'legacy_bridge_products' => function_exists( 'mmdoc_drills_oncall_product_ids' ) ? mmdoc_drills_oncall_product_ids() : array(),
	'access_config' => function_exists( 'mm_drj_drills_access_config' ) ? array(
		'capability' => mm_drj_drills_access_config()['capability'],
		'protected_daily_routes' => mm_drj_drills_access_config()['protected_daily_routes'],
		'locked_modes' => mm_drj_drills_access_config()['locked_modes'],
		'full_access_capabilities' => mm_drj_drills_access_config()['full_access_capabilities'],
	) : null,
);
echo wp_json_encode( $output, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . "\n";
