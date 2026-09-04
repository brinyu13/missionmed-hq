<?php
/**
 * Plugin Name: MissionMed Matrix Entitlement Guard
 * Description: Server-side direct-route and REST enforcement for Matrix app access.
 * Version: 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Normalize the current request path without trusting query parameters. */
function mmed_matrix_entitlement_request_path() {
	$uri  = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
	$path = wp_parse_url( $uri, PHP_URL_PATH );
	if ( ! is_string( $path ) || '' === $path ) {
		return '/';
	}
	return '/' . ltrim( preg_replace( '#/+#', '/', rawurldecode( $path ) ), '/' );
}

/** Return the premium Matrix app owning a direct browser route. */
function mmed_matrix_entitlement_app_for_path( $path ) {
	$routes = array(
		'/homepage-arena' => 'arena',
		'/arena'          => 'arena',
		'/stat'           => 'arena',
		'/stat-v3'        => 'arena',
		'/ivoncall.html'  => 'ivprep',
		'/iv-prep-on-call'=> 'ivprep',
		'/ranklistiq'     => 'ranklist',
		'/rank-list-engine' => 'ranklist',
		'/file-vault'     => 'filevault',
		'/schedule'       => 'scheduler',
	);
	$path = rtrim( (string) $path, '/' );
	if ( '' === $path ) {
		$path = '/';
	}
	foreach ( $routes as $prefix => $app ) {
		if ( $path === $prefix || 0 === strpos( $path, $prefix . '/' ) ) {
			return $app;
		}
	}
	return '';
}

/** One fail-closed call into the canonical resolver. */
function mmed_matrix_entitlement_user_allowed( $app, $user_id = 0 ) {
	$user_id = $user_id ? absint( $user_id ) : get_current_user_id();
	return $user_id > 0
		&& class_exists( 'MMED_Access_Gate' )
		&& method_exists( 'MMED_Access_Gate', 'user_can_access_app' )
		&& MMED_Access_Gate::user_can_access_app( $user_id, $app );
}

/** Block a logged-in account from bypassing a locked app by URL. */
function mmed_matrix_entitlement_direct_route_guard() {
	if ( is_admin() || ! is_user_logged_in() ) {
		return;
	}
	$app = mmed_matrix_entitlement_app_for_path( mmed_matrix_entitlement_request_path() );
	if ( '' === $app || mmed_matrix_entitlement_user_allowed( $app ) ) {
		return;
	}

	status_header( 403 );
	nocache_headers();
	header( 'X-MissionMed-Matrix-Access: entitlement-denied' );
	header( 'Content-Type: text/html; charset=' . get_bloginfo( 'charset' ) );
	$name = ucwords( str_replace( array( '-', '_' ), ' ', $app ) );
	echo '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Matrix app locked</title></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#071727;color:#eef5ff;font-family:system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif"><main style="max-width:560px;padding:32px"><p style="color:#ffd76a;font-weight:800;letter-spacing:.08em;text-transform:uppercase">Locked</p><h1 style="margin:.25rem 0">' . esc_html( $name ) . '</h1><p style="line-height:1.6;color:#c7d4e3">This app is visible in Matrix for discovery, but this account does not currently include access.</p><a style="display:inline-block;margin-top:12px;color:#071727;background:#ffd76a;padding:11px 16px;border-radius:9px;font-weight:800;text-decoration:none" href="' . esc_url( home_url( '/member-dashboard/#dashboard' ) ) . '">Return to Matrix</a></main></body></html>';
	exit;
}
add_action( 'parse_request', 'mmed_matrix_entitlement_direct_route_guard', -40 );
add_action( 'template_redirect', 'mmed_matrix_entitlement_direct_route_guard', -40 );

/** Map protected REST namespaces/routes to their Matrix app. */
function mmed_matrix_entitlement_app_for_rest_route( $route ) {
	$route = '/' . ltrim( (string) $route, '/' );
	$routes = array(
		'/rlq/v1/'              => 'ranklist',
		'/mmed/v1/ranklist'     => 'ranklist',
		'/mmed/v1/arena'        => 'arena',
		'/mmed/v1/files'        => 'filevault',
		'/mmed-file-vault/'     => 'filevault',
		'/mmed/v1/study-blocks' => 'study',
		'/mmed/v1/timeline'     => 'timeline',
	);
	foreach ( $routes as $prefix => $app ) {
		if ( 0 === strpos( $route, $prefix ) ) {
			return $app;
		}
	}
	return '';
}

/** Re-check entitlement server-side before protected REST callbacks execute. */
function mmed_matrix_entitlement_rest_guard( $result, $server, $request ) {
	if ( is_wp_error( $result ) || ! ( $request instanceof WP_REST_Request ) || 'OPTIONS' === $request->get_method() ) {
		return $result;
	}
	$app = mmed_matrix_entitlement_app_for_rest_route( $request->get_route() );
	if ( '' === $app ) {
		return $result;
	}
	if ( ! is_user_logged_in() ) {
		return new WP_Error( 'mmed_matrix_authentication_required', 'Authentication is required.', array( 'status' => 401 ) );
	}
	if ( ! mmed_matrix_entitlement_user_allowed( $app ) ) {
		return new WP_Error( 'mmed_matrix_entitlement_required', 'This Matrix app is locked for this account.', array( 'status' => 403 ) );
	}
	return $result;
}
add_filter( 'rest_pre_dispatch', 'mmed_matrix_entitlement_rest_guard', 5, 3 );
