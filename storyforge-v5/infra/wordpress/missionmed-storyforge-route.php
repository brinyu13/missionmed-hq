<?php
/**
 * Plugin Name: MissionMed StoryForge V5 Route
 * Description: Isolated same-origin static and API gateway for StoryForge V5.
 * Version: 0.1.0
 * Requires PHP: 8.1
 * Author: MissionMed
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( defined( 'MMSFR_VERSION' ) ) {
	return;
}

if ( defined( 'MISSIONMED_STORYFORGE_ROUTE_ENABLED' ) && ! MISSIONMED_STORYFORGE_ROUTE_ENABLED ) {
	return;
}

define( 'MMSFR_VERSION', '0.1.0' );
define( 'MMSFR_BASE_PATH', '/storyforge/' );
define( 'MMSFR_MAX_BODY_BYTES', 6291456 );
define( 'MMSFR_MAX_RESPONSE_BYTES', 33554432 );
define( 'MMSFR_TIMEOUT_SECONDS', 9 );
// BEGIN GENERATED STORYFORGE RELEASE ID.
define( 'MMSFR_RELEASE_ID', 'v-10688bb24bca7965' );
define( 'MMSFR_RELEASE_PHP_SHA256', '1d89394ab98284f5e99376000663e55db6bacef9d94e8697ef062784222b3c10' );
define( 'MMSFR_RELEASE_PHP_SIZE', 1146741 );
// END GENERATED STORYFORGE RELEASE ID.

/**
 * Return the release manifest generated from storyforge-v5/dist.
 *
 * @return array<string,array{alias:string,sha256:string,size:int,type:string,cache:string}>
 */
