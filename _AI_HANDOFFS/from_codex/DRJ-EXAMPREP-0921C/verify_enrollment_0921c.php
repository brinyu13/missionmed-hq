<?php
defined( 'ABSPATH' ) || exit;

$assert = static function ( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
};

$commerce_path   = WP_CONTENT_DIR . '/mu-plugins/missionmed-drj-examprep-commerce.php';
$experience_path = WP_CONTENT_DIR . '/mu-plugins/missionmed-examprep-enrollment.php';
$assert( is_file( $commerce_path ) && is_file( $experience_path ), 'Required enrollment sources are not live.' );
$assert( '1' === (string) get_post_meta( 3668, '_subscription_trial_length', true ), 'Live trial length is not one week.' );
$assert( 'week' === get_post_meta( 3668, '_subscription_trial_period', true ), 'Live trial period is not week.' );
$assert( 1 === absint( WC_Subscriptions_Product::get_trial_length( wc_get_product( 3668 ) ) ), 'Woo trial API does not report one week.' );
$assert( 'week' === WC_Subscriptions_Product::get_trial_period( wc_get_product( 3668 ) ), 'Woo trial API period mismatch.' );
$assert( 3674 === absint( wc_get_product( 9015 )->get_image_id() ), 'Study Planning image missing.' );
$assert( 3674 === absint( wc_get_product( 9016 )->get_image_id() ), 'Ten-session image missing.' );
$assert( 9136 === absint( wc_get_product( 9109 )->get_image_id() ), 'Add-on image missing.' );
$assert( '99.99' === number_format( (float) wc_get_product( 6360 )->get_price(), 2, '.', '' ), 'Daily price drifted.' );
$assert( '149.99' === number_format( (float) wc_get_product( 9017 )->get_price(), 2, '.', '' ), 'Arena price drifted.' );
$assert( ! wc_get_product( 9017 )->is_purchasable(), 'Arena Pro became purchasable.' );

$request  = new WP_REST_Request( 'GET', '/missionmed/v1/examprep/live-schedule' );
$response = mmeep_live_schedule();
$data     = $response->get_data();
$assert( ! empty( $data['events'] ), 'Sanitized schedule projection is empty.' );
foreach ( $data['events'] as $event ) {
	$assert( isset( $event['id'], $event['title'], $event['track'], $event['start'], $event['end'] ), 'Schedule event contract incomplete.' );
	$assert( ! isset( $event['meeting_url'], $event['user_id'], $event['meta_json'], $event['description'] ), 'Schedule projection exposed private fields.' );
}

echo wp_json_encode(
	array(
		'pass'                  => true,
		'commerce_sha256'       => hash_file( 'sha256', $commerce_path ),
		'experience_sha256'     => hash_file( 'sha256', $experience_path ),
		'trial'                 => array( 'length' => 1, 'period' => 'week', 'first_charge_days' => 7, 'renewal_cents' => 30000 ),
		'calendar_event_count'  => count( $data['events'] ),
		'calendar_first_event'  => $data['events'][0],
		'product_images'        => array( 6360 => wc_get_product( 6360 )->get_image_id(), 9015 => wc_get_product( 9015 )->get_image_id(), 9016 => wc_get_product( 9016 )->get_image_id(), 9017 => wc_get_product( 9017 )->get_image_id(), 9109 => wc_get_product( 9109 )->get_image_id() ),
		'money_moved_cents'     => 0,
	),
	JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
) . "\n";
