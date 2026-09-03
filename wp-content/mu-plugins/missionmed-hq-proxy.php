<?php
/**
 * Plugin Name: MissionMed HQ Auth Proxy
 * Description: Proxies /api/auth/* requests to the Railway backend.
 * Author: MissionMed
 * Version: 1.0.0
 */

if (!defined('ABSPATH')) {
	exit;
}

if (defined('WP_DEBUG') && WP_DEBUG) {
	error_log('MM PROXY LOADED');
}

/**
 * Build an incoming request header map.
 *
 * @return array<string, string>
 */
function missionmed_hq_proxy_get_incoming_headers() {
	$headers = array();

	if (function_exists('getallheaders')) {
		$raw_headers = getallheaders();
		if (is_array($raw_headers)) {
			foreach ($raw_headers as $name => $value) {
				if (!is_string($name) || !is_scalar($value)) {
					continue;
				}
				$headers[$name] = (string) $value;
			}
		}
	}

	if (empty($headers)) {
		foreach ($_SERVER as $key => $value) {
			if (!is_string($key) || 0 !== strpos($key, 'HTTP_') || !is_scalar($value)) {
				continue;
			}
			$name = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($key, 5)))));
			$headers[$name] = (string) $value;
		}
	}

	return $headers;
}

/**
 * Forward auth requests to Railway with narrow transport retries.
 *
 * Retries only on transport-layer WP errors or transient 5xx upstream statuses.
 *
 * @param string                $target_url Railway target URL.
 * @param array<string, mixed>  $args       wp_remote_request args.
 * @return array{response:array|WP_Error,attempts:int}
 */
function missionmed_hq_proxy_forward_with_retry( $target_url, $args ) {
	$attempt     = 0;
	$max_attempt = 3;
	$response    = null;

	while ( $attempt < $max_attempt ) {
		$attempt++;
		$response = wp_remote_request( $target_url, $args );

		if ( is_wp_error( $response ) ) {
			if ( $attempt < $max_attempt ) {
				usleep( 175000 * $attempt );
				continue;
			}
			break;
		}

		$status_code = (int) wp_remote_retrieve_response_code( $response );
		if ( $status_code >= 500 && $status_code <= 504 && $attempt < $max_attempt ) {
			usleep( 175000 * $attempt );
			continue;
		}
		break;
	}

	return array(
		'response' => $response,
		'attempts' => $attempt,
	);
}

/**
 * Build the same signed WordPress handoff token used by the locked admin-post flow.
 *
 * @return string
 */
function missionmed_hq_proxy_build_handoff_token() {
	if ( ! is_user_logged_in() ) {
		return '';
	}
	if ( ! function_exists( 'mmhq_handoff_secret' ) || ! function_exists( 'mmhq_handoff_build_token_payload' ) ) {
		return '';
	}

	$secret = mmhq_handoff_secret();
	if ( '' === $secret ) {
		return '';
	}

	$wp_user = wp_get_current_user();
	if ( ! $wp_user || empty( $wp_user->ID ) ) {
		return '';
	}

	$payload      = mmhq_handoff_build_token_payload( $wp_user );
	$payload_json = wp_json_encode( $payload );
	if ( ! is_string( $payload_json ) || '' === $payload_json ) {
		return '';
	}

	$body      = rtrim( strtr( base64_encode( $payload_json ), '+/', '-_' ), '=' );
	$signature = hash_hmac( 'sha256', $body, $secret );

	return $body . '.' . $signature;
}

/**
 * Attach a signed WordPress handoff token to same-origin Arena exchange calls.
 *
 * @param string $path Request path.
 * @param string $method HTTP method.
 * @param string $body JSON request body.
 * @return array{body:string,injected:bool}
 */
function missionmed_hq_proxy_maybe_attach_handoff_token( $path, $method, $body ) {
	if ( '/api/auth/exchange' !== $path || 'POST' !== $method ) {
		return array(
			'body'     => $body,
			'injected' => false,
		);
	}

	$payload = array();
	if ( '' !== trim( $body ) ) {
		$decoded = json_decode( $body, true );
		if ( is_array( $decoded ) ) {
			$payload = $decoded;
		}
	}

	foreach ( array( 'token', 'wpToken', 'bearerToken' ) as $token_key ) {
		if ( isset( $payload[ $token_key ] ) && '' !== trim( (string) $payload[ $token_key ] ) ) {
			return array(
				'body'     => $body,
				'injected' => false,
			);
		}
	}

	$token = missionmed_hq_proxy_build_handoff_token();
	if ( '' === $token ) {
		return array(
			'body'     => $body,
			'injected' => false,
		);
	}

	$payload['token'] = $token;

	return array(
		'body'     => (string) wp_json_encode( $payload ),
		'injected' => true,
	);
}

/**
 * Proxy only /api/auth/* requests to Railway.
 *
 * @return void
 */