function mmsfr_asset_manifest() {
	return array(
		// BEGIN GENERATED STORYFORGE ASSET MANIFEST.
		'assets/app.cbe2999f0c70.js' => array(
			'alias' => 'cbe2999f0c70',
			'sha256' => 'cbe2999f0c70cd31617d4c1ee2f1f35ed71c1d166723509eb4c060fbfb6c46a5',
			'size' => 404238,
			'type' => 'text/javascript; charset=utf-8',
			'cache' => 'immutable',
		),
		'assets/auth.d2cfc4e447d2.js' => array(
			'alias' => 'd2cfc4e447d2',
			'sha256' => 'd2cfc4e447d23c2e6c164978221417a333764b33fd1dfea7cb1ae415b99118e6',
			'size' => 7236,
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
		'assets/styles.5e18315007aa.css' => array(
			'alias' => '5e18315007aa',
			'sha256' => '5e18315007aafd2e16a1f5749842320c13386546bb677011789785979202c597',
			'size' => 124076,
			'type' => 'text/css; charset=utf-8',
			'cache' => 'immutable',
		),
		'index.html' => array(
			'alias' => 'e720fca216d4',
			'sha256' => 'e720fca216d488e966230cfd5d98da400e83e6fd38a1bb40699539d8cc18f8b2',
			'size' => 1669,
			'type' => 'text/html; charset=utf-8',
			'cache' => 'html',
		),
		// END GENERATED STORYFORGE ASSET MANIFEST.
	);
}

/**
 * Resolve the request path without trusting a caller-supplied host.
 *
 * @return string
 */
function mmsfr_request_path() {
	$request_uri = isset( $_SERVER['REQUEST_URI'] )
		? (string) wp_unslash( $_SERVER['REQUEST_URI'] )
		: '';
	if ( '' === $request_uri ) {
		return '';
	}

	$path = wp_parse_url( $request_uri, PHP_URL_PATH );
	if ( ! is_string( $path ) || '' === $path ) {
		return '';
	}

	$home_path = wp_parse_url( home_url( '/' ), PHP_URL_PATH );
	if ( is_string( $home_path ) && '' !== $home_path && '/' !== $home_path ) {
		$home_path = rtrim( $home_path, '/' );
		if ( str_starts_with( $path, $home_path . '/' ) ) {
			$path = substr( $path, strlen( $home_path ) );
		} elseif ( $path === $home_path ) {
			$path = '/';
		}
	}

	if ( str_starts_with( $path, '/index.php/' ) ) {
		$path = substr( $path, strlen( '/index.php' ) );
	} elseif ( '/index.php' === $path ) {
		$path = '/';
	}

	return '' !== $path ? $path : '/';
}

/**
 * Check whether the exact StoryForge route owns this request.
 *
 * @param string $path Request path.
 * @return bool
 */
function mmsfr_is_target_path( $path ) {
	$canonical = rtrim( MMSFR_BASE_PATH, '/' );
	return $path === $canonical || str_starts_with( $path, MMSFR_BASE_PATH );
}

/**
 * Ensure the route is served only on the canonical WordPress authority.
 *
 * @return bool
 */
function mmsfr_is_canonical_host() {
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
	if ( '' === $incoming || 1 !== preg_match( '/^[a-z0-9.-]+(?::[0-9]{1,5})?$/', $incoming ) ) {
		return false;
	}
	return hash_equals( $expected, $incoming );
}

/**
 * Mark StoryForge responses as ineligible for WordPress/Kinsta page caching.
 */
function mmsfr_set_cache_guard() {
	if ( ! defined( 'DONOTCACHEPAGE' ) ) {
		define( 'DONOTCACHEPAGE', true );
	}
	if ( ! defined( 'DONOTCDN' ) ) {
		define( 'DONOTCDN', true );
	}
}

/**
 * Mark a response as ineligible for every provider cache layer.
 *
 * Kinsta's edge cache can evaluate a response independently of WordPress page
 * caching, so dynamic StoryForge responses require both runtime constants and
 * explicit surrogate/CDN response policy. Fingerprinted assets do not call
 * this guard and retain their manifest-approved cache class.
 */
function mmsfr_set_no_store_guard() {
	mmsfr_set_cache_guard();
	if ( ! defined( 'DONOTCACHEOBJECT' ) ) {
		define( 'DONOTCACHEOBJECT', true );
	}
}

if ( mmsfr_is_target_path( mmsfr_request_path() ) && mmsfr_is_canonical_host() ) {
	mmsfr_set_cache_guard();
}

/**
 * Remove buffered WordPress/theme output before emitting a gateway response.
 */
function mmsfr_clear_output_buffers() {
	while ( ob_get_level() > 0 ) {
		if ( ! @ob_end_clean() ) {
			break;
		}
	}
}

/**
 * Resolve the exact private-audio origin for CSP. The endpoint is not a
 * credential; deployments define MISSIONMED_STORYFORGE_R2_ENDPOINT only after
 * the RP-6 bucket authority is verified.
 *
 * @return string Exact http(s) origin, or an empty string when unavailable.
 */
function mmsfr_audio_origin() {
	if ( ! defined( 'MISSIONMED_STORYFORGE_R2_ENDPOINT' ) ) {
		return '';
	}
	$parts = wp_parse_url( (string) constant( 'MISSIONMED_STORYFORGE_R2_ENDPOINT' ) );
	if (
		! is_array( $parts )
		|| empty( $parts['scheme'] )
		|| empty( $parts['host'] )
		|| ! in_array( strtolower( $parts['scheme'] ), array( 'http', 'https' ), true )
		|| isset( $parts['user'] )
		|| isset( $parts['pass'] )
	) {
		return '';
	}
	$origin = strtolower( $parts['scheme'] ) . '://' . strtolower( $parts['host'] );
	if ( isset( $parts['port'] ) ) {
		$origin .= ':' . (int) $parts['port'];
	}
	return preg_match( '#^https?://[a-z0-9.-]+(?::[0-9]{1,5})?$#', $origin ) ? $origin : '';
}

/**
 * Apply the shared StoryForge security and cache headers.
 *
 * @param string $cache_control Cache-Control value.
 * @param bool   $private       Whether to add Pragma: no-cache.
 */
function mmsfr_send_security_headers( $cache_control, $private = false ) {
	if ( headers_sent() ) {
		return;
	}

	$no_store = str_contains( strtolower( $cache_control ), 'no-store' );
	if ( $no_store ) {
		mmsfr_set_no_store_guard();
	}

	header_remove( 'Location' );
	header_remove( 'Set-Cookie' );
	header_remove( 'Access-Control-Allow-Origin' );
	header_remove( 'Access-Control-Allow-Credentials' );
	header_remove( 'Content-Encoding' );
	header_remove( 'Transfer-Encoding' );
	header( 'Cache-Control: ' . $cache_control, true );
	header( 'Surrogate-Control: no-store', true );
	header( 'CDN-Cache-Control: no-store', true );
	header( 'Cloudflare-CDN-Cache-Control: no-store', true );
	header( 'X-Accel-Expires: 0', true );
	if ( $no_store ) {
		header( 'Vary: Cookie, Authorization', true );
	}
	if ( $private ) {
		header( 'Pragma: no-cache', true );
	} else {
		header_remove( 'Pragma' );
	}
	$audio_origin = mmsfr_audio_origin();
	$audio_source = '' !== $audio_origin ? ' ' . $audio_origin : '';
	header(
		"Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:" . $audio_source . "; media-src 'self' blob:" . $audio_source . "; connect-src 'self'" . $audio_source . "; font-src 'self'; object-src 'none'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
		true
	);
	header( 'Referrer-Policy: no-referrer', true );
	header( 'X-Content-Type-Options: nosniff', true );
	header( 'X-Frame-Options: SAMEORIGIN', true );
	header( 'Permissions-Policy: camera=(), geolocation=(), microphone=(self)', true );
	header( 'X-Robots-Tag: noindex, nofollow, noarchive', true );
	header( 'X-StoryForge-Route: wordpress-gateway', true );
}

/**
 * Emit a bounded JSON error without provider or filesystem details.
 *
 * @param int    $status  HTTP status.
 * @param string $code    Stable error code.
 * @param string $message Public message.
 */
function mmsfr_send_error( $status, $code, $message ) {
	mmsfr_clear_output_buffers();
	status_header( $status );
	mmsfr_send_security_headers( 'no-store, private', true );
	header( 'Content-Type: application/json; charset=utf-8', true );

	$body = wp_json_encode(
		array(
			'error' => array(
				'code'    => sanitize_key( $code ),
				'message' => (string) $message,
			),
		)
	);
	if ( ! is_string( $body ) ) {
		$body = '{"error":{"code":"route_failed","message":"StoryForge could not complete this request."}}';
	}
	header( 'Content-Length: ' . strlen( $body ), true );
	if ( 'HEAD' !== mmsfr_request_method() ) {
		echo $body;
	}
	exit;
}

/**
 * Return the normalized request method.
 *
 * @return string
 */
function mmsfr_request_method() {
	return isset( $_SERVER['REQUEST_METHOD'] )
		? strtoupper( (string) $_SERVER['REQUEST_METHOD'] )
		: 'GET';
}

/**
 * Preserve the raw query string while excluding response-splitting bytes.
 *
 * @return string
 */
function mmsfr_query_suffix() {
	$query = isset( $_SERVER['QUERY_STRING'] ) ? (string) $_SERVER['QUERY_STRING'] : '';
	$query = str_replace( array( "\r", "\n" ), '', $query );
	return '' === $query ? '' : '?' . $query;
}

/**
 * Reject malformed request targets before route classification or proxying.
 *
 * @param string $path Request path.
 */
function mmsfr_validate_request_target( $path ) {
	$query = isset( $_SERVER['QUERY_STRING'] ) ? (string) $_SERVER['QUERY_STRING'] : '';
	if ( strlen( $path ) > 2048 || strlen( $query ) > 4096 ) {
		mmsfr_send_error( 414, 'request_target_too_long', 'The StoryForge request target is too long.' );
	}
	if (
		1 === preg_match( '/[\x00-\x1F\x7F]/', $path )
		|| 1 !== preg_match( '#^/[A-Za-z0-9/_.-]*$#', $path )
	) {
		mmsfr_send_error( 400, 'invalid_request_path', 'The StoryForge request path is invalid.' );
	}
	foreach ( explode( '/', $path ) as $segment ) {
		if ( '.' === $segment || '..' === $segment ) {
			mmsfr_send_error( 400, 'invalid_request_path', 'The StoryForge request path is invalid.' );
		}
	}
}

/**
 * Emit a relative permanent redirect.
 *
 * @param string $path Destination path.
 */
function mmsfr_send_redirect( $path ) {
	mmsfr_clear_output_buffers();
	status_header( 308 );
	mmsfr_send_security_headers( 'no-store, max-age=0', false );
	header( 'Location: ' . $path . mmsfr_query_suffix(), true, 308 );
	header( 'Content-Length: 0', true );
	exit;
}

/**
 * Resolve and validate the pinned Railway origin.
 *
 * @return string
 */
function mmsfr_origin() {
	$default = 'https://storyforge-v5-api-production.up.railway.app';
	$value   = defined( 'MISSIONMED_STORYFORGE_ORIGIN' )
		? (string) MISSIONMED_STORYFORGE_ORIGIN
		: $default;
	$value   = rtrim(
		esc_url_raw( (string) apply_filters( 'missionmed_storyforge_route_origin', $value ) ),
		'/'
	);
	$parts   = wp_parse_url( $value );

	if ( ! is_array( $parts ) || empty( $parts['scheme'] ) || empty( $parts['host'] ) ) {
		return '';
	}
	$scheme        = strtolower( (string) $parts['scheme'] );
	$local_fixture = 'local' === wp_get_environment_type()
		&& defined( 'MISSIONMED_STORYFORGE_LOCAL_FIXTURES' )
		&& MISSIONMED_STORYFORGE_LOCAL_FIXTURES;
	$local_http    = 'http' === $scheme
		&& $local_fixture
		&& 'host.docker.internal' === strtolower( (string) $parts['host'] )
		&& ! empty( $parts['port'] );
	if ( 'https' !== $scheme && ! $local_http ) {
		return '';
	}
	if (
		! $local_fixture
		&& (
			'storyforge-v5-api-production.up.railway.app' !== strtolower( (string) $parts['host'] )
			|| ! empty( $parts['port'] )
		)
	) {
		return '';
	}
	if (
		! empty( $parts['user'] )
		|| ! empty( $parts['pass'] )
		|| ! empty( $parts['query'] )
		|| ! empty( $parts['fragment'] )
		|| ( ! empty( $parts['path'] ) && '/' !== $parts['path'] )
	) {
		return '';
	}

	return $value;
}

/**
 * Return the exact WordPress origin used for same-origin API requests.
 *
 * @return string
 */
function mmsfr_wordpress_origin() {
	$parts = wp_parse_url( home_url( '/' ) );
	if ( ! is_array( $parts ) || empty( $parts['scheme'] ) || empty( $parts['host'] ) ) {
		return '';
	}
	$origin = strtolower( (string) $parts['scheme'] ) . '://' . strtolower( (string) $parts['host'] );
	if ( ! empty( $parts['port'] ) ) {
		$origin .= ':' . absint( $parts['port'] );
	}
	return $origin;
}

/**
 * Read the global StoryForge feature switch and fail closed if its owner is unavailable.
 *
 * @return bool
 */
function mmsfr_feature_enabled() {
	if ( ! function_exists( 'mmsf_settings' ) ) {
		return false;
	}
	$settings = mmsf_settings();
	return is_array( $settings ) && ! empty( $settings['storyforge_enabled'] );
}

/**
 * Ensure an asset-relative path cannot escape the approved release.
 *
 * @param string $encoded Encoded path relative to /storyforge/.
 * @return string
 */
function mmsfr_safe_relative_path( $encoded ) {
	$decoded = rawurldecode( (string) $encoded );
	if ( str_contains( $decoded, "\0" ) || str_contains( $decoded, '\\' ) || str_starts_with( $decoded, '/' ) ) {
		return '';
	}
	foreach ( explode( '/', $decoded ) as $segment ) {
		if ( '.' === $segment || '..' === $segment || '' === $segment ) {
			return '';
		}
	}
	return $decoded;
}

/**
 * Resolve the approved manifest key for a static request.
 *
 * @param string $path Request path.
 * @return string
 */
function mmsfr_static_manifest_key( $path ) {
	$relative = substr( $path, strlen( MMSFR_BASE_PATH ) );
	if ( '' === $relative ) {
		return 'index.html';
	}

	$safe = mmsfr_safe_relative_path( $relative );
	if ( '' === $safe ) {
		return '';
	}
	$manifest = mmsfr_asset_manifest();
	if ( 1 === preg_match( '#^_asset/([a-f0-9]{12})$#', $safe, $matches ) ) {
		foreach ( $manifest as $manifest_key => $entry ) {
			if (
				'index.html' !== $manifest_key
				&& isset( $entry['alias'] )
				&& is_string( $entry['alias'] )
				&& hash_equals( $entry['alias'], $matches[1] )
			) {
				return $manifest_key;
			}
		}
		return '';
	}
	if (
		str_starts_with( $safe, '_asset/' )
		|| str_starts_with( $safe, 'assets/' )
		|| '' !== pathinfo( basename( $safe ), PATHINFO_EXTENSION )
	) {
		return '';
	}
	return 'index.html';
}

/**
 * Load the exact nested release bundle without relying on a sibling filesystem path.
 *
 * @return array{release_id:string,assets:array<string,array<string,mixed>>}|null
 */
function mmsfr_release_bundle() {
	static $loaded = false;
	static $bundle = null;
	if ( $loaded ) {
		return $bundle;
	}
	$loaded = true;

	if (
		1 !== preg_match( '/^v-[a-f0-9]{16}$/', MMSFR_RELEASE_ID )
		|| 1 !== preg_match( '/^[a-f0-9]{64}$/', MMSFR_RELEASE_PHP_SHA256 )
		|| MMSFR_RELEASE_PHP_SIZE < 1
	) {
		return null;
	}
	$runtime_root  = __DIR__ . '/missionmed-storyforge-runtime';
	$releases_path = $runtime_root . '/releases';
	$current_link  = $runtime_root . '/current';
	if (
		is_link( $runtime_root )
		|| ! is_dir( $runtime_root )
		|| is_link( $releases_path )
		|| ! is_dir( $releases_path )
		|| ! is_link( $current_link )
	) {
		return null;
	}
	$releases_root = realpath( $releases_path );
	$current_target = readlink( $current_link );
	if (
		false === $releases_root
		|| ! is_string( $current_target )
		|| 1 !== preg_match( '#^releases/([a-f0-9]{40})$#', $current_target, $matches )
	) {
		return null;
	}
	$selected_path = $releases_path . '/' . $matches[1];
	if ( is_link( $selected_path ) || ! is_dir( $selected_path ) ) {
		return null;
	}
	$selected = realpath( $selected_path );
	$current  = realpath( $current_link );
	if (
		false === $selected
		|| false === $current
		|| $selected !== $releases_root . '/' . $matches[1]
		|| $current !== $selected
	) {
		return null;
	}
	$bundle_file = $selected . '/release.php';
	$bundle_real = realpath( $bundle_file );
	if (
		false === $bundle_real
		|| $bundle_real !== $bundle_file
		|| ! is_file( $bundle_real )
		|| is_link( $bundle_file )
	) {
		return null;
	}
	$bundle_size = filesize( $bundle_real );
	$bundle_hash = hash_file( 'sha256', $bundle_real );
	if (
		false === $bundle_size
		|| (int) $bundle_size !== MMSFR_RELEASE_PHP_SIZE
		|| ! is_string( $bundle_hash )
		|| ! hash_equals( MMSFR_RELEASE_PHP_SHA256, $bundle_hash )
	) {
		return null;
	}
	$candidate = require $bundle_real;
	if (
		! is_array( $candidate )
		|| ! isset( $candidate['release_id'], $candidate['assets'] )
		|| ! is_string( $candidate['release_id'] )
		|| ! hash_equals( MMSFR_RELEASE_ID, $candidate['release_id'] )
		|| ! is_array( $candidate['assets'] )
	) {
		return null;
	}

	$manifest = mmsfr_asset_manifest();
	if ( count( $candidate['assets'] ) !== count( $manifest ) ) {
		return null;
	}
	foreach ( $manifest as $entry ) {
		if (
			! isset( $entry['alias'] )
			|| ! is_string( $entry['alias'] )
			|| ! isset( $candidate['assets'][ $entry['alias'] ] )
		) {
			return null;
		}
	}
	$bundle = $candidate;
	return $bundle;
}

/**
 * Return verified bytes for one exact manifest-approved asset.
 *
 * @param string $manifest_key Manifest path.
 * @return array{bytes:string,entry:array{alias:string,sha256:string,size:int,type:string,cache:string}}|null
 */
function mmsfr_release_asset( $manifest_key ) {
	$manifest = mmsfr_asset_manifest();
	$bundle   = mmsfr_release_bundle();
	if (
		null === $bundle
		|| ! isset( $manifest[ $manifest_key ] )
		|| ! is_array( $manifest[ $manifest_key ] )
	) {
		return null;
	}
	$entry = $manifest[ $manifest_key ];
	if (
		! isset(
			$entry['alias'],
			$entry['sha256'],
			$entry['size'],
			$entry['type'],
			$entry['cache'],
			$bundle['assets'][ $entry['alias'] ]
		)
		|| ! is_array( $bundle['assets'][ $entry['alias'] ] )
	) {
		return null;
	}
	$bundled = $bundle['assets'][ $entry['alias'] ];
	foreach ( array( 'path', 'alias', 'sha256', 'size', 'type', 'cache', 'bytes_base64' ) as $field ) {
		if ( ! array_key_exists( $field, $bundled ) ) {
			return null;
		}
	}
	if (
		! is_string( $bundled['path'] )
		|| ! hash_equals( $manifest_key, $bundled['path'] )
		|| ! is_string( $bundled['alias'] )
		|| ! hash_equals( (string) $entry['alias'], $bundled['alias'] )
		|| ! is_string( $bundled['sha256'] )
		|| ! hash_equals( (string) $entry['sha256'], $bundled['sha256'] )
		|| (int) $entry['size'] !== (int) $bundled['size']
		|| ! is_string( $bundled['type'] )
		|| ! hash_equals( (string) $entry['type'], $bundled['type'] )
		|| ! is_string( $bundled['cache'] )
		|| ! hash_equals( (string) $entry['cache'], $bundled['cache'] )
		|| ! is_string( $bundled['bytes_base64'] )
	) {
		return null;
	}
	$bytes = base64_decode( $bundled['bytes_base64'], true );
	if (
		! is_string( $bytes )
		|| strlen( $bytes ) !== (int) $entry['size']
		|| ! hash_equals( (string) $entry['sha256'], hash( 'sha256', $bytes ) )
	) {
		return null;
	}
	return array(
		'bytes' => $bytes,
		'entry' => $entry,
	);
}

/**
 * Serve one exact manifest-approved bundle asset.
 *
 * @param string $manifest_key Manifest path.
 */
function mmsfr_serve_static( $manifest_key ) {
	if ( ! in_array( mmsfr_request_method(), array( 'GET', 'HEAD' ), true ) ) {
		if ( ! headers_sent() ) {
			header( 'Allow: GET, HEAD', true );
		}
		mmsfr_send_error( 405, 'method_not_allowed', 'This method is not allowed for StoryForge assets.' );
	}

	$manifest = mmsfr_asset_manifest();
	if ( '' === $manifest_key || ! isset( $manifest[ $manifest_key ] ) ) {
		mmsfr_send_error( 404, 'asset_not_found', 'StoryForge asset not found.' );
	}
	$asset = mmsfr_release_asset( $manifest_key );
	if ( null === $asset ) {
		mmsfr_send_error( 503, 'release_integrity_failed', 'StoryForge is temporarily unavailable.' );
	}
	$entry = $asset['entry'];
	$bytes = $asset['bytes'];

	$cache = 'no-cache';
	if ( 'html' === $entry['cache'] ) {
		$cache = 'no-store, max-age=0';
	} elseif ( 'immutable' === $entry['cache'] ) {
		$cache = 'public, max-age=31536000, immutable';
	}

	mmsfr_clear_output_buffers();
	status_header( 200 );
	mmsfr_send_security_headers( $cache, false );
	header( 'Content-Type: ' . $entry['type'], true );
	header( 'Content-Length: ' . strlen( $bytes ), true );
	if ( 'HEAD' !== mmsfr_request_method() ) {
		echo $bytes;
	}
	exit;
}

/**
 * Read a single incoming header from explicit server variables.
 *
 * @param string $name Header name.
 * @return string
 */
function mmsfr_incoming_header( $name ) {
	$server_keys = array(
		'accept'        => array( 'HTTP_ACCEPT' ),
		'authorization' => array( 'HTTP_AUTHORIZATION', 'REDIRECT_HTTP_AUTHORIZATION' ),
		'content-type'  => array( 'CONTENT_TYPE', 'HTTP_CONTENT_TYPE' ),
		'origin'        => array( 'HTTP_ORIGIN' ),
	);
	foreach ( $server_keys[ $name ] ?? array() as $key ) {
		if ( isset( $_SERVER[ $key ] ) && is_scalar( $_SERVER[ $key ] ) ) {
			$value = trim( (string) wp_unslash( $_SERVER[ $key ] ) );
			if ( strlen( $value ) <= 16384 && ! str_contains( $value, "\r" ) && ! str_contains( $value, "\n" ) ) {
				return $value;
			}
		}
	}
	if ( function_exists( 'getallheaders' ) ) {
		$headers = getallheaders();
		if ( is_array( $headers ) ) {
			foreach ( $headers as $header_name => $header_value ) {
				if ( strtolower( (string) $header_name ) !== $name || ! is_scalar( $header_value ) ) {
					continue;
				}
				$value = trim( (string) $header_value );
				if ( strlen( $value ) <= 16384 && ! str_contains( $value, "\r" ) && ! str_contains( $value, "\n" ) ) {
					return $value;
				}
			}
		}
	}
	return '';
}

/**
 * Read a bounded request body.
 *
 * @return string
 */
function mmsfr_request_body() {
	$content_length_raw = isset( $_SERVER['CONTENT_LENGTH'] ) ? trim( (string) $_SERVER['CONTENT_LENGTH'] ) : '';
	if ( '' !== $content_length_raw && ! ctype_digit( $content_length_raw ) ) {
		mmsfr_send_error( 400, 'invalid_content_length', 'The StoryForge request is invalid.' );
	}
	$content_length = '' !== $content_length_raw ? (int) $content_length_raw : 0;
	if ( $content_length > MMSFR_MAX_BODY_BYTES ) {
		mmsfr_send_error( 413, 'request_too_large', 'Request exceeds the 6 MB limit.' );
	}
	$stream = fopen( 'php://input', 'rb' );
	if ( false === $stream ) {
		mmsfr_send_error( 400, 'invalid_request_body', 'The StoryForge request is invalid.' );
	}
	$body = stream_get_contents( $stream, MMSFR_MAX_BODY_BYTES + 1 );
	fclose( $stream );
	$body = is_string( $body ) ? $body : '';
	if ( strlen( $body ) > MMSFR_MAX_BODY_BYTES ) {
		mmsfr_send_error( 413, 'request_too_large', 'Request exceeds the 6 MB limit.' );
	}
	return $body;
}

/**
 * Return whether a path is the exact Phase 1 recording-segment upload route.
 *
 * @param string $path Request path.
 * @return bool
 */
function mmsfr_is_recording_segment_upload_path( $path ) {
	return 1 === preg_match(
		'#^' . preg_quote( MMSFR_BASE_PATH, '#' ) . 'api/recordings/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/segments$#i',
		$path
	);
}

/**
 * Return whether a path is the exact B1-511 mentor-note audio upload route.
 *
 * @param string $path Request path.
 * @return bool
 */
function mmsfr_is_mentor_note_audio_upload_path( $path ) {
	return 1 === preg_match(
		'#^' . preg_quote( MMSFR_BASE_PATH, '#' ) . 'api/mentor-notes/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/audio$#i',
		$path
	);
}

/**
 * Return whether a path is the exact Phase 1 audio deletion route.
 *
 * @param string $path Request path.
 * @return bool
 */
function mmsfr_is_audio_delete_path( $path ) {
	return 1 === preg_match(
		'#^' . preg_quote( MMSFR_BASE_PATH, '#' ) . 'api/audio/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$#i',
		$path
	);
}

/**
 * Return whether a path is the exact B1-512 private story-media deletion route.
 *
 * @param string $path Request path.
 * @return bool
 */
function mmsfr_is_story_media_delete_path( $path ) {
	return 1 === preg_match(
		'#^' . preg_quote( MMSFR_BASE_PATH, '#' ) . 'api/story-media/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$#i',
		$path
	);
}

/**
 * Accept the browser-generated multipart content type only when it contains
 * one bounded RFC-compatible boundary and no additional parameters.
 *
 * @param string $content_type Content-Type header value.
 * @return bool
 */
function mmsfr_is_bounded_multipart_content_type( $content_type ) {
	return 1 === preg_match(
		'#^multipart/form-data\s*;\s*boundary=(?:"[A-Za-z0-9\'()+_,./:=?-]{1,70}"|[A-Za-z0-9\'()+_,./:=?-]{1,70})\s*$#i',
		$content_type
	);
}

/**
 * Rebuild PHP's parsed multipart upload into one bounded upstream request.
 *
 * PHP consumes multipart request bodies into $_POST and $_FILES before
 * WordPress runs. The upstream boundary is therefore intentionally new; no
 * client-supplied filename or multipart header is forwarded.
 *
 * @param array  $fields   Validated scalar fields.
 * @param string $bytes    Validated segment bytes.
 * @param string $mime_type Validated audio MIME type.
 * @param string $boundary New upstream multipart boundary.
 * @return string
 */
function mmsfr_build_segment_multipart_body( $fields, $bytes, $mime_type, $boundary ) {
	$body = '';
	foreach ( array( 'seq', 'durationMs' ) as $name ) {
		$body .= '--' . $boundary . "\r\n";
		$body .= 'Content-Disposition: form-data; name="' . $name . "\"\r\n\r\n";
		$body .= $fields[ $name ] . "\r\n";
	}
	$body .= '--' . $boundary . "\r\n";
	$body .= "Content-Disposition: form-data; name=\"segment\"; filename=\"segment\"\r\n";
	$body .= 'Content-Type: ' . $mime_type . "\r\n\r\n";
	$body .= $bytes . "\r\n";
	$body .= '--' . $boundary . "--\r\n";
	return $body;
}

/**
 * Rebuild the exact B1-511 mentor-note audio form for the upstream API.
 *
 * @param array  $fields    Validated scalar fields.
 * @param string $bytes     Validated audio bytes.
 * @param string $mime_type Validated audio MIME type.
 * @param string $boundary  New upstream multipart boundary.
 * @return string
 */
function mmsfr_build_mentor_note_multipart_body( $fields, $bytes, $mime_type, $boundary ) {
	$body = '';
	foreach ( array( 'durationMs', 'expectedVersion', 'mimeType' ) as $name ) {
		$body .= '--' . $boundary . "\r\n";
		$body .= 'Content-Disposition: form-data; name="' . $name . "\"\r\n\r\n";
		$body .= $fields[ $name ] . "\r\n";
	}
	$body .= '--' . $boundary . "\r\n";
	$body .= "Content-Disposition: form-data; name=\"segment\"; filename=\"segment\"\r\n";
	$body .= 'Content-Type: ' . $mime_type . "\r\n\r\n";
	$body .= $bytes . "\r\n";
	$body .= '--' . $boundary . "--\r\n";
	return $body;
}

/**
 * Read and validate the one exact multipart shape used by Phase 1 recording.
 *
 * @return array{body:string,content_type:string}
 */
function mmsfr_segment_multipart_request() {
	$field_names = array_keys( $_POST );
	$file_names  = array_keys( $_FILES );
	sort( $field_names );
	sort( $file_names );
	if ( array( 'durationMs', 'seq' ) !== $field_names || array( 'segment' ) !== $file_names ) {
		mmsfr_send_error( 400, 'invalid_multipart', 'The audio segment form is invalid.' );
	}
	$seq      = $_POST['seq'];
	$duration = $_POST['durationMs'];
	if (
		! is_string( $seq )
		|| ! is_string( $duration )
		|| 1 !== preg_match( '/^(?:0|[1-9][0-9]{0,2})$/', $seq )
		|| 1 !== preg_match( '/^[1-9][0-9]{0,6}$/', $duration )
	) {
		mmsfr_send_error( 400, 'invalid_multipart', 'The audio segment form is invalid.' );
	}
	$file = $_FILES['segment'];
	if (
		! is_array( $file )
		|| UPLOAD_ERR_OK !== ( $file['error'] ?? null )
		|| ! is_int( $file['size'] ?? null )
		|| ! is_string( $file['tmp_name'] ?? null )
		|| ! is_string( $file['type'] ?? null )
	) {
		mmsfr_send_error( 400, 'invalid_multipart', 'The audio segment upload is invalid.' );
	}
	if ( $file['size'] <= 0 ) {
		mmsfr_send_error( 400, 'invalid_audio_size', 'An audio segment is required.' );
	}
	if ( $file['size'] > MMSFR_MAX_BODY_BYTES ) {
		mmsfr_send_error( 413, 'request_too_large', 'Request exceeds the 6 MB limit.' );
	}
	$mime_type = strtolower( trim( $file['type'] ) );
	if ( 1 !== preg_match( '#^audio/(?:webm|mp4|ogg|wav)(?:\s*;\s*codecs=[A-Za-z0-9._-]+)?$#', $mime_type ) ) {
		mmsfr_send_error( 400, 'invalid_multipart', 'The audio segment type is invalid.' );
	}
	if ( ! is_uploaded_file( $file['tmp_name'] ) || ! is_readable( $file['tmp_name'] ) ) {
		mmsfr_send_error( 400, 'invalid_multipart', 'The audio segment upload is invalid.' );
	}
	$bytes = file_get_contents( $file['tmp_name'] );
	if ( ! is_string( $bytes ) || strlen( $bytes ) !== $file['size'] ) {
		mmsfr_send_error( 400, 'invalid_multipart', 'The audio segment upload is invalid.' );
	}
	try {
		$boundary = 'mmsfr-' . bin2hex( random_bytes( 18 ) );
	} catch ( Exception $error ) {
		mmsfr_send_error( 503, 'origin_unavailable', 'StoryForge is temporarily unavailable.' );
	}
	$body = mmsfr_build_segment_multipart_body(
		array(
			'seq'        => $seq,
			'durationMs' => $duration,
		),
		$bytes,
		$mime_type,
		$boundary
	);
	if ( strlen( $body ) > MMSFR_MAX_BODY_BYTES ) {
		mmsfr_send_error( 413, 'request_too_large', 'Request exceeds the 6 MB limit.' );
	}
	return array(
		'body'         => $body,
		'content_type' => 'multipart/form-data; boundary=' . $boundary,
	);
}

/**
 * Read and validate the one exact multipart shape used by B1-511 mentor audio.
 *
 * @return array{body:string,content_type:string}
 */
function mmsfr_mentor_note_multipart_request() {
	$field_names = array_keys( $_POST );
	$file_names  = array_keys( $_FILES );
	sort( $field_names );
	sort( $file_names );
	if (
		array( 'durationMs', 'expectedVersion', 'mimeType' ) !== $field_names
		|| array( 'segment' ) !== $file_names
	) {
		mmsfr_send_error( 400, 'invalid_multipart', 'The mentor audio form is invalid.' );
	}
	$duration         = $_POST['durationMs'];
	$expected_version = $_POST['expectedVersion'];
	$declared_mime    = strtolower( trim( (string) $_POST['mimeType'] ) );
	if (
		! is_string( $duration )
		|| ! is_string( $expected_version )
		|| ! is_string( $_POST['mimeType'] )
		|| 1 !== preg_match( '/^[1-9][0-9]{0,6}$/', $duration )
		|| 1 !== preg_match( '/^(?:0|[1-9][0-9]{0,18})$/', $expected_version )
		|| 1 !== preg_match( '#^audio/(?:webm|mp4|ogg|wav)(?:\s*;\s*codecs=[A-Za-z0-9._-]+)?$#', $declared_mime )
	) {
		mmsfr_send_error( 400, 'invalid_multipart', 'The mentor audio form is invalid.' );
	}
	$file = $_FILES['segment'];
	if (
		! is_array( $file )
		|| UPLOAD_ERR_OK !== ( $file['error'] ?? null )
		|| ! is_int( $file['size'] ?? null )
		|| ! is_string( $file['tmp_name'] ?? null )
		|| ! is_string( $file['type'] ?? null )
	) {
		mmsfr_send_error( 400, 'invalid_multipart', 'The mentor audio upload is invalid.' );
	}
	if ( $file['size'] <= 0 ) {
		mmsfr_send_error( 400, 'invalid_audio_size', 'Mentor audio is required.' );
	}
	if ( $file['size'] > MMSFR_MAX_BODY_BYTES ) {
		mmsfr_send_error( 413, 'request_too_large', 'Request exceeds the 6 MB limit.' );
	}
	$mime_type = strtolower( trim( $file['type'] ) );
	if (
		1 !== preg_match( '#^audio/(?:webm|mp4|ogg|wav)(?:\s*;\s*codecs=[A-Za-z0-9._-]+)?$#', $mime_type )
		|| $declared_mime !== $mime_type
	) {
		mmsfr_send_error( 400, 'invalid_multipart', 'The mentor audio type is invalid.' );
	}
	if ( ! is_uploaded_file( $file['tmp_name'] ) || ! is_readable( $file['tmp_name'] ) ) {
		mmsfr_send_error( 400, 'invalid_multipart', 'The mentor audio upload is invalid.' );
	}
	$bytes = file_get_contents( $file['tmp_name'] );
	if ( ! is_string( $bytes ) || strlen( $bytes ) !== $file['size'] ) {
		mmsfr_send_error( 400, 'invalid_multipart', 'The mentor audio upload is invalid.' );
	}
	try {
		$boundary = 'mmsfr-' . bin2hex( random_bytes( 18 ) );
	} catch ( Exception $error ) {
		mmsfr_send_error( 503, 'origin_unavailable', 'StoryForge is temporarily unavailable.' );
	}
	$body = mmsfr_build_mentor_note_multipart_body(
		array(
			'durationMs'     => $duration,
			'expectedVersion' => $expected_version,
			'mimeType'       => $declared_mime,
		),
		$bytes,
		$mime_type,
		$boundary
	);
	if ( strlen( $body ) > MMSFR_MAX_BODY_BYTES ) {
		mmsfr_send_error( 413, 'request_too_large', 'Request exceeds the 6 MB limit.' );
	}
	return array(
		'body'         => $body,
		'content_type' => 'multipart/form-data; boundary=' . $boundary,
	);
}

/**
 * Proxy a strict StoryForge API or health request to the pinned origin.
 *
 * @param string $path Request path.
 */
function mmsfr_proxy_request( $path ) {
	$method       = mmsfr_request_method();
	$is_audio_delete = 'DELETE' === $method && mmsfr_is_audio_delete_path( $path );
	$is_story_media_delete = 'DELETE' === $method && mmsfr_is_story_media_delete_path( $path );
	$is_privacy_delete = $is_audio_delete || $is_story_media_delete;
	$allowed      = array( 'GET', 'POST', 'PATCH' );
	$health_path  = MMSFR_BASE_PATH . 'healthz';
	$is_health    = $path === $health_path;
	$health_allow = array( 'GET' );
	if ( ! in_array( $method, $is_health ? $health_allow : $allowed, true ) && ! $is_privacy_delete ) {
		if ( ! headers_sent() ) {
			header( 'Allow: ' . implode( ', ', $is_health ? $health_allow : $allowed ), true );
		}
		mmsfr_send_error( 405, 'method_not_allowed', 'This method is not allowed for StoryForge.' );
	}
	$is_public_config = $path === MMSFR_BASE_PATH . 'api/config' && 'GET' === $method;
	if ( str_starts_with( $path, MMSFR_BASE_PATH . 'api/dev/' ) ) {
		mmsfr_send_error( 404, 'not_found', 'StoryForge resource not found.' );
	}
	if ( ! $is_health && ! $is_public_config && ! mmsfr_feature_enabled() ) {
		mmsfr_send_error( 403, 'storyforge_disabled', 'StoryForge is not enabled for this pilot.' );
	}

	$origin = mmsfr_origin();
	if ( '' === $origin ) {
		mmsfr_send_error( 503, 'origin_unavailable', 'StoryForge is temporarily unavailable.' );
	}
	$canonical   = rtrim( MMSFR_BASE_PATH, '/' );
	$target_path = substr( $path, strlen( $canonical ) );
	$target_url  = $origin . $target_path . mmsfr_query_suffix();
	$headers     = array();
	foreach ( array( 'accept', 'authorization', 'content-type', 'origin' ) as $name ) {
		$value = mmsfr_incoming_header( $name );
		if ( '' !== $value ) {
			$headers[ $name ] = $value;
		}
	}
	if ( ! $is_health && ! $is_public_config ) {
		$authorization = $headers['authorization'] ?? '';
		if ( 1 !== preg_match( '/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/', $authorization ) ) {
			mmsfr_send_error( 401, 'auth_required', 'A valid StoryForge session is required.' );
		}
	}
	$incoming_origin = $headers['origin'] ?? '';
	if ( '' !== $incoming_origin ) {
		$origin_parts = wp_parse_url( $incoming_origin );
		$normalized   = '';
		if ( is_array( $origin_parts ) && ! empty( $origin_parts['scheme'] ) && ! empty( $origin_parts['host'] ) ) {
			$normalized = strtolower( (string) $origin_parts['scheme'] )
				. '://'
				. strtolower( (string) $origin_parts['host'] );
			if ( ! empty( $origin_parts['port'] ) ) {
				$normalized .= ':' . absint( $origin_parts['port'] );
			}
		}
		if (
			$normalized !== strtolower( rtrim( $incoming_origin, '/' ) )
			|| ! hash_equals( mmsfr_wordpress_origin(), $normalized )
		) {
			mmsfr_send_error( 403, 'origin_not_allowed', 'This origin is not allowed to call StoryForge.' );
		}
	}
	$is_segment_upload     = 'POST' === $method && mmsfr_is_recording_segment_upload_path( $path );
	$is_mentor_audio_upload = 'POST' === $method && mmsfr_is_mentor_note_audio_upload_path( $path );
	$is_audio_upload       = $is_segment_upload || $is_mentor_audio_upload;
	if ( in_array( $method, array( 'POST', 'PATCH' ), true ) ) {
		$content_type = $headers['content-type'] ?? '';
		$is_json           = 1 === preg_match( '#^application/json(?:\s*;|$)#i', $content_type );
		$is_multipart      = $is_audio_upload && mmsfr_is_bounded_multipart_content_type( $content_type );
		if ( ( $is_audio_upload && ! $is_multipart ) || ( ! $is_audio_upload && ! $is_json ) ) {
			mmsfr_send_error(
				415,
				'unsupported_content_type',
				$is_audio_upload
					? 'StoryForge accepts bounded multipart audio only on this route.'
					: 'StoryForge accepts JSON requests only.'
			);
		}
	}
	$request_body = '';
	if ( $is_audio_upload && isset( $is_multipart ) && $is_multipart ) {
		$multipart              = $is_mentor_audio_upload
			? mmsfr_mentor_note_multipart_request()
			: mmsfr_segment_multipart_request();
		$request_body           = $multipart['body'];
		$headers['content-type'] = $multipart['content_type'];
	} elseif ( in_array( $method, array( 'POST', 'PATCH' ), true ) ) {
		$request_body = mmsfr_request_body();
	}

	$local_fixture = 'http' === (string) wp_parse_url( $origin, PHP_URL_SCHEME );
	$args          = array(
		'method'              => $method,
		'headers'             => $headers,
		'body'                => $request_body,
		'timeout'             => MMSFR_TIMEOUT_SECONDS,
		'redirection'         => 0,
		'blocking'            => true,
		'sslverify'           => true,
		'reject_unsafe_urls'  => ! $local_fixture,
		'limit_response_size' => MMSFR_MAX_RESPONSE_BYTES + 1,
	);

	$response = $local_fixture
		? wp_remote_request( $target_url, $args )
		: wp_safe_remote_request( $target_url, $args );
	if ( is_wp_error( $response ) ) {
		mmsfr_send_error( 502, 'origin_request_failed', 'StoryForge is temporarily unavailable.' );
	}

	$status = (int) wp_remote_retrieve_response_code( $response );
	$body   = (string) wp_remote_retrieve_body( $response );
	$length = wp_remote_retrieve_header( $response, 'content-length' );
	if (
		$status < 100
		|| $status > 599
		|| ( $status >= 300 && $status < 400 )
		|| ( is_scalar( $length ) && absint( $length ) > MMSFR_MAX_RESPONSE_BYTES )
		|| strlen( $body ) > MMSFR_MAX_RESPONSE_BYTES
	) {
		mmsfr_send_error( 502, 'origin_response_rejected', 'StoryForge is temporarily unavailable.' );
	}

	$content_type = (string) wp_remote_retrieve_header( $response, 'content-type' );
	if ( 204 !== $status && '' !== $body && ! str_starts_with( strtolower( $content_type ), 'application/json' ) ) {
		mmsfr_send_error( 502, 'origin_response_rejected', 'StoryForge is temporarily unavailable.' );
	}
	if ( '' === $content_type ) {
		$content_type = 'application/json; charset=utf-8';
	}
	$decoded = null;
	if ( '' !== $body ) {
		$decoded = json_decode( $body, true );
		if ( JSON_ERROR_NONE !== json_last_error() ) {
			mmsfr_send_error( 502, 'origin_response_rejected', 'StoryForge is temporarily unavailable.' );
		}
	}
	if ( $is_health ) {
		if (
			200 !== $status
			|| ! is_array( $decoded )
			|| true !== ( $decoded['ok'] ?? false )
			|| 'storyforge-v5' !== ( $decoded['service'] ?? '' )
		) {
			mmsfr_send_error( 503, 'health_unavailable', 'StoryForge is temporarily unavailable.' );
		}
		$body         = '{"ok":true,"service":"storyforge-v5"}';
		$content_type = 'application/json; charset=utf-8';
	}

	mmsfr_clear_output_buffers();
	status_header( $status );
	mmsfr_send_security_headers( 'no-store, private', true );
	header( 'Content-Type: ' . str_replace( array( "\r", "\n" ), '', $content_type ), true );
	header( 'Content-Length: ' . strlen( $body ), true );
	if ( 'HEAD' !== $method && 204 !== $status ) {
		echo $body;
	}
	exit;
}

/**
 * Dispatch only the exact StoryForge route and leave all other paths untouched.
 */
function mmsfr_dispatch() {
	if ( ! empty( $GLOBALS['mmsfr_dispatched'] ) ) {
		return;
	}

	$path = mmsfr_request_path();
	if ( ! mmsfr_is_target_path( $path ) || ! mmsfr_is_canonical_host() ) {
		return;
	}
	$GLOBALS['mmsfr_dispatched'] = true;
	mmsfr_set_cache_guard();
	mmsfr_validate_request_target( $path );

	$normalized = preg_replace( '#/+#', '/', $path );
	if ( is_string( $normalized ) && $normalized !== $path ) {
		mmsfr_send_redirect( $normalized );
	}
	if ( rtrim( MMSFR_BASE_PATH, '/' ) === $path ) {
		mmsfr_send_redirect( MMSFR_BASE_PATH );
	}

	$api_path = MMSFR_BASE_PATH . 'api';
	if (
		$path === MMSFR_BASE_PATH . 'healthz'
		|| $path === $api_path
		|| str_starts_with( $path, $api_path . '/' )
	) {
		mmsfr_proxy_request( $path );
	}

	mmsfr_serve_static( mmsfr_static_manifest_key( $path ) );
}

add_action( 'parse_request', 'mmsfr_dispatch', 0 );
add_action( 'template_redirect', 'mmsfr_dispatch', 0 );
