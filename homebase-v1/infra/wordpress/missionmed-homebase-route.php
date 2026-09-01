<?php
/**
 * MissionMed HomeBase immutable route and API gateway.
 *
 * HomeBase owns only /homebase/. Matrix and StoryForge routes are untouched.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
if ( defined( 'MMHBR_VERSION' ) ) {
	return;
}

define( 'MMHBR_VERSION', '0.2.0' );
define( 'MMHBR_BASE_PATH', '/homebase/' );
define( 'MMHBR_MAX_BODY_BYTES', 1048576 );
define( 'MMHBR_MAX_RESPONSE_BYTES', 4194304 );
define( 'MMHBR_TIMEOUT_SECONDS', 9 );
// BEGIN GENERATED HOMEBASE RELEASE ID.
define( 'MMHBR_RELEASE_ID', 'v-fef4cb19d5aeffa3' );
define( 'MMHBR_RELEASE_PHP_SHA256', 'b171650c2f0136258bb6eb9923ec74eb0617467a388a8e7ec6251b66ccd7186d' );
define( 'MMHBR_RELEASE_PHP_SIZE', 818653 );
// END GENERATED HOMEBASE RELEASE ID.

/** @return array<string,array<string,mixed>> */
function mmhbr_asset_manifest() {
	return array(
		// BEGIN GENERATED HOMEBASE ASSET MANIFEST.
		'assets/app.f0e9ec537a3c.js' => array(
			'alias' => 'f0e9ec537a3c',
			'sha256' => 'f0e9ec537a3ca5d50c652bf2fa5057296fd93f66c6506ddea8bb9a086bab76c3',
			'size' => 89465,
			'type' => 'text/javascript; charset=utf-8',
			'cache' => 'immutable',
		),
		'assets/auth.32b3822b8597.js' => array(
			'alias' => '32b3822b8597',
			'sha256' => '32b3822b85973a002e637bd2e32a015aa3254a588925a16e794847d4936d8271',
			'size' => 8306,
			'type' => 'text/javascript; charset=utf-8',
			'cache' => 'immutable',
		),
		'assets/fonts/archivo-italic.e1989a572737.woff2' => array(
			'alias' => 'e1989a572737',
			'sha256' => 'e1989a5727374fcd299979407c8087669ca223f5281f8645891e5400f3e61aeb',
			'size' => 39132,
			'type' => 'font/woff2',
			'cache' => 'immutable',
		),
		'assets/fonts/archivo-normal.7150c0ec5ad3.woff2' => array(
			'alias' => '7150c0ec5ad3',
			'sha256' => '7150c0ec5ad356453013d11affec1fbab95de0dd2dcecb043b4f1cb7f87c4ba4',
			'size' => 34940,
			'type' => 'font/woff2',
			'cache' => 'immutable',
		),
		'assets/fonts/lora-italic.3d536d49566e.woff2' => array(
			'alias' => '3d536d49566e',
			'sha256' => '3d536d49566e82a7905c8b0096758005f6616029ac08528d1f4789c1100dff6a',
			'size' => 40648,
			'type' => 'font/woff2',
			'cache' => 'immutable',
		),
		'assets/fonts/lora-normal.6b102ab35aa1.woff2' => array(
			'alias' => '6b102ab35aa1',
			'sha256' => '6b102ab35aa1f2b315788bb4853434ed1e52137603bf7a3da71a682276748d45',
			'size' => 37792,
			'type' => 'font/woff2',
			'cache' => 'immutable',
		),
		'assets/fonts/OFL-Archivo.txt' => array(
			'alias' => '1778201b7bd3',
			'sha256' => '1778201b7bd33e8c08a2eda32a4ad2f69bc38ced9731b01cc3fc47f268c8ef3c',
			'size' => 4387,
			'type' => 'text/plain; charset=utf-8',
			'cache' => 'revalidate',
		),
		'assets/fonts/OFL-Lora.txt' => array(
			'alias' => '6d6bc7bbb828',
			'sha256' => '6d6bc7bbb828514925dabcaf89e4771398d12c60dd1cb2bbb90eea129535d0f4',
			'size' => 4422,
			'type' => 'text/plain; charset=utf-8',
			'cache' => 'revalidate',
		),
		'assets/fonts/OFL-Rajdhani.txt' => array(
			'alias' => '793bdd8538a0',
			'sha256' => '793bdd8538a0c03afb5bc10906be27ad1dc76f143cfeac8c55cd9075a5b3a55c',
			'size' => 4372,
			'type' => 'text/plain; charset=utf-8',
			'cache' => 'revalidate',
		),
		'assets/fonts/rajdhani-500.4745b75b6e92.woff2' => array(
			'alias' => '4745b75b6e92',
			'sha256' => '4745b75b6e92d917e2402925dc1a6c1c6300e6e0f607a1ce286da54b33d80d3b',
			'size' => 8964,
			'type' => 'font/woff2',
			'cache' => 'immutable',
		),
		'assets/fonts/rajdhani-600.35f7e628ec8e.woff2' => array(
			'alias' => '35f7e628ec8e',
			'sha256' => '35f7e628ec8e7dd3bf434e95ce28289803401f12d8605c56ca83db2b4b301d33',
			'size' => 9400,
			'type' => 'font/woff2',
			'cache' => 'immutable',
		),
		'assets/fonts/rajdhani-700.7597c31a957a.woff2' => array(
			'alias' => '7597c31a957a',
			'sha256' => '7597c31a957ae3d2e1ebc786238752d883c15ce2e6b5da617dc3453a9fd86335',
			'size' => 9304,
			'type' => 'font/woff2',
			'cache' => 'immutable',
		),
		'assets/missionmed-logo.f091d62ac584.png' => array(
			'alias' => 'f091d62ac584',
			'sha256' => 'f091d62ac5842cde0e9e455321839fd98b291598478aae6ce13b09ea3896ff56',
			'size' => 65897,
			'type' => 'image/png',
			'cache' => 'immutable',
		),
		'assets/styles.62c71d5e68ae.css' => array(
			'alias' => '62c71d5e68ae',
			'sha256' => '62c71d5e68ae0f11cbd5c4af84dc9405bc297a4a8e708e3c4f3812f3beb87914',
			'size' => 208288,
			'type' => 'text/css; charset=utf-8',
			'cache' => 'immutable',
		),
		'index.html' => array(
			'alias' => 'e7bab2606231',
			'sha256' => 'e7bab26062314847c80013322b9740a085ac3e89bf4e51307f5c4ad29d3963f8',
			'size' => 2255,
			'type' => 'text/html; charset=utf-8',
			'cache' => 'html',
		),
		// END GENERATED HOMEBASE ASSET MANIFEST.
	);
}

