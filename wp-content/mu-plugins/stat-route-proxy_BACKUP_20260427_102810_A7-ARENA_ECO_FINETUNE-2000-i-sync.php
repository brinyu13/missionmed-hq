<?php
/**
 * Route /stat to the canonical STAT HTML artifact while keeping first-party origin.
 *
 * Long-term routing model:
 * - MissionMed shell routes live on missionmedinstitute.com (/arena, /stat, ...)
 * - Runtime HTML artifacts can remain on CDN and be proxied server-side
 * - Browser stays on first-party origin so sessionStorage/auth continuity holds
 */

if ( ! function_exists( 'mm_stat_route_proxy_handle_request' ) ) {
	/**
	 * Serve /stat from upstream STAT artifact.
	 *
	 * This executes early enough to bypass WordPress 404 templates and
	 * returns HTML directly for /stat and /stat/.
	 */
	function mm_stat_route_proxy_handle_request() {
		$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) $_SERVER['REQUEST_URI'] : '';
		$path        = parse_url( $request_uri, PHP_URL_PATH );
		$normalized  = rtrim( (string) $path, '/' );

		if ( '/stat' !== $normalized ) {
			return;
		}

			$upstream_base = 'https://cdn.missionmedinstitute.com/html-system/LIVE/stat.html';
		$query_string  = isset( $_SERVER['QUERY_STRING'] ) ? trim( (string) $_SERVER['QUERY_STRING'] ) : '';
		$upstream_url  = $upstream_base;

		if ( '' !== $query_string ) {
			$upstream_url .= '?' . $query_string;
		}

		$response = wp_remote_get(
			$upstream_url,
			array(
				'timeout'     => 15,
				'redirection' => 3,
				'sslverify'   => true,
				'headers'     => array(
					'Accept' => 'text/html',
				),
			)
		);

		/*
		 * If upstream is temporarily unreachable, soft-fallback to direct CDN so
		 * users are not bounced to a cross-origin route that drops first-party auth context.
		 */
		if ( is_wp_error( $response ) ) {
			status_header( 502 );
			nocache_headers();
			header( 'Content-Type: text/plain; charset=' . get_bloginfo( 'charset' ) );
			header( 'X-MissionMed-Route: stat-proxy' );
			header( 'X-MissionMed-Stat-Intercept: true' );
			header( 'X-MissionMed-Upstream-Error: request_failed' );
			echo 'MissionMed STAT upstream fetch failed.';
			exit;
		}

		$status_code = (int) wp_remote_retrieve_response_code( $response );
		$body        = (string) wp_remote_retrieve_body( $response );

		if ( $status_code < 200 || $status_code >= 400 || '' === $body ) {
			status_header( 502 );
			nocache_headers();
			header( 'Content-Type: text/plain; charset=' . get_bloginfo( 'charset' ) );
			header( 'X-MissionMed-Route: stat-proxy' );
			header( 'X-MissionMed-Stat-Intercept: true' );
			header( 'X-MissionMed-Upstream-Status: ' . (string) $status_code );
			echo 'MissionMed STAT upstream returned invalid response.';
			exit;
		}

		status_header( 200 );
		nocache_headers();
		header( 'Content-Type: text/html; charset=' . get_bloginfo( 'charset' ) );
		header( 'X-MissionMed-Route: stat-proxy' );
		echo $body;
		exit;
	}
}

add_action( 'parse_request', 'mm_stat_route_proxy_handle_request', 0 );
