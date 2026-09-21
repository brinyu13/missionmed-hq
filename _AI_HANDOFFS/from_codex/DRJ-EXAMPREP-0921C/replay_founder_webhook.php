<?php
defined( 'ABSPATH' ) || exit;

function mm0921_first_env( $keys ) {
	foreach ( $keys as $key ) {
		if ( defined( $key ) ) {
			$value = trim( (string) constant( $key ) );
		} else {
			$raw   = getenv( $key );
			$value = false === $raw ? '' : trim( (string) $raw );
		}
		if ( '' !== $value ) {
			return $value;
		}
	}
	return '';
}

$order = wc_get_order( 9148 );
if ( ! $order || ! $order->is_paid() ) {
	throw new RuntimeException( 'Founder order precondition failed.' );
}

$intent_id = (string) $order->get_meta( '_stripe_intent_id', true );
$api_key   = mm0921_first_env( array( 'MM_WC_STRIPE_DR_J_SECRET_KEY', 'MMHQ_STRIPE_EXAMPREP_SECRET_KEY', 'MMHQ_STRIPE_DR_J_SECRET_KEY', 'STRIPE_EXAMPREP_SECRET_KEY' ) );
$secret    = mm0921_first_env( array( 'MM_WC_STRIPE_DR_J_WEBHOOK_SECRET', 'MMHQ_STRIPE_EXAMPREP_WEBHOOK_SECRET', 'MMHQ_STRIPE_DR_J_WEBHOOK_SECRET', 'STRIPE_EXAMPREP_WEBHOOK_SECRET' ) );
if ( '' === $intent_id || '' === $api_key || '' === $secret ) {
	throw new RuntimeException( 'Required Stripe webhook verification configuration is unavailable.' );
}

$events_response = wp_remote_get(
	'https://api.stripe.com/v1/events?type=payment_intent.succeeded&limit=25',
	array(
		'timeout' => 25,
		'headers' => array( 'Authorization' => 'Bearer ' . $api_key ),
	)
);
if ( is_wp_error( $events_response ) || 200 !== wp_remote_retrieve_response_code( $events_response ) ) {
	throw new RuntimeException( 'Stripe event lookup failed.' );
}
$events = json_decode( wp_remote_retrieve_body( $events_response ), true );
$event  = null;
foreach ( (array) ( $events['data'] ?? array() ) as $candidate ) {
	if ( isset( $candidate['data']['object']['id'] ) && $intent_id === $candidate['data']['object']['id'] ) {
		$event = $candidate;
		break;
	}
}
if ( ! is_array( $event ) ) {
	throw new RuntimeException( 'Matching Stripe event was not found.' );
}

$payload   = wp_json_encode( $event, JSON_UNESCAPED_SLASHES );
$timestamp = time();
$signature = hash_hmac( 'sha256', $timestamp . '.' . $payload, $secret );
$response  = wp_remote_post(
	rest_url( 'mmi/v1/stripe/webhook' ),
	array(
		'timeout' => 30,
		'headers' => array(
			'Content-Type'     => 'application/json',
			'Stripe-Signature' => 't=' . $timestamp . ',v1=' . $signature,
		),
		'body' => $payload,
	)
);
if ( is_wp_error( $response ) ) {
	throw new RuntimeException( 'Signed webhook replay failed.' );
}

$body = json_decode( wp_remote_retrieve_body( $response ), true );
echo wp_json_encode(
	array(
		'replay_http_status' => wp_remote_retrieve_response_code( $response ),
		'received'           => ! empty( $body['received'] ),
		'persisted'          => ! empty( $body['persisted'] ),
		'event_type'         => isset( $event['type'] ) ? $event['type'] : '',
		'order_preserved'    => $order->is_paid() && '1.00' === number_format( (float) $order->get_total(), 2, '.', '' ),
		'money_moved_cents'  => 0,
	),
	JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
) . "\n";