function mmhbr_request_method() {
	return isset( $_SERVER['REQUEST_METHOD'] )
		? strtoupper( (string) $_SERVER['REQUEST_METHOD'] )
		: 'GET';
}

function mmhbr_request_path() {
	$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
	$path = wp_parse_url( $request_uri, PHP_URL_PATH );
	if ( ! is_string( $path ) || '' === $path ) {
		return '';
	}
	$home_path = wp_parse_url( home_url( '/' ), PHP_URL_PATH );
	if ( is_string( $home_path ) && ! in_array( $home_path, array( '', '/' ), true ) ) {
		$home_path = rtrim( $home_path, '/' );
		if ( str_starts_with( $path, $home_path . '/' ) ) {
			$path = substr( $path, strlen( $home_path ) );
		}
	}
	if ( str_starts_with( $path, '/index.php/' ) ) {
		$path = substr( $path, strlen( '/index.php' ) );
	}
	return '' !== $path ? $path : '/';
}

function mmhbr_is_target_path( $path ) {
	$canonical = rtrim( MMHBR_BASE_PATH, '/' );
	return $path === $canonical || str_starts_with( $path, MMHBR_BASE_PATH );
}

function mmhbr_is_canonical_host() {
	$home = wp_parse_url( home_url( '/' ) );
	if ( ! is_array( $home ) || empty( $home['host'] ) ) {
		return false;
	}
	$expected = strtolower( (string) $home['host'] );
	if ( ! empty( $home['port'] ) ) {
		$expected .= ':' . absint( $home['port'] );
	}
	$incoming = isset( $_SERVER['HTTP_HOST'] )
		? strtolower( trim( (string) wp_unslash( $_SERVER['HTTP_HOST'] ) ) )
		: '';
	return 1 === preg_match( '/^[a-z0-9.-]+(?::[0-9]{1,5})?$/', $incoming )
		&& hash_equals( $expected, $incoming );
}

