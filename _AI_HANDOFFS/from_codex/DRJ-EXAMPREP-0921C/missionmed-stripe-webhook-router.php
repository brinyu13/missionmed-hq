<?php
/**
 * Plugin Name: MissionMed Stripe Multi-Account Webhook Router
 * Description: Validates Command Center Stripe webhooks against the configured division-specific secrets.
 * Version: 2026.09.21
 */

defined( 'ABSPATH' ) || exit;

function mmswr_env( $key ) {
	if ( defined( $key ) ) {
		return trim( (string) constant( $key ) );
	}
	$value = getenv( $key );
	return false === $value ? '' : trim( (string) $value );
}

function mmswr_candidate_secrets() {
	$keys = array(
		'MMAC_CC_STRIPE_WEBHOOK_SECRET',
		'MM_WC_STRIPE_BRIAN_WEBHOOK_SECRET', 'MMHQ_STRIPE_MISSION_RESIDENCY_WEBHOOK_SECRET', 'MMHQ_STRIPE_BRIAN_WEBHOOK_SECRET', 'STRIPE_MISSION_RESIDENCY_WEBHOOK_SECRET',
		'MM_WC_STRIPE_DR_J_WEBHOOK_SECRET', 'MMHQ_STRIPE_EXAMPREP_WEBHOOK_SECRET', 'MMHQ_STRIPE_DR_J_WEBHOOK_SECRET', 'STRIPE_EXAMPREP_WEBHOOK_SECRET',
		'MM_WC_STRIPE_PHIL_WEBHOOK_SECRET', 'MMHQ_STRIPE_USCE_WEBHOOK_SECRET', 'MMHQ_STRIPE_CLINICALS_WEBHOOK_SECRET', 'MMHQ_STRIPE_PHIL_WEBHOOK_SECRET', 'STRIPE_USCE_WEBHOOK_SECRET',
	);
	$secrets = array();
	foreach ( $keys as $key ) {
		$value = mmswr_env( $key );
		if ( '' !== $value ) {
			$secrets[ hash( 'sha256', $value ) ] = $value;
		}
	}
	return array_values( $secrets );
}

function mmswr_matching_secret( $payload, $header ) {
	$timestamp  = 0;
	$signatures = array();
	foreach ( explode( ',', (string) $header ) as $part ) {
		$pair = array_pad( explode( '=', trim( $part ), 2 ), 2, '' );
		if ( 't' === $pair[0] ) {
			$timestamp = (int) $pair[1];
		} elseif ( 'v1' === $pair[0] ) {
			$signatures[] = $pair[1];
		}
	}
	if ( $timestamp <= 0 || empty( $signatures ) || abs( time() - $timestamp ) > 300 ) {
		return '';
	}
	foreach ( mmswr_candidate_secrets() as $secret ) {
		$expected = hash_hmac( 'sha256', $timestamp . '.' . $payload, $secret );
		foreach ( $signatures as $signature ) {
			if ( hash_equals( $expected, (string) $signature ) ) {
				return $secret;
			}
		}
	}
	return '';
}

function mmswr_handle( WP_REST_Request $request ) {
	$payload = (string) $request->get_body();
	$secret  = mmswr_matching_secret( $payload, (string) $request->get_header( 'stripe-signature' ) );
	if ( '' === $secret ) {
		return new WP_REST_Response( array( 'received' => false, 'error' => 'Stripe signature verification failed.' ), 400 );
	}
	if ( ! defined( 'MMAC_CC_STRIPE_WEBHOOK_SECRET' ) ) {
		define( 'MMAC_CC_STRIPE_WEBHOOK_SECRET', $secret );
	}
	if ( ! class_exists( 'MMAC_Command_Center_Integrations' ) ) {
		return new WP_REST_Response( array( 'received' => false, 'error' => 'Command Center integration unavailable.' ), 503 );
	}
	return MMAC_Command_Center_Integrations::handle_stripe_webhook( $request );
}

add_action(
	'rest_api_init',
	function () {
		foreach ( array( 'mmi/v1' => '/stripe/webhook', 'missionmed-command-center/v1' => '/integrations/stripe/webhook' ) as $namespace => $route ) {
			register_rest_route(
				$namespace,
				$route,
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => 'mmswr_handle',
					'permission_callback' => '__return_true',
				),
				true
			);
		}
	},
	99
);
