<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit( 1 );
}

$coupon_id   = 9135;
$coupon_code = 'drjtest1-daily-0920a';
$product_id  = 6360;
$course_id   = 6357;

$result = array(
	'checked_at_utc' => gmdate( 'c' ),
	'coupon'         => array(),
	'orders'         => array(),
);

$coupon = new WC_Coupon( $coupon_id );
if ( $coupon->get_id() ) {
	$result['coupon'] = array(
		'id'                    => $coupon->get_id(),
		'code'                  => $coupon->get_code(),
		'post_status'           => get_post_status( $coupon->get_id() ),
		'discount_type'         => $coupon->get_discount_type(),
		'amount'                => $coupon->get_amount(),
		'usage_count'           => $coupon->get_usage_count(),
		'usage_limit'           => $coupon->get_usage_limit(),
		'usage_limit_per_user'  => $coupon->get_usage_limit_per_user(),
		'individual_use'        => $coupon->get_individual_use(),
		'product_ids'           => array_map( 'intval', $coupon->get_product_ids() ),
		'expires_at_utc'        => $coupon->get_date_expires() ? $coupon->get_date_expires()->setTimezone( new DateTimeZone( 'UTC' ) )->format( 'c' ) : null,
	);
}

$orders = wc_get_orders(
	array(
		'limit'        => 250,
		'orderby'      => 'date',
		'order'        => 'DESC',
		'date_created' => '>=' . ( time() - ( 7 * DAY_IN_SECONDS ) ),
		'status'       => array_keys( wc_get_order_statuses() ),
		'return'       => 'objects',
	)
);

foreach ( $orders as $order ) {
	$codes = array_map( 'strtolower', $order->get_coupon_codes() );
	if ( ! in_array( $coupon_code, $codes, true ) ) {
		continue;
	}

	$product_ids = array();
	foreach ( $order->get_items( 'line_item' ) as $item ) {
		$product_ids[] = (int) $item->get_product_id();
		if ( $item->get_variation_id() ) {
			$product_ids[] = (int) $item->get_variation_id();
		}
	}
	$product_ids = array_values( array_unique( array_filter( $product_ids ) ) );

	$notes = wc_get_order_notes(
		array(
			'order_id' => $order->get_id(),
			'limit'    => 100,
			'type'     => 'internal',
		)
	);
	$note_text = strtolower( implode( "\n", wp_list_pluck( $notes, 'content' ) ) );

	$entry = array(
		'order_id'                  => $order->get_id(),
		'status'                    => $order->get_status(),
		'is_paid'                   => $order->is_paid(),
		'total'                     => $order->get_total(),
		'currency'                  => $order->get_currency(),
		'date_created_utc'          => $order->get_date_created() ? $order->get_date_created()->setTimezone( new DateTimeZone( 'UTC' ) )->format( 'c' ) : null,
		'date_paid_utc'             => $order->get_date_paid() ? $order->get_date_paid()->setTimezone( new DateTimeZone( 'UTC' ) )->format( 'c' ) : null,
		'user_id'                   => $order->get_user_id(),
		'payment_method'            => $order->get_payment_method(),
		'transaction_id_present'    => '' !== (string) $order->get_transaction_id(),
		'coupon_codes'              => $codes,
		'product_ids'               => $product_ids,
		'order_notes_count'         => count( $notes ),
		'payment_note_present'      => ( false !== strpos( $note_text, 'payment' ) || false !== strpos( $note_text, 'paid' ) ),
		'webhook_note_present'      => false !== strpos( $note_text, 'webhook' ),
		'stripe_note_present'       => false !== strpos( $note_text, 'stripe' ),
		'payment_intent_present'    => (bool) ( $order->get_meta( '_stripe_intent_id', true ) || $order->get_meta( '_stripe_source_id', true ) ),
		'subscriptions'             => array(),
	);

	if ( function_exists( 'wcs_get_subscriptions_for_order' ) ) {
		$subscriptions = wcs_get_subscriptions_for_order( $order->get_id(), array( 'order_type' => 'parent' ) );
		foreach ( $subscriptions as $subscription ) {
			$subscription_products = array();
			foreach ( $subscription->get_items( 'line_item' ) as $item ) {
				$subscription_products[] = (int) $item->get_product_id();
				if ( $item->get_variation_id() ) {
					$subscription_products[] = (int) $item->get_variation_id();
				}
			}
			$subscription_products = array_values( array_unique( array_filter( $subscription_products ) ) );

			$sub_user_id = (int) $subscription->get_user_id();
			$entry['subscriptions'][] = array(
				'subscription_id'          => $subscription->get_id(),
				'status'                   => $subscription->get_status(),
				'total'                    => $subscription->get_total(),
				'currency'                 => $subscription->get_currency(),
				'billing_period'           => $subscription->get_billing_period(),
				'billing_interval'         => $subscription->get_billing_interval(),
				'parent_id'                => $subscription->get_parent_id(),
				'user_id'                  => $sub_user_id,
				'product_ids'              => $subscription_products,
				'next_payment_utc'         => $subscription->get_date( 'next_payment', 'gmt' ) ?: null,
				'end_utc'                  => $subscription->get_date( 'end', 'gmt' ) ?: null,
				'payment_method'           => $subscription->get_payment_method(),
				'course_access'            => $sub_user_id && function_exists( 'sfwd_lms_has_access' ) ? (bool) sfwd_lms_has_access( $course_id, $sub_user_id ) : null,
				'drills_capability'        => $sub_user_id ? user_can( $sub_user_id, 'missionmed_access_drj_drills' ) : null,
				'includes_target_product'  => in_array( $product_id, $subscription_products, true ),
			);
		}
	}

	$result['orders'][] = $entry;
}

echo wp_json_encode( $result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . PHP_EOL;