function mmhbr_set_cache_guard() {
	foreach ( array( 'DONOTCACHEPAGE', 'DONOTCDN' ) as $constant ) {
		if ( ! defined( $constant ) ) {
			define( $constant, true );
		}
	}
}

function mmhbr_set_no_store_guard() {
	mmhbr_set_cache_guard();
	if ( ! defined( 'DONOTCACHEOBJECT' ) ) {
		define( 'DONOTCACHEOBJECT', true );
	}
}

if ( mmhbr_is_target_path( mmhbr_request_path() ) && mmhbr_is_canonical_host() ) {
	mmhbr_set_cache_guard();
}

function mmhbr_clear_output_buffers() {
	while ( ob_get_level() > 0 ) {
		if ( ! @ob_end_clean() ) {
			break;
		}
	}
}

function mmhbr_send_security_headers( $cache_control, $private = false ) {
	if ( headers_sent() ) {
		return;
	}
	if ( str_contains( strtolower( $cache_control ), 'no-store' ) ) {
		mmhbr_set_no_store_guard();
	}
	foreach ( array( 'Location', 'Set-Cookie', 'Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials', 'Content-Encoding', 'Transfer-Encoding' ) as $name ) {
		header_remove( $name );
	}
	header( 'Cache-Control: ' . $cache_control, true );
	header( 'Surrogate-Control: no-store', true );
	header( 'CDN-Cache-Control: no-store', true );
	header( 'X-Accel-Expires: 0', true );
	if ( $private ) {
		header( 'Pragma: no-cache', true );
		header( 'Vary: Cookie, Authorization', true );
	}
	header( "Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://cdn.missionmedinstitute.com; connect-src 'self'; font-src 'self'; media-src 'self'; object-src 'none'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'", true );
	header( 'Referrer-Policy: no-referrer', true );
	header( 'X-Content-Type-Options: nosniff', true );
	header( 'X-Frame-Options: SAMEORIGIN', true );
	header( 'Permissions-Policy: camera=(), geolocation=(), microphone=()', true );
	header( 'X-Robots-Tag: noindex, nofollow, noarchive', true );
	header( 'X-HomeBase-Route: wordpress-gateway', true );
}

function mmhbr_send_error( $status, $code, $message ) {
	mmhbr_clear_output_buffers();
	status_header( (int) $status );
	mmhbr_send_security_headers( 'no-store, private', true );
	header( 'Content-Type: application/json; charset=utf-8', true );
	$body = wp_json_encode(
		array( 'error' => array( 'code' => sanitize_key( $code ), 'message' => (string) $message ) )
	);
	if ( ! is_string( $body ) ) {
		$body = '{"error":{"code":"route_failed","message":"HomeBase could not complete this request."}}';
	}
	header( 'Content-Length: ' . strlen( $body ), true );
	if ( 'HEAD' !== mmhbr_request_method() ) {
		echo $body;
	}
	exit;
}

function mmhbr_query_suffix() {
	$query = isset( $_SERVER['QUERY_STRING'] ) ? (string) $_SERVER['QUERY_STRING'] : '';
	$query = str_replace( array( "\r", "\n" ), '', $query );
	return '' === $query ? '' : '?' . $query;
}

function mmhbr_validate_request_target( $path ) {
	$query = isset( $_SERVER['QUERY_STRING'] ) ? (string) $_SERVER['QUERY_STRING'] : '';
	if ( strlen( $path ) > 2048 || strlen( $query ) > 4096 ) {
		mmhbr_send_error( 414, 'request_target_too_long', 'The HomeBase request target is too long.' );
	}
	if ( 1 === preg_match( '/[\x00-\x1F\x7F]/', $path ) || 1 !== preg_match( '#^/[A-Za-z0-9/_.-]*$#', $path ) ) {
		mmhbr_send_error( 400, 'invalid_request_path', 'The HomeBase request path is invalid.' );
	}
	foreach ( explode( '/', $path ) as $segment ) {
		if ( in_array( $segment, array( '.', '..' ), true ) ) {
			mmhbr_send_error( 400, 'invalid_request_path', 'The HomeBase request path is invalid.' );
		}
	}
}

