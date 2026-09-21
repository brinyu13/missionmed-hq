<?php
defined( 'ABSPATH' ) || exit;

function mm0921_assert( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
}

function mm0921_rendered_text( $model ) {
	ob_start();
	mmps_render( $model );
	$html = (string) ob_get_clean();
	return array( 'html' => $html, 'text' => strtolower( wp_strip_all_tags( $html ) ) );
}

$fixtures = array(
	'examprep' => array( 'order' => 9148, 'family' => 'examprep', 'support' => 'drj@missionmedinstitute.com' ),
	'residency' => array( 'order' => 8987, 'family' => 'mission_residency', 'support' => 'info@missionmedinstitute.com' ),
	'usce' => array( 'order' => 6514, 'family' => 'usce', 'support' => 'clinicals@missionmedinstitute.com' ),
	'legacy_examprep' => array( 'order' => 6332, 'family' => 'examprep', 'support' => 'drj@missionmedinstitute.com' ),
);

$results = array();
foreach ( $fixtures as $name => $fixture ) {
	$order = wc_get_order( $fixture['order'] );
	mm0921_assert( $order instanceof WC_Order, 'Fixture order missing: ' . $name );
	$model    = mmps_model_for_order( $order );
	$rendered = mm0921_rendered_text( $model );
	mm0921_assert( $fixture['family'] === $model['family'], 'Family mismatch: ' . $name );
	mm0921_assert( false !== strpos( $rendered['text'], strtolower( $fixture['support'] ) ), 'Support mismatch: ' . $name );
	if ( 'usce' !== $fixture['family'] ) {
		mm0921_assert( false === strpos( $rendered['text'], 'complete hospital paperwork' ), 'Clinical copy leaked: ' . $name );
		mm0921_assert( false === strpos( $rendered['text'], 'clinicals@missionmedinstitute.com' ), 'Clinical support leaked: ' . $name );
	}
	$results[ $name ] = array(
		'family'  => $model['family'],
		'payment' => $model['order_status'],
		'access'  => $model['access'],
		'primary' => $model['config']['primary']['label'],
		'support' => $model['config']['support'],
	);
}

$generic  = mmps_family_config( 'generic', array(), array( 'subscription_status' => '', 'active' => false ) );
$generic_text = strtolower( wp_json_encode( $generic ) );
mm0921_assert( false === strpos( $generic_text, 'hospital' ) && false === strpos( $generic_text, 'clinicals@' ), 'Generic fallback leaked clinical context.' );

$mixed = new WC_Order();
foreach ( array( 6360, 3784 ) as $product_id ) {
	$item = new WC_Order_Item_Product();
	$item->set_product_id( $product_id );
	$item->set_name( 'Contract fixture' );
	$item->set_quantity( 1 );
	$mixed->add_item( $item );
}
mm0921_assert( 'generic' === mmps_classify_order( $mixed ), 'Mixed-family order did not fail safely.' );

global $wpdb;
$legacy_active = (int) $wpdb->get_var( "SELECT active FROM {$wpdb->prefix}snippets WHERE id = 88" );
mm0921_assert( 0 === $legacy_active, 'Legacy global confirmation snippet is still active.' );

$source_hashes = array(
	'purchase_success' => hash_file( 'sha256', WP_CONTENT_DIR . '/mu-plugins/missionmed-purchase-success.php' ),
	'webhook_router'   => hash_file( 'sha256', WP_CONTENT_DIR . '/mu-plugins/missionmed-stripe-webhook-router.php' ),
);

echo wp_json_encode(
	array(
		'passed'                => true,
		'fixtures'              => $results,
		'generic_fallback'      => 'neutral',
		'mixed_fallback'        => 'neutral',
		'legacy_snippet_active' => $legacy_active,
		'source_hashes'         => $source_hashes,
		'money_moved_cents'     => 0,
	),
	JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
) . "\n";