function missionmed_hq_proxy_api_auth_requests() {
	if (defined('REST_REQUEST') && REST_REQUEST) {
		return;
	}

	if (is_admin()) {
		return;
	}

	$request_uri = isset($_SERVER['REQUEST_URI']) ? (string) wp_unslash($_SERVER['REQUEST_URI']) : '';
	if ($request_uri === '') {
		return;
	}

	$path = parse_url($request_uri, PHP_URL_PATH);
	if (!is_string($path) || 0 !== strpos($path, '/api/auth/')) {
		return;
	}

	$query_string = isset($_SERVER['QUERY_STRING']) ? (string) $_SERVER['QUERY_STRING'] : '';
	$target_url   = 'https://missionmed-hq-production.up.railway.app' . $path . ($query_string !== '' ? '?' . $query_string : '');

	if (!headers_sent()) {
		header('X-MissionMed-Route: auth-proxy');
	}

	$method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper((string) $_SERVER['REQUEST_METHOD']) : 'GET';
	$body   = file_get_contents('php://input');
	if (!is_string($body)) {
		$body = '';
	}

	$handoff_body = missionmed_hq_proxy_maybe_attach_handoff_token( $path, $method, $body );
	$body = $handoff_body['body'];
	$handoff_injected = ! empty( $handoff_body['injected'] );

	$headers         = missionmed_hq_proxy_get_incoming_headers();
	$filtered_headers = array();
	$blocked_headers = array(
		'host',
		'content-length',
		'connection',
		'transfer-encoding',
	);

	foreach ($headers as $name => $value) {
		$normalized = strtolower(trim((string) $name));
		if ($normalized === '' || in_array($normalized, $blocked_headers, true)) {
			continue;
		}
		$filtered_headers[$name] = $value;
	}

	if (isset($_SERVER['HTTP_COOKIE'])) {
		$filtered_headers['Cookie'] = $_SERVER['HTTP_COOKIE'];
	}
	if ($handoff_injected) {
		$filtered_headers['Content-Type'] = 'application/json';
	}

	$args = array(
		'method'      => $method,
		'headers'     => $filtered_headers,
		'body'        => $body,
		'timeout'     => 30,
		'redirection' => 3,
		'blocking'    => true,
	);

	$forward = missionmed_hq_proxy_forward_with_retry( $target_url, $args );
	$response = $forward['response'];
	$attempts = isset( $forward['attempts'] ) ? (int) $forward['attempts'] : 1;

	if (is_wp_error($response)) {
		if (!headers_sent()) {
			status_header(502);
			header('Content-Type: application/json; charset=utf-8');
			header('X-MissionMed-Route: auth-proxy');
			header('X-MissionMed-Auth-Proxy-Attempts: ' . max( 1, $attempts ));
			if ($handoff_injected) {
				header('X-MissionMed-Auth-Proxy-Identity: wp-handoff-token');
			}
		}
		echo wp_json_encode(
			array(
				'error'   => 'upstream_unreachable',
				'message' => 'Authentication service unavailable.',
			)
		);
		exit;
	}

	$status_code   = (int) wp_remote_retrieve_response_code($response);
	$response_body = wp_remote_retrieve_body($response);
	if (!is_string($response_body)) {
		$response_body = '';
	}

	if ($status_code < 100 || $status_code > 599) {
		$status_code = 502;
	}

	$hop_by_hop_headers = array(
		'connection',
		'keep-alive',
		'proxy-authenticate',
		'proxy-authorization',
		'te',
		'trailers',
		'transfer-encoding',
		'upgrade',
		'content-length',
	);

	if (!headers_sent()) {
		$response_headers = wp_remote_retrieve_headers($response);
		if (is_array($response_headers) || $response_headers instanceof Traversable) {
			foreach ($response_headers as $name => $value) {
				$header_name = trim((string) $name);
				if ($header_name === '' || in_array(strtolower($header_name), $hop_by_hop_headers, true)) {
					continue;
				}

				$values = is_array($value) ? $value : array($value);
				foreach ($values as $single_value) {
					if (!is_scalar($single_value)) {
						continue;
					}
					$header_value = str_replace(array("\r", "\n"), '', (string) $single_value);
					header($header_name . ': ' . $header_value, false);
				}
			}
		}

		status_header($status_code);
		header('X-MissionMed-Auth-Proxy-Attempts: ' . max( 1, $attempts ));
		if ($handoff_injected) {
			header('X-MissionMed-Auth-Proxy-Identity: wp-handoff-token');
		}
		header('Content-Length: ' . strlen($response_body));
	}

	echo $response_body;
	exit;
}
add_action('parse_request', 'missionmed_hq_proxy_api_auth_requests', 0);
add_action('template_redirect', 'missionmed_hq_proxy_api_auth_requests', 0);