function mmhbr_send_redirect( $path ) {
	mmhbr_clear_output_buffers();
	status_header( 308 );
	mmhbr_send_security_headers( 'no-store, max-age=0', false );
	header( 'Location: ' . $path . mmhbr_query_suffix(), true, 308 );
	header( 'Content-Length: 0', true );
	exit;
}

function mmhbr_feature_enabled() {
	if ( ! function_exists( 'mmhb_settings' ) ) {
		return false;
	}
	$settings = mmhb_settings();
	return is_array( $settings ) && ! empty( $settings['homebase_enabled'] );
}

function mmhbr_origin() {
	if ( ! defined( 'MISSIONMED_HOMEBASE_ORIGIN' ) ) {
		return '';
	}
	$value = rtrim( esc_url_raw( (string) MISSIONMED_HOMEBASE_ORIGIN ), '/' );
	$parts = wp_parse_url( $value );
	if ( ! is_array( $parts ) || empty( $parts['scheme'] ) || empty( $parts['host'] ) ) {
		return '';
	}
	$local = 'local' === wp_get_environment_type()
		&& defined( 'MISSIONMED_HOMEBASE_LOCAL_FIXTURES' )
		&& MISSIONMED_HOMEBASE_LOCAL_FIXTURES;
	$local_http = $local && 'http' === strtolower( (string) $parts['scheme'] )
		&& 'host.docker.internal' === strtolower( (string) $parts['host'] )
		&& ! empty( $parts['port'] );
	$railway = 'https' === strtolower( (string) $parts['scheme'] )
		&& str_ends_with( strtolower( (string) $parts['host'] ), '.up.railway.app' )
		&& empty( $parts['port'] );
	if ( ! $local_http && ! $railway ) {
		return '';
	}
	if ( ! empty( $parts['user'] ) || ! empty( $parts['pass'] ) || ! empty( $parts['query'] )
		|| ! empty( $parts['fragment'] ) || ( ! empty( $parts['path'] ) && '/' !== $parts['path'] ) ) {
		return '';
	}
	return $value;
}

function mmhbr_wordpress_origin() {
	$parts = wp_parse_url( home_url( '/' ) );
	if ( ! is_array( $parts ) || empty( $parts['scheme'] ) || empty( $parts['host'] ) ) {
		return '';
	}
	$origin = strtolower( (string) $parts['scheme'] ) . '://' . strtolower( (string) $parts['host'] );
	return ! empty( $parts['port'] ) ? $origin . ':' . absint( $parts['port'] ) : $origin;
}

function mmhbr_safe_relative_path( $encoded ) {
	$decoded = rawurldecode( (string) $encoded );
	if ( str_contains( $decoded, "\0" ) || str_contains( $decoded, '\\' ) || str_starts_with( $decoded, '/' ) ) {
		return '';
	}
	foreach ( explode( '/', $decoded ) as $segment ) {
		if ( in_array( $segment, array( '', '.', '..' ), true ) ) {
			return '';
		}
	}
	return $decoded;
}

function mmhbr_static_manifest_key( $path ) {
	$relative = substr( $path, strlen( MMHBR_BASE_PATH ) );
	if ( '' === $relative ) {
		return 'index.html';
	}
	$safe = mmhbr_safe_relative_path( $relative );
	if ( '' === $safe ) {
		return '';
	}
	$manifest = mmhbr_asset_manifest();
	if ( 1 === preg_match( '#^_asset/([a-f0-9]{12})$#', $safe, $matches ) ) {
		foreach ( $manifest as $key => $entry ) {
			if ( 'index.html' !== $key && isset( $entry['alias'] ) && hash_equals( (string) $entry['alias'], $matches[1] ) ) {
				return $key;
			}
		}
		return '';
	}
	if ( str_starts_with( $safe, '_asset/' ) || str_starts_with( $safe, 'assets/' )
		|| '' !== pathinfo( basename( $safe ), PATHINFO_EXTENSION ) ) {
		return '';
	}
	return 'index.html';
}

