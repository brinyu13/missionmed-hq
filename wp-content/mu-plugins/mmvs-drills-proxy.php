<?php
/**
 * Plugin Name: MMVS Drills Proxy
 * Description: Proxies /api/drills to the MMVS Railway backend and returns JSON.
 * Author: MissionMed
 * Version: 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

error_log( 'MMVS PROXY ACTIVE' );

if ( ! function_exists( 'mmvs_drills_proxy_handle_request' ) ) {
	/**
	 * Handle public /api/drills requests before WordPress canonical redirects.
	 */
	function mmvs_drills_proxy_handle_request() {
		$uri = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
		if ( '' === $uri ) {
			return;
		}

		$path = wp_parse_url( $uri, PHP_URL_PATH );
		if ( ! is_string( $path ) ) {
			return;
		}

		if ( '/api/drills' !== rtrim( $path, '/' ) ) {
			return;
		}

		$method = isset( $_SERVER['REQUEST_METHOD'] ) ? strtoupper( sanitize_text_field( wp_unslash( $_SERVER['REQUEST_METHOD'] ) ) ) : 'GET';
		if ( 'GET' !== $method ) {
			status_header( 405 );
			header( 'Content-Type: application/json; charset=utf-8' );
			header( 'Allow: GET' );
			echo wp_json_encode(
				array(
					'error'   => 'method_not_allowed',
					'message' => 'Only GET is supported for /api/drills.',
				)
			);
			exit;
		}

		$upstream_base = 'https://mmvs-backend-production.up.railway.app/api/drills';
		$query_string  = isset( $_SERVER['QUERY_STRING'] ) ? wp_unslash( $_SERVER['QUERY_STRING'] ) : '';
		$upstream_url  = $upstream_base;

		if ( is_string( $query_string ) && '' !== $query_string ) {
			$upstream_url .= '?' . $query_string;
		}

		$response = wp_remote_get(
			$upstream_url,
			array(
				'timeout'     => 15,
				'redirection' => 3,
				'headers'     => array(
					'Accept' => 'application/json',
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			status_header( 502 );
			header( 'Content-Type: application/json; charset=utf-8' );
			echo wp_json_encode(
				array(
					'error'   => 'upstream_unreachable',
					'message' => $response->get_error_message(),
				)
			);
			exit;
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$body = wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		if ( 200 !== $code || JSON_ERROR_NONE !== json_last_error() ) {
			status_header( 502 );
			header( 'Content-Type: application/json; charset=utf-8' );
			echo wp_json_encode(
				array(
					'error'           => 'upstream_invalid_response',
					'upstream_status' => $code,
				)
			);
			exit;
		}

		status_header( 200 );
		header( 'Content-Type: application/json; charset=utf-8' );
		echo $body;
		exit;
	}
}

add_action( 'parse_request', 'mmvs_drills_proxy_handle_request', 0 );
