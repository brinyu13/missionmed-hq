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

	$args = array(
		'method'      => $method,
		'headers'     => $filtered_headers,
		'body'        => $body,
		'timeout'     => 20,
		'redirection' => 3,
		'blocking'    => true,
	);

	$response = wp_remote_request($target_url, $args);

	if (is_wp_error($response)) {
		if (!headers_sent()) {
			status_header(502);
			header('Content-Type: application/json; charset=utf-8');
			header('X-MissionMed-Route: auth-proxy');
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
		header('Content-Length: ' . strlen($response_body));
	}

	echo $response_body;
	exit;
}
add_action('parse_request', 'missionmed_hq_proxy_api_auth_requests', 0);
add_action('template_redirect', 'missionmed_hq_proxy_api_auth_requests', 0);