/** @return array<string,mixed>|null */
function mmhbr_release_bundle() {
	static $loaded = false;
	static $bundle = null;
	if ( $loaded ) {
		return $bundle;
	}
	$loaded = true;
	if ( 1 !== preg_match( '/^v-[a-f0-9]{16}$/', MMHBR_RELEASE_ID )
		|| 1 !== preg_match( '/^[a-f0-9]{64}$/', MMHBR_RELEASE_PHP_SHA256 ) || MMHBR_RELEASE_PHP_SIZE < 2 ) {
		return null;
	}
	$runtime = __DIR__ . '/missionmed-homebase-runtime';
	$releases = $runtime . '/releases';
	$current = $runtime . '/current';
	if ( is_link( $runtime ) || ! is_dir( $runtime ) || is_link( $releases ) || ! is_dir( $releases ) || ! is_link( $current ) ) {
		return null;
	}
	$target = readlink( $current );
	if ( ! is_string( $target ) || 1 !== preg_match( '#^releases/([a-f0-9]{40})$#', $target, $matches ) ) {
		return null;
	}
	$releases_real = realpath( $releases );
	$selected = realpath( $releases . '/' . $matches[1] );
	$current_real = realpath( $current );
	if ( false === $releases_real || false === $selected || false === $current_real
		|| $selected !== $releases_real . '/' . $matches[1] || $current_real !== $selected ) {
		return null;
	}
	$file = $selected . '/release.php';
	if ( realpath( $file ) !== $file || ! is_file( $file ) || is_link( $file )
		|| filesize( $file ) !== MMHBR_RELEASE_PHP_SIZE
		|| ! hash_equals( MMHBR_RELEASE_PHP_SHA256, (string) hash_file( 'sha256', $file ) ) ) {
		return null;
	}
	$candidate = require $file;
	if ( ! is_array( $candidate ) || ! isset( $candidate['release_id'], $candidate['assets'] )
		|| ! hash_equals( MMHBR_RELEASE_ID, (string) $candidate['release_id'] ) || ! is_array( $candidate['assets'] ) ) {
		return null;
	}
	$bundle = $candidate;
	return $bundle;
}

/** @return array<string,mixed>|null */
function mmhbr_release_asset( $manifest_key ) {
	$manifest = mmhbr_asset_manifest();
	$bundle = mmhbr_release_bundle();
	if ( null === $bundle || ! isset( $manifest[ $manifest_key ] ) ) {
		return null;
	}
	$entry = $manifest[ $manifest_key ];
	$asset = $bundle['assets'][ $entry['alias'] ] ?? null;
	if ( ! is_array( $asset ) ) {
		return null;
	}
	foreach ( array( 'path', 'alias', 'sha256', 'size', 'type', 'cache', 'bytes_base64' ) as $field ) {
		if ( ! array_key_exists( $field, $asset ) ) {
			return null;
		}
	}
	if ( ! hash_equals( $manifest_key, (string) $asset['path'] )
		|| ! hash_equals( (string) $entry['alias'], (string) $asset['alias'] )
		|| ! hash_equals( (string) $entry['sha256'], (string) $asset['sha256'] )
		|| (int) $entry['size'] !== (int) $asset['size']
		|| ! hash_equals( (string) $entry['type'], (string) $asset['type'] )
		|| ! hash_equals( (string) $entry['cache'], (string) $asset['cache'] ) ) {
		return null;
	}
	$bytes = base64_decode( (string) $asset['bytes_base64'], true );
	if ( ! is_string( $bytes ) || strlen( $bytes ) !== (int) $entry['size']
		|| ! hash_equals( (string) $entry['sha256'], hash( 'sha256', $bytes ) ) ) {
		return null;
	}
	return array( 'entry' => $entry, 'bytes' => $bytes );
}

function mmhbr_serve_static( $manifest_key ) {
	if ( ! in_array( mmhbr_request_method(), array( 'GET', 'HEAD' ), true ) ) {
		header( 'Allow: GET, HEAD', true );
		mmhbr_send_error( 405, 'method_not_allowed', 'This method is not allowed for HomeBase assets.' );
	}
	$asset = '' !== $manifest_key ? mmhbr_release_asset( $manifest_key ) : null;
	if ( null === $asset ) {
		mmhbr_send_error( 503, 'release_integrity_failed', 'HomeBase is temporarily unavailable.' );
	}
	$cache = 'immutable' === $asset['entry']['cache']
		? 'public, max-age=31536000, immutable'
		: 'no-store, max-age=0';
	mmhbr_clear_output_buffers();
	status_header( 200 );
	mmhbr_send_security_headers( $cache, false );
	header( 'Content-Type: ' . $asset['entry']['type'], true );
	header( 'Content-Length: ' . strlen( $asset['bytes'] ), true );
	if ( 'HEAD' !== mmhbr_request_method() ) {
		echo $asset['bytes'];
	}
	exit;
}

