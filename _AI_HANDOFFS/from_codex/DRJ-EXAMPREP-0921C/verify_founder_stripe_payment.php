<?php
defined( 'ABSPATH' ) || exit;

$order_id = 9148;
$order    = wc_get_order( $order_id );
if ( ! $order instanceof WC_Order || ! $order->is_paid() ) {
	throw new RuntimeException( 'Paid Founder order is unavailable.' );
}

if ( class_exists( 'MissionMed_WC_Stripe_Division_Router' ) ) {
	MissionMed_WC_Stripe_Division_Router::prime_processed_order( $order_id, array(), $order );
}

$intent_id = (string) $order->get_meta( '_stripe_intent_id', true );
if ( '' === $intent_id ) {
	$intent_id = (string) $order->get_meta( '_stripe_source_id', true );
}
if ( 0 !== strpos( $intent_id, 'pi_' ) ) {
	throw new RuntimeException( 'Order is missing a PaymentIntent reference.' );
}

$intent = WC_Stripe_API::request( array(), 'payment_intents/' . rawurlencode( $intent_id ), 'GET' );
if ( ! empty( $intent->error ) ) {
	throw new RuntimeException( 'Stripe PaymentIntent retrieval failed.' );
}

$charge = null;
if ( ! empty( $intent->latest_charge ) && is_string( $intent->latest_charge ) ) {
	$charge = WC_Stripe_API::request( array(), 'charges/' . rawurlencode( $intent->latest_charge ), 'GET' );
}

$event_match = null;
$events      = WC_Stripe_API::request(
	array(
		'type'         => 'payment_intent.succeeded',
		'created[gte]' => max( 0, (int) ( $intent->created ?? time() ) - 300 ),
		'created[lte]' => (int) ( $intent->created ?? time() ) + 300,
		'limit'        => 25,
	),
	'events',
	'GET'
);
if ( isset( $events->data ) && is_array( $events->data ) ) {
	foreach ( $events->data as $event ) {
		if ( isset( $event->data->object->id ) && $intent_id === $event->data->object->id ) {
			$event_match = $event;
			break;
		}
	}
}

$webhook_endpoints = array();
$endpoint_response = WC_Stripe_API::request( array( 'limit' => 100 ), 'webhook_endpoints', 'GET' );
if ( isset( $endpoint_response->data ) && is_array( $endpoint_response->data ) ) {
	foreach ( $endpoint_response->data as $endpoint ) {
		$url = isset( $endpoint->url ) ? wp_parse_url( (string) $endpoint->url ) : array();
		$webhook_endpoints[] = array(
			'status'          => (string) ( $endpoint->status ?? '' ),
			'host'            => (string) ( $url['host'] ?? '' ),
			'path'            => (string) ( $url['path'] ?? '' ),
			'query_present'   => ! empty( $url['query'] ),
			'payment_enabled' => in_array( 'payment_intent.succeeded', (array) ( $endpoint->enabled_events ?? array() ), true ) || in_array( '*', (array) ( $endpoint->enabled_events ?? array() ), true ),
		);
	}
}

$notes = wc_get_order_notes( array( 'order_id' => $order_id, 'limit' => 100 ) );
$safe_notes = array();
foreach ( $notes as $note ) {
	$text = wp_strip_all_tags( (string) $note->content );
	$text = preg_replace( '/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i', '[EMAIL]', $text );
	$text = preg_replace( '/\b(?:pm|pi|ch|cus|src|seti|sub|req)_[A-Za-z0-9_]+\b/', '[STRIPE_ID]', $text );
	$safe_notes[] = array(
		'date_utc' => $note->date_created ? $note->date_created->setTimezone( new DateTimeZone( 'UTC' ) )->format( 'c' ) : null,
		'text'     => mb_substr( $text, 0, 240 ),
	);
}

$metadata = isset( $intent->metadata ) && is_object( $intent->metadata ) ? $intent->metadata : (object) array();
$result = array(
	'order_id'                => $order_id,
	'order_paid'              => $order->is_paid(),
	'order_total_cents'       => (int) round( (float) $order->get_total() * 100 ),
	'intent_found'            => ! empty( $intent->id ),
	'intent_status'           => (string) ( $intent->status ?? '' ),
	'intent_livemode'         => (bool) ( $intent->livemode ?? false ),
	'intent_amount_cents'     => (int) ( $intent->amount ?? 0 ),
	'intent_received_cents'   => (int) ( $intent->amount_received ?? 0 ),
	'intent_currency'         => (string) ( $intent->currency ?? '' ),
	'intent_customer_present' => ! empty( $intent->customer ),
	'intent_charge_present'   => ! empty( $intent->latest_charge ),
	'metadata_order_match'    => (string) $order_id === (string) ( $metadata->order_id ?? '' ),
	'metadata_owner'          => (string) ( $metadata->missionmed_stripe_owner ?? '' ),
	'metadata_division'       => (string) ( $metadata->missionmed_division ?? '' ),
	'charge_paid'             => is_object( $charge ) ? (bool) ( $charge->paid ?? false ) : null,
	'charge_captured'         => is_object( $charge ) ? (bool) ( $charge->captured ?? false ) : null,
	'charge_status'           => is_object( $charge ) ? (string) ( $charge->status ?? '' ) : null,
	'charge_amount_cents'     => is_object( $charge ) ? (int) ( $charge->amount ?? 0 ) : null,
	'charge_outcome_type'     => is_object( $charge ) && isset( $charge->outcome->type ) ? (string) $charge->outcome->type : null,
	'succeeded_event_found'   => is_object( $event_match ),
	'event_livemode'          => is_object( $event_match ) ? (bool) ( $event_match->livemode ?? false ) : null,
	'event_pending_webhooks'  => is_object( $event_match ) ? (int) ( $event_match->pending_webhooks ?? -1 ) : null,
	'webhook_endpoints'       => $webhook_endpoints,
	'order_notes'             => array_reverse( $safe_notes ),
);

echo wp_json_encode( $result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . "\n";