function mmhbr_incoming_header( $name ) {
	$keys = array(
		'accept' => array( 'HTTP_ACCEPT' ),
		'authorization' => array( 'HTTP_AUTHORIZATION', 'REDIRECT_HTTP_AUTHORIZATION' ),
		'content-type' => array( 'CONTENT_TYPE', 'HTTP_CONTENT_TYPE' ),
		'origin' => array( 'HTTP_ORIGIN' ),
	);
	foreach ( $keys[ $name ] ?? array() as $key ) {
		if ( isset( $_SERVER[ $key ] ) && is_scalar( $_SERVER[ $key ] ) ) {
			$value = trim( str_replace( array( "\r", "\n" ), '', (string) wp_unslash( $_SERVER[ $key ] ) ) );
			return strlen( $value ) <= 8192 ? $value : '';
		}
	}
	return '';
}

function mmhbr_request_body() {
	$length = isset( $_SERVER['CONTENT_LENGTH'] ) ? absint( $_SERVER['CONTENT_LENGTH'] ) : 0;
	if ( $length > MMHBR_MAX_BODY_BYTES ) {
		mmhbr_send_error( 413, 'payload_too_large', 'The HomeBase request body is too large.' );
	}
	$stream = fopen( 'php://input', 'rb' );
	$body = is_resource( $stream ) ? stream_get_contents( $stream, MMHBR_MAX_BODY_BYTES + 1 ) : false;
	if ( is_resource( $stream ) ) {
		fclose( $stream );
	}
	if ( ! is_string( $body ) || strlen( $body ) > MMHBR_MAX_BODY_BYTES ) {
		mmhbr_send_error( 413, 'payload_too_large', 'The HomeBase request body is too large.' );
	}
	return $body;
}

function mmhbr_proxy_request( $path ) {
	$method = mmhbr_request_method();
	$health = MMHBR_BASE_PATH . 'healthz' === $path;
	$public_config = MMHBR_BASE_PATH . 'api/config' === $path && 'GET' === $method;
	$allowed = $health ? array( 'GET' ) : array( 'GET', 'POST', 'PATCH', 'DELETE' );
	if ( ! in_array( $method, $allowed, true ) ) {
		header( 'Allow: ' . implode( ', ', $allowed ), true );
		mmhbr_send_error( 405, 'method_not_allowed', 'This method is not allowed for HomeBase.' );
	}
	if ( str_starts_with( $path, MMHBR_BASE_PATH . 'api/dev/' ) ) {
		mmhbr_send_error( 404, 'not_found', 'HomeBase resource not found.' );
	}
	if ( ! $health && ! $public_config && ! mmhbr_feature_enabled() ) {
		mmhbr_send_error( 403, 'homebase_disabled', 'HomeBase is not enabled for this pilot.' );
	}
	$origin = mmhbr_origin();
	if ( '' === $origin ) {
		mmhbr_send_error( 503, 'origin_unavailable', 'HomeBase is temporarily unavailable.' );
	}
	$headers = array();
	foreach ( array( 'accept', 'authorization', 'content-type', 'origin' ) as $name ) {
		$value = mmhbr_incoming_header( $name );
		if ( '' !== $value ) {
			$headers[ $name ] = $value;
		}
	}
	if ( ! $health && ! $public_config
		&& 1 !== preg_match( '/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/', $headers['authorization'] ?? '' ) ) {
		mmhbr_send_error( 401, 'auth_required', 'A valid HomeBase session is required.' );
	}
	if ( isset( $headers['origin'] ) && ! hash_equals( mmhbr_wordpress_origin(), strtolower( rtrim( $headers['origin'], '/' ) ) ) ) {
		mmhbr_send_error( 403, 'origin_not_allowed', 'This origin is not allowed to call HomeBase.' );
	}
	$body = '';
	if ( in_array( $method, array( 'POST', 'PATCH', 'DELETE' ), true ) ) {
		if ( 1 !== preg_match( '#^application/json(?:\s*;|$)#i', $headers['content-type'] ?? '' ) ) {
			mmhbr_send_error( 415, 'unsupported_content_type', 'HomeBase accepts JSON requests only.' );
		}
		$body = mmhbr_request_body();
	}
	$target_path = substr( $path, strlen( rtrim( MMHBR_BASE_PATH, '/' ) ) );
	$response = wp_safe_remote_request(
		$origin . $target_path . mmhbr_query_suffix(),
		array(
			'method' => $method,
			'headers' => $headers,
			'body' => $body,
			'timeout' => MMHBR_TIMEOUT_SECONDS,
			'redirection' => 0,
			'blocking' => true,
			'sslverify' => true,
			'reject_unsafe_urls' => true,
			'limit_response_size' => MMHBR_MAX_RESPONSE_BYTES + 1,
		)
	);
	if ( is_wp_error( $response ) ) {
		mmhbr_send_error( 502, 'origin_request_failed', 'HomeBase is temporarily unavailable.' );
	}
	$status = (int) wp_remote_retrieve_response_code( $response );
	$response_body = (string) wp_remote_retrieve_body( $response );
	$content_type = (string) wp_remote_retrieve_header( $response, 'content-type' );
	if ( $status < 100 || $status > 599 || ( $status >= 300 && $status < 400 )
		|| strlen( $response_body ) > MMHBR_MAX_RESPONSE_BYTES
		|| ( 204 !== $status && '' !== $response_body && ! str_starts_with( strtolower( $content_type ), 'application/json' ) ) ) {
		mmhbr_send_error( 502, 'origin_response_rejected', 'HomeBase is temporarily unavailable.' );
	}
	if ( '' !== $response_body ) {
		json_decode( $response_body, true );
		if ( JSON_ERROR_NONE !== json_last_error() ) {
			mmhbr_send_error( 502, 'origin_response_rejected', 'HomeBase is temporarily unavailable.' );
		}
	}
	if ( $health ) {
		$decoded = json_decode( $response_body, true );
		if ( 200 !== $status || ! is_array( $decoded ) || true !== ( $decoded['ok'] ?? false )
			|| 'homebase-v1' !== ( $decoded['service'] ?? '' ) ) {
			mmhbr_send_error( 503, 'health_unavailable', 'HomeBase is temporarily unavailable.' );
		}
		$response_body = '{"ok":true,"service":"homebase-v1"}';
		$content_type = 'application/json; charset=utf-8';
	}
	mmhbr_clear_output_buffers();
	status_header( $status );
	mmhbr_send_security_headers( 'no-store, private', true );
	header( 'Content-Type: ' . ( '' !== $content_type ? str_replace( array( "\r", "\n" ), '', $content_type ) : 'application/json; charset=utf-8' ), true );
	header( 'Content-Length: ' . strlen( $response_body ), true );
	if ( 204 !== $status && 'HEAD' !== $method ) {
		echo $response_body;
	}
	exit;
}

function mmhbr_dispatch() {
	if ( ! empty( $GLOBALS['mmhbr_dispatched'] ) ) {
		return;
	}
	$path = mmhbr_request_path();
	if ( ! mmhbr_is_target_path( $path ) || ! mmhbr_is_canonical_host() ) {
		return;
	}
	$GLOBALS['mmhbr_dispatched'] = true;
	mmhbr_set_cache_guard();
	mmhbr_validate_request_target( $path );
	$normalized = preg_replace( '#/+#', '/', $path );
	if ( is_string( $normalized ) && $normalized !== $path ) {
		mmhbr_send_redirect( $normalized );
	}
	if ( rtrim( MMHBR_BASE_PATH, '/' ) === $path ) {
		mmhbr_send_redirect( MMHBR_BASE_PATH );
	}
	$api = MMHBR_BASE_PATH . 'api';
	if ( MMHBR_BASE_PATH . 'healthz' === $path || $api === $path || str_starts_with( $path, $api . '/' ) ) {
		mmhbr_proxy_request( $path );
	}
	mmhbr_serve_static( mmhbr_static_manifest_key( $path ) );
}

add_action( 'parse_request', 'mmhbr_dispatch', 0 );
add_action( 'template_redirect', 'mmhbr_dispatch', 0 );
